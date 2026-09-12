import React from 'react';
import { RefreshCw, Menu, Plus } from 'lucide-react';

export default function Navbar({ waStatus, onRefreshStatus, onToggleMobileMenu, activeTab, setActiveTab }) {
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

  const formattedPhone = formatPhone(waStatus?.phoneNumber);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'whatsapp': return 'Koneksi WhatsApp';
      case 'compose': return 'Kirim Pesan';
      case 'history': return 'Riwayat Pesan';
      case 'contacts': return 'Buku Kontak';
      case 'templates': return 'Template Pesan';
      case 'ai-trigger': return 'AI Direct Trigger';
      default: return 'Dashboard Overview';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200/90 px-4 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-20 shadow-2xs">
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-2 text-xs sm:text-sm font-medium">
          <span className="text-slate-400">Ringkasan Sistem</span>
          <span className="text-slate-300">/</span>
          <span className="text-slate-800 font-semibold">{getPageTitle()}</span>
        </div>
      </div>

      <div className="flex items-center space-x-3">
        <div className="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-2xs">
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            isConnected 
              ? 'bg-emerald-500 ring-2 ring-emerald-100 animate-pulse' 
              : isConnecting 
              ? 'bg-amber-400 ring-2 ring-amber-100 animate-ping'
              : 'bg-rose-500'
          }`}></span>
          
          <div className="text-xs font-semibold text-slate-700 flex items-center space-x-1">
            <span className="text-slate-500 font-normal">WhatsApp:</span>
            {isConnected ? (
              <span className="text-slate-900 font-bold">{formattedPhone || 'Terhubung'}</span>
            ) : isPairing ? (
              <span className="text-blue-600 font-semibold">Pairing Aktif</span>
            ) : isScan ? (
              <span className="text-amber-600 font-semibold">Scan QR</span>
            ) : isConnecting ? (
              <span className="text-amber-600 font-semibold">Menghubungkan...</span>
            ) : (
              <span className="text-rose-500 font-semibold">Offline</span>
            )}
          </div>

          <button
            onClick={onRefreshStatus}
            title="Refresh status WhatsApp"
            className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition ml-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        <button
          onClick={() => setActiveTab && setActiveTab('compose')}
          className="hidden sm:flex items-center space-x-1.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-xl text-xs sm:text-sm shadow-xs shadow-blue-600/20 transition active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Kirim Pesan Cepat</span>
        </button>
      </div>
    </header>
  );
}
