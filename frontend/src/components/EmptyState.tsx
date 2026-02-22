import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export default function EmptyState({ icon: Icon, title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16", className)}>
      <div className={cn(
        'w-16 h-16 rounded-2xl flex items-center justify-center mb-4',
        'bg-stone-700/50'
      )}>
        <Icon className="w-8 h-8 text-[--exec-text-muted]" />
      </div>
      <h3 className="text-lg font-semibold text-[--exec-text] mb-2">{title}</h3>
      {description && (
        <p className="text-[--exec-text-muted] text-center max-w-md mb-4">{description}</p>
      )}
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-colors text-sm font-medium"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
