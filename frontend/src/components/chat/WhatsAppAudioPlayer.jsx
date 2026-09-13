import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Mic } from 'lucide-react';

const WAVE_BARS = [
  35, 60, 45, 80, 50, 95, 70, 40, 85, 65, 100, 75, 45, 90, 60, 80, 50, 70, 40, 95, 60, 45, 75, 55, 90, 65, 40, 70, 50, 35
];

export default function WhatsAppAudioPlayer({ audioUrl, isMe = false, senderAvatar = null }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onError = () => {
      setHasError(true);
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('durationchange', updateDuration);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('durationchange', updateDuration);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
    };
  }, [audioUrl]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || hasError) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((e) => {
        console.warn('Audio play error:', e);
        setIsPlaying(false);
      });
    }
  };

  const handleSeek = (e) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const newTime = Math.max(0, Math.min(duration, (clickX / width) * duration));
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
    audio.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || !isFinite(secs) || secs <= 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={`flex items-center gap-3 py-1.5 px-1 select-none min-w-[220px] max-w-[320px] ${isMe ? 'text-white' : 'text-slate-800 dark:text-slate-100'}`}>
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <div className="relative flex-shrink-0">
        <button
          type="button"
          onClick={togglePlay}
          disabled={hasError}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition shadow-xs active:scale-95 ${
            isMe
              ? 'bg-white text-blue-600 hover:bg-slate-100'
              : 'bg-emerald-500 hover:bg-emerald-600 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500'
          }`}
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 fill-current" />
          ) : (
            <Play className="w-5 h-5 fill-current ml-0.5" />
          )}
        </button>

        <span
          className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] ring-2 shadow-xs ${
            isMe
              ? 'bg-blue-800 text-blue-200 ring-blue-600'
              : 'bg-emerald-700 text-emerald-100 ring-white dark:ring-[#202c33]'
          }`}
        >
          <Mic className="w-2.5 h-2.5" />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div
          onClick={handleSeek}
          className="h-8 flex items-center gap-[2.5px] cursor-pointer group py-1"
        >
          {WAVE_BARS.map((height, i) => {
            const barPos = (i / WAVE_BARS.length) * 100;
            const isPlayed = barPos <= progress;

            return (
              <div
                key={i}
                style={{ height: `${height}%` }}
                className={`w-[3px] rounded-full transition-colors duration-150 ${
                  isPlayed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-emerald-500 dark:bg-emerald-400'
                    : isMe
                    ? 'bg-blue-300/50 group-hover:bg-blue-200/70'
                    : 'bg-slate-300 dark:bg-[#374248] group-hover:bg-slate-400 dark:group-hover:bg-[#4a555c]'
                }`}
              />
            );
          })}
        </div>

        <div className="flex items-center justify-between text-[10px] opacity-80 mt-0.5 font-medium">
          <span>{isPlaying ? formatTime(currentTime) : formatTime(duration || currentTime)}</span>

          {isPlaying && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleSpeed();
              }}
              className={`px-1.5 py-0.2 rounded-md font-bold text-[9px] transition ${
                isMe
                  ? 'bg-blue-700/80 text-white hover:bg-blue-800'
                  : 'bg-slate-200 dark:bg-[#374248] text-slate-700 dark:text-slate-200 hover:bg-slate-300'
              }`}
            >
              {playbackSpeed}x
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
