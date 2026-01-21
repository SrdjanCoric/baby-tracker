import { AbstractPowerSyncDatabase } from '@powersync/react-native';
import { SyncableEntry, SyncableTable } from './types';

export interface WatchDisposable {
  dispose: () => void;
}

export interface SyncableStorageContext {
  householdId: string;
  userId: string;
}

export abstract class SyncableStorageService<T extends SyncableEntry> {
  protected db: AbstractPowerSyncDatabase | null = null;
  protected abstract tableName: SyncableTable;
  protected context: SyncableStorageContext | null = null;

  setDatabase(db: AbstractPowerSyncDatabase): void {
    this.db = db;
  }

  setContext(context: SyncableStorageContext): void {
    this.context = context;
  }

  protected ensureContext(): SyncableStorageContext {
    if (!this.context) {
      throw new Error('Storage context not initialized. Call setContext first.');
    }
    return this.context;
  }

  protected ensureDatabase(): AbstractPowerSyncDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }
    return this.db;
  }

  async getAll(babyId: string): Promise<T[]> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const results = await db.getAll<T>(
      `SELECT t.* FROM ${this.tableName} t
       INNER JOIN babies b ON t.baby_id = b.id
       WHERE t.baby_id = ? AND b.household_id = ?
       ORDER BY t.created_at DESC`,
      [babyId, context.householdId]
    );
    return results.map((row) => this.transformFromDb(row));
  }

  async getById(id: string, _babyId?: string): Promise<T | null> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const result = await db.get<T>(
      `SELECT t.* FROM ${this.tableName} t
       INNER JOIN babies b ON t.baby_id = b.id
       WHERE t.id = ? AND b.household_id = ?`,
      [id, context.householdId]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async verifyBabyBelongsToHousehold(babyId: string): Promise<boolean> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const result = await db.get<{ id: string }>(
      `SELECT id FROM babies WHERE id = ? AND household_id = ?`,
      [babyId, context.householdId]
    );
    return result !== null;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { babyId: string }, loggedBy: string): Promise<T> {
    const db = this.ensureDatabase();
    this.ensureContext();
    const now = new Date().toISOString();
    const id = this.generateId();

    const babyId = (data as { babyId: string }).babyId;
    const isValidBaby = await this.verifyBabyBelongsToHousehold(babyId);
    if (!isValidBaby) {
      throw new Error('Cannot create entry: baby does not belong to current household');
    }

    const entry = {
      ...data,
      id,
      loggedBy,
      createdAt: now,
      updatedAt: now,
    } as unknown as T;

    const dbData = this.transformToDb(entry);
    const columns = Object.keys(dbData);
    const placeholders = columns.map(() => '?').join(', ');
    const values = columns.map((col) => dbData[col]);

    await db.execute(
      `INSERT INTO ${this.tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
      values
    );

    return entry;
  }

  async update(id: string, data: Partial<T>): Promise<T | null> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const existing = await this.getById(id);
    if (!existing) {
      return null;
    }

    const updatedEntry: T = {
      ...existing,
      ...data,
      id: existing.id,
      loggedBy: existing.loggedBy,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };

    const dbData = this.transformToDb(updatedEntry);
    delete dbData.id;
    delete dbData.created_at;

    const setClause = Object.keys(dbData)
      .map((col) => `${col} = ?`)
      .join(', ');
    const values = [...Object.values(dbData), id, context.householdId];

    await db.execute(
      `UPDATE ${this.tableName} t SET ${setClause}
       WHERE t.id = ? AND EXISTS (
         SELECT 1 FROM babies b WHERE b.id = t.baby_id AND b.household_id = ?
       )`,
      values
    );

    return updatedEntry;
  }

  async delete(id: string): Promise<boolean> {
    const db = this.ensureDatabase();
    const context = this.ensureContext();

    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    await db.execute(
      `DELETE FROM ${this.tableName}
       WHERE id = ? AND EXISTS (
         SELECT 1 FROM babies b WHERE b.id = baby_id AND b.household_id = ?
       )`,
      [id, context.householdId]
    );
    return true;
  }

  watch(babyId: string, callback: (entries: T[]) => void): WatchDisposable {
    const db = this.ensureDatabase();
    const context = this.ensureContext();
    let isDisposed = false;

    db.watch(
      `SELECT t.* FROM ${this.tableName} t
       INNER JOIN babies b ON t.baby_id = b.id
       WHERE t.baby_id = ? AND b.household_id = ?
       ORDER BY t.created_at DESC`,
      [babyId, context.householdId],
      {
        onResult: (result: { rows?: { _array: T[] } }) => {
          if (isDisposed) return;
          const entries = (result.rows?._array || []).map((row: T) =>
            this.transformFromDb(row)
          );
          callback(entries);
        },
      }
    );

    return {
      dispose: () => {
        isDisposed = true;
      },
    };
  }

  protected generateId(): string {
    return `${this.tableName.slice(0, -1)}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  protected transformToDb(entry: T): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(entry)) {
      const snakeKey = this.camelToSnake(key);
      result[snakeKey] = value;
    }
    return result;
  }

  protected transformFromDb(row: T): T {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
      const camelKey = this.snakeToCamel(key);
      result[camelKey] = value;
    }
    return result as T;
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  }

  private snakeToCamel(str: string): string {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
  }
}
