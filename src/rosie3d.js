// Rosie, the old foreman, built in 3D in the same soft low-poly style as the town and
// rendered once into a few still frames (wave up/down, mouth shut/open) that the
// tutorial flips between. Rendering happens on a small off-screen canvas so it doesn't
// touch the game's own renderer.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0, ...o });
const SKIN = 0xf2c3a0, SHIRT = 0x2f6fb0, VEST = 0xff8a2a, JEANS = 0x3b5a8c, HAT = 0xffc23d, GLOVE = 0xf2c94c, HAIR = 0xd8d8de, BOOT = 0x5a3b24;

function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
const capsule = (r, len, mat) => new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 14), mat);
// a limb from point a to point b
function limb(r, a, b, mat) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A);
  const m = capsule(r, Math.max(0.01, d.length()), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

function build({ wave = 0, talk = false }) {
  const g = new THREE.Group();
  const skin = M(SKIN, { roughness: 0.55 }), shirt = M(SHIRT), vest = M(VEST, { roughness: 0.5 }), jeans = M(JEANS, { roughness: 0.8 });
  const hat = M(HAT, { roughness: 0.35 }), glove = M(GLOVE, { roughness: 0.7 }), hair = M(HAIR, { roughness: 0.9 }), dark = M(0x2a2a2e, { roughness: 0.4 });
  const white = M(0xf4f4f2, { roughness: 0.3, emissive: 0x333333 });
  // boots and legs
  for (const s of [-1, 1]) {
    g.add(mesh(new RoundedBoxGeometry(0.2, 0.13, 0.32, 3, 0.05), M(BOOT, { roughness: 0.6 }), s * 0.12, 0.065, 0.04));
    g.add(limb(0.1, [s * 0.12, 0.19, 0], [s * 0.115, 0.58, 0], jeans));
  }
  // everything from the hips up sits a little lower, for chunkier, friendlier proportions
  const u = new THREE.Group(); u.position.y = -0.1; g.add(u);
  u.add(mesh(new RoundedBoxGeometry(0.44, 0.2, 0.28, 3, 0.08), jeans, 0, 0.72, 0));
  u.add(mesh(new RoundedBoxGeometry(0.46, 0.05, 0.3, 2, 0.02), M(0x5b3a22), 0, 0.81, 0));           // belt
  u.add(mesh(new RoundedBoxGeometry(0.08, 0.06, 0.02, 2, 0.01), M(0xc9a24a, { metalness: 0.6, roughness: 0.3 }), 0, 0.81, 0.152));
  // body: shirt, and the vest over it with reflective stripes
  const torso = capsule(0.245, 0.34, shirt); torso.position.y = 1.07; torso.scale.set(1, 1, 0.78); u.add(torso);
  const vestM = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.255, 0.5, 24, 1, true), vest);
  vestM.material.side = THREE.DoubleSide; vestM.position.y = 1.03; vestM.scale.set(1, 1, 0.8); u.add(vestM);
  for (const y of [0.93, 1.09]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.265, 0.262, 0.045, 24, 1, true), white); st.position.y = y; st.scale.set(1, 1, 0.8); u.add(st); }
  u.add(mesh(new RoundedBoxGeometry(0.09, 0.07, 0.02, 2, 0.01), M(0xffc23d, { roughness: 0.3 }), -0.11, 1.18, 0.205));   // name badge
  // collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 20), shirt); collar.rotation.x = Math.PI / 2; collar.position.y = 1.33; u.add(collar);
  // arms: the left one down by her side, the right one up and waving
  u.add(limb(0.075, [-0.29, 1.27, 0], [-0.34, 0.98, 0.02], shirt));
  u.add(limb(0.068, [-0.34, 0.98, 0.02], [-0.33, 0.76, 0.06], skin));
  u.add(mesh(new THREE.SphereGeometry(0.075, 14, 10), glove, -0.33, 0.72, 0.07));
  const sh = [0.29, 1.27, 0], el = [0.46, 1.42 + wave * 0.04, 0.05], hand = [0.47 + wave * 0.12, 1.74, 0.08 - wave * 0.02];
  u.add(limb(0.075, sh, el, shirt));
  u.add(limb(0.068, el, hand, skin));
  const gl = new THREE.Group(); gl.position.set(...hand);
  gl.add(mesh(new THREE.SphereGeometry(0.085, 14, 10), glove));
  for (let k = 0; k < 4; k++) { const f = capsule(0.022, 0.07, glove); f.position.set(-0.05 + k * 0.033, 0.09, 0); f.rotation.z = (k - 1.5) * 0.12; gl.add(f); }
  const th = capsule(0.024, 0.05, glove); th.position.set(-0.08, 0.02, 0.02); th.rotation.z = 0.9; gl.add(th);
  gl.rotation.z = -0.25 - wave * 0.35; u.add(gl);
  // neck and head
  u.add(mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.12, 14), skin, 0, 1.39, 0));
  const head = new THREE.Group(); head.position.y = 1.64; head.scale.setScalar(1.2); u.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.255, 28, 20), skin); skull.scale.set(1, 1.04, 0.95); head.add(skull);
  for (const s of [-1, 1]) {
    head.add(mesh(new THREE.SphereGeometry(0.055, 12, 10), skin, s * 0.25, -0.01, 0));
    // gray curls showing under the hat
    for (const [dy, dz] of [[0.04, -0.05], [-0.04, -0.1], [0.06, 0.06]]) head.add(mesh(new THREE.SphereGeometry(0.07, 12, 10), hair, s * 0.215, dy, dz));
    // eyes: dark, glossy, with a catch-light, and a soft brow
    head.add(mesh(new THREE.SphereGeometry(0.036, 14, 12), dark, s * 0.09, 0.03, 0.225));
    head.add(mesh(new THREE.SphereGeometry(0.012, 8, 6), white, s * 0.09 + 0.012, 0.045, 0.255));
    const brow = capsule(0.012, 0.06, hair); brow.rotation.z = Math.PI / 2 + s * 0.15; brow.position.set(s * 0.09, 0.1, 0.225); head.add(brow);
    const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), M(0xf29a86, { roughness: 0.7, transparent: true, opacity: 0.55 })); cheek.scale.set(1, 0.6, 0.4); cheek.position.set(s * 0.14, -0.05, 0.205); head.add(cheek);
  }
  head.add(mesh(new THREE.SphereGeometry(0.035, 12, 10), M(0xe8a888, { roughness: 0.6 }), 0, -0.02, 0.255));   // nose
  for (const [dy, dz] of [[-0.02, -0.2], [0.08, -0.17]]) head.add(mesh(new THREE.SphereGeometry(0.11, 12, 10), hair, 0, dy, dz));   // hair at the back
  if (talk) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), M(0x7a3a2e, { roughness: 0.5 })); m.scale.set(1.1, 0.75, 0.4); m.position.set(0, -0.1, 0.225); head.add(m);
    const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), M(0xe07a7a)); tongue.scale.set(1.2, 0.5, 0.4); tongue.position.set(0, -0.12, 0.24); head.add(tongue);
  } else {
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 8, 16, Math.PI), M(0x8a4b3a, { roughness: 0.5 }));
    smile.rotation.z = Math.PI; smile.position.set(0, -0.06, 0.235); head.add(smile);
  }
  // the hard hat: a dome with a ridge, a brim, and a little badge
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.29, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), hat); dome.scale.set(1, 0.78, 1.04); dome.position.y = 0.09; head.add(dome);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.34, 0.035, 32), hat); brim.position.set(0, 0.095, 0.03); brim.rotation.x = 0.06; head.add(brim);
  const ridge = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 8, 20, Math.PI), hat); ridge.rotation.y = Math.PI / 2; ridge.scale.set(1, 0.95, 1); ridge.position.y = 0.1; head.add(ridge);
  head.add(mesh(new RoundedBoxGeometry(0.1, 0.07, 0.02, 2, 0.01), M(0x2f6fb0, { roughness: 0.4 }), 0, 0.2, 0.262));
  head.rotation.set(0.04, -0.12, 0.05);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// render the frames; returns { wave: [smile, smileHigh], talk: [talk, talkHigh] } as image URLs
