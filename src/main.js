import './style.css';
import { Capacitor } from '@capacitor/core';
import {
  FACTORIES, ALL, SUPPORT, isSupport, speedFromCompute, capacity, FACTS, MILESTONES, fmt, fmtCost, fmtRate, fmtTime, upgradeCost, maxAffordable,
  nextMilestone, milestoneCount, EP_BONUS, epForRun, themeFor, THEME_NAMES,
} from './economy.js';
import { Game } from './state.js';
import { World } from './world.js';
import { ads } from './ads.js';
import { sfx } from './sound.js';
import { initAnalytics, track, flush } from './analytics.js';
import { GAME } from './config.js';

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
const def = id => ALL.find(f => f.id === id);
if (location.search.includes('debug')) Object.assign(window, { __game: game, __world: world });
const idx = id => FACTORIES.findIndex(f => f.id === id);
const hex = n => '#' + n.toString(16).padStart(6, '0');
const tint = d => hex(d.color === 0xe8e4da ? 0x8a8f99 : d.color);
const AD = '<span class="ad-tag">AD</span>';

const ICON = {
  factory: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V10l5 3V10l5 3V6l8 4v11z"/></svg>',
  plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  bolt: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  moon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
  rocket: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c3 2.5 4.5 6 4.5 10v5h-9v-5C7.5 8 9 4.5 12 2z"/><circle cx="12" cy="10" r="1.8"/><path d="M7.5 14 4.5 17v3h3M16.5 14l3 3v3h-3M10 20.5c.5 1 1.2 1.5 2 1.5s1.5-.5 2-1.5"/></svg>',
  gift: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="9" width="18" height="12" rx="1.5"/><path d="M2 9h20v-3H2zM12 6v15M12 6C10 2 6.5 2.5 7 5c.3 1.3 3 1 5 1zm0 0c2-4 5.5-3.5 5-1-.3 1.3-3 1-5 1z"/></svg>',
  chip: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/></svg>',
  clip: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>',
};

// ---------- labels above lots ----------
const pctSpeed = () => Math.round((game.baseFlow().speed - 1) * 100);
function supportLabel(id, d, lv) {
  const f = game.info(id);
  const canUp = game.canAfford(upgradeCost(d, lv, 1));
  const stars = milestoneCount(lv);
  let sub = '', starved = false;
  if (id === 'power') sub = `${fmtRate(f.made)} MW`;
  else { starved = f.starved; sub = starved ? 'Short on power' : `+${pctSpeed()}% speed`; }
  return {
    cls: 'support' + (starved ? ' starved' : ''),
    html: `<span class="lv" style="background:${tint(d)}">${lv}</span><span class="name">${d.name}${stars ? `<span class="stars" aria-hidden="true">${'\u2605'.repeat(Math.min(stars, 5))}</span>` : ''}<span class="${starved ? 'need' : 'perk'}">${sub}</span><span class="bar"><i></i></span></span>${canUp ? `<span class="up">${ICON.up}</span>` : ''}`,
    progress: f.util,
    aria: `${d.name}, level ${lv}, ${sub}${canUp ? ', upgrade available' : ''}`,
  };
}

