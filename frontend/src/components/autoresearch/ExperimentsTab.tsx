import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { autoresearchApi, coldOutreachApi } from '@/lib/api';
import type { ExperimentRecord, OutreachCampaign, AnalyticsOverview } from '@/types';
import { ExperimentStatus } from '@/types';
import {
  Filter,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  TestTubes,
  Send,
  Reply,
  TrendingUp,
  Trophy,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Constants ──────────────────────────────────────────

const PAGE_SIZE = 20;

const NICHE_OPTIONS = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Roofing',
  'Landscaping',
  'Building',
] as const;

const ISSUE_TYPE_OPTIONS = [
  'broken_links',
  'broken_forms',
  'dead_pages',
  'placeholder_text',
  'typos',
  'duplicate_content',
  'frozen_reviews',
  'no_reviews',
  'no_real_photos',
  'no_contact_visible',
  'poor_mobile',
  'popup_blocking',
  'wall_of_text',
  'outdated_design',
  'cluttered_layout',
  'slow_load',
  'invisible_on_google',
  'vague_heading',
] as const;

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: ExperimentStatus.DRAFT, label: 'Draft' },
  { value: ExperimentStatus.SENT, label: 'Sent' },
  { value: ExperimentStatus.REPLIED, label: 'Replied' },
  { value: ExperimentStatus.NO_REPLY, label: 'No Reply' },
  { value: ExperimentStatus.BOUNCED, label: 'Bounced' },
] as const;

// ── Helpers ────────────────────────────────────────────

function formatIssueType(issueType: string): string {
  return issueType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
}

function formatResponseTime(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return '\u2014';
  if (minutes < 60) return `${Math.round(minutes)}min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)}d`;
}

