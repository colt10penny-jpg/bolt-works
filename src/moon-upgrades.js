// What each Moon building gains as it levels up. Like the Wild West (west-upgrades.js),
// every kind of building grows in its own way: three wings of its own (a dust bin and a
// regolith bunker for the digger, a tank farm and a lab for the refinery, a greenhouse
// and a dome home for the habitat printer...) and four pieces of gear of its own.
import * as THREE from 'three';
import { box, cyl, mat } from './models.js';

const MW = 0xeef0f3, MW2 = 0xd8dbe2, GOLD = 0xd9a83a, IRON = 0x5b5f66, DARK = 0x3a3f48, REG = 0x8f8f96, PLINTH = 0x9c968a, PANEL = 0x223f78, HAZ = 0xffc23d;
const glow = (e = 0x2fc8ff, k = 1.2) => ({ emissive: e, emissiveIntensity: k });
const shade = (hex, f) => { const c = new THREE.Color(hex); return f > 0 ? c.lerp(new THREE.Color(0xffffff), f).getHex() : c.multiplyScalar(1 + f).getHex(); };
const mesh = (geo, color, opts) => { const m = new THREE.Mesh(geo, mat(color, opts)); m.castShadow = true; m.receiveShadow = true; return m; };
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const G = (...parts) => { const g = new THREE.Group(); if (parts.length) g.add(...parts); return g; };
const goldM = { metalness: 0.7, roughness: 0.3 };

function porthole(g, x, y, z, nx, nz, r = 0.11) {
  const n = new THREE.Vector3(nx, 0, nz).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const rim = mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.05, 12), DARK); rim.quaternion.copy(q); rim.position.set(x, y, z); g.add(rim);
  const pane = mesh(new THREE.CylinderGeometry(r, r, 0.07, 12), 0x9fe8ff, glow()); pane.quaternion.copy(q); pane.position.set(x + n.x * 0.01, y, z + n.z * 0.01); g.add(pane);
}
function solarPair(g, x, y, z, w = 0.6, tilt = 0.3) {
  g.add(box(0.07, 0.5, 0.07, MW2, x, y, z));
  for (const s of [-1, 1]) { const p = box(w, 0.04, w * 0.75, PANEL, x + s * (w * 0.55), y + 0.5, z, { roughness: 0.25, metalness: 0.4 }); p.rotation.z = s * tilt; g.add(p); }
}
function beacon(g, x, y, z, h = 0.8, c = 0xff3b2f) {
  g.add(box(0.05, h, 0.05, MW2, x, y, z), box(0.1, 0.1, 0.1, c, x, y + h, z, glow(c === 0xff3b2f ? 0xff2a1a : c, 1.5)));
}
// how the gear looks at higher levels: the main colour band turns to the company colour
const bandC = (tier, color) => tier >= 4 ? color : GOLD;

