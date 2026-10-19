# Bolt Works

Idle factory game: a fixed-angle 3D town where you build and upgrade factories. Monetized with rewarded ads (Google AdMob).

## How it's built
- **Game:** JavaScript + three.js (`src/`), bundled with Vite.
- **Phone apps:** Capacitor wraps the game as an Android app (`android/`) and an iPhone app (`ios/`).
- **Ads:** `src/ads.js`. Simulated in the browser; AdMob on phones. IDs live in `src/config.js`, `android/app/src/main/AndroidManifest.xml` and `ios/App/App/Info.plist` (currently Google's test IDs).

## Where to change things
- Economy numbers (costs, income, speed bonuses): `src/economy.js`
- Ad rewards and offline limits: `src/config.js`
- Building models (swap for real 3D art later): `src/models.js`
- Town layout, camera, traffic: `src/world.js`
- Screens and buttons: `src/main.js`, `src/style.css`

## Builds
Every push to `main` builds an Android test app (APK) with GitHub Actions. Download it from the run's **Artifacts** section.

## Local commands
```
npm install
npm run dev        # play in a browser
npm run build      # build for the phone apps
npx cap sync       # copy the build into android/ and ios/
```
