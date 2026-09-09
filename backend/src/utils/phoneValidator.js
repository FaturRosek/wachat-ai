const formatPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return {
      isValid: false,
      formattedPhone: null,
      error: 'Phone number must be a non-empty string'
    };
  }

  let cleaned = phone.replace(/[^0-9+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('08')) {
    cleaned = '628' + cleaned.substring(2);
  } else if (cleaned.startsWith('8') && cleaned.length >= 9 && cleaned.length <= 13) {
    cleaned = '62' + cleaned;
  }

  if (!/^\d{8,16}$/.test(cleaned)) {
    return {
      isValid: false,
      formattedPhone: null,
      error: 'Invalid phone number format. Must be between 8 and 16 digits.'
    };
  }

  return {
    isValid: true,
    formattedPhone: cleaned,
    error: null
  };
};

module.exports = {
  formatPhoneNumber
};
