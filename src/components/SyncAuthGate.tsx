import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";

export function SyncAuthGate({
  children,
  blockedFallback = null,
}: {
  children: ReactNode;
  blockedFallback?: ReactNode;
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

  if (user && (!identity || !isInitialized || configuredIdentityKey !== identity.key)) {
    return <>{blockedFallback}</>;
  }

  if (!user && configuredIdentityKey !== null) {
    return null;
  }

  return <>{children}</>;
}
