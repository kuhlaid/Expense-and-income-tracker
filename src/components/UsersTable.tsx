import React from 'react';
import { User, ShieldCheck, Mail, Key, Calendar, Database, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.tsx';

interface UsersTableProps {
  isLoading: boolean;
}

export const UsersTable: React.FC<UsersTableProps> = ({ isLoading }) => {
  const { user } = useAuth();

  return (
    <div id="users-view-container" className="space-y-6">
      <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-gray-100">
          <div className="flex items-center gap-4">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'User Avatar'}
                className="w-14 h-14 rounded-full border border-gray-200 object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-black text-white flex items-center justify-center text-xl font-medium">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-medium text-gray-900">
                  {user?.displayName || user?.email?.split('@')[0] || 'Authenticated User'}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium text-[11px] border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Google Verified
                </span>
              </div>
              <p className="text-xs text-gray-500 font-mono mt-0.5">{user?.email}</p>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 font-mono">Auth Provider:</span>
            <div className="text-xs font-semibold text-gray-900 mt-0.5">Google OAuth 2.0</div>
          </div>
        </div>

        {/* Account Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-6 text-xs">
          <div className="p-3.5 bg-gray-50/70 border border-gray-100 rounded-lg space-y-1">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Mail className="w-3.5 h-3.5 text-gray-500" />
              <span>Email Address</span>
            </div>
            <div className="font-mono font-medium text-gray-900 truncate">{user?.email || '—'}</div>
          </div>

          <div className="p-3.5 bg-gray-50/70 border border-gray-100 rounded-lg space-y-1">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Key className="w-3.5 h-3.5 text-gray-500" />
              <span>Firebase UID</span>
            </div>
            <div className="font-mono font-medium text-gray-900 truncate" title={user?.uid}>
              {user?.uid || '—'}
            </div>
          </div>

          <div className="p-3.5 bg-gray-50/70 border border-gray-100 rounded-lg space-y-1">
            <div className="flex items-center gap-1.5 text-gray-400">
              <Database className="w-3.5 h-3.5 text-gray-500" />
              <span>Data Scope Mode</span>
            </div>
            <div className="font-medium text-emerald-700">Google Account Isolated</div>
          </div>
        </div>
      </div>

      {/* Security & Access Isolation Card */}
      <div className="bg-gray-50/60 border border-gray-100 rounded-xl p-5 text-xs text-gray-600 space-y-3">
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Security &amp; PostgreSQL User Isolation Policy</span>
        </div>
        <p className="leading-relaxed">
          Every query to <code className="font-mono text-gray-900 bg-white px-1 py-0.5 border border-gray-200 rounded">logs</code>,{' '}
          <code className="font-mono text-gray-900 bg-white px-1 py-0.5 border border-gray-200 rounded">starter_logs</code>,{' '}
          <code className="font-mono text-gray-900 bg-white px-1 py-0.5 border border-gray-200 rounded">category_type</code>, and{' '}
          <code className="font-mono text-gray-900 bg-white px-1 py-0.5 border border-gray-200 rounded">tag_type</code> is filtered server-side by your authenticated Google Account ID. Other accounts cannot view, modify, or delete your records.
        </p>
      </div>
    </div>
  );
};
