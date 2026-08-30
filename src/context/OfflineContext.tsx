import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useAuth } from './AuthContext.tsx';
import {
  OfflineMutation,
  OfflineOperationType,
  SyncStatus,
  LogItem,
  StarterLogItem,
  TagLogAssnItem,
  LogTypeItem,
  TagTypeItem,
  CategoryTypeItem,
} from '../types.ts';
import {
  getUserMutations,
  enqueueMutation,
  removeMutation,
  updateMutationStatus,
  clearUserMutations,
  getCachedTable,
  setCachedTable,
  getSimulatedOffline,
  setSimulatedOffline as setSimulatedOfflineStorage,
  getLastSyncTime,
  setLastSyncTime,
  generateTempNumericId,
  isTempId,
} from '../lib/offlineStorage.ts';

interface OfflineContextType {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  effectiveOffline: boolean;
  isSyncing: boolean;
  pendingMutations: OfflineMutation[];
  pendingCount: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  toggleSimulatedOffline: () => void;
  syncNow: () => Promise<{ success: boolean; syncedCount: number; error?: string }>;
  discardMutation: (id: string) => void;
  clearQueue: () => void;
  // Local cache helpers
  readCachedData: <T>(tableName: string) => T[];
  writeCachedData: <T>(tableName: string, data: T[]) => void;
  // Offline collection handlers
  collectOfflineRecord: (
    type: OfflineOperationType,
    table: string,
    targetId?: number | string,
    payload?: any
  ) => { tempId?: number; mutationId: string };
  isItemPendingSync: (table: string, id: number | string) => boolean;
}

const OfflineContext = createContext<OfflineContextType | undefined>(undefined);

