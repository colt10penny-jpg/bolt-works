// Low-poly models built from simple shapes. Each factory model is a slot:
// replace a builder function with a loaded 3D model later without touching game logic.
import * as THREE from 'three';

import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { withDetail } from './surface.js';

// Materials: physically based, so light, shadow and reflections look solid.
// Glass and metal colours get shinier materials automatically; glass glows warm at night.
const GLASS = new Set([0x9fd6ff, 0xd8ecff, 0x9fe8ff]);
const METAL = new Set([0x8a8f99, 0x5b5f66, 0xdddddd, 0xd9d9d9, 0xcfd3da, 0xd8d8de, 0xd9d9de, 0xb9b4a8]);
export const GLOW = { glass: [], lit: [], night: [] };   // materials the day/night cycle lights up
const matCache = new Map();
export function mat(color, opts = {}) {
  // windows: some lit at night and some dark, so buildings look lived in
  const glassVar = GLASS.has(color) && !opts.emissive ? Math.floor(Math.random() * 3) : 0;
  const key = color + JSON.stringify(opts) + glassVar;
  if (matCache.has(key)) return matCache.get(key);
  let m;
  if (opts.night) {
    // lights that only come on after dark (headlights, lamps)
    const { night, ...o } = opts;
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissiveIntensity: 0, ...o });
    m.userData.night = night; GLOW.night.push(m);
  } else if (GLASS.has(color) && !opts.emissive) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.08, metalness: 0.55, emissive: 0xffc98a, emissiveIntensity: 0, ...opts });
    m.userData.glow = [0.75, 0.35, 0.05][glassVar];
    GLOW.glass.push(m);
  } else if (METAL.has(color)) {
    m = withDetail(new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.6, ...opts }), 0.6);
  } else {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
    if (opts.emissive) { m.userData.baseGlow = opts.emissiveIntensity ?? 1; GLOW.lit.push(m); }
    else if (!opts.transparent) withDetail(m);
  }
  matCache.set(key, m);
  return m;
}

// Boxes big enough to notice get softly rounded edges that catch the light.
export let roundEdges = true;
export function setRoundEdges(on) { roundEdges = on; }
function boxGeo(w, h, d) {
  const m = Math.min(w, h, d);
  if (!roundEdges || m < 0.3) return new THREE.BoxGeometry(w, h, d);
  return new RoundedBoxGeometry(w, h, d, 2, Math.min(0.1, m * 0.14));
}
export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// plain sharp box, for road paint and other flat things
export function flatBox(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = false; m.receiveShadow = true;
  return m;
}
export function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 12, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
// Triangular roof ridge running along Z: width w, height h, length d.
function prism(w, h, d, color, x, y, z) {
  const s = new THREE.Shape();
  s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.closePath(); // sawtooth: vertical glazed face on +x
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false });
  g.translate(0, 0, -d / 2);
  const m = new THREE.Mesh(g, mat(color));
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function windows(group, count, w, y, z, color, spacing, x0) {
  for (let i = 0; i < count; i++) group.add(box(w, 0.7, 0.08, color, x0 + i * spacing, y, z, color === 0xffb347 ? { emissive: 0xff8a1f, emissiveIntensity: 0.6 } : undefined));
}

const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  return f > 0 ? c.lerp(new THREE.Color(0xffffff), f).getHex() : c.multiplyScalar(1 + f).getHex();
};

