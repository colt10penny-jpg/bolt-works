// The 3D town: fixed-angle camera, lots, factories, supply trucks, crates, smoke,
// map themes, the rocket launch, and tap picking.
import * as THREE from 'three';
import { FACTORIES } from './economy.js';
import { BUILDERS, box, cyl, mat, truck, car, marsRover, marsCrawler, lunarBuggy, lunarHauler, freightWagon, stagecoach, buckboard, crate, powerPole, tree, pine, cactus, rock } from './models.js';
const cylY = (r, h, color, x, y, z) => cyl(r, r, h, color, x, y, z, 14);
import { Look } from './fx.js';
import { NightFog } from './nightfog.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { GLOW } from './models.js';
import './buildings.js';   // the detailed Colorado buildings replace the plain ones
import { barrel as wBarrel, hay as wHay, crate as wCrate, wheel as wWheel, hitchRail, horse as wHorse } from './buildings-west.js';     // and the Wild West ones
import './buildings-moon.js';     // and the Moon ones
import './buildings-mars.js';     // and the Mars colony
import { withDetail } from './surface.js';
const NIGHT_LIST = () => GLOW.night;
import { buildLand, buildRoads, withClouds, SHARED } from './terrain.js';
import { Traffic, lotRoute, lotDriveways, DRIVEWAYS, setNetwork, NET } from './traffic.js';

import { plotsOf, boundsOf, startView } from './layout.js';
import { STYLE, PROPS } from './upgrades.js';
import { WEST_STYLE, westGear } from './west-upgrades.js';
import { buildWing } from './wings.js';
import { splitBig } from './chunks.js';
import { Puff, PuffLayer } from './puffs.js';
const LOT = 10;
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
// where the rocket you arrived in stands, on open ground just below town
const LANDER_AT = [40, 40];
let BOUNDS = { minX: -36, maxX: 36, minZ: -36, maxZ: 36 };

const THEME = {
  colorado: { ground: 0x8cc65f, sky: 0x8cc65f, hemiSky: 0xfff6e5, hemiGround: 0x5d7a46, sun: 2.2, hemi: 1.6, road: 0x5d6470, walk: 0xcfc9bb, pad: 0xd9d4c7 },
  desert:   { ground: 0xe2c58f, sky: 0xe2c58f, hemiSky: 0xfff1d6, hemiGround: 0xa9875a, sun: 2.4, hemi: 1.5, road: 0x6a6460, walk: 0x9a7248, pad: 0xcaa67a },
  mars:     { ground: 0x7a2e1c, sky: 0x7a2e1c, hemiSky: 0xffe0bc, hemiGround: 0x6a2a1a, sun: 2.4, hemi: 1.4, road: 0x3b2a28, walk: 0xb98a74, pad: 0xd8c2b6 },
  moon:     { ground: 0x9c9ca2, sky: 0x9c9ca2, hemiSky: 0xdfe6ff, hemiGround: 0x3a3d48, sun: 2.6, hemi: 1.2, road: 0x4b4e57, walk: 0xb4b4ba, pad: 0xc9c9cf },
};

// Bake lots of small static meshes into one mesh per material, so a big landscape
// costs a handful of draw calls instead of thousands.
function mergeStatic(src, cast = true) {
  src.updateMatrixWorld(true);
  const byMat = new Map();
  src.traverse(o => {
    if (!o.isMesh) return;
    const g = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    g.applyMatrix4(o.matrixWorld);
    if (!byMat.has(o.material.uuid)) byMat.set(o.material.uuid, { m: o.material, gs: [] });
    byMat.get(o.material.uuid).gs.push(g);
  });
  const out = new THREE.Group();
  for (const { m, gs } of byMat.values()) {
    let n = 0; for (const g of gs) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3);
    let off = 0;
    for (const g of gs) { pos.set(g.attributes.position.array, off * 3); nor.set(g.attributes.normal.array, off * 3); off += g.attributes.position.count; g.dispose(); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m);
    mesh.castShadow = cast; mesh.receiveShadow = true;
    out.add(mesh);
  }
  src.traverse(o => { if (o.isMesh) o.geometry.dispose(); });
  return out;
}

