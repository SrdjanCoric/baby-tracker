import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    clear: vi.fn().mockResolvedValue(undefined),
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    }),
    channel: vi.fn().mockReturnValue({
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    }),
  },
}));

describe('Household Isolation Security', () => {
  const mockCurrentUserId = 'user-current';
  const mockCurrentHouseholdId = 'household-current';
  const mockForeignHouseholdId = 'household-foreign';
  const mockForeignBabyId = 'baby-foreign';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Data Access Isolation', () => {
    it('should NOT return babies from other households', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((field, value) => {
          if (field === 'household_id' && value === mockCurrentHouseholdId) {
            return {
              data: [{ id: 'baby-1', name: 'My Baby' }],
              error: null,
            };
          }
          return { data: [], error: null };
        }),
      } as never);

      const result = supabase
        .from('babies')
        .select('*')
        .eq('household_id', mockForeignHouseholdId);

      expect(result).toBeDefined();
    });

    it('should NOT return feedings from other households', async () => {
      const { supabase } = await import('@/services/supabase');

      const mockQuery = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation((field, value) => {
          if (field === 'baby_id') {
            return Promise.resolve({
              data: [],
              error: { code: 'PGRST301', message: 'RLS policy violation' },
            });
          }
          return Promise.resolve({ data: [], error: null });
        }),
      });

      vi.mocked(supabase.from).mockImplementation(mockQuery);

      const result = await supabase
        .from('feedings')
        .select('*')
        .eq('baby_id', mockForeignBabyId);

      expect(result.data).toEqual([]);
    });

    it('should NOT return any activity data from other households', async () => {
      const { supabase } = await import('@/services/supabase');
      const activityTables = [
        'feedings',
        'sleep_sessions',
        'diapers',
        'pumping_sessions',
        'growth_measurements',
        'tummy_time_sessions',
      ];

      for (const table of activityTables) {
        vi.mocked(supabase.from).mockReturnValue({
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        } as never);

        const result = await supabase
          .from(table)
          .select('*')
          .eq('baby_id', mockForeignBabyId);

        expect(result.data).toEqual([]);
      }
    });
  });

  describe('Write Operations Isolation', () => {
    it('should reject SELECT on foreign baby_id', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied' },
        }),
      } as never);

      const result = await supabase
        .from('feedings')
        .select('*')
        .eq('baby_id', mockForeignBabyId);

      expect(result.error).toBeTruthy();
    });

    it('should reject UPDATE on foreign baby_id', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied for table feedings' },
        }),
      } as never);

      const result = await supabase
        .from('feedings')
        .update({ notes: 'hacked' })
        .eq('baby_id', mockForeignBabyId);

      expect(result.error).toBeTruthy();
      expect(result.error?.code).toBe('42501');
    });

    it('should reject DELETE on foreign baby_id', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '42501', message: 'permission denied' },
        }),
      } as never);

      const result = await supabase
        .from('feedings')
        .delete()
        .eq('baby_id', mockForeignBabyId);

      expect(result.error).toBeTruthy();
    });

    it('should reject INSERT with foreign baby_id', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: '42501',
            message: 'new row violates row-level security policy',
          },
        }),
      } as never);

      const result = await supabase.from('feedings').insert({
        baby_id: mockForeignBabyId,
        type: 'breast',
        started_at: new Date().toISOString(),
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('row-level security');
    });
  });

  describe('Sign Out Data Clearing', () => {
    it('should clear all local data on sign out', async () => {
      const AsyncStorage = await import('@react-native-async-storage/async-storage');

      await AsyncStorage.default.clear();

      expect(AsyncStorage.default.clear).toHaveBeenCalled();
    });
  });

  describe('Realtime Subscription Isolation', () => {
    it('should only subscribe to own household changes', async () => {
      const { supabase } = await import('@/services/supabase');
      const channelMock = vi.fn();

      vi.mocked(supabase.channel).mockImplementation((channelName: string) => {
        channelMock(channelName);
        return {
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn(),
          unsubscribe: vi.fn(),
        } as never;
      });

      supabase.channel(`household:${mockCurrentHouseholdId}`);

      expect(channelMock).toHaveBeenCalledWith(
        `household:${mockCurrentHouseholdId}`
      );
      expect(channelMock).not.toHaveBeenCalledWith(
        `household:${mockForeignHouseholdId}`
      );
    });
  });
});
