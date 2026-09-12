import React, { useState, useEffect } from 'react';
import { X, Bot, Sparkles, FileText, Check, ShieldAlert, Zap, Send, Phone, User, Settings2 } from 'lucide-react';
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

export default function AiChatSettingsDrawer({
  isOpen,
  onClose,
  activeContact,
  aiSetting,
  onUpdateAiSetting,
}) {
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
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
      setCustomPrompt(aiSetting.custom_prompt || '');
      setTone(aiSetting.tone || 'friendly');
      setNotes(aiSetting.notes || '');
    } else {
      setAutoReplyEnabled(false);
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
    <div className="fixed inset-y-0 right-0 z-40 w-full max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-slide-left">
      {/* Header */}
      <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-emerald-400" />
          <h3 className="font-bold text-sm">Info Kontak & Otomasi AI</h3>
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-white rounded-full transition">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {/* Contact Profile Overview */}
        <div className="flex flex-col items-center text-center p-4 bg-slate-50 rounded-2xl border border-slate-100">
          <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-xl shadow-md mb-2">
            {(activeContact.name || activeContact.phone || 'K').charAt(0).toUpperCase()}
          </div>
          <h4 className="font-bold text-slate-800 text-sm">
            {activeContact.name || `+${activeContact.phone}`}
          </h4>
          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
            <Phone className="w-3 h-3" />
            +{activeContact.phone || activeContact.jid}
          </p>
          {activeContact.is_group && (
            <span className="mt-2 text-[10px] font-bold bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full">
              Grup WhatsApp
            </span>
          )}
        </div>

        {/* AI Auto-Reply Switch Card */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl border border-emerald-200/80 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-800">Auto-Reply AI</h5>
                <p className="text-[10px] text-slate-500">Balas chat kontak ini secara otomatis</p>
              </div>
            </div>

            <button
              onClick={handleToggleAutoReply}
              className={`w-12 h-6 flex items-center rounded-full p-1 transition duration-300 ${
                autoReplyEnabled ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow-md"></div>
            </button>
          </div>

          {autoReplyEnabled && (
            <div className="mt-3 pt-3 border-t border-emerald-200/60 flex items-center gap-1.5 text-[11px] text-emerald-800 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>AI aktif menjawab pesan masuk kontak ini 24/7.</span>
            </div>
          )}
        </div>

        {/* AI Persona Prompt Configuration */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Settings2 className="w-3.5 h-3.5 text-blue-600" />
              Instruksi AI (Persona Prompt)
            </label>
          </div>

          {/* Persona Presets */}
          <div className="grid grid-cols-2 gap-1.5">
            {PRESET_PERSONAS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-left p-2 rounded-xl border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/40 text-[10px] font-medium text-slate-700 transition"
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
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 resize-none font-sans"
          />

          {/* AI Tone Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Gaya Bahasa (Tone):</label>
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
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* AI Chat Summarizer */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              Rangkuman Obrolan
            </span>
            <button
              onClick={handleSummarize}
              disabled={summarizing}
              className="text-[11px] font-bold text-purple-700 hover:text-purple-800 bg-purple-100 hover:bg-purple-200 px-2.5 py-1 rounded-lg transition disabled:opacity-50"
            >
              {summarizing ? 'Menganalisis...' : 'Rangkum Chat'}
            </button>
          </div>

          {summary && (
            <div className="p-2.5 bg-white border border-purple-100 rounded-xl text-xs text-slate-700 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
              {summary}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
            Catatan Pribadi Kontak:
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Tambahkan catatan khusus untuk customer ini..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500 resize-none"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="p-4 bg-white border-t border-slate-100">
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-md shadow-slate-900/20 active:scale-98 disabled:opacity-50"
        >
          {savedSuccess ? (
            <>
              <Check className="w-4 h-4 text-emerald-400" />
              Tersimpan!
            </>
          ) : saving ? (
            'Menyimpan...'
          ) : (
            'Simpan Pengaturan AI'
          )}
        </button>
      </div>
    </div>
  );
}
