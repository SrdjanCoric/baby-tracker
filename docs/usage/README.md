# How Sofi is used

Status: **draft checklist**. Each line is one behavior the app must have. The test audit uses these lines as its yardstick: a behavior is covered only when some test would fail if that behavior broke.

## How to read the tags

- **[Decided]** — the product owner settled this. It is the intended behavior.
- **[Today]** — how the code works now. Kept as intended unless someone objects.
- **[Bug]** — the intended behavior differs from the code today. Tests that lock in the old behavior are wrong.
- **[Limit]** — a known limitation we accept for now. Not a bug.

A checkbox stays empty until the audit names a test that would catch a break.

## Files

- [Accounts and guest mode](accounts-and-guest.md)
- [Household](household.md)
- [Timers](timers.md) — household timers, multiple babies, Lock Screen, widget, Watch
- [Cross-device and household isolation](cross-device-isolation.md)
- [Logging and editing entries](logging-and-editing.md)
- [Statistics and timeline](stats-and-timeline.md)
- [Sync and offline](sync-and-offline.md)
- [Notifications](notifications.md)
- [Import, export and reports](import-export-reports.md)

## Ground rules that apply everywhere

- [ ] [Today] Platforms: iPhone and Android phones. iPhone also has widgets, Live Activities (Lock Screen and Dynamic Island) and an Apple Watch app. Android has no widgets. Web is not a product.
- [x] [Today] The app works offline first. Every change shows on screen at once and is sent to the server later. — test: src/services/sync/crdt-offline-roundtrip.test.ts
- [ ] [Today] Nine languages: en, sr, es, es-ES, fr, pt-PT, pt-BR, de, it. — weak: scripts/native-locale-parity.test.mjs
- [ ] [Decided] A person belongs to exactly one household. A household can have several babies.
- [ ] [Decided] One household lives in one time zone. Tracking a baby from another time zone is out of scope.
- [ ] [Today] Every screen shows only the selected baby. Each device remembers its own selected baby. — weak: src/__tests__/watch-realtime-baby-selection.integration.test.tsx

## Out of scope

- [Limit] The Watch handles one baby only. It cannot switch babies.
- Dead screens: the old Profile, Log and Sleep Patterns tabs. Nothing links to them. Their tests count as waste.
- Tracking a baby from another time zone.

## Tests run before deploy, not in CI

- [ ] [Decided] The full test suite runs before each deploy. CI only runs lint, typecheck and the dependency audit. — weak: scripts/ci-workflow.test.mjs
- [ ] [Decided] A test that cannot run before deploy (no runner picks it up, or it points at missing files) counts as waste.

## Follow-up ideas (not part of the test audit)

- Friction tracking: notice users struggling, not just crashes. Sentry, already installed, covers most of it once turned on:
  - Session replay (opt-in): records what the user did before a problem. Masks all text and images by default, which matters for baby health data.
  - Freeze detection: on by default on iPhone. Slow and frozen screens need tracing turned on.
  - Rage-tap detection (same spot tapped over and over): recent SDK addition, version not confirmed.
  - "Report a problem" form, optionally opened by shaking the phone (off by default).
  - App-specific alarms: send a Sentry event when the app reaches an impossible state, e.g. "timer locked by myself" or "sleep total doesn't match its parts".
  - Second tools (UXCam, PostHog, Datadog) only if funnels or heatmaps are needed later.
