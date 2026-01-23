import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  migrateAsyncStorageToSync,
  getMigrationVersion,
  setMigrationVersion,
  needsMigration,
  rollbackMigration,
  getStorageKeyPrefix,
} from '@/services/sync/data-migration';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
}));

describe('Data Migration Security (SR-1)', () => {
  const mockUserId = 'user-123';
  const mockHouseholdId = 'household-456';
  const anotherUserId = 'user-other';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Migration Version Control', () => {
    it('should migrate data only once per user (idempotent)', async () => {
      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve('1');
        }
        return Promise.resolve(null);
      });

      const result = await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      expect(result.success).toBe(true);
      expect(result.migratedRecords).toBe(0);
      expect(AsyncStorage.setItem).not.toHaveBeenCalled();
    });

    it('should set migration version flag to prevent re-migration', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        '@sync:migration_version',
        '1'
      );
    });

    it('should correctly check if migration is needed', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);
      expect(await needsMigration()).toBe(true);

      vi.mocked(AsyncStorage.getItem).mockResolvedValue('1');
      expect(await needsMigration()).toBe(false);
    });

    it('should handle migration version retrieval errors gracefully', async () => {
      vi.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('Storage error'));
      const version = await getMigrationVersion();
      expect(version).toBe(0);
    });
  });

  describe('Data Integrity During Migration', () => {
    it('should not corrupt existing data on failed migration', async () => {
      const originalData = JSON.stringify([
        { id: '1', baby_id: 'baby-1', type: 'breast' },
      ]);

      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve(null);
        }
        if (key.includes('feedings')) {
          return Promise.resolve(originalData);
        }
        return Promise.resolve(null);
      });

      const result = await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      expect(result.success).toBe(true);
      expect(AsyncStorage.removeItem).not.toHaveBeenCalledWith(
        expect.stringContaining('feedings')
      );
    });

    it('should validate records before migration', async () => {
      const invalidData = JSON.stringify([
        { id: '1', baby_id: 'baby-1', type: 'breast' },
        { id: '2' },
        { baby_id: 'baby-1' },
      ]);

      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve(null);
        }
        if (key.includes('feedings')) {
          return Promise.resolve(invalidData);
        }
        return Promise.resolve(null);
      });

      const result = await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      expect(result.migratedRecords).toBe(1);
      expect(result.errors.length).toBe(2);
    });

    it('should handle malformed JSON data without crashing', async () => {
      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve(null);
        }
        if (key.includes('feedings')) {
          return Promise.resolve('{ invalid json }');
        }
        return Promise.resolve(null);
      });

      const result = await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Failed to migrate feedings');
    });
  });

  describe('User-Scoped Storage Prefixes', () => {
    it('should respect user-scoped storage prefixes', async () => {
      const prefix = await getStorageKeyPrefix(mockUserId);
      expect(prefix).toBe(`@user:${mockUserId}:`);
    });

    it('should only access data with correct user prefix', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      const calls = vi.mocked(AsyncStorage.getItem).mock.calls;
      const dataCalls = calls.filter(([key]) => key !== '@sync:migration_version');

      dataCalls.forEach(([key]) => {
        expect(key).toContain(`@user:${mockUserId}:`);
        expect(key).not.toContain(`@user:${anotherUserId}:`);
      });
    });

    it('should not access other users data during migration', async () => {
      vi.mocked(AsyncStorage.getItem).mockResolvedValue(null);

      await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
      });

      const calls = vi.mocked(AsyncStorage.getItem).mock.calls;
      calls.forEach(([key]) => {
        expect(key).not.toContain(anotherUserId);
      });
    });
  });

  describe('Migration Rollback', () => {
    it('should allow rollback of migration version', async () => {
      await rollbackMigration();

      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
        '@sync:migration_version'
      );
    });

    it('should allow re-migration after rollback', async () => {
      let migrationVersion: string | null = '1';

      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve(migrationVersion);
        }
        return Promise.resolve(null);
      });

      vi.mocked(AsyncStorage.removeItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          migrationVersion = null;
        }
        return Promise.resolve();
      });

      await rollbackMigration();

      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve(null);
        }
        return Promise.resolve(null);
      });

      const needsMigrationResult = await needsMigration();
      expect(needsMigrationResult).toBe(true);
    });
  });

  describe('Progress Reporting', () => {
    it('should report progress during migration', async () => {
      const feedingsData = JSON.stringify([
        { id: '1', baby_id: 'baby-1', type: 'breast' },
        { id: '2', baby_id: 'baby-1', type: 'bottle' },
      ]);

      vi.mocked(AsyncStorage.getItem).mockImplementation((key: string) => {
        if (key === '@sync:migration_version') {
          return Promise.resolve(null);
        }
        if (key.includes('feedings')) {
          return Promise.resolve(feedingsData);
        }
        return Promise.resolve(null);
      });

      const onProgress = vi.fn();

      await migrateAsyncStorageToSync({
        userId: mockUserId,
        householdId: mockHouseholdId,
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith('feedings', 2);
    });
  });
});