export function renderRosie(width = 300, height = 420) {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(width, height, false);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x6a7a5a, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(1.5, 3, 2.5); key.castShadow = true; key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -1.5; key.shadow.camera.right = 1.5; key.shadow.camera.top = 2.5; key.shadow.camera.bottom = -0.5; key.shadow.bias = -0.0005;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe0ff, 1.4); rim.position.set(-2, 2, -2); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe2c4, 0.5); fill.position.set(-2, 1, 2); scene.add(fill);
  // a soft round shadow on the ground under her feet
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.ShadowMaterial({ opacity: 0.28 }));
  sh.rotation.x = -Math.PI / 2; sh.receiveShadow = true; scene.add(sh);
  const cam = new THREE.PerspectiveCamera(24, width / height, 0.1, 20);
  cam.position.set(1.3, 1.3, 5.3); cam.lookAt(0.05, 0.93, 0);
  const out = {};
  for (const [name, opts] of [['idle0', { wave: 0 }], ['idle1', { wave: 1 }], ['talk0', { wave: 0, talk: true }], ['talk1', { wave: 1, talk: true }]]) {
    const ch = build(opts); ch.rotation.y = 0.32; scene.add(ch);
    r.render(scene, cam);
    out[name] = canvas.toDataURL('image/png');
    scene.remove(ch);
    ch.traverse(o => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  }
  r.dispose(); r.forceContextLoss?.();
  return out;
}
