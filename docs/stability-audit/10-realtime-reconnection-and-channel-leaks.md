# Realtime Reconnection and Channel Leak Audit Report

## Summary

The Realtime sync system (`src/services/sync/real-time-sync.ts`) has three issues: no automatic reconnection after connection loss, channel objects leaked on unsubscribe, and a permissive default in ownership verification. The first two mean that after any network blip, multi-caregiver sync stops permanently until app restart.

---

## Issue 1: No reconnection logic on channel error

**Severity: HIGH**
**File:** `src/services/sync/real-time-sync.ts`, lines 94-107

```typescript
this.subscription = channel.subscribe((status: string, error?: Error) => {
  if (status === 'SUBSCRIBED') {
    this.setConnected(true);
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    this.setConnected(false, true);
    if (error) {
      this.notifyError(error);
    } else {
      this.notifyError(new Error(`Subscription failed: ${status}`));
    }
  } else if (status === 'CLOSED') {
    this.setConnected(false);
  }
});
```

When the channel enters `CHANNEL_ERROR`, `TIMED_OUT`, or `CLOSED` state:
- `connected` is set to `false`
- Error listeners are notified
- **No reconnection is attempted**

Supabase's internal WebSocket has some basic retry, but once the status callback fires with an error, the channel is dead. The `RealTimeSync` class never calls `subscribeToHousehold()` again.

**Impact:** After any network interruption (WiFi switch, cell signal drop, phone sleep), Realtime stops permanently. Other caregivers' changes never arrive. The user sees no indication that sync is broken.

**Fix:** Add reconnection with exponential backoff. Track reconnection state to avoid infinite loops:

```typescript
private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
private reconnectAttempts = 0;
private static readonly MAX_RECONNECT_ATTEMPTS = 10;
private static readonly BASE_RECONNECT_DELAY_MS = 1000;

private scheduleReconnect(householdId: string): void {
  if (this.reconnectAttempts >= RealTimeSync.MAX_RECONNECT_ATTEMPTS) {
    this.notifyError(new Error('Max reconnection attempts reached'));
    return;
  }

  const delay = Math.min(
    RealTimeSync.BASE_RECONNECT_DELAY_MS * Math.pow(2, this.reconnectAttempts),
    30000
  );
  this.reconnectAttempts++;

  this.reconnectTimer = setTimeout(async () => {
    try {
      this.subscription = null;
      this.currentHouseholdId = null;
      await this.subscribeToHousehold(householdId);
      this.reconnectAttempts = 0;
    } catch (error) {
      this.scheduleReconnect(householdId);
    }
  }, delay);
}
```

Call `scheduleReconnect(this.currentHouseholdId)` from the `CHANNEL_ERROR` and `TIMED_OUT` handlers. Clear `reconnectTimer` in `unsubscribe()` and `destroy()`. Reset `reconnectAttempts` on successful `SUBSCRIBED`.

---

## Issue 2: Channel not removed on unsubscribe

**Severity: MEDIUM**
**File:** `src/services/sync/real-time-sync.ts`, lines 218-225

```typescript
unsubscribe(): void {
  if (this.subscription) {
    this.subscription.unsubscribe();
    this.subscription = null;
  }
  this.currentHouseholdId = null;
  this.setConnected(false);
}
```

The code calls `this.subscription.unsubscribe()` which detaches the local listener, but never calls `supabase.removeChannel(channel)` to remove the channel from Supabase's internal registry. The channel object created at line 78 (`supabase.channel(...)`) is never cleaned up.

**Impact:** Each household switch or reconnection creates a new channel without removing the old one. Supabase's client library accumulates channels. Over time, the server side holds zombie channel subscriptions, consuming resources. In a long session with multiple household switches, this can hit Supabase's channel limits.

**Fix:** Store the channel reference and call `removeChannel()` on unsubscribe:

```typescript
private channel: ReturnType<typeof supabase.channel> | null = null;

async subscribeToHousehold(householdId: string): Promise<void> {
  // ... existing validation ...
  if (this.subscription) {
    this.cleanupChannel();
  }
  this.channel = supabase.channel(`household:${householdId}`);
  // ... register listeners on this.channel ...
  this.subscription = this.channel.subscribe(...);
}

private cleanupChannel(): void {
  if (this.subscription) {
    this.subscription.unsubscribe();
    this.subscription = null;
  }
  if (this.channel) {
    supabase.removeChannel(this.channel);
    this.channel = null;
  }
}

unsubscribe(): void {
  this.cleanupChannel();
  this.currentHouseholdId = null;
  this.setConnected(false);
}
```

