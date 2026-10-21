// Factory chain and all the economy math. Tweak numbers here to rebalance the game.
//
// Supply chain: each factory turns the previous factory's product into its own.
// `need` = units of the previous product used per unit made. A factory can only run as
// fast as its supplier feeds it, so a slow supplier becomes a visible bottleneck.

// The production chain, in order. Each one turns the previous product into its own.
// Every upgrade is a big step: output x1.5 (`mult`) for a price that rises x1.9
// (`growth`), so upgrades are few, costly, and you feel each one.
export const FACTORIES = [
  { id: 'mine',    name: 'Ore Mine',      makes: 'iron ore', unit: 'ore',      color: 0x8a6a4f, unlock: 0,     baseCost: 6,     growth: 2.2,  mult: 1.5, perLevel: 1,        value: 0.4,     need: 0 },
  { id: 'furnace', name: 'Steel Furnace', makes: 'steel',    unit: 'steel',    color: 0xc75b3e, unlock: 90,    baseCost: 55,    growth: 2.15, mult: 1.5, perLevel: 0.5,      value: 3,       need: 2 },
  { id: 'press',   name: 'Bolt Press',    makes: 'bolts',    unit: 'bolts',    color: 0x4a86c8, unlock: 1500,  baseCost: 900,   growth: 2.1,  mult: 1.5, perLevel: 0.25,     value: 48,      need: 2 },
  { id: 'gear',    name: 'Gear Cutter',   makes: 'gears',    unit: 'gears',    color: 0xe3a93a, unlock: 27000, baseCost: 16000, growth: 2.05, mult: 1.5, perLevel: 0.125,    value: 720,     need: 2 },
  { id: 'engine',  name: 'Engine Line',   makes: 'engines',  unit: 'engines',  color: 0x7f6bbf, unlock: 4.2e5, baseCost: 2.5e5, growth: 2.0,  mult: 1.5, perLevel: 0.0625,   value: 11200,   need: 2 },
  { id: 'turbine', name: 'Turbine Shop',  makes: 'turbines', unit: 'turbines', color: 0x2fa39a, unlock: 4.5e6, baseCost: 2.7e6, growth: 1.95, mult: 1.5, perLevel: 0.03125,  value: 160000,  need: 2 },
  { id: 'rocket',  name: 'Rocket Bay',    makes: 'rockets',  unit: 'rockets',  color: 0xe8e4da, unlock: 5.2e7, baseCost: 3.1e7, growth: 1.9,  mult: 1.5, perLevel: 0.015625, value: 2.24e6,  need: 2 },
];

// Support buildings: not part of the chain, they help every factory.
// Power Plant makes electricity (MW). Data Center turns electricity into compute,
// and compute makes every factory run faster.
export const SUPPORT = [
  { id: 'power',      name: 'Power Plant', makes: 'electricity', unit: 'MW',     color: 0x6f8fa8, unlock: 150000, baseCost: 90000,  growth: 2.0, mult: 1.5, perLevel: 3, need: 0 },
  { id: 'datacenter', name: 'Data Center', makes: 'compute',     unit: 'PFLOPS', color: 0x3d4b6b, unlock: 400000, baseCost: 250000, growth: 2.0, mult: 1.5, perLevel: 1, need: 3, needUnit: 'MW' },
];
export const ALL = [...FACTORIES, ...SUPPORT];
// Headquarters: where you hire managers and send them out to factories.
export const HQ = { id: 'hq', name: 'Headquarters', makes: 'managers', unit: 'managers', color: 0x5b7a99, unlock: 400, baseCost: 400, growth: 1, perLevel: 0, need: 0 };
export const BUILDINGS = [...ALL, HQ];
// Open land around town: develop a plot, then build an extra factory of any kind on it.
export { isPlot } from './layout.js';
// land costs more for each plot you develop (and more in later worlds)
// Every building now needs a plot, so land is cheap at first and rises gently.
export const landCost = (developed, world) => 40 * Math.pow(2.3, developed) * (world?.cost || 1);
// Roads: restoring an old one is cheaper than building one from scratch.
export const roadCost = (kind, built, world) => (kind === 'none' ? 45 : 15) * (1 + built * 0.08) * (world?.cost || 1);
// an extra copy costs more to build and upgrade than the first one
export const EXTRA_BUILD = 2, EXTRA_UPGRADE = 3;
// Each manager you hire costs 10× the one before. Managers can be moved between factories.
export const hireCost = n => 100 * Math.pow(10, n);
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

