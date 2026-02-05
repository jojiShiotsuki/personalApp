import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function QuickAddModal({
  isOpen,
  onClose,
  onSuccess,
}: QuickAddModalProps) {
  const [taskText, setTaskText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Count non-empty lines
  const lineCount = taskText
    .split('\n')
    .filter(line => line.trim().length > 0).length;

  // Focus textarea when modal opens
  useEffect(() => {
    if (isOpen && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (!isSubmitting) {
      setTaskText('');
      setError(null);
      onClose();
    }
  }, [isSubmitting, onClose]);

  const handleSubmit = useCallback(async () => {
    // Clear previous error
    setError(null);

    // Validate input
    const lines = taskText
      .split('\n')
      .filter(line => line.trim().length > 0);

    if (lines.length === 0) {
      setError('Please enter at least one task');
      return;
    }

    setIsSubmitting(true);

    try {
      // Import taskApi here to avoid circular dependencies
      const { taskApi } = await import('@/lib/api');

      // Call the bulk parse API
      const createdTasks = await taskApi.parseBulk(lines);

      // Success - clear and close
      setTaskText('');
      setError(null);
      onSuccess(createdTasks.length);
      onClose();
    } catch (err) {
      // Display error message
      const error = err as Error & { response?: { data?: { detail?: string } } };
      if (error.response?.data?.detail) {
        setError(error.response.data.detail);
      } else if (error.message) {
        setError(error.message);
      } else {
        setError('Failed to create tasks. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [taskText, onSuccess, onClose]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
      }

      // Cmd/Ctrl+Enter to submit
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-[--exec-surface] rounded-2xl shadow-2xl border border-stone-600/40 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-700/30">
          <div>
            <h2 className="text-lg font-bold text-[--exec-text]">Quick Add Tasks</h2>
            <p className="text-sm text-[--exec-text-muted] mt-0.5">
              Enter one task per line. Use natural language for dates (e.g., "tomorrow at 3pm").
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-xl transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={taskText}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="Call John about the project tomorrow&#10;Review Q3 budget next Friday&#10;Buy milk today"
              className={cn(
                "w-full h-64 p-4 text-base font-medium resize-none",
                "bg-stone-800/50 border rounded-xl",
                "text-[--exec-text] placeholder:text-[--exec-text-muted]",
                "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
                "transition-all",
                error ? "border-red-500/50 focus:border-red-500 focus:ring-red-500/20 bg-red-500/10" : "border-stone-600/40"
              )}
              disabled={isSubmitting}
            />
            <div className="absolute bottom-4 right-4 text-xs font-medium text-[--exec-text-muted] bg-stone-800/80 backdrop-blur px-2 py-1 rounded-lg border border-stone-600/40 shadow-sm">
              {lineCount} task{lineCount !== 1 ? 's' : ''}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl flex items-start gap-3 text-sm text-red-400 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-stone-900/50 border-t border-stone-700/30 rounded-b-2xl flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-[--exec-text-muted] font-medium">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-stone-800/80 border border-stone-600/40 rounded-lg font-mono text-[--exec-text-secondary]">Enter</kbd>
              <span>new line</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-stone-800/80 border border-stone-600/40 rounded-lg font-mono text-[--exec-text-secondary]">Ctrl + Enter</kbd>
              <span>save</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-stone-800/80 border border-stone-600/40 rounded-lg font-mono text-[--exec-text-secondary]">Esc</kbd>
              <span>cancel</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || lineCount === 0}
              className={cn(
                "flex items-center gap-2 px-6 py-2 text-sm font-medium text-white rounded-xl",
                "bg-[--exec-accent] hover:bg-[--exec-accent-dark]",
                "shadow-sm hover:shadow-md transition-all",
                "disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  Create {lineCount > 0 ? `${lineCount} Task${lineCount !== 1 ? 's' : ''}` : 'Tasks'}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
