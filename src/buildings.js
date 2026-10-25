// The Colorado buildings, built from a small kit of architectural parts so they read
// as real places: a concrete plinth, walls with piers and a belt course, parapets with
// a light cap, framed windows with sills, roll-up doors, name boards, banded chimneys
// with ladders, tanks, pipes and railings. Static parts are merged per material when the
// building is placed (see bakeModel in world.js), so the extra detail costs few draw calls.
//
// Every builder returns { group, top, anim?, smoke?, steam?, rocket?, scaffold? } like the
// ones in models.js, and replaces the older, plainer version there.
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
import { BUILDERS, box, cyl, mat } from './models.js';

const TRIM = 0xf2f3ed, DARK = 0x2b2f36, STEEL = 0x8a8f99, IRON = 0x5b5f66, HAZ = 0xffc23d, GLASS = 0x9fd6ff, WARM = 0xffb347;
const PLINTH = 0x9fa7ac, ROOF = 0x586579, RED = 0xd9482b, WHITE = 0xf3efe6;
const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  return f > 0 ? c.lerp(new THREE.Color(0xffffff), f).getHex() : c.multiplyScalar(1 + f).getHex();
};
const mesh = (geo, color, opts) => { const m = new THREE.Mesh(geo, mat(color, opts)); m.castShadow = true; m.receiveShadow = true; return m; };
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
// a round bar from point a to point b
function rod(g, a, b, r, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), dir = B.clone().sub(A);
  const m = mesh(new THREE.CylinderGeometry(r, r, dir.length(), 8), color);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  g.add(m); return m;
}

// ---- placing things on a wall ----
// axis 'z': a wall facing +z (the front, toward the camera) at z = f, `a` runs along x.
// axis 'x': a wall facing +x (the right side) at x = f, `a` runs along z.
// (negative f faces the other way: the back or left.)
function onWall(axis, a, y, f, w, h, d, color, opts) {
  const s = Math.sign(f) || 1;
  return axis === 'z' ? box(w, h, d, color, a, y, f + s * d / 2, opts) : box(d, h, w, color, f + s * d / 2, y, a, opts);
}
// a framed window with a mullion and a sill; `lit` windows glow warm at night like the glass in models.js
function win(g, axis, a, y, f, w = 0.8, h = 0.9, frame = DARK, glass = GLASS) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, y - 0.07, f, w + 0.16, h + 0.14, 0.06, frame));
  g.add(onWall(axis, a, y, f + s * 0.03, w, h, 0.05, glass, glass === WARM ? { emissive: 0xff8a1f, emissiveIntensity: 0.6 } : undefined));
  g.add(onWall(axis, a, y, f + s * 0.07, 0.05, h, 0.03, frame));            // mullion
  g.add(onWall(axis, a, y + h * 0.55, f + s * 0.07, w, 0.04, 0.03, frame));  // transom
  g.add(onWall(axis, a, y - 0.14, f, w + 0.3, 0.07, 0.16, TRIM));            // sill
}
// a row of windows, centred on `a0`
function winRow(g, axis, a0, y, f, n, gap, w, h, frame, glass) {
  for (let i = 0; i < n; i++) win(g, axis, a0 + (i - (n - 1) / 2) * gap, y, f, w, h, frame, glass);
}
// a roll-up loading door: frame, slats, a yellow-and-black kerb and a lamp above
function door(g, axis, a, f, w = 1.6, h = 1.8, color = 0x9aa0a8) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, 0, f, w + 0.3, h + 0.18, 0.08, DARK));
  g.add(onWall(axis, a, 0, f + s * 0.04, w, h, 0.05, color));
  for (let k = 1; k < 7; k++) g.add(onWall(axis, a, h * k / 7, f + s * 0.09, w, 0.035, 0.02, shade(color, -0.3)));
  for (const e of [-1, 1]) g.add(onWall(axis, a + e * (w / 2 + 0.08), 0, f + s * 0.1, 0.12, 0.7, 0.12, HAZ));
  g.add(onWall(axis, a, h + 0.3, f, 0.3, 0.12, 0.25, DARK));
  g.add(onWall(axis, a, h + 0.24, f + s * 0.12, 0.22, 0.06, 0.1, 0xfff2c8, { emissive: 0xffd27a, night: 2.4 }));
}
// a plain person-sized door with a little canopy
function sideDoor(g, axis, a, f, color = 0x3a3f48) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, 0, f, 0.75, 1.25, 0.06, color));
  g.add(onWall(axis, a, 1.32, f, 1.0, 0.07, 0.45, DARK));
  g.add(onWall(axis, a, 1.15, f + s * 0.06, 0.12, 0.08, 0.06, 0xfff2c8, { emissive: 0xffd27a, night: 2 }));
}
// a name board: a dark border, the company colour, and pale 'lettering' blocks
function signBoard(g, axis, a, y, f, w, color, letters = 5) {
  const s = Math.sign(f) || 1, o = f + s * 0.13;   // it stands off the wall on two brackets
  for (const e of [-1, 1]) g.add(onWall(axis, a + e * (w / 2 - 0.3), y + 0.2, f, 0.08, 0.2, 0.14, IRON));
  g.add(onWall(axis, a, y, o, w, 0.62, 0.08, DARK));
  g.add(onWall(axis, a, y + 0.06, o + s * 0.05, w - 0.12, 0.5, 0.04, color));
  const lw = (w - 0.6) / letters;
  for (let i = 0; i < letters; i++) g.add(onWall(axis, a - (w - 0.6) / 2 + lw * (i + 0.5), y + 0.17, o + s * 0.08, lw * 0.7, 0.26, 0.02, 0xfffbef, { emissive: 0xfff3d0, night: 1.6 }));
}
// a wall ladder with a safety cage hint
function ladder(g, axis, a, f, y0, h) {
  const s = Math.sign(f) || 1;
  for (const e of [-0.17, 0.17]) g.add(onWall(axis, a + e, y0, f, 0.05, h, 0.05, IRON));
  for (let y = y0 + 0.25; y < y0 + h; y += 0.3) g.add(onWall(axis, a, y, f + s * 0.01, 0.34, 0.03, 0.04, IRON));
}
// railing along a line at height y
function railing(g, x0, z0, x1, z1, y, color = HAZ) {
  const len = Math.hypot(x1 - x0, z1 - z0), n = Math.max(2, Math.round(len / 0.7));
  const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0);
  for (let i = 0; i <= n; i++) { const t = i / n; g.add(box(0.05, 0.5, 0.05, color, x0 + (x1 - x0) * t, y, z0 + (z1 - z0) * t)); }
  g.add(alongX ? box(len, 0.05, 0.05, color, (x0 + x1) / 2, y + 0.5, z0) : box(0.05, 0.05, len, color, x0, y + 0.5, (z0 + z1) / 2));
  g.add(alongX ? box(len, 0.04, 0.04, color, (x0 + x1) / 2, y + 0.25, z0) : box(0.04, 0.04, len, color, x0, y + 0.25, (z0 + z1) / 2));
}
// a pipe through a list of points (axis-aligned runs), with round elbows
function pipe(g, pts, r = 0.1, color = 0xb9b4a8) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay, az] = pts[i], [bx, by, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, by - ay, bz - az);
    const m = mesh(new THREE.CylinderGeometry(r, r, len, 10), color);
    m.position.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2);
    if (Math.abs(bx - ax) > 1e-3) m.rotation.z = Math.PI / 2; else if (Math.abs(bz - az) > 1e-3) m.rotation.x = Math.PI / 2;
    g.add(m);
  }
  for (const [x, y, z] of pts.slice(1, -1)) { const e = mesh(new THREE.SphereGeometry(r * 1.15, 10, 8), color); e.position.set(x, y, z); g.add(e); }
  for (const p of [pts[0], pts[pts.length - 1]]) { const f = mesh(new THREE.SphereGeometry(r * 1.3, 8, 6), IRON); f.position.set(...p); f.scale.set(1, 0.35, 1); g.add(f); }
}