export const OfflineProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, authFetch } = useAuth();
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [isSimulatedOffline, setIsSimulatedOfflineState] = useState<boolean>(getSimulatedOffline());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [pendingMutations, setPendingMutations] = useState<OfflineMutation[]>([]);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(getLastSyncTime(user?.uid));
  const [lastSyncError, setLastSyncError] = useState<string | null>(null);

  const effectiveOffline = !isOnline || isSimulatedOffline;

  // Refresh pending mutations list
  const refreshMutations = useCallback(() => {
    if (!user) {
      setPendingMutations([]);
      return;
    }
    const list = getUserMutations(user.uid);
    setPendingMutations(list);
  }, [user]);

  // Window online/offline event listeners
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update user mutations when user changes
  useEffect(() => {
    refreshMutations();
    if (user) {
      setLastSyncedAt(getLastSyncTime(user.uid));
    }
  }, [user, refreshMutations]);

  const toggleSimulatedOffline = () => {
    const nextVal = !isSimulatedOffline;
    setIsSimulatedOfflineState(nextVal);
    setSimulatedOfflineStorage(nextVal);
  };

  const readCachedData = <T,>(tableName: string): T[] => {
    if (!user) return [];
    return getCachedTable<T>(user.uid, tableName);
  };

  const writeCachedData = <T,>(tableName: string, data: T[]): void => {
    if (!user) return;
    setCachedTable<T>(user.uid, tableName, data);
  };

  const isItemPendingSync = (table: string, id: number | string): boolean => {
    if (isTempId(id)) return true;
    return pendingMutations.some(
      (m) => m.table === table && (m.targetId === id || m.payload?.id === id)
    );
  };

  // Collect action while offline: updates local cache and enqueues mutation
  const collectOfflineRecord = (
    type: OfflineOperationType,
    table: string,
    targetId?: number | string,
    payload?: any
  ): { tempId?: number; mutationId: string } => {
    if (!user) throw new Error('Cannot record offline data without an authenticated user');

    let tempId: number | undefined = undefined;

    // If creating, generate temporary ID
    if (type.startsWith('CREATE_') && !targetId) {
      tempId = generateTempNumericId();
    }

    const effectiveTargetId = targetId ?? tempId;
    const finalPayload = payload ? { ...payload } : {};
    if (tempId && !finalPayload.id) {
      finalPayload.id = tempId;
    }

    const mutation = enqueueMutation(user.uid, type, table, effectiveTargetId, finalPayload);
    refreshMutations();

    // Optimistically update local cached table
    const currentList = readCachedData<any>(table);

    if (type.startsWith('CREATE_')) {
      const newItem = {
        id: effectiveTargetId,
        ...finalPayload,
        _isOffline: true,
        _pendingSync: true,
        created_at: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      writeCachedData(table, [newItem, ...currentList]);
    } else if (type.startsWith('UPDATE_')) {
      const updatedList = currentList.map((item) => {
        if (item.id === effectiveTargetId) {
          return { ...item, ...finalPayload, _isOffline: true, _pendingSync: true };
        }
        return item;
      });
      writeCachedData(table, updatedList);
    } else if (type.startsWith('DELETE_')) {
      const filteredList = currentList.filter((item) => item.id !== effectiveTargetId);
      writeCachedData(table, filteredList);
    } else if (type === 'CLEAR_TABLE') {
      writeCachedData(table, []);
    } else if (type === 'COPY_STARTER_TO_LOGS') {
      // Create new log from starter log template
      const newLogId = generateTempNumericId();
      const newLog: LogItem = {
        id: newLogId,
        logDate: finalPayload.logDate || new Date().toISOString().split('T')[0],
        logDescription: finalPayload.logDescription,
        logTypeId: finalPayload.logTypeId,
        logTypeName: finalPayload.logTypeName,
        logAmount: finalPayload.logAmount,
        logCategory: finalPayload.logCategory,
        categoryName: finalPayload.categoryName,
        reconciled: finalPayload.reconciled !== false,
        createdAt: new Date().toISOString(),
        _isOffline: true,
        _pendingSync: true,
      };
      const logsList = readCachedData<LogItem>('logs');
      writeCachedData('logs', [newLog, ...logsList]);
    } else if (type === 'BULK_COPY_TO_STARTER') {
      const sourceLogs: LogItem[] = finalPayload.logs || [];
      const currentStarters = readCachedData<StarterLogItem>('starter_logs');
      const newStarters: StarterLogItem[] = sourceLogs.map((log) => ({
        id: generateTempNumericId(),
        logDate: new Date().toISOString().split('T')[0],
        logDescription: log.logDescription,
        logTypeId: log.logTypeId,
        logTypeName: log.logTypeName,
        logAmount: log.logAmount,
        logCategory: log.logCategory,
        categoryName: log.categoryName,
        reconciled: false,
        createdAt: new Date().toISOString(),
        _isOffline: true,
        _pendingSync: true,
      }));
      writeCachedData('starter_logs', [...newStarters, ...currentStarters]);
    }

    return { tempId, mutationId: mutation.id };
  };

  const discardMutation = (id: string) => {
    removeMutation(id);
    refreshMutations();
  };

  const clearQueue = () => {
    if (!user) return;
    clearUserMutations(user.uid);
    refreshMutations();
  };

  // Synchronize queued mutations to PostgreSQL server
  const syncNow = async (): Promise<{ success: boolean; syncedCount: number; error?: string }> => {
    if (!user) {
      return { success: false, syncedCount: 0, error: 'User is not authenticated' };
    }

    if (effectiveOffline) {
      return {
        success: false,
        syncedCount: 0,
        error: isSimulatedOffline
          ? 'Cannot sync while Simulated Offline mode is active. Disable it first.'
          : 'Cannot sync while internet connection is offline.',
      };
    }

    const mutations = getUserMutations(user.uid);
    if (mutations.length === 0) {
      setLastSyncTime(user.uid);
      setLastSyncedAt(new Date().toISOString());
      return { success: true, syncedCount: 0 };
    }

    setIsSyncing(true);
    setLastSyncError(null);

    let syncedCount = 0;
    const tempIdMap = new Map<number | string, number>();

    try {
      for (const mutation of mutations) {
        updateMutationStatus(mutation.id, 'syncing');

        try {
          // 1. Logs
          if (mutation.type === 'CREATE_LOG') {
            const payload = { ...mutation.payload };
            // Ensure temp IDs are not sent in payload
            delete payload.id;
            delete payload._isOffline;
            delete payload._pendingSync;

            const res = await authFetch('/api/logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} creating log`);
            }

            const created = await res.json();
            if (mutation.targetId && created.id) {
              tempIdMap.set(mutation.targetId, created.id);
            }
            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'UPDATE_LOG') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            const payload = { ...mutation.payload };
            delete payload.id;
            delete payload._isOffline;
            delete payload._pendingSync;

            const res = await authFetch(`/api/logs/${targetId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} updating log`);
            }

            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'DELETE_LOG') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            if (isTempId(targetId)) {
              // Was only created offline, never sent to server
              removeMutation(mutation.id);
              syncedCount++;
            } else {
              const res = await authFetch(`/api/logs/${targetId}`, { method: 'DELETE' });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status} deleting log`);
              }
              removeMutation(mutation.id);
              syncedCount++;
            }
          }

          // 2. Starter Logs
          else if (mutation.type === 'CREATE_STARTER_LOG') {
            const payload = { ...mutation.payload };
            delete payload.id;
            delete payload._isOffline;
            delete payload._pendingSync;

            const res = await authFetch('/api/starter-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} creating starter log`);
            }

            const created = await res.json();
            if (mutation.targetId && created.id) {
              tempIdMap.set(mutation.targetId, created.id);
            }
            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'UPDATE_STARTER_LOG') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            const payload = { ...mutation.payload };
            delete payload.id;
            delete payload._isOffline;
            delete payload._pendingSync;

            const res = await authFetch(`/api/starter-logs/${targetId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} updating starter log`);
            }

            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'DELETE_STARTER_LOG') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            if (isTempId(targetId)) {
              removeMutation(mutation.id);
              syncedCount++;
            } else {
              const res = await authFetch(`/api/starter-logs/${targetId}`, { method: 'DELETE' });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status} deleting starter log`);
              }
              removeMutation(mutation.id);
              syncedCount++;
            }
          } else if (mutation.type === 'COPY_STARTER_TO_LOGS') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            const res = await authFetch(`/api/starter-logs/${targetId}/copy-to-logs`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                logDate: mutation.payload?.logDate || new Date().toISOString().split('T')[0],
              }),
            });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} copying starter log`);
            }
            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'BULK_COPY_TO_STARTER') {
            const resolvedIds = (mutation.payload?.logIds || []).map(
              (id: number) => tempIdMap.get(id) || id
            ).filter((id: number) => !isTempId(id));

            if (resolvedIds.length > 0) {
              const res = await authFetch('/api/logs/copy-to-starter-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ logIds: resolvedIds }),
              });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status} bulk copying to starter logs`);
              }
            }
            removeMutation(mutation.id);
            syncedCount++;
          }

          // 3. Lookup Types (category_type, tag_type, log_type)
          else if (mutation.type === 'CREATE_LOOKUP') {
            const endpoint =
              mutation.table === 'category_type'
                ? '/api/category-types'
                : mutation.table === 'tag_type'
                ? '/api/tag-types'
                : '/api/log-types';

            const res = await authFetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: mutation.payload?.name }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} creating ${mutation.table}`);
            }

            const created = await res.json();
            if (mutation.targetId && created.id) {
              tempIdMap.set(mutation.targetId, created.id);
            }
            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'UPDATE_LOOKUP') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            const endpoint =
              mutation.table === 'category_type'
                ? `/api/category-types/${targetId}`
                : mutation.table === 'tag_type'
                ? `/api/tag-types/${targetId}`
                : `/api/log-types/${targetId}`;

            const res = await authFetch(endpoint, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: mutation.payload?.name }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} updating ${mutation.table}`);
            }

            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'DELETE_LOOKUP') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            if (isTempId(targetId)) {
              removeMutation(mutation.id);
              syncedCount++;
            } else {
              const endpoint =
                mutation.table === 'category_type'
                  ? `/api/category-types/${targetId}`
                  : mutation.table === 'tag_type'
                  ? `/api/tag-types/${targetId}`
                  : `/api/log-types/${targetId}`;

              const res = await authFetch(endpoint, { method: 'DELETE' });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status} deleting ${mutation.table}`);
              }
              removeMutation(mutation.id);
              syncedCount++;
            }
          }

          // 4. Tag Log Associations
          else if (mutation.type === 'CREATE_TAG_LOG_ASSN') {
            const tagId = tempIdMap.get(mutation.payload?.tagId) || mutation.payload?.tagId;
            const logId = tempIdMap.get(mutation.payload?.logId) || mutation.payload?.logId;

            const res = await authFetch('/api/tag-log-assns', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ tagId, logId }),
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} creating tag association`);
            }

            removeMutation(mutation.id);
            syncedCount++;
          } else if (mutation.type === 'DELETE_TAG_LOG_ASSN') {
            const targetId = tempIdMap.get(mutation.targetId!) || mutation.targetId;
            if (isTempId(targetId)) {
              removeMutation(mutation.id);
              syncedCount++;
            } else {
              const res = await authFetch(`/api/tag-log-assns/${targetId}`, { method: 'DELETE' });
              if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `HTTP ${res.status} deleting tag association`);
              }
              removeMutation(mutation.id);
              syncedCount++;
            }
          }

          // 5. Clear Table
          else if (mutation.type === 'CLEAR_TABLE') {
            const endpoint =
              mutation.table === 'logs'
                ? '/api/logs'
                : mutation.table === 'starter_logs'
                ? '/api/starter-logs'
                : mutation.table === 'category_type'
                ? '/api/category-types'
                : mutation.table === 'tag_type'
                ? '/api/tag-types'
                : mutation.table === 'log_type'
                ? '/api/log-types'
                : '/api/tag-log-assns';

            const res = await authFetch(endpoint, { method: 'DELETE' });
            if (!res.ok) {
              const errData = await res.json().catch(() => ({}));
              throw new Error(errData.error || `HTTP ${res.status} clearing ${mutation.table}`);
            }
            removeMutation(mutation.id);
            syncedCount++;
          }
        } catch (itemErr: any) {
          console.error(`Sync error on mutation ${mutation.id}:`, itemErr);
          updateMutationStatus(mutation.id, 'failed', itemErr.message || 'Network/Server sync error');
          throw itemErr;
        }
      }

      setLastSyncTime(user.uid);
      setLastSyncedAt(new Date().toISOString());
      refreshMutations();

      return { success: true, syncedCount };
    } catch (err: any) {
      console.error('Batch sync interrupted:', err);
      setLastSyncError(err.message || 'Sync encountered errors');
      refreshMutations();
      return { success: false, syncedCount, error: err.message || 'Sync failed' };
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-sync when coming back online (if simulated offline is disabled and mutations exist)
  useEffect(() => {
    if (isOnline && !isSimulatedOffline && user && pendingMutations.length > 0 && !isSyncing) {
      const timer = setTimeout(() => {
        syncNow().catch(() => {});
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isOnline, isSimulatedOffline, user, pendingMutations.length]);

  return (
    <OfflineContext.Provider
      value={{
        isOnline,
        isSimulatedOffline,
        effectiveOffline,
        isSyncing,
        pendingMutations,
        pendingCount: pendingMutations.length,
        lastSyncedAt,
        lastSyncError,
        toggleSimulatedOffline,
        syncNow,
        discardMutation,
        clearQueue,
        readCachedData,
        writeCachedData,
        collectOfflineRecord,
        isItemPendingSync,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
};

export const useOffline = (): OfflineContextType => {
  const context = useContext(OfflineContext);
  if (!context) {
    throw new Error('useOffline must be used within an OfflineProvider');
  }
  return context;
};
