import React, { useState, useRef } from 'react';
import { Play, Pause, Maximize2, Volume2, VolumeX, Eye } from 'lucide-react';

export default function WhatsAppVideoPlayer({ videoUrl, isMe = false, caption = null, isViewOnce = false, onExpand = null }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const togglePlay = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('Video play error:', err);
      });
    }
  };

  const toggleMute = (e) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  return (
    <div className="mb-1 rounded-xl overflow-hidden max-w-xs relative group bg-black/90 select-none shadow-md">
      {isViewOnce && (
        <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-amber-300 border border-amber-400/40 text-[10px] font-bold shadow-md">
          <Eye className="w-3 h-3 text-amber-400 animate-pulse" />
          <span>Sekali Lihat</span>
        </div>
      )}

      {onExpand && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onExpand();
          }}
          title="Lihat Layar Penuh"
          className="absolute top-2 right-2 z-10 p-1.5 rounded-lg bg-black/60 hover:bg-black/80 text-white/90 transition backdrop-blur-xs cursor-pointer opacity-0 group-hover:opacity-100 duration-200"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      )}

      <video
        ref={videoRef}
        src={videoUrl}
        preload="metadata"
        playsInline
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="w-full h-auto max-h-64 object-cover rounded-xl cursor-pointer"
        onClick={togglePlay}
      />

      {!isPlaying && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer transition group-hover:bg-black/40"
        >
          <div className="w-12 h-12 rounded-full bg-white/90 dark:bg-slate-900/90 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xl transition transform group-hover:scale-110 active:scale-95">
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </div>
        </div>
      )}

      <div className={`absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between text-white text-[10px] transition-opacity duration-200 ${isPlaying ? 'opacity-0 group-hover:opacity-100' : 'opacity-100'}`}>
        <button
          type="button"
          onClick={togglePlay}
          className="p-1 hover:text-blue-400 transition"
        >
          {isPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleMute}
            className="p-1 hover:text-blue-400 transition"
          >
            {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {caption && caption !== '🎥 Video' && caption !== '👁️ Video (Sekali Lihat)' && (
        <div className="p-2 bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100">
          <p className="whitespace-pre-wrap break-words text-xs">{caption}</p>
        </div>
      )}
    </div>
  );
}
