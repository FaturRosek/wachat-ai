const axios = require('axios');
const { formatPhoneNumber } = require('../utils/phoneValidator');

class AiService {
  constructor() {
    this.geminiApiKey = process.env.GEMINI_API_KEY || '';
    this.openaiApiKey = process.env.OPENAI_API_KEY || '';
    this.provider = process.env.AI_PROVIDER || 'gemini';
    this.model = process.env.AI_MODEL || (this.provider === 'openai' ? 'gpt-4o-mini' : 'gemini-2.5-flash');
  }

  getSystemInstruction() {
    return `Anda adalah asisten AI WhatsApp Outbound Dispatcher.
Tugas Anda adalah membedah instruksi pesan dari Admin WhatsApp dan menghasilkan format JSON terstruktur untuk dikirimkan ke nomor tujuan.

ATURAN PARSING:
1. Ekstraksi nomor HP tujuan (misal 0819203344, +62812345, 628xxx). Formatkan menjadi nomor murni dengan awalan 62 (contoh: "62819203344").
2. Ekstraksi jumlah pengiriman (count / repetisi). Jika tidak disebutkan jumlahnya, default = 1. Maksimal 20 pesan.
3. Ekstraksi interval detik antar pesan (intervalSeconds). Jika tidak disebutkan, default = 5 detik.
4. Buat daftar pesan (array of strings 'messages') sebanyak 'count':
   - Jika pengguna meminta pesan maaf / sapaan / promosi / pengingat, buatkan kalimat yang natural, ramah, dan manusiawi.
   - Jika pengguna meminta variasi kata atau repetisi > 1, buatlah variasi kalimat yang berbeda-beda namun dengan maksud yang sama.
   - Jika pengguna memberikan teks spesifik di dalam tanda kutip, gunakan teks tersebut.
5. Tentukan action:
   - "SEND_DISPATCH": Jika ada nomor tujuan dan instruksi pesan.
   - "HELP": Jika admin bertanya bantuan / menu / panduan.
   - "STATUS": Jika admin mengecek status sistem.
   - "CHAT": Percakapan santai non-dispatch.

FORMAT OUTPUT WAJIB JSON MURNI:
{
  "action": "SEND_DISPATCH",
  "targetPhone": "62819203344",
  "count": 5,
  "intervalSeconds": 5,
  "messages": ["Pesan 1", "Pesan 2", "..."],
  "summary": "Mengirim 5 pesan ke 62819203344",
  "replyToAdmin": "🚀 *Memulai Pengiriman Pesan*\\n• Target: 62819203344\\n• Jumlah: 5 pesan\\n• Jeda: 5s per pesan"
}`;
  }

  async _callGeminiRaw(prompt, systemInstruction = null, jsonMode = true) {
    const apiKey = process.env.GEMINI_API_KEY || this.geminiApiKey;
    if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

    const modelName = process.env.AI_MODEL || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const contents = [];
    if (systemInstruction) {
      contents.push({ role: 'user', parts: [{ text: `${systemInstruction}\n\n${prompt}` }] });
    } else {
      contents.push({ role: 'user', parts: [{ text: prompt }] });
    }

    const payload = {
      contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.95,
        maxOutputTokens: 2048,
        ...(jsonMode ? { responseMimeType: 'application/json' } : {})
      }
    };

