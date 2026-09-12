import React, { useState } from 'react';
import { Phone, PhoneOff, Bot, X, MessageSquare, Volume2 } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function IncomingCallModal({ call, onClose }) {
  const [rejecting, setRejecting] = useState(false);
  const [customMsg, setCustomMsg] = useState('Maaf saya sedang tidak dapat menerima panggilan, silakan kirimkan pesan teks ya.');

  if (!call) return null;

  const handleRejectWithAi = async () => {
    setRejecting(true);
    try {
      if (call.callerJid && customMsg) {
        await apiClient.post('/chats/send', {
          jid: call.callerJid,
          message: customMsg,
        });
      }
    } catch (e) {
      console.error('Failed to send auto-reply message on call reject:', e);
    } finally {
      setRejecting(false);
      onClose();
    }
  };

  const handleDismiss = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] text-slate-800 dark:text-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden transition-colors duration-200">
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>

        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1.5 hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-xl transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-blue-500 animate-ping opacity-25"></div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30 relative">
              <Phone className="w-10 h-10 animate-bounce text-white" />
            </div>
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900/60 px-3 py-1 rounded-full mb-2 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 animate-pulse text-blue-600 dark:text-blue-400" />
            Panggilan WhatsApp Masuk
          </span>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">
            +{call.callerPhone || 'Kontak WhatsApp'}
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Panggilan Suara Masuk ke Akun WhatsApp Anda
          </p>

          <div className="w-full bg-slate-50 dark:bg-[#202c33]/70 border border-slate-200 dark:border-[#2a3942] rounded-2xl p-3.5 text-left mb-6">
            <label className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1 mb-1.5">
              <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Pesan Balasan Otomatis Saat Ditolak:
            </label>
            <textarea
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              rows={2}
              className="w-full bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#2a3942] rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={handleDismiss}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 dark:bg-[#202c33] hover:bg-slate-200 dark:hover:bg-[#2a3942] text-slate-700 dark:text-slate-200 font-bold text-xs transition"
            >
              <PhoneOff className="w-4 h-4 text-rose-500" />
              Tutup Alert
            </button>

            <button
              onClick={handleRejectWithAi}
              disabled={rejecting}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition active:scale-95 disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4" />
              {rejecting ? 'Mengirim...' : 'Tolak & Balas AI'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
