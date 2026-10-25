// The land around town for each world: shaped terrain (hills, mountains, dunes,
// craters), a lake, textured roads with curbs and crosswalks, streetlights, and
// scenery (trees, aspens, bushes, flowers, cactus, rocks...). Everything static is
// baked into a few big meshes so it stays fast on phones.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ROAD_W, LANE, STOP_R, EDGE, NET, BLOCK, hasRoad, distToRoad, exitFar, segKey } from './traffic.js';

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
const TOWN = { x0: -38, x1: 38, z0: -38, z1: 38 };
let BLOCKS = [];   // the town's plots, set when the land is built
function townDist(x, z) {
  if (!BLOCKS.length) { const dx = Math.max(TOWN.x0 - x, 0, x - TOWN.x1), dz = Math.max(TOWN.z0 - z, 0, z - TOWN.z1); return Math.hypot(dx, dz); }
  let d = Infinity;
  for (const [cx, cz] of BLOCKS) d = Math.min(d, Math.hypot(Math.max(0, Math.abs(x - cx) - 9), Math.max(0, Math.abs(z - cz) - 9)));
  return d;
}
const roadDist = (x, z) => distToRoad(x, z);
const LAKE = { x: 66, z: 64, r: 15 };
// farm fields near the lake (Colorado): [x, z, width, depth, colour]
const FIELDS = [[50, 104, 18, 14, 0xd9b45a], [104, 50, 14, 18, 0x8fbf4d], [100, 100, 24, 18, 0xc2a24a], [120, 72, 12, 24, 0xa7c95a]];

// Flat-topped mesas round the edge of the map (the Mojave and Mars): [x, z, half-length,
// half-width, height, turn]. Placed clear of the town, the two roads out, the landing
// spot (40, 40) and the Mojave's salt flat.
const MESAS = {
  desert: [[-42, 20, 14, 7, 8, 0.78], [42, -16, 14, 7, 8, 0.78], [-50, 40, 13, 8, 8, 0.75], [44, -44, 14, 9, 9, 0.8], [-52, -50, 16, 10, 10, -0.2], [6, -64, 15, 9, 9, 0.1],
    [-66, 18, 9, 7, 7, 0.3], [-14, 66, 13, 8, 8, -0.4], [68, -4, 10, 7, 7, 0.5], [30, 92, 14, 9, 8, 0.6], [-8, -98, 20, 12, 12, 0.2]],
  // Mars has its own buttes, in different places from the Mojave's
  mars: [[30, -50, 13, 8, 9, 0.3], [-34, -58, 15, 9, 10, -0.5], [-60, 40, 12, 8, 8, 0.9], [-72, -30, 10, 7, 8, 0.2],
    [12, 72, 14, 8, 9, 0.6], [80, -22, 10, 7, 7, 0.1], [-28, 90, 16, 9, 10, 0.3], [45, -95, 18, 11, 12, -0.2], [-96, 34, 9, 12, 10, 0.6]],
};
// how far up a mesa this point is: { h: height, top: the mesa's full height } (h 0 off it)
function mesaAt(name, x, z) {
  let best = 0, top = 0;
  for (const [cx, cz, a, b, ht, rot] of MESAS[name] || []) {
    const dx = x - cx, dz = z - cz;
    if (Math.abs(dx) > a + b + 12 || Math.abs(dz) > a + b + 12) continue;
    const c = Math.cos(rot), s = Math.sin(rot);
    const u = (dx * c + dz * s) / a, v = (-dx * s + dz * c) / b;
    // ragged edges: big bays and headlands, plus finer gullies down the cliffs
    const d = Math.hypot(u, v) + (fbm(x / 7, z / 7, 2, 23) - 0.5) * 0.28 + (fbm(x / 2.2, z / 2.2, 2, 57) - 0.5) * 0.13;
    // a flat top, steep cliffs, a narrow ledge part way down and a skirt of scree at the foot
    const cliff = smooth(1.02, 0.86, d), ledge = smooth(1.12, 1.0, d) * 0.42, scree = smooth(1.45, 1.05, d) * 0.12;
    let h = ht * Math.max(cliff, ledge, scree);
    // layers of harder rock stick out as soft steps on the way up
    if (h > 0.5 && h < ht * 0.97) { const L = 1.6, t = h / L, f = t - Math.floor(t); h = h * 0.55 + (Math.floor(t) + smooth(0.25, 0.75, f)) * L * 0.45; }
    // broken rock: chunks bulge out of the cliffs and the top is uneven, with a hard lip
    const mid = cliff * (1 - cliff) * 4;
    h += mid * (fbm(x / 1.3, z / 1.3, 2, 71) - 0.5) * 1.8 * Math.min(1, ht / 8);
    if (cliff > 0.98) h += (fbm(x / 3.5, z / 3.5, 2, 13) - 0.5) * 0.7 + smooth(0.75, 0.86, d) * 0.25;
    if (h > best) { best = h; top = ht; }
  }
  return { h: best, top };
}

