// Traffic that follows the rules: everyone drives on the right side of the road,
// keeps a gap to the car in front, stops at the stop line of every intersection
// and only goes when the intersection (and the road on the other side) is clear,
// and checks for cars before pulling out of a driveway.
import * as THREE from 'three';

export const AVES = [-35, -21, -7, 7, 21, 35];   // roads running along z, at these x
export const CROSS = [-35, -21, -7, 7, 21, 35];  // roads running along x, at these z
export const ROAD_W = 3.6;
export const LANE = 0.9;                 // lane centre offset from the road centre
export const STOP_R = ROAD_W / 2 + 1.1;  // stop line distance from an intersection centre (crosswalk in between)
export const EDGE = 130;                 // roads run this far out; cars appear/vanish there
const HALF = 1.2;      // half a vehicle length
const GAP = 2.7;       // centre-to-centre distance kept to the car in front
const LOOK = 4.2;
const ACCEL = 6, DECEL = 14;
const BLOCK = 14;

const isNode = (x, z) => AVES.includes(x) && CROSS.includes(z);
const key = (x, z) => `${x},${z}`;
const sgn = v => (v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0);
const head = (a, b) => ({ x: sgn(b.x - a.x), z: sgn(b.z - a.z) });
const right = h => ({ x: -h.z, z: h.x });
const inGrid = p => p.x >= AVES[0] - 0.1 && p.x <= AVES[AVES.length - 1] + 0.1 && p.z >= CROSS[0] - 0.1 && p.z <= CROSS[CROSS.length - 1] + 0.1;

// Turn a list of road-centre points into lane points plus the intersections and
// driveways along the way (where a car has to stop and check before going).
export const DRIVEWAYS = [];   // road points where lots join the road (set by the world)
function buildPath(C, { driveStart = false, driveEnd = false } = {}) {
  const W = [];
  const stops = [];
  const n = C.length;
  for (let i = 0; i < n; i++) {
    const hin = i > 0 ? head(C[i - 1], C[i]) : null;
    const hout = i < n - 1 ? head(C[i], C[i + 1]) : null;
    let x = C[i].x, z = C[i].z;
    if (hin) { const r = right(hin); x += r.x * LANE; z += r.z * LANE; }
    if (hout && (!hin || hin.x !== hout.x || hin.z !== hout.z)) { const r = right(hout); x += r.x * LANE; z += r.z * LANE; }
    W.push(new THREE.Vector3(x, 0.06, z));
  }
  const s = [0];
  for (let i = 1; i < n; i++) s.push(s[i - 1] + W[i].distanceTo(W[i - 1]));
  for (let i = 1; i < n - 1; i++) {
    const c = C[i];
    if (isNode(c.x, c.z)) stops.push({ key: key(c.x, c.z), at: c, enter: s[i] - STOP_R, exit: s[i] + STOP_R, kind: 'node' });
  }
  // pulling out of a lot onto the road, and turning into a lot from the road
  if (driveStart && n > 2) stops.unshift({ key: 'd' + key(C[1].x, C[1].z), at: C[1], enter: Math.max(HALF + 0.3, s[1] - 3.0), exit: s[1] + 1.6, kind: 'drive' });
  if (driveEnd && n > 2) stops.push({ key: 'd' + key(C[n - 2].x, C[n - 2].z), at: C[n - 2], enter: s[n - 2] - 3.4, exit: s[n - 1] + 2, kind: 'drive', end: true });
  // turning left into a lot crosses the other lane: wait at the turn for a gap
  if (driveEnd && n > 2) {
    const hin = head(C[n - 3], C[n - 2]), hout = head(C[n - 2], C[n - 1]);
    if (hout.x === hin.z && hout.z === -hin.x) {
      const opp = { x: C[n - 2].x - right(hin).x * LANE, z: C[n - 2].z - right(hin).z * LANE };
      stops.push({ key: 'y' + key(C[n - 2].x, C[n - 2].z) + Math.random(), at: opp, enter: s[n - 2] - 0.6 + HALF + 0.15, exit: s[n - 1] + 2, kind: 'yield', dir: { x: -hin.x, z: -hin.z } });
    }
  }
  // driving past a driveway: if a truck is already pulling out there, wait for it
  const own = new Set(stops.filter(x => x.kind === 'drive').map(x => x.key));
  for (const d of DRIVEWAYS) {
    const k = 'd' + key(d.x, d.z);
    if (own.has(k)) continue;
    for (let i = 0; i < n - 1; i++) {
      const a = C[i], b = C[i + 1];
      const onX = Math.abs(a.z - b.z) < 1e-6 && Math.abs(a.z - d.z) < 1e-6 && (d.x - a.x) * (d.x - b.x) < -1e-6;
      const onZ = Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.x - d.x) < 1e-6 && (d.z - a.z) * (d.z - b.z) < -1e-6;
      if (!onX && !onZ) continue;
      const at = s[i] + Math.hypot(d.x - a.x, d.z - a.z);
      stops.push({ key: k, at: d, enter: at - 1.7, exit: at + 1.7, kind: 'pass' });
    }
  }
  stops.sort((a, b) => a.enter - b.enter);
  return { W, s, len: s[n - 1], stops };
}

