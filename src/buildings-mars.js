// The Mars colony, from the same kit as the other worlds (see buildings.js), with its own
// look so it reads nothing like the Mojave: crisp white and teal pressurised buildings on
// dark basalt footings, glowing green greenhouse domes, glass skybridges, cyan light
// strips, tall white wind turbines and frosty ice. These are the models named in
// worlds.js (SKINS.mars).
import * as THREE from 'three';
import { BUILDERS, box, cyl } from './models.js';
import { DARK, IRON, HAZ, GLASS, shade, mesh, at, rod, onWall, signBoard, railing, pipe, tank, lattice, spokeWheel } from './buildings.js';

const WH = 0xeef1f4, TEAL = 0x2fb5a0, BASALT = 0x2e2220, CYAN = 0x6fe8ff, LEAF = 0x5cc04a, ICE = 0xbfe8f5;
const glow = (e, k = 1.3) => ({ emissive: e, emissiveIntensity: k });

// ---- colony parts ----
// a dark basalt footing a building stands on
const footing = (g, x, z, w, d, h = 0.3) => g.add(box(w, h, d, BASALT, x, 0, z));
// a light strip that glows cyan (brighter at night)
const strip = (g, w, d, x, y, z, color = CYAN) => g.add(box(w, 0.07, d, color, x, y, z, { emissive: color, night: 2.2 }));
// a white block with rounded corners, a teal band and a cyan light strip near the top
function block(g, { x, z, w, d, h, band = TEAL }) {
  footing(g, x, z, w + 0.24, d + 0.24);
  g.add(box(w, h, d, WH, x, 0.3, z));
  g.add(box(w + 0.04, 0.3, d + 0.04, band, x, 0.3 + h * 0.62, z));
  strip(g, w + 0.06, d + 0.06, x, 0.3 + h - 0.12, z);
  g.add(box(w + 0.1, 0.1, d + 0.1, shade(WH, -0.12), x, 0.3 + h, z));
  return 0.3 + h + 0.1;
}
// a row of round porthole windows on a wall, glowing at night like the other worlds' glass
function portholes(g, axis, a0, y, f, n, gap, r = 0.16) {
  for (let i = 0; i < n; i++) {
    const a = a0 + (i - (n - 1) / 2) * gap, s = Math.sign(f) || 1;
    const rim = mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.06, 16), DARK), pane = mesh(new THREE.CylinderGeometry(r, r, 0.08, 16), GLASS);
    for (const [m, off] of [[rim, 0.02], [pane, 0.05]]) {
      if (axis === 'z') { m.rotation.x = Math.PI / 2; m.position.set(a, y, f + s * off); } else { m.rotation.z = Math.PI / 2; m.position.set(f + s * off, y, a); }
      g.add(m);
    }
  }
}
// a greenhouse dome: a ribbed glass dome with green plants glowing inside
function greenDome(g, x, z, r, y0 = 0.3) {
  footing(g, x, z, r * 2 + 0.2, r * 2 + 0.2, y0);
  g.add(cyl(r + 0.06, r + 0.1, 0.3, WH, x, y0, z, 28));
  // the crops inside: a soft green glow and rows of plants
  g.add(cyl(r * 0.92, r * 0.92, 0.05, 0x3f8f34, x, y0 + 0.3, z, 24));
  for (let k = -2; k <= 2; k++) g.add(box(r * 1.5 * Math.sqrt(Math.max(0.1, 1 - (k / 2.6) ** 2)), 0.28, 0.16, LEAF, x, y0 + 0.33, z + k * r * 0.34, { emissive: 0x6dff5a, emissiveIntensity: 0.35 }));
  const domeM = { transparent: true, opacity: 0.32, roughness: 0.08, metalness: 0.2, depthWrite: false, emissive: 0x7dff9a, emissiveIntensity: 0.2 };
  const dome = mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8fff0, domeM); dome.position.set(x, y0 + 0.3, z); g.add(dome);
  for (let k = 0; k < 6; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.01, 0.03, 4, 24, Math.PI), WH); rib.rotation.y = (k / 6) * Math.PI; rib.position.set(x, y0 + 0.3, z); g.add(rib); }
  const ring = mesh(new THREE.TorusGeometry(r * 0.72, 0.03, 4, 28), WH); ring.rotation.x = Math.PI / 2; ring.position.set(x, y0 + 0.3 + r * 0.69, z); g.add(ring);
  g.add(cyl(0.14, 0.14, 0.1, WH, x, y0 + 0.3 + r - 0.02, z, 12));
  return y0 + 0.3 + r;
}
// a glass skybridge tube between two points at height y
function skybridge(g, a, b, y) {
  const A = new THREE.Vector3(a[0], y, a[1]), B = new THREE.Vector3(b[0], y, b[1]), d = B.clone().sub(A);
  const tube = mesh(new THREE.CylinderGeometry(0.28, 0.28, d.length(), 14, 1, true), 0xcff6ff, { transparent: true, opacity: 0.45, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide });
  tube.position.copy(A).add(B).multiplyScalar(0.5); tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); g.add(tube);
  for (let t = 0.2; t < 0.9; t += 0.3) { const p = A.clone().lerp(B, t); const r = mesh(new THREE.TorusGeometry(0.3, 0.04, 4, 16), WH); r.position.copy(p); r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.clone().normalize()); g.add(r); }
  rod(g, [a[0], y - 0.25, a[1]], [b[0], y - 0.25, b[1]], 0.05, TEAL);
}
// a tall white wind turbine (three blades); returns the rotor to spin
function turbine(g, x, z, h, len) {
  footing(g, x, z, 0.8, 0.8, 0.25);
  g.add(cyl(0.1, 0.2, h, WH, x, 0.25, z, 12));
  g.add(cyl(0.21, 0.21, 0.25, TEAL, x, 0.25 + h * 0.15, z, 12));
  const nac = new THREE.Group(); nac.position.set(x, 0.25 + h, z);
  nac.add(box(0.3, 0.3, 0.7, WH, 0, -0.15, -0.1));
  const rotor = new THREE.Group(); rotor.position.set(0, 0, 0.3);
  rotor.add(mesh(new THREE.SphereGeometry(0.16, 12, 8), WH));
  for (let k = 0; k < 3; k++) {
    const arm = new THREE.Group(); arm.rotation.z = (k / 3) * Math.PI * 2;
    const blade = mesh(new THREE.BoxGeometry(0.16, len, 0.04), WH); blade.position.y = len / 2 + 0.1; blade.rotation.y = 0.25; arm.add(blade);
    arm.add(box(0.17, 0.25, 0.05, 0xd94a3a, 0, len - 0.05, 0));
    rotor.add(arm);
  }
  nac.add(rotor); nac.rotation.y = 0.75;
  g.add(nac);
  return rotor;
}