function labelFor(id) {
  const d = def(id), lv = game.level(id);
  if (lv > 0 && isSupport(id)) return supportLabel(id, d, lv);
  if (lv > 0) {
    const f = game.info(id);
    const canUp = game.canAfford(upgradeCost(d, lv, 1));
    const stars = milestoneCount(lv);
    const prev = idx(id) > 0 ? FACTORIES[idx(id) - 1] : null;
    const starved = f.starved;
    const needTxt = starved ? (prev && game.built(prev.id) ? `Short on ${prev.unit}` : `Needs ${prev.unit}`) : '';
    return {
      cls: starved ? 'starved' : '',
      html: `<span class="lv" style="background:${tint(d)}">${lv}</span><span class="name">${d.name}${stars ? `<span class="stars" aria-hidden="true">${'★'.repeat(Math.min(stars, 5))}</span>` : ''}${starved ? `<span class="need">${needTxt}</span>` : ''}<span class="bar"><i></i></span></span>${canUp ? `<span class="up">${ICON.up}</span>` : ''}`,
      progress: f.util,
      aria: `${d.name}, level ${lv}${starved ? ', ' + needTxt : ''}${canUp ? ', upgrade available' : ''}`,
    };
  }
  const ok = game.canAfford(d.unlock);
  return { cls: 'lot' + (ok ? ' ok' : ''), html: `Build · $${fmtCost(d.unlock)}`, progress: 0, aria: `Empty lot. Build ${d.name} for $${fmtCost(d.unlock)}` };
}

// ---------- bottom sheet ----------
let buyMode = 1;
const sheet = $('sheet');
let sheetKey = '';
const buyCount = (d, lv) => buyMode === 'max' ? Math.max(1, maxAffordable(d, lv, game.s.run.cash)) : buyMode;

function supplyBlock(d) {
  const i = idx(d.id);
  const f = game.info(d.id);
  const prev = i > 0 ? FACTORIES[i - 1] : null;
  const next = FACTORIES[i + 1];
  let html = '';
  if (prev) {
    const needed = f.cap * d.need;
    const pf = game.info(prev.id);
    if (!game.built(prev.id)) {
      html += `<div class="supply warn"><b>Needs ${prev.unit}.</b> Build a ${prev.name} to supply it.<button class="link" data-goto="${prev.id}">Show me</button></div>`;
    } else if (f.starved) {
      html += `<div class="supply warn"><b>Short on ${prev.unit}: running at ${Math.round(f.util * 100)}%.</b> It needs ${fmtRate(needed)} ${prev.unit}/s but gets ${fmtRate(pf.made)}/s. Upgrade the ${prev.name}.<button class="link" data-goto="${prev.id}">Go to ${prev.name}</button></div>`;
    } else {
      html += `<div class="supply ok"><b>Fully supplied.</b> Uses ${d.need} ${prev.unit} for each ${d.unit.replace(/s$/, '')}.</div>`;
    }
  }
  if (next && game.built(next.id) && f.surplus > 0.15 && f.made > 0) {
    html += `<div class="supply info">${Math.round(f.surplus * 100)}% of your ${d.unit} ${d.unit.endsWith('s') ? 'are' : 'is'} piling up in the yard. Upgrade the ${next.name} to use it.<button class="link" data-goto="${next.id}">Go to ${next.name}</button></div>`;
  }
  return html;
}

function supportBlock(d, lv) {
  const fl = game.baseFlow();
  const pw = fl.support.power, dc = fl.support.datacenter;
  const dcDef = SUPPORT[1];
  if (d.id === 'power') {
    if (!game.built('datacenter')) return `<div class="supply info">Electricity is used by a Data Center, which speeds up every factory. Build one next.<button class="link" data-goto="datacenter">Show me</button></div>`;
    const spare = pw.made - pw.used;
    return spare > 0.01
      ? `<div class="supply ok"><b>The Data Center uses ${fmtRate(pw.used)} of ${fmtRate(pw.made)} MW.</b> Upgrade the Data Center to use the spare power.<button class="link" data-goto="datacenter">Go to Data Center</button></div>`
      : `<div class="supply warn"><b>All ${fmtRate(pw.made)} MW is in use.</b> The Data Center wants ${fmtRate(dc.cap * dcDef.need)} MW. More power means more compute.</div>`;
  }
  if (!game.built('power')) return `<div class="supply warn"><b>No power.</b> Build a Power Plant to run the servers.<button class="link" data-goto="power">Show me</button></div>`;
  if (dc.starved) return `<div class="supply warn"><b>Short on power: running at ${Math.round(dc.util * 100)}%.</b> Needs ${fmtRate(dc.cap * dcDef.need)} MW but gets ${fmtRate(pw.made)} MW. Upgrade the Power Plant.<button class="link" data-goto="power">Go to Power Plant</button></div>`;
  return `<div class="supply ok"><b>Fully powered.</b> Uses ${dcDef.need} MW for each PFLOPS of compute.</div>`;
}

