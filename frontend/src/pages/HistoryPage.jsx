import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { History, Search, RefreshCw, Filter, ArrowDownLeft, ArrowUpRight } from 'lucide-react';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Message History</h1>
          <p className="text-sm text-slate-400">View real-time incoming and outgoing WhatsApp messages</p>
        </div>

        <button
          onClick={fetchMessages}
          disabled={loading}
          className="flex items-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-sm font-semibold border border-slate-700/50 transition w-fit"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-3" />
          <input
            type="text"
            placeholder="Search by phone number..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </form>

        <div className="flex items-center space-x-3 w-full md:w-auto">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-emerald-500"
            >
              <option value="">All Directions</option>
              <option value="OUTGOING">Outgoing (Sent)</option>
              <option value="INCOMING">Incoming (Received)</option>
            </select>
          </div>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-medium text-slate-300 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Statuses</option>
            <option value="SENT">SENT</option>
            <option value="DELIVERED">DELIVERED</option>
            <option value="FAILED">FAILED</option>
            <option value="PENDING">PENDING</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-400" />
            <span>Loading message logs...</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No message history found matching criteria.
          </div>
        ) : (
          <div className="divide-y divide-slate-800/80">
            {messages.map((m) => {
              const isOut = m.direction === 'OUTGOING';
              return (
                <div key={m.id} className="p-4 hover:bg-slate-800/30 transition flex items-start justify-between gap-4">
                  <div className="flex items-start space-x-3.5">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      isOut ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {isOut ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownLeft className="w-5 h-5" />}
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-sm text-slate-200">
                          {m.contact_name ? `${m.contact_name} (+${m.phone})` : `+${m.phone}`}
                        </span>
                        <span className={`text-[11px] px-2 py-0.5 rounded-md font-semibold ${
                          isOut ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                        }`}>
                          {m.direction}
                        </span>
                      </div>

                      <p className="text-sm text-slate-300 whitespace-pre-wrap bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 max-w-2xl">
                        {m.content}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      m.status === 'SENT' || m.status === 'DELIVERED'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : m.status === 'FAILED'
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {m.status}
                    </span>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(m.created_at).toLocaleString()}
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