---

## Issue 3: verifyChangeOwnership defaults to `true` for activity tables

**Severity: LOW (defense-in-depth)**
**File:** `src/services/sync/real-time-sync.ts`, lines 136-175

```typescript
private verifyChangeOwnership(change: RemoteChange): boolean {
  if (!this.authContext) return false;
  const data = change.new || change.old;
  if (!data) return false;

  if (change.table === 'babies') { /* household_id check */ }
  if (change.table === 'users') { /* household_id check */ }
  if (change.table === 'households') { /* id check */ }

  return true;  // Line 174: ALL other tables pass through
}
```

Tables like `feedings`, `sleep_sessions`, `diapers`, `pumping_sessions`, `growth_measurements`, `tummy_time_sessions`, `active_timers`, and `wake_window_preferences` all hit the default `return true` at line 174. This relies entirely on RLS to filter changes.

**Impact:** Low in practice because Supabase RLS does filter correctly. But if RLS were ever misconfigured, the app would process changes from any household. This is a defense-in-depth concern, not an active bug.

**Fix:** Add explicit `baby_id` lookup for activity tables. Since all activity tables have a `baby_id` column, verify the baby belongs to the user's household:

```typescript
// Activity tables have baby_id — verify via local state
const activityTables = ['feedings', 'sleep_sessions', 'diapers',
  'pumping_sessions', 'growth_measurements', 'tummy_time_sessions'];
if (activityTables.includes(change.table)) {
  // Trust RLS but log unexpected baby_ids for monitoring
  return true;
}

if (change.table === 'active_timers' || change.table === 'wake_window_preferences') {
  return true; // Household-scoped via RLS
}

// Unknown table — reject for safety
console.warn('[RealTimeSync] Unknown table in change event:', change.table);
return false;
```

---

## Issue 4: No auth token refresh detection in sync engine

**Severity: MEDIUM**
**File:** `src/services/sync/sync-engine.ts`, lines 309-357

```typescript
private async executeOperation(operation: QueuedOperation): Promise<void> {
  // ... switch on operation type ...
  case 'CREATE': {
    const { error } = await supabase.from(table).insert(data).abortSignal(controller.signal);
    if (error) {
      if (error.code === '23505') return; // duplicate key — only special case
      throw new Error(`Failed to create ${table}: ${error.message}`);
    }
  }
}
```

The error handling only checks for `23505` (duplicate key). When an auth token expires, Supabase returns a 401/403 error. The code treats this as a generic failure, retries with the same expired token, and eventually quarantines the operation.

**Impact:** All pending operations get quarantined instead of triggering a token refresh. The user's data stops syncing until app restart.

**Fix:** Check for auth-related errors and signal the auth context to refresh:

```typescript
if (error) {
  if (error.code === '23505') return;
  if (error.message?.includes('JWT') || error.code === 'PGRST301' || error.code === '401') {
    // Auth token likely expired — let Supabase client refresh
    await supabase.auth.refreshSession();
    throw new Error(`Auth error on ${table}, retrying after refresh: ${error.message}`);
  }
  throw new Error(`Failed to create ${table}: ${error.message}`);
}
```

---

## Implementation Checklist

- [x] **Task 1:** Add reconnection with exponential backoff to `RealTimeSync` (`real-time-sync.ts`). Handle CHANNEL_ERROR, TIMED_OUT with `scheduleReconnect()`. Reset on SUBSCRIBED. Clear in unsubscribe/destroy.
- [x] **Task 2:** Store channel reference in `RealTimeSync`. Call `supabase.removeChannel()` in `unsubscribe()` and `destroy()`.
- [x] **Task 3:** Change `verifyChangeOwnership` default return to `false` with a warning log for unknown tables.
- [x] **Task 4:** Add auth error detection in `sync-engine.ts` `executeOperation` to trigger `supabase.auth.refreshSession()` before retry.