// ---------------- the wings ----------------
// each draws into g (centred on the corner, ground at y 0) and returns its roof height
const WINGS = {
  // a ribbed dome home on a ring wall, portholes round it and an airlock toward the street
  domehab(g, { tier, color, cx, cz }) {
    const r = 1.0;
    g.add(cyl(r + 0.1, r + 0.14, 0.35, shade(MW, -0.2), 0, 0, 0, 26));
    const d = mesh(new THREE.SphereGeometry(r, 26, 12, 0, Math.PI * 2, 0, Math.PI / 2), MW); d.position.y = 0.35; g.add(d);
    for (let k = 0; k < 6; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.015, 0.03, 4, 22, Math.PI), shade(MW, -0.18)); rib.rotation.y = k / 6 * Math.PI; rib.position.y = 0.35; g.add(rib); }
    const ring = mesh(new THREE.TorusGeometry(r * 0.72, 0.045, 5, 26), bandC(tier, color), goldM); ring.rotation.x = Math.PI / 2; ring.position.y = 0.35 + r * 0.69; g.add(ring);
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; if (Math.cos(a) < -0.3 && Math.sin(a) < -0.3) continue; porthole(g, Math.cos(a) * r * 0.92, 0.75, Math.sin(a) * r * 0.92, Math.cos(a), Math.sin(a), 0.1); }
    const sx = cx > 0 ? 1 : 0, sz = cz > 0 ? 1 : 0, ax = sz ? 0 : sx || 1, az = sz;
    const tube = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.55, 14), MW); if (ax) tube.rotation.z = Math.PI / 2; else tube.rotation.x = Math.PI / 2;
    tube.position.set(ax * (r + 0.15), 0.55, az * (r + 0.15)); g.add(tube);
    g.add(box(0.14, 0.06, 0.04, 0xffb070, ax * (r + 0.4) + az * 0.25, 0.9, az * (r + 0.4) + ax * 0.25, glow(0xff8a2a)));
    if (tier >= 6) beacon(g, 0, 0.35 + r - 0.05, 0, 0.6, 0x7fe0ff);
    return 0.35 + r;
  },
  // a glass greenhouse dome glowing with crops, on a white ring
  greenhouse(g, { tier }) {
    const r = 1.0;
    g.add(cyl(r + 0.08, r + 0.12, 0.3, MW, 0, 0, 0, 24));
    g.add(cyl(r * 0.92, r * 0.92, 0.05, 0x3f8f34, 0, 0.3, 0, 22));
    for (let k = -2; k <= 2; k++) g.add(box(r * 1.5 * Math.sqrt(Math.max(0.1, 1 - (k / 2.6) ** 2)), 0.26, 0.16, 0x5cc04a, 0, 0.33, k * r * 0.34, { emissive: 0x6dff5a, emissiveIntensity: 0.35 }));
    const dome = mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8fff0, { transparent: true, opacity: 0.3, roughness: 0.08, depthWrite: false, emissive: 0x7dff9a, emissiveIntensity: 0.18 });
    dome.position.y = 0.3; g.add(dome);
    for (let k = 0; k < 5; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.01, 0.025, 4, 22, Math.PI), MW); rib.rotation.y = k / 5 * Math.PI; rib.position.y = 0.3; g.add(rib); }
    if (tier >= 5) { const lamp = cyl(0.25, 0.1, 0.12, IRON, 0, 0.3 + r + 0.15, 0, 12); g.add(lamp, box(0.04, 0.2, 0.04, IRON, 0, 0.3 + r - 0.05, 0), cyl(0.22, 0.22, 0.02, 0xff7adf, 0, 0.3 + r + 0.14, 0, 12, glow(0xff5ad0, 1.3))); }
    return 0.3 + r;
  },
  // a module tower: stacked pressurised drums with ribs, a foil band and portholes
  tower(g, { tier, color, floors }) {
    const r = 0.9, h = Math.max(1.4, floors * 0.68);
    g.add(cyl(r + 0.15, r + 0.2, 0.3, PLINTH, 0, 0, 0, 22), cyl(r, r, h, MW, 0, 0.3, 0, 22));
    for (let k = 0; k <= Math.floor(h / 0.7); k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 5, 22), shade(MW, -0.2)); rib.rotation.x = Math.PI / 2; rib.position.y = 0.3 + Math.min(h, k * 0.7); g.add(rib); }
    g.add(cyl(r + 0.03, r + 0.03, 0.35, bandC(tier, color), 0, 0.3 + h * 0.5, 0, 22, goldM));
    for (let row = 0; row < Math.max(1, Math.floor(h / 0.9)); row++) for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2 + row * 0.6, y = 0.75 + row * 0.9; if (y > 0.3 + h - 0.3 || Math.abs(y - (0.3 + h * 0.5)) < 0.25) continue; porthole(g, Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a), Math.sin(a)); }
    const cap = mesh(new THREE.SphereGeometry(r, 22, 9, 0, Math.PI * 2, 0, Math.PI / 2), MW); cap.scale.y = 0.4; cap.position.y = 0.3 + h; g.add(cap);
    const ty = 0.3 + h + r * 0.4;
    if (tier >= 4) solarPair(g, 0, ty - 0.1, 0, 0.55);
    else beacon(g, 0.2, ty - 0.1, 0.1, 0.6);
    return ty;
  },
  // a horizontal module lying on a cradle, a solar wing on its back
  module(g, { tier, color, cx }) {
    const r = 0.62, len = 2.0, along = Math.abs(cx) > 0 ? 'z' : 'x';
    const body = mesh(new THREE.CylinderGeometry(r, r, len, 22), MW); body.rotation.x = Math.PI / 2; body.position.y = 0.95; g.add(body);
    for (const e of [-1, 1]) { const cap = mesh(new THREE.SphereGeometry(r, 22, 9, 0, Math.PI * 2, 0, Math.PI / 2), MW); cap.scale.y = 0.42; cap.rotation.x = e * Math.PI / 2; cap.position.set(0, 0.95, e * len / 2); g.add(cap); }
    for (let k = 0; k <= 3; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 5, 22), shade(MW, -0.2)); rib.position.set(0, 0.95, -len / 2 + k * len / 3); g.add(rib); }
    const band = mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, 0.5, 22), bandC(tier, color), goldM); band.rotation.x = Math.PI / 2; band.position.y = 0.95; g.add(band);
    for (const z of [-0.65, 0.65]) porthole(g, r, 1.0, z, 1, 0);
    for (const z of [-len / 3, len / 3]) g.add(box(r * 1.5, 0.4, 0.18, IRON, 0, 0, z));
    solarPair(g, 0, 0.95 + r - 0.05, 0, 0.7, 0.15);
    if (along === 'x') g.rotation.y = Math.PI / 2;
    return 0.95 + r;
  },
  // dust bins: two tall regolith hoppers on legs with a conveyor running up to them
  regolithBin(g, { tier, color }) {
    for (const [x, z] of [[-0.45, -0.4], [0.5, 0.45]]) {
      for (const [dx, dz] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) g.add(box(0.08, 0.9, 0.08, IRON, x + dx, 0, z + dz));
      const fun = mesh(new THREE.ConeGeometry(0.55, 0.6, 16), MW2); fun.rotation.x = Math.PI; fun.position.set(x, 1.2, z); g.add(fun);
      g.add(cyl(0.55, 0.55, 1.3, MW, x, 1.5, z, 18), cyl(0.57, 0.57, 0.12, bandC(tier, color), x, 2.2, z, 18, goldM));
      const top = mesh(new THREE.ConeGeometry(0.57, 0.3, 18), MW2); top.position.set(x, 2.95, z); g.add(top);
    }
    const belt = box(0.3, 0.1, 2.0, DARK, 0, 0, 0); belt.rotation.x = 0.85; belt.position.set(0.95, 1.1, -0.35); g.add(belt);
    g.add(box(0.5, 0.25, 0.5, REG, 0.95, 0, -1.0));
    return 3.1;
  },
  // a regolith bunker: a low module buried under a heap of moon dust, a lit entrance arch
  berm(g, { tier, color, cx, cz }) {
    const m = mesh(new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), REG, { flatShading: true }); m.scale.set(1.15, 0.9, 1.05); g.add(m);
    for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2; const rk = mesh(new THREE.DodecahedronGeometry(0.15 + (k % 3) * 0.05, 0), 0x77777e, { flatShading: true }); rk.position.set(Math.cos(a) * 1.2, 0.05, Math.sin(a) * 1.1); g.add(rk); }
    const front = cz > 0 ? [0, 1] : cx > 0 ? [1, 0] : [0, 1];
    const arch = new THREE.Group();
    arch.add(box(0.95, 0.85, 0.5, MW, 0, 0, 0), box(1.05, 0.12, 0.55, bandC(tier, color), 0, 0.85, 0, goldM), box(0.6, 0.65, 0.04, DARK, 0, 0, 0.26));
    arch.add(box(0.5, 0.05, 0.03, 0x9fe8ff, 0, 0.72, 0.28, glow()));
    arch.position.set(front[0] * 0.95, 0, front[1] * 0.9); arch.rotation.y = front[0] ? Math.PI / 2 : 0; g.add(arch);
    g.add(cyl(0.18, 0.22, 0.5, MW2, -0.2, 0.75, -0.2, 12), cyl(0.12, 0.12, 0.04, 0x9fe8ff, -0.2, 1.25, -0.2, 12, glow()));
    if (tier >= 5) beacon(g, 0.3, 0.8, -0.3, 0.7);
    return 1.0;
  },
  // a tank farm: three ball tanks of different sizes on legs, piped together
  tankfarm(g, { tier, color }) {
    const tops = [];
    for (const [x, z, r] of [[-0.45, -0.45, 0.62], [0.6, -0.2, 0.45], [0.05, 0.6, 0.5]]) {
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; g.add(box(0.07, 0.5, 0.07, IRON, x + Math.cos(a) * r * 0.7, 0, z + Math.sin(a) * r * 0.7)); }
      const s = mesh(new THREE.SphereGeometry(r, 18, 12), MW); s.position.set(x, 0.5 + r, z); g.add(s);
      const b = mesh(new THREE.TorusGeometry(r, 0.035, 4, 20), bandC(tier, color)); b.rotation.x = Math.PI / 2; b.position.copy(s.position); g.add(b);
      tops.push(0.5 + r * 2);
    }
    for (const [a, b] of [[[-0.45, 0.5, -0.45], [0.6, 0.5, -0.2]], [[0.6, 0.5, -0.2], [0.05, 0.5, 0.6]]]) {
      const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
      const p = mesh(new THREE.CylinderGeometry(0.05, 0.05, d.length(), 8), 0xc9ced6); p.position.copy(A).add(B).multiplyScalar(0.5); p.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); g.add(p);
    }
    g.add(box(0.06, 0.06, 0.06, 0xff3b2f, -0.45, 0.5 + 1.24, -0.45, glow(0xff2a1a, 1.5)));
    return Math.max(...tops);
  },
  // a hangar: a half-tube garage with a big door toward the street and a buggy outside
  garage(g, { tier, color, cx, cz }) {
    const r = 0.95, len = 2.0;
    const tube = mesh(new THREE.CylinderGeometry(r, r, len, 20, 1, false, -Math.PI / 2, Math.PI), MW, { side: THREE.DoubleSide }); tube.rotation.x = -Math.PI / 2; tube.position.y = 0.05; g.add(tube);
    for (let k = 0; k <= 3; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.03, 0.04, 4, 20, Math.PI), shade(MW, -0.2)); rib.position.set(0, 0.05, -len / 2 + k * len / 3); g.add(rib); }
    const band = mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.4, 20, 1, true, -Math.PI / 2, Math.PI), bandC(tier, color), { side: THREE.DoubleSide, ...goldM }); band.rotation.x = -Math.PI / 2; band.position.y = 0.05; g.add(band);
    const front = mesh(new THREE.CircleGeometry(r, 20, 0, Math.PI), shade(MW, -0.08)); front.position.set(0, 0.05, len / 2); g.add(front);
    const back = front.clone(); back.position.z = -len / 2; back.rotation.y = Math.PI; g.add(back);
    g.add(box(1.2, 0.75, 0.05, DARK, 0, 0.05, len / 2 + 0.02));
    for (let k = 0; k < 4; k++) g.add(box(1.2, 0.03, 0.02, IRON, 0, 0.15 + k * 0.17, len / 2 + 0.05));
    for (const e of [-1, 1]) g.add(box(0.1, 0.1, 0.06, 0xffb070, e * 0.72, 0.9, len / 2 + 0.03, glow(0xff8a2a)));
    if (!(cz > 0) && cx > 0) g.rotation.y = Math.PI / 2;
    return 0.05 + r;
  },
  // a little landing pad with a hopper lander parked on it
  landingpad(g, { tier, color }) {
    g.add(cyl(1.05, 1.1, 0.1, 0x4a4d55, 0, 0, 0, 24));
    const ring = mesh(new THREE.TorusGeometry(0.92, 0.04, 4, 28), 0x9fe8ff, glow()); ring.rotation.x = Math.PI / 2; ring.position.y = 0.11; g.add(ring);
    const L = new THREE.Group();
    L.add(box(0.7, 0.45, 0.7, bandC(tier, color), 0, 0.5, 0, goldM), box(0.5, 0.4, 0.5, MW, 0, 0.95, 0));
    const nose = mesh(new THREE.ConeGeometry(0.3, 0.4, 12), MW); nose.position.y = 1.55; L.add(nose);
    for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const leg = box(0.05, 0.6, 0.05, MW2, dx * 0.42, 0.1, dz * 0.42); leg.rotation.set(dz * 0.4, 0, -dx * 0.4); L.add(leg); L.add(cyl(0.1, 0.1, 0.03, MW2, dx * 0.55, 0.1, dz * 0.55, 8)); }
    L.add(cyl(0.12, 0.2, 0.15, DARK, 0, 0.35, 0, 10));
    g.add(L);
    return 1.7;
  },
  // a radiator house: a low block bristling with tall white radiator fins
  radiators(g, { tier, color }) {
    g.add(box(2.0, 0.7, 1.4, MW, 0, 0, 0), box(2.06, 0.1, 1.46, bandC(tier, color), 0, 0.7, 0, goldM));
    for (let k = 0; k < 5; k++) {
      g.add(box(0.06, 1.5, 1.2, 0xf6f7f9, -0.8 + k * 0.4, 0.8, 0, { roughness: 0.3 }));
      g.add(box(0.07, 1.3, 0.04, tier >= 6 ? 0xff6a4a : 0xc9ced6, -0.8 + k * 0.4, 0.9, 0.3, tier >= 6 ? glow(0xff3a1a, 0.5) : undefined));
    }
    for (let k = 0; k < 4; k++) g.add(box(0.2, 0.08, 0.04, 0x9fe8ff, -0.6 + k * 0.4, 0.4, 0.72, glow()));
    return 2.3;
  },
  // a little observatory: a drum with a slotted dome, a comms dish beside it
  dishhouse(g, { tier, color }) {
    g.add(cyl(0.75, 0.8, 0.9, MW, -0.3, 0, -0.2, 20));
    const d = mesh(new THREE.SphereGeometry(0.75, 20, 9, 0, Math.PI * 2, 0, Math.PI / 2), bandC(tier, color), goldM); d.position.set(-0.3, 0.9, -0.2); g.add(d);
    const slit = box(0.25, 0.7, 0.05, 0x1c1e22, -0.3 + 0.18, 1.0, 0.33); slit.rotation.set(-0.55, 0.3, 0); g.add(slit);
    g.add(cyl(0.08, 0.1, 1.1, MW2, 0.65, 0, 0.6, 8));
    const dish = mesh(new THREE.SphereGeometry(0.55, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), 0xf2f2f2, { side: THREE.DoubleSide }); dish.rotation.x = 2.3; dish.position.set(0.65, 1.35, 0.6); g.add(dish);
    for (let k = 0; k < 4; k++) porthole(g, -0.3 + Math.cos(k * 0.6) * 0.75, 0.5, -0.2 + Math.sin(k * 0.6) * 0.75, Math.cos(k * 0.6), Math.sin(k * 0.6), 0.09);
    return 1.65;
  },
  // a lab: a clean white block with a band of glowing windows and a sloped solar roof
  lab(g, { tier, color, floors }) {
    const h = Math.max(1.2, Math.min(2.6, floors * 0.5));
    g.add(box(2.1, 0.25, 1.9, PLINTH, 0, 0, 0), box(1.9, h, 1.7, 0xf2f3f6, 0, 0.25, 0));
    for (let f = 0; f < Math.floor(h / 0.6); f++) {
      g.add(box(1.7, 0.16, 0.04, 0x9fe8ff, 0, 0.5 + f * 0.6, 0.86, glow(0x4fb8ff, 0.8)));
      g.add(box(0.04, 0.16, 1.5, 0x9fe8ff, 0.96, 0.5 + f * 0.6, 0, glow(0x4fb8ff, 0.8)));
    }
    g.add(box(1.96, 0.14, 1.76, bandC(tier, color), 0, 0.25 + h, 0, goldM));
    const roof = box(1.8, 0.05, 1.5, PANEL, 0, 0.25 + h + 0.3, 0, { roughness: 0.25, metalness: 0.4 }); roof.rotation.x = -0.3; g.add(roof);
    g.add(box(0.06, 0.35, 0.06, MW2, -0.8, 0.25 + h, -0.6), box(0.06, 0.35, 0.06, MW2, 0.8, 0.25 + h, -0.6));
    return 0.25 + h + 0.5;
  },
};

