/**
 * SidebarLink Component
 * 
 * Wrapper component that uses React Router Link when new navigation is enabled,
 * falls back to legacy href navigation otherwise
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { isNewNavigationEnabled } from '../routing/featureFlags';
import { viewToPath } from '../routing/routeViewMapping';

interface SidebarLinkProps {
  viewId: string;
  onNavigate: (viewId: string) => void;
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

/**
 * Smart link component that adapts based on feature flags
 */
export const SidebarLink: React.FC<SidebarLinkProps> = ({
  viewId,
  onNavigate,
  onClick,
  className,
  children,
}) => {
  const useNewNav = isNewNavigationEnabled();

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    if (onClick) {
      onClick();
    }
    onNavigate(viewId);
  };

  if (useNewNav) {
    const path = viewToPath(viewId);
    return (
      <Link
        to={path}
        onClick={(e) => {
          if (onClick) {
            onClick();
          }
          // Let React Router handle navigation, but also call onNavigate for state sync
          onNavigate(viewId);
        }}
        className={className}
      >
        {children}
      </Link>
    );
  }

  // Legacy navigation
  return (
    <a
      href="#"
      onClick={handleClick}
      className={className}
    >
      {children}
    </a>
  );
};

export default SidebarLink;