// Each builder returns { group, anim(t, dt), top } where top is the label anchor height.
// the open top of a chimney: a dark hole inside a little rim, so smoke comes out of it
function stackHole(g, x, y, z, r) {
  const hole = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.78, r * 0.78, 0.03, 16), mat(0x17181b, { roughness: 1 }));
  hole.position.set(x, y + 0.006, z); g.add(hole);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r * 0.9, r * 0.12, 6, 18), mat(0x4a4c52, { roughness: 0.8 }));
  rim.rotation.x = Math.PI / 2; rim.position.set(x, y + 0.02, z); g.add(rim);
}
export const BUILDERS = {
  mine(color) {
    const g = new THREE.Group();
    // ore piles
    const pile = (x, z, r, h, c) => {
      const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), mat(c, { flatShading: true }));
      m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; g.add(m);
    };
    pile(-2.4, 1.6, 1.5, 1.4, 0x8a5a3c); pile(-1.2, 2.6, 1.0, 0.9, 0x9b6a48); pile(2.6, 2.4, 1.2, 1.1, 0x7d5236);
    // shaft house + headframe with a spinning wheel
    g.add(box(3.2, 2.0, 2.6, color, 0.6, 0, -1.6));
    g.add(box(3.4, 0.25, 2.8, shade(color, -0.35), 0.6, 2.0, -1.6));
    g.add(box(0.9, 1.5, 0.08, 0x2e2620, 0.2, 0, -0.28));
    for (const [x, z] of [[-0.1, -2.6], [1.3, -2.6], [-0.1, -0.6], [1.3, -0.6]]) g.add(box(0.18, 5.2, 0.18, 0x5b5f66, x, 0, z));
    g.add(box(1.6, 0.18, 2.2, 0x5b5f66, 0.6, 5.2, -1.6));
    const wheel = new THREE.Group();
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.09, 6, 16), mat(0x3a3f48));
    wheel.add(rim);
    for (let i = 0; i < 4; i++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.08, 0.08), mat(0x3a3f48)); sp.rotation.z = i * Math.PI / 4; wheel.add(sp); }
    wheel.position.set(0.6, 5.9, -1.6);
    wheel.traverse(o => { if (o.isMesh) o.castShadow = true; });
    g.add(wheel);
    // ore cart on rails
    g.add(box(4.6, 0.06, 0.5, 0x5b5f66, 0.4, 0, 1.0));
    const cart = new THREE.Group();
    cart.add(box(0.8, 0.5, 0.55, 0x4a4f57, 0, 0.12, 0));
    const load = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.3, 6), mat(0x8a5a3c, { flatShading: true }));
    load.position.y = 0.75; cart.add(load);
    cart.position.set(0, 0, 1.0);
    g.add(cart);
    return {
      group: g, top: 7,
      anim(t, dt) { wheel.rotation.z -= dt * 2.5; cart.position.x = 0.4 + Math.sin(t * 0.9) * 1.8; },
    };
  },

  power(color) {
    const g = new THREE.Group();
    // hyperbolic cooling tower
    const pts = [];
    for (let i = 0; i <= 10; i++) { const y = i * 0.6; const r = 1.9 - 0.9 * Math.sin((i / 10) * Math.PI * 0.85); pts.push(new THREE.Vector2(r, y)); }
    const tower = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), mat(0xe9e6df, { side: THREE.DoubleSide }));
    tower.position.set(-1.6, 0, -1.2); tower.castShadow = true; tower.receiveShadow = true;
    g.add(tower);
    // the tower's open mouth: a dark hollow inside its rim
    { const rim = new THREE.Mesh(new THREE.TorusGeometry(1.49, 0.1, 6, 24), mat(0xcfcac0)); rim.rotation.x = Math.PI / 2; rim.position.set(-1.6, 6.0, -1.2); g.add(rim);
      const hole = new THREE.Mesh(new THREE.CircleGeometry(1.36, 24), mat(0x3a3b3e, { roughness: 1 })); hole.rotation.x = -Math.PI / 2; hole.position.set(-1.6, 5.2, -1.2); g.add(hole); }
    // turbine hall + transformer yard
    g.add(box(3.4, 2.4, 3.4, color, 2.0, 0, -0.4));
    g.add(box(3.6, 0.25, 3.6, shade(color, -0.35), 2.0, 2.4, -0.4));
    for (let i = 0; i < 3; i++) g.add(box(0.7, 0.7, 0.08, 0xd8ecff, 1.0 + i * 1.0, 1.2, 1.32));
    for (let i = 0; i < 3; i++) g.add(box(0.7, 1.0, 0.7, 0x8a8f99, -2.6 + i * 1.1, 0, 2.6));
    for (const x of [-2.6, -1.5, -0.4]) g.add(box(0.08, 0.5, 0.08, 0xd9482b, x, 1.0, 2.6));
    return { group: g, top: 7, smoke: [new THREE.Vector3(-1.6, 6.1, -1.2)], steam: true };
  },

  datacenter(color) {
    const g = new THREE.Group();
    g.add(box(6.2, 2.2, 4.6, color, 0, 0, -0.3));
    g.add(box(6.4, 0.2, 4.8, shade(color, -0.4), 0, 2.2, -0.3));
    // front panel stripes and blinking server lights
    const lights = [];
    for (let i = 0; i < 6; i++) {
      g.add(box(0.7, 1.6, 0.08, shade(color, -0.25), -2.5 + i * 1.0, 0.2, 1.97));
      for (let k = 0; k < 3; k++) {
        const l = box(0.18, 0.08, 0.06, 0x5fd3ff, -2.5 + i * 1.0, 0.5 + k * 0.45, 2.03, { emissive: 0x2fb6ff, emissiveIntensity: 1 });
        l.material = l.material.clone();
        lights.push(l); g.add(l);
      }
    }
    // rooftop cooling fans
    const fans = [];
    for (let i = 0; i < 3; i++) {
      g.add(cyl(0.65, 0.65, 0.3, 0x8a8f99, -1.9 + i * 1.9, 2.4, -0.8, 14));
      const fan = new THREE.Group();
      for (let b = 0; b < 3; b++) { const bl = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.04, 0.22), mat(0x2a2d33)); bl.rotation.y = b * Math.PI / 3; fan.add(bl); }
      fan.position.set(-1.9 + i * 1.9, 2.75, -0.8);
      fans.push(fan); g.add(fan);
    }
    return {
      group: g, top: 5.4,
      anim(t, dt) {
        fans.forEach((f, i) => { f.rotation.y += dt * (6 + i); });
        lights.forEach((l, i) => { l.material.emissiveIntensity = (Math.sin(t * 7 + i * 1.7) > 0.2) ? 1.2 : 0.1; });
      },
    };
  },

  furnace(color) {
    const g = new THREE.Group();
    g.add(box(6, 3.2, 4.6, color, 0, 0, 0));
    g.add(box(6.3, 0.35, 4.9, shade(color, -0.35), 0, 3.2, 0));
    windows(g, 3, 1.1, 1.1, 2.32, 0xffb347, 1.7, -1.7);
    g.add(box(1.8, 2.2, 0.1, 0x3b2a24, 2.1 - 4.2, 0, 2.32));
    const stacks = [];
    for (const [x, h] of [[-1.6, 5.2], [0.2, 4.2]]) {
      g.add(cyl(0.48, 0.55, h, shade(color, -0.3), x, 3.5, -1.2));
      g.add(cyl(0.52, 0.52, 0.35, 0xf3efe6, x, 3.5 + h - 1.2, -1.2));
      stackHole(g, x, 3.5 + h, -1.2, 0.48);
      stacks.push(new THREE.Vector3(x, 3.5 + h + 0.05, -1.2));
    }
    g.add(box(1.4, 1, 1.4, 0x8a8f99, 2, 3.55, -0.9));
    return { group: g, top: 9, smoke: stacks };
  },

  press(color) {
    const g = new THREE.Group();
    g.add(box(6.2, 2.7, 4.8, color, 0, 0, 0));
    g.add(box(6.4, 0.3, 5, shade(color, -0.35), 0, 2.7, 0));
    g.add(box(2.4, 2.1, 0.1, shade(color, -0.45), -1.4, 0, 2.42));
    for (let i = 0; i < 5; i++) g.add(box(2.4, 0.06, 0.12, shade(color, -0.25), -1.4, 0.35 + i * 0.38, 2.45));
    windows(g, 2, 0.9, 1.2, 2.42, 0xd8ecff, 1.3, 0.9);
    g.add(box(1.2, 0.7, 1.2, 0xdde2e8, -2, 3, -1.2));
    g.add(box(1.2, 0.7, 1.2, 0xdde2e8, -0.5, 3, -1.2));
    // stamping tower with a moving ram
    g.add(box(1.8, 2.6, 1.8, shade(color, -0.2), 1.9, 3, -0.6));
    const ram = box(1.2, 0.7, 1.2, 0xe8553a, 1.9, 0, -0.6);
    g.add(ram);
    return {
      group: g, top: 6.6,
      anim(t) { ram.position.y = 5.6 + 0.35 + Math.abs(Math.sin(t * 3)) * 0.9; },
    };
  },

  gear(color) {
    const g = new THREE.Group();
    g.add(box(6.2, 2.4, 5.2, color, 0, 0, 0));
    for (let i = 0; i < 3; i++) {
      g.add(prism(2.07, 1.3, 5.2, shade(color, -0.25), -2.07 + i * 2.07, 2.4, 0));
      g.add(box(0.06, 1.2, 4.9, 0x9fd6ff, -2.07 + i * 2.07 + 1.04, 2.4, 0));
    }
    g.add(box(1.6, 1.8, 0.1, 0x5a4012, -1.6, 0, 2.62));
    windows(g, 2, 0.9, 1.0, 2.62, 0xfff3d6, 1.3, 0.6);
    // big rotating gear sign on the front
    const gear = new THREE.Group();
    const disk = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.25, 16), mat(0x8a8f99));
    disk.rotation.x = Math.PI / 2; disk.castShadow = true;
    gear.add(disk);
    for (let i = 0; i < 10; i++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.38, 0.25), mat(0x8a8f99));
      const a = (i / 10) * Math.PI * 2;
      tooth.position.set(Math.cos(a) * 0.98, Math.sin(a) * 0.98, 0);
      tooth.rotation.z = a;
      gear.add(tooth);
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 10), mat(0x3a3f48));
    hub.rotation.x = Math.PI / 2; gear.add(hub);
    gear.position.set(2.1, 3.6, 2.75);
    g.add(gear);
    return { group: g, top: 6.2, anim(t, dt) { gear.rotation.z -= dt * 1.2; } };
  },

  engine(color) {
    const g = new THREE.Group();
    g.add(box(5, 3, 5.2, color, -0.9, 0, 0));
    g.add(box(5.2, 0.3, 5.4, shade(color, -0.35), -0.9, 3, 0));
    windows(g, 3, 0.9, 1.4, 2.62, 0xece7ff, 1.4, -2.3);
    g.add(box(1.6, 2, 0.1, shade(color, -0.5), -0.9, 0, 2.62));
    // tanks
    for (const z of [-1.3, 1.1]) {
      g.add(cyl(0.9, 0.9, 2.8, 0xd5d9e0, 2.6, 0, z, 16));
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd5d9e0));
      dome.position.set(2.6, 2.8, z); dome.castShadow = true; g.add(dome);
    }
    g.add(box(1.4, 0.25, 0.25, 0x8a8f99, 1.5, 2.2, -1.3));
    g.add(box(1.4, 0.25, 0.25, 0x8a8f99, 1.5, 1.6, 1.1));
    // conveyor with moving crates
    g.add(box(4.6, 0.35, 0.8, 0x3a3f48, -0.9, 0, 3.3));
    const crates = [];
    for (let i = 0; i < 4; i++) { const c = box(0.5, 0.45, 0.5, 0xc8a26b, 0, 0.35, 3.3); crates.push(c); g.add(c); }
    return {
      group: g, top: 6.8,
      anim(t) { crates.forEach((c, i) => { c.position.x = -3 + (((t * 0.8 + i * 1.15) % 4.6)); }); },
    };
  },

  turbine(color) {
    const g = new THREE.Group();
    g.add(box(5.4, 3.4, 5, color, -0.5, 0, 0));
    g.add(box(5.6, 0.3, 5.2, shade(color, -0.35), -0.5, 3.4, 0));
    g.add(box(5.42, 0.3, 5.02, 0xf3efe6, -0.5, 2.4, 0));
    windows(g, 3, 0.9, 1.2, 2.52, 0xe6fffb, 1.4, -1.9);
    // big turbine on a frame at the side
    g.add(box(0.5, 4.2, 0.5, 0x8a8f99, 2.9, 0, 0));
    const rotor = new THREE.Group();
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.6, 12), mat(0xf3efe6));
    hub.rotation.x = Math.PI / 2; rotor.add(hub);
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.35, 1.6, 0.12), mat(0xf3efe6));
      const a = (i / 5) * Math.PI * 2;
      blade.position.set(Math.sin(a) * 0.95, Math.cos(a) * 0.95, 0);
      blade.rotation.z = -a; blade.castShadow = true;
      rotor.add(blade);
    }
    rotor.position.set(2.9, 4.4, 0.5);
    g.add(rotor);
    return { group: g, top: 7, anim(t, dt) { rotor.rotation.z -= dt * 3; } };
  },

  rocket(color) {
    const g = new THREE.Group();
    const hangar = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 5.6, 16, 1, false, 0, Math.PI), mat(color));
    hangar.geometry.rotateX(Math.PI / 2);
    hangar.geometry.rotateZ(Math.PI / 2);
    hangar.position.set(-1.2, 0, 0); hangar.castShadow = true; hangar.receiveShadow = true;
    g.add(hangar);
    g.add(box(2.6, 2, 0.1, 0x3a3f48, -1.2, 0, 2.8));
    // launch tower + rocket
    g.add(box(0.5, 6.5, 0.5, 0xe8553a, 2.9, 0, -1.4));
    for (let i = 0; i < 4; i++) g.add(box(1.4, 0.15, 0.15, 0xe8553a, 2.4, 1.2 + i * 1.5, -1.4));
    const rocket = new THREE.Group();
    rocket.add(cyl(0.6, 0.6, 4, 0xf7f7f7, 0, 0.6, 0, 14));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.4, 14), mat(0xe8553a));
    nose.position.y = 5.3; nose.castShadow = true; rocket.add(nose);
    rocket.add(cyl(0.62, 0.62, 0.4, 0x2f7fd1, 0, 3.2, 0, 14));
    for (let i = 0; i < 3; i++) {
      const fin = box(0.1, 1.1, 0.8, 0xe8553a, 0, 0.3, 0);
      const a = (i / 3) * Math.PI * 2;
      fin.position.x = Math.cos(a) * 0.65; fin.position.z = Math.sin(a) * 0.65;
      fin.rotation.y = -a;
      rocket.add(fin);
    }
    rocket.position.set(1.7, 0, -1.4);
    g.add(rocket);
    // scaffolding shown while no rocket is ready
    const scaffold = new THREE.Group();
    for (let i = 0; i < 4; i++) scaffold.add(box(1.5, 0.12, 1.5, 0xb9b4a8, 1.7, 0.6 + i * 1.3, -1.4));
    scaffold.add(box(0.12, 5.5, 0.12, 0xb9b4a8, 1.0, 0, -0.7), box(0.12, 5.5, 0.12, 0xb9b4a8, 2.4, 0, -2.1));
    g.add(scaffold);
    return { group: g, top: 7.6, rocket, scaffold };
  },
};

export function tree(scale = 1, color = 0x3f8f4a) {
  const g = new THREE.Group();
  g.add(cyl(0.18, 0.22, 0.8, 0x7a5230, 0, 0, 0, 6));
  const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 0), mat(color, { flatShading: true }));
  crown.position.y = 1.45; crown.castShadow = true;
  g.add(crown);
  g.scale.setScalar(scale);
  return g;
}

