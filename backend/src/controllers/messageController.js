const WhatsappService = require('../services/whatsappService');
const MessageModel = require('../models/messageModel');

const MessageController = {
  async sendMessage(req, res, next) {
    try {
      const { phone, message, contactName, sessionName = 'default' } = req.body;

      const result = await WhatsappService.sendTextMessage(req.user.id, {
        toPhone: phone,
        messageText: message,
        contactName,
        sessionName
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
