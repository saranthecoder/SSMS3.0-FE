import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard, Users, BookOpen, FileText, CheckCircle,
  LogOut, Menu, X, User as UserIcon, Sun, Moon, Clock, Gamepad2, MessageCircle, Bell, BellOff, Code, Trophy, Calendar, Monitor,
  Briefcase, ChevronDown, ChevronRight, Palette, Network, ShieldCheck, ShieldAlert, Activity, Sparkles, Lock, UserCheck, ArrowLeftRight,
  AlertTriangle, Share2, Building2, BarChart3
} from 'lucide-react';
import { io } from 'socket.io-client';
import Swal from 'sweetalert2';
import { soundManager } from '../utils/soundManager';
import Loader from './Loader';
import { useGlobalBatch } from '../context/GlobalBatchContext';
import BatchSelectionModal from './BatchSelectionModal';
import StudentMobileBlocker from './StudentMobileBlocker';

const getBorderPreviewClass = (value) => {
  const map = {
    'bronze-glow': 'border-amber-700 shadow-[0_0_12px_rgba(180,83,9,0.5)]',
    'silver-pulse': 'border-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.6)] animate-pulse',
    'gold-shimmer': 'border-yellow-400 shadow-[0_0_20px_rgba(234,179,8,0.9)] bg-transparent',
    'diamond-sparkle': 'border-cyan-300 shadow-[0_0_22px_rgba(34,211,238,0.8)] animate-pulse duration-700',
    'fire-ring': 'border-red-500 shadow-[0_0_25px_rgba(239,68,68,0.9)] bg-gradient-to-tr from-orange-500 to-red-600 animate-pulse',
    'lightning-arc': 'border-violet-500 shadow-[0_0_30px_rgba(139,92,246,0.95)] bg-gradient-to-tr from-violet-600 to-indigo-600 animate-pulse duration-500',
    'galaxy-swirl': 'border-pink-500 shadow-[0_0_35px_rgba(236,72,153,1)] bg-gradient-to-tr from-fuchsia-600 via-pink-600 to-purple-600 animate-pulse duration-[2000ms]',
    'rainbow-spin': 'border-transparent shadow-[0_0_25px_rgba(16,185,129,0.8)] bg-gradient-to-r from-red-500 via-green-500 via-blue-500 to-yellow-500 animate-spin',
    'emerald-pulse': 'border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.8)] animate-pulse duration-1000',
    'ruby-fire': 'border-rose-600 shadow-[0_0_30px_rgba(225,29,72,0.9)] animate-ping duration-[2000ms]',
    'nebula-cloud': 'border-indigo-400 shadow-[0_0_30px_rgba(129,140,248,0.9)] bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 animate-pulse',
    'placement-ready': 'border-double border-4 border-yellow-400 shadow-[0_0_35px_rgba(250,204,21,1)] animate-bounce duration-[2000ms]',
    'top-10-border': 'border-transparent bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600 shadow-[0_0_30px_rgba(6,182,212,0.9)] animate-pulse',
    'frozen-frost': 'border-sky-300 shadow-[0_0_18px_rgba(125,211,252,0.8)] animate-pulse bg-gradient-to-tr from-sky-400 to-blue-500',
    'shadow-assassin': 'border-purple-950 shadow-[0_0_20px_rgba(88,28,135,0.7)] bg-gradient-to-tr from-zinc-950 via-purple-950 to-zinc-900 animate-pulse duration-[3000ms]',
    'weekly-warrior-shield': 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.8)] border-dashed animate-pulse',
    'legend-league-crown': 'border-yellow-400 shadow-[0_0_25px_rgba(234,179,8,1)] bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 animate-pulse'
  };
  return map[value] || 'border-slate-500';
};

const themeDisplayNames = {
  Emerald: 'Emerald Green',
  Amethyst: 'Master Purple',
  Crimson: 'Ruby Sovereign',
  Ocean: 'Ocean Blue',
  Amber: 'Legendary Gold',
  Rose: 'Rose Red',
  Midnight: 'Midnight',
  Sakura: 'Sakura Pink',
  Mint: 'Forest Sovereign',
  Slate: 'Slate',
  Coral: 'Coral',
  Cyber: 'Cosmic Diamond'
};

const PET_EMOJIS = {
  Cat: '🐱',
  Dog: '🐶',
  Robot: '🤖',
  Dragon: '🐲',
  Panda: '🐼',
  Tiger: '🐯',
  Alien: '👽',
  Phoenix: '🔥',
  'Weekly Warrior Owl': '🦉'
};

const getEffectStyles = (effectName) => {
  switch (effectName) {
    case 'fire-aura':
      return 'ring-2 ring-orange-500 ring-offset-1 shadow-[0_0_12px_#f97316] animate-pulse';
    case 'lightning-aura':
      return 'ring-2 ring-violet-500 ring-offset-1 shadow-[0_0_12px_#a855f7] animate-pulse';
    case 'galaxy-aura':
      return 'ring-2 ring-pink-500 ring-offset-1 shadow-[0_0_12px_#ec4899]';
    case 'sparkles':
      return 'ring-2 ring-yellow-400 ring-offset-1 shadow-[0_0_8px_#eab308]';
    case 'snowstorm':
      return 'ring-2 ring-sky-300 ring-offset-1 shadow-[0_0_8px_#38bdf8]';
    case 'heartbeat':
      return 'ring-2 ring-rose-500 ring-offset-1 shadow-[0_0_10px_#f43f5e]';
    case 'cyber-grid':
      return 'ring-2 ring-cyan-400 ring-offset-1 shadow-[0_0_12px_#22d3ee]';
    case 'perfect-attendance-aura':
      return 'ring-2 ring-amber-400 ring-offset-1 shadow-[0_0_15px_#f59e0b]';
    default:
      return '';
  }
};

const getNamecolorClass = (value) => {
  const classes = {
    'text-green-500': 'text-green-500',
    'text-blue-500': 'text-blue-500',
    'text-purple-500': 'text-purple-500',
    'text-amber-500': 'text-amber-500',
    'text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 font-extrabold': 'text-transparent bg-clip-text bg-gradient-to-r from-red-500 via-green-500 to-blue-500 font-extrabold',
    'text-emerald-600 font-extrabold': 'text-emerald-600 font-extrabold',
    'text-red-500 font-bold animate-pulse': 'text-red-500 font-bold animate-pulse',
    'text-cyan-400 font-black animate-pulse': 'text-cyan-400 font-black animate-pulse',
    'text-indigo-400 font-extrabold': 'text-indigo-400 font-extrabold',
    'text-yellow-400 font-extrabold animate-bounce duration-[2000ms]': 'text-yellow-400 font-extrabold animate-bounce duration-[2000ms]'
  };
  return classes[value] || value || '';
};

const formatNotifTime = (time) => {
  if (!time) return 'Just now';
  const d = new Date(time);
  if (isNaN(d.getTime())) return 'Just now';
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
};

