/**
 * Accessibility type definitions
 * Types for screen reader support, announcements, and accessibility utilities
 */

import type { AccessibilityRole } from "react-native";

export type AnnouncementPriority = "polite" | "assertive";

export interface AccessibilityAnnouncement {
  message: string;
  priority?: AnnouncementPriority;
}

export interface AccessibilityConfig {
  label: string;
  hint?: string;
  role?: AccessibilityRole;
  state?: AccessibilityState;
}

export interface AccessibilityState {
  disabled?: boolean;
  selected?: boolean;
  checked?: boolean | "mixed";
  busy?: boolean;
  expanded?: boolean;
}

export interface TimerAccessibilityInfo {
  activityType: string;
  isRunning: boolean;
  duration: number;
  formattedDuration: string;
}

export interface FocusableRef {
  focus: () => void;
}

export type LiveRegionMode = "none" | "polite" | "assertive";

export interface AccessibilityActionInfo {
  name: string;
  label?: string;
}

export interface AccessibilityComponentProps {
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  accessibilityLiveRegion?: LiveRegionMode;
  accessibilityActions?: AccessibilityActionInfo[];
  onAccessibilityAction?: (event: { nativeEvent: { actionName: string } }) => void;
}
