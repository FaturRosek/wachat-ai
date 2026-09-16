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
  Bell,
  BellOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { playNotificationSound, requestNotificationPermission } from '../utils/notificationHelper';

export default function NavigationRail({
  activeTab,
  setActiveTab,
  waStatus,
  unreadCount = 0,
  hasActiveChat = false,
}) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme, isDark } = useTheme();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('wa_notif_sound_enabled') !== 'false' : true;
  });
  const [desktopEnabled, setDesktopEnabled] = useState(() => {
    return typeof window !== 'undefined' ? localStorage.getItem('wa_notif_desktop_enabled') !== 'false' : true;
  });
  const [permState, setPermState] = useState(() => {
    return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
  });

  const isConnected = waStatus?.status === 'CONNECTED';

  const displayName = user?.name || user?.email || 'Pengguna';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const handleToggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    localStorage.setItem('wa_notif_sound_enabled', String(next));
    if (next) playNotificationSound();
  };

  const handleToggleDesktop = async () => {
    if (!desktopEnabled || permState !== 'granted') {
      const p = await requestNotificationPermission();
      setPermState(p);
      if (p === 'granted') {
        setDesktopEnabled(true);
        localStorage.setItem('wa_notif_desktop_enabled', 'true');
      } else {
        alert('Izin notifikasi browser belum diberikan. Silakan izinkan di icon gembok baris URL browser Anda.');
      }
    } else {
      setDesktopEnabled(false);
      localStorage.setItem('wa_notif_desktop_enabled', 'false');
    }
  };

  const handleTestSound = () => {
    playNotificationSound();
  };

  return (
    <>
      <aside className="hidden md:flex w-16 bg-white dark:bg-[#0f172a] flex-col items-center justify-between py-4 select-none flex-shrink-0 z-30 border-r border-slate-200/80 dark:border-slate-800 shadow-2xs transition-colors duration-200">
        <div className="flex flex-col items-center gap-3 w-full px-2">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-600/30 mb-2">
            <MessageSquare className="w-5 h-5 fill-white" />
          </div>

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

        <div className="flex flex-col items-center gap-3 relative px-2">
          <button
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setProfileMenuOpen(false);
            }}
            title="Pengaturan Notifikasi Pesan"
            className={`w-10 h-10 rounded-2xl flex items-center justify-center relative transition-all duration-200 ${
              notifMenuOpen
                ? 'bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 font-bold shadow-2xs'
                : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            {soundEnabled ? <Bell className="w-4.5 h-4.5" /> : <BellOff className="w-4.5 h-4.5 text-slate-400" />}
            {soundEnabled && (
              <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#0f172a]" />
            )}
          </button>

          {notifMenuOpen && (
            <div className="absolute bottom-24 left-14 w-72 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-4 z-50 text-slate-800 dark:text-slate-100 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 mb-3">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">Notifikasi Pesan</h4>
                </div>
                <button
                  onClick={() => setNotifMenuOpen(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs p-1"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div className="flex items-center gap-2.5">
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-500" /> : <VolumeX className="w-4 h-4 text-slate-400" />}
                    <div>
                      <p className="font-bold text-slate-800 dark:text-slate-100 text-[11px]">Suara Notifikasi</p>
                      <p className="text-[10px] text-slate-400">Bunyi lonceng saat pesan masuk</p>
                    </div>
                  </div>
                  <button
                    onClick={handleToggleSound}
                    className={`w-9 h-5 rounded-full transition-colors relative ${soundEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${soundEnabled ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                <button
                  onClick={handleTestSound}
                  className="w-full py-1.5 px-3 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-xl font-bold text-[10px] flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Uji Coba Suara (Chime)</span>
                </button>

                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-[11px]">Pop-up Desktop</p>
                    <p className="text-[10px] text-slate-400">
                      {permState === 'granted' ? 'Notifikasi sistem aktif' : 'Muncul saat tab di latar belakang'}
                    </p>
                  </div>
                  <button
                    onClick={handleToggleDesktop}
                    className={`w-9 h-5 rounded-full transition-colors relative ${desktopEnabled && permState === 'granted' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${desktopEnabled && permState === 'granted' ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>

                {permState !== 'granted' && (
                  <button
                    onClick={async () => {
                      const p = await requestNotificationPermission();
                      setPermState(p);
                      if (p === 'granted') {
                        setDesktopEnabled(true);
                        localStorage.setItem('wa_notif_desktop_enabled', 'true');
                      }
                    }}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] transition active:scale-95 shadow-xs"
                  >
                    Aktifkan Izin Notifikasi Browser
                  </button>
                )}
              </div>
            </div>
          )}

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

          <button
            onClick={() => {
              setProfileMenuOpen(!profileMenuOpen);
              setNotifMenuOpen(false);
            }}
            title="Pengaturan"
            className="w-10 h-10 rounded-2xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/60 transition"
          >
            <Settings className="w-4.5 h-4.5" />
          </button>

          <div className="relative">
            <button
              onClick={() => {
                setProfileMenuOpen(!profileMenuOpen);
                setNotifMenuOpen(false);
              }}
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

      {(!hasActiveChat || activeTab !== 'chat') && (
        <nav className="flex md:hidden fixed bottom-0 left-0 right-0 h-14 bg-white/95 dark:bg-[#111b21]/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 z-40 items-center justify-around px-3 shadow-lg select-none transition-colors duration-200">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition ${
              activeTab === 'chat'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-2 bg-indigo-600 text-white text-[8px] font-extrabold px-1 py-0.2 rounded-full min-w-3 text-center">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('compose')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition ${
              activeTab === 'compose'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <Send className="w-5 h-5" />
            <span className="text-[10px] mt-0.5 font-medium">Broadcast</span>
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition relative ${
              activeTab === 'whatsapp'
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative">
              <Smartphone className="w-5 h-5" />
              <span
                className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#111b21] ${
                  isConnected ? 'bg-emerald-500' : 'bg-rose-500'
                }`}
              ></span>
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Perangkat</span>
          </button>

          <button
            onClick={() => {
              setNotifMenuOpen(!notifMenuOpen);
              setProfileMenuOpen(false);
            }}
            className={`flex flex-col items-center justify-center p-1.5 rounded-xl transition relative ${
              notifMenuOpen
                ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
            }`}
          >
            <div className="relative">
              {soundEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5 text-slate-400" />}
              {soundEnabled && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111b21]" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Notifikasi</span>
          </button>

          <button
            onClick={() => {
              setProfileMenuOpen(!profileMenuOpen);
              setNotifMenuOpen(false);
            }}
            className="flex flex-col items-center justify-center p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition relative"
          >
            <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold">
              {displayInitial}
            </div>
            <span className="text-[10px] mt-0.5 font-medium">Akun</span>
          </button>
        </nav>
      )}

      {notifMenuOpen && (
        <div 
          onClick={() => setNotifMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-50 md:hidden flex items-end justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#1e293b] rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                  <Bell className="w-4.5 h-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">Notifikasi Pesan</h4>
                  <p className="text-[11px] text-slate-400">Atur suara & pop-up pesan masuk</p>
                </div>
              </div>
              <button
                onClick={() => setNotifMenuOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-3">
                  {soundEnabled ? (
                    <Volume2 className="w-5 h-5 text-emerald-500" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-slate-400" />
                  )}
                  <div>
                    <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">Suara Notifikasi</p>
                    <p className="text-[10px] text-slate-400">Bunyi lonceng saat pesan masuk</p>
                  </div>
                </div>
                <button
                  onClick={handleToggleSound}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    soundEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      soundEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <button
                onClick={handleTestSound}
                className="w-full py-2.5 px-4 bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 rounded-2xl font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
                <span>Uji Coba Suara (Chime)</span>
              </button>

              <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-100 text-xs">Pop-up Desktop / Sistem</p>
                  <p className="text-[10px] text-slate-400">
                    {permState === 'granted' ? 'Notifikasi sistem aktif' : 'Muncul saat membuka tab lain'}
                  </p>
                </div>
                <button
                  onClick={handleToggleDesktop}
                  className={`w-11 h-6 rounded-full transition-colors relative flex-shrink-0 ${
                    desktopEnabled && permState === 'granted' ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                      desktopEnabled && permState === 'granted' ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {permState !== 'granted' && (
                <button
                  onClick={async () => {
                    const p = await requestNotificationPermission();
                    setPermState(p);
                    if (p === 'granted') {
                      setDesktopEnabled(true);
                      localStorage.setItem('wa_notif_desktop_enabled', 'true');
                    }
                  }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs transition active:scale-95 shadow-md shadow-emerald-600/20"
                >
                  Aktifkan Izin Notifikasi Browser
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {profileMenuOpen && (
        <div 
          onClick={() => setProfileMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-50 md:hidden flex items-end justify-center p-4 animate-fade-in"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-white dark:bg-[#1e293b] rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-700 animate-slide-up"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700 mb-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                {displayInitial}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{displayName}</p>
                <p className="text-xs text-slate-400 truncate">{user?.email || 'User'}</p>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] font-semibold">
                  <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  <span className={isConnected ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}>
                    {isConnected ? `WA: +${waStatus?.phoneNumber}` : 'WhatsApp Offline'}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => {
                  toggleTheme();
                  setProfileMenuOpen(false);
                }}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-500" />}
                  <span>{isDark ? 'Mode Terang' : 'Mode Gelap'}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 font-bold uppercase">
                  {theme}
                </span>
              </button>

              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  setNotifMenuOpen(true);
                }}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center justify-between transition"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Pengaturan Notifikasi</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                  soundEnabled ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'
                }`}>
                  {soundEnabled ? 'Aktif' : 'Mati'}
                </span>
              </button>

              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  setActiveTab('whatsapp');
                }}
                className="w-full px-4 py-3 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-xs flex items-center gap-2.5 transition"
              >
                <Smartphone className="w-4 h-4 text-indigo-600" />
                <span>Kelola Sesi WhatsApp</span>
              </button>

              <button
                onClick={() => {
                  setProfileMenuOpen(false);
                  logout();
                }}
                className="w-full px-4 py-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 font-bold text-xs flex items-center gap-2.5 transition"
              >
                <LogOut className="w-4 h-4" />
                <span>Keluar (Logout)</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
