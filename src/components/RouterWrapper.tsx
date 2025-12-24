/**
 * RouterWrapper Component
 * 
 * Wraps the application with BrowserRouter and provides:
 * - Clean URL paths (no hash)
 * - Legacy hash URL redirect support  
 * - Path-based navigation
 */

import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { hashToPath, pathToView, viewToPath } from '../routing/routeViewMapping';
import NotFoundPage from './NotFoundPage';

interface RouterWrapperProps {
  currentView: string;
  setCurrentView: (view: string) => void;
  children: React.ReactNode;
}

/**
 * Component that handles legacy hash URL redirects
 */
const LegacyHashRedirect: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Check if there's a hash in the URL (legacy format)
    const hash = window.location.hash;
    
    if (hash && hash.length > 1) {
      // Ignore auth-related hashes
      if (hash.includes('access_token=') || hash.includes('error=')) {
        console.log('[RouterWrapper] Ignoring auth hash');
        return;
      }

      // Convert legacy hash to clean path
      const cleanPath = hashToPath(hash);
      console.log('[RouterWrapper] Redirecting legacy hash URL:', hash, '→', cleanPath);
      
      // Remove hash from URL and navigate to clean path
      window.history.replaceState(null, '', cleanPath);
      navigate(cleanPath, { replace: true });
    }
  }, [navigate]);

  return null;
};

/**
 * Component that syncs React Router location with currentView state
 */
const LocationSync: React.FC<{
  currentView: string;
  setCurrentView: (view: string) => void;
}> = ({ currentView, setCurrentView }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const isUpdatingRef = React.useRef(false);

  // Sync location changes to currentView state (path → view)
  // This runs when the user clicks a link or uses browser back/forward
  useEffect(() => {
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }
    
    const view = pathToView(location.pathname);
    if (view && view !== currentView) {
      console.log('[RouterWrapper] Location changed, updating currentView:', location.pathname, '→', view);
      isUpdatingRef.current = true;
      setCurrentView(view);
    }
  }, [location.pathname, setCurrentView]);

  // Sync currentView changes to location (view → path)
  // This is for backward compatibility with legacy setCurrentView calls
  useEffect(() => {
    if (isUpdatingRef.current) {
      isUpdatingRef.current = false;
      return;
    }
    
    const path = viewToPath(currentView);
    if (path && path !== location.pathname) {
      console.log('[RouterWrapper] currentView changed, navigating to:', currentView, '→', path);
      isUpdatingRef.current = true;
      navigate(path, { replace: true });
    }
  }, [currentView, navigate]);

  return null;
};

/**
 * RouterWrapper provides BrowserRouter context and handles routing
 */
export const RouterWrapper: React.FC<RouterWrapperProps> = ({
  currentView,
  setCurrentView,
  children,
}) => {
  return (
    <BrowserRouter>
      <LegacyHashRedirect />
      <LocationSync currentView={currentView} setCurrentView={setCurrentView} />
      <Routes>
        {/* Main authenticated app routes - render children (which includes AppRouter) */}
        <Route path="/*" element={<>{children}</>} />
        
        {/* 404 Not Found for unknown routes */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RouterWrapper;
