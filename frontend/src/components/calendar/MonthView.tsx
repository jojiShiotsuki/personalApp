import { getDayName, formatDateForApi, isToday, isPast } from '@/lib/dateUtils';
import { SocialContent } from '@/types';
import { Calendar, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number;
  content: SocialContent[];
  onDayClick: (date: Date) => void;
}

export default function MonthView({
  year,
  month,
  content,
  onDayClick,
}: MonthViewProps) {
  // Generate all days in the month
  const getDaysInMonth = () => {
    const daysInMonth = new Date(year, month, 0).getDate();
    const days: Date[] = [];

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month - 1, day));
    }

    return days;
  };

  const days = getDaysInMonth();

  // Group content by date
  const contentByDate: Record<string, SocialContent[]> = {};
  content.forEach((item) => {
    if (!contentByDate[item.content_date]) {
      contentByDate[item.content_date] = [];
    }
    contentByDate[item.content_date].push(item);
  });

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
      {days.map((day) => {
        const dateStr = formatDateForApi(day);
        const dayContent = contentByDate[dateStr] || [];
        const isTodayDate = isToday(day);
        const isPastDate = isPast(day);

        return (
          <button
            key={dateStr}
            onClick={() => onDayClick(day)}
            className={cn(
              "bg-white rounded-xl border p-4 shadow-sm hover:shadow-md transition-all text-left min-h-[150px] flex flex-col",
              isTodayDate && "border-blue-500 border-2",
              !isTodayDate && "border-gray-200",
              isPastDate && "opacity-75"
            )}
          >
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="font-semibold">{getDayName(day)}</p>
                <p className="text-2xl font-bold">{day.getDate()}</p>
              </div>
              {dayContent.length > 0 && (
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                  {dayContent.length}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-1.5 overflow-y-auto">
              {dayContent.map((item) => (
                <div
                  key={item.id}
                  className="bg-gray-50 rounded p-2 text-xs border border-gray-200"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold capitalize text-gray-900 truncate">
                      {item.content_type.replace('_', ' ')}
                    </span>
                    <span className="capitalize text-xs text-gray-600 shrink-0">
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </button>
        );
      })}
    </div>
  );
}
