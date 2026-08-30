import React, { useState } from 'react';
import { StarterLogItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useOffline } from '../context/OfflineContext.tsx';
import {
  Trash2,
  Copy,
  CheckCheck,
  Plus,
  Calendar,
  Folder,
  Filter,
  X,
  Edit2,
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRightCircle,
  FileText,
  CloudOff,
} from 'lucide-react';
import { EditStarterLogModal } from './EditStarterLogModal.tsx';

interface StarterLogsTableProps {
  starterLogs: StarterLogItem[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<{ success: boolean; error?: string }>;
  onUpdate: (
    id: number,
    data: {
      logDate?: string;
      logDescription?: string;
      logTypeId?: number;
      logAmount?: string;
      logCategory?: number;
      reconciled?: boolean;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  onOpenAdd: () => void;
  onRefresh: () => void;
  onNotice?: (type: 'success' | 'error', message: string) => void;
}

export const StarterLogsTable: React.FC<StarterLogsTableProps> = ({
  starterLogs,
  isLoading,
  onDelete,
  onUpdate,
  onOpenAdd,
  onRefresh,
  onNotice,
}) => {
  const { authFetch } = useAuth();
  const { effectiveOffline, collectOfflineRecord, isItemPendingSync } = useOffline();
  const [searchTerm, setSearchTerm] = useState('');
  const [reconciledFilter, setReconciledFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [editingLog, setEditingLog] = useState<StarterLogItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const [isClearingAll, setIsClearingAll] = useState(false);

  // Extract unique log types and categories present in starterLogs
  const uniqueTypes = Array.from(
    new Set(starterLogs.filter((l) => l.logTypeName).map((l) => l.logTypeName as string))
  );
  const uniqueCategories = Array.from(
    new Set(starterLogs.filter((l) => l.categoryName).map((l) => l.categoryName as string))
  );

  const filtered = starterLogs.filter((item) => {
    // Search query match
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchDesc = item.logDescription?.toLowerCase().includes(q);
      const matchDate = item.logDate?.toLowerCase().includes(q);
      const matchType = item.logTypeName?.toLowerCase().includes(q);
      const matchCat = item.categoryName?.toLowerCase().includes(q);
      const matchAmount = item.logAmount?.toLowerCase().includes(q);
      const matchId = String(item.id).includes(q);
      if (!matchDesc && !matchDate && !matchType && !matchCat && !matchAmount && !matchId) {
        return false;
      }
    }

    // Reconciled filter
    if (reconciledFilter === 'reconciled') {
      if (item.reconciled !== true) return false;
    } else if (reconciledFilter === 'unreconciled') {
      if (item.reconciled === true) return false;
    }

    // Type filter
    if (typeFilter !== 'all' && item.logTypeName !== typeFilter) {
      return false;
    }

    // Category filter
    if (categoryFilter !== 'all' && item.categoryName !== categoryFilter) {
      return false;
    }

    return true;
  });

  const handleCopyJson = (item: StarterLogItem) => {
    navigator.clipboard.writeText(JSON.stringify(item, null, 2));
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenEdit = (item: StarterLogItem) => {
    setEditingLog(item);
    setIsEditModalOpen(true);
  };

  const handleToggleReconciled = async (item: StarterLogItem) => {
    const nextVal = !(item.reconciled === true);
    await onUpdate(item.id, {
      logDate: item.logDate,
      logDescription: item.logDescription || undefined,
      logTypeId: item.logTypeId || undefined,
      logAmount: item.logAmount || undefined,
      logCategory: item.logCategory || undefined,
      reconciled: nextVal,
    });
  };

  const handleApplyToLogs = async (item: StarterLogItem) => {
    setApplyingId(item.id);
    try {
      if (effectiveOffline) {
        collectOfflineRecord('CREATE_LOG', 'logs', undefined, {
          logDate: new Date().toISOString().split('T')[0],
          logDescription: item.logDescription,
          logTypeId: item.logTypeId,
          logAmount: item.logAmount,
          logCategory: item.logCategory,
          reconciled: false,
        });
        if (onNotice) {
          onNotice('success', `Copied starter log #${item.id} ("${item.logDescription || 'Entry'}") into active 'logs' (queued offline)!`);
        }
        if (onRefresh) onRefresh();
        return;
      }

      const res = await authFetch(`/api/starter-logs/${item.id}/copy-to-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logDate: new Date().toISOString().split('T')[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to apply starter log.');

      if (onNotice) {
        onNotice('success', `Copied starter log #${item.id} ("${item.logDescription || 'Entry'}") into active 'logs' with today's date!`);
      }
    } catch (err: any) {
      if (onNotice) {
        onNotice('error', err.message || 'Failed to copy to logs table.');
      }
    } finally {
      setApplyingId(null);
    }
  };

  const handleClearAllStarterLogs = async () => {
    if (!window.confirm('Are you sure you want to delete all starter_logs template records?')) return;
    setIsClearingAll(true);
    try {
      if (effectiveOffline) {
        for (const log of starterLogs) {
          collectOfflineRecord('DELETE_STARTER_LOG', 'starter_logs', log.id);
        }
        if (onNotice) onNotice('success', 'All starter logs cleared (queued offline).');
        onRefresh();
        return;
      }

      const res = await authFetch('/api/starter-logs', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear starter logs');
      if (onNotice) onNotice('success', data.message || 'All starter logs cleared.');
      onRefresh();
    } catch (err: any) {
      if (onNotice) onNotice('error', err.message || 'Failed to clear starter logs');
    } finally {
      setIsClearingAll(false);
    }
  };

  const formatAmount = (val?: string | null) => {
    if (!val) return <span className="text-gray-300 font-mono">-</span>;
    const num = parseFloat(val);
    if (isNaN(num)) return <span className="font-mono text-gray-500">{val}</span>;
    return (
      <span className="font-mono font-medium text-gray-900">
        ${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    );
  };

  const formatDate = (val: string) => {
    if (!val) return '';
    try {
      const datePart = val.split('T')[0];
      const [year, month, day] = datePart.split('-');
      const d = new Date(Number(year), Number(month) - 1, Number(day));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return val;
    }
  };

  return (
    <div id="starter-logs-table-container" className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden space-y-0">
      {/* Table Header & Filter Bar */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          {/* Reconciled Filter */}
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Reconciled:</span>
          </div>
          <select
            id="starter-logs-reconciled-filter"
            value={reconciledFilter}
            onChange={(e) => setReconciledFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-800 focus:outline-none focus:border-black transition-colors"
          >
            <option value="all">All ({starterLogs.length})</option>
            <option value="unreconciled">
              Pending / False ({starterLogs.filter((l) => l.reconciled !== true).length})
            </option>
            <option value="reconciled">
              Reconciled / True ({starterLogs.filter((l) => l.reconciled === true).length})
            </option>
          </select>

          {uniqueTypes.length > 0 && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <FileText className="w-3.5 h-3.5 text-blue-600" />
                <span>Log Type:</span>
              </div>
              <select
                id="starter-logs-type-filter"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-800 focus:outline-none focus:border-black transition-colors"
              >
                <option value="all">All Types</option>
                {uniqueTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </>
          )}

          {uniqueCategories.length > 0 && (
            <>
              <div className="h-4 w-px bg-gray-200" />
              <div className="flex items-center gap-1.5 font-medium text-gray-700">
                <Folder className="w-3.5 h-3.5 text-emerald-600" />
                <span>Category:</span>
              </div>
              <select
                id="starter-logs-category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-800 focus:outline-none focus:border-black transition-colors"
              >
                <option value="all">All Categories</option>
                {uniqueCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </>
          )}

          {(reconciledFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all' || searchTerm) && (
            <button
              id="reset-starter-filters-btn"
              type="button"
              onClick={() => {
                setReconciledFilter('all');
                setTypeFilter('all');
                setCategoryFilter('all');
                setSearchTerm('');
              }}
              className="text-xs text-amber-700 hover:text-amber-900 underline flex items-center gap-0.5 ml-1"
            >
              <X className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5">
          {starterLogs.length > 0 && (
            <button
              id="clear-all-starter-logs-btn"
              type="button"
              onClick={handleClearAllStarterLogs}
              disabled={isClearingAll}
              className="px-2.5 py-1 text-xs text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded border border-rose-200 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Clear All
            </button>
          )}

          <button
            id="open-add-starter-log-modal-btn"
            type="button"
            onClick={onOpenAdd}
            className="px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add starter_logs Record</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              <th className="px-5 py-3.5 w-16">ID</th>
              <th className="px-5 py-3.5 min-w-[130px]">Log Date</th>
              <th className="px-5 py-3.5 min-w-[200px]">Description</th>
              <th className="px-5 py-3.5">Log Type</th>
              <th className="px-5 py-3.5">Category</th>
              <th className="px-5 py-3.5">Amount</th>
              <th className="px-5 py-3.5">Reconciled (Default: False)</th>
              <th className="px-5 py-3.5 text-right w-36">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 font-mono">Querying starter_logs from Cloud SQL...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-gray-400">
                  {searchTerm || reconciledFilter !== 'all' || typeFilter !== 'all' || categoryFilter !== 'all' ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No starter_logs matching filters</p>
                      <p className="text-xs text-gray-400 mt-1">Try resetting your search query or dropdown filters</p>
                    </div>
                  ) : (
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <p className="text-sm font-medium text-gray-700">No starter_logs records yet</p>
                      <p className="text-xs text-gray-500">
                        The <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">starter_logs</code> table is ready. Create template entries with default <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">reconciled = False</code> and <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-gray-700">log_date = CURRENT_DATE</code>.
                      </p>
                      <button
                        id="empty-state-add-starter-btn"
                        type="button"
                        onClick={onOpenAdd}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-sm"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add First starter_log</span>
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr
                  key={item.id}
                  id={`starter-log-row-${item.id}`}
                  className="hover:bg-amber-50/20 transition-colors group"
                >
                  {/* ID */}
                  <td className="px-5 py-3.5 font-mono text-xs text-gray-500">
                    <div className="flex items-center gap-1.5">
                      <span>#{item.id}</span>
                      {(item.id < 0 || item._isOffline || isItemPendingSync('starter_logs', item.id)) && (
                        <span
                          title="Collected / modified offline (pending sync)"
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-50 text-amber-800 border border-amber-200/80"
                        >
                          <CloudOff className="w-2.5 h-2.5 text-amber-600" />
                          Offline
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Log Date */}
                  <td className="px-5 py-3.5 text-xs text-gray-900 whitespace-nowrap">
                    <div className="flex items-center gap-1.5 font-mono font-medium">
                      <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      <span>{formatDate(item.logDate)}</span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono block mt-0.5">
                      {item.logDate ? item.logDate.split('T')[0] : 'CURRENT_DATE'}
                    </span>
                  </td>

                  {/* Description */}
                  <td className="px-5 py-3.5 text-xs text-gray-800">
                    <div className="font-medium text-gray-900">{item.logDescription || <span className="text-gray-300 italic">No description</span>}</div>
                  </td>

                  {/* Log Type */}
                  <td className="px-5 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                    {item.logTypeName ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-50 text-blue-700 border border-blue-100">
                        {item.logTypeName}
                      </span>
                    ) : item.logTypeId ? (
                      <span className="font-mono text-gray-400 text-xs">#{item.logTypeId}</span>
                    ) : (
                      <span className="text-gray-300 font-mono text-xs">-</span>
                    )}
                  </td>

                  {/* Category */}
                  <td className="px-5 py-3.5 text-xs text-gray-600 whitespace-nowrap">
                    {item.categoryName ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100">
                        <Folder className="w-3 h-3 text-purple-500" />
                        <span>{item.categoryName}</span>
                      </span>
                    ) : item.logCategory ? (
                      <span className="font-mono text-gray-400 text-xs">#{item.logCategory}</span>
                    ) : (
                      <span className="text-gray-300 font-mono text-xs">-</span>
                    )}
                  </td>

                  {/* Amount */}
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                    {formatAmount(item.logAmount)}
                  </td>

                  {/* Reconciled (boolean, default False) */}
                  <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                    <button
                      id={`toggle-starter-reconciled-btn-${item.id}`}
                      type="button"
                      onClick={() => handleToggleReconciled(item)}
                      title={`Click to toggle status (Currently: ${item.reconciled === true ? 'True' : 'False (Default)'})`}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                        item.reconciled === true
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70'
                          : 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/70'
                      }`}
                    >
                      {item.reconciled === true ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>True (Reconciled)</span>
                        </>
                      ) : (
                        <>
                          <Clock className="w-3 h-3 text-amber-600" />
                          <span>False (Pending)</span>
                        </>
                      )}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Copy to active logs button */}
                      <button
                        id={`apply-starter-log-btn-${item.id}`}
                        type="button"
                        onClick={() => handleApplyToLogs(item)}
                        disabled={applyingId === item.id}
                        title="Copy this template record into active 'logs' table"
                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors flex items-center gap-1 text-[11px] font-medium"
                      >
                        <ArrowRightCircle className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Apply to Logs</span>
                      </button>

                      {/* Edit */}
                      <button
                        id={`edit-starter-log-btn-${item.id}`}
                        type="button"
                        onClick={() => handleOpenEdit(item)}
                        title="Edit starter log"
                        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      {/* Copy JSON */}
                      <button
                        id={`copy-starter-json-btn-${item.id}`}
                        type="button"
                        onClick={() => handleCopyJson(item)}
                        title="Copy JSON representation"
                        className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                      >
                        {copiedId === item.id ? (
                          <CheckCheck className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Delete */}
                      <button
                        id={`delete-starter-log-btn-${item.id}`}
                        type="button"
                        onClick={() => onDelete(item.id)}
                        title="Delete starter log entry"
                        className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      <EditStarterLogModal
        isOpen={isEditModalOpen}
        log={editingLog}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLog(null);
        }}
        onUpdate={onUpdate}
      />
    </div>
  );
};