// expand a corner list so every intersection passed straight through is listed
function expand(pts) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = out[out.length - 1], b = pts[i];
    const h = head(a, b);
    if (!h.x && !h.z) continue;
    if (h.x && CROSS.includes(a.z)) for (const x of (h.x > 0 ? AVES : [...AVES].reverse())) if ((x - a.x) * h.x > 1e-6 && (b.x - x) * h.x > 1e-6) out.push({ x, z: a.z });
    if (h.z && AVES.includes(a.x)) for (const z of (h.z > 0 ? CROSS : [...CROSS].reverse())) if ((z - a.z) * h.z > 1e-6 && (b.z - z) * h.z > 1e-6) out.push({ x: a.x, z });
    out.push(b);
  }
  return out;
}
function noUturn(C) {
  for (let i = 1; i < C.length - 1; i++) {
    const a = head(C[i - 1], C[i]), b = head(C[i], C[i + 1]);
    if (a.x === -b.x && a.z === -b.z) return false;
  }
  return true;
}

// ways out of a lot: a driveway onto each road beside it, heading to either end
function exits(lx, lz) {
  const out = [];
  const sides = [
    { road: { x: lx + 7, z: lz }, inLot: { x: lx + 2.6, z: lz }, along: 'z', ok: AVES.includes(lx + 7) && lx <= 0 },
    { road: { x: lx - 7, z: lz }, inLot: { x: lx - 2.6, z: lz }, along: 'z', ok: AVES.includes(lx - 7) && lx > 0 },
    { road: { x: lx, z: lz + 7 }, inLot: { x: lx, z: lz + 2.6 }, along: 'x', ok: CROSS.includes(lz + 7) && lz <= 0 },
    { road: { x: lx, z: lz - 7 }, inLot: { x: lx, z: lz - 2.6 }, along: 'x', ok: CROSS.includes(lz - 7) && lz > 0 },
  ];
  // each lot's loading bays face the middle of town (two sides), so trucks always use them
  for (const sd of sides) {
    if (!sd.ok) continue;
    for (const d of [-7, 7]) {
      const n = sd.along === 'z' ? { x: sd.road.x, z: sd.road.z + d } : { x: sd.road.x + d, z: sd.road.z };
      if (isNode(n.x, n.z)) out.push({ inLot: sd.inLot, road: sd.road, node: n });
    }
  }
  return out;
}

