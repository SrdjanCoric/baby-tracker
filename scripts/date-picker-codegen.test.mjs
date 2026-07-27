import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
import { URL } from "node:url";

const require = createRequire(import.meta.url);
const datePickerPackage = JSON.parse(
  readFileSync(require.resolve("react-native-date-picker/package.json"), "utf8")
);
const householdRunner = readFileSync(
  new URL("../e2e/scripts/run-household-timers.mjs", import.meta.url),
  "utf8"
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const packageLock = JSON.parse(
  readFileSync(new URL("../package-lock.json", import.meta.url), "utf8")
);

test("the installed iOS date picker metadata does not register its legacy manager as a TurboModule", () => {
  assert.notEqual(
    datePickerPackage.codegenConfig?.ios?.modulesProvider?.RNDatePicker,
    "RNDatePickerManager"
  );
  assert.equal(
    datePickerPackage.codegenConfig?.ios?.componentProvider?.RNDatePicker,
    "RNDatePicker"
  );
});

test("the date picker uses the approved exact registry package", () => {
  const lockedPackage = packageLock.packages["node_modules/react-native-date-picker"];

  assert.equal(packageJson.dependencies["react-native-date-picker"], "5.0.13");
  assert.equal(packageLock.packages[""].dependencies["react-native-date-picker"], "5.0.13");
  assert.equal(lockedPackage.version, "5.0.13");
  assert.equal(
    lockedPackage.resolved,
    "https://registry.npmjs.org/react-native-date-picker/-/react-native-date-picker-5.0.13.tgz"
  );
  assert.equal(
    lockedPackage.integrity,
    "sha512-qCLUODZVsJetO5zuoXjw1D39K527XWqBG8sOfhWdHyPzf13h8RXR1/RSKd1N0fdRDi5GdyizYmB0lPAK12/hbw=="
  );
});

test("the clean household E2E runner does not mutate installed date picker metadata", () => {
  assert.doesNotMatch(householdRunner, /prepare-e2e-dependencies/);
  assert.doesNotMatch(householdRunner, /react-native-date-picker-package/);
});

test("the household E2E release gate opens the iOS date picker", () => {
  assert.match(householdRunner, /maestro\(owner, "date-picker\.yaml"\)/);
});
