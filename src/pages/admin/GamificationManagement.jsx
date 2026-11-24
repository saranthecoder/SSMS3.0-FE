import { useState, useEffect } from 'react';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
  Gamepad2, Plus, Edit, Trash2, Search, RefreshCw, X, Coins, 
  Sparkles, Trophy, Palette, Eye, ShieldAlert, Star, Camera, UploadCloud, Image,
  BookOpen, Users, Award, Zap, Flame, Calendar, Clock, CheckCircle, Shield,
  ArrowRight, ArrowUpRight, DollarSign, Sliders, Check
} from 'lucide-react';

const CATEGORY_DETAILS = {
  avatar: { label: 'Avatars', icon: '👤', color: 'text-blue-500' },
  border: { label: 'Borders', icon: '🖼️', color: 'text-indigo-500' },
  title: { label: 'Titles', icon: '🏆', color: 'text-yellow-500' },
  theme: { label: 'Themes', icon: '🎨', color: 'text-emerald-500' },
  effect: { label: 'Effects', icon: '✨', color: 'text-fuchsia-500' },
  pet: { label: 'Pets', icon: '🐾', color: 'text-pink-500' },
  namecolor: { label: 'Name Colors', icon: '🏷️', color: 'text-violet-500' },
  emoji: { label: 'Emojis', icon: '😀', color: 'text-amber-400' }
};

const RARITY_COLORS = {
  Common: 'bg-slate-100 text-slate-700 dark:bg-slate-900/40 dark:text-slate-400 border-slate-200 dark:border-slate-800',
  Rare: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800/50',
  Epic: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 border-purple-200 dark:border-purple-800/50',
  Legendary: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800/50',
  Mythic: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
};

const RARITY_GLOWS = {
  Common: 'hover:shadow-[0_0_30px_rgba(100,116,139,0.15)] hover:border-slate-500/25',
  Rare: 'hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] hover:border-blue-500/30',
  Epic: 'hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] hover:border-purple-500/30',
  Legendary: 'hover:shadow-[0_0_30px_rgba(245,158,11,0.2)] hover:border-amber-500/35',
  Mythic: 'hover:shadow-[0_0_30px_rgba(244,63,94,0.2)] hover:border-rose-500/35'
};

const resolveImageSrc = (value, imageUrl) => {
  const path = imageUrl || value || '';
  if (!path) return null;
  if (path.startsWith('/uploads') || path.startsWith('/api')) {
    return `${import.meta.env.VITE_API_URL || ''}${path}`;
  }
  return path;
};

const getThemeGradient = (themeName) => {
  const gradients = {
    'Amethyst': 'from-purple-600 to-indigo-600',
    'Sapphire': 'from-blue-600 to-cyan-600',
    'Emerald': 'from-emerald-600 to-teal-600',
    'Ruby': 'from-rose-600 to-pink-600',
    'Amber': 'from-amber-600 to-orange-600',
    'Midnight': 'from-slate-950 via-slate-900 to-slate-950',
    'Sunset': 'from-pink-500 via-red-500 to-yellow-500',
    'Matrix': 'from-green-950 via-black to-green-950',
    'Cyberpunk': 'from-fuchsia-600 via-pink-600 to-cyan-500',
    'Ocean': 'from-sky-500 via-blue-600 to-indigo-700',
    'Obsidian': 'from-neutral-900 to-neutral-950 border-neutral-800'
  };
  return gradients[themeName] || 'from-slate-700 to-slate-800';
};

