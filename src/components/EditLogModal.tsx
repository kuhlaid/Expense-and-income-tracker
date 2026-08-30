import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, Tag, Folder, DollarSign, AlertCircle, Check, Loader2, CloudOff } from 'lucide-react';
import { LogItem, LogTypeItem, CategoryTypeItem, TagTypeItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useOffline } from '../context/OfflineContext.tsx';

interface EditLogModalProps {
  isOpen: boolean;
  log: LogItem | null;
  onClose: () => void;
  onUpdate: (
    id: number,
    data: {
      logDate: string;
      logDescription?: string;
      logTypeId?: number;
      logAmount?: string;
      logCategory?: number;
      reconciled?: boolean;
      tagIds?: number[];
    }
  ) => Promise<{ success: boolean; error?: string }>;
}

export const EditLogModal: React.FC<EditLogModalProps> = ({
  isOpen,
  log,
  onClose,
  onUpdate,
}) => {
  const { authFetch } = useAuth();
  const { effectiveOffline, readCachedData, writeCachedData } = useOffline();
  const [logDate, setLogDate] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [logTypeId, setLogTypeId] = useState<string>('');
  const [logAmount, setLogAmount] = useState<string>('');
  const [logCategory, setLogCategory] = useState<string>('');
  const [reconciled, setReconciled] = useState<boolean>(true);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const [logTypes, setLogTypes] = useState<LogTypeItem[]>([]);
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeItem[]>([]);
  const [tagTypes, setTagTypes] = useState<TagTypeItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cachedLogTypes = readCachedData<LogTypeItem>('log_type');
      const cachedCategories = readCachedData<CategoryTypeItem>('category_type');
      const cachedTags = readCachedData<TagTypeItem>('tag_type');

      if (cachedLogTypes.length > 0) setLogTypes(cachedLogTypes);
      if (cachedCategories.length > 0) setCategoryTypes(cachedCategories);
      if (cachedTags.length > 0) setTagTypes(cachedTags);

      if (!effectiveOffline) {
        authFetch('/api/log-types')
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) {
              setLogTypes(d);
              writeCachedData('log_type', d);
            }
          })
          .catch(() => {});

        authFetch('/api/category-types')
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) {
              setCategoryTypes(d);
              writeCachedData('category_type', d);
            }
          })
          .catch(() => {});

        authFetch('/api/tag-types')
          .then((r) => r.json())
          .then((d) => {
            if (Array.isArray(d)) {
              setTagTypes(d);
              writeCachedData('tag_type', d);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, effectiveOffline]);

  useEffect(() => {
    if (log && isOpen) {
      setLogDate(log.logDate || '');
      setLogDescription(log.logDescription || '');
      setLogTypeId(log.logTypeId ? String(log.logTypeId) : '');
      setLogAmount(log.logAmount ? String(log.logAmount) : '');
      setLogCategory(log.logCategory ? String(log.logCategory) : '');
      setReconciled(log.reconciled !== false);
      setSelectedTagIds(log.tags ? log.tags.map((t) => t.tagId) : []);
      setErrorMsg(null);
    }
  }, [log, isOpen]);

  if (!isOpen || !log) return null;

  const toggleTag = (id: number) => {
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!logDate) {
      setErrorMsg('Log date is required (YYYY-MM-DD).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await onUpdate(log.id, {
      logDate,
      logDescription: logDescription.trim() || undefined,
      logTypeId: logTypeId ? Number(logTypeId) : undefined,
      logAmount: logAmount.trim() || undefined,
      logCategory: logCategory ? Number(logCategory) : undefined,
      reconciled,
      tagIds: selectedTagIds,
    });

    setIsSubmitting(false);

    if (result.success) {
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to update log record.');
    }
  };

  return (
    <div
      id="edit-log-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div
        id="edit-log-modal-card"
        className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-gray-900">Edit Log Record</h3>
              <span className="px-2 py-0.5 rounded text-[11px] font-mono font-medium bg-gray-100 text-gray-700">
                #{log.id}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">Modify record data in the `logs` table</p>
          </div>
          <button
            id="close-edit-log-modal-btn"
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-black p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
          {effectiveOffline && (
            <div id="edit-log-offline-notice" className="p-2.5 bg-amber-50/80 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Offline Collection Mode:</strong> Updates will be saved locally and pushed when connection is restored.</span>
            </div>
          )}

          {errorMsg && (
            <div
              id="edit-log-modal-error"
              className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Date & Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                <span>Log Date *</span>
              </label>
              <input
                id="edit-log-date-input"
                type="date"
                required
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:border-black transition-colors font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-gray-400" />
                <span>Amount ($)</span>
              </label>
              <input
                id="edit-log-amount-input"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={logAmount}
                onChange={(e) => setLogAmount(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors font-mono"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-gray-400" />
              <span>Description</span>
            </label>
            <textarea
              id="edit-log-description-input"
              rows={2}
              placeholder="e.g. Q3 Cloud infrastructure invoice..."
              value={logDescription}
              onChange={(e) => setLogDescription(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
            />
          </div>

          {/* Type & Category Foreign Keys */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-gray-400" />
                <span>Log Type (`log_type_id`)</span>
              </label>
              <select
                id="edit-log-type-select"
                value={logTypeId}
                onChange={(e) => setLogTypeId(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:border-black transition-colors font-mono"
              >
                <option value="">-- Select Type --</option>
                {logTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.id} - {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Folder className="w-3.5 h-3.5 text-gray-400" />
                <span>Category (`log_category`)</span>
              </label>
              <select
                id="edit-log-category-select"
                value={logCategory}
                onChange={(e) => setLogCategory(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:border-black transition-colors font-mono"
              >
                <option value="">-- Select Category --</option>
                {categoryTypes.map((c) => (
                  <option key={c.id} value={c.id}>
                    #{c.id} - {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Reconciled (boolean) */}
          <div id="edit-log-reconciled-container" className="p-3 bg-gray-50 border border-gray-100 rounded-lg flex items-center justify-between">
            <div>
              <label htmlFor="edit-log-reconciled-checkbox" className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 cursor-pointer">
                <span>Reconciled</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                  reconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {reconciled ? 'Reconciled (True)' : 'Pending (False)'}
                </span>
              </label>
              <p className="text-[11px] text-gray-500 mt-0.5">Toggle reconciliation status for this transaction entry.</p>
            </div>
            <input
              id="edit-log-reconciled-checkbox"
              type="checkbox"
              checked={reconciled}
              onChange={(e) => setReconciled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
            />
          </div>

          {/* Tag Type Selection List (tag_type) */}
          <div id="edit-tag-type-selection-container" className="pt-1">
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                <span>Tag Type Selection List</span>
              </div>
              <span className="text-[11px] text-gray-400 font-normal font-mono">
                {selectedTagIds.length} selected
              </span>
            </label>

            {tagTypes.length === 0 ? (
              <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-500 font-mono">
                No `tag_type` entries found in the database.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-2 bg-gray-50/70 border border-gray-100 rounded-lg">
                  {tagTypes.map((tag) => {
                    const isSelected = selectedTagIds.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        id={`edit-select-tag-btn-${tag.id}`}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer border ${
                          isSelected
                            ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-3 h-3 text-white" />
                        ) : (
                          <Tag className="w-3 h-3 text-gray-400" />
                        )}
                        <span>{tag.name}</span>
                        <span
                          className={`text-[10px] font-mono ${
                            isSelected ? 'text-purple-200' : 'text-gray-400'
                          }`}
                        >
                          #{tag.id}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400">
                  Select tags to associate with this log entry via `tag_log_assn`.
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              id="cancel-edit-log-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-700 hover:text-black border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-edit-log-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-black hover:bg-gray-800 rounded flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