// Ten levels per building, and every one is a big step that changes how it looks.
// The numbers above are written per "small step"; each real level is three of them:
// output x mult^3, and the price of a level is three small steps' worth.
export const MAX_LEVEL = 10;
for (const d of [...FACTORIES, ...SUPPORT]) {
  const g = d.growth;
  d.baseCost *= 1 + g + g * g;
  d.growth = g * g * g;
  d.mult = Math.pow(d.mult || 1.5, 3);
}
// how the building looks: one new look per level (0 at level 1, 9 at level 10)
export const lookTier = level => Math.max(0, Math.min(MAX_LEVEL, level) - 1);
// kept for older code: every level is a milestone now
export const MILESTONES = Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2);
export const milestoneCount = lookTier;
export const nextMilestone = level => level < MAX_LEVEL ? level + 1 : null;

// Units per second a building makes at a level (before the compute boost).
export function capacity(def, level) {
  if (level <= 0) return 0;
  return def.perLevel * Math.pow(def.mult || 1.5, level - 1);
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
    income += made * d.value * (perks.value || 1) * mult;
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

// Cost of buying `n` levels starting at `level` (the next one costs baseCost * growth^(level-1)).
export function upgradeCost(def, level, n = 1) {
  const r = def.growth;
  return def.baseCost * Math.pow(r, level - 1) * (Math.pow(r, n) - 1) / (r - 1);
}
export function maxAffordable(def, level, cash, cap = MAX_LEVEL - level) {
  const r = def.growth;
  const first = def.baseCost * Math.pow(r, level - 1);
  if (cash < first) return 0;
  const n = Math.floor(Math.log(cash * (r - 1) / first + 1) / Math.log(r));
  return Math.min(cap, Math.max(0, n));
}

// ---- Rocket launches (prestige) ----
export const EP_BONUS = 0.10; // each Engineering Point = +10% income, forever
export function epForRun(runEarned) {
  return Math.floor(Math.sqrt(Math.max(0, runEarned) / 1e7));
}
export const THEMES = ['colorado', 'desert', 'moon'];

// Each world is its own town. Launching a rocket unlocks the next one, and you can
// travel back and forth. Each has a perk so it's worth revisiting.
// Each later world costs much more to build in than it pays back, so it's a real step up.
export const WORLDS = [
  { id: 'colorado', name: 'Golden, Colorado', short: 'Colorado', perk: 'Mountain ore: the Ore Mine digs 50% faster.', perks: { mine: 1.5 }, cost: 1, value: 1 },
  { id: 'desert', name: 'Mojave Test Site', short: 'Mojave', perk: 'Desert sun: the Solar Farm makes 3× electricity.', perks: { power: 3, value: 12 }, cost: 40, value: 12 },
  { id: 'moon', name: 'Tranquility Base', short: 'Moon', perk: 'Low gravity: rocket launches here give 2× Engineering Points.', perks: { ep: 2, value: 150 }, cost: 1600, value: 150 },
];
// a building's numbers in a given world (prices scale up in later worlds)
export function inWorld(def, world) {
  if (!def || !world || world.cost === 1) return def;
  return { ...def, unlock: def.unlock * world.cost, baseCost: def.baseCost * world.cost, value: def.value !== undefined ? def.value * world.value : def.value };
}
export const worldById = id => WORLDS.find(w => w.id === id) || WORLDS[0];

// Factories store the money they make until you tap to collect it.
// Storage holds this many seconds of the building's earnings.
export const BIN_SECONDS = 600;
// A manager collects automatically for one building.
export const managerCost = def => def.unlock ? def.unlock * 15 : 150;
export const THEME_NAMES = { colorado: 'Golden, Colorado', desert: 'Mojave Test Site', moon: 'Tranquility Base' };
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
