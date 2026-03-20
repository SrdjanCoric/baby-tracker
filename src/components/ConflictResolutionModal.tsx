import { useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ConflictScenario,
  ResolutionStrategy,
  SyncableEntry,
  SyncableTable,
} from '@/services/sync/types';
import { formatTime, type TimeFormat } from '@/utils/time';
import { useTimeFormat } from '@/contexts/time-format-context';

interface ConflictResolutionModalProps {
  visible: boolean;
  conflicts: ConflictScenario[];
  onResolve: (
    conflictId: string,
    strategy: ResolutionStrategy
  ) => void;
  onResolveAll: (strategy: ResolutionStrategy) => void;
  onClose: () => void;
  testID?: string;
}

interface ConflictItemProps {
  conflict: ConflictScenario;
  index: number;
  onResolve: (strategy: ResolutionStrategy) => void;
  timeFormat: TimeFormat;
}

const tableLabelKeys = {
  feedings: 'sync.tableLabels.feeding',
  sleep_sessions: 'sync.tableLabels.sleep',
  diapers: 'sync.tableLabels.diaper',
  pumping_sessions: 'sync.tableLabels.pumping',
  growth_measurements: 'sync.tableLabels.growth',
  tummy_time_sessions: 'sync.tableLabels.tummyTime',
  babies: 'sync.tableLabels.baby',
  users: 'sync.tableLabels.user',
  households: 'sync.tableLabels.household',
  active_timers: 'sync.tableLabels.activeTimer',
  wake_window_preferences: 'sync.tableLabels.wakeWindow',
  activity_goals: 'sync.tableLabels.activityGoal',
  milestone_responses: 'sync.tableLabels.milestone',
  health_entries: 'sync.tableLabels.health',
} as const satisfies Record<SyncableTable, string>;

function formatTimestamp(timestamp: string, timeFormat: TimeFormat): string {
  const date = new Date(timestamp);
  const datePart = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
  return `${datePart} ${formatTime(date, timeFormat)}`;
}

function getEntryPreview(entry: SyncableEntry): string {
  const preview: string[] = [];
  const data = entry as unknown as Record<string, unknown>;

  if (data.type) preview.push(String(data.type));
  if (data.amount_ml) preview.push(`${data.amount_ml}ml`);
  if (data.duration_minutes) preview.push(`${data.duration_minutes}min`);
  if (data.notes) preview.push(String(data.notes).slice(0, 30));

  return preview.join(' - ') || '';
}