// the shape of the land, before flattening it for town and roads
function rawHeight(name, x, z) {
  const back = clamp01((-(x + z) - 95) / 90);              // far behind town (top of the screen)
  const side = clamp01((Math.abs(x - z) - 85) / 80);
  if (name === 'colorado') {
    let h = (fbm(x / 34, z / 34, 4, 2) - 0.45) * 5;
    const ridge = 1 - Math.abs(2 * fbm(x / 46, z / 46, 5, 7) - 1);
    h += back * (ridge * ridge * 46 + 6) + side * ridge * 10;
    // an irregular lake shore
    const dl = Math.hypot(x - LAKE.x, z - LAKE.z) + (fbm(x / 9, z / 9, 3, 41) - 0.5) * 9;
    // a bowl for the lake with a gentle sandy shelf, then firm banks all round, so the
    // water's edge follows the shore and nothing pokes up through it
    if (dl < LAKE.r + 7) h = Math.min(h, -1.8 + smooth(LAKE.r - 4, LAKE.r + 7, dl) * 2.3);
    else if (dl < LAKE.r + 18) h = Math.max(h, 0.5) + (h - Math.max(h, 0.5)) * smooth(LAKE.r + 12, LAKE.r + 18, dl);
    // level ground under the farm fields, so the crops lie flat with no grass poking through
    for (const [fx, fz, w, d] of FIELDS) {
      const e = Math.max(Math.abs(x - fx) - w / 2, Math.abs(z - fz) - d / 2);
      if (e < 6) h = h + (0.3 - h) * (1 - smooth(0, 6, e));
    }
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
    const ds = Math.hypot(x - 66, z - 64);
    if (ds < 22) h = h * smooth(14, 22, ds) + 0.02;   // the salt flat
    return Math.max(h, mesaAt(name, x, z).h);
  }
  if (name === 'mars') {
    // wind-carved ripples, a wide canyon across the back, a giant shield volcano off to the
    // side, and a few frosty craters
    let h = (fbm(x / 24, z / 24, 4, 21) - 0.5) * 2.2 + Math.sin(x * 0.22 + z * 0.12 + fbm(x / 12, z / 12, 2, 5) * 4) * 0.25;
    const along = (x - z) * 0.7071, across = -(x + z) * 0.7071;
    const wob = (fbm(along / 40, 0.5, 3, 61) - 0.5) * 30;
    const cd = Math.abs(across - 150 - wob);                         // the canyon, far behind town
    h += 7 * smooth(80, 130, across) * (0.7 + 0.6 * fbm(along / 30, across / 30, 2, 17));   // the rising land it cuts into
    if (cd < 26) h -= 14 * (1 - smooth(8, 26, cd)) * smooth(90, 120, across);
    const vd = Math.hypot(x + 130, z - 10);                          // the volcano
    h += 40 * Math.max(0, 1 - vd / 95) ** 1.6 - (vd < 12 ? 10 * (1 - vd / 12) : 0);
    for (const c of MARS_CRATERS) {
      const d = Math.hypot(x - c[0], z - c[1]), r = c[2];
      if (d < r * 1.8) h += -c[3] * Math.max(0, 1 - (d / r) ** 2) + c[3] * 0.5 * Math.exp(-(((d - r) / (r * 0.3)) ** 2));
    }
    return Math.max(h, mesaAt(name, x, z).h);
  }
  // moon: bumpy ground and craters, plus the big craters and highland massifs round town
  let h = (fbm(x / 20, z / 20, 4, 3) - 0.5) * 1.6 + (fbm(x / 4, z / 4, 2, 19) - 0.5) * 0.3;
  for (const c of MOON_CRATERS) {
    const d = Math.hypot(x - c[0], z - c[1]), r = c[2];
    if (d < r * 1.8) h += -c[3] * Math.max(0, 1 - (d / r) ** 2) + c[3] * 0.55 * Math.exp(-(((d - r) / (r * 0.28)) ** 2));
  }
  h += back * (1 - Math.abs(2 * fbm(x / 40, z / 40, 4, 8) - 1)) * 26;
  return h + moonAt(x, z).h;
}
// The Moon's landmarks, clear of the town, the two roads out and the landing spot:
// big craters [x, z, radius, depth] with terraced walls, a raised rim, a blanket of
// ejecta and (in the larger ones) a central peak, and rugged highland massifs
// [x, z, radius, height] of sharp ridges and gullies.
const BIG_CRATERS = [[-50, 46, 15, 5], [54, -40, 18, 6], [-46, -48, 13, 4.5], [8, -66, 21, 6.5], [64, -4, 9, 3.5], [-20, 72, 13, 4.5], [-80, 30, 11, 4]];
const MASSIFS = [[-82, -78, 26, 15], [80, -78, 24, 13], [-92, 70, 22, 11], [90, 46, 20, 11], [22, 104, 24, 12], [-108, -14, 18, 12]];
const ridged = (x, z, seed) => { let v = 0, a = 0.5, f = 1; for (let o = 0; o < 4; o++) { v += a * (1 - Math.abs(2 * vnoise(x * f, z * f, seed + o) - 1)) ** 2; a *= 0.5; f *= 2.1; } return v / 0.94; };
function moonAt(x, z) {
  let h = 0, bowl = 0, rim = 0, ray = 0, high = 0;
  for (const [cx, cz, r, dep] of BIG_CRATERS) {
    const dx = x - cx, dz = z - cz;
    if (Math.abs(dx) > r * 3.2 || Math.abs(dz) > r * 3.2) continue;
    const ang = Math.atan2(dz, dx), wob = (fbm(Math.cos(ang) * 2 + cx, Math.sin(ang) * 2 + cz, 2, 31) - 0.5) * 0.12;
    const d = Math.hypot(dx, dz) / r + wob;
    // the bowl: flat-floored, with terraces stepping up the inner wall
    let b = 0;
    if (d < 1) { const t = d * d; b = -dep * (1 - t); const terr = Math.sin(d * Math.PI * 4) * 0.12 * dep * smooth(0.45, 0.8, d); b += terr; }
    // the raised rim, sharp inside and sloping away outside, then the ejecta blanket
    const rimH = dep * 0.6 * (d < 1 ? Math.exp(-(((d - 1) / 0.16) ** 2)) : Math.exp(-(((d - 1) / 0.42) ** 2)));
    const blanket = d > 1 ? dep * 0.15 * Math.max(0, 1 - (d - 1) / 1.6) * (0.6 + 0.8 * fbm(x / 3, z / 3, 2, 47)) : 0;
    // a central peak in the bigger ones
    const peak = r > 12 ? dep * 0.75 * Math.exp(-((d / 0.2) ** 2)) * (0.8 + 0.4 * ridged(x / 4, z / 4, 61)) : 0;
    h += b + rimH + blanket + peak;
    bowl = Math.max(bowl, d < 1 ? 1 - d * 0.6 : 0);
    rim = Math.max(rim, Math.exp(-(((d - 1) / 0.18) ** 2)));
    // bright rays thrown out across the plain
    if (d > 1 && d < 3.2) ray = Math.max(ray, Math.pow(Math.abs(Math.sin(ang * 6.5 + cx)), 14) * (1 - (d - 1) / 2.2) * 0.9);
  }
  for (const [mx, mz, mr, mh] of MASSIFS) {
    const d = Math.hypot(x - mx, z - mz) / mr + (fbm(x / 9, z / 9, 2, 37) - 0.5) * 0.35;
    if (d > 1.15) continue;
    const m = smooth(1.15, 0.35, d);
    const v = mh * m * (0.45 + 0.75 * ridged(x / 11, z / 11, 71)) + m * (fbm(x / 2.5, z / 2.5, 2, 73) - 0.5) * 1.2;
    h += v; high = Math.max(high, m);
  }
  return { h, bowl, rim, ray, high };
}
const MOON_CRATERS = (() => {
  const out = []; const r = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(99);
  for (let i = 0; i < 150; i++) {
    const x = (r() - 0.5) * 300, z = (r() - 0.5) * 300, rad = 1.6 + r() ** 2.5 * 12;
    if (townDist(x, z) < rad + 3) continue;
    if (BIG_CRATERS.some(([cx, cz, cr]) => Math.hypot(x - cx, z - cz) < cr * 1.3 + rad)) continue;
    out.push([x, z, rad, 0.8 + rad * 0.18]);
  }
  return out;
})();