// ---- vehicles ----
// Built from lots of small parts, then merged into one mesh per material so a town
// full of traffic stays cheap to draw.
const TINT = 0x223140, TIRE = 0x1d1e22, TRIM = 0x2b2d33, CHROME = 0xd9d9de;
const glassMat = () => mat(TINT, { roughness: 0.12, metalness: 0.7 });
function mergeVehicle(g) {
  g.updateMatrixWorld(true);
  const byMat = new Map();
  g.traverse(o => {
    if (!o.isMesh) return;
    let geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material)) byMat.set(o.material, { geos: [], shadow: o.castShadow });
    byMat.get(o.material).geos.push(geo);
  });
  const out = new THREE.Group();
  for (const [m, { geos, shadow }] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), m);
    mesh.castShadow = shadow; mesh.receiveShadow = true;
    out.add(mesh);
    geos.forEach(x => x.dispose());
  }
  return out;
}
function wheel(g, x, z, r = 0.21, w = 0.16) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 14), mat(TIRE, { roughness: 0.9 }));
  t.rotation.x = Math.PI / 2; t.position.set(x, r, z); g.add(t);
  const side = Math.sign(z);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, 0.02, 10), mat(CHROME));
  hub.rotation.x = Math.PI / 2; hub.position.set(x, r, z + side * (w / 2 + 0.005)); g.add(hub);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.2, r * 0.2, 0.03, 8), mat(TRIM));
  cap.rotation.x = Math.PI / 2; cap.position.set(x, r, z + side * (w / 2 + 0.015)); g.add(cap);
}
// a slanted pane of glass across the car (front or back window)
function pane(g, x, y, h, lean, width) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, h, width), glassMat());
  m.position.set(x, y, 0); m.rotation.z = lean; g.add(m);
}
function lights(g, front, back, y, zs, w = 0.16) {
  for (const z of zs) {
    g.add(flatBox(0.05, 0.09, w, 0xfff6d8, front, y, z, { emissive: 0xfff0c0, night: 3 }));
    g.add(flatBox(0.05, 0.09, w, 0x8a1f1f, back, y, z, { emissive: 0xff2a1a, night: 2 }));
  }
}
function mirrors(g, x, y, half, color) {
  for (const sd of [-1, 1]) {
    g.add(flatBox(0.1, 0.08, 0.1, color, x, y, sd * (half + 0.05)));
  }
}

// box truck that carries goods between factories, pointing +x
// (flat = an open flatbed, for carrying goods you can see)
export function truck(color, flat = false) {
  const g = new THREE.Group();
  const W = 0.96;
  // chassis rail and bumpers
  g.add(flatBox(2.3, 0.12, 0.8, TRIM, -0.05, 0.2, 0));
  g.add(box(0.12, 0.16, W, TRIM, 1.2, 0.2, 0), box(0.1, 0.14, W - 0.1, TRIM, -1.2, 0.2, 0));
  // cargo box with a coloured stripe and roll-up door ribs at the back
  if (flat) {
    g.add(box(1.55, 0.1, W, 0x6b5a48, -0.42, 0.3, 0));                       // wooden deck
    for (const sd of [-1, 1]) for (let i = 0; i < 4; i++) g.add(flatBox(0.05, 0.22, 0.05, TRIM, -1.12 + i * 0.45, 0.4, sd * (W / 2 - 0.03)));   // stake posts
    g.add(box(0.06, 0.55, W, TRIM, 0.33, 0.38, 0));                          // headboard
  } else {
    g.add(box(1.5, 1.02, W, 0xf3f0e8, -0.42, 0.32, 0));
    for (const sd of [-1, 1]) g.add(flatBox(1.42, 0.14, 0.02, color, -0.42, 0.62, sd * (W / 2 + 0.005)));
    for (let i = 0; i < 4; i++) g.add(flatBox(0.02, 0.025, W - 0.16, 0xc9c5ba, -1.175, 0.45 + i * 0.2, 0));
  }
  // cab
  g.add(box(0.72, 0.62, W, color, 0.78, 0.3, 0));
  g.add(box(0.5, 0.36, W - 0.04, color, 0.66, 0.9, 0));
  pane(g, 0.97, 1.06, 0.36, 0.32, W - 0.16);
  for (const sd of [-1, 1]) g.add(flatBox(0.34, 0.24, 0.02, TINT, 0.7, 0.96, sd * (W / 2 - 0.01)));
  g.add(flatBox(0.03, 0.22, 0.5, TRIM, 1.15, 0.38, 0));                       // grille
  for (let i = 0; i < 3; i++) g.add(flatBox(0.035, 0.02, 0.46, CHROME, 1.155, 0.42 + i * 0.06, 0));
  mirrors(g, 1.0, 0.95, W / 2, TRIM);
  g.add(cyl(0.035, 0.035, 0.75, CHROME, 0.4, 0.55, W / 2 - 0.08, 8));           // exhaust stack
  g.add(flatBox(0.04, 0.1, 0.3, 0xf2f2f2, -1.205, 0.24, 0));                  // plate
  lights(g, 1.165, -1.2, 0.5, [-0.34, 0.34], 0.14);
  g.add(flatBox(0.16, 0.05, 0.16, 0xffa31a, 0.66, 1.26, 0, { emissive: 0xff8a00, night: 1.5 }));   // roof beacon
  for (const x of [-0.75, -0.3, 0.8]) for (const z of [-0.42, 0.42]) wheel(g, x, z, 0.23, 0.17);
  return mergeVehicle(g);
}

// ---- Mars vehicles: pressurised rovers and cargo crawlers on big mesh wheels ----
// a big open-mesh wheel with a dark tread band and a bright hub
function marsWheel(g, x, z, r = 0.28, w = 0.2) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 16), mat(0x9aa0a8, { roughness: 0.5, metalness: 0.5 }));
  t.rotation.x = Math.PI / 2; t.position.set(x, r, z); g.add(t);
  const tread = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 5, 18), mat(0x2a2d33, { roughness: 0.9 }));
  tread.position.set(x, r, z + Math.sign(z) * (w / 2 - 0.02)); g.add(tread);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.38, r * 0.38, w + 0.04, 10), mat(0x2fb5a0, { roughness: 0.4 }));
  hub.rotation.x = Math.PI / 2; hub.position.set(x, r, z); g.add(hub);
}
// a pressurised rover, pointing +x: a white rounded cabin with a big bubble windscreen,
// side portholes, a coloured stripe, an antenna and a small dish, on six mesh wheels
export function marsRover(color) {
  const g = new THREE.Group();
  const W = 0.92, BODY = 0xeef1f4;
  g.add(flatBox(2.0, 0.12, 0.7, 0x5b5f66, 0, 0.26, 0));                                    // chassis
  for (const x of [-0.75, 0, 0.75]) for (const z of [-0.5, 0.5]) { marsWheel(g, x, z, 0.24, 0.18); g.add(flatBox(0.08, 0.06, 0.32, 0x5b5f66, x, 0.32, z * 0.6)); }
  const cab = new THREE.Mesh(new RoundedBoxGeometry(1.8, 0.62, W, 3, 0.2), mat(BODY, { roughness: 0.4 }));
  cab.position.set(-0.05, 0.68, 0); cab.castShadow = true; g.add(cab);
  g.add(flatBox(1.82, 0.1, W + 0.02, color, -0.05, 0.6, 0));                                 // stripe
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 10, 0, Math.PI), glassMat());
  bubble.rotation.y = -Math.PI / 2; bubble.scale.set(1, 0.85, 1.1); bubble.position.set(0.8, 0.76, 0); g.add(bubble);
  for (const sd of [-1, 1]) for (const x of [-0.55, -0.15]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), glassMat()); p.rotation.x = Math.PI / 2; p.position.set(x, 0.78, sd * (W / 2 + 0.005)); g.add(p);
  }
  g.add(flatBox(0.36, 0.08, 0.5, 0x223f78, -0.55, 1.0, 0, { roughness: 0.3, metalness: 0.4 }));   // solar panel on the roof
  g.add(cyl(0.015, 0.015, 0.45, 0xd8dbe2, 0.25, 0.99, 0.25, 4));
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0xf2f2f0, { side: THREE.DoubleSide })); dish.position.set(0.25, 1.44, 0.25); dish.rotation.z = 0.6; g.add(dish);
  lights(g, 1.0, -1.0, 0.5, [-0.28, 0.28], 0.12);
  g.add(flatBox(0.12, 0.05, 0.12, 0xffa31a, 0.2, 1.0, -0.25, { emissive: 0xff8a00, night: 1.5 }));
  return mergeVehicle(g);
}
// a cargo crawler, pointing +x: a small pod cab up front and a long flat deck on eight
// mesh wheels (goods ride on the deck; see the cargo in world.js)
export function marsCrawler(color) {
  const g = new THREE.Group();
  const W = 0.96;
  g.add(flatBox(2.4, 0.14, 0.78, 0x5b5f66, -0.05, 0.28, 0));
  for (const x of [-1.0, -0.4, 0.2, 0.8]) for (const z of [-0.46, 0.46]) marsWheel(g, x, z, 0.22, 0.16);
  g.add(box(1.6, 0.1, W, 0x3a3f48, -0.42, 0.38, 0));                                        // the deck
  for (const sd of [-1, 1]) g.add(flatBox(1.6, 0.12, 0.05, color, -0.42, 0.48, sd * (W / 2 - 0.02)));   // coloured side rails
  const cab = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.62, W, 3, 0.18), mat(0xeef1f4, { roughness: 0.4 }));
  cab.position.set(0.8, 0.66, 0); cab.castShadow = true; g.add(cab);
  const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI), glassMat());
  bubble.rotation.y = -Math.PI / 2; bubble.scale.set(1, 0.9, 1.3); bubble.position.set(1.13, 0.74, 0); g.add(bubble);
  g.add(flatBox(0.72, 0.08, W + 0.02, color, 0.8, 0.5, 0));
  g.add(flatBox(0.12, 0.05, 0.12, 0xffa31a, 0.8, 1.0, 0, { emissive: 0xff8a00, night: 1.5 }));
  lights(g, 1.17, -1.25, 0.46, [-0.32, 0.32], 0.12);
  return mergeVehicle(g);
}

