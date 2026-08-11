#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const root = resolve(scriptDirectory, "..");
const buildDirectory = mkdtempSync(join(tmpdir(), "widget-snapshot-tests-"));
const moduleCache = join(buildDirectory, "module-cache");
const executable = join(buildDirectory, "widget-snapshot-tests");
const watchExecutable = join(buildDirectory, "watch-summary-tests");
const sharedSessionExecutable = join(buildDirectory, "shared-supabase-session-tests");

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
  execFileSync(
    "swiftc",
    [
      "-parse-as-library",
      "targets/widget/SharedSupabaseSession.swift",
      "scripts/swift/shared-supabase-session-tests.swift",
      "-o",
      sharedSessionExecutable,
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
  execFileSync(sharedSessionExecutable, [], {
    cwd: root,
    stdio: "inherit",
  });
  execFileSync(
    "swiftc",
    [
      "-parse-as-library",
      "targets/watch/WatchActivitySummary.swift",
      "scripts/swift/watch-summary-tests.swift",
      "-o",
      watchExecutable,
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
  execFileSync(watchExecutable, ["fixtures/widget-activity-snapshots"], {
    cwd: root,
    stdio: "inherit",
  });
} finally {
  rmSync(buildDirectory, { recursive: true, force: true });
}
