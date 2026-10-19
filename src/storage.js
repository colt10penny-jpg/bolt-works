// Save storage: Capacitor Preferences on a phone (survives app updates),
// localStorage in a browser. Every call is wrapped so a blocked storage never crashes the game.
//
// Note: the Preferences plugin object must never be returned from an async function or
// passed to resolve(). Capacitor plugin objects answer to any property name, so the
// promise machinery treats them as "thenables" and the await never finishes.
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

const native = Capacitor.isNativePlatform();

export async function load(key) {
  try {
    const raw = native ? (await Preferences.get({ key })).value : localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function save(key, data) {
  try {
    const raw = JSON.stringify(data);
    if (native) await Preferences.set({ key, value: raw }); else localStorage.setItem(key, raw);
  } catch { /* ignore */ }
}

export async function clear(key) {
  try {
    if (native) await Preferences.remove({ key }); else localStorage.removeItem(key);
  } catch { /* ignore */ }
}
