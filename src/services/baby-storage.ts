/**
 * Baby profile storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { getStorageUserId, getUserScopedKeyFor } from "./storage-prefix";
import type { CompleteNewBabyProfile } from "@/validators/baby";

const BABIES_KEY_BASE = "@babies";
const SELECTED_BABY_KEY_BASE = "@selected_baby_id";

export interface BabyStorageScope {
  babiesKey: string;
  selectedBabyKey: string;
}

function createStorageScope(
  userId: string | null,
  householdId?: string | null
): BabyStorageScope {
  const scopeId = userId && householdId !== undefined
    ? `${userId}:${householdId ?? "no-household"}`
    : userId;
  return {
    babiesKey: getUserScopedKeyFor(BABIES_KEY_BASE, scopeId),
    selectedBabyKey: getUserScopedKeyFor(SELECTED_BABY_KEY_BASE, scopeId),
  };
}

function getCurrentStorageScope(): BabyStorageScope {
  return createStorageScope(getStorageUserId());
}

export interface StoredBabyProfile {
  id: string;
  name: string;
  birthDate?: string;
  gender?: "male" | "female";
  photoUri?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBabyInput extends CompleteNewBabyProfile {
  id?: string;
}

export interface UpdateBabyInput {
  name?: string;
  birthDate?: Date;
  gender?: "male" | "female";
  photoUri?: string;
}

function generateId(): string {
  return Crypto.randomUUID();
}

const babyMutationTails = new Map<string, Promise<void>>();

function mutateStoredBabies<TResult>(
  mutation: (babies: StoredBabyProfile[]) => {
    babies: StoredBabyProfile[];
    result: TResult;
  },
  storageScope: BabyStorageScope = getCurrentStorageScope()
): Promise<TResult> {
  const babiesKey = storageScope.babiesKey;
  const mutationTail = babyMutationTails.get(babiesKey) ?? Promise.resolve();
  const operation = mutationTail.then(async () => {
    const data = await AsyncStorage.getItem(babiesKey);
    const babies = data ? JSON.parse(data) as StoredBabyProfile[] : [];
    const outcome = mutation(babies);
    await AsyncStorage.setItem(babiesKey, JSON.stringify(outcome.babies));
    return outcome.result;
  });

  const nextTail = operation.then(
    () => undefined,
    () => undefined
  );
  babyMutationTails.set(babiesKey, nextTail);
  void nextTail.finally(() => {
    if (babyMutationTails.get(babiesKey) === nextTail) {
      babyMutationTails.delete(babiesKey);
    }
  });
  return operation;
}

export const BabyStorageService = {
  scopeForUser(userId: string | null, householdId: string | null): BabyStorageScope {
    return createStorageScope(userId, householdId);
  },

  currentScope(): BabyStorageScope {
    return getCurrentStorageScope();
  },

  /**
   * Get all stored babies
   */
  async getAllBabies(storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<StoredBabyProfile[]> {
    const data = await AsyncStorage.getItem(storageScope.babiesKey);
    if (!data) return [];
    return JSON.parse(data) as StoredBabyProfile[];
  },

  /**
   * Get a baby by ID
   */
  async getBabyById(id: string, storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<StoredBabyProfile | null> {
    const babies = await this.getAllBabies(storageScope);
    return babies.find(b => b.id === id) ?? null;
  },

  async upsertBaby(baby: StoredBabyProfile, storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<void> {
    await mutateStoredBabies(babies => {
      const existingIndex = babies.findIndex(item => item.id === baby.id);
      if (existingIndex === -1) {
        babies.push(baby);
      } else {
        babies[existingIndex] = baby;
      }
      return { babies, result: undefined };
    }, storageScope);
  },

  async replaceAllBabies(babies: StoredBabyProfile[], storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<void> {
    await mutateStoredBabies(() => ({ babies: [...babies], result: undefined }), storageScope);
  },

  /**
   * Add a new baby
   */
  async addBaby(input: CreateBabyInput, storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<StoredBabyProfile> {
    const now = new Date().toISOString();

    const newBaby: StoredBabyProfile = {
      id: generateId(),
      name: input.name,
      birthDate: input.birthDate?.toISOString(),
      gender: input.gender,
      photoUri: input.photoUri,
      createdAt: now,
      updatedAt: now,
    };

    return mutateStoredBabies(babies => ({
      babies: [...babies, newBaby],
      result: newBaby,
    }), storageScope);
  },

  /**
   * Update an existing baby
   */
  async updateBaby(id: string, input: UpdateBabyInput, storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<StoredBabyProfile | null> {
    return mutateStoredBabies(babies => {
      const index = babies.findIndex(b => b.id === id);
      if (index === -1) return { babies, result: null };

      const updatedBaby: StoredBabyProfile = {
        ...babies[index],
        ...(input.name !== undefined && { name: input.name }),
        ...(input.birthDate !== undefined && { birthDate: input.birthDate.toISOString() }),
        ...("gender" in input && { gender: input.gender }),
        ...("photoUri" in input && { photoUri: input.photoUri }),
        updatedAt: new Date().toISOString(),
      };

      babies[index] = updatedBaby;
      return { babies, result: updatedBaby };
    }, storageScope);
  },

  /**
   * Delete a baby
   */
  async deleteBaby(id: string, storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<boolean> {
    const selectedBabyKey = storageScope.selectedBabyKey;
    const deleted = await mutateStoredBabies(babies => {
      const remainingBabies = babies.filter(baby => baby.id !== id);
      return {
        babies: remainingBabies,
        result: remainingBabies.length !== babies.length,
      };
    }, storageScope);

    if (!deleted) return false;

    // Clear selected baby if we deleted it
    const selectedId = await AsyncStorage.getItem(selectedBabyKey);
    if (selectedId === id) {
      await AsyncStorage.removeItem(selectedBabyKey);
    }

    return deleted;
  },

  /**
   * Get the selected baby ID
   */
  async getSelectedBabyId(storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<string | null> {
    return AsyncStorage.getItem(storageScope.selectedBabyKey);
  },

  /**
   * Set the selected baby ID
   */
  async setSelectedBabyId(id: string | null, storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<void> {
    if (id === null) {
      await AsyncStorage.removeItem(storageScope.selectedBabyKey);
    } else {
      await AsyncStorage.setItem(storageScope.selectedBabyKey, id);
    }
  },

  /**
   * Get the selected baby object
   */
  async getSelectedBaby(storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<StoredBabyProfile | null> {
    const selectedId = await this.getSelectedBabyId(storageScope);
    if (!selectedId) return null;
    return this.getBabyById(selectedId, storageScope);
  },

  /**
   * Clear all local baby data (used when joining a household)
   */
  async clearAllBabies(storageScope: BabyStorageScope = getCurrentStorageScope()): Promise<void> {
    await AsyncStorage.removeItem(storageScope.babiesKey);
    await AsyncStorage.removeItem(storageScope.selectedBabyKey);
  },
};
