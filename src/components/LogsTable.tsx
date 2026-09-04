import React, { useState, useEffect, useRef } from 'react';
import { LogItem, TagTypeItem } from '../types.ts';
import {
  Trash2,
  Copy,
  CheckCheck,
  Plus,
  Calendar,
  Tag,
  Folder,
  Filter,
  X,
  Edit2,
  CheckCircle2,
  Clock,
  BookmarkPlus,
  CheckSquare,
  Square,
  MinusSquare,
  FileSpreadsheet,
  TableProperties,
} from 'lucide-react';
import { EditLogModal } from './EditLogModal.tsx';
import { useAuth } from '../context/AuthContext.tsx';

interface LogsTableProps {
  logs: LogItem[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<boolean>;
  onUpdate?: (
    id: number,
    data: {
      logDate: string;
      logDescription?: string;
      logAmount?: string;
      logCategory?: number;
      reconciled?: boolean;
      tagIds?: number[];
    }
  ) => Promise<{ success: boolean; error?: string }>;
  searchTerm: string;
  onOpenAdd?: () => void;
  onOpenImportCsv?: () => void;
  onOpenSummary?: () => void;
  onRefresh?: () => void;
  onNotice?: (type: 'success' | 'error', message: string) => void;
}

export const LogsTable: React.FC<LogsTableProps> = ({
  logs,
  isLoading,
  onDelete,
  onUpdate,
  searchTerm,
  onOpenAdd,
  onOpenImportCsv,
  onOpenSummary,
  onRefresh,
  onNotice,
}) => {
  const { authFetch } = useAuth();
  const [editingLog, setEditingLog] = useState<LogItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedTagFilter, setSelectedTagFilter] = useState<string>('all');
  const [reconciledFilter, setReconciledFilter] = useState<string>('all');
  const [tagTypes, setTagTypes] = useState<TagTypeItem[]>([]);

  // Selection state for copying logs to starter_logs
  const [selectedLogIds, setSelectedLogIds] = useState<Set<number>>(new Set());
  const [isCopyingToStarter, setIsCopyingToStarter] = useState(false);

