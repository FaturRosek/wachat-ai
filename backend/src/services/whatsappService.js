const axios = require('axios');
const WhatsappAccountModel = require('../models/whatsappAccountModel');
const ContactModel = require('../models/contactModel');
const ConversationModel = require('../models/conversationModel');
const MessageModel = require('../models/messageModel');

const GRAPH_API_BASE_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';

const WhatsappService = {
  verifyWebhookChallenge(mode, token, challenge) {
    const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'wachat_ai_webhook_verify_token_secret';
    if (mode === 'subscribe' && token === expectedToken) {
      return challenge;
    }
    return null;
  },

  async sendTextMessage({ toPhone, messageText, phoneNumberId, accessToken }) {
    const cleanPhone = toPhone.replace(/[^0-9]/g, '');
    const url = `${GRAPH_API_BASE_URL}/${phoneNumberId}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: cleanPhone,
      type: 'text',
      text: {
        preview_url: false,
        body: messageText
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    return response.data;
  },

  async sendOutboundMessage(userId, { toPhone, messageText, contactName = null }) {
    if (!toPhone || !messageText) {
      const error = new Error('Recipient phone number and message content are required');
      error.statusCode = 400;
      throw error;
    }

    const cleanPhone = toPhone.replace(/[^0-9]/g, '');

    let account = await WhatsappAccountModel.getByUserId(userId);
    let phoneNumberId = account?.phone_number_id || process.env.WHATSAPP_PHONE_NUMBER_ID;
    let accessToken = account?.access_token || process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
      const error = new Error('WhatsApp credentials not configured. Please connect WhatsApp account first.');
      error.statusCode = 400;
      throw error;
    }

    const contact = await ContactModel.findOrCreate(userId, {
      name: contactName || cleanPhone,
      phone: cleanPhone
    });

    const conversation = await ConversationModel.findOrCreate(userId, contact.id);

    const pendingMessage = await MessageModel.create({
      conversationId: conversation.id,
      direction: 'OUTBOUND',
      type: 'text',
      content: messageText,
      status: 'PENDING'
    });

    try {
      const apiResponse = await this.sendTextMessage({
        toPhone: cleanPhone,
        messageText,
        phoneNumberId,
        accessToken
      });

      const whatsappMessageId = apiResponse?.messages?.[0]?.id || null;

      const updatedMessage = await MessageModel.updateStatusByWhatsappId(
        whatsappMessageId,
        'SENT',
        new Date()
      );

      const finalMessage = updatedMessage || await MessageModel.create({
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        type: 'text',
        content: messageText,
        whatsappMessageId,
        status: 'SENT',
        sentAt: new Date()
      });

      await ConversationModel.updateLastMessage(conversation.id);

      return {
        message: finalMessage,
        conversationId: conversation.id,
        contact
      };
    } catch (apiError) {
      const errorMsg = apiError.response?.data?.error?.message || apiError.message;
      await MessageModel.updateStatusByWhatsappId(pendingMessage.id, 'FAILED');
      const err = new Error(`WhatsApp API Error: ${errorMsg}`);
      err.statusCode = apiError.response?.status || 500;
      throw err;
    }
  },

  async processWebhook(body) {
    if (body.object !== 'whatsapp_business_account') {
      return { handled: false, reason: 'Invalid object type' };
    }

    const entries = body.entry || [];
    for (const entry of entries) {
      const changes = entry.changes || [];
      for (const change of changes) {
        if (change.field !== 'messages') continue;

        const value = change.value;
        const metadata = value.metadata;
        const phoneNumberId = metadata?.phone_number_id;

        let account = null;
        if (phoneNumberId) {
          account = await WhatsappAccountModel.getByPhoneNumberId(phoneNumberId);
        }
        if (!account) {
          account = await WhatsappAccountModel.getFirstActiveAccount();
        }

        if (value.statuses && Array.isArray(value.statuses)) {
          for (const statusItem of value.statuses) {
            const wamid = statusItem.id;
            const statusStr = (statusItem.status || '').toUpperCase();
            const timestamp = statusItem.timestamp 
              ? new Date(parseInt(statusItem.timestamp, 10) * 1000) 
              : new Date();

            if (['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(statusStr)) {
              await MessageModel.updateStatusByWhatsappId(wamid, statusStr, timestamp);
            }
          }
        }

        if (value.messages && Array.isArray(value.messages)) {
          for (const msg of value.messages) {
            const fromPhone = msg.from;
            const wamid = msg.id;
            const msgType = msg.type;
            let msgContent = '';

            if (msgType === 'text') {
              msgContent = msg.text?.body || '';
            } else if (msgType === 'image') {
              msgContent = msg.image?.caption || '[Image]';
            } else if (msgType === 'interactive') {
              msgContent = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '[Interactive Response]';
            } else {
              msgContent = `[${msgType}]`;
            }

            const senderProfile = (value.contacts && value.contacts[0]?.profile?.name) || fromPhone;

            let userId = account?.user_id;
            if (!userId) {
              const { rows } = await require('../config/database').query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
              if (rows.length > 0) {
                userId = rows[0].id;
              }
            }

            if (userId) {
              const contact = await ContactModel.findOrCreate(userId, {
                name: senderProfile,
                phone: fromPhone
              });

              const conversation = await ConversationModel.findOrCreate(userId, contact.id);

              await MessageModel.create({
                conversationId: conversation.id,
                direction: 'INBOUND',
                type: msgType,
                content: msgContent,
                whatsappMessageId: wamid,
                status: 'DELIVERED',
                sentAt: new Date(parseInt(msg.timestamp, 10) * 1000)
              });

              await ConversationModel.updateLastMessage(conversation.id);
            }
          }
        }
      }
    }

    return { handled: true };
  }
};

module.exports = WhatsappService;
