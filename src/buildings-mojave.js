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
// An adobe hall, the desert's own: thick walls that lean in a little as they rise, a
// stepped parapet with a raised middle, wooden beam ends (vigas), canales spouting from
// the roof, and a sandstone footing. Returns the height of the roof.
function adobeHall(g, { x = 0, z = 0, w, d, h, color = ADOBE, step = true }) {
  g.add(box(w + 0.24, 0.3, d + 0.24, 0xc9a77c, x, 0, z));                       // sandstone footing
  const geo = new THREE.BoxGeometry(w, h, d, 2, 2, 2); geo.translate(0, h / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = p.getY(i) / h * 0.035; p.setX(i, p.getX(i) * (1 - k)); p.setZ(i, p.getZ(i) * (1 - k)); }
  geo.computeVertexNormals();
  const walls = mesh(geo, color); walls.position.set(x, 0.3, z); g.add(walls);
  const top = 0.3 + h, wt = w * 0.965, dt = d * 0.965;
  // a soft, rounded cap all round, and a stepped parapet on the front
  for (const [pw, pd, px, pz] of [[wt + 0.06, 0.24, x, z + dt / 2 - 0.1], [wt + 0.06, 0.24, x, z - dt / 2 + 0.1], [0.24, dt, x + wt / 2 - 0.1, z], [0.24, dt, x - wt / 2 + 0.1, z]]) {
    g.add(box(pw, 0.3, pd, color, px, top, pz));
    g.add(box(pw + 0.04, 0.06, pd + 0.04, shade(color, 0.1), px, top + 0.3, pz));
  }
  g.add(box(wt - 0.3, 0.05, dt - 0.3, 0xb89a72, x, top, z));
  if (step) { g.add(box(wt * 0.4, 0.3, 0.26, color, x, top + 0.3, z + dt / 2 - 0.1), box(wt * 0.18, 0.25, 0.26, color, x, top + 0.6, z + dt / 2 - 0.1)); }
  vigas(g, 'z', x, wt, top - 0.3, z + d / 2 - 0.02, Math.max(3, Math.round(w / 0.6)));
  vigas(g, 'x', z, dt, top - 0.3, x + w / 2 - 0.02, Math.max(3, Math.round(d / 0.6)));
  for (const a of [-wt / 3, wt / 3]) g.add(onWall('z', x + a, top - 0.05, z + d / 2, 0.14, 0.12, 0.5, 0x8a6a45));   // canales
  // patches where the plaster has worn back to the mud brick
  for (const [a, y, ww] of [[-w * 0.3, 0.7, 0.5], [w * 0.25, 1.3, 0.35]]) g.add(onWall('z', x + a, y, z + d / 2 - 0.02, ww, 0.28, 0.03, shade(color, -0.18)));
  return top + 0.36;
}
// deep-set desert windows: a turquoise frame round a dark pane
function deepWin(g, axis, a, y, f, w = 0.55, h = 0.55, frame = TEAL, glass = 0x1c2f3a) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, y - 0.06, f, w + 0.14, h + 0.12, 0.05, frame));
  g.add(onWall(axis, a, y, f + s * 0.02, w - 0.04, h - 0.04, 0.05, glass, glass === WARM ? { emissive: 0xff8a1f, emissiveIntensity: 0.6 } : undefined));
  g.add(onWall(axis, a, y - 0.12, f, w + 0.26, 0.06, 0.14, 0x8a6a45));
}
// a corrugated quonset hut: a half-round roof of ribbed sheet steel along x, with end walls
function quonset(g, x, z, len, r, color) {
  const shell = mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, true, Math.PI / 2, Math.PI), color, { side: THREE.DoubleSide, metalness: 0.35, roughness: 0.55 });
  shell.rotation.z = Math.PI / 2; shell.rotation.y = 0; shell.position.set(x, 0.3, z); g.add(shell);
  for (let k = 0; k <= 12; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.02, 0.03, 4, 20, Math.PI), shade(color, -0.2)); rib.rotation.y = Math.PI / 2; rib.position.set(x - len / 2 + (len * k) / 12, 0.3, z); g.add(rib); }
  for (const e of [-1, 1]) { const end = mesh(new THREE.CircleGeometry(r, 24, 0, Math.PI), shade(color, 0.12), { side: THREE.DoubleSide }); end.rotation.y = Math.PI / 2; end.position.set(x + e * len / 2, 0.3, z); g.add(end); }
  g.add(box(len + 0.2, 0.3, r * 2 + 0.2, PLINTH, x, 0, z));
  return 0.3 + r;
}
// a bottle tree: a dead-branch post hung with glass bottles that glint in the sun
function bottleTree(g, x, z) {
  g.add(cyl(0.06, 0.09, 1.6, 0x5a4632, x, 0.15, z, 6));
  const glassC = [0x2f6fd1, 0x3fae8a, 0x2f8fe0, 0x7a4fd1, 0x2fa39a];
  for (let k = 0; k < 7; k++) {
    const a = k * 2.4, y = 0.55 + (k % 4) * 0.28, L = 0.32 + (k % 3) * 0.06;
    const br = box(0.035, L, 0.035, 0x5a4632, x + Math.cos(a) * L * 0.4, 0.15 + y, z + Math.sin(a) * L * 0.4); br.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(br);
    const b = cyl(0.06, 0.06, 0.2, glassC[k % 5], x + Math.cos(a) * L * 0.8, 0.15 + y + L * 0.5, z + Math.sin(a) * L * 0.8, 8, { transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2, emissive: glassC[k % 5], emissiveIntensity: 0.15 });
    b.rotation.x = Math.PI; g.add(b);
  }
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

  // ---- Glass Kiln: an adobe glassworks with a stained-glass front, a big domed melting
  // furnace, two little beehive kilns glowing at the mouth, a banded brick chimney, and a
  // bottle tree and racks of fresh glass out in the yard
  kiln(color) {
    const g = new THREE.Group();
    const top = adobeHall(g, { x: 0.35, z: 0.75, w: 4.3, d: 2.4, h: 2.1, color: ADOBE });
    // stained-glass windows: coloured panes in a dark frame, lit from inside at night
    const panes = [0x2f8fe0, 0xffb03a, 0x3fae8a, 0xd9482b, 0x7a4fd1];
    for (const [i, a] of [-0.9, 0.35, 1.6].entries()) {
      g.add(onWall('z', a, 0.85, 1.95, 0.85, 1.05, 0.05, 0x3a2a1e));
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) g.add(onWall('z', a - 0.19 + c * 0.38, 0.92 + r * 0.32, 1.98, 0.33, 0.27, 0.03, panes[(i + r + c * 2) % 5], { emissive: panes[(i + r + c * 2) % 5], emissiveIntensity: 0.35, night: 1.4 }));
      const arch = mesh(new THREE.CircleGeometry(0.43, 14, 0, Math.PI), 0x3a2a1e); arch.position.set(a, 1.9, 2.0); g.add(arch);
    }
    sideDoor(g, 'z', -1.65, 1.95, TEAL);
    signBoard(g, 'x', 0.75, 1.55, 2.5, 1.9, color, 4);
    deepWin(g, 'x', 0.15, 0.85, 2.5, 0.55, 0.55, TEAL, WARM); deepWin(g, 'x', 1.35, 0.85, 2.5, 0.55, 0.55, TEAL, WARM);
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
    // two beehive kilns: rounded mud-brick domes with a glowing arched mouth
    for (const [bx, bz, r] of [[2.75, -1.0, 0.62], [2.55, 0.25, 0.5]]) {
      const hive = mesh(new THREE.SphereGeometry(r, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0xb5684a); hive.scale.y = 1.25; hive.position.set(bx, 0.15, bz); g.add(hive);
      for (let k = 1; k < 4; k++) { const ring = mesh(new THREE.TorusGeometry(r * Math.cos(k * 0.38), 0.02, 4, 18), 0x8a4a33); ring.rotation.x = Math.PI / 2; ring.position.set(bx, 0.15 + r * 1.25 * Math.sin(k * 0.38), bz); g.add(ring); }
      const mouth = box(0.26, 0.28, 0.08, 0xffa13a, bx + r * 0.98, 0.15, bz, { emissive: 0xff7a12, emissiveIntensity: 1.2 }); mouth.rotation.y = Math.PI / 2; mouth.material = mouth.material.clone(); g.add(mouth); ports.push(mouth);
      g.add(cyl(0.07, 0.07, 0.3, 0x6b3a28, bx, 0.15 + r * 1.2, bz, 8));
    }
    const smoke = [chimney(g, 0.75, -1.85, 0.15, 5.2, 0.36, shade(color, -0.2))];
    pipe(g, [[fx + 0.4, 2.25, fz], [fx + 0.4, 2.7, fz], [0.75, 2.7, fz], [0.75, 2.7, -1.85]], 0.15, 0xb9b4a8);
    // fresh glass sheets sliding out on rollers to a rack, and a bottle tree
    g.add(box(2.0, 0.45, 0.6, IRON, -2.15, 0.15, 2.65));
    for (let k = 0; k < 7; k++) g.add(cyl(0.05, 0.05, 0.58, 0xc9ced6, -3.05 + k * 0.3, 0.62 - 0.29, 2.65, 8).rotateX(Math.PI / 2));
    const sheets = [];
    for (let i = 0; i < 2; i++) { const sh = box(0.7, 0.03, 0.5, 0x9fe8ff, 0, 0.68, 2.65, { transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.3 }); g.add(sh); sheets.push(sh); }
    for (let k = 0; k < 4; k++) { const r = box(0.03, 0.8, 0.6, [0x9fe8ff, 0x8fd0ff, 0xa8f0d0, 0x9fe8ff][k], -3.2 + k * 0.07, 0.15, 1.6, { transparent: true, opacity: 0.6, roughness: 0.05 }); r.rotation.z = -0.12; g.add(r); }
    bottleTree(g, 2.9, 2.75);
    cactusPot(g, 2.2, 2.3, 0.7);
    return {
      group: g, top: 7.0, smoke,
      anim(t) {
        sheets.forEach((s, i) => { s.position.x = -2.85 + (((t * 0.35) + i * 0.5) % 1) * 1.4; });
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
    // a saw-tooth roof: each tooth's long slope is solar panels facing the sun, its short
    // face a strip of clerestory glass lighting the clean room below
    for (let i = 0; i < 4; i++) {
      const z0 = -1.95 + i * 0.92, rise = 0.55, run = 0.86, len = Math.hypot(rise, run), ang = Math.atan2(rise, run);
      const slope = new THREE.Group();
      const back = box(4.9, 0.06, len, 0xe1e4e8, 0, 0, 0); slope.add(back);
      for (let k = 0; k < 5; k++) { const pnl = solarPanel(0.92, len - 0.12); pnl.position.set(-1.96 + k * 0.98, 0.07, 0); slope.add(pnl); }
      slope.rotation.x = -ang; slope.position.set(-0.2, roofY + rise / 2, z0 + run / 2); g.add(slope);
      g.add(box(4.9, rise, 0.05, GLASS, -0.2, roofY, z0 + run + 0.02, { emissive: 0x9fd8ff, emissiveIntensity: 0.15, night: 1.2 }));
    }
    // the company's sun on the side wall: a gold disc with rays, slowly turning
    const sun = new THREE.Group();
    sun.add(cyl(0.55, 0.55, 0.08, 0xffc23d, 0, -0.04, 0, 24, { emissive: 0xffa21a, emissiveIntensity: 0.4 }));
    sun.add(cyl(0.38, 0.38, 0.1, 0xffe27a, 0, -0.03, 0, 24, { emissive: 0xffc23d, emissiveIntensity: 0.4 }));
    for (let k = 0; k < 12; k++) { const ray = box(0.1, 0.06, 0.32, 0xffc23d, Math.cos(k * Math.PI / 6) * 0.78, -0.03, Math.sin(k * Math.PI / 6) * 0.78, { emissive: 0xffa21a, emissiveIntensity: 0.4 }); ray.rotation.y = -k * Math.PI / 6 + Math.PI / 2; sun.add(ray); }
    const sunHold = new THREE.Group(); sunHold.add(sun); sunHold.rotation.z = -Math.PI / 2; sunHold.position.set(2.62, 1.45, -1.3); g.add(sunHold);
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
    return { group: g, top: top + 1.6, anim(t) { turret.rotation.y = Math.sin(t * 0.7) * 1.2 - 0.6; upper.rotation.z = -0.45 + Math.sin(t * 1.4) * 0.15; sun.rotation.y = t * 0.3; } };
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
    // the landmark: a giant battery standing on the roof, its charge window filling up
    const ry = top - 0.43, bx = -0.9, bz = -0.5;
    g.add(cyl(1.0, 1.05, 0.2, 0x3a3f48, bx, ry, bz, 28));
    g.add(cyl(0.9, 0.9, 2.5, 0x22252b, bx, ry + 0.2, bz, 28, { roughness: 0.35, metalness: 0.3 }));
    g.add(cyl(0.92, 0.92, 0.85, color, bx, ry + 1.75, bz, 28, { roughness: 0.3, metalness: 0.2 }));
    g.add(cyl(0.93, 0.93, 0.06, 0xf2f2f0, bx, ry + 1.72, bz, 28));
    g.add(cyl(0.36, 0.36, 0.22, 0xd9d9d9, bx, ry + 2.7, bz, 18, { metalness: 0.6, roughness: 0.3 }));
    const big = [];
    for (let k = 0; k < 6; k++) { const seg = box(0.34, 0.2, 0.06, 0x4fdc6a, bx + 0.64, ry + 0.4 + k * 0.24, bz + 0.64, { emissive: 0x2fd14a, emissiveIntensity: 1 }); seg.rotation.y = Math.PI / 4; seg.material = seg.material.clone(); g.add(seg); big.push(seg); }
    const plus = new THREE.Group();
    plus.add(box(0.12, 0.42, 0.04, WHITE, 0, -0.21, 0), box(0.42, 0.12, 0.04, WHITE, 0, -0.06, 0));
    plus.position.set(bx - 0.45, ry + 2.15, bz + 0.8); plus.rotation.y = -0.5; g.add(plus);
    bars.push(big);
    // a transformer with insulators, fenced
    g.add(box(0.9, 0.15, 0.8, PLINTH, -2.6, 0.15, -2.45), box(0.7, 0.75, 0.55, 0x6f8fa8, -2.6, 0.3, -2.45));
    for (const dx of [-0.2, 0, 0.2]) g.add(cyl(0.04, 0.04, 0.35, 0xe8e2d4, -2.6 + dx, 1.05, -2.45, 6));
    pipe(g, [[-2.6, 1.3, -2.45], [-2.6, 1.6, -2.45], [-2.6, 1.6, -2.2]], 0.05, DARK);
    return {
      group: g, top: top + 3.2,
      anim(t) { bars.forEach((col, i) => { const lvl = ((t * 0.25 + i * 0.33) % 1) * (col.length + 1); col.forEach((b, k) => { b.material.emissiveIntensity = k < lvl ? 1.4 : 0.05; }); }); },
    };
  },

  // ---- Drone Works: a hall with landing pads on the roof, a netted test cage with a
  // drone hovering inside, drones circling above, and a windsock
  drone(color) {
    const g = new THREE.Group();
    // a corrugated quonset hangar (like an old desert airfield's), its end a big door
    const hx = -0.75, hz = -0.75, hl = 4.4, hr = 1.75;
    const top = quonset(g, hx, hz, hl, hr, 0xb9bec6);
    const ex = hx + hl / 2;
    g.add(box(0.12, 1.75, 2.2, DARK, ex + 0.04, 0.3, hz));
    g.add(box(0.08, 1.6, 2.0, shade(color, -0.1), ex + 0.08, 0.3, hz));
    for (let k = 1; k < 6; k++) g.add(box(0.03, 0.03, 2.0, shade(color, -0.35), ex + 0.13, 0.3 + k * 0.27, hz));
    for (const dz of [-1.2, 1.2]) g.add(box(0.14, 0.6, 0.14, HAZ, ex + 0.1, 0.3, hz + dz));
    g.add(box(0.06, 0.25, 1.2, 0xfff2c8, ex + 0.1, 2.1, hz, { emissive: 0xffd27a, night: 2.2 }));
    // a big painted roundel on the curved roof, and a row of skylights
    const roundel = mesh(new THREE.CircleGeometry(0.55, 20), color, { side: THREE.DoubleSide }); roundel.rotation.x = -Math.PI / 2; roundel.position.set(hx - 0.6, top + 0.01, hz); g.add(roundel);
    const ring = mesh(new THREE.RingGeometry(0.28, 0.36, 20), WHITE, { side: THREE.DoubleSide }); ring.rotation.x = -Math.PI / 2; ring.position.set(hx - 0.6, top + 0.02, hz); g.add(ring);
    for (const dx of [0.6, 1.4]) g.add(box(0.5, 0.06, 0.9, GLASS, hx + dx, top - 0.03, hz));
    // an adobe flight office at the front, with a landing pad on its roof
    const ox = -2.05, oz = 2.0;
    const otop = adobeHall(g, { x: ox, z: oz, w: 1.8, d: 1.4, h: 1.4, color: STUCCO, step: false });
    deepWin(g, 'z', ox - 0.4, 0.75, oz + 0.7); deepWin(g, 'z', ox + 0.45, 0.75, oz + 0.7, 0.5, 0.55, TEAL, WARM);
    signBoard(g, 'x', oz, 1.05, ox + 0.9, 1.2, color, 3);
    const roofY = otop - 0.3;
    for (const [x, z] of [[ox, oz]]) {
      g.add(cyl(0.6, 0.6, 0.08, 0x3a3f48, x, roofY, z, 24));
      g.add(box(0.08, 0.02, 0.5, WHITE, x - 0.16, roofY + 0.08, z), box(0.08, 0.02, 0.5, WHITE, x + 0.16, roofY + 0.08, z), box(0.32, 0.02, 0.08, WHITE, x, roofY + 0.08, z));
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.add(box(0.07, 0.06, 0.07, 0x9cff8a, x + Math.cos(a) * 0.55, roofY + 0.06, z + Math.sin(a) * 0.55, { emissive: 0x6dff5a, night: 2.2 })); }
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
        flyers.forEach((d, i) => { const a = t * 0.55 + i * 2.1; d.position.set(-0.6 + Math.cos(a) * 2.2, top + 0.9 + i * 0.35 + Math.sin(t * 2 + i) * 0.15, -0.5 + Math.sin(a) * 1.8); d.rotation.y = -a; });
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
    // a giant rover wheel set up as a sculpture out back, and tyre tracks over the yard
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.95, 0.16, 8, 24), 0x2a2d33));
    for (let k = 0; k < 24; k++) { const tr = box(0.1, 0.12, 0.42, 0x3a3f48, Math.cos(k / 24 * Math.PI * 2) * 1.08, Math.sin(k / 24 * Math.PI * 2) * 1.08 - 0.06, -0.21); tr.rotation.z = k / 24 * Math.PI * 2; wheel.add(tr); }
    for (let k = 0; k < 6; k++) { const sp = box(0.08, 0.9, 0.08, 0xc9ced6, 0, -0.45, 0); sp.rotation.z = k * Math.PI / 3; wheel.add(sp); }
    wheel.add(cyl(0.2, 0.2, 0.3, color, 0, -0.15, 0, 14).rotateX(Math.PI / 2));
    wheel.position.set(2.55, 1.35, -2.4); wheel.rotation.y = 0.6; g.add(wheel);
    g.add(box(0.9, 0.3, 0.5, 0xc9a77c, 2.55, 0.15, -2.4));
    const trackM = mat(0x7a5a3a, { transparent: true, opacity: 0.45, depthWrite: false });
    for (const dz of [-0.28, 0.28]) for (let k = 0; k < 9; k++) { const tr = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.12), trackM); tr.rotation.x = -Math.PI / 2; tr.position.set(-2.9 + k * 0.32, 0.17, 1.2 + dz + Math.sin(k * 0.6) * 0.15); g.add(tr); }
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

  // ---- Desert Data Center: a long, windowless rammed-earth hall in layered bands of
  // ochre and rust, lit server slots down its walls, evaporative cooling towers with wet
  // turquoise pads and big fans, a water tank to feed them, and shade sails out front
  datacenterdesert(color) {
    const g = new THREE.Group();
    const x = -0.35, z = -0.55, w = 5.3, d = 3.5, h = 2.1;
    g.add(box(w + 0.24, 0.3, d + 0.24, 0xc9a77c, x, 0, z));
    const bands = [0xc49a6c, 0xb07a52, 0xd2aa7a, 0xa86e4a, 0xc89e70, 0xb8845a];
    for (let k = 0; k < 6; k++) g.add(box(w, h / 6 + 0.01, d, bands[k], x, 0.3 + k * h / 6, z));
    const top = 0.3 + h;
    g.add(box(w + 0.1, 0.16, d + 0.1, 0x8a6a45, x, top, z));
    // narrow server slots glowing blue down the front and side
    const lights = [];
    for (const [axis, f, len] of [['z', z + d / 2, w], ['x', x + w / 2, d]]) for (let i = 0; i < (axis === 'z' ? 9 : 6); i++) {
      const a = (axis === 'z' ? x : z) - len / 2 + 0.45 + i * ((len - 0.9) / ((axis === 'z' ? 9 : 6) - 1));
      g.add(onWall(axis, a, 0.6, f, 0.16, 1.35, 0.05, 0x1a2230));
      const l = onWall(axis, a, 0.65, f + Math.sign(f) * 0.02, 0.06, 1.25, 0.04, 0x5fd3ff, { emissive: 0x2fb6ff, emissiveIntensity: 1 });
      l.material = l.material.clone(); lights.push(l); g.add(l);
    }
    signBoard(g, 'z', x + 1.3, 1.25, z + d / 2, 1.8, 0x2fb6ff, 4);
    sideDoor(g, 'z', x - 1.7, z + d / 2, 0x3a3f48);
    // evaporative cooling towers along the roof: louvred wet pads and a fan on top
    const fans = [];
    for (let i = 0; i < 3; i++) {
      const cx = x - 1.75 + i * 1.75, cz = z - 0.45;
      g.add(box(1.25, 1.1, 1.25, 0xe6dcc8, cx, top + 0.16, cz));
      for (const [axis, f] of [['z', cz + 0.625], ['x', cx + 0.625]]) for (let k = 0; k < 5; k++) g.add(onWall(axis, axis === 'z' ? cx : cz, top + 0.3 + k * 0.17, f, 1.05, 0.08, 0.05, 0x3fae9a));
      g.add(cyl(0.55, 0.55, 0.3, 0x9aa0a8, cx, top + 1.26, cz, 18));
      const fan = new THREE.Group();
      for (let b = 0; b < 3; b++) { const bl = mesh(new THREE.BoxGeometry(0.85, 0.03, 0.18), 0x3a3f48); bl.rotation.y = b * Math.PI * 2 / 3; bl.rotation.x = 0.3; fan.add(bl); }
      fan.position.set(cx, top + 1.58, cz); fans.push(fan); g.add(fan);
      g.add(box(1.0, 0.06, 0.08, 0xc9ced6, cx, top + 1.56, cz));
    }
    // the water tank for the coolers, piped to the roof
    const ty = tank(g, 2.75, -2.45, 0.6, 1.9, 0xd9c4a0);
    pipe(g, [[2.75, ty - 0.6, -1.85], [2.75, top + 0.6, -1.85], [x + w / 2 - 0.3, top + 0.6, -1.85]], 0.08, 0x9aa0a8);
    // shade sails over the front: taut triangles of fabric on leaning posts
    for (const [sx, c] of [[2.0, 0xc8643c], [3.0, 0xeadbbd]]) {
      const tri = new THREE.BufferGeometry();
      tri.setAttribute('position', new THREE.Float32BufferAttribute([sx - 0.7, 1.9, 1.55, sx + 0.7, 1.7, 1.75, sx - 0.2, 1.75, 3.05], 3));
      tri.computeVertexNormals();
      g.add(mesh(tri, c, { side: THREE.DoubleSide }));
      for (const [px, py, pz] of [[sx - 0.7, 1.9, 1.55], [sx + 0.7, 1.7, 1.75], [sx - 0.2, 1.75, 3.05]]) g.add(box(0.06, py - 0.15, 0.06, 0x8a6a45, px, 0.15, pz));
    }
    cactusPot(g, x - 2.4, z + d / 2 + 0.45, 0.7);
    return {
      group: g, top: top + 2.2,
      anim(t, dt) {
        fans.forEach((f, i) => { f.rotation.y += dt * (4 + i * 0.8); });
        lights.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(t * 5 + i * 2.3) > 0 ? 1.3 : 0.2; });
      },
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
