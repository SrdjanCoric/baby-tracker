# Live Activity lifetime bounds and remote control channels

## Planning decision informed

[Ending or updating a remotely changed Live Activity](../deferred/household-timer-control/016-remote-stop-live-activity-end.md).
When one caregiver stops or edits a timer another caregiver started, which actor ends or re-anchors
the starter's Live Activity, over what channel, and how bad the display gets while nothing has. This
research supplies platform facts only; it does not choose the answer.

## Answer

A server sending an APNs push to the owning device's **per-activity push token** is the only channel
Apple documents by which anything other than the owning app process can end or re-anchor a Live
Activity. No device-to-device path exists, the widget extension cannot reach an activity the app
started, and the iOS 18 broadcast channel is one-to-many by design and cannot target one user.

If nothing ends it, the damage is bounded but long. The activity stays active for up to **8 hours**,
during which our view keeps counting, then the system ends it and it lingers on the Lock Screen for
up to **4 hours more**, for a hard ceiling of **12 hours**. That ceiling coincides with the existing
`cleanup_stale_timer_locks` horizon.

Persisting the per-activity token server-side is not prohibited, but it is not free: the token
rotates during the activity's life and must be re-uploaded, and whether a stored token still works
after the owning app is force-quit or the device reboots is undocumented — which is precisely the
"phone stays closed for hours" case.

## Verified findings

### Lifetime bounds

