import React, { useState } from 'react';
import { TagLogAssnItem } from '../types.ts';
import { Trash2, Copy, CheckCheck, Plus, Calendar, Tag, FileText, ArrowRight, CloudOff } from 'lucide-react';
import { useOffline } from '../context/OfflineContext.tsx';

interface TagLogAssnTableProps {
  associations: TagLogAssnItem[];
  isLoading: boolean;
  onDelete: (id: number) => Promise<boolean>;
  searchTerm: string;
  onOpenAdd?: () => void;
}

export const TagLogAssnTable: React.FC<TagLogAssnTableProps> = ({
  associations,
  isLoading,
  onDelete,
  searchTerm,
  onOpenAdd,
}) => {
  const { isItemPendingSync } = useOffline();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const filtered = associations.filter((item) => {
    const term = searchTerm.toLowerCase();
    return (
      (item.tagName && item.tagName.toLowerCase().includes(term)) ||
      (item.logDescription && item.logDescription.toLowerCase().includes(term)) ||
      (item.logDate && item.logDate.toLowerCase().includes(term)) ||
      item.id.toString().includes(term) ||
      item.tagId.toString().includes(term) ||
      item.logId.toString().includes(term)
    );
  });

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

  return (
    <div id="assn-table-container" className="bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <table id="assn-data-table" className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              <th className="px-5 py-4 w-20">ID</th>
              <th className="px-5 py-4">Tag Reference (tag_id)</th>
              <th className="px-5 py-4 w-12 text-center"></th>
              <th className="px-5 py-4">Log Reference (log_id)</th>
              <th className="px-5 py-4">Created At</th>
              <th className="px-5 py-4 text-right w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-sm">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="py-16 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2.5">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-black rounded-full animate-spin"></div>
                    <span className="text-xs text-gray-500 font-mono">Querying tag_log_assn table...</span>
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-gray-400">
                  {searchTerm ? (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No associations matching "{searchTerm}"</p>
                      <p className="text-xs text-gray-400 mt-1">Try clearing your search query</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-sm font-medium text-gray-700">No records found in `tag_log_assn` association table</p>
                      <p className="text-xs text-gray-400 mt-1">Click "+ Add Association" to link a tag with a log record</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isDeleting = deletingId === item.id;

                return (
                  <tr
                    key={item.id}
                    id={`assn-row-${item.id}`}
                    className={`group transition-colors ${
                      isDeleting ? 'bg-rose-50/40' : 'hover:bg-gray-50/50'
                    }`}
                  >
                    {/* ID */}
                    <td className="px-5 py-3.5 text-xs font-mono text-gray-900 font-medium">
                      <div className="flex items-center gap-1.5">
                        <span>#{item.id}</span>
                        {(item.id < 0 || isItemPendingSync('tag_log_assn', item.id)) && (
                          <span
                            title="Created/modified offline (pending sync)"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-sans font-medium bg-amber-50 text-amber-800 border border-amber-200/80"
                          >
                            <CloudOff className="w-2.5 h-2.5 text-amber-600" />
                            Offline
                          </span>
                        )}
                        <button
                          id={`copy-assn-id-btn-${item.id}`}
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

                    {/* Tag reference */}
                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-gray-500 font-semibold">tag_id: #{item.tagId}</span>
                        {item.tagName ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 font-medium border border-purple-100">
                            <Tag className="w-3 h-3" />
                            {item.tagName}
                          </span>
                        ) : (
                          <span className="text-gray-400 italic text-xs">(tag #{item.tagId})</span>
                        )}
                      </div>
                    </td>

                    {/* Arrow */}
                    <td className="px-2 py-3.5 text-center text-gray-300">
                      <ArrowRight className="w-4 h-4 mx-auto text-gray-400" />
                    </td>

                    {/* Log reference */}
                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-gray-500 font-semibold">log_id: #{item.logId}</span>
                          {item.logDate && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-gray-600 font-mono">
                              <Calendar className="w-3 h-3 text-gray-400" />
                              {item.logDate}
                            </span>
                          )}
                        </div>
                        {item.logDescription && (
                          <span className="text-gray-900 font-medium text-xs truncate max-w-xs">
                            {item.logDescription}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Created At */}
                    <td className="px-5 py-3.5 text-xs text-gray-500 font-mono">
                      {item.createdAt ? new Date(item.createdAt).toLocaleString() : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      {isDeleting ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            id={`confirm-delete-assn-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => handleDelete(item.id)}
                            className="px-2 py-0.5 bg-rose-600 text-white text-[11px] font-medium rounded hover:bg-rose-700 disabled:opacity-50"
                          >
                            Yes
                          </button>
                          <button
                            id={`cancel-delete-assn-btn-${item.id}`}
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => setDeletingId(null)}
                            className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-medium rounded hover:bg-gray-200"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end opacity-60 group-hover:opacity-100 transition-opacity">
                          <button
                            id={`delete-assn-btn-${item.id}`}
                            type="button"
                            onClick={() => setDeletingId(item.id)}
                            className="p-1 text-gray-400 hover:text-rose-600 rounded transition-colors"
                            title="Delete association"
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
          Total: <span className="text-gray-900 font-medium">{filtered.length}</span> associations
        </div>
        {onOpenAdd && (
          <button
            type="button"
            onClick={onOpenAdd}
            className="text-xs font-medium text-gray-500 hover:text-black flex items-center gap-1 transition-colors"
          >
            <Plus className="w-3 h-3" />
            <span>Add association</span>
          </button>
        )}
      </div>
    </div>
  );
};
