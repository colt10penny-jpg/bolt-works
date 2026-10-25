// The extra wings a building gains as it levels up (one at level 5, two at 10, three at
// 25), built from the same kit as the buildings so they match them: piers, parapets,
// framed windows on every wall (the camera sees the inner walls of the back wings too),
// doors, rooftop gear, and a look for each world.
//
//   old (levels 1-24):  weathered, with the building's colours mixed into brick or adobe
//   modern (50+):       glass curtain walls in a white frame, a lit crown and a roof garden
//
// Kinds follow the building's style (see STYLE in upgrades.js): a workshop with a
// saw-tooth roof, a hangar, a pair of silos, a switchyard, a server hall, or a plain
// block. On the Moon every wing is a pressurised module tower instead.
import * as THREE from 'three';
import { box, cyl, mat } from './models.js';
import { styledWing } from './upgrades.js';
import { falseFront, wWin, porch, balcony, barrel } from './buildings-west.js';
import { TRIM, DARK, IRON, HAZ, GLASS, WARM, shade, mesh, at, onWall, win, door, sideDoor, hall, tank, railing } from './buildings.js';

const W = 2.3, D = 2.2, FH = 0.8;
const MW = 0xeef0f3, GOLD = 0xd9a83a, TEAL = 0x2fa39a, ADOBE = 0xd9b38c, STUCCO = 0xeadbbd;

// windows on all four walls, a row per floor, leaving room for a door at the bottom
function windowsAround(g, floors, { y0 = 0.42, frame = DARK, glass = GLASS, skip = null, boarded = false, w = 0.5, h = 0.36, deep = false } = {}) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + f * FH;
    for (const [axis, f0, len] of [['z', D / 2, W], ['z', -D / 2, W], ['x', W / 2, D], ['x', -W / 2, D]]) {
      for (const a of [-len / 4, len / 4]) {
        if (f === 0 && skip && skip.axis === axis && Math.sign(skip.f) === Math.sign(f0) && Math.abs(a - skip.a) < 0.7) continue;
        if (deep) {
          g.add(onWall(axis, a, y - 0.04, f0, w + 0.12, h + 0.1, 0.05, frame));
          g.add(onWall(axis, a, y, f0, w - 0.04, h - 0.04, 0.07, 0x1c2f3a));
        } else win(g, axis, a, y, f0, w, h, frame, glass);
        if (boarded && (f + (a > 0 ? 1 : 0)) % 2 === 0) {
          g.add(onWall(axis, a - 0.05, y + 0.08, f0 + Math.sign(f0) * 0.1, w + 0.1, 0.09, 0.03, 0x7a5a3a));
          g.add(onWall(axis, a + 0.04, y + 0.24, f0 + Math.sign(f0) * 0.1, w, 0.09, 0.03, 0x6b4f33));
        }
      }
    }
  }
}
// the door goes on the outside wall the camera can see if there is one
function doorWall(cx, cz) {
  if (cz > 0) return { axis: 'z', f: D / 2, a: 0 };
  if (cx > 0) return { axis: 'x', f: W / 2, a: 0 };
  return { axis: 'z', f: D / 2, a: 0 };
}
// rooftop gear by level: an AC unit, then solar panels, then a garden, floodlights, an antenna
function roofGear(g, y, tier, cx, cz) {
  g.add(box(0.6, 0.32, 0.45, 0xc9ced6, -0.45, y, -0.45), box(0.36, 0.04, 0.36, DARK, -0.45, y + 0.32, -0.45));
  if (tier >= 4 && tier < 7) for (let k = 0; k < 2; k++) {
    const p = box(0.75, 0.05, 0.55, 0x223f78, 0.35, y + 0.25, -0.35 + k * 0.7, { roughness: 0.25, metalness: 0.4 }); p.rotation.x = -0.45; g.add(p);
    g.add(box(0.05, 0.25, 0.05, IRON, 0.35, y, -0.35 + k * 0.7));
  }
  if (tier >= 7) {
    g.add(box(1.2, 0.18, 0.9, 0x8a6a4f, 0.3, y, 0.35), box(1.14, 0.05, 0.84, 0x5f9e3c, 0.3, y + 0.18, 0.35));
    for (const [bx, bz] of [[0.0, 0.2], [0.6, 0.5]]) g.add(at(mesh(new THREE.IcosahedronGeometry(0.24, 0), 0x3f8f4a, { flatShading: true }), bx, y + 0.42, bz));
  }
  if (tier >= 8) {
    const sx = Math.sign(cx) || 1, sz = Math.sign(cz) || 1;
    for (const [fx, fz] of [[sx * 0.95, sz * 0.9], [-sx * 0.95, sz * 0.9]]) { g.add(box(0.07, 0.45, 0.07, DARK, fx, y, fz)); g.add(box(0.26, 0.17, 0.17, 0xfff1cf, fx, y + 0.45, fz, { emissive: 0xffe2a8, night: 3 })); }
  }
  if (tier >= 9) { g.add(box(0.06, 1.3, 0.06, 0xdddddd, -0.85, y, 0.75)); g.add(box(0.1, 0.1, 0.1, 0xff3b2f, -0.85, y + 1.3, 0.75, { emissive: 0xff2a1a, emissiveIntensity: 1.5 })); }
}