// ---- Moon vehicles ----
// a wire-mesh lunar wheel: a silvery mesh tyre with gold chevrons and a dark hub
function moonWheel(g, x, z, r = 0.3, w = 0.2) {
  const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, w, 18), mat(0xb9b6ac, { roughness: 0.6, metalness: 0.6 }));
  t.rotation.x = Math.PI / 2; t.position.set(x, r, z); g.add(t);
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2; const ch = flatBox(0.1, 0.03, w + 0.02, 0xc9a24a, x + Math.cos(a) * r, r + Math.sin(a) * r - 0.015, z, { metalness: 0.5, roughness: 0.4 }); ch.rotation.z = a + Math.PI / 2; g.add(ch); }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.32, r * 0.32, w + 0.05, 10), mat(0x2a2d33));
  hub.rotation.x = Math.PI / 2; hub.position.set(x, r, z); g.add(hub);
}
// a little astronaut sitting in a seat: white suit, life-support pack, gold visor
function astronaut(g, x, z) {
  g.add(flatBox(0.3, 0.06, 0.3, 0x5b5f66, x, 0.5, z), flatBox(0.06, 0.32, 0.3, 0x5b5f66, x - 0.16, 0.5, z));   // the seat
  g.add(box(0.26, 0.3, 0.24, 0xf4f4f0, x, 0.56, z), box(0.12, 0.26, 0.2, 0xe0e0dc, x - 0.17, 0.6, z));        // suit, backpack
  g.add(box(0.2, 0.08, 0.08, 0xf4f4f0, x + 0.12, 0.72, z + 0.09));                                             // an arm on the controls
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), mat(0xf6f6f2)); helmet.position.set(x, 0.98, z); g.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8, -Math.PI / 2, Math.PI, Math.PI * 0.25, Math.PI * 0.45), mat(0xd9a83a, { metalness: 0.9, roughness: 0.15 }));
  visor.position.set(x + 0.04, 0.98, z); g.add(visor);
}
// an open lunar buggy, pointing +x: a tube frame on four mesh wheels with bright fenders,
// two astronauts aboard, an umbrella antenna and a camera on the front
export function lunarBuggy(color) {
  const g = new THREE.Group();
  g.add(flatBox(1.9, 0.07, 0.8, 0x6a6e76, 0, 0.42, 0));                                             // chassis
  for (const x of [-0.7, 0.7]) for (const z of [-0.5, 0.5]) {
    moonWheel(g, x, z, 0.28, 0.18);
    const f = flatBox(0.62, 0.05, 0.24, color, x, 0.62, z); g.add(f);                                 // fender
    g.add(flatBox(0.05, 0.2, 0.05, 0x6a6e76, x, 0.42, z * 0.7));
  }
  astronaut(g, -0.1, -0.2); astronaut(g, -0.1, 0.22);
  g.add(box(0.36, 0.22, 0.6, 0xd9a83a, 0.68, 0.49, 0, { metalness: 0.7, roughness: 0.35 }));        // gold-foil battery box
  g.add(box(0.12, 0.12, 0.14, 0x2a2d33, 0.9, 0.78, 0.2), flatBox(0.03, 0.3, 0.03, 0x9aa0a8, 0.9, 0.49, 0.2));   // camera
  g.add(cyl(0.015, 0.015, 0.75, 0xd8dbe2, -0.75, 0.49, -0.3, 4));
  const dish = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.12, 14, 1, true), mat(0xf2f2ee, { side: THREE.DoubleSide }));
  dish.rotation.z = Math.PI; dish.position.set(-0.75, 1.3, -0.3); g.add(dish);
  g.add(box(0.3, 0.14, 0.5, 0xd8dbe2, -0.75, 0.49, 0.05));                                          // tool rack
  lights(g, 0.96, -0.96, 0.46, [-0.26, 0.26], 0.1);
  return mergeVehicle(g);
}
// a lunar cargo hauler, pointing +x: a pressurised cab (a capsule lying across the front
// with a band of windows), gold-foil panels, and a long flat deck on six mesh wheels
export function lunarHauler(color) {
  const g = new THREE.Group();
  const W = 0.96;
  g.add(flatBox(2.4, 0.12, 0.8, 0x6a6e76, -0.05, 0.26, 0));
  for (const x of [-1.0, -0.25, 0.6]) for (const z of [-0.5, 0.5]) moonWheel(g, x, z, 0.24, 0.16);
  g.add(box(1.6, 0.06, W, 0x9aa0a8, -0.42, 0.34, 0));                                               // the deck
  for (const sd of [-1, 1]) g.add(flatBox(1.6, 0.1, 0.05, color, -0.42, 0.4, sd * (W / 2 - 0.02)));
  const cab = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, W - 0.4, 6, 14), mat(0xf2f2ee, { roughness: 0.4 }));
  cab.rotation.x = Math.PI / 2; cab.position.set(0.8, 0.7, 0); g.add(cab);
  g.add(flatBox(0.08, 0.12, W - 0.2, 0x1c2f3a, 1.13, 0.72, 0));                                      // window band
  g.add(flatBox(0.4, 0.06, W - 0.1, color, 0.8, 1.02, 0));
  g.add(box(0.5, 0.2, 0.3, 0xd9a83a, 0.75, 0.3, 0.35, { metalness: 0.7, roughness: 0.35 }), box(0.5, 0.2, 0.3, 0xd9a83a, 0.75, 0.3, -0.35, { metalness: 0.7, roughness: 0.35 }));
  g.add(flatBox(0.12, 0.05, 0.12, 0xffa31a, 0.8, 1.08, 0, { emissive: 0xff8a00, night: 1.5 }));
  lights(g, 1.15, -1.25, 0.5, [-0.3, 0.3], 0.1);
  return mergeVehicle(g);
}

