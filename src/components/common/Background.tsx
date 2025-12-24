import React from 'react';

export function Aurora() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden opacity-60">
      <div className="absolute left-1/2 top-[6%] h-72 w-72 -translate-x-1/2 rounded-full bg-blue-200/30 blur-[120px] dark:bg-blue-500/15" />
      <div className="absolute right-[5%] top-[35%] h-80 w-80 rounded-full bg-emerald-200/25 blur-[100px] dark:bg-sky-400/15" />
      <div className="absolute left-[2%] bottom-[10%] h-64 w-64 rounded-full bg-violet-200/25 blur-[100px] dark:bg-indigo-400/10" />
    </div>
  );
}

export function GridBackdrop() {
  return (
    <svg aria-hidden className="absolute inset-0 -z-20 h-full w-full opacity-[0.08] dark:opacity-[0.1]">
      <defs>
        <pattern id="app-grid" width="32" height="32" patternUnits="userSpaceOnUse">
          <path d="M32 0H0V32" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-300 dark:text-slate-700" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#app-grid)" />
    </svg>
  );
}
