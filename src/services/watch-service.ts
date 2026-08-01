import { Platform } from "react-native";
import type { WidgetData, WatchData, WatchAuthContext } from "./widget-data-service";

type WatchPayload = Record<string, unknown>;

interface WatchConnectivityModule {
  updateApplicationContext: (context: WatchPayload) => void;
  sendMessage: (
    message: WatchPayload,
    replyCb?: (reply: WatchPayload) => void,
    errCb?: (error: Error) => void
  ) => void;
  getReachability: () => Promise<boolean>;
  getIsWatchAppInstalled: () => Promise<boolean>;
}

let watchModule: WatchConnectivityModule | null = null;

async function getWatchConnectivityModule(): Promise<WatchConnectivityModule | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (watchModule) {
    return watchModule;
  }

  try {
    const connectivity = await import("react-native-watch-connectivity");
    if (connectivity?.updateApplicationContext && connectivity?.sendMessage) {
      watchModule = {
        updateApplicationContext: connectivity.updateApplicationContext,
        sendMessage: connectivity.sendMessage,
        getReachability: connectivity.getReachability,
        getIsWatchAppInstalled: connectivity.getIsWatchAppInstalled,
      };
      return watchModule;
    }
  } catch (error) {
    console.log("[WatchService] Watch connectivity not available:", error);
  }

  return null;
}

// The Watch is a separate device, so the App Group cannot carry the caregiver's
// language to it. It rides the application context instead. That context replaces
// the whole dictionary on every call, so a language-only update would erase the
// widget data and Supabase credentials the Watch depends on; a language change
// republishes the last context with the new value rather than a bare one.
let currentLanguage: string | null = null;
let lastContext: WatchPayload | null = null;

let languageAwaitingWatch = false;

export async function setWatchLanguage(language: string): Promise<void> {
  currentLanguage = language;

  const module = await getWatchConnectivityModule();
  if (!module) return;

  // The provider publishes during launch, while WCSession is still activating.
  // A context sent then is discarded and nothing reports the failure to JS, so
  // the language would be lost until some later sync happened to carry it.
  if (!(await watchCanReceive(module))) {
    languageAwaitingWatch = true;
    return;
  }

  // With no cached context there is nothing to preserve, so the language travels
  // on its own. The Watch persists credentials on receipt, so a context without
  // them does not revoke what it already stored.
  await publishApplicationContext(lastContext ? { ...lastContext, language } : { language });
}

/** Deliver a language that was set before the watch could receive it. */
export async function flushPendingWatchLanguage(): Promise<void> {
  if (!languageAwaitingWatch || !currentLanguage) return;
  languageAwaitingWatch = false;
  await setWatchLanguage(currentLanguage);
}

async function watchCanReceive(module: WatchConnectivityModule): Promise<boolean> {
  try {
    return await module.getIsWatchAppInstalled();
  } catch {
    return false;
  }
}

/**
 * Forget the cached application context.
 *
 * The cache holds the signed-in session's access token so a language change can
 * republish it instead of erasing it. Once the session ends that token must not
 * be sent again: on a shared device the next caregiver changing language would
 * otherwise hand the Watch the previous account's still-valid credentials, and
 * the Watch treats any received credentials as fresh.
 */
export function clearWatchContext(): void {
  lastContext = null;
}

async function publishApplicationContext(context: WatchPayload): Promise<void> {
  const module = await getWatchConnectivityModule();
  if (!module) {
    return;
  }

  lastContext = context;
  module.updateApplicationContext(context);
}

export async function syncToWatch(data: WidgetData, watchData?: WatchData, authContext?: WatchAuthContext): Promise<void> {
  const module = await getWatchConnectivityModule();
  if (!module) {
    return;
  }

  try {
    const context: WatchPayload = {
      widgetData: JSON.stringify(data),
    };

    if (currentLanguage) {
      context.language = currentLanguage;
    }

    if (watchData) {
      context.watchData = JSON.stringify(watchData);
    }

    if (authContext) {
      context.supabaseUrl = authContext.supabaseUrl;
      context.supabaseAnonKey = authContext.supabaseAnonKey;
      context.accessToken = authContext.accessToken;
      context.userId = authContext.userId;
      if (authContext.liveActivityPushToken) {
        context.liveActivityPushToken = authContext.liveActivityPushToken;
      }
      if (authContext.pushToStartToken) {
        context.pushToStartToken = authContext.pushToStartToken;
      }
    }

    lastContext = context;
    module.updateApplicationContext(context);
    console.log("[WatchService] Synced data to watch");
  } catch (error) {
    console.error("[WatchService] Failed to sync to watch:", error);
  }
}

export async function sendMessageToWatch(
  message: Record<string, unknown>
): Promise<Record<string, unknown> | null> {
  const module = await getWatchConnectivityModule();
  if (!module) {
    return null;
  }

  return new Promise((resolve) => {
    try {
      module.sendMessage(
        message,
        (reply) => {
          console.log("[WatchService] Message sent");
          resolve(reply);
        },
        (error) => {
          console.error("[WatchService] Failed to send message:", error);
          resolve(null);
        }
      );
    } catch (error) {
      console.error("[WatchService] Failed to send message:", error);
      resolve(null);
    }
  });
}

export async function isWatchReachable(): Promise<boolean> {
  const module = await getWatchConnectivityModule();
  if (!module) {
    return false;
  }

  try {
    return await module.getReachability();
  } catch (error) {
    console.error("[WatchService] Failed to check reachability:", error);
    return false;
  }
}

export type WatchReplyHandler = (reply: Record<string, unknown>) => void;
export type WatchMessageHandler = (message: Record<string, unknown>, replyHandler?: WatchReplyHandler) => void;

let messageHandler: WatchMessageHandler | null = null;

export function setWatchMessageHandler(handler: WatchMessageHandler): () => void {
  messageHandler = handler;

  return () => {
    messageHandler = null;
  };
}

export function handleWatchMessage(message: Record<string, unknown>, replyHandler?: WatchReplyHandler): void {
  if (messageHandler) {
    messageHandler(message, replyHandler);
  }
}

export async function startWatchMessageListening(): Promise<(() => void) | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  try {
    const connectivity = await import("react-native-watch-connectivity");
    if (!connectivity?.watchEvents) {
      return null;
    }

    const unsubscribeMessage = connectivity.watchEvents.addListener(
      "message",
      (payload, replyHandler) => {
        console.log("[WatchService] Received message from watch");
        handleWatchMessage(payload as Record<string, unknown>, replyHandler as WatchReplyHandler | undefined);
      }
    );

    const unsubscribeUserInfo = connectivity.watchEvents.addListener(
      "user-info",
      (userInfoArray) => {
        console.log("[WatchService] Received queued actions from watch");
        const items = Array.isArray(userInfoArray) ? userInfoArray : [userInfoArray];
        for (const userInfo of items) {
          handleWatchMessage(userInfo as Record<string, unknown>);
        }
      }
    );

    // The watch reports itself installed once its session is up, which is the
    // point a language held back during launch can actually be delivered.
    const unsubscribeInstalled = connectivity.watchEvents.addListener("installed", () => {
      void flushPendingWatchLanguage();
    });

    void flushPendingWatchLanguage();

    console.log("[WatchService] Watch message listening started");
    return () => {
      unsubscribeInstalled();
      unsubscribeMessage();
      unsubscribeUserInfo();
    };
  } catch (error) {
    console.log("[WatchService] Failed to start message listening:", error);
    return null;
  }
}
