import { OfflineMutation, OfflineOperationType } from '../types.ts';

const CACHE_PREFIX = 'cloudsql_offline_cache_';
const QUEUE_KEY = 'cloudsql_offline_mutations_queue';
const SIMULATE_OFFLINE_KEY = 'cloudsql_simulate_offline_mode';
const LAST_SYNC_KEY = 'cloudsql_last_sync_timestamp';

// Helper to generate unique offline ID
export function generateOfflineId(): string {
  return `off_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Generate temporary numeric ID for records created offline
export function generateTempNumericId(): number {
  return -1 * Math.floor(Date.now() % 10000000 + Math.random() * 1000);
}

// Check if an ID is temporary (negative)
export function isTempId(id: number | string | undefined | null): boolean {
  if (typeof id === 'number') return id < 0;
  if (typeof id === 'string') return id.startsWith('-') || id.startsWith('off_') || id.startsWith('temp_');
  return false;
}

// Simulated offline state
export function getSimulatedOffline(): boolean {
  try {
    return localStorage.getItem(SIMULATE_OFFLINE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setSimulatedOffline(value: boolean): void {
  try {
    localStorage.setItem(SIMULATE_OFFLINE_KEY, value ? 'true' : 'false');
  } catch (err) {
    console.error('Error setting simulated offline:', err);
  }
}

// Last Sync Time
export function getLastSyncTime(userId?: string): string | null {
  try {
    const key = userId ? `${LAST_SYNC_KEY}_${userId}` : LAST_SYNC_KEY;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setLastSyncTime(userId?: string): void {
  try {
    const key = userId ? `${LAST_SYNC_KEY}_${userId}` : LAST_SYNC_KEY;
    localStorage.setItem(key, new Date().toISOString());
  } catch (err) {
    console.error('Error setting last sync time:', err);
  }
}

// Table Cache Management
export function getCachedTable<T>(userId: string, tableName: string): T[] {
  try {
    const key = `${CACHE_PREFIX}${userId}_${tableName}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error(`Error reading cached table ${tableName}:`, err);
    return [];
  }
}

export function setCachedTable<T>(userId: string, tableName: string, data: T[]): void {
  try {
    const key = `${CACHE_PREFIX}${userId}_${tableName}`;
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.error(`Error caching table ${tableName}:`, err);
  }
}

// Mutation Queue Management
export function getAllMutations(): OfflineMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Error reading offline mutations queue:', err);
    return [];
  }
}

export function getUserMutations(userId: string): OfflineMutation[] {
  return getAllMutations().filter((m) => m.userId === userId);
}

export function enqueueMutation(
  userId: string,
  type: OfflineOperationType,
  table: string,
  targetId?: number | string,
  payload?: any
): OfflineMutation {
  const mutation: OfflineMutation = {
    id: generateOfflineId(),
    userId,
    type,
    table,
    targetId,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    status: 'pending',
  };

  try {
    const list = getAllMutations();
    list.push(mutation);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error enqueueing offline mutation:', err);
  }

  return mutation;
}

export function removeMutation(id: string): void {
  try {
    const list = getAllMutations().filter((m) => m.id !== id);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error removing mutation:', err);
  }
}

export function updateMutationStatus(
  id: string,
  status: 'pending' | 'syncing' | 'failed',
  errorMsg?: string
): void {
  try {
    const list = getAllMutations().map((m) => {
      if (m.id === id) {
        return {
          ...m,
          status,
          retryCount: m.retryCount + (status === 'failed' ? 1 : 0),
          lastError: errorMsg || m.lastError,
        };
      }
      return m;
    });
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error updating mutation status:', err);
  }
}

export function clearUserMutations(userId: string): void {
  try {
    const list = getAllMutations().filter((m) => m.userId !== userId);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Error clearing mutations:', err);
  }
}
