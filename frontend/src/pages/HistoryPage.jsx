import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { Clock, Search, RefreshCw, Filter, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

export default function HistoryPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [direction, setDirection] = useState('');
  const [status, setStatus] = useState('');
  const [searchPhone, setSearchPhone] = useState('');

  const fetchMessages = async () => {
    setLoading(true);
    try {
      let url = '/messages?limit=100';
      if (direction) url += `&direction=${direction}`;
      if (status) url += `&status=${status}`;
      if (searchPhone) url += `&phone=${searchPhone}`;

      const res = await apiClient.get(url);
      setMessages(res.data.data.messages || []);
    } catch (err) {
      console.error('Error fetching messages history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, [direction, status]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchMessages();
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Riwayat Pesan</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Log real-time seluruh aktivitas pesan WhatsApp masuk (Incoming) dan keluar (Outgoing).
          </p>
        </div>

        <button
          onClick={fetchMessages}
          disabled={loading}
          className="w-full sm:w-auto flex items-center justify-center space-x-2 bg-white hover:bg-slate-50 text-slate-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-semibold border border-slate-200 shadow-2xs transition"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Data</span>
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-3.5 sm:p-4 shadow-2xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Cari berdasarkan nomor HP..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white"
          />
        </form>

        <div className="grid grid-cols-2 sm:flex items-center gap-2.5 sm:space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            <Filter className="w-4 h-4 text-slate-400 shrink-0 hidden sm:inline" />
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white"
            >
              <option value="">Semua Arah Pesan</option>
              <option value="OUTGOING">Keluar (Outgoing)</option>
              <option value="INCOMING">Masuk (Incoming)</option>
            </select>
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 text-xs font-medium text-slate-700 focus:outline-none focus:border-blue-500 focus:bg-white"
          >
            <option value="">Semua Status</option>
            <option value="SENT">SENT (Terkirim)</option>
            <option value="DELIVERED">DELIVERED (Diterima)</option>
            <option value="FAILED">FAILED (Gagal)</option>
            <option value="PENDING">PENDING (Antrian)</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-2xs">
        {loading ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
            <span>Memuat data log pesan...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-16 text-center text-slate-400 text-sm">
            Tidak ada riwayat pesan yang sesuai dengan filter pencarian.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {messages.map((m) => {
              const isOut = m.direction === 'OUTGOING';
              return (
                <div key={m.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex items-start space-x-3 min-w-0 flex-1">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      isOut ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'
                    }`}>
                      {isOut ? <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" /> : <ArrowDownLeft className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex items-center space-x-2 flex-wrap gap-1">
                        <span className="font-bold text-xs sm:text-sm text-slate-900">
                          {m.contact_name ? `${m.contact_name} (+${m.phone})` : `+${m.phone}`}
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase ${
                          isOut ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-purple-50 text-purple-600 border border-purple-200'
                        }`}>
                          {m.direction}
                        </span>
                      </div>

                      <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded-2xl border border-slate-200 max-w-3xl leading-relaxed">
                        {m.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-start gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <span className={`inline-block px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wide uppercase ${
                      m.status === 'SENT' || m.status === 'DELIVERED'
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-200'
                        : m.status === 'FAILED'
                        ? 'bg-rose-50 text-rose-600 border border-rose-200'
                        : 'bg-amber-50 text-amber-600 border border-amber-200'
                    }`}>
                      {m.status}
                    </span>
                    <p className="text-[10px] font-mono text-slate-400">
                      {new Date(m.created_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
