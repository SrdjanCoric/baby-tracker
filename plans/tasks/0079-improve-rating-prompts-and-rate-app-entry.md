# Task 0079: Cap automatic rating prompts to three per rolling year and add a Rate App entry point

**Branch**: `feature/improve-rating-prompts-and-rate-app-entry`
**Depends on**: none
**Source**: conversation 2026-08-09 · **User stories**: As a caregiver who has been using the app for
months, I am not permanently cut off from being asked to rate it, so that a prompt the operating
system silently swallowed does not cost me my only chance. As a caregiver who already wants to leave
a rating, I can find a Rate App entry point in Settings at any time instead of waiting for the app to
ask me.

## What to build

Two closely-coupled changes to how this app asks for App Store and Play Store ratings, delivered
together because both exist to raise a low rating count on a low-volume app.

**Automatic prompt cadence.** `src/services/store-review-service.ts` currently enforces a lifetime
cap of three prompts, tracked by a `@store_review:prompt_count` counter and a
`@store_review:last_prompt` timestamp. Replace that with a **rolling 365-day window**: at most three
prompts within any trailing 365 days.

This matters because neither platform reports the outcome of a review request. iOS
`SKStoreReviewController.requestReview()` returns void with no callback, and the Play In-App Review
flow completes identically whether or not a dialog appeared. When the operating system has already
spent the user's quota, the call is a silent no-op but the app still records a prompt. Under a
lifetime cap those wasted slots are permanent. Under a rolling window they age out, which is the
whole point of the change.

**Manual entry point.** Add a Rate App row to the Settings About section that opens the platform
write-review page directly. It deliberately does **not** call `StoreReview.requestReview()`: once the
operating-system quota is spent that call does nothing at all, so a deliberate tap would appear
broken. It writes no state, consumes no rolling-window slot, and applies no suppression to automatic
prompts. The owner decided against suppression explicitly — app volume is low and rating count needs
to rise, so a manual tap must never reduce future automatic opportunities.

While editing the same Settings About section, correct the hardcoded version string.

### Durable decisions carried by this task

- Prompt history is stored as a JSON array of ISO timestamps under
  `@store_review:prompt_history`. It is the single source for both the per-year count and the
  cooldown; there is no separate counter or last-prompt key after migration.
- `MAX_PROMPTS_PER_YEAR` is **3**. Apple's own ceiling is three per 365 days, so this stays at
  or under the platform limit rather than duplicating it more strictly.
- Existing gates are unchanged: `MIN_ACTIVITY_COUNT` 100, `MIN_DAYS_SINCE_FIRST_USE` 7,
  `COOLDOWN_DAYS` 60, `DAY_START_HOUR` 10, `DAY_END_HOUR` 18.
- The manual Rate App tap is quota-neutral and suppression-free, by owner decision.
- App Store numeric app ID is **6758142736**; Android package is **com.sofibaby.app**.

### Explicitly out of scope

Decided against by the owner during planning, and not to be reintroduced:

- Resetting the prompt count per app version.
- Any suppression window applied after a manual Rate App tap.
- Any Supabase migration or server-side table logging prompt attempts. The owner considered and
  rejected this: it could only record attempts rather than confirmed impressions, would miss
  account-less users entirely under row-level security, and could not be backfilled.
- `appStoreUrl` / `playStoreUrl` entries in the Expo app config. The store URLs are built directly
  because `StoreReview.storeUrl()` returns a plain listing URL, not the write-review deep link.

## Implementation work

- [x] Replace the lifetime cap in `src/services/store-review-service.ts` with a rolling 365-day
      window backed by `@store_review:prompt_history`, a JSON array of ISO timestamps. The review
      gate passes only when the entries falling inside the trailing 365 days number fewer than
      `MAX_PROMPTS_PER_YEAR` (3).
- [x] Derive the 60-day cooldown from the newest entry in that history rather than from a separate
      key.
- [x] Prune entries older than 365 days on every write, so the stored array cannot grow unbounded.
- [x] Migrate existing installs on first read: when no history exists but the legacy
      `@store_review:last_prompt` key does, seed the history with that single timestamp and remove
      both legacy keys. The legacy counter cannot be reconstructed because only one timestamp was
      ever stored, so a user previously prompted three times is treated as having been prompted
      once. This is deliberately generous and preserves the cooldown.
- [x] Add a `catch` to the asynchronous timeout callback in `src/hooks/useStoreReview.ts`. It
      currently uses `try`/`finally` with no `catch`, so a rejection from the review request escapes
      an async `setTimeout` callback as an unhandled promise rejection. Swallow and log; a failed
      review request must never surface to the caregiver.
- [x] Delete the unused exported `requestReviewForDev` from the store review service. It has no
      callers.
- [x] Add a Rate App row to the About section of the Settings index screen, alongside the existing
      privacy-policy row, following the established `SettingsRow` pattern.
