const ContactModel = require('../models/contactModel');
const MessageModel = require('../models/messageModel');
const ChatAiSettingModel = require('../models/chatAiSettingModel');
const StoryModel = require('../models/storyModel');
const CallLogModel = require('../models/callLogModel');
const WhatsappService = require('../services/whatsappService');
const aiService = require('../services/aiService');

const ChatController = {
  // Get all active chats (conversations) with search & filter
  async getChats(req, res, next) {
    try {
      const { search = '', filter = 'all' } = req.query;
      const chats = await ContactModel.getChatsList(req.user.id, { search, filter });
      
      res.status(200).json({
        success: true,
        data: chats
      });
    } catch (error) {
      next(error);
    }
  },

  // Get messages for a specific chat/jid
  async getChatMessages(req, res, next) {
    try {
      const { jid } = req.params;
      const { limit = 100, offset = 0 } = req.query;

      // Reset unread counter for this chat
      await ContactModel.resetUnread(req.user.id, jid);

      const messages = await MessageModel.getByChatJid(
        req.user.id,
        jid,
        parseInt(limit, 10),
        parseInt(offset, 10)
      );

      const contact = await ContactModel.findByJid(req.user.id, jid);
      const aiSetting = await ChatAiSettingModel.getByJid(req.user.id, jid);

      res.status(200).json({
        success: true,
        data: {
          jid,
          contact,
          aiSetting,
          messages
        }
      });
    } catch (error) {
      next(error);
    }
  },

  // Send a real-time message to a chat
  async sendMessage(req, res, next) {
    try {
      const { jid, message, sessionName = 'default' } = req.body;

      if (!jid || !message || message.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'JID penerima dan isi pesan wajib diisi'
        });
      }

      const result = await WhatsappService.sendChatMessage(req.user.id, {
        jid,
        text: message,
        sessionName
      });

      res.status(200).json({
        success: true,
        message: 'Pesan terkirim!',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  // AI: Get 3 Smart Reply Suggestions
  async getSmartSuggestions(req, res, next) {
    try {
      const { jid } = req.body;
      if (!jid) {
        return res.status(400).json({ success: false, message: 'JID diperlukan' });
      }

      const chatHistory = await MessageModel.getRecentChatContext(req.user.id, jid, 8);
      const lastMsg = chatHistory.length > 0 ? chatHistory[chatHistory.length - 1].content : '';

      const suggestions = await aiService.generateSmartReplies(chatHistory, lastMsg);

      res.status(200).json({
        success: true,
        data: { suggestions }
      });
    } catch (error) {
      next(error);
    }
  },

  // AI: Summarize conversation
  async summarizeChat(req, res, next) {
    try {
      const { jid } = req.body;
      if (!jid) {
        return res.status(400).json({ success: false, message: 'JID diperlukan' });
      }

      const chatHistory = await MessageModel.getRecentChatContext(req.user.id, jid, 25);
      const summary = await aiService.summarizeChat(chatHistory);

      res.status(200).json({
        success: true,
        data: { summary }
      });
    } catch (error) {
      next(error);
    }
  },

  // AI: Rewrite draft message
  async rewriteMessage(req, res, next) {
    try {
      const { text, tone = 'friendly' } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, message: 'Teks pesan diperlukan' });
      }

      const rewritten = await aiService.rewriteMessage(text, tone);

      res.status(200).json({
        success: true,
        data: { rewritten }
      });
    } catch (error) {
      next(error);
    }
  },

  // Get or Update AI Settings for a specific chat
  async getAiSetting(req, res, next) {
    try {
      const { jid } = req.params;
      const setting = await ChatAiSettingModel.getByJid(req.user.id, jid);
      res.status(200).json({
        success: true,
        data: setting || {
          jid,
          auto_reply_enabled: false,
          custom_prompt: '',
          tone: 'friendly',
          notes: ''
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async updateAiSetting(req, res, next) {
    try {
      const { jid } = req.params;
      const { autoReplyEnabled, customPrompt, tone = 'friendly', notes = '' } = req.body;

      const updated = await ChatAiSettingModel.upsert(req.user.id, jid, {
        autoReplyEnabled: !!autoReplyEnabled,
        customPrompt,
        tone,
        notes
      });

      res.status(200).json({
        success: true,
        message: 'Pengaturan AI Chat berhasil disimpan!',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  async toggleAutoReply(req, res, next) {
    try {
      const { jid } = req.params;
      const { enabled } = req.body;

      const updated = await ChatAiSettingModel.toggleAutoReply(req.user.id, jid, !!enabled);

      res.status(200).json({
        success: true,
        message: `Auto-Reply AI ${enabled ? 'Diaktifkan 🤖' : 'Dinonaktifkan'}`,
        data: updated
      });
    } catch (error) {
      next(error);
    }
  },

  // WhatsApp Stories / Status
  async getStories(req, res, next) {
    try {
      const stories = await StoryModel.getRecentStories(req.user.id);
      res.status(200).json({
        success: true,
        data: stories
      });
    } catch (error) {
      next(error);
    }
  },

  // Call Logs
  async getCallLogs(req, res, next) {
    try {
      const calls = await CallLogModel.getAllByUser(req.user.id);
      res.status(200).json({
        success: true,
        data: calls
      });
    } catch (error) {
      next(error);
    }
  },

  // Manual Sync WhatsApp Groups and Active Chats
  async syncChats(req, res, next) {
    try {
      const result = await WhatsappService.syncGroupsAndChats(req.user.id);
      const updatedChats = await ContactModel.getChatsList(req.user.id);
      res.status(200).json({
        success: true,
        message: 'Grup WhatsApp dan daftar chat berhasil disinkronkan!',
        data: {
          syncResult: result,
          chats: updatedChats
        }
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = ChatController;
