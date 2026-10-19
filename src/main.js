import './style.css';
import { Capacitor } from '@capacitor/core';
import { FACTORIES, fmt, fmtCost, fmtTime, ratePerSec, upgradeCost, maxAffordable, nextMilestone, MILESTONES, cycleTime } from './economy.js';
import { Game } from './state.js';
import { World } from './world.js';
import { ads } from './ads.js';
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
const def = id => FACTORIES.find(f => f.id === id);

const ICON = {
  factory: '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V10l5 3V10l5 3V6l8 4v11z"/></svg>',
  plus: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  up: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
  bolt: '<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  moon: '<svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>',
};
const hex = n => '#' + n.toString(16).padStart(6, '0');
const AD = '<span class="ad-tag">AD</span>';

// ---------- labels above lots ----------
function labelFor(id) {
  const d = def(id), lv = game.level(id);
  if (lv > 0) {
    const canUp = game.canAfford(upgradeCost(d, lv, 1));
    const fast = cycleTime(d, lv) < 0.35;
    return {
      cls: fast ? 'fast' : '',
      html: `<span class="lv" style="background:${hex(d.color === 0xe8e4da ? 0x8a8f99 : d.color)}">${lv}</span><span class="name">${d.name}<span class="bar"><i></i></span></span>${canUp ? `<span class="up">${ICON.up}</span>` : ''}`,
      progress: game.s.factories[id].progress,
      aria: `${d.name}, level ${lv}${canUp ? ', upgrade available' : ''}`,
    };
  }
  const ok = game.canAfford(d.unlock);
  return { cls: 'lot' + (ok ? ' ok' : ''), html: `Build · $${fmtCost(d.unlock)}`, progress: 0, aria: `Empty lot. Build ${d.name} for $${fmtCost(d.unlock)}` };
}

// ---------- bottom sheet ----------
let buyMode = 1; // 1, 10, or 'max'
const sheet = $('sheet');
let sheetKey = '';

function buyCount(d, lv) {
  if (buyMode === 'max') return Math.max(1, maxAffordable(d, lv, game.s.cash));
  return buyMode;
}

function renderSheet(force = false) {
  const id = world.selected;
  if (!id) { sheet.hidden = true; sheetKey = ''; return; }
  const d = def(id), lv = game.level(id);
  let html;
  if (lv > 0) {
    const n = buyCount(d, lv);
    const cost = upgradeCost(d, lv, n);
    const now = ratePerSec(d, lv, game.mult());
    const after = ratePerSec(d, lv + n, game.mult());
    const nm = nextMilestone(lv);
    const prev = [...MILESTONES].reverse().find(m => m <= lv) ?? 0;
    const pct = nm ? ((lv - prev) / (nm - prev)) * 100 : 100;
    const afford = game.canAfford(cost);
    const short = cost - game.s.cash;
    html = `
      <div class="sheet-head">
        <span class="badge" style="background:${hex(d.color === 0xe8e4da ? 0x8a8f99 : d.color)}">${ICON.factory}</span>
        <span class="sheet-title"><h2>${d.name}</h2><span>Level ${lv} · makes ${d.makes}</span></span>
        <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
      </div>
      <div class="stats">
        <div class="stat"><small>Earns per sec</small><b>$${fmt(now)} → <em>$${fmt(after)}</em></b></div>
        <div class="stat"><small>Each run</small><b>${cycleTime(d, lv) >= 1 ? cycleTime(d, lv).toFixed(cycleTime(d, lv) < 10 ? 1 : 0) + 's' : 'under 1s'}</b></div>
      </div>
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
      ${!afford ? cashAdButton(short) : ''}`;
  } else {
    const afford = game.canAfford(d.unlock);
    const short = d.unlock - game.s.cash;
    html = `
      <div class="sheet-head">
        <span class="badge dashed">${ICON.plus}</span>
        <span class="sheet-title"><h2>Build ${d.name}</h2><span>Makes ${d.makes} for your town</span></span>
        <button class="close" data-act="close" aria-label="Close">${ICON.close}</button>
      </div>
      <div class="stats three">
        <div class="stat"><small>Cost</small><b>$${fmtCost(d.unlock)}</b></div>
        <div class="stat"><small>Earns</small><b>$${fmt(ratePerSec(d, 1))}/s</b></div>
        <div class="stat"><small>Each run</small><b>${d.cycle}s</b></div>
      </div>
      <button class="btn green" data-act="build" ${afford ? '' : 'disabled'}>${afford ? `Build · $${fmtCost(d.unlock)}` : `Need $${fmtCost(short)} more`}</button>
      ${!afford ? cashAdButton(short) : ''}`;
  }
  if (force || html !== sheetKey) { sheet.innerHTML = html; sheetKey = html; }
  sheet.hidden = false;
}

