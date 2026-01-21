import AsyncStorage from "@react-native-async-storage/async-storage";
import { isValidUnitSystem, DEFAULT_UNIT_SYSTEM, type UnitSystem } from "@/utils/units";

const UNIT_SYSTEM_KEY = "@unit_system";

export type { UnitSystem };

export const UnitStorageService = {
  async getUnitSystem(): Promise<UnitSystem> {
    const stored = await AsyncStorage.getItem(UNIT_SYSTEM_KEY);
    if (stored && isValidUnitSystem(stored)) {
      return stored;
    }
    return DEFAULT_UNIT_SYSTEM;
  },

  async setUnitSystem(system: UnitSystem): Promise<void> {
    await AsyncStorage.setItem(UNIT_SYSTEM_KEY, system);
  },

  async clearUnitSystem(): Promise<void> {
    await AsyncStorage.removeItem(UNIT_SYSTEM_KEY);
  },
};
