const WhatsappService = require('../services/whatsappService');

const WhatsappController = {
  async startSession(req, res, next) {
    try {
      const sessionName = req.body.sessionName || 'default';
      const forceRestart = req.body.forceRestart || false;
      const result = await WhatsappService.initSession(req.user.id, sessionName, forceRestart);

      res.status(200).json({
        success: true,
        message: result.status === 'CONNECTED'
          ? 'WhatsApp session is already connected'
          : 'WhatsApp session initialized. Scan QR code to connect.',
        data: {
          status: result.status,
          phoneNumber: result.phoneNumber,
          qrCode: result.qrImage,
          sessionName
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async getStatus(req, res, next) {
    try {
      const sessionName = req.query.sessionName || 'default';
      const statusData = await WhatsappService.getSessionStatus(req.user.id, sessionName);

      res.status(200).json({
        success: true,
        data: statusData
      });
    } catch (error) {
      next(error);
    }
  },

  async disconnect(req, res, next) {
    try {
      const sessionName = req.body.sessionName || 'default';
      const result = await WhatsappService.disconnectSession(req.user.id, sessionName);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          status: result.status,
          sessionName
        }
      });
    } catch (error) {
      next(error);
    }
  },

  async sendTestMessage(req, res, next) {
    try {
      const { toPhone, messageText, sessionName = 'default' } = req.body;
      if (!toPhone) {
        return res.status(400).json({
          success: false,
          message: 'Recipient phone number (toPhone) is required'
        });
      }

      const text = messageText || 'Halo! Ini adalah pesan uji coba dari WaChat AI. Koneksi WhatsApp Personal berhasil terhubung! 🚀';
      const result = await WhatsappService.sendTextMessage(req.user.id, {
        toPhone,
        messageText: text,
        sessionName
      });

      res.status(200).json({
        success: true,
        message: 'Test WhatsApp message sent successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  },

  async renderQRPage(req, res, next) {
    try {
      const token = req.query.token || '';
      const html = `
<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WaChat AI — Scan WhatsApp QR</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', Roboto, sans-serif; }
    body { background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h1 { font-size: 1.5rem; margin-bottom: 8px; color: #22c55e; }
    p.sub { color: #94a3b8; font-size: 0.9rem; margin-bottom: 24px; }
    .qr-box { background: #ffffff; border-radius: 12px; padding: 16px; min-height: 280px; min-width: 280px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
    .qr-box img { max-width: 260px; max-height: 260px; border-radius: 8px; }
    .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 600; font-size: 0.85rem; margin-bottom: 16px; }
    .badge-scan { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid #ca8a04; }
    .badge-connected { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid #16a34a; }
    .badge-disconnected { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid #dc2626; }
    .badge-connecting { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid #2563eb; }
    .btn { background: #22c55e; color: #022c22; font-weight: 700; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-size: 0.95rem; transition: background 0.2s; }
    .btn:hover { background: #16a34a; }
    .instructions { text-align: left; background: #0f172a; padding: 16px; border-radius: 8px; font-size: 0.82rem; color: #cbd5e1; line-height: 1.6; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>WhatsApp Connection</h1>
    <p class="sub">Hubungkan akun WhatsApp pribadi Anda</p>
    
    <div id="status-badge" class="badge badge-connecting">MEMUAT STATUS...</div>
    
    <div class="qr-box" id="qr-container">
      <p style="color: #64748b;">Menyiapkan QR Code...</p>
    </div>

    <div id="phone-info" style="margin-bottom: 16px; font-size: 1rem; color: #4ade80; font-weight: 600; display: none;"></div>

    <div style="display: flex; gap: 8px; justify-content: center;">
      <button class="btn" onclick="startSession()">🔄 Mulai / Refresh QR</button>
      <button class="btn" style="background: #ef4444; color: white;" onclick="disconnectSession()">Disconnect</button>
    </div>

    <div class="instructions">
      <strong>Cara Menghubungkan:</strong><br/>
      1. Buka aplikasi WhatsApp di HP Anda.<br/>
      2. Ketuk <strong>Menu (Titik 3)</strong> atau <strong>Pengaturan</strong>.<br/>
      3. Pilih <strong>Perangkat Tertaut (Linked Devices)</strong>.<br/>
      4. Ketuk <strong>Tautkan Perangkat</strong> dan arahkan kamera ke QR code di atas.
    </div>
  </div>

  <script>
    const token = '${token}';
    let pollInterval = null;

    async function fetchStatus() {
      try {
        const res = await fetch('/api/whatsapp/status', {
          headers: token ? { 'Authorization': 'Bearer ' + token } : {}
        });
        const data = await res.json();
        if (data.success && data.data) {
          updateUI(data.data);
        }
      } catch (err) {
        console.error('Fetch status error:', err);
      }
    }

    function updateUI(data) {
      const badge = document.getElementById('status-badge');
      const qrContainer = document.getElementById('qr-container');
      const phoneInfo = document.getElementById('phone-info');

      if (data.status === 'CONNECTED') {
        badge.className = 'badge badge-connected';
        badge.innerText = 'TERHUBUNG ✅';
        qrContainer.innerHTML = '<div style="color: #16a34a; font-size: 2rem;">✅<p style="font-size: 1rem; color: #1e293b; margin-top: 8px; font-weight: 600;">WhatsApp Connected!</p></div>';
        phoneInfo.style.display = 'block';
        phoneInfo.innerText = 'Nomor: +' + (data.phoneNumber || '');
      } else if (data.status === 'SCAN_QR' && data.qrCode) {
        badge.className = 'badge badge-scan';
        badge.innerText = 'SILAKAN SCAN QR CODE';
        qrContainer.innerHTML = '<img src="' + data.qrCode + '" alt="Scan WhatsApp QR" />';
        phoneInfo.style.display = 'none';
      } else if (data.status === 'CONNECTING' || data.status === 'RECONNECTING') {
        badge.className = 'badge badge-connecting';
        badge.innerText = 'MENGHUBUNGKAN...';
        qrContainer.innerHTML = '<p style="color: #64748b;">Sedang membuat session & QR...</p>';
        phoneInfo.style.display = 'none';
      } else {
        badge.className = 'badge badge-disconnected';
        badge.innerText = 'TERPUTUS (DISCONNECTED)';
        qrContainer.innerHTML = '<p style="color: #64748b;">Klik Mulai untuk menghubungkan.</p>';
        phoneInfo.style.display = 'none';
      }
    }

    async function startSession() {
      try {
        await fetch('/api/whatsapp/connect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
          },
          body: JSON.stringify({ forceRestart: true })
        });
        fetchStatus();
      } catch (err) {
        alert('Gagal memulai session: ' + err.message);
      }
    }

    async function disconnectSession() {
      if (!confirm('Apakah Anda yakin ingin disconnect WhatsApp?')) return;
      try {
        await fetch('/api/whatsapp/disconnect', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': 'Bearer ' + token } : {})
          }
        });
        fetchStatus();
      } catch (err) {
        alert('Gagal disconnect: ' + err.message);
      }
    }

    fetchStatus();
    pollInterval = setInterval(fetchStatus, 3000);
  </script>
</body>
</html>
      `;
      res.setHeader('Content-Type', 'text/html');
      res.send(html);
    } catch (error) {
      next(error);
    }
  }
};

module.exports = WhatsappController;
