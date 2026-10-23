// Factory chain and all the economy math. Tweak numbers here to rebalance the game.
//
// Supply chain: each factory turns the previous factory's product into its own.
// `need` = units of the previous product used per unit made. A factory can only run as
// fast as its supplier feeds it, so a slow supplier becomes a visible bottleneck.

// The production chain, in order. Each one turns the previous product into its own.
// Output grows with the level (and doubles at each milestone); each upgrade costs
// `growth` times the one before.
export const FACTORIES = [
  { id: 'mine',    name: 'Ore Mine',      makes: 'iron ore', unit: 'ore',      color: 0x8a6a4f, unlock: 0, baseCost: 6, growth: 1.17, perLevel: 1,        value: 0.4,     need: 0 },
  { id: 'furnace', name: 'Steel Furnace', makes: 'steel',    unit: 'steel',    color: 0xc75b3e, unlock: 90, baseCost: 45, growth: 1.17, perLevel: 0.5,      value: 3,       need: 2 },
  { id: 'press',   name: 'Bolt Press',    makes: 'bolts',    unit: 'bolts',    color: 0x4a86c8, unlock: 3000, baseCost: 1500, growth: 1.17, perLevel: 0.25,     value: 48,      need: 2 },
  { id: 'gear',    name: 'Gear Cutter',   makes: 'gears',    unit: 'gears',    color: 0xe3a93a, unlock: 75000, baseCost: 37500, growth: 1.17, perLevel: 0.125,    value: 720,     need: 2 },
  { id: 'engine',  name: 'Engine Line',   makes: 'engines',  unit: 'engines',  color: 0x7f6bbf, unlock: 1e6, baseCost: 5e5, growth: 1.17, perLevel: 0.0625,   value: 11200,   need: 2 },
  { id: 'turbine', name: 'Turbine Shop',  makes: 'turbines', unit: 'turbines', color: 0x2fa39a, unlock: 1.8e7, baseCost: 9e6, growth: 1.17, perLevel: 0.03125,  value: 160000,  need: 2 },
  { id: 'rocket',  name: 'Rocket Bay',    makes: 'rockets',  unit: 'rockets',  color: 0xe8e4da, unlock: 1.9e8, baseCost: 9.5e7, growth: 1.17, perLevel: 0.015625, value: 2.24e6,  need: 2 },
];

// Support buildings: not part of the chain, they help every factory.
// Power Plant makes electricity (MW). Data Center turns electricity into compute,
// and compute makes every factory run faster.
export const SUPPORT = [
  { id: 'power',      name: 'Power Plant', makes: 'electricity', unit: 'MW',     color: 0x6f8fa8, unlock: 2e6, baseCost: 1e6, growth: 1.17, perLevel: 3, need: 0 },
  { id: 'datacenter', name: 'Data Center', makes: 'compute',     unit: 'PFLOPS', color: 0x3d4b6b, unlock: 4e6, baseCost: 2e6, growth: 1.17, perLevel: 1, need: 3, needUnit: 'MW' },
];
export const ALL = [...FACTORIES, ...SUPPORT];
// Headquarters: where you hire managers and send them out to factories.
export const HQ = { id: 'hq', name: 'Headquarters', makes: 'managers', unit: 'managers', color: 0x5b7a99, unlock: 50000, baseCost: 50000, growth: 1, perLevel: 0, need: 0 };
export const BUILDINGS = [...ALL, HQ];
// Open land around town: develop a plot, then build an extra factory of any kind on it.
export { isPlot } from './layout.js';
// land costs more for each plot you develop (and more in later worlds)
// Every building now needs a plot, so land is cheap at first and rises gently.
export const landCost = developed => 40 * Math.pow(2.3, developed);
// Roads: restoring an old one is cheaper than building one from scratch.
export const roadCost = (kind, built) => 15 * (1 + built * 0.08);
// an extra copy costs more to build and upgrade than the first one
export const EXTRA_BUILD = 2, EXTRA_UPGRADE = 3;
// Each manager you hire costs 6× the one before, starting at $25K, so early on you
// collect by hand for a while. Managers can be moved between factories.
export const hireCost = n => 25000 * Math.pow(6, n);
export const isSupport = id => SUPPORT.some(s => s.id === id);

// Compute speeds up every factory, with diminishing returns:
// 1 PFLOPS = +20%, 3 = +40%, 7 = +60%, 15 = +80%, 31 = +100% ...
export const COMPUTE_STEP = 0.20;
export const speedFromCompute = c => 1 + COMPUTE_STEP * Math.log2(1 + Math.max(0, c));

