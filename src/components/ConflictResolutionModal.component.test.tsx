import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConflictResolutionModal } from './ConflictResolutionModal';
import { ConflictScenario } from '@/services/sync/types';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, defaultValue?: string) => defaultValue || key,
  }),
}));

const mockConflicts: ConflictScenario[] = [
  {
    type: 'UPDATE_UPDATE',
    table: 'feedings',
    local: {
      id: 'entry-1',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T12:00:00Z',
      loggedBy: 'user-1',
    },
    remote: {
      id: 'entry-1',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T11:30:00Z',
      loggedBy: 'user-2',
    },
  },
  {
    type: 'UPDATE_DELETE',
    table: 'sleep_sessions',
    local: {
      id: 'entry-2',
      createdAt: '2024-01-14T08:00:00Z',
      updatedAt: '2024-01-14T09:00:00Z',
      loggedBy: 'user-1',
    },
    remote: {
      id: 'entry-2',
      createdAt: '2024-01-14T08:00:00Z',
      updatedAt: '2024-01-14T08:30:00Z',
      loggedBy: 'user-2',
    },
  },
];

describe('ConflictResolutionModal', () => {
  const mockOnResolve = vi.fn();
  const mockOnResolveAll = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal visibility and structure', () => {
    it('renders when visible is true', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
          testID="conflict-modal"
        />
      );

      expect(screen.getByText('Resolve Conflicts')).toBeTruthy();
    });

    it('shows local vs remote version comparison', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Feeding Conflict')).toBeTruthy();
      expect(screen.getByText('Sleep Conflict')).toBeTruthy();
    });

    it('shows conflict count', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('{{count}} conflict(s) to resolve')).toBeTruthy();
    });
  });

  describe('Resolution options', () => {
    it('shows Keep mine / Keep theirs / Keep newer options', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[mockConflicts[0]]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Feeding Conflict'));

      expect(screen.getByText('Keep Mine')).toBeTruthy();
      expect(screen.getByText('Keep Theirs')).toBeTruthy();
      expect(screen.getByText('Keep Newer')).toBeTruthy();
    });

    it('calls onResolve with KEEP_LOCAL when Keep Mine pressed', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[mockConflicts[0]]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Feeding Conflict'));
      fireEvent.press(screen.getByText('Keep Mine'));

      expect(mockOnResolve).toHaveBeenCalledWith('entry-1', 'KEEP_LOCAL');
    });

    it('calls onResolve with KEEP_REMOTE when Keep Theirs pressed', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[mockConflicts[0]]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Feeding Conflict'));
      fireEvent.press(screen.getByText('Keep Theirs'));

      expect(mockOnResolve).toHaveBeenCalledWith('entry-1', 'KEEP_REMOTE');
    });

    it('calls onResolve with correct strategy when Keep Newer pressed', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[mockConflicts[0]]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Feeding Conflict'));
      fireEvent.press(screen.getByText('Keep Newer'));

      expect(mockOnResolve).toHaveBeenCalledWith('entry-1', 'KEEP_LOCAL');
    });
  });

  describe('Batch resolution actions', () => {
    it('shows batch resolution buttons when multiple conflicts', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Keep All Mine')).toBeTruthy();
      expect(screen.getByText('Keep All Newer')).toBeTruthy();
    });

    it('calls onResolveAll with KEEP_LOCAL when Keep All Mine pressed', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Keep All Mine'));

      expect(mockOnResolveAll).toHaveBeenCalledWith('KEEP_LOCAL');
    });

    it('calls onResolveAll with KEEP_REMOTE when Keep All Newer pressed', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Keep All Newer'));

      expect(mockOnResolveAll).toHaveBeenCalledWith('KEEP_REMOTE');
    });
  });

  describe('Modal close', () => {
    it('calls onClose when Cancel pressed', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={mockConflicts}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Cancel'));

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate accessibility roles', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[mockConflicts[0]]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton.parent?.parent?.props.accessibilityRole).toBe('button');
    });

    it('has accessibility labels for resolution buttons', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[mockConflicts[0]]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      fireEvent.press(screen.getByText('Feeding Conflict'));

      const keepMineButton = screen.getByText('Keep Mine');
      expect(
        keepMineButton.parent?.props.accessibilityLabel
      ).toBe('Keep my version');
    });
  });

  describe('Empty state', () => {
    it('handles empty conflicts array', () => {
      render(
        <ConflictResolutionModal
          visible={true}
          conflicts={[]}
          onResolve={mockOnResolve}
          onResolveAll={mockOnResolveAll}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Resolve Conflicts')).toBeTruthy();
    });
  });
});
