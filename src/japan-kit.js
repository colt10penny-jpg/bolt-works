// The Japanese world's building kit: sweeping tiled roofs that curve up at the corners,
// thatched roofs, white plaster walls framed in dark wood or vermilion, shoji screens that
// glow at night, lattice fronts, verandas with red railings, stone lanterns, torii gates,
// and the garden: cherry trees, maples, cloud-pruned pines, bamboo, clipped shrubs, moss,
// rocks and koi ponds. Used by buildings-japan.js, japan-upgrades.js and the world itself.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { box, cyl, mat, GLOW } from './models.js';

export const J = {
  PLASTER: 0xf3eee3, PLASTER2: 0xe9e1d0, WOOD: 0x6b4a30, WOOD_D: 0x3e2a1e, WOOD_L: 0xa07a52, VERM: 0xd2452c, VERM_D: 0xa8321f,
  TILE: 0x5d6574, TILE_D: 0x3e4450, THATCH: 0x8a6c48, STONE: 0xa8a49a, STONE_D: 0x7d7a72, MOSS: 0x6f8f3a, GOLD: 0xd9a83a,
  GRAVEL: 0xd8d4c8, KOI: 0xff7a2a, SAKURA: [0xf7c9d6, 0xf2b4c8, 0xfadbe4, 0xf5bfd0], MAPLE: [0xd9452b, 0xe86a2a, 0xc23524, 0xf08a3a],
  PINE: [0x2f5a32, 0x3a6a3a, 0x284e2c], LEAF: [0x4f8f3a, 0x5fa044, 0x3f7f34],
};
const { PLASTER, WOOD, WOOD_D, VERM, TILE, STONE, STONE_D, MOSS, GOLD } = J;

export const mesh = (geo, color, opts) => { const m = new THREE.Mesh(geo, mat(color, opts)); m.castShadow = true; m.receiveShadow = true; return m; };
export const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
export const shade = (hex, f) => { const c = new THREE.Color(hex); return f > 0 ? c.lerp(new THREE.Color(0xffffff), f).getHex() : c.multiplyScalar(1 + f).getHex(); };
export function rod(g, a, b, r, color) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), color);
  m.position.copy(A).add(B).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.add(m); return m;
}

