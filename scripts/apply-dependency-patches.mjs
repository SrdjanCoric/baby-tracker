import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const EXPECTED_DATE_PICKER_VERSION = "5.0.13";
const EXPECTED_COMPONENT_PROVIDER = "RNDatePicker";
const INVALID_MODULE_PROVIDER = "RNDatePickerManager";

export function patchDatePickerCodegenMetadata(
  packagePath = require.resolve("react-native-date-picker/package.json")
) {
  const packageJson = JSON.parse(readFileSync(packagePath, "utf8"));

  if (
    packageJson.name !== "react-native-date-picker" ||
    packageJson.version !== EXPECTED_DATE_PICKER_VERSION
  ) {
    throw new Error(
      `Unsupported react-native-date-picker package: ${packageJson.name}@${packageJson.version}`
    );
  }

  const iosCodegen = packageJson.codegenConfig?.ios;
  if (iosCodegen?.componentProvider?.RNDatePicker !== EXPECTED_COMPONENT_PROVIDER) {
    throw new Error("Unexpected react-native-date-picker component provider");
  }

  const moduleProvider = iosCodegen.modulesProvider?.RNDatePicker;
  if (moduleProvider === undefined) return false;
  if (moduleProvider !== INVALID_MODULE_PROVIDER) {
    throw new Error(
      `Unexpected react-native-date-picker module provider: ${moduleProvider}`
    );
  }

  delete iosCodegen.modulesProvider.RNDatePicker;
  if (Object.keys(iosCodegen.modulesProvider).length === 0) {
    delete iosCodegen.modulesProvider;
  }

  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  patchDatePickerCodegenMetadata();
}
