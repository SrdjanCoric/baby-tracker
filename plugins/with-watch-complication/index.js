const {
  withDangerousMod,
  withMod,
  BaseMods,
  IOSConfig,
} = require("@expo/config-plugins");
const xcode = require("xcode");
const fs = require("fs");
const path = require("path");

const TARGET_NAME = "SofiBabyWatchComplication";
const BUNDLE_ID = "com.sofibaby.app.watch.watchwidget";
const WATCH_TARGET_NAME = "SofiBabyWatch";
const MOD_NAME = "watchComplicationXcodeProject";

function registerWithEAS(config) {
  if (!config.extra) config.extra = {};
  if (!config.extra.eas) config.extra.eas = {};
  if (!config.extra.eas.build) config.extra.eas.build = {};
  if (!config.extra.eas.build.experimental)
    config.extra.eas.build.experimental = {};
  if (!config.extra.eas.build.experimental.ios)
    config.extra.eas.build.experimental.ios = {};
  if (!config.extra.eas.build.experimental.ios.appExtensions)
    config.extra.eas.build.experimental.ios.appExtensions = [];

  const extensions = config.extra.eas.build.experimental.ios.appExtensions;
  if (!extensions.some((ext) => ext.targetName === TARGET_NAME)) {
    extensions.push({
      bundleIdentifier: BUNDLE_ID,
      targetName: TARGET_NAME,
      entitlements: {
        "com.apple.security.application-groups": ["group.com.sofibaby.app"],
      },
    });
  }

  return config;
}

function withWatchComplication(config) {
  config = registerWithEAS(config);

  config = withDangerousMod(config, [
    "ios",
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const platformProjectRoot = config.modRequest.platformProjectRoot;

      const targetDir = path.join(platformProjectRoot, TARGET_NAME);
      const sourceDir = path.join(
        projectRoot,
        "plugins",
        "with-watch-complication",
        "watchos"
      );

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.copyFileSync(
        path.join(sourceDir, "Complication.swift"),
        path.join(targetDir, "Complication.swift")
      );
      fs.copyFileSync(
        path.join(sourceDir, "Info.plist"),
        path.join(targetDir, "Info.plist")
      );
      fs.copyFileSync(
        path.join(sourceDir, "Complication.entitlements"),
        path.join(targetDir, "Complication.entitlements")
      );
      copyDirectorySync(
        path.join(sourceDir, "Assets.xcassets"),
        path.join(targetDir, "Assets.xcassets")
      );
      console.log(`[WatchComplication] Copied source files`);
      return config;
    },
  ]);

  config = withMod(config, {
    platform: "ios",
    mod: MOD_NAME,
    async action(config) {
      const project = config.modResults;

      const nativeTargets = project.pbxNativeTargetSection();
      for (const key in nativeTargets) {
        if (key.endsWith("_comment")) continue;
        if (nativeTargets[key]?.name === TARGET_NAME) {
          const target = nativeTargets[key];
          if (
            target.fileSystemSynchronizedGroups &&
            target.fileSystemSynchronizedGroups.length > 0
          ) {
            console.log(
              `[WatchComplication] Removing fileSystemSynchronizedGroups from existing target`
            );
            delete target.fileSystemSynchronizedGroups;
          }
          addEmbedAndDependency(project, nativeTargets, key);
          fixWidgetTargetPlatforms(project, nativeTargets);
          console.log(`[WatchComplication] Fixed existing target`);
          return config;
        }
      }

      createComplicationTarget(project, nativeTargets);
      fixWidgetTargetPlatforms(project, nativeTargets);
      return config;
    },
  });

  config = BaseMods.withGeneratedBaseMods(config, {
    platform: "ios",
    saveToInternal: true,
    skipEmptyMod: false,
    providers: {
      [MOD_NAME]: BaseMods.provider({
        isIntrospective: false,
        async getFilePath({ modRequest, _internal }) {
          return IOSConfig.Paths.getPBXProjectPath(
            _internal?.projectRoot || modRequest.projectRoot
          );
        },
        async read(filePath) {
          const proj = xcode.project(filePath);
          proj.parseSync();
          return proj;
        },
        async write(filePath, { modResults, modRequest: { introspect } }) {
          if (introspect) return;
          const contents = modResults.writeSync();
          if (contents && contents.trim().length) {
            await fs.promises.writeFile(filePath, contents);
          }
        },
      }),
    },
  });

  return config;
}