// ---- the Wild West: horse-drawn wagons, stagecoaches and riders, pointing +x ----
// a spoked wooden wagon wheel with an iron tyre, standing on the ground
function westWheel(g, x, z, r = 0.3, color = 0xb5532a) {
  const t = new THREE.Mesh(new THREE.TorusGeometry(r - 0.03, 0.035, 5, 18), mat(0x3a3020));
  t.position.set(x, r, z); g.add(t);
  for (let k = 0; k < 6; k++) { const sp = flatBox(0.035, (r - 0.04) * 2, 0.03, color, x, r - (r - 0.04), z); sp.rotation.z = (k / 6) * Math.PI; sp.position.set(x, r, z); g.add(sp); }
  g.add(cyl(0.06, 0.06, 0.08, 0x3a3020, x, r - 0.04, z, 8).rotateX(Math.PI / 2));
}
// a horse in harness at a trot, facing +x
function harnessHorse(g, x, z, coat = 0x7a4a2a) {
  const dark = new THREE.Color(coat).multiplyScalar(0.6).getHex();
  g.add(box(0.62, 0.26, 0.22, coat, x, 0.5, z));
  for (const [lx, lz, lean] of [[-0.22, -0.06, 0.25], [-0.22, 0.06, -0.2], [0.22, -0.06, -0.25], [0.22, 0.06, 0.2]]) { const l = box(0.06, 0.5, 0.06, lx > 0 ? coat : dark, x + lx, 0.02, z + lz); l.rotation.z = lean; g.add(l); }
  const neck = box(0.13, 0.36, 0.15, coat, x + 0.3, 0.62, z); neck.rotation.z = -0.65; g.add(neck);
  const head = box(0.28, 0.12, 0.13, coat, x + 0.5, 0.86, z); head.rotation.z = -0.4; g.add(head);
  g.add(box(0.05, 0.26, 0.05, dark, x + 0.33, 0.74, z));
  const tail = box(0.05, 0.3, 0.05, dark, x - 0.33, 0.38, z); tail.rotation.z = -0.4; g.add(tail);
  g.add(box(0.16, 0.06, 0.25, 0x3a2418, x + 0.08, 0.74, z));   // the collar and harness
}
// a figure in a hat sitting at the reins
function cowboy(g, x, y, z, shirt = 0x8a3a2a) {
  g.add(box(0.18, 0.26, 0.2, shirt, x, y, z), box(0.13, 0.13, 0.13, 0xd8a77a, x, y + 0.27, z));
  g.add(cyl(0.16, 0.16, 0.025, 0x5a3a22, x, y + 0.38, z, 12), cyl(0.07, 0.08, 0.1, 0x5a3a22, x, y + 0.4, z, 10));
}
// a freight wagon (flat = an open bed for the cargo you can see), or a covered prairie wagon
export function freightWagon(color, flat = false) {
  const g = new THREE.Group();
  g.add(flatBox(1.2, 0.08, 0.7, 0x5a3e26, -0.6, 0.3, 0));                                   // running gear
  g.add(box(1.25, 0.08, 0.86, 0x8a6a45, -0.6, 0.32, 0));                                    // bed: the deck top is at 0.4
  for (const sd of [-1, 1]) g.add(box(1.25, 0.16, 0.05, color, -0.6, 0.4, sd * 0.43));
  g.add(box(0.05, 0.16, 0.86, color, -1.22, 0.4, 0), box(0.05, 0.28, 0.86, color, 0.02, 0.4, 0));
  if (!flat) {
    // the canvas bonnet over hoops
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 1.3, 12, 1, true, 0, Math.PI), mat(0xf1e6c8, { side: THREE.DoubleSide }));
    cover.rotation.z = Math.PI / 2; cover.position.set(-0.6, 0.56, 0); g.add(cover);
    for (let k = 0; k < 4; k++) { const hp = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.02, 4, 12, Math.PI), mat(0xd8c49a)); hp.position.set(-1.2 + k * 0.4, 0.56, 0); hp.rotation.y = Math.PI / 2; g.add(hp); }
  }
  g.add(box(0.2, 0.06, 0.6, 0x6e4a2c, 0.05, 0.66, 0));                                       // the driver's bench
  cowboy(g, 0.05, 0.7, 0.1);
  westWheel(g, -1.0, -0.47, 0.32); westWheel(g, -1.0, 0.47, 0.32);
  westWheel(g, -0.2, -0.47, 0.24); westWheel(g, -0.2, 0.47, 0.24);
  g.add(flatBox(0.75, 0.04, 0.04, 0x5a3e26, 0.45, 0.42, 0));                                 // the tongue
  harnessHorse(g, 0.65, -0.2, 0x7a4a2a); harnessHorse(g, 0.65, 0.2, 0x5a3a26);
  g.add(flatBox(0.12, 0.12, 0.12, 0xfff1cf, 0.05, 0.85, -0.38, { emissive: 0xffc070, night: 2.4 }));   // a lantern
  return mergeVehicle(g);
}
// a stagecoach: a rounded painted body on leather springs, a luggage rail on top, a
// driver up front, four horses
export function stagecoach(color) {
  const g = new THREE.Group();
  g.add(flatBox(1.3, 0.06, 0.6, 0x3a2a1e, -0.55, 0.32, 0));
  g.add(box(0.9, 0.55, 0.72, color, -0.62, 0.42, 0));
  g.add(box(0.96, 0.06, 0.78, 0xc9a24a, -0.62, 0.97, 0));                                    // the gilt roof edge
  for (const sd of [-1, 1]) { g.add(flatBox(0.32, 0.24, 0.02, TINT, -0.62, 0.66, sd * 0.37)); g.add(flatBox(0.04, 0.5, 0.02, 0xc9a24a, -0.62, 0.44, sd * 0.375)); }
  for (const sd of [-1, 1]) for (let k = 0; k < 4; k++) g.add(flatBox(0.03, 0.12, 0.03, 0x3a2a1e, -0.95 + k * 0.22, 1.03, sd * 0.34));
  g.add(box(0.5, 0.18, 0.5, 0x8a6a45, -0.75, 1.03, 0));                                       // luggage
  g.add(box(0.25, 0.3, 0.62, shade(color, -0.25), -0.08, 0.5, 0));                            // the box seat
  cowboy(g, -0.08, 0.8, 0.12, 0x2a3a5a);
  westWheel(g, -0.95, -0.42, 0.33, 0xc9a24a); westWheel(g, -0.95, 0.42, 0.33, 0xc9a24a);
  westWheel(g, -0.2, -0.42, 0.25, 0xc9a24a); westWheel(g, -0.2, 0.42, 0.25, 0xc9a24a);
  harnessHorse(g, 0.4, -0.17, 0x2a2420); harnessHorse(g, 0.4, 0.17, 0x7a4a2a);
  harnessHorse(g, 0.95, -0.17, 0xd8c8b0); harnessHorse(g, 0.95, 0.17, 0x7a4a2a);
  g.scale.setScalar(0.9);
  return mergeVehicle(g);
}
// a light buckboard wagon with one horse, or (rider) a cowboy on horseback
export function buckboard(color, rider = false) {
  const g = new THREE.Group();
  if (rider) {
    harnessHorse(g, 0, 0, color);
    g.add(box(0.26, 0.06, 0.3, 0x5a2a1a, -0.02, 0.76, 0));
    cowboy(g, -0.02, 0.8, 0, [0x8a3a2a, 0x2a3a5a, 0xc9a24a][Math.floor(Math.random() * 3)]);
    return mergeVehicle(g);
  }
  g.add(box(0.85, 0.1, 0.62, 0x8a6a45, -0.45, 0.32, 0));
  for (const sd of [-1, 1]) g.add(box(0.85, 0.12, 0.04, color, -0.45, 0.42, sd * 0.31));
  g.add(box(0.2, 0.22, 0.56, 0x6e4a2c, -0.2, 0.42, 0));
  cowboy(g, -0.25, 0.66, 0.1); cowboy(g, -0.25, 0.66, -0.14, 0xd85a8a);
  g.add(box(0.3, 0.2, 0.3, 0xb88a5a, -0.7, 0.42, 0));
  for (const sd of [-1, 1]) { westWheel(g, -0.7, sd * 0.36, 0.27); westWheel(g, -0.15, sd * 0.36, 0.27); }
  g.add(flatBox(0.6, 0.03, 0.03, 0x5a3e26, 0.2, 0.42, 0.13), flatBox(0.6, 0.03, 0.03, 0x5a3e26, 0.2, 0.42, -0.13));
  harnessHorse(g, 0.5, 0, 0x7a4a2a);
  return mergeVehicle(g);
}

// a passenger car, pointing +x: sedans, hatchbacks, SUVs and pickups
const BODY = ['sedan', 'sedan', 'hatch', 'suv', 'pickup'];
let carN = 0;
export function car(color, kind = BODY[carN++ % BODY.length]) {
  const g = new THREE.Group();
  const W = 0.9, L = kind === 'hatch' ? 1.55 : kind === 'sedan' ? 1.8 : 1.85;
  const lift = kind === 'suv' || kind === 'pickup' ? 0.06 : 0;
  const base = 0.15 + lift, bodyH = kind === 'suv' ? 0.42 : 0.36;
  const f = L / 2, r = -L / 2;
  // body, with a dark sill and bumpers
  g.add(box(L, bodyH, W, color, 0, base + 0.04, 0));
  g.add(flatBox(L - 0.5, 0.06, W + 0.01, TRIM, 0, base + 0.02, 0));
  g.add(box(0.1, 0.12, W, TRIM, f - 0.02, base, 0), box(0.1, 0.12, W, TRIM, r + 0.02, base, 0));
  const top = base + 0.04 + bodyH;
  // the cabin: roof, windows all round, a slanted windscreen and rear window
  let cx, cl, ch = kind === 'suv' ? 0.4 : 0.34;
  if (kind === 'sedan') { cx = -0.1; cl = 0.82; }
  else if (kind === 'hatch') { cx = -0.18; cl = 0.82; }
  else if (kind === 'suv') { cx = -0.18; cl = 1.15; }
  else { cx = 0.18; cl = 0.62; }
  g.add(box(cl, ch, W - 0.06, TINT, cx, top - 0.02, 0, { roughness: 0.12, metalness: 0.7 }));
  g.add(box(cl - 0.08, 0.06, W - 0.04, color, cx, top + ch - 0.05, 0));       // roof
  for (const sd of [-1, 1]) g.add(flatBox(0.05, ch - 0.06, 0.02, color, cx + 0.02, top, sd * (W / 2 - 0.03)));   // door pillar
  pane(g, cx + cl / 2 + 0.07, top + ch / 2 - 0.02, ch * 0.95, 0.5, W - 0.14);
  if (kind === 'sedan') pane(g, cx - cl / 2 - 0.08, top + ch / 2 - 0.03, ch * 0.9, -0.55, W - 0.14);
  // details: door seams, handles, mirrors, grille, plate
  for (const sd of [-1, 1]) {
    g.add(flatBox(0.015, bodyH - 0.1, 0.01, TRIM, cx + 0.02, base + 0.09, sd * (W / 2 + 0.003)));
    for (const hx of [cx + 0.18, cx - 0.22]) g.add(flatBox(0.09, 0.025, 0.012, CHROME, hx, top - 0.1, sd * (W / 2 + 0.005)));
  }
  mirrors(g, cx + cl / 2 - 0.02, top + 0.02, W / 2, color);
  g.add(flatBox(0.02, 0.1, 0.36, TRIM, f + 0.035, base + 0.12, 0));
  g.add(flatBox(0.02, 0.07, 0.22, 0xf2f2f2, r - 0.035, base + 0.05, 0));
  if (kind === 'pickup') {
    // open bed behind the cab
    const bx = (r + cx - cl / 2) / 2, bl = cx - cl / 2 - r - 0.04;
    g.add(flatBox(bl, 0.03, W - 0.14, TRIM, bx, top - 0.01, 0));
    for (const sd of [-1, 1]) g.add(flatBox(bl, 0.12, 0.05, color, bx, top, sd * (W / 2 - 0.03)));
    g.add(flatBox(0.05, 0.12, W - 0.06, color, r + 0.03, top, 0));
  }
  if (kind === 'suv') for (const sd of [-1, 1]) g.add(flatBox(cl - 0.2, 0.04, 0.04, TRIM, cx, top + ch + 0.01, sd * (W / 2 - 0.12)));   // roof rails
  if (kind === 'sedan' && carN % 3 === 0) g.add(flatBox(0.06, 0.04, W - 0.2, color, r + 0.08, top, 0));   // little spoiler
  lights(g, f + 0.03, r - 0.03, base + 0.22, [-0.3, 0.3], 0.16);
  const wz = W / 2 - 0.05, wr = kind === 'suv' || kind === 'pickup' ? 0.22 : 0.19;
  for (const x of [f - 0.36, r + 0.36]) for (const z of [-wz, wz]) wheel(g, x, z, wr, 0.15);
  return mergeVehicle(g);
}

