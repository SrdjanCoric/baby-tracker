# Security Configuration

This document outlines security configurations and considerations for the Baby Tracker application.

## Rate Limiting

### Caregiver invitation protection

Household owners create seven-day, single-use invitation codes for a specific normalized email. Redemption requires an authenticated account with that verified email. After the post-release enforcement switch is enabled, unknown, mismatched, expired, revoked, consumed, and legacy household-wide codes return no household data.

The database records failed attempts and allows five failures per authenticated user per hour. The app applies the same limit locally. Invite codes use a 32-character alphabet with eight characters, which provides about 40 bits of entropy, and omit ambiguous characters such as `0`, `O`, `1`, `I`, and `L`.

Clients have no direct access to `caregiver_invitations` or the rollout switch. Security-definer RPCs enforce owner-only management and verified-email redemption. Migration 058 initially permits legacy household codes so old apps keep working before the new version is deployed. See [Caregiver invitations](CAREGIVER_INVITATIONS.md) for the cutover procedure, RPC contract, and verification commands.

## Row-Level Security (RLS)

The application relies on Supabase RLS policies for data access control:

### Household Data Isolation

- Users can only access data belonging to their household
- Activity tables (feedings, sleep_sessions, etc.) are filtered by `baby_id` which references babies in the user's household
- Real-time sync verifies ownership before applying remote changes (see `verifyChangeOwnership` in `real-time-sync.ts`)

### Live Activity Push Tokens

Migration 066 protects `live_activity_push_tokens` with RLS: authenticated users can
read and delete only their own rows and have no direct insert or update access.
The `register_live_activity_push_token` security-definer RPC verifies the caller's
user ID, household membership, and active timer instance before registering or
rotating a token. Registrations serialize on the timer row and allow at most eight
activities per user and timer, including under concurrent requests; existing tokens
can still rotate at the limit. End delivery uses at most eight concurrent requests
and a ten-second delivery budget. Anonymous callers cannot invoke the RPC. The service-role DELETE
webhook reads tokens for the exact baby and timer instance; token rows survive
timer deletion for delivery and expire after 24 hours.

Push-to-start registrations live separately in `live_activity_start_tokens` (migration 067),
one row per account and installation (`user_id`, `device_id`). RLS permits authenticated users
to SELECT and DELETE only their own rows; direct INSERT/UPDATE and anonymous access are denied.
The `register_live_activity_start_token(text,text,boolean,uuid)` SECURITY DEFINER RPC uses an
empty search path, verifies the supplied account against `auth.uid()`, validates identifiers and
hex tokens through table constraints, and serializes registration. Registering an APNs token for a
new account removes that token's prior-account rows under a token-level transaction lock. An
account retains at most eight installations; a new installation evicts the least recently updated
registration when necessary.

Sign-out attempts both token-table cleanups independently and scopes start-token deletion to the
current installation. Unchanged start tokens refresh on synchronization once an hour old. An
indexed hourly `cleanup-live-activity-start-tokens` job deletes registrations older than 24 hours,
providing a backstop for failed sign-out or abandoned installations. APNs 410 and 400
`BadDeviceToken` responses remove invalid start registrations. Until re-registration or expiry,
a failed offline sign-out can leave a stale registration; account transfer removes it when the
same token registers again. Push-to-start payloads include baby and caregiver names and are sent
only to other current household members.

### User Profile Access

- Users can read basic profile info of household members (for caregiver attribution)
- Users can only update their own profile


## Authentication

### Supported Methods

- Email/Password authentication
- Magic link authentication (PKCE flow on Android)
- Native Google Sign-In (iOS/Android)
- Apple Sign-In (iOS)

### Session Management

- Sessions managed by Supabase Auth
- Refresh tokens used for session renewal
- Deep linking (`sofibaby://`) handles OAuth callbacks securely

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by contacting the development team directly rather than opening a public issue.
