const {
  default: makeWASocket,
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  fetchLatestBaileysVersion,
  Browsers,
  downloadContentFromMessage,
  extractMessageContent,
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
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const { enqueueDispatch } = require("../jobs/messageQueue");
const { formatPhoneNumber } = require("../utils/phoneValidator");

if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

const SESSIONS_BASE_DIR = path.join(__dirname, "../../sessions");
const UPLOADS_DIR = path.join(__dirname, "../../uploads");

if (!fs.existsSync(SESSIONS_BASE_DIR)) {
  fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
}

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
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

function convertToOpusOgg(inputBuffer) {
  return new Promise((resolve) => {
    const tempIn = path.join(UPLOADS_DIR, `temp_in_${Date.now()}_${Math.random().toString(36).slice(2)}.tmp`);
    const tempOut = path.join(UPLOADS_DIR, `temp_out_${Date.now()}_${Math.random().toString(36).slice(2)}.ogg`);

    fs.writeFileSync(tempIn, inputBuffer);

    ffmpeg(tempIn)
      .noVideo()
      .audioCodec("libopus")
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate("16k")
      .outputOptions([
        "-application voip",
        "-frame_duration 20",
        "-vbr on"
      ])
      .toFormat("ogg")
      .save(tempOut)
      .on("end", () => {
        try {
          const oggBuffer = fs.readFileSync(tempOut);
          try { fs.unlinkSync(tempIn); } catch (e) {}
          try { fs.unlinkSync(tempOut); } catch (e) {}
          resolve(oggBuffer);
        } catch (readErr) {
          try { fs.unlinkSync(tempIn); } catch (e) {}
          try { fs.unlinkSync(tempOut); } catch (e) {}
          resolve(inputBuffer);
        }
      })
      .on("error", () => {
        try { fs.unlinkSync(tempIn); } catch (e) {}
        try { fs.unlinkSync(tempOut); } catch (e) {}
        resolve(inputBuffer);
      });
  });
}

class WhatsappService {
  constructor() {
    this.sessions = new Map();
    this.processedMessageIds = new Map();
    this.autoReplyLock = new Set();
    this.startUploadsCleanupJob();
  }

  startUploadsCleanupJob() {
    const cleanupOldFiles = () => {
      try {
        if (!fs.existsSync(UPLOADS_DIR)) return;
        const now = Date.now();
        const maxAgeMs = 4 * 60 * 60 * 1000;
        const files = fs.readdirSync(UPLOADS_DIR);
        for (const file of files) {
          if (file === '.gitkeep') continue;
          const filePath = path.join(UPLOADS_DIR, file);
          try {
            const stats = fs.statSync(filePath);
            if (now - stats.mtimeMs > maxAgeMs) {
              fs.unlinkSync(filePath);
            }
          } catch (e) {}
        }
      } catch (e) {
        console.warn('[Uploads Cleanup Warning]:', e.message);
      }
    };

    cleanupOldFiles();
    setInterval(cleanupOldFiles, 30 * 60 * 1000);
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
        syncFullHistory: false,
        shouldSyncHistoryMessage: (historyMsg) => {
          const oneWeekAgoSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
          const msgTimestamp = Number(historyMsg?.messageTimestamp || 0);
          return !msgTimestamp || msgTimestamp >= oneWeekAgoSec;
        },
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
        const oneWeekAgoSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);

        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            await this._processContactObject(userId, sessionName, c);
          }
        }

        if (Array.isArray(chats)) {
          for (const c of chats) {
            const convTime = c.conversationTimestamp ? Number(c.conversationTimestamp) : 0;
            const recvTime = c.lastMessageRecvTimestamp ? Number(c.lastMessageRecvTimestamp) : 0;
            const unread = Number(c.unreadCount || 0);
            const isPinned = c.pinned !== undefined && c.pinned !== null && c.pinned !== 0 && c.pinned !== false;
            const isArchived = !!(c.archive || c.archived);
            if (convTime >= oneWeekAgoSec || recvTime >= oneWeekAgoSec || unread > 0 || isPinned || isArchived) {
              await this._processChatObject(userId, sessionName, c);
            }
          }
        }

        if (Array.isArray(messages)) {
          for (const m of messages) {
            const parsed = this._unwrapWAMessage(m);
            const msgTs = parsed?.timestamp ? Number(parsed.timestamp) : 0;
            if (!msgTs || msgTs >= oneWeekAgoSec) {
              await this._processMessageObject(userId, sessionName, m);
            }
          }
        }

        await this.syncGroupsAndChats(userId, sessionName).catch(() => {});
        await this.syncAvatars(userId, sessionName).catch(() => {});
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
      socketService.emitToUser(userId, "chats_updated", {});
    });

    sock.ev.on("contacts.update", async (contactUpdates) => {
      for (const c of contactUpdates) {
        await this._processContactObject(userId, sessionName, c);
      }
      socketService.emitToUser(userId, "chats_updated", {});
    });

    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      for (const msg of messages) {
        await this._processMessageObject(userId, sessionName, msg);
      }
    });

    sock.ev.on("messages.update", async (updates) => {
      for (const update of updates) {
        const messageId = update.key?.id;
        if (!messageId) continue;

        const isRevoked = update.update?.messageStubType === 1 || update.update?.messageStubType === 2 || (update.update?.message === null && update.update?.key);
        if (isRevoked) {
          await MessageModel.markAsRevoked(userId, messageId);
          socketService.emitToUser(userId, "message_revoked", {
            messageId,
            remoteJid: update.key?.remoteJid,
          });
          continue;
        }

        const editProto = update.update?.message?.protocolMessage?.editedMessage || update.update?.message?.editedMessage;
        if (editProto) {
          const unwrapped = this._unwrapWAMessage(editProto);
          const editedText = unwrapped.proto?.conversation || unwrapped.proto?.extendedTextMessage?.text || "";
          if (editedText) {
            const updated = await MessageModel.updateContent(userId, messageId, editedText);
            socketService.emitToUser(userId, "message_edited", {
              messageId,
              newContent: editedText,
              remoteJid: update.key?.remoteJid,
              rawData: updated?.raw_data || { isEdited: true },
            });
            continue;
          }
        }

        const statusMap = {
          1: "PENDING",
          2: "SENT",
          3: "DELIVERED",
          4: "READ",
          5: "PLAYED",
        };
        const status = statusMap[update.update?.status];
        if (status) {
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

  async downloadAndSaveMedia(messageContent, mediaType, messageId) {
    try {
      if (!messageContent || !messageId) return null;
      const type = mediaType === "voice" ? "audio" : mediaType;
      const stream = await downloadContentFromMessage(messageContent, type);
      let buffer = Buffer.from([]);
      for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
      }
      if (!buffer || buffer.length === 0) return null;

      const ext = mediaType === "voice" || mediaType === "audio" ? "ogg" : (mediaType === "image" ? "jpg" : (mediaType === "video" ? "mp4" : "bin"));
      const filename = `media_${messageId}.${ext}`;
      const filePath = path.join(UPLOADS_DIR, filename);
      fs.writeFileSync(filePath, buffer);
      return `/uploads/${filename}`;
    } catch (err) {
      console.warn("[WhatsApp Media Download Warning]:", err.message);
      return null;
    }
  }

  async fetchProfilePicture(userId, sessionName = "default", jid) {
    if (!jid || jid.includes("@newsletter") || jid.includes("status@broadcast") || jid === "0@s.whatsapp.net") {
      return null;
    }
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);
    if (!session || !session.sock || session.status !== "CONNECTED") {
      return null;
    }

    try {
      let url = await session.sock.profilePictureUrl(jid, 'image').catch(() => null);
      if (!url) {
        url = await session.sock.profilePictureUrl(jid, 'preview').catch(() => null);
      }
      if (url) {
        await ContactModel.updateAvatar(userId, jid, url);
        socketService.emitToUser(userId, "chat_avatar_update", { jid, avatarUrl: url });
        return url;
      }
      return null;
    } catch (e) {
      return null;
    }
  }

  async syncAvatars(userId, sessionName = "default") {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);
    if (!session || !session.sock || session.status !== "CONNECTED") {
      return;
    }

    try {
      const contactsToFetch = await ContactModel.getContactsWithoutAvatar(userId, 50);
      if (!contactsToFetch || contactsToFetch.length === 0) return;

      for (let i = 0; i < contactsToFetch.length; i += 4) {
        const batch = contactsToFetch.slice(i, i + 4);
        await Promise.all(
          batch.map(async (c) => {
            const targetJid = c.jid || (c.is_group ? c.phone : `${c.phone}@s.whatsapp.net`);
            if (targetJid) {
              await this.fetchProfilePicture(userId, sessionName, targetJid).catch(() => {});
            }
          })
        );
        if (i + 4 < contactsToFetch.length) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      }
      socketService.emitToUser(userId, "chats_updated", {});
    } catch (err) {
      console.error(`[WhatsApp - ${userId}] Error syncing avatars:`, err.message);
    }
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
          if (!avatarUrl) {
            avatarUrl = await session.sock.profilePictureUrl(g.id, 'preview').catch(() => null);
          }
        } catch (e) {}

        await ContactModel.upsertGroup(userId, {
          jid: g.id,
          name: g.subject || "Grup WhatsApp",
          avatarUrl,
          desc: g.desc || "",
        });
      }

      await this.syncAvatars(userId, sessionName).catch(() => {});
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
    const key = raw.key || msg?.key;
    if (!key || !key.remoteJid) return null;

    let isViewOnce = !!(key.isViewOnce || raw.isViewOnce || raw.key?.isViewOnce);
    const rawStr = JSON.stringify(raw.message || {});
    if (
      rawStr.includes('"viewOnceMessage"') ||
      rawStr.includes('"viewOnceMessageV2"') ||
      rawStr.includes('"viewOnceMessageV2Extension"') ||
      rawStr.includes('"viewOnce":true') ||
      rawStr.includes('"isViewOnce":true')
    ) {
      isViewOnce = true;
    }

    let m = extractMessageContent(raw.message) || raw.message;
    for (let i = 0; i < 6; i++) {
      if (!m) break;
      if (m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension) {
        isViewOnce = true;
      }
      if (m.ephemeralMessage?.message) m = m.ephemeralMessage.message;
      else if (m.viewOnceMessage?.message) m = m.viewOnceMessage.message;
      else if (m.viewOnceMessageV2?.message) m = m.viewOnceMessageV2.message;
      else if (m.viewOnceMessageV2Extension?.message) m = m.viewOnceMessageV2Extension.message;
      else if (m.documentWithCaptionMessage?.message) m = m.documentWithCaptionMessage.message;
      else if (m.deviceSentMessage?.message) m = m.deviceSentMessage.message;
      else if (m.botInvokeMessage?.message) m = m.botInvokeMessage.message;
      else break;

      const extracted = extractMessageContent(m);
      if (extracted) m = extracted;
    }

    if (m?.editedMessage?.message?.protocolMessage?.editedMessage) {
      m = m.editedMessage.message.protocolMessage.editedMessage;
    }

    if (m?.imageMessage?.viewOnce || m?.videoMessage?.viewOnce || m?.audioMessage?.viewOnce) {
      isViewOnce = true;
    }

    return {
      key,
      remoteJid: key.remoteJid,
      fromMe: !!key.fromMe,
      messageId: key.id,
      participant: key.participant,
      pushName: msg?.pushName || raw.pushName || null,
      timestamp: msg?.messageTimestamp || raw.messageTimestamp || null,
      proto: m,
      isViewOnce,
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

    const candidateName = c.name || c.notify || c.verifiedName || null;
    const name = candidateName && candidateName.trim() ? candidateName.trim() : (isGroup ? "Grup WhatsApp" : `+${cleanPhone}`);
    const avatarUrl = c.imgUrl || null;

    await ContactModel.upsertChat(userId, {
      jid: cleanJid,
      name,
      phone: cleanPhone,
      avatarUrl,
      isGroup,
    });
  }

  async _processChatObject(userId, sessionName, c) {
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

    let isPinned = undefined;
    let pinnedAt = undefined;
    if (c.pinned !== undefined) {
      if (c.pinned === null || c.pinned === 0 || c.pinned === false) {
        isPinned = false;
        pinnedAt = null;
      } else {
        isPinned = true;
        pinnedAt = typeof c.pinned === "number" && c.pinned > 0
          ? (c.pinned > 10000000000 ? new Date(c.pinned) : new Date(c.pinned * 1000))
          : new Date();
      }
    }

    let isArchived = undefined;
    if (c.archived !== undefined) {
      isArchived = !!c.archived;
    } else if (c.archive !== undefined) {
      isArchived = !!c.archive;
    }

    await ContactModel.upsertChat(userId, {
      jid: cleanJid,
      name,
      phone: cleanPhone,
      isGroup,
      unreadCount,
      lastMessageText,
      lastMessageTime,
      isPinned,
      pinnedAt,
      isArchived,
    });
  }

  async _processMessageObject(userId, sessionName, raw) {
    const parsed = this._unwrapWAMessage(raw);
    if (!parsed || !parsed.remoteJid) return;

    let { remoteJid, fromMe, messageId, pushName, timestamp, proto, participant, isViewOnce } = parsed;

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

    const protocolMsg = raw.message?.protocolMessage || proto?.protocolMessage;
    if (protocolMsg) {
      if (protocolMsg.type === 0 && protocolMsg.key?.id) {
        const targetId = protocolMsg.key.id;
        await MessageModel.markAsRevoked(userId, targetId);
        socketService.emitToUser(userId, "message_revoked", {
          messageId: targetId,
          remoteJid: protocolMsg.key.remoteJid || remoteJid,
        });
        return;
      }
      if (protocolMsg.type === 14 && protocolMsg.key?.id) {
        const targetId = protocolMsg.key.id;
        const editedProto = protocolMsg.editedMessage;
        let editedText = "";
        if (editedProto) {
          const unwrapped = this._unwrapWAMessage(editedProto);
          editedText = unwrapped.proto?.conversation || unwrapped.proto?.extendedTextMessage?.text || "";
        }
        if (editedText) {
          const updated = await MessageModel.updateContent(userId, targetId, editedText);
          socketService.emitToUser(userId, "message_edited", {
            messageId: targetId,
            newContent: editedText,
            remoteJid: protocolMsg.key.remoteJid || remoteJid,
            rawData: updated?.raw_data || { isEdited: true },
          });
        }
        return;
      }
    }

    const msgTimeSec = Number(timestamp || Date.now() / 1000);
    const oneWeekAgoSec = Math.floor((Date.now() - 7 * 24 * 60 * 60 * 1000) / 1000);
    if (msgTimeSec < oneWeekAgoSec) {
      return;
    }

    const isGroup = remoteJid.endsWith("@g.us");
    const rawPhone = isGroup ? remoteJid : remoteJid.replace(/[^0-9]/g, "");
    const senderName = pushName || (fromMe ? "Saya" : (isGroup ? "Anggota Grup" : `+${rawPhone}`));

    let textContent = "";
    let mediaType = "text";
    let mediaUrl = null;
    let mediaCaption = null;

    if (!proto && raw.message) {
      proto = extractMessageContent(raw.message) || raw.message;
    }
    for (let i = 0; i < 4; i++) {
      if (!proto) break;
      if (proto.ephemeralMessage?.message) proto = proto.ephemeralMessage.message;
      else if (proto.viewOnceMessage?.message) proto = proto.viewOnceMessage.message;
      else if (proto.viewOnceMessageV2?.message) proto = proto.viewOnceMessageV2.message;
      else if (proto.viewOnceMessageV2Extension?.message) proto = proto.viewOnceMessageV2Extension.message;
      else if (proto.documentWithCaptionMessage?.message) proto = proto.documentWithCaptionMessage.message;
      else break;
      const ext = extractMessageContent(proto);
      if (ext) proto = ext;
    }

    if (proto) {
      if (proto.conversation) {
        textContent = proto.conversation;
      } else if (proto.extendedTextMessage) {
        textContent = proto.extendedTextMessage.text || "";
      } else if (proto.imageMessage) {
        const isVo = !!isViewOnce;
        textContent = proto.imageMessage.caption || (isVo ? "👁️ Foto (Sekali Lihat)" : "📷 Foto");
        mediaType = "image";
        mediaCaption = proto.imageMessage.caption || (isVo ? "👁️ Foto Sekali Lihat" : null);
        mediaUrl = await this.downloadAndSaveMedia(proto.imageMessage, "image", messageId);
      } else if (proto.videoMessage) {
        const isVo = !!isViewOnce;
        textContent = proto.videoMessage.caption || (isVo ? "👁️ Video (Sekali Lihat)" : "🎥 Video");
        mediaType = "video";
        mediaCaption = proto.videoMessage.caption || (isVo ? "👁️ Video Sekali Lihat" : null);
        mediaUrl = await this.downloadAndSaveMedia(proto.videoMessage, "video", messageId);
      } else if (proto.audioMessage) {
        textContent = proto.audioMessage.ptt ? "🎤 Pesan Suara" : "🎵 Audio";
        mediaType = proto.audioMessage.ptt ? "voice" : "audio";
        mediaCaption = proto.audioMessage.ptt ? "Pesan Suara" : "Audio";
        mediaUrl = await this.downloadAndSaveMedia(proto.audioMessage, "audio", messageId);
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
    }

    if (!textContent && (isViewOnce || parsed?.isViewOnce || raw?.key?.isViewOnce || parsed?.key?.isViewOnce)) {
      textContent = "👁️ Foto / Video (Sekali Lihat)";
      mediaType = "view_once";
      mediaCaption = "Pesan Sekali Lihat";
    }

    if (!textContent && mediaType === "text") return;

    if (!fromMe && !isGroup && pushName && pushName.trim() && pushName !== "Kontak" && pushName !== "Saya") {
      await ContactModel.updateNameIfPlaceholder(userId, remoteJid, pushName.trim());
    }

    const contextInfo =
      proto?.extendedTextMessage?.contextInfo ||
      proto?.imageMessage?.contextInfo ||
      proto?.videoMessage?.contextInfo ||
      proto?.audioMessage?.contextInfo ||
      proto?.documentMessage?.contextInfo ||
      proto?.stickerMessage?.contextInfo ||
      raw?.message?.extendedTextMessage?.contextInfo ||
      raw?.message?.imageMessage?.contextInfo ||
      raw?.message?.videoMessage?.contextInfo ||
      null;

    let quotedMessageData = null;
    if (contextInfo && (contextInfo.stanzaId || contextInfo.quotedMessage)) {
      const qProto = contextInfo.quotedMessage || {};
      let qText = qProto.conversation || qProto.extendedTextMessage?.text;
      let qMediaType = "text";
      if (!qText) {
        if (qProto.imageMessage) {
          qMediaType = "image";
          qText = qProto.imageMessage.caption || "📷 Foto";
        } else if (qProto.videoMessage) {
          qMediaType = "video";
          qText = qProto.videoMessage.caption || "🎥 Video";
        } else if (qProto.audioMessage) {
          qMediaType = qProto.audioMessage.ptt ? "voice" : "audio";
          qText = qProto.audioMessage.ptt ? "🎤 Pesan Suara" : "🎵 Audio";
        } else if (qProto.documentMessage) {
          qMediaType = "document";
          qText = `📄 ${qProto.documentMessage.fileName || qProto.documentMessage.caption || "Dokumen"}`;
        } else if (qProto.stickerMessage) {
          qMediaType = "sticker";
          qText = "🎨 Stiker";
        } else if (qProto.contactMessage) {
          qMediaType = "contact";
          qText = `👤 ${qProto.contactMessage.displayName || "Kontak"}`;
        } else if (qProto.locationMessage) {
          qMediaType = "location";
          qText = `📍 ${qProto.locationMessage.name || "Lokasi"}`;
        }
      }

      const qParticipant = contextInfo.participant || "";
      const qPhone = qParticipant ? qParticipant.replace(/[^0-9]/g, "") : "";
      const keySession = this.sessions.get(this.getSessionKey(userId, sessionName));
      const myPhone = keySession?.phoneNumber || (keySession?.sock?.user?.id ? keySession.sock.user.id.split(":")[0] : "");
      const isQFromMe = (myPhone && qPhone && qPhone === myPhone) || (fromMe && !contextInfo.participant);

      quotedMessageData = {
        messageId: contextInfo.stanzaId || null,
        senderJid: qParticipant || null,
        senderPhone: qPhone || null,
        senderName: isQFromMe ? "Saya" : (qPhone ? `+${qPhone}` : "Kontak"),
        fromMe: isQFromMe,
        content: qText || "Pesan",
        mediaType: qMediaType,
      };
    }

    try {
      const contact = await ContactModel.findOrCreate(userId, {
        name: isGroup ? "Grup WhatsApp" : (!fromMe && pushName ? pushName : `+${rawPhone}`),
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
        quotedMessage: quotedMessageData,
        rawData: isViewOnce ? { isViewOnce: true } : null,
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

  async sendChatMessage(userId, { jid, text, quotedMessageId = null, sessionName = "default" }) {
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

    let quotedPayload = undefined;
    let quotedMessageData = null;

    if (quotedMessageId) {
      const origMsg = await MessageModel.getById(quotedMessageId, userId);
      if (origMsg) {
        const isOrigFromMe = !!origMsg.from_me;
        let participant = undefined;
        if (isGroup) {
          if (isOrigFromMe) {
            participant = session.sock.user?.id ? session.sock.user.id.split(":")[0] + "@s.whatsapp.net" : undefined;
          } else if (origMsg.phone) {
            participant = `${String(origMsg.phone).replace(/[^0-9]/g, "")}@s.whatsapp.net`;
          }
        }

        let origContent = { conversation: origMsg.content || "" };
        if (origMsg.media_type === "image") {
          origContent = { imageMessage: { caption: origMsg.content || "" } };
        } else if (origMsg.media_type === "video") {
          origContent = { videoMessage: { caption: origMsg.content || "" } };
        } else if (origMsg.media_type === "voice" || origMsg.media_type === "audio") {
          origContent = { audioMessage: { ptt: origMsg.media_type === "voice" } };
        } else if (origMsg.media_type === "document") {
          origContent = { documentMessage: { fileName: origMsg.content || "Dokumen" } };
        }

        quotedPayload = {
          key: {
            remoteJid: cleanJid,
            fromMe: isOrigFromMe,
            id: origMsg.message_id || origMsg.id,
            participant,
          },
          message: origContent,
        };

        quotedMessageData = {
          messageId: origMsg.message_id || origMsg.id,
          senderName: isOrigFromMe ? "Saya" : (origMsg.sender_name || (origMsg.phone ? `+${origMsg.phone}` : "Kontak")),
          senderPhone: origMsg.phone || null,
          content: origMsg.content || "",
          mediaType: origMsg.media_type || "text",
          fromMe: isOrigFromMe,
        };
      }
    }

    const sendOptions = quotedPayload ? { quoted: quotedPayload } : {};
    const sent = await session.sock.sendMessage(cleanJid, {
      text: text.trim(),
    }, sendOptions);

    if (sent?.key?.id) {
      this.processedMessageIds.set(`${userId}_${sent.key.id}`, Date.now());
    }

    const savedMessage = await MessageModel.create({
      userId,
      contactId: contact?.id || null,
      phone: cleanPhone,
      remoteJid: cleanJid,
      messageId: sent?.key?.id,
      senderName: "Saya",
      content: text.trim(),
      quotedMessage: quotedMessageData,
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

  async editChatMessage(userId, { jid, messageId, newText, sessionName = "default" }) {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);

    if (!session || session.status !== "CONNECTED" || !session.sock) {
      throw new Error("WhatsApp Anda belum terhubung.");
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

    const editKey = {
      remoteJid: cleanJid,
      fromMe: true,
      id: messageId,
    };

    await session.sock.sendMessage(cleanJid, {
      text: newText.trim(),
      edit: editKey,
    });

    const updated = await MessageModel.updateContent(userId, messageId, newText.trim());

    socketService.emitToUser(userId, "message_edited", {
      messageId,
      newContent: newText.trim(),
      remoteJid: cleanJid,
      rawData: updated?.raw_data || { isEdited: true },
    });

    return updated || { messageId, content: newText.trim() };
  }

  async deleteMessageForEveryone(userId, { jid, messageId, sessionName = "default" }) {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);

    if (!session || session.status !== "CONNECTED" || !session.sock) {
      throw new Error("WhatsApp Anda belum terhubung.");
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

    const deleteKey = {
      remoteJid: cleanJid,
      fromMe: true,
      id: messageId,
    };

    await session.sock.sendMessage(cleanJid, {
      delete: deleteKey,
    });

    const updated = await MessageModel.markAsRevoked(userId, messageId);

    socketService.emitToUser(userId, "message_revoked", {
      messageId,
      remoteJid: cleanJid,
    });

    return { success: true, messageId };
  }

  async deleteMessageForMe(userId, { messageId }) {
    await MessageModel.deleteByIdOrMessageId(userId, messageId);

    socketService.emitToUser(userId, "message_deleted_for_me", {
      messageId,
    });

    return { success: true, messageId };
  }

  async modifyChatPin(userId, { jid, pinned, sessionName = "default" }) {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);

    const isGroup = typeof jid === "string" && jid.endsWith("@g.us");
    let cleanJid = jid;
    let cleanPhone = isGroup ? jid : (jid ? String(jid).replace(/[^0-9]/g, "") : "");

    if (typeof jid === "string" && jid.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, jid);
      cleanJid = resolved.jid;
      cleanPhone = resolved.phone;
    } else if (!isGroup && jid && !jid.includes("@")) {
      cleanJid = `${cleanPhone}@s.whatsapp.net`;
    }

    if (session && session.status === "CONNECTED" && session.sock) {
      try {
        await session.sock.chatModify({ pin: !!pinned }, cleanJid);
      } catch (err) {
        console.warn(`[WhatsApp - ${userId}] Error syncing chat pin:`, err.message);
      }
    }
  }

  async modifyChatArchive(userId, { jid, archived, sessionName = "default" }) {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);

    const isGroup = typeof jid === "string" && jid.endsWith("@g.us");
    let cleanJid = jid;
    let cleanPhone = isGroup ? jid : (jid ? String(jid).replace(/[^0-9]/g, "") : "");

    if (typeof jid === "string" && jid.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, jid);
      cleanJid = resolved.jid;
      cleanPhone = resolved.phone;
    } else if (!isGroup && jid && !jid.includes("@")) {
      cleanJid = `${cleanPhone}@s.whatsapp.net`;
    }

    if (session && session.status === "CONNECTED" && session.sock) {
      try {
        let lastMessages = undefined;
        try {
          const msgs = await MessageModel.getByChatJid(userId, cleanJid, 1, 0);
          if (msgs && msgs.length > 0 && msgs[0].message_id) {
            const latest = msgs[0];
            lastMessages = [{
              key: {
                id: latest.message_id,
                remoteJid: cleanJid,
                fromMe: !!latest.from_me,
                participant: latest.sender_phone && cleanJid.endsWith("@g.us") ? `${latest.sender_phone}@s.whatsapp.net` : undefined
              },
              messageTimestamp: Math.floor(new Date(latest.sent_at || latest.created_at).getTime() / 1000)
            }];
          }
        } catch (e) {}

        await session.sock.chatModify({
          archive: !!archived,
          lastMessages
        }, cleanJid);
      } catch (err) {
        console.warn(`[WhatsApp - ${userId}] Error syncing chat archive:`, err.message);
      }
    }
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

    try {
      await MessageModel.deleteAllByUser(userId);
      await ContactModel.deleteAllByUser(userId);
      await CallLogModel.deleteAllByUser(userId);
      await ChatAiSettingModel.deleteAllByUser(userId);
      console.log(`[WhatsApp - ${userId}] All user chats, contacts, messages, and call logs wiped on disconnect.`);
    } catch (wipeErr) {
      console.error(`[WhatsApp - ${userId}] Error wiping user chat data on disconnect:`, wipeErr.message);
    }

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

  async sendVoiceNote(userId, { jid, audioBuffer, mimetype = 'audio/ogg; codecs=opus', quotedMessageId = null, sessionName = 'default' }) {
    const key = this.getSessionKey(userId, sessionName);
    const session = this.sessions.get(key);
    if (!session || !session.sock || session.status !== "CONNECTED") {
      throw new Error("WhatsApp belum terhubung");
    }

    const isGroup = typeof jid === "string" && jid.endsWith("@g.us");
    let cleanJid = jid;
    let cleanPhone = isGroup ? jid : jid.replace(/[^0-9]/g, "");

    if (jid.endsWith("@lid")) {
      const resolved = this.resolveLidToPhone(userId, sessionName, jid);
      cleanJid = resolved.jid;
      cleanPhone = resolved.phone;
    } else if (!isGroup && !jid.includes("@")) {
      cleanJid = `${cleanPhone}@s.whatsapp.net`;
    }

    let finalBuffer = audioBuffer;
    try {
      finalBuffer = await convertToOpusOgg(audioBuffer);
    } catch (convErr) {}

    let durationSeconds = 1;
    let waveform = null;
    try {
      const mm = require("music-metadata");
      const meta = await mm.parseBuffer(finalBuffer, "audio/ogg");
      if (meta?.format?.duration) {
        durationSeconds = Math.max(1, Math.round(meta.format.duration));
      }
    } catch (e) {}

    try {
      const { getAudioWaveform } = require("@whiskeysockets/baileys/lib/Utils/messages-media.js");
      waveform = await getAudioWaveform(finalBuffer);
    } catch (e) {}

    const sendPayload = {
      audio: finalBuffer,
      mimetype: "audio/ogg; codecs=opus",
      ptt: true,
      seconds: durationSeconds,
    };
    if (waveform && waveform.length === 64) {
      sendPayload.waveform = waveform;
    }

    let quotedPayload = undefined;
    let quotedMessageData = null;

    if (quotedMessageId) {
      const origMsg = await MessageModel.getById(quotedMessageId, userId);
      if (origMsg) {
        const isOrigFromMe = !!origMsg.from_me;
        let participant = undefined;
        if (isGroup) {
          if (isOrigFromMe) {
            participant = session.sock.user?.id ? session.sock.user.id.split(":")[0] + "@s.whatsapp.net" : undefined;
          } else if (origMsg.phone) {
            participant = `${String(origMsg.phone).replace(/[^0-9]/g, "")}@s.whatsapp.net`;
          }
        }

        let origContent = { conversation: origMsg.content || "" };
        if (origMsg.media_type === "image") {
          origContent = { imageMessage: { caption: origMsg.content || "" } };
        } else if (origMsg.media_type === "video") {
          origContent = { videoMessage: { caption: origMsg.content || "" } };
        } else if (origMsg.media_type === "voice" || origMsg.media_type === "audio") {
          origContent = { audioMessage: { ptt: origMsg.media_type === "voice" } };
        } else if (origMsg.media_type === "document") {
          origContent = { documentMessage: { fileName: origMsg.content || "Dokumen" } };
        }

        quotedPayload = {
          key: {
            remoteJid: cleanJid,
            fromMe: isOrigFromMe,
            id: origMsg.message_id || origMsg.id,
            participant,
          },
          message: origContent,
        };

        quotedMessageData = {
          messageId: origMsg.message_id || origMsg.id,
          senderName: isOrigFromMe ? "Saya" : (origMsg.sender_name || (origMsg.phone ? `+${origMsg.phone}` : "Kontak")),
          senderPhone: origMsg.phone || null,
          content: origMsg.content || "",
          mediaType: origMsg.media_type || "text",
          fromMe: isOrigFromMe,
        };
      }
    }

    const sendOptions = quotedPayload ? { quoted: quotedPayload } : {};
    const sent = await session.sock.sendMessage(cleanJid, sendPayload, sendOptions);

    if (sent?.key?.id) {
      this.processedMessageIds.set(`${userId}_${sent.key.id}`, Date.now());
    }

    const messageId = sent?.key?.id || `vn_${Date.now()}`;
    const filename = `vn_${messageId}.ogg`;
    const filePath = path.join(UPLOADS_DIR, filename);
    try {
      fs.writeFileSync(filePath, finalBuffer);
    } catch (e) {}

    const mediaUrl = `/uploads/${filename}`;

    const contact = await ContactModel.findOrCreate(userId, {
      name: isGroup ? "Grup WhatsApp" : `+${cleanPhone}`,
      phone: cleanPhone,
      jid: cleanJid,
      isGroup,
    });

    const savedMessage = await MessageModel.create({
      userId,
      contactId: contact?.id || null,
      phone: cleanPhone,
      remoteJid: cleanJid,
      messageId,
      senderName: "Saya",
      content: "🎤 Pesan Suara",
      mediaType: "voice",
      mediaUrl,
      mediaCaption: "Pesan Suara",
      quotedMessage: quotedMessageData,
      direction: "OUTGOING",
      status: "SENT",
      fromMe: true,
      sentAt: new Date(),
    });

    await ContactModel.updateLastMessage(userId, cleanJid, {
      text: "✓ 🎤 Pesan Suara",
      timestamp: new Date(),
      incrementUnread: false,
    });

    socketService.emitToUser(userId, "message_new", {
      message: savedMessage,
      contact,
      remoteJid: cleanJid,
    });

    socketService.emitToUser(userId, "chat_update", {
      jid: cleanJid,
      lastMessage: "✓ 🎤 Pesan Suara",
      lastMessageTime: new Date(),
      unreadIncrement: false,
    });

    return savedMessage;
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
