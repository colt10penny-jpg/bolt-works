// Factory definitions and all the economy math. Tweak numbers here to rebalance the game.

export const FACTORIES = [
  { id: 'furnace', name: 'Steel Furnace', makes: 'steel',    color: 0xc75b3e, unlock: 0,       baseCost: 4,        growth: 1.07, revenue: 1,       cycle: 1   },
  { id: 'press',   name: 'Bolt Press',    makes: 'bolts',    color: 0x4a86c8, unlock: 60,      baseCost: 60,       growth: 1.15, revenue: 60,      cycle: 3   },
  { id: 'gear',    name: 'Gear Cutter',   makes: 'gears',    color: 0xe3a93a, unlock: 720,     baseCost: 720,      growth: 1.14, revenue: 540,     cycle: 6   },
  { id: 'engine',  name: 'Engine Line',   makes: 'engines',  color: 0x7f6bbf, unlock: 8640,    baseCost: 8640,     growth: 1.13, revenue: 4320,    cycle: 12  },
  { id: 'turbine', name: 'Turbine Shop',  makes: 'turbines', color: 0x2fa39a, unlock: 103680,  baseCost: 103680,   growth: 1.12, revenue: 51840,   cycle: 24  },
  { id: 'rocket',  name: 'Rocket Bay',    makes: 'rockets',  color: 0xe8e4da, unlock: 1244160, baseCost: 1244160,  growth: 1.11, revenue: 622080,  cycle: 96  },
];

// Every milestone level doubles a factory's speed.
export const MILESTONES = [10, 25, 50, 100, 200, 300, 400, 500];

export function milestoneCount(level) {
  return MILESTONES.filter(m => level >= m).length;
}
export function nextMilestone(level) {
  return MILESTONES.find(m => level < m) ?? null;
}
export function cycleTime(def, level) {
  return def.cycle / Math.pow(2, milestoneCount(level));
}
export function payout(def, level) {
  return def.revenue * level;
}
export function ratePerSec(def, level, mult = 1) {
  if (level <= 0) return 0;
  return (payout(def, level) / cycleTime(def, level)) * mult;
}
// Cost of buying `n` levels starting at `level`.
export function upgradeCost(def, level, n = 1) {
  const r = def.growth;
  return def.baseCost * Math.pow(r, level) * (Math.pow(r, n) - 1) / (r - 1);
}
// How many levels you can afford with `cash` (capped).
export function maxAffordable(def, level, cash, cap = 1000) {
  const r = def.growth;
  const first = def.baseCost * Math.pow(r, level);
  if (cash < first) return 0;
  const n = Math.floor(Math.log(cash * (r - 1) / first + 1) / Math.log(r));
  return Math.min(cap, Math.max(0, n));
}

const UNITS = ['', 'K', 'M', 'B', 'T', 'aa', 'ab', 'ac', 'ad', 'ae', 'af', 'ag'];
export function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 1000) return n < 10 && n % 1 ? n.toFixed(1) : Math.floor(n).toString();
  let i = 0;
  while (n >= 1000 && i < UNITS.length - 1) { n /= 1000; i++; }
  return (n >= 100 ? n.toFixed(0) : n >= 10 ? n.toFixed(1) : n.toFixed(2)) + UNITS[i];
}
export function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h}h ${m}m`;
  if (m) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}
// Prices round up so the shown price is never less than what you actually need.
export function fmtCost(n) { return n < 1000 ? Math.ceil(n - 1e-9).toString() : fmt(n); }
