// How the Wild West buildings grow as they level up. Every kind of building gets its own
// three additions (one per milestone, in the free corners of its lot) and its own four
// pieces of gear on the roof or in the yard, so a levelled-up mine looks like a bigger
// mine and a levelled-up saloon looks like a bigger part of town, not a copy of each other.
//
// Additions are built round (0, 0) on a footprint about 2.3 x 2.2, front facing +z, and
// return the height of their roof. Young towns build in weathered timber; by the later
// tiers the boards are freshly painted and the lamps are lit.
import * as THREE from 'three';
import { box, cyl } from './models.js';
import { WARM, GLASS, shade, mesh, rod, onWall } from './buildings.js';
import { falseFront, porch, balcony, wWin, wSign, textPanel, battens, barrel, hay, crate, wheel, hitchRail, horse, waterTower, windmill, timberTower,
  WOOD, WOOD_D, WOOD_L, GREY, TRIM, SHINGLE, CREAM } from './buildings-west.js';

const BRICK = 0xa4553a, STONE = 0xb8a88e, IRON = 0x3a3f48, GOLD = 0xe8c46a, INK = 0x2a2420, RED = 0xa8322a;
const lamp = (g, x, y, z) => g.add(box(0.13, 0.2, 0.13, 0xfff1cf, x, y, z, { emissive: 0xffc070, night: 2.6 }));
// boards weather grey when the town is young, and get a fresh coat of paint later
const aged = (color, tier) => tier <= 2 ? new THREE.Color(color).lerp(new THREE.Color(0x8f8574), 0.45).getHex() : tier >= 7 ? shade(color, 0.08) : color;
// a plain gabled shed: walls, battens, a pitched roof (ridge running along z) with shingle lines
function shed(g, { x = 0, z = 0, w, d, h, color, roof = SHINGLE, rise = 0.55, boards = true }) {
  g.add(box(w, h, d, color, x, 0, z));
  if (boards) battens(g, x, z, w, d, 0, h, color);
  const hw = w / 2 + 0.12, sh = new THREE.Shape(); sh.moveTo(-hw, 0); sh.lineTo(hw, 0); sh.lineTo(0, rise); sh.closePath();
  const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.24, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.24) / 2);
  const r = mesh(rg, roof); r.position.set(x, h, z); g.add(r);
  const tri = new THREE.Shape(); tri.moveTo(-w / 2, 0); tri.lineTo(w / 2, 0); tri.lineTo(0, rise - 0.06); tri.closePath();
  const gab = mesh(new THREE.ShapeGeometry(tri), color); gab.position.set(x, h, z + d / 2 + 0.005); g.add(gab);
  const sl = Math.atan2(rise, hw);
  for (const e of [-1, 1]) for (let k = 1; k <= 3; k++) { const t = k / 4, c = box(0.05, 0.03, d + 0.2, shade(roof, -0.25), x + e * hw * (1 - t), h + rise * t - 0.005, z); c.rotation.z = e * sl; g.add(c); }
  return h + rise;
}
// a lean-to: three walls and a roof sloping down to the front on posts, open at the front
function leanTo(g, { x = 0, z = 0, w, d, h, color, roof = SHINGLE }) {
  g.add(box(w, h, 0.1, color, x, 0, z - d / 2 + 0.05));
  for (const e of [-1, 1]) g.add(box(0.1, h * 0.8, d, color, x + e * (w / 2 - 0.05), 0, z));
  for (const e of [-1, 0, 1]) g.add(box(0.1, h * 0.75, 0.1, WOOD_D, x + e * (w / 2 - 0.08), 0, z + d / 2 - 0.05));
  const r = box(w + 0.25, 0.06, d + 0.35, roof, x, h * 0.8, z + 0.05); r.rotation.x = 0.22; g.add(r);
  const floor = mesh(new THREE.PlaneGeometry(w - 0.2, d - 0.2), 0x8a6a45); floor.rotation.x = -Math.PI / 2; floor.position.set(x, 0.01, z); g.add(floor);
  return h;
}
// courses of stone (or brick) on the visible faces of a block
function courses(g, x, z, w, d, h, color, step = 0.22) {
  const c = shade(color, -0.22);
  for (let y = step; y < h; y += step) { g.add(onWall('z', x, y, z + d / 2, w, 0.025, 0.015, c), onWall('x', z, y, x + w / 2, d, 0.025, 0.015, c)); }
  for (let y = 0, r = 0; y < h - step / 2; y += step, r++) for (let a = -w / 2 + (r % 2 ? 0.25 : 0.12); a < w / 2 - 0.05; a += 0.36) g.add(onWall('z', x + a, y, z + d / 2, 0.02, step, 0.015, c));
}
const sackPile = (g, x, z, n = 4) => { for (let k = 0; k < n; k++) { const s = mesh(new THREE.SphereGeometry(0.17, 8, 6), 0xd8c49a); s.scale.set(1.2, 0.7, 0.8); s.position.set(x + (k % 2) * 0.32 - 0.16, 0.12 + Math.floor(k / 2) * 0.2, z + (k % 3) * 0.05); g.add(s); } };
function oreCart(g, x, z, ry = 0, load = 0xc9a24a) {
  const c = new THREE.Group();
  c.add(box(0.55, 0.3, 0.4, 0x6a4a32, 0, 0.1, 0), box(0.57, 0.04, 0.42, IRON, 0, 0.38, 0));
  const ore = mesh(new THREE.DodecahedronGeometry(0.2, 0), load, { flatShading: true, metalness: 0.3, roughness: 0.5 }); ore.scale.y = 0.5; ore.position.y = 0.42; c.add(ore);
  for (const [wx, wz] of [[-0.18, -0.21], [0.18, -0.21], [-0.18, 0.21], [0.18, 0.21]]) c.add(cyl(0.08, 0.08, 0.04, 0x2a2d33, wx, 0.06, wz, 10).rotateX(Math.PI / 2));
  c.position.set(x, 0, z); c.rotation.y = ry; g.add(c); return c;
}
function rails(g, x0, x1, z, y = 0) {
  for (const e of [-0.2, 0.2]) g.add(box(Math.abs(x1 - x0), 0.04, 0.04, 0x6a6e76, (x0 + x1) / 2, y + 0.04, z + e));
  for (let x = Math.min(x0, x1) + 0.1; x < Math.max(x0, x1); x += 0.28) g.add(box(0.1, 0.04, 0.56, 0x5a4632, x, y, z));
}
function chimneyStack(g, x, z, y, h, color = BRICK) { g.add(box(0.36, h, 0.36, color, x, y, z), box(0.44, 0.08, 0.44, shade(color, -0.3), x, y + h, z)); }

