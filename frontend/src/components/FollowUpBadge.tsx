interface FollowUpBadgeProps {
  count: number;
  target?: number;
}

export default function FollowUpBadge({ count, target = 5 }: FollowUpBadgeProps) {
  // Determine color based on progress
  const getColorClasses = () => {
    if (count >= target) {
      return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-800';
    } else if (count >= 3) {
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 border-yellow-300 dark:border-yellow-800';
    } else {
      return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-300 dark:border-red-800';
    }
  };

  const getEmoji = () => {
    if (count >= target) return '🟢';
    if (count >= 3) return '🟡';
    return '🔴';
  };

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getColorClasses()}`}>
      <span>{getEmoji()}</span>
      <span>{count}/{target}</span>
    </div>
  );
}
