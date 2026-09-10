const { query } = require('../config/database');

const TemplateModel = {
  async create(userId, { name, content }) {
    const text = `
      INSERT INTO templates (user_id, name, content)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, name, content, created_at, updated_at
    `;
    const { rows } = await query(text, [userId, name.trim(), content.trim()]);
    return rows[0];
  },

  async findById(id, userId) {
    const text = `
      SELECT id, user_id, name, content, created_at, updated_at
      FROM templates
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async findByName(userId, name) {
    const text = `
      SELECT id, user_id, name, content, created_at, updated_at
      FROM templates
      WHERE user_id = $1 AND name = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, name.trim()]);
    return rows[0] || null;
  },

  async update(id, userId, { name, content }) {
    let updateFields = [];
    let values = [id, userId];
    let paramIndex = 3;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (content !== undefined) {
      updateFields.push(`content = $${paramIndex}`);
      values.push(content.trim());
      paramIndex++;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const text = `
      UPDATE templates
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, name, content, created_at, updated_at
    `;
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async delete(id, userId) {
    const text = `
      DELETE FROM templates
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async getAllByUser(userId, { search = '', limit = 50, offset = 0 } = {}) {
    let filterClause = 'WHERE user_id = $1';
    let params = [userId];
    let paramIndex = 2;

    if (search) {
      filterClause += ` AND (name ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countText = `SELECT COUNT(*) AS total FROM templates ${filterClause}`;
    const countResult = await query(countText, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const listText = `
      SELECT id, user_id, name, content, created_at, updated_at
      FROM templates
      ${filterClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const { rows } = await query(listText, params);
    return { rows, total };
  }
};

module.exports = TemplateModel;
