import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
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
import WaWebChatPage from './pages/WaWebChatPage';
import { LayoutGrid, Smartphone, Send, Clock, Menu, MessageSquare } from 'lucide-react';

function DashboardLayout() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('chat');
  const [waStatus, setWaStatus] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [contactCount, setContactCount] = useState(0);

  const fetchWaStatus = async () => {
    try {
      const res = await apiClient.get('/whatsapp/status');
      if (res.data.success && res.data.data) {
        setWaStatus(res.data.data);
      }
    } catch (err) {
      setWaStatus({ status: 'DISCONNECTED', phoneNumber: null });
    }
  };

  const fetchContactsCount = async () => {
    try {
      const res = await apiClient.get('/contacts?limit=1');
      if (res.data.success && res.data.data?.total !== undefined) {
        setContactCount(res.data.data.total);
      }
    } catch (err) {
      setContactCount(0);
    }
  };

  useEffect(() => {
    setWaStatus(null);
    setContactCount(0);
    fetchWaStatus();
    fetchContactsCount();
    const interval = setInterval(fetchWaStatus, 3000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <div className="flex min-h-screen bg-[#f4f7fb] text-slate-800 relative antialiased selection:bg-emerald-100 selection:text-emerald-700">
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        waStatus={waStatus}
        totalContacts={contactCount}
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar 
          waStatus={waStatus} 
          onRefreshStatus={fetchWaStatus} 
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
        />

        <main className={`flex-1 overflow-y-auto pb-24 md:pb-6 ${activeTab === 'chat' ? 'p-2 sm:p-4 md:p-6' : 'p-4 sm:p-6 md:p-8'}`}>
          {activeTab === 'chat' && (
            <WaWebChatPage waStatus={waStatus} />
          )}
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

        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition ${
              activeTab === 'chat'
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4 mb-0.5" />
            <span>WA Web</span>
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition relative ${
              activeTab === 'whatsapp'
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Smartphone className="w-4 h-4 mb-0.5" />
            <span>Koneksi</span>
            {waStatus?.status === 'CONNECTED' && (
              <span className="absolute top-1 right-2 w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('compose')}
            className={`flex flex-col items-center justify-center py-1.5 px-3 rounded-xl text-[10px] font-bold transition ${
              activeTab === 'compose'
                ? 'text-white bg-emerald-600 shadow-xs shadow-emerald-500/30'
                : 'text-emerald-600 bg-emerald-50 border border-emerald-200'
            }`}
          >
            <Send className="w-4 h-4 mb-0.5" />
            <span>Kirim</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold transition ${
              activeTab === 'dashboard'
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <LayoutGrid className="w-4 h-4 mb-0.5" />
            <span>Statistik</span>
          </button>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="flex flex-col items-center justify-center py-1.5 px-2 rounded-xl text-[10px] font-bold text-slate-500 hover:text-slate-800 transition"
          >
            <Menu className="w-4 h-4 mb-0.5" />
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
      <div className="min-h-screen bg-[#f4f7fb] flex items-center justify-center text-slate-500">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <SocketProvider>
      <DashboardLayout />
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
