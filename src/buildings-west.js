// The Wild West: a frontier boom town (the world with id 'desert', see worlds.js). Board-
// and-batten timber buildings with tall false fronts and painted signs, shady porches on
// the boardwalk, balconies, hitching rails and horses, a mine headframe, a thumping stamp
// mill, a railroad depot with a little steam engine, farm windmills and water towers.
//
// The middle of each side (where loading docks go when a road runs past) is kept clear
// of anything tall, so wagons and docks don't run into the buildings.
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
import { BUILDERS, box, cyl } from './models.js';
import { DARK, IRON, GLASS, WARM, shade, mesh, at, rod, onWall } from './buildings.js';

const WOOD = 0x9a6b42, WOOD_D = 0x6e4a2c, WOOD_L = 0xc29a66, GREY = 0x8f8574, TRIM = 0xeee4cc, SHINGLE = 0x5e4c3c, TIN = 0x9aa0a8, HAY = 0xd9b45a, BRICK = 0xa4553a, CREAM = 0xf1e6c8;

// The main building of each lot is built at this scale (in a group of its own) so it fills
// the lot; the barrels, horses and poles round the corners stay life size.
const S = 1.3;
function core(g) { const c = new THREE.Group(); c.scale.setScalar(S); g.add(c); return c; }

// ---- frontier parts ----
// vertical boards (battens) on the front (+z) and right (+x) faces of a w x h x d box
function battens(g, x, z, w, d, y0, h, color) {
  const c = shade(color, -0.18);
  for (let a = -w / 2 + 0.22; a < w / 2 - 0.1; a += 0.3) g.add(onWall('z', x + a, y0, z + d / 2, 0.04, h, 0.03, c));
  for (let a = -d / 2 + 0.22; a < d / 2 - 0.1; a += 0.3) g.add(onWall('x', z + a, y0, x + w / 2, 0.04, h, 0.03, c));
}
// a window: white trim, a dark (warm at night) pane with muntins, a sill and a lintel
function wWin(g, axis, a, y, f, w = 0.5, h = 0.72, trim = TRIM, glass = GLASS) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, y - 0.06, f, w + 0.14, h + 0.12, 0.04, trim));
  g.add(onWall(axis, a, y, f + s * 0.02, w, h, 0.04, glass, glass === WARM ? { emissive: 0xff9a3a, emissiveIntensity: 0.5 } : undefined));
  g.add(onWall(axis, a, y, f + s * 0.05, 0.035, h, 0.02, trim), onWall(axis, a, y + h * 0.5, f + s * 0.05, w, 0.035, 0.02, trim));
  g.add(onWall(axis, a, y + h + 0.04, f, w + 0.26, 0.08, 0.1, trim), onWall(axis, a, y - 0.1, f, w + 0.2, 0.05, 0.12, trim));
}
// a painted sign board with a frame and pale "lettering"
function wSign(g, axis, a, y, f, w, h, color, letters = 5, ink = CREAM) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, y, f + s * 0.02, w + 0.12, h + 0.12, 0.04, WOOD_D));
  g.add(onWall(axis, a, y + 0.06, f + s * 0.05, w, h, 0.03, color));
  const lw = (w - 0.3) / letters;
  for (let i = 0; i < letters; i++) g.add(onWall(axis, a - (w - 0.3) / 2 + lw * (i + 0.5), y + h * 0.3, f + s * 0.07, lw * 0.66, h * 0.45, 0.02, ink, { emissive: ink, night: 1.4 }));
}
// a false-front building: a timber box with a pitched roof behind a tall square facade that
// hides it, a cornice along the top, a sign, and boards on the walls. Returns the facade top.
function falseFront(g, { x = 0, z = 0, w, d, h, fh = 0.9, color = WOOD, sign = WOOD_D, letters = 5, roof = SHINGLE, cornice = true }) {
  g.add(box(w + 0.2, 0.25, d + 0.2, 0x7a6a55, x, 0, z));                                       // stone footing
  g.add(box(w, h, d, color, x, 0.25, z));
  battens(g, x, z, w, d, 0.25, h, color);
  // a low pitched roof running back from the facade
  const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.12, 0); sh.lineTo(w / 2 + 0.12, 0); sh.lineTo(0, 0.6); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: d - 0.1, bevelEnabled: false }); rg.translate(0, 0, -(d - 0.1) / 2);
  const r = mesh(rg, roof); r.position.set(x, 0.25 + h, z - 0.05); g.add(r);
  // the facade, standing proud of the roof, with a stepped top
  const fy = 0.25 + h, f = z + d / 2;
  g.add(box(w + 0.12, fh, 0.14, color, x, fy, f - 0.05));
  g.add(box(w * 0.5, 0.3, 0.14, color, x, fy + fh, f - 0.05));
  if (cornice) { g.add(box(w + 0.3, 0.1, 0.3, TRIM, x, fy + fh - 0.05, f + 0.02), box(w * 0.5 + 0.2, 0.08, 0.28, TRIM, x, fy + fh + 0.28, f + 0.01)); for (let k = 0; k < 6; k++) g.add(box(0.08, 0.14, 0.12, TRIM, x - w / 2 + 0.2 + k * (w - 0.4) / 5, fy + fh - 0.19, f + 0.04)); }
  wSign(g, 'z', x, fy + 0.12, f + 0.02, Math.min(w - 0.5, 2.6), fh - 0.35, sign, letters);
  return fy + fh + 0.3;
}
// a covered porch / boardwalk along a wall: a plank deck, posts, a sloping shed roof
function porch(g, { axis = 'z', a = 0, f, len, depth = 0.9, h = 1.6, color = WOOD_D, rail = true }) {
  const s = Math.sign(f) || 1, P = (along, out, y, bw, bh, bd, c) => axis === 'z' ? box(bw, bh, bd, c, a + along, y, f + s * out) : box(bd, bh, bw, c, f + s * out, y, a + along);
  g.add(P(0, depth / 2, 0.12, len, 0.12, depth, 0x8a6a45));
  for (let k = 0; k < Math.round(len / 0.3); k++) g.add(P(-len / 2 + 0.15 + k * 0.3, depth / 2, 0.245, 0.02, 0.01, depth, 0x6e5232));
  const n = Math.max(2, Math.round(len / 1.3));
  for (let i = 0; i <= n; i++) g.add(P(-len / 2 + 0.06 + (len - 0.12) * i / n, depth - 0.06, 0.24, 0.1, h - 0.1, 0.1, color));
  const roof = P(0, depth / 2, h + 0.1, len + 0.2, 0.06, depth + 0.25, SHINGLE); if (axis === 'z') roof.rotation.x = 0.16 * s; else roof.rotation.z = -0.16 * s; g.add(roof);
  g.add(P(0, depth - 0.06, h, len, 0.1, 0.1, color));
  if (rail) for (const side of [-1, 1]) { g.add(P(side * len / 2 * 0.75, depth - 0.06, 0.62, len * 0.25, 0.06, 0.05, color)); }
}
// a balcony with a railing of spindles at height y along a wall
function balcony(g, { axis = 'z', a = 0, f, len, y, depth = 0.7, color = WOOD_D }) {
  const s = Math.sign(f) || 1, P = (along, out, yy, bw, bh, bd, c) => axis === 'z' ? box(bw, bh, bd, c, a + along, yy, f + s * out) : box(bd, bh, bw, c, f + s * out, yy, a + along);
  g.add(P(0, depth / 2, y, len, 0.1, depth, 0x8a6a45));
  g.add(P(0, depth - 0.04, y + 0.55, len, 0.06, 0.06, color));
  for (let k = 0; k <= Math.round(len / 0.18); k++) g.add(P(-len / 2 + k * 0.18, depth - 0.04, y + 0.1, 0.03, 0.45, 0.03, CREAM));
}
const barrel = (g, x, z, y = 0.15, s = 1) => { g.add(cyl(0.2 * s, 0.17 * s, 0.5 * s, 0x8a5a32, x, y, z, 12)); for (const k of [0.12, 0.38]) g.add(cyl(0.205 * s, 0.205 * s, 0.04 * s, 0x3a3f48, x, y + k * s, z, 12)); };
const hay = (g, x, z, y = 0.15, ry = 0) => { const b = box(0.7, 0.36, 0.42, HAY, x, y, z); b.rotation.y = ry; g.add(b); const t = box(0.72, 0.03, 0.44, 0xc9a24a, x, y + 0.16, z); t.rotation.y = ry; g.add(t); };
const crate = (g, x, z, y = 0.15, s = 0.4) => { g.add(box(s, s, s, 0xb88a5a, x, y, z)); g.add(box(s + 0.02, 0.05, s + 0.02, 0x7a5a3a, x, y + s * 0.5, z)); };
// a spoked wooden wheel standing up, facing along x
function wheel(g, x, y, z, r = 0.38, ry = 0) {
  const w = new THREE.Group();
  w.add(mesh(new THREE.TorusGeometry(r, 0.05, 6, 18), 0x5a3e26));
  for (let k = 0; k < 6; k++) { const sp = box(0.04, r * 2, 0.04, 0x7a5a3a, 0, -r, 0); sp.rotation.z = (k / 6) * Math.PI; w.add(sp); }
  w.add(cyl(0.08, 0.08, 0.1, 0x3a2a1a, 0, -0.05, 0, 8).rotateX(Math.PI / 2));
  w.position.set(x, y, z); w.rotation.y = ry; g.add(w); return w;
}
// a hitching rail with a water trough
function hitchRail(g, x, z, len = 1.4, alongX = true) {
  for (const e of [-1, 1]) g.add(box(0.08, 0.75, 0.08, WOOD_D, x + (alongX ? e * len / 2 : 0), 0.15, z + (alongX ? 0 : e * len / 2)));
  g.add(alongX ? box(len + 0.1, 0.07, 0.07, WOOD_D, x, 0.85, z) : box(0.07, 0.07, len + 0.1, WOOD_D, x, 0.85, z));
  g.add(alongX ? box(len * 0.7, 0.28, 0.32, 0x6e5232, x, 0.15, z + 0.35) : box(0.32, 0.28, len * 0.7, 0x6e5232, x + 0.35, 0.15, z));
  g.add(alongX ? box(len * 0.66, 0.02, 0.26, 0x4a7aa8, x, 0.4, z + 0.35) : box(0.26, 0.02, len * 0.66, 0x4a7aa8, x + 0.35, 0.4, z));
}
// a horse standing, facing +x (turn it with ry)
function horse(g, x, z, ry = 0, coat = 0x7a4a2a) {
  const h = new THREE.Group(), dark = shade(coat, -0.35);
  h.add(box(0.75, 0.32, 0.26, coat, 0, 0.55, 0));
  for (const [lx, lz] of [[-0.28, -0.08], [-0.28, 0.08], [0.28, -0.08], [0.28, 0.08]]) h.add(box(0.07, 0.56, 0.07, lx > 0 ? coat : dark, lx, 0, lz));
  const neck = box(0.16, 0.42, 0.18, coat, 0.36, 0.72, 0); neck.rotation.z = -0.6; h.add(neck);
  const head = box(0.34, 0.14, 0.15, coat, 0.6, 0.98, 0); head.rotation.z = -0.35; h.add(head);
  h.add(box(0.06, 0.32, 0.06, dark, 0.4, 0.82, 0));                           // mane
  const tail = box(0.06, 0.36, 0.06, dark, -0.4, 0.4, 0); tail.rotation.z = -0.3; h.add(tail);
  h.add(box(0.3, 0.06, 0.3, 0x5a2a1a, 0, 0.87, 0));                            // saddle blanket
  h.position.set(x, 0.15, z); h.rotation.y = ry; g.add(h); return h;
}
// a wooden water tower on legs: a banded barrel tank with a conical lid and a spout
function waterTower(g, x, z, h = 2.4, r = 0.65) {
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(g, [x + dx * r * 1.05, 0.15, z + dz * r * 1.05], [x + dx * r * 0.75, h, z + dz * r * 0.75], 0.06, WOOD_D);
  for (const y of [h * 0.35, h * 0.7]) { g.add(box(r * 1.9, 0.06, 0.06, WOOD_D, x, y, z + r * 0.9), box(0.06, 0.06, r * 1.9, WOOD_D, x + r * 0.9, y, z)); }
  g.add(box(r * 2.2, 0.1, r * 2.2, 0x6e5232, x, h, z));
  g.add(cyl(r, r * 1.04, r * 1.5, 0x9a6b42, x, h + 0.1, z, 16));
  for (const k of [0.2, 0.55, 0.9]) g.add(cyl(r * 1.05, r * 1.05, 0.05, 0x3a3f48, x, h + 0.1 + r * 1.5 * k, z, 16));
  const lid = mesh(new THREE.ConeGeometry(r * 1.1, r * 0.55, 16), SHINGLE); lid.position.set(x, h + 0.1 + r * 1.5 + r * 0.27, z); g.add(lid);
  const spout = box(0.08, 0.08, r * 1.2, 0x3a3f48, x + r * 0.7, h + 0.4, z + r * 0.6); spout.rotation.x = 0.6; g.add(spout);
  return h + 0.1 + r * 2.05;
}
// a farm windmill: a tapering lattice tower, a fan of blades and a tail vane. Returns the rotor.
function windmill(g, x, z, h = 4, r = 0.75, color = 0x8a6a45) {
  const b = 0.55, t = 0.12;
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(g, [x + dx * b, 0.15, z + dz * b], [x + dx * t, h, z + dz * t], 0.035, color);
  for (let k = 1; k < 5; k++) { const f = k / 5, w = b + (t - b) * f, y = 0.15 + (h - 0.15) * f; g.add(box(w * 2, 0.04, 0.04, color, x, y, z + w), box(0.04, 0.04, w * 2, color, x + w, y, z)); }
  const head = new THREE.Group(); head.position.set(x, h + 0.05, z);
  head.add(box(0.5, 0.14, 0.14, 0x3a3f48, 0, 0, 0));
  const vane = box(0.05, 0.38, 0.6, 0xb5532a, -0.55, -0.05, 0); vane.rotation.y = Math.PI / 2; head.add(vane);
  head.add(box(0.6, 0.04, 0.04, 0x3a3f48, -0.3, 0.05, 0));
  const rotor = new THREE.Group(); rotor.position.set(0.3, 0.06, 0);
  for (let k = 0; k < 14; k++) { const bl = box(0.04, r, 0.14, k % 2 ? 0xd8d2c4 : 0xb5532a, 0, 0.12, 0); bl.rotation.y = 0.35; const arm = new THREE.Group(); arm.add(bl); arm.rotation.x = (k / 14) * Math.PI * 2; rotor.add(arm); }
  rotor.add(mesh(new THREE.TorusGeometry(r * 0.75, 0.025, 4, 24), 0x3a3f48).rotateY(Math.PI / 2));
  head.add(rotor); head.rotation.y = -0.7; g.add(head);
  return rotor;
}
// a timber tower (derrick or headframe): four legs leaning in, girts and X braces
function timberTower(g, x, z, b, t, h, color = WOOD, levels = 5) {
  const leg = (dx, dz, f) => [x + dx * (b + (t - b) * f), 0.15 + (h - 0.15) * f, z + dz * (b + (t - b) * f)];
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) rod(g, leg(dx, dz, 0), leg(dx, dz, 1), 0.06, color);
  for (let k = 1; k <= levels; k++) {
    const f0 = (k - 1) / levels, f1 = k / levels;
    for (const [a, c] of [[[-1, 1], [1, 1]], [[1, -1], [1, 1]], [[-1, -1], [1, -1]], [[-1, -1], [-1, 1]]]) {
      rod(g, leg(a[0], a[1], f1), leg(c[0], c[1], f1), 0.035, color);
      rod(g, leg(a[0], a[1], f0), leg(c[0], c[1], f1), 0.025, shade(color, -0.15));
    }
  }
}

