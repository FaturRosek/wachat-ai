const { query } = require('../config/database');

const MessageModel = {
  async create({
    userId,
    contactId = null,
    jobId = null,
    phone,
    remoteJid = null,
    messageId = null,
    senderName = null,
    content,
    mediaType = 'text',
    mediaUrl = null,
    mediaCaption = null,
    quotedMessage = null,
    rawData = null,
    direction = 'OUTGOING',
    status = 'PENDING',
    fromMe = false,
    isStatus = false,
    sentAt = null,
  }) {
    const cleanPhone = phone ? phone.replace(/[^0-9]/g, '') : '';
    const cleanJid = remoteJid || (cleanPhone.endsWith('@g.us') ? cleanPhone : `${cleanPhone}@s.whatsapp.net`);

    // Check if messageId already exists for idempotency
    if (messageId) {
      const existCheck = await query(
        'SELECT * FROM messages WHERE user_id = $1 AND message_id = $2 LIMIT 1',
        [userId, messageId]
      );
      if (existCheck.rows.length > 0) {
        return existCheck.rows[0];
      }
    }

    const text = `
      INSERT INTO messages (
        user_id, contact_id, job_id, phone, remote_jid, message_id, sender_name,
        content, media_type, media_url, media_caption, quoted_message, raw_data,
        direction, status, from_me, is_status, sent_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      RETURNING *
    `;
    const values = [
      userId,
      contactId,
      jobId,
      cleanPhone,
      cleanJid,
      messageId,
      senderName,
      content || '',
      mediaType,
      mediaUrl,
      mediaCaption,
      quotedMessage ? JSON.stringify(quotedMessage) : null,
      rawData ? JSON.stringify(rawData) : null,
      direction,
      status,
      fromMe,
      isStatus,
      sentAt,
    ];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async updateStatus(id, status, sentAt = new Date()) {
    const text = `
      UPDATE messages
      SET status = $1, sent_at = $2
      WHERE id = $3
      RETURNING *
    `;
    const values = [status, sentAt, id];
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async updateStatusByMessageId(userId, messageId, status) {
    const text = `
      UPDATE messages
      SET status = $1
      WHERE user_id = $2 AND message_id = $3
      RETURNING *
    `;
    const { rows } = await query(text, [status, userId, messageId]);
    return rows[0] || null;
  },

  async getById(id, userId) {
    const text = `
      SELECT m.*, ct.name AS contact_name
      FROM messages m
      LEFT JOIN contacts ct ON m.contact_id = ct.id
      WHERE m.id = $1 AND m.user_id = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async getByChatJid(userId, jid, limit = 100, offset = 0) {
    const cleanPhone = jid.replace(/[^0-9]/g, '');
    const text = `
      SELECT m.*, ct.name AS contact_name, ct.avatar_url AS contact_avatar
      FROM messages m
      LEFT JOIN contacts ct ON m.contact_id = ct.id
      WHERE m.user_id = $1 AND (m.remote_jid = $2 OR m.phone = $3)
      ORDER BY m.created_at ASC
      LIMIT $4 OFFSET $5
    `;
    const { rows } = await query(text, [userId, jid, cleanPhone, limit, offset]);
    return rows;
  },

  async getRecentChatContext(userId, jid, count = 10) {
    const cleanPhone = jid.replace(/[^0-9]/g, '');
    const text = `
      SELECT direction, sender_name, content, created_at, from_me
      FROM messages
      WHERE user_id = $1 AND (remote_jid = $2 OR phone = $3)
      ORDER BY created_at DESC
      LIMIT $4
    `;
    const { rows } = await query(text, [userId, jid, cleanPhone, count]);
    return rows.reverse();
  },

  async getByContact(userId, contactId, limit = 50, offset = 0) {
    const text = `
      SELECT *
      FROM messages
      WHERE user_id = $1 AND contact_id = $2
      ORDER BY created_at ASC
      LIMIT $3 OFFSET $4
    `;
    const { rows } = await query(text, [userId, contactId, limit, offset]);
    return rows;
  },

  async getByPhone(userId, phone, limit = 50, offset = 0) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = `
      SELECT m.*, ct.name AS contact_name
      FROM messages m
      LEFT JOIN contacts ct ON m.contact_id = ct.id
      WHERE m.user_id = $1 AND m.phone = $2
      ORDER BY m.created_at ASC
      LIMIT $3 OFFSET $4
    `;
    const { rows } = await query(text, [userId, cleanPhone, limit, offset]);
    return rows;
  },

  async getAllByUser(userId, { limit = 50, offset = 0, status, direction, phone } = {}) {
    let filterClause = 'WHERE m.user_id = $1';
    const params = [userId];
    let paramIndex = 2;

    if (status) {
      filterClause += ` AND m.status = $${paramIndex++}`;
      params.push(status);
    }

    if (direction) {
      filterClause += ` AND m.direction = $${paramIndex++}`;
      params.push(direction);
    }

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      filterClause += ` AND (m.phone = $${paramIndex} OR m.remote_jid = $${paramIndex})`;
      params.push(cleanPhone);
      paramIndex++;
    }

    const text = `
      SELECT m.*, ct.name AS contact_name
      FROM messages m
      LEFT JOIN contacts ct ON m.contact_id = ct.id
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
