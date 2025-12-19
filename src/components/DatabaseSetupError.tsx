
import React, { useState } from 'react';
import DATABASE_SCHEMA from '../databaseSchema'; 
import { requireSupabaseClient } from '../services/supabaseClient';

interface DatabaseSetupErrorProps {
  error: string;
  onLogout: () => void;
}

const DatabaseSetupError: React.FC<DatabaseSetupErrorProps> = ({ error, onLogout }) => {
  const [showSchema, setShowSchema] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [fixStatus, setFixStatus] = useState<'idle' | 'fixing' | 'success' | 'error'>('idle');

  const handleCopySchema = async () => {
    try {
      await navigator.clipboard.writeText(DATABASE_SCHEMA);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy schema: ', err);
      alert('Failed to copy schema to clipboard. Please copy it manually.');
    }
  };

  const handleAttemptFix = async () => {
      setFixStatus('fixing');
      try {
          const supa = requireSupabaseClient();
          const { error } = await supa.rpc('reload_schema_cache');
          if (error) throw error;
          setFixStatus('success');
          // Give it a moment to propagate then reload
          setTimeout(() => window.location.reload(), 1500);
      } catch (e) {
          console.error("Auto-fix failed:", e);
          setFixStatus('error');
      }
  };

  const isMvError = error.includes("mv_public_teacher_leaderboard_current_week") && (error.includes("42809") || error.includes("is not a view"));
  const isRlsError = error.includes("42809") && error.includes("ENABLE ROW SECURITY");

  return (
    <div className="min-h-screen bg-red-50 flex flex-col justify-center items-center p-4 text-center">
      <div className="w-full max-w-3xl bg-white p-8 rounded-lg shadow-lg border border-red-200">
        <h1 className="text-3xl font-bold text-red-800">🛡️ Critical Application Error</h1>
        <p className="mt-4 text-md text-red-700">
          School Guardian 360 could not start due to a database configuration issue. This usually means the database tables have not been created yet or the schema is outdated.
        </p>
        <div className="mt-6 p-4 bg-red-100 border border-red-300 rounded-md text-left">
          <p className="font-semibold text-red-900">Technical Details:</p>
          <p className="font-mono text-sm text-red-900 mt-2">{error}</p>
          
          {/* Schema Cache Error Block */}
          {error.includes("querying schema") && (
            <div className="mt-3 pt-3 border-t border-red-200">
              <p className="text-sm font-bold text-red-800">Tip: API Schema Cache Issue</p>
              <p className="text-sm text-red-800">This specific error means the database API cache is stale.</p>
              <button 
                onClick={handleAttemptFix} 
                disabled={fixStatus === 'fixing'}
                className="mt-2 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {fixStatus === 'fixing' ? 'Applying Fix...' : fixStatus === 'success' ? 'Fixed! Reloading...' : 'Attempt Auto-Fix'}
              </button>
              {fixStatus === 'error' && <p className="text-xs text-red-600 mt-1">Auto-fix failed. Please copy and run the schema manually below.</p>}
            </div>
          )}

          {/* Materialized View Type Error Block */}
          {isMvError && (
            <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-sm font-bold text-red-800">⚠️ View Type Conflict Detected</p>
                <p className="text-sm text-red-800">
                    The database has <code>mv_public_teacher_leaderboard_current_week</code> defined as a different object type than expected. 
                    This is a known schema update.
                </p>
                <p className="text-sm font-bold mt-2 text-blue-700">Resolution:</p>
                <p className="text-sm text-blue-800">Please click <strong>"Show Required SQL Schema"</strong> below, copy the code, and run it in your Supabase SQL Editor. This updated script includes commands to safely drop and recreate the view.</p>
            </div>
          )}
          
           {/* RLS on View Error Block */}
          {isRlsError && (
            <div className="mt-3 pt-3 border-t border-red-200">
                <p className="text-sm font-bold text-red-800">⚠️ View Security Policy Error</p>
                <p className="text-sm text-red-800">
                    The database script attempted to apply Row Level Security to a View, which is not supported in PostgreSQL.
                </p>
                <p className="text-sm font-bold mt-2 text-blue-700">Resolution:</p>
                <p className="text-sm text-blue-800">The schema script has been updated to prevent this error. Please copy the schema below and run it again in your SQL Editor.</p>
            </div>
          )}
          
          <div className="mt-3 pt-3 border-t border-red-200">
              <p className="text-sm font-bold text-red-800">Missing Data (Classes, Subjects)?</p>
              <p className="text-sm text-red-800">If you are logged in but dropdowns for Classes, Subjects, or Arms are empty, it is likely due to missing security policies. Please <strong>Copy the Schema</strong> below and run it again in Supabase SQL Editor to apply the latest fixes.</p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <button
            onClick={onLogout}
            className="px-6 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700"
          >
            Logout & Retry
          </button>
          <button
            onClick={() => setShowSchema(!showSchema)}
            className="px-6 py-2 bg-slate-200 text-slate-800 font-semibold rounded-lg hover:bg-slate-300"
          >
            {showSchema ? 'Hide' : 'Show'} Required SQL Schema
          </button>
        </div>

        {showSchema && (
          <div className="mt-6 text-left animate-fade-in space-y-4">
            <div>
                <h3 className="font-semibold text-slate-800">Step 1: Run the Schema Script</h3>
                <div className="flex justify-between items-center mb-2">
                  <p className="text-sm text-slate-600">Copy this entire script and run it in your Supabase project's SQL Editor.</p>
                  <button
                    onClick={handleCopySchema}
                    className={`px-4 py-1 text-sm font-semibold rounded-md transition-colors ${
                      copySuccess
                        ? 'bg-green-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {copySuccess ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
                <pre className="bg-slate-900 text-white p-4 rounded-md max-h-[40vh] overflow-auto text-xs">
                  <code>
                    {DATABASE_SCHEMA}
                  </code>
                </pre>
            </div>
            
            <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-r-lg">
                <h3 className="font-semibold text-slate-800">Step 2: Create Your Admin Account</h3>
                <p className="text-sm text-slate-700 mt-2">After the script finishes, <strong className="text-blue-700">refresh this page</strong>. You will be taken to the login screen where you can create your first account.</p>
                <ul className="mt-2 text-sm list-disc list-inside text-slate-600 bg-white p-3 rounded-md">
                    <li>The very <strong className="text-slate-800">first account created will automatically be the System Administrator</strong>.</li>
                    <li>Use the default <strong>Secret School Code</strong> to sign up: <code>UPSS-SECRET-2025</code></li>
                    <li>You can change this code later in the application settings.</li>
                </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default DatabaseSetupError;