Object.assign(BUILDERS, {
  // ---- Gold Mine: a tall timber headframe with a turning sheave wheel over the shaft, a
  // false-front hoist house, ore carts rolling out on rails to a tailings heap
  goldmine(color) {
    const g = new THREE.Group(), c = core(g);
    // the headframe over the shaft
    const hx = -1.35, hz = -1.2, H = 4.6;
    c.add(box(1.5, 0.2, 1.5, 0x5a4632, hx, 0.05, hz));
    c.add(box(0.9, 0.04, 0.9, 0x1a1410, hx, 0.25, hz));
    timberTower(c, hx, hz, 0.75, 0.32, H, WOOD, 4);
    rod(c, [hx + 1.6, 0.15, hz], [hx + 0.2, H - 0.2, hz], 0.07, WOOD);   // the back leg bracing toward the hoist
    c.add(box(0.8, 0.12, 0.8, WOOD_D, hx, H, hz));
    const sheave = new THREE.Group();
    sheave.add(mesh(new THREE.TorusGeometry(0.42, 0.05, 6, 20), 0x3a3f48));
    for (let k = 0; k < 6; k++) { const sp = box(0.04, 0.84, 0.04, 0x5a5f66, 0, -0.42, 0); sp.rotation.z = k * Math.PI / 3; sheave.add(sp); }
    sheave.position.set(hx, H + 0.55, hz); sheave.rotation.y = Math.PI / 2; c.add(sheave);
    rod(c, [hx, H + 0.55, hz + 0.42], [hx + 2.5, 1.4, hz + 0.42], 0.02, 0x2a2d33);           // the cable to the hoist
    // the hoist house: a false front with "MINE" sign
    falseFront(c, { x: 1.85, z: -1.4, w: 2.1, d: 1.7, h: 1.5, fh: 0.8, color: GREY, sign: color, letters: 4 });
    wWin(c, 'x', -1.4, 0.75, 2.9, 0.5, 0.55);
    const stack = [[2.5, -2.2]]; for (const [sx, sz] of stack) { c.add(cyl(0.12, 0.14, 1.4, 0x3a3f48, sx, 2.1, sz, 10)); }
    // rails from the shaft out to the tailings, with a cart that rolls along them
    for (const dz of [-0.22, 0.22]) c.add(box(3.6, 0.05, 0.05, 0x5a5f66, 0.2, 0.17, 1.6 + dz));
    for (let k = 0; k < 12; k++) c.add(box(0.12, 0.04, 0.62, 0x6e5232, -1.55 + k * 0.32, 0.14, 1.6));
    const cart = new THREE.Group();
    cart.add(box(0.6, 0.32, 0.42, 0x6a4a32, 0, 0.12, 0), box(0.62, 0.05, 0.44, 0x3a3f48, 0, 0.42, 0));
    const ore = mesh(new THREE.DodecahedronGeometry(0.22, 0), 0xc9a24a, { flatShading: true, metalness: 0.4, roughness: 0.4 }); ore.scale.y = 0.5; ore.position.set(0, 0.47, 0); cart.add(ore);
    for (const [wx, wz] of [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.22], [0.2, 0.22]]) cart.add(cyl(0.08, 0.08, 0.04, 0x2a2d33, wx, 0.08, wz, 10).rotateX(Math.PI / 2));
    cart.position.set(0, 0.15, 1.6); c.add(cart);
    const heap = mesh(new THREE.ConeGeometry(1.0, 0.9, 9), 0xa88a62, { flatShading: true }); heap.position.set(2.55, 0.6, 1.9); g.add(heap);
    barrel(g, -2.8, 2.6); barrel(g, -2.4, 2.8); crate(g, -2.7, 2.1);
    for (const [px, pz] of [[0.2, -3.5], [0.9, -3.5]]) { g.add(box(1.2, 0.12, 0.12, WOOD_L, px, 0.15, pz)); g.add(box(1.2, 0.12, 0.12, WOOD_L, px, 0.27, pz + 0.14)); }   // pit props
    return { group: g, top: (H + 1.2) * S, anim(t) { sheave.rotation.z = t * 1.6; cart.position.x = -1.2 + ((Math.sin(t * 0.45) + 1) / 2) * 3.0; } };
  },

  // ---- Stamp Mill: a tall stepped timber mill on stilts, its row of iron stamps thumping
  // up and down, a brick smokestack, and a wooden water flume on a trestle
  stampmill(color) {
    const g = new THREE.Group(), c = core(g);
    // three stepped sheds, tallest at the back
    for (const [x, z, w, d, h] of [[-0.8, -1.5, 3.6, 1.3, 3.6], [-0.6, -0.4, 3.2, 1.1, 2.6], [-0.4, 0.6, 2.8, 1.0, 1.7]]) {
      c.add(box(w, h, d, GREY, x, 0.15, z)); battens(c, x, z, w, d, 0.15, h, GREY);
      const r = box(w + 0.2, 0.08, d + 0.3, color, x, 0.15 + h, z - 0.05); r.rotation.x = -0.18; c.add(r);
      wWin(c, 'z', x - w / 3, h - 0.75, z + d / 2, 0.42, 0.42, TRIM, WARM); wWin(c, 'z', x + w / 3, h - 0.75, z + d / 2, 0.42, 0.42, TRIM, WARM);
    }
    // the stamp battery out front: a frame, a camshaft, and five stamps rising and falling
    const bx = -0.4, bz = 1.45;
    c.add(box(2.4, 0.4, 0.6, 0x5a4632, bx, 0.15, bz));
    for (const e of [-1.15, 1.15]) c.add(box(0.14, 2.2, 0.14, WOOD_D, bx + e, 0.15, bz));
    c.add(box(2.5, 0.16, 0.16, WOOD_D, bx, 2.3, bz));
    c.add(cyl(0.06, 0.06, 2.3, 0x3a3f48, bx, 1.75 - 1.15, bz + 0.2, 8).rotateZ(Math.PI / 2));
    const stamps = [];
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Group();
      s.add(box(0.07, 1.6, 0.07, 0x5a5f66, 0, 0, 0), box(0.2, 0.22, 0.2, 0x3a3f48, 0, -0.05, 0), box(0.16, 0.08, 0.16, 0x6a6e76, 0, 1.2, 0));
      s.position.set(bx - 0.8 + k * 0.4, 0.55, bz); c.add(s); stamps.push(s);
    }
    // the smokestack and the flume bringing water in on a trestle
    const smoke = [];
    c.add(box(0.6, 0.5, 0.6, BRICK, 2.3, 0.15, -2.2)); c.add(cyl(0.22, 0.28, 4.6, BRICK, 2.3, 0.65, -2.2, 12)); c.add(cyl(0.3, 0.3, 0.16, 0x3a3f48, 2.3, 5.2, -2.2, 12));
    smoke.push(new THREE.Vector3(2.3, 5.4, -2.2));
    for (let k = 0; k < 4; k++) { const x = 2.6, z = 2.4 - k * 1.0, y = 1.3 + k * 0.45; c.add(box(0.08, y, 0.08, WOOD_D, x - 0.2, 0.15, z), box(0.08, y, 0.08, WOOD_D, x + 0.2, 0.15, z)); }
    const flume = box(0.35, 0.22, 4.0, WOOD_L, 2.6, 2.4, 0.9); flume.rotation.x = -0.23; c.add(flume);
    const water = box(0.25, 0.02, 4.0, 0x4a8ac8, 2.6, 2.58, 0.9, { emissive: 0x2a5a8a, emissiveIntensity: 0.2 }); water.rotation.x = -0.23; c.add(water);
    hay(g, -2.6, 2.6, 0.15, 0.3); barrel(g, 1.3, 2.7); barrel(g, 0.9, 2.85);
    smoke.forEach(v => v.multiplyScalar(S));
    return { group: g, top: 5.6 * S, smoke, anim(t) { stamps.forEach((s, i) => { const p = (t * 1.4 + i * 0.37) % 1; s.position.y = 0.55 + (p < 0.75 ? p / 0.75 : 1 - (p - 0.75) / 0.25) * 0.4; }); } };
  },

  // ---- Frontier Bank: a solid two-storey bank painted slate blue, with a corner entrance,
  // white columns and trim, a gilded BANK sign, barred windows and a balcony
  bank(color) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.3, z = -0.3, w = 3.8, d = 3.0, h = 2.9;
    c.add(box(w + 0.24, 0.3, d + 0.24, 0x8a7a65, x, 0, z));
    c.add(box(w, h, d, color, x, 0.3, z));
    // horizontal clapboards on the visible faces
    for (let y = 0.45; y < h + 0.2; y += 0.2) { c.add(onWall('z', x, y, z + d / 2, w, 0.025, 0.02, shade(color, -0.2))); c.add(onWall('x', z, y, x + w / 2, d, 0.025, 0.02, shade(color, -0.2))); }
    // a stepped false front with a big gilded sign
    c.add(box(w + 0.1, 0.9, 0.16, color, x, 0.3 + h, z + d / 2 - 0.05), box(w * 0.45, 0.35, 0.16, color, x, 1.2 + h, z + d / 2 - 0.05));
    c.add(box(w + 0.3, 0.12, 0.3, TRIM, x, 1.15 + h, z + d / 2), box(w * 0.45 + 0.2, 0.1, 0.28, TRIM, x, 1.53 + h, z + d / 2));
    wSign(c, 'z', x, h + 0.42, z + d / 2 + 0.02, 2.0, 0.55, 0x2a2d33, 4, 0xe8c46a);
    // windows with bars, two floors, front and side
    for (const a of [-1.2, 0.6]) for (const y of [0.85, 2.15]) { wWin(c, 'z', x + a, y, z + d / 2, 0.55, 0.7); if (y < 1) for (let k = 0; k < 4; k++) c.add(onWall('z', x + a - 0.2 + k * 0.13, y, z + d / 2 + 0.07, 0.03, 0.7, 0.03, 0x2a2d33)); }
    for (const a of [-0.8, 0.5]) for (const y of [0.85, 2.15]) wWin(c, 'x', z + a, y, x + w / 2, 0.55, 0.7);
    // the entrance: a cut corner with double doors under a little pediment and columns
    c.add(onWall('z', x + 1.55, 0.3, z + d / 2, 0.8, 1.4, 0.06, 0x3a2a1e));
    c.add(onWall('z', x + 1.55, 0.3, z + d / 2 + 0.04, 0.03, 1.4, 0.04, 0xc9a24a));
    for (const e of [-0.55, 0.55]) c.add(cyl(0.08, 0.09, 1.5, TRIM, x + 1.55 + e, 0.3, z + d / 2 + 0.25, 10));
    c.add(box(1.4, 0.12, 0.45, TRIM, x + 1.55, 1.8, z + d / 2 + 0.15));
    c.add(box(1.0, 0.14, 0.5, 0x8a7a65, x + 1.55, 0.15, z + d / 2 + 0.3), box(1.0, 0.14, 0.3, 0x8a7a65, x + 1.55, 0.29, z + d / 2 + 0.2));
    balcony(c, { axis: 'x', a: z - 0.15, f: x + w / 2, len: 2.2, y: 1.75 });
    // a lamp by the door, a hitching rail and a strongbox wagon waiting out front
    c.add(box(0.12, 0.2, 0.12, 0xfff1cf, x + 0.75, 1.75, z + d / 2 + 0.05, { emissive: 0xffd28a, night: 2.4 }));
    hitchRail(g, -2.5, 2.4, 1.2); horse(g, -2.6, 2.05, 0.1, 0x3a2a1e);
    barrel(g, 2.5, -2.5); crate(g, 2.75, -2.1);
    return { group: g, top: (h + 2.2) * S };
  },

  // ---- General Store: a green false front with DRY GOODS signs, a deep porch stacked
  // with barrels, sacks and crates, a ramp, and a wagon wheel leaning by the steps
  genstore(color) {
    const g = new THREE.Group(), c = core(g);
    const top = falseFront(c, { x: -0.35, z: -0.6, w: 3.6, d: 2.6, h: 2.0, fh: 1.0, color, sign: 0x2a3a2a, letters: 7 });
    for (const a of [-1.2, 0.5]) wWin(c, 'z', -0.35 + a, 0.85, 0.7, 0.7, 0.9, TRIM, WARM);
    c.add(onWall('z', -0.05 + 0.6, 0.25, 0.7, 0.75, 1.45, 0.05, 0x3a2a1e));
    wSign(c, 'z', -1.25, 1.95, 0.7, 1.0, 0.28, 0xb5532a, 4);
    wSign(c, 'z', 0.55, 1.95, 0.7, 1.0, 0.28, 0x2a2d33, 4);
    wWin(c, 'x', -0.9, 0.85, 1.45, 0.55, 0.7); wWin(c, 'x', 0.2, 0.85, 1.45, 0.55, 0.7);
    porch(c, { axis: 'z', a: -0.35, f: 0.7, len: 3.6, depth: 1.0, h: 1.75, color: TRIM });
    for (const [bx, bz] of [[-1.9, 1.35], [-1.55, 1.45], [1.15, 1.4]]) barrel(c, bx, bz, 0.25);
    for (const [cx, cz] of [[-1.1, 1.45]]) { crate(c, cx, cz, 0.25); crate(c, cx, cz, 0.65, 0.34); }
    for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(0.17, 8, 6), 0xd8c49a); s.scale.set(1, 0.75, 0.8); s.position.set(0.95 + k * 0.08, 0.38 + (k === 2 ? 0.2 : 0), 1.25 + (k % 2) * 0.12); c.add(s); }
    const ramp = box(0.9, 0.06, 1.1, 0x8a6a45, 2.1, 0.2, 0.0); ramp.rotation.z = -0.12; c.add(ramp);
    wheel(c, 1.7, 0.53, 1.75, 0.38, 0.4);
    // a delivery wagon out back and a woodpile
    for (let k = 0; k < 4; k++) g.add(cyl(0.09, 0.09, 1.0, 0x8a6a45, 2.6, 0.24 + Math.floor(k / 2) * 0.17 - 0.5, -2.0 + (k % 2) * 0.2, 7).rotateZ(Math.PI / 2));
    hay(g, 2.6, -2.7, 0.15, 0.2); barrel(g, -2.75, -2.6);
    return { group: g, top: (top + 0.6) * S };
  },

  // ---- Livery Stable: a big barn-fronted stable with tall double doors, a hay loft with a
  // pulley beam, a split-rail corral with horses, hay bales and a water trough
  livery(color) {
    const g = new THREE.Group(), c = core(g);
    const top = falseFront(c, { x: -0.6, z: -0.9, w: 3.6, d: 2.8, h: 2.5, fh: 1.1, color, sign: 0xb5532a, letters: 7 });
    // big double doors with Z-braces, and the loft door above with a hay-hoist beam
    for (const e of [-0.45, 0.45]) { c.add(onWall('z', -0.6 + e, 0.25, 0.5, 0.86, 1.75, 0.06, shade(color, -0.12))); const zb = onWall('z', -0.6 + e, 1.0, 0.56, 0.08, 1.6, 0.03, TRIM); zb.rotation.z = e > 0 ? 0.45 : -0.45; c.add(zb); c.add(onWall('z', -0.6 + e, 0.35, 0.56, 0.8, 0.07, 0.03, TRIM), onWall('z', -0.6 + e, 1.9, 0.56, 0.8, 0.07, 0.03, TRIM)); }
    c.add(onWall('z', -0.6, 2.15, 0.5, 0.7, 0.55, 0.06, 0x3a2a1e));
    c.add(box(0.12, 0.12, 0.8, WOOD_D, -0.6, 2.85, 0.75)); rod(c, [-0.6, 2.85, 1.12], [-0.6, 1.9, 1.12], 0.015, 0x3a3020);
    hay(c, -0.6, 1.0, 1.75, 0);
    wWin(c, 'x', -1.6, 1.1, 1.2, 0.5, 0.5); wWin(c, 'x', -0.2, 1.1, 1.2, 0.5, 0.5);
    // the corral: split rails round the front-right corner with two horses
    const cx0 = 1.75, cx1 = 3.6, cz0 = 1.2, cz1 = 3.6;
    for (const [x0, z0, x1, z1] of [[cx0, cz1, cx1, cz1], [cx1, cz0, cx1, cz1], [cx0, cz0, cx0, cz1]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 0.75);
      for (let k = 0; k <= n; k++) g.add(box(0.08, 0.8, 0.08, WOOD_D, x0 + (x1 - x0) * k / n, 0.15, z0 + (z1 - z0) * k / n));
      for (const y of [0.45, 0.78]) g.add(x0 === x1 ? box(0.06, 0.06, len, 0x8a6a45, x0, y, (z0 + z1) / 2) : box(len, 0.06, 0.06, 0x8a6a45, (x0 + x1) / 2, y, z0));
    }
    const h1 = horse(g, 2.3, 2.6, 0.6, 0x7a4a2a), h2 = horse(g, 3.0, 1.8, 2.3, 0xd8c8b0);
    hitchRail(g, 2.7, 3.15, 0.9);
    hay(g, -3.2, 2.9, 0.15, 0.4); hay(g, -3.1, 3.5, 0.15, 0.1); hay(g, -3.15, 3.2, 0.51, 0.25);
    barrel(g, 2.7, -2.6); wheel(g, 2.75, 0.53, -1.9, 0.38, 0);
    return { group: g, top: (top + 0.6) * S, anim(t) { h1.rotation.y = 0.6 + Math.sin(t * 0.3) * 0.25; h2.position.x = 3.0 + Math.sin(t * 0.25) * 0.25; } };
  },

  // ---- Railroad Depot: a long station under a wide bracketed roof, a plank platform, a
  // track with a little steam locomotive shuffling back and forth, and a water tower
  depot(color) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.5, z = -1.5, w = 4.0, d = 1.7, h = 1.8;
    c.add(box(w + 0.2, 0.25, d + 0.2, 0x7a6a55, x, 0, z));
    c.add(box(w, h, d, color, x, 0.25, z)); battens(c, x, z, w, d, 0.25, h, color);
    c.add(box(w, 0.12, d, CREAM, x, 0.25 + h * 0.45, z));
    // a wide hipped roof hanging well out over the platform, on brackets
    const roof = mesh(new THREE.ConeGeometry(1, 1, 4, 1), SHINGLE); roof.rotation.y = Math.PI / 4; roof.scale.set((w + 0.9) / 1.41, 0.8, (d + 1.3) / 1.41); roof.position.set(x, 0.25 + h + 0.4, z + 0.15); c.add(roof);
    for (const a of [-1.6, -0.5, 0.6, 1.7]) { const br = box(0.08, 0.08, 0.7, WOOD_D, x + a, 0.25 + h - 0.15, z + d / 2 + 0.3); br.rotation.x = 0.6; c.add(br); }
    for (const a of [-1.3, 0.3, 1.4]) wWin(c, 'z', x + a, 0.75, z + d / 2, 0.5, 0.8, TRIM, WARM);
    c.add(onWall('z', x - 0.5, 0.25, z + d / 2, 0.6, 1.3, 0.05, 0x3a2a1e));
    wSign(c, 'z', x + 0.85, h - 0.15, z + d / 2 + 0.02, 1.2, 0.3, 0x2a2d33, 5);
    // the platform and the track running past it
    c.add(box(w + 0.6, 0.18, 0.9, 0x8a6a45, x, 0.15, z + d / 2 + 0.45));
    const tz = 0.75;
    for (let k = 0; k < 22; k++) c.add(box(0.14, 0.06, 0.7, 0x5a4632, -3.2 + k * 0.31, 0.14, tz));
    for (const e of [-0.22, 0.22]) c.add(box(6.6, 0.06, 0.05, 0x8a8f99, 0, 0.2, tz + e));
    // the locomotive: boiler, smokestack, cab, cowcatcher, wheels
    const loco = new THREE.Group();
    loco.add(box(1.7, 0.12, 0.6, 0x2a2d33, 0, 0.32, 0));
    loco.add(cyl(0.28, 0.28, 1.1, 0x2a2d33, 0.2, 0.67 - 0.55, 0, 14).rotateZ(Math.PI / 2));
    loco.add(cyl(0.29, 0.29, 0.06, 0xc9a24a, -0.05, 0.67 - 0.03, 0, 14).rotateZ(Math.PI / 2));
    loco.add(cyl(0.29, 0.29, 0.06, 0xc9a24a, 0.45, 0.67 - 0.03, 0, 14).rotateZ(Math.PI / 2));
    loco.add(cyl(0.16, 0.09, 0.45, 0x2a2d33, 0.6, 0.9, 0, 10), cyl(0.1, 0.1, 0.12, 0xc9a24a, 0.25, 0.93, 0, 10));
    loco.add(box(0.55, 0.6, 0.64, color, -0.6, 0.44, 0), box(0.65, 0.06, 0.72, 0x2a2d33, -0.6, 1.04, 0));
    loco.add(box(0.2, 0.2, 0.05, WARM, -0.55, 0.7, 0.33, { emissive: 0xff9a3a, emissiveIntensity: 0.6 }));
    const cc = box(0.25, 0.25, 0.55, 0xb5532a, 0.95, 0.15, 0); cc.rotation.z = 0.5; loco.add(cc);
    loco.add(box(0.12, 0.12, 0.12, 0xfff1cf, 0.88, 0.75, 0, { emissive: 0xffd28a, night: 3 }));
    for (const wx of [-0.6, -0.1, 0.35, 0.75]) for (const e of [-0.28, 0.28]) loco.add(cyl(wx < 0 ? 0.2 : 0.14, wx < 0 ? 0.2 : 0.14, 0.05, 0xb5532a, wx, wx < 0 ? 0.2 : 0.14, e, 12).rotateX(Math.PI / 2));
    loco.position.set(0, 0.17, tz); c.add(loco);
    // a water tower for the engines and a baggage cart
    waterTower(g, 2.6, -2.5, 2.2, 0.55);
    const cart = [[-2.6, 2.4]]; for (const [cx, cz] of cart) { g.add(box(0.8, 0.08, 0.5, 0x8a6a45, cx, 0.4, cz)); crate(g, cx - 0.15, cz, 0.48, 0.3); barrel(g, cx + 0.2, cz, 0.48, 0.8); for (const e of [-0.3, 0.3]) g.add(cyl(0.16, 0.16, 0.05, 0x5a3e26, cx + e, 0.16 + 0.16, cz + 0.27, 10).rotateX(Math.PI / 2)); }
    return { group: g, top: 4.2 * S, smoke: [new THREE.Vector3(0.6, 1.4, tz).multiplyScalar(S)], anim(t) { loco.position.x = Math.sin(t * 0.25) * 1.2; } };
  },

  // ---- Rocket Ranch: a red barn with white X doors where the rocket is built, a wooden
  // launch tower like an oil derrick, a brass-banded rocket on the pad, and a windmill
  rocketranch(color) {
    const g = new THREE.Group(), c = core(g);
    // the barn (back left): red boards, a gambrel roof, white X-braced doors
    const bx = -1.7, bz = -1.6, bw = 2.2, bd = 2.0, bh = 1.5;
    c.add(box(bw, bh, bd, 0xa8322a, bx, 0.15, bz)); battens(c, bx, bz, bw, bd, 0.15, bh, 0xa8322a);
    const gs = new THREE.Shape(); gs.moveTo(-bw / 2 - 0.1, 0); gs.lineTo(bw / 2 + 0.1, 0); gs.lineTo(bw / 2 - 0.15, 0.55); gs.lineTo(0, 0.95); gs.lineTo(-bw / 2 + 0.15, 0.55); gs.closePath();
    const gg = new THREE.ExtrudeGeometry(gs, { depth: bd + 0.2, bevelEnabled: false }); gg.translate(0, 0, -(bd + 0.2) / 2);
    const gr = mesh(gg, 0xb9b4a8); gr.position.set(bx, 0.15 + bh, bz); c.add(gr);
    c.add(onWall('z', bx, 0.15, bz + bd / 2, 1.2, 1.2, 0.05, 0xa8322a));
    for (const e of [-1, 1]) { const x1 = onWall('z', bx, 0.75, bz + bd / 2 + 0.03, 1.55, 0.08, 0.03, TRIM); x1.rotation.z = e * 0.78; c.add(x1); }
    c.add(onWall('z', bx, 0.15, bz + bd / 2 + 0.03, 1.25, 0.08, 0.03, TRIM), onWall('z', bx, 1.35, bz + bd / 2 + 0.03, 1.25, 0.08, 0.03, TRIM));
    const tri = mesh(new THREE.CircleGeometry(0.28, 3), TRIM); tri.position.set(bx, bh + 0.5, bz + bd / 2 + 0.12); tri.rotation.z = Math.PI / 2; c.add(tri);
    // the launch tower, a timber derrick beside the pad
    const px = 0.7, pz = 0.4;
    c.add(cyl(1.25, 1.35, 0.3, 0x8a7a65, px, 0.15, pz, 20));
    c.add(cyl(1.1, 1.1, 0.03, 0x3a3020, px, 0.45, pz, 20));
    timberTower(c, px - 1.45, pz - 0.2, 0.42, 0.2, 6.6, WOOD, 6);
    for (const y of [2.4, 4.0, 5.6]) { c.add(box(1.05, 0.1, 0.12, WOOD_D, px - 0.95, y, pz - 0.2)); }
    c.add(box(0.12, 0.12, 0.12, 0xff3b2f, px - 1.45, 6.8, pz - 0.2, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    const rocket = buildRocket('retro', color);
    rocket.position.set(px, 0.45, pz); c.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 5; i++) scaffold.add(box(1.5, 0.1, 1.5, 0x8a6a45, px, 0.9 + i * 1.25, pz));
    for (const [dx, dz] of [[-0.7, -0.7], [0.7, 0.7], [-0.7, 0.7], [0.7, -0.7]]) scaffold.add(box(0.1, 6.0, 0.1, WOOD_D, px + dx, 0.45, pz + dz));
    c.add(scaffold);
    // a windmill pumping water and barrels of rocket fuel
    const rotor = windmill(g, 2.6, -2.4, 3.6, 0.6);
    for (const [x, z] of [[2.4, 2.5], [2.8, 2.3], [2.6, 2.85]]) barrel(g, x, z, 0.15, 1.1);
    return { group: g, top: 8.6 * S, rocket, scaffold, anim(t, dt) { rotor.rotation.x += dt * 2.2; } };
  },

  // ---- Windmill Farm: farm windmills on lattice towers turning in the prairie wind, a
  // wooden water tank, and a dynamo shed with its lamp lit
  windmills(color) {
    const g = new THREE.Group(), c = core(g);
    const rotors = [windmill(c, -2.1, -2.0, 5.0, 0.95, color), windmill(c, 1.6, -2.3, 4.2, 0.8, color), windmill(c, -1.9, 1.9, 3.6, 0.7, color), windmill(c, 2.3, 1.2, 3.2, 0.6, color)];
    waterTower(c, -0.2, -0.2, 1.4, 0.7);
    // the dynamo shed
    c.add(box(1.4, 1.1, 1.0, GREY, 0.6, 0.15, 2.4)); battens(c, 0.6, 2.4, 1.4, 1.0, 0.15, 1.1, GREY);
    const r = box(1.6, 0.06, 1.3, TIN, 0.6, 1.3, 2.4); r.rotation.x = 0.2; c.add(r);
    c.add(onWall('z', 0.4, 0.15, 2.9, 0.45, 0.9, 0.04, 0x3a2a1e));
    c.add(box(0.14, 0.14, 0.14, 0xfff1cf, 0.95, 1.0, 2.95, { emissive: 0xffd28a, night: 2.6 }));
    for (const [x, z] of [[-0.5, 2.3], [-0.9, 2.6]]) { c.add(box(0.06, 1.8, 0.06, WOOD_D, x, 0.15, z)); }
    return { group: g, top: 6.0 * S, anim(t, dt) { rotors.forEach((r, i) => { r.rotation.x += dt * (2.4 + i * 0.4); }); } };
  },

  // ---- Telegraph Office: a little false-front office with a bay window, telegraph poles
  // marching off with wires on glass insulators, and a key light blinking in Morse
  telegraph(color) {
    const g = new THREE.Group(), c = core(g);
    const top = falseFront(c, { x: -0.5, z: -0.7, w: 3.0, d: 2.4, h: 1.8, fh: 0.85, color: CREAM, sign: color, letters: 9 });
    // a bay window on the front and a door
    c.add(box(1.1, 1.0, 0.35, CREAM, -1.2, 0.4, 0.65));
    for (const a of [-1.55, -1.2, -0.85]) c.add(onWall('z', a, 0.55, 0.82, 0.28, 0.7, 0.03, WARM, { emissive: 0xff9a3a, emissiveIntensity: 0.5 }));
    c.add(box(1.2, 0.08, 0.45, TRIM, -1.2, 1.4, 0.65));
    c.add(onWall('z', 0.3, 0.25, 0.5, 0.6, 1.3, 0.05, 0x3a2a1e));
    wWin(c, 'x', -1.3, 0.8, 1.0, 0.5, 0.6); wWin(c, 'x', -0.1, 0.8, 1.0, 0.5, 0.6);
    porch(c, { axis: 'x', a: -0.7, f: 1.0, len: 2.2, depth: 0.8, h: 1.5, color: TRIM });
    // the poles: a line of them heading off, each with a crossarm and glass insulators
    const poles = [[-2.7, -2.6], [-1.0, -2.75], [0.8, -2.75], [2.6, -2.6], [2.75, -0.8]];
    const tops = [];
    for (const [px, pz] of poles) {
      g.add(cyl(0.06, 0.08, 3.4, WOOD_D, px, 0.15, pz, 8));
      g.add(box(0.9, 0.08, 0.08, WOOD_D, px, 3.3, pz));
      for (const e of [-0.35, -0.12, 0.12, 0.35]) { g.add(cyl(0.035, 0.03, 0.1, 0x6fd3c0, px + e, 3.38, pz, 6, { transparent: true, opacity: 0.85 })); tops.push([px + e, 3.46, pz]); }
    }
    for (let i = 0; i < poles.length - 1; i++) for (const k of [0, 1, 2, 3]) rod(g, tops[i * 4 + k], tops[(i + 1) * 4 + k], 0.008, 0x2a2d33);
    rod(g, [-2.7 + 0.12, 3.46, -2.6], [-0.9 * S, (top - 0.4) * S, -1.6 * S], 0.01, 0x2a2d33);
    // the key light, blinking messages
    const key = box(0.16, 0.16, 0.16, 0xffe08a, -0.5, top - 0.1, -0.3, { emissive: 0xffc23d, emissiveIntensity: 1 }); key.material = key.material.clone(); c.add(key);
    barrel(g, 2.6, 2.6); crate(g, 2.3, 2.75);
    const code = [1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0];
    return { group: g, top: (top + 0.5) * S, anim(t) { key.material.emissiveIntensity = code[Math.floor(t * 5) % code.length] ? 1.8 : 0.1; } };
  },

  // ---- The Saloon: a two-storey corner saloon with a wraparound balcony on turned posts,
  // swinging batwing doors, a big SALOON sign, horses at the rail and barrels by the door
  saloon(color) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.35, z = -0.45, w = 3.6, d = 3.0, h = 3.0;
    c.add(box(w + 0.24, 0.25, d + 0.24, 0x7a6a55, x, 0, z));
    c.add(box(w, h, d, color, x, 0.25, z)); battens(c, x, z, w, d, 0.25, h, color);
    // a stepped, scalloped false front with the sign
    c.add(box(w + 0.1, 0.8, 0.16, color, x, 0.25 + h, z + d / 2 - 0.05));
    for (const [e, hh] of [[-1, 0.3], [0, 0.55], [1, 0.3]]) c.add(box(w * 0.3, hh, 0.16, color, x + e * w * 0.33, 1.05 + h, z + d / 2 - 0.05));
    c.add(box(w + 0.3, 0.1, 0.3, TRIM, x, 1.0 + h, z + d / 2));
    wSign(c, 'z', x, h + 0.3, z + d / 2 + 0.02, 2.2, 0.55, 0x2a2d33, 6, 0xe8c46a);
    // upstairs windows and the wraparound balcony on turned posts
    for (const a of [-1.2, 0, 1.2]) wWin(c, 'z', x + a, 2.0, z + d / 2, 0.5, 0.75, TRIM, WARM);
    for (const a of [-0.8, 0.5]) wWin(c, 'x', z + a, 2.0, x + w / 2, 0.5, 0.75, TRIM, WARM);
    balcony(c, { axis: 'z', a: x, f: z + d / 2, len: w + 0.4, y: 1.7, depth: 0.85 });
    balcony(c, { axis: 'x', a: z + 0.2, f: x + w / 2, len: d + 0.4, y: 1.7, depth: 0.85 });
    for (const a of [-1.75, -0.6, 0.6, 1.75]) c.add(cyl(0.06, 0.07, 1.5, TRIM, x + a, 0.25, z + d / 2 + 0.8, 8));
    for (const a of [-1.3, 0, 1.3]) c.add(cyl(0.06, 0.07, 1.5, TRIM, x + w / 2 + 0.8, 0.25, z + a, 8));
    c.add(cyl(0.06, 0.07, 1.5, TRIM, x + w / 2 + 0.8, 0.25, z + d / 2 + 0.8, 8));
    c.add(box(w + 0.6, 0.12, 0.95, 0x8a6a45, x + 0.2, 0.12, z + d / 2 + 0.45));                     // the boardwalk
    c.add(box(0.95, 0.12, d + 0.6, 0x8a6a45, x + w / 2 + 0.45, 0.12, z + 0.2));
    // downstairs: big windows, and the batwing doors under a lamp
    for (const a of [-1.3, 1.0]) wWin(c, 'z', x + a, 0.65, z + d / 2, 0.8, 0.85, TRIM, WARM);
    c.add(onWall('z', x - 0.15, 0.25, z + d / 2, 0.9, 1.5, 0.04, 0x1a1410));
    for (const e of [-0.21, 0.21]) c.add(onWall('z', x - 0.15 + e, 0.65, z + d / 2 + 0.06, 0.38, 0.7, 0.04, 0xc29a66));
    c.add(box(0.14, 0.2, 0.14, 0xfff1cf, x - 0.15, 1.6, z + d / 2 + 0.1, { emissive: 0xffd28a, night: 2.6 }));
    for (const a of [-0.3, 0.6]) wWin(c, 'x', z + a, 0.65, x + w / 2, 0.6, 0.8, TRIM, WARM);
    // horses at the rail, barrels and a bench
    hitchRail(g, -2.9, 3.6, 1.3); horse(g, -3.15, 3.25, 0.15, 0x7a4a2a); horse(g, -2.55, 3.3, -0.1, 0x2a2420);
    barrel(g, 2.75, -2.4); barrel(g, 2.45, -2.75); barrel(g, 2.75, -2.85, 0.15, 0.9);
    c.add(box(1.0, 0.08, 0.3, 0x8a6a45, x + 1.3, 0.55, z + d / 2 + 0.25), box(0.06, 0.3, 0.3, 0x6e5232, x + 0.85, 0.25, z + d / 2 + 0.25), box(0.06, 0.3, 0.3, 0x6e5232, x + 1.75, 0.25, z + d / 2 + 0.25));
    return { group: g, top: (h + 2.4) * S };
  },
});

