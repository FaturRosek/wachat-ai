import React from 'react';
import { Smartphone, RefreshCw, Menu } from 'lucide-react';

export default function Navbar({ waStatus, onRefreshStatus, onToggleMobileMenu }) {
  const isConnected = waStatus?.status === 'CONNECTED';
  const isConnecting = waStatus?.status === 'CONNECTING' || waStatus?.status === 'RECONNECTING';
  const isScan = waStatus?.status === 'SCAN_QR';

  return (
    <header className="h-16 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-3.5 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left section: Hamburger button (mobile) + Page / Brand indicator */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onToggleMobileMenu}
          className="md:hidden p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-base sm:text-lg font-bold text-slate-100 tracking-tight">
          Control Panel
        </h2>
      </div>

      {/* Right section: Responsive WhatsApp Status & Refresh */}
      <div className="flex items-center space-x-2 sm:space-x-3">
        <div className="flex items-center space-x-1.5 sm:space-x-2 bg-slate-800/90 px-2.5 sm:px-3.5 py-1.5 rounded-full border border-slate-700/60 max-w-[200px] sm:max-w-none">
          <Smartphone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span className="hidden sm:inline text-xs text-slate-400">WhatsApp:</span>

          {isConnected ? (
            <span className="flex items-center text-xs font-semibold text-emerald-400 truncate">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 shrink-0 animate-pulse"></span>
              <span className="hidden sm:inline">Connected ({waStatus?.phoneNumber || 'Active'})</span>
              <span className="sm:hidden truncate">Active ({waStatus?.phoneNumber ? `+${waStatus.phoneNumber.slice(-4)}` : 'On'})</span>
            </span>
          ) : waStatus?.status === 'PAIRING_CODE' ? (
            <span className="flex items-center text-xs font-semibold text-blue-400 truncate">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 shrink-0 animate-pulse"></span>
              <span className="hidden sm:inline">Pairing Code Active</span>
              <span className="sm:hidden">Pairing Code</span>
            </span>
          ) : isScan ? (
            <span className="flex items-center text-xs font-semibold text-amber-400 truncate">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5 shrink-0"></span>
              <span className="hidden sm:inline">Scan QR Required</span>
              <span className="sm:hidden">Scan QR</span>
            </span>
          ) : isConnecting ? (
            <span className="flex items-center text-xs font-semibold text-purple-400 truncate">
              <span className="w-2 h-2 rounded-full bg-purple-500 mr-1.5 shrink-0 animate-ping"></span>
              <span>Connecting...</span>
            </span>
          ) : (
            <span className="flex items-center text-xs font-semibold text-rose-400 truncate">
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5 shrink-0"></span>
              <span>Offline</span>
            </span>
          )}
        </div>

        <button
          onClick={onRefreshStatus}
          title="Refresh connection status"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

