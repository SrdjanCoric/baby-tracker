# Task 0042: Confirm ambiguous morning sleep

**Branch**: `feature/confirm-ambiguous-morning-sleep`
**Depends on**: 0028
**Source**: morning-continuation diagnosis, online tracker research, and talk-it-through session 2026-07-28 · **User stories**: caregivers decide whether an ambiguous early sleep is the first nap or resumed night sleep; sleep tracking and other activities remain available while the answer is pending; confirmed Nap/Night types stay consistent across caregivers and prediction consumers; existing sleep history keeps its current behavior

## What to build

Replace unconditional classification for newly recorded ambiguous morning sleep with a caregiver confirmation. Keep the configured morning anchor at day start minus 3 hours 3 minutes. A completed overnight sleep that crosses the anchor establishes a provisional wake. If the next sleep starts before configured day start within the caregiver's sleep-continuation allowance, treat it as night continuation automatically. The allowance is inclusive, caregiver-configurable, and defaults to 25 minutes. Preserve every existing stored allowance, add 25 minutes to the available choices, and use the same setting for nap and morning continuation.

When the next pre-day-start sleep begins after that allowance, start or save the sleep normally, mark its morning role unresolved, and show a persistent inline question with only First nap and Back to sleep. Do not add a Decide later action or block feeding, diaper, sleep-timer, or other activity tracking. First nap keeps the preceding overnight end as morning wake and counts the new sleep as nap 1. Back to sleep makes the new sleep night continuation and uses its eventual end as morning wake. A First nap answer settles that morning. A Back to sleep answer permits the same check after a later pre-day-start sleep if another awake gap exceeds the allowance.

Withhold subsequent sleep predictions and exclude unresolved mornings from model training and drift detection until every pending morning confirmation has an answer. Keep unanswered confirmations through navigation, restart, and midnight, presenting multiple pending confirmations in chronological order if a caregiver leaves more than one unanswered. Show enough date and time context to identify the sleep. An answer or later correction must update the session's visible `nap`/`night` type, local storage, active-timer data when applicable, the durable sync queue, Supabase, Realtime consumers, timeline, statistics, historical grouping, drift detection, and predictions.

Add a nullable, versioned morning-classification state to sleep persistence and timer transport. Existing rows must remain distinguishable as legacy and retain the resolver behavior shipped by Task 0027 without retroactive prompts or data rewriting. New records must carry enough provenance for a new client to detect ambiguity even when an older app, Watch, widget, manual-entry path, or another caregiver created the sleep. Existing clients must continue to read and update sleep rows without clearing confirmed state. A caregiver edit to the Nap/Night type of an applicable legacy or confirmed morning sleep becomes authoritative and recomputes its consumers.

Do not infer an unresolved role from a fixed 60-minute threshold, expected wake window, awake-to-sleep duration ratio, or the portion of sleep after day start. Preserve automatic nap classification for sleeps starting at or after day start. When no completed overnight sleep establishes a real wake, preserve the legacy first-early-sleep continuation behavior, including the 05:53 overnight end and 07:05 to 10:30 continuation for a 09:00 day start. Do not change later wake windows, bedtime prediction, or persisted legacy history.

