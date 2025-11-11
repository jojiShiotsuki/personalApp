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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
            <h2 className="text-xl font-bold text-gray-900">
              Insufficient Follow-ups
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              You've only followed up <strong>{deal.followup_count} time{deal.followup_count !== 1 ? 's' : ''}</strong> with this prospect.
            </p>
            <p className="text-gray-600">
              Consider reaching out <strong>{remainingFollowUps} more time{remainingFollowUps !== 1 ? 's' : ''}</strong> before closing this deal.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-800">
              💡 <strong>Tip:</strong> Studies show that most sales require 5-7 follow-ups before conversion.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onAddFollowUp}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Add Follow-up
            </button>
            <button
              onClick={onCloseDealAnyway}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Close Deal Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
