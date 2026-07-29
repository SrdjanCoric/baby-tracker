import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = join(root, ".expo", "development-tools-production-gate");
const expoCli = join(root, "node_modules", "expo", "bin", "cli");
const markers = [
  "Developer Tools",
  "Isolated onboarding preview",
  "preview-onboarding",
  "replay-first-launch",
  "clear-onboarding-draft",
];

function findHermesBundles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return findHermesBundles(path);
    return entry.name.endsWith(".hbc") ? [path] : [];
  });
}

rmSync(outputDirectory, { recursive: true, force: true });
const result = spawnSync(
  process.execPath,
  [expoCli, "export", "--platform", "ios", "--output-dir", outputDirectory, "--clear"],
  {
    cwd: root,
    env: {
      ...process.env,
      EXPO_NO_DOTENV: "1",
      NODE_ENV: "production",
    },
    encoding: "utf8",
  }
);

if (result.status !== 0) {
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");
  process.exit(result.status ?? 1);
}

const bundles = findHermesBundles(outputDirectory);
assert.ok(bundles.length > 0, "Expo export did not produce an iOS Hermes bundle");
const productionBundle = Buffer.concat(bundles.map(path => readFileSync(path)));
for (const marker of markers) {
  assert.equal(
    productionBundle.includes(Buffer.from(marker)),
    false,
    `Production bundle contains development-only marker: ${marker}`
  );
}

rmSync(outputDirectory, { recursive: true, force: true });
console.log("Production bundle excludes development onboarding tools");
