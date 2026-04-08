import { X, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkResult {
  prospect_id: number;
  status: string;
  subject?: string;
  word_count?: number;
  angle_used?: string;
  cost_usd?: number;
  error?: string;
}

interface BulkGenerateModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  totalCount: number;
  results: {
    results: BulkResult[];
    total: number;
    succeeded: number;
    failed: number;
    total_cost_usd: number;
  } | null;
  error: string | null;
}

export function BulkGenerateModal({
  isOpen,
  onClose,
  isGenerating,
  totalCount,
  results,
  error,
}: BulkGenerateModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className={cn(
        "bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4",
        "border border-stone-600/40",
        "transform transition-all animate-in zoom-in-95 duration-200",
        "max-h-[90vh] overflow-y-auto"
      )}>
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                Bulk AI Generation
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                {isGenerating
                  ? `Generating follow-ups for ${totalCount} prospects...`
                  : results
                    ? `Generation complete`
                    : 'Starting generation...'}
              </p>
            </div>
            {!isGenerating && (
              <button
                onClick={onClose}
                className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Generating State */}
          {isGenerating && (
            <div className="flex flex-col items-center py-8 gap-4">
              <Loader2 className="w-10 h-10 text-[--exec-accent] animate-spin" />
              <p className="text-sm text-[--exec-text-secondary]">
                This may take a minute. Each prospect gets a unique, personalized message.
              </p>
            </div>
          )}

          {/* Error State */}
          {error && !isGenerating && (
            <div className="flex items-start gap-3 p-4 bg-red-900/20 border border-red-800/40 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-400">Generation failed</p>
                <p className="text-sm text-red-400/70 mt-1">{error}</p>
              </div>
            </div>
          )}

          {/* Results State */}
          {results && !isGenerating && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="flex items-center gap-4 p-4 bg-stone-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                  <span className="text-sm font-medium text-green-400">
                    {results.succeeded} generated
                  </span>
                </div>
                {results.failed > 0 && (
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <span className="text-sm font-medium text-red-400">
                      {results.failed} failed
                    </span>
                  </div>
                )}
                <span className="text-xs text-[--exec-text-muted] ml-auto">
                  Cost: ${results.total_cost_usd.toFixed(4)}
                </span>
              </div>

              {/* Failures detail */}
              {results.results.filter(r => r.status === 'error').length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[--exec-text-secondary]">Failures:</p>
                  {results.results
                    .filter(r => r.status === 'error')
                    .map(r => (
                      <div key={r.prospect_id} className="text-sm text-red-400/70 pl-4">
                        Prospect #{r.prospect_id}: {r.error}
                      </div>
                    ))}
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end pt-4 border-t border-stone-700/30 mt-6">
                <button
                  onClick={onClose}
                  className={cn(
                    "px-4 py-2 text-sm font-medium text-white rounded-lg",
                    "bg-[--exec-accent] hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all"
                  )}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
