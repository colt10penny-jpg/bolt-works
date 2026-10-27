// The Japanese world (id 'japan', Sakura Valley): temple-style workshops with sweeping
// grey tiled roofs, white plaster and vermilion, thatched farm buildings, a castle keep and
// a five-storey pagoda, set in gardens of cherry trees, pines, maples, moss and koi ponds.
// Each builder returns { group, top, anim?, smoke?, rocket?, scaffold? } like the others.
//
// Factories keep the middle of each side clear for the loading gates (|x| or |z| under
// 1.85 there) and leave the corners to the wings that come with upgrades.
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
import { BUILDERS, box, cyl } from './models.js';
import { J, mesh, at, rod, shade, roof, gable, onWall, hall, engawa, shoji, koshi, noren, plaque, lantern, sakura, maple, pine, bamboo, shrub, rocks, koiPond, swimKoi, torii, chochin } from './japan-kit.js';

const { PLASTER, WOOD, WOOD_D, WOOD_L, VERM, VERM_D, STONE, STONE_D, MOSS, GOLD } = J;
function core(g, s = 1) { const c = new THREE.Group(); c.scale.setScalar(s); c.userData.core = true; g.add(c); return c; }
const glowOpt = (e, k = 1.4) => ({ emissive: e, emissiveIntensity: k });
// a gear facing +z (spin it about z)
function gearWheel(r, teeth, color, thick = 0.08) {
  const g = new THREE.Group();
  const disk = mesh(new THREE.CylinderGeometry(r, r, thick, 20), color, { metalness: 0.6, roughness: 0.35 }); disk.rotation.x = Math.PI / 2; g.add(disk);
  for (let i = 0; i < teeth; i++) { const a = i / teeth * Math.PI * 2, t = box(r * 0.3, r * 0.26, thick, color, 0, 0, 0, { metalness: 0.6, roughness: 0.35 }); t.position.set(Math.cos(a) * r * 1.08, Math.sin(a) * r * 1.08 - r * 0.13, 0); t.rotation.z = a - Math.PI / 2; g.add(t); }
  const hub = mesh(new THREE.CylinderGeometry(r * 0.25, r * 0.25, thick + 0.04, 10), WOOD_D); hub.rotation.x = Math.PI / 2; g.add(hub);
  return g;
}

