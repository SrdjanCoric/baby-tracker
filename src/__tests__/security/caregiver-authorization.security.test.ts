import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CaregiverService } from '@/services/caregiver-service';

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
    rpc: vi.fn(),
  },
}));

describe('Caregiver Authorization Security', () => {
  const mockHouseholdId = 'household-123';
  const mockOwnerId = 'owner-123';
  const mockNonOwnerId = 'non-owner-456';
  const mockCaregiverId = 'caregiver-789';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Owner Identification', () => {
    it('should identify household owner correctly', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_owner: true },
          error: null,
        }),
      } as never);

      const isOwner = await CaregiverService.isHouseholdOwner(
        mockOwnerId,
        mockHouseholdId
      );

      expect(isOwner).toBe(true);
    });

    it('should correctly identify non-owners', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_owner: false },
          error: null,
        }),
      } as never);

      const isOwner = await CaregiverService.isHouseholdOwner(
        mockNonOwnerId,
        mockHouseholdId
      );

      expect(isOwner).toBe(false);
    });

    it('should return false when user not found in household', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116', message: 'No rows found' },
        }),
      } as never);

      const isOwner = await CaregiverService.isHouseholdOwner(
        'unknown-user',
        mockHouseholdId
      );

      expect(isOwner).toBe(false);
    });
  });

  describe('Caregiver Removal Authorization', () => {
    it('should allow owner to remove any caregiver', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await CaregiverService.removeCaregiver(
        mockCaregiverId,
        mockHouseholdId
      );

      expect(result.error).toBeNull();
      expect(result.data).toBe(true);
    });

    it('should prevent owner from removing themselves', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: 'SELF_REMOVAL', message: 'Cannot remove yourself from household' },
      });

      const result = await CaregiverService.removeCaregiver(
        mockOwnerId,
        mockHouseholdId
      );

      expect(result.error).toBe('cannotRemoveSelf');
      expect(result.data).toBeNull();
    });

    it('should prevent non-owner from removing caregivers', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { code: '42501', message: 'Only household owner can remove members' },
      });

      const result = await CaregiverService.removeCaregiver(
        mockCaregiverId,
        mockHouseholdId
      );

      expect(result.error).toBe('notAuthorized');
      expect(result.data).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle database errors gracefully', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '500', message: 'Database connection error' },
        }),
      } as never);

      const isOwner = await CaregiverService.isHouseholdOwner(
        mockOwnerId,
        mockHouseholdId
      );

      expect(isOwner).toBe(false);
    });

    it('should handle null is_owner field gracefully', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { is_owner: null },
          error: null,
        }),
      } as never);

      const isOwner = await CaregiverService.isHouseholdOwner(
        mockOwnerId,
        mockHouseholdId
      );

      expect(isOwner).toBe(false);
    });

    it('should verify RPC is called with correct parameters', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: { success: true },
        error: null,
      });

      await CaregiverService.removeCaregiver(mockCaregiverId, mockHouseholdId);

      expect(supabase.rpc).toHaveBeenCalledWith('remove_caregiver', {
        caregiver_id: mockCaregiverId,
        household_id: mockHouseholdId,
      });
    });
  });
});
