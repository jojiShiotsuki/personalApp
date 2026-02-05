import { X, AlertTriangle } from 'lucide-react';
import { Deal } from '@/types';
import { cn } from '@/lib/utils';

interface FollowUpWarningModalProps {
  deal: Deal;
  onClose: () => void;
  onAddFollowUp: () => void;
  onCloseDealAnyway: () => void;
}

export default function FollowUpWarningModal({
  deal,
  onClose,
  onAddFollowUp,
  onCloseDealAnyway,
}: FollowUpWarningModalProps) {
  const remainingFollowUps = Math.max(0, 5 - deal.followup_count);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-700/30">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-[--exec-text]">
              Insufficient Follow-ups
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-[--exec-text-secondary] mb-2 text-sm leading-relaxed">
              You've only followed up <strong className="text-[--exec-text]">{deal.followup_count} time{deal.followup_count !== 1 ? 's' : ''}</strong> with this prospect.
            </p>
            <p className="text-[--exec-text-muted] text-sm leading-relaxed">
              Consider reaching out <strong className="text-[--exec-text]">{remainingFollowUps} more time{remainingFollowUps !== 1 ? 's' : ''}</strong> before closing this deal.
            </p>
          </div>

          <div className="bg-blue-500/20 border border-blue-500/40 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-400">
              <strong className="font-semibold">Tip:</strong> Studies show that most sales require 5-7 follow-ups before conversion.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onAddFollowUp}
              className={cn(
                "flex-1 px-4 py-2.5 text-white rounded-xl font-medium text-sm",
                "bg-[--exec-accent] hover:bg-[--exec-accent-dark]",
                "shadow-sm hover:shadow-md transition-all"
              )}
            >
              Add Follow-up
            </button>
            <button
              onClick={onCloseDealAnyway}
              className="flex-1 px-4 py-2.5 bg-stone-700/50 text-[--exec-text-secondary] rounded-xl hover:bg-stone-600/50 transition-colors font-medium text-sm"
            >
              Close Deal Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
