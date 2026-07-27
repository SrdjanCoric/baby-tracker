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

  const isSleepOverlap = activityType === 'sleep' && matchReason === 'overlapping_session';
  const timeDiff = formatTimeDifference(existingEntryTime, t);
  const activityName = t(`activities.${activityType}`);

  let message: string;
  if (isSleepOverlap) {
    message = t('duplicateDetection.sleepOverlapMessage');
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
    t(isSleepOverlap ? 'duplicateDetection.sleepOverlapTitle' : 'duplicateDetection.title'),
    message,
    [
      {
        text: t('duplicateDetection.cancel'),
        style: 'cancel',
        onPress: onCancel,
      },
      {
        text: t(
          isSleepOverlap
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