const GamificationManagement = () => {
  // Top-level Navigation: 'catalog' | 'allocation' | 'rules'
  const [activeMainTab, setActiveMainTab] = useState('catalog');

  // ─── 1. Reward Catalog States ───
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategoryTab, setActiveCategoryTab] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal states
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [uploadingCardId, setUploadingCardId] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    category: 'avatar',
    rarity: 'Common',
    cost: 0,
    isPurchasable: true,
    achievementRequired: '',
    imageUrl: '',
    value: '',
    description: '',
    isLimited: false,
    isActive: true,
    requiredLevel: 1,
    sortOrder: 0
  });

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ─── 2. Coin Allocation States ───
  const [students, setStudents] = useState([]);
  const [batches, setBatches] = useState([]);
  const [targetType, setTargetType] = useState('single'); // 'single' | 'batch'
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedBatchId, setSelectedBatchId] = useState('');
  const [coinsToAllocate, setCoinsToAllocate] = useState(100);
  const [xpToAllocate, setXpToAllocate] = useState(250);
  const [allocationReason, setAllocationReason] = useState('');
  const [isAllocating, setIsAllocating] = useState(false);
  const [auditEvents, setAuditEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/gamification/admin/shop');
      setItems(data || []);
    } catch (error) {
      console.error('Failed to load shop items:', error);
      Swal.fire('Error', 'Could not load gamification shop items.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudentsAndBatches = async () => {
    try {
      const [studentsRes, batchesRes] = await Promise.all([
        axios.get('/auth/students').catch(() => ({ data: [] })),
        axios.get('/batches').catch(() => ({ data: [] }))
      ]);
      setStudents(Array.isArray(studentsRes.data) ? studentsRes.data : []);
      setBatches(Array.isArray(batchesRes.data) ? batchesRes.data : []);
    } catch (err) {
      console.error('Error fetching students or batches:', err);
    }
  };

  const fetchAuditEvents = async () => {
    try {
      setLoadingEvents(true);
      const { data } = await axios.get('/gamification/admin/events?limit=30');
      setAuditEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error loading gamification events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  useEffect(() => {
    fetchItems();
    fetchStudentsAndBatches();
    fetchAuditEvents();
  }, []);

  // Handle Photo Upload in Edit/Create Modal
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      setUploading(true);
      const uploadRes = await axios.post('/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = uploadRes.data.url || uploadRes.data.fileUrl;
      setFormData(prev => ({ 
        ...prev, 
        value: prev.category === 'avatar' || prev.category === 'pet' ? fileUrl : prev.value,
        imageUrl: fileUrl 
      }));
      Swal.fire({
        title: 'Uploaded!',
        text: 'Reward photo uploaded successfully.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
    } catch (error) {
      console.error('File upload failed:', error);
      Swal.fire('Error', error.response?.data?.message || 'File upload failed.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Handle In-Place Photo Update directly on the card
  const handleCardImageUpload = async (item, file) => {
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);

    try {
      setUploadingCardId(item._id);
      Swal.fire({
        title: 'Updating Photo...',
        text: `Uploading new image for "${item.name}"...`,
        allowOutsideClick: false,
        didOpen: () => {
          Swal.showLoading();
        }
      });

      const uploadRes = await axios.post('/upload', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const fileUrl = uploadRes.data.url || uploadRes.data.fileUrl;

      // Update in database: update both imageUrl and value (for avatars/pets)
      const updatedFields = {
        imageUrl: fileUrl,
        ...(item.category === 'avatar' || item.category === 'pet' ? { value: fileUrl } : {})
      };

      await axios.put(`/gamification/admin/shop/${item._id}`, updatedFields);
      
      Swal.fire({
        title: 'Success!',
        text: `Photo for "${item.name}" updated successfully.`,
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      
      fetchItems();
    } catch (error) {
      console.error('In-place upload failed:', error);
      Swal.fire('Error', error.response?.data?.message || 'Photo upload failed.', 'error');
    } finally {
      setUploadingCardId(null);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({
      name: '',
      category: 'avatar',
      rarity: 'Common',
      cost: 0,
      isPurchasable: true,
      achievementRequired: '',
      imageUrl: '',
      value: '',
      description: '',
      isLimited: false,
      isActive: true,
      requiredLevel: 1,
      sortOrder: 0
    });
    setModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingItem(item);
    setFormData({
      name: item.name || '',
      category: item.category || 'avatar',
      rarity: item.rarity || 'Common',
      cost: item.cost ?? 0,
      isPurchasable: item.isPurchasable !== undefined ? item.isPurchasable : true,
      achievementRequired: item.achievementRequired || '',
      imageUrl: item.imageUrl || '',
      value: item.value || '',
      description: item.description || '',
      isLimited: item.isLimited !== undefined ? item.isLimited : false,
      isActive: item.isActive !== undefined ? item.isActive : true,
      requiredLevel: item.requiredLevel ?? 1,
      sortOrder: item.sortOrder ?? 0
    });
    setModalOpen(true);
  };

  const handleDelete = async (item) => {
    const result = await Swal.fire({
      title: 'Delete Shop Item?',
      text: `Are you sure you want to delete "${item.name}"? Users who unlocked this item will no longer be able to use it!`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Yes, delete it!'
    });

    if (result.isConfirmed) {
      try {
        await axios.delete(`/gamification/admin/shop/${item._id}`);
        fetchItems();
        Swal.fire('Deleted!', 'Shop item has been deleted.', 'success');
      } catch (error) {
        Swal.fire('Error', error.response?.data?.message || 'Could not delete item.', 'error');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);
      const payload = {
        ...formData,
        cost: parseInt(formData.cost, 10) || 0,
        requiredLevel: parseInt(formData.requiredLevel, 10) || 1,
        sortOrder: parseInt(formData.sortOrder, 10) || 0
      };

      if (editingItem) {
        // Edit Item
        await axios.put(`/gamification/admin/shop/${editingItem._id}`, payload);
        Swal.fire({
          title: 'Success!',
          text: 'Shop item updated successfully.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      } else {
        // Create Item
        await axios.post('/gamification/admin/shop', payload);
        Swal.fire({
          title: 'Success!',
          text: 'New shop item added to catalog.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
      setModalOpen(false);
      fetchItems();
    } catch (error) {
      Swal.fire('Error', error.response?.data?.message || 'Failed to save shop item.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Admin Manual Coin & XP Allocation
  const handleAllocateCoins = async (e) => {
    e.preventDefault();
    if (!allocationReason.trim()) {
      Swal.fire('Missing Note', 'Please provide a justification or note for this allocation.', 'warning');
      return;
    }

    if (targetType === 'single' && !selectedStudentId) {
      Swal.fire('No Student Selected', 'Please select a student to receive the allocation.', 'warning');
      return;
    }

    if (targetType === 'batch' && !selectedBatchId) {
      Swal.fire('No Batch Selected', 'Please select an academic batch to receive the allocation.', 'warning');
      return;
    }

    const recipientLabel = targetType === 'single'
      ? (students.find(s => s._id === selectedStudentId)?.name || 'the selected student')
      : `all enrolled students in ${batches.find(b => b._id === selectedBatchId)?.batchName || 'the selected batch'}`;

    const confirm = await Swal.fire({
      title: 'Confirm Coin & XP Allocation',
      html: `You are about to allocate <b class="text-amber-500">${coinsToAllocate >= 0 ? `+${coinsToAllocate}` : coinsToAllocate} Coins</b> and <b class="text-violet-400">${xpToAllocate >= 0 ? `+${xpToAllocate}` : xpToAllocate} XP</b> to <b>${recipientLabel}</b>.<br/><br/><span class="text-xs text-slate-400">Reason: "${allocationReason}"</span>`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Allocate Now',
      confirmButtonColor: '#10b981',
      cancelButtonColor: '#64748b'
    });

    if (!confirm.isConfirmed) return;

    try {
      setIsAllocating(true);
      const { data } = await axios.post('/gamification/admin/allocate-coins', {
        targetType,
        studentId: targetType === 'single' ? selectedStudentId : undefined,
        batchId: targetType === 'batch' ? selectedBatchId : undefined,
        coins: coinsToAllocate,
        xp: xpToAllocate,
        reason: allocationReason.trim()
      });

      Swal.fire({
        title: 'Allocation Complete!',
        text: data.message || 'Coins and XP allocated successfully.',
        icon: 'success',
        timer: 2000,
        showConfirmButton: false
      });

      setAllocationReason('');
      fetchAuditEvents();
    } catch (err) {
      console.error('Allocation error:', err);
      Swal.fire('Allocation Failed', err.response?.data?.message || 'Could not allocate coins.', 'error');
    } finally {
      setIsAllocating(false);
    }
  };

  // Filter items
  const filteredItems = items.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.value || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (item.description || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesTab = activeCategoryTab === 'All' || item.category === activeCategoryTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="space-y-6 text-left">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Gamepad2 className="text-theme-primary text-2xl" />
            Gamification Management & Controls
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            Manage cosmetic rewards, update reward photos, allocate coins & XP, and configure institutional gamification rules.
          </p>
        </div>

        {activeMainTab === 'catalog' && (
          <button
            onClick={openAddModal}
            className="px-4 py-2 flex items-center justify-center gap-2 bg-gradient-to-r from-theme-primary to-theme-accent text-white font-extrabold text-sm rounded-xl hover:scale-[1.02] shadow-lg shadow-theme-primary/20 active:scale-95 transition-all cursor-pointer whitespace-nowrap self-start md:self-auto"
          >
            <Plus size={16} /> Add Reward Item
          </button>
        )}
      </div>

      {/* Main Top Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 gap-2 sm:gap-6 overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveMainTab('catalog')}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeMainTab === 'catalog'
              ? 'border-theme-primary text-theme-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Gamepad2 size={17} />
          Cosmetics & Rewards Catalog ({items.length})
        </button>

        <button
          onClick={() => setActiveMainTab('allocation')}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeMainTab === 'allocation'
              ? 'border-theme-primary text-theme-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <Coins size={17} />
          Coins & XP Allocation
        </button>

        <button
          onClick={() => setActiveMainTab('rules')}
          className={`pb-3 text-sm font-extrabold flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap border-b-2 ${
            activeMainTab === 'rules'
              ? 'border-theme-primary text-theme-primary'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300'
          }`}
        >
          <BookOpen size={17} />
          Gamification Rules & Economics
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 1: COSMETICS & REWARDS CATALOG
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'catalog' && (
        <div className="space-y-6">
          {/* Search & Filter section */}
          <div className="flex flex-col sm:flex-row gap-4 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-4 rounded-3xl border border-slate-200/50 dark:border-slate-800/60 shadow-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search rewards by name, code, description..."
                className="input-field pl-9 py-1.5 text-sm w-full"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              onClick={fetchItems}
              disabled={loading}
              className="p-2 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shrink-0 cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Horizontal categories tabs */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setActiveCategoryTab('All')}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                activeCategoryTab === 'All'
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-md'
                  : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              All ({items.length})
            </button>
            {Object.entries(CATEGORY_DETAILS).map(([key, details]) => {
              const count = items.filter(item => item.category === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setActiveCategoryTab(key)}
                  className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-xl border flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    activeCategoryTab === key
                      ? 'bg-theme-primary text-white border-transparent shadow-md'
                      : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{details.icon}</span>
                  {details.label} ({count})
                </button>
              );
            })}
          </div>

          {/* Inventory Grid View */}
          {loading ? (
            <div className="py-20 text-center text-slate-500">
              <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin text-theme-primary opacity-60" />
              <p className="font-bold">Loading rewards catalog...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="glass-panel p-16 text-center text-slate-500 dark:text-slate-400 rounded-3xl">
              <Gamepad2 className="w-16 h-16 mx-auto mb-4 text-theme-primary opacity-30" />
              <p className="text-xl font-bold text-slate-800 dark:text-slate-200">No reward items found</p>
              <p className="text-sm mt-1 font-medium">Try adding a new item or adjusting search filters.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredItems.map(item => {
                const cat = CATEGORY_DETAILS[item.category] || { label: item.category, icon: '📦', color: 'text-slate-500' };
                const imgUrl = resolveImageSrc(item.value, item.imageUrl);
                const isUpdatingThis = uploadingCardId === item._id;

                return (
                  <div 
                    key={item._id} 
                    className={`bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-[28px] relative overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-sm ${RARITY_GLOWS[item.rarity] || ''} ${
                      item.isActive ? '' : 'opacity-65'
                    } group`}
                  >
                    <div>
                      {/* Category Pill and Rarity Badge */}
                      <div className="flex justify-between items-center mb-5">
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 text-slate-600 dark:text-slate-300 rounded-xl flex items-center gap-1">
                          <span>{cat.icon}</span> {cat.label}
                        </span>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-xl border ${RARITY_COLORS[item.rarity] || ''}`}>
                          {item.rarity}
                        </span>
                      </div>

                      {/* Central Preview Area */}
                      <div className="relative w-full h-36 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 flex items-center justify-center mb-5 overflow-hidden group-hover:border-indigo-400/40 transition-colors">
                        {imgUrl || item.category === 'avatar' || item.category === 'pet' ? (
                          <div 
                            onClick={() => document.getElementById(`card-upload-${item._id}`)?.click()}
                            className="relative w-24 h-24 rounded-3xl overflow-hidden border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex items-center justify-center shadow-md group/img cursor-pointer transition-all duration-300 hover:scale-105"
                            title="Click to edit/update photo"
                          >
                            {imgUrl ? (
                              <img 
                                src={imgUrl} 
                                alt={item.name} 
                                className="w-full h-full object-cover object-top"
                              />
                            ) : (
                              <Image className="text-slate-400 dark:text-slate-600 w-8 h-8" />
                            )}
                            
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-slate-950/80 opacity-0 group-hover/img:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white text-[10px] font-extrabold gap-1 text-center px-1">
                              {isUpdatingThis ? (
                                <>
                                  <RefreshCw size={14} className="animate-spin text-amber-400" />
                                  <span>Saving...</span>
                                </>
                              ) : (
                                <>
                                  <Camera size={14} className="text-amber-400" />
                                  <span>Edit Photo</span>
                                </>
                              )}
                            </div>
                          </div>
                        ) : item.category === 'border' ? (
                          <div className="relative w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-inner">
                            <div className={`absolute inset-0.5 rounded-full border-4 ${item.value}`} />
                            <span className="text-xl text-slate-500 z-10">👤</span>
                          </div>
                        ) : item.category === 'title' ? (
                          <div className="py-2 px-3.5 bg-gradient-to-r from-amber-500/10 via-amber-500/20 to-amber-500/10 border border-amber-500/20 rounded-xl text-center shadow-md max-w-[85%]">
                            <span className="text-[9px] font-black uppercase text-amber-500 tracking-[0.2em] block mb-0.5">UNLOCKED TITLE</span>
                            <span className="font-extrabold text-xs text-amber-600 dark:text-amber-200 uppercase tracking-wide">
                              {item.value || item.name}
                            </span>
                          </div>
                        ) : item.category === 'theme' ? (
                          <div className="w-[80%] h-[75%] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2 flex flex-col justify-between shadow-md">
                            <div className="flex justify-between items-center pb-1.5 border-b border-slate-100 dark:border-slate-800">
                              <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Theme Preview</span>
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                            </div>
                            <div className={`h-10 rounded-lg bg-gradient-to-r ${getThemeGradient(item.value)} flex items-center justify-center`}>
                              <span className="text-[9px] font-bold text-white uppercase tracking-wider">{item.value}</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center p-3">
                            <span className="text-3xl block mb-1">🎁</span>
                            <span className="font-mono text-xs font-bold text-slate-600 dark:text-slate-300">{item.value || item.name}</span>
                          </div>
                        )}

                        {/* Dedicated Card Image File Input */}
                        <input 
                          type="file" 
                          id={`card-upload-${item._id}`}
                          accept="image/*"
                          className="hidden" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleCardImageUpload(item, e.target.files[0]);
                            }
                          }}
                        />
                      </div>

                      {/* Reward Meta Info */}
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-extrabold text-base text-slate-800 dark:text-white truncate" title={item.name}>
                            {item.name}
                          </h3>
                          <button
                            type="button"
                            onClick={() => document.getElementById(`card-upload-${item._id}`)?.click()}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs flex items-center gap-1 font-bold shrink-0 transition-colors"
                            title="Upload or Change Photo"
                          >
                            <Camera size={13} className="text-amber-500" />
                            <span className="text-[10px]">Photo</span>
                          </button>
                        </div>
                        
                        <p className="text-xs text-slate-400 dark:text-slate-500 mb-3 min-h-[32px] line-clamp-2 leading-relaxed">
                          {item.description || 'No description provided.'}
                        </p>

                        <div className="space-y-1.5 bg-slate-50 dark:bg-slate-800/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold">Cost:</span>
                            <span className="font-extrabold text-amber-500 flex items-center gap-1">
                              <Coins size={13} /> {item.cost} Coins
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-slate-400 font-bold">Req. Level:</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">Level {item.requiredLevel || 1}</span>
                          </div>
                          {item.achievementRequired && (
                            <div className="flex justify-between items-center text-purple-400">
                              <span className="font-bold">Achievement:</span>
                              <span className="font-extrabold truncate max-w-[130px]" title={item.achievementRequired}>
                                {item.achievementRequired}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card Actions Bottom Bar */}
                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 mt-4">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                        item.isActive 
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/50' 
                          : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-800/50'
                      }`}>
                        {item.isActive ? 'Active' : 'Hidden'}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="p-2 text-slate-500 hover:text-indigo-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="Edit Details"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          className="p-2 text-slate-500 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
                          title="Delete Item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 2: COINS & XP ALLOCATION
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'allocation' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Allocation Form (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-5">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
                <Coins size={20} />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-slate-800 dark:text-white">Admin Coins & XP Allocation</h2>
                <p className="text-xs text-slate-400">Award or deduct gamification points with an audit trail</p>
              </div>
            </div>

            <form onSubmit={handleAllocateCoins} className="space-y-4">
              {/* Target Type Selector */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Allocation Target
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetType('single')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      targetType === 'single'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Users size={14} /> Individual Student
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetType('batch')}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                      targetType === 'batch'
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                        : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <Award size={14} /> Entire Batch
                  </button>
                </div>
              </div>

              {/* Student or Batch Selector */}
              {targetType === 'single' ? (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Select Student ({students.length})
                  </label>
                  <select
                    className="input-field py-2 text-sm w-full"
                    value={selectedStudentId}
                    onChange={(e) => setSelectedStudentId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Student --</option>
                    {students.map(s => (
                      <option key={s._id} value={s._id}>
                        {s.name} ({s.rollNumber || s.email}) - {s.coins || 0} Coins
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Select Academic Batch ({batches.length})
                  </label>
                  <select
                    className="input-field py-2 text-sm w-full"
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Batch --</option>
                    {batches.map(b => (
                      <option key={b._id} value={b._id}>
                        {b.batchName} ({b.status || 'Active'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Coins Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Coins Amount (Use - to deduct)
                  </label>
                  <span className="text-xs font-extrabold text-amber-500 font-mono">
                    {coinsToAllocate >= 0 ? `+${coinsToAllocate}` : coinsToAllocate} 🪙
                  </span>
                </div>
                <input
                  type="number"
                  className="input-field py-2 text-sm w-full font-mono"
                  value={coinsToAllocate}
                  onChange={(e) => setCoinsToAllocate(parseInt(e.target.value) || 0)}
                  required
                />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[50, 100, 250, 500, 1000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCoinsToAllocate(amt)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 hover:bg-amber-100"
                    >
                      +{amt}
                    </button>
                  ))}
                  {[-50, -100].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCoinsToAllocate(amt)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50 hover:bg-rose-100"
                    >
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* XP Amount */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    XP Amount
                  </label>
                  <span className="text-xs font-extrabold text-violet-400 font-mono">
                    {xpToAllocate >= 0 ? `+${xpToAllocate}` : xpToAllocate} ⚡
                  </span>
                </div>
                <input
                  type="number"
                  className="input-field py-2 text-sm w-full font-mono"
                  value={xpToAllocate}
                  onChange={(e) => setXpToAllocate(parseInt(e.target.value) || 0)}
                  required
                />
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {[100, 250, 500, 1000, 2500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setXpToAllocate(amt)}
                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-violet-50 dark:bg-violet-950/40 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/50 hover:bg-violet-100"
                    >
                      +{amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Justification / Reason */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Justification / Note (Required)
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Hackathon 1st Place, Weekly Sprint Winner, Quiz Champion..."
                  className="input-field py-2 text-sm w-full"
                  value={allocationReason}
                  onChange={(e) => setAllocationReason(e.target.value)}
                  required
                />
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isAllocating}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-indigo-600 text-white font-extrabold text-sm rounded-xl hover:scale-[1.01] shadow-lg shadow-amber-500/20 active:scale-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
              >
                {isAllocating ? <RefreshCw size={16} className="animate-spin" /> : <Coins size={16} />}
                {isAllocating ? 'Allocating Points...' : 'Allocate Coins & XP'}
              </button>
            </form>
          </div>

          {/* Right Column: Live Audit Ledger (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Clock size={18} className="text-indigo-500" />
                  Recent Points & Allocation Ledger
                </h3>
                <p className="text-xs text-slate-400">Institutional record of awarded coins and XP events</p>
              </div>
              <button
                onClick={fetchAuditEvents}
                disabled={loadingEvents}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Refresh Ledger"
              >
                <RefreshCw size={15} className={loadingEvents ? 'animate-spin' : ''} />
              </button>
            </div>

            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
              {loadingEvents ? (
                <div className="py-12 text-center text-slate-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-theme-primary opacity-60" />
                  <p className="text-xs">Loading ledger events...</p>
                </div>
              ) : auditEvents.length === 0 ? (
                <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl">
                  <Coins className="w-10 h-10 mx-auto mb-2 text-slate-300 dark:text-slate-700" />
                  <p className="text-xs font-bold">No gamification events recorded yet.</p>
                </div>
              ) : (
                auditEvents.map(evt => {
                  const userImg = resolveImageSrc(evt.userId?.equippedAvatar || evt.userId?.profileImage);
                  return (
                    <div 
                      key={evt._id} 
                      className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-150 dark:border-slate-800 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-slate-200 dark:bg-slate-700 overflow-hidden shrink-0 flex items-center justify-center font-bold">
                          {userImg ? (
                            <img src={userImg} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <span>{evt.userId?.name?.charAt(0) || 'S'}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-extrabold text-slate-800 dark:text-white truncate">
                            {evt.userId?.name || 'Student'}
                          </p>
                          <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate mt-0.5">
                            {evt.reason}
                          </p>
                        </div>
                      </div>

                      <div className="text-right shrink-0 ml-3">
                        <div className="flex items-center gap-1.5 justify-end">
                          {evt.coinsChange !== 0 && (
                            <span className={`font-mono font-extrabold ${evt.coinsChange > 0 ? 'text-amber-500' : 'text-rose-500'}`}>
                              {evt.coinsChange > 0 ? `+${evt.coinsChange}` : evt.coinsChange} 🪙
                            </span>
                          )}
                          {evt.xpChange !== 0 && (
                            <span className="font-mono font-extrabold text-violet-400">
                              {evt.xpChange > 0 ? `+${evt.xpChange}` : evt.xpChange} ⚡
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400">
                          {new Date(evt.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          TAB 3: GAMIFICATION RULES & ECONOMICS
      ═══════════════════════════════════════════════════════════════════════ */}
      {activeMainTab === 'rules' && (
        <div className="space-y-6">
          {/* Top Banner: Core Principles */}
          <div className="bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 border border-amber-500/20 rounded-3xl p-6">
            <h2 className="text-lg font-black text-slate-800 dark:text-white flex items-center gap-2 mb-2">
              <Shield size={20} className="text-amber-500" />
              SSMS 2.0 Institutional Gamification Rules & Economics
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl">
              The gamification engine translates student academic effort, consistency, problem solving, and classroom attendance into RPG leveling progression, unlockable cosmetics, and badges. Below are the official rules enforced across all backend controllers.
            </p>
          </div>

          {/* Grid 1: Earning Rules & Daily Caps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Core Activity Rewards Table */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white mb-4 flex items-center gap-2">
                <Coins size={16} className="text-amber-500" /> Activity Reward Allocation
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase font-bold text-[10px]">
                      <th className="pb-2">Activity / Event</th>
                      <th className="pb-2">Coins Reward</th>
                      <th className="pb-2">XP Reward</th>
                      <th className="pb-2">Cap Bypass</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                    <tr>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">Daily Login Reward</td>
                      <td className="py-2.5 text-amber-500 font-extrabold">+10 to +50 🪙</td>
                      <td className="py-2.5 text-violet-400 font-extrabold">+20 to +100 ⚡</td>
                      <td className="py-2.5 text-emerald-500 font-bold">Standard</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">Physical Lab Check-In</td>
                      <td className="py-2.5 text-amber-500 font-extrabold">+10 🪙</td>
                      <td className="py-2.5 text-violet-400 font-extrabold">+20 ⚡</td>
                      <td className="py-2.5 text-emerald-500 font-bold">Standard</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">LeetCode Problem Solved</td>
                      <td className="py-2.5 text-amber-500 font-extrabold">+40 🪙</td>
                      <td className="py-2.5 text-violet-400 font-extrabold">+80 ⚡</td>
                      <td className="py-2.5 text-emerald-500 font-bold">Standard</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">Homework Task (90%+)</td>
                      <td className="py-2.5 text-amber-500 font-extrabold">+60 🪙</td>
                      <td className="py-2.5 text-violet-400 font-extrabold">+150 ⚡</td>
                      <td className="py-2.5 text-emerald-500 font-bold">Standard</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">Project / Capstone Task</td>
                      <td className="py-2.5 text-amber-500 font-extrabold">+700 to +2500 🪙</td>
                      <td className="py-2.5 text-violet-400 font-extrabold">+1500 to +5000 ⚡</td>
                      <td className="py-2.5 text-amber-400 font-bold">BYPASS (Yes)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 font-bold text-slate-700 dark:text-slate-200">Mock Drive A+ Grade</td>
                      <td className="py-2.5 text-amber-500 font-extrabold">+300 🪙</td>
                      <td className="py-2.5 text-violet-400 font-extrabold">+500 ⚡</td>
                      <td className="py-2.5 text-amber-400 font-bold">BYPASS (Yes)</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Anti-Cheat & Daily Caps */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white mb-2 flex items-center gap-2">
                  <ShieldAlert size={16} className="text-rose-500" /> Fair Play & Daily Caps
                </h3>
                <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                  To prevent automated farming, daily base earnings for routine tasks and check-ins are capped. High-value milestones and project deliverables always bypass these limits:
                </p>

                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Daily Base Coins Cap</p>
                      <p className="text-[10px] text-slate-400">Regular check-ins & LeetCode problems</p>
                    </div>
                    <span className="text-sm font-black text-amber-500 font-mono">300 🪙 / day</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-xs font-bold text-slate-700 dark:text-slate-200">Daily Base XP Cap</p>
                      <p className="text-[10px] text-slate-400">Experience points ceiling for routine actions</p>
                    </div>
                    <span className="text-sm font-black text-violet-400 font-mono">700 ⚡ / day</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs">
                <span className="font-extrabold text-amber-500 flex items-center gap-1">
                  <Star size={13} /> Automatic Cap Bypasses
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Coding streak milestones, attendance milestones, project capstone grading, and admin allocations are exempt from daily caps.
                </p>
              </div>
            </div>
          </div>

          {/* Grid 2: Streak Milestones */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Coding Streak Milestones */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <Flame size={16} className="text-orange-500" /> Coding & LeetCode Streak Milestones
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { days: 3, coins: 50, xp: 100 },
                  { days: 7, coins: 100, xp: 250 },
                  { days: 14, coins: 250, xp: 500 },
                  { days: 21, coins: 400, xp: 900 },
                  { days: 30, coins: 700, xp: 1500, badge: 'Coding Legend (Epic)' },
                  { days: 60, coins: 2500, xp: 5000, badge: 'Coding Master (Legendary)' }
                ].map(m => (
                  <div key={m.days} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="font-black text-orange-500 text-xs">{m.days} Consecutive Days</span>
                    <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">+{m.coins} 🪙 / +{m.xp} ⚡</p>
                    {m.badge && <p className="text-[9px] font-bold text-amber-400 mt-1">🏆 {m.badge}</p>}
                  </div>
                ))}
              </div>
            </div>

            {/* Attendance Streak Milestones */}
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white mb-3 flex items-center gap-2">
                <Calendar size={16} className="text-sky-500" /> Classroom Attendance Streak Milestones
              </h3>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {[
                  { days: 7, coins: 100, xp: 200, badge: 'Punctual Student' },
                  { days: 15, coins: 250, xp: 500 },
                  { days: 30, coins: 500, xp: 1200, badge: 'Perfect Attendance (Rare)' },
                  { days: 60, coins: 1500, xp: 3000, badge: 'Attendance Sovereign (Legendary)' }
                ].map(m => (
                  <div key={m.days} className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800">
                    <span className="font-black text-sky-500 text-xs">{m.days} Check-In Days</span>
                    <p className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-0.5">+{m.coins} 🪙 / +{m.xp} ⚡</p>
                    {m.badge && <p className="text-[9px] font-bold text-sky-400 mt-1">🏆 {m.badge}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grid 3: League Thresholds */}
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
            <h3 className="text-sm font-extrabold uppercase tracking-wider text-slate-800 dark:text-white mb-4 flex items-center gap-2">
              <Trophy size={16} className="text-yellow-500" /> League Progression (Levels 1 to 100)
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 text-center">
              {[
                { name: 'Bronze', icon: '🥉', minLevel: 1, color: 'text-amber-700' },
                { name: 'Silver', icon: '🥈', minLevel: 6, color: 'text-slate-400' },
                { name: 'Gold', icon: '🥇', minLevel: 11, color: 'text-yellow-500' },
                { name: 'Platinum', icon: '💎', minLevel: 15, color: 'text-teal-400' },
                { name: 'Diamond', icon: '💠', minLevel: 20, color: 'text-cyan-400' },
                { name: 'Master', icon: '🏆', minLevel: 30, color: 'text-purple-400' },
                { name: 'Grandmaster', icon: '⚡', minLevel: 45, color: 'text-rose-500' },
                { name: 'Legend', icon: '👑', minLevel: 60, color: 'text-amber-400' }
              ].map(league => (
                <div key={league.name} className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 flex flex-col items-center">
                  <span className="text-2xl mb-1">{league.icon}</span>
                  <p className={`text-xs font-black ${league.color}`}>{league.name}</p>
                  <span className="text-[10px] text-slate-400 mt-0.5">Level {league.minLevel}+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          MODAL: ADD / EDIT REWARD ITEM
      ═══════════════════════════════════════════════════════════════════════ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 w-full max-w-xl rounded-[32px] p-6 sm:p-8 shadow-2xl relative overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-4 mb-6">
              <div>
                <h2 className="text-xl font-extrabold text-slate-800 dark:text-white flex items-center gap-2">
                  <Palette className="text-theme-primary" size={20} />
                  {editingItem ? 'Edit Reward Item' : 'Add New Reward Item'}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure cosmetic item properties, photo image, and purchase cost.
                </p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSubmit} className="overflow-y-auto space-y-4 pr-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Item Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Phoenix Pet, Cyberpunk Avatar, Neon Border..."
                    className="input-field py-2 text-sm w-full"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Category</label>
                  <select
                    className="input-field py-2 text-sm w-full"
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  >
                    {Object.entries(CATEGORY_DETAILS).map(([key, val]) => (
                      <option key={key} value={key}>{val.icon} {val.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Rarity</label>
                  <select
                    className="input-field py-2 text-sm w-full"
                    value={formData.rarity}
                    onChange={(e) => setFormData(prev => ({ ...prev, rarity: e.target.value }))}
                  >
                    <option value="Common">Common</option>
                    <option value="Rare">Rare</option>
                    <option value="Epic">Epic</option>
                    <option value="Legendary">Legendary</option>
                    <option value="Mythic">Mythic</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Cost (Coins)</label>
                  <input
                    type="number"
                    min="0"
                    required
                    className="input-field py-2 text-sm w-full"
                    value={formData.cost}
                    onChange={(e) => setFormData(prev => ({ ...prev, cost: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Req. Level</label>
                  <input
                    type="number"
                    min="1"
                    required
                    className="input-field py-2 text-sm w-full"
                    value={formData.requiredLevel}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiredLevel: parseInt(e.target.value) || 1 }))}
                  />
                </div>

                {/* Photo Upload for Reward (Universal for all categories) */}
                <div className="col-span-2 bg-slate-50 dark:bg-slate-800/40 p-5 rounded-[24px] border border-dashed border-slate-250 dark:border-slate-700/80 flex flex-col items-center justify-center gap-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Camera size={14} className="text-amber-500" /> Reward Photo / Display Image
                  </p>
                  
                  {/* Interactive Upload/Edit Frame */}
                  <div 
                    onClick={() => !uploading && document.getElementById('modal-image-upload-input')?.click()}
                    className="relative w-28 h-28 rounded-3xl overflow-hidden border-4 border-white dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center shadow-lg group cursor-pointer hover:scale-[1.03] active:scale-[0.98] transition-all duration-200"
                    title="Click to select image file"
                  >
                    {resolveImageSrc(formData.value, formData.imageUrl) ? (
                      <img 
                        src={resolveImageSrc(formData.value, formData.imageUrl)} 
                        alt="Preview" 
                        className="w-full h-full object-cover object-top"
                      />
                    ) : (
                      <Image className="text-slate-400 dark:text-slate-600 w-8 h-8" />
                    )}

                    {/* Edit Hover Overlay */}
                    <div className="absolute inset-0 bg-slate-950/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center text-white text-[11px] font-extrabold gap-1 text-center px-2">
                      {uploading ? (
                        <>
                          <RefreshCw size={16} className="animate-spin text-amber-400" />
                          <span>Uploading...</span>
                        </>
                      ) : (
                        <>
                          <Camera size={16} className="text-amber-400" />
                          <span>Upload Photo</span>
                        </>
                      )}
                    </div>
                  </div>

                  <input 
                    id="modal-image-upload-input"
                    type="file" 
                    accept="image/*"
                    className="hidden" 
                    onChange={handleFileUpload}
                    disabled={uploading}
                  />
                  
                  <p className="text-[10px] text-slate-400 text-center font-medium max-w-[80%] leading-relaxed">
                    Click the frame above to select and upload a custom cosmetic PNG/JPG/WebP photo.
                  </p>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                    Value / CSS Code / Path
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. text-red-500, /avatars/goku.png, Amethyst, fire-aura"
                    className="input-field py-2 font-mono text-sm w-full"
                    value={formData.value}
                    onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Description</label>
                  <textarea
                    rows="2"
                    placeholder="Brief details about the unlockable perk..."
                    className="input-field py-2 text-sm w-full"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Sort Order</label>
                  <input
                    type="number"
                    className="input-field py-2 text-sm w-full"
                    value={formData.sortOrder}
                    onChange={(e) => setFormData(prev => ({ ...prev, sortOrder: parseInt(e.target.value) || 0 }))}
                  />
                </div>

                <div className="flex flex-col justify-end gap-3 mt-4 col-span-2 sm:col-span-1">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-theme-primary focus:ring-theme-primary"
                      checked={formData.isActive}
                      onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    />
                    Active (Show in shop)
                  </label>

                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-300 text-theme-primary focus:ring-theme-primary"
                      checked={formData.isPurchasable}
                      onChange={(e) => setFormData(prev => ({ ...prev, isPurchasable: e.target.checked }))}
                    />
                    Purchasable with Coins
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 dark:border-slate-800/50 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-theme-primary to-theme-accent text-white font-extrabold text-sm rounded-xl hover:scale-[1.02] shadow-lg shadow-theme-primary/10 transition-transform cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && <RefreshCw size={14} className="animate-spin" />}
                  {editingItem ? (submitting ? 'Saving...' : 'Save Changes') : (submitting ? 'Creating...' : 'Create Item')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GamificationManagement;