function cashAdAmount(short) {
  return Math.max(short, game.baseRate() * GAME.cashAdMinutes * 60, 25);
}
function cashAdButton(short) {
  return `<button class="btn gold" data-act="cash-ad">${AD} Watch ad for $${fmt(cashAdAmount(short))}</button>`;
}

sheet.addEventListener('click', async e => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = world.selected;
  if (b.dataset.buy) { buyMode = b.dataset.buy === 'max' ? 'max' : +b.dataset.buy; renderSheet(true); return; }
  const act = b.dataset.act;
  if (act === 'close') world.select(null);
  if (act === 'upgrade') {
    const d = def(id), lv = game.level(id);
    const n = buyCount(d, lv);
    if (game.buyLevels(id, n)) world.bounce(id);
  }
  if (act === 'build') {
    if (game.build(id)) { toast(`${def(id).name} is open for business!`); }
  }
  if (act === 'cash-ad') {
    const d = def(id), lv = game.level(id);
    const need = lv > 0 ? upgradeCost(d, lv, buyCount(d, lv)) : d.unlock;
    const amount = cashAdAmount(need - game.s.cash);
    if (await watch(`$${fmt(amount)} cash`)) { game.addCash(amount); toast(`+$${fmt(amount)}`); }
  }
  renderSheet(true);
});

world.onPick = id => {
  if (id) { world.focus(id); $('hint').hidden = true; }
  renderSheet(true);
};

// ---------- ads ----------
let adBusy = false;
async function watch(reason) {
  if (adBusy) return false;
  adBusy = true;
  const ok = await ads.showRewarded(reason);
  adBusy = false;
  if (ok) { game.s.adsWatched++; save(); }
  else toast('No ad available right now. Try again soon.');
  return ok;
}

