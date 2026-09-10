const { getSentryExpoConfig } = require("@sentry/react-native/metro");
const { withNativeWind } = require("nativewind/metro");

// Sentry's config extends Expo's default config with source-map annotations
// used for symbolicated JS stack traces; runtime bundling is unchanged.
const config = getSentryExpoConfig(__dirname);

// Exclude test files from bundling
config.resolver.blockList = [
  /.*\.test\.tsx?$/,
  /.*\.spec\.tsx?$/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
