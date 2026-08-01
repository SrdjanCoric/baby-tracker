# Task 0061: Localize the Apple Watch app and the iOS widget

**Branch**: `feature/localize-watch-and-widget`
**Depends on**: none
**Source**: Gap found while reviewing localization coverage, 2026-08-01 · **User stories**: a caregiver who runs SofiBaby in their own language sees that language on the Watch and in the widget, not English

## What to build

The phone app ships nine locales, but the Watch app and the iOS widget are English-only. Neither
Swift target contains a single `NSLocalizedString`, `String(localized:)` or `LocalizedStringKey`
call, and there is no `.lproj` directory or string catalog anywhere under `targets/`. Every
user-facing string is a hardcoded English literal — the Watch has roughly 34 `Text(...)` literals
plus about 11 more in buttons, labels and navigation titles; the widget has 13. So a caregiver whose
phone app is in Portuguese or German still gets "Start", "Pause", "Resume", "Save", "Active" and
"Confirm in SofiBaby" on the wrist and on the home screen.

Give both targets real localization and translate their strings into the same nine locales the phone
ships: `en`, `es`, `es-ES`, `fr`, `de`, `it`, `pt-BR`, `pt-PT`, `sr`.

The language is **not** the device locale. `src/i18n/index.ts` only seeds the initial language from
the device, and `src/contexts/language-context.tsx` lets the caregiver change it in the app, so a
target that reads the system locale will show the wrong language for anyone who overrode it. The
Watch and widget must resolve the language the caregiver actually chose. The phone already shares
state with both surfaces through the `group.com.sofibaby.app` App Group, which is the natural place
to carry the selected language, but the exact mechanism is an implementation decision — including
what each surface does before the phone has ever written that value.

Two details worth settling explicitly while translating:

- Portuguese ships as both `pt-PT` and `pt-BR`, and Spanish as both `es` and `es-ES`, so the
  resolution must preserve the region, not collapse to a base language code.
- The phone's i18n initialization uses a bare language code, so confirm what a `pt-PT` caregiver's
  stored value actually looks like before matching on it.

Excluded: adding new locales beyond the nine the phone ships, and any change to the phone's own
translations.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Keep the tracked native sources under `targets/` and `plugins/` authoritative; `ios/` is gitignored prebuild output.
- [ ] Prove the strings resolve, rather than asserting that a resource file exists.
- [ ] Translations must be complete for all nine locales before the task is done; an untranslated key that silently renders English is the defect being fixed.

## Implementation work

- [ ] Add localization resources to the Watch target and the widget target, and replace every hardcoded user-facing literal with a localized lookup.
- [ ] Translate every extracted string into the nine shipped locales, keeping region variants distinct.
- [ ] Carry the caregiver's selected language across the App Group boundary so both targets render the language chosen in the app rather than the device locale, and define the behavior before the phone has written that value.
- [ ] Update the language change path so switching language in the app is reflected on the Watch and in the widget without reinstalling.
- [ ] Add a check that every string key referenced by the two targets resolves in all nine locales, in the spirit of `scripts/audit/locale-key-parity.mjs`, and verify it fails against a deliberately missing key.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npm run test:component`.

## Decisions

**Language transport (resolved 2026-08-01, `talk-it-through`).** The phone publishes
`resolvedLanguage` from `src/contexts/language-context.tsx`, never the raw stored preference. The
stored value under `@language_preference` is frequently the literal `"system"` — that is the default
when nothing was ever set (`src/services/language-storage.ts:19`) — so matching on the stored value
would ship `"system"` to both targets. `resolvedLanguage` always yields one of the nine
region-preserving codes.

The App Group only reaches the widget. The Watch is separate hardware, so `group.com.sofibaby.app`
cannot carry anything to it; the Watch is reached by `WCSession.updateApplicationContext` and
persists what it receives into its own container, exactly as it already does for Supabase
credentials (`targets/watch/index.swift:169`, parsed at `:513`). The language rides that existing
payload. Both surfaces are refreshed whenever the caregiver changes language, so neither needs a
reinstall.

**String storage (resolved 2026-08-01, `talk-it-through`).** Nine JSON locale files under
`localization/native/` are the source of truth, code-generated into a `GeneratedStrings.swift` per
target. `targets/watch` and `targets/widget` are built by `@bacons/apple-targets` as
`PBXFileSystemSynchronizedRootGroup` folders and no plugin sets Xcode `knownRegions`, so `.lproj`
and `.xcstrings` resources can fail to reach the built bundle while the build still succeeds —
shipping English that looks correct. Apple's machinery would not have satisfied the requirement
anyway: rendering a language other than the device's requires an explicit per-language `Bundle`
load regardless. Rejected: `.xcstrings` and hand-written `.lproj`. Consequence: the targets'
`Info.plist` display names stay unlocalized, and the generated Swift is checked in, so drift needs
a CI guard.

**First launch (resolved 2026-08-01, `talk-it-through`).** Before the phone has ever sent a
language, both surfaces resolve the device locale through a Swift port of `getDeviceLanguage()`'s
exact mapping — `pt`→`pt-PT`, `pt`+BR→`pt-BR`, `es`+ES→`es-ES`, anything unrecognized→`en`. This is
what the phone itself renders when no preference was stored, so the surfaces agree by default
rather than diverging. The phone's payload overrides it on arrival. Rejected: English-until-sync
(reproduces the reported defect at first launch) and a blocked placeholder (unusable Watch, and the
placeholder itself needs a language).

## Human checkpoints

- [x] [decision] Decide how the selected language reaches the two targets and what each renders before the phone has ever written it — device locale, English, or a blocked state (`talk-it-through`).
- [ ] [verify] Confirm on hardware that both surfaces follow the app's language · Steps: set the app language to Português (Portugal), then check the Watch timer screens and the home-screen widget; change the language to Deutsch and check both again without reinstalling · Expected: both surfaces render the selected language and update after the change · Failure: either surface stays English, shows a different language than the app, or needs a reinstall to update · Reason: Watch and widget rendering cannot be proved in JavaScript tests, and the language handoff crosses a process boundary that a simulator does not exercise the same way.

## Acceptance criteria

- [ ] No user-facing English literal remains in the Watch or widget targets.
- [ ] Every string in both targets resolves in all nine shipped locales, with region variants preserved.
- [ ] Both surfaces render the language selected in the app, not the device locale.
- [ ] Changing the language in the app updates both surfaces without a reinstall.
- [ ] A check fails when a target string is missing from any locale.
- [ ] The release owner has confirmed the behavior on hardware for two languages.
