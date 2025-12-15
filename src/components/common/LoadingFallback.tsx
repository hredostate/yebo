import React from 'react';
import Spinner from './Spinner';

/**
 * LoadingFallback component for Suspense boundaries
 * Provides a full-screen semi-transparent background to prevent
 * the purple gradient body background from showing through during lazy loading.
 * 
 * The min-height calculation (100vh - 200px) accounts for the approximate combined height
 * of the header (~80px) and main padding/margins (~120px), ensuring the fallback
 * covers the main content area without extending beyond the viewport.
 */
const LoadingFallback: React.FC = () => {
  return (
    <div className="flex justify-center items-center min-h-[calc(100vh-200px)]">
      <div className="app-panel px-8 py-10 flex flex-col items-center gap-4 text-center max-w-xl mx-auto">
        <Spinner size="lg" text="Loading the experience" />
        <p className="text-sm text-slate-600 dark:text-slate-300">We’re syncing the latest data and design system so everything feels cohesive.</p>
      </div>
    </div>
  );
};

export default LoadingFallback;
