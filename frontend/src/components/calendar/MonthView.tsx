import { getWeeksInMonth, formatDateRange, formatWeekNumber, getMonthName } from '@/lib/dateUtils';
import { SocialContent } from '@/types';
import { format } from 'date-fns';

interface MonthViewProps {
  year: number;
  month: number;
  content: SocialContent[];
  onWeekClick: (weekNumber: number) => void;
  onBack: () => void;
}

export default function MonthView({
  year,
  month,
  content,
  onWeekClick,
  onBack,
}: MonthViewProps) {
  const weeks = getWeeksInMonth(year, month);

  // Group content by week number
  const contentByWeek = weeks.reduce(
    (acc, week) => {
      const weekContent = content.filter((item) => {
        const itemDate = new Date(item.content_date);
        return (
          itemDate >= week.startDate &&
          itemDate <= week.endDate
        );
      });
      acc[week.weekNumber] = weekContent;
      return acc;
    },
    {} as Record<number, SocialContent[]>
  );

  // Count content types for a week
  const getContentTypeCount = (weekContent: SocialContent[]) => {
    return weekContent.reduce(
      (acc, item) => {
        acc[item.content_type] = (acc[item.content_type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  };

  // Get status breakdown for a week
  const getStatusCount = (weekContent: SocialContent[]) => {
    return weekContent.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
  };

  // Get icon/badge for content type
  const ContentTypeBadge = ({ type }: { type: string }) => {
    const colors: Record<string, string> = {
      reel: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200',
      carousel: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200',
      single_post: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200',
      story: 'bg-pink-100 dark:bg-pink-900 text-pink-700 dark:text-pink-200',
      tiktok: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-200',
      youtube_short: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200',
      youtube_video: 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200',
      blog_post: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200',
    };

    const typeLabel = type.replace('_', ' ');
    return (
      <span
        className={`inline-block px-2 py-1 text-xs font-medium rounded capitalize ${
          colors[type] || 'bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-200'
        }`}
      >
        {typeLabel}
      </span>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={onBack}
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2"
          >
            ← Back to Year
          </button>
          <h1 className="text-3xl font-bold">
            {getMonthName(month)} {year}
          </h1>
        </div>
      </div>

      {weeks.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          No weeks found for this month.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {weeks.map((week) => {
            const weekContent = contentByWeek[week.weekNumber] || [];
            const typeCount = getContentTypeCount(weekContent);
            const statusCount = getStatusCount(weekContent);

            return (
              <button
                key={week.weekNumber}
                onClick={() => onWeekClick(week.weekNumber)}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow text-left"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-lg font-semibold">
                      Week {formatWeekNumber(week.weekNumber)}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {formatDateRange(week.startDate, week.endDate)}
                    </p>
                  </div>
                  <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {weekContent.length}
                  </span>
                </div>

                {weekContent.length > 0 && (
                  <>
                    <div className="mb-4 pb-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
                        Content Types
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(typeCount).map(([type, count]) => (
                          <div key={type} className="flex items-center gap-1">
                            <ContentTypeBadge type={type} />
                            <span className="text-xs font-medium bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="pb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 uppercase">
                        Status Breakdown
                      </p>
                      <div className="space-y-1">
                        {Object.entries(statusCount).map(([status, count]) => (
                          <div
                            key={status}
                            className="flex justify-between text-xs"
                          >
                            <span className="capitalize">
                              {status.replace('_', ' ')}
                            </span>
                            <span className="font-semibold">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {weekContent.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                    No content scheduled
                  </p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