// ---------------- the gear ----------------
// each returns { g, fw, fd, minY?, ground? } like PROPS in upgrades.js
const GEAR = {
  // a solar wing on a mast that turns its panels to the sun
  solarwing: () => { const g = G(); solarPair(g, 0, 0, 0, 0.8, 0.35); g.add(box(0.06, 0.6, 0.06, MW2, 0, 0, 0)); return { g, fw: 0.9, fd: 0.4 }; },
  // a radiator fin standing edge-on to the sun
  radfin: () => ({ g: G(box(0.08, 0.4, 0.08, IRON, 0, 0, 0), box(0.05, 1.3, 1.0, 0xf6f7f9, 0, 0.35, 0, { roughness: 0.3 }), box(0.06, 1.1, 0.04, 0xff6a4a, 0, 0.45, 0.3, glow(0xff3a1a, 0.5))), fw: 0.15, fd: 0.55 }),
  // a small comms dish on a tripod
  dish: () => {
    const g = G();
    for (let k = 0; k < 3; k++) { const a = k * 2.094; const l = box(0.04, 0.6, 0.04, MW2, Math.cos(a) * 0.18, 0, Math.sin(a) * 0.18); l.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25); g.add(l); }
    const d = mesh(new THREE.SphereGeometry(0.5, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), 0xf2f2f2, { side: THREE.DoubleSide }); d.rotation.x = 2.4; d.position.y = 0.75; g.add(d);
    g.add(box(0.03, 0.35, 0.03, IRON, 0, 0.75, 0.15));
    return { g, fw: 0.5, fd: 0.5 };
  },
  // a tall mast with a blinking light and a little antenna array
  beaconmast: () => { const g = G(box(0.08, 2.6, 0.08, MW2, 0, 0, 0), box(0.5, 0.04, 0.04, MW2, 0, 1.8, 0), box(0.04, 0.04, 0.5, MW2, 0, 2.2, 0)); g.add(box(0.14, 0.14, 0.14, 0xff3b2f, 0, 2.6, 0, glow(0xff2a1a, 1.5))); return { g, fw: 0.3, fd: 0.3, minY: 1.0 }; },
  // a ball tank with a coloured band
  sphere: (color) => {
    const g = G();
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.78; g.add(box(0.06, 0.4, 0.06, IRON, Math.cos(a) * 0.35, 0, Math.sin(a) * 0.35)); }
    const s = mesh(new THREE.SphereGeometry(0.5, 18, 12), MW); s.position.y = 0.85; g.add(s);
    const b = mesh(new THREE.TorusGeometry(0.5, 0.035, 4, 20), color); b.rotation.x = Math.PI / 2; b.position.y = 0.85; g.add(b);
    return { g, fw: 0.55, fd: 0.55 };
  },
  // floodlights on a short tower, for work through the long lunar night
  flood: () => { const g = G(box(0.1, 1.6, 0.1, MW2, 0, 0, 0), box(0.7, 0.06, 0.1, MW2, 0, 1.6, 0)); for (const x of [-0.25, 0.25]) g.add(box(0.22, 0.16, 0.14, 0xfff1cf, x, 1.66, 0.04, { emissive: 0xffe2a8, night: 3 })); return { g, fw: 0.4, fd: 0.2 }; },
  // stacks of gold-foil cargo
  cargo: () => ({ g: G(box(0.6, 0.45, 0.5, GOLD, -0.2, 0, 0, goldM), box(0.45, 0.4, 0.45, MW, 0.35, 0, 0.05), box(0.4, 0.35, 0.4, GOLD, -0.15, 0.45, 0, goldM), box(0.3, 0.06, 0.02, HAZ, 0.35, 0.2, 0.28)), fw: 0.6, fd: 0.35 }),
  // a little optical telescope on a mount
  scope: () => { const g = G(cyl(0.18, 0.25, 0.5, DARK, 0, 0, 0, 10)); const t = cyl(0.12, 0.15, 0.9, MW, 0, 0, 0, 12); t.rotation.z = 0.8; t.position.set(0.2, 0.75, 0); g.add(t); return { g, fw: 0.4, fd: 0.3 }; },
  // a moon drill rig in the yard: a tripod with a turning drill string
  drill: () => {
    const g = G(cyl(0.6, 0.65, 0.08, REG, 0, 0, 0, 16));
    for (let k = 0; k < 3; k++) { const a = k * 2.094; const l = box(0.06, 2.0, 0.06, HAZ, Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45); l.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22); g.add(l); }
    g.add(cyl(0.18, 0.12, 0.35, DARK, 0, 1.85, 0, 10), cyl(0.04, 0.04, 1.6, 0xc9ced6, 0, 0.25, 0, 6));
    return { g, fw: 0.7, fd: 0.7, ground: true };
  },
  // a moon buggy parked in the yard
  rover: (color) => {
    const g = G(box(1.1, 0.1, 0.75, MW2, 0, 0.32, 0), box(0.35, 0.3, 0.5, MW, -0.3, 0.42, 0), box(0.4, 0.04, 0.55, color, 0.25, 0.42, 0));
    for (const [dx, dz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) g.add(cyl(0.2, 0.2, 0.12, 0x8a8f99, dx, 0.14, dz, 12).rotateX(Math.PI / 2));
    g.add(box(0.03, 0.55, 0.03, IRON, 0.4, 0.42, 0.25)); const d = mesh(new THREE.CylinderGeometry(0.22, 0.04, 0.06, 12), MW); d.position.set(0.4, 1.0, 0.25); g.add(d);
    return { g, fw: 0.6, fd: 0.45, ground: true };
  },
  // a flag on the plain with boot prints round it
  moonflag: (color) => {
    const g = G(box(0.05, 2.0, 0.05, 0xdddddd, 0, 0, 0), box(0.8, 0.03, 0.03, 0xdddddd, 0.4, 1.95, 0), box(0.78, 0.48, 0.02, color, 0.4, 1.45, 0));
    for (let k = 0; k < 8; k++) g.add(box(0.12, 0.01, 0.22, 0x6e6e74, Math.cos(k) * (0.4 + k * 0.08), 0, Math.sin(k * 1.7) * 0.5));
    return { g, fw: 0.4, fd: 0.4, ground: true };
  },
  // a small lander parked in the yard
  lander: (color) => { const g = G(); WINGS.landingpad(g, { tier: 5, color }); g.scale.setScalar(0.7); return { g, fw: 0.8, fd: 0.8, ground: true }; },
  // the golden beacon at the top level
  beacon: () => {
    const g = G(cyl(0.45, 0.45, 0.35, IRON, 0, 0, 0, 14), cyl(0.12, 0.12, 2.2, GOLD, 0, 0.35, 0, 12, goldM));
    const ring = mesh(new THREE.TorusGeometry(0.4, 0.05, 6, 20), GOLD, goldM); ring.rotation.x = Math.PI / 2; ring.position.y = 1.6; g.add(ring);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), mat(0xffd76a, { emissive: 0xffb300, emissiveIntensity: 1.6 })); orb.position.y = 2.75; g.add(orb);
    return { g, fw: 0.5, fd: 0.5 };
  },
};

