export const SOUND_PRESETS = [
  { id: 'whatsapp-chime', number: 1, name: 'Chat Ding', category: 'Messaging', desc: 'Crisp two-note incoming message chime (F#5 → C#6)' },
  { id: 'soft-pop', number: 2, name: 'Soft Bubble Pop', category: 'Messaging', desc: 'Light gentle bubble pop for group or batch chat' },
  { id: 'double-ding', number: 3, name: 'Classic Double Bell', category: 'General', desc: 'Clear double bell chime (C5 → E5)' },
  { id: 'task-chime', number: 4, name: 'Task Pulse Chime', category: 'Academic', desc: 'Three-note rising crystal alert (G5 → B5 → D6)' },
  { id: 'coin-reward', number: 5, name: 'Coin Sparkle', category: 'Rewards', desc: 'Four-note bright arcade coin jackpot chime' },
  { id: 'success-arpeggio', number: 6, name: 'Victory Arpeggio', category: 'Success', desc: 'Warm uplifting four-note chord arpeggio' },
  { id: 'urgent-broadcast', number: 7, name: 'Broadcast Beacon', category: 'Priority', desc: 'Distinct three-pulse tone for announcements' },
  { id: 'warm-marimba', number: 8, name: 'Marimba Warm Tap', category: 'Requests', desc: 'Soft woody two-note interval (D5 → A5)' },
  { id: 'glass-ping', number: 9, name: 'Crystal Glass Ping', category: 'Social', desc: 'Pure shimmering harmonic bell ring (C6)' },
  { id: 'cosmic-sweep', number: 10, name: 'Cyber Sweep', category: 'Modern', desc: 'Smooth rising sci-fi triangle wave chime' },
  { id: 'gentle-alert', number: 11, name: 'Calm Warning Tone', category: 'Warning', desc: 'Calm descending two-tone reminder (E5 → D5)' },
  { id: 'radar-ping', number: 12, name: 'Submission Sonar', category: 'Review', desc: 'Crisp radar ping with soft double echo (B5)' }
];

export const NOTIFICATION_EVENT_TYPES = [
  { key: 'direct_message', label: 'Direct Message (1-on-1)', icon: '💬', roles: 'all' },
  { key: 'group_batch_message', label: 'Group & Batch Chat', icon: '👥', roles: 'all' },
  { key: 'announcement', label: 'Announcement Broadcast', icon: '📢', roles: 'all' },
  { key: 'new_task', label: 'New Task Assigned', icon: '📋', roles: 'all' },
  { key: 'task_graded', label: 'Task Graded / Feedback', icon: '✅', roles: 'all' },
  { key: 'submission', label: 'Student Submission', icon: '📤', roles: 'mentor_admin' },
  { key: 'leave_request', label: 'Leave Request Alert', icon: '🏖️', roles: 'mentor_admin' },
  { key: 'coins_reward', label: 'Coins / Reward Received', icon: '🪙', roles: 'all' },
  { key: 'friend_request', label: 'Friend Request / Accept', icon: '🤝', roles: 'all' },
  { key: 'alert_warning', label: 'Access / Checkout Warning', icon: '⚠️', roles: 'all' }
];

export const DEFAULT_EVENT_SOUNDS = {
  direct_message: 'whatsapp-chime',
  group_batch_message: 'soft-pop',
  announcement: 'urgent-broadcast',
  new_task: 'task-chime',
  task_graded: 'success-arpeggio',
  submission: 'radar-ping',
  leave_request: 'warm-marimba',
  coins_reward: 'coin-reward',
  friend_request: 'glass-ping',
  alert_warning: 'gentle-alert'
};

const STORAGE_KEY = 'ssms_sound_allocations';

class SoundManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.allocations = this.loadAllocations();
  }

  loadAllocations() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_EVENT_SOUNDS, ...parsed };
      }
    } catch {
      // Ignore storage errors
    }
    return { ...DEFAULT_EVENT_SOUNDS };
  }

  saveAllocations(nextMap) {
    this.allocations = { ...DEFAULT_EVENT_SOUNDS, ...nextMap };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.allocations));
    } catch {
      // Ignore storage errors
    }
    return this.allocations;
  }

  getAllocations() {
    return { ...this.allocations };
  }

  setEventSound(eventKey, presetId) {
    return this.saveAllocations({ ...this.allocations, [eventKey]: presetId });
  }

  resetAllocations() {
    return this.saveAllocations({ ...DEFAULT_EVENT_SOUNDS });
  }

  init() {
    if (!this.audioContext) {
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.audioContext = new AudioCtx();
        }
      } catch (e) {
        console.error('AudioContext not supported', e);
      }
    }
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  playTone(frequency, type = 'sine', duration = 0.15, vol = 0.1, delayMs = 0, endFreq = null) {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext) return;

    const trigger = () => {
      if (!this.audioContext || this.audioContext.state !== 'running') return;
      const now = this.audioContext.currentTime;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, now);
      if (endFreq && endFreq !== frequency) {
        oscillator.frequency.exponentialRampToValueAtTime(endFreq, now + duration);
      }

      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(vol, now + 0.012);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + duration);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.start(now);
      oscillator.stop(now + duration + 0.02);
    };

    if (delayMs > 0) {
      setTimeout(trigger, delayMs);
    } else if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().then(trigger).catch(() => {});
    } else {
      trigger();
    }
  }

  playPreset(presetId) {
    switch (presetId) {
      case 'whatsapp-chime':
        this.playTone(739.99, 'sine', 0.12, 0.14, 0);
        this.playTone(1108.73, 'sine', 0.28, 0.16, 100);
        break;
      case 'soft-pop':
        this.playTone(420, 'sine', 0.08, 0.12, 0, 760);
        this.playTone(880, 'triangle', 0.09, 0.06, 70);
        break;
      case 'double-ding':
        this.playTone(523.25, 'sine', 0.14, 0.12, 0);
        this.playTone(659.25, 'sine', 0.28, 0.12, 140);
        break;
      case 'task-chime':
        this.playTone(783.99, 'sine', 0.11, 0.11, 0);
        this.playTone(987.77, 'sine', 0.11, 0.11, 95);
        this.playTone(1174.66, 'sine', 0.26, 0.13, 190);
        break;
      case 'coin-reward':
        this.playTone(659.25, 'triangle', 0.08, 0.11, 0);
        this.playTone(830.61, 'triangle', 0.08, 0.11, 75);
        this.playTone(987.77, 'triangle', 0.08, 0.11, 150);
        this.playTone(1318.51, 'sine', 0.28, 0.14, 225);
        break;
      case 'success-arpeggio':
        this.playTone(440, 'sine', 0.1, 0.09, 0);
        this.playTone(554.37, 'sine', 0.1, 0.09, 85);
        this.playTone(659.25, 'sine', 0.12, 0.1, 170);
        this.playTone(880, 'sine', 0.26, 0.12, 260);
        break;
      case 'urgent-broadcast':
        this.playTone(880, 'triangle', 0.11, 0.12, 0);
        this.playTone(698.46, 'triangle', 0.11, 0.1, 120);
        this.playTone(987.77, 'sine', 0.26, 0.14, 240);
        break;
      case 'warm-marimba':
        this.playTone(587.33, 'triangle', 0.14, 0.12, 0);
        this.playTone(880, 'sine', 0.24, 0.1, 125);
        break;
      case 'glass-ping':
        this.playTone(1046.5, 'sine', 0.34, 0.12, 0);
        this.playTone(2093, 'sine', 0.22, 0.04, 15);
        break;
      case 'cosmic-sweep':
        this.playTone(392, 'triangle', 0.18, 0.1, 0, 784);
        this.playTone(784, 'sine', 0.24, 0.11, 160);
        break;
      case 'gentle-alert':
        this.playTone(659.25, 'sine', 0.14, 0.12, 0);
        this.playTone(523.25, 'sine', 0.24, 0.12, 150);
        break;
      case 'radar-ping':
        this.playTone(987.77, 'sine', 0.18, 0.12, 0);
        this.playTone(987.77, 'sine', 0.16, 0.05, 190);
        break;
      default:
        this.playTone(523.25, 'sine', 0.15, 0.1, 0);
        this.playTone(659.25, 'sine', 0.28, 0.1, 140);
    }
  }

  playForEvent(eventKey) {
    const presetId = this.allocations[eventKey] || DEFAULT_EVENT_SOUNDS[eventKey] || 'double-ding';
    this.playPreset(presetId);
  }

  playWhatsAppIncoming() {
    this.playForEvent('direct_message');
  }

  playWhatsAppOutgoing() {
    this.playTone(850, 'triangle', 0.04, 0.09);
  }

  playClick() {
    this.playTone(600, 'sine', 0.05, 0.05, 0);
    this.playTone(800, 'sine', 0.05, 0.02, 50);
  }

  playNotification() {
    this.playPreset('double-ding');
  }

  playSuccess() {
    this.playForEvent('task_graded');
  }

  playReward() {
    this.playForEvent('coins_reward');
  }
}

export const soundManager = new SoundManager();
