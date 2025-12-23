/**
 * CompatibleRouter Component
 * 
 * Bridges legacy hash-based navigation with React Router v6
 * Maintains backward compatibility during incremental migration
 */

import React, { useEffect } from 'react';
import { HashRouter, useLocation, useNavigate } from 'react-router-dom';
import RouterConfig from './routes';
import { pathToView, viewToPath, hashToPath } from './routeViewMapping';
import { VIEWS } from '../constants';

interface CompatibleRouterProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  data: any;
  actions: any;
  userPermissions: string[];
}

/**
 * Internal component that syncs React Router location with currentView state
 */
const LocationSync: React.FC<{
  currentView: string;
  setCurrentView: (view: string) => void;
}> = ({ currentView, setCurrentView }) => {
  const location = useLocation();
  const navigate = useNavigate();

  // Sync location changes to currentView state
  useEffect(() => {
    const view = pathToView(location.pathname);
    if (view && view !== currentView) {
      console.log('[CompatibleRouter] Location changed, updating currentView:', location.pathname, '→', view);
      setCurrentView(view);
    }
  }, [location.pathname]);

  // Sync currentView changes to location (for backward compatibility)
  useEffect(() => {
    const path = viewToPath(currentView);
    if (path && path !== location.pathname) {
      console.log('[CompatibleRouter] currentView changed, navigating to:', currentView, '→', path);
      navigate(path, { replace: true });
    }
  }, [currentView]);

  return null;
};

/**
 * CompatibleRouter wraps the app with HashRouter and provides bi-directional sync
 * between legacy currentView state and React Router location
 */
export const CompatibleRouter: React.FC<CompatibleRouterProps> = ({
  currentView,
  setCurrentView,
  data,
  actions,
  userPermissions,
}) => {
  return (
    <HashRouter>
      <LocationSync currentView={currentView} setCurrentView={setCurrentView} />
      <RouterConfig
        currentView={currentView}
        data={data}
        actions={actions}
        userPermissions={userPermissions}
      />
    </HashRouter>
  );
};

export default CompatibleRouter;
