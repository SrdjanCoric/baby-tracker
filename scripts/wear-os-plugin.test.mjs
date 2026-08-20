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

  try {
    const { syncWearOsModule } = require("../plugins/with-wear-os");

    syncWearOsModule({ projectRoot: repositoryRoot, androidRoot });
    syncWearOsModule({ projectRoot: repositoryRoot, androidRoot });

    const settings = readFileSync(join(androidRoot, "settings.gradle"), "utf8");
    assert.equal(settings.match(/include ':wear'/g)?.length, 1);
    assert.equal(appConfig.expo.android.package, "com.sofibaby.app");
    assert.match(
      readFileSync(join(androidRoot, "wear", "build.gradle"), "utf8"),
      /applicationId ['"]com\.sofibaby\.app['"]/
    );
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
    assert.match(activity, /text = SignedOutState\.message/);
    assert.match(state, /Sign in on your phone to continue\./);
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
