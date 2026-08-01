import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, URL } from "node:url";

const SCRIPT = fileURLToPath(new URL("./check-native-locale-parity.mjs", import.meta.url));
const LOCALES = ["en", "sr", "es", "es-ES", "fr", "pt-PT", "pt-BR", "de", "it"];

function scaffold({ keys, omit = {}, swift = null, extraLocaleFiles = {} }) {
  const root = mkdtempSync(join(tmpdir(), "native-locale-"));
  const stringsDir = join(root, "strings");
  const targetsDir = join(root, "targets", "watch");
  mkdirSync(stringsDir, { recursive: true });
  mkdirSync(targetsDir, { recursive: true });

  for (const locale of LOCALES) {
    const table = {};
    for (const key of keys) {
      if (omit[locale]?.includes(key)) continue;
      table[key] = `${locale}:${key}`;
    }
    writeFileSync(join(stringsDir, `${locale}.json`), JSON.stringify(table, null, 2));
  }
  for (const [name, contents] of Object.entries(extraLocaleFiles)) {
    writeFileSync(join(stringsDir, name), contents);
  }

  const body = swift ?? keys.map((key) => `        Text(L.${key})`).join("\n");
  writeFileSync(join(targetsDir, "index.swift"), `struct V: View {\n    var body: some View {\n${body}\n    }\n}\n`);

  return { root, stringsDir, targetsDir };
}

function run({ stringsDir, targetsDir }) {
  const result = spawnSync(process.execPath, [SCRIPT, "--strings", stringsDir, "--targets", targetsDir], {
    encoding: "utf8",
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

test("passes when every referenced key resolves in all nine locales", () => {
  const fixture = scaffold({ keys: ["start", "pause", "confirmInSofiBaby"] });
  try {
    const { status } = run(fixture);
    assert.equal(status, 0);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when a key a target references is missing from one locale", () => {
  const fixture = scaffold({
    keys: ["start", "pause"],
    omit: { "pt-PT": ["pause"] },
  });
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 1);
    assert.match(output, /pt-PT/);
    assert.match(output, /pause/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when a target references a key that exists in no locale", () => {
  const fixture = scaffold({
    keys: ["start"],
    swift: "        Text(L.start)\n        Text(L.neverTranslated)",
  });
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 1);
    assert.match(output, /neverTranslated/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("reports a tool failure rather than a parity failure when a locale file is malformed", () => {
  const fixture = scaffold({
    keys: ["start"],
    extraLocaleFiles: { "de.json": "{ not json" },
  });
  try {
    const { status } = run(fixture);
    assert.equal(status, 2);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when a shipped locale file is absent entirely", () => {
  const fixture = scaffold({ keys: ["start"] });
  try {
    rmSync(join(fixture.stringsDir, "it.json"));
    const { status, output } = run(fixture);
    assert.equal(status, 1);
    assert.match(output, /it/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("every string the shipped Watch and widget sources reference resolves in all nine locales", () => {
  const result = spawnSync(process.execPath, [SCRIPT], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

test("the generated Swift string tables match localization/native", () => {
  const generator = fileURLToPath(new URL("./generate-native-strings.mjs", import.meta.url));
  const result = spawnSync(process.execPath, [generator, "--check"], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
});

function scaffoldPlural({ categoriesByLocale }) {
  const root = mkdtempSync(join(tmpdir(), "native-plural-"));
  const stringsDir = join(root, "strings");
  const targetsDir = join(root, "targets", "watch");
  mkdirSync(stringsDir, { recursive: true });
  mkdirSync(targetsDir, { recursive: true });

  for (const locale of LOCALES) {
    const forms = {};
    for (const category of categoriesByLocale(locale)) {
      forms[category] = `${locale}:${category}`;
    }
    writeFileSync(
      join(stringsDir, `${locale}.json`),
      JSON.stringify({ start: `${locale}:start`, napsCount: forms }, null, 2)
    );
  }

  writeFileSync(
    join(targetsDir, "index.swift"),
    "struct V: View {\n    var body: some View {\n        Text(L.start)\n        Text(L.napsCount(count))\n    }\n}\n"
  );

  return { root, stringsDir, targetsDir };
}

// Serbian inflects counts in three categories, so two forms are not enough.
const REQUIRED = (locale) => (locale === "sr" ? ["one", "few", "other"] : ["one", "other"]);

test("passes when a plural key supplies every category each locale requires", () => {
  const fixture = scaffoldPlural({ categoriesByLocale: REQUIRED });
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 0, output);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when Serbian omits the few category a plural key needs", () => {
  const fixture = scaffoldPlural({
    categoriesByLocale: (locale) => (locale === "sr" ? ["one", "other"] : REQUIRED(locale)),
  });
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 1);
    assert.match(output, /sr/);
    assert.match(output, /few/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when a plural key omits the other category", () => {
  const fixture = scaffoldPlural({
    categoriesByLocale: (locale) => REQUIRED(locale).filter((category) => category !== "other"),
  });
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 1);
    assert.match(output, /other/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("fails when a locale declares a plural key as a flat string", () => {
  const fixture = scaffoldPlural({ categoriesByLocale: REQUIRED });
  try {
    writeFileSync(
      join(fixture.stringsDir, "de.json"),
      JSON.stringify({ start: "de:start", napsCount: "de:flat" }, null, 2)
    );
    const { status, output } = run(fixture);
    assert.equal(status, 1);
    assert.match(output, /de/);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("ignores the generated accessor's own members when collecting referenced keys", () => {
  const fixture = scaffold({
    keys: ["start"],
    swift: "        Text(L.start)\n        let _ = L.language\n        let _ = L.t(\"start\")",
  });
  try {
    const { status, output } = run(fixture);
    assert.equal(status, 0, output);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});
