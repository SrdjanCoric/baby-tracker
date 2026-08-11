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
  it("does not publish a NEW access token from the app into the Widget App Group (legacy read fallback is bounded to one release)", () => {
    // The app must NOT write `supabaseAccessToken` into App Group UserDefaults
    // anymore — that path put a bearer JWT in unencrypted shared storage,
    // included in backups, readable by every target.
    expect(widgetDataService).not.toContain('extensionStorage.set("supabaseAccessToken"');
    // The widget may READ the legacy App Group `supabaseAccessToken` ONLY as a
    // backward-compatibility fallback, when the shared Keychain capsule has
    // not been written yet (post-app-update, pre-first-app-launch window). It
    // must never WRITE / SET that key, and the app must purge it on its first
    // launch after upgrade (see `purgeLegacyAppGroupAccessToken`).
    expect(widgetIndex).not.toContain("userDefaults.set(\"supabaseAccessToken\"");
    expect(widgetIndex).not.toMatch(/userDefaults\.set\([^)]*supabaseAccessToken/);
  });

  it("purges the legacy App Group `supabaseAccessToken` bearer on app start-up", () => {
    // AC: no bearer token remains in App Group `UserDefaults`. Previous
    // versions wrote the access token there; the app must remove it on each
    // iOS launch (bounded to one release — the fallback in the widget reads
    // it only between an app update and the first app launch).
    expect(widgetDataService).toContain("export async function purgeLegacyAppGroupAccessToken");
    expect(widgetDataService).toContain('LEGACY_APP_GROUP_ACCESS_TOKEN_KEY = "supabaseAccessToken"');
    expect(widgetDataService).toMatch(/extensionStorage\.remove\(LEGACY_APP_GROUP_ACCESS_TOKEN_KEY/);
  });

  it("purges a Keychain capsule left by a previous owner on the first post-reinstall launch", () => {
    // iOS keeps `kSecClassGenericPassword` items across uninstall; without a
    // first-launch purge a reinstalled copy would silently restore the prior
    // owner's session. The app uses the native bridge's `removeSession` and an
    // AsyncStorage one-shot marker so subsequent launches keep a legitimate
    // session.
    expect(widgetDataService).toContain("export async function purgeStaleSharedSessionOnFirstLaunch");
    expect(widgetDataService).toContain('SHARED_SESSION_FIRST_LAUNCH_PURGE_MARKER_KEY');
    expect(widgetDataService).toMatch(/bridge\.removeSession\(\)/);
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