import React, { useState, useRef, useMemo } from 'react';
import {
  X,
  UploadCloud,
  FileSpreadsheet,
  FileText,
  Sparkles,
  Database,
  Layers,
  Download,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';
import { CSV_SAMPLE_TEMPLATE, PRESET_220_RECORDS_CSV } from '../data/defaultCsvData.ts';

interface CsvImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTable?: 'logs' | 'starter_logs';
  onImportComplete?: (count: number, table: string) => void;
  onNotice?: (type: 'success' | 'error', message: string) => void;
}

interface ParsedRow {
  logDate?: string;
  logAmount?: string;
  logCategory?: number;
  reconciled?: boolean;
  logDescription?: string;
  tagIds?: number[];
  _raw: Record<string, string>;
  _isValid: boolean;
  _error?: string;
}

// RFC 4180 compliant CSV Parser handling quotes and newlines within fields
function parseCsvContent(text: string): { headers: string[]; rows: string[][] } {
  const cleanText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else if (char === '"') {
        inQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if (char === '\n') {
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f.length > 0)) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      rows.push(currentRow);
    }
  }

  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0].map((h) => h.toLowerCase().trim());
  return { headers, rows: rows.slice(1) };
}

// Normalize date format from M/D/YYYY, MM/DD/YYYY, or YYYY-MM-DD to YYYY-MM-DD
function normalizeDate(raw: string): string {
  if (!raw) return new Date().toISOString().split('T')[0];
  const trimmed = raw.trim();

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(trimmed)) {
    const parts = trimmed.split('-');
    const y = parts[0];
    const m = parts[1].padStart(2, '0');
    const d = parts[2].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  // M/D/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    const parts = trimmed.split('/');
    const m = parts[0].padStart(2, '0');
    const d = parts[1].padStart(2, '0');
    const y = parts[2];
    return `${y}-${m}-${d}`;
  }

  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }

  return trimmed;
}

// Normalize amount by stripping currency symbols and commas
function normalizeAmount(raw: string): string | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const cleaned = raw.replace(/[$,\s]/g, '').trim();
  if (cleaned === '' || isNaN(Number(cleaned))) return undefined;
  return cleaned;
}

// Normalize boolean reconciled flag
function normalizeReconciled(raw: string, defaultVal: boolean = true): boolean {
  if (!raw) return defaultVal;
  const lower = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 't', 'reconciled'].includes(lower)) return true;
  if (['false', '0', 'no', 'n', 'f', 'unreconciled'].includes(lower)) return false;
  return defaultVal;
}