export function lotDriveways(lots) {
  const seen = new Map();
  for (const [lx, lz] of Object.values(lots)) for (const e of exits(lx, lz)) seen.set(key(e.road.x, e.road.z), e.road);
  return [...seen.values()];
}
export function lotRoute([ax, az], [bx, bz]) {
  let best = null;
  for (const A of exits(ax, az)) for (const B of exits(bx, bz)) {
    const mids = [[A.node, { x: B.node.x, z: A.node.z }, B.node], [A.node, { x: A.node.x, z: B.node.z }, B.node]];
    for (const m of mids) {
      const C = expand([A.inLot, A.road, ...m, B.road, B.inLot]);
      if (!noUturn(C)) continue;
      let len = 0;
      for (let i = 1; i < C.length; i++) len += Math.abs(C[i].x - C[i - 1].x) + Math.abs(C[i].z - C[i - 1].z);
      if (!best || len < best.len) best = { C, len };
    }
  }
  return best ? best.C : null;
}

// a random drive across town: in from one edge, a few turns, out another edge
function randomRoute(rnd) {
  const horiz = rnd() < 0.5;
  const dir = rnd() < 0.5 ? 1 : -1;
  const line = (horiz ? CROSS : AVES)[Math.floor(rnd() * 4)];
  let h = horiz ? { x: dir, z: 0 } : { x: 0, z: dir };
  const start = horiz ? { x: -dir * EDGE, z: line } : { x: line, z: -dir * EDGE };
  const first = horiz ? { x: dir > 0 ? AVES[0] : AVES[3], z: line } : { x: line, z: dir > 0 ? CROSS[0] : CROSS[3] };
  const C = [start, first];
  let p = first;
  const visited = new Set([key(first.x, first.z)]);
  for (let k = 0; k < 7; k++) {
    const r = rnd();
    let nh = h;
    if (r < 0.25) nh = right(h);
    else if (r < 0.5) nh = { x: h.z, z: -h.x };   // left
    let nx = { x: p.x + nh.x * BLOCK, z: p.z + nh.z * BLOCK };
    // never loop back through a junction already driven through
    if (inGrid(nx) && visited.has(key(nx.x, nx.z))) { nh = h; nx = { x: p.x + h.x * BLOCK, z: p.z + h.z * BLOCK }; if (inGrid(nx) && visited.has(key(nx.x, nx.z))) break; }
    h = nh;
    if (!inGrid(nx)) break;
    visited.add(key(nx.x, nx.z));
    C.push(nx); p = nx;
  }
  C.push({ x: h.x ? h.x * EDGE : p.x, z: h.z ? h.z * EDGE : p.z });
  return expand(C);
}

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.holds = new Map();   // intersection key -> car holding it
    this.turn = new Map();    // intersection key -> car that has waited longest (goes next)
    this.nextId = 1;
    this.rnd = Math.random;
  }

  add(C, mesh, { speed = 5, kind = 'ambient', drive = false, onArrive = null, data = null, at = 0 } = {}) {
    const P = buildPath(C, { driveStart: drive, driveEnd: drive });
    const car = { id: this.nextId++, mesh, P, s: at, seg: 0, v: 0, max: speed, kind, onArrive, data, ai: 0, ri: 0, held: new Set(), wait: 0, stuck: 0, ghost: 0, pos: new THREE.Vector3(), dir: new THREE.Vector3(1, 0, 0), yaw: null };
    while (car.ai < P.stops.length && P.stops[car.ai].exit < at) car.ai++;
    car.ri = car.ai;
    this.#place(car);
    car.v = at > 0 ? speed : 0;
    mesh.visible = true;
    this.scene.add(mesh);
    this.cars.push(car);
    return car;
  }

  // a new ambient car; with `midway`, drop it somewhere along its trip (used at start)
  spawnAmbient(mesh, midway = false) {
    for (let tries = 0; tries < 12; tries++) {
      const C = randomRoute(this.rnd);
      const P = buildPath(C);
      let at = 0;
      if (midway) {
        at = EDGE - 50 + this.rnd() * (P.len - 2 * (EDGE - 50));
        if (P.stops.some(st => at + HALF > st.enter - 1.5 && at - HALF < st.exit + 0.5)) continue;
      }
      const p = this.#pointAt(P, at);
      if (this.cars.some(c => c.pos.distanceTo(p) < 7)) continue;
      return this.add(C, mesh, { speed: 4 + this.rnd() * 2, at });
    }
    return null;
  }

  remove(car) {
    const i = this.cars.indexOf(car);
    if (i >= 0) this.cars.splice(i, 1);
    for (const k of car.held) if (this.holds.get(k) === car) this.holds.delete(k);
    for (const [k, c] of this.turn) if (c.car === car) this.turn.delete(k);
    car.held.clear();
    this.scene.remove(car.mesh); car.mesh.visible = false;
  }
  clear(kind) {
    for (const c of [...this.cars]) if (!kind || c.kind === kind) this.remove(c);
  }
  count(fn) { return this.cars.filter(fn).length; }

  #pointAt(P, s, out = new THREE.Vector3()) {
    const { W, s: S } = P;
    let i = 0;
    while (i < S.length - 2 && S[i + 1] < s) i++;
    const u = Math.min(1, Math.max(0, (s - S[i]) / ((S[i + 1] - S[i]) || 1)));
    return out.lerpVectors(W[i], W[i + 1], u);
  }
  #place(car) {
    const { W, s: S } = car.P;
    while (car.seg < S.length - 2 && S[car.seg + 1] <= car.s) car.seg++;
    const a = W[car.seg], b = W[car.seg + 1];
    const u = Math.min(1, Math.max(0, (car.s - S[car.seg]) / ((S[car.seg + 1] - S[car.seg]) || 1)));
    car.pos.lerpVectors(a, b, u);
    car.dir.subVectors(b, a).normalize();
  }

  // is anything in my way within `look` ahead in my lane? returns the gap or Infinity
  #ahead(car, look = LOOK) {
    let gap = Infinity, who = null;
    for (const o of this.cars) {
      if (o === car || o.ghost > 0) continue;
      const rx = o.pos.x - car.pos.x, rz = o.pos.z - car.pos.z;
      const along = rx * car.dir.x + rz * car.dir.z;
      if (along <= 0 || along > look) continue;
      const lat = Math.abs(rx * car.dir.z - rz * car.dir.x);
      if (lat > 0.85) continue;
      if (along < gap) { gap = along; who = o; }
    }
    return { gap, who };
  }

  #clearNear(car, p, r, countWaiting = false) {
    for (const o of this.cars) {
      if (o === car || (o.waiting && !countWaiting)) continue;   // someone stopped at a line isn't going anywhere
      const rx = o.pos.x - car.pos.x, rz = o.pos.z - car.pos.z;
      const behind = rx * car.dir.x + rz * car.dir.z < -0.5 && Math.abs(rx * car.dir.z - rz * car.dir.x) < 0.85;
      if (behind) continue;   // the car behind me waits for me
      if (o.pos.distanceTo(p) < r) return false;
    }
    return true;
  }

  // is there room in my lane at arc-length s0 of my route (cars going my way only)?
  #laneClear(car, s0, room) {
    const p = this.#pointAt(car.P, s0);
    const q = this.#pointAt(car.P, Math.min(car.P.len, s0 + 0.5));
    const d = q.sub(p); if (d.lengthSq() < 1e-6) return true; d.normalize();
    for (const o of this.cars) {
      if (o === car || o.dir.x * d.x + o.dir.z * d.z < 0.7) continue;
      const rx = o.pos.x - p.x, rz = o.pos.z - p.z;
      const along = rx * d.x + rz * d.z, lat = Math.abs(rx * d.z - rz * d.x);
      if (lat < 0.85 && along > -HALF * 2 && along < room) { this.lastBlock = o.id; return false; }
    }
    return true;
  }

  // will car o drive within r of point p in its next `ahead` units of road?
  #willPass(o, p, r, ahead) {
    if (o.pos.distanceTo(p) > ahead + r) return false;
    const q = new THREE.Vector3();
    for (let d = 0; d <= ahead; d += 0.8) {
      if (o.s + d > o.P.len) break;
      if (this.#pointAt(o.P, o.s + d, q).distanceTo(p) < r) return true;
    }
    return false;
  }

  #canEnter(car, st) {
    if (this.holds.has(st.key) && this.holds.get(st.key) !== car) { car.why = 'held:' + this.holds.get(st.key).id; return false; }
    // take turns: once someone has waited a while, they go next
    const t = this.turn.get(st.key);
    if (t && t.car !== car && this.cars.includes(t.car)) {
      // the longest-waiting car goes next, but only for a few seconds: if it still
      // can't go, everyone else may carry on (so one blocked car can't jam the town)
      if (this.clock - t.since < 3) { car.why = 'turn:' + t.car.id; return false; }
      this.turn.delete(st.key); t.car.noTurnUntil = this.clock + 6;
    }
    if (st.kind === 'node') {
      const c = new THREE.Vector3(st.at.x, 0.06, st.at.z);
      // nobody else in the box (holders are gone once they've left it)
      for (const o of this.cars) if (o !== car && Math.abs(o.pos.x - c.x) < STOP_R - 0.2 && Math.abs(o.pos.z - c.z) < STOP_R - 0.2) { car.why = 'box:' + o.id; return false; }
      // and room on the far side so I won't stop in the middle
      const ok = this.#laneClear(car, Math.min(car.P.len, st.exit + HALF), GAP);
      if (!ok) car.why = 'exit:' + this.lastBlock;
      return ok;
    }
    // turning into a lot: you claim the driveway from back at the last junction, so
    // nobody pulls out into you; cars already on the road keep their right of way
    if (st.end || st.kind === 'pass') return true;
    if (st.kind === 'yield') {
      // a gap in oncoming traffic
      const p = new THREE.Vector3(st.at.x, 0.06, st.at.z);
      for (const o of this.cars) if (o !== car && (o.pos.distanceTo(p) < 2.4 || this.#willPass(o, p, 1.7, 14))) return false;
      return true;
    }
    // pulling out of a lot: no car close by on the road, and room in the lane I'm joining
    const dp = new THREE.Vector3(st.at.x, 0.06, st.at.z);
    if (!this.#clearNear(car, dp, 4.2)) return false;
    // and nobody coming down the road toward the driveway soon (even round a corner)
    for (const o of this.cars) if (o !== car && !o.waiting && this.#willPass(o, dp, 2.4, 11)) return false;
    return this.#laneClear(car, car.P.s[1] + 0.5, GAP + 0.5);
  }

  update(dt) {
    if (!dt) return;
    this.clock = (this.clock || 0) + dt;
    for (const car of [...this.cars]) {
      let target = car.max;
      const stops = car.P.stops;
      const st = stops[car.ai];
      car.waiting = false; car.queued = false;
      if (car.ghost > 0) car.ghost -= dt;
      if (st && car.ghost <= 0 && st.kind === 'pass') {
        // passing a driveway: claim it as you approach; only slow down if a truck is pulling out
        const stopAt = st.enter - HALF - 0.15;
        const dist = stopAt - car.s;
        if (dist < 7 && (!this.holds.has(st.key) || this.holds.get(st.key) === car)) { car.held.add(st.key); this.holds.set(st.key, car); car.ai++; }
        else if (car.s + HALF > st.enter + 0.3) car.ai++;
        else if (dist <= 0.12) { target = 0; car.waiting = car.v < 0.3; car.why = 'held:' + this.holds.get(st.key)?.id; }
        else target = Math.min(target, Math.sqrt(2 * DECEL * 0.8 * Math.max(0, dist)) + 0.05);
      } else if (st && car.ghost <= 0) {
        const stopAt = st.enter - HALF - 0.15;
        const dist = stopAt - car.s;
        if (car.s + HALF > st.enter + 0.3) { car.ai++; car.wait = 0; }   // already in the junction: clear it, never stop inside
        else if (dist <= 0.12) {
          car.wait += dt;
          const pause = st.kind === 'node' ? 0.45 : st.kind === 'yield' || st.kind === 'pass' ? 0 : 0.25;   // a real stop before going
          // if the next stop comes before I'd be clear of this one, I need both at once
          const group = [st];
          while (stops[car.ai + group.length] && stops[car.ai + group.length].enter - HALF - 0.15 < group[group.length - 1].exit + HALF + 0.3) group.push(stops[car.ai + group.length]);
          if (car.wait > 2.5 && !this.turn.has(st.key) && !(car.noTurnUntil > this.clock)) this.turn.set(st.key, { car, since: this.clock });
          if (car.wait >= pause && group.every(g => this.#canEnter(car, g))) {
            for (const g of group) { car.held.add(g.key); this.holds.set(g.key, car); if (this.turn.get(g.key)?.car === car) this.turn.delete(g.key); }
            car.ai += group.length; car.wait = 0;
          } else { target = 0; car.waiting = car.v < 0.3; }
        } else target = Math.min(target, Math.sqrt(2 * DECEL * 0.8 * Math.max(0, dist)) + 0.05);
      }
      if (car.ghost <= 0) {
        const { gap, who } = this.#ahead(car);
        if (who) {
          // two cars blocking each other: the older one goes first
          const mutual = this.#ahead(who).who === car;
          if (!(mutual && car.id < who.id)) { target = Math.min(target, Math.max(0, (gap - GAP) * 2.2)); if (target < 0.05) { car.why = 'ahead:' + who.id; car.queued = who.waiting || who.queued; } }
        }
      }
      car.v = target > car.v ? Math.min(target, car.v + ACCEL * dt) : Math.max(target, car.v - DECEL * dt);
      car.s += car.v * dt;
      // claimed a junction but got stuck before reaching it: give the claim back so
      // others can use the junction meanwhile, and ask again later
      if (car.held.size && car.v < 0.05) car.heldStuck = (car.heldStuck || 0) + dt; else car.heldStuck = 0;
      if (car.heldStuck > 4) {
        while (car.ai > car.ri && car.s + HALF < stops[car.ai - 1].enter - 0.05) {
          car.ai--; const k = stops[car.ai].key;
          if (this.holds.get(k) === car) this.holds.delete(k);
          car.held.delete(k);
        }
        car.heldStuck = 0;
      }
      // waiting your turn at a line is fine; only a car stuck in the open counts as jammed
      if (car.v < 0.05 && !car.waiting && !car.queued) car.stuck += dt; else car.stuck = 0;
      if (car.stuck > 12) { car.ghost = 2.5; car.stuck = 0; this.onGhost?.(car, st, this.#ahead(car).who); }  // last-resort unjam, almost never needed
      // let go of each intersection once fully through it
      while (car.ri < car.ai && car.s - HALF > stops[car.ri].exit) {
        const k = stops[car.ri].key;
        if (this.holds.get(k) === car) this.holds.delete(k);
        car.held.delete(k); car.ri++;
      }
      // after an unjam, don't stop in the middle of a junction: count ones I'm already in as passed
      if (car.ghost > 0) while (car.ai < stops.length && car.s + HALF > stops[car.ai].enter) { car.ai++; car.wait = 0; }
      if (car.s >= car.P.len) {
        this.remove(car);
        car.onArrive?.(car);
        continue;
      }
      this.#place(car);
      car.mesh.position.copy(car.pos);
      const yaw = Math.atan2(-car.dir.z, car.dir.x);
      if (car.yaw === null) car.yaw = yaw;
      let d = yaw - car.yaw;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      car.yaw += d * Math.min(1, dt * 10);
      car.mesh.rotation.y = car.yaw;
    }
  }
}
