let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

if (typeof window !== 'undefined') {
  const resumeAudio = () => {
    getAudioContext();
    window.removeEventListener('click', resumeAudio);
    window.removeEventListener('keydown', resumeAudio);
    window.removeEventListener('touchstart', resumeAudio);
  };
  window.addEventListener('click', resumeAudio, { once: true });
  window.addEventListener('keydown', resumeAudio, { once: true });
  window.addEventListener('touchstart', resumeAudio, { once: true });
}

export function playNotificationSound() {
  const isMuted = localStorage.getItem('wa_notif_sound_enabled') === 'false';
  if (isMuted) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(784, now);

    gain1.gain.setValueAtTime(0.001, now);
    gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);

    osc1.start(now);
    osc1.stop(now + 0.18);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.08);

    gain2.gain.setValueAtTime(0.001, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);

    osc2.start(now + 0.08);
    osc2.stop(now + 0.38);
  } catch (e) {
    console.warn('[NotificationSound] Gagal memainkan audio:', e.message);
  }
}

export async function requestNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  if (Notification.permission === 'granted') {
    return 'granted';
  }
  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (e) {
    return 'denied';
  }
}

export function showDesktopNotification({ title, body, icon, onClick }) {
  const isDesktopDisabled = localStorage.getItem('wa_notif_desktop_enabled') === 'false';
  if (isDesktopDisabled) return null;

  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }

  try {
    const notif = new Notification(title || 'Pesan Baru WhatsApp', {
      body: body || 'Anda menerima pesan baru.',
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'wachat-message',
      renotify: true,
      silent: true,
    });

    notif.onclick = () => {
      window.focus();
      if (typeof onClick === 'function') onClick();
      notif.close();
    };

    setTimeout(() => {
      try { notif.close(); } catch (e) {}
    }, 6000);

    return notif;
  } catch (e) {
    console.warn('[NotificationDesktop] Gagal menampilkan notifikasi desktop:', e.message);
    return null;
  }
}
