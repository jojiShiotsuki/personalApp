import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { goalApi } from '@/lib/api';
import { X, Loader2, Check, Target } from 'lucide-react';

interface QuickAddGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (count: number) => void;
}

export default function QuickAddGoalModal({ isOpen, onClose, onSuccess }: QuickAddGoalModalProps) {
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const parseMutation = useMutation({
    mutationFn: (text: string) => {
      // Check if multiple lines (bulk add)
      const lines = text.split('\n').filter(line => line.trim());
      if (lines.length > 1) {
        return goalApi.parseBulk(text);
      } else {
        return goalApi.parse(text).then(goal => [goal]);
      }
    },
    onSuccess: (goals) => {
      setShowSuccess(true);
      setTimeout(() => {
        onClose();
        setInput('');
        setShowSuccess(false);
        onSuccess(Array.isArray(goals) ? goals.length : 1);
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
    onClose();
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
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-start justify-center z-50 pt-32 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 border border-gray-100 transform transition-all animate-in slide-in-from-top-4 duration-200">
        <div className="flex items-center px-6 py-5 border-b border-gray-100">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <div className="p-1.5 bg-blue-50 rounded-lg">
                <Target className="w-4 h-4 text-blue-600" />
              </div>
              Quick Add Goals
            </h2>
            <p className="text-sm text-gray-500 mt-1 ml-9">
              Type naturally: "Launch website Q1 January", "Complete certification Q2 April high priority"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-lg transition-colors"
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
              className="w-full border border-gray-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-base placeholder:text-gray-400 resize-none"
            />
            {showSuccess && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl">
                <div className="flex flex-col items-center text-emerald-600 animate-in zoom-in duration-300">
                  <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mb-2">
                    <Check className="w-6 h-6" />
                  </div>
                  <span className="font-semibold">Goals Added!</span>
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
