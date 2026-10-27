// The Moon buildings, from the same kit as Colorado's and Mojave's: white pressurised
// modules wrapped in gold foil, ribbed domes with glowing portholes, airlocks, solar
// wings, radiators and moving machinery. Each replaces the plainer builder of the same
// name in models.js.
import * as THREE from 'three';
import { buildRocket } from './rockets.js';
import { BUILDERS, box, cyl } from './models.js';
import { DARK, IRON, HAZ, GLASS, PLINTH, shade, mesh, at, rod, onWall, signBoard, railing, pipe, tank, lattice } from './buildings.js';
import { marsSign } from './buildings-mars.js';

const MW = 0xeef0f3, GOLD = 0xd9a83a, REG = 0x8f8f96, ORANGE = 0xe07b2a;
const glow = (c = 0x5fe0ff, e = 0x2fc8ff, k = 1.3) => ({ emissive: e, emissiveIntensity: k });

// ---- lunar parts ----
// a glowing porthole on a curved surface: a little disc facing `normal`
function porthole(g, p, normal, r = 0.14) {
  const n = new THREE.Vector3(...normal).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  const rim = mesh(new THREE.CylinderGeometry(r * 1.35, r * 1.35, 0.05, 14), 0x3a3f48); rim.quaternion.copy(q); rim.position.set(...p); g.add(rim);
  const pane = mesh(new THREE.CylinderGeometry(r, r, 0.07, 14), 0x9fe8ff, glow()); pane.quaternion.copy(q); pane.position.set(...p).addScaledVector(n, 0.01); g.add(pane);
}
// a pressurised module lying along x or z: a cylinder with domed ends, ribs, a gold foil
// band and a row of portholes on the side facing the camera
function module(g, { x, y, z, len, r, along = 'x', color = MW, band = GOLD, windows = 3 }) {
  const body = mesh(new THREE.CylinderGeometry(r, r, len, 22), color);
  if (along === 'x') body.rotation.z = Math.PI / 2; else body.rotation.x = Math.PI / 2;
  body.position.set(x, y, z); g.add(body);
  for (const e of [-1, 1]) {
    const cap = mesh(new THREE.SphereGeometry(r, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), color);
    cap.scale.y = 0.45;
    if (along === 'x') { cap.rotation.z = -e * Math.PI / 2; cap.position.set(x + e * len / 2, y, z); } else { cap.rotation.x = e * Math.PI / 2; cap.position.set(x, y, z + e * len / 2); }
    g.add(cap);
  }
  const ribs = Math.max(2, Math.round(len / 0.75));
  for (let i = 0; i <= ribs; i++) {
    const t = -len / 2 + (len * i) / ribs;
    const rib = mesh(new THREE.TorusGeometry(r + 0.02, 0.035, 5, 24), shade(color, -0.2));
    if (along === 'x') { rib.rotation.y = Math.PI / 2; rib.position.set(x + t, y, z); } else rib.position.set(x, y, z + t);
    g.add(rib);
  }
  const bandM = mesh(new THREE.CylinderGeometry(r + 0.03, r + 0.03, Math.min(0.8, len * 0.25), 22), band, { metalness: 0.7, roughness: 0.3 });
  bandM.rotation.copy(body.rotation); bandM.position.copy(body.position); g.add(bandM);
  // portholes along the side facing the camera (+z for modules along x, +x for along z)
  for (let i = 0; i < windows; i++) {
    const t = (i - (windows - 1) / 2) * (len / (windows + 0.5));
    if (Math.abs(t) < 0.45 && windows > 2) continue;
    if (along === 'x') porthole(g, [x + t, y + 0.1, z + r], [0, 0.25, 1]); else porthole(g, [x + r, y + 0.1, z + t], [1, 0.25, 0]);
  }
  // cradle feet
  for (const t of [-len / 3, len / 3]) g.add(along === 'x' ? box(0.18, y - r + 0.2, r * 1.4, IRON, x + t, 0.15, z) : box(r * 1.4, y - r + 0.2, 0.18, IRON, x, 0.15, z + t));
  return body;
}
// a ribbed dome habitat on a base ring, with a band of glowing portholes and an airlock
function domeHab(g, { x, z, r, color = MW, y0 = 0.15, airlock = [0, 1] }) {
  g.add(cyl(r + 0.08, r + 0.12, 0.35, shade(color, -0.25), x, y0, z, 28));
  const d = mesh(new THREE.SphereGeometry(r, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), color); d.position.set(x, y0 + 0.35, z); g.add(d);
  for (let k = 0; k < 8; k++) {
    const rib = mesh(new THREE.TorusGeometry(r + 0.015, 0.03, 4, 24, Math.PI), shade(color, -0.18));
    rib.rotation.y = (k / 8) * Math.PI; rib.position.set(x, y0 + 0.35, z); g.add(rib);
  }
  const ring = mesh(new THREE.TorusGeometry(r * 0.72, 0.045, 5, 30), GOLD, { metalness: 0.7, roughness: 0.3 }); ring.rotation.x = Math.PI / 2; ring.position.set(x, y0 + 0.35 + r * 0.69, z); g.add(ring);
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2, e = 0.42;
    if (Math.cos(a) < -0.2 && Math.sin(a) < -0.2) continue;   // none on the back
    porthole(g, [x + Math.cos(a) * r * Math.cos(e), y0 + 0.35 + r * Math.sin(e), z + Math.sin(a) * r * Math.cos(e)], [Math.cos(a), Math.tan(e), Math.sin(a)], 0.11);
  }
  if (airlock) {
    const [ax, az] = airlock, al = 0.7;
    const px = x + ax * (r + al / 2 - 0.1), pz = z + az * (r + al / 2 - 0.1);
    const tube = mesh(new THREE.CylinderGeometry(0.38, 0.38, al, 16), color);
    if (ax) tube.rotation.z = Math.PI / 2; else tube.rotation.x = Math.PI / 2;
    tube.position.set(px, y0 + 0.5, pz); g.add(tube);
    const hatch = mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 16), 0x3a3f48); hatch.rotation.copy(tube.rotation);
    hatch.position.set(x + ax * (r + al - 0.08), y0 + 0.5, z + az * (r + al - 0.08)); g.add(hatch);
    g.add(at(box(0.16, 0.07, 0.05, ORANGE, 0, 0, 0, glow(0xffb070, 0xff8a2a, 1.2)), x + ax * (r + al - 0.04) + az * 0.36, y0 + 0.92, z + az * (r + al - 0.04) + ax * 0.36));
  }
  return y0 + 0.35 + r;
}
// a solar wing: a mast with two panel arrays that turn slowly to follow the sun
function solarWing(g, x, z, h, w = 1.6) {
  g.add(box(0.12, h, 0.12, 0xd8dbe2, x, 0.15, z));
  const head = new THREE.Group();
  for (const s of [-1, 1]) {
    head.add(box(0.06, 0.06, w * 0.3, IRON, 0, 0, s * w * 0.15));
    const p = box(w * 0.55, 0.04, w * 0.45, 0x223f78, 0, 0, s * (w * 0.55), { roughness: 0.25, metalness: 0.4 });
    head.add(p);
    for (let k = 1; k < 4; k++) head.add(box(0.012, 0.05, w * 0.45, GOLD, -w * 0.275 + (w * 0.55 * k) / 4, 0, s * (w * 0.55)));
  }
  head.position.set(x, h + 0.15, z); head.rotation.x = 0.5; g.add(head);
  return head;
}
// a mound of moon dust heaped against a wall, for protection
function berm(g, x, z, w, d, h, color = REG) {
  const m = mesh(new THREE.SphereGeometry(1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), color, { flatShading: true });
  m.scale.set(w / 2, h, d / 2); m.position.set(x, 0.15, z); g.add(m);
}
// a radiator: a white fin panel on a post, edge-on to the sun
function radiator(g, x, z, h, w) {
  g.add(box(0.08, h, 0.08, IRON, x, 0.15, z));
  g.add(box(0.05, h * 0.75, w, 0xf6f7f9, x, 0.15 + h * 0.25, z, { roughness: 0.3 }));
  for (let k = 0; k < 4; k++) g.add(box(0.07, h * 0.75, 0.03, 0xc9ced6, x, 0.15 + h * 0.25, z - w / 2 + (w * (k + 0.5)) / 4));
}
// a light mast with a cyan beacon
function beaconMast(g, x, z, h) {
  g.add(box(0.07, h, 0.07, 0xd8dbe2, x, 0.15, z));
  g.add(box(0.14, 0.14, 0.14, 0x9fe8ff, x, 0.15 + h, z, glow()));
}

