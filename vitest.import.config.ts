import config from "./vitest.config";

export default {
  ...config,
  test: {
    ...config.test,
    include: ["src/services/import/import-sync.test.ts"],
    exclude: [],
  },
};
