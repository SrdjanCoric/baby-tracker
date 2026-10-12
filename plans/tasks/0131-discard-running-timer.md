# Task 0131: Discard a running timer from its screen

**Branch**: `feature/discard-running-timer`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: user request and conversation 2026-10-12 · **Mock**: `docs/design/discard-timer.html` · **User stories**: a parent starts a sleep timer, the baby cries three minutes later, and the parent throws the timer away from the timer screen without saving an entry and without visiting the timeline.

## What to build

On the running-timer screen of sleep, feeding, pumping and tummy time, the person who started the timer sees one extra line, "✕ Discard timer", directly under the hint line, in the hint's grey colour and size. It is there in both the running and the paused state. Everyone else sees today's screen. Build it exactly as the "Decided" frames in `docs/design/discard-timer.html` show.

Tapping it opens the native alert. Title is per type: "Discard this sleep?", "Discard this feed?", "Discard this pumping session?", "Discard this tummy time?". Body: "{elapsed} will not be saved. The timer is cleared on every phone." where {elapsed} is the time the stop would record, formatted the way the timer screen formats it. Buttons: "Keep timing" (cancel, default) and "Discard" (destructive).

| Situation | Result |
| --- | --- |
| Starter taps Discard and confirms | Household lock released, local timer cleared, Live Activity ended, no entry written, sheet closes the same way Stop closes it. |
| Starter confirms while the timer is paused | Same. |
| Starter confirms under 60 seconds | Same. The alert is always shown. |
| Starter is offline | Local timer cleared and sheet closes now; the lock release is queued and retried the way a stop's release is. |
| Another household member opens the screen | No discard line. Pause, resume and stop unchanged. |
| Another member's phone sees the lock vanish | It clears its copy and ends its Live Activity, as it does after a remote stop. |
| Accountless or offline-owned timer (no lock) | Discard line shown to the local owner; clears locally, nothing to release. |

## Decided

- Only the starter may discard. Same ownership rule the start-time editor already uses. — Owner decision: discard loses data; stop does not.
- No Undo, no toast, no control on the Home card, widget or Watch. — Owner decision, 2026-10-12.
- Always confirm, even when a stop would already discard silently. — One rule, no surprise.
- Lock release reuses the durable release path a stop uses. — No new server call; the server already allows the starter to delete its own lock.

## Clarifications

## Non-goals

- Discard from the Home card, the widget, the Watch or the Lock Screen.
- Letting other household members discard.
- Changing the silent under-60-second rule on Stop.

## Context

Each context already has a "finish without writing" path used when a stop is under 60 seconds (tummy time lacks it and needs one). It releases the lock durably and ends the Live Activity. Remote vanish handling already clears other phones. The four screens each hold their own running-timer view with identical control rows. Live strings live in `src/i18n/locales/*.json` (nine locales). The mock's green bars and the "Today" column are explanation, not design.

## Implementation work

- [ ] The discard line appears on all four timer screens only for the starter, in running and paused states, matching the mock — proven in `app/sleep/index.component.test.tsx`, `app/feeding/index.component.test.tsx`, `app/pumping/index.component.test.tsx`, `app/tummyTime/index.component.test.tsx`
- [ ] Tapping it opens the alert with the per-type title, the elapsed-time body and the two buttons; "Keep timing" changes nothing — proven in the same four screen tests
- [ ] Confirming writes no entry, clears the local timer, ends the Live Activity and releases the lock durably, for each of the four types, including the paused and offline cases — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] Another household phone clears its timer after a discard — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [ ] All nine locales carry the new strings — proven in a new per-feature locale test under `src/i18n/`, like the existing ones there

## Acceptance criteria

- [ ] Every row of the decision table has a passing test.
- [ ] The rendered screens match the "Decided" frames of `docs/design/discard-timer.html` in text, order, colour and placement.
- [ ] `npm run check:code` passes.