// ---- scenery for each map theme ----
export function pine(scale = 1, color = 0x2f6f3e) {
  const g = new THREE.Group();
  g.add(cyl(0.15, 0.2, 0.7, 0x6b4a2b, 0, 0, 0, 6));
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.ConeGeometry(1.0 - i * 0.25, 1.2, 7), mat(color, { flatShading: true }));
    c.position.y = 1.0 + i * 0.6; c.castShadow = true; g.add(c);
  }
  g.scale.setScalar(scale);
  return g;
}
export function cactus(scale = 1) {
  const g = new THREE.Group();
  const green = 0x4f8a3c;
  g.add(cyl(0.28, 0.32, 2.2, green, 0, 0, 0, 8));
  const arm = (x, y, h) => { g.add(box(Math.abs(x), 0.32, 0.32, green, x / 2, y, 0)); g.add(cyl(0.22, 0.22, h, green, x, y, 0, 7)); };
  arm(0.6, 0.9, 0.9); arm(-0.55, 1.3, 0.7);
  g.scale.setScalar(scale);
  return g;
}
export function mesa(w, h, d) {
  const g = new THREE.Group();
  g.add(box(w, h, d, 0xb5603a, 0, 0, 0));
  g.add(box(w * 0.92, 0.25, d * 0.92, 0xc97a52, 0, h, 0));
  return g;
}
export function rock(scale = 1, color = 0x8f8f94) {
  const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.7, 0), mat(color, { flatShading: true }));
  m.scale.set(scale, scale * 0.6, scale); m.position.y = 0.2 * scale; m.castShadow = true; m.receiveShadow = true;
  return m;
}
export function crater(r = 2) {
  const g = new THREE.Group();
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.15, 0.35, 18, 1, true), mat(0x8a8a8f, { side: THREE.DoubleSide }));
  rim.position.y = 0.17; rim.receiveShadow = true; g.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(r, 18), mat(0x77777c));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0.03; floor.receiveShadow = true; g.add(floor);
  return g;
}
export function crate(color) {
  const m = box(0.6, 0.5, 0.6, color, 0, 0, 0);
  m.add(box(0.62, 0.08, 0.62, 0x6b4a2b, 0, 0.21 - 0.25, 0));
  return m;
}

export function powerPole() {
  const g = new THREE.Group();
  g.add(box(0.14, 3.2, 0.14, 0x6b4a2b, 0, 0, 0));
  g.add(box(0.12, 0.12, 1.2, 0x6b4a2b, 0, 2.9, 0));
  return g;
}

// ======== Mojave and Moon buildings ========
function makeRocket({ body = 0xf7f7f7, nose = 0xe8553a, band = 0x2f7fd1, h = 4, r = 0.6 } = {}) {
  const rocket = new THREE.Group();
  rocket.add(cyl(r, r, h, body, 0, 0.6, 0, 14));
  const n = new THREE.Mesh(new THREE.ConeGeometry(r, r * 2.3, 14), mat(nose));
  n.position.y = 0.6 + h + r * 1.15; n.castShadow = true; rocket.add(n);
  rocket.add(cyl(r + 0.02, r + 0.02, 0.4, band, 0, 0.6 + h * 0.8, 0, 14));
  for (let i = 0; i < 3; i++) {
    const fin = box(0.1, 1.1, 0.8, nose, 0, 0.3, 0);
    const a = (i / 3) * Math.PI * 2;
    fin.position.x = Math.cos(a) * (r + 0.05); fin.position.z = Math.sin(a) * (r + 0.05);
    fin.rotation.y = -a;
    rocket.add(fin);
  }
  return rocket;
}
function scaffoldAt(x, z, h = 5.5) {
  const s = new THREE.Group();
  for (let i = 0; i < 4; i++) s.add(box(1.5, 0.12, 1.5, 0xb9b4a8, x, 0.6 + i * (h / 4.2), z));
  s.add(box(0.12, h, 0.12, 0xb9b4a8, x - 0.7, 0, z + 0.7), box(0.12, h, 0.12, 0xb9b4a8, x + 0.7, 0, z - 0.7));
  return s;
}
const dome = (r, color, x, y, z, opts) => {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m;
};
const cone = (r, h, color, x, z, seg = 9) => {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color, { flatShading: true }));
  m.position.set(x, h / 2, z); m.castShadow = true; m.receiveShadow = true; return m;
};
const panel = (w, d, color, x, y, z, tilt = -0.5) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), mat(color));
  m.position.set(x, y, z); m.rotation.x = tilt; m.castShadow = true; return m;
};
function wheelsOn(g, xs, zs, y = 0.25, r = 0.28) {
  for (const x of xs) for (const z of zs) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.2, 10), mat(0x2a2a2e));
    w.rotation.x = Math.PI / 2; w.position.set(x, y, z); g.add(w);
  }
}

