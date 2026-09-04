import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Database,
  ShieldCheck,
  Download,
  RotateCcw,
  Trash2,
  Plus,
  RefreshCw,
  FileCode,
  FileJson,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Calendar,
  Layers,
  Sparkles,
  Info,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface DatabaseBackupItem {
  id: number;
  userId: number | null;
  name: string;
  backupType: 'automatic_monthly' | 'manual' | string;
  recordCount: number;
  fileSizeKb: string | null;
  createdAt: string;
}

interface DatabaseBackupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotice?: (type: 'success' | 'error', message: string) => void;
  onRestoreCompleted?: () => void;
}

export const DatabaseBackupsModal: React.FC<DatabaseBackupsModalProps> = ({
  isOpen,
  onClose,
  onNotice,
  onRestoreCompleted,
}) => {
  const { authFetch } = useAuth();

  const [backups, setBackups] = useState<DatabaseBackupItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [customName, setCustomName] = useState('');
  const [selectedBackupForRestore, setSelectedBackupForRestore] = useState<DatabaseBackupItem | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isUploadingRestore, setIsUploadingRestore] = useState(false);
  const [downloadingKey, setDownloadingKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'backups' | 'export' | 'cloudsql_guide'>('backups');
  const fileUploadRef = useRef<HTMLInputElement>(null);

  // Fetch list of backups
  const fetchBackups = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data);
      }
    } catch (err) {
      console.error('Failed to fetch backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackups();
    }
  }, [isOpen]);

  // Create on-demand backup
  const handleCreateBackup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    setIsCreating(true);
    try {
      const res = await authFetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: customName.trim() || undefined,
          backupType: 'manual',
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to create backup snapshot');
      }

      const created = await res.json();
      setCustomName('');
      if (onNotice) onNotice('success', `Snapshot "${created.name}" created with ${created.recordCount} records!`);
      await fetchBackups();
    } catch (err: any) {
      console.error('Backup creation error:', err);
      if (onNotice) onNotice('error', err.message || 'Error creating database backup.');
    } finally {
      setIsCreating(false);
    }
  };

  // Trigger monthly check manually
  const handleTriggerMonthlyCheck = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/backups/check-monthly', { method: 'POST' });
      const data = await res.json();
      if (data.created) {
        if (onNotice) onNotice('success', `Automated Monthly Backup created: ${data.backup?.name}`);
      } else {
        if (onNotice) onNotice('success', `Monthly backup verification complete: ${data.reason}`);
      }
      await fetchBackups();
    } catch (err: any) {
      console.error('Monthly check error:', err);
      if (onNotice) onNotice('error', 'Failed to execute monthly backup verification.');
    } finally {
      setIsLoading(false);
    }
  };

  // Delete backup
  const handleDeleteBackup = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete backup snapshot "${name}"?`)) return;

    try {
      const res = await authFetch(`/api/backups/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setBackups((prev) => prev.filter((b) => b.id !== id));
        if (onNotice) onNotice('success', `Backup "${name}" deleted.`);
      } else {
        throw new Error('Failed to delete backup');
      }
    } catch (err: any) {
      console.error('Delete backup error:', err);
      if (onNotice) onNotice('error', err.message || 'Error deleting backup.');
    }
  };

  // Helper to securely download backup files using authenticated requests
  const downloadFile = async (url: string, fallbackFilename: string, key?: string) => {
    if (key) setDownloadingKey(key);
    try {
      const res = await authFetch(url);
      if (!res.ok) {
        let errMsg = 'Failed to download file';
        try {
          const data = await res.json();
          errMsg = data.error || errMsg;
        } catch {
          // ignore parse errors
        }
        throw new Error(errMsg);
      }

      const blob = await res.blob();
      let filename = fallbackFilename;
      const disposition = res.headers.get('content-disposition');
      if (disposition && disposition.includes('filename=')) {
        const match = disposition.match(/filename="?([^"]+)"?/);
        if (match && match[1]) {
          filename = match[1];
        }
      }

      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      if (onNotice) {
        onNotice('success', `Successfully downloaded ${filename}`);
      }
    } catch (err: any) {
      console.error('Download error:', err);
      if (onNotice) {
        onNotice('error', err.message || 'Error downloading backup file.');
      }
    } finally {
      if (key) setDownloadingKey(null);
    }
  };

  // Download JSON backup
  const handleDownloadJson = (id: number, name?: string) => {
    const sanitized = (name || 'snapshot').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    downloadFile(`/api/backups/${id}/download-json`, `db_backup_${sanitized}_${id}.json`, `json-${id}`);
  };

  // Download SQL dump
  const handleDownloadSql = (id: number, name?: string) => {
    const sanitized = (name || 'snapshot').replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
    downloadFile(`/api/backups/${id}/download-sql`, `db_backup_${sanitized}_${id}.sql`, `sql-${id}`);
  };

  // Live exports
  const handleLiveExportJson = () => {
    const today = new Date().toISOString().split('T')[0];
    downloadFile('/api/backups/export/live-json', `live_database_export_${today}.json`, 'live-json');
  };

  const handleLiveExportSql = () => {
    const today = new Date().toISOString().split('T')[0];
    downloadFile('/api/backups/export/live-sql', `live_database_dump_${today}.sql`, 'live-sql');
  };

  // Restore database
  const executeRestore = async () => {
    if (!selectedBackupForRestore) return;
    setIsRestoring(true);
    try {
      const res = await authFetch(`/api/backups/${selectedBackupForRestore.id}/restore`, {
        method: 'POST',
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || 'Failed to restore database');
      }

      setShowRestoreConfirm(false);
      setSelectedBackupForRestore(null);
      if (onNotice) {
        onNotice(
          'success',
          `Database restored successfully! (${result.restoredCounts?.logs || 0} logs restored)`
        );
      }
      if (onRestoreCompleted) onRestoreCompleted();
    } catch (err: any) {
      console.error('Restore error:', err);
      if (onNotice) onNotice('error', err.message || 'Failed to restore database from backup.');
    } finally {
      setIsRestoring(false);
    }
  };

  // Restore from uploaded JSON
  const handleFileRestoreSelect = (file: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const snapshot = JSON.parse(text);
        if (!snapshot.tables) {
          throw new Error('File does not appear to be a valid JSON database snapshot.');
        }

        if (
          !confirm(
            `Confirm restoration from file "${file.name}"?\nThis will replace existing records with the snapshot dataset.`
          )
        ) {
          return;
        }

        setIsUploadingRestore(true);
        const res = await authFetch('/api/backups/restore-payload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ snapshot }),
        });

        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'Failed to restore from file');

        if (onNotice) {
          onNotice(
            'success',
            `Restored from "${file.name}" successfully! (${result.restoredCounts?.logs || 0} logs restored)`
          );
        }
        if (onRestoreCompleted) onRestoreCompleted();
        await fetchBackups();
      } catch (err: any) {
        console.error('File restore error:', err);
        if (onNotice) onNotice('error', err.message || 'Error restoring from file.');
      } finally {
        setIsUploadingRestore(false);
        if (fileUploadRef.current) fileUploadRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div
      id="database-backups-modal-overlay"
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150"
    >
      <div
        id="database-backups-modal-container"
        className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shadow-xs">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="backups-modal-title" className="text-base font-bold text-gray-900">
                  Production Database Backups
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                  <ShieldCheck className="w-3 h-3 text-emerald-600" />
                  Monthly Auto-Backup: Active
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Automated monthly snapshots, on-demand point-in-time backups, and one-click database restore.
              </p>
            </div>
          </div>
          <button
            id="close-backups-modal-btn"
            type="button"
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setActiveTab('backups')}
              className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'backups'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Clock className="w-4 h-4" />
              Backup History ({backups.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'export'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Download className="w-4 h-4" />
              Export & Import Offline Files
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cloudsql_guide')}
              className={`py-3 text-xs font-semibold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'cloudsql_guide'
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Cloud SQL Protection Guide
            </button>
          </div>

          <button
            type="button"
            onClick={fetchBackups}
            disabled={isLoading}
            className="p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
            title="Refresh backups list"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: BACKUPS LIST & CREATE */}
          {activeTab === 'backups' && (
            <div className="space-y-6">
              {/* Monthly Policy Banner */}
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-emerald-900">
                      Automatic Monthly Backup Policy Enforced
                    </h3>
                    <p className="text-xs text-emerald-800/80 leading-relaxed mt-0.5">
                      The database server automatically snapshots all tables (logs, templates, categories, and tags) at least once every calendar month. You can also create manual point-in-time snapshots anytime.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTriggerMonthlyCheck}
                  disabled={isLoading}
                  className="shrink-0 px-3 py-1.5 bg-white hover:bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-lg text-xs font-medium transition-colors shadow-2xs flex items-center gap-1.5"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  Verify Schedule
                </button>
              </div>

              {/* Create Snapshot Form */}
              <form
                onSubmit={handleCreateBackup}
                className="flex items-center gap-3 bg-gray-50 p-3.5 rounded-xl border border-gray-200"
              >
                <div className="flex-1">
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    placeholder="Custom snapshot name (optional, e.g. Pre-Q3 Reconciliation Snapshot)"
                    className="w-full px-3 py-2 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
                  />
                </div>
                <button
                  id="create-db-backup-btn"
                  type="submit"
                  disabled={isCreating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 font-medium text-xs flex items-center gap-1.5 shadow-xs transition-all shrink-0"
                >
                  {isCreating ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Snapshot...</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      <span>Create Backup Now</span>
                    </>
                  )}
                </button>
              </form>

              {/* Backups List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Stored Snapshots ({backups.length})
                  </h3>
                  <span className="text-xs text-gray-400 font-mono">
                    Stored securely in Cloud SQL
                  </span>
                </div>

                {isLoading && backups.length === 0 ? (
                  <div className="py-12 text-center text-gray-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    <p className="text-xs">Loading database backups...</p>
                  </div>
                ) : backups.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-gray-200 rounded-xl text-center space-y-2">
                    <Database className="w-8 h-8 mx-auto text-gray-300" />
                    <p className="text-sm font-semibold text-gray-700">No backups found</p>
                    <p className="text-xs text-gray-400 max-w-sm mx-auto">
                      Click "Create Backup Now" above to capture your first full production database snapshot.
                    </p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs divide-y divide-gray-100">
                    {backups.map((backup) => {
                      const isAuto = backup.backupType === 'automatic_monthly';
                      return (
                        <div
                          key={backup.id}
                          className="p-4 hover:bg-gray-50/70 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-xs text-gray-900">{backup.name}</span>
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  isAuto
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}
                              >
                                {isAuto ? 'Monthly Auto' : 'Manual'}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 font-mono">
                              <span>
                                {backup.createdAt
                                  ? new Date(backup.createdAt).toLocaleString('en-US', {
                                      month: 'short',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: 'numeric',
                                      minute: '2-digit',
                                    })
                                  : '—'}
                              </span>
                              <span>•</span>
                              <span className="text-gray-700 font-medium">
                                {backup.recordCount} total records
                              </span>
                              <span>•</span>
                              <span>{backup.fileSizeKb ? `${backup.fileSizeKb} KB` : '—'}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {/* Download JSON */}
                            <button
                              type="button"
                              disabled={downloadingKey === `json-${backup.id}`}
                              onClick={() => handleDownloadJson(backup.id, backup.name)}
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 border border-gray-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer disabled:cursor-not-allowed"
                              title="Download portable JSON backup"
                            >
                              {downloadingKey === `json-${backup.id}` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <FileJson className="w-3.5 h-3.5" />
                              )}
                              <span>JSON</span>
                            </button>

                            {/* Download SQL */}
                            <button
                              type="button"
                              disabled={downloadingKey === `sql-${backup.id}`}
                              onClick={() => handleDownloadSql(backup.id, backup.name)}
                              className="p-1.5 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-50 border border-gray-200 rounded-lg transition-colors flex items-center gap-1 text-xs font-medium cursor-pointer disabled:cursor-not-allowed"
                              title="Download SQL Insert Dump"
                            >
                              {downloadingKey === `sql-${backup.id}` ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <FileCode className="w-3.5 h-3.5" />
                              )}
                              <span>SQL</span>
                            </button>

                            {/* Restore Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedBackupForRestore(backup);
                                setShowRestoreConfirm(true);
                              }}
                              className="px-2.5 py-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                              title="Restore database from this snapshot"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => handleDeleteBackup(backup.id, backup.name)}
                              className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              title="Delete snapshot"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: EXPORT & IMPORT OFFLINE FILES */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              {/* Live Exports Section */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                    Instant Live Database Export
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Download an immediate, offline copy of the entire database in JSON or SQL format directly to your computer.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={downloadingKey === 'live-json'}
                    onClick={handleLiveExportJson}
                    className="p-4 bg-white border border-gray-200 hover:border-indigo-400 disabled:opacity-60 rounded-xl text-left transition-all hover:shadow-xs group flex items-start gap-3 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {downloadingKey === 'live-json' ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-indigo-600" />
                      ) : (
                        <FileJson className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1">
                        <span>Export as JSON</span>
                        {downloadingKey === 'live-json' ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                        ) : (
                          <Download className="w-3 h-3 text-indigo-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                        Standard JSON structured dataset of logs, categories, tags, and lookup tables.
                      </p>
                    </div>
                  </button>

                  <button
                    type="button"
                    disabled={downloadingKey === 'live-sql'}
                    onClick={handleLiveExportSql}
                    className="p-4 bg-white border border-gray-200 hover:border-indigo-400 disabled:opacity-60 rounded-xl text-left transition-all hover:shadow-xs group flex items-start gap-3 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      {downloadingKey === 'live-sql' ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-600" />
                      ) : (
                        <FileCode className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-gray-900 flex items-center gap-1">
                        <span>Export as SQL Script</span>
                        {downloadingKey === 'live-sql' ? (
                          <RefreshCw className="w-3 h-3 animate-spin text-emerald-600" />
                        ) : (
                          <Download className="w-3 h-3 text-emerald-600" />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5 leading-normal">
                        Ready-to-run PostgreSQL INSERT transactional script with all records.
                      </p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Upload & Restore JSON */}
              <div className="border border-gray-200 rounded-xl p-5 space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    Restore Database from Local File
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Upload a previously exported `.json` snapshot to recover your database state.
                  </p>
                </div>

                <input
                  ref={fileUploadRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileRestoreSelect(e.target.files[0]);
                    }
                  }}
                />

                <div
                  onClick={() => fileUploadRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-xl p-6 text-center cursor-pointer bg-gray-50/50 hover:bg-amber-50/30 transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center">
                    <UploadCloud className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-800">
                      {isUploadingRestore ? 'Restoring snapshot...' : 'Click to select JSON backup file to restore'}
                    </p>
                    <p className="text-[11px] text-gray-400">Requires a valid JSON snapshot file format</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CLOUD SQL PROTECTION GUIDE */}
          {activeTab === 'cloudsql_guide' && (
            <div className="space-y-4 text-xs text-gray-700 leading-relaxed">
              <div className="bg-indigo-50/60 border border-indigo-200 rounded-xl p-4 space-y-2">
                <div className="flex items-center gap-2 font-bold text-indigo-950 text-sm">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <span>Cloud SQL Enterprise Backup Architecture</span>
                </div>
                <p className="text-indigo-900/80">
                  Your application leverages a dual-layer backup architecture for enterprise-grade data protection:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border border-gray-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Layer 1: In-App Monthly & On-Demand Snapshots
                  </div>
                  <p className="text-gray-600 text-xs">
                    Automated calendar month snapshots and on-demand JSON/SQL dumps. Provides instant table-level rollback and portable export across any platform.
                  </p>
                </div>

                <div className="border border-gray-200 rounded-xl p-4 space-y-2 bg-white">
                  <div className="font-bold text-gray-900 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Layer 2: Google Cloud SQL Automated Backups
                  </div>
                  <p className="text-gray-600 text-xs">
                    In the Google Cloud Console (Cloud SQL instance), automatic daily snapshots with transaction log archiving (Point-In-Time-Recovery / PITR) can be enabled to restore down to the exact second.
                  </p>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-2">
                <h4 className="font-bold text-gray-900">How to configure native GCP Cloud SQL Automated Backups:</h4>
                <ol className="list-decimal list-inside space-y-1 text-gray-600 text-[11px]">
                  <li>Open Google Cloud Console → <strong>SQL</strong></li>
                  <li>Select your PostgreSQL instance</li>
                  <li>Navigate to <strong>Configuration</strong> → <strong>Backups</strong></li>
                  <li>Ensure <strong>Automated Backups</strong> (Daily) and <strong>Point-in-time recovery</strong> are checked</li>
                  <li>Set retention days (e.g. 7 to 30 days) and click Save</li>
                </ol>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
          <div className="text-xs text-gray-500 font-mono">
            {backups.length} snapshot{backups.length === 1 ? '' : 's'} recorded
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Confirmation Dialog for Database Restore */}
      {showRestoreConfirm && selectedBackupForRestore && (
        <div className="fixed inset-0 z-60 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl border border-amber-200 w-full max-w-md p-6 space-y-4 animate-in zoom-in-95 duration-100">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-gray-900">Restore Database Snapshot?</h3>
              <p className="text-xs text-gray-500">
                You are about to restore the database to the state captured in:
              </p>
              <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs font-semibold text-amber-900 mt-2">
                "{selectedBackupForRestore.name}"
                <div className="text-[11px] font-normal text-amber-800 mt-0.5">
                  Contains {selectedBackupForRestore.recordCount} total records
                </div>
              </div>
            </div>

            <p className="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-100">
              ⚠️ Warning: Restoring will overwrite current database records with the snapshot data. This operation cannot be undone unless you created a snapshot of the current state.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRestoreConfirm(false);
                  setSelectedBackupForRestore(null);
                }}
                className="px-4 py-2 text-xs font-medium text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isRestoring}
                onClick={executeRestore}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium text-xs flex items-center gap-1.5 shadow-xs"
              >
                {isRestoring ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Restoring Data...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Confirm Restore</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