// Plain painted parts (no glow, no glass, not see-through) that share a finish are
// merged into one mesh whose colours live in the vertices, so a detailed building
// still costs only a handful of draw calls.
const PAINT = new Map();
function paintable(mt) {
  return mt.isMeshStandardMaterial && !mt.transparent && !mt.map && !mt.vertexColors && mt.userData.detailK != null &&
    !mt.userData.night && !mt.userData.glow && !mt.userData.baseGlow && !(mt.emissiveIntensity > 0 && mt.emissive?.getHex());
}
function paintMat(mt) {
  const key = [mt.roughness.toFixed(2), mt.metalness.toFixed(2), mt.side, mt.flatShading, mt.userData.detailK].join('|');
  let p = PAINT.get(key);
  if (!p) {
    p = withDetail(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: mt.roughness, metalness: mt.metalness, side: mt.side, flatShading: mt.flatShading }), mt.userData.detailK);
    PAINT.set(key, p);
  }
  return p;
}
// Merge every part of a building that never moves into one mesh per material
// (far fewer draw calls). Parts the animation moves are found by running it a few
// times and seeing what changed.
function bakeModel(m) {
  const g = m.group;
  const snap = new Map();
  g.traverse(o => snap.set(o, [o.position.clone(), o.quaternion.clone(), o.scale.clone(), o.visible]));
  if (m.anim) for (const [t, dt] of [[0.37, 0.05], [1.91, 0.1], [3.3, 0.02], [5.7, 0.2], [8.2, 0.05], [13.1, 0.3]]) { try { m.anim(t, dt); } catch { return; } }
  const moving = new Set();
  g.traverse(o => { const s = snap.get(o); if (!s || !o.position.equals(s[0]) || !o.quaternion.equals(s[1]) || !o.scale.equals(s[2]) || o.visible !== s[3]) moving.add(o); });
  for (const [o, s] of snap) { o.position.copy(s[0]); o.quaternion.copy(s[1]); o.scale.copy(s[2]); o.visible = s[3]; }
  for (const keep of [m.rocket, m.scaffold]) if (keep) moving.add(keep);
  const dynamic = o => { for (let p = o; p && p !== g; p = p.parent) if (moving.has(p)) return true; return false; };
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  const byMat = new Map();
  const statics = [];
  g.traverse(o => { if (o.isMesh && !dynamic(o)) statics.push(o); });
  for (const o of statics) {
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    geo.morphAttributes = {};
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    let target = o.material;
    if (paintable(o.material)) {
      const c = o.material.color, n = geo.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      target = paintMat(o.material);
    }
    if (!byMat.has(target)) byMat.set(target, []);
    byMat.get(target).push(geo);
  }
  for (const o of statics) o.parent.remove(o);
  for (const [material, list] of byMat) {
    const merged = mergeGeometries(list, false);
    list.forEach(x => x.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    g.add(mesh);
  }
  // Moving parts (a crane's jib, a turning wheel, the rocket) move as a whole, so the
  // pieces inside each one can be merged too, in that part's own frame: same look, same
  // motion, far fewer draws. (Rocket flames switch on and off, so they stay separate.)
  const top = [...moving].filter(o => { for (let p = o.parent; p && p !== g; p = p.parent) if (moving.has(p)) return false; return !o.isMesh; });
  for (const root of top) mergeWithin(root, moving);
}
function mergeWithin(root, moving) {
  const skip = new Set();
  root.traverse(o => { if (o !== root && (moving.has(o) || o.userData.flame || o === root.userData.flame)) o.traverse(c => skip.add(c)); });
  if (root.userData.flame) root.userData.flame.traverse(c => skip.add(c));
  const list = [];
  root.traverse(o => {
    if (!o.isMesh || skip.has(o) || o.morphTargetInfluences || Array.isArray(o.material) || o.onBeforeRender !== THREE.Object3D.prototype.onBeforeRender) return;
    for (let p = o; p && p !== root; p = p.parent) if (!p.visible) return;   // hidden pieces stay as they are
    list.push(o);
  });
  if (list.length < 3) return;
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  for (const o of list) {
    const geo = (o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone());
    for (const k of Object.keys(geo.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') geo.deleteAttribute(k);
    geo.morphAttributes = {};
    if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
    geo.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    let target = o.material;
    if (paintable(o.material)) {
      const c = o.material.color, n = geo.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      target = paintMat(o.material);
    }
    const key = target.uuid + (o.castShadow ? 'c' : '') + (o.receiveShadow ? 'r' : '') + '|' + o.renderOrder;
    if (!groups.has(key)) groups.set(key, { target, cast: o.castShadow, receive: o.receiveShadow, order: o.renderOrder, geos: [] });
    groups.get(key).geos.push(geo);
  }
  for (const o of list) o.parent.remove(o);
  for (const { target, cast, receive, order, geos } of groups.values()) {
    const merged = mergeGeometries(geos, false);
    geos.forEach(x => x.dispose());
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, target);
    mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.renderOrder = order;
    root.add(mesh);
  }
}

// the land, scenery and roads never move: work out their placement once instead of every frame
const freezeStatic = root => { root.updateMatrixWorld(true); root.traverse(o => { if (o !== root) { o.matrixAutoUpdate = false; o.matrixWorldAutoUpdate = false; } }); };
const freeGeometry = root => root.traverse(o => { if (o.geometry && !o.geometry.userData.keep) o.geometry.dispose(); });

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

export class World {
  constructor(canvas, labelsEl) {
    this.canvas = canvas;
    this.labelsEl = labelsEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.target = new THREE.Vector3(14, 0, 17);
    this.zoom = 1;
    this.shake = 0;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 600);

    this.lots = {};
    this.selected = null;
    this.onPick = () => {};
    this.onTap = id => this.select(id);      // tap on a building
    this.onBubble = id => this.select(id);   // tap on its bubble
    this.onDelivery = () => {};
    this.smoke = [];
    this.pops = [];
    this.traffic = new Traffic(this.scene);
    this.idleCars = [];      // ambient cars waiting to re-enter town
    this.truckPool = [];
    this.carPool = [];
    this.flowInfo = null;
    this.t = 0;

    this.look = new Look(this.renderer, this.scene, this.camera);
    this.#lights();
    this.look.setLights(this.sun, this.hemi, new THREE.Color(0x8cc65f));
    this.look.setQuality('high');
    this.groundGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.scene.add(this.groundGroup, this.sceneryGroup);
    // set by the game:
    this.typeOf = lot => null;          // what kind of building stands on a plot
    this.lotsOf = type => [];           // every plot with a building of that kind
    this.roadInfo = () => ({ good: new Set(), exits: [], state: () => 'none' });   // the roads
    this.P = {};
    this.#traffic();
    this.#input();
    this.resize();
    // phones report a resize before the new layout has settled (rotating especially), so
    // measure again a moment later, and whenever the canvas itself changes size
    const again = () => { this.resize(); for (const ms of [120, 350, 800]) setTimeout(() => this.resize(), ms); };
    addEventListener('resize', again);
    addEventListener('orientationchange', again);
    window.visualViewport?.addEventListener('resize', again);
    if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => this.resize()).observe(this.canvas);
  }

  #lights() {
    this.hemi = new THREE.HemisphereLight(0xfff6e5, 0x5d7a46, 1.6);
    this.scene.add(this.hemi);
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-18, 40, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 120;
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.035;
    sun.shadow.radius = 3;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  // ---------- map themes ----------
  setSeed(seed) { this.exitSeed = seed >>> 0; this.themeName = null; }
  setTheme(name) {
    if (this.themeName === name) return;
    this.themeName = name;
    // every world has its own plots and buildings: take the old town down
    for (const L of Object.values(this.lots)) { this.scene.remove(L.group); L.label.remove(); }
    this.lots = {}; this.selected = null;
    this.P = plotsOf(name);
    BOUNDS = boundsOf(name);
    for (const id of Object.keys(this.P)) this.#lot({ id, name: 'Open land', color: 0x8a8f99, plot: true });
    // cars on the old roads go home; new ones come in on this world's roads
    for (const c of this.traffic.cars) if (c.kind === 'ambient') this.idleCars.push(c.mesh);
    this.traffic.clear('ambient');
    this.clearDeliveries?.();
    // Mars has its own vehicles (rovers and cargo crawlers): swap the whole fleet when
    // going to or from it
    // a meteor shower doesn't follow you to another world
    this.shower = null; this.nextShower = null;
    for (const m of this.meteorList || []) this.scene.remove(m.obj);
    this.meteorList = [];
    const fleet = name === 'mars' ? 'mars' : name === 'moon' ? 'moon' : name === 'desert' ? 'west' : 'earth';
    if (this.fleet !== fleet) {
      this.traffic.clear('manager');
      for (const m of [...this.idleCars, ...this.truckPool, ...this.carPool]) freeGeometry(m);   // the old world's vehicles
      this.idleCars = []; this.truckPool = []; this.carPool = [];
      this.fleet = fleet;
      this.#makeFleet();
    }
    const T = THEME[name] || THEME.colorado;
    this.T = T;
    const info = this.roadInfo();
    setNetwork(Object.values(this.P), info.good, info.exits);
    DRIVEWAYS.length = 0; DRIVEWAYS.push(...lotDriveways(Object.values(this.P)));
    for (const g of [this.groundGroup, this.sceneryGroup]) {
      for (const c of [...g.children]) { g.remove(c); c.traverse(o => o.geometry?.dispose()); }
    }
    const land = buildLand(name, T, Object.values(this.P));
    for (const c of [...land.ground.children]) this.groundGroup.add(c);
    for (const c of [...land.scenery.children]) this.sceneryGroup.add(c);
    splitBig(this.groundGroup); splitBig(this.sceneryGroup);   // drawn tile by tile, so off-screen parts are skipped
    for (const g of [this.groundGroup, this.sceneryGroup]) freezeStatic(g);
    this.detailGroup = this.sceneryGroup.getObjectByName('detail') || null;
    this.land = land.ground.userData;
    this.heightAt = land.height;
    this.#roads();
    this.scene.fog.near = name === 'moon' ? 260 : name === 'mars' ? 210 : 165; this.scene.fog.far = name === 'moon' ? 600 : name === 'mars' ? 540 : 430;
    if (!this.padMats) this.padMats = {};
    const dusty = name === 'desert';
    if (!this.padMats[name]) this.padMats[name] = withClouds(dusty
      ? new THREE.MeshStandardMaterial({ color: 0xd7b688, map: this.#dustTex(), alphaMap: this.#dustAlpha(), transparent: true, depthWrite: false, roughness: 1 })
      : new THREE.MeshStandardMaterial({ color: T.pad, map: this.#padTex(), roughness: 0.88 }));
    // in the old west a lot is just trodden ground: flat, and fading into the sand round it
    for (const L of Object.values(this.lots)) { L.pad.material = this.padMats[name]; L.pad.userData.box ||= L.pad.geometry;
      if (dusty) { this.dustPlane ||= new THREE.PlaneGeometry(LOT + 1.6, LOT + 1.6).rotateX(-Math.PI / 2).translate(0, 0.07, 0); L.pad.geometry = this.dustPlane; }
      else L.pad.geometry = L.pad.userData.box;
      L.pad.renderOrder = dusty ? -2 : 0; }
    for (const L of Object.values(this.lots)) this.#wild(L, name);
    this.#respawnAmbient();
    this.look.groundBase = new THREE.Color(T.ground);
    this.look.setWorld(name);
    const [sx, sz] = startView(name);
    this.target.set(sx, 0, sz);
  }
  // the roads (and their lamps) for the current network; rebuilt when roads change
  #roads() {
    if (this.roadGroup) { this.scene.remove(this.roadGroup); this.roadGroup.traverse(o => o.geometry?.dispose()); }
    const r = buildRoads(this.themeName, this.T, k => this.roadInfo().state(k));
    splitBig(r.group); freezeStatic(r.group);
    this.roadGroup = r.group;
    this.scene.add(r.group);
    this.roadData = r;
    this.#lampGlow(r.lamps, this.themeName === 'moon' || this.themeName === 'mars');
    this.#moonwalkers();
  }
  // ---------- astronauts out for a walk (the Moon) ----------
  // Little astronauts bound along the sidewalks in slow low-gravity hops, turning back
  // at the end of their block. All of them are one instanced mesh: one draw call.
  #moonwalkers() {
    if (this.walkers) { this.scene.remove(this.walkers.mesh); this.walkers.mesh.geometry.dispose(); this.walkers = null; }
    if (this.themeName !== 'moon') return;
    const segs = [...NET.good].map(k => NET.segs.get(k)).filter(Boolean);
    if (!segs.length) return;
    if (!this.walkerGeo) {
      const parts = [], add = (geo, color, x, y, z) => {
        geo.translate(x, y, z); const c = new THREE.Color(color), n = geo.attributes.position.count, col = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); parts.push(geo.index ? geo.toNonIndexed() : geo);
      };
      add(new THREE.BoxGeometry(0.2, 0.24, 0.14), 0xf2f3f5, 0, 0.36, 0);            // suit
      add(new THREE.BoxGeometry(0.17, 0.2, 0.1), 0xdfe2e8, 0, 0.36, -0.11);         // life-support pack
      add(new THREE.BoxGeometry(0.07, 0.22, 0.09), 0xeef0f3, -0.055, 0.12, 0);      // legs
      add(new THREE.BoxGeometry(0.07, 0.22, 0.09), 0xeef0f3, 0.055, 0.12, 0);
      add(new THREE.BoxGeometry(0.05, 0.2, 0.07), 0xeef0f3, -0.13, 0.33, 0.01);     // arms
      add(new THREE.BoxGeometry(0.05, 0.2, 0.07), 0xeef0f3, 0.13, 0.33, 0.01);
      add(new THREE.SphereGeometry(0.1, 10, 8), 0xf6f7f9, 0, 0.56, 0);              // helmet
      add(new THREE.SphereGeometry(0.075, 10, 6, -Math.PI / 2, Math.PI, 0.6, 1.5), 0xd9a83a, 0, 0.56, 0.035);   // gold visor
      add(new THREE.BoxGeometry(0.21, 0.04, 0.15), 0xe07b2a, 0, 0.42, 0);            // a stripe round the chest
      const g = mergeGeometries(parts.map(p => { for (const k of Object.keys(p.attributes)) if (!['position', 'normal', 'color'].includes(k)) p.deleteAttribute(k); return p; }));
      g.scale(1.25, 1.25, 1.25);
      this.walkerGeo = g;
      this.walkerMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.1 });
    }
    const n = Math.min(18, Math.max(4, Math.round(segs.length * 0.6)));
    const mesh = new THREE.InstancedMesh(this.walkerGeo.clone(), this.walkerMat, n);
    mesh.castShadow = true; mesh.frustumCulled = false;
    const HW = 1.8, off = HW + 0.35, list = [];
    for (let i = 0; i < n; i++) {
      const sg = segs[(i * 7) % segs.length], alongX = sg.a.z === sg.b.z;
      const lo = Math.min(alongX ? sg.a.x : sg.a.z, alongX ? sg.b.x : sg.b.z) + HW + 0.6, hi = Math.max(alongX ? sg.a.x : sg.a.z, alongX ? sg.b.x : sg.b.z) - HW - 0.6;
      const line = (alongX ? sg.a.z : sg.a.x) + (i % 2 ? off : -off);
      list.push({ alongX, lo, hi, line, s: lo + Math.random() * (hi - lo), dir: Math.random() < 0.5 ? 1 : -1, speed: 0.55 + Math.random() * 0.35, ph: Math.random() * 6, pause: 0 });
    }
    this.scene.add(mesh);
    this.walkers = { mesh, list, m: new THREE.Matrix4(), q: new THREE.Quaternion(), e: new THREE.Euler(), v: new THREE.Vector3(), one: new THREE.Vector3(1, 1, 1) };
  }
  #walk(dt) {
    const W = this.walkers;
    if (!W) return;
    W.list.forEach((w, i) => {
      if (w.pause > 0) w.pause -= dt;
      else {
        w.s += w.dir * w.speed * dt; w.ph += dt * 3.2;
        if (w.s > w.hi || w.s < w.lo) { w.s = Math.max(w.lo, Math.min(w.hi, w.s)); w.dir *= -1; w.pause = 1 + Math.random() * 2; }
      }
      const hop = w.pause > 0 ? 0 : Math.abs(Math.sin(w.ph)) * 0.32;
      const x = w.alongX ? w.s : w.line, z = w.alongX ? w.line : w.s;
      const yaw = w.alongX ? (w.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (w.dir > 0 ? 0 : Math.PI);
      W.e.set(w.pause > 0 ? 0 : 0.12, yaw, 0); W.q.setFromEuler(W.e);
      W.m.compose(W.v.set(x, 0.15 + hop, z), W.q, W.one);
      W.mesh.setMatrixAt(i, W.m);
    });
    W.mesh.instanceMatrix.needsUpdate = true;
  }
  #respawnAmbient() {
    const idle = this.idleCars.splice(0);
    for (const m of idle) { const c = this.#ambientRoom() ? this.traffic.spawnAmbient(m, true) : null; if (c) this.#onAmbientEnd(c); else this.idleCars.push(m); }
  }
  // roads were fixed or built: update the network, the road meshes and the loading bays
  roadsChanged() {
    const info = this.roadInfo();
    setNetwork(Object.values(this.P), info.good, info.exits);
    DRIVEWAYS.length = 0; DRIVEWAYS.push(...lotDriveways(Object.values(this.P)));
    this.#roads();
    for (const [id, L] of Object.entries(this.lots)) if (L.model && L.look) { const look = L.look; this.setBuilt(id, false); this.setBuilt(id, true, look); L.bounce = 0; }
    // cars on the road planned their trips on the old roads (where to stop, where to turn),
    // so they start fresh: ambient cars reappear on the new roads, trucks leave on the next run
    for (const c of this.traffic.cars) (c.kind === 'delivery' ? this.truckPool : c.kind === 'manager' ? this.carPool : this.idleCars).push(c.mesh);
    this.traffic.clear();
    this.#respawnAmbient();
  }

  // untouched land on a plot nobody has developed yet, with a for-sale sign
  #wild(L, theme) {
    if (L.wild) { L.group.remove(L.wild); L.wild.traverse(o => o.geometry?.dispose()); }
    const g = new THREE.Group();
    let seed = (L.group.position.x * 73 + L.group.position.z * 19 + 1000) | 0 || 1;
    const r = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 7; i++) {
      const x = (r() - 0.5) * 8, z = (r() - 0.5) * 8;
      if (Math.abs(x - 2.6) < 1.3 && Math.abs(z + 2.6) < 1.3) continue;
      let o;
      if (theme === 'colorado') o = r() < 0.5 ? tree(0.8 + r() * 0.6, [0x3f8f4a, 0x4fa152, 0x357d40][Math.floor(r() * 3)]) : pine(0.8 + r() * 0.7);
      else if (theme === 'desert') o = r() < 0.6 ? cactus(0.7 + r() * 0.5) : rock(0.6 + r(), 0xb98b5c);
      else if (theme === 'mars') o = rock(0.5 + r() * 1.3, r() < 0.6 ? 0x3a2622 : 0x7a3420);   // dark basalt and rusty stones
      else o = rock(0.6 + r() * 1.4, 0x85858b);
      o.position.set(x, 0, z); o.rotation.y = r() * 6.28;
      g.add(o);
    }
    // grass clumps and stones over the whole plot, merged into one piece each
    const blades = [], stones = [];
    for (let i = 0; i < 22; i++) {
      const cx = (r() - 0.5) * 9.5, cz = (r() - 0.5) * 9.5, n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const h = 0.3 + r() * 0.35, b = new THREE.ConeGeometry(0.06, h, 3);
        b.rotateX((r() - 0.5) * 0.6); b.rotateZ((r() - 0.5) * 0.6);
        b.translate(cx + (r() - 0.5) * 0.35, h / 2, cz + (r() - 0.5) * 0.35); blades.push(b);
      }
    }
    for (let i = 0; i < 9; i++) {
      const sz = 0.12 + r() * 0.2, st = new THREE.IcosahedronGeometry(sz, 0);
      st.scale(1, 0.55, 1); st.translate((r() - 0.5) * 9, sz * 0.3, (r() - 0.5) * 9); stones.push(st);
    }
    const grassC = theme === 'colorado' ? 0x5f9e3c : theme === 'desert' ? 0xc2a862 : null;
    const stoneC = theme === 'colorado' ? 0x9a978f : theme === 'desert' ? 0xa87f58 : theme === 'mars' ? 0x4a2c24 : 0x8e8e94;
    if (grassC) g.add(new THREE.Mesh(mergeGeometries(blades.map(b => b.toNonIndexed())), mat(grassC, { flatShading: true })));
    g.add(new THREE.Mesh(mergeGeometries(stones.map(b => b.index ? b.toNonIndexed() : b)), mat(stoneC, { flatShading: true })));
    blades.forEach(b => b.dispose());
    // the sign
    g.add(box(0.14, 1.5, 0.14, 0x7a5230, 2.6, 0, -2.6));
    const sign = box(1.7, 0.9, 0.1, 0xf4efe0, 2.6, 1.15, -2.53);
    g.add(sign, box(1.5, 0.22, 0.12, 0xd9482b, 2.6, 1.6, -2.5), box(1.1, 0.12, 0.12, 0x3a3f48, 2.6, 1.3, -2.5));
    g.traverse(o => { o.userData.lotId = L.def.id; if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    L.group.add(g);
    L.wild = g;
    this.setLand(L.def.id, L.developed || false);
  }
  setLand(id, developed) {
    const L = this.lots[id];
    if (!L) return;
    L.developed = developed;
    if (L.wild) L.wild.visible = !developed;
    L.pad.visible = developed;
    L.sale.visible = developed && !L.model;
  }

  // trodden dirt: blotchy, scuffed, no seams
  #dustTex() {
    if (this.dustTex) return this.dustTex;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    g.fillStyle = '#ececec'; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * N, y = Math.random() * N, r = 10 + Math.random() * 40, v = 200 + Math.random() * 55;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, `rgba(${v},${v - 8},${v - 18},0.5)`); gr.addColorStop(1, `rgba(${v},${v - 8},${v - 18},0)`);
      g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r);
    }
    for (let i = 0; i < 3000; i++) { const v = 190 + Math.random() * 60; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * N, Math.random() * N, 1.5, 1.5); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (this.dustTex = t);
  }
  // full in the middle, fading out over the outer part with a ragged, uneven edge
  #dustAlpha() {
    if (this.dustAlpha) return this.dustAlpha;
    const N = 256, c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d'), img = g.createImageData(N, N);
    const rnd = (() => { let a = 7; return () => ((a = (a * 16807) % 2147483647) / 2147483647); })();
    const bumps = Array.from({ length: 40 }, () => [rnd() * N, rnd() * N, 14 + rnd() * 30, (rnd() - 0.5) * 0.35]);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = Math.abs(x / N * 2 - 1), v = Math.abs(y / N * 2 - 1);
      let d = Math.pow(Math.pow(u, 6) + Math.pow(v, 6), 1 / 6);   // a rounded square
      for (const [bx, by, br, bs] of bumps) { const q = ((x - bx) ** 2 + (y - by) ** 2) / (br * br); if (q < 1) d += bs * (1 - q); }
      const a = Math.max(0, Math.min(1, (0.97 - d) / 0.3));
      const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * a * a * (3 - 2 * a)); img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.NoColorSpace;
    return (this.dustAlpha = t);
  }
  #padTex() {
    if (this.padTex) return this.padTex;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#f2f2f2'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2500; i++) { const v = 215 + Math.random() * 40; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(Math.random() * 256, Math.random() * 256, 2, 2); }
    g.fillStyle = 'rgba(0,0,0,0.13)';
    for (let k = 1; k < 4; k++) { g.fillRect(k * 64 - 1, 0, 2, 256); g.fillRect(0, k * 64 - 1, 256, 2); }
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 252);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    return (this.padTex = t);
  }

  // soft halos round the streetlights after dark
  // night lighting for the streetlights: a soft cone of light under each lamp, a small
  // halo round the lamp itself, and a smooth pool of light on the ground
  #lampGlow(pts, moon = false) {
    for (const k of ['glow', 'pools', 'cones']) if (this[k]) { this.scene.remove(this[k]); this[k].geometry.dispose(); this[k] = null; }
    this.streetLamps = pts; this.bldDirty = true;   // the night fog is rebuilt with the new lamps
    if (!pts.length) return;
    const soft = (size, fn) => {
      const c = document.createElement('canvas'); c.width = c.height = size;
      const g = c.getContext('2d'), img = g.createImageData(size, size);
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const r = Math.hypot(x - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2);
        const a = Math.max(0, Math.min(1, fn(r) + (Math.random() - 0.5) / 255 * 2));   // a touch of dither: no banding
        const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = a * 255;
      }
      g.putImageData(img, 0, 0);
      return new THREE.CanvasTexture(c);
    };
    // a wide, gentle falloff: neighbouring lamps' light overlaps into one even wash
    this.poolTex ||= soft(128, r => r >= 1 ? 0 : Math.exp(-r * r * 3.2) * (1 - r * r));
    this.haloTex ||= soft(64, r => r >= 1 ? 0 : Math.exp(-r * r * 5) * (1 - r));
    const quads = pts.map(p => { const q = new THREE.PlaneGeometry(moon ? 9 : 17, moon ? 9 : 17); q.rotateX(-Math.PI / 2); q.translate(p.x, 0.17, p.z); return q; });
    this.pools = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ map: this.poolTex, color: moon ? (this.themeName === 'mars' ? 0xffb070 : 0x4f9dff) : 0xffc98a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    this.pools.renderOrder = 2;
    this.scene.add(this.pools);
    quads.forEach(q => q.dispose());
    if (moon) return;
    // (the beams of light under each lamp are part of the night fog: nightfog.js)
    const geo = new THREE.BufferGeometry().setFromPoints(pts.map(p => p.clone().setY(p.y - 0.05)));
    this.glow = new THREE.Points(geo, new THREE.PointsMaterial({ map: this.haloTex, color: 0xffe2b8, size: 14, sizeAttenuation: false, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    this.glow.renderOrder = 4;
    this.scene.add(this.glow);
  }

  // the night mist and the shafts of light from streetlights and building lamps
  #nightFog() {
    this.nightFog ||= new NightFog(this.scene);
    const lamps = [], v = new THREE.Vector3();
    for (const L of Object.values(this.lots)) {
      for (const root of [L.model, L.extras]) {
        if (!root) continue;
        root.updateMatrixWorld(true);
        root.traverse(o => {
          const m = o.material;
          if (!o.isMesh || !m?.userData?.night || !m.emissive) return;
          const e = m.emissive;
          if (!(e.r > 0.9 && e.g > 0.55 && e.b < 0.8)) return;   // warm lamps only, not the coloured light strips
          // (some lamps keep their place in the geometry, not on the mesh)
          if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
          o.geometry.boundingBox.getCenter(v).applyMatrix4(o.matrixWorld);
          if (v.y < 0.7) return;
          // which way the lamp faces: out from the middle of the building
          const dx = v.x - L.group.position.x, dz = v.z - L.group.position.z;
          const out = Math.abs(dx) < 0.4 && Math.abs(dz) < 0.4 ? { x: 0, z: 0 } : Math.abs(dx) > Math.abs(dz) ? { x: Math.sign(dx), z: 0 } : { x: 0, z: Math.sign(dz) };
          if (!lamps.some(l => l.p.distanceToSquared(v) < 0.5)) lamps.push({ p: v.clone(), out });
        });
      }
    }
    this.nightFog.build(this.themeName, this.streetLamps || [], lamps.slice(0, 200));
  }

  // after dark, light spilling from each building's windows and yard lights warms the
  // ground all round it, so the town glows as a whole rather than in spots
  #buildingGlow() {
    this.bldDirty = false;
    this.#nightFog();
    if (this.bldPools) { this.scene.remove(this.bldPools); this.bldPools.geometry.dispose(); this.bldPools = null; }
    const quads = [];
    for (const L of Object.values(this.lots)) {
      if (!L.model) continue;
      const p = L.group.position, sz = 22 + (L.tier || 0) * 1.5;
      const q = new THREE.PlaneGeometry(sz, sz); q.rotateX(-Math.PI / 2); q.translate(p.x, 0.16, p.z); quads.push(q);
    }
    if (!quads.length || !this.poolTex) return;
    const moon = this.themeName === 'moon';
    this.bldPools = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ map: this.poolTex, color: moon ? 0x8fb8ff : 0xffb877, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false }));
    this.bldPools.renderOrder = 2;
    this.scene.add(this.bldPools);
    quads.forEach(q => q.dispose());
  }

  // ---------- lots ----------
  #lot(def) {
    const [x, z] = this.P[def.id];
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    const pad = box(LOT - 0.6, 0.15, LOT - 0.6, 0xd9d4c7, 0, 0, 0);
    pad.castShadow = false;
    group.add(pad);
    const ring = new THREE.Group();
    const rc = 0xffd23f;
    ring.add(box(LOT, 0.17, 0.35, rc, 0, 0, -LOT / 2), box(LOT, 0.17, 0.35, rc, 0, 0, LOT / 2),
             box(0.35, 0.17, LOT, rc, -LOT / 2, 0, 0), box(0.35, 0.17, LOT, rc, LOT / 2, 0, 0));
    ring.visible = false;
    group.add(ring);
    const sale = new THREE.Group();
    for (let i = -4; i <= 3; i++) {
      const p = i * 1.1 + 0.25;
      sale.add(box(0.6, 0.18, 0.14, 0x1f8a5b, p, 0.15, -3.9), box(0.6, 0.18, 0.14, 0x1f8a5b, p, 0.15, 3.9),
               box(0.14, 0.18, 0.6, 0x1f8a5b, -3.9, 0.15, p), box(0.14, 0.18, 0.6, 0x1f8a5b, 3.9, 0.15, p));
    }
    // signs stand on the corner with no streetlight next to it
    sale.add(box(0.15, 1.6, 0.15, 0x7a5230, 2.6, 0.15, -2.6));
    sale.add(box(1.6, 1, 0.1, 0xffffff, 2.6, 1.3, -2.52));
    sale.add(box(1.2, 0.18, 0.12, 0x1f8a5b, 2.6, 1.72, -2.48));
    group.add(sale);
    // yard crates (surplus that the next factory isn't using)
    const crates = new THREE.Group();
    const side = Math.sign(x) || 1;
    for (let i = 0; i < 9; i++) {
      const c = crate(def.color === 0xe8e4da ? 0xb9b4a8 : def.color);
      const col = i % 3, row = Math.floor(i / 3) % 2, layer = i >= 6 ? 1 : 0;
      c.position.set(side * (3.9 - col * 0.7 - (layer ? 0.35 : 0)), 0.15 + layer * 0.5, 3.6 - row * 0.7);
      c.visible = false;
      crates.add(c);
    }
    group.add(crates);
    this.scene.add(group);

    const label = document.createElement('button');
    label.className = 'lot-label';
    label.addEventListener('click', e => { e.stopPropagation(); this.onBubble(def.id); });
    this.labelsEl.appendChild(label);

    this.lots[def.id] = { def, group, pad, ring, sale, crates, model: null, anim: null, top: 2.4, label, bounce: 0, grow: 1, speed: 1, at: 0 };
    group.traverse(o => { o.userData.lotId = def.id; });
  }

  // look = { model, color } for this world's version of the building
  setBuilt(id, built, look) {
    const L = this.lots[id];
    this.bldDirty = true;
    if (built && look) L.look = look;
    if (built && !L.model) {
      const color = look?.color ?? L.def.color;
      const m = (BUILDERS[look?.model] || BUILDERS.mine)(color);
      const crateColor = color === 0xe8e4da || color === 0xd8d2c4 || color === 0xcfd3da ? 0xb9b4a8 : color;
      L.crates.children.forEach(c => { c.material = mat(crateColor); });
      m.group.position.y = 0.15;
      L.group.add(m.group);
      L.color = color;
      this.#decorate(L, m, id, L.tier || 0, color);
      bakeModel(m);
      if (L.extras) bakeModel({ group: L.extras });
      this.#ageLook(m.group, L.tier || 0);
      if (L.extras) this.#ageLook(L.extras, L.tier || 0);
      this.#padLook(L, L.tier || 0);
      m.group.traverse(o => { o.userData.lotId = id; });
      L.model = m.group; L.anim = m.anim || null; L.top = m.top;
      L.smokeAt = m.smoke || [];
      L.rocket = m.rocket || null; L.scaffold = m.scaffold || null;
      L.sale.visible = false;
      L.bounce = 1;
    } else if (!built && L.model) {
      // free the old building's geometry from the graphics memory (every building's parts
      // are its own; materials are shared and stay)
      L.group.remove(L.model); freeGeometry(L.model); L.model = null; L.anim = null; L.top = 2.4; L.smokeAt = []; L.sale.visible = !!L.developed;
      if (L.extras) { L.group.remove(L.extras); freeGeometry(L.extras); L.extras = null; }
      L.rocket = null; L.scaffold = null;
      L.crates.children.forEach(c => { c.visible = false; });
    }
  }

  // little touches that make each lot look lived in: rooftop units, a soft shadow
  // under the building, and a couple of parked cars where there's room
  #decorate(L, m, id, tier = 0, color = 0x888888) {
    let seed = [...id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7) % 2147483647 || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
    const g = m.group;
    L.group.updateMatrixWorld(true);
    const meshes = []; g.traverse(o => { if (o.isMesh) meshes.push(o); });
    const bb = new THREE.Box3().setFromObject(g);
    const ray = new THREE.Raycaster(); const down = new THREE.Vector3(0, -1, 0);
    const topAt = (x, z) => { ray.set(new THREE.Vector3(x, 80, z), down); return ray.intersectObjects(meshes, false)[0] || null; };
    const placed = [];
    if (!this.themeName?.startsWith('moon') || true) for (let i = 0; i < 24 && placed.length < 3; i++) {
      const x = bb.min.x + 0.7 + rnd() * Math.max(0, bb.max.x - bb.min.x - 1.4), z = bb.min.z + 0.7 + rnd() * Math.max(0, bb.max.z - bb.min.z - 1.4);
      const hit = topAt(x, z);
      if (!hit || hit.point.y < 1.8 || !hit.face) continue;
      const nrm = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
      if (nrm.y < 0.98) continue;
      // the whole unit has to sit on the same flat roof
      const same = [[0.55, 0.45], [-0.55, 0.45], [0.55, -0.45], [-0.55, -0.45]].every(([dx, dz]) => { const h = topAt(x + dx, z + dz); return h && h.object === hit.object && Math.abs(h.point.y - hit.point.y) < 0.03; });
      if (!same || placed.some(p => Math.hypot(p.x - x, p.z - z) < 1.5)) continue;
      placed.push(hit.point.clone());
      const unit = new THREE.Group();
      if (this.themeName === 'mars') {
        // a heat radiator: a row of angled white blades on a gunmetal base
        unit.add(box(0.9, 0.12, 0.6, 0x3a3d44, 0, 0, 0));
        for (let k = 0; k < 5; k++) { const b = box(0.04, 0.45, 0.55, 0xeef0f2, -0.36 + k * 0.18, 0.12, 0); b.rotation.z = 0.35; unit.add(b); }
        unit.add(box(0.12, 0.05, 0.12, 0xff8a3a, 0.4, 0.12, 0.25, { emissive: 0xff6a1a, emissiveIntensity: 1.2 }));
      } else if (this.themeName === 'desert') {
        // a little wooden rooftop water tank on stubby legs, with iron hoops and a lid
        for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) unit.add(box(0.07, 0.3, 0.07, 0x5e4630, dx, 0, dz));
        unit.add(box(0.7, 0.05, 0.7, 0x6e5232, 0, 0.3, 0));
        unit.add(cyl(0.32, 0.34, 0.5, 0x9a6b42, 0, 0.35, 0, 12));
        for (const k of [0.45, 0.75]) unit.add(cyl(0.345, 0.345, 0.04, 0x3a3f48, 0, k, 0, 12));
        unit.add(cyl(0.05, 0.36, 0.14, 0x5e4c3c, 0, 0.85, 0, 12));
      } else {
        unit.add(box(0.85, 0.42, 0.65, 0xc9ccd2, 0, 0, 0));
        unit.add(box(0.5, 0.05, 0.5, 0x3a3f48, 0, 0.42, 0));
        if (rnd() < 0.5) unit.add(box(0.14, 0.5, 0.14, 0x8a8f99, 0.5, 0, 0.25));
      }
      const local = g.worldToLocal(hit.point.clone());
      unit.position.copy(local); unit.rotation.y = rnd() < 0.5 ? 0 : Math.PI / 2;
      g.add(unit);
    }
    // upgrade tiers add bigger rooftop gear: a water tank, a radio mast, a lit sign
    const roofSpot = (fw, fd, minY = 1.8) => {
      for (let i = 0; i < 30; i++) {
        const x = bb.min.x + fw + rnd() * Math.max(0, bb.max.x - bb.min.x - fw * 2), z = bb.min.z + fd + rnd() * Math.max(0, bb.max.z - bb.min.z - fd * 2);
        const hit = topAt(x, z);
        if (!hit || hit.point.y < minY || !hit.face) continue;
        if (hit.face.normal.clone().transformDirection(hit.object.matrixWorld).y < 0.98) continue;
        const ok = [[fw, fd], [-fw, fd], [fw, -fd], [-fw, -fd]].every(([dx, dz]) => { const h = topAt(x + dx, z + dz); return h && h.object === hit.object && Math.abs(h.point.y - hit.point.y) < 0.03; });
        if (!ok || placed.some(p => Math.hypot(p.x - x, p.z - z) < fw + fd + 0.6)) continue;
        placed.push(hit.point.clone());
        return g.worldToLocal(hit.point.clone());
      }
      return null;
    };
    // each kind of building has its own upgrades: what goes on the roof (or the yard) at
    // levels 3, 5, 7 and 8, and a golden beacon at level 10
    const style = STYLE[this.typeOf?.(id)] || STYLE.default;
    // the Wild West has its own additions and gear for every kind of building
    const west = this.themeName === 'desert' ? (WEST_STYLE[this.typeOf?.(id)] || WEST_STYLE.default) : null;
    const later = [], ground = [];   // no room on the main roof: onto a wing, or into the yard
    [2, 4, 6, 7, 9].forEach((need, k) => {
      if (tier < need) return;
      const name = k < 4 ? (west ? west.props[k] : style.props[k]) : 'beacon';
      const P = west ? westGear(name, color, this.typeOf?.(id)) : PROPS[name](color, k);
      if (P.ground) { ground.push(P.g); return; }
      const p = roofSpot(P.fw, P.fd, P.minY || 1.8);
      if (p) { P.g.position.copy(p); g.add(P.g); } else later.push(P.g);
    });
    // on the lot itself
    const ex = new THREE.Group();
    const lx = L.group.position.x, lz = L.group.position.z;
    const w = bb.max.x - bb.min.x, d = bb.max.z - bb.min.z;
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(9.2, w * 1.25), Math.min(9.2, d * 1.25)), this.#aoMat());
    shadow.rotation.x = -Math.PI / 2; shadow.position.set((bb.min.x + bb.max.x) / 2 - lx, 0.162, (bb.min.z + bb.max.z) / 2 - lz);
    shadow.renderOrder = 1;
    ex.add(shadow);
    // loading bays with garage doors, on each side trucks use
    // (only factories trucks deliver to: no bays on power, compute or the headquarters)
    if (!['power', 'datacenter', 'hq'].includes(this.typeOf?.(id))) for (const side of this.#baySides(id)) ex.add(this.#bay(side, color));
    // free corners: an extra wing for each upgrade tier, parked cars in the rest
    let corners = [[3.25, 3.3], [-3.25, 3.3], [3.25, -3.3], [-3.25, -3.3]]
      .filter(([cx, cz]) => !L.crates.children.some(c => Math.abs(c.position.x - cx) < 1.8 && Math.abs(c.position.z - cz) < 1.8));
    const cored = west || (this.themeName === 'mars' && m.group.children.some(o => o.userData.core));
    if (cored) {
      // On the frontier the barrels, horses and hay round the main building only hold a
      // corner until something better comes along: a corner is free as long as the main
      // building itself hardly stands in it (sampled on a grid, ignoring low things like
      // track and boardwalk), and whatever claims it clears the clutter away.
      const coreG = m.group.children.find(o => o.userData.core);
      const coreMeshes = []; coreG?.traverse(o => { if (o.isMesh) coreMeshes.push(o); });
      const coreTop = (x, z) => { ray.set(new THREE.Vector3(x, 80, z), down); const h = ray.intersectObjects(coreMeshes, false)[0]; return h ? h.point.y - L.group.position.y : 0; };
      corners = corners.map(([cx, cz]) => [Math.sign(cx) * 3.2, Math.sign(cz) * 3.2]).filter(([cx, cz]) => {
        let tall = 0;
        for (let a = -1; a <= 1; a += 0.5) for (let b = -1; b <= 1; b += 0.5) if (coreTop(lx + cx + a, lz + cz + b) > 0.6) tall++;
        return tall <= 4;
      });
      // the corners the camera sees best fill in first
      corners.sort((a, b) => (b[0] + b[1]) - (a[0] + a[1]));
    } else corners = corners.filter(([cx, cz]) => { const hit = topAt(lx + cx, lz + cz); return !(hit && hit.point.y > 0.6); });
    const clearCorner = ([cx, cz]) => {
      if (!cored) return;
      for (const o of [...m.group.children]) if (!o.userData.core && Math.abs(o.position.x - cx) < 1.45 && Math.abs(o.position.z - cz) < 1.45) m.group.remove(o);
    };
    const wings = tier >= 5 ? 3 : tier >= 3 ? 2 : tier >= 1 ? 1 : 0;
    const wingTops = corners.slice(0, wings).map(([cx, cz], i) => { clearCorner([cx, cz]); const wg = this.#wing(cx, cz, color, tier, i, west ? west.wings[i] : style.wing); ex.add(wg); return [cx, wg.userData.top + 0.15, cz]; });
    // yard props take the free corners first; anything that didn't fit on the main roof
    // goes on a wing roof, or failing that into a free corner
    let spare = corners.slice(wings);
    ground.forEach(it => {
      const c = spare.shift();
      if (c) { clearCorner(c); it.position.set(c[0], 0.15, c[1]); ex.add(it); } else later.push(it);
    });
    later.forEach((it, i) => {
      const at = wingTops[i % Math.max(1, wingTops.length)] || (spare[i] ? [spare[i][0], 0.15, spare[i][1]] : null);
      if (!at) return;
      it.position.set(at[0], at[1], at[2]); ex.add(it);
    });
    if (tier <= 1 && this.themeName === 'desert') {
      // an old frontier yard: barrels, hay bales, a broken wagon wheel and a woodpile, a
      // bleached steer skull on a post, and drifts of blown dust
      for (const [cx, cz] of corners.slice(wings, wings + 2)) {
        wBarrel(ex, cx - 0.5, cz + 0.2); wBarrel(ex, cx - 0.05, cz + 0.45); wBarrel(ex, cx - 0.3, cz - 0.2, 0.15, 0.85);
        wHay(ex, cx + 0.55, cz + 0.35, 0.15, 0.3); wHay(ex, cx + 0.5, cz + 0.4, 0.51, 0.1);
        const wheel = wWheel(ex, cx + 0.7, 0.55, cz - 0.85, 0.4, 0.5); wheel.rotation.x = 0.25;
        for (let k = 0; k < 5; k++) ex.add(cyl(0.09, 0.09, 0.9, 0x8a6a45, cx - 0.5 + (k % 3) * 0.2, 0.25 + Math.floor(k / 3) * 0.17 - 0.45, cz - 0.9, 7).rotateX(Math.PI / 2));
      }
      const c0 = corners[wings];
      if (c0) {
        ex.add(box(0.08, 1.1, 0.08, 0x7a5a3a, c0[0] - 0.9, 0.15, c0[1] + 0.9));
        const skull = new THREE.Group();
        skull.add(box(0.22, 0.16, 0.3, 0xf2ead8, 0, 0, 0), box(0.6, 0.06, 0.06, 0xf2ead8, 0, 0.06, -0.08));
        for (const sx of [-1, 1]) { const horn = box(0.05, 0.22, 0.05, 0xe8dcc0, sx * 0.31, 0.06, -0.08); horn.rotation.z = -sx * 0.5; skull.add(horn); }
        skull.position.set(c0[0] - 0.9, 1.3, c0[1] + 0.98); ex.add(skull);
      }
      const sandM = this.sandM ||= new THREE.MeshBasicMaterial({ color: 0xb08a5c, transparent: true, opacity: 0.6, depthWrite: false });
      for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.6, 10), sandM); st.rotation.x = -Math.PI / 2; st.scale.set(1.8, 1, 0.8); st.position.set((rnd() - 0.5) * 7, 0.165, (rnd() - 0.5) * 7); ex.add(st); }
    } else if (tier <= 1 && this.themeName === 'mars') {
      // an early colony yard: supply canisters off the last ship, striped cargo crates and
      // a cracked spare wheel, with drifts of red dust
      // (each corner picks its own: no two lots alike)
      const yard = [
        (ex, cx, cz) => {   // supply canisters, striped crates and a cracked spare wheel
          for (let k = 0; k < 3; k++) { const can = cyl(0.24, 0.24, 0.9, k === 1 ? 0xff8a3a : 0xddd6c8, cx - 0.45 + 0.3 * k, 0.15 + 0.24 - 0.45, cz + 0.5 * (k % 2), 14).rotateZ(Math.PI / 2); ex.add(can); }
          for (let k = 0; k < 3; k++) { ex.add(box(0.55, 0.45, 0.55, 0x666a72, cx + 0.5, 0.15 + (k === 2 ? 0.45 : 0), cz - 0.75 + (k === 1 ? 0.6 : 0))); ex.add(box(0.57, 0.08, 0.57, 0xff8a3a, cx + 0.5, 0.15 + (k === 2 ? 0.45 : 0) + 0.3, cz - 0.75 + (k === 1 ? 0.6 : 0))); }
          const tyre = new THREE.Mesh(new THREE.TorusGeometry(0.38, 0.12, 6, 14), mat(0x2a2d33)); tyre.rotation.set(1.2, 0.3, 0); tyre.position.set(cx - 0.7, 0.3, cz - 0.8); ex.add(tyre);
        },
        (ex, cx, cz) => {   // a pair of fold-out solar panels charging a battery box
          for (const dx of [-0.55, 0.55]) { ex.add(box(0.07, 0.55, 0.07, 0x3a3d44, cx + dx, 0.15, cz)); const p = box(0.95, 0.05, 0.75, 0x1d3550, cx + dx, 0.68, cz, { roughness: 0.25, metalness: 0.5 }); p.rotation.x = -0.5; ex.add(p); }
          ex.add(box(0.5, 0.35, 0.35, 0xddd6c8, cx, 0.15, cz + 0.75), box(0.3, 0.06, 0.02, 0x6fe8ff, cx, 0.35, cz + 0.93, { emissive: 0x6fe8ff, night: 2 }));
        },
        (ex, cx, cz) => {   // a little survey rover parked up, its mast camera up
          ex.add(box(0.95, 0.32, 0.6, 0xe8e4dc, cx, 0.42, cz), box(0.97, 0.06, 0.62, 0xff8a3a, cx, 0.6, cz));
          for (const [dx, dz] of [[-0.35, -0.36], [0.35, -0.36], [-0.35, 0.36], [0.35, 0.36]]) ex.add(cyl(0.16, 0.16, 0.12, 0x2a2d33, cx + dx, 0.31 - 0.06, cz + dz, 10).rotateX(Math.PI / 2));
          ex.add(box(0.05, 0.5, 0.05, 0xb9b4a8, cx + 0.3, 0.66, cz - 0.15), box(0.2, 0.12, 0.12, 0x3a3d44, cx + 0.3, 1.16, cz - 0.15));
          const pan = box(0.7, 0.03, 0.5, 0x1d3550, cx - 0.15, 0.68, cz, { roughness: 0.25, metalness: 0.5 }); ex.add(pan);
        },
        (ex, cx, cz) => {   // cut ice blocks and a rack of cryo bottles
          for (const [dx, y, dz] of [[-0.4, 0, -0.3], [0.1, 0, -0.35], [-0.15, 0.4, -0.3], [0.5, 0, 0.3]]) ex.add(box(0.42, 0.4, 0.42, 0xd2f0fa, cx + dx, 0.15 + y, cz + dz, { roughness: 0.15, transparent: true, opacity: 0.9 }));
          ex.add(box(0.9, 0.08, 0.35, 0x3a3d44, cx - 0.2, 0.15, cz + 0.65));
          for (let k = 0; k < 4; k++) ex.add(cyl(0.1, 0.1, 0.65, k % 2 ? 0x6fc3e0 : 0xeef1f4, cx - 0.5 + k * 0.2, 0.23, cz + 0.65, 10));
        },
        (ex, cx, cz) => {   // a tripod antenna and a cable drum
          for (let k = 0; k < 3; k++) { const a = k * 2.094; const l = box(0.04, 1.1, 0.04, 0xb9b4a8, cx + Math.cos(a) * 0.25, 0.15, cz + Math.sin(a) * 0.25); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2); ex.add(l); }
          const dish = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2.6), mat(0xe8e4dc, { side: THREE.DoubleSide })); dish.rotation.x = 2.3; dish.position.set(cx, 1.35, cz); ex.add(dish);
          const drum = cyl(0.35, 0.35, 0.4, 0xff8a3a, cx + 0.7, 0.5, cz + 0.4, 14); drum.rotation.x = Math.PI / 2; drum.position.y = 0.5; ex.add(drum);
          ex.add(cyl(0.22, 0.22, 0.42, 0x2a2d33, cx + 0.7, 0.5, cz + 0.4, 14).rotateX(Math.PI / 2));
        },
      ];
      for (const [cx, cz] of corners.slice(wings, wings + 2)) yard[Math.floor(rnd() * yard.length)](ex, cx, cz);
      const dustM = this.dustM ||= new THREE.MeshBasicMaterial({ color: 0xa8482a, transparent: true, opacity: 0.45, depthWrite: false });
      for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.6, 10), dustM); st.rotation.x = -Math.PI / 2; st.scale.set(1.8, 1, 0.8); st.position.set((rnd() - 0.5) * 7, 0.165, (rnd() - 0.5) * 7); ex.add(st); }
    } else if (tier <= 1 && this.themeName === 'moon') {
      // an early moonbase yard: each corner its own little scene
      const yard = [
        (ex, cx, cz) => {   // white supply drums and foil-wrapped cargo
          for (let k = 0; k < 3; k++) ex.add(cyl(0.24, 0.24, 0.6, k === 1 ? 0xd9a83a : 0xeef0f3, cx + (k - 1) * 0.5, 0.15, cz + (k % 2) * 0.35, 12));
          ex.add(box(0.7, 0.5, 0.55, 0xd9a83a, cx + 0.3, 0.15, cz - 0.8, { metalness: 0.7, roughness: 0.35 }), box(0.45, 0.35, 0.45, 0xc9ced6, cx + 0.25, 0.65, cz - 0.8));
        },
        (ex, cx, cz) => {   // a little solar panel array on its stand
          ex.add(box(0.08, 0.6, 0.08, 0x5b5f66, cx, 0.15, cz));
          for (const s of [-1, 1]) { const p = box(0.75, 0.04, 0.9, 0x223f78, cx + s * 0.45, 0.75, cz, { roughness: 0.25, metalness: 0.4 }); p.rotation.z = s * 0.15; ex.add(p); }
          ex.add(box(0.4, 0.3, 0.3, 0xeef0f3, cx - 0.2, 0.15, cz + 0.75), box(0.25, 0.05, 0.02, 0x9fe8ff, cx - 0.2, 0.32, cz + 0.91, { emissive: 0x4fb8ff, night: 2 }));
        },
        (ex, cx, cz) => {   // an old descent stage left from a landing, with a flag
          ex.add(box(0.9, 0.45, 0.9, 0xd9a83a, cx, 0.45, cz, { metalness: 0.7, roughness: 0.35 }));
          for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = box(0.05, 0.6, 0.05, 0xc9ced6, cx + dx * 0.55, 0.15, cz + dz * 0.55); l.rotation.set(dz * 0.35, 0, -dx * 0.35); ex.add(l); ex.add(cyl(0.12, 0.12, 0.03, 0xc9ced6, cx + dx * 0.68, 0.15, cz + dz * 0.68, 8)); }
          ex.add(box(0.04, 1.3, 0.04, 0xdddddd, cx + 0.9, 0.15, cz + 0.6), box(0.5, 0.32, 0.02, 0xf2f2f2, cx + 0.66, 1.1, cz + 0.6), box(0.5, 0.025, 0.025, 0xdddddd, cx + 0.66, 1.43, cz + 0.6));
          for (let k = 0; k < 3; k++) ex.add(box(0.5, 0.045, 0.025, 0xd9482b, cx + 0.66, 1.14 + k * 0.1, cz + 0.612));
        },
        (ex, cx, cz) => {   // gas bottles in a rack and a cable drum
          ex.add(box(1.0, 0.08, 0.4, 0x5b5f66, cx - 0.1, 0.15, cz - 0.4));
          for (let k = 0; k < 4; k++) ex.add(cyl(0.11, 0.11, 0.75, [0x7fb3e6, 0xeef0f3, 0x4fb3a8, 0xeef0f3][k], cx - 0.45 + k * 0.23, 0.23, cz - 0.4, 10));
          const drum = cyl(0.32, 0.32, 0.36, 0xe07b2a, cx + 0.4, 0, cz + 0.55, 14); drum.rotation.x = Math.PI / 2; drum.position.y = 0.47; ex.add(drum);
        },
        (ex, cx, cz) => {   // a moon buggy parked up
          ex.add(box(1.1, 0.1, 0.75, 0xc9ced6, cx, 0.42, cz), box(0.35, 0.3, 0.5, 0xeef0f3, cx - 0.3, 0.52, cz));
          for (const [dx, dz] of [[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]]) ex.add(cyl(0.2, 0.2, 0.12, 0x8a8f99, cx + dx, 0.3 - 0.06, cz + dz, 12).rotateX(Math.PI / 2));
          ex.add(box(0.03, 0.55, 0.03, 0x5b5f66, cx + 0.4, 0.52, cz + 0.25));
          const dsh = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.04, 0.06, 12), mat(0xeef0f3)); dsh.position.set(cx + 0.4, 1.1, cz + 0.25); ex.add(dsh);
        },
      ];
      for (const [cx, cz] of corners.slice(wings, wings + 2)) yard[Math.floor(rnd() * yard.length)](ex, cx, cz);
      // boot prints and drifts of grey dust
      const greyM = this.greyDustM ||= new THREE.MeshBasicMaterial({ color: 0x7a7a82, transparent: true, opacity: 0.4, depthWrite: false });
      for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.CircleGeometry(0.5 + rnd() * 0.6, 10), greyM); st.rotation.x = -Math.PI / 2; st.scale.set(1.8, 1, 0.8); st.position.set((rnd() - 0.5) * 7, 0.165, (rnd() - 0.5) * 7); ex.add(st); }
    } else if (tier <= 1) {
      // an old yard: rusty drums, a pile of tyres and oil stains
      for (const [cx, cz] of corners.slice(wings, wings + 2)) {
        for (let k = 0; k < 3; k++) ex.add(cyl(0.26, 0.26, 0.62, [0x8a4b2a, 0x6b5a3a, 0x7d3f26][k], cx + (k - 1) * 0.55, 0.15, cz + (k % 2) * 0.4, 10));
        for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.12, 6, 12), mat(0x24252a)); t.rotation.x = Math.PI / 2; t.position.set(cx + 0.2, 0.27 + k * 0.22, cz - 0.9); ex.add(t); }
      }
      const stainM = this.stainM ||= new THREE.MeshBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.35, depthWrite: false });
      for (let k = 0; k < 4; k++) { const st = new THREE.Mesh(new THREE.CircleGeometry(0.4 + rnd() * 0.5, 10), stainM); st.rotation.x = -Math.PI / 2; st.scale.set(1.5, 1, 1); st.position.set((rnd() - 0.5) * 7, 0.165, (rnd() - 0.5) * 7); ex.add(st); }
    }
    if (tier >= 7) {
      // a smart new campus: white planters with young trees in the free corners
      for (const [cx, cz] of spare.slice(0, 1)) {
        if (this.themeName === 'moon' || this.themeName === 'mars') {
          // off-world: a little glass greenhouse bubble with plants glowing inside
          ex.add(cyl(0.75, 0.8, 0.25, 0xeef0f3, cx, 0.15, cz, 20));
          for (let k = -1; k <= 1; k++) ex.add(box(0.9 - Math.abs(k) * 0.25, 0.22, 0.2, 0x5cc04a, cx, 0.4, cz + k * 0.3, { emissive: 0x6dff5a, emissiveIntensity: 0.35 }));
          const dm = new THREE.Mesh(new THREE.SphereGeometry(0.72, 18, 9, 0, Math.PI * 2, 0, Math.PI / 2), mat(0xd8fff0, { transparent: true, opacity: 0.32, roughness: 0.08, depthWrite: false, emissive: 0x7dff9a, emissiveIntensity: 0.15 }));
          dm.position.set(cx, 0.4, cz); ex.add(dm);
          continue;
        }
        ex.add(box(1.3, 0.45, 1.3, 0xf2f2f0, cx, 0.15, cz));
        ex.add(cyl(0.07, 0.09, 0.9, 0x6b4a2b, cx, 0.6, cz, 6));
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 0), mat(0x4fa152, { flatShading: true })); crown.position.set(cx, 1.65, cz); ex.add(crown);
      }
    }
    if (this.themeName === 'desert') for (const [cx, cz] of spare.slice(tier <= 1 ? 2 : tier >= 7 ? 1 : 0)) {
      // horses tied up at a hitching rail with a water trough
      if (rnd() < 0.4) continue;
      const sx = Math.sign(cx) || 1;
      hitchRail(ex, cx, cz, 1.4, false);
      wHorse(ex, cx - sx * 0.55, cz - 0.3, sx > 0 ? 0 : Math.PI, [0x7a4a2a, 0x2a2420, 0xd8c8b0, 0x5a3a26][Math.floor(rnd() * 4)]);
      if (rnd() < 0.6) wHorse(ex, cx - sx * 0.55, cz + 0.35, sx > 0 ? 0 : Math.PI, [0x7a4a2a, 0x2a2420, 0xb07a4a][Math.floor(rnd() * 3)]);
    } else if (this.themeName !== 'moon' && this.themeName !== 'mars') for (const [cx, cz] of spare.slice(tier <= 1 ? 2 : tier >= 7 ? 1 : 0)) {
      if (rnd() < 0.45) continue;
      const colors = [0xe85a3c, 0x2f7fd1, 0xf3f0e8, 0x3a3f48, 0xffc23d, 0x6b8f5a];
      const c = car(colors[Math.floor(rnd() * colors.length)]);
      c.rotation.y = Math.PI / 2; c.position.set(cx, 0.15, cz);
      ex.add(c);
      for (const sx of [-0.65, 0.65]) ex.add(box(0.08, 0.02, 1.9, 0xf4efe0, cx + sx, 0.15, cz));
    }
    L.group.add(ex);
    L.extras = ex;
  }
  // Low levels look old and run down: faded, dusty paint, matte and grimy. High levels
  // look new and sleek: richer colour, smooth satin finishes with a bit of shine.
  // (Lights and windows keep their own materials so they still glow at night.)
  #ageLook(group, tier) {
    const age = Math.max(0, Math.min(1, (3 - tier) / 3)), modern = Math.max(0, Math.min(1, (tier - 5) / 4));
    if (!age && !modern) return;
    this.ageCache ||= new Map();
    const dirt = new THREE.Color(this.themeName === 'moon' ? 0x8a8a90 : 0x857866), hsl = {};
    group.traverse(o => {
      if (!o.isMesh || !o.material || Array.isArray(o.material)) return;
      const m0 = o.material;
      if (!m0.isMeshStandardMaterial || m0.userData.night || m0.userData.glow || m0.userData.baseGlow || (m0.emissiveIntensity > 0 && m0.emissive?.getHex())) return;
      const vc = m0.vertexColors && o.geometry.attributes.color;
      if (vc && !o.geometry.userData.aged) {
        // the same change as below, done to each vertex's colour
        o.geometry.userData.aged = true;
        const a = vc.array, c = new THREE.Color();
        for (let i = 0; i < a.length; i += 3) {
          c.setRGB(a[i], a[i + 1], a[i + 2]);
          if (age) c.lerp(dirt, 0.42 * age).multiplyScalar(1 - 0.2 * age);
          else { c.getHSL(hsl); c.setHSL(hsl.h, Math.min(1, hsl.s * (1 + 0.35 * modern)), Math.min(0.92, hsl.l + 0.05 * modern)); }
          a[i] = c.r; a[i + 1] = c.g; a[i + 2] = c.b;
        }
        vc.needsUpdate = true;
      }
      const key = m0.uuid + '|' + tier + (this.themeName === 'moon' ? 'm' : '');
      let m = this.ageCache.get(key);
      if (!m) {
        m = m0.clone(); m.userData = { ...m0.userData };
        if (m0.onBeforeCompile) m.onBeforeCompile = m0.onBeforeCompile;
        if (vc) {
          // colour already done in the vertices; just the finish
          m.roughness = age ? Math.min(1, m.roughness + 0.25 * age) : m.roughness + (0.3 - m.roughness) * modern * 0.85;
          m.metalness = age ? m.metalness * (1 - age) : Math.max(m.metalness, 0.22 * modern);
        } else if (age) {
          m.color.lerp(dirt, 0.42 * age).multiplyScalar(1 - 0.2 * age);
          m.roughness = Math.min(1, m.roughness + 0.25 * age); m.metalness *= 1 - age;
        } else {
          m.color.getHSL(hsl);
          m.color.setHSL(hsl.h, Math.min(1, hsl.s * (1 + 0.35 * modern)), Math.min(0.92, hsl.l + 0.05 * modern));
          m.roughness = m.roughness + (0.3 - m.roughness) * modern * 0.85;
          m.metalness = Math.max(m.metalness, 0.22 * modern);
        }
        this.ageCache.set(key, m);
      }
      o.material = m;
    });
  }
  // the concrete yard: cracked and dusty when old, clean and bright when new
  #padLook(L, tier) {
    const base = this.padMats?.[this.themeName];
    if (!base) return;
    this.padLooks ||= new Map();
    const key = this.themeName + '|' + tier;
    if (!this.padLooks.has(key)) {
      const m = base.clone(); m.userData = { ...base.userData };
      if (base.onBeforeCompile) m.onBeforeCompile = base.onBeforeCompile;
      if (this.themeName === 'desert') { if (tier <= 1) m.color.lerp(new THREE.Color(0xb08a5e), 0.25); else if (tier >= 7) m.color.lerp(new THREE.Color(0xf0dcb8), 0.3); }
      else if (tier <= 1) { m.color.lerp(new THREE.Color(0x8f8068), 0.45); m.roughness = 1; }
      else if (tier <= 3) m.color.lerp(new THREE.Color(0xa89c86), 0.2);
      else if (tier >= 7) { m.color.lerp(new THREE.Color(0xffffff), 0.35); m.roughness = 0.6; }
      this.padLooks.set(key, m);
    }
    L.pad.material = this.padLooks.get(key);
  }

  // a frontier freight dock: a raised plank dock with its edge on posts, a big barn door
  // swung open, a little shed roof on brackets, a lantern, and freight waiting to go
  #ramada(side, color) {
    const g = new THREE.Group();
    const W = 2.1, H = 1.75, D = 1.7, PL = 0x8a6a45, DK = 0x5e4630;
    g.add(box(W + 0.4, H + 0.2, 0.12, 0x7a5a3a, 0, 0, -D / 2 + 0.02));                     // the timber door frame
    g.add(box(W, H, 0.12, 0x1e1a16, 0, 0, -D / 2 + 0.08));                                   // the dark doorway
    // the door leaves folded right back flat against the wall, with their white Z-braces
    for (const sd of [-1, 1]) {
      g.add(box(0.5, H - 0.1, 0.05, color, sd * (W / 2 + 0.45), 0, -D / 2 + 0.12));
      const zb = box(0.04, 1.6, 0.02, 0xeee4cc, sd * (W / 2 + 0.45), 0.05, -D / 2 + 0.15); zb.rotation.z = sd * 0.28; g.add(zb);
    }
    // the raised plank dock in front of the door, with a step down
    g.add(box(W + 0.3, 0.3, 0.9, PL, 0, 0, -D / 2 + 0.55));
    for (let k = 0; k < 7; k++) g.add(box(0.03, 0.005, 0.88, DK, -W / 2 + 0.1 + k * 0.32, 0.3, -D / 2 + 0.55));
    g.add(box(W + 0.3, 0.06, 0.08, DK, 0, 0.26, -D / 2 + 1.0));
    // a short shed roof over the door on two brackets
    const roof = box(W + 0.3, 0.05, 0.6, 0x5e4c3c, 0, H + 0.12, -D / 2 + 0.32); roof.rotation.x = 0.25; g.add(roof);
    for (const x of [-W / 2 + 0.05, W / 2 - 0.05]) { const br = box(0.06, 0.06, 0.5, DK, x, H - 0.12, -D / 2 + 0.28); br.rotation.x = 0.7; g.add(br); }
    g.add(box(0.16, 0.22, 0.16, 0xffd9a0, W / 2 + 0.25, H - 0.35, -D / 2 + 0.2, { emissive: 0xffc070, night: 2.5 }));   // a lantern
    wCrate(g, W / 2 - 0.15, -D / 2 + 0.45, 0.3, 0.38); wBarrel(g, -W / 2 + 0.3, -D / 2 + 0.45, 0.3, 0.8);
    // further out than elsewhere: the frontier buildings are bigger
    const dist = 3.2, rot = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[side];
    g.rotation.y = rot;
    g.position.set(side === 'x+' ? dist : side === 'x-' ? -dist : 0, 0.15, side === 'z+' ? dist : side === 'z-' ? -dist : 0);
    return g;
  }

  // a Mars loading bay: a pressure door with its frame lit orange and a ribbed blast door
  // rolled up, under a slim canopy, with guide lights on the ground
  #airlockBay(side, color) {
    const g = new THREE.Group();
    const W = 2.1, H = 1.8, D = 1.6;
    g.add(box(W + 0.4, H + 0.3, 0.14, 0x3a3d44, 0, 0, -D / 2 + 0.02));
    g.add(box(W, H, 0.12, 0x14161a, 0, 0, -D / 2 + 0.1));
    for (let k = 0; k < 4; k++) g.add(box(W - 0.1, 0.07, 0.06, 0x8a8f99, 0, H - 0.12 - k * 0.1, -D / 2 + 0.18));
    for (const x of [-W / 2 - 0.05, W / 2 + 0.05]) g.add(box(0.07, H, 0.06, 0xff8a3a, x, 0, -D / 2 + 0.12, { emissive: 0xff6a1a, emissiveIntensity: 1, night: 2 }));
    // a slim canopy cantilevered off the wall on two angled struts, lit along its edge
    const canopy = box(W + 0.5, 0.06, D * 0.75, 0xddd6c8, 0, H + 0.12, -D / 2 + D * 0.375); canopy.rotation.x = -0.12; g.add(canopy);
    g.add(box(W + 0.5, 0.05, 0.05, 0x6fe8ff, 0, H + 0.02, -D / 2 + D * 0.75, { emissive: 0x6fe8ff, night: 2.4 }));
    for (const x of [-W / 2 - 0.1, W / 2 + 0.1]) { const st = box(0.06, 0.06, D * 0.8, 0x666a72, x, H - 0.45, -D / 2 + D * 0.38); st.rotation.x = 0.55; g.add(st); }
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x2a2d33)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.012; g.add(floor);
    for (let k = 0; k < 3; k++) for (const x of [-W / 2 + 0.15, W / 2 - 0.15]) g.add(box(0.1, 0.02, 0.1, 0x6fe8ff, x, 0.01, D / 2 - 0.3 - k * 0.45, { emissive: 0x6fe8ff, night: 2.4 }));
    const dist = 2.75, rot = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[side];
    g.rotation.y = rot;
    g.position.set(side === 'x+' ? dist : side === 'x-' ? -dist : 0, 0.15, side === 'z+' ? dist : side === 'z-' ? -dist : 0);
    return g;
  }

  // a lunar docking bay: kept low so the building behind it still shows. A pressurised
  // dock hatch against the building with a gold-foil collar, a light arch over the
  // entrance, and a landing-strip floor of chevrons and blue guide lights.
  #dockBay(side, color) {
    const g = new THREE.Group();
    const W = 2.0, D = 1.7;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.2, D), mat(0x3c3f47)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.012; g.add(floor);
    for (let k = 0; k < 3; k++) for (const s of [-1, 1]) {
      const c = box(0.6, 0.015, 0.12, 0xffc23d, s * 0.28, 0.0, D / 2 - 0.35 - k * 0.42); c.rotation.y = s * 0.6; g.add(c);
    }
    for (let k = 0; k < 4; k++) for (const x of [-W / 2, W / 2]) g.add(box(0.09, 0.05, 0.09, 0x9fe8ff, x, 0.0, D / 2 - 0.2 - k * 0.42, { emissive: 0x4fb8ff, emissiveIntensity: 1.2 }));
    // the dock hatch: a squat pressure door in a thick ring, gold foil round it
    g.add(box(W + 0.3, 1.25, 0.3, 0xeef0f3, 0, 0, -D / 2 + 0.1));
    g.add(box(W + 0.36, 0.14, 0.34, 0xd9a83a, 0, 1.25, -D / 2 + 0.1, { metalness: 0.7, roughness: 0.3 }));
    g.add(box(W - 0.4, 0.95, 0.06, 0x2a2d33, 0, 0.08, -D / 2 + 0.27));
    for (let k = 0; k < 3; k++) g.add(box(W - 0.5, 0.04, 0.03, 0x5b5f66, 0, 0.3 + k * 0.25, -D / 2 + 0.31));
    g.add(box(0.12, 0.12, 0.06, 0x7dff9a, W / 2 - 0.05, 0.85, -D / 2 + 0.28, { emissive: 0x4dff7a, emissiveIntensity: 1.3 }));
    // the light arch at the entrance
    for (const x of [-W / 2 - 0.1, W / 2 + 0.1]) { g.add(box(0.1, 1.45, 0.1, 0xd8dbe2, x, 0, D / 2 - 0.1)); g.add(box(0.13, 0.4, 0.13, 0xffc23d, x, 0, D / 2 - 0.1)); }
    g.add(box(W + 0.35, 0.1, 0.12, 0xd8dbe2, 0, 1.45, D / 2 - 0.1));
    g.add(box(W - 0.2, 0.04, 0.06, 0x9fe8ff, 0, 1.41, D / 2 - 0.03, { emissive: 0x4fb8ff, night: 2.4 }));
    const dist = 2.75, rot = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[side];
    g.rotation.y = rot;
    g.position.set(side === 'x+' ? dist : side === 'x-' ? -dist : 0, 0.15, side === 'z+' ? dist : side === 'z-' ? -dist : 0);
    return g;
  }

  // which sides of a lot trucks drive in and out of: every side with good road
  #baySides(id) {
    const [lx, lz] = this.P[id];
    const h = 7, sides = new Set();
    const seg = (a, b) => { const ka = a.join(), kb = b.join(); return ka < kb ? ka + '|' + kb : kb + '|' + ka; };
    if (NET.good.has(seg([lx + h, lz - h], [lx + h, lz + h]))) sides.add('x+');
    if (NET.good.has(seg([lx - h, lz - h], [lx - h, lz + h]))) sides.add('x-');
    if (NET.good.has(seg([lx - h, lz + h], [lx + h, lz + h]))) sides.add('z+');
    if (NET.good.has(seg([lx - h, lz - h], [lx + h, lz - h]))) sides.add('z-');
    return sides;
  }
  // a loading bay: an open dock under a light canopy on two posts, with the open door
  // into the building at the back. It's open at the sides so the building's own front
  // still shows.
  #bay(side, color) {
    if (this.themeName === 'desert') return this.#ramada(side, color);
    if (this.themeName === 'mars') return this.#airlockBay(side, color);
    if (this.themeName === 'moon') return this.#dockBay(side, color);
    const g = new THREE.Group();
    const wall = new THREE.Color(color).lerp(new THREE.Color(0x777777), 0.35).getHex();
    const W = 2.1, H = 1.75, D = 1.7;
    g.add(box(W + 0.24, H + 0.16, 0.1, new THREE.Color(wall).multiplyScalar(0.7).getHex(), 0, 0, -D / 2 + 0.02));   // door frame
    g.add(box(W, H, 0.12, 0x1e2126, 0, 0, -D / 2 + 0.08));                                // the open door
    g.add(box(W - 0.1, 0.36, 0.08, 0x9aa0a8, 0, H - 0.38, -D / 2 + 0.16));                  // rolled-up door
    const roof = box(W + 0.4, 0.1, D + 0.15, new THREE.Color(wall).multiplyScalar(0.8).getHex(), 0, H + 0.1, 0.05);
    roof.rotation.x = 0.06; g.add(roof);
    for (let k = 0; k < 6; k++) g.add(box(0.4, 0.1, 0.05, k % 2 ? 0x2a2a2e : 0xffc23d, -1.0 + k * 0.4, H + 0.06, D / 2 + 0.11));   // hazard fascia
    for (const x of [-W / 2 - 0.08, W / 2 + 0.08]) g.add(box(0.09, H + 0.1, 0.09, 0x5b5f66, x, 0, D / 2 + 0.02));                      // posts
    for (const x of [-W / 2 - 0.08, W / 2 + 0.08]) g.add(box(0.1, 0.5, 0.1, 0xffc23d, x, 0, D / 2 + 0.02));                                // post guards
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), mat(0x2a2d33)); floor.rotation.x = -Math.PI / 2; floor.position.y = 0.012; g.add(floor);
    g.add(box(0.26, 0.08, 0.2, 0xfff1cf, 0, H, 0, { emissive: 0xffd28a, night: 2.5 }));   // a lamp under the canopy
    // the open front faces the driveway
    const dist = 2.75;
    const rot = { 'x+': Math.PI / 2, 'x-': -Math.PI / 2, 'z+': 0, 'z-': Math.PI }[side];
    g.rotation.y = rot;
    g.position.set(side === 'x+' ? dist : side === 'x-' ? -dist : 0, 0.15, side === 'z+' ? dist : side === 'z-' ? -dist : 0);
    return g;
  }
  // an extra wing added by an upgrade tier
  #wing(cx, cz, color, tier, i, kind = 'brick') {
    return buildWing({ kind, theme: this.themeName, cx, cz, color, tier, i });
  }
  // ---------- meteor showers (Moon and Mars) ----------
  // Every few minutes, at random, a shower of shooting stars streaks down onto a small
  // patch of open ground away from town: glowing heads with fiery tails, a flash and a
  // puff of dust where each one lands, and little craters that glow and cool.
  #meteors(dt) {
    const on = this.themeName === 'moon' || this.themeName === 'mars';
    this.meteorList ||= [];
    if (on && this.ready) {
      this.nextShower ??= 40 + Math.random() * 80;
      this.nextShower -= dt;
      if (this.nextShower <= 0) { this.startShower(); this.nextShower = 150 + Math.random() * 210; }
    }
    // the shower in progress: drop its meteors one after another
    const sh = this.shower;
    if (sh) {
      sh.t += dt;
      while (sh.left > 0 && sh.t >= sh.next) { sh.left--; sh.next += 0.15 + Math.random() * 0.55; this.#meteor(sh); }
      if (sh.left <= 0) this.shower = null;
    }
    for (let i = this.meteorList.length - 1; i >= 0; i--) {
      const m = this.meteorList[i];
      m.age += dt;
      if (m.kind === 'rock') {
        const k = Math.min(1, m.age / m.life);
        m.obj.position.lerpVectors(m.from, m.to, k);
        if (k >= 1) { this.#impact(m.to, m.big); this.scene.remove(m.obj); this.meteorList.splice(i, 1); }
      } else {
        const k = m.age / m.life;
        if (m.kind === 'flash') { m.obj.material.opacity = Math.max(0, 1 - k) * 0.9; const sc = 1 + k * 3; m.obj.scale.set(sc, sc, sc); }
        else if (m.kind === 'crater') m.obj.material.emissiveIntensity = Math.max(0, 1.6 * (1 - k));
        if (k >= 1) { this.scene.remove(m.obj); m.obj.geometry.dispose(); m.obj.material.dispose?.(); this.meteorList.splice(i, 1); }
      }
    }
  }
  // start a shower now, on a patch of open ground (exported for testing)
  startShower() {
    if (this.shower) return;
    let x = 0, z = 0;
    for (let k = 0; k < 40; k++) {
      const a = Math.random() * Math.PI * 2, r = 44 + Math.random() * 20;
      x = Math.cos(a) * r; z = Math.sin(a) * r + 6;
      if (!NET.roads?.some(rd => x > rd.x0 - 4 && x < rd.x1 + 4 && z > rd.z0 - 4 && z < rd.z1 + 4)) break;
    }
    this.shower = { x, z, t: 0, next: 0, left: 9 + Math.floor(Math.random() * 8) };
  }
  #meteor(sh) {
    const big = Math.random() < 0.25;
    const tx = sh.x + (Math.random() - 0.5) * 12, tz = sh.z + (Math.random() - 0.5) * 12;
    const ty = (this.heightAt?.(tx, tz) ?? 0) + 0.1;
    const to = new THREE.Vector3(tx, ty, tz);
    const dir = new THREE.Vector3(0.75, -0.75, -0.75).normalize();   // across the screen, not toward the camera
    const from = to.clone().addScaledVector(dir, -44);
    const g = new THREE.Group();
    const hot = this.themeName === 'mars' ? 0xffb070 : 0xcfe6ff;
    const head = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.5 : 0.35, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    g.add(head);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(big ? 1.3 : 0.9, 12, 10), new THREE.MeshBasicMaterial({ color: hot, transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false })));
    const tail = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.75 : 0.5, big ? 14 : 10, 10, 1, true), new THREE.MeshBasicMaterial({ color: hot, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    tail.position.y = big ? 7 : 5;           // the cone points back up the way it came
    const tg = new THREE.Group(); tg.add(tail);
    tg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
    g.add(tg);
    g.position.copy(from);
    this.scene.add(g);
    this.meteorList.push({ kind: 'rock', obj: g, from, to, age: 0, life: 1.0 + Math.random() * 0.5, big });
  }
  #impact(p, big) {
    const hot = this.themeName === 'mars' ? 0xffa060 : 0xd8ecff;
    const flash = new THREE.Mesh(new THREE.SphereGeometry(big ? 1.4 : 0.9, 14, 10), new THREE.MeshBasicMaterial({ color: hot, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    flash.position.copy(p); this.scene.add(flash);
    this.meteorList.push({ kind: 'flash', obj: flash, age: 0, life: 0.5 });
    const crater = new THREE.Mesh(new THREE.CircleGeometry(big ? 1.2 : 0.75, 14), new THREE.MeshStandardMaterial({ color: 0x2a1a14, emissive: 0xff6a20, emissiveIntensity: 1.6, roughness: 1 }));
    crater.rotation.x = -Math.PI / 2; crater.position.set(p.x, p.y + 0.03, p.z); this.scene.add(crater);
    this.meteorList.push({ kind: 'crater', obj: crater, age: 0, life: 14 });
    const dustC = this.themeName === 'mars' ? 0xb8603a : 0xb9b9c0;
    for (let i = 0; i < (big ? 8 : 5); i++) {
      const m = this.#puff(dustC, false, 1.0 + Math.random() * (big ? 1.6 : 1.0));
      const a = Math.random() * Math.PI * 2, r = Math.random() * 1.2;
      m.position.set(p.x + Math.cos(a) * r, p.y + 0.4 + Math.random() * 0.6, p.z + Math.sin(a) * r);
      this.scene.add(m);
      this.smoke.push({ m, age: Math.random() * 0.2, life: 1.4 + Math.random(), spread: true });
    }
  }

  #dust(L) {
    for (let i = 0; i < 14; i++) {
      const m = this.#puff(0xcfc3ad, false, 1.6 + Math.random() * 1.6);
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 2;
      m.position.set(L.group.position.x + Math.cos(a) * r, 0.6 + Math.random(), L.group.position.z + Math.sin(a) * r);
      this.scene.add(m);
      this.smoke.push({ m, age: Math.random() * 0.3, life: 1.6 + Math.random(), spread: true });
    }
  }

  #aoMat() {
    if (this.ao) return this.ao;
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d');
    const img = g.createImageData(64, 64);
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      const dx = Math.max(0, Math.abs(x - 31.5) - 18) / 14, dy = Math.max(0, Math.abs(y - 31.5) - 18) / 14;
      const a = Math.max(0, 1 - Math.hypot(dx, dy));
      img.data[(y * 64 + x) * 4 + 3] = a * a * 120;
    }
    g.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(c);
    return (this.ao = new THREE.MeshBasicMaterial({ map: t, color: 0x000000, transparent: true, depthWrite: false }));
  }

  // milestone levels make the building a bit taller and wider
  // fraction of the screen (from the top) that's free above an open panel
  setFreeTop(frac) {
    // centre the building in the space between the top bar and the panel
    const y = Math.min(0.5, Math.max(0.3, (0.12 + frac) / 2));
    this.panelShift = Math.min(0.8, Math.max(0, 1 - 2 * y));
    if (this.selected) this.viewShiftTarget = this.panelShift;
  }

  // building work on a lot: 'build' (a construction site; the building appears when it's
  // done), 'upgrade' (a crane and scaffolding beside the building), or null
  setWork(id, mode) {
    const L = this.lots[id];
    if (!L || (L.work || null) === (mode || null)) return;
    if (L.site) { L.group.remove(L.site); L.site.traverse(o => o.geometry?.dispose()); L.site = null; }
    L.work = mode || null;
    if (L.model) L.model.visible = true;
    if (!mode) return;
    const site = new THREE.Group(), orange = 0xff7a1a, steelC = 0x8a8f99, plank = 0xc9a26b;
    // a striped barrier round the edge of the lot
    for (let k = -4; k <= 4; k++) for (const [x, z, ry] of [[k * 1.05, -4.55, 0], [k * 1.05, 4.55, 0], [-4.55, k * 1.05, Math.PI / 2], [4.55, k * 1.05, Math.PI / 2]]) {
      if (mode === 'upgrade' && Math.abs(k) < 3) continue;
      const b = box(0.9, 0.18, 0.08, k % 2 ? orange : 0xf4efe0, x, 0.45, z); b.rotation.y = ry; site.add(b);
      if (k % 2 === 0) site.add(box(0.08, 0.6, 0.08, 0x3a3f48, x, 0.15, z));
    }
    // a tower crane in the corner, its arm swinging over the work
    const crane = new THREE.Group();
    const H = mode === 'build' ? 9 : 6.5;
    for (let y = 0; y < H; y += 1) { crane.add(box(0.45, 1, 0.45, 0xffc23d, 0, y, 0)); crane.add(box(0.5, 0.06, 0.5, 0xd99a1a, 0, y + 0.5, 0)); }
    const jib = new THREE.Group(); jib.position.y = H;
    jib.add(box(6.5, 0.28, 0.3, 0xffc23d, 2.6, 0, 0), box(1.6, 0.6, 0.6, 0x5b5f66, -1.2, -0.15, 0), box(0.5, 0.5, 0.5, 0x3a3f48, 0, 0.3, 0));
    jib.add(box(0.03, 2.4, 0.03, 0x3a3f48, 4.6, -2.4, 0), box(0.4, 0.3, 0.4, steelC, 4.6, -2.7, 0));
    crane.add(jib);
    crane.position.set(3.6, 0.15, -3.6);
    site.add(crane);
    site.userData.jib = jib;
    if (mode === 'build') {
      // a fresh slab, and scaffolding that climbs as the work goes on
      site.add(box(6.6, 0.14, 6.6, 0xc9c4b8, 0, 0.15, 0));
      const sc = new THREE.Group();
      for (const x of [-3, -1, 1, 3]) for (const z of [-3, 3]) sc.add(box(0.1, 4, 0.1, steelC, x, 0, z));
      for (const z of [-1, 1]) for (const x of [-3, 3]) sc.add(box(0.1, 4, 0.1, steelC, x, 0, z));
      for (let y = 1; y <= 4; y += 1) for (const [w, d, x, z] of [[6.2, 0.6, 0, -3], [6.2, 0.6, 0, 3], [0.6, 6.2, -3, 0], [0.6, 6.2, 3, 0]]) sc.add(box(w, 0.07, d, plank, x, y - 0.05, z));
      // the building taking shape inside: a grey concrete block that rises with progress
      const core = box(5, 1, 5, 0xb5b0a6, 0, 0, 0);
      sc.position.y = 0.29; core.position.y = 0.29;
      site.add(sc, core);
      site.userData.sc = sc; site.userData.core = core;
      for (let k = 0; k < 3; k++) site.add(box(0.9, 0.5, 0.6, 0x9a7a52, -3.2 + k * 1.0, 0.15, 3.9));   // stacked materials
    } else {
      for (const x of [-2.2, -1.2]) site.add(box(0.1, 3.4, 0.1, steelC, x, 0.15, 3.0), box(0.1, 3.4, 0.1, steelC, x, 0.15, 3.6));
      for (let y = 1; y <= 3; y++) site.add(box(1.3, 0.07, 0.8, plank, -1.7, y + 0.1, 3.3));
      for (const [x, z] of [[-3.8, 1.5], [-3.6, 0.4], [3.8, 2]]) { const c = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 10), mat(orange)); c.position.set(x, 0.42, z); site.add(c); }
    }
    site.traverse(o => { o.userData.lotId = id; });
    L.group.add(site);
    L.site = site;
  }

  // upgrade tier: the building grows, gains wings and rooftop gear
  setGrowth(id, tier) {
    const L = this.lots[id];
    L.grow = 1 + Math.min(9, tier) * 0.04;
    if ((L.tier || 0) === tier) return;
    const up = tier > (L.tier || 0);
    L.tier = tier;
    if (L.model && L.look) {
      const look = L.look;
      this.setBuilt(id, false); this.setBuilt(id, true, look);
      if (up && this.ready) { L.bounce = 1; this.#dust(L); }
    }
  }

  // the rocket on the pad: while it's being put together it rises section by section
  // inside the scaffold; once it's finished the scaffold comes down
  setRocketReady(ready, progress = 0) {
    const L = this.lots[this.lotsOf('rocket')[0]];
    if (!L || !L.rocket) return;
    if (this.launching) return;
    const k = ready ? 1 : Math.max(0.08, Math.round(progress * 8) / 8);
    L.rocket.visible = ready || progress > 0.01; L.scaffold.visible = !ready;
    L.rocket.scale.set(1, k, 1);
  }

  // per-frame supply-chain info from the economy: [{id, made, util, surplus, starved}]
  setFlow(per, support) { this.flowInfo = per; this.supportInfo = support || {}; }

  bounce(id) { if (this.lots[id]) this.lots[id].bounce = 1; }

  select(id) {
    if (this.selected) this.lots[this.selected].ring.visible = false;
    // remember the view before the first building was opened, and go back to it after
    if (id && !this.selected && !this.savedView) this.savedView = { target: this.target.clone().setY(0), zoom: this.zoom };
    if (!id && this.savedView) {
      this.panTo = this.savedView.target; this.zoomTo = this.savedView.zoom; this.savedView = null;
    }
    this.selected = id;
    if (id) { this.lots[id].ring.visible = true; this.lots[id].bounce = Math.max(this.lots[id].bounce, 0.6); }
    // with a panel open, raise the view so the chosen building sits above the panel
    this.viewShiftTarget = id ? this.panelShift ?? 0.44 : 0;
    this.onPick(id);
  }

  // centre on a building and zoom in so it's easy to see (zoom: false just pans)
  focus(id, { zoom = true } = {}) {
    const L = this.lots[id];
    if (!L) return;
    const [x, z] = this.P[id];
    // aim at the middle of the building, not its foot
    const h = zoom ? Math.min(6, (L.top || 2.4) * (L.grow || 1) * 0.45) : 0;
    this.panTo = new THREE.Vector3(x, h, z);
    if (zoom) this.zoomTo = Math.max(this.zoom, 1.75);
  }

  setPowerLine() {}

  // the graphics came back after the phone took them away: everything uploads again by
  // itself, but the effects' own buffers and the shadow map need making afresh
  onContextRestored() {
    const L = this.look;
    if (L.composer) { L.composer.dispose?.(); L.composer = null; L.bloom = L.grade = L.tiltH = L.tiltV = L.ink = null; }
    if (L.normalRT) { L.normalRT.dispose(); L.normalRT = null; }
    L.makeEnvironment();
    L.setQuality(L.quality);
    this.renderer.shadowMap.needsUpdate = true;
  }

  // ---------- traffic ----------
  #traffic() {
    this.fleet = 'earth';
    this.#makeFleet();
  }
  // the town's vehicles, waiting to drive in: cars and trucks on Earth, open buggies and
  // cargo haulers on the Moon, pressurised rovers and cargo crawlers on Mars
  #makeFleet() {
    const colors = [0xe85a3c, 0x2f7fd1, 0x1f8a5b, 0xffc23d, 0x7f6bbf, 0xf3f0e8, 0x3a3f48];
    const mars = this.fleet === 'mars', moon = this.fleet === 'moon', west = this.fleet === 'west';
    const paint = [0x9c3a2a, 0x2f5a3a, 0x3f4a5c, 0x7a4a2a, 0xc9a24a, 0x6e4a2c, 0x8a3a5a];
    for (let i = 0; i < 15; i++) {
      const m = mars ? (i % 3 === 0 ? marsCrawler(colors[i % colors.length]) : marsRover(colors[(i * 3) % colors.length]))
        : moon ? (i % 3 === 0 ? lunarHauler(colors[i % colors.length]) : lunarBuggy(colors[(i * 3) % colors.length]))
        : west ? (i % 3 === 0 ? freightWagon(paint[i % paint.length]) : i % 3 === 1 ? (i % 2 ? stagecoach(paint[(i * 3) % paint.length]) : buckboard(paint[i % paint.length])) : buckboard([0x7a4a2a, 0x2a2420, 0xd8c8b0, 0x5a3a26][i % 4], true))
        : i % 3 === 0 ? truck(colors[i % colors.length]) : car(colors[(i * 3) % colors.length]);
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.idleCars.push(m);
    }
  }
  #onAmbientEnd(c) { c.onArrive = () => this.idleCars.push(c.mesh); }
  // a small, run-down town has less traffic than a big one
  #ambientRoom() { return this.traffic.count(c => c.kind === 'ambient') < Math.max(2, Math.min(15, Math.round(NET.good.size * 0.4))); }
  #refillAmbient(dt) {
    this.refillT = (this.refillT || 0) - dt;
    if (this.refillT > 0 || !this.idleCars.length || !this.#ambientRoom()) return;
    this.refillT = 0.7;
    const m = this.idleCars.shift();
    const c = this.traffic.spawnAmbient(m);
    if (c) this.#onAmbientEnd(c); else this.idleCars.push(m);
  }

  // a vehicle from one lot to another, by road, following the rules
  #drive(fromId, toId, mesh, kind, speed, data, onArrive) {
    if (!this.P[fromId] || !this.P[toId]) return false;
    const C = lotRoute(this.P[fromId], this.P[toId]);
    if (!C) return false;
    // wait for the driveway to be clear before the next truck pulls out
    const start = new THREE.Vector3(C[0].x, 0.06, C[0].z);
    if (this.traffic.cars.some(c => c.pos.distanceTo(start) < 3.2)) return false;
    // ...and for anyone on their way into this same bay to arrive first (one truck in a bay at a time)
    if (this.traffic.cars.some(c => c.P.W[c.P.W.length - 1].distanceTo(start) < 0.5)) return false;
    this.traffic.add(C, mesh, { kind, speed, drive: true, data, onArrive });
    return true;
  }

  stepTraffic(dt) {
    this.#updateDeliveries(dt);
    this.#refillAmbient(dt);
    this.traffic.update(dt);
  }

  // supply trucks drive from the supplier's yard to the next factory
  #spawnDelivery(fromId, toId) {
    let mesh = this.truckPool.pop();
    if (!mesh) {
      mesh = this.themeName === 'mars' ? marsCrawler(0x2fb5a0) : this.themeName === 'moon' ? lunarHauler(0x2f6fb5) : this.themeName === 'desert' ? freightWagon(0x9c3a2a, true) : truck(0x2f6fb5, true);
      mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const cargo = new THREE.Group();
      for (const [x, z, h] of [[-0.75, -0.2, 0.42], [-0.75, 0.2, 0.42], [-0.3, -0.2, 0.42], [-0.3, 0.2, 0.36], [-0.75, 0, 0.3]]) cargo.add(box(0.42, h, 0.38, 0xffffff, x, z === 0 && h === 0.3 ? 0.82 : 0.4, z));
      cargo.children.forEach(c => { c.name = 'crate'; });
      cargo.name = 'cargo';
      mesh.add(cargo);
    }
    const color = this.lookFor?.(fromId)?.color ?? 0xb9b4a8;
    const cm = mat([0xe8e4da, 0xd8d2c4, 0xcfd3da, 0xd8d4c8].includes(color) ? 0xb9b4a8 : color);
    mesh.getObjectByName('cargo').children.forEach(c => { c.material = cm; });
    const ok = this.#drive(fromId, toId, mesh, 'delivery', 6, { to: toId }, c => {
      this.truckPool.push(c.mesh);
      this.lots[toId].bounce = Math.max(this.lots[toId].bounce, 0.35);
      this.onDelivery(toId);
    });
    if (!ok) this.truckPool.push(mesh);
    return ok;
  }

  // a manager's car heading out from headquarters (or back to it)
  sendManager(fromId, toId) {
    let mesh = this.carPool.pop();
    if (!mesh) {
      mesh = this.themeName === 'mars' ? marsRover(0x2fb5a0) : this.themeName === 'moon' ? lunarBuggy(0x1f8a5b) : this.themeName === 'desert' ? stagecoach(0x2f5a3a) : car(0x1f8a5b);
      mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
    }
    const go = () => this.#drive(fromId, toId, mesh, 'manager', 6.5, { to: toId }, c => {
      this.carPool.push(c.mesh);
      this.lots[toId].bounce = Math.max(this.lots[toId].bounce, 0.6);
    });
    // if the driveway is busy, try again in a moment
    if (!go()) { const t = setInterval(() => { if (go()) clearInterval(t); }, 700); setTimeout(() => clearInterval(t), 15000); }
  }

  #updateDeliveries(dt) {
    if (!this.flowInfo) return;
    for (let i = 1; i < this.flowInfo.length; i++) {
      const p = this.flowInfo[i], prev = this.flowInfo[i - 1];
      if (!p.made || !prev.made) continue;
      const suppliers = this.lotsOf(FACTORIES[i - 1].id);
      if (!suppliers.length) continue;
      for (const to of this.lotsOf(p.id)) {
        const key = 'spawn_' + to;
        this[key] = (this[key] ?? Math.random() * 3) - dt;
        const inFlight = this.traffic.count(c => c.kind === 'delivery' && c.data?.to === to);
        if (this[key] <= 0 && inFlight < 2) {
          // the nearest supplier sends the truck; busier links send them more often
          const P = this.P, [tx, tz] = P[to];
          const from = suppliers.slice().sort((a, b) => Math.hypot(P[a][0] - tx, P[a][1] - tz) - Math.hypot(P[b][0] - tx, P[b][1] - tz))[Math.random() < 0.7 ? 0 : Math.floor(Math.random() * suppliers.length)];
          if (this.#spawnDelivery(from, to)) this[key] = Math.max(2.2, 8 - Math.log2(1 + p.made * FACTORIES[i].need) * 0.9);
          else this[key] = 0.6;
        }
      }
    }
  }

  clearDeliveries() {
    for (const c of this.traffic.cars) if (c.kind === 'delivery') this.truckPool.push(c.mesh); else if (c.kind === 'manager') this.carPool.push(c.mesh);
    this.traffic.clear('delivery'); this.traffic.clear('manager');
    for (const sm of this.smoke) { this.scene.remove(sm.m); sm.m.material.dispose(); }
    this.smoke = [];
    for (const p of this.pops) p.el.remove();
    this.pops = [];
  }

  // ---------- rocket launch ----------
  // The rocket lifts off and climbs out of view. The promise resolves once it has left
  // the screen (the game fades to black then); endLaunch() puts the pad back as it was.
  launchRocket() {
    const id = this.lotsOf('rocket')[0], L = this.lots[id];
    return new Promise(resolve => {
      if (!L || !L.rocket) { resolve(); return; }
      this.launching = { L, t: 0, resolve, start: L.rocket.position.y };
      L.rocket.visible = true; L.scaffold.visible = false;
      this.focus(id, { zoom: false });
    });
  }
  endLaunch() {
    const g = this.launching;
    if (!g) return;
    g.L.rocket.position.y = g.start; g.L.rocket.visible = false; g.L.scaffold.visible = true;
    if (g.L.rocket.userData.flame) g.L.rocket.userData.flame.visible = false;
    this.launching = null; this.shake = 0;
    for (const sm of this.smoke) { this.scene.remove(sm.m); sm.m.material.dispose(); }
    this.smoke = [];
  }
  #exhaust(wp, spread, n = 2) {
    for (let k = 0; k < n; k++) {
      const hot = Math.random() < 0.45;
      const m = this.#puff(hot ? 0xffb35a : 0xf2f2f2, hot, 1.4 + Math.random() * 1.2);
      m.position.set(wp.x + (Math.random() - 0.5) * spread, Math.max(0.3, wp.y - 0.2), wp.z + (Math.random() - 0.5) * spread);
      this.scene.add(m);
      this.smoke.push({ m, age: 0, life: 2.2, spread: true });
    }
  }
  #updateLaunch(dt) {
    const g = this.launching;
    if (!g) return;
    g.t += dt;
    const R = g.L.rocket;
    const t = Math.max(0, g.t - 1.2); // a second of rumble before liftoff
    R.position.y = g.start + 0.5 * 9 * t * t;
    const fl = R.userData.flame;
    if (fl) { fl.visible = g.t > 0.9; const f = Math.min(1, (g.t - 0.9) * 2); fl.scale.set(0.8 + f * 0.25 + Math.random() * 0.08, f * (0.85 + Math.random() * 0.35), 0.8 + f * 0.25 + Math.random() * 0.08); }
    this.shake = g.t < 4 ? 0.35 * Math.max(0, 1 - Math.max(0, g.t - 2.5) / 1.5) : 0;
    if ((g.puff = (g.puff || 0) - dt) <= 0) { g.puff = 0.05; const wp = new THREE.Vector3(); R.getWorldPosition(wp); this.#exhaust(wp, 1.2); }
    // gone off the top of the screen (or taking too long): time to fade out
    if (g.resolve) {
      const wp = new THREE.Vector3(); R.getWorldPosition(wp); wp.y -= 1.5; wp.project(this.camera);
      if (wp.y > 1.15 || g.t > 6) { const r = g.resolve; g.resolve = null; r(); }
    }
  }

  // ---------- tumbleweeds (the Mojave) ----------
  // Every so often a tumbleweed blows past outside town: in from off screen on the wind,
  // bouncing and spinning as it rolls, and out the far side. It never crosses the town,
  // the landing spot or a mesa.
  #tumbleweed() {
    // a tangle of thin, bent twigs round a darker, denser middle, merged into two meshes
    const twigs = [], core = [];
    for (let i = 0; i < 70; i++) {
      const len = 0.18 + Math.random() * 0.22, t = new THREE.CylinderGeometry(0.012, 0.016, len, 3, 1);
      t.translate(0, len / 2, 0);
      t.rotateZ((Math.random() - 0.5) * 0.9);
      // point it roughly round the ball's surface, at a random spot on it
      const u = Math.random() * Math.PI * 2, v = Math.acos(2 * Math.random() - 1), rr = 0.24 + Math.random() * 0.2;
      const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6.3, Math.random() * 6.3, Math.random() * 6.3));
      t.applyQuaternion(q);
      t.translate(rr * Math.sin(v) * Math.cos(u), rr * Math.cos(v), rr * Math.sin(v) * Math.sin(u));
      twigs.push(t.toNonIndexed());
    }
    for (let i = 0; i < 6; i++) { const g = new THREE.IcosahedronGeometry(0.16 + Math.random() * 0.08, 0); g.translate((Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18, (Math.random() - 0.5) * 0.18); core.push(g.toNonIndexed()); }
    const ball = new THREE.Group();
    const tw = new THREE.Mesh(mergeGeometries(twigs), mat(0xc29a62, { roughness: 1, flatShading: true }));
    const co = new THREE.Mesh(mergeGeometries(core), mat(0x7d5f36, { roughness: 1, flatShading: true }));
    tw.castShadow = true; ball.add(tw, co);
    twigs.forEach(g => g.dispose()); core.forEach(g => g.dispose());
    const spin = new THREE.Group(); spin.add(ball);
    return spin;
  }
  // a path past the town: a straight run along one side of it, out on open ground
  #weedPath() {
    const ps = Object.values(this.P || {});
    if (!ps.length) return null;
    const x0 = Math.min(...ps.map(p => p[0])) - 14, x1 = Math.max(...ps.map(p => p[0])) + 14;
    const z0 = Math.min(...ps.map(p => p[1])) - 14, z1 = Math.max(...ps.map(p => p[1])) + 14;
    for (let tries = 0; tries < 12; tries++) {
      const alongX = Math.random() < 0.5, back = Math.random() < 0.5;
      const lane = alongX ? (back ? z0 - 2 - Math.random() * 14 : z1 + 2 + Math.random() * 14) : (back ? x0 - 2 - Math.random() * 14 : x1 + 2 + Math.random() * 14);
      const sgn = Math.random() < 0.5 ? 1 : -1, span = 46;
      const dir = new THREE.Vector3(alongX ? sgn : 0, 0, alongX ? 0 : sgn);
      const mid = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2;
      const at = k => alongX ? new THREE.Vector3(mid + k, 0, lane) : new THREE.Vector3(lane, 0, mid + k);
      const start = at(-sgn * span);
      // clear of the landing spot and any high ground all the way along
      let ok = true;
      for (let k = -span; k <= span && ok; k += 3) {
        const p = at(k);
        if (Math.hypot(p.x - LANDER_AT[0], p.z - LANDER_AT[1]) < 7 || (this.heightAt?.(p.x, p.z) ?? 0) > 1.8) ok = false;
      }
      if (ok) return { start, dir, length: span * 2 };
    }
    return null;
  }
  #updateTumbleweeds(dt) {
    const list = (this.weeds ||= []);
    if (this.themeName !== 'desert') {
      for (const w of list) { this.scene.remove(w.m); w.m.traverse(o => o.geometry?.dispose()); }
      list.length = 0; this.weedT = 4 + Math.random() * 6; return;
    }
    this.weedT = (this.weedT ?? 5) - dt;
    if (this.weedT <= 0 && list.length < 2 && !this.launching) {
      this.weedT = 10 + Math.random() * 18;
      const path = this.#weedPath();
      if (path) {
        const m = this.#tumbleweed(), size = 0.85 + Math.random() * 0.35;
        m.scale.setScalar(size);
        this.scene.add(m);
        list.push({ m, pos: path.start, dir: path.dir, left: path.length, speed: 2.6 + Math.random() * 1.8, t: 0, hop: Math.random() * 6, size, axis: new THREE.Vector3(path.dir.z, 0, -path.dir.x) });
      }
    }
    for (let i = list.length - 1; i >= 0; i--) {
      const w = list[i];
      w.t += dt;
      // gusts: the speed swells and drops a little, and it hops now and then
      const v = w.speed * (0.7 + 0.4 * Math.sin(w.t * 1.3 + w.hop));
      w.pos.addScaledVector(w.dir, v * dt); w.left -= v * dt;
      const ground = this.heightAt?.(w.pos.x, w.pos.z) ?? 0;
      const bounce = Math.pow(Math.abs(Math.sin(w.t * 2.2 + w.hop)), 1.6) * 0.45 * w.size;
      w.m.position.set(w.pos.x, ground + 0.4 * w.size + bounce, w.pos.z);
      w.m.children[0].rotateOnWorldAxis(w.axis, -v * dt / (0.4 * w.size));
      if (w.left <= 0) { this.scene.remove(w.m); w.m.traverse(o => o.geometry?.dispose()); list.splice(i, 1); }
    }
  }

  // the rocket you arrived in, standing on open ground outside town in every world
  // after the first. look = { model, color } of this world's rocket, or null for none.
  setLander(look) {
    if (this.lander) { this.scene.remove(this.lander); freeGeometry(this.lander); this.lander = null; }
    this.landing = null;
    if (!look) return;
    const m = (BUILDERS[look.model] || BUILDERS.rocket)(look.color);
    if (!m.rocket) return;
    const R = m.rocket; R.parent?.remove(R);
    const [x, z] = LANDER_AT, y = this.heightAt?.(x, z) ?? 0;
    const g = new THREE.Group(); g.add(R); R.position.set(0, 0.15, 0);
    // landing legs and a scorched patch of ground
    const legM = 0x6b6f78;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = box(0.12, 1.3, 0.12, legM, Math.cos(a) * 0.95, 0.0, Math.sin(a) * 0.95); leg.rotation.z = Math.cos(a) * 0.45; leg.rotation.x = -Math.sin(a) * 0.45; R.add(leg);
      R.add(box(0.4, 0.06, 0.4, legM, Math.cos(a) * 1.2, -0.15, Math.sin(a) * 1.2));
    }
    const burn = new THREE.Mesh(new THREE.CircleGeometry(2.6, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false }));
    burn.rotation.x = -Math.PI / 2; burn.position.y = 0.04; g.add(burn);
    g.position.set(x, y, z);
    g.traverse(o => { if (o.isMesh && o !== burn) { o.castShadow = true; o.receiveShadow = true; } });
    this.scene.add(g);
    this.lander = g; this.landerRocket = R; this.landerBurn = burn;
  }
  // bring the lander down from the sky: a slowing descent on a column of flame, a cloud
  // of dust as it touches down. Resolves when it has landed.
  landRocket() {
    return new Promise(resolve => {
      if (!this.lander) { resolve(); return; }
      this.landing = { t: 0, resolve, T: 3.4, H: 46 };
      this.landerRocket.position.y = 0.15 + this.landing.H; this.landerBurn.visible = false;
      this.target.set(LANDER_AT[0], 0, LANDER_AT[1]); this.panTo = null;
      this.setZoom(1.1);
    });
  }
  #updateLanding(dt) {
    const g = this.landing;
    if (!g) return;
    g.t += dt;
    const R = this.landerRocket, k = Math.min(1, g.t / g.T);
    R.position.y = 0.15 + g.H * (1 - k) ** 2.4;   // fast at first, gently at the end
    const fl = R.userData.flame;
    if (fl) { fl.visible = k < 1; const f = 0.55 + k * 0.5; fl.scale.set(0.9 + Math.random() * 0.1, f * (0.8 + Math.random() * 0.3), 0.9 + Math.random() * 0.1); }
    const wp = new THREE.Vector3(); R.getWorldPosition(wp);
    if ((g.puff = (g.puff || 0) - dt) <= 0 && k < 1) { g.puff = 0.06; this.#exhaust(wp, 0.5 + k * 2, k > 0.75 ? 3 : 1); }
    this.shake = k > 0.8 && k < 1 ? 0.12 : this.shake;
    if (k >= 1 && !g.done) {
      g.done = true; this.shake = 0; this.landerBurn.visible = true;
      const dustC = this.themeName === 'mars' ? 0xc0704a : this.themeName === 'moon' ? 0xc4c4ca : 0xe2c9a0;
      for (let i = 0; i < 14; i++) {
        const m = this.#puff(dustC, false, 1.6 + Math.random() * 1.6);
        const a = Math.random() * Math.PI * 2, r = 1 + Math.random() * 2.2;
        m.position.set(wp.x + Math.cos(a) * r, wp.y + 0.4 + Math.random() * 0.5, wp.z + Math.sin(a) * r);
        this.scene.add(m); this.smoke.push({ m, age: Math.random() * 0.2, life: 2 + Math.random(), spread: true });
      }
    }
    if (g.t > g.T + 1.2) { this.landing = null; g.resolve(); }
  }

  // ---------- input ----------
  #input() {
    const c = this.canvas;
    const pts = new Map();
    let downAt = 0, moved = 0, pinch0 = 0, zoom0 = 1;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { downAt = performance.now(); moved = 0; this.panTo = null; this.zoomTo = null; }
      if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); zoom0 = this.zoom; moved = 99; }
    });
    c.addEventListener('pointermove', e => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (pts.size === 1) { moved += Math.abs(dx) + Math.abs(dy); this.#panBy(dx, dy); }
      else if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        this.setZoom(zoom0 * Math.hypot(a.x - b.x, a.y - b.y) / (pinch0 || 1));
      }
    });
    const up = e => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      if (pts.size === 0 && moved < 10 && performance.now() - downAt < 500) this.#tap(e.clientX, e.clientY);
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', e => pts.delete(e.pointerId));
    c.addEventListener('wheel', e => { e.preventDefault(); this.setZoom(this.zoom * (e.deltaY < 0 ? 1.1 : 0.9)); }, { passive: false });
  }

  setZoom(z) { this.zoom = Math.min(2.2, Math.max(0.48, z)); this.#updateCamera(); }

  #panBy(dx, dy) {
    const rect = this.canvas.getBoundingClientRect();
    const worldPerPx = (this.camera.top - this.camera.bottom) / this.zoom / rect.height;
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const fwd = new THREE.Vector3(-1, 0, -1).normalize();
    const vScale = 1 / CAM_DIR.y; // vertical screen motion stretches on the ground
    this.target.addScaledVector(right, -dx * worldPerPx);
    this.target.addScaledVector(fwd, dy * worldPerPx * vScale);
    this.#clamp();
    this.#updateCamera();
  }

  #clamp() {
    this.target.x = Math.min(BOUNDS.maxX, Math.max(BOUNDS.minX, this.target.x));
    this.target.z = Math.min(BOUNDS.maxZ, Math.max(BOUNDS.minZ, this.target.z));
  }

  #tap(cx, cy) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    const ray = new THREE.Raycaster();
    ray.setFromCamera(ndc, this.camera);
    const hits = ray.intersectObjects(Object.values(this.lots).map(l => l.group), true);
    const hit = hits.find(h => h.object.userData.lotId);
    if (hit) this.onTap(hit.object.userData.lotId); else this.select(null);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.cw = w; this.ch = h;   // kept, so labels don't have to ask the page for the size every frame
    this.look.resize();
    this.aspect = w / h;
    this.halfH = Math.max(17, 15.5 / this.aspect);
    this.#updateCamera();
  }

  #updateCamera() {
    // the shift is in screen terms, so it mustn't grow as you zoom in
    const halfH = this.halfH || 17, a = (this.viewShift || 0) * halfH / (this.zoom || 1);
    this.camera.left = -halfH * (this.aspect || 0.5); this.camera.right = halfH * (this.aspect || 0.5);
    this.camera.top = halfH - a; this.camera.bottom = -halfH - a;
    this.camera.zoom = this.zoom;
    this.camera.position.copy(this.target).addScaledVector(CAM_DIR, 100);
    if (this.shake) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0));
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  pop(id, text, cls = '') {
    for (const old of this.pops) if (old.id === id) old.age = Math.max(old.age, 1.0);
    const el = document.createElement('div');
    el.className = 'pop ' + cls;
    el.style.opacity = '0';
    el.textContent = text;
    this.labelsEl.appendChild(el);
    this.pops.push({ el, id, age: 0 });
  }

  // a soft round puff that always faces the camera
  #puff(color, hot, size) {
    if (!this.puffTex) {
      // one soft, round, slightly lumpy puff: a smooth falloff with gentle noise in it
      const N = 128, c = document.createElement('canvas'); c.width = c.height = N;
      const g = c.getContext('2d'), img = g.createImageData(N, N);
      const lumps = Array.from({ length: 6 }, () => [Math.random() * 6.28, 0.06 + Math.random() * 0.08, 2 + Math.floor(Math.random() * 3)]);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const dx = (x - N / 2 + 0.5) / (N / 2), dy = (y - N / 2 + 0.5) / (N / 2), a = Math.atan2(dy, dx);
        let edge = 0.82; for (const [ph, amp, f] of lumps) edge += Math.sin(a * f + ph) * amp * 0.5;
        const r = Math.hypot(dx, dy) / edge;
        const v = r >= 1 ? 0 : Math.pow(1 - r * r, 1.8) * (0.9 + 0.1 * Math.sin(dx * 9 + dy * 7));
        const i = (y * N + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = Math.max(0, Math.min(255, v * 255));
      }
      g.putImageData(img, 0, 0);
      this.puffTex = new THREE.CanvasTexture(c);
    }
    // all puffs are drawn together (see puffs.js); each looks and behaves like a sprite
    this.puffLayer ||= new PuffLayer(this.scene, this.puffTex);
    return new Puff(this.puffLayer, color, hot, size);
  }

  #emitSmoke(L) {
    for (const p of L.smokeAt) {
      const big = L.def.id === 'power' || this.typeOf?.(L.def.id) === 'power';
      const m = this.#puff(0xffffff, false, (big ? 1.6 : 0.8) * (0.85 + Math.random() * 0.3));
      const wp = p.clone(); L.model.localToWorld(wp);
      m.position.copy(wp).add(new THREE.Vector3((Math.random() - 0.5) * 0.2, 0, (Math.random() - 0.5) * 0.2));
      this.scene.add(m);
      // a gentle plume: rises, slows, spreads and drifts with the breeze as it fades
      this.smoke.push({ m, age: 0, life: (big ? 4.2 : 3.2) * (0.85 + Math.random() * 0.3), plume: true, rise: big ? 1.5 : 1.1, spin: (Math.random() - 0.5) * 0.6, grow: big ? 3.2 : 2.6, op: big ? 0.5 : 0.42, shade: 0.88 + Math.random() * 0.1 });
    }
  }

  frame(dt, labelFor) {
    this.t += dt;
    this.#meteors(dt);
    this.#walk(dt);
    this.viewShift = (this.viewShift || 0) + ((this.viewShiftTarget || 0) - (this.viewShift || 0)) * Math.min(1, dt * 6);
    if (this.panTo) {
      this.target.lerp(this.panTo, Math.min(1, dt * 6));
      if (this.target.distanceTo(this.panTo) < 0.05) this.panTo = null;
    }
    if (this.zoomTo) {
      this.zoom += (this.zoomTo - this.zoom) * Math.min(1, dt * 5);
      if (Math.abs(this.zoom - this.zoomTo) < 0.004) { this.zoom = this.zoomTo; this.zoomTo = null; }
      this.#clamp();
    }
    this.#updateCamera();
    const info = {};
    for (const p of this.flowInfo || []) info[p.id] = p;
    for (const [k, v] of Object.entries(this.supportInfo || {})) info[k] = v;
    for (const [id, L] of Object.entries(this.lots)) {
      if (L.site) {
        const p = this.workOf?.(id) ?? 0;
        if (L.work === 'build') {
          if (L.model) L.model.visible = false;
          L.site.userData.core.scale.y = 0.3 + p * 3.2;
          L.site.userData.sc.scale.y = 0.35 + p * 0.75;
        }
        L.site.userData.jib.rotation.y = Math.sin(this.t * 0.35 + L.group.position.x) * 1.1 - 0.6;
      }
      const type = L.model ? this.typeOf(id) : null;
      const f = type ? info[type] : null;
      // starved factories run their machines slower; idle ones stop
      L.speed = f ? (f.made > 0 ? 0.25 + 0.75 * f.util : 0) : 1;
      L.at += dt * L.speed;
      if (L.anim) L.anim(L.at, dt * L.speed);
      if (L.model) {
        L.bounce = Math.max(0, L.bounce - dt * 2.5);
        const b = Math.sin(L.bounce * Math.PI) * 0.12 * L.bounce;
        L.model.scale.set(L.grow * (1 - b * 0.5), L.grow * (1 + b), L.grow * (1 - b * 0.5));
        if (L.smokeAt.length && L.speed > 0 && (L.smokeT = (L.smokeT || 0) - dt) <= 0) { L.smokeT = (0.22 + Math.random() * 0.1) / Math.max(0.3, L.speed); this.#emitSmoke(L); }
        // crates pile up when this factory makes more than the next one can use
        const i = FACTORIES.findIndex(d => d.id === type);
        const nextBuilt = i >= 0 && i < FACTORIES.length - 1 && (info[FACTORIES[i + 1].id]?.cap || 0) > 0;
        const n = f && f.made > 0 && nextBuilt ? Math.round(f.surplus * 9) : 0;
        L.crates.children.forEach((c, i) => { c.visible = i < n; });
      }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.age += dt;
      const k = s.age / s.life;
      if (s.plume) {
        // quick to leave the stack, slowing as it rises; the breeze takes it more the higher it gets
        s.m.position.y += dt * s.rise * (1 - k * 0.7);
        s.m.position.x -= dt * (0.25 + k * 0.9); s.m.position.z += dt * 0.15 * k;
        s.m.material.rotation += dt * s.spin;
        s.m.scale.setScalar(s.m.userData.size * (1 + Math.sqrt(k) * s.grow));
        s.m.material.opacity = s.op * Math.min(1, s.age * 3) * Math.pow(1 - k, 1.5);
        s.m.material.color.setScalar(s.shade * (1 - this.look.night * 0.5));
      } else {
        s.m.position.y += dt * (s.spread ? 0.4 : 1.6); s.m.position.x -= dt * 0.5;
        s.m.scale.setScalar((s.m.userData.size || 1) * (1 + k * (s.spread ? 2.4 : 1.6)));
        s.m.material.opacity = 0.85 * (1 - k) * Math.min(1, s.age * 6);
        // smoke picks up the colour of the light (warm at sunset, dim at night)
        if (!s.m.material.blending || s.m.material.blending === THREE.NormalBlending) s.m.material.color.setScalar(0.95 - this.look.night * 0.55);
      }
      if (k >= 1) { this.scene.remove(s.m); s.m.material.dispose(); this.smoke.splice(i, 1); }
    }
    this.stepTraffic(dt);
    this.#updateLaunch(dt);
    this.#updateLanding(dt);
    this.#updateTumbleweeds(dt);
    // day/night, sun follows the view so shadows stay crisp where you're looking
    this.look.update(dt);
    SHARED.time.value = this.t;
    const n = this.look.night;
    if (this.roadData?.lampMat) this.roadData.lampMat.emissiveIntensity = n * 2.4;
    if (this.roadData?.edgeMat) this.roadData.edgeMat.emissiveIntensity = 0.4 + n * 1.8;
    if (this.glow) { this.glow.material.opacity = n * 0.5; this.glow.material.size = 15 * this.zoom; }
    if (this.pools) this.pools.material.opacity = n * 0.16;
    if (this.cones) this.cones.material.opacity = n * 0.07;
    this.nightFog?.update(this.t, n);
    if (this.bldDirty) this.#buildingGlow();
    if (this.bldPools) this.bldPools.material.opacity = n * 0.1;
    if (this.land?.water) { this.land.water.offset.x = this.t * 0.01; this.land.water.offset.y = this.t * 0.006; }
    for (const m of NIGHT_LIST()) m.emissiveIntensity = n * m.userData.night;
    if (this.look.sunDir) {
      // The shadow map covers the area round where you're looking. Its size goes up in a
      // few fixed steps as you zoom out (not smoothly, which made shadow edges crawl
      // while zooming), and it moves in whole shadow-map texels, so edges stay put
      // instead of shimmering as you pan.
      const need = 34 / this.zoom + 6;
      const span = [40, 48, 58, 70].find(v => v >= need) || 70;
      const c = this.sun.shadow.camera;
      if (c.right !== span) { c.left = -span; c.right = span; c.top = span; c.bottom = -span; c.updateProjectionMatrix(); }
      const d = this._sd ||= new THREE.Vector3(), ax = this._sx ||= new THREE.Vector3(), ay = this._sy ||= new THREE.Vector3(), t = this._st ||= new THREE.Vector3();
      d.copy(this.look.sunDir).normalize();
      ax.crossVectors(THREE.Object3D.DEFAULT_UP, d).normalize(); ay.crossVectors(d, ax);
      const texel = (2 * span) / this.sun.shadow.mapSize.x;
      const px = this.target.dot(ax), py = this.target.dot(ay);
      t.copy(this.target).addScaledVector(ax, Math.round(px / texel) * texel - px).addScaledVector(ay, Math.round(py / texel) * texel - py);
      this.sun.position.copy(t).add(this.look.sunDir);
      this.sun.target.position.copy(t);
    }
    // zoomed far out: the tiniest scenery is hidden (only specks at that size), and the
    // shadow map, which then covers a big area, is redrawn every other frame unless the
    // view is moving (shadows of things far below can lag a frame without anyone seeing)
    const far = this.zoom < (this.detailGroup?.visible === false ? 0.74 : 0.7);
    if (this.detailGroup) this.detailGroup.visible = !far;
    const moving = !!(this.panTo || this.zoomTo || this.dragging || this.lastView?.distanceTo(this.camera.position) > 1e-4 || this.lastZoom !== this.zoom);
    (this.lastView ||= new THREE.Vector3()).copy(this.camera.position); this.lastZoom = this.zoom;
    this.shadowSkip = far && !moving && !this.launching ? !this.shadowSkip : false;
    this.renderer.shadowMap.autoUpdate = !this.shadowSkip;
    this.camera.updateMatrixWorld();
    this.puffLayer?.update(this.camera);
    if (!this.contextLost) this.look.render();   // (nothing to draw with while the phone has taken the graphics away)
    this.#labels(dt, labelFor);
  }

  #project(v) {
    const p = (this._pv ||= new THREE.Vector3()).copy(v).project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * (this.cw || this.canvas.clientWidth), y: (-p.y * 0.5 + 0.5) * (this.ch || this.canvas.clientHeight) };
  }

  // where a lot's building appears on screen (in CSS pixels), at height y above the ground
  // (by default the top of the building), for pointing things at it
  screenOf(id, y = null) {
    const L = this.lots[id];
    if (!L) return null;
    return this.#project(new THREE.Vector3(L.group.position.x, y ?? (L.top * L.grow * 0.55 + 0.15), L.group.position.z));
  }
  #labels(dt, labelFor) {
    // shrink labels when zoomed out so they don't pile on top of each other
    const labelScale = Math.min(1, Math.max(0.62, this.zoom * 0.95)).toFixed(2);
    for (const [id, L] of Object.entries(this.lots)) {
      const info = labelFor(id);
      // the + for land you can develop sits on the middle of the plot; other bubbles float over the building
      const plus = info.cls?.includes('plus');
      const s = this.#project(new THREE.Vector3(L.group.position.x, plus ? 0.9 : L.top * L.grow + 0.15, L.group.position.z));
      if (L.label._html !== info.html) { L.label.innerHTML = info.html; L.label._html = info.html; L.bar = L.label.querySelector('.bar i'); L.label.hidden = !info.html; }
      if (L.bar) { const bw = (info.progress * 100).toFixed(1) + '%'; if (L.bar._w !== bw) { L.bar.style.width = bw; L.bar._w = bw; } }
      const cls = 'lot-label ' + info.cls + (this.selected === id ? ' sel' : '');
      if (L.label.className !== cls) L.label.className = cls;
      // (only touch the page when something changed: writing styles every frame is costly)
      if (L.label._aria !== info.aria) { L.label.setAttribute('aria-label', info.aria); L.label._aria = info.aria; }
      if (!L.label.hidden) {
        const tf = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) scale(${labelScale}) translate(-50%, -100%)`;
        if (L.label._tf !== tf) { L.label.style.transform = tf; L.label._tf = tf; }
      } else L.label._tf = null;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt;
      const L = this.lots[p.id];
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top * L.grow + 0.15, L.group.position.z));
      const y = s.y - 30 - p.age * 46;
      const off = y < 190 || y > (this.ch || this.canvas.clientHeight) - 40 || s.x < 20 || s.x > (this.cw || this.canvas.clientWidth) - 20;
      p.el.style.transform = `translate(${s.x}px, ${y}px) translate(-50%, -100%)`;
      p.el.style.opacity = off ? '0' : String(Math.max(0, 1 - p.age / 1.2));
      if (p.age > 1.2) { p.el.remove(); this.pops.splice(i, 1); }
    }
  }
}
