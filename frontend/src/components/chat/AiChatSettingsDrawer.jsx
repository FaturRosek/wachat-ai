import React, { useState, useEffect } from 'react';
import { X, Bot, Sparkles, FileText, Check, ShieldAlert, Zap, Send, Phone, User, Settings2, MessageSquare } from 'lucide-react';
import apiClient from '../../api/apiClient';

const PRESET_PERSONAS = [
  {
    name: 'CS Ramah & Solutif (Default)',
    tone: 'friendly',
    prompt: 'Anda adalah Customer Service yang ramah, sopan, dan sigap membantu pertanyaan pelanggan dengan jelas dalam 1-3 kalimat.',
  },
  {
    name: 'Sales & Closing Specialist',
    tone: 'persuasive',
    prompt: 'Anda adalah Sales Representative yang persuasif, komunikatif, dan antusias menawarkan promo produk serta mengajak pelanggan bertransaksi.',
  },
  {
    name: 'Resmi & Profesional (B2B)',
    tone: 'formal',
    prompt: 'Anda adalah perwakilan resmi perusahaan dengan gaya komunikasi profesional, baku, dan terstruktur.',
  },
  {
    name: 'Jawaban Cepat & To The Point',
    tone: 'short',
    prompt: 'Jawab pesan sesingkat dan sejelas mungkin tanpa basa-basi.',
  },
];

const STATIC_PRESETS = [
  {
    name: 'Sedang di Luar / Sibuk',
    text: 'Bentar yaa, ini pesan otomatis. Aku lagi di luar / ada urusan, nanti aku kabarin lagi yaa 🙏',
  },
  {
    name: 'Toko Tutup / Jam Operasional',
    text: 'Halo kak! Toko kami saat ini sedang tutup (Jam operasional 09:00 - 20:00). Pesan Anda akan kami balas saat toko buka kembali. Terima kasih! 😊',
  },
  {
    name: 'Pesan Diterima (Standar)',
    text: 'Halo! Pesan Anda sudah kami terima. Mohon tunggu sebentar, kami akan segera merespons.',
  },
  {
    name: 'Istirahat / Sholat',
    text: 'Mohon maaf saat ini sedang istirahat sejenak. Pesan akan segera dibalas secepatnya.',
  },
];