  // Tag popover state
  const [activeTagPopoverLogId, setActiveTagPopoverLogId] = useState<number | null>(null);
  const [isAssigningTag, setIsAssigningTag] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    authFetch('/api/tag-types')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTagTypes(d);
      })
      .catch(() => {});
  }, []);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveTagPopoverLogId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = logs.filter((item) => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (item.logDescription && item.logDescription.toLowerCase().includes(term)) ||
      (item.logDate && item.logDate.toLowerCase().includes(term)) ||
      (item.categoryName && item.categoryName.toLowerCase().includes(term)) ||
      (item.logAmount && item.logAmount.includes(term)) ||
      item.id.toString().includes(term) ||
      (item.tags && item.tags.some((t) => t.tagName.toLowerCase().includes(term)));

    if (!matchesSearch) return false;

    if (selectedTagFilter !== 'all') {
      const tagIdNum = Number(selectedTagFilter);
      if (!item.tags || !item.tags.some((t) => t.tagId === tagIdNum)) return false;
    }

    if (reconciledFilter === 'reconciled') {
      if (item.reconciled === false) return false;
    } else if (reconciledFilter === 'unreconciled') {
      if (item.reconciled !== false) return false;
    }

    return true;
  });

  // Checkbox selection handlers
  const handleToggleSelectAll = () => {
    if (filtered.length === 0) return;
    const allSelected = filtered.every((item) => selectedLogIds.has(item.id));
    if (allSelected) {
      const next = new Set(selectedLogIds);
      filtered.forEach((item) => next.delete(item.id));
      setSelectedLogIds(next);
    } else {
      const next = new Set(selectedLogIds);
      filtered.forEach((item) => next.add(item.id));
      setSelectedLogIds(next);
    }
  };

  const handleToggleSelectRow = (id: number) => {
    const next = new Set(selectedLogIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedLogIds(next);
  };

  const handleCopyToStarterLogs = async () => {
    const idsToCopy = Array.from(selectedLogIds);
    if (idsToCopy.length === 0) return;

    setIsCopyingToStarter(true);
    try {
      const res = await authFetch('/api/logs/copy-to-starter-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: idsToCopy }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to copy logs to starter logs');
      }

      if (onNotice) {
        onNotice('success', `Copied ${data.count} log record(s) to 'starter_logs' table!`);
      }
      setSelectedLogIds(new Set());
      if (onRefresh) onRefresh();
    } catch (err: any) {
      console.error('Error copying to starter logs:', err);
      if (onNotice) {
        onNotice('error', err.message || 'Error copying logs to starter logs.');
      }
    } finally {
      setIsCopyingToStarter(false);
    }
  };

  const isAllSelected = filtered.length > 0 && filtered.every((item) => selectedLogIds.has(item.id));
  const isSomeSelected = filtered.some((item) => selectedLogIds.has(item.id)) && !isAllSelected;

  const handleDelete = async (id: number) => {
    setIsSubmitting(true);
    const success = await onDelete(id);
    setIsSubmitting(false);
    if (success) {
      setDeletingId(null);
      if (selectedLogIds.has(id)) {
        const next = new Set(selectedLogIds);
        next.delete(id);
        setSelectedLogIds(next);
      }
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatAmount = (val?: string | null) => {
    if (!val) return '—';
    const num = parseFloat(val);
    if (isNaN(num)) return val;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(num);
  };

  const handleQuickAddTag = async (logId: number, tagId: number) => {
    setIsAssigningTag(true);
    try {
      const res = await authFetch('/api/tag-log-assns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ logId, tagId }),
      });
      if (res.ok) {
        if (onRefresh) onRefresh();
        setActiveTagPopoverLogId(null);
      }
    } catch (err) {
      console.error('Failed to attach tag:', err);
    } finally {
      setIsAssigningTag(false);
    }
  };

  const handleRemoveTag = async (assnId: number) => {
    try {
      const res = await authFetch(`/api/tag-log-assns/${assnId}`, { method: 'DELETE' });
      if (res.ok && onRefresh) {
        onRefresh();
      }
    } catch (err) {
      console.error('Failed to detach tag:', err);
    }
  };

  const handleEditClick = (item: LogItem) => {
    setEditingLog(item);
    setIsEditModalOpen(true);
  };

  const handleToggleReconciled = async (item: LogItem) => {
    const nextVal = item.reconciled === false ? true : false;
    await handleUpdateLog(item.id, {
      logDate: item.logDate,
      logDescription: item.logDescription || undefined,
      logAmount: item.logAmount || undefined,
      logCategory: item.logCategory || undefined,
      reconciled: nextVal,
      tagIds: item.tags?.map((t) => t.tagId),
    });
  };

  const handleUpdateLog = async (
    id: number,
    data: {
      logDate: string;
      logDescription?: string;
      logAmount?: string;
      logCategory?: number;
      reconciled?: boolean;
      tagIds?: number[];
    }
  ): Promise<{ success: boolean; error?: string }> => {
    if (onUpdate) {
      const res = await onUpdate(id, data);
      if (res.success && onRefresh) {
        onRefresh();
      }
      return res;
    }

    try {
      const res = await authFetch(`/api/logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to update log.' };
      }
      if (onRefresh) onRefresh();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error updating log.' };
    }
  };

  return (
    <div id="logs-table-container" className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {/* Table Filter & Bulk Actions Bar */}
      <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/40 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <Filter className="w-3.5 h-3.5 text-purple-600" />
            <span>Tag Type:</span>
          </div>

          <select
            id="tag-type-filter-select"
            value={selectedTagFilter}
            onChange={(e) => setSelectedTagFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-800 focus:outline-none focus:border-black transition-colors"
          >
            <option value="all">All Tags ({logs.length})</option>
            {tagTypes.map((tag) => {
              const count = logs.filter((l) => l.tags?.some((t) => t.tagId === tag.id)).length;
              return (
                <option key={tag.id} value={tag.id}>
                  #{tag.id} {tag.name} ({count})
                </option>
              );
            })}
          </select>

          <div className="h-4 w-px bg-gray-200" />

          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Reconciled:</span>
          </div>

          <select
            id="reconciled-filter-select"
            value={reconciledFilter}
            onChange={(e) => setReconciledFilter(e.target.value)}
            className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs font-mono text-gray-800 focus:outline-none focus:border-black transition-colors"
          >
            <option value="all">All Statuses ({logs.length})</option>
            <option value="reconciled">
              Reconciled ({logs.filter((l) => l.reconciled !== false).length})
            </option>
            <option value="unreconciled">
              Unreconciled ({logs.filter((l) => l.reconciled === false).length})
            </option>
          </select>

          {(selectedTagFilter !== 'all' || reconciledFilter !== 'all') && (
            <button
              id="clear-all-filters-btn"
              type="button"
              onClick={() => {
                setSelectedTagFilter('all');
                setReconciledFilter('all');
              }}
              className="text-xs text-purple-600 hover:text-purple-800 underline flex items-center gap-0.5"
            >
              <X className="w-3 h-3" /> Reset Filters
            </button>
          )}
        </div>

        {/* Selected Rows Counter & Bulk Action Button */}
        <div className="flex items-center gap-3">
          {selectedLogIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium">
                {selectedLogIds.size} checked
              </span>
              <button
                id="copy-to-starter-logs-btn"
                type="button"
                disabled={isCopyingToStarter}
                onClick={handleCopyToStarterLogs}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-md hover:bg-amber-700 text-xs font-medium flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-50"
                title="Copy checked logs to starter_logs table"
              >
                <BookmarkPlus className="w-3.5 h-3.5" />
                <span>{isCopyingToStarter ? 'Copying...' : 'Copy to Starter Logs'}</span>
              </button>
              <button
                id="clear-selection-btn"
                type="button"
                onClick={() => setSelectedLogIds(new Set())}
                className="text-xs text-gray-400 hover:text-gray-700 underline"
              >
                Deselect
              </button>
            </div>
          )}

          {onOpenImportCsv && (
            <button
              id="logs-table-import-csv-btn"
              type="button"
              onClick={onOpenImportCsv}
              className="px-2.5 py-1 text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Import records from CSV file or preset"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          )}

          {onOpenSummary && (
            <button
              id="logs-table-summary-pivot-btn"
              type="button"
              onClick={onOpenSummary}
              className="px-2.5 py-1 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Open Summary & Pivot Table view"
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Summary &amp; Pivot</span>
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              {/* ID Column with Checkbox */}
              <th className="px-5 py-4 w-28">
                <div className="flex items-center gap-2">
                  <button
                    id="select-all-logs-checkbox-btn"
                    type="button"
                    onClick={handleToggleSelectAll}
                    title={isAllSelected ? "Deselect all logs" : "Select all visible logs"}
                    className="text-gray-400 hover:text-black transition-colors"
                  >
                    {isAllSelected ? (
                      <CheckSquare className="w-4 h-4 text-amber-600" />
                    ) : isSomeSelected ? (
                      <MinusSquare className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <span>ID</span>
                </div>
              </th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4">Description</th>
              <th className="px-5 py-4">Category</th>
              <th className="px-5 py-4 min-w-[200px]">Attached Tags (`tag_type`)</th>
              <th className="px-5 py-4">Amount</th>
              <th className="px-5 py-4">Reconciled</th>
              <th className="px-5 py-4 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={8} className="py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 font-mono">Querying PostgreSQL Cloud SQL...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-gray-400">
                  {searchTerm || selectedTagFilter !== 'all' || reconciledFilter !== 'all' ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No logs matching selected filters</p>
                      <p className="text-xs text-gray-400 mt-1">Try clearing your search query, tag type filter, or status filter</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No records found in `logs` table</p>
                      <p className="text-xs text-gray-400 mt-1">Click "+ Add Log Entry" to record a new transaction or activity</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isDeleting = deletingId === item.id;
                const itemTags = item.tags || [];
                const isPopoverOpen = activeTagPopoverLogId === item.id;
                const isChecked = selectedLogIds.has(item.id);

                // Tags available to add to this log
                const availableTags = tagTypes.filter(
                  (tt) => !itemTags.some((attached) => attached.tagId === tt.id)
                );

                return (
                  <tr
                    key={item.id}
                    id={`log-row-${item.id}`}
                    className={`group transition-colors ${
                      isDeleting
                        ? 'bg-rose-50/40'
                        : isChecked
                        ? 'bg-amber-50/30'
                        : 'hover:bg-gray-50/50'
                    }`}
                  >
                    {/* ID with Checkbox */}
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-900 font-medium">
                      <div className="flex items-center gap-2">
                        <input
                          id={`log-checkbox-${item.id}`}
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSelectRow(item.id)}
                          className="w-3.5 h-3.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer accent-amber-600"
                        />
                        <span className="flex items-center gap-1.5">
                          #{item.id}
                        </span>
                        <button
                          id={`copy-log-id-btn-${item.id}`}
                          type="button"
                          onClick={() => copyToClipboard(item.id.toString(), item.id)}
                          title="Copy ID"
                          className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-black p-0.5 rounded transition-all"
                        >
                          {copiedId === item.id ? (
                            <CheckCheck className="w-3 h-3 text-emerald-600" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-800 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-gray-400" />
                        <span>{item.logDate}</span>
                      </div>
                    </td>

                    {/* Description */}
                    <td className="px-5 py-3.5 text-sm text-gray-900">
                      <span className="font-medium">{item.logDescription || '—'}</span>
                    </td>

                    {/* Category */}
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                      {item.categoryName ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 font-medium border border-emerald-100">
                          <Folder className="w-3.5 h-3.5" />
                          {item.categoryName}
                        </span>
                      ) : (
                        <span className="text-gray-400 font-mono">—</span>
                      )}
                    </td>

                    {/* Attached Tags (`tag_type` via `tag_log_assn`) */}
                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 relative">
                        {itemTags.map((t) => (
                          <span
                            key={t.assnId}
                            id={`log-${item.id}-tag-badge-${t.tagId}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-200/60 text-[11px]"
                          >
                            <Tag className="w-2.5 h-2.5 text-purple-500" />
                            <span>{t.tagName}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveTag(t.assnId)}
                              title={`Remove tag "${t.tagName}"`}
                              className="text-purple-400 hover:text-purple-900 hover:bg-purple-200/50 rounded p-0.5 transition-colors"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}

                        {/* Quick Tag Selector Button & Popover */}
                        <div className="relative">
                          <button
                            id={`add-tag-to-log-btn-${item.id}`}
                            type="button"
                            onClick={() =>
                              setActiveTagPopoverLogId(isPopoverOpen ? null : item.id)
                            }
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border transition-colors ${
                              isPopoverOpen
                                ? 'bg-purple-600 text-white border-purple-700'
                                : 'bg-gray-50 text-gray-500 hover:text-gray-900 hover:bg-gray-100 border-dashed border-gray-200'
                            }`}
                            title="Assign tag from tag_type list"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Tag</span>
                          </button>

                          {/* Popover Selection List */}
                          {isPopoverOpen && (
                            <div
                              ref={popoverRef}
                              id={`tag-selection-popover-${item.id}`}
                              className="absolute left-0 top-full mt-1.5 z-40 w-52 bg-white rounded-lg shadow-xl border border-gray-100 p-2 text-xs animate-in fade-in zoom-in-95 duration-100"
                            >
                              <div className="font-semibold text-gray-700 pb-1.5 mb-1.5 border-b border-gray-100 text-[11px] flex items-center justify-between">
                                <span>Select `tag_type` to add:</span>
                                <button
                                  type="button"
                                  onClick={() => setActiveTagPopoverLogId(null)}
                                  className="text-gray-400 hover:text-gray-700"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>

                              {availableTags.length === 0 ? (
                                <p className="text-[11px] text-gray-400 py-1">
                                  {tagTypes.length === 0
                                    ? 'No tags exist in database.'
                                    : 'All available tag_types are already attached!'}
                                </p>
                              ) : (
                                <div className="max-h-36 overflow-y-auto space-y-0.5">
                                  {availableTags.map((tag) => (
                                    <button
                                      key={tag.id}
                                      id={`assign-tag-${tag.id}-to-log-${item.id}`}
                                      type="button"
                                      disabled={isAssigningTag}
                                      onClick={() => handleQuickAddTag(item.id, tag.id)}
                                      className="w-full text-left px-2 py-1 rounded hover:bg-purple-50 hover:text-purple-800 text-gray-700 text-xs flex items-center justify-between transition-colors disabled:opacity-50"
                                    >
                                      <span className="truncate">{tag.name}</span>
                                      <span className="text-[10px] font-mono text-gray-400">
                                        #{tag.id}
                                      </span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Amount */}
                    <td className={`px-5 py-3.5 text-xs font-mono font-semibold whitespace-nowrap ${
                      parseFloat(item.logAmount || '0') >= 0 ? 'text-emerald-700' : 'text-rose-600'
                    }`}>
                      {formatAmount(item.logAmount)}
                    </td>

                    {/* Reconciled (boolean, default True) */}
                    <td className="px-5 py-3.5 text-xs whitespace-nowrap">
                      <button
                        id={`toggle-reconciled-btn-${item.id}`}
                        type="button"
                        onClick={() => handleToggleReconciled(item)}
                        title={`Click to mark as ${item.reconciled === false ? 'Reconciled' : 'Unreconciled'}`}
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all cursor-pointer ${
                          item.reconciled !== false
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200/80 hover:bg-emerald-100/70'
                            : 'bg-amber-50 text-amber-700 border-amber-200/80 hover:bg-amber-100/70'
                        }`}
                      >
                        {item.reconciled !== false ? (
                          <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Reconciled</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>Pending</span>
                          </>
                        )}
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right whitespace-nowrap">
                      {isDeleting ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`confirm-delete-log-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white text-[11px] font-medium rounded hover:bg-rose-700 disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            id={`cancel-delete-log-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-log-btn-${item.id}`}
                            type="button"
                            onClick={() => handleEditClick(item)}
                            className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors"
                            title="Edit log entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-log-btn-${item.id}`}
                            type="button"
                            onClick={() => setDeletingId(item.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                            title="Delete log entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between">
        <div className="text-xs text-gray-400 font-mono">
          Total: <span className="text-gray-900 font-medium">{filtered.length}</span> logs
          {selectedLogIds.size > 0 && (
            <span className="text-amber-700 font-medium ml-2">({selectedLogIds.size} checked)</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedLogIds.size > 0 && (
            <button
              id="footer-copy-to-starter-logs-btn"
              type="button"
              disabled={isCopyingToStarter}
              onClick={handleCopyToStarterLogs}
              className="text-xs font-medium text-amber-700 hover:text-amber-900 flex items-center gap-1 transition-colors disabled:opacity-50"
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              <span>Copy {selectedLogIds.size} to Starter Logs</span>
            </button>
          )}
          {onOpenAdd && (
            <button
              type="button"
              onClick={onOpenAdd}
              className="text-xs font-medium text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3 h-3" />
              <span>Add log entry</span>
            </button>
          )}
        </div>
      </div>

      {/* Edit Log Modal */}
      <EditLogModal
        isOpen={isEditModalOpen}
        log={editingLog}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingLog(null);
        }}
        onUpdate={handleUpdateLog}
      />
    </div>
  );
};
