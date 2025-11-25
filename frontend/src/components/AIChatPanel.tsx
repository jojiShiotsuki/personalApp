import { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChat } from '@/contexts/ChatContext';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatPanel() {
  const location = useLocation();
  const queryClient = useQueryClient();
  const { isOpen, pendingMessage, openChat, closeChat, clearPendingMessage } = useChat();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Determine current page from location
  const getPageFromPath = (path: string): string => {
    if (path.includes('tasks')) return 'tasks';
    if (path.includes('deals')) return 'deals';
    if (path.includes('contacts')) return 'contacts';
    if (path.includes('projects')) return 'projects';
    if (path.includes('goals')) return 'goals';
    return 'dashboard';
  };

  const page = getPageFromPath(location.pathname);

  const handleDataChange = () => {
    // Since the AI can modify any part of the app from any page,
    // we should invalidate all major data queries to ensure UI consistency.
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['deals'] });
    queryClient.invalidateQueries({ queryKey: ['contacts'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle pending message from context (e.g., from briefing "Ask AI" button)
  useEffect(() => {
    if (pendingMessage && isOpen && !isStreaming) {
      setInput(pendingMessage);
      clearPendingMessage();
      // Auto-send after a brief delay to show the message first
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [pendingMessage, isOpen, isStreaming, clearPendingMessage]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && !pendingMessage) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, pendingMessage]);

  const sendMessage = async () => {
    if (!input.trim() || isStreaming) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsStreaming(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          context: { page }
        })
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.slice(6);
              if (data === '[DONE]') {
                handleDataChange();
              } else {
                assistantMessage += data;
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMsg = newMessages[newMessages.length - 1];
                  if (lastMsg?.role === 'assistant') {
                    lastMsg.content = assistantMessage;
                  } else {
                    newMessages.push({ role: 'assistant', content: assistantMessage });
                  }
                  return newMessages;
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('AI chat error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, I encountered an error. Please try again.' }
      ]);
    } finally {
      setIsStreaming(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => openChat()}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 dark:bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-700 dark:hover:bg-blue-600"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] max-h-[80vh] border border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800 flex flex-col shadow-2xl shadow-gray-200/50 dark:shadow-gray-900/50 z-50 rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between bg-gray-50/50 dark:bg-gray-700/30 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
            <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white">AI Assistant</h3>
        </div>
        <button
          onClick={closeChat}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <span className="sr-only">Close</span>
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/30 dark:bg-gray-900/30">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <Bot className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-white mb-1">How can I help?</h4>
            <p className="text-sm text-gray-500 dark:text-gray-400">Ask me anything about your {page}!</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={cn(
              'flex gap-3',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                <Bot className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
            )}
            <div
              className={cn(
                'rounded-2xl px-4 py-3 max-w-[85%] shadow-sm text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white rounded-tr-sm'
                  : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-tl-sm'
              )}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-900 dark:bg-gray-700 flex items-center justify-center flex-shrink-0 shadow-sm mt-1">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-sm mt-1">
              <Loader2 className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-spin" />
            </div>
            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200/60 dark:border-gray-700/60 bg-white dark:bg-gray-800">
        <div className="flex gap-2 items-end bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            placeholder="Ask me anything..."
            disabled={isStreaming}
            rows={1}
            className="flex-1 px-3 py-2 bg-transparent border-none focus:outline-none resize-none max-h-32 text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            style={{ minHeight: '40px' }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="p-2 bg-blue-600 dark:bg-blue-500 text-white rounded-xl hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm mb-0.5"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-xs text-center text-gray-400 dark:text-gray-500 mt-2">
          AI can make mistakes. Review generated content.
        </p>
      </div>
    </div>
  );
}
