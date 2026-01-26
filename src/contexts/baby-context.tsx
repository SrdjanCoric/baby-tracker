import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { BabyStorageService, StoredBabyProfile, CreateBabyInput, UpdateBabyInput } from "@/services/baby-storage";
import {
  fetchAndSyncHouseholdBabies,
  createBabyInDatabase,
  updateBabyInDatabase,
  deleteBabyFromDatabase,
  syncLocalBabiesToDatabase,
} from "@/services/baby-sync-service";
import { syncGuestActivitiesToDatabase } from "@/services/activity-sync-service";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange } from "@/services/sync";

export interface BabyState {
  babies: StoredBabyProfile[];
  selectedBaby: StoredBabyProfile | null;
  isLoading: boolean;
}

export type BabyAction =
  | { type: "SET_BABIES"; payload: StoredBabyProfile[] }
  | { type: "SET_SELECTED_BABY"; payload: StoredBabyProfile | null }
  | { type: "ADD_BABY"; payload: StoredBabyProfile }
  | { type: "UPDATE_BABY"; payload: StoredBabyProfile }
  | { type: "DELETE_BABY"; payload: string }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "REMOTE_INSERT"; payload: StoredBabyProfile }
  | { type: "REMOTE_UPDATE"; payload: StoredBabyProfile }
  | { type: "REMOTE_DELETE"; payload: string };

export const initialBabyState: BabyState = {
  babies: [],
  selectedBaby: null,
  isLoading: true,
};

export function babyReducer(state: BabyState, action: BabyAction): BabyState {
  switch (action.type) {
    case "SET_BABIES":
      return { ...state, babies: action.payload };

    case "SET_SELECTED_BABY":
      return { ...state, selectedBaby: action.payload };

    case "ADD_BABY":
      return { ...state, babies: [...state.babies, action.payload] };

    case "UPDATE_BABY": {
      const updatedBabies = state.babies.map(b =>
        b.id === action.payload.id ? action.payload : b
      );
      const updatedSelectedBaby =
        state.selectedBaby?.id === action.payload.id
          ? action.payload
          : state.selectedBaby;
      return { ...state, babies: updatedBabies, selectedBaby: updatedSelectedBaby };
    }

    case "DELETE_BABY": {
      const filteredBabies = state.babies.filter(b => b.id !== action.payload);
      const clearedSelectedBaby =
        state.selectedBaby?.id === action.payload ? null : state.selectedBaby;
      return { ...state, babies: filteredBabies, selectedBaby: clearedSelectedBaby };
    }

    case "SET_LOADING":
      return { ...state, isLoading: action.payload };

    case "REMOTE_INSERT": {
      const exists = state.babies.some(b => b.id === action.payload.id);
      if (exists) {
        return state;
      }
      const newBabies = [...state.babies, action.payload];
      // If no baby is currently selected, select the new one
      const newSelectedBaby = state.selectedBaby === null ? action.payload : state.selectedBaby;
      return { ...state, babies: newBabies, selectedBaby: newSelectedBaby };
    }

    case "REMOTE_UPDATE": {
      const updatedBabies = state.babies.map(b =>
        b.id === action.payload.id ? action.payload : b
      );
      const updatedSelectedBaby =
        state.selectedBaby?.id === action.payload.id
          ? action.payload
          : state.selectedBaby;
      return { ...state, babies: updatedBabies, selectedBaby: updatedSelectedBaby };
    }

    case "REMOTE_DELETE": {
      const filteredBabies = state.babies.filter(b => b.id !== action.payload);
      let newSelectedBaby = state.selectedBaby;
      // If deleted baby was selected, select another one or null
      if (state.selectedBaby?.id === action.payload) {
        newSelectedBaby = filteredBabies.length > 0 ? filteredBabies[0] : null;
      }
      return { ...state, babies: filteredBabies, selectedBaby: newSelectedBaby };
    }

    default:
      return state;
  }
}

interface BabyContextValue extends BabyState {
  getBabyById: (id: string) => StoredBabyProfile | undefined;
  addBaby: (input: CreateBabyInput) => Promise<StoredBabyProfile>;
  updateBaby: (id: string, input: UpdateBabyInput) => Promise<StoredBabyProfile | null>;
  deleteBaby: (id: string) => Promise<boolean>;
  selectBaby: (id: string | null) => Promise<void>;
  refreshBabies: () => Promise<void>;
}