Object.assign(BUILDERS, {
  // ---- Mojave ----
  quarry(color) {
    const g = new THREE.Group();
    g.add(cone(1.8, 1.6, color, -2.2, 1.4), cone(1.2, 1.1, shade(color, 0.15), -0.6, 2.6), cone(1.4, 1.2, shade(color, -0.1), 2.4, 2.2));
    g.add(box(2.6, 1.6, 2, 0xe2c58f, 1.4, 0, -2.2));
    g.add(box(2.8, 0.2, 2.2, 0xb98b5c, 1.4, 1.6, -2.2));
    // excavator
    const ex = new THREE.Group();
    ex.add(box(1.4, 0.5, 1.0, 0x3a3f48, 0, 0, 0), box(1.1, 0.8, 0.9, 0xffc23d, 0, 0.5, 0));
    const arm = new THREE.Group();
    arm.add(box(0.25, 0.25, 2.2, 0xffc23d, 0, 0, 1.1));
    arm.add(box(0.6, 0.4, 0.5, 0x3a3f48, 0, -0.2, 2.2));
    arm.position.set(0, 1.1, 0.2);
    ex.add(arm);
    ex.position.set(-1.6, 0, -1.6);
    g.add(ex);
    return { group: g, top: 4.6, anim(t) { arm.rotation.x = 0.3 + Math.sin(t * 1.4) * 0.35; ex.rotation.y = Math.sin(t * 0.5) * 0.6; } };
  },
  kiln(color) {
    const g = new THREE.Group();
    g.add(dome(2.2, color, -0.8, 0, -0.4));
    g.add(box(1.0, 1.0, 0.1, 0xffb347, -0.8, 0.2, 1.8, { emissive: 0xff8a1f, emissiveIntensity: 0.8 }));
    g.add(cyl(0.45, 0.55, 4.6, shade(color, -0.25), 1.6, 0, -1.6));
    g.add(box(2.2, 1.4, 2.2, 0xe8dcc4, 2.2, 0, 1.2));
    for (let i = 0; i < 3; i++) g.add(box(0.5, 0.05, 1.4, 0x9fd6ff, 1.5 + i * 0.6, 1.42, 1.2, { transparent: true, opacity: 0.8 }));
    stackHole(g, 1.6, 4.6, -1.6, 0.45);
    return { group: g, top: 5.4, smoke: [new THREE.Vector3(1.6, 4.65, -1.6)] };
  },
  solarfab(color) {
    const g = new THREE.Group();
    g.add(box(6.2, 2.0, 4.6, 0xeae6dc, 0, 0, -0.2));
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) g.add(panel(1.7, 1.6, color, -2 + i * 2.0, 2.45, -1.2 + k * 1.9));
    g.add(box(2.0, 1.5, 0.1, 0x3a3f48, -1.6, 0, 2.12));
    windows(g, 2, 0.9, 1.0, 2.12, 0xd8ecff, 1.3, 0.9);
    return { group: g, top: 4.2 };
  },
  battery(color) {
    const g = new THREE.Group();
    g.add(box(4.0, 2.2, 4.4, 0xe6e9ee, -1.0, 0, -0.2));
    g.add(box(4.2, 0.2, 4.6, 0x8a8f99, -1.0, 2.2, -0.2));
    for (const [x, z] of [[2.3, -1.4], [2.3, 0.6], [2.3, 2.4]]) {
      g.add(cyl(0.75, 0.75, 2.6, 0x2a2d33, x, 0, z, 16));
      g.add(cyl(0.78, 0.78, 0.5, color, x, 1.95, z, 16));   // band stops short of the top, so the two don't flicker
      g.add(cyl(0.25, 0.25, 0.3, 0xd9d9d9, x, 2.6, z, 10));
    }
    const bolt = box(0.15, 1.2, 0.1, 0xffd23f, -1.0, 0.5, 2.03, { emissive: 0xffc23d, emissiveIntensity: 0.6 });
    g.add(bolt);
    return { group: g, top: 4.4 };
  },
  drone(color) {
    const g = new THREE.Group();
    g.add(box(5.2, 2.2, 4.4, 0xe8dcc4, -0.6, 0, -0.4));
    g.add(box(5.4, 0.2, 4.6, color, -0.6, 2.2, -0.4));
    g.add(box(2.4, 1.8, 0.1, 0x3a3f48, -0.6, 0, 1.82));
    g.add(box(1.6, 0.06, 1.6, 0xffffff, 2.6, 0.15, 2.0));
    const drones = [];
    for (let i = 0; i < 3; i++) {
      const d = new THREE.Group();
      d.add(box(0.5, 0.15, 0.5, color, 0, 0, 0));
      for (const [x, z] of [[-0.35, -0.35], [0.35, -0.35], [-0.35, 0.35], [0.35, 0.35]]) d.add(box(0.36, 0.03, 0.06, 0x2a2a2e, x, 0.12, z));
      d.traverse(o => { if (o.isMesh) o.castShadow = true; });
      drones.push(d); g.add(d);
    }
    return {
      group: g, top: 5,
      anim(t) { drones.forEach((d, i) => { const a = t * 0.8 + i * 2.1; d.position.set(2.4 + Math.cos(a) * 1.2, 3 + Math.sin(t * 2 + i) * 0.4 + i * 0.5, 1.2 + Math.sin(a) * 1.2); }); },
    };
  },
  rover(color) {
    const g = new THREE.Group();
    g.add(box(5.0, 2.6, 3.8, 0xe2d2b0, -0.8, 0, -1.0));
    g.add(box(5.2, 0.2, 4.0, color, -0.8, 2.6, -1.0));
    g.add(box(2.6, 2.0, 0.1, 0x3a3f48, -0.8, 0, 0.92));
    const rv = new THREE.Group();
    rv.add(box(1.4, 0.4, 0.9, 0xf3f0e8, 0, 0.35, 0), box(0.5, 0.35, 0.5, color, 0.3, 0.75, 0));
    rv.add(box(0.08, 0.7, 0.08, 0x8a8f99, -0.5, 0.75, 0), box(0.6, 0.06, 0.4, 0x2f5fb0, -0.5, 1.45, 0));
    wheelsOn(rv, [-0.5, 0, 0.5], [-0.5, 0.5], 0.22, 0.22);
    g.add(rv);
    return { group: g, top: 5, anim(t) { rv.position.set(-0.8 + Math.sin(t * 0.6) * 2.4, 0, 2.6); rv.rotation.y = Math.cos(t * 0.6) > 0 ? 0 : Math.PI; } };
  },
  launchpad(color) {
    const g = new THREE.Group();
    g.add(box(5.6, 0.5, 5.6, color, 0, 0, 0));
    g.add(box(2.6, 0.08, 2.6, 0x2a2a2e, 0.6, 0.5, 0.2));
    g.add(box(0.6, 7, 0.6, 0x8a8f99, -1.6, 0.5, -1.4));
    for (let i = 0; i < 5; i++) g.add(box(1.8, 0.14, 0.14, 0x8a8f99, -0.8, 1.6 + i * 1.3, -1.4));
    g.add(box(2.0, 1.2, 1.6, 0xe8dcc4, -1.8, 0.5, 2.0));
    const rocket = makeRocket({ body: 0xf4f1ea, nose: 0x2f5fb0, band: 0xe07b2a, h: 4.6 });
    rocket.position.set(0.6, 0.5, 0.2);
    g.add(rocket);
    const scaffold = scaffoldAt(0.6, 0.2);
    scaffold.position.y = 0.5;
    g.add(scaffold);
    return { group: g, top: 8, rocket, scaffold };
  },
  solarfarm(color) {
    const g = new THREE.Group();
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
      g.add(box(0.12, 0.6, 0.12, 0x8a8f99, -2.6 + c * 2.4, 0, -3 + r * 1.8));
      g.add(panel(2.1, 1.3, color, -2.6 + c * 2.4, 0.75, -3 + r * 1.8, -0.55));
    }
    g.add(box(1.2, 1.2, 1.0, 0xe6e9ee, 3.4, 0, 3.4));
    return { group: g, top: 3 };
  },

  // ---- Moon ----
  regolith(color) {
    const g = new THREE.Group();
    g.add(dome(1.8, 0xe6e6ea, -2, 0, -1.6));
    g.add(cone(1.4, 1.0, color, 2.2, 2.2), cone(1.0, 0.8, shade(color, -0.15), 1.0, 2.8));
    g.add(box(0.2, 4, 0.2, 0x5b5f66, 1.2, 0, -1.6), box(0.2, 4, 0.2, 0x5b5f66, 2.6, 0, -1.6), box(1.8, 0.25, 0.4, 0x5b5f66, 1.9, 4, -1.6));
    const drill = new THREE.Group();
    drill.add(cyl(0.3, 0.05, 2.0, 0xd9a441, 0, 0, 0, 8));
    for (let i = 0; i < 4; i++) { const t = box(0.7, 0.06, 0.12, 0xd9a441, 0, 0.3 + i * 0.4, 0); t.rotation.y = i * 0.8; drill.add(t); }
    drill.position.set(1.9, 0.8, -1.6);
    g.add(drill);
    return { group: g, top: 5, anim(t, dt) { drill.rotation.y += dt * 6; drill.position.y = 0.6 + Math.abs(Math.sin(t * 0.8)) * 0.6; } };
  },
  he3(color) {
    const g = new THREE.Group();
    for (const [x, z, r] of [[-2, -1.4, 1.3], [0.6, -1.8, 1.0], [-1.4, 1.6, 0.9]]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), mat(0xe8eaf0));
      s.position.set(x, r + 0.5, z); s.castShadow = true; g.add(s);
      g.add(cyl(0.12, 0.12, 0.6, 0x8a8f99, x, 0, z, 6));
    }
    g.add(box(2.4, 2.0, 2.4, color, 2.2, 0, 1.0));
    g.add(box(3.4, 0.2, 0.2, 0x8a8f99, 0.6, 1.4, 0), box(0.2, 0.2, 3.2, 0x8a8f99, -0.6, 1.0, 0));
    const glow = box(0.6, 0.6, 0.08, 0x9fe8ff, 2.2, 0.8, 2.22, { emissive: 0x4fd0ff, emissiveIntensity: 0.9 });
    g.add(glow);
    return { group: g, top: 4 };
  },
  fuelcell(color) {
    const g = new THREE.Group();
    g.add(dome(1.6, 0xeceef2, -1.6, 0, -1.2), dome(1.2, 0xeceef2, 1.4, 0, -1.6), dome(1.0, color, 0.2, 0, 1.6));
    g.add(box(1.2, 0.6, 0.8, 0xd9d9de, -0.1, 0, -1.4));
    for (let i = 0; i < 4; i++) g.add(box(0.5, 1.0, 0.5, color, 2.0 + (i % 2) * 0.7, 0, 1.0 + Math.floor(i / 2) * 0.8));
    return { group: g, top: 3.4 };
  },
  habitat(color) {
    const g = new THREE.Group();
    const hab = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 4.4, 18, 1, false, 0, Math.PI), mat(color));
    hab.geometry.rotateX(Math.PI / 2); hab.geometry.rotateZ(Math.PI / 2);
    hab.position.set(0, 0, 0); hab.castShadow = true; g.add(hab);
    // printer gantry
    g.add(box(0.2, 3.6, 0.2, 0xffc23d, -2.2, 0, -2.4), box(0.2, 3.6, 0.2, 0xffc23d, 2.2, 0, -2.4), box(0.2, 3.6, 0.2, 0xffc23d, -2.2, 0, 2.4), box(0.2, 3.6, 0.2, 0xffc23d, 2.2, 0, 2.4));
    g.add(box(4.6, 0.2, 0.2, 0xffc23d, 0, 3.6, -2.4), box(4.6, 0.2, 0.2, 0xffc23d, 0, 3.6, 2.4));
    const head = new THREE.Group();
    head.add(box(0.25, 0.25, 5.0, 0xffc23d, 0, 0, 0), box(0.5, 0.6, 0.5, 0x3a3f48, 0, -0.4, 0));
    head.position.set(0, 3.6, 0);
    g.add(head);
    return { group: g, top: 5, anim(t) { head.position.x = Math.sin(t * 0.9) * 1.8; head.children[1].position.z = Math.sin(t * 2.3) * 2.0; } };
  },
  lunarrover(color) {
    const g = new THREE.Group();
    g.add(dome(2.2, 0xeceef2, -1.2, 0, -1.2));
    g.add(box(1.6, 1.4, 0.2, 0x3a3f48, -1.2, 0, 0.95));
    const rv = new THREE.Group();
    rv.add(box(1.6, 0.15, 1.0, color, 0, 0.45, 0), box(0.4, 0.4, 0.8, 0x8a8f99, -0.5, 0.6, 0));
    const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.05, 0.1, 10), mat(0xe8eaf0));
    dish.position.set(0.5, 1.2, 0); rv.add(dish); rv.add(box(0.05, 0.6, 0.05, 0x8a8f99, 0.5, 0.6, 0));
    wheelsOn(rv, [-0.6, 0.6], [-0.55, 0.55], 0.28, 0.28);
    g.add(rv);
    return { group: g, top: 4.6, anim(t) { rv.position.set(1.0 + Math.sin(t * 0.5) * 1.6, 0, 2.4); } };
  },
  telescope(color) {
    const g = new THREE.Group();
    g.add(box(2.4, 1.2, 2.4, 0xd8d8de, -2.0, 0, -1.6));
    g.add(cyl(0.3, 0.4, 2.6, 0x8a8f99, 1.0, 0, 0.4, 10));
    const dish = new THREE.Group();
    const bowl = new THREE.Mesh(new THREE.SphereGeometry(2.0, 20, 8, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38), mat(0xeceef2, { side: THREE.DoubleSide }));
    bowl.rotation.x = Math.PI; bowl.castShadow = true;
    dish.add(bowl);
    dish.add(box(0.1, 1.6, 0.1, color, 0, 0.2, 0));
    dish.add(box(0.4, 0.4, 0.4, color, 0, 1.0, 0));
    dish.position.set(1.0, 3.4, 0.4); dish.rotation.x = -0.6;
    g.add(dish);
    return { group: g, top: 6.4, anim(t) { dish.rotation.y = Math.sin(t * 0.25) * 0.8; } };
  },
  starship(color) {
    const g = new THREE.Group();
    g.add(cyl(2.8, 2.8, 0.4, 0x8a8a90, 0, 0, 0, 20));
    g.add(box(0.7, 9, 0.7, 0x5b5f66, -2.2, 0.4, -1.6));
    for (let i = 0; i < 6; i++) g.add(box(1.8, 0.14, 0.14, 0x5b5f66, -1.5, 1.4 + i * 1.4, -1.6));
    const rocket = makeRocket({ body: color, nose: color, band: 0x2a2a2e, h: 6.4, r: 0.85 });
    rocket.position.set(0.4, 0.4, 0.2);
    g.add(rocket);
    const scaffold = scaffoldAt(0.4, 0.2, 7.5);
    scaffold.position.y = 0.4;
    g.add(scaffold);
    return { group: g, top: 10, rocket, scaffold };
  },
  fusion(color) {
    const g = new THREE.Group();
    g.add(box(6.0, 0.6, 5.0, 0xd8d8de, 0, 0, -0.4));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.55, 12, 28), mat(color));
    ring.rotation.x = Math.PI / 2; ring.position.set(-0.6, 1.4, -0.4); ring.castShadow = true;
    g.add(ring);
    const core = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.18, 8, 28), new THREE.MeshBasicMaterial({ color: 0xff7ae0 }));
    core.rotation.x = Math.PI / 2; core.position.set(-0.6, 1.4, -0.4);
    g.add(core);
    for (const [x, z] of [[-2.6, -2.2], [1.4, -2.2], [-2.6, 1.4], [1.4, 1.4]]) g.add(box(0.4, 2.6, 0.4, 0x8a8f99, x, 0.6, z));
    g.add(box(1.6, 1.6, 1.6, 0xe8eaf0, 2.4, 0.6, 1.6));
    return { group: g, top: 4.4, anim(t) { core.material.color.setHSL(0.85 + Math.sin(t * 3) * 0.05, 1, 0.6 + Math.sin(t * 5) * 0.1); ring.rotation.z = t * 0.4; } };
  },
  quantum(color) {
    const g = new THREE.Group();
    g.add(box(4.6, 2.6, 4.2, 0xf2f3f6, -0.6, 0, -0.4));
    g.add(box(4.8, 0.2, 4.4, color, -0.6, 2.6, -0.4));
    const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.08, 8, 30), new THREE.MeshBasicMaterial({ color: 0x6fe3ff }));
    const ringB = ringA.clone();
    ringA.position.set(-0.6, 3.8, -0.4); ringB.position.copy(ringA.position);
    g.add(ringA, ringB);
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    orb.position.copy(ringA.position); g.add(orb);
    // cryostat tanks
    for (const z of [-1.2, 0.6]) g.add(cyl(0.6, 0.6, 2.0, 0xd8dbe2, 2.6, 0, z, 14));
    return { group: g, top: 5.2, anim(t) { ringA.rotation.x = t * 1.3; ringB.rotation.y = t * 1.7; orb.scale.setScalar(1 + Math.sin(t * 4) * 0.12); } };
  },

  // ---- headquarters, one per world ----
  hq(color) {
    const g = new THREE.Group();
    g.add(box(3.4, 6.4, 3.4, color, -0.8, 0, -0.8));
    for (let k = 0; k < 6; k++) for (const [w, d, x, z] of [[3.42, 0.02, -0.8, 0.91], [0.02, 3.42, 0.91, -0.8]])
      g.add(box(w === 3.42 ? 3.0 : 0.06, 0.45, d === 3.42 ? 3.0 : 0.06, 0x9fd6ff, x, 0.6 + k * 0.95, z));
    g.add(box(3.6, 0.25, 3.6, shade(color, -0.35), -0.8, 6.4, -0.8));
    g.add(box(4.4, 1.6, 2.6, shade(color, 0.25), 1.6, 0, 1.6));
    g.add(box(1.2, 1.0, 0.08, 0x3a3f48, 1.6, 0, 2.92));
    // flag on the roof
    g.add(box(0.08, 1.8, 0.08, 0xdddddd, 0.3, 6.65, 0.3));
    const flag = box(0.9, 0.55, 0.04, 0xffd23f, 0.75, 7.75, 0.3);
    g.add(flag);
    return { group: g, top: 8.9, anim(t) { flag.rotation.y = Math.sin(t * 3) * 0.25; } };
  },
  hqdesert(color) {
    const g = new THREE.Group();
    g.add(box(5.6, 2.6, 4.2, color, 0, 0, -0.4));
    g.add(box(3.0, 1.6, 2.6, shade(color, 0.12), -0.8, 2.6, -0.8));
    for (let i = 0; i < 5; i++) g.add(box(0.18, 0.18, 1.0, 0x8a5a33, -2.4 + i * 1.2, 2.2, 1.9));
    windows(g, 3, 0.8, 1.0, 1.72, 0x9fd6ff, 1.5, -1.5);
    g.add(box(1.0, 1.4, 0.1, 0x6b4a2b, 2.0, 0, 1.72));
    for (let i = 0; i < 2; i++) g.add(panel(1.4, 1.2, 0x2a4f8f, 1.6, 2.85, -1.6 + i * 1.4));
    const mast = new THREE.Group();
    mast.add(box(0.1, 2.4, 0.1, 0xdddddd, 0, 0, 0));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0xf2f2f2, { side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI / 2.3; dish.position.y = 2.3; mast.add(dish);
    mast.position.set(-0.8, 4.2, -0.8);
    g.add(mast);
    return { group: g, top: 7.4, anim(t) { mast.rotation.y = t * 0.6; } };
  },
  hqmoon(color) {
    const g = new THREE.Group();
    g.add(dome(2.6, color, -0.6, 0, -0.6));
    g.add(cyl(2.65, 2.65, 0.5, shade(color, -0.3), -0.6, 0, -0.6, 20));
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * Math.PI * 2;
      g.add(box(0.5, 0.35, 0.05, 0x5fd3ff, -0.6 + Math.cos(a) * 2.0, 1.3, -0.6 + Math.sin(a) * 2.0, { emissive: 0x2fb6ff, emissiveIntensity: 0.7 }));
    }
    g.add(box(1.4, 1.4, 2.0, 0xd8d4c8, 2.4, 0, 1.6));
    const mast = new THREE.Group();
    mast.add(box(0.12, 2.0, 0.12, 0xcfd3da, 0, 0, 0));
    const dish = new THREE.Mesh(new THREE.SphereGeometry(0.8, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), mat(0xf2f2f2, { side: THREE.DoubleSide }));
    dish.rotation.x = Math.PI / 2.5; dish.position.y = 2.0; mast.add(dish);
    mast.position.set(2.4, 1.4, 1.6);
    g.add(mast);
    return { group: g, top: 5.8, anim(t) { mast.rotation.y = Math.sin(t * 0.4) * 1.2; } };
  },
});

