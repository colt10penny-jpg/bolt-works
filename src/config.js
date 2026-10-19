// App-wide settings. Swap the AdMob IDs here for your real ones before release.
// The IDs below are Google's official TEST IDs: they always show test ads and never pay out.
export const ADMOB = {
  testing: true,
  rewarded: {
    android: 'ca-app-pub-3940256099942544/5224354917',
    ios: 'ca-app-pub-3940256099942544/1712485313',
  },
};

export const GAME = {
  saveKey: 'boltworks.save.v1',
  offlineCapHours: 4,     // max hours of offline earnings
  boostMinutesPerAd: 30,  // each boost ad adds this much ×2 time
  boostMaxMinutes: 240,   // boost time can stack up to this
  cashAdMinutes: 15,      // "watch ad for cash" gives this many minutes of income
};
