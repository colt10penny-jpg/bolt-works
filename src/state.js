// Game state: worlds (each its own town), stored money, managers, boosts, contracts,
// launches, and the per-frame tick.
import {
  FACTORIES, ALL, flow, upgradeCost, epForRun, EP_BONUS, WORLDS, worldById, BIN_SECONDS, managerCost,
} from './economy.js';
import { GAME } from './config.js';
import * as storage from './storage.js';

const SAVE_VERSION = 4;
const OLD_KEYS = ['boltworks.save.v3'];

function freshRun() {
  const levels = {};
  for (const f of ALL) levels[f.id] = f.unlock === 0 ? 1 : 0;
  // bins: money waiting in each building; managers: buildings that collect automatically
  return { cash: 0, runEarned: 0, levels, made: {}, rocketsBuilt: 0, bins: {}, managers: {}, lastActive: Date.now() };
}

export function freshState() {
  return {
    v: SAVE_VERSION,
    playerId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()),
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    totalEarned: 0,
    current: 'colorado',
    worlds: { colorado: freshRun() },
    ep: 0,               // Engineering Points (permanent, shared by every world)
    launches: 0,
    boostUntil: 0,
    contract: null,      // active order (in the current world)
    nextContractAt: Date.now() + 90_000,
    contractsDone: 0,
    daily: { lastDay: '', streak: 0 },
    tutorial: { opened: false, collected: false, upgraded: false, done: false },
    settings: { sound: true },
    adsWatched: 0,
    playDays: [],        // calendar days played, for retention stats
  };
}

