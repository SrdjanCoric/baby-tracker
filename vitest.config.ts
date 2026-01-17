import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/__tests__/**", "e2e/**", "**/*.component.test.tsx"],
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@screens": path.resolve(__dirname, "./src/screens"),
      "@navigation": path.resolve(__dirname, "./src/navigation"),
      "@hooks": path.resolve(__dirname, "./src/hooks"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@services": path.resolve(__dirname, "./src/services"),
      "@types": path.resolve(__dirname, "./src/types"),
      "@constants": path.resolve(__dirname, "./src/constants"),
      "@contexts": path.resolve(__dirname, "./src/contexts"),
      "@validators": path.resolve(__dirname, "./src/validators"),
      "@i18n": path.resolve(__dirname, "./src/i18n"),
    },
  },
});
