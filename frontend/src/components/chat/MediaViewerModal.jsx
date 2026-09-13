import React, { useEffect } from 'react';
import { X, Download, ExternalLink, Eye, Play, Film, Image as ImageIcon } from 'lucide-react';

export default function MediaViewerModal({ media, onClose }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!media) return null;

  const { type, url, caption, isViewOnce } = media;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 animate-fade-in select-none">
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-10 pointer-events-auto">
        <div className="flex items-center gap-2">
          {isViewOnce && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 font-bold text-xs shadow-lg backdrop-blur-xs">
              <Eye className="w-3.5 h-3.5 animate-pulse" />
              Pesan Sekali Lihat (View Once)
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Buka di tab baru"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-xs"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          )}
          {url && (
            <a
              href={url}
              download
              title="Download File"
              className="p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition backdrop-blur-xs"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
          <button
            onClick={onClose}
            title="Tutup (Esc)"
            className="p-2.5 rounded-full bg-white/10 hover:bg-rose-600/80 text-white transition backdrop-blur-xs cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative max-w-4xl max-h-[80vh] flex flex-col items-center justify-center overflow-hidden">
        {type === 'video' ? (
          <video
            src={url}
            controls
            autoPlay
            playsInline
            className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl object-contain bg-black"
          />
        ) : (
          <img
            src={url}
            alt={caption || 'Preview Foto'}
            className="max-h-[75vh] max-w-full rounded-2xl shadow-2xl object-contain transition-transform duration-200"
          />
        )}

        {caption && caption !== '📷 Foto' && caption !== '🎥 Video' && (
          <div className="mt-3 px-4 py-2 rounded-xl bg-black/60 backdrop-blur-xs text-white text-xs max-w-xl text-center border border-white/10 shadow-lg">
            <p className="whitespace-pre-wrap break-words">{caption}</p>
          </div>
        )}
      </div>
    </div>
  );
}
