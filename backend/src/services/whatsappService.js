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
const ChatAiSettingModel = require("../models/chatAiSettingModel");
const StoryModel = require("../models/storyModel");
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
        syncFullHistory: true,
        markOnlineOnConnect: true,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 25000,
        generateHighQualityLinkPreview: true,
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

          socketService.emitToUser(userId, "wa_status", {
            status: "PAIRING_CODE",
            pairingCode: formattedCode,
            pairingPhone: targetPairPhone,
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

        console.log(`[WhatsApp - ${userId}] ✅ Connected as: ${rawPhone}`);

        // Automatically sync all participating groups and contacts
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

    // Handle History Sync (when WhatsApp Web first syncs conversations)
    sock.ev.on("messaging-history.set", async ({ chats, contacts, messages, isLatest }) => {
      try {
        console.log(`[WhatsApp - ${userId}] History Sync received: ${chats?.length || 0} chats, ${contacts?.length || 0} contacts, ${messages?.length || 0} messages`);

        // Sync participating groups first
        await this.syncGroupsAndChats(userId, sessionName).catch(() => {});

        if (Array.isArray(contacts)) {
          for (const c of contacts) {
            const rawId = c.id || "";
            // Strictly ignore LID and broadcasts
            if (!rawId || rawId.includes("@lid") || rawId.includes("status@broadcast") || rawId.includes("@newsletter") || rawId === "0@s.whatsapp.net") {
              continue;
            }

            const isGroup = rawId.endsWith("@g.us");
            const cleanPhone = isGroup ? rawId : rawId.replace(/[^0-9]/g, "");
            const name = c.notify || c.verifiedName || c.name || (isGroup ? "Grup WhatsApp" : `+${cleanPhone}`);

            await ContactModel.findOrCreate(userId, {
              name,
              phone: cleanPhone,
              jid: rawId,
              isGroup,
            });
          }
        }

        if (Array.isArray(messages)) {
          for (const m of messages) {
            await this._processMessageObject(userId, sessionName, m);
          }
        }

        socketService.emitToUser(userId, "chat_sync_complete", { count: chats?.length || 0 });
      } catch (histErr) {
        console.error(`[WhatsApp - ${userId}] History sync error:`, histErr.message);
      }
    });

    // Handle incoming & outgoing messages
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
      for (const msg of messages) {
        await this._processMessageObject(userId, sessionName, msg);
      }
    });

    // Handle message status updates (ticks: sent, delivered, read)
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

    // Handle presence updates (online / typing)
    sock.ev.on("presence.update", ({ id, presences }) => {
      socketService.emitToUser(userId, "presence_update", {
        jid: id,
        presences,
      });
    });

    // Handle WhatsApp Call Events
    sock.ev.on("call", async (calls) => {
      for (const call of calls) {
        if (call.status === "offer") {
          const callerJid = call.from;
          const callerPhone = callerJid.replace(/[^0-9]/g, "");
          console.log(`[WhatsApp - ${userId}] 📞 Incoming call from ${callerJid}`);

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
      console.log(`[WhatsApp - ${userId}] 🔄 Syncing participating WhatsApp groups...`);
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

      console.log(`[WhatsApp - ${userId}] ✅ Successfully synced ${groupList.length} groups.`);
      socketService.emitToUser(userId, "groups_synced", { count: groupList.length });
      return { success: true, count: groupList.length };
    } catch (err) {
      console.error(`[WhatsApp - ${userId}] Error syncing groups:`, err.message);
      return { success: false, error: err.message };
    }
  }

  async _processMessageObject(userId, sessionName, msg) {
    if (!msg || !msg.message) return;

    const remoteJid = msg.key?.remoteJid;
    if (!remoteJid) return;

    // Filter out LID and newsletter internal IDs
    if (remoteJid.includes("@lid") || remoteJid.includes("@newsletter") || remoteJid === "0@s.whatsapp.net") {
      return;
    }

    const fromMe = !!msg.key?.fromMe;
    const isStatus = remoteJid.includes("status@broadcast");
    const isGroup = remoteJid.endsWith("@g.us");
    const messageId = msg.key?.id;
    const senderName = msg.pushName || (fromMe ? "Saya" : (isGroup ? "Anggota Grup" : "Kontak"));
    const rawPhone = isGroup ? remoteJid : remoteJid.replace(/[^0-9]/g, "");

    // 1. Handle Status / Stories
    if (isStatus) {
      const participant = msg.key?.participant || remoteJid;
      const partPhone = participant.replace(/[^0-9]/g, "");
      let textContent = "";
      let mediaType = "text";

      if (msg.message.conversation) textContent = msg.message.conversation;
      else if (msg.message.extendedTextMessage?.text) textContent = msg.message.extendedTextMessage.text;
      else if (msg.message.imageMessage?.caption) {
        textContent = msg.message.imageMessage.caption;
        mediaType = "image";
      } else if (msg.message.videoMessage?.caption) {
        textContent = msg.message.videoMessage.caption;
        mediaType = "video";
      }

      const createdStory = await StoryModel.create({
        userId,
        senderJid: participant,
        senderName: senderName || partPhone,
        senderPhone: partPhone,
        caption: textContent,
        mediaType,
        storyTimestamp: new Date(Number(msg.messageTimestamp || Date.now() / 1000) * 1000),
      });

      socketService.emitToUser(userId, "story_new", createdStory);
      return;
    }

    // 2. Extract Message Content & Media Details
    let textContent = "";
    let mediaType = "text";
    let mediaUrl = null;
    let mediaCaption = null;

    if (msg.message.conversation) {
      textContent = msg.message.conversation;
    } else if (msg.message.extendedTextMessage) {
      textContent = msg.message.extendedTextMessage.text || "";
    } else if (msg.message.imageMessage) {
      textContent = msg.message.imageMessage.caption || "📷 Foto";
      mediaType = "image";
      mediaCaption = msg.message.imageMessage.caption;
    } else if (msg.message.videoMessage) {
      textContent = msg.message.videoMessage.caption || "🎥 Video";
      mediaType = "video";
      mediaCaption = msg.message.videoMessage.caption;
    } else if (msg.message.audioMessage) {
      textContent = "🎵 Audio / Voice Note";
      mediaType = msg.message.audioMessage.ptt ? "voice" : "audio";
    } else if (msg.message.documentMessage) {
      textContent = `📄 ${msg.message.documentMessage.fileName || "Dokumen"}`;
      mediaType = "document";
      mediaCaption = msg.message.documentMessage.fileName;
    } else if (msg.message.stickerMessage) {
      textContent = "🎨 Stiker";
      mediaType = "sticker";
    }

    if (!textContent && mediaType === "text") return;

    try {
      // Find or create contact / group
      const contact = await ContactModel.findOrCreate(userId, {
        name: isGroup ? "Grup WhatsApp" : (senderName || `+${rawPhone}`),
        phone: rawPhone,
        jid: remoteJid,
        isGroup,
      });

      if (!contact) return;

      // Save message to database
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
        sentAt: new Date(Number(msg.messageTimestamp || Date.now() / 1000) * 1000),
      });

      // Update contact last message info & unread counter
      const displaySnippet = isGroup && !fromMe ? `${senderName}: ${textContent}` : textContent;
      await ContactModel.updateLastMessage(userId, remoteJid, {
        text: displaySnippet,
        timestamp: savedMessage.sent_at,
        incrementUnread: !fromMe,
      });

      // Broadcast real-time message to frontend via Socket.IO
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

      // 3. Auto-Reply AI Engine
      if (!fromMe && !isGroup) {
        await this._handleAutoReplyLogic(userId, sessionName, remoteJid, rawPhone, senderName, textContent);
      }
    } catch (err) {
      console.error(`[WhatsApp - ${userId}] Error processing message:`, err.message);
    }
  }

  async _handleAutoReplyLogic(userId, sessionName, remoteJid, senderPhone, senderName, incomingText) {
    try {
      // Check Admin Dispatch command first
      const isAdmin = this._isAdminNumber(senderPhone);
      if (isAdmin && (incomingText.toLowerCase().includes("kirim") || incomingText.toLowerCase().includes("bantuan") || incomingText.toLowerCase().includes("status"))) {
        const aiResult = await aiService.parseAndGenerate(incomingText);

        if (aiResult.action === "SEND_DISPATCH" && aiResult.targetPhone && Array.isArray(aiResult.messages) && aiResult.messages.length > 0) {
          const ackMsg = aiResult.replyToAdmin ||
            `🚀 *Memulai Pengiriman Pesan*\n• Target: ${aiResult.targetPhone}\n• Jumlah: ${aiResult.messages.length} pesan\n• Jeda: ${aiResult.intervalSeconds || 5}s per pesan`;

          await this.sendDirectMessage(senderPhone, ackMsg, sessionName, userId);

          const createdJob = await SendingJobModel.create(userId, {
            phone: aiResult.targetPhone,
            message: aiResult.summary || (aiResult.messages[0] || "AI Outbound Dispatch"),
            repeatCount: aiResult.messages.length,
            intervalSeconds: aiResult.intervalSeconds || 5,
          });

          await enqueueDispatch({
            jobId: createdJob.id,
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

      // Check per-contact AI Auto-Reply setting
      const aiSetting = await ChatAiSettingModel.getByJid(userId, remoteJid);
      if (aiSetting && aiSetting.auto_reply_enabled) {
        console.log(`[WhatsApp - ${userId}] 🤖 Auto-reply triggered for ${remoteJid}`);
        const chatContext = await MessageModel.getRecentChatContext(userId, remoteJid, 8);
        const replyText = await aiService.generateAutoReply(
          aiSetting.custom_prompt,
          chatContext,
          incomingText,
          senderName || senderPhone
        );

        if (replyText) {
          await new Promise((r) => setTimeout(r, 1500)); // Natural typing delay
          await this.sendChatMessage(userId, {
            jid: remoteJid,
            text: replyText,
            sessionName,
          });
        }
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
    const cleanJid = isGroup ? jid : (jid.includes("@") ? jid : `${jid.replace(/[^0-9]/g, "")}@s.whatsapp.net`);
    const cleanPhone = isGroup ? jid : jid.replace(/[^0-9]/g, "");

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

    socketService.emitToUser(userId, "wa_status", {
      status: "DISCONNECTED",
    });

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
