# Notifications

Rule for all of them: **my settings control my phone.**

## Household activity push

- [ ] [Today] When a member logs feeding, sleep, diaper, pumping, growth or tummy time, other members who turned it on get "{name} logged a {activity}". — weak: src/__tests__/activity-notification-push.test.ts
- [x] [Today] Health entries, deletions, and entries more than 1 hour old don't notify. — test: src/__tests__/activity-notification-push.test.ts

## Reminders

- [ ] [Today] Feeding reminders: per person, per baby, on an interval, sent by the server.
- [ ] [Decided] Wake-window and bedtime reminders go only to people who turned them on.
- [ ] [Bug] Today they go to every member with a push token once anyone turns them on.

## Personal settings

- [ ] [Decided] Quiet hours apply to every push the person gets, local or from the server. — weak: src/utils/notification-scheduler.test.ts
- [ ] [Decided] The privacy toggles (show baby name, show details) apply to every push. — weak: src/utils/notification-sanitizer.test.ts
- [ ] [Bug] Today quiet hours and privacy toggles only affect local alerts.
- [ ] [Decided] Pushes arrive in the recipient's app language.
- [ ] [Bug] Today server push text is English only.
- [ ] [Bug] Today timer alerts ignore the privacy toggles. (Found by reading code.)

## Local alerts

- [ ] [Today] Timer alerts after set thresholds, and in-app reminders, run on the device. — weak: src/utils/notification-scheduler.test.ts
- [ ] [Bug] Today nothing triggers in-app reminders. The check exists but is never called. (Found by reading code.)
