import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Send, Mic } from 'lucide-react';

export default function VoiceNoteRecorder({ onSend, onCancel }) {
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function startRecording() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        let mimeType = '';
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        }

        const options = mimeType ? { mimeType } : {};
        const mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.start(100);
        setIsRecording(true);

        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Microphone access error:', err);
        alert('Tidak dapat mengakses mikrofon. Pastikan izin mikrofon telah diberikan pada browser.');
        onCancel();
      }
    }

    startRecording();

    return () => {
      isMounted = false;
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleCancel = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    audioChunksRef.current = [];
    onCancel();
  };

  const handleSend = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === 'inactive') {
      onCancel();
      return;
    }

    if (timerRef.current) clearInterval(timerRef.current);

    mediaRecorderRef.current.onstop = () => {
      const mimeType = mediaRecorderRef.current.mimeType || 'audio/ogg';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioBlob.size > 0) {
        onSend(audioBlob);
      } else {
        onCancel();
      }
    };

    mediaRecorderRef.current.stop();
  };

  const formatTime = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="flex-1 flex items-center justify-between bg-white dark:bg-[#202c33] rounded-xl px-3 py-2 border border-blue-500/30 shadow-xs animate-in fade-in duration-200">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleCancel}
          title="Hapus / Batal"
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
          <span className="font-mono font-bold text-xs text-slate-700 dark:text-slate-200">
            {formatTime(recordingTime)}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1.5 px-4 overflow-hidden">
        {[20, 45, 80, 40, 100, 60, 30, 90, 70, 50, 85, 40, 65, 30, 95, 50].map((h, i) => (
          <div
            key={i}
            style={{ height: `${Math.max(15, (h * ((recordingTime % 3) + 1)) / 3)}%` }}
            className="w-[3px] bg-red-400/80 rounded-full transition-all duration-300"
          />
        ))}
      </div>

      <button
        type="button"
        onClick={handleSend}
        title="Kirim Voice Note"
        className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 transition active:scale-95 flex items-center justify-center flex-shrink-0"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
