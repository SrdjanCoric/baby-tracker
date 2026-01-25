import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { CaregiverListItem } from './CaregiverListItem';

describe('CaregiverListItem', () => {
  const defaultProps = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@test.com',
    entryCount: 42,
    isOwner: false,
    isCurrentUser: false,
    canRemove: true,
    testID: 'caregiver-item',
  };

  describe('rendering', () => {
    it('renders caregiver name', () => {
      render(<CaregiverListItem {...defaultProps} />);
      expect(screen.getByText('John Doe')).toBeTruthy();
    });

    it('truncates names longer than 20 characters', () => {
      render(
        <CaregiverListItem
          {...defaultProps}
          name="Very Long Caregiver Name That Should Be Truncated"
        />
      );
      const nameElement = screen.getByTestId('caregiver-item-name');
      expect(nameElement.props.numberOfLines).toBe(1);
    });

  });

  describe('current user indicator', () => {
    it('shows "You" indicator for current user', () => {
      render(<CaregiverListItem {...defaultProps} isCurrentUser />);
      expect(screen.getByText(/you/i)).toBeTruthy();
    });
  });

  describe('owner badge', () => {
    it('shows "Owner" badge for household owner', () => {
      render(<CaregiverListItem {...defaultProps} isOwner />);
      expect(screen.getByText(/owner/i)).toBeTruthy();
    });
  });

  describe('remove button', () => {
    it('shows remove button for removable caregivers', () => {
      render(<CaregiverListItem {...defaultProps} canRemove />);
      expect(screen.getByTestId('caregiver-item-remove')).toBeTruthy();
    });

    it('hides remove button for current user', () => {
      render(<CaregiverListItem {...defaultProps} isCurrentUser canRemove={false} />);
      expect(screen.queryByTestId('caregiver-item-remove')).toBeNull();
    });

    it('hides remove button for owner', () => {
      render(<CaregiverListItem {...defaultProps} isOwner canRemove={false} />);
      expect(screen.queryByTestId('caregiver-item-remove')).toBeNull();
    });

    it('calls onRemove when remove button pressed', () => {
      const onRemove = jest.fn();
      render(<CaregiverListItem {...defaultProps} onRemove={onRemove} canRemove />);
      fireEvent.press(screen.getByTestId('caregiver-item-remove'));
      expect(onRemove).toHaveBeenCalledWith('user-123');
    });
  });

  describe('accessibility', () => {
    it('has appropriate accessibility labels', () => {
      render(<CaregiverListItem {...defaultProps} />);
      const item = screen.getByTestId('caregiver-item');
      expect(item.props.accessibilityLabel).toContain('John Doe');
    });
  });
});
