import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { autoresearchApi } from '@/lib/api';
import type {
  AnalyticsOverview,
  IssueTypeStats,
  NicheStats,
  TimingStats,
  InsightRecord,
} from '@/types';
import {
  RefreshCw,
  Lightbulb,
  BarChart3,
  Globe,
  Calendar,
  Brain,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Helpers ──────────────────────────────────────────

function formatIssueType(issueType: string): string {
  return issueType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatRate(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function getConfidenceBadge(confidence: string): {
  label: string;
  className: string;
  barWidth: string;
} {
  const c = confidence.toLowerCase();
  if (c === 'high') {
    return {
      label: 'HIGH',
      className:
        'bg-green-900/30 text-green-400 border-green-800',
      barWidth: 'w-full',
    };
  }
  if (c === 'medium') {
    return {
      label: 'MED',
      className:
        'bg-yellow-900/30 text-yellow-400 border-yellow-800',
      barWidth: 'w-2/3',
    };
  }
  return {
    label: 'LOW',
    className:
      'bg-red-900/30 text-red-400 border-red-800',
    barWidth: 'w-1/3',
  };
}

function getConfidenceDot(confidence: string): string {
  const c = confidence.toLowerCase();
  if (c === 'high') return 'bg-green-500';
  if (c === 'medium') return 'bg-yellow-500';
  return 'bg-red-500';
}

// ── Section Header ───────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <Icon className="w-4 h-4 text-[--exec-accent]" />
      <h3 className="text-sm font-semibold text-[--exec-text] uppercase tracking-wider">
        {title}
      </h3>
      <div className="flex-1 h-px bg-stone-700/30" />
    </div>
  );
}

// ── Loading Skeleton ─────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="px-8 py-6 space-y-8 animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-5 w-48 bg-stone-700/50 rounded" />
          <div className="h-4 w-32 bg-stone-700/50 rounded" />
        </div>
        <div className="h-9 w-36 bg-stone-700/50 rounded-lg" />
      </div>

      {/* Table skeleton */}
      {[1, 2].map((s) => (
        <div key={s} className="space-y-3">
          <div className="h-4 w-56 bg-stone-700/50 rounded" />
          <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 overflow-hidden">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-6 py-4 flex gap-6 border-b border-stone-700/30 last:border-b-0">
                <div className="h-4 w-28 bg-stone-700/50 rounded" />
                <div className="h-4 w-12 bg-stone-700/50 rounded" />
                <div className="h-4 w-12 bg-stone-700/50 rounded" />
                <div className="h-4 w-16 bg-stone-700/50 rounded" />
                <div className="h-4 w-20 bg-stone-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Chart skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-40 bg-stone-700/50 rounded" />
        <div className="flex items-end justify-center gap-4 h-32">
          {Array.from({ length: 7 }).map((_, i) => (
            <div
              key={i}
              className="w-12 bg-stone-700/50 rounded-t"
              style={{ height: `${20 + Math.random() * 80}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Day of Week Bar Chart ────────────────────────────

const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const DAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function DayOfWeekChart({ stats }: { stats: TimingStats[] }) {
  // Build map from day name to stats
  const dayMap = new Map<string, TimingStats>();
  for (const s of stats) {
    dayMap.set(s.day_of_week, s);
  }

  // Find max reply rate for scaling
  const maxRate = Math.max(
    ...DAY_ORDER.map((d) => dayMap.get(d)?.reply_rate ?? 0),
    0.001 // avoid divide-by-zero
  );

  return (
    <div className="flex items-end justify-center gap-3 sm:gap-6">
      {DAY_ORDER.map((day, i) => {
        const s = dayMap.get(day);
        const rate = s?.reply_rate ?? 0;
        const heightPct = maxRate > 0 ? (rate / maxRate) * 100 : 0;
        const sent = s?.sent ?? 0;

        return (
          <div key={day} className="flex flex-col items-center gap-1.5 min-w-[40px]">
            {/* Bar container */}
            <div className="relative w-10 h-24 flex items-end justify-center">
              <div
                className={cn(
                  'w-full rounded-t transition-all duration-500',
                  rate > 0 ? 'bg-[--exec-accent]' : 'bg-stone-700/30'
                )}
                style={{ height: `${Math.max(heightPct, 4)}%` }}
                title={`${day}: ${sent} sent, ${s?.replied ?? 0} replied`}
              />
            </div>

            {/* Day label */}
            <span className="text-xs font-medium text-[--exec-text-muted]">
              {DAY_SHORT[i]}
            </span>

            {/* Rate */}
            <span className={cn(
              'text-xs font-semibold',
              rate > 0 ? 'text-[--exec-text]' : 'text-[--exec-text-muted]'
            )}>
              {formatRate(rate)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Insight Card ─────────────────────────────────────

function InsightCard({ insight }: { insight: InsightRecord }) {
  const conf = getConfidenceBadge(insight.confidence);
  const dot = getConfidenceDot(insight.confidence);

  return (
    <div
      className={cn(
        'bg-[--exec-surface] rounded-xl border border-stone-600/40 p-4',
        'transition-all duration-200 hover:border-stone-500/50'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Confidence dot */}
        <div className={cn('w-2.5 h-2.5 rounded-full mt-1.5 shrink-0', dot)} />

        <div className="min-w-0 flex-1">
          {/* Top row: badge + sample size */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={cn(
                'inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-full',
                conf.className
              )}
            >
              {conf.label}
            </span>
            <span className="text-xs text-[--exec-text-muted]">
              n={insight.sample_size}
            </span>
            <span className="text-xs text-[--exec-text-muted]">
              {insight.applies_to}
            </span>
          </div>

          {/* Insight text */}
          <p className="text-sm text-[--exec-text] leading-relaxed">
            {insight.insight}
          </p>

          {/* Recommendation */}
          {insight.recommendation && (
            <p className="text-xs text-[--exec-text-secondary] mt-1.5 italic">
              {insight.recommendation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────

export default function InsightsTab() {
  const queryClient = useQueryClient();

  // Fetch analytics overview
  const { data: overview, isLoading: overviewLoading } = useQuery<AnalyticsOverview>({
    queryKey: ['autoresearch-analytics-overview'],
    queryFn: () => autoresearchApi.getAnalyticsOverview(),
  });

  // Fetch by issue type
  const { data: issueTypeData, isLoading: issueTypeLoading } = useQuery<{ stats: IssueTypeStats[] }>({
    queryKey: ['analytics-by-issue'],
    queryFn: () => autoresearchApi.getAnalyticsByIssueType(),
  });

  // Fetch by niche
  const { data: nicheData, isLoading: nicheLoading } = useQuery<{ stats: NicheStats[] }>({
    queryKey: ['analytics-by-niche'],
    queryFn: () => autoresearchApi.getAnalyticsByNiche(),
  });

  // Fetch by timing
  const { data: timingData, isLoading: timingLoading } = useQuery<{ stats: TimingStats[] }>({
    queryKey: ['analytics-by-timing'],
    queryFn: () => autoresearchApi.getAnalyticsByTiming(),
  });

  // Fetch insights
  const { data: insights = [], isLoading: insightsLoading } = useQuery<InsightRecord[]>({
    queryKey: ['insights'],
    queryFn: () => autoresearchApi.getInsights(),
  });

  // Refresh mutation
  const refreshMutation = useMutation({
    mutationFn: () => autoresearchApi.refreshInsights(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analytics-by-issue'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-by-niche'] });
      queryClient.invalidateQueries({ queryKey: ['analytics-by-timing'] });
      queryClient.invalidateQueries({ queryKey: ['insights'] });
      queryClient.invalidateQueries({ queryKey: ['autoresearch-analytics-overview'] });
    },
  });

  const isLoading = overviewLoading || issueTypeLoading || nicheLoading || timingLoading || insightsLoading;
  const hasExperimentData = (overview?.total_sent ?? 0) > 0;
  const hasInsights = insights.length > 0;
  const hasData = hasExperimentData || hasInsights;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (!hasData) {
    return (
      <div className="px-8 py-6">
        <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-12 text-center">
          <Brain className="w-12 h-12 text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[--exec-text] mb-2">
            Not enough data yet
          </h3>
          <p className="text-[--exec-text-muted] text-sm max-w-md mx-auto mb-6">
            Reject some audits or send emails and press Refresh Insights to start learning patterns.
          </p>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
              'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('w-4 h-4', refreshMutation.isPending && 'animate-spin')} />
            {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Insights'}
          </button>
        </div>
      </div>
    );
  }

  const issueTypeStats = issueTypeData?.stats ?? [];
  const nicheStats = nicheData?.stats ?? [];
  const timingStats = timingData?.stats ?? [];
  const activeInsights = insights.filter((i) => i.is_active);

  // Find the most recent insight to show "last updated"
  const latestInsight = insights.length > 0
    ? insights.reduce((a, b) =>
        new Date(a.created_at) > new Date(b.created_at) ? a : b
      )
    : null;

  return (
    <div className="px-8 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <Lightbulb className="w-5 h-5 text-[--exec-accent]" />
            <h2 className="text-lg font-semibold text-[--exec-text]">
              Insights
            </h2>
            {latestInsight && (
              <span className="text-xs text-[--exec-text-muted]">
                Last updated: {timeAgo(latestInsight.created_at)}
              </span>
            )}
          </div>
          <p className="text-sm text-[--exec-text-muted] mt-1 ml-8">
            {hasExperimentData
              ? `Based on ${overview?.total_sent?.toLocaleString() ?? 0} experiments`
              : 'Based on audit rejection patterns'}
          </p>
        </div>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200',
            'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          <RefreshCw className={cn('w-4 h-4', refreshMutation.isPending && 'animate-spin')} />
          {refreshMutation.isPending ? 'Refreshing...' : 'Refresh Insights'}
        </button>
      </div>

      {/* Issue Types Table */}
      {issueTypeStats.length > 0 && (
        <div>
          <SectionHeader icon={BarChart3} title="Top Performing Issue Types" />
          <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 overflow-hidden">
            <table className="min-w-full divide-y divide-stone-700/30">
              <thead className="bg-stone-700/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Issue Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Replied
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Confidence
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700/30">
                {issueTypeStats.map((stat) => {
                  const conf = getConfidenceBadge(stat.confidence);
                  return (
                    <tr
                      key={stat.issue_type}
                      className="hover:bg-stone-700/20 transition-colors duration-200"
                    >
                      <td className="px-6 py-3 whitespace-nowrap">
                        <span className="text-sm font-medium text-[--exec-text]">
                          {formatIssueType(stat.issue_type)}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-[--exec-text-secondary]">
                          {stat.sent}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="text-sm text-[--exec-text-secondary]">
                          {stat.replied}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap text-right">
                        <span className="text-sm font-semibold text-[--exec-text]">
                          {formatRate(stat.reply_rate)}
                        </span>
                      </td>
                      <td className="px-6 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          {/* Confidence bar */}
                          <div className="w-16 h-2 bg-stone-700/40 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all duration-500',
                                stat.confidence.toLowerCase() === 'high' && 'bg-green-500',
                                stat.confidence.toLowerCase() === 'medium' && 'bg-yellow-500',
                                stat.confidence.toLowerCase() === 'low' && 'bg-red-500'
                              )}
                              style={{
                                width:
                                  stat.confidence.toLowerCase() === 'high'
                                    ? '100%'
                                    : stat.confidence.toLowerCase() === 'medium'
                                    ? '66%'
                                    : '33%',
                              }}
                            />
                          </div>
                          <span
                            className={cn(
                              'inline-flex items-center px-2 py-0.5 text-xs font-semibold border rounded-full',
                              conf.className
                            )}
                          >
                            {conf.label}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Niche Table */}
      {nicheStats.length > 0 && (
        <div>
          <SectionHeader icon={Globe} title="By Niche" />
          <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 overflow-hidden">
            <table className="min-w-full divide-y divide-stone-700/30">
              <thead className="bg-stone-700/30">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Niche
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Replied
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Best Issue Type
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-700/30">
                {nicheStats.map((stat) => (
                  <tr
                    key={stat.niche}
                    className="hover:bg-stone-700/20 transition-colors duration-200"
                  >
                    <td className="px-6 py-3 whitespace-nowrap">
                      <span className="text-sm font-medium text-[--exec-text]">
                        {stat.niche}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right">
                      <span className="text-sm text-[--exec-text-secondary]">
                        {stat.sent}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right">
                      <span className="text-sm text-[--exec-text-secondary]">
                        {stat.replied}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap text-right">
                      <span className="text-sm font-semibold text-[--exec-text]">
                        {formatRate(stat.reply_rate)}
                      </span>
                    </td>
                    <td className="px-6 py-3 whitespace-nowrap">
                      {stat.best_issue_type ? (
                        <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-purple-900/30 text-purple-400 border border-purple-800 rounded-full">
                          {formatIssueType(stat.best_issue_type)}
                        </span>
                      ) : (
                        <span className="text-sm text-[--exec-text-muted]">{'\u2014'}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Day of Week Chart */}
      {timingStats.length > 0 && (
        <div>
          <SectionHeader icon={Calendar} title="By Day of Week" />
          <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-6">
            <DayOfWeekChart stats={timingStats} />
          </div>
        </div>
      )}

      {/* Active Insights */}
      <div>
        <SectionHeader icon={TrendingUp} title="Active Insights" />
        {activeInsights.length > 0 ? (
          <div className="space-y-3">
            {activeInsights.map((insight) => (
              <InsightCard key={insight.id} insight={insight} />
            ))}
          </div>
        ) : (
          <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-8 text-center">
            <AlertCircle className="w-8 h-8 text-stone-600 mx-auto mb-3" />
            <p className="text-sm text-[--exec-text-muted]">
              No active insights yet. The learning engine needs more experiment data to generate patterns.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
