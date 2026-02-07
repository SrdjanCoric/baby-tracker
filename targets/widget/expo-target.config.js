/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "widget",
  name: "SofiBabyWidget",
  displayName: "SofiBaby",
  deploymentTarget: "18.0",
  frameworks: ["SwiftUI", "WidgetKit", "ActivityKit"],
  colors: {
    $accent: "#8CB369",
    $widgetBackground: { light: "#F5EDE8", dark: "#1E1B19" },
    $feedingPrimary: "#8CB369",
    $feedingBackground: { light: "#EEF4E9", dark: "#2A2730" },
    $sleepPrimary: "#9E8DA9",
    $sleepBackground: { light: "#F2EFF4", dark: "#2A2730" },
    $diaperPrimary: "#E0A099",
    $diaperBackground: { light: "#FBF0EE", dark: "#2A2730" },
    $pumpingPrimary: "#7BA3A8",
    $pumpingBackground: { light: "#EDF3F4", dark: "#2A2730" },
    $growthPrimary: "#6AAB9C",
    $growthBackground: { light: "#EBF4F2", dark: "#2A2730" },
    $tummyTimePrimary: "#D4A574",
    $tummyTimeBackground: { light: "#F9F2EA", dark: "#2A2730" },
  },
  entitlements: {
    "com.apple.security.application-groups": ["group.com.sofibaby.app"],
    "aps-environment": "production",
  },
};
