import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { goalApi } from '@/lib/api';
import { X, Loader2, Check, Target, AlertTriangle } from 'lucide-react';
import type { GoalParseError, Goal } from '@/types';

interface QuickAddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

type ParseResult = {
  goals: Goal[];
  errors: GoalParseError[];
  success_count: number;
  error_count: number;
};

export default function QuickAddGoalModal({ isOpen, onClose, onSuccess }: QuickAddGoalModalProps) {
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [parseErrors, setParseErrors] = useState<GoalParseError[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const parseMutation = useMutation({
    mutationFn: async (text: string): Promise<ParseResult> => {
      // Check if multiple lines (bulk add)
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        const response = await goalApi.parseBulk(text);
        return {
          goals: response.goals,
          errors: response.errors,
          success_count: response.success_count,
          error_count: response.error_count,
        };
      } else {
        const goal = await goalApi.parse(text);
        return {
          goals: [goal],
          errors: [],
          success_count: 1,
          error_count: 0,
        };
      }
    },
    onSuccess: (result) => {
      setParseErrors(result.errors);
      if (result.success_count > 0) {
        setShowSuccess(true);
        // If there are errors, show longer so user can see them
        const delay = result.error_count > 0 ? 3000 : 1500;
        setTimeout(() => {
          onClose();
          setInput('');
          setShowSuccess(false);
          setParseErrors([]);
          onSuccess(result.success_count);
        }, delay);
      }
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
    onClose();
    setInput('');
    setShowSuccess(false);
    setParseErrors([]);
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center z-50 pt-32 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl mx-4 border border-gray-100 dark:border-gray-700 transform transition-all animate-in slide-in-from-top-4 duration-200">
        <div className="flex items-center px-6 py-5 border-b border-gray-100 dark:border-gray-700">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <Target className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              Quick Add Goals
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-9">
              Type naturally: "Launch website Q1 January", "Complete certification Q2 April high priority"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., Launch new product Q2 May high priority&#10;Complete annual review Q4 December&#10;Reach 50k followers Q3 August"
              disabled={parseMutation.isPending || showSuccess}
              rows={6}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 resize-none"
            />
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl">
                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                  {parseErrors.length > 0 ? (
                    <>
                      <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/20 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="font-semibold text-amber-600 dark:text-amber-400">
                        {parseMutation.data?.success_count} created, {parseErrors.length} failed
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mb-2">
                        <Check className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">Goals Added!</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-gray-500">
              <kbd className="px-2 py-1 bg-gray-50 rounded border border-gray-200 font-mono text-gray-600">
                Ctrl+G
              </kbd>{' '}
              to open • <kbd className="px-2 py-1 bg-gray-50 rounded border border-gray-200 font-mono text-gray-600">
                Esc
              </kbd>{' '}
              to close
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim() || parseMutation.isPending || showSuccess}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm hover:shadow-md text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none flex items-center"
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
                  'Create Goals'
                )}
              </button>
            </div>
          </div>

          {parseMutation.isError && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl">
              <p className="text-sm text-rose-700">
                Failed to create goals. Please try again.
              </p>
            </div>
          )}

          {parseErrors.length > 0 && !showSuccess && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  {parseErrors.length} line(s) could not be parsed:
                </span>
              </div>
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {parseErrors.map((err, idx) => (
                  <li key={idx} className="text-xs text-amber-700">
                    <span className="font-medium">Line {err.line_number}:</span>{' '}
                    <span className="text-amber-600">{err.text}</span>
                    <span className="text-amber-500 block ml-4">({err.error})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <div className="bg-gray-50/50 px-6 py-4 border-t border-gray-100 rounded-b-2xl">
          <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 tracking-wider">
            Examples:
          </h3>
          <div className="space-y-1.5 text-sm text-gray-600">
            <p>• "Launch new website Q1 January"</p>
            <p>• "Complete certification Q2 April high priority"</p>
            <p>• "Reach 10k followers Q3 July urgent"</p>
            <p>• "Q4 December: Year-end review - Complete annual goals assessment"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
