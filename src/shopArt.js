// Pictures for the cash packs in the shop. Each one sits on its own glowing tile, and
// they get richer up the tiers: a stack of coins, a stuffed money bag, an open vault
// full of gold, and a golden bank. Plain SVG, so they stay sharp on any phone.

// shared gradients (ids are prefixed per picture, so several can sit on one page)
const defs = p => `
  <linearGradient id="${p}-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff1a8"/><stop offset=".45" stop-color="#ffc93c"/><stop offset="1" stop-color="#d98b10"/></linearGradient>
  <linearGradient id="${p}-goldSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8700c"/><stop offset=".5" stop-color="#e9a41f"/><stop offset="1" stop-color="#a8620a"/></linearGradient>
  <linearGradient id="${p}-bill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8fe0a0"/><stop offset="1" stop-color="#3fae62"/></linearGradient>
  <radialGradient id="${p}-glow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff7c2" stop-opacity=".95"/><stop offset=".6" stop-color="#ffe066" stop-opacity=".35"/><stop offset="1" stop-color="#ffe066" stop-opacity="0"/></radialGradient>`;

// a gold coin lying flat (seen from the game's angle): rim, face, a $ and a glint
const coin = (p, x, y, r = 7) => `<g>
  <ellipse cx="${x}" cy="${y + r * 0.32}" rx="${r}" ry="${r * 0.55}" fill="#a8620a"/>
  <rect x="${x - r}" y="${y}" width="${r * 2}" height="${r * 0.32}" fill="url(#${p}-goldSide)"/>
  <ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.55}" fill="url(#${p}-gold)" stroke="#c07a0e" stroke-width=".8"/>
  <ellipse cx="${x}" cy="${y}" rx="${r * 0.68}" ry="${r * 0.36}" fill="none" stroke="#e39a17" stroke-width=".9"/>
  <path d="M${x - r * 0.5} ${y - r * 0.18} q${r * 0.5} -${r * 0.3} ${r} 0" stroke="#fffbe0" stroke-width="${r * 0.12}" fill="none" stroke-linecap="round" opacity=".85"/>
</g>`;
// a gold coin standing up, facing you
const coinUp = (p, x, y, r = 7, tilt = 0) => `<g transform="rotate(${tilt} ${x} ${y})">
  <circle cx="${x + r * 0.16}" cy="${y + r * 0.1}" r="${r}" fill="#a8620a"/>
  <circle cx="${x}" cy="${y}" r="${r}" fill="url(#${p}-gold)" stroke="#c07a0e" stroke-width=".9"/>
  <circle cx="${x}" cy="${y}" r="${r * 0.72}" fill="none" stroke="#e39a17" stroke-width="1"/>
  <text x="${x}" y="${y + r * 0.36}" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${r * 1.05}" fill="#c07a0e">$</text>
  <path d="M${x - r * 0.62} ${y - r * 0.35} a${r * 0.72} ${r * 0.72} 0 0 1 ${r * 0.5} -${r * 0.4}" stroke="#fffbe0" stroke-width="${r * 0.18}" fill="none" stroke-linecap="round" opacity=".9"/>
</g>`;
// a twinkle
const spark = (x, y, s = 1, c = '#fff') => `<path d="M${x} ${y - 4 * s} L${x + 1.1 * s} ${y - 1.1 * s} L${x + 4 * s} ${y} L${x + 1.1 * s} ${y + 1.1 * s} L${x} ${y + 4 * s} L${x - 1.1 * s} ${y + 1.1 * s} L${x - 4 * s} ${y} L${x - 1.1 * s} ${y - 1.1 * s} Z" fill="${c}"/>`;
// a gold bar seen from above-front
const bar = (p, x, y, w = 14) => `<g>
  <path d="M${x} ${y + 5} L${x + 3} ${y} L${x + w - 3} ${y} L${x + w} ${y + 5} Z" fill="url(#${p}-gold)" stroke="#c07a0e" stroke-width=".7"/>
  <rect x="${x}" y="${y + 5}" width="${w}" height="4" fill="url(#${p}-goldSide)" stroke="#a8620a" stroke-width=".6"/>
  <path d="M${x + 4} ${y + 1.5} h${w - 8}" stroke="#fffbe0" stroke-width="1" opacity=".8"/>
</g>`;
// a bundle of banknotes with a paper band
const bills = (p, x, y, w = 18) => `<g>
  <rect x="${x}" y="${y + 3}" width="${w}" height="5" rx="1" fill="#2f8a4c"/>
  <rect x="${x}" y="${y}" width="${w}" height="5" rx="1" fill="url(#${p}-bill)" stroke="#2f8a4c" stroke-width=".7"/>
  <rect x="${x + w / 2 - 2.5}" y="${y - 0.4}" width="5" height="8.8" fill="#f4efe2" stroke="#b9ad8f" stroke-width=".5"/>
  <circle cx="${x + 3.4}" cy="${y + 2.5}" r="1.3" fill="none" stroke="#e6ffe9" stroke-width=".7"/>
</g>`;

