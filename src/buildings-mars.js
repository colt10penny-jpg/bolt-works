// The Mars colony, from the same kit as the other worlds (see buildings.js), with its own
// look so it reads nothing like the Mojave: crisp white and teal pressurised buildings on
// dark basalt footings, glowing green greenhouse domes, glass skybridges, cyan light
// strips, tall white wind turbines and frosty ice. These are the models named in
// worlds.js (SKINS.mars).
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
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

// ---- the colony's sci-fi kit ----
// Sleek, rounded, sand-scoured ivory hulls over gunmetal plating, orange and cyan running
// lights, tripods, domes, wedges and slender vapour towers: nothing boxy, nothing like the
// other worlds.
const HULL = 0xddd6c8, HULL2 = 0xc4bba9, PLATE = 0x666a72, GUN = 0x3a3d44, ORANGE = 0xff8a3a;
// a dark disc of basalt paving with a glowing ring round its edge
function padRing(g, x, z, r, y = 0.15, color = CYAN) {
  g.add(cyl(r, r + 0.1, 0.18, BASALT, x, y - 0.03, z, 32));
  const ring = mesh(new THREE.TorusGeometry(r - 0.12, 0.04, 4, 40), color, { emissive: color, night: 2.2 }); ring.rotation.x = Math.PI / 2; ring.position.set(x, y + 0.16, z); g.add(ring);
}
// a half dome, squashed a little, with a band round its foot
function hullDome(g, x, z, r, color = HULL, squash = 0.75, y = 0.15) {
  const d = mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), color); d.scale.y = squash; d.position.set(x, y, z); g.add(d);
  g.add(cyl(r + 0.05, r + 0.08, 0.22, PLATE, x, y, z, 28));
  return y + r * squash;
}
// a slender vapour tower: a tapered mast with stacked collars, fins and a glowing cap
function vaporator(g, x, z, h, accent = ORANGE) {
  g.add(cyl(0.34, 0.42, 0.3, GUN, x, 0.15, z, 14));
  g.add(cyl(0.12, 0.22, h, HULL, x, 0.45, z, 14));
  const lights = [];
  for (const k of [0.3, 0.55, 0.8]) {
    g.add(cyl(0.3, 0.3, 0.12, HULL2, x, 0.45 + h * k, z, 16));
    const l = cyl(0.31, 0.31, 0.04, accent, x, 0.49 + h * k, z, 16, { emissive: accent, emissiveIntensity: 0.8 }); l.material = l.material.clone(); g.add(l); lights.push(l);
  }
  for (let k = 0; k < 3; k++) { const f = box(0.05, h * 0.35, 0.36, PLATE, x + Math.cos(k * 2.09) * 0.22, 0.45 + h * 0.55, z + Math.sin(k * 2.09) * 0.22); f.rotation.y = -k * 2.09; g.add(f); }
  const tip = mesh(new THREE.ConeGeometry(0.12, 0.5, 10), HULL); tip.position.set(x, 0.45 + h + 0.25, z); g.add(tip);
  g.add(box(0.08, 0.08, 0.08, 0xff3b2f, x, 0.45 + h + 0.5, z, glow(0xff2a1a, 1.5)));
  return lights;
}
// a capsule lying along x on two short legs, with a band of glowing windows
function capsulePod(g, x, z, len, r, color = HULL, y = 0.55) {
  const c = mesh(new THREE.CapsuleGeometry(r, len, 8, 18), color); c.rotation.z = Math.PI / 2; c.position.set(x, y + r, z); g.add(c);
  for (const dx of [-len * 0.3, len * 0.3]) { g.add(box(0.12, y + 0.1, 0.5, PLATE, x + dx, 0.15, z)); }
  g.add(box(len * 0.8, 0.12, 0.04, CYAN, x, y + r + 0.05, z + r * 0.97, { emissive: CYAN, night: 2.2 }));
  g.add(cyl(r * 1.02, r * 1.02, 0.08, PLATE, x - len * 0.15, y + r - 0.04, z, 18).rotateZ(Math.PI / 2));
  return y + r * 2;
}
// a wedge: a slab that slopes up from front to back (a right-angled profile, extruded along x)
function wedge(g, x, z, w, d, h, color = HULL, lowH = 0.3) {
  const sh = new THREE.Shape(); sh.moveTo(-d / 2, 0); sh.lineTo(d / 2, 0); sh.lineTo(d / 2, lowH); sh.lineTo(-d / 2, h); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2 });
  geo.translate(0, 0, -w / 2);
  const m = mesh(geo, color); m.rotation.y = -Math.PI / 2; m.position.set(x, 0.15, z); g.add(m);
  return m;
}
// a ball tank on a ring of legs
function sphereTank(g, x, z, r, color = HULL, y = 0.9) {
  for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; g.add(box(0.08, y, 0.08, PLATE, x + Math.cos(a) * r * 0.7, 0.15, z + Math.sin(a) * r * 0.7)); }
  const b = mesh(new THREE.SphereGeometry(r, 20, 14), color); b.position.set(x, 0.15 + y + r * 0.6, z); g.add(b);
  const band = mesh(new THREE.TorusGeometry(r * 1.0, 0.04, 4, 24), PLATE); band.rotation.x = Math.PI / 2; band.position.copy(b.position); g.add(band);
  return 0.15 + y + r * 1.6;
}

