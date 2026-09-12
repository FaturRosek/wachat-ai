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
  Volume2,
  ChevronLeft,
  X,
  FileText,
  Image as ImageIcon,
  Zap,
} from 'lucide-react';
import apiClient from '../api/apiClient';
import { useSocket } from '../context/SocketContext';
import StoryViewerModal from '../components/chat/StoryViewerModal';
import IncomingCallModal from '../components/chat/IncomingCallModal';
import AiChatSettingsDrawer from '../components/chat/AiChatSettingsDrawer';
import NewChatModal from '../components/chat/NewChatModal';

export default function WaWebChatPage({ waStatus }) {
  const { onEvent, incomingCall, setIncomingCall } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all'); // 'all', 'unread', 'groups', 'ai'

  // AI & Modals state
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeAiSetting, setActiveAiSetting] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [storyModalOpen, setStoryModalOpen] = useState(false);
  const [storiesList, setStoriesList] = useState([]);
  const [rewriting, setRewriting] = useState(false);

  // Presence state
  const [typingMap, setTypingMap] = useState({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const [syncing, setSyncing] = useState(false);

  // 1. Fetch Chats List
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

  // Manual Sync WhatsApp Groups and Chats
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

  // 2. Fetch Stories
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

  // 3. Socket.IO Real-time Listeners
  useEffect(() => {
    const unsubSync = onEvent('groups_synced', () => {
      fetchChats();
    });

    const unsubChatSync = onEvent('chat_sync_complete', () => {
      fetchChats();
    });

    const unsubMsg = onEvent('message_new', ({ message, contact, remoteJid }) => {
      // If message belongs to active chat, append to messages
      if (activeChat && (activeChat.jid === remoteJid || activeChat.phone === remoteJid.replace(/[^0-9]/g, ''))) {
        setMessages((prev) => [...prev, message]);
        scrollToBottom();
      }

      // Update chats list
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
          // Move to top
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

  // 4. Select and Load Chat Messages
  const handleSelectChat = async (chat) => {
    setActiveChat(chat);
    setLoadingMessages(true);
    setAiSuggestions([]);
    try {
      const res = await apiClient.get(`/chats/${encodeURIComponent(chat.jid || chat.phone)}/messages`);
      if (res.data.success && res.data.data) {
        setMessages(res.data.data.messages || []);
        setActiveAiSetting(res.data.data.aiSetting || null);

        // Clear unread badge locally in chats state
        setChats((prev) =>
          prev.map((c) =>
            c.jid === chat.jid || c.phone === chat.phone ? { ...c, unread_count: 0 } : c
          )
        );

        // Fetch smart suggestions from AI
        fetchSmartSuggestions(chat.jid);
      }
    } catch (err) {
      console.error('Failed to load chat messages:', err);
    } finally {
      setLoadingMessages(false);
      setTimeout(scrollToBottom, 100);
    }
  };

  // 5. Fetch AI Smart Replies
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

  // 6. Send Message
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

  // 7. AI Rewrite Message
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

  return (
    <div className="h-[calc(100vh-6.5rem)] flex bg-white rounded-3xl shadow-xl border border-slate-200/80 overflow-hidden relative">
      
      {/* ──────────────── LEFT SIDEBAR: CHAT LIST ──────────────── */}
      <div
        className={`w-full md:w-[380px] lg:w-[420px] flex-shrink-0 flex flex-col border-r border-slate-200 bg-slate-50/50 ${
          activeChat ? 'hidden md:flex' : 'flex'
        }`}
      >
        {/* Sidebar Header */}
        <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-sm leading-tight flex items-center gap-1.5">
                WhatsApp Web
                <span className="text-[9px] font-extrabold uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">
                  AI Live
                </span>
              </h2>
              <p className="text-[11px] text-slate-400">
                {isConnected ? `+${waStatus.phoneNumber || 'Terhubung'}` : 'Offline / Belum Terhubung'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Story Button */}
            <button
              onClick={() => setStoryModalOpen(true)}
              title="Lihat Status / Stories"
              className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition relative"
            >
              <CircleDot className="w-4 h-4" />
              {storiesList.length > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white animate-pulse"></span>
              )}
            </button>

            {/* New Chat Button */}
            <button
              onClick={() => setNewChatModalOpen(true)}
              title="Chat Baru"
              className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
            >
              <Plus className="w-4 h-4" />
            </button>

            {/* Refresh / Sync Button */}
            <button
              onClick={handleSyncAll}
              disabled={syncing}
              title="Sinkronkan Grup & Chat WhatsApp"
              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-emerald-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="p-3 bg-white border-b border-slate-100">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari atau mulai chat baru..."
              className="w-full pl-9 pr-8 py-2 bg-slate-100/80 border border-transparent focus:border-emerald-500 focus:bg-white rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto no-scrollbar">
            {[
              { id: 'all', label: 'Semua' },
              { id: 'unread', label: 'Belum Dibaca' },
              { id: 'groups', label: 'Grup' },
              { id: 'ai', label: '🤖 AI Aktif' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilterTab(tab.id)}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition ${
                  filterTab === tab.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 custom-scrollbar">
          {loadingChats ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Memuat percakapan WhatsApp...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
              <p className="font-bold text-slate-600 mb-1">Belum Ada Percakapan</p>
              <p className="text-[11px]">
                {searchQuery
                  ? 'Tidak ada hasil untuk pencarian ini'
                  : 'Klik tombol + di atas untuk memulai chat pertama Anda'}
              </p>
            </div>
          ) : (
            chats.map((chat) => {
              const isSelected = activeChat?.jid === chat.jid || (activeChat?.phone && activeChat.phone === chat.phone);
              const isTyping = typingMap[chat.jid];

              return (
                <div
                  key={chat.id || chat.jid || chat.phone}
                  onClick={() => handleSelectChat(chat)}
                  className={`flex items-center gap-3 p-3.5 cursor-pointer transition relative group ${
                    isSelected
                      ? 'bg-emerald-50/80 border-r-4 border-emerald-600'
                      : 'hover:bg-slate-100/70 bg-white'
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-slate-200 to-slate-300 text-slate-700 flex items-center justify-center font-bold text-sm shadow-xs overflow-hidden">
                      {chat.avatar_url ? (
                        <img src={chat.avatar_url} alt={chat.name} className="w-full h-full object-cover" />
                      ) : chat.is_group ? (
                        <Users className="w-5 h-5 text-blue-600" />
                      ) : (
                        (chat.name || chat.phone || 'K').charAt(0).toUpperCase()
                      )}
                    </div>

                    {/* AI auto-reply badge */}
                    {chat.auto_reply_enabled && (
                      <span
                        title="Auto-Reply AI Aktif"
                        className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[9px] ring-2 ring-white shadow-xs"
                      >
                        🤖
                      </span>
                    )}
                  </div>

                  {/* Chat Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-xs text-slate-800 truncate">
                        {chat.name || `+${chat.phone}`}
                      </h4>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap ml-2">
                        {chat.last_message_time
                          ? new Date(chat.last_message_time).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        {isTyping ? (
                          <span className="text-emerald-600 font-bold animate-pulse">Sedang mengetik...</span>
                        ) : (
                          chat.last_message_text || 'Belum ada pesan'
                        )}
                      </p>

                      {chat.unread_count > 0 && (
                        <span className="ml-2 flex-shrink-0 bg-emerald-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center">
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
      </div>

      {/* ──────────────── RIGHT AREA: ACTIVE CHAT ROOM ──────────────── */}
      {activeChat ? (
        <div className="flex-1 flex flex-col min-w-0 bg-[#e5ddd5]/30 relative">
          {/* Chat Room Header */}
          <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between z-10 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              {/* Mobile Back Button */}
              <button
                onClick={() => setActiveChat(null)}
                className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-full"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <div
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-3 cursor-pointer min-w-0 group"
              >
                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-sm text-slate-700 overflow-hidden shadow-xs flex-shrink-0">
                  {activeChat.avatar_url ? (
                    <img src={activeChat.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : activeChat.is_group ? (
                    <Users className="w-5 h-5 text-blue-600" />
                  ) : (
                    (activeChat.name || activeChat.phone || 'K').charAt(0).toUpperCase()
                  )}
                </div>

                <div className="min-w-0">
                  <h3 className="font-bold text-xs sm:text-sm text-slate-800 truncate group-hover:text-emerald-700 transition">
                    {activeChat.name || `+${activeChat.phone}`}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
                    {typingMap[activeChat.jid] ? (
                      <span className="text-emerald-600 font-bold animate-pulse">sedang mengetik...</span>
                    ) : isConnected ? (
                      <span className="flex items-center gap-1 text-slate-500">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Online
                      </span>
                    ) : (
                      'WhatsApp Offline'
                    )}
                  </p>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              {/* Auto Reply AI Quick Toggle */}
              <button
                onClick={() => setDrawerOpen(true)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition ${
                  activeAiSetting?.auto_reply_enabled
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Zap className={`w-3.5 h-3.5 ${activeAiSetting?.auto_reply_enabled ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">
                  {activeAiSetting?.auto_reply_enabled ? 'Auto-Reply AI: ON' : 'Auto-Reply AI: OFF'}
                </span>
              </button>

              {/* Incoming Call Simulation Button */}
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
                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
              >
                <Phone className="w-4 h-4" />
              </button>

              {/* Info Drawer Button */}
              <button
                onClick={() => setDrawerOpen(true)}
                title="Info Kontak & Pengaturan AI"
                className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
              >
                <MoreVertical className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages Conversation Area with WhatsApp Pattern Wallpaper */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-[#efeae2]/50">
            {loadingMessages ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                Memuat percakapan...
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
                <div className="w-12 h-12 rounded-2xl bg-white shadow-xs flex items-center justify-center mb-2">
                  <MessageSquare className="w-6 h-6 text-emerald-600" />
                </div>
                <p className="font-bold text-xs text-slate-700">Mulai Obrolan WhatsApp</p>
                <p className="text-[11px] text-slate-500 max-w-xs mt-0.5">
                  Kirim pesan teks pertama atau gunakan saran AI pintar di bawah.
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
                          ? 'bg-[#d9fdd3] text-slate-800 rounded-tr-xs border border-emerald-200/50'
                          : 'bg-white text-slate-800 rounded-tl-xs border border-slate-200/60'
                      }`}
                    >
                      {/* Group sender name */}
                      {activeChat.is_group && !isMe && msg.sender_name && (
                        <p className="text-[10px] font-bold text-emerald-700 mb-0.5">
                          {msg.sender_name}
                        </p>
                      )}

                      {/* Message Content */}
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>

                      {/* Timestamp & Delivery Ticks */}
                      <div className="flex items-center justify-end gap-1 mt-1 text-[9px] text-slate-400 select-none">
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
                              <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
                            ) : msg.status === 'DELIVERED' ? (
                              <CheckCheck className="w-3.5 h-3.5 text-slate-400" />
                            ) : msg.status === 'SENT' ? (
                              <Check className="w-3.5 h-3.5 text-slate-400" />
                            ) : msg.status === 'FAILED' ? (
                              <span className="text-red-500 font-bold">!</span>
                            ) : (
                              <Clock className="w-3 h-3 text-slate-400" />
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

          {/* ──────────────── AI SMART SUGGESTIONS BAR ──────────────── */}
          <div className="px-3 pt-2 bg-slate-50 border-t border-slate-200/70">
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 flex-shrink-0">
                <Sparkles className="w-3 h-3 text-purple-600" />
                Saran AI:
              </span>

              {loadingSuggestions ? (
                <span className="text-[10px] text-slate-400 animate-pulse">Menyiapkan opsi balasan...</span>
              ) : aiSuggestions.length > 0 ? (
                aiSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInputText(sug);
                      textareaRef.current?.focus();
                    }}
                    className="flex-shrink-0 text-[11px] bg-white hover:bg-emerald-50 hover:border-emerald-400 text-slate-700 px-3 py-1 rounded-full border border-slate-200 transition shadow-2xs font-medium"
                  >
                    {sug}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => fetchSmartSuggestions(activeChat.jid)}
                  className="text-[10px] font-bold text-purple-700 hover:underline bg-purple-50 px-2 py-0.5 rounded-md"
                >
                  Generate Rekomendasi
                </button>
              )}
            </div>
          </div>

          {/* ──────────────── MESSAGE COMPOSER BAR ──────────────── */}
          <div className="p-3 bg-white border-t border-slate-200 flex items-end gap-2">
            {/* AI Polish Button */}
            <div className="relative group">
              <button
                type="button"
                onClick={() => handleAiRewrite('friendly')}
                disabled={rewriting || !inputText.trim()}
                title="Poles Teks dengan AI (Ramah, Formal, dll)"
                className="p-2.5 text-purple-600 hover:bg-purple-50 bg-purple-50/50 rounded-xl transition disabled:opacity-40"
              >
                <Sparkles className={`w-4 h-4 ${rewriting ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Textarea Input */}
            <div className="flex-1 bg-slate-100/90 rounded-2xl p-1 flex items-center border border-slate-200 focus-within:border-emerald-500 focus-within:bg-white transition">
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
                placeholder="Ketik pesan..."
                className="flex-1 bg-transparent px-3 py-2 text-xs text-slate-800 placeholder-slate-400 focus:outline-none resize-none max-h-32"
              />
            </div>

            {/* Send Button */}
            <button
              onClick={handleSendMessage}
              disabled={sending || !inputText.trim()}
              className="p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/30 transition active:scale-95 disabled:opacity-40 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        /* ──────────────── EMPTY STATE: NO ACTIVE CHAT ──────────────── */
        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-slate-50/60 text-center select-none">
          <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center shadow-lg mb-4">
            <Bot className="w-10 h-10" />
          </div>

          <h3 className="text-xl font-bold text-slate-800 mb-1">
            WaChat AI Web Client
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
            Kirim dan terima pesan WhatsApp secara real-time yang diperkaya dengan kecerdasan buatan (Auto-Reply, Smart Reply Suggestions, dan Rangkuman Chat).
          </p>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 bg-white border border-slate-200 px-4 py-2 rounded-full shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Terkoneksi langsung ke WhatsApp Baileys Engine</span>
          </div>
        </div>
      )}

      {/* ──────────────── MODALS & DRAWERS ──────────────── */}
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
