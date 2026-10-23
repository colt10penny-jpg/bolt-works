import './style.css';
import { Capacitor } from '@capacitor/core';
import {
  FACTORIES, ALL, BUILDINGS, SUPPORT, isPlot, isSupport, speedFromCompute, capacity, FACTS, WORLDS, worldById, MILESTONES, fmt, fmtCost, fmtRate, fmtTime, upgradeCost, maxAffordable, lookTier,
  nextMilestone, milestoneCount, LEVEL_CAP, EP_BONUS, epForRun, themeFor, THEME_NAMES, vaultHours,
} from './economy.js';
import { Game } from './state.js';
import { World } from './world.js';
import { lookText } from './upgrades.js';
import { plotIds, TYPE_AT, PLOT_FOR } from './layout.js';
import { ads } from './ads.js';
import { sfx } from './sound.js';
import { initAnalytics, track, flush } from './analytics.js';
import { GAME } from './config.js';
import { skin } from './worlds.js';
import { ACHIEVEMENTS, checkAchievements } from './achievements.js';
import { createTutorial } from './tutorial.js';

if (import.meta.env.MODE === 'artifact') {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;800&family=Nunito:wght@600;800&display=swap';
  document.head.appendChild(l);
} else {
  import('./fonts.js');
}

const $ = id => document.getElementById(id);
const game = new Game();
const world = new World($('world'), $('labels'));
// the town is drawn by plot (q0, q1…); the game tracks buildings by slot ('mine', or a plot id for extra copies)
const slotAt = lot => lot ? game.slotAt(lot) : null;
const lotOf = id => game.plotOf(id);
world.lookFor = lot => { const s = slotAt(lot); return s ? def(s) : null; };
game.unitOf = id => skin(game.s.current, id).unit;
const def = id => {
  if (isPlot(id)) {
    const t = game.typeOf(id);
    if (!t) return { id, plot: true, name: game.developed(id) ? 'Empty lot' : 'Open land', color: 0x8a8f99, unit: '',
      fact: 'Developing land means clearing it, levelling it and pouring a concrete pad, ready for a new building.' };
    const sk = skin(game.s.current, t);
    const n = game.slotsOf(t).indexOf(id) + 1;
    return { ...game.slotDef(id), ...sk, name: `${sk.name} ${Math.max(2, n)}`, id, type: t };
  }
  const base = game.defOf(id); return base ? { ...base, ...skin(game.s.current, id), type: id } : base;
};
world.typeOf = lot => { const s = slotAt(lot); return s ? game.typeOf(s) : null; };
world.lotsOf = type => game.slotsOf(type).filter(s => game.jobOf(s)?.kind !== 'build').map(lotOf).filter(Boolean);
world.workOf = lot => { const s = slotAt(lot); return s && game.jobOf(s) ? game.jobProgress(s) : null; };
world.roadInfo = () => ({ good: new Set(Object.keys(game.run.roads)), exits: game.exitsOf(game.s.current), state: k => game.roadState(k) });
const typeOf = id => game.typeOf(id);
if (location.search.includes('debug')) import('./traffic.js').then(m => Object.assign(window, { __game: game, __world: world, __net: m.NET, __tm: m }));
const idx = id => FACTORIES.findIndex(f => f.id === id);
const hex = n => '#' + n.toString(16).padStart(6, '0');
const tint = d => hex([0xe8e4da, 0xd8d2c4, 0xcfd3da, 0xd8d4c8].includes(d.color) ? 0x8a8f99 : d.color);
const AD = '<span class="ad-tag">AD</span>';

const ICON = {
  factory: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V10l5 3V10l5 3V6l8 4v11z"/></svg>',
  plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  boltSm: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  bolt: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  moon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  rocket: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.5 12 2z"/><circle cx="12" cy="10" r="1.8"/><path d="M7.5 14 4.5 17v3h3M16.5 14l3 3v3h-3M10 20.5c.5 1 1.2 1.5 2 1.5s1.5-.5 2-1.5"/></svg>',
  gift: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 9h20v-3H2zM12 6v15M12 6C10 2 6.5 2.5 7 5c.3 1.3 3 1 5 1zm0 0c2-4 5.5-3.5 5-1-.3 1.3-3 1-5 1z"/></svg>',
  chip: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/></svg>',
  person: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4.5 20.5c.9-3.9 3.9-6 7.5-6s6.6 2.1 7.5 6"/></svg>',
  globe: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  hammer: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4l6 6-3 3-6-6zM11 7l-8 8 3 3 8-8"/></svg>',
  hq: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M4 21V5l8-2v18M12 8h8v13M4 21h17M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2"/></svg>',
  trophy: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v1.5A3.5 3.5 0 0 0 7.5 11M17 6h3v1.5a3.5 3.5 0 0 1-3.5 3.5M12 14v3.5M8.5 21h7M9.5 17.5h5V21h-5z"/></svg>',
  gear: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></svg>',
  map: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>',
  chev: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>',
  clip: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>',
};