const tile = (p, inner, bg, rays = '') => `<svg viewBox="0 0 64 64" width="60" height="60" aria-hidden="true"><defs>${defs(p)}
  <radialGradient id="${p}-bg" cx=".5" cy=".42" r=".7"><stop offset="0" stop-color="${bg[0]}"/><stop offset="1" stop-color="${bg[1]}"/></radialGradient></defs>
  <clipPath id="${p}-clip"><rect width="64" height="64" rx="16"/></clipPath>
  <g clip-path="url(#${p}-clip)">
  <rect width="64" height="64" fill="url(#${p}-bg)"/>
  ${rays}
  <circle cx="32" cy="30" r="24" fill="url(#${p}-glow)" opacity=".7"/>
  ${inner}
  </g>
  <rect x="1" y="1" width="62" height="62" rx="15" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2"/>
</svg>`;
const sunburst = (color, n = 12, op = 0.35) => `<g opacity="${op}">${Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2, b = a + Math.PI / n;
  return `<path d="M32 30 L${(32 + Math.cos(a) * 46).toFixed(1)} ${(30 + Math.sin(a) * 46).toFixed(1)} L${(32 + Math.cos(b) * 46).toFixed(1)} ${(30 + Math.sin(b) * 46).toFixed(1)} Z" fill="${color}"/>`;
}).join('')}</g>`;

// 1. a handful: a short stack of coins with one standing in front
const handful = tile('ph', `
  <ellipse cx="32" cy="50" rx="20" ry="4.5" fill="#000" opacity=".16"/>
  ${coin('ph', 26, 44, 9)}${coin('ph', 26, 40, 9)}${coin('ph', 26, 36, 9)}${coin('ph', 26, 32, 9)}
  ${coin('ph', 41, 46, 7)}
  ${coinUp('ph', 40, 31, 9.5, 12)}
  ${spark(48, 15, 1.1)}${spark(15, 22, .75)}`, ['#d9f7d2', '#7fcf8a']);

// 2. a bag: a fat burlap sack tied with gold rope, a $ badge, coins spilling out
const bag = tile('pb', `
  <defs>
    <radialGradient id="pb-sack" cx=".38" cy=".38" r=".75"><stop offset="0" stop-color="#f0c98a"/><stop offset=".65" stop-color="#c9925a"/><stop offset="1" stop-color="#8f5e2e"/></radialGradient>
  </defs>
  <ellipse cx="32" cy="53" rx="21" ry="4.5" fill="#000" opacity=".18"/>
  <path d="M25 18 Q22 12 18 11 Q24 7 32 10 Q40 7 46 11 Q42 12 39 18 Z" fill="#c9925a" stroke="#6e4520" stroke-width="1.2" stroke-linejoin="round"/>
  <path d="M25 18 Q9 26 11 40 Q13 53 32 53 Q51 53 53 40 Q55 26 39 18 Z" fill="url(#pb-sack)" stroke="#6e4520" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M17 33 Q20 26 26 23" stroke="#fff" stroke-opacity=".35" stroke-width="2.4" fill="none" stroke-linecap="round"/>
  <path d="M24 19 Q32 22 40 19" stroke="#e9a41f" stroke-width="3.2" fill="none" stroke-linecap="round"/>
  <path d="M38 20 q5 2 6 7" stroke="#e9a41f" stroke-width="2" fill="none" stroke-linecap="round"/>
  <circle cx="32" cy="37" r="8.5" fill="url(#pb-gold)" stroke="#c07a0e" stroke-width="1.1"/>
  <text x="32" y="41.6" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="12" fill="#a8620a">$</text>
  ${coin('pb', 14, 50, 6)}${coin('pb', 50, 51, 6.5)}${coin('pb', 50, 47, 6.5)}
  ${coinUp('pb', 21, 47, 5.5, -18)}
  ${spark(50, 14, 1.1)}${spark(13, 20, .8)}`, ['#d8ecff', '#6aa8e6']);

