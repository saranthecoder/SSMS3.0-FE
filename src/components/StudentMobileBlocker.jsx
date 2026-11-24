import { useState, useEffect } from 'react';
import { Laptop, Smartphone, AlertTriangle, Copy, Check, LogOut, RefreshCw, Monitor, ArrowRight } from 'lucide-react';

const StudentMobileBlocker = ({ onLogout }) => {
  const [copied, setCopied] = useState(false);
  const [screenWidth, setScreenWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 0);

  useEffect(() => {
    const handleResize = () => {
      setScreenWidth(window.innerWidth);
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const portalUrl = 'https://ssms.saranv.in/login';

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(portalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleManualRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-9999 bg-slate-900 text-white flex items-center justify-center p-4 sm:p-6 overflow-y-auto selection:bg-indigo-500/30">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial from-indigo-900/30 via-slate-900 to-black pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-md w-full bg-slate-800/90 border border-slate-700/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl text-center space-y-6 animate-scaleUp">
        {/* Device Icons Comparison Header */}
        <div className="flex items-center justify-center gap-3">
          <div className="relative p-3.5 bg-rose-500/15 border border-rose-500/30 rounded-2xl text-rose-400">
            <Smartphone size={28} className="animate-pulse" />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-rose-600 rounded-full flex items-center justify-center text-[10px] font-black text-white">
              ✕
            </div>
          </div>

          <div className="text-slate-500 font-bold text-xs uppercase tracking-widest flex items-center gap-1">
            <ArrowRight size={14} />
          </div>

          <div className="relative p-3.5 bg-emerald-500/15 border border-emerald-500/40 rounded-2xl text-emerald-400 shadow-lg shadow-emerald-500/10">
            <Laptop size={28} />
            <div className="absolute -top-1 -right-1 w-5 h-5 bg-emerald-600 rounded-full flex items-center justify-center text-[10px] font-black text-white">
              ✓
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertTriangle size={13} /> Mobile Access Restricted
          </span>
        </div>

        {/* Title and Explanation */}
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Laptop or Desktop Required
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
            The <strong className="text-white">SSMS Student Portal</strong> is strictly optimized for laptop and desktop screens. It cannot be used on mobile devices.
          </p>
        </div>

        {/* Why Box */}
        <div className="bg-slate-900/80 border border-slate-700/60 rounded-2xl p-4 text-left space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-200 font-bold">
            <Monitor size={15} className="text-indigo-400 shrink-0" />
            <span>Why is mobile access restricted?</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Curriculum task submissions, interactive code editors, batch discussions, and proctored modules require a physical keyboard, mouse, and minimum display resolution of 1024px.
          </p>

          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Detected Width: <strong className="text-amber-400">{screenWidth}px</strong></span>
            <span>Required: <strong className="text-emerald-400">1024px+</strong></span>
          </div>
        </div>

        {/* Quick Instructions & Copy URL */}
        <div className="space-y-3">
          <div className="bg-slate-900/90 border border-slate-700 rounded-xl p-2.5 flex items-center justify-between gap-2 font-mono text-xs text-slate-300">
            <span className="truncate text-[11px] text-slate-300 select-all">{portalUrl}</span>
            <button
              type="button"
              onClick={handleCopyLink}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={12} className="text-emerald-300" /> Copied!
                </>
              ) : (
                <>
                  <Copy size={12} /> Copy Link
                </>
              )}
            </button>
          </div>
          <p className="text-[11px] text-slate-400">
            Copy the link above and open it on your laptop to start your session.
          </p>
        </div>

        {/* Actions */}
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} /> Re-check Display
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <LogOut size={14} /> Log Out
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentMobileBlocker;
