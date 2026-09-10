const { query } = require('../config/database');

const SendingJobModel = {
  async create(userId, { phone, message, repeatCount = 1, intervalSeconds = 30 }) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = `
      INSERT INTO sending_jobs (user_id, phone, message, repeat_count, completed_count, interval_seconds, status)
      VALUES ($1, $2, $3, $4, 0, $5, 'PENDING')
      RETURNING id, user_id, phone, message, repeat_count, completed_count, interval_seconds, status, started_at, completed_at, created_at, updated_at
    `;
    const { rows } = await query(text, [userId, cleanPhone, message.trim(), repeatCount, intervalSeconds]);
    return rows[0];
  },

  async findById(id, userId) {
    const text = `
      SELECT id, user_id, phone, message, repeat_count, completed_count, interval_seconds, status, started_at, completed_at, created_at, updated_at
      FROM sending_jobs
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async updateStatus(id, userId, status, { startedAt, completedAt } = {}) {
    let updateFields = ['status = $3', 'updated_at = CURRENT_TIMESTAMP'];
    let values = [id, userId, status];
    let paramIndex = 4;

    if (startedAt !== undefined) {
      updateFields.push(`started_at = $${paramIndex}`);
      values.push(startedAt);
      paramIndex++;
    }

    if (completedAt !== undefined) {
      updateFields.push(`completed_at = $${paramIndex}`);
      values.push(completedAt);
      paramIndex++;
    }

    const text = `
      UPDATE sending_jobs
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, phone, message, repeat_count, completed_count, interval_seconds, status, started_at, completed_at, created_at, updated_at
    `;
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async incrementCompletedCount(id, userId) {
    const text = `
      UPDATE sending_jobs
      SET completed_count = completed_count + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, phone, message, repeat_count, completed_count, interval_seconds, status, started_at, completed_at, created_at, updated_at
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async delete(id, userId) {
    const text = `
      DELETE FROM sending_jobs
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async getAllByUser(userId, { status, limit = 50, offset = 0 } = {}) {
    let filterClause = 'WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (status) {
      filterClause += ` AND status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    const countText = `SELECT COUNT(*) AS total FROM sending_jobs ${filterClause}`;
    const countResult = await query(countText, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const listText = `
      SELECT id, user_id, phone, message, repeat_count, completed_count, interval_seconds, status, started_at, completed_at, created_at, updated_at
      FROM sending_jobs
      ${filterClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const { rows } = await query(listText, params);
    return { rows, total };
  }
};

module.exports = SendingJobModel;
