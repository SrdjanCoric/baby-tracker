# Accounts and guest mode

## Signing up and in

- [ ] [Today] Sign in with email and password, magic link, Google or Apple. Email must be confirmed. — weak: src/contexts/auth-context.component.test.tsx
- [x] [Today] Onboarding has three routes: Start tracking, Join a family, Sign in. — test: app/onboarding/owner/index.component.test.tsx
- [ ] [Today] A baby profile is required before Home. Inviting a caregiver and logging a first activity are optional. — weak: src/services/onboarding-guard.test.ts
- [x] [Today] Onboarding progress survives an app restart. — test: src/services/new-owner-onboarding-storage.test.ts

## Guest mode ("Continue on this device")

- [x] [Today] Guest mode is fully usable for tracking. Data stays on the device. — test: src/services/activity-sync-lossless.test.ts
- [ ] [Today] Guest timers have no server lock. The widget still works. — weak: src/services/timer-access.test.ts
- [ ] [Today] Household features and import need an account. — weak: app/settings/import.component.test.tsx
- [ ] [Today] Guests get feeding reminders scheduled on the phone. Signed-in users get them from the server.
- [x] [Today] Guest to account: guest babies and entries upload automatically. — test: src/services/guest-account-migration.test.ts
- [ ] [Today] If the account already has babies that don't match the guest babies exactly (same name, birth date, gender and count), the user picks "use another account" or "discard guest data". — weak: src/services/guest-account-migration.test.ts

## Signing out

- [ ] [Decided] Sign-out keeps the local data on the phone. The confirm text "Your local data will be preserved" is correct.
- [ ] [Decided] After sign-out the user sees the sign-in screen. The data is hidden.
- [ ] [Decided] Signing in to the same account brings the data back at once.
- [ ] [Decided] Signing in to a different account ignores the hidden data. — weak: src/__tests__/security/auth-token.security.test.ts
- [ ] [Bug] Today sign-out wipes all local data unless a special flag is passed.

## Deleting an account

- [ ] [Decided] If the household has other members, the person's entries stay with the baby.
- [ ] [Decided] If the person is alone in the household, everything is deleted: babies and entries.
- [ ] [Bug] Today the person's feeds, sleeps, diapers, pumping, growth and tummy entries are deleted even when others remain. Health and milestones stay.
- [ ] [Decided] (Low priority) If the owner deletes their account and others remain, ownership passes to another member.
- [ ] [Bug] Today the household is left with no owner. Nobody can invite or remove caregivers again.
