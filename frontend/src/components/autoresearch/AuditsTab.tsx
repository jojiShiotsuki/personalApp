import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { autoresearchApi, coldOutreachApi } from '@/lib/api';
import type { AuditResult, OutreachCampaign } from '@/types';
import { AuditStatus } from '@/types';
import {
  Play,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';
import AuditCard from './AuditCard';
import ScreenshotModal from './ScreenshotModal';
import BatchProgress from './BatchProgress';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: AuditStatus.PENDING_REVIEW, label: 'Pending Review' },
  { value: AuditStatus.APPROVED, label: 'Approved' },
  { value: AuditStatus.REJECTED, label: 'Rejected' },
  { value: AuditStatus.SKIPPED, label: 'Skipped' },
] as const;

const PAGE_SIZE = 20;

export default function AuditsTab() {
  const queryClient = useQueryClient();

  // Filter state
  const [campaignId, setCampaignId] = useState<number | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // Batch state
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [auditCount, setAuditCount] = useState<number>(5);

  // Screenshot modal state
  const [screenshotAudit, setScreenshotAudit] = useState<AuditResult | null>(null);

  // Track which audit is currently being sent
  const [sendingAuditId, setSendingAuditId] = useState<number | null>(null);

  // Fetch campaigns for filter dropdown
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns-for-filter'],
    queryFn: () => coldOutreachApi.getCampaigns(),
  });

  // Fetch audits
  const { data: auditsResponse, isLoading: isLoadingAudits } = useQuery({
    queryKey: ['autoresearch-audits', campaignId, statusFilter, page],
    queryFn: () =>
      autoresearchApi.listAudits({
        campaign_id: campaignId,
        status: statusFilter || undefined,
        page,
        page_size: PAGE_SIZE,
      }),
  });

  const audits = auditsResponse?.audits ?? [];
  const totalCount = auditsResponse?.total_count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Batch audit mutation
  const batchAuditMutation = useMutation({
    mutationFn: ({ cId, limit }: { cId: number; limit: number }) => autoresearchApi.batchAudit(cId, limit),
    onSuccess: (data) => {
      setActiveBatchId(data.batch_id);
      toast.success(`Batch started: ${data.total} prospects queued`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to start batch audit'));
    },
  });

  // Approve mutation
  const approveMutation = useMutation({
    mutationFn: ({ auditId, editedSubject, editedBody, subjectVariantUsed }: { auditId: number; editedSubject?: string; editedBody?: string; subjectVariantUsed?: string }) =>
      autoresearchApi.approveAudit(auditId, {
        edited_subject: editedSubject,
        edited_body: editedBody,
        subject_variant_used: subjectVariantUsed,
      }),
    onSuccess: async (_data, variables) => {
      // Find the audit to get the email body for clipboard
      const audit = audits.find((a) => a.id === variables.auditId);
      const bodyToCopy = variables.editedBody || audit?.edited_body || audit?.generated_body || '';

      if (bodyToCopy && audit) {
        // Generate tracking pixel and append to email body
        try {
          const pixel = await autoresearchApi.generateTrackingPixel(audit.prospect_id);
          const bodyWithPixel = bodyToCopy + '\n\n' + pixel.img_tag;
          await navigator.clipboard.writeText(bodyWithPixel);
          toast.success('Approved and copied with tracking pixel');
        } catch {
          // Fallback: copy without pixel if generation fails
          navigator.clipboard.writeText(bodyToCopy).then(
            () => toast.success('Approved and copied (pixel generation failed)'),
            () => toast.success('Approved (clipboard copy failed)')
          );
        }
      } else if (bodyToCopy) {
        navigator.clipboard.writeText(bodyToCopy).then(
          () => toast.success('Approved and copied to clipboard'),
          () => toast.success('Approved (clipboard copy failed)')
        );
      } else {
        toast.success('Audit approved');
      }
      queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to approve audit'));
    },
  });

  // Reject mutation
  const rejectMutation = useMutation({
    mutationFn: ({ auditId, reason, category }: { auditId: number; reason: string; category?: string }) =>
      autoresearchApi.rejectAudit(auditId, reason, category),
    onSuccess: () => {
      toast.success('Audit rejected');
      queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to reject audit'));
    },
  });

  // Feedback mutation
  const feedbackMutation = useMutation({
    mutationFn: ({ auditId, feedback }: { auditId: number; feedback: string }) =>
      autoresearchApi.submitFeedback(auditId, feedback),
    onSuccess: () => {
      toast.success('Feedback submitted');
      queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to submit feedback'));
    },
  });

  const handleApprove = useCallback(
    (auditId: number, editedSubject?: string, editedBody?: string, subjectVariantUsed?: string) => {
      approveMutation.mutate({ auditId, editedSubject, editedBody, subjectVariantUsed });
    },
    [approveMutation]
  );

  const handleReject = useCallback(
    (auditId: number, reason: string, category?: string) => {
      rejectMutation.mutate({ auditId, reason, category });
    },
    [rejectMutation]
  );

  const handleFeedback = useCallback(
    (auditId: number, feedback: string) => {
      feedbackMutation.mutate({ auditId, feedback });
    },
    [feedbackMutation]
  );

  const deleteMutation = useMutation({
    mutationFn: (auditId: number) => autoresearchApi.deleteAudit(auditId),
    onSuccess: () => {
      toast.success('Audit deleted');
      queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to delete audit'));
    },
  });

  const handleDelete = useCallback(
    (auditId: number) => {
      if (window.confirm('Delete this audit? This cannot be undone.')) {
        deleteMutation.mutate(auditId);
      }
    },
    [deleteMutation]
  );

  // Gmail status query
  const { data: gmailStatus } = useQuery({
    queryKey: ['gmail-status'],
    queryFn: () => autoresearchApi.getGmailStatus(),
  });

  const gmailConnected = gmailStatus?.is_connected && gmailStatus?.is_active;

  // Send email mutation
  const sendMutation = useMutation({
    mutationFn: ({ prospectId, subject, body }: { prospectId: number; subject: string; body: string }) =>
      autoresearchApi.sendEmail(prospectId, subject, body),
    onMutate: (variables) => {
      // Find the audit that matches this prospect to track sending state
      const audit = audits.find((a) => a.prospect_id === variables.prospectId);
      if (audit) setSendingAuditId(audit.id);
    },
    onSuccess: (data) => {
      setSendingAuditId(null);
      toast.success(`Email sent to ${data.to}`);
      queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
    },
    onError: (error) => {
      setSendingAuditId(null);
      toast.error(getErrorMessage(error, 'Failed to send email'));
    },
  });

  const handleSend = useCallback(
    (auditId: number, prospectId: number, subject: string, body: string) => {
      // Find the audit to get the prospect email for confirmation
      const audit = audits.find((a) => a.id === auditId);
      const email = audit?.prospect_email || 'this prospect';
      if (!window.confirm(`Send this email to ${email}?`)) return;

      // First approve the audit (creates experiment), then send
      approveMutation.mutate(
        { auditId },
        {
          onSuccess: () => {
            sendMutation.mutate({ prospectId, subject, body });
          },
        }
      );
    },
    [audits, approveMutation, sendMutation]
  );

  const handleBatchComplete = useCallback(() => {
    setActiveBatchId(null);
    queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
  }, [queryClient]);

  const handleStartBatch = () => {
    if (!campaignId) {
      toast.error('Select a campaign first');
      return;
    }
    batchAuditMutation.mutate({ cId: campaignId, limit: auditCount });
  };

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Filters Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Campaign filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[--exec-text-muted]" />
          <select
            value={campaignId ?? ''}
            onChange={(e) => {
              const val = e.target.value;
              setCampaignId(val ? Number(val) : undefined);
              setPage(1);
            }}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm',
              'bg-stone-800/50 border border-stone-600/40',
              'text-[--exec-text] cursor-pointer appearance-none',
              'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
              'transition-all min-w-[180px]'
            )}
          >
            <option value="">All Campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 bg-stone-800/30 p-1 rounded-xl border border-stone-700/30">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(1); }}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200',
                statusFilter === f.value
                  ? 'bg-stone-600/80 text-white shadow-sm font-semibold'
                  : 'text-stone-400 hover:text-stone-200 hover:bg-stone-700/50'
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Batch audit: number picker + button */}
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            max={100}
            value={auditCount}
            onChange={(e) => setAuditCount(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
            className={cn(
              'w-16 px-2 py-2 text-sm text-center rounded-lg',
              'bg-stone-800/50 border border-stone-600/40',
              'text-[--exec-text]',
              'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
            )}
          />
          <button
            onClick={handleStartBatch}
            disabled={!campaignId || batchAuditMutation.isPending || !!activeBatchId}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl shadow-sm transition-all duration-200',
              'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            <Play className="w-4 h-4" />
            Audit {auditCount}
          </button>
          <button
            onClick={async () => {
              try {
                toast.info('Analyzing your edits, feedback, and rejections...');
                const insights = await autoresearchApi.refreshInsights();
                if (insights && insights.length > 0) {
                  // Show top 3 insights
                  const summary = insights.slice(0, 3).map((i: any) => `- ${i.recommendation || i.insight}`).join('\n');
                  toast.success(`AI updated with ${insights.length} insights:\n${summary.substring(0, 200)}`, { duration: 10000 });
                } else {
                  toast.info('Not enough data yet. Keep auditing and the AI will learn from your patterns.');
                }
                queryClient.invalidateQueries({ queryKey: ['autoresearch-audits'] });
                queryClient.invalidateQueries({ queryKey: ['insights'] });
                queryClient.invalidateQueries({ queryKey: ['autoresearch-analytics-overview'] });
              } catch {
                toast.error('Failed to refresh learning');
              }
            }}
            className={cn(
              'px-3 py-2 text-sm font-medium rounded-xl transition-all duration-200',
              'text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50',
            )}
            title="Force the AI to learn from all your feedback, edits, and rejections right now"
          >
            Learn Now
          </button>
        </div>
      </div>

      {/* Batch Progress */}
      {activeBatchId && (
        <BatchProgress batchId={activeBatchId} onComplete={handleBatchComplete} />
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-[--exec-text-muted]">
          {totalCount} audit{totalCount !== 1 ? 's' : ''} found
        </p>
      </div>

      {/* Audit Cards */}
      {isLoadingAudits ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-5 animate-pulse"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="h-6 w-32 bg-stone-700/50 rounded-full" />
                <div className="h-4 w-48 bg-stone-700/50 rounded" />
              </div>
              <div className="h-4 w-full bg-stone-700/30 rounded mb-2" />
              <div className="h-4 w-3/4 bg-stone-700/30 rounded" />
            </div>
          ))}
        </div>
      ) : audits.length === 0 ? (
        <div className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-12 text-center">
          <ClipboardCheck className="w-12 h-12 text-stone-600 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-[--exec-text] mb-2">No audits found</h3>
          <p className="text-[--exec-text-muted] text-sm">
            {campaignId
              ? 'Select a campaign and click "Audit All Queued" to start generating audits.'
              : 'Select a campaign above to view audits, or start a new batch audit.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {audits.map((audit) => (
            <AuditCard
              key={audit.id}
              audit={audit}
              onApprove={handleApprove}
              onReject={handleReject}
              onFeedback={handleFeedback}
              onDelete={handleDelete}
              onSend={handleSend}
              onViewScreenshots={setScreenshotAudit}
              isSending={sendingAuditId === audit.id}
              gmailConnected={!!gmailConnected}
            />
          ))}
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

      {/* Screenshot Modal */}
      {screenshotAudit && (
        <ScreenshotModal
          audit={screenshotAudit}
          isOpen={!!screenshotAudit}
          onClose={() => setScreenshotAudit(null)}
        />
      )}
    </div>
  );
}
