const { query } = require('../config/database');

const StoryModel = {
  async create({ userId, senderJid, senderName, senderPhone, caption, mediaType = 'text', mediaUrl = null, storyTimestamp = new Date() }) {
    const text = `
      INSERT INTO whatsapp_stories (user_id, sender_jid, sender_name, sender_phone, caption, media_type, media_url, story_timestamp)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, sender_jid, sender_name, sender_phone, caption, media_type, media_url, story_timestamp, created_at
    `;
    const values = [userId, senderJid, senderName, senderPhone, caption, mediaType, mediaUrl, storyTimestamp];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async getRecentStories(userId) {
    const text = `
      SELECT id, user_id, sender_jid, sender_name, sender_phone, caption, media_type, media_url, story_timestamp, created_at
      FROM whatsapp_stories
      WHERE user_id = $1 AND story_timestamp >= NOW() - INTERVAL '48 hours'
      ORDER BY story_timestamp DESC
    `;
    const { rows } = await query(text, [userId]);
    return rows;
  }
};

module.exports = StoryModel;
