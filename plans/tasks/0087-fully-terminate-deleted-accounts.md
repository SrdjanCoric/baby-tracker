# Task 0087: Fully terminate deleted accounts

**Branch**: `feature/fully-terminate-deleted-accounts`
**Depends on**: none
**Source**: Production Supabase error diagnosis, conversation 2026-08-16 · **User stories**: a caregiver who deletes their account is signed out everywhere and no device can keep writing on their behalf; production logs stop filling with foreign-key and row-level-security errors from dead accounts

## What to build

Account deletion today calls the `delete_user_account` RPC, which deletes the `public.users` row
(and household data where applicable) but deliberately leaves the `auth.users` row alive and never
revokes refresh tokens. Any other signed-in device — or a reinstall that restored a session —
keeps a valid JWT and continues syncing as a "zombie": `supabase.auth.getUser()` succeeds, but the
`public.users` row is gone. Confirmed production symptoms, three-plus occurrences each:

```
insert or update on table "feeding_reminder_preferences" violates foreign key constraint "feeding_reminder_preferences_user_id_fkey"
new row violates row-level security policy for table "achievements"
```

The feeding-preferences upsert auto-fires from the notification-integration hook on mount whenever
a baby is selected, so a zombie device errors on every launch. The achievements insert goes through
the sync queue, which retries it indefinitely (queue policy is Task 0058's scope, not this task's).

Build complete termination:

1. A new edge function (e.g. `delete-account`) using the service-role key that, for the
   authenticated caller only: runs the existing `delete_user_account` deletion logic, then calls
   `auth.admin.deleteUser()` so the `auth.users` row and all refresh tokens die with the account.
   The function must verify the caller's JWT identity matches the account being deleted — it must
   never accept an arbitrary target user id.
2. The client (`AccountDeletionService`) calls the edge function instead of the bare RPC.
3. The delete-account screen revokes all sessions — `signOut({ scope: "global" })` — and the
   ordering guarantees local storage is wiped without leaving a revocable session behind (today
   `clearLocalStorage()` runs before `signOut()`, which can wipe the stored session the sign-out
   needs).
4. One-time production cleanup of existing zombies: `auth.users` rows with no matching
   `public.users` row are deleted after owner review (see human checkpoints).

Keep the `delete_user_account` authorization check (`auth.uid()` must equal the target) intact
wherever the deletion logic ends up.

## Implementation work

- [ ] Add the `delete-account` edge function: authenticate the caller, run the account-data deletion, then `auth.admin.deleteUser()` for the caller's own id; return distinct errors for auth failure vs. deletion failure.
- [ ] Point `AccountDeletionService.deleteAccount` at the edge function; preserve the existing offline/network error contract used by the delete-account screen.
- [ ] Fix sign-out ordering in the delete-account flow so all sessions are revoked globally and local storage is cleared without stranding a live session.
- [ ] Add tests: SQL/RPC vectors proving `delete_user_account` still refuses cross-user deletion; a client-seam test that deletion success ends with no locally stored session; an edge-function test (local Supabase) that a deleted account's refresh token can no longer mint a session and the `auth.users` row is gone.
- [ ] Run `npm run test:unit`, `npm run test:security`, and `npm run test:sql`.

## Human checkpoints

- [ ] [confirm-security] Approve the trust-boundary design: service-role edge function deleting the caller's own auth user, and global session revocation ordering.
- [ ] [confirm-db] Approve the one-time production cleanup deleting `auth.users` rows that have no `public.users` row (query first, review the list, then delete).
- [ ] [verify] Confirm the error storm stops · Steps: after deploy and cleanup, watch Supabase logs for the two error signatures above for a day of normal traffic · Expected: zero new occurrences from deleted accounts · Failure: the same signatures recur with user ids absent from `public.users` · Reason: requires production log access agents do not have.

## Acceptance criteria

- [ ] Deleting an account removes its `auth.users` row and revokes every refresh token; a second device's session fails on next refresh.
- [ ] The deleting device ends signed out with local storage cleared, in an order that cannot strand a revocable session.
- [ ] `delete_user_account`'s self-only authorization check is unchanged in behavior.
- [ ] Production holds no `auth.users` row without a matching `public.users` row after cleanup.
- [ ] Tests cover cross-user refusal, post-deletion session invalidation, and local session removal.
