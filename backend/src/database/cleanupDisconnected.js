const { query } = require('../config/database');
const fs = require('fs');
const path = require('path');

const SESSIONS_BASE_DIR = path.join(__dirname, '../../sessions');

async function cleanDisconnectedData() {
  try {
    const { rows: disconnectedUsers } = await query(`
      SELECT u.id, ws.status, ws.session_name
      FROM users u
      LEFT JOIN whatsapp_sessions ws ON u.id = ws.user_id AND ws.session_name = 'default'
      WHERE ws.status = 'DISCONNECTED' OR ws.status IS NULL
    `);

    for (const u of disconnectedUsers) {
      const sessionDir = path.join(SESSIONS_BASE_DIR, `${u.id}_default`);
      const credsPath = path.join(sessionDir, 'creds.json');
      const hasValidSessionFile = fs.existsSync(credsPath);

      if (!hasValidSessionFile) {
        await query('DELETE FROM messages WHERE user_id = $1', [u.id]);
        await query('DELETE FROM contacts WHERE user_id = $1', [u.id]);
        await query('DELETE FROM call_logs WHERE user_id = $1', [u.id]);
        await query('DELETE FROM chat_ai_settings WHERE user_id = $1', [u.id]);
        await query(
          "UPDATE whatsapp_sessions SET phone_number = NULL, qr_code = NULL, session_data = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND status = 'DISCONNECTED'",
          [u.id]
        );
      }
    }
  } catch (err) {
    console.error('[Cleanup Error]:', err.message);
  }
}

async function cleanExpiredMessages(retentionDays = 30) {
  try {
    const res = await query(
      `DELETE FROM messages 
       WHERE created_at < NOW() - ($1 || ' days')::INTERVAL`,
      [retentionDays]
    );
    if (res.rowCount > 0) {
      console.log(`[Auto Retention Cleanup] ${res.rowCount} pesan yang lebih dari ${retentionDays} hari berhasil dibersihkan.`);
    }
  } catch (err) {
    console.error('[Auto Retention Cleanup Error]:', err.message);
  }
}

module.exports = { 
  cleanDisconnectedData,
  cleanExpiredMessages
};
