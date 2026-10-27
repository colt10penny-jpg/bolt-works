// What each kind of building gains as it levels up, so every factory grows in its own
// way: its own style of extra wing, and its own rooftop and yard gear. The world has ten
// looks (tiers 0-9); the milestone levels 5, 10, 25, 50, 100 and 250 step through them.
import * as THREE from 'three';
import { japanLookText } from './japan-upgrades.js';
import { box, cyl, mat } from './models.js';
import { westLookText } from './west-upgrades.js';
import { moonLookText } from './moon-upgrades.js';

const cylY = (r, h, color, x = 0, y = 0, z = 0, seg = 14) => cyl(r, r, h, color, x, y, z, seg);
const steel = 0x8a8f99, dark = 0x3a3f48, white = 0xf2f2f0, yellow = 0xffc23d;

export const STYLE = {
  mine:       { wing: 'silo',     props: ['conveyor', 'silo', 'floodtower', 'orepile'] },
  furnace:    { wing: 'brick',    props: ['chimney', 'crane', 'pipes', 'tank'] },
  press:      { wing: 'sawtooth', props: ['vents', 'crane', 'crates', 'sign'] },
  gear:       { wing: 'sawtooth', props: ['vents', 'gear', 'mast', 'sign'] },
  engine:     { wing: 'hangar',   props: ['exhaust', 'tank', 'dish', 'sign'] },
  turbine:    { wing: 'hangar',   props: ['fan', 'pipes', 'mast', 'fan'] },
  rocket:     { wing: 'hangar',   props: ['spheretank', 'dish', 'floodtower', 'tank'] },
  power:      { wing: 'yard',     props: ['transformer', 'pylon', 'solar', 'transformer'] },
  datacenter: { wing: 'server',   props: ['ac', 'dish', 'antenna', 'ac'] },
  hq:         { wing: 'brick',    props: ['flag', 'helipad', 'sign', 'mast'] },
  default:    { wing: 'brick',    props: ['tank', 'mast', 'sign', 'flag'] },
};

