import { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Edit2,
  Copy,
  Monitor,
  Eye,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  SkipForward,
  X,
  MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AuditResult } from '@/types';
import { AuditConfidence, AuditStatus } from '@/types';

// Issue type display config
const ISSUE_LABELS: Record<string, { label: string; color: string }> = {
  broken_links: { label: 'Broken Links', color: 'text-red-400 bg-red-900/30 border-red-800' },
  broken_forms: { label: 'Broken Forms', color: 'text-red-400 bg-red-900/30 border-red-800' },
  dead_pages: { label: 'Dead Pages', color: 'text-red-400 bg-red-900/30 border-red-800' },
  placeholder_text: { label: 'Placeholder Text', color: 'text-orange-400 bg-orange-900/30 border-orange-800' },
  typos: { label: 'Typos', color: 'text-orange-400 bg-orange-900/30 border-orange-800' },
  duplicate_content: { label: 'Duplicate Content', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  frozen_reviews: { label: 'Frozen Reviews', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  no_reviews: { label: 'No Reviews', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  no_real_photos: { label: 'No Real Photos', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  no_contact_visible: { label: 'No Contact Info', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  poor_mobile: { label: 'Poor Mobile', color: 'text-purple-400 bg-purple-900/30 border-purple-800' },
  popup_blocking: { label: 'Popup Blocking', color: 'text-purple-400 bg-purple-900/30 border-purple-800' },
  wall_of_text: { label: 'Wall of Text', color: 'text-indigo-400 bg-indigo-900/30 border-indigo-800' },
  outdated_design: { label: 'Outdated Design', color: 'text-amber-400 bg-amber-900/30 border-amber-800' },
  cluttered_layout: { label: 'Cluttered Layout', color: 'text-amber-400 bg-amber-900/30 border-amber-800' },
  slow_load: { label: 'Slow Load', color: 'text-red-400 bg-red-900/30 border-red-800' },
  invisible_on_google: { label: 'Invisible on Google', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  vague_heading: { label: 'Vague Heading', color: 'text-sky-400 bg-sky-900/30 border-sky-800' },
};

const CONFIDENCE_CONFIG: Record<string, { label: string; dot: string; text: string; bg: string }> = {
  [AuditConfidence.HIGH]: {
    label: 'HIGH CONFIDENCE',
    dot: 'bg-green-500',
    text: 'text-green-400',
    bg: 'bg-green-900/30',
  },
  [AuditConfidence.MEDIUM]: {
    label: 'MEDIUM CONFIDENCE',
    dot: 'bg-yellow-500',
    text: 'text-yellow-400',
    bg: 'bg-yellow-900/30',
  },
  [AuditConfidence.LOW]: {
    label: 'LOW CONFIDENCE',
    dot: 'bg-red-500',
    text: 'text-red-400',
    bg: 'bg-red-900/30',
  },
};

function getIssueLabel(issueType: string | null): { label: string; color: string } {
  if (!issueType) return { label: 'Unknown', color: 'text-gray-400 bg-gray-900/30 border-gray-700' };
  return ISSUE_LABELS[issueType] || { label: issueType.replace(/_/g, ' '), color: 'text-gray-400 bg-gray-900/30 border-gray-700' };
}

interface AuditCardProps {
  audit: AuditResult;
  onApprove: (auditId: number, editedSubject?: string, editedBody?: string) => void;
  onReject: (auditId: number, reason: string) => void;
  onFeedback: (auditId: number, feedback: string) => void;
  onViewScreenshots: (audit: AuditResult) => void;
}

export default function AuditCard({ audit, onApprove, onReject, onFeedback, onViewScreenshots }: AuditCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedSubject, setEditedSubject] = useState(audit.edited_subject || audit.generated_subject || '');
  const [editedBody, setEditedBody] = useState(audit.edited_body || audit.generated_body || '');
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);

  const isSkipped = audit.site_quality === 'good' || audit.status === AuditStatus.SKIPPED;
  const isApproved = audit.status === AuditStatus.APPROVED;
  const isRejected = audit.status === AuditStatus.REJECTED;
  const isReviewed = isApproved || isRejected;

  const confidenceConfig = CONFIDENCE_CONFIG[audit.confidence] || CONFIDENCE_CONFIG[AuditConfidence.LOW];
  const issueConfig = getIssueLabel(audit.issue_type);
  const secondaryIssueConfig = audit.secondary_issue ? getIssueLabel(audit.secondary_issue) : null;

  const displaySubject = isEditing ? editedSubject : (audit.edited_subject || audit.generated_subject);
  const displayBody = isEditing ? editedBody : (audit.edited_body || audit.generated_body);

  const handleApprove = () => {
    const finalSubject = isEditing ? editedSubject : undefined;
    const finalBody = isEditing ? editedBody : undefined;
    onApprove(audit.id, finalSubject, finalBody);
    setIsEditing(false);
  };

  const handleReject = () => {
    if (!rejectionReason.trim()) return;
    onReject(audit.id, rejectionReason.trim());
    setShowRejectInput(false);
    setRejectionReason('');
  };

  const wordCount = displayBody ? displayBody.trim().split(/\s+/).filter(Boolean).length : 0;

  return (
    <div
      className={cn(
        'bg-[--exec-surface] rounded-xl border transition-all duration-200',
        isSkipped
          ? 'border-stone-600/30 opacity-60'
          : isApproved
            ? 'border-green-800/40'
            : isRejected
              ? 'border-red-800/40'
              : 'border-stone-600/40 hover:border-stone-500/50'
      )}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3 cursor-pointer"
        onClick={() => setIsExpanded((prev) => !prev)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Confidence / Skipped Badge */}
          {isSkipped ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-stone-700/50 text-stone-400 rounded-full border border-stone-600/40">
              <SkipForward className="w-3 h-3" />
              SKIPPED
            </span>
          ) : (
            <span className={cn(
              'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border',
              confidenceConfig.bg,
              confidenceConfig.text,
              audit.confidence === AuditConfidence.HIGH ? 'border-green-800' :
              audit.confidence === AuditConfidence.MEDIUM ? 'border-yellow-800' : 'border-red-800'
            )}>
              <div className={cn('w-2 h-2 rounded-full', confidenceConfig.dot)} />
              {confidenceConfig.label}
            </span>
          )}

          {/* Status badge for reviewed audits */}
          {isApproved && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-green-400 bg-green-900/30 rounded-full border border-green-800">
              <CheckCircle className="w-3 h-3" />
              Approved
            </span>
          )}
          {isRejected && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-red-400 bg-red-900/30 rounded-full border border-red-800">
              <XCircle className="w-3 h-3" />
              Rejected
            </span>
          )}

          {/* Prospect info */}
          <div className="min-w-0">
            <span className="text-sm font-semibold text-[--exec-text] truncate">
              {audit.prospect_company || audit.prospect_name || `Prospect #${audit.prospect_id}`}
            </span>
            {(audit.prospect_niche || audit.prospect_city) && (
              <span className="text-xs text-[--exec-text-muted] ml-2">
                {[audit.prospect_niche, audit.prospect_city].filter(Boolean).join(' \u2014 ')}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {audit.audit_duration_seconds != null && (
            <span className="text-xs text-[--exec-text-muted]">
              {audit.audit_duration_seconds.toFixed(1)}s
            </span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-[--exec-text-muted]" />
          ) : (
            <ChevronDown className="w-4 h-4 text-[--exec-text-muted]" />
          )}
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-4">
          {/* Skipped state */}
          {isSkipped && (
            <div className="flex items-center gap-2 text-sm text-stone-400 bg-stone-800/30 rounded-lg p-3 border border-stone-700/30">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>Site quality rated as <strong>good</strong> — no actionable issues found.</span>
            </div>
          )}

          {/* Issue badges */}
          {!isSkipped && audit.issue_type && (
            <div className="space-y-2">
              {/* Primary issue */}
              <div className="flex items-start gap-3">
                <span className={cn(
                  'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border flex-shrink-0',
                  issueConfig.color
                )}>
                  {issueConfig.label}
                </span>
                {audit.issue_detail && (
                  <p className="text-sm text-[--exec-text-secondary] leading-relaxed">
                    &ldquo;{audit.issue_detail}&rdquo;
                  </p>
                )}
              </div>

              {/* Secondary issue */}
              {secondaryIssueConfig && (
                <div className="flex items-start gap-3">
                  <span className={cn(
                    'inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-full border flex-shrink-0',
                    secondaryIssueConfig.color
                  )}>
                    {secondaryIssueConfig.label}
                  </span>
                  {audit.secondary_detail && (
                    <p className="text-sm text-[--exec-text-muted] leading-relaxed">
                      &ldquo;{audit.secondary_detail}&rdquo;
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Subject line */}
          {!isSkipped && displaySubject && (
            <div>
              <label className="block text-xs font-medium text-[--exec-text-muted] mb-1">Subject</label>
              {isEditing ? (
                <input
                  type="text"
                  value={editedSubject}
                  onChange={(e) => setEditedSubject(e.target.value)}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg',
                    'bg-stone-800/50 border border-stone-600/40',
                    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                    'transition-all text-sm'
                  )}
                />
              ) : (
                <div className="text-sm text-[--exec-text] bg-stone-800/30 rounded-lg px-4 py-2.5 border border-stone-700/30">
                  {displaySubject}
                </div>
              )}
            </div>
          )}

          {/* Email body */}
          {!isSkipped && displayBody && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-[--exec-text-muted]">Email Body</label>
                <span className={cn(
                  'text-xs font-medium',
                  wordCount > 80 ? 'text-red-400' : 'text-[--exec-text-muted]'
                )}>
                  {wordCount} words {wordCount > 80 && '(over limit!)'}
                </span>
              </div>
              {isEditing ? (
                <textarea
                  value={editedBody}
                  onChange={(e) => setEditedBody(e.target.value)}
                  rows={8}
                  className={cn(
                    'w-full px-4 py-2.5 rounded-lg',
                    'bg-stone-800/50 border border-stone-600/40',
                    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                    'transition-all text-sm resize-none'
                  )}
                />
              ) : (
                <div className="text-sm text-[--exec-text-secondary] bg-stone-800/30 rounded-lg px-4 py-2.5 border border-stone-700/30 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {displayBody}
                </div>
              )}
            </div>
          )}

          {/* Rejection reason display */}
          {isRejected && audit.rejection_reason && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 rounded-lg p-3 border border-red-800/30">
              <XCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>Rejected: {audit.rejection_reason}</span>
            </div>
          )}

          {/* Rejection reason input */}
          {showRejectInput && (
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Rejection reason..."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleReject(); }}
                className={cn(
                  'flex-1 px-3 py-2 rounded-lg text-sm',
                  'bg-stone-800/50 border border-stone-600/40',
                  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                  'focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50',
                  'transition-all'
                )}
                autoFocus
              />
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim()}
                className="px-3 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm
              </button>
              <button
                onClick={() => { setShowRejectInput(false); setRejectionReason(''); }}
                className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Action buttons */}
          {!isSkipped && !isReviewed && (
            <div className="flex items-center gap-2 pt-2 border-t border-stone-700/30">
              {(audit.desktop_screenshot || audit.mobile_screenshot) && (
                <button
                  onClick={() => onViewScreenshots(audit)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  <Monitor className="w-3.5 h-3.5" />
                  Screenshots
                </button>
              )}

              <button
                onClick={handleApprove}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all"
              >
                <Copy className="w-3.5 h-3.5" />
                Approve & Copy
              </button>

              <button
                onClick={() => setIsEditing((prev) => !prev)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  isEditing
                    ? 'text-[--exec-accent] bg-[--exec-accent-bg-subtle] border border-[--exec-accent]/30'
                    : 'text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50'
                )}
              >
                <Edit2 className="w-3.5 h-3.5" />
                {isEditing ? 'Editing...' : 'Edit'}
              </button>

              <button
                onClick={() => setShowFeedback((prev) => !prev)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors',
                  showFeedback
                    ? 'text-blue-400 bg-blue-900/30 border border-blue-800/40'
                    : 'text-[--exec-text-secondary] bg-stone-700/50 hover:bg-stone-600/50'
                )}
              >
                <MessageSquare className="w-3.5 h-3.5" />
                Feedback
              </button>

              {!showRejectInput && (
                <button
                  onClick={() => setShowRejectInput(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-400 bg-red-900/20 rounded-lg hover:bg-red-900/30 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              )}

              {audit.needs_verification && (
                <span className="ml-auto inline-flex items-center gap-1 text-xs text-yellow-400">
                  <Eye className="w-3 h-3" />
                  Needs verification
                </span>
              )}
            </div>
          )}

          {/* Feedback textarea */}
          {showFeedback && (
            <div className="mt-3 pt-3 border-t border-stone-700/30">
              <label className="text-xs font-medium text-stone-400 mb-1.5 block">
                Correction / Feedback for the AI
              </label>
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="e.g. Secondary issue was wrong — mobile cards load fine, just slow to render..."
                className={cn(
                  'w-full px-3 py-2 rounded-lg text-sm',
                  'bg-stone-800/50 border border-stone-600/40',
                  'text-[--exec-text] placeholder:text-stone-500',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'resize-none'
                )}
                rows={2}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { onFeedback(audit.id, feedbackText); setShowFeedback(false); setFeedbackText(''); }}
                  disabled={!feedbackText.trim()}
                  className="px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Submit Feedback
                </button>
                <button
                  onClick={() => { setShowFeedback(false); setFeedbackText(''); }}
                  className="px-3 py-1.5 text-xs font-medium text-stone-400 bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Reviewed cards: show screenshots only */}
          {isReviewed && (audit.desktop_screenshot || audit.mobile_screenshot) && (
            <div className="pt-2 border-t border-stone-700/30">
              <button
                onClick={() => onViewScreenshots(audit)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                <Monitor className="w-3.5 h-3.5" />
                View Screenshots
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
