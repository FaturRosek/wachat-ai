const { query } = require('../config/database');

async function cleanDisconnectedData() {
  try {
    console.log('[Cleanup] Starting cleanup of leftover data for disconnected users...');

    const delContacts = await query(`
      DELETE FROM contacts 
      WHERE user_id IN (
        SELECT u.id FROM users u
        LEFT JOIN whatsapp_sessions ws ON u.id = ws.user_id AND ws.session_name = 'default'
        WHERE ws.status IS NULL OR ws.status != 'CONNECTED'
      )
    `);
    console.log('[Cleanup] Deleted residual contacts:', delContacts.rowCount);

    const delMessages = await query(`
      DELETE FROM messages 
      WHERE user_id IN (
        SELECT u.id FROM users u
        LEFT JOIN whatsapp_sessions ws ON u.id = ws.user_id AND ws.session_name = 'default'
        WHERE ws.status IS NULL OR ws.status != 'CONNECTED'
      )
    `);
    console.log('[Cleanup] Deleted residual messages:', delMessages.rowCount);

    const delCalls = await query(`
      DELETE FROM call_logs 
      WHERE user_id IN (
        SELECT u.id FROM users u
        LEFT JOIN whatsapp_sessions ws ON u.id = ws.user_id AND ws.session_name = 'default'
        WHERE ws.status IS NULL OR ws.status != 'CONNECTED'
      )
    `);
    console.log('[Cleanup] Deleted residual call logs:', delCalls.rowCount);

    const delAi = await query(`
      DELETE FROM chat_ai_settings 
      WHERE user_id IN (
        SELECT u.id FROM users u
        LEFT JOIN whatsapp_sessions ws ON u.id = ws.user_id AND ws.session_name = 'default'
        WHERE ws.status IS NULL OR ws.status != 'CONNECTED'
      )
    `);
    console.log('[Cleanup] Deleted residual AI settings:', delAi.rowCount);

    const resetSessions = await query(`
      UPDATE whatsapp_sessions 
      SET phone_number = NULL, qr_code = NULL, session_data = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE status != 'CONNECTED'
    `);
    console.log('[Cleanup] Reset disconnected sessions details:', resetSessions.rowCount);

    console.log('[Cleanup] Cleanup finished successfully.');
  } catch (err) {
    console.error('[Cleanup Error]:', err.message);
  }
}

module.exports = { cleanDisconnectedData };

if (require.main === module) {
  cleanDisconnectedData().then(() => process.exit(0));
}
