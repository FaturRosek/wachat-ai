const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const WhatsappSessionModel = require('../models/whatsappSessionModel');
const ContactModel = require('../models/contactModel');
const MessageModel = require('../models/messageModel');
const { formatPhoneNumber } = require('../utils/phoneValidator');

const SESSIONS_BASE_DIR = path.join(__dirname, '../../sessions');

if (!fs.existsSync(SESSIONS_BASE_DIR)) {
  fs.mkdirSync(SESSIONS_BASE_DIR, { recursive: true });
}

class WhatsappService {
  constructor() {
    this.sessions = new Map();
  }

  getSessionKey(userId, sessionName = 'default') {
    return `${userId}_${sessionName}`;
  }

  getSessionDir(userId, sessionName = 'default') {
    const sessionDir = path.join(SESSIONS_BASE_DIR, `${userId}_${sessionName}`);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    return sessionDir;
  }

  async initSession(userId, sessionName = 'default', forceRestart = false) {
    const key = this.getSessionKey(userId, sessionName);
    const existing = this.sessions.get(key);

    if (existing && existing.sock && !forceRestart) {
      if (existing.status === 'CONNECTED') {
        return {
          status: 'CONNECTED',
          phoneNumber: existing.phoneNumber,
          qr: null,
          qrImage: null
        };
      }
      if (existing.status === 'SCAN_QR' && existing.qrImage) {
        return {
          status: 'SCAN_QR',
          phoneNumber: null,
          qr: existing.qr,
          qrImage: existing.qrImage
        };
      }
    }

    if (existing && existing.sock) {
      try {
        existing.sock.ev.removeAllListeners();
        existing.sock.end();
      } catch (e) {}
      this.sessions.delete(key);
    }

    const sessionDir = this.getSessionDir(userId, sessionName);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307] }));

    await WhatsappSessionModel.upsert(userId, {
      sessionName,
      status: 'CONNECTING',
      qrCode: null
    });

    const sessionState = {
      sock: null,
      status: 'CONNECTING',
      qr: null,
      qrImage: null,
      phoneNumber: null
    };
    this.sessions.set(key, sessionState);

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: true,
      browser: ['WaChat AI', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      keepAliveIntervalMs: 30000,
      generateHighQualityLinkPreview: true
    });

    sessionState.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sessionState.status = 'SCAN_QR';
        sessionState.qr = qr;
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          sessionState.qrImage = qrDataUrl;
          await WhatsappSessionModel.updateStatus(userId, 'SCAN_QR', {
            qrCode: qrDataUrl,
            sessionName
          });
          console.log(`[WhatsApp - ${userId}] QR Code generated. Ready to scan.`);
        } catch (err) {
          console.error('[WhatsApp] Error generating QR code image:', err.message);
        }
      }

      if (connection === 'open') {
        const userJid = sock.user?.id || '';
        const rawPhone = userJid.split(':')[0] || userJid.split('@')[0];
        sessionState.status = 'CONNECTED';
        sessionState.qr = null;
        sessionState.qrImage = null;
        sessionState.phoneNumber = rawPhone;

        await WhatsappSessionModel.updateStatus(userId, 'CONNECTED', {
          phoneNumber: rawPhone,
          qrCode: null,
          sessionName
        });
        console.log(`[WhatsApp - ${userId}] Connected successfully as: ${rawPhone}`);
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        console.log(`[WhatsApp - ${userId}] Connection closed. Reason/StatusCode: ${statusCode}, Should Reconnect: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          sessionState.status = 'DISCONNECTED';
          sessionState.qr = null;
          sessionState.qrImage = null;
          sessionState.phoneNumber = null;

          await WhatsappSessionModel.updateStatus(userId, 'DISCONNECTED', {
            phoneNumber: null,
            qrCode: null,
            sessionName
          });

          try {
            if (fs.existsSync(sessionDir)) {
              fs.rmSync(sessionDir, { recursive: true, force: true });
            }
          } catch (e) {
            console.error('[WhatsApp] Error deleting session folder:', e.message);
          }

          this.sessions.delete(key);
        } else if (shouldReconnect) {
          sessionState.status = 'RECONNECTING';
          await WhatsappSessionModel.updateStatus(userId, 'RECONNECTING', {
            qrCode: null,
            sessionName
          });
          console.log(`[WhatsApp - ${userId}] Auto-reconnecting in 3 seconds...`);
          setTimeout(() => {
            this.initSession(userId, sessionName, true).catch(err => {
              console.error(`[WhatsApp - ${userId}] Reconnection failed:`, err.message);
            });
          }, 3000);
        } else {
          sessionState.status = 'DISCONNECTED';
          await WhatsappSessionModel.updateStatus(userId, 'DISCONNECTED', {
            qrCode: null,
            sessionName
          });
          this.sessions.delete(key);
        }
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid || remoteJid.includes('@g.us') || remoteJid.includes('status@broadcast')) continue;

        const rawPhone = remoteJid.split('@')[0];
        const validation = formatPhoneNumber(rawPhone);
        const senderPhone = validation.isValid ? validation.formattedPhone : rawPhone;
        const senderName = msg.pushName || senderPhone;
        const textContent = msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '[Media/Other message]';

        try {
          const contact = await ContactModel.findOrCreate(userId, {
            name: senderName,
            phone: senderPhone
          });

          const createdMessage = await MessageModel.create({
            userId,
            contactId: contact.id,
            phone: senderPhone,
            content: textContent,
            direction: 'INCOMING',
            status: 'DELIVERED',
            sentAt: new Date(Number(msg.messageTimestamp) * 1000)
          });

          console.log(`[WhatsApp Inbound - ${userId}] Message from ${senderPhone}: ${textContent}`);
        } catch (dbErr) {
          console.error('[WhatsApp Inbound DB Error]:', dbErr.message);
        }
      }
    });

    return {
      status: sessionState.status,
      phoneNumber: sessionState.phoneNumber,
      qr: sessionState.qr,
      qrImage: sessionState.qrImage
    };
  }

  async getSessionStatus(userId, sessionName = 'default') {
    const key = this.getSessionKey(userId, sessionName);
    const sessionState = this.sessions.get(key);

    const dbSession = await WhatsappSessionModel.getByUserId(userId, sessionName);

    if (sessionState) {
      return {
        status: sessionState.status,
        phoneNumber: sessionState.phoneNumber || dbSession?.phone_number || null,
        qrCode: sessionState.qrImage || dbSession?.qr_code || null,
        sessionName,
        updatedAt: dbSession?.updated_at || new Date()
      };
    }

    if (dbSession) {
      return {
        status: dbSession.status,
        phoneNumber: dbSession.phone_number,
        qrCode: dbSession.qr_code,
        sessionName: dbSession.session_name,
        updatedAt: dbSession.updated_at
      };
    }

    return {
      status: 'DISCONNECTED',
      phoneNumber: null,
      qrCode: null,
      sessionName,
      updatedAt: null
    };
  }

  async disconnectSession(userId, sessionName = 'default') {
    const key = this.getSessionKey(userId, sessionName);
    const sessionState = this.sessions.get(key);

    if (sessionState && sessionState.sock) {
      try {
        await sessionState.sock.logout();
      } catch (err) {
        try {
          sessionState.sock.end();
        } catch (e) {}
      }
    }

    this.sessions.delete(key);

    const sessionDir = path.join(SESSIONS_BASE_DIR, `${userId}_${sessionName}`);
    try {
      if (fs.existsSync(sessionDir)) {
        fs.rmSync(sessionDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error('[WhatsApp] Error removing session directory:', e.message);
    }

    await WhatsappSessionModel.updateStatus(userId, 'DISCONNECTED', {
      phoneNumber: null,
      qrCode: null,
      sessionName
    });

    return {
      status: 'DISCONNECTED',
      message: 'WhatsApp session disconnected and logged out.'
    };
  }

  async sendTextMessage(userId, { toPhone, messageText, contactName = null, sessionName = 'default' }) {
    const phoneCheck = formatPhoneNumber(toPhone);
    if (!phoneCheck.isValid) {
      const error = new Error(phoneCheck.error || 'Invalid phone number format');
      error.statusCode = 400;
      throw error;
    }

    if (!messageText || typeof messageText !== 'string' || messageText.trim() === '') {
      const error = new Error('Message text cannot be empty');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = phoneCheck.formattedPhone;
    const key = this.getSessionKey(userId, sessionName);
    const sessionState = this.sessions.get(key);

    if (!sessionState || !sessionState.sock || sessionState.status !== 'CONNECTED') {
      const error = new Error('WhatsApp session is not connected. Please scan QR code first.');
      error.statusCode = 400;
      throw error;
    }

    const contact = await ContactModel.findOrCreate(userId, {
      name: contactName || cleanPhone,
      phone: cleanPhone
    });

    const pendingRecord = await MessageModel.create({
      userId,
      contactId: contact.id,
      phone: cleanPhone,
      content: messageText.trim(),
      direction: 'OUTGOING',
      status: 'PENDING',
      sentAt: null
    });

    const jid = `${cleanPhone}@s.whatsapp.net`;

    try {
      const sent = await sessionState.sock.sendMessage(jid, { text: messageText.trim() });
      const updatedRecord = await MessageModel.updateStatus(pendingRecord.id, 'SENT', new Date());

      return {
        messageId: sent?.key?.id,
        record: updatedRecord,
        contact
      };
    } catch (sendError) {
      await MessageModel.updateStatus(pendingRecord.id, 'FAILED', null);
      const error = new Error(`Failed to send WhatsApp message: ${sendError.message}`);
      error.statusCode = 500;
      throw error;
    }
  }

  async restoreAllSavedSessions() {
    try {
      const activeSessions = await WhatsappSessionModel.getAllActiveSessions();
      console.log(`[WhatsApp] Restoring ${activeSessions.length} active WhatsApp sessions...`);
      for (const session of activeSessions) {
        const sessionDir = path.join(SESSIONS_BASE_DIR, `${session.user_id}_${session.session_name}`);
        if (fs.existsSync(sessionDir)) {
          this.initSession(session.user_id, session.session_name).catch(err => {
            console.error(`[WhatsApp] Failed restoring session for user ${session.user_id}:`, err.message);
          });
        } else {
          await WhatsappSessionModel.updateStatus(session.user_id, 'DISCONNECTED', {
            sessionName: session.session_name
          });
        }
      }
    } catch (err) {
      console.error('[WhatsApp] Error during restoreAllSavedSessions:', err.message);
    }
  }
}

const whatsappServiceInstance = new WhatsappService();
module.exports = whatsappServiceInstance;
