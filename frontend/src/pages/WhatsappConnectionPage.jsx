import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import { 
  QrCode, 
  Smartphone, 
  RefreshCw, 
  PowerOff, 
  CheckCircle2, 
  AlertCircle, 
  Send,
  HelpCircle,
  Copy,
  Check,
  Key,
  Phone,
  Radio
} from 'lucide-react';

export default function WhatsappConnectionPage({ waStatus, onRefreshStatus }) {
  const [activeMode, setActiveMode] = useState('code'); // 'code' | 'qr'
  const [pairPhoneInput, setPairPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Test Message State
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('Halo! Ini adalah pesan uji coba dari WaChat AI. Koneksi WhatsApp berhasil terhubung! 🚀');
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [testError, setTestError] = useState('');

  const fastPollRef = useRef(null);

  const isConnected = waStatus?.status === 'CONNECTED';
  const isPairingCode = waStatus?.status === 'PAIRING_CODE' && waStatus?.pairingCode;
  const isScan = waStatus?.status === 'SCAN_QR' && waStatus?.qrCode;
  const isConnecting = waStatus?.status === 'CONNECTING' || waStatus?.status === 'RECONNECTING';

  // Automatically switch tab based on current active state if already active
  useEffect(() => {
    if (isPairingCode) {
      setActiveMode('code');
    } else if (isScan) {
      setActiveMode('qr');
    }
  }, [isPairingCode, isScan]);

  // Fast poll setup
  const startFastPoll = () => {
    stopFastPoll();
    fastPollRef.current = setInterval(() => {
      onRefreshStatus();
    }, 1000);
    // Auto stop fast poll after 45s
    setTimeout(() => stopFastPoll(), 45000);
  };

  const stopFastPoll = () => {
    if (fastPollRef.current) {
      clearInterval(fastPollRef.current);
      fastPollRef.current = null;
    }
  };

  useEffect(() => {
    if (isConnected) {
      setWaitingForResponse(false);
      stopFastPoll();
    }
    return () => stopFastPoll();
  }, [isConnected]);

  // Request Pairing Code
  const handleRequestPairCode = async (e) => {
    if (e) e.preventDefault();
    if (!pairPhoneInput || pairPhoneInput.trim() === '') {
      setErrorMsg('Silakan masukkan nomor WhatsApp Anda terlebih dahulu.');
      return;
    }

    setErrorMsg('');
    setLoading(true);
    setWaitingForResponse(true);

    try {
      const res = await apiClient.post('/whatsapp/pair-code', {
        phoneNumber: pairPhoneInput.trim()
      });

      await onRefreshStatus();
      startFastPoll();

      if (res.data?.data?.pairingCode) {
        setWaitingForResponse(false);
      }
    } catch (err) {
      setWaitingForResponse(false);
      setErrorMsg(err.response?.data?.message || err.message || 'Gagal meminta kode pairing WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  // Start / Refresh QR Session
  const handleStartQRSession = async (forceRestart = true) => {
    setErrorMsg('');
    setLoading(true);
    setWaitingForResponse(true);

    try {
      await apiClient.post('/whatsapp/connect', { 
        forceRestart, 
        method: 'qr' 
      });
      await onRefreshStatus();
      startFastPoll();
    } catch (err) {
      setWaitingForResponse(false);
      setErrorMsg(err.response?.data?.message || 'Gagal memulai QR code session');
    } finally {
      setLoading(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!confirm('Apakah Anda yakin ingin memutuskan (disconnect) koneksi WhatsApp?')) return;
    setLoading(true);
    try {
      await apiClient.post('/whatsapp/disconnect');
      await onRefreshStatus();
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal disconnect');
    } finally {
      setLoading(false);
    }
  };

  // Copy pairing code to clipboard
  const handleCopyCode = () => {
    const rawCode = waStatus?.pairingCode?.replace(/[^a-zA-Z0-9]/g, '') || '';
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // Send Test Message
  const handleSendTest = async (e) => {
    e.preventDefault();
    setTestSending(true);
    setTestResult(null);
    setTestError('');

    try {
      const res = await apiClient.post('/whatsapp/send-test', {
        toPhone: testPhone,
        messageText: testMessage
      });
      setTestResult(res.data.message || 'Pesan uji coba berhasil terkirim!');
    } catch (err) {
      setTestError(err.response?.data?.message || 'Gagal mengirim pesan uji coba');
    } finally {
      setTestSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight flex items-center gap-2.5">
            <span>WhatsApp Connection</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Hubungkan nomor WhatsApp untuk Bot Server & AI Auto-Reply menggunakan Kode Pairing atau Scan QR
          </p>
        </div>

        {isConnected && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRefreshStatus()}
              disabled={loading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 border border-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-1.5"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-between text-sm text-rose-400 animate-fadeIn">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={() => setErrorMsg('')}
            className="text-xs hover:underline text-rose-300 font-medium ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Main Connection View */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* Left Column: Connection Action Card */}
        <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl flex flex-col items-center text-center relative overflow-hidden">
          
          {/* Status Badge */}
          <div className="mb-5">
            {isConnected ? (
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-400 text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CONNECTED & ACTIVE</span>
              </div>
            ) : isPairingCode ? (
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/40 text-blue-400 text-xs font-bold tracking-wide">
                <Key className="w-3.5 h-3.5" />
                <span>KODE PAIRING AKTIF</span>
              </div>
            ) : isScan ? (
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-400 text-xs font-bold tracking-wide">
                <QrCode className="w-3.5 h-3.5" />
                <span>SCAN QR CODE</span>
              </div>
            ) : (isConnecting || waitingForResponse) ? (
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-400 text-xs font-bold tracking-wide">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>MENGHUBUNGKAN...</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-rose-500/15 border border-rose-500/40 text-rose-400 text-xs font-bold tracking-wide">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>DISCONNECTED</span>
              </div>
            )}
          </div>

          {/* Conditional Content: CONNECTED vs NOT CONNECTED */}
          {isConnected ? (
            <div className="w-full flex flex-col items-center my-auto py-6">
              <div className="w-24 h-24 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 text-emerald-400 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/10">
                <Smartphone className="w-12 h-12" />
              </div>
              <h3 className="font-extrabold text-slate-100 text-xl tracking-tight">WhatsApp Terhubung</h3>
              <div className="inline-flex items-center space-x-2 mt-2 px-4 py-1.5 rounded-full bg-slate-950 border border-slate-800 text-emerald-400 font-mono font-bold text-base">
                <Phone className="w-4 h-4" />
                <span>+{waStatus?.phoneNumber || 'Active'}</span>
              </div>
              <p className="text-xs text-slate-400 mt-3 max-w-xs leading-relaxed">
                Nomor WhatsApp siap digunakan untuk menerima perintah AI dan mengirim pesan otomatis.
              </p>

              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="mt-6 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold px-6 py-2.5 rounded-xl text-sm transition flex items-center justify-center space-x-2"
              >
                <PowerOff className="w-4 h-4" />
                <span>Putuskan Koneksi (Disconnect)</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              {/* Method Switcher Tabs */}
              <div className="w-full max-w-sm grid grid-cols-2 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('code');
                    setErrorMsg('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition ${
                    activeMode === 'code'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Key className="w-4 h-4" />
                  <span>Kode Pairing</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('qr');
                    setErrorMsg('');
                  }}
                  className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition ${
                    activeMode === 'qr'
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  <span>Scan QR Code</span>
                </button>
              </div>

              {/* TAB 1: PAIRING CODE */}
              {activeMode === 'code' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  {isPairingCode ? (
                    /* Display Pairing Code Box */
                    <div className="w-full bg-slate-950 border border-emerald-500/30 rounded-2xl p-6 flex flex-col items-center shadow-inner relative">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                        Kode Pairing WhatsApp Anda
                      </span>
                      
                      {/* Big Code View */}
                      <div className="my-2 py-3 px-6 bg-emerald-500/10 border-2 border-dashed border-emerald-500/50 rounded-2xl flex items-center justify-center gap-3">
                        <span className="text-3xl sm:text-4xl font-black font-mono tracking-widest text-emerald-400 select-all">
                          {waStatus.pairingCode}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          title="Salin Kode"
                          className="p-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 transition"
                        >
                          {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Copy className="w-5 h-5" />}
                        </button>
                      </div>

                      {copied && (
                        <p className="text-xs text-emerald-400 font-semibold mt-1 animate-fadeIn">
                          ✅ Kode berhasil disalin ke clipboard!
                        </p>
                      )}

                      <div className="mt-3 flex items-center space-x-2 text-xs text-blue-400 bg-blue-500/10 px-3 py-1.5 rounded-full border border-blue-500/20 font-mono">
                        <Phone className="w-3.5 h-3.5" />
                        <span>+{waStatus.pairingPhone || pairPhoneInput}</span>
                      </div>

                      <div className="mt-4 flex items-center space-x-2 text-xs text-slate-400">
                        <Radio className="w-3.5 h-3.5 text-emerald-400 animate-ping" />
                        <span>Menunggu Anda memasukkan kode di aplikasi WhatsApp HP...</span>
                      </div>

                      <button
                        onClick={() => handleRequestPairCode()}
                        disabled={loading}
                        className="mt-5 text-xs text-slate-400 hover:text-slate-200 font-semibold underline transition flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Ganti Nomor / Buat Kode Baru</span>
                      </button>
                    </div>
                  ) : (
                    /* Phone Number Input Form */
                    <form onSubmit={handleRequestPairCode} className="w-full max-w-sm space-y-4">
                      <div className="text-left">
                        <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                          Nomor WhatsApp Bot / Personal *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Contoh: 08123456789 atau 628123456789"
                            value={pairPhoneInput}
                            onChange={(e) => setPairPhoneInput(e.target.value)}
                            disabled={loading || waitingForResponse}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium"
                          />
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1.5">
                          Gunakan nomor aktif yang terpasang di aplikasi WhatsApp HP Anda.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || waitingForResponse}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                      >
                        <Key className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{loading || waitingForResponse ? 'Meminta Kode Pairing...' : 'Dapatkan Kode Pairing'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 2: QR CODE */}
              {activeMode === 'qr' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="w-72 h-72 bg-slate-950 border border-slate-800 rounded-2xl p-4 flex items-center justify-center shadow-inner relative">
                    {isScan && waStatus?.qrCode ? (
                      <div className="bg-white p-3 rounded-xl shadow-lg animate-fadeIn">
                        <img 
                          src={waStatus.qrCode} 
                          alt="WhatsApp QR Code" 
                          className="w-56 h-56 object-contain"
                        />
                      </div>
                    ) : (isConnecting || waitingForResponse) ? (
                      <div className="text-center p-4 text-slate-400">
                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-emerald-400" />
                        <p className="text-xs font-semibold">Menyiapkan QR code WhatsApp...</p>
                        <p className="text-xs text-slate-600 mt-1">Harap tunggu beberapa detik</p>
                      </div>
                    ) : (
                      <div className="text-center p-4 text-slate-500">
                        <QrCode className="w-12 h-12 mx-auto mb-2 opacity-40" />
                        <p className="text-xs">Klik tombol di bawah untuk menampilkan QR Code</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartQRSession(true)}
                    disabled={loading || waitingForResponse}
                    className="w-full max-w-xs bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center space-x-1.5 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    <span>{isScan ? 'Refresh QR Code' : 'Tampilkan QR Code'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Instructions & Test Live Message */}
        <div className="md:col-span-6 space-y-6">
          
          {/* Instructions Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center space-x-2.5 text-slate-100 font-bold text-base mb-4">
              <HelpCircle className="w-5 h-5 text-emerald-400" />
              <h3>
                {activeMode === 'code' ? 'Cara Tautkan dengan Kode Pairing' : 'Cara Tautkan dengan Scan QR'}
              </h3>
            </div>

            {activeMode === 'code' ? (
              <div className="space-y-3 bg-slate-950/70 p-4.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300">
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">1</span>
                  <p>Buka aplikasi <strong>WhatsApp</strong> di HP Anda.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">2</span>
                  <p>Ketuk <strong>Menu (Titik 3)</strong> di Android atau <strong>Pengaturan</strong> di iPhone.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">3</span>
                  <p>Pilih menu <strong>Perangkat Tertaut (Linked Devices)</strong>.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">4</span>
                  <p>Ketuk <strong>Tautkan Perangkat (Link a Device)</strong>.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">5</span>
                  <p>Pilih opsi <strong>"Tautkan dengan nomor telepon saja" (Link with phone number instead)</strong> di bagian bawah.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">6</span>
                  <p>Masukkan 8 digit kode yang tertera di layar web Anda.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 bg-slate-950/70 p-4.5 rounded-2xl border border-slate-800/80 text-xs text-slate-300">
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">1</span>
                  <p>Buka aplikasi <strong>WhatsApp</strong> di HP Anda.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">2</span>
                  <p>Buka <strong>Menu (Titik 3)</strong> / <strong>Pengaturan</strong> &rarr; <strong>Perangkat Tertaut</strong>.</p>
                </div>
                <div className="flex items-start space-x-3">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center font-bold flex-shrink-0 text-[11px]">3</span>
                  <p>Ketuk <strong>Tautkan Perangkat</strong> dan arahkan kamera ke QR code.</p>
                </div>
              </div>
            )}
          </div>

          {/* Test Live Message Card (Always visible or when connected) */}
          {isConnected && (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-100 text-base mb-1">Uji Coba Pengiriman Pesan</h3>
              <p className="text-xs text-slate-400 mb-4">
                Kirim pesan uji coba langsung ke nomor WhatsApp tujuan untuk memverifikasi koneksi.
              </p>

              {testResult && (
                <div className="p-3 mb-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-400 flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>{testResult}</span>
                </div>
              )}

              {testError && (
                <div className="p-3 mb-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-semibold text-rose-400 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{testError}</span>
                </div>
              )}

              <form onSubmit={handleSendTest} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Nomor WhatsApp Tujuan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 08123456789 atau 628123456789"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                    Isi Pesan Uji Coba *
                  </label>
                  <input
                    type="text"
                    required
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-medium"
                  />
                </div>

                <button
                  type="submit"
                  disabled={testSending}
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-sm transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  <span>{testSending ? 'Mengirim Pesan...' : 'Kirim Pesan Uji Coba'}</span>
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
