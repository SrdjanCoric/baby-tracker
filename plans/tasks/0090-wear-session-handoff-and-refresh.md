# Task 0090: Wear session handoff with phone-owned refresh

**Branch**: `feature/wear-session-handoff-and-refresh`
**Depends on**: 0089
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20), superseded for token ownership by the user decision recorded below · **User stories**: As a caregiver, after signing in on my Android phone, my watch is signed in too and can ask the phone for fresh credentials when needed.

**Implementation classification**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: yes

## What to build

The Apple-Watch-parity authentication story for the Wear app: the Android phone app pushes a
short-lived Supabase access token to the watch over the Wearable Data Layer; the watch stores it
encrypted at rest, asks the phone to refresh and republish when it becomes stale, and clears it when
the phone signs out or switches accounts. After this task the watch can make authenticated Supabase
calls (proven with a raw
`get_baby_activity_snapshot` RPC call — no data UI yet) and shows a signed-in state naming the
selected baby.

Durable decisions this task must respect (from the brief):

- Data Layer carries access-token handoff, phone-refresh requests, and invalidation only — never
  activity data.
- Match the supported Apple Watch behavior: the phone owns refresh-token rotation and republishes
  fresh access tokens. The Wear app never receives, stores, or redeems a refresh token. A stale or
  rejected access token must surface a visible "reconnect from phone" state and request a new token,
  never enter a silent 401 loop.
- No standalone watch login; the phone app is the only sign-in surface.
- Session payload includes account identity and selected-baby identity (id, name, timezone).
- A native bridge module inside the Expo Android app exposes session-push to the React Native
  layer — the Android sibling of `plugins/with-shared-supabase-session/`.

The detailed design (envelope format, DataClient vs MessageClient, storage primitive, phone refresh and
invalidation flows) is an open checkpoint from the brief: settle it in a design pass at the start of
this task and record it in the task branch before implementation.

## Proposed security design — awaiting `[confirm-security]` approval

The 2026-08-20 user decision limits Wear authentication to functionality already supported by the
Apple Watch. Research found that copying a renewable session into an independently refreshing watch
is unsafe because the phone and watch can diverge within one rotating refresh-token family. This
design avoids that problem by keeping refresh-token ownership exclusively on the phone. See
`plans/research/watch-session-cross-device-renewal-2026-08.md` and
`plans/research/wear-os-session-handoff-design-2026-08.md`.

The proposed design is **phone-owned refresh with access-token-only handoff**:

- A versioned strict envelope carries disposition (`ACTIVE` or `INVALIDATED`), revision, account ID
  and label, selected baby ID/name/timezone, Supabase URL and anon key, and — only for `ACTIVE` — the
  current access token and its expiry. It has no refresh-token field.
- `DataClient` is the authoritative transport. The phone publishes an urgent latest-state
  `DataItem`; sign-out/account switch overwrites it with an urgent `INVALIDATED` tombstone rather
  than deleting it. The watch publishes an urgent durable refresh-request `DataItem` after a 401 or
  near expiry. `MessageClient` is not required for correctness.
- The native phone bridge accepts only the typed envelope from React Native, publishes it, and
  exposes pending refresh requests. React reconciles settled auth plus selected-baby state; loading
  is a no-op, token refresh republishes `ACTIVE`, and sign-out/account switch publishes
  `INVALIDATED`.
- The watch strictly validates version, revision, account, baby, URL, expiry, and disposition. A
  newer account or invalidation clears the old credential before any new identity is shown.
- The watch stores the access token and identity as one atomic AES-256-GCM ciphertext under
  `noBackupFilesDir`, with the non-exportable key in Android Keystore. Deprecated
  `EncryptedSharedPreferences`, plaintext fallback, and backup-restored ciphertext are excluded.
- All authenticated watch calls go through one session manager that can expose the access token but
  cannot refresh it. One 401 marks the credential stale, publishes a refresh request, and shows
  **Reconnect from phone** until a newer phone envelope arrives; it never retries in a loop.
  Transient connectivity retains the encrypted credential and shows retryable offline state.
  Tokens, headers, envelopes, and provider bodies are never logged.
- Same-account baby changes publish a newer `ACTIVE` identity. Invalidation delivery is durable but
  eventual for a disconnected watch, matching the companion-platform limitation.
