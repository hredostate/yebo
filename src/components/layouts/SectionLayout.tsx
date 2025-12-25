/**
 * SectionLayout Component
 * 
 * Reusable layout for section-based navigation with:
 * - Section title
 * - Optional pinned items row (max 5)
 * - Pill sub-tabs navigation
 * - Expand toggle for launcher mode
 * - Content outlet
 */

import React, { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon, ExpandIcon, CollapseIcon } from '../common/icons';
import type { SectionConfig, SectionTab, PinnedItem } from '../../routing/sectionConfig';
import { filterTabsByPermissions } from '../../routing/sectionConfig';
import { enterprise } from '../../styles/enterpriseTheme';

interface SectionLayoutProps {
  config: SectionConfig;
  userPermissions: string[];
  pinnedItems?: PinnedItem[];
}

export const SectionLayout: React.FC<SectionLayoutProps> = ({
  config,
  userPermissions,
  pinnedItems = [],
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const [isExpandedMode, setIsExpandedMode] = useState(false);

  // Filter tabs by permissions
  const allTabs = filterTabsByPermissions(config.tabs, userPermissions);
  const visibleTabs = allTabs.slice(0, config.maxVisibleTabs);
  const overflowTabs = allTabs.slice(config.maxVisibleTabs);
  const showMoreDropdown = overflowTabs.length > 0;

  // Determine active tab
  const activeTab = allTabs.find(tab => location.pathname === tab.path);

  const handleTabClick = (tab: SectionTab) => {
    navigate(tab.path);
    setIsMoreOpen(false);
  };

  const handlePinnedClick = (item: PinnedItem) => {
    navigate(item.path);
  };

  // Handle Esc key to collapse expanded mode
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpandedMode) {
        setIsExpandedMode(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isExpandedMode]);

  return (
    <div className="flex flex-col h-full">
      {/* Section Header */}
      <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {config.title}
            </h1>
            <button
              onClick={() => setIsExpandedMode(!isExpandedMode)}
              className="p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={isExpandedMode ? 'Collapse' : 'Expand'}
              aria-label={isExpandedMode ? 'Collapse' : 'Expand'}
            >
              {isExpandedMode ? (
                <CollapseIcon className="w-5 h-5" />
              ) : (
                <ExpandIcon className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>

        {/* Pinned Items Row (if any) */}
        {pinnedItems.length > 0 && (
          <div className="px-6 py-2 border-t border-slate-100 dark:border-slate-700/50 bg-slate-50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex-shrink-0">
                Pinned:
              </span>
              {pinnedItems.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  onClick={() => handlePinnedClick(item)}
                  className="px-3 py-1 text-sm font-semibold text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors whitespace-nowrap flex-shrink-0 border border-indigo-200 dark:border-indigo-800"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enterprise Pill Sub-tabs Navigation */}
        <div className={enterprise.pillTabsContainer}>
          <div className="flex items-center gap-2 overflow-x-auto">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`${enterprise.pillTabBase} ${
                  activeTab?.id === tab.id
                    ? enterprise.pillTabActive
                    : enterprise.pillTabInactive
                }`}
              >
                {tab.label}
              </button>
            ))}

            {/* More Dropdown */}
            {showMoreDropdown && (
              <div className="relative">
                <button
                  onClick={() => setIsMoreOpen(!isMoreOpen)}
                  className={`${enterprise.pillTabBase} ${enterprise.pillTabInactive} flex items-center gap-1`}
                >
                  More
                  <ChevronDownIcon className={`w-4 h-4 transition-transform ${isMoreOpen ? 'rotate-180' : ''}`} />
                </button>

                {isMoreOpen && (
                  <>
                    {/* Backdrop */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsMoreOpen(false)}
                    />

                    {/* Dropdown Menu */}
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-20 py-1">
                      {overflowTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => handleTabClick(tab)}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            activeTab?.id === tab.id
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 font-semibold'
                              : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Launcher Mode */}
      {isExpandedMode && (
        <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {allTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`p-4 rounded-lg border transition-all text-left ${
                  activeTab?.id === tab.id
                    ? 'border-indigo-300 dark:border-indigo-600 bg-indigo-50 dark:bg-indigo-900/20 shadow-sm'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm'
                }`}
              >
                <div className="text-sm font-semibold text-slate-900 dark:text-white mb-1">
                  {tab.label}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {tab.id}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content Outlet */}
      <div className="flex-1 overflow-auto">
        <Outlet />
      </div>
    </div>
  );
};

export default SectionLayout;
