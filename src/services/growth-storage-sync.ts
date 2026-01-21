import { SyncableStorageService } from './sync/syncable-storage';
import { SyncableEntry, SyncableTable } from './sync/types';

export interface SyncedGrowthEntry extends SyncableEntry {
  babyId: string;
  measuredAt: string;
  weightKg?: number;
  heightCm?: number;
  headCm?: number;
  notes?: string;
}

export interface CreateSyncedGrowthInput {
  babyId: string;
  measuredAt: Date;
  weightKg?: number;
  heightCm?: number;
  headCm?: number;
  notes?: string;
}

export interface UpdateSyncedGrowthInput {
  measuredAt?: Date;
  weightKg?: number;
  heightCm?: number;
  headCm?: number;
  notes?: string;
}

class GrowthSyncStorageService extends SyncableStorageService<SyncedGrowthEntry> {
  protected tableName: SyncableTable = 'growth_measurements';

  async getAllGrowthMeasurements(babyId: string): Promise<SyncedGrowthEntry[]> {
    return this.getAll(babyId);
  }

  async getGrowthMeasurementById(
    babyId: string,
    measurementId: string
  ): Promise<SyncedGrowthEntry | null> {
    const measurement = await this.getById(measurementId);
    if (measurement && measurement.babyId === babyId) {
      return measurement;
    }
    return null;
  }

  async addGrowthMeasurement(
    input: CreateSyncedGrowthInput,
    loggedBy: string
  ): Promise<SyncedGrowthEntry> {
    const data = {
      babyId: input.babyId,
      measuredAt: input.measuredAt.toISOString().split('T')[0],
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      headCm: input.headCm,
      notes: input.notes,
      loggedBy,
    };

    return this.create(
      data as Omit<SyncedGrowthEntry, 'id' | 'createdAt' | 'updatedAt'>,
      loggedBy
    );
  }

  async updateGrowthMeasurement(
    babyId: string,
    measurementId: string,
    input: UpdateSyncedGrowthInput
  ): Promise<SyncedGrowthEntry | null> {
    const existing = await this.getGrowthMeasurementById(babyId, measurementId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<SyncedGrowthEntry> = {};

    if (input.measuredAt !== undefined) {
      updateData.measuredAt = input.measuredAt.toISOString().split('T')[0];
    }
    if (input.weightKg !== undefined) {
      updateData.weightKg = input.weightKg;
    }
    if (input.heightCm !== undefined) {
      updateData.heightCm = input.heightCm;
    }
    if (input.headCm !== undefined) {
      updateData.headCm = input.headCm;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    return this.update(measurementId, updateData);
  }

  async deleteGrowthMeasurement(babyId: string, measurementId: string): Promise<boolean> {
    const existing = await this.getGrowthMeasurementById(babyId, measurementId);
    if (!existing) {
      return false;
    }
    return this.delete(measurementId);
  }

  async getLatestGrowthMeasurement(babyId: string): Promise<SyncedGrowthEntry | null> {
    const db = this.ensureDatabase();
    const result = await db.get<SyncedGrowthEntry>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY measured_at DESC LIMIT 1`,
      [babyId]
    );
    return result ? this.transformFromDb(result) : null;
  }
}

export const GrowthSyncStorage = new GrowthSyncStorageService();