- The signed-in state names the account and selected baby, then the watch performs the existing raw
  `get_baby_activity_snapshot` RPC using the selected baby ID/timezone as its authenticated smoke
  proof. Data Layer never carries activity data.

The application-facing seams stay narrow: React reconciles `loading`, `signedIn(identity, token)`,
and `signedOut(reason)` desired states; the Wear core depends on ports for commands, vault, and
snapshot probing. Google Play Services, Keystore, Supabase HTTP, and Compose remain adapters. No
Edge Function, OAuth server, new session, service-role credential, or database migration is added.

Alternatives considered:

- **A distinct watch session** through an Edge Function or OAuth/PKCE would support phone-free
  refresh, but the user explicitly excluded functionality beyond Apple Watch parity.
- **Copying the phone refresh token**, watch-side token redemption, `MessageClient`-only delivery,
  plaintext app storage, and deleting the invalidation item are rejected.

## Implementation work

- [x] Design pass: session envelope schema (versioned, like iOS `WatchSessionEnvelopeV1`), Data
      Layer mechanism, encrypted storage primitive (EncryptedSharedPreferences or equivalent),
      refresh flow, invalidation flow. Record the decisions in this task file or an adjacent note.
- [x] Native Android bridge module in the Expo app: RN-callable session push on sign-in, session
      update on account/baby switch, invalidation on sign-out.
- [x] Watch-side receiver: validate, store encrypted, expose session to an HTTP client.
- [x] Phone-owned refresh flow: a stale watch credential durably requests refresh; the phone
      refreshes Supabase and republishes; the watch shows "reconnect from phone" until it receives
      the newer access token.
- [x] Signed-in state screen replacing the 0089 placeholder (account/baby name), plus the
      authenticated snapshot RPC smoke call proving end-to-end auth.
- [x] Tests: envelope serialization round-trip, absence of refresh-token fields, storage encryption
      in place, phone-refresh request/success/failure paths, invalidation clears stored session.

## Implementation evidence

- The Expo plugin now regenerates the phone bridge, package registration, Wearable dependency, and
  background refresh-request listener idempotently. Its two focused Node contract tests pass.
- The Wear app accepts only versioned active/invalidation envelopes, persists the latest revision as
  one Android-Keystore-backed AES-256-GCM ciphertext under `noBackupFilesDir`, and durably publishes
  refresh requests through an urgent DataItem. Nine session/encryption/RPC Kotlin tests pass, plus
  the existing scaffold test.
- A 401 or near-expiry credential transitions to **Reconnect from phone** and emits at most one
  request for that revision. A late 401 from an older request cannot reject a newer credential.
- The phone reconciliation layer publishes the current access token and selected account/baby,
  never a refresh token; successful phone refreshes flow through the existing auth session update
  and republish path. Six focused TypeScript tests, typecheck, and changed-file lint pass.
- `:app:assembleDebug` and `:wear:assembleDebug` both pass. Focused logs are retained under
  `/tmp/agent-workflows/e2f8af45fd34/14c354181b4b/`.

## Human checkpoints

- [x] [confirm-security] Session-handoff design (transport, storage at rest, phone-owned refresh,
      invalidation) approved by the user on 2026-08-20 before implementation.
- [ ] [confirm-security] Review the session-handoff implementation before merge — this moves
      Supabase access-token material across the phone↔watch trust boundary.
- [ ] [verify] Pair Wear OS 4 emulator with Android emulator; sign in on phone. · Expected: watch
      shows signed-in state with baby name; sign out on phone returns watch to signed-out screen.
      · Failure: watch stays signed out, or stays signed in after phone sign-out. · Reason:
      cross-device Data Layer delivery cannot be asserted in unit tests.

## Acceptance criteria

- [ ] Sign-in on phone results in the watch holding a working session (authenticated snapshot RPC
      returns 200).
- [ ] A stale access token makes the watch request a phone refresh and accept the newer token when
      delivered; the watch never receives or redeems a refresh token.
- [ ] When the phone cannot refresh or is unreachable, the watch shows "reconnect from phone"; no
      silent 401 loop.
- [ ] Phone sign-out/account-switch clears the watch session.
- [ ] Session at rest on the watch is encrypted; no token appears in logs.
- [ ] All new tests green in CI.