// ---- Colorado / Mojave blocks ----
// a weathered (or mid-level) block in the building's colours
function block(g, { color, tier, cx, cz, floors, theme }) {
  const desert = theme === 'desert';
  const c = desert ? (tier <= 3 ? shade(ADOBE, -0.05) : STUCCO)
    : tier <= 3 ? new THREE.Color(color).lerp(new THREE.Color(0x9a5a44), 0.55).multiplyScalar(0.92).getHex()
    : new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.12).getHex();
  const h = floors * FH;
  const top = hall(g, { w: W, d: D, h, color: c, piers: 1.15, belt: false, pierColor: desert ? shade(c, -0.12) : undefined });
  // a band of the building's own colour under the parapet ties the wing to it
  g.add(box(W + 0.22, 0.2, D + 0.22, desert ? color : shade(color, -0.15), 0, h + 0.12, 0));
  const dw = doorWall(cx, cz);
  if (desert) {
    windowsAround(g, floors, { skip: dw, frame: TEAL, deep: true, w: 0.45, h: 0.36 });
    for (const [axis, f0, len] of [['z', D / 2, W], ['x', W / 2, D]]) for (let k = 0; k < 4; k++) g.add(onWall(axis, -len / 2 + len * (k + 0.5) / 4, h - 0.02, f0, 0.13, 0.13, 0.26, 0x7a5230));
  } else windowsAround(g, floors, { skip: dw, boarded: tier <= 1, glass: tier <= 3 ? WARM : GLASS });
  sideDoor(g, dw.axis, dw.a, dw.f, desert ? 0x6b4a2b : 0x3a3f48);
  roofGear(g, top - 0.43, tier, cx, cz);
  return top;
}
// a sleek modern block: a glass curtain wall in a white frame, floor bands in the
// building's colour, and a crown with a light strip set into it
function glassBlock(g, { color, tier, cx, cz, floors, theme }) {
  const h = floors * FH, white = theme === 'desert' ? 0xf4ede0 : 0xf4f4f2;
  g.add(box(W + 0.18, 0.32, D + 0.18, 0x9c968a, 0, 0, 0));
  g.add(box(W - 0.12, h, D - 0.12, 0x9fe8ff, 0, 0.3, 0));
  for (let f = 0; f <= floors; f++) g.add(box(W + 0.02, 0.12, D + 0.02, f === floors ? white : shade(color, 0.1), 0, 0.3 + Math.min(h - 0.12, f * FH), 0));
  for (const [axis, f0, len] of [['z', D / 2, W], ['z', -D / 2, W], ['x', W / 2, D], ['x', -W / 2, D]])
    for (let k = 1; k < 4; k++) g.add(onWall(axis, -len / 2 + (len * k) / 4, 0.3, f0 - Math.sign(f0) * 0.06, 0.05, h, 0.06, white));
  for (const [fx, fz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(box(0.16, h, 0.16, white, fx * (W / 2 - 0.02), 0.3, fz * (D / 2 - 0.02)));
  if (theme === 'desert') for (const [axis, f0, len] of [['z', D / 2, W], ['x', W / 2, D]]) for (let f = 0; f < floors; f++) g.add(onWall(axis, 0, 0.3 + f * FH + 0.62, f0, len - 0.1, 0.05, 0.25, white));
  // the crown, with its light strip inside the band (not floating above it)
  const cy = 0.3 + h;
  g.add(box(W + 0.12, 0.42, D + 0.12, white, 0, cy, 0));
  g.add(box(W + 0.16, 0.06, D + 0.16, 0x7fe0ff, 0, cy + 0.18, 0, { emissive: 0x4fd0ff, night: 2.2 }));
  const dw = doorWall(cx, cz);
  g.add(onWall(dw.axis, dw.a, 0.3, dw.f, 0.8, 0.62, 0.05, 0x2a2d33));
  g.add(onWall(dw.axis, dw.a, 0.92, dw.f, 1.2, 0.06, 0.45, white));
  roofGear(g, cy + 0.42, tier, cx, cz);
  return cy + 0.42;
}
// a workshop with a saw-tooth roof of skylights
function sawWing(g, { color, tier, cx, cz, floors, theme }) {
  const c = theme === 'desert' ? STUCCO : tier <= 3 ? new THREE.Color(color).lerp(new THREE.Color(0x9a8a74), 0.4).getHex() : shade(color, 0.12);
  const h = Math.max(2, floors - 1) * FH;
  const wallTop = hall(g, { w: W, d: D, h, color: c, piers: 1.15, belt: false, parapet: false });
  for (let k = 0; k < 2; k++) {
    const bx = -W / 4 + (k * W) / 2;
    const sh = new THREE.Shape(); sh.moveTo(-W / 4, 0); sh.lineTo(W / 4, 0); sh.lineTo(W / 4, 0.6); sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: D + 0.1, bevelEnabled: false }); geo.translate(0, 0, -(D + 0.1) / 2);
    const m = mesh(geo, shade(color, -0.3)); m.position.set(bx, wallTop, 0); g.add(m);
    g.add(box(0.05, 0.52, D - 0.1, GLASS, bx + W / 4 - 0.03, wallTop + 0.03, 0));
  }
  const dw = doorWall(cx, cz);
  windowsAround(g, Math.max(2, floors - 1), { skip: dw, glass: tier <= 3 ? WARM : GLASS });
  door(g, dw.axis, dw.a, dw.f, 1.0, 0.95, 0xb9b4a8);
  if (tier >= 7) g.add(box(W + 0.12, 0.06, D + 0.12, 0x7fe0ff, 0, wallTop - 0.25, 0, { emissive: 0x4fd0ff, night: 2.2 }));
  return wallTop + 0.65;
}
// a hangar with a curved roof and a big door
function hangarWing(g, { color, tier, cx, cz, floors, theme }) {
  const c = theme === 'desert' ? STUCCO : tier <= 3 ? new THREE.Color(color).lerp(new THREE.Color(0x8a8f99), 0.4).getHex() : shade(color, 0.1);
  const h = Math.max(1.4, (floors - 1) * FH * 0.75);
  const wallTop = hall(g, { w: W, d: D, h, color: c, piers: 1.15, belt: false, parapet: false });
  const r = W / 2 + 0.08;
  const roof = mesh(new THREE.CylinderGeometry(r, r, D + 0.16, 20, 1, false, -Math.PI / 2, Math.PI), shade(color, -0.3));
  roof.rotation.x = -Math.PI / 2; roof.scale.set(1, 1, 0.55); roof.position.set(0, wallTop, 0); g.add(roof);
  for (let k = -1; k <= 1; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.02, 0.03, 4, 20, Math.PI), DARK); rib.scale.set(1, 0.55, 1); rib.position.set(0, wallTop, k * D / 3); g.add(rib); }
  const dw = doorWall(cx, cz);
  if (dw.axis === 'z') {
    // the big door fills the end wall under the arch
    door(g, 'z', 0, D / 2, 1.5, Math.min(1.6, h + 0.1), 0xc9ced6);
    winRow2(g, 'x', W / 2, h); winRow2(g, 'x', -W / 2, h);
  } else {
    door(g, 'x', 0, W / 2, 1.4, Math.min(1.6, h + 0.1), 0xc9ced6);
    winRow2(g, 'z', D / 2, h); winRow2(g, 'z', -D / 2, h);
  }
  // modern hangars get a light strip along the eaves, right on the wall top
  if (tier >= 7) for (const s of [-1, 1]) g.add(box(0.06, 0.06, D + 0.1, 0x7fe0ff, s * (W / 2 + 0.05), wallTop - 0.08, 0, { emissive: 0x4fd0ff, night: 2.2 }));
  return wallTop + r * 0.55;
}
function winRow2(g, axis, f, h) { for (const a of [-0.55, 0.55]) win(g, axis, a, 0.3 + h * 0.45, f, 0.5, Math.min(0.5, h * 0.35)); }
// a dark server hall with lit strips and fans on the roof
function serverWing(g, { color, tier, cx, cz, floors }) {
  const h = Math.max(2, floors - 1) * FH;
  const top = hall(g, { w: W, d: D, h, color: 0x2f3646, piers: 1.15, belt: false, pierColor: 0x3a4252, roof: 0x40444c });
  for (const [axis, f0] of [['z', D / 2], ['x', W / 2], ['z', -D / 2], ['x', -W / 2]])
    for (let k = 0; k < 3; k++) g.add(onWall(axis, -0.7 + k * 0.7, 0.6, f0, 0.4, h - 0.6, 0.04, 0x3d4b6b));
  for (const [axis, f0] of [['z', D / 2], ['x', W / 2]]) for (let r = 0; r < Math.floor(h / 0.5); r++) g.add(onWall(axis, 0, 0.75 + r * 0.45, f0 + Math.sign(f0) * 0.05, 1.8, 0.05, 0.03, 0x5fd3ff, { emissive: 0x2fb6ff, emissiveIntensity: 1.1 }));
  const y = top - 0.43;
  for (const [x, z] of [[-0.5, -0.45], [0.5, -0.45], [0, 0.5]]) { g.add(box(0.8, 0.3, 0.7, 0xc9ced6, x, y, z)); g.add(cyl(0.25, 0.25, 0.04, DARK, x, y + 0.3, z, 14)); }
  if (tier >= 8) roofGear(g, y, 8, cx, cz);
  return top;
}
// two silos on a frame with a catwalk between them
function siloWing(g, { color, tier, floors, theme }) {
  const c = theme === 'moon' || theme === 'mars' ? MW : tier <= 3 ? new THREE.Color(color).lerp(new THREE.Color(0xa8a49a), 0.35).getHex() : shade(color, 0.15);
  const hh = Math.max(1.6, floors * FH);
  let top = 0;
  for (const [x, z] of [[-0.5, -0.45], [0.55, 0.5]]) top = Math.max(top, tank(g, x, z, 0.55, hh, c));
  g.add(box(0.95, 0.07, 0.35, IRON, 0.02, hh * 0.85, 0.02));
  railing(g, -0.3, 0.17, 0.35, 0.17, hh * 0.85 + 0.07);
  if (tier >= 7) for (const [x, z] of [[-0.5, -0.45], [0.55, 0.5]]) { const ring = mesh(new THREE.TorusGeometry(0.6, 0.035, 6, 24), 0x7fe0ff, { emissive: 0x4fd0ff, night: 2.2 }); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.3 + hh * 0.9, z); g.add(ring); }
  return top;
}

