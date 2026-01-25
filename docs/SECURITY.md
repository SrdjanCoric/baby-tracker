# Security Configuration

This document outlines security configurations and considerations for the Baby Tracker application.

## Rate Limiting

### Household Invite Code Protection

The `join_household_by_invite_code` RPC function should be protected by rate limiting to prevent brute-force attacks on invite codes.

#### Invite Code Entropy

Invite codes use a 32-character alphabet (uppercase letters and digits, excluding ambiguous characters like 0/O, 1/I/L) with 8 characters:
- Total combinations: 32^8 = ~1.1 trillion possibilities
- Entropy: ~40 bits

While this provides reasonable security against random guessing, rate limiting adds defense-in-depth.

#### Recommended Supabase Configuration

Configure rate limiting in the Supabase Dashboard:

1. Navigate to **Project Settings** > **API** > **Rate Limiting**
2. Add a custom rate limit for the `join_household_by_invite_code` RPC:
   - **Limit**: 5 requests per minute per IP
   - **Scope**: Per IP address

Alternatively, use Supabase Edge Functions with built-in rate limiting:

```sql
-- Example: Track failed attempts in database
CREATE TABLE invite_code_attempts (
  ip_address inet PRIMARY KEY,
  attempt_count integer DEFAULT 1,
  last_attempt_at timestamptz DEFAULT now()
);

-- Clean up old entries periodically
CREATE OR REPLACE FUNCTION cleanup_old_attempts()
RETURNS void AS $$
BEGIN
  DELETE FROM invite_code_attempts
  WHERE last_attempt_at < now() - interval '1 hour';
END;
$$ LANGUAGE plpgsql;
```

#### Why Server-Side Rate Limiting

Server-side rate limiting (via Supabase/infrastructure) is preferred over client-side rate limiting because:
- Cannot be bypassed by modified clients
- Centralized enforcement across all clients
- Protects against distributed attacks from multiple devices

## Row-Level Security (RLS)

The application relies on Supabase RLS policies for data access control:

### Household Data Isolation

- Users can only access data belonging to their household
- Activity tables (feedings, sleep_sessions, etc.) are filtered by `baby_id` which references babies in the user's household
- Real-time sync verifies ownership before applying remote changes (see `verifyChangeOwnership` in `real-time-sync.ts`)

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
