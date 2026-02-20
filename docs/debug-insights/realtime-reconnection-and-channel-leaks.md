# Realtime Sync Silently Dies After Network Interruption

**Date:** 2026-02-20
**Files involved:** `src/services/sync/real-time-sync.ts`, `src/services/sync/sync-engine.ts`

## Symptom

After any network interruption (WiFi switch, cell signal drop, phone sleep), multi-caregiver Realtime sync stops permanently. Other caregivers' changes never arrive. The user sees no indication that sync is broken — the app appears normal but is silently disconnected. Requires full app restart to recover.

Additionally, switching households or reconnecting leaks Supabase channel objects, accumulating zombie subscriptions that consume server resources.

## Root Cause

Four related issues in the sync layer:

1. **No reconnection logic.** When the Supabase channel fires `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED`, `RealTimeSync` sets `connected = false` and notifies error listeners — but never attempts to resubscribe. The channel is dead and stays dead.

2. **Channel objects leaked on unsubscribe.** `unsubscribe()` called `this.subscription.unsubscribe()` (detaches the local listener) but never called `supabase.removeChannel(channel)`. The channel object created by `supabase.channel(...)` stays in Supabase's internal registry forever. Each household switch or reconnection creates a new one without cleaning up the old one.

3. **`verifyChangeOwnership` defaulted to `true`.** Any table not explicitly handled (all activity tables, `active_timers`, `wake_window_preferences`) hit a catch-all `return true`. If RLS were ever misconfigured, changes from any household would pass through.

4. **Auth token expiry treated as generic failure.** When a Supabase auth token expires, the API returns 401/PGRST301. `executeOperation` treated this as a normal error, retried with the same expired token, and eventually quarantined the operation. No token refresh was ever triggered.

## Fix

**Reconnection (real-time-sync.ts):**
- Added `scheduleReconnect(householdId)` with exponential backoff: 1s base delay, 2x growth, 30s cap, max 10 attempts.
- Called from `CHANNEL_ERROR` and `TIMED_OUT` handlers.
- `reconnectAttempts` resets to 0 on successful `SUBSCRIBED`.
- Reconnect timer cleared in `unsubscribe()` and `destroy()`.

**Channel cleanup (real-time-sync.ts):**
- Store channel reference separately: `private channel: ReturnType<typeof supabase.channel> | null`.
- Added `cleanupChannel()` that calls both `subscription.unsubscribe()` and `supabase.removeChannel(channel)`.
- Used in `unsubscribe()`, `destroy()`, and at the start of `subscribeToHousehold()` when replacing an existing subscription.

**Ownership verification (real-time-sync.ts):**
- Explicitly handle activity tables and `active_timers`/`wake_window_preferences` with `return true`.
- Default changed to `return false` with `console.warn('[RealTimeSync] Unknown table in change event:', change.table)`.

**Auth error detection (sync-engine.ts):**
- Added `isAuthError()` that checks for codes `PGRST301`, `401`, `403`, and messages containing `JWT`.
- Added `handleSupabaseError()` that calls `supabase.auth.refreshSession()` before rethrowing on auth errors.
- All three operation types (CREATE, UPDATE, DELETE) route errors through this handler.

## Lessons / Notes

- **Supabase channels have two-step cleanup.** `subscription.unsubscribe()` only detaches the local callback. You must also call `supabase.removeChannel(channel)` to remove it from the client's internal registry and close the server-side subscription. Forgetting the second step leaks channels.

- **Network recovery must be explicit.** Supabase's internal WebSocket has some retry, but once the status callback fires with an error state, the channel won't self-heal. Application-level reconnection with backoff is required.

- **Default-open vs default-closed in verification.** A `return true` catch-all in ownership verification is defense-in-depth debt. Even when RLS is the primary guard, application-level checks should be default-deny for unknown cases.

- **Auth errors need special handling in offline queues.** An expired JWT looks like a transient error to a naive retry loop. The operation gets retried N times with the same dead token, then quarantined. Detecting auth errors and triggering a token refresh before retry is essential for long-running sessions.
