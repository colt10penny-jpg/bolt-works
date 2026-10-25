// The rockets on the launch pads, one design per world, all standing on their engines
// with the base at y = 0 (so they can grow out of the scaffold and lift off):
//   classic  (Colorado): a three-stage moon rocket with roll-pattern paint, two boosters,
//            red fins and an escape tower
//   retro    (Mojave):   a 1950s rocket: a fat cigar body, big swept fins and portholes
//   starship (Moon):     a stainless steel ship with flaps, a heat shield and six engines
//   colony   (Mars):     a white heavy lifter with side boosters, grid fins and legs
// Each one carries hidden engine flames (rocket.userData.flame) for take-off and landing.
import * as THREE from 'three';
import { box, cyl, mat } from './models.js';

const mesh = (geo, color, opts) => { const m = new THREE.Mesh(geo, mat(color, opts)); m.castShadow = true; m.receiveShadow = true; return m; };
// a smooth turned shape from [radius, height] pairs
const lathe = (pts, color, opts, seg = 24) => mesh(new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg), color, opts);
// a pointed nose cone (ogive) from radius r at y0 up to a point h above
const ogive = (r, y0, h, color, opts, k = 0.55) => {
  const pts = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push([Math.max(0.001, r * Math.pow(1 - t, k) * (1 - t * 0.08)), y0 + h * t]); }
  return lathe(pts, color, opts);
};
// a flared engine bell hanging below y
const bell = (r, h, y, color = 0x3a3d44) => lathe([[r * 0.45, y], [r * 0.5, y - h * 0.25], [r * 0.7, y - h * 0.65], [r, y - h]], color, { metalness: 0.75, roughness: 0.35, side: THREE.DoubleSide }, 16);
// a swept fin: root against the body at radius rad, pointing out at angle a
function fin(rad, a, y, root, span, sweep, tip, thick, color, opts) {
  const s = new THREE.Shape();
  s.moveTo(0, 0); s.lineTo(span, -sweep); s.lineTo(span, -sweep + tip); s.lineTo(0, root); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false }); g.translate(0, 0, -thick / 2);
  const m = mesh(g, color, opts);
  m.position.set(Math.cos(a) * rad, y, Math.sin(a) * rad); m.rotation.y = -a;
  return m;
}
// a stripe of paint round part of the body (theta0..theta0+len, radians)
const panel = (r, h, y, color, t0 = 0, len = Math.PI * 2, opts) => { const m = mesh(new THREE.CylinderGeometry(r, r, h, 24, 1, true, t0, len), color, { side: THREE.DoubleSide, ...opts }); m.position.y = y + h / 2; return m; };
const porthole = (r, y, a, size = 0.11) => {
  const g = new THREE.Group();
  const rim = mesh(new THREE.CylinderGeometry(size * 1.3, size * 1.3, 0.04, 14), 0xd8dce2, { metalness: 0.8, roughness: 0.25 }); rim.rotation.z = Math.PI / 2;
  const glass = mesh(new THREE.CylinderGeometry(size, size, 0.05, 14), 0x9fd8ff, { emissive: 0x4fb8ff, emissiveIntensity: 0.4, roughness: 0.1 }); glass.rotation.z = Math.PI / 2; glass.position.x = 0.01;
  g.add(rim, glass); g.position.set(Math.cos(a) * r, y, Math.sin(a) * r); g.rotation.y = -a;
  return g;
};

