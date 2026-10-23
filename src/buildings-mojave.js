// The Mojave buildings, built from the same kit as Colorado's (see buildings.js), with a
// desert look: sun-baked stucco and adobe, terracotta trim, sun shades, solar panels
// and corrugated metal. Each replaces the plainer builder of the same name in models.js.
//
// The middle of each side (where loading bays go when a road runs past) is kept clear
// of anything tall, so trucks and bays don't run into the buildings.
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
import { BUILDERS, box, cyl, mat } from './models.js';
import {
  TRIM, DARK, IRON, HAZ, GLASS, WARM, PLINTH, RED, WHITE, shade, mesh, at, rod, onWall, win, winRow, door, sideDoor,
  signBoard, ladder, railing, pipe, hall, chimney, tank, lattice,
} from './buildings.js';

const STUCCO = 0xeadbbd, ADOBE = 0xd9b38c, TERRA = 0xc8643c, SAND = 0xe2c58f, SHADE = 0xdfe2e6, CELL = 0x223f78, ORANGE = 0xe07b2a, TEAL = 0x2fa39a;

// ---- desert parts ----
// a solar panel: a dark blue face with a light cell grid in a thin frame (flat, facing up)
function solarPanel(w, d) {
  const g = new THREE.Group();
  g.add(box(w, 0.06, d, IRON, 0, 0, 0));
  g.add(box(w - 0.06, 0.03, d - 0.06, CELL, 0, 0.05, 0, { roughness: 0.25, metalness: 0.4 }));
  const nx = Math.max(1, Math.round(w / 0.32)), nz = Math.max(1, Math.round(d / 0.32));
  for (let i = 1; i < nx; i++) g.add(box(0.015, 0.01, d - 0.08, 0x8fb3e6, -w / 2 + (w * i) / nx, 0.08, 0));
  for (let i = 1; i < nz; i++) g.add(box(w - 0.08, 0.01, 0.015, 0x8fb3e6, 0, 0.08, -d / 2 + (d * i) / nz));
  return g;
}
// a row of panels tilted toward the sun (south is -z, so they lean that way), on legs
function panelRow(g, x, z, y, w, d, n, gap) {
  for (let i = 0; i < n; i++) {
    const px = x + (i - (n - 1) / 2) * gap;
    const p = solarPanel(w, d); p.rotation.x = 0.4; p.position.set(px, y + 0.35, z); g.add(p);
    g.add(box(0.06, 0.35, 0.06, IRON, px - w / 2 + 0.1, y, z - d * 0.35), box(0.06, 0.35, 0.06, IRON, px + w / 2 - 0.1, y, z - d * 0.35));
    g.add(box(0.06, 0.6, 0.06, IRON, px - w / 2 + 0.1, y, z + d * 0.35), box(0.06, 0.6, 0.06, IRON, px + w / 2 - 0.1, y, z + d * 0.35));
  }
}
// a flat sun shade on slim posts
function shadeCanopy(g, x, z, w, d, h, color = SHADE) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.08, h, 0.08, IRON, x + dx * (w / 2 - 0.1), 0.15, z + dz * (d / 2 - 0.1)));
  g.add(box(w, 0.08, d, color, x, h + 0.15, z));
  for (let i = 0; i < Math.round(w / 0.3); i++) g.add(box(0.05, 0.05, d, shade(color, -0.2), x - w / 2 + 0.15 + i * 0.3, h + 0.23, z));
}
// louvres: slim horizontal fins over a window band, for the hard desert sun
function louvres(g, axis, a, y, f, w, n = 4) {
  const s = Math.sign(f) || 1;
  for (let k = 0; k < n; k++) g.add(onWall(axis, a, y + k * 0.2, f + s * 0.12, w, 0.04, 0.22, SHADE));
}
// a conveyor between two points, with yellow side rails and legs down to the ground.
// Returns the start and end so things can ride along it.
function conveyor(g, a, b, wdt = 0.5, color = DARK) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A), len = dir.length();
  const belt = new THREE.Group();
  belt.add(mesh(new THREE.BoxGeometry(len, 0.12, wdt), color));
  belt.add(at(mesh(new THREE.BoxGeometry(len, 0.04, wdt - 0.1), 0x2a2d33), 0, 0.08, 0));
  for (const e of [-1, 1]) belt.add(at(mesh(new THREE.BoxGeometry(len, 0.16, 0.04), HAZ), 0, 0.12, e * wdt / 2));
  belt.position.copy(A).add(B).multiplyScalar(0.5);
  belt.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), dir.clone().normalize());
  g.add(belt);
  for (const t of [0.3, 0.7]) { const p = A.clone().lerp(B, t); if (p.y > 0.6) g.add(box(0.1, p.y - 0.2, 0.1, IRON, p.x, 0.15, p.z)); }
  return { A, B };
}
// a potted cactus by a door
function cactusPot(g, x, z, h = 0.9) {
  g.add(cyl(0.26, 0.2, 0.32, TERRA, x, 0.15, z, 10));
  g.add(cyl(0.12, 0.13, h, 0x4f8f4a, x, 0.45, z, 8));
  const arm = cyl(0.07, 0.07, 0.35, 0x4f8f4a, x + 0.17, 0.75, z, 6); g.add(arm);
  g.add(box(0.2, 0.07, 0.07, 0x4f8f4a, x + 0.08, 0.72, z));
}
// a wooden beam end sticking out of an adobe wall (vigas)
function vigas(g, axis, a0, w, y, f, n) {
  for (let i = 0; i < n; i++) g.add(onWall(axis, a0 - w / 2 + (w * (i + 0.5)) / n, y, f, 0.16, 0.16, 0.3, 0x7a5230));
}
// a little drone: a body, four arms and rotors
function drone(color) {
  const d = new THREE.Group();
  d.add(box(0.36, 0.12, 0.36, color, 0, 0, 0), box(0.2, 0.08, 0.2, DARK, 0, -0.08, 0));
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const arm = box(0.32, 0.04, 0.05, DARK, x * 0.16, 0.04, z * 0.16); arm.rotation.y = Math.atan2(z, -x); d.add(arm);
    d.add(cyl(0.15, 0.15, 0.015, 0xd8dbe2, x * 0.27, 0.09, z * 0.27, 12));
  }
  d.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return d;
}

