import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action
}) => {
  return (
    <div className="app-panel py-10 px-8 text-center flex flex-col items-center gap-3">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/10 to-sky-400/10 flex items-center justify-center text-indigo-500 dark:text-indigo-200">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-md">
          {description}
        </p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

export default EmptyState;
