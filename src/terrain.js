// The land around town for each world: shaped terrain (hills, mountains, dunes,
// craters), a lake, textured roads with curbs and crosswalks, streetlights, and
// scenery (trees, aspens, bushes, flowers, cactus, rocks...). Everything static is
// baked into a few big meshes so it stays fast on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { AVES, CROSS, ROAD_W, LANE, STOP_R, EDGE } from './traffic.js';

export const SHARED = { time: { value: 0 }, cloudTex: { value: null }, cloudAmt: { value: 0.18 }, night: { value: 0 } };

// ---------- noise ----------
function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y, seed = 1, period = 0) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const w = n => (period ? ((n % period) + period) % period : n);
  const a = hash(w(xi), w(yi), seed), b = hash(w(xi + 1), w(yi), seed), c = hash(w(xi), w(yi + 1), seed), d = hash(w(xi + 1), w(yi + 1), seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 4, seed = 1, period = 0) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f, y * f, seed + i * 17, period ? period * f : 0); n += a; f *= 2; a *= 0.5; }
  return s / n;
}
const clamp01 = v => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); };

// ---------- canvas textures ----------
function canvasTex(size, draw, repeat = true) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  draw(img.data, size);
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
let TEX = null;
function textures() {
  if (TEX) return TEX;
  const asphalt = canvasTex(256, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      let v = 0.86 + (fbm(x / 22, y / 22, 3, 3, n / 22) - 0.5) * 0.14 + (hash(x, y, 9) - 0.5) * 0.16;
      if (hash(x, y, 4) > 0.985) v += 0.14;           // light aggregate speckles
      v = Math.max(0, Math.min(1, v)) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  });
  const concrete = canvasTex(256, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      let v = 0.93 + (fbm(x / 30, y / 30, 3, 5, n / 30) - 0.5) * 0.1 + (hash(x, y, 2) - 0.5) * 0.06;
      if (x % 64 < 2 || y % 64 < 2) v -= 0.16;          // expansion joints between slabs
      v = Math.max(0, Math.min(1, v)) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  });
  const cloud = canvasTex(256, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const v = fbm(x / 64, y / 64, 5, 11, 4) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  });
  cloud.colorSpace = THREE.NoColorSpace;
  const blob = canvasTex(64, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const r = Math.hypot(x - n / 2 + 0.5, y - n / 2 + 0.5) / (n / 2);
      d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = Math.max(0, 1 - r) ** 1.6 * 255;
    }
  }, false);
  const ripples = canvasTex(128, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const v = fbm(x / 10, y / 10, 3, 21, n / 10) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  });
  ripples.colorSpace = THREE.NoColorSpace;
  const rows = canvasTex(64, (d, n) => {
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 4;
      const v = (x % 8 < 4 ? 0.82 : 1.0) * (0.95 + hash(x, y, 6) * 0.05) * 255;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
    }
  });
  TEX = { asphalt, concrete, cloud, blob, ripples, rows };
  SHARED.cloudTex.value = cloud;
  return TEX;
}

