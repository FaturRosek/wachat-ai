const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");
const WhatsappSessionModel = require("../models/whatsappSessionModel");
const ContactModel = require("../models/contactModel");
const MessageModel = require("../models/messageModel");
const UserModel = require("../models/userModel");
const SendingJobModel = require("../models/sendingJobModel");
const aiService = require("./aiService");
const { enqueueDispatch } = require("../jobs/messageQueue");
const { formatPhoneNumber } = require("../utils/phoneValidator");

const SESSIONS_BASE_DIR = path.join(__dirname, "../../sessions");

if (!fs.existsSync(SESSIONS_BASE_DIR)) {
  fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
}

let cachedWAVersion = null;

async function getWAVersion() {
  if (cachedWAVersion) return cachedWAVersion;
  try {
    const { version } = await fetchLatestBaileysVersion();
    cachedWAVersion = version;
    return version;
  } catch (e) {
    return [2, 3000, 1043857760];
  }
}

class WhatsappService {
  constructor() {
    this.sessions = new Map();
  }

  getSessionKey(userId, sessionName = "default") {
    return `${userId}_${sessionName}`;
  }

  getSessionDir(userId, sessionName = "default") {
    const sessionDir = path.join(SESSIONS_BASE_DIR, `${userId}_${sessionName}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  async initSession(userId, sessionName = "default", forceRestart = false, pairingPhone = null) {
    const key = this.getSessionKey(userId, sessionName);
    const existing = this.sessions.get(key);

    let cleanPairingPhone = null;
    if (pairingPhone) {
      const v = formatPhoneNumber(pairingPhone);
      if (!v.isValid) {
        const err = new Error(v.error || "Format nomor WhatsApp tidak valid");
        err.statusCode = 400;
        throw err;
      }
      cleanPairingPhone = v.formattedPhone;
    }

    if (existing && !forceRestart && existing.status === "CONNECTED") {
      return {
        status: "CONNECTED",
        phoneNumber: existing.phoneNumber,
        pairingPhone: null,
        pairingCode: null,
        qr: null,
        qrImage: null,
      };
    }

    if (
      existing &&
      !forceRestart &&
      cleanPairingPhone &&
      existing.status === "PAIRING_CODE" &&
      existing.pairingCode &&
      existing.pairingPhone === cleanPairingPhone
    ) {
      return {
        status: "PAIRING_CODE",
        phoneNumber: null,
        pairingPhone: existing.pairingPhone,
        pairingCode: existing.pairingCode,
        qr: null,
        qrImage: null,
      };
    }

    if (
      existing &&
      !forceRestart &&
      !cleanPairingPhone &&
      existing.status === "SCAN_QR" &&
      existing.qrImage
    ) {
      return {
        status: "SCAN_QR",
        phoneNumber: null,
        pairingPhone: null,
        pairingCode: null,
        qr: existing.qr,
        qrImage: existing.qrImage,
      };
    }

    if (existing) {
      existing.destroyed = true;
      if (existing.sock) {
        try {
          existing.sock.ev.removeAllListeners();
          existing.sock.end();
        } catch (e) {}
      }
      this.sessions.delete(key);
    }

    const sessionDir = this.getSessionDir(userId, sessionName);

    if (forceRestart) {
      try {
        if (fs.existsSync(sessionDir)) {
          fs.rmSync(sessionDir, { recursive: true, force: true });
          fs.mkdirSync(sessionDir, { recursive: true });
        }
      } catch (e) {
        console.error("[WhatsApp] Error resetting session dir:", e.message);
      }
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const version = await getWAVersion();

    await WhatsappSessionModel.upsert(userId, {
      sessionName,
      status: cleanPairingPhone ? "PAIRING_CODE" : "CONNECTING",
      phoneNumber: cleanPairingPhone || null,
      qrCode: null,
      sessionData: cleanPairingPhone ? { pairingPhone: cleanPairingPhone } : null,
    });

    const sessionState = {
      sock: null,
      status: "CONNECTING",
      qr: null,
      qrImage: null,
      pairingPhone: cleanPairingPhone,
      pairingCode: null,
      pairingPromise: null,
      phoneNumber: null,
      reconnectAttempts: 0,
      destroyed: false,
    };
    this.sessions.set(key, sessionState);

    const logger = pino({ level: "silent" });

    let sock;
    try {
      sock = makeWASocket({
        version,
        auth: {
          creds: state.creds,
          keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        logger,
        printQRInTerminal: false,
        browser: Browsers.ubuntu("Chrome"),
        syncFullHistory: false,
        markOnlineOnConnect: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: false,
        getMessage: async () => ({ conversation: "" }),
      });
    } catch (sockErr) {
      console.error(`[WhatsApp - ${userId}] makeWASocket error:`, sockErr.message);
      this.sessions.delete(key);
      await WhatsappSessionModel.updateStatus(userId, "DISCONNECTED", { sessionName });
      throw sockErr;
    }

    sessionState.sock = sock;
    sock.ev.on("creds.update", saveCreds);

    const targetPairPhone = cleanPairingPhone;

    if (!sock.authState.creds.registered && targetPairPhone) {
      sessionState.pairingPromise = (async () => {
        await new Promise((r) => setTimeout(r, 1500));
        if (sessionState.destroyed || !sessionState.sock) {
          throw new Error("Sesi WhatsApp dibatalkan");
        }
        if (sessionState.sock.authState.creds.registered) {
          return null;
        }

        try {
          const rawCode = await sessionState.sock.requestPairingCode(targetPairPhone);
          const formattedCode = rawCode?.match(/.{1,4}/g)?.join("-") || rawCode;
          sessionState.pairingCode = formattedCode;
          sessionState.status = "PAIRING_CODE";

          await WhatsappSessionModel.updateStatus(userId, "PAIRING_CODE", {
            phoneNumber: targetPairPhone,
            sessionName,
            sessionData: {
              pairingCode: formattedCode,
              pairingPhone: targetPairPhone,
            },
            qrCode: null,
          });

          console.log(`[WhatsApp - ${userId}] Pairing code generated: ${formattedCode} for +${targetPairPhone}`);
          return formattedCode;
        } catch (pairErr) {
          console.error(`[WhatsApp - ${userId}] requestPairingCode error:`, pairErr.message);
          throw pairErr;
        }
      })();
    }

    sock.ev.on("connection.update", async (update) => {
      if (sessionState.destroyed) return;

      const { connection, lastDisconnect, qr } = update;

      if (qr && !sessionState.pairingPhone) {
        sessionState.status = "SCAN_QR";
        sessionState.reconnectAttempts = 0;
        sessionState.qr = qr;

        try {
          const qrDataUrl = await QRCode.toDataURL(qr, {
            width: 300,
            margin: 2,
          });
          sessionState.qrImage = qrDataUrl;

          await WhatsappSessionModel.updateStatus(userId, "SCAN_QR", {
            qrCode: qrDataUrl,
            sessionName,
            sessionData: null,
          });
        } catch (err) {
          console.error("[WhatsApp] Gagal generate QR image:", err.message);
        }

        return;
      }

      if (connection === "open") {
        const userJid = sock.user?.id || "";
        const rawPhone = userJid.split(":")[0] || userJid.split("@")[0];

        sessionState.status = "CONNECTED";
        sessionState.qr = null;
        sessionState.qrImage = null;
        sessionState.pairingCode = null;
        sessionState.pairingPhone = null;
        sessionState.phoneNumber = rawPhone;
        sessionState.reconnectAttempts = 0;
        cachedWAVersion = null;

        try {
          await WhatsappSessionModel.updateStatus(userId, "CONNECTED", {
            phoneNumber: rawPhone,
            qrCode: null,
            sessionData: null,
            sessionName,
          });
        } catch (dbErr) {
          console.error("[WhatsApp] DB update CONNECTED error:", dbErr.message);
        }

        console.log(`[WhatsApp - ${userId}] ✅ Connected as: ${rawPhone}`);
        return;
      }

      if (connection === "close") {
        const statusCode = lastDisconnect?.error?.output?.statusCode;

        if (
          statusCode === DisconnectReason.loggedOut ||
          statusCode === DisconnectReason.forbidden
        ) {
          await this.disconnectSession(userId, sessionName);
          return;
        }

        if (statusCode === DisconnectReason.badSession) {
          sessionState.destroyed = true;
          this.sessions.delete(key);

          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
              fs.mkdirSync(sessionDir, { recursive: true });
            }
          } catch (e) {}

          try {
            await WhatsappSessionModel.updateStatus(userId, "DISCONNECTED", {
              qrCode: null,
              sessionData: null,
              sessionName,
            });
          } catch (e) {}

          setTimeout(() => {
            if (!this.sessions.has(key)) {
              this.initSession(userId, sessionName, false, sessionState.pairingPhone).catch((err) => {
                console.error(`[WhatsApp - ${userId}] Reinit failed:`, err.message);
              });
            }
          }, 3000);
          return;
        }

        if (
          statusCode === DisconnectReason.connectionClosed ||
          statusCode === DisconnectReason.connectionLost ||
          statusCode === DisconnectReason.timedOut ||
          statusCode === DisconnectReason.restartRequired ||
          statusCode === 515
        ) {
          const maxAttempts = 8;

          if (sessionState.reconnectAttempts >= maxAttempts) {
            sessionState.destroyed = true;
            sessionState.status = "DISCONNECTED";
            this.sessions.delete(key);

            try {
              await WhatsappSessionModel.updateStatus(userId, "DISCONNECTED", {
                qrCode: null,
                sessionData: null,
                sessionName,
              });
            } catch (e) {}
            return;
          }

          sessionState.reconnectAttempts++;
          sessionState.status = "RECONNECTING";
          sessionState.qr = null;
          sessionState.qrImage = null;
          sessionState.destroyed = true;

          try {
            await WhatsappSessionModel.updateStatus(userId, "RECONNECTING", {
              qrCode: null,
              sessionName,
            });
          } catch (e) {}

          const delay = (statusCode === DisconnectReason.restartRequired || statusCode === 515) ? 1000 : 3000;
          const attempt = sessionState.reconnectAttempts;

          this.sessions.delete(key);

          setTimeout(() => {
            if (!this.sessions.has(key)) {
              this.initSession(userId, sessionName, false, sessionState.pairingPhone).catch((err) => {
                console.error(`[WhatsApp - ${userId}] Reconnect attempt ${attempt} failed:`, err.message);
              });
            }
          }, delay);
          return;
        }

        if (statusCode === DisconnectReason.connectionReplaced) {
          await this.disconnectSession(userId, sessionName);
          return;
        }

        sessionState.destroyed = true;
        sessionState.status = "DISCONNECTED";
        this.sessions.delete(key);

        try {
          await WhatsappSessionModel.updateStatus(userId, "DISCONNECTED", {
            qrCode: null,
            sessionData: null,
            sessionName,
          });
        } catch (e) {}
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      if (type !== "notify") return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes("@g.us") || remoteJid.includes("status@broadcast")) continue;

        const rawPhone = remoteJid.split("@")[0];
        const validation = formatPhoneNumber(rawPhone);
        const senderPhone = validation.isValid ? validation.formattedPhone : rawPhone;
        const senderName = msg.pushName || senderPhone;
        const textContent =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          "";

        if (!textContent || textContent.trim() === "") continue;

        try {
          const contact = await ContactModel.findOrCreate(userId, {
            name: senderName,
            phone: senderPhone,
          });

          await MessageModel.create({
            userId,
            contactId: contact.id,
            phone: senderPhone,
            content: textContent,
            direction: "INCOMING",
            status: "DELIVERED",
            sentAt: new Date(Number(msg.messageTimestamp) * 1000),
          });

          const isAdmin = this._isAdminNumber(senderPhone);

          if (isAdmin) {
            const aiResult = await aiService.parseAndGenerate(textContent);

            if (aiResult.action === "SEND_DISPATCH" && aiResult.targetPhone && Array.isArray(aiResult.messages) && aiResult.messages.length > 0) {
              const ackMsg = aiResult.replyToAdmin || 
                `🚀 *Memulai Pengiriman Pesan*\n• Target: ${aiResult.targetPhone}\n• Jumlah: ${aiResult.messages.length} pesan\n• Jeda: ${aiResult.intervalSeconds || 5}s per pesan`;
              
              await this.sendDirectMessage(senderPhone, ackMsg, sessionName, userId);

              const createdJob = await SendingJobModel.create(userId, {
                phone: aiResult.targetPhone,
                message: aiResult.summary || (aiResult.messages[0] || 'AI Outbound Dispatch'),
                repeatCount: aiResult.messages.length,
                intervalSeconds: aiResult.intervalSeconds || 5
              });

              await enqueueDispatch({
                jobId: createdJob.id,
                userId,
                adminPhone: senderPhone,
                targetPhone: aiResult.targetPhone,
                messages: aiResult.messages,
                intervalSeconds: aiResult.intervalSeconds || 5,
                sessionName
              });
            } else {
              const replyText = aiResult.replyToAdmin || 
                `Halo Admin! Saya siap menerima perintah kirim pesan. Contoh:\n_"Kirim pesan maaf 5x ke 0819203344"_\nKetik *Bantuan* untuk info lainnya.`;
              await this.sendDirectMessage(senderPhone, replyText, sessionName, userId);
            }
          }
        } catch (inboundErr) {
          console.error("[WhatsApp Inbound Error]:", inboundErr.message);
        }
      }
    });

    return {
      status: sessionState.status,
      phoneNumber: sessionState.phoneNumber,
      qr: sessionState.qr,
      qrImage: sessionState.qrImage,
    };
  }

  async requestPairingCode(userId, rawPhone, sessionName = "default") {
    const validation = formatPhoneNumber(rawPhone);
    if (!validation.isValid) {
      const error = new Error(
        validation.error || "Format nomor WhatsApp tidak valid. Gunakan format 08xxx atau 628xxx.",
      );
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = validation.formattedPhone;
    const key = this.getSessionKey(userId, sessionName);
    const existing = this.sessions.get(key);

    if (existing && existing.status === "CONNECTED" && existing.sock) {
      return {
        status: "CONNECTED",
        phoneNumber: existing.phoneNumber,
        pairingPhone: null,
        pairingCode: null,
      };
    }

    await this.initSession(userId, sessionName, true, cleanPhone);
    const sessionState = this.sessions.get(key);

    if (sessionState && sessionState.pairingPromise) {
      try {
        const code = await sessionState.pairingPromise;
        return {
          status: "PAIRING_CODE",
          pairingCode: code,
          pairingPhone: cleanPhone,
        };
      } catch (err) {
        throw new Error(`Gagal meminta kode pairing dari WhatsApp: ${err.message}`);
      }
    }

    return {
      status: sessionState?.status || "CONNECTING",
      pairingCode: sessionState?.pairingCode || null,
      pairingPhone: cleanPhone,
    };
  }

  async getSessionStatus(userId, sessionName = "default") {
    const key = this.getSessionKey(userId, sessionName);
    const sessionState = this.sessions.get(key);

    const dbSession = await WhatsappSessionModel.getByUserId(
      userId,
      sessionName,
    );

    if (sessionState && !sessionState.destroyed) {
      return {
        status: sessionState.status,
        phoneNumber:
          sessionState.phoneNumber || dbSession?.phone_number || null,
        pairingPhone:
          sessionState.pairingPhone || dbSession?.session_data?.pairingPhone || null,
        pairingCode:
          sessionState.pairingCode || dbSession?.session_data?.pairingCode || null,
        qrCode: sessionState.qrImage || null,
        sessionName,
        updatedAt: dbSession?.updated_at || new Date(),
      };
    }

    const sessionDir = path.join(SESSIONS_BASE_DIR, `${userId}_${sessionName}`);
    const credPath = path.join(sessionDir, "creds.json");
    if (fs.existsSync(credPath)) {
      try {
        const credData = JSON.parse(fs.readFileSync(credPath, "utf8"));
        if (credData.registered) {
          const rawPhone = credData.me?.id
            ? credData.me.id.split(":")[0]
            : dbSession?.phone_number || null;

          this.initSession(userId, sessionName).catch((err) => {
            console.error(`[WhatsApp - ${userId}] Auto-init failed:`, err.message);
          });

          return {
            status: "CONNECTING",
            phoneNumber: rawPhone,
            pairingPhone: null,
            pairingCode: null,
            qrCode: null,
            sessionName,
            updatedAt: dbSession?.updated_at || new Date(),
          };
        }
      } catch (e) {}
    }

    if (dbSession) {
      if (dbSession.status === "CONNECTED" && dbSession.phone_number) {
        return {
          status: dbSession.status,
          phoneNumber: dbSession.phone_number,
          pairingPhone: null,
          pairingCode: null,
          qrCode: null,
          sessionName: dbSession.session_name,
          updatedAt: dbSession.updated_at,
        };
      }
      if (dbSession.status === "PAIRING_CODE" && dbSession.session_data?.pairingCode) {
        return {
          status: "PAIRING_CODE",
          phoneNumber: null,
          pairingPhone: dbSession.session_data?.pairingPhone || dbSession.phone_number || null,
          pairingCode: dbSession.session_data?.pairingCode || null,
          qrCode: null,
          sessionName: dbSession.session_name,
          updatedAt: dbSession.updated_at,
        };
      }
    }

    return {
      status: "DISCONNECTED",
      phoneNumber: null,
      pairingPhone: null,
      pairingCode: null,
      qrCode: null,
      sessionName,
      updatedAt: null,
    };
  }

  async disconnectSession(userId, sessionName = "default") {
    const key = this.getSessionKey(userId, sessionName);
    const sessionState = this.sessions.get(key);

    if (sessionState) {
      sessionState.destroyed = true;
      sessionState.status = "DISCONNECTED";
      sessionState.pairingCode = null;
      sessionState.pairingPhone = null;
      sessionState.qr = null;
      sessionState.qrImage = null;
      sessionState.phoneNumber = null;

      if (sessionState.sock) {
        try {
          sessionState.sock.ev.removeAllListeners();
          await sessionState.sock.logout().catch(() => {});
        } catch (err) {}
        try {
          sessionState.sock.end(new Error("Manual user disconnect"));
        } catch (e) {}
      }
      this.sessions.delete(key);
    }

    const sessionDir = path.join(SESSIONS_BASE_DIR, `${userId}_${sessionName}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (delErr) {
      console.error(`[WhatsApp - ${userId}] Error removing session dir:`, delErr.message);
    }

    try {
      await WhatsappSessionModel.updateStatus(userId, "DISCONNECTED", {
        phoneNumber: null,
        qrCode: null,
        sessionData: null,
        sessionName,
      });
    } catch (dbErr) {
      console.error(`[WhatsApp - ${userId}] Error updating session status to DISCONNECTED:`, dbErr.message);
    }

    return {
      status: "DISCONNECTED",
      message: "WhatsApp session disconnected and logged out.",
    };
  }

  async getGroups(userId, sessionName = "default") {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);

    if (!session || session.status !== "CONNECTED" || !session.sock) {
      throw new Error("WhatsApp Anda belum terhubung. Silakan hubungkan nomor WhatsApp Anda terlebih dahulu.");
    }

    try {
      const groupsMap = await session.sock.groupFetchAllParticipating();
      const groups = Object.values(groupsMap).map((g) => ({
        id: g.id,
        subject: g.subject || "Grup WhatsApp",
        participantsCount: g.participants ? g.participants.length : 0,
        creation: g.creation ? new Date(g.creation * 1000) : null,
        owner: g.owner || g.subjectOwner || null,
        desc: g.desc || "",
      }));

      groups.sort((a, b) => a.subject.localeCompare(b.subject));
      return groups;
    } catch (err) {
      throw new Error(`Gagal mengambil daftar grup WhatsApp: ${err.message}`);
    }
  }

