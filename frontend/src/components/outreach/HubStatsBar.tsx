import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  statCardClasses,
  statCardLabelClasses,
  statCardValueClasses,
  statCardAccents,
  type StatAccent,
} from '@/lib/outreachStyles';

export interface HubStat {
  icon: LucideIcon;
  label: string;
  value: number | string;
  accent: StatAccent;
  active?: boolean;
  onClick?: () => void;
}

interface HubStatsBarProps {
  stats: HubStat[];
}

// Tailwind JIT can't compile dynamic class names like `grid-cols-${n}` —
// enumerate the handful of sizes Outreach Hub actually uses.
const GRID_COLS: Record<number, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
};

/**
 * Canonical stats bar used across Outreach Hub tabs. Accepts 3-6 cards;
 * card count determines grid width. Cards can be interactive when `onClick`
 * is set — an `active` boolean applies a ring accent to signal "filter on".
 */
export default function HubStatsBar({ stats }: HubStatsBarProps) {
  const gridClass = GRID_COLS[stats.length] ?? 'grid-cols-4';
  return (
    <div className={cn('grid gap-4', gridClass)}>
      {stats.map((stat) => {
        const Icon = stat.icon;
        const accentClass = statCardAccents[stat.accent];
        const isButton = Boolean(stat.onClick);
        const className = cn(
          statCardClasses,
          isButton && 'cursor-pointer hover:bg-stone-800/60 transition-colors',
          stat.active && 'ring-2 ring-[--exec-accent]/40',
        );
        const content = (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', accentClass)} />
              <span className={statCardLabelClasses}>{stat.label}</span>
            </div>
            <p className={cn(statCardValueClasses, accentClass)}>{stat.value}</p>
          </>
        );
        if (isButton) {
          return (
            <button
              key={stat.label}
              type="button"
              onClick={stat.onClick}
              className={cn(className, 'text-left')}
            >
              {content}
            </button>
          );
        }
        return (
          <div key={stat.label} className={className}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
