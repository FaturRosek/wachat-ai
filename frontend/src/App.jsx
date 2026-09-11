import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import apiClient from './api/apiClient';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import WhatsappConnectionPage from './pages/WhatsappConnectionPage';
import MessageComposerPage from './pages/MessageComposerPage';
import HistoryPage from './pages/HistoryPage';
import ContactsPage from './pages/ContactsPage';
import TemplatesPage from './pages/TemplatesPage';

function DashboardLayout() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [waStatus, setWaStatus] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const fetchWaStatus = async () => {
    try {
      const res = await apiClient.get('/whatsapp/status');
      if (res.data.success && res.data.data) {
        setWaStatus(res.data.data);
      }
    } catch (err) {
      console.error('Error fetching WhatsApp status:', err);
    }
  };

  useEffect(() => {
    fetchWaStatus();
    const interval = setInterval(fetchWaStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 relative">
      {/* Sidebar (Desktop Permanent + Mobile Drawer) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar 
          waStatus={waStatus} 
          onRefreshStatus={fetchWaStatus} 
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Main Content Area - Responsive padding and bottom spacing for mobile nav */}
        <main className="flex-1 p-3.5 sm:p-6 md:p-8 pb-24 md:pb-8 overflow-y-auto">
          {activeTab === 'dashboard' && (
            <DashboardPage setActiveTab={setActiveTab} waStatus={waStatus} />
          )}
          {activeTab === 'whatsapp' && (
            <WhatsappConnectionPage waStatus={waStatus} onRefreshStatus={fetchWaStatus} />
          )}
          {activeTab === 'compose' && (
            <MessageComposerPage waStatus={waStatus} />
          )}
          {activeTab === 'history' && (
            <HistoryPage />
          )}
          {activeTab === 'contacts' && (
            <ContactsPage setActiveTab={setActiveTab} />
          )}
          {activeTab === 'templates' && (
            <TemplatesPage setActiveTab={setActiveTab} />
          )}
        </main>

        {/* Mobile Bottom Navigation Bar (Quick 1-Thumb Access on Phones) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-lg border-t border-slate-800 px-2 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'dashboard'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base mb-0.5">📊</span>
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition relative ${
              activeTab === 'whatsapp'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base mb-0.5">📱</span>
            <span>WhatsApp</span>
            {waStatus?.status === 'CONNECTED' && (
              <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('compose')}
            className={`flex flex-col items-center justify-center py-1.5 px-2.5 rounded-xl text-[10px] font-bold transition ${
              activeTab === 'compose'
                ? 'text-slate-950 bg-emerald-400 shadow-md shadow-emerald-500/30 font-extrabold'
                : 'text-emerald-400 bg-emerald-500/20 border border-emerald-500/30'
            }`}
          >
            <span className="text-base mb-0.5">🚀</span>
            <span>Kirim</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold transition ${
              activeTab === 'history'
                ? 'text-emerald-400 bg-emerald-500/10'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span className="text-base mb-0.5">📜</span>
            <span>Riwayat</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition"
          >
            <span className="text-base mb-0.5">☰</span>
            <span>Menu</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return <DashboardLayout />;
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
