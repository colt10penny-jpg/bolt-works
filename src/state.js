// Game state: worlds (each its own town), stored money, managers, boosts, contracts,
// launches, and the per-frame tick.
import {
  FACTORIES, ALL, BUILDINGS, flow, upgradeCost, epForRun, EP_BONUS, WORLDS, worldById, BIN_SECONDS, hireCost, inWorld,
} from './economy.js';
import { GAME } from './config.js';
import { CUSTOMERS } from './worlds.js';
import * as storage from './storage.js';

const SAVE_VERSION = 5;
const OLD_KEYS = ['boltworks.save.v4', 'boltworks.save.v3'];

function freshRun() {
  const levels = {};
  for (const f of BUILDINGS) levels[f.id] = f.unlock === 0 ? 1 : 0;
  // bins: money waiting in each building; managers: factories a manager is working at;
  // staff: managers hired at headquarters (working or waiting for a job)
  return { runEarned: 0, levels, made: {}, rocketsBuilt: 0, bins: {}, managers: {}, staff: 0, lastActive: Date.now() };
}

export function freshState() {
  return {
    v: SAVE_VERSION,
    playerId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()),
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    totalEarned: 0,
    cash: 0,             // one wallet shared by every world
    econ: 2,             // economy version (2 = big, costly upgrades)
    current: 'colorado',
    worlds: { colorado: freshRun() },
    ep: 0,               // Engineering Points (permanent, shared by every world)
    epClaimed: 0,        // points already taken from lifetime earnings
    launches: 0,
    boostUntil: 0,
    contract: null,      // active order (in the current world)
    nextContractAt: Date.now() + 90_000,
    contractsDone: 0,
    daily: { lastDay: '', streak: 0 },
    tutorial: { opened: false, collected: false, upgraded: false, done: false },
    settings: { sound: true },
    adsWatched: 0,
    achievements: {},    // id -> time unlocked
    playDays: [],        // calendar days played, for retention stats
  };
}

