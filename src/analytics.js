// Anonymous play stats so we can see whether people come back (day 1 / day 7 retention).
// Sends a few events to PostHog. Nothing personal is sent: just a random player id
// made on first launch, the day number, and game progress.
// With no key in config.js this does nothing at all.
import { Capacitor } from '@capacitor/core';
import { ANALYTICS } from './config.js';

const enabled = !!ANALYTICS.posthogKey;
let player = null;
let queue = [];
let timer = 0;

export function initAnalytics(playerId) { player = playerId; }

export function track(event, props = {}) {
  if (!enabled || !player) return;
  queue.push({
    event,
    distinct_id: player,
    timestamp: new Date().toISOString(),
    properties: { ...props, platform: Capacitor.getPlatform(), app_version: ANALYTICS.appVersion, $process_person_profile: false },
  });
  clearTimeout(timer);
  timer = setTimeout(flush, 2000);
}

// Sent as plain text (no CORS preflight, which Safari can silently drop),
// and with sendBeacon when the page is closing so the last events still arrive.
export function flush(closing = false) {
  if (!enabled || !queue.length) return;
  const batch = queue; queue = [];
  const url = `${ANALYTICS.posthogHost}/batch/`;
  const body = JSON.stringify({ api_key: ANALYTICS.posthogKey, batch });
  try {
    if (closing && navigator.sendBeacon && navigator.sendBeacon(url, new Blob([body], { type: 'text/plain' }))) return;
    fetch(url, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body, keepalive: body.length < 60000 }).catch(() => {});
  } catch { /* offline or blocked: drop silently */ }
}

addEventListener('visibilitychange', () => { if (document.hidden) flush(true); });
addEventListener('pagehide', () => flush(true));
