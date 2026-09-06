import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";

export function SyncAuthGate({
  children,
  blockedFallback = null,
  initializingFallback = null,
}: {
  children: ReactNode;
  /** Shown while the authenticated user has no household to configure sync with. */
  blockedFallback?: ReactNode;
  /** Shown while the sync engine starts or reconfigures for a known household. */
  initializingFallback?: ReactNode;
}) {
  const { user } = useAuth();
  const { clearAuthContext, isInitialized, setAuthContext } = useSync();
  const identity = useMemo(() => {
    if (!user?.id || !user.householdId) return null;
    return {
      key: `${user.id}:${user.householdId}`,
      userId: user.id,
      householdId: user.householdId,
    };
  }, [user?.householdId, user?.id]);
  const [configuredIdentityKey, setConfiguredIdentityKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      clearAuthContext();
      setConfiguredIdentityKey(null);
      return;
    }

    if (identity && configuredIdentityKey !== identity.key) {
      setAuthContext(identity.householdId, identity.userId);
      setConfiguredIdentityKey(identity.key);
    }
  }, [clearAuthContext, configuredIdentityKey, identity, setAuthContext, user]);

  // Only a missing household needs the restoration fallback. Engine start-up
  // and identity reconfiguration are transient, and mounting the restoration
  // fallback there re-opened a finished restoration on every cold start.
  if (user && !identity) {
    return <>{blockedFallback}</>;
  }

  if (user && identity && (!isInitialized || configuredIdentityKey !== identity.key)) {
    return <>{initializingFallback}</>;
  }

  if (!user && configuredIdentityKey !== null) {
    return null;
  }

  return <>{children}</>;
}
