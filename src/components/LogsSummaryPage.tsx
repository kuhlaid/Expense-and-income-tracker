import React, { useState, useMemo, useEffect } from 'react';
import {
  LogItem,
  CategoryTypeItem,
  TagTypeItem,
} from '../types.ts';
import {
  Filter,
  RotateCcw,
  Download,
  Calendar,
  Folder,
  Tag,
  ArrowUpDown,
  Table as TableIcon,
  Layers,
  ChevronRight,
  X,
  Search,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Info,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface LogsSummaryPageProps {
  logs: LogItem[];
  isLoading: boolean;
  onRefresh?: () => void;
  onOpenAddLog?: () => void;
  onNavigateToLogsTable?: () => void;
}

export const LogsSummaryPage: React.FC<LogsSummaryPageProps> = ({
  logs,
  isLoading,
  onRefresh,
  onOpenAddLog: _onOpenAddLog,
  onNavigateToLogsTable,
}) => {
  const { authFetch } = useAuth();

  // Reference lists for Categories and Tags
  const [categoryTypes, setCategoryTypes] = useState<CategoryTypeItem[]>([]);
  const [tagTypes, setTagTypes] = useState<TagTypeItem[]>([]);

  // Filter States
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedTagId, setSelectedTagId] = useState<string>('all');
  const [reconciledFilter, setReconciledFilter] = useState<'all' | 'reconciled' | 'unreconciled'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Table Configuration States
  const [pivotAxis, setPivotAxis] = useState<'category_rows' | 'tag_rows'>('category_rows');
  const [hideEmptyCells, setHideEmptyCells] = useState<boolean>(false);
  const [heatMapIntensity, setHeatMapIntensity] = useState<boolean>(true);

  // Drilldown Modal State
  const [drilldownCell, setDrilldownCell] = useState<{
    rowName: string;
    colName: string;
    logs: LogItem[];
    sum: number;
  } | null>(null);

  // Load category and tag types
  useEffect(() => {
    authFetch('/api/category-types')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCategoryTypes(data);
      })
      .catch(() => {});

    authFetch('/api/tag-types')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTagTypes(data);
      })
      .catch(() => {});
  }, []);

  // Extract distinct available years from all logs
  const availableYears = useMemo(() => {
    const yearsSet = new Set<string>();
    logs.forEach((log) => {
      if (log.logDate) {
        const year = log.logDate.slice(0, 4);
        if (/^\d{4}$/.test(year)) {
          yearsSet.add(year);
        }
      }
    });
    return Array.from(yearsSet).sort((a, b) => b.localeCompare(a));
  }, [logs]);

  // Filtered dataset
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Filter by Year
      if (selectedYear !== 'all') {
        if (!log.logDate || !log.logDate.startsWith(selectedYear)) {
          return false;
        }
      }

      // Filter by Category
      if (selectedCategoryId !== 'all') {
        if (selectedCategoryId === 'uncategorized') {
          if (log.logCategory !== null && log.logCategory !== undefined) return false;
        } else {
          if (String(log.logCategory) !== selectedCategoryId) return false;
        }
      }

      // Filter by Tag Type
      if (selectedTagId !== 'all') {
        if (selectedTagId === 'untagged') {
          if (log.tags && log.tags.length > 0) return false;
        } else {
          const targetTagId = Number(selectedTagId);
          if (!log.tags || !log.tags.some((t) => t.tagId === targetTagId)) return false;
        }
      }

      // Filter by Reconciled status
      if (reconciledFilter === 'reconciled') {
        if (log.reconciled !== true) return false;
      } else if (reconciledFilter === 'unreconciled') {
        if (log.reconciled === true) return false;
      }

      // Filter by Search Term
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches =
          (log.logDescription && log.logDescription.toLowerCase().includes(term)) ||
          (log.categoryName && log.categoryName.toLowerCase().includes(term)) ||
          (log.logAmount && log.logAmount.includes(term)) ||
          (log.tags && log.tags.some((t) => t.tagName.toLowerCase().includes(term)));
        if (!matches) return false;
      }

      return true;
    });
  }, [logs, selectedYear, selectedCategoryId, selectedTagId, reconciledFilter, searchTerm]);

  // High-level Summary Metrics
  // Assumption: positive log amounts are income and negative amounts are expenses
  const summaryMetrics = useMemo(() => {
    let totalSum = 0;
    let positiveSum = 0;
    let negativeSum = 0;
    const catSet = new Set<string>();
    const tagSet = new Set<string>();

    filteredLogs.forEach((log) => {
      const amt = parseFloat(log.logAmount || '0') || 0;
      totalSum += amt;
      if (amt >= 0) positiveSum += amt;
      else negativeSum += amt;

      if (log.categoryName) catSet.add(log.categoryName);
      else catSet.add('Uncategorized');

      if (log.tags && log.tags.length > 0) {
        log.tags.forEach((t) => tagSet.add(t.tagName));
      } else {
        tagSet.add('Untagged');
      }
    });

    const count = filteredLogs.length;
    const avg = count > 0 ? totalSum / count : 0;

    return {
      totalSum,
      positiveSum,
      negativeSum,
      count,
      categoryCount: catSet.size,
      tagCount: tagSet.size,
      average: avg,
    };
  }, [filteredLogs]);

  // Pivot Table Matrix Construction
  const pivotData = useMemo(() => {
    const categoryMap = new Map<string, { id: string; name: string }>();
    categoryTypes.forEach((c) => {
      categoryMap.set(String(c.id), { id: String(c.id), name: c.name });
    });

    const tagMap = new Map<string, { id: string; name: string }>();
    tagTypes.forEach((t) => {
      tagMap.set(String(t.id), { id: String(t.id), name: t.name });
    });

    const usedCatIds = new Set<string>();
    const usedTagIds = new Set<string>();

    filteredLogs.forEach((log) => {
      const catKey = log.logCategory ? String(log.logCategory) : 'uncategorized';
      usedCatIds.add(catKey);
      if (!categoryMap.has(catKey) && catKey !== 'uncategorized') {
        categoryMap.set(catKey, { id: catKey, name: log.categoryName || `Category ${catKey}` });
      }

      if (log.tags && log.tags.length > 0) {
        log.tags.forEach((t) => {
          const tKey = String(t.tagId);
          usedTagIds.add(tKey);
          if (!tagMap.has(tKey)) {
            tagMap.set(tKey, { id: tKey, name: t.tagName });
          }
        });
      } else {
        usedTagIds.add('untagged');
      }
    });

    // Build ordered list of categories
    const categoryList: { id: string; name: string }[] = [];
    categoryMap.forEach((val) => {
      if (selectedCategoryId === 'all' || selectedCategoryId === val.id) {
        if (!hideEmptyCells || usedCatIds.has(val.id)) {
          categoryList.push(val);
        }
      }
    });
    if (
      (selectedCategoryId === 'all' && usedCatIds.has('uncategorized')) ||
      selectedCategoryId === 'uncategorized'
    ) {
      categoryList.push({ id: 'uncategorized', name: 'Uncategorized' });
    }
    categoryList.sort((a, b) => a.name.localeCompare(b.name));

    // Build ordered list of tags
    const tagList: { id: string; name: string }[] = [];
    tagMap.forEach((val) => {
      if (selectedTagId === 'all' || selectedTagId === val.id) {
        if (!hideEmptyCells || usedTagIds.has(val.id)) {
          tagList.push(val);
        }
      }
    });
    if (
      (selectedTagId === 'all' && usedTagIds.has('untagged')) ||
      selectedTagId === 'untagged'
    ) {
      tagList.push({ id: 'untagged', name: 'Untagged' });
    }
    tagList.sort((a, b) => a.name.localeCompare(b.name));

    // Determine Rows and Columns based on pivotAxis
    const isCatRows = pivotAxis === 'category_rows';
    const rows = isCatRows ? categoryList : tagList;
    const cols = isCatRows ? tagList : categoryList;

    const matrix: Record<string, Record<string, { sum: number; count: number; logs: LogItem[] }>> = {};
    const rowLogsMap: Record<string, Map<number, LogItem>> = {};
    const colLogsMap: Record<string, Map<number, LogItem>> = {};

    rows.forEach((r) => {
      matrix[r.id] = {};
      rowLogsMap[r.id] = new Map();
      cols.forEach((c) => {
        matrix[r.id][c.id] = { sum: 0, count: 0, logs: [] };
      });
    });

    cols.forEach((c) => {
      colLogsMap[c.id] = new Map();
    });

    let maxCellAbsAmount = 0;

    filteredLogs.forEach((log) => {
      const amt = parseFloat(log.logAmount || '0') || 0;
      const catKey = log.logCategory ? String(log.logCategory) : 'uncategorized';

      const tagKeys =
        log.tags && log.tags.length > 0
          ? log.tags.map((t) => String(t.tagId))
          : ['untagged'];

      if (isCatRows) {
        const rowKey = catKey;
        if (matrix[rowKey]) {
          rowLogsMap[rowKey]?.set(log.id, log);

          tagKeys.forEach((tKey) => {
            const colKey = tKey;
            if (matrix[rowKey][colKey]) {
              matrix[rowKey][colKey].sum += amt;
              matrix[rowKey][colKey].count += 1;
              matrix[rowKey][colKey].logs.push(log);
              colLogsMap[colKey]?.set(log.id, log);

              const absVal = Math.abs(matrix[rowKey][colKey].sum);
              if (absVal > maxCellAbsAmount) maxCellAbsAmount = absVal;
            }
          });
        }
      } else {
        const colKey = catKey;
        if (colLogsMap[colKey]) {
          colLogsMap[colKey].set(log.id, log);
        }

        tagKeys.forEach((tKey) => {
          const rowKey = tKey;
          if (matrix[rowKey]) {
            rowLogsMap[rowKey]?.set(log.id, log);

            if (matrix[rowKey][colKey]) {
              matrix[rowKey][colKey].sum += amt;
              matrix[rowKey][colKey].count += 1;
              matrix[rowKey][colKey].logs.push(log);

              const absVal = Math.abs(matrix[rowKey][colKey].sum);
              if (absVal > maxCellAbsAmount) maxCellAbsAmount = absVal;
            }
          }
        });
      }
    });

    // Calculate Row Totals
    const rowTotals: Record<string, { sum: number; count: number; logs: LogItem[] }> = {};
    rows.forEach((r) => {
      let rSum = 0;
      const uniqueLogs = Array.from(rowLogsMap[r.id]?.values() || []);
      uniqueLogs.forEach((l) => {
        rSum += parseFloat(l.logAmount || '0') || 0;
      });
      rowTotals[r.id] = { sum: rSum, count: uniqueLogs.length, logs: uniqueLogs };
    });

    // Calculate Column Totals
    const colTotals: Record<string, { sum: number; count: number; logs: LogItem[] }> = {};
    cols.forEach((c) => {
      let cSum = 0;
      const uniqueLogs = Array.from(colLogsMap[c.id]?.values() || []);
      uniqueLogs.forEach((l) => {
        cSum += parseFloat(l.logAmount || '0') || 0;
      });
      colTotals[c.id] = { sum: cSum, count: uniqueLogs.length, logs: uniqueLogs };
    });

    const grandTotal = summaryMetrics.totalSum;
    const grandCount = summaryMetrics.count;

    return {
      rows,
      cols,
      matrix,
      rowTotals,
      colTotals,
      grandTotal,
      grandCount,
      maxCellAbsAmount,
      isCatRows,
    };
  }, [
    filteredLogs,
    categoryTypes,
    tagTypes,
    selectedCategoryId,
    selectedTagId,
    pivotAxis,
    hideEmptyCells,
    summaryMetrics.totalSum,
    summaryMetrics.count,
  ]);

  const formatCurrency = (val: number, showZeroDash: boolean = false) => {
    if (val === 0 && showZeroDash) return '—';
    const isNegative = val < 0;
    const formatted = Math.abs(val).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return isNegative ? `-$${formatted}` : `$${formatted}`;
  };

  const handleResetFilters = () => {
    setSelectedYear('all');
    setSelectedCategoryId('all');
    setSelectedTagId('all');
    setReconciledFilter('all');
    setSearchTerm('');
  };

  const hasActiveFilters =
    selectedYear !== 'all' ||
    selectedCategoryId !== 'all' ||
    selectedTagId !== 'all' ||
    reconciledFilter !== 'all' ||
    searchTerm.trim() !== '';

  const handleExportCsv = () => {
    const { rows, cols, matrix, rowTotals, colTotals, grandTotal, isCatRows } = pivotData;
    const rowHeaderLabel = isCatRows ? 'Category' : 'Tag Type';

    const headers = [rowHeaderLabel, ...cols.map((c) => `"${c.name}"`), 'Row Total'];
    const csvLines = [headers.join(',')];

    rows.forEach((r) => {
      const lineValues = [
        `"${r.name}"`,
        ...cols.map((c) => {
          const cell = matrix[r.id]?.[c.id];
          return (cell ? cell.sum : 0).toFixed(2);
        }),
        rowTotals[r.id]?.sum.toFixed(2) || '0.00',
      ];
      csvLines.push(lineValues.join(','));
    });

    const totalLine = [
      '"Total"',
      ...cols.map((c) => (colTotals[c.id]?.sum || 0).toFixed(2)),
      grandTotal.toFixed(2),
    ];
    csvLines.push(totalLine.join(','));

    const csvContent = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvLines.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    const dateStamp = new Date().toISOString().split('T')[0];
    link.setAttribute(
      'download',
      `logs_pivot_summary_${selectedYear === 'all' ? 'all_years' : selectedYear}_${dateStamp}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="logs-summary-page-container" className="space-y-6 animate-in fade-in duration-200">
      {/* Top Banner / Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-lg bg-indigo-50 text-indigo-700">
              <TableIcon className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                Logs Summary &amp; Pivot Table
                <span className="px-2 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
                  Category × Tag Type
                </span>
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Multi-dimensional pivot matrix breaking down summed amounts from the <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-[11px] text-gray-800">logs</code> table.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onRefresh && (
            <button
              id="refresh-summary-btn"
              type="button"
              onClick={onRefresh}
              disabled={isLoading}
              className="px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-1.5"
              title="Reload logs data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh</span>
            </button>
          )}

          <button
            id="export-pivot-csv-btn"
            type="button"
            onClick={handleExportCsv}
            className="px-3 py-1.5 text-xs font-medium bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 rounded-lg transition-colors shadow-2xs flex items-center gap-1.5"
            title="Download pivot matrix as a CSV file"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export CSV</span>
          </button>

          {onNavigateToLogsTable && (
            <button
              id="view-logs-table-btn"
              type="button"
              onClick={onNavigateToLogsTable}
              className="px-3 py-1.5 text-xs font-medium bg-gray-900 hover:bg-black text-white rounded-lg transition-colors shadow-xs flex items-center gap-1.5"
            >
              <span>View Logs Table</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
              Data Filters
            </h3>
            {hasActiveFilters && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                Filters Active
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {hasActiveFilters && (
              <button
                id="reset-filters-btn"
                type="button"
                onClick={handleResetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-medium flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Filters</span>
              </button>
            )}
            <span className="text-xs text-gray-400 font-mono">
              Matching {filteredLogs.length} of {logs.length} logs
            </span>
          </div>
        </div>

        {/* Filter Inputs Grid (4 columns) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Filter by Year */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Year</span>
            </label>
            <select
              id="filter-year-select"
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-medium transition-colors"
            >
              <option value="all">All Available Years ({availableYears.length})</option>
              {availableYears.map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Filter by Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Folder className="w-3.5 h-3.5 text-amber-600" />
              <span>Category</span>
            </label>
            <select
              id="filter-category-select"
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-medium transition-colors"
            >
              <option value="all">All Categories ({categoryTypes.length})</option>
              {categoryTypes.map((cat) => (
                <option key={cat.id} value={String(cat.id)}>
                  {cat.name}
                </option>
              ))}
              <option value="uncategorized">Uncategorized</option>
            </select>
          </div>

          {/* 3. Filter by Tag Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-purple-600" />
              <span>Tag Type</span>
            </label>
            <select
              id="filter-tag-select"
              value={selectedTagId}
              onChange={(e) => setSelectedTagId(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-medium transition-colors"
            >
              <option value="all">All Tag Types ({tagTypes.length})</option>
              {tagTypes.map((tg) => (
                <option key={tg.id} value={String(tg.id)}>
                  {tg.name}
                </option>
              ))}
              <option value="untagged">Untagged (No Tags)</option>
            </select>
          </div>

          {/* 4. Filter by Description or Search */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-gray-500" />
              <span>Search / Keyword</span>
            </label>
            <div className="relative">
              <input
                id="summary-search-input"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search description, amount..."
                className="w-full pl-3 pr-7 py-2 text-xs bg-gray-50/50 hover:bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 font-mono transition-colors"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Active Filter Badges Bar */}
        {hasActiveFilters && (
          <div className="flex items-center gap-2 flex-wrap pt-1 text-xs">
            <span className="text-gray-400 text-[11px] font-medium">Active:</span>
            {selectedYear !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 border border-indigo-200/80 text-indigo-700 text-[11px] font-medium">
                <Calendar className="w-3 h-3 text-indigo-500" />
                Year: {selectedYear}
                <button
                  type="button"
                  onClick={() => setSelectedYear('all')}
                  className="hover:text-indigo-950 ml-0.5"
                  title="Clear Year filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedCategoryId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200/80 text-amber-800 text-[11px] font-medium">
                <Folder className="w-3 h-3 text-amber-600" />
                Cat: {selectedCategoryId === 'uncategorized' ? 'Uncategorized' : categoryTypes.find((c) => String(c.id) === selectedCategoryId)?.name || selectedCategoryId}
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId('all')}
                  className="hover:text-amber-950 ml-0.5"
                  title="Clear Category filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {selectedTagId !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-800 text-[11px] font-medium">
                <Tag className="w-3 h-3 text-purple-600" />
                Tag: {selectedTagId === 'untagged' ? 'Untagged' : tagTypes.find((t) => String(t.id) === selectedTagId)?.name || selectedTagId}
                <button
                  type="button"
                  onClick={() => setSelectedTagId('all')}
                  className="hover:text-purple-950 ml-0.5"
                  title="Clear Tag filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {reconciledFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-[11px] font-medium">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Status: {reconciledFilter}
                <button
                  type="button"
                  onClick={() => setReconciledFilter('all')}
                  className="hover:text-emerald-950 ml-0.5"
                  title="Clear Reconciled filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm.trim() && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-gray-100 border border-gray-300 text-gray-800 text-[11px] font-medium">
                <Search className="w-3 h-3 text-gray-500" />
                "{searchTerm}"
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:text-gray-950 ml-0.5"
                  title="Clear search filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Quick Year Pill Selector Bar */}
        {availableYears.length > 0 && (
          <div className="pt-2 flex items-center gap-2 overflow-x-auto text-xs pb-1">
            <span className="text-gray-400 font-medium text-[11px] shrink-0">Quick Year:</span>
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 ${
                selectedYear === 'all'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All Years
            </button>
            {availableYears.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => setSelectedYear(yr)}
                className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-all shrink-0 font-mono ${
                  selectedYear === yr
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {yr}
              </button>
            ))}

            {/* Reconciliation filter toggle pill */}
            <div className="ml-auto flex items-center gap-1.5 shrink-0 pl-4 border-l border-gray-200">
              <span className="text-gray-400 text-[11px]">Reconciled:</span>
              {(['all', 'reconciled', 'unreconciled'] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setReconciledFilter(mode)}
                  className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors ${
                    reconciledFilter === mode
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Total Sum Amount</span>
            <DollarSign className="w-3.5 h-3.5 text-indigo-600" />
          </div>
          <div
            className={`text-xl font-bold font-mono ${
              summaryMetrics.totalSum >= 0 ? 'text-emerald-700' : 'text-rose-600'
            }`}
          >
            {formatCurrency(summaryMetrics.totalSum)}
          </div>
          <div className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <span>{summaryMetrics.count} filtered records</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Income &amp; Credits</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-700">
            {formatCurrency(summaryMetrics.positiveSum)}
          </div>
          <div className="text-[11px] text-gray-400">Positive log amounts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Expenses &amp; Debits</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="text-xl font-bold font-mono text-rose-600">
            {formatCurrency(summaryMetrics.negativeSum)}
          </div>
          <div className="text-[11px] text-gray-400">Negative log amounts</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-medium text-gray-500 uppercase tracking-wider flex items-center justify-between">
            <span>Dimensions Active</span>
            <Layers className="w-3.5 h-3.5 text-purple-600" />
          </div>
          <div className="text-xl font-bold font-mono text-gray-900">
            {summaryMetrics.categoryCount} <span className="text-xs font-normal text-gray-400">cats</span> /{' '}
            {summaryMetrics.tagCount} <span className="text-xs font-normal text-gray-400">tags</span>
          </div>
          <div className="text-[11px] text-gray-400 font-mono">
            Avg: {formatCurrency(summaryMetrics.average)}
          </div>
        </div>
      </div>

      {/* Pivot Table Main Container */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-2xs overflow-hidden">
        {/* Table Top Controls & Axis Swapper */}
        <div className="px-5 py-3.5 border-b border-gray-200 bg-gray-50/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center gap-1.5">
              <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
              Pivot Matrix Breakdown
            </span>
            <span className="text-xs text-gray-400 font-mono">
              ({pivotData.rows.length} rows × {pivotData.cols.length} columns)
            </span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Swap Axis Button */}
            <button
              id="swap-pivot-axis-btn"
              type="button"
              onClick={() =>
                setPivotAxis((prev) =>
                  prev === 'category_rows' ? 'tag_rows' : 'category_rows'
                )
              }
              className="px-2.5 py-1.5 bg-white hover:bg-gray-100 border border-gray-300 text-gray-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Switch rows and columns"
            >
              <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {pivotData.isCatRows
                  ? 'Rows: Category | Cols: Tag'
                  : 'Rows: Tag | Cols: Category'}
              </span>
            </button>

            {/* Heatmap Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={heatMapIntensity}
                onChange={(e) => setHeatMapIntensity(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span>Heatmap Colors</span>
            </label>

            {/* Hide Empty Toggle */}
            <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={hideEmptyCells}
                onChange={(e) => setHideEmptyCells(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5"
              />
              <span>Hide Unused</span>
            </label>
          </div>
        </div>

        {/* Pivot Matrix Table Area */}
        {filteredLogs.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mx-auto">
              <TableIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-gray-800">No logs match the selected filters</p>
            <p className="text-xs text-gray-400 max-w-sm mx-auto">
              Adjust your year, category, or tag type filter selections, or reset all filters to view logs data.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-xs font-medium inline-flex items-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All Filters</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[600px] relative">
            <table id="pivot-summary-table" className="w-full text-left text-xs border-collapse">
              {/* Header Row */}
              <thead className="bg-gray-100/90 backdrop-blur-xs sticky top-0 z-20 shadow-2xs">
                <tr className="border-b border-gray-200">
                  {/* Top-Left Corner: Row Dimension Label */}
                  <th className="p-3.5 font-bold text-gray-900 sticky left-0 z-30 bg-gray-100 border-r border-gray-200 min-w-[180px]">
                    <div className="flex items-center justify-between">
                      <span className="uppercase tracking-wider text-[11px]">
                        {pivotData.isCatRows ? 'Category' : 'Tag Type'}
                      </span>
                      <span className="text-[10px] text-gray-400 font-normal">
                        ({pivotData.rows.length})
                      </span>
                    </div>
                  </th>

                  {/* Column Headers: Tag Types or Categories */}
                  {pivotData.cols.map((col) => (
                    <th
                      key={col.id}
                      className="p-3 font-semibold text-gray-800 text-right min-w-[120px] max-w-[170px] border-r border-gray-200/70"
                    >
                      <div className="truncate" title={col.name}>
                        {col.name}
                      </div>
                      <div className="text-[10px] text-gray-400 font-normal mt-0.5">
                        {pivotData.colTotals[col.id]?.count || 0} logs
                      </div>
                    </th>
                  ))}

                  {/* Top-Right Corner: Row Total Header */}
                  <th className="p-3 font-bold text-gray-900 text-right min-w-[130px] sticky right-0 z-30 bg-gray-100 border-l border-gray-200 shadow-xs">
                    <div className="uppercase tracking-wider text-[11px]">Row Total</div>
                    <div className="text-[10px] text-gray-500 font-normal mt-0.5">Summed logs</div>
                  </th>
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody className="divide-y divide-gray-100">
                {pivotData.rows.map((row) => {
                  const rTotal = pivotData.rowTotals[row.id];

                  return (
                    <tr key={row.id} className="hover:bg-indigo-50/20 transition-colors">
                      {/* Row Label (Sticky Left) */}
                      <th className="p-3 font-semibold text-gray-900 sticky left-0 z-10 bg-white/95 backdrop-blur-xs border-r border-gray-200 hover:bg-gray-50">
                        <div className="flex items-center gap-1.5">
                          {pivotData.isCatRows ? (
                            <Folder className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                          ) : (
                            <Tag className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                          )}
                          <span className="truncate max-w-[160px]" title={row.name}>
                            {row.name}
                          </span>
                        </div>
                      </th>

                      {/* Matrix Intersection Cells */}
                      {pivotData.cols.map((col) => {
                        const cellData = pivotData.matrix[row.id]?.[col.id];
                        const cellSum = cellData ? cellData.sum : 0;
                        const cellCount = cellData ? cellData.count : 0;

                        let heatStyle = '';
                        if (heatMapIntensity && cellSum !== 0 && pivotData.maxCellAbsAmount > 0) {
                          const ratio = Math.min(
                            1,
                            Math.abs(cellSum) / pivotData.maxCellAbsAmount
                          );
                          if (cellSum > 0) {
                            if (ratio > 0.6) heatStyle = 'bg-emerald-100/80 text-emerald-900 font-bold';
                            else if (ratio > 0.25) heatStyle = 'bg-emerald-50 text-emerald-800 font-medium';
                            else heatStyle = 'bg-emerald-50/40 text-emerald-700';
                          } else {
                            if (ratio > 0.6) heatStyle = 'bg-rose-100/80 text-rose-900 font-bold';
                            else if (ratio > 0.25) heatStyle = 'bg-rose-50 text-rose-800 font-medium';
                            else heatStyle = 'bg-rose-50/40 text-rose-700';
                          }
                        }

                        return (
                          <td
                            key={col.id}
                            onClick={() => {
                              if (cellCount > 0) {
                                setDrilldownCell({
                                  rowName: row.name,
                                  colName: col.name,
                                  logs: cellData.logs,
                                  sum: cellSum,
                                });
                              }
                            }}
                            className={`p-3 text-right font-mono text-xs border-r border-gray-100 transition-colors ${
                              cellCount > 0
                                ? `cursor-pointer hover:ring-1 hover:ring-indigo-400 ${heatStyle}`
                                : 'text-gray-300'
                            }`}
                            title={
                              cellCount > 0
                                ? `${row.name} × ${col.name}: ${formatCurrency(cellSum)} (${cellCount} logs). Click to view.`
                                : 'Empty intersection'
                            }
                          >
                            {cellCount > 0 ? (
                              <div>
                                <div>{formatCurrency(cellSum)}</div>
                                <div className="text-[10px] text-gray-400 font-sans mt-0.5">
                                  {cellCount} {cellCount === 1 ? 'log' : 'logs'}
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-200 select-none font-sans">—</span>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Total (Sticky Right) */}
                      <td
                        onClick={() => {
                          if (rTotal && rTotal.count > 0) {
                            setDrilldownCell({
                              rowName: row.name,
                              colName: 'All Tags Total',
                              logs: rTotal.logs,
                              sum: rTotal.sum,
                            });
                          }
                        }}
                        className="p-3 text-right font-mono text-xs font-bold bg-gray-100/70 hover:bg-indigo-100/70 cursor-pointer sticky right-0 z-10 border-l border-gray-300"
                        title={`Click to view all ${rTotal?.count || 0} logs for ${row.name}`}
                      >
                        <div
                          className={
                            (rTotal?.sum || 0) >= 0 ? 'text-emerald-800' : 'text-rose-700'
                          }
                        >
                          {formatCurrency(rTotal?.sum || 0)}
                        </div>
                        <div className="text-[10px] text-gray-500 font-sans font-normal mt-0.5">
                          {rTotal?.count || 0} logs
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Bottom Totals Footer Row */}
              <tfoot className="bg-gray-100 sticky bottom-0 z-20 border-t-2 border-gray-300 shadow-inner">
                <tr>
                  {/* Footer Left Corner */}
                  <th className="p-3.5 font-bold text-gray-900 sticky left-0 z-30 bg-gray-100 border-r border-gray-200">
                    <div className="uppercase tracking-wider text-[11px]">Column Total</div>
                    <div className="text-[10px] text-gray-500 font-normal">
                      Sum of tag type
                    </div>
                  </th>

                  {/* Column Totals */}
                  {pivotData.cols.map((col) => {
                    const cTotal = pivotData.colTotals[col.id];
                    const sum = cTotal?.sum || 0;
                    const count = cTotal?.count || 0;

                    return (
                      <td
                        key={col.id}
                        onClick={() => {
                          if (count > 0) {
                            setDrilldownCell({
                              rowName: 'All Categories Total',
                              colName: col.name,
                              logs: cTotal.logs,
                              sum,
                            });
                          }
                        }}
                        className="p-3 text-right font-mono text-xs font-bold border-r border-gray-200 hover:bg-indigo-50 cursor-pointer"
                        title={`Click to view all ${count} logs for ${col.name}`}
                      >
                        <div className={sum >= 0 ? 'text-emerald-800' : 'text-rose-700'}>
                          {formatCurrency(sum)}
                        </div>
                        <div className="text-[10px] text-gray-500 font-sans font-normal mt-0.5">
                          {count} logs
                        </div>
                      </td>
                    );
                  })}

                  {/* Grand Total Intersection Cell */}
                  <td className="p-3.5 text-right font-mono text-sm font-black bg-indigo-50/90 text-indigo-950 sticky right-0 z-30 border-l border-indigo-200 shadow-sm">
                    <div className="text-emerald-900">
                      {formatCurrency(pivotData.grandTotal)}
                    </div>
                    <div className="text-[10px] text-indigo-700 font-sans font-normal mt-0.5">
                      Grand Total ({pivotData.grandCount} logs)
                    </div>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Pivot Table Helper Footnote */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/70 text-[11px] text-gray-500 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span>
              Click any amount cell to open a detailed breakdown of the exact log records in that intersection.
            </span>
          </div>
          <div className="font-mono text-gray-400">
            Multi-tag attribution: Row &amp; Grand totals reflect unique log records.
          </div>
        </div>
      </div>

      {/* Drilldown Modal for Intersecting Cell Logs */}
      {drilldownCell && (
        <div
          id="drilldown-modal-overlay"
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-100"
        >
          <div
            id="drilldown-modal-container"
            className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/60">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-800">
                    Cell Breakdown
                  </span>
                  <h3 className="text-sm font-bold text-gray-900">
                    {drilldownCell.rowName} &amp; {drilldownCell.colName}
                  </h3>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {drilldownCell.logs.length} matching {drilldownCell.logs.length === 1 ? 'log' : 'logs'} totaling{' '}
                  <strong className="text-gray-900 font-mono">
                    {formatCurrency(drilldownCell.sum)}
                  </strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrilldownCell(null)}
                className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Logs List */}
            <div className="flex-1 overflow-y-auto p-6 divide-y divide-gray-100">
              {drilldownCell.logs.map((item) => {
                const amtNum = parseFloat(item.logAmount || '0');
                return (
                  <div key={item.id} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-gray-500">{item.logDate}</span>
                        {item.reconciled && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 font-medium flex items-center gap-0.5">
                            <CheckCircle2 className="w-2.5 h-2.5 text-emerald-600" />
                            Reconciled
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-gray-900">
                        {item.logDescription || 'No description'}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                        {item.categoryName && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-800 border border-amber-200/60 font-medium">
                            📁 {item.categoryName}
                          </span>
                        )}
                        {item.tags && item.tags.length > 0 ? (
                          item.tags.map((t) => (
                            <span
                              key={t.tagId}
                              className="text-[10px] px-1.5 py-0.2 rounded bg-purple-50 text-purple-700 border border-purple-200/60 font-medium"
                            >
                              🏷️ {t.tagName}
                            </span>
                          ))
                        ) : (
                          <span className="text-[10px] text-gray-400">Untagged</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`font-mono text-sm font-bold ${
                          amtNum >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {formatCurrency(amtNum)}
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono">ID: #{item.id}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/70">
              <span className="text-xs text-gray-500 font-mono">
                Total: {formatCurrency(drilldownCell.sum)}
              </span>
              <button
                type="button"
                onClick={() => setDrilldownCell(null)}
                className="px-3.5 py-1.5 bg-gray-900 hover:bg-black text-white rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
