# Task 0092: Wear diaper quick log

**Branch**: `feature/wear-diaper-quick-log`
**Depends on**: 0091
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I log a diaper change from my watch in one or two taps and it shows up everywhere.

**Change class**: `code` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

The watch's first write: log a diaper change (with the same type options the iOS watch offers)
directly to Supabase from the watch. This proves the entire write path — authenticated direct
writes under RLS, rows indistinguishable from phone-written rows, cross-device visibility via the
shared database — using the simplest activity type. Establishes the shared Kotlin write client that
tasks 0093–0096 build on.

**Apple Watch parity boundary**: offer only wet, dirty, mixed, and dry quick logs. Dirty and mixed
may select the same seven stool colors as Apple Watch. Do not add notes, rash/blowout fields,
backdating, history, or editing.

Durable decisions this task must respect (from the brief):

- Writes go direct from watch to Supabase over the same REST/RLS paths the phone uses. No
  phone-relay channel, no Data Layer for activity data.
- No offline queue: with no network, the write fails visibly with a retry affordance; nothing is
  silently dropped or queued.
- Duplicate-tap protection: the log action debounces/disables until the request resolves.
- The phone sees the entry through its normal refresh machinery; optionally send a lightweight
  Data Layer refresh nudge to a nearby phone, but correctness must not depend on it.
- Master-plan architectural constraint (LWW-Map CRDT): synced tables carry `field_clocks JSONB`
  (column name → HLC string) and rows with empty clocks lose to any clocked write. The watch write
  client must generate valid HLC field clocks (`"<ISO-8601 UTC ms>-<counter>-<deviceId>"`) with a
  watch-specific device ID for every written field, matching the phone's clock semantics — the
  fixture comparison against phone rows must include `field_clocks`.

## Implementation work

- [x] Shared Kotlin Supabase write client (auth header from 0090 session, error surface, debounce
      support) designed for reuse by the remaining activity tasks.
- [x] Diaper log UI for wet, dirty, mixed, and dry, with Apple-parity stool-color selection for
      dirty and mixed, and the write action.
- [x] Post-write local refresh so the summary reflects the new entry immediately.
- [x] Tests: write payload construction matches the phone app's row shape (field-level fixture
      comparison), failure path surfaces error + retry, duplicate-tap yields one row.

## Implementation decisions

- The reusable write client calls the five-argument `merge_record` RPC. Each quick log owns one
  immutable draft, so its UUID, operation ID, timestamps, field clocks, and request body stay
  byte-identical across a visible retry.
- A private Wear preference store owns the stable watch device ID and persisted HLC state. The
  quick-log runtime writes for the baby currently selected in the summary rather than assuming the
  baby carried by the original phone session envelope.
- The quick-log UI stays inside the existing summary Compose screen. Wet and dry submit directly;
  dirty and mixed expose only the same optional seven stool colors as Apple Watch. No navigation
  dependency, offline queue, phone relay, or Data Layer activity payload was introduced.

## Implementation evidence

- RED/GREEN cycles cover the exact authenticated RPC request and phone-row fixture (including
  `field_clocks`), optional-field omission, visible offline retry with the identical draft, rapid
  double-submit suppression, one post-success summary reload, and the Apple Watch parity options.
- A rollback-only SQL test persists a watch-shaped row through authenticated `merge_record`,
  verifies the returned database row shape, and reads the new diaper through
  `get_baby_activity_snapshot`.
- The plugin template remains the source of truth for generated `android/wear`; its generated copy
  was kept byte-for-byte synchronized during implementation.

## Validation boundary

No paired-emulator or phone↔watch synchronization check runs in this task. Prove write payloads,
RLS-compatible persistence, retry behavior, and duplicate protection through automated seams;
Task 0098 verifies watch-to-phone visibility with the completed Wear feature set.

## Acceptance criteria

- [x] Automated integration proof shows a watch-built diaper payload persists with the same row
      shape as a phone-written entry and is readable through the shared snapshot path.
- [x] Airplane-mode write shows visible failure + retry; retry succeeds after reconnect.
- [x] Rapid double-tap creates exactly one row.
- [x] Tests green locally; CI proof belongs to the later PR workflow. No backend changes.
- [x] No diaper capability absent from Apple Watch is exposed.
