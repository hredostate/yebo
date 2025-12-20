import React from 'react';

interface AICommentToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  disabled?: boolean;
  showLabels?: boolean;
  className?: string;
}

/**
 * Toggle component for switching between AI-powered and offline comment generation
 */
const AICommentToggle: React.FC<AICommentToggleProps> = ({ 
  enabled, 
  onChange, 
  disabled = false,
  showLabels = true,
  className = ''
}) => {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {showLabels && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            Comment Mode:
          </span>
        </div>
      )}
      
      <button
        type="button"
        onClick={() => !disabled && onChange(!enabled)}
        disabled={disabled}
        className={`relative inline-flex items-center h-6 rounded-full w-11 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
        } ${
          enabled 
            ? 'bg-indigo-600' 
            : 'bg-slate-300 dark:bg-slate-600'
        }`}
        role="switch"
        aria-checked={enabled}
        title={enabled 
          ? 'AI Mode: Uses AI for personalized comments (requires internet)' 
          : 'Offline Mode: Uses offline comment bank (instant, no internet needed)'
        }
      >
        <span
          className={`inline-block w-4 h-4 transform transition-transform bg-white rounded-full ${
            enabled ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
      
      {showLabels && (
        <div className="flex items-center gap-2">
          {enabled ? (
            <>
              <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                AI <span className="text-xs text-slate-500 dark:text-slate-400">(online)</span>
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 text-slate-600 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
              </svg>
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Offline <span className="text-xs text-slate-500 dark:text-slate-400">(instant)</span>
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AICommentToggle;
