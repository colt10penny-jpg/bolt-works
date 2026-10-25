# Engineer Empire — Icon-Inspired Visual Redesign

> **Status:** Design and implementation plan only. No gameplay or rendering code has been changed in this branch yet.

## Safe baseline and collaboration

- Baseline: `main` at commit `2dbdc7b4f6df367e9fd1f84abeef0457cb0e49e3` (2026-10-25).
- Restore point: `backup/pre-visual-redesign-2026-10-25`.
- Experiment only on `visual-redesign/icon-style-v1`. Do not push experimental code to `main`, merge a PR, or alter the GitHub Pages publishing workflow without approval.
- Claude may continue development on `main`, but coordinate if both assistants edit the *same file*, and rebase/merge deliberately rather than overwriting each other's work.
- The existing Pages and Android workflows trigger on `main`, so keeping the experiment on this branch avoids replacing the currently deployed game.
- Git protects code history, **not** user play progress. Existing saves are stored in browser localStorage or native Capacitor Preferences. Use a separate browser origin/profile and device test installation for experiments, and do not modify save schema/economy.

## Art direction

Reference: the approved Engineer Empire app icon in the project conversation, **not** a file to paste over the game world.

A vivid, readable miniature 3D factory world:
- Isometric/fixed-angle, chunky low-poly geometry, distinct clean silhouettes, restrained fine details.
- Orange/yellow industrial accents, cobalt-blue and pale factory roofs, warm windows, lively green terrain and conifer trees.
- Soft directional lighting, purposeful shadows and depth cues, controlled bloom; maintain good FPS on mid-range phones.
- Unique biomes: Colorado woodland (green), frontier desert (sand/gold), Moon (gray cratered regolith), Mars (rust/red rock colonies).
- Progression visualized through rockets and a **floating-island world-selection experience**, while actual towns retain gameplay-valid lots/roads.

## Proposed passes

### Pass 1 — Visual style polish (lowest risk)
- `src/fx.js`: tune color grade, contrast, horizon haze, soft shadows; offer an easy revert / optional preview flag.
- `src/world.js`: verify camera framing and light angles across portrait devices and all four worlds; do not alter touch selection or navigation.
- `src/models.js` and `src/buildings*.js`: tighten palette and trim consistency, not overhaul entire building categories at once.
- Benchmark render performance, especially shader composer, shadow-map use and draw calls.

### Explicitly out of scope — Floating islands
- The owner has asked to **keep all four worlds as normal ground-based maps** for now. No floating-island gameplay terrain or world-selection scene should be added.
- Preserve existing world switching, unlock progression, world map UI and gameplay layout.

### Pass 2 — In-game environmental cohesion
- `src/terrain.js` and `src/world.js`: stylize terrain edge treatment, tree groupings, roads, lot pads, rock and scenery placement. Keep all world coordinates, driveways, collision/pick targets and town layout functional.
- Improve terrain palette, rock/tree contrast and biome-appropriate scenery without changing landscape topology or introducing floating terrain.
- Ensure Mars and Moon feel differentiated rather than recolored versions of the same settlement.

### Pass 3 — Rocket and transitions
- `src/rockets.js` and world travel in `src/main.js`: make launch and world travel reinforce the promise of progressing between miniature worlds.
- Do not change launch prices, unlocked worlds, ads, progression mechanics or saves.

## Changes implemented on the experimental branch (first pass)
- Brighter filmic lighting, gentler shadows and more balanced color grading in `src/fx.js`.
- Softer toy-like building materials in `src/models.js` and bright readable factory roofs in `src/buildings.js`.
- Brighter terrain colors, richer low-poly trees, biome-appropriate contact shadows in `src/terrain.js`.
- Clearer orange rocket exhaust and a blue viewport on the classic launcher in `src/rockets.js`.
- **No** gameplay, level layout, economy, storage, or world map edits.

## Test / acceptance checklist

- [ ] Compare screenshots on a common portrait phone size for Colorado, desert, Moon and Mars, before and after.
- [ ] Check day/night readability, camera framing, text contrast, touch target readability and animation clarity.
- [ ] Verify tapping/upgrading buildings, navigation, trucks, contracts, rocket launches and world travel.
- [ ] Confirm test saves load and remain compatible. Don't change `src/state.js` data schema.
- [ ] Confirm `npm run build` succeeds and evaluate Android/iOS before deployment.
- [ ] Measure FPS and memory on a real midrange device; tune visual features rather than add expensive effects indiscriminately.
- [ ] Present before/after screenshots and changed-file list in a **draft** PR for user approval; never auto-merge.

## Local preview

```bash
git fetch origin
git switch visual-redesign/icon-style-v1
npm ci
npm run dev
```

Use a distinct local origin/browser profile to avoid modifying current web play saves. To return to current code: `git switch main`.

**Do not consider this redesign approved until the owner compares both looks and explicitly chooses to merge.**