function renderSupportSheet(d, lv) {
  const n = buyCount(d, lv);
  const cost = upgradeCost(d, lv, n);
  const afford = game.canAfford(cost);
  const short = cost - game.s.run.cash;
  const fl = game.baseFlow();
  const f = game.info(d.id);
  const nm = nextMilestone(lv);
  const prevM = [...MILESTONES].reverse().find(m => m <= lv) ?? 0;
  const pct = nm ? ((lv - prevM) / (nm - prevM)) * 100 : 100;
  // what the next purchase would do to factory speed
  const nextLevels = { ...game.levels, [d.id]: lv + n };
  const pw2 = capacity(SUPPORT[0], nextLevels.power), dc2 = capacity(SUPPORT[1], nextLevels.datacenter);
  const nextSpeed = Math.round((speedFromCompute(Math.min(dc2, pw2 / SUPPORT[1].need)) - 1) * 100);
  const stats = d.id === 'power'
    ? `<div class="stat"><small>Makes</small><b>${fmtRate(f.made)} MW</b></div><div class="stat"><small>Factory speed</small><b>+${pctSpeed()}%${nextSpeed > pctSpeed() ? ` → <em>+${nextSpeed}%</em>` : ''}</b></div>`
    : `<div class="stat"><small>Compute</small><b>${fmtRate(fl.compute)} PFLOPS</b></div><div class="stat"><small>Factory speed</small><b>+${pctSpeed()}%${nextSpeed > pctSpeed() ? ` → <em>+${nextSpeed}%</em>` : ''}</b></div>`;
  return `
    <div class="sheet-head">
      <span class="badge" style="background:${tint(d)}">${d.id === 'power' ? ICON.bolt.replace('width="46" height="46"', 'width="30" height="30"') : ICON.chip}</span>
      <span class="sheet-title"><h2>${d.name}</h2><span>Level ${lv} · makes ${d.makes}</span></span>
      <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
    </div>
    <div class="stats">${stats}</div>
    ${supportBlock(d, lv)}
    <div class="mile">
      <div class="mile-row"><span>${nm ? `Level ${nm}: twice the output` : 'All output bonuses earned'}</span><span>${nm ? `${lv}/${nm}` : ''}</span></div>
      <div class="mile-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
    </div>
    <div class="amounts" role="group" aria-label="How many levels to buy">
      <button data-buy="1" aria-pressed="${buyMode === 1}">×1</button>
      <button data-buy="10" aria-pressed="${buyMode === 10}">×10</button>
      <button data-buy="max" aria-pressed="${buyMode === 'max'}">Max${buyMode === 'max' ? ` (${n})` : ''}</button>
    </div>
    <button class="btn green" data-act="upgrade" ${afford ? '' : 'disabled'}>${afford ? `Upgrade +${n} · $${fmtCost(cost)}` : `Need $${fmtCost(short)} more`}</button>
    ${!afford ? cashAdButton(short) : ''}
    <p class="fact"><b>Good to know:</b> ${FACTS[d.id]}</p>`;
}

