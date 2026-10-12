# Task 0125: Keep a deleted account's entries when the household has other members

**Branch**: `feature/account-deletion-keeps-entries`
**Depends on**: 0124
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit, conversation 2026-10-08 (`docs/usage/accounts-and-guest.md`) · **User stories**: grandma deletes her account; the feeds and naps she logged for the baby stay in the family's timeline.

## What to build

| Situation when a user deletes their account | Result |
| --- | --- |
| Household has other members | Every entry the user logged stays (all activity types, health, milestones). The user's account, personal settings and push tokens are removed. |
| User is alone in the household | The household's babies and all their entries are deleted. |
| User is the owner and others remain | Account deleted; entries stay. Ownership handling is unchanged by this task. |
| Entry logged by the deleted user shown in the Timeline | Shows with the attribution chosen in the decision checkpoint below. |

## Decided

- Household has others → entries stay; solo → everything deleted. — Owner decision 2026-10-08.
- A test that exposes a real bug here means this task fixes the bug too. — Owner decision.

## Clarifications

## Non-goals

- Ownership passing to another member (low priority, separate).
- Deleting the sign-in record itself (postponed elsewhere).

## Context

Today `delete_user_account` hard-deletes the user's feeds, sleeps, diapers, pumping, growth and tummy entries even when others remain; health and milestones stay. The delete screen promises the opposite. Entries point to the user who logged them, so keeping them needs that link handled. No test covers the function.

## Implementation work

- [ ] Account deletion follows the table for every entry type — proven in a new `scripts/sql/account-deletion-tests.sql`, run by `npm run test:sql`
- [ ] The Timeline shows entries from a deleted account with the decided attribution — proven in `app/(tabs)/timeline.component.test.tsx`
- [ ] The delete screen text matches the behavior — proven in its component test

## Human checkpoints

- [ ] [decision] How does the Timeline credit an entry whose author deleted their account: their name kept, "Former member", or no "by" line? (`talk-it-through`)
- [ ] [confirm-db] New migration changing what `delete_user_account` deletes, before it is applied anywhere but local.

## Acceptance criteria

- [ ] `npm run test:sql:setup && npm run test:sql` passes and includes the new file.
- [ ] `npm run check:code` passes.
- [ ] `docs/usage/accounts-and-guest.md`: the entries-deleted `[Bug]` line is removed.
