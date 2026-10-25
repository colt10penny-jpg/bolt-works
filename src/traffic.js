// Traffic that follows the rules: everyone drives on the right side of the road,
// keeps a gap to the car in front, stops at the stop line of every intersection
// and only goes when the intersection (and the road on the other side) is clear,
// and checks for cars before pulling out of a driveway.
import * as THREE from 'three';

export const ROAD_W = 3.6;
const HALF_ROAD = 3.6 / 2;
export const LANE = 0.9;                 // lane centre offset from the road centre
export const STOP_R = ROAD_W / 2 + 1.1;  // stop line distance from an intersection centre (crosswalk in between)
export const EDGE = 130;                 // roads out of town run this far; cars appear/vanish there
export const BLOCK = 14;
// Delivery vehicle centers stop just outside the actual physical factory envelope.
export const DOCK_OFFSET = 5.55;
const HALF = 1.2;      // half a vehicle length
const GAP = 2.7;       // centre-to-centre distance kept to the car in front
const LOOK = 4.2;
const ACCEL = 6, DECEL = 14;

const key = (x, z) => `${x},${z}`;
const sgn = v => (v > 1e-6 ? 1 : v < -1e-6 ? -1 : 0);
const head = (a, b) => ({ x: sgn(b.x - a.x), z: sgn(b.z - a.z) });
const right = h => ({ x: -h.z, z: h.x });
const DIRS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];

// ---------- the road network ----------
// Town is a set of blocks (plots); roads run along the edges of the blocks. Each
// stretch of road between two junctions is a "segment", and is either in good
// shape (cars use it), worn out, or not built yet. A few roads lead out of town.
export const segKey = (a, b) => { const ka = key(a.x, a.z), kb = key(b.x, b.z); return ka < kb ? ka + '|' + kb : kb + '|' + ka; };
export function blockSides(cx, cz) {
  const h = BLOCK / 2;
  return [
    { side: 'x+', road: { x: cx + h, z: cz }, inLot: { x: cx + DOCK_OFFSET, z: cz }, ends: [{ x: cx + h, z: cz - h }, { x: cx + h, z: cz + h }] },
    { side: 'x-', road: { x: cx - h, z: cz }, inLot: { x: cx - DOCK_OFFSET, z: cz }, ends: [{ x: cx - h, z: cz - h }, { x: cx - h, z: cz + h }] },
    { side: 'z+', road: { x: cx, z: cz + h }, inLot: { x: cx, z: cz + DOCK_OFFSET }, ends: [{ x: cx - h, z: cz + h }, { x: cx + h, z: cz + h }] },
    { side: 'z-', road: { x: cx, z: cz - h }, inLot: { x: cx, z: cz - DOCK_OFFSET }, ends: [{ x: cx - h, z: cz - h }, { x: cx + h, z: cz - h }] },
  ].map(s => ({ ...s, seg: segKey(s.ends[0], s.ends[1]) }));
}
export const NET = { blocks: [], segs: new Map(), good: new Set(), exits: [], adj: new Map(), roads: [] };
const nodeOf = k => { const [x, z] = k.split(',').map(Number); return { x, z }; };