// Short, true facts shown in each building's panel.
export const FACTS = {
  mine: 'Most iron ore is dug from huge open pits, then crushed and concentrated so it is rich enough to go into a furnace.',
  furnace: 'Most new steel comes from basic oxygen furnaces, which blow pure oxygen through molten iron to burn off extra carbon.',
  press: 'Most bolts are cold-headed: a machine punches the head into cut steel wire, then the threads are rolled on, which makes them stronger than cut threads.',
  gear: 'Gear teeth are shaped as involute curves, so two meshing gears keep a constant speed ratio as they turn.',
  engine: 'In a piston engine, the crankshaft turns the pistons\u2019 up-and-down motion into rotation.',
  turbine: 'Jet engine turbine blades run in gas hotter than their own melting point. Cooling air through tiny internal channels and ceramic coatings keep them alive.',
  rocket: 'To stay in low Earth orbit, a rocket has to reach about 7.8 km/s, roughly 28,000 km/h.',
  power: 'The white plume from a power plant\u2019s cooling tower is water vapor, not smoke: it is heat from the plant leaving as evaporating water.',
  datacenter: 'Data centers spend a big share of their electricity on cooling, because nearly all the power the servers use turns into heat.',
};

// Levels have no limit and every upgrade is instant. At 5, 10, 25, 50, 100 and 250 a
// building gets a new look and doubles its output.
export const MILESTONES = [5, 10, 25, 50, 100, 250];
export const MILESTONE_BOOST = 2;
export const milestoneCount = level => MILESTONES.filter(m => level >= m).length;
export const nextMilestone = level => MILESTONES.find(m => level < m) ?? null;
// how the building looks (the world has ten looks, 0 to 9; each milestone jumps to the next one)
const LOOK_AT = [0, 2, 4, 6, 7, 8, 9];
export const lookTier = level => level > 0 ? LOOK_AT[milestoneCount(level)] : 0;
export const LEVEL_CAP = 10000;   // only to keep numbers finite

// Units per second a building makes at a level (before the compute boost).
export function capacity(def, level) {
  if (level <= 0) return 0;
  return def.perLevel * level * Math.pow(MILESTONE_BOOST, milestoneCount(level));
}

// Actual flow through the town given everyone's levels.
// Returns chain entries { id, cap, made, util, starved, used, surplus }, support entries,
// the compute speed multiplier, and total income per second.
// `extras` are the extra buildings on developed land: [{ type, level }]; they add their
// capacity to that product.
// `effCore` / `e.eff`: how well each building is supplied, from its distance to the
// nearest building that makes what it needs (see supplyEff).
export function totalCap(def, levels, extras = [], effCore = {}) {
  let c = capacity(def, levels[def.id] || 0) * (effCore[def.id] ?? 1);
  for (const e of extras) if (e.type === def.id) c += capacity(def, e.level) * (e.eff ?? 1);
  return c;
}
// Closer suppliers mean shorter truck trips: next door 125%, two blocks 100%,
// three blocks 75%, four or more 50%.
export const supplyEff = blocks => Math.max(0.5, Math.min(1.25, 1 + 0.25 * (2 - blocks)));
export function flow(levels, mult = 1, perks = {}, extras = [], effCore = {}) {
  const pw = SUPPORT[0], dc = SUPPORT[1];
  const powerMade = totalCap(pw, levels, extras, effCore) * (perks.power || 1);
  const dcCap = totalCap(dc, levels, extras, effCore);
  const compute = Math.min(dcCap, powerMade / dc.need);
  const powerUsed = compute * dc.need;
  const speed = speedFromCompute(compute);
  const support = {
    power: { id: 'power', cap: powerMade, made: powerMade, used: powerUsed, util: powerMade ? Math.min(1, powerUsed / powerMade) : 0, starved: false },
    datacenter: { id: 'datacenter', cap: dcCap, made: compute, util: dcCap ? compute / dcCap : 0, starved: dcCap > 0 && compute < dcCap * 0.98 },
  };

  const out = [];
  let income = 0;
  let upstream = Infinity;
  for (let i = 0; i < FACTORIES.length; i++) {
    const d = FACTORIES[i];
    const cap = totalCap(d, levels, extras, effCore) * speed * (perks[d.id] || 1);
    const canFeed = d.need ? upstream / d.need : Infinity;
    const made = Math.min(cap, canFeed);
    out.push({ id: d.id, cap, made, util: cap ? made / cap : 0, starved: cap > 0 && made < cap * 0.98 });
    income += made * d.value * mult;
    upstream = cap > 0 ? made : 0;
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    const used = next && next.cap > 0 ? next.made * FACTORIES[i + 1].need : 0;
    out[i].used = used;
    out[i].surplus = out[i].made > 0 ? Math.max(0, 1 - used / out[i].made) : 0;
  }
  return { per: out, support, speed, compute, income };
}

