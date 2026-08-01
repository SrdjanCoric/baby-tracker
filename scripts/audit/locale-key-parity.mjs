#!/usr/bin/env node
// Locale key differential. Compares every locale against en.json and reports
// missing keys, orphan keys, and values left identical to their English source.
//
// Supporting evidence for docs/post-july-app-regression-audit.md (Task 0051).
// Read-only: it prints a report and never edits a locale file.
//
//   node scripts/audit/locale-key-parity.mjs [localesDir]
//
// The locales directory defaults to src/i18n/locales resolved from this file,
// so the script works from any working directory.
//
// "identical-to-en" flags a translation byte-identical to its English source.
// Strings of 3 characters or fewer are skipped, because short UI labels such as
// "OK" are legitimately identical in several languages; the cutoff is a
// heuristic for review, not a defect count.
//
// Exit codes: 0 every locale resolves every en.json key, 1 a key is unresolved
// and falls back to English, 2 the tool itself failed (unreadable or malformed
// locale file). Keeping 2 distinct means a future automated check cannot read a
// corrupt file as a parity failure.

import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DEFAULT_DIR = resolve(here, "..", "..", "src", "i18n", "locales");
const dir = process.argv[2] ?? DEFAULT_DIR;

const EXIT_OK = 0;
const EXIT_UNRESOLVED = 1;
const EXIT_TOOL_FAILURE = 2;

function fail(message) {
  console.error(message);
  process.exit(EXIT_TOOL_FAILURE);
}

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

function load(file) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
  } catch (error) {
    fail(`${file}: could not be read as JSON — ${error.message}`);
  }
  // A non-object root would make Object.entries produce character-index keys
  // and report nonsense rather than an error.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${file}: expected a JSON object at the root`);
  }
  return flatten(parsed);
}

const preview = (keys, limit = 12) =>
  `${keys.slice(0, limit).join(", ")}${keys.length > limit ? ` … +${keys.length - limit}` : ""}`;

let files;
try {
  files = readdirSync(dir).filter((file) => file.endsWith(".json")).sort();
} catch (error) {
  fail(`Could not read locales directory ${dir} — ${error.message}`);
}

if (!files.includes("en.json")) fail(`No en.json in ${dir}`);

const base = load("en.json");
console.log(`base en.json: ${base.size} keys\n`);

let missingTotal = 0;

for (const file of files) {
  if (file === "en.json") continue;
  const locale = load(file);

  const missing = [...base.keys()].filter((key) => !locale.has(key));
  // Extra keys are usually legitimate: i18next plural categories (_few/_many)
  // and gender context variants exist per language, so they are reported, not failed on.
  const extra = [...locale.keys()].filter((key) => !base.has(key));
  const identical = [...base.keys()].filter((key) => {
    const english = base.get(key);
    return locale.has(key) && typeof english === "string" && english.length > 3 && locale.get(key) === english;
  });

  missingTotal += missing.length;

  console.log(
    `${file}: ${locale.size} keys — missing ${missing.length}, extra ${extra.length}, identical-to-en ${identical.length}`
  );
  if (missing.length) console.log(`  missing:   ${preview(missing)}`);
  if (extra.length) console.log(`  extra:     ${preview(extra)}`);
  if (identical.length) console.log(`  identical: ${preview(identical)}`);
}

console.log(
  missingTotal === 0
    ? "\nEvery locale resolves every en.json key."
    : `\n${missingTotal} unresolved key(s); those strings fall back to English.`
);

process.exit(missingTotal === 0 ? EXIT_OK : EXIT_UNRESOLVED);
