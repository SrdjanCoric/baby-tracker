const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const FILE_NAME = "RCTSwitchComponentView+EventEmitterGuard.mm";

function withSwitchEventEmitterGuard(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const { projectRoot, platformProjectRoot, projectName } = config.modRequest;
      const sourcePath = path.join(projectRoot, "plugins", "with-switch-event-emitter-guard", "ios", FILE_NAME);
      const targetPath = path.join(platformProjectRoot, projectName, FILE_NAME);
      fs.copyFileSync(sourcePath, targetPath);
      console.log(`[SwitchEventEmitterGuard] Copied ${FILE_NAME}`);
      return config;
    },
  ]);

  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;
    const filePath = `${projectName}/${FILE_NAME}`;
    if (xcodeProject.hasFile(filePath)) return config;

    const pbxGroupSection = xcodeProject.hash.project.objects["PBXGroup"];
    let appGroupKey = xcodeProject.getFirstProject().firstProject.mainGroup;
    for (const key in pbxGroupSection) {
      if (key.endsWith("_comment")) continue;
      const group = pbxGroupSection[key];
      if (group && (group.name === projectName || group.path === projectName)) {
        appGroupKey = key;
        break;
      }
    }
    const target = xcodeProject.getFirstTarget();
    xcodeProject.addSourceFile(
      filePath,
      { target: target.uuid, lastKnownFileType: "sourcecode.cpp.objcpp" },
      appGroupKey
    );
    console.log(`[SwitchEventEmitterGuard] Added ${FILE_NAME} to ${projectName} target`);
    return config;
  });

  return config;
}

module.exports = withSwitchEventEmitterGuard;
