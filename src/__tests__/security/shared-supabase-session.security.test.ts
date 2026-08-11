import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const here = import.meta.url;
const read = (relative: string) =>
  readFileSync(new URL(relative, here), "utf8");

const widgetIndex = read("../../../targets/widget/index.swift");
const widgetAdapters = read("../../../targets/widget/SharedSupabaseSessionAdapters.swift");
const widgetDataService = read("../../../src/services/widget-data-service.ts");
const appSupabaseModule = read(
  "../../../plugins/with-shared-supabase-session/ios/SharedSupabaseSession.swift"
);
const appJson = read("../../../app.json");
const widgetTargetConfig = read("../../../targets/widget/expo-target.config.js");

describe("shared Supabase session credential storage", () => {
  it("keeps no bearer access token in the Widget App Group UserDefaults", () => {
    expect(widgetIndex).not.toContain("supabaseAccessToken");
    expect(widgetIndex).not.toMatch(/userDefaults\.string\(forKey:\s*"supabaseAccessToken"\)/);
  });

  it("does not publish the access token from the app into the Widget App Group", () => {
    expect(widgetDataService).not.toContain('extensionStorage.set("supabaseAccessToken"');
  });

  it("never writes a refresh token to the App Group UserDefaults", () => {
    expect(widgetDataService).not.toContain('extensionStorage.set("refresh_token"');
    expect(widgetIndex).not.toMatch(/userDefaults\.set\([^)]*refresh_token/);
  });

  it("stores the shared session in a Keychain access group shared only by the app and Widget", () => {
    for (const source of [appSupabaseModule, widgetAdapters]) {
      expect(source).toContain("kSecAttrAccessGroup");
      expect(source).toContain("kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly");
      expect(source).toContain("743WPPWD3W.com.sofibaby.shared-session");
      expect(source).not.toContain("kSecAttrAccessibleAlways");
      expect(source).not.toContain("kSecAttrSynchronizable");
    }
  });

  it("declares the shared Keychain access group in both app and Widget entitlements", () => {
    expect(appJson).toContain('"keychain-access-groups"');
    expect(appJson).toContain("743WPPWD3W.com.sofibaby.shared-session");
    expect(widgetTargetConfig).toContain("keychain-access-groups");
    expect(widgetTargetConfig).toContain("743WPPWD3W.com.sofibaby.shared-session");
  });

  it("serializes app and Widget refreshes through a cross-process POSIX lock", () => {
    for (const source of [appSupabaseModule, widgetAdapters]) {
      expect(source).toContain("flock");
      expect(source).toContain("forSecurityApplicationGroupIdentifier");
    }
  });
});