function mergeRun(saved) {
  const base = freshRun();
  return { ...base, ...saved, levels: { ...base.levels, ...(saved?.levels || {}) }, bins: { ...(saved?.bins || {}) }, managers: { ...(saved?.managers || {}) } };
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
    let saved = await storage.load(GAME.saveKey);
    // bring a version-3 save forward: its single town becomes the world it was on
    if (!saved) {
      for (const k of OLD_KEYS) {
        const old = await storage.load(k);
        if (old && old.v === 3 && old.run) {
          const cur = WORLDS[Math.min(old.launches || 0, WORLDS.length - 1)].id;
          const worlds = {};
          for (const w of WORLDS.slice(0, WORLDS.findIndex(x => x.id === cur) + 1)) worlds[w.id] = freshRun();
          worlds[cur] = mergeRun(old.run);
          saved = { ...old, v: SAVE_VERSION, current: cur, worlds };
          delete saved.run;
          break;
        }
      }
    }
    if (saved && saved.v === SAVE_VERSION) {
      const base = freshState();
      const worlds = {};
      for (const [k, v] of Object.entries(saved.worlds || {})) worlds[k] = mergeRun(v);
      if (!Object.keys(worlds).length) worlds.colorado = freshRun();
      this.s = {
        ...base, ...saved, worlds,
        current: worlds[saved.current] ? saved.current : Object.keys(worlds)[0],
        daily: { ...base.daily, ...saved.daily },
        tutorial: { ...base.tutorial, ...saved.tutorial },
        settings: { ...base.settings, ...saved.settings },
      };
    }
    this.invalidate();
  }
  async save() {
    this.s.lastSeen = Date.now();
    this.run.lastActive = Date.now();
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

  // ---- the current world ----
  get run() { return this.s.worlds[this.s.current]; }
  get world() { return worldById(this.s.current); }
  theme() { return this.s.current; }
  unlockedWorlds() { return WORLDS.filter(w => this.s.worlds[w.id]); }

  // ---- derived numbers ----
  invalidate() { this.cache = null; }
  get levels() { return this.run.levels; }
  level(id) { return this.levels[id] || 0; }
  built(id) { return this.level(id) > 0; }
  hasManager(id) { return !!this.run.managers[id]; }
  boostLeft(now = Date.now()) { return Math.max(0, this.s.boostUntil - now) / 1000; }
  epMult() { return 1 + this.s.ep * EP_BONUS; }
  mult(now = Date.now()) { return (this.boostLeft(now) > 0 ? 2 : 1) * this.epMult(); }
  // flow without the ad boost (cached until levels, EP or world change)
  baseFlow() {
    if (!this.cache) this.cache = flow(this.levels, this.epMult(), this.world.perks);
    return this.cache;
  }
  flowFor(worldId) {
    const r = this.s.worlds[worldId];
    return r ? flow(r.levels, this.epMult(), worldById(worldId).perks) : null;
  }
  info(id) { const f = this.baseFlow(); return f.per.find(p => p.id === id) || f.support[id]; }
  baseRate() { return this.baseFlow().income; }
  rate() { return this.baseRate() * (this.boostLeft() > 0 ? 2 : 1); }
  // money per second one factory earns (with boost)
  earnRate(id) {
    const d = FACTORIES.find(f => f.id === id);
    const p = this.info(id);
    return d && p ? p.made * d.value * this.mult() : 0;
  }
  bin(id) { return this.run.bins[id] || 0; }
  binCap(id) { return Math.max(10, this.earnRate(id) * BIN_SECONDS); }
  binFull(id) { return this.bin(id) >= this.binCap(id) - 1e-6; }

  // ---- per-frame production ----
  tick(dt) {
    const boost = this.boostLeft() > 0 ? 2 : 1;
    const per = this.baseFlow().per;
    const run = this.run;
    let direct = 0;
    for (let i = 0; i < per.length; i++) {
      const p = per[i];
      if (!p.made) continue;
      const d = FACTORIES[i];
      const units = p.made * dt;
      run.made[d.id] = (run.made[d.id] || 0) + units;
      if (d.id === 'rocket') run.rocketsBuilt += units;
      const amount = units * d.value * this.epMult() * boost;
      if (run.managers[d.id]) direct += amount;
      else {
        const cap = this.binCap(d.id);
        run.bins[d.id] = Math.min(cap, (run.bins[d.id] || 0) + amount);
      }
    }
    if (direct) this.addEarned(direct);
    this.tickContract(dt);
  }
  addEarned(n) { this.run.cash += n; this.run.runEarned += n; this.s.totalEarned += n; }

  collect(id) {
    const amount = this.bin(id);
    if (amount <= 0) return 0;
    this.run.bins[id] = 0;
    this.addEarned(amount);
    this.s.tutorial.collected = true;
    this.emit('collected', id, amount);
    return amount;
  }

  canAfford(cost) { return this.run.cash >= cost - 1e-9; }

  buyLevels(id, n) {
    const def = ALL.find(f => f.id === id);
    const lv = this.level(id);
    if (n <= 0 || lv <= 0) return false;
    const cost = upgradeCost(def, lv, n);
    if (!this.canAfford(cost)) return false;
    this.run.cash -= cost;
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
    this.run.cash -= def.unlock;
    this.levels[id] = 1;
    this.invalidate();
    this.emit('built', id);
    this.emit('change');
    return true;
  }

  hireManager(id) {
    const def = FACTORIES.find(f => f.id === id);
    if (!def || !this.built(id) || this.hasManager(id)) return false;
    const cost = managerCost(def);
    if (!this.canAfford(cost)) return false;
    this.run.cash -= cost;
    this.run.managers[id] = true;
    this.collect(id);
    this.emit('manager', id);
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

  // ---- offline (the warehouse keeps everything while the app is closed) ----
  offlineEarnings(now = Date.now()) {
    const from = this.s.lastSeen || now;
    const elapsed = Math.min(Math.max(0, (now - from) / 1000), GAME.offlineCapHours * 3600);
    const boosted = Math.min(elapsed, Math.max(0, (this.s.boostUntil - from) / 1000));
    return { seconds: elapsed, amount: this.baseRate() * (elapsed + boosted) };
  }
  applyOfflineProduction(seconds) {
    const run = this.run;
    for (const p of this.baseFlow().per) {
      if (!p.made) continue;
      const units = p.made * seconds;
      run.made[p.id] = (run.made[p.id] || 0) + units;
      if (p.id === 'rocket') run.rocketsBuilt += units;
    }
    this.tickContract(seconds);
  }

  // ---- travel between worlds ----
  // Towns you're not in keep earning like they do while the app is closed
  // (up to the warehouse limit); you collect it when you arrive.
  travel(id) {
    if (!this.s.worlds[id] || id === this.s.current) return null;
    this.run.lastActive = Date.now();
    this.s.current = id;
    this.s.contract = null;
    this.s.nextContractAt = Date.now() + 60_000;
    this.invalidate();
    const run = this.run;
    const elapsed = Math.min(Math.max(0, (Date.now() - (run.lastActive || Date.now())) / 1000), GAME.offlineCapHours * 3600);
    let earned = 0;
    if (elapsed > 30) {
      earned = this.baseRate() * elapsed;
      for (const p of this.baseFlow().per) {
        if (!p.made) continue;
        run.made[p.id] = (run.made[p.id] || 0) + p.made * elapsed;
        if (p.id === 'rocket') run.rocketsBuilt += p.made * elapsed;
      }
      this.addEarned(earned);
    }
    run.lastActive = Date.now();
    this.emit('travel', id, earned, elapsed);
    this.emit('change');
    return { earned, elapsed };
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
    const pick = builtIds[Math.max(0, builtIds.length - 1 - Math.floor(Math.random() * Math.min(2, builtIds.length)))];
    const d = FACTORIES.find(f => f.id === pick);
    const minutes = [5, 8, 10, 15][Math.floor(Math.random() * 4)];
    const rate = this.info(pick).made;
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
  canLaunch() { return this.run.rocketsBuilt >= 1; }
  launchPreview() { return Math.max(1, epForRun(this.run.runEarned)) * (this.world.perks.ep || 1); }
  nextWorld() {
    const i = WORLDS.findIndex(w => w.id === this.s.current);
    return WORLDS[i + 1] || null;
  }
  // Launching resets this world's town for Engineering Points and, the first time,
  // unlocks the next world.
  launch(adMult = 1) {
    const gained = this.launchPreview() * adMult;
    this.s.ep += gained;
    this.s.launches++;
    const from = this.s.current;
    this.s.worlds[from] = freshRun();
    const next = this.nextWorld();
    let unlocked = null;
    if (next && !this.s.worlds[next.id]) { this.s.worlds[next.id] = freshRun(); unlocked = next.id; }
    this.s.contract = null;
    this.s.nextContractAt = Date.now() + 90_000;
    this.invalidate();
    this.emit('launched', gained, unlocked);
    this.emit('change');
    return { gained, unlocked, from };
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
