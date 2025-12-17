import React, { useMemo, useState } from 'react';
import Spinner from './common/Spinner';
import { activateAccountWithToken } from '../services/activationLinks';

const ActivationPage: React.FC = () => {
  const searchParams = useMemo(() => new URLSearchParams(window.location.search), []);
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Activation token is missing.');
      setStatus('error');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      setStatus('error');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setStatus('error');
      return;
    }

    setStatus('submitting');
    setError('');

    try {
      const result = await activateAccountWithToken(token, password);
      if (result.success) {
        setStatus('success');
      } else {
        setError(result.error || 'Unable to activate account.');
        setStatus('error');
      }
    } catch (err: any) {
      setError(err?.message || 'Activation failed.');
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Activate your account</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-4">
          Choose a secure password to finish setting up your portal login. Activation links are one-time and expire after a short period.
        </p>

        {!token && (
          <div className="mb-4 rounded-md bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 px-3 py-2 text-sm">
            Missing activation token. Please use the link sent to you.
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">New password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
              required
              minLength={8}
            />
            <p className="text-xs text-slate-500 mt-1">Must be at least 8 characters. Do not reuse old passwords.</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
              required
              minLength={8}
            />
          </div>

          {status === 'error' && error && (
            <div className="rounded-md bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {status === 'success' && (
            <div className="rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200 px-3 py-2 text-sm">
              Password set successfully. You can now return to the login page.
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="text-xs text-slate-500">Do not share this link. It can be used only once.</div>
            <button
              type="submit"
              disabled={!token || status === 'submitting'}
              className="px-4 py-2 bg-emerald-600 text-white rounded-md font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2"
            >
              {status === 'submitting' ? <Spinner size="sm" /> : 'Activate account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ActivationPage;
