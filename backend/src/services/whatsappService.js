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
const ChatAiSettingModel = require("../models/chatAiSettingModel");
const CallLogModel = require("../models/callLogModel");
const aiService = require("./aiService");
const socketService = require("./socketService");
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
    this.processedMessageIds = new Map();
    this.autoReplyLock = new Set();
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

  resolveLidToPhone(userId, sessionName = "default", jid) {
    if (!jid) return { jid: "", phone: "" };
    if (!jid.endsWith("@lid")) {
      const isGroup = jid.endsWith("@g.us");
      const phone = isGroup ? jid : jid.replace(/[^0-9]/g, "");
      const cleanJid = isGroup ? jid : `${phone}@s.whatsapp.net`;
      return { jid: cleanJid, phone };
    }

    const lidNum = jid.split("@")[0];
    const sessionDir = this.getSessionDir(userId, sessionName);
    const revFile = path.join(sessionDir, `lid-mapping-${lidNum}_reverse.json`);

    if (fs.existsSync(revFile)) {
      try {
        const phoneRaw = JSON.parse(fs.readFileSync(revFile, "utf8"));
        if (phoneRaw) {
          const clean = String(phoneRaw).replace(/[^0-9]/g, "");
          if (clean) {
            return {
              jid: `${clean}@s.whatsapp.net`,
              phone: clean,
            };
          }
        }
      } catch (e) {}
    }

    return { jid, phone: lidNum };
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
        syncFullHistory: true,
        shouldSyncHistoryMessage: () => true,
        shouldIgnoreJid: () => false,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          if (key && key.id) {
            const msg = await MessageModel.getById(key.id, userId);
            if (msg && msg.content) {
              return { conversation: msg.content };
            }
          }
          return { conversation: "" };
        },
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

          socketService.emitToUser(userId, "wa_status", {
            status: "PAIRING_CODE",
            pairingCode: formattedCode,
            pairingPhone: targetPairPhone,
          });

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

          socketService.emitToUser(userId, "wa_status", {
            status: "SCAN_QR",
            qrCode: qrDataUrl,
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

        socketService.emitToUser(userId, "wa_status", {
          status: "CONNECTED",
          phoneNumber: rawPhone,
        });

        this.syncGroupsAndChats(userId, sessionName).catch((syncErr) => {
          console.warn(`[WhatsApp - ${userId}] Initial groups sync warning:`, syncErr.message);
        });

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

          socketService.emitToUser(userId, "wa_status", {
            status: "DISCONNECTED",
          });

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

            socketService.emitToUser(userId, "wa_status", {
              status: "DISCONNECTED",
            });
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

          socketService.emitToUser(userId, "wa_status", {
            status: "RECONNECTING",
          });

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

        socketService.emitToUser(userId, "wa_status", {
          status: "DISCONNECTED",
        });
      }
    });

    sock.ev.on("messaging-history.set", async ({ chats, contacts, messages, isLatest, syncType }) => {
      try {
        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            await this._processContactObject(userId, sessionName, c);
          }
        }

        if (Array.isArray(chats)) {
          for (const c of chats) {
            await this._processChatObject(userId, sessionName, c);
          }
        }

        if (Array.isArray(messages)) {
          for (const m of messages) {
            await this._processMessageObject(userId, sessionName, m);
          }
        }

        await this.syncGroupsAndChats(userId, sessionName).catch(() => {});
        await ContactModel.syncLastMessagesFromHistory(userId);

        socketService.emitToUser(userId, "chat_sync_complete", { count: (chats?.length || 0) + (contacts?.length || 0) });
        socketService.emitToUser(userId, "chats_updated", {});
      } catch (histErr) {
        console.error(`[WhatsApp - ${userId}] History sync error:`, histErr.message);
      }
    });

    sock.ev.on("chats.upsert", async (chats) => {
      for (const c of chats) {
        await this._processChatObject(userId, sessionName, c);
      }
      await ContactModel.syncLastMessagesFromHistory(userId);
      socketService.emitToUser(userId, "chats_updated", {});
    });

    sock.ev.on("chats.update", async (chatUpdates) => {
      for (const c of chatUpdates) {
        await this._processChatObject(userId, sessionName, c);
      }
      await ContactModel.syncLastMessagesFromHistory(userId);
      socketService.emitToUser(userId, "chats_updated", {});
    });

    sock.ev.on("contacts.upsert", async (contacts) => {
      for (const c of contacts) {
        await this._processContactObject(userId, sessionName, c);
      }
    });

    sock.ev.on("contacts.update", async (contactUpdates) => {
      for (const c of contactUpdates) {
        await this._processContactObject(userId, sessionName, c);
      }
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      for (const msg of messages) {
        await this._processMessageObject(userId, sessionName, msg);
      }
    });

    sock.ev.on("messages.update", async (updates) => {
      for (const update of updates) {
        const messageId = update.key?.id;
        const statusMap = {
          1: "PENDING",
          2: "SENT",
          3: "DELIVERED",
          4: "READ",
          5: "PLAYED",
        };
        const status = statusMap[update.update?.status];
        if (messageId && status) {
          await MessageModel.updateStatusByMessageId(userId, messageId, status);
          socketService.emitToUser(userId, "message_status_update", {
            messageId,
            status,
            remoteJid: update.key?.remoteJid,
          });
        }
      }
    });

    sock.ev.on("presence.update", ({ id, presences }) => {
      let cleanJid = id;
      if (id && id.endsWith("@lid")) {
        const resolved = this.resolveLidToPhone(userId, sessionName, id);
        if (resolved?.jid) cleanJid = resolved.jid;
      }
      socketService.emitToUser(userId, "presence_update", {
        jid: cleanJid,
        presences,
      });
    });

    sock.ev.on("call", async (calls) => {
      for (const call of calls) {
        if (call.status === "offer") {
          const callerJid = call.from;
          const callerPhone = callerJid.replace(/[^0-9]/g, "");

          socketService.emitToUser(userId, "incoming_call", {
            callId: call.id,
            callerJid,
            callerPhone,
            isVideo: call.isVideo,
            timestamp: new Date(),
          });

          await CallLogModel.create({
            userId,
            callerJid,
            callerPhone,
            callType: call.isVideo ? "video" : "audio",
            status: "MISSED",
          });
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

  async syncGroupsAndChats(userId, sessionName = "default") {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);
    if (!session || !session.sock || session.status !== "CONNECTED") {
      return { success: false, message: "WhatsApp belum terhubung" };
    }

    try {
      const groupsMap = await session.sock.groupFetchAllParticipating();
      const groupList = Object.values(groupsMap);

      for (const g of groupList) {
        let avatarUrl = null;
        try {
          avatarUrl = await session.sock.profilePictureUrl(g.id, 'image').catch(() => null);
        } catch (e) {}

        await ContactModel.upsertGroup(userId, {
          jid: g.id,
          name: g.subject || "Grup WhatsApp",
          avatarUrl,
          desc: g.desc || "",
        });
      }

      await ContactModel.syncLastMessagesFromHistory(userId);
      socketService.emitToUser(userId, "chat_sync_complete", { count: groupList.length });
      socketService.emitToUser(userId, "chats_updated", {});
      return { success: true, count: groupList.length };
    } catch (err) {
      console.error(`[WhatsApp - ${userId}] Error syncing groups:`, err.message);
      return { success: false, error: err.message };
    }
  }

  _unwrapWAMessage(raw) {
    if (!raw) return null;
    const msg = raw.message?.message ? raw.message : (raw.message ? raw : null);
    if (!msg) return null;

    const key = msg.key || raw.key;
    if (!key || !key.remoteJid) return null;

    let m = msg.message;
    while (m && (m.ephemeralMessage || m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension || m.documentWithCaptionMessage || m.deviceSentMessage || m.botInvokeMessage)) {
      if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
      else if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
      else if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
      else if (m.viewOnceMessageV2Extension?.message) m = m.viewOnceMessageV2Extension.message;
      else if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
      else if (m.deviceSentMessage?.message) m = m.deviceSentMessage.message;
      else if (m.botInvokeMessage?.message) m = m.botInvokeMessage.message;
    }

    if (m?.editedMessage?.message?.protocolMessage?.editedMessage) {
      m = m.editedMessage.message.protocolMessage.editedMessage;
    }

    return {
      key,
      remoteJid: key.remoteJid,
      fromMe: !!key.fromMe,
      messageId: key.id,
      participant: key.participant,
      pushName: msg.pushName || raw.pushName || null,
      timestamp: msg.messageTimestamp || raw.messageTimestamp || null,
      proto: m
    };
  }

  async _processContactObject(userId, sessionName, c) {
    if (!c || (!c.id && !c.phone)) return;
    let rawId = c.id || c.phone || "";
    if (rawId.includes("status@broadcast") || rawId.includes("@newsletter") || rawId === "0@s.whatsapp.net") {
      return;
    }

    let isGroup = rawId.endsWith("@g.us");
    let cleanPhone = isGroup ? rawId : rawId.replace(/[^0-9]/g, "");
    let cleanJid = isGroup ? rawId : `${cleanPhone}@s.whatsapp.net`;

    if (rawId.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, rawId);
      if (resolved.jid.endsWith("@s.whatsapp.net")) {
        cleanJid = resolved.jid;
        cleanPhone = resolved.phone;
      } else {
        return;
      }
    }

    const name = c.notify || c.verifiedName || c.name || (isGroup ? "Grup WhatsApp" : `+${cleanPhone}`);

    await ContactModel.upsertChat(userId, {
      jid: cleanJid,
      name,
      phone: cleanPhone,
      isGroup,
    });
  }

  async _processChatObject(userId, sessionName, c) {
    if (!c || !c.id) return;
    let rawId = c.id;
    if (rawId.includes("status@broadcast") || rawId.includes("@newsletter") || rawId === "0@s.whatsapp.net") {
      return;
    }

    let isGroup = rawId.endsWith("@g.us");
    let cleanPhone = isGroup ? rawId : rawId.replace(/[^0-9]/g, "");
    let cleanJid = isGroup ? rawId : `${cleanPhone}@s.whatsapp.net`;

    if (rawId.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, rawId);
      if (resolved.jid.endsWith("@s.whatsapp.net")) {
        cleanJid = resolved.jid;
        cleanPhone = resolved.phone;
      } else {
        return;
      }
    }

    const name = c.name || (isGroup ? "Grup WhatsApp" : `+${cleanPhone}`);
    const unreadCount = typeof c.unreadCount === "number" ? c.unreadCount : 0;
    const lastMessageTime = c.conversationTimestamp 
      ? new Date(Number(c.conversationTimestamp) * 1000) 
      : (c.lastMessageRecvTimestamp ? new Date(Number(c.lastMessageRecvTimestamp) * 1000) : null);

    let lastMessageText = null;

    if (Array.isArray(c.messages) && c.messages.length > 0) {
      const latestMsg = c.messages[c.messages.length - 1];
      const parsed = this._unwrapWAMessage(latestMsg);
      if (parsed && parsed.proto) {
        const text = parsed.proto.conversation || parsed.proto.extendedTextMessage?.text || (parsed.proto.imageMessage ? "📷 Foto" : (parsed.proto.videoMessage ? "🎥 Video" : null));
        if (text) {
          if (parsed.fromMe) {
            lastMessageText = `✓ ${text}`;
          } else if (isGroup && parsed.pushName && parsed.pushName !== "Kontak") {
            lastMessageText = `~ ${parsed.pushName}: ${text}`;
          } else {
            lastMessageText = text;
          }
        }
      }
    }

    await ContactModel.upsertChat(userId, {
      jid: cleanJid,
      name,
      phone: cleanPhone,
      isGroup,
      unreadCount,
      lastMessageText,
      lastMessageTime,
    });
  }

  async _processMessageObject(userId, sessionName, raw) {
    const parsed = this._unwrapWAMessage(raw);
    if (!parsed || !parsed.remoteJid) return;

    let { remoteJid, fromMe, messageId, pushName, timestamp, proto, participant } = parsed;

    if (remoteJid.includes("@newsletter") || remoteJid === "0@s.whatsapp.net") {
      return;
    }

    if (messageId) {
      const cacheKey = `${userId}_${messageId}`;
      if (this.processedMessageIds.has(cacheKey)) {
        return;
      }
      this.processedMessageIds.set(cacheKey, Date.now());
      if (this.processedMessageIds.size > 2000) {
        const now = Date.now();
        for (const [k, v] of this.processedMessageIds.entries()) {
          if (now - v > 300000) this.processedMessageIds.delete(k);
        }
      }
    }

    if (remoteJid.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, remoteJid);
      remoteJid = resolved.jid;
    }

    if (remoteJid.includes("status@broadcast")) {
      return;
    }

    const isGroup = remoteJid.endsWith("@g.us");
    const rawPhone = isGroup ? remoteJid : remoteJid.replace(/[^0-9]/g, "");
    const senderName = pushName || (fromMe ? "Saya" : (isGroup ? "Anggota Grup" : `+${rawPhone}`));

    let textContent = "";
    let mediaType = "text";
    let mediaUrl = null;
    let mediaCaption = null;

    if (!proto) return;

    if (proto.conversation) {
      textContent = proto.conversation;
    } else if (proto.extendedTextMessage) {
      textContent = proto.extendedTextMessage.text || "";
    } else if (proto.imageMessage) {
      textContent = proto.imageMessage.caption || "📷 Foto";
      mediaType = "image";
      mediaCaption = proto.imageMessage.caption;
    } else if (proto.videoMessage) {
      textContent = proto.videoMessage.caption || "🎥 Video";
      mediaType = "video";
      mediaCaption = proto.videoMessage.caption;
    } else if (proto.audioMessage) {
      textContent = proto.audioMessage.ptt ? "🎤 Pesan Suara" : "🎵 Audio";
      mediaType = proto.audioMessage.ptt ? "voice" : "audio";
    } else if (proto.documentMessage) {
      textContent = `📄 ${proto.documentMessage.fileName || proto.documentMessage.caption || "Dokumen"}`;
      mediaType = "document";
      mediaCaption = proto.documentMessage.fileName || proto.documentMessage.caption;
    } else if (proto.stickerMessage) {
      textContent = "🎨 Stiker";
      mediaType = "sticker";
    } else if (proto.contactMessage) {
      textContent = `👤 ${proto.contactMessage.displayName || "Kontak"}`;
      mediaType = "contact";
    } else if (proto.contactsArrayMessage) {
      textContent = "👥 Kontak";
      mediaType = "contact";
    } else if (proto.locationMessage) {
      textContent = `📍 ${proto.locationMessage.name || "Lokasi"}`;
      mediaType = "location";
    } else if (proto.liveLocationMessage) {
      textContent = "📍 Lokasi Terkini";
      mediaType = "location";
    } else if (proto.pollCreationMessage || proto.pollCreationMessageV3) {
      textContent = `📊 Polling: ${proto.pollCreationMessage?.name || proto.pollCreationMessageV3?.name || "Polling"}`;
      mediaType = "poll";
    } else if (proto.groupInviteMessage) {
      textContent = `✉️ Undangan Grup: ${proto.groupInviteMessage.groupName || "Grup"}`;
      mediaType = "invite";
    }

    if (!textContent && mediaType === "text") return;

    try {
      const contact = await ContactModel.findOrCreate(userId, {
        name: isGroup ? "Grup WhatsApp" : (senderName || `+${rawPhone}`),
        phone: rawPhone,
        jid: remoteJid,
        isGroup,
      });

      if (!contact) return;

      const savedMessage = await MessageModel.create({
        userId,
        contactId: contact.id,
        phone: rawPhone,
        remoteJid,
        messageId,
        senderName,
        content: textContent,
        mediaType,
        mediaUrl,
        mediaCaption,
        direction: fromMe ? "OUTGOING" : "INCOMING",
        status: fromMe ? "SENT" : "DELIVERED",
        fromMe,
        sentAt: new Date(Number(timestamp || Date.now() / 1000) * 1000),
      });

      let displaySnippet = textContent;
      if (fromMe) {
        displaySnippet = `✓ ${textContent}`;
      } else if (isGroup && senderName && senderName !== "Kontak" && senderName !== "Anggota Grup") {
        displaySnippet = `~ ${senderName}: ${textContent}`;
      }

      await ContactModel.updateLastMessage(userId, remoteJid, {
        text: displaySnippet,
        timestamp: savedMessage.sent_at,
        incrementUnread: !fromMe,
      });

      socketService.emitToUser(userId, "message_new", {
        message: savedMessage,
        contact,
        remoteJid,
      });

      socketService.emitToUser(userId, "chat_update", {
        jid: remoteJid,
        lastMessage: displaySnippet,
        lastMessageTime: savedMessage.sent_at,
        unreadIncrement: !fromMe,
      });

      if (!fromMe && !isGroup) {
        await this._handleAutoReplyLogic(userId, sessionName, remoteJid, rawPhone, senderName, textContent);
      }
    } catch (err) {
      console.error(`[WhatsApp - ${userId}] Error processing message:`, err.message);
    }
  }

  async _handleAutoReplyLogic(userId, sessionName, remoteJid, senderPhone, senderName, incomingText) {
    try {
      const replyLockKey = `${userId}_${remoteJid}`;
      if (this.autoReplyLock.has(replyLockKey)) {
        return;
      }
      this.autoReplyLock.add(replyLockKey);

      try {
        const hasAdminEnv = (process.env.ADMIN_PHONE_NUMBERS || "").trim().length > 0;
        if (hasAdminEnv && this._isAdminNumber(senderPhone)) {
          if (incomingText.toLowerCase().includes("kirim") || incomingText.toLowerCase().includes("bantuan") || incomingText.toLowerCase().includes("status")) {
            const aiResult = await aiService.parseAndGenerate(incomingText);

            if (aiResult.action === "SEND_DISPATCH" && aiResult.targetPhone && Array.isArray(aiResult.messages) && aiResult.messages.length > 0) {
              const ackMsg = aiResult.replyToAdmin ||
                `🚀 *Memulai Pengiriman Pesan*\n• Target: ${aiResult.targetPhone}\n• Jumlah: ${aiResult.messages.length} pesan\n• Jeda: ${aiResult.intervalSeconds || 5}s per pesan`;

              await this.sendDirectMessage(senderPhone, ackMsg, sessionName, userId);

              const dispatchJobId = 'job_' + Date.now();

              await enqueueDispatch({
                jobId: dispatchJobId,
                userId,
                adminPhone: senderPhone,
                targetPhone: aiResult.targetPhone,
                messages: aiResult.messages,
                intervalSeconds: aiResult.intervalSeconds || 5,
                sessionName,
              });
              return;
            }
          }
        }

        const aiSetting = await ChatAiSettingModel.getByJid(userId, remoteJid);
        if (aiSetting && aiSetting.auto_reply_enabled) {
          let replyText = null;

          if (aiSetting.reply_mode === 'static' && aiSetting.static_reply_text && aiSetting.static_reply_text.trim()) {
            replyText = aiSetting.static_reply_text.trim();
          } else {
            const chatContext = await MessageModel.getRecentChatContext(userId, remoteJid, 8);
            replyText = await aiService.generateAutoReply(
              aiSetting.custom_prompt,
              chatContext,
              incomingText,
              senderName || senderPhone
            );
          }

          if (replyText) {
            await new Promise((r) => setTimeout(r, 1200));
            await this.sendChatMessage(userId, {
              jid: remoteJid,
              text: replyText,
              sessionName,
            });
          }
        }
      } finally {
        setTimeout(() => {
          this.autoReplyLock.delete(replyLockKey);
        }, 4000);
      }
    } catch (aiErr) {
      console.error(`[WhatsApp - ${userId}] Auto-reply error:`, aiErr.message);
    }
  }

  async sendChatMessage(userId, { jid, text, sessionName = "default" }) {
    if (!jid || !text || text.trim() === "") {
      throw new Error("JID dan teks pesan diperlukan");
    }

    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);

    if (!session || session.status !== "CONNECTED" || !session.sock) {
      throw new Error("WhatsApp Anda belum terhubung. Silakan hubungkan WhatsApp terlebih dahulu.");
    }

    const isGroup = jid.endsWith("@g.us");
    let cleanJid = jid;
    let cleanPhone = isGroup ? jid : jid.replace(/[^0-9]/g, "");

    if (jid.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, jid);
      cleanJid = resolved.jid;
      cleanPhone = resolved.phone;
    } else if (!isGroup && !jid.includes("@")) {
      cleanJid = `${cleanPhone}@s.whatsapp.net`;
    }

    const contact = await ContactModel.findOrCreate(userId, {
      name: isGroup ? "Grup WhatsApp" : `+${cleanPhone}`,
      phone: cleanPhone,
      jid: cleanJid,
      isGroup,
    });

    const sent = await session.sock.sendMessage(cleanJid, {
      text: text.trim(),
    });

    const savedMessage = await MessageModel.create({
      userId,
      contactId: contact?.id || null,
      phone: cleanPhone,
      remoteJid: cleanJid,
      messageId: sent?.key?.id,
      senderName: "Saya",
      content: text.trim(),
      direction: "OUTGOING",
      status: "SENT",
      fromMe: true,
      sentAt: new Date(),
    });

    await ContactModel.updateLastMessage(userId, cleanJid, {
      text: text.trim(),
      timestamp: new Date(),
      incrementUnread: false,
    });

    socketService.emitToUser(userId, "message_new", {
      message: savedMessage,
      contact,
      remoteJid: cleanJid,
    });

    return savedMessage;
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

    // 1. Clear in-memory caches for this user
    for (const cacheKey of this.processedMessageIds.keys()) {
      if (cacheKey.startsWith(`${userId}_`)) {
        this.processedMessageIds.delete(cacheKey);
      }
    }
    for (const lockKey of this.autoReplyLock.keys()) {
      if (lockKey.startsWith(`${userId}_`)) {
        this.autoReplyLock.delete(lockKey);
      }
    }

    // 2. Delete physical auth session files on disk
    const sessionDir = path.join(SESSIONS_BASE_DIR, `${userId}_${sessionName}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (delErr) {
      console.error(`[WhatsApp - ${userId}] Error removing session dir:`, delErr.message);
    }

    // 3. Reset WhatsApp session in database
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

    // 4. Wipe all synchronized chat & message data from database for complete privacy & reset
    try {
      await MessageModel.deleteAllByUser(userId);
      await ContactModel.deleteAllByUser(userId);
      await CallLogModel.deleteAllByUser(userId);
      await ChatAiSettingModel.deleteAllByUser(userId);
      console.log(`[WhatsApp - ${userId}] All user chats, contacts, messages, and call logs wiped on disconnect.`);
    } catch (wipeErr) {
      console.error(`[WhatsApp - ${userId}] Error wiping user chat data on disconnect:`, wipeErr.message);
    }

    // 5. Emit real-time reset events to frontend
    socketService.emitToUser(userId, "wa_status", {
      status: "DISCONNECTED",
      phoneNumber: null,
      pairingCode: null,
      qrCode: null,
    });
    socketService.emitToUser(userId, "chats_updated", { reset: true });
    socketService.emitToUser(userId, "chat_reset", {});

    return {
      status: "DISCONNECTED",
      message: "Koneksi WhatsApp diputus dan seluruh data chat, kontak & pesan telah di-reset bersih.",
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
    return this.sendChatMessage(userId, {
      jid: toPhone,
      text: messageText,
      sessionName,
    });
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

    const isGroup = typeof toPhone === "string" && toPhone.endsWith("@g.us");
    const cleanPhone = isGroup ? toPhone : toPhone.replace(/[^0-9]/g, "");
    const jid = isGroup ? toPhone : `${cleanPhone}@s.whatsapp.net`;

    const sent = await activeSock.sendMessage(jid, {
      text: messageText.trim(),
    });

    if (activeUserId) {
      try {
        const contact = await ContactModel.findOrCreate(activeUserId, {
          name: isGroup ? "Grup WhatsApp" : `+${cleanPhone}`,
          phone: cleanPhone,
          jid,
          isGroup,
        });

        await MessageModel.create({
          userId: activeUserId,
          contactId: contact?.id || null,
          phone: cleanPhone,
          remoteJid: jid,
          messageId: sent?.key?.id,
          senderName: "Saya",
          content: messageText.trim(),
          direction: "OUTGOING",
          status: "SENT",
          fromMe: true,
          sentAt: new Date(),
        });

        await ContactModel.updateLastMessage(activeUserId, jid, {
          text: messageText.trim(),
          timestamp: new Date(),
          incrementUnread: false,
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
            sessionName: s.session_name,
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
                    sessionName,
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
