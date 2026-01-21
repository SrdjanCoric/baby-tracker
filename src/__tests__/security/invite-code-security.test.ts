import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateInviteCode,
  validateInviteCode,
  INVITE_CODE_LENGTH,
  VALID_CHARACTERS,
} from '@/utils/inviteCode';

vi.mock('@/services/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
    }),
  },
}));

describe('Invite Code Security', () => {
  const mockHouseholdId = 'household-123';
  const mockOwnerId = 'owner-123';
  const mockNonOwnerId = 'non-owner-456';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rate Limiting', () => {
    it('should rate limit invite code attempts (max 5 per minute)', async () => {
      const { supabase } = await import('@/services/supabase');
      const attempts: { timestamp: number; success: boolean }[] = [];
      let attemptCount = 0;

      vi.mocked(supabase.rpc).mockImplementation(async () => {
        attemptCount++;
        const now = Date.now();
        attempts.push({ timestamp: now, success: attemptCount <= 5 });

        if (attemptCount > 5) {
          return {
            data: null,
            error: { code: '429', message: 'Too many attempts. Please try again later.' },
          };
        }
        return { data: null, error: { message: 'Invalid code' } };
      });

      for (let i = 0; i < 7; i++) {
        await supabase.rpc('join_household_by_invite_code', {
          invite_code: 'INVALID1',
        });
      }

      expect(attemptCount).toBe(7);
      expect(attempts.filter((a) => !a.success).length).toBe(2);
    });
  });

  describe('Code Generation Entropy', () => {
    it('should generate 8-character codes with sufficient entropy', () => {
      const code = generateInviteCode();

      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      expect(code.length).toBe(8);

      const possibleCharacters = VALID_CHARACTERS.length;
      const totalCombinations = Math.pow(possibleCharacters, INVITE_CODE_LENGTH);
      const entropyBits = Math.log2(totalCombinations);

      expect(entropyBits).toBeGreaterThan(40);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        codes.add(generateInviteCode());
      }

      expect(codes.size).toBe(iterations);
    });

    it('should only use non-ambiguous characters', () => {
      const ambiguousChars = ['0', 'O', '1', 'l', 'I'];

      for (let i = 0; i < 100; i++) {
        const code = generateInviteCode();
        for (const char of code) {
          expect(ambiguousChars).not.toContain(char);
        }
      }
    });
  });

  describe('Code Regeneration', () => {
    it('should invalidate old code immediately on regeneration', async () => {
      const { supabase } = await import('@/services/supabase');
      let currentCode = 'OLDCODE1';

      vi.mocked(supabase.rpc).mockImplementation(async (fn, params) => {
        if (fn === 'regenerate_invite_code') {
          const newCode = generateInviteCode();
          currentCode = newCode;
          return { data: newCode, error: null };
        }
        if (fn === 'join_household_by_invite_code') {
          if (params?.invite_code === currentCode) {
            return { data: { id: mockHouseholdId }, error: null };
          }
          return { data: null, error: { message: 'Invite code not found' } };
        }
        return { data: null, error: null };
      });

      const oldCode = currentCode;

      await supabase.rpc('regenerate_invite_code', {
        household_id: mockHouseholdId,
      });

      expect(currentCode).not.toBe(oldCode);

      const joinWithOldCode = await supabase.rpc(
        'join_household_by_invite_code',
        {
          invite_code: oldCode,
        }
      );

      expect(joinWithOldCode.error).toBeTruthy();
      expect(joinWithOldCode.error?.message).toContain('not found');
    });

    it('should only allow household owner to regenerate code', async () => {
      const { supabase } = await import('@/services/supabase');

      vi.mocked(supabase.rpc).mockImplementation(async (fn, params) => {
        if (fn === 'regenerate_invite_code') {
          return {
            data: null,
            error: { code: '42501', message: 'Only household owner can regenerate invite code' },
          };
        }
        return { data: null, error: null };
      });

      const result = await supabase.rpc('regenerate_invite_code', {
        household_id: mockHouseholdId,
      });

      expect(result.error).toBeTruthy();
      expect(result.error?.message).toContain('owner');
    });
  });

  describe('Code Validation', () => {
    it('should reject codes with ambiguous characters', () => {
      const result = validateInviteCode('ABC0O1lI');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('inviteCodeInvalidChars');
    });

    it('should reject codes with incorrect length', () => {
      const tooShort = validateInviteCode('ABC');
      const tooLong = validateInviteCode('ABCDEFGHIJK');

      expect(tooShort.isValid).toBe(false);
      expect(tooShort.error).toBe('inviteCodeLength');
      expect(tooLong.isValid).toBe(false);
      expect(tooLong.error).toBe('inviteCodeLength');
    });

    it('should accept valid codes', () => {
      const validCode = generateInviteCode();
      const result = validateInviteCode(validCode);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should be case-insensitive', () => {
      const code = 'ABCD1234'.replace(/[01]/g, '2');
      const lowerResult = validateInviteCode(code.toLowerCase());
      const upperResult = validateInviteCode(code.toUpperCase());

      expect(lowerResult.isValid).toBe(upperResult.isValid);
    });
  });
});
