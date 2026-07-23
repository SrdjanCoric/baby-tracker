#!/usr/bin/env node

const requiredJobs = [
  "quality",
  "unit-tests",
  "component-tests",
  "security-tests",
  "sync-tests",
  "sql-tests",
];
const results = new Map(
  process.argv.slice(2).map((result) => result.split("=", 2))
);
const failedJobs = requiredJobs
  .map((job) => `${job}=${results.get(job) ?? "missing"}`)
  .filter((result) => !result.endsWith("=success"));

if (failedJobs.length > 0) {
  console.error(
    `Required non-device jobs did not pass: ${failedJobs.join(", ")}`
  );
  process.exit(1);
}

console.log("All required non-device jobs passed.");
