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
  Eye,
  Ban,
  Pencil,
  Trash2,
  ChevronDown,
  Pin,
  PinOff,
  Archive,
  ArchiveRestore,
  Reply,
} from 'lucide-react';
import apiClient from '../api/apiClient';
import { useSocket } from '../context/SocketContext';
import AiChatSettingsDrawer from '../components/chat/AiChatSettingsDrawer';
import NewChatModal from '../components/chat/NewChatModal';
import WhatsAppAudioPlayer from '../components/chat/WhatsAppAudioPlayer';
import VoiceNoteRecorder from '../components/chat/VoiceNoteRecorder';
import WhatsAppVideoPlayer from '../components/chat/WhatsAppVideoPlayer';
import MediaViewerModal from '../components/chat/MediaViewerModal';

export default function WaWebChatPage({ waStatus }) {
  const { onEvent } = useSocket();

  const [chats, setChats] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTab, setFilterTab] = useState('all');
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);

  const [activeMenuMsgId, setActiveMenuMsgId] = useState(null);
  const [activeMenuChatJid, setActiveMenuChatJid] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [replyingMessage, setReplyingMessage] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [activeAiSetting, setActiveAiSetting] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newChatModalOpen, setNewChatModalOpen] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [typingMap, setTypingMap] = useState({});
  const typingTimeoutsRef = useRef({});

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    return () => {
      Object.values(typingTimeoutsRef.current).forEach((t) => clearTimeout(t));
      typingTimeoutsRef.current = {};
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchChats = async () => {
    if (waStatus && waStatus.status !== 'CONNECTED') {
      setChats([]);
      setActiveChat(null);
      setMessages([]);
      setLoadingChats(false);
      return;
    }
    try {
      const res = await apiClient.get('/chats', {
        params: { search: searchQuery, filter: filterTab },
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setChats(res.data.data);
      } else {
        setChats([]);
      }
    } catch (err) {
      console.error('Failed to fetch chats:', err);
      setChats([]);
    } finally {
      setLoadingChats(false);
    }
  };

  const handleSyncAll = async () => {
    if (waStatus && waStatus.status !== 'CONNECTED') {
      alert('WhatsApp belum terhubung. Silakan hubungkan WhatsApp terlebih dahulu.');
      return;
    }
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

  useEffect(() => {
    if (waStatus && waStatus.status !== 'CONNECTED') {
      setChats([]);
      setActiveChat(null);
      setMessages([]);
      setAiSuggestions([]);
      setActiveAiSetting(null);
      setLoadingChats(false);
    } else {
      fetchChats();
    }
  }, [searchQuery, filterTab, waStatus?.status]);

  useEffect(() => {
    const unsubSync = onEvent('groups_synced', () => {
      fetchChats();
    });

    const unsubChatSync = onEvent('chat_sync_complete', () => {
      fetchChats();
    });

    const unsubChatsUpdated = onEvent('chats_updated', (data) => {
      if (data?.reset) {
        setChats([]);
        setActiveChat(null);
        setMessages([]);
        setAiSuggestions([]);
        setActiveAiSetting(null);
      } else {
        fetchChats();
      }
    });

    const unsubChatReset = onEvent('chat_reset', () => {
      setChats([]);
      setActiveChat(null);
      setMessages([]);
      setAiSuggestions([]);
      setActiveAiSetting(null);
    });

    const unsubWaStatus = onEvent('wa_status', (statusData) => {
      if (statusData?.status === 'DISCONNECTED') {
        setChats([]);
        setActiveChat(null);
        setMessages([]);
        setAiSuggestions([]);
        setActiveAiSetting(null);
      }
    });

    const unsubChatUpdate = onEvent('chat_update', ({ jid, lastMessage, lastMessageTime, unreadIncrement }) => {
      setChats((prev) => {
        const idx = prev.findIndex((c) => c.jid === jid || c.phone === jid.replace(/[^0-9]/g, ''));
        if (idx !== -1) {
          const updated = [...prev];
          const inc = unreadIncrement && (!activeChat || (activeChat.jid !== jid && activeChat.phone !== jid.replace(/[^0-9]/g, ''))) ? 1 : 0;
          updated[idx] = {
            ...updated[idx],
            last_message_text: lastMessage,
            last_message_time: lastMessageTime || new Date(),
            unread_count: (updated[idx].unread_count || 0) + inc,
          };
          const item = updated.splice(idx, 1)[0];
          return [item, ...updated];
        }
        return prev;
      });
    });

    const unsubMsg = onEvent('message_new', ({ message, contact, remoteJid }) => {
      const targetJid = remoteJid || message?.remote_jid;
      const cleanPhone = targetJid ? targetJid.replace(/[^0-9]/g, '') : null;

      if (targetJid && typingTimeoutsRef.current[targetJid]) {
        clearTimeout(typingTimeoutsRef.current[targetJid]);
        delete typingTimeoutsRef.current[targetJid];
      }
      if (cleanPhone && typingTimeoutsRef.current[cleanPhone]) {
        clearTimeout(typingTimeoutsRef.current[cleanPhone]);
        delete typingTimeoutsRef.current[cleanPhone];
      }

      if (targetJid || cleanPhone) {
        setTypingMap((prev) => ({
          ...prev,
          ...(targetJid ? { [targetJid]: false } : {}),
          ...(cleanPhone ? { [cleanPhone]: false } : {}),
        }));
      }

      if (activeChat && (activeChat.jid === remoteJid || activeChat.phone === remoteJid.replace(/[^0-9]/g, ''))) {
        setMessages((prev) => {
          if (prev.some((m) => (message.id && m.id === message.id) || (message.message_id && m.message_id === message.message_id))) {
            return prev;
          }
          const pendingIndex = prev.findIndex(
            (m) =>
              String(m.id).startsWith('temp_') &&
              (m.from_me || m.direction === 'OUTGOING') &&
              ((m.content === message.content) || (m.media_type && m.media_type === message.media_type))
          );
          if (pendingIndex !== -1) {
            const next = [...prev];
            next[pendingIndex] = message;
            return next;
          }
          return [...prev, message];
        });
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
      if (!jid) return;
      const cleanPhone = jid.replace(/[^0-9]/g, '');

      let isComposing = false;
      if (typeof isTyping === 'boolean') {
        isComposing = isTyping;
      } else if (presences && typeof presences === 'object') {
        isComposing = Object.values(presences).some(
          (p) => p && (p.lastKnownPresence === 'composing' || p.lastKnownPresence === 'recording')
        );
      }

      if (typingTimeoutsRef.current[jid]) {
        clearTimeout(typingTimeoutsRef.current[jid]);
        delete typingTimeoutsRef.current[jid];
      }
      if (cleanPhone && typingTimeoutsRef.current[cleanPhone]) {
        clearTimeout(typingTimeoutsRef.current[cleanPhone]);
        delete typingTimeoutsRef.current[cleanPhone];
      }

      if (isComposing) {
        setTypingMap((prev) => ({
          ...prev,
          [jid]: true,
          ...(cleanPhone ? { [cleanPhone]: true } : {}),
        }));

        const timer = setTimeout(() => {
          setTypingMap((prev) => ({
            ...prev,
            [jid]: false,
            ...(cleanPhone ? { [cleanPhone]: false } : {}),
          }));
          delete typingTimeoutsRef.current[jid];
          if (cleanPhone) delete typingTimeoutsRef.current[cleanPhone];
        }, 4000);

        typingTimeoutsRef.current[jid] = timer;
        if (cleanPhone) typingTimeoutsRef.current[cleanPhone] = timer;
      } else {
        setTypingMap((prev) => ({
          ...prev,
          [jid]: false,
          ...(cleanPhone ? { [cleanPhone]: false } : {}),
        }));
      }
    });

    const unsubAvatarUpdate = onEvent('chat_avatar_update', ({ jid, avatarUrl }) => {
      setChats((prev) =>
        prev.map((c) => (c.jid === jid || c.phone === jid.replace(/[^0-9]/g, '') ? { ...c, avatar_url: avatarUrl } : c))
      );
      setActiveChat((prev) => {
        if (prev && (prev.jid === jid || prev.phone === jid.replace(/[^0-9]/g, ''))) {
          return { ...prev, avatar_url: avatarUrl };
        }
        return prev;
      });
    });

    const unsubRevoke = onEvent('message_revoked', ({ messageId, remoteJid }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.message_id === messageId || m.id === messageId) {
            const currentRaw = typeof m.raw_data === 'object' && m.raw_data ? m.raw_data : {};
            return {
              ...m,
              raw_data: {
                ...currentRaw,
                isDeletedForEveryone: true,
              },
            };
          }
          return m;
        })
      );
    });

    const unsubEdit = onEvent('message_edited', ({ messageId, newContent, remoteJid, rawData }) => {
      setMessages((prev) =>
        prev.map((m) => {
          if (m.message_id === messageId || m.id === messageId) {
            const currentRaw = typeof m.raw_data === 'object' && m.raw_data ? m.raw_data : {};
            return {
              ...m,
              content: newContent,
              raw_data: {
                ...currentRaw,
                ...(rawData || {}),
                isEdited: true,
              },
            };
          }
          return m;
        })
      );
    });

    const unsubDeleteForMe = onEvent('message_deleted_for_me', ({ messageId }) => {
      setMessages((prev) =>
        prev.filter((m) => m.message_id !== messageId && m.id !== messageId)
      );
    });

    return () => {
      unsubSync();
      unsubChatSync();
      unsubChatsUpdated();
      unsubChatReset();
      unsubWaStatus();
      unsubChatUpdate();
      unsubMsg();
      unsubStatus();
      unsubPresence();
      unsubAvatarUpdate();
      unsubRevoke();
      unsubEdit();
      unsubDeleteForMe();
    };
  }, [activeChat, onEvent]);

  useEffect(() => {
    const handleGlobalClick = () => {
      setActiveMenuMsgId(null);
      setActiveMenuChatJid(null);
    };
    window.addEventListener('click', handleGlobalClick);
    return () => window.removeEventListener('click', handleGlobalClick);
  }, []);

  const handleTogglePin = async (chat, e) => {
    if (e) e.stopPropagation();
    const newPinned = !chat.is_pinned;
    setActiveMenuChatJid(null);

    setChats((prev) => {
      const updated = prev.map((c) =>
        c.jid === chat.jid || c.phone === chat.phone
          ? { ...c, is_pinned: newPinned, pinned_at: newPinned ? new Date() : null }
          : c
      );
      return updated.sort((a, b) => {
        if (!!b.is_pinned !== !!a.is_pinned) return (b.is_pinned ? 1 : 0) - (a.is_pinned ? 1 : 0);
        return new Date(b.last_message_time || 0) - new Date(a.last_message_time || 0);
      });
    });

    try {
      await apiClient.post('/chats/pin', {
        jid: chat.jid || chat.phone,
        pinned: newPinned,
      });
    } catch (err) {
      console.error('Failed to toggle pin:', err);
      fetchChats();
    }
  };

  const handleToggleArchive = async (chat, e) => {
    if (e) e.stopPropagation();
    const newArchived = !chat.is_archived;
    setActiveMenuChatJid(null);

    if (activeChat && (activeChat.jid === chat.jid || activeChat.phone === chat.phone)) {
      if (newArchived && filterTab !== 'archived') {
        setActiveChat(null);
        setMessages([]);
      }
    }

    try {
      await apiClient.post('/chats/archive', {
        jid: chat.jid || chat.phone,
        archived: newArchived,
      });
      fetchChats();
    } catch (err) {
      console.error('Failed to toggle archive:', err);
      fetchChats();
    }
  };

  const handleSelectChat = async (chat) => {
    setActiveChat(chat);
    setLoadingMessages(true);
    setAiSuggestions([]);
    setEditingMessage(null);
    setReplyingMessage(null);
    setActiveMenuMsgId(null);
    setActiveMenuChatJid(null);
    try {
      const res = await apiClient.get(`/chats/${encodeURIComponent(chat.jid || chat.phone)}/messages`);
      if (res.data.success && res.data.data) {
        setMessages(res.data.data.messages || []);
        setActiveAiSetting(res.data.data.aiSetting || null);
        if (res.data.data.contact) {
          setActiveChat((prev) => ({ ...prev, ...res.data.data.contact }));
        }

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

  const handleStartEdit = (msg) => {
    setEditingMessage(msg);
    setReplyingMessage(null);
    setInputText(msg.content || '');
    setActiveMenuMsgId(null);
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCancelEdit = () => {
    setEditingMessage(null);
    setInputText('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage || !inputText.trim() || !activeChat || savingEdit) return;

    const newText = inputText.trim();
    const targetMsgId = editingMessage.message_id || editingMessage.id;
    setSavingEdit(true);

    try {
      const res = await apiClient.post('/chats/messages/edit', {
        jid: activeChat.jid || activeChat.phone,
        messageId: targetMsgId,
        newText,
      });

      if (res.data.success) {
        setMessages((prev) =>
          prev.map((m) =>
            (m.message_id === targetMsgId || m.id === targetMsgId)
              ? {
                  ...m,
                  content: newText,
                  raw_data: {
                    ...(typeof m.raw_data === 'object' && m.raw_data ? m.raw_data : {}),
                    isEdited: true,
                    editedAt: new Date(),
                  },
                }
              : m
          )
        );
        handleCancelEdit();
      }
    } catch (err) {
      console.error('Failed to edit message:', err);
      alert(err.response?.data?.message || 'Gagal mengedit pesan');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirm || !activeChat || deletingMessage) return;

    const targetMsg = deleteConfirm.message;
    const targetId = targetMsg.message_id || targetMsg.id;
    setDeletingMessage(true);

    try {
      if (deleteConfirm.type === 'everyone') {
        const res = await apiClient.post('/chats/messages/delete-for-everyone', {
          jid: activeChat.jid || activeChat.phone,
          messageId: targetId,
        });

        if (res.data.success) {
          setMessages((prev) =>
            prev.map((m) =>
              (m.message_id === targetId || m.id === targetId)
                ? {
                    ...m,
                    raw_data: {
                      ...(typeof m.raw_data === 'object' && m.raw_data ? m.raw_data : {}),
                      isDeletedForEveryone: true,
                    },
                  }
                : m
            )
          );
        }
      } else {
        const res = await apiClient.post('/chats/messages/delete-for-me', {
          messageId: targetId,
        });

        if (res.data.success) {
          setMessages((prev) =>
            prev.filter((m) => m.message_id !== targetId && m.id !== targetId)
          );
        }
      }
      setDeleteConfirm(null);
    } catch (err) {
      console.error('Failed to delete message:', err);
      alert(err.response?.data?.message || 'Gagal menghapus pesan');
    } finally {
      setDeletingMessage(false);
    }
  };

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if (editingMessage) {
      handleSaveEdit();
      return;
    }
    if (!inputText.trim() || !activeChat || sending) return;

    const messageText = inputText.trim();
    const targetReplying = replyingMessage;
    setInputText('');
    setReplyingMessage(null);
    setSending(true);

    const tempId = 'temp_' + Date.now();
    const tempMessage = {
      id: tempId,
      phone: activeChat.phone,
      remote_jid: activeChat.jid,
      content: messageText,
      direction: 'OUTGOING',
      status: 'PENDING',
      from_me: true,
      quoted_message: targetReplying ? {
        messageId: targetReplying.message_id || targetReplying.id,
        senderName: targetReplying.from_me ? 'Anda' : (targetReplying.sender_name || (targetReplying.phone ? `+${targetReplying.phone}` : 'Kontak')),
        senderPhone: targetReplying.phone || null,
        content: targetReplying.content || (targetReplying.media_type === 'image' ? '📷 Foto' : (targetReplying.media_type === 'video' ? '🎥 Video' : (targetReplying.media_type === 'voice' || targetReplying.media_type === 'audio' ? '🎤 Pesan Suara' : 'Pesan'))),
        mediaType: targetReplying.media_type || 'text',
        fromMe: !!targetReplying.from_me,
      } : null,
      sent_at: new Date(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    scrollToBottom();

    try {
      const res = await apiClient.post('/chats/send', {
        jid: activeChat.jid || activeChat.phone,
        message: messageText,
        quotedMessageId: targetReplying ? (targetReplying.message_id || targetReplying.id) : null,
      });

      if (res.data.success && res.data.data) {
        const saved = res.data.data;
        setMessages((prev) => {
          const exists = prev.some(
            (m) => (m.id && m.id === saved.id) || (m.message_id && m.message_id === saved.message_id)
          );
          if (exists) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? saved : m));
        });
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED' } : m))
      );
    } finally {
      setSending(false);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleSendVoiceNote = async (audioBlob) => {
    if (!activeChat || !audioBlob) return;
    const targetReplying = replyingMessage;
    setIsRecordingAudio(false);
    setReplyingMessage(null);

    const tempId = 'temp_vn_' + Date.now();
    const localUrl = URL.createObjectURL(audioBlob);
    const tempMessage = {
      id: tempId,
      phone: activeChat.phone,
      remote_jid: activeChat.jid,
      content: '🎤 Pesan Suara',
      media_type: 'voice',
      media_url: localUrl,
      media_caption: 'Pesan Suara',
      direction: 'OUTGOING',
      status: 'PENDING',
      from_me: true,
      quoted_message: targetReplying ? {
        messageId: targetReplying.message_id || targetReplying.id,
        senderName: targetReplying.from_me ? 'Anda' : (targetReplying.sender_name || (targetReplying.phone ? `+${targetReplying.phone}` : 'Kontak')),
        senderPhone: targetReplying.phone || null,
        content: targetReplying.content || (targetReplying.media_type === 'image' ? '📷 Foto' : (targetReplying.media_type === 'video' ? '🎥 Video' : (targetReplying.media_type === 'voice' || targetReplying.media_type === 'audio' ? '🎤 Pesan Suara' : 'Pesan'))),
        mediaType: targetReplying.media_type || 'text',
        fromMe: !!targetReplying.from_me,
      } : null,
      sent_at: new Date(),
    };

    setMessages((prev) => [...prev, tempMessage]);
    scrollToBottom();

    const formData = new FormData();
    const ext = audioBlob.type.includes('webm') ? 'webm' : (audioBlob.type.includes('ogg') ? 'ogg' : 'mp4');
    formData.append('audio', audioBlob, `voice_${Date.now()}.${ext}`);
    formData.append('jid', activeChat.jid || activeChat.phone);
    if (targetReplying) {
      formData.append('quotedMessageId', targetReplying.message_id || targetReplying.id);
    }

    try {
      const res = await apiClient.post('/chats/send-voice', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (res.data.success && res.data.data) {
        const saved = res.data.data;
        setMessages((prev) => {
          const exists = prev.some(
            (m) => (m.id && m.id === saved.id) || (m.message_id && m.message_id === saved.message_id)
          );
          if (exists) {
            return prev.filter((m) => m.id !== tempId);
          }
          return prev.map((m) => (m.id === tempId ? saved : m));
        });
        setTimeout(scrollToBottom, 100);
      }
    } catch (err) {
      console.error('Failed to send voice note:', err);
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? { ...m, status: 'FAILED' } : m))
      );
      alert(err.response?.data?.message || 'Gagal mengirim Voice Note');
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
      const hours = String(date.getHours()).padStart(2, '0');
      const mins = String(date.getMinutes()).padStart(2, '0');
      return `${hours}.${mins}`;
    }
    if (isYesterday) {
      return 'Kemarin';
    }

    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    if (diffDays < 7) {
      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
      return days[date.getDay()];
    }

    return date.toLocaleDateString('id-ID', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const renderSnippet = (text) => {
    if (!text) return 'Belum ada pesan';
    if (text.startsWith('✓✓ ') || text.startsWith('✓ ')) {
      const isDelivered = text.startsWith('✓✓ ');
      const clean = text.replace(/^(✓✓ |✓ )/, '');
      return (
        <span className="flex items-center gap-1 min-w-0 truncate">
          <CheckCheck className={`w-3.5 h-3.5 flex-shrink-0 ${isDelivered ? 'text-blue-500' : 'text-slate-400'}`} />
          <span className="truncate">{clean}</span>
        </span>
      );
    }
    return <span className="truncate">{text}</span>;
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
              { id: 'archived', label: '📦 Diarsipkan' },
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
          {filterTab === 'archived' && (
            <div className="px-4 py-2 bg-slate-100 dark:bg-[#182229] border-b border-slate-200 dark:border-[#2a3942] flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
              <Archive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Obrolan Diarsipkan</span>
            </div>
          )}

          {loadingChats ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              Memuat percakapan WhatsApp...
            </div>
          ) : chats.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-bold text-slate-700 dark:text-slate-300 mb-1">
                {filterTab === 'archived' ? 'Tidak Ada Chat Diarsipkan' : 'Tidak Ada Obrolan'}
              </p>
              <p className="text-[11px]">
                {searchQuery
                  ? 'Tidak ada hasil obrolan yang cocok'
                  : filterTab === 'archived'
                  ? 'Gunakan menu opsi pada obrolan untuk mengarsipkan chat'
                  : 'Klik tombol + di atas untuk memulai obrolan baru'}
              </p>
            </div>
          ) : (
            chats.map((chat) => {
              const isSelected = activeChat?.jid === chat.jid || (activeChat?.phone && activeChat.phone === chat.phone);
              const isTyping = !!(typingMap[chat.jid] || (chat.phone && typingMap[chat.phone]) || (chat.jid && typingMap[chat.jid.replace(/[^0-9]/g, '')]));
              const hasUnread = (chat.unread_count || 0) > 0;
              const chatKey = chat.jid || chat.phone;

              return (
                <div
                  key={chat.id || chatKey}
                  onClick={() => handleSelectChat(chat)}
                  className={`flex items-center gap-3 px-3.5 py-3 cursor-pointer transition relative group ${
                    isSelected
                      ? 'bg-blue-50/90 dark:bg-[#2a3942] border-r-4 border-blue-600'
                      : 'hover:bg-slate-50 dark:hover:bg-[#202c33]/70 bg-white dark:bg-[#111b21]'
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm overflow-hidden shadow-xs ${
                        chat.name === 'WhatsApp'
                          ? 'bg-emerald-500 text-white'
                          : 'bg-gradient-to-tr from-blue-500 to-indigo-600 text-white'
                      }`}
                    >
                      {chat.avatar_url ? (
                        <img src={chat.avatar_url} alt={chat.name} className="w-full h-full object-cover" />
                      ) : chat.name === 'WhatsApp' ? (
                        <span className="text-xl">💬</span>
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

                      <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                        {chat.is_pinned && (
                          <Pin className="w-3.5 h-3.5 text-slate-400 fill-slate-400/40 -rotate-45 flex-shrink-0" />
                        )}
                        <span
                          className={`text-[11px] whitespace-nowrap ${
                            hasUnread ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400'
                          }`}
                        >
                          {formatChatTime(chat.last_message_time)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex-1 min-w-0">
                        {isTyping ? (
                          <span className="text-blue-600 dark:text-blue-400 font-bold animate-pulse">sedang mengetik...</span>
                        ) : (
                          renderSnippet(chat.last_message_text)
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {hasUnread && (
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-4 text-center shadow-xs">
                            {chat.unread_count}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuChatJid(activeMenuChatJid === chatKey ? null : chatKey);
                          }}
                          className={`p-1 rounded-md transition-all text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2a3942] ${
                            activeMenuChatJid === chatKey
                              ? 'opacity-100 bg-slate-200 dark:bg-[#2a3942]'
                              : 'opacity-0 group-hover:opacity-100'
                          }`}
                          title="Menu Chat"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {activeMenuChatJid === chatKey && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="absolute right-3 top-10 z-40 py-1.5 rounded-xl bg-white dark:bg-[#233138] border border-slate-200 dark:border-[#2a3942] shadow-2xl text-xs w-48 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        onClick={(e) => handleToggleArchive(chat, e)}
                        className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] transition font-medium"
                      >
                        {chat.is_archived ? (
                          <>
                            <ArchiveRestore className="w-4 h-4 text-slate-400" />
                            <span>Buka arsip</span>
                          </>
                        ) : (
                          <>
                            <Archive className="w-4 h-4 text-slate-400" />
                            <span>Arsipkan chat</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={(e) => handleTogglePin(chat, e)}
                        className="w-full px-3.5 py-2.5 text-left flex items-center gap-2.5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] transition font-medium"
                      >
                        {chat.is_pinned ? (
                          <>
                            <PinOff className="w-4 h-4 text-slate-400" />
                            <span>Lepas sematan</span>
                          </>
                        ) : (
                          <>
                            <Pin className="w-4 h-4 text-slate-400" />
                            <span>Sematkan chat</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
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
                    {typingMap[activeChat.jid] || (activeChat.phone && typingMap[activeChat.phone]) || (activeChat.jid && typingMap[activeChat.jid.replace(/[^0-9]/g, '')]) ? (
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
                const msgKey = msg.message_id || msg.id || index;

                return (
                  <div
                    key={msg.id || index}
                    id={`msg-${msg.message_id || msg.id || index}`}
                    className={`flex flex-col transition-all duration-300 rounded-2xl p-0.5 ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      onDoubleClick={() => {
                        setReplyingMessage(msg);
                        setEditingMessage(null);
                        textareaRef.current?.focus();
                      }}
                      className={`max-w-[85%] sm:max-w-[70%] md:max-w-[65%] rounded-2xl px-3.5 py-2 text-xs shadow-xs relative leading-relaxed group/bubble ${
                        isMe
                          ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-500/10'
                          : 'bg-white dark:bg-[#202c33] text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200/80 dark:border-[#2a3942]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuMsgId(activeMenuMsgId === msgKey ? null : msgKey);
                        }}
                        className={`absolute top-1.5 right-1.5 p-0.5 rounded-md transition-all z-10 ${
                          activeMenuMsgId === msgKey
                            ? 'opacity-100 bg-black/25 text-white'
                            : 'opacity-0 group-hover/bubble:opacity-100 hover:bg-black/15 text-current'
                        }`}
                        title="Pilihan pesan"
                      >
                        <ChevronDown className="w-3.5 h-3.5" />
                      </button>

                      {activeChat.is_group && !isMe && msg.sender_name && (
                        <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mb-0.5">
                          {msg.sender_name}
                        </p>
                      )}

                      {(() => {
                        const isDeleted = msg.raw_data?.isDeletedForEveryone || 
                          (typeof msg.raw_data === 'string' && msg.raw_data.includes('"isDeletedForEveryone":true')) || 
                          msg.status === 'REVOKED';

                        const isEdited = msg.raw_data?.isEdited ||
                          (typeof msg.raw_data === 'string' && msg.raw_data.includes('"isEdited":true')) ||
                          !!msg.raw_data?.editedAt;

                        const isVo = msg.raw_data?.isViewOnce || 
                          (typeof msg.raw_data === 'string' && msg.raw_data.includes('"isViewOnce":true')) || 
                          msg.content?.includes('(Sekali Lihat)') || 
                          msg.media_caption?.includes('Sekali Lihat') || 
                          msg.content?.includes('👁️');

                        let qMsg = msg.quoted_message;
                        if (typeof qMsg === 'string') {
                          try { qMsg = JSON.parse(qMsg); } catch (e) {}
                        }

                        return (
                          <>
                            {activeMenuMsgId === msgKey && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                className={`absolute top-7 z-30 py-1.5 rounded-xl bg-white dark:bg-[#233138] border border-slate-200 dark:border-[#2a3942] shadow-2xl text-xs w-48 animate-in fade-in zoom-in-95 duration-100 ${
                                  isMe ? 'right-0' : 'left-0 sm:right-auto sm:left-0'
                                }`}
                              >
                                <button
                                  onClick={() => {
                                    setActiveMenuMsgId(null);
                                    setReplyingMessage(msg);
                                    setEditingMessage(null);
                                    if (textareaRef.current) textareaRef.current.focus();
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] transition font-medium"
                                >
                                  <Reply className="w-3.5 h-3.5 text-blue-500" />
                                  <span>Balas</span>
                                </button>

                                {isMe && !isDeleted && msg.media_type === 'text' && (
                                  <button
                                    onClick={() => handleStartEdit(msg)}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
                                  >
                                    <Pencil className="w-3.5 h-3.5 text-blue-500" />
                                    <span>Edit pesan</span>
                                  </button>
                                )}

                                {isMe && !isDeleted && (
                                  <button
                                    onClick={() => {
                                      setActiveMenuMsgId(null);
                                      setDeleteConfirm({ type: 'everyone', message: msg });
                                    }}
                                    className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition font-medium"
                                  >
                                    <Ban className="w-3.5 h-3.5 text-rose-500" />
                                    <span>Hapus untuk semua</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setActiveMenuMsgId(null);
                                    setDeleteConfirm({ type: 'me', message: msg });
                                  }}
                                  className="w-full px-3.5 py-2 text-left flex items-center gap-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#182229] transition"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Hapus untuk saya</span>
                                </button>
                              </div>
                            )}

                            {qMsg && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (qMsg.messageId) {
                                    const targetEl = document.getElementById(`msg-${qMsg.messageId}`);
                                    if (targetEl) {
                                      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      targetEl.classList.add('ring-2', 'ring-blue-400', 'bg-blue-100/60', 'transition-all');
                                      setTimeout(() => targetEl.classList.remove('ring-2', 'ring-blue-400', 'bg-blue-100/60'), 1600);
                                    }
                                  }
                                }}
                                className={`mb-2 p-2 rounded-xl text-[11px] cursor-pointer transition flex flex-col border-l-4 ${
                                  isMe
                                    ? 'bg-blue-700/60 border-white/80 text-white hover:bg-blue-700/80'
                                    : 'bg-slate-100 dark:bg-[#182229] border-blue-600 text-slate-700 dark:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-[#1f2c34]'
                                }`}
                              >
                                <span className={`font-bold text-[10.5px] ${isMe ? 'text-blue-100' : 'text-blue-600 dark:text-blue-400'}`}>
                                  {qMsg.senderName || (qMsg.fromMe ? 'Anda' : (qMsg.senderPhone ? `+${qMsg.senderPhone}` : 'Kontak'))}
                                </span>
                                <span className="truncate mt-0.5 opacity-90 text-[11px]">
                                  {qMsg.content || (qMsg.mediaType === 'image' ? '📷 Foto' : (qMsg.mediaType === 'video' ? '🎥 Video' : (qMsg.mediaType === 'voice' ? '🎤 Pesan Suara' : 'Pesan')))}
                                </span>
                              </div>
                            )}

                            {isDeleted && (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-500/15 dark:bg-rose-950/40 border border-rose-400/30 text-rose-600 dark:text-rose-300 font-bold text-[10px] mb-2 select-none w-fit">
                                <Ban className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
                                <span>Pesan ini telah ditarik oleh pengirim</span>
                              </div>
                            )}

                            {(() => {
                              if (msg.media_type === 'voice' || msg.media_type === 'audio' || (msg.media_url && (msg.media_url.endsWith('.ogg') || msg.media_url.endsWith('.mp3') || msg.media_url.endsWith('.m4a') || msg.media_url.endsWith('.webm')))) {
                                return <WhatsAppAudioPlayer audioUrl={msg.media_url} isMe={isMe} senderAvatar={msg.sender_avatar} />;
                              }

                              if (msg.media_type === 'video' && msg.media_url) {
                                return (
                                  <WhatsAppVideoPlayer
                                    videoUrl={msg.media_url}
                                    isMe={isMe}
                                    caption={msg.content}
                                    isViewOnce={isVo}
                                    onExpand={() => setPreviewMedia({
                                      type: 'video',
                                      url: msg.media_url,
                                      caption: msg.content,
                                      isViewOnce: isVo
                                    })}
                                  />
                                );
                              }

                              if (msg.media_type === 'image' && msg.media_url) {
                                return (
                                  <div 
                                    className="mb-1 rounded-xl overflow-hidden max-w-xs relative group cursor-pointer"
                                    onClick={() => setPreviewMedia({
                                      type: 'image',
                                      url: msg.media_url,
                                      caption: msg.content,
                                      isViewOnce: isVo
                                    })}
                                  >
                                    {isVo && (
                                      <div className="absolute top-2 left-2 z-10 flex items-center gap-1 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-amber-300 border border-amber-400/40 text-[10px] font-bold shadow-md">
                                        <Eye className="w-3 h-3 text-amber-400 animate-pulse" />
                                        <span>Sekali Lihat</span>
                                      </div>
                                    )}
                                    <img
                                      src={msg.media_url}
                                      alt="Foto"
                                      className="w-full h-auto object-cover max-h-60 rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                                    />
                                    {msg.content && msg.content !== '📷 Foto' && msg.content !== '👁️ Foto (Sekali Lihat)' && (
                                      <p className="whitespace-pre-wrap break-words mt-1">{msg.content}</p>
                                    )}
                                  </div>
                                );
                              }

                              if (msg.media_type === 'view_once' || isVo) {
                                return (
                                  <div className="flex items-center gap-3 py-1.5 px-2 rounded-xl bg-amber-500/10 dark:bg-amber-950/40 border border-amber-400/30 text-amber-900 dark:text-amber-200 select-none">
                                    <div className="w-8 h-8 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-500 flex items-center justify-center flex-shrink-0">
                                      <Eye className="w-4 h-4 animate-pulse" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold text-xs flex items-center gap-1.5">
                                        <span>Pesan Sekali Lihat</span>
                                        <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 font-semibold">1x</span>
                                      </p>
                                      <p className="text-[10px] opacity-80 mt-0.5">
                                        Buka langsung di aplikasi WhatsApp ponsel Anda
                                      </p>
                                    </div>
                                  </div>
                                );
                              }

                              return <p className="whitespace-pre-wrap break-words">{msg.content}</p>;
                            })()}

                            <div
                              className={`flex items-center justify-end gap-1.5 mt-1 text-[9px] select-none ${
                                isMe ? 'text-blue-100' : 'text-slate-400 dark:text-slate-400'
                              }`}
                            >
                              {isEdited && (
                                <span className="italic opacity-80 text-[8.5px]">diedit</span>
                              )}

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
                          </>
                        );
                      })()}
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

          {replyingMessage && (
            <div className="px-4 py-2 bg-slate-100 dark:bg-[#202c33] border-t border-slate-200 dark:border-[#2a3942] flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1 border-l-4 border-blue-600 pl-2.5 py-0.5">
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[11px] text-blue-600 dark:text-blue-400">
                    Membalas {replyingMessage.from_me ? 'Anda' : (replyingMessage.sender_name || (replyingMessage.phone ? `+${replyingMessage.phone}` : 'Kontak'))}
                  </p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 truncate">
                    {replyingMessage.media_type === 'image' ? '📷 Foto' :
                     replyingMessage.media_type === 'video' ? '🎥 Video' :
                     replyingMessage.media_type === 'voice' || replyingMessage.media_type === 'audio' ? '🎤 Pesan Suara' :
                     replyingMessage.media_type === 'document' ? '📄 Dokumen' :
                     replyingMessage.content}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReplyingMessage(null)}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#2a3942] rounded-lg transition ml-2"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {editingMessage && (
            <div className="px-4 py-2.5 bg-blue-50/95 dark:bg-blue-950/70 border-t border-blue-200 dark:border-blue-800 flex items-center justify-between text-xs animate-in slide-in-from-bottom-2">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="p-1.5 rounded-lg bg-blue-600 text-white flex-shrink-0">
                  <Pencil className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-[11px] text-blue-700 dark:text-blue-300">Mengedit Pesan</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 truncate">{editingMessage.content}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 ml-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 transition"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={savingEdit || !inputText.trim()}
                  className="px-3 py-1 rounded-lg text-[11px] font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition disabled:opacity-50 flex items-center gap-1"
                >
                  <Check className="w-3 h-3" />
                  <span>{savingEdit ? 'Menyimpan...' : 'Simpan'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="p-3 bg-white dark:bg-[#202c33] border-t border-slate-200 dark:border-[#2a3942] flex items-center gap-2">
            {isRecordingAudio ? (
              <VoiceNoteRecorder
                onSend={handleSendVoiceNote}
                onCancel={() => setIsRecordingAudio(false)}
              />
            ) : (
              <>
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
                    disabled={sending || savingEdit}
                    className="p-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/30 transition active:scale-95 flex-shrink-0"
                  >
                    {editingMessage ? <Check className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsRecordingAudio(true)}
                    title="Pesan Suara"
                    className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#111b21] rounded-xl transition flex-shrink-0"
                  >
                    <Mic className="w-5 h-5" />
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 flex-col items-center justify-between p-8 bg-[#f4f7fb] dark:bg-[#111b21] text-center select-none">
          <div className="w-full"></div>

          <div className="flex flex-col items-center max-w-md">
            <div className="w-24 h-24 rounded-3xl bg-emerald-50 dark:bg-[#202c33] border border-emerald-200/80 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-md mb-6 relative">
              <Phone className="w-12 h-12" />
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shadow-md">
                <Bot className="w-4 h-4" />
              </div>
            </div>

            <h3 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
              Telepon suara dan video kini sudah tersedia
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-6">
              Kini Anda bisa mengelola obrolan WhatsApp, auto-reply AI pintar, dan pesan terenkripsi secara langsung.
            </p>

            <button
              onClick={() => setNewChatModalOpen(true)}
              className="px-6 py-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition active:scale-95 mb-8"
            >
              Mulai Obrolan Baru
            </button>

            <div className="grid grid-cols-4 gap-4 w-full pt-4 border-t border-slate-200/60 dark:border-[#222d34]">
              <button
                onClick={() => setNewChatModalOpen(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300 transition"
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <Paperclip className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium">Kirim file</span>
              </button>

              <button
                onClick={() => setNewChatModalOpen(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300 transition"
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <User className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium">Tambah kontak</span>
              </button>

              <button
                onClick={handleSyncAll}
                disabled={syncing}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33] text-slate-600 dark:text-slate-300 transition disabled:opacity-50"
              >
                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-[#202c33] border border-slate-200 dark:border-[#2a3942] flex items-center justify-center text-slate-600 dark:text-slate-300">
                  <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
                </div>
                <span className="text-[10px] font-medium">Sinkron chat</span>
              </button>

              <button
                onClick={() => setDrawerOpen(true)}
                className="flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#202c33] text-indigo-600 dark:text-indigo-400 transition"
              >
                <div className="w-9 h-9 rounded-full bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800/60 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium">Pengaturan AI</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            <span>Pesan pribadi Anda terenkripsi secara end-to-end</span>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div 
          onClick={() => setDeleteConfirm(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-[#111b21] rounded-2xl max-w-sm w-full p-5 border border-slate-200 dark:border-[#2a3942] shadow-2xl animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                deleteConfirm.type === 'everyone' ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-500/20 text-slate-500'
              }`}>
                {deleteConfirm.type === 'everyone' ? <Ban className="w-5 h-5" /> : <Trash2 className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {deleteConfirm.type === 'everyone' ? 'Hapus untuk Semua Orang?' : 'Hapus untuk Saya?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {deleteConfirm.type === 'everyone'
                    ? 'Pesan ini akan ditarik dari semua orang di percakapan WhatsApp.'
                    : 'Pesan ini hanya akan dihapus dari tampilan Anda.'}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deletingMessage}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#202c33] rounded-xl transition"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deletingMessage}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition flex items-center gap-1.5 ${
                  deleteConfirm.type === 'everyone'
                    ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                    : 'bg-slate-700 hover:bg-slate-800'
                }`}
              >
                {deletingMessage ? (
                  <span>Menghapus...</span>
                ) : (
                  <span>{deleteConfirm.type === 'everyone' ? 'Tarik Pesan' : 'Hapus'}</span>
                )}
              </button>
            </div>
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

      <NewChatModal
        isOpen={newChatModalOpen}
        onClose={() => setNewChatModalOpen(false)}
        contacts={chats}
        onSelectContact={(selected) => handleSelectChat(selected)}
      />

      <MediaViewerModal
        media={previewMedia}
        onClose={() => setPreviewMedia(null)}
      />
    </div>
  );
}
