// Game state: cash, factory levels, boosts, and the per-frame production tick.
import { FACTORIES, cycleTime, payout, ratePerSec, upgradeCost } from './economy.js';
import { GAME } from './config.js';
import * as storage from './storage.js';

export function freshState() {
  const factories = {};
  for (const f of FACTORIES) factories[f.id] = { level: f.unlock === 0 ? 1 : 0, progress: 0 };
  return { v: 1, cash: 0, totalEarned: 0, factories, boostUntil: 0, lastSeen: Date.now(), adsWatched: 0 };
}

export class Game {
  constructor() {
    this.s = freshState();
    this.listeners = {};
  }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...a) { for (const fn of this.listeners[evt] || []) fn(...a); }

  async load() {
    const saved = await storage.load(GAME.saveKey);
    if (saved && saved.v === 1) {
      const base = freshState();
      this.s = { ...base, ...saved, factories: { ...base.factories, ...saved.factories } };
    }
  }
  async save() {
    this.s.lastSeen = Date.now();
    await storage.save(GAME.saveKey, this.s);
  }
  async reset() {
    await storage.clear(GAME.saveKey);
    this.s = freshState();
    this.emit('change');
  }

  level(id) { return this.s.factories[id].level; }
  built(id) { return this.level(id) > 0; }
  boostLeft(now = Date.now()) { return Math.max(0, this.s.boostUntil - now) / 1000; }
  mult(now = Date.now()) { return this.boostLeft(now) > 0 ? 2 : 1; }

  baseRate() {
    let r = 0;
    for (const f of FACTORIES) r += ratePerSec(f, this.level(f.id));
    return r;
  }
  rate() { return this.baseRate() * this.mult(); }

  tick(dt) {
    const m = this.mult();
    for (const f of FACTORIES) {
      const st = this.s.factories[f.id];
      if (st.level <= 0) continue;
      st.progress += dt / cycleTime(f, st.level);
      if (st.progress >= 1) {
        const cycles = Math.floor(st.progress);
        st.progress -= cycles;
        const amount = payout(f, st.level) * cycles * m;
        this.s.cash += amount;
        this.s.totalEarned += amount;
        this.emit('payout', f.id, amount);
      }
    }
  }

  canAfford(cost) { return this.s.cash >= cost - 1e-9; }

  buyLevels(id, n) {
    const def = FACTORIES.find(f => f.id === id);
    const st = this.s.factories[id];
    if (n <= 0) return false;
    const cost = upgradeCost(def, st.level, n);
    if (!this.canAfford(cost)) return false;
    const before = st.level;
    this.s.cash -= cost;
    st.level += n;
    this.emit('upgrade', id, before, st.level);
    this.emit('change');
    return true;
  }

  build(id) {
    const def = FACTORIES.find(f => f.id === id);
    const st = this.s.factories[id];
    if (st.level > 0 || !this.canAfford(def.unlock)) return false;
    this.s.cash -= def.unlock;
    st.level = 1;
    st.progress = 0;
    this.emit('built', id);
    this.emit('change');
    return true;
  }

  addCash(n) { this.s.cash += n; this.s.totalEarned += n; this.emit('change'); }

  addBoost(minutes) {
    const now = Date.now();
    const start = Math.max(now, this.s.boostUntil);
    const capped = Math.min(start + minutes * 60000, now + GAME.boostMaxMinutes * 60000);
    this.s.boostUntil = capped;
    this.emit('change');
  }

  // Earnings while the app was closed. Boost time that overlapped counts double.
  offlineEarnings(now = Date.now()) {
    const from = this.s.lastSeen || now;
    const elapsed = Math.min(Math.max(0, (now - from) / 1000), GAME.offlineCapHours * 3600);
    const boosted = Math.min(elapsed, Math.max(0, (this.s.boostUntil - from) / 1000));
    const base = this.baseRate();
    return { seconds: elapsed, amount: base * (elapsed + boosted) };
  }
}