// ---------- small bubbles over buildings ----------
// Nothing shows unless it needs you: money waiting (tap to collect), a supply
// problem, or an empty lot you can afford.
const pctSpeed = () => Math.round((game.baseFlow().speed - 1) * 100);
const COIN = '<span class="b-coin" aria-hidden="true">$</span>';
const NONE = { cls: '', html: '', aria: '' };
const canBuildHere = lot => lotReady(lot) && game.canAfford(game.buildCost(lotType(lot)));
function labelFor(lot) {
  const id = slotAt(lot);
  if (!id) {
    // a + on the spot for the next building, once you can afford to clear it or build on it
    if (!lotReady(lot)) return NONE;
    const can = game.developed(lot) ? canBuildHere(lot) : game.canAfford(game.developQuote(lot).total);
    return can ? { cls: 'bub plus', html: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.8" stroke-linecap="round" aria-hidden="true"><path d="M12 4.5v15M4.5 12h15"/></svg>', aria: `Spot for the ${def(lotType(lot)).name}. Tap to build.` } : NONE;
  }
  const d = def(id), lv = game.level(id);
  const job = game.jobOf(id);
  if (job) return { cls: 'bub job', html: `${ICON.hammer}<b>${fmtTime(game.jobLeft(id))}</b>`, aria: `${d.name}: being built, ${fmtTime(game.jobLeft(id))} left` };
  if (id === 'hq' && lv > 0) {
    const v = game.vault();
    if (v >= 1) return { cls: 'bub cash', html: `${COIN}<b>${fmt(v)}</b>`, aria: `${d.name}: your managers left $${fmt(v)} here while you were away. Tap to collect.` };
    const free = game.freeManagers();
    return free > 0 ? { cls: 'bub idle', html: `${ICON.person}<b>${free}</b>`, aria: `${free} manager${free > 1 ? 's' : ''} waiting for a job. Tap to send them out.` } : { cls: '', html: '', aria: '' };
  }
  const f = game.info(id);
  if (isSupport(typeOf(id))) {
    return f.starved ? { cls: 'bub warn', html: '!', aria: `${d.name} is short on power` } : { cls: '', html: '', aria: '' };
  }
  const amount = game.bin(id);
  if (!game.hasManager(id) && amount >= 1) {
    const full = game.binFull(id);
    return {
      cls: 'bub cash' + (full ? ' full' : '') + (f.starved ? ' warn-dot' : ''),
      html: `${COIN}<b>${fmt(amount)}</b>${full ? '<i>FULL</i>' : ''}`,
      aria: `${d.name}: $${fmt(amount)} ready. Tap to collect.`,
    };
  }
  if (f.starved) return { cls: 'bub warn', html: '!', aria: `${d.name} is short on supplies` };
  return { cls: '', html: '', aria: '' };
}

// ---------- bottom sheet (compact) ----------
let buyMode = 1;
let factOpen = false;
const sheet = $('sheet');
let sheetKey = '';
// how many levels the buy button buys, never past the top level
const buyCount = (d, lv) => Math.max(0, Math.min(LEVEL_CAP - lv, buyMode === 'max' ? Math.max(1, maxAffordable(d, lv, game.cash)) : buyMode));
const go = (id, label) => lotOf(id) ? `<button class="link" data-goto="${lotOf(id)}">${label}</button>` : '';
const one = u => /ss$/.test(u) ? u : /ies$/.test(u) ? u.replace(/ies$/, 'y') : u.replace(/s$/, '');

// one short status line: the most important thing about this building right now
function statusLine(d) {
  const i = idx(d.type || d.id);
  const f = game.info(d.id);
  const prev = i > 0 ? def(FACTORIES[i - 1].id) : null;
  const next = FACTORIES[i + 1] ? def(FACTORIES[i + 1].id) : null;
  const has = x => game.slotsOf(x.id).length > 0;
  if (prev && !has(prev)) return `<div class="sh-status warn">Needs ${prev.unit} from a ${prev.name} ${go(prev.id, 'Show')}</div>`;
  if (prev && f.starved) return `<div class="sh-status warn">Short on ${prev.unit} · ${Math.round(f.util * 100)}% speed ${go(prev.id, `Fix: ${prev.name}`)}</div>`;
  if (next && has(next) && f.surplus > 0.15 && f.made > 0) return `<div class="sh-status info">${Math.round(f.surplus * 100)}% of ${d.unit} piling up ${go(next.id, next.name)}</div>`;
  return prev ? `<div class="sh-status ok">Fully supplied · ${d.need} ${prev.unit} per ${one(d.unit)}</div>` : '';
}
// how far the nearest supplier is, and what that does to output
function supplyLine(d) {
  const sup = game.supplierOf(d.id);
  if (!sup) return '';
  const eff = Math.round(game.effOf(d.id) * 100), s = def(sup.id);
  const away = sup.blocks <= 1 ? 'right next door' : `${sup.blocks} blocks away`;
  const cls = eff > 100 ? 'ok' : eff < 100 ? 'warn' : 'info';
  return `<div class="sh-status ${cls}">${s.name} is ${away} · ${eff}% output${eff < 125 ? ' (closer is better)' : ''}</div>`;
}
function supportStatus(d) {
  const fl = game.baseFlow();
  const pw = fl.support.power, dc = fl.support.datacenter;
  const P = def('power'), D = def('datacenter');
  if (d.id === 'power') {
    if (!game.built('datacenter')) return `<div class="sh-status info">Build a ${D.name} to use this power ${go('datacenter', 'Show')}</div>`;
    return pw.made - pw.used > 0.01
      ? `<div class="sh-status ok">${fmtRate(pw.used)} of ${fmtRate(pw.made)} MW in use ${go('datacenter', D.name)}</div>`
      : `<div class="sh-status warn">All ${fmtRate(pw.made)} MW in use · more power = more compute</div>`;
  }
  if (!game.built('power')) return `<div class="sh-status warn">No power · build a ${P.name} ${go('power', 'Show')}</div>`;
  if (dc.starved) return `<div class="sh-status warn">Short on power · ${Math.round(dc.util * 100)}% speed ${go('power', `Fix: ${P.name}`)}</div>`;
  return `<div class="sh-status ok">Fully powered · ${SUPPORT[1].need} MW per PFLOPS</div>`;
}

function head(d, badge, title, sub, lvl = 0) {
  return `<div class="sh-head">
      <span class="badge sm" style="background:${tint(d)}">${badge}</span>
      <span class="sh-title"><span class="sh-name-row"><b>${title}</b>${lvl ? `<span class="lv-pill">Lv ${lvl}</span>` : ''}</span><small>${sub}</small></span>
      ${d.fact ? `<button class="icon-sm" data-act="fact" aria-label="About this building" aria-pressed="${factOpen}">i</button>` : ''}
      <button class="close sm" data-act="close" aria-label="Close">${ICON.close}</button>
    </div>
    ${factOpen && d.fact ? `<p class="sh-fact">${d.fact}</p>` : ''}`;
}
// progress to the next milestone level, where the building gets a new look and 2x output
function mileBar(lv, type) {
  const nm = nextMilestone(lv);
  const prevM = [...MILESTONES].reverse().find(m => m <= lv) ?? 1;
  const pct = nm ? ((lv - prevM) / (nm - prevM)) * 100 : 100;
  return `<div class="sh-mile"><span>${nm ? `Lv ${nm}: ${lookText(type, nm)}, 2× output` : 'Fully expanded'}</span><span class="sh-bar"><i style="width:${pct.toFixed(1)}%"></i></span><span>${nm ? `${lv}/${nm}` : `Lv ${lv}`}</span></div>`;
}
// work in progress: a bar, the time left, and a button to finish it now with an ad
function jobRow(id) {
  const j = game.jobOf(id); if (!j) return '';
  const p = game.jobProgress(id);
  const what = 'Under construction';
  return `<div class="sh-job"><div class="sh-save"><span class="sh-bar"><i style="width:${(p * 100).toFixed(1)}%"></i></span><small>${what} · ${fmtTime(game.jobLeft(id))} left</small></div>
    <button class="btn gold" data-act="finish">${AD} Watch ad to finish now</button></div>`;
}
function buildingSheet(d, id) {
  return head(d, ICON.factory, d.name, `Being built · opens in ${fmtTime(game.jobLeft(id))}`) +
    `<p class="sh-how">Builders are putting up your ${d.name}. It starts working as soon as it's finished.</p>` + jobRow(id);
}
function buyRow(d, lv) {
  if (game.jobOf(d.id)) return jobRow(d.id);
  if (lv >= LEVEL_CAP) return `<div class="sh-maxed">Max level reached: Lv ${LEVEL_CAP.toLocaleString('en-US')}</div>`;
  const n = buyCount(d, lv);
  const cost = upgradeCost(d, lv, n);
  const afford = game.canAfford(cost);
  return `<div class="sh-buy">
      <div class="amounts sm" role="group" aria-label="How many levels to buy">
        <button data-buy="1" aria-pressed="${buyMode === 1}">×1</button>
        <button data-buy="10" aria-pressed="${buyMode === 10}">×10</button>
        <button data-buy="max" aria-pressed="${buyMode === 'max'}">Max</button>
      </div>
      <button class="btn green" data-act="upgrade" ${afford ? '' : 'disabled'}>+${n} · $${fmtCost(cost)}</button>
    </div>
    ${afford ? '' : `<div class="sh-save"><span class="sh-bar"><i style="width:${Math.min(100, game.cash / cost * 100).toFixed(1)}%"></i></span><small>Saving up: ${Math.floor(Math.min(99, game.cash / cost * 100))}%</small></div>`}
    ${afford ? '' : cashAdButton(cost - game.cash)}`;
}
const demolishRow = d => `<button class="link danger" data-act="demolish">Demolish ${d.name}</button>`;
function managerRow(d) {
  if (game.hasManager(d.id)) return '';
  const store = `<span>${ICON.person}<span>Storage <b>$${fmt(game.bin(d.id))}</b> / $${fmt(game.binCap(d.id))}</span></span>`;
  const H = def('hq');
  let btn;
  if (!game.built('hq')) btn = `<small class="sh-tip">Build the ${H.name} to hire managers</small>`;
  else if (game.freeManagers() > 0) btn = `<button class="btn small" data-act="assign" data-id="${d.id}">Send a manager here</button>`;
  else btn = `<button class="btn small" data-goto="${lotOf('hq')}">Hire at ${H.name}</button>`;
  return `<div class="sh-mgr">${store}${btn}</div>`;
}

// headquarters: hire managers, then send each one to a factory
// open land: develop it, then pick what to build
function whatItDoes(t) {
  const i = idx(t), prev = i > 0 ? def(FACTORIES[i - 1].id) : null, d = def(t);
  if (t === 'hq') return 'Hire managers to collect money for you, even while you\'re away';
  if (t === 'power') return `Makes electricity for the ${def('datacenter').name}`;
  if (t === 'datacenter') return 'Turns power into compute that speeds up every factory';
  return prev ? `Turns ${prev.unit} into ${d.makes}` : `Digs ${d.makes}`;
}
// each plot has its one building. Is that building ready to go up here yet?
const lotType = lot => TYPE_AT[lot];
const lotReady = lot => nextSet().includes(lotType(lot));
function plotSheet(lot) {
  const t = lotType(lot), d = def(t), ready = lotReady(lot);
  const top = (title, sub, color = tint(d)) => `<div class="sh-head">
      <span class="badge sm" style="background:${color}">${ICON.plus}</span>
      <span class="sh-title"><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span>
      <button class="close sm" data-act="close" aria-label="Close">${ICON.close}</button>
    </div>`;
  // land for a building you can't build yet says nothing about what will go there
  if (!ready) return top(game.developed(lot) ? 'Cleared land' : 'Undeveloped land', '', '#8a8f99');
  if (!game.developed(lot)) {
    const q = game.developQuote(lot), ok = game.canAfford(q.total);
    const worn = q.list.filter(r => r.kind === 'worn').length, fresh = q.list.length - worn;
    const roadWords = [worn ? `fix ${worn} old road${worn > 1 ? 's' : ''}` : '', fresh ? `pave ${fresh} new road${fresh > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ');
    const sub = roadWords ? `Clear it and ${roadWords}` : 'Clear it (its roads are already good)';
    return top(`Spot for the ${d.name}`, sub) +
      `<div class="sh-cost"><span>Land <b>$${fmtCost(q.land)}</b></span>${q.list.length ? `<span>Roads <b>$${fmtCost(q.roads)}</b></span>` : ''}</div>
      <button class="btn green" data-act="develop" ${ok ? '' : 'disabled'}>Develop · $${fmtCost(q.total)}</button>
      ${ok ? '' : cashAdButton(q.total - game.cash)}`;
  }
  const cost = game.buildCost(t), ok = game.canAfford(cost);
  return top(`Build the ${d.name}`, whatItDoes(t)) +
    `<button class="btn green" data-act="build" data-type="${t}" ${ok ? '' : 'disabled'}>Build · $${fmtCost(cost)}</button>
    ${ok ? '' : cashAdButton(cost - game.cash)}`;
}

function hqSheet(d) {
  const free = game.freeManagers(), staff = game.staff();
  const cost = game.nextHireCost();
  const more = game.canHireMore();
  const afford = more && game.canAfford(cost);
  const rows = game.factorySlots().map(sid => ({ id: sid })).map(f => {
    const fd = def(f.id), on = game.hasManager(f.id);
    return `<div class="hq-row ${on ? 'on' : ''}">
      <span class="hq-dot" style="background:${tint(fd)}"></span>
      <span class="hq-name">${fd.name}<small>${on ? 'Manager collecting' : `$${fmt(game.bin(f.id))} waiting`}</small></span>
      ${on ? `<button class="btn small plain" data-act="recall" data-id="${f.id}">Call back</button>`
           : `<button class="btn small" data-act="assign" data-id="${f.id}" ${free > 0 ? '' : 'disabled'}>Send</button>`}
    </div>`;
  }).join('');
  const sub = staff ? `${staff} manager${staff > 1 ? 's' : ''} · ${free} waiting for a job` : 'Hire managers to collect money for you, even while you\'re away';
  const lv = game.level('hq');
  // the vault: what managers collected while you were away, and how much it can hold
  const v = game.vault(), cap = game.vaultCap(), hrs = game.vaultHours();
  const nextHrs = vaultHours(lv + buyCount(d, lv));
  const vault = `<div class="hq-vault">
      <div class="hq-vault-top"><span>Collected while you were away</span><b>$${fmt(v)}</b></div>
      <span class="sh-bar"><i style="width:${cap > 0 ? Math.min(100, v / cap * 100).toFixed(1) : 0}%"></i></span>
      <small>Holds up to ${fmtHours(hrs)} of your managers' pay${cap >= 1 ? ` ($${fmt(cap)})` : ''}. ${nextHrs > hrs ? `Upgrade to hold ${fmtHours(nextHrs)}.` : ''}</small>
      ${v >= 1 ? `<div class="hq-vault-btns"><button class="btn green" data-act="vault">Collect $${fmt(v)}</button><button class="btn gold" data-act="vault2">${AD} Collect 2×</button></div>` : ''}
    </div>`;
  return head(d, ICON.hq, d.name, sub, lv) + vault + buyRow(d, lv) + `
    <div class="sh-buy"><button class="btn green" data-act="hire" ${afford ? '' : 'disabled'}>${!more ? 'One manager per factory: build more to hire more' : `Hire a manager · $${fmtCost(cost)}`}</button></div>
    ${afford || !more ? '' : cashAdButton(cost - game.cash)}
    <div class="hq-list">${rows}</div>${demolishRow(d)}`;
}
const fmtHours = h => { const m = Math.round(h * 60); return m % 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m / 60} hours`; };
function renderSheet(force = false) {
  const lot = world.selected;
  if (!lot) { sheet.hidden = true; sheetKey = ''; delete sheet.dataset.for; return; }
  const id = slotAt(lot);
  const d = id ? def(id) : null, lv = id ? game.level(id) : 0;
  let html;
  const t = id ? typeOf(id) : null;
  if (!id) {
    html = plotSheet(lot);
  } else if (game.jobOf(id)?.kind === 'build') {
    html = buildingSheet(d, id);
  } else if (lv > 0 && id === 'hq') {
    html = hqSheet(d);
  } else if (lv > 0 && isSupport(t)) {
    const fl = game.baseFlow();
    const nextLv = { ...game.levels, [id]: d.extra ? game.level(t) : lv + buyCount(d, lv) };
    const pw2 = capacity(SUPPORT[0], nextLv.power) * (game.world.perks.power || 1), dc2 = capacity(SUPPORT[1], nextLv.datacenter);
    const nextSpeed = Math.round((speedFromCompute(Math.min(dc2, pw2 / SUPPORT[1].need)) - 1) * 100);
    const made = t === 'power' ? `${fmtRate(game.info(id).made)} MW` : `${fmtRate(game.info(id).made)} PFLOPS`;
    const sub = `${made} · speed +${pctSpeed()}%${nextSpeed > pctSpeed() ? ` <em>→ +${nextSpeed}%</em>` : ''}`;
    html = head(d, t === 'power' ? ICON.boltSm : ICON.chip, d.name, sub, lv) + supportStatus({ ...d, id: t }) + mileBar(lv, t) + buyRow(d, lv) + demolishRow(d);
  } else if (lv > 0) {
    const f = game.info(id);
    const earn = f.made * d.value * game.mult();
    const sub = `${fmtRate(f.made)} ${d.unit}/s · $${fmt(earn)}/s${game.hasManager(id) ? ' · <span class="mgr-on">manager</span>' : ''}`;
    const rocket = t === 'rocket' ? (() => {
      const pts = game.launchPreview(), next = game.nextWorld(), unlocks = next && !game.s.worlds[next.id];
      const can = game.canLaunch() && (pts >= 1 || unlocks);
      // how rockets get built: parts arrive by truck, the bay puts them together, then you launch
      const prev = def(FACTORIES[idx('rocket') - 1].id), made = game.typeInfo('rocket')?.made || 0;
      const ready = Math.floor(game.run.rocketsBuilt), frac = game.run.rocketsBuilt - ready;
      const eta = made > 0 ? fmtTime((1 - frac) / made) : null;
      const how = `<p class="sh-how">Trucks bring <b>${prev.unit}</b> from your ${prev.name}; this bay puts every ${d.need} together into one ${one(d.unit)}. When one is ready, launch it.</p>`;
      const prog = ready >= 1 ? '' : `<div class="sh-save"><span class="sh-bar"><i style="width:${(frac * 100).toFixed(1)}%"></i></span><small>${made > 0 ? `Next ${one(d.unit)}: ${Math.floor(frac * 100)}% · ${eta}` : `Waiting for ${prev.unit}`}</small></div>`;
      return how + prog + `<div class="sh-row"><span>${ready} ${ready === 1 ? one(d.unit) : d.unit} ready</span>
        <button class="btn small red" data-act="launch" ${can ? '' : 'disabled'}>${!game.canLaunch() ? `Building first ${one(d.unit)}` : pts >= 1 ? `Launch · +${pts} EP` : unlocks ? `Launch · unlock ${next.short}` : 'Earn more for points'}</button></div>`;
    })() : '';
    html = head(d, ICON.factory, d.name, sub, lv) + statusLine(d) + rocket + mileBar(lv, t) + buyRow(d, lv) + managerRow(d) + demolishRow(d);
  }
  // update the panel in place, so buttons don't get swapped out from under your finger
  const key = lot + ':' + (id || '');
  if (sheet.dataset.for !== key) { sheet.innerHTML = html; sheet.dataset.for = key; sheetKey = html; }
  else if (force || html !== sheetKey) { const t = document.createElement('div'); t.innerHTML = html; morphKids(sheet, t); sheetKey = html; }
  sheet.hidden = false;
  const h = sheet.offsetHeight, H = window.innerHeight || 1;
  document.documentElement.style.setProperty('--sheet-h', h + 'px');
  if (h) world.setFreeTop(Math.max(0, (H - h) / H));
}

function morph(a, b) {
  if (a.nodeType !== b.nodeType || a.nodeName !== b.nodeName) { a.replaceWith(b.cloneNode(true)); return; }
  if (a.nodeType === 3) { if (a.nodeValue !== b.nodeValue) a.nodeValue = b.nodeValue; return; }
  if (a.nodeType !== 1) return;
  for (const { name } of [...a.attributes]) if (!b.hasAttribute(name)) a.removeAttribute(name);
  for (const { name, value } of [...b.attributes]) if (a.getAttribute(name) !== value) a.setAttribute(name, value);
  morphKids(a, b);
}
function morphKids(a, b) {
  const ac = [...a.childNodes], bc = [...b.childNodes];
  for (let i = 0; i < bc.length; i++) { if (i < ac.length) morph(ac[i], bc[i]); else a.appendChild(bc[i].cloneNode(true)); }
  for (let i = bc.length; i < ac.length; i++) ac[i].remove();
}

// The cash ad covers what you're missing (plus a little), or a minute of income,
// and is only offered when you're within ~10 minutes of affording it, so it speeds
// you up without skipping the game.
const cashAdAmount = short => Math.max(short * 1.05, game.totalRate() * 60 * GAME.cashAdMinutes, 25);
const cashAdOffered = short => short <= Math.max(game.totalRate() * 600, 100);
const cashAdButton = short => cashAdOffered(short) ? `<button class="btn gold" data-act="cash-ad" data-short="${Math.ceil(short)}">${AD} Watch ad for $${fmt(cashAdAmount(short))}</button>` : '';

sheet.addEventListener('click', async e => {
  if (sheet.dataset.swiped) return;   // that was a swipe, not a tap
  const b = e.target.closest('button');
  if (!b) return;
  const lot = world.selected, id = slotAt(lot);
  if (b.dataset.act === 'fact') { factOpen = !factOpen; renderSheet(true); return; }
  if (b.dataset.buy) { buyMode = b.dataset.buy === 'max' ? 'max' : +b.dataset.buy; sfx.tap(); renderSheet(true); return; }
  if (b.dataset.goto) { world.select(b.dataset.goto); world.focus(b.dataset.goto); sfx.tap(); return; }
  const act = b.dataset.act;
  if (act === 'close') world.select(null);
  if (act === 'vault') { const v = game.collectVault(); if (v) { world.pop(lot, `+$${fmt(v)}`, 'big'); world.bounce(lot); sfx.coin(); } }
  if (act === 'vault2') {
    if (await watch('vault_double', 'double what managers collected')) { const v = game.collectVault(2); if (v) { world.pop(lot, `+$${fmt(v)}`, 'big'); world.bounce(lot); sfx.reward(); } }
  }
  if (act === 'upgrade' && id) {
    const d = def(id), lv = game.level(id);
    if (game.buyLevels(id, buyCount(d, lv))) world.bounce(lot);
  }
  if (act === 'develop' && game.develop(lot)) { sfx.build(); toast('Land cleared and roads fixed! Now build something on it.'); track('land_developed', { plots: Object.keys(game.run.land).length }); }
  if (act === 'build') {
    const type = b.dataset.type, again = game.built(type);
    if (game.buildOn(lot, type)) { toast(`Building the ${def(slotAt(lot)).name}: ${fmtTime(game.jobLeft(slotAt(lot)))}`); if (again) track('extra_built', { type }); }
  }
  if (act === 'cash-ad') {
    const amount = cashAdAmount(+b.dataset.short || 0);
    if (await watch('cash', `$${fmt(amount)} cash`)) { game.addCash(amount); sfx.reward(); toast(`+$${fmt(amount)}`); }
  }
  if (act === 'launch') openLaunch();
  if (act === 'finish' && id && game.jobOf(id)) {
    if (await watch('finish_job', 'finish the work now')) { game.finishNow(id); sfx.reward(); }
  }
  if (act === 'demolish' && id) {
    const d = def(id);
    openModal(`<div class="big-icon">${ICON.factory}</div><h2>Demolish the ${d.name}?</h2>
      <p>It's knocked down and its levels are lost. The cleared lot stays yours, ready for something else.${game.hasManager(id) ? ' Its manager goes back to headquarters.' : ''}</p>
      <button class="btn red" data-act="yes">Demolish</button><button class="btn plain" data-act="dismiss">Keep it</button>`, a => {
      if (a !== 'yes') return;
      if (game.demolish(id)) { sfx.build(); toast(`${d.name} demolished`); track('demolished', { type: game.typeOf(id) || d.type }); world.select(lot); }
    });
  }
  if (act === 'hire' && game.hire()) { sfx.milestone(); world.bounce(lotOf('hq')); toast('Manager hired! Send them to a factory.'); track('manager_hired', { staff: game.staff() }); }
  if (act === 'assign' && game.assign(b.dataset.id)) { sfx.upgrade(); toast(`Manager on the way to the ${def(b.dataset.id).name}`); track('manager_sent', { factory: b.dataset.id }); }
  if (act === 'recall' && game.recall(b.dataset.id)) { sfx.tap(); toast(`Manager heading back to the ${def('hq').name}`); }
  renderSheet(true);
});

// Tapping a coin bubble collects that building's money (and nothing else). Tapping the
// building itself only opens its panel, without collecting (tap it again, or the
// ground, to close).
function collectAt(lot) {
  const id = slotAt(lot);
  if (!id) return 0;
  if (id === 'hq') {
    const v = game.vault();
    if (v < 1 || game.jobOf('hq')) return 0;
    game.collectVault();
    world.pop(lot, `+$${fmt(v)}`, 'big'); world.bounce(lot); sfx.coin();
    track('vault_collected', { amount: Math.round(v) });
    return v;
  }
  const amount = !isSupport(typeOf(id)) && game.built(id) && !game.hasManager(id) ? game.bin(id) : 0;
  if (amount < 1) return 0;
  game.collect(id);
  world.pop(lot, `+$${fmt(amount)}`, 'big');
  world.bounce(lot);
  sfx.coin();
  if (!game.s.tutorial.collected) track('tutorial_step', { step: 'collected' });
  return amount;
}
world.onBubble = id => {
  if (!collectAt(id)) world.select(id);
};
world.onTap = id => {
  world.select(world.selected === id ? null : id);
};

world.onPick = id => {
  if (id) {
    world.focus(id);
    if (!game.s.tutorial.opened) { game.s.tutorial.opened = true; track('tutorial_step', { step: 'opened_factory' }); }
    sfx.tap();
  }
  document.body.classList.toggle('selecting', !!id);
  renderSheet(true);
};

// swipe the panel down to close it
{
  let y0 = null, dy = 0, t0 = 0;
  sheet.addEventListener('pointerdown', e => {
    const list = e.target.closest('.hq-list');
    if (list && list.scrollTop > 0) return;   // let the list scroll first
    y0 = e.clientY; dy = 0; t0 = performance.now();
  });
  addEventListener('pointermove', e => {
    if (y0 == null) return;
    dy = Math.max(0, e.clientY - y0);
    if (dy > 14) { sheet.style.transition = 'none'; sheet.style.transform = `translateY(${dy - 14}px)`; }
  });
  const end = () => {
    if (y0 == null) return;
    const fast = dy / Math.max(1, performance.now() - t0) > 0.5;
    sheet.style.transition = 'transform .2s ease-out';
    if (dy > 70 || (fast && dy > 25)) {
      sheet.style.transform = `translateY(${sheet.offsetHeight}px)`;
      setTimeout(() => { world.select(null); sheet.style.transform = ''; }, 180);
    } else sheet.style.transform = '';
    // only a real drag counts as a swipe: a tap with a little finger wobble still presses the button
    if (dy > 24) { sheet.dataset.swiped = '1'; setTimeout(() => delete sheet.dataset.swiped, 50); }
    y0 = null;
  };
  addEventListener('pointerup', end); addEventListener('pointercancel', end);
}

// ---------- ads ----------
let adBusy = false;
async function watch(placement, reason) {
  if (adBusy) return false;
  adBusy = true;
  track('ad_offer_accepted', { placement });
  const ok = await ads.showRewarded(reason);
  adBusy = false;
  if (ok) { game.s.adsWatched++; track('ad_watched', { placement }); save(); }
  else if (ads.last === 'cancelled') { track('ad_cancelled', { placement }); toast('Ad closed early, so no reward.'); }
  else toast('No ad available right now. Try again soon.');
  return ok;
}

// ---------- modals (queued, one at a time) ----------
const modal = $('modal'), card = $('modal-card');
const modalQueue = [];
let current = null;
function openModal(html, handler, onDismiss) {
  modalQueue.push({ html, handler, onDismiss });
  if (!current) nextModal();
}
function nextModal() {
  current = modalQueue.shift() || null;
  if (!current) { modal.hidden = true; card.innerHTML = ''; return; }
  card.innerHTML = current.html;
  modal.hidden = false;
  card.querySelector('button')?.focus();
}
function closeModal(dismissed = false) {
  const c = current;
  current = null;
  if (dismissed && c?.onDismiss) c.onDismiss();
  nextModal();
}
modal.addEventListener('click', async e => {
  if (!current) return;
  if (e.target === modal) { closeModal(true); return; }
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'dismiss') { closeModal(true); return; }
  const handler = current.handler;
  closeModal(false);
  if (handler) await handler(act);
});

let toastT = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2400);
}