// every segment around every block: key -> { a, b }
export function townSegments(blocks) {
  const m = new Map();
  for (const [cx, cz] of blocks) for (const s of blockSides(cx, cz)) m.set(s.seg, { a: s.ends[0], b: s.ends[1] });
  return m;
}
// places a road could leave town: a junction on the edge, heading straight out
// without running into any other part of town
export function exitCandidates(blocks) {
  const segs = townSegments(blocks), nodes = new Map();
  for (const { a, b } of segs.values()) { nodes.set(key(a.x, a.z), a); nodes.set(key(b.x, b.z), b); }
  const out = [];
  for (const n of nodes.values()) for (const d of DIRS) {
    const next = { x: n.x + d.x * BLOCK, z: n.z + d.z * BLOCK };
    if (segs.has(segKey(n, next))) continue;
    // the way out must be clear of town all the way to the edge
    const blocked = blocks.some(([cx, cz]) => d.x ? Math.abs(cz - n.z) < BLOCK / 2 + 0.1 && (cx - n.x) * d.x > 0 : Math.abs(cx - n.x) < BLOCK / 2 + 0.1 && (cz - n.z) * d.z > 0);
    // only straight out from a side, not off the tip of a corner
    const along = DIRS.filter(e => e.x !== d.x || e.z !== d.z).filter(e => !(e.x === -d.x && e.z === -d.z));
    const onEdge = along.some(e => segs.has(segKey(n, { x: n.x + e.x * BLOCK, z: n.z + e.z * BLOCK })));
    if (!blocked && onEdge) out.push({ node: n, dir: d });
  }
  return out;
}
export function makeExits(blocks, seed) {
  let s = (seed >>> 0) % 2147483647 || 1;
  const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const all = exitCandidates(blocks);
  const n = 3 + Math.floor(r() * 3);
  const out = [];
  while (out.length < n && all.length) {
    const e = all.splice(Math.floor(r() * all.length), 1)[0];
    if (out.some(o => o.node.x === e.node.x && o.node.z === e.node.z)) continue;   // one per junction
    out.push(e);
  }
  return out;
}
export const exitFar = e => ({ x: e.node.x + e.dir.x * (EDGE + 10 - Math.abs(e.dir.x ? e.node.x : e.node.z)), z: e.node.z + e.dir.z * (EDGE + 10 - Math.abs(e.dir.x ? e.node.x : e.node.z)) });

// set up the network: town blocks, which segments are in good shape, the exits
export function setNetwork(blocks, good, exits) {
  NET.blocks = blocks;
  NET.segs = townSegments(blocks);
  NET.good = new Set([...good].filter(k => NET.segs.has(k)));
  NET.exits = exits;
  const adj = new Map();
  const link = (a, b) => { const k = key(a.x, a.z); if (!adj.has(k)) adj.set(k, []); adj.get(k).push(b); };
  for (const k of NET.good) { const { a, b } = NET.segs.get(k); link(a, b); link(b, a); }
  NET.adj = adj;
  // centre lines of every bit of road (built or not) and the exits, for flattening land
  NET.roads = [...NET.segs.values()].map(({ a, b }) => ({ x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) }));
  for (const e of exits) { const f = exitFar(e); NET.roads.push({ x0: Math.min(e.node.x, f.x), z0: Math.min(e.node.z, f.z), x1: Math.max(e.node.x, f.x), z1: Math.max(e.node.z, f.z), exit: true }); }
}
const exitAt = n => NET.exits.find(e => e.node.x === n.x && e.node.z === n.z);
const nbrs = n => NET.adj.get(key(n.x, n.z)) || [];
const degree = n => nbrs(n).length + (exitAt(n) ? 1 : 0);
// a real junction (three or more ways): cars stop and take turns here
const isNode = (x, z) => degree({ x, z }) >= 3;
// is there usable road leaving junction (x, z) in direction h?
export function hasRoad(x, z, h) {
  if (nbrs({ x, z }).some(m => sgn(m.x - x) === h.x && sgn(m.z - z) === h.z)) return true;
  const e = exitAt({ x, z });
  return !!e && e.dir.x === h.x && e.dir.z === h.z;
}
export const nodeDegree = (x, z) => degree({ x, z });
export function distToRoad(x, z) {
  let d = Infinity;
  for (const r of NET.roads) {
    const cx = Math.max(r.x0, Math.min(r.x1, x)), cz = Math.max(r.z0, Math.min(r.z1, z));
    d = Math.min(d, Math.hypot(x - cx, z - cz));
  }
  return d;
}

