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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-start justify-center z-50 pt-32">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl mx-4">
        <div className="flex items-center px-6 py-4 border-b">
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-600" />
              Quick Add Goals
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Type naturally: "Launch website Q1 January", "Complete certification Q2 April high priority"
            </p>
          </div>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g., Launch new product Q2 May high priority&#10;Complete annual review Q4 December&#10;Reach 50k followers Q3 August"
            disabled={parseMutation.isPending || showSuccess}
            rows={6}
            className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 resize-none"
          />

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-500">
              <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
                Ctrl+G
              </kbd>{' '}
              to open • <kbd className="px-2 py-1 bg-gray-100 rounded border border-gray-300">
                Esc
              </kbd>{' '}
              to close • Enter one goal per line for bulk add
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!input.trim() || parseMutation.isPending || showSuccess}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Failed to create goals. Please try again.
              </p>
            </div>
          )}
        </form>

        <div className="bg-gray-50 px-6 py-4 border-t">
          <h3 className="text-xs font-semibold text-gray-700 uppercase mb-2">
            Examples:
          </h3>
          <div className="space-y-1 text-sm text-gray-600">
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
