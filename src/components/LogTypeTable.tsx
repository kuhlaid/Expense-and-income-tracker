import React, { useState } from 'react';
import { LogTypeItem } from '../types.ts';
import { Edit2, Trash2, Check, X, Copy, CheckCheck, Plus, CloudOff } from 'lucide-react';
import { useOffline } from '../context/OfflineContext.tsx';

interface LogTypeTableProps {
  logTypes: LogTypeItem[];
  isLoading: boolean;
  onUpdate: (id: number, newName: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  searchTerm: string;
  onOpenAdd?: () => void;
}

export const LogTypeTable: React.FC<LogTypeTableProps> = ({
  logTypes,
  isLoading,
  onUpdate,
  onDelete,
  searchTerm,
  onOpenAdd,
}) => {
  const { isItemPendingSync } = useOffline();
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const filtered = logTypes.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toString().includes(searchTerm)
  );

  const startEdit = (item: LogTypeItem) => {
    setEditingId(item.id);
    setEditName(item.name);
    setErrorMsg(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName('');
    setErrorMsg(null);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      setErrorMsg('Name cannot be empty.');
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    const success = await onUpdate(id, editName.trim());
    setIsSubmitting(false);
    if (success) {
      setEditingId(null);
      setEditName('');
    }
  };

  const handleDelete = async (id: number) => {
    setIsSubmitting(true);
    const success = await onDelete(id);
    setIsSubmitting(false);
    if (success) {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div id="log-type-table-container" className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      {errorMsg && (
        <div id="table-inline-error" className="bg-rose-50 border-b border-rose-100 px-6 py-2.5 text-xs text-rose-700">
          {errorMsg}
        </div>
      )}

      <div className="overflow-x-auto">
        <table id="log-type-data-table" className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100">
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider w-24">ID</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Type Name</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Constraints</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Created</th>
              <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider text-right w-32">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={5} className="py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 font-mono">Querying PostgreSQL Cloud SQL...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-14 text-center text-gray-400">
                  {searchTerm ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No records matching "{searchTerm}"</p>
                      <p className="text-xs text-gray-400 mt-1">Try clearing your search query</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No lookup records found in `log_type`</p>
                      <p className="text-xs text-gray-400 mt-1">Use the button below or "+ Add Log Type" to insert records</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isEditing = editingId === item.id;
                const isDeleting = deletingId === item.id;

                return (
                  <tr
                    key={item.id}
                    id={`log-type-row-${item.id}`}
                    className={`group transition-colors ${
                      isEditing
                        ? 'bg-amber-50/40'
                        : isDeleting
                        ? 'bg-rose-50/40'
                        : 'hover:bg-gray-50/50'
                    }`}
                  >
                    {/* ID */}
                    <td className="px-6 py-4 text-sm font-mono text-black font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>{item.id}</span>
                        {(item.id < 0 || isItemPendingSync('log_type', item.id)) && (
                          <span
                            title="Modified/created offline (pending sync)"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-50 text-amber-800 border border-amber-200/80"
                          >
                            <CloudOff className="w-2.5 h-2.5 text-amber-600" />
                            Offline
                          </span>
                        )}
                        <button
                          id={`copy-id-btn-${item.id}`}
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

                    {/* Name */}
                    <td className="px-6 py-4 font-mono text-sm">
                      {isEditing ? (
                        <div className="flex items-center gap-2 max-w-xs">
                          <input
                            id={`edit-name-input-${item.id}`}
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(item.id);
                              if (e.key === 'Escape') cancelEdit();
                            }}
                            autoFocus
                            className="w-full px-2.5 py-1 text-sm border border-gray-300 rounded bg-white focus:outline-none focus:border-black font-mono"
                          />
                        </div>
                      ) : (
                        <span className="text-black font-medium">{item.name}</span>
                      )}
                    </td>

                    {/* Constraints */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded uppercase">
                          PK
                        </span>
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-[10px] font-bold rounded uppercase">
                          AUTO_INC
                        </span>
                        <span className="px-2 py-0.5 bg-orange-50 text-orange-600 text-[10px] font-bold rounded uppercase">
                          Unique
                        </span>
                      </div>
                    </td>

                    {/* Date */}
                    <td className="px-6 py-4 text-xs font-mono text-gray-400">
                      {formatDate(item.created_at)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`save-edit-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleSaveEdit(item.id)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-colors disabled:opacity-50"
                            title="Save changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            id={`cancel-edit-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={cancelEdit}
                            className="p-1 text-gray-400 hover:text-black hover:bg-gray-100 rounded transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : isDeleting ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="text-[11px] text-rose-600 font-medium">Delete?</span>
                          <button
                            id={`confirm-delete-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white text-[11px] font-medium rounded hover:bg-rose-700 disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            id={`cancel-delete-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`edit-btn-${item.id}`}
                            type="button"
                            onClick={() => startEdit(item)}
                            className="p-1 text-gray-400 hover:text-black rounded transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            id={`delete-btn-${item.id}`}
                            type="button"
                            onClick={() => setDeletingId(item.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete"
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

      {/* Bottom bar with Add Action & Total count */}
      <div className="p-4 border-t border-gray-50 bg-gray-50/30 flex items-center justify-between">
        <div className="text-xs text-gray-400 font-mono">
          Total: <span className="text-gray-900 font-medium">{filtered.length}</span> rows
        </div>
        {onOpenAdd && (
          <button
            type="button"
            onClick={onOpenAdd}
            className="text-xs font-medium text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add new row</span>
          </button>
        )}
      </div>
    </div>
  );
};

