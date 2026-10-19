// The 3D town: fixed-angle camera, lots, factories, supply trucks, crates, smoke,
// map themes, the rocket launch, and tap picking.
import * as THREE from 'three';
import { FACTORIES } from './economy.js';
import { BUILDERS, box, mat, tree, truck, pine, cactus, mesa, rock, crater, crate } from './models.js';

export const LOTS = {
  furnace: [7, 14], press: [-7, 14], gear: [7, 0], engine: [-7, 0], turbine: [7, -14], rocket: [-7, -14],
};
const LOT = 10;
const ROAD_W = 3.6;
const CROSS = [-21, -7, 7, 21];
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const BOUNDS = { minX: -12, maxX: 12, minZ: -18, maxZ: 18 };

const THEME = {
  colorado: { ground: 0x8cc65f, sky: 0x8cc65f, hemiSky: 0xfff6e5, hemiGround: 0x5d7a46, sun: 2.2, hemi: 1.6, road: 0x5d6470, walk: 0xcfc9bb, pad: 0xd9d4c7 },
  desert:   { ground: 0xe2c58f, sky: 0xe2c58f, hemiSky: 0xfff1d6, hemiGround: 0xa9875a, sun: 2.4, hemi: 1.5, road: 0x6a6460, walk: 0xd8c39c, pad: 0xe8dcc4 },
  moon:     { ground: 0x9c9ca2, sky: 0x9c9ca2, hemiSky: 0xdfe6ff, hemiGround: 0x3a3d48, sun: 2.6, hemi: 1.2, road: 0x4b4e57, walk: 0xb4b4ba, pad: 0xc9c9cf },
};

function rng(seed) { return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; }

export class World {
  constructor(canvas, labelsEl) {
    this.canvas = canvas;
    this.labelsEl = labelsEl;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.target = new THREE.Vector3(0, 0, 8);
    this.zoom = 1;
    this.shake = 0;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);

    this.lots = {};
    this.selected = null;
    this.onPick = () => {};
    this.onDelivery = () => {};
    this.smoke = [];
    this.pops = [];
    this.trucks = [];        // ambient traffic
    this.deliveries = [];    // supply trucks in flight
    this.truckPool = [];
    this.flowInfo = null;
    this.t = 0;