// ---------- boost ----------
$('boost-btn').addEventListener('click', () => {
  sfx.tap();
  if (game.boostLeft() > (GAME.boostMaxMinutes - GAME.boostMinutesPerAd) * 60) { toast(`Boost is full (${fmtTime(game.boostLeft())} left)`); return; }
  openModal(`
    <div class="big-icon">${ICON.bolt}</div>
    <h2>Turbo shift!</h2>
    <p>Every factory earns double for ${GAME.boostMinutesPerAd} minutes. Watch more to stack up to ${GAME.boostMaxMinutes / 60} hours.</p>
    <div class="stats">
      <div class="stat"><small>Now</small><b>$${fmt(game.rate())}/s</b></div>
      <div class="stat"><small>Boosted</small><b><em>$${fmt(game.baseRate() * 2)}/s</em></b></div>
    </div>
    ${game.boostLeft() > 0 ? `<p>Boost time left: <b>${fmtTime(game.boostLeft())}</b></p>` : ''}
    <button class="btn gold" data-act="boost">${AD} Watch ad to boost</button>
    <button class="btn plain" data-act="dismiss">Maybe later</button>`, async act => {
    if (act === 'boost' && await watch('boost', `${GAME.boostMinutesPerAd} min of double earnings`)) {
      game.addBoost(GAME.boostMinutesPerAd); sfx.reward(); toast(`Double earnings for ${fmtTime(game.boostLeft())}`);
    }
  });
});

