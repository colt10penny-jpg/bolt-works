// App-wide settings. Swap the AdMob IDs here for your real ones before release.
// The IDs below are Google's official TEST IDs: they always show test ads and never pay out.
export const ADMOB = {
  testing: true,
  rewarded: {
    android: 'ca-app-pub-3940256099942544/5224354917',
    ios: 'ca-app-pub-3940256099942544/1712485313',
  },
};

// Anonymous play stats (PostHog). Leave posthogKey empty to turn tracking off.
// The project key is meant to be public; it can only send events, not read them.
export const ANALYTICS = {
  posthogKey: 'phc_uFLGLoCrwfXGmDvvvdiKNnmFHQP8yVDcYouhg5NaBMgD',
  posthogHost: 'https://us.i.posthog.com',
  appVersion: '0.68.0',
};

export const GAME = {
  saveKey: 'boltworks.save.v5',
  offlineCapHours: 24,    // the longest time away that counts (headquarters and storage set their own limits)
  boostMinutesPerAd: 30,  // each boost ad adds this much ×2 time
  boostMaxMinutes: 240,   // boost time can stack up to this
  cashAdMinutes: 1,       // "watch ad for cash" gives at least this many minutes of income
};
