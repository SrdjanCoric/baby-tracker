# Can Apple Watch safely renew the iPhone's shared Supabase session?

## Planning decision informed

Whether Task 0084 can extend Task 0083's iPhone-local shared session directly to Apple Watch, or
needs a different credential boundary and refresh-ownership design.

## Answer

No. The Task 0083 Keychain capsule and App Group lock are local to the iPhone. Its
`AfterFirstUnlockThisDeviceOnly` item cannot synchronize to Apple Watch, and App Group storage is
same-device storage. WatchConnectivity can transfer credential material to the Watch, but that
would create a second, Watch-local copy.

Two independently persisted copies of one rotating Supabase refresh-token family are not durably
safe. Supabase tolerates brief concurrent reuse and one generation of failed-save recovery, but a
device that falls further behind can trigger reuse detection and terminate the whole session.

## Verified findings

- Apple describes App Groups as sharing content among processes on the same device; they do not
  expose an iPhone container directly to watchOS. — [Apple Shared data](https://developer.apple.com/documentation/technologyoverviews/shared-data)
- Apple's Watch architecture guidance says watchOS stores its files and data on Apple Watch and
  requires explicit transfer from the companion iPhone app. — [Apple Watch app architecture](https://developer.apple.com/library/archive/documentation/General/Conceptual/AppleWatch2TransitionGuide/index.html)
- `kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` items do not migrate to a new device, and
  `ThisDeviceOnly` accessibility classes cannot be used for synchronizable Keychain items. —
  [Apple accessibility constant](https://developer.apple.com/documentation/security/ksecattraccessibleafterfirstunlockthisdeviceonly),
  [Apple Keychain accessibility](https://developer.apple.com/documentation/security/ksecattraccessible)
- Apple identifies WatchConnectivity as the companion iPhone/watchOS transfer mechanism and
  specifically recommends it for passing an authentication token already established on iPhone. —
  [Apple WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity),
  [Apple Watch app networking Tech Talk](https://developer.apple.com/videos/play/tech-talks/203/)
- iCloud Keychain synchronization is a distinct option requiring `kSecAttrSynchronizable`; users
  can disable it and it is not available in all regions. —
  [Apple WWDC21, Protecting user data with Keychain and Authentication Services](https://developer.apple.com/videos/play/wwdc2021/10003/)
- Supabase refresh tokens are single-use, rotation is enabled by default, and the default reuse
  interval is 10 seconds. Allowed recovery covers reuse inside that interval and reuse of the
  current token's parent. — [Supabase session docs](https://supabase.com/docs/guides/auth/sessions#what-is-refresh-token-reuse-detection-and-what-does-it-protect-from)
- Current Supabase Auth source serializes token-row refreshes and returns the active token for
  allowed reuse, but a token further behind than the active token's parent is accepted only inside
  the reuse interval; otherwise reuse detection terminates the session. —
  [Supabase Auth token service](https://github.com/supabase/auth/blob/713a0d9e37a0a12b9d0e97d8b9919addffa2356e/internal/tokens/service.go#L365-L415),
  [Supabase Auth reuse handling](https://github.com/supabase/auth/blob/713a0d9e37a0a12b9d0e97d8b9919addffa2356e/internal/tokens/service.go#L492-L577)
- Supabase supports independent sessions on multiple devices by default. That is distinct from
  copying one session's refresh token to multiple devices. —
  [Supabase session docs](https://supabase.com/docs/guides/auth/sessions#what-is-a-session)

## Reasonable inferences

- Giving the Watch the same access-group entitlement would only authorize a Watch-local Keychain
  namespace. It would not make the iPhone capsule or POSIX lock cross-device.
- Sending the capsule through WatchConnectivity and writing it to Watch Keychain creates a
  replicated refresh-token family. A Watch left offline while the iPhone advances by multiple
  rotations can later present a stale token and revoke the shared session outside the reuse window.
- A safe design therefore needs either one reachable authoritative refresh owner that distributes
  every rotated pair, or an independently revocable Watch credential/session. A cross-device mutex
  without authoritative latest-pair synchronization is insufficient.

## Applicability

The repository currently stores the iPhone/Widget capsule with
`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly` and coordinates it with an iPhone App Group
POSIX lock. The Watch target receives a static access token through WatchConnectivity and has no
Security framework or shared-Keychain entitlement. Research was checked on 2026-08-11 against
current Apple documentation and Supabase documentation plus Supabase Auth commit
`713a0d9e37a0a12b9d0e97d8b9919addffa2356e`.

## Unresolved uncertainty

- Hosted Supabase may run a different Auth release or project-specific rotation/reuse settings;
  the repository does not establish the deployed values beyond Task 0083's recorded assumptions.
- Apple does not document copied refresh-token replicas as a safe companion-app pattern.
- Creating a separate Supabase session for Watch without collecting primary sign-in credentials
  requires a product/server design; the current task does not define one.

## Sources

- [Apple Shared data](https://developer.apple.com/documentation/technologyoverviews/shared-data) — current first-party platform storage boundaries.
- [Apple WatchConnectivity](https://developer.apple.com/documentation/watchconnectivity) — current first-party companion transfer API.
- [Apple Keychain accessibility](https://developer.apple.com/documentation/security/ksecattraccessible) — current first-party synchronization constraints.
- [Supabase session docs](https://supabase.com/docs/guides/auth/sessions) — current official session and refresh-token behavior.
- [Supabase Auth token service](https://github.com/supabase/auth/blob/713a0d9e37a0a12b9d0e97d8b9919addffa2356e/internal/tokens/service.go#L365-L577) — first-party implementation at the inspected commit.
