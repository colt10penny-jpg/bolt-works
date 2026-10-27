// The Mars colony, from the same kit as the other worlds (see buildings.js), with its own
// look so it reads nothing like the Mojave: crisp white and teal pressurised buildings on
// dark basalt footings, glowing green greenhouse domes, glass skybridges, cyan light
// strips, tall white wind turbines and frosty ice. These are the models named in
// worlds.js (SKINS.mars).
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
import { BUILDERS, box, cyl, GLOW } from './models.js';
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

// ---- more of the colony kit, for the bigger, busier buildings below ----
// a painted panel with real lettering: a dark plate, a coloured edge bar and bright
// condensed capitals that glow after dark
const MSIGNS = new Map();
function marsSignMat(text, bg, ink, aspect) {
  const key = text + bg + ink + aspect.toFixed(2);
  if (MSIGNS.has(key)) return MSIGNS.get(key);
  const H = 96, W = Math.max(96, Math.min(1024, Math.round(H * aspect)));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), hex = n => '#' + n.toString(16).padStart(6, '0');
  c.fillStyle = hex(bg); c.fillRect(0, 0, W, H);
  c.fillStyle = hex(ink); c.fillRect(0, 0, 10, H); c.fillRect(W - 10, 0, 10, H);
  c.globalAlpha = 0.35; c.fillRect(16, 8, W - 32, 3); c.fillRect(16, H - 11, W - 32, 3); c.globalAlpha = 1;
  let size = H * 0.56;
  const font = s => `900 ${s}px "Arial Black", "Helvetica Neue", Arial, sans-serif`;
  c.font = font(size);
  const tw = c.measureText(text).width;
  if (tw > W - 44) { size *= (W - 44) / tw; c.font = font(size); }
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = hex(ink);
  c.fillText(text, W / 2, H / 2 + size * 0.04);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.25, roughness: 0.5 });
  m.userData.baseGlow = 0.25; GLOW.lit.push(m);
  MSIGNS.set(key, m);
  return m;
}
// a sign facing +z (axis 'z') or +x (axis 'x'), its bottom edge at y, centred on (x, z)
export function marsSign(g, axis, x, y, z, w, h, text, bg = 0x1b222c, ink = CYAN, frame = GUN) {
  const back = box(axis === 'z' ? w + 0.1 : 0.06, h + 0.1, axis === 'z' ? 0.06 : w + 0.1, frame, x, y - 0.05, z);
  g.add(back);
  const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), marsSignMat(text, bg, ink, w / h));
  if (axis === 'z') p.position.set(x, y + h / 2, z + 0.035); else { p.rotation.y = Math.PI / 2; p.position.set(x + 0.035, y + h / 2, z); }
  g.add(p);
  return p;
}
// a pressurised hall: a ribbed half-tube lying along x on a dark plinth, with sealed end
// caps, a band of lit windows down each side and a little vent on top
function ribHall(g, x, z, len, r, color = HULL, win = CYAN) {
  g.add(box(len + 0.3, 0.25, r * 2 + 0.3, GUN, x, 0.15, z));
  const tube = mesh(new THREE.CylinderGeometry(r, r, len, 22, 1, false, 0, Math.PI), color);
  tube.rotation.z = Math.PI / 2; tube.position.set(x, 0.4, z); g.add(tube);
  for (let k = 0; k <= Math.round(len / 0.6); k++) {
    const rib = mesh(new THREE.TorusGeometry(r + 0.025, 0.045, 4, 18, Math.PI), k % 3 ? HULL2 : PLATE);
    rib.rotation.y = Math.PI / 2; rib.position.set(x - len / 2 + k * len / Math.round(len / 0.6), 0.4, z); g.add(rib);
  }
  for (const s of [-1, 1]) {
    const band = box(len * 0.82, 0.14, 0.04, win, 0, 0, 0, { emissive: win, emissiveIntensity: 0.5 });
    band.position.set(x, 0.4 + r * 0.5 - 0.07, z + s * r * 0.87); band.rotation.x = s * 0.52; g.add(band);
  }
  return 0.4 + r;
}
// a short ladder up the +z side of something
function ladderZ(g, x, z, y0, h) {
  for (const e of [-0.13, 0.13]) g.add(box(0.04, h, 0.04, PLATE, x + e, y0, z));
  for (let y = y0 + 0.2; y < y0 + h; y += 0.25) g.add(box(0.26, 0.03, 0.03, PLATE, x, y, z));
}
// a stack of bricks on a pallet
function brickStack(g, x, z, color, rows = 3) {
  g.add(box(1.0, 0.12, 0.7, GUN, x, 0.15, z));
  for (let k = 0; k < rows; k++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++)
    g.add(box(0.3, 0.16, 0.32, shade(color, ((i + j + k) % 2) ? -0.12 : 0), x - 0.32 + i * 0.32, 0.27 + k * 0.17, z - 0.17 + j * 0.34));
}

