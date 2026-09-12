import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import apiClient from './api/apiClient';
import NavigationRail from './components/NavigationRail';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import WhatsappConnectionPage from './pages/WhatsappConnectionPage';
import MessageComposerPage from './pages/MessageComposerPage';
import HistoryPage from './pages/HistoryPage';
import ContactsPage from './pages/ContactsPage';
import TemplatesPage from './pages/TemplatesPage';
import WaWebChatPage from './pages/WaWebChatPage';
import StoryViewerModal from './components/chat/StoryViewerModal';
import IncomingCallModal from './components/chat/IncomingCallModal';
import { useSocket } from './context/SocketContext';

function DashboardLayout() {
  const { user } = useAuth();
  const { incomingCall, setIncomingCall, stories, setStories } = useSocket();
  const [activeTab, setActiveTab] = useState('chat');
  const [waStatus, setWaStatus] = useState(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [storyModalOpen, setStoryModalOpen] = useState(false);

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

  const fetchUnreadTotal = async () => {
    try {
      const res = await apiClient.get('/chats?filter=unread');
      if (res.data.success && Array.isArray(res.data.data)) {
        const sum = res.data.data.reduce((acc, c) => acc + (c.unread_count || 1), 0);
        setUnreadTotal(sum);
      }
    } catch (e) {
      setUnreadTotal(0);
    }
  };

  useEffect(() => {
    setWaStatus(null);
    fetchWaStatus();
    fetchUnreadTotal();
    const interval = setInterval(() => {
      fetchWaStatus();
      fetchUnreadTotal();
    }, 5000);
    return () => clearInterval(interval);
  }, [user?.id]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 antialiased select-none font-sans transition-colors duration-200">
      {/* ─── SLIM LEFT VERTICAL NAVIGATION RAIL (WA Web Style) ─── */}
      <NavigationRail
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        waStatus={waStatus}
        unreadCount={unreadTotal}
        storiesCount={stories.length}
        onOpenStories={() => setStoryModalOpen(true)}
      />

      {/* ─── MAIN CONTENT AREA ─── */}
      <main className="flex-1 flex min-w-0 h-full overflow-hidden bg-[#f4f7fb] dark:bg-[#0c1317] transition-colors duration-200">
        {activeTab === 'chat' && (
          <WaWebChatPage
            waStatus={waStatus}
            onOpenStories={() => setStoryModalOpen(true)}
          />
        )}

        {activeTab === 'dashboard' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
            <DashboardPage setActiveTab={setActiveTab} waStatus={waStatus} />
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
            <WhatsappConnectionPage waStatus={waStatus} onRefreshStatus={fetchWaStatus} />
          </div>
        )}

        {activeTab === 'compose' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
            <MessageComposerPage waStatus={waStatus} />
          </div>
        )}

        {activeTab === 'history' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
            <HistoryPage />
          </div>
        )}

        {activeTab === 'contacts' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
            <ContactsPage setActiveTab={setActiveTab} />
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 transition-colors duration-200">
            <TemplatesPage setActiveTab={setActiveTab} />
          </div>
        )}
      </main>

      {/* Story Viewer Modal */}
      <StoryViewerModal
        isOpen={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
        stories={stories}
      />

      {/* Incoming WhatsApp Call Modal */}
      <IncomingCallModal
        call={incomingCall}
        onClose={() => setIncomingCall(null)}
      />
    </div>
  );
}

function MainApp() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#111b21] flex items-center justify-center text-blue-500">
        <div className="w-10 h-10 border-3 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <ThemeProvider>
      <SocketProvider>
        <DashboardLayout />
      </SocketProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
