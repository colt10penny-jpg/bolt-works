// Rewarded ads. On a phone this uses Google AdMob; in a browser it shows a simulated test ad
// so the whole flow can be played and tested. Every caller just does:
//   if (await ads.showRewarded('boost')) { give the reward }
import { Capacitor } from '@capacitor/core';
import { ADMOB } from './config.js';

const isNative = Capacitor.isNativePlatform();
let AdMob = null, Events = null;
let ready = false, loading = null;

async function initNative() {
  const mod = await import('@capacitor-community/admob');
  AdMob = mod.AdMob; Events = mod.RewardAdPluginEvents;
  try {
    const info = await AdMob.requestConsentInfo();
    if (!info.canRequestAds && info.isConsentFormAvailable) await AdMob.showConsentForm();
  } catch { /* consent not configured yet: continue */ }
  if (Capacitor.getPlatform() === 'ios') { try { await AdMob.requestTrackingAuthorization(); } catch {} }
  await AdMob.initialize({ initializeForTesting: ADMOB.testing });
  preload();
}

function adId() {
  return Capacitor.getPlatform() === 'ios' ? ADMOB.rewarded.ios : ADMOB.rewarded.android;
}

function preload() {
  if (!isNative || ready || loading) return loading;
  loading = AdMob.prepareRewardVideoAd({ adId: adId(), isTesting: ADMOB.testing })
    .then(() => { ready = true; })
    .catch(() => { ready = false; })
    .finally(() => { loading = null; });
  return loading;
}

async function showNative() {
  if (!ready) { await preload(); if (!ready) return false; }
  ready = false;
  return new Promise(resolve => {
    let rewarded = false;
    const subs = [];
    const done = () => { subs.forEach(s => s.then(h => h.remove())); preload(); resolve(rewarded); };
    subs.push(AdMob.addListener(Events.Rewarded, () => { rewarded = true; }));
    subs.push(AdMob.addListener(Events.Dismissed, done));
    subs.push(AdMob.addListener(Events.FailedToShow, done));
    AdMob.showRewardVideoAd().catch(done);
  });
}

// ---- Browser stand-in: a short, skippable-after-countdown test ad ----
function showSimulated(reason) {
  return new Promise(resolve => {
    const el = document.getElementById('sim-ad');
    const btn = el.querySelector('button');
    const bar = el.querySelector('.sim-bar i');
    const sec = 5;
    el.querySelector('.sim-why').textContent = reason;
    el.hidden = false;
    btn.disabled = true;
    const t0 = performance.now();
    const iv = setInterval(() => {
      const e = (performance.now() - t0) / 1000;
      bar.style.width = Math.min(100, (e / sec) * 100) + '%';
      if (e < sec) btn.textContent = `Reward in ${Math.ceil(sec - e)}s`;
      else { clearInterval(iv); btn.disabled = false; btn.textContent = 'Claim reward'; btn.focus(); }
    }, 100);
    btn.onclick = () => { clearInterval(iv); el.hidden = true; resolve(true); };
  });
}

export const ads = {
  async init() { if (isNative) { try { await initNative(); } catch { /* ads unavailable */ } } },
  isSimulated: !isNative,
  async showRewarded(reason) {
    try { return isNative ? await showNative() : await showSimulated(reason); }
    catch { return false; }
  },
};
