# Guest Data Migration & Notification Preference Sync

## Problem 1: Guest data migrated on every sign-in

**Symptom:** When a previously authenticated user signed out, created guest data, then signed back in after an app restart, the guest data could be pushed into the account's household and duplicate existing data.

**Root cause:** The guest-to-account migration in `baby-context.tsx` used an in-memory `hasMigratedRef`. The ref prevented repeated work in one session but reset when the app restarted. A later account-age check reduced the window but could still guess incorrectly and could not recover interrupted writes.

**Fix:** `guest-account-migration.ts` now stores a migration record in `@guest_account_migration_v1` before it writes authenticated data. The record contains the guest snapshot, selected baby, target account, target household, and stable baby ID map.

An account with one baby that matches normalized name, birth date, and gender reuses that account baby. A new account receives stable target IDs. Different or ambiguous account data pauses migration until the caregiver chooses one of these outcomes:

- Use another account, which signs out and preserves all guest data.
- Keep the account data, which requires confirmation before deleting the guest snapshot.

Migration retries the remaining baby writes, queues activity upserts with stable IDs, persists the selected authenticated baby, and clears guest storage only after those operations succeed. The saved record makes callback replay, app restart, and Realtime acknowledgement safe to retry.

---

## Problem 2: Adding `created_at` to Supabase query silently broke everything

**Symptom:** After implementing the migration fix, ALL activity data (feedings, tummy time, sleep, etc.) disappeared after closing and reopening the app. Data loss across all activity types.

**Root cause:** To get the user's `created_at`, we added it to the `fetchUserProfile` Supabase query:

```typescript
// BROKEN - created_at doesn't exist on the `users` table
.select("household_id, display_name, is_owner, created_at")
```

The `users` table doesn't have a `created_at` column (it's on `auth.users`, not `public.users`). Supabase returned an error, which the error handler caught and returned `{ householdId: null, displayName: null, isOwner: false }`.

With `householdId: null`, the entire app fell back to local/guest storage mode — loading from empty AsyncStorage instead of Supabase, making it appear that all data was lost.

**Why it was hard to catch:** The error was silent. `fetchUserProfile` has a catch-all that returns defaults on any error. No logs were emitted. The app appeared to work — it just loaded empty local data instead of database data.

**Fix:** Get `createdAt` from the Supabase auth `User` object (`supabaseUser.created_at`) instead of querying the `users` table. The auth User object always has this field.

```typescript
function mapSupabaseUser(supabaseUser: User | null, profile: { ... }): AuthUser | null {
  return {
    ...
    createdAt: supabaseUser.created_at, // From auth, not from users table
  };
}
```

**Lesson:** Never add columns to a Supabase `.select()` without verifying they exist on that specific table. Silent query failures that return defaults can cascade into app-wide data loss. Consider adding explicit error logging in `fetchUserProfile` rather than silently returning defaults.

---

## Problem 3: Feeding reminder preferences not syncing to database

**Symptom:** User toggled feeding reminders ON in notification settings, but the `feeding_reminder_preferences` table in Supabase remained empty. The edge function `check-feeding-reminders` found no preferences and sent no reminders.

**Root cause:** The `useNotificationIntegration` hook (which calls `syncFeedingPreferenceForBaby` to write preferences to the database) is only mounted on feeding screens (`app/feeding/*.tsx`). When the user toggled the setting in `app/settings/notifications.tsx`, no sync hook was active.

The notification settings screen updated local AsyncStorage (`@notification_settings`) correctly, but never wrote to the `feeding_reminder_preferences` database table.

**Fix:** Added explicit `syncFeedingPreferenceForBaby` calls in the notification settings screen's toggle and interval change handlers:

```typescript
// In app/settings/notifications.tsx
const handleToggleFeedingReminders = useCallback(async (enabled: boolean) => {
  await updateSettings({ feedingReminders: { ...settings.feedingReminders, enabled } });
  if (selectedBaby?.id) {
    syncFeedingPreferenceForBaby(selectedBaby.id);
  }
}, [...]);
```

**Lesson:** When a feature has both a settings screen and an activity screen, verify that database sync happens from BOTH locations. Hooks that sync on mount/change only work when the component is actually mounted.

---

## Problem 4: `__DEV__` not defined in Vitest

**Symptom:** After adding a dev-only 1-minute feeding reminder interval using `__DEV__`, unit tests failed with `ReferenceError: __DEV__ is not defined`.

**Root cause:** `__DEV__` is a React Native global injected by Metro bundler. Vitest runs in Node and doesn't have it.

**Fix:** Added `define: { __DEV__: true }` to `vitest.config.ts`:

```typescript
export default defineConfig({
  define: { __DEV__: true },
  test: { ... },
});
```

---

## Key Takeaways

1. **Silent Supabase query failures are dangerous.** A bad `.select()` column causes the entire query to fail, and if the error handler returns "safe" defaults like `null`, downstream code may silently enter a degraded state (guest mode instead of authenticated mode).

2. **Always check which table/schema owns a column.** `created_at` exists on `auth.users` but not on `public.users`. The Supabase auth `User` TypeScript type exposes it, so use that instead of querying the wrong table.

3. **Cross-screen feature sync requires explicit wiring.** A notification setting toggled on a settings screen must sync to the database immediately — not rely on a hook that only runs on the activity screen.

4. **Account age is not a migration boundary.** Persist migration intent and stable ID mappings, retain the guest snapshot until server acknowledgement, and ask the caregiver when account data does not match.
