module.exports = ({ config }) => {
  const googleServicesFile =
    process.env.GOOGLE_SERVICES_JSON ?? config.android.googleServicesFile;

  config.android.googleServicesFile = googleServicesFile;

  config.plugins = config.plugins.map((plugin) =>
    Array.isArray(plugin) &&
    plugin[0] === "@react-native-google-signin/google-signin"
      ? [plugin[0], { ...plugin[1], googleServicesFile }]
      : plugin,
  );

  return config;
};
