import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'accent';
  sub?: string;
}

const colorMap = {
  primary: 'bg-primary-50 text-primary',
  success: 'bg-success-50 text-success',
  warning: 'bg-amber-50 text-amber-500',
  accent: 'bg-cyan-50 text-accent',
};

export function StatsCard({ label, value, icon: Icon, color = 'primary', sub }: StatsCardProps) {
  return (
    <div className="zp-card flex items-center gap-4 hover:shadow-card-hover transition-shadow">
      <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', colorMap[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-slate-500 font-medium">{label}</p>
        <p className="text-xl font-bold text-text-main mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}
