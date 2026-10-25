// Game state: worlds (each its own town), stored money, managers, boosts, contracts,
// launches, and the per-frame tick.
import {
  FACTORIES, ALL, BUILDINGS, flow, upgradeCost, TRADE_STEP, TRADE_MAX, rocketNeed, WORLDS, worldById, BIN_SECONDS, hireCost, vaultHours, inWorld, priceOf,
  isPlot, landCost, roadCost, EXTRA_BUILD, EXTRA_UPGRADE, capacity, totalCap, supplyEff, LEVEL_CAP, buildSecs,
} from './economy.js';
import { blocksApart, plotsOf, plotIds, START_PLOT, PLOT_FOR, EXITS } from './layout.js';
import { townSegments, blockSides, segKey } from './traffic.js';
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
  return { cash: 0, runEarned: 0, levels, pos: {}, at: {}, made: {}, rocketsBuilt: 0, rocketsSent: 0, bins: {}, vault: 0, managers: {}, staff: 0, land: {}, extra: {}, roads: {}, jobs: {}, lastActive: Date.now() };
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
    econ: 10,            // economy version (6 = trade routes, 9 = each world counts its own rockets, 10 = worlds reordered)
    layout: 4,           // town layout version (4 = fixed 3x3 plan, HQ by the mine, two roads out)
    current: 'colorado',
    worlds: { colorado: freshRun() },
    trade: {},           // trade routes: 'colorado|desert' -> level (see TRADE_STEP)
    launches: 0,
    boostUntil: 0,
    contract: null,      // active order (in the current world)
    nextContractAt: Date.now() + 90_000,
    contractsDone: 0,
    daily: { lastDay: '', streak: 0 },
    tutorial: { opened: false, collected: false, upgraded: false, done: false, step: 0, tips: {} },   // step: where the opening tutorial is (-1 = finished)
    settings: { sound: true },
    adsWatched: 0,
    achievements: {},    // id -> time unlocked
    playDays: [],        // calendar days played, for retention stats
  };
}

