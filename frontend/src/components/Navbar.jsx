import React from 'react';
import { Smartphone, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function Navbar({ waStatus, onRefreshStatus }) {
  const isConnected = waStatus?.status === 'CONNECTED';
  const isConnecting = waStatus?.status === 'CONNECTING' || waStatus?.status === 'RECONNECTING';
  const isScan = waStatus?.status === 'SCAN_QR';

  return (
    <header className="h-16 bg-slate-900/60 backdrop-blur border-b border-slate-800 px-8 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center space-x-3">
        <h2 className="text-lg font-semibold text-slate-100">Control Panel</h2>
      </div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3.5 py-1.5 rounded-full border border-slate-700/60">
          <Smartphone className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-400">WhatsApp:</span>

          {isConnected ? (
            <span className="flex items-center text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 mr-1.5 animate-pulse"></span>
              Connected ({waStatus?.phoneNumber || 'Active'})
            </span>
          ) : isScan ? (
            <span className="flex items-center text-xs font-semibold text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500 mr-1.5"></span>
              Scan QR Required
            </span>
          ) : isConnecting ? (
            <span className="flex items-center text-xs font-semibold text-blue-400">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-1.5 animate-ping"></span>
              Connecting...
            </span>
          ) : (
            <span className="flex items-center text-xs font-semibold text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
              Disconnected
            </span>
          )}
        </div>

        <button
          onClick={onRefreshStatus}
          title="Refresh connection status"
          className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700/50 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
