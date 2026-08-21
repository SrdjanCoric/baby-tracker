import assert from "node:assert/strict";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(import.meta.url);
const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const appConfig = JSON.parse(
  readFileSync(new URL("../app.json", import.meta.url), "utf8")
);

test("the Wear OS plugin restores the module and settings wiring idempotently", () => {
  assert.ok(appConfig.expo.plugins.includes("./plugins/with-wear-os"));

  const projectRoot = mkdtempSync(join(tmpdir(), "sofi-wear-plugin-"));
  const androidRoot = join(projectRoot, "android");
  mkdirSync(androidRoot);
  writeFileSync(join(androidRoot, "settings.gradle"), "include ':app'\n");
  const appRoot = join(androidRoot, "app");
  const javaRoot = join(appRoot, "src", "main", "java", "com", "sofibaby", "app");
  mkdirSync(javaRoot, { recursive: true });
  writeFileSync(
    join(javaRoot, "MainApplication.kt"),
    "PackageList(this).packages.apply {\n  add(LiveActivityControllerPackage())\n}\n"
  );
  writeFileSync(join(appRoot, "build.gradle"), "dependencies {\n}\n");
  writeFileSync(
    join(appRoot, "src", "main", "AndroidManifest.xml"),
    '<manifest xmlns:android="http://schemas.android.com/apk/res/android"><application></application></manifest>\n'
  );

  try {
    const { syncWearOsModule } = require("../plugins/with-wear-os");

    syncWearOsModule({ projectRoot: repositoryRoot, androidRoot });
    syncWearOsModule({ projectRoot: repositoryRoot, androidRoot });

    const settings = readFileSync(join(androidRoot, "settings.gradle"), "utf8");
    assert.equal(settings.match(/include ':wear'/g)?.length, 1);
    const mainApplication = readFileSync(
      join(javaRoot, "MainApplication.kt"),
      "utf8"
    );
    assert.equal(
      mainApplication.match(/add\(WearSessionBridgePackage\(\)\)/g)?.length,
      1
    );
    assert.equal(
      readFileSync(join(appRoot, "build.gradle"), "utf8").match(
        /com\.google\.android\.gms:play-services-wearable/g
      )?.length,
      1
    );
    assert.equal(
      readFileSync(
        join(appRoot, "src", "main", "AndroidManifest.xml"),
        "utf8"
      ).match(/WearSessionRefreshRequestService/g)?.length,
      1
    );
    assert.equal(
      readFileSync(join(javaRoot, "WearSessionBridgeModule.kt"), "utf8").includes(
        "/sofi/wear/auth/state"
      ),
      true
    );
    assert.equal(appConfig.expo.android.package, "com.sofibaby.app");
    const buildGradle = readFileSync(
      join(androidRoot, "wear", "build.gradle"),
      "utf8"
    );
    assert.match(buildGradle, /applicationId ['"]com\.sofibaby\.app['"]/);
    assert.match(buildGradle, /evaluationDependsOn\(['"]:app['"]\)/);
    assert.match(
      buildGradle,
      /signingConfig phoneAndroid\.buildTypes\.debug\.signingConfig/
    );
    assert.match(
      buildGradle,
      /signingConfig phoneAndroid\.buildTypes\.release\.signingConfig/
    );
    assert.match(
      buildGradle,
      /versionCode wearVersionCodeOffset \+ phoneDefaultConfig\.versionCode/
    );
    assert.match(
      buildGradle,
      /versionName phoneDefaultConfig\.versionName/
    );
    assert.doesNotMatch(buildGradle, /^\s*versionCode\s+1\s*$/m);
    assert.doesNotMatch(buildGradle, /^\s*versionName\s+['"]1\.0['"]\s*$/m);
    assert.equal(
      readFileSync(
        join(androidRoot, "wear", "src", "main", "AndroidManifest.xml"),
        "utf8"
      ).includes("android.hardware.type.watch"),
      true
    );
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("the generated Wear module declares its launcher and phone sign-in state", () => {
  const outputRoot = mkdtempSync(join(tmpdir(), "sofi-wear-output-"));
  const androidRoot = join(outputRoot, "android");
  mkdirSync(androidRoot);
  writeFileSync(join(androidRoot, "settings.gradle"), "include ':app'\n");

  try {
    const { syncWearOsModule } = require("../plugins/with-wear-os");
    syncWearOsModule({ projectRoot: repositoryRoot, androidRoot });

    const moduleRoot = join(androidRoot, "wear");
    const manifest = readFileSync(
      join(moduleRoot, "src", "main", "AndroidManifest.xml"),
      "utf8"
    );
    const activity = readFileSync(
      join(
        moduleRoot,
        "src",
        "main",
        "java",
        "com",
        "sofibaby",
        "app",
        "wear",
        "MainActivity.kt"
      ),
      "utf8"
    );
    const state = readFileSync(
      join(
        moduleRoot,
        "src",
        "main",
        "java",
        "com",
        "sofibaby",
        "app",
        "wear",
        "SignedOutState.kt"
      ),
      "utf8"
    );

    assert.match(manifest, /android:value="false"/);
    assert.match(manifest, /android:name="\.MainActivity"/);
    assert.match(manifest, /android:name="android\.intent\.action\.MAIN"/);
    assert.match(
      manifest,
      /android:name="android\.intent\.category\.LAUNCHER"/
    );
    assert.match(activity, /WearSessionScreen\(WearSessionRuntime\.state\.value\)/);
    assert.match(activity, /Reconnect from phone/);
    assert.match(activity, /state\.babyName/);
    assert.match(state, /Sign in on your phone to continue\./);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
