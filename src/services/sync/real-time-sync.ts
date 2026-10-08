import { supabase } from '@/services/supabase';
import { SyncableTable } from './types';
import { reportIssue } from '@/utils/observability-sink';

export interface RemoteChange {
  table: SyncableTable | string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
}

export interface RealTimeSyncContext {
  householdId: string;
  userId: string;
}

type RemoteChangeListener = (change: RemoteChange) => void;
type ConnectionChangeListener = (connected: boolean) => void;
type ErrorListener = (error: Error) => void;

const SYNCABLE_TABLES: SyncableTable[] = [
  'feedings',
  'sleep_sessions',
  'diapers',
  'pumping_sessions',
  'growth_measurements',
  'tummy_time_sessions',
  'babies',
  'users',
  'households',
  'active_timers',
  'wake_window_preferences',
  'activity_goals',
  'milestone_responses',
  'health_entries',
];

export class RealTimeSync {
  private deviceId: string;
  private currentHouseholdId: string | null = null;
  private babyIds: string[] = [];
  private subscriptionGeneration = 0;
  private subscription: { unsubscribe: () => void } | null = null;
  private connected = false;
  private changeListeners: Set<RemoteChangeListener> = new Set();
  private connectionListeners: Set<ConnectionChangeListener> = new Set();
  private replacementListeners: Set<() => void> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private authContext: RealTimeSyncContext | null = null;

  constructor() {
    this.deviceId = this.generateDeviceId();
  }

  setAuthContext(context: RealTimeSyncContext): void {
    if (this.authContext && (this.authContext.householdId !== context.householdId ||
        this.authContext.userId !== context.userId)) this.unsubscribe();
    this.authContext = context;
  }

  clearAuthContext(): void {
    this.unsubscribe();
    this.authContext = null;
  }

  private ensureAuthContext(): RealTimeSyncContext {
    if (!this.authContext) {
      throw new Error('RealTimeSync auth context not set. Call setAuthContext first.');
    }
    return this.authContext;
  }

