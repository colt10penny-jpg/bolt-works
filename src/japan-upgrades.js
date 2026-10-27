// What each Sakura Valley building gains as it levels up: three wings of its own (a white
// storehouse, a townhouse, a tea house, a little shrine, a bell tower, a three-storey
// pagoda, a koi garden, a raked-gravel garden, an onsen, a castle turret, a thatched
// farmhouse) and four garden pieces of its own (stone lanterns, carp streamers, bonsai,
// a bamboo water clacker, festival banners, a taiko drum...). Garden pieces stand in the
// lot's free corners, several to a corner, since the curved roofs have nowhere flat.
import * as THREE from 'three';
import { box, cyl, mat } from './models.js';
import { J, mesh, at, rod, shade, roof, gable, onWall, hall, engawa, shoji, koshi, noren, plaque, lantern, sakura, maple, pine, bamboo, shrub, rocks, koiPond, torii, chochin } from './japan-kit.js';

const { PLASTER, WOOD, WOOD_D, WOOD_L, VERM, STONE, STONE_D, MOSS, GOLD } = J;
const COPPER = 0x4f8a78, BRONZE = 0x6a5a3a, goldM = { metalness: 0.75, roughness: 0.28 };
const G = (...parts) => { const g = new THREE.Group(); if (parts.length) g.add(...parts); return g; };

// the lower walls of a storehouse: dark tiles set in a diamond grid of raised white
// plaster (namako-kabe)
let namakoM = null;
function namako() {
  if (namakoM) return namakoM;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = '#34383f'; x.fillRect(0, 0, 64, 64);
  x.strokeStyle = '#eeeae0'; x.lineWidth = 5;
  for (let k = -64; k <= 64; k += 32) { x.beginPath(); x.moveTo(k, 0); x.lineTo(k + 64, 64); x.stroke(); x.beginPath(); x.moveTo(k + 64, 0); x.lineTo(k, 64); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 1); t.colorSpace = THREE.SRGBColorSpace;
  return (namakoM = new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }));
}
function namakoWall(g, w, h, d, y = 0.2) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h, d + 0.02), namako()); m.position.y = y + h / 2; m.castShadow = m.receiveShadow = true; g.add(m);
}
// a family crest (mon): a circle of the company colour with a white flower in it
function mon(g, axis, a, y, f, r, color) {
  const s = Math.sign(f) || 1, disk = mesh(new THREE.CylinderGeometry(r, r, 0.03, 18), color), petal = mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.035, 5), 0xf6f2e8);
  for (const o of [disk, petal]) { if (axis === 'z') { o.rotation.x = Math.PI / 2; o.position.set(a, y, f + s * 0.02); } else { o.rotation.z = Math.PI / 2; o.position.set(f + s * 0.02, y, a); } g.add(o); }
}
const steamM = () => mat(0xffffff, { transparent: true, opacity: 0.35, depthWrite: false, roughness: 1 });

