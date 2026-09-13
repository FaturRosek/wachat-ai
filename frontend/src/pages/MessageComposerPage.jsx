import React, { useState, useEffect, useRef } from 'react';
import apiClient from '../api/apiClient';
import { 
  Send, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Repeat, 
  User, 
  RefreshCw,
  Copy,
  Check,
  RotateCcw,
  Edit3,
  CheckCheck
} from 'lucide-react';

const AI_TONE_OPTIONS = [
  { id: 'romantic', label: 'Romantis & Manis', icon: '💖' },
  { id: 'casual', label: 'Santai & Gaul', icon: '😎' },
  { id: 'friendly', label: 'Ramah & Akrab', icon: '✨' },
  { id: 'persuasive', label: 'Persuasif & Promosi', icon: '🎯' },
  { id: 'formal', label: 'Formal & Profesional', icon: '👔' },
  { id: 'short', label: 'Singkat & Padat', icon: '⚡' },
  { id: 'reminder', label: 'Pengingat / Tagihan', icon: '⏰' },
  { id: 'apology', label: 'Permohonan Maaf', icon: '🙏' },
];

export default function MessageComposerPage({ waStatus }) {
  const [recipientType, setRecipientType] = useState('personal');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');

  const [message, setMessage] = useState('');
  const [selectedTone, setSelectedTone] = useState('persuasive');
  const [variations, setVariations] = useState([]);
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [hasVariations, setHasVariations] = useState(false);
  const [copied, setCopied] = useState(false);

  const [repeatCount, setRepeatCount] = useState(1);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [useAiVariation, setUseAiVariation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const previewTextareaRef = useRef(null);
  const chatCanvasRef = useRef(null);
  const isConnected = waStatus?.status === 'CONNECTED';

  const fetchInitialData = async () => {
    try {
      const contactsRes = await apiClient.get('/contacts?type=personal&limit=200');
      const raw = contactsRes.data.data?.contacts || contactsRes.data.data || [];
      const personalOnly = raw.filter((c) => !c.is_group && !String(c.phone || '').includes('@g.us') && !String(c.jid || '').includes('@g.us'));
      setContacts(personalOnly);
    } catch (err) {
      console.error('Error fetching composer data:', err);
    }
  };

  const fetchGroups = async () => {
    if (!isConnected) return;
    setLoadingGroups(true);
    try {
      const res = await apiClient.get('/whatsapp/groups');
      setGroups(res.data.data?.groups || []);
    } catch (err) {
      console.warn('Gagal memuat grup WhatsApp:', err.message);
    } finally {
      setLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (isConnected) {
      fetchGroups();
    }
  }, [isConnected]);

  useEffect(() => {
    if (!hasVariations) {
      setVariations(message ? [message] : []);
      setActiveVariationIndex(0);
    }
  }, [message, hasVariations]);

  const currentPreviewText = variations[activeVariationIndex] ?? message ?? '';
  useEffect(() => {
    if (previewTextareaRef.current) {
      previewTextareaRef.current.style.height = 'auto';
      previewTextareaRef.current.style.height = `${Math.max(120, previewTextareaRef.current.scrollHeight)}px`;
    }
  }, [currentPreviewText, activeVariationIndex]);

  useEffect(() => {
    if (chatCanvasRef.current) {
      chatCanvasRef.current.scrollTop = 0;
    }
  }, [activeVariationIndex]);

  const handleContactSelect = (contactId) => {
    setSelectedContact(contactId);
    if (!contactId) {
      setPhone('');
      setContactName('');
      return;
    }
    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      const cleanNum = (c.phone || c.jid || '').replace(/[^0-9]/g, '');
      setPhone(cleanNum);
      setContactName(c.name || '');
    }
  };

  const handleGroupSelect = (groupId) => {
    setSelectedGroup(groupId);
    if (!groupId) {
      setPhone('');
      setContactName('');
      return;
    }
    const g = groups.find((item) => item.id === groupId);
    if (g) {
      setPhone(g.id);
      setContactName(g.subject);
    }
  };

  const handleGenerateVariations = async (targetCount = null, toneOverride = null) => {
    const textToVary = (message || currentPreviewText || '').trim();
    if (!textToVary) {
      setErrorMsg('Ketik isi pesan WhatsApp terlebih dahulu');
      return;
    }

    setErrorMsg('');
    setIsGeneratingAi(true);

    const countToGenerate = targetCount || (repeatCount > 1 ? repeatCount : 1);
    const activeTone = toneOverride || selectedTone;

    try {
      const res = await apiClient.post('/chats/ai/variations', {
        message: textToVary,
        count: countToGenerate,
        tone: activeTone,
        recipientName: contactName || (recipientType === 'group' ? 'Teman-teman Grup' : '')
      });

      const generatedList = res.data.data?.variations || [];
      if (Array.isArray(generatedList) && generatedList.length > 0) {
        setVariations(generatedList);
        setHasVariations(true);
        setActiveVariationIndex(0);
        setUseAiVariation(true);
      } else {
        setVariations([textToVary]);
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Gagal membuat variasi dengan AI');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handlePreviewTextChange = (e) => {
    const newText = e.target.value;
    setVariations((prev) => {
      const updated = [...(prev.length > 0 ? prev : [message])];
      updated[activeVariationIndex] = newText;
      return updated;
    });
  };

  const handleResetToOriginal = () => {
    setVariations(message ? [message] : []);
    setHasVariations(false);
    setActiveVariationIndex(0);
  };

  const handleCopyPreview = () => {
    if (!currentPreviewText) return;
    navigator.clipboard.writeText(currentPreviewText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    const target = recipientType === 'group' ? selectedGroup : phone;
    const finalMessages = variations.filter((v) => typeof v === 'string' && v.trim().length > 0);
    const fallbackMessage = (finalMessages[0] || message || '').trim();

    if (!target) {
      setErrorMsg(recipientType === 'group' ? 'Pilih grup tujuan terlebih dahulu' : 'Nomor tujuan wajib diisi');
      return;
    }

    if (!fallbackMessage && finalMessages.length === 0) {
      setErrorMsg('Isi pesan tidak boleh kosong');
      return;
    }

    setLoading(true);

    try {
      const res = await apiClient.post('/messages', {
        phone: target,
        message: fallbackMessage,
        messages: hasVariations && finalMessages.length > 0 ? finalMessages : undefined,
        contactName: contactName || undefined,
        repeatCount: parseInt(repeatCount, 10) || 1,
        intervalSeconds: parseInt(intervalSeconds, 10) || 5,
        useAiVariation: hasVariations ? false : useAiVariation
      });

      setSuccessMsg(res.data.message || `Pesan berhasil dikirim ke ${contactName || target}!`);
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Gagal mengirim pesan WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const totalEstimatedTime = repeatCount > 1 ? (repeatCount - 1) * intervalSeconds : 0;
  const currentRecipientLabel = recipientType === 'group' 
    ? (contactName ? `Grup: ${contactName}` : 'Grup WhatsApp')
    : (contactName ? `${contactName} (${phone || 'Nomor belum diisi'})` : (phone || 'Nomor Personal'));

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Kirim Pesan & Variasi AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ketik pesan langsung, variasikan kalimat dengan AI agar lebih memikat, edit di preview simulasi WhatsApp, lalu kirim ke tujuan.
          </p>
        </div>

        <div className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center space-x-1.5 self-start sm:self-auto ${
          isConnected 
            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
        }`}>
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
          <span>{isConnected ? 'WhatsApp Terhubung' : 'WhatsApp Belum Terhubung'}</span>
        </div>
      </div>

      {!isConnected && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center space-x-3 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Status WhatsApp saat ini belum terhubung. Pastikan WhatsApp terhubung sebelum mengirim pesan.</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center justify-between space-x-3 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-600 dark:text-emerald-400 font-bold hover:underline">
            Tutup
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center justify-between space-x-3 text-rose-600 dark:text-rose-300 text-xs sm:text-sm">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-rose-600 dark:text-rose-400 font-bold hover:underline">
            Tutup
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-5 sm:p-7 shadow-xs space-y-5">
          <div className="flex bg-slate-100 dark:bg-[#202c33] p-1 rounded-2xl border border-slate-200/80 dark:border-[#2a3942]">
            <button
              type="button"
              onClick={() => {
                setRecipientType('personal');
                setSelectedGroup('');
                setPhone('');
                setContactName('');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-xs font-bold rounded-xl transition ${
                recipientType === 'personal'
                  ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-4 h-4" />
              <span>Kontak Personal</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRecipientType('group');
                setSelectedContact('');
                setPhone('');
                setContactName('');
                if (groups.length === 0 && isConnected) fetchGroups();
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2.5 text-xs font-bold rounded-xl transition ${
                recipientType === 'group'
                  ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Grup WhatsApp {groups.length > 0 && `(${groups.length})`}</span>
            </button>
          </div>

          {recipientType === 'personal' ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                  Pilih Dari Kontak Tersimpan
                </label>
                <select
                  value={selectedContact}
                  onChange={(e) => handleContactSelect(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
                >
                  <option value="">-- Ketik manual di bawah --</option>
                  {contacts
                    .filter((c) => !c.is_group && !String(c.phone || '').includes('@g.us') && !String(c.jid || '').includes('@g.us'))
                    .map((c) => {
                      const cleanNum = (c.phone || c.jid || '').replace(/[^0-9]/g, '');
                      return (
                        <option key={c.id} value={c.id}>
                          {c.name || `+${cleanNum}`} {cleanNum ? `(+${cleanNum})` : ''}
                        </option>
                      );
                    })}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                    Nomor WhatsApp Tujuan *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="08123456789 atau 628123456789"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                    Nama Penerima (Opsional)
                  </label>
                  <input
                    type="text"
                    placeholder="Nama Kontak"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                  Pilih Grup WhatsApp *
                </label>
                <button
                  type="button"
                  onClick={fetchGroups}
                  disabled={loadingGroups}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-700 font-semibold flex items-center space-x-1"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingGroups ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
              <select
                required
                value={selectedGroup}
                onChange={(e) => handleGroupSelect(e.target.value)}
                className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
              >
                <option value="">-- Pilih Grup yang Diikuti --</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.subject} ({g.participantsCount} Anggota)
                  </option>
                ))}
              </select>

              {selectedGroup && (
                <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span>Target: <strong>{contactName}</strong></span>
                  </div>
                  <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300 truncate max-w-[150px]">{selectedGroup}</span>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                Isi Pesan WhatsApp *
              </label>
              <span className="text-xs text-slate-400">{message.length} karakter</span>
            </div>
            <textarea
              rows={4}
              required
              placeholder={recipientType === 'group' ? 'Ketik pesan pengumuman / obrolan grup di sini...' : 'Ketik isi pesan WhatsApp di sini...'}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-2xl p-4 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21] transition leading-relaxed"
            />
          </div>

          <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-50/80 via-indigo-50/70 to-blue-50/80 dark:from-blue-950/30 dark:via-indigo-950/40 dark:to-blue-950/30 border border-blue-200/80 dark:border-blue-800/60 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs font-bold text-blue-900 dark:text-blue-200">
                <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span>Variasikan & Poles dengan AI:</span>
              </div>
              <span className="text-[11px] text-blue-600 dark:text-blue-400 font-medium">
                Pilih Gaya & Klik Tombol
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {AI_TONE_OPTIONS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setSelectedTone(t.id);
                    if (message.trim()) {
                      handleGenerateVariations(null, t.id);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 border ${
                    selectedTone === t.id
                      ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                      : 'bg-white dark:bg-[#111b21] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2a3942] hover:border-blue-400'
                  }`}
                >
                  <span>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleGenerateVariations()}
              disabled={isGeneratingAi || !message.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center space-x-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGeneratingAi ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Merangkai Variasi Kalimat yang Menarik...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{hasVariations ? 'Perbarui Variasi Pesan AI ✨' : 'Variasikan dengan AI Sekarang ✨'}</span>
                </>
              )}
            </button>
          </div>

          <div className="bg-slate-50 dark:bg-[#202c33]/70 border border-slate-200 dark:border-[#2a3942] rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Repeat className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                  Pengaturan Pengiriman Berulang
                </span>
              </div>
              {repeatCount > 1 && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 font-bold">
                  {repeatCount}x Pengiriman
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Jumlah Kirim (Repeat Count)
                </label>
                <div className="flex space-x-1 mb-1.5">
                  {[1, 3, 5, 10, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => {
                        setRepeatCount(num);
                        if (hasVariations && variations.length !== num && message.trim()) {
                          handleGenerateVariations(num);
                        }
                      }}
                      className={`flex-1 py-1 text-xs font-bold rounded-lg transition border ${
                        repeatCount === num
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white dark:bg-[#111b21] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2a3942] hover:border-slate-300'
                      }`}
                    >
                      {num}x
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={repeatCount}
                  onChange={(e) => setRepeatCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#2a3942] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  placeholder="Custom jumlah..."
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                  Jeda Antar Pesan (Detik)
                </label>
                <div className="flex space-x-1 mb-1.5">
                  {[1, 2, 3, 5, 10].map((sec) => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => setIntervalSeconds(sec)}
                      className={`flex-1 py-1 text-xs font-bold rounded-lg transition border ${
                        intervalSeconds === sec
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-white dark:bg-[#111b21] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2a3942] hover:border-slate-300'
                      }`}
                    >
                      {sec}s
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#2a3942] rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-blue-500"
                  placeholder="Custom detik (min. 1s)..."
                />
              </div>
            </div>

            {repeatCount > 1 && (
              <div className="pt-2 border-t border-slate-200 dark:border-[#2a3942] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={useAiVariation}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setUseAiVariation(checked);
                      if (checked && !hasVariations && message.trim()) {
                        handleGenerateVariations();
                      }
                    }}
                    className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                  />
                  <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-bold">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    <span>Variasikan Kalimat Pesan dengan AI di Setiap Kirim</span>
                  </div>
                </label>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                  ⏱️ Estimasi: ~{totalEstimatedTime} detik
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !isConnected || !currentPreviewText.trim()}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl transition flex items-center justify-center space-x-2 shadow-md shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <Send className="w-4 h-4" />
            <span>
              {loading
                ? 'Sedang Mengirim Pesan...'
                : repeatCount > 1
                ? `Kirim ${repeatCount}x ke ${recipientType === 'group' ? 'Grup' : 'Kontak'} (${intervalSeconds}s Jeda)`
                : `Kirim Pesan ke ${recipientType === 'group' ? (contactName || 'Grup') : (contactName || phone || 'Nomor Tujuan')}`}
            </span>
          </button>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-[#222d34]">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-bold text-base text-slate-900 dark:text-white">
                    Live WhatsApp Preview
                  </h3>
                  {hasVariations && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                      ✨ Hasil AI (Bisa Diedit)
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik teks di dalam bubble chat hijau untuk mengedit sebelum dikirim
                </p>
              </div>

              <div className="flex items-center space-x-1">
                {hasVariations && (
                  <button
                    type="button"
                    onClick={() => handleGenerateVariations()}
                    disabled={isGeneratingAi}
                    title="Generate ulang variasi AI"
                    className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-blue-600 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isGeneratingAi ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopyPreview}
                  disabled={!currentPreviewText}
                  title="Salin teks pesan"
                  className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-blue-600 transition"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
                {hasVariations && (
                  <button
                    type="button"
                    onClick={handleResetToOriginal}
                    title="Reset ke teks asli"
                    className="p-1.5 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#202c33] hover:text-amber-600 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {hasVariations && variations.length > 1 && (
              <div className="mt-3 flex items-center space-x-1.5 overflow-x-auto pb-1">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 mr-1">
                  Variasi:
                </span>
                {variations.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveVariationIndex(idx)}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition shrink-0 border ${
                      activeVariationIndex === idx
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                        : 'bg-slate-100 dark:bg-[#202c33] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#2a3942] hover:border-slate-300'
                    }`}
                  >
                    Pesan #{idx + 1}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-3 rounded-2xl border border-slate-200 dark:border-[#222d34] overflow-hidden shadow-inner bg-[#efeae2] dark:bg-[#0b141a] flex flex-col">
              <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-3.5 py-2.5 border-b border-slate-200/80 dark:border-[#2a3942] flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white font-bold text-xs shadow-xs">
                    {recipientType === 'group' ? <Users className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                      {contactName || (recipientType === 'group' ? 'Grup WhatsApp' : phone || 'Penerima WhatsApp')}
                    </h4>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      {recipientType === 'group' ? 'Grup WhatsApp' : 'Online'}
                    </span>
                  </div>
                </div>

                <div className="text-[10px] px-2 py-0.5 rounded-md bg-white/80 dark:bg-[#111b21]/80 text-slate-500 dark:text-slate-400 font-mono">
                  {hasVariations && variations.length > 1 ? `Pesan ${activeVariationIndex + 1} dari ${variations.length}` : 'Preview'}
                </div>
              </div>

              <div 
                ref={chatCanvasRef}
                className="p-4 h-[340px] sm:h-[400px] overflow-y-auto space-y-3 scroll-smooth"
              >
                <div className="flex justify-center sticky top-0 z-10 py-0.5">
                  <span className="px-2.5 py-0.5 rounded-lg bg-white/80 dark:bg-[#182229]/90 text-[10px] font-semibold text-slate-600 dark:text-slate-300 shadow-2xs backdrop-blur-xs">
                    HARI INI
                  </span>
                </div>

                {recipientType === 'group' && contactName && (
                  <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-bold flex items-center space-x-1">
                    <Users className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                    <span>{contactName}</span>
                  </div>
                )}

                <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3.5 rounded-2xl rounded-tr-none max-w-[95%] sm:max-w-[92%] ml-auto text-xs sm:text-sm shadow-xs border border-emerald-200/50 dark:border-emerald-800/50 transition relative group">
                  <div className="flex items-center justify-between text-[10px] text-emerald-800 dark:text-emerald-300 mb-1.5 border-b border-emerald-200/60 dark:border-emerald-700/60 pb-1">
                    <span className="flex items-center space-x-1 font-semibold">
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>{hasVariations ? `Hasil AI Variasi #${activeVariationIndex + 1}` : 'Pesan'} (Klik teks untuk mengedit)</span>
                    </span>
                    <span className="font-mono">{currentPreviewText.length} karakter</span>
                  </div>

                  <textarea
                    ref={previewTextareaRef}
                    rows={4}
                    value={currentPreviewText}
                    onChange={handlePreviewTextChange}
                    placeholder="Ketik pesan WhatsApp di panel kiri atau klik 'Variasikan dengan AI' untuk melihat hasil variasi yang dapat diedit di sini..."
                    className="w-full bg-transparent resize-none focus:outline-none focus:ring-1 focus:ring-emerald-500/40 rounded-lg p-1 text-slate-900 dark:text-white text-xs sm:text-sm leading-relaxed placeholder-slate-400 dark:placeholder-emerald-200/60 font-sans"
                  />

                  <div className="text-[10px] text-slate-500 dark:text-white/70 text-right mt-1.5 flex items-center justify-end space-x-1 select-none">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-blue-500 dark:text-sky-300 inline" />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3.5 bg-slate-50 dark:bg-[#202c33]/70 border border-slate-200 dark:border-[#2a3942] rounded-2xl text-xs space-y-1.5 text-slate-700 dark:text-slate-300">
              <div className="flex items-center justify-between text-slate-900 dark:text-white font-bold pb-1 border-b border-slate-200/60 dark:border-[#2a3942]">
                <span>📋 Ringkasan Pengiriman:</span>
                <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                  {repeatCount > 1 ? `${repeatCount} Pesan` : '1 Pesan Tunggal'}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400">Penerima:</span>
                <span className="font-semibold text-right truncate max-w-[220px]">{currentRecipientLabel}</span>
              </div>
              {repeatCount > 1 && (
                <>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Jeda Antar Pesan:</span>
                    <span className="font-semibold">{intervalSeconds} detik</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500 dark:text-slate-400">Status Variasi AI:</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {hasVariations ? `${variations.length} Variasi Siap Dikirim ✨` : (useAiVariation ? 'Otomatis di Backend ✨' : 'Teks Sama')}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleSend}
            disabled={loading || !isConnected || !currentPreviewText.trim()}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-2xl transition flex items-center justify-center space-x-2 shadow-md shadow-emerald-600/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
          >
            <Send className="w-4 h-4" />
            <span>
              {loading ? 'Mengirim Pesan...' : 'Kirim Pesan dari Preview 🚀'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