// ---------------------------------------------------------------- additions
const WINGS = {
  // GOLD MINE ---------------------------------------------------------------
  // a tall timber ore bin on legs, its chute dropping ore into a cart on a spur of track
  orebins(g, { tier }) {
    const c = aged(WOOD, tier);
    for (const [x, z] of [[-0.75, -0.6], [0.75, -0.6], [-0.75, 0.5], [0.75, 0.5]]) g.add(box(0.14, 1.3, 0.14, WOOD_D, x, 0, z));
    for (const z of [-0.6, 0.5]) { const br = box(1.6, 0.07, 0.07, WOOD_D, 0, 0.65, z); br.rotation.z = 0.6; g.add(br); }
    g.add(box(1.8, 1.2, 1.4, c, 0, 1.3, -0.05)); battens(g, 0, -0.05, 1.8, 1.4, 1.3, 1.2, c);
    const top = box(1.9, 0.08, 1.5, SHINGLE, 0, 2.5, -0.05); top.rotation.x = -0.15; g.add(top);
    const ch = box(0.45, 0.06, 0.9, WOOD_L, 0, 1.05, 0.95); ch.rotation.x = 0.5; g.add(ch);
    for (const e of [-0.22, 0.22]) { const s = box(0.04, 0.16, 0.9, WOOD_D, e, 1.05, 0.95); s.rotation.x = 0.5; g.add(s); }
    g.add(box(0.1, 1.3, 0.1, WOOD_D, -1.0, 0, 0.9)); for (let k = 0; k < 6; k++) g.add(box(0.36, 0.04, 0.04, WOOD_D, -0.82, 0.2 + k * 0.22, 0.9));   // ladder
    rails(g, -1.15, 1.15, 1.05); oreCart(g, 0.2, 1.05);
    if (tier >= 5) lamp(g, 0.95, 1.9, 0.68);
    return 2.6;
  },
  // a squat stone assay office with an iron door, a barred window and a smoking stack
  assay(g, { tier }) {
    const w = 2.0, d = 1.7, h = 1.5, st = tier >= 5 ? 0xc9bba2 : STONE;
    g.add(box(w, h, d, st, 0, 0, 0)); courses(g, 0, 0, w, d, h, st);
    g.add(box(w + 0.15, 0.15, d + 0.15, shade(st, -0.15), 0, h, 0));
    g.add(onWall('z', -0.45, 0, d / 2, 0.55, 1.1, 0.05, IRON)); for (let k = 0; k < 3; k++) g.add(onWall('z', -0.45, 0.2 + k * 0.35, d / 2 + 0.04, 0.55, 0.04, 0.02, 0x6a6e76));
    wWin(g, 'z', 0.5, 0.55, d / 2, 0.42, 0.5, 0xd8d0c0, tier >= 3 ? WARM : GLASS); for (let k = 0; k < 3; k++) g.add(onWall('z', 0.38 + k * 0.12, 0.55, d / 2 + 0.07, 0.025, 0.5, 0.02, IRON));
    wSign(g, 'z', 0, 1.2, d / 2, 1.5, 0.22, INK, 5, GOLD, 'ASSAY OFFICE');
    chimneyStack(g, 0.6, -0.4, h + 0.15, 0.7);
    wWin(g, 'x', 0, 0.55, w / 2, 0.42, 0.5, 0xd8d0c0);
    crate(g, -0.85, 1.15, 0, 0.35);
    return h + 0.9;
  },
  // a second, smaller shaft: a little headframe with its own sheave, a hand windlass and
  // a heap of tailings
  shaft(g, { tier }) {
    g.add(box(1.1, 0.12, 1.1, 0x5a4632, -0.3, 0, -0.2), box(0.7, 0.03, 0.7, 0x1a1410, -0.3, 0.12, -0.2));
    timberTower(g, -0.3, -0.2, 0.55, 0.22, 2.9, aged(WOOD, tier), 3);
    g.add(box(0.5, 0.1, 0.5, WOOD_D, -0.3, 2.9, -0.2));
    const sv = mesh(new THREE.TorusGeometry(0.28, 0.04, 6, 16), IRON); sv.position.set(-0.3, 3.3, -0.2); sv.rotation.y = Math.PI / 2; g.add(sv);
    rod(g, [-0.3, 3.3, 0.08], [0.75, 0.75, 0.08], 0.015, 0x2a2d33);
    for (const e of [-0.3, 0.3]) g.add(box(0.08, 0.7, 0.08, WOOD_D, 0.75, 0, e));
    g.add(cyl(0.12, 0.12, 0.7, WOOD_L, 0.75, 0.75 - 0.35, 0, 8).rotateX(Math.PI / 2));
    const crank = box(0.04, 0.3, 0.04, IRON, 0.75, 0.6, 0.38); g.add(crank);
    const heap = mesh(new THREE.ConeGeometry(0.75, 0.6, 8), 0xa88a62, { flatShading: true }); heap.position.set(0.55, 0.3, 0.75); g.add(heap);
    if (tier >= 5) lamp(g, 0.0, 2.2, 0.1);
    return 3.6;
  },

  // STAMP MILL ----------------------------------------------------------------
  // a row of big wooden cyanide vats bound with iron hoops, on a plank deck with a walkway
  vats(g, { tier }) {
    g.add(box(2.3, 0.35, 2.1, 0x8a6a45, 0, 0, 0));
    for (const [x, z, r] of [[-0.55, -0.45, 0.5], [0.55, -0.45, 0.5], [0, 0.55, 0.45]]) {
      g.add(cyl(r, r * 1.04, 1.1, aged(0x9a6b42, tier), x, 0.35, z, 16));
      for (const k of [0.2, 0.55, 0.9]) g.add(cyl(r * 1.06, r * 1.06, 0.05, IRON, x, 0.35 + k, z, 16));
      g.add(cyl(r * 0.92, r * 0.92, 0.02, 0x8fb8a0, x, 1.43, z, 16));
    }
    for (let k = 0; k <= 5; k++) g.add(box(0.04, 0.4, 0.04, CREAM, -1.05 + k * 0.42, 1.45, 0.05));
    g.add(box(2.2, 0.06, 0.25, 0x8a6a45, 0, 1.43, 0.05), box(2.2, 0.04, 0.04, CREAM, 0, 1.85, 0.05));
    rod(g, [-0.55, 1.2, -0.95], [1.1, 1.2, -0.95], 0.06, IRON);
    return 1.9;
  },
  // a brick boiler house with arched windows, a tall iron stack and a coal heap
  boilerhouse(g, { tier }) {
    const w = 1.9, d = 1.6, h = 1.5, b = tier >= 5 ? 0xb5603f : BRICK;
    g.add(box(w, h, d, b, -0.15, 0, -0.1)); courses(g, -0.15, -0.1, w, d, h, b, 0.12);
    g.add(box(w + 0.15, 0.12, d + 0.15, 0x5a3a2a, -0.15, h, -0.1));
    for (const a of [-0.65, 0.35]) { wWin(g, 'z', a, 0.45, 0.7, 0.42, 0.6, 0xd8c4a0, tier >= 3 ? WARM : GLASS); const arch = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.06, 12, 1, false, Math.PI / 2, Math.PI), 0xd8c4a0); arch.rotation.x = Math.PI / 2; arch.position.set(a, 1.12, 0.73); g.add(arch); }
    g.add(onWall('z', -0.15, 0, 0.7, 0.5, 0.25, 0.05, IRON));
    g.add(cyl(0.16, 0.2, 3.2, IRON, 0.55, h, -0.5, 10), cyl(0.24, 0.24, 0.1, 0x2a2d33, 0.55, h + 3.2, -0.5, 10));
    for (const k of [1.0, 2.0, 3.0]) g.add(cyl(0.21, 0.21, 0.04, 0x6a6e76, 0.55, h + k, -0.5, 10));
    const coal = mesh(new THREE.ConeGeometry(0.55, 0.45, 8), 0x1e1e22, { flatShading: true }); coal.position.set(0.85, 0.22, 0.8); g.add(coal);
    return h + 3.3;
  },
  // a little crusher shed with an ore conveyor climbing to its roof and a heap of crushed rock
  crusher(g, { tier }) {
    const top = shed(g, { x: -0.3, z: -0.3, w: 1.5, d: 1.4, h: 1.7, color: aged(GREY, tier), roof: 0x9aa0a8 });
    wWin(g, 'z', -0.3, 0.8, 0.4, 0.42, 0.42, TRIM, tier >= 3 ? WARM : GLASS);
    const belt = box(0.4, 0.08, 1.9, 0x2a2420, 0.65, 0.7, 0.35); belt.rotation.x = 0.65; g.add(belt);
    for (let k = 0; k < 3; k++) g.add(box(0.06, 0.4 + k * 0.4, 0.06, WOOD_D, 0.65, 0, 0.95 - k * 0.45));
    const pile = mesh(new THREE.ConeGeometry(0.6, 0.5, 8), 0xb59a72, { flatShading: true }); pile.position.set(0.65, 0.25, 1.2); g.add(pile);
    wSign(g, 'z', -0.3, 1.25, 0.4, 1.1, 0.2, INK, 4, CREAM, 'CRUSHER');
    return top;
  },

  // BANK -----------------------------------------------------------------------
  // a stone strongroom with a great round iron vault door and a gold-lettered lintel
  vault(g, { tier }) {
    const w = 2.0, d = 1.8, h = 1.6, st = tier >= 5 ? 0xd2c6b0 : STONE;
    g.add(box(w, h, d, st, 0, 0, 0)); courses(g, 0, 0, w, d, h, st, 0.27);
    g.add(box(w + 0.2, 0.18, d + 0.2, shade(st, -0.12), 0, h, 0), box(w + 0.3, 0.1, d + 0.3, shade(st, -0.25), 0, h + 0.18, 0));
    const door = mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.12, 24), 0x5a5f66, { metalness: 0.7, roughness: 0.35 }); door.rotation.x = Math.PI / 2; door.position.set(0, 0.68, d / 2 + 0.05); g.add(door);
    const ring = mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), GOLD, { metalness: 0.8, roughness: 0.3 }); ring.position.set(0, 0.68, d / 2 + 0.11); g.add(ring);
    const wh = mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 12), GOLD, { metalness: 0.8, roughness: 0.3 }); wh.position.set(0, 0.68, d / 2 + 0.14); g.add(wh);
    for (let k = 0; k < 3; k++) { const sp = box(0.32, 0.025, 0.025, GOLD, 0, 0.68, d / 2 + 0.14); sp.rotation.z = k * Math.PI / 3; g.add(sp); }
    textPanel(g, 'z', 0, 1.28, d / 2 + 0.01, 1.3, 0.24, 'VAULT', INK, GOLD);
    for (const e of [-0.8, 0.8]) g.add(box(0.2, 1.3, 0.12, shade(st, -0.1), e, 0, d / 2 + 0.02));
    return h + 0.3;
  },
  // a brick land office with a columned porch and a pediment
  landoffice(g, { tier }) {
    const w = 2.1, d = 1.6, h = 1.7, b = tier >= 5 ? 0xb5603f : BRICK;
    g.add(box(w, h, d, b, 0, 0, -0.25)); courses(g, 0, -0.25, w, d, h, b, 0.12);
    const pd = new THREE.Shape(); pd.moveTo(-w / 2 - 0.1, 0); pd.lineTo(w / 2 + 0.1, 0); pd.lineTo(0, 0.5); pd.closePath();
    const pg = new THREE.ExtrudeGeometry(pd, { depth: d + 0.7, bevelEnabled: false }); pg.translate(0, 0, -(d + 0.7) / 2);
    const pm = mesh(pg, TRIM); pm.position.set(0, h, 0.05); g.add(pm);
    g.add(box(w + 0.2, 0.12, d + 0.7, TRIM, 0, h - 0.06, 0.05));
    for (const a of [-0.85, -0.3, 0.3, 0.85]) g.add(cyl(0.07, 0.08, h - 0.1, TRIM, a, 0.1, 0.85, 10));
    g.add(box(w + 0.2, 0.1, 0.5, 0xd8d0c0, 0, 0, 0.8));
    g.add(onWall('z', 0, 0.1, 0.55, 0.5, 1.1, 0.05, 0x3a2a1e));
    for (const a of [-0.65, 0.65]) wWin(g, 'z', a, 0.6, 0.55, 0.38, 0.65, TRIM, tier >= 3 ? WARM : GLASS, 0x2a3a2a);
    textPanel(g, 'z', 0, h - 0.4, 0.56, 1.2, 0.2, 'LAND OFFICE', 0x2a2d33, GOLD);
    return h + 0.5;
  },
  // the grand hotel: two storeys of brick with a balcony on posts and a vertical sign
  hotel(g, { tier }) {
    const w = 2.1, d = 1.8, h = 2.6, b = tier >= 5 ? 0x8a3a2a : 0x7a4a3a;
    g.add(box(w, h, d, b, 0, 0, -0.1)); courses(g, 0, -0.1, w, d, h, b, 0.12);
    g.add(box(w + 0.2, 0.14, d + 0.2, TRIM, 0, h, -0.1)); for (let k = 0; k < 7; k++) g.add(box(0.08, 0.14, 0.12, TRIM, -w / 2 + 0.15 + k * (w - 0.3) / 6, h - 0.14, d / 2 - 0.04));
    for (const a of [-0.55, 0.55]) for (const y of [0.4, 1.6]) wWin(g, 'z', a, y, d / 2 - 0.1, 0.38, 0.62, TRIM, tier >= 3 ? WARM : GLASS, y > 1 ? 0x2a3a4a : null);
    for (const a of [-0.5, 0.4]) wWin(g, 'x', a - 0.1, 1.6, w / 2, 0.38, 0.62, TRIM, tier >= 3 ? WARM : GLASS);
    balcony(g, { axis: 'z', a: 0, f: d / 2 - 0.1, len: w, y: 1.35, depth: 0.55 });
    for (const a of [-0.95, 0, 0.95]) g.add(box(0.07, 1.35, 0.07, TRIM, a, 0, d / 2 + 0.42));
    g.add(box(0.12, 1.4, 0.4, INK, w / 2 + 0.06, 1.0, d / 2 - 0.4));
    textPanel(g, 'x', d / 2 - 0.4, 1.05, w / 2 + 0.13, 0.36, 1.3, 'H', INK, GOLD);
    textPanel(g, 'z', 0, 1.1, d / 2 - 0.08, 0.9, 0.2, 'HOTEL', INK, GOLD);
    return h + 0.15;
  },

  // GENERAL STORE ------------------------------------------------------------------
  // a barn-roofed warehouse with a big sliding door, a loading platform and crates
  warehouse(g, { tier }) {
    const c = aged(0x8a6a45, tier), top = shed(g, { x: 0, z: -0.25, w: 2.0, d: 1.6, h: 1.5, color: c, rise: 0.7 });
    g.add(onWall('z', -0.3, 0, 0.55, 0.9, 1.25, 0.05, shade(c, -0.25)));
    const dx = onWall('z', -0.3, 0.1, 0.6, 0.9, 0.06, 0.02, TRIM); g.add(dx); for (const e of [-1, 1]) { const x = onWall('z', -0.3, 0.62, 0.6, 1.2, 0.06, 0.02, TRIM); x.rotation.z = e * 0.9; g.add(x); }
    g.add(box(1.0, 0.04, 0.04, IRON, -0.3, 1.3, 0.6));
    textPanel(g, 'z', 0, 1.55, 0.56, 1.0, 0.2, 'WAREHOUSE', 0xf1ece0, INK);
    g.add(box(2.1, 0.3, 0.55, 0x8a6a45, 0, 0, 0.85));
    crate(g, 0.55, 0.85, 0.3, 0.38); crate(g, 0.85, 0.85, 0.3, 0.3); crate(g, 0.7, 0.85, 0.68, 0.3); barrel(g, -0.9, 0.85, 0.3, 0.8);
    return top;
  },
  // a little barber shop with a striped pole, a bench, and a bath-house sign
  barber(g, { tier }) {
    const top = falseFront(g, { x: 0, z: -0.15, w: 1.8, d: 1.7, h: 1.4, fh: 0.6, color: aged(0xe8dcc0, tier), sign: 0x2a3a5a, text: 'BARBER', pipe: true });
    wWin(g, 'z', -0.35, 0.65, 0.7, 0.62, 0.65, TRIM, tier >= 3 ? WARM : GLASS);
    g.add(onWall('z', 0.5, 0.25, 0.7, 0.5, 1.1, 0.05, 0x3a2a1e));
    const pole = new THREE.Group();
    pole.add(cyl(0.07, 0.07, 0.75, 0xffffff, 0, 0, 0, 10));
    for (let k = 0; k < 4; k++) { const st = box(0.15, 0.06, 0.15, k % 2 ? 0xc8302a : 0x2a4a9a, 0, 0.1 + k * 0.17, 0); st.rotation.set(0.5, k, 0); pole.add(st); }
    pole.add(cyl(0.09, 0.09, 0.06, GOLD, 0, 0.75, 0, 10));
    pole.position.set(0.9, 0.9, 0.85); g.add(pole);
    g.add(box(0.05, 0.08, 0.2, IRON, 0.9, 1.25, 0.76));
    porch(g, { axis: 'z', a: 0, f: 0.7, len: 1.8, depth: 0.55, h: 1.15, rail: false });
    g.add(box(0.7, 0.05, 0.22, 0x8a6a45, -0.45, 0.48, 0.95), box(0.04, 0.24, 0.2, 0x6e5232, -0.75, 0.24, 0.95), box(0.04, 0.24, 0.2, 0x6e5232, -0.15, 0.24, 0.95));
    return top;
  },
  // an open feed shed: a lean-to stacked with grain sacks and hay, with a set of scales
  feedshed(g, { tier }) {
    const top = leanTo(g, { x: 0, z: -0.1, w: 2.1, d: 1.6, h: 1.6, color: aged(WOOD, tier) });
    sackPile(g, -0.55, -0.35, 6); hay(g, 0.45, -0.5, 0, 0); hay(g, 0.45, -0.1, 0, 0.1); hay(g, 0.45, -0.3, 0.36, 0.05);
    g.add(box(0.05, 0.9, 0.05, IRON, 0.0, 0, 0.45), box(0.4, 0.04, 0.04, IRON, 0.0, 0.9, 0.45), box(0.2, 0.04, 0.2, 0x8a8f99, -0.15, 0.6, 0.45));
    textPanel(g, 'z', 0, 1.15, -0.85 + 0.06, 1.1, 0.25, 'FEED', 0xb5532a, CREAM);
    return top;
  },

  // LIVERY STABLE ----------------------------------------------------------------
  // open stalls under a lean-to with horses looking out over the half doors
  stalls(g, { tier }) {
    const c = aged(WOOD, tier), top = leanTo(g, { x: 0, z: -0.25, w: 2.2, d: 1.4, h: 1.7, color: c });
    for (const a of [-0.36, 0.36]) g.add(box(0.06, 1.1, 1.3, c, a, 0, -0.25));
    for (const a of [-0.72, 0, 0.72]) g.add(box(0.66, 0.6, 0.06, shade(c, -0.15), a, 0, 0.42));
    for (const [a, coat] of [[-0.72, 0x7a4a2a], [0, 0xd8c8b0], [0.72, 0x2a2420]]) horse(g, a, -0.25, Math.PI / 2 + 0.1, coat);
    hay(g, -0.7, 0.9, 0, 0.2); g.add(box(0.8, 0.25, 0.3, 0x6e5232, 0.5, 0, 0.85), box(0.75, 0.02, 0.25, 0x4a7aa8, 0.5, 0.23, 0.85));
    return top;
  },
  // the blacksmith's forge: an open-fronted shed with a glowing brick hearth, an anvil,
  // a quench tub and wagon wheels waiting for new tyres
  smithy(g, { tier }) {
    const top = leanTo(g, { x: 0, z: -0.2, w: 2.1, d: 1.5, h: 1.8, color: aged(GREY, tier) });
    g.add(box(0.8, 0.7, 0.6, BRICK, -0.5, 0, -0.55)); g.add(box(0.5, 0.06, 0.35, 0xff7a2a, -0.5, 0.7, -0.5, { emissive: 0xff5a10, emissiveIntensity: 1.4 }));
    chimneyStack(g, -0.5, -0.75, 0.7, 1.9);
    g.add(box(0.18, 0.35, 0.18, IRON, 0.35, 0, -0.1), box(0.45, 0.14, 0.18, 0x2a2d33, 0.35, 0.35, -0.1));
    const horn = mesh(new THREE.ConeGeometry(0.07, 0.25, 6), 0x2a2d33); horn.rotation.z = -Math.PI / 2; horn.position.set(0.68, 0.43, -0.1); g.add(horn);
    g.add(cyl(0.22, 0.2, 0.35, 0x6e4a2c, 0.75, 0, 0.45, 12), cyl(0.2, 0.2, 0.02, 0x2a3a4a, 0.75, 0.33, 0.45, 12));
    wheel(g, -0.9, 0.38, 0.75, 0.36, 0.3); wheel(g, -0.6, 0.38, 0.85, 0.36, 0.1);
    textPanel(g, 'z', 0.3, 1.3, -0.95 + 0.06, 1.2, 0.24, 'BLACKSMITH', INK, CREAM);
    return top + 0.4;
  },
  // a carriage shed with a buggy parked inside and harness hung on the wall
  carriage(g, { tier }) {
    const c = aged(0x8a5a3a, tier), top = shed(g, { x: 0, z: -0.15, w: 2.1, d: 1.7, h: 1.4, color: c });
    g.add(onWall('z', 0, 0, 0.7, 1.5, 1.2, 0.04, 0x1e1a16));
    for (const e of [-1, 1]) g.add(box(0.5, 1.2, 0.05, shade(c, -0.15), e * 0.95, 0, 0.98));
    const b = new THREE.Group();
    b.add(box(0.75, 0.3, 0.5, 0x2a2420, 0, 0.35, 0), box(0.3, 0.35, 0.5, 0x2a2420, -0.2, 0.65, 0));
    const hood = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10, 1, true, Math.PI / 2, Math.PI), 0x1a1612, { side: THREE.DoubleSide }); hood.rotation.x = Math.PI / 2; hood.position.set(-0.25, 0.95, 0); b.add(hood);
    for (const [x, r] of [[-0.25, 0.3], [0.3, 0.22]]) for (const e of [-0.3, 0.3]) { const t = mesh(new THREE.TorusGeometry(r, 0.025, 4, 14), 0xb5532a); t.position.set(x, r, e); b.add(t); }
    b.add(box(0.9, 0.03, 0.03, 0x5a3e26, 0.75, 0.35, 0.18), box(0.9, 0.03, 0.03, 0x5a3e26, 0.75, 0.35, -0.18));
    b.position.set(-0.1, 0, -0.1); b.rotation.y = -0.15; g.add(b);
    textPanel(g, 'z', 0, 1.42, 0.71, 0.9, 0.2, 'BUGGIES', 0xf1ece0, INK);
    return top;
  },

  // RAILROAD DEPOT -------------------------------------------------------------
  // a long freight house on a raised platform, with sliding doors and freight waiting
  freighthouse(g, { tier }) {
    const c = aged(0x9c3a2a, tier);
    g.add(box(2.3, 0.4, 1.9, 0x8a6a45, 0, 0, 0));
    const top = shed(g, { x: 0, z: -0.3, w: 2.0, d: 1.2, h: 1.3, color: c });
    for (const g2 of [0]) g.add(onWall('z', g2 - 0.4, 0.4, 0.3, 0.8, 0.85, 0.05, shade(c, -0.2)));
    g.add(box(1.4, 0.05, 0.05, IRON, -0.1, 1.27, 0.33));
    textPanel(g, 'z', 0.55, 0.95, 0.31, 0.8, 0.22, 'FREIGHT', 0xf1ece0, INK);
    crate(g, 0.55, 0.65, 0.4, 0.38); crate(g, 0.9, 0.6, 0.4, 0.3); barrel(g, 0.2, 0.7, 0.4, 0.8); sackPile(g, -0.6, 0.65, 3);
    for (let k = 0; k < 7; k++) g.add(box(0.3, 0.005, 0.02, 0x5a4632, -1.05 + k * 0.35, 0.4, 0.75));
    return top;
  },
  // a coaling tower: a tall timber coal bin on legs with a chute that swings over the line
  coaling(g, { tier }) {
    const c = aged(0x6e5a48, tier);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.5], [0.7, 0.5]]) g.add(box(0.16, 2.0, 0.16, WOOD_D, x, 0, z));
    for (const z of [-0.7, 0.5]) for (const e of [-1, 1]) { const br = box(1.7, 0.07, 0.07, WOOD_D, 0, 1.0, z); br.rotation.z = e * 0.85; g.add(br); }
    g.add(box(1.8, 1.3, 1.6, c, 0, 2.0, -0.1)); battens(g, 0, -0.1, 1.8, 1.6, 2.0, 1.3, c);
    const r = box(1.95, 0.08, 1.75, SHINGLE, 0, 3.32, -0.1); r.rotation.x = -0.12; g.add(r);
    const ch = box(0.4, 0.06, 1.0, IRON, 0.3, 1.75, 0.95); ch.rotation.x = 0.6; g.add(ch);
    const coal = mesh(new THREE.ConeGeometry(0.5, 0.35, 8), 0x1e1e22, { flatShading: true }); coal.position.set(-0.55, 0.17, 0.85); g.add(coal);
    textPanel(g, 'z', 0, 2.6, 0.705, 1.0, 0.24, 'COAL', INK, CREAM);
    return 3.5;
  },
  // a section house for the track gang, with a hand car on a siding out front
  section(g, { tier }) {
    const top = shed(g, { x: 0, z: -0.4, w: 2.0, d: 1.2, h: 1.3, color: aged(0xc9a25a, tier), roof: 0x8a3a2a });
    for (const a of [-0.55, 0.55]) wWin(g, 'z', a, 0.45, 0.2, 0.36, 0.5, 0x6e4a2c, tier >= 3 ? WARM : GLASS);
    g.add(onWall('z', 0, 0, 0.2, 0.45, 1.0, 0.05, 0x3a2a1e)); chimneyStack(g, 0.6, -0.6, 1.3, 0.6);
    rails(g, -1.15, 1.15, 0.7);
    const hc = new THREE.Group();
    hc.add(box(0.7, 0.08, 0.5, 0x8a6a45, 0, 0.12, 0), box(0.06, 0.4, 0.06, IRON, 0, 0.2, 0));
    const lever = box(0.6, 0.04, 0.04, IRON, 0, 0.6, 0); lever.rotation.z = 0.25; hc.add(lever);
    for (const e of [-0.24, 0.24]) for (const x of [-0.25, 0.25]) hc.add(cyl(0.08, 0.08, 0.04, 0x2a2d33, x, 0.08, e, 10).rotateX(Math.PI / 2));
    hc.position.set(0.2, 0.04, 0.7); g.add(hc);
    return top;
  },

  // ROCKET RANCH -------------------------------------------------------------------
  // a fuel shed: drums racked under a lean-to beside a big riveted tank on a cradle
  fuelshed(g, { tier }) {
    const top = leanTo(g, { x: -0.5, z: -0.2, w: 1.2, d: 1.4, h: 1.5, color: aged(GREY, tier), roof: 0x9aa0a8 });
    for (const [x, z, y] of [[-0.8, -0.5, 0], [-0.4, -0.5, 0], [-0.8, -0.05, 0], [-0.4, -0.05, 0], [-0.6, -0.3, 0.5]]) barrel(g, x, z, y, 0.85);
    for (const e of [-0.45, 0.45]) g.add(box(0.12, 0.35, 0.8, WOOD_D, 0.6, 0, e * 0.9));
    g.add(cyl(0.38, 0.38, 1.7, 0xc8302a, 0.6, 0.35 + 0.38 - 0.85, 0, 16).rotateX(Math.PI / 2));
    for (const k of [-0.6, 0, 0.6]) g.add(cyl(0.4, 0.4, 0.04, IRON, 0.6, 0.73 - 0.02, k, 16).rotateX(Math.PI / 2));
    textPanel(g, 'z', 0.6, 0.6, 0.86, 0.6, 0.22, 'FUEL', 0xc8302a, CREAM);
    return Math.max(top, 1.2);
  },
  // a tall farm silo with a domed cap, banded like a barrel, and a little feed room
  silo(g, { tier }) {
    const c = tier >= 5 ? 0xd8d0c0 : 0xb8a88e;
    g.add(cyl(0.65, 0.65, 3.0, c, 0.3, 0, -0.25, 18));
    for (let k = 1; k < 6; k++) g.add(cyl(0.665, 0.665, 0.04, shade(c, -0.25), 0.3, k * 0.5, -0.25, 18));
    const dome = mesh(new THREE.SphereGeometry(0.67, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), RED); dome.position.set(0.3, 3.0, -0.25); g.add(dome);
    g.add(box(0.12, 2.9, 0.06, WOOD_D, 0.3, 0, 0.42)); for (let k = 0; k < 12; k++) g.add(box(0.3, 0.03, 0.04, WOOD_D, 0.3, 0.2 + k * 0.23, 0.44));
    shed(g, { x: -0.65, z: 0.35, w: 0.9, d: 0.9, h: 0.9, color: aged(RED, tier) });
    return 3.65;
  },
  // a gambrel-roofed workshop with big doors open on a half-built rocket nose cone
  workshop(g, { tier }) {
    const w = 2.0, d = 1.6, h = 1.2, c = aged(0x6f8f5a, tier);
    g.add(box(w, h, d, c, 0, 0, -0.25)); battens(g, 0, -0.25, w, d, 0, h, c);
    const gs = new THREE.Shape(); gs.moveTo(-w / 2 - 0.1, 0); gs.lineTo(w / 2 + 0.1, 0); gs.lineTo(w / 2 - 0.2, 0.5); gs.lineTo(0, 0.85); gs.lineTo(-w / 2 + 0.2, 0.5); gs.closePath();
    const gg = new THREE.ExtrudeGeometry(gs, { depth: d + 0.2, bevelEnabled: false }); gg.translate(0, 0, -(d + 0.2) / 2);
    const gr = mesh(gg, 0x6a6a68); gr.position.set(0, h, -0.25); g.add(gr);
    g.add(onWall('z', 0, 0, 0.55, 1.1, 1.05, 0.04, 0x1e1a16));
    for (const e of [-1, 1]) g.add(box(0.55, 1.05, 0.05, shade(c, -0.15), e * 0.85, 0, 0.85));
    const nose = mesh(new THREE.ConeGeometry(0.3, 0.8, 14), 0xd9c4a0, { metalness: 0.5, roughness: 0.35 }); nose.position.set(0.0, 0.55, 0.85); g.add(nose);
    g.add(cyl(0.3, 0.3, 0.12, 0xc9a24a, 0.0, 0.1, 0.85, 14));
    for (const e of [-1, 1]) g.add(box(0.06, 0.35, 0.3, 0x8a6a45, e * 0.35, 0, 0.85));
    textPanel(g, 'z', 0, 1.25, 0.56, 1.1, 0.22, 'NOSE CONES', 0xf1ece0, INK);
    return h + 0.85;
  },

  // WINDMILL FARM ------------------------------------------------------------------
  // another windmill, this one on a timber tank stand
  windpump(g, { tier }) {
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) g.add(box(0.12, 0.9, 0.12, WOOD_D, x, 0, z));
    g.add(box(1.5, 0.1, 1.5, 0x6e5232, 0, 0.9, 0));
    g.add(cyl(0.65, 0.68, 0.8, aged(WOOD, tier), -0.15, 1.0, 0.1, 16)); for (const k of [0.25, 0.6]) g.add(cyl(0.69, 0.69, 0.04, IRON, -0.15, 1.0 + k, 0.1, 16));
    windmill(g, 0.45, -0.45, 3.6, 0.6, 0x6e5a48);
    return 4.2;
  },
  // a brick powerhouse with insulators on the roof, wires off to a pole and lit bulbs
  powerhouse(g, { tier }) {
    const w = 1.9, d = 1.6, h = 1.5, b = tier >= 5 ? 0xb5603f : BRICK;
    g.add(box(w, h, d, b, 0, 0, -0.2)); courses(g, 0, -0.2, w, d, h, b, 0.12);
    g.add(box(w + 0.15, 0.12, d + 0.15, 0x5a3a2a, 0, h, -0.2));
    g.add(onWall('z', -0.4, 0, 0.6, 0.5, 1.1, 0.05, 0x2a3a2a));
    wWin(g, 'z', 0.45, 0.55, 0.6, 0.45, 0.6, TRIM, WARM);
    textPanel(g, 'z', 0, 1.18, 0.61, 1.4, 0.22, 'ELECTRIC CO.', 0x2a3a2a, GOLD);
    for (const a of [-0.5, 0, 0.5]) g.add(box(0.04, 0.3, 0.04, IRON, a, h + 0.12, -0.2), cyl(0.05, 0.04, 0.1, 0x6fd3c0, a, h + 0.42, -0.2, 6));
    g.add(cyl(0.05, 0.07, 2.6, WOOD_D, 0.9, 0, 0.85, 8), box(0.7, 0.06, 0.06, WOOD_D, 0.9, 2.4, 0.85));
    for (const a of [-0.5, 0, 0.5]) rod(g, [a, h + 0.47, -0.2], [0.9 + (a > 0 ? 0.25 : a < 0 ? -0.25 : 0), 2.46, 0.85], 0.008, 0x2a2d33);
    for (let k = 0; k < 5; k++) g.add(box(0.07, 0.09, 0.07, 0xfff4c0, -0.8 + k * 0.4, 1.35, 0.68, { emissive: 0xffd070, night: 3 }));
    return h + 0.6;
  },
  // a battery house: an open shed lined with racks of glass storage jars glowing faintly
  batteries(g, { tier }) {
    const top = leanTo(g, { x: 0, z: -0.15, w: 2.1, d: 1.5, h: 1.6, color: aged(GREY, tier), roof: 0x9aa0a8 });
    for (const y of [0, 0.55]) {
      g.add(box(1.8, 0.05, 0.5, 0x6e4a2c, 0, y + 0.1, -0.45));
      for (let k = 0; k < 6; k++) { g.add(box(0.2, 0.32, 0.2, 0x8fd0b0, -0.75 + k * 0.3, y + 0.15, -0.45, { transparent: true, opacity: 0.7, emissive: 0x3fbf8a, emissiveIntensity: tier >= 5 ? 0.5 : 0.15 })); g.add(box(0.05, 0.08, 0.05, 0xc9a24a, -0.75 + k * 0.3, y + 0.47, -0.45)); }
    }
    for (const e of [-1, 1]) g.add(box(0.05, 1.0, 0.5, 0x6e4a2c, e * 0.9, 0.1, -0.45));
    textPanel(g, 'z', 0, 1.0, -0.9 + 0.06, 1.2, 0.22, 'BATTERIES', INK, CREAM);
    return top;
  },

  // TELEGRAPH OFFICE --------------------------------------------------------------
  // a log Pony Express station with a corral rail and a saddled horse ready to ride
  ponyexpress(g, { tier }) {
    const w = 1.8, d = 1.4;
    for (let k = 0; k < 6; k++) { g.add(cyl(0.1, 0.1, w + 0.2, 0x8a5a32, -0.15, k * 0.2 + 0.1 - (w + 0.2) / 2, -0.4 + d / 2, 7).rotateZ(Math.PI / 2)); g.add(cyl(0.1, 0.1, d + 0.2, 0x7a4e2c, -0.15 + w / 2, k * 0.2 + 0.1 - (d + 0.2) / 2, -0.4, 7).rotateX(Math.PI / 2)); }
    g.add(box(w - 0.1, 1.2, d - 0.1, 0x6e4a2c, -0.15, 0, -0.4));
    const top = 1.2;
    const sh = new THREE.Shape(); sh.moveTo(-w / 2 - 0.2, 0); sh.lineTo(w / 2 + 0.2, 0); sh.lineTo(0, 0.6); sh.closePath();
    const rg = new THREE.ExtrudeGeometry(sh, { depth: d + 0.4, bevelEnabled: false }); rg.translate(0, 0, -(d + 0.4) / 2);
    const r = mesh(rg, SHINGLE); r.position.set(-0.15, 1.2, -0.4); g.add(r);
    g.add(onWall('z', -0.4, 0, 0.32, 0.45, 0.95, 0.05, 0x3a2a1e));
    textPanel(g, 'z', -0.15, 1.0, 0.44, 1.4, 0.24, 'PONY EXPRESS', 0xf1ece0, 0x8a2a1e);
    hitchRail(g, 0.7, 0.85, 0.8); horse(g, 0.5, 0.55, 0.2, 0x7a4a2a);
    const bag = box(0.2, 0.22, 0.08, 0x5a3a22, 0.48, 0.62, 0.68); g.add(bag);
    return top + 0.6;
  },
  // the town newspaper: a false front with a big window showing the printing press inside
  gazette(g, { tier }) {
    const top = falseFront(g, { x: 0, z: -0.15, w: 2.0, d: 1.7, h: 1.5, fh: 0.65, color: aged(0xb8b0a0, tier), sign: INK, text: 'GAZETTE', ink: CREAM });
    g.add(onWall('z', -0.3, 0.3, 0.7, 1.0, 0.8, 0.04, 0x1c2f3a));
    g.add(box(0.5, 0.4, 0.3, 0x2a2d33, -0.3, 0.3, 0.45), cyl(0.12, 0.12, 0.35, 0x5a5f66, -0.3, 0.75 - 0.18, 0.45, 10).rotateX(Math.PI / 2));
    if (tier >= 3) g.add(box(0.9, 0.7, 0.02, 0xffc98a, -0.3, 0.35, 0.4, { emissive: 0xff9a3a, night: 1.2 }));
    g.add(onWall('z', -0.3, 1.1, 0.7, 1.1, 0.05, 0.05, TRIM), onWall('z', 0.65, 0.25, 0.7, 0.45, 1.0, 0.05, 0x3a2a1e));
    for (let k = 0; k < 3; k++) g.add(box(0.28, 0.03, 0.2, 0xf2ede0, -0.75 + k * 0.05, 0.45 + k * 0.03, 0.95));   // a stack of papers on the bench
    g.add(box(0.8, 0.05, 0.25, 0x8a6a45, -0.6, 0.42, 0.95), box(0.04, 0.2, 0.22, 0x6e5232, -0.95, 0.25, 0.95), box(0.04, 0.2, 0.22, 0x6e5232, -0.25, 0.25, 0.95));
    return top;
  },
  // a heliograph tower: a tall timber lattice with a lookout platform, a flashing mirror
  // and a signal flag
  heliograph(g, { tier }) {
    timberTower(g, 0, 0, 0.7, 0.4, 3.4, aged(WOOD, tier), 4);
    g.add(box(1.2, 0.1, 1.2, 0x8a6a45, 0, 3.4, 0));
    for (const [x, z, w, d] of [[0, 0.58, 1.2, 0.05], [0, -0.58, 1.2, 0.05], [0.58, 0, 0.05, 1.2], [-0.58, 0, 0.05, 1.2]]) g.add(box(w, 0.05, d, CREAM, x, 3.85, z));
    for (const [x, z] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) g.add(box(0.05, 0.45, 0.05, CREAM, x, 3.45, z));
    g.add(box(0.05, 0.4, 0.05, IRON, 0.2, 3.5, 0.2));
    const mir = mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 16), 0xe8f4ff, { metalness: 0.9, roughness: 0.1, emissive: 0xfff6c0, emissiveIntensity: 0.3 }); mir.rotation.set(Math.PI / 2, 0.6, 0.3); mir.position.set(0.2, 4.0, 0.2); g.add(mir);
    g.add(box(0.05, 1.4, 0.05, WOOD_D, -0.45, 3.5, -0.45), box(0.5, 0.32, 0.02, 0xc8302a, -0.2, 4.55, -0.45));
    g.add(box(0.06, 3.4, 0.06, WOOD_D, 0.75, 0, 0.35)); for (let k = 0; k < 14; k++) g.add(box(0.06, 0.03, 0.3, WOOD_D, 0.75, 0.2 + k * 0.23, 0.22));
    return 4.9;
  },

  // THE SALOON ---------------------------------------------------------------------
  // the sheriff's office and jail: stone, with barred windows and a tin star
  jail(g, { tier }) {
    const w = 2.0, d = 1.7, h = 1.5, st = tier >= 5 ? 0xc9bba2 : STONE;
    g.add(box(w, h, d, st, 0, 0, -0.15)); courses(g, 0, -0.15, w, d, h, st, 0.25);
    g.add(box(w + 0.1, 0.5, 0.12, st, 0, h, d / 2 - 0.2), box(w + 0.25, 0.1, 0.3, shade(st, -0.2), 0, h + 0.45, d / 2 - 0.15));
    g.add(box(w + 0.15, 0.12, d + 0.15, shade(st, -0.2), 0, h, -0.15));
    textPanel(g, 'z', 0, h + 0.05, d / 2 - 0.13, 1.4, 0.32, 'SHERIFF', INK, GOLD);
    g.add(onWall('z', -0.45, 0, d / 2 - 0.15, 0.5, 1.1, 0.05, 0x3a2a1e));
    for (const a of [0.3, 0.7]) { wWin(g, 'z', a, 0.6, d / 2 - 0.15, 0.3, 0.45, 0xd8d0c0, tier >= 3 ? WARM : GLASS); for (let k = 0; k < 3; k++) g.add(onWall('z', a - 0.1 + k * 0.1, 0.6, d / 2 - 0.05, 0.025, 0.45, 0.02, IRON)); }
    for (const a of [-0.4, 0.3]) { wWin(g, 'x', a - 0.15, 0.6, w / 2, 0.3, 0.45, 0xd8d0c0); for (let k = 0; k < 3; k++) g.add(onWall('x', a - 0.25 + k * 0.1, 0.6, w / 2 + 0.1, 0.025, 0.45, 0.02, IRON)); }
    const star = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.08 : 0.2, a = k * Math.PI / 5 + Math.PI / 2; k ? star.lineTo(Math.cos(a) * r, Math.sin(a) * r) : star.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const sm = mesh(new THREE.ExtrudeGeometry(star, { depth: 0.03, bevelEnabled: false }), GOLD, { metalness: 0.8, roughness: 0.3 }); sm.position.set(-0.45, 1.3, d / 2 - 0.1); g.add(sm);
    porch(g, { axis: 'z', a: 0, f: d / 2 - 0.15, len: w, depth: 0.45, h: 1.15, rail: false });
    return h + 0.55;
  },
  // the opera house: a tall painted front with an arched window, columns and a marquee
  opera(g, { tier }) {
    const w = 2.1, d = 1.8, h = 2.4, c = tier >= 5 ? 0xe8d8b8 : aged(0xd8c4a0, tier);
    g.add(box(w, h, d, c, 0, 0, -0.15));
    const arc = new THREE.Shape(); arc.moveTo(-w / 2 - 0.05, 0); arc.lineTo(w / 2 + 0.05, 0); arc.lineTo(w / 2 + 0.05, 0.3); arc.quadraticCurveTo(0, 0.9, -w / 2 - 0.05, 0.3); arc.closePath();
    const am = mesh(new THREE.ExtrudeGeometry(arc, { depth: 0.16, bevelEnabled: false }), c); am.position.set(0, h, d / 2 - 0.3); g.add(am);
    g.add(box(w + 0.2, 0.1, 0.25, 0x8a2a1e, 0, h, d / 2 - 0.2));
    const win = mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16, 1, false, Math.PI / 2, Math.PI), tier >= 3 ? 0xffc98a : 0x1c2f3a, tier >= 3 ? { emissive: 0xff9a3a, emissiveIntensity: 0.5 } : {}); win.rotation.x = Math.PI / 2; win.position.set(0, 1.85, d / 2 - 0.12); g.add(win);
    g.add(onWall('z', 0, 1.25, d / 2 - 0.15, 0.7, 0.6, 0.04, tier >= 3 ? 0xffc98a : 0x1c2f3a, tier >= 3 ? { emissive: 0xff9a3a, emissiveIntensity: 0.5 } : undefined));
    for (const a of [-0.85, 0.85]) g.add(cyl(0.08, 0.09, h - 0.1, TRIM, a, 0, d / 2 - 0.05, 10));
    g.add(box(1.5, 0.3, 0.6, 0x8a2a1e, 0, 0.95, d / 2 + 0.1));
    textPanel(g, 'z', 0, 0.97, d / 2 + 0.41, 1.4, 0.26, 'OPERA HOUSE', 0x8a2a1e, GOLD);
    for (let k = 0; k < 8; k++) g.add(box(0.06, 0.06, 0.06, 0xfff4c0, -0.7 + k * 0.2, 1.25, d / 2 + 0.41, { emissive: 0xffd070, night: 3 }));
    g.add(onWall('z', 0, 0, d / 2 - 0.15, 0.8, 0.9, 0.05, 0x5a1a14));
    for (const a of [-0.75, 0.75]) g.add(box(0.36, 0.55, 0.04, 0xf2ede0, a, 0.3, d / 2 - 0.09));
    return h + 0.6;
  },
  // the bath house: a little clapboard house with a big hot-water tank and a boiler stack,
  // steam windows, and towels hung on a line
  bathhouse(g, { tier }) {
    const top = falseFront(g, { x: -0.2, z: -0.2, w: 1.7, d: 1.6, h: 1.3, fh: 0.55, color: aged(0x6a8a9a, tier), sign: 0xf1ece0, text: 'BATHS', ink: 0x2a3a5a });
    for (const a of [-0.6, 0.2]) g.add(onWall('z', a, 0.6, 0.6, 0.4, 0.45, 0.04, 0xd8e8ee, { transparent: true, opacity: 0.8 }));
    g.add(onWall('z', -0.2 + 0.55, 0.25, 0.6, 0.4, 1.0, 0.05, 0x3a2a1e));
    for (const [x, z] of [[0.6, -0.8], [1.0, -0.8], [0.6, -0.4], [1.0, -0.4]]) g.add(box(0.08, 0.8, 0.08, WOOD_D, x, 0, z));
    g.add(cyl(0.35, 0.35, 0.7, 0x5a5f66, 0.8, 0.8, -0.6, 14)); g.add(cyl(0.06, 0.06, 1.3, IRON, 0.8, 1.5, -0.6, 8));
    rod(g, [0.95, 0.9, 0.9], [-1.0, 0.9, 0.9], 0.008, 0x2a2d33);
    for (const e of [0.95, -1.0]) g.add(box(0.05, 0.9, 0.05, WOOD_D, e, 0, 0.9));
    for (let k = 0; k < 4; k++) g.add(box(0.25, 0.3, 0.02, [0xf2ede0, 0xc8302a, 0xf2ede0, 0x2a4a9a][k], 0.6 - k * 0.42, 0.6, 0.9));
    return Math.max(top, 2.8);
  },
};