// ---------------- the wings ----------------
// each draws into g (centred on the corner, ground at y 0) and returns its roof height
const WINGS = {
  // a white storehouse (kura): thick plaster walls over a black-and-white diamond tile
  // base, small iron-shuttered windows, a heavy door with the company crest
  kura(g, { tier, color, floors }) {
    const w = 1.9, d = 1.7, h = 1.25 + Math.min(4, floors) * 0.22;
    g.add(box(w + 0.16, 0.2, d + 0.16, STONE, 0, 0, 0));
    g.add(box(w, h, d, PLASTER, 0, 0.2, 0));
    namakoWall(g, w, 0.55, d);
    for (const [axis, f, len] of [['z', d / 2, w], ['x', w / 2, d]]) {
      for (const e of (len > 1.8 ? [-0.5, 0.5] : [0])) {
        g.add(onWall(axis, e, 0.2 + h - 0.55, f, 0.3, 0.3, 0.05, 0x2a2a2e), onWall(axis, e, 0.2 + h - 0.55, f + 0.03, 0.36, 0.06, 0.04, PLASTER));
      }
    }
    g.add(onWall('z', -0.2, 0.2, d / 2, 0.55, 0.85, 0.08, 0x2a2a2e), onWall('z', -0.2, 0.2 + 0.85, d / 2, 0.75, 0.12, 0.1, PLASTER));
    mon(g, 'z', -0.2, 0.2 + 0.55, d / 2 + 0.08, 0.13, tier >= 4 ? color : 0x2a2a2e);
    mon(g, 'x', 0, 0.2 + h - 0.35, w / 2, 0.16, tier >= 4 ? color : 0x2a2a2e);
    return roof(g, { y: 0.2 + h, w: w + 0.55, d: d + 0.5, h: 0.65, lift: 0.12, under: PLASTER });
  },
  // a two-storey townhouse (machiya): a dark lattice shop front with a noren in the
  // company colour, a pent roof, slatted plaster upstairs, lanterns by the door
  machiya(g, { tier, color, floors }) {
    const w = 2.1, d = 1.8, t1 = hall(g, { w, d, h: 0.95, y0: 0, wall: 0x5a3e2a, frame: WOOD_D, bay: 0.7 });
    koshi(g, 'z', -0.45, 0.32, d / 2, 0.9, 0.62); koshi(g, 'x', 0, 0.32, w / 2, 1.2, 0.62);
    g.add(onWall('z', 0.6, 0.22, d / 2, 0.5, 0.75, 0.03, 0x1e1612)); noren(g, 'z', 0.6, 1.0, d / 2 + 0.01, 0.55, color);
    roof(g, { y: t1, z: d / 2 + 0.05, w: w + 0.3, d: 0.6, h: 0.18, lift: 0.05, ridge: false });
    const up = 0.75 + Math.min(3, floors - 2) * 0.25;
    const t2 = hall(g, { z: -0.15, w: w - 0.3, d: d - 0.4, h: up, y0: t1, wall: PLASTER, frame: WOOD_D, bay: 0.75, baseH: 0.04 });
    for (const e of [-0.45, 0.45]) koshi(g, 'z', e, t1 + 0.25, -0.15 + (d - 0.4) / 2, 0.5, 0.3);
    chochin(g, 0.2, 0.95, d / 2 + 0.12, 0xf2e6c8); if (tier >= 3) chochin(g, 1.0, 0.95, d / 2 + 0.12, color);
    return roof(g, { y: t2, z: -0.15, w: w + 0.3, d: d + 0.05, h: 0.7, lift: 0.18 });
  },
  // a thatched tea house on a mossy garden plot: paper screens, a small veranda,
  // stepping stones up to it, a stone wash basin and a lantern
  teahouse(g, { tier }) {
    g.add(cyl(1.15, 1.2, 0.05, MOSS, 0, 0, 0, 20));
    const t = hall(g, { x: -0.15, z: -0.2, w: 1.3, d: 1.2, h: 0.75, y0: 0.05, wall: 0xc9a878, frame: WOOD_D, bay: 0.6, baseH: 0.18 });
    shoji(g, 'z', -0.15, 0.33, 0.4, 1.0, 0.5); shoji(g, 'x', -0.2, 0.33, 0.5, 0.9, 0.5);
    engawa(g, { axis: 'z', a: -0.15, f: 0.4, len: 1.3, depth: 0.3, y: 0.28, rail: null, posts: false });
    for (let k = 0; k < 4; k++) { const st = mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.05, 8), STONE); st.position.set(0.25 + k * 0.18, 0.06, 0.85 - k * 0.04 + (k % 2) * 0.08); g.add(st); }
    g.add(box(0.3, 0.2, 0.3, STONE_D, 0.75, 0.05, -0.55), box(0.2, 0.02, 0.2, 0x3a6a8a, 0.75, 0.25, -0.55, { roughness: 0.1 }));
    rod(g, [0.95, 0.5, -0.75], [0.8, 0.3, -0.58], 0.025, 0x8ab85a);
    lantern(g, 0.8, 0.6, 0.6, 0.05);
    if (tier >= 5) maple(g, -0.85, 0.75, 0.55, 0.05, 41);
    return roof(g, { x: -0.15, y: t, z: -0.2, w: 1.85, d: 1.75, h: 0.85, kind: 'thatch' });
  },
  // a small shrine: a stone platform, a vermilion hall with a green copper roof, a
  // sacred rope with paper streamers, two guardian lion-dogs and a torii gate
  shrine(g, { tier, color }) {
    g.add(box(2.0, 0.22, 1.9, STONE, 0, 0, 0), box(1.1, 0.12, 0.3, STONE, 0, 0, 1.05));
    const t = hall(g, { z: -0.35, w: 1.3, d: 1.0, h: 0.85, y0: 0.22, wall: 0xf2ead8, frame: VERM, bay: 0.45, baseH: 0.12 });
    g.add(onWall('z', 0, 0.34, 0.15, 0.6, 0.6, 0.03, 0x3a2a20));
    const rope = mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 14, Math.PI), 0xd9c27a); rope.rotation.z = Math.PI; rope.scale.y = 0.25; rope.position.set(0, t - 0.08, 0.22); g.add(rope);
    for (const e of [-0.25, 0.25]) for (let k = 0; k < 3; k++) g.add(box(0.06, 0.06, 0.01, 0xffffff, e + (k % 2) * 0.03, t - 0.2 - k * 0.07, 0.24));
    g.add(box(0.4, 0.22, 0.2, WOOD, 0, 0.34, 0.45));      // the offering box
    for (const e of [-1, 1]) { const dog = G(box(0.16, 0.2, 0.22, STONE, 0, 0, 0), box(0.14, 0.14, 0.12, STONE, 0, 0.2, 0.06)); dog.position.set(e * 0.6, 0.34, 0.6); g.add(dog); g.add(box(0.22, 0.12, 0.26, STONE_D, e * 0.6, 0.22, 0.6)); }
    torii(g, 0, 1.05, 0.9, 1.15, 0.12, 0, tier >= 6 ? color : VERM);
    return roof(g, { y: t, z: -0.35, w: 1.85, d: 1.5, h: 0.6, color: COPPER, lift: 0.14, under: VERM });
  },
  // a bell tower (shoro): a stone base, four leaning vermilion posts, a heavy roof, a
  // bronze temple bell and the log that strikes it
  belltower(g, { tier }) {
    g.add(box(1.8, 0.45, 1.8, STONE_D, 0, 0, 0), box(1.6, 0.06, 1.6, STONE, 0, 0.45, 0));
    const H = 1.45;
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) g.add(box(0.12, H, 0.12, VERM, x, 0.5, z));
    for (const e of [-0.6, 0.6]) g.add(box(1.4, 0.1, 0.1, VERM, 0, 0.5 + H - 0.1, e), box(0.1, 0.1, 1.4, VERM, e, 0.5 + H - 0.1, 0));
    g.add(box(1.32, 0.06, 0.06, VERM, 0, 0.75, 0.6), box(0.06, 0.06, 1.32, VERM, 0.6, 0.75, 0));
    const bell = new THREE.Group();
    bell.add(at(mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.62, 16), BRONZE, { metalness: 0.7, roughness: 0.4 }), 0, 0.31, 0));
    for (let k = 0; k < 3; k++) bell.add(at(mesh(new THREE.TorusGeometry(0.25 + k * 0.02, 0.015, 4, 16), shade(BRONZE, -0.3), { metalness: 0.7 }), 0, 0.15 + k * 0.17, 0).rotateX(Math.PI / 2));
    bell.add(at(mesh(new THREE.SphereGeometry(0.24, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), BRONZE, { metalness: 0.7, roughness: 0.4 }), 0, 0.62, 0), box(0.06, 0.18, 0.06, BRONZE, 0, 0.82, 0));
    bell.position.set(0, 0.5 + H - 1.15, 0); g.add(bell);
    const log = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8), WOOD_L); log.rotation.z = Math.PI / 2; log.position.set(0.68, 0.5 + H - 0.75, 0); g.add(log);
    rod(g, [0.5, 0.5 + H - 0.1, 0], [0.5, 0.5 + H - 0.72, 0], 0.012, 0xd9c27a); rod(g, [0.85, 0.5 + H - 0.1, 0], [0.85, 0.5 + H - 0.72, 0], 0.012, 0xd9c27a);
    if (tier >= 5) chochin(g, -0.6, 0.5 + H - 0.4, 0.68, VERM);
    return roof(g, { y: 0.5 + H, w: 2.0, d: 2.0, h: 0.85, lift: 0.28 });
  },
  // a small three-storey pagoda
  pagoda3(g, { tier, color, floors }) {
    g.add(box(1.5, 0.25, 1.5, STONE, 0, 0, 0));
    let y = 0.25;
    const n = floors >= 4 ? 3 : 3;
    for (let i = 0; i < n; i++) {
      const w = 0.95 - i * 0.12, h = 0.42;
      g.add(box(w, h, w, PLASTER, 0, y, 0));
      for (const [axis, f] of [['z', w / 2], ['x', w / 2]]) { for (const e of [-w / 2 + 0.04, w / 2 - 0.04]) g.add(onWall(axis, e, y, f, 0.07, h, 0.03, VERM)); g.add(onWall(axis, 0, y + 0.04, f, w * 0.4, h * 0.65, 0.03, VERM)); g.add(onWall(axis, 0, y + h - 0.07, f, w, 0.07, 0.035, VERM)); }
      roof(g, { y: y + h, w: w + 0.75, d: w + 0.75, h: 0.3, lift: 0.2, ridge: false });
      y += h + 0.25;
    }
    g.add(cyl(0.03, 0.04, 1.0, BRONZE, 0, y, 0, 8, goldM));
    for (let k = 0; k < 6; k++) g.add(at(mesh(new THREE.TorusGeometry(0.09 - k * 0.005, 0.018, 4, 12), 0xa8803a, goldM), 0, y + 0.2 + k * 0.1, 0).rotateX(Math.PI / 2));
    if (tier >= 6) g.add(at(mesh(new THREE.SphereGeometry(0.06, 8, 6), GOLD, { metalness: 0.8, roughness: 0.2, emissive: 0xffb040, emissiveIntensity: 0.4 }), 0, y + 1.05, 0));
    return y + 1.1;
  },
  // a koi garden: a pond with a red arched bridge over it, rocks, iris and a lantern
  koigarden(g, { tier }) {
    g.add(cyl(1.15, 1.2, 0.04, MOSS, 0, 0, 0, 22));
    koiPond(g, 0.05, 0.05, 0.85, 0.6, 0.02);
    // the bridge: an arch of planks with red rails
    const br = new THREE.Group();
    for (let k = 0; k < 9; k++) { const t = k / 8 - 0.5, y = 0.32 * (1 - 4 * t * t); const pl = box(0.18, 0.04, 0.42, WOOD, t * 1.6, 0.04 + y, 0); pl.rotation.z = -t * 1.2; br.add(pl); }
    for (const e of [-0.22, 0.22]) {
      for (let k = 0; k < 5; k++) { const t = k / 4 - 0.5, y = 0.32 * (1 - 4 * t * t); br.add(box(0.05, 0.28, 0.05, VERM, t * 1.55, 0.06 + y, e)); }
      for (let k = 0; k < 8; k++) { const t0 = k / 8 - 0.5, t1 = (k + 1) / 8 - 0.5; rod(br, [t0 * 1.55, 0.34 + 0.32 * (1 - 4 * t0 * t0), e], [t1 * 1.55, 0.34 + 0.32 * (1 - 4 * t1 * t1), e], 0.03, VERM); }
    }
    br.rotation.y = -0.6; g.add(br);
    for (const [x, z] of [[-0.85, 0.6], [0.8, -0.65], [-0.7, -0.7]]) { for (let k = 0; k < 4; k++) g.add(at(mesh(new THREE.ConeGeometry(0.03, 0.4, 4), 0x4f8f3a), x + (k % 2) * 0.08, 0.2, z + (k >> 1) * 0.08)); g.add(at(mesh(new THREE.SphereGeometry(0.05, 6, 4), 0x6a4fc0), x + 0.04, 0.42, z + 0.04)); }
    rocks(g, 0.85, 0.75, 0.6, 0.02, 3, 61);
    lantern(g, -0.85, -0.2, 0.6, 0.02);
    if (tier >= 5) pine(g, 0.9, -0.85, 0.55, 0.02, 62);
    return 0.9;
  },
  // a dry garden (karesansui): raked gravel round three rocks and moss islands, behind
  // a low clay wall capped with tiles
  zengarden(g, { tier }) {
    const gm = g.add(box(2.05, 0.06, 2.0, 0xe2ded4, 0, 0, 0));
    const lines = new THREE.Group();
    for (let k = 0; k < 9; k++) lines.add(box(1.9, 0.012, 0.025, 0xb8b2a4, 0, 0.06, -0.85 + k * 0.21));
    g.add(lines);
    for (const [x, z, r, s] of [[-0.45, -0.25, 0.32, 1.1], [0.35, 0.3, 0.24, 0.9], [0.55, -0.45, 0.18, 0.8]]) {
      for (let k = 0; k < 3; k++) { const ring = mesh(new THREE.TorusGeometry(r + 0.12 + k * 0.1, 0.012, 3, 24), 0xb8b2a4); ring.rotation.x = Math.PI / 2; ring.position.set(x, 0.07, z); g.add(ring); }
      g.add(at(mesh(new THREE.CylinderGeometry(r + 0.4, r + 0.4, 0.008, 20), 0xe2ded4), x, 0.064, z));
      const rk = mesh(new THREE.DodecahedronGeometry(r, 0), STONE_D, { flatShading: true }); rk.scale.set(1, s, 0.85); rk.rotation.y = x * 3; rk.position.set(x, 0.06 + r * 0.5 * s, z); g.add(rk);
      g.add(at(mesh(new THREE.CylinderGeometry(r + 0.06, r + 0.1, 0.03, 12), MOSS), x, 0.06, z));
    }
    // the clay wall along the two back sides
    for (const [x, z, w, d] of [[0, -1.0, 2.1, 0.14], [-1.03, 0, 0.14, 2.0]]) { g.add(box(w, 0.55, d, 0xd8b88a, x, 0, z)); g.add(box(w + 0.12, 0.08, d + 0.14, J.TILE_D, x, 0.55, z)); }
    if (tier >= 5) { pine(g, -0.7, -0.75, 0.5, 0.06, 71); }
    return 0.7;
  },
  // a hot spring: a steaming pool in rough stones, a little wooden bath house, a bamboo
  // screen and a warm lantern
  onsen(g, { tier }) {
    g.add(box(2.0, 0.08, 1.9, STONE_D, 0, 0, 0));
    const water = mesh(new THREE.CircleGeometry(1, 22), 0x6fb8c0, { roughness: 0.08, metalness: 0.15, emissive: 0x3fa0b0, emissiveIntensity: 0.15 }); water.rotation.x = -Math.PI / 2; water.scale.set(0.6, 0.5, 1); water.position.set(0.35, 0.1, 0.35); g.add(water);
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2, st = mesh(new THREE.DodecahedronGeometry(0.13 + (i % 3) * 0.04, 0), i % 2 ? STONE : STONE_D, { flatShading: true }); st.scale.y = 0.6; st.position.set(0.35 + Math.cos(a) * 0.66, 0.12, 0.35 + Math.sin(a) * 0.56); g.add(st); }
    const sm = steamM();
    for (let k = 0; k < 4; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.2 + k * 0.05, 8, 6), sm); p.position.set(0.2 + k * 0.12, 0.3 + k * 0.25, 0.3 + (k % 2) * 0.15); g.add(p); }
    const t = hall(g, { x: -0.45, z: -0.45, w: 1.0, d: 0.9, h: 0.8, y0: 0.08, wall: WOOD_L, frame: WOOD_D, bay: 0.5, baseH: 0.06 });
    shoji(g, 'z', -0.45, 0.3, 0.0, 0.6, 0.45);
    noren(g, 'x', -0.45, 0.85, 0.05, 0.5, 0x2f4f8a);
    for (let k = 0; k < 9; k++) g.add(cyl(0.03, 0.03, 0.9, 0x9ab85a, 0.95, 0.08, -0.9 + k * 0.09, 6));
    g.add(box(0.04, 0.04, 0.85, WOOD_D, 0.95, 0.75, -0.55));
    lantern(g, -0.75, 0.75, 0.55, 0.08);
    if (tier >= 5) chochin(g, -0.05, 0.8, -0.0, 0xf2e6c8);
    return roof(g, { x: -0.45, y: t, z: -0.45, w: 1.4, d: 1.3, h: 0.5, lift: 0.1 });
  },
  // a castle corner turret (yagura): a battered stone base, white walls with black
  // boarding, two roofs with a little gable
  yagura(g, { tier, color, floors }) {
    const base = mesh(new THREE.CylinderGeometry(1.05, 1.3, 0.7, 4, 1), 0x9a968a, { flatShading: true, roughness: 1 }); base.rotation.y = Math.PI / 4; base.position.y = 0.35; g.add(base);
    const h1 = 0.7, t1 = 0.7 + h1;
    g.add(box(1.4, h1, 1.3, PLASTER, 0, 0.7, 0), box(1.42, h1 * 0.4, 1.32, 0x2a2a2e, 0, 0.7, 0));
    for (const [axis, f] of [['z', 0.65], ['x', 0.7]]) for (const e of [-0.35, 0.35]) g.add(onWall(axis, e, 0.7 + h1 * 0.55, f, 0.14, 0.14, 0.03, 0x1e1e22));
    roof(g, { y: t1, w: 1.95, d: 1.85, h: 0.32, lift: 0.18, ridge: false });
    gable(g, 0, t1 + 0.05, 0.75, 0.7, 0.28);
    const h2 = 0.45 + Math.min(2, floors - 2) * 0.15;
    g.add(box(0.95, h2, 0.85, PLASTER, 0, t1 + 0.28, 0), box(0.97, h2 * 0.35, 0.87, 0x2a2a2e, 0, t1 + 0.28, 0));
    g.add(onWall('z', 0, t1 + 0.28 + h2 * 0.5, 0.425, 0.14, 0.14, 0.03, 0x1e1e22));
    const top = roof(g, { y: t1 + 0.28 + h2, w: 1.5, d: 1.4, h: 0.55, lift: 0.18 });
    if (tier >= 6) for (const e of [-1, 1]) { const f = box(0.07, 0.16, 0.07, GOLD, e * 0.12, top - 0.05, 0, goldM); g.add(f); }
    return top;
  },
  // a thatched farmhouse (minka): a steep, thick straw roof over dark timber and white
  // plaster, a wide veranda, shoji glowing behind it
  minka(g, { tier }) {
    const t = hall(g, { w: 1.9, d: 1.5, h: 0.95, y0: 0, wall: PLASTER, frame: WOOD_D, bay: 0.48, baseH: 0.2 });
    shoji(g, 'z', 0.15, 0.32, 0.75, 1.2, 0.55); koshi(g, 'x', 0, 0.32, 0.95, 0.9, 0.5);
    g.add(onWall('z', -0.65, 0.22, 0.75, 0.4, 0.75, 0.03, 0x2a1e18));
    engawa(g, { axis: 'z', a: 0.15, f: 0.75, len: 1.4, depth: 0.32, y: 0.32, rail: null, posts: false });
    for (const [x, z] of [[-0.75, 0.95], [-0.5, 1.0]]) g.add(cyl(0.13, 0.11, 0.22, 0xa07a4a, x, 0, z, 8));
    if (tier >= 4) for (let k = 0; k < 3; k++) { const p = cyl(0.06, 0.06, 0.25, 0xe86a2a, 0.98, t - 0.4 - k * 0.12, 0.55 - k * 0.2, 6); p.rotation.z = Math.PI / 2; g.add(p); }   // persimmons drying under the eaves
    return roof(g, { y: t, w: 2.5, d: 2.15, h: 1.25, kind: 'thatch' });
  },
};