function renderSheet(force = false) {
  const id = world.selected;
  if (!id) { sheet.hidden = true; sheetKey = ''; return; }
  const d = def(id), lv = game.level(id);
  let html;
  if (lv > 0 && isSupport(id)) html = renderSupportSheet(d, lv);
  else if (lv > 0) {
    const n = buyCount(d, lv);
    const cost = upgradeCost(d, lv, n);
    const f = game.info(id);
    const earnNow = f.made * d.value * game.mult();
    const nm = nextMilestone(lv);
    const prevM = [...MILESTONES].reverse().find(m => m <= lv) ?? 0;
    const pct = nm ? ((lv - prevM) / (nm - prevM)) * 100 : 100;
    const afford = game.canAfford(cost);
    const short = cost - game.s.run.cash;
    const rocketBlock = id === 'rocket' ? `
      <div class="launch-box">
        <div><b>${Math.floor(game.s.run.rocketsBuilt)}</b> rocket${Math.floor(game.s.run.rocketsBuilt) === 1 ? '' : 's'} built</div>
        <button class="btn red" data-act="launch" ${game.canLaunch() ? '' : 'disabled'}>${game.canLaunch() ? `Launch · +${Math.max(1, game.launchPreview())} Engineering Points` : 'First rocket still in the shop'}</button>
      </div>` : '';
    html = `
      <div class="sheet-head">
        <span class="badge" style="background:${tint(d)}">${ICON.factory}</span>
        <span class="sheet-title"><h2>${d.name}</h2><span>Level ${lv} · makes ${d.makes}</span></span>
        <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
      </div>
      <div class="stats">
        <div class="stat"><small>Makes</small><b>${fmtRate(f.made)} ${d.unit}/s</b></div>
        <div class="stat"><small>Earns</small><b>$${fmt(earnNow)}/s</b></div>
      </div>
      ${supplyBlock(d)}
      ${rocketBlock}
      <div class="mile">
        <div class="mile-row"><span>${nm ? `Level ${nm}: runs twice as fast` : 'All speed bonuses earned'}</span><span>${nm ? `${lv}/${nm}` : ''}</span></div>
        <div class="mile-bar"><i style="width:${pct.toFixed(1)}%"></i></div>
      </div>
      <div class="amounts" role="group" aria-label="How many levels to buy">
        <button data-buy="1" aria-pressed="${buyMode === 1}">×1</button>
        <button data-buy="10" aria-pressed="${buyMode === 10}">×10</button>
        <button data-buy="max" aria-pressed="${buyMode === 'max'}">Max${buyMode === 'max' ? ` (${n})` : ''}</button>
      </div>
      <button class="btn green" data-act="upgrade" ${afford ? '' : 'disabled'}>${afford ? `Upgrade +${n} · $${fmtCost(cost)}` : `Need $${fmtCost(short)} more`}</button>
      ${!afford ? cashAdButton(short) : ''}
      <p class="fact"><b>How it’s made:</b> ${FACTS[id]}</p>`;
  } else {
    const afford = game.canAfford(d.unlock);
    const short = d.unlock - game.s.run.cash;
    const prev = idx(id) > 0 ? FACTORIES[idx(id) - 1] : null;
    if (isSupport(id)) {
      html = `
      <div class="sheet-head">
        <span class="badge dashed">${ICON.plus}</span>
        <span class="sheet-title"><h2>Build ${d.name}</h2><span>${id === 'power' ? 'Makes electricity for the Data Center' : 'Speeds up every factory in town'}</span></span>
        <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
      </div>
      <div class="stats">
        <div class="stat"><small>Cost</small><b>$${fmtCost(d.unlock)}</b></div>
        <div class="stat"><small>Makes</small><b>${fmtRate(d.perLevel)} ${d.unit}</b></div>
      </div>
      <div class="supply info">${id === 'power'
        ? 'A Data Center turns this power into compute. Every bit of compute makes all your factories run faster.'
        : `Needs ${d.need} MW from a Power Plant for each PFLOPS. 1 PFLOPS makes every factory 20% faster, and each doubling adds another 20%.`}</div>
      <button class="btn green" data-act="build" ${afford ? '' : 'disabled'}>${afford ? `Build · $${fmtCost(d.unlock)}` : `Need $${fmtCost(short)} more`}</button>
      ${!afford ? cashAdButton(short) : ''}
      <p class="fact"><b>Good to know:</b> ${FACTS[id]}</p>`;
    } else html = `
      <div class="sheet-head">
        <span class="badge dashed">${ICON.plus}</span>
        <span class="sheet-title"><h2>Build ${d.name}</h2><span>${prev ? `Turns ${prev.unit} into ${d.makes}` : `Digs ${d.makes}`}</span></span>
        <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
      </div>
      <div class="stats three">
        <div class="stat"><small>Cost</small><b>$${fmtCost(d.unlock)}</b></div>
        <div class="stat"><small>Makes</small><b>${fmtRate(d.perLevel)}/s</b></div>
        <div class="stat"><small>Worth</small><b>$${fmt(d.value * game.epMult())} each</b></div>
      </div>
      ${prev ? `<div class="supply ok">Uses ${d.need} ${prev.unit} for each ${d.unit.replace(/s$/, '')}, delivered by truck from your ${prev.name}.</div>` : ''}
      <button class="btn green" data-act="build" ${afford ? '' : 'disabled'}>${afford ? `Build · $${fmtCost(d.unlock)}` : `Need $${fmtCost(short)} more`}</button>
      ${!afford ? cashAdButton(short) : ''}
      <p class="fact"><b>How it’s made:</b> ${FACTS[id]}</p>`;
  }
  if (force || html !== sheetKey) { sheet.innerHTML = html; sheetKey = html; }
  sheet.hidden = false;
  const h = sheet.offsetHeight, H = window.innerHeight || 1;
  if (h) world.setFreeTop(Math.max(0, (H - h) / H));
}

