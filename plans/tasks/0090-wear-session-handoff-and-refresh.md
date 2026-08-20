# Task 0090: Wear session handoff and watch-side refresh

**Branch**: `feature/wear-session-handoff-and-refresh`
**Depends on**: 0089
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a caregiver, after signing in on my Android phone, my watch is signed in too and stays signed in without my phone's help.

**Implementation classification**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: yes

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

## Proposed security design — awaiting `[confirm-security]` approval

Research found that the original “push the phone Supabase session” premise is not safe together
with phone-free watch refresh. The phone and watch would independently consume one rotating
refresh-token family; if either falls more than one generation behind Supabase's narrow reuse
exceptions, reuse detection can revoke the shared session. See
`plans/research/watch-session-cross-device-renewal-2026-08.md` and
`plans/research/wear-os-session-handoff-design-2026-08.md`.

The proposed correction is **phone-approved provisioning of a distinct watch session**:

- The watch creates a persistent installation ID, request nonce, and non-exportable Android
  Keystore provisioning key. It publishes an urgent durable request `DataItem` containing only
  public request metadata and the provisioning public key.
- The phone shows an explicit connection approval, then calls an authenticated Supabase Edge
  Function. The function derives the user and email from the verified phone JWT, validates access
  to the selected baby, rate-limits and idempotently handles the request, calls
  `auth.admin.generateLink`, and encrypts the one-time token hash to the requesting watch key.
  The service-role/secret key never leaves the function.
- The phone publishes the sealed one-time grant and account/selected-baby identity through one
  versioned, urgent, per-installation `DataItem` state path. The strict tagged union is
  `PROVISION`, `BOUND`, or `INVALIDATED` and carries a binding ID plus a monotonic revision.
  A successful watch acknowledgement replaces `PROVISION` with secret-free `BOUND` state.
- The watch validates the target, request, expiry, binding, and revision; decrypts the grant; and
  redeems it with `verifyOtp`. It accepts the result only when the user matches the approved
  identity and the returned `session_id` differs from the approving phone session. This produces a
  watch-owned refresh-token family.
- The watch stores the complete session and identity as one atomic AES-256-GCM ciphertext under
  `noBackupFilesDir`, with the non-exportable key in Android Keystore. Deprecated
  `EncryptedSharedPreferences`, plaintext fallback, and backup-restored ciphertext are excluded.
- All authenticated watch calls go through one session manager. Refresh is single-flight; a
  rotated pair is persisted atomically before use; one authenticated 401 permits one refresh and
  one retry. Terminal auth, identity, or vault failure clears tokens and shows **Reconnect from
  phone**. Transient connectivity retains the encrypted session and shows a retryable offline
  state. Tokens, grants, headers, envelopes, and provider bodies are never logged.
- Phone sign-out/account switch overwrites the same state path with an urgent durable
  `INVALIDATED` tombstone; it is not deleted after send. Receipt is eventual for a disconnected
  watch, not instantaneous. Same-account baby changes publish newer identity without rotating the
  watch session. A new binding clears old credentials before provisioning.
- The signed-in state names the account and selected baby, then the watch performs the existing raw
  `get_baby_activity_snapshot` RPC using the selected baby ID/timezone as its authenticated smoke
  proof. Data Layer never carries activity data.

The application-facing seams stay narrow: React reconciles `loading`, `signedIn(identity)`, and
`signedOut(reason)` desired states; the Wear core depends on ports for commands, vault, grant
redemption, refresh, and snapshot probing. Google Play Services, Keystore, Supabase HTTP, the Edge
Function, and Compose remain adapters.

This safe design materially expands the task beyond its original client-only assumption: it adds
an Edge Function, durable issuance idempotency/rate limiting (likely a small migration), phone
approval UI, and deployed checks for email identity, OTP expiry, MFA/AAL, single-session, and
global-sign-out settings. A watch session normally begins at AAL1 and must not be claimed to inherit
phone AAL2. Data Layer invalidation cannot promise immediate revocation while the watch is offline.

Alternatives considered:

- **Supabase OAuth Authorization Code + PKCE** also produces a distinct session and keeps the
  verifier on-watch, but requires enabling the beta OAuth server, registering a public client, and
  building authorization/consent and callback routing. It is the standards-based fallback if the
  Edge Function flow is rejected.
- **Copying/importing the phone session**, access-token-only handoff, `MessageClient`-only delivery,
  plaintext persistent grants, and deleting the invalidation item violate task security or offline
  behavior and are rejected.

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