// each prop: { g: the model, fw/fd: half its footprint on a roof, minY: lowest roof it
// sits on, ground: true for things that stand in the yard instead }
const G = (...parts) => { const g = new THREE.Group(); g.add(...parts); return g; };
export const PROPS = {
  tank: () => {
    const g = new THREE.Group();
    for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) g.add(box(0.1, 0.7, 0.1, 0x5b5f66, dx, 0, dz));
    g.add(cylY(0.55, 0.9, steel, 0, 0.7), cylY(0.6, 0.12, 0x5b5f66, 0, 1.6));
    return { g, fw: 0.6, fd: 0.6 };
  },
  mast: () => ({ g: G(box(0.12, 3.2, 0.12, 0xdddddd, 0, 0, 0), box(0.5, 0.06, 0.06, 0xdddddd, 0, 2.2, 0), box(0.06, 0.06, 0.5, 0xdddddd, 0, 2.7, 0),
    box(0.14, 0.14, 0.14, 0xff3b2f, 0, 3.2, 0, { emissive: 0xff2a1a, emissiveIntensity: 1.5 })), fw: 0.3, fd: 0.3, minY: 2.5 }),
  sign: (color) => {
    const g = G(box(0.1, 0.9, 0.1, dark, -0.9, 0, 0), box(0.1, 0.9, 0.1, dark, 0.9, 0, 0),
      box(2.2, 0.8, 0.12, yellow, 0, 0.8, 0, { emissive: 0xffb300, emissiveIntensity: 0.6 }), box(1.6, 0.3, 0.14, 0xffffff, 0, 1.05, 0, { emissive: 0xffffff, emissiveIntensity: 0.8 }));
    g.rotation.y = Math.PI / 4;
    return { g, fw: 1.0, fd: 0.4 };
  },
  flag: (color) => ({ g: G(box(0.08, 2.6, 0.08, 0xdddddd, 0, 0, 0), box(0.9, 0.55, 0.04, color === 0xe8e4da ? 0xe85a3c : color, 0.48, 1.95, 0), box(0.14, 0.14, 0.14, yellow, 0, 2.6, 0)), fw: 0.3, fd: 0.3 }),
  beacon: () => {
    const g = G(cylY(0.45, 0.35, 0x5b5f66), cylY(0.16, 2.2, yellow, 0, 0.35), cylY(0.32, 0.12, yellow, 0, 1.2));
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xffd76a, { emissive: 0xffb300, emissiveIntensity: 1.6 }));
    orb.position.y = 2.75; g.add(orb);
    return { g, fw: 0.5, fd: 0.5 };
  },
  // a slim extra chimney with a hole in the top and a red-and-white band
  chimney: () => {
    const g = G(cylY(0.3, 2.6, 0x7a4a3a), cylY(0.32, 0.25, 0xf3efe6, 0, 1.8), cylY(0.32, 0.25, 0xd9482b, 0, 2.1));
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), mat(0x17181b)); hole.position.y = 2.61; g.add(hole);
    return { g, fw: 0.4, fd: 0.4 };
  },
  // a small yellow gantry crane with a hook
  crane: () => {
    const g = G(box(0.12, 1.6, 0.12, yellow, -0.8, 0, 0), box(0.12, 1.6, 0.12, yellow, 0.8, 0, 0), box(1.9, 0.16, 0.2, yellow, 0, 1.6, 0),
      box(0.3, 0.2, 0.3, dark, 0.2, 1.4, 0), box(0.03, 0.5, 0.03, dark, 0.2, 0.9, 0), box(0.18, 0.12, 0.12, steel, 0.2, 0.8, 0));
    return { g, fw: 1.0, fd: 0.3 };
  },
  // a rack of pipes with an elbow up into the roof
  pipes: () => {
    const g = new THREE.Group();
    for (const x of [-0.8, 0, 0.8]) g.add(box(0.08, 0.6, 0.6, dark, x, 0, 0));
    for (const z of [-0.18, 0.18]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 2.0, 10), mat(z < 0 ? 0xb9b4a8 : 0x6f8fa8)); p.rotation.z = Math.PI / 2; p.position.set(0, 0.7, z); g.add(p); }
    g.add(cylY(0.11, 0.8, 0xb9b4a8, 1.0, 0, -0.18, 10));
    return { g, fw: 1.1, fd: 0.4 };
  },
  // spinning roof ventilators in a row
  vents: () => {
    const g = new THREE.Group();
    for (const x of [-0.6, 0, 0.6]) { g.add(cylY(0.18, 0.35, steel, x, 0, 0, 10)); const c = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xcfd3da)); c.position.set(x, 0.35, 0); g.add(c); }
    return { g, fw: 0.9, fd: 0.3 };
  },
  // a giant gear, standing on edge: the gear cutter's trademark
  gear: () => {
    const g = new THREE.Group(), gm = mat(0xe3a93a, { metalness: 0.4, roughness: 0.45 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.2, 8, 20), gm); ring.position.y = 1.0; g.add(ring);
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; const t = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.3, 0.3), gm); t.position.set(Math.cos(a) * 1.0, 1.0 + Math.sin(a) * 1.0, 0); t.rotation.z = a; g.add(t); }
    g.add(cylY(0.2, 0.3, dark, 0, 0), box(0.12, 0.3, 0.12, dark, 0, 0.0, 0));
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.3, 12), gm); hub.rotation.x = Math.PI / 2; hub.position.y = 1.0; g.add(hub);
    g.rotation.y = Math.PI / 4;
    return { g, fw: 0.9, fd: 0.4 };
  },
  // a long conveyor climbing up to the hopper
  conveyor: () => {
    const g = new THREE.Group();
    const belt = box(2.6, 0.14, 0.5, dark, 0, 0, 0); belt.rotation.z = 0.35; belt.position.set(0, 0.9, 0); g.add(belt);
    for (const x of [-0.9, 0, 0.9]) g.add(box(0.08, 0.6 + (x + 0.9) * 0.4, 0.08, yellow, x, 0, 0.25), box(0.08, 0.6 + (x + 0.9) * 0.4, 0.08, yellow, x, 0, -0.25));
    for (let k = 0; k < 4; k++) { const o = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 0), mat(0x8a5a3c, { flatShading: true })); o.position.set(-0.9 + k * 0.6, 0.65 + k * 0.6 * 0.36 + 0.14, 0); g.add(o); }
    return { g, ground: true };
  },
  silo: () => {
    const g = G(cylY(0.55, 2.2, 0xcfd3da), cylY(0.58, 0.1, steel, 0, 0.8));
    const top = new THREE.Mesh(new THREE.ConeGeometry(0.58, 0.5, 14), mat(steel)); top.position.y = 2.45; g.add(top);
    return { g, fw: 0.6, fd: 0.6 };
  },
  orepile: () => {
    const g = new THREE.Group();
    const pile = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.9, 7), mat(0x8a5a3c, { flatShading: true })); pile.position.y = 0.45; g.add(pile);
    const p2 = new THREE.Mesh(new THREE.ConeGeometry(0.6, 0.55, 6), mat(0x6f4a32, { flatShading: true })); p2.position.set(0.7, 0.27, 0.4); g.add(p2);
    return { g, ground: true };
  },
  // a tall floodlight tower for working through the night
  floodtower: () => {
    const g = G(box(0.14, 4.2, 0.14, steel, 0, 0, 0), box(0.9, 0.08, 0.3, dark, 0, 4.2, 0));
    for (const x of [-0.27, 0.27]) g.add(box(0.24, 0.16, 0.16, 0xfff1cf, x, 4.3, 0.1, { emissive: 0xffd9a0, night: 1.1 }));   // gentle: at full strength they glared
    return { g, ground: true };
  },
  crates: () => {
    const g = new THREE.Group();
    for (const [x, y, z] of [[-0.4, 0, -0.3], [0.4, 0, -0.3], [0, 0, 0.4], [0, 0.6, -0.3]]) g.add(box(0.6, 0.6, 0.6, 0xb08a5a, x, y, z));
    return { g, ground: true };
  },
  // a test-cell exhaust stack
  exhaust: () => {
    const g = G(box(0.9, 0.6, 0.9, steel, 0, 0, 0), cylY(0.32, 2.0, 0x5b5f66, 0, 0.6), cylY(0.4, 0.2, dark, 0, 2.5));
    const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 12), mat(0x17181b)); hole.position.y = 2.71; g.add(hole);
    return { g, fw: 0.5, fd: 0.5 };
  },
  // a big round fan in its housing (wind tunnel intake)
  fan: () => {
    const g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.12, 8, 20), mat(0xcfd3da)); ring.position.y = 0.75; g.add(ring);
    for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.55, 0.04), mat(dark)); b.position.y = 0.75; b.rotation.z = k / 5 * Math.PI * 2; b.translateY(0.25); g.add(b); }
    g.add(box(0.3, 0.2, 0.3, steel, 0, 0, 0));
    g.rotation.y = Math.PI / 4;
    return { g, fw: 0.7, fd: 0.3 };
  },
  spheretank: () => {
    const g = new THREE.Group();
    for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) g.add(box(0.1, 1.0, 0.1, steel, dx, 0, dz));
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.75, 16, 12), mat(white)); s.position.y = 1.6; s.castShadow = true; g.add(s);
    g.add(box(0.06, 0.6, 0.06, 0xd9482b, 0, 2.3, 0));
    return { g, ground: true };
  },
  dish: () => {
    const g = G(cylY(0.12, 0.6, steel));
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 3.2), mat(white, { side: THREE.DoubleSide }));
    d.rotation.x = Math.PI * 0.75; d.position.set(0, 1.1, 0.1); g.add(d);
    g.add(box(0.05, 0.5, 0.05, dark, 0, 0.9, 0.35));
    return { g, fw: 0.6, fd: 0.6 };
  },
  // a fenced transformer with its insulators
  transformer: () => {
    const g = G(box(1.0, 0.9, 0.8, 0x6f8fa8, 0, 0, 0));
    for (const x of [-0.3, 0, 0.3]) g.add(cylY(0.06, 0.5, 0xe8e2d4, x, 0.9, 0, 8), box(0.04, 0.6, 0.6, 0x5a7690, x, 0.15, 0.42));
    for (const [x, z, w, d] of [[0, -0.8, 1.9, 0.04], [0, 0.8, 1.9, 0.04], [-0.95, 0, 0.04, 1.6], [0.95, 0, 0.04, 1.6]]) g.add(box(w, 0.7, d, 0xb9b4a8, x, 0, z));
    return { g, ground: true };
  },
  pylon: () => {
    const g = new THREE.Group();
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { const leg = box(0.08, 3.6, 0.08, steel, dx, 0, dz); leg.rotation.set(-dz * 0.12, 0, dx * 0.12); g.add(leg); }
    g.add(box(1.8, 0.08, 0.08, steel, 0, 2.6, 0), box(1.3, 0.08, 0.08, steel, 0, 3.3, 0));
    for (const x of [-0.85, 0.85]) g.add(cylY(0.05, 0.3, 0xe8e2d4, x, 2.3, 0, 6));
    return { g, ground: true };
  },
  solar: () => {
    const g = new THREE.Group();
    for (let k = 0; k < 3; k++) { const p = box(0.6, 0.05, 0.9, 0x2a4f8f, -0.7 + k * 0.7, 0.3, 0); p.rotation.x = -0.45; g.add(p, box(0.05, 0.3, 0.05, steel, -0.7 + k * 0.7, 0, 0.2)); }
    return { g, fw: 1.1, fd: 0.5 };
  },
  ac: () => {
    const g = new THREE.Group();
    for (const x of [-0.55, 0.55]) { g.add(box(0.9, 0.45, 0.9, 0xcfd3da, x, 0, 0)); const f = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 14), mat(dark)); f.position.set(x, 0.47, 0); g.add(f); }
    return { g, fw: 1.0, fd: 0.5 };
  },
  antenna: () => ({ g: G(box(0.06, 2.4, 0.06, 0xdddddd, -0.2, 0, 0), box(0.06, 1.8, 0.06, 0xdddddd, 0.2, 0, 0.1), box(0.06, 1.4, 0.06, 0xdddddd, 0, 0, -0.2),
    box(0.1, 0.1, 0.1, 0x4fd0ff, -0.2, 2.4, 0, { emissive: 0x4fd0ff, emissiveIntensity: 1.5 })), fw: 0.3, fd: 0.3 }),
  helipad: () => {
    const g = G(box(1.8, 0.06, 1.8, 0x3a3f48, 0, 0, 0));
    g.add(box(0.12, 0.02, 0.8, 0xffffff, -0.3, 0.06, 0), box(0.12, 0.02, 0.8, 0xffffff, 0.3, 0.06, 0), box(0.6, 0.02, 0.12, 0xffffff, 0, 0.06, 0));
    for (const [x, z] of [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]]) g.add(box(0.08, 0.06, 0.08, 0xffd23f, x, 0.06, z, { emissive: 0xffb300, emissiveIntensity: 1 }));
    return { g, fw: 1.0, fd: 1.0 };
  },
};

