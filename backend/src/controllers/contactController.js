const ContactService = require('../services/contactService');
const WhatsappSessionModel = require('../models/whatsappSessionModel');

const ContactController = {
  async getContacts(req, res, next) {
    try {
      const session = await WhatsappSessionModel.getByUserId(req.user.id);
      if (!session || session.status !== 'CONNECTED') {
        return res.status(200).json({
          success: true,
          data: {
            contacts: [],
            total: 0,
            count: 0
          }
        });
      }

      const { search, limit = 50, offset = 0 } = req.query;
      const { rows, total } = await ContactService.getContacts(req.user.id, {
        search,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.status(200).json({
        success: true,
        data: {
          contacts: rows,
          total,
          count: rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getContactById(req, res, next) {
    try {
      const { id } = req.params;
      const contact = await ContactService.getContactById(id, req.user.id);

      res.status(200).json({
        success: true,
        data: { contact }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = ContactController;