    const response = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 20000
    });

    const candidates = response.data?.candidates;
    if (!candidates || candidates.length === 0) {
      throw new Error('No candidate response from Gemini API');
    }

    const rawText = candidates[0].content?.parts?.[0]?.text || '';
    return jsonMode ? this._cleanJsonString(rawText) : rawText.trim();
  }

  async _callOpenAIRaw(prompt, systemInstruction = null, jsonMode = true) {
    const apiKey = process.env.OPENAI_API_KEY || this.openaiApiKey;
    if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');

    const modelName = process.env.AI_MODEL || 'gpt-4o-mini';
    const url = 'https://api.openai.com/v1/chat/completions';

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model: modelName,
      messages,
      temperature: 0.7,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      timeout: 25000
    });

    const content = response.data?.choices?.[0]?.message?.content || '';
    return jsonMode ? this._cleanJsonString(content) : content.trim();
  }

  _cleanJsonString(str) {
    let clean = str.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    return JSON.parse(clean);
  }

  async generateSmartReplies(chatHistory = [], lastMessage = '') {
    const historyText = chatHistory
      .slice(-6)
      .map((m) => `${m.from_me || m.direction === 'OUTGOING' ? 'Saya' : 'Lawan Bicara'}: ${m.content}`)
      .join('\n');

    const prompt = `Berikut riwayat percakapan WhatsApp terkini:
${historyText}

Pesan Terakhir yang diterima: "${lastMessage}"

Berikan 3 rekomendasi balasan pesan instan yang singkat, natural, ramah, dan sangat relevan dalam bahasa Indonesia.
Format output JSON murni:
{
  "suggestions": [
    "Opsi balasan 1",
    "Opsi balasan 2",
    "Opsi balasan 3"
  ]
}`;

    try {
      if (process.env.GEMINI_API_KEY || this.geminiApiKey) {
        const res = await this._callGeminiRaw(prompt, 'Anda adalah AI WhatsApp Assistant.');
        if (res.suggestions && Array.isArray(res.suggestions)) return res.suggestions.slice(0, 3);
      } else if (process.env.OPENAI_API_KEY || this.openaiApiKey) {
        const res = await this._callOpenAIRaw(prompt, 'Anda adalah AI WhatsApp Assistant.');
        if (res.suggestions && Array.isArray(res.suggestions)) return res.suggestions.slice(0, 3);
      }
    } catch (e) {
      console.warn('[AI Service] Smart replies generation failed:', e.message);
    }

    // Fallback smart replies
    return [
      'Siap, baik kak 👍',
      'Terima kasih infonya, akan segera saya cek.',
      'Ada yang bisa saya bantu lagi?'
    ];
  }

  async summarizeChat(chatHistory = []) {
    if (!chatHistory || chatHistory.length === 0) {
      return 'Belum ada riwayat percakapan untuk dirangkum.';
    }

    const conversation = chatHistory
      .map((m) => `${m.from_me || m.direction === 'OUTGOING' ? 'Saya' : (m.sender_name || 'Kontak')}: ${m.content}`)
      .join('\n');

    const prompt = `Rangkum riwayat percakapan WhatsApp berikut secara singkat, padat, dan jelas menggunakan poin-poin (bullet points):
${conversation}

Format JSON:
{
  "summary": "Rangkuman dalam bentuk teks markdown..."
}`;

    try {
      if (process.env.GEMINI_API_KEY || this.geminiApiKey) {
        const res = await this._callGeminiRaw(prompt);
        if (res.summary) return res.summary;
      } else if (process.env.OPENAI_API_KEY || this.openaiApiKey) {
        const res = await this._callOpenAIRaw(prompt);
        if (res.summary) return res.summary;
      }
    } catch (e) {
      console.warn('[AI Service] Summarize failed:', e.message);
    }

    return `📌 **Ringkasan Singkat:** Percakapan terdiri dari ${chatHistory.length} pesan terkait interaksi terkini.`;
  }

  async rewriteMessage(draftText, tone = 'friendly') {
    if (!draftText || draftText.trim() === '') return draftText;

    const toneInstructions = {
      formal: 'Sopan, profesional, baku, dan resmi untuk bisnis/kantor.',
      friendly: 'Ramah, santai, akrab, hangat dengan sedikit emoji yang relevan.',
      persuasive: 'Menarik, meyakinkan untuk penawaran / promosi / sales closing.',
      short: 'Sangat singkat, padat, to the point tanpa basa-basi.'
    };

    const instruction = toneInstructions[tone] || toneInstructions.friendly;

    const prompt = `Tulis ulang pesan WhatsApp berikut dengan gaya bahasa: ${instruction}
Teks asli: "${draftText}"

Format JSON:
{
  "rewritten": "Hasil teks yang telah ditulis ulang"
}`;

    try {
      if (process.env.GEMINI_API_KEY || this.geminiApiKey) {
        const res = await this._callGeminiRaw(prompt);
        if (res.rewritten) return res.rewritten;
      } else if (process.env.OPENAI_API_KEY || this.openaiApiKey) {
        const res = await this._callOpenAIRaw(prompt);
        if (res.rewritten) return res.rewritten;
      }
    } catch (e) {
      console.warn('[AI Service] Rewrite failed:', e.message);
    }

    return draftText;
  }

  async generateAutoReply(customPrompt, chatHistory = [], incomingMessage = '', contactName = 'Customer') {
    const historyText = chatHistory
      .slice(-6)
      .map((m) => `${m.from_me || m.direction === 'OUTGOING' ? 'Bot/Saya' : contactName}: ${m.content}`)
      .join('\n');

    const systemPrompt = customPrompt || 
      `Anda adalah asisten WhatsApp cerdas dan ramah. Jawab pesan ${contactName} dengan sopan, natural, informatif, dan tidak terlalu panjang (1-3 kalimat).`;

    const userPrompt = `Riwayat percakapan:\n${historyText}\n\nPesan baru dari ${contactName}: "${incomingMessage}"\n\nTuliskan balasan balasan chat yang tepat:\nFormat JSON:\n{ "reply": "Isi balasan chat" }`;

    try {
      if (process.env.GEMINI_API_KEY || this.geminiApiKey) {
        const res = await this._callGeminiRaw(userPrompt, systemPrompt);
        if (res.reply) return res.reply;
      } else if (process.env.OPENAI_API_KEY || this.openaiApiKey) {
        const res = await this._callOpenAIRaw(userPrompt, systemPrompt);
        if (res.reply) return res.reply;
      }
    } catch (e) {
      console.warn('[AI Service] Auto-reply generation failed:', e.message);
    }

    return `Halo kak ${contactName}, terima kasih pesannya telah kami terima. Akan segera kami respon secepatnya ya! 😊`;
  }

  async generateVariations(originalText, count = 5) {
    if (!originalText || typeof originalText !== 'string' || originalText.trim() === '') {
      return Array(count).fill('Halo!');
    }

    const cleanBase = originalText.trim();
    const prompt = `Anda adalah asisten WhatsApp profesional. Buatkan ${count} variasi pesan chat yang ramah, santun, dan natural dalam bahasa Indonesia berdasarkan pesan dasar: "${cleanBase}".
Format JSON: { "variations": ["variasi 1", "variasi 2"] }`;

    try {
      if (process.env.GEMINI_API_KEY || this.geminiApiKey) {
        const res = await this._callGeminiRaw(prompt);
        if (res.variations && Array.isArray(res.variations)) return res.variations.slice(0, count);
      } else if (process.env.OPENAI_API_KEY || this.openaiApiKey) {
        const res = await this._callOpenAIRaw(prompt);
        if (res.variations && Array.isArray(res.variations)) return res.variations.slice(0, count);
      }
    } catch (e) {
      console.warn('[AI Service] AI variation failed:', e.message);
    }

    return Array(count).fill(cleanBase);
  }

  async parseAndGenerate(promptText) {
    try {
      if (process.env.OPENAI_API_KEY || this.openaiApiKey) {
        return await this._callOpenAIRaw(promptText, this.getSystemInstruction());
      }
      if (process.env.GEMINI_API_KEY || this.geminiApiKey) {
        return await this._callGeminiRaw(promptText, this.getSystemInstruction());
      }
    } catch (e) {
      console.warn('[AI Service] AI parse failed, using fallback rule parser:', e.message);
    }
    return this._fallbackRuleParser(promptText);
  }

  _fallbackRuleParser(text) {
    const raw = text.trim();
    const groupMatch = raw.match(/[0-9]{15,25}@g\.us/i);
    const phoneMatch = raw.match(/(?:(?:\+?62)|0)8[0-9]{7,13}/g);
    let targetPhone = groupMatch ? groupMatch[0] : null;

    if (!targetPhone && phoneMatch && phoneMatch.length > 0) {
      const formatted = formatPhoneNumber(phoneMatch[0]);
      if (formatted.isValid) {
        targetPhone = formatted.formattedPhone;
      }
    }

    const countMatch = raw.match(/(\d+)\s*(?:kali|x|pesan)/i) || raw.match(/sebanyak\s*(\d+)/i);
    const count = countMatch ? Math.min(Math.max(parseInt(countMatch[1], 10), 1), 50) : 1;

    const intervalMatch = raw.match(/jeda\s*(\d+)\s*(?:detik|s)?/i) || raw.match(/interval\s*(\d+)/i);
    const intervalSeconds = intervalMatch ? Math.max(parseInt(intervalMatch[1], 10), 1) : 5;

    if (/^(help|bantuan|menu|panduan)/i.test(raw)) {
      return {
        action: 'HELP',
        replyToAdmin: `🤖 *Panduan Perintah WaChat AI*\n\nContoh instruksi:\n• _"Kirim pesan maaf sebanyak 5x ke 0819203344"_\n• _"Kirim halo ke 08123456789 jeda 5 detik"_\n• _"Kirim pengingat tagihan ke 08571234567 3 kali"_`
      };
    }

    if (/^(status|cek status|laporan)/i.test(raw)) {
      return {
        action: 'STATUS',
        replyToAdmin: `📊 *Status Sistem WaChat AI*\n• Server Bot: Aktif 🟢\n• Engine: ${this.provider.toUpperCase()} (${this.model})`
      };
    }

    if (targetPhone) {
      const quotedMatch = raw.match(/["'“](.+?)["'”]/);
      let actualMessage = quotedMatch ? quotedMatch[1].trim() : '';

      if (!actualMessage) {
        actualMessage = raw
          .replace(/^(?:tolong\s+)?kirim(?:kan)?\s+(?:pesan\s+)?/i, '')
          .replace(/(?:ke|untuk)\s+(?:nomor\s+|grup\s+)?(?:\+?62|0)8[0-9]{7,13}/gi, '')
          .replace(/(?:ke|untuk)\s+grup\s+[a-zA-Z0-9_\s]+/gi, '')
          .replace(/(?:ke|untuk)\s+[0-9]{15,25}@g\.us/gi, '')
          .replace(/(?:sebanyak\s+)?\d+\s*(?:kali|x|pesan)/gi, '')
          .replace(/jeda\s*\d+\s*(?:detik|s)?/gi, '')
          .replace(/dengan\s+variasi/gi, '')
          .trim();
      }

      if (!actualMessage) {
        if (/maaf|sorry/i.test(raw)) actualMessage = 'Maaf ya atas kesalahan kemarin 🙏';
        else if (/halo|hai|sapaan/i.test(raw)) actualMessage = 'Halo, salam hangat! 😊';
        else if (/ingat|reminder/i.test(raw)) actualMessage = 'Halo, sekadar mengingatkan ya.';
        else actualMessage = 'Halo!';
      }

      const messages = Array(count).fill(actualMessage);

      return {
        action: 'SEND_DISPATCH',
        targetPhone,
        count,
        intervalSeconds,
        messages,
        summary: `Mengirim ${count} pesan ke ${targetPhone}`,
        replyToAdmin: `🚀 *Memulai Pengiriman Pesan*\n• Target: ${targetPhone}\n• Jumlah: ${count} pesan\n• Jeda: ${intervalSeconds}s per pesan`
      };
    }

    return {
      action: 'CHAT',
      replyToAdmin: `Halo Admin! Saya siap menerima perintah pengiriman pesan. Contoh:\n_"Kirim pesan maaf 5x ke 0819203344"_`
    };
  }
}

module.exports = new AiService();
