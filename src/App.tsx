import React, { useState, useEffect } from 'react';
import { LogItem, StarterLogItem, TagLogAssnItem, SchemaColumn } from './types.ts';
import { LookupTable } from './components/LookupTable.tsx';
import { AddLookupModal } from './components/AddLookupModal.tsx';
import { LogsTable } from './components/LogsTable.tsx';
import { AddLogModal } from './components/AddLogModal.tsx';
import { StarterLogsTable } from './components/StarterLogsTable.tsx';
import { AddStarterLogModal } from './components/AddStarterLogModal.tsx';
import { TagLogAssnTable } from './components/TagLogAssnTable.tsx';
import { AddTagLogAssnModal } from './components/AddTagLogAssnModal.tsx';
import { SchemaInspector } from './components/SchemaInspector.tsx';
import { UsersTable } from './components/UsersTable.tsx';
import { LoginScreen } from './components/LoginScreen.tsx';
import { CsvImportModal } from './components/CsvImportModal.tsx';
import { DatabaseBackupsModal } from './components/DatabaseBackupsModal.tsx';
import { LogsSummaryPage } from './components/LogsSummaryPage.tsx';
import { useAuth } from './context/AuthContext.tsx';
import {
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Tag,
  Folder,
  ListOrdered,
  Link2,
  BookmarkCheck,
  LogOut,
  User as UserIcon,
  FileSpreadsheet,
  ShieldCheck,
  TableProperties,
} from 'lucide-react';

interface SimpleLookupRecord {
  id: number;
  name: string;
  created_at?: string | null;
}

