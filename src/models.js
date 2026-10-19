// Low-poly models built from simple shapes. Each factory model is a slot:
// replace a builder function with a loaded 3D model later without touching game logic.
import * as THREE from 'three';

const matCache = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!matCache.has(key)) matCache.set(key, new THREE.MeshLambertMaterial({ color, ...opts }));
  return matCache.get(key);
}

export function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, opts));
  m.position.set(x, y + h / 2, z);
  m.castShadow = true; m.receiveShadow = true;
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
export const BUILDERS = {
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
      stacks.push(new THREE.Vector3(x, 3.5 + h, -1.2));
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
    return { group: g, top: 7.6 };
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

export function truck(color) {
  const g = new THREE.Group();
  g.add(box(1.5, 1, 0.95, 0xf3f0e8, -0.35, 0.25, 0));
  g.add(box(0.7, 0.8, 0.95, color, 0.8, 0.25, 0));
  g.add(box(0.06, 0.35, 0.8, 0x9fd6ff, 1.16, 0.6, 0));
  for (const x of [-0.7, 0.75]) for (const z of [-0.45, 0.45]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.15, 10), mat(0x2a2a2e));
    w.rotation.x = Math.PI / 2; w.position.set(x, 0.22, z); g.add(w);
  }
  return g;
}