    this.#lights();
    this.groundGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.scene.add(this.groundGroup, this.sceneryGroup);
    for (const f of FACTORIES) this.#lot(f);
    this.#traffic();
    this.setTheme('colorado');
    this.#input();
    this.resize();
    addEventListener('resize', () => this.resize());
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
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.sun = sun;
    this.scene.add(sun, sun.target);
  }

  // ---------- map themes ----------
  setTheme(name) {
    if (this.themeName === name) return;
    this.themeName = name;
    const T = THEME[name] || THEME.colorado;
    this.scene.background = new THREE.Color(T.sky);
    this.hemi.color.setHex(T.hemiSky); this.hemi.groundColor.setHex(T.hemiGround); this.hemi.intensity = T.hemi;
    this.sun.intensity = T.sun;
    for (const g of [this.groundGroup, this.sceneryGroup]) {
      for (const c of [...g.children]) { g.remove(c); c.traverse(o => o.geometry?.dispose()); }
    }
    this.#ground(T);
    for (const L of Object.values(this.lots)) L.pad.material = mat(T.pad);
    this.#scenery(name);
  }

  #ground(T) {
    const G = this.groundGroup;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(T.ground));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    G.add(ground);
    const line = 0xf4efe0;
    G.add(box(ROAD_W + 1.2, 0.04, 120, T.walk, 0, 0, 0));
    G.add(box(ROAD_W, 0.06, 120, T.road, 0, 0, 0));
    for (const z of CROSS) {
      G.add(box(120, 0.04, ROAD_W + 1.2, T.walk, 0, 0, z));
      G.add(box(120, 0.07, ROAD_W, T.road, 0, 0, z));
    }
    for (let i = -58; i < 58; i += 2.4) {
      if (!CROSS.some(z => Math.abs(i - z) < 2.6)) G.add(box(0.16, 0.08, 1.1, line, 0, 0, i));
      if (Math.abs(i) > 2.6) for (const z of CROSS) G.add(box(1.1, 0.09, 0.16, line, i, 0, z));
    }
    G.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }

  #scenery(name) {
    const r = rng(name === 'colorado' ? 7 : name === 'desert' ? 11 : 13);
    const S = this.sceneryGroup;
    const blocked = (x, z, pad = 1.4) => {
      if (Math.abs(x) < ROAD_W / 2 + pad) return true;
      if (CROSS.some(rz => Math.abs(z - rz) < ROAD_W / 2 + pad)) return true;
      return Object.values(LOTS).some(([lx, lz]) => Math.abs(x - lx) < LOT / 2 + 0.4 && Math.abs(z - lz) < LOT / 2 + 0.4);
    };
    const place = (count, make, pad) => {
      let n = 0;
      for (let i = 0; i < count * 6 && n < count; i++) {
        const x = (r() - 0.5) * 70, z = (r() - 0.5) * 80;
        if (blocked(x, z, pad)) continue;
        const o = make(r);
        o.position.x = x; o.position.z = z;
        o.rotation.y = r() * Math.PI * 2;
        o.traverse(m => { if (m.isMesh) m.castShadow = true; });
        S.add(o); n++;
      }
    };
    if (name === 'colorado') {
      const greens = [0x3f8f4a, 0x4fa152, 0x357d40, 0x5bb05a];
      place(110, r => tree(0.8 + r() * 0.6, greens[Math.floor(r() * greens.length)]));
      place(70, r => pine(0.8 + r() * 0.7));
    } else if (name === 'desert') {
      place(60, r => cactus(0.8 + r() * 0.6));
      place(45, r => rock(0.8 + r() * 1.4, 0xb98b5c));
      place(10, r => mesa(4 + r() * 4, 2 + r() * 2.5, 4 + r() * 4), 4);
    } else {
      place(28, r => crater(1.4 + r() * 2.2), 3);
      place(90, r => rock(0.6 + r() * 1.6, 0x85858b));
      // a little flag by the first factory, because of course
      const flag = new THREE.Group();
      flag.add(box(0.08, 2.4, 0.08, 0xdddddd, 0, 0, 0), box(1.1, 0.7, 0.04, 0xffffff, 0.55, 1.6, 0), box(0.5, 0.36, 0.05, 0x2f5fb0, 0.25, 1.94, 0));
      flag.position.set(13.5, 0, 9.5);
      S.add(flag);
    }
  }

  // ---------- lots ----------
  #lot(def) {
    const [x, z] = LOTS[def.id];
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
    sale.add(box(0.15, 1.6, 0.15, 0x7a5230, 2.6, 0.15, 2.6));
    sale.add(box(1.6, 1, 0.1, 0xffffff, 2.6, 1.3, 2.68));
    sale.add(box(1.2, 0.18, 0.12, 0x1f8a5b, 2.6, 1.72, 2.72));
    group.add(sale);
    // yard crates (surplus that the next factory isn't using)
    const crates = new THREE.Group();
    const side = Math.sign(x); // the yard is on the side away from the main road
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
    label.addEventListener('click', e => { e.stopPropagation(); this.select(def.id); });
    this.labelsEl.appendChild(label);

    this.lots[def.id] = { def, group, pad, ring, sale, crates, model: null, anim: null, top: 2.4, label, bounce: 0, grow: 1, speed: 1, at: 0 };
    group.traverse(o => { o.userData.lotId = def.id; });
  }

  setBuilt(id, built) {
    const L = this.lots[id];
    if (built && !L.model) {
      const m = BUILDERS[id](L.def.color);
      m.group.position.y = 0.15;
      m.group.traverse(o => { o.userData.lotId = id; });
      L.group.add(m.group);
      L.model = m.group; L.anim = m.anim || null; L.top = m.top;
      L.smokeAt = m.smoke || [];
      L.rocket = m.rocket || null; L.scaffold = m.scaffold || null;
      L.sale.visible = false;
      L.bounce = 1;
    } else if (!built && L.model) {
      L.group.remove(L.model); L.model = null; L.anim = null; L.top = 2.4; L.smokeAt = []; L.sale.visible = true;
      L.rocket = null; L.scaffold = null;
      L.crates.children.forEach(c => { c.visible = false; });
    }
  }

  // milestone levels make the building a bit taller and wider
  setGrowth(id, milestones) { this.lots[id].grow = 1 + Math.min(6, milestones) * 0.055; }

  setRocketReady(ready) {
    const L = this.lots.rocket;
    if (!L.rocket) return;
    if (this.launching) return;
    L.rocket.visible = ready; L.scaffold.visible = !ready;
  }

  // per-frame supply-chain info from the economy: [{id, made, util, surplus, starved}]
  setFlow(per) { this.flowInfo = per; }

  bounce(id) { if (this.lots[id]) this.lots[id].bounce = 1; }

  select(id) {
    if (this.selected) this.lots[this.selected].ring.visible = false;
    this.selected = id;
    if (id) { this.lots[id].ring.visible = true; this.lots[id].bounce = Math.max(this.lots[id].bounce, 0.6); }
    this.onPick(id);
  }

  focus(id) {
    const [x, z] = LOTS[id];
    this.panTo = new THREE.Vector3(x, 0, z + 3);
  }

  // ---------- traffic ----------
  #traffic() {
    const colors = [0xe85a3c, 0x2f7fd1, 0x1f8a5b, 0xffc23d, 0x7f6bbf];
    const lanes = [
      { axis: 'x', fixed: 21.9, dir: 1 }, { axis: 'x', fixed: 20.1, dir: -1 },
      { axis: 'x', fixed: -20.1, dir: 1 }, { axis: 'x', fixed: -21.9, dir: -1 },
    ];
    let i = 0;
    for (const lane of lanes) {
      const t = truck(colors[i++ % colors.length]);
      t.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(t);
      this.trucks.push({ mesh: t, ...lane, pos: -40 + i * 19, speed: 4 + (i % 3) });
    }
  }

  // supply trucks drive from the supplier's yard to the next factory along the road
  #spawnDelivery(fromId, toId) {
    const [ax, az] = LOTS[fromId], [bx, bz] = LOTS[toId];
    const lane = bz < az ? 0.9 : -0.9;
    const pts = [
      new THREE.Vector3(ax - Math.sign(ax) * 3.2, 0.06, az + 2.6),
      new THREE.Vector3(lane, 0.06, az + 2.6),
      new THREE.Vector3(lane, 0.06, bz + 2.6),
      new THREE.Vector3(bx - Math.sign(bx) * 3.2, 0.06, bz + 2.6),
    ];
    let mesh = this.truckPool.pop();
    if (!mesh) {
      mesh = truck(0xffffff);
      mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
      // cargo crate on the back
      const cargo = box(0.9, 0.55, 0.8, 0xffffff, -0.35, 1.25, 0);
      cargo.name = 'cargo';
      mesh.add(cargo);
    }
    const color = FACTORIES.find(f => f.id === fromId).color;
    mesh.getObjectByName('cargo').material = mat(color === 0xe8e4da ? 0xb9b4a8 : color);
    mesh.visible = true;
    this.scene.add(mesh);
    this.deliveries.push({ mesh, pts, seg: 0, u: 0, to: toId, speed: 6 });
  }

  #updateDeliveries(dt) {
    if (this.flowInfo) {
      for (let i = 1; i < this.flowInfo.length; i++) {
        const p = this.flowInfo[i], prev = this.flowInfo[i - 1];
        if (!p.made || !prev.made) continue;
        const key = 'spawn_' + p.id;
        this[key] = (this[key] ?? Math.random() * 2) - dt;
        const inFlight = this.deliveries.filter(d => d.to === p.id).length;
        if (this[key] <= 0 && inFlight < 3) {
          // busier links send trucks more often
          this[key] = Math.max(1.6, 7 - Math.log2(1 + p.made * FACTORIES[i].need) * 0.9);
          this.#spawnDelivery(FACTORIES[i - 1].id, p.id);
        }
      }
    }
    for (let i = this.deliveries.length - 1; i >= 0; i--) {
      const d = this.deliveries[i];
      const a = d.pts[d.seg], b = d.pts[d.seg + 1];
      const len = a.distanceTo(b) || 0.001;
      d.u += (d.speed * dt) / len;
      if (d.u >= 1) {
        d.seg++; d.u = 0;
        if (d.seg >= d.pts.length - 1) {
          this.scene.remove(d.mesh); d.mesh.visible = false; this.truckPool.push(d.mesh);
          this.deliveries.splice(i, 1);
          this.lots[d.to].bounce = Math.max(this.lots[d.to].bounce, 0.35);
          this.onDelivery(d.to);
          continue;
        }
      }
      const A = d.pts[d.seg], B = d.pts[d.seg + 1];
      d.mesh.position.lerpVectors(A, B, d.u);
      d.mesh.rotation.y = Math.atan2(-(B.z - A.z), B.x - A.x);
    }
  }

  clearDeliveries() {
    for (const d of this.deliveries) { this.scene.remove(d.mesh); d.mesh.visible = false; this.truckPool.push(d.mesh); }
    this.deliveries = [];
  }

  // ---------- rocket launch ----------
  launchRocket() {
    const L = this.lots.rocket;
    return new Promise(resolve => {
      if (!L.rocket) { resolve(); return; }
      this.launching = { L, t: 0, resolve, start: L.rocket.position.y };
      L.rocket.visible = true; L.scaffold.visible = false;
      this.focus('rocket');
    });
  }
  #updateLaunch(dt) {
    const g = this.launching;
    if (!g) return;
    g.t += dt;
    const R = g.L.rocket;
    const t = Math.max(0, g.t - 1.2); // a second of rumble before liftoff
    R.position.y = g.start + 0.5 * 9 * t * t;
    this.shake = g.t < 4 ? 0.35 : Math.max(0, this.shake - dt);
    // exhaust
    if ((g.puff = (g.puff || 0) - dt) <= 0) {
      g.puff = 0.05;
      const wp = new THREE.Vector3(); R.getWorldPosition(wp);
      for (let k = 0; k < 2; k++) {
        const hot = Math.random() < 0.4;
        const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + Math.random() * 0.5, 0),
          new THREE.MeshLambertMaterial({ color: hot ? 0xffa53a : 0xf2f2f2, emissive: hot ? 0xff7a1a : 0x000000, transparent: true, opacity: 0.9, flatShading: true }));
        m.position.set(wp.x + (Math.random() - 0.5) * 1.2, Math.max(0.3, wp.y - 0.2), wp.z + (Math.random() - 0.5) * 1.2);
        this.scene.add(m);
        this.smoke.push({ m, age: 0, life: 2.2, spread: true });
      }
    }
    if (g.t > 5.2) {
      R.position.y = g.start;
      R.visible = false; g.L.scaffold.visible = true;
      this.launching = null; this.shake = 0;
      g.resolve();
    }
  }

  // ---------- input ----------
  #input() {
    const c = this.canvas;
    const pts = new Map();
    let downAt = 0, moved = 0, pinch0 = 0, zoom0 = 1;
    c.addEventListener('pointerdown', e => {
      c.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 1) { downAt = performance.now(); moved = 0; this.panTo = null; }
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

  setZoom(z) { this.zoom = Math.min(2.2, Math.max(0.7, z)); this.#updateCamera(); }

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
    this.select(hit ? hit.object.userData.lotId : null);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    const halfH = Math.max(17, 15.5 / aspect);
    this.camera.left = -halfH * aspect; this.camera.right = halfH * aspect;
    this.camera.top = halfH; this.camera.bottom = -halfH;
    this.#updateCamera();
  }

  #updateCamera() {
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
    el.textContent = text;
    this.labelsEl.appendChild(el);
    this.pops.push({ el, id, age: 0 });
  }

  #emitSmoke(L) {
    for (const p of L.smokeAt) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.85, flatShading: true }));
      const wp = p.clone(); L.model.localToWorld(wp);
      m.position.copy(wp);
      this.scene.add(m);
      this.smoke.push({ m, age: 0, life: 2.4 });
    }
  }

  frame(dt, labelFor) {
    this.t += dt;
    if (this.panTo) {
      this.target.lerp(this.panTo, Math.min(1, dt * 6));
      if (this.target.distanceTo(this.panTo) < 0.05) this.panTo = null;
      this.#clamp();
    }
    this.#updateCamera();
    const info = {};
    for (const p of this.flowInfo || []) info[p.id] = p;
    for (const [id, L] of Object.entries(this.lots)) {
      const f = info[id];
      // starved factories run their machines slower; idle ones stop
      L.speed = f ? (f.made > 0 ? 0.25 + 0.75 * f.util : 0) : 1;
      L.at += dt * L.speed;
      if (L.anim) L.anim(L.at, dt * L.speed);
      if (L.model) {
        L.bounce = Math.max(0, L.bounce - dt * 2.5);
        const b = Math.sin(L.bounce * Math.PI) * 0.12 * L.bounce;
        L.model.scale.set(L.grow * (1 - b * 0.5), L.grow * (1 + b), L.grow * (1 - b * 0.5));
        if (L.smokeAt.length && L.speed > 0 && (L.smokeT = (L.smokeT || 0) - dt) <= 0) { L.smokeT = 0.7 / Math.max(0.3, L.speed); this.#emitSmoke(L); }
        // crates pile up when this factory makes more than the next one can use
        const i = FACTORIES.findIndex(d => d.id === id);
        const nextBuilt = i < FACTORIES.length - 1 && (info[FACTORIES[i + 1].id]?.cap || 0) > 0;
        const n = f && f.made > 0 && nextBuilt ? Math.round(f.surplus * 9) : 0;
        L.crates.children.forEach((c, i) => { c.visible = i < n; });
      }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.age += dt;
      const k = s.age / s.life;
      s.m.position.y += dt * (s.spread ? 0.4 : 1.6); s.m.position.x -= dt * 0.5;
      s.m.scale.setScalar(1 + k * (s.spread ? 3 : 1.8));
      s.m.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); this.smoke.splice(i, 1); }
    }
    for (const t of this.trucks) {
      t.pos += t.speed * dt * t.dir;
      if (t.pos > 45) t.pos = -45; if (t.pos < -45) t.pos = 45;
      t.mesh.position.set(t.pos, 0.06, t.fixed); t.mesh.rotation.y = t.dir > 0 ? 0 : Math.PI;
    }
    this.#updateDeliveries(dt);
    this.#updateLaunch(dt);
    this.renderer.render(this.scene, this.camera);
    this.#labels(dt, labelFor);
  }

  #project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-p.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  #labels(dt, labelFor) {
    for (const [id, L] of Object.entries(this.lots)) {
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top * L.grow + 0.15, L.group.position.z));
      const info = labelFor(id);
      if (L.label._html !== info.html) { L.label.innerHTML = info.html; L.label._html = info.html; L.bar = L.label.querySelector('.bar i'); }
      if (L.bar) L.bar.style.width = (info.progress * 100).toFixed(1) + '%';
      const cls = 'lot-label ' + info.cls + (this.selected === id ? ' sel' : '');
      if (L.label.className !== cls) L.label.className = cls;
      L.label.setAttribute('aria-label', info.aria);
      L.label.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt;
      const L = this.lots[p.id];
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top * L.grow + 0.15, L.group.position.z));
      const y = s.y - 44 - p.age * 36;
      const off = y < 190 || y > this.canvas.clientHeight - 40 || s.x < 20 || s.x > this.canvas.clientWidth - 20;
      p.el.style.transform = `translate(${s.x}px, ${y}px) translate(-50%, -100%)`;
      p.el.style.opacity = off ? '0' : String(Math.max(0, 1 - p.age / 1.2));
      if (p.age > 1.2) { p.el.remove(); this.pops.splice(i, 1); }
    }
  }
}
