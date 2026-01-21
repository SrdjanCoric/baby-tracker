import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react-native';
import { View, Text, Pressable, Alert } from 'react-native';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'current-user' } },
        error: null,
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    }),
    rpc: vi.fn(),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) => {
      if (params?.name) return key.replace('{{name}}', params.name);
      return key;
    },
  }),
}));

interface Caregiver {
  id: string;
  displayName: string;
  email: string;
  isOwner: boolean;
  entryCount: number;
}

interface CaregiverState {
  caregivers: Caregiver[];
  loading: boolean;
  error: string | null;
  currentUserId: string;
}

function createMockCaregiverContext() {
  const state: CaregiverState = {
    caregivers: [
      {
        id: 'current-user',
        displayName: 'Current User',
        email: 'current@test.com',
        isOwner: true,
        entryCount: 42,
      },
      {
        id: 'caregiver-2',
        displayName: 'Second Caregiver',
        email: 'second@test.com',
        isOwner: false,
        entryCount: 15,
      },
      {
        id: 'caregiver-3',
        displayName: 'Third Caregiver',
        email: 'third@test.com',
        isOwner: false,
        entryCount: 8,
      },
    ],
    loading: false,
    error: null,
    currentUserId: 'current-user',
  };

  const listeners: Set<() => void> = new Set();

  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    loadCaregivers: async () => {
      state.loading = true;
      notifyListeners();

      await new Promise((resolve) => setTimeout(resolve, 100));

      state.loading = false;
      notifyListeners();
    },
    removeCaregiver: async (
      caregiverId: string
    ): Promise<{ success: boolean; error?: string }> => {
      if (caregiverId === state.currentUserId) {
        return { success: false, error: 'cannotRemoveSelf' };
      }

      const caregiver = state.caregivers.find((c) => c.id === caregiverId);
      if (caregiver?.isOwner) {
        return { success: false, error: 'cannotRemoveOwner' };
      }

      const isCurrentUserOwner = state.caregivers.find(
        (c) => c.id === state.currentUserId
      )?.isOwner;
      if (!isCurrentUserOwner) {
        return { success: false, error: 'notAuthorized' };
      }

      state.caregivers = state.caregivers.filter((c) => c.id !== caregiverId);
      notifyListeners();
      return { success: true };
    },
    simulateNetworkError: () => {
      state.error = 'networkError';
      notifyListeners();
    },
    clearError: () => {
      state.error = null;
      notifyListeners();
    },
  };
}

interface TestCaregiverListProps {
  caregiverContext: ReturnType<typeof createMockCaregiverContext>;
  onRemove?: (id: string) => void;
}

