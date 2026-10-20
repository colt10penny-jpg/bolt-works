// Factory chain and all the economy math. Tweak numbers here to rebalance the game.
//
// Supply chain: each factory turns the previous factory's product into its own.
// `need` = units of the previous product used per unit made. A factory can only run as
// fast as its supplier feeds it, so a slow supplier becomes a visible bottleneck.

// The production chain, in order. Each one turns the previous product into its own.
export const FACTORIES = [
  { id: 'mine',    name: 'Ore Mine',      makes: 'iron ore', unit: 'ore',      color: 0x8a6a4f, unlock: 0,         baseCost: 4,         growth: 1.07, perLevel: 4,      value: 0.25,   need: 0 },
  { id: 'furnace', name: 'Steel Furnace', makes: 'steel',    unit: 'steel',    color: 0xc75b3e, unlock: 25,        baseCost: 25,        growth: 1.09, perLevel: 2,      value: 1.5,    need: 2 },
  { id: 'press',   name: 'Bolt Press',    makes: 'bolts',    unit: 'bolts',    color: 0x4a86c8, unlock: 200,       baseCost: 200,       growth: 1.15, perLevel: 1,      value: 20,     need: 2 },
  { id: 'gear',    name: 'Gear Cutter',   makes: 'gears',    unit: 'gears',    color: 0xe3a93a, unlock: 4000,      baseCost: 4000,      growth: 1.15, perLevel: 0.5,    value: 180,    need: 2 },
  { id: 'engine',  name: 'Engine Line',   makes: 'engines',  unit: 'engines',  color: 0x7f6bbf, unlock: 120000,    baseCost: 120000,    growth: 1.15, perLevel: 0.25,   value: 1440,   need: 2 },
  { id: 'turbine', name: 'Turbine Shop',  makes: 'turbines', unit: 'turbines', color: 0x2fa39a, unlock: 5000000,   baseCost: 5000000,   growth: 1.15, perLevel: 0.125,  value: 17280,  need: 2 },
  { id: 'rocket',  name: 'Rocket Bay',    makes: 'rockets',  unit: 'rockets',  color: 0xe8e4da, unlock: 120000000, baseCost: 120000000, growth: 1.15, perLevel: 0.0625, value: 103680, need: 2 },
];

// Support buildings: not part of the chain, they help every factory.
// Power Plant makes electricity (MW). Data Center turns electricity into compute,
// and compute makes every factory run faster.
export const SUPPORT = [
  { id: 'power',      name: 'Power Plant', makes: 'electricity', unit: 'MW',     color: 0x6f8fa8, unlock: 100000,  baseCost: 100000,  growth: 1.13, perLevel: 3, need: 0 },
  { id: 'datacenter', name: 'Data Center', makes: 'compute',     unit: 'PFLOPS', color: 0x3d4b6b, unlock: 300000,  baseCost: 300000,  growth: 1.14, perLevel: 1, need: 3, needUnit: 'MW' },
];
export const ALL = [...FACTORIES, ...SUPPORT];
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

// Every milestone level doubles a building's speed.
export const MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];
export const milestoneCount = level => MILESTONES.filter(m => level >= m).length;
export const nextMilestone = level => MILESTONES.find(m => level < m) ?? null;

// Units per second a building could make if fully supplied (before the compute boost).
export function capacity(def, level) {
  if (level <= 0) return 0;
  return def.perLevel * level * Math.pow(2, milestoneCount(level));
}

// Actual flow through the town given everyone's levels.
// Returns chain entries { id, cap, made, util, starved, used, surplus }, support entries,
// the compute speed multiplier, and total income per second.
export function flow(levels, mult = 1, perks = {}) {
  const pw = SUPPORT[0], dc = SUPPORT[1];
  const powerMade = capacity(pw, levels.power || 0) * (perks.power || 1);
  const dcCap = capacity(dc, levels.datacenter || 0);
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
    const cap = capacity(d, levels[d.id] || 0) * speed * (perks[d.id] || 1);
    const canFeed = d.need ? upstream / d.need : Infinity;
    const made = Math.min(cap, canFeed);
    out.push({ id: d.id, cap, made, util: cap ? made / cap : 0, starved: cap > 0 && made < cap * 0.98 });
    income += made * d.value * mult;
    upstream = (levels[d.id] || 0) > 0 ? made : 0;
  }
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    const used = next && next.cap > 0 ? next.made * FACTORIES[i + 1].need : 0;
    out[i].used = used;
    out[i].surplus = out[i].made > 0 ? Math.max(0, 1 - used / out[i].made) : 0;
  }
  return { per: out, support, speed, compute, income };
}

// Cost of buying `n` levels starting at `level`.
export function upgradeCost(def, level, n = 1) {
  const r = def.growth;
  return def.baseCost * Math.pow(r, level) * (Math.pow(r, n) - 1) / (r - 1);
}
export function maxAffordable(def, level, cash, cap = 1000) {
  const r = def.growth;
  const first = def.baseCost * Math.pow(r, level);
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
export const WORLDS = [
  { id: 'colorado', name: 'Golden, Colorado', short: 'Colorado', perk: 'Mountain ore: the Ore Mine digs 50% faster.', perks: { mine: 1.5 } },
  { id: 'desert', name: 'Mojave Test Site', short: 'Mojave', perk: 'Desert sun: the Solar Farm makes 3× electricity.', perks: { power: 3 } },
  { id: 'moon', name: 'Tranquility Base', short: 'Moon', perk: 'Low gravity: rocket launches here give 2× Engineering Points.', perks: { ep: 2 } },
];
export const worldById = id => WORLDS.find(w => w.id === id) || WORLDS[0];

// Factories store the money they make until you tap to collect it.
// Storage holds this many seconds of the building's earnings.
export const BIN_SECONDS = 300;
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
