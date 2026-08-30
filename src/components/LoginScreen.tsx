import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { Lock, ShieldCheck, Database, LogIn, AlertCircle } from 'lucide-react';

export const LoginScreen: React.FC = () => {
  const { signInWithGoogle, error } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setLocalError(err.message || 'Failed to authenticate with Google.');
    } finally {
      setIsSigningIn(false);
    }
  };

  return (
    <div id="login-screen" className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-gray-900 selection:bg-gray-100 font-sans">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Brand & Security Icon */}
        <div className="mx-auto flex items-center justify-center">
          <div className="w-16 h-16 bg-black rounded-2xl flex items-center justify-center shadow-lg shadow-gray-200">
            <Lock className="w-8 h-8 text-white stroke-[1.5]" />
          </div>
        </div>

        {/* Title & Description */}
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-light tracking-tight text-gray-900">
            Cloud SQL Manager
          </h1>
          <p className="text-sm text-gray-500 max-w-sm mx-auto leading-relaxed">
            Please authenticate with your Google Account to access your personal database records and tables.
          </p>
        </div>

        {/* Security / Isolation Features */}
        <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-left text-xs space-y-2.5">
          <div className="flex items-start gap-2.5 text-gray-600">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-gray-900 font-medium">Account-Scoped Data:</strong> All logs, starter templates, tags, and categories are strictly isolated to your verified Google account.
            </span>
          </div>
          <div className="flex items-start gap-2.5 text-gray-600">
            <Database className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <span>
              <strong className="text-gray-900 font-medium">Cloud SQL PostgreSQL:</strong> Fast, enterprise-grade relational database with automatic user synchronization.
            </span>
          </div>
        </div>

        {/* Error Notification */}
        {(error || localError) && (
          <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2 text-left">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{localError || error}</span>
          </div>
        )}

        {/* Sign In Button */}
        <div className="pt-2">
          <button
            id="google-signin-btn"
            type="button"
            disabled={isSigningIn}
            onClick={handleSignIn}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 active:scale-[0.99] transition-all shadow-md shadow-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Authenticating with Google...</span>
              </>
            ) : (
              <>
                {/* Standard Google "G" icon */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.36 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.04 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.36 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </>
            )}
          </button>
        </div>

        {/* Footer info */}
        <div className="pt-4 text-xs text-gray-400">
          <span>Protected by Firebase Authentication &amp; Cloud SQL Isolation</span>
        </div>
      </div>
    </div>
  );
};
