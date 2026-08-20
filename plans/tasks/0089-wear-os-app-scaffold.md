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
  CI aggregation job. The stable `npm run test:ci` proof passes 69/69 tests.
- `EXPO_NO_DOTENV=1 npx expo prebuild --platform android --clean --no-install` regenerates
  `:wear`; `./gradlew :wear:testDebugUnitTest` passes the native placeholder-state test.
- `./gradlew :app:assembleDebug :wear:assembleDebug` passes and produces the phone APK plus
  `android/wear/build/outputs/apk/debug/wear-debug.apk`. Logs are retained under
  `/tmp/agent-workflows/e2f8af45fd34/042fc1a664ad/`.
- README audit covered Wear OS Native Integration, Project Structure, and routine CI behavior.
  `write-well` passed after two audit passes.
- `npm run check:code` passes on the final task head. Canonical output is retained at
  `/tmp/agent-workflows/e2f8af45fd34/042fc1a664ad/canonical.log`.

## Human checkpoints

- [x] [verify] Install the built watch APK on a Wear OS 4 emulator and launch it. · Expected: app
      opens to the signed-out placeholder screen without crash. · Failure: install error, crash, or
      blank screen. · Passed 2026-08-20 on the API 33 `SofiBaby_Wear_OS_4` AVD: MainActivity stayed
      foregrounded, UI automation found "Sign in on your phone to continue.", the screenshot was
      centered and unclipped, and the Android runtime crash log was empty.

## Review decisions

- skipped (minor): TR-8 — The native test seam asserts a compile-time constant against a copy of its own literal — User directed this pass to focus on blocker and major findings.
- skipped (minor): TR-10 — Non-clean prebuilds can retain files deleted from the plugin source — User directed this pass to focus on blocker and major findings.
- skipped (minor): TR-11 — The Wear app ships without its own launcher icon — User directed this pass to focus on blocker and major findings.
- skipped (minor): TR-12 — The master-plan status flip is carried on the code branch — User directed this pass to focus on blocker and major findings.

## Completion record

- Built the native Kotlin/Compose `:wear` application under
  `plugins/with-wear-os/android/wear/` and integrated it through
  `plugins/with-wear-os/index.js`, `app.json`, and the Android CI job.
- Kept the non-standalone Wear artifact in the phone package `com.sofibaby.app`. Its marketing
  version follows the phone module, while its version code uses the distinct
  `1,000,000,000 + phone versionCode` range required for Play delivery across form factors.
- README audit covered Wear OS Native Integration, Project Structure, and routine CI behavior;
  `write-well` passed after two audit passes. `docs/RELEASE.md` records the Wear versioning rule.
- Review resolved TR-1 through TR-7 and the reopened TR-9. TR-8, TR-10, TR-11, and TR-12 remain
  skipped minors because the user limited the original remediation pass to blocker and major
  findings. The security review reported no findings or accepted risks.
- Final automated proof: `npm run check:code` passed after correcting an unrelated stale widget
  wiring assertion already present on `main`; the focused widget file passes 13/13 tests. Clean
  Expo prebuild and the phone/Wear Gradle build passed, and packaged APK inspection found phone
  version `1` / `4.9.8` and Wear version `1000000001` / `4.9.8`.
- Final manual proof: Wear OS 4 API 33 emulator launch passed. Evidence is retained in
  `/tmp/agent-workflows/e2f8af45fd34/042fc1a664ad/wear-launch.png`, `wear-ui.xml`, and
  `wear-crash.log`.

## Acceptance criteria

- [x] Android CI build produces the Wear APK alongside the phone app and is green.
- [x] `expo prebuild` (clean) regenerates a buildable project including the Wear module.
- [x] Watch app launches on a Wear OS 4 emulator showing the signed-out screen.
- [x] Phone app behavior unchanged (existing Android build and tests pass).
