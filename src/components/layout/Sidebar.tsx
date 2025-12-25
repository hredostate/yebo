import React from 'react';
import { NavLink } from 'react-router-dom';
import { VIEWS } from '../../constants';
import { viewToPath } from '../../routing/routeViewMapping';

export const SIDEBAR_EXPANDED = 'w-[280px]';
export const SIDEBAR_COLLAPSED = 'w-[88px]';
export const SIDEBAR_WIDTH_TRANSITION = 'transition-[width] duration-200 ease-out';

const baseIconClass =
  'flex h-9 w-9 items-center justify-center rounded-2xl bg-slate-200/70 text-[10px] font-semibold text-slate-600 dark:bg-slate-800/70 dark:text-slate-200';

const LayoutDashboardIcon = () => <div className={baseIconClass}>LD</div>;
const CheckSquareIcon = () => <div className={baseIconClass}>CK</div>;
const CalendarIcon = () => <div className={baseIconClass}>CL</div>;
const UserIcon = () => <div className={baseIconClass}>US</div>;
const LogOutIcon = () => <div className={baseIconClass}>LO</div>;
const CloseIcon = () => <div className={baseIconClass}>X</div>;

const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: viewToPath(VIEWS.DASHBOARD),
    icon: LayoutDashboardIcon,
  },
  {
    label: 'My Tasks',
    href: viewToPath(VIEWS.TASK_BOARD),
    icon: CheckSquareIcon,
  },
  {
    label: 'Calendar',
    href: viewToPath(VIEWS.CALENDAR),
    icon: CalendarIcon,
  },
  {
    label: 'Profile',
    href: viewToPath(VIEWS.PROFILE),
    icon: UserIcon,
  },
];

export interface SidebarUser {
  name?: string;
  role?: string;
  avatarUrl?: string;
}

export interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  closeMobile: () => void;
  onLogout?: () => void;
  user?: SidebarUser;
}

const SidebarContent: React.FC<{
  collapsed: boolean;
  onLogout?: () => void;
  user?: SidebarUser;
  showCloseButton?: boolean;
  onClose?: () => void;
}> = ({ collapsed, onLogout, user, showCloseButton, onClose }) => {
  const displayName = user?.name || 'Guardian 360';
  const displayRole = user?.role || 'Premium Suite';
  const initials = displayName
    .split(' ')
    .map(part => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-3 px-4 pt-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500/80 to-indigo-600/90 text-lg font-semibold text-white shadow-lg shadow-indigo-500/30">
            G
          </div>
          {!collapsed && (
            <div>
              <div className="text-sm font-semibold text-slate-900 dark:text-white">
                Guardian 360
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Glass Command
              </div>
            </div>
          )}
        </div>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl p-2 text-slate-600 transition hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-slate-800/60"
            aria-label="Close sidebar"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      <div className="mt-6 flex-1 overflow-y-auto px-3">
        <nav className="space-y-1">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.label}
              to={item.href}
              title={collapsed ? item.label : undefined}
              aria-label={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                [
                  'group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm font-semibold transition',
                  collapsed ? 'justify-center px-2' : 'justify-start',
                  isActive
                    ? 'bg-indigo-50 ring-1 ring-indigo-200 text-indigo-700 dark:bg-indigo-500/10 dark:ring-indigo-500/20 dark:text-indigo-200'
                    : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-200 dark:hover:bg-slate-800/40',
                ].join(' ')
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative flex h-10 w-10 items-center justify-center">
                    <item.icon />
                    {isActive && !collapsed && (
                      <span className="absolute -left-3 h-6 w-1 rounded-full bg-indigo-600" />
                    )}
                    {isActive && collapsed && (
                      <span className="absolute -top-1 right-0 h-2 w-2 rounded-full bg-indigo-600" />
                    )}
                  </span>
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="px-4 pb-5">
        <div className="rounded-2xl bg-white/60 p-3 shadow-sm shadow-slate-200/50 backdrop-blur dark:bg-slate-900/50 dark:shadow-none">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-200 to-slate-100 text-sm font-semibold text-slate-700 dark:from-slate-800 dark:to-slate-700 dark:text-slate-100">
              {initials}
            </div>
            {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  {displayName}
                </div>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {displayRole}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onLogout}
            className={[
              'mt-3 flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100/80 dark:text-slate-300 dark:hover:bg-slate-800/60',
              collapsed ? 'justify-center px-2' : 'w-full justify-start',
            ].join(' ')}
            title={collapsed ? 'Sign out' : undefined}
            aria-label={collapsed ? 'Sign out' : undefined}
          >
            <LogOutIcon />
            {!collapsed && <span>Sign out</span>}
          </button>
        </div>
      </div>
    </div>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed,
  mobileOpen,
  closeMobile,
  onLogout,
  user,
}) => {
  const desktopWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <>
      <aside
        className={[
          'sticky top-6 hidden h-[calc(100vh-48px)] overflow-hidden rounded-3xl border border-slate-200/70 bg-white/70 shadow-[0_1px_0_#0f172a0a,0_18px_60px_#0f172a10] backdrop-blur dark:border-slate-800/70 dark:bg-slate-950/45 lg:block',
          desktopWidth,
          SIDEBAR_WIDTH_TRANSITION,
        ].join(' ')}
      >
        <SidebarContent collapsed={collapsed} onLogout={onLogout} user={user} />
      </aside>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={closeMobile}
          className={[
            'fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm transition-opacity',
            mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
          ].join(' ')}
          aria-label="Close sidebar"
        />
        <aside
          className={[
            'fixed left-4 top-4 bottom-4 z-50 overflow-hidden rounded-3xl border border-slate-200/70 bg-white/80 shadow-[0_1px_0_#0f172a0a,0_18px_60px_#0f172a10] backdrop-blur transition-transform duration-200 ease-out dark:border-slate-800/70 dark:bg-slate-950/60',
            SIDEBAR_EXPANDED,
            mobileOpen ? 'translate-x-0' : '-translate-x-[120%]',
          ].join(' ')}
        >
          <SidebarContent
            collapsed={false}
            onLogout={onLogout}
            user={user}
            showCloseButton
            onClose={closeMobile}
          />
        </aside>
      </div>
    </>
  );
};

export default Sidebar;
