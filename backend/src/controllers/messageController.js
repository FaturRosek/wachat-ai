const WhatsappService = require('../services/whatsappService');
const MessageModel = require('../models/messageModel');

const MessageController = {
  async sendMessage(req, res, next) {
    try {
      const { phone, message, contactName } = req.body;
      const result = await WhatsappService.sendOutboundMessage(req.user.id, {
        toPhone: phone,
        messageText: message,
        contactName
      });

      res.status(200).json({
        success: true,
        message: 'Message sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  async getMessages(req, res, next) {
    try {
      const { limit = 50, offset = 0, status, direction } = req.query;
      const messages = await MessageModel.getAllByUser(req.user.id, {
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
        status,
        direction
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

  async getConversationMessages(req, res, next) {
    try {
      const { conversationId } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      const messages = await MessageModel.getByConversationId(
        conversationId,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      res.status(200).json({
        success: true,
        data: {
          messages
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = MessageController;
