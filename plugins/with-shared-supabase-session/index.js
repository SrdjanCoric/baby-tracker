const { withDangerousMod, withXcodeProject } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function withSharedSupabaseSessionIOS(config) {
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
        "with-shared-supabase-session",
        "ios"
      );

      const filesToCopy = [
        "SharedSupabaseSession.swift",
        "SharedSupabaseSessionLockCoordinator.swift",
        "SharedSupabaseSession.m",
      ];

      for (const file of filesToCopy) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);
        if (fs.existsSync(sourcePath)) {
          fs.copyFileSync(sourcePath, targetPath);
          console.log(`[SharedSupabaseSession] Copied ${file}`);
        } else {
          console.warn(`[SharedSupabaseSession] Source file not found: ${sourcePath}`);
        }
      }

      const bridgingHeaderPath = path.join(
        targetDir,
        `${projectName}-Bridging-Header.h`
      );
      if (fs.existsSync(bridgingHeaderPath)) {
        let content = fs.readFileSync(bridgingHeaderPath, "utf8");
        const importLine = "#import <React/RCTBridgeModule.h>";
        if (!content.includes(importLine)) {
          content = content.trimEnd() + "\n" + importLine + "\n";
          fs.writeFileSync(bridgingHeaderPath, content);
          console.log("[SharedSupabaseSession] Updated bridging header");
        }
      }

      return config;
    },
  ]);

  config = withXcodeProject(config, async (config) => {
    const xcodeProject = config.modResults;
    const projectName = config.modRequest.projectName;

    const filesToAdd = [
      { name: "SharedSupabaseSession.swift", type: "sourcecode.swift" },
      { name: "SharedSupabaseSessionLockCoordinator.swift", type: "sourcecode.swift" },
      { name: "SharedSupabaseSession.m", type: "sourcecode.c.objc" },
    ];

    const pbxGroupSection = xcodeProject.hash.project.objects["PBXGroup"];
    const nativeTargets = xcodeProject.pbxNativeTargetSection();
    const fileRefSection = xcodeProject.hash.project.objects["PBXFileReference"];
    const buildFileSection = xcodeProject.hash.project.objects["PBXBuildFile"];

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
      console.warn("[SharedSupabaseSession] Could not find app group");
      return config;
    }

    let sourcesBuildPhaseKey = null;
    for (const key in nativeTargets) {
      if (key.endsWith("_comment")) continue;
      const target = nativeTargets[key];
      if (target && target.name === projectName) {
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
      console.warn("[SharedSupabaseSession] Could not find Sources build phase");
      return config;
    }

    const sourcesBuildPhase =
      xcodeProject.hash.project.objects["PBXSourcesBuildPhase"][sourcesBuildPhaseKey];
    const appGroup = pbxGroupSection[appGroupKey];

    for (const file of filesToAdd) {
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
        console.log(`[SharedSupabaseSession] ${file.name} already in project`);
        continue;
      }

      const fileRefUuid = xcodeProject.generateUuid();
      const buildFileUuid = xcodeProject.generateUuid();

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

      if (appGroup && appGroup.children) {
        appGroup.children.push({ value: fileRefUuid, comment: file.name });
      }

      buildFileSection[buildFileUuid] = {
        isa: "PBXBuildFile",
        fileRef: fileRefUuid,
        fileRef_comment: file.name,
      };
      buildFileSection[`${buildFileUuid}_comment`] = `${file.name} in Sources`;

      if (sourcesBuildPhase && sourcesBuildPhase.files) {
        sourcesBuildPhase.files.push({
          value: buildFileUuid,
          comment: `${file.name} in Sources`,
        });
      }

      console.log(`[SharedSupabaseSession] Added ${file.name} to Xcode project`);
    }

    return config;
  });

  return config;
}

function withSharedSupabaseSession(config) {
  return withSharedSupabaseSessionIOS(config);
}

module.exports = withSharedSupabaseSession;