// ---------- finding a way ----------
// Breadth-first search over (junction, heading) so the route never U-turns.
// starts: [{ node, h, pts }]; goal(node, h) returns extra end points or null.
function search(starts, goal, maxSteps = 400) {
  const seen = new Set();
  let frontier = starts.map(st => ({ ...st }));
  for (let step = 0; step < maxSteps && frontier.length; step++) {
    const next = [];
    for (const st of frontier) {
      const k = key(st.node.x, st.node.z) + '/' + st.h.x + st.h.z;
      if (seen.has(k)) continue;
      seen.add(k);
      const end = goal(st.node, st.h, st);
      if (end) return [...st.pts, ...end];
      for (const m of nbrs(st.node)) {
        const d = head(st.node, m);
        if (d.x === -st.h.x && d.z === -st.h.z) continue;          // no U-turns
        if (st.pts.some(p => p.x === m.x && p.z === m.z)) continue; // never the same junction twice
        next.push({ node: m, h: d, pts: [...st.pts, m] });
      }
    }
    frontier = next;
  }
  return null;
}
// Truck routes start and finish in an exterior loading forecourt, not inside a wall.
// How a truck gets out of a lot: onto any side with good road, toward either end.
// With `rightOnly`, only turning right out of the lot (into the near lane, crossing nobody).
const same = (a, b) => a.x === b.x && a.z === b.z;
function lotStarts([lx, lz], rightOnly = false) {
  const out = [];
  for (const sd of blockSides(lx, lz)) {
    if (!NET.good.has(sd.seg)) continue;
    for (const e of sd.ends) {
      if (rightOnly && !same(head(sd.road, e), right(head(sd.inLot, sd.road)))) continue;
      out.push({ node: e, h: head(sd.road, e), pts: [sd.inLot, sd.road, e] });
    }
  }
  return out;
}
// and in: with `rightOnly`, arriving so the lot is on your right (no turning across traffic)
function lotGoal([lx, lz], rightOnly = false) {
  const sides = blockSides(lx, lz).filter(sd => NET.good.has(sd.seg));
  return (n, h) => {
    for (const sd of sides) for (const e of sd.ends) {
      if (e.x !== n.x || e.z !== n.z) continue;
      const g = head(e, sd.road);
      if (g.x === -h.x && g.z === -h.z) continue;
      if (rightOnly && !same(head(sd.road, sd.inLot), right(g))) continue;
      return [sd.road, sd.inLot];
    }
    return null;
  };
}
export function lotRoute(A, B) {
  if (A[0] === B[0] && A[1] === B[1]) return null;
  // right in, right out where the roads allow it (much smoother traffic); otherwise any way
  const C = search(lotStarts(A, true), lotGoal(B, true)) || search(lotStarts(A), lotGoal(B));
  return C && C.length > 3 ? C : null;
}
export function lotDriveways(lots) {
  const seen = new Map();
  for (const [lx, lz] of lots) for (const sd of blockSides(lx, lz)) if (NET.good.has(sd.seg)) seen.set(key(sd.road.x, sd.road.z), sd.road);
  return [...seen.values()];
}
// can a lot be reached by road at all?
export const lotConnected = pos => lotStarts(pos).length > 0;

