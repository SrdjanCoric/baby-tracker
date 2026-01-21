import { AbstractPowerSyncDatabase } from '@powersync/react-native';
import { SyncableEntry, SyncableTable } from './types';

export interface WatchDisposable {
  dispose: () => void;
}

export abstract class SyncableStorageService<T extends SyncableEntry> {
  protected db: AbstractPowerSyncDatabase | null = null;
  protected abstract tableName: SyncableTable;

  setDatabase(db: AbstractPowerSyncDatabase): void {
    this.db = db;
  }

  protected ensureDatabase(): AbstractPowerSyncDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call setDatabase first.');
    }
    return this.db;
  }

  async getAll(babyId: string): Promise<T[]> {
    const db = this.ensureDatabase();
    const results = await db.getAll<T>(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY created_at DESC`,
      [babyId]
    );
    return results.map((row) => this.transformFromDb(row));
  }

  async getById(id: string): Promise<T | null> {
    const db = this.ensureDatabase();
    const result = await db.get<T>(
      `SELECT * FROM ${this.tableName} WHERE id = ?`,
      [id]
    );
    return result ? this.transformFromDb(result) : null;
  }

  async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>, loggedBy: string): Promise<T> {
    const db = this.ensureDatabase();
    const now = new Date().toISOString();
    const id = this.generateId();

    const entry: T = {
      ...data,
      id,
      loggedBy,
      createdAt: now,
      updatedAt: now,
    } as T;

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
    const values = [...Object.values(dbData), id];

    await db.execute(
      `UPDATE ${this.tableName} SET ${setClause} WHERE id = ?`,
      values
    );

    return updatedEntry;
  }

  async delete(id: string): Promise<boolean> {
    const db = this.ensureDatabase();
    const existing = await this.getById(id);
    if (!existing) {
      return false;
    }

    await db.execute(`DELETE FROM ${this.tableName} WHERE id = ?`, [id]);
    return true;
  }

  watch(babyId: string, callback: (entries: T[]) => void): WatchDisposable {
    const db = this.ensureDatabase();
    let isDisposed = false;

    db.watch(
      `SELECT * FROM ${this.tableName} WHERE baby_id = ? ORDER BY created_at DESC`,
      [babyId],
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