function createComplicationTarget(project, nativeTargets) {
  const swiftFileRefUuid = project.generateUuid();
  const swiftBuildFileUuid = project.generateUuid();
  const infoPlistFileRefUuid = project.generateUuid();
  const entitlementsFileRefUuid = project.generateUuid();
  const assetsFileRefUuid = project.generateUuid();
  const assetsBuildFileUuid = project.generateUuid();
  const groupUuid = project.generateUuid();
  const targetUuid = project.generateUuid();
  const productFileRefUuid = project.generateUuid();
  const sourcesBuildPhaseUuid = project.generateUuid();
  const resourcesBuildPhaseUuid = project.generateUuid();
  const frameworksBuildPhaseUuid = project.generateUuid();
  const debugBuildConfigUuid = project.generateUuid();
  const releaseBuildConfigUuid = project.generateUuid();
  const buildConfigListUuid = project.generateUuid();
  const widgetKitFileRefUuid = project.generateUuid();
  const widgetKitBuildFileUuid = project.generateUuid();
  const swiftUIFileRefUuid = project.generateUuid();
  const swiftUIBuildFileUuid = project.generateUuid();

  const fileRefSection =
    project.hash.project.objects["PBXFileReference"];
  const buildFileSection =
    project.hash.project.objects["PBXBuildFile"];
  const groupSection = project.hash.project.objects["PBXGroup"];

  fileRefSection[swiftFileRefUuid] = {
    isa: "PBXFileReference",
    fileEncoding: 4,
    lastKnownFileType: "sourcecode.swift",
    path: "Complication.swift",
    sourceTree: '"<group>"',
  };
  fileRefSection[`${swiftFileRefUuid}_comment`] = "Complication.swift";

  fileRefSection[infoPlistFileRefUuid] = {
    isa: "PBXFileReference",
    lastKnownFileType: "text.plist.xml",
    path: "Info.plist",
    sourceTree: '"<group>"',
  };
  fileRefSection[`${infoPlistFileRefUuid}_comment`] = "Info.plist";

  fileRefSection[entitlementsFileRefUuid] = {
    isa: "PBXFileReference",
    lastKnownFileType: "text.plist.entitlements",
    path: "Complication.entitlements",
    sourceTree: '"<group>"',
  };
  fileRefSection[`${entitlementsFileRefUuid}_comment`] =
    "Complication.entitlements";

  fileRefSection[assetsFileRefUuid] = {
    isa: "PBXFileReference",
    lastKnownFileType: "folder.assetcatalog",
    path: "Assets.xcassets",
    sourceTree: '"<group>"',
  };
  fileRefSection[`${assetsFileRefUuid}_comment`] = "Assets.xcassets";

  fileRefSection[productFileRefUuid] = {
    isa: "PBXFileReference",
    explicitFileType: '"wrapper.app-extension"',
    includeInIndex: 0,
    path: `${TARGET_NAME}.appex`,
    sourceTree: "BUILT_PRODUCTS_DIR",
  };
  fileRefSection[`${productFileRefUuid}_comment`] = `${TARGET_NAME}.appex`;

  fileRefSection[widgetKitFileRefUuid] = {
    isa: "PBXFileReference",
    lastKnownFileType: "wrapper.framework",
    name: "WidgetKit.framework",
    path: "System/Library/Frameworks/WidgetKit.framework",
    sourceTree: "SDKROOT",
  };
  fileRefSection[`${widgetKitFileRefUuid}_comment`] = "WidgetKit.framework";

  fileRefSection[swiftUIFileRefUuid] = {
    isa: "PBXFileReference",
    lastKnownFileType: "wrapper.framework",
    name: "SwiftUI.framework",
    path: "System/Library/Frameworks/SwiftUI.framework",
    sourceTree: "SDKROOT",
  };
  fileRefSection[`${swiftUIFileRefUuid}_comment`] = "SwiftUI.framework";

  groupSection[groupUuid] = {
    isa: "PBXGroup",
    children: [
      { value: swiftFileRefUuid, comment: "Complication.swift" },
      { value: infoPlistFileRefUuid, comment: "Info.plist" },
      { value: entitlementsFileRefUuid, comment: "Complication.entitlements" },
      { value: assetsFileRefUuid, comment: "Assets.xcassets" },
    ],
    name: TARGET_NAME,
    path: TARGET_NAME,
    sourceTree: '"<group>"',
  };
  groupSection[`${groupUuid}_comment`] = TARGET_NAME;

  const mainGroup = project.getFirstProject().firstProject.mainGroup;
  if (groupSection[mainGroup]?.children) {
    groupSection[mainGroup].children.push({
      value: groupUuid,
      comment: TARGET_NAME,
    });
  }

  const productsGroupKey =
    project.getFirstProject().firstProject.productRefGroup;
  if (groupSection[productsGroupKey]?.children) {
    groupSection[productsGroupKey].children.push({
      value: productFileRefUuid,
      comment: `${TARGET_NAME}.appex`,
    });
  }

  buildFileSection[swiftBuildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: swiftFileRefUuid,
    fileRef_comment: "Complication.swift",
  };
  buildFileSection[`${swiftBuildFileUuid}_comment`] =
    "Complication.swift in Sources";

  buildFileSection[assetsBuildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: assetsFileRefUuid,
    fileRef_comment: "Assets.xcassets",
  };
  buildFileSection[`${assetsBuildFileUuid}_comment`] =
    "Assets.xcassets in Resources";

  buildFileSection[widgetKitBuildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: widgetKitFileRefUuid,
    fileRef_comment: "WidgetKit.framework",
  };
  buildFileSection[`${widgetKitBuildFileUuid}_comment`] =
    "WidgetKit.framework in Frameworks";

  buildFileSection[swiftUIBuildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: swiftUIFileRefUuid,
    fileRef_comment: "SwiftUI.framework",
  };
  buildFileSection[`${swiftUIBuildFileUuid}_comment`] =
    "SwiftUI.framework in Frameworks";

  const sourcesBuildPhase =
    project.hash.project.objects["PBXSourcesBuildPhase"];
  sourcesBuildPhase[sourcesBuildPhaseUuid] = {
    isa: "PBXSourcesBuildPhase",
    buildActionMask: 2147483647,
    files: [
      { value: swiftBuildFileUuid, comment: "Complication.swift in Sources" },
    ],
    runOnlyForDeploymentPostprocessing: 0,
  };
  sourcesBuildPhase[`${sourcesBuildPhaseUuid}_comment`] = "Sources";

  const resourcesBuildPhase =
    project.hash.project.objects["PBXResourcesBuildPhase"];
  resourcesBuildPhase[resourcesBuildPhaseUuid] = {
    isa: "PBXResourcesBuildPhase",
    buildActionMask: 2147483647,
    files: [
      { value: assetsBuildFileUuid, comment: "Assets.xcassets in Resources" },
    ],
    runOnlyForDeploymentPostprocessing: 0,
  };
  resourcesBuildPhase[`${resourcesBuildPhaseUuid}_comment`] = "Resources";

  const frameworksBuildPhase =
    project.hash.project.objects["PBXFrameworksBuildPhase"];
  frameworksBuildPhase[frameworksBuildPhaseUuid] = {
    isa: "PBXFrameworksBuildPhase",
    buildActionMask: 2147483647,
    files: [
      {
        value: widgetKitBuildFileUuid,
        comment: "WidgetKit.framework in Frameworks",
      },
      {
        value: swiftUIBuildFileUuid,
        comment: "SwiftUI.framework in Frameworks",
      },
    ],
    runOnlyForDeploymentPostprocessing: 0,
  };
  frameworksBuildPhase[`${frameworksBuildPhaseUuid}_comment`] = "Frameworks";

  const sharedBuildSettings = {
    ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME: "AccentColor",
    CLANG_ANALYZER_NONNULL: "YES",
    CLANG_ANALYZER_NUMBER_OBJECT_CONVERSION: "YES_AGGRESSIVE",
    CLANG_CXX_LANGUAGE_STANDARD: '"gnu++20"',
    CLANG_ENABLE_OBJC_WEAK: "YES",
    CLANG_WARN_DOCUMENTATION_COMMENTS: "YES",
    CLANG_WARN_QUOTED_INCLUDE_IN_FRAMEWORK_HEADER: "YES",
    CLANG_WARN_UNGUARDED_AVAILABILITY: "YES_AGGRESSIVE",
    CODE_SIGN_ENTITLEMENTS: `${TARGET_NAME}/Complication.entitlements`,
    CODE_SIGN_STYLE: "Automatic",
    CURRENT_PROJECT_VERSION: 1,
    DEVELOPMENT_TEAM: "743WPPWD3W",
    GENERATE_INFOPLIST_FILE: "YES",
    INFOPLIST_FILE: `${TARGET_NAME}/Info.plist`,
    INFOPLIST_KEY_CFBundleDisplayName: TARGET_NAME,
    INFOPLIST_KEY_NSHumanReadableCopyright: '""',
    LD_RUNPATH_SEARCH_PATHS:
      '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
    MARKETING_VERSION: "1.0",
    PRODUCT_BUNDLE_IDENTIFIER: `"${BUNDLE_ID}"`,
    PRODUCT_NAME: `"$(TARGET_NAME)"`,
    SDKROOT: "watchos",
    SKIP_INSTALL: "YES",
    SUPPORTED_PLATFORMS: '"watchos watchsimulator"',
    SUPPORTS_MACCATALYST: "NO",
    SWIFT_EMIT_LOC_STRINGS: "YES",
    SWIFT_VERSION: "5.0",
    TARGETED_DEVICE_FAMILY: 4,
    WATCHOS_DEPLOYMENT_TARGET: "10.0",
  };

  const buildConfigSection =
    project.hash.project.objects["XCBuildConfiguration"];
  buildConfigSection[debugBuildConfigUuid] = {
    isa: "XCBuildConfiguration",
    buildSettings: {
      ...sharedBuildSettings,
      DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
      MTL_ENABLE_DEBUG_INFO: "INCLUDE_SOURCE",
      SWIFT_ACTIVE_COMPILATION_CONDITIONS: '"DEBUG"',
      SWIFT_OPTIMIZATION_LEVEL: '"-Onone"',
    },
    name: "Debug",
  };
  buildConfigSection[`${debugBuildConfigUuid}_comment`] = "Debug";

  buildConfigSection[releaseBuildConfigUuid] = {
    isa: "XCBuildConfiguration",
    buildSettings: {
      ...sharedBuildSettings,
      COPY_PHASE_STRIP: "NO",
      DEBUG_INFORMATION_FORMAT: '"dwarf-with-dsym"',
      SWIFT_OPTIMIZATION_LEVEL: '"-O"',
    },
    name: "Release",
  };
  buildConfigSection[`${releaseBuildConfigUuid}_comment`] = "Release";

  const buildConfigListSection =
    project.hash.project.objects["XCConfigurationList"];
  buildConfigListSection[buildConfigListUuid] = {
    isa: "XCConfigurationList",
    buildConfigurations: [
      { value: debugBuildConfigUuid, comment: "Debug" },
      { value: releaseBuildConfigUuid, comment: "Release" },
    ],
    defaultConfigurationIsVisible: 0,
    defaultConfigurationName: "Release",
  };
  buildConfigListSection[`${buildConfigListUuid}_comment`] =
    `Build configuration list for PBXNativeTarget "${TARGET_NAME}"`;

  const nativeTargetSection =
    project.hash.project.objects["PBXNativeTarget"];
  nativeTargetSection[targetUuid] = {
    isa: "PBXNativeTarget",
    buildConfigurationList: buildConfigListUuid,
    buildConfigurationList_comment: `Build configuration list for PBXNativeTarget "${TARGET_NAME}"`,
    buildPhases: [
      { value: sourcesBuildPhaseUuid, comment: "Sources" },
      { value: frameworksBuildPhaseUuid, comment: "Frameworks" },
      { value: resourcesBuildPhaseUuid, comment: "Resources" },
    ],
    buildRules: [],
    dependencies: [],
    name: TARGET_NAME,
    productName: TARGET_NAME,
    productReference: productFileRefUuid,
    productReference_comment: `${TARGET_NAME}.appex`,
    productType: '"com.apple.product-type.app-extension"',
  };
  nativeTargetSection[`${targetUuid}_comment`] = TARGET_NAME;

  const projectObj = project.getFirstProject().firstProject;
  if (projectObj.targets) {
    projectObj.targets.push({
      value: targetUuid,
      comment: TARGET_NAME,
    });
  }

  addEmbedAndDependency(project, nativeTargetSection, targetUuid);
  console.log(`[WatchComplication] Created ${TARGET_NAME} target`);
}

