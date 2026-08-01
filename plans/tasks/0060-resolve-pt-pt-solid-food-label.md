# Task 0060: Resolve the Portuguese (Portugal) solid-food label

**Branch**: `feature/resolve-pt-pt-solid-food-label`
**Depends on**: none
**Source**: Finding F-2, Task 0051 app regression audit (`docs/post-july-app-regression-audit.md`) · **User stories**: a caregiver using Português (Portugal) sees every solid-food option in their own language

## What to build

`pt-PT.json` has no `foods.cereal` key. It carries an orphan `foods.cereais` that nothing reads, so
`t("foods.cereal")` falls back to English and a Português (Portugal) caregiver sees "Cereal" sitting
among translated neighbours. The key is called from three feeding surfaces: the feeding index, the
solids picker, and manual entry. The other eight shipped locales all resolve it.

Rename the orphan key so the translation resolves. The Portuguese string itself is already correct;
only the key is wrong.

This is pre-existing, not a post-July regression — introduced by `6144e30` on 2026-05-16, before the
July 5 baseline. Task 0051 recorded it and handed only its regression, F-1, to Task 0053.

Second, decide whether an unresolved locale key should fail a check rather than silently falling back
to English. `scripts/audit/locale-key-parity.mjs` already exists and exits 1 when any locale is
missing a key that `t()` references, and 0 otherwise. It gates only on missing keys — the "extra" and
"identical-to-English" counts it also prints are informational and do not affect its exit code — so
after this fix it exits 0 and would pass as a gate today. Wiring it into `check:code` is therefore
a small change, but it is a standing policy choice about whether a missing translation blocks a
release, so make it deliberately rather than as a side effect of this fix.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Prove the fix through the key-resolution path a caregiver actually hits, not by eyeballing the JSON.
- [ ] Leave the other eight locales untouched; this task fixes one key.

## Implementation work

- [ ] Rename `foods.cereais` to `foods.cereal` in `src/i18n/locales/pt-PT.json`, keeping the existing Portuguese string.
- [ ] Confirm no code or test references `foods.cereais`, so the rename orphans nothing.
- [ ] Add a test that every key referenced through `t()` in the solid-food surfaces resolves in `pt-PT`, so the fallback cannot return unnoticed.
- [ ] Carry out the decision below: either wire `scripts/audit/locale-key-parity.mjs` into `check:code` or record why it stays a manual probe.
- [ ] Run `node scripts/audit/locale-key-parity.mjs`, `npm run test:unit` and `npm run test:component`.

## Human checkpoints

- [ ] [decision] Should a missing locale key fail `check:code`, or stay a probe the release owner runs by hand? The probe passes after this fix, so wiring it in costs nothing today; the trade is that a future untranslated key blocks a release instead of shipping as English (`talk-it-through`).

## Acceptance criteria

- [ ] `t("foods.cereal")` resolves in `pt-PT` on the feeding index, the solids picker, and manual entry.
- [ ] No key named `foods.cereais` remains, and nothing references it.
- [ ] `node scripts/audit/locale-key-parity.mjs` exits 0.
- [ ] A test fails if `pt-PT` loses a solid-food key again.
- [ ] The gating decision is recorded in this task, and implemented if it was to wire the probe in.