// ---------- shader touches ----------
// soft cloud shadows drifting over the ground
export function withClouds(m) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uCloud = SHARED.cloudTex; sh.uniforms.uTime = SHARED.time; sh.uniforms.uCloudAmt = SHARED.cloudAmt;
    sh.vertexShader = 'varying vec2 vCw;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vCw = (modelMatrix * vec4(transformed, 1.0)).xz;');
    sh.fragmentShader = 'uniform sampler2D uCloud; uniform float uTime; uniform float uCloudAmt; varying vec2 vCw;\n' +
      sh.fragmentShader.replace('#include <fog_fragment>', `float cl = texture2D(uCloud, vCw / 120.0 + vec2(uTime * 0.0035, uTime * 0.0022)).r;
  gl_FragColor.rgb *= 1.0 - uCloudAmt * smoothstep(0.5, 0.72, cl);
  #include <fog_fragment>`);
  };
  m.customProgramCacheKey = () => 'clouds' + (m.userData.sway ? 'sway' : '');
  return m;
}
// leaves move a little in the wind
function withSway(m) {
  m.userData.sway = true;
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uTime = SHARED.time;
    if (!sh.vertexShader.includes('uniform float uTime;')) sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader;
    sh.vertexShader = 'attribute float aSway;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
  { float k = max(0.0, aSway - 0.7) * 0.05;
    transformed.x += sin(uTime * 1.6 + transformed.x * 0.31 + transformed.z * 0.17) * k;
    transformed.z += cos(uTime * 1.2 + transformed.z * 0.27) * k * 0.6; }`);
  };
  m.customProgramCacheKey = () => 'sway';
  return m;
}
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...o });

// ---------- geometry helpers ----------
// flat rectangle on the ground with world-space texture coordinates
function rect(x0, z0, x1, z1, y, uvScale = 8) {
  const g = new THREE.PlaneGeometry(Math.abs(x1 - x0), Math.abs(z1 - z0));
  g.rotateX(-Math.PI / 2);
  g.translate((x0 + x1) / 2, y, (z0 + z1) / 2);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / uvScale, p.getZ(i) / uvScale);
  return g;
}
function boxAt(w, h, d, x, y, z) { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return g; }
function bake(list, material, { cast = false, receive = true } = {}) {
  if (!list.length) return null;
  const clean = list.map(g => { const n = g.index ? g.toNonIndexed() : g; for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv', 'color', 'aSway'].includes(k)) n.deleteAttribute(k); if (!n.attributes.uv) n.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2)); return n; });
  const hasColor = clean.some(g => g.attributes.color);
  if (hasColor) for (const g of clean) if (!g.attributes.color) g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 3).fill(1), 3));
  const merged = mergeGeometries(clean, false);
  for (const g of list) g.dispose();
  const m = new THREE.Mesh(merged, material);
  m.castShadow = cast; m.receiveShadow = receive;
  return m;
}
// collect pieces by material, then bake each material into one mesh
class Batch {
  constructor() { this.parts = new Map(); }
  add(material, geo, matrix) {
    if (matrix) geo.applyMatrix4(matrix);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(geo);
  }
  // add every mesh of an object (with its transform)
  addObject(obj) {
    obj.updateMatrixWorld(true);
    const baseY = obj.position.y;
    obj.traverse(o => {
      if (!o.isMesh) return;
      const g = o.geometry.clone();
      g.applyMatrix4(o.matrixWorld);
      // leaves: remember how high each point is above the ground, for the wind
      if (o.material.userData.sway) {
        const p = g.attributes.position, a = new Float32Array(p.count);
        for (let i = 0; i < p.count; i++) a[i] = p.getY(i) - baseY;
        g.setAttribute('aSway', new THREE.BufferAttribute(a, 1));
      }
      this.add(o.material, g);
    });
  }
  build(group, opts) {
    for (const [m, list] of this.parts) { const mesh = bake(list, m, opts); if (mesh) group.add(mesh); }
  }
}

// ---------- the land ----------
const TOWN = { x0: -28, x1: 28, z0: -28, z1: 35 };
function townDist(x, z) {
  const dx = Math.max(TOWN.x0 - x, 0, x - TOWN.x1), dz = Math.max(TOWN.z0 - z, 0, z - TOWN.z1);
  return Math.hypot(dx, dz);
}
function roadDist(x, z) {
  let d = Infinity;
  for (const a of AVES) d = Math.min(d, Math.abs(x - a));
  for (const c of CROSS) d = Math.min(d, Math.abs(z - c));
  return d;
}
const LAKE = { x: 50, z: 46, r: 15 };

// the shape of the land, before flattening it for town and roads
function rawHeight(name, x, z) {
  const back = clamp01((-(x + z) - 70) / 90);              // far behind town (top of the screen)
  const side = clamp01((Math.abs(x - z) - 60) / 80);
  if (name === 'colorado') {
    let h = (fbm(x / 34, z / 34, 4, 2) - 0.45) * 5;
    const ridge = 1 - Math.abs(2 * fbm(x / 46, z / 46, 5, 7) - 1);
    h += back * (ridge * ridge * 46 + 6) + side * ridge * 10;
    // an irregular lake shore
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z) + (fbm(x / 9, z / 9, 3, 41) - 0.5) * 9;
    if (dl < LAKE.r + 6) h = Math.min(h, -2.2 + smooth(LAKE.r - 3, LAKE.r + 6, dl) * 2.6);
    return h;
  }
  if (name === 'desert') {
    const n = fbm(x / 26, z / 26, 4, 5);
    let h = (0.5 + 0.5 * Math.sin(x * 0.16 + z * 0.05 + n * 6)) * 1.4 * n;   // dunes
    // flat-topped buttes in the distance
    const b = fbm(x / 38, z / 38, 3, 9);
    const butte = smooth(0.52, 0.56, b) * (14 + fbm(x / 9, z / 9, 2, 4) * 2);
    h = Math.max(h, butte * Math.max(back, side * 0.7));
    h += back * 3 * fbm(x / 60, z / 60, 3, 2);
    const ds = Math.hypot(x - 48, z - 46);
    if (ds < 22) h = h * smooth(14, 22, ds) + 0.02;   // the salt flat
    return h;
  }
  // moon: bumpy ground and craters
  let h = (fbm(x / 20, z / 20, 4, 3) - 0.5) * 1.6;
  for (const c of MOON_CRATERS) {
    const d = Math.hypot(x - c[0], z - c[1]), r = c[2];
    if (d < r * 1.8) h += -c[3] * Math.max(0, 1 - (d / r) ** 2) + c[3] * 0.55 * Math.exp(-(((d - r) / (r * 0.28)) ** 2));
  }
  h += back * (1 - Math.abs(2 * fbm(x / 40, z / 40, 4, 8) - 1)) * 26;
  return h;
}
const MOON_CRATERS = (() => {
  const out = []; const r = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(99);
  for (let i = 0; i < 46; i++) {
    const x = (r() - 0.5) * 300, z = (r() - 0.5) * 300, rad = 3 + r() ** 2 * 16;
    if (townDist(x, z) < rad + 3) continue;
    out.push([x, z, rad, 0.8 + rad * 0.18]);
  }
  return out;
})();

export function makeHeight(name) {
  return (x, z) => {
    const flat = smooth(3.2, 9, roadDist(x, z)) * smooth(1, 9, townDist(x, z));
    return rawHeight(name, x, z) * flat;
  };
}

const PAL = {
  colorado: { grass: [0x86c25a, 0x6eaf49, 0x9ccf68, 0xb4c463], rock: 0x8d8a82, snow: 0xf4f6fa, dirt: 0xa98a62 },
  desert: { grass: [0xe2c58f, 0xd9b77d, 0xebd3a3, 0xd2a46e], rock: 0xc06c45, snow: 0xd88a5a, dirt: 0xc9a06b },
  moon: { grass: [0x9a9aa0, 0x77777f, 0xaeaeb4, 0x5f6068], rock: 0x86868d, snow: 0xc4c4ca, dirt: 0x8f8f96 },
};

export function buildLand(name, T, LOTS) {
  const tx = textures();
  const H = makeHeight(name);
  const P = PAL[name] || PAL.colorado;
  const ground = new THREE.Group(), scenery = new THREE.Group();
  SHARED.cloudAmt.value = name === 'moon' ? 0 : name === 'desert' ? 0.1 : 0.17;

  // terrain
  const SIZE = 640, SEG = 200;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), c2 = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = H(x, z);
    pos.setY(i, h - 0.02);
    const n = fbm(x / 18, z / 18, 3, 4), n2 = fbm(x / 7, z / 7, 2, 8);
    const g = P.grass;
    c.setHex(g[0]).lerp(c2.setHex(g[1]), smooth(0.35, 0.7, n)).lerp(c2.setHex(g[2]), smooth(0.6, 0.85, n2) * 0.6).lerp(c2.setHex(g[3]), smooth(0.62, 0.8, fbm(x / 40, z / 40, 2, 12)) * 0.7);
    if (h > 6) c.lerp(c2.setHex(P.rock), smooth(6, 12, h + n2 * 4));
    if (h > 20) c.lerp(c2.setHex(P.snow), smooth(20, 28, h + n * 8));
    if (name === 'colorado' && h < -0.4) c.lerp(c2.setHex(0xc9b48a), 0.8);   // lake shore sand
    if (name === 'desert') c.lerp(c2.setHex(0xefe6d2), smooth(21, 12, Math.hypot(x - 48, z - 46) + (n2 - 0.5) * 6) * 0.9);   // salt flat
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, withClouds(std(0xffffff, { vertexColors: true, flatShading: true, roughness: name === 'moon' ? 0.95 : 0.9 })));
  terrain.receiveShadow = true;
  ground.add(terrain);
  ground.userData.base = new THREE.Color(P.grass[0]);

  // lake (Colorado)
  if (name === 'colorado') {
    const wg = new THREE.CircleGeometry(LAKE.r + 10, 48);
    wg.rotateX(-Math.PI / 2); wg.translate(LAKE.x, -0.45, LAKE.z);
    const ripples = tx.ripples.clone(); ripples.repeat.set(3, 3); ripples.needsUpdate = true;
    const water = new THREE.MeshStandardMaterial({ color: 0x3a8cc4, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.88, bumpMap: ripples, bumpScale: 0.6 });
    water.userData.ripples = ripples;
    const wm = new THREE.Mesh(wg, water); wm.receiveShadow = true;
    ground.add(wm);
    ground.userData.water = ripples;
  }

  // roads: one asphalt mesh, curbs + sidewalks, paint, crosswalks
  const road = new Batch();
  const asphaltM = withClouds(std(T.road, { map: tx.asphalt, roughness: 0.92 }));
  const walkM = withClouds(std(T.walk, { roughness: 0.9 }));
  const curbM = std(new THREE.Color(T.walk).multiplyScalar(0.82).getHex(), { roughness: 0.9 });
  const paintM = std(0xf4efe0, { roughness: 0.7 });
  const L = EDGE + 40;
  const HW = ROAD_W / 2, SW = 0.7;
  for (const x of AVES) road.add(asphaltM, rect(x - HW, -L, x + HW, L, 0.07));
  for (const z of CROSS) road.add(asphaltM, rect(-L, z - HW, L, z + HW, 0.075));
  // sidewalks run between intersections, with corner squares
  const segs = vals => { const out = []; const s = [...vals].sort((a, b) => a - b); let prev = -L; for (const v of s) { out.push([prev, v - HW]); prev = v + HW; } out.push([prev, L]); return out; };
  for (const x of AVES) for (const side of [-1, 1]) for (const [a, b] of segs(CROSS)) {
    road.add(walkM, boxAt(SW, 0.14, b - a, x + side * (HW + SW / 2), 0, (a + b) / 2));
    road.add(curbM, boxAt(0.12, 0.16, b - a, x + side * (HW + 0.06), 0, (a + b) / 2));
  }
  for (const z of CROSS) for (const side of [-1, 1]) for (const [a, b] of segs(AVES)) {
    road.add(walkM, boxAt(b - a, 0.14, SW, (a + b) / 2, 0, z + side * (HW + SW / 2)));
    road.add(curbM, boxAt(b - a, 0.16, 0.12, (a + b) / 2, 0, z + side * (HW + 0.06)));
  }
  for (const x of AVES) for (const z of CROSS) for (const sx of [-1, 1]) for (const sz of [-1, 1])
    road.add(walkM, boxAt(SW, 0.14, SW, x + sx * (HW + SW / 2), 0, z + sz * (HW + SW / 2)));
  const moon = name === 'moon';
  // centre dashes (not inside junctions); the Moon gets blue edge lights instead, like a runway
  const edgeM = new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x4fa8ff, emissiveIntensity: 0.4, roughness: 0.4 });
  edgeM.userData.night = 2.2; edgeM.userData.day = 0.4;
  if (moon) for (let i = -L; i < L; i += 3.5) {
    if (!CROSS.some(z => Math.abs(i - z) < STOP_R + 0.6)) for (const x of AVES) for (const sd of [-1, 1]) road.add(edgeM, boxAt(0.16, 0.1, 0.16, x + sd * (HW - 0.12), 0.07, i));
    if (!AVES.some(x => Math.abs(i - x) < STOP_R + 0.6)) for (const z of CROSS) for (const sd of [-1, 1]) road.add(edgeM, boxAt(0.16, 0.1, 0.16, i, 0.075, z + sd * (HW - 0.12)));
  }
  if (!moon) for (let i = -L; i < L; i += 2.4) {
    if (!CROSS.some(z => Math.abs(i - z) < STOP_R + 0.6)) for (const x of AVES) road.add(paintM, boxAt(0.14, 0.02, 1.1, x, 0.07, i));
    if (!AVES.some(x => Math.abs(i - x) < STOP_R + 0.6)) for (const z of CROSS) road.add(paintM, boxAt(1.1, 0.02, 0.14, i, 0.075, z));
  }
  // crosswalks and stop lines on every approach
  for (const x of AVES) for (const z of CROSS) {
    for (const [hx, hz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      // stop line across the lane coming in (heading hx,hz arrives from -h side)
      const cx = x - hx * STOP_R + (-hz) * LANE, cz = z - hz * STOP_R + hx * LANE;
      road.add(paintM, hx ? boxAt(0.26, 0.022, HW - 0.15, cx, 0.075, cz) : boxAt(HW - 0.15, 0.022, 0.26, cx, 0.075, cz));
      // zebra stripes between the stop line and the junction
      const zc = STOP_R - 0.62;
      if (!moon) for (let k = -3; k <= 3; k++) {
        const off = k * 0.5;
        if (hx) road.add(paintM, boxAt(0.7, 0.022, 0.26, x - hx * zc, 0.075, z + off));
        else road.add(paintM, boxAt(0.26, 0.022, 0.7, x + off, 0.075, z - hz * zc));
      }
    }
  }
  road.build(ground);

  // streetlights at junction corners, and along roads out of town
  const poles = new Batch();
  const poleM = std(0x3a3f48, { roughness: 0.5, metalness: 0.5 });
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd28a, emissiveIntensity: 0, roughness: 0.4 });
  lampM.userData.night = 2.4;
  const lamp = (x, z, ax, az) => {
    if (moon) {   // short light posts instead of streetlamps
      poles.add(poleM, boxAt(0.18, 0.7, 0.18, x, 0.14, z));
      poles.add(edgeM, boxAt(0.26, 0.16, 0.26, x, 0.84, z));
      return;
    }
    poles.add(poleM, boxAt(0.13, 2.9, 0.13, x, 0.14, z));
    poles.add(poleM, boxAt(Math.abs(ax) * 0.9 + 0.1, 0.1, Math.abs(az) * 0.9 + 0.1, x + ax * 0.45, 2.95, z + az * 0.45));
    poles.add(lampM, boxAt(0.42, 0.14, 0.42, x + ax * 0.9, 2.84, z + az * 0.9));
    lights.push(new THREE.Vector3(x + ax * 0.9, 2.8, z + az * 0.9));
  };
  const lights = [];
  const o = HW + SW / 2;
  for (const x of AVES) for (const z of CROSS) { lamp(x + o, z + o, -0.7, -0.7); lamp(x - o, z - o, 0.7, 0.7); }
  // out of town, a light every block or so along each road
  for (const z of CROSS) for (let x = -94; x <= 94; x += 14) if (Math.abs(x) > 28) lamp(x, z + o, 0, -1);
  for (const x of AVES) for (let z = -94; z <= 94; z += 14) if (Math.abs(z) > 28 && !(z > 28 && z < 40)) lamp(x + o, z, -1, 0);
  poles.build(ground, { cast: true });
  ground.userData.lamps = lights;
  ground.userData.lampMat = lampM;
  ground.userData.edgeMat = edgeM;

  // ---------- scenery ----------
  const near = new Batch(), far = new Batch(), blobs = [];
  const r = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(name === 'colorado' ? 7 : name === 'desert' ? 11 : 13);
  const blocked = (x, z, pad) => {
    if (roadDist(x, z) < HW + SW + pad) return true;
    if (name === 'colorado' && H(x, z) < -0.3) return true;
    return Object.values(LOTS).some(([lx, lz]) => Math.abs(x - lx) < 5.4 + pad * 0.3 && Math.abs(z - lz) < 5.4 + pad * 0.3);
  };
  const SPAN = 250, NEAR = 50;
  const place = (count, make, { pad = 0.6, maxH = 99, minH = -0.3, span = SPAN, where = null, blob = 1 } = {}) => {
    let n = 0;
    for (let i = 0; i < count * 8 && n < count; i++) {
      const x = (r() - 0.5) * span, z = (r() - 0.5) * span;
      if (blocked(x, z, pad)) continue;
      if (where && !where(x, z)) continue;
      const h = H(x, z);
      if (h > maxH || h < minH) continue;
      const obj = make(r, h);
      obj.position.set(x, h, z);
      obj.rotation.y = r() * Math.PI * 2;
      const isNear = Math.abs(x) < NEAR && Math.abs(z) < NEAR;
      (isNear ? near : far).addObject(obj);
      if (blob && h < 4) blobs.push([x, h, z, (obj.userData.r || 1) * blob]);
      n++;
    }
  };
  const S = sceneryKit();
  if (name === 'colorado') {
    // groves: aspens like to cluster, pines take the slopes
    const grove = (x, z) => fbm(x / 22, z / 22, 2, 31) > 0.52;
    place(900, S.tree, { where: (x, z) => !grove(x, z) });
    place(700, S.aspen, { where: grove, maxH: 14 });
    place(900, S.pine, { minH: 2, maxH: 24 });
    place(260, S.pine, { maxH: 2 });
    place(500, S.bush, { pad: 0.3, blob: 0.6 });
    place(420, S.flowers, { pad: 0.2, blob: 0, maxH: 6 });
    place(160, S.rock, { pad: 0.3, blob: 0.7 });
    place(40, S.boulder, { minH: 4, blob: 0 });
    // farm fields near the lake side
    const fields = [[34, 72, 30, 14, 0xd9b45a], [70, 22, 16, 28, 0x8fbf4d], [30, 100, 26, 12, 0xc2a24a], [96, 60, 14, 30, 0xa7c95a]];
    const fieldM = new Map();
    for (const [fx, fz, w, d, color] of fields) {
      if (!fieldM.has(color)) fieldM.set(color, withClouds(std(color, { map: tx.rows, roughness: 0.95 })));
      const g = rect(fx - w / 2, fz - d / 2, fx + w / 2, fz + d / 2, H(fx, fz) + 0.06, 6);
      far.add(fieldM.get(color), g);
    }
    // a little dock on the lake
    near.add(std(0x8a5a3c), boxAt(1.4, 0.18, 7, LAKE.x - LAKE.r + 2, -0.35, LAKE.z));
  } else if (name === 'desert') {
    place(420, S.saguaro, { pad: 0.5 });
    place(260, S.joshua, { pad: 0.5 });
    place(600, S.shrub, { pad: 0.3, blob: 0.5 });
    place(220, S.barrel, { pad: 0.2, blob: 0.4 });
    place(320, r => S.rock(r, 0, 0xb98b5c), { pad: 0.3, blob: 0.7 });
    place(70, (r, h) => S.boulder(r, h, 0xb5603a), { pad: 1, blob: 0 });
  } else {
    place(900, r => S.rock(r, 0, 0x8a8a90), { pad: 0.3, blob: 0.8 });
    place(140, (r, h) => S.boulder(r, h, 0x7d7d84), { pad: 1, blob: 0.6 });
    place(40, S.antenna, { pad: 1, span: 160, blob: 0.6 });
    place(24, S.solarArray, { pad: 2, span: 180, blob: 0 });
  }
  near.build(scenery, { cast: true });
  far.build(scenery, { cast: false });
  // soft dark patches under things, so they sit on the ground
  if (blobs.length) {
    const bm = new THREE.MeshBasicMaterial({ map: tx.blob, transparent: true, opacity: name === 'moon' ? 0.55 : 0.38, depthWrite: false, color: 0x000000 });
    bm.color.set(0x1d2a14);
    const geos = blobs.map(([x, h, z, s]) => { const g = new THREE.PlaneGeometry(2.6 * s, 2.6 * s); g.rotateX(-Math.PI / 2); g.translate(x, h + 0.04, z); return g; });
    const bmesh = new THREE.Mesh(mergeGeometries(geos), bm);
    bmesh.renderOrder = 1;
    scenery.add(bmesh);
  }
  return { ground, scenery, height: H };
}

// ---------- scenery models ----------
function sceneryKit() {
  const M = new Map();
  const m = (color, o = {}, sway = 0) => {
    sway = sway ? 1 : 0;
    const k = color + JSON.stringify(o) + sway;
    if (!M.has(k)) { const mm = std(color, { flatShading: true, ...o }); if (sway) withSway(mm); M.set(k, mm); }
    return M.get(k);
  };
  const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); return o; };
  const greens = [0x3f8f4a, 0x4fa152, 0x357d40, 0x5bb05a, 0x6aa84a];
  const golds = [0xf2c230, 0xe8a91e, 0xf5d34a, 0xd98c1c, 0xb6c43c];
  return {
    tree(r) {
      const g = new THREE.Group(), s = 0.8 + r() * 0.7, col = greens[Math.floor(r() * greens.length)];
      g.add(mesh(new THREE.CylinderGeometry(0.13 * s, 0.2 * s, 1.1 * s, 6), m(0x7a5230), 0, 0.55 * s, 0));
      const lm = m(col, {}, 0.9 * s);
      g.add(mesh(new THREE.IcosahedronGeometry(0.85 * s, 0), lm, 0, 1.55 * s, 0));
      g.add(mesh(new THREE.IcosahedronGeometry(0.6 * s, 0), lm, 0.45 * s, 1.25 * s, 0.2 * s));
      g.add(mesh(new THREE.IcosahedronGeometry(0.55 * s, 0), lm, -0.35 * s, 1.95 * s, -0.2 * s));
      g.userData.r = s;
      return g;
    },
    aspen(r) {
      const g = new THREE.Group(), s = 0.75 + r() * 0.6, col = golds[Math.floor(r() * golds.length)];
      g.add(mesh(new THREE.CylinderGeometry(0.09 * s, 0.12 * s, 2.2 * s, 6), m(0xeeeae0), 0, 1.1 * s, 0));
      for (let k = 0; k < 3; k++) g.add(mesh(new THREE.BoxGeometry(0.2 * s, 0.05 * s, 0.2 * s), m(0x2e2a26), 0, 0.5 * s + k * 0.45 * s, 0));
      const lm = m(col, {}, 1.4 * s);
      const crown = mesh(new THREE.IcosahedronGeometry(0.62 * s, 0), lm, 0, 2.35 * s, 0); crown.scale.y = 1.5; g.add(crown);
      g.userData.r = s * 0.8;
      return g;
    },
    pine(r) {
      const g = new THREE.Group(), s = 0.8 + r() * 0.8, col = r() < 0.5 ? 0x2f6f3e : 0x285f37;
      g.add(mesh(new THREE.CylinderGeometry(0.12 * s, 0.17 * s, 0.7 * s, 6), m(0x6b4a2b), 0, 0.35 * s, 0));
      const lm = m(col, {}, 1.0 * s);
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.ConeGeometry((1.0 - i * 0.25) * s, 1.25 * s, 7), lm, 0, (1.05 + i * 0.62) * s, 0));
      g.userData.r = s;
      return g;
    },
    bush(r) {
      const g = new THREE.Group(), s = 0.4 + r() * 0.4, lm = m(greens[Math.floor(r() * 3)], {}, 0.1);
      g.add(mesh(new THREE.IcosahedronGeometry(0.6 * s, 0), lm, 0, 0.35 * s, 0));
      g.add(mesh(new THREE.IcosahedronGeometry(0.45 * s, 0), lm, 0.45 * s, 0.25 * s, 0.1));
      g.userData.r = s;
      return g;
    },
    flowers(r) {
      const g = new THREE.Group();
      const cols = [0xf2f2f2, 0xf5d34a, 0xe8648a, 0x9b7be0, 0xff8a3d];
      const c = cols[Math.floor(r() * cols.length)];
      for (let i = 0; i < 6; i++) g.add(mesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), m(c), (r() - 0.5) * 1.2, 0.12 + r() * 0.1, (r() - 0.5) * 1.2));
      return g;
    },
    rock(r, h, color = 0x8f8f94) {
      const s = 0.4 + r() * 1.1;
      const o = mesh(new THREE.IcosahedronGeometry(0.7, 0), m(color), 0, 0.18 * s, 0);
      o.scale.set(s, s * (0.45 + r() * 0.3), s * (0.8 + r() * 0.4));
      const g = new THREE.Group(); g.add(o); g.userData.r = s; return g;
    },
    boulder(r, h, color = 0x8d8a82) {
      const g = new THREE.Group(), s = 1.4 + r() * 2.4;
      const o = mesh(new THREE.DodecahedronGeometry(1, 0), m(color), 0, 0.4 * s, 0);
      o.scale.set(s, s * 0.7, s * 0.9); g.add(o);
      g.userData.r = s;
      return g;
    },
    saguaro(r) {
      const g = new THREE.Group(), s = 0.8 + r() * 0.7, gm = m(0x4f8a3c, {}, 0);
      g.add(mesh(new THREE.CylinderGeometry(0.26 * s, 0.3 * s, 2.6 * s, 8), gm, 0, 1.3 * s, 0));
      g.add(mesh(new THREE.SphereGeometry(0.26 * s, 8, 6), gm, 0, 2.6 * s, 0));
      const arm = (x, y, hgt) => {
        g.add(mesh(new THREE.CylinderGeometry(0.18 * s, 0.18 * s, Math.abs(x) * s, 7), gm, x / 2 * s, y * s, 0)).children.at(-1).rotation.z = Math.PI / 2;
        g.add(mesh(new THREE.CylinderGeometry(0.18 * s, 0.18 * s, hgt * s, 7), gm, x * s, (y + hgt / 2) * s, 0));
        g.add(mesh(new THREE.SphereGeometry(0.18 * s, 7, 5), gm, x * s, (y + hgt) * s, 0));
      };
      arm(0.6, 1.0, 0.9); if (r() < 0.7) arm(-0.55, 1.4, 0.7);
      g.userData.r = s * 0.7;
      return g;
    },
    joshua(r) {
      const g = new THREE.Group(), s = 0.8 + r() * 0.6, tm = m(0x8a6a4a), lm = m(0x6f8f3a, {}, 1.2 * s);
      const branch = (x, z, y, len, ang) => {
        const b = mesh(new THREE.CylinderGeometry(0.1 * s, 0.14 * s, len * s, 6), tm, (x - Math.sin(ang) * len / 2) * s, (y + len / 2 * Math.cos(ang)) * s, z * s);
        b.rotation.z = ang; g.add(b);
        const ex = x + Math.sin(-ang) * len, ey = y + Math.cos(ang) * len;
        g.add(mesh(new THREE.IcosahedronGeometry(0.32 * s, 0), lm, ex * s, ey * s, z * s));
      };
      g.add(mesh(new THREE.CylinderGeometry(0.15 * s, 0.22 * s, 1.4 * s, 6), tm, 0, 0.7 * s, 0));
      branch(0, 0, 1.3, 0.9, 0.6); branch(0, 0.1, 1.3, 0.8, -0.7); branch(0, -0.1, 1.3, 0.7, 0.1);
      g.userData.r = s * 0.8;
      return g;
    },
    shrub(r) {
      const g = new THREE.Group(), s = 0.35 + r() * 0.35, lm = m(r() < 0.5 ? 0x9a9a5a : 0x8c8f60, {}, 0.1);
      g.add(mesh(new THREE.IcosahedronGeometry(0.6 * s, 0), lm, 0, 0.3 * s, 0));
      g.userData.r = s;
      return g;
    },
    barrel(r) {
      const g = new THREE.Group(), s = 0.35 + r() * 0.3;
      g.add(mesh(new THREE.SphereGeometry(0.6 * s, 9, 7), m(0x5f8f3e), 0, 0.4 * s, 0));
      g.add(mesh(new THREE.SphereGeometry(0.16 * s, 6, 4), m(0xe8648a), 0, 0.95 * s, 0));
      g.userData.r = s;
      return g;
    },
    antenna(r) {
      const g = new THREE.Group();
      g.add(mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.2, 6), m(0xcfd3da, { metalness: 0.6, roughness: 0.4 }), 0, 1.1, 0));
      const dish = mesh(new THREE.SphereGeometry(0.6, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2.5), m(0xf2f2f2, { side: THREE.DoubleSide, flatShading: false }), 0, 2.1, 0);
      dish.rotation.x = 2.2; g.add(dish);
      return g;
    },
    solarArray(r) {
      const g = new THREE.Group(), pm = m(0x2a4f8f, { roughness: 0.25, metalness: 0.5, flatShading: false }), fm = m(0xcfd3da);
      for (let i = 0; i < 4; i++) {
        g.add(mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), fm, i * 1.6 - 2.4, 0.45, 0));
        const p = mesh(new THREE.BoxGeometry(1.5, 0.06, 1.1), pm, i * 1.6 - 2.4, 0.95, 0); p.rotation.x = -0.5; g.add(p);
      }
      return g;
    },
  };
}
