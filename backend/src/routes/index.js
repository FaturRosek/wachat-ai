const express = require('express');
const router = express.Router();
const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const webhookRoutes = require('./webhookRoutes');
const whatsappRoutes = require('./whatsappRoutes');
const messageRoutes = require('./messageRoutes');

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/whatsapp', whatsappRoutes);
router.use('/messages', messageRoutes);

router.get('/', (req, res) => {
  res.json({
    name: 'WaChat AI API',
    version: '1.0.0',
    status: 'online'
  });
});

module.exports = router;
