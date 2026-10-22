// Where the plots are. Every world has the same town plan: a 3 x 3 grid with one fixed
// spot for each factory (as in version 5), plus the headquarters just left of the grid.
// Roads run around every plot. Plot ids are q0 ... q9.
import { BLOCK } from './traffic.js';

// which plot each building stands on
export const PLOT_FOR = {
  mine: 'q0', furnace: 'q1', press: 'q2',
  gear: 'q3', engine: 'q4', power: 'q5',
  rocket: 'q6', turbine: 'q7', datacenter: 'q8',
  hq: 'q9',
};
export const TYPE_AT = Object.fromEntries(Object.entries(PLOT_FOR).map(([t, q]) => [q, t]));
const PLAN = {
  q0: [14, 14], q1: [0, 14], q2: [-14, 14],
  q3: [-14, 0], q4: [0, 0], q5: [14, 0],
  q6: [-14, -14], q7: [0, -14], q8: [14, -14],
  q9: [-14, 28],     // headquarters: just left of the Bolt Press, the grid's left-most corner on screen
};
export function plotsOf() { return PLAN; }
export const plotIds = world => Object.keys(plotsOf(world));
export const isPlot = id => /^q\d+$/.test(id);
// the plot the Ore Mine starts on in Colorado (the front corner, nearest the camera)
export const START_PLOT = 'q0';
export function startView(world) {
  const [x, z] = plotsOf(world)[START_PLOT];
  return [x - 6, z + 1];   // the mine, with the Steel Furnace spot to its left
}
export function boundsOf(world) {
  const ps = Object.values(plotsOf(world));
  const xs = ps.map(p => p[0]), zs = ps.map(p => p[1]);
  return { minX: Math.min(...xs) - 6, maxX: Math.max(...xs) + 6, minZ: Math.min(...zs) - 6, maxZ: Math.max(...zs) + 6 };
}
// blocks apart (along the roads) between two plots
export function blocksApart(world, a, b) {
  const P = plotsOf(world);
  if (!P[a] || !P[b]) return 99;
  return (Math.abs(P[a][0] - P[b][0]) + Math.abs(P[a][1] - P[b][1])) / BLOCK;
}
