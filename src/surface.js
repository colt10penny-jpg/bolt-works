// Surface detail painted onto every building material by the shader, so plain colours
// read as real materials: fine colour variation, cladding seams on walls, grime and
// rain streaks near the ground, and gravel speckle on flat roofs. It works in world
// space, so it needs no textures or UVs and stays the same size on every building.
import * as THREE from 'three';

export const DETAIL = { value: 1 };   // 0 turns it off everywhere

const NOISE = `
float sdHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float sdNoise(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(sdHash(i), sdHash(i + vec3(1,0,0)), f.x), mix(sdHash(i + vec3(0,1,0)), sdHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(sdHash(i + vec3(0,0,1)), sdHash(i + vec3(1,0,1)), f.x), mix(sdHash(i + vec3(0,1,1)), sdHash(i + vec3(1,1,1)), f.x), f.y), f.z); }
float sdLine(float v, float w){ float f = fract(v); return 1.0 - smoothstep(0.0, w, min(f, 1.0 - f)); }`;

export function withDetail(m, strength = 1) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    prev?.(sh, r);
    sh.uniforms.uDetail = DETAIL;
    sh.uniforms.uDetailK = { value: strength };
    sh.vertexShader = 'varying vec3 vDW; varying vec3 vDN;\n' + sh.vertexShader
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vDW = (modelMatrix * vec4(transformed, 1.0)).xyz;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vDN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = 'varying vec3 vDW; varying vec3 vDN; uniform float uDetail; uniform float uDetailK;\n' + NOISE + '\n' + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    float amt = uDetail * uDetailK;
    vec3 n = normalize(vDN);
    float wall = 1.0 - smoothstep(0.35, 0.7, abs(n.y));
    float roof = smoothstep(0.75, 0.95, n.y);
    float along = abs(n.x) > abs(n.z) ? vDW.z : vDW.x;
    // fine, blotchy variation so no surface is a flat fill
    float fine = sdNoise(vDW * 6.5) * 0.55 + sdNoise(vDW * 1.7) * 0.45;
    float k = 1.0 + (fine - 0.5) * 0.3 * amt;
    // cladding: panel seams across the walls, and every so often down them
    k *= 1.0 - wall * (sdLine(vDW.y * 2.0, 0.04) * 0.15 + sdLine(along / 1.15, 0.028) * 0.11) * amt;
    // dirt near the ground, and rain streaks running down the walls
    float base = 1.0 - smoothstep(0.15, 1.4, vDW.y);
    float streak = sdNoise(vec3(along * 3.2, vDW.y * 0.22, 0.5));
    k *= 1.0 - wall * (base * 0.34 + smoothstep(0.55, 0.9, streak) * 0.16) * amt;
    // flat roofs: gravel speckle
    k *= 1.0 + roof * (sdNoise(vDW * 17.0) - 0.5) * 0.32 * amt;
    diffuseColor.rgb *= k;
  }`);
  };
  return m;
}
