import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BulkGenerateBarProps {
  selectedCount: number;
  onGenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
}

export function BulkGenerateBar({ selectedCount, onGenerate, onClear, isGenerating }: BulkGenerateBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-6 left-1/2 -translate-x-1/2 z-[100]",
      "flex items-center gap-4 px-6 py-3",
      "bg-stone-900 border border-stone-600/40 rounded-2xl shadow-2xl",
      "animate-in slide-in-from-bottom-4 duration-300"
    )}>
      <span className="text-sm font-medium text-stone-300">
        {selectedCount} selected
      </span>

      <button
        onClick={onGenerate}
        disabled={isGenerating}
        className={cn(
          "px-4 py-2 text-sm font-medium text-white rounded-lg",
          "bg-[#E07A5F] hover:bg-[#c9684f] shadow-sm hover:shadow-md",
          "transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        )}
      >
        {isGenerating ? 'Generating...' : 'Generate AI Follow-ups'}
      </button>

      <button
        onClick={onClear}
        className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-stone-700 rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