export const MOON_STYLE = {
  mine:       { wings: ['regolithBin', 'berm', 'module'],       props: ['drill', 'cargo', 'flood', 'dish'] },
  furnace:    { wings: ['tankfarm', 'lab', 'tower'],            props: ['sphere', 'radfin', 'beaconmast', 'solarwing'] },
  press:      { wings: ['module', 'tankfarm', 'radiators'],     props: ['solarwing', 'sphere', 'radfin', 'dish'] },
  gear:       { wings: ['domehab', 'greenhouse', 'tower'],      props: ['cargo', 'solarwing', 'moonflag', 'flood'] },
  engine:     { wings: ['garage', 'landingpad', 'module'],      props: ['rover', 'solarwing', 'beaconmast', 'cargo'] },
  turbine:    { wings: ['dishhouse', 'lab', 'tower'],           props: ['scope', 'dish', 'beaconmast', 'solarwing'] },
  rocket:     { wings: ['landingpad', 'tankfarm', 'garage'],    props: ['sphere', 'flood', 'lander', 'beaconmast'] },
  power:      { wings: ['radiators', 'berm', 'tankfarm'],       props: ['radfin', 'solarwing', 'beaconmast', 'flood'] },
  datacenter: { wings: ['lab', 'radiators', 'dishhouse'],       props: ['dish', 'radfin', 'scope', 'beaconmast'] },
  hq:         { wings: ['domehab', 'greenhouse', 'dishhouse'],  props: ['moonflag', 'dish', 'rover', 'beaconmast'] },
};
MOON_STYLE.default = MOON_STYLE.gear;

