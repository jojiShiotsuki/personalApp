import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loomAuditApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Video,
  Eye,
  MessageSquare,
  Clock,
  ExternalLink,
  Check,
  AlertTriangle,
  ChevronRight,
  Phone,
  Loader2,
} from 'lucide-react';
import type { LoomAudit, LoomResponseType } from '@/types';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Link } from 'react-router-dom';

interface AuditCardProps {
  audit: LoomAudit;
  onMarkWatched: (id: number) => void;
  onMarkResponded: (id: number, type: LoomResponseType) => void;
  onMarkFollowUpSent: (id: number) => void;
  isUpdating: number | null;
}

function AuditCard({
  audit,
  onMarkWatched,
  onMarkResponded,
  onMarkFollowUpSent,
  isUpdating,
}: AuditCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        audit.needs_follow_up
          ? 'bg-[--exec-warning-bg] border-[--exec-warning]'
          : audit.response_received
            ? 'bg-[--exec-sage-bg] border-[--exec-sage]'
            : 'bg-[--exec-surface-alt] border-[--exec-border-subtle]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[--exec-text] truncate">{audit.title}</p>
            <a
              href={audit.loom_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[--exec-accent] hover:text-[--exec-accent-dark] shrink-0"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
          </div>
          <p className="text-sm text-[--exec-text-muted] mt-0.5">
            {audit.contact_name}
            {audit.contact_company && ` · ${audit.contact_company}`}
          </p>
          <div className="flex items-center gap-3 mt-2 text-xs text-[--exec-text-muted]">
            <span>{format(parseISO(audit.sent_date), 'MMM d')}</span>
            {audit.days_since_sent > 0 && (
              <span>· {audit.days_since_sent}d ago</span>
            )}
            {audit.watched && (
              <span className="flex items-center gap-1 text-[--exec-info]">
                <Eye className="w-3 h-3" />
                Watched
              </span>
            )}
            {audit.response_received && (
              <span className="flex items-center gap-1 text-[--exec-sage]">
                <MessageSquare className="w-3 h-3" />
                {audit.response_type?.replace('_', ' ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {audit.needs_follow_up && (
            <span className="text-xs font-bold text-[--exec-warning] bg-[--exec-warning]/10 px-2 py-1 rounded-full">
              Follow up
            </span>
          )}

          <button
            onClick={() => setShowActions(!showActions)}
            className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface] rounded-lg transition-colors"
          >
            <ChevronRight
              className={cn(
                'w-4 h-4 transition-transform',
                showActions && 'rotate-90'
              )}
            />
          </button>
        </div>
      </div>

      {showActions && (
        <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-[--exec-border-subtle]">
          {!audit.watched && (
            <button
              onClick={() => onMarkWatched(audit.id)}
              disabled={isUpdating === audit.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[--exec-info-bg] text-[--exec-info] rounded-lg hover:bg-[--exec-info]/20 transition-colors disabled:opacity-50"
            >
              {isUpdating === audit.id ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Eye className="w-3 h-3" />
              )}
              Mark Watched
            </button>
          )}

          {!audit.response_received && (
            <>
              <button
                onClick={() => onMarkResponded(audit.id, 'interested' as LoomResponseType)}
                disabled={isUpdating === audit.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[--exec-sage-bg] text-[--exec-sage] rounded-lg hover:bg-[--exec-sage]/20 transition-colors disabled:opacity-50"
              >
                <Check className="w-3 h-3" />
                Interested
              </button>
              <button
                onClick={() => onMarkResponded(audit.id, 'booked_call' as LoomResponseType)}
                disabled={isUpdating === audit.id}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[--exec-accent-bg] text-[--exec-accent] rounded-lg hover:bg-[--exec-accent]/20 transition-colors disabled:opacity-50"
              >
                <Phone className="w-3 h-3" />
                Booked Call
              </button>
            </>
          )}

          {audit.needs_follow_up && (
            <button
              onClick={() => onMarkFollowUpSent(audit.id)}
              disabled={isUpdating === audit.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[--exec-warning-bg] text-[--exec-warning] rounded-lg hover:bg-[--exec-warning]/20 transition-colors disabled:opacity-50"
            >
              <Clock className="w-3 h-3" />
              Follow-up Sent
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function LoomAuditTracker() {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['loom-audits'],
    queryFn: () => loomAuditApi.getAll({ limit: 10 }),
  });

  const { data: needsFollowUp = [] } = useQuery({
    queryKey: ['loom-audits-follow-up'],
    queryFn: () => loomAuditApi.getNeedsFollowUp(5),
  });

  const watchedMutation = useMutation({
    mutationFn: (id: number) => loomAuditApi.markWatched(id),
    onMutate: (id) => setUpdatingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loom-audits'] });
    },
    onSettled: () => setUpdatingId(null),
  });

  const respondedMutation = useMutation({
    mutationFn: ({ id, type }: { id: number; type: LoomResponseType }) =>
      loomAuditApi.markResponded(id, { response_type: type }),
    onMutate: ({ id }) => setUpdatingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loom-audits'] });
    },
    onSettled: () => setUpdatingId(null),
  });

  const followUpMutation = useMutation({
    mutationFn: (id: number) => loomAuditApi.markFollowUpSent(id),
    onMutate: (id) => setUpdatingId(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loom-audits'] });
      queryClient.invalidateQueries({ queryKey: ['loom-audits-follow-up'] });
    },
    onSettled: () => setUpdatingId(null),
  });

  if (isLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-6 bg-[--exec-surface-alt] rounded w-40 mb-4" />
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-[--exec-surface-alt] rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-[--exec-surface-alt] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const audits = data?.audits || [];

  if (!stats || stats.total_sent === 0) {
    return (
      <div className="bento-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-warning-bg] to-[--exec-warning-bg-subtle] flex items-center justify-center">
            <Video className="w-5 h-5 text-[--exec-warning]" />
          </div>
          <div>
            <h2 className="font-semibold text-[--exec-text]">Loom Audits</h2>
            <p className="text-xs text-[--exec-text-muted]">
              Track personalized video audits
            </p>
          </div>
        </div>

        <div className="text-center py-8">
          <Video className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-3 opacity-30" />
          <p className="text-sm text-[--exec-text-muted] mb-4">
            No Loom audits recorded yet
          </p>
          <p className="text-xs text-[--exec-text-muted] max-w-xs mx-auto">
            Record personalized website audits for prospects to stand out and
            book more calls.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bento-card overflow-hidden animate-fade-slide-up">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-warning-bg] to-[--exec-warning-bg-subtle] flex items-center justify-center">
            <Video className="w-5 h-5 text-[--exec-warning]" />
          </div>
          <div>
            <h2 className="font-semibold text-[--exec-text]">Loom Audits</h2>
            <p className="text-xs text-[--exec-text-muted]">
              {stats.total_sent} sent · {stats.response_rate}% response rate
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {needsFollowUp.length > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-warning-bg] rounded-full">
              <AlertTriangle className="w-4 h-4 text-[--exec-warning]" />
              <span className="text-sm font-bold text-[--exec-warning]">
                {needsFollowUp.length} need follow-up
              </span>
            </div>
          )}

          {stats.booked_calls > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-sage-bg] rounded-full">
              <Phone className="w-4 h-4 text-[--exec-sage]" />
              <span className="text-sm font-bold text-[--exec-sage]">
                {stats.booked_calls} calls booked
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4 p-6 border-b border-[--exec-border-subtle]">
        <div className="text-center">
          <p className="text-2xl font-bold text-[--exec-text]">{stats.total_sent}</p>
          <p className="text-xs text-[--exec-text-muted]">Sent</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[--exec-info]">{stats.watch_rate}%</p>
          <p className="text-xs text-[--exec-text-muted]">Watch Rate</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[--exec-sage]">{stats.total_responded}</p>
          <p className="text-xs text-[--exec-text-muted]">Responses</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-[--exec-accent]">{stats.booked_calls}</p>
          <p className="text-xs text-[--exec-text-muted]">Calls Booked</p>
        </div>
      </div>

      {/* Recent Audits */}
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-[--exec-text-secondary]">
            Recent Audits
          </h3>
          <Link
            to="/contacts"
            className="text-xs text-[--exec-accent] hover:text-[--exec-accent-dark] font-medium"
          >
            View all
          </Link>
        </div>

        <div className="space-y-3">
          {audits.slice(0, 5).map((audit) => (
            <AuditCard
              key={audit.id}
              audit={audit}
              onMarkWatched={(id) => watchedMutation.mutate(id)}
              onMarkResponded={(id, type) =>
                respondedMutation.mutate({ id, type })
              }
              onMarkFollowUpSent={(id) => followUpMutation.mutate(id)}
              isUpdating={updatingId}
            />
          ))}
        </div>

        {audits.length === 0 && (
          <p className="text-sm text-[--exec-text-muted] text-center py-4">
            No recent audits
          </p>
        )}
      </div>
    </div>
  );
}
