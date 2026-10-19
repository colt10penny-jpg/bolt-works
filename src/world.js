// The 3D town: fixed-angle camera, lots, factories, traffic, smoke, and tap picking.
import * as THREE from 'three';
import { FACTORIES } from './economy.js';
import { BUILDERS, box, mat, tree, truck } from './models.js';

export const LOTS = {
  furnace: [7, 14], press: [-7, 14], gear: [7, 0], engine: [-7, 0], turbine: [7, -14], rocket: [-7, -14],
};
const LOT = 10;
const ROAD_W = 3.6;
const CAM_DIR = new THREE.Vector3(1, 1.2, 1).normalize();
const BOUNDS = { minX: -12, maxX: 12, minZ: -18, maxZ: 18 };

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
    this.scene.background = new THREE.Color(0x8cc65f);
    this.target = new THREE.Vector3(0, 0, 8);
    this.zoom = 1;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 0.1, 400);

    this.lots = {};       // id -> { group, pad, ring, model, anim, top, label, sign }
    this.selected = null;
    this.onPick = () => {};
    this.smoke = [];
    this.pops = [];
    this.trucks = [];
    this.t = 0;

    this.#lights();
    this.#ground();
    for (const f of FACTORIES) this.#lot(f);
    this.#trees();
    this.#traffic();
    this.#input();
    this.resize();
    addEventListener('resize', () => this.resize());
  }

  #lights() {
    this.scene.add(new THREE.HemisphereLight(0xfff6e5, 0x5d7a46, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 2.2);
    sun.position.set(-18, 40, 22);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const c = sun.shadow.camera;
    c.left = -45; c.right = 45; c.top = 45; c.bottom = -45; c.near = 1; c.far = 120;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    this.scene.add(sun);
    this.scene.add(sun.target);
  }

  #ground() {
    const grass = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), mat(0x8cc65f));
    grass.rotation.x = -Math.PI / 2; grass.receiveShadow = true;
    this.scene.add(grass);
    const road = 0x5d6470, line = 0xf4efe0, walk = 0xcfc9bb;
    // vertical road (along z) and two cross streets (along x)
    this.scene.add(box(ROAD_W + 1.2, 0.04, 120, walk, 0, 0, 0));
    this.scene.add(box(ROAD_W, 0.06, 120, road, 0, 0, 0));
    for (const z of [-7, 7, 21, -21]) {
      this.scene.add(box(120, 0.04, ROAD_W + 1.2, walk, 0, 0, z));
      this.scene.add(box(120, 0.07, ROAD_W, road, 0, 0, z));
    }
    for (let i = -58; i < 58; i += 2.4) {
      if (![-7, 7, 21, -21].some(z => Math.abs(i - z) < 2.6)) this.scene.add(box(0.16, 0.08, 1.1, line, 0, 0, i));
      if (Math.abs(i) > 2.6) for (const z of [-7, 7, 21, -21]) this.scene.add(box(1.1, 0.09, 0.16, line, i, 0, z));
    }
    for (const m of this.scene.children) if (m.isMesh) m.castShadow = false;
  }

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
    // "for sale" look: dashed border and a sign
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
    this.scene.add(group);

    const label = document.createElement('button');
    label.className = 'lot-label';
    label.addEventListener('click', e => { e.stopPropagation(); this.select(def.id); });
    this.labelsEl.appendChild(label);

    this.lots[def.id] = { def, group, pad, ring, sale, model: null, anim: null, top: 2.4, label, bounce: 0 };
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
      L.sale.visible = false;
      L.bounce = 1;
    } else if (!built && L.model) {
      L.group.remove(L.model); L.model = null; L.anim = null; L.top = 2.4; L.smokeAt = []; L.sale.visible = true;
    }
  }

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

  #trees() {
    const r = rng(7);
    const blocked = (x, z) => {
      if (Math.abs(x) < ROAD_W / 2 + 1.4) return true;
      if ([-7, 7, 21, -21].some(rz => Math.abs(z - rz) < ROAD_W / 2 + 1.4)) return true;
      return Object.values(LOTS).some(([lx, lz]) => Math.abs(x - lx) < LOT / 2 + 0.4 && Math.abs(z - lz) < LOT / 2 + 0.4);
    };
    const greens = [0x3f8f4a, 0x4fa152, 0x357d40, 0x5bb05a];
    let n = 0;
    for (let i = 0; i < 900 && n < 170; i++) {
      const x = (r() - 0.5) * 70, z = (r() - 0.5) * 80;
      if (blocked(x, z)) continue;
      const t = tree(0.8 + r() * 0.6, greens[Math.floor(r() * greens.length)]);
      t.position.set(x, 0, z);
      t.traverse(o => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(t);
      n++;
    }
  }

  #traffic() {
    const colors = [0xe85a3c, 0x2f7fd1, 0x1f8a5b, 0xffc23d, 0x7f6bbf];
    const lanes = [
      { axis: 'z', fixed: 0.9, dir: -1 }, { axis: 'z', fixed: -0.9, dir: 1 },
      { axis: 'x', fixed: 7.9, dir: 1 }, { axis: 'x', fixed: 6.1, dir: -1 },
      { axis: 'x', fixed: -6.1, dir: 1 }, { axis: 'x', fixed: -7.9, dir: -1 },
    ];
    let i = 0;
    for (const lane of lanes) {
      for (let k = 0; k < 2; k++) {
        const t = truck(colors[i++ % colors.length]);
        t.traverse(o => { if (o.isMesh) o.castShadow = true; });
        this.scene.add(t);
        this.trucks.push({ mesh: t, ...lane, pos: -40 + k * 40 + i * 7, speed: 4 + (i % 3) });
      }
    }
  }

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
      if (pts.size === 1) {
        moved += Math.abs(dx) + Math.abs(dy);
        this.#panBy(dx, dy);
      } else if (pts.size === 2) {
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
    // screen right = camera's local X; screen up maps to ground direction away from camera
    const right = new THREE.Vector3(1, 0, -1).normalize();
    const fwd = new THREE.Vector3(-1, 0, -1).normalize();
    const vScale = 1 / Math.sin(Math.asin(CAM_DIR.y)); // vertical screen motion stretches on the ground
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
    this.camera.lookAt(this.target);
    this.camera.updateProjectionMatrix();
  }

  // floating "+$" text above a factory
  pop(id, text) {
    for (const old of this.pops) if (old.id === id) old.age = Math.max(old.age, 1.0);
    const el = document.createElement('div');
    el.className = 'pop';
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
      this.#clamp(); this.#updateCamera();
    }
    for (const L of Object.values(this.lots)) {
      if (L.anim) L.anim(this.t, dt);
      if (L.model) {
        L.bounce = Math.max(0, L.bounce - dt * 2.5);
        const b = Math.sin(L.bounce * Math.PI) * 0.12 * L.bounce;
        L.model.scale.set(1 - b * 0.5, 1 + b, 1 - b * 0.5);
        if (L.smokeAt.length && (L.smokeT = (L.smokeT || 0) - dt) <= 0) { L.smokeT = 0.7; this.#emitSmoke(L); }
      }
    }
    for (let i = this.smoke.length - 1; i >= 0; i--) {
      const s = this.smoke[i];
      s.age += dt;
      const k = s.age / s.life;
      s.m.position.y += dt * 1.6; s.m.position.x -= dt * 0.5;
      s.m.scale.setScalar(1 + k * 1.8);
      s.m.material.opacity = 0.85 * (1 - k);
      if (k >= 1) { this.scene.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); this.smoke.splice(i, 1); }
    }
    for (const t of this.trucks) {
      t.pos += t.speed * dt * t.dir;
      if (t.pos > 45) t.pos = -45; if (t.pos < -45) t.pos = 45;
      if (t.axis === 'z') { t.mesh.position.set(t.fixed, 0.06, t.pos); t.mesh.rotation.y = t.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
      else { t.mesh.position.set(t.pos, 0.06, t.fixed); t.mesh.rotation.y = t.dir > 0 ? 0 : Math.PI; }
    }
    this.renderer.render(this.scene, this.camera);
    this.#labels(dt, labelFor);
  }

  #project(v) {
    const p = v.clone().project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * this.canvas.clientWidth, y: (-p.y * 0.5 + 0.5) * this.canvas.clientHeight };
  }

  #labels(dt, labelFor) {
    for (const [id, L] of Object.entries(this.lots)) {
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top + 0.15, L.group.position.z));
      const info = labelFor(id);
      if (L.label._html !== info.html) { L.label.innerHTML = info.html; L.label._html = info.html; L.bar = L.label.querySelector('.bar i'); }
      if (L.bar) L.bar.style.width = (info.progress * 100).toFixed(1) + '%';
      L.label.className = 'lot-label ' + info.cls + (this.selected === id ? ' sel' : '');
      L.label.setAttribute('aria-label', info.aria);
      L.label.style.transform = `translate(${s.x.toFixed(1)}px, ${s.y.toFixed(1)}px) translate(-50%, -100%)`;
    }
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const p = this.pops[i];
      p.age += dt;
      const L = this.lots[p.id];
      const s = this.#project(new THREE.Vector3(L.group.position.x, L.top + 0.15, L.group.position.z));
      p.el.style.transform = `translate(${s.x}px, ${s.y - 40 - p.age * 36}px) translate(-50%, -100%)`;
      p.el.style.opacity = String(Math.max(0, 1 - p.age / 1.2));
      if (p.age > 1.2) { p.el.remove(); this.pops.splice(i, 1); }
    }
  }
}
