import { cn } from '@/lib/utils';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon?: LucideIcon;
  prefix?: string;
  suffix?: string;
}

export default function MetricCard({ title, value, change, icon: Icon, prefix, suffix }: MetricCardProps) {
  return (
    <div className="bento-card-static p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-bold text-[--exec-text-muted] uppercase tracking-wider">{title}</p>
        {Icon && <Icon className="w-5 h-5 text-[--exec-text-muted]" />}
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-[--exec-text]" style={{ fontFamily: 'var(--font-display)' }}>
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
        {change !== undefined && change !== null && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
            change >= 0
              ? "text-[--exec-sage] bg-[--exec-sage-bg]"
              : "text-[--exec-danger] bg-[--exec-danger-bg]"
          )}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}
