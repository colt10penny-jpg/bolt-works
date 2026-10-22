// The opening of the game: a letter from your late great-uncle's lawyers, and then Rosie,
// his old foreman, walks you through the first few minutes (collect, upgrade, clear land,
// build the Steel Furnace). She pops up again later for a couple of one-off tips.
//
// Progress lives in game.s.tutorial.step (a number; -1 means finished or skipped), so
// closing the app mid-way picks up where you left off.
import { track } from './analytics.js';

export const UNCLE = 'Walter "Walt" Bolton';

const ROSIE = `<svg viewBox="0 0 64 64" width="56" height="56" aria-hidden="true">
  <circle cx="32" cy="32" r="31" fill="#8fc3e8"/>
  <path d="M10 64c2-13 11-19 22-19s20 6 22 19z" fill="#2f6fb0"/>
  <path d="M26 45l6 7 6-7" fill="#f2c94c"/>
  <rect x="27" y="38" width="10" height="9" rx="3" fill="#d9a07a"/>
  <ellipse cx="32" cy="29" rx="12" ry="13" fill="#e8b48f"/>
  <path d="M20 30c-2-9 3-14 12-14s14 5 12 14c-1-5-4-7-12-7s-11 2-12 7z" fill="#cfcfd4"/>
  <circle cx="27.5" cy="30" r="1.6" fill="#2a2a2e"/><circle cx="36.5" cy="30" r="1.6" fill="#2a2a2e"/>
  <path d="M27 36.5c3 2.4 7 2.4 10 0" stroke="#8a4b3a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
  <path d="M17 21c0-9 7-14 15-14s15 5 15 14z" fill="#ffc23d"/>
  <rect x="14" y="20" width="36" height="4" rx="2" fill="#e0a51e"/>
  <rect x="30" y="7" width="4" height="13" rx="2" fill="#e0a51e"/>
</svg>`;
const KEY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3m-3 3 2.5 2.5M14.5 8.5l2 2"/></svg>';