export { balcony, falseFront, porch, wWin, wSign, battens, barrel, hay, crate, wheel, hitchRail, horse, waterTower, windmill, timberTower, WOOD, WOOD_D, WOOD_L, GREY, TRIM, SHINGLE, CREAM };

// ---- out on the range: landmarks scattered round the town (see terrain.js) ----
// Each returns a Group standing on y = 0 with userData.r its rough radius.
function longhorn(g, x, z, ry, coat) {
  const c = horse(g, x, z, ry, coat);
  c.scale.set(1, 0.8, 1.15);
  c.children[c.children.length - 1].visible = false;   // no saddle blanket on a cow
  for (const sd of [-1, 1]) { const h = box(0.04, 0.04, 0.3, 0xeee4cc, 0.62, 1.02, sd * 0.15); h.rotation.x = sd * 0.3; c.add(h); }
  return c;
}
export const RANGE = {
  // a wooden oil derrick with its engine house, a walking-beam pump, and barrels of crude
  derrick(r) {
    const g = new THREE.Group(), h = 6 + r() * 2.5;
    g.add(box(2.2, 0.15, 2.2, 0x6e5232, 0, 0, 0));
    timberTower(g, 0, 0, 0.95, 0.22, h, r() < 0.5 ? WOOD : WOOD_D, 6);
    g.add(box(0.7, 0.18, 0.7, WOOD_D, 0, h, 0), box(0.12, 0.6, 0.12, WOOD_D, 0, h + 0.18, 0));
    g.add(box(0.3, 0.04, 0.3, 0x2a2420, 0, 0.16, 0));
    // the engine house with a smokestack
    g.add(box(1.4, 1.1, 1.0, GREY, 1.9, 0, 0.4)); battens(g, 1.9, 0.4, 1.4, 1.0, 0, 1.1, GREY);
    const rf = box(1.6, 0.06, 1.2, SHINGLE, 1.9, 1.15, 0.4); rf.rotation.x = 0.2; g.add(rf);
    g.add(cyl(0.08, 0.1, 1.3, 0x2a2d33, 2.4, 1.1, 0.1, 8));
    // the walking beam on its samson post
    g.add(box(0.14, 1.2, 0.14, WOOD_D, 0.95, 0, -0.9));
    const beam = box(1.8, 0.12, 0.12, WOOD_D, 0.6, 1.2, -0.9); beam.rotation.z = 0.12; g.add(beam);
    for (const [x, z] of [[-1.3, 1.3], [-1.6, 1.0], [-1.0, 1.55]]) barrel(g, x, z, 0, 0.9);
    const oil = mesh(new THREE.CircleGeometry(0.9, 12), 0x1a1612, { roughness: 0.2 }); oil.rotation.x = -Math.PI / 2; oil.position.set(-1.0, 0.02, -1.0); oil.scale.set(1.3, 1, 0.8); g.add(oil);
    g.userData.r = 2.2; return g;
  },
  // a whitewashed frontier chapel with a steeple, a bell and a cross
  church(r) {
    const g = new THREE.Group(), W = 2.4, D = 3.6, H = 2.0;
    g.add(box(W + 0.2, 0.2, D + 0.2, 0x8a7a65, 0, 0, 0));
    g.add(box(W, H, D, 0xf1ece0, 0, 0.2, 0));
    for (let y = 0.35; y < H + 0.2; y += 0.18) g.add(onWall('x', 0, y, W / 2, D, 0.02, 0.02, 0xd8d0c0), onWall('x', 0, y, -W / 2, D, 0.02, 0.02, 0xd8d0c0));
    const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.15, 0); sh.lineTo(W / 2 + 0.15, 0); sh.lineTo(0, 1.2); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: D + 0.2, bevelEnabled: false }); rg.translate(0, 0, -(D + 0.2) / 2);
    const rf = mesh(rg, 0x5e4c3c); rf.position.y = 0.2 + H; g.add(rf);
    for (const a of [-1, 0, 1]) wWin(g, 'x', a, 0.8, W / 2, 0.35, 0.8, 0xeee4cc, 0x8ab0c8);
    g.add(onWall('z', 0, 0.2, D / 2, 0.7, 1.3, 0.06, 0xa8322a));
    // the steeple: a square tower, an open belfry with a bell, a spire and a cross
    const tz = D / 2 - 0.5;
    g.add(box(0.9, 1.2, 0.9, 0xf1ece0, 0, H + 0.2, tz));
    for (const [dx, dz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) g.add(box(0.1, 0.7, 0.1, 0xf1ece0, dx, H + 1.4, tz + dz));
    g.add(cyl(0.12, 0.2, 0.3, 0xc9a24a, 0, H + 1.6, tz, 10));
    g.add(box(1.0, 0.1, 1.0, 0xeee4cc, 0, H + 2.1, tz));
    const sp = mesh(new THREE.ConeGeometry(0.62, 1.6, 4), 0x5e4c3c); sp.rotation.y = Math.PI / 4; sp.position.set(0, H + 3.0, tz); g.add(sp);
    g.add(box(0.06, 0.6, 0.06, 0xeee4cc, 0, H + 3.8, tz), box(0.32, 0.06, 0.06, 0xeee4cc, 0, H + 4.15, tz));
    // a picket fence and a few wooden grave markers
    for (let k = 0; k < 6; k++) g.add(box(0.06, 0.4, 0.06, 0xeee4cc, -1.6 + k * 0.25, 0, D / 2 + 1.2));
    for (const [x, z] of [[-2.3, -1], [-2.0, 0.2], [-2.6, 0.6]]) { g.add(box(0.07, 0.5, 0.05, WOOD_L, x, 0, z), box(0.3, 0.06, 0.05, WOOD_L, x, 0.35, z)); }
    g.userData.r = 2.6; return g;
  },
  // a big red barn with a gambrel roof, white trim, a hay loft and bales
  barn(r) {
    const g = new THREE.Group(), W = 3.2, D = 4.2, H = 1.9, red = r() < 0.7 ? 0xa8322a : 0x8a6a45;
    g.add(box(W, H, D, red, 0, 0, 0)); battens(g, 0, 0, W, D, 0, H, red);
    const gs = new THREE.Shape(); gs.moveTo(-W / 2 - 0.1, 0); gs.lineTo(W / 2 + 0.1, 0); gs.lineTo(W / 2 - 0.25, 0.75); gs.lineTo(0, 1.3); gs.lineTo(-W / 2 + 0.25, 0.75); gs.closePath();
    const gg = new THREE.ExtrudeGeometry(gs, { depth: D + 0.2, bevelEnabled: false }); gg.translate(0, 0, -(D + 0.2) / 2);
    const gr = mesh(gg, 0x6a6a68); gr.position.y = H; g.add(gr);
    const tri = new THREE.Shape(); tri.moveTo(-W / 2 + 0.1, 0); tri.lineTo(W / 2 - 0.1, 0); tri.lineTo(W / 2 - 0.3, 0.7); tri.lineTo(0, 1.2); tri.lineTo(-W / 2 + 0.3, 0.7); tri.closePath();
    const tg = mesh(new THREE.ShapeGeometry(tri), red); tg.position.set(0, H, D / 2 + 0.02); g.add(tg);
    g.add(onWall('z', 0, 0, D / 2, 1.5, 1.5, 0.05, red));
    for (const e of [-1, 1]) { const x = onWall('z', 0, 0.7, D / 2 + 0.04, 2.0, 0.09, 0.03, TRIM); x.rotation.z = e * 0.78; g.add(x); }
    g.add(onWall('z', 0, 0, D / 2 + 0.04, 1.55, 0.09, 0.03, TRIM), onWall('z', 0, 1.45, D / 2 + 0.04, 1.55, 0.09, 0.03, TRIM));
    g.add(onWall('z', 0, H + 0.2, D / 2 + 0.02, 0.6, 0.55, 0.05, 0x3a2a1e));
    hay(g, -2.1, 1.0, 0, 0.3); hay(g, -2.2, 1.6, 0, 1.2); hay(g, -2.15, 1.3, 0.36, 0.8);
    g.userData.r = 2.6; return g;
  },
  // a settler's log cabin with a stone chimney and a porch
  cabin(r) {
    const g = new THREE.Group(), W = 2.4, D = 1.9;
    for (let k = 0; k < 7; k++) { g.add(cyl(0.13, 0.13, D + 0.25, 0x8a5a32, W / 2, k * 0.24 + 0.13 - (D + 0.25) / 2, 0, 7).rotateX(Math.PI / 2)); g.add(cyl(0.13, 0.13, D + 0.25, 0x8a5a32, -W / 2, k * 0.24 + 0.13 - (D + 0.25) / 2, 0, 7).rotateX(Math.PI / 2)); g.add(cyl(0.13, 0.13, W + 0.25, 0x7a4e2c, 0, k * 0.24 + 0.25 - (W + 0.25) / 2, D / 2, 7).rotateZ(Math.PI / 2)); g.add(cyl(0.13, 0.13, W + 0.25, 0x7a4e2c, 0, k * 0.24 + 0.25 - (W + 0.25) / 2, -D / 2, 7).rotateZ(Math.PI / 2)); }
    g.add(box(W - 0.1, 1.7, D - 0.1, 0x6e4a2c, 0, 0, 0));
    const sh = new THREE.Shape(); sh.moveTo(-W / 2 - 0.3, 0); sh.lineTo(W / 2 + 0.3, 0); sh.lineTo(0, 0.9); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: D + 0.6, bevelEnabled: false }); rg.translate(0, 0, -(D + 0.6) / 2);
    const rf = mesh(rg, SHINGLE); rf.position.y = 1.7; g.add(rf);
    g.add(box(0.5, 2.9, 0.5, 0x8a8478, -W / 2 - 0.2, 0, -0.3), box(0.36, 0.3, 0.36, 0x6a6458, -W / 2 - 0.2, 2.9, -0.3));
    g.add(onWall('z', 0.3, 0.05, D / 2 + 0.13, 0.5, 1.1, 0.05, 0x3a2a1e));
    wWin(g, 'z', -0.55, 0.7, D / 2 + 0.13, 0.4, 0.4, 0xc29a66, WARM);
    g.add(box(0.12, 0.12, 0.12, 0xfff1cf, 0.75, 1.25, D / 2 + 0.2, { emissive: 0xffc070, night: 2.5 }));
    wheel(g, 1.55, 0.4, 0.6, 0.38, 0.3); barrel(g, 1.5, 1.3, 0, 0.8);
    g.userData.r = 1.9; return g;
  },
  // a lone farm windmill over a round stock tank
  windpump(r) {
    const g = new THREE.Group();
    windmill(g, 0, 0, 3.4 + r() * 1.6, 0.6 + r() * 0.25, 0x6e5a48);
    g.add(cyl(1.0, 1.0, 0.4, 0x8a8f99, 1.5, 0, 0.6, 18), cyl(0.94, 0.94, 0.02, 0x4a7aa8, 1.5, 0.36, 0.6, 18));
    g.userData.r = 1.4; return g;
  },
  // a wooden water tower by itself
  tower(r) { const g = new THREE.Group(); waterTower(g, 0, 0, 2.4 + r() * 1.2, 0.7); g.userData.r = 1.3; return g; },
  // a run of split-rail fence, zigzagging across the range
  fence(r) {
    const g = new THREE.Group(), n = 5 + Math.floor(r() * 5);
    for (let k = 0; k < n; k++) {
      const x0 = k * 1.3, z0 = k % 2 ? 0.35 : 0, x1 = x0 + 1.3, z1 = k % 2 ? 0 : 0.35;
      g.add(box(0.08, 0.75, 0.08, WOOD_D, x0, 0, z0));
      for (const y of [0.32, 0.62]) rod(g, [x0, y, z0], [x1, y, z1], 0.035, 0x8a6a45);
    }
    g.add(box(0.08, 0.75, 0.08, WOOD_D, n * 1.3, 0, n % 2 ? 0.35 : 0));
    g.userData.r = 0.4; return g;
  },
  // a few longhorn cattle grazing
  cattle(r) {
    const g = new THREE.Group(), n = 2 + Math.floor(r() * 4);
    for (let k = 0; k < n; k++) longhorn(g, (r() - 0.5) * 4, (r() - 0.5) * 4, r() * 6.3, [0x7a4a2a, 0xd8c8b0, 0x3a2a1e, 0xa86a3a, 0xeee4cc][Math.floor(r() * 5)]);
    g.userData.r = 0.7; return g;
  },
  // an old wagon abandoned in the scrub: tipped bed, a wheel off, bleached boards
  wreck(r) {
    const g = new THREE.Group();
    const bed = box(1.6, 0.35, 0.9, 0x9a8a74, 0, 0.1, 0); bed.rotation.z = 0.25; bed.rotation.x = 0.1; g.add(bed);
    wheel(g, -0.7, 0.4, 0.5, 0.38, 0).rotation.x = 0.2;
    const w2 = wheel(g, 1.2, 0.06, 0.9, 0.38, 0); w2.rotation.set(Math.PI / 2, 0, 0);
    for (let k = 0; k < 3; k++) { const b = box(0.9, 0.05, 0.14, 0xa89a84, -0.4 + k * 0.4, 0, -1.0 + k * 0.1); b.rotation.y = k; g.add(b); }
    g.userData.r = 1.0; return g;
  },
};
