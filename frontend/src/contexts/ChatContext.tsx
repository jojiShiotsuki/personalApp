import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ChatContextType {
  isOpen: boolean;
  pendingMessage: string | null;
  openChat: (message?: string) => void;
  closeChat: () => void;
  clearPendingMessage: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const openChat = useCallback((message?: string) => {
    if (message) {
      setPendingMessage(message);
    }
    setIsOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setIsOpen(false);
  }, []);

  const clearPendingMessage = useCallback(() => {
    setPendingMessage(null);
  }, []);

  return (
    <ChatContext.Provider value={{ isOpen, pendingMessage, openChat, closeChat, clearPendingMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