// ---- the Moon: a pressurised module tower with ribs, gold foil and portholes ----
function porthole(g, x, y, z, nx, nz, r = 0.12) {
  const n = new THREE.Vector3(nx, 0, nz).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const rim = mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.05, 14), 0x3a3f48); rim.quaternion.copy(q); rim.position.set(x, y, z); g.add(rim);
  const pane = mesh(new THREE.CylinderGeometry(r, r, 0.07, 14), 0x9fe8ff, { emissive: 0x2fc8ff, emissiveIntensity: 1.2 }); pane.quaternion.copy(q); pane.position.set(x + n.x * 0.01, y, z + n.z * 0.01); g.add(pane);
}
function moonWing(g, { color, tier, floors }) {
  const r = 0.95, h = Math.max(1.4, floors * FH * 0.85);
  g.add(cyl(r + 0.15, r + 0.2, 0.3, 0x9c968a, 0, 0, 0, 24));
  g.add(cyl(r, r, h, MW, 0, 0.3, 0, 24));
  for (let k = 0; k <= Math.floor(h / 0.7); k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 5, 24), shade(MW, -0.2)); rib.rotation.x = Math.PI / 2; rib.position.y = 0.3 + Math.min(h, k * 0.7); g.add(rib); }
  g.add(cyl(r + 0.03, r + 0.03, 0.35, tier >= 4 ? color : GOLD, 0, 0.3 + h * 0.5, 0, 24, { metalness: 0.6, roughness: 0.3 }));
  const capTop = 0.3 + h;
  const cap = mesh(new THREE.SphereGeometry(r, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2), MW); cap.scale.y = 0.45; cap.position.y = capTop; g.add(cap);
  // portholes round the tower, two rows per floor band
  for (let row = 0; row < Math.max(1, Math.floor(h / 0.9)); row++)
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2 + row * 0.5, y = 0.75 + row * 0.9; if (y > capTop - 0.3 || Math.abs(y - (0.3 + h * 0.5)) < 0.25) continue; porthole(g, Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
  // an airlock stub with a hatch and a light
  const tube = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 14), MW); tube.rotation.x = Math.PI / 2; tube.position.set(0, 0.6, r + 0.15); g.add(tube);
  const hatch = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.05, 14), 0x3a3f48); hatch.rotation.x = Math.PI / 2; hatch.position.set(0, 0.6, r + 0.42); g.add(hatch);
  g.add(box(0.12, 0.06, 0.04, 0xffb070, 0.3, 0.92, r + 0.38, { emissive: 0xff8a2a, emissiveIntensity: 1.2 }));
  // the top: an antenna, then a solar wing, then a glowing ring when it's new
  const ty = capTop + r * 0.45;
  g.add(box(0.05, 0.7, 0.05, 0xd8dbe2, 0.3, ty - 0.1, 0.2));
  if (tier >= 4) {
    g.add(box(0.08, 0.5, 0.08, 0xd8dbe2, -0.2, ty - 0.1, -0.2));
    for (const s of [-1, 1]) { const p = box(0.6, 0.04, 0.45, 0x223f78, -0.2 + s * 0.42, ty + 0.42, -0.2, { roughness: 0.25, metalness: 0.4 }); p.rotation.z = s * 0.25; g.add(p); }
  }
  if (tier >= 7) { const ring = mesh(new THREE.TorusGeometry(r + 0.06, 0.05, 6, 28), 0x7fe0ff, { emissive: 0x4fd0ff, night: 2.2 }); ring.rotation.x = Math.PI / 2; ring.position.y = capTop - 0.05; g.add(ring); }
  return ty;
}

