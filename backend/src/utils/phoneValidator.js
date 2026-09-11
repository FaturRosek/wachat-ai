const formatPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      formattedPhone: null,
      error: 'Phone number or group ID must be a non-empty string'
    };
  }

  const trimmed = phone.trim();

  if (trimmed.endsWith('@g.us')) {
    return {
      isValid: true,
      formattedPhone: trimmed,
      isGroup: true,
      error: null
    };
  }

  let cleaned = trimmed.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('08')) {
    cleaned = '628' + cleaned.substring(2);
  } else if (cleaned.startsWith('8') && cleaned.length >= 9 && cleaned.length <= 13) {
    cleaned = '62' + cleaned;
  }

  if (!/^\d{8,25}$/.test(cleaned)) {
    return {
      isValid: false,
      formattedPhone: null,
      error: 'Invalid phone number format. Must be between 8 and 25 digits.'
    };
  }

  return {
    isValid: true,
    formattedPhone: cleaned,
    isGroup: false,
    error: null
  };
};

module.exports = {
  formatPhoneNumber
};