// The cash ad covers what you're missing (plus a little), or a minute of income,
// and is only offered when you're within ~10 minutes of affording it, so it speeds
// you up without skipping the game.
const cashAdAmount = short => Math.max(short * 1.05, game.baseRate() * 60 * GAME.cashAdMinutes, 25);
const cashAdOffered = short => short <= Math.max(game.baseRate() * 600, 100);
const cashAdButton = short => cashAdOffered(short) ? `<button class="btn gold" data-act="cash-ad">${AD} Watch ad for $${fmt(cashAdAmount(short))}</button>` : '';

sheet.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = world.selected;
  if (b.dataset.buy) { buyMode = b.dataset.buy === 'max' ? 'max' : +b.dataset.buy; sfx.tap(); renderSheet(true); return; }
  if (b.dataset.goto) { world.select(b.dataset.goto); world.focus(b.dataset.goto); sfx.tap(); return; }
  const act = b.dataset.act;
  if (act === 'close') world.select(null);
  if (act === 'upgrade') {
    const d = def(id), lv = game.level(id);
    if (game.buyLevels(id, buyCount(d, lv))) world.bounce(id);
  }
  if (act === 'build' && game.build(id)) toast(`${def(id).name} is open for business!`);
  if (act === 'cash-ad') {
    const d = def(id), lv = game.level(id);
    const need = lv > 0 ? upgradeCost(d, lv, buyCount(d, lv)) : d.unlock;
    const amount = cashAdAmount(need - game.s.run.cash);
    if (await watch('cash', `$${fmt(amount)} cash`)) { game.addCash(amount); sfx.reward(); toast(`+$${fmt(amount)}`); }
  }
  if (act === 'launch') openLaunch();
  renderSheet(true);
});

world.onPick = id => {
  if (id) {
    world.focus(id);
    if (!game.s.tutorial.opened) { game.s.tutorial.opened = true; track('tutorial_step', { step: 'opened_factory' }); }
    sfx.tap();
  }
  renderSheet(true);
};

