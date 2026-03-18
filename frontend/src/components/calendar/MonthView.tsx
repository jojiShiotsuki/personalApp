import { formatDateForApi, isToday, isPast } from '@/lib/dateUtils';
import { SocialContent, RepurposeFormatStatus } from '@/types';
import { Plus, Repeat2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number;
  content: SocialContent[];
  onDayClick: (date: Date) => void;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case 'POSTED':
      return { bg: 'bg-emerald-500/15', text: 'text-emerald-400', dot: 'bg-emerald-500', border: 'border-emerald-500/30' };
    case 'SCHEDULED':
      return { bg: 'bg-sky-500/15', text: 'text-sky-400', dot: 'bg-sky-500', border: 'border-sky-500/30' };
    case 'EDITING':
      return { bg: 'bg-amber-500/15', text: 'text-amber-400', dot: 'bg-amber-500', border: 'border-amber-500/30' };
    case 'FILMED':
      return { bg: 'bg-purple-500/15', text: 'text-purple-400', dot: 'bg-purple-500', border: 'border-purple-500/30' };
    case 'SCRIPTED':
      return { bg: 'bg-rose-500/15', text: 'text-rose-400', dot: 'bg-rose-500', border: 'border-rose-500/30' };
    case 'NOT_STARTED':
      return { bg: 'bg-stone-500/10', text: 'text-stone-400', dot: 'bg-stone-500', border: 'border-stone-500/20' };
    default:
      return { bg: 'bg-stone-500/10', text: 'text-stone-400', dot: 'bg-stone-500', border: 'border-stone-500/20' };
  }
};

const getFormatStatusDot = (status: string) => {
  switch (status) {
    case 'POSTED': return 'bg-emerald-500';
    case 'SCHEDULED': return 'bg-sky-500';
    case 'EDITING': return 'bg-amber-500';
    case 'FILMED': return 'bg-purple-500';
    case 'SCRIPTED': return 'bg-rose-500';
    default: return 'bg-stone-500';
  }
};

const getReelTypeLabel = (reelType: string | null | undefined): string | null => {
  if (!reelType) return null;
  switch (reelType) {
    case 'educational': return 'Edu';
    case 'before_after': return 'B/A';
    case 'bts': return 'BTS';
    case 'social_proof': return 'Proof';
    default: return null;
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

  // Build repurpose-by-date map: formats with scheduled_date different from parent content_date
  // TODO: Cross-month limitation — repurpose formats scheduled in a different month than parent won't appear
  const repurposeByDate: Record<string, { format: RepurposeFormatStatus; parentTitle: string; parentDate: string }[]> = {};
  content.forEach((item) => {
    if (!item.repurpose_formats) return;
    item.repurpose_formats.forEach((rf) => {
      if (rf.scheduled_date && rf.scheduled_date !== item.content_date) {
        if (!repurposeByDate[rf.scheduled_date]) {
          repurposeByDate[rf.scheduled_date] = [];
        }
        repurposeByDate[rf.scheduled_date].push({
          format: rf,
          parentTitle: item.title || item.content_type.replace('_', ' '),
          parentDate: item.content_date,
        });
      }
    });
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
              {(dayContent.length > 0 || (repurposeByDate[dateStr] && repurposeByDate[dateStr].length > 0)) && (
                <div className="space-y-1">
                  {dayContent.slice(0, 3).map((item) => {
                    const config = getStatusConfig(item.status);
                    const repurposeTotal = item.repurpose_formats?.length || 0;
                    const repurposeDone = item.repurpose_formats?.filter(rf => rf.status === 'POSTED').length || 0;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight",
                          "border-l-2 transition-all duration-200",
                          config.bg, config.text, config.border
                        )}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          <span className="truncate">
                            {item.title || <span className="capitalize">{item.content_type.replace('_', ' ')}</span>}
                          </span>
                          {item.content_type === 'REEL' && getReelTypeLabel(item.reel_type) && (
                            <span className="shrink-0 px-1 text-[9px] font-bold rounded bg-white/10">
                              {getReelTypeLabel(item.reel_type)}
                            </span>
                          )}
                        </div>
                        {repurposeTotal > 0 && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <div className="flex items-center gap-[2px]">
                              {item.repurpose_formats!.map((rf) => (
                                <div
                                  key={rf.format}
                                  className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    getFormatStatusDot(rf.status)
                                  )}
                                  title={`${rf.format}: ${rf.status}`}
                                />
                              ))}
                            </div>
                            <span className="text-[9px] opacity-60">
                              {repurposeDone}/{repurposeTotal}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {dayContent.length > 3 && (
                    <span className="text-[10px] font-medium text-[--exec-text-muted] pl-1 group-hover:text-[--exec-accent] transition-colors">
                      +{dayContent.length - 3} more
                    </span>
                  )}

                  {/* Repurpose items from other days — collapsed into one summary line */}
                  {repurposeByDate[dateStr] && repurposeByDate[dateStr].length > 0 && (() => {
                    const rps = repurposeByDate[dateStr];
                    return (
                      <div
                        className={cn(
                          "rounded-md px-1.5 py-0.5 text-[11px] font-medium leading-tight",
                          "border border-dashed border-[--exec-accent]/30 bg-[--exec-accent]/5",
                          "text-[--exec-accent] flex items-center gap-1"
                        )}
                        title={rps.map(rp => `${rp.format.format} from "${rp.parentTitle}"`).join('\n')}
                      >
                        <Repeat2 className="w-3 h-3 shrink-0" />
                        <span className="truncate">{rps.length} repurpose{rps.length !== 1 ? 's' : ''}</span>
                        <div className="flex items-center gap-[2px] shrink-0 ml-auto">
                          {rps.map((rp) => (
                            <div
                              key={`${rp.parentDate}-${rp.format.format}`}
                              className={cn(
                                "w-1.5 h-1.5 rounded-full",
                                getFormatStatusDot(rp.format.status)
                              )}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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
          { status: 'POSTED', label: 'Posted' },
          { status: 'SCHEDULED', label: 'Scheduled' },
          { status: 'EDITING', label: 'Editing' },
          { status: 'FILMED', label: 'Filmed' },
          { status: 'SCRIPTED', label: 'Scripted' },
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
