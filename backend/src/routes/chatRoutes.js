const express = require('express');
const router = express.Router();
const ChatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// Conversations & Messages
router.get('/', ChatController.getChats);
router.post('/sync', ChatController.syncChats);
router.get('/:jid/messages', ChatController.getChatMessages);
router.post('/send', ChatController.sendMessage);

// AI Copilot Actions
router.post('/ai/smart-suggestions', ChatController.getSmartSuggestions);
router.post('/ai/summarize', ChatController.summarizeChat);
router.post('/ai/rewrite', ChatController.rewriteMessage);

// AI Settings & Auto-Reply per Chat
router.get('/:jid/ai-setting', ChatController.getAiSetting);
router.put('/:jid/ai-setting', ChatController.updateAiSetting);
router.patch('/:jid/toggle-auto-reply', ChatController.toggleAutoReply);

// Stories & Calls
router.get('/media/stories', ChatController.getStories);
router.get('/logs/calls', ChatController.getCallLogs);

module.exports = router;