// 3. a vault: a heavy steel safe swung open, shelves of gold bars and cash inside
const vault = tile('pv', `
  <defs>
    <linearGradient id="pv-steel" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c9d3de"/><stop offset=".5" stop-color="#8a98a8"/><stop offset="1" stop-color="#5d6b7a"/></linearGradient>
    <linearGradient id="pv-in" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3a2a52"/><stop offset="1" stop-color="#1f1630"/></linearGradient>
    <radialGradient id="pv-shine" cx=".5" cy=".55" r=".6"><stop offset="0" stop-color="#ffe680" stop-opacity=".85"/><stop offset="1" stop-color="#ffe680" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse cx="33" cy="55" rx="23" ry="3.8" fill="#000" opacity=".22"/>
  <rect x="17" y="12" width="36" height="41" rx="4" fill="url(#pv-steel)" stroke="#3e4954" stroke-width="1.4"/>
  <rect x="21" y="16" width="28" height="33" rx="2" fill="url(#pv-in)"/>
  <rect x="21" y="16" width="28" height="33" rx="2" fill="url(#pv-shine)"/>
  <rect x="21" y="32" width="28" height="1.6" fill="#7a6a92"/>
  ${bar('pv', 23, 22, 11)}${bar('pv', 36, 22, 11)}${bar('pv', 29.5, 17.5, 11)}
  ${bills('pv', 23, 38, 11)}${bills('pv', 35.5, 38, 11)}${bills('pv', 29, 34.5, 11)}
  ${coin('pv', 27, 46, 4.5)}${coin('pv', 39, 46, 4.5)}${coin('pv', 33, 45, 4.5)}
  <path d="M17 12 L5 17 L5 50 L17 53 Z" fill="url(#pv-steel)" stroke="#3e4954" stroke-width="1.4" stroke-linejoin="round"/>
  <ellipse cx="11" cy="33" rx="4.2" ry="7.5" fill="#6f7d8c" stroke="#3e4954" stroke-width="1.1"/>
  <path d="M11 26.5 v13 M7.3 33 h7.4 M8.4 28.5 l5.2 9 M13.6 28.5 l-5.2 9" stroke="#2c353e" stroke-width="1.3" stroke-linecap="round"/>
  <circle cx="11" cy="33" r="1.6" fill="url(#pv-gold)" stroke="#2c353e" stroke-width=".6"/>
  <rect x="49" y="20" width="3" height="5" rx="1" fill="#3e4954"/><rect x="49" y="40" width="3" height="5" rx="1" fill="#3e4954"/>
  ${spark(30, 8, 1.2)}${spark(54, 10, .8)}${spark(45, 28, .7, '#fff6c8')}`, ['#ead9ff', '#8d63d2'], sunburst('#fff', 12, 0.18));

// 4. a bank: a gleaming golden bank with marble steps, piled high with gold out front
const bank = tile('pk', `
  <defs>
    <linearGradient id="pk-marble" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf6"/><stop offset="1" stop-color="#e3d6b8"/></linearGradient>
    <linearGradient id="pk-roof" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="1" stop-color="#e2a21f"/></linearGradient>
  </defs>
  <ellipse cx="32" cy="56" rx="25" ry="3.6" fill="#000" opacity=".22"/>
  <path d="M8 22 L32 9 L56 22 Z" fill="url(#pk-roof)" stroke="#a8620a" stroke-width="1.3" stroke-linejoin="round"/>
  <path d="M15 20 L32 12.4 L49 20 Z" fill="#fff3b8" opacity=".55"/>
  ${coinUp('pk', 32, 17.2, 3.4)}
  <rect x="9" y="22" width="46" height="4.5" fill="url(#pk-roof)" stroke="#a8620a" stroke-width="1"/>
  <g stroke="#b9a47a" stroke-width=".8">
    <rect x="12" y="26.5" width="5" height="17" fill="url(#pk-marble)"/><rect x="21.5" y="26.5" width="5" height="17" fill="url(#pk-marble)"/>
    <rect x="37.5" y="26.5" width="5" height="17" fill="url(#pk-marble)"/><rect x="47" y="26.5" width="5" height="17" fill="url(#pk-marble)"/>
  </g>
  <path d="M28.5 43.5 v-9 a3.5 3.5 0 0 1 7 0 v9 Z" fill="#5a3d16"/>
  <path d="M29.5 43.5 v-8.4 a2.5 2.5 0 0 1 5 0 v8.4" fill="#ffd34d" opacity=".55"/>
  <rect x="8" y="43.5" width="48" height="3.2" fill="url(#pk-marble)" stroke="#b9a47a" stroke-width=".8"/>
  <rect x="5" y="46.7" width="54" height="3.4" fill="#eadfc4" stroke="#b9a47a" stroke-width=".8"/>
  ${bar('pk', 4, 46, 12)}${bar('pk', 10, 41.5, 12)}${bar('pk', 16, 46, 12)}
  ${bills('pk', 40, 45, 14)}${bills('pk', 44, 41, 14)}
  ${coin('pk', 33, 52, 5)}${coin('pk', 26, 53, 4.5)}${coin('pk', 42, 53, 4.5)}
  ${spark(10, 10, 1.2)}${spark(54, 9, 1)}${spark(48, 33, .7, '#fff6c8')}${spark(14, 33, .6, '#fff6c8')}`, ['#fff2b8', '#f0a63a'], sunburst('#fff', 16, 0.32));

export const PACK_ART = { cash_s: handful, cash_m: bag, cash_l: vault, cash_xl: bank };