export function moonGear(name, color) { return (GEAR[name] || GEAR.dish)(color); }
export function moonWing(kind, g, o) { return (WINGS[kind] || WINGS.tower)(g, o); }

const WING_TEXT = { domehab: 'a dome home', greenhouse: 'a greenhouse dome', tower: 'a module tower', module: 'a new module', regolithBin: 'dust bins', berm: 'a regolith bunker',
  tankfarm: 'a tank farm', garage: 'a rover hangar', landingpad: 'a landing pad', radiators: 'a radiator house', dishhouse: 'a little observatory', lab: 'a new lab' };
const GEAR_TEXT = { solarwing: 'a solar wing', radfin: 'radiator fins', dish: 'a comms dish', beaconmast: 'a beacon mast', sphere: 'a ball tank', flood: 'floodlights', cargo: 'cargo from Earth',
  scope: 'a telescope', drill: 'a drill rig', rover: 'a moon buggy', moonflag: 'a flag', lander: 'a lander' };
export function moonLookText(type, level) {
  const st = MOON_STYLE[type] || MOON_STYLE.default, w = st.wings.map(k => WING_TEXT[k]), p = st.props.map(k => GEAR_TEXT[k]);
  return { 5: `${w[0]} and ${p[0]}`, 10: `${w[1]} and ${p[1]}`, 25: `${w[2]} and ${p[2]}`, 50: `${p[3]} and a shiny new finish`, 100: 'taller, brighter modules', 250: 'a golden beacon' }[level] || '';
}
