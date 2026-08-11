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
const swiftEnvironment = {
  ...process.env,
  CLANG_MODULE_CACHE_PATH: moduleCache,
  SWIFT_MODULECACHE_PATH: moduleCache,
};

const widgetProductionSources = [
  "targets/widget/GeneratedStrings.swift",
  "targets/widget/LiveActivity.swift",
  "targets/widget/SharedSupabaseSession.swift",
  "targets/widget/SharedSupabaseSessionAdapters.swift",
  "targets/widget/WidgetActivitySnapshot.swift",
  "targets/widget/index.swift",
];

function typecheckWidgetProductionSources() {
  if (process.platform !== "darwin") {
    console.log("SKIP: Widget production Swift typecheck requires macOS/Xcode");
    return;
  }

  const sdkPath = execFileSync(
    "xcrun",
    ["--sdk", "iphoneos", "--show-sdk-path"],
    { cwd: root, encoding: "utf8" }
  ).trim();
  execFileSync(
    "xcrun",
    [
      "--sdk",
      "iphoneos",
      "swiftc",
      "-typecheck",
      "-parse-as-library",
      "-application-extension",
      "-swift-version",
      "5",
      "-module-name",
      "SofiBabyWidget",
      "-target",
      "arm64-apple-ios18.0",
      "-sdk",
      sdkPath,
      "-module-cache-path",
      moduleCache,
      ...widgetProductionSources,
    ],
    {
      cwd: root,
      env: swiftEnvironment,
      stdio: "inherit",
    }
  );
  console.log("PASS: Widget production Swift typecheck");
}

mkdirSync(moduleCache);

try {
  typecheckWidgetProductionSources();
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
      env: swiftEnvironment,
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
      env: swiftEnvironment,
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
      env: swiftEnvironment,
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
