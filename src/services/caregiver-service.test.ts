import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  CaregiverService,
  Caregiver,
  CaregiverStats,
} from './caregiver-service';

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  },
}));

describe('CaregiverService', () => {
  let service: typeof CaregiverService;
  const mockHouseholdId = 'household-123';
  const mockUserId = 'user-1';

  beforeEach(async () => {
    vi.clearAllMocks();
    service = CaregiverService;
  });

  describe('getCurrentUserId', () => {
    it('should return current user ID from Supabase auth', async () => {
      const { supabase } = await import('./supabase');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: { id: 'user-123' } as never },
        error: null,
      });

      const result = await service.getCurrentUserId();

      expect(result).toBe('user-123');
    });

    it('should return null when not authenticated', async () => {
      const { supabase } = await import('./supabase');
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: null,
      });

      const result = await service.getCurrentUserId();

      expect(result).toBeNull();
    });
  });

  describe('getHouseholdCaregivers', () => {
    it('should return all caregivers in household', async () => {
      const { supabase } = await import('./supabase');
      const mockCaregivers = [
        { id: 'user-1', email: 'user1@test.com', display_name: 'User One' },
        { id: 'user-2', email: 'user2@test.com', display_name: 'User Two' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockCaregivers, error: null }),
      } as never);

      const result = await service.getHouseholdCaregivers(mockHouseholdId);

      expect(result.data).toHaveLength(2);
    });

    it('should include display name and email for each', async () => {
      const { supabase } = await import('./supabase');
      const mockCaregivers = [
        { id: 'user-1', email: 'user1@test.com', display_name: 'User One' },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockCaregivers, error: null }),
      } as never);

      const result = await service.getHouseholdCaregivers(mockHouseholdId);

      expect(result.data?.[0]).toMatchObject({
        email: 'user1@test.com',
        displayName: 'User One',
      });
    });

    it('should indicate which member is the owner', async () => {
      const { supabase } = await import('./supabase');
      const mockCaregivers = [
        { id: 'user-1', email: 'user1@test.com', display_name: 'Owner', is_owner: true },
        { id: 'user-2', email: 'user2@test.com', display_name: 'Member', is_owner: false },
      ];

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockCaregivers, error: null }),
      } as never);

      const result = await service.getHouseholdCaregivers(mockHouseholdId);

      expect(result.data?.find((c) => c.isOwner)).toBeTruthy();
    });

    it('should return empty array for single-user household', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as never);

      const result = await service.getHouseholdCaregivers(mockHouseholdId);

      expect(result.data).toEqual([]);
    });
  });

  describe('removeCaregiver', () => {
    it('should allow owner to remove other caregivers', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await service.removeCaregiver(
        'caregiver-to-remove',
        mockHouseholdId
      );

      expect(result.error).toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith('remove_caregiver', {
        caregiver_id: 'caregiver-to-remove',
        household_id: mockHouseholdId,
      });
    });

    it('should reject removal by non-owner', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Only household owner can remove members', code: '42501' },
      });

      const result = await service.removeCaregiver(
        'caregiver-to-remove',
        mockHouseholdId
      );

      expect(result.error).toBe('notAuthorized');
    });

    it('should prevent owner from removing themselves', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Cannot remove yourself', code: 'SELF_REMOVAL' },
      });

      const result = await service.removeCaregiver(mockUserId, mockHouseholdId);

      expect(result.error).toBe('cannotRemoveSelf');
    });
  });

  describe('getCaregiverStats', () => {
    it('should return activity count per caregiver', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { entry_count: 42, last_activity: '2024-01-15T10:00:00Z' },
        error: null,
      });

      const result = await service.getCaregiverStats(
        'caregiver-id',
        mockHouseholdId
      );

      expect(result.data?.entryCount).toBe(42);
    });

    it('should return last activity timestamp per caregiver', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { entry_count: 10, last_activity: '2024-01-15T10:00:00Z' },
        error: null,
      });

      const result = await service.getCaregiverStats(
        'caregiver-id',
        mockHouseholdId
      );

      expect(result.data?.lastActivityAt).toBe('2024-01-15T10:00:00Z');
    });
  });

  describe('getCaregiverDisplayName', () => {
    it('should lookup display name in users table', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { display_name: 'John Doe' },
          error: null,
        }),
      } as never);

      const result = await service.getCaregiverDisplayName('user-123');

      expect(result).toBe('John Doe');
    });

    it('should return email as fallback when no display name', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { display_name: null, email: 'user@test.com' },
          error: null,
        }),
      } as never);

      const result = await service.getCaregiverDisplayName('user-123');

      expect(result).toBe('user@test.com');
    });
  });

  describe('isHouseholdOwner', () => {
    it('should identify household owner correctly', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_owner: true },
          error: null,
        }),
      } as never);

      const result = await service.isHouseholdOwner(
        'user-123',
        mockHouseholdId
      );

      expect(result).toBe(true);
    });

    it('should return false for non-owner', async () => {
      const { supabase } = await import('./supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_owner: false },
          error: null,
        }),
      } as never);

      const result = await service.isHouseholdOwner(
        'user-123',
        mockHouseholdId
      );

      expect(result).toBe(false);
    });
  });
});
