import { getDayName, formatDateForApi, isToday, isPast } from '@/lib/dateUtils';
import { SocialContent } from '@/types';
import { Plus, Instagram, Youtube, Facebook, Twitter, Linkedin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  year: number;
  month: number;
  content: SocialContent[];
  onDayClick: (date: Date) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'posted':
      return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
    case 'scheduled':
      return 'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800';
    case 'editing':
      return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800';
    case 'filmed':
      return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
    case 'scripted':
      return 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
  }
};

const getPlatformIcon = (platform: string) => {
  switch (platform.toLowerCase()) {
    case 'instagram':
      return <Instagram className="w-3 h-3" />;
    case 'youtube':
    case 'youtube_shorts':
      return <Youtube className="w-3 h-3" />;
    case 'facebook':
      return <Facebook className="w-3 h-3" />;
    case 'twitter':
    case 'x':
      return <Twitter className="w-3 h-3" />;
    case 'linkedin':
      return <Linkedin className="w-3 h-3" />;
    case 'tiktok':
      return <span className="text-[8px] font-bold">TT</span>;
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
              "bg-white dark:bg-gray-800 rounded-xl border p-4 shadow-sm hover:shadow-md transition-all text-left min-h-[150px] flex flex-col group relative",
              isTodayDate && "border-blue-500 dark:border-blue-400 border-2",
              !isTodayDate && "border-gray-200 dark:border-gray-700",
              isPastDate && "opacity-75 hover:opacity-100"
            )}
          >
            <div className="flex justify-between items-start mb-3">
              <div className="text-gray-900 dark:text-white">
                <p className="font-semibold text-sm text-gray-500 dark:text-gray-400">{getDayName(day)}</p>
                <p className={cn("text-2xl font-bold", isTodayDate ? "text-blue-600 dark:text-blue-400" : "text-gray-900 dark:text-white")}>
                  {day.getDate()}
                </p>
              </div>
              {dayContent.length > 0 && (
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-full text-xs font-medium">
                  {dayContent.length}
                </span>
              )}
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto">
              {dayContent.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-lg p-2 text-xs border transition-colors",
                    getStatusColor(item.status)
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-semibold capitalize truncate">
                      {item.content_type.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="capitalize opacity-75 text-[10px]">
                      {item.status.replace('_', ' ')}
                    </span>
                    <div className="flex gap-1">
                      {item.platforms?.slice(0, 3).map((platform) => (
                        <div key={platform} title={platform}>
                          {getPlatformIcon(platform)}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Quick Add Indicator (visible on hover) */}
            <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="bg-slate-100 dark:bg-slate-700 p-1.5 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600">
                <Plus className="w-4 h-4" />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
