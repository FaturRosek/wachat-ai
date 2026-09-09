const { query } = require('../config/database');

const WhatsappAccountModel = {
  async getByUserId(userId) {
    const text = `
      SELECT id, user_id, phone_number, business_account_id, phone_number_id, access_token, status, created_at, updated_at
      FROM whatsapp_accounts
      WHERE user_id = $1
      LIMIT 1
    `;
    const { rows } = await query(text, [userId]);
    return rows[0] || null;
  },

  async getByPhoneNumberId(phoneNumberId) {
    const text = `
      SELECT id, user_id, phone_number, business_account_id, phone_number_id, access_token, status, created_at, updated_at
      FROM whatsapp_accounts
      WHERE phone_number_id = $1
      LIMIT 1
    `;
    const { rows } = await query(text, [phoneNumberId]);
    return rows[0] || null;
  },

  async getFirstActiveAccount() {
    const text = `
      SELECT id, user_id, phone_number, business_account_id, phone_number_id, access_token, status, created_at, updated_at
      FROM whatsapp_accounts
      WHERE status = 'CONNECTED'
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    const { rows } = await query(text);
    return rows[0] || null;
  },

  async upsert(userId, { phoneNumber, businessAccountId, phoneNumberId, accessToken, status = 'CONNECTED' }) {
    const text = `
      INSERT INTO whatsapp_accounts (user_id, phone_number, business_account_id, phone_number_id, access_token, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id)
      DO UPDATE SET
        phone_number = EXCLUDED.phone_number,
        business_account_id = EXCLUDED.business_account_id,
        phone_number_id = EXCLUDED.phone_number_id,
        access_token = EXCLUDED.access_token,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, phone_number, business_account_id, phone_number_id, status, created_at, updated_at
    `;
    const values = [userId, phoneNumber, businessAccountId, phoneNumberId, accessToken, status];
    const { rows } = await query(text, values);
    return rows[0];
  },

  async updateStatus(userId, status) {
    const text = `
      UPDATE whatsapp_accounts
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
      RETURNING id, user_id, phone_number, status, updated_at
    `;
    const { rows } = await query(text, [status, userId]);
    return rows[0] || null;
  }
};

module.exports = WhatsappAccountModel;
