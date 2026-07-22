import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

test("the declared npm version matches pinned Node 20 tooling", () => {
  assert.equal(packageJson.packageManager, "npm@10.8.2");
});

test("the canonical check command runs every maintained non-device suite", () => {
  assert.equal(
    packageJson.scripts["check:code"],
    "npm run lint && npm run typecheck && npm run test:unit && npm run test:component -- --runInBand && npm run test:security && npm run test:sync && npm run test:ci"
  );
  assert.equal(
    packageJson.scripts.check,
    "npm run check:code && npm run test:sql:setup && npm run test:sql"
  );
});
