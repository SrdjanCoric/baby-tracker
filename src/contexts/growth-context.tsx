import React, { createContext, useContext, useReducer, useEffect, useCallback } from "react";
import {
  GrowthStorageService,
  StoredGrowthEntry,
  CreateGrowthInput,
  UpdateGrowthInput,
} from "@/services/growth-storage";
import {
  fetchGrowthFromDatabase,
  createGrowthInDatabase,
  updateGrowthInDatabase,
  deleteGrowthFromDatabase,
} from "@/services/activity-sync-service";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";

export interface GrowthState {
  measurements: StoredGrowthEntry[];
  isLoading: boolean;
}

export type GrowthAction =
  | { type: "SET_MEASUREMENTS"; payload: StoredGrowthEntry[] }
  | { type: "ADD_MEASUREMENT"; payload: StoredGrowthEntry }
  | { type: "UPDATE_MEASUREMENT"; payload: StoredGrowthEntry }
  | { type: "DELETE_MEASUREMENT"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredGrowthEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredGrowthEntry }
  | { type: "REMOTE_DELETE"; payload: string };

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

    case "REMOTE_INSERT": {
      const exists = state.measurements.some(m => m.id === action.payload.id);
      if (exists) return state;
      return { ...state, measurements: [...state.measurements, action.payload] };
    }

    case "REMOTE_UPDATE": {
      const updatedMeasurements = state.measurements.map(m =>
        m.id === action.payload.id ? action.payload : m
      );
      return { ...state, measurements: updatedMeasurements };
    }

    case "REMOTE_DELETE": {
      const filteredMeasurements = state.measurements.filter(m => m.id !== action.payload);
      return { ...state, measurements: filteredMeasurements };
    }

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
  getWeightChange: () => { change: number; hasPrevious: boolean } | null;
}

const GrowthContext = createContext<GrowthContextValue | null>(null);

export function GrowthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(growthReducer, initialGrowthState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges } = useSync();
  const { user } = useAuth();

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('growth_measurements', (change: RemoteChange) => {
      if (!selectedBaby) return;
      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) dispatch({ type: "REMOTE_INSERT", payload: transformGrowthFromRemote(change.new) });
          break;
        case 'UPDATE':
          if (change.new) dispatch({ type: "REMOTE_UPDATE", payload: transformGrowthFromRemote(change.new) });
          break;
        case 'DELETE':
          if (change.old?.id) dispatch({ type: "REMOTE_DELETE", payload: change.old.id as string });
          break;
      }
    });
    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadMeasurements = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_MEASUREMENTS", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    let measurements: StoredGrowthEntry[];

    if (user?.householdId) {
      try {
        measurements = await fetchGrowthFromDatabase(selectedBaby.id);
      } catch (error) {
        console.error("[GrowthContext] Failed to fetch from database, using local:", error);
        measurements = await GrowthStorageService.getAllMeasurements(selectedBaby.id);
      }
    } else {
      measurements = await GrowthStorageService.getAllMeasurements(selectedBaby.id);
    }

    dispatch({ type: "SET_MEASUREMENTS", payload: measurements });
    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby, user?.householdId]);

  useEffect(() => {
    loadMeasurements();
  }, [loadMeasurements]);

  const addMeasurement = useCallback(
    async (input: CreateGrowthInput): Promise<StoredGrowthEntry> => {
      let measurement: StoredGrowthEntry;

      if (user?.householdId && user?.id) {
        measurement = await createGrowthInDatabase(input, user.id);
      } else {
        measurement = await GrowthStorageService.addMeasurement(input);
      }

      dispatch({ type: "ADD_MEASUREMENT", payload: measurement });
      return measurement;
    },
    [user?.householdId, user?.id]
  );

  const updateMeasurement = useCallback(
    async (
      measurementId: string,
      input: UpdateGrowthInput
    ): Promise<StoredGrowthEntry | null> => {
      if (!selectedBaby) return null;

      let updated: StoredGrowthEntry | null;

      if (user?.householdId) {
        updated = await updateGrowthInDatabase(selectedBaby.id, measurementId, input);
      } else {
        updated = await GrowthStorageService.updateMeasurement(selectedBaby.id, measurementId, input);
      }

      if (updated) {
        dispatch({ type: "UPDATE_MEASUREMENT", payload: updated });
      }
      return updated;
    },
    [selectedBaby, user?.householdId]
  );

  const deleteMeasurement = useCallback(
    async (measurementId: string): Promise<boolean> => {
      if (!selectedBaby) return false;

      let result: boolean;

      if (user?.householdId) {
        result = await deleteGrowthFromDatabase(selectedBaby.id, measurementId);
      } else {
        result = await GrowthStorageService.deleteMeasurement(selectedBaby.id, measurementId);
      }

      if (result) {
        dispatch({ type: "DELETE_MEASUREMENT", payload: measurementId });
      }
      return result;
    },
    [selectedBaby, user?.householdId]
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

  const getWeightChange = useCallback((): { change: number; hasPrevious: boolean } | null => {
    const history = getMeasurementHistory();
    const withWeight = history.filter((m) => m.weightKg != null);

    if (withWeight.length < 1) return null;

    const latest = withWeight[0];

    if (withWeight.length < 2) {
      return { change: 0, hasPrevious: false };
    }

    const previous = withWeight[1];
    return {
      change: Math.round((latest.weightKg! - previous.weightKg!) * 1000),
      hasPrevious: true
    };
  }, [getMeasurementHistory]);

  const value: GrowthContextValue = {
    ...state,
    addMeasurement,
    updateMeasurement,
    deleteMeasurement,
    refreshMeasurements: loadMeasurements,
    getLastMeasurement,
    getMeasurementHistory,
    getWeightChange,
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

function transformGrowthFromRemote(data: Record<string, unknown>): StoredGrowthEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    measuredAt: data.measured_at as string,
    weightKg: data.weight_kg != null ? (data.weight_kg as number) : undefined,
    heightCm: data.height_cm != null ? (data.height_cm as number) : undefined,
    headCircumferenceCm: data.head_circumference_cm != null ? (data.head_circumference_cm as number) : undefined,
    notes: data.notes != null ? (data.notes as string) : undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

