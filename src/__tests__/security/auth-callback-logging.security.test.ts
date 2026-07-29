import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const callbackSources = [
  new URL("../../../app/login-callback.tsx", import.meta.url),
  new URL("../../../app/_layout.tsx", import.meta.url),
];

const restorationSources = [
  new URL("../../../app/onboarding/owner/restore.tsx", import.meta.url),
  new URL("../../components/ReturningUserProfileFallback.tsx", import.meta.url),
  new URL("../../services/returning-user-restoration.ts", import.meta.url),
];

describe("authentication callback logging", () => {
  it("never sends callback URLs or parsed authentication parameters to logs", () => {
    for (const sourceUrl of callbackSources) {
      const source = readFileSync(sourceUrl, "utf8");
      expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*(?:url|params|token|code)/i);
    }
  });

  it("never logs restored family or baby data", () => {
    for (const sourceUrl of restorationSources) {
      expect(readFileSync(sourceUrl, "utf8")).not.toMatch(/console\.(?:log|error)/);
    }
  });
});
