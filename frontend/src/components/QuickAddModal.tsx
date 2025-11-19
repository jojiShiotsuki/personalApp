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
    } catch (err: any) {
      console.error('Failed to create tasks:', err);

      // Display error message
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else if (err.message) {
        setError(err.message);
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
        className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl ring-1 ring-gray-900/5 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Quick Add Tasks</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Enter one task per line. Use natural language for dates (e.g., "tomorrow at 3pm").
            </p>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all"
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
                "w-full h-64 p-4 text-base text-gray-900 placeholder:text-gray-400 bg-gray-50 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none font-medium",
                error ? "border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 bg-rose-50/30" : "border-gray-200"
              )}
              disabled={isSubmitting}
            />
            <div className="absolute bottom-4 right-4 text-xs font-medium text-gray-400 bg-white/80 backdrop-blur px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
              {lineCount} task{lineCount !== 1 ? 's' : ''}
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-sm text-rose-600 animate-in slide-in-from-top-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 rounded-b-2xl flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs text-gray-500 font-medium">
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-sm font-mono text-gray-600">Enter</kbd>
              <span>new line</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-sm font-mono text-gray-600">Ctrl + Enter</kbd>
              <span>save</span>
            </span>
            <span className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-white border border-gray-200 rounded-lg shadow-sm font-mono text-gray-600">Esc</kbd>
              <span>cancel</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-white rounded-xl transition-all disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || lineCount === 0}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
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
