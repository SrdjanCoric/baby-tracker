import React, { createContext, useContext, useEffect, useCallback, useState, useMemo } from "react";
import { ActivityType } from "@/constants/activities";
import {
  DashboardConfigStorageService,
  DashboardConfig,
  DashboardCardConfig,
  DEFAULT_DASHBOARD_CONFIG,
} from "@/services/dashboard-config-storage";
import { canHideCard } from "@/utils/dashboard-layout";
import { useAuth } from "./auth-context";

interface DashboardConfigContextValue {
  config: DashboardConfig;
  visibleCards: DashboardCardConfig[];
  isLoading: boolean;
  setCardVisibility: (activity: ActivityType, visible: boolean) => Promise<boolean>;
  resetToDefault: () => Promise<void>;
}

const DashboardConfigContext = createContext<DashboardConfigContextValue | null>(null);

export function DashboardConfigProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [config, setConfig] = useState<DashboardConfig>(DEFAULT_DASHBOARD_CONFIG);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const loadConfig = async () => {
      setIsLoading(true);
      const storedConfig = await DashboardConfigStorageService.getConfig();
      const hasMilestones = storedConfig.cards.some((c) => c.activity === "milestones");
      if (!hasMilestones) {
        const maxOrder = Math.max(...storedConfig.cards.map((c) => c.order), -1);
        storedConfig.cards.push({ activity: "milestones", visible: true, order: maxOrder + 1 });
        await DashboardConfigStorageService.setConfig(storedConfig);
      }
      if (!cancelled) {
        setConfig(storedConfig);
        setIsLoading(false);
      }
    };
    loadConfig();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const visibleCards = useMemo(() => {
    return [...config.cards]
      .filter((card) => card.visible)
      .sort((a, b) => a.order - b.order);
  }, [config.cards]);

  const setCardVisibility = useCallback(
    async (activity: ActivityType, visible: boolean): Promise<boolean> => {
      if (!visible && !canHideCard(config.cards, activity)) {
        return false;
      }
      const updatedConfig = await DashboardConfigStorageService.updateCardVisibility(activity, visible);
      setConfig(updatedConfig);
      return true;
    },
    [config.cards]
  );

  const resetToDefault = useCallback(async () => {
    const defaultConfig = await DashboardConfigStorageService.resetToDefault();
    setConfig(defaultConfig);
  }, []);

  const value: DashboardConfigContextValue = useMemo(() => ({
    config,
    visibleCards,
    isLoading,
    setCardVisibility,
    resetToDefault,
  }), [config, visibleCards, isLoading, setCardVisibility, resetToDefault]);

  return (
    <DashboardConfigContext.Provider value={value}>
      {children}
    </DashboardConfigContext.Provider>
  );
}

export function useDashboardConfig(): DashboardConfigContextValue {
  const context = useContext(DashboardConfigContext);
  if (!context) {
    throw new Error("useDashboardConfig must be used within a DashboardConfigProvider");
  }
  return context;
}
