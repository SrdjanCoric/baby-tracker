import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  GrowthStorageService,
  StoredGrowthEntry,
  CreateGrowthInput,
  UpdateGrowthInput,
} from "@/services/growth-storage";
import { useBaby } from "./baby-context";

export interface GrowthState {
  measurements: StoredGrowthEntry[];
  isLoading: boolean;
}

export type GrowthAction =
  | { type: "SET_MEASUREMENTS"; payload: StoredGrowthEntry[] }
  | { type: "ADD_MEASUREMENT"; payload: StoredGrowthEntry }
  | { type: "UPDATE_MEASUREMENT"; payload: StoredGrowthEntry }
  | { type: "DELETE_MEASUREMENT"; payload: string }
  | { type: "SET_LOADING"; payload: boolean };

export const initialGrowthState: GrowthState = {
  measurements: [],
  isLoading: true,
};

export function growthReducer(state: GrowthState, action: GrowthAction): GrowthState {
  switch (action.type) {
    case "SET_MEASUREMENTS":
      return { ...state, measurements: action.payload };

    case "ADD_MEASUREMENT":
      return { ...state, measurements: [...state.measurements, action.payload] };

    case "UPDATE_MEASUREMENT": {
      const updatedMeasurements = state.measurements.map((m) =>
        m.id === action.payload.id ? action.payload : m
      );
      return { ...state, measurements: updatedMeasurements };
    }

    case "DELETE_MEASUREMENT": {
      const filteredMeasurements = state.measurements.filter((m) => m.id !== action.payload);
      return { ...state, measurements: filteredMeasurements };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    default:
      return state;
  }
}

interface GrowthContextValue extends GrowthState {
  addMeasurement: (input: CreateGrowthInput) => Promise<StoredGrowthEntry>;
  updateMeasurement: (
    measurementId: string,
    input: UpdateGrowthInput
  ) => Promise<StoredGrowthEntry | null>;
  deleteMeasurement: (measurementId: string) => Promise<boolean>;
  refreshMeasurements: () => Promise<void>;
  getLastMeasurement: () => StoredGrowthEntry | null;
  getMeasurementHistory: (limit?: number) => StoredGrowthEntry[];
}

const GrowthContext = createContext<GrowthContextValue | null>(null);

export function GrowthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(growthReducer, initialGrowthState);
  const { selectedBaby } = useBaby();

  const loadMeasurements = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_MEASUREMENTS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    const measurements = await GrowthStorageService.getAllMeasurements(selectedBaby.id);
    dispatch({ type: "SET_MEASUREMENTS", payload: measurements });

    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby]);

  useEffect(() => {
    loadMeasurements();
  }, [loadMeasurements]);

  const addMeasurement = useCallback(
    async (input: CreateGrowthInput): Promise<StoredGrowthEntry> => {
      const measurement = await GrowthStorageService.addMeasurement(input);
      dispatch({ type: "ADD_MEASUREMENT", payload: measurement });
      return measurement;
    },
    []
  );

  const updateMeasurement = useCallback(
    async (
      measurementId: string,
      input: UpdateGrowthInput
    ): Promise<StoredGrowthEntry | null> => {
      if (!selectedBaby) return null;

      const updated = await GrowthStorageService.updateMeasurement(
        selectedBaby.id,
        measurementId,
        input
      );
      if (updated) {
        dispatch({ type: "UPDATE_MEASUREMENT", payload: updated });
      }
      return updated;
    },
    [selectedBaby]
  );

  const deleteMeasurement = useCallback(
    async (measurementId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      const result = await GrowthStorageService.deleteMeasurement(selectedBaby.id, measurementId);
      if (result) {
        dispatch({ type: "DELETE_MEASUREMENT", payload: measurementId });
      }
      return result;
    },
    [selectedBaby]
  );

  const getLastMeasurement = useCallback((): StoredGrowthEntry | null => {
    if (state.measurements.length === 0) return null;

    const sorted = [...state.measurements].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
    );
    return sorted[0];
  }, [state.measurements]);

  const getMeasurementHistory = useCallback(
    (limit?: number): StoredGrowthEntry[] => {
      const sorted = [...state.measurements].sort(
        (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
      );

      if (limit !== undefined) {
        return sorted.slice(0, limit);
      }

      return sorted;
    },
    [state.measurements]
  );

  const value: GrowthContextValue = {
    ...state,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
    refreshMeasurements: loadMeasurements,
    getLastMeasurement,
    getMeasurementHistory,
  };

  return <GrowthContext.Provider value={value}>{children}</GrowthContext.Provider>;
}

export function useGrowth(): GrowthContextValue {
  const context = useContext(GrowthContext);
  if (!context) {
    throw new Error("useGrowth must be used within a GrowthProvider");
  }
  return context;
}