// ---------------------------------------------------------------- yard and roof gear
// each: { g, fw/fd: half its footprint, minY: lowest roof it sits on, ground: true for the yard }
const G = (...p) => { const g = new THREE.Group(); if (p.length) g.add(...p); return g; };
const BILL = { mine: 'GOLD!', furnace: 'PURE GOLD', press: 'SAVINGS', gear: 'DRY GOODS', engine: 'HORSES', turbine: 'ALL ABOARD', rocket: 'TO THE STARS', power: 'ELECTRIC', datacenter: 'WIRES SENT', hq: 'SARSAPARILLA' };
const GEAR = {
  // a painted billboard on two legs, with its message
  billboard: (color, type) => {
    const g = G(box(0.08, 0.9, 0.08, WOOD_D, -0.75, 0, 0), box(0.08, 0.9, 0.08, WOOD_D, 0.75, 0, 0), box(1.9, 0.6, 0.06, WOOD_D, 0, 0.8, -0.02));
    textPanel(g, 'z', 0, 0.83, 0.02, 1.8, 0.54, BILL[type] || 'WELCOME', type === 'hq' ? 0x8a2a1e : 0xf1ece0, type === 'hq' ? CREAM : INK);
    for (const e of [-0.6, 0, 0.6]) g.add(box(0.06, 0.06, 0.2, IRON, e, 1.48, 0.1), box(0.1, 0.06, 0.08, 0xfff1cf, e, 1.44, 0.2, { emissive: 0xffd28a, night: 2.4 }));
    return { g, fw: 1.0, fd: 0.35 };
  },
  // a wooden water tank on a little stand
  roofTank: () => { const g = new THREE.Group(); waterTower(g, 0, 0, 0.5, 0.45); return { g, fw: 0.55, fd: 0.55 }; },
  // a rooster weathervane over the points of the compass
  weathervane: () => {
    const g = G(box(0.04, 1.0, 0.04, IRON, 0, 0, 0), box(0.5, 0.025, 0.025, IRON, 0, 0.7, 0), box(0.025, 0.025, 0.5, IRON, 0, 0.7, 0));
    const r = box(0.3, 0.2, 0.02, 0x2a2d33, 0, 1.0, 0); g.add(r); g.add(box(0.12, 0.18, 0.02, 0x2a2d33, -0.12, 1.1, 0), box(0.06, 0.12, 0.02, 0xc8302a, 0.15, 1.15, 0));
    return { g, fw: 0.3, fd: 0.3 };
  },
  // a bell hung in a little gabled frame
  bell: () => {
    const g = G(box(0.07, 0.8, 0.07, WOOD_D, -0.3, 0, 0), box(0.07, 0.8, 0.07, WOOD_D, 0.3, 0, 0), box(0.75, 0.07, 0.12, WOOD_D, 0, 0.8, 0));
    for (const e of [-1, 1]) { const r = box(0.45, 0.05, 0.3, SHINGLE, e * 0.18, 0.95, 0); r.rotation.z = -e * 0.6; g.add(r); }
    const b = mesh(new THREE.CylinderGeometry(0.08, 0.18, 0.25, 12), 0xc9a24a, { metalness: 0.8, roughness: 0.3 }); b.position.y = 0.6; g.add(b);
    return { g, fw: 0.4, fd: 0.3 };
  },
  // a flag on a pole: thirteen stripes and a blue corner with a scatter of stars
  flag: () => {
    const g = G(box(0.05, 2.4, 0.05, 0xdedede, 0, 0, 0), box(0.1, 0.1, 0.1, GOLD, 0, 2.4, 0));
    for (let k = 0; k < 7; k++) g.add(box(0.9, 0.07, 0.02, k % 2 ? 0xf2f2f0 : 0xb5302a, 0.47, 1.62 + k * 0.07, 0));
    g.add(box(0.36, 0.28, 0.025, 0x2a3a6a, 0.2, 1.83, 0));
    return { g, fw: 0.3, fd: 0.3 };
  },
  // a cluster of stovepipes with conical caps
  stovepipes: () => {
    const g = new THREE.Group();
    for (const [x, z, h] of [[0, 0, 0.9], [0.3, 0.15, 0.65], [-0.2, 0.25, 0.75]]) { g.add(cyl(0.06, 0.06, h, 0x2a2d33, x, 0, z, 8)); const c = mesh(new THREE.ConeGeometry(0.12, 0.12, 8), 0x2a2d33); c.position.set(x, h + 0.08, z); g.add(c); }
    return { g, fw: 0.35, fd: 0.3 };
  },
  // a rooftop clock in a little pedimented case
  clock: () => {
    const g = G(box(0.8, 0.8, 0.3, TRIM, 0, 0, 0));
    const tri = new THREE.Shape(); tri.moveTo(-0.45, 0); tri.lineTo(0.45, 0); tri.lineTo(0, 0.35); tri.closePath();
    const t = mesh(new THREE.ExtrudeGeometry(tri, { depth: 0.32, bevelEnabled: false }), TRIM); t.position.set(0, 0.8, -0.16); g.add(t);
    const f = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, 20), 0xf2ede0); f.rotation.x = Math.PI / 2; f.position.set(0, 0.42, 0.16); g.add(f);
    g.add(box(0.025, 0.2, 0.02, INK, 0, 0.45, 0.19), box(0.15, 0.025, 0.02, INK, 0.06, 0.42, 0.19));
    return { g, fw: 0.45, fd: 0.2 };
  },
  // a brass telescope on a tripod, aimed at the sky
  telescope: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) { const a = k * 2.1; rod(g, [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], [0, 0.7, 0], 0.025, WOOD_D); }
    const t = cyl(0.07, 0.1, 0.9, 0xc9a24a, 0, 0.75, 0, 10); t.rotation.z = 0.8; t.position.set(-0.2, 0.95, 0); g.add(t);
    return { g, fw: 0.35, fd: 0.35 };
  },
  // a horseshoe sign over the roof, for luck
  horseshoe: () => {
    const g = G(box(0.06, 0.9, 0.06, WOOD_D, -0.35, 0, 0), box(0.06, 0.9, 0.06, WOOD_D, 0.35, 0, 0));
    const s = mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 16, Math.PI * 1.4), 0x9aa0a8, { metalness: 0.7, roughness: 0.35 }); s.rotation.z = -Math.PI * 0.2; s.position.y = 1.15; g.add(s);
    return { g, fw: 0.4, fd: 0.2 };
  },
  // a small windmill on a short roof tower
  windvane: () => { const g = new THREE.Group(); windmill(g, 0, 0, 1.4, 0.45, 0x6e5a48); return { g, fw: 0.4, fd: 0.4 }; },
  // ---- yard gear ----
  // ore carts on a short run of track
  orecarts: () => { const g = new THREE.Group(); rails(g, -0.9, 0.9, 0); oreCart(g, -0.4, 0); oreCart(g, 0.4, 0, 0, 0x8a7a65); return { g, ground: true }; },
  // a stone powder magazine with a red door, set apart for safety
  powder: () => {
    const g = new THREE.Group(); g.add(box(1.1, 0.8, 0.9, STONE, 0, 0, 0)); courses(g, 0, 0, 1.1, 0.9, 0.8, STONE, 0.2);
    const r = mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 12, 1, false, 0, Math.PI), 0x8a8478); r.scale.set(0.7, 1, 0.92); r.rotation.z = Math.PI / 2; r.position.y = 0.8; g.add(r);
    g.add(onWall('z', 0, 0, 0.45, 0.35, 0.6, 0.04, 0xb5302a)); textPanel(g, 'z', 0, 0.62, 0.49, 0.6, 0.14, 'POWDER', 0xb5302a, CREAM);
    return { g, ground: true };
  },
  // gold: a strongbox and a stack of bars under a little awning, with a guard's chair
  strongbox: () => {
    const g = G(box(0.6, 0.35, 0.4, 0x3a2a1e, 0, 0, 0), box(0.62, 0.04, 0.42, GOLD, 0, 0.3, 0));
    for (let k = 0; k < 6; k++) g.add(box(0.22, 0.08, 0.1, 0xf0c440, 0.6 + (k % 3) * 0.12 - 0.12, 0.05 + Math.floor(k / 3) * 0.09, 0.05 + (k % 2) * 0.12, { metalness: 0.9, roughness: 0.25 }));
    for (const e of [-0.6, 0.9]) g.add(box(0.07, 1.2, 0.07, WOOD_D, e, 0, -0.4)); const aw = box(1.8, 0.05, 0.8, 0x2a3a5a, 0.15, 1.2, -0.05); aw.rotation.x = 0.2; g.add(aw);
    return { g, ground: true };
  },
  // a parked freight wagon with its tongue down
  wagon: () => {
    const g = G(box(1.4, 0.1, 0.8, 0x8a6a45, 0, 0.35, 0));
    for (const sd of [-1, 1]) g.add(box(1.4, 0.18, 0.05, 0x9c3a2a, 0, 0.45, sd * 0.4));
    for (const [x, r] of [[-0.45, 0.32], [0.45, 0.25]]) for (const sd of [-1, 1]) wheel(g, x, r, sd * 0.46, r, 0);
    const t = box(1.0, 0.05, 0.05, WOOD_D, 1.15, 0.15, 0); t.rotation.z = 0.25; g.add(t);
    crate(g, -0.3, 0, 0.45, 0.35); sackPile(g, 0.3, 0, 2);
    g.children.slice(-2).forEach(s => { s.position.y += 0.43; });
    return { g, ground: true };
  },
  // a great round haystack and a pitchfork
  haystack: () => {
    const g = new THREE.Group();
    const h = mesh(new THREE.SphereGeometry(0.75, 10, 8), 0xd9b45a, { flatShading: true }); h.scale.set(1, 0.9, 1); h.position.y = 0.45; g.add(h);
    const fork = box(0.03, 1.1, 0.03, WOOD_L, 0.6, 0.0, 0.5); fork.rotation.z = 0.35; g.add(fork);
    return { g, ground: true };
  },
  // a long water trough with a hand pump
  trough: () => {
    const g = G(box(1.3, 0.35, 0.45, 0x6e5232, 0, 0, 0), box(1.22, 0.02, 0.37, 0x4a7aa8, 0, 0.33, 0), box(0.1, 0.8, 0.1, IRON, 0.75, 0, 0));
    const hd = box(0.35, 0.04, 0.04, IRON, 0.85, 0.82, 0); hd.rotation.z = 0.3; g.add(hd);
    return { g, ground: true };
  },
  // a railroad semaphore: a tall post with a red-and-white arm and a lamp
  semaphore: () => {
    const g = G(box(0.1, 3.0, 0.1, 0xdedede, 0, 0, 0), box(0.4, 0.15, 0.4, 0x5a5f66, 0, 0, 0));
    const arm = box(0.9, 0.14, 0.04, 0xb5302a, 0.45, 2.6, 0.08); arm.rotation.z = 0.5; g.add(arm); g.add(box(0.12, 0.12, 0.04, 0xf2f2f0, 0.75, 2.72, 0.11));
    g.add(box(0.15, 0.15, 0.15, 0x6fe88a, 0, 2.4, 0.12, { emissive: 0x3fd060, night: 3 }));
    for (let k = 0; k < 10; k++) g.add(box(0.2, 0.025, 0.03, IRON, 0, 0.3 + k * 0.25, -0.07));
    return { g, ground: true };
  },
  // a water crane for topping up the engines
  watercrane: () => {
    const g = G(cyl(0.12, 0.16, 1.8, 0x2a2d33, 0, 0, 0, 10), cyl(0.2, 0.2, 0.1, 0x2a2d33, 0, 1.8, 0, 10));
    const sp = cyl(0.07, 0.07, 1.0, 0x2a2d33, 0.45, 1.65, 0, 8); sp.rotation.z = Math.PI / 2; sp.position.set(0.5, 1.75, 0); g.add(sp);
    g.add(box(0.06, 0.4, 0.06, 0x2a2d33, 1.0, 1.35, 0));
    return { g, ground: true };
  },
  // baggage on a hand cart
  baggage: () => {
    const g = G(box(1.0, 0.06, 0.5, 0x8a6a45, 0, 0.3, 0));
    for (const e of [-0.27, 0.27]) g.add(cyl(0.15, 0.15, 0.05, 0x5a3e26, 0, 0.15 - 0.025, e, 10).rotateX(Math.PI / 2));
    g.add(box(0.45, 0.28, 0.32, 0x5a3a26, -0.2, 0.36, 0), box(0.47, 0.04, 0.34, GOLD, -0.2, 0.5, 0), box(0.3, 0.2, 0.25, 0x2a3a5a, 0.25, 0.36, 0), box(0.25, 0.16, 0.2, 0x8a2a1e, 0.25, 0.56, 0));
    return { g, ground: true };
  },
  // a spare rocket nose cone on a timber cradle under a tarp
  nosecone: () => {
    const g = G(box(0.1, 0.3, 0.6, WOOD_D, -0.4, 0, 0), box(0.1, 0.3, 0.6, WOOD_D, 0.4, 0, 0));
    const n = mesh(new THREE.ConeGeometry(0.32, 1.2, 14), 0xd9c4a0, { metalness: 0.5, roughness: 0.35 }); n.rotation.z = -Math.PI / 2; n.position.set(0.1, 0.55, 0); g.add(n);
    g.add(cyl(0.33, 0.33, 0.12, 0xc9a24a, -0.55, 0.55 - 0.06, 0, 14).rotateZ(Math.PI / 2));
    return { g, ground: true };
  },
  // a pyramid of fuel drums
  fuelbarrels: () => { const g = new THREE.Group(); for (const [x, z, y] of [[-0.3, -0.2, 0], [0.15, -0.2, 0], [0.6, -0.2, 0], [-0.1, 0.25, 0], [0.4, 0.25, 0], [0.15, -0.2, 0.5]]) { g.add(cyl(0.2, 0.2, 0.5, 0xc8302a, x, y, z, 12)); g.add(cyl(0.205, 0.205, 0.04, IRON, x, y + 0.24, z, 12)); } return { g, ground: true }; },
  // a telegraph pole with crossarms and glass insulators
  pole: () => {
    const g = G(cyl(0.06, 0.08, 3.2, WOOD_D, 0, 0, 0, 8));
    for (const y of [2.8, 3.1]) { g.add(box(0.9, 0.07, 0.07, WOOD_D, 0, y, 0)); for (const e of [-0.35, -0.12, 0.12, 0.35]) g.add(cyl(0.03, 0.025, 0.09, 0x6fd3c0, e, y + 0.07, 0, 6, { transparent: true, opacity: 0.85 })); }
    return { g, ground: true };
  },
  // a lamp post on the corner
  lanternpost: () => { const g = G(box(0.1, 2.0, 0.1, WOOD_D, 0, 0, 0), box(0.4, 0.06, 0.06, WOOD_D, 0.18, 1.9, 0), box(0.2, 0.28, 0.2, 0xfff1cf, 0.32, 1.55, 0, { emissive: 0xffc070, night: 2.6 })); return { g, ground: true }; },
  // a woodpile under a little roof, with a chopping block and axe
  woodpile: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 9; k++) g.add(cyl(0.1, 0.1, 0.8, 0x8a6a45, -0.4 + (k % 4) * 0.21 + Math.floor(k / 4) * 0.1, 0.1 + Math.floor(k / 4) * 0.19 - 0.4, 0, 7).rotateX(Math.PI / 2));
    g.add(cyl(0.18, 0.2, 0.3, 0x6e4a2c, 0.75, 0, 0.3, 10)); const axe = box(0.04, 0.5, 0.04, WOOD_L, 0.75, 0.3, 0.3); axe.rotation.z = 0.4; g.add(axe);
    return { g, ground: true };
  },
  // a bandstand: an octagonal gazebo with a little roof and bunting
  bandstand: () => {
    const g = G(cyl(0.95, 1.0, 0.3, 0xf2ede0, 0, 0, 0, 8));
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; g.add(box(0.07, 1.3, 0.07, TRIM, Math.cos(a) * 0.85, 0.3, Math.sin(a) * 0.85)); }
    const r = mesh(new THREE.ConeGeometry(1.15, 0.6, 8), 0x8a2a1e); r.position.y = 1.9; g.add(r);
    for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4 + Math.PI / 8; g.add(box(0.12, 0.12, 0.02, [0xb5302a, 0xf2f2f0, 0x2a3a6a][k % 3], Math.cos(a) * 0.9, 1.5, Math.sin(a) * 0.9)); }
    return { g, ground: true };
  },
  // a fancy black buggy with its horse tied up
  buggy: () => {
    const g = new THREE.Group();
    g.add(box(0.7, 0.28, 0.5, 0x1a1612, -0.3, 0.35, 0));
    const hood = mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 10, 1, true, Math.PI / 2, Math.PI), 0x1a1612, { side: THREE.DoubleSide }); hood.rotation.x = Math.PI / 2; hood.position.set(-0.45, 0.85, 0); g.add(hood);
    for (const [x, r] of [[-0.45, 0.32], [0.05, 0.24]]) for (const e of [-0.3, 0.3]) { const t = mesh(new THREE.TorusGeometry(r, 0.025, 4, 14), 0xc9a24a); t.position.set(x, r, e); g.add(t); }
    horse(g, 0.75, 0, 0, 0x2a2420);
    return { g, ground: true };
  },
  // the top reward: a huge gold sheriff's star on a pole
  star: () => {
    const sh = new THREE.Shape(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 0.25 : 0.6, a = k * Math.PI / 5 + Math.PI / 2; k ? sh.lineTo(Math.cos(a) * r, Math.sin(a) * r) : sh.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const s = mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.1, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03 }), 0xffd76a, { metalness: 0.8, roughness: 0.25, emissive: 0xffb300, emissiveIntensity: 0.6 });
    s.position.set(0, 2.4, -0.05); s.rotation.y = Math.PI / 4;
    const g = G(cyl(0.4, 0.45, 0.3, 0x5a4632, 0, 0, 0, 10), cyl(0.06, 0.06, 1.8, 0x2a2d33, 0, 0.3, 0, 8), s);
    return { g, fw: 0.5, fd: 0.5 };
  },
};

