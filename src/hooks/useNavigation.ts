/**
 * Navigation Hook
 * 
 * Provides a unified navigation interface that supports both:
 * - Path-based navigation (React Router)
 * - View-based navigation (legacy VIEWS constants)
 * 
 * This maintains backward compatibility during the migration.
 */

import { useNavigate, useLocation } from 'react-router-dom';
import { useCallback, useMemo } from 'react';
import { viewToPath, pathToView, getSectionFromPath } from '../routing/routeViewMapping';
import { VIEWS } from '../constants';

export interface NavigationHelpers {
  /**
   * Navigate using a VIEWS constant (legacy)
   */
  navigateByView: (view: string) => void;
  
  /**
   * Navigate using a path
   */
  navigateByPath: (path: string) => void;
  
  /**
   * Get current view from path
   */
  getCurrentView: () => string;
  
  /**
   * Get current section
   */
  getCurrentSection: () => string | null;
  
  /**
   * Check if currently in a specific section
   */
  isInSection: (sectionId: string) => boolean;
  
  /**
   * Go back in history
   */
  goBack: () => void;
  
  /**
   * Replace current entry in history
   */
  replace: (pathOrView: string, isView?: boolean) => void;
}

/**
 * Hook for unified navigation
 * Supports both path-based and view-based navigation
 */
export function useNavigation(): NavigationHelpers {
  const navigate = useNavigate();
  const location = useLocation();

  const navigateByView = useCallback((view: string) => {
    const path = viewToPath(view);
    console.log('[useNavigation] Navigating by view:', view, '→', path);
    navigate(path);
  }, [navigate]);

  const navigateByPath = useCallback((path: string) => {
    console.log('[useNavigation] Navigating by path:', path);
    navigate(path);
  }, [navigate]);

  const getCurrentView = useCallback(() => {
    const view = pathToView(location.pathname);
    return view || VIEWS.DASHBOARD;
  }, [location.pathname]);

  const getCurrentSection = useCallback(() => {
    return getSectionFromPath(location.pathname);
  }, [location.pathname]);

  const isInSection = useCallback((sectionId: string) => {
    return getCurrentSection() === sectionId;
  }, [getCurrentSection]);

  const goBack = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  const replace = useCallback((pathOrView: string, isView = false) => {
    const path = isView ? viewToPath(pathOrView) : pathOrView;
    navigate(path, { replace: true });
  }, [navigate]);

  return useMemo(() => ({
    navigateByView,
    navigateByPath,
    getCurrentView,
    getCurrentSection,
    isInSection,
    goBack,
    replace,
  }), [navigateByView, navigateByPath, getCurrentView, getCurrentSection, isInSection, goBack, replace]);
}

/**
 * Compatibility wrapper for existing setCurrentView pattern
 * This allows gradual migration by providing a drop-in replacement
 */
export function useViewNavigation() {
  const { navigateByView, getCurrentView } = useNavigation();
  
  return {
    currentView: getCurrentView(),
    setCurrentView: navigateByView,
  };
}