// ---------- contracts ----------
const contractEl = $('contract');
function renderContract() {
  const c = game.s.contract;
  if (!c) { contractEl.hidden = true; return; }
  contractEl.hidden = false;
  const left = Math.max(0, (c.endsAt - Date.now()) / 1000);
  const pct = Math.min(100, (c.progress / c.target) * 100);
  const done = c.status === 'done';
  contractEl.classList.toggle('done', done);
  contractEl.querySelector('.c-who').textContent = done ? 'Order ready!' : c.customer;
  contractEl.querySelector('.c-what').textContent = done ? `+$${fmt(c.reward)}` : `${fmt(c.progress)}/${fmt(c.target)}`;
  contractEl.querySelector('.c-time').textContent = done ? '' : fmtTime(left);
  contractEl.querySelector('.c-bar i').style.width = pct.toFixed(1) + '%';
}
contractEl.addEventListener('click', () => {
  const c = game.s.contract;
  if (!c) return;
  sfx.tap();
  const d = def(c.id);
  if (c.status === 'done') {
    openModal(`
      <div class="big-icon">${ICON.clip}</div>
      <h2>Order filled!</h2>
      <p>${c.customer} got their ${fmt(c.target)} ${c.unit}.</p>
      <div class="big-num">$${fmt(c.reward)}</div>
      <button class="btn gold" data-act="c2">${AD} Collect 2× · $${fmt(c.reward * 2)}</button>
      <button class="btn plain" data-act="c1">Collect $${fmt(c.reward)}</button>`, async act => {
      let mult = 1;
      if (act === 'c2') { if (await watch('contract_double', 'double contract reward')) mult = 2; else { contractEl.click(); return; } }
      const paid = game.finishContract(mult);
      track('contract_done', { product: c.id, doubled: mult === 2 });
      sfx.reward(); toast(`+$${fmt(paid)}`);
    }, () => { const paid = game.finishContract(1); track('contract_done', { product: c.id, doubled: false }); toast(`+$${fmt(paid)}`); });
    return;
  }
  const left = Math.max(0, (c.endsAt - Date.now()) / 1000);
  const rate = game.info(c.id).made;
  const needRate = (c.target - c.progress) / Math.max(1, left);
  openModal(`
    <div class="big-icon">${ICON.clip}</div>
    <h2>${c.customer}</h2>
    <p>Wants <b>${fmt(c.target)} ${c.unit}</b> in ${c.minutes} minutes. Pays <b>$${fmt(c.reward)}</b>.</p>
    <div class="stats">
      <div class="stat"><small>You make</small><b>${fmtRate(rate)}/s</b></div>
      <div class="stat"><small>On pace needs</small><b><em>${fmtRate(needRate)}/s</em></b></div>
    </div>
    <p>${rate >= needRate ? 'You’re on pace. Nice.' : `Upgrade your ${d.name} (and its suppliers) to finish in time.`} Time left: <b>${fmtTime(left)}</b></p>
    <button class="btn green" data-act="goto">Go to ${d.name}</button>
    <button class="btn plain" data-act="dismiss">Close</button>`, act => {
    if (act === 'goto' && lotOf(c.id)) { world.select(lotOf(c.id)); world.focus(lotOf(c.id)); }
  });
});
game.on('contract', c => {
  if (c.status === 'active') { toast(`New order from ${c.customer}!`); track('contract_offered', { product: c.id }); }
  if (c.status === 'done') { sfx.contract(); toast('Order ready! Tap the order card to collect.'); }
  if (c.status === 'failed') {
    sfx.fail(); toast(`${c.customer} order expired.`);
    track('contract_failed', { product: c.id });
    setTimeout(() => { if (game.s.contract === c) { game.finishContract(); renderContract(); } }, 2500);
  }
});

