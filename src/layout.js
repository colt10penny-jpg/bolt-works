// Where the plots are in each world, and how big each town can grow.
//   Colorado: 4 x 4 plots.   Mojave: 5 x 5.   Moon: 5 x 5 plus a row along the
//   back-left and the back-right (35 plots).
// Roads run around every plot. Plot ids are q0, q1, ... (nearest the camera first).
import { BLOCK } from './traffic.js';

const grid = vals => vals.flatMap(x => vals.map(z => [x, z]));
const SHAPES = {
  colorado: grid([-21, -7, 7, 21]),
  desert: grid([-28, -14, 0, 14, 28]),
  moon: [...grid([-28, -14, 0, 14, 28]), ...[-28, -14, 0, 14, 28].map(z => [-42, z]), ...[-28, -14, 0, 14, 28].map(x => [x, -42])],
};
const cache = {};
export function plotsOf(world) {
  if (cache[world]) return cache[world];
  const list = (SHAPES[world] || SHAPES.colorado).slice().sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]) || b[0] - a[0]);
  const m = {};
  list.forEach((p, i) => { m['q' + i] = p; });
  return (cache[world] = m);
}
export const plotIds = world => Object.keys(plotsOf(world));
export const isPlot = id => /^q\d+$/.test(id);
// the plot the Ore Mine starts on in Colorado (the front corner, nearest the camera)
export const START_PLOT = 'q0';
export function startView(world) {
  const [x, z] = plotsOf(world)[START_PLOT];
  return [x - 5, z - 4];
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
