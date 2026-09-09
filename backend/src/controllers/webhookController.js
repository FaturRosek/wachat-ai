const WhatsappService = require('../services/whatsappService');

const WebhookController = {
  verify(req, res) {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    const verifiedChallenge = WhatsappService.verifyWebhookChallenge(mode, token, challenge);
    if (verifiedChallenge) {
      return res.status(200).send(verifiedChallenge);
    }
    return res.status(403).json({ success: false, message: 'Verification token mismatch' });
  },

  async handleIncoming(req, res, next) {
    try {
      res.status(200).send('EVENT_RECEIVED');
      await WhatsappService.processWebhook(req.body);
    } catch (error) {
      console.error('Webhook processing error:', error.message);
    }
  }
};

module.exports = WebhookController;
