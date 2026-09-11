import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { 
  Send, 
  Users, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  Repeat, 
  User,
  RefreshCw
} from 'lucide-react';

export default function MessageComposerPage({ waStatus }) {
  const [recipientType, setRecipientType] = useState('personal'); // 'personal' or 'group'
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [useAiVariation, setUseAiVariation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isConnected = waStatus?.status === 'CONNECTED';

  const fetchInitialData = async () => {
    try {
      const [contactsRes, templatesRes] = await Promise.all([
        apiClient.get('/contacts?limit=100'),
        apiClient.get('/templates?limit=100')
      ]);
      setContacts(contactsRes.data.data.contacts || []);
      setTemplates(templatesRes.data.data.templates || []);
    } catch (err) {
      console.error('Error fetching composer data:', err);
    }
  };

  const fetchGroups = async () => {
    if (!isConnected) return;
    setLoadingGroups(true);
    try {
      const res = await apiClient.get('/whatsapp/groups');
      setGroups(res.data.data.groups || []);
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

  const handleContactSelect = (contactId) => {
    setSelectedContact(contactId);
    if (!contactId) {
      setPhone('');
      setContactName('');
      return;
    }
    const c = contacts.find((item) => item.id === contactId);
    if (c) {
      setPhone(c.phone);
      setContactName(c.name);
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

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;
    const t = templates.find((item) => item.id === templateId);
    if (t) {
      let content = t.content;
      if (contactName) {
        content = content.replace(/\{\{name\}\}/gi, contactName);
      }
      if (phone) {
        content = content.replace(/\{\{phone\}\}/gi, phone);
      }
      setMessage(content);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');
    setLoading(true);

    try {
      const target = recipientType === 'group' ? selectedGroup : phone;
      if (!target) {
        throw new Error(recipientType === 'group' ? 'Pilih grup tujuan terlebih dahulu' : 'Nomor tujuan wajib diisi');
      }

      const res = await apiClient.post('/messages', {
        phone: target,
        message,
        contactName: contactName || undefined,
        repeatCount: parseInt(repeatCount, 10) || 1,
        intervalSeconds: parseInt(intervalSeconds, 10) || 5,
        useAiVariation
      });
      setSuccessMsg(res.data.message || `Pesan berhasil dikirim ke ${contactName || target}!`);
      if (repeatCount <= 1) {
        setMessage('');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.message || err.message || 'Gagal mengirim pesan WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const totalEstimatedTime = (repeatCount > 1 ? (repeatCount - 1) * intervalSeconds : 0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">Message Composer</h1>
        <p className="text-xs sm:text-sm text-slate-400">Kirim pesan WhatsApp ke nomor personal atau langsung ke grup</p>
      </div>

      {!isConnected && (
        <div className="p-3.5 sm:p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center space-x-3 text-amber-400 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>WhatsApp saat ini belum terhubung. Pastikan status WhatsApp Connected sebelum mengirim pesan.</span>
        </div>
      )}

      {successMsg && (
        <div className="p-3.5 sm:p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center space-x-3 text-emerald-400 text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 sm:p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center space-x-3 text-rose-400 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-sm">
          {/* TAB PILIHAN TUJUAN (PERSONAL vs GRUP) */}
          <div className="flex bg-slate-950 p-1.5 rounded-xl border border-slate-800 mb-5">
            <button
              type="button"
              onClick={() => {
                setRecipientType('personal');
                setSelectedGroup('');
                setPhone('');
                setContactName('');
              }}
              className={`flex-1 flex items-center justify-center space-x-1.5 sm:space-x-2 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition ${
                recipientType === 'personal'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>👤 Kontak Personal</span>
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
              className={`flex-1 flex items-center justify-center space-x-1.5 sm:space-x-2 py-2 text-[11px] sm:text-xs font-bold rounded-lg transition ${
                recipientType === 'group'
                  ? 'bg-emerald-500 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5 shrink-0" />
              <span>👥 Grup WA {groups.length > 0 && `(${groups.length})`}</span>
            </button>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {recipientType === 'personal' ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Pilih Kontak Tersimpan
                    </label>
                    <select
                      value={selectedContact}
                      onChange={(e) => handleContactSelect(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Atau ketik nomor manual di bawah --</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Template Pesan
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Template (Opsional) --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Nomor HP Tujuan *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="08123456789 atau 628123456789"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Nama Penerima (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Nama Kontak"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </>
            ) : (
              /* FORM PILIH GRUP */
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Pilih Grup WhatsApp *
                      </label>
                      <button
                        type="button"
                        onClick={fetchGroups}
                        disabled={loadingGroups}
                        className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${loadingGroups ? 'animate-spin' : ''}`} />
                        <span>Refresh Grup</span>
                      </button>
                    </div>
                    <select
                      required
                      value={selectedGroup}
                      onChange={(e) => handleGroupSelect(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Grup yang Diikuti --</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.subject} ({g.participantsCount} Anggota)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Template Pesan
                    </label>
                    <select
                      value={selectedTemplate}
                      onChange={(e) => handleTemplateSelect(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">-- Pilih Template (Opsional) --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {selectedGroup && (
                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Target Grup: <strong className="text-slate-100">{contactName}</strong></span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">{selectedGroup}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Isi Pesan WhatsApp *
                </label>
                <span className="text-xs text-slate-500">{message.length} karakter</span>
              </div>
              <textarea
                rows={4}
                required
                placeholder={recipientType === 'group' ? 'Ketik pesan pengumuman / obrolan grup di sini...' : 'Ketik isi pesan WhatsApp di sini...'}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              ></textarea>
            </div>

            {/* ─── PENGATURAN PENGIRIMAN BERULANG (REPEAT DISPATCH) ─── */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Repeat className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    Pengaturan Pengiriman Berulang
                  </span>
                </div>
                {repeatCount > 1 && (
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold">
                    {repeatCount}x Pengiriman
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Jumlah Kirim (Repeat Count)
                  </label>
                  <div className="flex space-x-1.5 mb-1.5">
                    {[1, 3, 5, 10, 20].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setRepeatCount(num)}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition border ${
                          repeatCount === num
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="Custom jumlah..."
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-slate-400 mb-1">
                    Jeda Antar Pesan (Detik)
                  </label>
                  <div className="flex space-x-1.5 mb-1.5">
                    {[1, 2, 3, 5, 10].map((sec) => (
                      <button
                        key={sec}
                        type="button"
                        onClick={() => setIntervalSeconds(sec)}
                        className={`flex-1 py-1 text-xs font-bold rounded-lg transition border ${
                          intervalSeconds === sec
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                            : 'bg-slate-900 text-slate-300 border-slate-800 hover:border-slate-700'
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
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
                    placeholder="Custom detik (min. 1s)..."
                  />
                </div>
              </div>

              {repeatCount > 1 && (
                <div className="pt-2 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={useAiVariation}
                      onChange={(e) => setUseAiVariation(e.target.checked)}
                      className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex items-center space-x-1 text-emerald-400 font-semibold">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Variasikan Kalimat Pesan dengan AI</span>
                    </div>
                  </label>
                  <span className="text-[11px] text-slate-400">
                    ⏱️ Estimasi: ~{totalEstimatedTime} detik
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isConnected}
              className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl transition flex items-center justify-center space-x-2 shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" />
              <span>
                {loading
                  ? 'Sedang Memproses...'
                  : repeatCount > 1
                  ? `Kirim ${repeatCount}x ke ${recipientType === 'group' ? 'Grup' : 'Kontak'} Sekaligus`
                  : `Kirim Pesan ke ${recipientType === 'group' ? 'Grup WhatsApp' : 'Kontak Personal'}`}
              </span>
            </button>
          </form>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100 mb-2">Message Preview</h3>
            <p className="text-xs text-slate-400 mb-4">
              Simulasi tampilan di {recipientType === 'group' ? 'Grup WhatsApp' : 'WhatsApp'}
            </p>

            <div className="bg-[#0b141a] p-4 rounded-2xl border border-slate-800 min-h-[200px] flex flex-col justify-end">
              {recipientType === 'group' && contactName && (
                <div className="text-[11px] text-emerald-400 font-semibold mb-2 flex items-center space-x-1">
                  <Users className="w-3 h-3" />
                  <span>{contactName}</span>
                </div>
              )}

              {message ? (
                <div className="bg-[#005c4b] text-slate-100 p-3 rounded-2xl rounded-tr-none max-w-[85%] ml-auto text-sm shadow-md">
                  <p className="whitespace-pre-wrap">{message}</p>
                  <p className="text-[10px] text-emerald-200/60 text-right mt-1">
                    {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ✓✓
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-600 text-center my-auto">
                  Ketik pesan atau pilih template untuk melihat preview
                </p>
              )}
            </div>

            {repeatCount > 1 && (
              <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-slate-300 space-y-1">
                <p className="font-bold text-emerald-400">📋 Ringkasan Pengiriman:</p>
                <p>• Target: <strong className="text-slate-100">{recipientType === 'group' ? `Grup ${contactName || ''}` : phone}</strong></p>
                <p>• Total Pesan: <strong className="text-slate-100">{repeatCount} kali</strong></p>
                <p>• Jeda per pesan: <strong className="text-slate-100">{intervalSeconds} detik</strong></p>
                <p>• AI Variasi: <strong className="text-slate-100">{useAiVariation ? 'Aktif ✨' : 'Teks Sama'}</strong></p>
              </div>
            )}
          </div>

          <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 mt-4 text-xs text-slate-400">
            <strong>Tips:</strong> Gunakan variable template seperti <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">{'{{name}}'}</code> dan <code className="text-emerald-400 bg-slate-900 px-1 py-0.5 rounded">{'{{phone}}'}</code>.
          </div>
        </div>
      </div>
    </div>
  );
}

