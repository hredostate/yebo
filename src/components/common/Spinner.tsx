
import React from 'react';
import { SCHOOL_LOGO_URL } from '../../constants';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const Spinner: React.FC<SpinnerProps> = ({ size = 'md', className = '', text }) => {
  const sizeClasses = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-20 w-20',
  };

  // For large spinners, show professional loading animation
  if (size === 'lg') {
    return (
      <div className={`flex flex-col items-center justify-center gap-4 ${className}`} role="status">
        {/* Container for logo and spinning ring */}
        <div className="relative flex items-center justify-center">
          {/* Pulsing glow effect behind logo */}
          <div className="absolute inset-0 bg-blue-500/10 dark:bg-blue-400/20 rounded-full blur-xl animate-pulse" />
          
          {/* Spinning gradient ring */}
          <div 
            className="absolute inset-[-8px] rounded-full animate-spin"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #2563eb, #1d4ed8, #3b82f6)',
              // WebkitMaskComposite uses 'xor' for Safari compatibility, while standard maskComposite uses 'exclude'
              WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              WebkitMaskComposite: 'xor',
              mask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
              maskComposite: 'exclude',
              padding: '4px',
            }}
          />
          
          {/* Static logo in center */}
          <img 
            src={SCHOOL_LOGO_URL} 
            alt="Loading..." 
            className={`${sizeClasses[size]} object-contain relative z-10`}
          />
        </div>
        
        {/* Single loading text */}
        <span className="text-slate-600 dark:text-slate-300 text-sm font-medium animate-pulse">
          {text || 'Loading...'}
        </span>
        
        <span className="sr-only">{text || 'Loading...'}</span>
      </div>
    );
  }

  // Smaller sizes remain simple for inline use
  return (
    <div className={`flex items-center justify-center ${className}`} role="status">
      <img 
        src={SCHOOL_LOGO_URL} 
        alt="Loading..." 
        className={`${sizeClasses[size]} animate-pulse object-contain`}
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
};

export default Spinner;
