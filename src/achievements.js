// Achievements: checked a few times a second, saved in game.s.achievements.
import { FACTORIES, WORLDS } from './economy.js';

const anyRun = (g, fn) => Object.values(g.s.worlds).some(fn);
const maxLevel = g => Math.max(0, ...Object.values(g.s.worlds).flatMap(r => Object.entries(r.levels).filter(([k]) => k !== 'hq').map(([, v]) => v)));

export const ACHIEVEMENTS = [
  { id: 'first_cash', name: 'First Paycheck', desc: 'Collect money from a building', test: g => g.s.tutorial.collected },
  { id: 'chain3', name: 'Chain Reaction', desc: 'Have 3 factories running in one world', test: g => anyRun(g, r => FACTORIES.filter(f => r.levels[f.id] > 0).length >= 3) },
  { id: 'chain7', name: 'Full Production Line', desc: 'Build all 7 factories in one world', test: g => anyRun(g, r => FACTORIES.every(f => r.levels[f.id] > 0)) },
  { id: 'hq', name: 'Corner Office', desc: 'Build a headquarters', test: g => anyRun(g, r => r.levels.hq > 0) },
  { id: 'manager1', name: 'Middle Management', desc: 'Send your first manager to a factory', test: g => anyRun(g, r => Object.values(r.managers).some(Boolean)) },
  { id: 'manager7', name: 'Fully Staffed', desc: 'Have a manager at all 7 factories in one world', test: g => anyRun(g, r => FACTORIES.every(f => r.managers[f.id])) },
  { id: 'land1', name: 'Breaking Ground', desc: 'Develop a plot of open land', test: g => anyRun(g, r => Object.keys(r.land || {}).length >= 1) },
  { id: 'extra1', name: 'Expansion', desc: 'Build an extra factory on developed land', test: g => anyRun(g, r => Object.values(r.extra || {}).some(e => e?.level > 0)) },
  { id: 'land5', name: 'Land Baron', desc: 'Develop 5 plots in one world', test: g => anyRun(g, r => Object.keys(r.land || {}).length >= 5) },
  { id: 'power', name: 'Lights On', desc: 'Build your first power source', test: g => anyRun(g, r => r.levels.power > 0) },
  { id: 'compute', name: 'Thinking Machine', desc: 'Get compute flowing to your factories', test: g => anyRun(g, r => r.levels.datacenter > 0 && r.levels.power > 0) },
  { id: 'lv10', name: 'Getting Serious', desc: 'Get any building to level 10', test: g => maxLevel(g) >= 10 },
  { id: 'lv20', name: 'Top of the Line', desc: 'Get any building to level 20', test: g => maxLevel(g) >= 20 },
  { id: 'order1', name: 'Order Up', desc: 'Fill your first order', test: g => g.s.contractsDone >= 1 },
  { id: 'order10', name: 'Reliable Supplier', desc: 'Fill 10 orders', test: g => g.s.contractsDone >= 10 },
  { id: 'million', name: 'Millionaire', desc: 'Earn $1M in total', test: g => g.s.totalEarned >= 1e6 },
  { id: 'billion', name: 'Billionaire', desc: 'Earn $1B in total', test: g => g.s.totalEarned >= 1e9 },
  { id: 'trillion', name: 'Trillionaire', desc: 'Earn $1T in total', test: g => g.s.totalEarned >= 1e12 },
  { id: 'launch1', name: 'Liftoff', desc: 'Launch your first rocket', test: g => g.s.launches >= 1 },
  { id: 'launch5', name: 'Frequent Flyer', desc: 'Launch 5 rockets', test: g => g.s.launches >= 5 },
  { id: 'desert', name: 'Desert Pioneer', desc: `Reach ${WORLDS[1].name}`, test: g => !!g.s.worlds.desert },
  { id: 'moon', name: 'One Small Step', desc: `Reach ${WORLDS[2].name}`, test: g => !!g.s.worlds.moon },
  { id: 'streak7', name: 'Regular', desc: 'Collect the daily delivery 7 days in a row', test: g => g.s.daily.streak >= 7 },
];

// returns the achievements newly earned since last check
export function checkAchievements(game) {
  const got = game.s.achievements ||= {};
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (got[a.id]) continue;
    let ok = false;
    try { ok = a.test(game); } catch { ok = false; }
    if (ok) { got[a.id] = Date.now(); fresh.push(a); }
  }
  return fresh;
}
