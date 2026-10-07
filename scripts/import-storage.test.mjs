import { URL } from "node:url";
import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const require = createRequire(import.meta.url);
const withImportStorage = require("../plugins/with-import-storage.js");

test("Android import storage capacity survives prebuild and replaces a smaller prior limit", async () => {
  const config = withImportStorage({ name: "Test", slug: "test" });
  const mod = config.mods.android.gradleProperties;
  const properties = [
    { type: "property", key: "newArchEnabled", value: "true" },
    { type: "property", key: "AsyncStorage_db_size_in_MB", value: "6" },
  ];
  const request = {
    projectRoot: process.cwd(),
    platform: "android",
    modName: "gradleProperties",
    introspect: true,
  };
  const updated = await mod({
    ...config,
    modResults: properties,
    modRequest: request,
  });
  assert.deepEqual(updated.modResults, [
    properties[0],
    { type: "property", key: "AsyncStorage_db_size_in_MB", value: "64" },
  ]);
  const repeated = await mod({
    ...config,
    modResults: updated.modResults,
    modRequest: request,
  });
  assert.deepEqual(repeated.modResults, updated.modResults);
});

test("the application registers the storage-capacity plugin", () => {
  const config = JSON.parse(
    readFileSync(new URL("../app.json", import.meta.url), "utf8")
  );
  assert.ok(config.expo.plugins.includes("./plugins/with-import-storage"));
});
