/** @type {import('@bacons/apple-targets').Config} */
module.exports = {
  type: "watch",
  name: "SofiBabyWatch",
  displayName: "SofiBaby",
  deploymentTarget: "10.0",
  frameworks: ["SwiftUI", "WatchConnectivity", "WidgetKit"],
  images: {
    "complication-icon": "../../assets/app120.png",
  },
  colors: {
    $accent: "#8CB369",
    $watchBackground: { light: "#F5EDE8", dark: "#1E1B19" },
    feedingPrimary: "#8CB369",
    feedingBackground: { light: "#EEF4E9", dark: "#3D452F" },
    sleepPrimary: "#9E8DA9",
    sleepBackground: { light: "#F2EFF4", dark: "#3B3541" },
    diaperPrimary: "#E0A099",
    diaperBackground: { light: "#FBF0EE", dark: "#4A3836" },
    pumpingPrimary: "#7BA3A8",
    pumpingBackground: { light: "#EDF3F4", dark: "#2F3F41" },
    growthPrimary: "#6AAB9C",
    growthBackground: { light: "#EBF4F2", dark: "#2E3E3A" },
    tummyTimePrimary: "#D4A574",
    tummyTimeBackground: { light: "#F9F2EA", dark: "#4A3C2E" },
  },
  entitlements: {
    "com.apple.security.application-groups": ["group.com.sofibaby.app"],
  },
};
