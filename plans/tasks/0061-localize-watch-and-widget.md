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

- [x] Keep the tracked native sources under `targets/` and `plugins/` authoritative; `ios/` is gitignored prebuild output.
- [x] Prove the strings resolve, rather than asserting that a resource file exists.
- [x] Translations must be complete for all nine locales before the task is done; an untranslated key that silently renders English is the defect being fixed.

## Implementation work

- [x] Add localization resources to the Watch target and the widget target, and replace every hardcoded user-facing literal with a localized lookup.
- [x] Translate every extracted string into the nine shipped locales, keeping region variants distinct.
- [x] Carry the caregiver's selected language across the App Group boundary so both targets render the language chosen in the app rather than the device locale, and define the behavior before the phone has written that value.
- [x] Update the language change path so switching language in the app is reflected on the Watch and in the widget without reinstalling.
- [x] Add a check that every string key referenced by the two targets resolves in all nine locales, in the spirit of `scripts/audit/locale-key-parity.mjs`, and verify it fails against a deliberately missing key.
- [x] Run `npm run lint`, `npm run typecheck`, `npm run test:unit` and `npm run test:component`.

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
its own guard. That guard is `npm run native:strings:check`, reached through `test:ci` inside
`npm run check:code`. It deliberately does not run in pull-request CI: `scripts/ci-workflow.test.mjs`
asserts that "pull requests and main run only fast non-test checks" and forbids `npm run test:` in
`.github/workflows/test.yml`, so wiring it there would violate an existing repository decision.

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

- [x] No user-facing English literal remains in the Watch or widget targets.
- [x] Every string in both targets resolves in all nine shipped locales, with region variants preserved.
- [x] Both surfaces render the language selected in the app, not the device locale.
- [x] Changing the language in the app updates both surfaces without a reinstall.
- [x] A check fails when a target string is missing from any locale.
- [ ] The release owner has confirmed the behavior on hardware for two languages.

## Implementation record

**What was built.** `localization/native/*.json` holds 124 keys in the nine shipped locales and is
the source of truth. `scripts/generate-native-strings.mjs` compiles them into a
`GeneratedStrings.swift` per target: an `L` accessor per key, a `NativeLanguageResolver` that reads
the caregiver's language from the App Group and otherwise maps the device locale with
`getDeviceLanguage()`'s rules, and CLDR plural selection. 174 hardcoded literals across
`targets/watch/index.swift`, `targets/widget/index.swift` and `targets/widget/LiveActivity.swift`
now resolve through `L`.

The phone publishes `resolvedLanguage` from `src/contexts/language-context.tsx` through
`src/services/native-language-service.ts`: the widget over the App Group followed by a widget
reload, the Watch over `WCSession` in `src/services/watch-service.ts`. That context replaces the
whole dictionary on every call, so a language change republishes the last context rather than a
bare one, which would have erased the widget data and Supabase credentials the Watch depends on.
`targets/watch/index.swift` persists a received language and publishes it so views re-render.

**Plural handling.** Seven count-bearing keys are CLDR plural objects. Serbian carries `one`/`few`/
`other` because it inflects 2-4 apart from 5+; European Portuguese gets its own rule, since CLDR
`pt_PT` treats only exactly one as singular while `pt` and French also treat zero as singular. This
also fixed "1 diapers today". Localizing the running-timer sentence fixed a pre-existing bug that
rendered "Sofi is feedinging" and "Sofi is tummy timeing".

**Checks.** `scripts/check-native-locale-parity.mjs` fails when a key a target references is missing
from a locale, when a required plural category is absent, or when a locale's `String(format:)`
specifiers stop matching English. `scripts/generate-native-strings.mjs --check` fails on generated
drift, and the generator refuses a key that is not a plain identifier, collides with a member of the
generated accessor, or is a Swift keyword. Both are covered by `scripts/native-locale-parity.test.mjs`
and `scripts/native-strings-generator.test.mjs`, wired into `test:ci`.

**Review.** One panel (Standards, Spec, Bug, Security) over `main...4b7f9e4`, then one remediation
batch. Fixed: stale-credential republish, format-specifier validation, generated-key injection and
control-character escaping, raw English tokens interpolated into localized sentences, Watch detail
views not re-rendering, language lost when set before the first sync, the pt-PT plural rule, a
`UserDefaults` suite allocated per lookup, a missing reserved member, a startup publish race, the
generator's argument parsing, a duplicated locale list, an untested failure path, and an English
`"Baby"` fallback. Rejected: wiring the gates into pull-request CI, which contradicts
`scripts/ci-workflow.test.mjs`.

**Accepted limitations.**

- System-rendered metadata stays English until the system localizes it: AppIntent titles and
  `@Parameter` labels, `AppEnum` display representations, the widget gallery
  `configurationDisplayName` and `description`, the complication description, and `Info.plist`
  display names. iOS resolves these outside the app process from the installed bundle, so they can
  follow the device language at best and can never follow an in-app selection. Owner-approved
  2026-08-01.
- A Live Activity already on the lock screen keeps its previous language until its next content
  update. Forcing an immediate refresh would add an ActivityKit write on the timer path, which
  Task 0057 is separately scheduled to rework. Owner-approved 2026-08-01.

**Documentation.** `README.md` gained `localization/native/` and the generated-Swift boundary in
Project Structure, plus `native:strings`, `native:strings:check` and `audit:native-locales` in the
Testing commands. Audited with `write-well`, two passes.

**Automated proof.** `npm run check:code` green: lint 0, typecheck 0, 2,472 unit tests, 783
component tests, 111 security tests, 65 script tests, production gating. `xcrun swiftc -typecheck`
clean for the Watch target (watchOS 10) and the widget target (iOS 18) against the real generated
tables. `node scripts/check-native-locale-parity.mjs` and `--check` both green at 124 keys × 9
locales.