// Upgrade prices. Each level costs `growth` times the one before up to level KNEE, which
// sets the pace of a new town; then LATE_GROWTH times the one before up to level LINEAR;
// after that each level costs the same fixed amount more than the last (a straight line),
// so the long climb past 100 never runs away.
export const KNEE = 25, LATE_GROWTH = 1.08, LINEAR = 100;
// price of going from `level` to level + 1
export function levelPrice(def, level) {
  const g = def.growth;
  if (level <= KNEE) return def.baseCost * Math.pow(g, level - 1);
  if (level <= LINEAR) return def.baseCost * Math.pow(g, KNEE - 1) * Math.pow(LATE_GROWTH, level - KNEE);
  const p = levelPrice(def, LINEAR);
  return p + (level - LINEAR) * p * (LATE_GROWTH - 1);
}
const geo = (a, r, n) => n <= 0 ? 0 : a * (Math.pow(r, n) - 1) / (r - 1);
// Cost of buying `n` levels starting at `level`.
export function upgradeCost(def, level, n = 1) {
  if (n <= 0) return 0;
  if (def.first && level === 1) return def.first + upgradeCost(def, 2, n - 1);
  if (level <= KNEE) { const k = Math.min(n, KNEE + 1 - level); return geo(levelPrice(def, level), def.growth, k) + upgradeCost(def, level + k, n - k); }
  if (level <= LINEAR) { const k = Math.min(n, LINEAR + 1 - level); return geo(levelPrice(def, level), LATE_GROWTH, k) + upgradeCost(def, level + k, n - k); }
  // an arithmetic run: n prices from levelPrice(level) going up by a fixed step each time
  const a = levelPrice(def, level), step = levelPrice(def, LINEAR) * (LATE_GROWTH - 1);
  return n * a + step * n * (n - 1) / 2;
}
// how many levels you can buy with `cash`
export function maxAffordable(def, level, cash, cap = LEVEL_CAP - level) {
  if (cap <= 0 || cash < upgradeCost(def, level, 1)) return 0;
  let lo = 1, hi = Math.max(1, cap);
  while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (upgradeCost(def, level, mid) <= cash) lo = mid; else hi = mid - 1; }
  return lo;
}

// ---- Rocket launches (prestige) ----
export const EP_BONUS = 0.10; // each Engineering Point = +10% income, forever
export function epForRun(runEarned) {
  return Math.floor(Math.sqrt(Math.max(0, runEarned) / 1e7));
}
export const THEMES = ['colorado', 'desert', 'moon', 'mars'];

// Each world is its own town with its own wallet: you start from scratch (an Ore Mine and
// no money), and money stays in the world it was made in. Launching a rocket unlocks the
// next world, and you can travel back and forth. Every world has the same prices; each
// has a perk so it's worth revisiting.
export const WORLDS = [
  { id: 'colorado', name: 'Golden, Colorado', short: 'Colorado', perk: 'Mountain ore: the Ore Mine digs 50% faster.', perks: { mine: 1.5 } },
  { id: 'desert', name: 'Mojave Test Site', short: 'Mojave', perk: 'Desert sun: the Solar Farm makes 3× electricity.', perks: { power: 3 } },
  { id: 'moon', name: 'Tranquility Base', short: 'Moon', perk: 'Low gravity: rocket launches here give 2× Engineering Points.', perks: { ep: 2 } },
  { id: 'mars', name: 'Jezero Colony', short: 'Mars', perk: 'Dust storms: the Wind Farm makes 3× power, and launches give 3× Engineering Points.', perks: { power: 3, ep: 3 } },
];
// a building's numbers in a given world (the same everywhere now)
export function inWorld(def) { return def; }
export const worldById = id => WORLDS.find(w => w.id === id) || WORLDS[0];

// Factories store the money they make until you tap to collect it.
// Storage holds this many seconds of the building's earnings.
export const BIN_SECONDS = 600;

// Building takes time: a few seconds for the first buildings, longer the further along
// the chain a building is. Every world builds at the same speed. Upgrades are instant.
export const BUILD_SECS = { mine: 5, furnace: 15, hq: 20, press: 40, gear: 75, engine: 120, power: 150, datacenter: 210, turbine: 300, rocket: 420 };
export const buildSecs = type => BUILD_SECS[type] || 30;
// A manager collects automatically for one building.
export const managerCost = def => def.unlock ? def.unlock * 15 : 150;
export const THEME_NAMES = { colorado: 'Golden, Colorado', desert: 'Mojave Test Site', moon: 'Tranquility Base', mars: 'Jezero Colony' };
export const themeFor = launches => THEMES[Math.min(launches, THEMES.length - 1)];

// ---- formatting ----
const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  let i = 0;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + UNITS[i];
}
// Prices round up so the shown price is never less than what you actually need.
export function fmtCost(n) { return n < 1000 ? Math.ceil(n - 1e-9).toString() : fmt(n); }
export function fmtRate(n) { return n < 10 ? n.toFixed(n < 1 ? 2 : 1) : fmt(n); }
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}