// ---------- rocket launch ----------
function openLaunch() {
  const gain = game.launchPreview();
  const totalAfter = (game.s.ep + gain) * EP_BONUS * 100;
  const w = game.world, next = game.nextWorld();
  const unlocks = next && !game.s.worlds[next.id];
  const r = def('rocket');
  openModal(`
    <div class="big-icon red">${ICON.rocket}</div>
    <h2>Launch?</h2>
    <p>Send one of your ${r.unit} up. Your town stays exactly as it is.${unlocks ? ` This launch takes you to <b>${next.name}</b>, where you start fresh with an Ore Mine and no money. Your money here stays here, and you can come back any time.` : ''}</p>
    <div class="stats">
      <div class="stat"><small>Engineering Points</small><b><em>+${gain}</em></b></div>
      <div class="stat"><small>Income bonus after</small><b>+${fmt(totalAfter)}%</b></div>
    </div>
    <p class="small">Points come from all the cash you've earned in every world. Each one adds ${EP_BONUS * 100}% income everywhere, forever.${w.perks.ep ? ' Low gravity here doubles them.' : ''}</p>
    ${gain >= 1 ? `<button class="btn gold" data-act="l2">${AD} Launch with 2× points (+${gain * 2})</button>` : ''}
    <button class="btn red" data-act="l1">Launch now</button>
    <button class="btn plain" data-act="dismiss">Not yet</button>`, async act => {
    let mult = 1;
    if (act === 'l2') { if (await watch('launch_double', 'double Engineering Points')) mult = 2; else { openLaunch(); return; } }
    if (act === 'l1' || act === 'l2') await doLaunch(mult);
  });
}

function rebuildTown() {
  world.select(null);
  world.clearDeliveries();
  world.setTheme(game.theme());
  syncBuilt();
  // every world after the first has the rocket you arrived in, parked outside town
  syncLander();
}
function syncLander() { world.setLander(game.s.current !== 'colorado' ? { model: def('rocket').model, color: def('rocket').color } : null); }

// fade the whole screen to black (true) or back from it (false)
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function fadeTo(black) { $('fade').classList.toggle('on', black); await sleep(850); }

let launching = false;
// Lift-off, the rocket climbs off the top of the screen, everything fades to black. In
// a new world it fades back in on the sky above the landing spot and the rocket comes
// down on its engine; otherwise it fades back to your town.
async function doLaunch(mult) {
  if (launching) return;
  launching = true;
  world.select(null);
  document.body.classList.add('launching');
  sfx.launch();
  await world.launchRocket();
  await fadeTo(true);
  world.endLaunch();
  const before = game.s.ep;
  const { gained, unlocked, from } = game.launch(mult);
  track('rocket_launched', { ep_gained: gained, launches: game.s.launches, doubled: mult === 2, world: from, unlocked: unlocked || '' });
  save();
  const nw = unlocked ? worldById(unlocked) : null;
  if (nw) {
    // the rocket takes you to the new world straight away; your old town stays saved
    if (game.travel(nw.id)) { track('world_travel', { to: nw.id }); rebuildTown(); showTown(); save(); }
    const landed = world.landRocket();
    await sleep(250);
    await fadeTo(false);
    await landed;
    world.focus(lotOf('mine'), { zoom: false });
    document.body.classList.remove('launching');
    launching = false;
    openModal(`
      <div class="big-icon red">${ICON.rocket}</div>
      <h2>Welcome to ${nw.name}!</h2>
      <p>A fresh start: an Ore Mine and an empty wallet. ${nw.perk}</p>
      <div class="stats">
        <div class="stat"><small>Engineering Points</small><b>${before} → <em>${game.s.ep}</em></b></div>
        <div class="stat"><small>Income bonus</small><b><em>+${fmt(game.s.ep * EP_BONUS * 100)}%</em></b></div>
      </div>
      <button class="btn green" data-act="start">Start building</button>
      <p class="small">${game.townName(from)} and its money are saved in ${worldById(from).short}, and it keeps earning. Go back any time with the map button.</p>`,
      () => tutorial.askName(nw.id), () => tutorial.askName(nw.id));
    return;
  }
  await sleep(250);
  await fadeTo(false);
  document.body.classList.remove('launching');
  launching = false;
  openModal(`
    <div class="big-icon red">${ICON.rocket}</div>
    <h2>Launch successful!</h2>
    <p>Your town is just as you left it, now with a bigger income bonus.</p>
    <div class="stats">
      <div class="stat"><small>Engineering Points</small><b>${before} → <em>${game.s.ep}</em></b></div>
      <div class="stat"><small>Income bonus</small><b><em>+${fmt(game.s.ep * EP_BONUS * 100)}%</em></b></div>
    </div>
    <button class="btn green" data-act="dismiss">Keep building</button>`);
}

// ---------- world map ----------
// little cartoon scenes for each world
// little cartoon globes, one for each world's land
const globe = (id, body, extra = '') => `<svg viewBox="0 0 48 48" width="46" height="46"><defs><clipPath id="g-${id}"><circle cx="24" cy="24" r="20"/></clipPath>
    <radialGradient id="s-${id}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient></defs>
    <g clip-path="url(#g-${id})">${body}</g><circle cx="24" cy="24" r="20" fill="url(#s-${id})"/><circle cx="24" cy="24" r="20" fill="none" stroke="rgba(0,0,0,.25)" stroke-width="1.5"/>${extra}</svg>`;
const WORLD_ART = {
  // green continents and blue sea, with snowy mountains and a pine forest
  colorado: globe('co', `<rect width="48" height="48" fill="#4aa3df"/>
    <path d="M6 14 Q14 6 24 9 Q30 11 28 18 Q34 20 33 27 Q30 33 22 31 Q16 36 10 31 Q4 26 6 20 Z" fill="#6fbf4a"/>
    <path d="M34 32 Q40 30 44 35 Q42 42 35 41 Q31 37 34 32 Z" fill="#6fbf4a"/>
    <path d="M12 22 L17 14 L22 22 Z" fill="#8a96a8"/><path d="M17 14 L15 17.5 L17 16.6 L19 17.5 Z" fill="#fff"/>
    <path d="M19 22 L23 16 L27 22 Z" fill="#7d8ea3"/><path d="M23 16 L21.6 18.4 L23 17.8 L24.4 18.4 Z" fill="#fff"/>
    <path d="M14 29 l2 -5 l2 5 Z M19 30 l2 -5 l2 5 Z M24 28 l2 -5 l2 5 Z" fill="#2f6f3e"/>`),
  // a sandy planet with dunes, cacti and a bright sun
  desert: globe('de', `<rect width="48" height="48" fill="#f2c178"/>
    <path d="M0 22 Q12 16 24 21 T48 19 V48 H0 Z" fill="#e5a75e"/><path d="M0 32 Q14 26 28 31 T48 30 V48 H0 Z" fill="#d48c45"/>
    <path d="M14 26 v-7 a1.6 1.6 0 0 1 3.2 0 v7 Z M14 23 h-2 a1 1 0 0 1 -1 -1 v-2 a.9.9 0 0 1 1.8 0 v1.4 h1.2 Z" fill="#3f7a35"/>
    <path d="M31 33 v-6 a1.4 1.4 0 0 1 2.8 0 v6 Z M33.8 30 h1.6 v-2 a.9.9 0 0 1 1.8 0 v2.4 a1 1 0 0 1 -1 1 h-2.4 Z" fill="#3f7a35"/>
    <circle cx="33" cy="12" r="4" fill="#fff4b8"/>`),
  // grey and cratered, with a little flag planted on top
  moon: globe('mo', `<rect width="48" height="48" fill="#b7b7c0"/>
    <circle cx="15" cy="16" r="5" fill="#9b9ba6"/><circle cx="15.8" cy="16.8" r="3.6" fill="#a9a9b3"/>
    <circle cx="31" cy="29" r="7" fill="#9b9ba6"/><circle cx="32" cy="30" r="5.2" fill="#a9a9b3"/>
    <circle cx="13" cy="33" r="3" fill="#9b9ba6"/><circle cx="33" cy="13" r="2.4" fill="#9b9ba6"/><circle cx="24" cy="40" r="2" fill="#9b9ba6"/>`,
    `<rect x="23.3" y="1" width="1.4" height="6" fill="#e8e8ee"/><path d="M24.7 1 h6 v3.6 h-6 Z" fill="#e85a3c"/>`),
  // rusty red, a canyon, a frosty cap and a green greenhouse dome
  mars: globe('ma', `<rect width="48" height="48" fill="#b8492c"/>
    <path d="M0 6 Q24 0 48 6 V11 Q24 6 0 11 Z" fill="#f4ece6"/>
    <path d="M4 26 Q16 22 26 27 T46 24" stroke="#6e2416" stroke-width="3" fill="none" stroke-linecap="round"/>
    <circle cx="13" cy="36" r="4" fill="#8f3520"/><circle cx="36" cy="16" r="3" fill="#8f3520"/>
    <path d="M28 40 a6 6 0 0 1 12 0 Z" fill="#9cf08a"/><path d="M28 40 a6 6 0 0 1 12 0" stroke="#fff" stroke-width="1" fill="none"/>`),
};
function openMap() {
  sfx.tap();
  // only the worlds you've reached; later ones stay a surprise
  const cards = WORLDS.filter(w => game.s.worlds[w.id]).map(w => {
    const here = w.id === game.s.current;
    const status = here ? '<span class="w-here">Here</span>' : `<button class="btn small green" data-act="travel" data-world="${w.id}">Travel</button>`;
    return `<div class="w-card ${here ? 'here' : ''} w-${w.id}">
      <span class="w-swatch" aria-hidden="true">${WORLD_ART[w.id] || ''}</span>
      <span class="w-info"><b>${game.townName(w.id)}</b><small>${w.name} · $${fmt(game.cashIn(w.id))} in the bank</small></span>
      ${status}
    </div>`;
  }).join('');
  openModal(`
    <div class="big-icon">${ICON.globe}</div>
    <h2>Your worlds</h2>
    <p class="small">Each world keeps its own money. Travel back any time.</p>
    <div class="w-list">${cards}</div>
    <button class="btn plain" data-act="dismiss">Close</button>`, act => {});
  // travel buttons live inside the modal
}
modal.addEventListener('click', e => {
  const b = e.target.closest('[data-act="travel"]');
  if (b) { e.stopPropagation(); closeModal(false); doTravel(b.dataset.world); }
}, true);

