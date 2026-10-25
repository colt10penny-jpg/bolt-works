// Little planets for the world map, the launch screen and the shop. Each is drawn as a
// lit globe: a base colour, its own land and features, a soft shadow on the night side,
// a thin glowing atmosphere (where there is one), a shine, and a tiny landmark of the
// town you built there. Plain SVG, so they stay sharp at any size.

const R = 26, C = 32;   // radius and centre in a 64 x 64 box
// a fine scatter of specks for surface texture (the same every time for a given seed)
function speckle(seed, color, n, op = 0.25) {
  let s = seed; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  let out = '';
  for (let i = 0; i < n; i++) out += `<circle cx="${(6 + r() * 52).toFixed(1)}" cy="${(6 + r() * 52).toFixed(1)}" r="${(0.4 + r() * 0.9).toFixed(2)}" fill="${color}" opacity="${(op * (0.5 + r())).toFixed(2)}"/>`;
  return out;
}

function planet(id, { base, rim, glow = null, body, landmark = '', ring = '' }) {
  const p = `wa-${id}`;
  return `<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true"><defs>
    <radialGradient id="${p}-base" cx=".38" cy=".34" r=".75"><stop offset="0" stop-color="${base[0]}"/><stop offset=".6" stop-color="${base[1]}"/><stop offset="1" stop-color="${base[2]}"/></radialGradient>
    <radialGradient id="${p}-night" cx=".3" cy=".28" r=".95"><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset=".8" stop-color="#05061a" stop-opacity=".35"/><stop offset="1" stop-color="#05061a" stop-opacity=".78"/></radialGradient>
    <radialGradient id="${p}-shine" cx=".32" cy=".26" r=".42"><stop offset="0" stop-color="#fff" stop-opacity=".4"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    ${glow ? `<radialGradient id="${p}-air" cx=".5" cy=".5" r=".5"><stop offset=".8" stop-color="${glow}" stop-opacity="0"/><stop offset=".9" stop-color="${glow}" stop-opacity=".55"/><stop offset="1" stop-color="${glow}" stop-opacity="0"/></radialGradient>` : ''}
    <clipPath id="${p}-clip"><circle cx="${C}" cy="${C}" r="${R}"/></clipPath>
  </defs>
  ${glow ? `<circle cx="${C}" cy="${C}" r="${R + 5}" fill="url(#${p}-air)"/>` : ''}
  ${ring}
  <g clip-path="url(#${p}-clip)">
    <circle cx="${C}" cy="${C}" r="${R}" fill="url(#${p}-base)"/>
    ${body}
    ${landmark}
    <circle cx="${C}" cy="${C}" r="${R}" fill="url(#${p}-night)"/>
    <circle cx="${C}" cy="${C}" r="${R}" fill="url(#${p}-shine)"/>
  </g>
  <circle cx="${C}" cy="${C}" r="${R - 0.5}" fill="none" stroke="${rim}" stroke-width="1.2" stroke-opacity=".7"/>
</svg>`;
}

