
import React, { useState } from "react";
import { requireSupabaseClient } from '../services/supabaseClient';
import { Aurora, GridBackdrop } from './common/Background';
import { ShieldIcon, SunIcon, MoonIcon } from './common/icons';
import Spinner from './common/Spinner';
import { SCHOOL_LOGO_URL } from '../constants';
import { createSession, isDeviceLimitReached, terminateOldestSession } from '../services/sessionManager';
import DeviceLimitModal from './DeviceLimitModal';

type AuthViewMode = 'login' | 'forgot_password';
type AuthView = 'landing' | 'teacher-login' | 'student-login' | 'parent-login' | 'public-ratings';

interface ParentLoginPageProps {
  onNavigate: (view: AuthView) => void;
  isDarkMode?: boolean;
  toggleTheme?: () => void;
}

const Brand = () => (
  <a href="#" className="group inline-flex items-center gap-3">
    <img src={SCHOOL_LOGO_URL} alt="Logo" className="h-10 w-10 object-contain" />
    <span className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">School Guardian 360</span>
  </a>
);

const ThemeNote = () => (
  <div className="hidden items-center gap-2 rounded-full border border-slate-200/60 bg-white/60 px-3 py-1.5 text-xs text-slate-600 backdrop-blur md:flex dark:border-slate-800/60 dark:bg-slate-900/50 dark:text-slate-300">
    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-green-500" />
    Secure Parent Portal
  </div>
);

export default function ParentLoginPage({ onNavigate, isDarkMode, toggleTheme }: ParentLoginPageProps) {
  const [authView, setAuthView] = useState<AuthViewMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showDeviceLimitModal, setShowDeviceLimitModal] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const supabase = requireSupabaseClient();
      if (authView === 'login') {
        // Convert username to email format for authentication
        // If username doesn't contain @, append @upsshub.com
        const loginEmail = username.includes('@') ? username : `${username.toLowerCase()}@upsshub.com`;
        
        // Cast supabase.auth to any to bypass potential type definition mismatches
        const { data, error } = await (supabase.auth as any).signInWithPassword({ email: loginEmail, password });
        if (error) throw error;
        
        // Check device limit before allowing login
        if (data?.user) {
          const { limitReached, currentCount } = await isDeviceLimitReached(data.user.id);
          
          if (limitReached) {
            // Show device limit modal
            setPendingUserId(data.user.id);
            setShowDeviceLimitModal(true);
            // Log the user out temporarily
            await supabase.auth.signOut();
            setLoading(false);
            return;
          }
          
          // Create session for this device
          const sessionResult = await createSession(data.user.id);
          if (!sessionResult.success) {
            console.warn('Failed to create session:', sessionResult.error);
            // Continue anyway - session tracking is not critical for login
          }
        }
        // Navigation will be handled by App.tsx after profile loads
      } else if (authView === 'forgot_password') {
        // For forgot password functionality - not typically used for parents but available
        const email = username.includes('@') ? username : `${username.toLowerCase()}@upsshub.com`;
        const { error } = await supabase.auth.resetPasswordForEmail(email);
        if (error) throw error;
        setMessage('Password reset instructions sent to your email.');
        setAuthView('login');
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceLimitContinue = async () => {
    if (!pendingUserId) return;
    
    try {
      setLoading(true);
      const result = await terminateOldestSession(pendingUserId);
      
      if (result.success) {
        // Try to log in again
        const supabase = requireSupabaseClient();
        const loginEmail = username.includes('@') ? username : `${username.toLowerCase()}@upsshub.com`;
        const { data, error } = await (supabase.auth as any).signInWithPassword({ 
          email: loginEmail, 
          password 
        });
        
        if (error) throw error;
        
        if (data?.user) {
          const sessionResult = await createSession(data.user.id);
          if (!sessionResult.success) {
            console.warn('Failed to create session:', sessionResult.error);
          }
        }
        
        setShowDeviceLimitModal(false);
        setPendingUserId(null);
      } else {
        throw new Error(result.error || 'Failed to terminate oldest session');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to continue login');
      setShowDeviceLimitModal(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950 text-slate-900 dark:text-slate-100 antialiased overflow-x-hidden flex flex-col">
      <div className="fixed inset-0 z-0 pointer-events-none">
        <GridBackdrop />
        <Aurora />
      </div>

      <header className="relative z-50 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
        <Brand />
        <div className="flex items-center gap-4">
          {toggleTheme && (
            <button onClick={toggleTheme} className="p-2 rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors">
              {isDarkMode ? <SunIcon className="w-5 h-5" /> : <MoonIcon className="w-5 h-5" />}
            </button>
          )}
          <ThemeNote />
        </div>
      </header>

      <main className="relative z-40 mx-auto w-full max-w-md px-6 py-10 md:py-16 flex-grow flex flex-col justify-center">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-8 shadow-sm md:p-10 dark:border-slate-800/60 dark:bg-slate-900/40 backdrop-blur-md">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {authView === 'login' ? 'Parent Portal' : 'Reset Password'}
            </h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {authView === 'login' 
                ? 'Access your children\'s reports, attendance, and more' 
                : 'Enter your username to receive password reset instructions'}
            </p>
          </div>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 rounded-lg bg-green-50 dark:bg-green-900/20 p-3 text-sm text-green-700 dark:text-green-300">
              {message}
            </div>
          )}

          <form onSubmit={handleAuthAction} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
                placeholder="Enter your username"
                required
                disabled={loading}
              />
            </div>

            {authView === 'login' && (
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent transition-all"
                    placeholder="Enter your password"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                    disabled={loading}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Spinner size="sm" />
                  <span>Please wait...</span>
                </>
              ) : (
                authView === 'login' ? 'Sign In' : 'Send Reset Instructions'
              )}
            </button>
          </form>

          {authView === 'login' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setAuthView('forgot_password')}
                className="text-sm text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                disabled={loading}
              >
                Forgot password?
              </button>
            </div>
          )}

          {authView === 'forgot_password' && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={() => setAuthView('login')}
                className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                disabled={loading}
              >
                ← Back to login
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700 text-center">
            <button
              type="button"
              onClick={() => onNavigate('landing')}
              className="text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
            >
              ← Back to portal selection
            </button>
          </div>
        </div>
      </main>

      <footer className="relative z-40 mx-auto w-full max-w-7xl px-6 pb-10 text-center text-xs text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} School Guardian 360. All rights reserved.
      </footer>

      {showDeviceLimitModal && (
        <DeviceLimitModal
          onContinue={handleDeviceLimitContinue}
          onCancel={() => {
            setShowDeviceLimitModal(false);
            setPendingUserId(null);
          }}
        />
      )}
    </div>
  );
}
