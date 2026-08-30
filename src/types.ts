export interface LogTypeItem {
  id: number;
  name: string;
  created_at?: string | null;
  _isOffline?: boolean;
  _pendingSync?: boolean;
}

export interface TagTypeItem {
  id: number;
  name: string;
  created_at?: string | null;
  _isOffline?: boolean;
  _pendingSync?: boolean;
}

export interface CategoryTypeItem {
  id: number;
  name: string;
  created_at?: string | null;
  _isOffline?: boolean;
  _pendingSync?: boolean;
}

export interface LogTagRef {
  assnId: number;
  tagId: number;
  tagName: string;
  _isOffline?: boolean;
}

export interface LogItem {
  id: number;
  logDate: string;
  logDescription?: string | null;
  logTypeId?: number | null;
  logAmount?: string | null;
  logCategory?: number | null;
  reconciled?: boolean | null;
  createdAt?: string | null;
  logTypeName?: string | null;
  categoryName?: string | null;
  tags?: LogTagRef[];
  _isOffline?: boolean;
  _pendingSync?: boolean;
}

export interface StarterLogItem {
  id: number;
  logDate: string;
  logDescription?: string | null;
  logTypeId?: number | null;
  logAmount?: string | null;
  logCategory?: number | null;
  reconciled?: boolean | null;
  createdAt?: string | null;
  logTypeName?: string | null;
  categoryName?: string | null;
  _isOffline?: boolean;
  _pendingSync?: boolean;
}

export interface TagLogAssnItem {
  id: number;
  tagId: number;
  logId: number;
  createdAt?: string | null;
  tagName?: string | null;
  logDescription?: string | null;
  logDate?: string | null;
  _isOffline?: boolean;
  _pendingSync?: boolean;
}

export interface SchemaColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export type OfflineOperationType =
  | 'CREATE_LOG'
  | 'UPDATE_LOG'
  | 'DELETE_LOG'
  | 'CREATE_STARTER_LOG'
  | 'UPDATE_STARTER_LOG'
  | 'DELETE_STARTER_LOG'
  | 'COPY_STARTER_TO_LOGS'
  | 'BULK_COPY_TO_STARTER'
  | 'CREATE_LOOKUP'
  | 'UPDATE_LOOKUP'
  | 'DELETE_LOOKUP'
  | 'CREATE_TAG_LOG_ASSN'
  | 'DELETE_TAG_LOG_ASSN'
  | 'CLEAR_TABLE';

export interface OfflineMutation {
  id: string;
  userId: string;
  type: OfflineOperationType;
  table: string;
  targetId?: number | string;
  payload?: any;
  createdAt: string;
  retryCount: number;
  lastError?: string;
  status: 'pending' | 'syncing' | 'failed';
}

export interface SyncStatus {
  isOnline: boolean;
  isSimulatedOffline: boolean;
  isSyncing: boolean;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
}

