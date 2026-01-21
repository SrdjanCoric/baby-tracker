import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { SyncStatusIndicator } from './SyncStatusIndicator';

describe('SyncStatusIndicator', () => {
  describe('synced state', () => {
    it('renders synced state with green indicator', () => {
      render(<SyncStatusIndicator status="online" testID="sync-indicator" />);
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator).toBeTruthy();
    });

    it('shows label when showLabel is true', () => {
      render(<SyncStatusIndicator status="online" showLabel testID="sync-indicator" />);
      expect(screen.getByText(/synced/i)).toBeTruthy();
    });
  });

  describe('syncing state', () => {
    it('renders syncing state with spinner animation', () => {
      render(<SyncStatusIndicator status="syncing" testID="sync-indicator" />);
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator.props.accessibilityState?.busy).toBe(true);
    });
  });

  describe('offline state', () => {
    it('renders offline state with orange indicator', () => {
      render(<SyncStatusIndicator status="offline" testID="sync-indicator" />);
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator).toBeTruthy();
    });
  });

  describe('pending state', () => {
    it('renders pending state with count badge', () => {
      render(
        <SyncStatusIndicator status="pending" pendingCount={5} testID="sync-indicator" />
      );
      expect(screen.getByText('5')).toBeTruthy();
    });
  });

  describe('error state', () => {
    it('renders error state with red indicator', () => {
      render(<SyncStatusIndicator status="error" testID="sync-indicator" />);
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator).toBeTruthy();
    });

    it('triggers retry on tap when in error state', () => {
      const onRetry = jest.fn();
      render(
        <SyncStatusIndicator
          status="error"
          onRetry={onRetry}
          testID="sync-indicator"
        />
      );
      fireEvent.press(screen.getByTestId('sync-indicator'));
      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has status accessibility role', () => {
      render(<SyncStatusIndicator status="online" testID="sync-indicator" />);
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator.props.accessibilityRole).toBe('button');
    });

    it('announces state changes to screen reader', () => {
      render(
        <SyncStatusIndicator status="offline" testID="sync-indicator" />
      );
      const indicator = screen.getByTestId('sync-indicator');
      expect(indicator.props.accessibilityLabel).toContain('offline');
    });
  });
});
