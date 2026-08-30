import React from 'react';
import {
  X,
  RefreshCw,
  CloudOff,
  CloudCheck,
  Trash2,
  Clock,
  AlertCircle,
  Database,
  ArrowRight,
  WifiOff,
  CheckCircle2,
  FileText,
  BookmarkCheck,
  Tag,
  Folder,
  Link2,
} from 'lucide-react';
import { useOffline } from '../context/OfflineContext.tsx';
import { OfflineMutation } from '../types.ts';

interface OfflineSyncDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData?: () => void;
}

export const OfflineSyncDrawer: React.FC<OfflineSyncDrawerProps> = ({
  isOpen,
  onClose,
  onRefreshData,
}) => {
  const {
    isOnline,
    isSimulatedOffline,
    effectiveOffline,
    isSyncing,
    pendingMutations,
    pendingCount,
    lastSyncedAt,
    lastSyncError,
    toggleSimulatedOffline,
    syncNow,
    discardMutation,
    clearQueue,
  } = useOffline();

  if (!isOpen) return null;

  const handleSyncAll = async () => {
    const res = await syncNow();
    if (res.success && onRefreshData) {
      onRefreshData();
    }
  };

  const getEntityIcon = (table: string) => {
    switch (table) {
      case 'logs':
        return <FileText className="w-3.5 h-3.5 text-blue-600" />;
      case 'starter_logs':
        return <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />;
      case 'category_type':
        return <Folder className="w-3.5 h-3.5 text-emerald-600" />;
      case 'tag_type':
        return <Tag className="w-3.5 h-3.5 text-purple-600" />;
      case 'tag_log_assn':
        return <Link2 className="w-3.5 h-3.5 text-indigo-600" />;
      default:
        return <Database className="w-3.5 h-3.5 text-gray-500" />;
    }
  };

  const formatOpTitle = (m: OfflineMutation) => {
    const op = m.type.replace('_LOG', '').replace('_LOOKUP', '').replace('_STARTER', '').replace('_TAG_LOG_ASSN', '');
    return `${op} in ${m.table}`;
  };

  return (
    <div
      id="offline-outbox-modal-overlay"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="offline-outbox-modal"
        className="bg-white rounded-xl shadow-2xl border border-gray-100 max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-amber-100 text-amber-900 rounded-lg">
              <CloudOff className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Offline Outbox &amp; Sync Manager</h3>
              <p className="text-xs text-gray-500">
                Manage locally queued records collected during offline periods
              </p>
            </div>
          </div>
          <button
            id="close-outbox-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
          {/* Status summary grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
              <div className="text-gray-400 font-mono">Network Status</div>
              <div className="flex items-center gap-1.5 font-medium text-gray-900">
                {effectiveOffline ? (
                  <>
                    <WifiOff className="w-3.5 h-3.5 text-amber-600" />
                    <span className="text-amber-700">
                      {isSimulatedOffline ? 'Simulated Offline' : 'Offline'}
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Online &amp; Connected</span>
                  </>
                )}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
              <div className="text-gray-400 font-mono">Pending Outbox</div>
              <div className="font-mono font-semibold text-gray-900 text-sm">
                {pendingCount} {pendingCount === 1 ? 'record' : 'records'}
              </div>
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1">
              <div className="text-gray-400 font-mono">Last Synchronized</div>
              <div className="font-mono text-gray-700 truncate">
                {lastSyncedAt ? new Date(lastSyncedAt).toLocaleTimeString() : 'Never'}
              </div>
            </div>
          </div>

          {/* Simulated Offline Switch Control */}
          <div className="p-3.5 bg-gray-50/70 border border-gray-200/80 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-medium text-gray-900">Simulate Offline Mode</div>
              <div className="text-gray-500">
                Test and verify offline data collection workflows without disconnecting your Wi-Fi.
              </div>
            </div>
            <button
              id="toggle-simulated-offline-modal-btn"
              type="button"
              onClick={toggleSimulatedOffline}
              className={`px-3 py-1.5 rounded-md font-medium text-xs transition-colors cursor-pointer ${
                isSimulatedOffline
                  ? 'bg-amber-600 text-white hover:bg-amber-700'
                  : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isSimulatedOffline ? 'Simulated: ON' : 'Simulated: OFF'}
            </button>
          </div>

          {/* Error Notice */}
          {lastSyncError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Sync warning: {lastSyncError}</span>
            </div>
          )}

          {/* Queue List */}
          <div>
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100">
              <h4 className="font-semibold text-gray-900 uppercase tracking-wider text-[11px]">
                Pending Collection Queue ({pendingCount})
              </h4>
              {pendingCount > 0 && (
                <button
                  id="clear-outbox-btn"
                  type="button"
                  onClick={clearQueue}
                  className="text-rose-600 hover:text-rose-800 hover:underline text-[11px]"
                >
                  Discard All Queued
                </button>
              )}
            </div>

            {pendingCount === 0 ? (
              <div className="py-8 text-center text-gray-400 bg-gray-50/40 rounded-lg border border-dashed border-gray-200">
                <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-1.5" />
                <p className="font-medium text-gray-700">Outbox is completely clear</p>
                <p className="text-gray-400 text-[11px] mt-0.5">
                  All collected records and modifications have been synced with PostgreSQL.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {pendingMutations.map((m) => (
                  <div
                    key={m.id}
                    id={`mutation-item-${m.id}`}
                    className="p-3 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors flex items-start justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="p-1.5 bg-gray-100 rounded mt-0.5">{getEntityIcon(m.table)}</div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-900 font-mono">
                            {formatOpTitle(m)}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                              m.status === 'syncing'
                                ? 'bg-blue-50 text-blue-700 animate-pulse'
                                : m.status === 'failed'
                                ? 'bg-rose-50 text-rose-700 font-semibold'
                                : 'bg-amber-50 text-amber-700'
                            }`}
                          >
                            {m.status}
                          </span>
                        </div>

                        {/* Payload preview */}
                        <div className="text-gray-600 font-mono text-[11px] space-y-0.5">
                          {m.payload?.logDescription && (
                            <div>Desc: "{m.payload.logDescription}"</div>
                          )}
                          {m.payload?.logDate && <div>Date: {m.payload.logDate}</div>}
                          {m.payload?.logAmount && <div>Amount: ${m.payload.logAmount}</div>}
                          {m.payload?.name && <div>Name: "{m.payload.name}"</div>}
                          {m.lastError && (
                            <div className="text-rose-600">Error: {m.lastError}</div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-gray-400 text-[10px]">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(m.createdAt).toLocaleTimeString()}</span>
                          <span>•</span>
                          <span>ID: {m.id}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      id={`discard-mutation-btn-${m.id}`}
                      type="button"
                      onClick={() => discardMutation(m.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      title="Discard this pending mutation"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {pendingCount > 0
              ? `${pendingCount} changes waiting to be pushed to Cloud SQL`
              : 'All records up to date'}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-outbox-bottom-btn"
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-700 bg-white border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              Close
            </button>

            <button
              id="sync-outbox-now-btn"
              type="button"
              disabled={isSyncing || pendingCount === 0 || effectiveOffline}
              onClick={handleSyncAll}
              className="px-4 py-1.5 text-xs bg-black text-white rounded hover:bg-gray-800 disabled:opacity-50 flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
