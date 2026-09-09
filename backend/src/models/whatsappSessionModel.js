const { query } = require('../config/database');

const WhatsappSessionModel = {
  async getByUserId(userId, sessionName = 'default') {
    const text = `
      SELECT id, user_id, session_name, phone_number, status, session_data, qr_code, created_at, updated_at
      FROM whatsapp_sessions
      WHERE user_id = $1 AND session_name = $2
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, sessionName]);
    return rows[0] || null;
  },

  async getAllByUserId(userId) {
    const text = `
      SELECT id, user_id, session_name, phone_number, status, qr_code, created_at, updated_at
      FROM whatsapp_sessions
      WHERE user_id = $1
      ORDER BY updated_at DESC
    `;
    const { rows } = await query(text, [userId]);
    return rows;
  },

  async getAllActiveSessions() {
    const text = `
      SELECT id, user_id, session_name, phone_number, status, created_at, updated_at
      FROM whatsapp_sessions
      WHERE status = 'CONNECTED'
    `;
    const { rows } = await query(text);
    return rows;
  },

  async upsert(userId, { sessionName = 'default', phoneNumber = null, status = 'DISCONNECTED', qrCode = null, sessionData = null }) {
    const text = `
      INSERT INTO whatsapp_sessions (user_id, session_name, phone_number, status, qr_code, session_data, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, session_name)
      DO UPDATE SET
        phone_number = COALESCE(EXCLUDED.phone_number, whatsapp_sessions.phone_number),
        status = EXCLUDED.status,
        qr_code = EXCLUDED.qr_code,
        session_data = COALESCE(EXCLUDED.session_data, whatsapp_sessions.session_data),
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, session_name, phone_number, status, qr_code, created_at, updated_at
    `;
    const values = [userId, sessionName, phoneNumber, status, qrCode, sessionData ? JSON.stringify(sessionData) : null];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async updateStatus(userId, status, { phoneNumber = null, qrCode = null, sessionName = 'default' } = {}) {
    const text = `
      UPDATE whatsapp_sessions
      SET status = $1,
          phone_number = CASE WHEN $2::text IS NOT NULL THEN $2::text ELSE phone_number END,
          qr_code = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $4 AND session_name = $5
      RETURNING id, user_id, session_name, phone_number, status, qr_code, updated_at
    `;
    const values = [status, phoneNumber, qrCode, userId, sessionName];
    const { rows } = await query(text, values);
    return rows[0] || null;
  },

  async delete(userId, sessionName = 'default') {
    const text = `
      DELETE FROM whatsapp_sessions
      WHERE user_id = $1 AND session_name = $2
      RETURNING id
    `;
    const { rows } = await query(text, [userId, sessionName]);
    return rows[0] || null;
  }
};

module.exports = WhatsappSessionModel;
