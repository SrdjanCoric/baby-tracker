import { vi } from "vitest";
import { createHash, randomUUID } from "node:crypto";
import en from "./i18n/locales/en.json";

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split(".");
  let current: unknown = obj;
  for (const key of keys) {
    if (current && typeof current === "object" && key in current) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return path;
    }
  }
  return typeof current === "string" ? current : path;
}

vi.mock("@/i18n", () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      let value = getNestedValue(en as Record<string, unknown>, key);
      if (params && typeof value === "string") {
        for (const [paramKey, paramValue] of Object.entries(params)) {
          value = value.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, "g"), String(paramValue));
        }
      }
      return value;
    },
    language: "en",
    changeLanguage: vi.fn(),
  },
}));

// Native crypto boundary: exercise real SHA-256 semantics in Node tests.
vi.mock("expo-crypto", () => ({
  randomUUID: () => randomUUID(),
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (algorithm: string, value: string) =>
    createHash(algorithm).update(value).digest("hex"),
}));
