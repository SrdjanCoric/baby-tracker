import { SyncableStorageService } from './sync/syncable-storage';
import { SyncableEntry, SyncableTable } from './sync/types';
import type { DiaperType, StoolColor } from '@/constants/activities';

export interface SyncedDiaperEntry extends SyncableEntry {
  babyId: string;
  type: DiaperType;
  stoolColor?: StoolColor;
  changedAt: string;
  notes?: string;
}

export interface CreateSyncedDiaperInput {
  babyId: string;
  type: DiaperType;
  stoolColor?: StoolColor;
  changedAt: Date;
  notes?: string;
}

export interface UpdateSyncedDiaperInput {
  type?: DiaperType;
  stoolColor?: StoolColor;
  changedAt?: Date;
  notes?: string;
}

class DiaperSyncStorageService extends SyncableStorageService<SyncedDiaperEntry> {
  protected tableName: SyncableTable = 'diapers';

  async getAllDiapers(babyId: string): Promise<SyncedDiaperEntry[]> {
    return this.getAll(babyId);
  }

  async getDiaperById(babyId: string, diaperId: string): Promise<SyncedDiaperEntry | null> {
    const diaper = await this.getById(diaperId);
    if (diaper && diaper.babyId === babyId) {
      return diaper;
    }
    return null;
  }

  async addDiaper(
    input: CreateSyncedDiaperInput,
    loggedBy: string
  ): Promise<SyncedDiaperEntry> {
    const data = {
      babyId: input.babyId,
      type: input.type,
      stoolColor: input.stoolColor,
      changedAt: input.changedAt.toISOString(),
      notes: input.notes,
      loggedBy,
    };

    return this.create(data as Omit<SyncedDiaperEntry, 'id' | 'createdAt' | 'updatedAt'>, loggedBy);
  }

  async updateDiaper(
    babyId: string,
    diaperId: string,
    input: UpdateSyncedDiaperInput
  ): Promise<SyncedDiaperEntry | null> {
    const existing = await this.getDiaperById(babyId, diaperId);
    if (!existing) {
      return null;
    }

    const updateData: Partial<SyncedDiaperEntry> = {};

    if (input.type !== undefined) {
      updateData.type = input.type;
    }
    if (input.stoolColor !== undefined) {
      updateData.stoolColor = input.stoolColor;
    }
    if (input.changedAt !== undefined) {
      updateData.changedAt = input.changedAt.toISOString();
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    return this.update(diaperId, updateData);
  }

  async deleteDiaper(babyId: string, diaperId: string): Promise<boolean> {
    const existing = await this.getDiaperById(babyId, diaperId);
    if (!existing) {
      return false;
    }
    return this.delete(diaperId);
  }

  async getLastDiaper(babyId: string): Promise<SyncedDiaperEntry | null> {
    const db = this.ensureDatabase();
    const result = await db.get<SyncedDiaperEntry>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY changed_at DESC LIMIT 1`,
      [babyId]
    );
    return result ? this.transformFromDb(result) : null;
  }
}

export const DiaperSyncStorage = new DiaperSyncStorageService();
