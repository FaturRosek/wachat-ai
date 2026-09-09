const express = require('express');
const router = express.Router();
const WhatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

router.get('/', WhatsappController.getStatus);
router.post('/connect', WhatsappController.connect);
router.post('/disconnect', WhatsappController.disconnect);
router.post('/test', WhatsappController.testConnection);

module.exports = router;
