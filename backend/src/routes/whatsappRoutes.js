const express = require('express');
const router = express.Router();
const WhatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.post('/connect', WhatsappController.startSession);
router.post('/pair-code', WhatsappController.requestPairingCode);
router.get('/status', WhatsappController.getStatus);
router.get('/groups', WhatsappController.getGroups);
router.post('/disconnect', WhatsappController.disconnect);
router.post('/send-test', WhatsappController.sendTestMessage);

module.exports = router;