  private generateDeviceId(): string {
    return `device-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  getDeviceId(): string {
    return this.deviceId;
  }

  isConnected(): boolean {
    return this.connected;
  }

  async subscribeToHousehold(householdId: string, babyIds: readonly string[] = []): Promise<void> {
    const authContext = this.ensureAuthContext();

    if (householdId !== authContext.householdId) {
      throw new Error('Cannot subscribe to a household the user does not belong to');
    }

    const sortedIds = [...new Set(babyIds)].sort();
    if (this.currentHouseholdId === householdId && this.subscription &&
        sortedIds.join(',') === this.babyIds.join(',')) {
      return;
    }

    const isReplacement = this.currentHouseholdId === householdId && this.subscription !== null;
    if (isReplacement) this.teardown();
    else this.unsubscribe();

    this.currentHouseholdId = householdId;
    this.babyIds = sortedIds;

    const generation = this.subscriptionGeneration;
    const channel = supabase.channel(`household:${householdId}:${generation}`);

    for (const table of SYNCABLE_TABLES) {
      const filters: (string | undefined)[] = table === 'babies'
        ? [`household_id=eq.${householdId}`]
        : table === 'households' ? [`id=eq.${householdId}`]
        : table === 'users' ? [undefined]
        : Array.from({ length: Math.ceil(sortedIds.length / 100) }, (_, index) =>
          `baby_id=in.(${sortedIds.slice(index * 100, (index + 1) * 100).join(',')})`);
      for (const filter of filters) {
        channel.on(
          'postgres_changes' as never,
          {
            event: '*',
            schema: 'public',
            table,
            ...(filter ? { filter } : {}),
          } as never,
          (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
            if (generation !== this.subscriptionGeneration) return;
            this.handleRemoteChange(table, payload);
          }
        );
      }
    }

    let firstJoin = true;
    this.subscription = channel.subscribe((status: string, error?: Error) => {
      if (generation !== this.subscriptionGeneration) return;
      if (status === 'SUBSCRIBED') {
        this.setConnected(true);
        if (firstJoin) {
          firstJoin = false;
          if (isReplacement) this.replacementListeners.forEach(listener => listener());
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        this.setConnected(false, true);
        if (error) {
          this.notifyError(error);
        } else {
          this.notifyError(new Error(`Subscription failed: ${status}`));
        }
      } else if (status === 'CLOSED') {
        this.setConnected(false);
      }
    });
  }

  private handleRemoteChange(
    table: SyncableTable,
    payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }
  ): void {
    const change: RemoteChange = {
      table,
      eventType: payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE',
      new: payload.new && Object.keys(payload.new).length ? payload.new : null,
      old: payload.old && Object.keys(payload.old).length ? payload.old : null,
    };

    if (this.isEchoFromSameDevice(change)) {
      return;
    }

    if (!this.verifyChangeOwnership(change)) {
      reportIssue({
        name: 'realtime.change_rejected',
        area: 'realtime',
        level: 'warning',
        tags: { table, eventType: change.eventType, hasAuthContext: this.authContext !== null },
      });
      return;
    }

    this.notifyChangeListeners(change);
  }

  private verifyChangeOwnership(change: RemoteChange): boolean {
    if (!this.authContext) {
      return false;
    }

    const data = change.new || change.old;
    if (!data) {
      return false;
    }

    if (change.table === 'babies') {
      const dataHouseholdId = data.household_id;
      const myHouseholdId = this.authContext.householdId;

      // For DELETE events without household_id (REPLICA IDENTITY not FULL),
      // trust that RLS already filtered the change to our household
      if (change.eventType === 'DELETE' && !dataHouseholdId) {
        return true;
      }

      return dataHouseholdId === myHouseholdId;
    }

    if (change.table === 'users') {
      const newData = change.new;
      const oldData = change.old;
      return Boolean(
        (newData && newData.household_id === this.authContext.householdId) ||
        (oldData && oldData.household_id === this.authContext.householdId)
      );
    }

    if (change.table === 'households') {
      return data.id === this.authContext.householdId;
    }

    return true;
  }

  private isEchoFromSameDevice(change: RemoteChange): boolean {
    const data = change.new || change.old;
    if (data && '_device_id' in data && data._device_id === this.deviceId) {
      return true;
    }
    return false;
  }

  private setConnected(connected: boolean, forceNotify = false): void {
    const changed = this.connected !== connected;
    this.connected = connected;
    if (changed || forceNotify) {
      this.notifyConnectionListeners(connected);
    }
  }

  private notifyChangeListeners(change: RemoteChange): void {
    this.changeListeners.forEach((listener) => listener(change));
  }

  private notifyConnectionListeners(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  private notifyError(error: Error): void {
    this.errorListeners.forEach((listener) => listener(error));
  }

  onRemoteChange(listener: RemoteChangeListener): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  onConnectionChange(listener: ConnectionChangeListener): () => void {
    this.connectionListeners.add(listener);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  onSubscriptionReplaced(listener: () => void): () => void {
    this.replacementListeners.add(listener);
    return () => { this.replacementListeners.delete(listener); };
  }

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  private teardown(): void {
    this.subscriptionGeneration++;
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.currentHouseholdId = null;
    this.babyIds = [];
  }

  unsubscribe(): void {
    this.teardown();
    this.setConnected(false);
  }

  destroy(): void {
    this.unsubscribe();
    this.changeListeners.clear();
    this.connectionListeners.clear();
    this.errorListeners.clear();
    this.replacementListeners.clear();
    this.authContext = null;
  }

  __simulateRemoteChange(change: RemoteChange): void {
    if (this.isEchoFromSameDevice(change)) {
      return;
    }
    if (!this.verifyChangeOwnership(change)) {
      return;
    }
    this.notifyChangeListeners(change);
  }

  __testVerifyChangeOwnership(change: RemoteChange): boolean {
    return this.verifyChangeOwnership(change);
  }

  __testIsEchoFromSameDevice(change: RemoteChange): boolean {
    return this.isEchoFromSameDevice(change);
  }
}