function mergeRun(saved) {
  const base = freshRun();
  const run = { ...base, ...saved, levels: { ...base.levels, ...(saved?.levels || {}) }, bins: { ...(saved?.bins || {}) }, managers: { ...(saved?.managers || {}) } };
  // older saves hired managers without a headquarters: keep them, and give them an HQ
  const working = Object.keys(run.managers).filter(k => run.managers[k]).length;
  if (saved && saved.staff == null) run.staff = working;
  run.staff = Math.max(run.staff || 0, working);
  if (working && !run.levels.hq) run.levels.hq = 1;
  return run;
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
        if (old && old.v === 4 && old.worlds) {
          // v4 -> v5: launches no longer reset towns; points now come from lifetime earnings
          saved = { ...old, v: SAVE_VERSION, epClaimed: Math.floor(Math.sqrt(Math.max(0, old.totalEarned || 0) / 1e7)) };
          break;
        }
        if (old && old.v === 3 && old.run) {
          const cur = WORLDS[Math.min(old.launches || 0, WORLDS.length - 1)].id;
          const worlds = {};
          for (const w of WORLDS.slice(0, WORLDS.findIndex(x => x.id === cur) + 1)) worlds[w.id] = freshRun();
          worlds[cur] = mergeRun(old.run);
          saved = { ...old, v: SAVE_VERSION, current: cur, worlds, epClaimed: Math.floor(Math.sqrt(Math.max(0, old.totalEarned || 0) / 1e7)) };
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
        achievements: { ...(saved.achievements || {}) },
      };
      this.#migrateEconomy(saved);
    }
    this.invalidate();
  }

  // Saves from before the rebalance: one shared wallet, and levels squeezed onto the
  // new, steeper upgrade scale (old Lv 10 -> 4, Lv 40 -> 8, Lv 128 -> 14).
  #migrateEconomy(saved) {
    const s = this.s;
    if (saved.cash == null || isNaN(saved.cash)) s.cash = Object.values(saved.worlds || {}).reduce((a, r) => a + (r.cash || 0), 0);
    for (const r of Object.values(s.worlds)) delete r.cash;
    if ((saved.econ || 1) < 2) {
      for (const r of Object.values(s.worlds)) {
        for (const f of ALL) { const L = r.levels[f.id] || 0; if (L > 0) r.levels[f.id] = Math.max(1, Math.round(1.2 * Math.sqrt(L))); }
        r.bins = {};
      }
      s.econ = 2;
      s.contract = null;
      this.invalidate();
      // keep a sensible amount of cash for the new prices: about 10 minutes of income
      s.cash = Math.min(s.cash, Math.max(200, this.totalRate() * 600));
      this.rebalanced = true;
    }
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

  // ---- the current world ----
  get run() { return this.s.worlds[this.s.current]; }
  get world() { return worldById(this.s.current); }
  theme() { return this.s.current; }
  unlockedWorlds() { return WORLDS.filter(w => this.s.worlds[w.id]); }

  // ---- derived numbers ----
  invalidate() { this.cache = {}; }
  get cash() { return this.s.cash; }
  get levels() { return this.run.levels; }
  level(id) { return this.levels[id] || 0; }
  built(id) { return this.level(id) > 0; }
  hasManager(id) { return !!this.run.managers[id]; }
  boostLeft(now = Date.now()) { return Math.max(0, this.s.boostUntil - now) / 1000; }
  epMult() { return 1 + this.s.ep * EP_BONUS; }
  mult(now = Date.now()) { return (this.boostLeft(now) > 0 ? 2 : 1) * this.epMult(); }
  // a building's numbers in a world (later worlds cost more)
  defOf(id, worldId = this.s.current) { return inWorld(BUILDINGS.find(f => f.id === id), worldById(worldId)); }
  // flow without the ad boost, cached per world until levels or EP change
  flowFor(worldId) {
    const r = this.s.worlds[worldId];
    if (!r) return null;
    if (!this.cache) this.cache = {};
    return (this.cache[worldId] ||= flow(r.levels, this.epMult(), worldById(worldId).perks));
  }
  baseFlow() { return this.flowFor(this.s.current); }
  info(id) { const f = this.baseFlow(); return f.per.find(p => p.id === id) || f.support[id]; }
  baseRate() { return this.baseFlow().income; }
  // everything every world is making, per second (without the ad boost)
  totalRate() { return Object.keys(this.s.worlds).reduce((a, w) => a + this.flowFor(w).income, 0); }
  rate() { return this.totalRate() * (this.boostLeft() > 0 ? 2 : 1); }
  // money per second one factory earns (with boost)
  earnRate(id, worldId = this.s.current) {
    const d = this.defOf(id, worldId);
    const p = this.flowFor(worldId)?.per.find(x => x.id === id);
    return d && p ? p.made * d.value * this.mult() : 0;
  }
  bin(id) { return this.run.bins[id] || 0; }
  binCap(id, worldId = this.s.current) { return Math.max(10, this.earnRate(id, worldId) * BIN_SECONDS); }
  binFull(id) { return this.bin(id) >= this.binCap(id) - 1e-6; }

  // ---- per-frame production ----
  // Every world runs all the time. Factories with a manager pay straight into the
  // wallet; the rest fill their storage until you come and tap them.
  tick(dt) { this.#produce(dt, true); this.tickContract(dt); }
  #produce(seconds, live) {
    const boost = live ? (this.boostLeft() > 0 ? 2 : 1) : 1;
    let direct = 0;
    for (const [wId, run] of Object.entries(this.s.worlds)) {
      const per = this.flowFor(wId).per;
      const valueMult = worldById(wId).value || 1;
      let mine = 0;
      for (let i = 0; i < per.length; i++) {
        const p = per[i];
        if (!p.made) continue;
        const d = FACTORIES[i];
        const units = p.made * seconds;
        run.made[d.id] = (run.made[d.id] || 0) + units;
        if (d.id === 'rocket') run.rocketsBuilt += units;
        const amount = units * d.value * valueMult * this.epMult() * boost;
        if (run.managers[d.id]) mine += amount;
        else run.bins[d.id] = Math.min(this.binCap(d.id, wId), (run.bins[d.id] || 0) + amount);
      }
      if (mine) { run.runEarned += mine; direct += mine; }
    }
    if (direct) { this.s.cash += direct; this.s.totalEarned += direct; }
    return direct;
  }
  addEarned(n) { this.s.cash += n; this.run.runEarned += n; this.s.totalEarned += n; }

  collect(id) {
    const amount = this.bin(id);
    if (amount <= 0) return 0;
    this.run.bins[id] = 0;
    this.addEarned(amount);
    this.s.tutorial.collected = true;
    this.emit('collected', id, amount);
    return amount;
  }

  canAfford(cost) { return this.s.cash >= cost - 1e-9; }

  buyLevels(id, n) {
    const def = this.defOf(id);
    const lv = this.level(id);
    if (n <= 0 || lv <= 0) return false;
    const cost = upgradeCost(def, lv, n);
    if (!this.canAfford(cost)) return false;
    this.s.cash -= cost;
    this.levels[id] = lv + n;
    this.s.tutorial.upgraded = true;
    this.invalidate();
    this.emit('upgrade', id, lv, lv + n);
    this.emit('change');
    return true;
  }

  build(id) {
    const def = this.defOf(id);
    if (this.built(id) || !this.canAfford(def.unlock)) return false;
    this.s.cash -= def.unlock;
    this.levels[id] = 1;
    this.invalidate();
    this.emit('built', id);
    this.emit('change');
    return true;
  }

  // ---- headquarters and managers ----
  staff() { return this.run.staff || 0; }
  working() { return FACTORIES.filter(f => this.run.managers[f.id]).length; }
  freeManagers() { return Math.max(0, this.staff() - this.working()); }
  nextHireCost() { return hireCost(this.staff()) * (this.world.cost || 1); }
  hire() {
    if (!this.built('hq')) return false;
    const cost = this.nextHireCost();
    if (!this.canAfford(cost)) return false;
    this.s.cash -= cost;
    this.run.staff = this.staff() + 1;
    this.emit('hired');
    this.emit('change');
    return true;
  }
  // send a waiting manager to a factory; they collect its money from then on
  assign(id) {
    if (!FACTORIES.some(f => f.id === id) || !this.built(id) || this.hasManager(id) || this.freeManagers() < 1) return false;
    this.run.managers[id] = true;
    this.collect(id);
    this.emit('manager', id);
    this.emit('change');
    return true;
  }
  recall(id) {
    if (!this.hasManager(id)) return false;
    delete this.run.managers[id];
    this.emit('recall', id);
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
  // While the app is closed (up to the limit), managers keep collecting in every
  // world and the other factories fill up their storage.
  offlineSeconds(now = Date.now()) {
    const from = this.s.lastSeen || now;
    return Math.min(Math.max(0, (now - from) / 1000), GAME.offlineCapHours * 3600);
  }
  // runs the time away; returns what the managers collected (already in the wallet)
  applyOffline(seconds) {
    if (seconds <= 0) return 0;
    return this.#produce(seconds, false);
  }

  // ---- travel between worlds ----
  // Towns you're not in keep earning like they do while the app is closed
  // (up to the warehouse limit); you collect it when you arrive.
  travel(id) {
    if (!this.s.worlds[id] || id === this.s.current) return null;
    this.s.current = id;
    this.s.contract = null;
    this.s.nextContractAt = Date.now() + 60_000;
    this.emit('travel', id);
    this.emit('change');
    return { earned: 0 };
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
    const reward = Math.max(50, target * d.value * (this.world.value || 1) * this.epMult() * 2.5);
    const list = (CUSTOMERS[this.s.current] || CUSTOMERS.colorado)[pick];
    this.s.contract = {
      id: pick, unit: this.unitOf ? this.unitOf(pick) : d.unit, customer: list[Math.floor(Math.random() * list.length)],
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
  // Engineering Points come from everything you've ever earned (all worlds):
  // total points = floor(sqrt(lifetime / 10M)). A launch claims the ones you've
  // earned since last time, so launching often or rarely gives the same total.
  // Launching uses up one rocket and keeps your town as it is.
  pendingEP() { return Math.max(0, epForRun(this.s.totalEarned) - (this.s.epClaimed || 0)); }
  canLaunch() { return this.run.rocketsBuilt >= 1; }
  launchPreview() { return this.pendingEP() * (this.world.perks.ep || 1); }
  nextWorld() {
    const i = WORLDS.findIndex(w => w.id === this.s.current);
    return WORLDS[i + 1] || null;
  }
  launch(adMult = 1) {
    const pending = this.pendingEP();
    const gained = pending * (this.world.perks.ep || 1) * adMult;
    this.s.epClaimed = (this.s.epClaimed || 0) + pending;
    this.s.ep += gained;
    this.s.launches++;
    this.run.rocketsBuilt = Math.max(0, this.run.rocketsBuilt - 1);
    const from = this.s.current;
    const next = this.nextWorld();
    let unlocked = null;
    if (next && !this.s.worlds[next.id]) { this.s.worlds[next.id] = freshRun(); unlocked = next.id; }
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
    const amount = Math.max(60 * streak, this.totalRate() * 90 * streak);
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
