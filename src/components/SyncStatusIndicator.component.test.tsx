import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SyncStatusIndicator } from './SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  describe('rendering states', () => {
    it('renders synced state with green indicator', () => {
      render(<SyncStatusIndicator status="online" testID="sync-status" />);
      const dot = screen.getByTestId('sync-status-dot');
      expect(dot.props.className).toContain('bg-green-500');
    });

    it('renders syncing state with spinner animation', () => {
      render(<SyncStatusIndicator status="syncing" testID="sync-status" />);
      expect(screen.getByTestId('sync-status-spinner')).toBeTruthy();
      expect(screen.queryByTestId('sync-status-dot')).toBeNull();
    });

    it('renders offline state with orange indicator', () => {
      render(<SyncStatusIndicator status="offline" testID="sync-status" />);
      const dot = screen.getByTestId('sync-status-dot');
      expect(dot.props.className).toContain('bg-orange-500');
    });

    it('renders pending state with count badge', () => {
      render(
        <SyncStatusIndicator
          status="pending"
          pendingCount={5}
          testID="sync-status"
        />
      );
      const badge = screen.getByTestId('sync-status-badge');
      expect(badge).toBeTruthy();
      expect(screen.getByText('5')).toBeTruthy();
    });

    it('renders error state with red indicator', () => {
      render(<SyncStatusIndicator status="error" testID="sync-status" />);
      const dot = screen.getByTestId('sync-status-dot');
      expect(dot.props.className).toContain('bg-red-500');
    });

    it('shows pending badge on non-syncing states when pendingCount > 0', () => {
      render(
        <SyncStatusIndicator
          status="offline"
          pendingCount={3}
          testID="sync-status"
        />
      );
      expect(screen.getByTestId('sync-status-badge')).toBeTruthy();
      expect(screen.getByText('3')).toBeTruthy();
    });

    it('does not show badge during syncing state', () => {
      render(
        <SyncStatusIndicator
          status="syncing"
          pendingCount={3}
          testID="sync-status"
        />
      );
      expect(screen.queryByTestId('sync-status-badge')).toBeNull();
    });

    it('displays 99+ for counts over 99', () => {
      render(
        <SyncStatusIndicator
          status="pending"
          pendingCount={150}
          testID="sync-status"
        />
      );
      expect(screen.getByText('99+')).toBeTruthy();
    });
  });

  describe('label display', () => {
    it('shows label when showLabel is true', () => {
      render(
        <SyncStatusIndicator
          status="online"
          showLabel={true}
          testID="sync-status"
        />
      );
      expect(screen.getByTestId('sync-status-label')).toBeTruthy();
      expect(screen.getByText('Synced')).toBeTruthy();
    });

    it('hides label when showLabel is false', () => {
      render(
        <SyncStatusIndicator
          status="online"
          showLabel={false}
          testID="sync-status"
        />
      );
      expect(screen.queryByTestId('sync-status-label')).toBeNull();
    });

    it('shows correct label for each status', () => {
      const { rerender } = render(
        <SyncStatusIndicator
          status="syncing"
          showLabel={true}
          testID="sync-status"
        />
      );
      expect(screen.getByText('Syncing...')).toBeTruthy();

      rerender(
        <SyncStatusIndicator
          status="offline"
          showLabel={true}
          testID="sync-status"
        />
      );
      expect(screen.getByText('Offline')).toBeTruthy();

      rerender(
        <SyncStatusIndicator
          status="error"
          showLabel={true}
          testID="sync-status"
        />
      );
      expect(screen.getByText('Sync error')).toBeTruthy();
    });
  });

  describe('accessibility', () => {
    it('has accessible flag for screen readers', () => {
      render(<SyncStatusIndicator status="online" testID="sync-status" />);
      const status = screen.getByTestId('sync-status');
      expect(status.props.accessible).toBe(true);
    });

    it('has accessibility live region for announcements', () => {
      render(<SyncStatusIndicator status="online" testID="sync-status" />);
      const status = screen.getByTestId('sync-status');
      expect(status.props.accessibilityLiveRegion).toBe('polite');
    });

    it('announces state changes to screen reader', () => {
      render(<SyncStatusIndicator status="online" testID="sync-status" />);
      const status = screen.getByTestId('sync-status');
      expect(status.props.accessibilityLabel).toBe('Synced');
    });

    it('includes pending count in accessibility label', () => {
      render(
        <SyncStatusIndicator
          status="offline"
          pendingCount={5}
          testID="sync-status"
        />
      );
      const status = screen.getByTestId('sync-status');
      expect(status.props.accessibilityLabel).toContain('5 pending changes');
    });

    it('uses singular form for 1 pending change', () => {
      render(
        <SyncStatusIndicator
          status="offline"
          pendingCount={1}
          testID="sync-status"
        />
      );
      const status = screen.getByTestId('sync-status');
      expect(status.props.accessibilityLabel).toContain('1 pending change');
      expect(status.props.accessibilityLabel).not.toContain('changes');
    });
  });

  describe('interactions', () => {
    it('triggers retry on tap when in error state', () => {
      const onPress = jest.fn();
      render(
        <SyncStatusIndicator
          status="error"
          onPress={onPress}
          testID="sync-status"
        />
      );
      const pressable = screen.getByTestId('sync-status-pressable');
      fireEvent.press(pressable);
      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it('does not wrap in pressable when not in error state', () => {
      const onPress = jest.fn();
      render(
        <SyncStatusIndicator
          status="online"
          onPress={onPress}
          testID="sync-status"
        />
      );
      expect(screen.queryByTestId('sync-status-pressable')).toBeNull();
    });

    it('does not wrap in pressable when onPress not provided', () => {
      render(<SyncStatusIndicator status="error" testID="sync-status" />);
      expect(screen.queryByTestId('sync-status-pressable')).toBeNull();
    });
  });
});
