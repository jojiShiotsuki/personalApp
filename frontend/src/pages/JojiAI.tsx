import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Send, Brain, Loader2, Wrench, Mic, MicOff } from 'lucide-react';
import { useSpeechToText } from '@/hooks/useSpeechToText';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { jojiAiApi } from '@/lib/api';
import { useChat } from '@/contexts/ChatContext';
import { useTypewriter } from '@/hooks/useTypewriter';
import ConversationSidebar from '@/components/joji-ai/ConversationSidebar';
import AISettingsPanel from '@/components/joji-ai/AISettingsPanel';
import ChatMessage from '@/components/joji-ai/ChatMessage';
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

export default function JojiAI() {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversation, pendingMessage, clearPendingMessage } = useChat();

  const [messages, setMessages] = useState<AIConversationMessage[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingVaultRefs, setStreamingVaultRefs] = useState<VaultChunkRef[]>([]);
  const [streamingToolCalls, setStreamingToolCalls] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const { isListening, transcript, toggleListening, isSupported: speechSupported } = useSpeechToText((text) => {
    setInputValue(prev => prev ? prev + ' ' + text : text);
  });

  useEffect(() => {
    if (isListening && transcript) {
      setInputValue(transcript);
    }
  }, [isListening, transcript]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load conversation messages when activeConversationId changes
  const { data: conversationData, isSuccess } = useQuery({
    queryKey: ['ai-conversation', activeConversationId],
    queryFn: () => jojiAiApi.getConversation(activeConversationId!),
    enabled: !!activeConversationId,
    staleTime: 0, // Always refetch when conversation changes
  });

  // Sync loaded conversation messages into local state
  useEffect(() => {
    if (isSuccess && conversationData?.messages) {
      setMessages(conversationData.messages);
      setStreamingContent('');
      setStreamingVaultRefs([]);
      setStreamingToolCalls([]);
    }
  }, [conversationData, isSuccess, activeConversationId]);

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

  // Handle pending message from ChatContext (e.g., opened from elsewhere)
  useEffect(() => {
    if (pendingMessage) {
      setInputValue(pendingMessage);
      clearPendingMessage();
      // Auto-focus the textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [pendingMessage, clearPendingMessage]);

  // Auto-resize textarea
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  const handleSend = useCallback(async () => {
    const message = inputValue.trim();
    if (!message || isStreaming) return;

    // Reset input
    setInputValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    // Optimistic user message
    const userMessage: AIConversationMessage = {
      id: Date.now(),
      role: 'user',
      content: message,
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
      const response = await jojiAiApi.chat(message, activeConversationId ?? undefined);
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

        // Process complete SSE events (separated by double newlines)
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
                // Tool result received, clear the indicator for this tool
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
                // Learning runs in background — poll for results after a delay
                if (parsed.conversation_id) {
                  setTimeout(async () => {
                    try {
                      const resp = await fetch(`${import.meta.env.VITE_API_URL || (import.meta.env.PROD ? 'https://vertex-api-smg3.onrender.com' : 'http://localhost:8000')}/api/ai/conversations/${parsed.conversation_id}/learn-status`, {
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('auth_token')}` },
                      });
                      if (resp.ok) {
                        const data = await resp.json();
                        if (data.insights_saved > 0) {
                          toast.success(`Brain updated — ${data.insights_saved} new insight${data.insights_saved > 1 ? 's' : ''} saved`, { duration: 4000 });
                        }
                      }
                    } catch { /* silent */ }
                  }, 6000);
                }
                break;
              }
              case 'learned': {
                const count = parsed.insights_saved || 0;
                toast.success(`Brain updated — ${count} new insight${count > 1 ? 's' : ''} saved`, {
                  duration: 4000,
                });
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

      // Update conversation ID if this was a new conversation
      if (conversationId && conversationId !== activeConversationId) {
        setActiveConversation(conversationId);
      }

      // Invalidate conversation list to show new/updated conversation
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (conversationId) {
        queryClient.invalidateQueries({ queryKey: ['ai-conversation', conversationId] });
      }

      // Re-fetch conversation list after delay to pick up AI-generated title
      if (conversationId && conversationId !== activeConversationId) {
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
        }, 3000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        toast.error(err.message || 'Failed to send message');
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [inputValue, isStreaming, activeConversationId, setActiveConversation, queryClient]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Smoothly animate the streaming content character by character
  const smoothContent = useTypewriter(streamingContent, 2);

  // Build the streaming message for display
  const streamingMessage: AIConversationMessage | null = streamingContent
    ? {
        id: -1,
        role: 'assistant',
        content: smoothContent,
        model: null,
        tool_calls_json: null,
        vault_chunks_used: null,
        tokens_used: null,
        cost_usd: null,
        created_at: new Date().toISOString(),
      }
    : null;

  return (
    <div className="flex h-full bg-[--exec-bg]">
      {/* Left Sidebar */}
      <div className="w-[280px] flex-shrink-0 h-full">
        {showSettings ? (
          <AISettingsPanel onBack={() => setShowSettings(false)} />
        ) : (
          <ConversationSidebar
            onShowSettings={() => setShowSettings(true)}
            showSettings={showSettings}
          />
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !streamingMessage && !isStreaming ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#E07A5F]/10 flex items-center justify-center mb-4">
                <Brain className="w-8 h-8 text-[#E07A5F]" />
              </div>
              <h2 className="text-xl font-semibold text-[--exec-text] mb-2">Joji AI</h2>
              <p className="text-sm text-[--exec-text-muted] max-w-md leading-relaxed">
                Your personal AI assistant with full business context.
                Ask about your contacts, deals, projects, tasks, or anything in your knowledge vault.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
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
                      'px-3 py-1.5 text-xs rounded-lg',
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
                  <div className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl rounded-bl-sm',
                    'bg-stone-800/60 border border-stone-700/40',
                    'text-xs text-[--exec-text-muted]'
                  )}>
                    <Wrench className="w-3.5 h-3.5 text-[--exec-accent] animate-pulse" />
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
                  <div className={cn(
                    'flex items-center gap-2 px-4 py-2.5 rounded-xl rounded-bl-sm',
                    'bg-stone-800/60 border border-stone-700/40'
                  )}>
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-stone-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-stone-700/30 px-6 py-4">
          <div className={cn(
            'flex items-end gap-3',
            'bg-stone-800/50 border border-stone-600/40 rounded-xl',
            'focus-within:ring-2 focus-within:ring-[#E07A5F]/20 focus-within:border-[#E07A5F]/50',
            'transition-all duration-200',
            'px-4 py-3'
          )}>
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
                'max-h-[200px]'
              )}
            />
            {speechSupported && (
              <button
                onClick={toggleListening}
                disabled={isStreaming}
                className={cn(
                  'flex-shrink-0 p-2 rounded-lg',
                  'transition-all duration-200',
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-stone-700/30 text-stone-400 hover:text-stone-200 hover:bg-stone-600/30'
                )}
                title={isListening ? 'Stop recording' : 'Voice input'}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={handleSend}
              disabled={isStreaming || !inputValue.trim()}
              className={cn(
                'flex-shrink-0 p-2 rounded-lg',
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
          <p className="text-[10px] text-stone-600 mt-2 text-center">
            Shift+Enter for newlines. Joji AI has access to your CRM data and knowledge vault.
          </p>
        </div>
      </div>
    </div>
  );
}
