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
}

const tableLabels: Record<SyncableTable, string> = {
  feedings: 'Feeding',
  sleep_sessions: 'Sleep',
  diapers: 'Diaper',
  pumping_sessions: 'Pumping',
  growth_measurements: 'Growth',
  tummy_time_sessions: 'Tummy Time',
  babies: 'Baby',
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getEntryPreview(entry: SyncableEntry): string {
  const preview: string[] = [];
  const data = entry as unknown as Record<string, unknown>;

  if (data.type) preview.push(String(data.type));
  if (data.amount_ml) preview.push(`${data.amount_ml}ml`);
  if (data.duration_minutes) preview.push(`${data.duration_minutes}min`);
  if (data.notes) preview.push(String(data.notes).slice(0, 30));

  return preview.join(' - ') || 'Entry details';
}

function ConflictItem({ conflict, index, onResolve }: ConflictItemProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const tableLabel = tableLabels[conflict.table] || conflict.table;
  const localTime = formatTimestamp(conflict.local.updatedAt);
  const remoteTime = formatTimestamp(conflict.remote.updatedAt);

  return (
    <View
      className="bg-white rounded-xl mb-3 overflow-hidden border border-gray-200"
      accessible={true}
      accessibilityLabel={`Conflict ${index + 1}: ${tableLabel} entry`}
    >
      <Pressable
        onPress={() => setExpanded(!expanded)}
        className="p-4 flex-row justify-between items-center"
        accessibilityRole="button"
        accessibilityLabel={expanded ? 'Collapse details' : 'Expand details'}
      >
        <View className="flex-1">
          <Text className="text-base font-semibold text-gray-900">
            {tableLabel} Conflict
          </Text>
          <Text className="text-sm text-gray-500 mt-1">
            {conflict.type.replace('_', ' ').toLowerCase()}
          </Text>
        </View>
        <Text className="text-gray-400 text-lg">{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded && (
        <View className="border-t border-gray-100">
          <View className="flex-row">
            <View className="flex-1 p-3 border-r border-gray-100">
              <Text className="text-xs font-semibold text-blue-600 uppercase mb-2">
                {t('sync.yourVersion', 'Your Version')}
              </Text>
              <Text className="text-sm text-gray-700">
                {getEntryPreview(conflict.local)}
              </Text>
              <Text className="text-xs text-gray-400 mt-2">{localTime}</Text>
            </View>
            <View className="flex-1 p-3">
              <Text className="text-xs font-semibold text-purple-600 uppercase mb-2">
                {t('sync.theirVersion', 'Their Version')}
              </Text>
              <Text className="text-sm text-gray-700">
                {getEntryPreview(conflict.remote)}
              </Text>
              <Text className="text-xs text-gray-400 mt-2">{remoteTime}</Text>
            </View>
          </View>

          <View className="flex-row border-t border-gray-100 p-3 gap-2">
            <Pressable
              onPress={() => onResolve('KEEP_LOCAL')}
              className="flex-1 bg-blue-500 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Keep my version"
            >
              <Text className="text-white text-center font-medium text-sm">
                {t('sync.keepMine', 'Keep Mine')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onResolve('KEEP_REMOTE')}
              className="flex-1 bg-purple-500 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Keep their version"
            >
              <Text className="text-white text-center font-medium text-sm">
                {t('sync.keepTheirs', 'Keep Theirs')}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onResolve(
                new Date(conflict.local.updatedAt) >= new Date(conflict.remote.updatedAt)
                  ? 'KEEP_LOCAL'
                  : 'KEEP_REMOTE'
              )}
              className="flex-1 bg-gray-600 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Keep the newer version"
            >
              <Text className="text-white text-center font-medium text-sm">
                {t('sync.keepNewer', 'Keep Newer')}
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
      <SafeAreaView className="flex-1 bg-gray-50">
        <View
          className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200 bg-white"
          accessibilityRole="header"
        >
          <Pressable
            onPress={onClose}
            className="p-2"
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Text className="text-blue-500 text-base">
              {t('common.cancel', 'Cancel')}
            </Text>
          </Pressable>
          <Text className="text-lg font-semibold text-gray-900">
            {t('sync.resolveConflicts', 'Resolve Conflicts')}
          </Text>
          <View className="w-16" />
        </View>

        <View className="px-4 py-3 bg-yellow-50 border-b border-yellow-200">
          <Text className="text-sm text-yellow-800">
            {t(
              'sync.conflictsExplanation',
              'These entries were modified on multiple devices while offline. Choose which version to keep for each.'
            )}
          </Text>
        </View>

        {conflicts.length > 1 && (
          <View className="flex-row gap-2 px-4 py-3 bg-white border-b border-gray-200">
            <Pressable
              onPress={handleResolveAllKeepMine}
              className="flex-1 bg-blue-100 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Keep all my versions"
            >
              <Text className="text-blue-700 text-center font-medium text-sm">
                {t('sync.keepAllMine', 'Keep All Mine')}
              </Text>
            </Pressable>
            <Pressable
              onPress={handleResolveAllKeepNewer}
              className="flex-1 bg-gray-100 py-2.5 rounded-lg"
              accessibilityRole="button"
              accessibilityLabel="Keep all newer versions"
            >
              <Text className="text-gray-700 text-center font-medium text-sm">
                {t('sync.keepAllNewer', 'Keep All Newer')}
              </Text>
            </Pressable>
          </View>
        )}

        <ScrollView className="flex-1 px-4 py-4">
          <Text className="text-sm text-gray-500 mb-3">
            {t('sync.conflictCount', '{{count}} conflict(s) to resolve', {
              count: conflicts.length,
            })}
          </Text>

          {conflicts.map((conflict, index) => (
            <ConflictItem
              key={conflict.local.id}
              conflict={conflict}
              index={index}
              onResolve={handleResolve(index)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
