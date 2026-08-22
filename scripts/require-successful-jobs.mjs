#!/usr/bin/env node

const requiredJobs = ["changes", "quality", "dependency-audit", "android-native"];

// Jobs the `changes` filter may legitimately skip when a pull request touches no
// path they cover. Every other job must report success; a skip elsewhere means a
// dependency failed or was cancelled, which must not pass the gate.
const skippableJobs = new Set(["android-native"]);

const results = new Map(
  process.argv.slice(2).map((result) => result.split("=", 2))
);

const passed = (job) => {
  const result = results.get(job) ?? "missing";
  return result === "success" || (result === "skipped" && skippableJobs.has(job));
};

const failedJobs = requiredJobs
  .filter((job) => !passed(job))
  .map((job) => `${job}=${results.get(job) ?? "missing"}`);

if (failedJobs.length > 0) {
  console.error(
    `Required non-device jobs did not pass: ${failedJobs.join(", ")}`
  );
  process.exit(1);
}

const skipped = requiredJobs.filter((job) => results.get(job) === "skipped");
if (skipped.length > 0) {
  console.log(`Skipped by path filter: ${skipped.join(", ")}`);
}

console.log("All required non-device jobs passed.");
