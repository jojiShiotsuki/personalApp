import { useState } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';

import type { VaultChunkRef } from '@/types';

interface VaultRefCardProps {
  chunk: VaultChunkRef;
}

export default function VaultRefCard({ chunk }: VaultRefCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-stone-800/50 border border-stone-600/40 rounded-lg overflow-hidden text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-stone-700/30 transition-colors text-left"
      >
        <FileText className="w-3 h-3 text-[--exec-accent] flex-shrink-0" />
        <span className="text-[--exec-text-muted] truncate flex-1">
          {chunk.file_path}
          {chunk.heading_context && <span className="text-stone-500"> &gt; {chunk.heading_context}</span>}
        </span>
        {expanded ? <ChevronUp className="w-3 h-3 text-stone-500" /> : <ChevronDown className="w-3 h-3 text-stone-500" />}
      </button>
      {expanded && (
        <div className="px-3 pb-2 text-[--exec-text-secondary] whitespace-pre-wrap border-t border-stone-700/30">
          {chunk.content}
        </div>
      )}
    </div>
  );
}
