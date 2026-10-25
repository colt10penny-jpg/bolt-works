// Structural visual checks for delivery approach geometry and starter models.
// Run with: node --test scripts/visual-sanity.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DOCK_STOP_OFFSET, ROAD_W, blockSides, lotRoute, setNetwork, townSegments } from '../src/traffic.js';
import { BUILDERS } from '../src/models.js';
import '../src/buildings.js';

const truckHalfLength = 1.2;  // from src/models.js:truck() (2.4 units bumper to bumper)
const mainFacadeEnvelope = 4.0; // deliberately more conservative than most core buildings

test('all four loading approaches end in the outdoor forecourt', () => {
  assert.ok(DOCK_STOP_OFFSET - truckHalfLength >= mainFacadeEnvelope,
    'front bumper should not cross the model envelope');
  assert.ok(DOCK_STOP_OFFSET < 7 - ROAD_W / 4,
    'truck should still be inside the lot and able to join the roadway');
  for (const side of blockSides(14, 14)) {
    const p = side.inLot;
    const centerDistance = Math.hypot(p.x - 14, p.z - 14);
    assert.ok(Math.abs(centerDistance - DOCK_STOP_OFFSET) < 1e-7, side.side);
  }
});

test('delivery routes begin and end at outdoor loading points', () => {
  const lots = [[14, 14], [0, 14], [-14, 14], [-14, 0], [0, 0], [14, 0]];
  const roads = townSegments(lots);
  setNetwork(lots, new Set(roads.keys()), []);
  const routes = [
    [lots[0], lots[1]],
    [lots[1], lots[4]],
    [lots[4], lots[3]],
  ];
  for (const [from, to] of routes) {
    const way = lotRoute(from, to);
    assert.ok(way && way.length >= 4, 'there should be a connected delivery route');
    for (const [p, center] of [[way[0], from], [way.at(-1), to]]) {
      const d = Math.hypot(p.x - center[0], p.z - center[1]);
      assert.ok(Math.abs(d - DOCK_STOP_OFFSET) < 1e-7,
        'a delivery must park at the exterior dock, not drive through a building');
    }
  }
});

test('starter Ore Mine components have finite, on-plot geometry', () => {
  const mine = BUILDERS.mine(0x4d89c4);
  assert.ok(mine.group.isGroup);
  const bounds = new THREE.Box3().setFromObject(mine.group);
  for (const val of [bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z]) {
    assert.ok(Number.isFinite(val), 'no invalid geometry coordinates');
  }
  assert.ok(bounds.min.y > -0.25, 'starter mine should not have objects far below the yard');
  assert.ok(bounds.max.y > 5.5, 'mine must have a visibly tall supported headframe');
  assert.ok(bounds.min.x > -5 && bounds.max.x < 5 && bounds.min.z > -5 && bounds.max.z < 5,
    'mine should fit within its 14-unit plot, without loose misplaced parts');
  assert.equal(typeof mine.anim, 'function', 'existing machine animation should remain');
});