// Japan's little kei vehicles, pointing +x: a tiny flat-nosed pickup with a drop-side
// bed (loaded with crates or straw rice bales when it's a delivery), and a boxy kei van
export function keiTruck(color, load = false) {
  const g = new THREE.Group();
  const W = 0.82, L = 1.75, f = L / 2, r = -L / 2, base = 0.17;
  g.add(flatBox(L - 0.1, 0.1, W - 0.1, TRIM, 0, base, 0));
  // the cab: tall and flat-fronted, the wheels right under it
  g.add(box(0.62, 0.38, W, color, f - 0.31, base + 0.06, 0));
  g.add(box(0.58, 0.34, W - 0.04, TINT, f - 0.33, base + 0.44, 0, { roughness: 0.12, metalness: 0.7 }));
  g.add(box(0.56, 0.05, W - 0.02, color, f - 0.34, base + 0.78, 0));
  for (const sd of [-1, 1]) g.add(flatBox(0.05, 0.32, 0.02, color, f - 0.5, base + 0.45, sd * (W / 2 - 0.01)));
  g.add(flatBox(0.02, 0.06, W - 0.2, 0xf2f2f2, f + 0.005, base + 0.1, 0));
  mirrors(g, f - 0.06, base + 0.55, W / 2, TRIM);
  // the drop-side bed
  const bl = L - 0.66, bx = r + bl / 2;
  g.add(flatBox(bl, 0.04, W - 0.02, 0xc9ccd2, bx, base + 0.1, 0));
  for (const sd of [-1, 1]) g.add(flatBox(bl, 0.16, 0.03, 0xc9ccd2, bx, base + 0.14, sd * (W / 2 - 0.015)));
  g.add(flatBox(0.03, 0.16, W - 0.02, 0xc9ccd2, r + 0.015, base + 0.14, 0));
  g.add(flatBox(0.04, 0.32, W - 0.06, 0x8a8f99, r + bl + 0.02, base + 0.14, 0));   // the guard behind the cab
  if (load) {
    for (const [x, z] of [[-0.55, -0.18], [-0.55, 0.18], [-0.2, -0.18], [-0.2, 0.18]]) { const b = cyl(0.13, 0.13, 0.3, 0xd8c9a0, x, base + 0.28, z, 8); b.rotation.x = Math.PI / 2; b.position.y = base + 0.28; g.add(b); }
    g.add(box(0.3, 0.22, 0.32, 0xb98a5a, -0.38, base + 0.41, 0));
  }
  lights(g, f + 0.02, r - 0.02, base + 0.16, [-0.28, 0.28], 0.12);
  for (const x of [f - 0.32, r + 0.32]) for (const z of [-(W / 2 - 0.05), W / 2 - 0.05]) wheel(g, x, z, 0.17, 0.13);
  return mergeVehicle(g);
}
export function keiVan(color) {
  const g = new THREE.Group();
  const W = 0.82, L = 1.7, f = L / 2, r = -L / 2, base = 0.17;
  g.add(box(L, 0.4, W, color, 0, base + 0.04, 0));
  g.add(box(L - 0.12, 0.34, W - 0.04, TINT, -0.04, base + 0.42, 0, { roughness: 0.12, metalness: 0.7 }));
  g.add(box(L - 0.14, 0.06, W, 0xf3f0e8, -0.05, base + 0.75, 0));
  for (const sd of [-1, 1]) for (const x of [f - 0.42, -0.2, r + 0.2]) g.add(flatBox(0.06, 0.32, 0.02, 0xf3f0e8, x, base + 0.44, sd * (W / 2 - 0.01)));
  g.add(flatBox(L - 0.1, 0.05, 0.012, 0xf3f0e8, 0, base + 0.2, W / 2 + 0.003), flatBox(L - 0.1, 0.05, 0.012, 0xf3f0e8, 0, base + 0.2, -W / 2 - 0.003));
  mirrors(g, f - 0.06, base + 0.5, W / 2, color);
  lights(g, f + 0.02, r - 0.02, base + 0.2, [-0.28, 0.28], 0.12);
  for (const x of [f - 0.3, r + 0.3]) for (const z of [-(W / 2 - 0.05), W / 2 - 0.05]) wheel(g, x, z, 0.17, 0.13);
  return mergeVehicle(g);
}
