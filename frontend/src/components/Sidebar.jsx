import React from 'react';
import { 
  LayoutGrid, 
  Smartphone, 
  Send, 
  Clock, 
  Users, 
  FileText, 
  LogOut, 
  X, 
  MessageSquare,
  Sparkles,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const menuItems = [
  { section: 'WHATSAPP WEB & AI', items: [
    { id: 'chat', label: 'Live Chat (WA Web)', icon: MessageSquare, isLiveChat: true },
    { id: 'dashboard', label: 'Dashboard & Statistik', icon: LayoutGrid },
    { id: 'whatsapp', label: 'Koneksi WhatsApp', icon: Smartphone, showWaBadge: true },
    { id: 'compose', label: 'Kirim Blast / Campaign', icon: Send },
    { id: 'history', label: 'Riwayat Pesan', icon: Clock }
  ]},
  { section: 'MANAJEMEN DATA', items: [
    { id: 'contacts', label: 'Buku Kontak', icon: Users, showContactCount: true },
    { id: 'templates', label: 'Template Pesan', icon: FileText },
  ]}
];

export default function Sidebar({ activeTab, setActiveTab, isOpen, onClose, waStatus, totalContacts = 0 }) {
  const { logout, user } = useAuth();
  const isConnected = waStatus?.status === 'CONNECTED';

  const handleMenuClick = (id) => {
    setActiveTab(id);
    if (onClose) onClose();
  };

  const displayName = user?.name || user?.email || 'Pengguna';
  const displayInitial = displayName.charAt(0).toUpperCase();

  const content = (
    <div className="flex flex-col justify-between h-full bg-white border-r border-slate-200 select-none">
      <div>
        <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Bot className="w-5 h-5 fill-white/20 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h1 className="font-bold text-base text-slate-900 tracking-tight">WaChat AI</h1>
                <span className="px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-full leading-none">
                  V2.5
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-normal leading-tight mt-0.5">WhatsApp Web AI Client</p>
            </div>
          </div>

          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="py-4 px-3 space-y-5">
          {menuItems.map((group, idx) => (
            <div key={idx}>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                {group.section}
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;

                  return (
                    <button
                      key={item.id}
                      onClick={() => handleMenuClick(item.id)}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                        isActive
                          ? item.isLiveChat 
                            ? 'bg-emerald-50 text-emerald-700 font-bold shadow-xs border border-emerald-200/60'
                            : 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <Icon className={`w-4 h-4 ${isActive ? (item.isLiveChat ? 'text-emerald-600' : 'text-blue-600') : 'text-slate-400'}`} />
                        <span>{item.label}</span>
                      </div>

                      {item.isLiveChat && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 animate-pulse">
                          Live
                        </span>
                      )}

                      {item.showWaBadge && (
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                          isConnected 
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {isConnected ? 'Online' : 'Offline'}
                        </span>
                      )}

                      {item.showContactCount && (
                        <span className="text-xs font-semibold text-slate-400">
                          {totalContacts}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs">
              {displayInitial}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate leading-tight">{displayName}</p>
              <div className="flex items-center space-x-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] text-slate-500 font-medium">Pengguna Aktif</span>
              </div>
            </div>
          </div>

          <button
            onClick={logout}
            title="Keluar dari akun"
            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition shrink-0 ml-1"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden md:flex w-64 bg-white border-r border-slate-200 flex-col shrink-0 h-screen sticky top-0 z-30">
        {content}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onClose}
          />

          <aside className="relative w-72 max-w-[80vw] bg-white border-r border-slate-200 flex-col h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200 flex">
            {content}
          </aside>
        </div>
      )}
    </>
  );
}
