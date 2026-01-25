import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BabySyncStorage, SyncedBaby, CreateSyncedBabyInput } from './baby-storage-sync';

const mockDb = {
  getAll: vi.fn(),
  get: vi.fn(),
  execute: vi.fn(),
  watch: vi.fn(),
};

describe('BabySyncStorageService', () => {
  const householdId = 'household-123';
  const userId = 'user-456';

  beforeEach(() => {
    vi.clearAllMocks();
    BabySyncStorage.setDatabase(mockDb as never);
    BabySyncStorage.setContext({ householdId, userId });
  });

  describe('getAllBabies', () => {
    it('should return babies for current household only', async () => {
      const mockBabies = [
        {
          id: 'baby-1',
          household_id: householdId,
          name: 'Emma',
          birth_date: '2024-01-15',
          gender: 'female',
          photo_url: null,
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
        {
          id: 'baby-2',
          household_id: householdId,
          name: 'Oliver',
          birth_date: null,
          gender: 'male',
          photo_url: null,
          created_at: '2024-02-20T10:00:00Z',
          updated_at: '2024-02-20T10:00:00Z',
        },
      ];
      mockDb.getAll.mockResolvedValue(mockBabies);

      const babies = await BabySyncStorage.getAllBabies();

      expect(mockDb.getAll).toHaveBeenCalledWith(
        expect.stringContaining('WHERE household_id = ?'),
        [householdId]
      );
      expect(babies).toHaveLength(2);
      expect(babies[0].name).toBe('Emma');
      expect(babies[0].householdId).toBe(householdId);
      expect(babies[1].name).toBe('Oliver');
    });

    it('should return empty array when no babies exist', async () => {
      mockDb.getAll.mockResolvedValue([]);

      const babies = await BabySyncStorage.getAllBabies();

      expect(babies).toEqual([]);
    });

    it('should transform snake_case to camelCase', async () => {
      mockDb.getAll.mockResolvedValue([
        {
          id: 'baby-1',
          household_id: householdId,
          name: 'Emma',
          birth_date: '2024-01-15',
          photo_url: 'https://example.com/photo.jpg',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:00:00Z',
        },
      ]);

      const babies = await BabySyncStorage.getAllBabies();

      expect(babies[0].birthDate).toBe('2024-01-15');
      expect(babies[0].photoUrl).toBe('https://example.com/photo.jpg');
      expect(babies[0].createdAt).toBe('2024-01-15T10:00:00Z');
      expect(babies[0].updatedAt).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('getBabyById', () => {
    it('should return baby if it belongs to current household', async () => {
      mockDb.get.mockResolvedValue({
        id: 'baby-1',
        household_id: householdId,
        name: 'Emma',
        birth_date: '2024-01-15',
        gender: 'female',
        photo_url: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });

      const baby = await BabySyncStorage.getBabyById('baby-1');

      expect(mockDb.get).toHaveBeenCalledWith(
        expect.stringContaining('WHERE id = ? AND household_id = ?'),
        ['baby-1', householdId]
      );
      expect(baby).not.toBeNull();
      expect(baby?.name).toBe('Emma');
    });

    it('should return null if baby does not exist', async () => {
      mockDb.get.mockResolvedValue(null);

      const baby = await BabySyncStorage.getBabyById('nonexistent');

      expect(baby).toBeNull();
    });

    it('should not return baby from different household', async () => {
      mockDb.get.mockResolvedValue(null);

      const baby = await BabySyncStorage.getBabyById('baby-from-other-household');

      expect(baby).toBeNull();
    });
  });

  describe('addBaby', () => {
    it('should create baby with household_id from context', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const input: CreateSyncedBabyInput = {
        name: 'Emma',
        birthDate: new Date('2024-01-15'),
        gender: 'female',
      };

      const baby = await BabySyncStorage.addBaby(input, userId);

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO babies'),
        expect.arrayContaining([
          expect.stringMatching(/^baby-/),
          householdId,
          'Emma',
          '2024-01-15T00:00:00.000Z',
          'female',
        ])
      );
      expect(baby.id).toBeDefined();
      expect(baby.householdId).toBe(householdId);
      expect(baby.name).toBe('Emma');
      expect(baby.gender).toBe('female');
    });

    it('should create baby without optional fields', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const input: CreateSyncedBabyInput = {
        name: 'Oliver',
      };

      const baby = await BabySyncStorage.addBaby(input, userId);

      expect(baby.name).toBe('Oliver');
      expect(baby.birthDate).toBeUndefined();
      expect(baby.gender).toBeUndefined();
      expect(baby.photoUrl).toBeUndefined();
    });

    it('should generate unique id', async () => {
      mockDb.execute.mockResolvedValue(undefined);

      const baby1 = await BabySyncStorage.addBaby({ name: 'Emma' }, userId);
      const baby2 = await BabySyncStorage.addBaby({ name: 'Oliver' }, userId);

      expect(baby1.id).not.toBe(baby2.id);
    });
  });

  describe('updateBaby', () => {
    it('should update baby that belongs to current household', async () => {
      mockDb.get.mockResolvedValue({
        id: 'baby-1',
        household_id: householdId,
        name: 'Emma',
        birth_date: '2024-01-15',
        gender: 'female',
        photo_url: null,
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });
      mockDb.execute.mockResolvedValue(undefined);

      const updated = await BabySyncStorage.updateBaby('baby-1', {
        name: 'Emma Grace',
      });

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE babies'),
        expect.arrayContaining(['Emma Grace'])
      );
      expect(updated?.name).toBe('Emma Grace');
    });

    it('should not update baby from different household', async () => {
      mockDb.get.mockResolvedValue(null);

      const updated = await BabySyncStorage.updateBaby('baby-from-other', {
        name: 'Hacked',
      });

      expect(updated).toBeNull();
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should preserve unmodified fields', async () => {
      mockDb.get.mockResolvedValue({
        id: 'baby-1',
        household_id: householdId,
        name: 'Emma',
        birth_date: '2024-01-15',
        gender: 'female',
        photo_url: 'https://example.com/photo.jpg',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });
      mockDb.execute.mockResolvedValue(undefined);

      const updated = await BabySyncStorage.updateBaby('baby-1', {
        name: 'Emma Grace',
      });

      expect(updated?.gender).toBe('female');
      expect(updated?.birthDate).toBe('2024-01-15');
      expect(updated?.photoUrl).toBe('https://example.com/photo.jpg');
    });
  });

  describe('deleteBaby', () => {
    it('should delete baby that belongs to current household', async () => {
      mockDb.get.mockResolvedValue({
        id: 'baby-1',
        household_id: householdId,
        name: 'Emma',
        created_at: '2024-01-15T10:00:00Z',
        updated_at: '2024-01-15T10:00:00Z',
      });
      mockDb.execute.mockResolvedValue(undefined);

      const result = await BabySyncStorage.deleteBaby('baby-1');

      expect(mockDb.execute).toHaveBeenCalledWith(
        expect.stringContaining('DELETE FROM babies'),
        ['baby-1', householdId]
      );
      expect(result).toBe(true);
    });

    it('should not delete baby from different household', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await BabySyncStorage.deleteBaby('baby-from-other');

      expect(result).toBe(false);
      expect(mockDb.execute).not.toHaveBeenCalled();
    });

    it('should return false when baby does not exist', async () => {
      mockDb.get.mockResolvedValue(null);

      const result = await BabySyncStorage.deleteBaby('nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('context validation', () => {
    it('should throw error when context not set', async () => {
      BabySyncStorage.setContext(null as never);

      await expect(BabySyncStorage.getAllBabies()).rejects.toThrow(
        'Storage context not initialized'
      );
    });

    it('should throw error when database not set', async () => {
      BabySyncStorage.setDatabase(null as never);
      BabySyncStorage.setContext({ householdId, userId });

      await expect(BabySyncStorage.getAllBabies()).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('watch', () => {
    it('should watch for changes and transform results', () => {
      const callback = vi.fn();
      mockDb.watch.mockImplementation((_sql, _params, options) => {
        options.onResult({
          rows: {
            _array: [
              {
                id: 'baby-1',
                household_id: householdId,
                name: 'Emma',
                birth_date: '2024-01-15',
                created_at: '2024-01-15T10:00:00Z',
                updated_at: '2024-01-15T10:00:00Z',
              },
            ],
          },
        });
      });

      const disposable = BabySyncStorage.watch(callback);

      expect(mockDb.watch).toHaveBeenCalledWith(
        expect.stringContaining('WHERE household_id = ?'),
        [householdId],
        expect.any(Object)
      );
      expect(callback).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            id: 'baby-1',
            name: 'Emma',
            birthDate: '2024-01-15',
          }),
        ])
      );
      expect(typeof disposable.dispose).toBe('function');
    });
  });
});
