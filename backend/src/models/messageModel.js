const { query } = require('../config/database');

const MessageModel = {
  async create({ conversationId, direction, type = 'text', content, whatsappMessageId = null, status = 'PENDING', sentAt = null }) {
    const text = `
      INSERT INTO messages (conversation_id, direction, type, content, whatsapp_message_id, status, sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, conversation_id, direction, type, content, whatsapp_message_id, status, sent_at, delivered_at, read_at, created_at
    `;
    const values = [conversationId, direction, type, content, whatsappMessageId, status, sentAt];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async updateStatusByWhatsappId(whatsappMessageId, status, timestamp = new Date()) {
    let updateFields = 'status = $1';
    const values = [status, whatsappMessageId];

    if (status === 'SENT') {
      updateFields += ', sent_at = $3';
      values.push(timestamp);
    } else if (status === 'DELIVERED') {
      updateFields += ', delivered_at = $3';
      values.push(timestamp);
    } else if (status === 'READ') {
      updateFields += ', read_at = $3';
      values.push(timestamp);
    }

    const text = `
      UPDATE messages
      SET ${updateFields}
      WHERE whatsapp_message_id = $2
      RETURNING id, conversation_id, direction, type, content, whatsapp_message_id, status, sent_at, delivered_at, read_at, created_at
    `;
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async getByConversationId(conversationId, limit = 50, offset = 0) {
    const text = `
      SELECT id, conversation_id, direction, type, content, whatsapp_message_id, status, sent_at, delivered_at, read_at, created_at
      FROM messages
      WHERE conversation_id = $1
      ORDER BY created_at ASC
      LIMIT $2 OFFSET $3
    `;
    const { rows } = await query(text, [conversationId, limit, offset]);
    return rows;
  },

  async getAllByUser(userId, { limit = 50, offset = 0, status, direction } = {}) {
    let filterClause = 'WHERE c.user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      filterClause += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (direction) {
      filterClause += ` AND m.direction = $${paramIndex}`;
      params.push(direction);
      paramIndex++;
    }

    const text = `
      SELECT m.id, m.conversation_id, m.direction, m.type, m.content, m.whatsapp_message_id, m.status, 
             m.sent_at, m.delivered_at, m.read_at, m.created_at,
             ct.name AS contact_name, ct.phone AS contact_phone
      FROM messages m
      JOIN conversations c ON m.conversation_id = c.id
      JOIN contacts ct ON c.contact_id = ct.id
      ${filterClause}
      ORDER BY m.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const { rows } = await query(text, params);
    return rows;
  }
};

module.exports = MessageModel;
