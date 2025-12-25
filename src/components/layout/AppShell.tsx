import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useSidebarState } from '../../hooks/useSidebarState';
import Sidebar, { SidebarUser } from './Sidebar';
import Topbar from './Topbar';

export interface AppShellProps {
  children: React.ReactNode;
  user?: SidebarUser;
  onLogout?: () => void;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  user,
  onLogout,
  isDarkMode,
  onToggleTheme,
}) => {
  const {
    collapsed,
    mobileOpen,
    toggleCollapsed,
    openMobile,
    closeMobile,
  } = useSidebarState();
  const location = useLocation();

  useEffect(() => {
    closeMobile();
  }, [location.pathname, closeMobile]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 transition-colors duration-200 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-[1400px] px-6 py-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
          <Sidebar
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            closeMobile={closeMobile}
            onLogout={onLogout}
            user={user}
          />
          <div className="min-w-0 space-y-6">
            <Topbar
              collapsed={collapsed}
              onToggleCollapsed={toggleCollapsed}
              onOpenMobile={openMobile}
              isDarkMode={isDarkMode}
              onToggleTheme={onToggleTheme}
            />
            <main className="min-w-0">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppShell;
