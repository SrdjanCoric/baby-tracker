import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from "react";
import { Alert } from "react-native";
import * as Crypto from "expo-crypto";
import { BabyStorageService, StoredBabyProfile, CreateBabyInput, UpdateBabyInput } from "@/services/baby-storage";
import {
  fetchAndSyncHouseholdBabies,
  createBabyInDatabase,
  updateBabyInDatabase,
  deleteBabyFromDatabase,
} from "@/services/baby-sync-service";
import {
  discardGuestAccountMigration,
  runGuestAccountMigration,
} from "@/services/guest-account-migration";
import i18n from "@/i18n";
import { useSync } from "./sync-context";
import { useAuth } from "./auth-context";
import { RemoteChange, tombstonedId, upsertById } from "@/services/sync";

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

type BabyMutation =
  | { sequence: number; scope: string; type: "upsert"; baby: StoredBabyProfile }
  | { sequence: number; scope: string; type: "delete"; babyId: string };

function applyBabyMutations(
  babies: StoredBabyProfile[],
  mutations: BabyMutation[]
): StoredBabyProfile[] {
  return mutations.reduce((currentBabies, mutation) => {
    if (mutation.type === "delete") {
      return currentBabies.filter(baby => baby.id !== mutation.babyId);
    }
    return upsertById(currentBabies, mutation.baby);
  }, babies);
}

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
      const updatedSelectedBaby =
        state.selectedBaby?.id === action.payload.id
          ? action.payload
          : state.selectedBaby;
      return { ...state, babies: upsertById(state.babies, action.payload), selectedBaby: updatedSelectedBaby };
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
  selectBaby: (id: string | null) => Promise<StoredBabyProfile | null>;
  refreshBabies: () => Promise<void>;
}

const BabyContext = createContext<BabyContextValue | null>(null);

export function presentGuestMigrationConflict({
  useAnotherAccount,
  discardGuestData,
}: {
  useAnotherAccount: () => void;
  discardGuestData: () => void;
}): void {
  Alert.alert(
    i18n.t("newOwnerOnboarding.migration.title"),
    i18n.t("newOwnerOnboarding.migration.message"),
    [
      {
        text: i18n.t("newOwnerOnboarding.migration.useAnotherAccount"),
        onPress: useAnotherAccount,
      },
      {
        text: i18n.t("newOwnerOnboarding.migration.keepAccountData"),
        style: "destructive",
        onPress: () => {
          Alert.alert(
            i18n.t("newOwnerOnboarding.migration.title"),
            i18n.t("newOwnerOnboarding.migration.confirmDeletion"),
            [
              { text: i18n.t("common.cancel"), style: "cancel" },
              {
                text: i18n.t("newOwnerOnboarding.migration.keepAccountData"),
                style: "destructive",
                onPress: discardGuestData,
              },
            ]
          );
        },
      },
    ]
  );
}

