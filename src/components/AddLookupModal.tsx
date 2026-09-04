import React, { useState } from 'react';
import { X } from 'lucide-react';

interface AddLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<{ success: boolean; error?: string }>;
  tableName: string;
}

export const AddLookupModal: React.FC<AddLookupModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  tableName,
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMessage('Name is required.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const res = await onAdd(name.trim());
    setIsSubmitting(false);

    if (res.success) {
      setName('');
      onClose();
    } else {
      setErrorMessage(res.error || 'Failed to add entry.');
    }
  };

  return (
    <div
      id="add-lookup-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="add-lookup-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-900">
            Add {tableName === 'category_type' ? 'Category' : tableName === 'tag_type' ? 'Tag' : tableName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3 text-xs bg-rose-50 text-rose-700 border border-rose-200 rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Groceries, Utilities, Travel..."
              autoFocus
              className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-1.5 text-xs bg-black text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 font-medium transition-colors"
            >
              {isSubmitting ? 'Saving...' : 'Create Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
