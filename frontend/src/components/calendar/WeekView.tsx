import { getDayName, formatDateForApi, isToday, isPast } from '@/lib/dateUtils';
import type { SocialContent } from '@/types';
import { useMemo } from 'react';
import { Calendar, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeekViewProps {
  year: number;
  month: number;
  weekNumber: number;
  weekDays: Date[];
  content: SocialContent[];
  onDayClick: (date: Date) => void;
}

export default function WeekView({
  year,
  month,
  weekNumber,
  weekDays,
  content,
  onDayClick,
}: WeekViewProps) {
  // Group content by date
  const contentByDate = useMemo(() => {
    const grouped: Record<string, SocialContent[]> = {};

    content.forEach((item) => {
      if (!grouped[item.content_date]) {
        grouped[item.content_date] = [];
      }
      grouped[item.content_date].push(item);
    });

    return grouped;
  }, [content]);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">
        Week {weekNumber} - {new Date(year, month - 1).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        {weekDays.map((day) => {
          const dateStr = formatDateForApi(day);
          const dayContent = contentByDate[dateStr] || [];
          const isTodayDate = isToday(day);
          const isPastDate = isPast(day);

          return (
            <button
              key={dateStr}
              onClick={() => onDayClick(day)}
              className={cn(
                "bg-white dark:bg-gray-800 rounded-lg border p-4 hover:shadow-lg transition-shadow text-left min-h-[180px] flex flex-col",
                isTodayDate && "border-blue-500 dark:border-blue-400 border-2",
                !isTodayDate && "border-gray-200 dark:border-gray-700",
                isPastDate && "opacity-75"
              )}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="font-semibold">{getDayName(day)}</p>
                  <p className="text-2xl font-bold">{day.getDate()}</p>
                </div>
                {dayContent.length > 0 ? (
                  <span className="bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-2 py-1 rounded text-xs font-semibold">
                    {dayContent.length}
                  </span>
                ) : (
                  <Plus className="w-5 h-5 text-gray-400" />
                )}
              </div>

              <div className="flex-1 space-y-2">
                {dayContent.map((item) => (
                  <div
                    key={item.id}
                    className="bg-gray-50 dark:bg-gray-700 rounded p-2 text-xs"
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <Calendar className="w-3 h-3" />
                      <span className="font-semibold capitalize">
                        {item.content_type.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 capitalize text-xs">
                      {item.status.replace('_', ' ')}
                    </p>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
