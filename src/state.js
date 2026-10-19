// Game state: cash, factory levels, boosts, contracts, launches, and the per-frame tick.
import { FACTORIES, ALL, flow, upgradeCost, epForRun, EP_BONUS, themeFor } from './economy.js';
import { GAME } from './config.js';
import * as storage from './storage.js';

const SAVE_VERSION = 3;

function freshRun() {
  const levels = {};
  for (const f of ALL) levels[f.id] = f.unlock === 0 ? 1 : 0;
  return { cash: 0, runEarned: 0, levels, made: {}, rocketsBuilt: 0 };
}

export function freshState() {
  return {
    v: SAVE_VERSION,
    playerId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()),
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    totalEarned: 0,
    run: freshRun(),
    ep: 0,               // Engineering Points (permanent)
    launches: 0,
    boostUntil: 0,
    contract: null,      // active order
    nextContractAt: Date.now() + 90_000,
    contractsDone: 0,
    daily: { lastDay: '', streak: 0 },
    tutorial: { opened: false, upgraded: false, done: false },
    settings: { sound: true },
    adsWatched: 0,
    playDays: [],        // calendar days played, for retention stats
  };
}

export class Game {
  constructor() {
    this.s = freshState();
    this.listeners = {};
    this.cache = null;
  }
  on(evt, fn) { (this.listeners[evt] ||= []).push(fn); }
  emit(evt, ...a) { for (const fn of this.listeners[evt] || []) fn(...a); }

  async load() {
    const saved = await storage.load(GAME.saveKey);
    if (saved && saved.v === SAVE_VERSION) {
      const base = freshState();
      this.s = {
        ...base, ...saved,
        run: { ...base.run, ...saved.run, levels: { ...base.run.levels, ...(saved.run?.levels || {}) } },
        daily: { ...base.daily, ...saved.daily },
        tutorial: { ...base.tutorial, ...saved.tutorial },
        settings: { ...base.settings, ...saved.settings },
      };
    }
    this.invalidate();
  }
  async save() {
    this.s.lastSeen = Date.now();
    await storage.save(GAME.saveKey, this.s);
  }
  async reset() {
    const keep = { playerId: this.s.playerId, firstSeen: this.s.firstSeen, playDays: this.s.playDays };
    await storage.clear(GAME.saveKey);
    this.s = { ...freshState(), ...keep };
    this.invalidate();
    this.emit('reset');
    this.emit('change');
  }

  // ---- derived numbers ----
  invalidate() { this.cache = null; }
  get levels() { return this.s.run.levels; }
  level(id) { return this.levels[id] || 0; }
  built(id) { return this.level(id) > 0; }
  boostLeft(now = Date.now()) { return Math.max(0, this.s.boostUntil - now) / 1000; }
  epMult() { return 1 + this.s.ep * EP_BONUS; }
  mult(now = Date.now()) { return (this.boostLeft(now) > 0 ? 2 : 1) * this.epMult(); }
  theme() { return themeFor(this.s.launches); }
  // flow without the ad boost (cached until levels or EP change)
  baseFlow() {
    if (!this.cache) this.cache = flow(this.levels, this.epMult());
    return this.cache;
  }
  info(id) { const f = this.baseFlow(); return f.per.find(p => p.id === id) || f.support[id]; }
  baseRate() { return this.baseFlow().income; }
  rate() { return this.baseRate() * (this.boostLeft() > 0 ? 2 : 1); }

  // ---- per-frame production ----
  tick(dt) {
    const boost = this.boostLeft() > 0 ? 2 : 1;
    const per = this.baseFlow().per;
    let earned = 0;
    for (let i = 0; i < per.length; i++) {
      const p = per[i];
      if (!p.made) continue;
      const d = FACTORIES[i];
      const units = p.made * dt;
      this.s.run.made[d.id] = (this.s.run.made[d.id] || 0) + units;
      const amount = units * d.value * this.epMult() * boost;
      earned += amount;
      this.emit('produce', d.id, amount, units);
      if (d.id === 'rocket') this.s.run.rocketsBuilt += units;
    }
    this.addEarned(earned);
    this.tickContract(dt);
  }
  addEarned(n) { this.s.run.cash += n; this.s.run.runEarned += n; this.s.totalEarned += n; }

  canAfford(cost) { return this.s.run.cash >= cost - 1e-9; }

  buyLevels(id, n) {
    const def = ALL.find(f => f.id === id);
    const lv = this.level(id);
    if (n <= 0 || lv <= 0) return false;
    const cost = upgradeCost(def, lv, n);
    if (!this.canAfford(cost)) return false;
    this.s.run.cash -= cost;
    this.levels[id] = lv + n;
    this.s.tutorial.upgraded = true;
    this.invalidate();
    this.emit('upgrade', id, lv, lv + n);
    this.emit('change');
    return true;
  }

  build(id) {
    const def = ALL.find(f => f.id === id);
    if (this.built(id) || !this.canAfford(def.unlock)) return false;
    this.s.run.cash -= def.unlock;
    this.levels[id] = 1;
    this.invalidate();
    this.emit('built', id);
    this.emit('change');
    return true;
  }

  addCash(n) { this.addEarned(n); this.emit('change'); }

  addBoost(minutes) {
    const now = Date.now();
    const start = Math.max(now, this.s.boostUntil);
    this.s.boostUntil = Math.min(start + minutes * 60000, now + GAME.boostMaxMinutes * 60000);
    this.emit('change');
  }

