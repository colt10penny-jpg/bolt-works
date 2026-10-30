// iCloud save sync and Game Center (iPhone and iPad only; everywhere else these quietly do
// nothing). The native side is ios/App/App/GameServicesPlugin.swift.
//
// iCloud: a copy of the save is kept in the player's iCloud, so their towns follow them to a
// new phone or an iPad and come back after deleting and reinstalling the game. There's no
// account and no sign-in: it uses the Apple ID the phone is already signed in to.
//
// Game Center: the player is signed in at start (usually just a small "Welcome back"
// banner), scores go to the leaderboards and achievements are reported as they're earned.
// The leaderboard and achievement ids below must match the ones set up in App Store Connect.
import { Capacitor, registerPlugin } from '@capacitor/core';

const ios = Capacitor.getPlatform() === 'ios';
const GS = ios ? registerPlugin('GameServices') : null;
export const available = !!GS;

// ---------- iCloud ----------
const KEY = 'save';
export async function cloudLoad() {
  if (!GS) return null;
  try { const { value } = await GS.cloudGet({ key: KEY }); return value ? JSON.parse(value) : null; } catch { return null; }
}
let lastPush = 0, pending = null;
// keep iCloud's copy up to date: at most about once a minute while playing (iCloud batches
// writes anyway), and straight away when asked (leaving the app, starting over)
export function cloudSave(state, now = false) {
  if (!GS) return;
  const go = () => { pending = null; lastPush = Date.now(); GS.cloudSet({ key: KEY, value: JSON.stringify(state) }).catch(() => {}); };
  if (now) { clearTimeout(pending); go(); return; }
  if (pending) return;
  const wait = Math.max(0, 60_000 - (Date.now() - lastPush));
  pending = setTimeout(go, wait);
}
export function onCloudChange(fn) { GS?.addListener('cloudChanged', fn); }

// how far along a save is, to tell which of two copies to keep: lifetime earnings, which
// only ever go up (rockets launched break a tie)
export const progressOf = s => (s?.totalEarned || 0) + (s?.launches || 0) * 1e-6;

// ---------- Game Center ----------
export const LEADERBOARDS = {
  empire: 'ee.empire_score',     // Empire score: 100 x log10(lifetime earnings), so it fits Game Center's numbers
  rockets: 'ee.rockets',          // rockets launched
  orders: 'ee.orders',            // orders filled
};
export const empireScore = s => Math.floor(100 * Math.log10(1 + Math.max(0, s?.totalEarned || 0)));
const achId = id => 'ee.' + id;   // the game's achievement ids, as set up in App Store Connect

let player = null;
export const gameCenter = () => player;
export async function signIn() {
  if (!GS) return null;
  try { const p = await GS.signIn(); player = p?.signedIn ? p : null; return player; } catch { return null; }
}
GS?.addListener('gameCenter', p => { player = p?.signedIn ? p : null; });

const sent = {};
export function submitScores(s) {
  if (!GS || !player) return;
  for (const [k, value] of Object.entries({ empire: empireScore(s), rockets: s.launches || 0, orders: s.contractsDone || 0 })) {
    if (sent[k] === value) continue;   // only when it's gone up
    sent[k] = value;
    GS.submitScore({ leaderboard: LEADERBOARDS[k], value }).catch(() => {});
  }
}
// report earned achievements (Game Center ignores ones it already has); `banner` shows
// Game Center's own banner as well as the game's toast
export function reportAchievements(ids, banner = false) {
  if (!GS || !player || !ids.length) return;
  GS.reportAchievements({ ids: ids.map(achId), banner }).catch(() => {});
}
export function showGameCenter(screen) {
  if (!GS || !player) return false;
  GS.show({ screen }).catch(() => {});
  return true;
}
