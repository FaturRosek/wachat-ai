const TemplateService = require('../services/templateService');

const TemplateController = {
  async createTemplate(req, res, next) {
    try {
      const { name, content } = req.body;
      const template = await TemplateService.createTemplate(req.user.id, { name, content });

      res.status(201).json({
        success: true,
        message: 'Template created successfully',
        data: { template }
      });
    } catch (error) {
      next(error);
    }
  },

  async getTemplates(req, res, next) {
    try {
      const { search, limit = 50, offset = 0 } = req.query;
      const { rows, total } = await TemplateService.getTemplates(req.user.id, {
        search,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.status(200).json({
        success: true,
        data: {
          templates: rows,
          total,
          count: rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getTemplateById(req, res, next) {
    try {
      const { id } = req.params;
      const template = await TemplateService.getTemplateById(id, req.user.id);

      res.status(200).json({
        success: true,
        data: { template }
      });
    } catch (error) {
      next(error);
    }
  },

  async updateTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const { name, content } = req.body;
      const template = await TemplateService.updateTemplate(id, req.user.id, { name, content });

      res.status(200).json({
        success: true,
        message: 'Template updated successfully',
        data: { template }
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteTemplate(req, res, next) {
    try {
      const { id } = req.params;
      const result = await TemplateService.deleteTemplate(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Template deleted successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = TemplateController;
