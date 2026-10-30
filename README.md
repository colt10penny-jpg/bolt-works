# Engineer Empire

Idle factory game: a fixed-angle 3D town where you build and upgrade factories. Monetized with rewarded ads (Google AdMob).

## How it's built
- **Game:** JavaScript + three.js (`src/`), bundled with Vite.
- **Phone apps:** Capacitor wraps the game as an Android app (`android/`) and an iPhone app (`ios/`).
- **Ads:** `src/ads.js`. Simulated in the browser; AdMob on phones. IDs live in `src/config.js`, `android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist` (currently Google's test IDs).

## Where to change things
- Economy numbers (costs, income, speed bonuses, supply chain, launch points): `src/economy.js`
- Contracts, daily reward, rocket launch rules: `src/state.js`
- Sounds: `src/sound.js` · Play stats: `src/analytics.js`
- Ad rewards and offline limits: `src/config.js`
- Building models (swap for real 3D art later): `src/models.js`
- Town layout, camera, traffic: `src/world.js`
- Screens and buttons: `src/main.js`, `src/style.css`

## Friend test
- `.github/workflows/pages.yml` publishes the browser version to GitHub Pages (needs a public repo and Pages set to GitHub Actions).
- Anonymous play stats go to PostHog when `ANALYTICS.posthogKey` is set in `src/config.js`. Events: `first_open`, `app_open` (with `day_number`), `factory_built`, `ad_watched`, `contract_done`, `rocket_launched`, `daily_claimed`.

## Builds
Every push to `main` builds an Android test app (APK) with GitHub Actions. Download it from the run's **Artifacts** section.

## Local commands
```
npm install
npm run dev        # play in a browser
npm run build      # build for the phone apps
npx cap sync       # copy the build into android/ and ios/
```

## iCloud saves and Game Center (iPhone/iPad)

The app's own plugin `ios/App/App/GameServicesPlugin.swift` (registered in
`GameViewController.swift`) keeps a copy of the save in iCloud key-value storage and talks to
Game Center; `src/services.js` is the game's side of it. On the web and Android it does nothing.

One-time setup before building:

1. **Apple Developer > Identifiers > com.boltworks.idlefactory**: turn on **iCloud** (it's the
   key-value storage; no containers needed) and **Game Center**. Then regenerate/refresh the
   provisioning profile (Xcode does this itself with automatic signing).
2. **Xcode > App target > Signing & Capabilities**: the entitlements file `App/App.entitlements`
   is already set; check that **iCloud** (Key-value storage ticked) and **Game Center** both show.
3. **App Store Connect > the app > Services > Game Center**: turn Game Center on, then add:
   - Leaderboards (classic, high score, integer, sort high to low):
     `ee.empire_score` "Empire Score", `ee.rockets` "Rockets Launched", `ee.orders` "Orders Filled"
   - Achievements (100 points spread as you like), id = `ee.` + the game's id:
     ee.first_cash, ee.chain3, ee.chain7, ee.hq, ee.manager1, ee.manager7, ee.land1, ee.land5,
     ee.power, ee.compute, ee.lv10, ee.lv20, ee.lv250, ee.order1, ee.order10, ee.million,
     ee.billion, ee.trillion, ee.launch1, ee.launch5, ee.moon, ee.mars, ee.desert, ee.japan, ee.streak7
     (names and descriptions as in `src/achievements.js`; each needs an image, 512x512 or 1024x1024).
   - Add Game Center to the app version you submit.
4. Test with a sandbox Game Center account on a real device (Settings > Game Center).
