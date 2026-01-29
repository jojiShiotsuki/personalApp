import { getDayName, formatDateForApi, isToday, isPast } from '@/lib/dateUtils';
import { SocialContent, RepurposeFormatStatus } from '@/types';
import { Plus, Film, LayoutGrid, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number;
  content: SocialContent[];
  onDayClick: (date: Date) => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'posted':
      return { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' };
    case 'scheduled':
      return { bg: 'bg-sky-100 dark:bg-sky-900/40', text: 'text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' };
    case 'editing':
      return { bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
    case 'filmed':
      return { bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' };
    case 'scripted':
      return { bg: 'bg-rose-100 dark:bg-rose-900/40', text: 'text-rose-700 dark:text-rose-300', dot: 'bg-rose-500' };
    case 'not_started':
      return { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' };
    default:
      return { bg: 'bg-gray-100 dark:bg-gray-700/50', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' };
  }
};

const getFormatIcon = (format: string) => {
  switch (format) {
    case 'reel':
      return Film;
    case 'carousel':
      return LayoutGrid;
    case 'long_caption':
      return FileText;
    default:
      return Film;
  }
};

const getFormatStatusDot = (status: string) => {
  switch (status) {
    case 'posted':
      return 'bg-emerald-500';
    case 'scheduled':
      return 'bg-sky-500';
    case 'editing':
      return 'bg-amber-500';
    case 'filmed':
      return 'bg-purple-500';
    case 'scripted':
      return 'bg-rose-500';
    default:
      return 'bg-gray-400';
  }
};

const getReelTypeLabel = (reelType: string | null | undefined): string | null => {
  if (!reelType) return null;
  switch (reelType) {
    case 'educational':
      return 'Edu';
    case 'before_after':
      return 'B/A';
    case 'bts':
      return 'BTS';
    case 'social_proof':
      return 'Proof';
    default:
      return null;
  }
};

export default function MonthView({
  year,
  month,
  content,
  onDayClick,
}: MonthViewProps) {
  // Generate all days in the month
  const getDaysInMonth = () => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
    const days: (Date | null)[] = [];

    // Add empty slots for days before the first day of the month
    for (let i = 0; i < firstDayOfMonth; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month - 1, day));
    }

    return days;
  };

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Group content by date
  const contentByDate: Record<string, SocialContent[]> = {};
  content.forEach((item) => {
    if (!contentByDate[item.content_date]) {
      contentByDate[item.content_date] = [];
    }
    contentByDate[item.content_date].push(item);
  });

  return (
    <div className="bg-[--exec-surface] rounded-2xl border border-[--exec-border] overflow-hidden shadow-sm transition-all duration-300 hover:border-[--exec-accent]/50 hover:shadow-md">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 bg-[--exec-surface-hover] border-b border-[--exec-border]">
        {weekDays.map((day) => (
          <div
            key={day}
            className="text-center text-xs font-bold text-[--exec-text-muted] uppercase tracking-wider py-3"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7">
        {days.map((day, index) => {
          if (!day) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[120px] border-b border-r border-[--exec-border]/50 bg-[--exec-surface-hover]/30"
              />
            );
          }

          const dateStr = formatDateForApi(day);
          const dayContent = contentByDate[dateStr] || [];
          const isTodayDate = isToday(day);
          const isPastDate = isPast(day);

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(day)}
              className={cn(
                "group text-left min-h-[120px] p-3 border-b border-r border-[--exec-border]/50 transition-all duration-200 relative",
                "hover:bg-orange-500/10 hover:border-orange-500/30 hover:z-10",
                isPastDate && !isTodayDate && "bg-[--exec-surface-hover]/30"
              )}
            >
              {/* Day number */}
              <div className="flex items-start justify-between mb-2">
                <span className={cn(
                  "w-7 h-7 flex items-center justify-center text-sm font-semibold rounded-full transition-all duration-200",
                  isTodayDate
                    ? "bg-[--exec-accent] text-white shadow-md shadow-[--exec-accent]/30"
                    : isPastDate
                      ? "text-[--exec-text-muted]"
                      : "text-[--exec-text] group-hover:bg-[--exec-accent]/10 group-hover:text-[--exec-accent]"
                )}>
                  {day.getDate()}
                </span>
                {dayContent.length > 0 && (
                  <span className="text-xs font-semibold text-[--exec-text-muted] group-hover:text-[--exec-accent] transition-colors">
                    {dayContent.length}
                  </span>
                )}
              </div>

              {/* Content items */}
              {dayContent.length > 0 && (
                <div className="space-y-1">
                  {dayContent.slice(0, 2).map((item) => {
                    const config = getStatusConfig(item.status);
                    const hasRepurpose = item.repurpose_formats && item.repurpose_formats.length > 0;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-lg px-2 py-1 text-xs font-medium transition-all duration-200",
                          "hover:scale-[1.02] hover:shadow-sm",
                          config.bg, config.text
                        )}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <div className="flex items-center gap-1 min-w-0">
                            <span className="truncate">{item.title || <span className="capitalize">{item.content_type.replace('_', ' ')}</span>}</span>
                            {item.content_type === 'reel' && getReelTypeLabel(item.reel_type) && (
                              <span className="shrink-0 px-1 py-0.5 text-[10px] font-semibold rounded bg-black/10 dark:bg-white/10">
                                {getReelTypeLabel(item.reel_type)}
                              </span>
                            )}
                          </div>
                          {/* Repurpose format indicators */}
                          {hasRepurpose && (
                            <div className="flex items-center gap-0.5 shrink-0">
                              {item.repurpose_formats!.map((rf) => {
                                const FormatIcon = getFormatIcon(rf.format);
                                const dotColor = getFormatStatusDot(rf.status);
                                return (
                                  <div
                                    key={rf.format}
                                    className="relative"
                                    title={`${rf.format}: ${rf.status}`}
                                  >
                                    <FormatIcon className="w-3 h-3 opacity-60" />
                                    <div className={cn(
                                      "absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full border border-white/50",
                                      dotColor
                                    )} />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {dayContent.length > 2 && (
                    <span className="text-xs font-medium text-[--exec-text-muted] pl-2 group-hover:text-[--exec-accent] transition-colors">
                      +{dayContent.length - 2} more
                    </span>
                  )}
                </div>
              )}

              {/* Empty state hint */}
              {dayContent.length === 0 && !isPastDate && (
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-1.5 rounded-full bg-[--exec-accent]/10 text-[--exec-accent]">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 py-4 px-6 bg-[--exec-surface-hover] border-t border-[--exec-border]">
        {[
          { status: 'posted', label: 'Posted' },
          { status: 'scheduled', label: 'Scheduled' },
          { status: 'editing', label: 'Editing' },
          { status: 'filmed', label: 'Filmed' },
          { status: 'scripted', label: 'Scripted' },
        ].map(({ status, label }) => {
          const config = getStatusConfig(status);
          return (
            <div key={status} className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full transition-all duration-200",
              "hover:scale-105",
              config.bg
            )}>
              <div className={cn("w-2 h-2 rounded-full", config.dot)} />
              <span className={cn("text-xs font-medium", config.text)}>{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