  async sendTextMessage(
    userId,
    { toPhone, messageText, contactName = null, sessionName = "default" },
  ) {
    if (!toPhone || typeof toPhone !== "string" || toPhone.trim() === "") {
      const error = new Error("Recipient phone number or group ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!messageText || typeof messageText !== "string" || messageText.trim() === "") {
      const error = new Error("Message text cannot be empty");
      error.statusCode = 400;
      throw error;
    }

    const isGroup = toPhone.endsWith("@g.us");
    let cleanPhone = toPhone;
    let jid = toPhone;

    if (!isGroup) {
      const phoneCheck = formatPhoneNumber(toPhone);
      if (!phoneCheck.isValid) {
        const error = new Error(phoneCheck.error || "Invalid phone number format");
        error.statusCode = 400;
        throw error;
      }
      cleanPhone = phoneCheck.formattedPhone;
      jid = `${cleanPhone}@s.whatsapp.net`;
    }

    const key = this.getSessionKey(userId, sessionName);
    const sessionState = this.sessions.get(key);

    if (!sessionState || !sessionState.sock || sessionState.status !== "CONNECTED") {
      const error = new Error("WhatsApp Anda belum terhubung. Silakan hubungkan nomor WhatsApp Anda terlebih dahulu.");
      error.statusCode = 400;
      throw error;
    }

    const contact = await ContactModel.findOrCreate(userId, {
      name: contactName || (isGroup ? "WhatsApp Group" : cleanPhone),
      phone: cleanPhone,
    });

    const pendingRecord = await MessageModel.create({
      userId,
      contactId: contact.id,
      phone: cleanPhone,
      content: messageText.trim(),
      direction: "OUTGOING",
      status: "PENDING",
      sentAt: null,
    });

    try {
      const sent = await sessionState.sock.sendMessage(jid, {
        text: messageText.trim(),
      });
      const updatedRecord = await MessageModel.updateStatus(
        pendingRecord.id,
        "SENT",
        new Date(),
      );
      return {
        messageId: sent?.key?.id,
        record: updatedRecord,
        contact,
      };
    } catch (sendError) {
      await MessageModel.updateStatus(pendingRecord.id, "FAILED", null);
      const error = new Error(`Failed to send WhatsApp message: ${sendError.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  _isAdminNumber(phone) {
    const rawAdminEnv = process.env.ADMIN_PHONE_NUMBERS || "";
    const adminList = rawAdminEnv
      .split(",")
      .map((p) => p.trim().replace(/[^0-9]/g, ""))
      .filter(Boolean);

    if (adminList.length === 0) return true;

    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formatted = formatPhoneNumber(cleanPhone);
    const target = formatted.isValid ? formatted.formattedPhone : cleanPhone;

    return adminList.some((admin) => {
      const f = formatPhoneNumber(admin);
      const adminStandard = f.isValid ? f.formattedPhone : admin;
      return (
        target === adminStandard ||
        target.endsWith(admin) ||
        admin.endsWith(target)
      );
    });
  }

  async sendDirectMessage(
    toPhone,
    messageText,
    sessionName = "default",
    userId = null,
  ) {
    const isGroup = typeof toPhone === "string" && toPhone.endsWith("@g.us");
    let cleanPhone = toPhone;
    let jid = toPhone;

    if (!isGroup) {
      const phoneCheck = formatPhoneNumber(toPhone);
      if (!phoneCheck.isValid) {
        throw new Error(phoneCheck.error || "Format nomor telepon tidak valid");
      }
      cleanPhone = phoneCheck.formattedPhone;
      jid = `${cleanPhone}@s.whatsapp.net`;
    }

    let activeSock = null;
    let activeUserId = userId;

    if (userId) {
      const key = this.getSessionKey(userId, sessionName);
      const session = this.sessions.get(key);
      if (session && session.status === "CONNECTED" && session.sock) {
        activeSock = session.sock;
      }
    }

    if (!activeSock && !userId) {
      for (const [key, session] of this.sessions.entries()) {
        if (session.status === "CONNECTED" && session.sock) {
          activeSock = session.sock;
          activeUserId = key.split("_")[0];
          break;
        }
      }
    }

    if (!activeSock) {
      throw new Error("WhatsApp Bot untuk akun ini belum terhubung (CONNECTED).");
    }

    if (!activeUserId) {
      const firstUser = await UserModel.getFirstUser();
      if (firstUser) activeUserId = firstUser.id;
    }

    const sent = await activeSock.sendMessage(jid, {
      text: messageText.trim(),
    });

    if (activeUserId) {
      try {
        const contact = await ContactModel.findOrCreate(activeUserId, {
          name: cleanPhone,
          phone: cleanPhone,
        });

        await MessageModel.create({
          userId: activeUserId,
          contactId: contact.id,
          phone: cleanPhone,
          content: messageText.trim(),
          direction: "OUTGOING",
          status: "SENT",
          sentAt: new Date(),
        });
      } catch (dbErr) {
        console.error("[WhatsApp Direct Save Error]:", dbErr.message);
      }
    }

    return {
      messageId: sent?.key?.id,
      status: "SENT",
    };
  }

  async restoreAllSavedSessions() {
    try {
      const sessionMap = new Map();

      try {
        const dbSessions = await WhatsappSessionModel.getAllSessions();
        for (const s of dbSessions) {
          sessionMap.set(`${s.user_id}_${s.session_name}`, {
            userId: s.user_id,
            sessionName: s.session_name
          });
        }
      } catch (e) {}

      if (fs.existsSync(SESSIONS_BASE_DIR)) {
        const dirs = fs.readdirSync(SESSIONS_BASE_DIR, { withFileTypes: true });
        for (const dir of dirs) {
          if (dir.isDirectory()) {
            const lastUnderscore = dir.name.lastIndexOf("_");
            const userId = lastUnderscore !== -1 ? dir.name.substring(0, lastUnderscore) : dir.name;
            const sessionName = lastUnderscore !== -1 ? dir.name.substring(lastUnderscore + 1) : "default";
            const credPath = path.join(SESSIONS_BASE_DIR, dir.name, "creds.json");

            if (fs.existsSync(credPath)) {
              try {
                const credData = JSON.parse(fs.readFileSync(credPath, "utf8"));
                if (credData.registered) {
                  sessionMap.set(`${userId}_${sessionName}`, {
                    userId,
                    sessionName
                  });
                }
              } catch (e) {}
            }
          }
        }
      }

      const sessionsToRestore = Array.from(sessionMap.values());

      for (const session of sessionsToRestore) {
        const sessionDir = path.join(
          SESSIONS_BASE_DIR,
          `${session.userId}_${session.sessionName}`,
        );

        const hasCredFile = fs.existsSync(path.join(sessionDir, "creds.json"));

        if (hasCredFile) {
          this.initSession(session.userId, session.sessionName).catch((err) => {
            console.error(`[WhatsApp] Failed restoring session for user ${session.userId}:`, err.message);
          });
        }
      }
    } catch (err) {
      console.error("[WhatsApp] Error during restoreAllSavedSessions:", err.message);
    }
  }
}

const whatsappServiceInstance = new WhatsappService();
module.exports = whatsappServiceInstance;
