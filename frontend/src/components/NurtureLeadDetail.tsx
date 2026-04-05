import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Check,
  Circle,
  Mail,
  Globe,
  Clock,
  ArrowRightCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Target,
  XCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { nurtureApi } from '@/lib/api';
import { NurtureLead, NurtureStatus, FollowupStage } from '@/types';
import { toast } from 'sonner';

const NURTURE_STEPS: Record<number, string> = {
  1: 'Reply with value',
  2: 'Free goodwill offer',
  3: 'Deliver the free thing',
  4: 'Book a call',
  5: 'Make the offer / close',
};

const FOLLOWUP_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  [FollowupStage.DAY_2]: {
    bg: 'bg-red-500/20',
    text: 'text-red-400',
    border: 'border-red-500/30',
  },
  [FollowupStage.DAY_5]: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  [FollowupStage.DAY_10]: {
    bg: 'bg-yellow-500/20',
    text: 'text-yellow-400',
    border: 'border-yellow-500/30',
  },
  [FollowupStage.LONG_TERM]: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    border: 'border-blue-500/30',
  },
};

const FOLLOWUP_LABELS: Record<string, string> = {
  [FollowupStage.DAY_2]: 'Day 2 Follow-up',
  [FollowupStage.DAY_5]: 'Day 5 Follow-up',
  [FollowupStage.DAY_10]: 'Day 10 Follow-up',
  [FollowupStage.LONG_TERM]: 'Long-term Nurture',
};