// ---- big pieces ----
// a hall: concrete plinth, walls, piers, a belt course near the top, and a flat roof
// behind a capped parapet (or no parapet, for halls that get their own roof)
function hall(g, { x = 0, z = 0, w, d, h, color, piers = 1.25, parapet = true, roof = ROOF, belt = true, pierColor }) {
  const pc = pierColor ?? shade(color, -0.22);
  g.add(box(w + 0.18, 0.32, d + 0.18, PLINTH, x, 0, z));
  g.add(box(w, h, d, color, x, 0.3, z));
  const top = h + 0.3;
  // piers on every wall, at the corners and in between
  for (const [axis, len, f] of [['z', w, z + d / 2], ['z', w, z - d / 2], ['x', d, x + w / 2], ['x', d, x - w / 2]]) {
    const n = Math.max(1, Math.round(len / piers));
    for (let i = 0; i <= n; i++) {
      const a = (axis === 'z' ? x : z) - len / 2 + (len * i) / n;
      const edge = i === 0 || i === n;
      g.add(onWall(axis, a + (edge ? (i === 0 ? 0.11 : -0.11) : 0), 0.3, f, edge ? 0.24 : 0.2, h, 0.08, pc));
    }
  }
  if (belt) g.add(box(w + 0.2, 0.14, d + 0.2, shade(color, -0.32), x, top - 0.55, z));
  if (parapet) {
    g.add(box(w - 0.1, 0.06, d - 0.1, roof, x, top, z));
    // A pale center panel catches the sun, giving each factory a readable miniature roof.
    g.add(box(w - 0.32, 0.035, d - 0.32, shade(roof, 0.14), x, top + 0.06, z));
    for (const [pw, pd, px, pz] of [[w + 0.12, 0.2, x, z + d / 2 - 0.04], [w + 0.12, 0.2, x, z - d / 2 + 0.04], [0.2, d, x + w / 2 - 0.04, z], [0.2, d, x - w / 2 + 0.04, z]]) {
      g.add(box(pw, 0.36, pd, color, px, top, pz));
      g.add(box(pw + 0.06, 0.07, pd + 0.06, TRIM, px, top + 0.36, pz));
    }
    return top + 0.43;
  }
  return top;
}
// a pitched roof: ridge along x (or z), over a hall of w x d whose walls end at y
function gableRoof(g, { x = 0, z = 0, w, d, y, rise = 1, color, along = 'x', eave = 0.25 }) {
  const span = along === 'x' ? d : w, len = along === 'x' ? w : d;
  const sh = new THREE.Shape();
  sh.moveTo(-span / 2 - eave, 0); sh.lineTo(span / 2 + eave, 0); sh.lineTo(0, rise); sh.closePath();
  const geo = new THREE.ExtrudeGeometry(sh, { depth: len + eave * 2, bevelEnabled: false });
  geo.translate(0, 0, -(len + eave * 2) / 2);
  const m = mesh(geo, color);
  if (along === 'x') m.rotation.y = Math.PI / 2;
  m.position.set(x, y, z);
  g.add(m);
  // standing seams on the roof, so it reads as metal sheet
  const slope = Math.atan2(rise, span / 2 + eave), half = Math.hypot(span / 2 + eave, rise);
  const L = len + eave * 2;
  for (let i = -3; i <= 3; i++) for (const sd of [-1, 1]) {
    const c = (L / 2) * (i / 3.6), off = sd * (span / 2 + eave) / 2;
    if (along === 'x') { const m = at(mesh(new THREE.BoxGeometry(0.05, 0.05, half), shade(color, -0.3)), x + c, y + rise / 2 + 0.03, z + off); m.rotation.x = sd * slope; g.add(m); }
    else { const m = at(mesh(new THREE.BoxGeometry(half, 0.05, 0.05), shade(color, -0.3)), x + off, y + rise / 2 + 0.03, z + c); m.rotation.z = -sd * slope; g.add(m); }
  }
  // a ridge cap
  g.add(along === 'x' ? box(L, 0.1, 0.18, shade(color, -0.35), x, y + rise - 0.04, z) : box(0.18, 0.1, L, shade(color, -0.35), x, y + rise - 0.04, z));
  return y + rise;
}
// a chimney: tapering, with red-and-white bands, a ladder, a little platform and a hole
// in the top for the smoke. Returns where the smoke comes out.
function chimney(g, x, z, y0, h, r, color, bands = true) {
  g.add(cyl(r * 0.88, r * 1.08, h, color, x, y0, z, 18));
  g.add(cyl(r * 1.12, r * 1.18, 0.3, shade(color, -0.25), x, y0, z, 18));
  if (bands) for (const [k, c] of [[0.78, WHITE], [0.86, RED], [0.94, WHITE]]) g.add(cyl(r * 0.92, r * 0.92, h * 0.08, c, x, y0 + h * k - h * 0.04, z, 18));
  g.add(cyl(r * 0.98, r * 0.98, 0.14, DARK, x, y0 + h - 0.1, z, 18));
  // platform ring near the top
  const ring = mesh(new THREE.TorusGeometry(r * 1.35, 0.04, 6, 22), IRON); ring.rotation.x = Math.PI / 2; ring.position.set(x, y0 + h * 0.7 + 0.45, z); g.add(ring);
  const deck = mesh(new THREE.CylinderGeometry(r * 1.38, r * 1.38, 0.06, 22), IRON); deck.position.set(x, y0 + h * 0.7, z); g.add(deck);
  // ladder up the side facing the camera
  const lx = x + r * 0.72, lz = z + r * 0.72;
  for (const e of [-0.14, 0.14]) g.add(box(0.04, h * 0.95, 0.04, IRON, lx + e * 0.7, y0 + 0.2, lz - e * 0.7));
  for (let y = y0 + 0.4; y < y0 + h; y += 0.32) { const rung = box(0.3, 0.025, 0.03, IRON, lx, y, lz); rung.rotation.y = -Math.PI / 4; g.add(rung); }
  const hole = mesh(new THREE.CylinderGeometry(r * 0.72, r * 0.72, 0.03, 16), 0x141518, { roughness: 1 }); hole.position.set(x, y0 + h + 0.005, z); g.add(hole);
  return new THREE.Vector3(x, y0 + h + 0.05, z);
}
// an upright tank on a ring base, with bands, a domed top, a ladder and a rail
function tank(g, x, z, r, h, color, y0 = 0) {
  g.add(cyl(r + 0.12, r + 0.16, 0.3, PLINTH, x, y0, z, 20));
  g.add(cyl(r, r, h, color, x, y0 + 0.3, z, 22));
  for (const k of [0.25, 0.6]) g.add(cyl(r + 0.03, r + 0.03, 0.08, shade(color, -0.25), x, y0 + 0.3 + h * k, z, 22));
  const top = mesh(new THREE.SphereGeometry(r, 22, 8, 0, Math.PI * 2, 0, Math.PI / 2), color); top.scale.y = 0.35; top.position.set(x, y0 + 0.3 + h, z); g.add(top);
  const lx = x + r * 0.71 + 0.05, lz = z + r * 0.71 + 0.05;
  for (const e of [-0.13, 0.13]) g.add(box(0.04, h + 0.2, 0.04, IRON, lx + e * 0.7, y0 + 0.3, lz - e * 0.7));
  for (let y = y0 + 0.5; y < y0 + h + 0.3; y += 0.3) { const rung = box(0.28, 0.025, 0.03, IRON, lx, y, lz); rung.rotation.y = -Math.PI / 4; g.add(rung); }
  const rail = mesh(new THREE.TorusGeometry(r * 0.6, 0.03, 5, 18), HAZ); rail.rotation.x = Math.PI / 2; rail.position.set(x, y0 + 0.3 + h + r * 0.35 + 0.4, z); g.add(rail);
  return y0 + 0.3 + h + r * 0.35;
}
// a steel lattice: two posts with cross-bracing between them, in the plane facing `axis`
function lattice(g, x0, z0, x1, z1, y0, h, color = IRON, step = 1.1) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  g.add(box(0.14, h, 0.14, color, x0, y0, z0), box(0.14, h, 0.14, color, x1, y0, z1));
  const ang = Math.atan2(z1 - z0, x1 - x0);
  for (let y = y0; y < y0 + h - 0.1; y += step) {
    const bar = box(len, 0.08, 0.08, color, (x0 + x1) / 2, y + step, (z0 + z1) / 2); bar.rotation.y = -ang; g.add(bar);
    const diag = Math.hypot(len, step), brace = mesh(new THREE.BoxGeometry(diag, 0.06, 0.06), color);
    brace.position.set((x0 + x1) / 2, y + step / 2, (z0 + z1) / 2);
    brace.rotation.order = 'YXZ'; brace.rotation.y = -ang; brace.rotation.z = Math.atan2(step, len) * ((Math.round((y - y0) / step) % 2) ? 1 : -1);
    g.add(brace);
  }
}
// a spoked wheel facing +z (spin it about z)
function spokeWheel(r, color = DARK, spokes = 6, tube = 0.07) {
  const w = new THREE.Group();
  w.add(mesh(new THREE.TorusGeometry(r, tube, 6, 20), color));
  for (let i = 0; i < spokes; i++) { const s = mesh(new THREE.BoxGeometry(r * 2, 0.06, 0.06), color); s.rotation.z = (i / spokes) * Math.PI; w.add(s); }
  const hub = mesh(new THREE.CylinderGeometry(r * 0.18, r * 0.18, 0.2, 10), IRON); hub.rotation.x = Math.PI / 2; w.add(hub);
  return w;
}
// a gear facing +z
function gearShape(r, teeth, color, thick = 0.25) {
  const g = new THREE.Group();
  const disk = mesh(new THREE.CylinderGeometry(r, r, thick, 24), color); disk.rotation.x = Math.PI / 2; g.add(disk);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const t = mesh(new THREE.BoxGeometry(r * 0.32, r * 0.3, thick), color);
    t.position.set(Math.cos(a) * (r + r * 0.12), Math.sin(a) * (r + r * 0.12), 0); t.rotation.z = a; g.add(t);
  }
  const hub = mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, thick + 0.08, 12), DARK); hub.rotation.x = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const h = mesh(new THREE.CylinderGeometry(r * 0.13, r * 0.13, thick + 0.04, 8), shade(color, -0.35)); h.rotation.x = Math.PI / 2; h.position.set(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 0); g.add(h); }
  return g;
}

