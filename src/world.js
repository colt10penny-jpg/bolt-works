// The 3D town: fixed-angle camera, lots, factories, supply trucks, crates, smoke,
// map themes, the rocket launch, and tap picking.
import * as THREE from 'three';
import { FACTORIES, BUILDINGS } from './economy.js';
import { BUILDERS, box, mat, tree, truck, car, pine, cactus, mesa, rock, crater, crate, powerPole } from './models.js';
import { Traffic, lotRoute, AVES, CROSS, ROAD_W, LANE, STOP_R, EDGE } from './traffic.js';

// 3x3 town grid. The chain snakes: mine -> furnace -> press, gear -> engine,
// turbine -> rocket; the power plant and data center sit on the right.
export const LOTS = {
  mine: [14, 14], furnace: [0, 14], press: [-14, 14],
  gear: [-14, 0], engine: [0, 0], power: [14, 0],
  rocket: [-14, -14], turbine: [0, -14], datacenter: [14, -14],
  hq: [14, 28],
};
const LOT = 10;
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const BOUNDS = { minX: -20, maxX: 20, minZ: -22, maxZ: 27 };

const THEME = {
  colorado: { ground: 0x8cc65f, sky: 0x8cc65f, hemiSky: 0xfff6e5, hemiGround: 0x5d7a46, sun: 2.2, hemi: 1.6, road: 0x5d6470, walk: 0xcfc9bb, pad: 0xd9d4c7 },
  desert:   { ground: 0xe2c58f, sky: 0xe2c58f, hemiSky: 0xfff1d6, hemiGround: 0xa9875a, sun: 2.4, hemi: 1.5, road: 0x6a6460, walk: 0xd8c39c, pad: 0xe8dcc4 },
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
    this.target = new THREE.Vector3(7, 0, 12);
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

    this.#lights();
    this.groundGroup = new THREE.Group();
    this.sceneryGroup = new THREE.Group();
    this.scene.add(this.groundGroup, this.sceneryGroup);
    for (const f of BUILDINGS) this.#lot(f);
    this.#powerLine();
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
    // every world has its own buildings, so take the old ones down
    for (const id of Object.keys(this.lots)) this.setBuilt(id, false);
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
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat(T.ground));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true;
    G.add(ground);
    // roads run far past the edge of the screen, however far you zoom out
    const L = EDGE * 2 + 60;
    const paint = new THREE.Group();
    const line = 0xf4efe0;
    for (const x of AVES) {
      paint.add(box(ROAD_W + 1.2, 0.04, L, T.walk, x, 0, 0));
      paint.add(box(ROAD_W, 0.06, L, T.road, x, 0, 0));
    }
    for (const z of CROSS) {
      paint.add(box(L, 0.04, ROAD_W + 1.2, T.walk, 0, 0, z));
      paint.add(box(L, 0.07, ROAD_W, T.road, 0, 0, z));
    }
    const half = L / 2;
    for (let i = -half; i < half; i += 2.4) {
      if (!CROSS.some(z => Math.abs(i - z) < STOP_R + 0.4)) for (const x of AVES) paint.add(box(0.16, 0.08, 1.1, line, x, 0, i));
      if (!AVES.some(x => Math.abs(i - x) < STOP_R + 0.4)) for (const z of CROSS) paint.add(box(1.1, 0.09, 0.16, line, i, 0, z));
    }
    // stop lines at every intersection, across the lane coming in
    for (const x of AVES) for (const z of CROSS) {
      for (const [hx, hz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cx = x - hx * STOP_R + (-hz) * LANE, cz = z - hz * STOP_R + hx * LANE;
        paint.add(hx ? box(0.28, 0.09, ROAD_W / 2 - 0.15, 0xffffff, cx, 0, cz) : box(ROAD_W / 2 - 0.15, 0.09, 0.28, 0xffffff, cx, 0, cz));
      }
    }
    G.add(mergeStatic(paint, false));
  }

  #scenery(name) {
    const r = rng(name === 'colorado' ? 7 : name === 'desert' ? 11 : 13);
    const S = this.sceneryGroup;
    const blocked = (x, z, pad = 1.4) => {
      if (AVES.some(rx => Math.abs(x - rx) < ROAD_W / 2 + pad)) return true;
      if (CROSS.some(rz => Math.abs(z - rz) < ROAD_W / 2 + pad)) return true;
      return Object.values(LOTS).some(([lx, lz]) => Math.abs(x - lx) < LOT / 2 + 0.4 && Math.abs(z - lz) < LOT / 2 + 0.4);
    };
    // near: inside the shadowed area around town; far: out to past the screen edge
    const near = new THREE.Group(), far = new THREE.Group();
    const SPAN = 240, NEAR = 46;
    const place = (count, make, pad) => {
      count = Math.round(count * (SPAN * SPAN) / (84 * 84) * 0.7);
      let n = 0;
      for (let i = 0; i < count * 6 && n < count; i++) {
        const x = (r() - 0.5) * SPAN, z = (r() - 0.5) * SPAN;
        if (blocked(x, z, pad)) continue;
        const o = make(r);
        o.position.x = x; o.position.z = z;
        o.rotation.y = r() * Math.PI * 2;
        (Math.abs(x) < NEAR && Math.abs(z) < NEAR ? near : far).add(o); n++;
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
      flag.position.set(5.5, 0, 22.5);
      near.add(flag);
    }
    S.add(mergeStatic(near, true), mergeStatic(far, false));
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
    if (built && !L.model) {
      const color = look?.color ?? L.def.color;
      const m = (BUILDERS[look?.model] || BUILDERS[id])(color);
      const crateColor = color === 0xe8e4da || color === 0xd8d2c4 || color === 0xcfd3da ? 0xb9b4a8 : color;
      L.crates.children.forEach(c => { c.material = mat(crateColor); });
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
  // fraction of the screen (from the top) that's free above an open panel
  setFreeTop(frac) {
    const y = Math.max(0.12, frac * 0.5);           // aim at the middle of the free area
    this.panelShift = Math.min(0.8, Math.max(0, 1 - 2 * y));
    if (this.selected) this.viewShiftTarget = this.panelShift;
  }

  setGrowth(id, milestones) { this.lots[id].grow = 1 + Math.min(6, milestones) * 0.055; }

  setRocketReady(ready) {
    const L = this.lots.rocket;
    if (!L.rocket) return;
    if (this.launching) return;
    L.rocket.visible = ready; L.scaffold.visible = !ready;
  }

  // per-frame supply-chain info from the economy: [{id, made, util, surplus, starved}]
  setFlow(per, support) { this.flowInfo = per; this.supportInfo = support || {}; }

  bounce(id) { if (this.lots[id]) this.lots[id].bounce = 1; }

  select(id) {
    if (this.selected) this.lots[this.selected].ring.visible = false;
    this.selected = id;
    if (id) { this.lots[id].ring.visible = true; this.lots[id].bounce = Math.max(this.lots[id].bounce, 0.6); }
    // with a panel open, raise the view so the chosen building sits above the panel
    this.viewShiftTarget = id ? this.panelShift ?? 0.44 : 0;
    this.onPick(id);
  }

  focus(id) {
    const [x, z] = LOTS[id];
    // aim a bit in front of the lot so it sits in the top half, above the panel
    this.panTo = new THREE.Vector3(x, 0, z);
  }

  // poles and a wire from the power plant to the data center, with pulses of power
  #powerLine() {
    const [px, pz] = LOTS.power, [dx, dz] = LOTS.datacenter;
    const x = px + 4.2;
    const g = new THREE.Group();
    const z1 = pz - 3.4, z2 = dz + 3.4;
    for (const z of [z1, z2]) { const p = powerPole(); p.position.set(x, 0, z); g.add(p); }
    const len = Math.abs(z2 - z1);
    for (const off of [-0.5, 0.5]) g.add(box(0.05, 0.05, len, 0x2a2a2e, x + off, 3.0, (z1 + z2) / 2));
    this.pulses = [];
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff27a }));
      g.add(m); this.pulses.push({ m, u: i / 3 });
    }
    this.powerLineGroup = g; this.powerLine = { x, z1, z2 };
    g.visible = false;
    this.scene.add(g);
  }
  setPowerLine(on, rate) {
    this.powerLineGroup.visible = on;
    this.powerRate = rate;
  }

  // ---------- traffic ----------
  #traffic() {
    const colors = [0xe85a3c, 0x2f7fd1, 0x1f8a5b, 0xffc23d, 0x7f6bbf, 0xf3f0e8, 0x3a3f48];
    for (let i = 0; i < 11; i++) {
      const m = i % 3 === 0 ? truck(colors[i % colors.length]) : car(colors[(i * 3) % colors.length]);
      m.traverse(o => { if (o.isMesh) o.castShadow = true; });
      if (!this.traffic.spawnAmbient(m, true)) this.idleCars.push(m);
      else this.#onAmbientEnd(this.traffic.cars[this.traffic.cars.length - 1]);
    }
  }
  #onAmbientEnd(c) { c.onArrive = () => this.idleCars.push(c.mesh); }
  #refillAmbient(dt) {
    this.refillT = (this.refillT || 0) - dt;
    if (this.refillT > 0 || !this.idleCars.length) return;
    this.refillT = 0.7;
    const m = this.idleCars.shift();
    const c = this.traffic.spawnAmbient(m);
    if (c) this.#onAmbientEnd(c); else this.idleCars.push(m);
  }

  // a vehicle from one lot to another, by road, following the rules
  #drive(fromId, toId, mesh, kind, speed, data, onArrive) {
    const C = lotRoute(LOTS[fromId], LOTS[toId]);
    if (!C) return false;
    // wait for the driveway to be clear before the next truck pulls out
    const start = new THREE.Vector3(C[0].x, 0.06, C[0].z);
    if (this.traffic.cars.some(c => c.pos.distanceTo(start) < 3.2)) return false;
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
      mesh = truck(0xffffff);
      mesh.traverse(o => { if (o.isMesh) o.castShadow = true; });
      const cargo = box(0.9, 0.55, 0.8, 0xffffff, -0.35, 1.25, 0);
      cargo.name = 'cargo';
      mesh.add(cargo);
    }
    const color = this.lookFor?.(fromId)?.color ?? FACTORIES.find(f => f.id === fromId).color;
    mesh.getObjectByName('cargo').material = mat([0xe8e4da, 0xd8d2c4, 0xcfd3da, 0xd8d4c8].includes(color) ? 0xb9b4a8 : color);
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
      mesh = car(0x1f8a5b);
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
    if (this.flowInfo) {
      for (let i = 1; i < this.flowInfo.length; i++) {
        const p = this.flowInfo[i], prev = this.flowInfo[i - 1];
        if (!p.made || !prev.made) continue;
        const key = 'spawn_' + p.id;
        this[key] = (this[key] ?? Math.random() * 2) - dt;
        const inFlight = this.traffic.count(c => c.kind === 'delivery' && c.data?.to === p.id);
        if (this[key] <= 0 && inFlight < 3) {
          // busier links send trucks more often
          if (this.#spawnDelivery(FACTORIES[i - 1].id, p.id)) this[key] = Math.max(1.8, 7 - Math.log2(1 + p.made * FACTORIES[i].need) * 0.9);
          else this[key] = 0.5;
        }
      }
    }
  }

  clearDeliveries() {
    for (const c of this.traffic.cars) if (c.kind === 'delivery') this.truckPool.push(c.mesh); else if (c.kind === 'manager') this.carPool.push(c.mesh);
    this.traffic.clear('delivery'); this.traffic.clear('manager');
    for (const sm of this.smoke) { this.scene.remove(sm.m); sm.m.geometry.dispose(); sm.m.material.dispose(); }
    this.smoke = [];
    for (const p of this.pops) p.el.remove();
    this.pops = [];
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
    if (hit) this.onTap(hit.object.userData.lotId); else this.select(null);
  }

  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.aspect = w / h;
    this.halfH = Math.max(17, 15.5 / this.aspect);
    this.#updateCamera();
  }

  #updateCamera() {
    const halfH = this.halfH || 17, a = (this.viewShift || 0) * halfH;
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

  #emitSmoke(L) {
    for (const p of L.smokeAt) {
      const big = L.def.id === 'power';
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(big ? 0.9 : 0.45, 0), new THREE.MeshLambertMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.85, flatShading: true }));
      const wp = p.clone(); L.model.localToWorld(wp);
      m.position.copy(wp);
      this.scene.add(m);
      this.smoke.push({ m, age: 0, life: big ? 3.2 : 2.4 });
    }
  }

  frame(dt, labelFor) {
    this.t += dt;
    this.viewShift = (this.viewShift || 0) + ((this.viewShiftTarget || 0) - (this.viewShift || 0)) * Math.min(1, dt * 6);
    if (this.panTo) {
      this.target.lerp(this.panTo, Math.min(1, dt * 6));
      if (this.target.distanceTo(this.panTo) < 0.05) this.panTo = null;
      this.#clamp();
    }
    this.#updateCamera();
    const info = {};
    for (const p of this.flowInfo || []) info[p.id] = p;
    for (const [k, v] of Object.entries(this.supportInfo || {})) info[k] = v;
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
        const nextBuilt = i >= 0 && i < FACTORIES.length - 1 && (info[FACTORIES[i + 1].id]?.cap || 0) > 0;
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
    this.stepTraffic(dt);
    if (this.powerLineGroup.visible) {
      const { x, z1, z2 } = this.powerLine;
      for (const p of this.pulses) {
        p.u = (p.u + dt * 0.5 * (this.powerRate || 0)) % 1;
        p.m.position.set(x + 0.5, 3.0, z1 + (z2 - z1) * p.u);
        p.m.visible = (this.powerRate || 0) > 0;
      }
    }
    this.#updateLaunch(dt);
    this.renderer.render(this.scene, this.camera);
    this.#labels(dt, labelFor);
  }

  #project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-p.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  #labels(dt, labelFor) {
    // shrink labels when zoomed out so they don't pile on top of each other
    const labelScale = Math.min(1, Math.max(0.62, this.zoom * 0.95)).toFixed(2);
    for (const [id, L] of Object.entries(this.lots)) {
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top * L.grow + 0.15, L.group.position.z));
      const info = labelFor(id);
      if (L.label._html !== info.html) { L.label.innerHTML = info.html; L.label._html = info.html; L.bar = L.label.querySelector('.bar i'); L.label.hidden = !info.html; }
      if (L.bar) L.bar.style.width = (info.progress * 100).toFixed(1) + '%';
      const cls = 'lot-label ' + info.cls + (this.selected === id ? ' sel' : '');
      if (L.label.className !== cls) L.label.className = cls;
      L.label.setAttribute('aria-label', info.aria);
      L.label.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) scale(${labelScale}) translate(-50%, -100%)`;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt;
      const L = this.lots[p.id];
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top * L.grow + 0.15, L.group.position.z));
      const y = s.y - 30 - p.age * 46;
      const off = y < 190 || y > this.canvas.clientHeight - 40 || s.x < 20 || s.x > this.canvas.clientWidth - 20;
      p.el.style.transform = `translate(${s.x}px, ${y}px) translate(-50%, -100%)`;
      p.el.style.opacity = off ? '0' : String(Math.max(0, 1 - p.age / 1.2));
      if (p.age > 1.2) { p.el.remove(); this.pops.splice(i, 1); }
    }
  }
}
