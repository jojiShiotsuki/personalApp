import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Brain, X, ExternalLink, Send, Loader2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { jojiAiApi } from '@/lib/api';
import { useChat } from '@/contexts/ChatContext';
import ChatMessage from './ChatMessage';
import type { AIConversationMessage, VaultChunkRef, AISSEEventType } from '@/types';

function parseSSEEvents(text: string): Array<{ event: AISSEEventType; data: string }> {
  const events: Array<{ event: AISSEEventType; data: string }> = [];
  const blocks = text.split('\n\n');

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    let eventType: AISSEEventType = 'text';
    let dataStr = '';

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event:')) {
        eventType = line.slice(6).trim() as AISSEEventType;
      } else if (line.startsWith('data:')) {
        dataStr = line.slice(5).trim();
      }
    }

    if (dataStr) {
      events.push({ event: eventType, data: dataStr });
    }
  }

  return events;
}

export default function ChatPanel() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const {
    isOpen,
    openChat,
    closeChat,
    activeConversationId,
    setActiveConversation,
    pendingMessage,
    clearPendingMessage,
  } = useChat();

  const [messages, setMessages] = useState<AIConversationMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingVaultRefs, setStreamingVaultRefs] = useState<VaultChunkRef[]>([]);
  const [streamingToolCalls, setStreamingToolCalls] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingMessageHandled = useRef(false);

  // Don't render on the /ai page
  const isOnAIPage = location.pathname === '/ai';

  // Load conversation messages when activeConversationId changes
  const { data: conversationData } = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: () => jojiAiApi.getConversation(activeConversationId!),
    enabled: !!activeConversationId && isOpen,
  });

  // Sync loaded conversation messages into local state
  useEffect(() => {
    if (conversationData?.messages) {
      setMessages(conversationData.messages);
    }
  }, [conversationData]);

  // Clear messages when starting a new conversation
  useEffect(() => {
    if (activeConversationId === null) {
      setMessages([]);
    }
  }, [activeConversationId]);

  // Auto-scroll to bottom on new messages or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent]);

  // Send a message (extracted so it can be called from pending message handler)
  const sendMessage = useCallback(async (message: string) => {
    if (!message.trim() || isStreaming) return;

    const trimmedMessage = message.trim();

    // Optimistic user message
    const userMessage: AIConversationMessage = {
      id: Date.now(),
      role: 'user',
      content: trimmedMessage,
      model: null,
      tool_calls_json: null,
      vault_chunks_used: null,
      tokens_used: null,
      cost_usd: null,
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setStreamingContent('');
    setStreamingVaultRefs([]);
    setStreamingToolCalls([]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await jojiAiApi.chat(trimmedMessage, activeConversationId ?? undefined);
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';
      const vaultRefs: VaultChunkRef[] = [];
      let conversationId: number | null = null;
      let model: string | null = null;
      let tokensUsed: number | null = null;

      while (true) {
        if (controller.signal.aborted) break;

        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const lastDoubleNewline = buffer.lastIndexOf('\n\n');
        if (lastDoubleNewline === -1) continue;

        const completePart = buffer.slice(0, lastDoubleNewline + 2);
        buffer = buffer.slice(lastDoubleNewline + 2);

        const events = parseSSEEvents(completePart);

        for (const evt of events) {
          try {
            const parsed = JSON.parse(evt.data);

            switch (evt.event) {
              case 'text': {
                fullContent += parsed.text || parsed.content || '';
                setStreamingContent(fullContent);
                break;
              }
              case 'vault_ref': {
                vaultRefs.push(parsed);
                setStreamingVaultRefs([...vaultRefs]);
                break;
              }
              case 'tool_call': {
                const toolName = parsed.name || parsed.tool || 'tool';
                setStreamingToolCalls((prev) => [...prev, toolName]);
                break;
              }
              case 'tool_result': {
                setStreamingToolCalls((prev) => prev.slice(1));
                break;
              }
              case 'error': {
                toast.error(parsed.message || 'An error occurred');
                break;
              }
              case 'done': {
                conversationId = parsed.conversation_id ?? null;
                model = parsed.model ?? null;
                tokensUsed = parsed.tokens_used ?? null;
                break;
              }
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }

      // Finalize: add assistant message
      const assistantMessage: AIConversationMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: fullContent,
        model,
        tool_calls_json: null,
        vault_chunks_used: vaultRefs.map((r) => r.chunk_id),
        tokens_used: tokensUsed,
        cost_usd: null,
        created_at: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setStreamingContent('');
      setStreamingVaultRefs([]);
      setStreamingToolCalls([]);

      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversation(conversationId);
      }

      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['ai-conversation', conversationId] });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Failed to send message');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isStreaming, activeConversationId, setActiveConversation, queryClient]);

  // Handle pending message from ChatContext (auto-send on open)
  useEffect(() => {
    if (isOpen && pendingMessage && !pendingMessageHandled.current) {
      pendingMessageHandled.current = true;
      const msg = pendingMessage;
      clearPendingMessage();
      sendMessage(msg);
    }
    if (!pendingMessage) {
      pendingMessageHandled.current = false;
    }
  }, [isOpen, pendingMessage, clearPendingMessage, sendMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const handleSend = useCallback(() => {
    const message = inputValue.trim();
    if (!message || isStreaming) return;

    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    sendMessage(message);
  }, [inputValue, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleOpenFullView = useCallback(() => {
    closeChat();
    navigate('/ai');
  }, [closeChat, navigate]);

  // Build the streaming message for display
  const streamingMessage: AIConversationMessage | null = streamingContent
    ? {
        id: -1,
        role: 'assistant',
        content: streamingContent,
        model: null,
        tool_calls_json: null,
        vault_chunks_used: null,
        tokens_used: null,
        cost_usd: null,
        created_at: new Date().toISOString(),
      }
    : null;

  // Don't render on the /ai page
  if (isOnAIPage) return null;

  // Closed state: floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => openChat()}
        className={cn(
          'fixed bottom-6 right-6 w-12 h-12 rounded-full',
          'bg-[#E07A5F] hover:bg-[#C65D42]',
          'shadow-lg hover:shadow-xl',
          'flex items-center justify-center',
          'transition-all duration-200 hover:scale-105',
          'z-50'
        )}
        title="Open Joji AI"
      >
        <Brain className="w-6 h-6 text-white" />
      </button>
    );
  }

  // Open state: chat panel
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6',
        'w-[400px] h-[600px]',
        'bg-[--exec-surface] rounded-2xl shadow-2xl',
        'border border-stone-600/40',
        'z-50',
        'flex flex-col',
        'animate-in zoom-in-95 fade-in duration-200'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-stone-600/40">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#E07A5F]/10 flex items-center justify-center">
            <Brain className="w-4 h-4 text-[#E07A5F]" />
          </div>
          <span className="text-sm font-semibold text-[--exec-text]">Joji AI</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFullView}
            className={cn(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs',
              'text-[--exec-text-muted] hover:text-[--exec-text]',
              'hover:bg-stone-700/50 transition-colors'
            )}
            title="Open full view"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Full view</span>
          </button>
          <button
            onClick={closeChat}
            className={cn(
              'p-1.5 rounded-md',
              'text-[--exec-text-muted] hover:text-[--exec-text]',
              'hover:bg-stone-700/50 transition-colors'
            )}
            title="Close chat"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && !streamingMessage && !isStreaming ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E07A5F]/10 flex items-center justify-center mb-3">
              <Brain className="w-6 h-6 text-[#E07A5F]" />
            </div>
            <h3 className="text-sm font-semibold text-[--exec-text] mb-1">Joji AI</h3>
            <p className="text-xs text-[--exec-text-muted] leading-relaxed">
              Your AI assistant with full CRM context. Ask anything.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {[
                'Summarize my open deals',
                'What tasks are overdue?',
                'Draft a follow-up email',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInputValue(suggestion);
                    textareaRef.current?.focus();
                  }}
                  className={cn(
                    'px-2.5 py-1 text-[11px] rounded-md',
                    'bg-stone-800/50 border border-stone-600/40',
                    'text-[--exec-text-secondary]',
                    'hover:bg-stone-700/50 hover:text-[--exec-text]',
                    'transition-all duration-200'
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}

            {/* Tool call indicator */}
            {streamingToolCalls.length > 0 && (
              <div className="flex items-start">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl rounded-bl-sm',
                    'bg-stone-800/60 border border-stone-700/40',
                    'text-xs text-[--exec-text-muted]'
                  )}
                >
                  <Wrench className="w-3 h-3 text-[--exec-accent] animate-pulse" />
                  Using {streamingToolCalls[0]}...
                </div>
              </div>
            )}

            {/* Streaming message */}
            {streamingMessage && (
              <ChatMessage
                message={streamingMessage}
                vaultRefs={streamingVaultRefs.length > 0 ? streamingVaultRefs : undefined}
              />
            )}

            {/* Loading indicator when streaming but no content yet */}
            {isStreaming && !streamingContent && streamingToolCalls.length === 0 && (
              <div className="flex items-start">
                <div
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-xl rounded-bl-sm',
                    'bg-stone-800/60 border border-stone-700/40'
                  )}
                >
                  <div className="flex gap-1">
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce"
                      style={{ animationDelay: '0ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce"
                      style={{ animationDelay: '150ms' }}
                    />
                    <div
                      className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce"
                      style={{ animationDelay: '300ms' }}
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-stone-700/30 px-4 py-3">
        <div
          className={cn(
            'flex items-end gap-2',
            'bg-stone-800/50 border border-stone-600/40 rounded-lg',
            'focus-within:ring-2 focus-within:ring-[#E07A5F]/20 focus-within:border-[#E07A5F]/50',
            'transition-all duration-200',
            'px-3 py-2.5'
          )}
        >
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask Joji AI..."
            rows={1}
            disabled={isStreaming}
            className={cn(
              'flex-1 bg-transparent resize-none',
              'text-sm text-[--exec-text] placeholder:text-[--exec-text-muted]',
              'focus:outline-none',
              'disabled:opacity-50',
              'max-h-[120px]'
            )}
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputValue.trim()}
            className={cn(
              'flex-shrink-0 p-1.5 rounded-md',
              'transition-all duration-200',
              inputValue.trim() && !isStreaming
                ? 'bg-[#E07A5F] text-white hover:bg-[#C65D42] shadow-sm hover:shadow-md'
                : 'bg-stone-700/30 text-stone-500 cursor-not-allowed'
            )}
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
