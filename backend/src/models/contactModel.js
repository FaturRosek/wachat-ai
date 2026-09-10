const { query } = require('../config/database');

const ContactModel = {
  async create(userId, { name, phone }) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = `
      INSERT INTO contacts (user_id, name, phone)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, name, phone, created_at, updated_at
    `;
    const { rows } = await query(text, [userId, name, cleanPhone]);
    return rows[0];
  },

  async findOrCreate(userId, { name, phone }) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const findText = `
      SELECT id, user_id, name, phone, created_at, updated_at
      FROM contacts
      WHERE user_id = $1 AND phone = $2
      LIMIT 1
    `;
    const findResult = await query(findText, [userId, cleanPhone]);
    if (findResult.rows.length > 0) {
      if (name && findResult.rows[0].name !== name) {
        const updateText = `
          UPDATE contacts
          SET name = $1, updated_at = CURRENT_TIMESTAMP
          WHERE id = $2
          RETURNING id, user_id, name, phone, created_at, updated_at
        `;
        const updateResult = await query(updateText, [name, findResult.rows[0].id]);
        return updateResult.rows[0];
      }
      return findResult.rows[0];
    }

    const insertText = `
      INSERT INTO contacts (user_id, name, phone)
      VALUES ($1, $2, $3)
      RETURNING id, user_id, name, phone, created_at, updated_at
    `;
    const insertValues = [userId, name || cleanPhone, cleanPhone];
    const insertResult = await query(insertText, insertValues);
    return insertResult.rows[0];
  },

  async findById(id, userId) {
    const text = `
      SELECT id, user_id, name, phone, created_at, updated_at
      FROM contacts
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async findByPhone(userId, phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = `
      SELECT id, user_id, name, phone, created_at, updated_at
      FROM contacts
      WHERE user_id = $1 AND phone = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, cleanPhone]);
    return rows[0] || null;
  },

  async update(id, userId, { name, phone }) {
    let updateFields = [];
    let values = [id, userId];
    let paramIndex = 3;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (phone !== undefined) {
      const cleanPhone = phone.replace(/[^0-9]/g, '');
      updateFields.push(`phone = $${paramIndex}`);
      values.push(cleanPhone);
      paramIndex++;
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const text = `
      UPDATE contacts
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING id, user_id, name, phone, created_at, updated_at
    `;
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async delete(id, userId) {
    const text = `
      DELETE FROM contacts
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
      filterClause += ` AND (name ILIKE $${paramIndex} OR phone ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countText = `SELECT COUNT(*) AS total FROM contacts ${filterClause}`;
    const countResult = await query(countText, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const listText = `
      SELECT id, user_id, name, phone, created_at, updated_at
      FROM contacts
      ${filterClause}
      ORDER BY updated_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    params.push(limit, offset);

    const { rows } = await query(listText, params);
    return { rows, total };
  }
};

module.exports = ContactModel;