export default function AiChatSettingsDrawer({
  isOpen,
  onClose,
  activeContact,
  aiSetting,
  onUpdateAiSetting,
}) {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [replyMode, setReplyMode] = useState('ai');
  const [staticReplyText, setStaticReplyText] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [tone, setTone] = useState('friendly');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (aiSetting) {
      setAutoReplyEnabled(!!aiSetting.auto_reply_enabled);
      setReplyMode(aiSetting.reply_mode || 'ai');
      setStaticReplyText(aiSetting.static_reply_text || '');
      setCustomPrompt(aiSetting.custom_prompt || '');
      setTone(aiSetting.tone || 'friendly');
      setNotes(aiSetting.notes || '');
    } else {
      setAutoReplyEnabled(false);
      setReplyMode('ai');
      setStaticReplyText('');
      setCustomPrompt('');
      setTone('friendly');
      setNotes('');
    }
    setSummary('');
  }, [aiSetting, activeContact?.jid]);

  if (!isOpen || !activeContact) return null;

  const handleSave = async () => {
    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await apiClient.put(`/chats/${encodeURIComponent(activeContact.jid)}/ai-setting`, {
        autoReplyEnabled,
        replyMode,
        staticReplyText,
        customPrompt,
        tone,
        notes,
      });
      if (res.data.success) {
        onUpdateAiSetting(res.data.data);
        setSavedSuccess(true);
        setTimeout(() => setSavedSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Failed to save AI chat setting:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAutoReply = async () => {
    const nextState = !autoReplyEnabled;
    setAutoReplyEnabled(nextState);
    try {
      const res = await apiClient.patch(`/chats/${encodeURIComponent(activeContact.jid)}/toggle-auto-reply`, {
        enabled: nextState,
      });
      if (res.data.success) {
        onUpdateAiSetting(res.data.data);
      }
    } catch (e) {
      console.error('Failed to toggle auto-reply:', e);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const res = await apiClient.post('/chats/ai/summarize', {
        jid: activeContact.jid,
      });
      if (res.data.success && res.data.data?.summary) {
        setSummary(res.data.data.summary);
      }
    } catch (e) {
      console.error('Failed to summarize conversation:', e);
    } finally {
      setSummarizing(false);
    }
  };

  const applyPreset = (preset) => {
    setCustomPrompt(preset.prompt);
    setTone(preset.tone);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white dark:bg-[#111b21] shadow-2xl border-l border-slate-200 dark:border-[#222d34] flex flex-col animate-slide-left transition-colors duration-200">
      <div className="p-4 bg-white dark:bg-[#202c33] border-b border-slate-200 dark:border-[#2a3942] text-slate-900 dark:text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Info Kontak & Otomasi Chat</h3>
            <p className="text-[11px] text-slate-400">Pengaturan balasan otomatis & catatan</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        <div className="flex flex-col items-center text-center p-4 bg-slate-50/80 dark:bg-[#202c33]/70 rounded-2xl border border-slate-100 dark:border-[#2a3942]">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xl shadow-md shadow-blue-500/20 mb-2">
            {(activeContact.name || activeContact.phone || 'K').charAt(0).toUpperCase()}
          </div>
          <h4 className="font-bold text-slate-800 dark:text-white text-sm">
            {activeContact.name || `+${activeContact.phone}`}
          </h4>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            +{activeContact.phone || activeContact.jid}
          </p>
          {activeContact.is_group && (
            <span className="mt-2 text-[10px] font-bold bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 rounded-full">
              Grup WhatsApp
            </span>
          )}
        </div>

        <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 rounded-2xl border border-blue-200/80 dark:border-blue-900/60 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800 dark:text-white">Auto-Reply Otomatis</h5>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Balas chat kontak ini secara otomatis</p>
              </div>
            </div>

            <button
              onClick={handleToggleAutoReply}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                autoReplyEnabled ? 'bg-blue-600 justify-end' : 'bg-slate-300 dark:bg-slate-700 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
            </button>
          </div>

          {autoReplyEnabled && (
            <div className="mt-3 pt-3 border-t border-blue-200/60 dark:border-blue-900/50 flex items-center gap-1.5 text-[11px] text-blue-800 dark:text-blue-300 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              <span>
                {replyMode === 'static'
                  ? 'Pesan tetap aktif membalas setiap chat masuk 24/7.'
                  : 'AI aktif menjawab pesan masuk kontak ini 24/7.'}
              </span>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-2">
              Pilih Jenis Balasan Otomatis:
            </label>
            <div className="grid grid-cols-2 bg-slate-100 dark:bg-[#202c33] p-1 rounded-xl border border-slate-200/80 dark:border-[#2a3942]">
              <button
                type="button"
                onClick={() => setReplyMode('ai')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  replyMode === 'ai'
                    ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                <span>Balasan AI Pintar</span>
              </button>
              <button
                type="button"
                onClick={() => setReplyMode('static')}
                className={`py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                  replyMode === 'static'
                    ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Pesan Balasan Tetap</span>
              </button>
            </div>
          </div>

          {replyMode === 'static' ? (
            <div className="space-y-3 animate-fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Template Pesan Balasan Cepat:
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {STATIC_PRESETS.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setStaticReplyText(p.text)}
                      className="text-left p-2 rounded-xl border border-slate-200 dark:border-[#2a3942] hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-[10px] font-medium text-slate-700 dark:text-slate-300 transition"
                      title={p.text}
                    >
                      <p className="font-bold truncate">{p.name}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Teks Pesan Balasan Tetap *
                </label>
                <textarea
                  value={staticReplyText}
                  onChange={(e) => setStaticReplyText(e.target.value)}
                  rows={4}
                  placeholder="Contoh: Bentar yaa sayang, ini bot yang bales aku lagi diluar..."
                  className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl p-3 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#111b21] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-sans leading-relaxed"
                />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 leading-normal">
                  Saat ada chat masuk dari kontak ini, sistem akan langsung membalas dengan pesan tetap di atas tanpa proses AI.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                  <Settings2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  Instruksi AI (Persona Prompt)
                </label>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                {PRESET_PERSONAS.map((p, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="text-left p-2 rounded-xl border border-slate-200 dark:border-[#2a3942] hover:border-blue-500 dark:hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/40 text-[10px] font-medium text-slate-700 dark:text-slate-300 transition"
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={3}
                placeholder="Contoh: Jawab ramah dan jelaskan bahwa toko buka jam 09:00 - 21:00..."
                className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#111b21] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none font-sans"
              />

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">Gaya Bahasa (Tone):</label>
                <div className="grid grid-cols-4 gap-1">
                  {[
                    { id: 'friendly', label: 'Ramah 😊' },
                    { id: 'formal', label: 'Formal 👔' },
                    { id: 'persuasive', label: 'Sales 🚀' },
                    { id: 'short', label: 'Singkat ⚡' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setTone(t.id)}
                      className={`py-1.5 rounded-lg text-[10px] font-bold transition ${
                        tone === t.id
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2a3942]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-3.5 bg-slate-50 dark:bg-[#202c33]/60 border border-slate-200 dark:border-[#2a3942] rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              Rangkuman Obrolan
            </span>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="text-[11px] font-bold text-blue-700 dark:text-blue-300 hover:text-blue-800 bg-blue-100 dark:bg-blue-950 hover:bg-blue-200 dark:hover:bg-blue-900 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
            >
              {summarizing ? 'Menganalisis...' : 'Rangkum Chat'}
            </button>
          </div>

          {summary && (
            <div className="p-2.5 bg-white dark:bg-[#111b21] border border-blue-100 dark:border-blue-900/40 rounded-xl text-xs text-slate-700 dark:text-slate-200 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
              {summary}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1.5">
            Catatan Pribadi Kontak:
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Tambahkan catatan khusus untuk customer ini..."
            className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl p-2.5 text-xs text-slate-800 dark:text-slate-100 focus:bg-white dark:focus:bg-[#111b21] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
        </div>
      </div>

      <div className="p-4 bg-white dark:bg-[#202c33] border-t border-slate-100 dark:border-[#2a3942]">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-98 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-white" />
              Tersimpan!
            </>
          ) : saving ? (
            'Menyimpan...'
          ) : (
            'Simpan Pengaturan'
          )}
        </button>
      </div>
    </div>
  );
}
