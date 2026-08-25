# Task 0098: Wear hardware verification and store listing floor

**Branch**: `feature/wear-hardware-verification-and-listing`
**Depends on**: 0093, 0094, 0095, 0096, 0097
**Source**: plans/wear-os-watch-parity.md (planning brief, 2026-08-20) · **User stories**: As a Samsung watch owner, the app I install from the Play Store works on my actual watch and the listing told me what I need.

## What to build

The release gate: a full manual pass on a physical Galaxy Watch (4 or newer) paired to a real
Android phone, plus Play Store listing updates stating the Wear OS 4+ device floor and the
phone-app requirement (expectation-setting decided in the brief: Samsung users see the listed
feature set, Tizen watches are unsupported). Any code changes here are limited to fixes for defects
the hardware pass surfaces; substantive new behavior goes back into a new task.

## Implementation work

- [ ] Play listing copy: Wear OS 4+ (Galaxy Watch 4 and newer) floor, Android phone app required
      for sign-in, watch feature list.
- [ ] Play console device targeting/distribution set so the Wear APK reaches only Wear OS 4+.
- [ ] Fix defects surfaced by the hardware pass (scoped to this task; larger findings become new
      tasks).

## Human checkpoints

- [ ] [verify] On a physical Galaxy Watch 4+ paired with a real Android phone: (1) install both
      apps, sign in on phone, confirm watch signs in; (2) log each of the five activity types from
      the watch and confirm each on the phone; (3) run a feed timer started on the phone, confirm
      on watch, stop on watch; (4) turn the phone off, put the watch on known WiFi, log a diaper —
      confirm it syncs; (5) enable airplane mode on both, attempt a log — confirm visible error and
      successful retry after reconnect; (6) sign out on phone, confirm watch clears. · Expected:
      every step behaves as described. · Failure: any silent error, missing entry, stale session,
      or pairing failure. · Reason: Samsung pairing, Bluetooth network proxying, and real Data
      Layer delivery cannot be reproduced on emulators.

## Acceptance criteria

- [ ] Full hardware checklist confirmed passed by the user.
- [ ] Store listing states device floor and phone requirement; distribution targeting matches.
- [ ] Any hardware-pass defects fixed or captured as new tasks.
