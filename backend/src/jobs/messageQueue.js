const { Queue, Worker } = require('bullmq');
const { redisConfig } = require('../config/redis');
const SendingJobModel = require('../models/sendingJobModel');
const MessageModel = require('../models/messageModel');
const ContactModel = require('../models/contactModel');

const QUEUE_NAME = 'whatsapp-dispatch-queue';
let dispatchQueue = null;
let dispatchWorker = null;
let isRedisActive = false;

// Inisialisasi BullMQ jika Redis aktif
try {
  const connection = redisConfig.url
    ? { url: redisConfig.url }
    : {
        host: redisConfig.host || '127.0.0.1',
        port: redisConfig.port || 6379,
        password: redisConfig.password || undefined,
        maxRetriesPerRequest: null
      };

  dispatchQueue = new Queue(QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000
      },
      removeOnComplete: true,
      removeOnFail: false
    }
  });

  dispatchQueue.client.then(() => {
    isRedisActive = true;
    console.log('[Queue] BullMQ dispatch queue connected to Redis');
  }).catch((err) => {
    isRedisActive = false;
    console.log(`[Queue Info] Redis not available for BullMQ, using memory async queue fallback: ${err.message}`);
  });

  dispatchWorker = new Worker(
    QUEUE_NAME,
    async (job) => {
      await executeDispatchTask(job.data);
    },
    { connection, concurrency: 2 }
  );

  dispatchWorker.on('completed', (job) => {
    console.log(`[Queue] Job ${job.id} completed successfully`);
  });

  dispatchWorker.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job?.id} failed:`, err.message);
  });
} catch (err) {
  isRedisActive = false;
  console.log(`[Queue Info] Fallback to in-memory async dispatcher: ${err.message}`);
}

/**
 * Core function that sends messages sequentially with delay
 */
async function executeDispatchTask(data) {
  const {
    jobId,
    userId,
    adminPhone,
    targetPhone,
    messages = [],
    intervalSeconds = 5,
    sessionName = 'default'
  } = data;

  const whatsappService = require('../services/whatsappService');
  console.log(`[Dispatcher] Starting dispatch job ${jobId} -> ${targetPhone} (${messages.length} messages, ${intervalSeconds}s interval)`);

  if (jobId && userId) {
    await SendingJobModel.updateStatus(jobId, userId, 'PROCESSING', { startedAt: new Date() });
  }

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < messages.length; i++) {
    const textMsg = messages[i];
    const itemNum = i + 1;

    try {
      console.log(`[Dispatcher] Sending message ${itemNum}/${messages.length} to ${targetPhone}...`);
      
      const sentResult = await whatsappService.sendDirectMessage(
        targetPhone,
        textMsg,
        sessionName,
        userId
      );

      successCount++;

      if (jobId && userId) {
        await SendingJobModel.incrementCompletedCount(jobId, userId);
      }
    } catch (err) {
      failCount++;
      console.error(`[Dispatcher] Failed sending message ${itemNum} to ${targetPhone}:`, err.message);
    }

    // Jeda antar pesan (kecuali pesan terakhir)
    if (i < messages.length - 1) {
      const waitMs = Math.max(intervalSeconds, 1) * 1000;
      console.log(`[Dispatcher] Waiting ${waitMs / 1000}s before next message...`);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  // Update DB status
  if (jobId && userId) {
    const finalStatus = failCount === 0 ? 'COMPLETED' : (successCount > 0 ? 'PARTIAL' : 'FAILED');
    await SendingJobModel.updateStatus(jobId, userId, finalStatus, { completedAt: new Date() });
  }

  // Kirim laporan ke WhatsApp Admin jika adminPhone ada
  if (adminPhone) {
    const reportText = `✅ *Laporan Pengiriman Selesai*\n\n` +
      `• Target: *${targetPhone}*\n` +
      `• Total Terkirim: *${successCount} / ${messages.length}*\n` +
      (failCount > 0 ? `• Gagal: *${failCount}*\n` : '') +
      `• Waktu: _${new Date().toLocaleTimeString('id-ID')}_\n\n` +
      `Semua pesan telah selesai diproses oleh Bot.`;

    try {
      await whatsappService.sendDirectMessage(adminPhone, reportText, sessionName, userId);
      console.log(`[Dispatcher] Completion report sent to Admin (${adminPhone})`);
    } catch (adminReportErr) {
      console.error('[Dispatcher] Failed to send report to admin:', adminReportErr.message);
    }
  }
}

/**
 * Enqueue dispatch job (BullMQ or In-Memory fallback)
 */
async function enqueueDispatch(data) {
  if (isRedisActive && dispatchQueue) {
    try {
      const job = await dispatchQueue.add('dispatch-job', data);
      console.log(`[Queue] Enqueued job ${job.id} to BullMQ`);
      return { type: 'BULLMQ', jobId: job.id };
    } catch (err) {
      console.warn('[Queue] BullMQ add error, falling back to memory queue:', err.message);
    }
  }

  // In-memory async fallback
  console.log('[Queue] Running task asynchronously in background...');
  setImmediate(() => {
    executeDispatchTask(data).catch((err) => {
      console.error('[Memory Dispatcher Error]:', err.message);
    });
  });

  return { type: 'IN_MEMORY', jobId: data.jobId || 'mem_' + Date.now() };
}

module.exports = {
  dispatchQueue,
  enqueueDispatch,
  executeDispatchTask
};
