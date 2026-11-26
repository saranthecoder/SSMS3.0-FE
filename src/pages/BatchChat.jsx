import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useGlobalBatch } from '../context/GlobalBatchContext';
import Swal from 'sweetalert2';
import { 
  Send, Hash, Users, Megaphone, UserCheck, Mail, Phone, Bell, Sparkles, Pin, 
  Search, Paperclip, Image as ImageIcon, FileText, CheckCheck, X, Check, MessageSquare, 
  ChevronRight, Circle, ShieldCheck, User, ArrowLeft, Plus, AlertCircle, Info, LogOut,
  Calendar, Clock, Trash2, Edit, UserPlus, UserMinus, Copy, ExternalLink, Code2,
  Coins, Globe, Link2, Gift, HeartHandshake, CheckCircle2, Download
} from 'lucide-react';
import Loader from '../components/Loader';
import ImageCropModal from '../components/ImageCropModal';
import { soundManager } from '../utils/soundManager';

// Smart message formatter for code blocks, clickable links, and clean prose
const FormattedMessageText = ({ text, isMe, attachmentType }) => {
  const [copied, setCopied] = useState(false);

  if (!text) return null;

  // Check if text looks like a code snippet
  const isCodeSnippet = () => {
    if (attachmentType === 'code') return true;
    if (text.startsWith('```') && text.endsWith('```')) return true;
    const keywords = ['import ', 'export default', 'function(', 'function ', 'const ', 'let ', 'var ', '<Route', '<BrowserRouter', 'class ', 'def ', 'console.log', 'return (', '=> {'];
    const hits = keywords.filter(kw => text.includes(kw));
    return hits.length >= 2 || (text.includes('{') && text.includes('}') && text.includes(';') && (text.includes('\n') || text.includes('; ')));
  };

  const handleCopyCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isCodeSnippet()) {
    // Detect language from markdown fence if available
    let detectedLang = 'Code Snippet';
    const langMatch = text.match(/^```([a-zA-Z0-9_-]+)/);
    if (langMatch && langMatch[1]) {
      detectedLang = langMatch[1].toUpperCase();
    }

    let cleanCode = text.replace(/^```[a-zA-Z0-9_-]*\n?/i, '').replace(/\n?```$/i, '');

    // Format single-line squished statements separated by semicolons onto distinct lines
    if (!cleanCode.includes('\n') && (cleanCode.match(/;\s+/g) || []).length >= 1) {
      cleanCode = cleanCode.replace(/;\s+/g, ';\n');
    }

    const lines = cleanCode.split('\n');

    return (
      <div className="relative group my-2 rounded-2xl overflow-hidden bg-slate-950 text-slate-200 border border-slate-800 text-xs font-mono shadow-xl text-left max-w-full">
        <div className="flex items-center justify-between px-3.5 py-2 bg-slate-900/90 border-b border-slate-800 text-[11px] text-slate-400 select-none">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-indigo-400">
            <Code2 size={14} /> {detectedLang}
          </span>
          <button
            type="button"
            onClick={() => handleCopyCode(cleanCode)}
            className="flex items-center gap-1.5 hover:text-white px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer text-[10px] font-bold"
          >
            {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>
        <div className="p-3 overflow-x-auto custom-scrollbar">
          {/* Synchronized row-by-row table layout ensuring exact line-to-code alignment */}
          <table className="w-full border-collapse font-mono text-xs select-text">
            <tbody>
              {lines.map((codeLine, idx) => (
                <tr key={idx} className="hover:bg-white/[0.04] transition-colors leading-relaxed">
                  <td className="select-none pr-3 pl-1 text-slate-600 font-mono text-xs text-right align-top w-8 shrink-0 border-r border-slate-800/80">
                    {idx + 1}
                  </td>
                  <td className="pl-3 pr-2 font-mono text-xs text-slate-200 align-top whitespace-pre break-all leading-relaxed">
                    {codeLine || '\u00A0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Detect URLs and render clickable, styled links
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);

  return (
    <p className={`text-xs sm:text-[13px] leading-relaxed font-normal whitespace-pre-wrap break-words ${
      isMe ? 'text-white' : 'text-slate-800 dark:text-slate-200'
    }`}>
      {parts.map((part, i) => {
        if (part.match(urlRegex)) {
          let displayUrl = part;
          try {
            const u = new URL(part);
            const pathTrunc = u.pathname.length > 25 ? `${u.pathname.substring(0, 22)}...` : u.pathname;
            displayUrl = `${u.hostname}${pathTrunc}`;
          } catch {
            displayUrl = part.length > 35 ? `${part.substring(0, 32)}...` : part;
          }
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className={`inline-flex items-center gap-1 font-bold underline underline-offset-2 break-all mx-0.5 transition-opacity hover:opacity-80 ${
                isMe ? 'text-cyan-200' : 'text-indigo-600 dark:text-indigo-400'
              }`}
            >
              <span>{displayUrl}</span>
              <ExternalLink size={11} className="inline shrink-0" />
            </a>
          );
        }
        return part;
      })}
    </p>
  );
};

// WhatsApp-style Skeleton Loaders for Instant Shell Rendering
const ChatSidebarSkeleton = () => (
  <div className="space-y-2 p-3 animate-pulse">
    {[...Array(6)].map((_, i) => (
      <div key={i} className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/40 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/60">
        <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-700/70 shrink-0" />
        <div className="flex-1 space-y-2 min-w-0">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded-md w-3/4" />
          <div className="h-2.5 bg-slate-100 dark:bg-slate-800 rounded-md w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

const ChatMessageSkeleton = () => (
  <div className="w-full h-full p-4 sm:p-6 space-y-4 animate-pulse">
    <div className="flex items-start gap-2.5 max-w-[70%]">
      <div className="w-8 h-8 rounded-full bg-slate-700/50 shrink-0" />
      <div className="space-y-2 bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-2xl rounded-tl-sm w-52">
        <div className="h-3 bg-slate-600/60 rounded w-28" />
        <div className="h-2.5 bg-slate-700/60 rounded w-44" />
      </div>
    </div>
    <div className="flex items-end justify-end gap-2.5 ml-auto max-w-[70%]">
      <div className="space-y-2 bg-indigo-900/40 border border-indigo-700/40 p-3.5 rounded-2xl rounded-br-sm w-60">
        <div className="h-3 bg-indigo-600/50 rounded w-40" />
        <div className="h-2.5 bg-indigo-700/40 rounded w-52" />
      </div>
    </div>
    <div className="flex items-start gap-2.5 max-w-[70%]">
      <div className="w-8 h-8 rounded-full bg-slate-700/50 shrink-0" />
      <div className="space-y-2 bg-slate-800/60 border border-slate-700/50 p-3.5 rounded-2xl rounded-tl-sm w-64">
        <div className="h-3 bg-slate-600/60 rounded w-36" />
        <div className="h-2.5 bg-slate-700/60 rounded w-56" />
      </div>
    </div>
  </div>
);

const BatchChat = () => {
  const { user, socket } = useAuth();
  const { selectedBatchId, selectedBatchName, batchesList } = useGlobalBatch();
  
  // Navigation & Data States
  const [batches, setBatches] = useState([]);
  const [customGroups, setCustomGroups] = useState([]);
  const [directContacts, setDirectContacts] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [unreadAnnouncementCount, setUnreadAnnouncementCount] = useState(0);

  // Active Tab: 'all' | 'direct' | 'groups' | 'announcements'
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Selected Active Chat: { id, type: 'direct'|'batch'|'group', name, avatar, role, isOnline, lastSeen, memberCount, members }
  const [activeChat, setActiveChat] = useState(null);
  const activeChatRef = useRef(activeChat);

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Chat Data & Typing
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSidebarLoading, setIsSidebarLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Attachment & Cropper States
  const [attachment, setAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isShareLinkModalOpen, setIsShareLinkModalOpen] = useState(false);
  const [linkFormData, setLinkFormData] = useState({ url: '', title: '' });

  // Code Snippet Sharing States
  const [isShareCodeModalOpen, setIsShareCodeModalOpen] = useState(false);
  const [codeLanguage, setCodeLanguage] = useState('javascript');
  const [codeTitle, setCodeTitle] = useState('');
  const [codeContent, setCodeContent] = useState('');

  // Student Friend System States
  const [friendsData, setFriendsData] = useState({
    friends: [],
    pendingIncoming: [],
    pendingOutgoing: [],
    discoverPeers: []
  });
  const [isFriendsModalOpen, setIsFriendsModalOpen] = useState(false);
  const [friendModalTab, setFriendModalTab] = useState('incoming'); // 'incoming' | 'discover'
  const [friendSearchRoll, setFriendSearchRoll] = useState('');
  const [isSendingFriendReq, setIsSendingFriendReq] = useState(false);

  // WhatsApp-style In-Chat Notification Toast for messages from other chats
  const [inChatToast, setInChatToast] = useState(null);
  const toastTimeoutRef = useRef(null);

  // Group Creation & Info Modals
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [groupDetails, setGroupDetails] = useState(null);
  const [groupFormData, setGroupFormData] = useState({
    name: '',
    description: '',
    memberIds: []
  });

  // Announcement Modal State (Admin / Mentor)
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [announcementFormData, setAnnouncementFormData] = useState({
    title: '',
    content: '',
    targetAudience: 'all',
    batchId: '',
    priority: 'normal'
  });

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const docInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = useCallback((smooth = true) => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }, 80);
  }, []);

  // ─── 1. Load Primary Chat Data (Optimized Parallel Requests) ───
  const loadChatData = useCallback(async () => {
    try {
      const batchParam = (selectedBatchId && selectedBatchId !== 'all') ? { params: { batchId: selectedBatchId } } : {};

      // Fetch batches, groups, contacts, announcements, and friends in parallel
      const batchesReq = (user.role === 'admin' || user.role === 'mentor')
        ? axios.get('/batches').then(res => Array.isArray(res.data) ? res.data : []).catch(() => [])
        : axios.get('/enrollments/my').then(res => {
            const approved = Array.isArray(res.data) ? res.data.filter(e => e.status === 'approved') : [];
            return approved.map(e => e.batchId).filter(Boolean);
          }).catch(() => []);

      const groupsReq = axios.get('/chat/groups', batchParam).then(res => Array.isArray(res.data) ? res.data : []).catch(() => []);
      const contactsReq = axios.get('/chat/contacts', batchParam).then(res => Array.isArray(res.data) ? res.data : []).catch(() => []);
      const announcementsReq = Promise.all([
        axios.get('/announcements').catch(() => ({ data: [] })),
        axios.get('/announcements/unread-count').catch(() => ({ data: { count: 0 } }))
      ]);
      const friendsReq = user.role === 'student'
        ? axios.get('/chat/friends-data').then(res => res.data || null).catch(() => null)
        : Promise.resolve(null);

      const [
        batchRes,
        groupsRes,
        contactsRes,
        annRes,
        friendsRes
      ] = await Promise.allSettled([
        batchesReq,
        groupsReq,
        contactsReq,
        announcementsReq,
        friendsReq
      ]);

      if (batchRes.status === 'fulfilled' && batchRes.value) {
        setBatches(batchRes.value);
      }
      if (groupsRes.status === 'fulfilled' && groupsRes.value) {
        setCustomGroups(groupsRes.value);
      }
      if (contactsRes.status === 'fulfilled' && contactsRes.value) {
        setDirectContacts(contactsRes.value);
      }
      if (annRes.status === 'fulfilled' && annRes.value) {
        const [annList, countRes] = annRes.value;
        setAnnouncements(Array.isArray(annList?.data) ? annList.data : []);
        setUnreadAnnouncementCount(countRes?.data?.count || 0);
      }
      if (friendsRes.status === 'fulfilled' && friendsRes.value) {
        setFriendsData(friendsRes.value);
      }
    } catch (error) {
      console.error('Error fetching chat data in parallel:', error);
    } finally {
      setLoading(false);
      setIsSidebarLoading(false);
    }
  }, [user.role, selectedBatchId]);

  const fetchFriendsData = useCallback(async () => {
    if (user.role !== 'student') return;
    try {
      const { data } = await axios.get('/chat/friends-data');
      setFriendsData(data || { friends: [], pendingIncoming: [], pendingOutgoing: [], discoverPeers: [] });
    } catch (err) {
      console.warn('Could not load friends data:', err.message);
    }
  }, [user.role]);

  const showToastNotification = useCallback((title, text, targetChat) => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setInChatToast({ title, text, targetChat });
    toastTimeoutRef.current = setTimeout(() => {
      setInChatToast(null);
    }, 4500);
  }, []);

  const handleSendFriendRequest = async (targetUserId, roll) => {
    setIsSendingFriendReq(true);
    try {
      const { data } = await axios.post('/chat/friend-request/send', {
        targetUserId,
        rollNumber: roll
      });
      Swal.fire({ icon: 'success', title: 'Request Sent!', text: data.message, timer: 3000, confirmButtonColor: '#6366f1' });
      soundManager.playSuccess();
      setFriendSearchRoll('');
      fetchFriendsData();
    } catch (err) {
      Swal.fire('Request Failed', err.response?.data?.message || 'Could not send request', 'error');
    } finally {
      setIsSendingFriendReq(false);
    }
  };

  const handleRespondFriendRequest = async (requestId, action) => {
    try {
      const { data } = await axios.post('/chat/friend-request/respond', {
        requestId,
        action
      });
      if (action === 'accept') {
        Swal.fire({ icon: 'success', title: 'Friends Now! 🎉', text: data.message, timer: 3500, confirmButtonColor: '#10b981' });
        soundManager.playSuccess();
        loadChatData();
      } else {
        Swal.fire({ icon: 'info', title: 'Declined', text: data.message, timer: 2500 });
      }
      fetchFriendsData();
    } catch (err) {
      Swal.fire('Action Failed', err.response?.data?.message || 'Failed to update request', 'error');
    }
  };

  const handleShareCoinsWithFriend = async (friendContact) => {
    const friendId = friendContact.id;
    const friendName = friendContact.name;

    const { value: amount } = await Swal.fire({
      title: `Gift Coins to ${friendName}`,
      text: 'Share your coins with your friend! (1-week cooldown applies)',
      input: 'number',
      inputLabel: 'Amount of Coins',
      inputPlaceholder: 'e.g. 50',
      showCancelButton: true,
      confirmButtonText: 'Send Gift 🎁',
      confirmButtonColor: '#f59e0b',
      background: document.documentElement.classList.contains('dark') ? '#0f172a' : '#ffffff',
      color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000',
      inputValidator: (val) => {
        if (!val || isNaN(val) || Number(val) <= 0) {
          return 'Please enter a valid positive number of coins.';
        }
      }
    });

    if (!amount) return;

    try {
      const { data } = await axios.post('/gamification/friends/share-coins', {
        friendId,
        amount: Number(amount)
      });
      Swal.fire({
        icon: 'success',
        title: 'Gift Sent! 🎁',
        text: data.message,
        confirmButtonColor: '#10b981'
      });
      soundManager.playSuccess();

      if (socket?.connected) {
        socket.emit('send-chat-message', {
          recipientId: friendId,
          text: `🎁 I just gifted you ${amount} Coins on SSMS 2.0! 🎉 Check your balance in the Gamification Hub.`
        });
      }
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Coin Transfer Failed',
        text: err.response?.data?.message || 'Could not transfer coins.',
        confirmButtonColor: '#ef4444'
      });
    }
  };

  useEffect(() => {
    loadChatData();
  }, [loadChatData, selectedBatchId]);

  const location = useLocation();
  const navigate = useNavigate();

  // If redirected with ?userId=..., open that direct chat
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const targetUserId = searchParams.get('userId');
    if (!targetUserId) return;

    const contact = directContacts.find(c => c._id?.toString() === targetUserId.toString());
    if (contact) {
      setActiveTab('direct');
      setActiveChat({
        id: contact._id,
        type: 'direct',
        name: contact.name,
        subheading: contact.role ? contact.role.toUpperCase() : 'STUDENT',
        avatar: contact.equippedAvatar || contact.profileImage || '/logo.png',
        role: contact.role ? contact.role.toUpperCase() : 'STUDENT',
        isOnline: contact.isOnline,
        lastSeen: contact.lastSeen
      });
    }
  }, [location.search, directContacts]);

  // Set initial default active chat if none selected
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('userId')) return; // Prioritize explicit userId in URL

    if (!activeChat && !loading) {
      // 1. Prioritize official classroom group of the selected/active batch
      const officialGroup = customGroups.find(g => 
        g.isBatchCommon && (
          !selectedBatchId || 
          selectedBatchId === 'all' || 
          (g.batchId?._id || g.batchId)?.toString() === selectedBatchId?.toString()
        )
      ) || customGroups.find(g => g.isBatchCommon);

      if (officialGroup) {
        setActiveChat({
          id: officialGroup._id,
          type: 'group',
          name: officialGroup.name,
          subheading: `${officialGroup.memberCount || 0} members • Official Classroom Group`,
          avatar: officialGroup.avatar,
          role: 'OFFICIAL GROUP',
          isBatchCommon: true
        });
      } else if (batches.length > 0) {
        const b = batches[0];
        setActiveChat({
          id: b._id,
          type: 'batch',
          name: b.batchName,
          subheading: b.panelName || 'Academic Batch Channel',
          avatar: null,
          role: 'BATCH CHANNEL'
        });
      } else if (customGroups.length > 0) {
        const g = customGroups[0];
        setActiveChat({
          id: g._id,
          type: 'group',
          name: g.name,
          subheading: `${g.memberCount || 0} members`,
          avatar: g.avatar,
          role: 'CHAT GROUP'
        });
      } else if (directContacts.length > 0) {
        const c = directContacts[0];
        setActiveChat({
          id: c._id,
          type: 'direct',
          name: c.name,
          subheading: c.role ? c.role.toUpperCase() : 'STUDENT',
          avatar: c.equippedAvatar || c.profileImage,
          role: c.role ? c.role.toUpperCase() : 'STUDENT',
          isOnline: c.isOnline,
          lastSeen: c.lastSeen
        });
      }
    }
  }, [batches, customGroups, directContacts, activeChat, loading, selectedBatchId, location.search]);

  // ─── 2. Real-Time Online Status & Group Events ───
  useEffect(() => {
    if (!socket) return;

    const handleOnlineStatus = (data) => {
      setDirectContacts(prev => prev.map(c => 
        c._id === data.userId 
          ? { ...c, isOnline: data.isOnline, lastSeen: data.isOnline ? c.lastSeen : (data.lastSeen || new Date().toISOString()) }
          : c
      ));

      setActiveChat(prev => {
        if (prev?.type === 'direct' && prev.id === data.userId) {
          return {
            ...prev,
            isOnline: data.isOnline,
            lastSeen: data.isOnline ? prev.lastSeen : (data.lastSeen || new Date().toISOString())
          };
        }
        return prev;
      });
    };

    const handleGroupCreated = (group) => {
      setCustomGroups(prev => [group, ...prev.filter(g => g._id !== group._id)]);
    };

    const handleGroupAdded = (group) => {
      setCustomGroups(prev => [group, ...prev.filter(g => g._id !== group._id)]);
    };

    const handleGroupRemoved = ({ groupId }) => {
      setCustomGroups(prev => prev.filter(g => g._id !== groupId));
      setActiveChat(prev => (prev?.id === groupId ? null : prev));
    };

    const handleAnnouncementBroadcast = (ann) => {
      setAnnouncements(prev => [ann, ...prev.filter(a => a._id !== ann._id)]);
      setUnreadAnnouncementCount(prev => prev + 1);
    };

    socket.on('user-online-status', handleOnlineStatus);
    socket.on('group-created', handleGroupCreated);
    socket.on('group-added', handleGroupAdded);
    socket.on('group-removed', handleGroupRemoved);
    socket.on('announcement-broadcast', handleAnnouncementBroadcast);

    return () => {
      socket.off('user-online-status', handleOnlineStatus);
      socket.off('group-created', handleGroupCreated);
      socket.off('group-added', handleGroupAdded);
      socket.off('group-removed', handleGroupRemoved);
      socket.off('announcement-broadcast', handleAnnouncementBroadcast);
    };
  }, [socket]);

  // ─── 3. Fetch History & Join Rooms on Active Chat Change or Reconnect ───
  const fetchChatHistory = useCallback(async (chat) => {
    if (!chat) return;
    setIsLoadingHistory(true);
    try {
      let endpoint = '';
      if (chat.type === 'batch') {
        endpoint = `/chat/batch/${chat.id}?limit=40`;
      } else if (chat.type === 'group') {
        endpoint = `/chat/groups/${chat.id}/messages?limit=40`;
      } else if (chat.type === 'direct') {
        endpoint = `/chat/direct/${chat.id}?limit=40`;
      }

      const { data } = await axios.get(endpoint);
      const list = Array.isArray(data) ? data : [];
      setMessages(list);
      setHasMoreMessages(list.length >= 40);
      scrollToBottom(false);

      // Instantly clear unread badge for this chat in local sidebar state
      if (chat.type === 'direct') {
        setDirectContacts(prev => prev.map(c => 
          ((c._id || c.id)?.toString() === chat.id?.toString()) ? { ...c, unreadCount: 0 } : c
        ));
      } else if (chat.type === 'group') {
        setCustomGroups(prev => prev.map(g => 
          (g._id?.toString() === chat.id?.toString()) ? { ...g, unreadCount: 0 } : g
        ));
      }
    } catch (err) {
      console.error('Failed to fetch chat history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [loadChatData, scrollToBottom]);

  const joinChatRoom = useCallback((chat) => {
    if (!socket || !chat) return;

    if (chat.type === 'batch') {
      socket.emit('join-batch-chat', chat.id);
    } else if (chat.type === 'group') {
      socket.emit('join-group-chat', chat.id);
    } else if (chat.type === 'direct') {
      socket.emit('join-direct-chat', chat.id);
    }
  }, [socket]);

  // Handle active chat selection change
  useEffect(() => {
    if (!activeChat) return;

    joinChatRoom(activeChat);
    fetchChatHistory(activeChat);

    return () => {
      if (!socket || !activeChat) return;
      if (activeChat.type === 'batch') {
        socket.emit('leave-batch-chat', activeChat.id);
      } else if (activeChat.type === 'group') {
        socket.emit('leave-group-chat', activeChat.id);
      } else if (activeChat.type === 'direct') {
        socket.emit('leave-direct-chat', activeChat.id);
      }
    };
  }, [activeChat, socket, joinChatRoom, fetchChatHistory]);

  // ─── Always Re-join Room on Socket Reconnect ───
  useEffect(() => {
    if (!socket) return;

    const handleConnect = () => {
      if (activeChatRef.current) {
        joinChatRoom(activeChatRef.current);
      }
    };

    socket.on('connect', handleConnect);
    return () => {
      socket.off('connect', handleConnect);
    };
  }, [socket, joinChatRoom]);

  // ─── 4. Real-Time Message Reception & WhatsApp Notifications ───
  useEffect(() => {
    if (!socket) return;

    const handleIncomingMessage = (msg) => {
      if (!msg) return;

      const currentChatId = activeChatRef.current?.id?.toString();
      const currentChatType = activeChatRef.current?.type;

      let isForCurrent = false;
      if (currentChatType === 'batch' && msg.batchId?.toString() === currentChatId) {
        isForCurrent = true;
      } else if (currentChatType === 'group' && msg.groupId?.toString() === currentChatId) {
        isForCurrent = true;
      } else if (currentChatType === 'direct') {
        const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
        const recipientIdStr = msg.recipientId?.toString();
        isForCurrent = (senderIdStr === currentChatId || recipientIdStr === currentChatId);
      }

      if (isForCurrent) {
        setMessages(prev => {
          // If optimistic message matching tempId or _id exists, replace it with confirmed real message
          const matchIdx = prev.findIndex(m => 
            (msg.tempId && m.tempId === msg.tempId) || 
            (msg.tempId && m._id === msg.tempId) || 
            m._id?.toString() === msg._id?.toString()
          );
          if (matchIdx !== -1) {
            const next = [...prev];
            next[matchIdx] = { ...msg, status: 'sent' };
            return next;
          }
          return [...prev, { ...msg, status: 'sent' }];
        });
        scrollToBottom(true);

        const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
        if (senderIdStr !== user._id.toString()) {
          soundManager.playWhatsAppIncoming();
        }

        // Mark as read immediately if current chat is open
        if (socket.connected) {
          socket.emit('mark-read', {
            batchId: currentChatType === 'batch' ? currentChatId : null,
            groupId: currentChatType === 'group' ? currentChatId : null,
            otherUserId: currentChatType === 'direct' ? currentChatId : null
          });
        }
      }

      // Update last message in local sidebar contact or group state instantly
      if (currentChatType === 'direct' && currentChatId) {
        setDirectContacts(prev => prev.map(c => {
          if ((c._id || c.id)?.toString() === currentChatId.toString()) {
            return {
              ...c,
              lastMessage: {
                text: msg.text,
                attachmentType: msg.attachmentType,
                createdAt: msg.createdAt || new Date().toISOString(),
                senderId: msg.senderId?._id || msg.senderId
              }
            };
          }
          return c;
        }));
      } else if (currentChatType === 'group' && currentChatId) {
        setCustomGroups(prev => prev.map(g => {
          if (g._id?.toString() === currentChatId.toString()) {
            return {
              ...g,
              lastMessage: {
                text: msg.text,
                attachmentType: msg.attachmentType,
                createdAt: msg.createdAt || new Date().toISOString(),
                senderId: { name: msg.senderId?.name }
              }
            };
          }
          return g;
        }));
      }
    };

    const handleDirectNotif = (data) => {
      if (!data) return;
      const senderIdStr = data.senderId?.toString();
      if (senderIdStr === user._id.toString()) return;

      const isCurrentOpen = activeChatRef.current?.type === 'direct' && activeChatRef.current?.id === senderIdStr;
      if (!isCurrentOpen) {
        soundManager.playWhatsAppIncoming();
        showToastNotification(
          `💬 ${data.senderName}`,
          data.text || 'Sent a message',
          {
            id: senderIdStr,
            type: 'direct',
            name: data.senderName,
            subheading: 'DIRECT CONTACT',
            avatar: data.senderAvatar,
            role: 'STUDENT'
          }
        );

        // Update local sidebar contact state with unread count and latest message preview
        setDirectContacts(prev => prev.map(c => {
          if ((c._id || c.id)?.toString() === senderIdStr) {
            return {
              ...c,
              unreadCount: (c.unreadCount || 0) + 1,
              lastMessage: {
                text: data.text,
                attachmentType: data.attachmentType,
                createdAt: new Date().toISOString(),
                senderId: senderIdStr
              }
            };
          }
          return c;
        }));
      }
    };

    const handleGroupNotif = (data) => {
      if (!data) return;
      if (data.senderId?.toString() === user._id.toString()) return;

      const gIdStr = data.groupId?.toString();
      const isCurrentOpen = activeChatRef.current?.type === 'group' && activeChatRef.current?.id === gIdStr;
      if (!isCurrentOpen) {
        soundManager.playWhatsAppIncoming();
        showToastNotification(
          `👥 ${data.groupName} • ${data.senderName}`,
          data.text || 'New group message',
          {
            id: data.groupId,
            type: 'group',
            name: data.groupName,
            subheading: 'CHAT GROUP',
            avatar: null,
            role: 'CHAT GROUP'
          }
        );

        // Update local sidebar group state with unread count and latest message preview
        setCustomGroups(prev => prev.map(g => {
          if (g._id?.toString() === gIdStr) {
            return {
              ...g,
              unreadCount: (g.unreadCount || 0) + 1,
              lastMessage: {
                text: data.text,
                attachmentType: data.attachmentType,
                createdAt: new Date().toISOString(),
                senderId: { name: data.senderName }
              }
            };
          }
          return g;
        }));
      }
    };

    const handleBatchNotif = (data) => {
      if (!data) return;
      if (data.senderId?.toString() === user._id.toString()) return;

      const isCurrentOpen = activeChatRef.current?.type === 'batch' && activeChatRef.current?.id === data.batchId?.toString();
      if (!isCurrentOpen) {
        soundManager.playWhatsAppIncoming();
        showToastNotification(
          `# ${data.batchName} • ${data.senderName}`,
          data.text || 'New batch message',
          {
            id: data.batchId,
            type: 'batch',
            name: data.batchName,
            subheading: 'Academic Batch Channel',
            avatar: null,
            role: 'BATCH CHANNEL'
          }
        );
      }
    };

    const handleFriendReqReceived = () => {
      fetchFriendsData();
    };

    const handleFriendReqAccepted = () => {
      fetchFriendsData();
      loadChatData();
    };

    const handleMessagesRead = (data) => {
      if (activeChatRef.current?.type === 'direct' && (data?.readBy?.toString() === activeChatRef.current.id?.toString() || data?.senderId?.toString() === user._id.toString())) {
        const readerId = (data.readBy || activeChatRef.current.id)?.toString();
        setMessages(prev => prev.map(m => {
          if ((m.senderId?._id || m.senderId)?.toString() === user._id.toString()) {
            const currentReadBy = Array.isArray(m.readBy) ? m.readBy : [];
            const currentDeliv = Array.isArray(m.deliveredTo) ? m.deliveredTo : [];
            return {
              ...m,
              readBy: [...new Set([...currentReadBy, readerId])],
              deliveredTo: [...new Set([...currentDeliv, readerId])]
            };
          }
          return m;
        }));
      }
    };

    const handleMessagesDelivered = (data) => {
      if (activeChatRef.current?.type === 'direct' && (data?.deliveredTo?.toString() === activeChatRef.current.id?.toString())) {
        const delivUser = data.deliveredTo.toString();
        setMessages(prev => prev.map(m => {
          if ((m.senderId?._id || m.senderId)?.toString() === user._id.toString()) {
            const currentDeliv = Array.isArray(m.deliveredTo) ? m.deliveredTo : [];
            return {
              ...m,
              deliveredTo: [...new Set([...currentDeliv, delivUser])]
            };
          }
          return m;
        }));
      }
    };

    const handleChatError = (err) => {
      console.warn('Chat socket error:', err);
      Swal.fire('Message Error', err?.message || 'Could not send chat message.', 'error');
    };

    const handleUserTyping = (data) => {
      if (!data) return;
      const currentChatId = activeChatRef.current?.id?.toString();
      const matches = (data.batchId && data.batchId?.toString() === currentChatId) ||
                      (data.groupId && data.groupId?.toString() === currentChatId) ||
                      (data.senderId && data.senderId?.toString() === currentChatId);

      if (matches && data.senderId?.toString() !== user._id.toString()) {
        setTypingUsers(prev => ({ ...prev, [data.senderId]: data.senderName }));
      }
    };

    const handleUserStopTyping = (data) => {
      if (!data) return;
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[data.senderId];
        return next;
      });
    };

    socket.on('chat-message-received', handleIncomingMessage);
    socket.on('new-direct-message-notification', handleDirectNotif);
    socket.on('new-group-message-notification', handleGroupNotif);
    socket.on('new-batch-message-notification', handleBatchNotif);
    socket.on('friend-request-received', handleFriendReqReceived);
    socket.on('friend-request-accepted', handleFriendReqAccepted);
    socket.on('messages-read', handleMessagesRead);
    socket.on('messages-delivered', handleMessagesDelivered);
    socket.on('chat-error', handleChatError);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleUserStopTyping);

    return () => {
      socket.off('chat-message-received', handleIncomingMessage);
      socket.off('new-direct-message-notification', handleDirectNotif);
      socket.off('new-group-message-notification', handleGroupNotif);
      socket.off('new-batch-message-notification', handleBatchNotif);
      socket.off('friend-request-received', handleFriendReqReceived);
      socket.off('friend-request-accepted', handleFriendReqAccepted);
      socket.off('messages-read', handleMessagesRead);
      socket.off('messages-delivered', handleMessagesDelivered);
      socket.off('chat-error', handleChatError);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleUserStopTyping);
    };
  }, [socket, user._id, scrollToBottom, loadChatData, showToastNotification, fetchFriendsData]);

  // ─── 5. Load Older Messages (Cursor Pagination with Scroll Anchoring) ───
  const loadOlderMessages = async () => {
    if (!activeChat || messages.length === 0 || isLoadingMore) return;
    setIsLoadingMore(true);

    const oldest = messages.find(m => !m._id?.toString().startsWith('temp_'));
    const beforeDate = oldest?.createdAt;
    if (!beforeDate) {
      setIsLoadingMore(false);
      return;
    }

    const container = messagesContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    try {
      let endpoint = '';
      if (activeChat.type === 'batch') {
        endpoint = `/chat/batch/${activeChat.id}?limit=40&before=${beforeDate}`;
      } else if (activeChat.type === 'group') {
        endpoint = `/chat/groups/${activeChat.id}/messages?limit=40&before=${beforeDate}`;
      } else if (activeChat.type === 'direct') {
        endpoint = `/chat/direct/${activeChat.id}?limit=40&before=${beforeDate}`;
      }

      const { data } = await axios.get(endpoint);
      const olderList = Array.isArray(data) ? data : [];

      if (olderList.length > 0) {
        setMessages(prev => {
          const existingIds = new Set(prev.map(m => m._id?.toString()));
          const newOlder = olderList.filter(m => !existingIds.has(m._id?.toString()));
          return [...newOlder, ...prev];
        });
        setHasMoreMessages(olderList.length >= 40);

        requestAnimationFrame(() => {
          if (container) {
            container.scrollTop = container.scrollHeight - prevScrollHeight + prevScrollTop;
          }
        });
      } else {
        setHasMoreMessages(false);
      }
    } catch (err) {
      console.error('Error loading older messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // ─── 6. Typing Indicator Dispatcher ───
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', {
        batchId: activeChat.type === 'batch' ? activeChat.id : null,
        groupId: activeChat.type === 'group' ? activeChat.id : null,
        recipientId: activeChat.type === 'direct' ? activeChat.id : null,
        senderName: user.name
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('stop-typing', {
        batchId: activeChat.type === 'batch' ? activeChat.id : null,
        groupId: activeChat.type === 'group' ? activeChat.id : null,
        recipientId: activeChat.type === 'direct' ? activeChat.id : null
      });
    }, 2000);
  };

  // ─── 7. File & Media Attachment Handlers (Photo, Document, Link) ───
  const handlePhotoSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
    } else {
      uploadFileAttachment(file, 'image');
    }
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleDocSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const docType = file.type.includes('pdf') ? 'pdf' : 'document';
    uploadFileAttachment(file, docType);
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const handleShareLinkSubmit = (e) => {
    e.preventDefault();
    if (!linkFormData.url.trim()) return;

    let formattedUrl = linkFormData.url.trim();
    if (!/^https?:\/\//i.test(formattedUrl)) {
      formattedUrl = 'https://' + formattedUrl;
    }

    setAttachment({
      url: formattedUrl,
      name: linkFormData.title?.trim() || formattedUrl,
      type: 'link'
    });
    setLinkFormData({ url: '', title: '' });
    setIsShareLinkModalOpen(false);
    setShowAttachMenu(false);
  };

  const handleCodeTextareaKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const val = codeContent;
      setCodeContent(val.substring(0, start) + '  ' + val.substring(end));
      setTimeout(() => {
        if (e.target) {
          e.target.selectionStart = e.target.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleShareCodeSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!codeContent.trim() || !activeChat || isSending) return;

    // Student confirmation check for group or batch chats
    if (user.role === 'student' && (activeChat.type === 'batch' || activeChat.type === 'group')) {
      const confirmResult = await Swal.fire({
        title: 'Share Code to Group?',
        text: `Are you sure you want to share this code snippet to "${activeChat.name}"? All members will be notified.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Share Code',
        cancelButtonText: 'Cancel'
      });
      if (!confirmResult.isConfirmed) return;
    }

    const titlePrefix = codeTitle.trim() ? `// ${codeTitle.trim()}\n` : '';
    const formattedCodeText = `\`\`\`${codeLanguage}\n${titlePrefix}${codeContent}\n\`\`\``;

    const payload = {
      batchId: activeChat.type === 'batch' ? activeChat.id : null,
      groupId: activeChat.type === 'group' ? activeChat.id : null,
      recipientId: activeChat.type === 'direct' ? activeChat.id : null,
      text: formattedCodeText,
      attachmentUrl: '',
      attachmentName: codeTitle.trim() || `${codeLanguage} snippet`,
      attachmentType: 'code'
    };

    setIsSending(true);
    setIsShareCodeModalOpen(false);
    setCodeContent('');
    setCodeTitle('');

    try {
      if (socket && socket.connected) {
        socket.emit('send-chat-message', payload);
      } else {
        const { data: savedMsg } = await axios.post('/chat/message', payload);
        setMessages(prev => {
          if (prev.some(m => m._id === savedMsg._id)) return prev;
          return [...prev, savedMsg];
        });
      }
      soundManager.playWhatsAppOutgoing();
      scrollToBottom(true);
    } catch (err) {
      console.error('Failed to send code snippet:', err);
      Swal.fire('Delivery Error', err.response?.data?.message || 'Failed to share code snippet.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  const uploadFileAttachment = async (file, explicitType = null) => {
    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.url;
      const fileType = explicitType || (file.type.includes('pdf') ? 'pdf' : (file.type.startsWith('image/') ? 'image' : 'document'));
      
      setAttachment({
        url: fileUrl,
        name: file.name,
        type: fileType
      });
    } catch (err) {
      console.error('Attachment upload error:', err);
      Swal.fire('Error', 'Failed to upload attachment.', 'error');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleCropComplete = async (croppedFile) => {
    setCropImageSrc(null);
    await uploadFileAttachment(croppedFile, 'image');
  };

  // ─── 8. Send Message (Socket with HTTP REST Fallback & Optimistic UI) ───
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !activeChat || isSending) return;

    // Student confirmation prompt before broadcasting to group/batch chat
    if (user.role === 'student' && (activeChat.type === 'batch' || activeChat.type === 'group')) {
      const confirmResult = await Swal.fire({
        title: 'Send to Group Chat?',
        text: `Are you sure you want to send this message to "${activeChat.name}"? All members will be notified.`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4f46e5',
        cancelButtonColor: '#64748b',
        confirmButtonText: 'Yes, Send Message',
        cancelButtonText: 'Cancel'
      });
      if (!confirmResult.isConfirmed) {
        return;
      }
    }

    setIsSending(true);
    const textContent = newMessage.trim();
    const currentAttachment = attachment;
    const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const payload = {
      batchId: activeChat.type === 'batch' ? activeChat.id : null,
      groupId: activeChat.type === 'group' ? activeChat.id : null,
      recipientId: activeChat.type === 'direct' ? activeChat.id : null,
      text: textContent,
      attachmentUrl: currentAttachment?.url || '',
      attachmentName: currentAttachment?.name || '',
      attachmentType: currentAttachment?.type || '',
      tempId
    };

    // Instant WhatsApp-style Optimistic Message Render
    const optimisticMsg = {
      _id: tempId,
      tempId,
      batchId: payload.batchId,
      groupId: payload.groupId,
      recipientId: payload.recipientId,
      text: textContent,
      attachmentUrl: currentAttachment?.url || '',
      attachmentName: currentAttachment?.name || '',
      attachmentType: currentAttachment?.type || '',
      isAnnouncement: false,
      deliveredTo: [],
      readBy: [user._id.toString()],
      createdAt: new Date().toISOString(),
      senderId: {
        _id: user._id,
        name: user.name,
        role: user.role,
        equippedAvatar: user.equippedAvatar || user.profileImage,
        profileImage: user.profileImage
      },
      status: 'sending'
    };

    // Clear input fields and render immediately
    setMessages(prev => [...prev, optimisticMsg]);
    soundManager.playWhatsAppOutgoing();
    scrollToBottom(true);

    setNewMessage('');
    setAttachment(null);
    setShowAttachMenu(false);

    // Stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    if (socket?.connected) {
      socket.emit('stop-typing', {
        batchId: payload.batchId,
        groupId: payload.groupId,
        recipientId: payload.recipientId
      });
    }

    try {
      if (socket && socket.connected) {
        socket.emit('send-chat-message', payload, (ack) => {
          if (ack?.success && ack.message) {
            setMessages(prev => prev.map(m => (m.tempId === tempId || m._id === tempId) ? { ...ack.message, status: 'sent' } : m));
          } else if (ack && !ack.success) {
            setMessages(prev => prev.map(m => (m.tempId === tempId || m._id === tempId) ? { ...m, status: 'failed' } : m));
          }
        });
      } else {
        const { data: savedMsg } = await axios.post('/chat/message', payload);
        setMessages(prev => prev.map(m => (m.tempId === tempId || m._id === tempId) ? { ...savedMsg, status: 'sent' } : m));
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      setMessages(prev => prev.map(m => (m.tempId === tempId || m._id === tempId) ? { ...m, status: 'failed' } : m));
      Swal.fire('Delivery Error', err.response?.data?.message || 'Failed to send message. Please check connection.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Support Enter to send and Shift+Enter for multiline
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ─── 9. Custom Group Creation & Member Management ───
  const handleOpenCreateGroup = () => {
    setGroupFormData({
      name: '',
      description: '',
      memberIds: []
    });
    setIsGroupModalOpen(true);
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupFormData.name.trim()) {
      return Swal.fire('Error', 'Please enter a group name', 'warning');
    }

    try {
      const { data } = await axios.post('/chat/groups', groupFormData);
      Swal.fire('Group Created!', `Chat group "${data.name}" has been created.`, 'success');
      setIsGroupModalOpen(false);
      await loadChatData();
      setActiveChat({
        id: data._id,
        type: 'group',
        name: data.name,
        subheading: `${data.members?.length || 1} members`,
        avatar: data.avatar || '',
        role: 'CHAT GROUP'
      });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to create group', 'error');
    }
  };

  const handleOpenGroupInfo = async () => {
    if (activeChat?.type !== 'group') return;
    try {
      const { data } = await axios.get(`/chat/groups/${activeChat.id}`);
      setGroupDetails(data);
      setIsGroupInfoOpen(true);
    } catch (err) {
      Swal.fire('Error', 'Could not load group details', 'error');
    }
  };

  const handleLeaveGroup = async () => {
    if (activeChat?.isBatchCommon || groupDetails?.isBatchCommon) {
      return Swal.fire('Protected Group', 'You cannot leave an official batch classroom group.', 'info');
    }

    const result = await Swal.fire({
      title: 'Leave Group?',
      text: `Are you sure you want to leave "${activeChat?.name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Leave'
    });

    if (result.isConfirmed) {
      try {
        await axios.post(`/chat/groups/${activeChat.id}/leave`);
        Swal.fire('Left Group', 'You have left the group.', 'success');
        setIsGroupInfoOpen(false);
        setActiveChat(null);
        await loadChatData();
      } catch (err) {
        Swal.fire('Error', err.response?.data?.message || 'Failed to leave group', 'error');
      }
    }
  };

  // ─── 10. Announcement Handlers ───
  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!announcementFormData.title.trim() || !announcementFormData.content.trim()) {
      return Swal.fire('Error', 'Title and content are required', 'warning');
    }

    try {
      await axios.post('/announcements', announcementFormData);
      Swal.fire('Published!', 'Announcement broadcast has been published.', 'success');
      setIsAnnouncementModalOpen(false);
      setAnnouncementFormData({
        title: '',
        content: '',
        targetAudience: 'all',
        batchId: '',
        priority: 'normal'
      });
      await loadChatData();
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to publish announcement', 'error');
    }
  };

  const handleMarkAnnouncementRead = async (announcementId) => {
    try {
      await axios.post(`/announcements/${announcementId}/read`);
      setAnnouncements(prev => prev.map(a => a._id === announcementId ? { ...a, isRead: true } : a));
      setUnreadAnnouncementCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking announcement as read:', err);
    }
  };

  const handleDeleteAnnouncement = async (announcementId) => {
    const res = await Swal.fire({
      title: 'Delete Announcement?',
      text: 'This will remove the announcement for all users.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, Delete'
    });

    if (res.isConfirmed) {
      try {
        await axios.delete(`/announcements/${announcementId}`);
        setAnnouncements(prev => prev.filter(a => a._id !== announcementId));
        Swal.fire('Deleted', 'Announcement removed.', 'success');
      } catch (err) {
        Swal.fire('Error', 'Failed to delete announcement', 'error');
      }
    }
  };

  // ─── Time & Date Helpers ───
  const formatTime12h = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatLastSeen = (dateStr) => {
    if (!dateStr) return 'recently';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'recently';
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDay.getTime() === today.getTime()) return `today at ${formatTime12h(d)}`;
    if (msgDay.getTime() === yesterday.getTime()) return `yesterday at ${formatTime12h(d)}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${formatTime12h(d)}`;
  };

  const formatSidebarTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDay.getTime() === today.getTime()) return formatTime12h(d);
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const getDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDay.getTime() === today.getTime()) return 'Today';
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const shouldShowDateSeparator = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const curr = new Date(currentMsg.createdAt);
    const prev = new Date(prevMsg.createdAt);
    return curr.toDateString() !== prev.toDateString();
  };

  // ─── Filter Items by Search Query (Debounced) ───
  const q = (debouncedSearch || searchQuery).toLowerCase().trim();

  const filteredBatches = batches.filter(b =>
    !q || b.batchName.toLowerCase().includes(q) || (b.panelName && b.panelName.toLowerCase().includes(q))
  );

  const filteredCustomGroups = customGroups.filter(g =>
    !q || g.name.toLowerCase().includes(q) || (g.description && g.description.toLowerCase().includes(q))
  );

  const officialBatchGroups = filteredCustomGroups.filter(g => g.isBatchCommon);
  const customOnlyGroups = filteredCustomGroups.filter(g => !g.isBatchCommon);

  const commonGroupBatchIds = new Set(
    officialBatchGroups.map(g => (g.batchId?._id || g.batchId)?.toString()).filter(Boolean)
  );
  const filteredBatchesDisplay = filteredBatches.filter(b => !commonGroupBatchIds.has(b._id.toString()));

  const filteredContacts = directContacts.filter(c =>
    !q || c.name.toLowerCase().includes(q) || c.role.toLowerCase().includes(q) || (c.email && c.email.toLowerCase().includes(q))
  );

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    if (a.unreadCount > 0 && !b.unreadCount) return -1;
    if (!a.unreadCount && b.unreadCount > 0) return 1;
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const filteredAnnouncements = announcements.filter(a =>
    !q || a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q) || (a.authorId?.name && a.authorId.name.toLowerCase().includes(q))
  );

  return (
    <div className="w-full h-full max-w-7xl mx-auto flex flex-col md:flex-row bg-white dark:bg-slate-950 rounded-none sm:rounded-2xl md:rounded-3xl border border-slate-200/80 dark:border-slate-800/80 shadow-xl shadow-slate-200/40 dark:shadow-2xl overflow-hidden text-left min-h-0 transition-colors">
      
      {/* ================= LEFT SIDEBAR (CONVERSATIONS LIST) ================= */}
      <div className={`w-full md:w-80 lg:w-[340px] bg-slate-50/80 dark:bg-slate-900/90 backdrop-blur-md border-r border-slate-200/80 dark:border-slate-800/80 flex flex-col min-h-0 ${activeChat && activeTab !== 'announcements' ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="p-3.5 sm:p-4 bg-white/90 dark:bg-slate-950/90 border-b border-slate-200/80 dark:border-slate-800/80 space-y-3 shrink-0">
          <div className="flex justify-between items-center">
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                <MessageSquare size={16} />
              </div>
              <span>SSMS 2.0 Chat</span>
            </h2>
            <div className="flex items-center gap-1.5">
              {(user.role === 'admin' || user.role === 'mentor') && (
                <button
                  onClick={() => setIsAnnouncementModalOpen(true)}
                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm transition-all hover:scale-105 cursor-pointer"
                  title="Broadcast Official Announcement"
                >
                  <Megaphone size={12} /> Broadcast
                </button>
              )}
              <button
                onClick={handleOpenCreateGroup}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black flex items-center gap-1 shadow-sm transition-all hover:scale-105 cursor-pointer"
                title="Create Custom Group"
              >
                <Plus size={12} /> Group
              </button>
            </div>
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={14} />
            <input 
              type="text"
              placeholder="Search chat, contacts, announcements..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100/90 dark:bg-slate-900 text-xs text-slate-900 dark:text-white pl-8.5 pr-8 py-2 rounded-xl border border-slate-200/90 dark:border-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-950 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X size={13} />
              </button>
            )}
          </div>

          {/* Active Batch Scope Pill */}
          {selectedBatchName && (
            <div className="flex items-center justify-between px-2.5 py-1.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 dark:from-indigo-950/40 dark:to-slate-900/40 rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 text-[11px] shadow-2xs">
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
                <span className="font-semibold text-slate-700 dark:text-slate-300 truncate">
                  Scope: <strong className="text-indigo-600 dark:text-indigo-400 font-extrabold">{selectedBatchName}</strong>
                </span>
              </div>
              <span className="text-[10px] font-black text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-900 px-2 py-0.5 rounded-lg border border-indigo-200/60 dark:border-indigo-800/60 shrink-0">
                {sortedContacts.length} contacts
              </span>
            </div>
          )}

          {/* Filter Tabs (Segmented Controller) */}
          <div className="flex gap-1 bg-slate-200/60 dark:bg-slate-950/70 p-1 rounded-xl border border-slate-200/70 dark:border-slate-800/80 text-[11px] font-bold">
            <button 
              onClick={() => setActiveTab('all')} 
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${activeTab === 'all' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveTab('direct')} 
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${activeTab === 'direct' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Direct
            </button>
            <button 
              onClick={() => setActiveTab('groups')} 
              className={`flex-1 py-1 rounded-lg transition-all cursor-pointer ${activeTab === 'groups' ? 'bg-white dark:bg-indigo-600 text-indigo-600 dark:text-white shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Groups
            </button>
            <button 
              onClick={() => setActiveTab('announcements')} 
              className={`flex-1 py-1 rounded-lg transition-all relative cursor-pointer ${activeTab === 'announcements' ? 'bg-amber-500 dark:bg-amber-600 text-white shadow-xs font-black' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
            >
              Announce
              {unreadAnnouncementCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center animate-pulse">
                  {unreadAnnouncementCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 min-h-0 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800/40 custom-scrollbar">
          
          {isSidebarLoading && directContacts.length === 0 && customGroups.length === 0 && batches.length === 0 ? (
            <ChatSidebarSkeleton />
          ) : null}

          {/* ─── GROUPS (BATCHES & CUSTOM GROUPS) ─── */}
          {(activeTab === 'all' || activeTab === 'groups') && (
            <div>
              {/* Official Academic Common Groups */}
              {officialBatchGroups.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-emerald-50/70 dark:bg-emerald-950/40 text-[10px] font-black uppercase text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center justify-between border-y border-emerald-100 dark:border-emerald-900/40">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck size={12} className="text-emerald-500" />
                      Official Batch Classrooms ({officialBatchGroups.length})
                    </span>
                    <span className="text-[9px] text-emerald-600/80 dark:text-emerald-400/80 font-bold lowercase">all members</span>
                  </div>
                  {officialBatchGroups.map(g => {
                    const isSelected = activeChat?.type === 'group' && activeChat?.id === g._id;
                    return (
                      <div
                        key={g._id}
                        onClick={() => {
                          setActiveChat({
                            id: g._id,
                            type: 'group',
                            name: g.name,
                            subheading: `${g.memberCount || 0} members • Official Classroom Group`,
                            avatar: g.avatar,
                            role: 'OFFICIAL GROUP',
                            isBatchCommon: true
                          });
                        }}
                        className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-emerald-50/90 dark:bg-emerald-950/40 border-l-4 border-emerald-600 shadow-xs' 
                            : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-600/20 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-black text-base shrink-0 overflow-hidden">
                          {g.avatar ? <img src={g.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <ShieldCheck size={20} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{g.name}</h4>
                            <div className="flex items-center gap-1">
                              {g.unreadCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-emerald-600 text-[9px] font-black text-white flex items-center justify-center">
                                  {g.unreadCount}
                                </span>
                              )}
                              <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 font-extrabold px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 uppercase tracking-tight">
                                Official
                              </span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium flex items-center gap-1">
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">• {g.memberCount || 0} members</span>
                            <span className="truncate">{g.lastMessage?.text || g.description || 'Official batch classroom group'}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Custom Groups (Study Groups, Teams) */}
              {customOnlyGroups.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-950/60 text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center justify-between">
                    <span>Chat Groups ({customOnlyGroups.length})</span>
                    <span className="text-[9px] text-slate-500 lowercase">custom</span>
                  </div>
                  {customOnlyGroups.map(g => {
                    const isSelected = activeChat?.type === 'group' && activeChat?.id === g._id;
                    return (
                      <div
                        key={g._id}
                        onClick={() => {
                          setActiveChat({
                            id: g._id,
                            type: 'group',
                            name: g.name,
                            subheading: `${g.memberCount || 0} members`,
                            avatar: g.avatar,
                            role: 'CHAT GROUP',
                            isBatchCommon: false
                          });
                        }}
                        className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-purple-50/90 dark:bg-purple-950/40 border-l-4 border-purple-600 shadow-xs' 
                            : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-purple-500/10 dark:bg-purple-600/20 border border-purple-500/20 dark:border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center font-black text-base shrink-0 overflow-hidden">
                          {g.avatar ? <img src={g.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <Users size={18} />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{g.name}</h4>
                            <div className="flex items-center gap-1">
                              {g.unreadCount > 0 && (
                                <span className="w-4 h-4 rounded-full bg-purple-600 text-[9px] font-black text-white flex items-center justify-center">
                                  {g.unreadCount}
                                </span>
                              )}
                              <span className="text-[9px] text-purple-700 dark:text-purple-300 font-bold uppercase">{g.memberCount || 1}m</span>
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                            {g.lastMessage?.text || g.description || 'Open group chat'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Academic Batch Channels (Fallback for any batch without ChatGroup) */}
              {filteredBatchesDisplay.length > 0 && (
                <div>
                  <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-950/60 text-[10px] font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center justify-between">
                    <span>Batch Channels ({filteredBatchesDisplay.length})</span>
                    <span className="text-[9px] text-slate-500 lowercase">channel</span>
                  </div>
                  {filteredBatchesDisplay.map(b => {
                    const isSelected = activeChat?.type === 'batch' && activeChat?.id === b._id;
                    return (
                      <div
                        key={b._id}
                        onClick={() => {
                          setActiveChat({
                            id: b._id,
                            type: 'batch',
                            name: b.batchName,
                            subheading: b.panelName || 'Academic Batch Channel',
                            avatar: null,
                            role: 'BATCH CHANNEL'
                          });
                        }}
                        className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-l-4 border-indigo-600 shadow-xs' 
                            : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 dark:bg-indigo-600/20 border border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-base shrink-0">
                          <Hash size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-baseline">
                            <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">{b.batchName}</h4>
                            <span className="text-[9px] text-indigo-700 dark:text-indigo-300 font-extrabold uppercase bg-indigo-100 dark:bg-indigo-950/70 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800/50">
                              Batch
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 font-medium">
                            {b.panelName ? `${b.panelName} • Academic Channel` : 'Click to open batch channel'}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── DIRECT CONTACTS (PRIVATE ONE-TO-ONE CHATS) ─── */}
          {(activeTab === 'all' || activeTab === 'direct') && (
            <div>
              <div className="px-4 py-2 bg-slate-100/70 dark:bg-slate-950/60 text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center justify-between">
                <span>Direct Contacts ({sortedContacts.length})</span>
                {user.role === 'student' && (
                  <button
                    onClick={() => navigate('/student/connections')}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 font-black text-[9px] cursor-pointer transition-colors border border-emerald-500/30"
                    title="Centralised Friend Connections"
                  >
                    <UserPlus size={11} />
                    <span>Connections Hub</span>
                    {friendsData.incoming?.length > 0 && (
                      <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[8px] flex items-center justify-center font-black animate-pulse">
                        {friendsData.incoming.length}
                      </span>
                    )}
                  </button>
                )}
              </div>

              {sortedContacts.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-400 space-y-3">
                  <UserPlus size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="font-semibold text-slate-600 dark:text-slate-300">No direct contacts yet</p>
                  {user.role === 'student' ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-slate-400">
                        In SSMS 2.0, students can private chat and gift coins with accepted friends. Mentors and Admins are always available.
                      </p>
                      <button
                        onClick={() => navigate('/student/connections')}
                        className="px-3.5 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-xl hover:bg-emerald-500 cursor-pointer shadow-xs transition-all"
                      >
                        + Connect with Classmates
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
              {sortedContacts.map(c => {
                const isSelected = activeChat?.type === 'direct' && activeChat?.id === c._id;
                const avatar = c.equippedAvatar || c.profileImage;
                const resolvedAvatar = (!avatar || avatar === 'default.jpg' || avatar.includes('dicebear') || avatar.includes('bottts'))
                  ? '/logo.png'
                  : (avatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${avatar}` : avatar);

                return (
                  <div
                    key={c._id}
                    onClick={() => {
                      setActiveChat({
                        id: c._id,
                        type: 'direct',
                        name: c.name,
                        subheading: c.role.toUpperCase(),
                        avatar: resolvedAvatar,
                        role: c.role.toUpperCase(),
                        isOnline: c.isOnline,
                        lastSeen: c.lastSeen
                      });
                    }}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-indigo-50/90 dark:bg-indigo-950/40 border-l-4 border-indigo-600 shadow-xs' 
                        : 'hover:bg-slate-100/80 dark:hover:bg-slate-800/60'
                    }`}
                  >
                    <div className="relative shrink-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center overflow-hidden">
                        <img src={resolvedAvatar} alt={c.name} className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.png'; }} />
                      </div>
                      {c.isOnline ? (
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" title="Online Now" />
                      ) : null}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline gap-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">{c.name}</h4>
                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded-md border shrink-0 ${
                            c.role === 'admin' 
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-800/50' 
                              : c.role === 'mentor' 
                              ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-800/50' 
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800/50'
                          }`}>
                            {c.role}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {c.lastMessage?.createdAt && (
                            <span className={`text-[9px] font-medium ${c.unreadCount > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-slate-400 dark:text-slate-500'}`}>
                              {formatSidebarTime(c.lastMessage.createdAt)}
                            </span>
                          )}
                          {c.unreadCount > 0 && (
                            <span className="w-4 h-4 rounded-full bg-emerald-500 text-[9px] font-black text-black flex items-center justify-center">
                              {c.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>

                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-1 font-medium">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.isOnline ? 'bg-emerald-500' : 'bg-slate-400 dark:bg-slate-600'}`} />
                        {c.isOnline ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold">Online</span>
                        ) : (
                          <span className="truncate">last seen {formatLastSeen(c.lastSeen || c.updatedAt)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── ANNOUNCEMENTS TAB LIST ─── */}
          {activeTab === 'announcements' && (
            <div className="p-3 space-y-2">
              <div className="px-1 py-1 text-[10px] font-black uppercase text-amber-600 dark:text-amber-400 tracking-wider flex items-center justify-between">
                <span>All Announcements ({filteredAnnouncements.length})</span>
                {unreadAnnouncementCount > 0 && (
                  <span className="text-[10px] text-red-500 font-bold">{unreadAnnouncementCount} unread</span>
                )}
              </div>
              {filteredAnnouncements.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">
                  No announcements found matching query.
                </div>
              ) : (
                filteredAnnouncements.map(a => (
                  <div
                    key={a._id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      !a.isRead 
                        ? 'bg-amber-50/80 dark:bg-amber-950/25 border-amber-300 dark:border-amber-500/40 shadow-xs' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                          a.priority === 'urgent' ? 'bg-red-500 text-white' :
                          a.priority === 'important' ? 'bg-amber-500 text-black' :
                          'bg-indigo-600 text-white'
                        }`}>
                          {a.priority}
                        </span>
                        {!a.isRead && (
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Unread" />
                        )}
                      </div>
                      <span className="text-[9px] text-slate-400 font-mono">
                        {formatSidebarTime(a.createdAt)}
                      </span>
                    </div>

                    <h4 className="text-xs font-black text-slate-900 dark:text-white mt-2">{a.title}</h4>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-3 leading-relaxed">{a.content}</p>

                    <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[10px]">
                      <span className="text-slate-500 dark:text-slate-400">By <strong className="text-slate-800 dark:text-slate-200">{a.authorId?.name || 'Admin'}</strong></span>
                      <div className="flex items-center gap-2">
                        {!a.isRead && (
                          <button
                            onClick={() => handleMarkAnnouncementRead(a._id)}
                            className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/30 font-bold transition-colors cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                        {(user.role === 'admin' || a.authorId?._id === user._id) && (
                          <button
                            onClick={() => handleDeleteAnnouncement(a._id)}
                            className="text-red-500 hover:text-red-600 p-0.5 cursor-pointer"
                            title="Delete Announcement"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

        </div>
      </div>

      {/* ================= MAIN CHAT WINDOW ================= */}
      <div className={`flex-1 min-h-0 bg-white dark:bg-slate-950 flex flex-col ${!activeChat && activeTab !== 'announcements' ? 'hidden md:flex' : 'flex'}`}>
        
        {activeChat ? (
          <>
            {/* Main Chat Header */}
            <div className="px-4 sm:px-6 py-3 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between shadow-xs shrink-0">
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setActiveChat(null)} 
                  className="md:hidden text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center shrink-0"
                  title="Back to Conversations"
                >
                  <ArrowLeft size={20} />
                </button>

                <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-2xl border flex items-center justify-center font-bold overflow-hidden shrink-0 ${
                  activeChat.isBatchCommon 
                    ? 'bg-emerald-500/10 dark:bg-emerald-600/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : 'bg-indigo-500/10 dark:bg-indigo-600/20 border-indigo-500/20 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-400'
                }`}>
                  {activeChat.avatar ? (
                    <img 
                      src={activeChat.avatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${activeChat.avatar}` : activeChat.avatar} 
                      alt="Avatar" 
                      className="w-full h-full object-cover" 
                      onError={(e) => { e.target.src = '/logo.png'; }}
                    />
                  ) : activeChat.isBatchCommon ? (
                    <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                  ) : activeChat.type === 'batch' ? (
                    <Hash size={18} className="text-indigo-600 dark:text-indigo-400" />
                  ) : activeChat.type === 'group' ? (
                    <Users size={18} className="text-purple-600 dark:text-purple-400" />
                  ) : (
                    <User size={18} className="text-emerald-600 dark:text-emerald-400" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white flex items-center gap-1.5 truncate">
                    <span className="truncate">{activeChat.name}</span>
                    <span className={`text-[8px] sm:text-[9px] uppercase font-black px-2 py-0.5 rounded-full border shrink-0 ${
                      activeChat.isBatchCommon
                        ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                        : 'bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border-slate-200 dark:border-slate-700'
                    }`}>
                      {activeChat.isBatchCommon ? 'Official Group' : activeChat.role}
                    </span>
                  </h3>
                  <p className="text-[10px] sm:text-[11px] font-semibold flex items-center gap-1">
                    {Object.keys(typingUsers).length > 0 ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 truncate">
                        <Circle size={7} className="fill-emerald-500 text-emerald-500 animate-pulse shrink-0" />
                        {`${Object.values(typingUsers).join(', ')} is typing...`}
                      </span>
                    ) : activeChat.isBatchCommon ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1 truncate">
                        <Circle size={7} className="fill-emerald-500 text-emerald-500 shrink-0" /> {activeChat.subheading || 'Official Classroom Group'}
                      </span>
                    ) : activeChat.type === 'batch' ? (
                      <span className="text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 truncate">
                        <Circle size={7} className="fill-indigo-500 text-indigo-500 shrink-0" /> Academic Batch Channel
                      </span>
                    ) : activeChat.type === 'group' ? (
                      <span className="text-purple-600 dark:text-purple-400 font-medium flex items-center gap-1 truncate">
                        <Circle size={7} className="fill-purple-500 text-purple-500 shrink-0" /> {activeChat.subheading || 'Chat Group'}
                      </span>
                    ) : activeChat.isOnline ? (
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 shrink-0">
                        <Circle size={7} className="fill-emerald-500 text-emerald-500 animate-pulse shrink-0" /> Online
                      </span>
                    ) : activeChat.lastSeen ? (
                      <span className="text-slate-400 font-medium flex items-center gap-1 truncate">
                        <Circle size={7} className="fill-slate-400 text-slate-400 shrink-0" /> last seen {formatLastSeen(activeChat.lastSeen)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium truncate">Offline</span>
                    )}
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {user.role === 'student' && activeChat.type === 'direct' && (activeChat.role === 'STUDENT' || activeChat.subheading === 'STUDENT') && (
                  <button 
                    onClick={() => handleShareCoinsWithFriend(activeChat)}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-300 dark:border-amber-700 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                    title="Send Coins to Friend"
                  >
                    <Gift size={15} className="text-amber-500" />
                    <span className="hidden sm:inline font-extrabold">Gift Coins</span>
                  </button>
                )}
                {activeChat.type === 'group' && (
                  <button 
                    onClick={handleOpenGroupInfo}
                    className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800/50 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                    title="Group Details & Members"
                  >
                    <Info size={16} /> <span className="hidden sm:inline">Info</span>
                  </button>
                )}
                {announcements.length > 0 && (
                  <button 
                    onClick={() => setActiveTab('announcements')}
                    className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl text-[10px] sm:text-xs font-bold flex items-center gap-1 sm:gap-1.5 transition-all border bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/50 hover:bg-amber-100 cursor-pointer"
                  >
                    <Megaphone size={14} /> Announcements ({announcements.length})
                  </button>
                )}
              </div>
            </div>

            {/* WhatsApp In-App Floating Toast Notification */}
            {inChatToast && (
              <div 
                onClick={inChatToast.onClick}
                className="mx-3 my-2 sm:mx-6 p-2.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-2xl border border-indigo-200 dark:border-indigo-800 shadow-xl flex items-center justify-between gap-3 cursor-pointer animate-slideDown hover:border-indigo-400 transition-all z-20 shrink-0"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <MessageSquare size={16} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">{inChatToast.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{inChatToast.message}</p>
                  </div>
                </div>
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded-lg shrink-0">
                  Open
                </span>
              </div>
            )}

            {/* Pinned Broadcast Banner (Latest Urgent/Important Announcement) */}
            {announcements.length > 0 && announcements[0]?.priority !== 'normal' && (
              <div className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-950/60 dark:via-amber-900/30 dark:to-slate-900 px-4 sm:px-6 py-2.5 border-b border-amber-300/60 dark:border-amber-500/20 flex items-center justify-between text-xs text-amber-900 dark:text-amber-200 shrink-0">
                <div className="flex items-center gap-2 truncate">
                  <Megaphone size={14} className="text-amber-600 dark:text-amber-400 animate-bounce shrink-0" />
                  <span className="font-extrabold text-amber-700 dark:text-amber-400 uppercase text-[9px] shrink-0">Latest Broadcast:</span>
                  <span className="truncate font-medium text-[11px] text-slate-800 dark:text-slate-200">{announcements[0].title} — {announcements[0].content}</span>
                </div>
                <button 
                  onClick={() => setActiveTab('announcements')} 
                  className="text-[9px] font-black uppercase text-amber-700 dark:text-amber-400 hover:underline shrink-0 ml-2 cursor-pointer"
                >
                  View All
                </button>
              </div>
            )}

            {/* Message Feed Screen Area (Frozen Wallpaper Viewport) */}
            <div className="flex-1 min-h-0 relative overflow-hidden bg-slate-950 dark:bg-black">
              {/* Frozen Wallpaper Background: FAIL, BUT NEVER QUIT! (Static/Fixed in place) */}
              <div 
                className="absolute inset-0 pointer-events-none bg-contain sm:bg-cover bg-center bg-no-repeat opacity-[0.18] dark:opacity-[0.22] transition-opacity select-none"
                style={{
                  backgroundImage: `url('/chat-bg.jpg')`
                }}
              />
              {/* Soft dark vignette overlay to ensure messages remain 100% readable and foregrounded */}
              <div className="absolute inset-0 pointer-events-none bg-radial from-transparent via-slate-950/30 to-slate-950/80 dark:via-black/40 dark:to-black/85" />

              {/* Scrollable Message Feed */}
              <div 
                ref={messagesContainerRef}
                onScroll={(e) => {
                  if (e.currentTarget.scrollTop <= 30 && hasMoreMessages && !isLoadingMore && !isLoadingHistory) {
                    loadOlderMessages();
                  }
                }}
                className="relative z-10 w-full h-full overflow-y-auto p-3 sm:p-6 space-y-4 custom-scrollbar touch-pan-y"
              >

              {/* Load Older Messages Button */}
              {hasMoreMessages && (
                <div className="text-center relative py-1">
                  <button
                    onClick={loadOlderMessages}
                    disabled={isLoadingMore}
                    className="px-3.5 py-1 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-full text-[10px] font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    {isLoadingMore ? 'Loading older messages...' : '↑ Load older messages'}
                  </button>
                </div>
              )}

              {isLoadingHistory ? (
                <ChatMessageSkeleton />
              ) : messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <MessageSquare size={36} className="text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-semibold">No messages yet. Send a message to start conversation!</p>
                </div>
              ) : (
                messages.map((msg, idx, arr) => {
                  const senderIdStr = (msg.senderId?._id || msg.senderId)?.toString();
                  const isMe = senderIdStr === user._id.toString();
                  const senderAvatar = msg.senderId?.equippedAvatar || msg.senderId?.profileImage;
                  const resolvedSenderAvatar = (!senderAvatar || senderAvatar === 'default.jpg' || senderAvatar.includes('dicebear') || senderAvatar.includes('bottts'))
                    ? '/logo.png'
                    : (senderAvatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${senderAvatar}` : senderAvatar);
                  const prevMsg = idx > 0 ? arr[idx - 1] : null;
                  const showDateSep = shouldShowDateSeparator(msg, prevMsg);

                  return (
                    <div key={msg._id || idx}>
                      {/* ─── Day Separator ─── */}
                      {showDateSep && (
                        <div className="flex items-center justify-center my-3 relative">
                          <div className="bg-white/90 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase tracking-wider px-3.5 py-1 rounded-full shadow-xs border border-slate-200 dark:border-slate-700/60">
                            {getDateLabel(msg.createdAt)}
                          </div>
                        </div>
                      )}

                      {/* Official Announcement Card in Chat (Clean layout without overlapping) */}
                      {msg.isAnnouncement ? (
                        <div className="w-full flex justify-center my-3 relative">
                          <div className="bg-amber-50/90 dark:bg-amber-950/35 border border-amber-300/80 dark:border-amber-500/40 rounded-2xl p-4 max-w-xl w-full shadow-md text-left space-y-2.5">
                            <div className="flex items-start justify-between gap-3 pb-2 border-b border-amber-200/80 dark:border-amber-500/20">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                                  <Megaphone size={14} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="text-[9px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400 block">
                                    Official Broadcast
                                  </span>
                                  <h4 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                    {msg.announcementTitle || 'Announcement'}
                                  </h4>
                                </div>
                              </div>
                              <span className="text-[10px] text-slate-500 dark:text-amber-300/80 font-mono shrink-0 bg-amber-100/80 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/40">
                                {formatTime12h(msg.createdAt)}
                              </span>
                            </div>

                            <div className="text-slate-800 dark:text-amber-100">
                              <FormattedMessageText text={msg.text} isMe={false} />
                            </div>

                            <div className="pt-2 border-t border-amber-200/80 dark:border-amber-500/20 flex items-center justify-between text-[10px]">
                              <span className="text-slate-600 dark:text-slate-400">
                                Posted by: <strong className="text-slate-900 dark:text-white">{msg.senderId?.name || 'Administrator'}</strong>
                              </span>
                              <span className="text-[9px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/50">
                                {msg.senderId?.role || 'ADMIN'}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Normal Direct/Group/Batch Message */
                        <div className={`flex gap-2.5 sm:gap-3 relative ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                              <img 
                                src={resolvedSenderAvatar} 
                                alt="Avatar" 
                                className="w-full h-full object-cover" 
                                onError={(e) => { e.target.src = '/logo.png'; }}
                              />
                            </div>
                          )}

                          <div className={`max-w-md sm:max-w-lg w-auto min-w-[120px] rounded-2xl p-3 sm:p-3.5 shadow-sm text-left space-y-1 overflow-hidden ${
                            isMe 
                              ? 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-tr-xs shadow-indigo-500/15 shadow-md' 
                              : 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800 rounded-tl-xs shadow-slate-200/40'
                          }`}>
                            
                            {!isMe && (
                              <div className="flex items-center gap-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{msg.senderId?.name || 'User'}</span>
                                <span className={`text-[8px] uppercase font-extrabold px-1.5 py-0.2 rounded ${
                                  msg.senderId?.role === 'admin' ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300' :
                                  msg.senderId?.role === 'mentor' ? 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300' :
                                  'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                                }`}>
                                  {msg.senderId?.role}
                                </span>
                              </div>
                            )}

                            {/* File / Link Attachment */}
                            {msg.attachmentUrl && (
                              <div className="my-1.5 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-950 p-2">
                                {msg.attachmentType === 'image' ? (
                                  <a href={msg.attachmentUrl.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${msg.attachmentUrl}` : msg.attachmentUrl} target="_blank" rel="noreferrer">
                                    <img 
                                      src={msg.attachmentUrl.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${msg.attachmentUrl}` : msg.attachmentUrl} 
                                      alt="Attachment" 
                                      className="max-h-60 rounded-lg object-cover hover:opacity-90 transition-opacity" 
                                    />
                                  </a>
                                ) : msg.attachmentType === 'link' ? (
                                  <a 
                                    href={msg.attachmentUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline p-1 min-w-0"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 flex items-center justify-center shrink-0">
                                      <Globe size={18} className="text-indigo-600 dark:text-indigo-400" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold truncate text-slate-900 dark:text-white">{msg.attachmentName || msg.attachmentUrl}</p>
                                      <p className="text-[10px] text-slate-400 truncate font-mono">{msg.attachmentUrl}</p>
                                    </div>
                                    <ExternalLink size={14} className="shrink-0 text-slate-400" />
                                  </a>
                                ) : (
                                  <a 
                                    href={msg.attachmentUrl.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${msg.attachmentUrl}` : msg.attachmentUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-2.5 text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline p-1 min-w-0"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/60 flex items-center justify-center shrink-0">
                                      <FileText size={18} className="text-amber-500" />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-bold truncate text-slate-900 dark:text-white">{msg.attachmentName || 'View Document'}</p>
                                      <span className="text-[9px] uppercase font-bold text-slate-400 font-mono">
                                        {msg.attachmentType === 'pdf' ? 'PDF Document' : 'Document File'}
                                      </span>
                                    </div>
                                    <Download size={14} className="shrink-0 text-slate-400" />
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Formatted Message Text (Code Snippets & Hyperlinks) */}
                            {msg.text && (
                              <FormattedMessageText text={msg.text} isMe={isMe} attachmentType={msg.attachmentType} />
                            )}

                            {/* Timestamp & WhatsApp Status Checkmarks */}
                            <div className={`flex items-center justify-end gap-1 text-[9px] pt-0.5 ${isMe ? 'text-indigo-100/90' : 'text-slate-400 dark:text-slate-500'}`}>
                              <span>{formatTime12h(msg.createdAt)}</span>
                              {isMe && (() => {
                                const readList = (msg.readBy || []).map(id => (id._id || id).toString());
                                const delivList = (msg.deliveredTo || []).map(id => (id._id || id).toString());
                                
                                let isRead = false;
                                let isDelivered = false;

                                if (activeChat?.type === 'direct') {
                                  const targetId = activeChat.id?.toString();
                                  isRead = readList.includes(targetId);
                                  isDelivered = isRead || delivList.includes(targetId) || Boolean(activeChat.isOnline);
                                } else {
                                  // Batch or Group chat
                                  isRead = readList.some(id => id !== user._id.toString());
                                  isDelivered = true;
                                }

                                if (msg.status === 'sending' || (typeof msg._id === 'string' && msg._id.startsWith('temp_'))) {
                                  return (
                                    <span title="Sending..." className="inline-flex items-center text-white/50 ml-0.5 animate-pulse">
                                      <Clock size={12} className="text-white/60" />
                                    </span>
                                  );
                                }
                                if (msg.status === 'failed') {
                                  return (
                                    <span title="Failed to deliver" className="inline-flex items-center text-rose-400 ml-0.5">
                                      <AlertCircle size={12} className="text-rose-400" />
                                    </span>
                                  );
                                }

                                if (isRead) {
                                  return (
                                    <span title="Read" className="inline-flex items-center text-[#38bdf8] ml-0.5">
                                      <CheckCheck size={14} strokeWidth={2.6} className="text-[#38bdf8]" />
                                    </span>
                                  );
                                }
                                if (isDelivered) {
                                  return (
                                    <span title="Delivered" className="inline-flex items-center text-white/75 ml-0.5">
                                      <CheckCheck size={14} strokeWidth={2} className="text-white/75" />
                                    </span>
                                  );
                                }
                                return (
                                  <span title="Sent" className="inline-flex items-center text-white/70 ml-0.5">
                                    <Check size={13} strokeWidth={2.2} className="text-white/70" />
                                  </span>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Attachment Preview Bar */}
            {attachment && (
              <div className="px-6 py-2.5 bg-slate-100 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-900 dark:text-white">
                <div className="flex items-center gap-2 min-w-0">
                  {attachment.type === 'image' ? (
                    <ImageIcon size={15} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
                  ) : attachment.type === 'link' ? (
                    <Link2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                  ) : (
                    <FileText size={15} className="text-amber-500 shrink-0" />
                  )}
                  <span className="font-bold shrink-0">Attached:</span>
                  <span className="text-slate-600 dark:text-slate-300 font-mono truncate max-w-xs">{attachment.name}</span>
                  <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">
                    {attachment.type}
                  </span>
                </div>
                <button onClick={() => setAttachment(null)} className="text-slate-400 hover:text-slate-900 dark:hover:text-white p-1 cursor-pointer">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Input Bar (Modern Floating Multiline) */}
            <div className="p-2.5 sm:p-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800/80 flex items-end gap-2 sm:gap-3 relative z-30 shrink-0">
              
              {/* Attachment Menu (Photo, Document, Link, Code) */}
              <div className="relative mb-1">
                <button 
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer"
                  title="Attach Photo, Document, Web Link, or Code"
                >
                  <Paperclip size={18} />
                </button>

                {showAttachMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-40 bg-slate-950/40 dark:bg-slate-950/70 backdrop-blur-[2px] animate-fadeIn" 
                      onClick={() => setShowAttachMenu(false)} 
                    />
                    <div className="absolute bottom-full mb-3 left-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-2.5 shadow-[0_20px_60px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.95)] space-y-1.5 w-64 z-50 animate-fadeIn ring-1 ring-black/10">
                      {/* Top Header with small X close button (Screenshot 5) */}
                      <div className="flex items-center justify-between px-2.5 py-1 mb-1 border-b border-slate-100 dark:border-slate-800/80">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500">
                          Add Attachment
                        </span>
                        <button
                          type="button"
                          onClick={() => setShowAttachMenu(false)}
                          className="w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                          title="Close menu"
                        >
                          <X size={13} strokeWidth={2.5} />
                        </button>
                      </div>

                      <button 
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          photoInputRef.current?.click();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                          <ImageIcon size={16} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold">Photos & Media</p>
                          <p className="text-[9px] text-slate-400 font-normal">JPG, PNG, GIF</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          docInputRef.current?.click();
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                          <FileText size={16} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold">Document</p>
                          <p className="text-[9px] text-slate-400 font-normal">PDF, DOC, ZIP</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          setIsShareLinkModalOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                          <Link2 size={16} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold">Share Web Link</p>
                          <p className="text-[9px] text-slate-400 font-normal">URL & Website Link</p>
                        </div>
                      </button>

                      <button 
                        type="button"
                        onClick={() => {
                          setShowAttachMenu(false);
                          setIsShareCodeModalOpen(true);
                        }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2.5 cursor-pointer transition-colors"
                      >
                        <div className="w-7 h-7 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                          <Code2 size={16} />
                        </div>
                        <div className="text-left">
                          <p className="font-bold">Share Code</p>
                          <p className="text-[9px] text-slate-400 font-normal">Formatted code snippet</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}

                <input 
                  type="file"
                  ref={photoInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                />
                <input 
                  type="file"
                  ref={docInputRef}
                  className="hidden"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.csv"
                  onChange={handleDocSelect}
                />
              </div>

              {/* Direct Quick Code Share Button */}
              <button 
                type="button"
                onClick={() => setIsShareCodeModalOpen(true)}
                className="p-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all cursor-pointer mb-1 shrink-0"
                title="Share Code Snippet"
              >
                <Code2 size={18} />
              </button>

              {/* Textarea with Enter-to-send and Shift+Enter for new line */}
              <textarea 
                ref={textareaRef}
                rows={1}
                placeholder={`Message ${activeChat.name}... (Press Enter to send, Shift+Enter for new line)`}
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-slate-50 dark:bg-slate-950 text-xs sm:text-sm text-slate-900 dark:text-white px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-800 focus:outline-none focus:border-indigo-500 focus:bg-white dark:focus:bg-slate-900 resize-none max-h-36 min-h-[46px] custom-scrollbar shadow-inner placeholder:text-slate-400 dark:placeholder:text-slate-500"
              />

              {/* Send Button */}
              <button 
                type="button"
                onClick={handleSendMessage}
                disabled={uploadingAttachment || isSending || (!newMessage.trim() && !attachment)}
                className="p-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-white font-extrabold hover:from-indigo-500 hover:to-indigo-400 shadow-md shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none mb-1"
                title="Send Message"
              >
                <Send size={18} />
              </button>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-3 p-6 text-center">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <MessageSquare size={32} />
            </div>
            <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200">Select a Conversation or Group</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm leading-relaxed">
              Choose an academic batch channel, direct peer or mentor, or custom group from the sidebar to start real-time messaging.
            </p>
          </div>
        )}

      </div>

      {/* ================= CREATE GROUP MODAL ================= */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Users size={20} className="text-purple-600 dark:text-purple-400" />
                Create Custom Chat Group
              </h2>
              <button onClick={() => setIsGroupModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Group Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Project Team, Doubt Support"
                  value={groupFormData.name}
                  onChange={(e) => setGroupFormData({ ...groupFormData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Description (Optional)</label>
                <input
                  type="text"
                  placeholder="Short group purpose"
                  value={groupFormData.description}
                  onChange={(e) => setGroupFormData({ ...groupFormData, description: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Add Initial Members</label>
                <div className="max-h-40 overflow-y-auto bg-slate-50 dark:bg-slate-800/80 rounded-2xl p-2 border border-slate-200 dark:border-slate-700 space-y-1 custom-scrollbar">
                  {directContacts.map(c => {
                    const isChecked = groupFormData.memberIds.includes(c._id);
                    return (
                      <label key={c._id} className="flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700/60 rounded-xl cursor-pointer text-xs text-slate-900 dark:text-white">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setGroupFormData(prev => ({ ...prev, memberIds: [...prev.memberIds, c._id] }));
                            } else {
                              setGroupFormData(prev => ({ ...prev, memberIds: prev.memberIds.filter(id => id !== c._id) }));
                            }
                          }}
                          className="rounded text-purple-600 focus:ring-0"
                        />
                        <span className="font-semibold truncate flex-1">{c.name}</span>
                        <span className="text-[10px] text-slate-500 uppercase font-mono">{c.role}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer"
                >
                  Create Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= GROUP INFO MODAL ================= */}
      {isGroupInfoOpen && groupDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                {groupDetails.isBatchCommon ? (
                  <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Users size={20} className="text-purple-600 dark:text-purple-400" />
                )}
                <span>{groupDetails.name}</span>
                {groupDetails.isBatchCommon && (
                  <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                    Official
                  </span>
                )}
              </h2>
              <button onClick={() => setIsGroupInfoOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">{groupDetails.description || 'No description provided.'}</p>

            <div>
              <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">Members ({groupDetails.members?.length || 0})</h4>
              <div className="max-h-48 overflow-y-auto space-y-2 custom-scrollbar">
                {groupDetails.members?.map(m => (
                  <div key={m.user?._id || m._id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        <img 
                          src={m.user?.profileImage || '/logo.png'} 
                          alt="Avatar" 
                          className="w-full h-full object-cover" 
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{m.user?.name || 'User'}</p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{m.user?.email}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded border ${
                      m.role === 'admin' 
                        ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/40' 
                        : 'bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                    }`}>
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
              {!groupDetails.isBatchCommon ? (
                <button
                  onClick={handleLeaveGroup}
                  className="px-3 py-1.5 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <LogOut size={14} /> Leave Group
                </button>
              ) : (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck size={14} /> Official Classroom Group
                </span>
              )}
              <button
                onClick={() => setIsGroupInfoOpen(false)}
                className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= CREATE ANNOUNCEMENT MODAL ================= */}
      {isAnnouncementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Megaphone size={20} className="text-amber-500" />
                Publish Announcement
              </h2>
              <button onClick={() => setIsAnnouncementModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule Update for End Term Exams"
                  value={announcementFormData.title}
                  onChange={(e) => setAnnouncementFormData({ ...announcementFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Priority</label>
                  <select
                    value={announcementFormData.priority}
                    onChange={(e) => setAnnouncementFormData({ ...announcementFormData, priority: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="normal">Normal</option>
                    <option value="important">Important</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Target Audience</label>
                  <select
                    value={announcementFormData.targetAudience}
                    onChange={(e) => setAnnouncementFormData({ ...announcementFormData, targetAudience: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="all">All (Institution-wide)</option>
                    <option value="students">Students Only</option>
                    <option value="mentors">Mentors Only</option>
                    <option value="batch">Specific Batch</option>
                  </select>
                </div>
              </div>

              {announcementFormData.targetAudience === 'batch' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Batch *</label>
                  <select
                    required
                    value={announcementFormData.batchId}
                    onChange={(e) => setAnnouncementFormData({ ...announcementFormData, batchId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="">-- Choose Batch --</option>
                    {batches.map(b => (
                      <option key={b._id} value={b._id}>{b.batchName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Announcement Message *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Write announcement details..."
                  value={announcementFormData.content}
                  onChange={(e) => setAnnouncementFormData({ ...announcementFormData, content: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-amber-500 custom-scrollbar"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAnnouncementModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer"
                >
                  Publish Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SHARE WEB LINK MODAL ================= */}
      {isShareLinkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Link2 size={20} className="text-emerald-500" />
                Share Web Link
              </h2>
              <button onClick={() => setIsShareLinkModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleShareLinkSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Web URL *</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                  <input
                    type="text"
                    required
                    placeholder="https://example.com or google doc link"
                    value={linkFormData.url}
                    onChange={(e) => setLinkFormData({ ...linkFormData, url: e.target.value })}
                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Link Title / Caption (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Project GitHub Repo, Study Material"
                  value={linkFormData.title}
                  onChange={(e) => setLinkFormData({ ...linkFormData, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsShareLinkModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-extrabold shadow-md cursor-pointer transition-colors"
                >
                  Attach Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= SHARE CODE SNIPPET MODAL ================= */}
      {isShareCodeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 text-left max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
                  <Code2 size={20} />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">
                    Share Code Snippet
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Posting to <strong className="text-slate-700 dark:text-slate-300">{activeChat?.name}</strong>
                  </p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsShareCodeModalOpen(false)} 
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleShareCodeSubmit} className="space-y-3.5 flex-1 flex flex-col min-h-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Language Select */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Language
                  </label>
                  <select
                    value={codeLanguage}
                    onChange={(e) => setCodeLanguage(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="javascript">JavaScript</option>
                    <option value="typescript">TypeScript</option>
                    <option value="python">Python</option>
                    <option value="java">Java</option>
                    <option value="cpp">C++</option>
                    <option value="c">C</option>
                    <option value="csharp">C#</option>
                    <option value="html">HTML</option>
                    <option value="css">CSS</option>
                    <option value="sql">SQL</option>
                    <option value="json">JSON</option>
                    <option value="bash">Bash / Shell</option>
                    <option value="plaintext">Plain Text</option>
                  </select>
                </div>

                {/* Title / Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Snippet Title (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Button event handler, Algorithm solution"
                    value={codeTitle}
                    onChange={(e) => setCodeTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Code Textarea */}
              <div className="flex-1 flex flex-col min-h-[220px]">
                <div className="flex items-center justify-between mb-1 text-[11px] text-slate-400">
                  <label className="font-bold text-slate-700 dark:text-slate-300">
                    Code Snippet *
                  </label>
                  <span>Press Tab to indent</span>
                </div>
                <textarea
                  required
                  rows={9}
                  spellCheck="false"
                  placeholder={`// Paste or write your code here...&#10;let btn = document.getElementById("button");&#10;btn.addEventListener("click", () => {&#10;  console.log("Clicked!");&#10;});`}
                  value={codeContent}
                  onChange={(e) => setCodeContent(e.target.value)}
                  onKeyDown={handleCodeTextareaKeyDown}
                  className="flex-1 w-full p-3 bg-slate-950 border border-slate-800 text-slate-100 rounded-2xl font-mono text-xs leading-relaxed focus:outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                />
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 font-mono">
                  {codeContent ? `${codeContent.split('\n').length} lines · ${codeContent.length} chars` : 'Empty snippet'}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsShareCodeModalOpen(false)}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!codeContent.trim() || isSending}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl text-xs font-black shadow-md cursor-pointer transition-all disabled:opacity-40"
                  >
                    Share Code in Group
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= FRIENDS & REQUESTS HUB MODAL ================= */}
      {isFriendsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <UserPlus size={20} className="text-emerald-500" />
                  Friends Hub & Private Chat Access
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Only accepted student friends can chat privately and share gamification coins.
                </p>
              </div>
              <button onClick={() => setIsFriendsModalOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1">
                <X size={18} />
              </button>
            </div>

            {/* Hub Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setFriendModalTab('incoming')}
                className={`flex-1 py-1.5 rounded-xl cursor-pointer transition-all flex items-center justify-center gap-1.5 ${
                  friendModalTab === 'incoming' 
                    ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-xs font-black' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <span>Incoming</span>
                {friendsData.incoming?.length > 0 && (
                  <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-black">
                    {friendsData.incoming.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setFriendModalTab('friends')}
                className={`flex-1 py-1.5 rounded-xl cursor-pointer transition-all ${
                  friendModalTab === 'friends' 
                    ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-xs font-black' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                My Friends ({friendsData.friends?.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setFriendModalTab('add')}
                className={`flex-1 py-1.5 rounded-xl cursor-pointer transition-all ${
                  friendModalTab === 'add' 
                    ? 'bg-white dark:bg-emerald-600 text-emerald-600 dark:text-white shadow-xs font-black' 
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                + Add Friend
              </button>
            </div>

            {/* Tab 1: Incoming Friend Requests */}
            {friendModalTab === 'incoming' && (
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {(!friendsData.incoming || friendsData.incoming.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    No pending friend requests.
                  </div>
                ) : (
                  friendsData.incoming.map(req => (
                    <div key={req._id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                          <img src={req.requester?.profileImage || '/logo.png'} alt="Requester" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.png'; }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">{req.requester?.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{req.requester?.rollNumber || req.requester?.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleRespondFriendRequest(req._id, 'accepted')}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleRespondFriendRequest(req._id, 'rejected')}
                          className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-[11px] font-bold rounded-xl cursor-pointer transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 2: Accepted Friends List */}
            {friendModalTab === 'friends' && (
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {(!friendsData.friends || friendsData.friends.length === 0) ? (
                  <div className="py-8 text-center text-slate-400 text-xs">
                    You haven't added any friends yet.
                  </div>
                ) : (
                  friendsData.friends.map(f => (
                    <div key={f._id} className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                          <img src={f.profileImage || '/logo.png'} alt="Friend" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.png'; }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">{f.name}</p>
                          <p className="text-[10px] text-slate-500 font-mono truncate">{f.rollNumber || f.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => {
                            setIsFriendsModalOpen(false);
                            setActiveChat({
                              id: f._id,
                              type: 'direct',
                              name: f.name,
                              subheading: 'STUDENT',
                              avatar: f.profileImage || '/logo.png',
                              role: 'STUDENT',
                              isOnline: f.isOnline,
                              lastSeen: f.lastSeen
                            });
                          }}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-bold rounded-xl shadow-xs cursor-pointer transition-colors"
                        >
                          Chat
                        </button>
                        <button
                          onClick={() => {
                            setIsFriendsModalOpen(false);
                            handleShareCoinsWithFriend(f);
                          }}
                          className="px-2.5 py-1 bg-amber-500/15 text-amber-700 dark:text-amber-300 hover:bg-amber-500/25 border border-amber-300 dark:border-amber-700 text-[11px] font-bold rounded-xl cursor-pointer transition-colors flex items-center gap-1"
                        >
                          <Coins size={12} className="text-amber-500" />
                          <span>Coins</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Tab 3: Send Friend Request */}
            {friendModalTab === 'add' && (
              <div className="space-y-4">
                {/* Search by Roll Number */}
                <form onSubmit={handleSendFriendRequest} className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Enter Student Roll Number..."
                    value={friendSearchRoll}
                    onChange={(e) => setFriendSearchRoll(e.target.value)}
                    className="flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-xs font-medium focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="submit"
                    disabled={isSendingFriendReq || !friendSearchRoll.trim()}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-xs cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    {isSendingFriendReq ? 'Sending...' : 'Send Request'}
                  </button>
                </form>

                {/* Batch Peers Discovery */}
                <div>
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                    Batch Peers ({friendsData.peers?.length || 0})
                  </h4>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 custom-scrollbar">
                    {(!friendsData.peers || friendsData.peers.length === 0) ? (
                      <p className="text-[11px] text-slate-400 py-3 text-center">No other batch peers available.</p>
                    ) : (
                      friendsData.peers.map(peer => {
                        const isOutgoing = friendsData.outgoing?.some(o => (o.recipient?._id || o.recipient)?.toString() === peer._id.toString());
                        return (
                          <div key={peer._id} className="p-2.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/80 dark:border-slate-700/60 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                                <img src={peer.profileImage || '/logo.png'} alt="Peer" className="w-full h-full object-cover" onError={(e) => { e.target.src = '/logo.png'; }} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{peer.name}</p>
                                <p className="text-[10px] text-slate-500 font-mono truncate">{peer.rollNumber || peer.email}</p>
                              </div>
                            </div>
                            {isOutgoing ? (
                              <span className="text-[10px] text-slate-400 font-bold bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-lg shrink-0">
                                Requested
                              </span>
                            ) : (
                              <button
                                onClick={async () => {
                                  try {
                                    await axios.post('/chat/friend-request/send', { targetUserId: peer._id });
                                    Swal.fire({ toast: true, position: 'top-end', icon: 'success', title: 'Request Sent', timer: 3000 });
                                    fetchFriendsData();
                                  } catch (err) {
                                    Swal.fire('Error', err.response?.data?.message || 'Failed to send request', 'error');
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold rounded-lg shrink-0 cursor-pointer transition-colors"
                              >
                                + Connect
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsFriendsModalOpen(false)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-slate-700 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 1:1 Image Cropper Modal */}
      {cropImageSrc && (
        <ImageCropModal 
          imageSrc={cropImageSrc}
          onClose={() => setCropImageSrc(null)}
          onCropComplete={handleCropComplete}
        />
      )}

    </div>
  );
};

export default BatchChat;
