#!/usr/bin/env node
// Locale key differential. Compares every locale against en.json and reports
// missing keys, orphan keys, and values left identical to their English source.
//
// Supporting evidence for docs/post-july-app-regression-audit.md (Task 0051).
// Read-only: it prints a report and never edits a locale file.
//
//   node scripts/audit/locale-key-parity.mjs [localesDir]
//
// Exit code is 0 when every locale resolves every en.json key, 1 otherwise, so
// this can be wired into a check later if the project decides to enforce parity.

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "src/i18n/locales";

function flatten(value, prefix = "", out = new Map()) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      flatten(child, path, out);
    } else {
      out.set(path, child);
    }
  }
  return out;
}

const load = (file) => flatten(JSON.parse(readFileSync(join(dir, file), "utf8")));
const preview = (keys, limit = 12) =>
  `${keys.slice(0, limit).join(", ")}${keys.length > limit ? ` … +${keys.length - limit}` : ""}`;

const files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
if (!files.includes("en.json")) {
  console.error(`No en.json in ${dir}`);
  process.exit(1);
}

const base = load("en.json");
console.log(`base en.json: ${base.size} keys\n`);

let missingTotal = 0;

for (const file of files) {
  if (file === "en.json") continue;
  const locale = load(file);

  const missing = [...base.keys()].filter((key) => !locale.has(key));
  // Extra keys are usually legitimate: i18next plural categories (_few/_many) and
  // gender context variants exist per language, so they are reported, not failed on.
  const extra = [...locale.keys()].filter((key) => !base.has(key));
  const identical = [...base.keys()].filter((key) => {
    const english = base.get(key);
    return locale.has(key) && typeof english === "string" && english.length > 3 && locale.get(key) === english;
  });

  missingTotal += missing.length;

  console.log(
    `${file}: ${locale.size} keys — missing ${missing.length}, extra ${extra.length}, identical-to-en ${identical.length}`
  );
  if (missing.length) console.log(`  missing: ${preview(missing)}`);
  if (extra.length) console.log(`  extra:   ${preview(extra)}`);
}

console.log(
  missingTotal === 0
    ? "\nEvery locale resolves every en.json key."
    : `\n${missingTotal} unresolved key(s); those strings fall back to English.`
);

process.exit(missingTotal === 0 ? 0 : 1);
