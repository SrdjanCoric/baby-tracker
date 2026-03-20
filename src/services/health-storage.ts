import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HealthType, MeasurementMethod, SymptomType, DosageUnit } from "@/constants/activities";
import { getUserScopedKey } from "./storage-prefix";

const HEALTH_KEY_PREFIX = "@health:";

export interface StoredHealthEntry {
  id: string;
  babyId: string;
  type: HealthType;
  loggedAt: string;
  notes?: string;
  medicationName?: string;
  dosageAmount?: number;
  dosageUnit?: DosageUnit;
  doseNumber?: number;
  temperatureCelsius?: number;
  measurementMethod?: MeasurementMethod;
  vaccineName?: string;
  symptoms?: SymptomType[];
  loggedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateHealthInput {
  babyId: string;
  type: HealthType;
  loggedAt: Date;
  notes?: string;
  medicationName?: string;
  dosageAmount?: number;
  dosageUnit?: DosageUnit;
  doseNumber?: number;
  temperatureCelsius?: number;
  measurementMethod?: MeasurementMethod;
  vaccineName?: string;
  symptoms?: SymptomType[];
}

export interface UpdateHealthInput {
  type?: HealthType;
  loggedAt?: Date;
  notes?: string | null;
  medicationName?: string | null;
  dosageAmount?: number | null;
  dosageUnit?: DosageUnit | null;
  doseNumber?: number | null;
  temperatureCelsius?: number | null;
  measurementMethod?: MeasurementMethod | null;
  vaccineName?: string | null;
  symptoms?: SymptomType[] | null;
}

function generateId(): string {
  return `health-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getHealthKey(babyId: string): string {
  return getUserScopedKey(`${HEALTH_KEY_PREFIX}${babyId}`);
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const HealthStorageService = {
  async getAllHealth(babyId: string): Promise<StoredHealthEntry[]> {
    const data = await AsyncStorage.getItem(getHealthKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredHealthEntry[];
  },

  async getHealthById(babyId: string, healthId: string): Promise<StoredHealthEntry | null> {
    const entries = await this.getAllHealth(babyId);
    return entries.find(h => h.id === healthId) ?? null;
  },

  async addHealth(input: CreateHealthInput): Promise<StoredHealthEntry> {
    if (input.dosageAmount !== undefined && input.dosageAmount <= 0) {
      throw new Error("Dosage amount must be greater than 0");
    }

    const entries = await this.getAllHealth(input.babyId);
    const now = new Date().toISOString();

    const newHealth: StoredHealthEntry = {
      id: generateId(),
      babyId: input.babyId,
      type: input.type,
      loggedAt: input.loggedAt.toISOString(),
      notes: input.notes,
      medicationName: input.medicationName,
      dosageAmount: input.dosageAmount,
      dosageUnit: input.dosageUnit,
      doseNumber: input.doseNumber,
      temperatureCelsius: input.temperatureCelsius,
      measurementMethod: input.measurementMethod,
      vaccineName: input.vaccineName,
      symptoms: input.symptoms,
      createdAt: now,
      updatedAt: now,
    };

    entries.push(newHealth);
    await AsyncStorage.setItem(getHealthKey(input.babyId), JSON.stringify(entries));

    return newHealth;
  },

  async updateHealth(
    babyId: string,
    healthId: string,
    input: UpdateHealthInput
  ): Promise<StoredHealthEntry | null> {
    if (input.dosageAmount !== undefined && input.dosageAmount !== null && input.dosageAmount <= 0) {
      throw new Error("Dosage amount must be greater than 0");
    }

    const entries = await this.getAllHealth(babyId);
    const index = entries.findIndex(h => h.id === healthId);

    if (index === -1) return null;

    const updatedHealth: StoredHealthEntry = {
      ...entries[index],
      ...(input.type !== undefined && { type: input.type }),
      ...(input.loggedAt !== undefined && { loggedAt: input.loggedAt!.toISOString() }),
      updatedAt: new Date().toISOString(),
    };

    const nullableFields = [
      "notes", "medicationName", "dosageAmount", "dosageUnit",
      "doseNumber", "temperatureCelsius", "measurementMethod",
      "vaccineName", "symptoms",
    ] as const;

    for (const field of nullableFields) {
      if (input[field] !== undefined) {
        if (input[field] === null) {
          delete (updatedHealth as unknown as Record<string, unknown>)[field];
        } else {
          (updatedHealth as unknown as Record<string, unknown>)[field] = input[field];
        }
      }
    }

    entries[index] = updatedHealth;
    await AsyncStorage.setItem(getHealthKey(babyId), JSON.stringify(entries));

    return updatedHealth;
  },

  async deleteHealth(babyId: string, healthId: string): Promise<boolean> {
    const entries = await this.getAllHealth(babyId);
    const index = entries.findIndex(h => h.id === healthId);

    if (index === -1) return false;

    entries.splice(index, 1);
    await AsyncStorage.setItem(getHealthKey(babyId), JSON.stringify(entries));

    return true;
  },

  async getLastHealth(babyId: string): Promise<StoredHealthEntry | null> {
    const entries = await this.getAllHealth(babyId);
    if (entries.length === 0) return null;

    const sorted = [...entries].sort((a, b) =>
      new Date(b.loggedAt).getTime() - new Date(a.loggedAt).getTime()
    );
    return sorted[0];
  },

  async getTodaysHealth(babyId: string): Promise<StoredHealthEntry[]> {
    const entries = await this.getAllHealth(babyId);
    return entries.filter(h => isToday(new Date(h.loggedAt)));
  },

  async getTodaysHealthCount(babyId: string): Promise<number> {
    const todaysEntries = await this.getTodaysHealth(babyId);
    return todaysEntries.length;
  },
};
