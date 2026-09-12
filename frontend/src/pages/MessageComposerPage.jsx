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
  const [recipientType, setRecipientType] = useState('personal');
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [phone, setPhone] = useState('');
  const [contactName, setContactName] = useState('');
  const [message, setMessage] = useState('');
  const [repeatCount, setRepeatCount] = useState(1);
  const [intervalSeconds, setIntervalSeconds] = useState(5);
  const [useAiVariation, setUseAiVariation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isConnected = waStatus?.status === 'CONNECTED';

  const fetchInitialData = async () => {
    try {
      const contactsRes = await apiClient.get('/contacts?limit=100');
      setContacts(contactsRes.data.data?.contacts || contactsRes.data.data || []);
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
    <div className="space-y-6 max-w-6xl mx-auto pb-8">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Kirim Pesan</h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Kirim pesan WhatsApp ke nomor personal, multi-broadcast, atau langsung ke grup dengan proteksi jeda anti-spam.
        </p>
      </div>

      {!isConnected && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl flex items-center space-x-3 text-amber-700 dark:text-amber-300 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <span>Status WhatsApp saat ini belum terhubung. Pastikan WhatsApp terhubung sebelum mengirim pesan.</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl flex items-center space-x-3 text-emerald-700 dark:text-emerald-300 text-xs sm:text-sm">
          <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl flex items-center space-x-3 text-rose-600 dark:text-rose-300 text-xs sm:text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 dark:text-rose-400" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-5 sm:p-7 shadow-2xs">
          <div className="flex bg-slate-100 dark:bg-[#202c33] p-1 rounded-2xl border border-slate-200/80 dark:border-[#2a3942] mb-5">
            <button
              type="button"
              onClick={() => {
                setRecipientType('personal');
                setSelectedGroup('');
                setPhone('');
                setContactName('');
              }}
              className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-bold rounded-xl transition ${
                recipientType === 'personal'
                  ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <User className="w-3.5 h-3.5" />
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
              className={`flex-1 flex items-center justify-center space-x-2 py-2 text-xs font-bold rounded-xl transition ${
                recipientType === 'group'
                  ? 'bg-white dark:bg-[#111b21] text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Grup WA {groups.length > 0 && `(${groups.length})`}</span>
            </button>
          </div>

          <form onSubmit={handleSend} className="space-y-4">
            {recipientType === 'personal' ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider mb-1">
                    Pilih Dari Kontak Tersimpan
                  </label>
                  <select
                    value={selectedContact}
                    onChange={(e) => handleContactSelect(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
                  >
                    <option value="">-- Ketik manual di bawah --</option>
                    {contacts.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone})
                      </option>
                    ))}
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
                      className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
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
                      className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3.5 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <div>
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
                    className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-xl px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
                  >
                    <option value="">-- Pilih Grup yang Diikuti --</option>
                    {groups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.subject} ({g.participantsCount} Anggota)
                      </option>
                    ))}
                  </select>
                </div>

                {selectedGroup && (
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <span>Target: <strong>{contactName}</strong></span>
                    </div>
                    <span className="text-[11px] font-mono text-blue-700 dark:text-blue-300">{selectedGroup}</span>
                  </div>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
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
                className="w-full bg-slate-50 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] rounded-2xl p-3.5 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:bg-white dark:focus:bg-[#111b21]"
              ></textarea>
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
                        onClick={() => setRepeatCount(num)}
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
                      onChange={(e) => setUseAiVariation(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-0 w-4 h-4 cursor-pointer"
                    />
                    <div className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 font-bold">
                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                      <span>Variasikan Kalimat Pesan dengan AI</span>
                    </div>
                  </label>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    ⏱️ Estimasi: ~{totalEstimatedTime} detik
                  </span>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !isConnected}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-2xl transition flex items-center justify-center space-x-2 shadow-xs shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
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

        <div className="lg:col-span-5 bg-white dark:bg-[#111b21] border border-slate-200 dark:border-[#222d34] rounded-3xl p-5 sm:p-6 shadow-2xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-900 dark:text-white mb-1">Message Preview</h3>
            <p className="text-xs text-slate-400 mb-4">
              Simulasi tampilan di WhatsApp penerima
            </p>

            <div className="bg-[#efeae2] dark:bg-[#0b141a] p-4 rounded-2xl border border-slate-200 dark:border-[#222d34] min-h-[220px] flex flex-col justify-end shadow-inner">
              {recipientType === 'group' && contactName && (
                <div className="text-[11px] text-emerald-800 dark:text-emerald-400 font-bold mb-2 flex items-center space-x-1">
                  <Users className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
                  <span>{contactName}</span>
                </div>
              )}

              {message ? (
                <div className="bg-[#d9fdd3] dark:bg-[#005c4b] text-slate-900 dark:text-white p-3 rounded-2xl rounded-tr-none max-w-[88%] ml-auto text-xs sm:text-sm shadow-xs border border-emerald-100 dark:border-transparent">
                  <p className="whitespace-pre-wrap leading-relaxed">{message}</p>
                  <p className="text-[10px] text-slate-500 dark:text-white/60 text-right mt-1.5 flex items-center justify-end space-x-1">
                    <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    <span className="text-blue-500 dark:text-blue-300 font-bold">✓✓</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 text-center my-auto">
                  Ketik pesan untuk melihat preview tampilan chat WhatsApp
                </p>
              )}
            </div>

            {repeatCount > 1 && (
              <div className="mt-4 p-3.5 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-2xl text-xs text-blue-900 dark:text-blue-200 space-y-1">
                <p className="font-bold text-blue-700 dark:text-blue-400">📋 Ringkasan Pengiriman:</p>
                <p>• Target: <strong>{recipientType === 'group' ? `Grup ${contactName || ''}` : phone}</strong></p>
                <p>• Total Pesan: <strong>{repeatCount} kali</strong></p>
                <p>• Jeda per pesan: <strong>{intervalSeconds} detik</strong></p>
                <p>• AI Variasi: <strong>{useAiVariation ? 'Aktif ✨' : 'Teks Sama'}</strong></p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