export function createTutorial(ctx) {
  const { game, world, def, openModal, sfx, save } = ctx;
  const $ = id => document.getElementById(id);
  const coach = $('coach'), finger = $('tut-finger');
  const t = game.s.tutorial;
  const st = () => game.s.tutorial.step;
  const setStep = n => {
    game.s.tutorial.step = n;
    track('tutorial_step', { step: STEPS[n]?.id || 'done' });
    shown = -2;
    save();
  };

  // mine money is shown once there's something to pick up
  const mineLot = () => world.lotsOf('mine')[0] || 'q0';
  const furnaceLot = () => 'q1';
  const label = lot => world.lots[lot]?.label;
  const visible = el => el && !el.hidden && el.offsetParent !== null && el.getBoundingClientRect().width > 0;

  // each step: what Rosie says, what to point at, and when it's done
  const STEPS = [
    { id: 'letter' },   // the will (a modal; see start())
    {
      id: 'meet', next: 'Nice to meet you',
      say: () => `You must be Walt's kin! I'm <b>Rosie</b>. I ran this mine for your great-uncle for thirty years. It's been quiet since he passed. Let's wake it up.`,
    },
    {
      id: 'collect',
      say: () => `The old ${def('mine').name} never stopped digging. Tap the <b>coin</b> above it to collect what it's earned.`,
      enter: () => { const b = game.run.bins; b.mine = Math.max(b.mine || 0, 12); },
      point: () => label(mineLot()),
      done: () => t.collected,
    },
    {
      id: 'open',
      say: () => `Now tap the <b>${def('mine').name}</b> itself to look it over.`,
      point: () => ({ lot: mineLot() }),
      done: () => world.selected === mineLot(),
    },
    {
      id: 'upgrade',
      say: () => `Put that money to work: <b>upgrade</b> it. A bigger mine digs more ore, and more ore means more money.`,
      point: () => document.querySelector('#sheet [data-act=upgrade]'),
      done: () => game.level('mine') >= 2,
      lost: () => world.selected !== mineLot() ? 3 : null,   // closed the panel: go back a step
    },
    {
      id: 'grow',
      say: () => `Walt's rule: <b>collect, upgrade, repeat</b>. Get the mine to <b>level 5</b> and watch what happens. (Level ${Math.min(5, game.level('mine'))}/5)`,
      point: () => {
        const btn = world.selected === mineLot() && document.querySelector('#sheet [data-act=upgrade]:not([disabled])');
        if (btn) return btn;
        const coin = label(mineLot());
        if (visible(coin) && coin.classList.contains('cash')) return coin;
        return world.selected === mineLot() ? null : { lot: mineLot() };
      },
      done: () => game.level('mine') >= 5,
    },
    {
      id: 'growing', next: 'Got it',
      say: () => `See that? Every few levels your buildings grow and <b>double their output</b>. Next stop: levels 10, 25, 50, 100 and 250.`,
      enter: () => world.select(null),
    },
    {
      id: 'clear',
      say: () => {
        const q = game.developQuote(furnaceLot());
        return game.canAfford(q.total)
          ? `Walt saved the spot next door for a <b>${def('furnace').name}</b>. Tap the <b>+</b> to clear the land and fix the old roads.`
          : `Walt saved the spot next door for a <b>${def('furnace').name}</b>. Save up <b>$${Math.ceil(q.total)}</b> to clear it (you have $${Math.floor(game.cash)}). Keep collecting and upgrading!`;
      },
      point: () => game.canAfford(game.developQuote(furnaceLot()).total)
        ? (world.selected === furnaceLot() ? document.querySelector('#sheet [data-act=develop]') : (visible(label(furnaceLot())) ? label(furnaceLot()) : { lot: furnaceLot() }))
        : (visible(label(mineLot())) && label(mineLot()).classList.contains('cash') ? label(mineLot()) : null),
      done: () => game.developed(furnaceLot()),
    },
    {
      id: 'build',
      say: () => game.canAfford(game.buildCost('furnace'))
        ? `Cleared! Now <b>build the ${def('furnace').name}</b>.`
        : `Cleared! Save <b>$${Math.ceil(game.buildCost('furnace'))}</b> to build the ${def('furnace').name}.`,
      point: () => world.selected === furnaceLot() ? document.querySelector('#sheet [data-act=build]:not([disabled])') : (game.canAfford(game.buildCost('furnace')) ? (visible(label(furnaceLot())) ? label(furnaceLot()) : { lot: furnaceLot() }) : null),
      done: () => game.built('furnace'),
    },
    {
      id: 'wait',
      say: () => `The builders are on it. It only takes a few seconds.`,
      done: () => game.built('furnace') && !game.jobOf('furnace'),
    },
    {
      id: 'trucks', next: 'Makes sense',
      say: () => `The ${def('furnace').name} turns ore into <b>steel</b>, which sells for more. Trucks haul the ore over, so keep the mine upgraded or the furnace runs short.`,
      enter: () => world.select(null),
    },
    {
      id: 'end', next: "Let's get to work",
      say: () => `That's how Walt built things: every new factory turns the last one's goods into something worth more. He always dreamed of launching a <b>rocket</b> from here. Maybe you're the one to do it.`,
    },
  ];

  let shown = -2, lastText = '';
  function render() {
    const n = st();
    if (n == null || n < 1 || n >= STEPS.length) { coach.hidden = true; finger.hidden = true; document.body.classList.remove('tutorial'); return; }
    document.body.classList.add('tutorial');
    const s = STEPS[n];
    if (shown !== n) { shown = n; s.enter?.(); }
    const html = `<span class="coach-face">${ROSIE}</span><span class="coach-body"><b class="coach-name">Rosie</b><span class="coach-text">${s.say()}</span>${s.next ? `<button class="btn small green coach-next">${s.next}</button>` : ''}</span>`;
    if (html !== lastText) { coach.innerHTML = html; lastText = html; coach.hidden = false; }
  }
  coach.addEventListener('click', e => {
    if (!e.target.closest('.coach-next')) return;
    sfx.tap();
    const n = st();
    if (n === STEPS.length - 1) finish(); else setStep(n + 1);
  });
  function finish() {
    game.s.tutorial.step = -1;
    game.s.tutorial.done = true;
    game.s.nextContractAt = Date.now() + 60_000;
    track('tutorial_step', { step: 'done' });
    coach.hidden = true; finger.hidden = true;
    document.body.classList.remove('tutorial');
    save();
  }

  // the bouncing arrow: above an element, or above a building in the world
  // (it points down from above, or up from below when Rosie's card is in the way)
  function pointAt(target) {
    let x, top, bottom;
    if (!target) { finger.hidden = true; return; }
    if (target.lot) { const p = world.screenOf(target.lot); if (!p) { finger.hidden = true; return; } x = p.x; top = p.y - 6; bottom = p.y + 26; }
    else { if (!visible(target)) { finger.hidden = true; return; } const r = target.getBoundingClientRect(); x = r.left + r.width / 2; top = r.top - 4; bottom = r.bottom + 4; }
    const card = coach.hidden ? null : coach.getBoundingClientRect();
    const up = card && top - 48 < card.bottom && top > card.top - 10;
    finger.hidden = false;
    finger.classList.toggle('up', !!up);
    finger.style.transform = `translate(${x.toFixed(1)}px, ${(up ? bottom : top).toFixed(1)}px)`;
  }

  return {
    get active() { const n = st(); return n != null && n >= 0; },
    // a brand-new game: the will, then Rosie
    start() {
      if (st() !== 0) { render(); return; }
      game.s.nextContractAt = Date.now() + 1e12;   // no orders until the tutorial is done
      openModal(`
        <div class="letter">
          <div class="letter-head">Hargrove &amp; Finch &middot; Attorneys at Law &middot; Golden, Colorado</div>
          <p>Dear heir,</p>
          <p>We are sorry to tell you that your great-uncle, <b>${UNCLE}</b>, has passed away. You may not remember him. He left town before you were born. But he never forgot you.</p>
          <p>His will leaves everything to you:</p>
          <blockquote class="will">"To my long-lost great-niece or great-nephew, I leave <b>Bolt Works</b>: one ore mine, the land around it, and every dream I didn't get to finish. The mine still runs if you're kind to it. Build something big. Build it all the way to the stars."<span class="sig">Walt</span></blockquote>
          <p>The keys are enclosed. Rosie, his foreman, will meet you at the gate.</p>
          <p class="letter-sign">Yours sincerely,<br><span class="sig small">E. Hargrove</span></p>
          <span class="seal" aria-hidden="true">B</span>
        </div>
        <button class="btn gold" data-act="keys">${KEY} Take the keys</button>`, act => {
        if (act === 'keys') { sfx.reward(); setStep(1); }
      }, () => setStep(1));
    },
    // every frame: keep Rosie's words and the arrow up to date, and move on when a step is done
    frame() {
      const n = st();
      if (n == null || n < 1) { if (!coach.hidden) { coach.hidden = true; finger.hidden = true; } return; }
      const s = STEPS[n];
      if (!s) return;
      if (s.done?.()) { sfx.milestone?.(); setStep(n + 1); return; }
      const back = s.lost?.(); if (back != null) { setStep(back); return; }
      render();
      pointAt(s.point?.() || null);
    },
    finish,
    // one-off tips after the tutorial
    tip(id, html) {
      const seen = (game.s.tutorial.tips ||= {});
      if (seen[id] || (st() != null && st() >= 0)) return;
      seen[id] = true;
      openModal(`<div class="coach-modal"><span class="coach-face">${ROSIE}</span><div><b class="coach-name">Rosie</b><p>${html}</p></div></div><button class="btn green" data-act="dismiss">Thanks, Rosie</button>`);
      save();
    },
  };
}
