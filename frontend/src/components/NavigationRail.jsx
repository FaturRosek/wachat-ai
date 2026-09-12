import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Smartphone,
  LogOut,
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function NavigationRail({
  activeTab,
  setActiveTab,
  waStatus,
  unreadCount = 0,
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const isConnected = waStatus?.status === 'CONNECTED';

  const displayName = user?.name || user?.email || 'Pengguna';
  const displayInitial = displayName.charAt(0).toUpperCase();

  return (
    <aside className="w-16 bg-white dark:bg-[#111b21] flex flex-col items-center justify-between py-3.5 select-none flex-shrink-0 z-30 border-r border-slate-200/90 dark:border-[#222d34] shadow-2xs transition-colors duration-200">
      <div className="flex flex-col items-center gap-2.5 w-full px-2">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-600/20 mb-1">
          <MessageSquare className="w-5 h-5 fill-white/20" />
        </div>

        <button
          onClick={() => setActiveTab('chat')}
          title="Live Chat (WhatsApp Web)"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition ${
            activeTab === 'chat'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-200/60 dark:border-blue-800/60 font-bold'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[10px] font-extrabold px-1.5 py-0.2 rounded-full min-w-4 text-center ring-2 ring-white dark:ring-[#111b21]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('compose')}
          title="Komposer Pesan Terpisah"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition ${
            activeTab === 'compose'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-200/60 dark:border-blue-800/60 font-bold'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Send className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('whatsapp')}
          title="Koneksi WhatsApp"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center relative transition ${
            activeTab === 'whatsapp'
              ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shadow-xs border border-blue-200/60 dark:border-blue-800/60 font-bold'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-5 h-5" />
          <span
            className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#111b21] ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </button>
      </div>

      <div className="flex flex-col items-center gap-3 relative px-2">
        <button
          onClick={toggleTheme}
          title={isDark ? 'Beralih ke Mode Terang (Light)' : 'Beralih ke Mode Gelap (Dark)'}
          className="w-11 h-11 rounded-2xl flex items-center justify-center text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-[#202c33] transition-all"
        >
          {isDark ? (
            <Sun className="w-5 h-5 text-amber-400 animate-in spin-in-180 duration-300" />
          ) : (
            <Moon className="w-5 h-5 text-slate-500 hover:text-blue-600 animate-in spin-in-180 duration-300" />
          )}
        </button>

        <button
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          title={`Akun: ${displayName}`}
          className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md shadow-blue-600/20 hover:ring-2 hover:ring-blue-400 transition"
        >
          {displayInitial}
        </button>

        {profileMenuOpen && (
          <div className="absolute bottom-12 left-12 w-64 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-2xl shadow-xl p-3 z-50 text-slate-800 dark:text-slate-100 animate-fade-in">
            <div className="p-2 border-b border-slate-100 dark:border-[#2a3942] mb-2">
              <p className="font-bold text-xs text-slate-900 dark:text-white truncate">{displayName}</p>
              <p className="text-[11px] text-slate-400 dark:text-slate-400 truncate">{user?.email || 'User'}</p>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] font-semibold">
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                <span className={isConnected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-400'}>
                  {isConnected ? `WA: +${waStatus?.phoneNumber}` : 'WhatsApp Offline'}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                toggleTheme();
                setProfileMenuOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-[#111b21] hover:text-blue-600 dark:hover:text-blue-400 rounded-xl flex items-center justify-between transition font-medium"
            >
              <div className="flex items-center gap-2">
                {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
                <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#111b21] text-slate-500 dark:text-slate-400 font-bold uppercase">
                {theme}
              </span>
            </button>

            <button
              onClick={() => {
                setProfileMenuOpen(false);
                setActiveTab('whatsapp');
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-[#111b21] hover:text-blue-600 dark:hover:text-blue-400 rounded-xl flex items-center gap-2 transition font-medium mt-1"
            >
              <Smartphone className="w-3.5 h-3.5 text-blue-600" />
              Kelola Sesi WhatsApp
            </button>

            <button
              onClick={() => {
                setProfileMenuOpen(false);
                logout();
              }}
              className="w-full text-left px-3 py-2 text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl flex items-center gap-2 transition font-medium mt-1"
            >
              <LogOut className="w-3.5 h-3.5" />
              Keluar (Logout)
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
