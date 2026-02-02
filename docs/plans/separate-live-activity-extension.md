# Separate Live Activity Extension Plan

## Problem

Multiple Live Activities are created but only one displays on Lock Screen/Dynamic Island. This is likely caused by bundling Live Activities with other widgets in the same WidgetBundle.

## Solution

Create a dedicated widget extension target containing ONLY the Live Activity, separate from the home screen widgets.

## Implementation Steps

### Step 1: Create New Target Directory

Create `targets/live-activity/` with these files:

**`targets/live-activity/expo-target.config.js`:**
```javascript
/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "SofiBabyLiveActivity",
  displayName: "SofiBaby Timer",
  deploymentTarget: "17.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"],
  entitlements: {
    "com.apple.security.application-groups": ["group.com.sofibaby.app"],
  },
};
```

**`targets/live-activity/Info.plist`:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>NSExtension</key>
    <dict>
        <key>NSExtensionPointIdentifier</key>
        <string>com.apple.widgetkit-extension</string>
    </dict>
    <key>NSSupportsLiveActivities</key>
    <true/>
</dict>
</plist>
```

**`targets/live-activity/index.swift`:**
Copy the entire contents of `targets/widget/LiveActivity.swift` and add a WidgetBundle entry point:

```swift
import ActivityKit
import SwiftUI
import WidgetKit

// === Copy all code from LiveActivity.swift (TimerActivityAttributes, views, etc.) ===

// MARK: - Widget Bundle (Live Activity ONLY)
@main
struct SofiBabyLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        TimerLiveActivity()
    }
}
```

### Step 2: Update Existing Widget Bundle

Remove `TimerLiveActivity()` from `targets/widget/index.swift`:

```swift
// BEFORE (line 1336-1346):
@main
struct SofiBabyWidgetBundle: WidgetBundle {
    var body: some Widget {
        SmallBabyWidget()
        MediumBabyWidget()
        LargeBabyWidget()
        LockScreenCircularWidget()
        LockScreenRectangularWidget()
        TimerLiveActivity()  // <-- REMOVE THIS
    }
}

// AFTER:
@main
struct SofiBabyWidgetBundle: WidgetBundle {
    var body: some Widget {
        SmallBabyWidget()
        MediumBabyWidget()
        LargeBabyWidget()
        LockScreenCircularWidget()
        LockScreenRectangularWidget()
    }
}
```

### Step 3: Delete LiveActivity.swift from Widget Target

Remove `targets/widget/LiveActivity.swift` since it's now in the live-activity target.

### Step 4: Update Plugin to Copy TimerActivityAttributes

The `plugins/with-live-activity-controller/` plugin copies `TimerActivityAttributes.swift` to the main app. It may also need to copy it to the new live-activity target, OR the new target can define its own copy (they just need to match).

Check `plugins/with-live-activity-controller/index.js` to see if it needs updates.

## Files to Create

| File | Content |
|------|---------|
| `targets/live-activity/expo-target.config.js` | Widget target config |
| `targets/live-activity/Info.plist` | Extension plist with Live Activity support |
| `targets/live-activity/index.swift` | Live Activity code + bundle entry point |

## Files to Modify

| File | Change |
|------|--------|
| `targets/widget/index.swift` | Remove `TimerLiveActivity()` from bundle |

## Files to Delete

| File | Reason |
|------|--------|
| `targets/widget/LiveActivity.swift` | Moved to new target |

## Rebuild Command

```bash
npx expo prebuild --platform ios --clean && npx expo run:ios
```

## Testing

1. Start feeding timer → verify Live Activity appears
2. Start sleep timer → verify SECOND Live Activity appears on Lock Screen
3. Start pumping timer → verify THIRD Live Activity appears
4. Verify Dynamic Island shows activities (may show 2 max, with minimal view for others)
5. Verify home screen widgets still work

## Rollback

If this doesn't work, simply:
1. Delete `targets/live-activity/`
2. Restore `TimerLiveActivity()` to `targets/widget/index.swift`
3. Restore `targets/widget/LiveActivity.swift`
4. Rebuild

## Sources

- [@bacons/apple-targets documentation](https://github.com/EvanBacon/expo-apple-targets)
- [Apple Developer Forums - Widget bundle issues](https://developer.apple.com/forums/thread/708487)