// ---------------- the garden pieces ----------------
// each stands on the ground in a free corner; fw/fd is its half footprint
const GEAR = {
  // a tall stone lantern on a mossy rock
  lantern: () => { const g = G(); g.add(at(mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.04, 12), MOSS), 0, 0, 0)); lantern(g, 0, 0, 1.0, 0.04); rocks(g, 0.3, 0.25, 0.4, 0, 2, 81); return { g, fw: 0.45, fd: 0.45, ground: true }; },
  // carp streamers (koinobori) flying from a tall pole: black, red and blue
  koinobori: (color) => {
    const g = G(cyl(0.04, 0.05, 3.2, WOOD_L, 0, 0, 0, 6), cyl(0.15, 0.18, 0.15, STONE, 0, 0, 0, 8));
    g.add(at(mesh(new THREE.SphereGeometry(0.07, 8, 6), GOLD, goldM), 0, 3.25, 0));
    [0x2a2a30, 0xd9302a, color].forEach((c, k) => {
      const len = 1.0 - k * 0.15, y = 2.9 - k * 0.42;
      const body = mesh(new THREE.ConeGeometry(0.17 - k * 0.02, len, 10, 1, true), c, { side: THREE.DoubleSide }); body.rotation.z = Math.PI / 2; body.position.set(len / 2 + 0.05, y, 0); g.add(body);
      g.add(at(mesh(new THREE.SphereGeometry(0.05, 6, 4), 0xffffff), 0.12, y + 0.05, 0.12), at(mesh(new THREE.TorusGeometry(0.16 - k * 0.02, 0.02, 4, 12), 0xf6f2e8), 0.06, y, 0).rotateY(Math.PI / 2));
    });
    return { g, fw: 0.45, fd: 0.3, ground: true, tall: true };
  },
  // a bonsai pine in a glazed pot on a wooden stand
  bonsai: () => {
    const g = G(box(0.7, 0.4, 0.4, WOOD_D, 0, 0, 0), box(0.8, 0.05, 0.5, WOOD, 0, 0.4, 0));
    g.add(box(0.45, 0.12, 0.3, 0x2f5a7a, 0, 0.45, 0));
    pine(g, 0, 0, 0.35, 0.55, 91);
    return { g, fw: 0.45, fd: 0.3, ground: true };
  },
  // a bamboo water clacker (shishi-odoshi) by a stone basin
  shishiodoshi: () => {
    const g = G(box(0.6, 0.18, 0.45, STONE_D, 0, 0, 0), box(0.45, 0.02, 0.3, 0x3a6a8a, 0, 0.18, 0, { roughness: 0.1 }));
    for (const e of [-0.12, 0.12]) g.add(cyl(0.025, 0.025, 0.55, 0x8ab85a, -0.35, 0, e, 6));
    const tube = cyl(0.045, 0.045, 0.6, 0x9ac85a, 0, 0, 0, 8); tube.rotation.z = 1.2; tube.position.set(-0.35, 0.45, 0); g.add(tube);
    rod(g, [-0.75, 0.75, 0], [-0.55, 0.6, 0], 0.03, 0x8ab85a);
    rocks(g, 0.15, 0.35, 0.45, 0, 2, 93);
    return { g, fw: 0.5, fd: 0.4, ground: true };
  },
  // a row of tall festival banners (nobori) in the company colour
  nobori: (color) => {
    const g = G();
    for (let k = 0; k < 3; k++) {
      const x = -0.45 + k * 0.45;
      g.add(cyl(0.025, 0.025, 2.0, WOOD_L, x, 0, 0, 6), box(0.3, 0.02, 0.02, WOOD_L, x + 0.15, 1.95, 0));
      g.add(box(0.28, 1.25, 0.015, k === 1 ? 0xf6f2e8 : color, x + 0.16, 0.65, 0));
      g.add(box(0.06, 0.6, 0.02, k === 1 ? color : 0xf6f2e8, x + 0.16, 1.0, 0.005));
    }
    return { g, fw: 0.55, fd: 0.2, ground: true, tall: true };
  },
  // a big taiko drum on its stand
  taiko: (color) => {
    const g = G();
    for (const e of [-0.32, 0.32]) g.add(box(0.08, 0.7, 0.08, VERM, e, 0, 0.2), box(0.08, 0.7, 0.08, VERM, e, 0, -0.2));
    g.add(box(0.75, 0.06, 0.48, VERM, 0, 0.3, 0));
    const drum = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.45, 18), 0x7a3a1e); drum.rotation.z = Math.PI / 2; drum.position.y = 0.72; g.add(drum);
    for (const e of [-0.23, 0.23]) { const head = mesh(new THREE.CylinderGeometry(0.33, 0.33, 0.02, 18), 0xf2e6c8); head.rotation.z = Math.PI / 2; head.position.set(e, 0.72, 0); g.add(head); mon(g, 'x', 0, 0.72, e, 0.12, color); }
    for (const e of [-1, 1]) { const st = cyl(0.015, 0.02, 0.4, WOOD_L, 0.35, 0.3, e * 0.08, 6); st.rotation.z = 0.5; g.add(st); }
    return { g, fw: 0.45, fd: 0.35, ground: true };
  },
  // a string of paper lanterns between two posts
  chochin: (color) => {
    const g = G(cyl(0.04, 0.04, 1.6, WOOD_D, -0.5, 0, 0, 6), cyl(0.04, 0.04, 1.6, WOOD_D, 0.5, 0, 0, 6));
    rod(g, [-0.5, 1.55, 0], [0.5, 1.55, 0], 0.01, 0x2a2420);
    for (let k = 0; k < 4; k++) chochin(g, -0.36 + k * 0.24, 1.38, 0, k % 2 ? color : VERM, 0.8);
    return { g, fw: 0.55, fd: 0.2, ground: true };
  },
  // straw-wrapped sake barrels (komodaru), stacked
  sakebarrels: () => {
    const g = G();
    for (const [x, y, z] of [[-0.25, 0, -0.1], [0.25, 0, -0.1], [0, 0.5, -0.1], [0.3, 0, 0.35]]) {
      g.add(cyl(0.24, 0.24, 0.5, 0xd8c9a0, x, y, z, 12));
      for (const k of [0.08, 0.42]) g.add(cyl(0.25, 0.25, 0.04, 0x8a6a3a, x, y + k, z, 12));
      g.add(box(0.2, 0.18, 0.01, 0xd9302a, x, y + 0.16, z + 0.245));
    }
    return { g, fw: 0.5, fd: 0.45, ground: true };
  },
  // a clump of bamboo behind a low woven fence
  bamboo: () => { const g = G(); bamboo(g, 0, -0.1, 0.65, 0, 6, 95); for (let k = 0; k < 7; k++) g.add(cyl(0.02, 0.02, 0.5, 0x9a8a5a, -0.45 + k * 0.15, 0, 0.35, 5)); g.add(box(1.0, 0.04, 0.04, 0x5a4a30, 0, 0.35, 0.35)); return { g, fw: 0.5, fd: 0.45, ground: true, tall: true }; },
  // garden trees
  sakura: () => { const g = G(); sakura(g, 0, 0, 0.7, 0, 97); shrub(g, 0.35, 0.3, 0.6, 0, 0xd8579a); return { g, fw: 0.5, fd: 0.5, ground: true, tall: true }; },
  maple: () => { const g = G(); maple(g, 0, 0, 0.75, 0, 98); rocks(g, 0.3, 0.3, 0.4, 0, 2, 99); return { g, fw: 0.5, fd: 0.5, ground: true, tall: true }; },
  pine: () => { const g = G(); pine(g, 0, 0, 0.75, 0, 100); g.add(at(mesh(new THREE.CylinderGeometry(0.45, 0.5, 0.04, 12), MOSS), 0, 0, 0)); return { g, fw: 0.5, fd: 0.5, ground: true, tall: true }; },
  // a rickshaw waiting for a fare
  rickshaw: (color) => {
    const g = G();
    for (const e of [-0.3, 0.3]) { const w = mesh(new THREE.TorusGeometry(0.32, 0.03, 5, 16), 0x2a2420); w.position.set(0, 0.32, e); g.add(w); for (let k = 0; k < 4; k++) { const sp = box(0.02, 0.62, 0.02, 0x5a4a3a, 0, 0.01, e); sp.rotation.z = k * Math.PI / 4; sp.position.y = 0.32 - 0.31 * Math.cos(k * Math.PI / 4); g.add(sp); } }
    g.add(box(0.45, 0.08, 0.6, 0x2a2420, -0.05, 0.42, 0), box(0.45, 0.25, 0.55, color, -0.05, 0.5, 0), box(0.08, 0.45, 0.55, color, -0.27, 0.6, 0));
    const hood = mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.6, 12, 1, true, 0, Math.PI), 0x2a2420, { side: THREE.DoubleSide }); hood.rotation.x = Math.PI / 2; hood.rotation.z = Math.PI / 2; hood.position.set(-0.25, 0.95, 0); g.add(hood);
    for (const e of [-0.24, 0.24]) { const sh = box(0.9, 0.04, 0.04, WOOD_D, 0.55, 0.3, e); sh.rotation.z = -0.25; g.add(sh); }
    return { g, fw: 0.55, fd: 0.4, ground: true };
  },
  // at the top level: a golden lantern on a stone plinth
  beacon: () => {
    const g = G(box(0.7, 0.3, 0.7, STONE, 0, 0, 0));
    const L = lantern(g, 0, 0, 1.4, 0.3);
    L.traverse(o => { if (o.isMesh && !o.material.userData.night) o.material = mat(GOLD, goldM); });
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), mat(0xffd76a, { emissive: 0xffb300, emissiveIntensity: 1.6 })); orb.position.y = 0.3 + 1.15 * 1.4; g.add(orb);
    return { g, fw: 0.45, fd: 0.45, ground: true, tall: true };
  },
};

