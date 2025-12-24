/**
 * Campus Scope Toggle Component
 * Allows admin users to switch between campus and sitewide view
 */

import React from 'react';
import { useCampusScope } from '../contexts/CampusScopeContext';

interface CampusScopeToggleProps {
  className?: string;
}

const CampusScopeToggle: React.FC<CampusScopeToggleProps> = ({ className = '' }) => {
  const { scope, toggleScope, isSitewideView } = useCampusScope();

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
        {isSitewideView ? 'Sitewide' : 'Campus'}
      </span>
      <button
        onClick={toggleScope}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full
          transition-colors duration-200 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          ${isSitewideView 
            ? 'bg-blue-600' 
            : 'bg-slate-300 dark:bg-slate-600'
          }
        `}
        role="switch"
        aria-checked={isSitewideView}
        aria-label={`Switch to ${isSitewideView ? 'campus' : 'sitewide'} view`}
        title={`Currently viewing ${isSitewideView ? 'all campuses' : 'your campus'}. Click to switch.`}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white shadow-lg
            transition-transform duration-200 ease-in-out
            ${isSitewideView ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      <span className="text-xs text-slate-500 dark:text-slate-500">
        {isSitewideView ? '🌐' : '🏫'}
      </span>
    </div>
  );
};

export default CampusScopeToggle;
