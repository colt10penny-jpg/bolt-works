// How the world is drawn: filmic colour, soft shadows, reflections, glow (bloom),
// a light colour grade, gentle haze in the distance, and the day/night cycle.
// "high" quality uses the full effects; "low" draws directly for older phones.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLOW } from './models.js';

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, vignette: { value: 0.32 }, sat: { value: 1.08 }, tint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float vignette; uniform float sat; uniform vec3 tint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
      c.rgb = mix(vec3(l), c.rgb, sat) * tint;
      vec2 d = vUv - 0.5; d.x *= 0.8;
      c.rgb *= 1.0 - vignette * smoothstep(0.25, 0.85, length(d) * 1.35);
      gl_FragColor = c;
    }`,
};

// key moments of the day: [time, sun colour, sun strength, sky light, ground light, sky strength, window glow, haze colour]
const DAY = {
  earth: [
    [0.00, 0x9fb4ff, 1.55, 0x93a8e6, 0x7a6e66, 1.5, 1.0, 0x4a5c88],   // night: moonlit blue, but everything still easy to see
    [0.06, 0xffa86b, 1.7, 0xffd2b0, 0x7a6a5a, 1.25, 0.55, 0xf2b98f],    // sunrise
    [0.14, 0xfff1dc, 2.6, 0xfff6e5, 0x5d7a46, 1.25, 0.0, 0xcfe3f0],    // morning
    [0.55, 0xffffff, 2.8, 0xfff6e5, 0x5d7a46, 1.3, 0.0, 0xd6e7f2],     // afternoon
    [0.66, 0xffb46b, 1.8, 0xffd9b8, 0x6b5a4a, 1.05, 0.25, 0xf3c08e],   // golden hour
    [0.72, 0xff8f6a, 1.6, 0xc9a6c0, 0x6a5a60, 1.3, 0.8, 0xc78a92],     // sunset
    [0.80, 0x9fb4ff, 1.55, 0x93a8e6, 0x7a6e66, 1.5, 1.0, 0x4a5c88],   // night: moonlit blue, but everything still easy to see
    [1.00, 0x9fb4ff, 1.55, 0x93a8e6, 0x7a6e66, 1.5, 1.0, 0x4a5c88],   // night: moonlit blue, but everything still easy to see
  ],
  // the Moon has no air: always hard white sunlight, and "night" is earthlight
  moon: [
    [0.00, 0xc4d0ff, 1.8, 0x9aa8d8, 0x4a4d5a, 1.3, 1.0, 0x1b2030],
    [0.08, 0xffffff, 3.0, 0xdfe6ff, 0x3a3d48, 0.9, 0.0, 0x2a2f40],
    [0.70, 0xffffff, 3.0, 0xdfe6ff, 0x3a3d48, 0.9, 0.0, 0x2a2f40],
    [0.80, 0xc4d0ff, 1.8, 0x9aa8d8, 0x4a4d5a, 1.3, 1.0, 0x1b2030],
    [1.00, 0xc4d0ff, 1.8, 0x9aa8d8, 0x4a4d5a, 1.3, 1.0, 0x1b2030],
  ],
};
const ca = new THREE.Color(), cb = new THREE.Color();
const lerpHex = (a, b, t, out) => out.copy(ca.setHex(a)).lerp(cb.setHex(b), t);

export class Look {
  constructor(renderer, scene, camera) {
    this.r = renderer; this.scene = scene; this.camera = camera;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.45;
    pm.dispose();
    this.quality = 'high';
    this.cycle = true;
    this.time = 0.2;          // 0..1 through the day
    this.dayLength = 480;     // seconds for a full day
    this.kind = 'earth';
    this.haze = new THREE.Color(0xd6e7f2);
    scene.fog = new THREE.Fog(0xd6e7f2, 165, 430);
    this.sunScale = 0.85; this.skyScale = 0.5; this.envScale = 0.5;
    this.tmp = { sun: new THREE.Color(), sky: new THREE.Color(), gnd: new THREE.Color(), haze: new THREE.Color() };
  }

  setLights(sun, hemi, ground) { this.sun = sun; this.hemi = hemi; this.groundBase = ground; }
  setWorld(name) { this.kind = name === 'moon' ? 'moon' : 'earth'; this.worldName = name; this.update(0); }

  setQuality(q) {
    this.quality = q;
    const hi = q === 'high';
    this.r.setPixelRatio(Math.min(hi ? 2 : 1.5, window.devicePixelRatio || 1));
    this.r.shadowMap.type = hi ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    if (this.sun) { this.sun.shadow.mapSize.set(hi ? 2048 : 1024, hi ? 2048 : 1024); this.sun.shadow.map?.dispose(); this.sun.shadow.map = null; }
    this.r.shadowMap.needsUpdate = true;
    if (hi && !this.composer) this.#buildComposer();
    this.resize();
  }

  #buildComposer() {
    const size = this.r.getDrawingBufferSize(new THREE.Vector2());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    const c = new EffectComposer(this.r, rt);
    c.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 2, size.y / 2), 0.32, 0.55, 0.92);
    c.addPass(this.bloom);
    c.addPass(new OutputPass());
    this.grade = new ShaderPass(GradeShader);
    c.addPass(this.grade);
    this.composer = c;
  }

  resize() {
    const w = this.r.domElement.clientWidth, h = this.r.domElement.clientHeight;
    if (!w || !h) return;
    this.r.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.r.getPixelRatio());
      this.composer.setSize(w, h);
      this.bloom.resolution.set(w * this.r.getPixelRatio() / 2, h * this.r.getPixelRatio() / 2);
    }
  }

  // night amount 0..1, for windows and streetlights
  get night() { return this._night || 0; }

  update(dt) {
    if (this.cycle) this.time = (this.time + dt / this.dayLength) % 1;
    const t = this.cycle ? this.time : 0.4;
    const keys = DAY[this.kind];
    let i = 0; while (i < keys.length - 2 && keys[i + 1][0] <= t) i++;
    const A = keys[i], B = keys[i + 1];
    const u = THREE.MathUtils.smoothstep(t, A[0], B[0]);
    const T = this.tmp;
    lerpHex(A[1], B[1], u, T.sun); lerpHex(A[3], B[3], u, T.sky); lerpHex(A[4], B[4], u, T.gnd); lerpHex(A[7], B[7], u, T.haze);
    const sunI = A[2] + (B[2] - A[2]) * u, skyI = A[5] + (B[5] - A[5]) * u;
    this._night = A[6] + (B[6] - A[6]) * u;
    if (this.sun) {
      this.sun.color.copy(T.sun); this.sun.intensity = sunI * this.sunScale;
      // the sun swings across the sky through the day, so shadows move
      const a = (t - 0.4) * Math.PI * 1.1;
      this.sunDir = new THREE.Vector3(-18 + Math.sin(a) * 26, 40 - Math.abs(Math.sin(a)) * 14, 22 - Math.sin(a) * 10);
    }
    if (this.hemi) { this.hemi.color.copy(T.sky); this.hemi.groundColor.copy(T.gnd); this.hemi.intensity = skyI * this.skyScale; }
    // haze matches the ground colour by day, and the sky by night
    if (this.groundBase) this.scene.fog.color.copy(this.groundBase).lerp(T.haze, 0.45 + this._night * 0.4);
    this.scene.background = this.scene.fog.color;
    this.scene.environmentIntensity = (0.4 + 0.1 * (1 - this._night)) * this.envScale;
    const n = this._night;
    for (const m of GLOW.glass) m.emissiveIntensity = n * m.userData.glow;
    for (const m of GLOW.lit) m.emissiveIntensity = (m.userData.baseGlow ?? 1) * (1 + n * 1.2);
    if (this.bloom) { this.bloom.strength = 0.25 + n * 0.5; this.bloom.threshold = 1.15 - n * 0.35; }
    if (this.grade) {
      this.grade.uniforms.vignette.value = 0.28;
      // night: a cool moonlit cast and a little less colour, without making anything darker
      this.grade.uniforms.tint.value.setRGB(1 + (1 - n) * 0.02 - n * 0.17, 1 - n * 0.07, 1 + n * 0.12);
      this.grade.uniforms.sat.value = 1.08 - n * 0.2;
    }
  }

  render() {
    if (this.quality === 'high' && this.composer) this.composer.render();
    else this.r.render(this.scene, this.camera);
  }
}