Keep Widget and Watch sleep starts functional. The phone owns the confirmation UI; Watch may show a short instruction to confirm in SofiBaby, but neither extension may refuse or delay tracking. Validate the schema migration only against local Supabase and do not apply it to a shared or production database in this task.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`

- [ ] Keep classification states, resolver outputs, storage inputs, timer payloads, and sync transforms strictly typed and consistently named; prove with warning-free lint and strict typecheck.
- [ ] Add deterministic tests at the resolver, storage, sync, migration, component, and extension-message seams; use real production utilities in the highest-level regressions and prove with focused suites plus the canonical code checks.
- [ ] Update the authoritative sleep-prediction documentation and README section with the confirmation state, continuation allowance, legacy behavior, prediction withholding, and correction rules.
- [ ] Preserve existing household access controls and sleep-session RLS while adding synchronized state; prove that the migration grants no broader read or update capability and passes the security suite.

## Implementation work

- [ ] Test-first, encode a table of morning sequences for a 09:00 day start, 05:57 anchor, and 25-minute allowance: the original no-qualifying-wake continuation; 15-minute and exact-25-minute automatic continuations; a gap just above 25 minutes; 07:00 wake followed by 08:30 to 09:35 sleep; short and long ambiguous sleeps; 08:59 versus 09:00 starts; active sleep; repeated Back to sleep; and First nap finality.
- [ ] Add boundary and failure cases for future and stale sessions, deleted source sleeps, deleted pending sleeps, edited types, multiple unanswered mornings, restart, midnight, offline creation, and out-of-order or remote updates.
- [ ] Normalize new sleep-continuation defaults to 25 minutes, expose 25 among the setting choices, preserve existing caregiver values, and apply the configured allowance inclusively to nap and morning continuation.
- [ ] Add backwards-compatible local, database, active-timer, queue, and Realtime representations for automatic, unresolved, confirmed-first-nap, and confirmed-night-continuation states while leaving legacy rows distinguishable and untouched.
- [ ] Extend the shared morning resolver so every consumer receives the same provisional wake, continuation, confirmation requirement, confirmed role, and unresolved state without mutating legacy records.
- [ ] Start or save ambiguous sleeps before presenting a localized, accessible inline confirmation on the running sleep and prediction surfaces. Keep other activity navigation available and show the oldest pending question first without a dismiss or Decide later action.
- [ ] Withhold sleep predictions and exclude unresolved mornings from model training and drift detection, then recompute immediately after confirmation, correction, deletion, or a qualifying remote update.
- [ ] Persist First nap as visible `nap` and Back to sleep as visible `night`; carry active answers into the completed session and make later Nap/Night edits authoritative where the morning sequence applies.
- [ ] Cover in-app timer, manual entry, widget deep link, Watch action, old-client-compatible insert, and another-caregiver sync paths without adding confirmation controls to Widget or Watch.
- [ ] Add storage and sync tests that assert immediate local updates, durable queued payloads, local-Supabase writes and reads, Realtime reducer updates, offline restart recovery, confirmed-state preservation under partial legacy updates, and consistent type changes on a second caregiver.
- [ ] Add component tests proving that tracking starts before the question appears, unrelated activities remain usable, unanswered state replaces predictions across midnight, each answer resolves the correct wake and nap count, repeated fragmentation follows the agreed rules, and edit correction updates the app.
- [ ] Add migration and security tests for defaults, legacy null state, allowed values, mixed-version partial updates, RLS preservation, and no historical backfill. Run migrations only on local Supabase.
- [ ] Add or update confirmation, continuation-setting, and Watch-instruction translations in all nine locale files.
- [ ] Update sleep-prediction documentation and the README, then run focused utility, storage, sync, component, migration, and security tests followed by the canonical warning-free code checks.

## Acceptance criteria

- [ ] A qualifying overnight wake followed by a pre-day-start sleep within the configured allowance resolves automatically as night continuation; exactly the configured number of minutes is included.
- [ ] A qualifying wake followed by a later pre-day-start sleep starts or saves normally and then shows the nonblocking First nap or Back to sleep question.
- [ ] First nap preserves the preceding morning wake, counts the sleep as nap 1, updates its visible and persisted type to `nap`, and prevents another question that morning.
- [ ] Back to sleep updates the visible and persisted type to `night`, uses that sleep's end as morning wake, and permits another question only after a later qualifying gap before day start.
- [ ] Unanswered confirmations survive navigation, offline restart, and midnight; they withhold sleep predictions and training data without blocking any activity tracking.
- [ ] Confirmation and correction update local state, durable queue data, Supabase, Realtime caregivers, timeline, statistics, historical grouping, drift detection, and predictions consistently.
- [ ] Timer, manual, Widget, Watch, old-client, and remote-caregiver recording paths can create a pending confirmation without losing or delaying the sleep record; confirmation remains phone-only.
- [ ] The confirmation question, both answers, continuation-setting copy, and related accessibility text are translated in every supported locale file.
- [ ] Existing sleep rows retain Task 0027 behavior with no backfill, rewrite, or retroactive prompt, and legacy clients cannot erase newer confirmation state through an unrelated partial update.
- [ ] The 05:53 overnight end followed by 07:05 to 10:30 sleep remains continuation for a 09:00 day start, while a sleep starting at or after 09:00 remains a nap.
- [ ] Automated tests cover every agreed sequence and boundary, database and in-app type updates, offline and cross-caregiver persistence, corrections, cleanup, and backwards compatibility.
- [ ] Later wake windows and bedtime prediction remain unchanged.
