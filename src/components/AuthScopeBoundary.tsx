import React from "react";
import { useAuth } from "@/contexts/auth-context";

export function AuthScopeBoundary({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const authScope = user
    ? `${user.id}:${user.householdId ?? "no-household"}`
    : "guest";

  return <React.Fragment key={authScope}>{children}</React.Fragment>;
}
