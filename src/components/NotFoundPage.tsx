/**
 * NotFoundPage Component
 * 
 * Displayed when a user navigates to an unknown route
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="max-w-md w-full mx-4 text-center">
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-8 border border-slate-200 dark:border-slate-700">
          {/* 404 Icon */}
          <div className="mb-6 inline-block p-4 bg-blue-50 dark:bg-blue-900/20 rounded-full">
            <svg 
              className="w-16 h-16 text-blue-600 dark:text-blue-400" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
              />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
            Page Not Found
          </h1>

          {/* Description */}
          <p className="text-slate-600 dark:text-slate-300 mb-6">
            The page you're looking for doesn't exist or has been moved.
          </p>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/workspace/dashboard')}
              className="w-full px-6 py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/30"
            >
              Go to Dashboard
            </button>

            <button
              onClick={() => navigate(-1)}
              className="w-full px-6 py-3 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold rounded-xl hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>

        {/* Help Text */}
        <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
};

export default NotFoundPage;
