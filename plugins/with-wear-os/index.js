// Source of truth for the generated Android :wear module. Edit this plugin's
// android/wear template, never the android/wear output produced by Expo prebuild.
const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const WEAR_INCLUDE = "include ':wear'";
const WEARABLE_DEPENDENCY =
  'implementation "com.google.android.gms:play-services-wearable:19.0.0"';
const BRIDGE_REGISTRATION = "add(WearSessionBridgePackage())";
const REFRESH_SERVICE = `
        <service
            android:name=".WearSessionRefreshRequestService"
            android:exported="true">
            <intent-filter>
                <action android:name="com.google.android.gms.wearable.DATA_CHANGED" />
                <data android:scheme="wear" android:host="*" android:pathPrefix="/sofi/wear/auth/refresh-request" />
            </intent-filter>
        </service>`;

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

  const phoneSourceDirectory = path.join(
    projectRoot,
    "plugins",
    "with-wear-os",
    "android",
    "phone"
  );
  const phoneTargetDirectory = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "java",
    "com",
    "sofibaby",
    "app"
  );
  fs.mkdirSync(phoneTargetDirectory, { recursive: true });
  for (const filename of fs.readdirSync(phoneSourceDirectory)) {
    fs.copyFileSync(
      path.join(phoneSourceDirectory, filename),
      path.join(phoneTargetDirectory, filename)
    );
  }

  const mainApplicationPath = path.join(phoneTargetDirectory, "MainApplication.kt");
  if (fs.existsSync(mainApplicationPath)) {
    let mainApplication = fs.readFileSync(mainApplicationPath, "utf8");
    if (!mainApplication.includes(BRIDGE_REGISTRATION)) {
      mainApplication = mainApplication.replace(
        /PackageList\(this\)\.packages\.apply\s*\{/,
        `PackageList(this).packages.apply {\n              ${BRIDGE_REGISTRATION}`
      );
      fs.writeFileSync(mainApplicationPath, mainApplication);
    }
  }

  const appGradlePath = path.join(androidRoot, "app", "build.gradle");
  if (fs.existsSync(appGradlePath)) {
    let appGradle = fs.readFileSync(appGradlePath, "utf8");
    if (!appGradle.includes("com.google.android.gms:play-services-wearable")) {
      appGradle = appGradle.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${WEARABLE_DEPENDENCY}`
      );
      fs.writeFileSync(appGradlePath, appGradle);
    }
  }

  const appManifestPath = path.join(
    androidRoot,
    "app",
    "src",
    "main",
    "AndroidManifest.xml"
  );
  if (fs.existsSync(appManifestPath)) {
    let appManifest = fs.readFileSync(appManifestPath, "utf8");
    if (!appManifest.includes("WearSessionRefreshRequestService")) {
      appManifest = appManifest.replace("</application>", `${REFRESH_SERVICE}\n    </application>`);
      fs.writeFileSync(appManifestPath, appManifest);
    }
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