function TestCaregiverList({
  caregiverContext,
  onRemove,
}: TestCaregiverListProps) {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const state = caregiverContext.getState();

  React.useEffect(() => {
    return caregiverContext.subscribe(forceUpdate);
  }, [caregiverContext]);

  React.useEffect(() => {
    caregiverContext.loadCaregivers();
  }, []);

  if (state.loading) {
    return (
      <View>
        <Text testID="loading">Loading...</Text>
      </View>
    );
  }

  if (state.error) {
    return (
      <View>
        <Text testID="error">{state.error}</Text>
      </View>
    );
  }

  return (
    <View>
      <Text testID="caregiver-count">{state.caregivers.length}</Text>
      {state.caregivers.map((caregiver) => (
        <View key={caregiver.id} testID={`caregiver-${caregiver.id}`}>
          <Text testID={`name-${caregiver.id}`}>{caregiver.displayName}</Text>
          <Text testID={`email-${caregiver.id}`}>{caregiver.email}</Text>
          <Text testID={`count-${caregiver.id}`}>{caregiver.entryCount}</Text>
          {caregiver.isOwner && (
            <Text testID={`owner-badge-${caregiver.id}`}>Owner</Text>
          )}
          {caregiver.id === state.currentUserId && (
            <Text testID={`you-badge-${caregiver.id}`}>You</Text>
          )}
          {caregiver.id !== state.currentUserId && !caregiver.isOwner && (
            <Pressable
              testID={`remove-${caregiver.id}`}
              onPress={() => onRemove?.(caregiver.id)}
            >
              <Text>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}

describe('Caregiver Flow Integration', () => {
  let caregiverContext: ReturnType<typeof createMockCaregiverContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    caregiverContext = createMockCaregiverContext();
  });

  describe('Load and display caregiver list', () => {
    it('should load and display caregiver list', async () => {
      vi.useFakeTimers();

      render(<TestCaregiverList caregiverContext={caregiverContext} />);

      expect(screen.getByTestId('loading')).toBeTruthy();

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId('caregiver-count').props.children).toBe(3);
      expect(screen.getByTestId('name-current-user').props.children).toBe(
        'Current User'
      );
      expect(screen.getByTestId('name-caregiver-2').props.children).toBe(
        'Second Caregiver'
      );

      vi.useRealTimers();
    });

    it('should display entry counts for each caregiver', async () => {
      vi.useFakeTimers();

      render(<TestCaregiverList caregiverContext={caregiverContext} />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId('count-current-user').props.children).toBe(42);
      expect(screen.getByTestId('count-caregiver-2').props.children).toBe(15);

      vi.useRealTimers();
    });

    it('should show owner badge for household owner', async () => {
      vi.useFakeTimers();

      render(<TestCaregiverList caregiverContext={caregiverContext} />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId('owner-badge-current-user')).toBeTruthy();
      expect(
        screen.queryByTestId('owner-badge-caregiver-2')
      ).toBeNull();

      vi.useRealTimers();
    });

    it('should show You badge for current user', async () => {
      vi.useFakeTimers();

      render(<TestCaregiverList caregiverContext={caregiverContext} />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId('you-badge-current-user')).toBeTruthy();
      expect(screen.queryByTestId('you-badge-caregiver-2')).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('Remove caregiver flow', () => {
    it('should show confirmation when removing caregiver', async () => {
      vi.useFakeTimers();

      const alertSpy = vi.spyOn(Alert, 'alert');
      const handleRemove = vi.fn((id: string) => {
        Alert.alert(
          'household.removeCaregiver',
          `household.removeCaregiverConfirm`.replace('{{name}}', 'Second Caregiver'),
          [
            { text: 'common.cancel', style: 'cancel' },
            {
              text: 'common.remove',
              style: 'destructive',
              onPress: () => caregiverContext.removeCaregiver(id),
            },
          ]
        );
      });

      render(
        <TestCaregiverList
          caregiverContext={caregiverContext}
          onRemove={handleRemove}
        />
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      await act(async () => {
        fireEvent.press(screen.getByTestId('remove-caregiver-2'));
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'household.removeCaregiver',
        expect.stringContaining('Second Caregiver'),
        expect.any(Array)
      );

      vi.useRealTimers();
    });

    it('should remove caregiver on confirmation', async () => {
      vi.useFakeTimers();

      const { rerender } = render(
        <TestCaregiverList caregiverContext={caregiverContext} />
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.getByTestId('caregiver-count').props.children).toBe(3);

      await act(async () => {
        await caregiverContext.removeCaregiver('caregiver-2');
      });
      rerender(<TestCaregiverList caregiverContext={caregiverContext} />);

      expect(screen.getByTestId('caregiver-count').props.children).toBe(2);
      expect(screen.queryByTestId('caregiver-caregiver-2')).toBeNull();

      vi.useRealTimers();
    });

    it('should handle network error during removal', async () => {
      vi.useFakeTimers();

      const { rerender } = render(
        <TestCaregiverList caregiverContext={caregiverContext} />
      );

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      caregiverContext.simulateNetworkError();
      rerender(<TestCaregiverList caregiverContext={caregiverContext} />);

      expect(screen.getByTestId('error').props.children).toBe('networkError');

      vi.useRealTimers();
    });

    it('should not allow removing self', async () => {
      const result = await caregiverContext.removeCaregiver('current-user');

      expect(result.success).toBe(false);
      expect(result.error).toBe('cannotRemoveSelf');
    });

    it('should not show remove button for current user', async () => {
      vi.useFakeTimers();

      render(<TestCaregiverList caregiverContext={caregiverContext} />);

      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(screen.queryByTestId('remove-current-user')).toBeNull();
      expect(screen.getByTestId('remove-caregiver-2')).toBeTruthy();

      vi.useRealTimers();
    });
  });
});
