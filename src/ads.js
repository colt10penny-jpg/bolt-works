// Rewarded ads. On a phone this uses Google AdMob; in a browser it shows a simulated test ad
// so the whole flow can be played and tested. Every caller just does:
//   if (await ads.showRewarded('boost')) { give the reward }
// The player can close an ad before it's done; then it resolves false and there's no
// reward. `ads.last` says why the last ad gave nothing: 'cancelled' or 'unavailable'.
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
    // the reward only counts if AdMob says the ad was watched to the end; closing it
    // early (AdMob shows its own "close and lose the reward?" check) gives nothing
    let rewarded = false, shown = false, finished = false;
    const subs = [];
    const done = () => {
      if (finished) return; finished = true;
      subs.forEach(s => s.then(h => h.remove())); preload();
      ads.last = rewarded ? 'rewarded' : shown ? 'cancelled' : 'unavailable';
      resolve(rewarded);
    };
    subs.push(AdMob.addListener(Events.Showed, () => { shown = true; }));
    subs.push(AdMob.addListener(Events.Rewarded, () => { rewarded = true; }));
    subs.push(AdMob.addListener(Events.Dismissed, () => { shown = true; done(); }));
    subs.push(AdMob.addListener(Events.FailedToShow, done));
    AdMob.showRewardVideoAd().catch(done);
  });
}

// ---- Browser stand-in: a short test ad you can close at any time ----
// Like a real rewarded ad: the X closes it. Before the countdown ends it first asks
// "close and lose the reward?" (the countdown pauses); after that, closing keeps it.
function showSimulated(reason) {
  return new Promise(resolve => {
    const el = document.getElementById('sim-ad');
    const claim = el.querySelector('.sim-claim'), close = el.querySelector('.sim-close');
    const ask = el.querySelector('.sim-ask'), keep = el.querySelector('.sim-keep'), quit = el.querySelector('.sim-quit');
    const bar = el.querySelector('.sim-bar i');
    const sec = 5;
    let watched = 0, last = performance.now(), paused = false, earned = false;
    el.querySelector('.sim-why').textContent = reason;
    el.hidden = false; ask.hidden = true;
    claim.disabled = true; bar.style.width = '0%';
    const iv = setInterval(() => {
      const now = performance.now();
      if (!paused) watched += (now - last) / 1000;
      last = now;
      bar.style.width = Math.min(100, (watched / sec) * 100) + '%';
      if (watched < sec) claim.textContent = `Reward in ${Math.ceil(sec - watched)}s`;
      else if (!earned) { earned = true; claim.disabled = false; claim.textContent = 'Claim reward'; claim.focus(); }
    }, 100);
    const end = ok => {
      clearInterval(iv); el.hidden = true; ask.hidden = true;
      claim.onclick = close.onclick = keep.onclick = quit.onclick = null;
      ads.last = ok ? 'rewarded' : 'cancelled';
      resolve(ok);
    };
    claim.onclick = () => { if (earned) end(true); };
    close.onclick = () => { if (earned) end(true); else { paused = true; ask.hidden = false; keep.focus(); } };
    keep.onclick = () => { paused = false; ask.hidden = true; };
    quit.onclick = () => end(false);
  });
}

export const ads = {
  async init() { if (isNative) { try { await initNative(); } catch { /* ads unavailable */ } } },
  isSimulated: !isNative,
  last: null,
  async showRewarded(reason) {
    ads.last = 'unavailable';
    try { return isNative ? await showNative() : await showSimulated(reason); }
    catch { ads.last = 'unavailable'; return false; }
  },
};
