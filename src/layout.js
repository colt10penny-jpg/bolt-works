// Where every building and plot sits in town (shared by the game rules and the 3D world).
// 5x5 town grid with a block of open land between the factories. The chain snakes:
// mine -> furnace -> press, gear -> engine, turbine -> rocket; power and the data
// centre sit on the right, headquarters in the middle. The other 15 blocks are land
// you can develop for extra factories.
export const LOTS = {
  mine: [28, 28], furnace: [0, 28], press: [-28, 28],
  gear: [-28, 0], engine: [0, 0], power: [28, 0],
  rocket: [-28, -28], turbine: [0, -28], datacenter: [28, -28],
  hq: [14, 14],
};
{
  const taken = new Set(Object.values(LOTS).map(p => p.join()));
  let i = 0;
  // plots nearest the starting corner come first
  const all = [];
  for (const x of [-28, -14, 0, 14, 28]) for (const z of [-28, -14, 0, 14, 28]) if (!taken.has(x + ',' + z)) all.push([x, z]);
  all.sort((a, b) => Math.hypot(a[0] - 28, a[1] - 28) - Math.hypot(b[0] - 28, b[1] - 28));
  for (const p of all) LOTS['p' + i++] = p;
}
export const START = [23, 24];   // where the camera starts: by the Ore Mine
// blocks apart (along the roads) between two lots
export const blocksApart = (a, b) => (Math.abs(LOTS[a][0] - LOTS[b][0]) + Math.abs(LOTS[a][1] - LOTS[b][1])) / 14;
