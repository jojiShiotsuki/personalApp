import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  page: 'tasks' | 'deals' | 'contacts' | 'projects' | 'goals';
  context?: Record<string, any>;
  onDataChange?: () => void;
}

export default function AIChatPanel({ page, context = {}, onDataChange }: AIChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
          context: { page, ...context }
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
                setMessages((prev) => [...prev, { role: 'assistant', content: assistantMessage }]);
                onDataChange?.();
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
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700"
      >
        <Bot className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="w-96 border-l bg-white flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold">AI Assistant</h3>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-gray-600"
        >
          ×
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            <Bot className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Ask me anything about your {page}!</p>
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
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Bot className="w-4 h-4 text-blue-600" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-4 py-2 max-w-[80%]',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              )}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-blue-600 animate-spin" />
            </div>
            <div className="bg-gray-100 rounded-lg px-4 py-2">
              <p className="text-sm text-gray-500">Thinking...</p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Ask me anything..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isStreaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
