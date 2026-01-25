import { supabase } from '@/services/supabase';
import { SyncableTable } from './types';

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
];

export class RealTimeSync {
  private deviceId: string;
  private currentHouseholdId: string | null = null;
  private subscription: { unsubscribe: () => void } | null = null;
  private connected = false;
  private changeListeners: Set<RemoteChangeListener> = new Set();
  private connectionListeners: Set<ConnectionChangeListener> = new Set();
  private errorListeners: Set<ErrorListener> = new Set();
  private authContext: RealTimeSyncContext | null = null;

  constructor() {
    this.deviceId = this.generateDeviceId();
  }

  setAuthContext(context: RealTimeSyncContext): void {
    this.authContext = context;
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

  async subscribeToHousehold(householdId: string): Promise<void> {
    const authContext = this.ensureAuthContext();

    if (householdId !== authContext.householdId) {
      throw new Error('Cannot subscribe to a household the user does not belong to');
    }

    if (this.currentHouseholdId === householdId && this.subscription) {
      return;
    }

    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }

    this.currentHouseholdId = householdId;

    const channel = supabase.channel(`household:${householdId}`);

    for (const table of SYNCABLE_TABLES) {
      channel.on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table,
        } as never,
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          this.handleRemoteChange(table, payload);
        }
      );
    }

    this.subscription = channel.subscribe((status: string, error?: Error) => {
      if (status === 'SUBSCRIBED') {
        this.setConnected(true);
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
      new: payload.new || null,
      old: payload.old || null,
    };

    if (this.isEchoFromSameDevice(change)) {
      return;
    }

    if (!this.verifyChangeOwnership(change)) {
      console.warn(`Received change for different household, ignoring: ${table}`);
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
      return data.household_id === this.authContext.householdId;
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

  onError(listener: ErrorListener): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  unsubscribe(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
    this.currentHouseholdId = null;
    this.setConnected(false);
  }

  destroy(): void {
    this.unsubscribe();
    this.changeListeners.clear();
    this.connectionListeners.clear();
    this.errorListeners.clear();
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