function ConflictItem({ conflict, index, onResolve, timeFormat }: ConflictItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const tableLabel = t(tableLabelKeys[conflict.table]) || conflict.table;
  const localTime = formatTimestamp(conflict.local.updatedAt, timeFormat);
  const remoteTime = formatTimestamp(conflict.remote.updatedAt, timeFormat);

  return (
    <View
      className="bg-surface-card dark:bg-surface-dark-card rounded-xl mb-3 overflow-hidden border border-border-default dark:border-border-dark-default"
      accessible={true}
      accessibilityLabel={t('sync.conflictAccessibility', { index: index + 1, type: tableLabel })}
    >
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="p-4 flex-row justify-between items-center"
        accessibilityRole="button"
        accessibilityLabel={expanded ? t('sync.collapseDetails') : t('sync.expandDetails')}
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-content-primary dark:text-content-dark-primary">
            {t('sync.conflictLabel', { type: tableLabel })}
          </Text>
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mt-1">
            {conflict.type.replace('_', ' ').toLowerCase()}
          </Text>
        </View>
        <Text className="text-content-muted dark:text-content-dark-muted text-lg">{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View className="border-t border-border-subtle dark:border-border-dark-subtle">
          <View className="flex-row">
            <View className="flex-1 p-3 border-r border-border-subtle dark:border-border-dark-subtle">
              <Text className="text-xs font-semibold text-green-700 dark:text-green-400 uppercase mb-2">
                {t('sync.yourVersion')}
              </Text>
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                {getEntryPreview(conflict.local) || t('sync.entryDetails')}
              </Text>
              <Text className="text-xs text-content-muted dark:text-content-dark-muted mt-2">{localTime}</Text>
            </View>
            <View className="flex-1 p-3">
              <Text className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase mb-2">
                {t('sync.theirVersion')}
              </Text>
              <Text className="text-sm text-content-secondary dark:text-content-dark-secondary">
                {getEntryPreview(conflict.remote) || t('sync.entryDetails')}
              </Text>
              <Text className="text-xs text-content-muted dark:text-content-dark-muted mt-2">{remoteTime}</Text>
            </View>
          </View>

          <View className="flex-row border-t border-border-subtle dark:border-border-dark-subtle p-3 gap-2">
            <Pressable
              onPress={() => onResolve('KEEP_LOCAL')}
              className="flex-1 bg-green-600 dark:bg-green-700 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel={t('sync.keepMyVersion')}
            >
              <Text className="text-white text-center font-medium text-sm">
                {t('sync.keepMine')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onResolve('KEEP_REMOTE')}
              className="flex-1 bg-amber-600 dark:bg-amber-700 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel={t('sync.keepTheirVersion')}
            >
              <Text className="text-white text-center font-medium text-sm">
                {t('sync.keepTheirs')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onResolve(
                new Date(conflict.local.updatedAt) >= new Date(conflict.remote.updatedAt)
                  ? 'KEEP_LOCAL'
                  : 'KEEP_REMOTE'
              )}
              className="flex-1 bg-gray-600 dark:bg-gray-500 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel={t('sync.keepNewerVersion')}
            >
              <Text className="text-white text-center font-medium text-sm">
                {t('sync.keepNewer')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

export function ConflictResolutionModal({
  visible,
  conflicts,
  onResolve,
  onResolveAll,
  onClose,
  testID,
}: ConflictResolutionModalProps) {
  const { t } = useTranslation();
  const { timeFormat } = useTimeFormat();

  const handleResolve = useCallback(
    (index: number) => (strategy: ResolutionStrategy) => {
      onResolve(conflicts[index].local.id, strategy);
    },
    [conflicts, onResolve]
  );

  const handleResolveAllKeepNewer = useCallback(() => {
    onResolveAll('KEEP_REMOTE');
  }, [onResolveAll]);

  const handleResolveAllKeepMine = useCallback(() => {
    onResolveAll('KEEP_LOCAL');
  }, [onResolveAll]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
      testID={testID}
    >
      <SafeAreaView className="flex-1 bg-surface-secondary dark:bg-surface-dark-secondary">
        <View
          className="flex-row items-center justify-between px-4 py-3 border-b border-border-default dark:border-border-dark-default bg-surface-card dark:bg-surface-dark-card"
          accessibilityRole="header"
        >
          <Pressable
            onPress={onClose}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          >
            <Text className="text-green-700 dark:text-green-400 text-base">
              {t('common.cancel')}
            </Text>
          </Pressable>
          <Text className="text-lg font-semibold text-content-primary dark:text-content-dark-primary">
            {t('sync.resolveConflicts')}
          </Text>
          <View className="w-16" />
        </View>

        <View className="px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <Text className="text-sm text-yellow-800 dark:text-yellow-200">
            {t('sync.conflictsExplanation')}
          </Text>
        </View>

        {conflicts.length > 1 && (
          <View className="flex-row gap-2 px-4 py-3 bg-surface-card dark:bg-surface-dark-card border-b border-border-default dark:border-border-dark-default">
            <Pressable
              onPress={handleResolveAllKeepMine}
              className="flex-1 bg-green-100 dark:bg-green-900/30 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel={t('sync.keepAllMyVersions')}
            >
              <Text className="text-green-700 dark:text-green-400 text-center font-medium text-sm">
                {t('sync.keepAllMine')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleResolveAllKeepNewer}
              className="flex-1 bg-gray-100 dark:bg-gray-800 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel={t('sync.keepAllNewerVersions')}
            >
              <Text className="text-content-secondary dark:text-content-dark-secondary text-center font-medium text-sm">
                {t('sync.keepAllNewer')}
              </Text>
            </Pressable>
          </View>
        )}

        <ScrollView className="flex-1 px-4 py-4">
          <Text className="text-sm text-content-tertiary dark:text-content-dark-tertiary mb-3">
            {t('sync.conflictCount', {
              count: conflicts.length,
            })}
          </Text>

          {conflicts.map((conflict, index) => (
            <ConflictItem
              key={conflict.local.id}
              conflict={conflict}
              index={index}
              onResolve={handleResolve(index)}
              timeFormat={timeFormat}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
