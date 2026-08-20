# Task 0090: Wear session handoff and watch-side refresh

**Branch**: `feature/wear-session-handoff-and-refresh`
**Depends on**: 0089
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, after signing in on my Android phone, my watch is signed in too and stays signed in without my phone's help.

## What to build

The complete authentication story for the Wear app: the Android phone app pushes the Supabase
session to the watch over the Wearable Data Layer; the watch stores it encrypted at rest, refreshes
its own access token thereafter, and clears it when the phone signs out or switches accounts. After
this task the watch can make authenticated Supabase calls (proven with a raw
`get_baby_activity_snapshot` RPC call — no data UI yet) and shows a signed-in state naming the
selected baby.

Durable decisions this task must respect (from the brief):

- Data Layer carries session material and invalidation only — never activity data.
- Watch-side token refresh is required. This deliberately improves on the iOS design
  (`plugins/with-shared-supabase-session/`, `targets/watch/WatchSupabaseSession.swift`), whose
  phone-owned capsule goes stale and fails with silent 401s. A failed refresh must surface a
  visible "reconnect from phone" state, never a silent error.
- No standalone watch login; the phone app is the only sign-in surface.
- Session payload includes the selected-baby identity (id, timezone), mirroring what the iOS
  envelope delivers.
- A native bridge module inside the Expo Android app exposes session-push to the React Native
  layer — the Android sibling of `plugins/with-shared-supabase-session/`.

The detailed design (envelope format, DataClient vs MessageClient, storage primitive, refresh and
invalidation flows) is an open checkpoint from the brief: settle it in a design pass at the start of
this task and record it in the task branch before implementation.

## Implementation work

- [ ] Design pass: session envelope schema (versioned, like iOS `WatchSessionEnvelopeV1`), Data
      Layer mechanism, encrypted storage primitive (EncryptedSharedPreferences or equivalent),
      refresh flow, invalidation flow. Record the decisions in this task file or an adjacent note.
- [ ] Native Android bridge module in the Expo app: RN-callable session push on sign-in, session
      update on account/baby switch, invalidation on sign-out.
- [ ] Watch-side receiver: validate, store encrypted, expose session to an HTTP client.
- [ ] Watch-side token refresh against Supabase auth; on refresh failure show "reconnect from
      phone" state.
- [ ] Signed-in state screen replacing the 0089 placeholder (account/baby name), plus the
      authenticated snapshot RPC smoke call proving end-to-end auth.
- [ ] Tests: envelope serialization round-trip, storage encryption in place, refresh-success and
      refresh-failure paths, invalidation clears stored session.

## Human checkpoints

- [ ] [confirm-security] Approve the session-handoff design (transport, storage at rest, refresh,
      invalidation) before implementation, and review the implementation before merge — this moves
      Supabase session material across the phone↔watch trust boundary.
- [ ] [verify] Pair Wear OS 4 emulator with Android emulator; sign in on phone. · Expected: watch
      shows signed-in state with baby name; sign out on phone returns watch to signed-out screen.
      · Failure: watch stays signed out, or stays signed in after phone sign-out. · Reason:
      cross-device Data Layer delivery cannot be asserted in unit tests.

## Acceptance criteria

- [ ] Sign-in on phone results in the watch holding a working session (authenticated snapshot RPC
      returns 200).
- [ ] With the phone unreachable, the watch refreshes an expiring token and keeps working.
- [ ] Refresh failure shows the "reconnect from phone" state; no silent 401 loop.
- [ ] Phone sign-out/account-switch clears the watch session.
- [ ] Session at rest on the watch is encrypted; no token appears in logs.
- [ ] All new tests green in CI.
