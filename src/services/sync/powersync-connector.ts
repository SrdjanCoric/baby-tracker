import {
  AbstractPowerSyncDatabase,
  CrudEntry,
  PowerSyncBackendConnector,
  UpdateType,
} from '@powersync/react-native';
import { supabase } from '@/services/supabase';

export class SupabaseConnector implements PowerSyncBackendConnector {
  private refreshPromise: Promise<string | null> | null = null;

  async fetchCredentials(): Promise<{
    endpoint: string;
    token: string;
  } | null> {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session) {
      return null;
    }

    const expiresAt = session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const bufferSeconds = 60;

    if (expiresAt && expiresAt - now < bufferSeconds) {
      const refreshedToken = await this.refreshToken();
      if (refreshedToken) {
        return {
          endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL || '',
          token: refreshedToken,
        };
      }
      return null;
    }

    return {
      endpoint: process.env.EXPO_PUBLIC_POWERSYNC_URL || '',
      token: session.access_token,
    };
  }

  private async refreshToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session) {
          return null;
        }
        return data.session.access_token;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();
    if (!transaction) {
      return;
    }

    try {
      for (const op of transaction.crud) {
        await this.applyOperation(op);
      }
      await transaction.complete();
    } catch (error) {
      if (this.isRetryableError(error)) {
        throw error;
      }

      console.error('[PowerSync] Non-retryable error during upload:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationCount: transaction.crud.length,
      });

      throw error;
    }
  }

  private async applyOperation(op: CrudEntry): Promise<void> {
    const table = op.table;
    const id = op.id;
    const data = op.opData;

    switch (op.op) {
      case UpdateType.PUT:
        await this.upsertRecord(table, id, data);
        break;
      case UpdateType.PATCH:
        await this.updateRecord(table, id, data);
        break;
      case UpdateType.DELETE:
        await this.deleteRecord(table, id);
        break;
    }
  }

  private async upsertRecord(
    table: string,
    id: string,
    data: Record<string, unknown> | undefined
  ): Promise<void> {
    if (!data) return;

    const { error } = await supabase.from(table).upsert({
      id,
      ...this.transformToSnakeCase(data),
    });

    if (error) {
      throw new Error(`Failed to upsert ${table}/${id}: ${error.message}`);
    }
  }

  private async updateRecord(
    table: string,
    id: string,
    data: Record<string, unknown> | undefined
  ): Promise<void> {
    if (!data) return;

    const { error } = await supabase
      .from(table)
      .update(this.transformToSnakeCase(data))
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update ${table}/${id}: ${error.message}`);
    }
  }

  private async deleteRecord(table: string, id: string): Promise<void> {
    const { error } = await supabase.from(table).delete().eq('id', id);

    if (error) {
      throw new Error(`Failed to delete ${table}/${id}: ${error.message}`);
    }
  }

  private transformToSnakeCase(
    data: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const snakeKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
      result[snakeKey] = value;
    }
    return result;
  }

  private isRetryableError(error: unknown): boolean {
    if (!error) return false;

    if (error instanceof TypeError && error.message.includes('Failed to fetch')) {
      return true;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      const networkPatterns = [
        'network',
        'timeout',
        'connection',
        'econnrefused',
        'enotfound',
        'socket',
        'aborted',
      ];

      if (networkPatterns.some(pattern => message.includes(pattern))) {
        return true;
      }

      const retryableStatusCodes = ['502', '503', '504', '429'];
      if (retryableStatusCodes.some(code => message.includes(code))) {
        return true;
      }

      const nonRetryablePatterns = [
        'permission denied',
        'unauthorized',
        'forbidden',
        'not found',
        'invalid',
        'constraint',
        'duplicate',
        '401',
        '403',
        '404',
        '409',
        '422',
      ];

      if (nonRetryablePatterns.some(pattern => message.includes(pattern))) {
        return false;
      }
    }

    const errorWithCode = error as { code?: string | number; status?: number };
    if (errorWithCode.status) {
      const status = errorWithCode.status;
      if (status >= 500 && status < 600 && status !== 501) {
        return true;
      }
      if (status === 429) {
        return true;
      }
    }

    if (errorWithCode.code === 'ETIMEDOUT' || errorWithCode.code === 'ECONNRESET') {
      return true;
    }

    return false;
  }
}

let connectorInstance: SupabaseConnector | null = null;

export function getSupabaseConnector(): SupabaseConnector {
  if (!connectorInstance) {
    connectorInstance = new SupabaseConnector();
  }
  return connectorInstance;
}
