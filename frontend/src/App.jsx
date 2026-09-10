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
    const interval = setInterval(fetchWaStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar waStatus={waStatus} onRefreshStatus={fetchWaStatus} />

        <main className="flex-1 p-8 overflow-y-auto">
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
