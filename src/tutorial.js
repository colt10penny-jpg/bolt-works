// The opening of the game, kept short: a note from your late great-uncle's will, naming
// your town, then two pointers (collect the mine's coin, upgrade the mine) and a word about
// building more factories. Players work
// out the rest themselves. Every world you reach asks you to name its town.
//
// Progress lives in game.s.tutorial.step (a number; -1 means finished or skipped), so
// closing the app mid-way picks up where you left off.
import { track } from './analytics.js';

export const UNCLE = 'Walter "Walt" Bolton';

// a red wax seal: a lumpy blob, a pressed ring with a laurel, and Walt's initial
const WAX = `<svg class="wax" viewBox="0 0 100 100" aria-hidden="true">
  <defs>
    <radialGradient id="wax-g" cx="38%" cy="34%" r="70%"><stop offset="0" stop-color="#e0484a"/><stop offset=".55" stop-color="#a8222a"/><stop offset="1" stop-color="#6e1218"/></radialGradient>
    <radialGradient id="wax-in" cx="60%" cy="62%" r="60%"><stop offset="0" stop-color="#b52a31"/><stop offset="1" stop-color="#7a161c"/></radialGradient>
  </defs>
  <path d="M50 4c8 0 11 6 18 7s13 1 16 8-2 12 1 18 10 9 8 17-9 9-11 16-1 14-8 17-12-2-19 2-10 9-18 7-8-8-15-11-14-3-17-10 3-12 0-18-10-10-7-17 10-7 13-14 0-14 7-17 13 2 19-2S42 4 50 4z" fill="url(#wax-g)"/>
  <circle cx="50" cy="50" r="31" fill="url(#wax-in)" stroke="#5e0f14" stroke-width="2.5" opacity=".95"/>
  <circle cx="50" cy="50" r="26" fill="none" stroke="#e8737a" stroke-width="1.2" stroke-dasharray="2 3" opacity=".7"/>
  <g fill="none" stroke="#f0a0a3" stroke-width="2" stroke-linecap="round" opacity=".85">
    <path d="M30 62q-6-10 0-22M33 57l-5 1M31 50l-5 0M32 43l-4-2"/>
    <path d="M70 62q6-10 0-22M67 57l5 1M69 50l5 0M68 43l4-2"/>
  </g>
  <text x="50" y="60" text-anchor="middle" font-family="'IM Fell English', Georgia, serif" font-size="30" fill="#f6c6c8" stroke="#5e0f14" stroke-width=".8">W</text>
  <path d="M30 22q8-6 18-6" stroke="#ff9a9c" stroke-width="3" stroke-linecap="round" fill="none" opacity=".55"/>
</svg>`;
const KEY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3m-3 3 2.5 2.5M14.5 8.5l2 2"/></svg>';
const DICE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>';
const SIGN = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="M4 5h13l3 3-3 3H4z"/><path d="M20 13H7l-3 3 3 3h13z"/></svg>';
const NAMES = {
  colorado: ['Rivet Ridge', 'Bolton Springs', 'Copper Gulch', 'Iron Hollow', 'Gearwood', 'Sprocket Falls', 'Anvil Creek', 'Steelhaven'],
  desert: ['Rattlesnake Ridge', 'Coyote Flats', 'Silver Spur', 'Dry Gulch', 'Sagebrush Bend', 'Lonesome Butte'],
  moon: ['Tranquility Works', 'Crater Point', 'Lunaburg', 'Moonbolt', 'Dustfall Base', 'New Bolton'],
  mars: ['Red Rivet', 'New Jezero', 'Rustwater', 'Olympus Gate', 'Bolton Prime', 'Dustdevil Flats'],
};
const clean = s => (s || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 22);