// Mars: a slender sci-fi tower of stacked rounded pods on a gunmetal core, each pod with a
// band of glowing windows, a dome on top and a mast with a red light
function marsWing(g, { color, tier, floors }) {
  const H = 0xddd6c8, P = 0x666a72;
  g.add(cyl(0.95, 1.05, 0.3, 0x2e2220, 0, 0, 0, 20));
  const n = Math.max(2, Math.min(5, Math.round(floors * 0.8)));
  g.add(cyl(0.28, 0.38, n * 0.75 + 0.3, P, 0, 0.3, 0, 12));
  let y = 0.4;
  for (let k = 0; k < n; k++) {
    const r = 0.95 - k * 0.07;
    const pod = mesh(new THREE.SphereGeometry(r, 24, 12), H); pod.scale.y = 0.38; pod.position.y = y + 0.32; g.add(pod);
    const band = mesh(new THREE.CylinderGeometry(r * 0.97, r * 0.97, 0.1, 24), 0x9fdcff, { emissive: 0x6fc8ff, emissiveIntensity: 0.3, night: 1.8 }); band.position.y = y + 0.32; g.add(band);
    if (k === Math.floor(n / 2)) { const ring = mesh(new THREE.TorusGeometry(r * 0.99, 0.035, 4, 28), tier >= 4 ? color : 0xff8a3a, { emissive: tier >= 4 ? color : 0xff8a3a, night: 2.2 }); ring.rotation.x = Math.PI / 2; ring.position.y = y + 0.2; g.add(ring); }
    y += 0.75;
  }
  const cap = mesh(new THREE.SphereGeometry(0.45, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), H); cap.scale.y = 0.6; cap.position.y = y; g.add(cap);
  g.add(box(0.05, 0.9, 0.05, 0xdddddd, 0, y + 0.2, 0), box(0.1, 0.1, 0.1, 0xff3b2f, 0, y + 1.1, 0, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
  return y + 0.3;
}


// ---- the Wild West: another false-front shop on the street, timber when young and
// brick with a balcony when the town has grown rich ----
const WEST_PAINT = [0x9a6b42, 0x8f8574, 0x6f8f5a, 0xa8643a, 0x5a6a7a, 0xc9b48a];
function westWing(g, { color, tier, cx, cz, floors, i }) {
  const fl = Math.min(3, 1 + Math.floor(floors / 2)), h = fl * 0.85 + 0.3;
  const brick = tier >= 5, wall = brick ? (i % 2 ? 0xa4553a : 0x8a4a34) : WEST_PAINT[(i + Math.round(Math.abs(cx + cz))) % WEST_PAINT.length];
  const top = falseFront(g, { x: 0, z: 0, w: W - 0.1, d: D - 0.2, h, fh: 0.7, color: wall, sign: color, letters: 4 + (i % 3) });
  const dw = doorWall(cx, cz);
  // windows on the two outer walls, a row per floor, and a door at the bottom
  for (let f = 0; f < fl; f++) for (const a of [-0.55, 0.55]) {
    const y = 0.5 + f * 0.85;
    if (!(f === 0 && dw.axis === 'z' && Math.abs(a) < 0.6 && a > 0)) wWin(g, 'z', a, y, (D - 0.2) / 2, 0.38, 0.5, 0xeee4cc, tier >= 3 ? WARM : GLASS);
    wWin(g, 'x', a * 0.9, y, (W - 0.1) / 2, 0.38, 0.5, 0xeee4cc, tier >= 3 ? WARM : GLASS);
  }
  g.add(onWall('z', 0.55, 0.25, (D - 0.2) / 2, 0.45, 0.9, 0.05, 0x3a2a1e));
  if (fl >= 2) balcony(g, { axis: 'z', a: 0, f: (D - 0.2) / 2, len: W - 0.1, y: 1.0, depth: 0.45 });
  else porch(g, { axis: 'z', a: 0, f: (D - 0.2) / 2, len: W - 0.1, depth: 0.5, h: 1.05, rail: false });
  if (tier <= 2) barrel(g, -0.85, (D - 0.2) / 2 + 0.3, 0.15, 0.8);
  return top;
}

export function buildWing({ kind, theme, cx, cz, color, tier, i }) {
  if (kind === 'yard' && theme !== 'desert') return styledWing(kind, cx, cz, color, tier, i);   // the switchyard is fine as it is
  const g = new THREE.Group();
  const floors = 2 + Math.floor(Math.min(9, tier) / 3) + (i === 0 ? 1 : 0) + (tier >= 8 ? 1 : 0);
  const o = { color, tier, cx, cz, floors, theme };
  let top;
  if (theme === 'desert') top = westWing(g, { ...o, i });
  else if (theme === 'mars') top = marsWing(g, o);
  else if (theme === 'moon') top = kind === 'silo' ? siloWing(g, o) : moonWing(g, o);
  else if (kind === 'silo') top = siloWing(g, o);
  else if (kind === 'sawtooth') top = sawWing(g, o);
  else if (kind === 'hangar') top = hangarWing(g, o);
  else if (kind === 'server') top = serverWing(g, o);
  else top = tier >= 7 ? glassBlock(g, o) : block(g, o);
  g.position.set(cx, 0.15, cz);
  g.userData.top = top;
  return g;
}
