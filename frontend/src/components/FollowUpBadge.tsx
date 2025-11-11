interface FollowUpBadgeProps {
  count: number;
  target?: number;
}

export default function FollowUpBadge({ count, target = 5 }: FollowUpBadgeProps) {
  // Determine color based on progress
  const getColorClasses = () => {
    if (count >= target) {
      return 'bg-green-100 text-green-700 border-green-300';
    } else if (count >= 3) {
      return 'bg-yellow-100 text-yellow-700 border-yellow-300';
    } else {
      return 'bg-red-100 text-red-700 border-red-300';
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
