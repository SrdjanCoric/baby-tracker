const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Exclude test files from bundling
config.resolver.blockList = [
  /.*\.test\.tsx?$/,
  /.*\.spec\.tsx?$/,
];

module.exports = withNativeWind(config, { input: "./global.css" });
