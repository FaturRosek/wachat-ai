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
  const [activeMode, setActiveMode] = useState('code');
  const [pairPhoneInput, setPairPhoneInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [waitingForResponse, setWaitingForResponse] = useState(false);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
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

  useEffect(() => {
    if (isPairingCode) {
      setActiveMode('code');
    } else if (isScan) {
      setActiveMode('qr');
    }
  }, [isPairingCode, isScan]);

  const startFastPoll = () => {
    stopFastPoll();
    fastPollRef.current = setInterval(() => {
      onRefreshStatus();
    }, 1000);
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

  const handleCopyCode = () => {
    const rawCode = waStatus?.pairingCode?.replace(/[^a-zA-Z0-9]/g, '') || '';
    if (!rawCode) return;
    navigator.clipboard.writeText(rawCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

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
    <div className="space-y-6 max-w-6xl mx-auto pb-8 text-slate-800 dark:text-slate-100 transition-colors duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Koneksi WhatsApp</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Hubungkan nomor WhatsApp untuk Bot Server & AI Auto-Reply menggunakan Kode Pairing atau Scan QR.
          </p>
        </div>

        {isConnected && (
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onRefreshStatus()}
              disabled={loading}
              className="bg-white dark:bg-[#111b21] hover:bg-slate-50 dark:hover:bg-[#202c33] text-slate-700 dark:text-slate-200 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 border border-slate-200 dark:border-[#2a3942] shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={handleDisconnect}
              disabled={loading}
              className="bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-semibold px-4 py-2 rounded-xl text-xs transition flex items-center space-x-1.5 shadow-2xs"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Putuskan Koneksi</span>
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between text-xs sm:text-sm text-rose-600 dark:text-rose-300">
          <div className="flex items-center space-x-2.5">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button 
            onClick={() => setErrorMsg('')}
            className="text-xs hover:underline text-rose-700 dark:text-rose-400 font-bold ml-4"
          >
            Tutup
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-6 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-6 sm:p-7 shadow-2xs flex flex-col items-center text-center relative transition-colors duration-200">
          <div className="mb-6">
            {isConnected ? (
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-400 text-xs font-bold tracking-wide">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>CONNECTED & ACTIVE</span>
              </div>
            ) : isPairingCode ? (
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 text-blue-700 dark:text-blue-400 text-xs font-bold tracking-wide">
                <Key className="w-3.5 h-3.5" />
                <span>KODE PAIRING AKTIF</span>
              </div>
            ) : isScan ? (
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-700 dark:text-amber-400 text-xs font-bold tracking-wide">
                <QrCode className="w-3.5 h-3.5" />
                <span>SCAN QR CODE</span>
              </div>
            ) : (isConnecting || waitingForResponse) ? (
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-purple-50 dark:bg-purple-950/50 border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-400 text-xs font-bold tracking-wide">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>MENGHUBUNGKAN...</span>
              </div>
            ) : (
              <div className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-full bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] text-slate-600 dark:text-slate-300 text-xs font-bold tracking-wide">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>DISCONNECTED</span>
              </div>
            )}
          </div>

          {isConnected ? (
            <div className="w-full flex flex-col items-center my-auto py-6">
              <div className="w-20 h-20 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 border-2 border-emerald-200 dark:border-emerald-800/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-4 shadow-sm">
                <Smartphone className="w-10 h-10" />
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-xl tracking-tight">WhatsApp Terhubung</h3>
              <div className="inline-flex items-center space-x-2 mt-2 px-4 py-1.5 rounded-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] text-slate-800 dark:text-slate-100 font-mono font-bold text-base">
                <Phone className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>+{waStatus?.phoneNumber || '6287728838649'}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-3 max-w-xs leading-relaxed">
                Nomor WhatsApp siap digunakan untuk menerima perintah AI dan mengirim pesan otomatis.
              </p>

              <button
                onClick={handleDisconnect}
                disabled={loading}
                className="mt-6 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 font-bold px-6 py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center space-x-2"
              >
                <PowerOff className="w-4 h-4" />
                <span>Putuskan Sesi WhatsApp</span>
              </button>
            </div>
          ) : (
            <div className="w-full flex flex-col items-center">
              <div className="w-full max-w-sm grid grid-cols-2 bg-slate-100 dark:bg-[#202c33] p-1 rounded-2xl border border-slate-200/80 dark:border-[#2a3942] mb-6">
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('code');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                    activeMode === 'code'
                      ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Kode Pairing</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode('qr');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition ${
                    activeMode === 'qr'
                      ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5" />
                  <span>Scan QR Code</span>
                </button>
              </div>

              {activeMode === 'code' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  {isPairingCode ? (
                    <div className="w-full bg-slate-50 dark:bg-[#202c33] border border-blue-200 dark:border-blue-900/50 rounded-3xl p-6 flex flex-col items-center shadow-2xs">
                      <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        Kode Pairing WhatsApp Anda
                      </span>
                      
                      <div className="my-2 py-3 px-4 sm:px-6 bg-white dark:bg-[#111b21] border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-2xl flex items-center justify-center gap-2 sm:gap-3 w-full max-w-xs sm:max-w-sm shadow-xs">
                        <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-blue-600 dark:text-blue-400 select-all">
                          {waStatus.pairingCode}
                        </span>
                        <button
                          onClick={handleCopyCode}
                          title="Salin Kode"
                          className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-600 dark:text-blue-400 transition shrink-0"
                        >
                          {copied ? <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" /> : <Copy className="w-4 h-4" />}
                        </button>
                      </div>

                      {copied && (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold mt-1 text-center">
                          ✅ Kode berhasil disalin ke clipboard!
                        </p>
                      )}

                      <div className="mt-3 flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-200 bg-white dark:bg-[#111b21] px-3 py-1 rounded-full border border-slate-200 dark:border-[#2a3942] font-mono">
                        <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400 shrink-0" />
                        <span>+{waStatus.pairingPhone || pairPhoneInput}</span>
                      </div>

                      <div className="mt-4 flex items-center space-x-2 text-xs text-slate-500 dark:text-slate-400 text-center">
                        <Radio className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 animate-ping shrink-0" />
                        <span>Menunggu konfirmasi dari aplikasi WhatsApp di HP...</span>
                      </div>

                      <button
                        onClick={() => handleRequestPairCode()}
                        disabled={loading}
                        className="mt-5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 font-semibold underline transition flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Ganti Nomor / Buat Kode Baru</span>
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleRequestPairCode} className="w-full max-w-sm space-y-4 text-left">
                      <div>
                        <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
                          Nomor WhatsApp Bot / Server *
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Contoh: 08123456789 atau 628123456789"
                          value={pairPhoneInput}
                          onChange={(e) => setPairPhoneInput(e.target.value)}
                          disabled={loading || waitingForResponse}
                          className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-4 py-2.5 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21] font-medium"
                        />
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                          Gunakan nomor aktif yang terpasang di HP Anda.
                        </p>
                      </div>

                      <button
                        type="submit"
                        disabled={loading || waitingForResponse}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center space-x-2 shadow-xs shadow-blue-500/20 disabled:opacity-50"
                      >
                        <Key className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        <span>{loading || waitingForResponse ? 'Meminta Kode Pairing...' : 'Dapatkan Kode Pairing'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {activeMode === 'qr' && (
                <div className="w-full flex flex-col items-center space-y-4">
                  <div className="w-64 h-64 bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-3xl p-4 flex items-center justify-center shadow-inner relative">
                    {isScan && waStatus?.qrCode ? (
                      <div className="bg-white p-2.5 rounded-2xl shadow-sm">
                        <img 
                          src={waStatus.qrCode} 
                          alt="WhatsApp QR Code" 
                          className="w-52 h-52 object-contain"
                        />
                      </div>
                    ) : (isConnecting || waitingForResponse) ? (
                      <div className="text-center p-4 text-slate-500 dark:text-slate-400">
                        <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-2 text-blue-600 dark:text-blue-400" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Menyiapkan QR code WhatsApp...</p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Harap tunggu beberapa saat</p>
                      </div>
                    ) : (
                      <div className="text-center p-4 text-slate-400 dark:text-slate-500">
                        <QrCode className="w-12 h-12 mx-auto mb-2 opacity-30" />
                        <p className="text-xs">Klik tombol di bawah untuk menampilkan QR Code</p>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => handleStartQRSession(true)}
                    disabled={loading || waitingForResponse}
                    className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs sm:text-sm transition flex items-center justify-center space-x-1.5 shadow-xs disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>{isScan ? 'Refresh QR Code' : 'Tampilkan QR Code'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="md:col-span-6 space-y-6">
          <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-6 shadow-2xs transition-colors duration-200">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-bold text-base mb-4">
              <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3>
                {activeMode === 'code' ? 'Panduan Tautkan Kode Pairing' : 'Panduan Tautkan Scan QR'}
              </h3>
            </div>

            {activeMode === 'code' ? (
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                  <p>Buka aplikasi <strong>WhatsApp</strong> di HP Anda.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                  <p>Ketuk <strong>Menu (Titik 3)</strong> di Android atau <strong>Pengaturan</strong> di iPhone.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                  <p>Pilih menu <strong>Perangkat Tertaut (Linked Devices)</strong>.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">4</span>
                  <p>Ketuk <strong>Tautkan Perangkat (Link a Device)</strong>.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">5</span>
                  <p>Pilih opsi <strong>"Tautkan dengan nomor telepon saja"</strong> di bagian bawah.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">6</span>
                  <p>Masukkan 8 karakter kode pairing yang tertera di layar.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">1</span>
                  <p>Buka aplikasi <strong>WhatsApp</strong> di HP Anda.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">2</span>
                  <p>Buka <strong>Menu (Titik 3)</strong> / <strong>Pengaturan</strong> &rarr; <strong>Perangkat Tertaut</strong>.</p>
                </div>
                <div className="flex items-start space-x-3 p-2 bg-slate-50 dark:bg-[#202c33] border border-slate-100/80 dark:border-[#2a3942] rounded-xl">
                  <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold shrink-0 text-[10px]">3</span>
                  <p>Ketuk <strong>Tautkan Perangkat</strong> dan arahkan kamera ke QR code di atas.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
