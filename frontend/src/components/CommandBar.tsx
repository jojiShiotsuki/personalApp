import { useState, useRef, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { taskApi } from '@/lib/api';
import { X, Loader2, Check } from 'lucide-react';
import { useKeyboardShortcut } from '@/hooks/useKeyboardShortcut';

export default function CommandBar() {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Listen for Ctrl+K or Cmd+K
  useKeyboardShortcut('k', () => setIsOpen(true), { ctrlKey: true, metaKey: true });

  const parseMutation = useMutation({
    mutationFn: (text: string) => taskApi.parse(text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowSuccess(true);
      setTimeout(() => {
        setIsOpen(false);
        setInput('');
        setShowSuccess(false);
      }, 1500);
    },
  });

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      parseMutation.mutate(input.trim());
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setInput('');
    setShowSuccess(false);
  };

  // Handle Escape key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-32">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Vertex Quick Add
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Type naturally: "meeting tomorrow at 3pm", "call John high priority"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Review contract next Monday 2pm urgent"
            disabled={parseMutation.isPending || showSuccess}
            className="w-full px-4 py-3 text-lg bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                Ctrl+K
              </kbd>{' '}
              to open • <kbd className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded border border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300">
                Esc
              </kbd>{' '}
              to close
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim() || parseMutation.isPending || showSuccess}
                className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {parseMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : showSuccess ? (
                  <>
                    <Check className="w-4 h-4 mr-2" />
                    Created!
                  </>
                ) : (
                  'Create Task'
                )}
              </button>
            </div>
          </div>

          {parseMutation.isError && (
            <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl">
              <p className="text-sm text-rose-700 dark:text-rose-400">
                Failed to create task. Please try again.
              </p>
            </div>
          )}
        </form>

        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 border-t border-gray-200 dark:border-gray-700 rounded-b-2xl">
          <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase mb-2">
            Examples:
          </h3>
          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>• "Meeting with Sarah tomorrow at 3pm"</p>
            <p>• "Call John high priority"</p>
            <p>• "Proposal due Friday"</p>
            <p>• "Review contract next Monday 2pm urgent"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
