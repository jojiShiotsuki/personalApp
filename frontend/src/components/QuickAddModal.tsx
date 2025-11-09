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

      // Debug: Check if Ctrl+K is reaching this handler
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        console.log('=== Ctrl+K REACHED QuickAddModal handler (should not happen!) ===');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, handleSubmit]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => {
        // Close when clicking backdrop
        if (e.target === e.currentTarget) {
          handleClose();
        }
      }}
    >
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Quick Add Tasks</h2>
            <p className="text-sm text-gray-500 mt-1">
              Paste your tasks, one per line
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-6">
          <div className="space-y-4">
            {/* Textarea */}
            <div>
              <textarea
                ref={textareaRef}
                value={taskText}
                onChange={(e) => setTaskText(e.target.value)}
                disabled={isSubmitting}
                placeholder="Paste your tasks here... (one per line)

Examples:
- Meeting tomorrow at 3pm
- Call John high priority
- Review proposal Friday
1. Send email to team
2. Update documentation"
                className={cn(
                  'w-full h-64 px-4 py-3',
                  'border border-gray-300 rounded-lg',
                  'focus:outline-none focus:ring-2 focus:ring-blue-500',
                  'transition-all duration-200',
                  'resize-none',
                  'font-mono text-sm',
                  isSubmitting && 'bg-gray-50 cursor-wait'
                )}
                aria-label="Task list input"
              />

              {/* Line Count */}
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-500">
                  {lineCount === 0
                    ? 'No tasks'
                    : lineCount === 1
                    ? '1 task'
                    : `${lineCount} tasks`}
                </p>
                <p className="text-xs text-gray-400">
                  Press{' '}
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                    {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}
                  </kbd>
                  {' + '}
                  <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono">
                    Enter
                  </kbd>
                  {' to submit'}
                </p>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-gray-50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className={cn(
              'px-4 py-2',
              'border border-gray-300 text-gray-700',
              'rounded-lg',
              'hover:bg-gray-100',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || lineCount === 0}
            className={cn(
              'flex items-center gap-2',
              'px-4 py-2',
              'bg-blue-600 text-white',
              'rounded-lg',
              'hover:bg-blue-700',
              'transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating tasks...
              </>
            ) : (
              `Create ${lineCount > 0 ? lineCount : ''} Task${lineCount !== 1 ? 's' : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