// ---------- ads ----------
let adBusy = false;
async function watch(placement, reason) {
  if (adBusy) return false;
  adBusy = true;
  track('ad_offer_accepted', { placement });
  const ok = await ads.showRewarded(reason);
  adBusy = false;
  if (ok) { game.s.adsWatched++; track('ad_watched', { placement }); save(); }
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
  contractEl.querySelector('.c-what').textContent = done ? `Tap to collect $${fmt(c.reward)}` : `${fmt(c.progress)} / ${fmt(c.target)} ${c.unit}`;
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
      if (act === 'c2' && await watch('contract_double', 'double contract reward')) mult = 2;
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
    if (act === 'goto') { world.select(c.id); world.focus(c.id); }
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
  const gain = Math.max(1, game.launchPreview());
  const nextTheme = themeFor(game.s.launches + 1);
  const totalAfter = (game.s.ep + gain) * EP_BONUS * 100;
  openModal(`
    <div class="big-icon red">${ICON.rocket}</div>
    <h2>Launch the rocket?</h2>
    <p>Your town resets, but you keep <b>Engineering Points</b>. Each one adds ${EP_BONUS * 100}% income forever. Next stop: <b>${THEME_NAMES[nextTheme]}</b>.</p>
    <div class="stats">
      <div class="stat"><small>Points from launch</small><b><em>+${gain}</em></b></div>
      <div class="stat"><small>Income bonus after</small><b>+${fmt(totalAfter)}%</b></div>
    </div>
    <p class="small">Launching later gives more points: they grow with the cash you earn this run.</p>
    <button class="btn gold" data-act="l2">${AD} Launch with 2× points (+${gain * 2})</button>
    <button class="btn red" data-act="l1">Launch now</button>
    <button class="btn plain" data-act="dismiss">Not yet</button>`, async act => {
    let mult = 1;
    if (act === 'l2' && await watch('launch_double', 'double Engineering Points')) mult = 2;
    if (act === 'l1' || act === 'l2') await doLaunch(mult);
  });
}

let launching = false;
async function doLaunch(mult) {
  if (launching) return;
  launching = true;
  world.select(null);
  document.body.classList.add('launching');
  sfx.launch();
  await world.launchRocket();
  const flash = $('flash');
  flash.hidden = false;
  await new Promise(r => setTimeout(r, 450));
  const before = game.s.ep;
  const gained = game.launch(mult);
  track('rocket_launched', { ep_gained: gained, launches: game.s.launches, doubled: mult === 2 });
  world.clearDeliveries();
  world.setTheme(game.theme());
  syncBuilt();
  world.target.set(7, 0, 12);
  save();
  setTimeout(() => { flash.hidden = true; document.body.classList.remove('launching'); }, 600);
  launching = false;
  openModal(`
    <div class="big-icon red">${ICON.rocket}</div>
    <h2>Launch successful!</h2>
    <p>Welcome to <b>${THEME_NAMES[game.theme()]}</b>. Your new town starts with a permanent income bonus.</p>
    <div class="stats">
      <div class="stat"><small>Engineering Points</small><b>${before} → <em>${game.s.ep}</em></b></div>
      <div class="stat"><small>Income bonus</small><b><em>+${fmt(game.s.ep * EP_BONUS * 100)}%</em></b></div>
    </div>
    <button class="btn green" data-act="dismiss">Start building</button>`);
}
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
    if (act === 'd2' && await watch('daily_double', 'double daily delivery')) mult = 2;
    const got = game.claimDaily(mult);
    track('daily_claimed', { streak, doubled: mult === 2 });
    sfx.reward(); toast(`+$${fmt(got)}`);
  }, () => { const got = game.claimDaily(1); track('daily_claimed', { streak, doubled: false }); toast(`+$${fmt(got)}`); });
}

