module.exports = function (api) {
  api.cache.using(() => process.env.SOFIBABY_E2E_LOCAL_ENV ?? "0");
  const e2ePlugins =
    process.env.SOFIBABY_E2E_LOCAL_ENV === "1"
      ? [
          [
            require("./e2e/scripts/babel-inline-e2e-env.cjs"),
            {
              values: {
                EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
                EXPO_PUBLIC_SUPABASE_ANON_KEY:
                  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
                EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS:
                  process.env.EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS,
              },
            },
          ],
        ]
      : [];

  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      ...e2ePlugins,
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
