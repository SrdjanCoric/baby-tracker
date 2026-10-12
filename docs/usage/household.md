# Household

## Shape

- [ ] [Today] Every account starts in its own solo household and owns it.
- [ ] [Today] A household has one owner. Everyone else is a member (caregiver). There are no other roles.
- [x] [Today] A household can hold several babies. — test: src/contexts/baby-context-household-refresh.component.test.tsx

## Who can do what

- [ ] [Decided] Every member is equal for tracking. Any member can add, edit or delete any entry and any baby, no matter who logged it. — weak: scripts/sql/merge-record-tests.sql
- [ ] [Today] Only the owner can invite, revoke invites and remove caregivers. — weak: scripts/sql/caregiver-invitation-tests.sql
- [ ] [Today] Non-owners can leave. Leaving or being removed puts them in a new, empty household they own.
- [ ] [Decided] (Low priority) If the owner leaves while others remain, ownership passes to another member.
- [ ] [Bug] Today the owner cannot leave, and the message points to an ownership transfer that doesn't exist.

## Invites

- [x] [Today] The owner enters the caregiver's email and shares a code (XXXX-XXXX) by copy or share sheet. The app sends no email. — test: app/settings/household.component.test.tsx
- [x] [Today] A code works once, lasts 7 days, and can be replaced or revoked. Several codes can be pending, one per email. — test: scripts/sql/caregiver-invitation-tests.sql
- [x] [Today] Redeeming a code needs the matching verified email. — test: scripts/sql/caregiver-invitation-tests.sql
- [x] [Today] Five failed attempts per hour lock redeeming. — test: scripts/sql/caregiver-invitation-tests.sql
- [x] [Today] Older household-wide codes keep working until a server switch turns them off. — test: scripts/sql/caregiver-invitation-tests.sql

## Joining a household

- [x] [Today] You can't join if your current household has other members. — test: scripts/sql/caregiver-invitation-tests.sql
- [ ] [Decided] Joining from a solo account deletes your old babies and all their entries for good. — weak: scripts/sql/caregiver-invitation-tests.sql
- [ ] [Decided] Every join path shows the honest warning: "Joining will permanently delete the baby and activity data in your current account." — weak: app/onboarding/owner/join.component.test.tsx
- [ ] [Bug] One older path says only "Your local baby data will be lost", which sounds like just the phone copy.

## Removed or leaving caregiver

- [ ] [Decided] Their phone drops the old household's babies and entries as soon as it is online. — weak: src/contexts/baby-context-household-refresh.component.test.tsx
- [ ] [Decided] A timer they started keeps running for the household. Others can still stop it.
- [ ] [Decided] That timer disappears from the removed person's phone, Watch, widget and Live Activity.

## What is shared and what is personal

- [ ] [Today] Shared with the household: babies, all entries, health, milestones, achievements, goals, wake-window and sleep settings per baby. — weak: scripts/sql/merge-record-tests.sql
- [ ] [Today] Per person: feeding reminder settings, notification settings, push tokens. — weak: scripts/sql/live-activity-push-token-tests.sql
- [ ] [Today] Per device: units, theme, language, time format, dashboard layout, quiet hours, selected baby. — weak: src/utils/dashboard-layout.test.ts
- [ ] [Today] Timeline shows "by {name}" only when the household has more than one member.
