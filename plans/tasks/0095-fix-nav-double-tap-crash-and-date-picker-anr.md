# Task 0095: Fix navigation double-tap crash and date-picker ANR

**Branch**: `hotfix/4.9.15-nav-crash-and-picker-anr`
**Depends on**: none
**Base**: `dbce162` (`chore(release): bump version to 4.9.15`), tip of
`feat/observability-instrumentation` — the build actually shipped to production. **Not `main`**:
main is 4.10.1 and carries the held 4.10 work (household caregivers stopping/pausing timers,
Live Activities push-to-start). This hotfix must not pull any of that forward.
**Source**: Sentry, 2026-09-12 — two new issues on the 4.9.15 production build, reported within
minutes of each other; Sentry reporting exists on this line because `8cd6032` /
`51cbdc1` added it.
**User stories**: a caregiver who taps an activity card twice in a row does not lose the app to a
crash; a caregiver adjusting a time in a picker does not freeze the app or trigger an ANR.

## What to build

Two independent production defects on 4.9.15, fixed together as one hotfix because they ship on the
same release.

### 1. `IllegalArgumentException` — crash (unhandled, Error)

```
No view found for id 0x4c6 (unknown) for fragment ScreenStackFragment{519eb0}
  (01c2cf31-dd23-49ba-b00d-8a8122512368 id=0x4c6)
androidx.fragment.app.FragmentStateManager in createView
```

Sentry breadcrumbs, single event, Sep 12 04:22:13 CEST:

| time | breadcrumb |
| --- | --- |
| .714 | Navigation Dispatch — `PUSH` to `feeding` |
| .854 | Navigation — `/` → `/feeding` |
| .856 | Touch — element `Aggiungi Poppata` (Add Feeding) |
| .860 | Navigation Dispatch — `POP_TO_TOP` |
| .905 | crash |

**Cause.** `app/(tabs)/index.tsx:66` `safeNavigate`:

```js
const safeNavigate = useCallback((path: string) => {
  if (isFocused) {
    router.push(path);
  } else {
    router.dismissAll();
    setTimeout(() => router.push(path), 50);
  }
}, [isFocused, router]);
```

Every dashboard card action routes through it (`safeNavigate("/feeding")` and siblings, lines
~421-460). A second tap landing after the first `PUSH` has begun finds `isFocused` already `false`,
so it takes the `dismissAll()` branch and issues `POP_TO_TOP` against a `ScreenStackFragment` that
is still attaching. `FragmentStateManager.createView` then cannot find the container view id.

The `else` branch came from `fc7d492` (`fix(nav): stop first tap after cold start bouncing back to
Home`) and is still needed for its original stale-stack case. The fix is to stop a second
navigation from being dispatched at all while one is in flight — not to remove the branch.

**Verified so far (2026-09-12, emulator `SofiBaby_Pixel_7_API_35`, API 35, debug build of
`dbce162`):** a double tap on the feeding card does reach the `dismissAll()` branch. Logcat:

```
E ReactNativeJS: 'The action 'POP_TO_TOP' was not handled by any navigator.
```

That confirms the trigger path. The crash itself has **not** yet been reproduced locally: eight
double-tap delays (0.05s–2.5s, with `window_animation_scale` / `transition_animation_scale` /
`animator_duration_scale` set to 10) all produced the warning and no `No view found for id`. The
remaining gap is the narrow window where the push is committed to the navigator but the fragment
view is not yet attached. Reproduction is still open — see checklist.

### 2. `ApplicationNotResponding` — Background ANR (Fatal)

```
android.os.MessageQueue in enqueueMessage
com.henninghall.date_picker.generated.NumberPicker$SetSelectionCommand in post
com.henninghall.date_picker.generated.NumberPicker in postSetSelectionCommand
com.henninghall.date_picker.generated.NumberPicker$InputTextFilter in filter
android.widget.TextView in setText
com.henninghall.date_picker.generated.NumberPicker in updateInputTextView
com.henninghall.date_picker.generated.NumberPicker in setValueInternal
com.henninghall.date_picker.generated.NumberPicker in scrollBy
com.henninghall.date_picker.generated.NumberPicker in moveToFinalScrollerPosition
com.henninghall.date_picker.generated.NumberPicker in changeValueByOne
com.henninghall.date_picker.pickers.AndroidNative in changeValueByOne
com.henninghall.date_picker.pickers.AndroidNative$2 in run
```

**Cause.** `react-native-date-picker@5.0.13`,
`android/src/main/java/com/henninghall/date_picker/pickers/AndroidNative.java`,
`smoothScrollToValue`:

