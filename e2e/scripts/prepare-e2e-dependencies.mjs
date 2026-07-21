#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { prepareDatePickerCodegenConfig } from "./lib/household-runner.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "../..");
const packagePath = path.join(
  projectDir,
  "node_modules",
  "react-native-date-picker",
  "package.json"
);
const backupPath = process.argv[2];
if (!backupPath) {
  throw new Error("A dependency backup path is required");
}

const packageContents = fs.readFileSync(packagePath, "utf8");
fs.writeFileSync(backupPath, packageContents, { flag: "wx" });
const packageJson = JSON.parse(packageContents);

prepareDatePickerCodegenConfig(packageJson);
fs.writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
