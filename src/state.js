// Game state: worlds (each its own town), stored money, managers, boosts, contracts,
// launches, and the per-frame tick.
import {
  FACTORIES, ALL, BUILDINGS, flow, upgradeCost, epForRun, EP_BONUS, WORLDS, worldById, BIN_SECONDS, hireCost, inWorld,
  isPlot, landCost, roadCost, EXTRA_BUILD, EXTRA_UPGRADE, capacity, totalCap, supplyEff, MAX_LEVEL,
} from './economy.js';
import { blocksApart, plotsOf, plotIds, START_PLOT } from './layout.js';
import { makeExits, townSegments, blockSides, segKey } from './traffic.js';
import { GAME } from './config.js';
import { CUSTOMERS } from './worlds.js';
import * as storage from './storage.js';

const SAVE_VERSION = 5;
const OLD_KEYS = ['boltworks.save.v4', 'boltworks.save.v3'];

// A world's town. Everything is built on plots (q0, q1, ...):
//   levels: the first building of each kind; pos: which plot it stands on; at: the reverse
//   extra: further copies, keyed by their plot ({ type, level })
//   land: developed plots; roads: segments in good repair (restored or built)
//   bins: money waiting in each building; managers: buildings a manager runs
//   staff: managers hired at headquarters
function freshRun() {
  const levels = {};
  for (const f of BUILDINGS) levels[f.id] = 0;
  return { runEarned: 0, levels, pos: {}, at: {}, made: {}, rocketsBuilt: 0, bins: {}, managers: {}, staff: 0, land: {}, extra: {}, roads: {}, lastActive: Date.now() };
}
// the old fixed layout (before towns were built by hand), for bringing saves forward
const OLD_CORE = { mine: [28, 28], furnace: [0, 28], press: [-28, 28], gear: [-28, 0], engine: [0, 0], power: [28, 0], rocket: [-28, -28], turbine: [0, -28], datacenter: [28, -28], hq: [14, 14] };
const OLD_PLOTS = (() => {
  const taken = new Set(Object.values(OLD_CORE).map(p => p.join()));
  const all = [];
  for (const x of [-28, -14, 0, 14, 28]) for (const z of [-28, -14, 0, 14, 28]) if (!taken.has(x + ',' + z)) all.push([x, z]);
  all.sort((a, b) => Math.hypot(a[0] - 28, a[1] - 28) - Math.hypot(b[0] - 28, b[1] - 28));
  const m = {}; all.forEach((p, i) => { m['p' + i] = p; }); return m;
})();

