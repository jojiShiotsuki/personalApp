import { getMonthName, formatWeekNumber, getDayName, formatDayAndMonth, formatDateForApi } from '@/lib/dateUtils';
import { ChevronRight } from 'lucide-react';

interface CalendarBreadcrumbProps {
  year: number;
  month?: number;
  weekNumber?: number;
  selectedDate?: Date;
  onYearClick: () => void;
  onMonthClick?: () => void;
  onWeekClick?: () => void;
}

export default function CalendarBreadcrumb({
  year,
  month,
  weekNumber,
  selectedDate,
  onYearClick,
  onMonthClick,
  onWeekClick,
}: CalendarBreadcrumbProps) {
  return (
    <nav className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center gap-2 text-sm">
        {/* Year */}
        <button
          onClick={onYearClick}
          className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
        >
          {year}
        </button>

        {/* Month */}
        {month && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <button
              onClick={onMonthClick}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              {getMonthName(month)}
            </button>
          </>
        )}

        {/* Week */}
        {weekNumber && month && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <button
              onClick={onWeekClick}
              className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
            >
              {formatWeekNumber(weekNumber)}
            </button>
          </>
        )}

        {/* Day */}
        {selectedDate && (
          <>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-700 dark:text-gray-300 font-semibold">
              {getDayName(selectedDate)} {formatDayAndMonth(selectedDate)}
            </span>
          </>
        )}
      </div>
    </nav>
  );
}
