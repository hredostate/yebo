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

import React, { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDownIcon } from '../common/icons';
import type { SectionConfig, SectionTab, PinnedItem } from '../../routing/sectionConfig';
import { filterTabsByPermissions } from '../../routing/sectionConfig';

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

  return (
    <div className="flex flex-col h-full">
      {/* Section Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {config.title}
            </h1>
            <button
              onClick={() => setIsExpandedMode(!isExpandedMode)}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              title="Toggle expanded launcher mode"
            >
              {isExpandedMode ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>

        {/* Pinned Items Row (if any) */}
        {pinnedItems.length > 0 && (
          <div className="px-6 py-2 border-t border-gray-100 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/50">
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider flex-shrink-0">
                Pinned:
              </span>
              {pinnedItems.slice(0, 5).map(item => (
                <button
                  key={item.id}
                  onClick={() => handlePinnedClick(item)}
                  className="px-3 py-1 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors whitespace-nowrap flex-shrink-0"
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Pill Sub-tabs Navigation */}
        <div className="px-6 py-3 border-t border-gray-100 dark:border-gray-700/50">
          <div className="flex items-center gap-2 overflow-x-auto">
            {visibleTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-full transition-colors whitespace-nowrap ${
                  activeTab?.id === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                  className="px-4 py-2 text-sm font-medium rounded-full text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
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
                    <div className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 py-1">
                      {overflowTabs.map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => handleTabClick(tab)}
                          className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                            activeTab?.id === tab.id
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
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
        <div className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {allTabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => handleTabClick(tab)}
                className={`p-4 rounded-lg border transition-all text-left ${
                  activeTab?.id === tab.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                <div className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                  {tab.label}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
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
