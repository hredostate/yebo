import React from 'react';

const iconClass =
  'flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-200/70 text-[10px] font-semibold text-slate-600 dark:bg-slate-800/70 dark:text-slate-200';

const MenuIcon = () => <div className={iconClass}>M</div>;
const CollapseIcon = () => <div className={iconClass}>SB</div>;
const SunMoonIcon = () => <div className={iconClass}>DM</div>;

export interface TopbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const Topbar: React.FC<TopbarProps> = ({
  collapsed,
  onToggleCollapsed,
  onOpenMobile,
  isDarkMode,
  onToggleTheme,
}) => {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/70 p-4 shadow-[0_1px_0_#0f172a0a,0_12px_40px_#0f172a10] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/45">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenMobile}
            className="rounded-2xl p-1.5 text-slate-700 transition hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/60 lg:hidden"
            aria-label="Open sidebar"
          >
            <MenuIcon />
          </button>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="hidden rounded-2xl p-1.5 text-slate-700 transition hover:bg-slate-100/80 dark:text-slate-200 dark:hover:bg-slate-800/60 lg:flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CollapseIcon />
          </button>
        </div>

        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <input
              type="search"
              placeholder="Search Guardian 360"
              className="w-full rounded-2xl border border-slate-200/70 bg-white/80 px-4 py-2.5 text-sm text-slate-700 shadow-sm shadow-slate-100/60 transition focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:border-slate-800/70 dark:bg-slate-950/60 dark:text-slate-200 dark:focus:border-indigo-500/60 dark:focus:ring-indigo-500/20"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="flex items-center gap-2 rounded-2xl border border-slate-200/60 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100/80 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800/60"
            aria-label="Toggle dark mode"
          >
            <SunMoonIcon />
            <span className="hidden sm:inline">{isDarkMode ? 'Dark' : 'Light'}</span>
          </button>

          <div className="relative">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200/60 bg-white/70 text-xs font-semibold text-slate-600 shadow-sm shadow-slate-100/60 dark:border-slate-800/60 dark:bg-slate-900/40 dark:text-slate-200">
              N
            </div>
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-semibold text-white">
              3
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Topbar;
