import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { pathToFileURL, URL } from "node:url";

const BLOCKING_SEVERITIES = new Set(["high", "critical"]);

function advisoryId(url) {
  return url.split("/").at(-1);
}

const REQUIRED_EXCEPTION_FIELDS = [
  "advisory",
  "package",
  "dependencyPaths",
  "exposure",
  "reason",
  "upstream",
  "owner",
  "expiresOn",
];

function missingExceptionFields(exception) {
  return REQUIRED_EXCEPTION_FIELDS.filter((field) => {
    if (field === "dependencyPaths") {
      return (
        !Array.isArray(exception.dependencyPaths) ||
        exception.dependencyPaths.length === 0 ||
        exception.dependencyPaths.some(
          (path) => typeof path !== "string" || path.trim() === ""
        )
      );
    }
    return (
      typeof exception[field] !== "string" || exception[field].trim() === ""
    );
  });
}

function dependencyPathsMatch(exception, finding) {
  const reviewed = [...new Set(exception.dependencyPaths)].sort();
  const current = [...new Set(finding.nodes)].sort();
  return (
    reviewed.length === current.length &&
    reviewed.every((path, index) => path === current[index])
  );
}

function isCompleteException(exception) {
  return missingExceptionFields(exception).length === 0;
}

function isIsoCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().startsWith(value);
}

export function evaluateDependencyAudit({
  audit,
  exceptions,
  now = new Date(),
}) {
  const reportedFindings = Object.values(audit.vulnerabilities ?? {}).flatMap(
    (vulnerability) =>
      vulnerability.via
        .filter(
          (via) =>
            typeof via === "object" &&
            BLOCKING_SEVERITIES.has(via.severity)
        )
        .map((via) => ({
          advisory: advisoryId(via.url),
          package: vulnerability.name,
          severity: via.severity,
          title: via.title,
          url: via.url,
          nodes: vulnerability.nodes,
        }))
  );
  const findings = [
    ...new Map(
      reportedFindings.map((finding) => [
        `${finding.advisory}:${finding.package}`,
        finding,
      ])
    ).values(),
  ];
  const today = now.toISOString().slice(0, 10);
  const validExceptions = exceptions.filter(
    (exception) =>
      isCompleteException(exception) &&
      isIsoCalendarDate(exception.expiresOn) &&
      exception.expiresOn >= today
  );
  const approved = findings.filter((finding) =>
    validExceptions.some(
      (exception) =>
        exception.advisory === finding.advisory &&
        exception.package === finding.package &&
        dependencyPathsMatch(exception, finding)
    )
  );
  const unapproved = findings.filter(
    (finding) => !approved.includes(finding)
  );
  const incompleteExceptions = exceptions
    .map((exception) => ({
      exception,
      missing: missingExceptionFields(exception),
    }))
    .filter(({ missing }) => missing.length > 0)
    .map(({ exception, missing }) => ({
      advisory: exception.advisory,
      package: exception.package,
      problem: `missing required fields: ${missing.join(", ")}`,
    }));
  const invalidDateExceptions = exceptions
    .filter(
      (exception) =>
        isCompleteException(exception) &&
        !isIsoCalendarDate(exception.expiresOn)
    )
    .map((exception) => ({
      advisory: exception.advisory,
      package: exception.package,
      problem: "expiresOn must be a valid YYYY-MM-DD calendar date",
    }));
  const expiredExceptions = exceptions
    .filter(
      (exception) =>
        isCompleteException(exception) &&
        isIsoCalendarDate(exception.expiresOn) &&
        exception.expiresOn < today
    )
    .map((exception) => ({
      advisory: exception.advisory,
      package: exception.package,
      problem: `exception expired on ${exception.expiresOn}`,
    }));
  const changedPathExceptions = validExceptions
    .flatMap((exception) => {
      const finding = findings.find(
        (candidate) =>
          exception.advisory === candidate.advisory &&
          exception.package === candidate.package
      );
      if (!finding || dependencyPathsMatch(exception, finding)) {
        return [];
      }

      return [
        {
          advisory: exception.advisory,
          package: exception.package,
          problem: `dependency paths changed; reviewed: ${[...new Set(exception.dependencyPaths)].sort().join(", ")}; current: ${[...new Set(finding.nodes)].sort().join(", ")}`,
        },
      ];
    });
  const staleExceptions = validExceptions
    .filter(
      (exception) =>
        !findings.some(
          (finding) =>
            exception.advisory === finding.advisory &&
            exception.package === finding.package
        )
    )
    .map((exception) => ({
      advisory: exception.advisory,
      package: exception.package,
      problem: "advisory is not present in the current audit",
    }));
  const invalidExceptions = [
    ...incompleteExceptions,
    ...invalidDateExceptions,
    ...expiredExceptions,
    ...changedPathExceptions,
    ...staleExceptions,
  ];

  return {
    ok: unapproved.length === 0 && invalidExceptions.length === 0,
    approved,
    unapproved,
    invalidExceptions,
  };
}

function runAudit() {
  const auditRun = spawnSync("npm", ["audit", "--json"], {
    encoding: "utf8",
  });

  if (auditRun.error) {
    throw auditRun.error;
  }

  let audit;
  try {
    audit = JSON.parse(auditRun.stdout);
  } catch {
    throw new Error(
      `npm audit did not return valid JSON. ${auditRun.stderr.trim()}`
    );
  }

  if (!audit.vulnerabilities || audit.error) {
    const detail = audit.error?.summary ?? auditRun.stderr.trim();
    throw new Error(`npm audit failed to produce a report. ${detail}`);
  }

  return audit;
}

function printResult(result) {
  for (const finding of result.unapproved) {
    console.error(
      `${finding.severity.toUpperCase()} ${finding.advisory}: ${finding.package} — ${finding.title}`
    );
    console.error(`  ${finding.nodes.join(", ")}`);
    console.error(`  ${finding.url}`);
  }

  for (const exception of result.invalidExceptions) {
    console.error(
      `INVALID EXCEPTION ${exception.advisory ?? "unknown"} (${exception.package ?? "unknown"}): ${exception.problem}`
    );
  }

  if (result.approved.length > 0) {
    console.log(
      `${result.approved.length} high-severity finding(s) covered by active exceptions.`
    );
  }

  if (result.ok) {
    console.log("Dependency audit passed: no unapproved high or critical advisories.");
  }
}

function main() {
  const policy = JSON.parse(
    readFileSync(
      new URL("../.github/dependency-audit-exceptions.json", import.meta.url),
      "utf8"
    )
  );
  const result = evaluateDependencyAudit({
    audit: runAudit(),
    exceptions: policy.exceptions,
  });

  printResult(result);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
