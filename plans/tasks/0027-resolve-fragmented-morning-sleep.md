# Task 0027: Resolve fragmented morning sleep for predictions

**Branch**: `feature/resolve-fragmented-morning-sleep`
**Depends on**: none
**Source**: Production sleep diagnosis and talk-it-through session 2026-07-26 · **User stories**: caregivers with a late configured morning receive predictions after fragmented night sleep; a resumed morning sleep is not lost because it was stored as a nap; the prediction card requests night tracking only when the qualifying morning sleep is genuinely missing

## What to build

Introduce one deterministic morning-sleep resolver and use it wherever sleep predictions decide whether the current morning has a qualifying wake. Keep the existing early anchor at configured day start minus 3 hours 3 minutes. A completed overnight sleep ending at or after that anchor establishes the current wake. The first subsequent sleep whose start falls from the anchor up to, but not including, configured day start is night continuation regardless of its persisted `nap`/`night` type or duration; while active it remains the ordinary sleeping state, and when completed its end becomes the final morning wake. Only that first early-window sleep is continuation. A sleep starting at or after configured day start is a nap and cannot replace morning wake.

If neither a qualifying completed overnight sleep nor an early-window continuation exists, retain the request to track night sleep. Preserve persisted historical types and derive this effective prediction role without rewriting rows. Do not add preference-loading or sync-race behavior, and do not change later wake windows or bedtime prediction.

The resolver must be date-bounded: future sessions and same-evening night sessions cannot qualify as the current morning. The card must reevaluate date-dependent qualification at midnight and at the morning anchor. Historical day grouping must use the same morning semantics so a long daytime nap cannot replace the true wake or disappear from the nap list.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`

- [ ] Keep the resolver pure, strictly typed, and named consistently with existing sleep-domain utilities; prove with warning-free lint and typecheck.
- [ ] Add deterministic behavior tests at the real utility and component seams, including date transitions; do not mock away morning qualification in the regression that proves the card behavior.
- [ ] Update the authoritative sleep-prediction design documentation with the anchor, continuation, stored-type, and final-wake rules.

## Implementation work

- [ ] Test-first, encode the production regression: 09:00 day start, 05:57 anchor, overnight sleep ending 05:53, and a persisted `nap` from 07:05 to 10:30 must resolve to a 10:30 final wake and must not show the track-night-sleep prompt.
- [ ] Add boundary cases for a night ending after the anchor, no qualifying sleep after the anchor, an active continuation, only the first early-window continuation, a sleep starting exactly at day start, future timestamps, and same-evening sessions.
- [ ] Implement the shared morning-sleep resolver without mutating persisted sleep types.
- [ ] Replace the prediction card and nap-count/model morning anchors with the shared result so the same records cannot receive contradictory morning roles.
- [ ] Ensure a long sleep starting at or after day start remains a nap and cannot replace morning wake.
- [ ] Fix midnight and anchor transitions so date-dependent memoized state is recomputed without requiring a sleep mutation or navigation.
- [ ] Update sleep-prediction documentation and run focused utility/component tests, then canonical lint and typecheck.

## Acceptance criteria

- [ ] Sofija's reproduced 2026-07-25 sequence resolves 07:05–10:30 as prediction-only night continuation despite its stored `nap` type, with final wake at 10:30.
- [ ] The card asks to track night sleep only when the current morning has neither a qualifying completed overnight sleep nor an eligible first continuation.
- [ ] Persisted sleep rows and historical types are not rewritten.
- [ ] A sleep starting at or after configured day start is always a nap for morning resolution, regardless of duration.
- [ ] Future, same-evening, and stale prior-day sessions cannot qualify as the current morning.
- [ ] The card recomputes correctly across midnight and the 3h03 anchor.
- [ ] Later wake-window and bedtime behavior is unchanged.