```java
int moves = Math.abs(shortestScrollOption);
int timeBetweenScrollsMs = 100;
for (int i = 0; i < moves; i++) {
    changeValueByOne(shortestScrollOption > 0, i * timeBetweenScrollsMs, i == moves - 1);
}
```

Each step is a separate `handler.postDelayed` runnable on the main thread, 100ms apart, and each
one drives `setValueInternal` → `updateInputTextView` → `setText` → `InputTextFilter.filter` →
`postSetSelectionCommand` → another `View.post`. A programmatic date change with a large delta
queues `moves` runnables and holds the main thread busy for `moves × 100ms`; the app being
backgrounded mid-animation is what Sentry recorded as a Background ANR.

This is library code, not repo code — `com.henninghall.date_picker.generated` is the library's
vendored AOSP `NumberPicker` copy. `scripts/date-picker-codegen.test.mjs` only pins the package
(exact `5.0.13`) and asserts the iOS codegen provider shape; it does not generate this class.

Picker mount sites: `src/components/BoundedAndroidDateTimePicker.tsx` (thin wrapper, no clamping
loop), `src/components/RunningTimerStartEditor.tsx` (`onChange={setDraftStartedAt}`, no clamping),
`app/settings/notifications.tsx`, `app/sleep/settings.tsx`, plus Android-only branches in
`app/feeding/manual.tsx`, `app/growth/index.tsx`, `app/health/manual.tsx`, `app/edit/health.tsx`.
None of them re-clamp in a way that would ping-pong, so the large-delta source is still unidentified
— most likely a `minimumDate` / `maximumDate` change forcing the native picker to scroll to a bound.

## Checklist

- [x] Reproduce issue 1's trigger path — confirmed on emulator, logcat shows
      `The action 'POP_TO_TOP' was not handled by any navigator` on a double tap.
- [ ] Reproduce issue 1's actual crash — **not achieved**. The window needs the push committed to
      the navigator *and* the home card still tappable; the gap on the reporting device was 142ms
      (breadcrumb `.714` push → `.856` touch). Tap injection is coarser than that:
      `adb shell input tap` spawns a JVM per call (~300-400ms, variable) and Maestro is no faster,
      so every attempt landed either before the push committed (`POP_TO_TOP` unhandled) or after
      the modal covered the card (`safeNavigate` never ran). Animator scaling does not help — it
      stretches both sides equally and slides the window instead of widening it. Untried:
      on-device `sendevent` raw touch injection for microsecond gap control, and a release build
      (production `react-native-screens` fragment teardown timing differs from this debug build).
- [x] Fix issue 1 with an in-flight navigation guard in `safeNavigate` so a second dispatch is
      dropped rather than converted into `POP_TO_TOP`. Kept the existing `dismissAll()` branch for
      the stale-stack case it was added for.
- [x] Regression test for issue 1 — 4 tests in `app/(tabs)/index.component.test.tsx`. The two
      crash-path tests are red-green verified (they fail against the unfixed `index.tsx`).
- [ ] Reproduce issue 2 — **not achieved**, and not attempted beyond source analysis. A background
      ANR cannot be forced on demand; the large-delta source in production is still unidentified.
- [x] Fix issue 2 — `BoundedAndroidDateTimePicker` now unmounts the spinner when `AppState` goes
      `background`/`inactive`, dropping queued scroll runnables with the view. Scoped to one file
      because it is the **only** Android mount of `react-native-date-picker`: the settings screens
      render `RNDatePicker` on iOS only and use `@react-native-community/datetimepicker` on
      Android. Deliberately *not* done: capping scroll distance or upgrading past 5.0.13 — both
      are speculative without a repro, and the version bump would require editing
      `scripts/date-picker-codegen.test.mjs`, which pins exact `5.0.13`.
- [x] Regression test for issue 2 — `src/components/BoundedAndroidDateTimePicker.component.test.tsx`.
- [x] Bump to 4.9.16, update `release-notes.md`.
- [ ] Verify on a device/emulator that the double tap no longer dispatches `POP_TO_TOP`.
- [ ] Open the hotfix PR.

## Notes

- `android/app/build.gradle:96` hardcodes `versionName "4.9.8"` and never syncs from `app.json`
  (`version` is 4.9.15 there). Pre-existing, unrelated to both bugs, out of scope for this hotfix —
  worth a separate task, since it makes every locally built APK misreport its version.
- Local repro environment: emulator `SofiBaby_Pixel_7_API_35`; `npm ci` is required when switching
  onto this branch from `main`, because the Sentry dependency set differs.
