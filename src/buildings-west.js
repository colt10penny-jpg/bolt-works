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
const S = 1.5;
function core(g) { const c = new THREE.Group(); c.scale.setScalar(S); c.userData.core = true; g.add(c); return c; }

// ---- frontier parts ----
// vertical boards (battens) on the front (+z) and right (+x) faces of a w x h x d box
function battens(g, x, z, w, d, y0, h, color) {
  const c = shade(color, -0.18);
  for (let a = -w / 2 + 0.22; a < w / 2 - 0.1; a += 0.3) g.add(onWall('z', x + a, y0, z + d / 2, 0.04, h, 0.03, c));
  for (let a = -d / 2 + 0.22; a < d / 2 - 0.1; a += 0.3) g.add(onWall('x', z + a, y0, x + w / 2, 0.04, h, 0.03, c));
}
// a window: white trim, a dark (warm at night) pane with muntins, a sill and a lintel, and
// (shut = a colour) a pair of board shutters folded back either side
function wWin(g, axis, a, y, f, w = 0.5, h = 0.72, trim = TRIM, glass = GLASS, shut = null) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, y - 0.06, f, w + 0.14, h + 0.12, 0.04, trim));
  g.add(onWall(axis, a, y, f + s * 0.02, w, h, 0.04, glass, glass === WARM ? { emissive: 0xff9a3a, emissiveIntensity: 0.5 } : undefined));
  g.add(onWall(axis, a, y, f + s * 0.05, 0.035, h, 0.02, trim), onWall(axis, a, y + h * 0.5, f + s * 0.05, w, 0.035, 0.02, trim));
  g.add(onWall(axis, a, y + h + 0.04, f, w + 0.26, 0.08, 0.1, trim), onWall(axis, a, y - 0.1, f, w + 0.2, 0.05, 0.12, trim));
  if (shut != null) for (const e of [-1, 1]) {
    g.add(onWall(axis, a + e * (w / 2 + 0.17), y - 0.04, f, w * 0.42, h + 0.08, 0.035, shut));
    for (const k of [0.25, 0.75]) g.add(onWall(axis, a + e * (w / 2 + 0.17), y + h * k - 0.02, f + s * 0.035, w * 0.42, 0.03, 0.015, shade(shut, -0.25)));
  }
}
// Painted sign lettering: drawn once per sign on a canvas (a serif face, an inner border
// and little diamonds at the ends) and shared after that.
const SIGNS = new Map();
function signTex(text, bg, ink, aspect) {
  const key = text + bg + ink + aspect.toFixed(1);
  if (SIGNS.has(key)) return SIGNS.get(key);
  const H = 96, W = Math.max(128, Math.min(1024, Math.round(H * aspect)));
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const c = cv.getContext('2d'), hex = n => '#' + n.toString(16).padStart(6, '0');
  c.fillStyle = hex(bg); c.fillRect(0, 0, W, H);
  // weathering: a few faint streaks along the boards
  c.globalAlpha = 0.08; c.fillStyle = '#000';
  for (let y = 12; y < H; y += 24) c.fillRect(0, y, W, 2);
  c.globalAlpha = 1;
  c.strokeStyle = hex(ink); c.lineWidth = 3; c.strokeRect(7, 7, W - 14, H - 14);
  const pad = 30;
  let size = H * 0.56;
  c.font = `bold ${size}px Georgia, 'Times New Roman', serif`;
  const tw = c.measureText(text).width;
  if (tw > W - pad * 2) { size *= (W - pad * 2) / tw; c.font = `bold ${size}px Georgia, 'Times New Roman', serif`; }
  c.fillStyle = hex(ink); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, W / 2, H / 2 + size * 0.06);
  for (const x of [17, W - 17]) { c.beginPath(); c.moveTo(x, H / 2 - 7); c.lineTo(x + 5, H / 2); c.lineTo(x, H / 2 + 7); c.lineTo(x - 5, H / 2); c.closePath(); c.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  SIGNS.set(key, m); return m;
}
// a lettered panel facing out from a wall (or standing free when axis is null)
function textPanel(g, axis, a, y, f, w, h, text, bg, ink) {
  const s = Math.sign(f) || 1, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), signTex(text, bg, ink, w / h));
  if (axis === 'z') { m.position.set(a, y + h / 2, f + s * 0.002); if (s < 0) m.rotation.y = Math.PI; }
  else { m.position.set(f + s * 0.002, y + h / 2, a); m.rotation.y = s * Math.PI / 2; }
  g.add(m); return m;
}
// a painted sign board with a frame: real lettering when there's text, otherwise a row of
// pale blocks standing in for it
function wSign(g, axis, a, y, f, w, h, color, letters = 5, ink = CREAM, text = null) {
  const s = Math.sign(f) || 1;
  g.add(onWall(axis, a, y, f + s * 0.02, w + 0.12, h + 0.12, 0.04, WOOD_D));
  g.add(onWall(axis, a, y + 0.06, f + s * 0.05, w, h, 0.03, color));
  if (text) { textPanel(g, axis, a, y + 0.06, f + s * 0.08, w, h, text, color, ink); return; }
  const lw = (w - 0.3) / letters;
  for (let i = 0; i < letters; i++) g.add(onWall(axis, a - (w - 0.3) / 2 + lw * (i + 0.5), y + h * 0.3, f + s * 0.07, lw * 0.66, h * 0.45, 0.02, ink, { emissive: ink, night: 1.4 }));
}
// a false-front building: a timber box with a shingled pitched roof behind a tall square
// facade that hides it, a cornice with brackets along the top, a lettered sign, corner
// boards, battens on the walls and a stovepipe. Returns the facade top.
function falseFront(g, { x = 0, z = 0, w, d, h, fh = 0.9, color = WOOD, sign = WOOD_D, letters = 5, roof = SHINGLE, cornice = true, text = null, ink = CREAM, pipe = true }) {
  g.add(box(w + 0.2, 0.25, d + 0.2, 0x7a6a55, x, 0, z));                                       // stone footing
  for (let k = 0; k < Math.floor(w / 0.5); k++) g.add(onWall('z', x - w / 2 + 0.3 + k * 0.5, 0.08, z + d / 2 + 0.1, 0.02, 0.1, 0.01, 0x5e5244));
  g.add(box(w, h, d, color, x, 0.25, z));
  battens(g, x, z, w, d, 0.25, h, color);
  const cb = shade(color, -0.3);
  for (const e of [-1, 1]) { g.add(onWall('z', x + e * (w / 2 - 0.05), 0.25, z + d / 2, 0.1, h, 0.04, cb)); g.add(onWall('x', z + e * (d / 2 - 0.05), 0.25, x + w / 2, 0.1, h, 0.04, cb)); }
  // a low pitched roof running back from the facade, with shingle courses down each slope
  const hw = w / 2 + 0.12, rise = 0.6, sl = Math.atan2(rise, hw);
  const sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, rise); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: d - 0.1, bevelEnabled: false }); rg.translate(0, 0, -(d - 0.1) / 2);
  const r = mesh(rg, roof); r.position.set(x, 0.25 + h, z - 0.05); g.add(r);
  for (const e of [-1, 1]) for (let k = 1; k <= 4; k++) {
    const t = k / 5, c = box(0.05, 0.03, d - 0.14, shade(roof, -0.25), x + e * hw * (1 - t), 0.25 + h + rise * t - 0.005, z - 0.05);
    c.rotation.z = e * sl; g.add(c);
  }
  g.add(box(0.1, 0.06, d - 0.1, shade(roof, -0.35), x, 0.25 + h + rise - 0.03, z - 0.05));     // ridge cap
  if (pipe) {
    const px = x + w * 0.22, pz = z - d * 0.2, py = 0.25 + h + rise * (1 - 0.44) - 0.05;
    g.add(cyl(0.06, 0.06, 0.75, 0x2a2d33, px, py, pz, 8), cyl(0.1, 0.1, 0.05, 0x2a2d33, px, py + 0.75, pz, 8));
    const cap = mesh(new THREE.ConeGeometry(0.13, 0.12, 8), 0x2a2d33); cap.position.set(px, py + 0.9, pz); g.add(cap);
  }
  // the facade, standing proud of the roof, with a stepped top
  const fy = 0.25 + h, f = z + d / 2;
  g.add(box(w + 0.12, fh, 0.14, color, x, fy, f - 0.05));
  g.add(box(w * 0.5, 0.3, 0.14, color, x, fy + fh, f - 0.05));
  for (const e of [-1, 1]) g.add(box(0.1, fh + 0.05, 0.18, cb, x + e * (w / 2 + 0.01), fy, f - 0.04));   // pilasters up the facade edges
  if (cornice) { g.add(box(w + 0.3, 0.1, 0.3, TRIM, x, fy + fh - 0.05, f + 0.02), box(w * 0.5 + 0.2, 0.08, 0.28, TRIM, x, fy + fh + 0.28, f + 0.01)); for (let k = 0; k < 6; k++) g.add(box(0.08, 0.14, 0.12, TRIM, x - w / 2 + 0.2 + k * (w - 0.4) / 5, fy + fh - 0.19, f + 0.04)); }
  wSign(g, 'z', x, fy + 0.12, f + 0.02, Math.min(w - 0.5, 2.6), fh - 0.35, sign, letters, ink, text);
  return fy + fh + 0.3;
}
// a covered porch / boardwalk along a wall: a plank deck, posts, a sloping shed roof
function porch(g, { axis = 'z', a = 0, f, len, depth = 0.9, h = 1.6, color = WOOD_D, rail = true }) {
  const s = Math.sign(f) || 1, P = (along, out, y, bw, bh, bd, c) => axis === 'z' ? box(bw, bh, bd, c, a + along, y, f + s * out) : box(bd, bh, bw, c, f + s * out, y, a + along);
  g.add(P(0, depth / 2, 0.12, len, 0.12, depth, 0x8a6a45));
  for (let k = 0; k < Math.round(len / 0.3); k++) g.add(P(-len / 2 + 0.15 + k * 0.3, depth / 2, 0.245, 0.02, 0.01, depth, 0x6e5232));
  const n = Math.max(2, Math.round(len / 1.3));
  for (let i = 0; i <= n; i++) {
    const along = -len / 2 + 0.06 + (len - 0.12) * i / n;
    g.add(P(along, depth - 0.06, 0.24, 0.1, h - 0.1, 0.1, color));
    // a little bracket at the top of each post, on both sides where there's room
    for (const e of [-1, 1]) { if ((i === 0 && e < 0) || (i === n && e > 0)) continue; const b = P(along + e * 0.13, depth - 0.06, h - 0.32, 0.22, 0.05, 0.05, color); if (axis === 'z') b.rotation.z = -e * 0.7; else b.rotation.x = e * 0.7; g.add(b); }
  }
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
  // ---- Gold Mine: a rocky hill with a timbered tunnel mouth, ore carts rolling out of it
  // on rails, a headframe over the main shaft with its sheave wheel turning, a hoist house
  // and a tailings heap. It grows with the town (t = its look, 0-9): a proper hoist house
  // with a boiler stack, then an ore bin over the rails, strings of electric lights, a
  // taller iron-braced headframe with a lit sign, and at the top a second cart and a
  // glittering pile of gold.
  goldmine(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const ROCK = 0xa0805c, ROCK_D = 0x7e6246;
    // the hill, with boulders round its foot
    const hill = mesh(new THREE.DodecahedronGeometry(1, 1), ROCK, { flatShading: true, roughness: 1 }); hill.scale.set(0.85, 1.1, 0.85); hill.position.set(-1.15, 0.0, -1.15); c.add(hill);
    const cap = mesh(new THREE.DodecahedronGeometry(0.5, 0), ROCK_D, { flatShading: true, roughness: 1 }); cap.position.set(-1.35, 0.95, -1.35); cap.scale.y = 0.7; c.add(cap);
    for (const [x, z, r] of [[-0.35, -1.75, 0.2], [-1.7, -0.55, 0.16], [-0.45, -0.55, 0.14], [-1.8, -1.75, 0.22]]) { const b = mesh(new THREE.DodecahedronGeometry(r, 0), ROCK_D, { flatShading: true }); b.position.set(x, 0.2, z); c.add(b); }
    for (let k = 0; k < 4; k++) { const bush = mesh(new THREE.IcosahedronGeometry(0.12, 0), 0x7a8a4a, { flatShading: true }); bush.position.set(-1.6 + k * 0.35, 0.95 - Math.abs(k - 1.5) * 0.12, -0.75 - k * 0.12); c.add(bush); }
    // the tunnel mouth: a timber portal set into the hill
    const ax = -1.15, az = -0.32;
    c.add(box(0.75, 0.85, 0.06, 0x14100c, ax, 0.15, az));
    for (const e of [-0.42, 0.42]) c.add(box(0.14, 1.0, 0.14, WOOD, ax + e, 0.15, az + 0.04));
    c.add(box(1.1, 0.16, 0.2, WOOD_D, ax, 1.12, az + 0.04));
    wSign(c, 'z', ax, 1.32, az + 0.08, 1.0, 0.24, 0x2a2420, 4, 0xe8c46a, t >= 6 ? 'MOTHER LODE' : 'GOLD MINE');
    c.add(box(0.12, 0.18, 0.12, 0xfff1cf, ax + 0.52, 0.95, az + 0.15, { emissive: 0xffc070, night: 2.6 }));
    // the rails: out of the tunnel, then along the front to the hoist house
    const path = [[ax, az + 0.1], [ax, 0.95], [1.35, 0.95]];
    const railM = 0x5a5f66, tieM = 0x6e5232;
    for (let s0 = 0; s0 < path.length - 1; s0++) {
      const [x0, z0] = path[s0], [x1, z1] = path[s0 + 1], alongX = z0 === z1, len = Math.hypot(x1 - x0, z1 - z0) + 0.22;
      for (const e of [-0.2, 0.2]) c.add(alongX ? box(len, 0.05, 0.05, railM, (x0 + x1) / 2, 0.17, z0 + e) : box(0.05, 0.05, len, railM, x0 + e, 0.17, (z0 + z1) / 2));
      for (let k = 0; k <= Math.floor(len / 0.3); k++) c.add(alongX ? box(0.1, 0.04, 0.56, tieM, Math.min(x0, x1) - 0.1 + k * 0.3, 0.14, z0) : box(0.56, 0.04, 0.1, tieM, x0, 0.14, Math.min(z0, z1) - 0.1 + k * 0.3));
    }
    c.add(box(0.2, 0.25, 0.5, 0x8a3a2a, 1.6, 0.15, 0.95));   // the buffer stop at the end
    const mkCart = gold => {
      const cart = new THREE.Group();
      cart.add(box(0.55, 0.3, 0.4, 0x6a4a32, 0, 0.12, 0), box(0.57, 0.05, 0.42, 0x3a3f48, 0, 0.4, 0));
      const ore = mesh(new THREE.DodecahedronGeometry(0.2, 0), gold ? 0xe8c040 : 0xa88a62, gold ? { flatShading: true, metalness: 0.6, roughness: 0.3 } : { flatShading: true }); ore.scale.y = 0.5; ore.position.set(0, 0.45, 0); cart.add(ore);
      for (const [wx, wz] of [[-0.18, -0.21], [0.18, -0.21], [-0.18, 0.21], [0.18, 0.21]]) cart.add(cyl(0.08, 0.08, 0.04, 0x2a2d33, wx, 0.08, wz, 10).rotateX(Math.PI / 2));
      c.add(cart); return cart;
    };
    const carts = [mkCart(t >= 8)]; if (t >= 8) carts.push(mkCart(true));
    const lens = []; let total = 0; for (let k = 0; k < path.length - 1; k++) { const l = Math.hypot(path[k + 1][0] - path[k][0], path[k + 1][1] - path[k][1]); lens.push(l); total += l; }
    const along = d => { let k = 0; while (k < lens.length - 1 && d > lens[k]) { d -= lens[k]; k++; } const f = Math.min(1, d / lens[k]); return [path[k][0] + (path[k + 1][0] - path[k][0]) * f, path[k][1] + (path[k + 1][1] - path[k][1]) * f, path[k][1] === path[k + 1][1]]; };
    // the headframe over the shaft, with the sheave wheel on top
    const hx = 0.85, hz = -0.95, H = t >= 5 ? 4.3 : 3.4, frameC = t >= 5 ? 0x5a5f66 : WOOD;
    c.add(box(1.2, 0.2, 1.2, 0x5a4632, hx, 0.05, hz), box(0.7, 0.04, 0.7, 0x1a1410, hx, 0.25, hz));
    timberTower(c, hx, hz, 0.55, 0.28, H, frameC, t >= 5 ? 5 : 4);
    if (t >= 5) for (const e of [-1, 1]) rod(c, [hx + e * 0.55, 0.25, hz + 0.55], [hx + e * 0.28, H, hz + 0.28], 0.035, 0x8a3a2a);
    c.add(box(0.7, 0.12, 0.7, WOOD_D, hx, H, hz));
    const sheaves = [];
    for (const e of t >= 7 ? [-0.18, 0.18] : [0]) {
      const sh = new THREE.Group();
      sh.add(mesh(new THREE.TorusGeometry(0.38, 0.05, 6, 20), 0x3a3f48));
      for (let k = 0; k < 6; k++) { const sp = box(0.04, 0.76, 0.04, 0x5a5f66, 0, -0.38, 0); sp.rotation.z = k * Math.PI / 3; sh.add(sp); }
      sh.position.set(hx + e, H + 0.5, hz); sh.rotation.y = Math.PI / 2; c.add(sh); sheaves.push(sh);
    }
    for (const [x0, z0, x1, z1] of [[-0.45, 0.45, 0.45, 0.45], [0.45, -0.45, 0.45, 0.45]]) { c.add(box(0.06, 0.55, 0.06, WOOD_D, hx + x0, 0.25, hz + z0), box(0.06, 0.55, 0.06, WOOD_D, hx + x1, 0.25, hz + z1)); rod(c, [hx + x0, 0.72, hz + z0], [hx + x1, 0.72, hz + z1], 0.025, 0xb5532a); }
    c.add(box(0.13, 0.2, 0.13, 0xfff1cf, hx + 0.4, 2.2, hz + 0.4, { emissive: 0xffc070, night: 2.6 }));
    if (t >= 6) { c.add(box(1.0, 0.36, 0.06, 0x2a2420, hx, H - 0.6, hz + 0.32)); textPanel(c, 'z', hx, H - 0.58, hz + 0.36, 0.92, 0.3, 'GOLD', 0x2a2420, 0xffd76a); for (let k = 0; k < 6; k++) c.add(box(0.05, 0.05, 0.04, 0xfff1cf, hx - 0.45 + k * 0.18, H - 0.2, hz + 0.37, { emissive: 0xffd28a, night: 3 })); }
    if (t >= 8) { c.add(box(0.03, 0.8, 0.03, 0xdddddd, hx, H + 0.9, hz), box(0.45, 0.28, 0.02, 0xd9482b, hx + 0.24, H + 1.4, hz)); }
    // the hoist house that winds the cage up and down, with the cable running up to the sheave
    const px = 1.15, pz = 0.15;
    let roofY;
    if (t >= 2) roofY = falseFront(c, { x: px, z: pz, w: 1.4, d: 1.1, h: 1.25, fh: 0.5, color: t >= 6 ? BRICK : GREY, sign: 0x2a2420, text: 'HOIST', ink: 0xe8c46a });
    else { c.add(box(1.3, 1.0, 1.0, WOOD, px, 0.15, pz)); battens(c, px, pz, 1.3, 1.0, 0.15, 1.0, WOOD); const r = box(1.45, 0.06, 1.2, TIN, px, 1.18, pz); r.rotation.x = 0.18; c.add(r); roofY = 1.25; }
    wWin(c, 'x', pz, 0.65, px + 0.7, 0.36, 0.42, TRIM, WARM);
    rod(c, [hx, H + 0.5, hz + 0.38], [px - 0.3, 1.1, pz - 0.3], 0.018, 0x2a2d33);
    const smoke = [];
    if (t >= 2) { c.add(cyl(0.12, 0.15, 2.0, BRICK, px + 0.45, 0.15, pz - 0.35, 10), cyl(0.17, 0.17, 0.1, 0x3a3f48, px + 0.45, 2.15, pz - 0.35, 10)); smoke.push(new THREE.Vector3(px + 0.45, 2.35, pz - 0.35).multiplyScalar(S)); }
    // the ore bin on stilts over the rails, with a chute down to the carts
    if (t >= 3) {
      const ox = -0.15, oz = 0.35;
      for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) c.add(box(0.08, 1.2, 0.08, WOOD_D, ox + dx, 0.15, oz + dz));
      c.add(box(0.8, 0.6, 0.8, WOOD, ox, 1.3, oz)); battens(c, ox, oz, 0.8, 0.8, 1.3, 0.6, WOOD);
      const r = box(0.95, 0.06, 0.95, TIN, ox, 1.95, oz); r.rotation.x = 0.15; c.add(r);
      const ch = box(0.3, 0.05, 0.6, WOOD_L, ox, 1.05, oz + 0.5); ch.rotation.x = 0.6; c.add(ch);
      rod(c, [hx - 0.3, 1.6, hz + 0.3], [ox + 0.35, 1.6, oz - 0.35], 0.06, WOOD);
    }
    // strings of electric lights from the headframe to the hoist house and the tunnel
    if (t >= 4) {
      const strand = (a, b, n) => { rod(c, a, b, 0.008, 0x2a2d33); for (let k = 1; k < n; k++) { const f = k / n; c.add(box(0.06, 0.06, 0.06, 0xfff1cf, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * 0.1, a[2] + (b[2] - a[2]) * f, { emissive: 0xffd28a, night: 3 })); } };
      strand([hx - 0.3, 2.6, hz + 0.3], [px - 0.6, roofY + 0.3, pz + 0.5], 6);
      strand([hx - 0.4, 2.0, hz + 0.3], [ax + 0.5, 1.2, az + 0.1], 6);
    }
    // the tailings heap, glittering with gold at the top level
    const heap = mesh(new THREE.ConeGeometry(0.45, 0.5, 9), 0xa88a62, { flatShading: true }); heap.position.set(-1.5, 0.15 + 0.25, 1.45); c.add(heap);
    if (t >= 8) for (let k = 0; k < 6; k++) { const n = mesh(new THREE.DodecahedronGeometry(0.09, 0), 0xffd24a, { flatShading: true, metalness: 0.7, roughness: 0.25, emissive: 0xb88a10, emissiveIntensity: 0.25 }); n.position.set(-1.5 + Math.cos(k) * 0.22, 0.3 + (k % 3) * 0.08, 1.45 + Math.sin(k) * 0.22); c.add(n); }
    // the life-size clutter in the corners (cleared away when wings go up)
    barrel(g, -2.95, 2.75); barrel(g, -2.6, 3.0); crate(g, -3.0, 2.3);
    for (const [qx, qz] of [[2.6, -3.0], [3.1, -3.0]]) { g.add(box(1.0, 0.12, 0.12, WOOD_L, qx, 0.15, qz)); g.add(box(1.0, 0.12, 0.12, WOOD_L, qx, 0.27, qz + 0.14)); }
    return { group: g, top: (H + 1.2) * S, smoke,
      anim(tt) {
        sheaves.forEach(sh => { sh.rotation.z = tt * 1.6; });
        carts.forEach((cart, i) => {
          const ph = ((tt * 0.14 + i * 0.5) % 2), d = (ph < 1 ? ph : 2 - ph) * total, [x, z, alongX] = along(d);
          cart.position.set(x, 0.15, z); cart.rotation.y = alongX ? 0 : Math.PI / 2;
        });
      } };
  },

  // ---- Stamp Mill: a tall stepped timber mill, its row of iron stamps thumping up and
  // down, a brick smokestack and a water tank. As it grows: lamps, then a second battery of
  // stamps and strings of lights, a taller banded stack with a lit sign, and at the top
  // red-painted roofs and a second stack.
  stampmill(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const roofC = t >= 8 ? 0xa8322a : color;
    // three stepped sheds, tallest at the back
    for (const [x, z, w, d, h] of [[-0.25, -1.2, 3.2, 1.3, 3.6], [-0.15, -0.2, 3.0, 1.0, 2.6], [-0.05, 0.6, 2.7, 0.8, 1.7]]) {
      c.add(box(w, h, d, GREY, x, 0.15, z)); battens(c, x, z, w, d, 0.15, h, GREY);
      const r = box(w + 0.2, 0.08, d + 0.2, roofC, x, 0.15 + h, z); r.rotation.x = -0.18; c.add(r);
      wWin(c, 'z', x - w / 3, h - 0.75, z + d / 2, 0.42, 0.42, TRIM, WARM); wWin(c, 'z', x + w / 3, h - 0.75, z + d / 2, 0.42, 0.42, TRIM, WARM);
      wWin(c, 'x', z, h - 0.75, x + w / 2, 0.36, 0.42, TRIM, WARM);
    }
    // the stamp battery out front: a frame, a camshaft, and a row of stamps
    const n = t >= 4 ? 10 : 5, bw = t >= 4 ? 3.2 : 2.4, bx = t >= 4 ? -0.4 : -0.3, bz = 1.4;
    c.add(box(bw, 0.4, 0.55, 0x5a4632, bx, 0.15, bz));
    for (const e of [-bw / 2 + 0.05, bw / 2 - 0.05]) c.add(box(0.14, 2.2, 0.14, WOOD_D, bx + e, 0.15, bz));
    if (t >= 4) c.add(box(0.14, 2.2, 0.14, WOOD_D, bx, 0.15, bz));
    c.add(box(bw + 0.1, 0.16, 0.16, WOOD_D, bx, 2.3, bz));
    c.add(cyl(0.06, 0.06, bw - 0.1, 0x3a3f48, bx, 1.75 - (bw - 0.1) / 2, bz + 0.2, 8).rotateZ(Math.PI / 2));
    const stamps = [];
    for (let k = 0; k < n; k++) {
      const st = new THREE.Group();
      st.add(box(0.07, 1.6, 0.07, 0x5a5f66, 0, 0, 0), box(0.18, 0.22, 0.18, 0x3a3f48, 0, -0.05, 0), box(0.15, 0.08, 0.15, 0x6a6e76, 0, 1.2, 0));
      st.position.set(bx - bw / 2 + 0.3 + k * (bw - 0.6) / (n - 1), 0.55, bz); c.add(st); stamps.push(st);
    }
    wSign(c, 'z', -0.1, 1.42, 1.0, 1.9, 0.3, 0x2a2420, 5, 0xe8c46a, 'STAMP MILL');
    // the smokestack, taller and banded as the mill grows, and a second one at the top
    const smoke = [], sh = t >= 6 ? 5.4 : 4.4;
    const stack = (x, z, h) => {
      c.add(box(0.55, 0.45, 0.55, BRICK, x, 0.15, z), cyl(0.2, 0.26, h, BRICK, x, 0.6, z, 12), cyl(0.28, 0.28, 0.16, 0x3a3f48, x, 0.6 + h, z, 12));
      if (t >= 6) for (const k of [0.7, 0.85]) c.add(cyl(0.225, 0.225, 0.12, k === 0.7 ? TRIM : 0x3a3f48, x, 0.6 + h * k, z, 12));
      smoke.push(new THREE.Vector3(x, 0.8 + h, z));
    };
    stack(1.45, -1.45, sh); if (t >= 8) stack(-1.45, -1.45, sh - 0.8);
    // a water tank on its stilts beside the mill, piped to the battery
    waterTower(c, 1.5, 0.6, 1.5, 0.4);
    rod(c, [1.5, 1.6, 0.95], [bx + bw / 2, 1.9, bz], 0.04, 0x5a5f66);
    // lamps, then strings of electric lights along the front
    for (const lx of [-1.2, 0.9]) c.add(box(0.12, 0.18, 0.12, 0xfff1cf, lx, 1.95, 1.05, { emissive: 0xffc070, night: 2.6 }));
    if (t >= 4) { rod(c, [bx - bw / 2, 2.38, bz + 0.1], [bx + bw / 2, 2.38, bz + 0.1], 0.008, 0x2a2d33); for (let k = 0; k < 9; k++) c.add(box(0.06, 0.06, 0.06, 0xfff1cf, bx - bw / 2 + 0.2 + k * (bw - 0.4) / 8, 2.32, bz + 0.12, { emissive: 0xffd28a, night: 3 })); }
    if (t >= 6) { c.add(box(1.8, 0.5, 0.08, 0x2a2420, -0.25, 3.95, -0.52)); textPanel(c, 'z', -0.25, 4.0, -0.47, 1.65, 0.38, 'GOLD STAMPS', 0x2a2420, 0xffd76a); for (const e of [-0.6, 0.6]) c.add(box(0.06, 0.4, 0.06, WOOD_D, -0.25 + e, 3.75, -0.56)); }
    // the drive belt up to the camshaft, and a catwalk along the top shed
    const belt = box(0.12, 0.03, 1.2, 0x2a2420, 0.95, 1.7, 0.9); belt.rotation.x = 0.6; c.add(belt);
    c.add(box(3.2, 0.06, 0.35, 0x8a6a45, -0.25, 3.0, -0.4)); for (let k = 0; k < 7; k++) c.add(box(0.04, 0.4, 0.04, CREAM, -1.75 + k * 0.5, 3.06, -0.25));
    c.add(box(3.2, 0.04, 0.04, CREAM, -0.25, 3.44, -0.25));
    hay(g, -2.9, 2.9, 0.15, 0.3); barrel(g, 2.7, 2.9); barrel(g, 3.0, 2.6);
    smoke.forEach(v => v.multiplyScalar(S));
    return { group: g, top: (sh + 1.2) * S, smoke, anim(tt) { stamps.forEach((st, i) => { const p = (tt * 1.4 + i * 0.37) % 1; st.position.y = 0.55 + (p < 0.75 ? p / 0.75 : 1 - (p - 0.75) / 0.25) * 0.4; }); } };
  },

  // ---- Frontier Bank: a solid two-storey bank painted slate blue, with a corner entrance,
  // white columns and trim, a gilded BANK sign, barred windows and a balcony
  bank(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.15, z = -0.3, w = 3.6, d = 3.0, h = 2.9;
    c.add(box(w + 0.1, 0.3, d + 0.24, 0x8a7a65, x, 0, z));
    c.add(box(w, h, d, color, x, 0.3, z));
    // horizontal clapboards on the visible faces
    for (let y = 0.45; y < h + 0.2; y += 0.2) { c.add(onWall('z', x, y, z + d / 2, w, 0.025, 0.02, shade(color, -0.2))); c.add(onWall('x', z, y, x + w / 2, d, 0.025, 0.02, shade(color, -0.2))); }
    // a stepped false front with a big gilded sign
    c.add(box(w + 0.1, 0.9, 0.16, color, x, 0.3 + h, z + d / 2 - 0.05), box(w * 0.45, 0.35, 0.16, color, x, 1.2 + h, z + d / 2 - 0.05));
    c.add(box(w + 0.3, 0.12, 0.3, TRIM, x, 1.15 + h, z + d / 2), box(w * 0.45 + 0.2, 0.1, 0.28, TRIM, x, 1.53 + h, z + d / 2));
    wSign(c, 'z', x, h + 0.42, z + d / 2 + 0.02, 2.0, 0.55, 0x2a2d33, 4, 0xe8c46a, 'BANK');
    // stone quoins up the front corners, a brick chimney, and a lettered panel over the door
    for (let k = 0; k < 7; k++) for (const e of [-1, 1]) { const qw = k % 2 ? 0.22 : 0.34; c.add(onWall('z', x + e * (w / 2 - qw / 2), 0.35 + k * 0.4, z + d / 2, qw, 0.34, 0.05, 0xd8d0c0)); c.add(onWall('x', z + d / 2 - qw / 2, 0.35 + k * 0.4, x + w / 2, qw, 0.34, 0.05, 0xd8d0c0)); }
    c.add(box(0.5, 1.0, 0.5, BRICK, x - 1.2, 0.3 + h, z - 0.8), box(0.6, 0.1, 0.6, 0x5a3a2a, x - 1.2, 1.3 + h, z - 0.8));
    textPanel(c, 'z', x + 1.55, 1.93, z + d / 2 + 0.38, 1.0, 0.18, 'EST. 1872', 0x2a2d33, 0xe8c46a);
    // a round clock face on the corner over the entrance
    const clock = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 20), CREAM); clock.rotation.x = Math.PI / 2; clock.position.set(x + 1.55, 2.6, z + d / 2 + 0.06); c.add(clock);
    c.add(box(0.03, 0.2, 0.02, 0x2a2d33, x + 1.55, 2.6, z + d / 2 + 0.1), box(0.14, 0.03, 0.02, 0x2a2d33, x + 1.6, 2.6, z + d / 2 + 0.1));
    // windows with bars, two floors, front and side
    for (const a of [-1.2, 0.6]) for (const y of [0.85, 2.15]) { wWin(c, 'z', x + a, y, z + d / 2, 0.55, 0.7, TRIM, y > 1 ? WARM : GLASS, y > 1 ? 0x2a3a4a : null); if (y < 1) for (let k = 0; k < 4; k++) c.add(onWall('z', x + a - 0.2 + k * 0.13, y, z + d / 2 + 0.07, 0.03, 0.7, 0.03, 0x2a2d33)); }
    for (const a of [-0.8, 0.5]) for (const y of [0.85, 2.15]) wWin(c, 'x', z + a, y, x + w / 2, 0.55, 0.7);
    // the entrance: a cut corner with double doors under a little pediment and columns
    c.add(onWall('z', x + 1.55, 0.3, z + d / 2, 0.8, 1.4, 0.06, 0x3a2a1e));
    c.add(onWall('z', x + 1.55, 0.3, z + d / 2 + 0.04, 0.03, 1.4, 0.04, 0xc9a24a));
    for (const e of [-0.55, 0.55]) c.add(cyl(0.08, 0.09, 1.5, TRIM, x + 1.55 + e, 0.3, z + d / 2 + 0.25, 10));
    c.add(box(1.4, 0.12, 0.45, TRIM, x + 1.55, 1.8, z + d / 2 + 0.15));
    c.add(box(1.0, 0.14, 0.5, 0x8a7a65, x + 1.55, 0.15, z + d / 2 + 0.3), box(1.0, 0.14, 0.3, 0x8a7a65, x + 1.55, 0.29, z + d / 2 + 0.2));
    balcony(c, { axis: 'z', a: x - 0.75, f: z + d / 2, len: 2.0, y: 1.75 });
    // as the town gets rich: striped awnings, then a clock cupola on the roof, then a
    // gilded dome with a flag, and at the top a gold eagle and a sign ringed with bulbs
    if (t >= 3) for (const a of [-1.2, 0.6]) for (let k = 0; k < 4; k++) { const st = box(0.19, 0.05, 0.42, k % 2 ? TRIM : 0xa8322a, x + a - 0.28 + k * 0.19, 1.6, z + d / 2 + 0.2); st.rotation.x = 0.35; c.add(st); }
    let crown = 0.3 + h + 1.6;
    if (t >= 5) {
      const ux = x - 0.45, uz = z - 0.55, uy = 0.3 + h;
      c.add(box(1.0, 0.6, 1.0, TRIM, ux, uy, uz), cyl(0.42, 0.45, 0.7, color, ux, uy + 0.6, uz, 8));
      const cf = mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 18), CREAM); cf.rotation.x = Math.PI / 2; cf.position.set(ux, uy + 0.95, uz + 0.43); c.add(cf);
      c.add(box(0.02, 0.16, 0.02, 0x2a2d33, ux, uy + 0.95, uz + 0.46), box(0.12, 0.02, 0.02, 0x2a2d33, ux + 0.05, uy + 0.95, uz + 0.46));
      const dome = mesh(new THREE.SphereGeometry(0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), t >= 7 ? 0xd9a83a : SHINGLE, t >= 7 ? { metalness: 0.7, roughness: 0.3 } : undefined); dome.position.set(ux, uy + 1.3, uz); c.add(dome);
      crown = uy + 1.75;
      if (t >= 7) { c.add(box(0.03, 0.9, 0.03, 0xdddddd, ux, crown, uz), box(0.4, 0.25, 0.02, 0x3a5a9a, ux + 0.21, crown + 0.6, uz)); crown += 0.9; }
      if (t >= 9) { const eg = new THREE.Group(); eg.add(box(0.14, 0.2, 0.12, 0xd9a83a, 0, 0, 0)); for (const e of [-1, 1]) { const wg = box(0.3, 0.04, 0.12, 0xd9a83a, e * 0.18, 0.15, 0); wg.rotation.z = e * 0.5; eg.add(wg); } eg.position.set(x + 1.4, 0.3 + h + 1.65, z + d / 2 - 0.05); c.add(eg); }
    }
    if (t >= 9) for (let k = 0; k < 10; k++) c.add(box(0.05, 0.05, 0.04, 0xfff1cf, x - 1.0 + k * 0.22, h + 1.02, z + d / 2 + 0.06, { emissive: 0xffd28a, night: 3 }));
    // a lamp by the door, a hitching rail and a strongbox wagon waiting out front
    c.add(box(0.12, 0.2, 0.12, 0xfff1cf, x + 0.75, 1.75, z + d / 2 + 0.05, { emissive: 0xffd28a, night: 2.4 }));
    hitchRail(g, -2.5, 2.4, 1.2); horse(g, -2.6, 2.05, 0.1, 0x3a2a1e);
    barrel(g, 2.5, -2.5); crate(g, 2.75, -2.1);
    return { group: g, top: Math.max(h + 2.2, crown + 0.3) * S };
  },

  // ---- General Store: a green false front with DRY GOODS signs, a deep porch stacked
  // with barrels, sacks and crates, a ramp, and a wagon wheel leaning by the steps
  genstore(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    // as it grows: striped awnings, then an upstairs with dormer windows and a rooftop
    // billboard, then strings of lights and a flag
    if (t >= 5) {
      c.add(box(2.6, 1.0, 1.6, color, -0.3, 2.15, -1.05)); battens(c, -0.3, -1.05, 2.6, 1.6, 2.15, 1.0, color);
      const rf = mesh(new THREE.CylinderGeometry(0.0, 1.0, 0.7, 4, 1).rotateY(Math.PI / 4), SHINGLE); rf.scale.set(1.95, 1, 1.2); rf.position.set(-0.3, 3.5, -1.05); c.add(rf);
      for (const a of [-1.0, 0.0, 1.0]) { c.add(box(0.42, 0.42, 0.35, TRIM, -0.3 + a, 2.6, -0.3)); c.add(onWall('z', -0.3 + a, 2.66, -0.12, 0.28, 0.28, 0.02, WARM, { emissive: 0xff9a3a, emissiveIntensity: 0.5 })); }
      for (const e of [-0.7, 0.7]) c.add(box(0.06, 0.7, 0.06, WOOD_D, -0.3 + e, 3.3, -1.8));
      c.add(box(1.8, 0.5, 0.08, 0xf1e6c8, -0.3, 3.8, -1.8)); textPanel(c, 'z', -0.3, 3.82, -1.75, 1.7, 0.42, 'SUPPLIES', 0xf1e6c8, 0xa8322a);
    }
    const top = falseFront(c, { x: -0.12, z: -0.6, w: 3.3, d: 2.6, h: 2.0, fh: 1.0, color, sign: 0x2a3a2a, text: 'GENERAL STORE' });
    if (t >= 3) for (const a of [-1.2, 0.5]) for (let k = 0; k < 4; k++) { const st = box(0.19, 0.05, 0.42, k % 2 ? TRIM : 0x3a7a4a, -0.35 + a - 0.28 + k * 0.19, 1.6, 0.92); st.rotation.x = 0.35; c.add(st); }
    if (t >= 7) { rod(c, [-1.9, 1.75, 1.7], [1.3, 1.75, 1.7], 0.008, 0x2a2d33); for (let k = 0; k < 9; k++) c.add(box(0.06, 0.06, 0.06, 0xfff1cf, -1.75 + k * 0.38, 1.69, 1.7, { emissive: 0xffd28a, night: 3 })); c.add(box(0.03, 1.0, 0.03, 0xdddddd, 1.2, top, -0.5), box(0.4, 0.26, 0.02, 0xa8322a, 1.41, top + 0.7, -0.5)); }
    for (const a of [-1.2, 0.5]) wWin(c, 'z', -0.35 + a, 0.85, 0.7, 0.7, 0.9, TRIM, WARM);
    c.add(onWall('z', -0.05 + 0.6, 0.25, 0.7, 0.75, 1.45, 0.05, 0x3a2a1e));
    wSign(c, 'z', -1.25, 1.95, 0.7, 1.0, 0.28, 0xb5532a, 4, CREAM, 'DRY GOODS');
    wSign(c, 'z', 0.55, 1.95, 0.7, 1.0, 0.28, 0x2a2d33, 4, CREAM, 'FEED & SEED');
    // a bench, a hanging lantern, a coffee sign on the side wall, and a rack of brooms
    // and shovels by the door
    c.add(box(0.9, 0.06, 0.28, 0x8a6a45, -0.35, 0.62, 1.35), box(0.05, 0.38, 0.26, 0x6e5232, -0.75, 0.25, 1.35), box(0.05, 0.38, 0.26, 0x6e5232, 0.05, 0.25, 1.35));
    c.add(box(0.13, 0.2, 0.13, 0xfff1cf, 0.0, 1.45, 1.45, { emissive: 0xffc070, night: 2.6 }), box(0.02, 0.15, 0.02, 0x2a2d33, 0.0, 1.65, 1.45));
    textPanel(c, 'x', -0.35, 1.25, 1.47, 0.9, 0.36, 'COFFEE', 0xb5532a, CREAM);
    for (let k = 0; k < 4; k++) { const br = box(0.04, 0.9, 0.04, k % 2 ? 0xc9a24a : 0x6e5232, 1.2 + k * 0.08, 0.25, 0.85); br.rotation.z = 0.12; c.add(br); }
    wWin(c, 'x', -1.3, 0.85, 1.45, 0.5, 0.7, TRIM, GLASS, 0x6e4a2c); wWin(c, 'x', 0.45, 0.85, 1.45, 0.5, 0.7, TRIM, GLASS, 0x6e4a2c);
    porch(c, { axis: 'z', a: -0.12, f: 0.7, len: 3.3, depth: 1.0, h: 1.75, color: TRIM });
    for (const [bx, bz] of [[-1.9, 1.35], [-1.55, 1.45], [1.15, 1.4]]) barrel(c, bx, bz, 0.25);
    for (const [cx, cz] of [[-1.1, 1.45]]) { crate(c, cx, cz, 0.25); crate(c, cx, cz, 0.65, 0.34); }
    for (let k = 0; k < 3; k++) { const s = mesh(new THREE.SphereGeometry(0.17, 8, 6), 0xd8c49a); s.scale.set(1, 0.75, 0.8); s.position.set(0.95 + k * 0.08, 0.38 + (k === 2 ? 0.2 : 0), 1.25 + (k % 2) * 0.12); c.add(s); }
    wheel(c, 1.2, 0.53, 1.8, 0.36, 0.4);
    // a delivery wagon out back and a woodpile
    for (let k = 0; k < 4; k++) g.add(cyl(0.09, 0.09, 1.0, 0x8a6a45, 2.6, 0.24 + Math.floor(k / 2) * 0.17 - 0.5, -2.0 + (k % 2) * 0.2, 7).rotateZ(Math.PI / 2));
    hay(g, 2.6, -2.7, 0.15, 0.2); barrel(g, -2.75, -2.6);
    return { group: g, top: Math.max(top + 0.6, t >= 5 ? 4.3 : 0) * S };
  },

  // ---- Livery Stable: a big barn-fronted stable with tall double doors, a hay loft with a
  // pulley beam, a split-rail corral with horses, hay bales and a water trough
  livery(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const top = falseFront(c, { x: -0.25, z: -0.7, w: 3.2, d: 2.4, h: 2.5, fh: 1.1, color, sign: 0xb5532a, text: 'LIVERY STABLE' });
    // as it grows: a cupola with a horse weathervane, then a carriage shed roof along the
    // side with a buggy under it, then lanterns strung across the front
    if (t >= 3) {
      c.add(box(0.7, 0.6, 0.7, TRIM, -0.4, 2.75, -1.1)); for (const e of [-0.2, 0.2]) c.add(onWall('z', -0.4 + e, 2.85, -0.75, 0.12, 0.38, 0.02, 0x3a2a1e));
      const cr = mesh(new THREE.ConeGeometry(0.55, 0.45, 4), SHINGLE); cr.rotation.y = Math.PI / 4; cr.position.set(-0.4, 3.57, -1.1); c.add(cr);
      c.add(box(0.03, 0.4, 0.03, 0x2a2d33, -0.4, 3.75, -1.1), box(0.36, 0.14, 0.03, 0x2a2d33, -0.4, 4.1, -1.1), box(0.08, 0.14, 0.03, 0x2a2d33, -0.25, 4.22, -1.1));
    }
    // a smithy's brick chimney at the back, smoking while the farrier works
    const smoke = [];
    if (t >= 5) { c.add(box(0.45, 1.6, 0.45, BRICK, 0.85, 2.3, -1.45), box(0.55, 0.08, 0.55, 0x5a3a2a, 0.85, 3.9, -1.45)); smoke.push(new THREE.Vector3(0.85, 4.1, -1.45).multiplyScalar(S));
      const an = new THREE.Group(); an.add(box(0.36, 0.12, 0.16, 0x2a2d33, 0, 0, 0), box(0.18, 0.12, 0.12, 0x2a2d33, 0, -0.12, 0), box(0.12, 0.06, 0.1, 0x2a2d33, 0.22, 0.03, 0)); an.position.set(1.0, 1.65, 0.75); c.add(an, box(0.03, 0.25, 0.03, 0x2a2d33, 1.0, 1.75, 0.75)); }
    if (t >= 7) { rod(c, [-2.0, 2.3, 0.62], [1.2, 2.3, 0.62], 0.008, 0x2a2d33); for (let k = 0; k < 8; k++) c.add(box(0.08, 0.1, 0.08, 0xfff1cf, -1.8 + k * 0.42, 2.18, 0.62, { emissive: 0xffc070, night: 3 })); }
    // lanterns either side of the doors and a big horseshoe nailed up over them (for luck)
    for (const e of [-1.2, 1.2]) c.add(box(0.13, 0.2, 0.13, 0xfff1cf, -0.6 + e, 1.6, 0.58, { emissive: 0xffc070, night: 2.6 }));
    const shoe = mesh(new THREE.TorusGeometry(0.2, 0.045, 6, 14, Math.PI * 1.4), 0x8a8f99, { metalness: 0.6, roughness: 0.4 }); shoe.rotation.z = -Math.PI * 0.2; shoe.position.set(-0.6, 2.9, 0.58); c.add(shoe);
    // a saddle on a rail by the door and a feed bin
    c.add(box(0.9, 0.05, 0.05, WOOD_D, 1.1, 0.85, 0.7), box(0.05, 0.6, 0.05, WOOD_D, 0.7, 0.25, 0.7), box(0.05, 0.6, 0.05, WOOD_D, 1.5, 0.25, 0.7));
    c.add(box(0.36, 0.14, 0.3, 0x5a2a1a, 1.1, 0.88, 0.7), box(0.12, 0.1, 0.12, 0x3a2418, 1.0, 1.02, 0.7));
    c.add(box(0.6, 0.45, 0.4, 0x8a6a45, -1.55, 0.25, 0.85), box(0.65, 0.05, 0.45, 0x6e4a2c, -1.55, 0.7, 0.85));
    // big double doors with Z-braces, and the loft door above with a hay-hoist beam
    for (const e of [-0.45, 0.45]) { c.add(onWall('z', -0.6 + e, 0.25, 0.5, 0.86, 1.75, 0.06, shade(color, -0.12))); const zb = onWall('z', -0.6 + e, 1.0, 0.56, 0.08, 1.6, 0.03, TRIM); zb.rotation.z = e > 0 ? 0.45 : -0.45; c.add(zb); c.add(onWall('z', -0.6 + e, 0.35, 0.56, 0.8, 0.07, 0.03, TRIM), onWall('z', -0.6 + e, 1.9, 0.56, 0.8, 0.07, 0.03, TRIM)); }
    c.add(onWall('z', -0.6, 2.15, 0.5, 0.7, 0.55, 0.06, 0x3a2a1e));
    c.add(box(0.12, 0.12, 0.8, WOOD_D, -0.6, 2.85, 0.75)); rod(c, [-0.6, 2.85, 1.12], [-0.6, 1.9, 1.12], 0.015, 0x3a3020);
    hay(c, -0.6, 1.0, 1.75, 0);
    wWin(c, 'x', -1.6, 1.1, 1.2, 0.5, 0.5, TRIM, GLASS, 0xb5532a); wWin(c, 'x', -0.2, 1.1, 1.2, 0.5, 0.5, TRIM, GLASS, 0xb5532a);
    // the corral: split rails round the front-right corner with two horses
    const cx0 = 1.75, cx1 = 3.6, cz0 = 1.5, cz1 = 3.6;
    for (const [x0, z0, x1, z1] of [[cx0, cz1, cx1, cz1], [cx1, cz0, cx1, cz1], [cx0, cz0, cx0, cz1]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.round(len / 0.75);
      for (let k = 0; k <= n; k++) g.add(box(0.08, 0.8, 0.08, WOOD_D, x0 + (x1 - x0) * k / n, 0.15, z0 + (z1 - z0) * k / n));
      for (const y of [0.45, 0.78]) g.add(x0 === x1 ? box(0.06, 0.06, len, 0x8a6a45, x0, y, (z0 + z1) / 2) : box(len, 0.06, 0.06, 0x8a6a45, (x0 + x1) / 2, y, z0));
    }
    const h1 = horse(g, 2.3, 2.6, 0.6, 0x7a4a2a), h2 = horse(g, 3.0, 2.45, 2.3, 0xd8c8b0);
    hitchRail(g, 2.7, 3.15, 0.9);
    hay(g, -3.2, 2.9, 0.15, 0.4); hay(g, -3.1, 3.5, 0.15, 0.1); hay(g, -3.15, 3.2, 0.51, 0.25);
    barrel(g, 2.7, -2.6); wheel(g, 2.75, 0.53, -1.9, 0.38, 0);
    return { group: g, top: (top + 0.6) * S, smoke, anim(t) { h1.rotation.y = 0.6 + Math.sin(t * 0.3) * 0.25; h2.position.x = 3.0 + Math.sin(t * 0.25) * 0.2; } };
  },

  // ---- Railroad Depot: a station under a wide bracketed roof, a plank platform, and a
  // short spur of track with a little steam locomotive shunting up and down it between
  // buffer stops (it never leaves the yard, so it never runs into the loading docks). As
  // it grows: a coal tender, then a signal and a baggage cart, then an upstairs for the
  // stationmaster with a clock, and at the top a brass bell and bunting.
  depot(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.2, z = -1.25, w = 3.4, d = 1.5, h = 1.8;
    c.add(box(w + 0.1, 0.25, d + 0.1, 0x7a6a55, x, 0, z));
    c.add(box(w, h, d, color, x, 0.25, z)); battens(c, x, z, w, d, 0.25, h, color);
    c.add(box(w, 0.12, d, CREAM, x, 0.25 + h * 0.45, z));
    let roofTop = 0.25 + h;
    if (t >= 6) {
      // the stationmaster's upstairs, with a clock in the gable
      c.add(box(1.6, 0.9, 1.1, color, x - 0.6, 0.25 + h, z - 0.1)); battens(c, x - 0.6, z - 0.1, 1.6, 1.1, 0.25 + h, 0.9, color);
      for (const a of [-1.05, -0.15]) wWin(c, 'z', x + a, 0.25 + h + 0.25, z + 0.45, 0.36, 0.45, TRIM, WARM);
      const gr = mesh(new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4), SHINGLE); gr.scale.set(1.25, 0.55, 0.85); gr.position.set(x - 0.6, 0.25 + h + 0.9 + 0.27, z - 0.1); c.add(gr);
      const cf = mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.04, 16), CREAM); cf.rotation.x = Math.PI / 2; cf.position.set(x - 0.6, 0.25 + h + 1.2, z + 0.5); c.add(cf);
      c.add(box(0.02, 0.13, 0.02, 0x2a2d33, x - 0.6, 0.25 + h + 1.2, z + 0.53), box(0.1, 0.02, 0.02, 0x2a2d33, x - 0.56, 0.25 + h + 1.2, z + 0.53));
      roofTop = 0.25 + h + 1.5;
    }
    // a wide hipped roof hanging out over the platform, on brackets
    const roof = mesh(new THREE.ConeGeometry(1, 1, 4, 1).rotateY(Math.PI / 4), SHINGLE); roof.scale.set((w + 0.1) / 2 * 1.41, 0.6, (d + 0.4) / 2 * 1.41); roof.position.set(x, 0.25 + h + 0.3, z + 0.25); c.add(roof);
    for (const a of [-1.3, -0.4, 0.5, 1.4]) { const br = box(0.08, 0.08, 0.6, WOOD_D, x + a, 0.25 + h - 0.15, z + d / 2 + 0.25); br.rotation.x = 0.6; c.add(br); }
    for (const a of [-1.15, 0.25, 1.25]) wWin(c, 'z', x + a, 0.75, z + d / 2, 0.45, 0.8, TRIM, WARM);
    c.add(onWall('z', x - 0.45, 0.25, z + d / 2, 0.55, 1.3, 0.05, 0x3a2a1e));
    wSign(c, 'z', x + 0.75, h - 0.15, z + d / 2 + 0.02, 1.1, 0.3, 0x2a2d33, 5, CREAM, 'DEPOT');
    // the platform with a bench, a trunk and the station's name board
    c.add(box(w + 0.1, 0.18, 0.85, 0x8a6a45, x, 0.15, z + d / 2 + 0.42));
    c.add(box(0.9, 0.06, 0.26, 0x8a6a45, x + 0.5, 0.62, z + d / 2 + 0.3), box(0.05, 0.3, 0.24, 0x6e5232, x + 0.1, 0.33, z + d / 2 + 0.3), box(0.05, 0.3, 0.24, 0x6e5232, x + 0.9, 0.33, z + d / 2 + 0.3));
    c.add(box(0.45, 0.28, 0.28, 0x5a3a26, x + 1.35, 0.33, z + d / 2 + 0.35), box(0.47, 0.04, 0.3, 0xc9a24a, x + 1.35, 0.5, z + d / 2 + 0.35));
    for (const e of [-0.55, 0.55]) c.add(box(0.06, 0.95, 0.06, WOOD_D, x - 1.0 + e, 0.33, z + d / 2 + 0.7));
    textPanel(c, 'z', x - 1.0, 0.98, z + d / 2 + 0.74, 1.3, 0.28, 'TUMBLEWEED GULCH', 0xf1ece0, 0x2a2d33);
    // the spur of track between two buffer stops
    const tz = 0.75, L0 = -1.85, L1 = 1.85;
    for (let k = 0; k <= 12; k++) c.add(box(0.12, 0.06, 0.7, 0x5a4632, L0 + 0.1 + k * (L1 - L0 - 0.2) / 12, 0.14, tz));
    for (const e of [-0.22, 0.22]) c.add(box(L1 - L0, 0.06, 0.05, 0x8a8f99, (L0 + L1) / 2, 0.2, tz + e));
    for (const e of [L0 + 0.08, L1 - 0.08]) { c.add(box(0.16, 0.35, 0.6, 0x8a3a2a, e, 0.2, tz), box(0.18, 0.06, 0.62, 0x3a2a1e, e, 0.55, tz)); }
    // the locomotive: boiler, smokestack, cab, cowcatcher, wheels (and a coal tender)
    const train = new THREE.Group(), loco = new THREE.Group();
    loco.add(box(1.5, 0.12, 0.6, 0x2a2d33, 0, 0.32, 0));
    loco.add(cyl(0.27, 0.27, 1.0, 0x2a2d33, 0.2, 0.67 - 0.5, 0, 14).rotateZ(Math.PI / 2));
    for (const bx2 of [-0.05, 0.45]) loco.add(cyl(0.28, 0.28, 0.06, 0xc9a24a, bx2, 0.67 - 0.03, 0, 14).rotateZ(Math.PI / 2));
    loco.add(cyl(0.15, 0.09, 0.42, 0x2a2d33, 0.55, 0.9, 0, 10), cyl(0.1, 0.1, 0.12, 0xc9a24a, 0.22, 0.93, 0, 10));
    loco.add(box(0.5, 0.6, 0.62, color, -0.5, 0.44, 0), box(0.6, 0.06, 0.7, 0x2a2d33, -0.5, 1.04, 0));
    loco.add(box(0.2, 0.2, 0.05, WARM, -0.45, 0.7, 0.32, { emissive: 0xff9a3a, emissiveIntensity: 0.6 }));
    const cc = box(0.22, 0.24, 0.52, 0xb5532a, 0.82, 0.15, 0); cc.rotation.z = 0.5; loco.add(cc);
    loco.add(box(0.12, 0.12, 0.12, 0xfff1cf, 0.76, 0.75, 0, { emissive: 0xffd28a, night: 3 }));
    for (const wx of [-0.5, -0.05, 0.3, 0.62]) for (const e of [-0.28, 0.28]) loco.add(cyl(wx < 0 ? 0.19 : 0.13, wx < 0 ? 0.19 : 0.13, 0.05, 0xb5532a, wx, wx < 0 ? 0.19 : 0.13, e, 12).rotateX(Math.PI / 2));
    train.add(loco);
    let back = -0.8, front = 0.95;
    if (t >= 3) {
      const td = new THREE.Group();
      td.add(box(0.7, 0.4, 0.58, 0x2a2d33, 0, 0.3, 0), box(0.6, 0.12, 0.5, 0x1a1a1c, 0, 0.7, 0));
      for (const e of [-0.28, 0.28]) for (const wx of [-0.2, 0.2]) td.add(cyl(0.13, 0.13, 0.05, 0xb5532a, wx, 0.13, e, 10).rotateX(Math.PI / 2));
      td.position.x = -1.25; train.add(td); back = -1.62;
    }
    train.position.set(0, 0.17, tz); c.add(train);
    const lo = L0 + 0.2 - back, hi = L1 - 0.2 - front, mid = (lo + hi) / 2, amp = Math.max(0, (hi - lo) / 2);
    // a signal and a baggage cart, then a bell and bunting
    if (t >= 5) {
      c.add(box(0.06, 2.0, 0.06, 0x3a3f48, x + 1.55, 0.33, z + d / 2 + 0.7));
      const arm = box(0.5, 0.08, 0.03, 0xd9482b, x + 1.75, 2.1, z + d / 2 + 0.72); arm.rotation.z = -0.5; c.add(arm);
      c.add(box(0.1, 0.1, 0.06, 0x7dff9a, x + 1.55, 2.2, z + d / 2 + 0.74, { emissive: 0x4dff7a, night: 2.5 }));
      c.add(box(0.7, 0.06, 0.4, 0x8a6a45, x - 1.0, 0.55, z + d / 2 + 0.35)); crate(c, x - 1.15, z + d / 2 + 0.35, 0.58, 0.28); barrel(c, x - 0.8, z + d / 2 + 0.35, 0.58, 0.6);
    }
    if (t >= 8) {
      c.add(box(0.06, 0.5, 0.06, WOOD_D, x + 0.5, roofTop - 0.1, z), box(0.4, 0.06, 0.06, WOOD_D, x + 0.5, roofTop + 0.4, z));
      c.add(cyl(0.08, 0.16, 0.22, 0xc9a24a, x + 0.5, roofTop + 0.2, z, 10, { metalness: 0.7, roughness: 0.3 }));
      for (let k = 0; k < 6; k++) c.add(box(0.5, 0.18, 0.02, [0xd9482b, TRIM, 0x3a5a9a][k % 3], x - 1.4 + k * 0.56, h - 0.05, z + d / 2 + 0.03));
    }
    // a water tower for the engines and a baggage cart, out in the corners
    waterTower(g, 2.85, -2.85, 2.2, 0.55);
    for (const [cx, cz] of [[-2.9, 2.7]]) { g.add(box(0.8, 0.08, 0.5, 0x8a6a45, cx, 0.4, cz)); crate(g, cx - 0.15, cz, 0.48, 0.3); barrel(g, cx + 0.2, cz, 0.48, 0.8); for (const e of [-0.3, 0.3]) g.add(cyl(0.16, 0.16, 0.05, 0x5a3e26, cx + e, 0.16 + 0.16, cz + 0.27, 10).rotateX(Math.PI / 2)); }
    const smokeAt = new THREE.Vector3(0.55, 1.35, tz).multiplyScalar(S);
    const smoke = [smokeAt];
    return { group: g, top: Math.max(4.2, roofTop + 1.2) * S, smoke, anim(tt) {
      // shunting: ease out to one end, pause, ease back
      const p = (tt * 0.08) % 1, e = p < 0.4 ? p / 0.4 : p < 0.5 ? 1 : p < 0.9 ? 1 - (p - 0.5) / 0.4 : 0;
      const k = 0.5 - 0.5 * Math.cos(e * Math.PI);
      train.position.x = lo + (hi - lo) * k;
      smokeAt.set((train.position.x + 0.55) * S, 1.35 * S, tz * S);
    } };
  },

  // ---- Rocket Ranch: a red barn with white X doors where the rocket is built, a wooden
  // launch tower like an oil derrick, a brass-banded rocket on the pad, and a windmill
  rocketranch(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    // the barn (back left): red boards, a gambrel roof, white X-braced doors
    const bx = -1.0, bz = -1.0, bw = 1.8, bd = 1.8, bh = 1.5;
    c.add(box(bw, bh, bd, 0xa8322a, bx, 0.15, bz)); battens(c, bx, bz, bw, bd, 0.15, bh, 0xa8322a);
    const gs = new THREE.Shape(); gs.moveTo(-bw / 2 - 0.1, 0); gs.lineTo(bw / 2 + 0.1, 0); gs.lineTo(bw / 2 - 0.15, 0.55); gs.lineTo(0, 0.95); gs.lineTo(-bw / 2 + 0.15, 0.55); gs.closePath();
    const gg = new THREE.ExtrudeGeometry(gs, { depth: bd + 0.2, bevelEnabled: false }); gg.translate(0, 0, -(bd + 0.2) / 2);
    const gr = mesh(gg, 0xb9b4a8); gr.position.set(bx, 0.15 + bh, bz); c.add(gr);
    c.add(onWall('z', bx, 0.15, bz + bd / 2, 1.2, 1.2, 0.05, 0xa8322a));
    for (const e of [-1, 1]) { const x1 = onWall('z', bx, 0.75, bz + bd / 2 + 0.03, 1.55, 0.08, 0.03, TRIM); x1.rotation.z = e * 0.78; c.add(x1); }
    c.add(onWall('z', bx, 0.15, bz + bd / 2 + 0.03, 1.25, 0.08, 0.03, TRIM), onWall('z', bx, 1.35, bz + bd / 2 + 0.03, 1.25, 0.08, 0.03, TRIM));
    wSign(c, 'z', bx, bh + 0.25, bz + bd / 2 + 0.02, 1.5, 0.26, 0xf1ece0, 5, 0xa8322a, 'ROCKET RANCH');
    // a hay-loft door, a lantern, and a little brass rocket weathervane on the ridge
    c.add(onWall('x', bz, 0.75, bx + bw / 2, 0.6, 0.6, 0.05, shade(0xa8322a, -0.2)));
    c.add(box(0.12, 0.2, 0.12, 0xfff1cf, bx + 0.75, 1.35, bz + bd / 2 + 0.08, { emissive: 0xffc070, night: 2.6 }));
    c.add(box(0.03, 0.6, 0.03, 0x2a2d33, bx, bh + 1.05, bz));
    const vr = cyl(0.05, 0.05, 0.3, 0xc9a24a, bx, bh + 1.55 - 0.15, bz, 8); vr.rotation.z = Math.PI / 2; c.add(vr);
    const vt = mesh(new THREE.ConeGeometry(0.05, 0.12, 8), 0xc9a24a); vt.rotation.z = -Math.PI / 2; vt.position.set(bx + 0.21, bh + 1.55, bz); c.add(vt);
    const tri = mesh(new THREE.CircleGeometry(0.28, 3), TRIM); tri.position.set(bx, bh + 0.5, bz + bd / 2 + 0.12); tri.rotation.z = Math.PI / 2; c.add(tri);
    // the launch tower, a timber derrick beside the pad
    const px = 0.8, pz = 0.7;
    c.add(cyl(0.92, 1.0, 0.3, 0x8a7a65, px, 0.15, pz, 20));
    c.add(cyl(0.82, 0.82, 0.03, 0x3a3020, px, 0.45, pz, 20));
    timberTower(c, px - 1.45, pz - 0.2, 0.42, 0.2, 6.6, WOOD, 6);
    for (const y of [2.4, 4.0, 5.6]) { c.add(box(1.05, 0.1, 0.12, WOOD_D, px - 0.95, y, pz - 0.2)); }
    // as it grows: floodlights on the tower, a fuel tank by the barn, and lit bulbs up the tower
    if (t >= 4) for (const e of [-0.25, 0.25]) c.add(box(0.2, 0.16, 0.14, 0xfff1cf, px - 1.45 + e, 6.75, pz, { emissive: 0xffe2a8, night: 3 }));
    if (t >= 6) { waterTower(c, -1.5, 1.2, 1.4, 0.38); c.add(box(0.5, 0.18, 0.02, 0xd9482b, -1.5, 2.15, 1.58)); }
    if (t >= 8) for (let k = 0; k < 8; k++) c.add(box(0.06, 0.06, 0.06, 0xfff1cf, px - 1.45 + (k % 2 ? 0.2 : -0.2), 0.8 + k * 0.72, pz - 0.2 + (k % 2 ? 0.2 : -0.2), { emissive: 0xffd28a, night: 3 }));
    c.add(box(0.12, 0.12, 0.12, 0xff3b2f, px - 1.45, 6.8, pz - 0.2, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    const rocket = buildRocket('retro', color);
    rocket.position.set(px, 0.45, pz); c.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 5; i++) scaffold.add(box(1.4, 0.1, 1.4, 0x8a6a45, px, 0.9 + i * 1.25, pz));
    for (const [dx, dz] of [[-0.65, -0.65], [0.65, 0.65], [-0.65, 0.65], [0.65, -0.65]]) scaffold.add(box(0.1, 6.0, 0.1, WOOD_D, px + dx, 0.45, pz + dz));
    c.add(scaffold);
    // a windmill pumping water and barrels of rocket fuel
    const rotor = windmill(g, 2.6, -2.4, 3.6, 0.6);
    for (const [x, z] of [[2.8, 2.8], [3.2, 2.65], [3.0, 3.15]]) barrel(g, x, z, 0.15, 1.1);
    return { group: g, top: 8.6 * S, rocket, scaffold, anim(t, dt) { rotor.rotation.x += dt * 2.2; } };
  },

  // ---- Windmill Farm: farm windmills on lattice towers turning in the prairie wind, a
  // wooden water tank, and a dynamo shed with its lamp lit
  windmills(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    // four farm windmills (the tallest a big steel one once the farm grows)
    const big = t >= 5;
    const rotors = [windmill(c, -1.2, -1.25, big ? 6.0 : 5.0, big ? 1.05 : 0.95, big ? 0x8a8f99 : color), windmill(c, 1.25, -1.25, 4.2, 0.8, color), windmill(c, -1.3, 1.2, 3.6, 0.7, color), windmill(c, 1.35, 0.95, 3.2, 0.6, color)];
    waterTower(c, 0.0, 0.0, 1.4, 0.6);
    // the dynamo shed (a brick powerhouse with lit windows later on)
    const shedC = t >= 7 ? BRICK : GREY;
    c.add(box(1.3, 1.1, 0.9, shedC, 0.1, 0.15, 1.3)); if (t < 7) battens(c, 0.1, 1.3, 1.3, 0.9, 0.15, 1.1, GREY);
    const r = box(1.5, 0.06, 1.1, TIN, 0.1, 1.3, 1.3); r.rotation.x = 0.2; c.add(r);
    c.add(onWall('z', -0.15, 0.15, 1.75, 0.45, 0.9, 0.04, 0x3a2a1e));
    if (t >= 7) for (const a of [0.4]) wWin(c, 'z', 0.1 + a, 0.7, 1.75, 0.35, 0.45, TRIM, WARM);
    textPanel(c, 'z', 0.1, 1.08, 1.79, 1.1, 0.2, t >= 7 ? 'POWERHOUSE' : 'DYNAMO', 0x2a2d33, 0xe8c46a);
    c.add(box(0.14, 0.14, 0.14, 0xfff1cf, 0.6, 1.0, 1.8, { emissive: 0xffd28a, night: 2.6 }));
    // power poles carrying the current off, then strings of lights between the towers
    if (t >= 3) {
      for (const [x, z] of [[0.95, 1.55], [1.6, 0.2]]) { c.add(cyl(0.04, 0.05, 2.2, WOOD_D, x, 0.15, z, 6), box(0.5, 0.05, 0.05, WOOD_D, x, 2.25, z)); }
      rod(c, [0.7, 2.3, 1.55], [1.35, 2.3, 0.2], 0.008, 0x2a2d33); rod(c, [1.2, 2.3, 1.55], [1.85, 2.3, 0.2], 0.008, 0x2a2d33);
    }
    if (t >= 9) for (const [a, b] of [[[-1.2, 3.0, -1.25], [1.25, 3.0, -1.25]], [[-1.3, 2.6, 1.2], [-1.2, 3.0, -1.25]]]) { rod(c, a, b, 0.008, 0x2a2d33); for (let k = 1; k < 7; k++) { const f = k / 7; c.add(box(0.07, 0.07, 0.07, 0xfff1cf, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - Math.sin(f * Math.PI) * 0.15, a[2] + (b[2] - a[2]) * f, { emissive: 0xffd28a, night: 3 })); } }
    return { group: g, top: (big ? 7.0 : 6.0) * S, anim(tt, dt) { rotors.forEach((r, i) => { r.rotation.x += dt * (2.4 + i * 0.4); }); } };
  },

  // ---- Telegraph Office: a little false-front office with a bay window, telegraph poles
  // marching off with wires on glass insulators, and a key light blinking in Morse
  telegraph(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const top = falseFront(c, { x: -0.4, z: -0.7, w: 3.0, d: 2.4, h: 1.8, fh: 0.85, color: CREAM, sign: color, text: 'TELEGRAPH' });
    textPanel(c, 'z', 0.3, 1.6, 0.55, 0.8, 0.2, 'WIRES SENT', 0x2a2d33, CREAM);
    // a lamp by the door and a mail sack waiting for the stage
    c.add(box(0.13, 0.2, 0.13, 0xfff1cf, 0.85, 1.15, 0.55, { emissive: 0xffc070, night: 2.6 }));
    const sack = mesh(new THREE.SphereGeometry(0.2, 8, 6), 0xc8b48a); sack.scale.set(1, 0.8, 0.7); sack.position.set(1.4, 0.4, 0.2); c.add(sack);
    // a bay window on the front and a door
    c.add(box(1.1, 1.0, 0.35, CREAM, -1.2, 0.4, 0.65));
    for (const a of [-1.55, -1.2, -0.85]) c.add(onWall('z', a, 0.55, 0.82, 0.28, 0.7, 0.03, WARM, { emissive: 0xff9a3a, emissiveIntensity: 0.5 }));
    c.add(box(1.2, 0.08, 0.45, TRIM, -1.2, 1.4, 0.65));
    c.add(onWall('z', 0.3, 0.25, 0.5, 0.6, 1.3, 0.05, 0x3a2a1e));
    wWin(c, 'x', -1.3, 0.8, 1.0, 0.5, 0.6); wWin(c, 'x', -0.1, 0.8, 1.0, 0.5, 0.6);
    porch(c, { axis: 'x', a: -0.7, f: 1.0, len: 2.2, depth: 0.8, h: 1.5, color: TRIM });
    // the poles: two tall ones behind the office, each with crossarms and glass insulators,
    // the wires running between them and down to the roof (more arms as the line grows)
    const poles = [[-1.55, -1.55], [1.45, -1.5]], arms = t >= 4 ? 2 : 1, PH = 3.0;
    const tops = [];
    for (const [px, pz] of poles) {
      c.add(cyl(0.05, 0.07, PH, WOOD_D, px, 0.15, pz, 8));
      for (let a = 0; a < arms; a++) {
        const y = PH - a * 0.35;
        c.add(box(0.8, 0.07, 0.07, WOOD_D, px, y, pz));
        for (const e of [-0.3, -0.1, 0.1, 0.3]) { c.add(cyl(0.03, 0.025, 0.09, 0x6fd3c0, px + e, y + 0.07, pz, 6, { transparent: true, opacity: 0.85 })); tops.push([px + e, y + 0.15, pz, a]); }
      }
    }
    const per = arms * 4;
    for (let k = 0; k < per; k++) rod(c, tops[k].slice(0, 3), tops[per + k].slice(0, 3), 0.008, 0x2a2d33);
    rod(c, tops[0].slice(0, 3), [-1.1, top - 0.1, -0.9], 0.009, 0x2a2d33);
    rod(c, tops[per + 3].slice(0, 3), [1.6, PH + 0.6, 1.2], 0.008, 0x2a2d33);
    // later a heliograph on the roof flashing sunlight, then lights and a flag
    if (t >= 6) {
      for (let k = 0; k < 3; k++) { const a = k * 2.094; const l = box(0.03, 0.6, 0.03, WOOD_D, -1.0 + Math.cos(a) * 0.15, top - 0.15, -1.2 + Math.sin(a) * 0.15); l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); c.add(l); }
      const mir = box(0.32, 0.32, 0.03, 0xdff4ff, -1.0, top + 0.45, -1.2, { emissive: 0xffffff, emissiveIntensity: 0.3, metalness: 0.8, roughness: 0.1 }); mir.rotation.set(-0.5, 0.6, 0); c.add(mir);
    }
    if (t >= 8) { c.add(box(0.03, 1.0, 0.03, 0xdddddd, 0.6, top - 0.2, -1.4), box(0.42, 0.26, 0.02, 0x3a5a9a, 0.82, top + 0.5, -1.4)); for (let k = 0; k < 7; k++) c.add(box(0.05, 0.05, 0.04, 0xfff1cf, -1.6 + k * 0.4, 1.8 + 0.42, 0.55, { emissive: 0xffd28a, night: 3 })); }
    // the key light, blinking messages
    const key = box(0.16, 0.16, 0.16, 0xffe08a, -0.5, top - 0.1, -0.3, { emissive: 0xffc23d, emissiveIntensity: 1 }); key.material = key.material.clone(); c.add(key);
    barrel(g, 2.6, 2.6); crate(g, 2.3, 2.75);
    const code = [1, 0, 1, 1, 1, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0];
    return { group: g, top: (top + 0.5) * S, anim(t) { key.material.emissiveIntensity = code[Math.floor(t * 5) % code.length] ? 1.8 : 0.1; } };
  },

  // ---- The Saloon: a two-storey corner saloon with a wraparound balcony on turned posts,
  // swinging batwing doors, a big SALOON sign, horses at the rail and barrels by the door
  saloon(color, t = 0) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.4, z = -0.45, w = 3.2, d = 3.0, h = t >= 5 ? 3.7 : 3.0;
    c.add(box(w + 0.1, 0.25, d + 0.24, 0x7a6a55, x, 0, z));
    c.add(box(w, h, d, color, x, 0.25, z)); battens(c, x, z, w, d, 0.25, h, color);
    // a stepped, scalloped false front with the sign
    c.add(box(w + 0.1, 0.8, 0.16, color, x, 0.25 + h, z + d / 2 - 0.05));
    for (const [e, hh] of [[-1, 0.3], [0, 0.55], [1, 0.3]]) c.add(box(w * 0.3, hh, 0.16, color, x + e * w * 0.33, 1.05 + h, z + d / 2 - 0.05));
    c.add(box(w + 0.3, 0.1, 0.3, TRIM, x, 1.0 + h, z + d / 2));
    wSign(c, 'z', x, h + 0.3, z + d / 2 + 0.02, 2.2, 0.55, 0x2a2d33, 6, 0xe8c46a, 'SALOON');
    // upstairs doors onto the balcony, a hanging ROOMS sign, two brick chimneys and a
    // painted advert on the side wall
    for (const a of [-0.6, 0.6]) c.add(onWall('z', x + a, 1.82, z + d / 2, 0.42, 0.95, 0.04, 0x4a2a1a));
    textPanel(c, 'x', z + d / 2 - 0.2, 1.25, x + w / 2 + 0.72, 0.6, 0.22, t >= 5 ? 'HOTEL' : 'ROOMS', 0x8a2a1e, CREAM);
    for (const [cx2, cz2] of [[x - 1.2, z - 0.9], [x + 1.1, z - 0.9]]) c.add(box(0.4, 0.75, 0.4, BRICK, cx2, 0.25 + h, cz2), box(0.48, 0.08, 0.48, 0x5a3a2a, cx2, 1.0 + h, cz2));
    textPanel(c, 'x', z - 1.05, 0.95, x + w / 2 + 0.035, 0.8, 0.4, 'SARSAPARILLA', 0x8a2a1e, 0xf1e6c8);
    // upstairs windows and the wraparound balcony on turned posts
    for (const a of [-1.1, 0, 1.1]) { wWin(c, 'z', x + a, 2.0, z + d / 2, 0.5, 0.75, TRIM, WARM); if (t >= 5) wWin(c, 'z', x + a, 2.85, z + d / 2, 0.45, 0.6, TRIM, WARM); }
    for (const a of [-0.8, 0.5]) wWin(c, 'x', z + a, 2.0, x + w / 2, 0.5, 0.75, TRIM, WARM);
    balcony(c, { axis: 'z', a: x, f: z + d / 2, len: w + 0.4, y: 1.7, depth: 0.85 });
    balcony(c, { axis: 'x', a: z + 0.2, f: x + w / 2, len: d + 0.4, y: 1.7, depth: 0.7 });
    for (const a of [-1.55, -0.5, 0.5, 1.55]) c.add(cyl(0.06, 0.07, 1.5, TRIM, x + a, 0.25, z + d / 2 + 0.8, 8));
    for (const a of [-1.3, 0, 1.3]) c.add(cyl(0.06, 0.07, 1.5, TRIM, x + w / 2 + 0.65, 0.25, z + a, 8));
    c.add(box(w + 0.5, 0.12, 0.95, 0x8a6a45, x + 0.25, 0.12, z + d / 2 + 0.45));                     // the boardwalk
    c.add(box(0.8, 0.12, d + 0.6, 0x8a6a45, x + w / 2 + 0.38, 0.12, z + 0.2));
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
    // as it grows: bulbs round the sign, then (with the hotel floor) a water tank and a
    // flag on the roof, and at the top a gilded sign
    if (t >= 3) for (let k = 0; k < 9; k++) c.add(box(0.05, 0.05, 0.04, 0xfff1cf, x - 1.0 + k * 0.25, h + 0.92, z + d / 2 + 0.07, { emissive: 0xffd28a, night: 3 }));
    if (t >= 7) { for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) c.add(box(0.06, 0.5, 0.06, WOOD_D, x - 0.9 + dx, 0.25 + h, z - 0.6 + dz)); c.add(cyl(0.38, 0.4, 0.55, 0x8a5a32, x - 0.9, 0.75 + h, z - 0.6, 12), cyl(0.05, 0.42, 0.25, SHINGLE, x - 0.9, 1.3 + h, z - 0.6, 12)); c.add(box(0.03, 1.1, 0.03, 0xdddddd, x + 1.1, 0.25 + h, z - 0.9), box(0.45, 0.28, 0.02, 0xd9482b, x + 1.33, 0.25 + h + 0.8, z - 0.9)); }
    if (t >= 9) c.add(box(2.3, 0.08, 0.06, 0xd9a83a, x, h + 0.86, z + d / 2 + 0.06, { metalness: 0.7, roughness: 0.3 }));
    return { group: g, top: (h + 2.4) * S };
  },
});

export { signTex, textPanel, balcony, falseFront, porch, wWin, wSign, battens, barrel, hay, crate, wheel, hitchRail, horse, waterTower, windmill, timberTower, WOOD, WOOD_D, WOOD_L, GREY, TRIM, SHINGLE, CREAM };

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
