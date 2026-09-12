const { query } = require('../config/database');

const ChatAiSettingModel = {
  async getByJid(userId, jid) {
    const text = `
      SELECT id, user_id, jid, auto_reply_enabled, custom_prompt, tone, notes, created_at, updated_at
      FROM chat_ai_settings
      WHERE user_id = $1 AND jid = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, jid]);
    return rows[0] || null;
  },

  async getAllByUser(userId) {
    const text = `
      SELECT id, user_id, jid, auto_reply_enabled, custom_prompt, tone, notes, created_at, updated_at
      FROM chat_ai_settings
      WHERE user_id = $1
    `;
    const { rows } = await query(text, [userId]);
    return rows;
  },

  async upsert(userId, jid, { autoReplyEnabled, customPrompt, tone = 'friendly', notes = '' }) {
    const text = `
      INSERT INTO chat_ai_settings (user_id, jid, auto_reply_enabled, custom_prompt, tone, notes, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, jid)
      DO UPDATE SET
        auto_reply_enabled = EXCLUDED.auto_reply_enabled,
        custom_prompt = EXCLUDED.custom_prompt,
        tone = EXCLUDED.tone,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, jid, auto_reply_enabled, custom_prompt, tone, notes, created_at, updated_at
    `;
    const values = [userId, jid, autoReplyEnabled, customPrompt, tone, notes];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async toggleAutoReply(userId, jid, enabled) {
    const text = `
      INSERT INTO chat_ai_settings (user_id, jid, auto_reply_enabled, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, jid)
      DO UPDATE SET
        auto_reply_enabled = EXCLUDED.auto_reply_enabled,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, jid, auto_reply_enabled, custom_prompt, tone, notes, created_at, updated_at
    `;
    const { rows } = await query(text, [userId, jid, enabled]);
    return rows[0];
  }
};

module.exports = ChatAiSettingModel;
