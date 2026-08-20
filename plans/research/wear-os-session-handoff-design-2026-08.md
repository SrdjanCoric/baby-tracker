# Wear OS session-handoff platform facts

## Planning decision informed

How Task 0090 should transport, persist, refresh, and invalidate a Supabase credential on Wear OS
without creating an unsafe second consumer of the phone's rotating refresh-token family.

## Answer

Use a versioned, urgent `DataItem` for durable latest-state delivery and an app-owned encrypted
store on the watch. Do not copy the phone refresh token into an independently refreshing watch:
the two devices can diverge beyond Supabase's narrow reuse exceptions and revoke the shared
session.

An independent watch session requires project or backend work. Supabase offers no client-side
device grant or session-cloning API. The supported building blocks are either OAuth 2.1
Authorization Code + PKCE with an enabled OAuth server and authorization UI, or a trusted backend
that issues a one-time magic-link token for the watch to redeem.

## Verified findings

- A Wear OS `DataItem` persists until deleted, can be written while peers are disconnected, and
  synchronizes later. Non-urgent delivery may be delayed; `setUrgent()` requests immediate sync but
  has no bounded delivery guarantee. — [Android Data Layer client comparison](https://developer.android.com/training/wearables/data/client-types),
  [DataItem synchronization](https://developer.android.com/training/wearables/data/data-items)
- `MessageClient` targets a connected node but is best effort, is not persisted, and reports
  queuing rather than recipient delivery. — [MessageClient reference](https://developers.google.com/android/reference/com/google/android/gms/wearable/MessageClient)
- Data Layer access requires matching package names and signatures. Bluetooth uses its managed
  encrypted channel; cloud relay is end-to-end encrypted. The persistent Data Layer store is not
  documented as encrypted at rest, so it is transport rather than the watch's credential vault. —
  [Data Layer overview and security](https://developer.android.com/training/wearables/data/overview)
- AndroidX Security Crypto 1.1 deprecated `EncryptedSharedPreferences` and the rest of its APIs in
  favor of platform APIs and direct Android Keystore use. Keystore can hold non-exportable AES-GCM
  key material; the application stores ciphertext and its metadata separately. —
  [Security Crypto release notes](https://developer.android.com/jetpack/androidx/releases/security),
  [Android Keystore](https://developer.android.com/privacy-and-security/keystore),
  [KeyGenParameterSpec](https://developer.android.com/reference/android/security/keystore/KeyGenParameterSpec)
- DataStore is the stable modern store for small app-owned state, but official transparent AEAD
  support is currently in the DataStore 1.3 alpha line. A stable-dependency design therefore needs
  a direct Keystore AEAD adapter around app-private ciphertext storage. —
  [DataStore guide](https://developer.android.com/topic/libraries/architecture/datastore),
  [DataStore releases](https://developer.android.com/jetpack/androidx/releases/datastore)
- Supabase refresh tokens rotate and are normally single-use. The default reuse window and the
  direct-parent recovery rule cover brief concurrency or one missed response; reuse farther behind
  terminates that session and its refresh tokens. — [Supabase session docs](https://supabase.com/docs/guides/auth/sessions),
  [Supabase Auth token service](https://github.com/supabase/auth/blob/master/internal/tokens/service.go)
- Supabase's Kotlin `importSession` installs the supplied pair locally; it does not create a new
  server session. Copying the phone pair therefore copies its `session_id` and refresh family. —
  [Kotlin session import](https://supabase.com/docs/reference/kotlin/auth-setsession),
  [Supabase session model](https://supabase.com/docs/guides/auth/sessions)
- Supabase's OAuth server can create a distinct public-client session through Authorization Code +
  PKCE, but it has no Device Authorization Grant or general token-exchange grant. It requires OAuth
  server configuration, a registered client, and authorization UI. —
  [OAuth server setup](https://supabase.com/docs/guides/auth/oauth-server/getting-started),
  [OAuth flows](https://supabase.com/docs/guides/auth/oauth-server/oauth-flows)
- A trusted backend can call `generateLink`, pass its one-time token hash through an
  application-owned pairing channel, and let the watch call `verifyOtp` to receive a distinct
  session. The admin secret must remain in the backend; the token hash is a bearer login secret. —
  [Admin generateLink](https://supabase.com/docs/reference/javascript/auth-admin-generatelink),
  [verifyOtp](https://supabase.com/docs/reference/javascript/auth-verifyotp),
  [API key security](https://supabase.com/docs/guides/getting-started/api-keys)

## Reasonable inferences

- A single phone-owned `DataItem` path containing either current authorization state or an explicit
  invalidation tombstone is the durable transport shape. Keeping the tombstone instead of deleting
  the item prevents a disconnected watch from missing sign-out.
- Direct Android Keystore AES-GCM with app-private ciphertext under `noBackupFilesDir` avoids a
  deprecated crypto dependency, restored-ciphertext/key mismatches, and background-unlock prompts.
- An OAuth/PKCE watch session is the strongest documented independent-session option, but it is a
  larger product and project-configuration change. A backend-issued one-time token is simpler for a
  phone-mediated companion flow, but the pairing, replay, rate-limit, and explicit-consent protocol
  becomes application-owned.
- Both independent-session approaches normally start the watch at `aal1`; neither is documented to
  inherit a phone session's `aal2`.

## Applicability

The repository targets Wear OS 4+/API 33, already has a phone-owned Supabase session with automatic
refresh, and has no Wearable dependency, watch credential store, OAuth server integration, or
session-minting Edge Function. The existing snapshot RPC and RLS remain reusable once the watch has
a safe independent session.

## Unresolved uncertainty

- The deployed project's refresh-reuse, single-session, OAuth-server, and MFA settings have not
  been inspected.
- Supabase's OAuth server is beta. Neither OAuth/PKCE nor `generateLink` is documented as a Wear OS
  provisioning protocol; cross-device pairing and device binding remain application-owned.
- Data Layer offers no receipt guarantee or maximum urgent-delivery latency, so phone sign-out can
  only clear an offline watch after it reconnects unless the server also revokes the watch session.

## Sources

- [Android Data Layer documentation](https://developer.android.com/training/wearables/data/overview) — transport ownership, isolation, and security.
- [Android Keystore documentation](https://developer.android.com/privacy-and-security/keystore) — platform credential protection.
- [Supabase session documentation](https://supabase.com/docs/guides/auth/sessions) — session identity and refresh-token rotation.
- [Supabase OAuth server documentation](https://supabase.com/docs/guides/auth/oauth-server) — independent public-client authorization.
- [Supabase Auth source](https://github.com/supabase/auth/blob/master/internal/tokens/service.go) — current refresh and session issuance behavior.