Object.assign(BUILDERS, {
  // ---- Ice Driller: a three-legged drill rig straddling a glowing borehole in the ice,
  // a capsule control pod on legs, and two frosted cryo spheres
  icedrill(color) {
    const g = new THREE.Group();
    const ice = mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.12, 16), ICE, { roughness: 0.25, metalness: 0.1 }); ice.position.set(-0.8, 0.1, 0.3); g.add(ice);
    for (const [x, z, sz] of [[-2.4, 1.4, 0.45], [-0.1, 1.9, 0.3], [-2.2, -0.9, 0.38], [0.6, -0.8, 0.25]]) { const c = mesh(new THREE.OctahedronGeometry(sz, 0), 0xe6f8ff, { roughness: 0.2, transparent: true, opacity: 0.85 }); c.position.set(x, 0.25, z); c.rotation.set(0.4, 0.3, 0.6); g.add(c); }
    const rx = -0.8, rz = 0.3, apex = 4.8;
    const hole = mesh(new THREE.TorusGeometry(0.45, 0.07, 6, 24), CYAN, { emissive: CYAN, emissiveIntensity: 1.4 }); hole.rotation.x = Math.PI / 2; hole.position.set(rx, 0.2, rz); g.add(hole);
    g.add(cyl(0.4, 0.4, 0.04, 0x0d2a33, rx, 0.17, rz, 20, glow(0x2fb6ff, 0.6)));
    for (let k = 0; k < 3; k++) {
      const a = k * 2.094 + 0.5, fx = rx + Math.cos(a) * 1.75, fz = rz + Math.sin(a) * 1.75;
      rod(g, [fx, 0.2, fz], [rx, apex, rz], 0.11, HULL);
      g.add(cyl(0.22, 0.28, 0.25, GUN, fx, 0.15, fz, 10));
      g.add(box(0.06, 0.06, 0.06, ORANGE, rx + Math.cos(a) * 0.9, 2.6, rz + Math.sin(a) * 0.9, glow(ORANGE, 1.2)));
    }
    g.add(cyl(0.42, 0.3, 0.7, PLATE, rx, apex - 0.35, rz, 14));
    g.add(cyl(0.5, 0.5, 0.12, color, rx, apex - 0.1, rz, 14, glow(color, 0.4)));
    g.add(box(0.1, 0.1, 0.1, 0xff3b2f, rx, apex + 0.1, rz, glow(0xff2a1a, 1.5)));
    const drill = new THREE.Group();
    drill.add(cyl(0.1, 0.1, apex - 0.6, 0xc9ced6, 0, 0, 0, 8));
    for (let k = 0; k < 8; k++) { const f = box(0.36, 0.04, 0.1, GUN, 0, 0.3 + k * 0.3, 0); f.rotation.y = k * 0.8; drill.add(f); }
    drill.position.set(rx, 0.3, rz); g.add(drill);
    // control pod and cryo spheres
    capsulePod(g, 1.95, 1.9, 1.3, 0.48);
    sphereTank(g, 2.25, -1.85, 0.62, 0xe8f4f8);
    sphereTank(g, 1.05, -2.45, 0.45, 0xe8f4f8, 0.6);
    pipe(g, [[rx + 0.4, 0.5, rz - 0.4], [1.0, 0.5, rz - 0.4], [1.0, 0.5, -1.85], [1.6, 0.5, -1.85]], 0.1, 0x8a8f99);
    return { group: g, top: 5.4, anim(t, dt) { drill.rotation.y += dt * 4; drill.position.y = 0.3 - Math.abs(Math.sin(t * 0.5)) * 0.25; hole.material.emissiveIntensity = 1.1 + Math.sin(t * 3) * 0.4; } };
  },

  // ---- Oxygen Plant: a ring of slender vapour towers round a low domed core, with a
  // big blue oxygen sphere and pipes running in from each tower
  oxyplant(color) {
    const g = new THREE.Group();
    padRing(g, 0.2, 0.2, 2.0);
    const top = hullDome(g, 0.2, 0.2, 1.45, HULL, 0.62, 0.3);
    const band = mesh(new THREE.TorusGeometry(1.25, 0.06, 6, 32), color, { emissive: color, emissiveIntensity: 0.6 }); band.rotation.x = Math.PI / 2; band.position.set(0.2, 0.75, 0.2); g.add(band);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.add(at(box(0.22, 0.14, 0.05, 0x1a2230, 0, 0, 0), 0.2 + Math.cos(a) * 1.27, 0.95, 0.2 + Math.sin(a) * 1.27).rotateY(-a + Math.PI / 2)); }
    g.add(cyl(0.35, 0.45, 0.4, PLATE, 0.2, top - 0.05, 0.2, 14));
    const lights = [];
    for (const [x, z, h] of [[-2.4, -2.3, 4.4], [2.5, -2.2, 3.6], [-2.5, 2.4, 3.2], [2.55, 2.45, 2.8]]) {
      lights.push(...vaporator(g, x, z, h, 0x6fe8ff));
      rod(g, [x * 0.82, 0.55, z * 0.82], [0.2 + Math.sign(x) * 1.1, 0.55, 0.2 + Math.sign(z) * 0.9], 0.07, PLATE);
    }
    sphereTank(g, -2.45, 0.15, 0.55, 0x4f8fd8, 0.5);
    return { group: g, top: 5.6, anim(t) { lights.forEach((l, i) => { l.material.emissiveIntensity = 0.3 + 1.2 * Math.max(0, Math.sin(t * 2.2 - i * 0.45)); }); band.material.emissiveIntensity = 0.5 + Math.sin(t * 1.5) * 0.3; } };
  },

  // ---- Greenhouse Dome: a great glass dome of glowing crops with two little pod domes
  // joined to it by glass tubes, and a grow-light mast
  greenhouse(color) {
    const g = new THREE.Group();
    const t1 = greenDome(g, -0.5, -0.5, 2.0);
    greenDome(g, 2.3, 1.7, 0.85); greenDome(g, -2.4, 2.3, 0.7);
    skybridge(g, [1.0, 0.6], [1.7, 1.2], 0.75); skybridge(g, [-1.4, 1.1], [-2.0, 1.9], 0.75);
    g.add(cyl(0.08, 0.12, 4.6, HULL, 2.4, 0.15, -2.4, 10));
    const lamp = new THREE.Group();
    lamp.add(cyl(0.5, 0.2, 0.25, PLATE, 0, 0, 0, 16), cyl(0.46, 0.46, 0.03, 0xff7adf, 0, -0.02, 0, 16, glow(0xff5ad0, 1.4)));
    lamp.position.set(2.4, 4.7, -2.4); g.add(lamp);
    return { group: g, top: t1 + 0.8, anim(t) { lamp.rotation.y = t * 0.4; } };
  },

  // ---- Brick Kiln: a long wedge of a building rising toward the back, a glowing slot of
  // sintering furnace along its foot, and a laser arm fusing red bricks on a belt
  brickworks(color) {
    const g = new THREE.Group();
    g.add(box(4.6, 0.25, 3.0, BASALT, -0.3, 0, -0.6));
    wedge(g, -0.3, -0.6, 4.4, 2.8, 3.1, HULL, 0.7);
    // plating stripes up the slope and a glowing furnace slot along the front
    for (let k = 0; k < 4; k++) { const st = box(4.42, 0.04, 0.16, PLATE, -0.3, 0.9 + k * 0.58, 0.55 - k * 0.6); st.rotation.x = -0.66; g.add(st); }
    const slot = box(3.6, 0.2, 0.06, ORANGE, -0.3, 0.42, 0.85, glow(0xff6a1a, 1.6)); slot.material = slot.material.clone(); g.add(slot);
    for (const x of [-2.2, 1.6]) g.add(cyl(0.18, 0.18, 0.8, PLATE, x, 3.2, -1.7, 10));
    const smoke = [new THREE.Vector3(-2.2, 4.1, -1.7)];
    // the brick line: a belt across the front with a laser arm over it
    g.add(box(3.6, 0.35, 0.6, GUN, -0.1, 0.15, 2.0));
    const bricks = [];
    for (let i = 0; i < 4; i++) { const b = box(0.36, 0.18, 0.26, color, 0, 0.52, 2.0); g.add(b); bricks.push(b); }
    g.add(box(0.12, 1.5, 0.12, HULL, 0.4, 0.15, 2.55), box(0.12, 0.12, 0.9, HULL, 0.4, 1.6, 2.2));
    const beam = cyl(0.025, 0.025, 1.05, 0xff3a2a, 0.4, 0.55, 2.0, 6, glow(0xff2a1a, 2)); g.add(beam);
    for (let k = 0; k < 3; k++) for (let j = 0; j < 3 - k; j++) g.add(box(0.36, 0.18, 0.26, shade(color, -0.1 * j), 2.55, 0.15 + k * 0.19, -1.6 + j * 0.3 + k * 0.15));
    return { group: g, top: 4.4, smoke, anim(t) { bricks.forEach((b, i) => { b.position.x = -1.8 + ((t * 0.35 + i / 4) % 1) * 3.4; }); beam.visible = Math.sin(t * 9) > -0.3; slot.material.emissiveIntensity = 1.3 + Math.sin(t * 2) * 0.3; } };
  },

  // ---- Hab Factory: a big printer gantry arching over a half-printed dome, its head
  // laying down ring after ring, and a finished capsule hab ready to roll out
  habworks(color) {
    const g = new THREE.Group();
    padRing(g, -0.4, -0.5, 2.2, 0.15, ORANGE);
    // the half-printed dome: stacked rings, the top ones not done yet
    const rings = [];
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI / 2, r = 1.55 * Math.cos(a); const m = mesh(new THREE.TorusGeometry(r, 0.11, 6, 30), k % 2 ? 0xb5603a : 0xc4693f); m.rotation.x = Math.PI / 2; m.position.set(-0.4, 0.4 + 1.55 * Math.sin(a) * 0.95, -0.5); g.add(m); rings.push(m); }
    // the gantry: two legs on rails and a beam across, with the print head on a trolley
    for (const z of [-2.35, 1.35]) { g.add(box(4.4, 0.12, 0.25, PLATE, -0.4, 0.15, z)); }
    for (const z of [-2.35, 1.35]) { g.add(box(0.3, 3.5, 0.3, HULL, -2.5, 0.27, z), box(0.3, 3.5, 0.3, HULL, 1.7, 0.27, z)); }
    g.add(box(4.6, 0.35, 0.4, HULL, -0.4, 3.77, -2.35), box(4.6, 0.35, 0.4, HULL, -0.4, 3.77, 1.35));
    const bridge = new THREE.Group();
    bridge.add(box(0.4, 0.3, 4.1, color, 0, 3.7, -0.5));
    const head = new THREE.Group();
    head.add(box(0.5, 0.5, 0.5, PLATE, 0, 0, 0), cyl(0.05, 0.12, 0.6, HULL2, 0, -0.6, 0, 8));
    head.add(cyl(0.06, 0.06, 0.04, ORANGE, 0, -0.64, 0, 8, glow(ORANGE, 2)));
    head.position.set(0, 3.25, -0.5); bridge.add(head);
    bridge.position.x = -0.4; g.add(bridge);
    // the finished hab, ready to go
    capsulePod(g, 2.3, 2.35, 1.0, 0.5, HULL, 0.4);
    return { group: g, top: 4.6, anim(t) { bridge.position.x = -0.4 + Math.sin(t * 0.5) * 1.3; head.position.z = -0.5 + Math.cos(t * 0.9) * 1.3; head.position.y = 3.25 - Math.abs(Math.sin(t * 0.25)) * 0.6; } };
  },

  // ---- Atmosphere Processor: a colossal stepped tower breathing out the new air, its
  // vents glowing in bands, a ring turning slowly near the top, and buttress fins
  atmos(color) {
    const g = new THREE.Group();
    padRing(g, -0.4, -0.4, 2.4, 0.15, ORANGE);
    const x = -0.4, z = -0.4;
    g.add(cyl(1.7, 2.0, 2.4, HULL2, x, 0.3, z, 8));
    g.add(cyl(1.25, 1.6, 2.4, HULL, x, 2.7, z, 8));
    g.add(cyl(0.75, 1.15, 2.2, HULL2, x, 5.1, z, 8));
    g.add(cyl(0.5, 0.7, 0.4, PLATE, x, 7.3, z, 8));
    const lights = [];
    for (const [y, r, n] of [[1.2, 1.88, 8], [3.6, 1.45, 8], [5.9, 0.98, 8]]) for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + Math.PI / 8;
      const v = box(r * 0.55, 0.4, 0.05, ORANGE, 0, 0, 0, glow(0xff6a1a, 1)); v.material = v.material.clone();
      v.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r); v.rotation.y = -a + Math.PI / 2; g.add(v); lights.push(v);
    }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const fin = wedge(new THREE.Group(), 0, 0, 0.18, 1.6, 4.2, PLATE, 0.2); fin.position.set(x + Math.cos(a) * 2.2, 0.15, z + Math.sin(a) * 2.2); fin.rotation.y = -a + Math.PI; g.add(fin); }
    const ring = new THREE.Group();
    const tor = mesh(new THREE.TorusGeometry(1.35, 0.1, 8, 40), color, glow(color, 0.5)); tor.rotation.x = Math.PI / 2; ring.add(tor);
    for (let k = 0; k < 4; k++) { const sp = box(1.3, 0.06, 0.06, PLATE, Math.cos(k * Math.PI / 2) * 0.65, 0, Math.sin(k * Math.PI / 2) * 0.65); sp.rotation.y = -k * Math.PI / 2; ring.add(sp); }
    ring.position.set(x, 6.4, z); g.add(ring);
    capsulePod(g, 2.2, 2.3, 0.9, 0.42);
    return { group: g, top: 8.6, steam: true, smoke: [new THREE.Vector3(x, 7.8, z)], anim(t) { ring.rotation.y = t * 0.5; lights.forEach((l, i) => { l.material.emissiveIntensity = 0.3 + 1.3 * Math.max(0, Math.sin(t * 1.8 - Math.floor(i / 8) * 1.2 - (i % 8) * 0.2)); }); } };
  },

  // ---- Mars Spaceport: a raised round landing platform on angled legs with a glowing
  // ring, the ship on it, a control spire with a tilted saucer cab, and fuel spheres
  marsport(color) {
    const g = new THREE.Group();
    const px = 0.4, pz = 0.2;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; rod(g, [px + Math.cos(a) * 2.25, 0.15, pz + Math.sin(a) * 2.25], [px + Math.cos(a) * 1.5, 0.75, pz + Math.sin(a) * 1.5], 0.12, PLATE); }
    g.add(cyl(2.0, 1.6, 0.4, HULL2, px, 0.55, pz, 32));
    g.add(cyl(1.85, 1.85, 0.04, 0x4a4e57, px, 0.95, pz, 32));
    const ringL = mesh(new THREE.TorusGeometry(1.75, 0.06, 4, 40), ORANGE, { emissive: ORANGE, night: 2.4 }); ringL.rotation.x = Math.PI / 2; ringL.position.set(px, 1.0, pz); g.add(ringL);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g.add(box(0.1, 0.03, 0.1, CYAN, px + Math.cos(a) * 1.4, 0.98, pz + Math.sin(a) * 1.4, { emissive: CYAN, night: 2.4 })); }
    const rocket = buildRocket('colony', color);
    rocket.position.set(px, 0.95, pz); g.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 5; i++) scaffold.add(box(1.8, 0.1, 1.8, 0xb9b4a8, px, 1.4 + i * 1.25, pz));
    for (const [dx, dz] of [[-0.85, -0.85], [0.85, 0.85], [-0.85, 0.85], [0.85, -0.85]]) scaffold.add(box(0.1, 6.4, 0.1, 0xb9b4a8, px + dx, 0.95, pz + dz));
    g.add(scaffold);
    // control spire with a saucer cab tilted toward the pad
    const sx = -2.45, sz = -2.35;
    g.add(cyl(0.55, 0.7, 0.4, GUN, sx, 0.15, sz, 14));
    g.add(cyl(0.18, 0.32, 4.4, HULL, sx, 0.55, sz, 12));
    const cab = new THREE.Group();
    const top1 = mesh(new THREE.CylinderGeometry(0.5, 1.0, 0.35, 24), HULL); top1.position.y = 0.32; cab.add(top1);
    const bot = mesh(new THREE.CylinderGeometry(1.0, 0.45, 0.3, 24), HULL2); cab.add(bot);
    const glass = mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.16, 24), 0x9fdcff, { emissive: 0x6fc8ff, emissiveIntensity: 0.3, night: 1.6, roughness: 0.05, metalness: 0.4 }); glass.position.y = 0.16; cab.add(glass);
    cab.position.set(sx, 5.1, sz); cab.rotation.set(0.12, 0, -0.12); g.add(cab);
    g.add(box(0.05, 1.0, 0.05, 0xdddddd, sx, 5.55, sz), box(0.1, 0.1, 0.1, 0xff3b2f, sx, 6.55, sz, glow(0xff2a1a, 1.5)));
    sphereTank(g, 2.65, -2.3, 0.55); sphereTank(g, 2.6, 2.5, 0.45, HULL, 0.6);
    return { group: g, top: 8.6, rocket, scaffold };
  },

  // ---- Wind Farm: twisting helix turbines that spin round upright masts (good in thin
  // air from any direction), and a wedge-roofed capacitor bank glowing with charge
  windfarm(color) {
    const g = new THREE.Group();
    const rotors = [];
    for (const [x, z, h] of [[-2.1, -1.9, 5.2], [1.9, -2.3, 4.4], [-1.9, 2.1, 3.8]]) {
      g.add(cyl(0.4, 0.5, 0.3, GUN, x, 0.15, z, 14));
      g.add(cyl(0.07, 0.09, h, HULL2, x, 0.45, z, 10));
      const rot = new THREE.Group();
      for (let b = 0; b < 3; b++) for (let k = 0; k < 8; k++) {
        const a = b * 2.094 + k * 0.16, y = 0.9 + k * (h - 1.2) / 8;
        const seg = box(0.08, (h - 1.2) / 8 + 0.04, 0.32, k % 4 === 0 ? color : HULL, Math.cos(a) * 0.45, y, Math.sin(a) * 0.45);
        seg.rotation.y = -a; rot.add(seg);
      }
      for (const y of [0.85, h - 0.3]) for (let b = 0; b < 3; b++) { const arm = box(0.45, 0.05, 0.05, PLATE, Math.cos(b * 2.094) * 0.22, y, Math.sin(b * 2.094) * 0.22); arm.rotation.y = -b * 2.094; rot.add(arm); }
      rot.position.set(x, 0.15, z); g.add(rot); rotors.push(rot);
      g.add(box(0.08, 0.08, 0.08, 0xff3b2f, x, h + 0.5, z, glow(0xff2a1a, 1.5)));
    }
    // the capacitor bank
    wedge(g, 2.0, 1.9, 1.9, 1.3, 1.2, HULL, 0.5);
    const cells = [];
    for (let k = 0; k < 4; k++) { const c = box(0.3, 0.3, 0.05, CYAN, 1.35 + k * 0.42, 0.3, 2.57, glow(0x2fd0ff, 1)); c.material = c.material.clone(); g.add(c); cells.push(c); }
    return { group: g, top: 6.0, anim(t, dt) { rotors.forEach((r, i) => { r.rotation.y += dt * (1.2 + i * 0.25); }); cells.forEach((c, i) => { c.material.emissiveIntensity = ((t * 0.6) % 1) * 4 > i ? 1.4 : 0.15; }); } };
  },

  // ---- Ice Vault Data Center: a glittering faceted dome of ice over the servers, ringed
  // by glowing server pylons and angled radiator blades that keep it all frozen
  icevault(color) {
    const g = new THREE.Group();
    padRing(g, -0.3, -0.4, 2.3);
    const crystal = mesh(new THREE.IcosahedronGeometry(1.7, 1), 0xcfeefa, { flatShading: true, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88, emissive: 0x4fb6e0, emissiveIntensity: 0.25 });
    crystal.scale.set(1, 0.72, 1); crystal.position.set(-0.3, 0.45, -0.4); g.add(crystal);
    g.add(cyl(0.9, 0.9, 0.5, 0x1a2a38, -0.3, 0.3, -0.4, 16, glow(0x2fb6ff, 0.5)));
    const lights = [];
    for (let k = 0; k < 6; k++) {
      const a = k / 6 * Math.PI * 2 + 0.3, x = -0.3 + Math.cos(a) * 2.5, z = -0.4 + Math.sin(a) * 2.5;
      if (z > 2.0 && Math.abs(x) < 1.3 || x > 2.0 && Math.abs(z) < 1.3) continue;
      g.add(box(0.36, 1.5, 0.36, GUN, x, 0.15, z));
      for (let r = 0; r < 4; r++) { const l = box(0.38, 0.06, 0.38, 0x5fd3ff, x, 0.4 + r * 0.3, z, glow(0x2fb6ff, 1)); l.material = l.material.clone(); g.add(l); lights.push(l); }
      g.add(cyl(0.05, 0.05, 0.4, HULL, x, 1.65, z, 6));
    }
    for (let k = 0; k < 4; k++) { const blade = box(0.06, 1.3, 1.4, 0xf2f4f7, 2.55, 0.15, -2.6 + k * 0.38); blade.rotation.z = -0.3; g.add(blade); }
    return { group: g, top: 4.0, steam: true, smoke: [new THREE.Vector3(-0.3, 1.8, -0.4)], anim(t) { lights.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(t * 6 + i * 1.9) > 0.1 ? 1.4 : 0.15; }); crystal.rotation.y = t * 0.05; } };
  },

  // ---- Colony Command: a tall tapering spire crowned by a wide saucer deck with a band
  // of glowing windows and a slowly turning ring of lights, over a domed plaza
  hqmars(color) {
    const g = new THREE.Group();
    const x = -0.6, z = -0.6;
    padRing(g, x, z, 2.2, 0.15, color);
    hullDome(g, x, z, 1.6, HULL2, 0.45, 0.3);
    g.add(cyl(0.35, 0.75, 5.0, HULL, x, 0.3, z, 16));
    for (const y of [2.2, 3.4]) g.add(cyl(0.62 - (y - 2) * 0.08, 0.62 - (y - 2) * 0.08, 0.12, color, x, y, z, 16, glow(color, 0.4)));
    // the saucer deck
    const deckY = 5.2;
    const under = mesh(new THREE.CylinderGeometry(2.0, 0.5, 0.55, 32), HULL2); under.position.set(x, deckY, z); g.add(under);
    const win = mesh(new THREE.CylinderGeometry(2.0, 2.0, 0.22, 32), 0x9fdcff, { emissive: 0x6fc8ff, emissiveIntensity: 0.35, night: 1.8, roughness: 0.05, metalness: 0.4 }); win.position.set(x, deckY + 0.38, z); g.add(win);
    const lid = mesh(new THREE.CylinderGeometry(0.9, 2.05, 0.4, 32), HULL); lid.position.set(x, deckY + 0.69, z); g.add(lid);
    hullDome(g, x, z, 0.7, HULL, 0.5, deckY + 0.88);
    const lights = new THREE.Group();
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; lights.add(box(0.12, 0.06, 0.12, k % 3 ? CYAN : ORANGE, Math.cos(a) * 2.02, 0, Math.sin(a) * 2.02, { emissive: k % 3 ? CYAN : ORANGE, night: 2.4 })); }
    lights.position.set(x, deckY + 0.15, z); g.add(lights);
    g.add(box(0.06, 1.2, 0.06, 0xdddddd, x, deckY + 1.2, z), box(0.12, 0.12, 0.12, 0xff3b2f, x, deckY + 2.4, z, glow(0xff2a1a, 1.5)));
    // a hover pad and a small comms dish out front
    padRing(g, 2.2, 2.2, 0.9, 0.15, ORANGE);
    g.add(cyl(0.06, 0.08, 1.4, HULL, 2.5, 0.15, -2.4, 8));
    const dish = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), HULL, { side: THREE.DoubleSide }); dish.rotation.x = -2.2; dish.position.set(2.5, 1.65, -2.4); g.add(dish);
    return { group: g, top: deckY + 2.6, anim(t) { lights.rotation.y = t * 0.4; dish.rotation.z = Math.sin(t * 0.3) * 0.6; } };
  },
});
