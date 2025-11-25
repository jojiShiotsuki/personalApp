import { X, AlertTriangle } from 'lucide-react';
import { Deal } from '@/types';

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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md mx-4 border border-gray-100 dark:border-gray-700 transform transition-all animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-50 dark:bg-amber-900/30 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Insufficient Follow-ups
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 dark:text-gray-300 mb-2 text-sm leading-relaxed">
              You've only followed up <strong className="text-gray-900 dark:text-white">{deal.followup_count} time{deal.followup_count !== 1 ? 's' : ''}</strong> with this prospect.
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
              Consider reaching out <strong className="text-gray-900 dark:text-white">{remainingFollowUps} more time{remainingFollowUps !== 1 ? 's' : ''}</strong> before closing this deal.
            </p>
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-800 dark:text-blue-300">
              💡 <strong className="font-semibold">Tip:</strong> Studies show that most sales require 5-7 follow-ups before conversion.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onAddFollowUp}
              className="flex-1 px-4 py-2.5 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-all shadow-sm hover:shadow-md font-medium text-sm"
            >
              Add Follow-up
            </button>
            <button
              onClick={onCloseDealAnyway}
              className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600 transition-all font-medium text-sm"
            >
              Close Deal Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
