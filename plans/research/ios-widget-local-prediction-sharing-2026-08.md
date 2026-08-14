# iOS widget local prediction sharing

## Planning decision informed

Whether the sleep prediction can stay device-local while remaining available to the iOS widget
when the containing app is not running, without adding Supabase writes or broader database rights.

## Answer

Yes. The app and widget extension can share a prediction snapshot through their existing App Group.
The app can prepare the prediction and store it in shared `UserDefaults` or a shared file; the widget
can read it while the app process is not running. WidgetKit controls when timeline providers run, so
background refresh timing is opportunistic rather than guaranteed. Interactive widget App Intents
can also update App Group state without launching the app, although this repository's currently
rendered widget start/stop controls use deep links and therefore open the containing app.

## Verified findings

- App Groups provide a shared container accessible to an app and its extensions. — [Configuring App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups)
- Both processes can use an App Group `UserDefaults` suite or shared container files. — [UserDefaults suite](https://developer.apple.com/documentation/foundation/userdefaults/init(suitename:)), [FileManager shared container](https://developer.apple.com/documentation/foundation/filemanager/containerurl(forsecurityapplicationgroupidentifier:))
- Apple recommends that the containing app prepare widget data in advance for the timeline provider. — [TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider)
- WidgetKit controls reload opportunities and may coalesce requested timeline dates; refresh timing is not exact or guaranteed. — [Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date)
- Widget buttons and toggles can invoke App Intents in the widget extension without launching the app; links and widget URLs open the containing app. — [Adding interactivity](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities), [Linking to app scenes](https://developer.apple.com/documentation/widgetkit/linking-to-specific-app-scenes-from-your-widget-or-live-activity)

## Reasonable inferences

- Removing and re-adding the widget does not erase the App Group snapshot; the replacement widget can
  read it when WidgetKit next asks for a snapshot or timeline.
- A stored absolute prediction timestamp does not need minute-by-minute recalculation when no source
  sleep data changes. Timeline entries can update surrounding relative UI while retaining the same
  predicted time.
- A local-only widget cannot learn about sleep records created on another device until this device's
  app synchronizes them. This is the deliberate trade-off for avoiding server-backed prediction data.

## Applicability

This repository already uses App Group `group.com.sofibaby.app`, writes `widgetData` through
`ExtensionStorage`, and reads it in Swift through `UserDefaults(suiteName:)`. Its visible widget
start/stop/pause controls currently use `Link`, deep links, and `.widgetURL`, so those interactions
open the app even though unused background-capable App Intent implementations also exist.

## Unresolved uncertainty

Apple does not provide an exact refresh guarantee for rarely viewed widgets or after a user
force-quits the containing app. Cross-device freshness is unavailable by design in a purely local
prediction path.

## Sources

- [Configuring App Groups](https://developer.apple.com/documentation/xcode/configuring-app-groups) — Apple platform capability documentation.
- [UserDefaults suite](https://developer.apple.com/documentation/foundation/userdefaults/init(suitename:)) — Apple Foundation API documentation.
- [FileManager shared container](https://developer.apple.com/documentation/foundation/filemanager/containerurl(forsecurityapplicationgroupidentifier:)) — Apple Foundation API documentation.
- [TimelineProvider](https://developer.apple.com/documentation/widgetkit/timelineprovider) — Apple WidgetKit API documentation.
- [Keeping a widget up to date](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date) — Apple WidgetKit lifecycle guidance.
- [Adding interactivity](https://developer.apple.com/documentation/widgetkit/adding-interactivity-to-widgets-and-live-activities) — Apple WidgetKit and App Intents guidance.
- [Linking to app scenes](https://developer.apple.com/documentation/widgetkit/linking-to-specific-app-scenes-from-your-widget-or-live-activity) — Apple widget navigation guidance.
