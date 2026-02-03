import { vi } from "vitest";
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
