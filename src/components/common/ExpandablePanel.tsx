/**
 * ExpandablePanel Component
 * 
 * An expandable panel wrapper with full-screen toggle capability.
 * 
 * Props:
 * - title: string - panel title
 * - subtitle?: string - optional subtitle
 * - isExpanded: boolean - current expanded state
 * - onToggleExpand: () => void - handler for expand/collapse toggle
 * - onClose?: () => void - optional handler for close button
 * - children: React.ReactNode - panel content
 * - showOverlay?: boolean - whether to show backdrop overlay when expanded
 * - showMoreMenu?: boolean - whether to show more menu button
 * - onMoreActions?: () => void - optional handler for more actions
 * 
 * Features:
 * - Esc key handler to collapse
 * - Body scroll lock when expanded
 * - Backdrop overlay (optional)
 * - Smooth transitions
 */

import React, { useEffect } from 'react';
import TabHeaderControls from './TabHeaderControls';

interface ExpandablePanelProps {
  title: string;
  subtitle?: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose?: () => void;
  children: React.ReactNode;
  showOverlay?: boolean;
  showMoreMenu?: boolean;
  onMoreActions?: () => void;
}

export const ExpandablePanel: React.FC<ExpandablePanelProps> = ({
  title,
  subtitle,
  isExpanded,
  onToggleExpand,
  onClose,
  children,
  showOverlay = false,
  showMoreMenu = false,
  onMoreActions,
}) => {
  // Handle Esc key to collapse
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isExpanded) {
        onToggleExpand();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isExpanded, onToggleExpand]);

  // Lock body scroll when expanded
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    
    if (isExpanded) {
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      if (originalOverflow) {
        document.body.style.overflow = originalOverflow;
      } else {
        document.body.style.removeProperty('overflow');
      }
    };
  }, [isExpanded]);

  const containerClasses = isExpanded
    ? 'fixed inset-0 z-50 bg-white dark:bg-slate-900 overflow-auto'
    : 'relative bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700';

  return (
    <>
      {/* Optional backdrop overlay */}
      {isExpanded && showOverlay && (
        <div className="fixed inset-0 z-40 bg-black/20 dark:bg-black/40" />
      )}

      {/* Panel container */}
      <div className={`${containerClasses} transition-all duration-300`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
              {title}
            </h2>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {subtitle}
              </p>
            )}
          </div>
          <TabHeaderControls
            isExpanded={isExpanded}
            onToggleExpand={onToggleExpand}
            onClose={onClose}
            onMoreActions={onMoreActions}
            showMoreMenu={showMoreMenu}
            showCloseButton={!!onClose}
          />
        </div>

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </>
  );
};

export default ExpandablePanel;