Object.assign(BUILDERS, {
  // ---- Sand Quarry: a screening plant on stilts, conveyors throwing sand onto big
  // piles, an excavator digging, and the site office trailer
  quarry(color) {
    const g = new THREE.Group();
    const pile = (x, z, r, h, c) => { const m = mesh(new THREE.ConeGeometry(r, h, 12), c, { flatShading: true }); m.position.set(x, h / 2 + 0.15, z); g.add(m); };
    pile(-2.2, 2.1, 1.25, 1.45, color); pile(-2.65, -2.5, 0.75, 0.7, shade(color, -0.08)); pile(-2.9, 0.75, 0.55, 0.5, shade(color, 0.1));
    // screening plant: legs, a deck with a rail, the tilted screen box and a hopper on top
    const sx = 1.65, sz = -1.65;
    for (const [dx, dz] of [[-0.75, -0.6], [0.75, -0.6], [-0.75, 0.6], [0.75, 0.6]]) g.add(box(0.15, 2.2, 0.15, IRON, sx + dx, 0.15, sz + dz));
    for (const dz of [-0.6, 0.6]) { const br = box(1.6, 0.07, 0.07, IRON, sx, 1.2, sz + dz); br.rotation.z = 0.9; g.add(br); }
    g.add(box(1.9, 0.12, 1.6, DARK, sx, 2.35, sz));
    railing(g, sx - 0.95, sz + 0.8, sx + 0.95, sz + 0.8, 2.47);
    railing(g, sx + 0.95, sz - 0.8, sx + 0.95, sz + 0.8, 2.47);
    const screen = box(1.5, 0.55, 1.15, ORANGE, sx, 2.5, sz); screen.rotation.z = 0.16; g.add(screen);
    for (let k = 0; k < 3; k++) g.add(box(1.4, 0.04, 1.0, 0x3a3f48, sx, 2.62 + k * 0.12, sz));
    const hop = mesh(new THREE.ConeGeometry(0.75, 0.75, 4), ORANGE); hop.rotation.set(Math.PI, Math.PI / 4, 0); hop.position.set(sx + 0.3, 3.55, sz); g.add(hop);
    g.add(box(1.05, 0.25, 1.05, ORANGE, sx + 0.3, 3.9, sz));
    ladder(g, 'x', sz - 0.2, sx + 0.83, 0.15, 2.2);
    // conveyors from the screen out to the piles
    const c1 = conveyor(g, [sx - 0.9, 2.45, sz + 0.4], [-2.0, 1.85, 1.85], 0.45);
    const grains = [];
    for (let i = 0; i < 7; i++) { const s = mesh(new THREE.DodecahedronGeometry(0.1, 0), shade(color, -0.1), { flatShading: true }); g.add(s); grains.push([s, c1, i / 7]); }
    // excavator digging at the small pile
    const ex = new THREE.Group();
    for (const dz of [-0.42, 0.42]) ex.add(box(1.5, 0.32, 0.3, DARK, 0, 0, dz));
    const body = new THREE.Group();
    body.add(box(1.25, 0.55, 1.0, HAZ, -0.1, 0.35, 0), box(0.55, 0.6, 0.55, HAZ, 0.25, 0.9, 0.2));
    body.add(box(0.48, 0.42, 0.04, GLASS, 0.25, 1.0, 0.48));
    body.add(box(0.4, 0.3, 0.9, 0x3a3f48, -0.6, 0.45, 0));
    const boom = new THREE.Group();
    boom.add(box(0.2, 0.22, 1.6, HAZ, 0, 0, 0.8));
    const stick = new THREE.Group();
    stick.add(box(0.16, 0.18, 1.1, HAZ, 0, 0, 0.55));
    const bucket = box(0.5, 0.35, 0.3, DARK, 0, -0.2, 1.1); stick.add(bucket);
    stick.position.set(0, 0, 1.6); stick.rotation.x = 1.0;
    boom.add(stick);
    boom.position.set(-0.1, 0.8, 0.3);
    body.add(boom);
    ex.add(body);
    ex.position.set(-1.55, 0.15, -1.45); ex.rotation.y = -2.4;
    g.add(ex);
    // site office: a white trailer on blocks, with a step and an AC unit
    const ox = 2.6, oz = 2.2;
    for (const dz of [-0.75, 0.75]) g.add(box(0.8, 0.2, 0.25, PLINTH, ox, 0.15, oz + dz));
    g.add(box(1.0, 1.0, 2.0, 0xf2efe8, ox, 0.35, oz));
    g.add(box(1.04, 0.08, 2.04, TERRA, ox, 1.35, oz));
    winRow(g, 'x', oz + 0.2, 0.8, ox + 0.5, 2, 0.8, 0.45, 0.35);
    g.add(onWall('z', ox - 0.15, 0.35, oz + 1.0, 0.45, 0.85, 0.04, 0x6b4a2b));
    g.add(box(0.6, 0.18, 0.4, PLINTH, ox - 0.15, 0.15, oz + 1.22));
    g.add(box(0.4, 0.3, 0.3, 0xc9ced6, ox - 0.3, 1.43, oz - 0.6));
    return {
      group: g, top: 5.0,
      anim(t) {
        body.rotation.y = Math.sin(t * 0.55) * 0.7;
        boom.rotation.x = -0.25 + Math.sin(t * 1.1) * 0.25;
        stick.rotation.x = 1.0 + Math.sin(t * 1.1 + 1) * 0.35;
        for (const [s, c, o] of grains) { const k = (t * 0.3 + o) % 1; s.position.copy(c.A).lerp(c.B, k); s.position.y += 0.18; s.rotation.y = k * 7; }
      },
    };
  },

  // ---- Glass Kiln: a stucco works with a domed melting furnace, its glowing ports and
  // a banded chimney, batch silos, and sheets of fresh glass sliding out to a rack
  kiln(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: 0.35, z: 0.75, w: 4.3, d: 2.4, h: 2.0, color: STUCCO, piers: 1.05, pierColor: 0xdcc9a6 });
    g.add(box(4.5, 0.16, 2.6, color, 0.35, top - 0.5, 0.75));                 // terracotta band
    winRow(g, 'z', 0.95, 1.05, 1.95, 3, 0.95, 0.6, 0.7, DARK, WARM);
    sideDoor(g, 'z', -1.25, 1.95, 0x2fa39a);
    signBoard(g, 'z', 0.95, 1.95, 1.95, 2.6, color, 5);
    winRow(g, 'x', 0.75, 1.05, 2.5, 2, 1.1, 0.6, 0.7, DARK, WARM);
    // the melting furnace: a brick drum under a dome, banded, with glowing ports
    const fx = -1.7, fz = -1.7;
    g.add(cyl(1.22, 1.27, 1.2, color, fx, 0.15, fz, 24));
    g.add(cyl(1.29, 1.29, 0.12, shade(color, -0.35), fx, 1.3, fz, 24));
    const dome = mesh(new THREE.SphereGeometry(1.22, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), shade(color, 0.05)); dome.position.set(fx, 1.35, fz); dome.scale.y = 0.75; g.add(dome);
    for (const [k, r] of [[0.32, 1.1], [0.62, 0.82]]) { const band = mesh(new THREE.TorusGeometry(r, 0.045, 6, 28), shade(color, -0.3)); band.rotation.x = Math.PI / 2; band.position.set(fx, 1.35 + k, fz); g.add(band); }
    const ports = [];
    for (const a of [0.2, 0.75, 1.3]) {
      const port = box(0.32, 0.36, 0.1, 0xffa13a, fx + Math.cos(a) * 1.25, 0.45, fz + Math.sin(a) * 1.25, { emissive: 0xff7a12, emissiveIntensity: 1.3 });
      port.rotation.y = -a + Math.PI / 2; port.material = port.material.clone(); g.add(port); ports.push(port);
    }
    const smoke = [chimney(g, 0.75, -1.85, 0.15, 5.2, 0.36, shade(color, -0.2))];
    pipe(g, [[fx + 0.4, 2.25, fz], [fx + 0.4, 2.7, fz], [0.75, 2.7, fz], [0.75, 2.7, -1.85]], 0.15, 0xb9b4a8);
    // batch silos feeding the furnace
    for (const [x, z] of [[2.5, -2.3], [1.65, -2.45]]) { tank(g, x, z, 0.38, 2.2, 0xe9ecf1); }
    // fresh glass sheets sliding out on rollers to a rack
    g.add(box(2.0, 0.45, 0.6, IRON, 2.55, 0.15, 2.45));
    for (let k = 0; k < 7; k++) g.add(cyl(0.05, 0.05, 0.58, 0xc9ced6, 1.65 + k * 0.3, 0.62, 2.45, 8).rotateX(Math.PI / 2));
    const sheets = [];
    for (let i = 0; i < 2; i++) { const sh = box(0.7, 0.03, 0.5, 0x9fe8ff, 0, 0.68, 2.45, { transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.3 }); g.add(sh); sheets.push(sh); }
    for (let k = 0; k < 4; k++) { const r = box(0.03, 0.8, 0.6, 0x9fe8ff, 3.25 - k * 0.07, 0.15, 3.15, { transparent: true, opacity: 0.6, roughness: 0.05 }); r.rotation.z = 0.12; g.add(r); }
    g.add(box(0.5, 0.1, 0.8, IRON, 3.15, 0.15, 3.15), box(0.06, 0.9, 0.06, IRON, 3.0, 0.15, 3.5));
    return {
      group: g, top: 7.0, smoke,
      anim(t) {
        sheets.forEach((s, i) => { s.position.x = 1.6 + (((t * 0.35) + i * 0.5) % 1) * 1.8; });
        ports.forEach((p, i) => { p.material.emissiveIntensity = 1.1 + Math.sin(t * 2.3 + i * 2) * 0.35; });
      },
    };
  },

  // ---- Solar Panel Fab: a white clean-room hall with a blue band and a roof full of
  // panels, a glass entrance, air handlers, and a robot arm stacking finished panels
  solarfab(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: -0.2, z: -0.3, w: 5.4, d: 3.8, h: 2.1, color: 0xf1f2f4, piers: 0.9, pierColor: 0xe1e4e8 });
    g.add(box(5.6, 0.32, 4.0, color, -0.2, top - 1.0, -0.3));                 // the company blue band
    const roofY = top - 0.43;
    for (let r = 0; r < 3; r++) panelRow(g, -1.1, -1.5 + r * 1.05, roofY, 0.95, 0.75, 3, 1.05);
    for (const x of [1.75]) { g.add(box(0.9, 0.6, 1.4, 0xc9ced6, x, roofY, 0.5)); for (let k = 0; k < 3; k++) g.add(cyl(0.18, 0.18, 0.04, DARK, x, roofY + 0.6, 0.05 + k * 0.45, 12)); }
    // glass entrance pavilion at the front right with a deep sun shade
    g.add(box(1.3, 1.55, 0.8, GLASS, 1.95, 0.3, 1.95));
    for (let i = 0; i < 4; i++) g.add(box(0.05, 1.55, 0.05, 0xf1f2f4, 1.35 + i * 0.4, 0.3, 2.36));
    g.add(box(1.6, 0.1, 1.3, 0xf1f2f4, 1.95, 1.85, 2.05));
    door(g, 'z', -1.9, 1.6, 1.5, 1.6, 0xd8dbe2);
    signBoard(g, 'z', -0.4, 1.95, 1.6, 2.2, color, 5);
    winRow(g, 'x', -0.4, 1.0, 2.5, 3, 1.0, 0.65, 0.55);
    louvres(g, 'x', -0.4, 1.0, 2.5, 3.0, 3);
    // the robot arm and a stack of finished panels on a pallet
    const ax = -2.6, az = 2.5;
    g.add(box(0.6, 0.25, 0.6, DARK, ax, 0.15, az));
    const turret = new THREE.Group();
    turret.add(cyl(0.22, 0.26, 0.4, ORANGE, 0, 0, 0, 14));
    const upper = new THREE.Group(); upper.add(box(0.18, 1.0, 0.18, ORANGE, 0, 0, 0)); upper.position.y = 0.35; upper.rotation.z = -0.45;
    const fore = new THREE.Group(); fore.add(box(0.14, 0.8, 0.14, ORANGE, 0, 0, 0)); fore.position.y = 1.0; fore.rotation.z = 1.3;
    const grip = solarPanel(0.6, 0.45); grip.position.y = 0.82; fore.add(grip, box(0.2, 0.1, 0.2, DARK, 0, 0.75, 0));
    upper.add(fore); turret.add(upper);
    turret.position.set(ax, 0.4, az); g.add(turret);
    g.add(box(0.8, 0.12, 0.6, 0x8a6a4f, -1.7, 0.15, 2.95));
    for (let k = 0; k < 5; k++) { const p = solarPanel(0.7, 0.5); p.position.set(-1.7, 0.3 + k * 0.08, 2.95); g.add(p); }
    return { group: g, top: top + 1.6, anim(t) { turret.rotation.y = Math.sin(t * 0.7) * 1.2 - 0.6; upper.rotation.z = -0.45 + Math.sin(t * 1.4) * 0.15; } };
  },

  // ---- Battery Plant: a white works with a green stripe, three giant battery cells
  // with charge lights that fill up and empty, and a transformer
  battery(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: -0.7, z: -0.25, w: 4.2, d: 4.0, h: 2.3, color: 0xf1f2f4, piers: 1.0, pierColor: 0xe1e4e8 });
    g.add(box(4.4, 0.35, 4.2, color, -0.7, 1.15, -0.25));
    door(g, 'z', -1.9, 1.75, 1.5, 1.7, 0xd8dbe2);
    winRow(g, 'z', 0.35, 1.75, 1.75, 1, 1, 0.8, 0.45);
    signBoard(g, 'z', 0.2, 2.15, 1.75, 1.9, color, 4);
    winRow(g, 'x', -1.4, 1.75, 1.4, 2, 1.0, 0.6, 0.45);
    // a big lightning bolt on the side
    const bolt = new THREE.Group();
    for (const [x, y, r, h] of [[0.12, 0.55, 0.45, 0.62], [-0.02, 0.05, 0.45, 0.62]]) { const b = box(0.12, h, 0.06, 0xffd23f, x, y, 0, { emissive: 0xffc23d, emissiveIntensity: 0.7 }); b.rotation.z = r; bolt.add(b); }
    bolt.rotation.y = Math.PI / 2; bolt.position.set(1.47, 0.5, 0.65); g.add(bolt);
    // giant battery cells: a body, a coloured wrap, a + terminal, and a charge column
    const bars = [];
    for (const [x, z, h] of [[2.35, -2.0, 2.8], [2.45, 2.2, 2.4], [-2.45, 2.45, 2.1]]) {
      g.add(cyl(0.62, 0.66, 0.25, PLINTH, x, 0.15, z, 20));
      g.add(cyl(0.55, 0.55, h, 0x2a2d33, x, 0.4, z, 22));
      g.add(cyl(0.57, 0.57, h * 0.45, color, x, 0.4 + h * 0.3, z, 22));
      g.add(cyl(0.2, 0.2, 0.2, 0xd9d9d9, x, 0.4 + h, z, 12));
      g.add(box(0.06, 0.2, 0.06, WHITE, x, 0.4 + h + 0.2, z), box(0.2, 0.06, 0.06, WHITE, x, 0.47 + h + 0.2, z));
      const col = [];
      for (let k = 0; k < 5; k++) { const b = box(0.2, 0.14, 0.05, 0x4fdc6a, x + 0.39, 0.6 + k * 0.22, z + 0.39, { emissive: 0x2fd14a, emissiveIntensity: 1 }); b.rotation.y = Math.PI / 4; b.material = b.material.clone(); g.add(b); col.push(b); }
      bars.push(col);
    }
    // a transformer with insulators, fenced
    g.add(box(0.9, 0.15, 0.8, PLINTH, -2.6, 0.15, -2.45), box(0.7, 0.75, 0.55, 0x6f8fa8, -2.6, 0.3, -2.45));
    for (const dx of [-0.2, 0, 0.2]) g.add(cyl(0.04, 0.04, 0.35, 0xe8e2d4, -2.6 + dx, 1.05, -2.45, 6));
    pipe(g, [[-2.6, 1.3, -2.45], [-2.6, 1.6, -2.45], [-2.6, 1.6, -2.2]], 0.05, DARK);
    return {
      group: g, top: top + 1.6,
      anim(t) { bars.forEach((col, i) => { const lvl = ((t * 0.25 + i * 0.33) % 1) * 6; col.forEach((b, k) => { b.material.emissiveIntensity = k < lvl ? 1.4 : 0.05; }); }); },
    };
  },

  // ---- Drone Works: a hall with landing pads on the roof, a netted test cage with a
  // drone hovering inside, drones circling above, and a windsock
  drone(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: -0.55, z: -0.45, w: 4.5, d: 3.6, h: 2.2, color: STUCCO, piers: 1.1, pierColor: 0xdcc9a6 });
    g.add(box(4.7, 0.25, 3.8, color, -0.55, top - 0.95, -0.45));
    door(g, 'z', -1.8, 1.35, 1.6, 1.7, 0xd8dbe2);
    winRow(g, 'z', 0.55, 1.05, 1.35, 2, 0.9, 0.6, 0.65);
    signBoard(g, 'x', -0.6, 1.95, 1.7, 2.4, color, 5);
    winRow(g, 'x', -0.6, 1.0, 1.7, 3, 0.9, 0.55, 0.6);
    // two landing pads on the roof with an H and corner lights
    const roofY = top - 0.43;
    for (const [x, z] of [[-1.5, -1.2], [0.4, -1.2]]) {
      g.add(cyl(0.72, 0.72, 0.08, 0x3a3f48, x, roofY, z, 24));
      g.add(box(0.1, 0.02, 0.6, WHITE, x - 0.2, roofY + 0.08, z), box(0.1, 0.02, 0.6, WHITE, x + 0.2, roofY + 0.08, z), box(0.4, 0.02, 0.1, WHITE, x, roofY + 0.08, z));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.add(box(0.07, 0.06, 0.07, 0x9cff8a, x + Math.cos(a) * 0.66, roofY + 0.06, z + Math.sin(a) * 0.66, { emissive: 0x6dff5a, night: 2.2 })); }
    }
    // the test cage: a frame with see-through netting and a drone inside
    const cx = 2.3, cz = 2.3, cs = 1.5;
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.07, 1.6, 0.07, IRON, cx + dx * cs / 2, 0.15, cz + dz * cs / 2));
    g.add(box(cs, 0.06, cs, IRON, cx, 1.72, cz));
    g.add(box(cs - 0.02, 1.55, cs - 0.02, 0xd8dbe2, cx, 0.17, cz, { transparent: true, opacity: 0.18, depthWrite: false }));
    for (let k = 1; k < 4; k++) { g.add(box(cs, 0.02, 0.02, IRON, cx, 0.15 + k * 0.4, cz + cs / 2)); g.add(box(0.02, 0.02, cs, IRON, cx + cs / 2, 0.15 + k * 0.4, cz)); }
    const caged = drone(color); g.add(caged);
    // a windsock on a mast
    g.add(box(0.06, 2.4, 0.06, 0xd8dbe2, 2.7, 0.15, -2.5));
    const sock = new THREE.Group();
    const cone = mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.7, 10, 1, true), ORANGE, { side: THREE.DoubleSide }); cone.rotation.z = Math.PI / 2; cone.position.x = 0.35; sock.add(cone);
    sock.position.set(2.7, 2.45, -2.5); g.add(sock);
    // drones circling the building
    const flyers = [];
    for (let i = 0; i < 3; i++) { const d = drone(i === 1 ? 0xf1f2f4 : color); flyers.push(d); g.add(d); }
    return {
      group: g, top: top + 2.6,
      anim(t) {
        caged.position.set(cx + Math.sin(t * 1.3) * 0.35, 0.9 + Math.sin(t * 2.1) * 0.25, cz + Math.cos(t * 1.1) * 0.35); caged.rotation.y = t;
        flyers.forEach((d, i) => { const a = t * 0.55 + i * 2.1; d.position.set(-0.6 + Math.cos(a) * 2.2, top + 0.6 + i * 0.35 + Math.sin(t * 2 + i) * 0.15, -0.5 + Math.sin(a) * 1.8); d.rotation.y = -a; });
        sock.rotation.y = Math.sin(t * 0.4) * 0.6 - 0.4; sock.rotation.z = Math.sin(t * 1.7) * 0.08;
      },
    };
  },

  // ---- Rover Factory: an assembly hall with a pitched skylight roof and a big door, a
  // finished rover turning on a display turntable, a rock garden test bed and a dish
  rover(color) {
    const g = new THREE.Group();
    const hx = -0.55, hz = -0.6, hw = 4.4, hd = 3.4;
    const wallTop = hall(g, { x: hx, z: hz, w: hw, d: hd, h: 2.3, color: ADOBE, parapet: false, piers: 1.1, pierColor: 0xc9a27b });
    // a sawtooth-free pitched roof with a long skylight strip on the ridge
    const roof = new THREE.Shape(); roof.moveTo(-hd / 2 - 0.2, 0); roof.lineTo(hd / 2 + 0.2, 0); roof.lineTo(0, 0.9); roof.closePath();
    const rg = new THREE.ExtrudeGeometry(roof, { depth: hw + 0.4, bevelEnabled: false }); rg.translate(0, 0, -(hw + 0.4) / 2);
    const rm = mesh(rg, color); rm.rotation.y = Math.PI / 2; rm.position.set(hx, wallTop, hz); g.add(rm);
    g.add(box(hw - 0.4, 0.2, 0.5, GLASS, hx, wallTop + 0.78, hz));
    door(g, 'z', hx - 0.6, hz + hd / 2, 2.0, 1.9, 0xd8dbe2);
    win(g, 'z', hx + 1.3, 1.1, hz + hd / 2, 0.8, 0.7);
    signBoard(g, 'x', hz, 1.9, hx + hw / 2, 2.4, color, 5);
    winRow(g, 'x', hz, 0.95, hx + hw / 2, 2, 1.4, 0.7, 0.55);
    // a dish on the roof's back corner
    g.add(box(0.1, 0.9, 0.1, IRON, hx - 1.5, wallTop - 0.1, hz - 1.0));
    const dish = mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), 0xf2f2f0, { side: THREE.DoubleSide });
    dish.rotation.x = -2.3; dish.position.set(hx - 1.5, wallTop + 0.95, hz - 1.0); g.add(dish);
    // display turntable with a rover slowly turning on it
    const tx = 2.35, tz = 2.25;
    g.add(cyl(0.95, 1.0, 0.18, PLINTH, tx, 0.15, tz, 24), cyl(0.85, 0.85, 0.06, DARK, tx, 0.33, tz, 24));
    const rv = new THREE.Group();
    rv.add(box(1.1, 0.25, 0.7, 0xf1f2f4, 0, 0.42, 0), box(0.45, 0.28, 0.45, color, 0.15, 0.67, 0), box(0.5, 0.05, 0.36, CELL, -0.3, 0.7, 0));
    rv.add(box(0.05, 0.5, 0.05, IRON, 0.35, 0.67, 0.18), box(0.18, 0.12, 0.12, DARK, 0.35, 1.17, 0.18));
    for (const x of [-0.4, 0, 0.4]) for (const z of [-0.4, 0.4]) { const w = mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 12), DARK); w.rotation.x = Math.PI / 2; w.position.set(x, 0.3, z); rv.add(w); }
    rv.position.set(tx, 0.24, tz); g.add(rv);
    // rock garden test bed with a ramp
    g.add(box(1.6, 0.1, 1.4, 0xc06c45, -2.5, 0.15, 2.45));
    for (const [x, z, r] of [[-2.9, 2.2, 0.25], [-2.2, 2.7, 0.18], [-2.6, 2.9, 0.22], [-2.1, 2.1, 0.15]]) g.add(at(mesh(new THREE.DodecahedronGeometry(r, 0), 0xa85a3a, { flatShading: true }), x, 0.3, z));
    const ramp = box(0.9, 0.08, 0.7, IRON, -2.5, 0.3, 2.45); ramp.rotation.z = 0.25; g.add(ramp);
    return { group: g, top: wallTop + 2.2, anim(t) { rv.rotation.y = t * 0.35; } };
  },

  // ---- Launch Pad: a concrete pad with a flame trench, a grey service tower with swing
  // arms, a water tower, lightning masts and a domed blockhouse
  launchpad(color) {
    const g = new THREE.Group();
    g.add(box(4.2, 0.4, 4.2, color, 0.3, 0.15, 0.1));
    g.add(box(4.36, 0.06, 4.36, TRIM, 0.3, 0.55, 0.1));
    g.add(box(1.0, 0.04, 2.6, 0x1c1e22, 0.6, 0.57, 0.9));                          // flame trench
    g.add(box(1.6, 0.06, 1.6, 0x2a2d33, 0.6, 0.57, 0.2));
    for (const dx of [-0.75, 0.75]) g.add(box(0.12, 0.25, 1.6, HAZ, 0.6 + dx, 0.55, 0.2));
    // service tower
    const tx = -1.15, tz = -1.25;
    lattice(g, tx - 0.4, tz + 0.4, tx + 0.4, tz + 0.4, 0.55, 7.4, 0x8a8f99, 0.9);
    lattice(g, tx + 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 0.55, 7.4, 0x8a8f99, 0.9);
    lattice(g, tx - 0.4, tz - 0.4, tx - 0.4, tz + 0.4, 0.55, 7.4, 0x8a8f99, 0.9);
    g.add(box(1.1, 0.14, 1.1, DARK, tx, 7.95, tz));
    for (const y of [2.6, 4.4, 6.0]) { const arm = box(1.35, 0.14, 0.3, 0x8a8f99, tx + 0.95, y, tz + 0.55); arm.rotation.y = -0.6; g.add(arm); g.add(box(0.2, 0.2, 0.2, ORANGE, tx + 0.45, y, tz + 0.4)); }
    g.add(box(0.12, 0.12, 0.12, 0xff3b2f, tx, 8.1, tz, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    // the rocket in the middle of the pad
    const rocket = buildRocket('retro', ORANGE);
    rocket.position.set(0.6, 0.55, 0.2); g.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 5; i++) scaffold.add(box(1.6, 0.1, 1.6, 0xb9b4a8, 0.6, 1.0 + i * 1.25, 0.2));
    for (const [dx, dz] of [[-0.75, -0.75], [0.75, 0.75], [-0.75, 0.75], [0.75, -0.75]]) scaffold.add(box(0.1, 6.0, 0.1, 0xb9b4a8, 0.6 + dx, 0.55, 0.2 + dz));
    g.add(scaffold);
    // water tower on legs (back right) and a domed blockhouse (front right)
    const wx = 2.65, wz = -2.35;
    for (const [dx, dz] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) g.add(box(0.1, 2.6, 0.1, IRON, wx + dx, 0.15, wz + dz));
    const ball = mesh(new THREE.SphereGeometry(0.65, 20, 14), 0xf2efe8); ball.position.set(wx, 3.3, wz); g.add(ball);
    g.add(cyl(0.68, 0.68, 0.12, ORANGE, wx, 3.25, wz, 20));
    const bunker = mesh(new THREE.SphereGeometry(0.95, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xcfc8b8); bunker.scale.y = 0.6; bunker.position.set(2.5, 0.15, 2.4); g.add(bunker);
    g.add(box(0.5, 0.12, 0.06, GLASS, 2.5, 0.45, 3.32));
    // lightning masts
    for (const [x, z] of [[-2.7, 1.5], [2.0, -2.9]]) { g.add(box(0.12, 6.4, 0.12, 0xd8dbe2, x, 0.15, z)); g.add(box(0.05, 0.6, 0.05, IRON, x, 6.55, z)); }
    return { group: g, top: 9.0, rocket, scaffold };
  },

  // ---- Solar Farm: rows of tracking panels that follow the sun across the sky, an
  // inverter station, and a weather mast
  solarfarm(color) {
    const g = new THREE.Group();
    g.add(box(4.6, 0.04, 4.0, 0xd8c39a, -0.3, 0.15, -0.2));                          // gravel bed
    const trackers = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
      const x = -1.0 + c * 1.75, z = -1.75 + r * 1.35;
      g.add(box(0.12, 0.65, 0.12, IRON, x, 0.15, z));
      g.add(box(0.06, 0.06, 0.06, DARK, x, 0.8, z));
      const t = new THREE.Group();
      const p = solarPanel(1.5, 1.0); t.add(p);
      t.position.set(x, 0.86, z); g.add(t); trackers.push(t);
    }
    // inverter station: a small white hut with vents and a transformer
    const ix = 2.4, iz = -2.35;
    g.add(box(1.2, 1.05, 0.95, 0xf1f2f4, ix, 0.15, iz), box(1.3, 0.08, 1.05, color, ix, 1.2, iz));
    for (let k = 0; k < 4; k++) g.add(box(0.03, 0.5, 0.6, 0x9aa0a8, ix + 0.61, 0.35, iz - 0.3 + k * 0.2));
    g.add(box(0.6, 0.65, 0.5, 0x6f8fa8, ix - 0.2, 0.15, iz + 0.85));
    for (const dx of [-0.15, 0, 0.15]) g.add(cyl(0.035, 0.035, 0.3, 0xe8e2d4, ix - 0.2 + dx, 0.8, iz + 0.85, 6));
    // weather mast with a spinning anemometer
    g.add(box(0.06, 3.2, 0.06, 0xd8dbe2, 2.55, 0.15, 2.45));
    const cups = new THREE.Group();
    for (let k = 0; k < 3; k++) { const a = (k / 3) * Math.PI * 2; cups.add(at(mesh(new THREE.SphereGeometry(0.06, 8, 6), WHITE), Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18)); cups.add(at(box(0.18, 0.02, 0.02, IRON, 0, 0, 0), Math.cos(a) * 0.09, 0, Math.sin(a) * 0.09)); cups.children[cups.children.length - 1].rotation.y = -a; }
    cups.position.set(2.55, 3.4, 2.45); g.add(cups);
    g.add(box(0.3, 0.2, 0.2, 0xf1f2f4, 2.55, 2.6, 2.45));
    return {
      group: g, top: 3.6,
      anim(t, dt) { const tilt = Math.sin(t * 0.08) * 0.55; trackers.forEach(k => { k.rotation.z = tilt; }); cups.rotation.y += dt * 5; },
    };
  },

  // ---- Desert HQ: a stepped adobe building with wooden beam ends, deep turquoise
  // windows, a shaded courtyard, solar panels up top and a turning dish
  hqdesert(color) {
    const g = new THREE.Group();
    // three stepped tiers
    const tiers = [[0.1, -0.35, 4.8, 3.6, 1.6], [-0.45, -0.75, 3.3, 2.5, 1.35], [-0.9, -1.05, 1.9, 1.5, 1.2]];
    let y = 0;
    tiers.forEach(([x, z, w, d, h], i) => {
      if (i === 0) g.add(box(w + 0.2, 0.3, d + 0.2, shade(color, -0.25), x, 0, z));
      const y0 = i === 0 ? 0.3 : y;
      g.add(box(w, h, d, color, x, y0, z));
      g.add(box(w + 0.08, 0.14, d + 0.08, shade(color, 0.12), x, y0 + h - 0.02, z));     // rounded cap
      vigas(g, 'z', x, w, y0 + h - 0.42, z + d / 2, Math.round(w / 0.55));
      vigas(g, 'x', z, d, y0 + h - 0.42, x + w / 2, Math.round(d / 0.55));
      y = y0 + h;
    });
    // deep-set windows with turquoise frames, and a carved wooden door
    for (const a of [-1.5, 0.6, 1.6]) { g.add(onWall('z', a, 0.75, 1.45, 0.62, 0.62, 0.05, TEAL)); g.add(onWall('z', a, 0.8, 1.48, 0.48, 0.5, 0.04, 0x1c2f3a)); }
    for (const a of [-1.2, 0.2]) { g.add(onWall('x', a, 0.75, 2.5, 0.62, 0.62, 0.05, TEAL)); g.add(onWall('x', a, 0.8, 2.53, 0.48, 0.5, 0.04, 0x1c2f3a)); }
    for (const a of [-0.9, 0.3]) { g.add(onWall('z', a, 2.2, 0.5, 0.55, 0.5, 0.05, TEAL)); g.add(onWall('z', a, 2.24, 0.53, 0.42, 0.4, 0.04, 0x1c2f3a)); }
    g.add(onWall('z', -0.45, 0.3, 1.45, 0.9, 1.15, 0.06, 0x6b4a2b));
    for (let k = 0; k < 3; k++) g.add(onWall('z', -0.45, 0.45 + k * 0.35, 1.5, 0.7, 0.05, 0.03, 0x4a3320));
    signBoard(g, 'z', 0.95, 1.45, 1.45, 1.4, TERRA, 4);
    // the courtyard shade at the front right, and a wooden ladder up to the second tier
    shadeCanopy(g, 2.1, 2.35, 1.6, 1.4, 1.7, 0xc9a27b);
    g.add(box(1.3, 0.1, 1.1, PLINTH, 2.1, 0.15, 2.35));
    cactusPot(g, 1.6, 2.45, 0.8); cactusPot(g, 2.6, 2.7, 0.6);
    // a wooden ladder from the first roof up to the second
    for (const e of [-0.18, 0.18]) rod(g, [0.75 + e, 1.9, 1.0], [0.75 + e, 3.55, 0.45], 0.035, 0x7a5230);
    for (let k = 1; k < 5; k++) { const f = k / 5; g.add(box(0.4, 0.04, 0.04, 0x7a5230, 0.75, 1.9 + 1.65 * f, 1.0 - 0.55 * f)); }
    // solar panels on the second tier and the turning dish on top
    panelRow(g, 0.6, -1.5, 0.3 + tiers[0][4] + tiers[1][4], 0.7, 0.6, 1, 1);
    const mast = new THREE.Group();
    mast.add(box(0.1, 1.6, 0.1, 0xdddddd, 0, 0, 0));
    const dish = mesh(new THREE.SphereGeometry(0.55, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), 0xf2f2f2, { side: THREE.DoubleSide });
    dish.rotation.x = Math.PI / 2.3; dish.position.y = 1.6; mast.add(dish);
    mast.position.set(-0.9, y, -1.05); g.add(mast);
    return { group: g, top: y + 2.6, anim(t) { mast.rotation.y = t * 0.6; } };
  },
});
