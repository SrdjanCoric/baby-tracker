import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import { parse } from "yaml";

import { evaluateDependencyAudit } from "./audit-dependencies.mjs";

const highAdvisory = {
  source: 1234,
  name: "example-package",
  title: "Example vulnerability",
  url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
  severity: "high",
  range: "<2.0.0",
};

function auditWith(...advisories) {
  return {
    vulnerabilities: {
      "example-package": {
        name: "example-package",
        severity: "high",
        isDirect: false,
        via: advisories,
        effects: [],
        range: "<2.0.0",
        nodes: ["node_modules/example-package"],
        fixAvailable: true,
      },
    },
  };
}

test("an unapproved high-severity advisory fails the dependency audit", () => {
  const result = evaluateDependencyAudit({
    audit: auditWith(highAdvisory),
    exceptions: [],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.unapproved.map(({ advisory }) => advisory), [
    "GHSA-aaaa-bbbb-cccc",
  ]);
});

test("the same advisory is reported once when npm lists several affected ranges", () => {
  const result = evaluateDependencyAudit({
    audit: auditWith(highAdvisory, { ...highAdvisory, range: "<1.5.0" }),
    exceptions: [],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.unapproved.length, 1);
});

test("a complete unexpired exception approves only its exact advisory and package", () => {
  const result = evaluateDependencyAudit({
    audit: auditWith(highAdvisory),
    exceptions: [
      {
        advisory: "GHSA-aaaa-bbbb-cccc",
        package: "example-package",
        dependencyPath: "root > build-tool > example-package",
        exposure: "Build-time only; input is repository-controlled.",
        reason: "No compatible patched release is available.",
        upstream: "https://github.com/example/package/issues/123",
        owner: "@mobile-maintainers",
        expiresOn: "2026-08-01",
      },
    ],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.approved.map(({ advisory }) => advisory), [
    "GHSA-aaaa-bbbb-cccc",
  ]);
});

test("an expired exception cannot suppress a high-severity advisory", () => {
  const result = evaluateDependencyAudit({
    audit: auditWith(highAdvisory),
    exceptions: [
      {
        advisory: "GHSA-aaaa-bbbb-cccc",
        package: "example-package",
        dependencyPath: "root > build-tool > example-package",
        exposure: "Build-time only; input is repository-controlled.",
        reason: "No compatible patched release is available.",
        upstream: "https://github.com/example/package/issues/123",
        owner: "@mobile-maintainers",
        expiresOn: "2026-07-14",
      },
    ],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.equal(result.unapproved[0].advisory, "GHSA-aaaa-bbbb-cccc");
});

test("a stale exception fails after its advisory disappears", () => {
  const result = evaluateDependencyAudit({
    audit: { vulnerabilities: {} },
    exceptions: [
      {
        advisory: "GHSA-aaaa-bbbb-cccc",
        package: "example-package",
        dependencyPath: "root > build-tool > example-package",
        exposure: "Build-time only; input is repository-controlled.",
        reason: "No compatible patched release is available.",
        upstream: "https://github.com/example/package/issues/123",
        owner: "@mobile-maintainers",
        expiresOn: "2026-08-01",
      },
    ],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidExceptions, [
    {
      advisory: "GHSA-aaaa-bbbb-cccc",
      package: "example-package",
      problem: "advisory is not present in the current audit",
    },
  ]);
});

test("an exception with incomplete review metadata fails the policy", () => {
  const result = evaluateDependencyAudit({
    audit: auditWith(highAdvisory),
    exceptions: [
      {
        advisory: "GHSA-aaaa-bbbb-cccc",
        package: "example-package",
        expiresOn: "2026-08-01",
      },
    ],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidExceptions, [
    {
      advisory: "GHSA-aaaa-bbbb-cccc",
      package: "example-package",
      problem:
        "missing required fields: dependencyPath, exposure, reason, upstream, owner",
    },
  ]);
});

test("scheduled npm updates are opened weekly for normal pull-request validation", () => {
  const dependabot = parse(
    readFileSync(new URL("../.github/dependabot.yml", import.meta.url), "utf8")
  );
  const npmUpdates = dependabot.updates.find(
    (update) => update["package-ecosystem"] === "npm"
  );

  assert.equal(npmUpdates.directory, "/");
  assert.equal(npmUpdates.schedule.interval, "weekly");
  assert.ok(npmUpdates.groups["compatible-production-updates"]);
  assert.ok(npmUpdates.groups["compatible-development-updates"]);
});

test("an exception requires an exact ISO calendar expiry date", () => {
  const result = evaluateDependencyAudit({
    audit: auditWith(highAdvisory),
    exceptions: [
      {
        advisory: "GHSA-aaaa-bbbb-cccc",
        package: "example-package",
        dependencyPath: "root > build-tool > example-package",
        exposure: "Build-time only; input is repository-controlled.",
        reason: "No compatible patched release is available.",
        upstream: "https://github.com/example/package/issues/123",
        owner: "@mobile-maintainers",
        expiresOn: "soon",
      },
    ],
    now: new Date("2026-07-15T00:00:00.000Z"),
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.invalidExceptions, [
    {
      advisory: "GHSA-aaaa-bbbb-cccc",
      package: "example-package",
      problem: "expiresOn must be a valid YYYY-MM-DD calendar date",
    },
  ]);
});