  // ---- offline ----
  offlineEarnings(now = Date.now()) {
    const from = this.s.lastSeen || now;
    const elapsed = Math.min(Math.max(0, (now - from) / 1000), GAME.offlineCapHours * 3600);
    const boosted = Math.min(elapsed, Math.max(0, (this.s.boostUntil - from) / 1000));
    return { seconds: elapsed, amount: this.baseRate() * (elapsed + boosted) };
  }
  // production that happened while away also counts toward the active contract and rockets
  applyOfflineProduction(seconds) {
    for (const p of this.baseFlow().per) {
      if (!p.made) continue;
      const units = p.made * seconds;
      this.s.run.made[p.id] = (this.s.run.made[p.id] || 0) + units;
      if (p.id === 'rocket') this.s.run.rocketsBuilt += units;
    }
    this.tickContract(seconds);
  }

  // ---- contracts ----
  tickContract(dt) {
    const c = this.s.contract;
    const now = Date.now();
    if (!c) {
      if (now >= this.s.nextContractAt) this.newContract();
      return;
    }
    if (c.status !== 'active') return;
    const p = this.info(c.id);
    c.progress = Math.min(c.target, c.progress + (p ? p.made * dt : 0));
    if (c.progress >= c.target) { c.status = 'done'; this.emit('contract', c); }
    else if (now >= c.endsAt) { c.status = 'failed'; this.emit('contract', c); }
  }

  newContract() {
    const builtIds = FACTORIES.filter(f => this.built(f.id) && this.info(f.id).made > 0).map(f => f.id);
    if (!builtIds.length) { this.s.nextContractAt = Date.now() + 30_000; return; }
    // favor the newest products
    const pick = builtIds[Math.max(0, builtIds.length - 1 - Math.floor(Math.random() * Math.min(2, builtIds.length)))];
    const d = FACTORIES.find(f => f.id === pick);
    const minutes = [5, 8, 10, 15][Math.floor(Math.random() * 4)];
    const rate = this.info(pick).made;
    // a little more than current output, so the player has to upgrade to make it
    const stretch = 1.15 + Math.random() * 0.6;
    const target = Math.max(5, Math.ceil(rate * minutes * 60 * stretch / 5) * 5);
    const reward = Math.max(50, target * d.value * this.epMult() * 2.5);
    const CUSTOMERS = {
      mine: ['Leadville Smelter', 'Pueblo Steel Mill', 'Front Range Foundry'],
      furnace: ['Pueblo Rail Yard', 'Denver Bridge Crew', 'Golden Shipyard'],
      press: ['Boulder Bike Works', 'Front Range Builders', 'Aurora Stadium'],
      gear: ['Pueblo Wind Farm', 'Clock Tower Repair', 'Rocky Mountain Rail'],
      engine: ['Mile High Motors', 'Vail Snowcat Co.', 'Fort Collins Tractors'],
      turbine: ['Denver Airport Hangar', 'High Plains Power', 'Colorado Air Lines'],
      rocket: ['Space Agency', 'Orbital Freight Co.', 'Lunar Mining Group'],
    }[pick];
    this.s.contract = {
      id: pick, unit: d.unit, customer: CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)],
      target, progress: 0, reward, minutes, startedAt: Date.now(), endsAt: Date.now() + minutes * 60_000, status: 'active',
    };
    this.emit('contract', this.s.contract);
  }

  finishContract(rewardMult = 1) {
    const c = this.s.contract;
    if (!c) return 0;
    let paid = 0;
    if (c.status === 'done') { paid = c.reward * rewardMult; this.addCash(paid); this.s.contractsDone++; }
    this.s.contract = null;
    this.s.nextContractAt = Date.now() + (c.status === 'done' ? 45_000 : 90_000);
    this.emit('change');
    return paid;
  }

  // ---- rocket launch ----
  canLaunch() { return this.s.run.rocketsBuilt >= 1; }
  launchPreview() { return epForRun(this.s.run.runEarned); }
  launch(epMult = 1) {
    const gained = Math.max(1, this.launchPreview()) * epMult;
    this.s.ep += gained;
    this.s.launches++;
    this.s.run = freshRun();
    this.s.contract = null;
    this.s.nextContractAt = Date.now() + 90_000;
    this.invalidate();
    this.emit('launched', gained);
    this.emit('change');
    return gained;
  }

  // ---- daily reward ----
  today() { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; }
  dailyAvailable() { return this.s.daily.lastDay !== this.today(); }
  dailyPreview() {
    const y = new Date(Date.now() - 86400000);
    const yesterday = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    const streak = this.s.daily.lastDay === yesterday ? Math.min(7, this.s.daily.streak + 1) : 1;
    const amount = Math.max(100 * streak, this.baseRate() * 120 * streak);
    return { streak, amount };
  }
  claimDaily(mult = 1) {
    const { streak, amount } = this.dailyPreview();
    this.s.daily = { lastDay: this.today(), streak };
    this.addCash(amount * mult);
    return amount * mult;
  }

  markPlayDay() {
    const t = this.today();
    if (!this.s.playDays.includes(t)) this.s.playDays.push(t);
    if (this.s.playDays.length > 60) this.s.playDays = this.s.playDays.slice(-60);
  }
}
