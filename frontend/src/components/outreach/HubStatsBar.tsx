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
}

interface HubStatsBarProps {
  stats: HubStat[];
}

/**
 * Canonical 4-card stats bar used across all Outreach Hub tabs.
 * Matches the Warm Leads visual DNA (grid-cols-4, bg-stone-800/50 cards,
 * uppercase label, text-2xl bold count).
 */
export default function HubStatsBar({ stats }: HubStatsBarProps) {
  return (
    <div className="grid grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        const accentClass = statCardAccents[stat.accent];
        return (
          <div key={stat.label} className={statCardClasses}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={cn('w-4 h-4', accentClass)} />
              <span className={statCardLabelClasses}>{stat.label}</span>
            </div>
            <p className={cn(statCardValueClasses, accentClass)}>{stat.value}</p>
          </div>
        );
      })}
    </div>
  );
}
