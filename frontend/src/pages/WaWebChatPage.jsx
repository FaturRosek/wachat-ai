import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  MessageSquare,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Send,
  Mic,
  Bot,
  Sparkles,
  Check,
  CheckCheck,
  Clock,
  User,
  Users,
  CircleDot,
  Plus,
  RefreshCw,
  ShieldCheck,
  ChevronLeft,
  X,
  Zap,
} from 'lucide-react';
import apiClient from '../api/apiClient';
import { useSocket } from '../context/SocketContext';
import StoryViewerModal from '../components/chat/StoryViewerModal';
import IncomingCallModal from '../components/chat/IncomingCallModal';
import AiChatSettingsDrawer from '../components/chat/AiChatSettingsDrawer';
import NewChatModal from '../components/chat/NewChatModal';

export default function WaWebChatPage({ waStatus, onOpenStories }) {
  const { onEvent, incomingCall, setIncomingCall } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');

  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeAiSetting, setActiveAiSetting] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storiesList, setStoriesList] = useState([]);
  const [rewriting, setRewriting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [typingMap, setTypingMap] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    try {
      const res = await apiClient.get('/chats', {
        params: { search: searchQuery, filter: filterTab },
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setChats(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const res = await apiClient.post('/chats/sync');
      if (res.data.success && res.data.data?.chats) {
        setChats(res.data.data.chats);
      } else {
        await fetchChats();
      }
    } catch (e) {
      console.error('Manual sync failed:', e);
      await fetchChats();
    } finally {
      setSyncing(false);
    }
  };

  const fetchStories = async () => {
    try {
      const res = await apiClient.get('/chats/media/stories');
      if (res.data.success && Array.isArray(res.data.data)) {
        setStoriesList(res.data.data);
      }
    } catch (e) {
      console.error('Failed to fetch stories:', e);
    }
  };

  useEffect(() => {
    fetchChats();
    fetchStories();
  }, [searchQuery, filterTab]);

  useEffect(() => {
    const unsubSync = onEvent('groups_synced', () => {
      fetchChats();
    });

    const unsubChatSync = onEvent('chat_sync_complete', () => {
      fetchChats();
    });

    const unsubMsg = onEvent('message_new', ({ message, contact, remoteJid }) => {
      if (activeChat && (activeChat.jid === remoteJid || activeChat.phone === remoteJid.replace(/[^0-9]/g, ''))) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }

      setChats((prev) => {
        const idx = prev.findIndex((c) => c.jid === remoteJid || c.phone === remoteJid.replace(/[^0-9]/g, ''));
        if (idx !== -1) {
          const updated = [...prev];
          const unreadIncrement = (!message.from_me && (!activeChat || activeChat.jid !== remoteJid)) ? 1 : 0;
          updated[idx] = {
            ...updated[idx],
            last_message_text: message.content,
            last_message_time: message.sent_at || new Date(),
            unread_count: (updated[idx].unread_count || 0) + unreadIncrement,
          };
          const item = updated.splice(idx, 1)[0];
          return [item, ...updated];
        } else if (contact) {
          return [
            {
              ...contact,
              last_message_text: message.content,
              last_message_time: message.sent_at || new Date(),
              unread_count: message.from_me ? 0 : 1,
            },
            ...prev,
          ];
        }
        return prev;
      });
    });

    const unsubStatus = onEvent('message_status_update', ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.message_id === messageId ? { ...m, status } : m))
      );
    });

    const unsubPresence = onEvent('presence_update', ({ jid, isTyping, presences }) => {
      setTypingMap((prev) => ({
        ...prev,
        [jid]: isTyping || (presences && Object.values(presences).some((p) => p.lastKnownPresence === 'composing')),
      }));
    });

    const unsubStory = onEvent('story_new', (story) => {
      setStoriesList((prev) => [story, ...prev]);
    });

    return () => {
      unsubSync();
      unsubChatSync();
      unsubMsg();
      unsubStatus();
      unsubPresence();
      unsubStory();
    };
  }, [activeChat, onEvent]);

  const handleSelectChat = async (chat) => {
    setActiveChat(chat);
    setLoadingMessages(true);
    setAiSuggestions([]);
    try {
      const res = await apiClient.get(`/chats/${encodeURIComponent(chat.jid || chat.phone)}/messages`);
      if (res.data.success && res.data.data) {
        setMessages(res.data.data.messages || []);
        setActiveAiSetting(res.data.data.aiSetting || null);

        setChats((prev) =>
          prev.map((c) =>
            c.jid === chat.jid || c.phone === chat.phone ? { ...c, unread_count: 0 } : c
          )
        );

        fetchSmartSuggestions(chat.jid);
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  const fetchSmartSuggestions = async (jid) => {
    setLoadingSuggestions(true);
    try {
      const res = await apiClient.post('/chats/ai/smart-suggestions', { jid });
      if (res.data.success && Array.isArray(res.data.data?.suggestions)) {
        setAiSuggestions(res.data.data.suggestions);
      }
    } catch (e) {
      console.warn('AI suggestions error:', e);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !activeChat || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    const tempMessage = {
      id: 'temp_' + Date.now(),
      phone: activeChat.phone,
      remote_jid: activeChat.jid,
      content: messageText,
      direction: 'OUTGOING',
      status: 'PENDING',
      from_me: true,
      sent_at: new Date(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const res = await apiClient.post('/chats/send', {
        jid: activeChat.jid || activeChat.phone,
        message: messageText,
      });

      if (res.data.success && res.data.data) {
        setMessages((prev) =>
          prev.map((m) => (m.id === tempMessage.id ? res.data.data : m))
        );
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempMessage.id ? { ...m, status: 'FAILED' } : m))
      );
    } finally {
      setSending(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleAiRewrite = async (tone = 'friendly') => {
    if (!inputText.trim()) return;
    setRewriting(true);
    try {
      const res = await apiClient.post('/chats/ai/rewrite', {
        text: inputText,
        tone,
      });
      if (res.data.success && res.data.data?.rewritten) {
        setInputText(res.data.data.rewritten);
      }
    } catch (e) {
      console.error('Rewrite failed:', e);
    } finally {
      setRewriting(false);
    }
  };

  const isConnected = waStatus?.status === 'CONNECTED';

  const unreadChatsCount = chats.filter((c) => (c.unread_count || 0) > 0).length;
  const groupChatsCount = chats.filter((c) => c.is_group).length;

  const formatChatTime = (time) => {
    if (!time) return '';
    const date = new Date(time);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (isYesterday) {
      return 'Kemarin';
    }
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  return (
    <div className="flex-1 flex h-full w-full overflow-hidden bg-[#f4f7fb] dark:bg-[#0c1317] text-slate-800 dark:text-slate-100 select-none transition-colors duration-200">
      <div
        className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-[#222d34] bg-white dark:bg-[#111b21] transition-colors duration-200 ${
          activeChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        <div className="px-4 py-3.5 bg-white dark:bg-[#111b21] border-b border-slate-100 dark:border-[#222d34] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">WhatsApp</h1>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-200/80 dark:border-blue-800/60 px-1.5 py-0.5 rounded-full">
              AI Client
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              title="Sinkronkan Grup & Kontak WhatsApp"
              className="p-2 text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#202c33] rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-blue-600 dark:text-blue-400' : ''}`} />
            </button>

            <button
              onClick={() => setDrawerOpen(true)}
              title="Menu Lainnya"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-xl transition"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            <button
              onClick={() => setNewChatModalOpen(true)}
              title="Mulai Chat Baru"
              className="w-8 h-8 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center font-bold shadow-sm shadow-blue-600/30 transition active:scale-95"
            >
              <Plus className="w-5 h-5 stroke-[2.5]" />
            </button>
          </div>
        </div>

        <div className="px-3 pb-2 pt-2 bg-white dark:bg-[#111b21]">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari atau mulai obrolan baru"
              className="w-full pl-10 pr-8 py-2 bg-slate-100/80 dark:bg-[#202c33] border border-slate-200/60 dark:border-[#2a3942] focus:border-blue-500 focus:bg-white dark:focus:bg-[#202c33] rounded-xl text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar pb-1">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'unread', label: unreadChatsCount > 0 ? `Belum dibaca ${unreadChatsCount}` : 'Belum dibaca' },
              { id: 'groups', label: groupChatsCount > 0 ? `Grup ${groupChatsCount}` : 'Grup' },
              { id: 'ai', label: '🤖 AI Aktif' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap transition ${
                  filterTab === tab.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#202c33] text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#2a3942]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-[#222d34] custom-scrollbar">
          {loadingChats ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Memuat percakapan WhatsApp...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">Tidak Ada Obrolan</p>
              <p className="text-[11px]">
                {searchQuery
                  ? 'Tidak ada hasil obrolan yang cocok'
                  : 'Klik tombol + di atas untuk memulai obrolan baru'}
              </p>
            </div>
          ) : (
            chats.map((chat) => {
              const isSelected = activeChat?.jid === chat.jid || (activeChat?.phone && activeChat.phone === chat.phone);
              const isTyping = typingMap[chat.jid];
              const hasUnread = (chat.unread_count || 0) > 0;

              return (
                <div
                  key={chat.id || chat.jid || chat.phone}
                  onClick={() => handleSelectChat(chat)}
                  className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition relative group ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-[#2a3942] border-r-4 border-blue-600'
                      : 'hover:bg-slate-50 dark:hover:bg-[#202c33]/70 bg-white dark:bg-[#111b21]'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold text-sm overflow-hidden shadow-xs">
                      {chat.avatar_url ? (
                        <img src={chat.avatar_url} alt={chat.name} className="w-full h-full object-cover" />
                      ) : chat.is_group ? (
                        <Users className="w-5 h-5 text-white" />
                      ) : (
                        (chat.name || chat.phone || 'K').charAt(0).toUpperCase()
                      )}
                    </div>

                    {chat.auto_reply_enabled && (
                      <span
                        title="AI Auto-Reply Aktif"
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center text-[9px] ring-2 ring-white dark:ring-[#111b21] shadow-xs"
                      >
                        🤖
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <h4 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate">
                        {chat.name || `+${chat.phone}`}
                      </h4>
                      <span
                        className={`text-[11px] whitespace-nowrap ml-2 ${
                          hasUnread ? 'text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-400'
                        }`}
                      >
                        {formatChatTime(chat.last_message_time)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                        {isTyping ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold animate-pulse">sedang mengetik...</span>
                        ) : (
                          chat.last_message_text || 'Belum ada pesan'
                        )}
                      </p>

                      {hasUnread && (
                        <span className="ml-2 flex-shrink-0 bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-xs">
                          {chat.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-50/80 dark:bg-[#182229] border-t border-slate-100 dark:border-[#222d34] flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400">
          <div className="w-7 h-7 rounded-xl bg-blue-100 dark:bg-blue-950/80 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-4 h-4" />
          </div>
          <p className="text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            <span className="text-slate-800 dark:text-slate-200 font-bold block">WaChat AI Client</span>
            Terkoneksi langsung ke nomor WhatsApp Anda
          </p>
        </div>
      </div>

      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0 h-full bg-[#f4f7fb] dark:bg-[#0b141a] relative transition-colors duration-200">
          <div className="px-4 py-3 bg-white dark:bg-[#202c33] flex items-center justify-between z-10 border-b border-slate-200/90 dark:border-[#2a3942] shadow-2xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => setActiveChat(null)}
                className="md:hidden p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-3 cursor-pointer min-w-0 group"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center font-bold text-sm text-white overflow-hidden shadow-xs flex-shrink-0">
                  {activeChat.avatar_url ? (
                    <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : activeChat.is_group ? (
                    <Users className="w-5 h-5 text-white" />
                  ) : (
                    (activeChat.name || activeChat.phone || 'K').charAt(0).toUpperCase()
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-slate-100 truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                    {activeChat.name || `+${activeChat.phone}`}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1.5">
                    {typingMap[activeChat.jid] ? (
                      <span className="text-blue-600 dark:text-blue-400 font-bold animate-pulse">sedang mengetik...</span>
                    ) : isConnected ? (
                      <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                      </span>
                    ) : (
                      'WhatsApp Offline'
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => setDrawerOpen(true)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeAiSetting?.auto_reply_enabled
                    ? 'bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs'
                    : 'bg-slate-100 dark:bg-[#111b21] text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#2a3942]'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${activeAiSetting?.auto_reply_enabled ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">
                  {activeAiSetting?.auto_reply_enabled ? 'Auto-Reply: ON' : 'Auto-Reply: OFF'}
                </span>
              </button>

              <button
                onClick={() =>
                  setIncomingCall({
                    callId: 'call_' + Date.now(),
                    callerJid: activeChat.jid,
                    callerPhone: activeChat.phone,
                    isVideo: false,
                  })
                }
                title="Test Notifikasi Panggilan Masuk"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-[#111b21] rounded-xl transition"
              >
                <Phone className="w-4 h-4" />
              </button>

              <button
                onClick={() => setDrawerOpen(true)}
                title="Cari di obrolan"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition"
              >
                <Search className="w-4 h-4" />
              </button>

              <button
                onClick={() => setDrawerOpen(true)}
                title="Info Kontak & Setting"
                className="p-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 custom-scrollbar bg-[#f8fafc] dark:bg-[#0b141a]"
          >
            {loadingMessages ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                Memuat percakapan...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#202c33] shadow-xs flex items-center justify-center mb-2 border border-slate-100 dark:border-[#2a3942]">
                  <MessageSquare className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <p className="font-bold text-xs text-slate-700 dark:text-slate-300">Mulai Obrolan WhatsApp</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-xs mt-0.5">
                  Kirim pesan teks atau gunakan saran AI pintar di bawah.
                </p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isMe = msg.from_me || msg.direction === 'OUTGOING';

                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] sm:max-w-[70%] md:max-w-[65%] rounded-2xl px-3.5 py-2 text-xs shadow-xs relative leading-relaxed ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-500/10'
                          : 'bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-[#2a3942]'
                      }`}
                    >
                      {activeChat.is_group && !isMe && msg.sender_name && (
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                          {msg.sender_name}
                        </p>
                      )}

                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[9px] select-none ${
                          isMe ? 'text-blue-100' : 'text-slate-400 dark:text-slate-400'
                        }`}
                      >
                        <span>
                          {msg.sent_at
                            ? new Date(msg.sent_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>

                        {isMe && (
                          <span>
                            {msg.status === 'READ' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-emerald-300" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-blue-200" />
                            ) : msg.status === 'SENT' ? (
                              <Check className="w-3.5 h-3.5 text-blue-200" />
                            ) : msg.status === 'FAILED' ? (
                              <span className="text-red-300 font-bold">!</span>
                            ) : (
                              <Clock className="w-3 h-3 text-blue-200" />
                            )}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="px-3 pt-2 bg-white/95 dark:bg-[#111b21]/95 border-t border-slate-200/80 dark:border-[#222d34]">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                Saran AI:
              </span>

              {loadingSuggestions ? (
                <span className="text-[10px] text-slate-400 animate-pulse">Menyiapkan balasan cerdas...</span>
              ) : aiSuggestions.length > 0 ? (
                aiSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(sug);
                      textareaRef.current?.focus();
                    }}
                    className="flex-shrink-0 text-xs bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 dark:hover:bg-blue-900/60 text-blue-700 dark:text-blue-300 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800/60 transition font-medium shadow-2xs"
                  >
                    {sug}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => fetchSmartSuggestions(activeChat.jid)}
                  className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded-md"
                >
                  Generate Rekomendasi
                </button>
              )}
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-[#202c33] border-t border-slate-200 dark:border-[#2a3942] flex items-center gap-2">
            <button
              type="button"
              title="Lampiran"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition"
            >
              <Paperclip className="w-5 h-5" />
            </button>

            <button
              type="button"
              title="Emoji"
              className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition"
            >
              <Smile className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleAiRewrite('friendly')}
              disabled={rewriting || !inputText.trim()}
              title="Poles Teks dengan AI"
              className="p-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 rounded-xl transition disabled:opacity-40"
            >
              <Sparkles className={`w-5 h-5 ${rewriting ? 'animate-spin' : ''}`} />
            </button>

            <div className="flex-1 bg-slate-100 dark:bg-[#2a3942] rounded-xl px-3 py-2 flex items-center border border-slate-200 dark:border-[#374248] focus-within:bg-white dark:focus-within:bg-[#2a3942] focus-within:border-blue-500 transition">
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                rows={1}
                placeholder="Ketik pesan"
                className="flex-1 bg-transparent text-xs text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none resize-none max-h-32"
              />
            </div>

            {inputText.trim() ? (
              <button
                onClick={handleSendMessage}
                disabled={sending}
                className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30 transition active:scale-95 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                title="Pesan Suara"
                className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition flex-shrink-0"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-[#f4f7fb] dark:bg-[#0b141a] text-center select-none">
          <div className="w-20 h-20 rounded-3xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-800/60 text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-lg shadow-blue-600/10 mb-4">
            <Bot className="w-10 h-10" />
          </div>

          <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-1">
            WaChat AI Web Client
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-6 leading-relaxed">
            Kirim dan terima pesan WhatsApp secara langsung, dilengkapi Otomasi AI, Auto-Reply, dan Rekomendasi Balasan Cerdas.
          </p>

          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 bg-white dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] px-4 py-2 rounded-full shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Terenkripsi end-to-end dengan Baileys Engine</span>
          </div>
        </div>
      )}

      <AiChatSettingsDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeContact={activeChat}
        aiSetting={activeAiSetting}
        onUpdateAiSetting={(newSetting) => {
          setActiveAiSetting(newSetting);
          setChats((prev) =>
            prev.map((c) =>
              c.jid === activeChat.jid || c.phone === activeChat.phone
                ? { ...c, auto_reply_enabled: newSetting.auto_reply_enabled }
                : c
            )
          );
        }}
      />

      <StoryViewerModal
        isOpen={storyModalOpen}
        onClose={() => setStoryModalOpen(false)}
        stories={storiesList}
      />

      <IncomingCallModal
        call={incomingCall}
        onClose={() => setIncomingCall(null)}
      />

      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        contacts={chats}
        onSelectContact={(selected) => handleSelectChat(selected)}
      />
    </div>
  );
}
