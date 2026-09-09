const { query } = require('../config/database');

const MessageModel = {
  async create({ userId, contactId = null, jobId = null, phone, content, direction = 'OUTGOING', status = 'PENDING', sentAt = null }) {
    const text = `
      INSERT INTO messages (user_id, contact_id, job_id, phone, content, direction, status, sent_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id, user_id, contact_id, job_id, phone, content, direction, status, sent_at, created_at
    `;
    const values = [userId, contactId, jobId, phone, content, direction, status, sentAt];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async updateStatus(id, status, sentAt = new Date()) {
    const text = `
      UPDATE messages
      SET status = $1, sent_at = $2
      WHERE id = $3
      RETURNING id, user_id, contact_id, job_id, phone, content, direction, status, sent_at, created_at
    `;
    const values = [status, sentAt, id];
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async getById(id, userId) {
    const text = `
      SELECT m.id, m.user_id, m.contact_id, m.job_id, m.phone, m.content, m.direction, m.status,
             m.sent_at, m.created_at,
             ct.name AS contact_name
      FROM messages m
      LEFT JOIN contacts ct ON m.contact_id = ct.id
      WHERE m.id = $1 AND m.user_id = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async getByContact(userId, contactId, limit = 50, offset = 0) {
    const text = `
      SELECT id, user_id, contact_id, job_id, phone, content, direction, status, sent_at, created_at
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
      SELECT m.id, m.user_id, m.contact_id, m.job_id, m.phone, m.content, m.direction, m.status,
             m.sent_at, m.created_at,
             ct.name AS contact_name
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
      filterClause += ` AND m.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (direction) {
      filterClause += ` AND m.direction = $${paramIndex}`;
      params.push(direction);
      paramIndex++;
    }

    if (phone) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      filterClause += ` AND m.phone = $${paramIndex}`;
      params.push(cleanPhone);
      paramIndex++;
    }

    const text = `
      SELECT m.id, m.user_id, m.contact_id, m.job_id, m.phone, m.content, m.direction, m.status, 
             m.sent_at, m.created_at,
             ct.name AS contact_name
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
