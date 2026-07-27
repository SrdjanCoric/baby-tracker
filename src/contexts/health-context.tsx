import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo } from "react";
import {
  HealthStorageService,
  StoredHealthEntry,
  CreateHealthInput,
  UpdateHealthInput,
} from "@/services/health-storage";
import {
  fetchHealthFromDatabase,
  createHealthInDatabase,
  updateHealthInDatabase,
  deleteHealthFromDatabase,
} from "@/services/activity-sync-service";
import { useBaby } from "./baby-context";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";
import type { HealthType, MeasurementMethod, SymptomType, DosageUnit } from "@/constants/activities";
import { CDC_VACCINE_SCHEDULE, getNextDoseNumber } from "@/constants/vaccine-schedule";
import { useTranslation } from "react-i18next";
import { useActivityRangeLoader } from "@/hooks/useActivityRangeLoader";
import type { ActivityRangeStatus, UtcActivityRange } from "@/services/activity-range-loader";

export interface CompletedVaccination {
  vaccineName: string;
  doseNumber: number;
  loggedAt: string;
}

export interface HealthState {
  healthEntries: StoredHealthEntry[];
  isLoading: boolean;
}

export type HealthAction =
  | { type: "SET_HEALTH"; payload: StoredHealthEntry[] }
  | { type: "ADD_HEALTH"; payload: StoredHealthEntry }
  | { type: "UPDATE_HEALTH"; payload: StoredHealthEntry }
  | { type: "DELETE_HEALTH"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredHealthEntry }
  | { type: "REMOTE_UPDATE"; payload: StoredHealthEntry }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialHealthState: HealthState = {
  healthEntries: [],
  isLoading: true,
};