// what each kind of building adds: three additions and four pieces of gear (the levels
// 5, 10, 25 and 50 milestones; 250 brings the gold star)
export const WEST_STYLE = {
  mine:       { wings: ['orebins', 'assay', 'shaft'],            props: ['orecarts', 'powder', 'bell', 'flag'] },
  furnace:    { wings: ['vats', 'boilerhouse', 'crusher'],       props: ['stovepipes', 'woodpile', 'roofTank', 'billboard'] },
  press:      { wings: ['vault', 'landoffice', 'hotel'],         props: ['clock', 'strongbox', 'flag', 'billboard'] },
  gear:       { wings: ['warehouse', 'barber', 'feedshed'],      props: ['billboard', 'wagon', 'roofTank', 'lanternpost'] },
  engine:     { wings: ['stalls', 'smithy', 'carriage'],         props: ['weathervane', 'haystack', 'trough', 'horseshoe'] },
  turbine:    { wings: ['freighthouse', 'coaling', 'section'],   props: ['semaphore', 'watercrane', 'clock', 'baggage'] },
  rocket:     { wings: ['fuelshed', 'silo', 'workshop'],         props: ['nosecone', 'fuelbarrels', 'telescope', 'flag'] },
  power:      { wings: ['windpump', 'powerhouse', 'batteries'],  props: ['windvane', 'pole', 'trough', 'roofTank'] },
  datacenter: { wings: ['ponyexpress', 'gazette', 'heliograph'], props: ['pole', 'bell', 'billboard', 'lanternpost'] },
  hq:         { wings: ['jail', 'opera', 'bathhouse'],           props: ['bandstand', 'buggy', 'billboard', 'stovepipes'] },
};
WEST_STYLE.default = WEST_STYLE.gear;

