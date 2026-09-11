import React, { useState, useEffect } from 'react';
import apiClient from '../api/apiClient';
import { 
  Send, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  Smartphone,
  History
} from 'lucide-react';

export default function DashboardPage({ setActiveTab, waStatus }) {
  const [stats, setStats] = useState({
    totalMessages: 0,
    totalContacts: 0,
    totalTemplates: 0,
    recentMessages: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [msgRes, contactsRes, templatesRes] = await Promise.all([
          apiClient.get('/messages?limit=5'),
          apiClient.get('/contacts?limit=1'),
          apiClient.get('/templates?limit=1')
        ]);

        setStats({
          totalMessages: msgRes.data.data.count || 0,
          totalContacts: contactsRes.data.data.total || 0,
          totalTemplates: templatesRes.data.data.total || 0,
          recentMessages: msgRes.data.data.messages || []
        });
      } catch (err) {
        console.error('Error loading dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const isConnected = waStatus?.status === 'CONNECTED';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-slate-400">Monitor WhatsApp traffic, metrics, and quick actions</p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setActiveTab('compose')}
            className="flex items-center space-x-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 px-4 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-emerald-500/20 transition"
          >
            <Send className="w-4 h-4" />
            <span>Compose Message</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">WhatsApp Status</span>
            <div className={`p-2 rounded-xl ${isConnected ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <Smartphone className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-100">
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
          <p className="text-xs text-slate-400 mt-1 truncate">
            {isConnected ? `+${waStatus?.phoneNumber || ''}` : 'QR Scan required'}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Messages</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <History className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-100">{loading ? '...' : stats.totalMessages}</div>
          <p className="text-xs text-slate-400 mt-1">Incoming & outgoing records</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Saved Contacts</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-100">{loading ? '...' : stats.totalContacts}</div>
          <p className="text-xs text-slate-400 mt-1">Audience address book</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Templates</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <FileText className="w-5 h-5" />
            </div>
          </div>
          <div className="text-xl font-bold text-slate-100">{loading ? '...' : stats.totalTemplates}</div>
          <p className="text-xs text-slate-400 mt-1">Reusable quick responses</p>
        </div>
      </div>

      {/* AI Dispatcher Command Center Card */}
      <div className="bg-gradient-to-r from-emerald-950/40 via-slate-900 to-cyan-950/40 border border-emerald-500/20 rounded-2xl p-6 shadow-lg relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs px-3 py-1 rounded-full font-bold mb-2">
              <span>🤖 AI WhatsApp Direct Trigger Active</span>
            </div>
            <h2 className="text-xl font-bold text-slate-100">Kendalikan Pengiriman Pesan Langsung dari WhatsApp</h2>
            <p className="text-sm text-slate-300 mt-1 max-w-2xl">
              Cukup kirim pesan WhatsApp ke nomor Bot server Anda dari nomor Admin. AI akan otomatis membedah instruksi, membuat variasi kalimat, dan mengirimkan ke target.
            </p>
          </div>
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 text-xs text-slate-300 font-mono">
            <span className="text-emerald-400 font-semibold block mb-1">💡 Contoh Perintah di WA:</span>
            <p className="text-slate-400">"Kirim pesan maaf 5x ke 081920xxxx"</p>
            <p className="text-slate-400">"Kirim halo ke 081234567 jeda 5 detik"</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-base text-slate-100">Recent Messages Activity</h3>
            <button
              onClick={() => setActiveTab('history')}
              className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {stats.recentMessages.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-slate-800 rounded-xl">
              <p className="text-sm text-slate-500">Belum ada aktivitas pesan masuk/keluar.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-800/60">
              {stats.recentMessages.map((msg) => (
                <div key={msg.id} className="py-3 flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      msg.direction === 'OUTGOING' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                    }`}>
                      {msg.direction === 'OUTGOING' ? 'OUT' : 'IN'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-200">{msg.contact_name || msg.phone}</p>
                      <p className="text-xs text-slate-400 truncate max-w-md">{msg.content}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300">
                      {msg.status}
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-base text-slate-100 mb-2">WhatsApp Bot Status</h3>
            <p className="text-xs text-slate-400 mb-4">Nomor Server Bot Pengirim Otomatis</p>

            <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 mb-4">
              <div className="flex items-center space-x-3 mb-2">
                <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
                <span className="text-sm font-semibold text-slate-200">
                  {isConnected ? 'Bot Siap Menerima Perintah' : 'Bot Belum Terhubung'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {isConnected 
                  ? `Bot aktif sebagai +${waStatus?.phoneNumber || ''}. Kirim chat ke nomor ini dari WA Anda untuk mulai dispatch pesan otomatis.`
                  : 'Scan QR sekali saja untuk mengaktifkan nomor Bot server.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-2.5 rounded-xl text-sm border border-slate-700/50 transition flex items-center justify-center space-x-2"
          >
            <span>{isConnected ? 'Kelola Koneksi WhatsApp' : 'Hubungkan WhatsApp (Kode / QR)'}</span>
            <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
