const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

function with16KBPages(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const buildGradlePath = path.join(
        config.modRequest.platformProjectRoot,
        "build.gradle"
      );

      let content = fs.readFileSync(buildGradlePath, "utf8");

      const snippet = `
subprojects { subproject ->
    def addPageSizeFlag = {
        def hasAndroidPlugin = subproject.plugins.hasPlugin('com.android.library') ||
            subproject.plugins.hasPlugin('com.android.application')
        if (hasAndroidPlugin) {
            try {
                def cmake = subproject.android.externalNativeBuild.cmake
                if (cmake.path != null) {
                    subproject.android.defaultConfig.externalNativeBuild.cmake.arguments.with {
                        if (!it.any { arg -> arg.startsWith('-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES') }) {
                            it.add('-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON')
                        }
                    }
                }
            } catch (Exception ignored) {}
            try {
                def ndkBuild = subproject.android.externalNativeBuild.ndkBuild
                if (ndkBuild.path != null) {
                    subproject.android.defaultConfig.externalNativeBuild.ndkBuild.arguments.with {
                        if (!it.any { arg -> arg.startsWith('APP_SUPPORT_FLEXIBLE_PAGE_SIZES') }) {
                            it.add('APP_SUPPORT_FLEXIBLE_PAGE_SIZES=true')
                        }
                    }
                }
            } catch (Exception ignored) {}
        }
    }
    if (subproject.state.executed) {
        addPageSizeFlag()
    } else {
        subproject.afterEvaluate { addPageSizeFlag() }
    }
}`;

      if (!content.includes("FLEXIBLE_PAGE_SIZES")) {
        content = content.trimEnd() + "\n" + snippet + "\n";
        fs.writeFileSync(buildGradlePath, content);
        console.log("[16KB Pages] Injected 16KB page alignment flags for all native subprojects");
      }

      return config;
    },
  ]);
}

module.exports = with16KBPages;
