import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";
import { ESLint } from "eslint";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const vitestConfig = readFileSync(
  new URL("../vitest.config.ts", import.meta.url),
  "utf8"
);

test("the declared npm version matches pinned Node 20 tooling", () => {
  assert.equal(packageJson.packageManager, "npm@10.8.2");
});

test("lint ignores generated Android output", async () => {
  const eslint = new ESLint({ cwd: repositoryRoot });

  assert.equal(
    await eslint.isPathIgnored(
      "android/wear/build/reports/tests/testDebugUnitTest/js/report.js"
    ),
    true
  );
});

test("the canonical check command runs every maintained non-device suite once", () => {
  assert.match(
    packageJson.scripts["test:ci"],
    /scripts\/date-picker-codegen\.test\.mjs/
  );
  assert.match(
    packageJson.scripts["test:ci"],
    /scripts\/watch-app-icon\.test\.mjs/
  );
  assert.match(
    packageJson.scripts["test:ci"],
    /scripts\/wear-os-plugin\.test\.mjs/
  );
  assert.equal(
    packageJson.scripts["check:code"],
    "npm run lint && npm run typecheck && npm run test:unit && npm run test:local-dates && npm run test:component -- --runInBand && npm run test:ci && npm run test:widget:swift && npm run test:production-gating"
  );
  assert.equal(packageJson.scripts["test:unit"], "vitest run");
  assert.equal(
    packageJson.scripts["test:local-dates"],
    "TZ=Pacific/Kiritimati vitest run src/utils/statistics-local-dates.test.ts src/utils/report-aggregator.test.ts && TZ=Pacific/Kiritimati jest --runInBand --runTestsByPath src/utils/tip-selector.component.test.tsx && TZ=America/New_York vitest run src/utils/statistics-local-dates.test.ts src/utils/report-aggregator.test.ts && TZ=America/New_York jest --runInBand --runTestsByPath src/utils/tip-selector.component.test.tsx"
  );
  assert.match(vitestConfig, /include:\s*\["src\/\*\*\/\*\.test\.ts"/);
  assert.equal(
    packageJson.scripts["test:security"],
    "vitest run src/__tests__/security/"
  );
  assert.equal(
    packageJson.scripts["test:sync"],
    "vitest run src/services/sync/"
  );
  assert.equal(
    packageJson.scripts["test:production-gating"],
    "node scripts/check-development-tools-production-bundle.mjs"
  );
  assert.equal(
    packageJson.scripts["test:widget:swift"],
    "node scripts/run-widget-swift-tests.mjs"
  );
  assert.equal(
    packageJson.scripts.check,
    "npm run check:code && npm run test:sql:setup && npm run test:sql"
  );
});
