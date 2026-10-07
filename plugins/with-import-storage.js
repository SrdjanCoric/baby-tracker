const { withGradleProperties } = require("@expo/config-plugins");

module.exports = function withImportStorage(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (property) => property.key !== "AsyncStorage_db_size_in_MB"
    );
    config.modResults.push({
      type: "property",
      key: "AsyncStorage_db_size_in_MB",
      value: "64",
    });
    return config;
  });
};
