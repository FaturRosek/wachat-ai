const express = require('express');
const router = express.Router();
const WhatsappController = require('../controllers/whatsappController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/scan', (req, res, next) => {
  if (req.query.token) {
    req.headers.authorization = `Bearer ${req.query.token}`;
    return authMiddleware(req, res, () => WhatsappController.renderQRPage(req, res, next));
  }
  return WhatsappController.renderQRPage(req, res, next);
});

router.use(authMiddleware);

router.post('/connect', WhatsappController.startSession);
router.get('/status', WhatsappController.getStatus);
router.post('/disconnect', WhatsappController.disconnect);
router.post('/send-test', WhatsappController.sendTestMessage);

module.exports = router;
