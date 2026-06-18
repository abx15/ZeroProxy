import { cn } from '@/lib/utils';

interface BadgeProps {
  variant?: 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'info', children, className }: BadgeProps) {
  const variants = {
    success: 'zp-badge-success',
    warning: 'zp-badge-warning',
    error: 'zp-badge-error',
    info: 'zp-badge-info',
  };
  return (
    <span className={cn(variants[variant], className)}>
      {children}
    </span>
  );
}
