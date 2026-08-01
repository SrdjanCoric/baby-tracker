import { Platform } from "react-native";
import { loadExtensionStorage } from "@/services/extension-storage";
import type { LanguageCode } from "./language-storage";
import { setWatchLanguage } from "./watch-service";

const APP_GROUP = "group.com.sofibaby.app";

export const NATIVE_LANGUAGE_KEY = "appLanguage";

// The stored preference is "system" whenever the caregiver never chose a language,
// which is no help to a native target. Only a resolved, region-preserving code is
// ever published, so the type excludes "system" rather than relying on callers.
export type NativeLanguage = Exclude<LanguageCode, "system">;

/**
 * Give the Watch and the widget the language the caregiver selected in the app.
 *
 * The two surfaces need different transports: the widget shares this device's App
 * Group, while the Watch is separate hardware reachable only through the
 * WatchConnectivity application context.
 */
export async function publishNativeLanguage(language: NativeLanguage): Promise<void> {
  if (Platform.OS !== "ios") {
    return;
  }

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.set(NATIVE_LANGUAGE_KEY, language, APP_GROUP);
      await extensionStorage.reloadWidget();
    }
  } catch (error) {
    console.error("[NativeLanguageService] Failed to publish language to the widget:", error);
  }

  try {
    await setWatchLanguage(language);
  } catch (error) {
    console.error("[NativeLanguageService] Failed to publish language to the watch:", error);
  }
}
