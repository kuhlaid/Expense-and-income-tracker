import React, { useState, useEffect } from 'react';
import { X, Calendar, FileText, Folder, DollarSign, AlertCircle, Sparkles, CloudOff } from 'lucide-react';
import { LogTypeItem, CategoryTypeItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useOffline } from '../context/OfflineContext.tsx';

interface AddStarterLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    logDate?: string;
    logDescription?: string;
    logTypeId?: number;
    logAmount?: string;
    logCategory?: number;
    reconciled?: boolean;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const AddStarterLogModal: React.FC<AddStarterLogModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const { authFetch } = useAuth();
  const { effectiveOffline, readCachedData, writeCachedData } = useOffline();
  const today = new Date().toISOString().split('T')[0];
  const [logDate, setLogDate] = useState(today);
  const [logDescription, setLogDescription] = useState('');
  const [logTypeId, setLogTypeId] = useState<string>('');
  const [logAmount, setLogAmount] = useState<string>('');
  const [logCategory, setLogCategory] = useState<string>('');
  const [reconciled, setReconciled] = useState<boolean>(false); // Requirement: default False
  
  const [logTypes, setLogTypes] = useState<LogTypeItem[]>([]);
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLogDate(new Date().toISOString().split('T')[0]);
      setReconciled(false);
      setErrorMsg(null);

      const cachedLogTypes = readCachedData<LogTypeItem>('log_type');
      const cachedCategories = readCachedData<CategoryTypeItem>('category_type');

      if (cachedLogTypes.length > 0) setLogTypes(cachedLogTypes);
      if (cachedCategories.length > 0) setCategoryTypes(cachedCategories);

      if (!effectiveOffline) {
        authFetch('/api/log-types')
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d)) {
              setLogTypes(d);
              writeCachedData('log_type', d);
            }
          })
          .catch(() => {});

        authFetch('/api/category-types')
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d)) {
              setCategoryTypes(d);
              writeCachedData('category_type', d);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, effectiveOffline]);


  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await onAdd({
      logDate: logDate.trim() || undefined,
      logDescription: logDescription.trim() || undefined,
      logTypeId: logTypeId ? Number(logTypeId) : undefined,
      logAmount: logAmount.trim() || undefined,
      logCategory: logCategory ? Number(logCategory) : undefined,
      reconciled,
    });

    setIsSubmitting(false);

    if (result.success) {
      setLogDescription('');
      setLogAmount('');
      setLogTypeId('');
      setLogCategory('');
      setReconciled(false);
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to add starter log record.');
    }
  };

  return (
    <div
      id="add-starter-log-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl border border-gray-100 max-w-lg w-full p-6 text-gray-900 animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-gray-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1 bg-amber-50 rounded text-amber-600">
                <Sparkles className="w-4 h-4" />
              </span>
              <h2 className="text-base font-semibold text-gray-900 tracking-tight">New starter_logs Entry</h2>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Creates a starter log record with default <code className="text-amber-700 bg-amber-50 px-1 py-0.5 rounded font-mono">reconciled = False</code> and <code className="text-blue-700 bg-blue-50 px-1 py-0.5 rounded font-mono">log_date = CURRENT_DATE</code>.
            </p>
          </div>
          <button
            id="close-add-starter-log-modal-btn"
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {effectiveOffline && (
            <div id="add-starter-log-offline-notice" className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Offline Mode:</strong> Starter template will be stored locally and synced when you reconnect.</span>
            </div>
          )}

          {/* log_date */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="starter-log-date-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Log Date (`log_date`)
              </label>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                default: CURRENT_DATE
              </span>
            </div>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="starter-log-date-input"
                type="date"
                value={logDate}
                onChange={(e) => setLogDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 font-mono focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          {/* log_description */}
          <div>
            <label htmlFor="starter-log-description-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Description (`log_description`)
            </label>
            <div className="relative">
              <FileText className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="starter-log-description-input"
                type="text"
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="e.g., Monthly Software Subscription / Client Retainer"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          {/* Grid for Log Type & Category Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* log_type_id */}
            <div>
              <label htmlFor="starter-log-type-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Log Type (`log_type_id`)
              </label>
              <select
                id="starter-log-type-select"
                value={logTypeId}
                onChange={(e) => setLogTypeId(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-black transition-colors"
              >
                <option value="">-- None (Null) --</option>
                {logTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    #{type.id} - {type.name}
                  </option>
                ))}
              </select>
            </div>

            {/* log_category */}
            <div>
              <label htmlFor="starter-log-category-select" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Folder className="w-3 h-3 text-gray-400" />
                <span>Category (`log_category`)</span>
              </label>
              <select
                id="starter-log-category-select"
                value={logCategory}
                onChange={(e) => setLogCategory(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-black transition-colors"
              >
                <option value="">-- None (Null) --</option>
                {categoryTypes.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    #{cat.id} - {cat.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* log_amount */}
          <div>
            <label htmlFor="starter-log-amount-input" className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Amount (`log_amount`)
            </label>
            <div className="relative">
              <DollarSign className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="starter-log-amount-input"
                type="number"
                step="0.01"
                min="0"
                value={logAmount}
                onChange={(e) => setLogAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-gray-200 rounded-lg text-gray-900 font-mono placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
            </div>
          </div>

          {/* Reconciled (boolean, default False) */}
          <div id="add-starter-log-reconciled-container" className="p-3 bg-amber-50/40 border border-amber-200/60 rounded-lg flex items-center justify-between">
            <div>
              <label htmlFor="starter-log-reconciled-checkbox" className="text-xs font-semibold text-gray-800 flex items-center gap-1.5 cursor-pointer">
                <span>Reconciled (`reconciled`)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-100 text-amber-800 border border-amber-200">
                  boolean (default: False)
                </span>
              </label>
              <p className="text-[11px] text-gray-500 mt-0.5">By default for starter_logs, this record is unreconciled (False).</p>
            </div>
            <input
              id="starter-log-reconciled-checkbox"
              type="checkbox"
              checked={reconciled}
              onChange={(e) => setReconciled(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-black focus:ring-black cursor-pointer"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              id="cancel-add-starter-log-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-add-starter-log-btn"
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-medium text-white bg-black hover:bg-gray-800 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Inserting into starter_logs...</span>
                </>
              ) : (
                <span>Add starter_logs Record</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
