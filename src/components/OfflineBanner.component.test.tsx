import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { OfflineBanner } from './OfflineBanner';

describe('OfflineBanner', () => {
  describe('rendering', () => {
    it('renders offline message', () => {
      render(<OfflineBanner pendingCount={0} testID="offline-banner" />);
      expect(screen.getByText(/offline/i)).toBeTruthy();
    });

    it('shows pending count with singular form (1 change)', () => {
      render(<OfflineBanner pendingCount={1} testID="offline-banner" />);
      expect(screen.getByText(/1 change/i)).toBeTruthy();
    });

    it('shows pending count with plural form (N changes)', () => {
      render(<OfflineBanner pendingCount={5} testID="offline-banner" />);
      expect(screen.getByText(/5 changes/i)).toBeTruthy();
    });
  });

  describe('interactions', () => {
    it('calls onDismiss when dismiss button pressed', () => {
      const onDismiss = jest.fn();
      render(
        <OfflineBanner pendingCount={0} onDismiss={onDismiss} testID="offline-banner" />
      );
      const dismissButton = screen.getByTestId('offline-banner-dismiss');
      fireEvent.press(dismissButton);
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has alert accessibility role', () => {
      render(<OfflineBanner pendingCount={0} testID="offline-banner" />);
      const banner = screen.getByTestId('offline-banner');
      expect(banner.props.accessibilityRole).toBe('alert');
    });
  });
});