// wings that aren't the plain brick/glass block. Each returns a group with userData.top
// (the height of its roof). Old ones look plain; new ones get a light strip on top.
export function styledWing(kind, cx, cz, color, tier, i) {
  const g = new THREE.Group();
  const h = 1.4 + Math.min(9, tier) * 0.28 + (i === 0 ? 0.4 : 0);
  const wall = new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.15).getHex();
  const roofC = new THREE.Color(color).multiplyScalar(0.6).getHex();
  let top = h;
  if (kind === 'sawtooth') {
    // a workshop hall with a sawtooth roof of skylights
    g.add(box(2.3, h, 2.2, wall, 0, 0, 0));
    for (let k = 0; k < 3; k++) {
      const z = -0.75 + k * 0.75;
      const slope = box(2.3, 0.08, 0.85, roofC, 0, 0, 0); slope.rotation.x = 0.6; slope.position.set(0, h + 0.25, z + 0.05); g.add(slope);
      g.add(box(2.2, 0.5, 0.06, 0x9fd6ff, 0, h, z - 0.32));
    }
    for (let f = 0; f < Math.floor(h / 0.9); f++) g.add(box(0.06, 0.32, 1.6, 0x9fd6ff, Math.sign(cx) * 1.16, 0.45 + f * 0.85, 0));
    top = h + 0.55;
  } else if (kind === 'hangar') {
    // a hangar with a curved roof and a tall door
    g.add(box(2.3, h * 0.6, 2.2, wall, 0, 0, 0));
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 2.2, 16, 1, false, 0, Math.PI), mat(roofC));
    roof.rotation.z = Math.PI / 2; roof.rotation.y = Math.PI / 2; roof.position.set(0, h * 0.6, 0); roof.castShadow = true; g.add(roof);
    g.add(box(1.3, h * 0.55, 0.06, 0x5b5f66, 0, 0, Math.sign(cz) * 1.11));
    for (let k = 0; k < 4; k++) g.add(box(1.3, 0.03, 0.07, 0x7a7f88, 0, 0.2 + k * h * 0.12, Math.sign(cz) * 1.12));
    top = h * 0.6 + 1.15;
  } else if (kind === 'silo') {
    // a pair of ore silos on a frame, with a chute
    for (const [x, z] of [[-0.5, -0.4], [0.55, 0.45]]) {
      g.add(cylY(0.6, h + 0.6, wall, x, 0.4, z, 16));
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.62, 0.45, 16), mat(roofC)); cone.position.set(x, h + 1.22, z); g.add(cone);
      for (const [dx, dz] of [[-0.4, -0.4], [0.4, 0.4]]) g.add(box(0.08, 0.45, 0.08, steel, x + dx, 0, z + dz));
      if (tier >= 7) { const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 6, 24), mat(0x7fe0ff, { emissive: 0x4fd0ff, night: 2.2 })); ring.rotation.x = Math.PI / 2; ring.position.set(x, h + 0.95, z); g.add(ring); }
    }
    const chute = box(0.25, 0.25, 1.2, dark, 0, 0, 0); chute.rotation.x = 0.7; chute.position.set(0.05, h * 0.5, 0); g.add(chute);
    top = h + 1.0;
  } else if (kind === 'yard') {
    // a fenced switchyard with transformers
    g.add(box(2.3, 0.08, 2.2, 0xa7a49c, 0, 0, 0));
    for (const [x, z] of [[-0.5, -0.5], [0.5, 0.5]]) { g.add(box(0.8, 0.8, 0.6, 0x6f8fa8, x, 0.08, z)); g.add(cylY(0.05, 0.4, 0xe8e2d4, x, 0.88, z, 8)); }
    for (const [x, z, w, d] of [[0, -1.08, 2.3, 0.04], [0, 1.08, 2.3, 0.04], [-1.13, 0, 0.04, 2.2], [1.13, 0, 0.04, 2.2]]) g.add(box(w, 0.8, d, 0xb9b4a8, x, 0, z));
    g.add(box(0.1, 1.8 + tier * 0.15, 0.1, steel, 0.8, 0, -0.8));
    top = 0.1;
  } else if (kind === 'server') {
    // a low server hall: dark panels, rooftop fans, blue status lights
    g.add(box(2.3, h * 0.75, 2.2, 0x2f3646, 0, 0, 0));
    for (const [x, z] of [[-0.55, -0.5], [0.55, -0.5], [-0.55, 0.5], [0.55, 0.5]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 14), mat(0x8a8f99)); f.position.set(x, h * 0.75 + 0.05, z); g.add(f); }
    for (let k = 0; k < 6; k++) g.add(box(0.12, 0.05, 0.04, 0x4fd0ff, -0.75 + k * 0.3, h * 0.5, Math.sign(cz) * 1.11, { emissive: 0x4fd0ff, night: 2 }));
    top = h * 0.75 + 0.1;
  }
  if (tier >= 7 && kind !== 'yard' && kind !== 'silo') g.add(box(2.36, 0.05, 2.26, 0x7fe0ff, 0, Math.min(top, h) + 0.02, 0, { emissive: 0x4fd0ff, night: 2.2 }));
  g.position.set(cx, 0.15, cz);
  g.userData.top = top;
  return g;
}