export const JAPAN_STYLE = {
  mine:       { wings: ['kura', 'minka', 'belltower'],       props: ['sakebarrels', 'lantern', 'bamboo', 'koinobori'] },
  furnace:    { wings: ['kura', 'belltower', 'machiya'],     props: ['sakebarrels', 'nobori', 'lantern', 'pine'] },
  press:      { wings: ['machiya', 'shrine', 'kura'],        props: ['taiko', 'nobori', 'lantern', 'maple'] },
  gear:       { wings: ['machiya', 'teahouse', 'pagoda3'],   props: ['bonsai', 'chochin', 'koinobori', 'sakura'] },
  engine:     { wings: ['machiya', 'kura', 'yagura'],        props: ['rickshaw', 'nobori', 'chochin', 'sakura'] },
  turbine:    { wings: ['machiya', 'zengarden', 'pagoda3'],  props: ['bonsai', 'lantern', 'koinobori', 'maple'] },
  rocket:     { wings: ['shrine', 'kura', 'belltower'],      props: ['nobori', 'taiko', 'koinobori', 'pine'] },
  power:      { wings: ['koigarden', 'minka', 'onsen'],      props: ['shishiodoshi', 'lantern', 'bamboo', 'maple'] },
  datacenter: { wings: ['zengarden', 'shrine', 'belltower'], props: ['bonsai', 'shishiodoshi', 'lantern', 'sakura'] },
  hq:         { wings: ['yagura', 'koigarden', 'teahouse'],  props: ['taiko', 'nobori', 'koinobori', 'sakura'] },
};
JAPAN_STYLE.default = JAPAN_STYLE.gear;

