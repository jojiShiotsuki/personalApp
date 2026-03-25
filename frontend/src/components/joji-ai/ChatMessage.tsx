import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AIConversationMessage, VaultChunkRef } from '@/types';
import VaultRefCard from './VaultRefCard';

interface ChatMessageProps {
  message: AIConversationMessage;
  vaultRefs?: VaultChunkRef[];
}

export default function ChatMessage({ message, vaultRefs }: ChatMessageProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex flex-col gap-1', isUser ? 'items-end' : 'items-start')}>
      <div className={cn(
        'max-w-[85%] rounded-xl px-4 py-2.5 text-sm',
        isUser
          ? 'bg-[#E07A5F] text-white rounded-br-sm'
          : 'bg-stone-800/60 text-[--exec-text] border border-stone-700/40 rounded-bl-sm'
      )}>
        {isUser ? (
          <div className="whitespace-pre-wrap break-words leading-relaxed">
            {message.content}
          </div>
        ) : (
          <div className="prose-chat break-words leading-relaxed">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {message.content}
            </ReactMarkdown>
          </div>
        )}
      </div>

      {/* Model badge + cost for assistant messages */}
      {!isUser && message.model && (
        <div className="flex items-center gap-2 px-1">
          <span className="text-[10px] text-stone-500">
            {message.model.includes('opus') ? 'Opus' : message.model.includes('haiku') ? 'Haiku' : 'Sonnet'}
          </span>
          {message.tokens_used && (
            <span className="text-[10px] text-stone-600">
              {message.tokens_used.toLocaleString()} tokens
            </span>
          )}
        </div>
      )}

      {/* Vault references */}
      {vaultRefs && vaultRefs.length > 0 && (
        <div className="max-w-[85%] space-y-1 mt-1">
          {vaultRefs.map((ref) => (
            <VaultRefCard key={ref.chunk_id} chunk={ref} />
          ))}
        </div>
      )}
    </div>
  );
}
