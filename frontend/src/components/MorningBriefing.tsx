import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, MessageSquare, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useChat } from '@/contexts/ChatContext';

interface PriorityItem {
  id: number;
  type: 'task' | 'deal';
  title: string;
  why_priority: string;
  priority_score: number;
  insight: string | null;
  suggested_actions: string[];
  context_for_chat: string;
}

interface BriefingData {
  greeting: string;
  summary: string;
  priority_items: PriorityItem[];
  ai_observations: string[];
}

export default function MorningBriefing() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { openChat } = useChat();
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  const { data: briefing, isLoading, error, refetch, isFetching } = useQuery<BriefingData>({
    queryKey: ['dashboard', 'briefing'],
    queryFn: dashboardApi.getBriefing,
    retry: 1,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  // Action mutations
  const completeTaskMutation = useMutation({
    mutationFn: dashboardApi.completeTask,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toast.error('Failed to complete task'),
    onSettled: () => setLoadingAction(null),
  });

  const rescheduleTaskMutation = useMutation({
    mutationFn: ({ id, days }: { id: number; days: number }) =>
      dashboardApi.rescheduleTask(id, days),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toast.error('Failed to reschedule task'),
    onSettled: () => setLoadingAction(null),
  });

  const snoozeDealMutation = useMutation({
    mutationFn: dashboardApi.snoozeDeal,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: () => toast.error('Failed to snooze deal'),
    onSettled: () => setLoadingAction(null),
  });

  const logFollowupMutation = useMutation({
    mutationFn: dashboardApi.logDealFollowup,
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'briefing'] });
      queryClient.invalidateQueries({ queryKey: ['deals'] });
    },
    onError: () => toast.error('Failed to log follow-up'),
    onSettled: () => setLoadingAction(null),
  });

  const handleAction = (item: PriorityItem, action: string) => {
    const actionKey = `${item.type}-${item.id}-${action}`;
    setLoadingAction(actionKey);

    if (item.type === 'task') {
      switch (action) {
        case 'complete':
          completeTaskMutation.mutate(item.id);
          break;
        case 'reschedule':
          rescheduleTaskMutation.mutate({ id: item.id, days: 1 });
          break;
        case 'delegate':
          toast.info('Delegate feature coming soon');
          setLoadingAction(null);
          break;
        case 'break_down':
          toast.info('Break down feature coming soon');
          setLoadingAction(null);
          break;
        default:
          toast.info(`Action "${action}" not yet implemented`);
          setLoadingAction(null);
      }
    } else if (item.type === 'deal') {
      switch (action) {
        case 'snooze':
          snoozeDealMutation.mutate(item.id);
          break;
        case 'log_followup':
          logFollowupMutation.mutate(item.id);
          break;
        case 'schedule_call':
          toast.info('Schedule call feature coming soon');
          setLoadingAction(null);
          break;
        default:
          toast.info(`Action "${action}" not yet implemented`);
          setLoadingAction(null);
      }
    }
  };

  const handleAskAI = (item: PriorityItem) => {
    openChat(`Tell me more about: ${item.context_for_chat}`);
  };

  const getActionLabel = (action: string): string => {
    const labels: Record<string, string> = {
      complete: 'Complete',
      reschedule: 'Tomorrow',
      delegate: 'Delegate',
      break_down: 'Break Down',
      snooze: 'Snooze',
      log_followup: 'Log Call',
      schedule_call: 'Schedule',
    };
    return labels[action] || action;
  };

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 mb-8">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">Failed to load briefing</p>
        </div>
        <p className="text-sm text-red-500 dark:text-red-400 mt-1 ml-7">
          {(error as Error).message || "Unknown error"}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-gray-100 dark:bg-gray-700 rounded w-2/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-24 bg-gray-50 dark:bg-gray-700/50 rounded-xl"></div>
          <div className="h-24 bg-gray-50 dark:bg-gray-700/50 rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl p-6 mb-8">
        <p className="text-yellow-700 dark:text-yellow-400">No briefing data available.</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">
            {briefing.greeting}
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh briefing"
          >
            <RefreshCw className={cn("w-5 h-5", isFetching && "animate-spin")} />
          </button>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {briefing.summary}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Items */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Today's Priorities
          </h3>

          {!briefing.priority_items || briefing.priority_items.length === 0 ? (
            <div className="p-6 bg-gray-50 dark:bg-gray-700/30 rounded-xl text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                You're all caught up!
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                No urgent items need your attention today.
              </p>
            </div>
          ) : (
            briefing.priority_items.map((item) => (
              <div
                key={`${item.type}-${item.id}`}
                className="bg-gray-50 dark:bg-gray-700/30 border border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:bg-white dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Item Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => navigate(item.type === 'task' ? '/tasks' : '/deals')}
                      className="font-medium text-gray-900 dark:text-white truncate text-left hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                    >
                      {item.title}
                    </button>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {item.why_priority}
                    </p>
                  </div>
                  <span className={cn(
                    "ml-3 px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0",
                    item.priority_score >= 90
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400"
                      : item.priority_score >= 70
                      ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                  )}>
                    {item.type === 'task' ? 'Task' : 'Deal'}
                  </span>
                </div>

                {/* AI Insight */}
                {item.insight && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 italic">
                    {item.insight}
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-gray-100 dark:border-gray-600">
                  {(item.suggested_actions || []).slice(0, 3).map((action) => {
                    const actionKey = `${item.type}-${item.id}-${action}`;
                    const isLoading = loadingAction === actionKey;

                    return (
                      <button
                        key={action}
                        onClick={() => handleAction(item, action)}
                        disabled={isLoading || loadingAction !== null}
                        className={cn(
                          "px-3 py-1.5 text-sm font-medium rounded-lg transition-all",
                          "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600",
                          "text-gray-700 dark:text-gray-300",
                          "hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-500",
                          "disabled:opacity-50 disabled:cursor-not-allowed",
                          isLoading && "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                        )}
                      >
                        {isLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                        ) : null}
                        {getActionLabel(action)}
                      </button>
                    );
                  })}

                  {/* Ask AI Button */}
                  <button
                    onClick={() => handleAskAI(item)}
                    className="px-3 py-1.5 text-sm font-medium rounded-lg transition-all bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                  >
                    <MessageSquare className="w-3 h-3 inline mr-1" />
                    Ask AI
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* AI Observations */}
        <div>
          <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4">
            Insights
          </h3>
          <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800 rounded-xl p-4">
            {!briefing.ai_observations || briefing.ai_observations.length === 0 ? (
              <p className="text-sm text-blue-600 dark:text-blue-400">
                No patterns detected yet. Keep tracking your work to get personalized insights.
              </p>
            ) : (
              <ul className="space-y-3">
                {briefing.ai_observations.map((observation, index) => (
                  <li key={index} className="flex gap-2 text-sm text-blue-800 dark:text-blue-300">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-blue-400 dark:bg-blue-500 flex-shrink-0" />
                    {observation}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
