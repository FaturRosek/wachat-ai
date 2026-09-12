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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-3xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden">
        {/* Glow effect */}
        <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/20 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-36 h-36 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

        <button
          onClick={handleDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          {/* Ringing pulse animation */}
          <div className="relative mb-4">
            <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-30"></div>
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center text-white shadow-lg shadow-emerald-500/30 relative">
              <Phone className="w-10 h-10 animate-bounce" />
            </div>
          </div>

          <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-3 py-1 rounded-full mb-2 flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5 animate-pulse" />
            Panggilan WhatsApp Masuk
          </span>

          <h3 className="text-xl font-bold text-white mb-1">
            +{call.callerPhone || 'Kontak WhatsApp'}
          </h3>
          <p className="text-xs text-slate-400 mb-6">
            Panggilan Suara Masuk ke Akun WhatsApp Anda
          </p>

          <div className="w-full bg-slate-800/80 border border-slate-700/80 rounded-2xl p-3.5 text-left mb-6">
            <label className="text-[11px] font-bold text-slate-300 flex items-center gap-1 mb-1.5">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              Pesan Balasan Otomatis Saat Ditolak:
            </label>
            <textarea
              value={customMsg}
              onChange={(e) => setCustomMsg(e.target.value)}
              rows={2}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3 w-full">
            <button
              onClick={handleDismiss}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
            >
              <PhoneOff className="w-4 h-4 text-red-400" />
              Tutup Alert
            </button>

            <button
              onClick={handleRejectWithAi}
              disabled={rejecting}
              className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition active:scale-95 disabled:opacity-50"
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
