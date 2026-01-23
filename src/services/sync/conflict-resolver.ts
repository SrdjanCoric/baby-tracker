import {
  SyncableEntry,
  ConflictScenario,
  ConflictResolution,
} from './types';

const CLOCK_SKEW_TOLERANCE_MS = 5 * 60 * 1000;

export class ConflictResolver {
  detectConflict<T extends SyncableEntry>(
    local: T,
    remote: T,
    _base?: T
  ): boolean {
    return local.updatedAt !== remote.updatedAt;
  }

  resolve<T extends SyncableEntry>(
    scenario: ConflictScenario<T>
  ): ConflictResolution<T> {
    this.logConflict(scenario);

    switch (scenario.type) {
      case 'UPDATE_UPDATE':
        return this.resolveUpdateUpdate(scenario);
      case 'UPDATE_DELETE':
        return this.resolveUpdateDelete(scenario);
      case 'DELETE_UPDATE':
        return this.resolveDeleteUpdate(scenario);
      case 'CREATE_CREATE':
        return this.resolveCreateCreate(scenario);
      default:
        return {
          strategy: 'KEEP_REMOTE',
          resolved: scenario.remote,
          conflictLogged: true,
        };
    }
  }

  private resolveUpdateUpdate<T extends SyncableEntry>(
    scenario: ConflictScenario<T>
  ): ConflictResolution<T> {
    const { local, remote, base } = scenario;

    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    if (base) {
      const localChanges = this.getChangedFields(local, base);
      const remoteChanges = this.getChangedFields(remote, base);

      const hasOverlap = localChanges.some((field) => remoteChanges.includes(field));

      if (!hasOverlap && (localChanges.length > 0 || remoteChanges.length > 0)) {
        const merged = this.mergeEntries(local, remote, base);
        return {
          strategy: 'MERGE',
          resolved: merged,
          conflictLogged: true,
        };
      }

      if (hasOverlap) {
        const merged = this.mergeEntriesWithNewerWins(local, remote, base);
        return {
          strategy: 'MERGE',
          resolved: merged,
          conflictLogged: true,
        };
      }
    }

    if (localTime > remoteTime) {
      return {
        strategy: 'KEEP_LOCAL',
        resolved: local,
        conflictLogged: true,
      };
    }

    return {
      strategy: 'KEEP_REMOTE',
      resolved: remote,
      conflictLogged: true,
    };
  }

  private resolveUpdateDelete<T extends SyncableEntry>(
    scenario: ConflictScenario<T>
  ): ConflictResolution<T> {
    return {
      strategy: 'KEEP_LOCAL',
      resolved: scenario.local,
      conflictLogged: true,
    };
  }

  private resolveDeleteUpdate<T extends SyncableEntry>(
    scenario: ConflictScenario<T>
  ): ConflictResolution<T> {
    return {
      strategy: 'KEEP_REMOTE',
      resolved: scenario.remote,
      conflictLogged: true,
    };
  }

  private resolveCreateCreate<T extends SyncableEntry>(
    scenario: ConflictScenario<T>
  ): ConflictResolution<T> {
    return {
      strategy: 'KEEP_BOTH',
      resolved: [scenario.local, scenario.remote],
      conflictLogged: true,
    };
  }

  private mergeEntries<T extends SyncableEntry>(
    local: T,
    remote: T,
    base: T
  ): T {
    const merged = { ...base } as T;
    const localChanges = this.getChangedFields(local, base);
    const remoteChanges = this.getChangedFields(remote, base);

    for (const field of localChanges) {
      (merged as Record<string, unknown>)[field] = (local as Record<string, unknown>)[field];
    }

    for (const field of remoteChanges) {
      (merged as Record<string, unknown>)[field] = (remote as Record<string, unknown>)[field];
    }

    const newerEntry = new Date(local.updatedAt) > new Date(remote.updatedAt) ? local : remote;
    merged.updatedAt = newerEntry.updatedAt;

    return merged;
  }

  private mergeEntriesWithNewerWins<T extends SyncableEntry>(
    local: T,
    remote: T,
    base: T
  ): T {
    const merged = { ...base } as T;
    const localChanges = this.getChangedFields(local, base);
    const remoteChanges = this.getChangedFields(remote, base);

    const localTime = new Date(local.updatedAt).getTime();
    const remoteTime = new Date(remote.updatedAt).getTime();

    for (const field of localChanges) {
      if (!remoteChanges.includes(field)) {
        (merged as Record<string, unknown>)[field] = (local as Record<string, unknown>)[field];
      }
    }

    for (const field of remoteChanges) {
      if (!localChanges.includes(field)) {
        (merged as Record<string, unknown>)[field] = (remote as Record<string, unknown>)[field];
      } else {
        const winner = remoteTime >= localTime ? remote : local;
        (merged as Record<string, unknown>)[field] = (winner as Record<string, unknown>)[field];
      }
    }

    const newerEntry = localTime > remoteTime ? local : remote;
    merged.updatedAt = newerEntry.updatedAt;

    return merged;
  }

  getChangedFields<T extends SyncableEntry>(entry: T, base: T): string[] {
    const changed: string[] = [];
    const entryRecord = entry as Record<string, unknown>;
    const baseRecord = base as Record<string, unknown>;

    for (const key of Object.keys(entryRecord)) {
      if (key === 'updatedAt') continue;

      const entryValue = entryRecord[key];
      const baseValue = baseRecord[key];

      if (JSON.stringify(entryValue) !== JSON.stringify(baseValue)) {
        changed.push(key);
      }
    }

    return changed;
  }

  private logConflict<T extends SyncableEntry>(scenario: ConflictScenario<T>): void {
    console.log('[ConflictResolver] Conflict detected:', {
      type: scenario.type,
      table: scenario.table,
      localId: scenario.local.id,
      remoteId: scenario.remote.id,
      localUpdatedAt: scenario.local.updatedAt,
      remoteUpdatedAt: scenario.remote.updatedAt,
    });
  }

  isWithinClockSkewTolerance(time1: string, time2: string): boolean {
    const diff = Math.abs(new Date(time1).getTime() - new Date(time2).getTime());
    return diff <= CLOCK_SKEW_TOLERANCE_MS;
  }
}
