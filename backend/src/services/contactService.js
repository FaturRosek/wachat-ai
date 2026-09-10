const ContactModel = require('../models/contactModel');
const { formatPhoneNumber } = require('../utils/phoneValidator');

const ContactService = {
  async createContact(userId, { name, phone }) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      const error = new Error('Contact name is required');
      error.statusCode = 400;
      throw error;
    }

    const phoneCheck = formatPhoneNumber(phone);
    if (!phoneCheck.isValid) {
      const error = new Error(phoneCheck.error || 'Invalid phone number format');
      error.statusCode = 400;
      throw error;
    }

    const existing = await ContactModel.findByPhone(userId, phoneCheck.formattedPhone);
    if (existing) {
      const error = new Error('Contact with this phone number already exists');
      error.statusCode = 409;
      throw error;
    }

    return await ContactModel.create(userId, {
      name: name.trim(),
      phone: phoneCheck.formattedPhone
    });
  },

  async getContacts(userId, queryOptions) {
    return await ContactModel.getAllByUser(userId, queryOptions);
  },

  async getContactById(id, userId) {
    const contact = await ContactModel.findById(id, userId);
    if (!contact) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }
    return contact;
  },

  async updateContact(id, userId, { name, phone }) {
    const existing = await ContactModel.findById(id, userId);
    if (!existing) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }

    let cleanPhone = undefined;
    if (phone !== undefined) {
      const phoneCheck = formatPhoneNumber(phone);
      if (!phoneCheck.isValid) {
        const error = new Error(phoneCheck.error || 'Invalid phone number format');
        error.statusCode = 400;
        throw error;
      }

      const duplicate = await ContactModel.findByPhone(userId, phoneCheck.formattedPhone);
      if (duplicate && duplicate.id !== id) {
        const error = new Error('Another contact with this phone number already exists');
        error.statusCode = 409;
        throw error;
      }
      cleanPhone = phoneCheck.formattedPhone;
    }

    return await ContactModel.update(id, userId, {
      name: name ? name.trim() : undefined,
      phone: cleanPhone
    });
  },

  async deleteContact(id, userId) {
    const existing = await ContactModel.findById(id, userId);
    if (!existing) {
      const error = new Error('Contact not found');
      error.statusCode = 404;
      throw error;
    }

    await ContactModel.delete(id, userId);
    return { id, deleted: true };
  }
};

module.exports = ContactService;
