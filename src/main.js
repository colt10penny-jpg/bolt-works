import './style.css';
import { Capacitor } from '@capacitor/core';
import {
  FACTORIES, ALL, SUPPORT, isSupport, speedFromCompute, capacity, FACTS, WORLDS, worldById, managerCost, MILESTONES, fmt, fmtCost, fmtRate, fmtTime, upgradeCost, maxAffordable,
  nextMilestone, milestoneCount, EP_BONUS, epForRun, themeFor, THEME_NAMES,
} from './economy.js';
import { Game } from './state.js';
import { World } from './world.js';
import { ads } from './ads.js';
import { sfx } from './sound.js';
import { initAnalytics, track, flush } from './analytics.js';
import { GAME } from './config.js';
import { skin } from './worlds.js';

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
world.lookFor = id => def(id);
game.unitOf = id => skin(game.s.current, id).unit;
const def = id => { const base = ALL.find(f => f.id === id); return base ? { ...base, ...skin(game.s.current, id) } : base; };
if (location.search.includes('debug')) Object.assign(window, { __game: game, __world: world });
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
  clip: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="4" width="14" height="18" rx="2"/><path d="M9 4V2.5h6V4M8.5 10h7M8.5 14h7M8.5 18h4"/></svg>',
};

// ---------- small bubbles over buildings ----------
// Nothing shows unless it needs you: money waiting (tap to collect), a supply
// problem, or an empty lot you can afford.
const pctSpeed = () => Math.round((game.baseFlow().speed - 1) * 100);
const COIN = '<span class="b-coin" aria-hidden="true">$</span>';
function labelFor(id) {
  const d = def(id), lv = game.level(id);
  if (lv <= 0) {
    const ok = game.canAfford(d.unlock);
    return ok
      ? { cls: 'bub plus', html: '<span aria-hidden="true">+</span>', aria: `Empty lot. You can build a ${d.name}.` }
      : { cls: '', html: '', aria: '' };
  }
  const f = game.info(id);
  if (isSupport(id)) {
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
const buyCount = (d, lv) => buyMode === 'max' ? Math.max(1, maxAffordable(d, lv, game.run.cash)) : buyMode;
const go = (id, label) => `<button class="link" data-goto="${id}">${label}</button>`;
const one = u => u.replace(/s$/, '');

// one short status line: the most important thing about this building right now
function statusLine(d) {
  const i = idx(d.id);
  const f = game.info(d.id);
  const prev = i > 0 ? def(FACTORIES[i - 1].id) : null;
  const next = FACTORIES[i + 1] ? def(FACTORIES[i + 1].id) : null;
  if (prev && !game.built(prev.id)) return `<div class="sh-status warn">Needs ${prev.unit} from a ${prev.name} ${go(prev.id, 'Show')}</div>`;
  if (prev && f.starved) return `<div class="sh-status warn">Short on ${prev.unit} · ${Math.round(f.util * 100)}% speed ${go(prev.id, `Fix: ${prev.name}`)}</div>`;
  if (next && game.built(next.id) && f.surplus > 0.15 && f.made > 0) return `<div class="sh-status info">${Math.round(f.surplus * 100)}% of ${d.unit} piling up ${go(next.id, next.name)}</div>`;
  return prev ? `<div class="sh-status ok">Fully supplied · ${d.need} ${prev.unit} per ${one(d.unit)}</div>` : '';
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

function head(d, badge, title, sub) {
  return `<div class="sh-head">
      <span class="badge sm" style="background:${tint(d)}">${badge}</span>
      <span class="sh-title"><b>${title}</b><small>${sub}</small></span>
      <button class="icon-sm" data-act="fact" aria-label="How it works" aria-pressed="${factOpen}">i</button>
      <button class="close sm" data-act="close" aria-label="Close">${ICON.close}</button>
    </div>
    ${factOpen ? `<p class="sh-fact">${d.fact}</p>` : ''}`;
}
function mileBar(lv, word) {
  const nm = nextMilestone(lv);
  const prevM = [...MILESTONES].reverse().find(m => m <= lv) ?? 0;
  const pct = nm ? ((lv - prevM) / (nm - prevM)) * 100 : 100;
  return `<div class="sh-mile"><span>${nm ? `Lv ${nm}: ${word}` : 'All bonuses earned'}</span><span class="sh-bar"><i style="width:${pct.toFixed(1)}%"></i></span><span>${nm ? `${lv}/${nm}` : ''}</span></div>`;
}
function buyRow(d, lv) {
  const n = buyCount(d, lv);
  const cost = upgradeCost(d, lv, n);
  const afford = game.canAfford(cost);
  return `<div class="sh-buy">
      <div class="amounts sm" role="group" aria-label="How many levels to buy">
        <button data-buy="1" aria-pressed="${buyMode === 1}">×1</button>
        <button data-buy="10" aria-pressed="${buyMode === 10}">×10</button>
        <button data-buy="max" aria-pressed="${buyMode === 'max'}">Max</button>
      </div>
      <button class="btn green" data-act="upgrade" ${afford ? '' : 'disabled'}>${afford ? `+${n} · $${fmtCost(cost)}` : `Need $${fmtCost(cost - game.run.cash)}`}</button>
    </div>
    ${afford ? '' : cashAdButton(cost - game.run.cash)}`;
}
function managerRow(d) {
  if (game.hasManager(d.id)) return '';
  const cost = managerCost(d);
  const ok = game.canAfford(cost);
  return `<div class="sh-mgr"><span>${ICON.person}<span>Storage <b>$${fmt(game.bin(d.id))}</b> / $${fmt(game.binCap(d.id))}</span></span>
    <button class="btn small" data-act="manager" ${ok ? '' : 'disabled'}>Hire manager · $${fmtCost(cost)}</button></div>`;
}

function renderSheet(force = false) {
  const id = world.selected;
  if (!id) { sheet.hidden = true; sheetKey = ''; return; }
  const d = def(id), lv = game.level(id);
  let html;
  if (lv > 0 && isSupport(id)) {
    const fl = game.baseFlow();
    const nextLv = { ...game.levels, [id]: lv + buyCount(d, lv) };
    const pw2 = capacity(SUPPORT[0], nextLv.power) * (game.world.perks.power || 1), dc2 = capacity(SUPPORT[1], nextLv.datacenter);
    const nextSpeed = Math.round((speedFromCompute(Math.min(dc2, pw2 / SUPPORT[1].need)) - 1) * 100);
    const made = id === 'power' ? `${fmtRate(game.info('power').made)} MW` : `${fmtRate(fl.compute)} PFLOPS`;
    const sub = `Lv ${lv} · ${made} · speed +${pctSpeed()}%${nextSpeed > pctSpeed() ? ` <em>→ +${nextSpeed}%</em>` : ''}`;
    html = head(d, id === 'power' ? ICON.boltSm : ICON.chip, d.name, sub) + supportStatus(d) + mileBar(lv, '2× output') + buyRow(d, lv);
  } else if (lv > 0) {
    const f = game.info(id);
    const earn = f.made * d.value * game.mult();
    const sub = `Lv ${lv} · ${fmtRate(f.made)} ${d.unit}/s · $${fmt(earn)}/s${game.hasManager(id) ? ' · <span class="mgr-on">manager</span>' : ''}`;
    const rocket = id === 'rocket' ? (() => {
      const pts = game.launchPreview(), next = game.nextWorld(), unlocks = next && !game.s.worlds[next.id];
      const can = game.canLaunch() && (pts >= 1 || unlocks);
      return `<div class="sh-row"><span>${Math.floor(game.run.rocketsBuilt)} ${d.unit} ready</span>
        <button class="btn small red" data-act="launch" ${can ? '' : 'disabled'}>${!game.canLaunch() ? `Building first ${one(d.unit)}` : pts >= 1 ? `Launch · +${pts} EP` : unlocks ? `Launch · unlock ${next.short}` : 'Earn more for points'}</button></div>`;
    })() : '';
    html = head(d, ICON.factory, d.name, sub) + statusLine(d) + rocket + mileBar(lv, '2× speed') + buyRow(d, lv) + managerRow(d);
  } else {
    const afford = game.canAfford(d.unlock);
    const prev = idx(id) > 0 ? def(FACTORIES[idx(id) - 1].id) : null;
    const what = isSupport(id)
      ? (id === 'power' ? `Makes electricity for the ${def('datacenter').name}` : `Turns power into compute that speeds up every factory`)
      : prev ? `Turns ${prev.unit} into ${d.makes}` : `Digs ${d.makes}`;
    html = `<div class="sh-head">
        <span class="badge sm dashed">${ICON.plus}</span>
        <span class="sh-title"><b>${d.name}</b><small>${what}</small></span>
        <button class="icon-sm" data-act="fact" aria-label="How it works" aria-pressed="${factOpen}">i</button>
        <button class="close sm" data-act="close" aria-label="Close">${ICON.close}</button>
      </div>
      ${factOpen ? `<p class="sh-fact">${d.fact}</p>` : ''}
      <button class="btn green" data-act="build" ${afford ? '' : 'disabled'}>${afford ? `Build · $${fmtCost(d.unlock)}` : `Build · $${fmtCost(d.unlock)} (need $${fmtCost(d.unlock - game.run.cash)} more)`}</button>
      ${afford ? '' : cashAdButton(d.unlock - game.run.cash)}`;
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
  if (b.dataset.act === 'fact') { factOpen = !factOpen; renderSheet(true); return; }
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
    const amount = cashAdAmount(need - game.run.cash);
    if (await watch('cash', `$${fmt(amount)} cash`)) { game.addCash(amount); sfx.reward(); toast(`+$${fmt(amount)}`); }
  }
  if (act === 'launch') openLaunch();
  if (act === 'manager' && game.hireManager(id)) { sfx.milestone(); toast(`Manager hired at the ${def(id).name}`); track('manager_hired', { factory: id }); }
  renderSheet(true);
});

// Tapping a coin bubble collects that building's money. Tapping the building itself
// collects too and opens its panel (tap it again, or the ground, to close).
function collectAt(id) {
  const amount = !isSupport(id) && game.built(id) && !game.hasManager(id) ? game.bin(id) : 0;
  if (amount < 1) return 0;
  game.collect(id);
  world.pop(id, `+$${fmt(amount)}`, 'big');
  world.bounce(id);
  sfx.coin();
  if (!game.s.tutorial.collected) track('tutorial_step', { step: 'collected' });
  return amount;
}
world.onBubble = id => {
  if (!collectAt(id)) world.select(id);
  else if (world.selected) world.select(id);
};
world.onTap = id => {
  collectAt(id);
  world.select(world.selected === id ? null : id);
};

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
  const gain = game.launchPreview();
  const totalAfter = (game.s.ep + gain) * EP_BONUS * 100;
  const w = game.world, next = game.nextWorld();
  const unlocks = next && !game.s.worlds[next.id];
  const r = def('rocket');
  openModal(`
    <div class="big-icon red">${ICON.rocket}</div>
    <h2>Launch?</h2>
    <p>Send one of your ${r.unit} up. Your town stays exactly as it is.${unlocks ? ` This launch unlocks <b>${next.name}</b>.` : ''}</p>
    <div class="stats">
      <div class="stat"><small>Engineering Points</small><b><em>+${gain}</em></b></div>
      <div class="stat"><small>Income bonus after</small><b>+${fmt(totalAfter)}%</b></div>
    </div>
    <p class="small">Points come from all the cash you've earned in every world. Each one adds ${EP_BONUS * 100}% income everywhere, forever.${w.perks.ep ? ' Low gravity here doubles them.' : ''}</p>
    ${gain >= 1 ? `<button class="btn gold" data-act="l2">${AD} Launch with 2× points (+${gain * 2})</button>` : ''}
    <button class="btn red" data-act="l1">Launch now</button>
    <button class="btn plain" data-act="dismiss">Not yet</button>`, async act => {
    let mult = 1;
    if (act === 'l2' && await watch('launch_double', 'double Engineering Points')) mult = 2;
    if (act === 'l1' || act === 'l2') await doLaunch(mult);
  });
}

function rebuildTown() {
  world.select(null);
  world.clearDeliveries();
  world.setTheme(game.theme());
  syncBuilt();
  world.target.set(7, 0, 12);
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
  const { gained, unlocked, from } = game.launch(mult);
  track('rocket_launched', { ep_gained: gained, launches: game.s.launches, doubled: mult === 2, world: from, unlocked: unlocked || '' });
  save();
  setTimeout(() => { flash.hidden = true; document.body.classList.remove('launching'); }, 600);
  launching = false;
  const next = game.nextWorld();
  const here = worldById(from);
  const nw = unlocked ? worldById(unlocked) : null;
  openModal(`
    <div class="big-icon red">${ICON.rocket}</div>
    <h2>Launch successful!</h2>
    <p>${nw ? `You unlocked <b>${nw.name}</b>, with its own kinds of factories. ${nw.perk}` : 'Your town is just as you left it, now with a bigger income bonus.'}</p>
    <div class="stats">
      <div class="stat"><small>Engineering Points</small><b>${before} → <em>${game.s.ep}</em></b></div>
      <div class="stat"><small>Income bonus</small><b><em>+${fmt(game.s.ep * EP_BONUS * 100)}%</em></b></div>
    </div>
    ${nw ? `<button class="btn green" data-act="go">Travel to ${nw.short}</button><button class="btn plain" data-act="dismiss">Stay in ${worldById(from).short}</button>` : `<button class="btn green" data-act="dismiss">Keep building</button>`}
    <p class="small">Switch worlds any time with the map button.</p>`, act => {
    if (act === 'go' && nw) doTravel(nw.id);
  });
}

// ---------- world map ----------
function openMap() {
  sfx.tap();
  const cards = WORLDS.map((w, i) => {
    const open = !!game.s.worlds[w.id];
    const here = w.id === game.s.current;
    const prev = WORLDS[i - 1];
    const fl = open ? game.flowFor(w.id) : null;
    const status = here ? '<span class="w-here">You are here</span>'
      : open ? `<button class="btn small green" data-act="travel" data-world="${w.id}">Travel</button>`
      : '<span class="w-lock">Locked</span>';
    return `<div class="w-card ${here ? 'here' : ''} ${open ? '' : 'locked'} w-${w.id}">
      <span class="w-swatch" aria-hidden="true"></span>
      <span class="w-info">
        <b>${w.name}</b>
        <small>${open ? w.perk : `Launch a rocket from ${prev.short} to unlock.`}</small>
        ${open ? `<small class="w-rate">${fl && fl.income > 0 ? `Earns $${fmt(fl.income)}/s` : 'Not built yet'}</small>` : ''}
      </span>
      ${status}
    </div>`;
  }).join('');
  openModal(`
    <div class="big-icon">${ICON.globe}</div>
    <h2>Your worlds</h2>
    <p>Each world is its own town. Towns you leave keep earning for up to ${GAME.offlineCapHours} hours.</p>
    <div class="w-list">${cards}</div>
    <button class="btn plain" data-act="dismiss">Close</button>`, act => {});
  // travel buttons live inside the modal
}
modal.addEventListener('click', e => {
  const b = e.target.closest('[data-act="travel"]');
  if (b) { e.stopPropagation(); closeModal(false); doTravel(b.dataset.world); }
}, true);

async function doTravel(id) {
  if (launching || id === game.s.current) return;
  const flash = $('flash');
  flash.hidden = false;
  await new Promise(r => setTimeout(r, 350));
  const res = game.travel(id);
  if (!res) { flash.hidden = true; return; }
  track('world_travel', { to: id });
  rebuildTown();
  save();
  setTimeout(() => { flash.hidden = true; }, 600);
  toast(res.earned > 0 ? `Welcome to ${game.world.short}! +$${fmt(res.earned)} while you were away` : `Welcome to ${game.world.name}`);
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
    if (!t.collected) return game.bin('mine') >= 1 ? `Tap the coin to collect your ${def('mine').name}\u2019s money` : `Your ${def('mine').name} is working\u2026`;
    if (!t.opened) return `Tap the ${def('mine').name} building to see upgrades`;
    if (!t.upgraded) return `Upgrade the ${def('mine').name} to make more ${def('mine').unit}`;
    if (!game.built('furnace')) return game.canAfford(def('furnace').unlock) ? `Build a ${def('furnace').name} to turn ${def('mine').unit} into ${def('furnace').unit}` : `Save $${fmtCost(def('furnace').unlock)} for a ${def('furnace').name}`;
    if (game.info('furnace').starved && game.level('furnace') > 1) return `The ${def('furnace').name} is short on ${def('mine').unit}. Upgrade the ${def('mine').name}!`;
    if (!game.built('press')) return game.canAfford(def('press').unlock) ? `Build a ${def('press').name} next` : `Trucks carry ${def('mine').unit} to the ${def('furnace').name}. Keep the ${def('mine').name} ahead!`;
    if (game.s.contract && game.s.contractsDone === 0) return 'Fill the order at the top for a big bonus';
    if (game.s.contractsDone > 0 || game.built('engine')) { t.done = true; track('tutorial_step', { step: 'done' }); }
    return '';
  }
  const full = FACTORIES.find(f => game.built(f.id) && !game.hasManager(f.id) && game.binFull(f.id) && game.earnRate(f.id) > 0);
  if (full) return `Your ${def(full.id).name} is full. Tap it to collect!`;
  if (!Object.keys(game.run.managers).length && game.canAfford(managerCost(def('mine')))) return 'Tip: hire a manager to collect automatically';
  if (!game.built('power') && game.canAfford(def('power').unlock)) return `New: a ${def('power').name} and ${def('datacenter').name} speed up every factory`;
  if (game.built('power') && !game.built('datacenter') && game.canAfford(def('datacenter').unlock)) return `Build the ${def('datacenter').name} to turn power into speed`;
  return '';
}

// ---------- events from the game ----------
const popAcc = {};
const popT = {};
game.on('built', id => {
  world.setBuilt(id, true, def(id));
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
    world.setBuilt(f.id, game.built(f.id), def(f.id));
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
  $('cash').textContent = '$' + (game.run.cash < 1000 ? Math.floor(game.run.cash) : fmt(game.run.cash));
  $('rate').textContent = `+$${fmt(game.rate())} per sec${game.boostLeft() > 0 ? ' · ×2' : ''}`;
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
    const mb = $('map-btn'); const wl = game.unlockedWorlds().length;
    mb.hidden = wl < 2; $('map-name').textContent = game.world.short;
    const nxt = game.nextWorld();
    const showLaunch = game.canLaunch() && (game.launchPreview() >= 1 || (nxt && !game.s.worlds[nxt.id])) && !world.selected && !launching;
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
