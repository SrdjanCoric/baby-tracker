import { AbstractPowerSyncDatabase } from '@powersync/react-native';
import { SyncableStorageContext, WatchDisposable } from './sync/syncable-storage';

export interface SyncedBaby {
  id: string;
  householdId: string;
  name: string;
  birthDate?: string;
  gender?: 'male' | 'female';
  photoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSyncedBabyInput {
  name: string;
  birthDate?: Date;
  gender?: 'male' | 'female';
  photoUrl?: string;
}

export interface UpdateSyncedBabyInput {
  name?: string;
  birthDate?: Date;
  gender?: 'male' | 'female';
  photoUrl?: string;
}

class BabySyncStorageService {
  private db: AbstractPowerSyncDatabase | null = null;
  private context: SyncableStorageContext | null = null;

  setDatabase(db: AbstractPowerSyncDatabase): void {
    this.db = db;
  }

  setContext(context: SyncableStorageContext): void {
    this.context = context;
  }

  private ensureContext(): SyncableStorageContext {
    if (!this.context) {
      throw new Error('Storage context not initialized. Call setContext first.');
    }
    return this.context;
  }

  private ensureDatabase(): AbstractPowerSyncDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }
    return this.db;
  }

  async getAllBabies(): Promise<SyncedBaby[]> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const results = await db.getAll<Record<string, unknown>>(
      `SELECT * FROM babies WHERE household_id = ? ORDER BY created_at DESC`,
      [context.householdId]
    );
    return results.map((row) => this.transformFromDb(row));
  }

  async getBabyById(id: string): Promise<SyncedBaby | null> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const result = await db.get<Record<string, unknown>>(
      `SELECT * FROM babies WHERE id = ? AND household_id = ?`,
      [id, context.householdId]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async addBaby(input: CreateSyncedBabyInput, _loggedBy: string): Promise<SyncedBaby> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const now = new Date().toISOString();
    const id = this.generateId();

    const baby: SyncedBaby = {
      id,
      householdId: context.householdId,
      name: input.name,
      birthDate: input.birthDate?.toISOString(),
      gender: input.gender,
      photoUrl: input.photoUrl,
      createdAt: now,
      updatedAt: now,
    };

    const dbData = this.transformToDb(baby);
    const columns = Object.keys(dbData).filter((key) => dbData[key] !== undefined);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => dbData[col]);

    await db.execute(
      `INSERT INTO babies (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return baby;
  }

  async updateBaby(id: string, input: UpdateSyncedBabyInput): Promise<SyncedBaby | null> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const existing = await this.getBabyById(id);
    if (!existing) {
      return null;
    }

    const updatedBaby: SyncedBaby = {
      ...existing,
      ...(input.name !== undefined && { name: input.name }),
      ...(input.birthDate !== undefined && { birthDate: input.birthDate.toISOString() }),
      ...(input.gender !== undefined && { gender: input.gender }),
      ...(input.photoUrl !== undefined && { photoUrl: input.photoUrl }),
      updatedAt: new Date().toISOString(),
    };

    const dbData = this.transformToDb(updatedBaby);
    delete dbData.id;
    delete dbData.created_at;
    delete dbData.household_id;

    const setClause = Object.keys(dbData)
      .map((col) => `${col} = ?`)
      .join(', ');
    const values = [...Object.values(dbData), id, context.householdId];

    await db.execute(
      `UPDATE babies SET ${setClause} WHERE id = ? AND household_id = ?`,
      values
    );

    return updatedBaby;
  }

  async deleteBaby(id: string): Promise<boolean> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const existing = await this.getBabyById(id);
    if (!existing) {
      return false;
    }

    await db.execute(
      `DELETE FROM babies WHERE id = ? AND household_id = ?`,
      [id, context.householdId]
    );

    return true;
  }

  watch(callback: (babies: SyncedBaby[]) => void): WatchDisposable {
    const db = this.ensureDatabase();
    const context = this.ensureContext();
    let isDisposed = false;

    db.watch(
      `SELECT * FROM babies WHERE household_id = ? ORDER BY created_at DESC`,
      [context.householdId],
      {
        onResult: (result: { rows?: { _array: Record<string, unknown>[] } }) => {
          if (isDisposed) return;
          const babies = (result.rows?._array || []).map((row) =>
            this.transformFromDb(row)
          );
          callback(babies);
        },
      }
    );

    return {
      dispose: () => {
        isDisposed = true;
      },
    };
  }

  private generateId(): string {
    return `baby-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private transformToDb(baby: SyncedBaby): Record<string, unknown> {
    return {
      id: baby.id,
      household_id: baby.householdId,
      name: baby.name,
      birth_date: baby.birthDate,
      gender: baby.gender,
      photo_url: baby.photoUrl,
      created_at: baby.createdAt,
      updated_at: baby.updatedAt,
    };
  }

  private transformFromDb(row: Record<string, unknown>): SyncedBaby {
    return {
      id: row.id as string,
      householdId: row.household_id as string,
      name: row.name as string,
      birthDate: row.birth_date as string | undefined,
      gender: row.gender as 'male' | 'female' | undefined,
      photoUrl: row.photo_url as string | undefined,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
    };
  }
}

export const BabySyncStorage = new BabySyncStorageService();
