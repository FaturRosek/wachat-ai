const ContactService = require('../services/contactService');

const ContactController = {
  async createContact(req, res, next) {
    try {
      const { name, phone } = req.body;
      const contact = await ContactService.createContact(req.user.id, { name, phone });

      res.status(201).json({
        success: true,
        message: 'Contact created successfully',
        data: { contact }
      });
    } catch (error) {
      next(error);
    }
  },

  async getContacts(req, res, next) {
    try {
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
  },

  async updateContact(req, res, next) {
    try {
      const { id } = req.params;
      const { name, phone } = req.body;
      const contact = await ContactService.updateContact(id, req.user.id, { name, phone });

      res.status(200).json({
        success: true,
        message: 'Contact updated successfully',
        data: { contact }
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteContact(req, res, next) {
    try {
      const { id } = req.params;
      const result = await ContactService.deleteContact(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Contact deleted successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = ContactController;