async function doTravel(id, quiet = false) {
  if ((launching && !quiet) || id === game.s.current) return;
  const flash = $('flash');
  flash.hidden = false;
  await new Promise(r => setTimeout(r, 350));
  const res = game.travel(id);
  if (!res) { flash.hidden = true; return; }
  track('world_travel', { to: id });
  rebuildTown();
  save();
  setTimeout(() => { flash.hidden = true; }, 600);
  showTown();
  if (!quiet) toast(`Welcome to ${game.townName()}`);
}
$('map-btn').addEventListener('click', openMap);

$('launch-btn').addEventListener('click', () => { sfx.tap(); openLaunch(); });

// ---------- daily reward ----------
function maybeDaily() {
  if (!game.dailyAvailable()) return;
  const { streak, amount } = game.dailyPreview();
  const days = Array.from({ length: 7 }, (_, i) => `<span class="day ${i < streak ? 'got' : ''}">${i + 1}</span>`).join('');
  openModal(`
    <div class="big-icon">${ICON.gift}</div>
    <h2>Daily delivery</h2>
    <p>Come back every day for a bigger delivery. Day ${streak} of 7.</p>
    <div class="days" aria-label="Day ${streak} of 7">${days}</div>
    <div class="big-num">$${fmt(amount)}</div>
    <button class="btn gold" data-act="d2">${AD} Collect 2× · $${fmt(amount * 2)}</button>
    <button class="btn plain" data-act="d1">Collect $${fmt(amount)}</button>`, async act => {
    let mult = 1;
    if (act === 'd2') { if (await watch('daily_double', 'double daily delivery')) mult = 2; else { maybeDaily(); return; } }
    const got = game.claimDaily(mult);
    track('daily_claimed', { streak, doubled: mult === 2 });
    sfx.reward(); toast(`+$${fmt(got)}`);
  }, () => { const got = game.claimDaily(1); track('daily_claimed', { streak, doubled: false }); toast(`+$${fmt(got)}`); });
}

