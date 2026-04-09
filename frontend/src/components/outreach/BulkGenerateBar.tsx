import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { primaryButtonClasses } from '@/lib/outreachStyles';

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
        className={primaryButtonClasses}
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