export function healthReducer(state: HealthState, action: HealthAction): HealthState {
  switch (action.type) {
    case "SET_HEALTH":
      return { ...state, healthEntries: action.payload };

    case "ADD_HEALTH":
      return { ...state, healthEntries: upsertById(state.healthEntries, action.payload) };

    case "UPDATE_HEALTH": {
      const updatedEntries = state.healthEntries.map(h =>
        h.id === action.payload.id ? action.payload : h
      );
      return { ...state, healthEntries: updatedEntries };
    }

    case "DELETE_HEALTH": {
      const filteredEntries = state.healthEntries.filter(h => h.id !== action.payload);
      return { ...state, healthEntries: filteredEntries };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "REMOTE_INSERT":
      return { ...state, healthEntries: upsertById(state.healthEntries, action.payload) };

    case "REMOTE_UPDATE": {
      return { ...state, healthEntries: upsertById(state.healthEntries, action.payload) };
    }

    case "REMOTE_DELETE": {
      const filteredEntries = state.healthEntries.filter(h => h.id !== action.payload);
      return { ...state, healthEntries: filteredEntries };
    }

    default:
      return state;
  }
}

interface HealthContextValue extends HealthState {
  addHealth: (input: CreateHealthInput) => Promise<StoredHealthEntry>;
  updateHealth: (healthId: string, input: UpdateHealthInput) => Promise<StoredHealthEntry | null>;
  deleteHealth: (healthId: string) => Promise<boolean>;
  refreshHealth: () => Promise<void>;
  loadHealthRange: (range: UtcActivityRange) => Promise<void>;
  getHealthRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
  getLastHealth: () => StoredHealthEntry | null;
  getTodaysCount: () => number;
  getCompletedVaccinations: () => CompletedVaccination[];
}

const HealthContext = createContext<HealthContextValue | null>(null);

export function HealthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(healthReducer, initialHealthState);
  const { selectedBaby } = useBaby();
  const { subscribeToRemoteChanges, foregroundRefreshKey } = useSync();
  const { user } = useAuth();
  const { t } = useTranslation();
  const acceptHealthRange = useCallback((entries: StoredHealthEntry[]) => {
    dispatch({ type: "SET_HEALTH", payload: entries });
  }, []);
  const {
    loadRange: loadHealthRange,
    getRangeStatus: getHealthRangeStatus,
  } = useActivityRangeLoader({
    table: "health_entries",
    babyId: selectedBaby?.id ?? null,
    authenticated: Boolean(user?.householdId),
    storageScope: `${user?.id ?? "guest"}:${user?.householdId ?? "local"}:${selectedBaby?.id ?? "none"}`,
    acceptEntries: acceptHealthRange,
  });

  useEffect(() => {
    const unsubscribe = subscribeToRemoteChanges('health_entries', (change: RemoteChange) => {
      if (!selectedBaby) return;

      const data = change.new || change.old;
      if (data && data.baby_id !== selectedBaby.id) return;

      const removeId = tombstonedId(change);
      if (removeId) {
        dispatch({ type: "REMOTE_DELETE", payload: removeId });
        return;
      }

      switch (change.eventType) {
        case 'INSERT':
          if (change.new) {
            dispatch({
              type: "REMOTE_INSERT",
              payload: transformHealthFromRemote(change.new),
            });
          }
          break;
        case 'UPDATE':
          if (change.new) {
            dispatch({
              type: "REMOTE_UPDATE",
              payload: transformHealthFromRemote(change.new),
            });
          }
          break;
      }
    });

    return unsubscribe;
  }, [subscribeToRemoteChanges, selectedBaby]);

  const loadHealth = useCallback(async () => {
    if (!selectedBaby) {
      dispatch({ type: "SET_HEALTH", payload: [] });
      dispatch({ type: "SET_LOADING", payload: false });
      return;
    }

    dispatch({ type: "SET_LOADING", payload: true });

    let entries: StoredHealthEntry[];

    if (user?.householdId) {
      try {
        entries = await fetchHealthFromDatabase(selectedBaby.id);
      } catch (error) {
        console.error("[HealthContext] Failed to fetch from database, using local:", error);
        entries = await HealthStorageService.getAllHealth(selectedBaby.id);
      }
    } else {
      entries = await HealthStorageService.getAllHealth(selectedBaby.id);
    }

    dispatch({ type: "SET_HEALTH", payload: entries });
    dispatch({ type: "SET_LOADING", payload: false });
  }, [selectedBaby, user?.householdId]);

  useEffect(() => {
    loadHealth();
  }, [loadHealth, foregroundRefreshKey]);

  const addHealth = useCallback(async (input: CreateHealthInput): Promise<StoredHealthEntry> => {
    let entry: StoredHealthEntry;

    if (user?.householdId && user?.id) {
      entry = await createHealthInDatabase(input, user.id);
    } else {
      entry = await HealthStorageService.addHealth(input);
    }

    dispatch({ type: "ADD_HEALTH", payload: entry });
    return entry;
  }, [user?.householdId, user?.id]);

  const updateHealth = useCallback(async (
    healthId: string,
    input: UpdateHealthInput
  ): Promise<StoredHealthEntry | null> => {
    if (!selectedBaby) return null;

    let updated: StoredHealthEntry | null;

    if (user?.householdId) {
      updated = await updateHealthInDatabase(selectedBaby.id, healthId, input);
    } else {
      updated = await HealthStorageService.updateHealth(selectedBaby.id, healthId, input);
    }

    if (updated) {
      dispatch({ type: "UPDATE_HEALTH", payload: updated });
    }
    return updated;
  }, [selectedBaby, user?.householdId]);

  const deleteHealth = useCallback(async (healthId: string): Promise<boolean> => {
    if (!selectedBaby) return false;

    let result: boolean;

    if (user?.householdId) {
      result = await deleteHealthFromDatabase(selectedBaby.id, healthId);
    } else {
      result = await HealthStorageService.deleteHealth(selectedBaby.id, healthId);
    }

    if (result) {
      dispatch({ type: "DELETE_HEALTH", payload: healthId });
    }
    return result;
  }, [selectedBaby, user?.householdId]);

  const getLastHealth = useCallback((): StoredHealthEntry | null => {
    if (state.healthEntries.length === 0) return null;

    const sorted = [...state.healthEntries].sort((a, b) =>
      new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );
    return sorted[0];
  }, [state.healthEntries]);

  const getTodaysCount = useCallback((): number => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return state.healthEntries.filter(h => {
      const entryDate = new Date(h.loggedAt);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    }).length;
  }, [state.healthEntries]);

  const getCompletedVaccinations = useCallback((): CompletedVaccination[] => {
    const resolveVaccineKey = (name: string): string => {
      const direct = CDC_VACCINE_SCHEDULE.find(s => s.key === name);
      if (direct) return name;
      const byLabel = CDC_VACCINE_SCHEDULE.find(s =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        t(`health.commonVaccine.${s.key}` as any) === name
      );
      return byLabel ? byLabel.key : name;
    };

    const vaccinationEntries = state.healthEntries
      .filter(h => h.type === 'vaccination' && h.vaccineName)
      .sort((a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime());

    const directEntries: CompletedVaccination[] = [];
    const assignedByVaccine: Record<string, number[]> = {};

    for (const h of vaccinationEntries) {
      const key = resolveVaccineKey(h.vaccineName!);
      if (!assignedByVaccine[key]) assignedByVaccine[key] = [];

      let dose = h.doseNumber;
      if (!dose) {
        const schedule = CDC_VACCINE_SCHEDULE.find(s => s.key === key);
        if (schedule) {
          dose = getNextDoseNumber(key, assignedByVaccine[key].map(d => ({ vaccineName: key, doseNumber: d })));
        } else {
          dose = assignedByVaccine[key].length + 1;
        }
      }

      assignedByVaccine[key].push(dose);
      directEntries.push({
        vaccineName: key,
        doseNumber: dose,
        loggedAt: h.loggedAt,
      });
    }

    const expanded: CompletedVaccination[] = [...directEntries];

    for (const entry of directEntries) {
      const scheduleEntry = CDC_VACCINE_SCHEDULE.find(s => s.key === entry.vaccineName);
      if (!scheduleEntry?.isCombo || !scheduleEntry.coversVaccines) continue;

      for (const coveredVaccine of scheduleEntry.coversVaccines) {
        const coveredSchedule = CDC_VACCINE_SCHEDULE.find(s => s.key === coveredVaccine);
        const existingDoses = expanded
          .filter(e => e.vaccineName === coveredVaccine)
          .map(e => e.doseNumber);

        let mappedDoseNumber = entry.doseNumber;
        if (coveredSchedule) {
          for (let d = 1; d <= coveredSchedule.totalDoses; d++) {
            if (!existingDoses.includes(d)) {
              mappedDoseNumber = d;
              break;
            }
          }
        }

        const alreadyExists = expanded.some(
          e => e.vaccineName === coveredVaccine && e.doseNumber === mappedDoseNumber
        );
        if (!alreadyExists) {
          expanded.push({
            vaccineName: coveredVaccine,
            doseNumber: mappedDoseNumber,
            loggedAt: entry.loggedAt,
          });
        }
      }
    }

    return expanded.sort((a, b) => new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime());
  }, [state.healthEntries, t]);

  const value: HealthContextValue = useMemo(() => ({
    ...state,
    addHealth,
    updateHealth,
    deleteHealth,
    refreshHealth: loadHealth,
    loadHealthRange,
    getHealthRangeStatus,
    getLastHealth,
    getTodaysCount,
    getCompletedVaccinations,
  }), [state, addHealth, updateHealth, deleteHealth, loadHealth, loadHealthRange, getHealthRangeStatus, getLastHealth, getTodaysCount, getCompletedVaccinations]);

  return <HealthContext.Provider value={value}>{children}</HealthContext.Provider>;
}

export function useHealth(): HealthContextValue {
  const context = useContext(HealthContext);
  if (!context) {
    throw new Error("useHealth must be used within a HealthProvider");
  }
  return context;
}

function transformHealthFromRemote(data: Record<string, unknown>): StoredHealthEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as HealthType,
    loggedAt: data.logged_at as string,
    medicationName: data.medication_name as string | undefined,
    dosageAmount: data.dosage_amount as number | undefined,
    dosageUnit: data.dosage_unit as DosageUnit | undefined,
    doseNumber: data.dose_number as number | undefined,
    temperatureCelsius: data.temperature_celsius as number | undefined,
    measurementMethod: data.measurement_method as MeasurementMethod | undefined,
    vaccineName: data.vaccine_name as string | undefined,
    symptoms: data.symptoms as SymptomType[] | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
    notes: data.notes as string | undefined,
  };
}