// ---------- menu: achievements, worlds, settings ----------
let seenAch = 0;
const achCount = () => Object.keys(game.s.achievements || {}).length;
function openMenu() {
  sfx.tap();
  const n = achCount(), fresh = n > seenAch;
  openModal(`
    <h2>Menu</h2>
    <div class="menu-list">
      <button class="menu-row" data-act="shop"><span class="m-ic gold">$</span><span class="m-t"><b>Shop</b><small>Get more cash</small></span>${ICON.chev}</button>
      <button class="menu-row" data-act="ach"><span class="m-ic gold">${ICON.trophy}</span><span class="m-t"><b>Achievements</b><small>${n} of ${ACHIEVEMENTS.length} earned</small></span>${fresh ? '<span class="m-new">New</span>' : ''}${ICON.chev}</button>
      ${game.unlockedWorlds().length > 1 ? `<button class="menu-row" data-act="worlds"><span class="m-ic blue">${ICON.map}</span><span class="m-t"><b>Your worlds</b><small>You're in ${game.world.short}</small></span>${ICON.chev}</button>` : ''}
      <button class="menu-row" data-act="settings"><span class="m-ic">${ICON.gear}</span><span class="m-t"><b>Settings</b><small>Sound, stats, start over</small></span>${ICON.chev}</button>
    </div>
    <button class="btn plain" data-act="dismiss">Close</button>`, act => {
    if (act === 'shop') openShop();
    if (act === 'ach') openAchievements();
    if (act === 'worlds') openMap();
    if (act === 'settings') openSettings();
  });
}
// ---------- shop ----------
// Placeholder in-app purchases: priced like the real ones will be, but free while
// testing, so you can move through the game quickly. Each pack is worth a stretch of
// your current income (with a floor, so they still matter early on).
const PACKS = [
  { id: 'cash_s', name: 'Handful of cash', price: '$0.99', minutes: 15, floor: 1e3, icon: '$' },
  { id: 'cash_m', name: 'Bag of cash', price: '$4.99', minutes: 120, floor: 2.5e4, icon: '$$' },
  { id: 'cash_l', name: 'Vault of cash', price: '$9.99', minutes: 480, floor: 2.5e5, icon: '$$$', best: true },
  { id: 'cash_xl', name: 'Bank of cash', price: '$19.99', minutes: 1440, floor: 2.5e6, icon: '$$$$' },
];
const packAmount = k => Math.max(k.floor, game.totalRate() * 60 * k.minutes);
function openShop() {
  sfx.tap();
  const rows = PACKS.map(k => `<button class="shop-row" data-act="buy" data-pack="${k.id}">
      <span class="s-ic">${k.icon}</span>
      <span class="s-t"><b>${k.name}${k.best ? '<span class="shop-best">BEST</span>' : ''}</b><small>+$${fmt(packAmount(k))}</small></span>
      <span class="s-price"><s>${k.price}</s><b>Free</b></span>
    </button>`).join('');
  openModal(`
    <div class="big-icon">${ICON.gift}</div>
    <h2>Shop</h2>
    <p class="small">Free while the game is being tested.</p>
    <div class="shop-list">${rows}</div>
    <button class="btn plain" data-act="dismiss">Close</button>`, () => {});
}
modal.addEventListener('click', e => {
  const b = e.target.closest('[data-act="buy"]');
  if (!b) return;
  e.stopPropagation();
  const k = PACKS.find(p => p.id === b.dataset.pack);
  const amount = packAmount(k);
  game.addCash(amount); sfx.reward(); toast(`+$${fmt(amount)}`);
  track('iap_placeholder', { pack: k.id });
  closeModal(false);
}, true);
$('shop-btn').addEventListener('click', e => { e.stopPropagation(); openShop(); });

function openAchievements() {
  seenAch = achCount(); $('menu-dot').hidden = true;
  const got = game.s.achievements || {};
  const list = [...ACHIEVEMENTS].sort((a, b) => (got[b.id] ? 1 : 0) - (got[a.id] ? 1 : 0)).map(a => `
    <div class="ach ${got[a.id] ? 'got' : ''}">
      <span class="a-ic">${ICON.trophy}</span>
      <span class="a-t"><b>${a.name}</b><small>${a.desc}</small></span>
    </div>`).join('');
  openModal(`
    <h2>Achievements</h2>
    <p class="small">${achCount()} of ${ACHIEVEMENTS.length} earned</p>
    <div class="ach-list">${list}</div>
    <button class="btn plain" data-act="back">Back</button>`, act => { if (act === 'back') openMenu(); });
}
function openSettings() {
  openModal(`
    <h2>Settings</h2>
    <button class="btn plain toggle" data-act="rename">Town name: <b>${game.townName()}</b></button>
    <button class="btn plain toggle" data-act="sound" aria-pressed="${game.s.settings.sound}">Sound and vibration: <b>${game.s.settings.sound ? 'On' : 'Off'}</b></button>
    <button class="btn plain toggle" data-act="gfx" aria-pressed="${world.look.quality === 'high'}">Graphics: <b>${world.look.quality === 'high' ? 'High' : 'Battery saver'}</b></button>
    <button class="btn plain toggle" data-act="style">Look: <b>${{ plain: 'Standard', mini: 'Miniature', ink: 'Illustrated' }[world.look.style || 'plain']}</b></button>
    <button class="btn plain toggle" data-act="daynight" aria-pressed="${game.s.settings.daynight !== false}">Day and night: <b>${game.s.settings.daynight !== false ? 'On' : 'Off'}</b></button>
    <p>Rockets launched: <b>${game.s.launches}</b> · Engineering Points: <b>${game.s.ep}</b><br>Orders filled: <b>${game.s.contractsDone}</b> · Total earned: <b>$${fmt(game.s.totalEarned)}</b></p>
    <p class="small">${ads.isSimulated ? 'Browser version: ads are simulated.' : 'Ads by Google AdMob.'} The game sends anonymous play stats (no names or contact info) so we can improve it.</p>
    <button class="btn danger" data-act="reset-ask">Start over</button>
    <button class="btn plain" data-act="back">Back</button>`, async act => {
    if (act === 'back') openMenu();
    if (act === 'rename') tutorial.askName(game.s.current, openSettings);
    if (act === 'sound') {
      game.s.settings.sound = !game.s.settings.sound;
      sfx.setEnabled(game.s.settings.sound);
      save();
      openSettings();
    }
    if (act === 'gfx') {
      game.s.settings.graphics = world.look.quality === 'high' ? 'low' : 'high';
      world.look.setQuality(game.s.settings.graphics);
      track('graphics_changed', { to: game.s.settings.graphics });
      save(); openSettings();
    }
    if (act === 'style') {
      const order = ['plain', 'mini', 'ink'], next = order[(order.indexOf(world.look.style || 'plain') + 1) % 3];
      game.s.settings.style = next; world.look.setStyle(next);
      if (next !== 'plain' && world.look.quality !== 'high') toast('Turn Graphics to High to see this look');
      track('style_changed', { to: next }); openSettings(); return;
    }
    if (act === 'daynight') {
      game.s.settings.daynight = game.s.settings.daynight === false;
      world.look.cycle = game.s.settings.daynight;
      save(); openSettings();
    }
    if (act === 'reset-ask') {
      openModal(`<h2>Start over?</h2><p>This wipes every town, your rockets, achievements and Engineering Points. It can’t be undone.</p>
        <button class="btn danger" data-act="reset-yes">Yes, start over</button>
        <button class="btn plain" data-act="dismiss">Keep my town</button>`, async a => {
        if (a === 'reset-yes') { world.select(null); await game.reset(); world.clearDeliveries(); world.themeName = null; world.setTheme(game.theme()); syncBuilt(); syncLander(); seenAch = 0; track('reset'); showTown(); tutorial.start(); }
      });
    }
  });
}
$('menu-btn').addEventListener('click', openMenu);

function achievementTick(silent = false) {
  const fresh = checkAchievements(game);
  if (silent) { seenAch = achCount(); return; }
  if (!fresh.length) return;
  for (const a of fresh) track('achievement', { id: a.id });
  sfx.milestone();
  toast(fresh.length > 1 ? `${fresh.length} achievements earned!` : `Achievement: ${fresh[0].name}`);
  $('menu-dot').hidden = false;
  save();
}

// ---------- offline earnings ----------
// While you're away, managers leave what they collect at headquarters (up to its limit),
// and you go there to pick it up. The welcome-back bubble points you to it.
function welcomeBack() {
  const seconds = game.offlineSeconds();
  game.s.lastSeen = Date.now();
  if (seconds < 60) return;
  const byWorld = game.applyOffline(seconds);
  const others = Object.entries(byWorld).filter(([w, v]) => w !== game.s.current && v >= 1);
  if (game.vault() >= 1 && game.built('hq')) { pendingVaultTip = true; return; }
  if (others.length) toast(`Managers in ${others.map(([w]) => worldById(w).short).join(' and ')} left money at headquarters there`);
  else if (Object.keys(game.s.worlds).some(w => FACTORIES.some(f => (game.s.worlds[w].bins[f.id] || 0) > 0)))
    toast(`Your factories filled up while you were away. Tap their coins to collect!`);
}
// shown once nothing else is on screen (pop-ups from the start, the daily gift...)
let pendingVaultTip = false;
function vaultTip() {
  if (!pendingVaultTip || current || launching) return;
  pendingVaultTip = false;
  if (game.vault() < 1) return;
  tutorial.tip({
    say: () => `Welcome back! Your managers collected <b>$${fmt(game.vault())}</b> while you were away. Collect it at your <b>${def('hq').name}</b>.`,
    lot: lotOf('hq'),
    done: () => game.vault() < 1,
    hold: () => world.selected === lotOf('hq'),
  });
}
// the first time a headquarters opens in your first town
function hqIntro(id) {
  const tips = game.s.tutorial.tips ||= {};
  if (game.typeOf(id) !== 'hq' || tips.hq || game.s.current !== 'colorado') return;
  if (!tutorial.tip({ say: `Your <b>${def('hq').name}</b> is open! <b>Hire managers</b> to collect money for you, even while you're away.`, lot: lotOf('hq'), done: () => game.staff() > 0 || world.selected === lotOf('hq') })) return;
  tips.hq = true;
  track('tip', { id: 'hq' });
  save();
}

// ---------- the short opening tutorial (see tutorial.js) ----------
const showTown = () => { $('town').textContent = game.townName(); };
const tutorial = createTutorial({ game, world, openModal, sfx, save, onRename: showTown });
// ---------- tutorial hints ----------
// the order new buildings unlock in
// the order new buildings unlock in. The headquarters unlocks alongside the Bolt Press
// (once the furnace is up) and stays on offer without holding up the rest of the line.
const LINEAGE = ['mine', 'furnace', 'press', 'gear', 'engine', 'power', 'datacenter', 'turbine', 'rocket'];
const nextSet = () => {
  const out = [], nxt = LINEAGE.find(t => !game.built(t));
  if (nxt) out.push(nxt);
  if (!game.built('hq') && game.built('furnace')) out.push('hq');
  return out;
};
const nextInLine = () => LINEAGE.find(t => !game.built(t)) || null;
const emptyLot = () => plotIds(game.s.current).find(p => game.developed(p) && !slotAt(p));
// the spot where a + is showing right now (if any), and the hint that goes with it
const plusLot = () => plotIds(game.s.current).find(p => !slotAt(p) && labelFor(p).cls === 'bub plus');
const plusHint = () => { const p = plusLot(); return p ? (game.developed(p) ? `Tap the + to build your ${def(lotType(p)).name}` : `Tap the + to clear the spot for your ${def(lotType(p)).name}`) : ''; };
function hintText() {
  // a brand-new town on a new world: nothing here yet
  if (!game.built('mine')) {
    if (!Object.keys(game.run.land).length) return 'Tap the land with a + to start your town';
    return emptyLot() ? `Tap your cleared lot and build a ${def('mine').name}` : '';
  }
  if (game.s.launches === 0 && !game.s.tutorial.done) {
    const t = game.s.tutorial;
    if (!t.collected) return game.bin('mine') >= 1 ? `Tap the coin to collect your ${def('mine').name}\u2019s money` : `Your ${def('mine').name} is working\u2026`;
    if (!t.opened) return `Tap the ${def('mine').name} building to see upgrades`;
    if (!t.upgraded) return `Upgrade the ${def('mine').name} to make more ${def('mine').unit}`;
    if (!game.built('furnace')) {
      return plusHint() || `Save $${fmtCost(game.developed('q1') ? def('furnace').unlock : game.developQuote('q1').total)} for a ${def('furnace').name}`;
    }
    if (game.info('furnace').starved && game.level('furnace') > 1) return `The ${def('furnace').name} is short on ${def('mine').unit}. Upgrade the ${def('mine').name}!`;
    if (!game.built('press')) return game.canAfford(def('press').unlock) ? `Build a ${def('press').name} next` : `Trucks carry ${def('mine').unit} to the ${def('furnace').name}. Keep the ${def('mine').name} ahead!`;
    if (game.s.contract && game.s.contractsDone === 0) return 'Fill the order at the top for a big bonus';
    if (game.s.contractsDone > 0 || game.built('engine')) { t.done = true; track('tutorial_step', { step: 'done' }); }
    return '';
  }
  const full = FACTORIES.find(f => game.built(f.id) && !game.hasManager(f.id) && game.binFull(f.id) && game.earnRate(f.id) > 0);
  if (full) return `Your ${def(full.id).name} is full. Tap its coin to collect!`;
  if (!game.built('hq') && game.built('furnace') && game.canAfford(def('hq').unlock)) return `Build a ${def('hq').name} to hire managers`;
  if (game.built('hq') && game.staff() === 0 && game.canAfford(game.nextHireCost())) return `Hire a manager at your ${def('hq').name}`;
  if (game.freeManagers() > 0 && FACTORIES.some(f => game.built(f.id) && !game.hasManager(f.id))) return `A manager is waiting at your ${def('hq').name} for a job`;
  if (game.built('rocket') && !game.canLaunch()) {
    const r = def('rocket'), p = def('turbine');
    return game.typeInfo('rocket')?.made > 0 ? `Your ${r.name} is putting a rocket together from ${p.unit}: ${Math.floor(game.run.rocketsBuilt * 100)}%` : `Your ${r.name} needs ${p.unit} from a ${p.name} to build a rocket`;
  }
  const nl = nextInLine(), nextF = nl ? { id: nl } : null;
  if (plusHint()) return plusHint();
  if (nl === 'power' && game.canAfford(def('power').unlock)) return `New: a ${def('power').name} and ${def('datacenter').name} speed up every factory`;
  if (game.built('power') && !game.built('datacenter') && game.canAfford(def('datacenter').unlock)) return `Build the ${def('datacenter').name} to turn power into speed`;
  return '';
}

// ---------- events from the game ----------
const popAcc = {};
const popT = {};
game.on('built', id => {
  world.setBuilt(lotOf(id), true, def(id));
  world.setWork(lotOf(id), game.jobOf(id)?.kind || null);
  sfx.build();
  track('factory_built', { factory: id, launches: game.s.launches });
});
// managers drive to work (and back) by car
game.on('manager', id => world.sendManager(lotOf('hq'), lotOf(id)));
game.on('recall', id => world.sendManager(lotOf(id), lotOf('hq')));
game.on('constructed', id => {
  world.setWork(lotOf(id), null); world.bounce(lotOf(id));
  sfx.milestone();
  if (game.typeOf(id) === 'hq' && !game.s.tutorial.tips?.hq && game.s.current === 'colorado') hqIntro(id);
  else toast(`${def(id).name} is open for business!`);
});
game.on('upgrade', (id, before, after) => {
  world.setWork(lotOf(id), null);
  world.setGrowth(lotOf(id), lookTier(after));
  const crossed = MILESTONES.filter(m => before < m && after >= m);
  if (game.typeOf(id) === 'hq') { sfx.upgrade(); if (crossed.length) toast(`${def(id).name} level ${crossed[crossed.length - 1]}: a bigger office!`); return; }
  if (crossed.length) {
    const m = crossed[crossed.length - 1];
    sfx.milestone();
    toast(`${def(id).name} level ${m}: ${lookText(game.typeOf(id), m)} and 2× output!`);
    track('milestone', { factory: id, level: m });
  } else sfx.upgrade();
});

function syncBuilt() {
  for (const lot of plotIds(game.s.current)) {
    const id = slotAt(lot);
    world.setLand(lot, game.developed(lot));
    world.setBuilt(lot, !!id, id ? def(id) : null);
    world.setGrowth(lot, id ? lookTier(game.level(id)) : 0);
    world.setWork(lot, id ? game.jobOf(id)?.kind || null : null);
  }
}
game.on('developed', lot => world.setLand(lot, true));
game.on('demolished', (lot, type, promoted) => { world.clearDeliveries(); syncBuilt(); world.bounce(lot); });
game.on('roads', () => world.roadsChanged());

// ---------- save ----------
let saving = false;
async function save() { if (saving) return; saving = true; await game.save(); saving = false; }
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { save(); flush(); }
  else { welcomeBack(); maybeDaily(); dayCheck(); }
});
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => { if (!isActive) save(); });
    App.addListener('backButton', () => {
      if (current) closeModal(true);
      else if (world.selected) world.select(null);
      else App.minimizeApp();
    });
  });
}

