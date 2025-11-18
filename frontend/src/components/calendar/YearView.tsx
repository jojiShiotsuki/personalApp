import { getMonthName } from '@/lib/dateUtils';
import type { MonthSummary } from '@/types';

interface YearViewProps {
  year: number;
  months: MonthSummary[];
  onMonthClick: (month: number) => void;
}

export default function YearView({ year, months, onMonthClick }: YearViewProps) {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">{year} Content Calendar</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {months.map((monthData) => (
          <button
            key={monthData.month}
            onClick={() => onMonthClick(monthData.month)}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow text-left"
          >
            <h2 className="text-xl font-semibold mb-3">
              {getMonthName(monthData.month)}
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Total Content:
                </span>
                <span className="font-semibold">{monthData.total_content}</span>
              </div>

              {monthData.total_content > 0 && (
                <>
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">By Status:</p>
                    {Object.entries(monthData.by_status).map(([status, count]) => (
                      <div key={status} className="flex justify-between text-xs">
                        <span className="capitalize">{status.replace('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                    <p className="text-gray-600 dark:text-gray-400 mb-1">By Type:</p>
                    {Object.entries(monthData.by_type).map(([type, count]) => (
                      <div key={type} className="flex justify-between text-xs">
                        <span className="capitalize">{type.replace('_', ' ')}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
