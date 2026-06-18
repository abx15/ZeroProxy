import React from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from './Spinner';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  const baseClass = {
    primary: 'zp-btn-primary',
    secondary: 'zp-btn-secondary',
    danger: 'zp-btn-danger',
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={cn(
        baseClass[variant],
        'inline-flex items-center justify-center gap-2 cursor-pointer',
        className
      )}
      {...props}
    >
      {isLoading && <Spinner size="sm" />}
      {children}
    </button>
  );
}
