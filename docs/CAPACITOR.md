# Android / iOS packaging (Capacitor)

Status: **configuration only.** `capacitor.config.ts` exists and `npx cap doctor` loads it.
No native project has been generated, built or tested, because this machine has no Android SDK,
and iOS requires macOS with Xcode. The competition deliverable is the web app.

All business logic is shared: the native shell loads the same `dist/` build.

## Android (Windows, macOS or Linux)

Prerequisites: Android Studio (SDK + platform tools) and JDK 21.

```bash
npm install @capacitor/android
npm run build
npx cap add android        # generates ./android (git-ignored by default; commit it once you customize it)
npx cap sync android
npx cap open android       # build/run from Android Studio
```

## iOS (macOS only)

```bash
npm install @capacitor/ios
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

## Before any store release

1. **Session storage**: replace `platform.authStorage` in `src/platform/platform.ts` with a maintained Keychain/Keystore plugin. Evaluate maintenance status at that time.
2. **Geolocation**: optionally use `@capacitor/geolocation` behind the same `platform.getCurrentPosition()` adapter. Keep it on explicit user action only.
3. **Auth redirects**: add a deep-link scheme for email confirmation links and allow it in Supabase redirect URLs.
4. **CSP / allowed origins**: add `https://localhost` (Android) and `capacitor://localhost` (iOS) to the Edge Function's `ALLOWED_ORIGINS`.
5. Set the final `appId`, icons and splash screens. Then test on real devices.