// the ones that get the full treatment, scaled up to fill their lots (see the end)
Object.assign(BUILDERS, {
  // ---- Oxygen Plant: a ribbed electrolysis hall with stacks humming on its roof, two tall
  // white oxygen tanks and a hydrogen ball behind it, a glass bubbler column fizzing away,
  // pipe racks tying it all together and a vent stack puffing off the extra steam.
  // (Factories keep the middle of each side clear for the truck bays, and keep low in the
  // corners where upgrade wings go.)
  oxyplant(color) {
    const g = new THREE.Group();
    const hx = 0, hz = 0.6;
    const hy = ribHall(g, hx, hz, 3.0, 0.95, HULL, color);
    // the electrolysis stacks along the roof ridge, each with a glowing slot
    const cells = [];
    for (const x of [-0.9, 0, 0.9]) {
      g.add(box(0.55, 0.36, 0.6, PLATE, x, hy - 0.12, hz), box(0.6, 0.06, 0.64, GUN, x, hy + 0.24, hz));
      const sl = box(0.4, 0.08, 0.02, color, x, hy + 0.04, hz + 0.31, { emissive: color, emissiveIntensity: 1 }); sl.material = sl.material.clone(); g.add(sl); cells.push(sl);
    }
    // a rooftop sign standing on two posts, above the truck bays
    marsSign(g, 'z', hx, hy + 0.5, hz + 0.5, 2.1, 0.5, 'OXYGEN', 0x14302c, 0x7dffe0);
    for (const x of [-0.85, 0.85]) g.add(box(0.07, 0.6, 0.07, PLATE, x, hy - 0.15, hz + 0.47));
    // the oxygen tanks: tall white capsules on skirts, with bands, labels and a ladder
    const tanks = [[-1.1, -1.25, 2.3], [0.15, -1.3, 3.0]];
    for (const [x, z, h] of tanks) {
      g.add(cyl(0.56, 0.6, 0.5, GUN, x, 0.15, z, 20));
      const t = mesh(new THREE.CapsuleGeometry(0.52, h, 8, 22), WH); t.position.set(x, 0.65 + 0.52 + h / 2, z); g.add(t);
      for (const f of [0.22, 0.78]) g.add(cyl(0.54, 0.54, 0.14, color, x, 0.65 + 0.52 + h * f, z, 22));
      marsSign(g, 'z', x, 0.65 + 0.52 + h * 0.38, z + 0.54, 0.56, 0.38, 'O2', 0x14302c, 0x7dffe0);
      ladderZ(g, x + 0.4, z + 0.38, 0.65, h + 0.4);
      g.add(cyl(0.18, 0.18, 0.18, PLATE, x, 0.65 + 1.04 + h, z, 10));
    }
    g.add(box(0.09, 0.09, 0.09, 0xff3b2f, 0.15, 0.65 + 1.25 + 3.0, -1.3, glow(0xff2a1a, 1.5)));
    // the hydrogen ball, banded orange
    const bx0 = 1.35, bz0 = -1.2;
    sphereTank(g, bx0, bz0, 0.55, 0xf1efe9, 0.6);
    const hb = mesh(new THREE.TorusGeometry(0.56, 0.05, 6, 28), ORANGE); hb.rotation.x = Math.PI / 2; hb.position.set(bx0, 0.15 + 0.6 + 0.55 * 0.6, bz0); g.add(hb);
    marsSign(g, 'x', bx0 + 0.42, 0.22, bz0 + 0.0, 0.42, 0.28, 'H2', 0x2a1a10, ORANGE);
    // the pipe rack: everything piped into the hall
    rod(g, [-1.6, 1.25, -0.55], [1.6, 1.25, -0.55], 0.08, 0x8a8f99);
    for (const x of [-1.5, 0.6, 1.5]) g.add(box(0.08, 1.15, 0.08, PLATE, x, 0.15, -0.55));
    for (const [x, z] of tanks) pipe(g, [[x, 1.25, z + 0.5], [x, 1.25, -0.55]], 0.07, 0x8a8f99);
    pipe(g, [[bx0, 1.0, bz0 + 0.5], [bx0, 1.25, -0.55]], 0.07, 0x8a8f99);
    for (const x of [-1.2, 0.3, 1.2]) pipe(g, [[x, 1.25, -0.55], [x, 1.1, -0.2]], 0.06, 0x8a8f99);
    // the bubbler: a glass column full of rising bubbles, out in the front corner
    const bx = 1.6, bz = 1.6;
    g.add(cyl(0.32, 0.36, 0.25, GUN, bx, 0.15, bz, 16), cyl(0.32, 0.32, 0.14, GUN, bx, 1.8, bz, 16));
    g.add(mesh(new THREE.CylinderGeometry(0.27, 0.27, 1.4, 18, 1, true), 0xbff6ff, { transparent: true, opacity: 0.35, roughness: 0.05, depthWrite: false, side: THREE.DoubleSide }).translateX(bx).translateY(1.1).translateZ(bz));
    g.add(cyl(0.23, 0.23, 1.35, 0x2fd6c0, bx, 0.42, bz, 14, { transparent: true, opacity: 0.45, emissive: 0x2fd6c0, emissiveIntensity: 0.4 }));
    const bubbles = [];
    for (let k = 0; k < 7; k++) { const b = mesh(new THREE.SphereGeometry(0.05 + (k % 3) * 0.02, 8, 6), 0xe8fffb, { emissive: 0x9ffff0, emissiveIntensity: 0.6 }); b.position.set(bx, 0.5, bz); g.add(b); bubbles.push(b); }
    pipe(g, [[bx, 1.94, bz], [bx, 2.05, bz], [bx, 2.05, hz + 0.3], [1.3, 1.2, hz + 0.3]], 0.05, 0x8a8f99);
    // the vent stack, in the back corner by the tanks
    const vx = -1.65, vz = -0.25;
    g.add(cyl(0.28, 0.34, 0.3, GUN, vx, 0.15, vz, 14), cyl(0.14, 0.2, 3.4, HULL2, vx, 0.45, vz, 14));
    const rings = [];
    for (const y of [1.6, 2.5, 3.3]) { const l = cyl(0.2, 0.2, 0.08, color, vx, y, vz, 14, { emissive: color, emissiveIntensity: 0.6 }); l.material = l.material.clone(); g.add(l); rings.push(l); }
    g.add(cyl(0.22, 0.16, 0.25, PLATE, vx, 3.85, vz, 14));
    return { group: g, top: 4.9, steam: true, smoke: [new THREE.Vector3(vx, 4.15, vz)],
      anim(t) {
        bubbles.forEach((b, i) => { const f = (t * 0.45 + i / 7) % 1; b.position.y = 0.5 + f * 1.15; b.position.x = bx + Math.cos(i * 2.4 + t) * 0.11; b.position.z = bz + Math.sin(i * 2.4 + t) * 0.11; });
        cells.forEach((c, i) => { c.material.emissiveIntensity = 0.5 + 0.9 * Math.max(0, Math.sin(t * 3 - i)); });
        rings.forEach((l, i) => { l.material.emissiveIntensity = 0.2 + 1.2 * Math.max(0, Math.sin(t * 2.2 - i * 0.9)); });
      } };
  },

  // ---- Brick Kiln: a red regolith heap, a conveyor up into a big hopper, a long dark
  // sintering tunnel glowing orange through its portholes, a robot arm stacking the new
  // bricks off the end of the line onto pallets, and a tall exhaust stack
  brickworks(color) {
    const g = new THREE.Group();
    const DIRT = 0xa8482a;
    // the regolith heap, low in the back corner
    for (const [x, z, r, h] of [[-2.0, -2.0, 0.95, 0.5], [-1.45, -2.3, 0.6, 0.38], [-2.4, -1.45, 0.55, 0.32]]) {
      const m = mesh(new THREE.DodecahedronGeometry(1, 0), DIRT, { flatShading: true, roughness: 1 }); m.scale.set(r, h, r); m.position.set(x, 0.15, z); m.rotation.y = x; g.add(m);
    }
    // the feed conveyor up into the hopper
    const fa = new THREE.Vector3(-1.85, 0.55, -1.75), fb = new THREE.Vector3(-1.05, 2.3, -1.35);
    const belt = mesh(new THREE.BoxGeometry(0.4, 0.12, fa.distanceTo(fb)), GUN); belt.position.copy(fa).add(fb).multiplyScalar(0.5); belt.lookAt(fb); g.add(belt);
    const beltTop = mesh(new THREE.BoxGeometry(0.32, 0.04, fa.distanceTo(fb)), 0x6a3324); beltTop.position.copy(belt.position).add(new THREE.Vector3(0, 0.07, 0)); beltTop.lookAt(fb.clone().add(new THREE.Vector3(0, 0.07, 0))); g.add(beltTop);
    g.add(box(0.08, 1.25, 0.08, PLATE, -1.45, 0.15, -1.55));
    // the hopper: a funnel on legs, hazard band round its rim
    const hx = -0.55, hz = -1.3;
    for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.add(box(0.1, 1.6, 0.1, PLATE, hx + dx, 0.15, hz + dz));
    const fun = mesh(new THREE.CylinderGeometry(0.75, 0.2, 0.95, 4, 1), HULL2); fun.rotation.y = Math.PI / 4; fun.position.set(hx, 2.22, hz); g.add(fun);
    const rim = mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.16, 4, 1, true), HAZ, { side: THREE.DoubleSide }); rim.rotation.y = Math.PI / 4; rim.position.set(hx, 2.74, hz); g.add(rim);
    g.add(box(0.5, 0.06, 0.5, DIRT, hx, 2.64, hz));
    g.add(cyl(0.15, 0.15, 0.7, PLATE, hx, 1.05, hz + 0.25, 8));
    // the sintering tunnel
    const kx = 0.1, kz = 0.3, klen = 3.0;
    const ktop = ribHall(g, kx, kz, klen, 0.8, 0x4a4d55, ORANGE);
    const ports = [];
    for (let k = 0; k < 5; k++) {
      const px = kx - klen / 2 + 0.4 + k * 0.55;
      const pp = cyl(0.12, 0.12, 0.06, 0xff8a3a, 0, 0, 0, 12, { emissive: 0xff6a1a, emissiveIntensity: 1.4 }); pp.material = pp.material.clone(); pp.rotation.x = Math.PI / 2; pp.position.set(px, 0.6, kz + 0.79); g.add(pp); ports.push(pp);
      const rimP = mesh(new THREE.TorusGeometry(0.14, 0.03, 4, 14), PLATE); rimP.position.set(px, 0.6, kz + 0.81); g.add(rimP);
    }
    // the hot mouth at the end, and heat fins along the roof
    const mouth = mesh(new THREE.CircleGeometry(0.58, 18, 0, Math.PI), 0xffb060, { emissive: 0xff7a1a, emissiveIntensity: 1.6, side: THREE.DoubleSide }); mouth.rotation.y = Math.PI / 2; mouth.position.set(kx + klen / 2 + 0.01, 0.42, kz); mouth.material = mouth.material.clone(); g.add(mouth);
    for (let k = 0; k < 6; k++) g.add(box(0.06, 0.3, 0.85, PLATE, kx - 1.15 + k * 0.46, ktop - 0.12, kz));
    marsSign(g, 'z', kx - 0.2, ktop + 0.25, kz + 0.52, 2.1, 0.46, 'BRICK KILN', 0x2a1612, 0xffa560);
    for (const x of [-0.95, 0.75]) g.add(box(0.07, 0.5, 0.07, PLATE, kx + x, ktop - 0.2, kz + 0.49));
    // the exhaust stack
    const sx = 0.85, sz = -1.3;
    g.add(cyl(0.38, 0.42, 0.35, GUN, sx, 0.15, sz, 14), cyl(0.19, 0.28, 4.0, HULL, sx, 0.5, sz, 14));
    for (const y of [1.6, 2.7, 3.8]) g.add(cyl(0.28 - y * 0.02, 0.28 - y * 0.02, 0.1, ORANGE, sx, y, sz, 14, { emissive: ORANGE, night: 2 }));
    g.add(cyl(0.25, 0.19, 0.25, PLATE, sx, 4.5, sz, 14), box(0.08, 0.08, 0.08, 0xff3b2f, sx + 0.24, 4.65, sz, glow(0xff2a1a, 1.5)));
    pipe(g, [[kx - 0.3, ktop - 0.1, kz - 0.45], [kx - 0.3, ktop + 0.35, kz - 0.45], [sx, ktop + 0.35, kz - 0.45], [sx, ktop + 0.35, sz + 0.2]], 0.09, 0x8a8f99);
    // the out-feed belt round the end of the tunnel, and the robot arm stacking bricks
    const ox = 1.62;
    g.add(box(0.42, 0.36, 2.0, GUN, ox, 0.15, kz + 0.6), box(0.34, 0.04, 1.95, 0x2a2d33, ox, 0.51, kz + 0.6));
    const bricks = [];
    for (let i = 0; i < 4; i++) { const b = box(0.26, 0.15, 0.26, color, ox, 0.53, 0); g.add(b); bricks.push(b); }
    const arm = new THREE.Group(); arm.position.set(1.0, 0.15, 1.95);
    arm.add(cyl(0.26, 0.3, 0.22, GUN, 0, 0, 0, 14), cyl(0.15, 0.19, 0.5, ORANGE, 0, 0.22, 0, 12));
    const up = new THREE.Group(); up.position.y = 0.72; up.rotation.z = 0.5;
    up.add(box(0.15, 0.9, 0.15, ORANGE, 0, 0, 0), cyl(0.09, 0.09, 0.2, GUN, 0, 0.9, 0, 10).rotateX(Math.PI / 2));
    const fore = new THREE.Group(); fore.position.y = 0.9; fore.rotation.z = -1.6;
    fore.add(box(0.11, 0.75, 0.11, ORANGE, 0, 0, 0), box(0.22, 0.11, 0.18, GUN, 0, 0.75, 0));
    up.add(fore); arm.add(up); g.add(arm);
    // the finished bricks, palleted up in the front corner
    brickStack(g, -1.55, 1.75, color, 2); brickStack(g, -2.3, 2.3, color, 1);
    return { group: g, top: 5.0, smoke: [new THREE.Vector3(sx, 4.85, sz)],
      anim(t) {
        bricks.forEach((b, i) => { b.position.z = kz + 1.5 - ((t * 0.3 + i / 4) % 1) * 1.8; });
        arm.rotation.y = Math.sin(t * 0.9) * 1.0; up.rotation.z = 0.45 + Math.sin(t * 1.8) * 0.15; fore.rotation.z = -1.6 + Math.sin(t * 1.8 + 1) * 0.3;
        ports.forEach((pp, i) => { pp.material.emissiveIntensity = 1.1 + Math.sin(t * 2 + i) * 0.4; });
        mouth.material.emissiveIntensity = 1.4 + Math.sin(t * 3) * 0.3;
      } };
  },

  // ---- Wind Farm: one tall three-bladed turbine with long red-tipped blades, two twisting
  // helix turbines that catch the wind from any side, cables in glowing trenches to a
  // substation of humming battery banks and ceramic insulators, and a weather mast
  windfarm(color) {
    const g = new THREE.Group();
    // the big one
    const tx = -0.85, tz = -0.85, th = 5.4;
    g.add(cyl(0.6, 0.7, 0.3, GUN, tx, 0.15, tz, 16), cyl(0.15, 0.3, th, WH, tx, 0.45, tz, 16));
    g.add(cyl(0.29, 0.29, 0.3, TEAL, tx, 1.1, tz, 16));
    g.add(box(0.06, 0.06, 0.06, 0xff3b2f, tx + 0.18, th * 0.6, tz, glow(0xff2a1a, 1.2)));
    const nac = new THREE.Group(); nac.position.set(tx, 0.45 + th, tz); nac.rotation.y = Math.PI / 4;
    const body = mesh(new THREE.CapsuleGeometry(0.24, 0.8, 6, 14), WH); body.rotation.x = Math.PI / 2; nac.add(body);
    nac.add(box(0.5, 0.06, 0.6, TEAL, 0, 0.2, -0.15), box(0.08, 0.08, 0.08, 0xff3b2f, 0, 0.3, -0.4, glow(0xff2a1a, 1.5)));
    const rotor = new THREE.Group(); rotor.position.z = 0.65;
    const hub = mesh(new THREE.ConeGeometry(0.22, 0.4, 14), WH); hub.rotation.x = Math.PI / 2; hub.position.z = 0.1; rotor.add(hub);
    for (let k = 0; k < 3; k++) {
      const a = new THREE.Group(); a.rotation.z = k * Math.PI * 2 / 3;
      const sh = new THREE.Shape(); sh.moveTo(-0.12, 0); sh.lineTo(0.26, 0.35); sh.lineTo(0.1, 2.45); sh.lineTo(-0.04, 2.55); sh.lineTo(-0.16, 0.3); sh.closePath();
      const bl = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.04, bevelEnabled: false }), WH); bl.position.z = -0.02; bl.rotation.y = 0.18; a.add(bl);
      const tip = box(0.16, 0.32, 0.05, 0xd94a3a, 0.03, 2.18, 0); a.add(tip);
      rotor.add(a);
    }
    nac.add(rotor); g.add(nac);
    // two helix turbines
    const helix = [];
    for (const [x, z, h] of [[1.65, -1.45, 3.4], [-1.9, 1.35, 2.7]]) {
      g.add(cyl(0.42, 0.5, 0.3, GUN, x, 0.15, z, 14), cyl(0.07, 0.09, h + 0.3, HULL2, x, 0.45, z, 10));
      const rot = new THREE.Group();
      for (let b = 0; b < 3; b++) for (let k = 0; k < 10; k++) {
        const a = b * 2.094 + k * 0.13, y = 0.75 + k * (h - 0.9) / 10;
        const seg = box(0.07, (h - 0.9) / 10 + 0.03, 0.3, k === 0 || k === 9 ? TEAL : WH, Math.cos(a) * 0.48, y, Math.sin(a) * 0.48);
        seg.rotation.y = -a; rot.add(seg);
      }
      for (const y of [0.72, h - 0.12]) { rot.add(cyl(0.5, 0.5, 0.04, PLATE, 0, y, 0, 18)); }
      rot.position.set(x, 0.15, z); g.add(rot); helix.push(rot);
      g.add(box(0.07, 0.07, 0.07, 0xff3b2f, x, h + 0.75, z, glow(0xff2a1a, 1.5)));
    }
    // the substation: a battery hall with charge meters, insulators and a transformer
    const sx = 1.0, sz = 1.25;
    g.add(box(2.1, 0.2, 1.5, GUN, sx, 0.15, sz));
    g.add(box(1.9, 1.15, 1.2, HULL, sx, 0.35, sz), box(2.0, 0.12, 1.3, PLATE, sx, 1.5, sz));
    const meters = [];
    for (let k = 0; k < 5; k++) {
      const mx = sx - 0.72 + k * 0.36;
      g.add(box(0.26, 0.8, 0.04, 0x1a2230, mx, 0.5, sz + 0.61));
      for (let j = 0; j < 4; j++) { const c = box(0.2, 0.15, 0.03, CYAN, mx, 0.55 + j * 0.18, sz + 0.635, glow(0x2fd0ff, 1)); c.material = c.material.clone(); g.add(c); meters.push([c, k, j]); }
    }
    marsSign(g, 'x', sx + 0.96, 0.75, sz, 1.0, 0.4, 'POWER', 0x0f2430, CYAN);
    for (let k = 0; k < 3; k++) {
      const ix = sx - 0.6 + k * 0.6;
      g.add(box(0.08, 0.2, 0.08, PLATE, ix, 1.62, sz));
      for (let j = 0; j < 4; j++) g.add(cyl(0.11, 0.11, 0.05, 0xd8d2c8, ix, 1.82 + j * 0.1, sz, 10));
      g.add(cyl(0.04, 0.04, 0.12, PLATE, ix, 2.22, sz, 6));
    }
    g.add(box(0.7, 0.8, 0.6, GUN, -0.55, 0.15, 1.95));
    for (let k = 0; k < 6; k++) g.add(box(0.03, 0.6, 0.14, PLATE, -0.84 + k * 0.115, 0.25, 2.3));
    // cables in glowing trenches from each turbine to the substation
    const trench = (ax, az, bx, bz) => {
      const len = Math.hypot(bx - ax, bz - az), m = box(0.1, 0.03, len, CYAN, (ax + bx) / 2, 0.15, (az + bz) / 2, { emissive: CYAN, emissiveIntensity: 0.6 });
      m.rotation.y = Math.atan2(bx - ax, bz - az); g.add(m);
    };
    trench(tx, tz + 0.6, sx - 0.6, sz - 0.75); trench(1.65, -1.0, sx + 0.4, sz - 0.75); trench(-1.9, 0.9, sx - 0.95, sz - 0.2);
    // the weather mast: cups spinning, a vane, a blinking light
    const wx = 0.35, wz = -2.05;
    g.add(cyl(0.18, 0.22, 0.2, GUN, wx, 0.15, wz, 10), cyl(0.03, 0.04, 2.6, PLATE, wx, 0.35, wz, 6));
    const cups = new THREE.Group(); cups.position.set(wx, 2.95, wz);
    for (let k = 0; k < 3; k++) { const a = k * 2.094; cups.add(box(0.42, 0.02, 0.02, PLATE, Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2).rotateY(-a)); const c = mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI), ORANGE); c.position.set(Math.cos(a) * 0.4, 0, Math.sin(a) * 0.4); c.rotation.y = -a; cups.add(c); }
    g.add(cups);
    g.add(box(0.4, 0.12, 0.02, WH, wx + 0.15, 2.65, wz), box(0.07, 0.07, 0.07, 0xff3b2f, wx, 3.05, wz, glow(0xff2a1a, 1.5)));
    return { group: g, top: 0.45 + th + 2.6,
      anim(t, dt) {
        rotor.rotation.z += dt * 1.3;
        helix.forEach((r, i) => { r.rotation.y += dt * (1.4 + i * 0.3); });
        cups.rotation.y += dt * 5;
        const lvl = (t * 0.35) % 1;
        meters.forEach(([c, k, j]) => { c.material.emissiveIntensity = (j + 1) / 4 <= ((lvl + k * 0.17) % 1) + 0.2 ? 1.3 : 0.12; });
      } };
  },

  // ---- Ice Vault Data Center: the servers dug into a great faceted mound of ice to keep
  // them cold, behind a glass front where rack lights blink; radiator fins on the ice, a
  // cooling tower breathing out vapour, frosty coolant pipes and a big comms dish
  icevault(color) {
    const g = new THREE.Group();
    const ICEM = { flatShading: true, roughness: 0.22, metalness: 0.05, emissive: 0x4fb6e0, emissiveIntensity: 0.12 };
    // the ice mound
    const berm = mesh(new THREE.IcosahedronGeometry(1, 1), 0xd9f2fb, ICEM); berm.scale.set(2.5, 1.45, 2.0); berm.position.set(-0.75, 0.05, -0.75); g.add(berm);
    const berm2 = mesh(new THREE.IcosahedronGeometry(1, 1), 0xc6e8f6, ICEM); berm2.scale.set(1.3, 0.9, 1.2); berm2.position.set(-2.0, 0.05, 0.6); berm2.rotation.y = 0.7; g.add(berm2);
    const glints = [];
    for (const [x, y, z, s] of [[-1.6, 1.25, -0.3, 0.35], [0.4, 0.9, -1.8, 0.28], [-2.3, 0.75, -1.3, 0.3], [-0.2, 1.4, -1.1, 0.22], [-2.4, 0.4, 1.5, 0.25], [1.7, 0.3, -0.4, 0.2]]) {
      const c = mesh(new THREE.OctahedronGeometry(s, 0), 0xeefcff, { roughness: 0.1, transparent: true, opacity: 0.85, emissive: 0x7fdcff, emissiveIntensity: 0.3 });
      c.material = c.material.clone(); c.scale.y = 1.6; c.position.set(x, y, z); c.rotation.set(0.3, x, 0.2); g.add(c); glints.push(c);
    }
    // the vault front pushing out of the ice: a heavy frame round a glass wall of racks
    const fx = 0.55, fz = 0.95, fw = 2.7, fd = 1.5, fh = 1.55;
    g.add(box(fw + 0.2, 0.2, fd + 0.2, GUN, fx, 0.15, fz));
    g.add(box(fw, fh, 0.7, 0x1c2430, fx, 0.35, fz - 0.4));
    g.add(box(fw, 0.05, fd, 0x2a3442, fx, 0.35, fz));
    for (const dx of [-fw / 2, fw / 2]) g.add(box(0.22, fh + 0.1, fd, HULL, fx + dx, 0.35, fz));
    g.add(box(fw + 0.4, 0.28, fd + 0.25, HULL, fx, 0.35 + fh, fz + 0.05), box(fw + 0.42, 0.06, fd + 0.27, color, fx, 0.35 + fh + 0.1, fz + 0.05, { emissive: color, emissiveIntensity: 0.4 }));
    const leds = [];
    for (let k = 0; k < 5; k++) {
      const rx = fx - 1.0 + k * 0.5;
      g.add(box(0.36, 1.25, 0.4, 0x10151c, rx, 0.4, fz + 0.15));
      for (let j = 0; j < 6; j++) { const l = box(0.26, 0.04, 0.02, j % 3 === 2 ? 0x7dff9a : 0x5fd3ff, rx, 0.55 + j * 0.18, fz + 0.36, glow(j % 3 === 2 ? 0x4dff7a : 0x2fb6ff, 1.2)); l.material = l.material.clone(); g.add(l); leds.push(l); }
    }
    const glass = mesh(new THREE.BoxGeometry(fw - 0.2, fh - 0.1, 0.05), 0xaee6ff, { transparent: true, opacity: 0.28, roughness: 0.05, metalness: 0.3, depthWrite: false });
    glass.position.set(fx, 0.35 + fh / 2, fz + 0.68); g.add(glass);
    for (let k = 1; k < 4; k++) g.add(box(0.05, fh - 0.1, 0.06, HULL2, fx - (fw - 0.2) / 2 + k * (fw - 0.2) / 4, 0.4, fz + 0.69));
    marsSign(g, 'z', fx, 0.35 + fh + 0.03, fz + 0.05 + (fd + 0.25) / 2 + 0.01, 1.9, 0.22, 'ICE VAULT', 0x0e1a2a, 0x9fe6ff);
    // radiator fins on the +x side
    for (let k = 0; k < 5; k++) g.add(box(0.5, 1.2, 0.05, 0xf2f4f7, fx + fw / 2 + 0.36, 0.35, fz - 0.55 + k * 0.28));
    g.add(box(0.06, 0.06, 1.3, PLATE, fx + fw / 2 + 0.36, 1.5, fz));
    // radiator array on top of the ice
    for (let r = 0; r < 2; r++) for (let k = 0; k < 5; k++) { const p = box(0.06, 0.6, 0.85, 0xf4f6f8, -1.7 + k * 0.32, 1.35, -1.25 + r * 1.0); p.rotation.z = 0.2; g.add(p); }
    for (const z of [-1.25, -0.25]) g.add(box(1.6, 0.06, 0.06, PLATE, -1.06, 1.3, z));
    // the cooling tower: a waisted shell breathing vapour
    const ctx = -1.85, ctz = 0.55;
    const pts = []; for (let k = 0; k <= 8; k++) { const y = k / 8; pts.push(new THREE.Vector2(0.55 - Math.sin(y * Math.PI) * 0.2 - y * 0.08, y * 1.9)); }
    const ct = mesh(new THREE.LatheGeometry(pts, 22), 0xeef1f4, { side: THREE.DoubleSide }); ct.position.set(ctx, 0.85, ctz); g.add(ct);
    g.add(cyl(0.48, 0.48, 0.08, color, ctx, 2.25, ctz, 22, { emissive: color, emissiveIntensity: 0.5 }));
    // frosty coolant pipes from the ice into the vault, with glowing collars
    pipe(g, [[-0.6, 0.55, 0.0], [-0.6, 0.55, 0.55], [fx - 1.2, 0.55, 0.55]], 0.11, 0xcfe9f2);
    pipe(g, [[ctx, 0.85, ctz + 0.4], [ctx, 0.45, ctz + 0.9], [fx - 1.45, 0.45, ctz + 0.9]], 0.09, 0xcfe9f2);
    for (const [x, y, z] of [[-0.6, 0.55, 0.3], [-0.95, 0.45, ctz + 0.9]]) g.add(box(0.28, 0.28, 0.28, CYAN, x - 0.14 + 0.14, y - 0.14, z, glow(0x2fd0ff, 0.9)));
    // the comms dish
    const dx = 1.75, dz = -1.4;
    g.add(cyl(0.35, 0.4, 0.3, GUN, dx, 0.15, dz, 14), cyl(0.08, 0.12, 1.7, PLATE, dx, 0.45, dz, 10));
    const dish = new THREE.Group(); dish.position.set(dx, 2.2, dz);
    const bowl = mesh(new THREE.SphereGeometry(0.85, 22, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), WH, { side: THREE.DoubleSide }); bowl.rotation.x = Math.PI; bowl.position.y = 0.75; dish.add(bowl);
    dish.add(cyl(0.03, 0.03, 0.75, PLATE, 0, 0.05, 0, 6), box(0.12, 0.12, 0.12, 0xff3b2f, 0, 0.82, 0, glow(0xff2a1a, 1.5)));
    dish.rotation.x = -0.7; const yaw = new THREE.Group(); yaw.position.copy(dish.position); dish.position.set(0, 0, 0); yaw.add(dish); g.add(yaw);
    // stacked ice blocks, cut and waiting
    for (const [x, y, z] of [[1.15, 0.15, -2.15], [1.6, 0.15, -2.3], [1.38, 0.55, -2.2]]) g.add(box(0.42, 0.4, 0.42, 0xd2f0fa, x, y, z, { roughness: 0.15, transparent: true, opacity: 0.9 }));
    return { group: g, top: 4.2, steam: true, smoke: [new THREE.Vector3(ctx, 2.8, ctz)],
      anim(t) {
        leds.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(t * 7 + i * 2.3) > -0.2 ? 1.3 : 0.1; });
        yaw.rotation.y = Math.sin(t * 0.25) * 0.9;
        glints.forEach((c, i) => { c.material.emissiveIntensity = 0.2 + 0.5 * Math.max(0, Math.sin(t * 1.3 + i * 1.7)); });
      } };
  },
});

// Scale the colony's buildings up so they fill their lots like the other worlds', with
// the main building in a core group the lot can look at to find its free corners (the
// spaceport is left alone: its ship has to fit its launch animation)
// (only those without truck bays: a factory keeps the middle of each side free for them)
for (const [name, MARS_S] of [['windfarm', 1.25], ['icevault', 1.3], ['hqmars', 1.2], ['oxyplant', 1.0], ['brickworks', 1.0]]) {
  const make = BUILDERS[name];
  BUILDERS[name] = color => {
    const m = make(color), core = new THREE.Group();
    core.scale.setScalar(MARS_S); core.userData.core = true;
    for (const c of [...m.group.children]) core.add(c);
    m.group.add(core);
    m.top *= MARS_S;
    if (m.smoke) m.smoke = m.smoke.map(v => v.clone().multiplyScalar(MARS_S));
    return m;
  };
}
