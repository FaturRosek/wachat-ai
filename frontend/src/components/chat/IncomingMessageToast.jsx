import React, { useEffect, useState } from 'react';
import { MessageCircle, X, ChevronRight } from 'lucide-react';

export default function IncomingMessageToast({ toast, onOpenChat, onClose }) {
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (!toast) return;

    const timer = setTimeout(() => {
      handleClose();
    }, 5500);

    return () => clearTimeout(timer);
  }, [toast]);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
      setIsClosing(false);
    }, 250);
  };

  if (!toast) return null;

  const { title, body, avatar, jid } = toast;

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full bg-white dark:bg-[#111b21] border border-slate-200/80 dark:border-[#2a3942] rounded-2xl shadow-xl shadow-slate-900/15 overflow-hidden transition-all duration-200 transform ${
        isClosing ? 'opacity-0 translate-y-[-10px] scale-95' : 'opacity-100 translate-y-0 scale-100 animate-in slide-in-from-top-3 duration-200'
      }`}
    >
      <div className="p-3.5 flex items-start gap-3">
        {avatar ? (
          <img
            src={avatar}
            alt={title}
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-slate-200/50 dark:border-[#222d34]"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 font-bold text-sm">
            <MessageCircle className="w-5 h-5" />
          </div>
        )}

        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
              {title}
            </h4>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded-full">
              Pesan Baru
            </span>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
            {body}
          </p>

          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => {
                onOpenChat(jid);
                handleClose();
              }}
              className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 flex items-center gap-1 transition active:scale-95"
            >
              <span>Balas Pesan</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <button
          onClick={handleClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-[#202c33] transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="h-0.5 w-full bg-slate-100 dark:bg-[#182229]">
        <div className="h-full bg-emerald-500 animate-[toastProgress_5.5s_linear_forwards]" />
      </div>
    </div>
  );
}
