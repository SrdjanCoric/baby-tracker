import React, { createContext, useContext, useEffect, useCallback, useMemo, useState } from "react";
import { UnitStorageService } from "@/services/unit-storage";
import {
  type UnitSystem,
  getWeightUnit,
  getHeightUnit,
  getVolumeUnit,
  DEFAULT_UNIT_SYSTEM,
} from "@/utils/units";

export { type UnitSystem };

interface UnitContextValue {
  unitSystem: UnitSystem;
  weightUnit: "kg" | "lbs";
  heightUnit: "cm" | "in";
  volumeUnit: "ml" | "oz";
  isLoading: boolean;
  setUnitSystem: (system: UnitSystem) => Promise<void>;
}

const UnitContext = createContext<UnitContextValue | null>(null);

export function UnitProvider({ children }: { children: React.ReactNode }) {
  const [unitSystem, setUnitSystemState] = useState<UnitSystem>(DEFAULT_UNIT_SYSTEM);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPreference = async () => {
      const storedSystem = await UnitStorageService.getUnitSystem();
      setUnitSystemState(storedSystem);
      setIsLoading(false);
    };
    loadPreference();
  }, []);

  const handleSetUnitSystem = useCallback(async (newSystem: UnitSystem) => {
    await UnitStorageService.setUnitSystem(newSystem);
    setUnitSystemState(newSystem);
  }, []);

  const weightUnit = getWeightUnit(unitSystem);
  const heightUnit = getHeightUnit(unitSystem);
  const volumeUnit = getVolumeUnit(unitSystem);

  const value: UnitContextValue = useMemo(() => ({
    unitSystem,
    weightUnit,
    heightUnit,
    volumeUnit,
    isLoading,
    setUnitSystem: handleSetUnitSystem,
  }), [unitSystem, weightUnit, heightUnit, volumeUnit, isLoading, handleSetUnitSystem]);

  return <UnitContext.Provider value={value}>{children}</UnitContext.Provider>;
}

export function useUnits(): UnitContextValue {
  const context = useContext(UnitContext);
  if (!context) {
    throw new Error("useUnits must be used within a UnitProvider");
  }
  return context;
}