function mergeRun(saved) {
  const base = freshRun();
  const run = { ...base, ...saved, levels: { ...base.levels, ...(saved?.levels || {}) }, bins: { ...(saved?.bins || {}) }, managers: { ...(saved?.managers || {}) }, land: { ...(saved?.land || {}) }, extra: { ...(saved?.extra || {}) }, pos: { ...(saved?.pos || {}) }, at: { ...(saved?.at || {}) }, roads: { ...(saved?.roads || {}) }, jobs: { ...(saved?.jobs || {}) } };
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
        // saves from before the story tutorial existed skip it (unless nothing's happened yet)
        tutorial: { ...base.tutorial, ...saved.tutorial, step: saved.tutorial?.step ?? ((saved.totalEarned || 0) > 0 ? -1 : 0) },
        settings: { ...base.settings, ...saved.settings },
        achievements: { ...(saved.achievements || {}) },
      };
      this.#migrateEconomy(saved);
      if ((saved.layout || 1) < 2) this.#migrateLayout();
      if ((saved.layout || 1) < 3) this.#migrateToPlan();
      if ((saved.layout || 1) < 4) this.#joinRoads();
    } else this.#startWorld('colorado');
    this.invalidate();
  }

  // v4: the headquarters moved and there are only two roads out of town, so make sure
  // every developed plot still has road all round and is joined to a way out
  #joinRoads() {
    for (const [w, run] of Object.entries(this.s.worlds)) for (const q of Object.keys(run.land || {})) for (const r of this.roadsFor(q, w, run)) run.roads[r.k] = true;
    this.s.layout = 4;
    this.invalidate();
  }

  // ---- building a town ----
  seedFor(w) { return [...(this.s.playerId + w)].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381); }
  exitsOf(w) {
    this.exitCache ||= {};
    return EXITS;
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
    for (const r of list) roads += roadCost(r.kind, built++, this.world) * priceOf(this.world);
    return { land, roads, total: land + roads, list };
  }
  #startWorld(w) {
    const run = this.s.worlds[w] ||= freshRun();
    // every world starts from scratch with its own empty wallet, an Ore Mine on the front
    // corner, and the roads round it fixed up
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

  // Towns move onto the fixed plan: each building to its own spot, one of each. Where a
  // town had extra copies, the best one is kept (its level, storage and manager).
  #migrateToPlan() {
    for (const [w, run] of Object.entries(this.s.worlds)) {
      const best = {};
      for (const id of [...ALL.map(f => f.id), 'hq']) { const L = run.levels?.[id] || 0; if (L > 0) best[id] = { level: L, id }; }
      for (const [id, e] of Object.entries(run.extra || {})) if (e?.level > 0 && (!best[e.type] || e.level > best[e.type].level)) best[e.type] = { level: e.level, id };
      const slotsOfType = t => [t, ...Object.entries(run.extra || {}).filter(([, e]) => e?.type === t).map(([id]) => id)];
      const nr = { ...run, levels: Object.fromEntries(ALL.map(f => [f.id, 0])), pos: {}, at: {}, extra: {}, land: {}, roads: {}, bins: {}, managers: {}, jobs: {} };
      for (const [t, b] of Object.entries(best)) {
        const q = PLOT_FOR[t]; if (!q) continue;
        nr.levels[t] = b.level; nr.pos[t] = q; nr.at[q] = t; nr.land[q] = true;
        const bins = slotsOfType(t).reduce((a, id) => a + (run.bins?.[id] || 0), 0); if (bins) nr.bins[t] = bins;
        if (slotsOfType(t).some(id => run.managers?.[id])) nr.managers[t] = true;
        if (run.jobs?.[b.id]) nr.jobs[t] = run.jobs[b.id];
      }
      this.s.worlds[w] = nr;
      for (const q of Object.keys(nr.land)) for (const r of this.roadsFor(q, w, nr)) nr.roads[r.k] = true;
    }
    this.s.layout = 3;
    this.relaidOut = true;
  }

  // Saves from before the rebalance: one shared wallet, and levels squeezed onto the
  // new, steeper upgrade scale (old Lv 10 -> 4, Lv 40 -> 8, Lv 128 -> 14).
  #migrateEconomy(saved) {
    const s = this.s;
    // v5 saves and later keep a wallet in each world; older ones had one shared wallet
    if ((saved.econ || 1) < 5) {
      const shared = isFinite(saved.cash) ? saved.cash : Object.values(saved.worlds || {}).reduce((a, r) => a + (r.cash || 0), 0);
      for (const r of Object.values(s.worlds)) r.cash = 0;
      this.run.cash = shared || 0;   // the shared money stays in the world you're in
      delete s.cash;
    }
    for (const r of Object.values(s.worlds)) if (!isFinite(r.cash)) r.cash = 0;
    if ((saved.econ || 1) < 2) {
      for (const r of Object.values(s.worlds)) {
        for (const f of ALL) { const L = r.levels[f.id] || 0; if (L > 0) r.levels[f.id] = Math.max(1, Math.round(1.2 * Math.sqrt(L))); }
        r.bins = {};
      }
      s.econ = 2;
      s.contract = null;
      this.invalidate();
      // keep a sensible amount of cash for the new prices: about 10 minutes of income
      this.run.cash = Math.min(this.run.cash, Math.max(200, this.totalRate() * 600));
      this.rebalanced = true;
    }
    // v3: ten levels per building, each one worth about three of the old ones
    if ((saved.econ || 1) < 3) {
      const squeeze = L => L > 0 ? Math.max(1, Math.min(10, Math.ceil((L + 2) / 3))) : 0;
      for (const r of Object.values(s.worlds)) {
        for (const f of ALL) if (r.levels[f.id] > 0 && f.id !== 'hq') r.levels[f.id] = squeeze(r.levels[f.id]);
        for (const e of Object.values(r.extra || {})) if (e?.level > 0) e.level = squeeze(e.level);
      }
      s.econ = 3;
      this.invalidate();
      this.relevelled = true;
    }
    // v4: no level limit, instant upgrades. Ten-level buildings get the level with the
    // same look in the new system (or close to it), and any upgrade in progress finishes.
    if ((saved.econ || 1) < 4) {
      const spread = [0, 1, 3, 5, 8, 10, 18, 25, 50, 75, 100];
      const lift = L => L > 0 ? spread[Math.min(10, L)] : 0;
      for (const r of Object.values(s.worlds)) {
        for (const [id, j] of Object.entries(r.jobs || {})) if (j.kind === 'upgrade') { if (r.levels[id] != null) r.levels[id] = j.to; delete r.jobs[id]; }
        for (const f of ALL) if (r.levels[f.id] > 0) r.levels[f.id] = lift(r.levels[f.id]);
      }
      s.econ = 4;
      s.contract = null;
      this.invalidate();
      this.relevelled4 = true;
    }
    // v5: every world has its own wallet (split above), and worlds all cost the same
    if ((saved.econ || 1) < 5) {
      s.econ = 5;
      if (Object.keys(s.worlds).length > 1) this.walletsSplit = true;
      // a world with no money of its own needs its free Ore Mine to get going
      for (const [w, r] of Object.entries(s.worlds)) {
        if (r.levels.mine > 0 || r.at[START_PLOT]) continue;
        r.levels.mine = 1; r.pos.mine = START_PLOT; r.at[START_PLOT] = 'mine'; r.land[START_PLOT] = true;
        for (const k of this.roadsFor(START_PLOT, w, r)) r.roads[k.k] = true;
      }
      this.invalidate();
    }
    // v6: Engineering Points are gone; worlds trade instead. Every world you'd reached gets a
    // route to the one before it (the rocket that took you there carried the first cargo),
    // and money piled up by the old points is trimmed to about an hour of what each town
    // makes now.
    if ((saved.econ || 1) < 6) {
      s.econ = 6;
      s.trade ||= {};
      const ids = WORLDS.map(w => w.id).filter(w => s.worlds[w]);
      for (let i = 1; i < ids.length; i++) s.trade[this.routeKey(ids[i - 1], ids[i])] = Math.max(1, s.trade[this.routeKey(ids[i - 1], ids[i])] || 0);
      const hadEP = (saved.ep || 0) > 0;
      delete s.ep; delete s.epClaimed;
      this.invalidate();
      if (hadEP) for (const w of ids) { const r = s.worlds[w], hour = this.flowFor(w).income * 3600; r.cash = Math.min(r.cash || 0, Math.max(1000, hour)); r.vault = Math.min(r.vault || 0, hour); }
      if (hadEP || ids.length > 1) this.tradeIntro = true;
    }
    // v8: rockets take a lot more building (see rocketNeed), counted across the whole
    // empire, and a bay holds just one. The count starts from the trade route levels you
    // already have (one rocket each), and any stockpile becomes a single rocket.
    if ((saved.econ || 1) < 8) {
      s.econ = 8;
      s.rocketsSent = Object.values(s.trade || {}).reduce((a, l) => a + l, 0);
      for (const r of Object.values(s.worlds)) { r.rocketsBuilt = Math.min(1, r.rocketsBuilt || 0); delete r.rocketsSent; }
    }
    // v9: each world counts the rockets it has sent itself, so a new world's first rocket is
    // as cheap as the first one ever was. Each trade route level was one rocket from one of
    // its two worlds, so each world is given half of the levels on its routes.
    if ((saved.econ || 1) < 9) {
      s.econ = 9;
      for (const [w, r] of Object.entries(s.worlds)) r.rocketsSent = Math.floor(Object.entries(s.trade || {}).filter(([k]) => k.split('|').includes(w)).reduce((a, [, l]) => a + l, 0) / 2);
      delete s.rocketsSent;
    }
    // v10: the worlds come in a new order (Timberline, the Moon, Mars, the Mojave). A trade
    // route is stored under its two worlds in that order, so file each one under its new name.
    if ((saved.econ || 1) < 10) {
      s.econ = 10;
      const t = {};
      for (const [k, l] of Object.entries(s.trade || {})) { const [a, b] = k.split('|'); const nk = this.routeKey(a, b); t[nk] = Math.max(t[nk] || 0, l); }
      s.trade = t;
      this.invalidate();
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
  get cash() { return this.run.cash; }
  // each world's town has a name the player picks (raw: null if they haven't yet)
  townName(w = this.s.current, raw = false) { return this.s.worlds[w]?.name || (raw ? null : w === 'colorado' ? 'Engineer Empire' : worldById(w).short); }
  setTownName(w, name) { if (this.s.worlds[w]) { this.s.worlds[w].name = name; this.emit('change'); } }
  cashIn(w) { return this.s.worlds[w]?.cash || 0; }
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
  mult(now = Date.now()) { return (this.boostLeft(now) > 0 ? 2 : 1) * this.tradeMult(); }

  // ---- trade routes ----
  routeKey(a, b) { const i = WORLDS.findIndex(w => w.id === a), j = WORLDS.findIndex(w => w.id === b); return i < j ? a + '|' + b : b + '|' + a; }
  routeLevel(a, b) { return a === b ? 0 : this.s.trade?.[this.routeKey(a, b)] || 0; }
  // the other worlds you've reached, with this world's route to each
  routesOf(w = this.s.current) { return WORLDS.filter(o => o.id !== w && this.s.worlds[o.id]).map(o => ({ world: o, level: this.routeLevel(w, o.id) })); }
  tradeMult(w = this.s.current) { return 1 + this.routesOf(w).reduce((a, r) => a + r.level, 0) * TRADE_STEP; }
  // somewhere a rocket can go from here: the next world (not reached yet), or a route that isn't full
  launchTargets() {
    const next = this.nextWorld();
    const out = next && !this.s.worlds[next.id] ? [next.id] : [];
    for (const r of this.routesOf()) if (r.level < TRADE_MAX) out.push(r.world.id);
    return out;
  }
  // a building's numbers in a world (later worlds cost more)
  defOf(id, worldId = this.s.current) { return inWorld(BUILDINGS.find(f => f.id === id), worldById(worldId)); }
  // the numbers for whatever stands in a slot (extra copies cost more)
  slotDef(id, worldId = this.s.current, run = this.s.worlds[worldId]) {
    if (!isPlot(id)) return this.defOf(id, worldId);
    const t = this.typeOf(id, run);
    if (!t) return null;
    const base = this.defOf(t, worldId);
    return { ...base, id, type: t, extra: true, unlock: (base.unlock || 150) * EXTRA_BUILD, baseCost: base.baseCost * EXTRA_UPGRADE, first: undefined };
  }
  extrasOf(run) { return Object.entries(run.extra || {}).filter(([id, e]) => e && e.level > 0 && run.jobs?.[id]?.kind !== 'build').map(([id, e]) => ({ ...e, id, eff: this.effOf(id, run) })); }
  // levels that are actually working: a building still under construction makes nothing yet
  workLevels(run) {
    if (!run.jobs || !Object.keys(run.jobs).length) return run.levels;
    const L = { ...run.levels };
    for (const [id, j] of Object.entries(run.jobs)) if (j.kind === 'build' && !isPlot(id)) L[id] = 0;
    return L;
  }
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
  effOf() { return 1; }   // every building has its set spot now, so distance doesn't change output
  effOfByDistance(id, run = this.run, type, at) {
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
  // flow without the ad boost, cached per world until levels or trade routes change
  flowFor(worldId) {
    const r = this.s.worlds[worldId];
    if (!r) return null;
    if (!this.cache) this.cache = {};
    return (this.cache[worldId] ||= flow(this.workLevels(r), this.tradeMult(worldId), worldById(worldId).perks, this.extrasOf(r), this.effCore(r)));
  }
  baseFlow() { return this.flowFor(this.s.current); }
  // totals for a product type
  typeInfo(type, worldId = this.s.current) { const f = this.flowFor(worldId); return f.per.find(p => p.id === type) || f.support[type]; }
  // this one building's part of its product (it shares the work with its copies)
  share(id, worldId = this.s.current) {
    const run = this.s.worlds[worldId], t = this.typeOf(id, run);
    const d = BUILDINGS.find(f => f.id === t);
    if (!d) return 0;
    const all = totalCap(d, this.workLevels(run), this.extrasOf(run), this.effCore(run));
    const lv = run.jobs?.[id]?.kind === 'build' ? 0 : this.level(id, run);
    return all > 0 ? capacity(d, lv) * this.effOf(id, run) / all : 0;
  }
  info(id) {
    const t = this.typeOf(id); if (!t) return null;
    const e = this.typeInfo(t); if (!e) return null;
    const k = this.share(id);
    return { ...e, made: e.made * k, cap: e.cap * k, total: e.made };
  }
  baseRate() { return this.baseFlow().income; }
  // what the world you're in makes per second (without the ad boost). Each world has its
  // own wallet, so this is the number that matters for prices and rewards.
  totalRate() { return this.flowFor(this.s.current).income; }
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
  // the Ore Mine's lot comes free in every world
  landPrice() { return landCost(Math.max(0, Object.keys(this.run.land).length - 1)) * priceOf(this.world); }
  // develop a plot: buy the land and fix (or build) the roads it needs
  develop(plot) {
    if (!isPlot(plot) || this.run.land[plot]) return false;
    const q = this.developQuote(plot);
    if (!this.canAfford(q.total)) return false;
    this.run.cash -= q.total;
    this.run.land[plot] = true;
    for (const r of q.list) this.run.roads[r.k] = true;
    this.emit('developed', plot);
    if (q.list.length) this.emit('roads', q.list);
    this.emit('change');
    return true;
  }
  extraCost(type) { const b = this.defOf(type); return (b.unlock || 150) * EXTRA_BUILD; }
  // what it costs to put a building of this type on a plot: the first of a kind is the
  // main one (normal price); more copies cost extra. Only one headquarters.
  // one of each building, each on its own spot
  buildCost(type) { return this.built(type) ? Infinity : this.defOf(type).unlock; }
  buildOn(plot, type) {
    if (!isPlot(plot) || !this.run.land[plot] || this.slotAt(plot) || PLOT_FOR[type] !== plot || this.built(type)) return false;
    const cost = this.buildCost(type);
    if (!isFinite(cost) || !this.canAfford(cost)) return false;
    this.run.cash -= cost;
    let id;
    if (!this.built(type)) { this.levels[type] = 1; this.run.pos[type] = plot; this.run.at[plot] = type; id = type; }
    else { this.run.extra[plot] = { type, level: 1 }; id = plot; }
    const secs = buildSecs(type, this.world), now = Date.now();
    (this.run.jobs ||= {})[id] = { kind: 'build', to: 1, start: now, end: now + secs * 1000 };
    this.invalidate();
    this.emit('built', id);
    this.emit('change');
    return true;
  }

  // ---- per-frame production ----
  // Every world runs all the time. Factories with a manager pay straight into the
  // wallet; the rest fill their storage until you come and tap them.
  tick(dt) { this.finishJobs(); this.#produce(dt, true); this.tickContract(dt); }
  #produce(seconds, live) {
    const boost = live ? (this.boostLeft() > 0 ? 2 : 1) : 1;
    const direct = {};   // what managers paid into each world's wallet
    for (const [wId, run] of Object.entries(this.s.worlds)) {
      const per = this.flowFor(wId).per;
        let mine = 0;
      for (let i = 0; i < per.length; i++) {
        const p = per[i];
        if (!p.made) continue;
        const d = FACTORIES[i];
        const units = p.made * seconds;
        run.made[d.id] = (run.made[d.id] || 0) + units;
        if (d.id === 'rocket') run.rocketsBuilt = Math.min(1, (run.rocketsBuilt || 0) + units / rocketNeed(run.rocketsSent));   // one finished rocket at a time
        const amount = units * d.value * this.tradeMult(wId) * boost;
        // split between the main building and any copies on developed land
        const slots = this.slotsOf(d.id, run);
        for (const id of slots) {
          const part = slots.length === 1 ? amount : amount * this.share(id, wId);
          if (run.managers[id]) mine += part;
          else { const have = run.bins[id] || 0; run.bins[id] = Math.max(have, Math.min(this.binCap(id, wId), have + part)); }   // never shrinks money already stored
        }
      }
      // while you play, managers pay straight into that world's own wallet; while you're
      // away they leave it at headquarters (up to its limit) for you to collect
      if (mine && live) { run.runEarned += mine; run.cash = (run.cash || 0) + mine; this.s.totalEarned += mine; direct[wId] = mine; }
      else if (mine) {
        const before = run.vault || 0;
        const cap = mine / seconds * this.vaultHours(wId) * 3600;
        run.vault = Math.max(before, Math.min(cap, before + mine));
        if (run.vault > before) direct[wId] = run.vault - before;
      }
    }
    return direct;
  }
  addEarned(n, w = this.s.current) { const r = this.s.worlds[w]; r.cash = (r.cash || 0) + n; r.runEarned += n; this.s.totalEarned += n; }

  collect(id) {
    const amount = this.bin(id);
    if (amount <= 0) return 0;
    this.run.bins[id] = 0;
    this.addEarned(amount);
    this.s.tutorial.collected = true;
    this.emit('collected', id, amount);
    return amount;
  }

  // ---- headquarters vault: what managers collected while you were away ----
  vault(worldId = this.s.current) { return this.s.worlds[worldId]?.vault || 0; }
  vaultHours(worldId = this.s.current) { return vaultHours(this.level('hq', this.s.worlds[worldId]) || 1); }
  // what the managers in this world make per second (no ad boost)
  managerRate(worldId = this.s.current) {
    const run = this.s.worlds[worldId];
    return Object.keys(run.managers).filter(id => run.managers[id]).reduce((a, id) => a + this.earnRate(id, worldId) / (this.boostLeft() > 0 ? 2 : 1), 0);
  }
  vaultCap(worldId = this.s.current) { return Math.max(this.vault(worldId), this.managerRate(worldId) * this.vaultHours(worldId) * 3600); }
  collectVault(mult = 1) {
    const amount = this.vault() * mult;
    if (amount <= 0) return 0;
    this.run.vault = 0;
    this.addEarned(amount);
    this.emit('change');
    return amount;
  }

  canAfford(cost) { return this.run.cash >= cost - 1e-9; }

  // ---- building work in progress ----
  jobOf(id, run = this.run) { return run.jobs?.[id] || null; }
  jobLeft(id, now = Date.now()) { const j = this.jobOf(id); return j ? Math.max(0, (j.end - now) / 1000) : 0; }
  jobProgress(id, now = Date.now()) { const j = this.jobOf(id); return j ? Math.min(1, Math.max(0, (now - j.start) / Math.max(1, j.end - j.start))) : 1; }
  // finish right away (the "watch an ad to finish" button)
  finishNow(id) { const j = this.jobOf(id); if (!j) return false; j.end = Date.now(); this.finishJobs(); return true; }
  // complete any work whose time is up, in every world
  finishJobs(now = Date.now()) {
    for (const [w, run] of Object.entries(this.s.worlds)) {
      if (!run.jobs) continue;
      for (const [id, j] of Object.entries(run.jobs)) {
        if (j.end > now) continue;
        delete run.jobs[id];
        if (j.kind === 'upgrade') {
          if (isPlot(id)) { if (run.extra[id]) run.extra[id].level = j.to; } else run.levels[id] = j.to;
        }
        this.invalidate();
        if (w === this.s.current) this.emit(j.kind === 'upgrade' ? 'upgrade' : 'constructed', id, j.from || 0, j.to);
        this.emit('change');
      }
    }
  }

  // knock a building down: the lot stays cleared (ready for something else), money in its
  // storage goes to your wallet, and a manager working there goes back to headquarters.
  // If you have another of the same kind, that one becomes the main one.
  demolish(id) {
    const run = this.run, t = this.typeOf(id), plot = this.plotOf(id);
    if (!t || !plot || this.level(id) <= 0) return false;
    if (run.bins[id]) run.cash += run.bins[id];
    delete run.bins[id]; delete run.managers[id]; delete run.jobs?.[id];
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
        if (run.jobs?.[q]) { run.jobs[t] = run.jobs[q]; delete run.jobs[q]; }
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
    if (!def || n <= 0 || lv <= 0 || lv + n > LEVEL_CAP || this.jobOf(id)) return false;
    const cost = upgradeCost(def, lv, n);
    if (!this.canAfford(cost)) return false;
    this.run.cash -= cost;
    // upgrades are instant
    if (isPlot(id)) this.run.extra[id].level = lv + n; else this.run.levels[id] = lv + n;
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
  nextHireCost() { return hireCost(this.staff()) * priceOf(this.world); }
  // you can only hire as many managers as you have factories for them to run
  canHireMore() { return this.staff() < this.factorySlots().length; }
  hire() {
    if (!this.built('hq') || !this.canHireMore()) return false;
    const cost = this.nextHireCost();
    if (!this.canAfford(cost)) return false;
    this.run.cash -= cost;
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
  // runs the time away; returns what the managers left at each world's headquarters
  // ({ worldId: amount })
  applyOffline(seconds) {
    this.finishJobs();
    if (seconds <= 0) return {};
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
    const reward = Math.max(50, target * d.value * this.tradeMult() * 2.5);
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
  // A rocket goes to another world. The first one to a world you haven't reached unlocks
  // it (and opens a trade route there); after that, each rocket sent to a world raises
  // the trade route between the two by a level (`levels`: 2 with the ad). Your town
  // stays as it is.
  hasRocket() { return this.run.rocketsBuilt >= 1; }
  canLaunch() { return this.hasRocket() && this.launchTargets().length > 0; }
  nextWorld() {
    const i = WORLDS.findIndex(w => w.id === this.s.current);
    return WORLDS[i + 1] || null;
  }
  launch(to, levels = 1) {
    if (!this.hasRocket() || !this.launchTargets().includes(to)) return null;
    const from = this.s.current;
    let unlocked = null;
    if (!this.s.worlds[to]) { this.#startWorld(to); unlocked = to; this.s.worlds[to].from = from; }   // the rocket you came in stays parked there
    const k = this.routeKey(from, to), before = this.s.trade[k] || 0;
    this.s.trade[k] = Math.min(TRADE_MAX, before + levels);
    this.s.launches++;
    this.run.rocketsBuilt = 0;
    this.run.rocketsSent = (this.run.rocketsSent || 0) + 1;
    this.invalidate();
    this.emit('launched', to, unlocked);
    this.emit('change');
    return { to, unlocked, from, before, level: this.s.trade[k] };
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