export default function App() {
  const { user, loading: authLoading, signOutUser, authFetch } = useAuth();

  const [selectedTable, setSelectedTable] = useState<
    'logs' | 'starter_logs' | 'tag_log_assn' | 'category_type' | 'tag_type' | 'users' | 'summary'
  >('logs');

  const [records, setRecords] = useState<SimpleLookupRecord[]>([]);
  const [logsList, setLogsList] = useState<LogItem[]>([]);
  const [starterLogsList, setStarterLogsList] = useState<StarterLogItem[]>([]);
  const [assnList, setAssnList] = useState<TagLogAssnItem[]>([]);
  const [logsCount, setLogsCount] = useState<number>(0);
  const [starterLogsCount, setStarterLogsCount] = useState<number>(0);
  const [assnCount, setAssnCount] = useState<number>(0);
  const [categoryCount, setCategoryCount] = useState<number>(0);
  const [tagCount, setTagCount] = useState<number>(0);
  const [schemaColumns, setSchemaColumns] = useState<SchemaColumn[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSchemaLoading, setIsSchemaLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLogModalOpen, setIsLogModalOpen] = useState(false);
  const [isStarterLogModalOpen, setIsStarterLogModalOpen] = useState(false);
  const [isAssnModalOpen, setIsAssnModalOpen] = useState(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [isBackupsModalOpen, setIsBackupsModalOpen] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'records' | 'summary' | 'definition' | 'sql'>('records');
  const [bannerNotice, setBannerNotice] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (type: 'success' | 'error', message: string) => {
    setBannerNotice({ type, message });
    setTimeout(() => {
      setBannerNotice(null);
    }, 4000);
  };

  const isLogs = selectedTable === 'logs';
  const isStarterLogs = selectedTable === 'starter_logs';
  const isAssn = selectedTable === 'tag_log_assn';
  const isUsers = selectedTable === 'users';
  const isSummary = selectedTable === 'summary';

  const apiBase =
    selectedTable === 'logs' || selectedTable === 'summary'
      ? '/api/logs'
      : selectedTable === 'starter_logs'
      ? '/api/starter-logs'
      : selectedTable === 'tag_log_assn'
      ? '/api/tag-log-assns'
      : selectedTable === 'category_type'
      ? '/api/category-types'
      : '/api/tag-types';

  const tableLabel =
    selectedTable === 'logs'
      ? 'Logs'
      : selectedTable === 'starter_logs'
      ? 'Starter Logs'
      : selectedTable === 'tag_log_assn'
      ? 'Tag-Log Association'
      : selectedTable === 'category_type'
      ? 'Category Type'
      : selectedTable === 'tag_type'
      ? 'Tag Type'
      : selectedTable === 'users'
      ? 'Users'
      : 'Logs Summary';

  const fetchRecords = async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      if (selectedTable === 'users') {
        setIsLoading(false);
        return;
      }

      if (selectedTable === 'summary') {
        const res = await authFetch('/api/logs');
        if (res.ok) {
          const list = await res.json();
          const arr = Array.isArray(list) ? list : [];
          setLogsList(arr);
          setLogsCount(arr.length);
        }
        setIsLoading(false);
        return;
      }

      const res = await authFetch(apiBase);
      if (!res.ok) {
        throw new Error(`Failed to fetch ${selectedTable} records`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data : [];

      if (selectedTable === 'logs') {
        setLogsList(list);
        setLogsCount(list.length);
      } else if (selectedTable === 'starter_logs') {
        setStarterLogsList(list);
        setStarterLogsCount(list.length);
      } else if (selectedTable === 'tag_log_assn') {
        setAssnList(list);
        setAssnCount(list.length);
      } else {
        setRecords(list);
        if (selectedTable === 'category_type') {
          setCategoryCount(list.length);
        } else if (selectedTable === 'tag_type') {
          setTagCount(list.length);
        }
      }
    } catch (err: any) {
      console.error(err);
      showNotice('error', err.message || `Failed to load records from Cloud SQL`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSchema = async () => {
    if (!user || selectedTable === 'users' || selectedTable === 'summary') {
      setIsSchemaLoading(false);
      return;
    }
    setIsSchemaLoading(true);
    try {
      const res = await authFetch(`/api/table-schema?table=${selectedTable}`);
      if (!res.ok) throw new Error('Failed to fetch schema metadata');
      const data = await res.json();
      setSchemaColumns(data.columns || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsSchemaLoading(false);
    }
  };

  // Fetch counts when user changes
  useEffect(() => {
    if (!user) return;

    authFetch('/api/logs')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setLogsCount(d.length);
      })
      .catch(() => {});

    authFetch('/api/starter-logs')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setStarterLogsCount(d.length);
      })
      .catch(() => {});

    authFetch('/api/tag-log-assns')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setAssnCount(d.length);
      })
      .catch(() => {});

    authFetch('/api/category-types')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setCategoryCount(d.length);
      })
      .catch(() => {});

    authFetch('/api/tag-types')
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) setTagCount(d.length);
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchRecords();
      fetchSchema();
    }
  }, [selectedTable, user]);

  const handleAddRecord = async (name: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { success: false, error: data.error || `Failed to add ${tableLabel}.` };
      }
      showNotice('success', `Created ${tableLabel} "${data.name}" with ID #${data.id}`);
      fetchRecords();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  const handleAddLog = async (data: {
    logDate: string;
    logDescription?: string;
    logAmount?: string;
    logCategory?: number;
    reconciled?: boolean;
    tagIds?: number[];
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to add log entry.' };
      }
      showNotice('success', `Created log record #${resData.id} for ${resData.logDate}`);
      fetchRecords();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  const handleUpdateLog = async (
    id: number,
    data: {
      logDate?: string;
      logDescription?: string;
      logAmount?: string;
      logCategory?: number;
      reconciled?: boolean;
      tagIds?: number[];
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to update log entry.' };
      }
      showNotice('success', `Updated log record #${id}`);
      fetchRecords();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  const handleAddStarterLog = async (data: {
    logDate?: string;
    logDescription?: string;
    logAmount?: string;
    logCategory?: number;
    reconciled?: boolean;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/starter-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to add starter log entry.' };
      }
      showNotice('success', `Created starter log record #${resData.id}`);
      fetchRecords();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  const handleUpdateStarterLog = async (
    id: number,
    data: {
      logDate?: string;
      logDescription?: string;
      logAmount?: string;
      logCategory?: number;
      reconciled?: boolean;
    }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch(`/api/starter-logs/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to update starter log entry.' };
      }
      showNotice('success', `Updated starter log #${id}`);
      fetchRecords();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  const handleAddAssn = async (data: {
    tagId: number;
    logId: number;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authFetch('/api/tag-log-assns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resData = await res.json();
      if (!res.ok) {
        return { success: false, error: resData.error || 'Failed to create association.' };
      }
      showNotice('success', `Created association #${resData.id} (tag_id: ${data.tagId}, log_id: ${data.logId})`);
      fetchRecords();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Network error occurred.' };
    }
  };

  const handleUpdateRecord = async (id: number, newName: string): Promise<boolean> => {
    try {
      const res = await authFetch(`${apiBase}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || `Failed to update ${tableLabel}`);
        return false;
      }
      showNotice('success', `Updated ${tableLabel} #${id} to "${newName}"`);
      fetchRecords();
      return true;
    } catch (err: any) {
      showNotice('error', err.message || `Failed to update ${tableLabel}`);
      return false;
    }
  };

  const handleDeleteRecord = async (id: number): Promise<boolean> => {
    try {
      const res = await authFetch(`${apiBase}/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        showNotice('error', data.error || `Failed to delete ${tableLabel}`);
        return false;
      }
      showNotice('success', `Deleted record #${id}`);
      fetchRecords();
      return true;
    } catch (err: any) {
      showNotice('error', err.message || `Failed to delete record`);
      return false;
    }
  };

  const handleSeedDefaults = async () => {
    setIsSeeding(true);
    try {
      const endpoint =
        selectedTable === 'category_type'
          ? '/api/category-types/seed-defaults'
          : '/api/tag-types/seed-defaults';
      const res = await authFetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to seed');
      showNotice('success', data.message || 'Seeded standard presets successfully.');
      fetchRecords();
    } catch (err: any) {
      showNotice('error', err.message || 'Error seeding default presets');
    } finally {
      setIsSeeding(false);
    }
  };

  const handleClearAll = async () => {
    try {
      const res = await authFetch(apiBase, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to clear records');
      showNotice('success', `All records have been removed from ${selectedTable} table.`);
      fetchRecords();
    } catch (err: any) {
      showNotice('error', err.message || 'Failed to remove records');
    }
  };

  // Auth Loading Screen
  if (authLoading) {
    return (
      <div id="auth-loading-screen" className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-gray-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-black rounded-full animate-spin" />
          <p className="text-xs font-mono text-gray-500">Checking Google Authentication...</p>
        </div>
      </div>
    );
  }

  // Not Authenticated -> Show LoginScreen
  if (!user) {
    return <LoginScreen />;
  }

  const totalRowCount =
    isLogs || isSummary
      ? logsList.length
      : isStarterLogs
      ? starterLogsList.length
      : isAssn
      ? assnList.length
      : isUsers
      ? 1
      : records.length;

  return (
    <div id="app-root" className="flex flex-col min-h-screen bg-white font-sans text-gray-900 selection:bg-gray-100">
      {/* Header */}
      <header id="main-header" className="flex items-center justify-between px-6 lg:px-8 py-3.5 border-b border-gray-100 bg-white sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-black rounded flex items-center justify-center shrink-0">
            <div className="w-4 h-4 border-2 border-white"></div>
          </div>
          <nav className="flex items-center gap-2 text-sm text-gray-400">
            <span>Expenses &amp; Income Tracker</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-900 font-medium">Cloud SQL</span>
            <span className="text-gray-300">/</span>
            <span className="font-mono text-gray-700">{selectedTable}</span>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          {/* User Account Info & Sign Out */}
          <div className="flex items-center gap-2 px-2.5 py-1 bg-gray-50 border border-gray-200 rounded-lg text-xs">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User'}
                className="w-5 h-5 rounded-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-5 h-5 rounded-full bg-black text-white flex items-center justify-center text-[10px] font-bold">
                {user.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <span className="font-medium text-gray-800 max-w-[140px] truncate hidden sm:inline" title={user.email || ''}>
              {user.email}
            </span>
            <button
              id="sign-out-btn"
              type="button"
              onClick={signOutUser}
              title="Sign out of Google Account"
              className="ml-1 text-gray-400 hover:text-rose-600 p-0.5 rounded transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            id="refresh-btn"
            type="button"
            onClick={() => {
              fetchRecords();
              fetchSchema();
            }}
            className="p-2 text-gray-400 hover:text-gray-900 border border-gray-200 rounded hover:bg-gray-50 transition-colors"
            title="Refresh database records"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {!isUsers && !isSummary && totalRowCount > 0 && (
            <button
              id="clear-all-btn"
              type="button"
              onClick={handleClearAll}
              className="px-3 py-2 text-sm border border-gray-200 rounded hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 text-gray-500 transition-colors"
              title="Remove all records from table"
            >
              Clear Records
            </button>
          )}

          {!isLogs && !isStarterLogs && !isAssn && !isUsers && !isSummary && (
            <button
              id="seed-presets-btn"
              type="button"
              disabled={isSeeding}
              onClick={handleSeedDefaults}
              className="px-4 py-2 text-sm border border-gray-200 rounded hover:bg-gray-50 text-gray-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5 text-gray-400" />
              <span>{isSeeding ? 'Seeding...' : 'Seed Presets'}</span>
            </button>
          )}

          {(isLogs || isStarterLogs) && (
            <button
              id="header-import-csv-btn"
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="px-3.5 py-2 text-sm border border-emerald-300 text-emerald-800 bg-emerald-50/80 hover:bg-emerald-100 rounded flex items-center gap-1.5 transition-colors font-medium shadow-2xs"
              title="Import records from CSV file or load the 220 default records"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Import CSV</span>
            </button>
          )}

          {/* Quick toggle between Summary/Pivot and Table view */}
          {isSummary || activeTab === 'summary' ? (
            <button
              id="header-view-logs-btn"
              type="button"
              onClick={() => {
                setSelectedTable('logs');
                setActiveTab('records');
              }}
              className="px-3.5 py-2 text-sm border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 rounded flex items-center gap-1.5 transition-colors font-medium shadow-2xs"
              title="Return to full Logs table"
            >
              <ListOrdered className="w-4 h-4 text-gray-600" />
              <span>Logs Table</span>
            </button>
          ) : (
            <button
              id="header-summary-pivot-btn"
              type="button"
              onClick={() => {
                setSelectedTable('logs');
                setActiveTab('summary');
              }}
              className={`px-3.5 py-2 text-sm border rounded flex items-center gap-1.5 transition-colors font-medium shadow-2xs ${
                isLogs
                  ? 'border-indigo-300 text-indigo-800 bg-indigo-50/80 hover:bg-indigo-100'
                  : 'border-gray-200 text-gray-700 bg-white hover:bg-gray-50'
              }`}
              title="Open Logs Summary & Pivot Analysis"
            >
              <TableProperties className="w-4 h-4 text-indigo-600" />
              <span>Summary &amp; Pivot</span>
            </button>
          )}

          <button
            id="header-database-backups-btn"
            type="button"
            onClick={() => setIsBackupsModalOpen(true)}
            className="px-3.5 py-2 text-sm border border-indigo-200 text-indigo-800 bg-indigo-50/70 hover:bg-indigo-100 rounded flex items-center gap-1.5 transition-colors font-medium shadow-2xs"
            title="Manage monthly database backups, point-in-time snapshots, and recovery"
          >
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Backups</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white" title="Auto-monthly backup active" />
          </button>

          {!isUsers && (
            <button
              id="open-add-modal-btn"
              type="button"
              onClick={() => {
                if (isLogs || isSummary) {
                  setIsLogModalOpen(true);
                } else if (isStarterLogs) {
                  setIsStarterLogModalOpen(true);
                } else if (isAssn) {
                  setIsAssnModalOpen(true);
                } else {
                  setIsModalOpen(true);
                }
              }}
              className="px-4 py-2 text-sm bg-black text-white rounded hover:bg-gray-800 flex items-center gap-1.5 transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isLogs || isSummary ? 'Add Log' : isStarterLogs ? 'Add Starter Log' : isAssn ? 'Add Association' : `Add ${tableLabel}`}</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Body with Sidebar and Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 border-r border-gray-100 p-6 flex flex-col justify-between hidden md:flex bg-white shrink-0">
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tables</h3>
              <ul className="space-y-1">
                <li
                  id="nav-logs"
                  onClick={() => {
                    setSelectedTable('logs');
                    setActiveTab('records');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTable === 'logs' && activeTab !== 'summary'
                      ? 'bg-gray-100 text-black font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ListOrdered className="w-3.5 h-3.5 text-gray-400" />
                    <span>logs</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-gray-200 text-gray-500">
                    {selectedTable === 'logs' ? logsList.length : logsCount}
                  </span>
                </li>

                <li
                  id="nav-starter-logs"
                  onClick={() => {
                    setSelectedTable('starter_logs');
                    if (activeTab === 'summary') setActiveTab('records');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTable === 'starter_logs'
                      ? 'bg-amber-50 text-amber-900 font-medium border border-amber-200/60'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <BookmarkCheck className="w-3.5 h-3.5 text-amber-600" />
                    <span>starter_logs</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-amber-200 text-amber-800">
                    {selectedTable === 'starter_logs' ? starterLogsList.length : starterLogsCount}
                  </span>
                </li>

                <li
                  id="nav-tag-log-assn"
                  onClick={() => {
                    setSelectedTable('tag_log_assn');
                    if (activeTab === 'summary') setActiveTab('records');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTable === 'tag_log_assn'
                      ? 'bg-gray-100 text-black font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Link2 className="w-3.5 h-3.5 text-purple-600" />
                    <span>tag_log_assn</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-gray-200 text-purple-700 bg-purple-50">
                    {selectedTable === 'tag_log_assn' ? assnList.length : assnCount}
                  </span>
                </li>

                <li
                  id="nav-category-type"
                  onClick={() => {
                    setSelectedTable('category_type');
                    if (activeTab === 'summary') setActiveTab('records');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTable === 'category_type'
                      ? 'bg-gray-100 text-black font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Folder className="w-3.5 h-3.5 text-gray-400" />
                    <span>category_type</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-gray-200 text-gray-500">
                    {selectedTable === 'category_type' ? records.length : categoryCount}
                  </span>
                </li>

                <li
                  id="nav-tag-type"
                  onClick={() => {
                    setSelectedTable('tag_type');
                    if (activeTab === 'summary') setActiveTab('records');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTable === 'tag_type'
                      ? 'bg-gray-100 text-black font-medium'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Tag className="w-3.5 h-3.5 text-gray-400" />
                    <span>tag_type</span>
                  </div>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 bg-white rounded border border-gray-200 text-gray-500">
                    {selectedTable === 'tag_type' ? records.length : tagCount}
                  </span>
                </li>

                <li
                  id="nav-users"
                  onClick={() => {
                    setSelectedTable('users');
                    if (activeTab === 'summary') setActiveTab('records');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    selectedTable === 'users'
                      ? 'bg-emerald-50 text-emerald-900 font-medium border border-emerald-200/60'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-600" />
                    <span>users</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 bg-white px-1.5 py-0.2 rounded border border-emerald-200">
                    auth
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Reports &amp; Analysis</h3>
              <ul className="space-y-1">
                <li
                  id="nav-logs-summary"
                  onClick={() => {
                    setSelectedTable('logs');
                    setActiveTab('summary');
                  }}
                  className={`px-3 py-2 text-sm rounded cursor-pointer transition-colors flex items-center justify-between ${
                    (selectedTable === 'logs' && activeTab === 'summary') || selectedTable === 'summary'
                      ? 'bg-indigo-600 text-white font-medium shadow-xs'
                      : 'text-gray-700 hover:bg-indigo-50/70 hover:text-indigo-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <TableProperties className={`w-3.5 h-3.5 ${(selectedTable === 'logs' && activeTab === 'summary') || selectedTable === 'summary' ? 'text-white' : 'text-indigo-600'}`} />
                    <span>Logs Summary</span>
                  </div>
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border ${
                    (selectedTable === 'logs' && activeTab === 'summary') || selectedTable === 'summary'
                      ? 'bg-indigo-700 border-indigo-500 text-white'
                      : 'bg-indigo-50 border-indigo-200 text-indigo-700'
                  }`}>
                    pivot
                  </span>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Stats</h3>
              <div className="space-y-2">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-400">Total Rows ({selectedTable})</div>
                  <div className="text-lg font-medium text-gray-900 font-mono mt-0.5">{totalRowCount}</div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-xs text-gray-400">Security Scope</div>
                  <div className="text-xs font-medium text-emerald-700 mt-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>User-Isolated Data</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-gray-50 p-3 rounded text-[11px] text-gray-500 space-y-1">
              <div className="text-gray-400 font-medium uppercase tracking-wider text-[10px]">Cloud SQL Region</div>
              <div className="font-mono text-gray-700">us-east1 (PostgreSQL)</div>
            </div>
          </div>
        </aside>

        {/* Main Section */}
        <section className="flex-1 p-6 lg:p-10 bg-gray-50/30 overflow-y-auto">
          <div className={`${isSummary || activeTab === 'summary' ? 'max-w-6xl' : 'max-w-4xl'} mx-auto space-y-8`}>
            {/* Banner Notifications */}
            {bannerNotice && (
              <div
                id="banner-notice"
                className={`p-3.5 rounded-lg border flex items-center justify-between text-xs font-medium ${
                  bannerNotice.type === 'success'
                    ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50/80 border-rose-200 text-rose-900'
                }`}
              >
                <div className="flex items-center gap-2">
                  {bannerNotice.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span>{bannerNotice.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setBannerNotice(null)}
                  className="text-xs underline hover:opacity-80"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Page Header with Minimalist Typography */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-gray-100 pb-4">
              <div>
                <h1 className="text-3xl font-light text-gray-900 tracking-tight">
                  {selectedTable === 'summary' || activeTab === 'summary' ? 'logs summary & pivot' : selectedTable}
                </h1>
                <p className="text-sm text-gray-500 mt-1">
                  {selectedTable === 'summary' || activeTab === 'summary'
                    ? 'Cross-tabulation pivot matrix breakdown of summed log amounts categorized by category and tag type, with multi-year and reconciliation filtering.'
                    : selectedTable === 'tag_log_assn'
                    ? 'Association join table establishing a many-to-many relationship between tag_type and logs records.'
                    : selectedTable === 'starter_logs'
                    ? 'Starter / template log entries with defaults (log_date = CURRENT_DATE, reconciled = False), ready to be customized and applied directly to active logs.'
                    : selectedTable === 'logs'
                    ? 'Primary logs tracking table recording dates, descriptions, amounts (positive = income, negative = expense), and foreign key references to category_type and users.'
                    : selectedTable === 'category_type'
                    ? 'A lookup table for general categories with unique auto-increment ID and unique text name.'
                    : selectedTable === 'tag_type'
                    ? 'A lookup table for categorization tags with unique auto-increment ID and unique text name.'
                    : 'User accounts synchronized with Google Authentication credentials and isolated Cloud SQL records.'}
                </p>
              </div>
              <div className="flex gap-6 text-xs font-medium uppercase tracking-widest text-gray-400">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTable === 'summary') setSelectedTable('logs');
                    setActiveTab('records');
                  }}
                  className={`pb-1 transition-all ${
                    activeTab === 'records' && selectedTable !== 'summary'
                      ? 'border-b-2 border-black text-black font-semibold'
                      : 'hover:text-gray-600'
                  }`}
                >
                  Data Preview ({totalRowCount})
                </button>

                {(isLogs || isSummary) && (
                  <button
                    id="tab-summary-pivot"
                    type="button"
                    onClick={() => {
                      setActiveTab('summary');
                    }}
                    className={`pb-1 transition-all flex items-center gap-1.5 ${
                      activeTab === 'summary' || selectedTable === 'summary'
                        ? 'border-b-2 border-indigo-600 text-indigo-700 font-semibold'
                        : 'hover:text-gray-600'
                    }`}
                  >
                    <TableProperties className="w-3.5 h-3.5" />
                    <span>Summary &amp; Pivot</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (selectedTable === 'summary') setSelectedTable('logs');
                    setActiveTab('definition');
                  }}
                  className={`pb-1 transition-all ${
                    activeTab === 'definition' && selectedTable !== 'summary'
                      ? 'border-b-2 border-black text-black font-semibold'
                      : 'hover:text-gray-600'
                  }`}
                >
                  Definition
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedTable === 'summary') setSelectedTable('logs');
                    setActiveTab('sql');
                  }}
                  className={`pb-1 transition-all ${
                    activeTab === 'sql' && selectedTable !== 'summary'
                      ? 'border-b-2 border-black text-black font-semibold'
                      : 'hover:text-gray-600'
                  }`}
                >
                  SQL DDL
                </button>
              </div>
            </div>

            {/* Search Filter for Records (hidden in summary tab) */}
            {activeTab === 'records' && !isUsers && (
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-full max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    id="search-types-input"
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder={
                      isStarterLogs
                        ? 'Filter starter logs...'
                        : isLogs
                        ? 'Filter logs by description, date, category...'
                        : isAssn
                        ? 'Filter by tag name, log description...'
                        : 'Filter by name or ID...'
                    }
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-black font-mono transition-colors"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700"
                    >
                      ×
                    </button>
                  )}
                </div>

                <div className="text-xs text-gray-400 font-mono">
                  Schema: <span className="text-gray-900 font-medium">public.{selectedTable}</span>
                </div>
              </div>
            )}

            {/* Tab Views */}
            {(isSummary || activeTab === 'summary') && (
              <LogsSummaryPage
                logs={logsList}
                isLoading={isLoading}
                onRefresh={fetchRecords}
                onOpenAddLog={() => setIsLogModalOpen(true)}
                onNavigateToLogsTable={() => {
                  setSelectedTable('logs');
                  setActiveTab('records');
                }}
              />
            )}

            {activeTab === 'records' && isUsers && (
              <UsersTable isLoading={isLoading} />
            )}

            {activeTab === 'records' && isStarterLogs && (
              <StarterLogsTable
                starterLogs={starterLogsList}
                isLoading={isLoading}
                onDelete={handleDeleteRecord}
                onUpdate={handleUpdateStarterLog}
                onOpenAdd={() => setIsStarterLogModalOpen(true)}
                onOpenImportCsv={() => setIsCsvModalOpen(true)}
                onRefresh={fetchRecords}
                onNotice={showNotice}
              />
            )}

            {activeTab === 'records' && isAssn && (
              <TagLogAssnTable
                associations={assnList}
                isLoading={isLoading}
                onDelete={handleDeleteRecord}
                searchTerm={searchTerm}
                onOpenAdd={() => setIsAssnModalOpen(true)}
              />
            )}

            {activeTab === 'records' && isLogs && (
              <LogsTable
                logs={logsList}
                isLoading={isLoading}
                onDelete={handleDeleteRecord}
                onUpdate={handleUpdateLog}
                searchTerm={searchTerm}
                onOpenAdd={() => setIsLogModalOpen(true)}
                onOpenImportCsv={() => setIsCsvModalOpen(true)}
                onOpenSummary={() => setActiveTab('summary')}
                onRefresh={fetchRecords}
                onNotice={showNotice}
              />
            )}

            {activeTab === 'records' && !isLogs && !isStarterLogs && !isAssn && !isUsers && (
              <LookupTable
                items={records}
                tableName={selectedTable}
                isLoading={isLoading}
                onUpdate={handleUpdateRecord}
                onDelete={handleDeleteRecord}
                searchTerm={searchTerm}
                onOpenAdd={() => setIsModalOpen(true)}
              />
            )}

            {activeTab === 'definition' && (
              <SchemaInspector
                columns={schemaColumns}
                isLoading={isSchemaLoading}
                viewMode="columns"
                tableName={selectedTable}
              />
            )}

            {activeTab === 'sql' && (
              <SchemaInspector
                columns={schemaColumns}
                isLoading={isSchemaLoading}
                viewMode="sql"
                tableName={selectedTable}
              />
            )}

            {/* Embedded Minimalist SQL Schema Card at Bottom */}
            {activeTab === 'records' && !isUsers && (
              <div className="mt-8">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">SQL Schema Definition</h4>
                {isStarterLogs ? (
                  <div className="bg-gray-900 rounded-lg p-5 font-mono text-xs leading-relaxed text-gray-300 shadow-md">
                    <div className="text-blue-400 inline">CREATE TABLE</div> <div className="inline text-white">"starter_logs"</div> (<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"id"</div> <div className="inline text-yellow-400 uppercase">serial PRIMARY KEY NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_date"</div> <div className="inline text-yellow-400 uppercase">date DEFAULT CURRENT_DATE NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_description"</div> <div className="inline text-yellow-400 uppercase">text</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_amount"</div> <div className="inline text-yellow-400 uppercase">numeric(12, 2)</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_category"</div> <div className="inline text-yellow-400 uppercase">integer REFERENCES "category_type"("id")</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"reconciled"</div> <div className="inline text-yellow-400 uppercase">boolean DEFAULT false</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"created_at"</div> <div className="inline text-yellow-400 uppercase">timestamp DEFAULT now()</div><br />
                    );
                  </div>
                ) : isAssn ? (
                  <div className="bg-gray-900 rounded-lg p-5 font-mono text-xs leading-relaxed text-gray-300 shadow-md">
                    <div className="text-blue-400 inline">CREATE TABLE</div> <div className="inline text-white">"tag_log_assn"</div> (<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"id"</div> <div className="inline text-yellow-400 uppercase">serial PRIMARY KEY NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"tag_id"</div> <div className="inline text-yellow-400 uppercase">integer NOT NULL REFERENCES "tag_type"("id") ON DELETE CASCADE</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_id"</div> <div className="inline text-yellow-400 uppercase">integer NOT NULL REFERENCES "logs"("id") ON DELETE CASCADE</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"created_at"</div> <div className="inline text-yellow-400 uppercase">timestamp DEFAULT now()</div><br />
                    );
                  </div>
                ) : isLogs ? (
                  <div className="bg-gray-900 rounded-lg p-5 font-mono text-xs leading-relaxed text-gray-300 shadow-md">
                    <div className="text-blue-400 inline">CREATE TABLE</div> <div className="inline text-white">"logs"</div> (<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"id"</div> <div className="inline text-yellow-400 uppercase">serial PRIMARY KEY NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_date"</div> <div className="inline text-yellow-400 uppercase">date NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_description"</div> <div className="inline text-yellow-400 uppercase">text</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_amount"</div> <div className="inline text-yellow-400 uppercase">numeric(12, 2)</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_category"</div> <div className="inline text-yellow-400 uppercase">integer REFERENCES "category_type"("id")</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"log_user_id"</div> <div className="inline text-yellow-400 uppercase">integer REFERENCES "users"("id")</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"created_at"</div> <div className="inline text-yellow-400 uppercase">timestamp DEFAULT now()</div><br />
                    );
                  </div>
                ) : (
                  <div className="bg-gray-900 rounded-lg p-5 font-mono text-xs leading-relaxed text-gray-300 shadow-md">
                    <div className="text-blue-400 inline">CREATE TABLE</div> <div className="inline text-white">"{selectedTable}"</div> (<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"id"</div> <div className="inline text-yellow-400 uppercase">serial PRIMARY KEY NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"name"</div> <div className="inline text-yellow-400 uppercase">text UNIQUE NOT NULL</div>,<br />
                    &nbsp;&nbsp;<div className="inline text-green-400">"created_at"</div> <div className="inline text-yellow-400 uppercase">timestamp DEFAULT now()</div><br />
                    );
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Minimalist Footer */}
      <footer className="h-10 border-t border-gray-100 flex items-center justify-between px-6 lg:px-8 text-[10px] text-gray-400 uppercase tracking-widest bg-white">
        <span>PostgreSQL Cloud SQL • v15.3</span>
        <div className="flex items-center gap-4">
          <span>Google Auth: Active</span>
          <span className="text-emerald-600 font-bold flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            User Isolated
          </span>
        </div>
      </footer>

      {/* Add Modal for Lookup Tables */}
      <AddLookupModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddRecord}
        tableName={selectedTable}
      />

      {/* Add Modal for Logs */}
      <AddLogModal
        isOpen={isLogModalOpen}
        onClose={() => setIsLogModalOpen(false)}
        onAdd={handleAddLog}
      />

      {/* Add Modal for Starter Logs */}
      <AddStarterLogModal
        isOpen={isStarterLogModalOpen}
        onClose={() => setIsStarterLogModalOpen(false)}
        onAdd={handleAddStarterLog}
      />

      {/* Add Modal for Tag-Log Associations */}
      <AddTagLogAssnModal
        isOpen={isAssnModalOpen}
        onClose={() => setIsAssnModalOpen(false)}
        onAdd={handleAddAssn}
      />

      {/* CSV Import Modal */}
      <CsvImportModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        defaultTable={selectedTable === 'starter_logs' ? 'starter_logs' : 'logs'}
        onImportComplete={(count, table) => {
          fetchRecords();
          if (table === 'logs') {
            setLogsCount((prev) => prev + count);
          } else if (table === 'starter_logs') {
            setStarterLogsCount((prev) => prev + count);
          }
        }}
        onNotice={showNotice}
      />

      {/* Database Backups & Snapshots Modal */}
      <DatabaseBackupsModal
        isOpen={isBackupsModalOpen}
        onClose={() => setIsBackupsModalOpen(false)}
        onNotice={showNotice}
        onRestoreCompleted={() => {
          fetchRecords();
        }}
      />
    </div>
  );
}
