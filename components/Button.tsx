/**
 * @file Button.tsx
 * @description Reusable Button Component.
 * 
 * A styled button component that supports various visual variants 
 * (primary, secondary, ghost, danger) and a loading state.
 */

import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  isLoading?: boolean;
}

const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading = false, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "px-4 py-2 rounded-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-offset-slate-900 font-mono text-sm";
  
  const variants = {
    primary: "bg-slate-100 hover:bg-white text-slate-900 border border-transparent shadow-sm",
    secondary: "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700",
    ghost: "bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white",
    danger: "bg-red-900/20 hover:bg-red-900/40 text-red-500 border border-red-900/50"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
          PROCESSING
        </>
      ) : children}
    </button>
  );
};

export default Button;