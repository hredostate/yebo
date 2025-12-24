/**
 * SidebarLink Component
 * 
 * Uses React Router NavLink for navigation with active state support
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { isNewNavigationEnabled } from '../../routing/featureFlags';
import { viewToPath } from '../../routing/routeViewMapping';

interface SidebarLinkProps {
  viewId: string;
  onNavigate: (viewId: string) => void;
  onClick?: () => void;
  className?: string;
  activeClassName?: string;
  children: React.ReactNode;
}

/**
 * Smart link component that uses React Router NavLink with active state
 * Falls back to legacy navigation if feature flag is disabled (for emergency rollback)
 */
export const SidebarLink: React.FC<SidebarLinkProps> = ({
  viewId,
  onNavigate,
  onClick,
  className = '',
  activeClassName = '',
  children,
}) => {
  const useNewNav = isNewNavigationEnabled();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      onClick();
    }
    
    // Only call onNavigate for legacy navigation mode
    // In new navigation mode, React Router and LocationSync handle the sync
    if (!useNewNav) {
      onNavigate(viewId);
    }
  };

  if (useNewNav) {
    const path = viewToPath(viewId);
    return (
      <NavLink
        to={path}
        onClick={handleClick}
        className={({ isActive }) => 
          `${className} ${isActive ? activeClassName : ''}`
        }
      >
        {children}
      </NavLink>
    );
  }

  // Legacy navigation (emergency fallback)
  const legacyHandleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    }
    onNavigate(viewId);
  };

  return (
    <a
      href="#"
      onClick={legacyHandleClick}
      className={className}
    >
      {children}
    </a>
  );
};

export default SidebarLink;