export function createTutorial(ctx) {
  const { game, world, openModal, sfx, save, onRename } = ctx;
  const $ = id => document.getElementById(id);
  const guide = $('guide'), bubble = $('guide-bubble'), finger = $('tut-finger');
  const st = () => game.s.tutorial.step;
  const town = () => game.townName();
  const setStep = n => {
    game.s.tutorial.step = n;
    track('tutorial_step', { step: STEPS[n]?.id || 'done' });
    shown = -2;
    save();
  };

  const mineLot = () => world.lotsOf('mine')[0] || 'q0';
  const furnaceLot = () => 'q1';
  const label = lot => world.lots[lot]?.label;
  const visible = el => el && !el.hidden && el.offsetParent !== null && el.getBoundingClientRect().width > 0;
  const coin = () => { const c = label(mineLot()); return visible(c) && c.classList.contains('cash') ? c : null; };

  // each step: what the bubble says, what to point at, and when it's done
  const STEPS = [
    { id: 'letter' },   // the will and naming the town (modals; see start())
    {
      id: 'collect',
      say: () => `This is <b>your Ore Mine</b>! Tap the <b>coin</b> to collect its money.`,
      enter: () => { const b = game.run.bins; b.mine = Math.max(b.mine || 0, 12); },
      point: () => label(mineLot()),
      done: () => game.s.tutorial.collected,
    },
    {
      id: 'upgrade',
      say: () => world.selected === mineLot() ? `Now <b>upgrade</b> it to make more money.` : `Tap the <b>mine</b> and upgrade it to make more money.`,
      point: () => world.selected === mineLot() ? document.querySelector('#sheet [data-act=upgrade]') : { lot: mineLot() },
      done: () => game.level('mine') >= 2,
    },
    {
      id: 'expand', next: 'Got it',
      say: () => `Nice! Save up, then tap a <b>+</b> to clear land and build <b>more factories</b>. Each new one makes something worth more.`,
      enter: () => world.select(null),
      point: () => ({ lot: 'q1' }),
    },
  ];

  // ---- the speech bubble at the bottom ----
  let shown = -2, lastHtml = '', tipOpen = null;   // tipOpen: a one-off tip ({ say, lot, done })
  function show(html, next) {
    const full = `<span class="guide-text">${html}</span>${next ? `<button class="btn small green guide-next">${next}</button>` : ''}`;
    if (full !== lastHtml) {
      const fresh = guide.hidden;
      bubble.innerHTML = full; lastHtml = full;
      guide.hidden = false;
      if (fresh) { guide.classList.remove('pop'); void guide.offsetWidth; guide.classList.add('pop'); }
    }
  }
  function hide() {
    if (!guide.hidden) { guide.hidden = true; lastHtml = ''; }
    finger.hidden = true;
  }
  guide.addEventListener('click', e => {
    if (!e.target.closest('.guide-next')) return;
    sfx.tap();
    if (tipOpen) { tipOpen = null; hide(); return; }
    const n = st();
    if (n === STEPS.length - 1) finish(); else setStep(n + 1);
  });
  function finish() {
    game.s.tutorial.step = -1;
    game.s.tutorial.done = true;
    game.s.nextContractAt = Date.now() + 60_000;
    track('tutorial_step', { step: 'done' });
    hide();
    document.body.classList.remove('tutorial');
    save();
  }

  // the bouncing arrow: above an element, or above a building in the world; it points up
  // from below instead when the bubble is in the way
  function pointAt(target) {
    let x, top, bottom;
    if (!target) { finger.hidden = true; return; }
    if (target.lot) { const p = world.screenOf(target.lot); if (!p) { finger.hidden = true; return; } x = p.x; top = p.y - 6; bottom = p.y + 26; }
    else { if (!visible(target)) { finger.hidden = true; return; } const r = target.getBoundingClientRect(); x = r.left + r.width / 2; top = r.top - 4; bottom = r.bottom + 4; }
    const box = guide.hidden ? null : bubble.getBoundingClientRect();
    const up = box && top - 48 < box.bottom && top > box.top - 10 && x > box.left - 20 && x < box.right + 20;
    finger.hidden = false;
    finger.classList.toggle('up', !!up);
    finger.style.transform = `translate(${x.toFixed(1)}px, ${(up ? bottom : top).toFixed(1)}px)`;
  }

  // ---- naming a town ----
  function askName(worldId, then) {
    const pool = NAMES[worldId] || NAMES.colorado;
    let typed = game.townName(worldId, true) || pool[Math.floor(Math.random() * pool.length)];
    openModal(`
      <div class="big-icon">${SIGN}</div>
      <h2>Name your town</h2>
      <div class="name-row"><input id="town-input" class="name-input" maxlength="22" autocomplete="off" autocapitalize="words" spellcheck="false" value="${typed}" aria-label="Town name"><button class="icon-sm" data-act="dice" aria-label="Suggest a name">${DICE}</button></div>
      <button class="btn green" data-act="name">Found my town</button>`, act => {
      if (act === 'dice') { game.setTownName(worldId, pool[(pool.indexOf(typed) + 1) % pool.length]); askName(worldId, then); return; }
      if (act === 'name') {
        game.setTownName(worldId, clean(typed) || pool[0]);
        track('town_named', { world: worldId });
        sfx.reward(); onRename?.(); save(); then?.();
      }
    }, () => { game.setTownName(worldId, clean(typed) || pool[0]); onRename?.(); then?.(); });
    const input = document.getElementById('town-input');
    if (input) {
      input.addEventListener('input', () => { typed = input.value; });
      input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); document.querySelector('#modal [data-act=name]')?.click(); } });
      setTimeout(() => { input.focus(); input.select(); }, 50);
    }
  }

  return {
    get active() { const n = st(); return n != null && n >= 0; },
    askName,
    // a brand-new game: the will, naming the town, then the two pointers
    start() {
      if (st() !== 0) return;
      game.s.nextContractAt = Date.now() + 1e12;   // no orders until the tutorial is done
      document.body.classList.add('tutorial');
      openModal(`
        <div class="scroll" aria-label="Great-uncle Walt's will">
          <div class="scroll-rod"></div>
          <div class="scroll-paper">
            <p class="scroll-head">Last Will &amp; Testament</p>
            <p class="scroll-body">To my long-lost relative,<br>I leave you my old ore mine.<br>Build something big.</p>
            <p class="scroll-sig">Walt Bolton</p>
            ${WAX}
          </div>
          <div class="scroll-rod"></div>
        </div>
        <button class="btn gold" data-act="keys">${KEY} Take the keys</button>`, () => {
        sfx.reward(); askName(game.s.current, () => setStep(1));
      }, () => askName(game.s.current, () => setStep(1)));
    },
    // every frame: keep the bubble and the arrow up to date, and move on when a step is done.
    // `blocked` is true while a pop-up window is open, so she waits behind it.
    frame(blocked) {
      if (tipOpen) {
        if (blocked || tipOpen.hold?.()) { hide(); return; }   // hold: step aside for now (e.g. while its panel is open)
        if (tipOpen.done?.()) { tipOpen = null; hide(); return; }
        show(typeof tipOpen.say === 'function' ? tipOpen.say() : tipOpen.say, tipOpen.next || 'Got it');
        pointAt(tipOpen.lot ? { lot: tipOpen.lot } : null);
        return;
      }
      const n = st();
      if (n == null || n < 1 || blocked) { if (n == null || n < 0) document.body.classList.remove('tutorial'); hide(); return; }
      document.body.classList.add('tutorial');
      const s = STEPS[n];
      if (!s) { finish(); return; }   // saves from the longer tutorial: it's done
      if (shown !== n) { shown = n; s.enter?.(); }
      if (s.done?.()) { sfx.milestone?.(); if (n === STEPS.length - 1) finish(); else setStep(n + 1); return; }
      const back = s.lost?.(); if (back != null) { setStep(back); return; }
      show(s.say(), s.next);
      pointAt(s.point?.() || null);
    },
    finish,
    // a one-off tip in the same speech bubble, pointing at a building; it closes with
    // "Got it" or once done() turns true. Waits until the opening tutorial is over.
    tip(t) { const n = st(); if (n != null && n >= 0) return false; tipOpen = t; return true; },
    get tipping() { return !!tipOpen; },
  };
}