function addEmbedAndDependency(
  project,
  nativeTargetSection,
  complicationTargetUuid
) {
  let watchTargetKey = null;
  for (const key in nativeTargetSection) {
    if (key.endsWith("_comment")) continue;
    if (nativeTargetSection[key]?.name === WATCH_TARGET_NAME) {
      watchTargetKey = key;
      break;
    }
  }

  if (!watchTargetKey) {
    console.warn(
      `[WatchComplication] Could not find ${WATCH_TARGET_NAME} target`
    );
    return;
  }

  const watchTarget = nativeTargetSection[watchTargetKey];
  const complicationTarget = nativeTargetSection[complicationTargetUuid];

  const alreadyEmbedded = watchTarget.buildPhases?.some((phase) => {
    const phaseKey = phase.value || phase;
    const copyPhases =
      project.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
    const cp = copyPhases[phaseKey];
    if (!cp) return false;
    return cp.files?.some((f) => {
      const comment = f.comment || "";
      return comment.includes(TARGET_NAME);
    });
  });

  if (alreadyEmbedded) {
    console.log(
      `[WatchComplication] Already embedded in ${WATCH_TARGET_NAME}`
    );
    return;
  }

  const productFileRefUuid = complicationTarget.productReference;
  const embedBuildFileUuid = project.generateUuid();
  const embedBuildPhaseUuid = project.generateUuid();
  const targetDependencyUuid = project.generateUuid();
  const containerItemProxyUuid = project.generateUuid();

  const buildFileSection = project.hash.project.objects["PBXBuildFile"];
  buildFileSection[embedBuildFileUuid] = {
    isa: "PBXBuildFile",
    fileRef: productFileRefUuid,
    fileRef_comment: `${TARGET_NAME}.appex`,
    settings: { ATTRIBUTES: ["RemoveHeadersOnCopy"] },
  };
  buildFileSection[`${embedBuildFileUuid}_comment`] =
    `${TARGET_NAME}.appex in Embed Foundation Extensions`;

  const containerItemProxy =
    project.hash.project.objects["PBXContainerItemProxy"] || {};
  project.hash.project.objects["PBXContainerItemProxy"] = containerItemProxy;

  containerItemProxy[containerItemProxyUuid] = {
    isa: "PBXContainerItemProxy",
    containerPortal: project.getFirstProject().uuid,
    containerPortal_comment: "Project object",
    proxyType: 1,
    remoteGlobalIDString: complicationTargetUuid,
    remoteInfo: TARGET_NAME,
  };
  containerItemProxy[`${containerItemProxyUuid}_comment`] =
    "PBXContainerItemProxy";

  const targetDependencySection =
    project.hash.project.objects["PBXTargetDependency"] || {};
  project.hash.project.objects["PBXTargetDependency"] =
    targetDependencySection;

  targetDependencySection[targetDependencyUuid] = {
    isa: "PBXTargetDependency",
    target: complicationTargetUuid,
    target_comment: TARGET_NAME,
    targetProxy: containerItemProxyUuid,
    targetProxy_comment: "PBXContainerItemProxy",
  };
  targetDependencySection[`${targetDependencyUuid}_comment`] =
    "PBXTargetDependency";

  if (!watchTarget.dependencies) {
    watchTarget.dependencies = [];
  }
  watchTarget.dependencies.push({
    value: targetDependencyUuid,
    comment: "PBXTargetDependency",
  });

  const copyFilesBuildPhase =
    project.hash.project.objects["PBXCopyFilesBuildPhase"] || {};
  project.hash.project.objects["PBXCopyFilesBuildPhase"] =
    copyFilesBuildPhase;

  copyFilesBuildPhase[embedBuildPhaseUuid] = {
    isa: "PBXCopyFilesBuildPhase",
    buildActionMask: 2147483647,
    dstPath: '""',
    dstSubfolderSpec: 13,
    files: [
      {
        value: embedBuildFileUuid,
        comment: `${TARGET_NAME}.appex in Embed Foundation Extensions`,
      },
    ],
    name: '"Embed Foundation Extensions"',
    runOnlyForDeploymentPostprocessing: 0,
  };
  copyFilesBuildPhase[`${embedBuildPhaseUuid}_comment`] =
    "Embed Foundation Extensions";

  watchTarget.buildPhases.push({
    value: embedBuildPhaseUuid,
    comment: "Embed Foundation Extensions",
  });

  console.log(
    `[WatchComplication] Embedded in ${WATCH_TARGET_NAME} with dependency`
  );
}

