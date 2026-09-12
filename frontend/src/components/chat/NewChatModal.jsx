import React, { useState } from 'react';
import { X, Search, UserPlus, Phone, MessageSquare } from 'lucide-react';
import { formatPhoneNumber } from '../../utils/phoneFormatter';

export default function NewChatModal({ isOpen, onClose, contacts = [], onSelectContact }) {
  const [phone, setPhone] = useState('');
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleStartWithNumber = (e) => {
    e.preventDefault();
    setError('');

    const clean = phone.replace(/[^0-9]/g, '');
    if (!clean || clean.length < 8) {
      setError('Masukkan nomor WhatsApp yang valid (contoh: 08123456789 atau 628123456789)');
      return;
    }

    const jid = clean.startsWith('62') ? `${clean}@s.whatsapp.net` : clean.startsWith('0') ? `62${clean.slice(1)}@s.whatsapp.net` : `${clean}@s.whatsapp.net`;
    const contactObj = {
      jid,
      phone: clean,
      name: `+${clean}`,
      is_group: false,
    };

    onSelectContact(contactObj);
    onClose();
  };

  const filteredContacts = contacts.filter((c) =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.phone || '').includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-400" />
            <h3 className="font-bold text-base">Mulai Obrolan Baru</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Direct Phone Input */}
          <form onSubmit={handleStartWithNumber} className="mb-6">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Kirim Pesan ke Nomor Baru:
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="08123456789 atau 6281xxx"
                  className="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm shadow-emerald-600/30"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Chat
              </button>
            </div>
            {error && <p className="text-red-500 text-[11px] mt-1.5 font-medium">{error}</p>}
          </form>

          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
              Atau Pilih dari Kontak Tersimpan:
            </label>
            <div className="relative mb-3">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau nomor..."
                className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {filteredContacts.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">
                  Tidak ada kontak yang cocok
                </div>
              ) : (
                filteredContacts.map((c) => (
                  <button
                    key={c.id || c.jid || c.phone}
                    onClick={() => {
                      onSelectContact(c);
                      onClose();
                    }}
                    className="w-full flex items-center gap-3 p-2.5 hover:bg-emerald-50/60 rounded-xl text-left transition group border border-transparent hover:border-emerald-100"
                  >
                    <div className="w-9 h-9 rounded-full bg-slate-100 group-hover:bg-emerald-600 group-hover:text-white text-slate-600 flex items-center justify-center font-bold text-xs transition">
                      {(c.name || c.phone || 'K').charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700">
                        {c.name || `+${c.phone}`}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        +{c.phone}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
