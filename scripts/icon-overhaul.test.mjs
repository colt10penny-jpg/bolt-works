import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { DOCK_OFFSET, ROAD_W, blockSides, lotRoute, setNetwork, townSegments } from '../src/traffic.js';
import { BUILDERS } from '../src/models.js';
import '../src/buildings.js';

// The out-of-wall dock offset is an actual path endpoint, not a painted decoration.
test('each of the four lot entrances ends outside the building and short of the road', () => {
  assert.ok(DOCK_OFFSET > 5.0);
  assert.ok(DOCK_OFFSET + 0.9 <= 7, 'truck center should remain in its own block');
  assert.ok(DOCK_OFFSET - 1.2 > 3.4, 'truck nose should stay out of the factory facade');
  for (const side of blockSides(14, 14)) {
    assert.ok(Math.abs(Math.hypot(side.inLot.x - 14, side.inLot.z - 14) - DOCK_OFFSET) < 1e-7, side.side);
  }
});

test('delivery path starts and ends at exterior loading lanes', () => {
  const plots = [[14, 14], [0, 14], [-14, 14], [-14, 0], [0, 0], [14, 0]];
  const segments = townSegments(plots);
  setNetwork(plots, new Set(segments.keys()), []);
  for (const [i, j] of [[0, 1], [1, 4], [4, 3]]) {
    const route = lotRoute(plots[i], plots[j]);
    assert.ok(route && route.length >= 4);
    for (const [point, center] of [[route[0], plots[i]], [route.at(-1), plots[j]]]) {
      assert.ok(Math.abs(Math.hypot(point.x - center[0], point.z - center[1]) - DOCK_OFFSET) < 1e-7);
    }
  }
});

test('colorado industrial builder collection still produces self-contained models', () => {
  for (const name of ['mine', 'furnace', 'press', 'gear', 'engine', 'power', 'datacenter', 'turbine', 'rocket', 'hq']) {
    const maker = BUILDERS[name];
    assert.equal(typeof maker, 'function', name);
    const model = maker(0xffa83a);
    assert.ok(model.group?.isGroup, name);
    const box = new THREE.Box3().setFromObject(model.group);
    for (const v of [box.min.x, box.max.x, box.min.y, box.max.y, box.min.z, box.max.z]) {
      assert.ok(Number.isFinite(v), name + ' has non-finite geometry');
    }
    assert.ok(box.min.x > -7.1 && box.max.x < 7.1 && box.min.z > -7.1 && box.max.z < 7.1, name + ' overlaps adjacent road');
  }
});