export function japanGear(name, color) { return (GEAR[name] || GEAR.lantern)(color); }
export function japanWing(kind, g, o) { return (WINGS[kind] || WINGS.kura)(g, o); }

const WING_TEXT = { kura: 'a white storehouse', machiya: 'a townhouse', teahouse: 'a tea house', shrine: 'a little shrine', belltower: 'a bell tower', pagoda3: 'a three-storey pagoda',
  koigarden: 'a koi garden', zengarden: 'a rock garden', onsen: 'a hot spring', yagura: 'a castle turret', minka: 'a thatched farmhouse' };
const GEAR_TEXT = { lantern: 'a stone lantern', koinobori: 'carp streamers', bonsai: 'a bonsai', shishiodoshi: 'a bamboo water clacker', nobori: 'festival banners', taiko: 'a taiko drum',
  chochin: 'paper lanterns', sakebarrels: 'sake barrels', bamboo: 'a bamboo grove', sakura: 'a cherry tree', maple: 'a maple', pine: 'a garden pine', rickshaw: 'a rickshaw' };
export function japanLookText(type, level) {
  const st = JAPAN_STYLE[type] || JAPAN_STYLE.default, w = st.wings.map(k => WING_TEXT[k]), p = st.props.map(k => GEAR_TEXT[k]);
  return { 5: `${w[0]} and ${p[0]}`, 10: `${w[1]} and ${p[1]}`, 25: `${w[2]} and ${p[2]}`, 50: `${p[3]} and a fresh new finish`, 100: 'taller, grander buildings', 250: 'a golden lantern' }[level] || '';
}
