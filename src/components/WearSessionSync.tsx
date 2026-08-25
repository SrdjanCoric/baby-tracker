import { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";

import { useAuth, useBaby } from "@/contexts";
import { supabase } from "@/services/supabase";
import { createWearSessionRefreshHandler } from "@/services/wear-session-handoff";
import {
  HANDLED_REFRESH_REVISION_KEY,
  loadWearSessionPhoneRuntime,
  wearSessionRevisionStore,
} from "@/services/wear-session-handoff-phone";

export function WearSessionSync(): null {
  const { isLoading: authLoading, session, user } = useAuth();
  const { isLoading: babyLoading, selectedBaby } = useBaby();
  const runtime = useMemo(loadWearSessionPhoneRuntime, []);
  const adapter = runtime?.adapter ?? null;
  const publisher = runtime?.publisher ?? null;
  const lastSignature = useRef<string | null>(null);
  const lastUserId = useRef<string | null>(null);
  const publishingSignature = useRef<string | null>(null);

  useEffect(() => {
    if (!adapter) return;
    const handleRequest = createWearSessionRefreshHandler(
      async () => {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) throw new Error("Phone session refresh failed");
      },
      wearSessionRevisionStore(HANDLED_REFRESH_REVISION_KEY)
    );
    const safelyHandle = (revision: number): Promise<void> =>
      handleRequest(revision).catch(() => {
        // The durable request remains pending and is retried on a later event or launch.
        console.warn("[WearSessionSync] Phone session refresh unavailable");
      });
    let pendingRead: Promise<void> | null = null;
    const readPending = (): Promise<void> => {
      if (pendingRead) return pendingRead;
      pendingRead = adapter
        .getPendingRefreshRequest()
        .then((revision) =>
          revision === null ? undefined : safelyHandle(revision)
        )
        .catch(() => {
          console.warn("[WearSessionSync] Pending refresh request unavailable");
        })
        .finally(() => {
          pendingRead = null;
        });
      return pendingRead;
    };
    const unsubscribe = adapter.subscribeRefreshRequests((revision) => {
      void safelyHandle(revision);
    });
    void readPending();
    const appStateSubscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void readPending();
    });
    return () => {
      unsubscribe();
      appStateSubscription.remove();
    };
  }, [adapter]);

  useEffect(() => {
    const target = publisher;
    if (!target || authLoading || babyLoading) return;
    if (!user || !session) return;

    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    const expiresAt = session.expires_at;
    if (!selectedBaby || !supabaseUrl || !supabaseAnonKey || !expiresAt) return;

    const accountChanged = lastUserId.current !== null && lastUserId.current !== user.id;
    const signature = [
      user.id,
      selectedBaby.id,
      session.access_token,
      expiresAt,
    ].join(":");
    if (
      lastSignature.current === signature ||
      publishingSignature.current === signature
    ) return;
    publishingSignature.current = signature;

    const publishActive = () => target.publishActive({
      account: {
        id: user.id,
        label: user.displayName ?? user.email ?? "Sofi Baby caregiver",
      },
      baby: {
        id: selectedBaby.id,
        name: selectedBaby.name,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
      },
      supabase: { url: supabaseUrl, anonKey: supabaseAnonKey },
      accessToken: session.access_token,
      expiresAt,
    });

    const publication = accountChanged
      ? target.publishInvalidated("account-switched").then(publishActive)
      : publishActive();
    void publication
      .then(() => {
        lastSignature.current = signature;
        lastUserId.current = user.id;
      })
      .catch(() => {
        console.warn("[WearSessionSync] Watch session publication unavailable");
      })
      .finally(() => {
        if (publishingSignature.current === signature) {
          publishingSignature.current = null;
        }
      });
  }, [
    authLoading,
    babyLoading,
    selectedBaby,
    session,
    user,
    publisher,
  ]);

  return null;
}

export function WearSessionInvalidationSync(): null {
  const { isLoading, user } = useAuth();
  const runtime = useMemo(loadWearSessionPhoneRuntime, []);
  const wasSignedOut = useRef(false);

  useEffect(() => {
    if (isLoading || !runtime) return;
    if (user) {
      wasSignedOut.current = false;
      return;
    }
    if (wasSignedOut.current) return;
    wasSignedOut.current = true;
    void runtime.publisher.publishInvalidated("signed-out").catch(() => {
      console.warn("[WearSessionSync] Watch invalidation unavailable");
    });
  }, [isLoading, runtime, user]);

  return null;
}
