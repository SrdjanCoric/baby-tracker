import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

const require = createRequire(import.meta.url);
const targetDirectory = dirname(
  fileURLToPath(new URL("../targets/watch/expo-target.config.js", import.meta.url))
);
const watchConfig = require("../targets/watch/expo-target.config.js");

test("the Watch target declares a square app icon for native packaging", () => {
  assert.equal(watchConfig.type, "watch");
  assert.equal(typeof watchConfig.icon, "string");
  assert.notEqual(watchConfig.icon.trim(), "");

  const iconPath = resolve(targetDirectory, watchConfig.icon);
  assert.equal(statSync(iconPath).isFile(), true);

  const icon = readFileSync(iconPath);
  assert.deepEqual([...icon.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
});
