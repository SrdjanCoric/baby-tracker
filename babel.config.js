module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      [
        "module-resolver",
        {
          root: ["."],
          alias: {
            "@": "./src",
            "@components": "./src/components",
            "@screens": "./src/screens",
            "@navigation": "./src/navigation",
            "@hooks": "./src/hooks",
            "@utils": "./src/utils",
            "@services": "./src/services",
            "@types": "./src/types",
            "@constants": "./src/constants",
            "@contexts": "./src/contexts",
            "@validators": "./src/validators",
            "@i18n": "./src/i18n",
          },
        },
      ],
      "react-native-reanimated/plugin",
    ],
  };
};
