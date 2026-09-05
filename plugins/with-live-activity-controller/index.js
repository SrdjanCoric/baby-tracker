const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withLiveActivityControllerAndroid(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;

      const sourceDir = path.join(
        projectRoot,
        "plugins",
        "with-live-activity-controller",
        "android"
      );

      const targetDir = path.join(
        platformProjectRoot,
        "app",
        "src",
        "main",
        "java",
        "com",
        "sofibaby",
        "app"
      );

      const filesToCopy = [
        "LiveActivityControllerModule.kt",
        "LiveActivityControllerPackage.kt",
      ];

      for (const file of filesToCopy) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[LiveActivityController:android] Copied ${file}`);
        } else {
          console.warn(
            `[LiveActivityController:android] Source file not found: ${sourcePath}`
          );
        }
      }

      const mainAppPath = path.join(targetDir, "MainApplication.kt");
      if (fs.existsSync(mainAppPath)) {
        let content = fs.readFileSync(mainAppPath, "utf8");
        const registration = "add(LiveActivityControllerPackage())";

        if (!content.includes(registration)) {
          content = content.replace(
            /PackageList\(this\)\.packages\.apply\s*\{[^}]*\}/,
            `PackageList(this).packages.apply {\n              ${registration}\n            }`
          );
          fs.writeFileSync(mainAppPath, content);
          console.log(
            "[LiveActivityController:android] Registered package in MainApplication.kt"
          );
        }
      }

      return config;
    },
  ]);
}

function withLiveActivityController(config) {
  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;
      const projectName = config.modRequest.projectName;

      const targetDir = path.join(platformProjectRoot, projectName);
      const sourceDir = path.join(
        projectRoot,
        "plugins",
        "with-live-activity-controller",
        "ios"
      );

      const filesToCopy = [
        "LiveActivityController.swift",
        "LiveActivityController.m",
        "TimerActivityAttributes.swift",
        "LiveActivityPushTokenStore.swift",
      ];

      for (const file of filesToCopy) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[LiveActivityController] Copied ${file}`);
        } else {
          console.warn(`[LiveActivityController] Source file not found: ${sourcePath}`);
        }
      }

      const bridgingHeaderPath = path.join(
        targetDir,
        `${projectName}-Bridging-Header.h`
      );
      if (fs.existsSync(bridgingHeaderPath)) {
        let content = fs.readFileSync(bridgingHeaderPath, "utf8");
        const importLine = '#import <React/RCTBridgeModule.h>';
        if (!content.includes(importLine)) {
          content = content.trimEnd() + "\n" + importLine + "\n";
          fs.writeFileSync(bridgingHeaderPath, content);
          console.log("[LiveActivityController] Updated bridging header");
        }
      }

      return config;
    },
  ]);

  // Add files to Xcode project by modifying pbxproj directly
  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    const filesToAdd = [
      { name: "LiveActivityController.swift", type: "sourcecode.swift" },
      { name: "LiveActivityController.m", type: "sourcecode.c.objc" },
      { name: "TimerActivityAttributes.swift", type: "sourcecode.swift" },
      { name: "LiveActivityPushTokenStore.swift", type: "sourcecode.swift" },
    ];

    // Find the main app group
    const mainGroup = xcodeProject.getFirstProject().firstProject.mainGroup;
    const pbxGroupSection = xcodeProject.hash.project.objects["PBXGroup"];

    // Find the app group (SofiBabyTracker)
    let appGroupKey = null;
    for (const key in pbxGroupSection) {
      if (key.endsWith("_comment")) continue;
      const group = pbxGroupSection[key];
      if (group && (group.name === projectName || group.path === projectName)) {
        appGroupKey = key;
        break;
      }
    }

    if (!appGroupKey) {
      console.warn(`[LiveActivityController] Could not find app group, using main group`);
      appGroupKey = mainGroup;
    }

    // Find the main app target
    const nativeTargets = xcodeProject.pbxNativeTargetSection();
    let appTargetKey = null;
    let sourcesBuildPhaseKey = null;

    for (const key in nativeTargets) {
      if (key.endsWith("_comment")) continue;
      const target = nativeTargets[key];
      if (target && target.name === projectName) {
        appTargetKey = key;
        // Find Sources build phase
        if (target.buildPhases) {
          for (const phase of target.buildPhases) {
            const phaseKey = phase.value;
            if (xcodeProject.hash.project.objects["PBXSourcesBuildPhase"]?.[phaseKey]) {
              sourcesBuildPhaseKey = phaseKey;
              break;
            }
          }
        }
        break;
      }
    }

    if (!sourcesBuildPhaseKey) {
      console.warn(`[LiveActivityController] Could not find Sources build phase`);
      return config;
    }

    const fileRefSection = xcodeProject.hash.project.objects["PBXFileReference"];
    const buildFileSection = xcodeProject.hash.project.objects["PBXBuildFile"];
    const sourcesBuildPhase = xcodeProject.hash.project.objects["PBXSourcesBuildPhase"][sourcesBuildPhaseKey];
    const appGroup = pbxGroupSection[appGroupKey];

    for (const file of filesToAdd) {
      // Check if file already exists
      let existingFileRef = null;
      for (const key in fileRefSection) {
        if (key.endsWith("_comment")) continue;
        const ref = fileRefSection[key];
        if (ref && (ref.name === file.name || ref.path === file.name)) {
          existingFileRef = key;
          break;
        }
      }

      if (existingFileRef) {
        console.log(`[LiveActivityController] ${file.name} already in project`);
        continue;
      }

      // Generate UUIDs
      const fileRefUuid = xcodeProject.generateUuid();
      const buildFileUuid = xcodeProject.generateUuid();

      // Add file reference (path must include SofiBabyTracker/ prefix)
      fileRefSection[fileRefUuid] = {
        isa: "PBXFileReference",
        fileEncoding: 4,
        includeInIndex: 0,
        lastKnownFileType: file.type,
        name: file.name,
        path: `${projectName}/${file.name}`,
        sourceTree: '"<group>"',
      };
      fileRefSection[`${fileRefUuid}_comment`] = file.name;

      // Add to group
      if (appGroup && appGroup.children) {
        appGroup.children.push({
          value: fileRefUuid,
          comment: file.name,
        });
      }

      // Add build file
      buildFileSection[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
        fileRef_comment: file.name,
      };
      buildFileSection[`${buildFileUuid}_comment`] = `${file.name} in Sources`;

      // Add to sources build phase
      if (sourcesBuildPhase && sourcesBuildPhase.files) {
        sourcesBuildPhase.files.push({
          value: buildFileUuid,
          comment: `${file.name} in Sources`,
        });
      }

      console.log(`[LiveActivityController] Added ${file.name} to Xcode project`);
    }

    return config;
  });

  config = withLiveActivityControllerAndroid(config);

  return config;
}

module.exports = withLiveActivityController;
