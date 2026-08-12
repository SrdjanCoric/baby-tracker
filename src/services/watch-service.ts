import { Platform } from "react-native";
import type { WidgetData, WatchData, WatchAuthContext } from "./widget-data-service";
import { loadSharedSupabaseSessionBridge } from "./shared-supabase-session-native";

type WatchPayload = Record<string, unknown>;

interface WatchConnectivityModule {
  updateApplicationContext: (context: WatchPayload) => void;
  getApplicationContext: () => Promise<WatchPayload | null>;
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
        getApplicationContext: connectivity.getApplicationContext,
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
const WATCH_SESSION_REFRESH_WINDOW_MS = 5 * 60 * 1000;

function parseWatchSession(capsuleJson: string | null): Record<string, unknown> | null {
  if (!capsuleJson) return null;
  try {
    const capsule = JSON.parse(capsuleJson) as Record<string, unknown>;
    if (typeof capsule.session !== "string") return null;
    return JSON.parse(capsule.session) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function watchSessionNeedsRefresh(capsuleJson: string | null): boolean {
  const session = parseWatchSession(capsuleJson);
  if (!session) return true;
  try {
    if (typeof session.expires_at !== "number" || !Number.isFinite(session.expires_at)) {
      return true;
    }
    return session.expires_at * 1000 <= Date.now() + WATCH_SESSION_REFRESH_WINDOW_MS;
  } catch {
    return true;
  }
}

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
 * The cache holds the signed-in session capsule so a language change can
 * republish it instead of erasing it. Once the session ends that capsule must not
 * be sent again: on a shared device the next caregiver changing language would
 * otherwise hand the Watch the previous account's still-valid credentials, and
 * the Watch treats any received credentials as fresh.
 */
export async function clearWatchContext(): Promise<void> {
  lastContext = null;
  const module = await getWatchConnectivityModule();
  module?.updateApplicationContext({ signedOut: true });
}

async function publishApplicationContext(context: WatchPayload): Promise<void> {
  const module = await getWatchConnectivityModule();
  if (!module) {
    return;
  }

  lastContext = context;
  module.updateApplicationContext(context);
}

/**
 * Refresh the phone-owned Supabase session and republish its latest capsule.
 *
 * WatchConnectivity can wake the companion app without mounting the normal UI,
 * so restore the last system-persisted application context instead of relying
 * only on this module's process-local cache.
 */
export async function refreshWatchCredentialsFromPhone(
  refreshSession: () => Promise<void>
): Promise<boolean> {
  const module = await getWatchConnectivityModule();
  const bridge = loadSharedSupabaseSessionBridge();
  if (!module || !bridge) return false;

  // A widget update published without an auth context overwrites the cache with a
  // credential-less payload, so fall back to the system-persisted context.
  const persistedContext = (lastContext?.userId ? lastContext : await module.getApplicationContext()) ?? {};
  if (persistedContext.signedOut === true) return false;
  if (
    typeof persistedContext.supabaseUrl !== "string" || !persistedContext.supabaseUrl ||
    typeof persistedContext.supabaseAnonKey !== "string" || !persistedContext.supabaseAnonKey ||
    typeof persistedContext.userId !== "string" || !persistedContext.userId
  ) {
    return false;
  }
  let sessionCapsule = await bridge.readSession();
  if (watchSessionNeedsRefresh(sessionCapsule)) {
    await refreshSession();
    sessionCapsule = await bridge.readSession();
  }
  if (!sessionCapsule) return false;

  const session = parseWatchSession(sessionCapsule);
  const sessionUser = session?.user;
  const sessionUserId = sessionUser && typeof sessionUser === "object"
    ? (sessionUser as Record<string, unknown>).id
    : null;
  if (typeof sessionUserId !== "string" || persistedContext.userId !== sessionUserId) {
    return false;
  }

  const context = { ...persistedContext, sessionCapsule };
  lastContext = context;
  module.updateApplicationContext(context);
  return true;
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
      context.userId = authContext.userId;
      const sessionCapsule = await loadSharedSupabaseSessionBridge()?.readSession();
      if (sessionCapsule) {
        context.sessionCapsule = sessionCapsule;
      }
      if (authContext.householdId) {
        context.householdId = authContext.householdId;
      }
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
