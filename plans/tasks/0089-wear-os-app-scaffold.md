# Task 0089: Wear OS app scaffold and build integration

**Branch**: `feature/wear-os-app-scaffold`
**Depends on**: none
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a Samsung watch owner, I can install and open the app on my watch.
**Change class**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: `true`

## What to build

A greenfield Kotlin/Compose for Wear OS module integrated into the existing Expo Android build
(package family `com.sofibaby.app`), producing an installable Wear OS 4+ watch app that launches to
a signed-out placeholder screen. This is the tracer bullet proving the toolchain: the Wear module
compiles in the same build pipeline as the phone app, CI stays green, and the app runs on a Wear
OS 4 emulator.

Durable decisions this task must respect (from the brief):

- Native Kotlin/Compose only — React Native does not run on Wear OS.
- Device floor Wear OS 4+ (`minSdk` accordingly); Tizen is permanently out of scope.
- Integration with the Expo Android project follows the repo's config-plugin precedent
  (`plugins/` directory pattern used for iOS native integration, e.g. the watch complication and
  shared-session plugins) so `expo prebuild` does not destroy the Wear module wiring.

## Implementation work

- [x] Create the Wear OS application module (Compose for Wear, Wear OS 4+ floor) with app id in
      the `com.sofibaby.app` family and standalone=false manifest declaration (phone app required).
- [x] Integrate the module into the Expo Android Gradle build via a config plugin so prebuild
      regenerates the wiring; document the plugin alongside the existing `plugins/` entries.
- [x] Signed-out placeholder screen in Compose stating sign-in happens on the phone.
- [x] CI builds the Wear module with the Android app; build failure in the Wear module fails CI.
- [x] Minimal instrumentation or unit test scaffold so later tasks have a test seam.

## Implementation evidence

- RED→GREEN contract cycles cover idempotent clean-prebuild module wiring, the launcher placeholder
  state and native unit-test scaffold, canonical Node-suite registration, and the required Android
  CI aggregation job. The stable `npm run test:ci` proof passes 68/68 tests.
- `EXPO_NO_DOTENV=1 npx expo prebuild --platform android --clean --no-install` regenerates
  `:wear`; `./gradlew :wear:testDebugUnitTest` passes the native placeholder-state test.
- `./gradlew :app:assembleDebug :wear:assembleDebug` passes and produces the phone APK plus
  `android/wear/build/outputs/apk/debug/wear-debug.apk`. Logs are retained under
  `/tmp/agent-workflows/e2f8af45fd34/042fc1a664ad/`.
- The Wear OS 4 emulator launch checkpoint remains deferred to the required manual review loop.

## Human checkpoints

- [ ] [verify] Install the built watch APK on a Wear OS 4 emulator and launch it. · Expected: app
      opens to the signed-out placeholder screen without crash. · Failure: install error, crash, or
      blank screen. · Reason: no CI Wear-emulator lane exists yet; first-launch proof is manual.

## Acceptance criteria

- [ ] Android CI build produces the Wear APK alongside the phone app and is green.
- [ ] `expo prebuild` (clean) regenerates a buildable project including the Wear module.
- [ ] Watch app launches on a Wear OS 4 emulator showing the signed-out screen.
- [ ] Phone app behavior unchanged (existing Android build and tests pass).