Object.assign(BUILDERS, {
  // ---- Ore Mine: a steel headframe over the shaft, a hoist house, a conveyor up to an
  // ore bin, ore piles and a cart running on rails
  mine(color) {
    const g = new THREE.Group();
    // hoist house with a pitched metal roof
    const hw = 3.0, hd = 2.3, hx = 1.1, hz = -1.35;
    const wallTop = hall(g, { x: hx, z: hz, w: hw, d: hd, h: 1.9, color: 0xdce8ed, pierColor: 0x477ab0, parapet: false, piers: 1.0 });
    gableRoof(g, { x: hx, z: hz, w: hw, d: hd, y: wallTop, rise: 0.9, color: 0x227fc9, along: 'x' });
    // Bright industrial fascia and a gold nameplate establish the game's factory palette.
    g.add(box(hw + 0.25, 0.17, 0.15, 0xffc23d, hx, wallTop - 0.25, hz + hd / 2 + 0.12));
    signBoard(g, 'z', hx, 1.38, hz + hd / 2 + 0.14, 1.5, 0x2c79bf, 4);
    winRow(g, 'z', hx + 0.5, 0.95, hz + hd / 2, 2, 1.0, 0.6, 0.6);
    sideDoor(g, 'z', hx - 0.95, hz + hd / 2);
    door(g, 'x', hz, hx + hw / 2, 1.2, 1.4, 0x8d7a64);
    // the headframe: four legs, cross-braced, with a deck and two sheave wheels on top
    const fx = -1.55, fz = -1.15, s = 0.6, H = 5.4;
    lattice(g, fx - s, fz + s, fx + s, fz + s, 0.3, H, IRON, 0.9);
    lattice(g, fx + s, fz - s, fx + s, fz + s, 0.3, H, IRON, 0.9);
    lattice(g, fx - s, fz - s, fx - s, fz + s, 0.3, H, IRON, 0.9);
    lattice(g, fx - s, fz - s, fx + s, fz - s, 0.3, H, IRON, 0.9);
    g.add(box(1.7, 0.16, 1.7, 0xffc23d, fx, H + 0.3, fz));
    railing(g, fx - 0.8, fz + 0.8, fx + 0.8, fz + 0.8, H + 0.46);
    const wheels = [];
    for (const dz of [-0.35, 0.35]) {
      const w = spokeWheel(0.62, 0xf0a525, 6, 0.08); w.position.set(fx, H + 1.0, fz + dz); g.add(w); wheels.push(w);
      g.add(box(0.1, 0.55, 0.1, DARK, fx - 0.3, H + 0.46, fz + dz), box(0.1, 0.55, 0.1, DARK, fx + 0.3, H + 0.46, fz + dz));
    }
    // cables from the top of the wheels down into the hoist house
    for (const dz of [-0.35, 0.35]) rod(g, [fx + 0.1, H + 1.62, fz + dz], [hx - 0.9, wallTop + 0.45, fz + dz], 0.025, DARK);
    // shaft collar
    g.add(box(1.5, 0.45, 1.5, PLINTH, fx, 0.15, fz), box(1.0, 0.05, 1.0, 0x17181b, fx, 0.6, fz));
    // ore bin on legs, fed by an inclined conveyor
    const bx = 2.2, bz = 1.2;
    for (const [dx, dz] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]]) g.add(box(0.14, 1.6, 0.14, IRON, bx + dx, 0.15, bz + dz));
    g.add(box(1.5, 1.1, 1.3, 0xe6ae43, bx, 1.7, bz), box(1.6, 0.12, 1.4, 0xf4eee0, bx, 2.8, bz));
    const hop = mesh(new THREE.ConeGeometry(0.85, 0.7, 4), shade(color, -0.1)); hop.rotation.set(Math.PI, Math.PI / 4, 0); hop.position.set(bx, 1.35, bz); g.add(hop);
    for (let k = 0; k < 4; k++) g.add(onWall('z', bx - 0.5 + k * 0.33, 1.9, bz + 0.65, 0.18, 0.7, 0.03, HAZ));
    const cx0 = fx + 0.9, cy0 = 0.6, cx1 = bx - 0.6, cy1 = 2.85, clen = Math.hypot(cx1 - cx0, cy1 - cy0), cang = Math.atan2(cy1 - cy0, cx1 - cx0);
    const belt = new THREE.Group();
    belt.add(mesh(new THREE.BoxGeometry(clen, 0.12, 0.6), DARK));
    belt.add(at(mesh(new THREE.BoxGeometry(clen, 0.05, 0.5), 0x3a3f48), 0, 0.08, 0));
    for (const e of [-0.32, 0.32]) belt.add(at(mesh(new THREE.BoxGeometry(clen, 0.2, 0.05), HAZ), 0, 0.12, e));
    belt.position.set((cx0 + cx1) / 2, (cy0 + cy1) / 2, bz); belt.rotation.z = cang; g.add(belt);
    for (const t of [0.3, 0.65]) g.add(box(0.12, cy0 + (cy1 - cy0) * t - 0.1, 0.12, IRON, cx0 + (cx1 - cx0) * t, 0.15, bz));
    g.add(box(0.8, 0.5, 0.8, shade(color, -0.2), cx0 - 0.2, 0.15, bz));   // the loading hopper at the bottom
    const lumps = [];
    for (let i = 0; i < 5; i++) { const l = mesh(new THREE.DodecahedronGeometry(0.14, 0), 0x8a5a3c, { flatShading: true }); g.add(l); lumps.push(l); }
    // ore piles and rails with a cart
    const pile = (x, z, r, h, c) => { const m = mesh(new THREE.ConeGeometry(r, h, 10), c, { flatShading: true }); m.position.set(x, h / 2 + 0.15, z); g.add(m); };
    pile(-2.45, 1.25, 0.95, 1.0, 0x8a5a3c); pile(-1.75, 1.75, 0.6, 0.6, 0x9b6a48);
    for (const e of [-0.22, 0.22]) g.add(box(4.6, 0.07, 0.07, STEEL, -0.2, 0.15, 2.6 + e));
    for (let x = -2.4; x < 2.2; x += 0.45) g.add(box(0.12, 0.05, 0.7, 0x6b4a2b, x, 0.13, 2.6));
    const cart = new THREE.Group();
    cart.add(box(0.8, 0.45, 0.55, 0x4a4f57, 0, 0.18, 0), box(0.86, 0.06, 0.6, HAZ, 0, 0.6, 0));
    cart.add(at(mesh(new THREE.ConeGeometry(0.34, 0.3, 6), 0x8a5a3c, { flatShading: true }), 0, 0.78, 0));
    for (const dx of [-0.25, 0.25]) for (const dz of [-0.3, 0.3]) { const wh = mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.06, 10), DARK); wh.rotation.x = Math.PI / 2; wh.position.set(dx, 0.2, dz); cart.add(wh); }
    cart.position.set(0, 0, 2.6); g.add(cart);
    return {
      group: g, top: H + 2.0,
      anim(t, dt) {
        wheels.forEach((w, i) => { w.rotation.z -= dt * (i ? -2.4 : 2.4); });
        cart.position.x = -0.3 + Math.sin(t * 0.7) * 1.7;
        lumps.forEach((l, i) => { const k = ((t * 0.35 + i / lumps.length) % 1); l.position.set(cx0 + (cx1 - cx0) * k, cy0 + (cy1 - cy0) * k + 0.2, bz); l.rotation.y = k * 6; });
      },
    };
  },

  // ---- Steel Furnace: a brick casting hall, a tall blast furnace with its hot-air
  // stoves and gas main, banded chimneys, and the glow of the furnace mouth
  furnace(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: 0.3, z: 0.35, w: 4.6, d: 3.6, h: 2.7, color, piers: 1.15 });
    // clerestory (a raised strip of windows along the roof)
    g.add(box(3.6, 0.7, 1.2, shade(color, -0.12), 0.3, top - 0.1, 0.1));
    g.add(box(3.8, 0.12, 1.4, TRIM, 0.3, top + 0.6, 0.1));
    winRow(g, 'z', 0.3, top + 0.05, 0.7, 4, 0.85, 0.55, 0.38, DARK, WARM);
    winRow(g, 'z', 0.95, 1.25, 2.15, 3, 1.05, 0.65, 0.95, DARK, WARM);
    winRow(g, 'x', 0.35, 1.25, 2.6, 2, 1.2, 0.7, 0.95, DARK, WARM);
    // the furnace mouth: a glowing arch at the front
    g.add(onWall('z', -1.25, 0.3, 2.15, 1.2, 1.5, 0.1, DARK));
    g.add(onWall('z', -1.25, 0.38, 2.2, 0.95, 1.25, 0.06, 0xffa13a, { emissive: 0xff7a12, emissiveIntensity: 1.3 }));
    g.add(onWall('z', -1.25, 1.85, 2.15, 1.5, 0.22, 0.2, shade(color, -0.35)));
    signBoard(g, 'z', 0.95, top - 1.0, 2.15, 2.6, 0xffc23d, 6);
    // blast furnace at the back left: a tall shell with rings, a top cone and the gas main
    const bx = -1.95, bz = -1.45;
    g.add(cyl(1.05, 1.2, 3.6, 0x5d4a44, bx, 0.15, bz, 20));
    for (const y of [1.1, 2.0, 2.9]) g.add(cyl(1.12, 1.12, 0.12, IRON, bx, y, bz, 20));
    g.add(cyl(0.6, 1.05, 1.2, 0x4a3c37, bx, 3.75, bz, 20));
    g.add(cyl(0.35, 0.45, 1.1, IRON, bx, 4.95, bz, 14));
    railing(g, bx - 1.1, bz + 1.15, bx + 1.1, bz + 1.15, 3.75);
    g.add(box(2.4, 0.08, 2.4, IRON, bx, 3.73, bz));
    // a hot-air stove beside it
    g.add(cyl(0.55, 0.55, 3.3, 0x7d6a62, bx + 1.65, 0.15, bz - 0.55, 16));
    const sdome = mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0x7d6a62); sdome.position.set(bx + 1.65, 3.45, bz - 0.55); g.add(sdome);
    pipe(g, [[bx, 5.9, bz], [bx, 6.3, bz], [bx + 1.6, 6.3, bz], [bx + 1.6, 4.4, bz]], 0.16, 0xb9b4a8);
    // two chimneys at the back right
    const smoke = [chimney(g, 1.65, -1.7, 0.15, 6.4, 0.42, shade(color, -0.25)), chimney(g, 2.75, -2.05, 0.15, 5.0, 0.34, shade(color, -0.25))];
    pipe(g, [[bx + 1.65, 2.6, bz - 0.55], [1.2, 2.6, bz - 0.55], [1.2, 2.6, -1.7]], 0.12, 0x8a8f99);
    return { group: g, top: 8.2, smoke };
  },

  // ---- Bolt Press: a modern blue hall with ribbed cladding, an office front with a
  // glass band, and an open press frame on the roof whose ram stamps up and down
  press(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: 0, z: 0.15, w: 5.8, d: 4.2, h: 2.4, color, piers: 0.5, pierColor: shade(color, -0.12) });
    // an office block at the front right with a ribbon of glass
    g.add(box(2.3, 1.1, 0.9, 0xe9edf2, 1.55, 0.3, 2.45));
    g.add(box(2.1, 0.55, 0.06, GLASS, 1.55, 0.55, 2.92));
    for (let i = 0; i < 5; i++) g.add(box(0.05, 0.55, 0.05, DARK, 0.6 + i * 0.47, 0.55, 2.93));
    g.add(box(2.45, 0.1, 1.05, DARK, 1.55, 1.4, 2.45));
    sideDoor(g, 'x', 2.45, 2.7);
    door(g, 'z', -1.5, 2.25, 1.9, 1.8, 0xc9d1db);
    signBoard(g, 'z', -0.15, 2.15, 2.25, 3.3, 0xffc23d, 7);
    winRow(g, 'x', -0.5, 1.2, 2.9, 3, 0.9, 0.6, 0.6);
    // the bolt logo: a hex head on the facade
    const hex = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.14, 6), 0xdfe4ea); hex.rotation.x = Math.PI / 2; hex.position.set(2.5, top - 1.1, 2.33); g.add(hex);
    const hexIn = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 6), DARK); hexIn.rotation.x = Math.PI / 2; hexIn.position.set(2.5, top - 1.1, 2.35); g.add(hexIn);
    // rooftop press: a base bolster, two columns, a crown with the hydraulic cylinder,
    // and a ram that comes down hard, rests a moment and lifts back up
    const px = -0.9, pz = -0.4, base = top - 0.43;
    g.add(box(2.4, 0.5, 1.6, 0x3a4250, px, base, pz));
    g.add(box(1.4, 0.18, 1.0, 0x8a8f99, px, base + 0.5, pz));       // the die on the bolster
    for (const dx of [-0.95, 0.95]) {
      g.add(box(0.36, 3.0, 0.9, color, px + dx, base + 0.5, pz));
      g.add(box(0.4, 0.12, 0.95, HAZ, px + dx, base + 1.4, pz));
    }
    g.add(box(2.5, 0.7, 1.1, shade(color, -0.25), px, base + 3.5, pz));
    g.add(box(2.56, 0.1, 1.16, TRIM, px, base + 4.2, pz));
    g.add(cyl(0.34, 0.34, 1.6, 0x3a4250, px, base + 4.2, pz, 16));    // the hydraulic cylinder
    g.add(cyl(0.38, 0.38, 0.12, TRIM, px, base + 5.8, pz, 16));
    const ram = new THREE.Group();
    ram.add(box(1.5, 0.55, 0.85, HAZ, 0, 0, 0));                     // the slide, in safety yellow
    for (let k = 0; k < 3; k++) ram.add(box(0.2, 0.55, 0.02, DARK, -0.5 + k * 0.5, 0, 0.44));
    for (let k = 0; k < 3; k++) ram.add(box(0.02, 0.55, 0.2, DARK, 0.76, 0, -0.3 + k * 0.3));
    ram.add(box(1.0, 0.16, 0.6, 0x5b5f66, 0, -0.16, 0));              // the punch
    ram.add(cyl(0.13, 0.13, 3.2, 0xe9edf2, 0, 0.55, 0, 10));           // the piston rod
    ram.position.set(px, base + 0.84, pz);
    g.add(ram);
    // a flywheel on the side of the frame, spinning (its axle runs along x)
    const flyWrap = new THREE.Group(), fly = spokeWheel(0.55, DARK, 5, 0.1);
    flyWrap.add(fly); flyWrap.rotation.y = Math.PI / 2; flyWrap.position.set(px + 1.3, base + 3.0, pz); g.add(flyWrap);
    g.add(box(0.3, 0.14, 0.14, IRON, px + 1.15, base + 2.93, pz));
    // a puff of 'dust' when it strikes: a flat ring that flashes out
    const ring = mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 20), 0xfff4d6, { emissive: 0xffe6a0, emissiveIntensity: 1.2, transparent: true, opacity: 0 });
    ring.material = ring.material.clone();
    ring.rotation.x = Math.PI / 2; ring.position.set(px, base + 0.72, pz); g.add(ring);
    return {
      group: g, top: base + 6.4,
      anim(t, dt) {
        // 1.4 s cycle: fast stroke down, a short dwell, a slower lift
        const p = (t / 1.4) % 1;
        const k = p < 0.18 ? 1 - (p / 0.18) ** 2 : p < 0.3 ? 0 : Math.sin(((p - 0.3) / 0.7) * Math.PI / 2);
        ram.position.y = base + 0.84 + k * 1.2;
        fly.rotation.z -= dt * 4;
        const hit = p >= 0.18 && p < 0.42 ? (p - 0.18) / 0.24 : -1;
        ring.material.opacity = hit < 0 ? 0 : 0.8 * (1 - hit);
        const s = hit < 0 ? 1 : 1 + hit * 1.2; ring.scale.set(s, s, 1);
      },
    };
  },

  // ---- Gear Cutter: a saw-tooth workshop with skylights, a big pair of meshing gears
  // on the front, and roof vents
  gear(color) {
    const g = new THREE.Group();
    const w = 5.8, d = 4.6, wallTop = hall(g, { x: -0.1, z: 0, w, d, h: 2.3, color, parapet: false, piers: 1.15 });
    // saw-tooth roof: three bays, each a sloping deck and a glazed vertical face
    for (let i = 0; i < 3; i++) {
      const bx = -0.1 - w / 2 + w / 6 + (i * w) / 3;
      const sh = new THREE.Shape(); sh.moveTo(-w / 6, 0); sh.lineTo(w / 6, 0); sh.lineTo(w / 6, 1.15); sh.closePath();
      const geo = new THREE.ExtrudeGeometry(sh, { depth: d + 0.2, bevelEnabled: false }); geo.translate(0, 0, -(d + 0.2) / 2);
      const m = mesh(geo, shade(color, -0.3)); m.position.set(bx, wallTop, 0); g.add(m);
      g.add(box(0.06, 1.0, d - 0.1, GLASS, bx + w / 6 - 0.04, wallTop + 0.05, 0));
      for (let k = -2; k <= 2; k++) g.add(box(0.08, 1.05, 0.06, DARK, bx + w / 6 - 0.03, wallTop + 0.03, k * 0.9));
      g.add(box(w / 3 + 0.04, 0.1, d + 0.3, TRIM, bx, wallTop - 0.05, 0));
    }
    door(g, 'z', -1.7, 2.3, 1.7, 1.75, 0xbfa36a);
    win(g, 'z', 0.05, 1.15, 2.3, 0.7, 0.75);
    winRow(g, 'x', 0, 1.15, 2.8, 3, 1.25, 0.7, 0.75);
    signBoard(g, 'x', 0, 2.05, 2.8, 3.0, 0x2a2f38, 6);
    // the meshing gears: a big one and a small one turning the other way
    const big = gearShape(0.95, 14, 0xc9ced6), small = gearShape(0.55, 9, 0x8a8f99);
    big.position.set(1.15, wallTop + 0.95, 2.48); small.position.set(2.45, wallTop + 0.35, 2.52);
    g.add(big, small);
    g.add(box(0.5, wallTop - 0.3, 0.2, shade(color, -0.3), 1.15, 0.3, 2.38));
    return { group: g, top: wallTop + 2.4, anim(t, dt) { big.rotation.z -= dt * 0.9; small.rotation.z += dt * 0.9 * (14 / 9); } };
  },

  // ---- Engine Line: an assembly hall with a stepped roof, a test cell with an exhaust
  // stack, two fuel tanks with a catwalk, and engines riding a conveyor
  engine(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: -0.85, z: -0.2, w: 4.4, d: 4.2, h: 2.8, color, piers: 1.1 });
    // a raised monitor roof over the assembly line
    g.add(box(2.6, 0.65, 3.4, shade(color, -0.15), -0.85, top - 0.1, -0.2));
    g.add(box(2.75, 0.1, 3.55, TRIM, -0.85, top + 0.55, -0.2));
    winRow(g, 'x', -0.2, top + 0.05, 0.45, 3, 1.0, 0.65, 0.36, DARK, 0xece7ff);
    door(g, 'z', -1.6, 1.9, 1.6, 1.75, 0xb7aed6);
    winRow(g, 'z', 0.05, 1.2, 1.9, 1, 1, 0.8, 0.8);
    signBoard(g, 'z', -0.85, top - 1.0, 1.9, 2.8, 0xf3efe6, 6);
    // the 'V' badge
    for (const s of [-1, 1]) { const v = box(0.14, 0.7, 0.08, 0xffc23d, -0.85 + s * 0.17, top - 0.15, 2.0); v.rotation.z = s * 0.38; g.add(v); }
    // test cell with an exhaust stack at the back right
    g.add(box(1.6, 2.0, 1.7, 0x6b6f78, 2.05, 0.15, -1.55));
    for (let k = 0; k < 4; k++) g.add(box(1.62, 0.05, 0.05, DARK, 2.05, 0.6 + k * 0.4, -0.69));
    const smoke = [chimney(g, 2.3, -1.7, 2.15, 2.6, 0.26, 0xb9b4a8, false)];
    // fuel tanks and a catwalk joining them to the hall
    tank(g, 2.25, 0.55, 0.62, 2.0, 0xe9ecf1);
    tank(g, 2.4, 2.0, 0.5, 1.5, 0xe9ecf1);
    g.add(box(1.0, 0.08, 0.5, IRON, 1.45, 2.4, 0.55));
    railing(g, 0.95, 0.8, 1.95, 0.8, 2.48);
    pipe(g, [[2.25, 0.9, 1.15], [2.25, 0.9, 1.6], [2.4, 0.9, 1.6]], 0.08, 0xb9b4a8);
    // conveyor along the front with engines riding it
    g.add(box(4.4, 0.38, 0.75, 0x3a3f48, -0.6, 0.15, 2.9));
    g.add(box(4.4, 0.06, 0.6, 0x1f2227, -0.6, 0.53, 2.9));
    for (const x of [-2.6, -0.6, 1.4]) g.add(box(0.12, 0.4, 0.8, HAZ, x, 0.15, 2.9));
    const items = [];
    for (let i = 0; i < 4; i++) {
      const e = new THREE.Group();
      e.add(box(0.55, 0.32, 0.42, 0x5b5f66, 0, 0, 0), box(0.4, 0.14, 0.3, 0xc9ced6, 0, 0.32, 0));
      for (const s of [-1, 1]) { const c = box(0.12, 0.25, 0.32, 0x8a8f99, s * 0.2, 0.36, 0); c.rotation.z = s * 0.5; e.add(c); }
      e.position.set(0, 0.59, 2.9); items.push(e); g.add(e);
    }
    return { group: g, top: 6.0, smoke, anim(t) { items.forEach((c, i) => { c.position.x = -2.6 + ((t * 0.7 + i * 1.1) % 4.4); }); } };
  },

  // ---- Power Plant: a cooling tower with a banded rim, a turbine hall under a pitched
  // roof with tall windows, a stack, and a transformer yard with insulators
  power(color) {
    const g = new THREE.Group();
    // cooling tower on its splayed legs
    const tx = -1.8, tz = -1.3;
    const pts = [];
    for (let i = 0; i <= 12; i++) { const y = 0.6 + i * 0.47; const r = 1.95 - 0.85 * Math.sin((i / 12) * Math.PI * 0.82); pts.push(new THREE.Vector2(r, y)); }
    const tower = mesh(new THREE.LatheGeometry(pts, 28), 0xe9e6df, { side: THREE.DoubleSide }); tower.position.set(tx, 0, tz); g.add(tower);
    for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; const leg = box(0.12, 0.62, 0.12, 0xcfcac0, tx + Math.cos(a) * 1.85, 0.0, tz + Math.sin(a) * 1.85); leg.rotation.z = Math.cos(a) * 0.25; leg.rotation.x = -Math.sin(a) * 0.25; g.add(leg); }
    const topY = 0.6 + 12 * 0.47;
    for (const [k, c] of [[0.0, RED], [0.28, WHITE], [0.56, RED]]) {
      const yy = topY - 0.85 + k, rr = 1.95 - 0.85 * Math.sin(((yy - 0.6) / 0.47 / 12) * Math.PI * 0.82);
      g.add(cyl(rr + 0.03, rr + 0.03, 0.28, c, tx, yy, tz, 28));
    }
    const rim = mesh(new THREE.TorusGeometry(1.48, 0.08, 6, 28), 0xcfcac0); rim.rotation.x = Math.PI / 2; rim.position.set(tx, topY, tz); g.add(rim);
    const hole = mesh(new THREE.CircleGeometry(1.4, 28), 0x34363a, { roughness: 1 }); hole.rotation.x = -Math.PI / 2; hole.position.set(tx, topY - 0.6, tz); g.add(hole);
    // turbine hall with a pitched roof and tall windows
    const hx = 1.5, hz = 0.3, hw = 3.2, hd = 3.2;
    const wallTop = hall(g, { x: hx, z: hz, w: hw, d: hd, h: 2.6, color, parapet: false, piers: 0.85 });
    gableRoof(g, { x: hx, z: hz, w: hw, d: hd, y: wallTop, rise: 1.0, color: shade(color, -0.35), along: 'z' });
    winRow(g, 'z', hx, 1.2, hz + hd / 2, 3, 0.85, 0.5, 1.4);
    winRow(g, 'x', hz, 1.2, hx + hw / 2, 3, 0.85, 0.5, 1.4);
    // a big round window in the gable end
    const ow = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.06, 18), GLASS); ow.rotation.x = Math.PI / 2; ow.position.set(hx, wallTop + 0.35, hz + hd / 2 + 0.28); g.add(ow);
    const owr = mesh(new THREE.TorusGeometry(0.33, 0.05, 6, 18), TRIM); owr.position.copy(ow.position); owr.position.z += 0.02; g.add(owr);
    // a slim stack
    const stack = chimney(g, 0.75, -2.35, 0.15, 5.4, 0.28, 0xd9d4ca);
    // transformer yard at the front left: plinths, transformers, insulators and a fence
    for (let i = 0; i < 3; i++) {
      const x = -2.6 + i * 1.0, z = 2.35;
      g.add(box(0.8, 0.15, 0.7, PLINTH, x, 0.15, z), box(0.66, 0.75, 0.5, 0x6f8fa8, x, 0.3, z));
      for (let k = 0; k < 4; k++) g.add(box(0.68, 0.04, 0.52, 0x5b7488, x, 0.4 + k * 0.15, z));
      for (const dx of [-0.2, 0, 0.2]) { g.add(cyl(0.04, 0.04, 0.35, 0xe8e2d4, x + dx, 1.05, z, 6)); for (let k = 0; k < 3; k++) g.add(cyl(0.08, 0.08, 0.04, 0x9b6a48, x + dx, 1.12 + k * 0.1, z, 8)); }
    }
    lattice(g, -3.05, 1.85, -3.05, 2.85, 0.15, 2.4, 0xb9b4a8, 0.8);
    return { group: g, top: topY + 1.0, smoke: [new THREE.Vector3(tx, topY + 0.05, tz), stack], steam: true };
  },

  // ---- Data Center: a sleek block with a glass front and LED strip, rows of rooftop
  // chillers with spinning fans, generators beside it and blinking server lights
  datacenter(color) {
    const g = new THREE.Group();
    const top = hall(g, { x: -0.3, z: -0.3, w: 5.4, d: 4.2, h: 2.4, color, piers: 0.9, pierColor: shade(color, 0.12), roof: 0x40444c });
    // glass entrance pavilion at the front
    g.add(box(2.2, 1.6, 0.9, GLASS, 0.9, 0.3, 2.15));
    for (let i = 0; i < 6; i++) g.add(box(0.05, 1.6, 0.05, 0xd8dbe2, -0.15 + i * 0.42, 0.3, 2.62));
    g.add(box(2.4, 0.14, 1.1, 0xd8dbe2, 0.9, 1.9, 2.15));
    // LED strip and server bays on the front wall
    g.add(onWall('z', -0.3, top - 0.95, 1.8, 5.2, 0.08, 0.04, 0x5fd3ff, { emissive: 0x2fb6ff, emissiveIntensity: 1.4 }));
    const lights = [];
    for (let i = 0; i < 4; i++) {
      const x = -2.55 + i * 0.6;
      g.add(onWall('z', x, 0.55, 1.8, 0.45, 1.35, 0.05, shade(color, -0.35)));
      for (let k = 0; k < 4; k++) {
        const l = onWall('z', x, 0.7 + k * 0.3, 1.86, 0.2, 0.06, 0.03, 0x5fd3ff, { emissive: 0x2fb6ff, emissiveIntensity: 1 });
        l.material = l.material.clone(); lights.push(l); g.add(l);
      }
    }
    for (let i = 0; i < 3; i++) g.add(onWall('x', -1.5 + i * 1.2, 0.6, 2.4, 0.9, 1.4, 0.05, shade(color, -0.35)));
    signBoard(g, 'x', -0.3, top - 1.0, 2.4, 2.6, 0x2fb6ff, 5);
    // chillers: two rows of fan boxes on the roof
    const fans = [], roofY = top - 0.43;
    for (let r = 0; r < 2; r++) for (let i = 0; i < 3; i++) {
      const x = -1.95 + i * 1.5, z = -1.4 + r * 1.35;
      g.add(box(1.25, 0.6, 1.05, 0xc9ced6, x, roofY, z));
      g.add(cyl(0.42, 0.42, 0.06, 0x2a2d33, x, roofY + 0.6, z, 16));
      const fan = new THREE.Group();
      for (let b = 0; b < 4; b++) { const bl = mesh(new THREE.BoxGeometry(0.72, 0.03, 0.16), 0x8a8f99); bl.rotation.y = b * Math.PI / 4 * 2; bl.rotation.x = 0.3; fan.add(bl); }
      fan.position.set(x, roofY + 0.68, z); fans.push(fan); g.add(fan);
    }
    // backup generators (containers) and a dish on the side
    for (const z of [-2.0, -0.7]) { g.add(box(1.0, 1.0, 1.1, 0x5f7f5f, 2.9, 0.15, z)); for (let k = 0; k < 4; k++) g.add(box(0.03, 0.8, 1.0, 0x4a664a, 3.41, 0.25, z - 0.4 + k * 0.27)); }
    const dish = mesh(new THREE.SphereGeometry(0.55, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2.6), 0xf2f2f0, { side: THREE.DoubleSide });
    dish.rotation.x = -2.2; dish.rotation.z = 0.5; dish.position.set(-2.4, roofY + 0.95, 1.1); g.add(dish);
    g.add(box(0.1, 0.8, 0.1, IRON, -2.4, roofY, 1.1));
    return {
      group: g, top: top + 1.6,
      anim(t, dt) {
        fans.forEach((f, i) => { f.rotation.y += dt * (5 + i * 0.7); });
        lights.forEach((l, i) => { l.material.emissiveIntensity = Math.sin(t * 6 + i * 1.9) > 0.1 ? 1.4 : 0.15; });
      },
    };
  },

  // ---- Turbine Shop: a hangar-like hall with a striped door, and a jet engine on a test
  // stand outside with its fan spinning
  turbine(color) {
    const g = new THREE.Group();
    const hx = -0.6, hw = 4.6, hd = 4.6;
    const wallTop = hall(g, { x: hx, z: -0.2, w: hw, d: hd, h: 2.6, color, parapet: false, piers: 1.15 });
    // barrel roof
    const barrel = mesh(new THREE.CylinderGeometry(hw / 2 + 0.15, hw / 2 + 0.15, hd + 0.3, 24, 1, false, -Math.PI / 2, Math.PI), shade(color, -0.3));
    barrel.rotation.x = -Math.PI / 2; barrel.scale.set(1, 1, 0.42); barrel.position.set(hx, wallTop, -0.2); g.add(barrel);
    for (let k = -3; k <= 3; k++) { const rib = mesh(new THREE.TorusGeometry(hw / 2 + 0.17, 0.035, 4, 24, Math.PI), DARK); rib.scale.set(1, 0.42, 1); rib.position.set(hx, wallTop, -0.2 + k * (hd / 7)); g.add(rib); }
    // big hangar door with chevrons
    g.add(onWall('z', hx, 0.3, 2.1, 3.2, 2.3, 0.08, DARK));
    g.add(onWall('z', hx, 0.32, 2.14, 3.0, 2.15, 0.05, 0xd8dbe2));
    for (let k = 0; k < 8; k++) { const c = onWall('z', hx - 1.3 + k * 0.37, 2.0, 2.18, 0.22, 0.2, 0.03, k % 2 ? DARK : HAZ); g.add(c); }
    for (let k = 1; k < 4; k++) g.add(onWall('z', hx - 1.5 + k * 0.75, 0.32, 2.19, 0.04, 1.65, 0.02, 0x9aa0a8));
    winRow(g, 'x', -0.2, 1.3, hx + hw / 2, 3, 1.25, 0.7, 0.8, DARK, 0xe6fffb);
    signBoard(g, 'x', -0.2, 2.25, hx + hw / 2, 2.8, 0xf3efe6, 6);
    // jet engine on a test stand, front right
    const ex = 2.55, ez = 1.55;
    g.add(box(1.5, 0.3, 1.0, PLINTH, ex, 0.15, ez));
    for (const dx of [-0.45, 0.45]) g.add(box(0.14, 1.2, 0.14, HAZ, ex + dx, 0.45, ez));
    const eng = new THREE.Group();
    const shell = mesh(new THREE.CylinderGeometry(0.62, 0.48, 1.7, 22, 1, true), 0xdfe3e8, { side: THREE.DoubleSide }); shell.rotation.z = Math.PI / 2; eng.add(shell);
    const lip = mesh(new THREE.TorusGeometry(0.62, 0.07, 8, 24), 0xf3f5f7); lip.rotation.y = Math.PI / 2; lip.position.x = 0.85; eng.add(lip);
    const core = mesh(new THREE.CylinderGeometry(0.25, 0.15, 1.9, 14), 0x5b5f66); core.rotation.z = Math.PI / 2; core.position.x = -0.2; eng.add(core);
    const nozzle = mesh(new THREE.CylinderGeometry(0.4, 0.3, 0.4, 18), 0x6b6f78); nozzle.rotation.z = Math.PI / 2; nozzle.position.x = -1.0; eng.add(nozzle);
    const fan = new THREE.Group();
    for (let i = 0; i < 12; i++) { const bl = mesh(new THREE.BoxGeometry(0.03, 0.5, 0.14), 0xc9ced6); bl.position.y = 0.28; const arm = new THREE.Group(); arm.add(bl); arm.rotation.x = (i / 12) * Math.PI * 2; bl.rotation.y = 0.5; fan.add(arm); }
    const spinner = mesh(new THREE.ConeGeometry(0.16, 0.3, 14), 0xf3f5f7); spinner.rotation.z = -Math.PI / 2; spinner.position.x = 0.15; fan.add(spinner);
    fan.position.x = 0.7; eng.add(fan);
    eng.position.set(ex, 1.9, ez); eng.rotation.y = -0.35;
    g.add(eng);
    return { group: g, top: wallTop + 2.4, anim(t, dt) { fan.rotation.x -= dt * 9; } };
  },

  // ---- Rocket Bay: a tall assembly building with a full-height striped door, and a red
  // lattice launch tower with a crane arm next to the rocket
  rocket(color) {
    const g = new THREE.Group();
    const bx = -1.2, bw = 3.2, bd = 4.6;
    const top = hall(g, { x: bx, z: 0, w: bw, d: bd, h: 4.6, color, piers: 0.8, pierColor: shade(color, -0.08) });
    // a deep blue band round the top, and a striped mission badge on the front
    g.add(box(bw + 0.22, 0.75, bd + 0.22, 0x1f4f9a, bx, top - 1.35, 0));
    g.add(box(bw + 0.26, 0.08, bd + 0.26, TRIM, bx, top - 0.62, 0));
    for (let k = 0; k < 3; k++) g.add(onWall('z', bx - 0.5 + k * 0.5, 4.75, bd / 2 + 0.11, 0.28, 0.4, 0.04, [RED, WHITE, RED][k]));
    // the giant door: tall panels with a flag stripe
    g.add(onWall('z', bx, 0.3, bd / 2, 2.0, 4.1, 0.08, DARK));
    for (let k = 0; k < 4; k++) g.add(onWall('z', bx, 0.32 + k * 1.02, bd / 2 + 0.04, 1.84, 0.98, 0.05, 0xc9ced6));
    g.add(onWall('x', -0.3, 3.6, bx + bw / 2, 1.6, 0.6, 0.06, 0x2f7fd1));
    g.add(onWall('x', 0.75, 3.6, bx + bw / 2, 0.5, 0.6, 0.06, RED));
    winRow(g, 'x', -0.6, 1.2, bx + bw / 2, 3, 0.75, 0.45, 1.2);
    signBoard(g, 'x', -0.6, 2.65, bx + bw / 2, 2.4, 0x1f3a6b, 5);
    // launch pad: a deck, a flame trench, and the red lattice tower
    const rx = 1.75, rz = -0.4;
    g.add(box(2.6, 0.3, 2.6, PLINTH, rx, 0.15, rz));
    g.add(box(1.4, 0.05, 1.4, 0x22252a, rx, 0.45, rz));
    const tx = rx + 1.2, tz = rz - 1.0;
    lattice(g, tx - 0.35, tz, tx + 0.35, tz, 0.45, 7.2, RED, 0.9);
    lattice(g, tx - 0.35, tz - 0.6, tx - 0.35, tz, 0.45, 7.2, RED, 0.9);
    g.add(box(1.0, 0.12, 0.9, DARK, tx, 7.65, tz - 0.3));
    for (const y of [3.2, 5.4]) { const arm = box(1.0, 0.18, 0.2, RED, tx - 0.75, y, tz + 0.15); g.add(arm); }
    // crane jib on top of the tower
    g.add(box(2.4, 0.16, 0.16, HAZ, tx - 0.8, 7.8, tz - 0.3), box(0.12, 0.6, 0.12, HAZ, tx, 7.8, tz - 0.3));
    g.add(box(0.12, 0.12, 0.12, 0xff3b2f, tx, 8.45, tz - 0.3, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    // the rocket
    const rocket = buildRocket('classic', 0x2f7fd1);
    rocket.position.set(rx, 0.45, rz);
    g.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 5; i++) scaffold.add(box(1.6, 0.1, 1.6, 0xb9b4a8, rx, 0.9 + i * 1.2, rz));
    for (const [dx, dz] of [[-0.75, -0.75], [0.75, 0.75], [-0.75, 0.75], [0.75, -0.75]]) scaffold.add(box(0.1, 5.8, 0.1, 0xb9b4a8, rx + dx, 0.45, rz + dz));
    g.add(scaffold);
    return { group: g, top: 9.0, rocket, scaffold };
  },

  // ---- Headquarters: a glass tower with spandrel bands and setbacks on a stone podium,
  // an entrance canopy, a crown with a lit logo, and a flag
  hq(color) {
    const g = new THREE.Group();
    // podium
    const px = 0.6, pz = 0.9;
    hall(g, { x: px, z: pz, w: 4.6, d: 2.8, h: 1.5, color: 0xd9d2c3, piers: 0.7, pierColor: 0xc4bcab });
    g.add(onWall('z', px + 0.6, 0.3, pz + 1.4, 2.6, 1.0, 0.05, GLASS));
    for (let i = 0; i < 6; i++) g.add(onWall('z', px - 0.65 + i * 0.5, 0.3, pz + 1.45, 0.05, 1.0, 0.03, DARK));
    g.add(onWall('z', px + 0.6, 1.4, pz + 1.4, 3.0, 0.1, 0.8, DARK));       // canopy
    for (const dx of [-0.8, 2.0]) g.add(box(0.08, 1.1, 0.08, DARK, px + dx, 0.3, pz + 2.15));
    // the tower: glass bands between coloured spandrels, a setback, and a crown
    const tx = -0.9, tz = -0.8, tw = 3.0, floors = 7;
    g.add(box(tw + 0.2, 0.3, tw + 0.2, PLINTH, tx, 0, tz));
    for (let k = 0; k < floors; k++) {
      const y = 0.3 + k * 0.85, w = k < 5 ? tw : tw - 0.5;
      g.add(box(w, 0.32, w, color, tx, y, tz));
      g.add(box(w - 0.08, 0.53, w - 0.08, GLASS, tx, y + 0.32, tz));
      for (let i = 1; i < 6; i++) {
        g.add(box(0.05, 0.53, 0.05, DARK, tx - w / 2 + (w * i) / 6, y + 0.32, tz + w / 2 - 0.02));
        g.add(box(0.05, 0.53, 0.05, DARK, tx + w / 2 - 0.02, y + 0.32, tz - w / 2 + (w * i) / 6));
      }
    }
    const ty = 0.3 + floors * 0.85, cw = tw - 0.5;
    g.add(box(cw + 0.1, 0.4, cw + 0.1, color, tx, ty, tz));
    g.add(box(cw + 0.2, 0.08, cw + 0.2, TRIM, tx, ty + 0.4, tz));
    // corner fins running the height of the tower
    for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1]]) g.add(box(0.14, 5 * 0.85, 0.14, TRIM, tx + dx * (tw / 2 + 0.02), 0.3, tz + dz * (tw / 2 + 0.02)));
    // crown with a lit logo
    g.add(box(1.4, 0.9, 1.4, shade(color, -0.2), tx, ty + 0.48, tz));
    g.add(box(0.8, 0.5, 0.05, 0xffd23f, tx, ty + 0.68, tz + 0.72, { emissive: 0xffc23d, emissiveIntensity: 0.9 }));
    g.add(box(0.05, 0.5, 0.8, 0xffd23f, tx + 0.72, ty + 0.68, tz, { emissive: 0xffc23d, emissiveIntensity: 0.9 }));
    g.add(box(0.08, 1.9, 0.08, 0xdddddd, tx - 0.4, ty + 1.38, tz - 0.4));
    g.add(box(0.12, 0.12, 0.12, 0xff3b2f, tx - 0.4, ty + 3.28, tz - 0.4, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    const flag = box(0.9, 0.55, 0.04, 0xffd23f, tx + 0.05, ty + 2.65, tz - 0.4);
    g.add(flag);
    // planters by the door
    for (const dx of [-1.6, 2.4]) { g.add(box(0.6, 0.4, 0.6, 0xd9d2c3, px + dx, 0.15, pz + 2.1)); g.add(at(mesh(new THREE.IcosahedronGeometry(0.33, 0), 0x4fa152, { flatShading: true }), px + dx, 0.85, pz + 2.1)); }
    return { group: g, top: ty + 3.6, anim(t) { flag.rotation.y = Math.sin(t * 3) * 0.25; } };
  },
});

// the kit, for the other worlds' buildings
export { TRIM, DARK, STEEL, IRON, HAZ, GLASS, WARM, PLINTH, ROOF, RED, WHITE, shade, mesh, at, rod, onWall, win, winRow, door, sideDoor, signBoard, ladder, railing, pipe, hall, gableRoof, chimney, tank, lattice, spokeWheel, gearShape };