const MARS_CRATERS = (() => {
  const out = []; const r = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(313);
  for (let i = 0; i < 26; i++) {
    const x = (r() - 0.5) * 320, z = (r() - 0.5) * 320, rad = 4 + r() ** 2 * 14;
    if (townDist(x, z) < rad + 6) continue;
    out.push([x, z, rad, 0.7 + rad * 0.14]);
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
  // rust and maroon dust over dark basalt, with frost on the heights and in craters
  mars: { grass: [0x8e3820, 0x6e2a18, 0xa8482a, 0x4e1e14], rock: 0x2e1e1c, snow: 0xf3ece8, dirt: 0x9c4a2e },
  moon: { grass: [0x9a9aa0, 0x77777f, 0xaeaeb4, 0x5f6068], rock: 0x86868d, snow: 0xc4c4ca, dirt: 0x8f8f96 },
};

export function buildLand(name, T, blocks) {
  BLOCKS = blocks;
  const tx = textures();
  const H = makeHeight(name);
  const P = PAL[name] || PAL.colorado;
  const ground = new THREE.Group(), scenery = new THREE.Group();
  SHARED.cloudAmt.value = name === 'moon' ? 0 : name === 'desert' ? 0.1 : name === 'mars' ? 0.06 : 0.17;

  // terrain
  const SIZE = 640, SEG = 200;
  const tg = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
  tg.rotateX(-Math.PI / 2);
  const pos = tg.attributes.position;
  const col = new Float32Array(pos.count * 3);
  const c = new THREE.Color(), c2 = new THREE.Color();
  // the colour of the ground at a point (sets c)
  const shade = (x, z, h) => {
    const n = fbm(x / 18, z / 18, 3, 4), n2 = fbm(x / 7, z / 7, 2, 8);
    const g = P.grass;
    c.setHex(g[0]).lerp(c2.setHex(g[1]), smooth(0.35, 0.7, n)).lerp(c2.setHex(g[2]), smooth(0.6, 0.85, n2) * 0.6).lerp(c2.setHex(g[3]), smooth(0.62, 0.8, fbm(x / 40, z / 40, 2, 12)) * 0.7);
    if (h > 6) c.lerp(c2.setHex(P.rock), smooth(6, 12, h + n2 * 4));
    if (h > 20) c.lerp(c2.setHex(P.snow), smooth(20, 28, h + n * 8));
    if (name === 'colorado') {
      // a sandy beach ringing the lake, wet and darker right at the water
      const dl = Math.hypot(x - LAKE.x, z - LAKE.z) + (fbm(x / 9, z / 9, 3, 41) - 0.5) * 9;
      c.lerp(c2.setHex(0xd8c597), smooth(LAKE.r + 9, LAKE.r + 5, dl + (n2 - 0.5) * 2) * 0.9);
      if (h < -0.35 && dl < LAKE.r + 9) c.lerp(c2.setHex(0x9c8a64), 0.7);   // the lake bed (not dry hollows elsewhere)
    }
    if (name === 'mars') {
      // dark basalt showing through the dust in streaks, and frost in the crater floors
      c.lerp(c2.setHex(P.rock), smooth(0.5, 0.68, fbm(x / 22 + z / 60, z / 22, 3, 33)) * 0.8);          // dark lava fields
      c.lerp(c2.setHex(0xc8643a), smooth(0.62, 0.8, fbm(x / 9, z / 9, 2, 91)) * 0.45);                // bright dust drifts
      for (const cr of MARS_CRATERS) { const d = Math.hypot(x - cr[0], z - cr[1]); if (d < cr[2] * 0.75) c.lerp(c2.setHex(P.snow), smooth(cr[2] * 0.75, cr[2] * 0.3, d) * 0.85); }
      if (h > 14) c.lerp(c2.setHex(0x5a2a1e), smooth(14, 26, h));
    }
    if (name === 'moon') {
      // dark lava seas, crater bowls in shadow-grey, bright rims and rays, pale highlands
      const mf = moonAt(x, z);
      c.lerp(c2.setHex(0x5c5d66), smooth(0.55, 0.7, fbm(x / 45, z / 45, 3, 29)) * 0.55);
      c.lerp(c2.setHex(0x6a6b74), mf.bowl * 0.5);
      c.lerp(c2.setHex(0xd8d8de), Math.max(mf.rim * 0.6, mf.ray * 0.55));
      c.lerp(c2.setHex(0xbab4aa), mf.high * 0.55 * (0.7 + 0.6 * n2));
    }
    // mesas: layered rock in bands up the cliffs, a paler cap on top
    const ms = (name === 'desert' || name === 'mars') ? mesaAt(name, x, z) : null;
    if (ms && ms.h > 0.6) {
      const bands = name === 'desert' ? [0xc4693f, 0xdb8f58, 0xb0583a, 0xe3a86e] : [0x7a3420, 0x9c4a2e, 0x5a2a1e, 0xb25a36];
      const k = Math.floor((ms.h + (n2 - 0.5) * 0.8) / 1.5) % 4;
      c.lerp(c2.setHex(bands[k]), smooth(0.6, 1.6, ms.h) * 0.9);
      if (ms.h > ms.top * 0.93) c.lerp(c2.setHex(name === 'desert' ? 0xd9a066 : 0xa8502e), 0.75);
    }
    if (name === 'desert') c.lerp(c2.setHex(0xefe6d2), smooth(21, 12, Math.hypot(x - 66, z - 64) + (n2 - 0.5) * 6) * 0.9);   // salt flat
  };
  // Mesas get their own fine, smooth-shaded patch of ground laid over the land (the land
  // is coarse, which made them look blocky). The coarse land well inside each patch drops
  // out of sight beneath it.
  const MS = (name === 'desert' || name === 'mars') ? MESAS[name]
    : name === 'moon' ? [...BIG_CRATERS.map(([x, z, r]) => [x, z, r * 1.25, r * 1.25, 0, 0]), ...MASSIFS.map(([x, z, r]) => [x, z, r * 0.82, r * 0.82, 0, 0])] : [];
  // each patch covers its mesa's scree skirt (1.45x its size) and a little more; where
  // two overlap, each sits a hair higher than the last so they never flicker
  const patchBox = MS.map(([cx, cz, a, b, , r]) => {
    const A = a * 1.45, B = b * 1.45, ex = Math.hypot(A * Math.cos(r), B * Math.sin(r)) + 2, ez = Math.hypot(A * Math.sin(r), B * Math.cos(r)) + 2;
    return { x0: cx - ex, x1: cx + ex, z0: cz - ez, z1: cz + ez };
  });
  const underPatch = (x, z) => patchBox.some(q => x > q.x0 + 3.5 && x < q.x1 - 3.5 && z > q.z0 + 3.5 && z < q.z1 - 3.5);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    const h = H(x, z);
    pos.setY(i, h - 0.02 - (underPatch(x, z) ? 3 : 0));
    shade(x, z, h);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  tg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  tg.computeVertexNormals();
  const terrain = new THREE.Mesh(tg, withClouds(std(0xffffff, { vertexColors: true, flatShading: true, roughness: name === 'moon' ? 0.95 : 0.9 })));
  terrain.receiveShadow = true;
  ground.add(terrain);
  if (patchBox.length) {
    // rock is faceted; the Moon's craters are smooth, soft dust
    const pmFlat = withClouds(std(0xffffff, { vertexColors: true, flatShading: true, roughness: 0.95 }));
    const pmSoft = withClouds(std(0xffffff, { vertexColors: true, roughness: 0.95 }));
    const soft = k => name === 'moon' && k < BIG_CRATERS.length;
    // overlapping patches get different heights (a few hundredths apart), so they never flicker
    const lift = [];
    patchBox.forEach((q, i) => {
      const used = new Set(patchBox.slice(0, i).map((p, j) => (p.x0 < q.x1 && q.x0 < p.x1 && p.z0 < q.z1 && q.z0 < p.z1) ? lift[j] : -1));
      let l = 0; while (used.has(l)) l++; lift.push(l);
    });
    patchBox.forEach((q, k) => {
      const w = q.x1 - q.x0, d = q.z1 - q.z0, nx = Math.ceil(w / 0.6), nz = Math.ceil(d / 0.6);
      const pg = new THREE.PlaneGeometry(w, d, nx, nz);
      pg.rotateX(-Math.PI / 2); pg.translate((q.x0 + q.x1) / 2, 0, (q.z0 + q.z1) / 2);
      const pp = pg.attributes.position, pc = new Float32Array(pp.count * 3);
      for (let i = 0; i < pp.count; i++) {
        const x = pp.getX(i), z = pp.getZ(i), h = H(x, z);
        pp.setY(i, h + 0.05 + lift[k] * 0.03);
        shade(x, z, h);
        pc[i * 3] = c.r; pc[i * 3 + 1] = c.g; pc[i * 3 + 2] = c.b;
      }
      pg.setAttribute('color', new THREE.BufferAttribute(pc, 3));
      pg.computeVertexNormals();
      const patch = new THREE.Mesh(pg, soft(k) ? pmSoft : pmFlat);
      patch.receiveShadow = true;
      ground.add(patch);
    });
  }
  ground.userData.base = new THREE.Color(P.grass[0]);

  // lake (Colorado)
  if (name === 'colorado') {
    const wg = new THREE.CircleGeometry(LAKE.r + 13, 64);
    wg.rotateX(-Math.PI / 2); wg.translate(LAKE.x, -0.45, LAKE.z);
    const ripples = tx.ripples.clone(); ripples.repeat.set(3, 3); ripples.needsUpdate = true;
    const water = new THREE.MeshStandardMaterial({ color: 0x3a8cc4, roughness: 0.08, metalness: 0.15, transparent: true, opacity: 0.88, bumpMap: ripples, bumpScale: 0.6 });
    water.userData.ripples = ripples;
    const wm = new THREE.Mesh(wg, water); wm.receiveShadow = true;
    ground.add(wm);
    ground.userData.water = ripples;
    // reeds and stones round the water's edge, and a little wooden dock
    const reedM = std(0x6f9a3c, { flatShading: true }), reedTop = std(0x7a5230, { flatShading: true }), stoneM = std(0x9a978f, { flatShading: true });
    const rr = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(555);
    const shore = new Batch();
    for (let a = 0; a < Math.PI * 2; a += 0.05) {
      // find the shoreline along this direction: where the ground comes up to the water
      let d = LAKE.r - 3; while (d < LAKE.r + 12 && H(LAKE.x + Math.cos(a) * d, LAKE.z + Math.sin(a) * d) < -0.45) d += 0.25;
      const x = LAKE.x + Math.cos(a) * (d - 0.4), z = LAKE.z + Math.sin(a) * (d - 0.4);
      if (rr() < 0.55) for (let k = 0; k < 4; k++) {
        const hh = 0.5 + rr() * 0.6, g = new THREE.CylinderGeometry(0.02, 0.03, hh, 4);
        g.translate(x + (rr() - 0.5) * 0.7, -0.45 + hh / 2, z + (rr() - 0.5) * 0.7); shore.add(reedM, g);
        if (rr() < 0.4) { const t = new THREE.CylinderGeometry(0.05, 0.05, 0.16, 5); t.translate(x + (rr() - 0.5) * 0.7, -0.45 + hh, z + (rr() - 0.5) * 0.7); shore.add(reedTop, t); }
      }
      if (rr() < 0.18) { const st = new THREE.DodecahedronGeometry(0.25 + rr() * 0.35, 0); st.scale(1, 0.5, 1); st.translate(x + Math.cos(a) * 0.6, -0.4, z + Math.sin(a) * 0.6); shore.add(stoneM, st); }
    }
    // the dock, on the side facing town
    const da = Math.atan2(-LAKE.z, -LAKE.x);
    let dd = LAKE.r - 3; while (dd < LAKE.r + 12 && H(LAKE.x + Math.cos(da) * dd, LAKE.z + Math.sin(da) * dd) < -0.45) dd += 0.25;
    const plankM = std(0x8a6038, { roughness: 0.9 }), postM = std(0x5a3d24, { roughness: 0.9 });
    const dock = new THREE.Group();
    dock.add(new THREE.Mesh(new THREE.BoxGeometry(5, 0.12, 1.3), plankM));
    for (let k = 0; k < 9; k++) { const pl = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.13, 1.32), postM); pl.position.x = -2.2 + k * 0.55; dock.add(pl); }
    for (const px of [-2.3, -0.8, 0.8, 2.3]) for (const pz of [-0.6, 0.6]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.4, 6), postM); post.position.set(px, -0.6, pz); dock.add(post); }
    dock.position.set(LAKE.x + Math.cos(da) * (dd - 2.2), -0.25, LAKE.z + Math.sin(da) * (dd - 2.2));
    dock.rotation.y = -da;
    dock.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    ground.add(dock);
    const sm = new THREE.Group(); shore.build(sm, { cast: true }); ground.add(...sm.children);
  }

  const HW = ROAD_W / 2, SW = 0.7;

  // ---------- scenery ----------
  const near = new Batch(), far = new Batch(), blobs = [];
  const r = (s => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646)(name === 'colorado' ? 7 : name === 'desert' ? 11 : 13);
  const blocked = (x, z, pad) => {
    if (roadDist(x, z) < HW + SW + pad) return true;
    if (name === 'colorado' && (H(x, z) < -0.3 && Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 20 || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 9 || FIELDS.some(([fx, fz, w, d]) => Math.abs(x - fx) < w / 2 + 1.5 && Math.abs(z - fz) < d / 2 + 1.5))) return true;   // not in the lake, on its beach or on the fields
    if (name !== 'colorado' && Math.hypot(x - 40, z - 40) < 4 + pad * 2) return true;   // the landing spot for the rocket you arrive in (world.js LANDER_AT)
    return townDist(x, z) < 0.5 + pad * 0.3;
  };
  const SPAN = 270, NEAR = 60;
  const place = (count, make, { pad = 0.6, maxH = 99, minH = -0.3, span = SPAN, where = null, blob = 1 } = {}) => {
    let n = 0;
    for (let i = 0; i < count * 8 && n < count; i++) {
      const x = (r() - 0.5) * span, z = (r() - 0.5) * span;
      if (blocked(x, z, pad)) continue;
      if (where && !where(x, z)) continue;
      const h = H(x, z);
      // nothing from the general scatter stands on a mesa (they get their own fallen rocks)
      if (name === 'desert' || name === 'mars') { const m = mesaAt(name, x, z); if (m.h > 0.4) continue; }
      // low ground only matters where there's water: Colorado's hollows away from the lake get trees too
      if (h > maxH || h < minH && (name !== 'colorado' || Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r + 14)) continue;
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
    // little touches so open ground doesn't look like a putting green
    place(1500, S.tuft, { pad: 0.1, blob: 0, span: 180, maxH: 10 });
    place(450, S.pebbles, { pad: 0.1, blob: 0, span: 180 });
    place(40, S.boulder, { minH: 4, blob: 0 });
    // farm fields near the lake side
    const fields = FIELDS;
    // a dense evergreen forest closing in round the town: thin at the town's edge, thick
    // further out (not on the fields or in the lake)
    const inField = (x, z) => fields.some(([fx, fz, w, d]) => Math.abs(x - fx) < w / 2 + 2 && Math.abs(z - fz) < d / 2 + 2);
    const woods = (x, z) => { const d = townDist(x, z); return d > 13 && !inField(x, z) && r() < Math.min(0.95, (d - 13) / 16) * (0.75 + 0.5 * fbm(x / 14, z / 14, 2, 77)); };
    place(2400, S.fir, { where: woods, span: 230, maxH: 30, pad: 0.4, blob: 0.9 });
    place(700, S.pine, { where: woods, span: 230, maxH: 30, pad: 0.3, blob: 0.8 });
    const fieldM = new Map();
    for (const [fx, fz, w, d, color] of fields) {
      if (!fieldM.has(color)) fieldM.set(color, withClouds(std(color, { map: tx.rows, roughness: 0.95 })));
      const g = rect(fx - w / 2, fz - d / 2, fx + w / 2, fz + d / 2, H(fx, fz) + 0.06, 6);
      far.add(fieldM.get(color), g);
    }

  } else if (name === 'desert') {
    place(420, S.saguaro, { pad: 0.5 });
    place(260, S.joshua, { pad: 0.5 });
    place(600, S.shrub, { pad: 0.3, blob: 0.5 });
    place(220, S.barrel, { pad: 0.2, blob: 0.4 });
    place(1100, (r, h) => S.tuft(r, h, [0xc9b06a, 0xb59a52, 0xa8a45c, 0xd6c07c]), { pad: 0.1, blob: 0, span: 180 });
    place(600, (r, h) => S.pebbles(r, h, 0xa87f58), { pad: 0.1, blob: 0, span: 180 });
    place(320, r => S.rock(r, 0, 0xb98b5c), { pad: 0.3, blob: 0.7 });
    place(70, (r, h) => S.boulder(r, h, 0xb5603a), { pad: 1, blob: 0 });
  } else if (name === 'mars') {
    // black basalt boulders and wind-carved spires, rusty stones, frost-dusted rocks, and
    // the odd old lander left from the first missions
    place(700, r => S.rock(r, 0, r() < 0.55 ? 0x3a2420 : 0x8a3a22), { pad: 0.3, blob: 0.8 });
    place(900, (r, h) => S.pebbles(r, h, 0x5a2c22), { pad: 0.1, blob: 0, span: 180 });
    place(120, (r, h) => S.boulder(r, h, 0x2e1e1c), { pad: 1, blob: 0.6 });
    place(160, S.spire, { pad: 1, blob: 0.7 });
    place(90, S.frostRock, { pad: 0.6, blob: 0.5 });
    place(6, S.lander, { pad: 3, span: 150, blob: 0.8 });
  } else {
    place(900, r => S.rock(r, 0, 0x8a8a90), { pad: 0.3, blob: 0.8 });
    place(900, (r, h) => S.pebbles(r, h, 0x8e8e94), { pad: 0.1, blob: 0, span: 180 });
    place(140, (r, h) => S.boulder(r, h, 0x7d7d84), { pad: 1, blob: 0.6 });
    place(40, S.antenna, { pad: 1, span: 160, blob: 0.6 });
    place(24, S.solarArray, { pad: 2, span: 180, blob: 0 });
  }
  // boulders fallen from the cliffs round the foot of each mesa, and a few left on top
  if (name === 'desert' || name === 'mars') {
    const rc = name === 'desert' ? [0xb5603a, 0xc4693f, 0x9c4e30] : [0x5a2a1e, 0x7a3420, 0x2e1e1c];
    const rm = rc.map(c => std(c, { flatShading: true, roughness: 1 }));
    for (const [cx, cz, a, b, ht] of MESAS[name]) {
      let n = 0;
      for (let i = 0; i < 260 && n < 26; i++) {
        const x = cx + (r() - 0.5) * (a + b) * 3, z = cz + (r() - 0.5) * (a + b) * 3;
        const m = mesaAt(name, x, z), onTop = m.h > m.top * 0.97, foot = m.h > 0.05 && m.h < m.top * 0.2;
        if (!(foot || (onTop && r() < 0.25)) || roadDist(x, z) < HW + SW + 1 || townDist(x, z) < 2) continue;
        const h = H(x, z), s = foot ? 0.5 + r() * 1.3 : 0.4 + r() * 0.6;
        const o = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), rm[Math.floor(r() * 3)]);
        o.scale.set(s * (0.8 + r() * 0.5), s * (0.5 + r() * 0.4), s * (0.8 + r() * 0.5)); o.rotation.set(r() * 3, r() * 3, r() * 3);
        o.position.set(x, h + s * 0.25, z);
        const gr = new THREE.Group(); gr.add(o);
        ((Math.abs(x) < NEAR && Math.abs(z) < NEAR) ? near : far).addObject(gr);
        if (h < 4) blobs.push([x, h, z, s]);
        n++;
      }
    }
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
    // a wind-carved basalt spire, layered and leaning
    spire(r) {
      const g = new THREE.Group(), s = 0.8 + r() * 1.6, cols = [0x3a2420, 0x5a2a1e, 0x7a3420];
      let y = 0, w = 0.9 * s;
      for (let k = 0; k < 3 + Math.floor(r() * 2); k++) {
        const hh = (0.6 + r() * 0.7) * s, geo = new THREE.CylinderGeometry(w * 0.75, w, hh, 6);
        const o = mesh(geo, m(cols[k % 3], { roughness: 1 }), (r() - 0.5) * 0.2 * s, y + hh / 2, (r() - 0.5) * 0.2 * s); o.rotation.y = r() * 3; g.add(o);
        y += hh; w *= 0.62 + r() * 0.2;
      }
      g.rotation.z = (r() - 0.5) * 0.25;
      g.userData.r = s * 0.8;
      return g;
    },
    // a dark rock with frost on its top
    frostRock(r) {
      const g = new THREE.Group(), s = 0.5 + r() * 0.9;
      const a = mesh(new THREE.DodecahedronGeometry(0.8 * s, 0), m(0x3a2420, { roughness: 1 }), 0, 0.35 * s, 0); a.scale.y = 0.65; g.add(a);
      const f = mesh(new THREE.DodecahedronGeometry(0.62 * s, 0), m(0xf3ece8, { roughness: 0.6 }), 0.05 * s, 0.62 * s, 0); f.scale.set(1, 0.3, 1); g.add(f);
      g.userData.r = s;
      return g;
    },
    // an old robotic lander from the first missions: a gold-foil body on legs, a dish and
    // two dusty solar wings
    lander(r) {
      const g = new THREE.Group(), s = 1.0 + r() * 0.3;
      g.add(mesh(new THREE.CylinderGeometry(0.7 * s, 0.7 * s, 0.4 * s, 6), m(0xc9a24a, { roughness: 0.4, metalness: 0.6 }), 0, 0.9 * s, 0));
      for (let k = 0; k < 3; k++) { const a = k / 3 * Math.PI * 2; const leg = mesh(new THREE.CylinderGeometry(0.04 * s, 0.04 * s, 1.0 * s, 5), m(0xb9b4a8), Math.cos(a) * 0.75 * s, 0.45 * s, Math.sin(a) * 0.75 * s); leg.rotation.z = Math.cos(a) * 0.35; leg.rotation.x = -Math.sin(a) * 0.35; g.add(leg); }
      for (const sd of [-1, 1]) { const p = mesh(new THREE.BoxGeometry(1.2 * s, 0.04 * s, 0.8 * s), m(0x6a5a5a, { roughness: 0.8 }), sd * 1.3 * s, 0.95 * s, 0); p.rotation.z = sd * 0.2; g.add(p); }
      const dish = mesh(new THREE.SphereGeometry(0.4 * s, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2.4), m(0xe8e4dc, { side: THREE.DoubleSide }), 0.2 * s, 1.5 * s, 0); dish.rotation.x = 0.6; g.add(dish);
      g.add(mesh(new THREE.CylinderGeometry(0.03 * s, 0.03 * s, 0.4 * s, 4), m(0xb9b4a8), 0.2 * s, 1.2 * s, 0));
      g.rotation.z = 0.06;
      g.userData.r = 1.4 * s;
      return g;
    },
    // a tall forest fir: four tiers, dark and dense, for the woods round town
    fir(r) {
      const g = new THREE.Group(), s = 1.0 + r() * 0.9, col = [0x245c33, 0x2b6a3a, 0x1f5230][Math.floor(r() * 3)];
      g.add(mesh(new THREE.CylinderGeometry(0.13 * s, 0.18 * s, 0.6 * s, 5), m(0x5a3d24), 0, 0.3 * s, 0));
      const lm = m(col, {}, 1.0 * s);
      for (let i = 0; i < 4; i++) g.add(mesh(new THREE.ConeGeometry((1.05 - i * 0.22) * s, 1.15 * s, 7), lm, 0, (0.95 + i * 0.55) * s, 0));
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
    // a clump of grass blades, a bit taller and darker (or drier) than the lawn
    tuft(r, h, cols = [0x5f9e3c, 0x6fae44, 0x4f8c36, 0x86b84c]) {
      const g = new THREE.Group(), c = m(cols[Math.floor(r() * cols.length)], {}, 1), n = 4 + Math.floor(r() * 4), s = 0.6 + r() * 0.6;
      for (let i = 0; i < n; i++) {
        const b = mesh(new THREE.ConeGeometry(0.07 * s, (0.35 + r() * 0.35) * s, 3), c, (r() - 0.5) * 0.4 * s, 0, (r() - 0.5) * 0.4 * s);
        b.position.y = b.geometry.parameters.height / 2; b.rotation.set((r() - 0.5) * 0.6, r() * 3, (r() - 0.5) * 0.6);
        g.add(b);
      }
      return g;
    },
    // a few small stones lying together
    pebbles(r, h, color = 0x9a978f) {
      const g = new THREE.Group(), n = 2 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) {
        const sz = 0.1 + r() * 0.16;
        const o = mesh(new THREE.IcosahedronGeometry(sz, 0), m(r() < 0.5 ? color : new THREE.Color(color).multiplyScalar(0.85).getHex()), (r() - 0.5) * 0.9, sz * 0.35, (r() - 0.5) * 0.9);
        o.scale.y = 0.55; o.rotation.y = r() * 3; g.add(o);
      }
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

// ---------- roads ----------
// Built from the road network: stretches in good repair get asphalt, curbs, sidewalks,
// paint and streetlights; Colorado's worn-out stretches are cracked, faded and
// overgrown; stretches not built yet are just land. The roads out of town are good.
// flat pieces of a circle, in world x/z: a pie slice (for tarmac) and a raised curved
// band (for sidewalks and curbs). Angles are measured from +x toward +z.
function pieSlice(cx, cz, r, a0, a1, y, uvScale = 8) {
  const sh = new THREE.Shape(); sh.moveTo(cx, -cz); sh.absarc(cx, -cz, r, -a0, -a1, true); sh.lineTo(cx, -cz);
  const g = new THREE.ShapeGeometry(sh, 16); g.rotateX(-Math.PI / 2); g.translate(0, y, 0);
  const p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / uvScale, p.getZ(i) / uvScale);
  return g;
}
function arcBand(cx, cz, r0, r1, a0, a1, h) {
  const sh = new THREE.Shape(); sh.absarc(cx, -cz, r1, -a0, -a1, true); sh.absarc(cx, -cz, r0, -a1, -a0, false);
  const g = new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 18 }); g.rotateX(-Math.PI / 2);
  return g;
}

