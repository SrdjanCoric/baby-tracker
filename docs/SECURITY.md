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
rotating a token. Anonymous callers cannot invoke it. The service-role DELETE
webhook reads tokens for the exact baby and timer instance; token rows survive
timer deletion for delivery and expire after 24 hours.

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