// ---------- settings ----------
$('settings-btn').addEventListener('click', () => {
  sfx.tap();
  openModal(`
    <h2>Settings</h2>
    <button class="btn plain toggle" data-act="sound" aria-pressed="${game.s.settings.sound}">Sound and vibration: <b>${game.s.settings.sound ? 'On' : 'Off'}</b></button>
    <p>Rockets launched: <b>${game.s.launches}</b> · Engineering Points: <b>${game.s.ep}</b><br>Orders filled: <b>${game.s.contractsDone}</b> · Total earned: <b>$${fmt(game.s.totalEarned)}</b></p>
    <p class="small">${ads.isSimulated ? 'Browser version: ads are simulated.' : 'Ads by Google AdMob.'} The game sends anonymous play stats (no names or contact info) so we can improve it.</p>
    <button class="btn danger" data-act="reset-ask">Start over</button>
    <button class="btn plain" data-act="dismiss">Close</button>`, async act => {
    if (act === 'sound') {
      game.s.settings.sound = !game.s.settings.sound;
      sfx.setEnabled(game.s.settings.sound);
      save();
      $('settings-btn').click();
    }
    if (act === 'reset-ask') {
      openModal(`<h2>Start over?</h2><p>This wipes your town, rockets and Engineering Points. It can’t be undone.</p>
        <button class="btn danger" data-act="reset-yes">Yes, start over</button>
        <button class="btn plain" data-act="dismiss">Keep my town</button>`, async a => {
        if (a === 'reset-yes') { world.select(null); await game.reset(); world.clearDeliveries(); world.setTheme(game.theme()); syncBuilt(); track('reset'); toast('Fresh start!'); }
      });
    }
  });
});

// ---------- offline earnings ----------
function welcomeBack() {
  const { seconds, amount } = game.offlineEarnings();
  game.s.lastSeen = Date.now();
  if (seconds < 60 || amount < 1) return;
  game.applyOfflineProduction(seconds);
  openModal(`
    <div class="big-icon">${ICON.moon}</div>
    <h2>Welcome back, boss</h2>
    <p>Your factories kept running for ${fmtTime(seconds)} while you were away${seconds >= GAME.offlineCapHours * 3600 - 1 ? ` (the warehouse holds up to ${GAME.offlineCapHours} hours)` : ''}.</p>
    <div class="big-num">$${fmt(amount)}</div>
    <button class="btn gold" data-act="o2">${AD} Collect 2× · $${fmt(amount * 2)}</button>
    <button class="btn plain" data-act="o1">Collect $${fmt(amount)}</button>`, async act => {
    let mult = 1;
    if (act === 'o2' && await watch('offline_double', 'double offline earnings')) mult = 2;
    game.addCash(amount * mult);
    sfx.reward(); toast(`+$${fmt(amount * mult)}`);
  }, () => game.addCash(amount));
}

// ---------- tutorial hints ----------
function hintText() {
  if (game.s.launches === 0 && !game.s.tutorial.done) {
    const t = game.s.tutorial;
    if (!t.opened) return 'Tap the Ore Mine';
    if (!t.upgraded) return 'Upgrade the mine to dig more ore';
    if (!game.built('furnace')) return game.canAfford(def('furnace').unlock) ? 'Build a Steel Furnace to turn ore into steel' : `Save $${fmtCost(def('furnace').unlock)} for a Steel Furnace`;
    if (game.info('furnace').starved && game.level('furnace') > 1) return 'The furnace is short on ore. Upgrade the mine!';
    if (!game.built('press')) return game.canAfford(def('press').unlock) ? 'Build a Bolt Press next to the furnace' : 'Trucks carry ore to the furnace. Keep the mine ahead!';
    if (game.s.contract && game.s.contractsDone === 0) return 'Fill the order at the top for a big bonus';
    if (game.s.contractsDone > 0 || game.built('engine')) { t.done = true; track('tutorial_step', { step: 'done' }); }
    return '';
  }
  // later tip: the power plant + data center combo
  if (!game.built('power') && game.canAfford(def('power').unlock)) return 'New: a Power Plant and Data Center speed up every factory';
  if (game.built('power') && !game.built('datacenter') && game.canAfford(def('datacenter').unlock)) return 'Build the Data Center to turn power into speed';
  return '';
}

