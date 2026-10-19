/* =====================================================================
   AUDIO — tiny synthesized cues, no assets
   ===================================================================== */
export const AudioFX = {
  ctx: null, muted:false,
  unlock() { if (this.ctx) return; try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.ctx = null; } },
  tone(freq, dur, type, vol, delay) {
    const c = this.ctx; if (!c||this.muted) return; const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  },
  thunk() {
    const c = this.ctx; if (!c||this.muted) return; const t = c.currentTime, len = 0.12;
    const buf = c.createBuffer(1, c.sampleRate * len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = 420; g.gain.value = 0.9;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
    this.tone(92, 0.16, 'sine', 0.35);
  },
  tick() { this.tone(820, 0.05, 'triangle', 0.08); },
  snip() { this.tone(1400, 0.05, 'square', 0.05); this.tone(900, 0.07, 'square', 0.04, 0.03); },
  perfect() { this.tone(784, 0.18, 'sine', 0.18); this.tone(1175, 0.26, 'sine', 0.14, 0.07); },
  power() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', 0.14, i * 0.07)); },
  fall() { const c = this.ctx; if (!c||this.muted) return; const t = c.currentTime, o = c.createOscillator(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(300, t); o.frequency.exponentialRampToValueAtTime(70, t + 0.45);
    g.gain.setValueAtTime(0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 0.52); },
};
