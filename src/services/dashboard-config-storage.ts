import AsyncStorage from "@react-native-async-storage/async-storage";
import { ActivityType } from "@/constants/activities";

const DASHBOARD_CONFIG_KEY = "@dashboard_config";

export interface DashboardCardConfig {
  activity: ActivityType;
  visible: boolean;
  order: number;
}

export interface DashboardConfig {
  version: number;
  cards: DashboardCardConfig[];
  lastModified: string;
}

export const DEFAULT_DASHBOARD_CONFIG: DashboardConfig = {
  version: 1,
  cards: [
    { activity: "feeding", visible: true, order: 0 },
    { activity: "sleep", visible: true, order: 1 },
    { activity: "diaper", visible: true, order: 2 },
    { activity: "pumping", visible: true, order: 3 },
    { activity: "tummyTime", visible: true, order: 4 },
    { activity: "growth", visible: true, order: 5 },
  ],
  lastModified: new Date().toISOString(),
};

function isValidDashboardConfig(config: unknown): config is DashboardConfig {
  if (!config || typeof config !== "object") return false;
  const c = config as Record<string, unknown>;
  if (typeof c.version !== "number") return false;
  if (!Array.isArray(c.cards)) return false;
  if (typeof c.lastModified !== "string") return false;
  return c.cards.every((card: unknown) => {
    if (!card || typeof card !== "object") return false;
    const cardObj = card as Record<string, unknown>;
    return (
      typeof cardObj.activity === "string" &&
      typeof cardObj.visible === "boolean" &&
      typeof cardObj.order === "number"
    );
  });
}

export const DashboardConfigStorageService = {
  async getConfig(): Promise<DashboardConfig> {
    const stored = await AsyncStorage.getItem(DASHBOARD_CONFIG_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (isValidDashboardConfig(parsed)) {
          return parsed;
        }
      } catch {
        // Invalid JSON, return default
      }
    }
    return { ...DEFAULT_DASHBOARD_CONFIG, lastModified: new Date().toISOString() };
  },

  async setConfig(config: DashboardConfig): Promise<void> {
    const updated = { ...config, lastModified: new Date().toISOString() };
    await AsyncStorage.setItem(DASHBOARD_CONFIG_KEY, JSON.stringify(updated));
  },

  async updateCardVisibility(activity: ActivityType, visible: boolean): Promise<DashboardConfig> {
    const config = await this.getConfig();
    const updatedCards = config.cards.map((card) =>
      card.activity === activity ? { ...card, visible } : card
    );
    const updatedConfig = { ...config, cards: updatedCards };
    await this.setConfig(updatedConfig);
    return updatedConfig;
  },

  async reorderCards(cards: DashboardCardConfig[]): Promise<DashboardConfig> {
    const config = await this.getConfig();
    const reorderedCards = cards.map((card, index) => ({ ...card, order: index }));
    const updatedConfig = { ...config, cards: reorderedCards };
    await this.setConfig(updatedConfig);
    return updatedConfig;
  },

  async resetToDefault(): Promise<DashboardConfig> {
    const defaultConfig = { ...DEFAULT_DASHBOARD_CONFIG, lastModified: new Date().toISOString() };
    await this.setConfig(defaultConfig);
    return defaultConfig;
  },

  async clearConfig(): Promise<void> {
    await AsyncStorage.removeItem(DASHBOARD_CONFIG_KEY);
  },
};
