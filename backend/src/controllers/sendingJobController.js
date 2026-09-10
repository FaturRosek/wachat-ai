const SendingJobService = require('../services/sendingJobService');

const SendingJobController = {
  async createJob(req, res, next) {
    try {
      const { phone, message, repeatCount, intervalSeconds } = req.body;
      const job = await SendingJobService.createJob(req.user.id, {
        phone,
        message,
        repeatCount,
        intervalSeconds
      });

      res.status(201).json({
        success: true,
        message: 'Sending job created successfully',
        data: { job }
      });
    } catch (error) {
      next(error);
    }
  },

  async getJobs(req, res, next) {
    try {
      const { status, limit = 50, offset = 0 } = req.query;
      const { rows, total } = await SendingJobService.getJobs(req.user.id, {
        status,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10)
      });

      res.status(200).json({
        success: true,
        data: {
          jobs: rows,
          total,
          count: rows.length
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getJobById(req, res, next) {
    try {
      const { id } = req.params;
      const job = await SendingJobService.getJobById(id, req.user.id);

      res.status(200).json({
        success: true,
        data: { job }
      });
    } catch (error) {
      next(error);
    }
  },

  async cancelJob(req, res, next) {
    try {
      const { id } = req.params;
      const job = await SendingJobService.cancelJob(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Sending job cancelled successfully',
        data: { job }
      });
    } catch (error) {
      next(error);
    }
  },

  async deleteJob(req, res, next) {
    try {
      const { id } = req.params;
      const result = await SendingJobService.deleteJob(id, req.user.id);

      res.status(200).json({
        success: true,
        message: 'Sending job deleted successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = SendingJobController;
