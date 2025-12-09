// frontend/src/components/CoachToast.tsx
import { X, Lightbulb, AlertTriangle, TrendingUp, ChevronRight } from 'lucide-react';
import { useCoach } from '../contexts/CoachContext';
import { cn } from '../lib/utils';

const priorityConfig = {
  high: {
    border: 'border-l-red-500',
    icon: AlertTriangle,
    iconColor: 'text-red-500 dark:text-red-400',
  },
  medium: {
    border: 'border-l-orange-500',
    icon: Lightbulb,
    iconColor: 'text-orange-500 dark:text-orange-400',
  },
  low: {
    border: 'border-l-blue-500',
    icon: TrendingUp,
    iconColor: 'text-blue-500 dark:text-blue-400',
  },
};

export function CoachToast() {
  const { currentToast, dismissCurrentToast } = useCoach();

  if (!currentToast) return null;

  const config = priorityConfig[currentToast.priority];
  const Icon = config.icon;

  const handleAction = () => {
    // Handle suggested action based on action type
    // This will be expanded as actions are implemented
    if (currentToast.suggested_action) {
      console.log('Action clicked:', currentToast.suggested_action, currentToast.action_params);
      // TODO: Implement action handlers
    }
    dismissCurrentToast();
  };

  return (
    <div className="fixed bottom-24 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div
        className={cn(
          'bg-white dark:bg-slate-800 rounded-xl shadow-2xl',
          'border border-gray-200 dark:border-slate-700',
          'border-l-4',
          config.border,
          'w-96 max-w-[calc(100vw-3rem)]',
          'animate-in zoom-in-95 duration-200'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Icon className={cn('w-5 h-5', config.iconColor)} />
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              AI Coach
            </span>
          </div>
          <button
            onClick={dismissCurrentToast}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
            {currentToast.message}
          </p>
        </div>

        {/* Footer - only show if there's a suggested action */}
        {currentToast.suggested_action && (
          <div className="flex gap-3 justify-end px-4 py-3 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={dismissCurrentToast}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-lg transition-colors"
            >
              Dismiss
            </button>
            <button
              onClick={handleAction}
              className={cn(
                'group flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium',
                'bg-blue-600 text-white rounded-lg',
                'hover:bg-blue-700 transition-all duration-200',
                'shadow-sm hover:shadow-md'
              )}
            >
              Take Action
              <ChevronRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
