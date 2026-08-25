# Task 0092: Wear diaper quick log

**Branch**: `feature/wear-diaper-quick-log`
**Depends on**: 0091
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, I log a diaper change from my watch in one or two taps and it shows up everywhere.

## What to build

The watch's first write: log a diaper change (with the same type options the iOS watch offers)
directly to Supabase from the watch. This proves the entire write path — authenticated direct
writes under RLS, rows indistinguishable from phone-written rows, cross-device visibility via the
shared database — using the simplest activity type. Establishes the shared Kotlin write client that
tasks 0093–0096 build on.

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

- [ ] Shared Kotlin Supabase write client (auth header from 0090 session, error surface, debounce
      support) designed for reuse by the remaining activity tasks.
- [ ] Diaper log UI (type selection parity with iOS watch) and write action.
- [ ] Post-write local refresh so the summary reflects the new entry immediately.
- [ ] Tests: write payload construction matches the phone app's row shape (field-level fixture
      comparison), failure path surfaces error + retry, duplicate-tap yields one row.

## Acceptance criteria

- [ ] Diaper logged on watch appears in the database with the same row shape a phone-written
      diaper entry has, and appears on the phone after its refresh.
- [ ] Airplane-mode write shows visible failure + retry; retry succeeds after reconnect.
- [ ] Rapid double-tap creates exactly one row.
- [ ] Tests green in CI; no backend changes.
