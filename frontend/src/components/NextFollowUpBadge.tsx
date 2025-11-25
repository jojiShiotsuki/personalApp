import { Calendar, Clock, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NextFollowUpBadgeProps {
  date: string | null | undefined;
  className?: string;
}

type DateStatus = 'overdue' | 'soon' | 'future' | 'unset';

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 0 && diffDays <= 7) return `in ${diffDays}d`;
  if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}d ago`;

  // For dates beyond 7 days, show short format
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateStatus(dateString: string | null | undefined): DateStatus {
  if (!dateString) return 'unset';

  const date = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);

  const diffTime = date.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'overdue';  // Past
  if (diffDays <= 2) return 'soon';    // Today, tomorrow, or day after
  return 'future';                      // 3+ days away
}

export default function NextFollowUpBadge({ date, className }: NextFollowUpBadgeProps) {
  const status = getDateStatus(date);

  const config = {
    overdue: {
      icon: AlertCircle,
      bgColor: 'bg-red-100 dark:bg-red-900/30',
      textColor: 'text-red-700 dark:text-red-400',
      borderColor: 'border-red-300 dark:border-red-800',
    },
    soon: {
      icon: Clock,
      bgColor: 'bg-yellow-100 dark:bg-yellow-900/30',
      textColor: 'text-yellow-700 dark:text-yellow-400',
      borderColor: 'border-yellow-300 dark:border-yellow-800',
    },
    future: {
      icon: Calendar,
      bgColor: 'bg-green-100 dark:bg-green-900/30',
      textColor: 'text-green-700 dark:text-green-400',
      borderColor: 'border-green-300 dark:border-green-800',
    },
    unset: {
      icon: Calendar,
      bgColor: 'bg-gray-100 dark:bg-gray-800',
      textColor: 'text-gray-500 dark:text-gray-400',
      borderColor: 'border-gray-300 dark:border-gray-700',
    },
  };

  const { icon: Icon, bgColor, textColor, borderColor } = config[status];
  const displayText = date ? formatRelativeDate(date) : 'Not set';

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border',
        bgColor,
        textColor,
        borderColor,
        className
      )}
      title={date ? `Next follow-up: ${new Date(date).toLocaleDateString()}` : 'No follow-up date set'}
    >
      <Icon className="w-3 h-3" />
      <span>{displayText}</span>
    </div>
  );
}
