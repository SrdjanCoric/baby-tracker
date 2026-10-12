# Task 0117: Delete the four screens nothing links to

**Branch**: `feature/delete-unreachable-screens`
**Depends on**: 0116
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: test audit and dead-code check, conversation 2026-10-08 · **User stories**: a parent can only reach screens that are maintained; old hidden screens with their own sign-out and delete buttons are gone.

## What to build

Remove the old Profile, Log and Sleep Patterns tab screens and the About settings screen, with their tests and anything only they use.

| Opening | Result after this task |
| --- | --- |
| Any in-app navigation | Unchanged; nothing links to these screens today. |
| `sofibaby://profile`, `sofibaby://log`, `sofibaby://sleep-patterns`, `sofibaby://settings/about` | The app's normal "not found" handling. |
| Statistics tab sleep views | Unchanged (they use the sleep-pattern components that stay). |

Also removed: their tab and stack entries, the "sleep-patterns" tab icon key, and PillTabs with its type and barrel export (used only by these screens).

## Decided

- These screens are dead code. — Owner decision 2026-10-08.
- Old deep links to them don't need to keep working. — Owner decision at plan approval.
- Re-check on the branch that nothing links to them before deleting. — Verified on `main` at planning time.

## Clarifications

## Non-goals

- The sleep-pattern components used by the Statistics tab.
- Any change to Settings or the tab bar the user sees.

## Context

The three tabs are hidden with `href: null`; About is registered but never linked. No widget, Watch, Live Activity, push or doc deep link points at them. The `test:sleep-summary` script runs the dead sleep-patterns screen test.

## Implementation work

- [ ] The four screens, their route entries, PillTabs and their tests are deleted — proven by `npm run typecheck` and `npm run lint`
- [ ] `test:sleep-summary` no longer points at a deleted test — proven by running `npm run test:sleep-summary`
- [ ] The tab bar and Settings look and work as before — proven in `app/(tabs)/index.component.test.tsx` and the settings index component test

## Acceptance criteria

- [ ] `npm run check:code` and `npm run test:sleep-summary` pass.
- [ ] `docs/usage/README.md`: the "Dead screens" out-of-scope line is removed.
