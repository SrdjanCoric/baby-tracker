# Task 0098: Wear hardware verification and store listing floor

**Branch**: `feature/wear-hardware-verification-and-listing`
**Depends on**: 0093, 0094, 0095, 0096, 0097
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a Samsung watch owner, the app I install from the Play Store works on my actual watch and the listing told me what I need.

## What to build

The release gate and the only manual phone↔watch synchronization checkpoint in the Wear task chain:
run one consolidated pass after Tasks 0090–0097 are complete, first on a paired Wear OS 4 emulator
and Android phone emulator, then on a physical Galaxy Watch 4+ paired to a real Android phone before
store submission. Also update the Play Store listing with the Wear OS 4+ device floor and phone-app
requirement (expectation-setting decided in the brief: Samsung users see the listed feature set,
Tizen watches are unsupported). Any code changes here are limited to fixes for defects the final
pass surfaces; substantive new behavior goes into a new task.

**Apple Watch parity boundary**: the listing and hardware checklist claim only today-summary and
baby selection, the five Apple Watch activity flows, shared timer visibility, phone-mediated sign-in
and refresh, sign-out invalidation, and the launcher complication. Do not advertise phone-free
authentication, offline logging, an offline queue, history/editing, Tiles, or richer complications.

## Implementation work

- [ ] Play listing copy: Wear OS 4+ (Galaxy Watch 4 and newer) floor, Android phone app required
      for sign-in and credential refresh, and only the Apple-parity watch feature list.
- [ ] Play console device targeting/distribution set so the Wear APK reaches only Wear OS 4+.
- [ ] Fix defects surfaced by the hardware pass (scoped to this task; larger findings become new
      tasks).

## Human checkpoints

- [ ] [verify] On paired Wear OS 4 and Android phone emulators: (1) install current phone and watch
      builds signed with the same certificate; (2) sign in on the phone and confirm the watch names
      the selected baby and renders the today summary; (3) log diaper, feeding, sleep, pumping, and
      tummy time from the watch and confirm each on the phone; (4) start feed and sleep timers on
      the phone, confirm them on the watch, then stop them from the watch; (5) restart the watch app
      during a running timer and confirm restoration; (6) force a stale access token, confirm
      reconnect-from-phone and recovery after republish; (7) sign out or switch accounts on the
      phone and confirm the watch clears the old identity; (8) add the launcher complication and
      confirm it opens the app. · Expected: every synchronization path works without duplicates,
      stale identity, or silent failure. · Failure: any missing or duplicate activity, incorrect
      timer, stale session, failed refresh recovery, or Data Layer delivery failure.
- [ ] [verify] Before store submission, repeat the consolidated matrix on a physical Galaxy Watch
      4+ paired with a real Android phone. · Expected: behavior matches the emulator pass. ·
      Failure: Samsung pairing, Bluetooth network proxying, store delivery, or hardware-specific
      behavior differs from the tested emulator result.

## Acceptance criteria

- [ ] Consolidated emulator integration matrix passed after all Wear feature tasks are complete.
- [ ] Full physical-hardware checklist confirmed passed before store submission.
- [ ] Store listing states device floor and phone requirement; distribution targeting matches.
- [ ] Listing and verification make no claim for functionality absent from Apple Watch.
- [ ] Any hardware-pass defects fixed or captured as new tasks.