// engine flames: a hot white core in a long orange plume, hidden until lift-off
function flames(spots, len = 3) {
  const g = new THREE.Group();
  const outer = new THREE.MeshBasicMaterial({ color: 0xff9c37, transparent: true, opacity: 0.86, blending: THREE.AdditiveBlending, depthWrite: false });
  const inner = new THREE.MeshBasicMaterial({ color: 0xfff8db, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const [x, z, r] of spots) {
    const o = new THREE.Mesh(new THREE.ConeGeometry(r, len, 14, 1, true), outer); o.rotation.x = Math.PI; o.position.set(x, -len / 2, z);
    const c = new THREE.Mesh(new THREE.ConeGeometry(r * 0.55, len * 0.55, 12, 1, true), inner); c.rotation.x = Math.PI; c.position.set(x, -len * 0.275, z);
    g.add(o, c); // the brighter inner flame reads clearly against any world palette
  }
  g.visible = false;
  return g;
}

const STYLES = {
  classic(color) {
    const r = new THREE.Group(), W = 0xf6f5f0, K = 0x1f2228, RED = 0xd9452f, SIL = 0xc9ced6;
    const metal = { metalness: 0.6, roughness: 0.3 };
    // first stage with the black-and-white roll pattern, a skirt and five engines
    r.add(lathe([[0.7, 0.42], [0.64, 0.6], [0.62, 0.62]], K, metal));
    r.add(cyl(0.62, 0.62, 2.5, W, 0, 0.6, 0, 28));
    for (let q = 0; q < 4; q++) r.add(panel(0.625, 1.0, q % 2 ? 0.6 : 1.6, K, q * Math.PI / 2, Math.PI / 2));
    r.add(cyl(0.64, 0.64, 0.14, K, 0, 3.1, 0, 28));                                          // interstage
    // second stage, a coloured band and gold foil
    r.add(cyl(0.56, 0.6, 0.18, SIL, 0, 3.24, 0, 28, metal));
    r.add(cyl(0.56, 0.56, 1.5, W, 0, 3.42, 0, 28));
    r.add(cyl(0.57, 0.57, 0.22, color, 0, 3.9, 0, 28));
    r.add(cyl(0.57, 0.57, 0.12, 0xd8a83a, 0, 4.85, 0, 28, { metalness: 0.9, roughness: 0.25 }));
    // the capsule and its escape tower
    r.add(lathe([[0.56, 4.97], [0.48, 5.2], [0.3, 5.7], [0.12, 5.85], [0.001, 5.9]], SIL, metal));
    for (let k = 0; k < 3; k++) r.add(porthole(0.42, 5.32, k * 2.1 + 0.4, 0.06));
    // One bright blue viewport gives the classic launcher the icon's friendly look.
    r.add(porthole(0.575, 4.48, Math.PI / 4, 0.13));
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const rod = cyl(0.025, 0.025, 0.75, RED, Math.cos(a) * 0.1, 5.82, Math.sin(a) * 0.1, 6); rod.rotation.z = Math.cos(a) * 0.12; rod.rotation.x = -Math.sin(a) * 0.12; r.add(rod); }
    r.add(cyl(0.07, 0.07, 0.35, RED, 0, 6.5, 0, 10)); r.add(ogive(0.07, 6.85, 0.35, RED));
    // four red fins and the engines
    for (let k = 0; k < 4; k++) r.add(fin(0.6, k * Math.PI / 2 + Math.PI / 4, 0.45, 0.9, 0.55, 0.25, 0.4, 0.06, RED));
    for (const [x, z] of [[0, 0], [0.3, 0.3], [-0.3, 0.3], [0.3, -0.3], [-0.3, -0.3]]) { const b = bell(0.2, 0.45, 0.45); b.position.set(x, 0, z); r.add(b); }
    // two strap-on boosters
    for (const s of [-1, 1]) {
      const x = s * 0.88;
      r.add(cyl(0.24, 0.24, 2.3, W, x, 0.55, 0, 18));
      r.add(cyl(0.25, 0.25, 0.12, RED, x, 2.4, 0, 18));
      const nose = ogive(0.24, 2.85, 0.6, RED); nose.position.x = x; r.add(nose);
      const b = bell(0.17, 0.35, 0.55); b.position.x = x; r.add(b);
      for (const y of [0.9, 2.5]) r.add(box(0.28, 0.07, 0.08, SIL, s * 0.68, y, 0));
      r.add(fin(0.24, s > 0 ? 0 : Math.PI, 0.55, 0.7, 0.35, 0.2, 0.3, 0.05, RED));
    }
    r.userData.flame = flames([[0, 0, 0.32], [0.3, 0.3, 0.16], [-0.3, 0.3, 0.16], [0.3, -0.3, 0.16], [-0.3, -0.3, 0.16], [0.88, 0, 0.2], [-0.88, 0, 0.2]], 3.2);
    r.userData.flame.position.y = 0.05; r.add(r.userData.flame);
    return r;
  },

  retro(color) {
    const r = new THREE.Group(), CREAM = 0xf4ecd8, CHROME = 0xe6e9ee, ch = { metalness: 0.95, roughness: 0.15 };
    // a fat cigar body that swells in the middle, with chrome bands
    r.add(lathe([[0.42, 0.55], [0.6, 0.9], [0.72, 1.6], [0.75, 2.4], [0.72, 3.2], [0.62, 3.9], [0.45, 4.6], [0.25, 5.3], [0.08, 5.9], [0.001, 6.1]], CREAM, { roughness: 0.35 }, 32));
    r.add(lathe([[0.425, 0.53], [0.61, 0.88], [0.725, 1.6], [0.755, 2.3], [0.74, 2.3], [0.71, 1.6], [0.6, 0.9], [0.41, 0.55]], color, { roughness: 0.3, side: THREE.DoubleSide }, 32));
    r.add(lathe([[0.455, 4.55], [0.27, 5.25], [0.085, 5.88], [0.001, 6.12]], 0xd9452f, { roughness: 0.3 }, 32));
    r.add(lathe([[0.63, 3.88], [0.6, 4.02], [0.59, 4.02], [0.62, 3.88]], 0xd9452f, { side: THREE.DoubleSide }, 32));
    for (const [y, rr] of [[2.35, 0.765], [3.85, 0.64]]) { const b = mesh(new THREE.TorusGeometry(rr, 0.04, 6, 32), CHROME, ch); b.rotation.x = Math.PI / 2; b.position.y = y; r.add(b); }
    // a chrome needle on the nose and a red tip light
    r.add(cyl(0.015, 0.05, 0.9, CHROME, 0, 6.0, 0, 8, ch));
    r.add(mesh(new THREE.SphereGeometry(0.06, 10, 8), 0xff4a3a, { emissive: 0xff2a1a, night: 2.2 }).translateY(6.92));
    // portholes down one side
    for (const [y, rr] of [[3.3, 0.7], [2.8, 0.74], [2.3, 0.75]]) r.add(porthole(rr, y, Math.PI / 4, 0.13));
    // three big swept fins down to the ground, with chrome tips
    for (let k = 0; k < 3; k++) {
      const a = k * Math.PI * 2 / 3 + Math.PI / 4;
      r.add(fin(0.55, a, 0.05, 1.6, 0.95, -0.15, 0.55, 0.08, color, { roughness: 0.3 }));
      const tipBall = mesh(new THREE.SphereGeometry(0.07, 10, 8), CHROME, ch); tipBall.position.set(Math.cos(a) * 1.5, 0.08, Math.sin(a) * 1.5); r.add(tipBall);
    }
    const b = bell(0.38, 0.5, 0.6, 0x4a4d55); r.add(b);
    r.userData.flame = flames([[0, 0, 0.42]], 3.4);
    r.userData.flame.position.y = 0.15; r.add(r.userData.flame);
    return r;
  },

  starship(color) {
    const r = new THREE.Group(), ST = { metalness: 0.45, roughness: 0.3 }, TILE = 0x23262c;
    color = 0xd3d8de;   // bright brushed steel
    r.add(cyl(0.85, 0.85, 6.0, color, 0, 0.4, 0, 30, ST));
    // weld seams every so often, and the black heat shield down the windward side
    for (let y = 0.9; y < 6.3; y += 0.55) { const s = mesh(new THREE.TorusGeometry(0.852, 0.012, 4, 36), 0x9aa0a8, ST); s.rotation.x = Math.PI / 2; s.position.y = y; r.add(s); }
    r.add(panel(0.865, 5.6, 0.6, TILE, Math.PI * 0.72, Math.PI * 0.56));
    // the nose
    const nose = ogive(0.85, 6.4, 2.0, color, ST, 0.6); r.add(nose);
    const ns = mesh(new THREE.CylinderGeometry(0.4, 0.86, 1.6, 30, 1, true, Math.PI * 0.72, Math.PI * 0.56), TILE, { side: THREE.DoubleSide }); ns.position.y = 7.1; r.add(ns);
    // flaps: small ones by the nose, big ones at the tail, tilted out a little
    for (const s of [-1, 1]) {
      const fw = fin(0.8, s > 0 ? 0 : Math.PI, 6.55, 0.9, 0.55, 0.15, 0.5, 0.07, color, ST); fw.rotation.z = s * 0.08; r.add(fw);
      const aft = fin(0.8, s > 0 ? 0 : Math.PI, 0.5, 1.7, 0.85, 0.25, 1.2, 0.09, color, ST); aft.rotation.z = s * 0.05; r.add(aft);
      r.add(box(0.12, 0.25, 0.3, TILE, s * 0.86, 6.3, 0));   // flap hinge
    }
    // a stripe of windows and six engines: three small in the middle, three big outside
    for (let k = -2; k <= 2; k++) r.add(porthole(0.84, 6.0, Math.PI * 0.25 + k * 0.16, 0.07));
    for (let k = 0; k < 3; k++) { const a = k * 2.094; const b = bell(0.16, 0.35, 0.42); b.position.set(Math.cos(a) * 0.25, 0, Math.sin(a) * 0.25); r.add(b); }
    for (let k = 0; k < 3; k++) { const a = k * 2.094 + 1.047; const b = bell(0.28, 0.42, 0.42); b.position.set(Math.cos(a) * 0.55, 0, Math.sin(a) * 0.55); r.add(b); }
    r.add(cyl(0.86, 0.8, 0.08, 0x3a3d44, 0, 0.36, 0, 30, ST));
    r.userData.flame = flames([...[0, 1, 2].map(k => [Math.cos(k * 2.094) * 0.25, Math.sin(k * 2.094) * 0.25, 0.15]), ...[0, 1, 2].map(k => [Math.cos(k * 2.094 + 1.047) * 0.55, Math.sin(k * 2.094 + 1.047) * 0.55, 0.26])], 3.6);
    r.userData.flame.position.y = 0.0; r.add(r.userData.flame);
    return r;
  },

  colony(color) {
    const r = new THREE.Group(), WH = 0xf2f4f6, TILE = 0x22252a, metal = { metalness: 0.6, roughness: 0.3 };
    // the core: white, teal bands, black tiles on its belly, a window band up top
    r.add(cyl(0.66, 0.66, 5.0, WH, 0, 0.45, 0, 28));
    r.add(panel(0.675, 4.4, 0.7, TILE, Math.PI * 0.8, Math.PI * 0.4));
    for (const y of [1.2, 3.6]) r.add(cyl(0.68, 0.68, 0.28, color, 0, y, 0, 28));
    r.add(cyl(0.68, 0.68, 0.06, 0x7fe0ff, 0, 4.2, 0, 28, { emissive: 0x4fd0ff, night: 2.2 }));
    for (let k = 0; k < 4; k++) r.add(porthole(0.66, 4.65, Math.PI * 0.1 + k * 0.32, 0.08));
    const nose = ogive(0.66, 5.45, 1.5, WH, {}, 0.65); r.add(nose);
    r.add(ogive(0.2, 6.62, 0.36, color));
    // grid fins at the top of the core
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2, gf = new THREE.Group();
      gf.add(box(0.05, 0.42, 0.42, 0x8a8f99, 0, 0, 0, metal));
      for (let i = -1; i <= 1; i++) { gf.add(box(0.07, 0.02, 0.42, 0x5b6068, 0.01, 0.1 + i * 0.12, 0)); gf.add(box(0.07, 0.42, 0.02, 0x5b6068, 0.01, 0, i * 0.12)); }
      gf.position.set(Math.cos(a) * 0.72, 5.0, Math.sin(a) * 0.72); gf.rotation.y = -a; r.add(gf);
    }
    // two side boosters with teal noses, and folded landing legs on the core
    for (const s of [-1, 1]) {
      const x = s * 0.95;
      r.add(cyl(0.28, 0.28, 3.4, WH, x, 0.5, 0, 20));
      r.add(cyl(0.29, 0.29, 0.2, color, x, 3.0, 0, 20));
      const n = ogive(0.28, 3.9, 0.75, color); n.position.x = x; r.add(n);
      const b = bell(0.2, 0.38, 0.5); b.position.x = x; r.add(b);
      for (const y of [1.0, 3.3]) r.add(box(0.3, 0.08, 0.1, 0x8a8f99, s * 0.72, y, 0, metal));
    }
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; const leg = box(0.1, 1.5, 0.16, TILE, Math.cos(a) * 0.68, 0.35, Math.sin(a) * 0.68); leg.rotation.y = -a; r.add(leg); }
    // engines and a glowing ring round them
    for (const [x, z] of [[0, 0], [0.32, 0], [-0.32, 0], [0, 0.32], [0, -0.32]]) { const b = bell(0.18, 0.42, 0.45); b.position.set(x, 0, z); r.add(b); }
    const ring = mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 30), 0x7fe0ff, { emissive: 0x4fd0ff, night: 2.2 }); ring.rotation.x = Math.PI / 2; ring.position.y = 0.5; r.add(ring);
    r.userData.flame = flames([[0, 0, 0.3], [0.32, 0, 0.15], [-0.32, 0, 0.15], [0, 0.32, 0.15], [0, -0.32, 0.15], [0.95, 0, 0.22], [-0.95, 0, 0.22]], 3.4);
    r.userData.flame.position.y = 0.05; r.add(r.userData.flame);
    return r;
  },
};

const SIZE = { classic: 1.22, retro: 1.2, starship: 1.08, colony: 1.15 };
// wrapped in an outer group: the pad grows the rocket by scaling that group's height
export function buildRocket(style, color) {
  const inner = (STYLES[style] || STYLES.classic)(color);
  inner.scale.setScalar(SIZE[style] || 1);
  const outer = new THREE.Group(); outer.add(inner);
  outer.userData.flame = inner.userData.flame;
  return outer;
}