export function westGear(name, color, type) { const P = GEAR[name === 'beacon' ? 'star' : name] || GEAR.flag; return P(color, type); }
export function westWing(kind, g, o) { return (WINGS[kind] || WINGS.warehouse)(g, o); }

const WING_TEXT = { orebins: 'an ore bin', assay: 'an assay office', shaft: 'a second shaft', vats: 'cyanide vats', boilerhouse: 'a boiler house', crusher: 'a rock crusher',
  vault: 'a stone vault', landoffice: 'a land office', hotel: 'a grand hotel', warehouse: 'a warehouse', barber: 'a barber shop', feedshed: 'a feed shed',
  stalls: 'horse stalls', smithy: 'a blacksmith', carriage: 'a carriage shed', freighthouse: 'a freight house', coaling: 'a coaling tower', section: 'a section house',
  fuelshed: 'a fuel shed', silo: 'a silo', workshop: 'a nose-cone workshop', windpump: 'another windmill', powerhouse: 'a powerhouse', batteries: 'a battery house',
  ponyexpress: 'a Pony Express station', gazette: 'a newspaper', heliograph: 'a heliograph tower', jail: "the sheriff's jail", opera: 'an opera house', bathhouse: 'a bath house' };
const GEAR_TEXT = { billboard: 'a painted billboard', roofTank: 'a water tank', weathervane: 'a weathervane', bell: 'a bell', flag: 'a flag', stovepipes: 'stovepipes', clock: 'a clock',
  telescope: 'a telescope', horseshoe: 'a lucky horseshoe', windvane: 'a rooftop windmill', orecarts: 'ore carts', powder: 'a powder magazine', strongbox: 'a strongbox of gold',
  wagon: 'a freight wagon', haystack: 'a haystack', trough: 'a water trough', semaphore: 'a signal', watercrane: 'a water crane', baggage: 'a baggage cart', nosecone: 'a spare nose cone',
  fuelbarrels: 'fuel drums', pole: 'a telegraph pole', lanternpost: 'a lamp post', woodpile: 'a woodpile', bandstand: 'a bandstand', buggy: 'a buggy' };
export function westLookText(type, level) {
  const st = WEST_STYLE[type] || WEST_STYLE.default, w = st.wings.map(k => WING_TEXT[k]), p = st.props.map(k => GEAR_TEXT[k]);
  return { 5: `${w[0]} and ${p[0]}`, 10: `${w[1]} and ${p[1]}`, 25: `${w[2]} and ${p[2]}`, 50: `${p[3]} and a fresh coat of paint`, 100: 'taller, brighter buildings', 250: "a gold sheriff's star" }[level] || '';
}
