/**
 * Campus Scope Context
 * Manages whether users are viewing data for their assigned campus only or sitewide
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type CampusScope = 'campus' | 'sitewide';

interface CampusScopeContextValue {
  scope: CampusScope;
  setScope: (scope: CampusScope) => void;
  toggleScope: () => void;
  isSitewideView: boolean;
}

const CampusScopeContext = createContext<CampusScopeContextValue | undefined>(undefined);

interface CampusScopeProviderProps {
  children: React.ReactNode;
  canViewSitewide: boolean;
}

export const CampusScopeProvider: React.FC<CampusScopeProviderProps> = ({ 
  children, 
  canViewSitewide 
}) => {
  // Default to campus view, stored in session storage for persistence during session
  const [scope, setScopeState] = useState<CampusScope>(() => {
    if (!canViewSitewide) return 'campus';
    
    const stored = sessionStorage.getItem('campus-scope');
    return (stored === 'sitewide' || stored === 'campus') ? stored : 'campus';
  });

  // If user loses sitewide permission, force back to campus view
  useEffect(() => {
    if (!canViewSitewide && scope === 'sitewide') {
      setScopeState('campus');
      sessionStorage.setItem('campus-scope', 'campus');
    }
  }, [canViewSitewide, scope]);

  const setScope = useCallback((newScope: CampusScope) => {
    if (!canViewSitewide && newScope === 'sitewide') {
      console.warn('Cannot set sitewide scope without permission');
      return;
    }
    setScopeState(newScope);
    sessionStorage.setItem('campus-scope', newScope);
  }, [canViewSitewide]);

  const toggleScope = useCallback(() => {
    if (!canViewSitewide) return;
    setScope(scope === 'campus' ? 'sitewide' : 'campus');
  }, [scope, setScope, canViewSitewide]);

  const value: CampusScopeContextValue = {
    scope,
    setScope,
    toggleScope,
    isSitewideView: scope === 'sitewide',
  };

  return (
    <CampusScopeContext.Provider value={value}>
      {children}
    </CampusScopeContext.Provider>
  );
};

/**
 * Hook to access campus scope state
 */
export const useCampusScope = (): CampusScopeContextValue => {
  const context = useContext(CampusScopeContext);
  if (context === undefined) {
    throw new Error('useCampusScope must be used within a CampusScopeProvider');
  }
  return context;
};