export function buildRoads(name, T, stateOf) {
  const tx = textures();
  const group = new THREE.Group();
  const road = new Batch();
  const asphaltM = withClouds(std(T.road, { map: tx.asphalt, roughness: 0.92 }));
  // an old road that's mostly gone back to nature: a strip of dry, yellowing grass
  // with the odd patch of broken tarmac still showing through
  const wornM = withClouds(std(0xa9b25f, { roughness: 1 }));
  const tarM = withClouds(std(0x8e8a78, { map: tx.asphalt, roughness: 0.98 }));
  const weedM = std(0x5f8a3a, { flatShading: true, roughness: 1 });
  const mossM = withClouds(std(0x7fb24e, { roughness: 1 }));
  const walkM = withClouds(std(T.walk, { roughness: 0.9 }));
  const curbM = std(new THREE.Color(T.walk).multiplyScalar(0.82).getHex(), { roughness: 0.9 });
  const paintM = std(0xf4efe0, { roughness: 0.7 });
  const HW = ROAD_W / 2, SW = 0.7, mars = name === 'mars', moon = name === 'moon' || mars;   // Mars roads are lit like the Moon's, not painted
  const edgeM = mars ? new THREE.MeshStandardMaterial({ color: 0xffd7b0, emissive: 0xffa060, emissiveIntensity: 0.3, roughness: 0.4 })
    : new THREE.MeshStandardMaterial({ color: 0x9fd0ff, emissive: 0x4fa8ff, emissiveIntensity: 0.4, roughness: 0.4 });
  edgeM.userData.night = 2.2;
  let seed = 4242;
  const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const good = [], worn = [], plan = [];
  for (const [k, { a, b }] of NET.segs) { const st = stateOf(k); if (st === 'good') good.push({ a, b }); else if (st === 'worn') worn.push({ a, b }); else plan.push({ a, b }); }
  // a road out of town only shows once the town's roads reach the spot where it starts
  const liveExits = NET.exits.filter(e => NET.adj.has(e.node.x + ',' + e.node.z));
  for (const e of liveExits) good.push({ a: e.node, b: exitFar(e), exit: true });
  const span = ({ a, b }) => ({ along: a.z === b.z ? 'x' : 'z', line: a.z === b.z ? a.z : a.x, lo: Math.min(a.z === b.z ? a.x : a.z, a.z === b.z ? b.x : b.z), hi: Math.max(a.z === b.z ? a.x : a.z, a.z === b.z ? b.x : b.z) });
  const strip = (m, sp, lo, hi, y, w = ROAD_W) => road.add(m, sp.along === 'x' ? rect(lo, sp.line - w / 2, hi, sp.line + w / 2, y) : rect(sp.line - w / 2, lo, sp.line + w / 2, hi, y));
  // bends on the edge of town (two roads meeting at a right angle, with nothing at all
  // on the outside of the corner) get a curved outer edge instead of a square one. The
  // curve is centred on the inside corner, so the road keeps its width all the way round.
  // (an old worn-out road carrying on past the corner doesn't count: it gets curbed off)
  const anySeg = (n, dx, dz) => NET.good.has(segKey(n, { x: n.x + dx * BLOCK, z: n.z + dz * BLOCK })) || liveExits.some(e => e.node.x === n.x && e.node.z === n.z && e.dir.x === dx && e.dir.z === dz);
  const round = new Map();   // node key -> { sx, sz }: the outside corner
  for (const sg of good) for (const n of [sg.a, sg.b]) {
    const k = n.x + ',' + n.z;
    if (round.has(k) || !NET.adj.has(k)) continue;
    const ways = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([hx, hz]) => hasRoad(n.x, n.z, { x: hx, z: hz }));
    if (ways.length !== 2 || ways[0][0] === -ways[1][0] && ways[0][1] === -ways[1][1]) continue;
    const sx = -(ways[0][0] + ways[1][0]), sz = -(ways[0][1] + ways[1][1]);
    if (anySeg(n, sx, 0) || anySeg(n, 0, sz)) continue;
    round.set(k, { sx, sz });
  }
  const isRound = (x, z) => round.has(x + ',' + z);
  // worn out: faded, cracked, weeds coming through
  for (const sg of worn) {
    const sp = span(sg);
    strip(wornM, sp, sp.lo - HW, sp.hi + HW, 0.06);
    // grass creeping in from both edges, and patches pushing up through the middle
    for (let i = sp.lo - HW + 0.4; i < sp.hi + HW - 0.4; i += 0.7 + r() * 0.9) {
      for (const sd of [-1, 1]) {
        const rad = 0.35 + r() * 0.55, ins = HW - rad * 0.35 - r() * 0.25;
        const g = new THREE.CircleGeometry(rad, 7); g.rotateX(-Math.PI / 2); g.scale(1.4, 1, 1);
        if (sp.along === 'z') g.rotateY(Math.PI / 2);
        g.translate(sp.along === 'x' ? i : sp.line + sd * ins, 0.066 + r() * 0.004, sp.along === 'x' ? sp.line + sd * ins : i);
        road.add(mossM, g);
      }
      if (r() < 0.35) {
        const g = new THREE.CircleGeometry(0.25 + r() * 0.35, 6); g.rotateX(-Math.PI / 2);
        const off = (r() - 0.5) * (ROAD_W - 1.4);
        g.translate(sp.along === 'x' ? i : sp.line + off, 0.067, sp.along === 'x' ? sp.line + off : i);
        road.add(mossM, g);
      }
    }
    // a few leftover chunks of tarmac
    for (let i = sp.lo + 1.5; i < sp.hi - 1.5; i += 2.5 + r() * 3) {
      const g = new THREE.CircleGeometry(0.35 + r() * 0.45, 5); g.rotateX(-Math.PI / 2); g.scale(1.6, 1, 1); g.rotateY(r() * 3);
      const off = (r() - 0.5) * (ROAD_W - 1.6);
      g.translate(sp.along === 'x' ? i : sp.line + off, 0.064, sp.along === 'x' ? sp.line + off : i);
      road.add(tarM, g);
    }
    for (let i = sp.lo + 1; i < sp.hi - 1; i += 1.0 + r() * 1.2) {
      const off = (r() - 0.5) * (ROAD_W - 0.6), len = 0.6 + r() * 1.4;
      if (r() < 0.8) {
        const w = new THREE.IcosahedronGeometry(0.18 + r() * 0.26, 0); w.scale(1, 0.55, 1);
        const wx = sp.along === 'x' ? i + r() : sp.line + (r() < 0.5 ? -1 : 1) * (HW - 0.2 - r() * 0.6);
        const wz = sp.along === 'x' ? sp.line + (r() < 0.5 ? -1 : 1) * (HW - 0.2 - r() * 0.6) : i + r();
        w.translate(wx, 0.1, wz); road.add(weedM, w);
      }
    }
  }
  // roads not built yet (the Mojave and the Moon): a faint, trampled path in the ground,
  // ragged at the edges like Colorado's old roads, with a little surveyor's stake at each
  // corner, so you can make out the plots without it shouting
  if (plan.length) {
    const trackM = withClouds(std(mars ? 0x7a3420 : moon ? 0xa3a3a9 : 0xe4cd9c, { roughness: 1 }));
    const blendM = withClouds(std(mars ? 0x8e3a22 : moon ? 0x98989e : 0xdcbd86, { roughness: 1 }));
    const pebM = std(mars ? 0x3a2420 : moon ? 0x8a8a90 : 0xbf9466, { flatShading: true, roughness: 1 });
    const stakeM = std(0xcaa877, { roughness: 0.9 });
    const tipM = std(0xff7a3a, { roughness: 0.6 });
    const stakes = new Map();
    for (const sg of plan) {
      const sp = span(sg);
      strip(trackM, sp, sp.lo - HW + 0.6, sp.hi + HW - 0.6, 0.045, ROAD_W - 1.2);
      // ground creeping back in over the edges
      for (let i = sp.lo - HW + 0.6; i < sp.hi + HW - 0.6; i += 0.8 + r() * 0.9) for (const sd of [-1, 1]) {
        const rad = 0.3 + r() * 0.45, ins = HW - 0.6 - rad * 0.3 - r() * 0.2;
        const g = new THREE.CircleGeometry(rad, 7); g.rotateX(-Math.PI / 2); g.scale(1.5, 1, 1);
        if (sp.along === 'z') g.rotateY(Math.PI / 2);
        g.translate(sp.along === 'x' ? i : sp.line + sd * ins, 0.05 + r() * 0.003, sp.along === 'x' ? sp.line + sd * ins : i);
        road.add(blendM, g);
      }
      for (let i = sp.lo + 1; i < sp.hi - 1; i += 2 + r() * 2.5) {
        const w = new THREE.IcosahedronGeometry(0.1 + r() * 0.12, 0); w.scale(1, 0.5, 1);
        const off = (r() - 0.5) * (ROAD_W - 1.4);
        w.translate(sp.along === 'x' ? i : sp.line + off, 0.06, sp.along === 'x' ? sp.line + off : i); road.add(pebM, w);
      }
      for (const n of [sg.a, sg.b]) stakes.set(n.x + ',' + n.z, n);
    }
    for (const n of stakes.values()) {
      const x = n.x + HW + 0.5, z = n.z + HW + 0.5;
      road.add(stakeM, boxAt(0.07, 0.4, 0.07, x, 0, z));
      road.add(tipM, boxAt(0.09, 0.08, 0.09, x, 0.4, z));
    }
  }
  // in good repair
  for (const sg of good) {
    const sp = span(sg);
    // a rounded corner draws its own tarmac, so the road stops at its edge
    const loN = sp.along === 'x' ? isRound(sp.lo, sp.line) : isRound(sp.line, sp.lo), hiN = !sg.exit && (sp.along === 'x' ? isRound(sp.hi, sp.line) : isRound(sp.line, sp.hi));
    strip(asphaltM, sp, sp.lo + (loN ? HW : -HW), sp.hi + (hiN ? -HW : HW), 0.075);
    const lo = sp.lo + HW, hi = sp.hi - (sg.exit ? 0 : HW);
    const a0 = sg.exit && sg.a.x + sg.a.z > sg.b.x + sg.b.z ? sp.lo : lo, a1 = sg.exit && sg.a.x + sg.a.z > sg.b.x + sg.b.z ? sp.hi - HW : hi;
    for (const side of [-1, 1]) {
      if (sp.along === 'x') {
        road.add(walkM, boxAt(a1 - a0, 0.14, SW, (a0 + a1) / 2, 0, sp.line + side * (HW + SW / 2)));
        road.add(curbM, boxAt(a1 - a0, 0.16, 0.12, (a0 + a1) / 2, 0, sp.line + side * (HW + 0.06)));
      } else {
        road.add(walkM, boxAt(SW, 0.14, a1 - a0, sp.line + side * (HW + SW / 2), 0, (a0 + a1) / 2));
        road.add(curbM, boxAt(0.12, 0.16, a1 - a0, sp.line + side * (HW + 0.06), 0, (a0 + a1) / 2));
      }
    }
    if (moon) for (let i = a0 + 1.5; i < a1 - 1; i += 3.5) for (const sd of [-1, 1])
      road.add(edgeM, sp.along === 'x' ? boxAt(0.16, 0.1, 0.16, i, 0.075, sp.line + sd * (HW - 0.12)) : boxAt(0.16, 0.1, 0.16, sp.line + sd * (HW - 0.12), 0.075, i));
    else for (let i = a0 + STOP_R - 1.4; i < a1 - STOP_R + 1.8; i += 2.4)
      road.add(paintM, sp.along === 'x' ? boxAt(1.1, 0.02, 0.14, i, 0.08, sp.line) : boxAt(0.14, 0.02, 1.1, sp.line, 0.08, i));
  }
  // junctions touched by a good road: corners, closed sides, stop lines, crosswalks
  const nodes = new Map();
  for (const sg of good) for (const n of [sg.a, sg.b]) if (!sg.exit || n === sg.a) nodes.set(n.x + ',' + n.z, n);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  for (const n of nodes.values()) {
    const { x, z } = n;
    if (!NET.adj.has(x + ',' + z)) continue;
    const rc = round.get(x + ',' + z);
    if (rc) {
      // the curved corner: tarmac, then the curb and sidewalk following the curve
      const cx = x - rc.sx * HW, cz = z - rc.sz * HW, mid = Math.atan2(rc.sz, rc.sx);
      road.add(asphaltM, pieSlice(cx, cz, ROAD_W, mid - Math.PI / 4, mid + Math.PI / 4, 0.075));
      road.add(walkM, arcBand(cx, cz, ROAD_W, ROAD_W + SW, mid - Math.PI / 4, mid + Math.PI / 4, 0.14));
      road.add(curbM, arcBand(cx, cz, ROAD_W - 0.01, ROAD_W + 0.12, mid - Math.PI / 4, mid + Math.PI / 4, 0.16));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) if (!rc || sx !== rc.sx || sz !== rc.sz) road.add(walkM, boxAt(SW, 0.14, SW, x + sx * (HW + SW / 2), 0, z + sz * (HW + SW / 2)));
    const ways = DIRS.filter(([hx, hz]) => hasRoad(x, z, { x: hx, z: hz }));
    for (const [hx, hz] of DIRS) {
      if (!ways.some(([a, b]) => a === hx && b === hz)) {
        if (rc) continue;   // the curve takes the place of the closed sides
        if (hx) { road.add(walkM, boxAt(SW, 0.14, ROAD_W, x + hx * (HW + SW / 2), 0, z)); road.add(curbM, boxAt(0.12, 0.16, ROAD_W, x + hx * (HW + 0.06), 0, z)); }
        else { road.add(walkM, boxAt(ROAD_W, 0.14, SW, x, 0, z + hz * (HW + SW / 2))); road.add(curbM, boxAt(ROAD_W, 0.16, 0.12, x, 0, z + hz * (HW + 0.06))); }
        continue;
      }
      if (ways.length < 3) continue;   // a bend, not a junction: nobody stops here
      const ax = -hx, az = -hz;
      const cx = x - ax * STOP_R + (-az) * LANE, cz = z - az * STOP_R + ax * LANE;
      road.add(paintM, ax ? boxAt(0.26, 0.022, HW - 0.15, cx, 0.08, cz) : boxAt(HW - 0.15, 0.022, 0.26, cx, 0.08, cz));
      const zc = STOP_R - 0.62;
      if (!moon) for (let k = -3; k <= 3; k++) {
        const off = k * 0.5;
        if (ax) road.add(paintM, boxAt(0.7, 0.022, 0.26, x - ax * zc, 0.08, z + off));
        else road.add(paintM, boxAt(0.26, 0.022, 0.7, x + off, 0.08, z - az * zc));
      }
    }
  }
  road.build(group);

  // streetlights at good junctions, and along the roads out of town
  const poles = new Batch();
  const poleM = std(0x3a3f48, { roughness: 0.45, metalness: 0.6 });
  const headM = std(0x2a2d33, { roughness: 0.5, metalness: 0.4 });
  const lampM = new THREE.MeshStandardMaterial({ color: 0xfff6e2, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.3 });
  const lights = [];
  const lamp = (x, z, ax, az) => {
    if (moon) {
      poles.add(poleM, boxAt(0.18, 0.7, 0.18, x, 0.14, z));
      poles.add(edgeM, boxAt(0.26, 0.16, 0.26, x, 0.84, z));
      lights.push(new THREE.Vector3(x, 0.9, z));
      return;
    }
    const pole = new THREE.CylinderGeometry(0.05, 0.08, 3.0, 8); pole.translate(x, 0.14 + 1.5, z); poles.add(poleM, pole);
    const base = new THREE.CylinderGeometry(0.13, 0.15, 0.25, 8); base.translate(x, 0.14 + 0.12, z); poles.add(poleM, base);
    const len = 0.95, l = Math.hypot(ax, az), ang = Math.atan2(az, ax);
    const arm = new THREE.CylinderGeometry(0.035, 0.035, len, 6); arm.rotateZ(Math.PI / 2); arm.rotateY(-ang); arm.translate(x + ax / l * len / 2, 3.08, z + az / l * len / 2); poles.add(poleM, arm);
    const hx = x + ax / l * len, hz = z + az / l * len;
    const head = new THREE.CylinderGeometry(0.26, 0.3, 0.12, 12); head.translate(hx, 3.0, hz); poles.add(headM, head);
    const lens = new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12); lens.translate(hx, 2.93, hz); poles.add(lampM, lens);
    lights.push(new THREE.Vector3(hx, 2.9, hz));
  };
  const o = HW + SW / 2;
  for (const n of nodes.values()) {
    if (!NET.adj.has(n.x + ',' + n.z)) continue;
    const rc = round.get(n.x + ',' + n.z);
    for (const sd of [1, -1]) {
      if (rc && rc.sx === sd && rc.sz === sd) {
        // on a curved corner the lamp stands on the curve, leaning over the road
        const cx = n.x - rc.sx * HW, cz = n.z - rc.sz * HW, rr = (ROAD_W + SW / 2) / Math.SQRT2;
        lamp(cx + rc.sx * rr, cz + rc.sz * rr, -0.7 * sd, -0.7 * sd);
      } else lamp(n.x + sd * o, n.z + sd * o, -0.7 * sd, -0.7 * sd);
    }
  }
  for (const e of liveExits) for (let d = 14; d <= 110; d += 14) {
    if (e.dir.x) lamp(e.node.x + e.dir.x * d, e.node.z + o, 0, -1);
    else lamp(e.node.x + o, e.node.z + e.dir.z * d, -1, 0);
  }
  poles.build(group, { cast: true });
  return { group, lamps: lights, lampMat: lampM, edgeMat: edgeM };
}
