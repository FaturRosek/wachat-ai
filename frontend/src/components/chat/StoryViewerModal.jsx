import React, { useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, User, Send, Clock, Sparkles } from 'lucide-react';
import apiClient from '../../api/apiClient';

export default function StoryViewerModal({ stories = [], isOpen, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [progress, setProgress] = useState(0);

  const activeStory = stories[currentIndex];

  useEffect(() => {
    if (!isOpen || !stories.length) return;
    setProgress(0);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (currentIndex < stories.length - 1) {
            setCurrentIndex((i) => i + 1);
            return 0;
          } else {
            return 100;
          }
        }
        return prev + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, currentIndex, stories.length]);

  if (!isOpen || !stories.length) return null;

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((i) => i - 1);
      setProgress(0);
    }
  };

  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !activeStory) return;

    setSendingReply(true);
    try {
      await apiClient.post('/chats/send', {
        jid: activeStory.sender_jid || `${activeStory.sender_phone}@s.whatsapp.net`,
        message: `[Balasan Status]: ${replyText.trim()}`,
      });
      setReplyText('');
    } catch (e) {
      console.error('Failed to reply to story:', e);
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-2 sm:p-4 select-none">
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 text-white/80 hover:text-white bg-white/10 hover:bg-white/20 p-2 rounded-full transition"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Navigation arrows for desktop */}
      <button
        onClick={handlePrev}
        disabled={currentIndex === 0}
        className="hidden md:flex absolute left-8 top-1/2 -translate-y-1/2 z-40 text-white bg-white/10 hover:bg-white/20 disabled:opacity-30 p-3 rounded-full transition"
      >
        <ChevronLeft className="w-8 h-8" />
      </button>

      <button
        onClick={handleNext}
        className="hidden md:flex absolute right-8 top-1/2 -translate-y-1/2 z-40 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition"
      >
        <ChevronRight className="w-8 h-8" />
      </button>

      {/* Main Story Container */}
      <div className="w-full max-w-sm h-[85vh] max-h-[720px] bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-3xl overflow-hidden shadow-2xl flex flex-col relative border border-slate-800">
        
        {/* Top Progress Bars */}
        <div className="absolute top-3 left-3 right-3 z-30 flex items-center gap-1.5">
          {stories.map((s, idx) => (
            <div key={idx} className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%',
                }}
              ></div>
            </div>
          ))}
        </div>

        {/* Story Header (Sender info) */}
        <div className="absolute top-6 left-4 right-4 z-30 flex items-center justify-between text-white drop-shadow-md">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold ring-2 ring-emerald-400">
              {activeStory?.sender_name ? activeStory.sender_name.charAt(0).toUpperCase() : <User className="w-5 h-5" />}
            </div>
            <div>
              <h4 className="font-bold text-sm leading-tight text-white">
                {activeStory?.sender_name || `+${activeStory?.sender_phone}`}
              </h4>
              <p className="text-[11px] text-white/75 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {activeStory?.story_timestamp ? new Date(activeStory.story_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Baru saja'}
              </p>
            </div>
          </div>
        </div>

        {/* Story Content Area */}
        <div 
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const x = e.clientX - rect.left;
            if (x < rect.width / 3) handlePrev();
            else handleNext();
          }}
          className="flex-1 flex flex-col items-center justify-center p-6 text-center cursor-pointer relative"
        >
          {activeStory?.media_url ? (
            <img 
              src={activeStory.media_url} 
              alt="Story Media" 
              className="max-h-full max-w-full object-contain rounded-xl"
            />
          ) : (
            <div className="max-w-xs p-6 rounded-2xl bg-gradient-to-br from-emerald-900/60 to-blue-950/80 border border-emerald-500/30 text-white shadow-xl">
              <p className="text-base sm:text-lg font-medium leading-relaxed">
                {activeStory?.caption || 'Tidak ada teks status'}
              </p>
            </div>
          )}

          {activeStory?.media_url && activeStory.caption && (
            <div className="absolute bottom-16 left-4 right-4 bg-black/60 backdrop-blur-xs p-3 rounded-xl text-white text-xs">
              {activeStory.caption}
            </div>
          )}
        </div>

        {/* Reply to Story Input Bar */}
        <div className="p-3 bg-slate-900/90 border-t border-slate-800 z-30">
          <form onSubmit={handleSendReply} className="flex items-center gap-2">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Balas status ini..."
              className="flex-1 bg-slate-800 border border-slate-700 rounded-full px-4 py-2 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500"
            />
            <button
              type="submit"
              disabled={sendingReply || !replyText.trim()}
              className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}
