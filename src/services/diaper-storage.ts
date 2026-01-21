/**
 * Diaper storage service using AsyncStorage
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { DiaperType, StoolColor } from "@/constants/activities";
import { getUserScopedKey } from "./storage-prefix";

const DIAPERS_KEY_PREFIX = "@diapers:";

export interface StoredDiaperEntry {
  id: string;
  babyId: string;
  type: DiaperType;
  stoolColor?: StoolColor;
  changedAt: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDiaperInput {
  babyId: string;
  type: DiaperType;
  stoolColor?: StoolColor;
  changedAt: Date;
  notes?: string;
}

export interface UpdateDiaperInput {
  type?: DiaperType;
  stoolColor?: StoolColor;
  changedAt?: Date;
  notes?: string;
}

export interface DiaperCounts {
  wet: number;
  dirty: number;
  mixed: number;
  total: number;
}

function generateId(): string {
  return `diaper-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function getDiapersKey(babyId: string): string {
  return getUserScopedKey(`${DIAPERS_KEY_PREFIX}${babyId}`);
}

function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

export const DiaperStorageService = {
  async getAllDiapers(babyId: string): Promise<StoredDiaperEntry[]> {
    const data = await AsyncStorage.getItem(getDiapersKey(babyId));
    if (!data) return [];
    return JSON.parse(data) as StoredDiaperEntry[];
  },

  async getDiaperById(babyId: string, diaperId: string): Promise<StoredDiaperEntry | null> {
    const diapers = await this.getAllDiapers(babyId);
    return diapers.find(d => d.id === diaperId) ?? null;
  },

  async addDiaper(input: CreateDiaperInput): Promise<StoredDiaperEntry> {
    const diapers = await this.getAllDiapers(input.babyId);
    const now = new Date().toISOString();

    const newDiaper: StoredDiaperEntry = {
      id: generateId(),
      babyId: input.babyId,
      type: input.type,
      stoolColor: input.stoolColor,
      changedAt: input.changedAt.toISOString(),
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };

    diapers.push(newDiaper);
    await AsyncStorage.setItem(getDiapersKey(input.babyId), JSON.stringify(diapers));

    return newDiaper;
  },

  async updateDiaper(
    babyId: string,
    diaperId: string,
    input: UpdateDiaperInput
  ): Promise<StoredDiaperEntry | null> {
    const diapers = await this.getAllDiapers(babyId);
    const index = diapers.findIndex(d => d.id === diaperId);

    if (index === -1) return null;

    const updatedDiaper: StoredDiaperEntry = {
      ...diapers[index],
      ...(input.type !== undefined && { type: input.type }),
      ...(input.stoolColor !== undefined && { stoolColor: input.stoolColor }),
      ...(input.changedAt !== undefined && { changedAt: input.changedAt.toISOString() }),
      ...(input.notes !== undefined && { notes: input.notes }),
      updatedAt: new Date().toISOString(),
    };

    diapers[index] = updatedDiaper;
    await AsyncStorage.setItem(getDiapersKey(babyId), JSON.stringify(diapers));

    return updatedDiaper;
  },

  async deleteDiaper(babyId: string, diaperId: string): Promise<boolean> {
    const diapers = await this.getAllDiapers(babyId);
    const index = diapers.findIndex(d => d.id === diaperId);

    if (index === -1) return false;

    diapers.splice(index, 1);
    await AsyncStorage.setItem(getDiapersKey(babyId), JSON.stringify(diapers));

    return true;
  },

  async getLastDiaper(babyId: string): Promise<StoredDiaperEntry | null> {
    const diapers = await this.getAllDiapers(babyId);
    if (diapers.length === 0) return null;

    const sorted = [...diapers].sort((a, b) =>
      new Date(b.changedAt).getTime() - new Date(a.changedAt).getTime()
    );
    return sorted[0];
  },

  async getTodaysDiapers(babyId: string): Promise<StoredDiaperEntry[]> {
    const diapers = await this.getAllDiapers(babyId);
    return diapers.filter(d => isToday(new Date(d.changedAt)));
  },

  async getTodaysDiaperCounts(babyId: string): Promise<DiaperCounts> {
    const todaysDiapers = await this.getTodaysDiapers(babyId);

    const counts: DiaperCounts = {
      wet: 0,
      dirty: 0,
      mixed: 0,
      total: todaysDiapers.length,
    };

    for (const diaper of todaysDiapers) {
      counts[diaper.type]++;
    }

    return counts;
  },
};