// one "app_open" per calendar day the game is opened, with days since first play
function dayCheck() {
  const t = game.today();
  const already = game.s.playDays.includes(t);
  game.markPlayDay();
  const first = new Date(game.s.firstSeen); first.setHours(0, 0, 0, 0);
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const day = Math.round((now - first) / 86400000);
  track('app_open', { day_number: day, first_open_today: !already, launches: game.s.launches, ep: game.s.ep, factories: ALL.filter(f => game.built(f.id)).length });
}

// ---------- main loop ----------
let last = performance.now(), uiT = 0, hintCache = null, achT = 1;
// On the first run, watch the frame rate for a few seconds. If the phone struggles
// with the full effects, switch to battery saver for it (the player can change it).
let perf = { start: 0, frames: 0, done: false };
function perfCheck(now, dt) {
  if (perf.done) return;
  if ((game.s.settings.graphics || 'auto') !== 'auto' || document.hidden) { perf.done = true; return; }
  if (!perf.start) { perf.start = now + 1500; return; }   // skip start-up hitches
  if (now < perf.start) return;
  perf.frames++;
  const secs = (now - perf.start) / 1000;
  if (secs >= 5) {
    perf.done = true;
    const fps = perf.frames / secs;
    game.s.settings.graphics = fps < 38 ? 'low' : 'high';
    if (fps < 38) world.look.setQuality('low');
    track('graphics_auto', { fps: Math.round(fps), chose: game.s.settings.graphics });
  }
}
function loop(now) {
  // clamp: some browsers hand back an older frame time (e.g. after waking), never run time backwards
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = Math.max(last, now);
  if (!launching) game.tick(dt);
  perfCheck(now, dt);
  { const fl = game.baseFlow(); world.setFlow(fl.per, fl.support); world.setPowerLine(game.built('power') && game.built('datacenter'), fl.support.power.util); }
  world.frame(dt, labelFor);
  vaultTip();
  tutorial.frame(!!current);
  $('cash').textContent = '$' + (game.cash < 1000 ? Math.floor(game.cash) : fmt(game.cash));
  $('rate').textContent = `+$${fmt(game.rate())} per sec${game.boostLeft() > 0 ? ' · ×2' : ''}`;
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.2;
    const left = game.boostLeft();
    const bb = $('boost-btn');
    bb.classList.toggle('on', left > 0);
    $('boost-text').textContent = left > 0 ? fmtTime(left) : '×2';
    bb.setAttribute('aria-label', left > 0 ? `Double earnings active, ${fmtTime(left)} left. Watch an ad to add more.` : 'Watch an ad for double earnings');
    document.body.classList.toggle('has-ep', game.s.ep > 0);
    if (game.s.ep > 0) { $('ep').hidden = false; $('ep').textContent = `+${fmt(game.s.ep * EP_BONUS * 100)}% · ${game.s.ep} EP`; }
    else $('ep').hidden = true;
    world.setRocketReady(game.canLaunch(), game.run.rocketsBuilt % 1);
    const mb = $('map-btn'); const wl = game.unlockedWorlds().length;
    mb.hidden = wl < 2; mb.setAttribute('aria-label', `Your worlds (now in ${game.world.short})`);
    const nxt = game.nextWorld();
    const showLaunch = game.canLaunch() && (game.launchPreview() >= 1 || (nxt && !game.s.worlds[nxt.id])) && !world.selected && !launching;
    $('launch-btn').hidden = !showLaunch;
    const h = world.selected || showLaunch || tutorial.active || tutorial.tipping ? '' : hintText();
    if (h !== hintCache) { hintCache = h; $('hint').textContent = h; $('hint').hidden = !h; }
    renderContract();
    if (!sheet.hidden) renderSheet();
    if ((achT -= 0.2) <= 0) { achT = 1; achievementTick(); }
  }
  requestAnimationFrame(loop);
}

const step = s => { try { console.log('[boot] ' + s); } catch {} };
(async function start() {
  step('loading save');
  await withTimeout(game.load(), 4000, 'loading the save');
  initAnalytics(game.s.playerId);
  sfx.setEnabled(game.s.settings.sound);
  step('building town');
  // graphics: High unless the player chose otherwise (an automatic check below may lower it)
  const gfx = game.s.settings.graphics || 'auto';
  world.look.setQuality(gfx === 'low' ? 'low' : 'high');
  world.look.cycle = game.s.settings.daynight !== false;
  { const st = new URLSearchParams(location.search).get('style'); world.look.setStyle(st || game.s.settings.style || 'plain'); }
  world.setSeed([...game.s.playerId].reduce((h, c) => (h * 33 + c.charCodeAt(0)) >>> 0, 5381));
  world.setTheme(game.theme());
  syncBuilt();
  syncLander();
  const brandNew = game.s.totalEarned === 0 && !game.s.playDays.length;
  // no daily gift on the very first day; it starts tomorrow
  if (brandNew) { game.s.daily = { lastDay: game.today(), streak: 0 }; track('first_open'); }
  world.ready = true;
  achievementTick(true);   // anything already done counts quietly
  if (game.rebalanced) openModal(`<div class="big-icon">${ICON.factory}</div><h2>Big update!</h2><p>Upgrades are now bigger steps: each one costs more but makes a real difference, and buildings grow as you upgrade them. Your towns were converted to the new levels.</p><button class="btn green" data-act="dismiss">Let's go</button>`);
  if (game.walletsSplit) openModal(`<div class="big-icon">${ICON.globe}</div><h2>A wallet for each world</h2><p>Money now stays in the world it was made in, and every world has the same prices. Your money is in ${game.world.short}; your other worlds keep everything you built and start their wallets at $0. You can travel back and forth any time.</p><button class="btn green" data-act="dismiss">Let's go</button>`);
  if (game.relevelled4) openModal(`<div class="big-icon">${ICON.factory}</div><h2>Upgrades are instant again</h2><p>No more waiting, and no level limit. Buildings get a new look and 2× output at levels 5, 10, 25, 50, 100 and 250. Your buildings moved to the matching new levels.</p><button class="btn green" data-act="dismiss">Let's go</button>`);
  else if (game.relaidOut) openModal(`<div class="big-icon">${ICON.globe}</div><h2>A tidier town plan</h2><p>Every world now has the same plan: a 3×3 grid with one spot for each factory, and the headquarters beside the Ore Mine. Your buildings moved to their spots and kept their levels. Where you had extra copies, the best one was kept.</p><button class="btn green" data-act="dismiss">Let's go</button>`);
  welcomeBack();
  maybeDaily();
  dayCheck();
  showTown();
  tutorial.start();
  step('starting loop');
  ads.init();
  requestAnimationFrame(loop);
})().catch(e => window.__bootError?.('Start failed: ' + (e.stack || e.message || e)));

function withTimeout(p, ms, what) {
  let t;
  const timer = new Promise(r => { t = setTimeout(() => { window.__bootError?.(`Timed out ${what}; starting fresh`); r(null); }, ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}
