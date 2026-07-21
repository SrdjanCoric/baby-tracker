const keys = new Set([
  "EXPO_PUBLIC_SUPABASE_URL",
  "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS",
]);

module.exports = function inlineE2EEnv({ types }, options) {
  const values = options.values ?? {};

  for (const key of keys) {
    if (typeof values[key] !== "string" || values[key].length === 0) {
      throw new Error(`Missing E2E environment value: ${key}`);
    }
  }

  return {
    name: "inline-sofibaby-e2e-environment",
    visitor: {
      MemberExpression(path) {
        if (!path.get("object").matchesPattern("process.env")) return;

        const key = path.toComputedKey();
        if (!types.isStringLiteral(key) || !keys.has(key.value)) return;

        path.replaceWith(types.stringLiteral(values[key.value]));
      },
    },
  };
};
