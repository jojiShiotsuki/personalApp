import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { goalApi } from '@/lib/api';
import { X, Loader2, Check, Target, AlertTriangle } from 'lucide-react';
import type { GoalParseError, Goal } from '@/types';
import { cn } from '@/lib/utils';

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

  const inputClasses = cn(
    "w-full px-4 py-3 rounded-xl",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] text-base placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all resize-none"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-start justify-center z-50 pt-32 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-stone-600/40 transform transition-all animate-in slide-in-from-top-4 duration-200">
        <div className="flex items-center px-6 py-5 border-b border-stone-700/30">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-[--exec-text] flex items-center gap-2">
              <div className="p-1.5 bg-[--exec-accent]/20 rounded-lg">
                <Target className="w-4 h-4 text-[--exec-accent]" />
              </div>
              Quick Add Goals
            </h2>
            <p className="text-sm text-[--exec-text-muted] mt-1 ml-9">
              Type naturally: "Launch website Q1 January", "Complete certification Q2 April high priority"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
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
              className={inputClasses}
            />
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-[--exec-surface]/80 backdrop-blur-sm rounded-xl">
                <div className="flex flex-col items-center animate-in zoom-in duration-300">
                  {parseErrors.length > 0 ? (
                    <>
                      <div className="w-12 h-12 bg-amber-500/20 rounded-full flex items-center justify-center mb-2">
                        <AlertTriangle className="w-6 h-6 text-amber-400" />
                      </div>
                      <span className="font-semibold text-amber-400">
                        {parseMutation.data?.success_count} created, {parseErrors.length} failed
                      </span>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mb-2">
                        <Check className="w-6 h-6 text-emerald-400" />
                      </div>
                      <span className="font-semibold text-emerald-400">Goals Added!</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="text-xs text-[--exec-text-muted]">
              <kbd className="px-2 py-1 bg-stone-800/80 rounded border border-stone-600/40 font-mono text-[--exec-text-secondary]">
                Ctrl+G
              </kbd>{' '}
              to open <kbd className="px-2 py-1 bg-stone-800/80 rounded border border-stone-600/40 font-mono text-[--exec-text-secondary]">
                Esc
              </kbd>{' '}
              to close
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-xl hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim() || parseMutation.isPending || showSuccess}
                className={cn(
                  "px-6 py-2.5 text-sm font-medium text-white rounded-xl flex items-center",
                  "bg-[--exec-accent] hover:bg-[--exec-accent-dark]",
                  "shadow-sm hover:shadow-md transition-all",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                )}
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
            <div className="mt-4 p-3 bg-red-500/20 border border-red-500/40 rounded-xl">
              <p className="text-sm text-red-400">
                Failed to create goals. Please try again.
              </p>
            </div>
          )}

          {parseErrors.length > 0 && !showSuccess && (
            <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/40 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-medium text-amber-400">
                  {parseErrors.length} line(s) could not be parsed:
                </span>
              </div>
              <ul className="space-y-1.5 max-h-32 overflow-y-auto">
                {parseErrors.map((err, idx) => (
                  <li key={idx} className="text-xs text-amber-400/80">
                    <span className="font-medium">Line {err.line_number}:</span>{' '}
                    <span className="text-amber-400/60">{err.text}</span>
                    <span className="text-amber-400/50 block ml-4">({err.error})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>

        <div className="bg-stone-900/50 px-6 py-4 border-t border-stone-700/30 rounded-b-2xl">
          <h3 className="text-xs font-semibold text-[--exec-text-muted] uppercase mb-2 tracking-wider">
            Examples:
          </h3>
          <div className="space-y-1.5 text-sm text-[--exec-text-secondary]">
            <p>"Launch new website Q1 January"</p>
            <p>"Complete certification Q2 April high priority"</p>
            <p>"Reach 10k followers Q3 July urgent"</p>
            <p>"Q4 December: Year-end review - Complete annual goals assessment"</p>
          </div>
        </div>
      </div>
    </div>
  );
}
