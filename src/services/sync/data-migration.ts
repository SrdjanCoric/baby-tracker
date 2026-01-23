import AsyncStorage from '@react-native-async-storage/async-storage';

const MIGRATION_VERSION_KEY = '@sync:migration_version';
const CURRENT_MIGRATION_VERSION = 1;

export interface MigrationResult {
  success: boolean;
  version: number;
  migratedRecords: number;
  errors: string[];
}

export interface MigrationOptions {
  userId: string;
  householdId: string;
  onProgress?: (table: string, count: number) => void;
}

const SYNCABLE_TABLES = [
  'feedings',
  'sleep_sessions',
  'diapers',
  'pumping_sessions',
  'growth_measurements',
  'tummy_time_sessions',
] as const;

export async function getMigrationVersion(): Promise<number> {
  try {
    const version = await AsyncStorage.getItem(MIGRATION_VERSION_KEY);
    return version ? parseInt(version, 10) : 0;
  } catch {
    return 0;
  }
}

export async function setMigrationVersion(version: number): Promise<void> {
  await AsyncStorage.setItem(MIGRATION_VERSION_KEY, version.toString());
}

export async function needsMigration(): Promise<boolean> {
  const currentVersion = await getMigrationVersion();
  return currentVersion < CURRENT_MIGRATION_VERSION;
}

export async function getStorageKeyPrefix(userId: string): Promise<string> {
  return `@user:${userId}:`;
}

export async function migrateAsyncStorageToSync(
  options: MigrationOptions
): Promise<MigrationResult> {
  const { userId, householdId, onProgress } = options;
  const result: MigrationResult = {
    success: false,
    version: CURRENT_MIGRATION_VERSION,
    migratedRecords: 0,
    errors: [],
  };

  try {
    const currentVersion = await getMigrationVersion();
    if (currentVersion >= CURRENT_MIGRATION_VERSION) {
      result.success = true;
      return result;
    }

    const keyPrefix = await getStorageKeyPrefix(userId);

    for (const table of SYNCABLE_TABLES) {
      try {
        const storageKey = `${keyPrefix}${table}`;
        const data = await AsyncStorage.getItem(storageKey);

        if (data) {
          const records = JSON.parse(data) as Record<string, unknown>[];

          if (Array.isArray(records)) {
            for (const record of records) {
              if (validateRecord(record, table)) {
                result.migratedRecords++;
              } else {
                result.errors.push(`Invalid record in ${table}: ${JSON.stringify(record).slice(0, 100)}`);
              }
            }

            onProgress?.(table, records.length);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Failed to migrate ${table}: ${message}`);
      }
    }

    await setMigrationVersion(CURRENT_MIGRATION_VERSION);
    result.success = result.errors.length === 0;

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    result.errors.push(`Migration failed: ${message}`);
  }

  return result;
}

function validateRecord(record: unknown, table: string): boolean {
  if (!record || typeof record !== 'object') {
    return false;
  }

  const obj = record as Record<string, unknown>;

  if (!obj.id || typeof obj.id !== 'string') {
    return false;
  }

  switch (table) {
    case 'feedings':
      return typeof obj.baby_id === 'string' && typeof obj.type === 'string';
    case 'sleep_sessions':
      return typeof obj.baby_id === 'string' && typeof obj.started_at === 'string';
    case 'diapers':
      return typeof obj.baby_id === 'string' && typeof obj.type === 'string';
    case 'pumping_sessions':
      return typeof obj.baby_id === 'string';
    case 'growth_measurements':
      return typeof obj.baby_id === 'string' && typeof obj.measured_at === 'string';
    case 'tummy_time_sessions':
      return typeof obj.baby_id === 'string' && typeof obj.started_at === 'string';
    default:
      return true;
  }
}

export async function rollbackMigration(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_VERSION_KEY);
}

export async function clearMigrationState(): Promise<void> {
  await AsyncStorage.removeItem(MIGRATION_VERSION_KEY);
}
