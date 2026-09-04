import React, { useState } from 'react';
import { Trash2, Edit2, Check, X, Plus } from 'lucide-react';

interface LookupItem {
  id: number;
  name: string;
  created_at?: string | null;
}

interface LookupTableProps {
  items: LookupItem[];
  tableName: string;
  isLoading: boolean;
  onUpdate: (id: number, newName: string) => Promise<boolean>;
  onDelete: (id: number) => Promise<boolean>;
  searchTerm: string;
  onOpenAdd: () => void;
}

export const LookupTable: React.FC<LookupTableProps> = ({
  items,
  tableName,
  isLoading,
  onUpdate,
  onDelete,
  searchTerm,
  onOpenAdd,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toString().includes(searchTerm)
  );

  const handleStartEdit = (item: LookupItem) => {
    setEditingId(item.id);
    setEditName(item.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) return;
    const success = await onUpdate(id, editName.trim());
    if (success) {
      setEditingId(null);
      setEditName('');
    }
  };

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (isLoading) {
    return (
      <div id="lookup-table-loading" className="py-20 flex flex-col items-center justify-center space-y-3">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
        <span className="text-xs text-gray-400 font-mono">Querying {tableName} records...</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div id="lookup-table-empty" className="py-16 text-center border border-dashed border-gray-200 rounded-lg">
        <p className="text-sm text-gray-500 font-normal">No records found in {tableName} table</p>
        <button
          type="button"
          onClick={onOpenAdd}
          className="mt-3 text-xs bg-black text-white px-3 py-1.5 rounded hover:bg-gray-800 inline-flex items-center gap-1.5 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add first entry</span>
        </button>
      </div>
    );
  }

  return (
    <div id="lookup-table-container" className="border border-gray-200 rounded overflow-hidden bg-white shadow-2xs">
      <table id="lookup-data-table" className="w-full text-left text-xs border-collapse">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/75 text-gray-400 font-medium font-mono uppercase tracking-wider text-[10px]">
            <th className="p-3 w-16 text-center">id</th>
            <th className="p-3">name</th>
            <th className="p-3 text-right w-24">actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filteredItems.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50/50 group transition-colors">
              <td className="p-3 text-center text-gray-400 font-mono text-[11px]">{item.id}</td>
              <td className="p-3 font-medium text-gray-900">
                {editingId === item.id ? (
                  <div className="flex items-center gap-2 max-w-sm">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(item.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-black font-medium"
                      autoFocus
                    />
                  </div>
                ) : (
                  <span className="text-xs text-gray-800">{item.name}</span>
                )}
              </td>
              <td className="p-3 text-right">
                {editingId === item.id ? (
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => handleSaveEdit(item.id)}
                      className="p-1 text-emerald-600 hover:text-emerald-800 rounded hover:bg-emerald-50"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-end gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      type="button"
                      onClick={() => handleStartEdit(item)}
                      className="p-1 text-gray-400 hover:text-gray-900 rounded hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === item.id}
                      onClick={() => handleDelete(item.id)}
                      className="p-1 text-gray-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