export function freshState() {
  return {
    v: SAVE_VERSION,
    playerId: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()),
    firstSeen: Date.now(),
    lastSeen: Date.now(),
    totalEarned: 0,
    cash: 0,             // one wallet shared by every world
    econ: 3,             // economy version (3 = ten big levels per building)
    layout: 2,           // town layout version (2 = towns built plot by plot)
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
  const run = { ...base, ...saved, levels: { ...base.levels, ...(saved?.levels || {}) }, bins: { ...(saved?.bins || {}) }, managers: { ...(saved?.managers || {}) }, land: { ...(saved?.land || {}) }, extra: { ...(saved?.extra || {}) }, pos: { ...(saved?.pos || {}) }, at: { ...(saved?.at || {}) }, roads: { ...(saved?.roads || {}) } };
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
      if ((saved.layout || 1) < 2) this.#migrateLayout();
    } else this.#startWorld('colorado');
    this.invalidate();
  }

  // ---- building a town ----
  seedFor(w) { return [...(this.s.playerId + w)].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381); }
  exitsOf(w) {
    this.exitCache ||= {};
    return (this.exitCache[w + this.s.playerId] ||= makeExits(Object.values(plotsOf(w)), this.seedFor(w)));
  }
  // what shape a stretch of road is in: good, worn (Colorado's old roads), or none
  roadState(k, w = this.s.current, run = this.s.worlds[w]) { return run?.roads[k] ? 'good' : w === 'colorado' ? 'worn' : 'none'; }
  roadsBuilt(run = this.run) { return Object.keys(run.roads).length; }
  // the cheapest roads to fix so a plot is joined to the town (or the way out) and has
  // road on all four sides
  roadsFor(plot, w = this.s.current, run = this.s.worlds[w], skipExit = null) {
    const P = plotsOf(w), segs = townSegments(Object.values(P));
    const k2 = (x, z) => x + ',' + z;
    const adj = new Map();
    for (const [k, { a, b }] of segs) {
      const cost = run.roads[k] ? 0 : this.roadState(k, w, run) === 'worn' ? 1 : 3;
      for (const [p, q] of [[a, b], [b, a]]) { const kk = k2(p.x, p.z); if (!adj.has(kk)) adj.set(kk, []); adj.get(kk).push({ to: k2(q.x, q.z), seg: k, cost }); }
    }
    // start from the ways out of town and everything already joined to them
    const dist = new Map(), via = new Map(), todo = [];
    for (const e of this.exitsOf(w)) { const kk = k2(e.node.x, e.node.z); if (kk === skipExit) continue; dist.set(kk, 0); todo.push(kk); }
    while (todo.length) {
      todo.sort((a, b) => dist.get(a) - dist.get(b));
      const n = todo.shift();
      for (const { to, seg, cost } of adj.get(n) || []) {
        const d = dist.get(n) + cost;
        if (d < (dist.get(to) ?? Infinity)) { dist.set(to, d); via.set(to, { from: n, seg }); todo.push(to); }
      }
    }
    const [cx, cz] = P[plot];
    const sides = blockSides(cx, cz);
    const corners = sides.flatMap(sd => sd.ends.map(e => k2(e.x, e.z)));
    let best = corners[0];
    for (const c of corners) if ((dist.get(c) ?? Infinity) < (dist.get(best) ?? Infinity)) best = c;
    const need = new Set();
    let n = best;
    for (; via.has(n); n = via.get(n).from) need.add(via.get(n).seg);
    this.lastExit = n;   // which way out of town the road leads
    for (const sd of sides) need.add(sd.seg);
    return [...need].filter(k => !run.roads[k]).map(k => ({ k, kind: this.roadState(k, w, run) }));
  }
  developQuote(plot) {
    const land = this.landPrice();
    let built = this.roadsBuilt(), roads = 0;
    const list = this.roadsFor(plot);
    for (const r of list) roads += roadCost(r.kind, built++, this.world);
    return { land, roads, total: land + roads, list };
  }
  #startWorld(w) {
    const run = this.s.worlds[w] ||= freshRun();
    if (w !== 'colorado') return;   // later worlds start as empty land
    // Colorado starts with the Ore Mine on the front corner, and the roads round it fixed up
    run.levels.mine = 1; run.pos.mine = START_PLOT; run.at[START_PLOT] = 'mine'; run.land[START_PLOT] = true;
    for (const r of this.roadsFor(START_PLOT, w, run)) run.roads[r.k] = true;

  }
  // older saves: put the buildings onto the new plots. Colorado (now 4x4) gets its
  // production line laid out in order, side by side; the other worlds keep their places.
  #migrateLayout() {
    for (const [w, old] of Object.entries(this.s.worlds)) {
      const P = plotsOf(w), at = new Map(Object.entries(P).map(([id, p]) => [p.join(), id]));
      const order = [...FACTORIES.map(f => f.id), 'power', 'datacenter', 'hq'];
      const items = [];
      for (const t of order) if ((old.levels[t] || 0) > 0) items.push({ old: t, core: t });
      for (const [id, e] of Object.entries(old.extra || {})) if (e && e.level > 0) items.push({ old: id, type: e.type, level: e.level });
      const run = { ...old, pos: {}, at: {}, extra: {}, land: {}, roads: {}, bins: {}, managers: {} };
      const place = (it, q) => {
        if (it.core) { run.pos[it.core] = q; run.at[q] = it.core; } else run.extra[q] = { type: it.type, level: it.level };
        const newId = it.core || q;
        run.land[q] = true;
        if (old.managers?.[it.old]) run.managers[newId] = true;
        if (old.bins?.[it.old]) run.bins[newId] = old.bins[it.old];
      };
      if (w === 'colorado') {
        // a snake through the 4x4 from the front corner, so each step is next door
        const rows = [21, 7, -7, -21], snake = [];
        rows.forEach((z, i) => (i % 2 ? [-21, -7, 7, 21] : [21, 7, -7, -21]).forEach(x => snake.push(at.get([x, z].join()))));
        items.slice(0, snake.length).forEach((it, i) => place(it, snake[i]));
        for (const it of items.slice(snake.length)) if (it.core) run.levels[it.core] = 0;
        for (const k of townSegments(Object.values(P)).keys()) run.roads[k] = true;
      } else {
        const free = new Set(Object.keys(P));
        for (const it of items) {
          const xy = (it.core ? OLD_CORE[it.core] : OLD_PLOTS[it.old])?.join();
          let q = at.get(xy);
          if (!q || !free.has(q)) q = [...free][0];
          if (!q) continue;
          free.delete(q); place(it, q);
        }
        for (const [id, on] of Object.entries(old.land || {})) { const q = at.get(OLD_PLOTS[id]?.join()); if (on && q) run.land[q] = true; }
        // roads were all there in the old 5x5 town
        const inner = Object.values(P).filter(([x, z]) => Math.abs(x) <= 28 && Math.abs(z) <= 28);
        for (const k of townSegments(inner).keys()) run.roads[k] = true;
      }
      this.s.worlds[w] = run;
    }
    this.s.layout = 2;
    this.relaidOut = true;
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
    // v3: ten levels per building, each one worth about three of the old ones
    if ((saved.econ || 1) < 3) {
      const squeeze = L => L > 0 ? Math.max(1, Math.min(MAX_LEVEL, Math.ceil((L + 2) / 3))) : 0;
      for (const r of Object.values(s.worlds)) {
        for (const f of ALL) if (r.levels[f.id] > 0 && f.id !== 'hq') r.levels[f.id] = squeeze(r.levels[f.id]);
        for (const e of Object.values(r.extra || {})) if (e?.level > 0) e.level = squeeze(e.level);
      }
      s.econ = 3;
      this.invalidate();
      this.relevelled = true;
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
    this.#startWorld('colorado');
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
  // a "slot" is a core building id (mine, hq...) or a plot id (p0..p14)
  typeOf(id, run = this.run) { return isPlot(id) ? run.extra[id]?.type || null : id; }
  // which building stands on a plot (its slot id), and which plot a building is on
  slotAt(plot, run = this.run) { return run.at[plot] || (run.extra[plot]?.level > 0 ? plot : null); }
  plotOf(id, run = this.run) { return isPlot(id) ? id : run.pos[id] || null; }
  level(id, run = this.run) { return isPlot(id) ? run.extra[id]?.level || 0 : run.levels[id] || 0; }
  built(id) { return this.level(id) > 0; }
  developed(plot) { return !!this.run.land[plot]; }
  hasManager(id) { return !!this.run.managers[id]; }
  boostLeft(now = Date.now()) { return Math.max(0, this.s.boostUntil - now) / 1000; }
  epMult() { return 1 + this.s.ep * EP_BONUS; }
  mult(now = Date.now()) { return (this.boostLeft(now) > 0 ? 2 : 1) * this.epMult(); }
  // a building's numbers in a world (later worlds cost more)
  defOf(id, worldId = this.s.current) { return inWorld(BUILDINGS.find(f => f.id === id), worldById(worldId)); }
  // the numbers for whatever stands in a slot (extra copies cost more)
  slotDef(id, worldId = this.s.current, run = this.s.worlds[worldId]) {
    if (!isPlot(id)) return this.defOf(id, worldId);
    const t = this.typeOf(id, run);
    if (!t) return null;
    const base = this.defOf(t, worldId);
    return { ...base, id, type: t, extra: true, unlock: (base.unlock || 150 * (worldById(worldId).cost || 1)) * EXTRA_BUILD, baseCost: base.baseCost * EXTRA_UPGRADE };
  }
  extrasOf(run) { return Object.entries(run.extra || {}).filter(([, e]) => e && e.level > 0).map(([id, e]) => ({ ...e, id, eff: this.effOf(id, run) })); }
  // how well a building is supplied: by distance (in blocks) to the nearest building
  // that makes what it needs. Mines (and support buildings) need nothing.
  // `at`: the plot to measure from (defaults to where the building is)
  supplierOf(id, run = this.run, type = this.typeOf(id, run), at = this.plotOf(id, run)) {
    const i = FACTORIES.findIndex(f => f.id === type);
    if (i <= 0) return null;
    const w = Object.keys(this.s.worlds).find(k => this.s.worlds[k] === run) || this.s.current;
    let best = null;
    for (const s of this.slotsOf(FACTORIES[i - 1].id, run)) { const b = blocksApart(w, at, this.plotOf(s, run)); if (!best || b < best.blocks) best = { id: s, blocks: b }; }
    return best;
  }
  effOf(id, run = this.run, type, at) {
    const sup = this.supplierOf(id, run, type ?? this.typeOf(id, run), at ?? this.plotOf(id, run));
    return sup ? supplyEff(sup.blocks) : 1;
  }
  effCore(run) { const o = {}; for (const f of FACTORIES) if ((run.levels[f.id] || 0) > 0) o[f.id] = this.effOf(f.id, run); return o; }
  // every built slot of a type in a world (the core building first)
  slotsOf(type, run = this.run) {
    const out = (run.levels[type] || 0) > 0 ? [type] : [];
    for (const [id, e] of Object.entries(run.extra || {})) if (e && e.type === type && e.level > 0) out.push(id);
    return out;
  }
  // flow without the ad boost, cached per world until levels or EP change
  flowFor(worldId) {
    const r = this.s.worlds[worldId];
    if (!r) return null;
    if (!this.cache) this.cache = {};
    return (this.cache[worldId] ||= flow(r.levels, this.epMult(), worldById(worldId).perks, this.extrasOf(r), this.effCore(r)));
  }
  baseFlow() { return this.flowFor(this.s.current); }
  // totals for a product type
  typeInfo(type, worldId = this.s.current) { const f = this.flowFor(worldId); return f.per.find(p => p.id === type) || f.support[type]; }
  // this one building's part of its product (it shares the work with its copies)
  share(id, worldId = this.s.current) {
    const run = this.s.worlds[worldId], t = this.typeOf(id, run);
    const d = BUILDINGS.find(f => f.id === t);
    if (!d) return 0;
    const all = totalCap(d, run.levels, this.extrasOf(run), this.effCore(run));
    return all > 0 ? capacity(d, this.level(id, run)) * this.effOf(id, run) / all : 0;
  }
  info(id) {
    const t = this.typeOf(id); if (!t) return null;
    const e = this.typeInfo(t); if (!e) return null;
    const k = this.share(id);
    return { ...e, made: e.made * k, cap: e.cap * k, total: e.made };
  }
  baseRate() { return this.baseFlow().income; }
  // everything every world is making, per second (without the ad boost)
  totalRate() { return Object.keys(this.s.worlds).reduce((a, w) => a + this.flowFor(w).income, 0); }
  rate() { return this.totalRate() * (this.boostLeft() > 0 ? 2 : 1); }
  // money per second one building earns (with boost)
  earnRate(id, worldId = this.s.current) {
    const run = this.s.worlds[worldId], t = this.typeOf(id, run);
    const d = t && this.defOf(t, worldId);
    const p = t && this.flowFor(worldId)?.per.find(x => x.id === t);
    return d && p ? p.made * this.share(id, worldId) * d.value * this.mult() : 0;
  }
  bin(id) { return this.run.bins[id] || 0; }
  binCap(id, worldId = this.s.current) { return Math.max(10, this.earnRate(id, worldId) * BIN_SECONDS); }
  binFull(id) { return this.bin(id) >= this.binCap(id) - 1e-6; }
  factorySlots(run = this.run) { return FACTORIES.flatMap(f => this.slotsOf(f.id, run)); }

  // ---- land ----
  // Colorado's mine plot came free, so it doesn't push the price up
  landPrice() { return landCost(Math.max(0, Object.keys(this.run.land).length - (this.s.current === 'colorado' ? 1 : 0)), this.world); }
  // develop a plot: buy the land and fix (or build) the roads it needs
  develop(plot) {
    if (!isPlot(plot) || this.run.land[plot]) return false;
    const q = this.developQuote(plot);
    if (!this.canAfford(q.total)) return false;
    this.s.cash -= q.total;
    this.run.land[plot] = true;
    for (const r of q.list) this.run.roads[r.k] = true;
    this.emit('developed', plot);
    if (q.list.length) this.emit('roads', q.list);
    this.emit('change');
    return true;
  }
  extraCost(type) { const b = this.defOf(type); return (b.unlock || 150 * (this.world.cost || 1)) * EXTRA_BUILD; }
  // what it costs to put a building of this type on a plot: the first of a kind is the
  // main one (normal price); more copies cost extra. Only one headquarters.
  buildCost(type) { return this.built(type) ? (type === 'hq' ? Infinity : this.extraCost(type)) : this.defOf(type).unlock; }
  buildOn(plot, type) {
    if (!isPlot(plot) || !this.run.land[plot] || this.slotAt(plot)) return false;
    const cost = this.buildCost(type);
    if (!isFinite(cost) || !this.canAfford(cost)) return false;
    this.s.cash -= cost;
    let id;
    if (!this.built(type)) { this.levels[type] = 1; this.run.pos[type] = plot; this.run.at[plot] = type; id = type; }
    else { this.run.extra[plot] = { type, level: 1 }; id = plot; }
    this.invalidate();
    this.emit('built', id);
    this.emit('change');
    return true;
  }

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
        // split between the main building and any copies on developed land
        const slots = this.slotsOf(d.id, run);
        for (const id of slots) {
          const part = slots.length === 1 ? amount : amount * this.share(id, wId);
          if (run.managers[id]) mine += part;
          else run.bins[id] = Math.min(this.binCap(id, wId), (run.bins[id] || 0) + part);
        }
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

  // knock a building down: the lot stays cleared (ready for something else), money in its
  // storage goes to your wallet, and a manager working there goes back to headquarters.
  // If you have another of the same kind, that one becomes the main one.
  demolish(id) {
    const run = this.run, t = this.typeOf(id), plot = this.plotOf(id);
    if (!t || !plot || this.level(id) <= 0) return false;
    if (run.bins[id]) this.s.cash += run.bins[id];
    delete run.bins[id]; delete run.managers[id];
    let promoted = null;
    if (isPlot(id)) delete run.extra[id];
    else {
      delete run.at[plot]; delete run.pos[t]; run.levels[t] = 0;
      const other = Object.entries(run.extra).find(([, e]) => e?.type === t && e.level > 0);
      if (other) {
        const [q, e] = other;
        run.levels[t] = e.level; run.pos[t] = q; run.at[q] = t; delete run.extra[q];
        if (run.bins[q]) { run.bins[t] = run.bins[q]; delete run.bins[q]; }
        if (run.managers[q]) { run.managers[t] = true; delete run.managers[q]; }
        promoted = q;
      }
    }
    this.invalidate();
    this.emit('demolished', plot, t, promoted);
    this.emit('change');
    return true;
  }

  buyLevels(id, n) {
    const def = this.slotDef(id);
    const lv = this.level(id);
    if (!def || n <= 0 || lv <= 0 || lv + n > MAX_LEVEL) return false;
    const cost = upgradeCost(def, lv, n);
    if (!this.canAfford(cost)) return false;
    this.s.cash -= cost;
    if (isPlot(id)) this.run.extra[id].level = lv + n; else this.levels[id] = lv + n;
    this.s.tutorial.upgraded = true;
    this.invalidate();
    this.emit('upgrade', id, lv, lv + n);
    this.emit('change');
    return true;
  }

  // ---- headquarters and managers ----
  staff() { return this.run.staff || 0; }
  working() { return this.factorySlots().filter(id => this.run.managers[id]).length; }
  freeManagers() { return Math.max(0, this.staff() - this.working()); }
  nextHireCost() { return hireCost(this.staff()) * (this.world.cost || 1); }
  // you can only hire as many managers as you have factories for them to run
  canHireMore() { return this.staff() < this.factorySlots().length; }
  hire() {
    if (!this.built('hq') || !this.canHireMore()) return false;
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
    if (!FACTORIES.some(f => f.id === this.typeOf(id)) || !this.built(id) || this.hasManager(id) || this.freeManagers() < 1) return false;
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
    const p = this.typeInfo(c.id);
    c.progress = Math.min(c.target, c.progress + (p ? p.made * dt : 0));
    if (c.progress >= c.target) { c.status = 'done'; this.emit('contract', c); }
    else if (now >= c.endsAt) { c.status = 'failed'; this.emit('contract', c); }
  }

  newContract() {
    const builtIds = FACTORIES.filter(f => this.slotsOf(f.id).length && this.typeInfo(f.id).made > 0).map(f => f.id);
    if (!builtIds.length) { this.s.nextContractAt = Date.now() + 30_000; return; }
    const pick = builtIds[Math.max(0, builtIds.length - 1 - Math.floor(Math.random() * Math.min(2, builtIds.length)))];
    const d = FACTORIES.find(f => f.id === pick);
    const minutes = [5, 8, 10, 15][Math.floor(Math.random() * 4)];
    const rate = this.typeInfo(pick).made;
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
    if (next && !this.s.worlds[next.id]) { this.#startWorld(next.id); unlocked = next.id; }
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
