// Splitting big merged meshes into map tiles, purely for speed.
//
// The land, the scenery (thousands of trees, rocks and cacti) and the roads are merged
// into a few huge meshes that each stretch across the whole map. The camera only ever
// sees a small part of the map, but a mesh is drawn whole if any of it is on screen, so
// the phone was pushing every tree on the map through the GPU every frame (twice, with
// the shadow pass). Here each big mesh is cut into tiles: exactly the same triangles,
// the same material and the same vertex data (shared, not copied), just drawn tile by
// tile so the tiles off screen are skipped. Nothing looks any different.
import * as THREE from 'three';

const _v = new THREE.Vector3(), _c = new THREE.Vector3();

// Replace `mesh` (in its parent) with one mesh per tile of `cell` world units. Meshes
// smaller than a tile, or of a kind this doesn't handle, are left as they are.
export function splitMesh(mesh, cell = 40) {
  const geo = mesh.geometry, pos = geo?.attributes?.position;
  if (!mesh.isMesh || mesh.isInstancedMesh || mesh.isSkinnedMesh || !pos || !mesh.parent || !mesh.frustumCulled) return false;
  if (geo.groups.length || Object.keys(geo.morphAttributes).length || Array.isArray(mesh.material)) return false;
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  if (geo.boundingSphere.radius * Math.max(mesh.scale.x, mesh.scale.z) < cell * 0.9) return false;
  mesh.updateMatrixWorld(true);
  const index = geo.index ? geo.index.array : null;
  const tris = index ? index.length / 3 : pos.count / 3;
  const vert = (t, k) => index ? index[t * 3 + k] : t * 3 + k;
  // which tile each triangle's centre falls in (in world space)
  const tiles = new Map();
  for (let t = 0; t < tris; t++) {
    _c.set(0, 0, 0);
    for (let k = 0; k < 3; k++) _c.add(_v.fromBufferAttribute(pos, vert(t, k)));
    _c.multiplyScalar(1 / 3).applyMatrix4(mesh.matrixWorld);
    const key = Math.floor(_c.x / cell) + ',' + Math.floor(_c.z / cell);
    let list = tiles.get(key);
    if (!list) tiles.set(key, list = []);
    list.push(t);
  }
  if (tiles.size < 2) return false;
  const big = pos.count > 65535;
  const parent = mesh.parent;
  for (const list of tiles.values()) {
    const idx = big ? new Uint32Array(list.length * 3) : new Uint16Array(list.length * 3);
    const box = new THREE.Box3();
    let n = 0;
    for (const t of list) for (let k = 0; k < 3; k++) { const v = vert(t, k); idx[n++] = v; box.expandByPoint(_v.fromBufferAttribute(pos, v)); }
    const g = new THREE.BufferGeometry();
    for (const name of Object.keys(geo.attributes)) g.setAttribute(name, geo.attributes[name]);   // shared, not copied
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.boundingBox = box;
    g.boundingSphere = box.getBoundingSphere(new THREE.Sphere());
    g.boundingSphere.radius += 1;   // room for leaves swaying in the wind
    g.userData = { ...geo.userData, tileOf: geo };
    const m = new THREE.Mesh(g, mesh.material);
    m.position.copy(mesh.position); m.quaternion.copy(mesh.quaternion); m.scale.copy(mesh.scale);
    m.castShadow = mesh.castShadow; m.receiveShadow = mesh.receiveShadow;
    m.renderOrder = mesh.renderOrder; m.frustumCulled = mesh.frustumCulled; m.visible = mesh.visible;
    m.name = mesh.name; m.userData = mesh.userData; m.layers.mask = mesh.layers.mask;
    m.onBeforeRender = mesh.onBeforeRender; m.onAfterRender = mesh.onAfterRender;
    if (mesh.customDepthMaterial) m.customDepthMaterial = mesh.customDepthMaterial;
    if (mesh.customDistanceMaterial) m.customDistanceMaterial = mesh.customDistanceMaterial;
    parent.add(m);
  }
  parent.remove(mesh);
  return true;
}

// split every big mesh under `root`
export function splitBig(root, cell = 40) {
  const list = [];
  root.traverse(o => { if (o.isMesh) list.push(o); });
  for (const m of list) splitMesh(m, cell);
}