- A Live Activity is active for at most 8 hours: "A Live Activity can be active for up to eight
  hours unless its app or a person ends it before this limit." After that "the system automatically
  ends the Live Activity, and immediately removes it from the Dynamic Island." —
  [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- After it ends it stays on the Lock Screen "for up to four additional hours before the system
  removes it — whichever comes first," so "a Live Activity remains on the Lock Screen for a maximum
  of 12 hours." —
  [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)
- `ActivityUIDismissalPolicy.after(_:)` cannot extend that: "the system removes a Live Activity that
  ended after the specified date or after four hours from the moment the Live Activity ended —
  whichever comes first." —
  [ActivityUIDismissalPolicy.after(\_:)](https://developer.apple.com/documentation/activitykit/activityuidismissalpolicy/after(_:))
- No entitlement, Info.plist key, or API extending the 8-hour window was found in ActivityKit
  release notes through 2025 or in WWDC sessions 2022 through 2026. `NSSupportsLiveActivitiesFrequentUpdates`
  raises the *update-frequency budget*, not the lifetime. —
  [ActivityKit release notes](https://developer.apple.com/documentation/updates/activitykit)
- `ActivityState` cases are `.active`, `.pending`, `.stale`, `.ended`, `.dismissed`. `.stale` is
  iOS 16.2+; the rest are 16.1+. —
  [ActivityState](https://developer.apple.com/documentation/activitykit/activitystate)

### Remote control channels

- The per-activity push token, from `Activity.pushTokenUpdates` with `pushType: .token`, is what an
  `update` or `end` push requires. The push-to-start token is a different token, per
  `ActivityAttributes` type rather than per activity instance, and drives only `event: "start"`. All
  three events share the topic `<bundle-id>.push-type.liveactivity`. —
  [Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- `event: "end"` carries a final `content-state` and an optional `dismissal-date`: a past date
  removes the activity from the Lock Screen immediately, an omitted one leaves the default 4-hour
  lingering. — same page
- No documented mechanism lets a different device or Apple ID end or update a Live Activity other
  than a server pushing to the owning device. — same page
- iOS 18 broadcast channels (`pushType: .channel(channelId)`, `input-push-channel`) are explicitly
  one-to-many: "anyone listening to the channel receives the same content." Apple frames them as the
  alternative to managing per-user tokens, not as a way to target one user. —
  [Broadcast updates to your Live Activities, WWDC24](https://developer.apple.com/videos/play/wwdc2024/10069/)
- A plain `AppIntent` from a widget button "runs in the same process as the widget extension," while
  `LiveActivityIntent`, `AudioPlaybackIntent`, `ForegroundContinuableIntent`, and
  `PushToTalkTransmissionIntent` are run by the system "in the app's process," launching that process
  "without opening the app." —
  [Adding interactivity to widgets and Live Activities](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities),
  [LiveActivityIntent](https://developer.apple.com/documentation/appintents/liveactivityintent)
- `AppIntent.perform()` carries roughly a 30-second background budget, extendable only through
  `LongRunningIntent`. —
  [LongRunningIntent](https://developer.apple.com/documentation/AppIntents/LongRunningIntent)

### Widget pushes

- `apns-push-type: widgets` does not run arbitrary code: "When WidgetKit receives a push
  notification, it reloads your timelines, similar to when you call `reloadAllTimelines()`." —
  [Updating widgets with WidgetKit push notifications](https://developer.apple.com/documentation/WidgetKit/Updating-widgets-with-widgetkit-push-notifications)
- `WidgetPushHandler` is iOS/iPadOS/macOS/watchOS/visionOS **26.0+**, a WWDC25 feature. —
  [WidgetPushHandler](https://developer.apple.com/documentation/widgetkit/widgetpushhandler)
- Widget pushes are budgeted and best-effort: "the system budgets WidgetKit push notifications and
  delivers them opportunistically." No numeric budget is published. — same page

### staleDate

- `staleDate` produces exactly one system-guaranteed effect: "When time reaches the configured stale
  date, the system considers the Live Activity out of date, and the `ActivityState` of the Live
  Activity changes to `ActivityState.stale`." —
  [ActivityContent.staleDate](https://developer.apple.com/documentation/activitykit/activitycontent/staledate)
- Responding to it is the app's job. Apple's language is uniformly developer-facing: "Access
  `isStale` to monitor the activity state and respond to outdated Live Activities"
  ([Displaying live data](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities)),
  "you can update the Live Activity to indicate that its content is out of date"
  ([ActivityState.stale](https://developer.apple.com/documentation/activitykit/activitystate/stale)),
  and "The system will use this date to decide when to render your stale view"
  ([WWDC23 session 10185](https://developer.apple.com/videos/play/wwdc2023/10185/)).
- `isStale` is a plain `Bool` on `ActivityViewContext`, not a SwiftUI environment value. —
  [ActivityViewContext.isStale](https://developer.apple.com/documentation/widgetkit/activityviewcontext/isstale)
- `stale-date` is settable at request time via `ActivityContent` and changeable by push through the
  `stale-date` key in `aps`, in Unix epoch seconds, and may be advanced with each update. —
  [Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)

### Push token lifecycle and budget

- The per-activity token can be reissued at any point, so the app must observe
  `Activity.pushTokenUpdates` for the activity's whole life, send each new token to the server, and
  invalidate the old one. —
  [Activity.pushTokenUpdates](https://developer.apple.com/documentation/activitykit/activity/pushtokenupdates-swift.property),
  [WWDC23 session 10185](https://developer.apple.com/videos/play/wwdc2023/10185/)
- Prune a stored token on APNs `410 Unregistered` or `400 BadDeviceToken`. `403 ExpiredProviderToken`
  refers to the provider's own JWT and must not prune the device token. —
  [Communicating with APNs](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html)
- "Once a Live Activity has ended, the system ignores any further push notifications sent to that
  activity," which is client-side discarding rather than an APNs error. —
  [Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications)
- ActivityKit pushes are budgeted per hour, but `apns-priority: 5` is documented as not counting
  toward the budget, and Apple recommends mixing priorities 5 and 10. — same page
- `NSSupportsLiveActivitiesFrequentUpdates` (iOS 16.2+) raises that allowance, and a person can turn
  frequent updates off in Settings, observable through
  `ActivityAuthorizationInfo.frequentPushesEnabled`. —
  [NSSupportsLiveActivitiesFrequentUpdates](https://developer.apple.com/documentation/bundleresources/information-property-list/nssupportsliveactivitiesfrequentupdates)

## Reasonable inferences

- **The widget extension cannot end an activity the app started.** Apple documents `Activity.activities`
  only as "an array of your app's current Live Activities" and never states its process scope, but a
  plain `AppIntent` is documented to run in the extension process, and developer reports on Apple's
  forums show `activities` coming back empty there, fixed only by moving the intent into the app
  target ([forum 735382](https://developer.apple.com/forums/thread/735382),
  [forum 734518](https://developer.apple.com/forums/thread/734518)). Both are non-staff posts, so
  this is a strong inference rather than a documented rule.
- **A view that never reads `isStale` shows no visual change when the stale date passes.** Every
  Apple description places the rendering duty on the app, and none describes system-drawn chrome, but
  no sentence states the negative outright.

## Applicability

- ActivityKit baseline is iOS 16.1; `ActivityContent`, `staleDate`, and `.stale` are 16.2+;
  push-to-start is 17.2+; broadcast channels and `input-push-token` are 18.0+; `WidgetPushHandler`
  is 26.0+.
- The 8-hour and 4-hour figures come from Apple's current live documentation, which is not
  version-annotated per fact. No source proves they were identical at the iOS 16.1 launch, only that
  they are current.
- Repository bearing: `targets/widget/LiveActivity.swift` renders elapsed time as
  `Text(effectiveTimerStart(...), style: .timer)`, a system-drawn self-updating timer, and does not
  read `ActivityViewContext.isStale`. `TimerActivityAttributes.ContentState` already carries
  `effectiveStartTimeISO`, which `toggle-timer-pause` already pushes. Every `ActivityContent` in
  `LiveActivityController.swift` is built with `staleDate: nil`.

## Unresolved uncertainty

- Whether a stored per-activity token still works after the owning app is force-quit or the device
  reboots while the activity is still on screen. Apple documents nothing either way. This is the
  decisive gap for a server-push design, because it is exactly the "phone stays closed" case.
- What the rendered content does when the **system** ends an activity at the 8-hour cap while the app
  is not running to supply final content, and specifically whether a `Text(..., style: .timer)` keeps
  counting after that. Not addressed in ActivityKit or SwiftUI documentation or in WWDC sessions
  10184, 10185, 10194, or 223.
- Whether `Text(timerInterval:)` freezes once an activity goes stale. Undocumented in both directions;
  do not assume either behavior without a device test.
- What APNs returns for a push to a structurally valid token whose activity already ended — Apple
  states only that the device ignores it, not whether the response is `200` or eventually `410`.
- Whether push-to-start pushes count against the same hourly budget as update and end pushes.
- Whether ActivityKit tokens require App Privacy nutrition-label disclosure. Apple's "Identifiers"
  category does not enumerate push tokens, which could mean either not-disclosable or merely
  not-listed.
- No Apple guidance and no App Review rule addresses one user's action triggering a Live Activity
  push to another user's device. Only the generic anti-spam rule 4.5.3, which does name Live
  Activities, and the push-notification rule 4.5.4 exist.
- No numeric widget-push budget is published; third-party figures are uncorroborated.

## Sources

- [Displaying live data with Live Activities](https://developer.apple.com/documentation/activitykit/displaying-live-data-with-live-activities) — Apple, current, owns the lifetime limits.
- [Starting and updating Live Activities with ActivityKit push notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications) — Apple, owns push payloads, tokens, and budget.
- [ActivityUIDismissalPolicy](https://developer.apple.com/documentation/activitykit/activityuidismissalpolicy) — Apple, owns dismissal timing.
- [ActivityContent.staleDate](https://developer.apple.com/documentation/activitykit/activitycontent/staledate) and [ActivityState.stale](https://developer.apple.com/documentation/activitykit/activitystate/stale) — Apple, own staleness semantics.
- [ActivityViewContext.isStale](https://developer.apple.com/documentation/widgetkit/activityviewcontext/isstale) — Apple, owns the view-side flag.
- [Adding interactivity to widgets and Live Activities](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities) and [LiveActivityIntent](https://developer.apple.com/documentation/appintents/liveactivityintent) — Apple, own intent process placement.
- [Updating widgets with WidgetKit push notifications](https://developer.apple.com/documentation/WidgetKit/Updating-widgets-with-widgetkit-push-notifications) and [WidgetPushHandler](https://developer.apple.com/documentation/widgetkit/widgetpushhandler) — Apple, own widget push capability and availability.
- [Activity.pushTokenUpdates](https://developer.apple.com/documentation/activitykit/activity/pushtokenupdates-swift.property) — Apple, owns token rotation.
- [Communicating with APNs](https://developer.apple.com/library/archive/documentation/NetworkingInternet/Conceptual/RemoteNotificationsPG/CommunicatingwithAPNs.html) — Apple archive, owns status codes; concepts still current.
- [Broadcast updates to your Live Activities, WWDC24 session 10069](https://developer.apple.com/videos/play/wwdc2024/10069/) — Apple, owns channel semantics.
- [Update Live Activities with push notifications, WWDC23 session 10185](https://developer.apple.com/videos/play/wwdc2023/10185/) — Apple, corroborates stale rendering and token rotation.
- [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/) — Apple, checked for cross-user push rules; none specific found.
- [Apple Developer Forums thread 735382](https://developer.apple.com/forums/thread/735382) and [thread 734518](https://developer.apple.com/forums/thread/734518) — non-staff reports, used only for the extension-process inference and labeled as such.
