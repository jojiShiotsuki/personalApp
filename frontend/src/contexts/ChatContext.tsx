import { createContext, useContext, useState, ReactNode } from 'react';

interface ChatContextType {
  activeConversationId: number | null;
  isOpen: boolean;
  pendingMessage: string | null;
  openChat: (message?: string) => void;
  closeChat: () => void;
  setActiveConversation: (id: number | null) => void;
  newConversation: () => void;
  clearPendingMessage: () => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const openChat = (message?: string) => {
    if (message) setPendingMessage(message);
    setIsOpen(true);
  };

  const closeChat = () => setIsOpen(false);

  const setActiveConversation = (id: number | null) => setActiveConversationId(id);

  const newConversation = () => {
    setActiveConversationId(null);
  };

  const clearPendingMessage = () => setPendingMessage(null);

  return (
    <ChatContext.Provider value={{
      activeConversationId, isOpen, pendingMessage,
      openChat, closeChat, setActiveConversation, newConversation, clearPendingMessage,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
