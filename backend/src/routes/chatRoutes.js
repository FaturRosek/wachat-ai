const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const { messageLimiter, aiLimiter } = require('../middleware/rateLimiter');
const validate = require('../middleware/validate');
const {
  sendChatMessageSchema,
  aiRewriteSchema,
  aiContextSchema,
  aiSettingUpdateSchema,
  toggleAutoReplySchema
} = require('../schemas/chatSchemas');

router.use(authMiddleware);

router.get('/', ChatController.getChats);
router.post('/sync', ChatController.syncChats);
router.get('/logs/calls', ChatController.getCallLogs);

router.post('/send', messageLimiter, validate(sendChatMessageSchema), ChatController.sendMessage);
router.post('/ai/smart-suggestions', aiLimiter, validate(aiContextSchema), ChatController.getSmartSuggestions);
router.post('/ai/summarize', aiLimiter, validate(aiContextSchema), ChatController.summarizeChat);
router.post('/ai/rewrite', aiLimiter, validate(aiRewriteSchema), ChatController.rewriteMessage);

router.get('/:jid/messages', ChatController.getChatMessages);
router.get('/:jid/ai-setting', ChatController.getAiSetting);
router.put('/:jid/ai-setting', validate(aiSettingUpdateSchema), ChatController.updateAiSetting);
router.patch('/:jid/toggle-auto-reply', validate(toggleAutoReplySchema), ChatController.toggleAutoReply);

module.exports = router;