const BabyContext = createContext<BabyContextValue | null>(null);

const GUEST_BABIES_KEY = "@babies";

async function getGuestBabies(): Promise<StoredBabyProfile[]> {
  const data = await AsyncStorage.getItem(GUEST_BABIES_KEY);
  if (!data) return [];
  return JSON.parse(data) as StoredBabyProfile[];
}

async function clearGuestBabies(): Promise<void> {
  await AsyncStorage.removeItem(GUEST_BABIES_KEY);
  await AsyncStorage.removeItem("@selected_baby_id");
}

export function BabyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(babyReducer, initialBabyState);
  const { subscribeToRemoteChanges } = useSync();
  const { user } = useAuth();
  const hasMigratedRef = useRef(false);
  const pendingBabyIdsRef = useRef<Set<string>>(new Set());

  const handleRemoteChange = useCallback((change: RemoteChange) => {
    if (!user?.householdId) return;

    const data = change.new || change.old;
    if (data && data.household_id && data.household_id !== user.householdId) {
      return;
    }

    switch (change.eventType) {
      case 'INSERT':
        if (change.new) {
          const babyId = change.new.id as string;
          // Skip if this is a baby we're currently creating locally
          if (pendingBabyIdsRef.current.has(babyId)) {
            return;
          }
          dispatch({
            type: "REMOTE_INSERT",
            payload: transformBabyFromRemote(change.new),
          });
        }
        break;
      case 'UPDATE':
        if (change.new) {
          dispatch({
            type: "REMOTE_UPDATE",
            payload: transformBabyFromRemote(change.new),
          });
        }
        break;
      case 'DELETE':
        if (change.old && change.old.id) {
          dispatch({
            type: "REMOTE_DELETE",
            payload: change.old.id as string,
          });
        }
        break;
    }
  }, [user?.householdId]);

  useEffect(() => {
    if (!user?.householdId) return;

    const unsubscribe = subscribeToRemoteChanges('babies', handleRemoteChange);

    return () => {
      unsubscribe();
    };
  }, [subscribeToRemoteChanges, user?.householdId, handleRemoteChange]);

  // Persist selected baby to AsyncStorage when it changes
  const prevSelectedBabyIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = state.selectedBaby?.id ?? null;
    if (currentId !== prevSelectedBabyIdRef.current) {
      prevSelectedBabyIdRef.current = currentId;
      BabyStorageService.setSelectedBabyId(currentId);
    }
  }, [state.selectedBaby?.id]);

  const loadBabies = useCallback(async () => {
    dispatch({ type: "SET_LOADING", payload: true });

    let babies: StoredBabyProfile[];

    if (user?.householdId) {
      if (!hasMigratedRef.current) {
        hasMigratedRef.current = true;
        const guestBabies = await getGuestBabies();
        if (guestBabies.length > 0) {
          try {
            const { idMap } = await syncLocalBabiesToDatabase(user.householdId, guestBabies);
            await clearGuestBabies();

            const babyIdMap = new Map<string, string>();
            for (const baby of guestBabies) {
              const newId = idMap.get(baby.id) || baby.id;
              babyIdMap.set(baby.id, newId);
            }

            await syncGuestActivitiesToDatabase(user.id, babyIdMap);
          } catch (error) {
            console.error("[BabyContext] Failed to migrate guest data:", error);
          }
        }
      }

      try {
        babies = await fetchAndSyncHouseholdBabies(user.householdId);
      } catch (error) {
        console.error("[BabyContext] Failed to fetch from database, using local:", error);
        babies = await BabyStorageService.getAllBabies();
      }
    } else {
      hasMigratedRef.current = false;
      babies = await BabyStorageService.getAllBabies();
    }

    dispatch({ type: "SET_BABIES", payload: babies });

    const selectedBabyId = await BabyStorageService.getSelectedBabyId();
    const selectedBaby = selectedBabyId
      ? babies.find(b => b.id === selectedBabyId) ?? null
      : null;

    if (!selectedBaby && babies.length > 0) {
      await BabyStorageService.setSelectedBabyId(babies[0].id);
      dispatch({ type: "SET_SELECTED_BABY", payload: babies[0] });
    } else {
      dispatch({ type: "SET_SELECTED_BABY", payload: selectedBaby });
    }

    dispatch({ type: "SET_LOADING", payload: false });
  }, [user?.householdId]);

  useEffect(() => {
    loadBabies();
  }, [loadBabies]);

  const addBaby = useCallback(async (input: CreateBabyInput) => {
    let newBaby: StoredBabyProfile;

    if (user?.householdId) {
      // Generate ID upfront so we can track it as pending
      const pendingId = crypto.randomUUID();
      pendingBabyIdsRef.current.add(pendingId);

      try {
        newBaby = await createBabyInDatabase({ ...input, id: pendingId }, user.householdId);
      } finally {
        // Remove from pending after a short delay to ensure real-time event has passed
        setTimeout(() => {
          pendingBabyIdsRef.current.delete(pendingId);
        }, 1000);
      }
    } else {
      newBaby = await BabyStorageService.addBaby(input);
    }

    dispatch({ type: "ADD_BABY", payload: newBaby });

    if (state.babies.length === 0) {
      await BabyStorageService.setSelectedBabyId(newBaby.id);
      dispatch({ type: "SET_SELECTED_BABY", payload: newBaby });
    }

    return newBaby;
  }, [state.babies.length, user?.householdId]);

  const updateBaby = useCallback(async (id: string, input: UpdateBabyInput) => {
    let updated: StoredBabyProfile | null;

    if (user?.householdId) {
      updated = await updateBabyInDatabase(id, input, user.householdId);
    } else {
      updated = await BabyStorageService.updateBaby(id, input);
    }

    if (updated) {
      dispatch({ type: "UPDATE_BABY", payload: updated });
    }
    return updated;
  }, [user?.householdId]);

  const deleteBaby = useCallback(async (id: string) => {
    let result: boolean;

    if (user?.householdId) {
      result = await deleteBabyFromDatabase(id, user.householdId);
    } else {
      result = await BabyStorageService.deleteBaby(id);
    }

    if (result) {
      dispatch({ type: "DELETE_BABY", payload: id });

      const remainingBabies = state.babies.filter(b => b.id !== id);
      const wasSelectedBaby = state.selectedBaby?.id === id;
      const noSelectedBaby = !state.selectedBaby;

      if ((wasSelectedBaby || noSelectedBaby) && remainingBabies.length > 0) {
        await BabyStorageService.setSelectedBabyId(remainingBabies[0].id);
        dispatch({ type: "SET_SELECTED_BABY", payload: remainingBabies[0] });
      } else if (remainingBabies.length === 0) {
        await BabyStorageService.setSelectedBabyId(null);
        dispatch({ type: "SET_SELECTED_BABY", payload: null });
      }
    }
    return result;
  }, [state.selectedBaby?.id, state.babies, user?.householdId]);

  const selectBaby = useCallback(async (id: string | null) => {
    await BabyStorageService.setSelectedBabyId(id);
    if (id === null) {
      dispatch({ type: "SET_SELECTED_BABY", payload: null });
    } else {
      const baby = await BabyStorageService.getBabyById(id);
      dispatch({ type: "SET_SELECTED_BABY", payload: baby });
    }
  }, []);

  const value: BabyContextValue = {
    ...state,
    getBabyById: (id: string) => state.babies.find((b) => b.id === id),
    addBaby,
    updateBaby,
    deleteBaby,
    selectBaby,
    refreshBabies: loadBabies,
  };

  return <BabyContext.Provider value={value}>{children}</BabyContext.Provider>;
}

export function useBaby(): BabyContextValue {
  const context = useContext(BabyContext);
  if (!context) {
    throw new Error("useBaby must be used within a BabyProvider");
  }
  return context;
}

function transformBabyFromRemote(data: Record<string, unknown>): StoredBabyProfile {
  return {
    id: data.id as string,
    name: data.name as string,
    birthDate: data.birth_date as string | undefined,
    gender: data.gender as 'male' | 'female' | undefined,
    photoUri: data.photo_url as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}
