const { query } = require('../config/database');

const ConversationModel = {
  async findOrCreate(userId, contactId) {
    const findText = `
      SELECT id, user_id, contact_id, status, last_message_at, created_at, updated_at
      FROM conversations
      WHERE user_id = $1 AND contact_id = $2
      LIMIT 1
    `;
    const findResult = await query(findText, [userId, contactId]);
    if (findResult.rows.length > 0) {
      return findResult.rows[0];
    }

    const insertText = `
      INSERT INTO conversations (user_id, contact_id, status, last_message_at)
      VALUES ($1, $2, 'ACTIVE', CURRENT_TIMESTAMP)
      RETURNING id, user_id, contact_id, status, last_message_at, created_at, updated_at
    `;
    const insertResult = await query(insertText, [userId, contactId]);
    return insertResult.rows[0];
  },

  async updateLastMessage(conversationId) {
    const text = `
      UPDATE conversations
      SET last_message_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, user_id, contact_id, status, last_message_at, updated_at
    `;
    const { rows } = await query(text, [conversationId]);
    return rows[0] || null;
  },

  async getById(id, userId) {
    const text = `
      SELECT c.id, c.user_id, c.contact_id, c.status, c.last_message_at, c.created_at, c.updated_at,
             ct.name AS contact_name, ct.phone AS contact_phone, ct.email AS contact_email
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.id = $1 AND c.user_id = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async getAllByUser(userId) {
    const text = `
      SELECT c.id, c.user_id, c.contact_id, c.status, c.last_message_at, c.created_at, c.updated_at,
             ct.name AS contact_name, ct.phone AS contact_phone, ct.email AS contact_email,
             (
               SELECT content FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.created_at DESC LIMIT 1
             ) AS last_message_content,
             (
               SELECT status FROM messages m 
               WHERE m.conversation_id = c.id 
               ORDER BY m.created_at DESC LIMIT 1
             ) AS last_message_status
      FROM conversations c
      JOIN contacts ct ON c.contact_id = ct.id
      WHERE c.user_id = $1
      ORDER BY c.last_message_at DESC
    `;
    const { rows } = await query(text, [userId]);
    return rows;
  }
};

module.exports = ConversationModel;