// a name sign: navy with white capitals in a gold frame, standing on two posts (or
// mounted, with posts: false)
const NAVY = 0x1c2740, INK = 0xeef4ff;
function postSign(g, axis, x, z, w, h, text, y = 0.9, posts = true) {
  if (posts) for (const e of [-1, 1]) g.add(axis === 'z' ? box(0.07, y - 0.1, 0.07, 0xd8dbe2, x + e * (w / 2 - 0.15), 0.15, z - 0.05) : box(0.07, y - 0.1, 0.07, 0xd8dbe2, x - 0.05, 0.15, z + e * (w / 2 - 0.15)));
  marsSign(g, axis, x, y, z, w, h, text, NAVY, INK, GOLD);
}

Object.assign(BUILDERS, {
  // ---- Regolith Digger: a bucket-wheel excavator chewing into a dust mound, its boom
  // dropping regolith onto a conveyor to a processing dome
  regolith(color) {
    const g = new THREE.Group();
    berm(g, -2.3, -2.2, 2.4, 2.4, 1.3, color); berm(g, 2.45, 2.45, 1.6, 1.4, 0.7, shade(color, 0.1));
    // processing dome at the back right, with a conveyor feeding it
    domeHab(g, { x: 1.75, z: -2.0, r: 1.0, airlock: [1, 0] });
    // the excavator: tracks, a turntable body, a boom and a spinning bucket wheel
    const ex = new THREE.Group();
    for (const dz of [-0.5, 0.5]) { ex.add(box(1.8, 0.35, 0.36, DARK, 0, 0, dz)); for (let k = 0; k < 6; k++) ex.add(box(0.06, 0.37, 0.38, IRON, -0.75 + k * 0.3, 0, dz)); }
    ex.add(box(1.5, 0.7, 1.2, MW, 0, 0.35, 0), box(1.52, 0.12, 1.22, GOLD, 0, 0.75, 0, { metalness: 0.7, roughness: 0.3 }));
    ex.add(box(0.55, 0.45, 0.5, MW, 0.4, 1.05, 0.25), box(0.48, 0.3, 0.04, 0x9fe8ff, 0.4, 1.12, 0.51, glow()));
    const boomLen = 2.2;
    const boom = box(boomLen, 0.22, 0.26, ORANGE, -boomLen / 2, -0.11, 0); const bg = new THREE.Group(); bg.add(boom); bg.position.set(-0.4, 1.1, 0); bg.rotation.z = -0.38; ex.add(bg);
    const wheel = new THREE.Group();
    wheel.add(mesh(new THREE.TorusGeometry(0.62, 0.07, 6, 24), ORANGE));
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; const b = box(0.24, 0.22, 0.34, DARK, Math.cos(a) * 0.68, Math.sin(a) * 0.68 - 0.11, 0); b.rotation.z = a; wheel.add(b); }
    for (let k = 0; k < 4; k++) { const sp = mesh(new THREE.BoxGeometry(1.2, 0.05, 0.05), IRON); sp.rotation.z = (k / 4) * Math.PI; wheel.add(sp); }
    wheel.position.set(-boomLen, 0, 0); bg.add(wheel);
    ex.position.set(-0.5, 0.15, 0.1); ex.rotation.y = -0.65; g.add(ex);
    // conveyor from the digger to the dome
    // an enclosed conveyor tube from a hopper by the digger up into the dome
    g.add(box(0.7, 0.6, 0.7, MW, 0.75, 0.15, -0.55));
    rod(g, [0.75, 0.9, -0.55], [1.25, 1.55, -1.6], 0.14, ORANGE);
    g.add(box(0.1, 1.1, 0.1, IRON, 1.0, 0.15, -1.08));
    beaconMast(g, 2.75, 1.6, 2.6);
    postSign(g, 'x', 1.6, 0.6, 1.3, 0.34, 'REGOLITH', 0.75);
    return { group: g, top: 4.4, anim(t, dt) { wheel.rotation.z += dt * 2.2; ex.rotation.y = -0.65 + Math.sin(t * 0.35) * 0.35; } };
  },

  // ---- Helium-3 Refinery: big white spheres on legs with gold bands, a tall refining
  // column with platforms and blue lights, and pipe racks
  he3(color) {
    const g = new THREE.Group();
    const sphere = (x, z, r) => {
      for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; g.add(box(0.08, r + 0.25, 0.08, IRON, x + Math.cos(a) * r * 0.75, 0.15, z + Math.sin(a) * r * 0.75)); }
      const s = mesh(new THREE.SphereGeometry(r, 24, 16), MW); s.position.set(x, r + 0.45, z); g.add(s);
      g.add(cyl(r + 0.02, r + 0.02, 0.16, color, x, r + 0.37, z, 24));
      g.add(cyl(0.12, 0.12, 0.3, IRON, x, 2 * r + 0.4, z, 8));
      return r * 2 + 0.45;
    };
    sphere(-1.9, -1.5, 1.05); sphere(-2.3, 1.9, 0.7); sphere(2.4, -2.35, 0.7);
    // refining column with ring platforms and lights
    const cx = 1.0, cz = -0.3;
    g.add(cyl(0.75, 0.8, 0.35, PLINTH, cx, 0.15, cz, 20));
    g.add(cyl(0.48, 0.5, 5.4, MW, cx, 0.5, cz, 20));
    for (const y of [1.6, 3.0, 4.4]) {
      g.add(cyl(0.9, 0.9, 0.06, IRON, cx, y, cz, 20));
      const rr = mesh(new THREE.TorusGeometry(0.88, 0.025, 4, 24), HAZ); rr.rotation.x = Math.PI / 2; rr.position.set(cx, y + 0.45, cz); g.add(rr);
      g.add(cyl(0.5, 0.5, 0.12, color, cx, y + 0.2, cz, 20, glow(0x9fe8ff, 0x4fb8ff, 0.9)));
    }
    const domeTop = mesh(new THREE.SphereGeometry(0.5, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), MW); domeTop.position.set(cx, 5.9, cz); g.add(domeTop);
    g.add(box(0.06, 1.0, 0.06, 0xd8dbe2, cx, 6.3, cz), box(0.12, 0.12, 0.12, 0xff3b2f, cx, 7.3, cz, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    // the control module and pipe racks
    module(g, { x: 2.0, y: 0.75, z: 2.1, len: 1.6, r: 0.55, along: 'x', windows: 2 });
    pipe(g, [[-1.0, 1.4, -1.5], [0.4, 1.4, -1.5], [0.4, 1.4, -0.3], [0.55, 1.4, -0.3]], 0.1, 0xc9ced6);
    pipe(g, [[-1.7, 1.0, 1.9], [0.0, 1.0, 1.9], [0.0, 1.0, -0.3], [0.55, 1.0, -0.3]], 0.08, color);
    pipe(g, [[1.8, 1.4, -2.35], [1.0, 1.4, -2.35], [1.0, 1.4, -0.85]], 0.07, 0xc9ced6);
    postSign(g, 'z', 2.0, 2.8, 1.4, 0.34, 'HELIUM-3', 0.8);
    return { group: g, top: 7.6 };
  },

  // ---- Fuel Cell Lab: two linked modules with teal trim, a lab dome, hydrogen and
  // oxygen tanks, and racks of glowing fuel cell stacks
  fuelcell(color) {
    const g = new THREE.Group();
    module(g, { x: -1.0, y: 0.8, z: -1.9, len: 3.0, r: 0.65, along: 'x', band: color, windows: 4 });
    module(g, { x: -1.4, y: 0.8, z: 0.55, len: 2.2, r: 0.6, along: 'z', band: GOLD, windows: 2 });
    rod(g, [-1.4, 0.8, -0.6], [-1.4, 0.8, -1.3], 0.34, MW);
    domeHab(g, { x: 1.6, z: -1.85, r: 0.9, airlock: [0, 1] });
    // tanks: hydrogen (white) and oxygen (blue) side by side
    tank(g, 2.55, 1.95, 0.42, 1.4, MW); tank(g, 1.75, 2.6, 0.38, 1.2, 0x7fb3e6);
    // fuel cell racks: dark stacks with teal lit plates
    const cells = [];
    for (let i = 0; i < 3; i++) {
      const x = -2.7 + i * 0.6, z = 2.45;
      g.add(box(0.55, 1.2, 0.5, 0x2a2d33, x, 0.15, z));
      for (let k = 0; k < 5; k++) { const p = box(0.5, 0.06, 0.04, color, x, 0.3 + k * 0.2, z + 0.26, glow(color, color, 1)); p.material = p.material.clone(); g.add(p); cells.push(p); }
    }
    solarWing(g, 0.45, 0.45, 2.6, 1.4);
    postSign(g, 'z', -2.1, 2.78, 1.7, 0.34, 'FUEL CELLS', 1.45);
    return { group: g, top: 4.4, anim(t) { cells.forEach((c, i) => { c.material.emissiveIntensity = 0.6 + 0.8 * Math.max(0, Math.sin(t * 2.4 - i * 0.45)); }); } };
  },

  // ---- Habitat Printer: a yellow gantry printing a new dome out of moon dust (it grows
  // layer by layer), finished domes beside it, and a dust hopper
  habitat(color) {
    const g = new THREE.Group();
    // finished habitats
    domeHab(g, { x: -2.1, z: -1.7, r: 1.0, color, airlock: [1, 0] });
    domeHab(g, { x: 1.9, z: -2.0, r: 0.8, color, airlock: [-1, 0] });
    // the print bed and the dome being printed
    g.add(cyl(1.35, 1.4, 0.12, 0x6d7076, 0.1, 0.15, 0.6, 28));
    const printed = mesh(new THREE.SphereGeometry(1.1, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), shade(color, -0.12), { flatShading: true });
    printed.position.set(0.1, 0.27, 0.6); g.add(printed);
    for (let k = 1; k < 7; k++) { const layer = mesh(new THREE.TorusGeometry(1.1 * Math.cos(k * 0.2), 0.02, 4, 28), shade(color, -0.3)); layer.rotation.x = Math.PI / 2; layer.position.set(0.1, 0.27 + 1.1 * Math.sin(k * 0.2), 0.6); printed.add(layer); layer.position.sub(printed.position); }
    // gantry: four legs, two rails, a moving bridge with the print head
    const H = 2.9;
    for (const [dx, dz] of [[-1.7, -1.0], [1.7, -1.0], [-1.7, 2.2], [1.7, 2.2]]) g.add(box(0.16, H, 0.16, HAZ, 0.1 + dx, 0.15, dz));
    for (const dz of [-1.0, 2.2]) g.add(box(3.6, 0.16, 0.16, HAZ, 0.1, H + 0.15, dz));
    const bridge = new THREE.Group();
    bridge.add(box(0.2, 0.2, 3.4, HAZ, 0, 0, 0.6));
    const head = new THREE.Group(); head.add(box(0.4, 0.4, 0.4, DARK, 0, -0.35, 0), cyl(0.05, 0.12, 0.5, IRON, 0, -0.85, 0, 8));
    head.add(box(0.14, 0.07, 0.04, 0xffb070, 0, -0.85, 0.06, glow(0xffb070, 0xff8a2a, 1.4)));
    bridge.add(head);
    bridge.position.set(0.1, H + 0.25, 0); g.add(bridge);
    // dust hopper feeding the printer
    const hop = mesh(new THREE.ConeGeometry(0.55, 0.7, 4), MW); hop.rotation.set(Math.PI, Math.PI / 4, 0); hop.position.set(2.55, 1.5, 2.3); g.add(hop);
    for (const [dx, dz] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) g.add(box(0.07, 1.2, 0.07, IRON, 2.55 + dx, 0.15, 2.3 + dz));
    g.add(box(0.8, 0.3, 0.8, MW, 2.55, 1.85, 2.3));
    pipe(g, [[2.55, 1.0, 2.3], [2.55, 0.5, 2.3], [1.5, 0.5, 2.3], [1.5, 0.5, 1.6]], 0.07, 0xc9ced6);
    postSign(g, 'z', 0.1, 2.32, 2.0, 0.38, 'HAB PRINTER', H - 0.5, false);
    return {
      group: g, top: H + 1.4,
      anim(t) {
        const k = (t * 0.06) % 1;
        printed.scale.set(1, Math.max(0.05, k), 1);
        bridge.position.x = 0.1 + Math.sin(t * 0.9) * 1.0;
        head.position.z = 0.6 + Math.cos(t * 1.7) * 1.0;
      },
    };
  },

  // ---- Rover Garage: a half-tube hangar with a big door, a charging pad with lights,
  // a rover driving out and back, and a solar wing
  lunarrover(color) {
    const g = new THREE.Group();
    const hx = -1.55, hz = -0.9, len = 3.2, r = 1.4;
    const hang = mesh(new THREE.CylinderGeometry(r, r, len, 24, 1, false, -Math.PI / 2, Math.PI), MW);
    hang.rotation.x = -Math.PI / 2; hang.position.set(hx, 0.3, hz); g.add(hang);
    g.add(box(2 * r + 0.3, 0.3, len + 0.3, PLINTH, hx, 0, hz));
    for (let k = 0; k <= 4; k++) { const rib = mesh(new THREE.TorusGeometry(r + 0.03, 0.045, 4, 24, Math.PI), shade(MW, -0.2)); rib.position.set(hx, 0.3, hz - len / 2 + (len * k) / 4); g.add(rib); }
    const band = mesh(new THREE.CylinderGeometry(r + 0.04, r + 0.04, 0.5, 24, 1, true, -Math.PI / 2, Math.PI), color, { side: THREE.DoubleSide, metalness: 0.6, roughness: 0.35 });
    band.rotation.x = -Math.PI / 2; band.position.set(hx, 0.3, hz); g.add(band);
    // the end wall with a big door and warning lights
    const front = mesh(new THREE.CircleGeometry(r, 24, 0, Math.PI), shade(MW, -0.08)); front.position.set(hx, 0.3, hz + len / 2); g.add(front);
    g.add(box(1.7, 1.1, 0.05, 0x3a3f48, hx, 0.3, hz + len / 2 + 0.02));
    for (let k = 0; k < 5; k++) g.add(box(1.7, 0.03, 0.02, 0x5b5f66, hx, 0.45 + k * 0.2, hz + len / 2 + 0.05));
    for (const e of [-1, 1]) g.add(box(0.12, 0.12, 0.08, ORANGE, hx + e * 1.0, 1.25, hz + len / 2 + 0.03, glow(0xffb070, 0xff8a2a, 1.4)));
    for (let k = 0; k < 4; k++) porthole(g, [hx + r * Math.cos(0.5), 0.3 + r * Math.sin(0.5), hz - 1.0 + k * 0.65], [Math.cos(0.5), Math.sin(0.5), 0], 0.1);
    // charging pad with corner lights
    const px = hx, pz = 2.5;
    g.add(box(1.5, 0.06, 1.4, 0x3a3f48, px, 0.15, pz));
    for (const [dx, dz] of [[-0.65, -0.6], [0.65, -0.6], [-0.65, 0.6], [0.65, 0.6]]) g.add(box(0.1, 0.08, 0.1, 0x9fe8ff, px + dx, 0.2, pz + dz, glow()));
    g.add(box(0.3, 0.8, 0.3, MW, px - 1.0, 0.15, pz - 0.2), box(0.04, 0.12, 0.2, 0x9cff8a, px - 0.84, 0.75, pz - 0.2, glow(0x9cff8a, 0x6dff5a, 1.4)));
    // a parts store module and radiators on the right
    module(g, { x: 1.55, y: 0.7, z: -2.0, len: 2.0, r: 0.5, along: 'x', band: color, windows: 2 });
    radiator(g, 2.7, 1.9, 2.0, 0.6); radiator(g, 2.0, 2.6, 2.0, 0.6);
    // the rover
    const rv = new THREE.Group();
    rv.add(box(1.3, 0.14, 0.9, color, 0, 0.42, 0), box(0.4, 0.35, 0.6, 0xc9ced6, -0.35, 0.56, 0));
    rv.add(box(0.05, 0.6, 0.05, IRON, 0.4, 0.56, 0.25));
    const dish = mesh(new THREE.CylinderGeometry(0.28, 0.05, 0.08, 12), MW); dish.position.set(0.4, 1.2, 0.25); rv.add(dish);
    rv.add(box(0.3, 0.04, 0.5, 0x223f78, 0.15, 0.56, -0.1));
    for (const x of [-0.5, 0.5]) for (const z of [-0.5, 0.5]) { const w = mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.14, 14), 0x8a8f99); w.rotation.x = Math.PI / 2; w.position.set(x, 0.25, z); rv.add(w); }
    g.add(rv);
    solarWing(g, 0.7, 0.2, 2.6, 1.4);
    beaconMast(g, -2.75, 2.7, 2.2);
    postSign(g, 'z', hx, hz + len / 2 + 0.05, 1.3, 0.26, 'ROVER BAY', 1.38, false);
    return {
      group: g, top: 4.0,
      anim(t) {
        // drive out of the garage door to the charging pad, and back in
        const k = (Math.sin(t * 0.35) + 1) / 2;
        rv.position.set(hx, 0.15, (hz + 0.3) + (pz - (hz + 0.3)) * k);
        rv.rotation.y = -Math.PI / 2;
      },
    };
  },

  // ---- Telescope Works: a big radio dish that sweeps the sky, an observatory dome with
  // an open slit, and a control module
  telescope(color) {
    const g = new THREE.Group();
    // the radio dish on a turning mount
    const mx = 0.9, mz = -0.7;
    g.add(cyl(0.95, 1.05, 0.4, PLINTH, mx, 0.15, mz, 20));
    const mount = new THREE.Group();
    mount.add(cyl(0.35, 0.45, 1.8, MW, 0, 0, 0, 14));
    for (const s of [-1, 1]) mount.add(box(0.14, 1.0, 0.5, color, s * 0.42, 1.6, 0));
    const tilt = new THREE.Group();
    const bowl = mesh(new THREE.SphereGeometry(2.1, 28, 10, 0, Math.PI * 2, Math.PI * 0.64, Math.PI * 0.36), MW, { side: THREE.DoubleSide });
    bowl.position.y = 2.1 + 0.2; tilt.add(bowl);                     // the bowl opens to the sky
    const rimY = 0.2 + 2.1 - 2.1 * Math.cos(Math.PI * 0.36), rimR = 2.1 * Math.sin(Math.PI * 0.36);
    for (let k = 0; k < 4; k++) { const a = (k / 4) * Math.PI * 2 + Math.PI / 4; rod(tilt, [Math.cos(a) * rimR * 0.95, rimY, Math.sin(a) * rimR * 0.95], [0, 2.5, 0], 0.035, IRON); }
    tilt.add(box(0.28, 0.28, 0.28, color, 0, 2.4, 0));
    const ring = mesh(new THREE.TorusGeometry(rimR, 0.05, 5, 32), color); ring.rotation.x = Math.PI / 2; ring.position.y = rimY; tilt.add(ring);
    tilt.position.y = 2.0; tilt.rotation.x = -0.75;
    mount.add(tilt);
    mount.position.set(mx, 0.55, mz); g.add(mount);
    // observatory dome with an open slit and a telescope peeking out
    const ox = -2.15, oz = 1.6;
    g.add(cyl(0.95, 0.95, 1.0, MW, ox, 0.15, oz, 22));
    const od = mesh(new THREE.SphereGeometry(0.95, 22, 10, 0, Math.PI * 2, 0, Math.PI / 2), shade(color, 0.25)); od.position.set(ox, 1.15, oz); g.add(od);
    const slit = box(0.36, 0.95, 0.06, 0x1c1e22, ox + 0.18, 1.3, oz + 0.62); slit.rotation.set(-0.55, 0.3, 0); g.add(slit);
    const scope = cyl(0.12, 0.14, 0.9, 0x3a3f48, ox + 0.2, 1.25, oz + 0.4, 10); scope.rotation.x = 0.7; g.add(scope);
    // control module
    module(g, { x: -1.6, y: 0.75, z: -1.9, len: 2.4, r: 0.55, along: 'x', band: color, windows: 3 });
    pipe(g, [[-0.4, 0.5, -1.9], [mx - 0.9, 0.5, -1.9], [mx - 0.9, 0.5, mz]], 0.06, DARK);
    solarWing(g, 2.6, 2.4, 2.4, 1.3);
    postSign(g, 'z', -1.2, -1.0, 1.25, 0.32, 'OBSERVATORY', 0.75);
    return { group: g, top: 6.5, anim(t) { mount.rotation.y = Math.sin(t * 0.18) * 1.1; tilt.rotation.x = -0.75 + Math.sin(t * 0.13) * 0.2; } };
  },

  // ---- Starship Yard: a landing ring with lights, a tall catch tower with arms, the
  // stainless starship, and propellant tanks
  starship(color) {
    const g = new THREE.Group();
    g.add(cyl(2.0, 2.1, 0.35, 0x8a8a90, 0.4, 0.15, 0.2, 28));
    const ringL = mesh(new THREE.TorusGeometry(1.75, 0.06, 4, 32), 0x9fe8ff, glow()); ringL.rotation.x = Math.PI / 2; ringL.position.set(0.4, 0.52, 0.2); g.add(ringL);
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; g.add(box(0.22, 0.04, 0.5, HAZ, 0.4 + Math.cos(a) * 1.2, 0.5, 0.2 + Math.sin(a) * 1.2)); g.children[g.children.length - 1].rotation.y = -a; }
    // the tower
    const tx = -1.9, tz = -1.7;
    lattice(g, tx - 0.4, tz + 0.4, tx + 0.4, tz + 0.4, 0.15, 9.2, 0x5b5f66, 1.0);
    lattice(g, tx + 0.4, tz - 0.4, tx + 0.4, tz + 0.4, 0.15, 9.2, 0x5b5f66, 1.0);
    lattice(g, tx - 0.4, tz - 0.4, tx - 0.4, tz + 0.4, 0.15, 9.2, 0x5b5f66, 1.0);
    g.add(box(1.1, 0.14, 1.1, DARK, tx, 9.4, tz));
    for (const y of [6.8, 8.2]) { const arm = box(1.9, 0.22, 0.32, 0x5b5f66, tx + 1.25, y, tz + 0.95); arm.rotation.y = -0.65; g.add(arm); }
    g.add(box(0.14, 0.14, 0.14, 0xff3b2f, tx, 9.6, tz, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    // the ship: stainless body, dark heat-shield side, nose fins
    const rocket = buildRocket('starship', color);
    rocket.position.set(0.4, 0.5, 0.2); g.add(rocket);
    const scaffold = new THREE.Group();
    for (let i = 0; i < 6; i++) scaffold.add(box(2.0, 0.1, 2.0, 0xb9b4a8, 0.4, 1.0 + i * 1.25, 0.2));
    for (const [dx, dz] of [[-0.95, -0.95], [0.95, 0.95], [-0.95, 0.95], [0.95, -0.95]]) scaffold.add(box(0.1, 7.6, 0.1, 0xb9b4a8, 0.4 + dx, 0.5, 0.2 + dz));
    g.add(scaffold);
    // propellant tanks
    tank(g, 2.6, -2.3, 0.55, 2.4, MW); tank(g, 2.6, 2.5, 0.45, 1.8, MW);
    return { group: g, top: 11.0, rocket, scaffold };
  },

  // ---- Mission Control: a big ribbed dome with a glowing window band, a wing module,
  // a comms tower with a turning dish, and a flag
  hqmoon(color) {
    const g = new THREE.Group();
    const top = domeHab(g, { x: -0.6, z: -0.6, r: 2.0, color, airlock: [0, 1] });
    // a ring of big windows round the dome
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      if (Math.cos(a) < -0.3 && Math.sin(a) < -0.3) continue;
      const w = box(0.5, 0.32, 0.05, 0x9fe8ff, -0.6 + Math.cos(a) * 1.9, 0.95, -0.6 + Math.sin(a) * 1.9, glow());
      w.rotation.y = -a + Math.PI / 2; g.add(w);
    }
    module(g, { x: 1.85, y: 0.8, z: 0.4, len: 2.4, r: 0.6, along: 'z', band: GOLD, windows: 3 });
    // comms tower with a turning dish
    lattice(g, 2.35, -2.35, 2.85, -2.35, 0.15, 4.0, 0xd8dbe2, 0.8);
    lattice(g, 2.85, -2.85, 2.85, -2.35, 0.15, 4.0, 0xd8dbe2, 0.8);
    const mast = new THREE.Group();
    mast.add(box(0.1, 0.5, 0.1, 0xd8dbe2, 0, 0, 0));
    const dish = mesh(new THREE.SphereGeometry(0.7, 16, 7, 0, Math.PI * 2, 0, Math.PI / 2.4), 0xf2f2f2, { side: THREE.DoubleSide });
    dish.rotation.x = Math.PI / 2.4; dish.position.y = 0.6; mast.add(dish);
    mast.position.set(2.6, 4.2, -2.6); g.add(mast);
    // the flag, stiff on its crossbar (there's no wind on the Moon)
    g.add(box(0.06, 2.2, 0.06, 0xdddddd, -2.6, 0.15, 2.3), box(0.9, 0.04, 0.04, 0xdddddd, -2.15, 2.3, 2.3));
    g.add(box(0.9, 0.55, 0.03, 0xffd23f, -2.15, 1.75, 2.3));
    beaconMast(g, 2.7, 2.6, 1.8);
    postSign(g, 'z', 0.9, 2.55, 2.1, 0.36, 'MISSION CONTROL', 0.85);
    return { group: g, top: top + 2.0, anim(t) { mast.rotation.y = Math.sin(t * 0.4) * 1.2; } };
  },

  // ---- Fusion Reactor: a tokamak out in the open (there's no air to keep out), its
  // shell cut away so you can see the pink plasma racing round inside, ringed by copper
  // coils under a crane ring, with tall radiator wings glowing behind and gold cables
  // running to a switchyard
  fusion(color) {
    const g = new THREE.Group();
    const cx = -0.35, cz = -0.35, ky = 1.35, R = 1.4;
    g.add(cyl(2.4, 2.5, 0.3, PLINTH, cx, 0.15, cz, 36));
    const edge = mesh(new THREE.TorusGeometry(2.42, 0.05, 4, 48), GOLD, { metalness: 0.7, roughness: 0.3 }); edge.rotation.x = Math.PI / 2; edge.position.set(cx, 0.45, cz); g.add(edge);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; g.add(box(0.22, ky - 0.6, 0.5, IRON, cx + Math.cos(a) * R, 0.45, cz + Math.sin(a) * R).rotateY(-a)); }
    // the shell, cut away toward the camera
    const ring = new THREE.Group(); ring.position.set(cx, ky, cz); ring.rotation.y = -1.49;
    const shell = mesh(new THREE.TorusGeometry(R, 0.56, 18, 48, Math.PI * 1.55), shade(color, 0.55), { metalness: 0.55, roughness: 0.3, side: THREE.DoubleSide });
    shell.rotation.x = Math.PI / 2; ring.add(shell);
    for (const a of [0, Math.PI * 1.55]) { const cap = mesh(new THREE.TorusGeometry(0.5, 0.07, 6, 18), GOLD, { metalness: 0.7, roughness: 0.3 }); cap.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); cap.rotation.y = -a; ring.add(cap); }
    for (let k = 0; k < 12; k++) { const a = (k + 0.5) / 12 * Math.PI * 1.55; const c = mesh(new THREE.TorusGeometry(0.72, 0.09, 5, 16), 0xb87333, { metalness: 0.7, roughness: 0.35 }); c.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); c.rotation.y = -a; ring.add(c); }
    g.add(ring);
    const plasma = new THREE.Mesh(new THREE.TorusGeometry(R, 0.24, 10, 48), new THREE.MeshBasicMaterial({ color: 0xff7ae0 }));
    plasma.rotation.x = Math.PI / 2; plasma.position.set(cx, ky, cz); g.add(plasma);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(R, 0.38, 10, 48), new THREE.MeshBasicMaterial({ color: 0xff5ad0, transparent: true, opacity: 0.25, depthWrite: false }));
    halo.rotation.x = Math.PI / 2; halo.position.copy(plasma.position); g.add(halo);
    // the central solenoid with pulsing rings
    g.add(cyl(0.42, 0.48, 3.1, 0xc9ced6, cx, 0.45, cz, 18));
    const sol = [];
    for (let k = 0; k < 4; k++) { const r = cyl(0.47, 0.47, 0.1, 0xff9ae8, cx, 0.9 + k * 0.6, cz, 18, { emissive: 0xff5ad0, emissiveIntensity: 1 }); r.material = r.material.clone(); g.add(r); sol.push(r); }
    g.add(cyl(0.3, 0.45, 0.35, MW, cx, 3.55, cz, 18), box(0.1, 0.1, 0.1, 0xff3b2f, cx, 3.95, cz, { emissive: 0xff2a1a, emissiveIntensity: 1.5 }));
    // the crane ring overhead on four masts
    for (let k = 0; k < 4; k++) { const a = k / 4 * Math.PI * 2 + Math.PI / 4; g.add(box(0.14, 3.4, 0.14, 0xd8dbe2, cx + Math.cos(a) * 2.15, 0.45, cz + Math.sin(a) * 2.15)); }
    const crane = new THREE.Group(); crane.position.set(cx, 3.85, cz);
    const rail = mesh(new THREE.TorusGeometry(2.15, 0.07, 6, 48), HAZ); rail.rotation.x = Math.PI / 2; crane.add(rail);
    crane.add(box(4.3, 0.14, 0.22, HAZ, 0, -0.05, 0), box(0.35, 0.3, 0.35, DARK, 0.9, -0.3, 0), cyl(0.02, 0.02, 1.0, IRON, 0.9, -1.4, 0, 4));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; crane.add(box(0.08, 0.06, 0.08, 0x9fe8ff, Math.cos(a) * 2.15, 0.08, Math.sin(a) * 2.15, glow())); }
    g.add(crane);
    // radiator wings behind, their heat lines glowing red
    const heat = [];
    for (const [x, z, ry] of [[-2.75, -0.7, 0], [-2.75, 1.0, 0], [-0.9, -2.75, Math.PI / 2], [0.8, -2.75, Math.PI / 2]]) {
      const w = new THREE.Group(); w.position.set(x, 0.15, z); w.rotation.y = ry;
      w.add(box(0.1, 0.5, 0.1, IRON, 0, 0, 0), box(0.06, 2.6, 1.5, 0xf6f7f9, 0, 0.5, 0, { roughness: 0.3 }));
      for (let k = 0; k < 4; k++) { const h = box(0.08, 2.4, 0.04, 0xff6a4a, 0, 0.6, -0.55 + k * 0.37, { emissive: 0xff3a1a, emissiveIntensity: 0.6 }); h.material = h.material.clone(); w.add(h); heat.push(h); }
      g.add(w);
    }
    // gold power cables to the switchyard and its sign
    const yx = 1.9, yz = 1.95;
    g.add(box(1.2, 0.8, 0.8, 0x4a4d55, yx, 0.15, yz - 0.1));
    for (let k = 0; k < 6; k++) g.add(box(0.03, 0.6, 0.14, IRON, yx - 0.5 + k * 0.2, 0.25, yz + 0.34));
    for (const dx of [-0.35, 0, 0.35]) { g.add(box(0.06, 0.3, 0.06, IRON, yx + dx, 0.95, yz - 0.1)); for (let j = 0; j < 4; j++) g.add(cyl(0.09, 0.09, 0.05, 0xe6e0d4, yx + dx, 1.25 + j * 0.08, yz - 0.1, 10)); }
    for (const dz of [-0.15, 0.15]) rod(g, [cx + 1.2, 0.6, cz + 1.2 + dz], [yx - 0.6, 0.6, yz - 0.1 + dz], 0.07, GOLD);
    postSign(g, 'z', yx, yz + 0.5, 1.3, 0.32, 'FUSION', 0.95);
    return { group: g, top: 4.6,
      anim(t) {
        plasma.material.color.setHSL(0.86 + Math.sin(t * 3) * 0.04, 1, 0.62 + Math.sin(t * 5) * 0.08); plasma.rotation.z = t * 0.8;
        halo.material.opacity = 0.18 + Math.sin(t * 4) * 0.08;
        sol.forEach((r, i) => { r.material.emissiveIntensity = 0.4 + 1.2 * Math.max(0, Math.sin(t * 3 - i * 0.8)); });
        heat.forEach((h, i) => { h.material.emissiveIntensity = 0.4 + 0.4 * Math.sin(t * 1.5 + i * 0.5); });
        crane.rotation.y = t * 0.15;
      } };
  },

  // ---- Quantum Lab: a tall glass rotunda where the gold 'chandelier' fridge hangs in the
  // cold, glowing qubit rings spinning above it, curved lab modules wrapped round its back,
  // cryostat tanks, and fibre lines glowing across the ground
  quantum(color) {
    const g = new THREE.Group();
    const ax = 0.35, az = 0.35, H = 2.6;
    g.add(cyl(1.55, 1.65, 0.3, PLINTH, ax, 0.15, az, 32));
    const gr = mesh(new THREE.TorusGeometry(1.57, 0.05, 4, 40), GOLD, { metalness: 0.7, roughness: 0.3 }); gr.rotation.x = Math.PI / 2; gr.position.set(ax, 0.45, az); g.add(gr);
    g.add(mesh(new THREE.CylinderGeometry(1.2, 1.2, H, 32, 1, true), 0xbfe9ff, { transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.2, depthWrite: false, side: THREE.DoubleSide }).translateX(ax).translateY(0.45 + H / 2).translateZ(az));
    for (let k = 0; k < 10; k++) { const a = k / 10 * Math.PI * 2; g.add(box(0.07, H, 0.07, 0xf2f3f6, ax + Math.cos(a) * 1.2, 0.45, az + Math.sin(a) * 1.2)); }
    g.add(cyl(1.3, 1.3, 0.18, 0xf2f3f6, ax, 0.45 + H, az, 32), cyl(1.32, 1.32, 0.06, color, ax, 0.45 + H + 0.18, az, 32, { emissive: color, emissiveIntensity: 0.4 }));
    g.add(cyl(0.6, 0.9, 0.3, 0xf2f3f6, ax, 0.69 + H, az, 24));
    // the chandelier: stacked gold plates, wires and a cold blue glow at the bottom
    const chand = new THREE.Group();
    for (let k = 0; k < 5; k++) chand.add(cyl(0.55 - k * 0.08, 0.55 - k * 0.08, 0.06, GOLD, 0, -k * 0.38, 0, 20, { metalness: 0.85, roughness: 0.2 }));
    for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; chand.add(box(0.03, 1.55, 0.03, GOLD, Math.cos(a) * (0.3 - (k % 2) * 0.1), -1.55, Math.sin(a) * (0.3 - (k % 2) * 0.1), { metalness: 0.85, roughness: 0.2 })); }
    chand.add(cyl(0.12, 0.12, 0.12, 0x9fe8ff, 0, -1.7, 0, 12, glow()));
    chand.position.set(ax, 0.4 + H, az); g.add(chand);
    // qubit rings spinning above the roof
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.07, 8, 32), new THREE.MeshBasicMaterial({ color: 0x6fe3ff }));
    const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.06, 8, 32), new THREE.MeshBasicMaterial({ color: 0xc58aff }));
    ringA.position.set(ax, H + 2.0, az); ringB.position.copy(ringA.position); g.add(ringA, ringB);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 10), new THREE.MeshBasicMaterial({ color: 0xffffff })); orb.position.copy(ringA.position); g.add(orb);
    g.add(cyl(0.06, 0.1, 0.8, IRON, ax, H + 0.95, az, 8));
    // lab modules wrapped round the back
    module(g, { x: 0.0, y: 0.8, z: -2.25, len: 3.0, r: 0.6, along: 'x', band: color, windows: 4 });
    module(g, { x: -2.25, y: 0.8, z: 0.2, len: 2.6, r: 0.6, along: 'z', band: color, windows: 3 });
    rod(g, [-1.4, 0.8, -2.25], [-2.25, 0.8, -2.25], 0.4, MW); rod(g, [-2.25, 0.8, -2.25], [-2.25, 0.8, -1.1], 0.4, MW);
    rod(g, [ax - 0.4, 0.8, az - 1.1], [ax - 0.4, 0.8, -1.65], 0.3, MW); rod(g, [ax - 1.1, 0.8, az - 0.2], [-1.65, 0.8, az - 0.2], 0.3, MW);
    // cryostat tanks and fibre lines
    tank(g, 2.45, -1.4, 0.42, 1.6, 0xd8dbe2); tank(g, 2.55, -0.4, 0.34, 1.2, 0xd8dbe2);
    pipe(g, [[2.45, 1.0, -1.0], [2.45, 1.0, -0.2], [1.5, 1.0, -0.2]], 0.07, 0x9fd6ff);
    for (const [x0, z0, x1, z1] of [[-1.6, 1.6, ax - 1.0, az + 0.6], [1.9, 2.2, ax + 0.9, az + 0.9]]) {
      const len = Math.hypot(x1 - x0, z1 - z0), f = box(0.08, 0.02, len, 0x9fe8ff, (x0 + x1) / 2, 0.15, (z0 + z1) / 2, glow()); f.rotation.y = Math.atan2(x1 - x0, z1 - z0); g.add(f);
    }
    radiator(g, -2.7, 2.3, 2.0, 0.7);
    postSign(g, 'z', 1.95, 2.45, 1.6, 0.34, 'QUANTUM LAB', 0.85);
    return { group: g, top: H + 3.0, anim(t) { ringA.rotation.x = t * 1.3; ringB.rotation.y = t * 1.7; ringB.rotation.x = 0.6; orb.scale.setScalar(1 + Math.sin(t * 4) * 0.12); chand.rotation.y = t * 0.2; } };
  },
});

// The ones without truck bays are scaled up to fill their lots
for (const [name, S] of [['fusion', 1.2], ['quantum', 1.2], ['hqmoon', 1.15]]) {
  const make = BUILDERS[name];
  BUILDERS[name] = color => {
    const m = make(color), core = new THREE.Group();
    core.scale.setScalar(S);
    for (const c of [...m.group.children]) core.add(c);
    m.group.add(core);
    m.top *= S;
    if (m.smoke) m.smoke = m.smoke.map(v => v.clone().multiplyScalar(S));
    return m;
  };
}
