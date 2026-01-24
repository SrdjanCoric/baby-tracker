/**
 * Baby profile storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserScopedKey } from "./storage-prefix";

const BABIES_KEY_BASE = "@babies";
const SELECTED_BABY_KEY_BASE = "@selected_baby_id";

function getBabiesKey(): string {
  return getUserScopedKey(BABIES_KEY_BASE);
}

function getSelectedBabyKey(): string {
  return getUserScopedKey(SELECTED_BABY_KEY_BASE);
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

export interface CreateBabyInput {
  name: string;
  birthDate?: Date;
  gender?: "male" | "female";
  photoUri?: string;
}

export interface UpdateBabyInput {
  name?: string;
  birthDate?: Date;
  gender?: "male" | "female";
  photoUri?: string;
}

function generateId(): string {
  return `baby-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export const BabyStorageService = {
  /**
   * Get all stored babies
   */
  async getAllBabies(): Promise<StoredBabyProfile[]> {
    const data = await AsyncStorage.getItem(getBabiesKey());
    if (!data) return [];
    return JSON.parse(data) as StoredBabyProfile[];
  },

  /**
   * Get a baby by ID
   */
  async getBabyById(id: string): Promise<StoredBabyProfile | null> {
    const babies = await this.getAllBabies();
    return babies.find(b => b.id === id) ?? null;
  },

  /**
   * Add a new baby
   */
  async addBaby(input: CreateBabyInput): Promise<StoredBabyProfile> {
    const babies = await this.getAllBabies();
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

    babies.push(newBaby);
    await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(babies));

    return newBaby;
  },

  /**
   * Update an existing baby
   */
  async updateBaby(id: string, input: UpdateBabyInput): Promise<StoredBabyProfile | null> {
    const babies = await this.getAllBabies();
    const index = babies.findIndex(b => b.id === id);

    if (index === -1) return null;

    const updatedBaby: StoredBabyProfile = {
      ...babies[index],
      ...(input.name !== undefined && { name: input.name }),
      ...(input.birthDate !== undefined && { birthDate: input.birthDate.toISOString() }),
      ...("gender" in input && { gender: input.gender }),
      ...("photoUri" in input && { photoUri: input.photoUri }),
      updatedAt: new Date().toISOString(),
    };

    babies[index] = updatedBaby;
    await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(babies));

    return updatedBaby;
  },

  /**
   * Delete a baby
   */
  async deleteBaby(id: string): Promise<boolean> {
    const babies = await this.getAllBabies();
    const index = babies.findIndex(b => b.id === id);

    if (index === -1) return false;

    babies.splice(index, 1);
    await AsyncStorage.setItem(getBabiesKey(), JSON.stringify(babies));

    // Clear selected baby if we deleted it
    const selectedId = await this.getSelectedBabyId();
    if (selectedId === id) {
      await this.setSelectedBabyId(null);
    }

    return true;
  },

  /**
   * Get the selected baby ID
   */
  async getSelectedBabyId(): Promise<string | null> {
    return AsyncStorage.getItem(getSelectedBabyKey());
  },

  /**
   * Set the selected baby ID
   */
  async setSelectedBabyId(id: string | null): Promise<void> {
    if (id === null) {
      await AsyncStorage.removeItem(getSelectedBabyKey());
    } else {
      await AsyncStorage.setItem(getSelectedBabyKey(), id);
    }
  },

  /**
   * Get the selected baby object
   */
  async getSelectedBaby(): Promise<StoredBabyProfile | null> {
    const selectedId = await this.getSelectedBabyId();
    if (!selectedId) return null;
    return this.getBabyById(selectedId);
  },
};
