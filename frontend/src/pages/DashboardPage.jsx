import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { 
  Smartphone, 
  Clock, 
  Users, 
  FileText, 
  Zap, 
  ArrowRight, 
  RefreshCw,
  PowerOff
} from 'lucide-react';

export default function DashboardPage({ setActiveTab, waStatus }) {
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalContacts: 0,
    totalTemplates: 0,
    activeGroups: 0,
    recentMessages: []
  });
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState('');

  const updateClock = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    setCurrentTime(`${hours}:${minutes} WIB`);
  };

  const fetchDashboardData = async () => {
    try {
      updateClock();
      const [msgRes, contactsRes, templatesRes] = await Promise.all([
        apiClient.get('/messages?limit=10'),
        apiClient.get('/contacts?limit=1'),
        apiClient.get('/templates?limit=1')
      ]);

      const fetchedMessages = msgRes.data.data?.messages || [];
      const totalMsgCount = msgRes.data.data?.count || 0;
      const totalCont = contactsRes.data.data?.total || 0;
      const totalTemp = templatesRes.data.data?.total || 0;

      setStats({
        totalMessages: totalMsgCount,
        totalContacts: totalCont,
        totalTemplates: totalTemp,
        activeGroups: 0,
        recentMessages: fetchedMessages
      });
    } catch (err) {
      console.warn('Dashboard fetch error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 5000);
    return () => clearInterval(interval);
  }, []);

  const isConnected = waStatus?.status === 'CONNECTED';
  const isConnecting = waStatus?.status === 'CONNECTING' || waStatus?.status === 'RECONNECTING';
  const isScan = waStatus?.status === 'SCAN_QR';
  const isPairing = waStatus?.status === 'PAIRING_CODE';

  const formatPhone = (num) => {
    if (!num) return '';
    const clean = String(num).replace(/[^0-9]/g, '');
    if (clean.startsWith('62') && clean.length >= 10) {
      return `+62 ${clean.slice(2, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    return `+${clean}`;
  };

  const displayPhone = waStatus?.phoneNumber 
    ? formatPhone(waStatus.phoneNumber) 
    : isPairing 
    ? `Kode: ${waStatus.pairingCode || 'Aktif'}` 
    : isScan 
    ? 'Menunggu Scan QR' 
    : isConnecting 
    ? 'Menghubungkan...' 
    : 'Belum Terhubung';

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Pantau lalu lintas pesan WhatsApp, metrik AI real-time, dan status automasi akun Anda.
          </p>
        </div>

        <button
          onClick={fetchDashboardData}
          title="Sinkronisasi data real-time"
          className="self-start sm:self-auto flex items-center space-x-2 bg-white dark:bg-[#111b21] hover:bg-slate-50 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300 px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#222d34] shadow-2xs transition active:scale-95"
        >
          <span>Sinkronisasi: <strong className="text-slate-800 dark:text-slate-100">{currentTime || '14:02 WIB'}</strong></span>
          <RefreshCw className={`w-3.5 h-3.5 text-slate-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
          onClick={() => !isConnected && setActiveTab('whatsapp')}
          className={`bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition ${
            !isConnected ? 'cursor-pointer hover:border-blue-300 dark:hover:border-blue-500' : ''
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">STATUS WA</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isConnected ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400' : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
            }`}>
              <Smartphone className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {isConnected 
                ? 'Connected' 
                : isPairing 
                ? 'Pairing Aktif' 
                : isScan 
                ? 'Scan QR' 
                : isConnecting 
                ? 'Connecting...' 
                : 'Disconnected'}
            </span>
            <span className={`w-2 h-2 rounded-full inline-block ${
              isConnected ? 'bg-emerald-500 animate-pulse' : isConnecting || isScan || isPairing ? 'bg-amber-400' : 'bg-rose-500'
            }`}></span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono truncate">
            {displayPhone}
          </p>
          {!isConnected && (
            <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1 hover:underline">
              Klik untuk hubungkan WhatsApp &rarr;
            </p>
          )}
        </div>

        <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TOTAL PESAN</span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.totalMessages.toLocaleString('en-US')}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Log pesan tercatat
          </p>
        </div>

        <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">BUKU KONTAK</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-3">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.totalContacts}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Kontak terdaftar
          </p>
        </div>

        <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-2xl p-5 shadow-2xs hover:shadow-xs transition">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TEMPLATE PESAN</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-bold text-slate-900 dark:text-white">
              {stats.totalTemplates}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Template tersimpan
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-6 shadow-2xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 dark:border-[#222d34] gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Zap className="w-4 h-4 fill-white text-white" />
            </div>
            <h2 className="font-bold text-base text-slate-900 dark:text-white">AI WhatsApp Direct Trigger</h2>
            <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
              isConnected ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] text-slate-500 dark:text-slate-400'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
              <span>{isConnected ? 'Aktif' : 'Menunggu Koneksi'}</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-5">
          <div className="lg:col-span-7 flex flex-col justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                Kendalikan Pengiriman Pesan Langsung dari Chat WhatsApp
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                Cukup kirim pesan WhatsApp ke nomor Bot server Anda dari nomor Admin. AI akan otomatis membedah instruksi, membuat variasi kalimat anti-spam, dan mengirimkan pesan secara terjadwal ke target.
              </p>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Fitur Pintar:</span>
              <span className="px-3 py-1 bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg">
                Variasi Teks Natural
              </span>
              <span className="px-3 py-1 bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg">
                Proteksi Anti-Banned
              </span>
              <span className="px-3 py-1 bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] text-slate-700 dark:text-slate-200 text-xs font-medium rounded-lg">
                Penguraian Multi-Nomor
              </span>
            </div>
          </div>

          <div className="lg:col-span-5 bg-slate-50/80 dark:bg-[#202c33]/70 border border-slate-200/90 dark:border-[#2a3942] rounded-2xl p-4 flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Contoh Format Perintah</span>
              <span className="text-[10px] font-mono font-medium text-slate-400 bg-white dark:bg-[#111b21] px-2 py-0.5 rounded-md border border-slate-200 dark:border-[#2a3942]">
                NLP Parser v1.8
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#2a3942] rounded-xl p-3 shadow-2xs">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                  "Kirim pesan maaf 5x ke 081920xxxx"
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  ↳ AI membuat 5 variasi permohonan maaf dengan jeda aman.
                </p>
              </div>

              <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#2a3942] rounded-xl p-3 shadow-2xs">
                <p className="text-xs font-bold text-blue-600 dark:text-blue-400 font-mono">
                  "Kirim halo ke 081234567 jeda 5 detik"
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  ↳ Eksekusi instan dengan penundaan otomatis 5.000ms.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-[#222d34]">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900 dark:text-white">Aktivitas Pesan Terbaru</h3>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-[#202c33] text-slate-500 dark:text-slate-400 text-[10px] font-bold rounded-md uppercase">
                  Live Log
                </span>
              </div>

              <button
                onClick={() => setActiveTab('history')}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 flex items-center space-x-1 group transition"
              >
                <span>Lihat Semua</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </button>
            </div>

            {stats.recentMessages.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                Belum ada aktivitas pesan pada akun ini. Mulai dengan mengirim pesan di menu "Kirim Pesan".
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#222d34]">
                {stats.recentMessages.slice(0, 5).map((msg, index) => {
                  const isOut = msg.direction === 'OUTGOING';
                  const isDelivered = msg.status === 'DELIVERED';
                  const isSent = msg.status === 'SENT';

                  const formattedTime = new Date(msg.created_at || Date.now()).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit', 
                    hour12: true 
                  });

                  return (
                    <div key={msg.id || index} className="py-3.5 flex items-start justify-between gap-3 hover:bg-slate-50/50 dark:hover:bg-[#202c33]/50 rounded-xl px-2 transition">
                      <div className="flex items-start space-x-3 min-w-0 flex-1">
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider shrink-0 mt-0.5 ${
                          isOut 
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-900' 
                            : 'bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-900'
                        }`}>
                          {isOut ? 'OUT' : 'IN'}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-100 font-mono">
                              +{msg.phone}
                            </span>
                            {msg.contact_name && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                  {msg.contact_name}
                                </span>
                              </>
                            )}
                          </div>

                          <p className="text-xs text-slate-500 dark:text-slate-400 italic mt-0.5 truncate max-w-lg">
                            "{msg.content}"
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                          isSent 
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                            : isDelivered 
                            ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                            : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#2a3942]'
                        }`}>
                          {msg.status}
                        </span>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                          {formattedTime}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">Status WhatsApp Bot</h3>
              <span className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
            </div>
            <p className="text-xs text-slate-400 mb-4">Nomor Server Bot Pengirim Otomatis</p>

            <div className="bg-slate-50 dark:bg-[#202c33] border border-slate-200/90 dark:border-[#2a3942] rounded-2xl p-4 mb-4">
              <div className="flex items-center space-x-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                <h4 className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                  {isConnected ? 'Bot Siap Menerima Perintah' : 'Bot Belum Terhubung'}
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                {isConnected 
                  ? `Sesi WhatsApp terhubung untuk nomor +${waStatus?.phoneNumber}. Daemon berjalan normal.`
                  : 'Sesi WhatsApp untuk akun ini belum aktif. Silakan hubungkan WhatsApp Anda di menu Koneksi WhatsApp.'}
              </p>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-[#222d34]">
                <span className="text-slate-500 dark:text-slate-400">Status Koneksi</span>
                <span className={`font-semibold ${isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
                  {isConnected ? 'CONNECTED' : 'OFFLINE'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-[#222d34]">
                <span className="text-slate-500 dark:text-slate-400">Nomor HP Terkait</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                  {waStatus?.phoneNumber ? `+${waStatus.phoneNumber}` : '-'}
                </span>
              </div>

              <div className="flex items-center justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">Sesi</span>
                <span className="font-medium text-slate-800 dark:text-slate-100 font-mono">Pribadi (Per Akun)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
