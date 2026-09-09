const { query } = require('../config/database');

const ContactModel = {
  async findOrCreate(userId, { name, phone, email, notes }) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const findText = `
      SELECT id, user_id, name, phone, email, notes, created_at, updated_at
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
          RETURNING id, user_id, name, phone, email, notes, created_at, updated_at
        `;
        const updateResult = await query(updateText, [name, findResult.rows[0].id]);
        return updateResult.rows[0];
      }
      return findResult.rows[0];
    }

    const insertText = `
      INSERT INTO contacts (user_id, name, phone, email, notes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, name, phone, email, notes, created_at, updated_at
    `;
    const insertValues = [userId, name || cleanPhone, cleanPhone, email || null, notes || null];
    const insertResult = await query(insertText, insertValues);
    return insertResult.rows[0];
  },

  async findById(id, userId) {
    const text = `
      SELECT id, user_id, name, phone, email, notes, created_at, updated_at
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
      SELECT id, user_id, name, phone, email, notes, created_at, updated_at
      FROM contacts
      WHERE user_id = $1 AND phone = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, cleanPhone]);
    return rows[0] || null;
  },

  async getAllByUser(userId) {
    const text = `
      SELECT id, user_id, name, phone, email, notes, created_at, updated_at
      FROM contacts
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `;
    const { rows } = await query(text, [userId]);
    return rows;
  }
};

module.exports = ContactModel;
