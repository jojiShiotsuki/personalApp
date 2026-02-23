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
    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-slate-700 p-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-500 dark:text-slate-400">{title}</p>
        {Icon && <Icon className="w-5 h-5 text-gray-400 dark:text-slate-500" />}
      </div>
      <div className="flex items-end gap-2">
        <p className="text-2xl font-bold text-gray-900 dark:text-white">
          {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
        </p>
        {change !== undefined && change !== null && (
          <div className={cn(
            "flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full",
            change >= 0
              ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
              : "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/30"
          )}>
            {change >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {Math.abs(change).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}