export const CsvImportModal: React.FC<CsvImportModalProps> = ({
  isOpen,
  onClose,
  defaultTable = 'logs',
  onImportComplete,
  onNotice,
}) => {
  const { authFetch } = useAuth();

  const [targetTable, setTargetTable] = useState<'logs' | 'starter_logs'>(defaultTable);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [inputTab, setInputTab] = useState<'upload' | 'paste' | 'preset'>('upload');
  const [csvText, setCsvText] = useState<string>('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTargetTable(defaultTable);
    }
  }, [isOpen, defaultTable]);

  // Parse raw text into structured rows
  const parsedData = useMemo(() => {
    if (!csvText.trim()) return { headers: [], rows: [], items: [] };

    const { headers, rows } = parseCsvContent(csvText);
    if (headers.length === 0) return { headers: [], rows: [], items: [] };

    const dateIdx = headers.findIndex((h) => h.includes('date'));
    const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('price') || h.includes('cost'));
    const categoryIdx = headers.findIndex((h) => h.includes('category') || h === 'log_category' || h === 'cat_id');
    const reconciledIdx = headers.findIndex((h) => h.includes('reconcil') || h === 'status');
    const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('memo') || h.includes('note') || h === 'name');
    const tagsIdx = headers.findIndex((h) => h.includes('tag'));

    const items: ParsedRow[] = rows.map((row) => {
      const rawMap: Record<string, string> = {};
      headers.forEach((h, idx) => {
        rawMap[h] = row[idx] || '';
      });

      const rawDate = dateIdx !== -1 ? row[dateIdx] : undefined;
      const rawAmount = amountIdx !== -1 ? row[amountIdx] : undefined;
      const rawCat = categoryIdx !== -1 ? row[categoryIdx] : undefined;
      const rawRec = reconciledIdx !== -1 ? row[reconciledIdx] : undefined;
      const rawDesc = descIdx !== -1 ? row[descIdx] : undefined;
      const rawTags = tagsIdx !== -1 ? row[tagsIdx] : undefined;

      const logDate = rawDate ? normalizeDate(rawDate) : new Date().toISOString().split('T')[0];
      const logAmount = rawAmount ? normalizeAmount(rawAmount) : undefined;
      const logCategory = rawCat && !isNaN(Number(rawCat)) ? Number(rawCat) : undefined;
      const reconciled = rawRec !== undefined ? normalizeReconciled(rawRec, targetTable === 'logs') : targetTable === 'logs';
      const logDescription = rawDesc ? rawDesc.trim() : undefined;

      let tagIds: number[] | undefined;
      if (rawTags) {
        const parts = rawTags.split(/[,;]/).map((p) => Number(p.trim())).filter((n) => !isNaN(n) && n > 0);
        if (parts.length > 0) tagIds = parts;
      }

      const isValid = Boolean(logDate || logDescription || logAmount);

      return {
        logDate,
        logAmount,
        logCategory,
        reconciled,
        logDescription,
        tagIds,
        _raw: rawMap,
        _isValid: isValid,
      };
    });

    return { headers, rows, items };
  }, [csvText, targetTable]);

  const handleFileSelect = (file: File) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setCsvText(content || '');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleLoadPreset = () => {
    setCsvText(PRESET_220_RECORDS_CSV);
    setFileName('220_default_records.csv');
    if (onNotice) {
      onNotice('success', 'Loaded 220 preset records into CSV parser.');
    }
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_SAMPLE_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${targetTable}_sample_template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClear = () => {
    setCsvText('');
    setFileName(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const executeImport = async () => {
    if (parsedData.items.length === 0) {
      if (onNotice) onNotice('error', 'No valid rows detected to import.');
      return;
    }

    setIsImporting(true);
    try {
      const endpoint = targetTable === 'logs' ? '/api/logs/import-csv' : '/api/starter-logs/import-csv';
      const res = await authFetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: parsedData.items,
          replaceAll: importMode === 'replace',
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to import CSV data');
      }

      if (onNotice) {
        onNotice(
          'success',
          `Successfully imported ${result.count || parsedData.items.length} records into ${targetTable} table!`
        );
      }

      if (onImportComplete) {
        onImportComplete(result.count || parsedData.items.length, targetTable);
      }
      onClose();
    } catch (err: any) {
      console.error('CSV Import Error:', err);
      if (onNotice) {
        onNotice('error', err.message || 'Error occurred during CSV import.');
      }
    } finally {
      setIsImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="csv-import-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="csv-import-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 id="csv-import-title" className="text-base font-bold text-gray-900 flex items-center gap-2">
                Import Records from CSV
              </h2>
              <p className="text-xs text-gray-500">
                Upload or paste CSV transactions into your Cloud SQL database.
              </p>
            </div>
          </div>
          <button
            id="close-csv-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Target Table & Mode Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Table */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-gray-400" />
                Target Database Table
              </label>
              <select
                id="csv-target-table-select"
                value={targetTable}
                onChange={(e) => setTargetTable(e.target.value as 'logs' | 'starter_logs')}
                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:border-black focus:ring-1 focus:ring-black"
              >
                <option value="logs">logs (Active Day-to-Day Expenses & Income)</option>
                <option value="starter_logs">starter_logs (Templates for Recurring Logs)</option>
              </select>
            </div>

            {/* Import Mode */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-gray-400" />
                Import Action
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('append')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all text-center ${
                    importMode === 'append'
                      ? 'bg-black text-white border-black shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  Append New Rows
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('replace')}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-all text-center ${
                    importMode === 'replace'
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-gray-700 border-gray-200 hover:bg-rose-50 hover:text-rose-700'
                  }`}
                >
                  Replace All Existing
                </button>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-gray-200">
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setInputTab('upload')}
                className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  inputTab === 'upload'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <UploadCloud className="w-3.5 h-3.5" />
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setInputTab('paste')}
                className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  inputTab === 'paste'
                    ? 'border-black text-black'
                    : 'border-transparent text-gray-500 hover:text-gray-800'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Paste Raw CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  setInputTab('preset');
                  handleLoadPreset();
                }}
                className={`pb-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                  inputTab === 'preset'
                    ? 'border-amber-600 text-amber-900 font-semibold'
                    : 'border-transparent text-gray-500 hover:text-amber-700'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Load 220 Default Records
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="pb-2 text-xs text-emerald-700 hover:text-emerald-900 flex items-center gap-1"
            >
              <Download className="w-3 h-3" />
              Download Template CSV
            </button>
          </div>

          {/* Tab Content */}
          {inputTab === 'upload' && (
            <div className="space-y-3">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-black bg-gray-50'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50/50'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelect(e.target.files[0]);
                    }
                  }}
                />
                <UploadCloud className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                {fileName ? (
                  <div>
                    <p className="text-xs font-semibold text-gray-900">{fileName}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Click or drag a new file to replace</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-gray-700">
                      Drop your CSV file here, or <span className="text-black font-semibold underline">browse</span>
                    </p>
                    <p className="text-xs text-gray-400">Supports standard comma-separated .csv, .tsv, or .txt</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {inputTab === 'paste' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-gray-600">
                  Paste raw CSV text (including header row):
                </label>
                {csvText && (
                  <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-rose-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Clear Text
                  </button>
                )}
              </div>
              <textarea
                id="csv-text-paste-area"
                rows={6}
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="log_date,log_amount,log_category,reconciled,log_description&#10;2026-08-27,1218.93,14,TRUE,taxes on sunset cottage"
                className="w-full p-3 font-mono text-xs text-gray-800 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-black focus:bg-white transition-colors"
              />
            </div>
          )}

          {inputTab === 'preset' && (
            <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-900 font-semibold text-xs">
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>220 Default Transaction Records Loaded</span>
                </div>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                  220 Rows
                </span>
              </div>
              <p className="text-xs text-amber-800/80 leading-relaxed">
                This preset dataset contains your 220 expense & income records spanning 2026. You can import them directly to your production Cloud SQL database in one click.
              </p>
            </div>
          )}

          {/* Parsed Preview Table */}
          {parsedData.items.length > 0 && (
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Data Preview
                  </span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-gray-100 text-gray-700">
                    {parsedData.items.length} rows detected
                  </span>
                </div>
                <div className="text-xs text-gray-400 font-mono">
                  Showing first {Math.min(parsedData.items.length, 5)} rows
                </div>
              </div>

              <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-2xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 font-medium font-mono">
                      <th className="px-3 py-2 w-10">#</th>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Description</th>
                      <th className="px-3 py-2">Amount</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Reconciled</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-mono">
                    {parsedData.items.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50">
                        <td className="px-3 py-2 text-gray-400">{idx + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-900">{row.logDate || '—'}</td>
                        <td className="px-3 py-2 text-gray-700 max-w-[240px] truncate font-sans" title={row.logDescription || ''}>
                          {row.logDescription || '—'}
                        </td>
                        <td className="px-3 py-2 font-bold text-gray-900">
                          {row.logAmount ? `$${Number(row.logAmount).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-gray-600">{row.logCategory ?? '—'}</td>
                        <td className="px-3 py-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              row.reconciled ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {row.reconciled ? 'TRUE' : 'FALSE'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
          <button
            id="cancel-csv-import-btn"
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>

          <div className="flex items-center gap-3">
            {csvText && (
              <button
                type="button"
                onClick={handleClear}
                className="px-3 py-2 text-xs text-gray-500 hover:text-rose-600 font-medium transition-colors"
              >
                Reset
              </button>
            )}

            <button
              id="confirm-csv-import-btn"
              type="button"
              disabled={isImporting || parsedData.items.length === 0}
              onClick={executeImport}
              className="px-5 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-40 font-medium text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              {isImporting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Importing Records...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>
                    Import {parsedData.items.length > 0 ? `${parsedData.items.length} ` : ''}Records
                  </span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
