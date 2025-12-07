
import React, { useState } from "react";
import { supa as supabase } from '../offline/client';
import { Aurora, GridBackdrop } from './common/Background';
import { ShieldIcon, SunIcon, MoonIcon } from './common/icons';
import Spinner from './common/Spinner';
import { SCHOOL_LOGO_URL } from '../constants';

type AuthViewMode = 'login' | 'signup' | 'forgot_password';
type AuthView = 'landing' | 'teacher-login' | 'student-login' | 'public-ratings';

interface StudentLoginPageProps {
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
    <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-indigo-500" />
    Secure Student Portal
  </div>
);

export default function StudentLoginPage({ onNavigate, isDarkMode, toggleTheme }: StudentLoginPageProps) {
  const [authView, setAuthView] = useState<AuthViewMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [secretCode, setSecretCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleAuthAction = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      if (!supabase) throw new Error("Supabase client not initialized");
      if (authView === 'login') {
        // Cast supabase.auth to any to bypass potential type definition mismatches
        const { error } = await (supabase.auth as any).signInWithPassword({ email, password });
        if (error) throw error;
        // Navigation will be handled by App.tsx after profile loads
      } else if (authView === 'signup') {
        const { data, error } = await (supabase.auth as any).signUp({
          email,
          password,
          options: {
            data: {
              name: name,
              secret_code: secretCode,
              user_type: 'student', // Hardcoded for student portal
            },
          },
        });
        if (error) throw error;
        if (data.user) {
          setMessage('Sign up successful! Please check your email to verify your account.');
          setAuthView('login');
        }
      } else if (authView === 'forgot_password') {
        const { error } = await (supabase.auth as any).resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        });
        if (error) throw error;
        setMessage('Password reset instructions have been sent to your email.');
      }
    } catch (err: any) {
      console.error('Authentication error:', err);
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };
  
  const switchView = (e: React.MouseEvent, view: AuthViewMode) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setAuthView(view);
  };

  const renderFormContent = () => {
    if (authView === 'forgot_password') {
        return (
            <>
                <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your-email@school.com" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                </label>
                <button type="submit" className="group mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 font-medium text-white shadow-lg transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/40 disabled:opacity-70" disabled={loading}>
                    {loading ? <Spinner /> : <span>Send Reset Instructions</span>}
                </button>
                 <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
                    Remembered your password?
                    <a href="#" onClick={(e) => switchView(e, 'login')} className="ml-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                        Back to Sign in
                    </a>
                </p>
            </>
        )
    }

    return (
        <>
              {authView === 'signup' && (
                <>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Full Name</span>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  </label>
                  <label className="grid gap-1">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Secret School Code</span>
                    <input type="text" required value={secretCode} onChange={(e) => setSecretCode(e.target.value)} placeholder="Provided by your school" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
                  </label>
                </>
              )}
              
              <label className="grid gap-1">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200">Email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="your-email@school.com" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              </label>

              <label className="grid gap-1">
                <span className="flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-200">
                  Password
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs font-semibold text-indigo-600 hover:underline dark:text-indigo-400">
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </span>
                <input type={showPassword ? "text" : "password"} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-slate-900 focus:border-indigo-300 focus:ring-4 focus:ring-indigo-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" />
              </label>

              {authView === 'login' && (
                <div className="flex items-center justify-between pt-1 text-sm">
                  <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-indigo-600" /> Remember me
                  </label>
                  <a href="#" onClick={(e) => switchView(e, 'forgot_password')} className="text-indigo-700 hover:underline dark:text-indigo-400">Forgot password?</a>
                </div>
              )}

              <button type="submit" className="group mt-2 inline-flex h-11 items-center justify-center rounded-xl bg-indigo-600 px-4 font-medium text-white shadow-lg transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-4 focus:ring-indigo-500/40 disabled:opacity-70" disabled={loading}>
                {loading ? (<><Spinner /> {authView === 'login' ? 'Signing in…' : 'Creating Account...'}</>) : (<span>{authView === 'login' ? 'Sign in' : 'Create Account'}</span>)}
              </button>

              <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-300">
                {authView === 'login' ? 'New here?' : 'Already have an account?'}
                <a href="#" onClick={(e) => switchView(e, authView === 'login' ? 'signup' : 'login')} className="ml-1 font-semibold text-indigo-700 hover:underline dark:text-indigo-400">
                  {authView === 'login' ? 'Create an account' : 'Sign in'}
                </a>
              </p>
        </>
    );
  }

  const getTitle = () => {
      switch(authView) {
          case 'login': return 'Secure Student Sign In';
          case 'signup': return 'Secure Student Sign Up';
          case 'forgot_password': return 'Reset Password';
      }
  }

  return (
    <div className="h-full w-full overflow-hidden bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-950">
      <GridBackdrop />
      <Aurora />

      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-5">
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

      <main className="relative z-10 mx-auto grid w-full max-w-7xl grid-cols-1 items-stretch gap-10 px-6 pb-16 pt-2 md:grid-cols-2">
        {/* Left: Key Features Summary */}
        <section className="order-2 md:order-1 flex min-h-[28rem] flex-col justify-center rounded-3xl border border-indigo-200/60 bg-indigo-50/60 p-8 backdrop-blur-xl shadow-xl dark:border-indigo-800/60 dark:bg-indigo-900/40">
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">🎓 Student Portal</h1>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Your personal hub for accessing lesson plans, tracking progress, and providing valuable feedback to your teachers.</p>

          <div className="mt-6 space-y-4 text-slate-700 dark:text-slate-200">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">🌟 Core Features</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>📚 Access your weekly lesson plans</li>
              <li>📊 Track your progress & report cards</li>
              <li>⭐ Rate your teachers & lessons</li>
              <li>✅ Complete quizzes & surveys</li>
            </ul>

            <h2 className="text-base font-semibold text-slate-900 dark:text-white">🏫 Why It Matters</h2>
            <ul className="list-disc pl-5 text-sm space-y-1">
              <li>Helps you stay organized</li>
              <li>Gives you a voice in your education</li>
              <li>Connects you with your teachers</li>
            </ul>
          </div>
        </section>

        {/* Right: Auth Form */}
        <section className="order-1 md:order-2">
          <div className="mx-auto w-full max-w-md rounded-3xl border border-slate-200/60 bg-white/70 p-6 backdrop-blur-xl shadow-2xl dark:border-slate-800/60 dark:bg-slate-900/50">
            <div className="mb-6 flex items-center gap-3">
              <img src={SCHOOL_LOGO_URL} alt="Logo" className="h-10 w-10 object-contain" />
              <div>
                <p className="text-sm uppercase tracking-wider text-slate-500 dark:text-slate-400">{getTitle()}</p>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-white">School Guardian 360</h2>
              </div>
            </div>

            <form onSubmit={handleAuthAction} className="grid gap-4">
              {error && (
                <div className={`rounded-md p-4 ${error.toLowerCase().includes('querying schema') ? 'bg-amber-50 border-l-4 border-amber-500 text-amber-700' : 'bg-red-50 border-l-4 border-red-500 text-red-700'} dark:bg-slate-800 dark:text-slate-200`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-bold text-sm">{error}</p>
                            {error.toLowerCase().includes('querying schema') && (
                                <div className="mt-3 text-xs text-amber-800 dark:text-amber-300">
                                    <p className="font-semibold mb-1">🔧 Quick Fix Required</p>
                                    <p className="mb-2">The database schema cache is stale. Please run this command in your Supabase SQL Editor:</p>
                                    <div className="flex items-center gap-2">
                                        <code className="flex-1 bg-white dark:bg-black/50 p-2 rounded border border-amber-200 dark:border-amber-800 font-mono text-[10px] select-all">
                                            NOTIFY pgrst, 'reload config';
                                        </code>
                                        <button 
                                            type="button"
                                            onClick={() => navigator.clipboard.writeText("NOTIFY pgrst, 'reload config';")}
                                            className="px-2 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded text-xs font-bold transition-colors"
                                            title="Copy to clipboard"
                                        >
                                            Copy
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
              )}
              {message && <p className="rounded-md bg-green-100 p-3 text-sm text-center text-green-700 dark:bg-green-500/20 dark:text-green-300">{message}</p>}
              {renderFormContent()}
            </form>
          </div>

          <p className="mx-auto mt-6 max-w-md text-center text-xs text-slate-500 dark:text-slate-400">
            <a href="#" onClick={(e) => { e.preventDefault(); onNavigate('landing'); }} className="font-semibold text-indigo-700 hover:underline dark:text-indigo-400">&larr; Back to portal selection</a>
          </p>
        </section>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-7xl px-6 pb-10 text-center text-xs text-slate-500 dark:text-slate-400">
        © {new Date().getFullYear()} School Guardian 360. All rights reserved.
      </footer>
    </div>
  );
}
