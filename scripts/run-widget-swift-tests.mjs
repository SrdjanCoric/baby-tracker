#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const buildDirectory = mkdtempSync(join(tmpdir(), "widget-snapshot-tests-"));
const moduleCache = join(buildDirectory, "module-cache");
const executable = join(buildDirectory, "widget-snapshot-tests");

mkdirSync(moduleCache);

try {
  execFileSync(
    "swiftc",
    [
      "-parse-as-library",
      "targets/widget/WidgetActivitySnapshot.swift",
      "scripts/swift/widget-snapshot-tests.swift",
      "-o",
      executable,
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        CLANG_MODULE_CACHE_PATH: moduleCache,
        SWIFT_MODULECACHE_PATH: moduleCache,
      },
      stdio: "inherit",
    }
  );
  execFileSync(executable, ["fixtures/widget-activity-snapshots"], {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  rmSync(buildDirectory, { recursive: true, force: true });
}