// ---------- events from the game ----------
const popAcc = {};
const popT = {};
game.on('produce', (id, amount) => { popAcc[id] = (popAcc[id] || 0) + amount; });
game.on('built', id => {
  world.setBuilt(id, true);
  sfx.build();
  track('factory_built', { factory: id, launches: game.s.launches });
});
game.on('upgrade', (id, before, after) => {
  world.setGrowth(id, milestoneCount(after));
  const crossed = MILESTONES.filter(m => before < m && after >= m);
  if (crossed.length) {
    sfx.milestone();
    toast(`${def(id).name} hit level ${crossed[crossed.length - 1]}: twice as fast!`);
    track('milestone', { factory: id, level: crossed[crossed.length - 1] });
  } else sfx.upgrade();
});

function syncBuilt() {
  for (const f of ALL) {
    world.setBuilt(f.id, game.built(f.id));
    world.setGrowth(f.id, milestoneCount(game.level(f.id)));
  }
}

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
let last = performance.now(), uiT = 0, hintCache = null;
function loop(now) {
  // clamp: some browsers hand back an older frame time (e.g. after waking), never run time backwards
  const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
  last = Math.max(last, now);
  if (!launching) game.tick(dt);
  { const fl = game.baseFlow(); world.setFlow(fl.per, fl.support); world.setPowerLine(game.built('power') && game.built('datacenter'), fl.support.power.util); }
  world.frame(dt, labelFor);
  $('cash').textContent = '$' + (game.s.run.cash < 1000 ? Math.floor(game.s.run.cash) : fmt(game.s.run.cash));
  $('rate').textContent = `+$${fmt(game.rate())} per sec${game.boostLeft() > 0 ? ' · ×2' : ''}`;
  // floating "+$" over each factory
  for (const f of FACTORIES) {
    popT[f.id] = (popT[f.id] ?? Math.random() * 1.5) - dt;
    if (popT[f.id] <= 0) { popT[f.id] = 1.6; if (popAcc[f.id] > 0) world.pop(f.id, `+$${fmt(popAcc[f.id])}`); popAcc[f.id] = 0; }
  }
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.2;
    const left = game.boostLeft();
    const bb = $('boost-btn');
    bb.classList.toggle('on', left > 0);
    $('boost-text').textContent = left > 0 ? fmtTime(left) : '×2';
    bb.setAttribute('aria-label', left > 0 ? `Double earnings active, ${fmtTime(left)} left. Watch an ad to add more.` : 'Watch an ad for double earnings');
    if (game.s.ep > 0) { $('ep').hidden = false; $('ep').textContent = `+${fmt(game.s.ep * EP_BONUS * 100)}% · ${game.s.ep} EP`; }
    else $('ep').hidden = true;
    world.setRocketReady(game.canLaunch());
    const showLaunch = game.canLaunch() && !world.selected && !launching;
    $('launch-btn').hidden = !showLaunch;
    const h = world.selected || showLaunch ? '' : hintText();
    if (h !== hintCache) { hintCache = h; $('hint').textContent = h; $('hint').hidden = !h; }
    renderContract();
    if (!sheet.hidden) renderSheet();
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
  world.setTheme(game.theme());
  syncBuilt();
  const brandNew = game.s.totalEarned === 0 && !game.s.playDays.length;
  // no daily gift on the very first day; it starts tomorrow
  if (brandNew) { game.s.daily = { lastDay: game.today(), streak: 0 }; track('first_open'); }
  welcomeBack();
  maybeDaily();
  dayCheck();
  step('starting loop');
  ads.init();
  requestAnimationFrame(loop);
})().catch(e => window.__bootError?.('Start failed: ' + (e.stack || e.message || e)));

function withTimeout(p, ms, what) {
  let t;
  const timer = new Promise(r => { t = setTimeout(() => { window.__bootError?.(`Timed out ${what}; starting fresh`); r(null); }, ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}