export const WORLD_ART = {
  // Colorado: blue sea, green land with forests and snowy peaks, a lake, swirling clouds,
  // and a tiny factory with a smoking chimney
  colorado: planet('co', {
    base: ['#7cc8f2', '#3d8fd0', '#1f5f9e'], rim: '#bfe6ff', glow: '#9fdcff',
    body: `${speckle(3, '#1a4f8a', 30, 0.2)}
      <path d="M8 22 Q15 11 27 13 Q35 14 33 22 Q41 23 41 31 Q38 39 29 37 Q22 44 14 39 Q6 33 8 26 Z" fill="#6fbf4a"/>
      <path d="M12 30 Q16 26 22 28 Q26 32 22 36 Q16 38 12 34 Z" fill="#5aa83e"/>
      <path d="M43 40 Q50 37 55 42 Q53 51 45 50 Q40 46 43 40 Z" fill="#6fbf4a"/>
      <path d="M47 14 Q52 12 55 16 Q53 21 48 20 Z" fill="#8fcf5a"/>
      <path d="M15 24 L21 15 L27 24 Z" fill="#8a96a8"/><path d="M21 15 L18.6 18.6 L21 17.8 L23.4 18.6 Z" fill="#fff"/>
      <path d="M23 24 L28 17 L33 24 Z" fill="#7d8ea3"/><path d="M28 17 L26.3 19.5 L28 18.8 L29.7 19.5 Z" fill="#fff"/>
      <g fill="#2f6f3e"><path d="M13 33 l2 -5 l2 5 Z"/><path d="M17 35 l2 -5 l2 5 Z"/><path d="M21 33 l2 -5 l2 5 Z"/><path d="M35 30 l2 -5 l2 5 Z"/></g>
      <ellipse cx="30" cy="30" rx="3" ry="1.8" fill="#4aa3df"/>
      <path d="M4 44 Q14 41 22 44 Q30 47 38 44" stroke="#fff" stroke-opacity=".75" stroke-width="2.4" fill="none" stroke-linecap="round"/>
      <path d="M34 9 Q42 7 50 10" stroke="#fff" stroke-opacity=".7" stroke-width="2" fill="none" stroke-linecap="round"/>
      <path d="M42 28 Q48 26 56 29" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" fill="none" stroke-linecap="round"/>`,
    landmark: `<rect x="44" y="43" width="6" height="4" fill="#c75b3e"/><rect x="48" y="38.5" width="1.6" height="5" fill="#8a4a33"/><circle cx="49.5" cy="36.5" r="1.4" fill="#fff" opacity=".8"/>`,
  }),

  // the Wild West: golden prairie with rippled dunes, red flat-topped mesas casting
  // shadows, cacti, a railroad, and a little frontier town with a water tower
  desert: planet('de', {
    base: ['#ffe3a3', '#f2bc6a', '#c9853a'], rim: '#ffe7b8', glow: '#ffd39a',
    body: `${speckle(7, '#a8652a', 60, 0.3)}
      <path d="M0 26 Q12 20 24 25 T48 22 T64 24" stroke="#e5a75e" stroke-width="3" fill="none"/>
      <path d="M0 36 Q14 30 28 35 T56 33 T70 34" stroke="#d48c45" stroke-width="3" fill="none"/>
      <path d="M0 46 Q14 41 28 45 T58 44" stroke="#c97c3a" stroke-width="3" fill="none"/>
      <path d="M2 52 L62 40" stroke="#6e4a2c" stroke-width="1.6"/><path d="M2 52 L62 40" stroke="#c9b48a" stroke-width=".5" stroke-dasharray="1 1.4"/>
      <path d="M12 21 L14 15 L24 15 L26 21 Z" fill="#c0603a"/><rect x="14" y="14" width="10" height="1.8" fill="#e08a55"/>
      <path d="M26 21 L33 23 L24 22 Z" fill="#7a3a22" opacity=".45"/>
      <path d="M36 31 L37.5 26 L45 26 L46.5 31 Z" fill="#b5532a"/><rect x="37.5" y="25.2" width="7.5" height="1.5" fill="#d9794a"/>
      <g fill="#3f7a35"><path d="M20 33 v-5 a1.2 1.2 0 0 1 2.4 0 v5 Z"/><path d="M19 31 h-1.4 a.7.7 0 0 1 -.7 -.7 v-1.6 a.6.6 0 0 1 1.2 0 v1 h.9 Z"/>
        <path d="M51 38 v-4.4 a1.1 1.1 0 0 1 2.2 0 v4.4 Z"/><path d="M28 47 v-3.6 a1 1 0 0 1 2 0 v3.6 Z"/></g>`,
    landmark: `<rect x="27" y="37" width="6" height="5" fill="#9a6b42"/><rect x="26.5" y="35" width="7" height="2.4" fill="#9a6b42"/><rect x="27.5" y="35.6" width="5" height="1" fill="#f1e6c8"/><rect x="26" y="40" width="8" height=".7" fill="#5e4630"/>
      <rect x="34" y="38" width="5" height="4" fill="#a8322a"/><path d="M33.6 38 L36.5 35.8 L39.4 38 Z" fill="#6a6a68"/>
      <rect x="40.2" y="35.5" width=".5" height="6" fill="#5e4630"/><rect x="42.6" y="35.5" width=".5" height="6" fill="#5e4630"/><rect x="39.6" y="32.5" width="4" height="3.4" rx=".6" fill="#9a6b42"/><path d="M39.4 32.6 L41.6 31 L43.8 32.6 Z" fill="#5e4c3c"/>`,
  }),

  // the Moon: soft grey with dark seas, craters lit on one side and shadowed on the
  // other, bright rays from a young crater, and a flag beside a little white base
  moon: planet('mo', {
    base: ['#e6e6ec', '#b5b5bd', '#7d7d86'], rim: '#f2f2f8',
    body: `${speckle(11, '#6e6e78', 70, 0.3)}
      <path d="M14 18 Q22 12 30 17 Q34 24 27 28 Q19 30 14 25 Z" fill="#8f8f99" opacity=".7"/>
      <path d="M36 36 Q44 32 50 38 Q50 46 42 47 Q35 44 36 36 Z" fill="#8f8f99" opacity=".6"/>
      ${[[22, 40, 5], [44, 18, 4], [12, 32, 3], [33, 50, 2.6], [50, 28, 2.4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#9a9aa4"/><circle cx="${x + r * 0.18}" cy="${y + r * 0.18}" r="${r * 0.78}" fill="#c4c4cc"/><path d="M${x - r * 0.75} ${y - r * 0.2} a${r * 0.8} ${r * 0.8} 0 0 1 ${r * 1.2} -${r * 0.55}" stroke="#6e6e78" stroke-width="${r * 0.22}" fill="none"/>`).join('')}
      <g stroke="#f4f4f8" stroke-width=".5" opacity=".45" stroke-linecap="round"><path d="M44 18 L49 13"/><path d="M44 18 L50 19"/><path d="M44 18 L45.5 24"/><path d="M44 18 L39 14.5"/></g>`,
    landmark: `<path d="M27 31 a4 4 0 0 1 8 0 Z" fill="#f4f6fa"/><rect x="26" y="31" width="10" height="1" fill="#9aa0a8"/><rect x="37" y="25" width=".7" height="7" fill="#e8e8ee"/><path d="M37.7 25 h4 v2.6 h-4 Z" fill="#e85a3c"/>`,
  }),

  // Mars: rust and ochre with dark basalt plains, a great canyon scar, a frosty polar cap,
  // a towering volcano, a thin pink haze, and glowing green colony domes
  mars: planet('ma', {
    base: ['#f08a5a', '#c24e2c', '#7a2614'], rim: '#ffc8a8', glow: '#ffb08a',
    body: `${speckle(5, '#4e170c', 60, 0.3)}
      <path d="M2 10 Q32 0 62 10 V17 Q48 13 32 15 Q16 13 2 17 Z" fill="#f6ede6"/>
      <path d="M8 18 Q32 12 56 18" stroke="#e9d6cc" stroke-width="1.4" fill="none" opacity=".6"/>
      <path d="M10 32 Q18 26 28 29 Q32 36 24 40 Q15 41 10 36 Z" fill="#5a2216" opacity=".55"/>
      <path d="M4 30 Q16 26 28 32 T54 28" stroke="#5e1f12" stroke-width="3" fill="none" stroke-linecap="round"/>
      <path d="M4 30 Q16 26 28 32 T54 28" stroke="#9c3a20" stroke-width="1" fill="none" stroke-linecap="round" transform="translate(0 -1.2)"/>
      <circle cx="44" cy="44" r="7" fill="#a8402a"/><circle cx="44" cy="44" r="4" fill="#c4583a"/><circle cx="44" cy="44" r="1.5" fill="#5e1f12"/>
      <circle cx="18" cy="48" r="3" fill="#8f3520"/><circle cx="18.5" cy="48.5" r="2" fill="#b5492c"/>
      <circle cx="50" cy="22" r="2" fill="#8f3520"/>`,
    landmark: `<path d="M27 47 a4 4 0 0 1 8 0 Z" fill="#9cf08a" opacity=".95"/><path d="M33 47 a2.6 2.6 0 0 1 5.2 0 Z" fill="#7de06a"/><path d="M27 47 a4 4 0 0 1 8 0" stroke="#fff" stroke-width=".7" fill="none"/><rect x="26" y="47" width="13" height=".9" fill="#ddd6c8"/>`,
  }),
};
