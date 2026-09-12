const rateLimit = require('express-rate-limit');

/**
 * Global rate limiter for standard API routes
 * 300 requests per 15 minutes per IP
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan dari IP ini. Silakan coba lagi setelah 15 menit.'
  }
});

/**
 * Strict limiter for Auth endpoints (Login & Register)
 * 10 requests per 15 minutes per IP (Protects against brute force and credential stuffing)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak percobaan autentikasi. Silakan tunggu 15 menit sebelum mencoba lagi.'
  }
});

/**
 * Rate limiter for WhatsApp Pairing Code generation
 * 5 requests per 15 minutes per IP
 */
const pairingCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Terlalu banyak permintaan pairing code WhatsApp. Silakan tunggu 15 menit.'
  }
});

/**
 * Rate limiter for Message Sending (Chats & Outbound Dispatch)
 * 40 messages per minute per IP
 */
const messageLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Batas frekuensi pengiriman pesan tercapai. Silakan jeda beberapa saat.'
  }
});

/**
 * Rate limiter for AI features (Suggestions, Summarize, Auto-Reply, Rewrite)
 * 20 requests per minute per IP
 */
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Batas frekuensi pemanggilan fitur AI tercapai. Silakan coba sesaat lagi.'
  }
});

module.exports = {
  globalLimiter,
  authLimiter,
  pairingCodeLimiter,
  messageLimiter,
  aiLimiter
};
