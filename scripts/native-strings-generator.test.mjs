import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const SCRIPT = fileURLToPath(new URL("./generate-native-strings.mjs", import.meta.url));
const LOCALES = ["en", "sr", "es", "es-ES", "fr", "pt-PT", "pt-BR", "de", "it"];

function scaffold(entriesByLocale) {
  const root = mkdtempSync(join(tmpdir(), "native-gen-"));
  const stringsDir = join(root, "strings");
  const outDir = join(root, "out");
  mkdirSync(stringsDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });
  for (const locale of LOCALES) {
    writeFileSync(
      join(stringsDir, `${locale}.json`),
      JSON.stringify(entriesByLocale(locale), null, 2)
    );
  }
  return { root, stringsDir, outDir };
}

function run(fixture, extra = []) {
  const result = spawnSync(
    process.execPath,
    [SCRIPT, "--strings", fixture.stringsDir, "--target", fixture.outDir, ...extra],
    { encoding: "utf8" }
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const simple = () => ({ start: "Start" });

test("writes a Swift table and reports it up to date on a second --check", () => {
  const fixture = scaffold(simple);
  try {
    assert.equal(run(fixture).status, 0);
    const generated = readFileSync(join(fixture.outDir, "GeneratedStrings.swift"), "utf8");
    assert.match(generated, /static var start: String/);
    assert.equal(run(fixture, ["--check"]).status, 0);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("--check fails without rewriting when the table is stale", () => {
  const fixture = scaffold(simple);
  try {
    run(fixture);
    const path = join(fixture.outDir, "GeneratedStrings.swift");
    writeFileSync(path, "// stale\n");
    assert.equal(run(fixture, ["--check"]).status, 1);
    assert.equal(readFileSync(path, "utf8"), "// stale\n");
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects an unrecognized flag instead of silently writing", () => {
  const fixture = scaffold(simple);
  try {
    // A mistyped drift flag must not take the write path and report success.
    const { status } = run(fixture, ["--chek"]);
    assert.equal(status, 2);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("refuses a key that is not a plain Swift identifier", () => {
  const fixture = scaffold(() => ({
    start: "Start",
    'x: String { Self.hack() }\n    static var y': "injected",
  }));
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 2);
    assert.match(output, /identifier/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("refuses a key that collides with a member of the generated accessor", () => {
  const fixture = scaffold(() => ({ start: "Start", table: "Table" }));
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 2);
    assert.match(output, /table/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("refuses a key that is a Swift keyword", () => {
  const fixture = scaffold(() => ({ start: "Start", repeat: "Repeat" }));
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 2);
    assert.match(output, /repeat/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("escapes a carriage return so one translation cannot break the build", () => {
  const fixture = scaffold((locale) => ({ start: locale === "de" ? "Start\r\nJetzt" : "Start" }));
  try {
    assert.equal(run(fixture).status, 0);
    const generated = readFileSync(join(fixture.outDir, "GeneratedStrings.swift"), "utf8");
    // A raw CR inside a Swift literal terminates the line and fails to compile.
    assert.ok(!generated.split("\n").some((line) => line.includes("\r")));
    assert.match(generated, /\\r\\n/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("gives European Portuguese its own plural rule so zero stays plural", () => {
  const fixture = scaffold(() => ({
    start: "Start",
    napsCount: { one: "one", few: "few", other: "other" },
  }));
  try {
    assert.equal(run(fixture).status, 0);
    const generated = readFileSync(join(fixture.outDir, "GeneratedStrings.swift"), "utf8");
    const rule = generated.slice(generated.indexOf("func pluralCategory"));
    const ptPtCase = rule.slice(rule.indexOf('"pt-PT"'));
    // CLDR pt_PT overrides pt: only exactly 1 is singular, so 0 must be "other".
    assert.ok(!/case "fr", "pt-PT"/.test(rule), "pt-PT must not share the fr rule");
    assert.match(ptPtCase.slice(0, 200), /n == 1/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("resolves the language once per lookup rather than rebuilding the suite", () => {
  const fixture = scaffold(simple);
  try {
    run(fixture);
    const generated = readFileSync(join(fixture.outDir, "GeneratedStrings.swift"), "utf8");
    // A fresh UserDefaults(suiteName:) per string multiplies an IPC-backed
    // allocation across every label the widget and Watch render.
    const allocations = generated.match(/UserDefaults\(suiteName:/g) ?? [];
    assert.equal(allocations.length, 1);
    assert.match(generated, /static let defaults/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
