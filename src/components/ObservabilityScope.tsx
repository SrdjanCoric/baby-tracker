import { useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { useSync } from "@/contexts/sync-context";
import { setObservabilityTag, setObservabilityUser } from "@/services/observability";

/**
 * Mirrors auth and sync state into crash-report tags. Renders nothing and
 * never gates children, so it cannot affect what the user sees.
 */
export function ObservabilityScope() {
  const { user } = useAuth();
  const { isInitialized } = useSync();

  useEffect(() => {
    setObservabilityUser(
      user ? { id: user.id, householdId: user.householdId, isOwner: user.isOwner } : null
    );
  }, [user?.householdId, user?.id, user?.isOwner, user]);

  useEffect(() => {
    setObservabilityTag("sync_initialized", isInitialized);
  }, [isInitialized]);

  return null;
}
