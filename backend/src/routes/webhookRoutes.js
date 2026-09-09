const express = require('express');
const router = express.Router();
const WebhookController = require('../controllers/webhookController');

router.get('/whatsapp', WebhookController.verify);
router.post('/whatsapp', WebhookController.handleIncoming);

module.exports = router;
