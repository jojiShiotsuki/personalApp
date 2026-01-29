import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

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
      <div className="bento-card bg-[--exec-danger-bg] border-[--exec-danger]/20 p-6">
        <div className="flex items-center gap-2 text-[--exec-danger]">
          <AlertCircle className="w-5 h-5" />
          <p className="font-medium">Failed to load briefing</p>
        </div>
        <p className="text-sm text-[--exec-danger]/70 mt-1 ml-7">
          {(error as Error).message || "Unknown error"}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-7 bg-[--exec-surface-alt] rounded w-1/3 mb-4"></div>
        <div className="h-4 bg-[--exec-surface-alt] rounded w-2/3 mb-6"></div>
        <div className="space-y-4">
          <div className="h-20 bg-[--exec-surface-alt] rounded-xl"></div>
          <div className="h-20 bg-[--exec-surface-alt] rounded-xl"></div>
        </div>
      </div>
    );
  }

  if (!briefing) {
    return (
      <div className="bento-card bg-[--exec-warning-bg] border-[--exec-warning]/20 p-6">
        <p className="text-[--exec-warning]">No briefing data available.</p>
      </div>
    );
  }

  return (
    <div className="bento-card p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[--exec-text]">
            {briefing.greeting}
          </h2>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-accent] hover:bg-[--exec-surface-alt] rounded-lg transition-colors disabled:opacity-50"
            title="Refresh briefing"
          >
            <RefreshCw className={cn("w-5 h-5", isFetching && "animate-spin")} />
          </button>
        </div>
        <p className="text-[--exec-text-secondary] mt-1">
          {briefing.summary}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Priority Items */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider">
            Today's Priorities
          </h3>

          {!briefing.priority_items || briefing.priority_items.length === 0 ? (
            <div className="p-8 bg-[--exec-sage-bg] rounded-2xl text-center">
              <div className="w-12 h-12 bg-[--exec-sage]/20 rounded-xl flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-[--exec-sage]" />
              </div>
              <p className="text-[--exec-text] font-semibold">
                You're all caught up!
              </p>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                No urgent items need your attention today.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[--exec-border]/30">
              {briefing.priority_items.map((item) => {
                const isHighPriority = item.priority_score >= 90;
                const isMediumPriority = item.priority_score >= 70 && item.priority_score < 90;
                const isOverdue = item.why_priority.toLowerCase().includes('overdue');

                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="relative py-4 first:pt-0 last:pb-0 transition-all duration-200 group"
                  >
                    {/* Item Header */}
                    <div className="flex items-start gap-3">
                      {/* Priority dot indicator */}
                      <div className="flex flex-col items-center pt-1.5">
                        <div className={cn(
                          "w-2.5 h-2.5 rounded-full shrink-0",
                          isOverdue || isHighPriority
                            ? "bg-[--exec-danger]"
                            : isMediumPriority
                            ? "bg-[--exec-warning]"
                            : "bg-[--exec-sage]"
                        )} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <button
                              onClick={() => navigate(item.type === 'task' ? '/tasks' : '/deals')}
                              className="font-medium text-[--exec-text] text-left transition-colors block hover:text-[--exec-accent]"
                            >
                              {item.title}
                            </button>
                            <p className="text-sm text-[--exec-text-muted] mt-0.5">
                              {item.why_priority}
                            </p>
                          </div>
                          <span className="text-[10px] font-medium text-[--exec-text-muted] uppercase tracking-wider flex-shrink-0">
                            {item.type}
                          </span>
                        </div>

                        {/* AI Insight */}
                        {item.insight && (
                          <p className="text-sm text-[--exec-text-muted] mt-2 italic leading-relaxed">
                            {item.insight}
                          </p>
                        )}

                        {/* Action Buttons */}
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {(item.suggested_actions || []).slice(0, 2).map((action) => {
                            const actionKey = `${item.type}-${item.id}-${action}`;
                            const isActionLoading = loadingAction === actionKey;

                            return (
                              <button
                                key={action}
                                onClick={() => handleAction(item, action)}
                                disabled={isActionLoading || loadingAction !== null}
                                className={cn(
                                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200",
                                  "bg-stone-700 text-stone-300",
                                  "border border-stone-600",
                                  "hover:bg-stone-600 hover:text-white hover:border-stone-500 hover:scale-105",
                                  "disabled:opacity-50 disabled:cursor-not-allowed",
                                  isActionLoading && "bg-[--exec-accent-bg] text-[--exec-accent] border-[--exec-accent]/30"
                                )}
                              >
                                {isActionLoading ? (
                                  <Loader2 className="w-3 h-3 animate-spin inline mr-1" />
                                ) : null}
                                {getActionLabel(action)}
                              </button>
                            );
                          })}

                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* AI Observations */}
        <div>
          <h3 className="text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider mb-4">
            Insights
          </h3>
          <div className="bg-[--exec-accent-bg-subtle] rounded-2xl p-4">
            {!briefing.ai_observations || briefing.ai_observations.length === 0 ? (
              <p className="text-sm text-[--exec-accent]">
                No patterns detected yet. Keep tracking your work to get personalized insights.
              </p>
            ) : (
              <ul className="space-y-3">
                {briefing.ai_observations.map((observation, index) => (
                  <li key={index} className="flex gap-2 text-sm text-[--exec-text-secondary]">
                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[--exec-accent] flex-shrink-0" />
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
