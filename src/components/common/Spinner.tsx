import React from 'react';
import { SCHOOL_LOGO_URL } from '../../constants';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const sizeClasses: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'h-5 w-5',
  md: 'h-10 w-10',
  lg: 'h-20 w-20',
};

const thickness: Record<NonNullable<SpinnerProps['size']>, string> = {
  sm: 'border-[2px]',
  md: 'border-[3px]',
  lg: 'border-[4px]',
};

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', text }) => {
  const showLabel = Boolean(text) || size === 'lg';

  return (
    <div
      className={`inline-flex flex-col items-center gap-3 ${size !== 'lg' ? 'min-w-[1.75rem]' : ''} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={text || 'Loading'}
    >
      <div className={`relative ${sizeClasses[size]}`} aria-hidden>
        {/* Ambient glow */}
        <span className="absolute inset-0 rounded-full bg-gradient-to-br from-indigo-500/15 via-sky-400/15 to-transparent blur-lg animate-pulse" />

        {/* Structural ring */}
        <span className={`absolute inset-0 rounded-full ${thickness[size]} border-slate-200/70 dark:border-slate-800/70`} />

        {/* Animated ring */}
        <span
          className={`absolute inset-0 rounded-full border-transparent ${thickness[size]} border-t-indigo-500 border-r-sky-400 animate-spin`}
          style={{ animationDuration: size === 'lg' ? '1.2s' : '0.9s' }}
        />

        {/* Center cap / logo */}
        {size === 'lg' ? (
          <span className="absolute inset-[26%] rounded-full bg-white/95 dark:bg-slate-900/90 shadow-lg shadow-blue-500/10 flex items-center justify-center">
            <img
              src={SCHOOL_LOGO_URL}
              alt=""
              className="h-10 w-10 object-contain drop-shadow-sm"
              loading="lazy"
            />
          </span>
        ) : (
          <span className="absolute inset-[34%] rounded-full bg-white dark:bg-slate-900 shadow-inner" />
        )}
      </div>

      {showLabel && (
        <p className="text-xs font-medium tracking-wide text-slate-600 dark:text-slate-300 text-center">
          {text || 'Preparing your experience...'}
        </p>
      )}
      <span className="sr-only">{text || 'Loading...'}</span>
    </div>
  );
};

export default Spinner;
