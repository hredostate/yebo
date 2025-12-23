import React from 'react';
import Spinner from './Spinner';

/**
 * Button Component
 * 
 * Enterprise-styled button that matches the theme tokens defined in
 * src/styles/enterpriseTheme.ts. Styles are replicated here to maintain
 * the component's flexibility with className overrides.
 * 
 * For direct token usage, import { enterprise } from '@/styles/enterpriseTheme'
 * and use enterprise.btnPrimary, enterprise.btnSecondary, etc.
 */

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children: React.ReactNode;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  secondary: 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-sm focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
  danger: 'bg-red-600 hover:bg-red-700 text-white shadow-sm focus:ring-2 focus:ring-red-500 focus:ring-offset-2',
  ghost: 'text-slate-700 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs font-semibold',
  md: 'px-4 py-2.5 text-sm font-semibold',
  lg: 'px-6 py-3 text-base font-semibold',
};

const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon,
  rightIcon,
  children,
  disabled,
  className = '',
  ...props
}) => {
  return (
    <button
      disabled={disabled || isLoading}
      className={`
        inline-flex items-center justify-center gap-2 
        font-semibold rounded-lg transition-all
        disabled:opacity-50 disabled:cursor-not-allowed
        focus:outline-none
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {isLoading ? <Spinner size="sm" /> : leftIcon}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
};

export default Button;
