class SoundManager {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
  }

  init() {
    if (!this.audioContext) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioContext = new AudioContext();
      } catch (e) {
        console.error('AudioContext not supported', e);
      }
    }
  }

  playTone(frequency, type, duration, vol = 0.1) {
    if (!this.enabled) return;
    this.init();
    if (!this.audioContext || this.audioContext.state === 'suspended') return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(vol, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  playWhatsAppIncoming() {
    // Iconic high-clarity WhatsApp notification chime (F#5: 739.99Hz, C#6: 1108.73Hz)
    this.playTone(739.99, 'sine', 0.12, 0.15);
    setTimeout(() => this.playTone(1108.73, 'sine', 0.28, 0.18), 100);
  }

  playWhatsAppOutgoing() {
    // Iconic WhatsApp gentle outgoing message sent "pop"
    this.playTone(850, 'triangle', 0.04, 0.09);
  }

  playClick() {
    // A short, subtle "pop" or "click" sound
    this.playTone(600, 'sine', 0.05, 0.05);
    setTimeout(() => this.playTone(800, 'sine', 0.05, 0.02), 50);
  }

  playNotification() {
    // A pleasant double-chime "ding-ding" for notifications
    this.playTone(523.25, 'sine', 0.15, 0.1); // C5
    setTimeout(() => this.playTone(659.25, 'sine', 0.3, 0.1), 150); // E5
  }

  playSuccess() {
    // A rising arpeggio
    this.playTone(440, 'sine', 0.1, 0.05); // A4
    setTimeout(() => this.playTone(554.37, 'sine', 0.1, 0.05), 100); // C#5
    setTimeout(() => this.playTone(659.25, 'sine', 0.2, 0.05), 200); // E5
  }
}

export const soundManager = new SoundManager();
