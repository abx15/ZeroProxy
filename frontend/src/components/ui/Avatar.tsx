import { getInitials } from '@/lib/utils';

export function Avatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
  };
  return (
    <div className={`${sizes[size]} rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-semibold shrink-0`}>
      {getInitials(name)}
    </div>
  );
}
