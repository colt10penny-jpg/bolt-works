// Factory chain and all the economy math. Tweak numbers here to rebalance the game.
//
// Supply chain: each factory turns the previous factory's product into its own.
// `need` = units of the previous product used per unit made. A factory can only run as
// fast as its supplier feeds it, so a slow supplier becomes a visible bottleneck.

export const FACTORIES = [
  { id: 'furnace', name: 'Steel Furnace', makes: 'steel',    unit: 'steel',    color: 0xc75b3e, unlock: 0,       baseCost: 4,       growth: 1.07, perLevel: 2,      value: 0.5,    need: 0 },
  { id: 'press',   name: 'Bolt Press',    makes: 'bolts',    unit: 'bolts',    color: 0x4a86c8, unlock: 60,      baseCost: 60,      growth: 1.15, perLevel: 1,      value: 20,     need: 2 },
  { id: 'gear',    name: 'Gear Cutter',   makes: 'gears',    unit: 'gears',    color: 0xe3a93a, unlock: 3000,     baseCost: 3000,     growth: 1.15, perLevel: 0.5,    value: 180,    need: 2 },
  { id: 'engine',  name: 'Engine Line',   makes: 'engines',  unit: 'engines',  color: 0x7f6bbf, unlock: 100000,    baseCost: 100000,    growth: 1.15, perLevel: 0.25,   value: 1440,   need: 2 },
  { id: 'turbine', name: 'Turbine Shop',  makes: 'turbines', unit: 'turbines', color: 0x2fa39a, unlock: 3000000,  baseCost: 3000000,  growth: 1.15, perLevel: 0.125,  value: 17280,  need: 2 },
  { id: 'rocket',  name: 'Rocket Bay',    makes: 'rockets',  unit: 'rockets',  color: 0xe8e4da, unlock: 60000000, baseCost: 60000000, growth: 1.15, perLevel: 0.0625, value: 103680, need: 2 },
];

// Short, true facts shown in each factory's panel.
export const FACTS = {
  furnace: 'Most new steel comes from basic oxygen furnaces, which blow pure oxygen through molten iron to burn off extra carbon.',
  press: 'Most bolts are cold-headed: a machine punches the head into cut steel wire, then the threads are rolled on, which makes them stronger than cut threads.',
  gear: 'Gear teeth are shaped as involute curves, so two meshing gears keep a constant speed ratio as they turn.',
  engine: 'In a piston engine, the crankshaft turns the pistons’ up-and-down motion into rotation.',
  turbine: 'Jet engine turbine blades run in gas hotter than their own melting point. Cooling air through tiny internal channels and ceramic coatings keep them alive.',
  rocket: 'To stay in low Earth orbit, a rocket has to reach about 7.8 km/s, roughly 28,000 km/h.',
};

// Every milestone level doubles a factory's speed.
export const MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];
export const milestoneCount = level => MILESTONES.filter(m => level >= m).length;
export const nextMilestone = level => MILESTONES.find(m => level < m) ?? null;

// Units per second a factory could make if fully supplied.
export function capacity(def, level) {
  if (level <= 0) return 0;
  return def.perLevel * level * Math.pow(2, milestoneCount(level));
}

// Actual flow through the chain given everyone's levels.
// Returns per-factory { cap, made, supplied, used, util } plus total income per second.
export function flow(levels, mult = 1) {
  const out = [];
  let income = 0;
  let upstream = Infinity;
  for (let i = 0; i < FACTORIES.length; i++) {
    const d = FACTORIES[i];
    const cap = capacity(d, levels[d.id] || 0);
    const canFeed = d.need ? upstream / d.need : Infinity;
    const made = Math.min(cap, canFeed);
    out.push({ id: d.id, cap, made, util: cap ? made / cap : 0, starved: cap > 0 && made < cap * 0.98 });
    income += made * d.value * mult;
    upstream = (levels[d.id] || 0) > 0 ? made : 0;
  }
  // how much of each factory's output goes to the next factory vs. piles up as surplus
  for (let i = 0; i < out.length; i++) {
    const next = out[i + 1];
    const used = next && next.cap > 0 ? next.made * FACTORIES[i + 1].need : 0;
    out[i].used = used;
    out[i].surplus = out[i].made > 0 ? Math.max(0, 1 - used / out[i].made) : 0;
  }
  return { per: out, income };
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
  return Math.floor(Math.sqrt(Math.max(0, runEarned) / 4e6));
}
export const THEMES = ['colorado', 'desert', 'moon'];
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
