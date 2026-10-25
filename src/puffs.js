// Smoke, dust and exhaust puffs, drawn in one go.
//
// Each puff used to be its own sprite with its own material, so a busy town with a
// hundred or more puffs in the air cost a hundred or more separate draws every frame.
// Now every puff is a light stand-in object (with the same position, scale, opacity,
// rotation and colour a sprite has), and all of them are drawn together as one
// instanced mesh per blend mode, with the same shading a sprite gets: the soft puff
// texture tinted by the puff's colour, fog, tone mapping, and sorted back to front.
import * as THREE from 'three';

const VERT = `
attribute vec3 iPos;
attribute vec4 iData;      // size, rotation, opacity
attribute vec3 iColor;
varying vec2 vUv;
varying vec4 vCol;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vCol = vec4(iColor, iData.z);
  vec4 mvPosition = modelViewMatrix * vec4(iPos, 1.0);
  vec2 p = position.xy * iData.x;
  float s = sin(iData.y), c = cos(iData.y);
  mvPosition.xy += vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
uniform sampler2D map;
varying vec2 vUv;
varying vec4 vCol;
#include <fog_pars_fragment>
void main() {
  vec4 diffuseColor = vCol * texture2D(map, vUv);
  gl_FragColor = diffuseColor;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`;

// a puff: positioned and scaled like any object, with a sprite-like `material`
export class Puff extends THREE.Object3D {
  constructor(layer, color, hot, size) {
    super();
    this.layer = layer; this.hot = hot;
    this.scale.setScalar(size); this.userData.size = size;
    const self = this;
    this.material = {
      color: new THREE.Color(color), opacity: 0.9, rotation: Math.random() * 6.28,
      blending: hot ? THREE.AdditiveBlending : THREE.NormalBlending,
      dispose() { layer.list.delete(self); },
    };
    this.addEventListener('added', () => layer.list.add(this));
    this.addEventListener('removed', () => layer.list.delete(this));
  }
}

export class PuffLayer {
  constructor(scene, texture) {
    this.list = new Set();
    this.meshes = [false, true].map(hot => {
      const mat = new THREE.ShaderMaterial({
        uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null } }]),
        vertexShader: VERT, fragmentShader: FRAG,
        transparent: true, depthWrite: false, fog: true,
        blending: hot ? THREE.AdditiveBlending : THREE.NormalBlending,
      });
      mat.uniforms.map.value = texture;
      const m = this.#mesh(mat, 128);
      scene.add(m);
      return m;
    });
    this.scene = scene;
  }
  #mesh(mat, cap) {
    const g = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    g.index = base.index; g.setAttribute('position', base.attributes.position); g.setAttribute('uv', base.attributes.uv);
    g.setAttribute('iPos', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iData', new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('iColor', new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.instanceCount = 0;
    const m = new THREE.Mesh(g, mat);
    m.frustumCulled = false;
    m.renderOrder = 5;      // after the ground glows and decals, like the sprites were
    m.userData.cap = cap;
    return m;
  }
  // fill the instance data from the live puffs (call once a frame, before drawing)
  update(camera) {
    const view = camera.matrixWorldInverse, all = [[], []];
    for (const p of this.list) {
      if (!p.visible || !p.parent) continue;
      p.updateMatrixWorld();
      const e = p.matrixWorld.elements, x = e[12], y = e[13], z = e[14];
      const d = view.elements[2] * x + view.elements[6] * y + view.elements[10] * z;   // depth in view space
      all[p.hot ? 1 : 0].push({ p, d, x, y, z });
    }
    all.forEach((items, k) => {
      let m = this.meshes[k];
      if (items.length > m.userData.cap) {
        // more puffs than room: a bigger buffer
        const n = this.#mesh(m.material, Math.max(items.length, m.userData.cap * 2));
        this.scene.remove(m); m.geometry.dispose(); this.scene.add(n); this.meshes[k] = m = n;
      }
      items.sort((a, b) => a.d - b.d);   // furthest first, as transparent things are drawn
      const g = m.geometry, P = g.attributes.iPos.array, D = g.attributes.iData.array, C = g.attributes.iColor.array;
      items.forEach(({ p, x, y, z }, i) => {
        P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
        D[i * 4] = p.scale.x; D[i * 4 + 1] = p.material.rotation; D[i * 4 + 2] = p.material.opacity;
        const c = p.material.color; C[i * 3] = c.r; C[i * 3 + 1] = c.g; C[i * 3 + 2] = c.b;
      });
      g.instanceCount = items.length;
      m.visible = items.length > 0;
      for (const a of ['iPos', 'iData', 'iColor']) { g.attributes[a].needsUpdate = true; g.attributes[a].clearUpdateRanges?.(); g.attributes[a].addUpdateRange?.(0, items.length * g.attributes[a].itemSize); }
    });
  }
}
