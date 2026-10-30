# DriveLinkUp store shell

This folder becomes the iOS and Android app. The app opens `https://www.drivelinkup.com`. Listing text and the review blockers are in `docs/store/submission.md`. The decision is [ADR-007](../docs/decisions/ADR-007-store-shell.md).

`android/` and `ios/` are committed Capacitor projects. Android targets API 36.

## Build

The `Mobile` GitHub Actions workflow (`.github/workflows/mobile.yml`) builds both apps on every push that touches `mobile/`:

- Android: a debug APK and an unsigned release bundle (`.aab`), uploaded as the `android` artifact.
- iOS: a simulator build with Xcode 26. It proves the project compiles; it is not an upload.

A store upload needs signing:

- iOS needs Xcode 26 or later, so macOS 15.6 or later, and an Apple Developer account. Xcode 14 cannot upload to App Store Connect.
- Android needs a Play Console account and an upload key.

## Local work

The Capacitor 8 CLI needs Node 22 or later.

```bash
cd mobile
npm install
npx cap sync
npx cap open ios
npx cap open android
```

In Xcode, set the signing team and archive for App Store Connect. In Android Studio, build a signed app bundle (`.aab`) for Play Console.

After the first upload, do not change `com.drivelinkup.app`.

`www/index.html` is only the fallback Capacitor requires. The phone loads the live site from `capacitor.config.ts`.
