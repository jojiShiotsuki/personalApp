import { useState, useEffect, useCallback } from 'react';
import { Loader2, XCircle, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { autoresearchApi } from '@/lib/api';
import type { BatchProgress as BatchProgressType } from '@/types';

interface BatchProgressProps {
  batchId: string;
  onComplete: () => void;
}

export default function BatchProgress({ batchId, onComplete }: BatchProgressProps) {
  const [progress, setProgress] = useState<BatchProgressType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const fetchProgress = useCallback(async () => {
    try {
      const data = await autoresearchApi.getBatchProgress(batchId);
      setProgress(data);
      setError(null);

      if (data.is_complete || data.is_cancelled) {
        onComplete();
      }
    } catch {
      setError('Failed to fetch batch progress');
    }
  }, [batchId, onComplete]);

  useEffect(() => {
    fetchProgress();
    const interval = setInterval(fetchProgress, 5000);
    return () => clearInterval(interval);
  }, [fetchProgress]);

  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      await autoresearchApi.cancelBatch(batchId);
      // Progress will update on next poll
    } catch {
      setError('Failed to cancel batch');
    } finally {
      setIsCancelling(false);
    }
  };

  if (!progress && !error) {
    return (
      <div className="flex items-center gap-3 bg-[--exec-surface] rounded-xl border border-stone-600/40 p-4">
        <Loader2 className="w-5 h-5 text-[--exec-accent] animate-spin" />
        <span className="text-sm text-[--exec-text-secondary]">Connecting to batch...</span>
      </div>
    );
  }

  if (error && !progress) {
    return (
      <div className="flex items-center gap-3 bg-red-900/20 rounded-xl border border-red-800/40 p-4">
        <AlertTriangle className="w-5 h-5 text-red-400" />
        <span className="text-sm text-red-400">{error}</span>
      </div>
    );
  }

  if (!progress) return null;

  const percentage = progress.total > 0
    ? Math.round((progress.completed / progress.total) * 100)
    : 0;

  const isComplete = progress.is_complete;
  const isCancelled = progress.is_cancelled;

  return (
    <div className={cn(
      'rounded-xl border p-4 space-y-3 transition-all duration-200',
      isComplete
        ? 'bg-green-900/10 border-green-800/40'
        : isCancelled
          ? 'bg-stone-800/30 border-stone-600/40'
          : 'bg-[--exec-surface] border-[--exec-accent]/30'
    )}>
      {/* Status line */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle className="w-5 h-5 text-green-400" />
          ) : isCancelled ? (
            <XCircle className="w-5 h-5 text-stone-400" />
          ) : (
            <Loader2 className="w-5 h-5 text-[--exec-accent] animate-spin" />
          )}
          <span className="text-sm font-medium text-[--exec-text]">
            {isComplete
              ? 'Batch complete'
              : isCancelled
                ? 'Batch cancelled'
                : 'Auditing prospects...'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm text-[--exec-text-secondary]">
            {progress.completed}/{progress.total} audits
            {progress.errors > 0 && (
              <span className="text-red-400 ml-1">({progress.errors} errors)</span>
            )}
          </span>

          {!isComplete && !isCancelled && (
            <button
              onClick={handleCancel}
              disabled={isCancelling}
              className="px-3 py-1 text-xs font-medium text-red-400 bg-red-900/20 rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-stone-800/50 rounded-full h-2 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-500 ease-out',
            isComplete
              ? 'bg-green-500'
              : isCancelled
                ? 'bg-stone-500'
                : 'bg-[--exec-accent]'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* Current prospect */}
      {!isComplete && !isCancelled && progress.current_prospect && (
        <p className="text-xs text-[--exec-text-muted] truncate">
          Currently auditing: <span className="text-[--exec-text-secondary]">{progress.current_prospect}</span>
        </p>
      )}
    </div>
  );
}
