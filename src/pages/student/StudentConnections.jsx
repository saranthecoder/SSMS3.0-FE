import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import {
  Users, UserPlus, UserCheck, MessageCircle, Coins, Search,
  Check, X, Clock, Flame, Shield, ArrowRight, RefreshCw,
  UserX, Sparkles, Send, Gift, AlertCircle, Heart
} from 'lucide-react';
import Swal from 'sweetalert2';

const StudentConnections = () => {
  const { user, socket } = useAuth();
  const navigate = useNavigate();

  // Active Tab: 'connections' | 'requests' | 'discover'
  const [activeTab, setActiveTab] = useState('connections');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Data states
  const [friends, setFriends] = useState([]);
  const [pendingIncoming, setPendingIncoming] = useState([]);
  const [pendingOutgoing, setPendingOutgoing] = useState([]);
  const [discoverPeers, setDiscoverPeers] = useState([]);
  const [userCoins, setUserCoins] = useState(user?.coins || 0);
  const [lastSharedDate, setLastSharedDate] = useState(null);
  const [canShareCoins, setCanShareCoins] = useState(true);
  const [cooldownDays, setCooldownDays] = useState(0);

  // Search & Filter
  const [friendSearchTerm, setFriendSearchTerm] = useState('');
  const [discoverSearchQuery, setDiscoverSearchQuery] = useState('');
  const [isSearchingStudents, setIsSearchingStudents] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

  // Coin Share Modal State
  const [selectedFriendForCoins, setSelectedFriendForCoins] = useState(null);
  const [coinAmount, setCoinAmount] = useState(25);
  const [isSharingCoins, setIsSharingCoins] = useState(false);

  // Fetch Friends Data from Centralised API
  const fetchConnectionsData = useCallback(async (isSilent = false) => {
    if (!isSilent) setRefreshing(true);
    try {
      const { data } = await axios.get('/gamification/friends');
      setFriends(data.friends || []);
      setPendingIncoming(data.pendingIncoming || []);
      setPendingOutgoing(data.pendingOutgoing || []);
      setDiscoverPeers(data.discoverPeers || []);
      if (typeof data.userCoins === 'number') setUserCoins(data.userCoins);
      setLastSharedDate(data.lastSharedCoinsDate || null);
      setCanShareCoins(Boolean(data.canShareCoins));
      setCooldownDays(data.cooldownDaysRemaining || 0);
    } catch (err) {
      console.error('Failed to load friends data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchConnectionsData();
  }, [fetchConnectionsData]);

  // Real-time Socket Event Handlers
  useEffect(() => {
    if (!socket) return;

    const handleReqReceived = (data) => {
      fetchConnectionsData(true);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'info',
        title: 'New Friend Request!',
        text: `${data.requester?.name || 'A classmate'} sent you a connection request.`,
        showConfirmButton: false,
        timer: 4000
      });
    };

    const handleReqAccepted = (data) => {
      fetchConnectionsData(true);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        title: 'Connection Accepted! 🎉',
        text: `You and ${data.friend?.name || 'your classmate'} are now connected. Private chat and coin sharing unlocked!`,
        showConfirmButton: false,
        timer: 5000
      });
    };

    const handleCoinsReceived = (data) => {
      if (typeof data.newCoins === 'number') setUserCoins(data.newCoins);
      Swal.fire({
        icon: 'success',
        title: '🪙 Coins Received!',
        html: `<b>${data.sender?.name || 'A friend'}</b> shared <b>${data.amount} Coins</b> with you!`,
        confirmButtonColor: 'var(--color-theme-primary)'
      });
    };

    const handleFriendRemoved = () => {
      fetchConnectionsData(true);
    };

    socket.on('friend-request-received', handleReqReceived);
    socket.on('friend-request-accepted', handleReqAccepted);
    socket.on('coins-received', handleCoinsReceived);
    socket.on('friend-removed', handleFriendRemoved);

    return () => {
      socket.off('friend-request-received', handleReqReceived);
      socket.off('friend-request-accepted', handleReqAccepted);
      socket.off('coins-received', handleCoinsReceived);
      socket.off('friend-removed', handleFriendRemoved);
    };
  }, [socket, fetchConnectionsData]);

  // Debounced search for Discover students
  useEffect(() => {
    if (!discoverSearchQuery || discoverSearchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingStudents(true);
      try {
        const { data } = await axios.get(`/gamification/friends/search?q=${encodeURIComponent(discoverSearchQuery.trim())}`);
        setSearchResults(data.students || []);
      } catch (err) {
        console.warn('Student search error:', err.message);
      } finally {
        setIsSearchingStudents(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [discoverSearchQuery]);

  // Send Friend Request
  const handleSendRequest = async (targetIdOrRoll, isRoll = false) => {
    try {
      const payload = isRoll ? { rollNumber: targetIdOrRoll } : { targetUserId: targetIdOrRoll };
      const { data } = await axios.post('/gamification/friends/request', payload);
      
      Swal.fire({
        icon: 'success',
        title: 'Request Sent!',
        text: data.message || 'Friend request sent successfully.',
        timer: 2500,
        showConfirmButton: false
      });

      fetchConnectionsData(true);
      // Update local search results if active
      if (searchResults.length > 0) {
        setSearchResults(prev => prev.map(s => {
          if (s._id === targetIdOrRoll || (isRoll && s.rollNumber.toLowerCase() === targetIdOrRoll.toLowerCase())) {
            return { ...s, relationship: 'pending_outgoing' };
          }
          return s;
        }));
      }
    } catch (err) {
      Swal.fire({
        icon: 'warning',
        title: 'Cannot Connect',
        text: err.response?.data?.message || 'Failed to send request.',
        confirmButtonColor: 'var(--color-theme-primary)'
      });
    }
  };

  // Respond to Friend Request (Accept / Reject)
  const handleRespondRequest = async (requestId, action) => {
    try {
      const { data } = await axios.post('/gamification/friends/respond', { requestId, action });
      Swal.fire({
        icon: action === 'accept' ? 'success' : 'info',
        title: action === 'accept' ? 'Connected! 🤝' : 'Declined',
        text: data.message || `Request ${action}ed successfully.`,
        timer: 2500,
        showConfirmButton: false
      });
      fetchConnectionsData(true);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Action Failed',
        text: err.response?.data?.message || 'Could not process response.',
        confirmButtonColor: 'var(--color-theme-primary)'
      });
    }
  };

  // Remove Friend or Cancel Request
  const handleRemoveConnection = async (id, friendName, isCancel = false) => {
    const title = isCancel ? 'Cancel Friend Request?' : `Disconnect from ${friendName}?`;
    const text = isCancel
      ? 'This will cancel your pending friend request.'
      : 'You will no longer be able to private chat or share coins with each other.';

    const result = await Swal.fire({
      title,
      text,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: isCancel ? 'Yes, cancel request' : 'Yes, disconnect',
      cancelButtonText: 'Keep'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/gamification/friends/${id}`);
        Swal.fire({
          icon: 'success',
          title: isCancel ? 'Request Canceled' : 'Disconnected',
          text: isCancel ? 'Pending request canceled.' : `Connection with ${friendName} removed.`,
          timer: 2000,
          showConfirmButton: false
        });
        fetchConnectionsData(true);
      } catch (err) {
        Swal.fire({
          icon: 'error',
          title: 'Failed',
          text: err.response?.data?.message || 'Could not remove connection.'
        });
      }
    }
  };

  // Share Coins Submission
  const handleShareCoinsSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFriendForCoins) return;

    const amount = Number(coinAmount);
    if (!amount || amount <= 0) {
      Swal.fire({ icon: 'warning', title: 'Invalid Amount', text: 'Enter a valid coin amount.' });
      return;
    }

    if (amount > userCoins) {
      Swal.fire({ icon: 'warning', title: 'Insufficient Coins', text: `You only have ${userCoins} coins available.` });
      return;
    }

    setIsSharingCoins(true);
    try {
      const { data } = await axios.post('/gamification/friends/share-coins', {
        friendId: selectedFriendForCoins.friendId,
        amount
      });

      setUserCoins(data.senderCoins || (userCoins - amount));
      setCanShareCoins(false);
      setCooldownDays(7);
      setSelectedFriendForCoins(null);

      Swal.fire({
        icon: 'success',
        title: '🎉 Coins Sent!',
        text: data.message || `Successfully shared ${amount} coins with ${selectedFriendForCoins.name}!`,
        confirmButtonColor: 'var(--color-theme-primary)'
      });

      fetchConnectionsData(true);
    } catch (err) {
      Swal.fire({
        icon: 'error',
        title: 'Transfer Failed',
        text: err.response?.data?.message || 'Failed to share coins.',
        confirmButtonColor: 'var(--color-theme-primary)'
      });
    } finally {
      setIsSharingCoins(false);
    }
  };

  // Quick Action: Navigate to Private Chat with Connected Friend
  const handleStartPrivateChat = (friend) => {
    navigate(`/student/chat?userId=${friend.friendId}`);
  };

  // Filtered Friends
  const filteredFriends = useMemo(() => {
    if (!friendSearchTerm.trim()) return friends;
    const term = friendSearchTerm.toLowerCase();
    return friends.filter(f => 
      f.name?.toLowerCase().includes(term) ||
      f.rollNumber?.toLowerCase().includes(term)
    );
  }, [friends, friendSearchTerm]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* ═══ HERO / HEADER BANNER ══════════════════════════════════ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-theme-primary/15 via-theme-accent/10 to-amber-500/10 border border-theme-primary/20 p-6 sm:p-8 backdrop-blur-xl shadow-xs">
        <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-theme-primary/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-theme-primary/15 border border-theme-primary/25 text-theme-primary text-xs font-black uppercase tracking-wider mb-3">
              <Users size={14} />
              Centralised Student Connections
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              Friend Connections & Social Hub
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium max-w-2xl mt-1.5 leading-relaxed">
              Connect with your classmates! In SSMS, only connected friends can share gamification coins and engage in 1-on-1 private messaging.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0 flex-wrap">
            {/* Friends Count */}
            <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 px-4 py-3 rounded-2xl shadow-xs flex items-center gap-3 backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-theme-primary/15 text-theme-primary flex items-center justify-center font-black">
                <Users size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Friends</p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{friends.length}</p>
              </div>
            </div>

            {/* Pending Requests */}
            <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 px-4 py-3 rounded-2xl shadow-xs flex items-center gap-3 backdrop-blur-md">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${
                pendingIncoming.length > 0 
                  ? 'bg-rose-500/15 text-rose-500 animate-pulse' 
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500'
              }`}>
                <UserPlus size={20} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Requests</p>
                <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{pendingIncoming.length}</p>
              </div>
            </div>

            {/* Available Coins */}
            <div className="bg-white/80 dark:bg-slate-800/80 border border-slate-200/80 dark:border-white/10 px-4 py-3 rounded-2xl shadow-xs flex items-center gap-3 backdrop-blur-md">
              <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-black text-lg">
                🪙
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Your Coins</p>
                <p className="text-lg font-black text-amber-600 dark:text-amber-400 leading-tight">{userCoins}</p>
              </div>
            </div>

            {/* Refresh Button */}
            <button
              onClick={() => fetchConnectionsData(false)}
              disabled={refreshing}
              className="p-3 bg-white/80 dark:bg-slate-800/80 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-white/10 rounded-2xl shadow-xs transition-all cursor-pointer"
              title="Refresh Connections Data"
            >
              <RefreshCw size={18} className={refreshing ? 'animate-spin text-theme-primary' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* ═══ TAB NAVIGATION ═════════════════════════════════════════ */}
      <div className="flex items-center gap-2 border-b border-slate-200/70 dark:border-white/10 pb-2">
        <button
          onClick={() => setActiveTab('connections')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === 'connections'
              ? 'bg-theme-primary text-white shadow-sm shadow-theme-primary/20 scale-[1.02]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <UserCheck size={16} />
          My Connections ({friends.length})
        </button>

        <button
          onClick={() => setActiveTab('requests')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer relative ${
            activeTab === 'requests'
              ? 'bg-theme-primary text-white shadow-sm shadow-theme-primary/20 scale-[1.02]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <UserPlus size={16} />
          Requests
          {(pendingIncoming.length > 0 || pendingOutgoing.length > 0) && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'requests' 
                ? 'bg-white text-theme-primary' 
                : 'bg-rose-500 text-white'
            }`}>
              {pendingIncoming.length > 0 ? pendingIncoming.length : pendingOutgoing.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('discover')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs sm:text-sm font-extrabold transition-all cursor-pointer ${
            activeTab === 'discover'
              ? 'bg-theme-primary text-white shadow-sm shadow-theme-primary/20 scale-[1.02]'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-slate-800/60'
          }`}
        >
          <Search size={16} />
          Find & Connect
        </button>
      </div>

      {/* ═══ TAB 1: MY CONNECTIONS (FRIENDS LIST) ═══════════════════ */}
      {activeTab === 'connections' && (
        <div className="space-y-4">
          {/* Search bar inside friends tab */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/70 dark:bg-slate-900/70 p-3 sm:p-4 rounded-2xl border border-slate-200/60 dark:border-white/10 backdrop-blur-xl">
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search connected friends by name or roll..."
                value={friendSearchTerm}
                onChange={(e) => setFriendSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/80 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-theme-primary/30"
              />
            </div>
            
            <p className="text-xs text-slate-500 font-bold">
              Showing {filteredFriends.length} of {friends.length} connections
            </p>
          </div>

          {/* Friends Grid */}
          {filteredFriends.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredFriends.map(friend => (
                <div
                  key={friend.friendshipId}
                  className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between backdrop-blur-xl group hover:border-theme-primary/30"
                >
                  <div className="flex items-start gap-4">
                    {/* Friend Avatar */}
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 border-2 border-theme-primary/30 overflow-hidden flex items-center justify-center p-0.5 shadow-xs">
                        <img
                          src={friend.avatar || '/logo.png'}
                          alt={friend.name}
                          className="w-full h-full object-cover rounded-xl"
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" title="Connected" />
                    </div>

                    {/* Friend Details */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                        {friend.name}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono font-bold">{friend.rollNumber || 'Student'}</p>
                      
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-black bg-theme-primary/10 text-theme-primary border border-theme-primary/20">
                          Lvl {friend.level}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {friend.league} League
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-white/10 flex items-center gap-2">
                    {/* Private Chat Button */}
                    <button
                      onClick={() => handleStartPrivateChat(friend)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-theme-primary hover:bg-theme-primary/90 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                    >
                      <MessageCircle size={14} />
                      Private Chat
                    </button>

                    {/* Share Coins Button */}
                    <button
                      onClick={() => setSelectedFriendForCoins(friend)}
                      className="flex items-center justify-center gap-1 py-2 px-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 font-extrabold text-xs border border-amber-500/30 active:scale-95 transition-all cursor-pointer"
                      title="Share Gamification Coins"
                    >
                      <Coins size={14} />
                      Share
                    </button>

                    {/* Disconnect Button */}
                    <button
                      onClick={() => handleRemoveConnection(friend.friendshipId, friend.name, false)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                      title="Remove Connection"
                    >
                      <UserX size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/60 dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 rounded-3xl p-8 backdrop-blur-xl">
              <div className="w-16 h-16 rounded-3xl bg-theme-primary/10 text-theme-primary mx-auto flex items-center justify-center mb-4">
                <Users size={32} />
              </div>
              <h3 className="text-lg font-black text-slate-900 dark:text-white">
                {friendSearchTerm ? 'No matching connections found' : 'No Friends Connected Yet'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto mt-1 mb-5">
                {friendSearchTerm 
                  ? `No connected friends match "${friendSearchTerm}".`
                  : 'You haven\'t connected with any classmates yet. Use the Find & Connect tab to discover batch peers!'}
              </p>
              <button
                onClick={() => setActiveTab('discover')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-theme-primary text-white font-extrabold text-xs sm:text-sm shadow-md hover:bg-theme-primary/90 transition-all cursor-pointer active:scale-95"
              >
                <UserPlus size={16} />
                Find Classmates to Connect
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══ TAB 2: REQUESTS (INCOMING & OUTGOING) ═══════════════════ */}
      {activeTab === 'requests' && (
        <div className="space-y-6">
          {/* Incoming Requests Section */}
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-theme-primary/15 text-theme-primary flex items-center justify-center font-bold">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Incoming Connection Requests
                  </h3>
                  <p className="text-[11px] text-slate-500">Students who want to connect with you</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-theme-primary/10 text-theme-primary">
                {pendingIncoming.length} Pending
              </span>
            </div>

            {pendingIncoming.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingIncoming.map(req => (
                  <div
                    key={req.requestId}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        <img
                          src={req.avatar || '/logo.png'}
                          alt={req.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{req.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{req.rollNumber}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Sent on {new Date(req.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => handleRespondRequest(req.requestId, 'accept')}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        title="Accept & Unlock Chat"
                      >
                        <Check size={14} />
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespondRequest(req.requestId, 'reject')}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 font-bold text-xs transition-all flex items-center gap-1 cursor-pointer"
                        title="Decline"
                      >
                        <X size={14} />
                        Decline
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs sm:text-sm font-medium">
                No incoming connection requests at this time.
              </div>
            )}
          </div>

          {/* Outgoing Requests Section */}
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold">
                  <Send size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">
                    Sent Requests (Pending Approval)
                  </h3>
                  <p className="text-[11px] text-slate-500">Invitations you sent to classmates</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                {pendingOutgoing.length} Outgoing
              </span>
            </div>

            {pendingOutgoing.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pendingOutgoing.map(req => (
                  <div
                    key={req.requestId}
                    className="flex items-center justify-between gap-4 p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        <img
                          src={req.avatar || '/logo.png'}
                          alt={req.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{req.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{req.rollNumber}</p>
                        <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                          <Clock size={10} className="animate-spin" /> Waiting for response
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleRemoveConnection(req.requestId, req.name, true)}
                      className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-rose-500 hover:text-white text-slate-600 dark:text-slate-300 font-bold text-xs transition-all cursor-pointer"
                    >
                      Cancel Request
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-slate-400 text-xs sm:text-sm font-medium">
                You have no pending outgoing requests.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ TAB 3: DISCOVER & CONNECT ══════════════════════════════ */}
      {activeTab === 'discover' && (
        <div className="space-y-6">
          {/* Search Card */}
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xs">
            <h3 className="font-black text-base text-slate-900 dark:text-white mb-1">
              Find Classmates by Name or Roll Number
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Search any active student across your college to send a connection request.
            </p>

            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Type student name or Roll Number (e.g., 4MH23CA001)..."
                value={discoverSearchQuery}
                onChange={(e) => setDiscoverSearchQuery(e.target.value)}
                className="w-full pl-11 pr-4 py-3 rounded-2xl text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-theme-primary/30 font-medium"
              />
              {isSearchingStudents && (
                <div className="absolute right-4 top-3.5 text-theme-primary animate-spin">
                  <RefreshCw size={16} />
                </div>
              )}
            </div>

            {/* Instant Search Results */}
            {discoverSearchQuery.trim().length >= 2 && (
              <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/10">
                <p className="text-xs font-bold text-slate-500 mb-3">
                  Search Results ({searchResults.length})
                </p>

                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {searchResults.map(student => (
                      <div
                        key={student._id}
                        className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                            <img
                              src={student.equippedAvatar || student.profileImage || '/logo.png'}
                              alt={student.name}
                              className="w-full h-full object-cover"
                              onError={(e) => { e.target.src = '/logo.png'; }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                              {student.name}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono truncate">{student.rollNumber}</p>
                          </div>
                        </div>

                        {/* Status / Connect Action */}
                        <div>
                          {student.relationship === 'friends' ? (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              Connected
                            </span>
                          ) : student.relationship === 'pending_outgoing' ? (
                            <span className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                              Pending
                            </span>
                          ) : student.relationship === 'pending_incoming' ? (
                            <button
                              onClick={() => setActiveTab('requests')}
                              className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-theme-primary text-white"
                            >
                              Respond
                            </button>
                          ) : (
                            <button
                              onClick={() => handleSendRequest(student._id, false)}
                              className="px-3 py-1.5 rounded-xl bg-theme-primary hover:bg-theme-primary/90 text-white font-extrabold text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <UserPlus size={12} />
                              Connect
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !isSearchingStudents && (
                  <p className="text-xs text-slate-400 py-3 text-center">No students found matching "{discoverSearchQuery}".</p>
                )}
              </div>
            )}
          </div>

          {/* Recommended Batch Peers Section */}
          <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200/80 dark:border-white/10 rounded-3xl p-6 backdrop-blur-xl shadow-xs">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-100 dark:border-white/10">
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  Classmates from Your Batches
                </h3>
                <p className="text-xs text-slate-500">Students enrolled in the same batches as you</p>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-theme-primary/10 text-theme-primary">
                {discoverPeers.length} Classmates
              </span>
            </div>

            {discoverPeers.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {discoverPeers.map(peer => (
                  <div
                    key={peer._id}
                    className="p-4 rounded-2xl bg-slate-50/70 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-3 hover:shadow-xs transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0">
                        <img
                          src={peer.equippedAvatar || peer.profileImage || '/logo.png'}
                          alt={peer.name}
                          className="w-full h-full object-cover"
                          onError={(e) => { e.target.src = '/logo.png'; }}
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-white truncate">{peer.name}</p>
                        <p className="text-xs text-slate-500 font-mono truncate">{peer.rollNumber}</p>
                        <p className="text-[10px] text-theme-primary font-bold">Lvl {peer.level || 1} • {peer.league || 'Bronze'}</p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleSendRequest(peer._id, false)}
                      className="px-3 py-1.5 rounded-xl bg-theme-primary hover:bg-theme-primary/90 text-white font-black text-xs shadow-xs active:scale-95 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      <UserPlus size={13} />
                      Connect
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-slate-400 text-xs sm:text-sm font-medium">
                All batch peers are already connected or have pending requests!
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ COIN SHARING MODAL ═════════════════════════════════════ */}
      {selectedFriendForCoins && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setSelectedFriendForCoins(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-rose-500 rounded-xl transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center font-black text-2xl shadow-xs">
                🪙
              </div>
              <div>
                <h3 className="font-black text-lg text-slate-900 dark:text-white">Share Coins</h3>
                <p className="text-xs text-slate-500 font-medium">
                  Transfer gamification coins to your connected friend
                </p>
              </div>
            </div>

            {/* Recipient Preview */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 flex items-center gap-3 mb-4">
              <img
                src={selectedFriendForCoins.avatar || '/logo.png'}
                alt=""
                className="w-10 h-10 rounded-xl object-cover"
                onError={(e) => { e.target.src = '/logo.png'; }}
              />
              <div className="min-w-0">
                <p className="font-black text-sm text-slate-900 dark:text-white truncate">{selectedFriendForCoins.name}</p>
                <p className="text-xs text-slate-500 font-mono">{selectedFriendForCoins.rollNumber}</p>
              </div>
            </div>

            {/* Cooldown Alert */}
            {!canShareCoins ? (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs mb-4">
                <p className="font-bold flex items-center gap-1.5 mb-1">
                  <AlertCircle size={14} /> Weekly Sharing Limit Active
                </p>
                <p>
                  You recently shared coins. You can share coins again in <b>{cooldownDays} day(s)</b>.
                </p>
              </div>
            ) : (
              <form onSubmit={handleShareCoinsSubmit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center text-xs font-bold mb-1.5">
                    <span className="text-slate-600 dark:text-slate-400">Coins to Send</span>
                    <span className="text-amber-600 dark:text-amber-400">Balance: {userCoins} Coins</span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={userCoins}
                    value={coinAmount}
                    onChange={(e) => setCoinAmount(Math.max(1, Math.min(userCoins, Number(e.target.value))))}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-black text-lg focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                </div>

                {/* Quick Amount Buttons */}
                <div className="flex items-center gap-2">
                  {[25, 50, 100, 250].map(val => (
                    <button
                      key={val}
                      type="button"
                      disabled={val > userCoins}
                      onClick={() => setCoinAmount(val)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                        coinAmount === val
                          ? 'bg-amber-500 text-white font-black'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 disabled:opacity-40'
                      }`}
                    >
                      +{val}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Balance after sending:</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{Math.max(0, userCoins - Number(coinAmount))} Coins</span>
                </div>

                <button
                  type="submit"
                  disabled={isSharingCoins || userCoins < coinAmount || coinAmount <= 0}
                  className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-black text-sm shadow-md hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Gift size={16} />
                  {isSharingCoins ? 'Sending Coins...' : `Send ${coinAmount} Coins`}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentConnections;