function fixWidgetTargetPlatforms(project, nativeTargets) {
  const WIDGET_TARGET_NAME = "SofiBabyWidget";
  let widgetConfigListUuid = null;

  for (const key in nativeTargets) {
    if (key.endsWith("_comment")) continue;
    if (nativeTargets[key]?.name === WIDGET_TARGET_NAME) {
      widgetConfigListUuid = nativeTargets[key].buildConfigurationList;
      break;
    }
  }

  if (!widgetConfigListUuid) return;

  const configListSection =
    project.hash.project.objects["XCConfigurationList"];
  const configList = configListSection[widgetConfigListUuid];
  if (!configList?.buildConfigurations) return;

  const buildConfigSection =
    project.hash.project.objects["XCBuildConfiguration"];

  for (const configRef of configList.buildConfigurations) {
    const configUuid = configRef.value || configRef;
    const config = buildConfigSection[configUuid];
    if (!config?.buildSettings) continue;

    if (!config.buildSettings.SDKROOT) {
      config.buildSettings.SDKROOT = "iphoneos";
    }
    if (!config.buildSettings.SUPPORTED_PLATFORMS) {
      config.buildSettings.SUPPORTED_PLATFORMS =
        '"iphoneos iphonesimulator"';
    }
  }

  console.log(
    `[WatchComplication] Fixed ${WIDGET_TARGET_NAME} platform settings`
  );
}

function copyDirectorySync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirectorySync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = withWatchComplication;
