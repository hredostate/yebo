/**
 * CompatibleRouter Component
 * 
 * Bridges legacy hash-based navigation with React Router v6 BrowserRouter
 * Provides backward compatibility for legacy hash URLs by redirecting them to clean paths
 */

import React, { useEffect } from 'react';
import { BrowserRouter, useLocation, useNavigate } from 'react-router-dom';
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
 * Component that handles legacy hash URL redirects and syncs state
 */
const LegacyHashRedirect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if there's a hash in the URL (legacy format)
    const hash = window.location.hash;
    
    if (hash && hash.length > 1) {
      // Ignore auth-related hashes
      if (hash.includes('access_token=') || hash.includes('error=')) {
        console.log('[CompatibleRouter] Ignoring auth hash');
        return;
      }

      // Convert legacy hash to clean path
      const cleanPath = hashToPath(hash);
      console.log('[CompatibleRouter] Redirecting legacy hash URL:', hash, '→', cleanPath);
      
      // Remove hash from URL and navigate to clean path
      window.history.replaceState(null, '', cleanPath);
      navigate(cleanPath, { replace: true });
    }
  }, []);

  return null;
};

/**
 * Internal component that syncs React Router location with currentView state
 */
const LocationSync: React.FC<{
  currentView: string;
  setCurrentView: (view: string) => void;
}> = ({ currentView, setCurrentView }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isUpdatingRef = React.useRef(false);

  // Sync location changes to currentView state (path → view)
  useEffect(() => {
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }
    
    const view = pathToView(location.pathname);
    if (view && view !== currentView) {
      console.log('[CompatibleRouter] Location changed, updating currentView:', location.pathname, '→', view);
      isUpdatingRef.current = true;
      setCurrentView(view);
    }
  }, [location.pathname, setCurrentView]);

  // Sync currentView changes to location (view → path)
  useEffect(() => {
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }
    
    const path = viewToPath(currentView);
    if (path && path !== location.pathname) {
      console.log('[CompatibleRouter] currentView changed, navigating to:', currentView, '→', path);
      isUpdatingRef.current = true;
      navigate(path, { replace: true });
    }
  }, [currentView, navigate]);

  return null;
};

/**
 * CompatibleRouter wraps the app with BrowserRouter and provides:
 * - Clean URL paths (no hash)
 * - Legacy hash URL redirect support
 * - Bi-directional sync between legacy currentView state and React Router location
 */
export const CompatibleRouter: React.FC<CompatibleRouterProps> = ({
  currentView,
  setCurrentView,
  data,
  actions,
  userPermissions,
}) => {
  return (
    <BrowserRouter>
      <LegacyHashRedirect />
      <LocationSync currentView={currentView} setCurrentView={setCurrentView} />
      <RouterConfig
        currentView={currentView}
        data={data}
        actions={actions}
        userPermissions={userPermissions}
      />
    </BrowserRouter>
  );
};

export default CompatibleRouter;
