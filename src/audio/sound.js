export class Sound {
  constructor() { this.context = null; this.volume = 0.45; }

  setVolume(value) { this.volume = Number(value); }

  play(type) {
    if (this.volume <= 0) return;
    try {
      this.context ||= new (window.AudioContext || window.webkitAudioContext)();
      if (this.context.state === 'suspended') void this.context.resume();
      const now = this.context.currentTime;
      const osc = this.context.createOscillator();
      const gain = this.context.createGain();
      const base = type === 'mine' ? 150 : type === 'place' ? 230 : type === 'jump' ? 200 : 490;
      osc.type = type === 'mine' ? 'sawtooth' : type === 'place' ? 'square' : 'sine';
      osc.frequency.setValueAtTime(base * (0.92 + Math.random() * 0.16), now);
      osc.frequency.exponentialRampToValueAtTime(type === 'mine' ? 85 : base * 1.3, now + 0.09);
      gain.gain.setValueAtTime(0.08 * this.volume, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain).connect(this.context.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch { /* Audio support is optional. */ }
  }

  close() { if (this.context) void this.context.close(); this.context = null; }
}
