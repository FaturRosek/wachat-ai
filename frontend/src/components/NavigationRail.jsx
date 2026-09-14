import React, { useState } from 'react';
import {
  MessageSquare,
  Send,
  Smartphone,
  Zap,
  Settings,
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
    <aside className="w-16 bg-white dark:bg-[#0f172a] flex flex-col items-center justify-between py-4 select-none flex-shrink-0 z-30 border-r border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200">
      <div className="flex flex-col items-center gap-3 w-full px-2">
        {/* Top Logo */}
        <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/30 mb-2">
          <MessageSquare className="w-5 h-5 fill-white" />
        </div>

        {/* Tab: Chat */}
        <button
          onClick={() => setActiveTab('chat')}
          title="WhatsApp Chat"
          className={`w-10 h-10 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
            activeTab === 'chat'
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-indigo-600 text-white text-[9px] font-extrabold px-1.5 py-0.2 rounded-full min-w-4 text-center ring-2 ring-white dark:ring-[#0f172a]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Tab: Broadcast / Compose */}
        <button
          onClick={() => setActiveTab('compose')}
          title="Kirim Pesan Broadcast"
          className={`w-10 h-10 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
            activeTab === 'compose'
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Send className="w-4.5 h-4.5" />
        </button>



        {/* Tab: WhatsApp Device Connection */}
        <button
          onClick={() => setActiveTab('whatsapp')}
          title="Koneksi WhatsApp Device"
          className={`w-10 h-10 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
            activeTab === 'whatsapp'
              ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
              : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Smartphone className="w-4.5 h-4.5" />
          <span
            className={`absolute bottom-2 right-2 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#0f172a] ${
              isConnected ? 'bg-emerald-500' : 'bg-rose-500'
            }`}
          ></span>
        </button>
      </div>

      {/* Bottom Icons */}
      <div className="flex flex-col items-center gap-3 relative px-2">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleTheme}
          title={isDark ? 'Mode Terang (Light)' : 'Mode Gelap (Dark)'}
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition-all"
        >
          {isDark ? (
            <Sun className="w-4.5 h-4.5 text-amber-400 animate-in spin-in-180 duration-300" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-slate-400 hover:text-indigo-600 transition" />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setProfileMenuOpen(!profileMenuOpen)}
          title="Pengaturan"
          className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
        >
          <Settings className="w-4.5 h-4.5" />
        </button>

        {/* Profile Avatar with Green Dot */}
        <div className="relative">
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            title={`Akun: ${displayName}`}
            className="w-9 h-9 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-md shadow-indigo-600/20 hover:scale-105 transition"
          >
            {displayInitial}
          </button>
          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f172a]"></span>
        </div>

        {profileMenuOpen && (
          <div className="absolute bottom-12 left-12 w-64 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-xl p-3 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-2 border-b border-slate-100 dark:border-slate-700 mb-2">
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
              className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl flex items-center justify-between transition font-medium"
            >
              <div className="flex items-center gap-2">
                {isDark ? <Sun className="w-3.5 h-3.5 text-amber-400" /> : <Moon className="w-3.5 h-3.5 text-slate-500" />}
                <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase">
                {theme}
              </span>
            </button>

            <button
              onClick={() => {
                setProfileMenuOpen(false);
                setActiveTab('whatsapp');
              }}
              className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-slate-800 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-xl flex items-center gap-2 transition font-medium mt-1"
            >
              <Smartphone className="w-3.5 h-3.5 text-indigo-600" />
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