// a random drive: in along one road from out of town, across town, out along another
function randomRoute(rnd) {
  const ex = NET.exits.filter(e => nbrs(e.node).length);
  if (ex.length < 2) return null;
  for (let tries = 0; tries < 10; tries++) {
    const a = ex[Math.floor(rnd() * ex.length)];
    const others = ex.filter(e => e !== a);
    const b = others[Math.floor(rnd() * others.length)];
    const start = [{ node: a.node, h: { x: -a.dir.x, z: -a.dir.z }, pts: [exitFar(a), a.node] }];
    const toB = (n, h) => (n.x === b.node.x && n.z === b.node.z && !(b.dir.x === -h.x && b.dir.z === -h.z)) ? [exitFar(b)] : null;
    // usually via a random junction, for variety
    const keys = [...NET.adj.keys()];
    const w = nodeOf(keys[Math.floor(rnd() * keys.length)]);
    if (rnd() < 0.75) {
      let viaH = null;
      const first = search(start, (n, h) => { if (n.x === w.x && n.z === w.z) { viaH = h; return []; } return null; });
      if (first && viaH) { const C = search([{ node: w, h: viaH, pts: first }], toB); if (C) return C; }
    }
    const C = search(start, toB);
    if (C) return C;
  }
  return null;
}

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
  return roundBends(C, W, s, stops);
}
// At a bend (a corner with just two roads, nobody stopping) the car follows a curve round
// the inside corner instead of making a sharp turn. Stop distances are moved to match.
function roundBends(C, W, s, stops) {
  const n = C.length, W2 = [], map = [];   // map: [old distance, new distance] at each original point
  let len = 0;
  const push = v => { if (W2.length) len += v.distanceTo(W2[W2.length - 1]); W2.push(v); };
  for (let i = 0; i < n; i++) {
    const c = C[i];
    const bend = i > 0 && i < n - 1 && NET.adj.has(key(c.x, c.z)) && degree(c) === 2;
    const hin = bend && head(C[i - 1], c), hout = bend && head(c, C[i + 1]);
    if (!bend || (hin.x === hout.x && hin.z === hout.z) || (hin.x === -hout.x && hin.z === -hout.z)) { push(W[i]); map.push([s[i], len]); continue; }
    // centre of the curve: the inside corner of the bend
    const cx = c.x + (hout.x - hin.x) * HALF_ROAD, cz = c.z + (hout.z - hin.z) * HALF_ROAD;
    const w = W[i], t0 = (cx - w.x) * hin.x + (cz - w.z) * hin.z, t1 = (cx - w.x) * hout.x + (cz - w.z) * hout.z;
    const p0 = { x: w.x + hin.x * t0, z: w.z + hin.z * t0 }, p1 = { x: w.x + hout.x * t1, z: w.z + hout.z * t1 };
    const r = Math.hypot(p0.x - cx, p0.z - cz);
    let a0 = Math.atan2(p0.z - cz, p0.x - cx), a1 = Math.atan2(p1.z - cz, p1.x - cx);
    while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI; while (a0 - a1 > Math.PI) a1 += 2 * Math.PI;
    for (let k = 0; k <= 8; k++) {
      const a = a0 + (a1 - a0) * k / 8;
      push(new THREE.Vector3(cx + Math.cos(a) * r, w.y, cz + Math.sin(a) * r));
      if (k === 4) map.push([s[i], len]);
    }
  }
  // old distance along the route -> new distance
  const remap = d => {
    if (d <= map[0][0]) return d - map[0][0] + map[0][1];
    for (let j = 1; j < map.length; j++) if (d <= map[j][0]) { const [o0, n0] = map[j - 1], [o1, n1] = map[j]; return n0 + (n1 - n0) * (o1 > o0 ? (d - o0) / (o1 - o0) : 0); }
    const [o, nn] = map[map.length - 1]; return nn + d - o;
  };
  if (W2.length === W.length) return { W, s, len: s[n - 1], stops };
  const s2 = [0];
  for (let i = 1; i < W2.length; i++) s2.push(s2[i - 1] + W2[i].distanceTo(W2[i - 1]));
  for (const st of stops) { st.enter = remap(st.enter); st.exit = remap(st.exit); }
  return { W: W2, s: s2, len: s2[s2.length - 1], stops };
}