Object.assign(BUILDERS, {
  // ---- Ice Driller: a drill rig boring into a frosty ice field, with an insulated ice
  // tank and a heated pipe carrying meltwater away
  icedrill(color) {
    const g = new THREE.Group();
    // the frosty patch it drills into
    const ice = mesh(new THREE.CylinderGeometry(2.3, 2.5, 0.12, 14), ICE, { roughness: 0.25, metalness: 0.1 }); ice.position.set(-1.0, 0.1, 0.6); g.add(ice);
    for (const [x, z, s] of [[-2.2, 1.5, 0.5], [-0.2, 1.9, 0.35], [-1.9, -0.4, 0.4]]) { const c = mesh(new THREE.OctahedronGeometry(s, 0), 0xe6f8ff, { roughness: 0.2, transparent: true, opacity: 0.85 }); c.position.set(x, 0.25, z); c.rotation.set(0.4, 0.3, 0.6); g.add(c); }
    // the rig: a teal frame with a mast and a turning drill string
    const rx = -1.0, rz = 0.6;
    footing(g, rx, rz, 1.6, 1.6, 0.25);
    lattice(g, rx - 0.55, rz + 0.55, rx + 0.55, rz + 0.55, 0.25, 4.0, TEAL, 0.8);
    lattice(g, rx - 0.55, rz - 0.55, rx - 0.55, rz + 0.55, 0.25, 4.0, TEAL, 0.8);
    lattice(g, rx + 0.55, rz - 0.55, rx + 0.55, rz + 0.55, 0.25, 4.0, TEAL, 0.8);
    g.add(box(1.4, 0.18, 1.4, WH, rx, 4.25, rz));
    g.add(box(0.12, 0.12, 0.12, 0xff3b2f, rx, 4.45, rz, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    const drill = new THREE.Group();
    drill.add(cyl(0.09, 0.09, 3.6, 0xc9ced6, 0, 0, 0, 8));
    for (let k = 0; k < 6; k++) { const f = box(0.42, 0.05, 0.12, DARK, 0, 0.3 + k * 0.28, 0); f.rotation.y = k * 0.9; drill.add(f); }
    drill.position.set(rx, 0.3, rz); g.add(drill);
    g.add(box(0.6, 0.5, 0.6, WH, rx, 3.4, rz));                   // the motor head
    // control cab beside it
    const top = block(g, { x: 1.7, z: 1.6, w: 1.8, d: 1.5, h: 1.3, band: color });
    portholes(g, 'z', 1.7, 1.0, 2.35, 3, 0.5);
    // insulated ice-water tank and the heated pipe to it
    tank(g, 1.85, -1.7, 0.75, 1.7, WH);
    g.add(cyl(0.78, 0.78, 0.3, color, 1.85, 1.0, -1.7, 22));
    pipe(g, [[rx + 0.6, 0.6, rz - 0.3], [0.6, 0.6, rz - 0.3], [0.6, 0.6, -1.7], [1.1, 0.6, -1.7]], 0.12, 0xd94a3a);
    strip(g, 0.06, 1.2, 0.6, 0.75, -0.55, 0xff9a5a);
    return { group: g, top: 5.2, anim(t, dt) { drill.rotation.y += dt * 4; drill.position.y = 0.3 - Math.abs(Math.sin(t * 0.5)) * 0.25; } };
  },

  // ---- Oxygen Plant: tall electrolysis stacks in a white hall, blue oxygen spheres and a
  // teal hydrogen tank, with a glowing band of process lights
  oxyplant(color) {
    const g = new THREE.Group();
    const top = block(g, { x: 0.6, z: 0.9, w: 3.8, d: 2.5, h: 2.0, band: color });
    portholes(g, 'z', 0.6, 1.25, 2.15, 5, 0.65);
    portholes(g, 'x', 0.9, 1.25, 2.5, 3, 0.65);
    g.add(onWall('z', -0.9, 0.3, 2.15, 0.9, 1.3, 0.06, 0x3a3f48));      // airlock door
    g.add(onWall('z', -0.9, 1.68, 2.18, 0.7, 0.08, 0.04, CYAN, { emissive: CYAN, night: 2 }));
    signBoard(g, 'x', 0.9, 1.6, 2.5, 2.0, color, 5);
    // electrolysis stacks on the roof: rows of glowing cells
    const cells = [];
    for (let i = 0; i < 3; i++) {
      const x = -0.4 + i * 0.8;
      g.add(box(0.5, 1.0, 1.4, 0xc9ced6, x, top, 0.6));
      for (let k = 0; k < 4; k++) { const c = box(0.52, 0.08, 1.42, CYAN, x, top + 0.15 + k * 0.22, 0.6, glow(0x3fd8ff, 1)); c.material = c.material.clone(); g.add(c); cells.push(c); }
    }
    // oxygen spheres (pale blue) on legs at the back, and a hydrogen tank
    for (const [x, z, r] of [[-1.9, -1.8, 0.85], [-0.2, -2.2, 0.65]]) {
      for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + 0.4; g.add(box(0.07, r + 0.3, 0.07, IRON, x + Math.cos(a) * r * 0.7, 0.15, z + Math.sin(a) * r * 0.7)); }
      const s = mesh(new THREE.SphereGeometry(r, 22, 16), 0xa9d4ff, { roughness: 0.3, metalness: 0.2 }); s.position.set(x, r + 0.45, z); g.add(s);
      g.add(cyl(r + 0.02, r + 0.02, 0.1, WH, x, r + 0.4, z, 22));
    }
    tank(g, 2.5, -1.9, 0.55, 2.4, color);
    pipe(g, [[1.4, 1.2, -0.35], [1.4, 1.2, -1.9], [1.95, 1.2, -1.9]], 0.08, WH);
    pipe(g, [[-0.6, 0.9, -0.35], [-0.6, 0.9, -1.4], [-1.2, 0.9, -1.4]], 0.08, 0xa9d4ff);
    return { group: g, top: top + 1.6, anim(t) { cells.forEach((c, i) => { c.material.emissiveIntensity = 0.5 + 0.9 * Math.max(0, Math.sin(t * 2.2 - i * 0.5)); }); } };
  },

  // ---- Greenhouse Dome: a big glowing green dome and a smaller one, linked by a glass
  // skybridge to a white grow-lab, with a seed silo and a water tank
  greenhouse(color) {
    const g = new THREE.Group();
    const t1 = greenDome(g, -1.0, -0.7, 2.0);
    greenDome(g, 1.9, -1.9, 1.1);
    const top = block(g, { x: 1.85, z: 1.7, w: 1.9, d: 1.6, h: 1.6, band: color });
    portholes(g, 'z', 1.85, 1.15, 2.5, 3, 0.5);
    g.add(onWall('x', 1.7, 0.3, 2.8, 0.7, 1.1, 0.06, 0x3a3f48));
    skybridge(g, [0.6, 0.4], [1.2, 1.2], 0.9);
    skybridge(g, [1.9, -0.8], [1.9, 0.9], 0.9);
    tank(g, -2.6, 2.3, 0.45, 1.4, WH);
    g.add(cyl(0.48, 0.48, 0.25, LEAF, -2.6, 1.0, 2.3, 18));
    // grow lights on masts round the big dome
    for (const [x, z] of [[-2.9, -2.6], [0.9, 1.1]]) { g.add(box(0.06, 2.4, 0.06, WH, x, 0.3, z)); g.add(box(0.3, 0.12, 0.3, 0xe6b8ff, x, 2.7, z, { emissive: 0xd08aff, night: 2.4 })); }
    return { group: g, top: t1 + 0.8 };
  },

  // ---- Brick Kiln: a sintering line baking regolith into red bricks: a hopper, a long
  // glowing kiln tunnel, and pallets of bricks stacked by a rover-crane
  brickworks(color) {
    const g = new THREE.Group();
    // the kiln tunnel: a long white barrel with a glowing slot along its side
    footing(g, -0.4, -1.2, 5.0, 1.8);
    const kiln = mesh(new THREE.CylinderGeometry(0.85, 0.85, 4.6, 20), WH); kiln.rotation.z = Math.PI / 2; kiln.position.set(-0.4, 1.15, -1.2); g.add(kiln);
    for (let k = 0; k < 6; k++) { const r = mesh(new THREE.TorusGeometry(0.87, 0.05, 6, 20), TEAL); r.rotation.y = Math.PI / 2; r.position.set(-2.4 + k * 0.8, 1.15, -1.2); g.add(r); }
    const slot = box(4.0, 0.14, 0.06, 0xffa13a, -0.4, 1.0, -0.38, { emissive: 0xff7a12, emissiveIntensity: 1.4 }); g.add(slot);
    for (const x of [-2.4, 1.6]) g.add(box(0.2, 0.9, 1.4, IRON, x, 0.3, -1.2));
    // the hopper of red dust at the start, on legs
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) g.add(box(0.08, 1.8, 0.08, IRON, -2.7 + dx, 0.15, 0.6 + dz));
    const hop = mesh(new THREE.ConeGeometry(0.75, 0.8, 4), WH); hop.rotation.set(Math.PI, Math.PI / 4, 0); hop.position.set(-2.7, 2.1, 0.6); g.add(hop);
    g.add(box(1.05, 0.35, 1.05, WH, -2.7, 2.5, 0.6), box(0.9, 0.12, 0.9, color, -2.7, 2.86, 0.6));
    // the end of the line: a conveyor and pallets of fresh bricks
    g.add(box(1.6, 0.35, 0.6, DARK, 2.4, 0.3, -1.2));
    const bricks = [];
    for (let i = 0; i < 3; i++) { const b = box(0.35, 0.15, 0.2, color, 0, 0.66, -1.2); g.add(b); bricks.push(b); }
    for (const [x, z, n] of [[0.3, 1.3, 4], [1.3, 1.3, 3], [0.8, 2.4, 5]]) {
      g.add(box(0.9, 0.12, 0.9, 0x8a6a4f, x, 0.3, z));
      for (let k = 0; k < n; k++) for (let j = 0; j < 2; j++) g.add(box(0.4, 0.15, 0.85, k % 2 ? shade(color, -0.1) : color, x - 0.22 + j * 0.44, 0.42 + k * 0.16, z));
    }
    // the control cab
    block(g, { x: 2.5, z: 1.9, w: 1.2, d: 1.5, h: 1.6, band: color });
    portholes(g, 'z', 2.5, 1.2, 2.65, 2, 0.5);
    return { group: g, top: 4.0, smoke: [new THREE.Vector3(1.6, 1.8, -1.2)], anim(t) { bricks.forEach((b, i) => { b.position.x = 1.7 + ((t * 0.4 + i / 3) % 1) * 1.4; }); } };
  },

  // ---- Hab Factory: a tall assembly hall with a big gantry crane lowering a fresh
  // habitat module onto a crawler, and finished habs lined up outside
  habworks(color) {
    const g = new THREE.Group();
    const top = block(g, { x: -0.9, z: -0.6, w: 3.6, d: 3.2, h: 3.0, band: TEAL });
    g.add(onWall('z', -0.9, 0.3, 1.0, 2.4, 2.4, 0.06, 0x3a3f48));
    for (let k = 1; k < 6; k++) g.add(onWall('z', -0.9, 0.3 + k * 0.4, 1.05, 2.4, 0.04, 0.03, 0x5b5f66));
    for (const e of [-1.3, 1.3]) g.add(onWall('z', -0.9 + e, 0.3, 1.08, 0.12, 0.7, 0.1, HAZ));
    portholes(g, 'x', -0.6, 2.4, 0.9, 4, 0.7);
    signBoard(g, 'x', -0.6, 1.3, 0.9, 2.4, TEAL, 5);
    // gantry crane over the yard, its hook carrying a hab module up and down
    for (const [x, z] of [[1.4, -2.6], [2.9, -2.6], [1.4, 2.6], [2.9, 2.6]]) g.add(box(0.16, 3.6, 0.16, HAZ, x, 0.15, z));
    for (const x of [1.4, 2.9]) g.add(box(0.16, 0.2, 5.4, HAZ, x, 3.75, 0));
    const trolley = new THREE.Group();
    trolley.add(box(1.8, 0.22, 0.4, HAZ, 0, 0, 0), box(0.4, 0.3, 0.4, DARK, 0, -0.25, 0));
    const hook = new THREE.Group();
    const cable = cyl(0.025, 0.025, 1.6, DARK, 0, -1.6, 0, 4); hook.add(cable);
    const hab = new THREE.Group();
    hab.add(cyl(0.55, 0.55, 1.5, WH, 0, 0, 0, 18).rotateZ(Math.PI / 2));
    hab.add(cyl(0.57, 0.57, 0.3, color, 0, 0, 0, 18).rotateZ(Math.PI / 2));
    hook.add(hab); hab.position.y = -2.1;
    trolley.add(hook);
    trolley.position.set(2.15, 3.85, 0); g.add(trolley);
    // finished habs waiting outside, and a crawler
    for (const [x, z] of [[-2.6, 2.1], [-1.2, 2.5]]) { const h = cyl(0.5, 0.5, 1.2, WH, x, 0.65, z, 18); h.rotation.x = Math.PI / 2; h.position.y = 0.65; g.add(h); g.add(cyl(0.52, 0.52, 0.25, color, x, 0.65, z, 18).rotateX(Math.PI / 2)); footing(g, x, z, 1.1, 1.3, 0.15); }
    return { group: g, top: top + 1.2, anim(t) { trolley.position.z = Math.sin(t * 0.4) * 1.6; hook.position.y = -0.4 + Math.abs(Math.sin(t * 0.8)) * 0.6; } };
  },

  // ---- Atmosphere Processor: a towering cone breathing out plumes of new air, with
  // intake fans at its base and a band of violet lights climbing it
  atmos(color) {
    const g = new THREE.Group();
    footing(g, -0.5, -0.5, 4.4, 4.4, 0.35);
    const pts = []; for (let i = 0; i <= 12; i++) { const y = i * 0.6; pts.push(new THREE.Vector2(1.9 - 1.05 * Math.pow(i / 12, 0.7), y)); }
    const tower = mesh(new THREE.LatheGeometry(pts, 28), WH); tower.position.set(-0.5, 0.35, -0.5); g.add(tower);
    const lights = [];
    for (let k = 0; k < 5; k++) {
      const y = 0.9 + k * 1.3, r = 1.9 - 1.05 * Math.pow((y - 0.35) / 7.2, 0.7) + 0.03;
      const ring = mesh(new THREE.TorusGeometry(r, 0.06, 6, 28), color, glow(0xa08aff, 1)); ring.material = ring.material.clone(); ring.rotation.x = Math.PI / 2; ring.position.set(-0.5, y, -0.5); g.add(ring); lights.push(ring);
    }
    const lip = mesh(new THREE.TorusGeometry(0.88, 0.1, 8, 24), TEAL); lip.rotation.x = Math.PI / 2; lip.position.set(-0.5, 7.55, -0.5); g.add(lip);
    const hole = mesh(new THREE.CircleGeometry(0.8, 20), 0x2a2d33); hole.rotation.x = -Math.PI / 2; hole.position.set(-0.5, 7.5, -0.5); g.add(hole);
    // intake fans round the base
    const fans = [];
    for (const [x, z, ry] of [[1.55, -0.5, Math.PI / 2], [-0.5, 1.55, 0]]) {
      const housing = cyl(0.65, 0.65, 0.4, 0xc9ced6, 0, 0, 0, 20); housing.rotation.x = Math.PI / 2;
      const hg = new THREE.Group(); hg.add(housing); hg.position.set(x, 1.0, z); hg.rotation.y = ry; g.add(hg);
      const f = spokeWheel(0.55, DARK, 5, 0.05); f.position.set(0, 0, 0.22); hg.add(f); fans.push(f);
    }
    // a control module and a pipe
    block(g, { x: 2.3, z: 2.2, w: 1.4, d: 1.3, h: 1.4, band: color });
    portholes(g, 'z', 2.3, 1.1, 2.85, 2, 0.45);
    return { group: g, top: 8.6, steam: true, smoke: [new THREE.Vector3(-0.5, 7.6, -0.5)], anim(t, dt) { fans.forEach(f => { f.rotation.z += dt * 6; }); lights.forEach((l, i) => { l.material.emissiveIntensity = 0.4 + 1.2 * Math.max(0, Math.sin(t * 1.8 - i * 0.8)); }); } };
  },

  // ---- Mars Spaceport: a landing pad with a glowing ring, a sleek white starship, a
  // propellant farm and a control tower with a glass top
  marsport(color) {
    const g = new THREE.Group();
    g.add(cyl(2.2, 2.3, 0.35, BASALT, 0.4, 0.15, 0.2, 30));
    g.add(cyl(2.0, 2.0, 0.05, 0x4a4e57, 0.4, 0.5, 0.2, 30));
    const ringL = mesh(new THREE.TorusGeometry(1.85, 0.06, 4, 32), CYAN, { emissive: CYAN, night: 2.2 }); ringL.rotation.x = Math.PI / 2; ringL.position.set(0.4, 0.55, 0.2); g.add(ringL);
    g.add(box(1.4, 0.02, 0.26, 0xf4efe0, 0.4, 0.55, 0.2), box(0.26, 0.02, 1.4, 0xf4efe0, 0.4, 0.55, 0.2));
    // the ship: white with a teal band and black heat tiles on its belly side
    const rocket = new THREE.Group();
    rocket.add(cyl(0.7, 0.7, 5.2, WH, 0, 0.4, 0, 22));
    rocket.add(cyl(0.72, 0.72, 0.4, color, 0, 3.6, 0, 22));
    const tiles = mesh(new THREE.CylinderGeometry(0.72, 0.72, 4.6, 22, 1, true, Math.PI * 0.8, Math.PI * 0.4), 0x22252a, { side: THREE.DoubleSide }); tiles.position.y = 2.7; rocket.add(tiles);
    const nose = mesh(new THREE.SphereGeometry(0.7, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), WH); nose.scale.y = 2.0; nose.position.y = 5.6; rocket.add(nose);
    for (const sd of [-1, 1]) { rocket.add(box(0.07, 1.3, 0.9, WH, sd * 0.75, 0.5, 0)); rocket.add(box(0.07, 0.7, 0.5, WH, sd * 0.72, 5.4, 0)); }
    for (let k = 0; k < 3; k++) rocket.add(cyl(0.2, 0.28, 0.3, DARK, Math.cos(k * 2.1) * 0.35, 0.15, Math.sin(k * 2.1) * 0.35, 10));
    portholes(rocket, 'z', 0, 4.6, 0.7, 2, 0.4, 0.1);
    rocket.position.set(0.4, 0.5, 0.2); g.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 5; i++) scaffold.add(box(1.8, 0.1, 1.8, 0xb9b4a8, 0.4, 1.0 + i * 1.25, 0.2));
    for (const [dx, dz] of [[-0.85, -0.85], [0.85, 0.85], [-0.85, 0.85], [0.85, -0.85]]) scaffold.add(box(0.1, 6.4, 0.1, 0xb9b4a8, 0.4 + dx, 0.5, 0.2 + dz));
    g.add(scaffold);
    // control tower with a glass top
    footing(g, -2.4, -2.3, 1.1, 1.1);
    g.add(cyl(0.35, 0.45, 4.2, WH, -2.4, 0.3, -2.3, 16));
    g.add(cyl(0.75, 0.6, 0.9, 0xbfe9ff, -2.4, 4.5, -2.3, 16, { roughness: 0.05, metalness: 0.4 }));
    g.add(cyl(0.82, 0.82, 0.15, TEAL, -2.4, 5.4, -2.3, 16), cyl(0.82, 0.82, 0.12, WH, -2.4, 4.4, -2.3, 16));
    g.add(box(0.06, 0.8, 0.06, 0xdddddd, -2.4, 5.55, -2.3), box(0.12, 0.12, 0.12, 0xff3b2f, -2.4, 6.35, -2.3, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    // propellant tanks
    tank(g, 2.6, -2.4, 0.5, 2.6, WH); tank(g, 2.6, 2.5, 0.45, 2.0, WH);
    return { group: g, top: 8.6, rocket, scaffold };
  },

  // ---- Wind Farm: three tall white turbines turning in the Mars wind, and a substation
  windfarm(color) {
    const g = new THREE.Group();
    const rotors = [turbine(g, -1.9, -1.6, 5.6, 1.9), turbine(g, 1.6, -2.2, 4.8, 1.6), turbine(g, -1.6, 2.0, 4.2, 1.45)];
    // substation: a small white building, transformers and a fence
    block(g, { x: 1.9, z: 1.8, w: 1.4, d: 1.3, h: 1.1, band: TEAL });
    for (let k = 0; k < 2; k++) { g.add(box(0.5, 0.6, 0.4, 0x6f8fa8, 0.6 + k * 0.6, 0.15, 0.6)); g.add(cyl(0.04, 0.04, 0.3, 0xe8e2d4, 0.6 + k * 0.6, 0.75, 0.6, 6)); }
    for (const [x0, z0, x1, z1] of [[0.2, 0.2, 2.8, 0.2], [0.2, 0.2, 0.2, 1.0]]) railing(g, x0, z0, x1, z1, 0.15, 0xb9b4a8);
    return { group: g, top: 7.6, anim(t, dt) { rotors.forEach((r, i) => { r.rotation.z -= dt * (1.6 + i * 0.3); }); } };
  },

  // ---- Ice Vault Data Center: a server hall half-buried under frost and basalt, with
  // cyan light slits, radiator fins and a dish
  icevault(color) {
    const g = new THREE.Group();
    // a mound of ice and rock over the back of it (for cooling)
    const mound = mesh(new THREE.SphereGeometry(2.6, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8eef6, { roughness: 0.35, flatShading: true }); mound.scale.set(1.1, 0.55, 0.85); mound.position.set(-0.6, 0.15, -1.6); g.add(mound);
    const top = block(g, { x: 0.1, z: 0.3, w: 4.2, d: 2.4, h: 1.8, band: color });
    for (let i = 0; i < 6; i++) g.add(onWall('z', -1.6 + i * 0.68, 0.55, 1.5, 0.12, 1.2, 0.04, CYAN, { emissive: CYAN, emissiveIntensity: 1 }));
    const lights = [];
    for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const l = onWall('x', -0.6 + i * 0.4, 0.6 + k * 0.4, 2.2, 0.16, 0.06, 0.03, 0x5fd3ff, { emissive: 0x2fb6ff, emissiveIntensity: 1 }); l.material = l.material.clone(); g.add(l); lights.push(l); }
    g.add(onWall('z', 1.5, 0.3, 1.5, 0.8, 1.2, 0.06, 0x3a3f48));
    // radiator fins on the roof and a dish
    for (let k = 0; k < 5; k++) g.add(box(0.06, 0.7, 1.6, 0xf6f7f9, -1.4 + k * 0.5, top, 0.3));
    g.add(box(0.1, 0.9, 0.1, IRON, 1.6, top, -0.3));
    const dish = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), 0xf2f2f0, { side: THREE.DoubleSide }); dish.rotation.x = -2.2; dish.rotation.z = 0.5; dish.position.set(1.6, top + 1.0, -0.3); g.add(dish);
    return { group: g, top: top + 1.8, anim(t) { lights.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(t * 6 + i * 1.9) > 0.1 ? 1.4 : 0.15; }); } };
  },

  // ---- Colony Command: a white tower with a glass observation deck, a greenhouse dome
  // beside it joined by a skybridge, and a flag
  hqmars(color) {
    const g = new THREE.Group();
    const tx = -0.9, tz = -0.8;
    footing(g, tx, tz, 2.6, 2.6);
    g.add(cyl(1.0, 1.15, 4.4, WH, tx, 0.3, tz, 20));
    for (const y of [1.6, 2.9]) g.add(cyl(1.02, 1.02, 0.12, color, tx, y, tz, 20));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; if (Math.cos(a) < -0.3 && Math.sin(a) < -0.3) continue; for (const y of [1.0, 2.2, 3.5]) g.add(at(box(0.32, 0.4, 0.06, GLASS, 0, 0, 0), tx + Math.cos(a) * 1.04, y, tz + Math.sin(a) * 1.04)); }
    g.add(cyl(1.35, 1.2, 1.1, 0xbfe9ff, tx, 4.7, tz, 20, { roughness: 0.05, metalness: 0.35 }));   // the glass observation deck
    g.add(cyl(1.42, 1.42, 0.14, WH, tx, 4.62, tz, 20), cyl(1.42, 1.42, 0.16, WH, tx, 5.8, tz, 20));
    strip(g, 2.9, 2.9, tx, 5.75, tz);
    g.add(box(0.07, 1.6, 0.07, 0xdddddd, tx, 5.96, tz), box(0.9, 0.55, 0.04, color, tx + 0.48, 6.95, tz));
    greenDome(g, 1.8, 0.4, 1.1);
    skybridge(g, [tx + 0.9, tz + 0.5], [1.0, 0.1], 1.0);
    block(g, { x: 1.5, z: 2.5, w: 1.6, d: 0.9, h: 0.9, band: color });
    return { group: g, top: 7.6 };
  },
});