// what each level adds, in words, for the building panel
const PROP_NAMES = { conveyor: 'an ore conveyor', silo: 'a storage silo', floodtower: 'a floodlight tower', orepile: 'an ore pile', chimney: 'a second chimney', crane: 'a gantry crane',
  pipes: 'a pipe rack', tank: 'a water tower', vents: 'roof vents', crates: 'stacks of crates', sign: 'a lit rooftop sign', gear: 'a giant gear', mast: 'a radio mast',
  exhaust: 'an exhaust stack', dish: 'a satellite dish', fan: 'a big fan', spheretank: 'a fuel tank', transformer: 'a transformer', pylon: 'a power pylon',
  solar: 'solar panels', ac: 'cooling units', antenna: 'antennas', flag: 'a flag', helipad: 'a helipad' };
const WING_NAMES = { brick: 'wing', sawtooth: 'workshop', hangar: 'hangar', silo: 'pair of silos', yard: 'switchyard', server: 'server hall' };
export function lookText(type, level, world) {
  if (world === 'desert') return westLookText(type, level);
  if (world === 'moon') return moonLookText(type, level);
  if (world === 'japan') return japanLookText(type, level);
  const st = STYLE[type] || STYLE.default, w = WING_NAMES[st.wing];
  // the look changes at the milestone levels
  return { 5: `a new ${w} and ${PROP_NAMES[st.props[0]]}`, 10: `a second ${w} and ${PROP_NAMES[st.props[1]]}`, 25: `a third ${w} and ${PROP_NAMES[st.props[2]]}`,
    50: `${PROP_NAMES[st.props[3]]} and a sleek new finish`, 100: 'taller, brighter buildings', 250: 'a golden beacon' }[level] || '';
}
