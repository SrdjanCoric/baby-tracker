// Source of truth for the generated Android :wear module. Edit this plugin's
// android/wear template, never the android/wear output produced by Expo prebuild.
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WEAR_INCLUDE = "include ':wear'";

function syncWearOsModule({ projectRoot, androidRoot }) {
  const sourceDirectory = path.join(
    projectRoot,
    "plugins",
    "with-wear-os",
    "android",
    "wear"
  );
  const targetDirectory = path.join(androidRoot, "wear");
  const settingsPath = path.join(androidRoot, "settings.gradle");

  fs.cpSync(sourceDirectory, targetDirectory, {
    recursive: true,
    force: true,
  });

  const settings = fs.readFileSync(settingsPath, "utf8");
  if (!settings.includes(WEAR_INCLUDE)) {
    fs.writeFileSync(settingsPath, `${settings.trimEnd()}\n${WEAR_INCLUDE}\n`);
  }
}

function withWearOs(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      syncWearOsModule({
        projectRoot: config.modRequest.projectRoot,
        androidRoot: config.modRequest.platformProjectRoot,
      });
      console.log("[WearOS] Restored :wear module");
      return config;
    },
  ]);
}

module.exports = withWearOs;
module.exports.syncWearOsModule = syncWearOsModule;
