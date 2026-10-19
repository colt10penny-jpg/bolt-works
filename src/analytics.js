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

export function flush() {
  if (!enabled || !queue.length) return;
  const batch = queue; queue = [];
  try {
    fetch(`${ANALYTICS.posthogHost}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: ANALYTICS.posthogKey, batch }),
      keepalive: true,
    }).catch(() => {});
  } catch { /* offline or blocked: drop silently */ }
}

addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