export class Traffic {
  constructor(scene) {
    this.scene = scene;
    this.cars = [];
    this.holds = new Map();   // intersection key -> car holding it
    this.pass = new Map();    // driveway key -> cars on the road driving past it (any number at once)
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
      if (!C) return null;
      const P = buildPath(C);
      let at = 0;
      if (midway) {
        at = (EDGE - 60) + this.rnd() * Math.max(1, P.len - 2 * (EDGE - 60));
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
    for (const k of car.held) this.#release(car, k);
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

  // claim a stop. Cars driving past a driveway share it with each other (they're in
  // their own lanes); only a truck pulling in or out needs it to itself.
  #take(car, st) {
    car.held.add(st.key);
    if (st.kind === 'pass') { if (!this.pass.has(st.key)) this.pass.set(st.key, new Set()); this.pass.get(st.key).add(car); }
    else this.holds.set(st.key, car);
  }
  #release(car, k) {
    if (this.holds.get(k) === car) this.holds.delete(k);
    const ps = this.pass.get(k);
    if (ps) { ps.delete(car); if (!ps.size) this.pass.delete(k); }
    car.held.delete(k);
  }
  #canEnter(car, st) {
    if (this.holds.has(st.key) && this.holds.get(st.key) !== car) { car.why = 'held:' + this.holds.get(st.key).id; return false; }
    // take turns: once someone has waited a while, they go next
    const t = this.turn.get(st.key);
    if (t && t.car !== car && this.cars.includes(t.car)) {
      // the longest-waiting car goes next, but only for a few seconds: if it still
      // can't go, everyone else may carry on (so one blocked car can't jam the town)
      if (this.clock - t.since < 4) { car.why = 'turn:' + t.car.id; return false; }
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
    if (st.kind === 'pass') return true;
    // a truck turning in or pulling out waits for road cars already passing the driveway
    const by = [...(this.pass.get(st.key) || [])].find(o => o !== car);
    if (by) { car.why = 'passing:' + by.id; return false; }
    if (st.end) return true;
    if (st.kind === 'yield') {
      // a gap in oncoming traffic
      const p = new THREE.Vector3(st.at.x, 0.06, st.at.z);
      // (a truck waiting in the lot for the driveway I'm holding can't move until I'm in, so it doesn't count)
      for (const o of this.cars) {
        if (o === car || (o.waiting && this.holds.get(o.P.stops[o.ai]?.key) === car)) continue;
        // a car standing still a good way off (waiting at a junction) can't reach me before I'm in
        if (o.v < 0.1 && o.pos.distanceTo(p) > 6) continue;
        if (o.pos.distanceTo(p) < 2.4 || this.#willPass(o, p, 1.7, 14)) { car.why = 'yield:' + o.id; return false; }
      }
      return true;
    }
    // pulling out of a lot: no car close by on the road, and room in the lane I'm joining
    const dp = new THREE.Vector3(st.at.x, 0.06, st.at.z);
    if (!this.#clearNear(car, dp, 4.2)) return false;
    // and nobody coming down the road toward the driveway soon (even round a corner)
    for (const o of this.cars) if (o !== car && !o.waiting && this.#willPass(o, dp, 2.4, 11)) return false;
    return this.#laneClear(car, car.P.s[1] + 0.5, GAP + 0.5);
  }

  // A rare knot: a ring of cars each waiting on the next, none able to move. Follow who
  // each stopped car is waiting for; if the chain comes back round, one car in the ring
  // squeezes through so the rest can carry on.
  #untangle() {
    const still = c => c.v < 0.05 && c.stillT > 15 && c.ghost <= 0;
    const byId = new Map(this.cars.map(c => [c.id, c]));
    const next = c => { const m = /:(\d+)/.exec(c.why || ''); return m ? byId.get(+m[1]) : null; };
    for (const c of this.cars) {
      if (!still(c)) continue;
      const seen = new Set([c]);
      let o = next(c);
      while (o && still(o) && !seen.has(o)) { seen.add(o); o = next(o); }
      if (o && seen.has(o)) { o.ghost = 2.5; o.stillT = 0; this.onGhost?.(o, o.P.stops[o.ai], null); return; }
    }
  }
  // (for testing) why is this car waiting at its next stop?
  explain(car) {
    const stops = car.P.stops, st = stops[car.ai]; if (!st) return 'no stop';
    const group = [st];
    while (stops[car.ai + group.length] && stops[car.ai + group.length].kind !== 'pass' && stops[car.ai + group.length].enter - HALF - 0.15 < group[group.length - 1].exit + HALF + 0.3) group.push(stops[car.ai + group.length]);
    const why0 = car.why;
    const out = group.map(g => { car.why = ''; const ok = this.#canEnter(car, g); return g.kind + ':' + g.key.slice(0, 10) + '=' + (ok ? 'ok' : car.why || '?'); });
    car.why = why0;
    return out.join(' ') + ' dist=' + (st.enter - HALF - 0.15 - car.s).toFixed(2) + ' wait=' + car.wait.toFixed(1);
  }
  update(dt) {
    if (!dt) return;
    this.clock = (this.clock || 0) + dt;
    if ((this.knotT = (this.knotT || 0) + dt) > 1) { this.knotT = 0; this.#untangle(); }
    for (const car of [...this.cars]) {
      let target = car.max;
      const stops = car.P.stops;
      const st = stops[car.ai];
      car.waiting = false; car.queued = false;
      if (car.ghost > 0) {
        car.ghost -= dt;
        // don't come back to solid while still overlapping someone
        if (car.ghost <= 0 && this.cars.some(o => o !== car && o.pos.distanceTo(car.pos) < 1.9)) car.ghost = 0.2;
      }
      if (st && car.ghost <= 0 && st.kind === 'pass') {
        // passing a driveway: claim it as you approach; only slow down if a truck is pulling out
        const stopAt = st.enter - HALF - 0.15;
        const dist = stopAt - car.s;
        const t = this.turn.get(st.key);
        // (never stop with my tail still in the junction behind me)
        const inJunction = [...car.held].some(k => /^-?\d/.test(k));
        const giveWay = !inJunction && t && t.car !== car && t.car.waiting && this.cars.includes(t.car) && this.clock - t.since < 4 && car.s + HALF < st.enter;
        if (dist < 7 && !giveWay && (!this.holds.has(st.key) || this.holds.get(st.key) === car)) { this.#take(car, st); car.ai++; car.wait = 0; if (t?.car === car) this.turn.delete(st.key); }
        else if (car.s + HALF > st.enter + 0.3) car.ai++;
        else if (dist <= 0.12) {
          target = 0; car.waiting = car.v < 0.3; car.why = giveWay ? 'turn:' + t.car.id : 'held:' + this.holds.get(st.key)?.id;
          // trucks keep turning in here: after a short wait it's my turn to drive past
          car.wait += dt;
          if (car.wait > 2.5 && !giveWay && (!t || !this.cars.includes(t.car))) this.turn.set(st.key, { car, since: this.clock });
        }
        else target = Math.min(target, Math.sqrt(2 * DECEL * 0.8 * Math.max(0, dist)) + 0.05);
      } else if (st && car.ghost <= 0) {
        const stopAt = st.enter - HALF - 0.15;
        const dist = stopAt - car.s;
        if (car.s + HALF > st.enter + 0.3) { car.ai++; car.wait = 0; }   // already in the junction: clear it, never stop inside
        else if (dist <= 0.12) {
          car.wait += dt;
          const pause = st.kind === 'node' ? 0.45 : st.kind === 'yield' || st.kind === 'pass' ? 0 : 0.25;   // a real stop before going
          // if the next stop comes before I'd be clear of this one, I need both at once
          // (driveways I'm only driving past don't count: anyone may wait across one)
          const group = [st];
          while (stops[car.ai + group.length] && stops[car.ai + group.length].kind !== 'pass' && stops[car.ai + group.length].enter - HALF - 0.15 < group[group.length - 1].exit + HALF + 0.3) group.push(stops[car.ai + group.length]);
          // waited a while: it's my turn next at everything I need to get through
          if (car.wait > 2.5 && !(car.noTurnUntil > this.clock)) for (const g of group) if (!this.turn.has(g.key) || !this.cars.includes(this.turn.get(g.key).car)) this.turn.set(g.key, { car, since: this.clock });
          if (car.wait >= pause && group.every(g => this.#canEnter(car, g))) {
            for (const g of group) { this.#take(car, g); if (this.turn.get(g.key)?.car === car) this.turn.delete(g.key); }
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
          car.ai--; this.#release(car, stops[car.ai].key);
        }
        car.heldStuck = 0;
      }
      // waiting your turn at a line is fine; only a car stuck in the open counts as jammed
      if (car.v < 0.05 && !car.waiting && !car.queued) car.stuck += dt; else car.stuck = 0;
      if (car.stuck > 12) { car.ghost = 2.5; car.stuck = 0; this.onGhost?.(car, st, this.#ahead(car).who); }  // last-resort unjam, almost never needed
      car.stillT = car.v < 0.05 ? (car.stillT || 0) + dt : 0;
      // let go of each intersection once fully through it
      while (car.ri < car.ai && car.s - HALF > stops[car.ri].exit) {
        this.#release(car, stops[car.ri].key); car.ri++;
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
