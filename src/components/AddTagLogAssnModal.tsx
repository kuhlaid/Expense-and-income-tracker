import React, { useState, useEffect } from 'react';
import { X, Tag, FileText, AlertCircle, Link2, CloudOff } from 'lucide-react';
import { TagTypeItem, LogItem } from '../types.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useOffline } from '../context/OfflineContext.tsx';

interface AddTagLogAssnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (data: {
    tagId: number;
    logId: number;
  }) => Promise<{ success: boolean; error?: string }>;
}

export const AddTagLogAssnModal: React.FC<AddTagLogAssnModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const { authFetch } = useAuth();
  const { effectiveOffline, readCachedData, writeCachedData } = useOffline();
  const [tagId, setTagId] = useState<string>('');
  const [logId, setLogId] = useState<string>('');
  
  const [tagTypes, setTagTypes] = useState<TagTypeItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cachedTags = readCachedData<TagTypeItem>('tag_type');
      const cachedLogs = readCachedData<LogItem>('logs');

      if (cachedTags.length > 0) setTagTypes(cachedTags);
      if (cachedLogs.length > 0) setLogs(cachedLogs);

      if (!effectiveOffline) {
        authFetch('/api/tag-types')
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d)) {
              setTagTypes(d);
              writeCachedData('tag_type', d);
            }
          })
          .catch(() => {});

        authFetch('/api/logs')
          .then(r => r.json())
          .then(d => {
            if (Array.isArray(d)) {
              setLogs(d);
              writeCachedData('logs', d);
            }
          })
          .catch(() => {});
      }
    }
  }, [isOpen, effectiveOffline]);


  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tagId || !logId) {
      setErrorMsg('Please select both a tag and a log entry.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await onAdd({
      tagId: Number(tagId),
      logId: Number(logId),
    });

    setIsSubmitting(false);

    if (result.success) {
      setTagId('');
      setLogId('');
      onClose();
    } else {
      setErrorMsg(result.error || 'Failed to create association.');
    }
  };

  return (
    <div
      id="add-assn-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div
        id="add-assn-modal-card"
        className="bg-white rounded-xl shadow-2xl border border-gray-100 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div className="flex items-center gap-2">
            <Link2 className="w-4 h-4 text-purple-600" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Add Tag-Log Association</h3>
              <p className="text-xs text-gray-500 mt-0.5">Link a record in `tag_type` with a record in `logs`</p>
            </div>
          </div>
          <button
            id="close-add-assn-modal-btn"
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-black p-1 rounded-md transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {effectiveOffline && (
            <div id="add-assn-offline-notice" className="p-2.5 bg-amber-50 border border-amber-200 text-amber-900 text-xs rounded-lg flex items-center gap-2">
              <CloudOff className="w-4 h-4 text-amber-600 shrink-0" />
              <span><strong>Offline Mode:</strong> Association will be saved locally and pushed when connection is restored.</span>
            </div>
          )}

          {errorMsg && (
            <div id="add-assn-modal-error" className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Tag Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <Tag className="w-3.5 h-3.5 text-purple-600" />
              <span>Select Tag (tag_id FK) *</span>
            </label>
            <select
              id="assn-tag-select"
              required
              value={tagId}
              onChange={(e) => setTagId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:border-black transition-colors font-mono"
            >
              <option value="">Choose tag_type...</option>
              {tagTypes.map((t) => (
                <option key={t.id} value={t.id}>
                  #{t.id} - {t.name}
                </option>
              ))}
            </select>
            {tagTypes.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">No tags available. Add some in tag_type table first.</p>
            )}
          </div>

          {/* Log Selection */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>Select Log Entry (log_id FK) *</span>
            </label>
            <select
              id="assn-log-select"
              required
              value={logId}
              onChange={(e) => setLogId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 focus:outline-none focus:border-black transition-colors font-mono"
            >
              <option value="">Choose log entry...</option>
              {logs.map((l) => (
                <option key={l.id} value={l.id}>
                  #{l.id} - {l.logDate} {l.logDescription ? `(${l.logDescription.substring(0, 30)})` : ''}
                </option>
              ))}
            </select>
            {logs.length === 0 && (
              <p className="text-[11px] text-gray-400 mt-1">No logs available. Add records to logs table first.</p>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              id="cancel-add-assn-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-add-assn-btn"
              type="submit"
              disabled={isSubmitting || !tagId || !logId}
              className="px-4 py-2 bg-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition-colors shadow-xs disabled:opacity-50 flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>Linking...</span>
                </>
              ) : (
                <span>Create Association</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
