const SendingJobModel = require('../models/sendingJobModel');
const { formatPhoneNumber } = require('../utils/phoneValidator');

const SendingJobService = {
  async createJob(userId, { phone, message, repeatCount = 1, intervalSeconds = 30 }) {
    const phoneCheck = formatPhoneNumber(phone);
    if (!phoneCheck.isValid) {
      const error = new Error(phoneCheck.error || 'Invalid phone number format');
      error.statusCode = 400;
      throw error;
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      const error = new Error('Message text is required');
      error.statusCode = 400;
      throw error;
    }

    const count = parseInt(repeatCount, 10);
    if (isNaN(count) || count < 1) {
      const error = new Error('repeatCount must be a positive integer');
      error.statusCode = 400;
      throw error;
    }

    const interval = parseInt(intervalSeconds, 10);
    if (isNaN(interval) || interval < 1) {
      const error = new Error('intervalSeconds must be a positive integer');
      error.statusCode = 400;
      throw error;
    }

    return await SendingJobModel.create(userId, {
      phone: phoneCheck.formattedPhone,
      message: message.trim(),
      repeatCount: count,
      intervalSeconds: interval
    });
  },

  async getJobs(userId, queryOptions) {
    return await SendingJobModel.getAllByUser(userId, queryOptions);
  },

  async getJobById(id, userId) {
    const job = await SendingJobModel.findById(id, userId);
    if (!job) {
      const error = new Error('Sending job not found');
      error.statusCode = 404;
      throw error;
    }
    return job;
  },

  async cancelJob(id, userId) {
    const job = await SendingJobModel.findById(id, userId);
    if (!job) {
      const error = new Error('Sending job not found');
      error.statusCode = 404;
      throw error;
    }

    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status)) {
      const error = new Error(`Job cannot be cancelled in status ${job.status}`);
      error.statusCode = 400;
      throw error;
    }

    return await SendingJobModel.updateStatus(id, userId, 'CANCELLED', {
      completedAt: new Date()
    });
  },

  async deleteJob(id, userId) {
    const job = await SendingJobModel.findById(id, userId);
    if (!job) {
      const error = new Error('Sending job not found');
      error.statusCode = 404;
      throw error;
    }

    await SendingJobModel.delete(id, userId);
    return { id, deleted: true };
  }
};

module.exports = SendingJobService;
