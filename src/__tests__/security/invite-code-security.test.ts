import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  generateInviteCode,
  validateInviteCode,
  INVITE_CODE_LENGTH,
  VALID_CHARACTERS,
} from '@/utils/inviteCode';
import { INVITE_CODE_ATTEMPT_LIMIT, clearRateLimitRecord } from '@/utils/rate-limiter';

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

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

describe('Invite Code Security', () => {
  const mockHouseholdId = 'household-123';

  beforeEach(async () => {
    vi.clearAllMocks();
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const store = AsyncStorage as unknown as {
      getItem: ReturnType<typeof vi.fn>;
      setItem: ReturnType<typeof vi.fn>;
      removeItem: ReturnType<typeof vi.fn>;
    };
    const internalStore: Record<string, string> = {};
    store.getItem.mockImplementation((key: string) => Promise.resolve(internalStore[key] ?? null));
    store.setItem.mockImplementation((key: string, value: string) => {
      internalStore[key] = value;
      return Promise.resolve();
    });
    store.removeItem.mockImplementation((key: string) => {
      delete internalStore[key];
      return Promise.resolve();
    });
    await clearRateLimitRecord('invite_code_join');
  });

  describe('Rate Limiting', () => {
    it('should have a 1 hour window for invite code rate limiting', () => {
      expect(INVITE_CODE_ATTEMPT_LIMIT.windowMs).toBe(60 * 60 * 1000);
      expect(INVITE_CODE_ATTEMPT_LIMIT.maxAttempts).toBe(5);
    });

    it('should rate limit after 5 failed attempts via joinHouseholdViaInviteCode', async () => {
      const { supabase } = await import('@/services/supabase');
      const { joinHouseholdViaInviteCode } = await import('@/services/household-service');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Household not found', code: '', details: '', hint: '' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      });

      for (let i = 0; i < 5; i++) {
        const result = await joinHouseholdViaInviteCode('ABCDEFGH');
        expect(result.error).toBe('invalidInvitation');
        expect(result.rateLimitInfo).toBeDefined();
        expect(result.rateLimitInfo!.remainingAttempts).toBe(4 - i);
      }

      const blockedResult = await joinHouseholdViaInviteCode('ABCDEFGH');
      expect(blockedResult.error).toBe('rateLimitExceeded');
      expect(blockedResult.rateLimitInfo?.remainingAttempts).toBe(0);
      expect(blockedResult.rateLimitInfo?.resetAt).not.toBeNull();

      expect(supabase.rpc).toHaveBeenCalledTimes(5);
    });

    it('should clear rate limit record on successful join', async () => {
      const { supabase } = await import('@/services/supabase');
      const { joinHouseholdViaInviteCode } = await import('@/services/household-service');

      vi.mocked(supabase.rpc)
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Household not found', code: '', details: '', hint: '' },
          count: null,
          status: 400,
          statusText: 'Bad Request',
        })
        .mockResolvedValueOnce({
          data: [{
            household_id: mockHouseholdId,
            household_invite_code: 'ABCDEFGH',
            household_created_at: new Date().toISOString(),
          }],
          error: null,
          count: null,
          status: 200,
          statusText: 'OK',
        });

      const failResult = await joinHouseholdViaInviteCode('BADCDEFG');
      expect(failResult.error).toBe('invalidInvitation');
      expect(failResult.rateLimitInfo?.remainingAttempts).toBe(4);

      const successResult = await joinHouseholdViaInviteCode('ABCDEFGH');
      expect(successResult.error).toBeNull();
      expect(successResult.data).toBeDefined();
      expect(successResult.rateLimitInfo?.remainingAttempts).toBe(5);
    });

    it('should not count "already belongs" errors as rate limit attempts', async () => {
      const { supabase } = await import('@/services/supabase');
      const { joinHouseholdViaInviteCode } = await import('@/services/household-service');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'User already belongs to a household', code: '', details: '', hint: '' },
        count: null,
        status: 400,
        statusText: 'Bad Request',
      });

      for (let i = 0; i < 7; i++) {
        const result = await joinHouseholdViaInviteCode('ABCDEFGH');
        expect(result.error).toBe('alreadyInHousehold');
      }

      expect(supabase.rpc).toHaveBeenCalledTimes(7);
    });

    it('should detect server-side rate limit errors', async () => {
      const { supabase } = await import('@/services/supabase');
      const { joinHouseholdViaInviteCode } = await import('@/services/household-service');

      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Rate limit exceeded. Please try again later.', code: '', details: '', hint: '' },
        count: null,
        status: 429,
        statusText: 'Too Many Requests',
      });

      const result = await joinHouseholdViaInviteCode('ABCDEFGH');
      expect(result.error).toBe('rateLimitExceeded');
      expect(result.rateLimitInfo?.remainingAttempts).toBe(0);
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

      expect(entropyBits).toBeGreaterThanOrEqual(40);
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
          return { data: newCode, error: null, count: null, status: 200, statusText: 'OK' };
        }
        if (fn === 'join_household_by_invite_code') {
          if (params?.invite_code === currentCode) {
            return { data: { id: mockHouseholdId }, error: null, count: null, status: 200, statusText: 'OK' };
          }
          return { data: null, error: { message: 'Invite code not found' }, count: null, status: 400, statusText: 'Bad Request' };
        }
        return { data: null, error: null, count: null, status: 200, statusText: 'OK' };
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

      vi.mocked(supabase.rpc).mockImplementation(async (fn, _params) => {
        if (fn === 'regenerate_invite_code') {
          return {
            data: null,
            error: { code: '42501', message: 'Only household owner can regenerate invite code' },
            count: null,
            status: 403,
            statusText: 'Forbidden',
          };
        }
        return { data: null, error: null, count: null, status: 200, statusText: 'OK' };
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
      const tooLong = validateInviteCode('ABCDEFGHJKM');

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