Object.assign(BUILDERS, {
  // ---- Iron Sand Pit (satetsu): a thatched work shed beside a stepped wooden channel
  // where mountain water washes black iron sand out of the crushed hillside, a water wheel
  // turning at the top of it, and heaps of the black sand drying in front
  satetsu(color) {
    const g = new THREE.Group(), c = core(g);
    const sx = -0.75, sz = -0.75;
    const top = hall(c, { x: sx, z: sz, w: 2.0, d: 1.6, h: 1.0, wall: 0x9a7650, frame: WOOD_D, bay: 0.66 });
    koshi(c, 'z', sx - 0.45, 0.42, sz + 0.8, 0.8, 0.65);
    c.add(onWall('z', sx + 0.45, 0.37, sz + 0.8, 0.6, 0.85, 0.03, 0x1e1612)); noren(c, 'z', sx + 0.45, 1.2, sz + 0.82, 0.62, color);
    roof(c, { x: sx, y: top, z: sz, w: 2.7, d: 2.2, h: 1.15, kind: 'thatch' });
    plaque(c, 'z', sx - 0.45, 1.1, sz + 0.86, 0.22, 0.5, '砂鉄');
    // the washing channel: stepped troughs running from the hillside down to the front
    const steps = [[1.35, -1.45], [1.15, -0.75], [0.95, -0.05], [0.75, 0.65], [0.55, 1.3]];
    const foam = [];
    steps.forEach(([x, z], k) => {
      const y = 0.95 - k * 0.17;
      for (const e of [-0.22, 0.22]) c.add(box(0.06, y - 0.05, 0.06, WOOD_D, x + e, 0.15, z));
      c.add(box(0.5, 0.12, 0.72, WOOD, x, y, z), box(0.4, 0.03, 0.7, 0x4a8ab0, x, y + 0.1, z, { transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.2 }));
      c.add(box(0.36, 0.02, 0.6, 0x222224, x, y + 0.04, z));   // the black sand settling on the bottom
      const f = box(0.3, 0.02, 0.06, 0xeaf6ff, x, y + 0.13, z); c.add(f); foam.push([f, z]);
    });
    // the water wheel at the top, fed by a bamboo pipe
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.5, 0.04, 6, 20), WOOD));
    for (let k = 0; k < 8; k++) { const sp = box(0.04, 1.0, 0.04, WOOD_L, 0, -0.5, 0); sp.rotation.z = k * Math.PI / 4; wheel.add(sp); const pd = box(0.08, 0.16, 0.2, WOOD, Math.cos(k * Math.PI / 4) * 0.52, Math.sin(k * Math.PI / 4) * 0.52 - 0.08, 0); pd.rotation.z = k * Math.PI / 4; wheel.add(pd); }
    wheel.rotation.y = Math.PI / 2; wheel.position.set(1.75, 0.85, -1.2); c.add(wheel);
    c.add(box(0.08, 0.75, 0.08, WOOD_D, 1.75, 0.15, -0.9), box(0.08, 0.75, 0.08, WOOD_D, 1.75, 0.15, -1.5));
    rod(c, [1.75, 1.6, -1.9], [1.45, 1.15, -1.55], 0.05, 0x8ab85a);
    // black sand drying in heaps, straw baskets and a stone lantern
    for (const [x, z, r] of [[-1.35, 0.95, 0.42], [-0.65, 1.35, 0.32], [-1.45, 1.6, 0.25]]) { const h = mesh(new THREE.ConeGeometry(r, r * 0.8, 10), 0x2a2a2e, { roughness: 1, flatShading: true }); h.position.set(x, 0.15 + r * 0.4, z); c.add(h); }
    for (const [x, z] of [[0.05, 1.45], [-0.25, 1.65]]) c.add(cyl(0.16, 0.12, 0.28, 0xa07a4a, x, 0.15, z, 10), cyl(0.15, 0.15, 0.02, 0x2a2a2e, x, 0.42, z, 10));
    lantern(c, 1.55, 1.45, 0.85);
    pine(g, -2.9, -2.9, 0.9, 0.15, 3); rocks(g, 3.0, 2.8, 1, 0.15, 3, 2); shrub(g, -3.0, 3.0, 1, 0.15, 0xd8579a);
    return { group: g, top: 3.4, anim(t) { wheel.rotation.x = -t * 1.4; foam.forEach(([f, z], i) => { f.position.z = z - 0.3 + ((t * 0.6 + i * 0.3) % 1) * 0.6; }); } };
  },

  // ---- Tatara Furnace: a tall open timber hall under a great hipped roof with a smoke
  // vent on its ridge, the clay furnace glowing orange inside while foot bellows rock to
  // feed it air, a glowing bloom of new steel, and heaps of charcoal
  tatara(color) {
    const g = new THREE.Group(), c = core(g);
    const hx = -0.1, hz = -0.3, w = 3.2, d = 2.8, H = 1.85;
    c.add(box(w + 0.2, 0.15, d + 0.2, STONE, hx, 0.15, hz));
    for (let i = 0; i < 4; i++) for (const zz of [hz - d / 2 + 0.1, hz + d / 2 - 0.1]) c.add(box(0.14, H, 0.14, WOOD_D, hx - w / 2 + 0.1 + i * (w - 0.2) / 3, 0.3, zz));
    for (const xx of [hx - w / 2 + 0.1, hx + w / 2 - 0.1]) c.add(box(0.14, H, 0.14, WOOD_D, xx, 0.3, hz));
    c.add(box(w - 0.2, 0.9, 0.08, PLASTER, hx, 0.3, hz - d / 2 + 0.1), box(w, 0.12, 0.12, WOOD_D, hx, 0.3 + H - 0.12, hz - d / 2 + 0.1), box(w, 0.12, 0.12, WOOD_D, hx, 0.3 + H - 0.12, hz + d / 2 - 0.1));
    const rt = roof(c, { x: hx, y: 0.3 + H, z: hz, w: w + 0.8, d: d + 0.7, h: 1.45, lift: 0.4 });
    roof(c, { x: hx, y: rt - 0.15, z: hz, w: 1.1, d: 0.6, h: 0.3, lift: 0.08 });     // the smoke vent on the ridge
    c.add(box(0.9, 0.18, 0.4, 0x2a1e18, hx, rt - 0.3, hz));
    // the furnace: a long clay box with a glowing top, and slag running out of the tap holes
    const fx = hx, fz = hz + 0.1;
    c.add(box(1.5, 0.7, 0.62, 0x9a6a4a, fx, 0.3, fz, { roughness: 1 }));
    const fire = box(1.3, 0.06, 0.4, 0xffb060, fx, 1.0, fz, glowOpt(0xff6a1a, 1.8)); fire.material = fire.material.clone(); c.add(fire);
    for (const e of [-0.45, 0.45]) { const tap = box(0.12, 0.12, 0.08, 0xffa040, fx + e, 0.4, fz + 0.33, glowOpt(0xff5a10, 1.6)); c.add(tap); }
    for (const e of [-1, 1]) c.add(box(0.06, 0.25, 0.4, WOOD, fx + e * 0.8, 0.3, fz));
    // the foot bellows either side, rocking like see-saws
    const bel = [];
    for (const e of [-1, 1]) { const b = new THREE.Group(); b.add(box(0.9, 0.06, 0.5, WOOD_L, 0, 0, 0), box(0.1, 0.12, 0.5, WOOD_D, 0, -0.12, 0)); b.position.set(fx + e * 1.15, 0.45, fz - 0.2); c.add(b); bel.push(b); }
    // the bloom of new steel (kera) cooling on its stand, and the charcoal
    const kera = mesh(new THREE.DodecahedronGeometry(0.28, 0), 0xff8a3a, { flatShading: true, emissive: 0xff5a10, emissiveIntensity: 1.2 }); kera.scale.y = 0.55; kera.position.set(-1.45, 0.45, 1.4); kera.material = kera.material.clone(); c.add(kera);
    c.add(box(0.7, 0.18, 0.5, STONE_D, -1.45, 0.15, 1.4));
    for (let k = 0; k < 7; k++) { const ch = mesh(new THREE.DodecahedronGeometry(0.16 + (k % 3) * 0.04, 0), 0x1c1c1e, { flatShading: true, roughness: 1 }); ch.position.set(1.35 + (k % 3) * 0.22 - 0.2, 0.2 + Math.floor(k / 3) * 0.14, 1.25 + (k % 2) * 0.25); c.add(ch); }
    for (const [x, z] of [[1.75, 1.45], [1.85, 1.0]]) { const bag = mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.4, 8), 0xb59a64); bag.rotation.z = Math.PI / 2; bag.position.set(x, 0.32, z); c.add(bag); }
    plaque(c, 'z', hx + 1.1, 0.3 + H - 0.62, hz + d / 2 - 0.02, 0.24, 0.55, '玉鋼');
    chochin(c, hx - 1.2, 0.3 + H - 0.35, hz + d / 2 - 0.02, color);
    sakura(g, -3.0, -2.9, 0.85, 0.15, 4); lantern(g, 2.95, 2.9, 0.9); shrub(g, -3.0, 2.95, 1.0);
    const smoke = [new THREE.Vector3(hx, rt + 0.3, hz)];
    return { group: g, top: rt + 0.6, smoke, anim(t) {
      fire.material.emissiveIntensity = 1.4 + Math.sin(t * 7) * 0.3 + Math.sin(t * 13) * 0.2;
      bel.forEach((b, i) => { b.rotation.z = Math.sin(t * 2.2 + i * Math.PI) * 0.18; });
      kera.material.emissiveIntensity = 0.9 + Math.sin(t * 1.3) * 0.3;
    } };
  },

  // ---- Bladesmith Forge: a dark timber smithy with its front open on a glowing forge,
  // the smith's hammer ringing on the anvil, a sacred straw rope with paper streamers over
  // the door, a quenching trough, and finished swords on a rack outside
  kajiba(color) {
    const g = new THREE.Group(), c = core(g);
    const sx = -0.35, sz = -0.6, w = 2.7, d = 2.0;
    const top = hall(c, { x: sx, z: sz, w, d, h: 1.35, wall: 0x5a4030, frame: 0x2e2018, bay: 0.68 });
    roof(c, { x: sx, y: top, z: sz, w: w + 0.7, d: d + 0.65, h: 1.0, lift: 0.3 });
    // the open front with the forge glowing inside
    c.add(onWall('z', sx - 0.35, 0.37, sz + d / 2, 1.3, 1.05, 0.03, 0x140e0a));
    const forge = box(0.55, 0.3, 0.3, 0xffa040, sx - 0.65, 0.4, sz + d / 2 - 0.2, glowOpt(0xff6a10, 1.8)); forge.material = forge.material.clone(); c.add(forge);
    c.add(box(0.7, 0.35, 0.4, 0x7a6a5a, sx - 0.65, 0.37, sz + d / 2 - 0.42));
    // the sacred rope and its zigzag paper streamers
    const rope = mesh(new THREE.TorusGeometry(0.75, 0.05, 6, 18, Math.PI), 0xd9c27a); rope.rotation.z = Math.PI; rope.scale.y = 0.25; rope.position.set(sx - 0.35, 1.38, sz + d / 2 + 0.05); c.add(rope);
    for (const e of [-0.45, 0, 0.45]) for (let k = 0; k < 3; k++) c.add(box(0.07, 0.07, 0.01, 0xffffff, sx - 0.35 + e + (k % 2) * 0.04, 1.25 - k * 0.08, sz + d / 2 + 0.07));
    // the anvil out front and the hammer swinging down on it, with sparks
    c.add(box(0.3, 0.3, 0.3, 0x5a4a3a, 0.65, 0.15, 0.85), box(0.45, 0.14, 0.2, 0x3a3d44, 0.65, 0.45, 0.85, { metalness: 0.7, roughness: 0.35 }));
    const blade = box(0.5, 0.02, 0.05, 0xffb060, 0.65, 0.6, 0.85, glowOpt(0xff7a20, 1.2)); c.add(blade);
    const arm = new THREE.Group(); arm.position.set(0.95, 0.85, 0.85);
    const handle = box(0.04, 0.5, 0.04, WOOD_L, 0, -0.5, 0); arm.add(handle, box(0.1, 0.1, 0.16, 0x3a3d44, 0, -0.55, 0, { metalness: 0.7 }));
    c.add(arm);
    const sparks = [];
    for (let k = 0; k < 5; k++) { const s = box(0.03, 0.03, 0.03, 0xffe08a, 0.65, 0.62, 0.85, glowOpt(0xffc040, 2)); c.add(s); sparks.push(s); }
    // the quenching trough, a rack of swords and a chimney
    c.add(box(0.9, 0.3, 0.32, WOOD, -1.35, 0.15, 1.05), box(0.82, 0.02, 0.24, 0x3a6a8a, -1.35, 0.44, 1.05, { roughness: 0.1 }));
    c.add(box(0.06, 0.8, 0.06, WOOD_D, 1.15, 0.15, 1.5), box(0.06, 0.8, 0.06, WOOD_D, 1.75, 0.15, 1.5), box(0.7, 0.05, 0.08, WOOD_D, 1.45, 0.75, 1.5), box(0.7, 0.05, 0.08, WOOD_D, 1.45, 0.5, 1.5));
    for (let k = 0; k < 3; k++) { const sw = box(0.62, 0.035, 0.03, k === 1 ? 0x2a2420 : 0xd8dde4, 1.45, 0.58 + k * 0.08, 1.54, { metalness: 0.8, roughness: 0.25 }); sw.rotation.z = 0.06; c.add(sw); }
    c.add(box(0.36, 1.0, 0.36, 0x8a7a6a, sx + 0.9, top + 0.4, sz - 0.4), box(0.44, 0.08, 0.44, 0x3a3d44, sx + 0.9, top + 1.4, sz - 0.4));
    plaque(c, 'z', sx + 0.85, 0.75, sz + d / 2 + 0.01, 0.22, 0.6, '刀匠');
    pine(g, -2.95, 2.9, 0.85, 0.15, 7); lantern(g, 2.9, 2.95, 0.9); bamboo(g, -2.9, -2.9, 0.9, 0.15, 6, 3);
    return { group: g, top: top + 2.0, smoke: [new THREE.Vector3(sx + 0.9, top + 1.6, sz - 0.4)], anim(t) {
      const p = (t * 1.1) % 1, k = p < 0.7 ? -1.2 + p / 0.7 * 1.0 : -0.2 - (p - 0.7) / 0.3 * 1.0;
      arm.rotation.z = -k - 0.4;
      const hit = p > 0.92 || p < 0.05;
      forge.material.emissiveIntensity = 1.5 + Math.sin(t * 9) * 0.3;
      sparks.forEach((s, i) => { const f = ((t * 2 + i / 5) % 1); s.visible = hit || f < 0.35; s.position.set(0.65 + Math.cos(i * 1.3) * f * 0.5, 0.62 + Math.sin(f * Math.PI) * 0.35, 0.85 + Math.sin(i * 1.7) * f * 0.4); });
    } };
  },

  // ---- Karakuri Workshop: a two-storey townhouse (machiya) with a dark lattice front and
  // the company's curtain over the door, a great wooden clock on the upper floor with
  // brass gears turning beside it, and a clockwork tea-serving doll walking the veranda
  karakuri(color) {
    const g = new THREE.Group(), c = core(g);
    const x = -0.2, z = -0.55, w = 3.2, d = 2.3;
    const t1 = hall(c, { x, z, w, d, h: 1.15, wall: 0x6b4a30, frame: WOOD_D, bay: 0.8 });
    koshi(c, 'z', x - 0.85, 0.42, z + d / 2, 1.2, 0.9); koshi(c, 'z', x + 1.05, 0.42, z + d / 2, 0.8, 0.9);
    c.add(onWall('z', x + 0.2, 0.37, z + d / 2, 0.6, 1.0, 0.03, 0x1e1612)); noren(c, 'z', x + 0.2, 1.3, z + d / 2 + 0.01, 0.64, color);
    koshi(c, 'x', z - 0.3, 0.42, x + w / 2, 1.4, 0.8);
    roof(c, { x, y: t1, z: z + d / 2 + 0.1, w: w + 0.4, d: 0.75, h: 0.22, lift: 0.08, ridge: false });     // the pent roof over the street front
    // the upper floor, set back, plaster with slatted windows, under the main roof
    const t2 = hall(c, { x, z: z - 0.25, w: w - 0.4, d: d - 0.6, h: 0.95, y0: t1, wall: PLASTER, frame: WOOD_D, bay: 0.7, baseH: 0.05 });
    roof(c, { x, y: t2, z: z - 0.25, w: w + 0.3, d: d + 0.1, h: 0.95, lift: 0.25 });
    koshi(c, 'z', x + 0.85, t1 + 0.35, z - 0.25 + (d - 0.6) / 2, 0.6, 0.4);
    // the big clock and its gears
    const cy = t1 + 0.55, cz = z - 0.25 + (d - 0.6) / 2 + 0.03;
    const face = mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.06, 24), 0xf6efdc); face.rotation.x = Math.PI / 2; face.position.set(x - 0.55, cy, cz); c.add(face);
    const rim = mesh(new THREE.TorusGeometry(0.42, 0.04, 6, 24), WOOD_D); rim.position.set(x - 0.55, cy, cz + 0.02); c.add(rim);
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; c.add(box(0.03, 0.07, 0.01, 0x2a2420, x - 0.55 + Math.cos(a) * 0.34, cy - 0.035 + Math.sin(a) * 0.34, cz + 0.035)); }
    const hand = new THREE.Group(); hand.add(box(0.03, 0.3, 0.01, 0x2a2420, 0, 0, 0)); hand.position.set(x - 0.55, cy, cz + 0.045); c.add(hand);
    const g1 = gearWheel(0.24, 12, GOLD), g2 = gearWheel(0.16, 9, GOLD);
    g1.position.set(x + 0.1, cy + 0.05, cz + 0.06); g2.position.set(x + 0.42, cy - 0.12, cz + 0.07); c.add(g1, g2);
    // the veranda along the front, the doll walking it with her tray of tea
    engawa(c, { axis: 'z', a: x, f: z + d / 2 + 0.3, len: w - 0.2, depth: 0.35, y: 0.3, rail: null, posts: false });
    const doll = new THREE.Group();
    doll.add(cyl(0.09, 0.13, 0.32, 0xc8342a, 0, 0, 0, 10), cyl(0.12, 0.12, 0.06, GOLD, 0, 0.1, 0, 10));
    const head = mesh(new THREE.SphereGeometry(0.075, 10, 8), 0xf6e8d8); head.position.y = 0.4; doll.add(head);
    const hair = mesh(new THREE.SphereGeometry(0.08, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.8), 0x1a1414); hair.position.y = 0.41; doll.add(hair);
    doll.add(box(0.2, 0.02, 0.12, 0x8a3a2a, 0, 0.28, 0.1), cyl(0.03, 0.025, 0.05, 0xf2f2ee, 0, 0.3, 0.1, 8));
    doll.position.set(x, 0.3, z + d / 2 + 0.45); c.add(doll);
    for (const e of [-0.2, 0.62]) chochin(c, x + e, 1.25, z + d / 2 + 0.25, 0xf2e6c8);
    plaque(c, 'z', x - 1.45, 0.5, z + d / 2 + 0.01, 0.2, 0.75, 'からくり', { bg: 0xf1e6c8, ink: 0x2a2018, frame: WOOD_D });
    sakura(g, 2.95, -2.95, 0.9, 0.15, 6); lantern(g, -2.95, 2.95, 0.9); shrub(g, 3.0, 2.95, 1.0, 0xd8579a);
    return { group: g, top: t2 + 1.3, anim(t) {
      g1.rotation.z = t * 0.8; g2.rotation.z = -t * 0.8 * 12 / 9; hand.rotation.z = -t * 0.3;
      const p = (t * 0.08) % 1, e = p < 0.45 ? p / 0.45 : p < 0.5 ? 1 : p < 0.95 ? 1 - (p - 0.5) / 0.45 : 0;
      doll.position.x = x - 1.2 + e * 2.3; doll.rotation.y = p < 0.5 ? Math.PI / 2 : -Math.PI / 2; doll.position.y = 0.3 + Math.abs(Math.sin(t * 9)) * 0.015;
    } };
  },

  // ---- Bullet Train Works: a long white train shed under a grey tiled roof, a vermilion
  // gantry crane over the track, and a sleek white bullet train with a blue stripe easing
  // in and out of the shed
  shinkansen(color) {
    const g = new THREE.Group(), c = core(g);
    const sx = 0.0, sz = -1.05, w = 3.5, d = 1.5;
    const top = hall(c, { x: sx, z: sz, w, d, h: 1.3, wall: PLASTER, frame: 0x5a5f66, bay: 0.88 });
    c.add(box(w + 0.02, 0.12, d + 0.02, color, sx, 0.9, sz));
    roof(c, { x: sx, y: top, z: sz, w: w + 0.6, d: d + 0.6, h: 0.75, lift: 0.22 });
    c.add(onWall('z', sx - 0.4, 0.37, sz + d / 2, 2.2, 0.95, 0.03, 0x24262c));
    plaque(c, 'z', sx + 1.3, 0.6, sz + d / 2 + 0.01, 0.6, 0.24, '新幹線', { bg: 0xf6f6f2, ink: 0x1f4f9a, frame: 0x5a5f66 });
    // the platform and the track
    c.add(box(3.7, 0.12, 0.45, 0xb8b4aa, 0, 0.15, 0.22), box(3.7, 0.02, 0.06, 0xffd23f, 0, 0.27, 0.42));
    const tz = 0.85;
    c.add(box(3.75, 0.08, 0.75, 0x8a8478, 0, 0.15, tz));
    for (let k = 0; k < 16; k++) c.add(box(0.1, 0.05, 0.62, 0x5a5048, -1.8 + k * 0.24, 0.2, tz));
    for (const e of [-0.2, 0.2]) c.add(box(3.75, 0.04, 0.04, 0x9aa0a8, 0, 0.25, tz + e, { metalness: 0.7, roughness: 0.3 }));
    // the gantry crane over the track
    for (const xx of [-1.65, 1.65]) for (const zz of [tz - 0.55, tz + 0.55]) c.add(box(0.1, 2.1, 0.1, VERM, xx, 0.15, zz));
    for (const xx of [-1.65, 1.65]) c.add(box(0.12, 0.14, 1.25, VERM, xx, 2.25, tz));
    c.add(box(3.45, 0.14, 0.14, VERM, 0, 2.3, tz));
    const bridge = new THREE.Group(); bridge.add(box(0.3, 0.25, 0.3, 0x3a3d44, 0, -0.25, 0), box(0.02, 0.8, 0.02, 0x2a2d33, 0, -1.0, 0), box(0.16, 0.06, 0.16, 0xffd23f, 0, -1.06, 0));
    bridge.position.set(0, 2.3, tz); c.add(bridge);
    // the train: a long-nosed lead car and a second car, white with a blue stripe
    const train = new THREE.Group();
    const car = (x0, len) => {
      train.add(box(len, 0.36, 0.44, 0xf6f6f4, x0, 0.32, 0, { roughness: 0.35 }));
      const roofC = mesh(new THREE.CylinderGeometry(0.22, 0.22, len, 12, 1, false, 0, Math.PI), 0xf6f6f4); roofC.rotation.z = Math.PI / 2; roofC.rotation.y = Math.PI / 2; roofC.position.set(x0, 0.68, 0); roofC.scale.set(1, 0.4, 1); train.add(roofC);
      train.add(box(len, 0.05, 0.45, color, x0, 0.42, 0), box(len - 0.1, 0.1, 0.45, 0x1c2430, x0, 0.55, 0));
      for (const e of [-len / 2 + 0.2, len / 2 - 0.2]) for (const zz of [-0.17, 0.17]) train.add(cyl(0.07, 0.07, 0.04, 0x2a2d33, x0 + e, 0.27, zz, 8).rotateX(Math.PI / 2));
    };
    car(-0.95, 1.25); car(0.42, 1.0);
    const nose = mesh(new THREE.SphereGeometry(0.5, 16, 10), 0xf6f6f4, { roughness: 0.3 }); nose.scale.set(1.5, 0.42, 0.45); nose.position.set(0.92, 0.5, 0); train.add(nose);
    const noseStripe = mesh(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, Math.PI * 0.55, Math.PI * 0.1), color); noseStripe.scale.set(1.5, 0.42, 0.46); noseStripe.position.copy(nose.position); train.add(noseStripe);
    const cab = mesh(new THREE.SphereGeometry(0.18, 10, 6), 0x1c2430); cab.scale.set(1.3, 0.45, 0.9); cab.position.set(0.95, 0.66, 0); train.add(cab);
    train.add(box(0.1, 0.06, 0.06, 0xfff6d8, 1.5, 0.38, 0.12, { emissive: 0xfff0c0, night: 3 }), box(0.1, 0.06, 0.06, 0xfff6d8, 1.5, 0.38, -0.12, { emissive: 0xfff0c0, night: 3 }));
    train.position.set(-0.15, 0.2, tz); c.add(train);
    sakura(g, -2.95, 2.95, 0.9, 0.15, 9); lantern(g, 2.95, -2.95, 0.9); shrub(g, 2.95, 2.95, 1.0);
    return { group: g, top: 3.4, anim(t) {
      const p = (t * 0.06) % 1, e = p < 0.4 ? p / 0.4 : p < 0.55 ? 1 : p < 0.95 ? 1 - (p - 0.55) / 0.4 : 0, k = 0.5 - 0.5 * Math.cos(e * Math.PI);
      train.position.x = -0.15 - 0.15 + k * 0.4;
      bridge.position.x = Math.sin(t * 0.3) * 1.25;
    } };
  },

  // ---- Robot Works: a clean white factory hall under a tiled roof with a big glass front
  // where orange robot arms work, and a giant friendly robot statue out front, waving
  robotics(color) {
    const g = new THREE.Group(), c = core(g);
    const x = 0.35, z = -0.55, w = 2.9, d = 2.2;
    const top = hall(c, { x, z, w, d, h: 1.55, wall: PLASTER, frame: 0x6a6e76, bay: 0.95 });
    roof(c, { x, y: top, z, w: w + 0.6, d: d + 0.6, h: 0.9, lift: 0.25 });
    c.add(onWall('z', x + 0.1, 0.45, z + d / 2, 2.4, 1.05, 0.04, 0x9fd6ff, { transparent: true, opacity: 0.4, roughness: 0.05, metalness: 0.3 }));
    c.add(onWall('z', x + 0.1, 0.42, z + d / 2 - 0.5, 2.4, 1.1, 0.04, 0xe8ecf0));
    const arms = [];
    for (const e of [-0.7, 0.05, 0.8]) {
      const a = new THREE.Group(); a.position.set(x + e, 0.37, z + d / 2 - 0.25);
      a.add(cyl(0.1, 0.12, 0.12, 0x3a3d44, 0, 0, 0, 10));
      const up = new THREE.Group(); up.position.y = 0.12; up.add(box(0.08, 0.45, 0.08, 0xff8a2a, 0, 0, 0));
      const fore = new THREE.Group(); fore.position.y = 0.45; fore.rotation.z = 1.1; fore.add(box(0.06, 0.35, 0.06, 0xff8a2a, 0, 0, 0), box(0.1, 0.06, 0.08, 0x3a3d44, 0, 0.35, 0));
      up.add(fore); a.add(up); c.add(a); arms.push([a, up, fore]);
    }
    plaque(c, 'z', x - 1.15, 1.5, z + d / 2 + 0.01, 0.75, 0.24, 'ロボット', { bg: 0x1f2a3a, ink: 0xffffff, frame: color });
    // the statue: chunky, friendly, waving one arm
    const R = new THREE.Group(); R.position.set(-1.35, 0.15, 0.95);
    R.add(box(0.8, 0.22, 0.7, STONE, 0, 0, 0));
    for (const e of [-0.17, 0.17]) R.add(box(0.2, 0.75, 0.24, 0xeef0f3, e, 0.22, 0), box(0.24, 0.14, 0.32, color, e, 0.22, 0.03));
    R.add(box(0.62, 0.7, 0.42, 0xeef0f3, 0, 0.95, 0), box(0.64, 0.2, 0.44, color, 0, 1.25, 0), box(0.2, 0.14, 0.03, 0x7fe0ff, 0, 1.05, 0.22, { emissive: 0x4fd0ff, emissiveIntensity: 1.2 }));
    const head = new THREE.Group(); head.position.y = 1.65;
    head.add(box(0.36, 0.3, 0.32, 0xeef0f3, 0, 0, 0), box(0.3, 0.08, 0.04, 0x7fe0ff, 0, 0.13, 0.16, { emissive: 0x4fd0ff, emissiveIntensity: 1.4 }), box(0.04, 0.22, 0.04, color, 0, 0.3, 0));
    R.add(head);
    R.add(box(0.16, 0.55, 0.18, 0xeef0f3, 0.4, 0.75, 0));
    const wave = new THREE.Group(); wave.position.set(-0.4, 1.3, 0); wave.add(box(0.16, 0.55, 0.18, 0xeef0f3, 0, 0, 0), box(0.2, 0.16, 0.2, color, 0, 0.5, 0));
    R.add(wave); c.add(R);
    sakura(g, 2.95, 2.95, 0.9, 0.15, 11); bamboo(g, -2.95, -2.95, 0.9, 0.15, 6, 5); lantern(g, 2.95, -2.95, 0.9);
    return { group: g, top: top + 1.3, anim(t) {
      arms.forEach(([a, up, fore], i) => { a.rotation.y = Math.sin(t * 0.9 + i) * 0.9; up.rotation.z = Math.sin(t * 1.3 + i) * 0.4; fore.rotation.z = 1.1 + Math.sin(t * 1.7 + i) * 0.4; });
      wave.rotation.z = Math.PI + 0.4 + Math.sin(t * 3) * 0.35; head.rotation.y = Math.sin(t * 0.5) * 0.4;
    } };
  },

  // ---- Tanegashima Spaceport: a white launch pad by the sea with a red-and-white service
  // tower, the rocket on the pad, fuel spheres, lightning masts, and a little shrine where
  // the launch team prays for good weather
  spaceportjp(color) {
    const g = new THREE.Group();
    const px = 0.45, pz = 0.4;
    g.add(cyl(1.35, 1.45, 0.3, 0xc8c4ba, px, 0.15, pz, 28));
    g.add(cyl(0.7, 0.7, 0.04, 0x3a3d44, px, 0.45, pz, 20));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; const st = box(0.3, 0.03, 0.12, k % 2 ? 0xffd23f : 0x2a2d33, px + Math.cos(a) * 1.1, 0.45, pz + Math.sin(a) * 1.1); st.rotation.y = -a; g.add(st); }
    // the service tower: red and white bands, with arms reaching to the rocket
    const tx = -1.45, tz = -1.3, TH = 7.2;
    for (let k = 0; k < 9; k++) g.add(box(0.85, TH / 9, 0.85, k % 2 ? 0xd9452b : 0xf2f2f0, tx, 0.15 + k * TH / 9, tz));
    for (let k = 0; k < 9; k++) { const y = 0.3 + k * TH / 9; g.add(box(0.9, 0.04, 0.9, 0x5a5f66, tx, y, tz)); }
    for (const y of [3.4, 5.6]) { const arm = box(1.6, 0.18, 0.25, 0x5a5f66, tx + 0.95, y, tz + 0.75); arm.rotation.y = -0.7; g.add(arm); }
    g.add(box(0.12, 0.12, 0.12, 0xff3b2f, tx, TH + 0.2, tz, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    for (const [x, z] of [[2.0, -1.9], [-1.95, 1.9]]) g.add(cyl(0.03, 0.05, 6.0, 0xb9b4a8, x, 0.15, z, 6));
    // the fuel spheres
    for (const [x, z, r] of [[1.75, -1.35, 0.42], [1.95, -0.55, 0.32]]) { for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; g.add(box(0.05, 0.45, 0.05, 0x8a8f99, x + Math.cos(a) * r * 0.7, 0.15, z + Math.sin(a) * r * 0.7)); } const s = mesh(new THREE.SphereGeometry(r, 16, 12), 0xf2f2f0); s.position.set(x, 0.6 + r, z); g.add(s); }
    // the shrine, with its own little torii
    const sx = -1.55, sz = 1.45;
    g.add(box(0.7, 0.12, 0.6, STONE, sx, 0.15, sz));
    const st = hall(g, { x: sx, z: sz - 0.05, w: 0.5, d: 0.42, h: 0.42, y0: 0.27, wall: 0xd8c8a8, frame: VERM, bay: 0.5, baseH: 0.05 });
    roof(g, { x: sx, y: st, z: sz - 0.05, w: 0.8, d: 0.68, h: 0.3, color: 0x4f8a78, lift: 0.08 });
    torii(g, sx + 0.95, sz + 0.25, 0.55, 0.75, 0.15, Math.PI / 2);
    const rocket = buildRocket('h3', color);
    rocket.position.set(px, 0.45, pz); g.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 6; i++) scaffold.add(box(1.7, 0.1, 1.7, 0xb9b4a8, px, 0.95 + i * 1.25, pz));
    for (const [dx, dz] of [[-0.8, -0.8], [0.8, 0.8], [-0.8, 0.8], [0.8, -0.8]]) scaffold.add(box(0.1, 7.6, 0.1, 0xb9b4a8, px + dx, 0.45, pz + dz));
    g.add(scaffold);
    pine(g, 2.95, 2.9, 1.0, 0.15, 13); pine(g, -2.95, -2.9, 0.9, 0.15, 14);
    return { group: g, top: 9.4, rocket, scaffold };
  },

  // ---- Water Wheel Mill (power): a thatched mill house with a great wooden water wheel
  // turning on its side, fed by a wooden flume from a koi pond, a second smaller wheel,
  // the stream running off in front, maples and stone lanterns
  waterwheel(color) {
    const g = new THREE.Group(), c = core(g, 1.15);
    const mx = 0.55, mz = -0.35;
    const top = hall(c, { x: mx, z: mz, w: 1.9, d: 1.5, h: 1.15, wall: 0xa07a52, frame: WOOD_D, bay: 0.62 });
    shoji(c, 'z', mx + 0.3, 0.55, mz + 0.75, 0.8, 0.6); koshi(c, 'x', mz, 0.5, mx + 0.95, 0.9, 0.6);
    roof(c, { x: mx, y: top, z: mz, w: 2.6, d: 2.2, h: 1.2, kind: 'thatch' });
    plaque(c, 'z', mx - 0.5, 0.6, mz + 0.76, 0.22, 0.5, '水車');
    // the pond behind, the flume on its trestles and the great wheel
    const fish = koiPond(c, -0.85, -1.55, 0.95, 0.55);
    const wx = -0.5, wz = -0.15, R = 1.0;
    const wheelOf = (r, n) => {
      const w = new THREE.Group();
      for (const e of [-0.14, 0.14]) { const rim = mesh(new THREE.TorusGeometry(r, 0.04, 6, 26), WOOD); rim.position.z = e; w.add(rim); }
      for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2; const sp = box(0.05, r * 2, 0.05, WOOD_L, 0, -r, 0); sp.rotation.z = a; w.add(sp); const pd = box(0.1, 0.18, 0.32, WOOD, Math.cos(a) * r, Math.sin(a) * r - 0.09, 0); pd.rotation.z = a; w.add(pd); }
      const hub = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 10), WOOD_D); hub.rotation.x = Math.PI / 2; w.add(hub);
      return w;
    };
    const big = wheelOf(R, 12); big.rotation.y = Math.PI / 2; big.position.set(wx, 0.25 + R, wz); c.add(big);
    for (const e of [-0.28, 0.28]) c.add(box(0.1, R + 0.2, 0.1, WOOD_D, wx + e, 0.15, wz));
    for (const [x, z, h] of [[-0.5, -1.0, 2.15], [-0.5, -1.55, 2.15]]) c.add(box(0.07, h, 0.07, WOOD_D, x - 0.15, 0.15, z), box(0.07, h, 0.07, WOOD_D, x + 0.15, 0.15, z));
    c.add(box(0.32, 0.12, 1.4, WOOD, -0.5, 2.28, -1.05), box(0.24, 0.03, 1.4, 0x4a8ab0, -0.5, 2.37, -1.05, { roughness: 0.1 }));
    c.add(box(0.2, 0.5, 0.06, 0x8acff0, -0.5, 1.95, -0.32, { transparent: true, opacity: 0.6, roughness: 0.05 }));
    // the stream running off toward the front
    c.add(box(0.5, 0.03, 2.0, 0x4a8ab0, wx - 0.3, 0.15, 1.0, { roughness: 0.1, metalness: 0.2 }));
    for (let k = 0; k < 8; k++) { const st = mesh(new THREE.DodecahedronGeometry(0.1 + (k % 3) * 0.03, 0), STONE_D, { flatShading: true }); st.scale.y = 0.6; st.position.set(wx - 0.3 + (k % 2 ? 0.3 : -0.3), 0.17, 0.1 + k * 0.25); c.add(st); }
    // a second, smaller wheel by the stream
    const small = wheelOf(0.55, 8); small.rotation.y = Math.PI / 2; small.position.set(wx - 0.3, 0.25 + 0.4, 1.35); c.add(small);
    for (const e of [-0.2, 0.2]) c.add(box(0.08, 0.7, 0.08, WOOD_D, wx - 0.3 + e, 0.15, 1.35));
    // copper wires from the dynamo to a pole
    c.add(cyl(0.05, 0.06, 2.4, WOOD_D, 1.75, 0.15, 1.2, 6), box(0.6, 0.05, 0.05, WOOD_D, 1.75, 2.45, 1.2));
    rod(c, [1.5, 2.48, 1.2], [mx + 0.6, top + 0.2, mz + 0.6], 0.01, 0xb87333); rod(c, [2.0, 2.48, 1.2], [mx + 0.9, top + 0.2, mz + 0.6], 0.01, 0xb87333);
    lantern(c, 1.55, 0.75, 0.75); maple(g, -2.9, 2.9, 0.9, 0.15, 3); maple(g, 2.9, -2.9, 0.85, 0.15, 7); sakura(g, 2.95, 2.95, 0.9, 0.15, 8);
    rocks(c, 0.5, 1.6, 0.8, 0.15, 3, 8);
    return { group: g, top: 3.6 * 1.15, anim(t, dt) { big.rotation.z -= dt * 0.9; small.rotation.z -= dt * 1.5; swimKoi(fish, t); } };
  },

  // ---- Pagoda Data Center: a five-storey vermilion pagoda on a stone platform, grey roofs
  // sweeping up at every corner, servers humming inside with bands of blue light between
  // the storeys, and a bronze spire of nine rings on top
  pagoda(color) {
    const g = new THREE.Group(), c = core(g, 1.15);
    c.add(box(2.7, 0.18, 2.7, STONE_D, 0, 0.15, 0), box(2.35, 0.18, 2.35, STONE, 0, 0.33, 0));
    for (let k = 0; k < 3; k++) c.add(box(0.9, 0.07, 0.25, STONE, 0, 0.15 + k * 0.12, 1.45 + 0.12 - k * 0.12));
    let y = 0.51;
    const lights = [];
    for (let i = 0; i < 5; i++) {
      const w = 1.55 - i * 0.18, h = i === 0 ? 0.62 : 0.5;
      c.add(box(w, h, w, PLASTER, 0, y, 0));
      for (const [axis, f] of [['z', w / 2], ['x', w / 2], ['z', -w / 2], ['x', -w / 2]]) {
        for (const e of [-w / 2 + 0.05, -w / 6, w / 6, w / 2 - 0.05]) c.add(onWall(axis, e, y, f, 0.08, h, 0.04, VERM));
        c.add(onWall(axis, 0, y + h - 0.08, f, w, 0.08, 0.045, VERM));
        if (f > 0) c.add(onWall(axis, 0, y + 0.08, f, w * 0.3, h * 0.6, 0.03, VERM_D));
      }
      // the servers' glow between the storeys
      const band = box(w + 0.04, 0.05, w + 0.04, 0x7fe0ff, 0, y + h * 0.5, 0, { emissive: 0x3fb8ff, emissiveIntensity: 0.8 }); band.material = band.material.clone(); c.add(band); lights.push(band);
      if (i === 0) engawa(c, { axis: 'z', a: 0, f: w / 2, len: w + 0.3, depth: 0.25, y: y + 0.08, posts: false });
      const rw = w + 0.95 - i * 0.04;
      roof(c, { y: y + h, w: rw, d: rw, h: 0.38, lift: 0.26, ridge: false });
      for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) c.add(box(0.04, 0.14, 0.04, GOLD, dx * rw / 2 * 0.98, y + h + 0.05, dz * rw / 2 * 0.98, { metalness: 0.7, roughness: 0.3 }));
      y += h + 0.38 - 0.05;
    }
    // the spire: a base, nine rings, a water flame and a jewel
    c.add(box(0.35, 0.18, 0.35, 0x3a3d44, 0, y, 0), cyl(0.04, 0.05, 1.5, 0x8a6a3a, 0, y + 0.18, 0, 8, { metalness: 0.7, roughness: 0.35 }));
    for (let k = 0; k < 9; k++) { const rg = mesh(new THREE.TorusGeometry(0.13 - k * 0.006, 0.025, 5, 14), 0xa8803a, { metalness: 0.7, roughness: 0.35 }); rg.rotation.x = Math.PI / 2; rg.position.y = y + 0.3 + k * 0.11; c.add(rg); }
    const jewel = mesh(new THREE.SphereGeometry(0.07, 10, 8), GOLD, { metalness: 0.8, roughness: 0.2, emissive: 0xffb040, emissiveIntensity: 0.3 }); jewel.position.y = y + 1.75; c.add(jewel);
    plaque(c, 'z', 0.55, 0.62, 1.18, 0.2, 0.42, '五重塔');
    for (const [x, z] of [[-1.15, 1.6], [1.15, 1.6]]) lantern(c, x, z, 0.8);
    sakura(g, -2.9, -2.9, 0.9, 0.15, 21); pine(g, 2.9, -2.9, 0.85, 0.15, 22); maple(g, 2.95, 2.9, 0.85, 0.15, 23);
    return { group: g, top: (y + 2.0) * 1.15, anim(t) { lights.forEach((l, i) => { l.material.emissiveIntensity = 0.5 + 0.6 * Math.max(0, Math.sin(t * 2 - i * 0.7)); }); } };
  },

  // ---- Castle Keep (headquarters): a white castle on sloping stone walls, three tiers of
  // grey roofs with triangular gables, black-boarded lower walls, golden fish on the top
  // ridge, cherry trees in the grounds
  castle(color) {
    const g = new THREE.Group(), c = core(g, 1.15);
    // the stone base: battered walls of fitted stone
    const base = mesh(new THREE.CylinderGeometry(1.75, 2.15, 1.0, 4, 1), 0x9a968a, { flatShading: true, roughness: 1 }); base.rotation.y = Math.PI / 4; base.position.set(0, 0.65, -0.1); c.add(base);
    for (let k = 1; k < 5; k++) { const ln = mesh(new THREE.CylinderGeometry(2.15 - k * 0.08 + 0.005, 2.15 - k * 0.08 + 0.005, 0.02, 4, 1, true), 0x6e6a60); ln.rotation.y = Math.PI / 4; ln.position.set(0, 0.15 + k * 0.2, -0.1); c.add(ln); }
    const tiers = [[2.3, 1.95, 0.85], [1.75, 1.45, 0.72], [1.25, 1.05, 0.65]];
    let y = 1.15;
    tiers.forEach(([w, d, h], i) => {
      c.add(box(w, h, d, PLASTER, 0, y, -0.1), box(w + 0.02, h * 0.35, d + 0.02, 0x2a2a2e, 0, y, -0.1));
      for (const [axis, f, len] of [['z', d / 2 - 0.1, w], ['x', w / 2, d]]) for (let k = 0; k < (i === 0 ? 4 : 3); k++) {
        const a = -len / 2 + (k + 0.5) * len / (i === 0 ? 4 : 3);
        c.add(onWall(axis, axis === 'z' ? a : a - 0.1, y + h * 0.5, axis === 'z' ? f : f, 0.16, 0.16, 0.03, 0x1e1e22));
      }
      const rw = w + 0.75, rd = d + 0.7;
      const rt = roof(c, { y: y + h, z: -0.1, w: rw, d: rd, h: i === 2 ? 0.75 : 0.45, lift: 0.22, ridge: i === 2 });
      if (i < 2) gable(c, 0, y + h + 0.06, -0.1 + rd / 2 - 0.25, i === 0 ? 1.1 : 0.8, i === 0 ? 0.5 : 0.38);
      if (i === 1) gable(c, rw / 2 - 0.25, y + h + 0.06, -0.1, 0.7, 0.34, PLASTER, Math.PI / 2);
      if (i === 2) {
        // golden fish (shachihoko) at either end of the top ridge
        const r = (rw - rd) / 2;
        for (const e of [-1, 1]) {
          const f = new THREE.Group(); f.add(box(0.1, 0.22, 0.1, GOLD, 0, 0, 0, { metalness: 0.8, roughness: 0.25 }));
          const tail = mesh(new THREE.ConeGeometry(0.08, 0.2, 5), GOLD, { metalness: 0.8, roughness: 0.25 }); tail.position.set(-e * 0.06, 0.28, 0); tail.rotation.z = e * 0.6; f.add(tail);
          f.position.set(e * (r + 0.12), rt - 0.02, -0.1); c.add(f);
        }
      }
      y += h + (i === 2 ? 0 : 0.45);
    });
    // the gate and the grounds
    c.add(box(0.7, 0.55, 0.06, 0x2a2420, 0, 0.15, 1.85 - 0.95));
    plaque(c, 'z', 0, 1.62, 0.88, 0.5, 0.2, '本丸', { bg: 0x2a2420, ink: 0xf2d79a });
    sakura(g, -2.9, 2.9, 0.95, 0.15, 31); sakura(g, 2.9, 2.9, 0.9, 0.15, 32); pine(g, 2.9, -2.9, 0.85, 0.15, 33); lantern(c, -1.5, 1.4, 0.75); lantern(c, 1.5, 1.4, 0.75);
    for (const e of [-0.55, 0.55]) chochin(c, e, 1.4, 0.92, color);
    return { group: g, top: (y + 1.3) * 1.15 };
  },
});
