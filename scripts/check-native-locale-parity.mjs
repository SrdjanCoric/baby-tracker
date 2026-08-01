#!/usr/bin/env node
// Native string parity gate for the Watch app and the iOS widget.
//
// The phone falls back to English when a key is missing, which hides the defect.
// The native targets have no such safety net worth relying on, so every key a
// target actually references must exist in all nine shipped locales. This checks
// the keys the Swift sources use, not merely that a resource file exists.
//
//   node scripts/check-native-locale-parity.mjs [--strings <dir>] [--targets <dir>]
//
// Exit codes: 0 every referenced key resolves everywhere, 1 a key is unresolved in
// at least one locale, 2 the tool itself failed. Keeping 2 distinct means a corrupt
// or unreadable file can never be misread as a clean parity result.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { SHIPPED_LOCALES } from "./generate-native-strings.mjs";

const here = dirname(fileURLToPath(import.meta.url));

// Members of the generated accessor that are not translatable keys.
const RESERVED_MEMBERS = new Set([
  "t",
  "p",
  "language",
  "supportedLanguages",
  "table",
  "pluralTable",
  "pluralCategory",
]);

/**
 * The conversion characters a string hands to String(format:), position-independent.
 *
 * Order is deliberately ignored: a locale may reorder positional specifiers such
 * as %1$d and %2$d to suit its grammar. What must not change is which arguments
 * are consumed and how — Swift's String(format:) is a varargs bridge, so a %@
 * where the call site passes an Int makes Foundation read that integer as an
 * object pointer instead of merely printing the wrong text.
 */
function formatSpecifiers(value) {
  const found = [];
  for (const match of value.matchAll(/%(%|(?:\d+\$)?[-+ #0]*[\d.]*([a-zA-Z@]))/g)) {
    if (match[1] === "%") continue;
    found.push(match[2]);
  }
  return found.sort();
}

function specifiersMatch(candidate, expected) {
  const a = formatSpecifiers(candidate);
  const b = formatSpecifiers(expected);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

// CLDR cardinal categories each locale actually inflects. Serbian takes a
// distinct form for 2-4, 22-24 and so on, so two forms would be wrong there.
const REQUIRED_PLURAL_CATEGORIES = {
  sr: ["one", "few", "other"],
};
const DEFAULT_PLURAL_CATEGORIES = ["one", "other"];

function requiredCategories(locale) {
  return REQUIRED_PLURAL_CATEGORIES[locale] ?? DEFAULT_PLURAL_CATEGORIES;
}

function isPluralForm(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

// The generated file declares every key; only call sites count as references.
const GENERATED_FILENAME = "GeneratedStrings.swift";

const EXIT_OK = 0;
const EXIT_UNRESOLVED = 1;
const EXIT_TOOL_FAILURE = 2;

function fail(message) {
  console.error(message);
  process.exit(EXIT_TOOL_FAILURE);
}

function parseArgs(argv) {
  const options = {
    strings: resolve(here, "..", "localization", "native"),
    targets: resolve(here, "..", "targets"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--strings" || flag === "--targets") {
      const value = argv[index + 1];
      if (!value) fail(`${flag} requires a directory`);
      options[flag.slice(2)] = resolve(value);
      index += 1;
    } else {
      fail(`Unknown argument: ${flag}`);
    }
  }
  return options;
}

function swiftFiles(dir) {
  const found = [];
  const walk = (current) => {
    for (const entry of readdirSync(current)) {
      const path = join(current, entry);
      if (statSync(path).isDirectory()) {
        walk(path);
      } else if (entry.endsWith(".swift") && entry !== GENERATED_FILENAME) {
        found.push(path);
      }
    }
  };
  walk(dir);
  return found;
}

function collectReferencedKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/\bL\.([A-Za-z][A-Za-z0-9_]*)/g)) {
    const key = match[1];
    if (!RESERVED_MEMBERS.has(key)) keys.add(key);
  }
  return keys;
}

function loadLocale(stringsDir, locale) {
  const path = join(stringsDir, `${locale}.json`);
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    fail(`${locale}.json: could not be read as JSON — ${error.message}`);
  }
  // A non-object root would make key lookups silently nonsensical.
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    fail(`${locale}.json: expected a JSON object at the root`);
  }
  return parsed;
}

const options = parseArgs(process.argv.slice(2));

let sources;
try {
  sources = swiftFiles(options.targets);
} catch (error) {
  fail(`Could not read targets directory ${options.targets} — ${error.message}`);
}

const referenced = new Set();
for (const file of sources) {
  try {
    for (const key of collectReferencedKeys(readFileSync(file, "utf8"))) {
      referenced.add(key);
    }
  } catch (error) {
    fail(`Could not read ${file} — ${error.message}`);
  }
}

const keys = [...referenced].sort();
console.log(`${sources.length} Swift source(s) reference ${keys.length} native string key(s)`);

const problems = [];

// en.json decides which keys are count-inflected; every locale must agree.
const english = loadLocale(options.strings, "en");
if (english === null) fail(`en.json is missing from ${options.strings}`);
const pluralKeys = new Set(keys.filter((key) => isPluralForm(english[key])));

for (const locale of SHIPPED_LOCALES) {
  const table = loadLocale(options.strings, locale);
  if (table === null) {
    problems.push(`${locale}: locale file is missing from ${options.strings}`);
    continue;
  }

  const missing = [];
  for (const key of keys) {
    const value = table[key];

    if (!pluralKeys.has(key)) {
      if (typeof value !== "string" || value === "") {
        missing.push(key);
      } else if (!specifiersMatch(value, english[key])) {
        missing.push(
          `${key} (format specifiers ${formatSpecifiers(value).join("")} != en ${formatSpecifiers(english[key]).join("")})`
        );
      }
      continue;
    }

    if (!isPluralForm(value)) {
      missing.push(`${key} (expected plural forms, not a single string)`);
      continue;
    }

    // English may not carry every category a locale needs, so its "other" form
    // is the reference for what the call site will pass.
    const reference = english[key].other ?? english[key].one ?? "";
    for (const category of requiredCategories(locale)) {
      const form = value[category];
      if (typeof form !== "string" || form === "") {
        missing.push(`${key}.${category}`);
      } else if (!specifiersMatch(form, reference)) {
        missing.push(
          `${key}.${category} (format specifiers ${formatSpecifiers(form).join("")} != en ${formatSpecifiers(reference).join("")})`
        );
      }
    }
  }

  if (missing.length) {
    problems.push(`${locale}: missing ${missing.length} form(s) — ${missing.join(", ")}`);
  }
}

if (problems.length === 0) {
  console.log(`Every referenced key resolves in all ${SHIPPED_LOCALES.length} locales.`);
  process.exit(EXIT_OK);
}

for (const problem of problems) console.error(problem);
console.error(`\n${problems.length} locale(s) would fall back or render a raw key.`);
process.exit(EXIT_UNRESOLVED);
