/**
 * AppRouterWithNavigation Component
 * 
 * Wraps the existing AppRouter with React Router v6 navigation
 * while maintaining backward compatibility with legacy view-based navigation.
 * 
 * This component can be used as a drop-in replacement for AppRouter in App.tsx
 */

import React from 'react';
import { HashRouter } from 'react-router-dom';
import RouterConfig from '../routing/routes';

interface AppRouterWithNavigationProps {
  currentView: string;
  data: any;
  actions: any;
}

/**
 * This component wraps our new router configuration while still accepting
 * the same props as the original AppRouter for backward compatibility
 */
export const AppRouterWithNavigation: React.FC<AppRouterWithNavigationProps> = ({
  currentView,
  data,
  actions,
}) => {
  const userPermissions = data.userPermissions || [];

  return (
    <HashRouter>
      <RouterConfig
        currentView={currentView}
        data={data}
        actions={actions}
        userPermissions={userPermissions}
      />
    </HashRouter>
  );
};

export default AppRouterWithNavigation;