$('boost-btn').addEventListener('click', async () => {
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
    <button class="btn plain" data-act="dismiss">Maybe later</button>`);
});

// ---------- modal + toast ----------
const modal = $('modal'), card = $('modal-card');
let modalHandler = null, modalDismiss = null;
function openModal(html, handler, onDismiss) { card.innerHTML = html; modal.hidden = false; modalHandler = handler || null; modalDismiss = onDismiss || null; card.querySelector('button')?.focus(); }
function closeModal() { modal.hidden = true; card.innerHTML = ''; modalHandler = null; modalDismiss = null; }
modal.addEventListener('click', async e => {
  if (e.target === modal) { const d = modalDismiss; closeModal(); if (d) d(); return; }
  const b = e.target.closest('button');
  if (!b) return;
  const act = b.dataset.act;
  if (act === 'dismiss') { const d = modalDismiss; closeModal(); if (d) d(); }
  if (act === 'boost') {
    closeModal();
    if (await watch(`${GAME.boostMinutesPerAd} min of double earnings`)) { game.addBoost(GAME.boostMinutesPerAd); toast(`Double earnings for ${fmtTime(game.boostLeft())}`); }
  }
  if (modalHandler) await modalHandler(act);
});

let toastT = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
}

$('settings-btn').addEventListener('click', () => {
  openModal(`
    <h2>Settings</h2>
    <p>Total earned: <b>$${fmt(game.s.totalEarned)}</b><br>Ads watched: <b>${game.s.adsWatched}</b></p>
    <p>${ads.isSimulated ? 'Running in the browser, so ads are simulated.' : 'Ads by Google AdMob.'}</p>
    <button class="btn danger" data-act="reset-ask">Start over</button>
    <button class="btn plain" data-act="dismiss">Close</button>`, async act => {
    if (act === 'reset-ask') {
      openModal(`<h2>Start over?</h2><p>This wipes your town and cash. It can't be undone.</p>
        <button class="btn danger" data-act="reset-yes">Yes, start over</button>
        <button class="btn plain" data-act="dismiss">Keep my town</button>`, async a => {
        if (a === 'reset-yes') { closeModal(); world.select(null); await game.reset(); syncBuilt(); toast('Fresh start!'); }
      });
    }
  });
});

// ---------- offline earnings ----------
function welcomeBack() {
  const { seconds, amount } = game.offlineEarnings();
  game.s.lastSeen = Date.now();
  if (seconds < 60 || amount < 1) return;
  openModal(`
    <div class="big-icon">${ICON.moon}</div>
    <h2>Welcome back, boss</h2>
    <p>Your factories kept running for ${fmtTime(seconds)} while you were away.</p>
    <div class="big-num">$${fmt(amount)}</div>
    <button class="btn gold" data-act="collect2">${AD} Collect 2× · $${fmt(amount * 2)}</button>
    <button class="btn plain" data-act="collect1">Collect $${fmt(amount)}</button>`, async act => {
    if (act === 'collect1') { closeModal(); game.addCash(amount); }
    if (act === 'collect2') {
      closeModal();
      const ok = await watch(`double offline earnings`);
      game.addCash(ok ? amount * 2 : amount);
      toast(`+$${fmt(ok ? amount * 2 : amount)}`);
    }
  }, () => game.addCash(amount)); // tapping outside counts as a normal collect
}

// ---------- events from the game ----------
const lastPop = {};
const popAcc = {};
game.on('payout', (id, amount) => {
  popAcc[id] = (popAcc[id] || 0) + amount;
  const now = performance.now();
  if (!lastPop[id] || now - lastPop[id] > 1300) {
    world.pop(id, `+$${fmt(popAcc[id])}`);
    popAcc[id] = 0; lastPop[id] = now;
  }
});
game.on('built', id => { world.setBuilt(id, true); });
game.on('upgrade', (id, before, after) => {
  const crossed = MILESTONES.filter(m => before < m && after >= m);
  if (crossed.length) toast(`${def(id).name} hit level ${crossed[crossed.length - 1]}: twice as fast!`);
});

function syncBuilt() { for (const f of FACTORIES) world.setBuilt(f.id, game.built(f.id)); }

// ---------- save ----------
let saving = false;
async function save() { if (saving) return; saving = true; await game.save(); saving = false; }
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  else welcomeBack();
});
if (Capacitor.isNativePlatform()) {
  import('@capacitor/app').then(({ App }) => {
    App.addListener('appStateChange', ({ isActive }) => { if (!isActive) save(); });
    // Android back button: close whatever is open, otherwise send the app to the background
    App.addListener('backButton', () => {
      if (!modal.hidden) { const d = modalDismiss; closeModal(); if (d) d(); }
      else if (world.selected) world.select(null);
      else App.minimizeApp();
    });
  });
}

// ---------- main loop ----------
let last = performance.now(), uiT = 0;
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  game.tick(dt);
  world.frame(dt, labelFor);
  $('cash').textContent = '$' + fmt(game.s.cash);
  $('rate').textContent = `+$${fmt(game.rate())} per sec${game.mult() > 1 ? ' · ×2' : ''}`;
  uiT -= dt;
  if (uiT <= 0) {
    uiT = 0.2;
    const left = game.boostLeft();
    const bb = $('boost-btn');
    bb.classList.toggle('on', left > 0);
    $('boost-text').textContent = left > 0 ? fmtTime(left) : '×2';
    bb.setAttribute('aria-label', left > 0 ? `Double earnings active, ${fmtTime(left)} left. Watch an ad to add more.` : 'Watch an ad for double earnings');
    if (!sheet.hidden) renderSheet();
  }
  requestAnimationFrame(loop);
}

(async function start() {
  await game.load();
  syncBuilt();
  welcomeBack();
  if (game.s.totalEarned > 200) $('hint').hidden = true;
  ads.init();
  requestAnimationFrame(loop);
})();
