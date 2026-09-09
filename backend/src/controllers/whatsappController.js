const WhatsappAccountModel = require('../models/whatsappAccountModel');
const WhatsappService = require('../services/whatsappService');

const WhatsappController = {
  async getStatus(req, res, next) {
    try {
      const account = await WhatsappAccountModel.getByUserId(req.user.id);
      res.status(200).json({
        success: true,
        data: {
          connected: !!(account && account.status === 'CONNECTED'),
          account: account ? {
            phoneNumber: account.phone_number,
            businessAccountId: account.business_account_id,
            phoneNumberId: account.phone_number_id,
            status: account.status,
            updatedAt: account.updated_at
          } : null
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async connect(req, res, next) {
    try {
      const { phoneNumber, businessAccountId, phoneNumberId, accessToken } = req.body;
      if (!phoneNumberId || !accessToken) {
        return res.status(400).json({
          success: false,
          message: 'phoneNumberId and accessToken are required'
        });
      }

      const account = await WhatsappAccountModel.upsert(req.user.id, {
        phoneNumber,
        businessAccountId,
        phoneNumberId,
        accessToken,
        status: 'CONNECTED'
      });

      res.status(200).json({
        success: true,
        message: 'WhatsApp account connected successfully',
        data: account
      });
    } catch (error) {
      next(error);
    }
  },

  async disconnect(req, res, next) {
    try {
      const account = await WhatsappAccountModel.updateStatus(req.user.id, 'DISCONNECTED');
      res.status(200).json({
        success: true,
        message: 'WhatsApp account disconnected',
        data: account
      });
    } catch (error) {
      next(error);
    }
  },

  async testConnection(req, res, next) {
    try {
      const { toPhone } = req.body;
      if (!toPhone) {
        return res.status(400).json({
          success: false,
          message: 'Destination toPhone is required for test'
        });
      }

      const result = await WhatsappService.sendOutboundMessage(req.user.id, {
        toPhone,
        messageText: 'Hello from WaChat AI! WhatsApp connection test is successful.'
      });

      res.status(200).json({
        success: true,
        message: 'Test message sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = WhatsappController;