function getOutcomeDisplay(exp: ExperimentRecord): {
  icon: string;
  label: string;
  className: string;
} {
  if (exp.replied || exp.status === ExperimentStatus.REPLIED) {
    return {
      icon: '\u2705',
      label: 'replied',
      className:
        'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800',
    };
  }
  if (exp.status === ExperimentStatus.BOUNCED) {
    return {
      icon: '\u274C',
      label: 'bounced',
      className:
        'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    };
  }
  if (exp.status === ExperimentStatus.NO_REPLY) {
    return {
      icon: '\u274C',
      label: 'exhausted',
      className:
        'bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800',
    };
  }
  if (exp.status === ExperimentStatus.SENT) {
    return {
      icon: '\u23F3',
      label: `step ${exp.step_number}`,
      className:
        'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    };
  }
  // draft
  return {
    icon: '\u23F3',
    label: 'draft',
    className:
      'bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
  };
}

// ── Stats Bar Component ────────────────────────────────

function StatsBar({ overview }: { overview: AnalyticsOverview | undefined }) {
  const stats = [
    {
      label: 'Total Sent',
      value: overview?.total_sent ?? 0,
      icon: Send,
      color: 'text-blue-500',
    },
    {
      label: 'Reply Rate',
      value: overview
        ? `${(overview.overall_reply_rate * 100).toFixed(1)}%`
        : '0%',
      icon: Reply,
      color: 'text-green-500',
    },
    {
      label: 'Best Issue Type',
      value: overview?.best_issue_type
        ? formatIssueType(overview.best_issue_type)
        : '\u2014',
      icon: Trophy,
      color: 'text-amber-500',
    },
    {
      label: 'Avg Response',
      value: overview?.avg_response_time_minutes
        ? formatResponseTime(overview.avg_response_time_minutes)
        : '\u2014',
      icon: Clock,
      color: 'text-purple-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <div
            key={stat.label}
            className={cn(
              'bg-[--exec-surface] rounded-xl border border-stone-600/40 p-4',
              'flex items-center gap-3'
            )}
          >
            <div
              className={cn(
                'w-10 h-10 rounded-lg flex items-center justify-center',
                'bg-stone-800/50'
              )}
            >
              <Icon className={cn('w-5 h-5', stat.color)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[--exec-text-muted] truncate">
                {stat.label}
              </p>
              <p className="text-lg font-semibold text-[--exec-text] truncate">
                {stat.value}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Expanded Row Detail ────────────────────────────────

function ExperimentDetail({ exp }: { exp: ExperimentRecord }) {
  return (
    <tr>
      <td
        colSpan={6}
        className="px-6 py-4 bg-stone-800/30 border-b border-stone-700/30"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Audit Info */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[--exec-text] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[--exec-accent]" />
              Audit Details
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex gap-2">
                <span className="text-[--exec-text-muted] w-28 shrink-0">
                  Issue:
                </span>
                <span className="text-[--exec-text]">
                  {exp.issue_type ? formatIssueType(exp.issue_type) : '\u2014'}
                </span>
              </div>
              {exp.issue_detail && (
                <div className="flex gap-2">
                  <span className="text-[--exec-text-muted] w-28 shrink-0">
                    Detail:
                  </span>
                  <span className="text-[--exec-text-secondary]">
                    {exp.issue_detail}
                  </span>
                </div>
              )}
              {exp.secondary_issue && (
                <div className="flex gap-2">
                  <span className="text-[--exec-text-muted] w-28 shrink-0">
                    Secondary:
                  </span>
                  <span className="text-[--exec-text-secondary]">
                    {formatIssueType(exp.secondary_issue)}
                  </span>
                </div>
              )}
              <div className="flex gap-2">
                <span className="text-[--exec-text-muted] w-28 shrink-0">
                  Confidence:
                </span>
                <span className="text-[--exec-text-secondary]">
                  {exp.confidence ?? '\u2014'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[--exec-text-muted] w-28 shrink-0">
                  Niche:
                </span>
                <span className="text-[--exec-text-secondary]">
                  {exp.niche ?? '\u2014'}
                </span>
              </div>
              <div className="flex gap-2">
                <span className="text-[--exec-text-muted] w-28 shrink-0">
                  City:
                </span>
                <span className="text-[--exec-text-secondary]">
                  {exp.city ?? '\u2014'}
                </span>
              </div>
              {exp.was_edited && (
                <div className="flex gap-2">
                  <span className="text-[--exec-text-muted] w-28 shrink-0">
                    Edited:
                  </span>
                  <span className="text-amber-400 text-xs font-medium">
                    Yes (manually edited before send)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Email Content */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-[--exec-text] flex items-center gap-2">
              <Send className="w-4 h-4 text-[--exec-accent]" />
              Email Content
            </h4>

            {exp.subject && (
              <div className="space-y-1">
                <p className="text-xs text-[--exec-text-muted]">Subject</p>
                <p className="text-sm font-medium text-[--exec-text] bg-stone-800/50 px-3 py-2 rounded-lg border border-stone-700/30">
                  {exp.subject}
                </p>
              </div>
            )}

            {exp.body && (
              <div className="space-y-1">
                <p className="text-xs text-[--exec-text-muted]">Body</p>
                <p className="text-sm text-[--exec-text-secondary] bg-stone-800/50 px-3 py-2 rounded-lg border border-stone-700/30 whitespace-pre-wrap max-h-40 overflow-y-auto">
                  {exp.body}
                </p>
              </div>
            )}

            {exp.word_count !== null && (
              <p className="text-xs text-[--exec-text-muted]">
                {exp.word_count} words
              </p>
            )}

            {/* Conversion tracking */}
            {(exp.converted_to_call || exp.converted_to_client) && (
              <div className="pt-2 border-t border-stone-700/30 space-y-1">
                {exp.converted_to_call && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-green-900/30 text-green-400 border border-green-800 rounded-full">
                    Converted to Call
                  </span>
                )}
                {exp.converted_to_client && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-900/30 text-emerald-400 border border-emerald-800 rounded-full ml-2">
                    Won Client
                    {exp.deal_value !== null &&
                      ` ($${exp.deal_value.toLocaleString()})`}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Reply section (if replied) */}
        {exp.replied && exp.sentiment && (
          <div className="mt-4 pt-4 border-t border-stone-700/30 space-y-2">
            <h4 className="text-sm font-semibold text-[--exec-text] flex items-center gap-2">
              <Reply className="w-4 h-4 text-green-400" />
              Reply Info
            </h4>
            <div className="flex gap-4 text-sm">
              <div className="flex gap-2">
                <span className="text-[--exec-text-muted]">Sentiment:</span>
                <span className="text-[--exec-text]">{exp.sentiment}</span>
              </div>
              {exp.category && (
                <div className="flex gap-2">
                  <span className="text-[--exec-text-muted]">Category:</span>
                  <span className="text-[--exec-text]">{exp.category}</span>
                </div>
              )}
              {exp.response_time_minutes !== null && (
                <div className="flex gap-2">
                  <span className="text-[--exec-text-muted]">
                    Response time:
                  </span>
                  <span className="text-[--exec-text]">
                    {formatResponseTime(exp.response_time_minutes)}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </td>
    </tr>
  );
}

// ── Main Component ─────────────────────────────────────

export default function ExperimentsTab() {
  // Filter state
  const [campaignId, setCampaignId] = useState<number | undefined>(undefined);
  const [niche, setNiche] = useState<string>('');
  const [issueType, setIssueType] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Fetch campaigns for filter
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns-for-experiments'],
    queryFn: () => coldOutreachApi.getCampaigns(),
  });

  // Fetch analytics overview
  const { data: overview } = useQuery<AnalyticsOverview>({
    queryKey: ['autoresearch-analytics-overview'],
    queryFn: () => autoresearchApi.getAnalyticsOverview(),
  });

  // Fetch experiments
  const { data: experimentsResponse, isLoading } = useQuery({
    queryKey: [
      'autoresearch-experiments',
      campaignId,
      niche,
      issueType,
      statusFilter,
      page,
    ],
    queryFn: () =>
      autoresearchApi.listExperiments({
        campaign_id: campaignId,
        niche: niche || undefined,
        issue_type: issueType || undefined,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const experiments = experimentsResponse?.experiments ?? [];
  const totalCount = experimentsResponse?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const resetFilters = () => {
    setCampaignId(undefined);
    setNiche('');
    setIssueType('');
    setStatusFilter('');
    setPage(1);
  };

  const hasActiveFilters = !!(campaignId || niche || issueType || statusFilter);

  const selectClasses = cn(
    'px-3 py-1.5 rounded-lg text-sm',
    'bg-stone-800/50 border border-stone-600/40',
    'text-[--exec-text] cursor-pointer appearance-none',
    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
    'transition-all min-w-[150px]'
  );

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Stats Bar */}
      <StatsBar overview={overview} />

      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-[--exec-text-muted]" />

        {/* Campaign filter */}
        <select
          value={campaignId ?? ''}
          onChange={(e) => {
            setCampaignId(e.target.value ? Number(e.target.value) : undefined);
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="">All Campaigns</option>
          {campaigns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Niche filter */}
        <select
          value={niche}
          onChange={(e) => {
            setNiche(e.target.value);
            setPage(1);
          }}
          className={selectClasses}
        >
          <option value="">All Niches</option>
          {NICHE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>

        {/* Issue Type filter */}
        <select
          value={issueType}
          onChange={(e) => {
            setIssueType(e.target.value);
            setPage(1);
          }}
          className={cn(selectClasses, 'min-w-[180px]')}
        >
          <option value="">All Issue Types</option>
          {ISSUE_TYPE_OPTIONS.map((it) => (
            <option key={it} value={it}>
              {formatIssueType(it)}
            </option>
          ))}
        </select>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 bg-stone-800/30 p-1 rounded-xl border border-stone-700/30">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => {
                setStatusFilter(f.value);
                setPage(1);
              }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                statusFilter === f.value
                  ? 'bg-[--exec-accent] text-white shadow-sm'
                  : 'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="px-3 py-1.5 text-xs font-medium text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[--exec-text-muted]">
          {totalCount} experiment{totalCount !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 overflow-hidden">
          <div className="divide-y divide-stone-700/30">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-6 py-4 animate-pulse flex gap-6">
                <div className="h-4 w-32 bg-stone-700/50 rounded" />
                <div className="h-4 w-24 bg-stone-700/50 rounded" />
                <div className="h-4 w-20 bg-stone-700/50 rounded" />
                <div className="h-4 w-16 bg-stone-700/50 rounded" />
                <div className="h-4 w-24 bg-stone-700/50 rounded" />
              </div>
            ))}
          </div>
        </div>
      ) : experiments.length === 0 ? (
        <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-12 text-center">
          <TestTubes className="w-12 h-12 text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[--exec-text] mb-2">
            No experiments found
          </h3>
          <p className="text-[--exec-text-muted] text-sm">
            {hasActiveFilters
              ? 'Try adjusting your filters to see more results.'
              : 'Experiments will appear here once audits are approved and emails are sent.'}
          </p>
        </div>
      ) : (
        <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 overflow-hidden">
          <table className="min-w-full divide-y divide-stone-700/30">
            <thead className="bg-stone-700/30">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                  Issue Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                  Sent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                  Reply
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                  Outcome
                </th>
                <th className="px-6 py-3 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-700/30">
              {experiments.map((exp) => {
                const outcome = getOutcomeDisplay(exp);
                const isExpanded = expandedId === exp.id;

                return (
                  <>
                    <tr
                      key={exp.id}
                      onClick={() =>
                        setExpandedId(isExpanded ? null : exp.id)
                      }
                      className={cn(
                        'hover:bg-stone-700/30 cursor-pointer transition-colors duration-200',
                        isExpanded && 'bg-stone-700/20'
                      )}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-[--exec-text]">
                          {exp.company ?? '\u2014'}
                        </div>
                        {exp.niche && (
                          <div className="text-xs text-[--exec-text-muted]">
                            {exp.niche}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {exp.issue_type ? (
                          <span className="inline-flex items-center px-2.5 py-1 text-xs font-medium bg-purple-900/30 text-purple-400 border border-purple-800 rounded-full">
                            {formatIssueType(exp.issue_type)}
                          </span>
                        ) : (
                          <span className="text-sm text-[--exec-text-muted]">
                            {'\u2014'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                        {formatDate(exp.sent_at)}
                        {exp.day_of_week && (
                          <span className="text-xs text-[--exec-text-muted] ml-1">
                            ({exp.day_of_week.slice(0, 3)})
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                        {formatResponseTime(exp.response_time_minutes)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border rounded-full',
                            outcome.className
                          )}
                        >
                          <span>{outcome.icon}</span>
                          {outcome.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-[--exec-text-muted]" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-[--exec-text-muted]" />
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <ExperimentDetail key={`detail-${exp.id}`} exp={exp} />
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn(
                    'w-8 h-8 text-sm font-medium rounded-lg transition-all',
                    page === pageNum
                      ? 'bg-[--exec-accent] text-white shadow-sm'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50'
                  )}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
