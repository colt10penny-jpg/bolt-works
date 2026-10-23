// Night fog: a low mist that drifts through town after dark, lit warm wherever a lamp
// is near, and soft shafts of light falling from every streetlight and building lamp
// through it. Everything here fades in with the night (setNight) and is skipped on the
// Moon, which has no air for fog.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const NOISE = /* glsl */`
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
  }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int k = 0; k < 4; k++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
`;

// a cone of light from (top) down to the ground at (bottom), widening as it falls.
// aH is 1 at the lamp and 0 at the ground.
function shaft(top, bottom, r0, r1) {
  const h = top.y - bottom.y;
  const g = new THREE.CylinderGeometry(r0, r1, h, 18, 4, true);
  const p = g.attributes.position, aH = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;                  // 0 bottom .. 1 top
    aH[i] = t;
    p.setXYZ(i, p.getX(i) + (bottom.x - top.x) * (1 - t) + top.x, bottom.y + t * h, p.getZ(i) + (bottom.z - top.z) * (1 - t) + top.z);
  }
  g.setAttribute('aH', new THREE.BufferAttribute(aH, 1));
  g.computeVertexNormals();
  return g;
}

const shaftMat = color => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color(color) } },
  vertexShader: /* glsl */`
    attribute float aH; varying float vH; varying vec3 vW; varying float vFace;
    void main() {
      vH = aH;
      vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
      vec3 n = normalize(normalMatrix * normal);
      vFace = abs(n.z);                                  // facing the camera: the middle of the beam
      gl_Position = projectionMatrix * viewMatrix * w;
    }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uOpacity; uniform vec3 uColor; varying float vH; varying vec3 vW; varying float vFace;
    ${NOISE}
    void main() {
      float drift = fbm(vW.xz * 0.55 + vec2(vW.y * 0.6 - uTime * 0.25, uTime * 0.12));
      float body = smoothstep(0.05, 0.6, vFace);                           // soft but clear edges
      float a = uOpacity * (0.25 + 0.75 * pow(vH, 1.4)) * body * (0.6 + 0.6 * drift);
      gl_FragColor = vec4(uColor * a, a);
    }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
});

// a low sheet of mist; uLight is a map of where the lamps are, so the mist glows warm
// round them and stays a cool moonlit grey elsewhere
const mistMat = (cool, warm, light, bounds, seed) => new THREE.ShaderMaterial({
  uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uCool: { value: new THREE.Color(cool) }, uWarm: { value: new THREE.Color(warm) }, uLight: { value: light }, uB: { value: new THREE.Vector3(...bounds) }, uSeed: { value: seed } },
  vertexShader: /* glsl */`
    varying vec3 vW;
    void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
  fragmentShader: /* glsl */`
    uniform float uTime, uOpacity, uSeed; uniform vec3 uCool, uWarm, uB; uniform sampler2D uLight; varying vec3 vW;
    ${NOISE}
    void main() {
      vec2 p = vW.xz;
      float n = fbm(p * 0.045 + vec2(uTime * 0.018 + uSeed, uTime * 0.01));
      n = smoothstep(0.3, 0.85, n + 0.15 * fbm(p * 0.16 - uTime * 0.03));
      vec2 uv = (p - uB.xy) / uB.z;
      float lit = texture2D(uLight, uv).r;
      float edge = 1.0 - smoothstep(0.32, 0.5, length(uv - 0.5));          // thins out away from town
      vec3 col = mix(uCool, uWarm * 1.15, clamp(lit * 1.6, 0.0, 1.0));
      float a = uOpacity * edge * (n * 0.8 + lit * 0.9) * (0.6 + lit * 0.8);
      gl_FragColor = vec4(col, a);
    }`,
  transparent: true, depthWrite: false,
});

export class NightFog {
  constructor(scene) { this.scene = scene; this.group = null; this.mats = []; }
  dispose() {
    if (!this.group) return;
    this.scene.remove(this.group);
    this.group.traverse(o => { o.geometry?.dispose(); });
    for (const m of this.mats) m.dispose();
    this.lightTex?.dispose();
    this.group = null; this.mats = [];
  }
  // street: [{x,y,z}] streetlight heads; lamps: [{p: Vector3, out: {x,z}}] building lamps
  build(theme, street, lamps) {
    this.dispose();
    if (theme === 'moon') return;
    const mars = theme === 'mars';
    const group = new THREE.Group();
    // the shafts
    const geos = [];
    for (const p of street) if (p.y > 1.5) geos.push(shaft(new THREE.Vector3(p.x, p.y - 0.08, p.z), new THREE.Vector3(p.x, 0.17, p.z), 0.2, 1.7));
    for (const { p, out } of lamps) {
      const drop = Math.min(p.y - 0.17, 4.5), spread = 0.35 + drop * 0.22;
      geos.push(shaft(new THREE.Vector3(p.x + out.x * 0.08, p.y - 0.04, p.z + out.z * 0.08), new THREE.Vector3(p.x + out.x * spread, Math.max(0.17, p.y - drop), p.z + out.z * spread), 0.09, 0.35 + drop * 0.2));
    }
    if (geos.length) {
      const m = shaftMat(mars ? 0xffb67a : 0xffc678);
      this.mats.push(m);
      const mesh = new THREE.Mesh(mergeGeometries(geos), m); mesh.renderOrder = 5; mesh.frustumCulled = false;
      group.add(mesh);
      geos.forEach(g => g.dispose());
    }
    // a map of where the light is, over the town and a margin round it
    const B = [-80, -80, 175], N = 256;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, N, N);
    ctx.globalCompositeOperation = 'lighter';
    const dot = (x, z, r, a) => {
      const u = (x - B[0]) / B[2] * N, v = (z - B[1]) / B[2] * N, rr = r / B[2] * N;
      const gr = ctx.createRadialGradient(u, v, 0, u, v, rr);
      gr.addColorStop(0, `rgba(255,255,255,${a})`); gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr; ctx.fillRect(u - rr, v - rr, rr * 2, rr * 2);
    };
    for (const p of street) dot(p.x, p.z, 5.5, 0.6);
    for (const { p, out } of lamps) dot(p.x + out.x * 1.2, p.z + out.z * 1.2, 3.5, 0.5);
    const tex = new THREE.CanvasTexture(c);
    tex.flipY = false;   // canvas row v is world z
    this.lightTex = tex;
    // two thin layers of mist hugging the ground
    for (const [y, seed] of [[0.55, 0], [1.35, 7.3]]) {
      const m = mistMat(mars ? 0x8a5a58 : 0x9aa6c4, mars ? 0xffb488 : 0xffd9a8, tex, B, seed);
      this.mats.push(m);
      const g = new THREE.PlaneGeometry(B[2], B[2]); g.rotateX(-Math.PI / 2); g.translate(B[0] + B[2] / 2, y, B[1] + B[2] / 2);
      const mesh = new THREE.Mesh(g, m); mesh.renderOrder = 4; mesh.frustumCulled = false;
      mesh.userData.mist = true;
      group.add(mesh);
    }
    this.mars = mars;
    this.group = group;
    this.scene.add(group);
  }
  // n: how much night it is (0 day .. 1 night)
  update(t, n) {
    if (!this.group) return;
    this.group.visible = n > 0.02;
    for (const o of this.group.children) {
      const u = o.material.uniforms;
      u.uTime.value = t;
      u.uOpacity.value = o.userData.mist ? n * (this.mars ? 0.2 : 0.3) : n * (this.mars ? 0.45 : 0.65);
    }
  }
}
