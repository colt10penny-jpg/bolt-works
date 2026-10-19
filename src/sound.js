// Small synthesized sound effects (no audio files) plus phone vibration.
// Browsers only allow sound after the first tap, so the audio context starts lazily.
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

const native = Capacitor.isNativePlatform();
let ctx = null, master = null, enabled = true;

function audio() {
  if (!enabled) return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.35;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}
addEventListener('pointerdown', () => { if (enabled) audio(); }, { once: true, capture: true });

function tone(freq, start, dur, { type = 'sine', vol = 0.5, slide = 0 } = {}) {
  const a = audio(); if (!a) return;
  const t0 = a.currentTime + start;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(start, dur, { vol = 0.4, freq = 400 } = {}) {
  const a = audio(); if (!a) return;
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource(); src.buffer = buf;
  const f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = a.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(master);
  src.start(a.currentTime + start);
}

function buzz(kind) {
  if (!native) return;
  try {
    if (kind === 'success') Haptics.notification({ type: NotificationType.Success }).catch(() => {});
    else Haptics.impact({ style: kind === 'heavy' ? ImpactStyle.Heavy : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Light }).catch(() => {});
  } catch { /* no haptics */ }
}

export const sfx = {
  setEnabled(on) { enabled = on; if (!on && ctx) ctx.suspend().catch(() => {}); },
  tap() { tone(660, 0, 0.06, { type: 'triangle', vol: 0.25 }); buzz('light'); },
  coin() { tone(1320, 0, 0.07, { type: 'square', vol: 0.08 }); tone(1760, 0.05, 0.09, { type: 'square', vol: 0.07 }); },
  upgrade() { tone(523, 0, 0.09, { type: 'triangle', vol: 0.4 }); tone(784, 0.07, 0.14, { type: 'triangle', vol: 0.4 }); buzz('light'); },
  milestone() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.07, 0.16, { type: 'triangle', vol: 0.4 })); buzz('success'); },
  build() { noise(0, 0.25, { vol: 0.6, freq: 300 }); tone(110, 0, 0.3, { type: 'sine', vol: 0.6, slide: 0.5 }); tone(880, 0.18, 0.2, { type: 'triangle', vol: 0.35 }); buzz('medium'); },
  contract() { [659, 784, 988, 1319].forEach((f, i) => tone(f, i * 0.09, 0.2, { type: 'square', vol: 0.12 })); buzz('success'); },
  fail() { tone(330, 0, 0.18, { type: 'triangle', vol: 0.3, slide: 0.7 }); },
  launch() { noise(0, 5.5, { vol: 0.9, freq: 220 }); tone(55, 0, 5, { type: 'sawtooth', vol: 0.15, slide: 1.8 }); buzz('heavy'); },
  reward() { [784, 988, 1175].forEach((f, i) => tone(f, i * 0.08, 0.18, { type: 'triangle', vol: 0.35 })); buzz('success'); },
};
