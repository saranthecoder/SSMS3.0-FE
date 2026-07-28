import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import { 
  Send, Hash, Users, Megaphone, UserCheck, Mail, Phone, Bell, Sparkles, Pin, 
  Search, Paperclip, Image as ImageIcon, FileText, CheckCheck, X, Check, MessageSquare, 
  ChevronRight, Circle, ShieldCheck, User
} from 'lucide-react';
import Loader from '../components/Loader';
import ImageCropModal from '../components/ImageCropModal';

const BatchChat = () => {
  const { user, socket } = useAuth();
  
  // Navigation & Contact States
  const [batches, setBatches] = useState([]);
  const [directContacts, setDirectContacts] = useState([]);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'groups', 'direct', 'announcements'
  const [searchQuery, setSearchQuery] = useState('');
  
  // Selected Active Chat State: { id, type: 'group'|'direct', name, avatar, role, mentorName, batchCode }
  const [activeChat, setActiveChat] = useState(null);

  // Chat Data & Typing
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [showAnnouncementsOnly, setShowAnnouncementsOnly] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [loading, setLoading] = useState(true);

  // Attachment & Cropper States
  const [attachment, setAttachment] = useState(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Group Creation Modal States
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [mentorsList, setMentorsList] = useState([]);
  const [systemBatches, setSystemBatches] = useState([]);
  const [groupFormData, setGroupFormData] = useState({
    batchName: '',
    panelName: '',
    panelSubheading: '',
    mentorId: ''
  });

  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleOpenGroupModal = async () => {
    if (user.role === 'admin') {
      try {
        const [mentorsRes, batchesRes] = await Promise.all([
          axios.get('/mentors'),
          axios.get('/batches')
        ]);
        setMentorsList(Array.isArray(mentorsRes.data) ? mentorsRes.data : []);
        setSystemBatches(Array.isArray(batchesRes.data) ? batchesRes.data : []);
      } catch (err) {
        console.error('Error loading mentors/batches for admin:', err);
      }
    } else if (user.role === 'mentor') {
      // Mentor panel: by default take their active/assigned batch
      if (batches.length > 0) {
        const activeB = batches[0];
        setGroupFormData({
          batchName: activeB.batchName || '',
          panelName: activeB.panelName || '',
          panelSubheading: activeB.panelSubheading || '',
          mentorId: user._id
        });
      }
    }
    setIsGroupModalOpen(true);
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupFormData.batchName) return Swal.fire('Error', 'Please enter a group name', 'warning');
    
    try {
      const { data } = await axios.post('/batches', groupFormData);
      Swal.fire('Group Created!', `Batch Channel "${data.batchName}" is now active in chat.`, 'success');
      setIsGroupModalOpen(false);
      setGroupFormData({ batchName: '', panelName: '', panelSubheading: '', mentorId: '' });
      await loadChatData();
      setActiveChat({
        id: data._id,
        type: 'group',
        name: data.batchName,
        subheading: data.panelName || 'Batch Channel',
        avatar: null,
        role: 'BATCH GROUP'
      });
    } catch (err) {
      Swal.fire('Error', err.response?.data?.message || 'Failed to create chat group', 'error');
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 1. Fetch Batches & Direct Contacts
  const loadChatData = async () => {
    try {
      // Fetch batches
      let batchList = [];
      if (user.role === 'admin' || user.role === 'mentor') {
        const { data } = await axios.get('/batches');
        batchList = Array.isArray(data) ? data : [];
      } else {
        const { data } = await axios.get('/enrollments/my');
        const approved = Array.isArray(data) ? data.filter(e => e.status === 'approved') : [];
        batchList = approved.map(e => e.batchId).filter(Boolean);
      }
      setBatches(batchList);

      // Fetch direct contacts (admins, mentors, peers)
      const { data: contactsData } = await axios.get('/chat/contacts');
      setDirectContacts(Array.isArray(contactsData) ? contactsData : []);

      // Default to first batch or contact if no chat selected
      if (!activeChat) {
        if (batchList.length > 0) {
          const b = batchList[0];
          setActiveChat({
            id: b._id,
            type: 'group',
            name: b.batchName,
            subheading: b.panelName || 'Batch Channel',
            avatar: null,
            role: 'GROUP BATCH'
          });
        } else if (contactsData.length > 0) {
          const c = contactsData[0];
          setActiveChat({
            id: c._id,
            type: 'direct',
            name: c.name,
            subheading: c.role.toUpperCase(),
            avatar: c.equippedAvatar || c.profileImage,
            role: c.role
          });
        }
      }
    } catch (error) {
      console.error('Error fetching chat data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChatData();
  }, [user._id, user.role]);

  // Real-time online/offline status listener
  useEffect(() => {
    if (!socket) return;
    const handleOnlineStatus = (data) => {
      setDirectContacts(prev => prev.map(c => 
        c._id === data.userId 
          ? { ...c, isOnline: data.isOnline, lastSeen: data.isOnline ? c.lastSeen : (data.lastSeen || new Date().toISOString()) }
          : c
      ));
      // Update active chat header if viewing this user
      if (activeChat?.type === 'direct' && activeChat?.id === data.userId) {
        setActiveChat(prev => ({
          ...prev,
          isOnline: data.isOnline,
          lastSeen: data.isOnline ? prev.lastSeen : (data.lastSeen || new Date().toISOString())
        }));
      }
    };
    socket.on('user-online-status', handleOnlineStatus);
    return () => socket.off('user-online-status', handleOnlineStatus);
  }, [socket, activeChat]);

  // 2. Fetch Chat History & Subscribe to Real-Time Socket Events
  useEffect(() => {
    if (!activeChat || !socket) return;

    const fetchHistory = async () => {
      try {
        if (activeChat.type === 'group') {
          const { data } = await axios.get(`/chat/batch/${activeChat.id}`);
          setMessages(Array.isArray(data) ? data : []);
        } else {
          const { data } = await axios.get(`/chat/direct/${activeChat.id}`);
          setMessages(Array.isArray(data) ? data : []);
        }
        scrollToBottom();
      } catch (err) {
        console.error('Failed to fetch chat history', err);
      }
    };

    const joinRoom = () => {
      if (activeChat.type === 'group') {
        socket.emit('join-batch-chat', activeChat.id);
      } else {
        socket.emit('join-direct-chat', activeChat.id);
      }
      fetchHistory();
    };

    if (socket.connected) {
      joinRoom();
    } else {
      socket.on('connect', joinRoom);
    }

    // Real-Time Incoming Message Listener
    const handleIncomingMessage = (msg) => {
      const isForActiveGroup = activeChat.type === 'group' && msg.batchId === activeChat.id;
      const isForActiveDirect = activeChat.type === 'direct' && 
        (msg.senderId._id === activeChat.id || msg.recipientId === activeChat.id || msg.senderId === activeChat.id);

      if (isForActiveGroup || isForActiveDirect) {
        setMessages(prev => {
          if (prev.some(m => m._id === msg._id)) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
      
      // Refresh contact last messages
      loadChatData();
    };

    // Real-Time Typing Listeners
    const handleUserTyping = (data) => {
      if ((data.batchId && data.batchId === activeChat.id) || (data.senderId && data.senderId === activeChat.id)) {
        setTypingUsers(prev => ({ ...prev, [data.senderId]: data.senderName }));
      }
    };

    const handleUserStopTyping = (data) => {
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[data.senderId];
        return next;
      });
    };

    socket.on('chat-message-received', handleIncomingMessage);
    socket.on('user-typing', handleUserTyping);
    socket.on('user-stop-typing', handleUserStopTyping);

    return () => {
      if (activeChat.type === 'group') {
        socket.emit('leave-batch-chat', activeChat.id);
      } else {
        socket.emit('leave-direct-chat', activeChat.id);
      }
      socket.off('chat-message-received', handleIncomingMessage);
      socket.off('user-typing', handleUserTyping);
      socket.off('user-stop-typing', handleUserStopTyping);
      socket.off('connect', joinRoom);
    };
  }, [activeChat, socket]);

  // 3. Handle Typing Indicator Event
  const handleInputChange = (e) => {
    setNewMessage(e.target.value);
    if (!socket || !activeChat) return;

    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', {
        batchId: activeChat.type === 'group' ? activeChat.id : null,
        recipientId: activeChat.type === 'direct' ? activeChat.id : null,
        senderName: user.name
      });
    }

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socket.emit('stop-typing', {
        batchId: activeChat.type === 'group' ? activeChat.id : null,
        recipientId: activeChat.type === 'direct' ? activeChat.id : null
      });
    }, 2000);
  };

  // 4. File Attachment Upload Handler
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type.startsWith('image/')) {
      // Pass images through 1:1 Image Cropper option!
      const objectUrl = URL.createObjectURL(file);
      setCropImageSrc(objectUrl);
    } else {
      // Upload documents/PDFs directly
      uploadFileAttachment(file);
    }
    e.target.value = '';
    setShowAttachMenu(false);
  };

  const uploadFileAttachment = async (file) => {
    setUploadingAttachment(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = res.data.url;
      const fileType = file.type.includes('pdf') ? 'pdf' : (file.type.startsWith('image/') ? 'image' : 'document');
      
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
    await uploadFileAttachment(croppedFile);
  };

  // 5. Send Message Handler
  const handleSendMessage = (e) => {
    e.preventDefault();
    if ((!newMessage.trim() && !attachment) || !socket || !activeChat) return;

    const payload = {
      batchId: activeChat.type === 'group' ? activeChat.id : null,
      recipientId: activeChat.type === 'direct' ? activeChat.id : null,
      senderId: user._id,
      senderName: user.name,
      senderRole: user.role,
      senderAvatar: user.equippedAvatar || user.profileImage,
      text: newMessage.trim(),
      attachmentUrl: attachment?.url || '',
      attachmentName: attachment?.name || '',
      attachmentType: attachment?.type || '',
      isAnnouncement: activeChat.type === 'group' ? isAnnouncement : false,
      announcementTitle: activeChat.type === 'group' ? announcementTitle : ''
    };

    socket.emit('send-chat-message', payload);

    setNewMessage('');
    setAttachment(null);
    setIsAnnouncement(false);
    setAnnouncementTitle('');
    setShowAttachMenu(false);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setIsTyping(false);
    socket.emit('stop-typing', {
      batchId: activeChat.type === 'group' ? activeChat.id : null,
      recipientId: activeChat.type === 'direct' ? activeChat.id : null
    });
  };

  if (loading) return <Loader />;
  // ─── WhatsApp-Style Time Formatting Helpers ───
  const formatTime12h = (date) => {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  const formatLastSeen = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDay.getTime() === today.getTime()) return `today at ${formatTime12h(d)}`;
    if (msgDay.getTime() === yesterday.getTime()) return `yesterday at ${formatTime12h(d)}`;
    return `${d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}, ${formatTime12h(d)}`;
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
    return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' });
  };

  const getDateLabel = (dateStr) => {
    const d = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
    const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (msgDay.getTime() === today.getTime()) return 'Today';
    if (msgDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  };

  const shouldShowDateSeparator = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    const curr = new Date(currentMsg.createdAt);
    const prev = new Date(prevMsg.createdAt);
    return curr.toDateString() !== prev.toDateString();
  };

  // Filter & Sort Contacts: Online FIRST, then last message timestamp
  const filteredGroups = batches.filter(b => 
    b.batchName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (b.panelName && b.panelName.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredContacts = directContacts.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedContacts = [...filteredContacts].sort((a, b) => {
    // 1. Online users FIRST
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;

    // 2. Unread messages second
    if (a.unreadCount > 0 && !b.unreadCount) return -1;
    if (!a.unreadCount && b.unreadCount > 0) return 1;

    // 3. Last activity / message time (most recent first)
    const timeA = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const timeB = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const announcementsList = messages.filter(m => m.isAnnouncement);

  return (
    <div className="w-full h-full max-w-7xl mx-auto flex flex-col md:flex-row bg-slate-950 rounded-2xl md:rounded-3xl border border-slate-800 shadow-2xl overflow-hidden text-left">
      
      {/* ================= WHATSAPP LEFT SIDEBAR (CONVERSATIONS LIST) ================= */}
      <div className={`w-full md:w-80 lg:w-96 bg-slate-900 border-r border-slate-800 flex flex-col ${activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {/* Sidebar Header */}
        <div className="p-4 bg-slate-950 border-b border-slate-800 space-y-3">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <MessageSquare className="text-indigo-400" size={20} /> SSMS Messaging
            </h2>
            {(user.role === 'admin' || user.role === 'mentor') && (
              <button
                onClick={handleOpenGroupModal}
                className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black flex items-center gap-1 shadow-md cursor-pointer"
              >
                + Create Group
              </button>
            )}
          </div>

          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search chat or contacts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 text-xs text-white pl-9 pr-4 py-2 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* WhatsApp Tabs */}
          <div className="flex gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-[11px] font-bold text-slate-400">
            <button 
              onClick={() => setActiveTab('all')} 
              className={`flex-1 py-1 rounded-lg transition-all ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow' : 'hover:text-white'}`}
            >
              All
            </button>
            <button 
              onClick={() => setActiveTab('groups')} 
              className={`flex-1 py-1 rounded-lg transition-all ${activeTab === 'groups' ? 'bg-indigo-600 text-white shadow' : 'hover:text-white'}`}
            >
              Groups
            </button>
            {user.role === 'admin' && (
              <button 
                onClick={() => setActiveTab('mentors')} 
                className={`flex-1 py-1 rounded-lg transition-all ${activeTab === 'mentors' ? 'bg-indigo-600 text-white shadow' : 'hover:text-white'}`}
              >
                Mentors
              </button>
            )}
            <button 
              onClick={() => setActiveTab('direct')} 
              className={`flex-1 py-1 rounded-lg transition-all ${activeTab === 'direct' ? 'bg-indigo-600 text-white shadow' : 'hover:text-white'}`}
            >
              Direct
            </button>
          </div>
        </div>

        {/* Conversation Items List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40">
          
          {/* GROUPS LIST */}
          {(activeTab === 'all' || activeTab === 'groups') && (
            <div>
              <div className="px-4 py-2 bg-slate-950/40 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                Batch Group Channels ({filteredGroups.length})
              </div>
              {filteredGroups.map(b => {
                const isSelected = activeChat?.type === 'group' && activeChat?.id === b._id;
                return (
                  <div
                    key={b._id}
                    onClick={() => setActiveChat({
                      id: b._id,
                      type: 'group',
                      name: b.batchName,
                      subheading: b.panelName || 'Batch Channel',
                      avatar: null,
                      role: 'BATCH GROUP'
                    })}
                    className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-slate-800/60 ${isSelected ? 'bg-slate-800 border-l-4 border-indigo-500' : ''}`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-black text-lg shrink-0">
                      <Hash size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <h4 className="text-xs font-black text-white truncate">{b.batchName}</h4>
                        <span className="text-[10px] text-indigo-400 font-extrabold uppercase">Group</span>
                      </div>
                      <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                        {b.panelName ? `${b.panelName} • Group Channel` : 'Click to open batch chat'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* DIRECT CONTACTS LIST */}
          {(activeTab === 'all' || activeTab === 'direct' || activeTab === 'mentors') && (
            <div>
              <div className="px-4 py-2 bg-slate-950/40 text-[10px] font-black uppercase text-slate-500 tracking-wider">
                {activeTab === 'mentors' ? `Assigned Mentors (${sortedContacts.filter(c => c.role === 'mentor').length})` : `Direct Members (${sortedContacts.length})`}
              </div>
              {sortedContacts
                .filter(c => activeTab === 'mentors' ? c.role === 'mentor' : true)
                .map(c => {
                  const isSelected = activeChat?.type === 'direct' && activeChat?.id === c._id;
                  const avatar = c.equippedAvatar || c.profileImage;
                  const resolvedAvatar = (!avatar || avatar === 'default.jpg' || avatar.includes('dicebear') || avatar.includes('bottts'))
                    ? '/logo.png'
                    : (avatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${avatar}` : avatar);
                  return (
                    <div
                      key={c._id}
                      onClick={() => setActiveChat({
                        id: c._id,
                        type: 'direct',
                        name: c.name,
                        subheading: c.role.toUpperCase(),
                        avatar: resolvedAvatar,
                        role: c.role,
                        isOnline: c.isOnline,
                        lastSeen: c.lastSeen
                      })}
                      className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-slate-800/60 ${isSelected ? 'bg-slate-800 border-l-4 border-emerald-500' : ''}`}
                    >
                      <div className="relative shrink-0">
                        <div className="w-11 h-11 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-white font-extrabold text-sm">
                          <img 
                            src={resolvedAvatar} 
                            alt="Avatar" 
                            className="w-full h-full object-cover" 
                            onError={(e) => { e.target.src = '/logo.png'; }}
                          />
                        </div>
                        <span 
                          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-slate-900 ${c.isOnline ? 'bg-emerald-500' : 'bg-slate-500'}`} 
                          title={c.isOnline ? 'Online' : 'Offline'} 
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-baseline">
                          <h4 className="text-xs font-bold text-white truncate">{c.name}</h4>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {c.lastMessage?.createdAt && (
                              <span className={`text-[9px] font-medium ${c.unreadCount > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>
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
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 flex items-center gap-1 font-medium">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${c.isOnline ? 'bg-emerald-400' : 'bg-slate-500'}`} />
                          {c.isOnline ? (
                            <span className="text-emerald-400 font-bold">Online</span>
                          ) : c.lastMessage ? (
                            <span className="truncate">{c.lastMessage.text || 'Attachment'}</span>
                          ) : c.lastSeen ? (
                            <span>last seen {formatLastSeen(c.lastSeen)}</span>
                          ) : (
                            <span>{c.role.toUpperCase()}</span>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

        </div>
      </div>

      {/* ================= WHATSAPP MAIN CHAT WINDOW ================= */}
      <div className={`flex-1 bg-slate-950 flex flex-col ${!activeChat ? 'hidden md:flex' : 'flex'}`}>
        
        {activeChat ? (
          <>
            {/* WhatsApp Chat Header */}
            <div className="px-6 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3.5">
                <button 
                  onClick={() => setActiveChat(null)} 
                  className="md:hidden text-slate-400 hover:text-white p-1"
                >
                  <X size={20} />
                </button>
                <div className="w-10 h-10 rounded-full bg-indigo-600/20 border border-indigo-500/30 text-white flex items-center justify-center font-bold overflow-hidden shrink-0">
                  {activeChat.avatar ? (
                    <img src={activeChat.avatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${activeChat.avatar}` : activeChat.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    activeChat.type === 'group' ? <Hash size={18} className="text-indigo-400" /> : <User size={18} className="text-emerald-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-black text-white flex items-center gap-2">
                    {activeChat.name}
                    <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded-full bg-slate-800 text-indigo-400 border border-slate-700">
                      {activeChat.role}
                    </span>
                  </h3>
                  <p className="text-[11px] font-semibold flex items-center gap-1">
                    {Object.keys(typingUsers).length > 0 ? (
                      <span className="text-emerald-400 flex items-center gap-1">
                        <Circle size={8} className="fill-emerald-400 text-emerald-400 animate-pulse" />
                        {`${Object.values(typingUsers).join(', ')} is typing...`}
                      </span>
                    ) : activeChat.type === 'group' ? (
                      <span className="text-indigo-400 font-medium flex items-center gap-1">
                        <Circle size={8} className="fill-indigo-400 text-indigo-400" /> Batch Group Channel
                      </span>
                    ) : activeChat.isOnline ? (
                      <span className="text-emerald-400 font-bold flex items-center gap-1">
                        <Circle size={8} className="fill-emerald-400 text-emerald-400 animate-pulse" /> Online
                      </span>
                    ) : activeChat.lastSeen ? (
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Circle size={8} className="fill-slate-500 text-slate-500" /> last seen {formatLastSeen(activeChat.lastSeen)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-medium flex items-center gap-1">
                        <Circle size={8} className="fill-slate-500 text-slate-500" /> Offline
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {/* Header Actions */}
              <div className="flex items-center gap-2">
                {announcementsList.length > 0 && (
                  <button 
                    onClick={() => setShowAnnouncementsOnly(!showAnnouncementsOnly)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all border ${
                      showAnnouncementsOnly 
                        ? 'bg-amber-500 text-black border-amber-400 shadow-md' 
                        : 'bg-slate-800 text-amber-400 border-slate-700 hover:bg-slate-700'
                    }`}
                  >
                    <Megaphone size={14} /> Pinned ({announcementsList.length})
                  </button>
                )}
              </div>
            </div>

            {/* Pinned Broadcast Banner (If Announcements Exist) */}
            {announcementsList.length > 0 && !showAnnouncementsOnly && (
              <div className="bg-gradient-to-r from-amber-950/80 via-amber-900/40 to-slate-900 px-6 py-2.5 border-b border-amber-500/20 flex items-center justify-between text-xs text-amber-200">
                <div className="flex items-center gap-2 truncate">
                  <Megaphone size={15} className="text-amber-400 animate-bounce shrink-0" />
                  <span className="font-extrabold text-amber-400 uppercase text-[10px]">Latest Broadcast:</span>
                  <span className="truncate font-medium">{announcementsList[announcementsList.length - 1].announcementTitle || announcementsList[announcementsList.length - 1].text}</span>
                </div>
                <button 
                  onClick={() => setShowAnnouncementsOnly(true)} 
                  className="text-[10px] font-black uppercase text-amber-400 hover:underline shrink-0 ml-2"
                >
                  View All
                </button>
              </div>
            )}

            {/* WhatsApp Chat Bubbles Screen Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-950 relative">
              {/* WhatsApp Subtle Pattern Overlay */}
              <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-25 pointer-events-none" />

              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <MessageSquare size={36} className="text-slate-600" />
                  <p className="text-xs font-semibold">No messages yet. Send a message to start chatting!</p>
                </div>
              ) : (
                (showAnnouncementsOnly ? announcementsList : messages).map((msg, idx, arr) => {
                  const isMe = msg.senderId?._id === user._id || msg.senderId === user._id;
                  const senderAvatar = msg.senderId?.equippedAvatar || msg.senderId?.profileImage;
                  const resolvedSenderAvatar = (!senderAvatar || senderAvatar === 'default.jpg' || senderAvatar.includes('dicebear') || senderAvatar.includes('bottts'))
                    ? '/logo.png'
                    : (senderAvatar.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${senderAvatar}` : senderAvatar);
                  const prevMsg = idx > 0 ? arr[idx - 1] : null;
                  const showDateSep = shouldShowDateSeparator(msg, prevMsg);

                  return (
                    <div key={msg._id}>
                      {/* ─── Day Separator ─── */}
                      {showDateSep && (
                        <div className="flex items-center justify-center my-4 relative z-10">
                          <div className="bg-slate-800/90 text-slate-300 text-[10px] font-bold uppercase tracking-wider px-4 py-1.5 rounded-lg shadow border border-slate-700/50">
                            {getDateLabel(msg.createdAt)}
                          </div>
                        </div>
                      )}

                      {msg.isAnnouncement ? (
                        <div className="w-full flex justify-center my-3 relative z-10">
                          <div className="bg-gradient-to-r from-amber-950/90 to-slate-900 border border-amber-500/40 rounded-2xl p-4 max-w-lg shadow-xl text-left space-y-1">
                            <div className="flex items-center justify-between text-amber-400 font-extrabold text-xs">
                              <span className="flex items-center gap-1.5">
                                <Megaphone size={14} /> {msg.announcementTitle || 'OFFICIAL ANNOUNCEMENT'}
                              </span>
                              <span className="text-[10px] text-amber-400/70 font-mono">
                                {formatTime12h(new Date(msg.createdAt))}
                              </span>
                            </div>
                            <p className="text-xs text-white leading-relaxed font-medium">{msg.text}</p>
                            <div className="text-[10px] text-slate-400 pt-1 border-t border-amber-500/20 flex justify-between">
                              <span>Posted by: <strong className="text-white">{msg.senderId?.name || 'Admin'}</strong></span>
                              <span className="uppercase text-amber-400 font-bold">{msg.senderId?.role}</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className={`flex gap-3 relative z-10 ${isMe ? 'justify-end' : 'justify-start'}`}>
                          {!isMe && (
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 overflow-hidden flex items-center justify-center text-xs font-bold text-white shrink-0 mt-1">
                              <img 
                                src={resolvedSenderAvatar} 
                                alt="Avatar" 
                                className="w-full h-full object-cover" 
                                onError={(e) => { e.target.src = '/logo.png'; }}
                              />
                            </div>
                          )}

                          <div className={`max-w-md w-full min-w-0 rounded-2xl p-3.5 shadow-lg text-left space-y-1.5 overflow-hidden ${
                            isMe 
                              ? 'bg-indigo-600 text-white rounded-br-none' 
                              : 'bg-slate-900 text-white border border-slate-800 rounded-bl-none'
                          }`}>
                            
                            {!isMe && (
                              <div className="flex items-center gap-2 pb-1 border-b border-slate-800">
                                <span className="text-[11px] font-black text-indigo-400">{msg.senderId?.name}</span>
                                <span className="text-[9px] uppercase font-bold px-1.5 py-0.2 rounded bg-slate-800 text-slate-300">
                                  {msg.senderId?.role}
                                </span>
                              </div>
                            )}

                            {/* File Attachment Rendering */}
                            {msg.attachmentUrl && (
                              <div className="my-1 rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 p-2">
                                {msg.attachmentType === 'image' ? (
                                  <a href={msg.attachmentUrl.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${msg.attachmentUrl}` : msg.attachmentUrl} target="_blank" rel="noreferrer">
                                    <img 
                                      src={msg.attachmentUrl.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${msg.attachmentUrl}` : msg.attachmentUrl} 
                                      alt="Attachment" 
                                      className="max-h-60 rounded-lg object-cover hover:opacity-90 transition-opacity" 
                                    />
                                  </a>
                                ) : (
                                  <a 
                                    href={msg.attachmentUrl.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${msg.attachmentUrl}` : msg.attachmentUrl} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-3 text-xs text-indigo-400 font-bold hover:underline p-1 min-w-0"
                                  >
                                    <FileText size={20} className="text-amber-400 shrink-0" />
                                    <span className="truncate">{msg.attachmentName || 'View Document'}</span>
                                  </a>
                                )}
                              </div>
                            )}

                            {/* Message Text */}
                            {msg.text && (
                              <p className="text-xs leading-relaxed font-medium whitespace-pre-wrap break-all [overflow-wrap:anywhere] max-w-full overflow-x-auto">
                                {msg.text}
                              </p>
                            )}

                            {/* WhatsApp Timestamp & Checkmarks (12h AM/PM) */}
                            <div className={`flex items-center justify-end gap-1 text-[9px] ${isMe ? 'text-indigo-200' : 'text-slate-400'}`}>
                              <span>{formatTime12h(new Date(msg.createdAt))}</span>
                              {isMe && <CheckCheck size={13} className="text-cyan-300" />}
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

            {/* Attachment Preview Box */}
            {attachment && (
              <div className="px-6 py-2 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-white">
                <div className="flex items-center gap-2">
                  <Paperclip size={14} className="text-indigo-400" />
                  <span className="font-bold">Attachment Ready:</span>
                  <span className="text-slate-300 font-mono">{attachment.name}</span>
                </div>
                <button onClick={() => setAttachment(null)} className="text-slate-400 hover:text-white p-1">
                  <X size={16} />
                </button>
              </div>
            )}

            {/* WhatsApp Announcement Mode Header (For Admins/Mentors) */}
            {isAnnouncement && (
              <div className="px-6 py-2 bg-amber-950/80 border-t border-amber-500/30 flex items-center gap-3">
                <Megaphone size={16} className="text-amber-400" />
                <input 
                  type="text"
                  placeholder="Announcement Heading (e.g. Exam Schedule Update)..."
                  value={announcementTitle}
                  onChange={(e) => setAnnouncementTitle(e.target.value)}
                  className="flex-1 bg-slate-900 text-xs text-white px-3 py-1.5 rounded-xl border border-amber-500/40 focus:outline-none"
                />
                <button onClick={() => setIsAnnouncement(false)} className="text-amber-400 hover:text-white text-xs font-bold">
                  Cancel
                </button>
              </div>
            )}

            {/* WhatsApp Input Bar */}
            <form onSubmit={handleSendMessage} className="p-4 bg-slate-900 border-t border-slate-800 flex items-center gap-3 relative">
              
              {/* Attachment Paperclip Button & Menu */}
              <div className="relative">
                <button 
                  type="button"
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="p-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition-all cursor-pointer"
                >
                  <Paperclip size={18} />
                </button>

                {showAttachMenu && (
                  <div className="absolute bottom-12 left-0 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl space-y-1 w-44 z-50 animate-fadeIn">
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                    >
                      <ImageIcon size={16} className="text-indigo-400" /> Photo / Document
                    </button>
                    {(user.role === 'admin' || user.role === 'mentor') && activeChat.type === 'group' && (
                      <button 
                        type="button"
                        onClick={() => { setIsAnnouncement(true); setShowAttachMenu(false); }}
                        className="w-full px-3 py-2 rounded-xl text-xs font-bold text-amber-400 hover:bg-slate-800 flex items-center gap-2 cursor-pointer"
                      >
                        <Megaphone size={16} /> Broadcast Card
                      </button>
                    )}
                  </div>
                )}

                <input 
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Message Input Box */}
              <input 
                type="text"
                placeholder={isAnnouncement ? "Type broadcast announcement message..." : `Message ${activeChat.name}...`}
                value={newMessage}
                onChange={handleInputChange}
                className="flex-1 bg-slate-950 text-xs text-white px-4 py-3 rounded-2xl border border-slate-800 focus:outline-none focus:border-indigo-500"
              />

              {/* Send Button */}
              <button 
                type="submit"
                disabled={uploadingAttachment}
                className="p-3 rounded-2xl bg-indigo-600 text-white font-extrabold hover:bg-indigo-500 shadow-lg shadow-indigo-600/30 transition-all hover:scale-105 cursor-pointer disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-3">
            <MessageSquare size={48} className="text-slate-700" />
            <h3 className="text-base font-extrabold text-slate-300">Select a Chat or Group Channel</h3>
            <p className="text-xs text-slate-500 max-w-sm">Choose a conversation from the left sidebar to start messaging with mentors, admins, or your batch group.</p>
          </div>
        )}

      </div>

      {/* Create Chat Group Modal */}
      {isGroupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-left">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <Hash size={20} className="text-indigo-400" />
                Create New Batch Chat Group
              </h2>
              <button
                onClick={() => setIsGroupModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateGroupSubmit} className="space-y-4">
              {user.role === 'admin' && systemBatches.length > 0 && (
                <div className="p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-2xl space-y-1">
                  <label className="block text-[11px] font-black text-indigo-400 uppercase tracking-wider">Select Existing System Batch (Auto-Fills)</label>
                  <select
                    onChange={(e) => {
                      const selected = systemBatches.find(b => b._id === e.target.value);
                      if (selected) {
                        setGroupFormData({
                          batchName: selected.batchName || '',
                          panelName: selected.panelName || '',
                          panelSubheading: selected.panelSubheading || '',
                          mentorId: selected.mentorId?._id || selected.mentorId || ''
                        });
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Choose System Batch --</option>
                    {systemBatches.map(b => (
                      <option key={b._id} value={b._id}>{b.batchName} ({b.panelName || 'Batch'})</option>
                    ))}
                  </select>
                </div>
              )}

              {user.role === 'mentor' && (
                <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl">
                  <span className="text-[10px] font-black uppercase text-emerald-400 block mb-0.5">Assigned Active Batch Auto-Selected</span>
                  <span className="text-xs font-bold text-white">{groupFormData.batchName || 'Default Assigned Batch'}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Group / Batch Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Python Full Stack - Batch 2"
                  value={groupFormData.batchName}
                  onChange={(e) => setGroupFormData({ ...groupFormData, batchName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Panel Heading / Acronym (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. PFS-C2"
                  value={groupFormData.panelName}
                  onChange={(e) => setGroupFormData({ ...groupFormData, panelName: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full System Name / Subheading (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Python Full Stack Controlling System"
                  value={groupFormData.panelSubheading}
                  onChange={(e) => setGroupFormData({ ...groupFormData, panelSubheading: e.target.value })}
                  className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                />
              </div>

              {user.role === 'admin' && (
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Assign Lead Mentor (Optional)</label>
                  <select
                    value={groupFormData.mentorId}
                    onChange={(e) => setGroupFormData({ ...groupFormData, mentorId: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-white text-xs font-medium focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">-- Select Mentor --</option>
                    {mentorsList.map(m => (
                      <option key={m._id} value={m._id}>{m.name} ({m.email})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsGroupModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-800 text-slate-300 rounded-2xl text-xs font-bold hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-2xl text-xs font-extrabold hover:from-indigo-600 hover:to-purple-700 shadow-lg shadow-indigo-500/25"
                >
                  Create Batch Group
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1:1 Image Cropper Modal for Image Attachments */}
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