export function BabyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(babyReducer, initialBabyState);
  const { subscribeToRemoteChanges } = useSync();
  const { user, signOut } = useAuth();
  const authScope = user ? `${user.id}:${user.householdId ?? "no-household"}` : "guest";
  const authScopeRef = useRef(authScope);
  const authGenerationRef = useRef(0);
  if (authScopeRef.current !== authScope) {
    authScopeRef.current = authScope;
    authGenerationRef.current += 1;
  }
  const renderAuthGeneration = authGenerationRef.current;
  const storageScope = useMemo(
    () => BabyStorageService.scopeForUser(user?.id ?? null, user?.householdId ?? null),
    [user?.householdId, user?.id]
  );
  const committedScopeRef = useRef(authScope);
  const hasMigratedRef = useRef(false);
  const pendingBabyIdsRef = useRef<Set<string>>(new Set());
  const babyMutationSequenceRef = useRef(0);
  const babyMutationsRef = useRef<BabyMutation[]>([]);
  const recordBabyUpsert = useCallback((scope: string, baby: StoredBabyProfile) => {
    babyMutationSequenceRef.current += 1;
    babyMutationsRef.current.push({
      sequence: babyMutationSequenceRef.current,
      scope,
      type: "upsert",
      baby,
    });
  }, []);
  const recordBabyDelete = useCallback((scope: string, babyId: string) => {
    babyMutationSequenceRef.current += 1;
    babyMutationsRef.current.push({
      sequence: babyMutationSequenceRef.current,
      scope,
      type: "delete",
      babyId,
    });
  }, []);

  const handleRemoteChange = useCallback(async (change: RemoteChange) => {
    if (!user?.householdId) return;
    const handlerGeneration = renderAuthGeneration;
    const handlerScope = authScope;
    if (
      authGenerationRef.current !== handlerGeneration ||
      authScopeRef.current !== handlerScope
    ) return;

    const data = change.new || change.old;
    if (data?.household_id !== user.householdId) return;

    const removeId = tombstonedId(change);
    if (removeId) {
      recordBabyDelete(handlerScope, removeId);
      await BabyStorageService.deleteBaby(removeId, storageScope);
      if (
        authGenerationRef.current !== handlerGeneration ||
        authScopeRef.current !== handlerScope
      ) return;
      dispatch({ type: "REMOTE_DELETE", payload: removeId });
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
          const baby = transformBabyFromRemote(change.new);
          recordBabyUpsert(handlerScope, baby);
          await BabyStorageService.upsertBaby(baby, storageScope);
          if (
            authGenerationRef.current !== handlerGeneration ||
            authScopeRef.current !== handlerScope
          ) return;
          dispatch({ type: "REMOTE_INSERT", payload: baby });
        }
        break;
      case 'UPDATE':
        if (change.new) {
          const baby = transformBabyFromRemote(change.new);
          recordBabyUpsert(handlerScope, baby);
          await BabyStorageService.upsertBaby(baby, storageScope);
          if (
            authGenerationRef.current !== handlerGeneration ||
            authScopeRef.current !== handlerScope
          ) return;
          dispatch({ type: "REMOTE_UPDATE", payload: baby });
        }
        break;
    }
  }, [authScope, recordBabyDelete, recordBabyUpsert, renderAuthGeneration, storageScope, user?.householdId]);

  useEffect(() => {
    if (!user?.householdId) return;

    const unsubscribe = subscribeToRemoteChanges('babies', handleRemoteChange);

    return () => {
      unsubscribe();
    };
  }, [subscribeToRemoteChanges, user?.householdId, handleRemoteChange]);

  // Persist selected baby to AsyncStorage when it changes
  const persistedSelectionRef = useRef<string | null>(null);
  useEffect(() => {
    if (state.isLoading || committedScopeRef.current !== authScope) return;
    const currentId = state.selectedBaby?.id ?? null;
    const selectionKey = `${authScope}:${currentId ?? "none"}`;
    if (selectionKey !== persistedSelectionRef.current) {
      persistedSelectionRef.current = selectionKey;
      void BabyStorageService.setSelectedBabyId(currentId, storageScope);
    }
  }, [authScope, state.isLoading, state.selectedBaby?.id, storageScope]);

  const loadBabies = useCallback(async () => {
    const loadGeneration = authGenerationRef.current;
    const loadScope = authScope;
    const isStaleLoad = () =>
      authGenerationRef.current !== loadGeneration || authScopeRef.current !== loadScope;
    const mutationSequenceAtStart = babyMutationSequenceRef.current;
    dispatch({ type: "SET_LOADING", payload: true });

    try {
      let babies: StoredBabyProfile[];
      let persistFetchedSnapshot = false;

      if (user?.householdId) {
        let fetchedAccountBabies = false;
        try {
          babies = await fetchAndSyncHouseholdBabies(user.householdId);
          if (isStaleLoad()) return;
          fetchedAccountBabies = true;
          persistFetchedSnapshot = true;
        } catch {
          console.error("[BabyContext] Failed to fetch account babies");
          babies = await BabyStorageService.getAllBabies(storageScope);
          if (isStaleLoad()) return;
        }

        if (fetchedAccountBabies && !hasMigratedRef.current) {
          try {
            const migration = await runGuestAccountMigration({
              userId: user.id,
              householdId: user.householdId,
              accountBabies: babies,
            });
            if (migration.status === "completed") {
              babies = await fetchAndSyncHouseholdBabies(user.householdId);
              if (isStaleLoad()) return;
            }
            if (migration.status === "conflict") {
              presentGuestMigrationConflict({
                useAnotherAccount: () => {
                  void signOut({ preserveGuestData: true });
                },
                discardGuestData: () => {
                  void discardGuestAccountMigration();
                },
              });
            }
            hasMigratedRef.current = true;
          } catch {
            console.error("[BabyContext] Guest migration remains pending");
          }
        }
      } else {
        hasMigratedRef.current = false;
        babies = await BabyStorageService.getAllBabies(storageScope);
        if (isStaleLoad()) return;
      }

      if (persistFetchedSnapshot) {
        const concurrentMutations = babyMutationsRef.current.filter(
          mutation => mutation.scope === loadScope && mutation.sequence > mutationSequenceAtStart
        );
        babies = applyBabyMutations(babies, concurrentMutations);
        await BabyStorageService.replaceAllBabies(babies, storageScope);
        if (isStaleLoad()) return;
      }

      committedScopeRef.current = loadScope;
      dispatch({ type: "SET_BABIES", payload: babies });

      const selectedBabyId = await BabyStorageService.getSelectedBabyId(storageScope);
      if (isStaleLoad()) return;
      const selectedBaby = selectedBabyId
        ? babies.find(b => b.id === selectedBabyId) ?? null
        : null;

      if (!selectedBaby && babies.length > 0) {
        await BabyStorageService.setSelectedBabyId(babies[0].id, storageScope);
        if (isStaleLoad()) return;
        dispatch({ type: "SET_SELECTED_BABY", payload: babies[0] });
      } else {
        dispatch({ type: "SET_SELECTED_BABY", payload: selectedBaby });
      }
    } catch (error) {
      console.error("[BabyContext] Failed to load babies:", error);
    } finally {
      if (!isStaleLoad()) {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
  }, [authScope, signOut, storageScope, user?.householdId, user?.id]);

  useEffect(() => {
    loadBabies();
  }, [loadBabies]);

  const addBaby = useCallback(async (input: CreateBabyInput) => {
    const operationGeneration = authGenerationRef.current;
    const operationScope = authScope;
    const isCurrentOperation = () =>
      authGenerationRef.current === operationGeneration &&
      authScopeRef.current === operationScope;
    let newBaby: StoredBabyProfile;

    if (user?.householdId) {
      // Generate ID upfront so we can track it as pending
      const pendingId = Crypto.randomUUID();
      pendingBabyIdsRef.current.add(pendingId);

      try {
        newBaby = await createBabyInDatabase({ ...input, id: pendingId }, user.householdId);
      } finally {
        // Remove from pending after a short delay to ensure real-time event has passed
        setTimeout(() => {
          pendingBabyIdsRef.current.delete(pendingId);
        }, 1000);
      }
      if (!isCurrentOperation()) {
        throw new Error("Baby create cancelled because the account changed");
      }
      recordBabyUpsert(operationScope, newBaby);
      await BabyStorageService.upsertBaby(newBaby, storageScope);
    } else {
      newBaby = await BabyStorageService.addBaby(input, storageScope);
    }

    if (!isCurrentOperation()) {
      throw new Error("Baby create cancelled because the account changed");
    }
    dispatch({ type: "ADD_BABY", payload: newBaby });

    if (state.babies.length === 0) {
      await BabyStorageService.setSelectedBabyId(newBaby.id, storageScope);
      if (!isCurrentOperation()) {
        throw new Error("Baby create cancelled because the account changed");
      }
      dispatch({ type: "SET_SELECTED_BABY", payload: newBaby });
    }

    return newBaby;
  }, [authScope, recordBabyUpsert, state.babies.length, storageScope, user?.householdId]);

  const updateBaby = useCallback(async (id: string, input: UpdateBabyInput) => {
    const operationGeneration = authGenerationRef.current;
    const operationScope = authScope;
    const isCurrentOperation = () =>
      authGenerationRef.current === operationGeneration &&
      authScopeRef.current === operationScope;
    let updated: StoredBabyProfile | null;

    if (user?.householdId) {
      updated = await updateBabyInDatabase(id, input, user.householdId);
      if (!isCurrentOperation()) return null;
      if (updated) {
        recordBabyUpsert(operationScope, updated);
        await BabyStorageService.upsertBaby(updated, storageScope);
      }
    } else {
      updated = await BabyStorageService.updateBaby(id, input, storageScope);
    }

    if (updated && isCurrentOperation()) {
      dispatch({ type: "UPDATE_BABY", payload: updated });
    }
    return isCurrentOperation() ? updated : null;
  }, [authScope, recordBabyUpsert, storageScope, user?.householdId]);

  const deleteBaby = useCallback(async (id: string) => {
    const operationGeneration = authGenerationRef.current;
    const operationScope = authScope;
    const isCurrentOperation = () =>
      authGenerationRef.current === operationGeneration &&
      authScopeRef.current === operationScope;
    let result: boolean;

    if (user?.householdId) {
      result = await deleteBabyFromDatabase(id, user.householdId);
      if (!isCurrentOperation()) return false;
      if (result) {
        recordBabyDelete(operationScope, id);
        await BabyStorageService.deleteBaby(id, storageScope);
      }
    } else {
      result = await BabyStorageService.deleteBaby(id, storageScope);
    }

    if (result && isCurrentOperation()) {
      dispatch({ type: "DELETE_BABY", payload: id });

      const remainingBabies = state.babies.filter(b => b.id !== id);
      const selectedBabyId = state.selectedBaby?.id;
      const wasSelectedBaby = selectedBabyId === id;
      const noSelectedBaby = selectedBabyId === undefined;

      if ((wasSelectedBaby || noSelectedBaby) && remainingBabies.length > 0) {
        await BabyStorageService.setSelectedBabyId(remainingBabies[0].id, storageScope);
        if (!isCurrentOperation()) return false;
        dispatch({ type: "SET_SELECTED_BABY", payload: remainingBabies[0] });
      } else if (remainingBabies.length === 0) {
        await BabyStorageService.setSelectedBabyId(null, storageScope);
        if (!isCurrentOperation()) return false;
        dispatch({ type: "SET_SELECTED_BABY", payload: null });
      }
    }
    return isCurrentOperation() ? result : false;
  }, [authScope, recordBabyDelete, state.selectedBaby?.id, state.babies, storageScope, user?.householdId]);

  const selectBaby = useCallback(async (id: string | null) => {
    const operationGeneration = authGenerationRef.current;
    const operationScope = authScope;
    const isCurrentOperation = () =>
      authGenerationRef.current === operationGeneration &&
      authScopeRef.current === operationScope;
    if (id === null) {
      await BabyStorageService.setSelectedBabyId(null, storageScope);
      if (!isCurrentOperation()) return null;
      dispatch({ type: "SET_SELECTED_BABY", payload: null });
      return null;
    }

    if (committedScopeRef.current !== authScope) return null;
    const baby = state.babies.find(item => item.id === id) ?? null;
    if (!baby) return null;

    await BabyStorageService.setSelectedBabyId(id, storageScope);
    if (!isCurrentOperation()) return null;
    dispatch({ type: "SET_SELECTED_BABY", payload: baby });
    return baby;
  }, [authScope, state.babies, storageScope]);

  const getBabyById = useCallback(
    (id: string) => committedScopeRef.current === authScope
      ? state.babies.find(baby => baby.id === id)
      : undefined,
    [authScope, state.babies]
  );

  const value: BabyContextValue = useMemo(() => {
    const scopedState: BabyState = committedScopeRef.current === authScope
      ? state
      : { babies: [], selectedBaby: null, isLoading: true };

    return {
      ...scopedState,
      getBabyById,
      addBaby,
      updateBaby,
      deleteBaby,
      selectBaby,
      refreshBabies: loadBabies,
    };
  }, [authScope, state, getBabyById, addBaby, updateBaby, deleteBaby, selectBaby, loadBabies]);

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
