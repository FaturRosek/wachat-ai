const { query } = require('../config/database');

const ContactModel = {
  async create(userId, { name, phone, jid = null, avatarUrl = null, isGroup = false, about = '' }) {
    const isGrp = isGroup || (jid && jid.endsWith('@g.us')) || (phone && phone.endsWith('@g.us'));
    const cleanPhone = isGrp ? (phone || jid) : (phone ? phone.replace(/[^0-9]/g, '') : '');
    const cleanJid = jid || (isGrp ? cleanPhone : `${cleanPhone}@s.whatsapp.net`);

    const text = `
      INSERT INTO contacts (user_id, name, phone, jid, avatar_url, is_group, about)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await query(text, [userId, name || cleanPhone || (isGrp ? 'Grup WhatsApp' : 'Kontak WhatsApp'), cleanPhone, cleanJid, avatarUrl, isGrp, about]);
    return rows[0];
  },

  async upsertGroup(userId, { jid, name, avatarUrl = null, desc = '' }) {
    const text = `
      INSERT INTO contacts (user_id, name, phone, jid, avatar_url, is_group, about, updated_at)
      VALUES ($1, $2, $3, $3, $4, true, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, phone)
      DO UPDATE SET
        name = CASE WHEN EXCLUDED.name IS NOT NULL AND EXCLUDED.name != '' AND EXCLUDED.name != EXCLUDED.phone THEN EXCLUDED.name ELSE contacts.name END,
        jid = EXCLUDED.jid,
        avatar_url = COALESCE(EXCLUDED.avatar_url, contacts.avatar_url),
        is_group = true,
        about = COALESCE(EXCLUDED.about, contacts.about),
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const { rows } = await query(text, [userId, name || 'Grup WhatsApp', jid, avatarUrl, desc]);
    return rows[0];
  },

  async findOrCreate(userId, { name, phone, jid = null, avatarUrl = null, isGroup = false }) {
    const isGrp = isGroup || (jid && jid.endsWith('@g.us')) || (phone && typeof phone === 'string' && phone.endsWith('@g.us'));
    const cleanPhone = isGrp ? (phone || jid) : (phone ? String(phone).replace(/[^0-9]/g, '') : '');
    const cleanJid = jid || (isGrp ? cleanPhone : `${cleanPhone}@s.whatsapp.net`);

    if (cleanJid.includes('@newsletter') || cleanJid.includes('status@broadcast') || cleanJid === '0@s.whatsapp.net') {
      return null;
    }

    const findText = `
      SELECT *
      FROM contacts
      WHERE user_id = $1 AND (jid = $2 OR phone = $3 OR (length($3) >= 8 AND phone = $3))
      LIMIT 1
    `;
    const findResult = await query(findText, [userId, cleanJid, cleanPhone]);
    
    if (findResult.rows.length > 0) {
      const existing = findResult.rows[0];
      let updates = [];
      let vals = [existing.id];
      let pIdx = 2;

      if (name && name !== cleanPhone && existing.name !== name && name !== 'Kontak') {
        updates.push(`name = $${pIdx++}`);
        vals.push(name);
      }
      if (!existing.jid && cleanJid) {
        updates.push(`jid = $${pIdx++}`);
        vals.push(cleanJid);
      }
      if (isGrp && !existing.is_group) {
        updates.push(`is_group = true`);
      }
      if (avatarUrl && existing.avatar_url !== avatarUrl) {
        updates.push(`avatar_url = $${pIdx++}`);
        vals.push(avatarUrl);
      }

      if (updates.length > 0) {
        updates.push(`updated_at = CURRENT_TIMESTAMP`);
        const updateSql = `UPDATE contacts SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
        const updated = await query(updateSql, vals);
        return updated.rows[0];
      }
      return existing;
    }

    const insertText = `
      INSERT INTO contacts (user_id, name, phone, jid, avatar_url, is_group)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const displayName = name || (isGrp ? 'Grup WhatsApp' : `+${cleanPhone}`);
    const insertValues = [userId, displayName, cleanPhone, cleanJid, avatarUrl, isGrp];
    const insertResult = await query(insertText, insertValues);
    return insertResult.rows[0];
  },

  async updateLastMessage(userId, jid, { text, timestamp = new Date(), incrementUnread = false }) {
    const unreadSql = incrementUnread ? 'COALESCE(unread_count, 0) + 1' : 'unread_count';
    const isGrp = jid.endsWith('@g.us');
    const cleanPhone = isGrp ? jid : jid.replace(/[^0-9]/g, '');

    const updateText = `
      UPDATE contacts
      SET
        last_message_text = $1,
        last_message_time = $2,
        unread_count = ${unreadSql},
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3 AND (jid = $4 OR phone = $5 OR (length($5) >= 8 AND (jid LIKE $6 OR phone LIKE $6)))
      RETURNING *
    `;
    const { rows } = await query(updateText, [text, timestamp, userId, jid, cleanPhone, `%${cleanPhone}%`]);
    return rows[0] || null;
  },

  async resetUnread(userId, jid) {
    const isGrp = jid.endsWith('@g.us');
    const cleanPhone = isGrp ? jid : jid.replace(/[^0-9]/g, '');
    const sql = `
      UPDATE contacts
      SET unread_count = 0, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND (jid = $2 OR phone = $3)
      RETURNING *
    `;
    const res = await query(sql, [userId, jid, cleanPhone]);
    return res.rows[0] || null;
  },

  async getChatsList(userId, { search = '', filter = 'all' } = {}) {
    let whereConditions = [
      'c.user_id = $1',
      `(c.jid NOT LIKE '%@lid' AND c.phone NOT LIKE '%@lid')`,
      `c.phone != '0'`,
      `(c.jid IS NULL OR c.jid != '0@s.whatsapp.net')`
    ];
    let params = [userId];
    let pIdx = 2;

    if (search) {
      whereConditions.push(`(c.name ILIKE $${pIdx} OR c.phone ILIKE $${pIdx} OR c.last_message_text ILIKE $${pIdx})`);
      params.push(`%${search}%`);
      pIdx++;
    }

    if (filter === 'unread') {
      whereConditions.push(`COALESCE(c.unread_count, 0) > 0`);
    } else if (filter === 'groups') {
      whereConditions.push(`c.is_group = true`);
    } else if (filter === 'ai') {
      whereConditions.push(`ai.auto_reply_enabled = true`);
    }

    const whereClause = whereConditions.join(' AND ');

    const sql = `
      SELECT 
        c.id, c.user_id, c.name, c.phone, c.jid, c.avatar_url, c.is_group, c.about,
        c.unread_count, c.last_message_text, c.last_message_time, c.created_at, c.updated_at,
        COALESCE(ai.auto_reply_enabled, false) AS auto_reply_enabled,
        ai.custom_prompt, ai.tone, ai.notes
      FROM contacts c
      LEFT JOIN chat_ai_settings ai ON c.user_id = ai.user_id AND (c.jid = ai.jid OR c.phone = ai.jid)
      WHERE ${whereClause}
      ORDER BY 
        (c.last_message_text IS NOT NULL OR c.is_group = true) DESC,
        COALESCE(c.last_message_time, c.updated_at) DESC
    `;

    const { rows } = await query(sql, params);
    return rows;
  },

  async findById(id, userId) {
    const text = `SELECT * FROM contacts WHERE id = $1 AND user_id = $2 LIMIT 1`;
    const { rows } = await query(text, [id, userId]);
    return rows[0] || null;
  },

  async findByJid(userId, jid) {
    const isGrp = jid.endsWith('@g.us');
    const cleanPhone = isGrp ? jid : jid.replace(/[^0-9]/g, '');
    const text = `
      SELECT *
      FROM contacts
      WHERE user_id = $1 AND (jid = $2 OR phone = $3)
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, jid, cleanPhone]);
    return rows[0] || null;
  },

  async findByPhone(userId, phone) {
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const text = `
      SELECT *
      FROM contacts
      WHERE user_id = $1 AND (phone = $2 OR phone = $3)
      LIMIT 1
    `;
    const { rows } = await query(text, [userId, phone, cleanPhone]);
    return rows[0] || null;
  },

  async update(id, userId, { name, phone, avatarUrl, about }) {
    let updateFields = [];
    let values = [id, userId];
    let paramIndex = 3;

    if (name !== undefined) {
      updateFields.push(`name = $${paramIndex++}`);
      values.push(name);
    }
    if (phone !== undefined) {
      const isGrp = phone.endsWith('@g.us');
      const cleanPhone = isGrp ? phone : phone.replace(/[^0-9]/g, '');
      updateFields.push(`phone = $${paramIndex++}`);
      values.push(cleanPhone);
    }
    if (avatarUrl !== undefined) {
      updateFields.push(`avatar_url = $${paramIndex++}`);
      values.push(avatarUrl);
    }
    if (about !== undefined) {
      updateFields.push(`about = $${paramIndex++}`);
      values.push(about);
    }

    updateFields.push(`updated_at = CURRENT_TIMESTAMP`);

    const text = `
      UPDATE contacts
      SET ${updateFields.join(', ')}
      WHERE id = $1 AND user_id = $2
      RETURNING *
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
    let filterClause = "WHERE user_id = $1 AND jid NOT LIKE '%@lid' AND phone NOT LIKE '%@lid'";
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
      SELECT *
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
