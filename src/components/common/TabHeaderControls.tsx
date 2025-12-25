/**
 * TabHeaderControls Component
 * 
 * Reusable tab header utility controls following the pattern:
 * More (⋯) → Expand (↗) → Close (×)
 * 
 * Props:
 * - isExpanded: boolean - current expanded state
 * - onToggleExpand: () => void - handler for expand/collapse toggle
 * - onClose?: () => void - optional handler for close button
 * - onMoreActions?: () => void - optional handler for more actions menu
 * - showMoreMenu?: boolean - whether to show the more menu button
 * - showCloseButton?: boolean - whether to show the close button
 */

import React from 'react';
import { ExpandIcon, CollapseIcon, EllipsisHorizontalIcon, CloseIcon } from './icons';

interface TabHeaderControlsProps {
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClose?: () => void;
  onMoreActions?: () => void;
  showMoreMenu?: boolean;
  showCloseButton?: boolean;
}

export const TabHeaderControls: React.FC<TabHeaderControlsProps> = ({
  isExpanded,
  onToggleExpand,
  onClose,
  onMoreActions,
  showMoreMenu = false,
  showCloseButton = false,
}) => {
  return (
    <div className="flex items-center gap-1">
      {/* More Actions Menu */}
      {showMoreMenu && onMoreActions && (
        <button
          onClick={onMoreActions}
          className="p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="More actions"
          aria-label="More actions"
        >
          <EllipsisHorizontalIcon className="w-5 h-5" />
        </button>
      )}

      {/* Expand/Collapse Toggle */}
      <button
        onClick={onToggleExpand}
        className="p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title={isExpanded ? 'Exit full screen' : 'Expand'}
        aria-label={isExpanded ? 'Exit full screen' : 'Expand'}
      >
        {isExpanded ? (
          <CollapseIcon className="w-5 h-5" />
        ) : (
          <ExpandIcon className="w-5 h-5" />
        )}
      </button>

      {/* Close Button */}
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="p-2 rounded-md text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
          title="Close"
          aria-label="Close"
        >
          <CloseIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
};

export default TabHeaderControls;
