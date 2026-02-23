import { useMemo } from 'react';
import { format, subDays } from 'date-fns';
import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (start: string, end: string) => void;
}

const PRESETS = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '12mo', days: 365 },
];

export default function DateRangePicker({ startDate, endDate, onChange }: DateRangePickerProps) {
  const activePreset = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    if (endDate !== today) return null;
    const diffDays = Math.round((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
    return PRESETS.find(p => Math.abs(p.days - diffDays) <= 1)?.label || null;
  }, [startDate, endDate]);

  const handlePreset = (days: number) => {
    const end = format(new Date(), 'yyyy-MM-dd');
    const start = format(subDays(new Date(), days), 'yyyy-MM-dd');
    onChange(start, end);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Calendar className="w-4 h-4 text-gray-400 dark:text-slate-500" />
      <div className="flex items-center gap-1">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => handlePreset(p.days)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200",
              activePreset === p.label
                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                : "text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 ml-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => onChange(e.target.value, endDate)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg",
            "bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600",
            "text-gray-900 dark:text-white",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          )}
        />
        <span className="text-gray-400 dark:text-slate-500 text-sm">to</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => onChange(startDate, e.target.value)}
          className={cn(
            "px-3 py-1.5 text-sm rounded-lg",
            "bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600",
            "text-gray-900 dark:text-white",
            "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
          )}
        />
      </div>
    </div>
  );
}
