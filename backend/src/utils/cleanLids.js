require('dotenv').config();
const { query } = require('../config/database');

async function cleanInvalidData() {
  try {
    console.log('[Cleanup] Starting removal of invalid LID entries and broken groups...');
    
    // 1. Delete LID contacts
    const resLid = await query(`
      DELETE FROM contacts 
      WHERE jid LIKE '%@lid' 
         OR phone LIKE '%@lid' 
         OR phone = '0' 
         OR jid = '0@s.whatsapp.net' 
         OR (LENGTH(phone) > 16 AND phone NOT LIKE '%@g.us' AND (jid IS NULL OR jid NOT LIKE '%@g.us'))
    `);
    console.log(`[Cleanup] Deleted ${resLid.rowCount} invalid contact entries.`);

    // 2. Delete messages with LID
    const resMsg = await query(`
      DELETE FROM messages 
      WHERE remote_jid LIKE '%@lid' 
         OR phone LIKE '%@lid'
    `);
    console.log(`[Cleanup] Deleted ${resMsg.rowCount} invalid message entries.`);

    console.log('[Cleanup] Completed successfully.');
  } catch (err) {
    console.error('[Cleanup Error]:', err.message);
  }
}

if (require.main === module) {
  cleanInvalidData().then(() => process.exit(0));
}

module.exports = { cleanInvalidData };
