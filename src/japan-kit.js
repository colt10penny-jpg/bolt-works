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
  TILE: 0x7c8492, TILE_D: 0x4a505c, THATCH: 0x8a6c48, STONE: 0xa8a49a, STONE_D: 0x7d7a72, MOSS: 0x6f8f3a, GOLD: 0xd9a83a,
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
// hongawara clay tiles: rows of round cover tiles over wide, dished pan tiles, laid in
// overlapping courses (each course's lower lip throws a little shadow on the next), each
// tile a slightly different shade. Grey; the material tints it. Also used as a bump map.
const tileTex = () => TEX.tile ||= canvas(128, 128, (g, w, h) => {
  let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
  const COL = 32, ROW = 32;
  for (let cy = 0; cy < h; cy += ROW) for (let cx = 0; cx < w; cx += COL) {
    const tint = 0.9 + r() * 0.2;
    for (let x = 0; x < COL; x++) {
      // the pan tile (dished: darker in the middle) and the round cover tile on its seam
      const u = x / COL;
      const pan = 0.62 - 0.12 * Math.sin(u * Math.PI);
      const dc = Math.abs(u - 0) < 0.22 ? u / 0.22 : Math.abs(u - 1) < 0.22 ? (1 - u) / 0.22 : -1;
      for (let y = 0; y < ROW; y++) {
        const k = y / ROW;
        let v = pan * (0.86 + 0.14 * k);
        if (dc >= 0) v = 0.45 + 0.5 * Math.cos((1 - dc) * Math.PI / 2);
        if (y < 3) v *= 0.55 + y * 0.12;                 // the shadow under the course above
        if (y > ROW - 3) v = Math.min(1, v * 1.15);      // this course's lip
        v *= tint * (0.95 + r() * 0.1);
        const c = Math.round(255 * Math.min(1, v));
        g.fillStyle = `rgb(${c},${c},${c})`; g.fillRect(cx + x, cy + y, 1, 1);
      }
    }
  }
  // a little moss and lichen here and there
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${90 + r() * 40},${110 + r() * 30},${70},${0.15 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 2 + r() * 4, 1 + r() * 3); }
});
// straw thatch: dense streaks running down, combed in layers, darker with age at the eaves
const thatchTex = () => TEX.thatch ||= canvas(128, 128, (g, w, h) => {
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, w, h);
  let s = 3; const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1400; i++) { const v = 120 + r() * 135; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(r() * w, r() * h, 1, 6 + r() * 18); }
  for (let y = 0; y < h; y += 32) { const gr = g.createLinearGradient(0, y, 0, y + 32); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(0.25, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(255,255,255,0.08)'); g.fillStyle = gr; g.fillRect(0, y, w, 32); }
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
// red-lacquered lattice (for transom windows and doors): a fine vermilion grid over shadow
const redLatTex = () => TEX.redlat ||= canvas(64, 64, (g, w, h) => {
  g.fillStyle = '#2a1410'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#c8402a'; for (let x = 0; x < w; x += 8) g.fillRect(x, 0, 3, h); for (let y = 0; y < h; y += 8) g.fillRect(0, y, w, 3);
  g.fillStyle = '#9a2e1e'; g.fillRect(0, 0, w, 4); g.fillRect(0, h - 4, w, 4); g.fillRect(0, 0, 4, h); g.fillRect(w - 4, 0, 4, h);
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
const tileMat = color => texMat('tile' + color, () => new THREE.MeshStandardMaterial({ color, map: tileTex(), bumpMap: tileTex(), bumpScale: 2.2, roughness: 0.6, metalness: 0.12, side: THREE.DoubleSide }));
const thatchMat = color => texMat('th' + color, () => new THREE.MeshStandardMaterial({ color, map: thatchTex(), bumpMap: thatchTex(), bumpScale: 3, roughness: 1, side: THREE.DoubleSide }));
const shojiMat = () => texMat('shoji', () => { const m = new THREE.MeshStandardMaterial({ map: shojiTex(), emissive: 0xffc070, emissiveMap: shojiTex(), emissiveIntensity: 0, roughness: 0.9 }); m.userData.night = 0.9; GLOW.night.push(m); return m; });
const redLatMat = () => texMat('redlat', () => { const m = new THREE.MeshStandardMaterial({ map: redLatTex(), emissive: 0xffa060, emissiveMap: redLatTex(), emissiveIntensity: 0, roughness: 0.6 }); m.userData.night = 0.35; GLOW.night.push(m); return m; });
const koshiMat = () => texMat('koshi', () => new THREE.MeshStandardMaterial({ map: koshiTex(), roughness: 0.85 }));

// ---------- roofs ----------
// A hip roof over a w x d plan (a = w/2 >= b = d/2): four sweeping faces, concave (steep
// near the ridge, flattening toward the eaves) and lifting at the corners like a temple
// roof, with a real thickness so the eave edge shows. Returns the top and underside
// geometry, and each face's surface function P(t, s) (t along the eave, s up to the ridge).
function roofGeo(a, b, H, { lift = 0.3, pow = 1.7, thick = 0.12, tile = 0.3 } = {}) {
  if (b > a) {
    const R = roofGeo(b, a, H, { lift, pow, thick, tile });
    R.T.rotateY(Math.PI / 2); R.U.rotateY(Math.PI / 2);
    R.faces = R.faces.map(P => (t, s) => { const [x, y, z] = P(t, s); return [z, y, -x]; });
    return R;
  }
  // (as many segments as the curve needs: a big temple roof gets 12 x 8, a wall cap 3 x 2)
  const slope = Math.hypot(H, b), r = a - b;
  const ST = Math.max(3, Math.min(12, Math.round(lift * 30 + a * 1.5))), SS = Math.max(2, Math.min(8, Math.round(slope * 5)));
  const faces = [
    [[-a, b], [a, b], [-r, 0], [r, 0]],
    [[a, -b], [-a, -b], [r, 0], [-r, 0]],
    [[a, b], [a, -b], [r, 0], [r, 0]],
    [[-a, -b], [-a, b], [-r, 0], [-r, 0]],
  ];
  const tops = [], unders = [], fns = [];
  for (const [e0, e1, r0, r1] of faces) {
    const len = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]), dx = (e1[0] - e0[0]) / len, dz = (e1[1] - e0[1]) / len;
    const P = (t, s) => {
      const ex = e0[0] + (e1[0] - e0[0]) * t, ez = e0[1] + (e1[1] - e0[1]) * t;
      const rx = r0[0] + (r1[0] - r0[0]) * t, rz = r0[1] + (r1[1] - r0[1]) * t;
      const c = Math.pow(Math.abs(2 * t - 1), 6) * (1 - s) * (1 - s);
      return [ex + (rx - ex) * s, H * Math.pow(s, pow) + lift * c, ez + (rz - ez) * s];
    };
    fns.push(P);
    const pos = [], uv = [], idx = [], pu = [], iu = [];
    for (let i = 0; i <= ST; i++) for (let j = 0; j <= SS; j++) {
      const t = i / ST, s = j / SS, p = P(t, s);
      // the tiles run straight down the slope, at the same size on every face
      pos.push(...p); uv.push((p[0] * dx + p[2] * dz) / tile, s * slope / tile);
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
    top.computeVertexNormals(); und.computeVertexNormals();
    if (top.attributes.normal.getY(V(ST >> 1, SS >> 1)) < 0) { top.setIndex(idx.map((v, k) => k % 3 === 1 ? idx[k + 1] : k % 3 === 2 ? idx[k - 1] : v)); top.computeVertexNormals(); }
    tops.push(top.toNonIndexed()); unders.push(und.toNonIndexed());
  }
  const T = mergeGeometries(tops), U = mergeGeometries(unders);
  T.computeVertexNormals(); U.computeVertexNormals();
  return { T, U, faces: fns };
}
const DETAIL = new Map();
const plainGeo = g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k); return n; };
// put a roof over g: centre (x, z), eaves at height y, plan w x d (with the overhang);
// kind 'tile' (grey clay) or 'thatch'; returns the ridge height.
// A tiled roof gets its trim: raised hip ridges down the four corners with a decorated
// end tile where each meets the eave, a row of round tile ends along the eaves, a ridge
// with end tiles (onigawara), and a white-edged fascia under the eaves. A thatched roof
// gets a thick, trimmed eave and a straw ridge pinned by crossed timbers.
export function roof(g, { x = 0, y, z = 0, w, d, h, kind = 'tile', color, lift, under = WOOD, ridge = true, rot = 0, phoenix = false, trim: trimOn = true }) {
  const th = kind === 'thatch', TS = 0.9;
  const thick = th ? Math.min(0.32, 0.12 + Math.min(w, d) * 0.06) : 0.11;
  const R = roofGeo(w / 2, d / 2, h, { lift: lift ?? (th ? 0.05 : Math.min(w, d) * 0.12), pow: th ? 1.15 : 1.7, thick, tile: th ? 1.4 : TS });
  const grp = new THREE.Group();
  const top = new THREE.Mesh(R.T, th ? thatchMat(color ?? J.THATCH) : tileMat(color ?? TILE)); top.castShadow = true; top.receiveShadow = true;
  const und = new THREE.Mesh(R.U, mat(under, { side: THREE.DoubleSide })); und.castShadow = true;
  grp.add(top, und);
  const small = Math.min(w, d) < 0.9, trim = [], dark = th ? shade(color ?? J.THATCH, -0.4) : J.TILE_D;
  const sz = Math.min(w, d), rr = th ? 0 : Math.max(0.022, Math.min(0.065, sz * 0.022));
  if (!th && trimOn) {
    // hip ridges: along the shared edges of the front and back faces
    for (const P of [R.faces[0], R.faces[1]]) for (const t of [0, 1]) {
      const pts = []; for (let k = 0; k <= 10; k++) { const [px, py, pz] = P(t, k / 10); pts.push(new THREE.Vector3(px, py + rr * 0.7, pz)); }
      trim.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, rr, 5, false));
      if (!small) {
        // the decorated end tile where the hip meets the eave, leaning out
        const [ex, ey, ez] = P(t, 0), [nx, , nz] = P(t, 0.12);
        const b = new THREE.BoxGeometry(rr * 3.2, rr * 4.2, rr * 2.2); b.rotateY(Math.atan2(ex - nx, ez - nz)); b.translate(ex, ey + rr * 1.6, ez); trim.push(b);
      }
    }
    // round tile ends along every eave, one per row of cover tiles
    if (!small) for (const P of R.faces.filter(P => { const [ax, , az] = P(0.5, 0), [bx, , bz] = P(0.5, 1); return (ax - bx) + (az - bz) > -0.01; })) {   // (only the eaves facing the camera)
      const [x0, , z0] = P(0, 0), [x1, , z1] = P(1, 0), L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / (TS / 4));
      for (let k = 1; k < n; k++) {
        const t = k / n, [px, py, pz] = P(t, 0), [qx, , qz] = P(t, 0.06);
        const c = new THREE.CylinderGeometry(rr * 0.85, rr * 0.85, 0.05, 6, 1, true); c.rotateX(Math.PI / 2); c.rotateY(Math.atan2(px - qx, pz - qz)); c.translate(px, py - 0.015, pz); trim.push(c);
      }
    }
  }
  if (ridge) {
    const r = Math.max(0, Math.max(w, d) / 2 - Math.min(w, d) / 2), along = w >= d;
    if (r > 0.05) {
      const rb = new THREE.BoxGeometry(along ? r * 2 + 0.2 : (th ? 0.36 : 0.2), th ? 0.26 : 0.17, along ? (th ? 0.36 : 0.2) : r * 2 + 0.2); rb.translate(0, h + (th ? 0.02 : 0.02), 0); trim.push(rb);
      if (!th) {
        const rb2 = new THREE.BoxGeometry(along ? r * 2 + 0.3 : 0.12, 0.07, along ? 0.12 : r * 2 + 0.3); rb2.translate(0, h + 0.12, 0); trim.push(rb2);
        for (const e of [-1, 1]) { const o = new THREE.BoxGeometry(0.2, 0.3, 0.26); o.rotateY(along ? 0 : Math.PI / 2); o.translate(along ? e * (r + 0.1) : 0, h + 0.1, along ? 0 : e * (r + 0.1)); trim.push(o); const f = new THREE.ConeGeometry(0.09, 0.2, 5); f.rotateZ(along ? -e * 0.5 : 0); f.rotateX(along ? 0 : e * 0.5); f.translate(along ? e * (r + 0.2) : 0, h + 0.34, along ? 0 : e * (r + 0.2)); trim.push(f); }
      } else {
        // crossed timbers pinning the straw ridge
        for (let k = 0; k <= Math.max(2, Math.round(r * 2 / 0.45)); k++) {
          const a0 = -r + (2 * r * k) / Math.max(2, Math.round(r * 2 / 0.45));
          for (const e of [-1, 1]) { const b = new THREE.BoxGeometry(0.05, 0.5, 0.05); b.rotateX(along ? e * 0.6 : 0); b.rotateZ(along ? 0 : e * 0.6); b.translate(along ? a0 : 0, h + 0.18, along ? 0 : a0); trim.push(b); }
        }
      }
    } else trim.push(new THREE.CylinderGeometry(0.05, 0.12, 0.25, 8).translate(0, h - 0.05, 0));
  }
  if (trim.length) {
    const tm = new THREE.Mesh(mergeGeometries(trim.map(plainGeo)), mat(th ? J.WOOD_D : dark, { roughness: 0.55, metalness: 0.1 }));
    tm.castShadow = true; tm.receiveShadow = true; grp.add(tm);
    trim.forEach(t => t.dispose());
  }
  if (th && ridge) { const rr2 = Math.max(0, Math.max(w, d) / 2 - Math.min(w, d) / 2), along = w >= d; if (rr2 > 0.05) grp.add(box(along ? rr2 * 2 + 0.25 : 0.4, 0.2, along ? 0.4 : rr2 * 2 + 0.25, dark, 0, h - 0.06, 0)); }
  if (phoenix && !th) {
    // a pair of golden phoenixes on the ridge ends, wings up, tails streaming behind
    const rr2 = Math.max(0.1, Math.max(w, d) / 2 - Math.min(w, d) / 2), along = w >= d, gm = { metalness: 0.85, roughness: 0.25, emissive: 0x6a4a10, emissiveIntensity: 0.25 };
    for (const e of [-1, 1]) {
      const b = new THREE.Group();
      b.add(at(mesh(new THREE.ConeGeometry(0.07, 0.3, 6), GOLD, gm), 0, 0.15, 0));
      const hd = mesh(new THREE.SphereGeometry(0.05, 8, 6), GOLD, gm); hd.position.set(0, 0.32, 0.04); b.add(hd);
      for (const sd of [-1, 1]) { const wg = box(0.26, 0.03, 0.12, GOLD, sd * 0.13, 0.2, -0.02, gm); wg.rotation.z = sd * 0.7; b.add(wg); }
      const tail = box(0.06, 0.03, 0.34, GOLD, 0, 0.12, -0.2, gm); tail.rotation.x = -0.6; b.add(tail);
      b.position.set(along ? e * (rr2 + 0.05) : 0, h + 0.2, along ? 0 : e * (rr2 + 0.05)); b.rotation.y = along ? (e > 0 ? Math.PI / 2 : -Math.PI / 2) : (e > 0 ? 0 : Math.PI);
      grp.add(b);
    }
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
export const redLattice = (g, axis, a, y, f, w, h) => g.add(plane(axis, a, y, f, w, h, redLatMat()));
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
// A temple hall in the style of the Phoenix Hall: vermilion posts and beams framing white
// plaster, red lattice transoms in every bay, red lattice doors in the middle of the front,
// a row of bracket blocks under the eaves, a raised veranda with a red railing along the
// front (and the right side), and optionally a skirt roof part way up (mokoshi), so the
// hall reads as two storeys. Returns the wall top.
export function redHall(g, { x = 0, z = 0, w, d, h, y0 = 0.15, wall = PLASTER, base = STONE, bay = 0.7, baseH = 0.26, rail = true, side = true, skirt = false, doors = true }) {
  const top = hall(g, { x, z, w, d, h, y0, wall, frame: VERM, base, bay, baseH });
  const y = y0 + baseH;
  for (const [axis, len, f, c] of [['z', w, z + d / 2, x], ['x', d, x + w / 2, z]]) {
    const n = Math.max(1, Math.round(len / bay)), bw = len / n;
    for (let i = 0; i < n; i++) {
      const a = c - len / 2 + bw * (i + 0.5);
      redLattice(g, axis, a, y + h * 0.66, f, bw - 0.14, h * 0.2);
      g.add(onWall(axis, a, y + h * 0.62, f, bw - 0.1, 0.05, 0.05, VERM));
    }
    // bracket blocks under the eaves
    for (let i = 0; i <= n * 2; i++) { const a = c - len / 2 + (len * i) / (n * 2); g.add(onWall(axis, a, y + h - 0.02, f, 0.09, 0.08, 0.14, i % 2 ? GOLD : VERM)); }
  }
  if (doors) { const dw = Math.min(0.8, w * 0.28); redLattice(g, 'z', x, y + 0.05, z + d / 2 + 0.01, dw, h * 0.5); g.add(onWall('z', x, y + 0.05 + h * 0.25, z + d / 2 + 0.02, 0.03, h * 0.5, 0.02, 0x7a2416)); }
  if (rail) {
    engawa(g, { axis: 'z', a: x, f: z + d / 2, len: w + 0.1, depth: 0.42, y: y0 + baseH * 0.8, rail: VERM, posts: false });
    if (side) engawa(g, { axis: 'x', a: z, f: x + w / 2, len: d + 0.1, depth: 0.42, y: y0 + baseH * 0.8, rail: VERM, posts: false });
  }
  if (skirt) roof(g, { x, y: y + h * 0.5, z, w: w + 0.8, d: d + 0.8, h: 0.24, lift: 0.1, ridge: false });
  return top;
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
