// Save storage: Capacitor Preferences on a phone (survives app updates),
// localStorage in a browser. Every call is wrapped so a blocked storage never crashes the game.
import { Capacitor } from '@capacitor/core';

let prefs = null;
async function native() {
  if (!Capacitor.isNativePlatform()) return null;
  if (!prefs) prefs = (await import('@capacitor/preferences')).Preferences;
  return prefs;
}

export async function load(key) {
  try {
    const p = await native();
    const raw = p ? (await p.get({ key })).value : localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function save(key, data) {
  try {
    const raw = JSON.stringify(data);
    const p = await native();
    if (p) await p.set({ key, value: raw }); else localStorage.setItem(key, raw);
  } catch { /* ignore */ }
}

export async function clear(key) {
  try {
    const p = await native();
    if (p) await p.remove({ key }); else localStorage.removeItem(key);
  } catch { /* ignore */ }
}
