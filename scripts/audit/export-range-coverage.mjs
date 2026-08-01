#!/usr/bin/env node
// Structural probe for finding F-1 in docs/post-july-app-regression-audit.md (Task 0051).
//
// README.md states the post-July contract: startup pulls read at most 1,000 recent
// rows per activity table, and a surface requests the range it displays. This probe
// checks which historical-data consumers actually resolve a range before reading, and
// which read the local cache only.
//
//   node scripts/audit/export-range-coverage.mjs
//
// It reproduces F-1 from committed source alone — no database, simulator, or
// production-derived fixture is required. It proves the code path, not the
// user-visible symptom; reproducing the symptom needs a baby with more than 1,000
// records in one collection and is a release-owner step.
//
// Read-only. Exit codes: 0 every range-reading consumer resolves its range,
// 1 at least one reads the cache only (F-1 still present), 2 the tool itself failed.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const EXIT_OK = 0;
const EXIT_PRESENT = 1;
const EXIT_TOOL_FAILURE = 2;

// A consumer "resolves its range" if it reaches the on-demand loader, which is the
// only path that paginates past the 1,000-row startup cap.
const RANGE_RESOLUTION = [
  "useActivityRangeLoader",
  "fetchActivityRangeFromDatabase",
  "activity-range-loader",
  "ensureRange",
  "loadRange",
];

const CONSUMERS = [
  { file: "src/services/export-service.ts", surface: "Export (CSV)", readsUserRange: true },
  { file: "src/services/pdf-service.ts", surface: "Reports (PDF)", readsUserRange: true },
  { file: "src/components/stats/StatisticsActivityRange.tsx", surface: "Statistics", readsUserRange: true },
  { file: "src/hooks/useActivityRangeLoader.ts", surface: "Timeline / range loader", readsUserRange: true },
];

function read(relative) {
  try {
    return readFileSync(resolve(root, relative), "utf8");
  } catch (error) {
    console.error(`Could not read ${relative} — ${error.message}`);
    process.exit(EXIT_TOOL_FAILURE);
  }
}

console.log("Which historical-data consumers resolve their range before reading?\n");

const cacheOnly = [];

for (const consumer of CONSUMERS) {
  const source = read(consumer.file);
  const matched = RANGE_RESOLUTION.filter((marker) => source.includes(marker));
  const readsStorageDirectly = /StorageService\.getAll/.test(source);

  if (matched.length === 0 && readsStorageDirectly) {
    cacheOnly.push(consumer);
    console.log(`  CACHE-ONLY  ${consumer.surface} — ${consumer.file}`);
    console.log("              reads *StorageService.getAll*, no range resolution");
  } else {
    console.log(`  RESOLVES    ${consumer.surface} — ${consumer.file}`);
    console.log(`              via ${matched.join(", ") || "range loader module"}`);
  }
}

if (cacheOnly.length === 0) {
  console.log("\nEvery consumer resolves its range. F-1 no longer reproduces.");
  process.exit(EXIT_OK);
}

console.log(
  `\nF-1 reproduces: ${cacheOnly.length} surface(s) read the local cache only while ` +
    "offering the user a date range.\nRecords older than the startup cap are absent from their " +
    "output, and the pre-export count is drawn from\nthe same truncated cache."
);
process.exit(EXIT_PRESENT);
