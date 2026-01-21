/**
 * Growth storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUserScopedKey } from "./storage-prefix";

const GROWTH_KEY_PREFIX = "@growth:";

export interface StoredGrowthEntry {
  id: string;
  babyId: string;
  measuredAt: string;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  loggedBy?: string;
}

export interface CreateGrowthInput {
  babyId: string;
  measuredAt: Date;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

export interface UpdateGrowthInput {
  measuredAt?: Date;
  weightKg?: number;
  heightCm?: number;
  headCircumferenceCm?: number;
  notes?: string;
}

function generateId(): string {
  return `growth-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getGrowthKey(babyId: string): string {
  return getUserScopedKey(`${GROWTH_KEY_PREFIX}${babyId}`);
}

export const GrowthStorageService = {
  async getAllMeasurements(babyId: string): Promise<StoredGrowthEntry[]> {
    const data = await AsyncStorage.getItem(getGrowthKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredGrowthEntry[];
  },

  async getMeasurementById(
    babyId: string,
    measurementId: string
  ): Promise<StoredGrowthEntry | null> {
    const measurements = await this.getAllMeasurements(babyId);
    return measurements.find((m) => m.id === measurementId) ?? null;
  },

  async addMeasurement(input: CreateGrowthInput): Promise<StoredGrowthEntry> {
    const measurements = await this.getAllMeasurements(input.babyId);
    const now = new Date().toISOString();

    const newMeasurement: StoredGrowthEntry = {
      id: generateId(),
      babyId: input.babyId,
      measuredAt: input.measuredAt.toISOString(),
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      headCircumferenceCm: input.headCircumferenceCm,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    measurements.push(newMeasurement);
    await AsyncStorage.setItem(getGrowthKey(input.babyId), JSON.stringify(measurements));

    return newMeasurement;
  },

  async updateMeasurement(
    babyId: string,
    measurementId: string,
    input: UpdateGrowthInput
  ): Promise<StoredGrowthEntry | null> {
    const measurements = await this.getAllMeasurements(babyId);
    const index = measurements.findIndex((m) => m.id === measurementId);

    if (index === -1) return null;

    const updatedMeasurement: StoredGrowthEntry = {
      ...measurements[index],
      ...(input.measuredAt !== undefined && { measuredAt: input.measuredAt.toISOString() }),
      ...(input.weightKg !== undefined && { weightKg: input.weightKg }),
      ...(input.heightCm !== undefined && { heightCm: input.heightCm }),
      ...(input.headCircumferenceCm !== undefined && {
        headCircumferenceCm: input.headCircumferenceCm,
      }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date().toISOString(),
    };

    measurements[index] = updatedMeasurement;
    await AsyncStorage.setItem(getGrowthKey(babyId), JSON.stringify(measurements));

    return updatedMeasurement;
  },

  async deleteMeasurement(babyId: string, measurementId: string): Promise<boolean> {
    const measurements = await this.getAllMeasurements(babyId);
    const index = measurements.findIndex((m) => m.id === measurementId);

    if (index === -1) return false;

    measurements.splice(index, 1);
    await AsyncStorage.setItem(getGrowthKey(babyId), JSON.stringify(measurements));

    return true;
  },

  async getLastMeasurement(babyId: string): Promise<StoredGrowthEntry | null> {
    const measurements = await this.getAllMeasurements(babyId);
    if (measurements.length === 0) return null;

    const sorted = [...measurements].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
    );
    return sorted[0];
  },

  async getMeasurementHistory(babyId: string, limit?: number): Promise<StoredGrowthEntry[]> {
    const measurements = await this.getAllMeasurements(babyId);
    const sorted = [...measurements].sort(
      (a, b) => new Date(b.measuredAt).getTime() - new Date(a.measuredAt).getTime()
    );

    if (limit !== undefined) {
      return sorted.slice(0, limit);
    }

    return sorted;
  },
};
