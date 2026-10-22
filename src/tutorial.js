// The opening of the game: a letter from your late great-uncle's lawyers, naming your
// town, and then Rosie, his old foreman, pops up at the bottom of the screen and shows
// you the ropes (collect, upgrade, clear land, build the Steel Furnace). She pops up
// again later for a few one-off tips. Every world you reach asks you to name its town.
//
// Progress lives in game.s.tutorial.step (a number; -1 means finished or skipped), so
// closing the app mid-way picks up where you left off.
import { track } from './analytics.js';
import { renderRosie } from './rosie3d.js';

export const UNCLE = 'Walter "Walt" Bolton';

const KEY = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="7.5" cy="15.5" r="4.5"/><path d="M10.7 12.3 20 3m-3 3 2.5 2.5M14.5 8.5l2 2"/></svg>';
const DICE = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.4" fill="currentColor"/><circle cx="16" cy="16" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>';
const SIGN = '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M12 2v20"/><path d="M4 5h13l3 3-3 3H4z"/><path d="M20 13H7l-3 3 3 3h13z"/></svg>';
const NAMES = {
  colorado: ['Rivet Ridge', 'Bolton Springs', 'Copper Gulch', 'Iron Hollow', 'Gearwood', 'Sprocket Falls', 'Anvil Creek', 'Steelhaven'],
  desert: ['Sunbolt', 'Dusty Gear', 'Mesa Forge', 'Cactus Coil', 'Sandspark', 'Mirage Mill'],
  moon: ['Tranquility Works', 'Crater Point', 'Lunaburg', 'Moonbolt', 'Dustfall Base', 'New Bolton'],
};
const clean = s => (s || '').replace(/[<>&"]/g, '').replace(/\s+/g, ' ').trim().slice(0, 22);

export function createTutorial(ctx) {
  const { game, world, openModal, sfx, save, onRename } = ctx;
  const $ = id => document.getElementById(id);
  const guide = $('guide'), bubble = $('guide-bubble'), finger = $('tut-finger');
  // Rosie is drawn in 3D once, the first time she's needed, into a few still frames
  let frames = null;
  const img = document.createElement('img'); img.alt = ''; img.className = 'rosie-img'; $('guide-char').appendChild(img);
  const ensureFrames = () => { if (!frames) { try { frames = renderRosie(300, 420); } catch { frames = {}; } img.src = frames.idle0 || ''; } };
  let anim = 0, animUntil = 0, talkUntil = 0;
  function animate() {
    clearInterval(anim);
    anim = setInterval(() => {
      const now = performance.now(), k = Math.floor(now / 150);
      if (!frames?.idle0) return;
      const talk = now < talkUntil, wave = now < animUntil && Math.floor(now / 300) % 2 === 1;
      img.src = talk ? (k % 2 ? frames[wave ? 'talk1' : 'talk0'] : frames[wave ? 'idle1' : 'idle0']) : frames[wave ? 'idle1' : 'idle0'];
      if (now > animUntil && now > talkUntil) { clearInterval(anim); img.src = frames.idle0; }
    }, 75);
  }
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

  // each step: what Rosie says, what to point at, and when it's done
  const STEPS = [
    { id: 'letter' },   // the will and naming the town (modals; see start())
    {
      id: 'meet', next: "Let's go!",
      say: () => `Welcome to <b>${town()}</b>! I'm Rosie. I worked for your great-uncle Walt. Let me show you around.`,
    },
    {
      id: 'collect',
      say: () => `This is <b>your Ore Mine</b>! It digs up ore and makes money. Tap the <b>coin</b> to collect it.`,
      enter: () => { const b = game.run.bins; b.mine = Math.max(b.mine || 0, 12); },
      point: () => label(mineLot()),
      done: () => game.s.tutorial.collected,
    },
    {
      id: 'open',
      say: () => `Nice! Now tap the <b>mine</b> to see what it can do.`,
      point: () => ({ lot: mineLot() }),
      done: () => world.selected === mineLot(),
    },
    {
      id: 'upgrade',
      say: () => `Use your money to <b>upgrade</b> it. A bigger mine makes more money!`,
      point: () => document.querySelector('#sheet [data-act=upgrade]'),
      done: () => game.level('mine') >= 2,
      lost: () => world.selected !== mineLot() ? 3 : null,
    },
    {
      id: 'grow',
      say: () => `Keep collecting and upgrading. Get it to <b>level 5</b>! <span class="guide-count">${Math.min(5, game.level('mine'))}/5</span>`,
      point: () => {
        const btn = world.selected === mineLot() && document.querySelector('#sheet [data-act=upgrade]:not([disabled])');
        if (btn) return btn;
        if (coin()) return coin();
        return world.selected === mineLot() ? null : { lot: mineLot() };
      },
      done: () => game.level('mine') >= 5,
    },
    {
      id: 'growing', next: 'Got it',
      say: () => `Look at it grow! Every few levels your buildings get <b>bigger</b> and make <b>twice as much</b>.`,
      enter: () => world.select(null),
    },
    {
      id: 'clear',
      say: () => {
        const q = game.developQuote(furnaceLot());
        return game.canAfford(q.total)
          ? `Next: a <b>Steel Furnace</b>. Tap the <b>+</b> to clear the land next door.`
          : `Next: a <b>Steel Furnace</b>. Save up <b>$${Math.ceil(q.total)}</b> to clear the land next door.`;
      },
      point: () => game.canAfford(game.developQuote(furnaceLot()).total)
        ? (world.selected === furnaceLot() ? document.querySelector('#sheet [data-act=develop]') : (visible(label(furnaceLot())) ? label(furnaceLot()) : { lot: furnaceLot() }))
        : coin(),
      done: () => game.developed(furnaceLot()),
    },
    {
      id: 'build',
      say: () => game.canAfford(game.buildCost('furnace'))
        ? `Now <b>build</b> the Steel Furnace!`
        : `Save up <b>$${Math.ceil(game.buildCost('furnace'))}</b> to build the Steel Furnace.`,
      point: () => world.selected === furnaceLot() ? document.querySelector('#sheet [data-act=build]:not([disabled])') : (game.canAfford(game.buildCost('furnace')) ? (visible(label(furnaceLot())) ? label(furnaceLot()) : { lot: furnaceLot() }) : coin()),
      done: () => game.built('furnace'),
    },
    {
      id: 'wait',
      say: () => `The builders are on it!`,
      done: () => game.built('furnace') && !game.jobOf('furnace'),
    },
    {
      id: 'trucks', next: 'Got it',
      say: () => `The furnace turns ore into <b>steel</b>, which is worth more. Keep your mine upgraded so it never runs out!`,
      enter: () => world.select(null),
    },
    {
      id: 'end', next: "Let's do it!",
      say: () => `Each new factory makes something worth more. Walt dreamed of launching a <b>rocket</b> from ${town()}. Let's make it happen!`,
    },
  ];

  // ---- Rosie on screen ----
  let shown = -2, lastHtml = '', tipOpen = false;
  function show(html, next) {
    const full = `<span class="guide-text">${html}</span>${next ? `<button class="btn small green guide-next">${next}</button>` : ''}`;
    if (full !== lastHtml) {
      const fresh = guide.hidden;
      bubble.innerHTML = full; lastHtml = full;
      guide.hidden = false;
      if (fresh) { guide.classList.remove('pop'); void guide.offsetWidth; guide.classList.add('pop'); }
      // she waves when she pops up, and talks for a moment whenever she says something new
      ensureFrames();
      const now = performance.now();
      if (fresh) animUntil = now + 1500;
      talkUntil = now + 1300;
      animate();
    }
  }
  function hide() {
    if (!guide.hidden) { guide.hidden = true; lastHtml = ''; }
    finger.hidden = true;
  }
  guide.addEventListener('click', e => {
    if (!e.target.closest('.guide-next')) return;
    sfx.tap();
    if (tipOpen) { tipOpen = false; hide(); return; }
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
  // from below instead when Rosie's bubble is in the way
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
      <p>Every great town needs a name. What will yours be called?</p>
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
    // a brand-new game: the will, naming the town, then Rosie
    start() {
      if (st() !== 0) return;
      game.s.nextContractAt = Date.now() + 1e12;   // no orders until the tutorial is done
      document.body.classList.add('tutorial');
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
        <button class="btn gold" data-act="keys">${KEY} Take the keys</button>`, () => {
        sfx.reward(); askName(game.s.current, () => setStep(1));
      }, () => askName(game.s.current, () => setStep(1)));
    },
    // every frame: keep Rosie's words and the arrow up to date, and move on when a step is done.
    // `blocked` is true while a pop-up window is open, so she waits behind it.
    frame(blocked) {
      if (tipOpen) { if (blocked) hide(); return; }
      const n = st();
      if (n == null || n < 1 || blocked) { if (n == null || n < 0) document.body.classList.remove('tutorial'); hide(); return; }
      document.body.classList.add('tutorial');
      const s = STEPS[n];
      if (!s) return;
      if (shown !== n) { shown = n; s.enter?.(); }
      if (s.done?.()) { sfx.milestone?.(); setStep(n + 1); return; }
      const back = s.lost?.(); if (back != null) { setStep(back); return; }
      show(s.say(), s.next);
      pointAt(s.point?.() || null);
    },
    finish,
    // one-off tips after the tutorial: Rosie pops up with a button to say thanks
    tip(id, html) {
      const seen = (game.s.tutorial.tips ||= {});
      if (seen[id] || (st() != null && st() >= 0) || tipOpen) return;
      seen[id] = true;
      tipOpen = true;
      finger.hidden = true;
      show(html, 'Thanks, Rosie!');
      save();
    },
  };
}
