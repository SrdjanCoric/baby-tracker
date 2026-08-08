import { Platform } from "react-native";

export interface ExtensionStorageAdapter {
  set: (key: string, value: string, groupId: string) => Promise<void>;
  get: (key: string, groupId: string) => Promise<string | null>;
  remove: (key: string, groupId: string) => Promise<void>;
  reloadWidget: () => Promise<void>;
}

let extensionStorageModule: ExtensionStorageAdapter | null = null;

export async function loadExtensionStorage(): Promise<ExtensionStorageAdapter | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (extensionStorageModule) {
    return extensionStorageModule;
  }

  try {
    const appleTargets = await import("@bacons/apple-targets");
    if (!appleTargets.ExtensionStorage) {
      return null;
    }

    extensionStorageModule = {
      set: async (key: string, value: string, groupId: string) => {
        const storage = new appleTargets.ExtensionStorage(groupId);
        await storage.set(key, value);
      },
      get: async (key: string, groupId: string) => {
        const storage = new appleTargets.ExtensionStorage(groupId);
        return storage.get(key);
      },
      remove: async (key: string, groupId: string) => {
        const storage = new appleTargets.ExtensionStorage(groupId);
        storage.remove(key);
      },
      reloadWidget: async () => {
        await appleTargets.ExtensionStorage.reloadWidget();
      },
    };
    return extensionStorageModule;
  } catch (error) {
    console.log("[WidgetDataService] ExtensionStorage not available:", error);
    return null;
  }
}