// ---------- textures ----------
const TEX = {};
function canvas(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}
// rows of round clay tiles running down the roof (grey; the material tints them)
const tileTex = () => TEX.tile ||= canvas(64, 64, (g, w, h) => {
  for (let x = 0; x < w; x++) {
    const k = (x % 16) / 16, v = 0.55 + 0.45 * Math.sin(k * Math.PI);   // round tiles: light on top, dark in the gaps
    g.fillStyle = `rgb(${Math.round(255 * v)},${Math.round(255 * v)},${Math.round(255 * v)})`; g.fillRect(x, 0, 1, h);
  }
  g.fillStyle = 'rgba(0,0,0,0.18)'; for (let y = 0; y < h; y += 16) g.fillRect(0, y, w, 2);
});
// straw thatch: fine streaks running down
const thatchTex = () => TEX.thatch ||= canvas(64, 64, (g, w, h) => {
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h);
  let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) { const v = 150 + r() * 105; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1, 5 + r() * 12); }
  g.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < h; y += 21) g.fillRect(0, y, w, 2);
});
// a shoji screen: white paper in a fine dark wooden grid (glows warm after dark)
const shojiTex = () => TEX.shoji ||= canvas(64, 96, (g, w, h) => {
  g.fillStyle = '#fbf6ea'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#5a4030';
  for (let x = 0; x <= w; x += 16) g.fillRect(Math.min(w - 3, x), 0, 3, h);
  for (let y = 0; y <= h; y += 16) g.fillRect(0, Math.min(h - 3, y), w, 3);
  g.fillRect(0, 0, w, 5); g.fillRect(0, h - 5, w, 5); g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
});
// a lattice front (koshi): close dark slats over a shadowy room
const koshiTex = () => TEX.koshi ||= canvas(64, 64, (g, w, h) => {
  g.fillStyle = '#1e1612'; g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 8) { g.fillStyle = '#5e4230'; g.fillRect(x, 0, 5, h); g.fillStyle = '#7a5840'; g.fillRect(x, 0, 1, h); }
  g.fillStyle = '#4a3426'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4);
});
// raked gravel in straight lines
export const gravelTex = () => TEX.gravel ||= canvas(128, 128, (g, w, h) => {
  g.fillStyle = '#dedad0'; g.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 8) { g.fillStyle = 'rgba(120,110,95,0.35)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,0.5)'; g.fillRect(0, y + 3, w, 2); }
  let s = 9; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { const v = 170 + r() * 80; g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.6)`; g.fillRect(r() * w, r() * h, 1.5, 1.5); }
});
const MATS = new Map();
function texMat(key, make) { if (!MATS.has(key)) MATS.set(key, make()); return MATS.get(key); }
const tileMat = color => texMat('tile' + color, () => new THREE.MeshStandardMaterial({ color, map: tileTex(), roughness: 0.55, metalness: 0.15, side: THREE.DoubleSide }));
const thatchMat = color => texMat('th' + color, () => new THREE.MeshStandardMaterial({ color, map: thatchTex(), roughness: 1, side: THREE.DoubleSide }));
const shojiMat = () => texMat('shoji', () => { const m = new THREE.MeshStandardMaterial({ map: shojiTex(), emissive: 0xffc070, emissiveMap: shojiTex(), emissiveIntensity: 0, roughness: 0.9 }); m.userData.night = 0.9; GLOW.night.push(m); return m; });
const koshiMat = () => texMat('koshi', () => new THREE.MeshStandardMaterial({ map: koshiTex(), roughness: 0.85 }));

// ---------- roofs ----------
// A hip roof over a w x d plan (a = w/2 >= b = d/2): four sweeping faces, concave (steep
// near the ridge, flattening toward the eaves) and lifting at the corners like a temple
// roof, with a real thickness so the eave edge shows. Returns [top, underside] geometry.
function roofGeo(a, b, H, { lift = 0.3, pow = 1.7, thick = 0.12, tile = 0.3 } = {}) {
  if (b > a) { const [t, u] = roofGeo(b, a, H, { lift, pow, thick, tile }); t.rotateY(Math.PI / 2); u.rotateY(Math.PI / 2); return [t, u]; }
  const r = a - b, ST = 10, SS = 7;
  const faces = [
    [[-a, b], [a, b], [-r, 0], [r, 0]],
    [[a, -b], [-a, -b], [r, 0], [-r, 0]],
    [[a, b], [a, -b], [r, 0], [r, 0]],
    [[-a, -b], [-a, b], [-r, 0], [-r, 0]],
  ];
  const tops = [], unders = [];
  for (const [e0, e1, r0, r1] of faces) {
    const len = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]);
    const P = (t, s) => {
      const ex = e0[0] + (e1[0] - e0[0]) * t, ez = e0[1] + (e1[1] - e0[1]) * t;
      const rx = r0[0] + (r1[0] - r0[0]) * t, rz = r0[1] + (r1[1] - r0[1]) * t;
      const c = Math.pow(Math.abs(2 * t - 1), 6) * (1 - s) * (1 - s);
      return [ex + (rx - ex) * s, H * Math.pow(s, pow) + lift * c, ez + (rz - ez) * s];
    };
    const pos = [], uv = [], idx = [], pu = [], iu = [];
    for (let i = 0; i <= ST; i++) for (let j = 0; j <= SS; j++) {
      const t = i / ST, s = j / SS, p = P(t, s);
      pos.push(...p); uv.push(t * len / tile, s * 3);
      pu.push(p[0], p[1] - thick, p[2]);
    }
    const V = (i, j) => i * (SS + 1) + j;
    for (let i = 0; i < ST; i++) for (let j = 0; j < SS; j++) { idx.push(V(i, j), V(i + 1, j), V(i, j + 1), V(i + 1, j), V(i + 1, j + 1), V(i, j + 1)); iu.push(V(i, j), V(i, j + 1), V(i + 1, j), V(i + 1, j), V(i, j + 1), V(i + 1, j + 1)); }
    const top = new THREE.BufferGeometry(); top.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); top.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); top.setIndex(idx);
    // the underside, plus the eave edge joining it to the top
    const n = pu.length / 3;
    for (let i = 0; i <= ST; i++) { const p = P(i / ST, 0); pu.push(...p); }
    for (let i = 0; i < ST; i++) { const a0 = V(i, 0), a1 = V(i + 1, 0), b0 = n + i, b1 = n + i + 1; iu.push(a0, b1, b0, a0, a1, b1); }
    const und = new THREE.BufferGeometry(); und.setAttribute('position', new THREE.Float32BufferAttribute(pu, 3)); und.setIndex(iu);
    und.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pu.length / 3) * 2), 2));
    // make sure the top faces up
    top.computeVertexNormals(); und.computeVertexNormals();
    if (top.attributes.normal.getY(V(ST >> 1, SS >> 1)) < 0) { top.setIndex(idx.map((v, k) => k % 3 === 1 ? idx[k + 1] : k % 3 === 2 ? idx[k - 1] : v)); top.computeVertexNormals(); }
    tops.push(top.toNonIndexed()); unders.push(und.toNonIndexed());
  }
  const T = mergeGeometries(tops), U = mergeGeometries(unders);
  T.computeVertexNormals(); U.computeVertexNormals();
  return [T, U];
}
// put a roof over g: centre (x, z), eaves at height y, plan w x d (with the overhang);
// kind 'tile' (grey clay), 'thatch' or 'copper'; returns the ridge height
export function roof(g, { x = 0, y, z = 0, w, d, h, kind = 'tile', color, lift, under = WOOD, ridge = true, rot = 0 }) {
  const th = kind === 'thatch';
  const [tg, ug] = roofGeo(w / 2, d / 2, h, { lift: lift ?? (th ? 0.05 : Math.min(w, d) * 0.12), pow: th ? 1.15 : 1.7, thick: th ? 0.28 : 0.11, tile: th ? 0.6 : 0.26 });
  const grp = new THREE.Group();
  const top = new THREE.Mesh(tg, th ? thatchMat(color ?? J.THATCH) : tileMat(color ?? TILE)); top.castShadow = true; top.receiveShadow = true;
  const und = new THREE.Mesh(ug, mat(under, { side: THREE.DoubleSide })); und.castShadow = true;
  grp.add(top, und);
  if (ridge) {
    const r = Math.max(0, Math.max(w, d) / 2 - Math.min(w, d) / 2), along = w >= d;
    if (r > 0.05) {
      const rb = box(along ? r * 2 + 0.2 : 0.18, th ? 0.22 : 0.16, along ? 0.18 : r * 2 + 0.2, th ? shade(color ?? J.THATCH, -0.35) : J.TILE_D, 0, h - 0.04, 0);
      grp.add(rb);
      if (!th) for (const e of [-1, 1]) { const o = box(0.2, 0.28, 0.24, J.TILE_D, along ? e * (r + 0.08) : 0, h - 0.02, along ? 0 : e * (r + 0.08)); o.rotation.y = along ? 0 : Math.PI / 2; grp.add(o); }
    } else grp.add(cyl(0.05, 0.12, 0.25, th ? J.WOOD_D : J.TILE_D, 0, h - 0.05, 0, 8));
  }
  grp.position.set(x, y, z); grp.rotation.y = rot;
  g.add(grp);
  return y + h;
}
// a small triangular gable (chidori-hafu) set into a roof slope, facing +z
export function gable(g, x, y, z, w, h, face = PLASTER, rotY = 0) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.5, bevelEnabled: false }); geo.translate(0, 0, -0.5);
  const gr = new THREE.Group();
  gr.add(mesh(geo, face));
  for (const e of [-1, 1]) { const b = box(Math.hypot(w / 2, h) + 0.1, 0.08, 0.6, J.TILE_D, e * w / 4, h / 2 - 0.04, -0.25); b.rotation.z = -e * Math.atan2(h, w / 2); gr.add(b); }
  gr.position.set(x, y, z); gr.rotation.y = rotY; g.add(gr);
}

// ---------- walls ----------
// a wall panel facing +z (axis 'z') or +x (axis 'x') at f, centred at a along the wall
export function onWall(axis, a, y, f, w, h, d, color, opts) {
  const s = Math.sign(f) || 1;
  return axis === 'z' ? box(w, h, d, color, a, y, f + s * d / 2, opts) : box(d, h, w, color, f + s * d / 2, y, a, opts);
}
function plane(axis, a, y, f, w, h, material) {
  const s = Math.sign(f) || 1, m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
  if (axis === 'z') { m.position.set(a, y + h / 2, f + s * 0.012); if (s < 0) m.rotation.y = Math.PI; }
  else { m.position.set(f + s * 0.012, y + h / 2, a); m.rotation.y = s * Math.PI / 2; }
  m.receiveShadow = true;
  return m;
}
export const shoji = (g, axis, a, y, f, w, h) => { g.add(plane(axis, a, y, f, w, h, shojiMat())); g.add(onWall(axis, a, y - 0.04, f, w + 0.08, 0.05, 0.03, WOOD_D)); };
export const koshi = (g, axis, a, y, f, w, h) => g.add(plane(axis, a, y, f, w, h, koshiMat()));
// a walled hall: plaster between dark posts and beams, on a stone base. The camera sees
// the +z and +x faces, so those get the posts. Returns the wall top.
export function hall(g, { x = 0, z = 0, w, d, h, y0 = 0.15, wall = PLASTER, frame = WOOD_D, base = STONE, bay = 0.9, baseH = 0.22 }) {
  g.add(box(w + 0.16, baseH, d + 0.16, base, x, y0, z));
  const y = y0 + baseH;
  g.add(box(w, h, d, wall, x, y, z));
  for (const [axis, len, f, c] of [['z', w, z + d / 2, x], ['x', d, x + w / 2, z], ['z', w, z - d / 2, x], ['x', d, x - w / 2, z]]) {
    const n = Math.max(1, Math.round(len / bay));
    for (let i = 0; i <= n; i++) g.add(onWall(axis, c - len / 2 + (len * i) / n + (i === 0 ? 0.05 : i === n ? -0.05 : 0), y, f, 0.1, h, 0.04, frame));
    g.add(onWall(axis, c, y + h - 0.12, f, len, 0.1, 0.045, frame), onWall(axis, c, y + 0.04, f, len, 0.08, 0.045, frame));
  }
  return y + h;
}
// a veranda (engawa) along the +z side (or +x), with posts and a red railing
export function engawa(g, { axis = 'z', a = 0, f, len, depth = 0.55, y = 0.32, rail = VERM, posts = true }) {
  const s = Math.sign(f) || 1;
  const deck = onWall(axis, a, y - 0.06, f, len, 0.07, depth, J.WOOD_L); g.add(deck);
  for (let k = 0; k <= Math.round(len / 0.8); k++) {
    const p = a - len / 2 + (len * k) / Math.round(len / 0.8);
    g.add(axis === 'z' ? box(0.07, y - 0.06, 0.07, WOOD_D, p, 0.15, f + s * (depth - 0.06)) : box(0.07, y - 0.06, 0.07, WOOD_D, f + s * (depth - 0.06), 0.15, p));
  }
  if (rail) {
    for (let k = 0; k <= Math.round(len / 0.5); k++) { const p = a - len / 2 + (len * k) / Math.round(len / 0.5); g.add(axis === 'z' ? box(0.05, 0.32, 0.05, rail, p, y, f + s * (depth - 0.04)) : box(0.05, 0.32, 0.05, rail, f + s * (depth - 0.04), y, p)); }
    g.add(onWall(axis, a, y + 0.3, f + s * (depth - 0.08), len, 0.05, 0.08, rail), onWall(axis, a, y + 0.15, f + s * (depth - 0.07), len, 0.03, 0.06, rail));
  }
  if (posts) for (const e of [-1, 1]) g.add(axis === 'z' ? box(0.11, 1.6, 0.11, rail || WOOD_D, a + e * (len / 2 - 0.06), y, f + s * (depth - 0.06)) : box(0.11, 1.6, 0.11, rail || WOOD_D, f + s * (depth - 0.06), y, a + e * (len / 2 - 0.06)));
}
// a short curtain (noren) hanging over a doorway, split into panels, in a colour
export function noren(g, axis, a, y, f, w, color, mark = 0xffffff) {
  const n = Math.max(2, Math.round(w / 0.28)), pw = w / n - 0.02;
  for (let k = 0; k < n; k++) g.add(onWall(axis, a - w / 2 + (k + 0.5) * (w / n), y - 0.42, f + 0.02, pw, 0.42, 0.015, color));
  g.add(onWall(axis, a, y - 0.24, f + 0.04, 0.16, 0.16, 0.01, mark));
  g.add(onWall(axis, a, y, f + 0.02, w + 0.06, 0.03, 0.03, WOOD_D));
}

// ---------- signs ----------
const SIGNS = new Map();
// a carved wooden plaque with brush lettering (vertical when tall)
export function plaque(g, axis, a, y, f, w, h, text, { bg = 0x2e2018, ink = 0xf2d79a, frame = GOLD } = {}) {
  const key = text + bg + ink + (w / h).toFixed(2);
  if (!SIGNS.has(key)) {
    const vert = h > w * 1.4, W = vert ? 64 : Math.round(64 * w / h), Hh = vert ? Math.round(64 * h / w) : 64, sc = 2;
    const cv = document.createElement('canvas'); cv.width = W * sc; cv.height = Hh * sc;
    const c = cv.getContext('2d'), hex = n => '#' + n.toString(16).padStart(6, '0');
    c.fillStyle = hex(bg); c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = hex(ink); c.textAlign = 'center'; c.textBaseline = 'middle';
    const font = s => `700 ${s}px "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", "Noto Serif CJK SC", serif`;
    const chars = [...text];
    if (vert) { const s = Math.min(cv.width * 0.72, (cv.height * 0.86) / chars.length); c.font = font(s); chars.forEach((ch, i) => c.fillText(ch, cv.width / 2, cv.height * 0.07 + s * (i + 0.5))); }
    else { let s = cv.height * 0.62; c.font = font(s); const tw = c.measureText(text).width; if (tw > cv.width * 0.86) { s *= cv.width * 0.86 / tw; c.font = font(s); } c.fillText(text, cv.width / 2, cv.height / 2 + s * 0.05); }
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 });
    m.userData.night = 0.5; GLOW.night.push(m);
    SIGNS.set(key, m);
  }
  g.add(onWall(axis, a, y - 0.04, f, w + 0.08, h + 0.08, 0.05, frame));
  const s = Math.sign(f) || 1, p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), SIGNS.get(key));
  if (axis === 'z') { p.position.set(a, y + h / 2, f + s * 0.06); if (s < 0) p.rotation.y = Math.PI; } else { p.position.set(f + s * 0.06, y + h / 2, a); p.rotation.y = s * Math.PI / 2; }
  g.add(p);
}

// ---------- garden ----------
// a stone lantern (ishidoro): a base, a shaft, a light box that glows after dark, a roof
// with turned-up corners and a jewel on top
export function lantern(g, x, z, s = 1, y = 0.15) {
  const L = new THREE.Group();
  L.add(cyl(0.2, 0.24, 0.12, STONE_D, 0, 0, 0, 6), cyl(0.07, 0.09, 0.55, STONE, 0, 0.12, 0, 8), cyl(0.2, 0.14, 0.1, STONE, 0, 0.67, 0, 6));
  L.add(box(0.22, 0.2, 0.22, STONE, 0, 0.77, 0));
  for (const [dx, dz] of [[0, 0.115], [0.115, 0]]) L.add(box(dz ? 0.12 : 0.02, 0.11, dz ? 0.02 : 0.12, 0xffd890, dx, 0.81, dz, { emissive: 0xffb050, night: 2.5 }));
  roof(L, { y: 0.97, w: 0.5, h: 0.16, d: 0.5, color: STONE_D, under: STONE_D, lift: 0.08, ridge: false });
  L.add(cyl(0.02, 0.06, 0.08, STONE, 0, 1.12, 0, 8)); const j = mesh(new THREE.SphereGeometry(0.05, 8, 6), STONE); j.position.y = 1.23; j.scale.y = 1.3; L.add(j);
  L.scale.setScalar(s); L.position.set(x, y, z); g.add(L); return L;
}
// a cherry tree in full bloom: a dark, crooked trunk and clouds of pink
export function sakura(g, x, z, s = 1, y = 0.15, seed = 1) {
  const T = new THREE.Group(); let k = seed * 31 + 7; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  const tr = mesh(new THREE.CylinderGeometry(0.08, 0.14, 1.1, 6), 0x4a3428); tr.position.y = 0.55; tr.rotation.z = (r() - 0.5) * 0.3; T.add(tr);
  for (let i = 0; i < 3; i++) { const b = mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.8, 5), 0x4a3428); const a = i * 2.1 + r(); b.position.set(Math.cos(a) * 0.25, 1.25, Math.sin(a) * 0.25); b.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7); T.add(b); }
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, d = 0.25 + r() * 0.5, c = J.SAKURA[Math.floor(r() * J.SAKURA.length)];
    const p = mesh(new THREE.IcosahedronGeometry(0.42 + r() * 0.22, 1), c, { flatShading: true, roughness: 0.9 });
    p.position.set(Math.cos(a) * d, 1.55 + r() * 0.45, Math.sin(a) * d); p.scale.y = 0.75; T.add(p);
  }
  T.scale.setScalar(s); T.position.set(x, y, z); g.add(T); return T;
}
// a Japanese maple, red or orange
export function maple(g, x, z, s = 1, y = 0.15, seed = 2) {
  const T = new THREE.Group(); let k = seed * 17 + 3; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  T.add(at(mesh(new THREE.CylinderGeometry(0.06, 0.1, 1.0, 6), 0x4a3428), 0, 0.5, 0));
  for (let i = 0; i < 6; i++) {
    const a = r() * 6.28, d = 0.2 + r() * 0.45, c = J.MAPLE[Math.floor(r() * J.MAPLE.length)];
    const p = mesh(new THREE.IcosahedronGeometry(0.34 + r() * 0.16, 0), c, { flatShading: true }); p.position.set(Math.cos(a) * d, 1.1 + r() * 0.5, Math.sin(a) * d); p.scale.y = 0.65; T.add(p);
  }
  T.scale.setScalar(s); T.position.set(x, y, z); g.add(T); return T;
}
// a cloud-pruned pine (niwaki): a leaning trunk with flat pads of needles
export function pine(g, x, z, s = 1, y = 0.15, seed = 3) {
  const T = new THREE.Group(); let k = seed * 13 + 5; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  const lean = (r() - 0.5) * 0.5;
  const tr = mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 6), 0x5a4030); tr.position.set(lean * 0.4, 0.8, 0); tr.rotation.z = -lean * 0.5; T.add(tr);
  for (let i = 0; i < 4; i++) {
    const yy = 0.8 + i * 0.32, a = r() * 6.28, d = i === 3 ? 0 : 0.35 + r() * 0.2;
    const pad = mesh(new THREE.SphereGeometry(0.42 - i * 0.05, 10, 6), J.PINE[i % 3], { flatShading: true }); pad.scale.set(1, 0.32, 0.85); pad.position.set(Math.cos(a) * d + lean * 0.4, yy + 0.25, Math.sin(a) * d); T.add(pad);
    if (d) rod(T, [lean * 0.3, yy, 0], [Math.cos(a) * d + lean * 0.4, yy + 0.2, Math.sin(a) * d], 0.03, 0x5a4030);
  }
  T.scale.setScalar(s); T.position.set(x, y, z); g.add(T); return T;
}
// a clump of bamboo
export function bamboo(g, x, z, s = 1, y = 0.15, n = 6, seed = 4) {
  const T = new THREE.Group(); let k = seed * 7 + 1; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const h = 2.0 + r() * 1.4, px = (r() - 0.5) * 0.6, pz = (r() - 0.5) * 0.6, lean = (r() - 0.5) * 0.15;
    const st = mesh(new THREE.CylinderGeometry(0.035, 0.045, h, 6), r() < 0.5 ? 0x7aa84a : 0x8ab85a); st.position.set(px, h / 2, pz); st.rotation.z = lean; T.add(st);
    for (let j = 1; j < 4; j++) T.add(at(mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6), 0x5a8a3a), px - lean * h * (j / 4 - 0.5), h * j / 4, pz));
    const lf = mesh(new THREE.IcosahedronGeometry(0.28, 0), 0x6aa040, { flatShading: true }); lf.scale.set(1.2, 0.5, 1.2); lf.position.set(px - lean * h * 0.5, h, pz); T.add(lf);
  }
  T.scale.setScalar(s); T.position.set(x, y, z); g.add(T); return T;
}
// a clipped round shrub (azalea in flower, or plain green)
export function shrub(g, x, z, s = 1, y = 0.15, color = 0x4f8f3a) {
  const b = mesh(new THREE.SphereGeometry(0.32, 12, 8), color, { roughness: 0.95 }); b.scale.set(1.2 * s, 0.8 * s, 1.1 * s); b.position.set(x, y + 0.2 * s, z); g.add(b); return b;
}
// mossy rocks
export function rocks(g, x, z, s = 1, y = 0.15, n = 3, seed = 5) {
  let k = seed * 11 + 9; const r = () => ((k = (k * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const rk = mesh(new THREE.DodecahedronGeometry((0.18 + r() * 0.2) * s, 0), r() < 0.5 ? STONE_D : 0x8f8c84, { flatShading: true });
    rk.scale.y = 0.6; rk.rotation.y = r() * 3; rk.position.set(x + (r() - 0.5) * 0.7 * s, y + 0.06 * s, z + (r() - 0.5) * 0.7 * s); g.add(rk);
  }
  const moss = mesh(new THREE.CylinderGeometry(0.5 * s, 0.55 * s, 0.04, 12), MOSS, { roughness: 1 }); moss.position.set(x, y, z); moss.scale.z = 0.8; g.add(moss);
}
// a koi pond: dark water in a ring of stones, with koi swimming round (returns the fish)
export function koiPond(g, x, z, rx, rz, y = 0.15) {
  const water = mesh(new THREE.CircleGeometry(1, 24), 0x2e5a5a, { roughness: 0.1, metalness: 0.2 }); water.rotation.x = -Math.PI / 2; water.scale.set(rx, rz, 1); water.position.set(x, y + 0.03, z); g.add(water);
  for (let i = 0; i < 18; i++) {
    const a = i / 18 * Math.PI * 2, st = mesh(new THREE.DodecahedronGeometry(0.11 + (i % 3) * 0.04, 0), i % 2 ? STONE : STONE_D, { flatShading: true });
    st.scale.y = 0.55; st.position.set(x + Math.cos(a) * (rx + 0.06), y + 0.05, z + Math.sin(a) * (rz + 0.06)); g.add(st);
  }
  const fish = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group(), c = [J.KOI, 0xf4f2ec, J.KOI, 0xffc23d][i];
    const body = mesh(new THREE.SphereGeometry(0.07, 8, 6), c); body.scale.set(2.2, 0.6, 1); f.add(body);
    if (i % 2 === 0) { const sp = mesh(new THREE.SphereGeometry(0.035, 6, 4), 0xf4f2ec); sp.position.set(0.04, 0.03, 0); f.add(sp); }
    const tail = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), c); tail.rotation.z = Math.PI / 2; tail.position.x = -0.18; f.add(tail);
    f.position.set(x, y + 0.035, z); g.add(f); fish.push({ f, a: i * 1.6, r: 0.4 + (i % 2) * 0.25, sp: 0.4 + i * 0.12, x, z, rx, rz });
  }
  return fish;
}
export const swimKoi = (fish, t) => fish.forEach(k => { const a = k.a + t * k.sp, rr = k.r; k.f.position.x = k.x + Math.cos(a) * k.rx * rr; k.f.position.z = k.z + Math.sin(a) * k.rz * rr; k.f.rotation.y = -a - Math.PI / 2; });
// a torii gate (vermilion, with a black top beam)
export function torii(g, x, z, w = 1.6, h = 1.8, y = 0.15, rotY = 0, color = VERM) {
  const T = new THREE.Group();
  for (const e of [-1, 1]) { T.add(cyl(0.07, 0.09, h, color, e * w / 2, 0, 0, 10), cyl(0.11, 0.11, 0.12, 0x2a2a2a, e * w / 2, 0, 0, 10)); }
  T.add(box(w + 0.2, 0.1, 0.12, color, 0, h * 0.78, 0));
  const kasagi = box(w + 0.6, 0.12, 0.18, 0x2a2624, 0, h - 0.02, 0); T.add(kasagi);
  T.add(box(w + 0.5, 0.08, 0.16, color, 0, h - 0.12, 0));
  for (const e of [-1, 1]) { const tip = box(0.3, 0.1, 0.18, 0x2a2624, e * (w / 2 + 0.36), h + 0.03, 0); tip.rotation.z = e * 0.2; T.add(tip); }
  T.add(box(0.08, h * 0.2, 0.06, color, 0, h * 0.8, 0));
  T.position.set(x, y, z); T.rotation.y = rotY; g.add(T); return T;
}
// a hanging paper lantern (chochin), glowing after dark
export function chochin(g, x, y, z, color = 0xe8442e, s = 1) {
  const l = mesh(new THREE.SphereGeometry(0.11 * s, 10, 8), color, { emissive: color, night: 1.6, roughness: 0.8 }); l.scale.y = 1.35; l.position.set(x, y, z); g.add(l);
  g.add(cyl(0.06 * s, 0.06 * s, 0.03, 0x2a2420, x, y + 0.13 * s, z, 8), cyl(0.06 * s, 0.06 * s, 0.03, 0x2a2420, x, y - 0.16 * s, z, 8));
  return l;
}