- [x] Open the platform write-review page from that row using `Platform.select`:
      iOS `itms-apps://apps.apple.com/app/id6758142736?action=write-review`,
      Android `market://details?id=com.sofibaby.app`. On Android, fall back to
      `https://play.google.com/store/apps/details?id=com.sofibaby.app` when the Play Store app is
      not installed and the `market://` scheme cannot be opened.
- [x] Add a `settings.rateApp` key to all nine locale files under `src/i18n/locales/`
      (`de`, `en`, `es`, `es-ES`, `fr`, `it`, `pt-BR`, `pt-PT`, `sr`).
- [x] Replace the hardcoded version string in the Settings About section with
      `Constants.expoConfig?.version`, mirroring the pattern already used by the standalone About
      screen. The Settings index currently shows `4.0.0` while the Expo app config declares `4.8.1`,
      and the release rolling this task out will be `4.8.2`. Read the version from the Expo app
      config, never from `package.json`, whose version field is unmaintained at `0.1.0`.
- [x] Add `src/services/store-review-service.test.ts` covering the rolling window and its gates.
- [x] Extend the Settings index component test to cover the Rate App row.
- [x] Add a locale parity test for the new key, following the existing `*-locales.test.ts` pattern
      under `src/i18n/`.

## Human checkpoints

- [x] [verify] On a **physical iOS device** running the built app, open Settings and tap Rate App.
      · Expected: the App Store write-review sheet for SofiBaby opens.
      · Failure: nothing happens, an "cannot open URL" error appears, or the plain App Store listing
      opens without the review composer.
      · Reason: the `itms-apps://` scheme does not resolve in the iOS Simulator, and no automated
      test can prove the App Store actually honours the deep link. The component test can only assert
      that the correct URL string is passed to `Linking`.

## Acceptance criteria

- [x] A user with three prompt timestamps inside the trailing 365 days is not prompted again.
- [x] A user whose third-oldest prompt has aged past 365 days becomes eligible again, once every
      other gate passes.
- [x] Timestamps older than 365 days are removed from stored history rather than accumulating.
- [x] A prompt is refused when fewer than 60 days have passed since the newest stored timestamp,
      even when the yearly count allows one.
- [x] An install holding only the legacy `@store_review:last_prompt` key is migrated to a
      single-entry history, its cooldown still honoured, and both legacy keys removed.
- [x] The unchanged gates still refuse a prompt below 100 total activities, before 7 days since first
      use, and outside the 10:00–18:00 local window.
- [x] A rejected review request is caught and logged, and does not produce an unhandled rejection.
- [x] `requestReviewForDev` no longer exists in the codebase.
- [x] Tapping Rate App in Settings opens the iOS write-review URL for app ID 6758142736 on iOS and
      the Play Store entry for `com.sofibaby.app` on Android, and falls back to the HTTPS Play URL
      when `market://` cannot be opened.
- [x] Tapping Rate App writes nothing to prompt history and does not change automatic-prompt
      eligibility.
- [x] `settings.rateApp` is present in all nine locale files and the parity test proves it.
- [x] The Settings About section shows the version from the Expo app config rather than a hardcoded
      string.
- [x] The physical-device verification above has been confirmed by the owner.

## Review decisions

- skipped (minor): TR-6 — The version fallback hardcodes the stale package version — we don't care about the fallback value.

## Completion record

- **Built:** Automatic rating prompts now use one self-healing ISO-timestamp history with a rolling
  365-day, three-prompt quota and the existing 60-day cooldown. Legacy prompt keys migrate and are
  removed without recurring steady-state writes. Rejected automatic requests are contained and
  logged. Settings now exposes a quota-neutral Rate App row with platform write-review URLs, an
  Android HTTPS fallback, all nine phone locales, and the Expo-configured app version.
- **Decisions preserved:** Manual Rate App taps neither write prompt history nor suppress later
  automatic prompts. The yearly limit remains three; the existing activity, install-age, cooldown,
  and local-time gates remain unchanged. The iOS app ID is `6758142736`, and the Android package is
  `com.sofibaby.app`.
- **Relevant files:** `src/services/store-review-service.ts`, `src/hooks/useStoreReview.ts`,
  `app/settings/index.tsx`, their focused tests, `src/i18n/store-review-locales.test.ts`, and the nine
  locale files under `src/i18n/locales/`.
- **README:** No change required after one impact audit. The README documents architecture, setup,
  release operations, and selected complex workflows rather than every Settings entry; its existing
  App Store and Play Store links already identify the correct application. Because no README prose
  changed, `write-well` was not invoked.
- **Review outcome:** TR-1 through TR-5 were fixed and verified. TR-6 was skipped as a minor finding
  by the owner because the unavailable-config fallback value is not important. The security lens ran
  with zero findings; no security risks were accepted.
- **Automated proof:** Focused validation passed on 2026-08-09: 25 Vitest tests across the rating
  service and locale parity suites; 8 Jest tests across the Settings row and automatic-review hook;
  `npm run typecheck`; and scoped ESLint with zero warnings.
- **Manual verification:** On 2026-08-09, the owner confirmed on a physical iOS device that Settings
  → Rate App opened the SofiBaby App Store review composer. No failure signal was observed.
