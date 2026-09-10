const TemplateModel = require('../models/templateModel');

const TemplateService = {
  async createTemplate(userId, { name, content }) {
    if (!name || typeof name !== 'string' || name.trim() === '') {
      const error = new Error('Template name is required');
      error.statusCode = 400;
      throw error;
    }

    if (!content || typeof content !== 'string' || content.trim() === '') {
      const error = new Error('Template content is required');
      error.statusCode = 400;
      throw error;
    }

    const existing = await TemplateModel.findByName(userId, name.trim());
    if (existing) {
      const error = new Error('Template with this name already exists');
      error.statusCode = 409;
      throw error;
    }

    return await TemplateModel.create(userId, {
      name: name.trim(),
      content: content.trim()
    });
  },

  async getTemplates(userId, queryOptions) {
    return await TemplateModel.getAllByUser(userId, queryOptions);
  },

  async getTemplateById(id, userId) {
    const template = await TemplateModel.findById(id, userId);
    if (!template) {
      const error = new Error('Template not found');
      error.statusCode = 404;
      throw error;
    }
    return template;
  },

  async updateTemplate(id, userId, { name, content }) {
    const existing = await TemplateModel.findById(id, userId);
    if (!existing) {
      const error = new Error('Template not found');
      error.statusCode = 404;
      throw error;
    }

    if (name !== undefined) {
      const duplicate = await TemplateModel.findByName(userId, name.trim());
      if (duplicate && duplicate.id !== id) {
        const error = new Error('Another template with this name already exists');
        error.statusCode = 409;
        throw error;
      }
    }

    return await TemplateModel.update(id, userId, {
      name: name ? name.trim() : undefined,
      content: content ? content.trim() : undefined
    });
  },

  async deleteTemplate(id, userId) {
    const existing = await TemplateModel.findById(id, userId);
    if (!existing) {
      const error = new Error('Template not found');
      error.statusCode = 404;
      throw error;
    }

    await TemplateModel.delete(id, userId);
    return { id, deleted: true };
  }
};

module.exports = TemplateService;