const STATUS_BADGES: Record<string, { bg: string; text: string }> = {
  [NurtureStatus.ACTIVE]: { bg: 'bg-green-500/20', text: 'text-green-400' },
  [NurtureStatus.QUIET]: { bg: 'bg-amber-500/20', text: 'text-amber-400' },
  [NurtureStatus.LONG_TERM]: { bg: 'bg-blue-500/20', text: 'text-blue-400' },
  [NurtureStatus.CONVERTED]: { bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
  [NurtureStatus.LOST]: { bg: 'bg-red-500/20', text: 'text-red-400' },
};

const DEAL_STAGES = ['Lead', 'Qualified', 'Proposal', 'Negotiation'] as const;

interface NurtureLeadDetailProps {
  lead: NurtureLead;
  isOpen: boolean;
  onClose: () => void;
}

const inputClasses = cn(
  'w-full px-4 py-2.5 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function NurtureLeadDetail({ lead, isOpen, onClose }: NurtureLeadDetailProps) {
  const queryClient = useQueryClient();

  // Step complete form
  const [stepNotes, setStepNotes] = useState('');

  // Follow-up form
  const [followupNotes, setFollowupNotes] = useState('');

  // Convert form
  const [showConvertForm, setShowConvertForm] = useState(false);
  const [dealTitle, setDealTitle] = useState('');
  const [dealValue, setDealValue] = useState<number | ''>('');
  const [dealStage, setDealStage] = useState<string>('Lead');

  // Mark lost
  const [showLostConfirm, setShowLostConfirm] = useState(false);
  const [lostNotes, setLostNotes] = useState('');

  const invalidateQueries = () => {
    queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
    queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
  };

  const completeStepMutation = useMutation({
    mutationFn: (data: { notes?: string }) => nurtureApi.completeStep(lead.id, data),
    onSuccess: () => {
      toast.success('Step completed!');
      setStepNotes('');
      invalidateQueries();
    },
    onError: () => {
      toast.error('Failed to complete step');
    },
  });

  const logFollowupMutation = useMutation({
    mutationFn: (data: { notes?: string }) => nurtureApi.logFollowup(lead.id, data),
    onSuccess: () => {
      toast.success('Follow-up logged');
      setFollowupNotes('');
      invalidateQueries();
    },
    onError: () => {
      toast.error('Failed to log follow-up');
    },
  });

  const convertMutation = useMutation({
    mutationFn: (data: { deal_title?: string; deal_value?: number; deal_stage?: string }) =>
      nurtureApi.convert(lead.id, data),
    onSuccess: () => {
      toast.success('Deal created!');
      setShowConvertForm(false);
      setDealTitle('');
      setDealValue('');
      setDealStage('Lead');
      invalidateQueries();
    },
    onError: () => {
      toast.error('Failed to convert lead');
    },
  });

  const markLostMutation = useMutation({
    mutationFn: (data: { notes?: string }) => nurtureApi.markLost(lead.id, data),
    onSuccess: () => {
      toast.success('Lead marked as lost');
      setShowLostConfirm(false);
      setLostNotes('');
      invalidateQueries();
      onClose();
    },
    onError: () => {
      toast.error('Failed to mark lead as lost');
    },
  });

  if (!isOpen) return null;

  const isTerminal = lead.status === NurtureStatus.CONVERTED || lead.status === NurtureStatus.LOST;

  // Build step data by merging NURTURE_STEPS with step_logs
  const stepLogMap = new Map(lead.step_logs.map((log) => [log.step_number, log]));

  const handleCompleteStep = () => {
    const notes = stepNotes.trim() || undefined;
    completeStepMutation.mutate({ notes });
  };

  const handleLogFollowup = () => {
    const notes = followupNotes.trim() || undefined;
    logFollowupMutation.mutate({ notes });
  };

  const handleConvert = (e: React.FormEvent) => {
    e.preventDefault();
    convertMutation.mutate({
      deal_title: dealTitle.trim() || undefined,
      deal_value: dealValue !== '' ? Number(dealValue) : undefined,
      deal_stage: dealStage,
    });
  };

  const handleMarkLost = () => {
    const notes = lostNotes.trim() || undefined;
    markLostMutation.mutate({ notes });
  };

  const statusBadge = STATUS_BADGES[lead.status] || STATUS_BADGES[NurtureStatus.ACTIVE];

  const panel = (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 animate-in fade-in duration-200" />

      {/* Panel */}
      <div
        className={cn(
          'fixed inset-y-0 right-0 w-full max-w-lg',
          'bg-[--exec-surface] border-l border-stone-600/40 shadow-2xl',
          'overflow-y-auto',
          'animate-in slide-in-from-right duration-200',
          'z-50'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Header */}
        <div className="p-6">
          <div className="flex justify-between items-start">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-[--exec-text] truncate">
                {lead.prospect_name || 'Unnamed Prospect'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {lead.campaign_name && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-[--exec-accent]/10 text-[--exec-accent] rounded-full border border-[--exec-accent]/20">
                    <Target className="w-3 h-3" />
                    {lead.campaign_name}
                  </span>
                )}
                {lead.source_channel && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-stone-700/50 text-[--exec-text-secondary] rounded-full">
                    {lead.source_channel}
                  </span>
                )}
              </div>
              <div className="flex flex-col gap-1 mt-3">
                {lead.prospect_email && (
                  <div className="flex items-center gap-1.5 text-sm text-[--exec-text-muted]">
                    <Mail className="w-3.5 h-3.5" />
                    <span className="truncate">{lead.prospect_email}</span>
                  </div>
                )}
                {lead.prospect_website && (
                  <div className="flex items-center gap-1.5 text-sm text-[--exec-text-muted]">
                    <Globe className="w-3.5 h-3.5" />
                    <span className="truncate">{lead.prospect_website}</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 2. Step Timeline */}
        <div className="px-6 border-t border-stone-700/30 pt-4">
          <h3 className="text-sm font-semibold text-[--exec-text] mb-4 flex items-center">
            <ArrowRightCircle className="w-4 h-4 mr-2 text-[--exec-accent]" />
            Nurture Steps
          </h3>
          <div className="relative">
            {[1, 2, 3, 4, 5].map((stepNum) => {
              const log = stepLogMap.get(stepNum);
              const isCompleted = log?.completed_at != null;
              const isCurrent = stepNum === lead.current_step && !isTerminal;
              const isFuture = !isCompleted && !isCurrent;
              const isLast = stepNum === 5;

              return (
                <div key={stepNum} className="flex gap-3 relative">
                  {/* Connecting line */}
                  {!isLast && (
                    <div
                      className={cn(
                        'absolute left-4 top-8 w-0.5 h-full -translate-x-1/2',
                        isCompleted ? 'bg-green-500/40' : 'bg-stone-700/50'
                      )}
                    />
                  )}

                  {/* Step circle */}
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 relative z-10',
                      isCompleted && 'bg-green-500/20 text-green-400',
                      isCurrent && 'bg-blue-500/20 text-blue-400 ring-2 ring-blue-500/40',
                      isFuture && 'bg-stone-700/50 text-stone-500'
                    )}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : stepNum}
                  </div>

                  {/* Step content */}
                  <div className="pb-6 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          isCompleted && 'text-green-400',
                          isCurrent && 'text-blue-400',
                          isFuture && 'text-stone-500'
                        )}
                      >
                        {NURTURE_STEPS[stepNum]}
                      </span>
                      {isCurrent && (
                        <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full font-medium">
                          Current step
                        </span>
                      )}
                    </div>
                    {isCompleted && log && (
                      <div className="mt-1">
                        <span className="text-xs text-[--exec-text-muted]">
                          {formatDate(log.completed_at)}
                        </span>
                        {log.notes && (
                          <p className="text-xs text-[--exec-text-secondary] mt-0.5 leading-relaxed">
                            {log.notes}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. Current Step Actions */}
        {!isTerminal && lead.current_step <= 5 && (
          <div className="px-6 border-t border-stone-700/30 pt-4 mt-2">
            <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
              <Check className="w-4 h-4 mr-2 text-[--exec-accent]" />
              Complete Step {lead.current_step}
            </h3>
            <textarea
              className={cn(inputClasses, 'resize-none')}
              rows={2}
              placeholder="Optional notes about this step..."
              value={stepNotes}
              onChange={(e) => setStepNotes(e.target.value)}
            />
            <button
              onClick={handleCompleteStep}
              disabled={completeStepMutation.isPending}
              className={cn(
                'mt-3 w-full px-4 py-2 text-sm font-medium text-white rounded-lg',
                'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
                'shadow-sm hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {completeStepMutation.isPending ? 'Completing...' : 'Mark Step Complete'}
            </button>
          </div>
        )}

        {/* 4. Follow-up Status */}
        {lead.followup_stage && (
          <div className="px-6 border-t border-stone-700/30 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
              <Clock className="w-4 h-4 mr-2 text-[--exec-accent]" />
              Follow-up Status
            </h3>
            <div className="mb-3">
              {(() => {
                const colors = FOLLOWUP_COLORS[lead.followup_stage] || FOLLOWUP_COLORS[FollowupStage.LONG_TERM];
                return (
                  <span
                    className={cn(
                      'inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border',
                      colors.bg,
                      colors.text,
                      colors.border
                    )}
                  >
                    <AlertTriangle className="w-3 h-3" />
                    {FOLLOWUP_LABELS[lead.followup_stage] || lead.followup_stage}
                  </span>
                );
              })()}
              {lead.next_followup_at && (
                <p className="text-xs text-[--exec-text-muted] mt-1.5">
                  Next follow-up: {formatDate(lead.next_followup_at)}
                </p>
              )}
            </div>
            {!isTerminal && (
              <>
                <textarea
                  className={cn(inputClasses, 'resize-none')}
                  rows={2}
                  placeholder="Follow-up notes..."
                  value={followupNotes}
                  onChange={(e) => setFollowupNotes(e.target.value)}
                />
                <button
                  onClick={handleLogFollowup}
                  disabled={logFollowupMutation.isPending}
                  className={cn(
                    'mt-3 w-full px-4 py-2 text-sm font-medium rounded-lg transition-all',
                    'bg-stone-700/50 text-[--exec-text-secondary] hover:bg-stone-600/50',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {logFollowupMutation.isPending ? 'Logging...' : 'Log Follow-up'}
                </button>
              </>
            )}
          </div>
        )}

        {/* 5. Actions Section */}
        {!isTerminal && (
          <div className="px-6 border-t border-stone-700/30 pt-4 mt-4">
            <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-[--exec-accent]" />
              Actions
            </h3>

            {/* Convert to Deal */}
            <div className="mb-3">
              <button
                onClick={() => setShowConvertForm((prev) => !prev)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
                  'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                )}
              >
                <span className="flex items-center gap-2">
                  <ArrowRightCircle className="w-4 h-4" />
                  Convert to Deal
                </span>
                {showConvertForm ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>

              {showConvertForm && (
                <form onSubmit={handleConvert} className="mt-3 space-y-3 pl-2">
                  <div>
                    <label className="block text-xs font-medium text-[--exec-text-secondary] mb-1">
                      Deal Title
                    </label>
                    <input
                      type="text"
                      className={inputClasses}
                      placeholder={`Deal with ${lead.prospect_name || 'prospect'}...`}
                      value={dealTitle}
                      onChange={(e) => setDealTitle(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[--exec-text-secondary] mb-1">
                      Deal Value ($)
                    </label>
                    <input
                      type="number"
                      className={inputClasses}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                      value={dealValue}
                      onChange={(e) =>
                        setDealValue(e.target.value === '' ? '' : Number(e.target.value))
                      }
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[--exec-text-secondary] mb-1">
                      Deal Stage
                    </label>
                    <select
                      className={cn(inputClasses, 'cursor-pointer appearance-none')}
                      value={dealStage}
                      onChange={(e) => setDealStage(e.target.value)}
                    >
                      {DEAL_STAGES.map((stage) => (
                        <option key={stage} value={stage}>
                          {stage}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={convertMutation.isPending}
                    className={cn(
                      'w-full px-4 py-2 text-sm font-medium text-white rounded-lg',
                      'bg-emerald-600 hover:bg-emerald-700',
                      'shadow-sm hover:shadow-md transition-all',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {convertMutation.isPending ? 'Converting...' : 'Create Deal'}
                  </button>
                </form>
              )}
            </div>

            {/* Mark Lost */}
            <div>
              {!showLostConfirm ? (
                <button
                  onClick={() => setShowLostConfirm(true)}
                  className={cn(
                    'w-full flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg transition-all',
                    'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  )}
                >
                  <XCircle className="w-4 h-4" />
                  Mark Lost
                </button>
              ) : (
                <div className="space-y-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <p className="text-sm text-red-400 font-medium">
                    Are you sure? This cannot be undone.
                  </p>
                  <textarea
                    className={cn(inputClasses, 'resize-none')}
                    rows={2}
                    placeholder="Reason for losing this lead (optional)..."
                    value={lostNotes}
                    onChange={(e) => setLostNotes(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowLostConfirm(false);
                        setLostNotes('');
                      }}
                      className="flex-1 px-3 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleMarkLost}
                      disabled={markLostMutation.isPending}
                      className={cn(
                        'flex-1 px-3 py-2 text-sm font-medium text-white rounded-lg transition-all',
                        'bg-red-600 hover:bg-red-700',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      {markLostMutation.isPending ? 'Marking...' : 'Confirm Lost'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. Info Footer */}
        <div className="px-6 border-t border-stone-700/30 pt-4 mt-4 pb-6">
          <div className="flex flex-col gap-2 text-xs text-[--exec-text-muted]">
            <div className="flex items-center justify-between">
              <span>Entered nurture:</span>
              <span className="text-[--exec-text-secondary]">{formatDate(lead.created_at)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Last action:</span>
              <span className="text-[--exec-text-secondary]">
                {formatDate(lead.last_action_at)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Status:</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium rounded-full',
                  statusBadge.bg,
                  statusBadge.text
                )}
              >
                <Circle className="w-2 h-2 fill-current" />
                {lead.status.replace('_', ' ')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
