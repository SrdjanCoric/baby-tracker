import { Alert } from 'react-native';
import type { ActivityType } from '@/constants/activities';
import type { TFunction } from 'i18next';
import type { MatchReason } from '@/services/duplicate-detection';

export interface DuplicateDialogOptions {
  activityType: ActivityType;
  existingEntryTime: string;
  loggedByName?: string;
  matchReason?: MatchReason;
  onConfirm: () => void;
  onCancel: () => void;
  t: TFunction;
}

const OVERLAP_COPY = {
  feeding: {
    title: 'duplicateDetection.feedingOverlapTitle',
    message: 'duplicateDetection.feedingOverlapMessage',
  },
  pumping: {
    title: 'duplicateDetection.pumpingOverlapTitle',
    message: 'duplicateDetection.pumpingOverlapMessage',
  },
  tummyTime: {
    title: 'duplicateDetection.tummyTimeOverlapTitle',
    message: 'duplicateDetection.tummyTimeOverlapMessage',
  },
  sleep: {
    title: 'duplicateDetection.sleepOverlapTitle',
    message: 'duplicateDetection.sleepOverlapMessage',
  },
} as const;

function formatTimeDifference(entryTime: string, t: TFunction): string {
  const now = new Date();
  const entry = new Date(entryTime);
  const diffMs = now.getTime() - entry.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));

  if (diffMinutes < 1) {
    return t('duplicateDetection.justNow');
  } else if (diffMinutes === 1) {
    return t('duplicateDetection.minuteAgo', { count: 1 });
  } else if (diffMinutes < 60) {
    return t('duplicateDetection.minutesAgo', { count: diffMinutes });
  } else {
    const diffHours = Math.round(diffMinutes / 60);
    if (diffHours === 1) {
      return t('duplicateDetection.hourAgo', { count: 1 });
    }
    return t('duplicateDetection.hoursAgo', { count: diffHours });
  }
}

export function showDuplicateConfirmation(options: DuplicateDialogOptions): void {
  const { activityType, existingEntryTime, loggedByName, matchReason, onConfirm, onCancel, t } = options;

  const isOverlap = matchReason === 'overlapping_session';
  const overlapCopy = OVERLAP_COPY[activityType as keyof typeof OVERLAP_COPY];
  const timeDiff = formatTimeDifference(existingEntryTime, t);
  const activityName = t(`activities.${activityType}`);

  let message: string;
  if (isOverlap) {
    message = t(overlapCopy.message);
  } else if (loggedByName) {
    message = t('duplicateDetection.messageWithUser', {
      activity: activityName,
      time: timeDiff,
      user: loggedByName,
    });
  } else {
    message = t('duplicateDetection.message', {
      activity: activityName,
      time: timeDiff,
    });
  }

  Alert.alert(
    t(isOverlap ? overlapCopy.title : 'duplicateDetection.title'),
    message,
    [
      {
        text: t('duplicateDetection.cancel'),
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: t(
          isOverlap
            ? 'duplicateDetection.continueAnyway'
            : 'duplicateDetection.logAnyway'
        ),
        onPress: onConfirm,
      },
    ]
  );
}

export function showDuplicateConfirmationAsync(
  options: Omit<DuplicateDialogOptions, 'onConfirm' | 'onCancel'>
): Promise<boolean> {
  return new Promise((resolve) => {
    showDuplicateConfirmation({
      ...options,
      onConfirm: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}
