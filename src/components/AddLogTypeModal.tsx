import React, { useState } from 'react';
import { X, Plus, AlertCircle, Sparkles } from 'lucide-react';

interface AddLogTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (name: string) => Promise<{ success: boolean; error?: string }>;
  tableName?: string;
}

export const AddLogTypeModal: React.FC<AddLogTypeModalProps> = ({
  isOpen,
  onClose,
  onAdd,
  tableName = 'tag_type',
}) => {
  const [name, setName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isTag = tableName === 'tag_type';
  const isCategory = tableName === 'category_type';
  const quickPresets = isCategory
    ? ['Donation', 'Entertainment', 'Gift', 'Grocery', 'Healthcare', 'Home', 'Restaurant', 'Taxes', 'Travel', 'Utilities']
    : isTag
    ? ['discretionary', 'real estate']
    : ['Expenses', 'Income'];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Name cannot be empty.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const result = await onAdd(name.trim());
    setIsSubmitting(false);

    if (result.success) {
      setName('');
      onClose();
    } else {
      setErrorMsg(result.error || `Failed to add ${tableName}.`);
    }
  };

  return (
    <div
      id="add-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4"
    >
      <div
        id="add-modal-content"
        className="bg-white rounded-xl border border-gray-100 shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Add {isCategory ? 'Category Type' : isTag ? 'Tag Type' : 'Log Type'}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Insert a new unique lookup record into `{tableName}`</p>
          </div>
          <button
            id="close-add-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-black rounded hover:bg-gray-50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div id="modal-error-alert" className="p-3 bg-rose-50 border border-rose-100 rounded text-rose-700 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label htmlFor="log-type-name-input" className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Type Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="log-type-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isCategory ? "e.g. Housing or Utilities" : isTag ? "e.g. discretionary or real estate" : "e.g. Expenses or Income"}
              className="w-full px-3.5 py-2 bg-white border border-gray-200 rounded text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors font-mono"
              autoFocus
            />
            <p className="text-[11px] text-gray-400 mt-1.5 font-mono">
              Enforced by unique index in PostgreSQL.
            </p>
          </div>

          <div>
            <div className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-gray-400" />
              <span>Quick Presets</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {quickPresets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setName(preset)}
                  className="px-2.5 py-1 text-xs font-mono bg-gray-50 hover:bg-gray-100 text-gray-700 rounded border border-gray-100 transition-colors"
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
            <button
              id="cancel-add-btn"
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-black hover:bg-gray-50 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              id="submit-add-btn"
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="px-4 py-2 bg-black hover:bg-gray-800 text-white text-xs font-medium rounded shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span>Adding...</span>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  <span>Create Entry</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