const Layout = () => {
  const { user, logout, socket, customPanelName: authPanelName, customPanelSubheading: authPanelSubheading } = useAuth();
  const { selectedBatchId, selectedBatchName, selectedBatch, batchesList, openBatchModal, isBatchClosed: contextIsBatchClosed } = useGlobalBatch();
  const activeBatch = selectedBatch || batchesList.find(b => b._id === selectedBatchId) || batchesList[0];
  const isBatchClosed = contextIsBatchClosed || (activeBatch 
    ? ((activeBatch.status || '').toLowerCase() === 'completed' || (activeBatch.endDate && new Date(activeBatch.endDate) <= new Date()))
    : false);
  const customPanelName = user?.role === 'admin' 
    ? 'SRAC 2.0' 
    : user?.role === 'mentor'
    ? 'SSMS - Saran Students Management System'
    : (authPanelName || activeBatch?.panelName?.trim() || 'SSMS 2.0');
  const customPanelSubheading = user?.role === 'admin' 
    ? 'SR Admin Console & Maintenance System' 
    : user?.role === 'mentor'
    ? "Saran Student's Management System"
    : (authPanelSubheading || activeBatch?.panelSubheading?.trim() || "Saran Student's Management System");
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);

  // Freeze background scrolling when mobile bottom menu is open
  useEffect(() => {
    if (mobileMoreOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMoreOpen]);

  // Collapsible sidebar sections state
  const [expandedSections, setExpandedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('expandedSections');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      Overview: false,
      Academic: false,
      Management: false,
      Operations: false,
      Account: false,
      Main: false,
      Learning: false,
      Performance: false,
      'Batches & Chat': false
    };
  });

  // Pinned sections state (clicked sections that stay open and styled dark)
  const [pinnedSections, setPinnedSections] = useState(() => {
    try {
      const saved = localStorage.getItem('pinnedSections');
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      Overview: false,
      Academic: false,
      Management: false,
      Operations: false,
      Account: false,
      Main: false,
      Learning: false,
      Performance: false,
      'Batches & Chat': false
    };
  });

  const toggleSection = (label) => {
    setPinnedSections(prev => {
      const isPinned = !prev[label];
      const updatedPinned = { ...prev, [label]: isPinned };
      try {
        localStorage.setItem('pinnedSections', JSON.stringify(updatedPinned));
      } catch (e) {}
      
      // Sync expanded state with pin state
      setExpandedSections(prevExpanded => {
        const updatedExpanded = { ...prevExpanded, [label]: isPinned };
        try {
          localStorage.setItem('expandedSections', JSON.stringify(updatedExpanded));
        } catch (e) {}
        return updatedExpanded;
      });

      return updatedPinned;
    });
  };

  const openSection = (label) => {
    setExpandedSections(prev => {
      if (prev[label]) return prev;
      const updated = { ...prev, [label]: true };
      try {
        localStorage.setItem('expandedSections', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const closeSection = (label) => {
    if (pinnedSections[label]) return; // If pinned, do not collapse on mouse leave
    setExpandedSections(prev => {
      if (!prev[label]) return prev;
      const updated = { ...prev, [label]: false };
      try {
        localStorage.setItem('expandedSections', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  // --- HSL Shade Generator for Custom Colors ---
  const hexToHSL = (hex) => {
    let r = parseInt(hex.slice(1,3),16)/255, g = parseInt(hex.slice(3,5),16)/255, b = parseInt(hex.slice(5,7),16)/255;
    const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
    let h = 0, s = 0, l = (max+min)/2;
    if (d !== 0) { s = l > 0.5 ? d/(2-max-min) : d/(max-min); h = max===r ? ((g-b)/d+(g<b?6:0))*60 : max===g ? ((b-r)/d+2)*60 : ((r-g)/d+4)*60; }
    return { h: Math.round(h), s: Math.round(s*100), l: Math.round(l*100) };
  };
  const hslToHex = (h,s,l) => {
    s/=100; l/=100;
    const a = s*Math.min(l,1-l);
    const f = n => { const k=(n+h/30)%12; return Math.round(255*(l-a*Math.max(Math.min(k-3,9-k,1),-1))); };
    return '#'+[f(0),f(8),f(4)].map(x=>x.toString(16).padStart(2,'0')).join('');
  };
  const generateThemeFromHex = (hex) => {
    const { h, s } = hexToHSL(hex);
    const shades = {
      50: hslToHex(h, Math.min(s,30), 97), 100: hslToHex(h, Math.min(s,40), 94),
      200: hslToHex(h, Math.min(s,50), 86), 300: hslToHex(h, Math.min(s,55), 74),
      400: hslToHex(h, s, 60), 500: hex,
      600: hslToHex(h, s, 42), 700: hslToHex(h, s, 34),
      800: hslToHex(h, s, 26), 900: hslToHex(h, s, 20)
    };
    const accent = hslToHex((h+20)%360, s, 50);
    return {
      name: 'Custom', primary: hex, accent,
      shades,
      bgLight: { start: shades[100], middle: shades[50], end: '#ffffff' },
      bgDark: { start: hslToHex(h, Math.min(s,50), 6), middle: hslToHex(h, Math.min(s,40), 3), end: '#010101' }
    };
  };

  const themes = [
    {
      name: 'Emerald',
      primary: '#10b981',
      accent: '#14b8a6',
      shades: { 50: '#f0fdf4', 100: '#dcfce7', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399', 500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b' },
      bgLight: { start: '#dcfce7', middle: '#f0fdf4', end: '#ffffff' },
      bgDark: { start: '#052217', middle: '#02120c', end: '#010604' },
      font: "'Inter', sans-serif",
      radius: '24px',
      btnRadius: '12px',
      glow: '0 8px 30px rgba(16, 185, 129, 0.15)',
      speedMultiplier: '1.0'
    },
    {
      name: 'Amethyst',
      primary: '#8b5cf6',
      accent: '#6366f1',
      shades: { 50: '#f5f3ff', 100: '#ede9fe', 200: '#ddd6fe', 300: '#c4b5fd', 400: '#a78bfa', 500: '#8b5cf6', 600: '#7c3aed', 700: '#6d28d9', 800: '#5b21b6', 900: '#4c1d95' },
      bgLight: { start: '#ede9fe', middle: '#f5f3ff', end: '#ffffff' },
      bgDark: { start: '#120d2b', middle: '#070512', end: '#020106' },
      font: "'Outfit', sans-serif",
      radius: '16px',
      btnRadius: '10px',
      glow: '0 0 20px rgba(139, 92, 246, 0.5)',
      speedMultiplier: '0.8'
    },
    {
      name: 'Crimson',
      primary: '#e11d48',
      accent: '#f43f5e',
      shades: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#e11d48', 600: '#be123c', 700: '#9f1239', 800: '#881337', 900: '#4c0519' },
      bgLight: { start: '#ffe4e6', middle: '#fff1f2', end: '#ffffff' },
      bgDark: { start: '#1c0309', middle: '#0e0104', end: '#040001' },
      font: "'Outfit', sans-serif",
      radius: '20px',
      btnRadius: '14px',
      glow: '0 0 30px rgba(244, 63, 94, 0.45), 0 0 60px rgba(225, 29, 72, 0.15)',
      speedMultiplier: '0.7'
    },
    {
      name: 'Ocean',
      primary: '#0ea5e9',
      accent: '#3b82f6',
      shades: { 50: '#f0f9ff', 100: '#e0f2fe', 200: '#bae6fd', 300: '#7dd3fc', 400: '#38bdf8', 500: '#0ea5e9', 600: '#0284c7', 700: '#0369a1', 800: '#075985', 900: '#0c4a6e' },
      bgLight: { start: '#e0f2fe', middle: '#f0f9ff', end: '#ffffff' },
      bgDark: { start: '#041727', middle: '#010911', end: '#000306' },
      font: "'Outfit', sans-serif",
      radius: '24px',
      btnRadius: '12px',
      glow: '0 8px 30px rgba(14, 165, 233, 0.15)',
      speedMultiplier: '1.0'
    },
    {
      name: 'Amber',
      primary: '#f59e0b',
      accent: '#eab308',
      shades: { 50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24', 500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f' },
      bgLight: { start: '#fef3c7', middle: '#fffbeb', end: '#ffffff' },
      bgDark: { start: '#1a1000', middle: '#0d0800', end: '#050200' },
      font: "'Cinzel', serif",
      radius: '20px',
      btnRadius: '14px',
      glow: '0 0 30px rgba(245, 158, 11, 0.45), 0 0 60px rgba(234, 179, 8, 0.15)',
      speedMultiplier: '0.7'
    },
    {
      name: 'Rose',
      primary: '#f43f5e',
      accent: '#d946ef',
      shades: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
      bgLight: { start: '#ffe4e6', middle: '#fff1f2', end: '#ffffff' },
      bgDark: { start: '#22040b', middle: '#0e0104', end: '#040001' },
      font: "'Playfair Display', serif",
      radius: '32px',
      btnRadius: '16px',
      glow: '0 0 25px rgba(244, 63, 94, 0.5)',
      speedMultiplier: '0.7'
    },
    {
      name: 'Midnight',
      primary: '#6366f1',
      accent: '#818cf8',
      shades: { 50: '#eef2ff', 100: '#e0e7ff', 200: '#c7d2fe', 300: '#a5b4fc', 400: '#818cf8', 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca', 800: '#3730a3', 900: '#312e81' },
      bgLight: { start: '#e0e7ff', middle: '#eef2ff', end: '#ffffff' },
      bgDark: { start: '#0c0a2a', middle: '#050419', end: '#010106' },
      font: "'Cinzel', serif",
      radius: '12px',
      btnRadius: '6px',
      glow: '0 0 18px rgba(99, 102, 241, 0.5)',
      speedMultiplier: '1.4'
    },
    {
      name: 'Sakura',
      primary: '#ec4899',
      accent: '#f472b6',
      shades: { 50: '#fdf2f8', 100: '#fce7f3', 200: '#fbcfe8', 300: '#f9a8d4', 400: '#f472b6', 500: '#ec4899', 600: '#db2777', 700: '#be185d', 800: '#9d174d', 900: '#831843' },
      bgLight: { start: '#fce7f3', middle: '#fdf2f8', end: '#ffffff' },
      bgDark: { start: '#200716', middle: '#0e030a', end: '#040002' },
      font: "'Playfair Display', serif",
      radius: '28px',
      btnRadius: '14px',
      glow: '0 0 22px rgba(236, 72, 153, 0.5)',
      speedMultiplier: '0.8'
    },
    {
      name: 'Mint',
      primary: '#2dd4bf',
      accent: '#10b981',
      shades: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a' },
      bgLight: { start: '#ccfbf1', middle: '#f0fdfa', end: '#ffffff' },
      bgDark: { start: '#00140c', middle: '#000704', end: '#000201' },
      font: "'Space Grotesk', sans-serif",
      radius: '20px',
      btnRadius: '14px',
      glow: '0 0 30px rgba(45, 212, 191, 0.45), 0 0 60px rgba(16, 185, 129, 0.15)',
      speedMultiplier: '0.8'
    },
    {
      name: 'Slate',
      primary: '#64748b',
      accent: '#94a3b8',
      shades: { 50: '#f8fafc', 100: '#f1f5f9', 200: '#e2e8f0', 300: '#cbd5e1', 400: '#94a3b8', 500: '#64748b', 600: '#475569', 700: '#334155', 800: '#1e293b', 900: '#0f172a' },
      bgLight: { start: '#f1f5f9', middle: '#f8fafc', end: '#ffffff' },
      bgDark: { start: '#0a0f18', middle: '#05080e', end: '#020305' },
      font: "'Inter', sans-serif",
      radius: '8px',
      btnRadius: '6px',
      glow: '0 0 10px rgba(100, 116, 139, 0.3)',
      speedMultiplier: '1.5'
    },
    {
      name: 'Coral',
      primary: '#fb7185',
      accent: '#f97316',
      shades: { 50: '#fff1f2', 100: '#ffe4e6', 200: '#fecdd3', 300: '#fda4af', 400: '#fb7185', 500: '#f43f5e', 600: '#e11d48', 700: '#be123c', 800: '#9f1239', 900: '#881337' },
      bgLight: { start: '#ffe4e6', middle: '#fff1f2', end: '#ffffff' },
      bgDark: { start: '#220812', middle: '#0e0308', end: '#040002' },
      font: "'Space Grotesk', sans-serif",
      radius: '14px',
      btnRadius: '8px',
      glow: '0 0 18px rgba(251, 113, 133, 0.4)',
      speedMultiplier: '0.7'
    },
    {
      name: 'Cyber',
      primary: '#22d3ee',
      accent: '#a78bfa',
      shades: { 50: '#ecfeff', 100: '#cffafe', 200: '#a5f3fc', 300: '#67e8f9', 400: '#22d3ee', 500: '#06b6d4', 600: '#0891b2', 700: '#0e7490', 800: '#155e75', 900: '#164e63' },
      bgLight: { start: '#cffafe', middle: '#ecfeff', end: '#ffffff' },
      bgDark: { start: '#061320', middle: '#030910', end: '#010305' },
      font: "'Share Tech Mono', monospace",
      radius: '20px',
      btnRadius: '14px',
      glow: '0 0 30px rgba(34, 211, 238, 0.45), 0 0 60px rgba(167, 139, 250, 0.15)',
      speedMultiplier: '0.9'
    }
  ];

  const [themeColor, setThemeColor] = useState(() => {
    return localStorage.getItem('theme-color') || 'Ocean';
  });
  const [customColor, setCustomColor] = useState(() => {
    return localStorage.getItem('custom-theme-color') || '#6366f1';
  });
  const [customFont, setCustomFont] = useState(() => {
    return localStorage.getItem('custom-theme-font') || 'Inter';
  });
  const [customFontSize, setCustomFontSize] = useState(() => {
    return localStorage.getItem('custom-theme-fontsize') || '100%';
  });

  const [showThemeMenu, setShowThemeMenu] = useState(false);
  const themeMenuRef = useRef(null);

  const applyThemeColor = (themeName) => {
    let selected;
    if (themeName === 'Custom') {
      const savedCustom = localStorage.getItem('custom-theme-color') || customColor;
      selected = generateThemeFromHex(savedCustom);
    } else {
      selected = themes.find(t => t.name === themeName) || themes[0];
    }
    document.documentElement.style.setProperty('--color-theme-primary', selected.primary);
    document.documentElement.style.setProperty('--color-theme-accent', selected.accent);
    
    // Inject custom fonts and parameters
    if (themeName === 'Custom') {
      const fontVal = localStorage.getItem('custom-theme-font') || customFont;
      const sizeVal = localStorage.getItem('custom-theme-fontsize') || customFontSize;
      document.documentElement.style.setProperty('--font-family-theme', `'${fontVal}', sans-serif`);
      document.documentElement.style.setProperty('--theme-font-size-adjust', sizeVal);
      document.documentElement.style.setProperty('--theme-border-radius', '24px');
      document.documentElement.style.setProperty('--theme-button-border-radius', '12px');
      document.documentElement.style.setProperty('--theme-glow-shadow', 'none');
      document.documentElement.style.setProperty('--theme-speed-multiplier', '1.0');
    } else {
      document.documentElement.style.setProperty('--font-family-theme', selected.font || "'Inter', sans-serif");
      document.documentElement.style.setProperty('--theme-font-size-adjust', '100%');
      document.documentElement.style.setProperty('--theme-border-radius', selected.radius || '24px');
      document.documentElement.style.setProperty('--theme-button-border-radius', selected.btnRadius || '12px');
      document.documentElement.style.setProperty('--theme-glow-shadow', selected.glow || 'none');
      document.documentElement.style.setProperty('--theme-speed-multiplier', selected.speedMultiplier || '1.0');
    }

    // Inject all 10 shades for the selected theme dynamically
    document.documentElement.style.setProperty('--color-primary-50', selected.shades[50]);
    document.documentElement.style.setProperty('--color-primary-100', selected.shades[100]);
    document.documentElement.style.setProperty('--color-primary-200', selected.shades[200]);
    document.documentElement.style.setProperty('--color-primary-300', selected.shades[300]);
    document.documentElement.style.setProperty('--color-primary-400', selected.shades[400]);
    document.documentElement.style.setProperty('--color-primary-500', selected.shades[500]);
    document.documentElement.style.setProperty('--color-primary-600', selected.shades[600]);
    document.documentElement.style.setProperty('--color-primary-700', selected.shades[700]);
    document.documentElement.style.setProperty('--color-primary-800', selected.shades[800]);
    document.documentElement.style.setProperty('--color-primary-900', selected.shades[900]);

    // Inject the gradient background variables dynamically
    document.documentElement.style.setProperty('--bg-gradient-start', selected.bgLight.start);
    document.documentElement.style.setProperty('--bg-gradient-middle', selected.bgLight.middle);
    document.documentElement.style.setProperty('--bg-gradient-end', selected.bgLight.end);
    document.documentElement.style.setProperty('--dark-bg-gradient-start', selected.bgDark.start);
    document.documentElement.style.setProperty('--dark-bg-gradient-middle', selected.bgDark.middle);
    document.documentElement.style.setProperty('--dark-bg-gradient-end', selected.bgDark.end);
    
    localStorage.setItem('theme-color', themeName);
    setThemeColor(themeName);
  };

  const handleCustomColorChange = (hex) => {
    setCustomColor(hex);
    localStorage.setItem('custom-theme-color', hex);
    localStorage.setItem('theme-color', 'Custom');
    setThemeColor('Custom');
    setGamificationData(prev => prev ? { ...prev, currentTheme: 'Custom' } : { currentTheme: 'Custom' });
    
    // Save custom theme selection to backend database if not already set
    if (gamificationData?.currentTheme !== 'Custom') {
      axios.post('/gamification/shop/equip', { category: 'theme', value: 'Custom' })
        .then(() => {
          if (socket) socket.emit('equip_change', { category: 'theme', value: 'Custom' });
        })
        .catch(err => console.error('Failed to equip Custom theme on backend:', err));
    }
    const custom = generateThemeFromHex(hex);
    document.documentElement.style.setProperty('--color-theme-primary', custom.primary);
    document.documentElement.style.setProperty('--color-theme-accent', custom.accent);
    
    // Inject default values for custom color
    document.documentElement.style.setProperty('--font-family-theme', `'${customFont}', sans-serif`);
    document.documentElement.style.setProperty('--theme-font-size-adjust', customFontSize);
    document.documentElement.style.setProperty('--theme-border-radius', '24px');
    document.documentElement.style.setProperty('--theme-button-border-radius', '12px');
    document.documentElement.style.setProperty('--theme-glow-shadow', 'none');
    document.documentElement.style.setProperty('--theme-speed-multiplier', '1.0');

    Object.entries(custom.shades).forEach(([k,v]) => document.documentElement.style.setProperty(`--color-primary-${k}`, v));
    document.documentElement.style.setProperty('--bg-gradient-start', custom.bgLight.start);
    document.documentElement.style.setProperty('--bg-gradient-middle', custom.bgLight.middle);
    document.documentElement.style.setProperty('--bg-gradient-end', custom.bgLight.end);
    document.documentElement.style.setProperty('--dark-bg-gradient-start', custom.bgDark.start);
    document.documentElement.style.setProperty('--dark-bg-gradient-middle', custom.bgDark.middle);
    document.documentElement.style.setProperty('--dark-bg-gradient-end', custom.bgDark.end);
  };

  const handleCustomFontChange = (font) => {
    setCustomFont(font);
    localStorage.setItem('custom-theme-font', font);
    if (themeColor === 'Custom') {
      document.documentElement.style.setProperty('--font-family-theme', `'${font}', sans-serif`);
    }
  };

  const handleCustomFontSizeChange = (size) => {
    setCustomFontSize(size);
    localStorage.setItem('custom-theme-fontsize', size);
    if (themeColor === 'Custom') {
      document.documentElement.style.setProperty('--theme-font-size-adjust', size);
    }
  };

  const isThemeUnlocked = (themeName) => {
    if (user?.role !== 'student') return true;
    if (themeName === 'Emerald') return true;
    
    const currentEquipped = gamificationData?.currentTheme || '';
    if (currentEquipped === themeName) return true;
    
    const unlocked = gamificationData?.unlockedThemes || [];
    if (unlocked.includes(themeName)) return true;
    
    // Check badge requirements for achievement-locked themes
    const userBadges = gamificationData?.badges || [];
    console.log('[ThemeLockCheck] name:', themeName, 'current:', currentEquipped, 'unlocked:', unlocked, 'badges:', userBadges.map(b => typeof b === 'object' ? b.name : b));
    
    if (themeName === 'Amethyst') {
      return userBadges.some(b => b && (b.name === 'Coding Legend' || b === 'Coding Legend'));
    }
    if (themeName === 'Amber') {
      return userBadges.some(b => b && (b.name === 'Millionaire' || b === 'Millionaire'));
    }
    if (themeName === 'Cyber') {
      return userBadges.some(b => b && (b.name === 'Legend League' || b === 'Legend League'));
    }
    if (themeName === 'Crimson') {
      return userBadges.some(b => b && (b.name === 'Coding Titan' || b === 'Coding Titan'));
    }
    if (themeName === 'Mint') {
      return userBadges.some(b => b && (b.name === 'Perfect Attendance' || b === 'Perfect Attendance'));
    }
    return false;
  };

  const isCustomColorAllowed = () => {
    if (user?.role !== 'student') return true;
    if (gamificationData?.isRankOne) return true;
    
    // Unlocks as achievement reward (Coding Master or Legend League badge)
    const userBadges = gamificationData?.badges || [];
    return userBadges.some(b => b.name === 'Coding Master' || b.name === 'Legend League');
  };

  useEffect(() => {
    applyThemeColor(themeColor);
  }, [themeColor]);

  // Close theme menu on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target)) {
        setShowThemeMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dark mode state - Defaults to true (Dark Mode) for rich black aesthetic
  const [darkMode, setDarkMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      return savedTheme !== 'light';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const [sessionActive, setSessionActive] = useState(() => {
    try {
      return localStorage.getItem('sessionActive') === 'true';
    } catch {
      return false;
    }
  });
  const [attendanceId, setAttendanceId] = useState(() => {
    try {
      return localStorage.getItem('attendanceId') || null;
    } catch {
      return null;
    }
  });
  const getTodayKey = () => new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
  const readCachedStudentState = () => {
    if (!user?._id || user?.role !== 'student') return null;
    try {
      const raw = sessionStorage.getItem(`ssms_student_session_${user._id}_${getTodayKey()}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };
  const initialCachedStudent = readCachedStudentState();

  const [sessionSeconds, setSessionSeconds] = useState(() => initialCachedStudent?.sessionSeconds || 0);
  const [onsiteSeconds, setOnsiteSeconds] = useState(() => initialCachedStudent?.onsiteSeconds || 0);
  const [wfhSeconds, setWfhSeconds] = useState(() => initialCachedStudent?.wfhSeconds || 0);
  const [currentAccessType, setCurrentAccessType] = useState(() => initialCachedStudent?.currentAccessType || 'on-site');
  const [checkInAccess, setCheckInAccess] = useState(() => initialCachedStudent?.checkInAccess || { hasAccess: false, accessType: null });
  const [attendanceLimits, setAttendanceLimits] = useState(() => initialCachedStudent?.attendanceLimits || null);
  const currentAccessTypeRef = useRef('on-site');
  useEffect(() => { currentAccessTypeRef.current = currentAccessType; }, [currentAccessType]);
  const [isSyncing, setIsSyncing] = useState(user?.role === 'student');
  const [attendanceSynced, setAttendanceSynced] = useState(() => Boolean(initialCachedStudent));
  const [coinsLoaded, setCoinsLoaded] = useState(() => {
    try {
      return Boolean(user?._id && sessionStorage.getItem(`ssms_coins_${user._id}`) !== null);
    } catch {
      return false;
    }
  });
  const [userCoins, setUserCoins] = useState(() => {
    try {
      return user?._id ? (Number(sessionStorage.getItem(`ssms_coins_${user._id}`)) || 0) : 0;
    } catch {
      return 0;
    }
  });
  const [gamificationData, setGamificationData] = useState(null);
  const sessionSecondsRef = useRef(0);
  useEffect(() => { sessionSecondsRef.current = sessionSeconds; }, [sessionSeconds]);
  const attendanceIdRef = useRef(null);
  const syncRetryCountRef = useRef(0);

  useEffect(() => {
    const savedTheme = localStorage.getItem('theme-color') || user?.currentTheme || 'Emerald';
    if (gamificationData?.currentTheme) {
      applyThemeColor(gamificationData.currentTheme);
    } else {
      applyThemeColor(savedTheme);
    }
  }, [gamificationData?.currentTheme, user?.currentTheme]);

  useEffect(() => {
    if (user?.role === 'mentor') {
      document.title = 'SSMS - Saran Students Management System';
      return;
    }
    if (customPanelName && customPanelSubheading) {
      document.title = `${customPanelName} (${customPanelSubheading})`;
    } else if (customPanelName) {
      document.title = customPanelName;
    } else {
      document.title = 'SSMS (Saran Students Management System)';
    }
  }, [user?.role, customPanelName, customPanelSubheading]);

  useEffect(() => {
    localStorage.setItem('sessionActive', sessionActive ? 'true' : 'false');
  }, [sessionActive]);

  useEffect(() => {
    if (attendanceId) {
      localStorage.setItem('attendanceId', attendanceId);
      attendanceIdRef.current = attendanceId;
    } else {
      localStorage.removeItem('attendanceId');
      attendanceIdRef.current = null;
    }
  }, [attendanceId]);

  // Notification count state
  const [pendingCount, setPendingCount] = useState(0);
  const [chatCount, setChatCount] = useState(0);
  const [friendRequestsCount, setFriendRequestsCount] = useState(0);
  const [leavesCount, setLeavesCount] = useState(0);
  const [joinsCount, setJoinsCount] = useState(0);
  const [onlineStudentsCount, setOnlineStudentsCount] = useState(0);

  const [activeLeaveStatus, setActiveLeaveStatus] = useState({ isOnLeave: false, message: '' });

  // Header Notifications state
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  // User-scoped storage key for notifications
  const getClearedNotifsKey = useCallback(() => {
    return user?._id ? `clearedNotifs_${user._id}` : 'clearedNotifs_guest';
  }, [user?._id]);

  const getPersistedClearedNotifs = useCallback(() => {
    try {
      const key = user?._id ? `clearedNotifs_${user._id}` : 'clearedNotifs_guest';
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  }, [user?._id]);

  // Persisted cleared notifications
  const [clearedNotifs, setClearedNotifs] = useState(() => {
    try {
      const key = typeof window !== 'undefined' && localStorage.getItem('user') 
        ? `clearedNotifs_${JSON.parse(localStorage.getItem('user'))?._id}` 
        : 'clearedNotifs_guest';
      return JSON.parse(localStorage.getItem(key)) || [];
    } catch {
      return [];
    }
  });

  // Sync state when user changes
  useEffect(() => {
    setClearedNotifs(getPersistedClearedNotifs());
  }, [getPersistedClearedNotifs]);

  // Track seen badge counts to hide red dots permanently until new updates arrive
  const [seenCounts, setSeenCounts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('seenBadgeCounts')) || {}; } catch { return {}; }
  });

  const notifLengthRef = useRef(0);
  const knownNotifIdsRef = useRef(null);
  const [toastStack, setToastStack] = useState([]);

  const isMentorOrAdmin = user?.role === 'mentor' || user?.role === 'admin';
  const [dndMode, setDndMode] = useState(() => {
    try { return localStorage.getItem('ssms_dnd_mode') === 'true'; } catch { return false; }
  });
  const dndModeRef = useRef(dndMode);
  useEffect(() => {
    dndModeRef.current = dndMode;
    try { localStorage.setItem('ssms_dnd_mode', String(dndMode)); } catch {}
  }, [dndMode]);

  const toggleDndMode = useCallback(() => {
    setDndMode(prev => {
      const next = !prev;
      if (next) setToastStack([]);
      return next;
    });
  }, []);

  const playNotifSound = useCallback(() => {
    if (dndModeRef.current) return;
    soundManager.playNotification();
  }, []);

  // Centralized Notification Navigation Engine: Opens the exact task, submission, leave, or chat
  const navigateToNotificationTarget = useCallback((notif) => {
    if (!notif) return;
    
    // Extract metadata
    const notifType = (notif.type || notif.typeLabel || '').toLowerCase();
    const title = (notif.title || '').trim();
    const titleLower = title.toLowerCase();
    const text = (notif.text || notif.message || '').trim();
    const textLower = text.toLowerCase();

    // Try extracting quoted task title: e.g. 'Madhankumar S submitted "D2T15"' -> 'D2T15'
    const quotedMatch = text.match(/"([^"]+)"/) || title.match(/"([^"]+)"/);
    const extractedTaskTitle = notif.taskTitle || (quotedMatch ? quotedMatch[1] : '');

    // Try extracting student name: e.g. 'Madhankumar S submitted "D2T15"' -> 'Madhankumar S'
    const studentMatch = text.match(/^(.+?)\s+submitted/i) || text.match(/^(.+?)\s+requested/i);
    const extractedStudentName = notif.studentName || (studentMatch ? studentMatch[1].trim() : '');

    // 1. SUBMISSION NOTIFICATIONS (Student submitted task -> Mentor/Admin reviews it)
    if (notifType.includes('submission') || titleLower.includes('submission') || textLower.includes('submitted')) {
      if (user?.role === 'admin' || user?.role === 'mentor') {
        const queryTerm = extractedTaskTitle || extractedStudentName || '';
        const searchParam = queryTerm ? `?search=${encodeURIComponent(queryTerm)}` : '';
        navigate(`/reviews${searchParam}`, { 
          state: { 
            search: queryTerm, 
            taskTitle: extractedTaskTitle,
            studentName: extractedStudentName,
            submissionId: notif.submissionId
          } 
        });
        return;
      } else {
        const param = extractedTaskTitle ? `?taskTitle=${encodeURIComponent(extractedTaskTitle)}` : '';
        navigate(`/student/tasks${param}`, { state: { taskTitle: extractedTaskTitle } });
        return;
      }
    }

    // 2. TASK CREATED / ASSIGNED NOTIFICATIONS
    if (notifType.includes('task') || titleLower.includes('task')) {
      if (user?.role === 'student') {
        const param = notif.taskId ? `?taskId=${notif.taskId}` : (extractedTaskTitle ? `?taskTitle=${encodeURIComponent(extractedTaskTitle)}` : (text ? `?taskTitle=${encodeURIComponent(text)}` : ''));
        navigate(`/student/tasks${param}`, {
          state: { taskId: notif.taskId, taskTitle: extractedTaskTitle || text }
        });
        return;
      } else {
        const param = notif.taskId ? `?taskId=${notif.taskId}` : (extractedTaskTitle ? `?taskTitle=${encodeURIComponent(extractedTaskTitle)}` : '');
        navigate(`/tasks${param}`, {
          state: { taskId: notif.taskId, taskTitle: extractedTaskTitle }
        });
        return;
      }
    }

    // 3. TASK GRADED / SCORED NOTIFICATIONS
    if (notifType.includes('grade') || titleLower.includes('grade') || titleLower.includes('score')) {
      if (user?.role === 'student') {
        navigate('/student/grades');
        return;
      }
    }

    // 4. RE-SUBMISSION REQUESTED
    if (titleLower.includes('re-submission') || textLower.includes('re-submission') || textLower.includes('resubmit')) {
      if (user?.role === 'student') {
        navigate(`/student/tasks?filter=resubmit${extractedTaskTitle ? `&taskTitle=${encodeURIComponent(extractedTaskTitle)}` : ''}`, {
          state: { filter: 'resubmit', taskTitle: extractedTaskTitle }
        });
        return;
      }
    }

    // 5. LEAVE REQUESTS
    if (notifType.includes('leave') || titleLower.includes('leave') || textLower.includes('leave')) {
      if (user?.role === 'student') {
        navigate('/student/leave-application');
      } else {
        navigate('/leave-requests');
      }
      return;
    }

    // 6. BATCH ENROLLMENT / JOIN REQUESTS
    if (notifType.includes('enroll') || titleLower.includes('join') || textLower.includes('join') || titleLower.includes('enroll')) {
      if (user?.role === 'student') {
        navigate('/student/batches');
      } else {
        navigate('/enrollments');
      }
      return;
    }

    // 7. COINS / SHOP / GAMIFICATION
    if (notifType.includes('coin') || titleLower.includes('coin') || titleLower.includes('achievement') || titleLower.includes('badge') || titleLower.includes('reward')) {
      if (user?.role === 'student') {
        navigate('/student/shop');
      } else {
        navigate('/gamification');
      }
      return;
    }

    // 8. CHAT / DIRECT / GROUP / BATCH
    if (notifType.includes('chat') || notifType.includes('message') || titleLower.includes('message') || titleLower.includes('announcement')) {
      navigate(user?.role === 'student' ? '/student/chat' : '/chat');
      return;
    }

    // 9. FRIEND REQUESTS
    if (notifType.includes('friend') || titleLower.includes('friend')) {
      navigate(user?.role === 'student' ? '/student/connections' : '/');
      return;
    }

    // Default fallback
    if (user?.role === 'student') {
      navigate('/student/dashboard');
    } else {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Native Side Notification Stack Engine (Persistent until X clicked, multi-card stacked, glossy frosted blur)
  const showGlossyNotification = useCallback(({
    typeLabel = 'Notification',
    title = '',
    subtitle = '',
    text = '',
    iconLetter = '🔔',
    gradient = 'linear-gradient(135deg, #6366f1, #d946ef)',
    actionText = 'View',
    confirmButtonText,
    onConfirm = null,
    time = new Date(),
    taskId = null,
    taskTitle = '',
    studentName = '',
    submissionId = null,
    type = ''
  }) => {
    if (dndModeRef.current) {
      return;
    }
    const newId = Date.now() + Math.random().toString(36).substring(2, 7);
    const item = {
      id: newId,
      typeLabel,
      title,
      subtitle,
      text,
      iconLetter,
      gradient,
      actionText: actionText || confirmButtonText || '',
      onConfirm,
      time: time || new Date(),
      taskId,
      taskTitle,
      studentName,
      submissionId,
      type
    };

      setToastStack(prev => {
      // Deduplicate if identical title and text already present
      const isDup = prev.some(t => (t.id === newId) || (t.title === title && t.text === text));
      if (isDup) return prev;
      return [item, ...prev];
    });
  }, [user?.role]);

  const removeToast = useCallback((id) => {
    setToastStack(prev => prev.filter(t => t.id !== id));
  }, []);

  const clearAllToasts = useCallback(() => {
    setToastStack([]);
  }, []);

  const handleToastClick = useCallback((toast) => {
    removeToast(toast.id);
    if (typeof toast.onConfirm === 'function') {
      toast.onConfirm();
    } else {
      navigateToNotificationTarget(toast);
    }
  }, [removeToast, navigateToNotificationTarget]);

  const handleToastClose = useCallback((e, toastId) => {
    e.stopPropagation();
    removeToast(toastId);
  }, [removeToast]);

  useEffect(() => {
    notifLengthRef.current = notifications.length;
  }, [notifications.length]);

  // Clear badge when visiting the route
  useEffect(() => {
    const updateSeen = (key, count) => {
      if (count > 0 && seenCounts[key] !== count) {
        setSeenCounts(prev => {
          const next = { ...prev, [key]: count };
          localStorage.setItem('seenBadgeCounts', JSON.stringify(next));
          return next;
        });
      }
    };
    if (location.pathname.startsWith('/student/tasks')) updateSeen('tasks', pendingCount);
    if (location.pathname.startsWith('/student/chat') || location.pathname.startsWith('/chat')) {
      updateSeen('chats', chatCount);
      setChatCount(0);
    }
    if (location.pathname.startsWith('/student/connections')) updateSeen('connections', friendRequestsCount);
    if (location.pathname.startsWith('/reviews')) updateSeen('reviews', pendingCount);
    if (location.pathname.startsWith('/enrollments')) updateSeen('joins', joinsCount);
    if (location.pathname.startsWith('/leaves')) updateSeen('leaves', leavesCount);
  }, [location.pathname, pendingCount, chatCount, joinsCount, leavesCount, seenCounts]);

  // Global Click Sound & Particle Effect Listener
  useEffect(() => {
    const handleGlobalClick = (e) => {
      const isClickable = e.target.closest('button, a, select, input[type="submit"]');
      if (isClickable) {
        soundManager.init(); // Init context if needed
        soundManager.playClick();
      }

      // Dynamic cursor click particle effects
      const activeEffect = gamificationData?.equippedEffect || user?.equippedEffect;
      if (activeEffect) {
        const getEffectParticles = (eff) => {
          switch (eff) {
            case 'sparkles':
              return ['✨', '⭐', '🌟'];
            case 'fire-aura':
              return ['🔥', '💥', '✨'];
            case 'lightning-aura':
              return ['⚡', '🌀', '✨'];
            case 'galaxy-aura':
              return ['🪐', '✨', '☄️'];
            case 'snowstorm':
              return ['❄️', '❄️', '⛄'];
            case 'heartbeat':
              return ['❤️', '💖', '💗', '💘'];
            case 'cyber-grid':
              return ['0', '1', '👾'];
            case 'perfect-attendance-aura':
              return ['👑', '⭐', '✨'];
            default:
              return [];
          }
        };

        const items = getEffectParticles(activeEffect);
        if (items.length > 0) {
          const particleCount = 8;
          for (let i = 0; i < particleCount; i++) {
            const el = document.createElement('span');
            el.className = 'click-particle';
            el.textContent = items[Math.floor(Math.random() * items.length)];

            const angle = Math.random() * Math.PI * 2;
            const distance = 40 + Math.random() * 60;
            const x = Math.cos(angle) * distance;
            const y = Math.sin(angle) * distance;
            const rotate = -180 + Math.random() * 360;
            const fontSize = 10 + Math.random() * 14;

            el.style.left = `${e.clientX}px`;
            el.style.top = `${e.clientY}px`;
            el.style.fontSize = `${fontSize}px`;
            el.style.setProperty('--x', `${x}px`);
            el.style.setProperty('--y', `${y}px`);
            el.style.setProperty('--r', `${rotate}deg`);

            document.body.appendChild(el);
            setTimeout(() => el.remove(), 700);
          }
        }
      }
    };
    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [gamificationData?.equippedEffect, user?.equippedEffect]);

  // Initialize Dark/Light Mode & Close Notifications on Outside Click
  useEffect(() => {
    try {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
        setDarkMode(true);
      } else {
        document.documentElement.classList.remove('dark');
        setDarkMode(false);
      }
    } catch (e) {
      document.documentElement.classList.remove('dark');
      setDarkMode(false);
    }

    const handleClickOutside = (event) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDarkMode = () => {
    if (darkMode) {
      document.documentElement.classList.remove('dark');
      setDarkMode(false);
      try {
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    } else {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
      try {
        localStorage.setItem('theme', 'dark');
      } catch (e) {}
    }
  };

  // Student Attendance Tracking
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const checkingInRef = useRef(false);
  const timerIntervalRef = useRef(null);

  const startSession = async () => {
    if (checkingInRef.current || sessionActive) return;
    checkingInRef.current = true;
    setIsCheckingIn(true);
    try {
      const { data } = await axios.post('/attendance/checkin');
      setAttendanceId(data._id);
      attendanceIdRef.current = data._id;
      setSessionActive(true);
      localStorage.setItem('sessionActive', 'true');
      await syncAttendanceSession();
    } catch (error) {
      console.error('Checkin failed:', error);
      Swal.fire({
        title: 'Check-in Failed',
        text: error.response?.data?.message || 'Unable to check in at this time.',
        icon: 'error',
        confirmButtonText: 'Understood'
      });
    } finally {
      checkingInRef.current = false;
      setIsCheckingIn(false);
    }
  };

  useEffect(() => {
    if (sessionActive) {
      if (!timerIntervalRef.current) {
        let lastTick = Date.now();
        timerIntervalRef.current = setInterval(() => {
          const now = Date.now();
          const delta = Math.floor((now - lastTick) / 1000);
          if (delta > 0) {
            setSessionSeconds(prev => prev + delta);
            if (currentAccessTypeRef.current === 'wfh') {
              setWfhSeconds(prev => prev + delta);
            } else {
              setOnsiteSeconds(prev => prev + delta);
            }
            lastTick += delta * 1000;
          }
        }, 1000);
      }
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [sessionActive]);

  // Sync attendance session and active leave state (run on mount & checked state updates)
  const syncAttendanceSession = useCallback(async () => {
    if (!user || user.role !== 'student') return;
    try {
      try {
        const { data: leaveData } = await axios.get('/leaves/active-status');
        setActiveLeaveStatus({ isOnLeave: leaveData.isOnLeave, message: leaveData.message });
      } catch (leaveErr) {
        console.error('Failed to fetch active leave status:', leaveErr);
      }

      // Restore today's attendance session state and current check-in access mode
      const [summarySettled, accessSettled] = await Promise.allSettled([
        axios.get('/attendance/my-summary'),
        axios.get('/checkin-access/my-status')
      ]);

      if (summarySettled.status !== 'fulfilled') {
        throw summarySettled.reason || new Error('Attendance summary fetch failed');
      }
      syncRetryCountRef.current = 0;

      const summaryRes = summarySettled.value;
      const accessRes = accessSettled.status === 'fulfilled' ? accessSettled.value : null;

      const todayStr = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      const todayRecords = (summaryRes.data || []).filter(r => {
        const rDate = r.date || (r.firstCheckIn ? new Date(r.firstCheckIn).toISOString().split('T')[0] : '');
        return rDate === todayStr;
      });

      const resolvedAccess = accessRes?.data ? accessRes.data : checkInAccess;
      const grantedAccessType = resolvedAccess?.hasAccess ? resolvedAccess.accessType : null;
      if (accessRes?.data) {
        setCheckInAccess(accessRes.data);
      }

      if (todayRecords.length > 0) {
        let activeRecord = todayRecords.find(r => r.isActive);
        if (activeRecord && grantedAccessType && activeRecord.accessType !== grantedAccessType) {
          try {
            await axios.post('/attendance/checkin');
            const refreshedSummary = await axios.get('/attendance/my-summary');
            const refreshedToday = (refreshedSummary.data || []).filter(r => {
              const rDate = r.date || (r.firstCheckIn ? new Date(r.firstCheckIn).toISOString().split('T')[0] : '');
              return rDate === todayStr;
            });
            if (refreshedToday.length > 0) {
              todayRecords.splice(0, todayRecords.length, ...refreshedToday);
              activeRecord = todayRecords.find(r => r.isActive);
            }
          } catch (switchErr) {
            console.warn('Auto mode switch skipped:', switchErr?.response?.data?.message || switchErr.message);
          }
        }
        const primaryRecord = activeRecord || todayRecords[0];

        // Capture previous session state BEFORE updating refs so initial mount/refresh always syncs!
        const prevAttendanceId = attendanceIdRef.current;
        const wasSessionActive = sessionSecondsRef.current > 0 || prevAttendanceId !== null;

        // /attendance/my-summary already includes active session elapsed seconds in onsiteSeconds & wfhSeconds
        const baseOnsite = primaryRecord.onsiteSeconds || 0;
        const baseWfh = primaryRecord.wfhSeconds || 0;

        if (activeRecord) {
          setSessionActive(true);
          setAttendanceId(activeRecord._id);
          attendanceIdRef.current = activeRecord._id;
        } else {
          setSessionActive(false);
          setAttendanceId(null);
          attendanceIdRef.current = null;
          localStorage.removeItem('sessionActive');
        }

        const activeMode = activeRecord
          ? (activeRecord.accessType || 'on-site')
          : (grantedAccessType || primaryRecord?.accessType || 'on-site');
        const targetSessionSeconds = activeMode === 'wfh' ? baseWfh : baseOnsite;
        const isSameActiveSession = Boolean(wasSessionActive && activeRecord && prevAttendanceId === activeRecord._id && currentAccessTypeRef.current === activeMode);
        const withinJitter = Math.abs(targetSessionSeconds - sessionSecondsRef.current) <= 5;

        if (!isSameActiveSession || !withinJitter || (sessionSecondsRef.current === 0 && targetSessionSeconds > 0)) {
          setOnsiteSeconds(baseOnsite);
          setWfhSeconds(baseWfh);
          setSessionSeconds(targetSessionSeconds);
        }
        setCurrentAccessType(activeMode);

        const nextLimits = {
          onsiteMinHours: primaryRecord.onsiteMinHours,
          onsiteMaxHours: primaryRecord.onsiteMaxHours,
          wfhMinHours: primaryRecord.wfhMinHours,
          wfhMaxHours: primaryRecord.wfhMaxHours,
          onsiteAllocated: Boolean(primaryRecord.onsiteAllocated || baseOnsite > 0),
          wfhAllocated: Boolean(primaryRecord.wfhAllocated || baseWfh > 0)
        };
        setAttendanceLimits(nextLimits);

        try {
          sessionStorage.setItem(`ssms_student_session_${user._id}_${todayStr}`, JSON.stringify({
            onsiteSeconds: baseOnsite,
            wfhSeconds: baseWfh,
            sessionSeconds: targetSessionSeconds,
            currentAccessType: activeMode,
            checkInAccess: resolvedAccess,
            attendanceLimits: nextLimits
          }));
        } catch {}
      } else {
        setSessionActive(false);
        setAttendanceId(null);
        attendanceIdRef.current = null;
        setSessionSeconds(0);
        setOnsiteSeconds(0);
        setWfhSeconds(0);
        setCurrentAccessType(grantedAccessType || 'on-site');
        try {
          sessionStorage.setItem(`ssms_student_session_${user._id}_${todayStr}`, JSON.stringify({
            onsiteSeconds: 0,
            wfhSeconds: 0,
            sessionSeconds: 0,
            currentAccessType: grantedAccessType || 'on-site',
            checkInAccess: resolvedAccess
          }));
        } catch {}
      }
      setAttendanceSynced(true);
      setIsSyncing(false);
    } catch (attErr) {
      console.error('Failed to restore attendance session:', attErr);
      if (syncRetryCountRef.current < 2) {
        syncRetryCountRef.current += 1;
        setTimeout(() => {
          syncAttendanceSession();
        }, 1500);
      } else {
        setIsSyncing(false);
      }
    }
  }, [user]);

  // Fetch pending notifications count – extracted to component scope so child pages can call it
  const fetchCounts = useCallback(async () => {
    try {
      const batchParam = selectedBatchId ? `?batchId=${selectedBatchId}` : '';
      const { data: onlineData } = await axios.get(`/attendance/active-count${batchParam}`);
      setOnlineStudentsCount(onlineData.activeCount || 0);

      const currentCleared = getPersistedClearedNotifs();

      if (user?.role === 'admin' || user?.role === 'mentor') {
        const [dashboardRes, gamificationRes] = await Promise.all([
          axios.get('/analytics/dashboard'),
          axios.get('/gamification/status').catch(e => ({ data: {} }))
        ]);
        const data = dashboardRes.data;
        const gamification = gamificationRes.data;

        setPendingCount(data.pendingReviews || 0);
        setLeavesCount(data.pendingLeavesCount || 0);
        setJoinsCount(data.joinRequestsCount || 0);
        setChatCount(data.recentChats || 0);

        const seenIds = new Set();
        const newNotifs = (data.notifications || []).filter(n => {
          if (!n || !n.id || seenIds.has(n.id) || currentCleared.includes(n.id)) return false;
          seenIds.add(n.id);
          return true;
        });

        if (knownNotifIdsRef.current === null) {
          knownNotifIdsRef.current = new Set(newNotifs.map(n => n.id));
        } else {
          const brandNew = newNotifs.filter(n => !knownNotifIdsRef.current.has(n.id));
          brandNew.forEach(n => knownNotifIdsRef.current.add(n.id));

          if (brandNew.length > 0) {
            playNotifSound();
            brandNew.slice(0, 4).forEach((item) => {
              showGlossyNotification({
                typeLabel: item.type === 'submission' ? 'New Submission' : item.type === 'task' ? 'Task Notification' : item.type === 'leave' ? 'Leave Request' : item.type === 'grade' ? 'Academic Update' : 'Academic Alert',
                title: item.title || 'Notification',
                subtitle: item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                text: item.message || item.text || '',
                iconLetter: item.type === 'submission' ? '📤' : item.type === 'task' ? '📋' : item.type === 'leave' ? '🏖️' : item.type === 'grade' ? '📝' : '🔔',
                gradient: item.type === 'submission' 
                  ? 'linear-gradient(135deg, #8b5cf6, #d946ef)' 
                  : item.type === 'task' 
                    ? 'linear-gradient(135deg, #6366f1, #3b82f6)' 
                    : item.type === 'leave'
                      ? 'linear-gradient(135deg, #f59e0b, #ef4444)'
                      : 'linear-gradient(135deg, #6366f1, #a855f7)',
                actionText: 'View',
                taskId: item.taskId,
                taskTitle: item.taskTitle,
                studentName: item.studentName,
                submissionId: item.submissionId,
                type: item.type,
                onConfirm: () => navigateToNotificationTarget(item)
              });
            });
          }
        }

        setNotifications(newNotifs);
        setUserCoins(gamification.coins || 0);
        setGamificationData(gamification);
      } else if (user?.role === 'student') {
        const [analyticsSettled, gamificationSettled, friendsSettled] = await Promise.allSettled([
          axios.get(`/analytics/student/${user._id}?mini=true`),
          axios.get('/gamification/status'),
          axios.get('/gamification/friends')
        ]);
        const data = analyticsSettled.status === 'fulfilled' ? analyticsSettled.value.data : null;
        const gamification = gamificationSettled.status === 'fulfilled' ? gamificationSettled.value.data : null;
        const friendsData = friendsSettled.status === 'fulfilled' ? friendsSettled.value.data : null;

        if (data) {
          setPendingCount(data.pendingTasks || 0);
          setChatCount(data.recentChats || 0);
        }
        if (friendsData) {
          setFriendRequestsCount(friendsData?.pendingIncoming?.length || 0);
        }
        if (gamification) {
          const coinsVal = gamification.coins || 0;
          setUserCoins(coinsVal);
          setCoinsLoaded(true);
          setGamificationData(gamification);
          try { sessionStorage.setItem(`ssms_coins_${user._id}`, String(coinsVal)); } catch {}
        }

        const seenIds = new Set();
        const newNotifs = ((data && data.notifications) || []).filter(n => {
          if (!n || !n.id || seenIds.has(n.id) || currentCleared.includes(n.id)) return false;
          seenIds.add(n.id);
          return true;
        });

        if (knownNotifIdsRef.current === null) {
          knownNotifIdsRef.current = new Set(newNotifs.map(n => n.id));
        } else {
          const brandNew = newNotifs.filter(n => !knownNotifIdsRef.current.has(n.id));
          brandNew.forEach(n => knownNotifIdsRef.current.add(n.id));

          if (brandNew.length > 0) {
            playNotifSound();
            brandNew.slice(0, 4).forEach((item) => {
              showGlossyNotification({
                typeLabel: item.type === 'task' ? 'New Task' : item.type === 'grade' ? 'Task Graded' : 'Academic Alert',
                title: item.title || 'Notification',
                subtitle: item.time ? new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
                text: item.message || item.text || '',
                iconLetter: item.type === 'task' ? '📋' : item.type === 'grade' ? '📝' : '🔔',
                gradient: item.type === 'grade' ? 'linear-gradient(135deg, #10b981, #059669)' : 'linear-gradient(135deg, #6366f1, #3b82f6)',
                actionText: 'View',
                taskId: item.taskId,
                taskTitle: item.taskTitle,
                submissionId: item.submissionId,
                type: item.type,
                onConfirm: () => navigateToNotificationTarget(item)
              });
            });
          }
        }

        setNotifications(newNotifs);
      }
    } catch (e) {
      console.error('Failed to fetch counts');
    }
  }, [user, selectedBatchId, getPersistedClearedNotifs]);

  useEffect(() => {
    if (user) {
      fetchCounts();
      syncAttendanceSession();
      
      let intervalId;
      const startInterval = (ms) => {
        if (intervalId) clearInterval(intervalId);
        intervalId = setInterval(fetchCounts, ms);
      };

      // Default active polling: 30 seconds
      startInterval(30000);

      const handleVisibilityChange = () => {
        if (document.hidden) {
          // Throttle background polling to 3 minutes to optimize free backend nodes
          startInterval(180000);
        } else {
          // Resume normal 30s polling on tab focus
          fetchCounts();
          startInterval(30000);
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);

      return () => {
        if (intervalId) clearInterval(intervalId);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
    }
  }, [user, fetchCounts, syncAttendanceSession]); // Re-fetch or clear if user changes

  // Listen for real-time administrator force-checkout and access restriction events
  useEffect(() => {
    if (socket && user?.role === 'student') {
      const handleForceCheckout = (data) => {
        console.log('Force-checkout event received via socket:', data);
        setSessionActive(false);
        setAttendanceId(null);
        attendanceIdRef.current = null;
        localStorage.removeItem('sessionActive');
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
        Swal.fire({
          icon: 'warning',
          title: 'Session Checked Out',
          text: data?.reason ? `Your session was ended: ${data.reason}` : 'Your active attendance session has been ended by the mentor/administrator.',
          confirmButtonColor: '#f97316'
        });
      };

      const handleAccessRestricted = (data) => {
        setSessionActive(false);
        setAttendanceId(null);
        attendanceIdRef.current = null;
        localStorage.removeItem('sessionActive');
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        const isSuspension = data.action === 'suspend';
        const untilStr = data.suspendedUntil ? new Date(data.suspendedUntil).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '';

        Swal.fire({
          icon: isSuspension ? 'warning' : 'error',
          title: isSuspension ? '⏳ Panel Access Suspended' : '⛔ Panel Access Blocked',
          html: `
            <div class="text-left text-sm space-y-2.5">
              <p class="text-slate-700 dark:text-slate-300">Your access to the student management panel has been <strong>${isSuspension ? 'temporarily suspended' : 'blocked'}</strong> by your ${data.by || 'mentor'}.</p>
              ${isSuspension && untilStr ? `
                <div class="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1">
                  <p class="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Suspension Lifts At:</p>
                  <p class="text-xs font-mono font-black text-amber-900 dark:text-amber-200">${untilStr}</p>
                </div>
              ` : ''}
              ${data.reason ? `
                <div class="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 font-medium">
                  <strong>Reason:</strong> ${data.reason}
                </div>
              ` : ''}
              <p class="text-xs text-slate-500">You will be logged out of the session now.</p>
            </div>
          `,
          confirmButtonColor: isSuspension ? '#f59e0b' : '#ef4444',
          confirmButtonText: 'Log Out',
          allowOutsideClick: false,
          allowEscapeKey: false
        }).then(() => {
          logout();
          navigate('/login');
        });
      };

      const handleAccessRestored = (data) => {
        soundManager.playSuccess();
        showGlossyNotification({
          typeLabel: 'Access Restored',
          title: 'Panel Access Restored',
          subtitle: 'Status: Active',
          text: data?.message || 'Your student panel access has been restored!',
          iconLetter: '✅',
          gradient: 'linear-gradient(135deg, #10b981, #059669)',
          confirmButtonText: 'Great!',
          timer: 6000
        });
      };

      socket.on('force-checkout', handleForceCheckout);
      socket.on('account-access-restricted', handleAccessRestricted);
      socket.on('account-access-restored', handleAccessRestored);

      return () => {
        socket.off('force-checkout', handleForceCheckout);
        socket.off('account-access-restricted', handleAccessRestricted);
        socket.off('account-access-restored', handleAccessRestored);
      };
    }
  }, [socket, user, logout, navigate, showGlossyNotification]);

  // Real-time Messaging, Announcements & Social Notifications (WhatsApp-style Top-Right Popup)
  useEffect(() => {
    if (!socket || !user) return;

    const chatPath = user.role === 'student' ? '/student/chat' : '/chat';

    const handleDirectMessageNotif = (data) => {
      soundManager.playWhatsAppIncoming();
      setChatCount(prev => prev + 1);

      if (!location.pathname.includes('/chat')) {
        showGlossyNotification({
          typeLabel: 'Direct Message',
          title: data.senderName,
          text: data.text,
          iconLetter: (data.senderName || 'U').charAt(0).toUpperCase(),
          gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          confirmButtonText: 'Reply 💬',
          timer: false,
          onConfirm: () => navigate(chatPath)
        });
      }
    };

    const handleGroupMessageNotif = (data) => {
      soundManager.playWhatsAppIncoming();
      setChatCount(prev => prev + 1);

      if (!location.pathname.includes('/chat')) {
        showGlossyNotification({
          typeLabel: 'Group Chat',
          title: data.groupName || 'Chat Group',
          subtitle: `Sent by ${data.senderName}`,
          text: data.text,
          iconLetter: (data.groupName || 'G').charAt(0).toUpperCase(),
          gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
          confirmButtonText: 'Reply 💬',
          timer: false,
          onConfirm: () => navigate(chatPath)
        });
      }
    };

    const handleBatchMessageNotif = (data) => {
      soundManager.playWhatsAppIncoming();
      setChatCount(prev => prev + 1);

      if (!location.pathname.includes('/chat')) {
        showGlossyNotification({
          typeLabel: 'Batch Channel',
          title: data.batchName || 'Academic Batch',
          subtitle: `Sent by ${data.senderName}`,
          text: data.text,
          iconLetter: '#',
          gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
          confirmButtonText: 'Open Chat 💬',
          timer: false,
          onConfirm: () => navigate(chatPath)
        });
      }
    };

    const handleAnnouncementNotif = (data) => {
      playNotifSound();
      showGlossyNotification({
        typeLabel: 'Announcement',
        title: data.title ? `📢 ${data.title}` : '📢 Broadcast Announcement',
        subtitle: data.senderName ? `By ${data.senderName}` : 'Academic Announcement',
        text: data.text,
        iconLetter: '📢',
        gradient: 'linear-gradient(135deg, #f59e0b, #ef4444)',
        confirmButtonText: 'View Chat 💬',
        timer: 8000,
        onConfirm: () => navigate(chatPath)
      });
    };

    const handleFriendRequestReceived = (data) => {
      setFriendRequestsCount(prev => prev + 1);
      playNotifSound();
      showGlossyNotification({
        typeLabel: 'Friend Request',
        title: data.requester.name,
        subtitle: data.requester.rollNumber ? `Roll: ${data.requester.rollNumber}` : 'Student Connection',
        text: 'Sent you a friend request. Accept in Connections or Chat to unlock private messaging!',
        iconLetter: '🤝',
        gradient: 'linear-gradient(135deg, #3b82f6, #10b981)',
        confirmButtonText: 'View Request 🤝',
        timer: 8000,
        onConfirm: () => navigate(user?.role === 'student' ? '/student/connections' : '/')
      });
    };

    const handleFriendRequestAccepted = (data) => {
      soundManager.playSuccess();
      setFriendRequestsCount(prev => Math.max(0, prev - 1));
      showGlossyNotification({
        typeLabel: 'Friend Connected',
        title: data.friend.name,
        subtitle: 'Connection Accepted',
        text: `You and ${data.friend.name} are now friends! 1-on-1 private messaging and coin sharing are now unlocked.`,
        iconLetter: '🎉',
        gradient: 'linear-gradient(135deg, #10b981, #06b6d4)',
        confirmButtonText: 'Message Friend 💬',
        timer: 8000,
        onConfirm: () => navigate(chatPath)
      });
    };

    const handleCoinsReceived = (data) => {
      soundManager.playReward();
      if (typeof data.newCoins === 'number') {
        setUserCoins(data.newCoins);
      } else if (typeof data.amount === 'number') {
        setUserCoins(prev => prev + data.amount);
      }
      showGlossyNotification({
        typeLabel: 'Coins Received',
        title: `+${data.amount} Coins 🪙`,
        subtitle: data.sender?.name || 'SSMS Rewards',
        text: data.reason || `${data.sender?.name || 'A friend'} shared ${data.amount} gamification coins with you!`,
        iconLetter: '🪙',
        gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
        confirmButtonText: user?.role === 'student' ? 'Shop Rewards 🛍️' : 'View Coins',
        timer: 7000,
        onConfirm: () => navigate(user?.role === 'student' ? '/student/shop' : '/gamification')
      });
    };

    const handleNewTaskAssigned = (data) => {
      playNotifSound();
      fetchCounts();
      showGlossyNotification({
        typeLabel: 'New Task Assigned',
        title: data?.title || 'Academic Task Assigned',
        subtitle: data?.batchName || 'Your Batch',
        text: data?.title ? `"${data.title}" has been published! Complete it to earn 10x marks in coins.` : 'A new task has been assigned to your batch.',
        iconLetter: '📋',
        gradient: 'linear-gradient(135deg, #6366f1, #3b82f6)',
        actionText: 'View Task',
        taskId: data?._id || data?.taskId,
        taskTitle: data?.title,
        type: 'task',
        onConfirm: () => navigateToNotificationTarget({
          type: 'task',
          title: data?.title || 'New Task Assigned',
          text: data?.title || '',
          taskId: data?._id || data?.taskId,
          taskTitle: data?.title
        })
      });
    };

    const handleTaskGraded = (data) => {
      playNotifSound();
      fetchCounts();
      showGlossyNotification({
        typeLabel: 'Task Graded',
        title: data?.title || 'Task Reviewed',
        subtitle: data?.marksObtained !== undefined ? `Score: ${data.marksObtained} / ${data.maxMarks || 100}` : 'Evaluated by Mentor',
        text: data?.title ? `Your submission for "${data.title}" was reviewed by your mentor!` : 'Your task submission was reviewed.',
        iconLetter: '✅',
        gradient: 'linear-gradient(135deg, #10b981, #059669)',
        actionText: 'View Grades',
        taskId: data?.taskId,
        taskTitle: data?.title,
        type: 'grade',
        onConfirm: () => navigateToNotificationTarget({
          type: 'grade',
          title: data?.title || 'Task Graded',
          taskId: data?.taskId
        })
      });
    };

    socket.on('new-direct-message-notification', handleDirectMessageNotif);
    socket.on('new-group-message-notification', handleGroupMessageNotif);
    socket.on('new-batch-message-notification', handleBatchMessageNotif);
    socket.on('announcement-broadcast', handleAnnouncementNotif);
    socket.on('friend-request-received', handleFriendRequestReceived);
    socket.on('friend-request-accepted', handleFriendRequestAccepted);
    socket.on('coins-received', handleCoinsReceived);
    socket.on('new-task-assigned', handleNewTaskAssigned);
    socket.on('task-graded', handleTaskGraded);

    const handleCheckInAccessUpdated = () => {
      syncAttendanceSession();
    };
    socket.on('checkin-access-updated', handleCheckInAccessUpdated);

    return () => {
      socket.off('new-direct-message-notification', handleDirectMessageNotif);
      socket.off('new-group-message-notification', handleGroupMessageNotif);
      socket.off('new-batch-message-notification', handleBatchMessageNotif);
      socket.off('announcement-broadcast', handleAnnouncementNotif);
      socket.off('friend-request-received', handleFriendRequestReceived);
      socket.off('friend-request-accepted', handleFriendRequestAccepted);
      socket.off('coins-received', handleCoinsReceived);
      socket.off('new-task-assigned', handleNewTaskAssigned);
      socket.off('task-graded', handleTaskGraded);
      socket.off('checkin-access-updated', handleCheckInAccessUpdated);
    };
  }, [socket, user, location.pathname, navigate, fetchCounts]);



  const endSession = async (overrideSeconds) => {
    if (checkingInRef.current) return;
    if (user?.role === 'student' && attendanceIdRef.current) {
      checkingInRef.current = true;
      setIsCheckingIn(true);
      try {
        const finalSeconds = typeof overrideSeconds === 'number' ? overrideSeconds : sessionSecondsRef.current;
        await axios.post(`/attendance/checkout/${attendanceIdRef.current}`, {
          totalSeconds: finalSeconds
        });
        
        setSessionActive(false);
        setAttendanceId(null);
        attendanceIdRef.current = null;
        localStorage.removeItem('sessionActive');

        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }

        // Fetch fresh aggregated total
        try {
          await syncAttendanceSession();
        } catch (e) { console.error('Failed to sync summary:', e); }

        Swal.fire({
          icon: 'success',
          title: 'Checked Out Successfully',
          text: 'Have a great day! Your attendance session has been ended.',
          confirmButtonColor: '#10b981',
          timer: 3500
        });

      } catch (e) {
        console.error('Checkout failed:', e);
        Swal.fire({
          icon: 'error',
          title: 'Check-out Failed',
          text: e.response?.data?.message || 'Unable to check out. Please verify your internet connection and try again.',
          confirmButtonColor: '#ef4444'
        });
      } finally {
        checkingInRef.current = false;
        setIsCheckingIn(false);
      }
    } else {
      setSessionActive(false);
      localStorage.removeItem('sessionActive');
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      Swal.fire({
        icon: 'warning',
        title: 'Check-out Resynced',
        text: 'The active session could not be verified on the server, but your local session has been cleared.',
        confirmButtonColor: '#f59e0b'
      });
    }
  };

  const handleLogout = async () => {
    if (sessionActive) {
      Swal.fire({
        icon: 'warning',
        title: 'Please Check Out First',
        text: 'You must check out from your current attendance session before logging out.',
        confirmButtonColor: '#10b981'
      });
      return;
    }

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    localStorage.removeItem('sessionActive');
    localStorage.removeItem('attendanceId');
    await logout();
    navigate('/login');
  };

  const formatTime = (totalSeconds) => {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const clearNotification = (id) => {
    const currentCleared = getPersistedClearedNotifs();
    const updatedCleared = Array.from(new Set([...currentCleared, id]));
    setClearedNotifs(updatedCleared);
    localStorage.setItem(getClearedNotifsKey(), JSON.stringify(updatedCleared));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAllNotifications = () => {
    const currentCleared = getPersistedClearedNotifs();
    const allIds = notifications.map(n => n.id);
    const updatedCleared = Array.from(new Set([...currentCleared, ...allIds]));
    setClearedNotifs(updatedCleared);
    localStorage.setItem(getClearedNotifsKey(), JSON.stringify(updatedCleared));
    setNotifications([]);
    setShowNotifications(false);
  };

  const getBadge = (key, count) => {
    if (key === 'chats' && (location.pathname.startsWith('/chat') || location.pathname.startsWith('/student/chat'))) {
      return 0;
    }
    if (!count || count <= 0) return 0;
    const seen = seenCounts[key] || 0;
    return count > seen ? (count - seen) : 0;
  };

  const adminSections = [
    {
      label: 'Overview',
      links: [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
        { name: 'Portal Directory & Links', path: '/portals', icon: <Share2 size={20} /> },
        { name: 'Traffic Control', path: '/traffic', icon: <Network size={20} /> },
      ]
    },
    {
      label: 'Academic',
      links: [
        { name: 'Task Management', path: '/tasks', icon: <FileText size={20} /> },
        { name: 'Review Submissions', path: '/reviews', icon: <CheckCircle size={20} />, badge: getBadge('reviews', pendingCount) },
        { name: 'LeetCode Challenges', path: '/leetcode', icon: <Code size={20} /> },
        { name: 'Mock Drives', path: '/mock-drives', icon: <Briefcase size={20} /> },
        { name: 'Leaderboard', path: '/student/leaderboard', icon: <Trophy size={20} /> },
        { name: 'Study Notes', path: '/admin/notes', icon: <BookOpen size={20} /> },
        { name: 'Syllabus Tracker', path: '/syllabus-tracker', icon: <BookOpen size={20} /> },
      ]
    },
    {
      label: 'Management',
      links: [
        { name: 'Mentor Management', path: '/mentors', icon: <UserCheck size={20} /> },
        { name: 'Batch & Student Setup', path: '/batches', icon: <BookOpen size={20} /> },
        { name: 'Student Directory', path: '/students', icon: <Users size={20} /> },
        { name: 'Task Tracker', path: '/batch-tracker', icon: <BookOpen size={20} /> },
        { name: 'Gamification Shop Management', path: '/admin/gamification', icon: <Gamepad2 size={20} /> },
        { name: 'Gamification Hub (Free)', path: '/student/wardrobe', icon: <Gamepad2 size={20} /> },
      ]
    },
    {
      label: 'Operations',
      links: [
        { name: 'Attendance', path: '/attendance-logs', icon: <Clock size={20} /> },
        { name: 'Classroom Attendance', path: '/classroom-attendance', icon: <Users size={20} /> },
        { name: 'Check-In Permissions', path: '/checkin-permissions', icon: <ShieldCheck size={20} /> },
        { name: 'Attendance Tracker', path: '/attendance-tracker', icon: <Clock size={20} /> },
        { name: 'Performance Reports', path: '/performance-reports', icon: <BarChart3 size={20} /> },
        { name: 'Leave Requests', path: '/leaves', icon: <Calendar size={20} />, badge: getBadge('leaves', leavesCount) },
        { name: 'Batch Chat', path: '/chat', icon: <MessageCircle size={20} />, badge: getBadge('chats', chatCount) },
        { name: 'Activity Logs', path: '/activity-logs', icon: <Activity size={20} /> },
        { name: 'Access & Suspensions', path: '/access-logs', icon: <ShieldAlert size={20} /> },
      ]
    },
    {
      label: 'Account',
      links: [
        { name: 'Admin Profile', path: '/profile', icon: <UserIcon size={20} /> },
      ]
    }
  ];

  const mentorSections = [
    {
      label: 'Overview',
      links: [
        { name: 'Dashboard', path: '/', icon: <LayoutDashboard size={20} /> },
      ]
    },
    {
      label: 'Academic',
      links: [
        { name: 'Task Management', path: '/tasks', icon: <FileText size={20} /> },
        { name: 'Review Submissions', path: '/reviews', icon: <CheckCircle size={20} />, badge: getBadge('reviews', pendingCount) },
        { name: 'LeetCode Challenges', path: '/leetcode', icon: <Code size={20} /> },
        { name: 'Mock Drives', path: '/mock-drives', icon: <Briefcase size={20} /> },
        { name: 'Leaderboard', path: '/student/leaderboard', icon: <Trophy size={20} /> },
        { name: 'Study Notes', path: '/admin/notes', icon: <BookOpen size={20} /> },
        { name: 'Syllabus Tracker', path: '/syllabus-tracker', icon: <BookOpen size={20} /> },
      ]
    },
    {
      label: 'Management',
      links: [
        { name: 'My Assigned Batches', path: '/batches', icon: <BookOpen size={20} /> },
        { name: 'Batch Students', path: '/students', icon: <Users size={20} /> },
        { name: 'Task Tracker', path: '/batch-tracker', icon: <BookOpen size={20} /> },
        { name: 'Gamification Hub (Free)', path: '/student/wardrobe', icon: <Gamepad2 size={20} /> },
      ]
    },
    {
      label: 'Operations',
      links: [
        { name: 'Attendance Logs', path: '/attendance-logs', icon: <Clock size={20} /> },
        { name: 'Classroom Attendance', path: '/classroom-attendance', icon: <Users size={20} /> },
        { name: 'Check-In Permissions', path: '/checkin-permissions', icon: <ShieldCheck size={20} /> },
        { name: 'Attendance Tracker', path: '/attendance-tracker', icon: <Clock size={20} /> },
        { name: 'Performance Reports', path: '/performance-reports', icon: <BarChart3 size={20} /> },
        { name: 'Leave Requests', path: '/leaves', icon: <Calendar size={20} />, badge: getBadge('leaves', leavesCount) },
        { name: 'Batch Chat', path: '/chat', icon: <MessageCircle size={20} />, badge: getBadge('chats', chatCount) },
        { name: 'Activity Logs', path: '/activity-logs', icon: <Activity size={20} /> },
        { name: 'Access & Suspensions', path: '/access-logs', icon: <ShieldAlert size={20} /> },
      ]
    },
    {
      label: 'Account',
      links: [
        { name: 'Mentor Profile', path: '/profile', icon: <UserIcon size={20} /> },
      ]
    }
  ];

  const studentSections = [
    {
      label: 'Main',
      links: [
        { name: 'Dashboard', path: '/student', icon: <LayoutDashboard size={20} /> },
        { name: 'Gamification Hub', path: '/student/wardrobe', icon: <Gamepad2 size={20} /> },
      ]
    },
    {
      label: 'Learning',
      links: [
        { name: 'My Tasks', path: '/student/tasks', icon: <FileText size={20} />, badge: getBadge('tasks', pendingCount) },
        { name: 'LeetCode', path: '/student/leetcode', icon: <Code size={20} /> },
        { name: 'My Notes', path: '/student/notes', icon: <BookOpen size={20} /> },
        { name: 'Syllabus Tracker', path: '/student/syllabus', icon: <BookOpen size={20} /> },
      ]
    },
    {
      label: 'Performance',
      links: [
        { name: 'My Performance Reports', path: '/student/reports', icon: <BarChart3 size={20} /> },
        { name: 'My Grades', path: '/student/grades', icon: <CheckCircle size={20} /> },
        { name: 'Mock Drives', path: '/student/grades?tab=mockDrives', icon: <Briefcase size={20} /> },
        { name: 'Leaderboard', path: '/student/leaderboard', icon: <Trophy size={20} /> },
        { name: 'Attendance Tracker', path: '/attendance-tracker', icon: <Clock size={20} /> },
      ]
    },
    {
      label: 'Batches & Chat',
      links: [
        { name: 'My Batches', path: '/student/my-batches', icon: <Users size={20} /> },
        { name: 'Friend Connections', path: '/student/connections', icon: <UserCheck size={20} />, badge: getBadge('connections', friendRequestsCount) },
        { name: 'Batch Chat', path: '/student/chat', icon: <MessageCircle size={20} />, badge: getBadge('chats', chatCount) },
      ]
    },
    {
      label: 'Account',
      links: [
        { name: 'Login Activity', path: '/student/attendance', icon: <Clock size={20} /> },
        { name: 'Leave Application', path: '/student/leaves', icon: <Calendar size={20} /> },
        { name: 'Disciplinary Records', path: '/student/disciplinary', icon: <ShieldAlert size={20} /> },
        { name: 'My Profile', path: '/student/profile', icon: <UserIcon size={20} /> },
      ]
    }
  ];

  const sections = user?.role === 'admin' ? adminSections : (user?.role === 'mentor' ? mentorSections : studentSections);

  // Active page title for the frozen top bar header
  const activeLink = sections?.flatMap(s => s.links).find(link => {
    if (link.path.includes('?')) {
      return location.pathname === link.path.split('?')[0] && location.search.includes(link.path.split('?')[1]);
    }
    return location.pathname === link.path || (link.path !== '/' && link.path !== '/student' && location.pathname.startsWith(link.path));
  });
  const activePageTitle = activeLink?.name || (user?.role === 'admin' ? 'Dashboard' : (user?.role === 'mentor' ? 'Dashboard' : 'Dashboard'));

  // Auto-expand section containing the active path on mount and navigation
  useEffect(() => {
    if (!sections) return;
    const activeSection = sections.find(section => 
      section.links.some(link => 
        location.pathname === link.path || 
        (link.path !== '/' && link.path !== '/student' && location.pathname.startsWith(link.path))
      )
    );
    if (activeSection) {
      setExpandedSections(prev => {
        if (prev[activeSection.label]) return prev;
        const updated = { ...prev, [activeSection.label]: true };
        try {
          localStorage.setItem('expandedSections', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
      setPinnedSections(prev => {
        if (prev[activeSection.label]) return prev;
        const updated = { ...prev, [activeSection.label]: true };
        try {
          localStorage.setItem('pinnedSections', JSON.stringify(updated));
        } catch (e) {}
        return updated;
      });
    }
  }, [location.pathname, sections]);

  // Student Panel Laptop-Only Restriction
  const [isStudentMobile, setIsStudentMobile] = useState(() => {
    if (typeof window === 'undefined' || user?.role !== 'student') return false;
    const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
    return isMobileUA || window.innerWidth < 1024;
  });

  useEffect(() => {
    if (user?.role !== 'student') return;
    const checkViewport = () => {
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      setIsStudentMobile(isMobileUA || window.innerWidth < 1024);
    };
    checkViewport();
    window.addEventListener('resize', checkViewport);
    window.addEventListener('orientationchange', checkViewport);
    return () => {
      window.removeEventListener('resize', checkViewport);
      window.removeEventListener('orientationchange', checkViewport);
    };
  }, [user?.role]);

  if (user?.role === 'student' && isStudentMobile) {
    return <StudentMobileBlocker onLogout={logout} />;
  }

  return (
    <div className={`transition-colors duration-500 flex bg-transparent relative ${location.pathname.includes('/chat') ? 'h-screen overflow-hidden' : 'min-h-screen'}`}>
      {/* Premium Theme Card Shimmer & Legibility Style Overrides */}
      {['Amber', 'Cyber', 'Crimson', 'Mint'].includes(themeColor) && (() => {
        let cardBgDark, cardBgLight, borderColor, borderColorLight, shimmerColor, highlightDark, highlightLight, glassBgDark, glassBgLight, buttonGradient, glowShadow;
        
        if (themeColor === 'Amber') {
          cardBgDark = 'linear-gradient(135deg, rgba(24, 16, 4, 0.8) 0%, rgba(13, 8, 2, 0.9) 100%)';
          cardBgLight = 'linear-gradient(135deg, rgba(255, 252, 245, 0.9) 0%, rgba(254, 243, 205, 0.8) 100%)';
          borderColor = 'rgba(245, 158, 11, 0.3)';
          borderColorLight = 'rgba(217, 119, 6, 0.35)';
          shimmerColor = 'rgba(251, 191, 36, 0.2)';
          highlightDark = '#fbbf24';
          highlightLight = '#b45309';
          glassBgDark = 'rgba(20, 13, 3, 0.55)';
          glassBgLight = 'rgba(254, 243, 202, 0.45)';
          buttonGradient = 'linear-gradient(135deg, #f59e0b, #d97706)';
          glowShadow = '0 0 30px rgba(245, 158, 11, 0.45), 0 0 60px rgba(234, 179, 8, 0.15)';
        } else if (themeColor === 'Cyber') {
          cardBgDark = 'linear-gradient(135deg, rgba(4, 16, 24, 0.8) 0%, rgba(2, 8, 13, 0.9) 100%)';
          cardBgLight = 'linear-gradient(135deg, rgba(245, 253, 255, 0.9) 0%, rgba(207, 250, 254, 0.8) 100%)';
          borderColor = 'rgba(34, 211, 238, 0.3)';
          borderColorLight = 'rgba(8, 145, 178, 0.35)';
          shimmerColor = 'rgba(34, 211, 238, 0.2)';
          highlightDark = '#22d3ee';
          highlightLight = '#0891b2';
          glassBgDark = 'rgba(3, 13, 20, 0.55)';
          glassBgLight = 'rgba(207, 250, 254, 0.45)';
          buttonGradient = 'linear-gradient(135deg, #22d3ee, #0891b2)';
          glowShadow = '0 0 30px rgba(34, 211, 238, 0.45), 0 0 60px rgba(167, 139, 250, 0.15)';
        } else if (themeColor === 'Crimson') {
          cardBgDark = 'linear-gradient(135deg, rgba(24, 4, 10, 0.8) 0%, rgba(13, 2, 5, 0.9) 100%)';
          cardBgLight = 'linear-gradient(135deg, rgba(255, 245, 247, 0.9) 0%, rgba(254, 228, 232, 0.8) 100%)';
          borderColor = 'rgba(225, 29, 72, 0.3)';
          borderColorLight = 'rgba(225, 29, 72, 0.35)';
          shimmerColor = 'rgba(244, 63, 94, 0.2)';
          highlightDark = '#f43f5e';
          highlightLight = '#be123c';
          glassBgDark = 'rgba(20, 3, 10, 0.55)';
          glassBgLight = 'rgba(254, 228, 232, 0.45)';
          buttonGradient = 'linear-gradient(135deg, #f43f5e, #be123c)';
          glowShadow = '0 0 30px rgba(244, 63, 94, 0.45), 0 0 60px rgba(225, 29, 72, 0.15)';
        } else if (themeColor === 'Mint') {
          cardBgDark = 'linear-gradient(135deg, rgba(4, 24, 16, 0.8) 0%, rgba(2, 13, 8, 0.9) 100%)';
          cardBgLight = 'linear-gradient(135deg, rgba(240, 253, 250, 0.9) 0%, rgba(204, 251, 241, 0.8) 100%)';
          borderColor = 'rgba(45, 212, 191, 0.3)';
          borderColorLight = 'rgba(13, 148, 136, 0.35)';
          shimmerColor = 'rgba(45, 212, 191, 0.2)';
          highlightDark = '#2dd4bf';
          highlightLight = '#0d9488';
          glassBgDark = 'rgba(3, 20, 13, 0.55)';
          glassBgLight = 'rgba(204, 251, 241, 0.45)';
          buttonGradient = 'linear-gradient(135deg, #2dd4bf, #0d9488)';
          glowShadow = '0 0 30px rgba(45, 212, 191, 0.45), 0 0 60px rgba(16, 185, 129, 0.15)';
        }

        return (
          <style>{`
            /* Dark Mode: Make premium cards look beautiful glassmorphic */
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"],
            .dark [class*="bg-gradient-to-br"][class*="from-amber-500"],
            .dark [class*="bg-gradient-to-br"][class*="from-emerald-"] {
              background: ${cardBgDark} !important;
              border: 1px solid ${borderColor} !important;
              box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.7), 0 0 25px ${borderColor.replace('0.3', '0.12')} !important;
              position: relative !important;
              overflow: hidden !important;
            }

            /* Light Mode: Make premium cards look beautiful glassmorphic */
            [class*="bg-gradient-to-br"][class*="from-primary-"],
            [class*="bg-gradient-to-br"][class*="from-amber-500"],
            [class*="bg-gradient-to-br"][class*="from-emerald-"] {
              background: ${cardBgLight} !important;
              border: 1px solid ${borderColorLight} !important;
              box-shadow: 0 10px 30px -10px rgba(180, 83, 9, 0.08), 0 0 20px ${borderColor.replace('0.3', '0.08')} !important;
              position: relative !important;
              overflow: hidden !important;
            }

            /* Ensure text color inside light-mode cards has maximum contrast */
            [class*="bg-gradient-to-br"][class*="from-primary-"] h3,
            [class*="bg-gradient-to-br"][class*="from-primary-"] p,
            [class*="bg-gradient-to-br"][class*="from-primary-"] span,
            [class*="bg-gradient-to-br"][class*="from-primary-"] div,
            [class*="bg-gradient-to-br"][class*="from-amber-500"] h3,
            [class*="bg-gradient-to-br"][class*="from-amber-500"] p,
            [class*="bg-gradient-to-br"][class*="from-amber-500"] span,
            [class*="bg-gradient-to-br"][class*="from-amber-500"] div,
            [class*="bg-gradient-to-br"][class*="from-emerald-"] h3,
            [class*="bg-gradient-to-br"][class*="from-emerald-"] p,
            [class*="bg-gradient-to-br"][class*="from-emerald-"] span,
            [class*="bg-gradient-to-br"][class*="from-emerald-"] div {
              color: #1e293b !important;
            }

            /* Reset text colors in Dark Mode */
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] h3,
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] p,
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] span,
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] div,
            .dark [class*="bg-gradient-to-br"][class*="from-amber-500"] h3,
            .dark [class*="bg-gradient-to-br"][class*="from-amber-500"] p,
            .dark [class*="bg-gradient-to-br"][class*="from-amber-500"] span,
            .dark [class*="bg-gradient-to-br"][class*="from-amber-500"] div,
            .dark [class*="bg-gradient-to-br"][class*="from-emerald-"] h3,
            .dark [class*="bg-gradient-to-br"][class*="from-emerald-"] p,
            .dark [class*="bg-gradient-to-br"][class*="from-emerald-"] span,
            .dark [class*="bg-gradient-to-br"][class*="from-emerald-"] div {
              color: #ffffff !important;
            }

            /* Style labels/subtext in Light Mode */
            [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-primary-"],
            [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-emerald-"],
            [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-indigo-"],
            [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-teal-"],
            [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-purple-"],
            [class*="bg-gradient-to-br"][class*="from-amber-500"] [class*="text-primary-"],
            [class*="bg-gradient-to-br"][class*="from-emerald-"] [class*="text-indigo-"] {
              color: ${highlightLight} !important;
            }

            /* Style labels/subtext in Dark Mode */
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-primary-"],
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-emerald-"],
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-indigo-"],
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-teal-"],
            .dark [class*="bg-gradient-to-br"][class*="from-primary-"] [class*="text-purple-"],
            .dark [class*="bg-gradient-to-br"][class*="from-amber-500"] [class*="text-primary-"],
            .dark [class*="bg-gradient-to-br"][class*="from-emerald-"] [class*="text-indigo-"] {
              color: ${highlightDark} !important;
            }

            /* Individual components shine effect */
            [class*="bg-gradient-to-br"][class*="from-primary-"]::after,
            [class*="bg-gradient-to-br"][class*="from-amber-500"]::after,
            [class*="bg-gradient-to-br"][class*="from-emerald-"]::after {
              content: '';
              position: absolute;
              top: 0;
              left: -150%;
              width: 50%;
              height: 100%;
              background: linear-gradient(
                90deg,
                rgba(255, 255, 255, 0) 0%,
                ${shimmerColor} 50%,
                rgba(255, 255, 255, 0) 100%
              );
              transform: skewX(-25deg);
              animation: card-sweeping-shine 7s infinite ease-in-out;
              pointer-events: none;
              z-index: 5;
            }

            @keyframes card-sweeping-shine {
              0% { left: -150%; }
              30% { left: 150%; }
              100% { left: 150%; }
            }

            /* Dark Mode Premium overrides for General Glass Panels */
            .dark .glass-panel {
              background: ${glassBgDark} !important;
              border-color: ${borderColor} !important;
              box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.4), 0 0 20px ${borderColor.replace('0.3', '0.08')} !important;
            }
            
            /* Light Mode Premium overrides for General Glass Panels */
            .glass-panel {
              background: ${glassBgLight} !important;
              border-color: ${borderColorLight} !important;
              box-shadow: 0 8px 32px 0 rgba(180, 83, 9, 0.08), 0 0 20px ${borderColor.replace('0.3', '0.1')} !important;
            }

            /* Primary buttons styling: Dynamic gradient */
            .btn-primary {
              background: ${buttonGradient} !important;
              border-color: ${borderColorLight} !important;
              box-shadow: 0 4px 15px ${borderColor.replace('0.3', '0.4')} !important;
              color: #ffffff !important;
            }
            .btn-primary:hover {
              box-shadow: 0 6px 20px ${borderColor.replace('0.3', '0.6')} !important;
            }
          `}</style>
        );
      })()}
      {/* Background Animated Dots */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {/* Large blurry spots */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-theme-primary/5 dark:bg-theme-primary/3 rounded-full blur-[100px] animate-float-slow"></div>
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-theme-accent/5 dark:bg-theme-accent/3 rounded-full blur-[80px] animate-float-medium"></div>
        <div className="absolute top-1/2 right-1/3 w-[300px] h-[300px] bg-theme-primary/4 dark:bg-theme-primary/3 rounded-full blur-[60px] animate-float-fast"></div>
        {/* Floating Tech Logos */}
        {/* Python */}
        <svg className="absolute w-10 h-10 opacity-20 dark:opacity-35 animate-bubble-1 top-[12%] left-[8%]" viewBox="0 0 24 24" fill="var(--color-theme-primary)">
          <path d="M12.012 2c-1.38 0-2.613.11-3.413.298-.8.187-1.488.528-1.927.994-.439.466-.63 1.045-.63 1.932v1.547h6.087v.867H6.042c-1.38 0-2.613.11-3.413.298-.8.187-1.488.528-1.927.994-.439.466-.63 1.045-.63 1.932v3.743c0 .887.19 1.466.63 1.932.44.466 1.127.807 1.927.994.8.188 2.033.298 3.413.298h.813v-1.127c0-1.173.498-2.26 1.378-3.003.88-.743 2.062-1.123 3.325-1.123h3.565c.887 0 1.466-.191 1.932-.63.466-.44.807-1.127.994-1.927.188-.8.298-2.033.298-3.413V6.042c0-1.38-.11-2.613-.298-3.413-.187-.8-.528-1.488-.994-1.927-.466-.439-1.045-.63-1.932-.63h-4.329zm-3.127 1.585a.738.738 0 1 1 0 1.476.738.738 0 0 1 0-1.476zm6.245 4.773v1.127c0 1.173-.498 2.26-1.378 3.003-.88.743-2.062 1.123-3.325 1.123H6.862c-.887 0-1.466.191-1.932.63-.466.44-.807 1.127-.994 1.927-.188.8-.298 2.033-.298 3.413v4.329c0 1.38.11 2.613.298 3.413.187.8.528 1.488.994 1.927.466.439 1.045.63 1.932.63h4.329c1.38 0 2.613-.11 3.413-.298.8-.187 1.488-.528 1.927-.994.439-.466.63-1.045.63-1.932v-1.547h-6.087v-.867h6.087c1.38 0 2.613-.11 3.413-.298.8-.187 1.488-.528 1.927-.994.439-.466.63-1.045.63-1.932v-3.743c0-.887-.19-1.466-.63-1.932-.44-.466-1.127-.807-1.927-.994-.8-.188-2.033-.298-3.413-.298h-.813zm3.127 10.772a.738.738 0 1 1 0 1.476.738.738 0 0 1 0-1.476z"/>
        </svg>
        {/* React / MERN */}
        <svg className="absolute w-10 h-10 opacity-20 dark:opacity-35 animate-bubble-2 top-[40%] left-[12%]" viewBox="0 0 24 24" fill="var(--color-theme-primary)">
          <circle cx="12" cy="12" r="2"/>
          <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.2"/>
          <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.2" transform="rotate(60 12 12)"/>
          <ellipse cx="12" cy="12" rx="10" ry="3.5" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.2" transform="rotate(120 12 12)"/>
        </svg>
        {/* Java */}
        <svg className="absolute w-11 h-11 opacity-15 dark:opacity-30 animate-bubble-3 top-[72%] left-[22%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
          <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
          <line x1="6" y1="2" x2="6" y2="4"/>
          <line x1="10" y1="2" x2="10" y2="4"/>
          <line x1="14" y1="2" x2="14" y2="4"/>
        </svg>
        {/* Docker */}
        <svg className="absolute w-11 h-11 opacity-20 dark:opacity-35 animate-bubble-4 top-[20%] right-[12%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-accent)" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M2 13.5c0-1.8 1-3.5 3-4.5 3-1.5 6-1 9 1 1.5 1 3 .5 4.5-.5.5-.3 1-.5 1.5-.5s.8.3.8.8c0 1.2-.5 2.5-1.5 3.5S16 16.5 13.5 16.5H5.5C3.5 16.5 2 15.3 2 13.5z"/>
          <path d="M12.5 8h2v2h-2zM9.5 8h2v2h-2zM6.5 8h2v2h-2zM9.5 5h2v2h-2z"/>
        </svg>
        {/* Node.js */}
        <svg className="absolute w-11 h-11 opacity-15 dark:opacity-30 animate-bubble-5 top-[60%] right-[18%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M12 2L3.5 7v10L12 22l8.5-5V7L12 2z"/>
          <path d="M12 22V12"/>
        </svg>
        {/* C */}
        <svg className="absolute w-9 h-9 opacity-20 dark:opacity-35 animate-bubble-6 top-[32%] right-[32%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-accent)" strokeWidth="2" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M14.5 9.5a3 3 0 1 0 0 5" stroke="var(--color-theme-accent)" strokeWidth="2.5"/>
        </svg>
        {/* C++ */}
        <svg className="absolute w-10 h-10 opacity-20 dark:opacity-35 animate-bubble-7 top-[82%] right-[38%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-primary)" strokeWidth="2" strokeLinecap="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M11 9.5a2 2 0 1 0 0 5" stroke="var(--color-theme-primary)" strokeWidth="2"/>
          <path d="M14 12h3M15.5 10.5v3"/>
        </svg>
        {/* GitHub */}
        <svg className="absolute w-9 h-9 opacity-15 dark:opacity-30 animate-bubble-8 top-[50%] left-[42%]" viewBox="0 0 24 24" fill="var(--color-theme-accent)">
          <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
        </svg>
        {/* Redis */}
        <svg className="absolute w-9 h-9 opacity-15 dark:opacity-30 animate-bubble-1 top-[88%] left-[55%]" style={{animationDelay: '3s'}} viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z"/>
          <path d="M2 12l10 5 10-5"/>
          <path d="M2 17l10 5 10-5"/>
        </svg>
        {/* Nginx */}
        <svg className="absolute w-8 h-8 opacity-20 dark:opacity-35 animate-bubble-3 top-[5%] left-[55%]" style={{animationDelay: '5s'}} viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-accent)" strokeWidth="1.5" strokeLinecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth="1.5"/>
          <path d="M8 7v10l8-10v10" strokeWidth="2"/>
        </svg>
        {/* MySQL */}
        <svg className="absolute w-10 h-10 opacity-15 dark:opacity-30 animate-bubble-5 top-[40%] right-[80%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M3 12c4-6 10-8 15-4 1.5 1.2 2 3.2 2.5 5 .5 1.8-1 2.5-2.5 2s-3.5-2-6.5-1-6 3.5-8.5 3c-1.5-.3-2.5-2-2.5-5z"/>
        </svg>
        {/* Ubuntu */}
        <svg className="absolute w-9 h-9 opacity-20 dark:opacity-35 animate-bubble-7 top-[75%] right-[85%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-accent)" strokeWidth="1.5">
          <circle cx="12" cy="12" r="8"/>
          <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
          <circle cx="5.07" cy="16" r="1.5" fill="currentColor"/>
          <circle cx="18.93" cy="16" r="1.5" fill="currentColor"/>
        </svg>
        {/* Slack */}
        <svg className="absolute w-9 h-9 opacity-15 dark:opacity-30 animate-bubble-2 top-[20%] left-[85%]" viewBox="0 0 24 24" fill="var(--color-theme-primary)">
          <rect x="4" y="9" width="6" height="2" rx="1"/>
          <rect x="8" y="5" width="2" height="10" rx="1"/>
          <rect x="14" y="13" width="6" height="2" rx="1"/>
          <rect x="14" y="9" width="2" height="10" rx="1"/>
        </svg>
        {/* DB (Database stack) */}
        <svg className="absolute w-8 h-8 opacity-20 dark:opacity-35 animate-bubble-3 top-[5%] left-[30%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-accent)" strokeWidth="1.5">
          <ellipse cx="12" cy="5" rx="8" ry="3"/>
          <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5"/>
          <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"/>
        </svg>
        {/* HTML5 */}
        <svg className="absolute w-10 h-10 opacity-15 dark:opacity-30 animate-bubble-5 top-[52%] left-[2%]" viewBox="0 0 24 24" fill="var(--color-theme-primary)">
          <path d="M5 2l1.5 15L12 20l5.5-3L19 2H5zm10 6H8.5l.2 2H15l-.6 6.5-2.4 1-2.4-1-.1-1.5h1.8l.1.5.6.2.6-.2V12H8.1l-.5-5H15l-.1 1z"/>
        </svg>
        {/* CSS3 */}
        <svg className="absolute w-10 h-10 opacity-15 dark:opacity-30 animate-bubble-2 top-[62%] right-[5%]" viewBox="0 0 24 24" fill="var(--color-theme-accent)">
          <path d="M5 2h14l-1.5 15L12 20l-5.5-3L5 2zm10 5H8.5l-.2-2h6.9v-2H6.3l.6 6h6.1l-.3 3.5-1.7.5-1.7-.5-.1-1.5H7.2l.2 3.5 4.6 1.3 4.6-1.3.4-6.5z"/>
        </svg>
        {/* JavaScript (JS) */}
        <svg className="absolute w-20 h-20 opacity-20 dark:opacity-35 animate-bubble-6 top-[22%] left-[50%]" viewBox="0 0 24 24" fill="var(--color-theme-primary)">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <text x="7" y="16" fontSize="10" fontWeight="bold" fill="white" fontFamily="sans-serif">JS</text>
        </svg>
        {/* TypeScript (TS) */}
        <svg className="absolute w-20 h-20 opacity-20 dark:opacity-35 animate-bubble-8 top-[78%] left-[70%]" viewBox="0 0 24 24" fill="var(--color-theme-accent)">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <text x="7" y="16" fontSize="10" fontWeight="bold" fill="white" fontFamily="sans-serif">TS</text>
        </svg>
        {/* Postman */}
        <svg className="absolute w-10 h-10 opacity-15 dark:opacity-30 animate-bubble-4 top-[85%] right-[22%]" viewBox="0 0 24 24" fill="none" stroke="var(--color-theme-primary)" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 2s4 4 4 9v6c0 1-1 2-2 2h-4c-1 0-2-1-2-2v-6c0-5 4-9 4-9zm-2 19h4v2h-4z"/>
        </svg>
      </div>
      {isSyncing && (
        <div className="fixed inset-0 z-[9999] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <Loader text="Syncing Attendance..." />
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Desktop only - hidden on mobile, use bottom nav instead) */}
      <aside
        style={{ fontFamily: "'ALEXANDER', 'Alexandria', sans-serif" }}
        className={`fixed z-50 flex-col overflow-hidden transition-transform duration-300 ease-in-out hidden lg:flex inset-y-0 left-0 w-64 glass-panel rounded-none border-r border-slate-200/60 dark:border-white/10 translate-x-0`}
      >
        {/* Drag indicator removed - sidebar is desktop-only now */}
        <div className="h-16 lg:h-18 flex items-center px-4 border-b border-slate-200/60 dark:border-white/10 bg-slate-50/40 dark:bg-black/10">
          <div className="flex items-center gap-3 group cursor-pointer min-w-0 flex-1">
            <div className="relative shrink-0">
              <div className="absolute inset-0 bg-theme-primary/20 blur-xl rounded-full scale-150 group-hover:bg-theme-primary/30 transition-all duration-500"></div>
              <div className="relative w-11 h-11 rounded-xl bg-white shadow-[0_4px_12px_-2px_rgba(0,0,0,0.5)] border-t border-white/80 border-b-[3px] border-slate-300 dark:border-b-slate-900/80 p-0.5 flex items-center justify-center transition-all duration-300 group-hover:-translate-y-0.5 overflow-hidden">
                <img src="/logo.png" alt="SSMS Logo" className="w-full h-full object-contain rounded-lg" />
              </div>
            </div>
            <div className="flex flex-col relative z-10 min-w-0 flex-1 justify-center">
              <span className="font-extrabold text-[19px] leading-tight tracking-tight text-slate-800 dark:text-white transition-all group-hover:text-theme-primary truncate" title={user?.role === 'mentor' ? 'SSMS - Saran Students Management System' : (customPanelName || 'SSMS 2.0')}>
                {user?.role === 'mentor' ? 'SSMS' : (customPanelName || 'SSMS 2.0')}
              </span>
              <span className="text-[9px] font-black tracking-wider text-theme-primary uppercase leading-[1.2] line-clamp-2" title={customPanelSubheading || "Saran Student's Management System"}>
                {customPanelSubheading || "Saran Student's Management System"}
              </span>
            </div>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-500 hover:text-slate-700 dark:text-slate-400"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-3 px-3 custom-scrollbar pr-2">
          {sections.map((section, sIdx) => {
            return (
              <div key={section.label} className="mb-2">
                {sIdx > 0 && (
                  <div className="mx-3 my-2 border-t border-slate-100 dark:border-white/5"></div>
                )}
                
                {/* Collapsible Section Header */}
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer border-l-[3px] border-transparent"
                >
                  <span>{section.label}</span>
                  {expandedSections[section.label] ? (
                    <ChevronDown size={12} className="text-slate-400 dark:text-slate-500" />
                  ) : (
                    <ChevronRight size={12} className="text-slate-400 dark:text-slate-500" />
                  )}
                </button>

                {/* Section Links */}
                {expandedSections[section.label] && (
                  <div className="space-y-1 mt-1 animate-in slide-in-from-top-1 duration-150">
                    {section.links.map((link) => {
                      const [linkPathname, linkSearch] = link.path.split('?');
                      const isActive = linkSearch 
                        ? (location.pathname === linkPathname && location.search.includes(linkSearch))
                        : (!location.search.includes('tab=') && (
                            location.pathname === linkPathname || 
                            (linkPathname !== '/' && linkPathname !== '/student' && location.pathname.startsWith(linkPathname))
                          ));
                      return (
                        <Link
                          key={link.name}
                          to={link.path}
                          className={`flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 text-[13px] border-l-4 ${
                            isActive
                              ? 'bg-gradient-to-r from-theme-primary/10 to-theme-accent/5 text-theme-primary font-bold border-theme-primary shadow-[0_2px_10px_-3px_var(--color-theme-primary)]'
                              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50/40 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-slate-200 font-medium border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <div className="flex items-center gap-3">
                            <span className={`transition-transform duration-250 ${isActive ? 'text-theme-primary scale-105' : 'text-slate-400 dark:text-slate-500 group-hover:text-slate-600'}`}>
                              {link.icon}
                            </span>
                            <span>{link.name}</span>
                          </div>
                          {link.badge > 0 && !isActive && (
                            <span className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-sm shadow-indigo-500/30 animate-pulse">
                              {link.badge}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-white/10">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors duration-200 text-[13px] font-bold"
          >
            <LogOut size={20} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col min-w-0 lg:ml-64 relative ${location.pathname.includes('/chat') ? 'h-screen overflow-hidden' : ''}`}>
        {/* Frozen Top Bar Header */}
        <header className="sticky top-0 z-40 h-16 lg:h-18 shrink-0 flex items-center justify-between px-4 sm:px-6 lg:px-8 bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl border-b border-slate-200/60 dark:border-white/10 transition-colors duration-300">
          {/* Left: Mobile Brand / Desktop Title & Badge */}
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile Branding */}
            <div className="lg:hidden flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-white/80 dark:bg-slate-800/80 shadow-2xs p-1 flex items-center justify-center overflow-hidden shrink-0 border border-slate-200/60 dark:border-white/10">
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-black text-xs tracking-tight text-slate-800 dark:text-white uppercase truncate max-w-[120px]">
                {user?.role === 'admin' ? 'SRAC 2.0' : (user?.role === 'mentor' ? 'SSMS' : 'SSMS 2.0')}
              </span>
            </div>

            {/* Desktop Active Page Title & Custom Panel Name Badge */}
            <div className="hidden lg:flex items-center gap-2.5 min-w-0">
              <h1 className="text-lg font-black text-slate-900 dark:text-white capitalize tracking-tight truncate">
                {activePageTitle}
              </h1>
              {user?.role !== 'mentor' && customPanelName && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-theme-primary/10 text-theme-primary border border-theme-primary/20 truncate max-w-[260px] shadow-2xs">
                  <Building2 size={12} className="shrink-0" />
                  <span className="truncate">{customPanelName}</span>
                </span>
              )}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2.5 max-w-full">

             {/* Online Students Count */}
            <div className="hidden sm:flex items-center gap-2 bg-slate-500/10 dark:bg-white/5 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-300/40 dark:border-white/10">
              <div className="w-2 h-2 rounded-full bg-theme-primary animate-pulse"></div>
              <span>{onlineStudentsCount} Online</span>
            </div>

            {/* Student Timer */}
            {user?.role === 'student' && sessionActive && (
              <div className="hidden sm:flex items-center gap-2 bg-theme-primary/10 text-theme-primary px-3 py-1.5 rounded-full text-xs font-bold border border-theme-primary/20">
                <Clock size={16} className="animate-pulse" />
                <span>{formatTime(sessionSeconds)}</span>
              </div>
            )}

            {/* Student Coins Display */}
            {user?.role === 'student' && (
              <div className="flex items-center gap-1 bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full text-xs font-extrabold border border-amber-500/20 shrink-0">
                <span className="text-xs sm:text-base">🪙</span>
                {coinsLoaded ? (
                  <span>{userCoins} <span className="hidden sm:inline">Coins</span></span>
                ) : (
                  <span className="inline-block w-10 h-3.5 bg-amber-500/20 rounded animate-pulse" />
                )}
              </div>
            )}

            {/* DND Mode Toggle (All Roles) */}
            <button
              onClick={toggleDndMode}
              title={dndMode ? 'Do Not Disturb is ON — Click to resume notification popups & sounds' : 'Enable Do Not Disturb (Mute notification popups & sounds)'}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 sm:py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer shrink-0 ${
                dndMode
                  ? 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white border-slate-300/40 dark:border-white/10 hover:bg-slate-500/10 dark:hover:bg-white/10'
              }`}
              aria-label="Toggle Do Not Disturb"
            >
              <BellOff size={15} className="sm:w-[16px] sm:h-[16px]" />
              <span className="hidden sm:inline">{dndMode ? 'DND On' : 'DND'}</span>
            </button>

            {/* Notifications Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all hover:bg-slate-500/10 dark:hover:bg-white/10 border border-slate-300/40 dark:border-white/10 cursor-pointer"
                aria-label="Notifications"
              >
                <Bell size={16} className="sm:w-[18px] sm:h-[18px]" />
                {notifications.length > 0 && (
                  <span className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 bg-rose-500 rounded-full text-[8px] sm:text-[9px] font-bold text-white flex items-center justify-center shadow-md animate-in zoom-in">
                    {notifications.length}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed sm:absolute top-14 sm:top-auto right-3 sm:right-0 left-3 sm:left-auto sm:w-80 max-h-[70vh] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700/80 overflow-hidden z-50 origin-top-right animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 sm:p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <div>
                      <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white leading-none">Notifications</h3>
                      <span className="text-[10px] text-slate-500 font-medium">
                        {notifications.length} Unread{dndMode ? ' • DND Active' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={toggleDndMode}
                        className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                          dndMode
                            ? 'bg-rose-500/15 text-rose-500 border-rose-500/30'
                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {dndMode ? 'DND: ON' : 'DND: OFF'}
                      </button>
                      {notifications.length > 0 && (
                        <button onClick={clearAllNotifications} className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700">
                          Mark all as read
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="max-h-72 sm:max-h-80 overflow-y-auto custom-scrollbar">
                    {notifications.length > 0 ? (
                      notifications.map(notif => (
                        <div 
                          key={notif.id} 
                          onClick={() => {
                            setShowNotifications(false);
                            navigateToNotificationTarget(notif);
                          }}
                          className="p-3 sm:p-4 border-b border-slate-50 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors relative group cursor-pointer"
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              clearNotification(notif.id);
                            }}
                            className="absolute top-3 right-3 text-slate-300 hover:text-rose-500 sm:opacity-0 group-hover:opacity-100 transition-opacity p-1 z-10"
                            aria-label="Mark as read"
                          >
                            <X size={14} />
                          </button>
                          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 mb-0.5 pr-6">{notif.title}</p>
                          <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 pr-4 leading-normal">{notif.message}</p>
                          <p className="text-[9px] sm:text-[10px] text-slate-400 mt-1.5 font-medium">{new Date(notif.time).toLocaleString()}</p>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center flex flex-col items-center justify-center text-slate-500 dark:text-slate-400">
                        <CheckCircle size={24} className="text-emerald-500 mb-2 opacity-50" />
                        <p className="text-sm font-medium">All caught up!</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Theme Selector Toggle */}
            <div className="relative" ref={themeMenuRef}>
              <button
                onClick={() => setShowThemeMenu(!showThemeMenu)}
                className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all hover:bg-slate-500/10 dark:hover:bg-white/10 border border-slate-300/40 dark:border-white/10 cursor-pointer"
                aria-label="Select theme color"
              >
                <Palette size={16} className="sm:w-[18px] sm:h-[18px]" />
              </button>

              {showThemeMenu && (
                <div className="fixed sm:absolute top-14 sm:top-auto right-3 sm:right-0 left-3 sm:left-auto sm:w-[280px] max-h-[70vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden z-50 origin-top-right animate-in fade-in slide-in-from-top-2">
                  <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-800 dark:text-white leading-none">Theme Colors</h3>
                    <span className="text-[10px] text-slate-400 font-medium">{themes.length + 1} themes</span>
                  </div>
                  <div className="p-3 grid grid-cols-4 gap-2">
                    {themes.map((t) => (
                      <button
                        key={t.name}
                        onClick={() => {
                          if (!isThemeUnlocked(t.name)) {
                            Swal.fire({
                              title: 'Theme Locked!',
                              text: `The ${themeDisplayNames[t.name] || t.name} is locked. You can unlock/buy it in the Gamification Hub Shop!`,
                              icon: 'lock',
                              confirmButtonColor: 'var(--color-theme-primary)',
                              background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
                              color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a'
                            });
                            return;
                          }
                          applyThemeColor(t.name);
                          setGamificationData(prev => prev ? { ...prev, currentTheme: t.name } : { currentTheme: t.name });
                          setShowThemeMenu(false);
                          
                          // Save equipped theme to backend database
                          axios.post('/gamification/shop/equip', { category: 'theme', value: t.name })
                            .then(() => {
                              if (socket) socket.emit('equip_change', { category: 'theme', value: t.name });
                            })
                            .catch(err => console.error('Failed to equip theme via navbar:', err));
                        }}
                        className={`flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all duration-150 cursor-pointer group relative ${
                          themeColor === t.name
                            ? 'bg-slate-100 dark:bg-slate-700 ring-2 ring-offset-1 dark:ring-offset-slate-800'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                        } ${!isThemeUnlocked(t.name) ? 'opacity-60' : ''}`}
                        style={themeColor === t.name ? { ringColor: t.primary } : {}}
                        title={themeDisplayNames[t.name] || t.name}
                      >
                        <div className="relative">
                          <span
                            className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-600 shadow-md block group-hover:scale-110 transition-transform"
                            style={{ backgroundColor: t.primary, boxShadow: `0 2px 8px ${t.primary}40` }}
                          />
                          {themeColor === t.name && (
                            <svg className="absolute inset-0 w-7 h-7 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                          )}
                          {!isThemeUnlocked(t.name) && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-slate-900/90 dark:bg-slate-700/95 rounded-full flex items-center justify-center text-white border border-white/20">
                              <Lock size={8} />
                            </div>
                          )}
                        </div>
                        <span className={`text-[9px] font-semibold leading-none truncate w-full text-center ${
                          themeColor === t.name ? 'text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400'
                        }`}>{themeDisplayNames[t.name] || t.name}</span>
                      </button>
                    ))}
                  </div>
                  {/* Custom Color Picker */}
                  <div className="border-t border-slate-100 dark:border-slate-700 p-3">
                    <div className="flex items-center gap-3">
                      <label
                        className="relative cursor-pointer group shrink-0"
                        title={!isCustomColorAllowed() ? "Locked - Reached Rank #1 to unlock" : "Pick a custom color"}
                        onClick={(e) => {
                          if (!isCustomColorAllowed()) {
                            e.preventDefault();
                            Swal.fire({
                              title: 'Custom Theme Locked!',
                              text: 'Custom themes are exclusive to the #1 ranked student, or unlocked via the Coding Master / Legend League achievements!',
                              icon: 'lock',
                              confirmButtonColor: 'var(--color-theme-primary)',
                              background: document.documentElement.classList.contains('dark') ? '#1e293b' : '#ffffff',
                              color: document.documentElement.classList.contains('dark') ? '#ffffff' : '#0f172a'
                            });
                          }
                        }}
                      >
                        <span
                          className="w-7 h-7 rounded-full border-2 border-white dark:border-slate-600 shadow-md block group-hover:scale-110 transition-transform relative"
                          style={{ background: `conic-gradient(#f43f5e, #f59e0b, #10b981, #0ea5e9, #8b5cf6, #ec4899, #f43f5e)` }}
                        >
                          {!isCustomColorAllowed() && (
                            <div className="absolute inset-0 bg-slate-900/40 rounded-full flex items-center justify-center text-white">
                              <Lock size={10} />
                            </div>
                          )}
                        </span>
                        {themeColor === 'Custom' && (
                          <svg className="absolute inset-0 w-7 h-7 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        )}
                        {isCustomColorAllowed() && (
                          <input
                            type="color"
                            value={customColor}
                            onChange={(e) => handleCustomColorChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                          />
                        )}
                      </label>
                      <div className="flex-1">
                        <p className={`text-[11px] font-bold leading-none ${
                          themeColor === 'Custom' ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
                        }`}>Custom Color Theme</p>
                        <p className="text-[9px] text-slate-400 mt-0.5">
                          {!isCustomColorAllowed() ? "Requires Rank #1 or Coding Master" : "Customize your workspace style"}
                        </p>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-50 dark:bg-slate-700 px-1.5 py-0.5 rounded">{themeColor === 'Custom' ? customColor : '—'}</span>
                    </div>

                    {/* Font and Size Controls - only show if unlocked & selected Custom Theme */}
                    {isCustomColorAllowed() && themeColor === 'Custom' && (
                      <div className="mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/60 flex flex-col gap-2.5 animate-fadeIn">
                        {/* Font Family Selector */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Font Family</label>
                          <select
                            value={customFont}
                            onChange={(e) => handleCustomFontChange(e.target.value)}
                            className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500 text-slate-700 dark:text-slate-300 font-medium"
                          >
                            <option value="Inter">Inter (Clean)</option>
                            <option value="Outfit">Outfit (Modern)</option>
                            <option value="Space Grotesk">Space Grotesk (Tech)</option>
                            <option value="Cinzel">Cinzel (Royal)</option>
                            <option value="Playfair Display">Playfair Display (Elegant)</option>
                            <option value="Share Tech Mono">Share Tech Mono (Console)</option>
                          </select>
                        </div>

                        {/* Font Size Selector */}
                        <div className="flex flex-col gap-1">
                          <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Font Size Scale</label>
                          <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-slate-900/60 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            {[
                              { label: 'Small', value: '100%' },
                              { label: 'Medium', value: '106.25%' },
                              { label: 'Large', value: '112.5%' }
                            ].map((sz) => (
                              <button
                                key={sz.value}
                                onClick={() => handleCustomFontSizeChange(sz.value)}
                                className={`text-[10px] font-bold py-1 px-1.5 rounded-md transition-all cursor-pointer ${
                                  customFontSize === sz.value
                                    ? 'bg-white dark:bg-slate-800 text-primary-500 shadow-sm border border-slate-200 dark:border-slate-700/60'
                                    : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'
                                }`}
                              >
                                {sz.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Read-Only Global Active Batch Indicator for Admin & Mentor */}
            {(user?.role === 'admin' || user?.role === 'mentor') && (
              <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-500/10 dark:bg-white/5 border border-slate-300/40 dark:border-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl shadow-2xs">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="relative flex h-2 w-2 shrink-0">
                    {isBatchClosed ? (
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    ) : (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                      </>
                    )}
                  </span>
                  <BookOpen size={13} className={isBatchClosed ? 'text-red-500 dark:text-red-400 shrink-0' : 'text-indigo-500 dark:text-indigo-400 shrink-0'} />
                  <span 
                    className="text-[10px] sm:text-[11px] font-black text-slate-800 dark:text-slate-100 truncate max-w-[90px] sm:max-w-[170px]"
                    title={selectedBatchName || activeBatch?.batchName || 'No Batch'}
                  >
                    {selectedBatchName || activeBatch?.batchName || 'No Batch'}
                  </span>
                  {isBatchClosed && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-red-500/10 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-500/20 shrink-0">
                      Closed
                    </span>
                  )}
                </div>
                {(user?.role === 'admin' || user?.role === 'mentor') && (
                  <button
                    type="button"
                    onClick={openBatchModal}
                    className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/60 dark:border-indigo-800/60 px-1.5 py-0.5 rounded-lg transition-all shrink-0 cursor-pointer"
                    title="Switch Global Active Batch"
                  >
                    <ArrowLeftRight size={10} />
                    <span className="hidden sm:inline">Switch</span>
                  </button>
                )}
              </div>
            )}

            {/* Dark Mode Toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white rounded-xl transition-all hover:bg-slate-500/10 dark:hover:bg-white/10 border border-slate-300/40 dark:border-white/10 cursor-pointer"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun size={16} className="sm:w-[18px] sm:h-[18px]" /> : <Moon size={16} className="sm:w-[18px] sm:h-[18px]" />}
            </button>

            <div className="hidden md:block text-right border-l border-slate-200 dark:border-white/10 pl-4 pr-2">
              <p className={`text-sm font-bold leading-tight ${getNamecolorClass(gamificationData?.currentNamecolor || user?.currentNamecolor) || 'text-slate-800 dark:text-white'} namecolor-shine`}>{user?.name}</p>
              <p className={`text-[10px] font-bold capitalize ${
                (gamificationData?.equippedTitle || gamificationData?.currentTitle || user?.equippedTitle || user?.currentTitle)
                  ? 'text-violet-400 dark:text-violet-300 font-extrabold animate-pulse'
                  : 'text-slate-400 dark:text-slate-500'
              }`}>
                {(gamificationData?.equippedTitle || gamificationData?.currentTitle || user?.equippedTitle || user?.currentTitle) ? `🏆 ${gamificationData?.equippedTitle || gamificationData?.currentTitle || user?.equippedTitle || user?.currentTitle}` : user?.role}
              </p>
            </div>
            <div className="relative shrink-0">
              <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center relative ${
                (gamificationData?.profileBorder || user?.profileBorder)
                  ? `border-2 sm:border-3 p-0.5 ${getBorderPreviewClass(gamificationData?.profileBorder || user?.profileBorder)}` 
                  : 'bg-gradient-to-br from-theme-primary to-theme-accent text-white shadow-md'
              } ${getEffectStyles(gamificationData?.equippedEffect || user?.equippedEffect)}`}>
                <div className="w-full h-full rounded-md sm:rounded-lg overflow-hidden flex items-center justify-center">
                  {(() => {
                    const avatarRaw = gamificationData?.equippedAvatar || user?.equippedAvatar || user?.profileImage;
                    const avatarSrc = (!avatarRaw || avatarRaw === 'default.jpg' || avatarRaw.includes('dicebear') || avatarRaw.includes('bottts'))
                      ? '/logo.png'
                      : (avatarRaw.startsWith('/uploads') ? `${import.meta.env.VITE_API_URL || ''}${avatarRaw}` : avatarRaw);
                    return (
                      <img 
                        src={avatarSrc} 
                        alt="Profile" 
                        className="w-full h-full object-cover object-top" 
                        onError={(e) => { e.target.src = '/logo.png'; }}
                      />
                    );
                  })()}
                </div>
              </div>
              {(gamificationData?.equippedPet || user?.equippedPet) && (
                <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-800 shadow-md border border-slate-200 dark:border-slate-700/60 rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs animate-bounce" style={{ zIndex: 10 }} title={`Pet: ${gamificationData?.equippedPet || user?.equippedPet}`}>
                  {PET_EMOJIS[gamificationData?.equippedPet || user?.equippedPet] || '🐾'}
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        {(() => {
          const isChatPage = location.pathname.includes('/chat');
          return (
            <div className={`flex-1 relative min-h-0 ${isChatPage ? 'p-0 sm:p-2 lg:p-3 overflow-hidden h-[calc(100vh-7.5rem)] lg:h-[calc(100vh-4.5rem)] pb-14 lg:pb-0' : 'overflow-auto p-4 lg:p-8 pt-4 pb-20 lg:pb-8'}`}>
              {!isChatPage && isBatchClosed && (
                <div className="mb-5 px-4 py-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3 text-xs text-amber-800 dark:text-amber-200 shadow-xs animate-fadeIn">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/20 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400">
                      <AlertTriangle size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white truncate">
                        Academic Batch "{selectedBatchName || activeBatch?.batchName}" is Closed
                      </p>
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">
                        Completed on {activeBatch?.endDate ? new Date(activeBatch.endDate).toLocaleDateString() : 'deadline'}. The application is displaying historical records in read-only mode.
                      </p>
                    </div>
                  </div>
                  {(user?.role === 'admin' || user?.role === 'mentor') && (
                    <button 
                      onClick={openBatchModal}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-extrabold rounded-xl text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
                    >
                      Switch Batch
                    </button>
                  )}
                </div>
              )}
              <Outlet context={{ 
                sessionActive, startSession, endSession, sessionSeconds, onsiteSeconds, wfhSeconds, currentAccessType, checkInAccess, attendanceLimits, syncAttendanceSession, formatTime, isCheckingIn, activeLeaveStatus, isSyncing, attendanceSynced,
                themeColor, activeTheme: themes.find(t => t.name === themeColor) || themes[0],
                userCoins, gamificationData, fetchCounts, showGlossyNotification
              }} />
            </div>
          );
        })()}
      </main>

      {/* Mobile More Menu Overlay */}
      {mobileMoreOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden" onClick={() => setMobileMoreOpen(false)}>
          <div className="absolute inset-0 bg-black/65 backdrop-blur-sm" />
          <div className="fixed inset-x-0 bottom-0 z-[65] max-h-[82vh] overflow-y-auto bg-slate-900/98 dark:bg-slate-950/98 border-t border-slate-700/50 rounded-t-3xl shadow-[0_-12px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl animate-slideUp pb-16" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-slate-600/40 rounded-full mx-auto mt-2.5 mb-1" />
            <div className="px-3.5 pt-1">
              {/* Mobile More Menu Header */}
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-700/40">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-white shadow p-0.5 flex items-center justify-center overflow-hidden shrink-0">
                    <img src="/logo.png" alt="SSMS" className="w-full h-full object-contain rounded" />
                  </div>
                  <div>
                    <span className="font-bold text-sm text-white leading-tight">{customPanelName || 'SSMS 2.0'}</span>
                    <span className="block text-[8px] font-bold tracking-wider text-theme-primary uppercase">{customPanelSubheading || "Saran Student's Management System"}</span>
                  </div>
                </div>
                <button onClick={() => setMobileMoreOpen(false)} className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800/60 border border-slate-700/30 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              {/* All Navigation Links */}
              <div className="space-y-3.5">
                {sections.map((section) => (
                  <div key={section.label}>
                    <p className="text-[9px] font-black uppercase tracking-widest text-slate-500 mb-1.5 px-0.5">{section.label}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {section.links.map((link) => {
                        const isActive = location.pathname === link.path || (link.path !== '/' && link.path !== '/student' && location.pathname.startsWith(link.path));
                        return (
                          <Link
                            key={link.path}
                            to={link.path}
                            onClick={() => setMobileMoreOpen(false)}
                            className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl text-center transition-all active:scale-95 ${
                              isActive
                                ? 'bg-theme-primary/10 border border-theme-primary/30 text-theme-primary'
                                : 'bg-slate-800/30 border border-slate-700/20 text-slate-400'
                            }`}
                          >
                            <div className="relative">
                              {link.icon}
                              {link.badge > 0 && (
                                <span className="absolute -top-1 -right-1.5 min-w-3.5 h-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[8px] font-black rounded-full flex items-center justify-center px-1 shadow animate-pulse">
                                  {link.badge}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-semibold leading-tight line-clamp-1">{link.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Logout Button */}
              <button
                onClick={() => { setMobileMoreOpen(false); logout(); }}
                className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl font-bold text-xs active:scale-95 transition-all cursor-pointer"
              >
                <LogOut size={18} /> Logout
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal Mobile Bottom Navigation Bar (all roles) */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-slate-900/95 dark:bg-slate-950/95 backdrop-blur-xl border-t border-slate-700/30 px-1 flex items-center justify-around" style={{ paddingBottom: 'max(0.3rem, env(safe-area-inset-bottom))', paddingTop: '0.3rem' }}>
        {(() => {
          const role = user?.role;
          const mobileNavItems = role === 'student' ? [
            { name: 'Home', path: '/student', icon: <LayoutDashboard size={20} /> },
            { name: 'Tasks', path: '/student/tasks', icon: <FileText size={20} /> },
            { name: 'Attendance', path: '/student/attendance', icon: <Clock size={20} /> },
            { name: 'Chat', path: '/student/chat', icon: <MessageCircle size={20} /> },
            { name: 'More', isAction: true, action: () => setMobileMoreOpen(prev => !prev), icon: <Menu size={20} /> }
          ] : role === 'mentor' ? [
            { name: 'Home', path: '/', icon: <LayoutDashboard size={20} /> },
            { name: 'Tasks', path: '/tasks', icon: <FileText size={20} /> },
            { name: 'Reviews', path: '/reviews', icon: <CheckCircle size={20} /> },
            { name: 'Chat', path: '/chat', icon: <MessageCircle size={20} /> },
            { name: 'More', isAction: true, action: () => setMobileMoreOpen(prev => !prev), icon: <Menu size={20} /> }
          ] : [
            { name: 'Home', path: '/', icon: <LayoutDashboard size={20} /> },
            { name: 'Attend', path: '/attendance-logs', icon: <Clock size={20} /> },
            { name: 'Tasks', path: '/tasks', icon: <FileText size={20} /> },
            { name: 'Chat', path: '/chat', icon: <MessageCircle size={20} /> },
            { name: 'More', isAction: true, action: () => setMobileMoreOpen(prev => !prev), icon: <Menu size={20} /> }
          ];

          return mobileNavItems.map((item, index) => {
            const isLinkActive = item.path && (
              location.pathname === item.path || 
              (item.path !== '/' && item.path !== '/student' && location.pathname.startsWith(item.path))
            );
            
            return item.isAction ? (
              <button
                key={index}
                onClick={item.action}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 active:scale-95 transition-all cursor-pointer bg-transparent border-none ${
                  mobileMoreOpen ? 'text-theme-primary' : 'text-slate-400'
                }`}
              >
                <div className={`transition-all ${mobileMoreOpen ? 'text-theme-primary' : ''}`}>
                  {mobileMoreOpen ? <X size={20} /> : item.icon}
                </div>
                <span className="text-[9px] font-semibold leading-none">{mobileMoreOpen ? 'Close' : item.name}</span>
              </button>
            ) : (
              <Link
                key={index}
                to={item.path}
                onClick={() => setMobileMoreOpen(false)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 py-1 active:scale-95 transition-all ${
                  isLinkActive 
                    ? 'text-theme-primary' 
                    : 'text-slate-400'
                }`}
              >
                <div className="relative">
                  {item.icon}
                  {(item.name === 'Chat' || item.name === 'Batch Chat') && getBadge('chats', chatCount) > 0 && (
                    <span className="absolute -top-1 -right-2 min-w-3.5 h-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-[8px] font-black rounded-full flex items-center justify-center px-0.5 shadow animate-pulse">
                      {getBadge('chats', chatCount)}
                    </span>
                  )}
                  {(item.name === 'Reviews') && pendingCount > 0 && (
                    <span className="absolute -top-1 -right-2 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center shadow">
                      {pendingCount}
                    </span>
                  )}
                </div>
                <span className={`text-[9px] leading-none ${isLinkActive ? 'font-bold' : 'font-medium'}`}>{item.name}</span>
              </Link>
            );
          });
        })()}
      </div>
      {/* Global Academic Batch Selection Modal for Admin & Mentor */}
      {(user?.role === 'admin' || user?.role === 'mentor') && <BatchSelectionModal />}

      {/* Floating Frosted Glass Notification Stack (macOS / iOS Notification Center Style) */}
      {toastStack.length > 0 && !dndMode && (
        <aside 
          aria-label="Notification Stack" 
          className="fixed top-16 sm:top-20 right-3 sm:right-6 z-[99999] flex flex-col gap-2.5 w-[360px] max-w-[calc(100vw-2rem)] pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300"
        >
          {/* Stacked Cards Container - Limited to 3 visible cards max, grouped if more */}
          <div className="flex flex-col gap-2.5 max-h-[75vh] overflow-y-auto no-scrollbar pr-0.5 pb-1">
            {/* Show top 2 latest notifications if more than 3, otherwise up to 3 */}
            {toastStack.slice(0, toastStack.length > 3 ? 2 : 3).map((toast) => (
              <div
                key={toast.id}
                onClick={() => handleToastClick(toast)}
                className="pointer-events-auto shrink-0 relative overflow-hidden rounded-2xl bg-slate-900/85 dark:bg-slate-950/90 backdrop-blur-3xl border border-white/15 shadow-[0_14px_40px_-6px_rgba(0,0,0,0.7)] hover:shadow-[0_18px_48px_-4px_rgba(0,0,0,0.85)] p-3.5 transition-all duration-200 hover:scale-[1.01] hover:border-white/25 cursor-pointer animate-in fade-in slide-in-from-top-3 select-none min-h-[76px]"
              >
                {/* Ambient glow matching notification gradient */}
                <div 
                  className="absolute -top-10 -right-10 w-28 h-28 rounded-full blur-2xl opacity-25 pointer-events-none"
                  style={{ background: toast.gradient || 'linear-gradient(135deg, #6366f1, #d946ef)' }}
                />

                <div className="relative z-10 flex items-start gap-3">
                  {/* Left App / Source Squircle Icon */}
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-extrabold text-base shrink-0 shadow-md ring-1 ring-white/20"
                    style={{ background: toast.gradient || 'linear-gradient(135deg, #6366f1, #d946ef)' }}
                  >
                    {toast.iconLetter || '💬'}
                  </div>

                  {/* Body Content */}
                  <div className="flex-1 min-w-0 pr-6">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="text-[13px] font-bold text-white truncate leading-tight">
                        {toast.title}
                      </h4>
                      <span className="text-[10px] font-medium text-slate-400 font-mono shrink-0">
                        {formatNotifTime(toast.time)}
                      </span>
                    </div>

                    {toast.subtitle && (
                      <p className="text-[11px] font-semibold text-indigo-300 dark:text-indigo-400 truncate mt-0.5">
                        {toast.subtitle}
                      </p>
                    )}

                    <p className="text-xs text-slate-200 leading-snug line-clamp-2 mt-1 break-words">
                      {toast.text}
                    </p>

                    {toast.actionText && (
                      <div className="mt-2.5 flex justify-end">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToastClick(toast);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/15 hover:bg-white/25 active:bg-white/35 text-white border border-white/20 shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer"
                        >
                          <span>{toast.actionText}</span>
                          <span className="text-xs leading-none">→</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Close X Button */}
                  <button
                    onClick={(e) => handleToastClose(e, toast.id)}
                    className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white/10 hover:bg-rose-500/80 hover:text-white text-slate-300 flex items-center justify-center transition-all cursor-pointer z-20"
                    title="Dismiss notification"
                  >
                    <X size={13} />
                  </button>
                </div>
              </div>
            ))}

            {/* If more than 3 notifications, show iOS-style stacked grouping card */}
            {toastStack.length > 3 && (
              <div
                onClick={() => {
                  const hasSubmissions = toastStack.some(t => t.type?.includes('submission') || t.title?.toLowerCase().includes('submission') || t.text?.toLowerCase().includes('submitted'));
                  if (hasSubmissions && (user?.role === 'admin' || user?.role === 'mentor')) {
                    navigate('/reviews');
                  } else if (user?.role === 'student') {
                    navigate('/student/tasks');
                  } else {
                    setShowNotifications(true);
                  }
                }}
                className="pointer-events-auto shrink-0 group relative overflow-hidden rounded-2xl bg-slate-900/90 dark:bg-slate-950/95 backdrop-blur-3xl border border-white/20 shadow-[0_14px_40px_-6px_rgba(0,0,0,0.75)] p-3.5 transition-all duration-200 hover:scale-[1.01] hover:border-white/30 cursor-pointer animate-in fade-in select-none min-h-[76px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 flex items-center justify-center text-white font-extrabold text-sm shrink-0 shadow-md ring-1 ring-white/20">
                    +{toastStack.length - 2}
                  </div>
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between gap-1">
                      <h4 className="text-[13px] font-bold text-white truncate">
                        +{toastStack.length - 2} More Notifications
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">Earlier</span>
                    </div>
                    <p className="text-xs text-slate-300 truncate mt-0.5">
                      {toastStack.some(t => t.type?.includes('submission') || t.title?.toLowerCase().includes('submission'))
                        ? `${toastStack.length - 2} student submissions waiting for review`
                        : `${toastStack.length - 2} additional notifications in stack`
                      }
                    </p>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/15 hover:bg-white/25 active:bg-white/35 text-white border border-white/25 shadow-md transition-all group-hover:scale-105"
                  >
                    <span>View All</span>
                    <span className="text-xs leading-none">→</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Floating Action Bar matching reference screenshot (Clear All pill + circular (X) button) */}
          <div className="flex items-center justify-center gap-2 pt-0.5 pointer-events-auto">
            <button
              onClick={clearAllToasts}
              className="px-3.5 py-1 rounded-full bg-slate-900/80 dark:bg-black/60 hover:bg-slate-800/95 text-slate-200 hover:text-white text-xs font-semibold backdrop-blur-2xl border border-white/15 shadow-lg transition-all hover:scale-105 active:scale-95 cursor-pointer flex items-center gap-1.5"
            >
              <span>Clear All</span>
            </button>
            <button
              onClick={clearAllToasts}
              className="w-7 h-7 rounded-full bg-slate-900/80 dark:bg-black/60 hover:bg-rose-500/90 text-slate-300 hover:text-white backdrop-blur-2xl border border-white/15 shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 cursor-pointer"
              title="Clear all notifications"
            >
              <X size={13} className="stroke-[2.5]" />
            </button>
          </div>
        </aside>
      )}
    </div>
  );
};

export default Layout;
