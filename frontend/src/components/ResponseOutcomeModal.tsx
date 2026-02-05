import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachProspect, MarkRepliedResponse } from '@/types';
import { ResponseType } from '@/types';
import { X, MessageSquare, ThumbsUp, ThumbsDown, MessageCircle, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface ResponseOutcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: OutreachProspect;
}

type OutcomeType = ResponseType.INTERESTED | ResponseType.NOT_INTERESTED | ResponseType.OTHER;

const outcomeConfig: Record<OutcomeType, {
  icon: typeof ThumbsUp;
  label: string;
  bgColor: string;
  textColor: string;
  hoverBg: string;
  selectedBg: string;
}> = {
  [ResponseType.INTERESTED]: {
    icon: ThumbsUp,
    label: 'Interested',
    bgColor: 'bg-green-500/20',
    textColor: 'text-green-400',
    hoverBg: 'hover:bg-green-500/30',
    selectedBg: 'bg-green-500 text-white',
  },
  [ResponseType.NOT_INTERESTED]: {
    icon: ThumbsDown,
    label: 'Not Interested',
    bgColor: 'bg-red-500/20',
    textColor: 'text-red-400',
    hoverBg: 'hover:bg-red-500/30',
    selectedBg: 'bg-red-500 text-white',
  },
  [ResponseType.OTHER]: {
    icon: MessageCircle,
    label: 'Other',
    bgColor: 'bg-stone-700/50',
    textColor: 'text-stone-400',
    hoverBg: 'hover:bg-stone-600/50',
    selectedBg: 'bg-stone-500 text-white',
  },
};

export default function ResponseOutcomeModal({
  isOpen,
  onClose,
  prospect,
}: ResponseOutcomeModalProps) {
  const [selectedOutcome, setSelectedOutcome] = useState<OutcomeType | null>(null);
  const [notes, setNotes] = useState('');
  const [successResult, setSuccessResult] = useState<MarkRepliedResponse | null>(null);
  const queryClient = useQueryClient();

  // Mark replied mutation
  const markRepliedMutation = useMutation({
    mutationFn: () =>
      coldOutreachApi.markReplied(prospect.id, {
        response_type: selectedOutcome!,
        notes: notes.trim() || undefined,
      }),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });

      // If interested and contact was created, show success state
      if (selectedOutcome === ResponseType.INTERESTED && data.contact_id) {
        setSuccessResult(data);
      } else {
        onClose();
      }
    },
    onError: () => {
      toast.error('Failed to record response');
    },
  });

  const handleSubmit = () => {
    if (!selectedOutcome) {
      toast.error('Please select an outcome');
      return;
    }
    markRepliedMutation.mutate();
  };

  const handleClose = () => {
    setSelectedOutcome(null);
    setNotes('');
    setSuccessResult(null);
    onClose();
  };

  if (!isOpen) return null;

  // Success state - show link to deal
  if (successResult && successResult.contact_id) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
        <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
          <div className="p-6 text-center">
            {/* Success Icon */}
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>

            <h2 className="text-xl font-semibold text-[--exec-text] mb-2">
              Prospect Converted!
            </h2>
            <p className="text-[--exec-text-secondary] mb-6">
              {prospect.agency_name} has been added to your CRM as a contact
              {successResult.deal_id && ' and a deal has been created'}.
            </p>

            {/* Action Buttons */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Close
              </button>
              {successResult.deal_id && (
                <Link
                  to={`/crm?dealId=${successResult.deal_id}`}
                  onClick={handleClose}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg',
                    'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
                    'shadow-sm hover:shadow-md transition-all'
                  )}
                >
                  <ExternalLink className="w-4 h-4" />
                  View Deal
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[--exec-sage]/20 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-[--exec-sage]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[--exec-text]">
                  Response Outcome
                </h2>
                <p className="text-sm text-[--exec-text-muted] mt-0.5">
                  {prospect.agency_name}
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Outcome Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-3">
              How did they respond?
            </label>
            <div className="grid grid-cols-3 gap-3">
              {(Object.keys(outcomeConfig) as OutcomeType[]).map((outcome) => {
                const config = outcomeConfig[outcome];
                const Icon = config.icon;
                const isSelected = selectedOutcome === outcome;

                return (
                  <button
                    key={outcome}
                    onClick={() => setSelectedOutcome(outcome)}
                    className={cn(
                      'flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all duration-200',
                      isSelected
                        ? `${config.selectedBg} border-transparent`
                        : `${config.bgColor} border-transparent ${config.hoverBg}`
                    )}
                  >
                    <Icon
                      className={cn(
                        'w-6 h-6',
                        isSelected ? 'text-white' : config.textColor
                      )}
                    />
                    <span
                      className={cn(
                        'text-xs font-medium',
                        isSelected ? 'text-white' : config.textColor
                      )}
                    >
                      {config.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any relevant details about their response..."
              rows={3}
              className={cn(
                'w-full px-4 py-2.5 rounded-lg',
                'bg-stone-800/50 border border-stone-600/40',
                'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                'transition-all text-sm resize-none'
              )}
            />
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!selectedOutcome || markRepliedMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg',
                'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
                'shadow-sm hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {markRepliedMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Response'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
