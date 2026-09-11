const WhatsappService = require('../services/whatsappService');
const MessageModel = require('../models/messageModel');
const SendingJobModel = require('../models/sendingJobModel');
const { formatPhoneNumber } = require('../utils/phoneValidator');
const { enqueueDispatch } = require('../jobs/messageQueue');

const MessageController = {
  async sendMessage(req, res, next) {
    try {
      const {
        phone,
        message,
        contactName,
        sessionName = 'default',
        repeatCount = 1,
        intervalSeconds = 5,
        useAiVariation = false
      } = req.body;

      const count = parseInt(repeatCount, 10) || 1;
      const interval = Math.max(parseInt(intervalSeconds, 10) || 5, 1);

      if (count <= 1) {
        const result = await WhatsappService.sendTextMessage(req.user.id, {
          toPhone: phone,
          messageText: message,
          contactName,
          sessionName
        });

        return res.status(200).json({
          success: true,
          message: 'Pesan berhasil dikirim!',
          data: result
        });
      }

      const phoneCheck = formatPhoneNumber(phone);
      if (!phoneCheck.isValid) {
        return res.status(400).json({
          success: false,
          message: phoneCheck.error || 'Format nomor telepon tidak valid'
        });
      }

      const cleanPhone = phoneCheck.formattedPhone;
      let messageList = [];

      if (useAiVariation) {
        try {
          const aiService = require('../services/aiService');
          const variations = await aiService.generateVariations(message.trim(), count);
          if (Array.isArray(variations) && variations.length > 0) {
            messageList = variations;
          }
        } catch (e) {
          console.warn('[MessageController] Failed to generate AI variations, using raw message:', e.message);
        }
      }

      if (messageList.length === 0) {
        messageList = Array(count).fill(message.trim());
      }

      const createdJob = await SendingJobModel.create(req.user.id, {
        phone: cleanPhone,
        message: message.trim(),
        repeatCount: count,
        intervalSeconds: interval
      });

      await enqueueDispatch({
        jobId: createdJob.id,
        userId: req.user.id,
        targetPhone: cleanPhone,
        messages: messageList,
        intervalSeconds: interval,
        sessionName
      });

      const isGroup = cleanPhone.endsWith('@g.us');
      const targetLabel = isGroup ? (contactName ? `Grup "${contactName}"` : 'Grup WhatsApp') : `+${cleanPhone}`;

      res.status(200).json({
        success: true,
        message: `Memulai pengiriman berulang sebanyak ${count}x ke ${targetLabel} dengan jeda ${interval} detik per pesan! 🚀`,
        data: {
          jobId: createdJob.id,
          repeatCount: count,
          intervalSeconds: interval,
          targetPhone: cleanPhone
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getMessages(req, res, next) {
    try {
      const { limit = 50, offset = 0, status, direction, phone } = req.query;
      const messages = await MessageModel.getAllByUser(req.user.id, {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        status,
        direction,
        phone
      });

      res.status(200).json({
        success: true,
        data: {
          messages,
          count: messages.length
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getMessageById(req, res, next) {
    try {
      const { id } = req.params;
      const message = await MessageModel.getById(id, req.user.id);

      if (!message) {
        return res.status(404).json({
          success: false,
          message: 'Message not found'
        });
      }

      res.status(200).json({
        success: true,
        data: { message }
      });
    } catch (error) {
      next(error);
    }
  },

  async getPhoneHistory(req, res, next) {
    try {
      const { phone } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const messages = await MessageModel.getByPhone(
        req.user.id,
        phone,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      res.status(200).json({
        success: true,
        data: {
          phone,
          messages,
          count: messages.length
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = MessageController;
