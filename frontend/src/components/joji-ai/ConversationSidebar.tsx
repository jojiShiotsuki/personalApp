import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, MessageSquare, Settings, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jojiAiApi } from '@/lib/api';
import { useChat } from '@/contexts/ChatContext';
import type { AIConversation } from '@/types';

interface ConversationSidebarProps {
  onShowSettings: () => void;
  showSettings: boolean;
}

type DateGroup = 'Today' | 'Yesterday' | 'This Week' | 'Older';

function getDateGroup(dateStr: string): DateGroup {
  const date = new Date(dateStr);
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfToday.getDay());

  if (date >= startOfToday) return 'Today';
  if (date >= startOfYesterday) return 'Yesterday';
  if (date >= startOfWeek) return 'This Week';
  return 'Older';
}

function groupConversations(conversations: AIConversation[]): Record<DateGroup, AIConversation[]> {
  const groups: Record<DateGroup, AIConversation[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    Older: [],
  };

  for (const conv of conversations) {
    const group = getDateGroup(conv.updated_at);
    groups[group].push(conv);
  }

  return groups;
}

const GROUP_ORDER: DateGroup[] = ['Today', 'Yesterday', 'This Week', 'Older'];

export default function ConversationSidebar({ onShowSettings, showSettings }: ConversationSidebarProps) {
  const queryClient = useQueryClient();
  const { activeConversationId, setActiveConversation, newConversation } = useChat();
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['ai-conversations'],
    queryFn: () => jojiAiApi.getConversations(),
  });

  const { data: settings } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => jojiAiApi.getSettings(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => jojiAiApi.deleteConversation(id),
    onSuccess: (_data, deletedId) => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      if (activeConversationId === deletedId) {
        newConversation();
      }
    },
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: number; title: string }) =>
      jojiAiApi.renameConversation(id, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-conversations'] });
      setRenamingId(null);
    },
  });

  useEffect(() => {
    if (renamingId !== null && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  const handleDoubleClick = (conv: AIConversation) => {
    setRenamingId(conv.id);
    setRenameValue(conv.title || 'New Chat');
  };

  const handleRenameSubmit = (id: number) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameMutation.mutate({ id, title: trimmed });
    } else {
      setRenamingId(null);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleRenameSubmit(id);
    } else if (e.key === 'Escape') {
      setRenamingId(null);
    }
  };

  const grouped = groupConversations(conversations);

  const syncStatus = settings?.last_sync_status;
  const hasRepo = !!settings?.github_repo_url;

  const syncIndicator = (() => {
    if (!hasRepo) return { color: 'bg-stone-500', label: 'Not configured' };
    if (syncStatus === 'success') return { color: 'bg-green-500', label: 'Synced' };
    if (syncStatus === 'in_progress') return { color: 'bg-yellow-500 animate-pulse', label: 'Syncing...' };
    if (syncStatus === 'failed') return { color: 'bg-red-500', label: 'Failed' };
    return { color: 'bg-stone-500', label: 'Not synced' };
  })();

  return (
    <div className="w-[280px] flex-shrink-0 flex flex-col h-full bg-[--exec-surface] border-r border-stone-700/30">
      {/* New Chat Button */}
      <div className="p-3">
        <button
          onClick={() => newConversation()}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg',
            'bg-stone-800/50 border border-stone-600/40',
            'text-[--exec-text] text-sm font-medium',
            'hover:bg-stone-700/50 hover:border-stone-500/40',
            'transition-all duration-200'
          )}
        >
          <Plus className="w-4 h-4 text-[--exec-accent]" />
          New Chat
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-4 h-4 text-stone-500 animate-spin" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="px-3 py-8 text-center">
            <MessageSquare className="w-8 h-8 text-stone-600 mx-auto mb-2" />
            <p className="text-xs text-[--exec-text-muted]">No conversations yet</p>
          </div>
        ) : (
          GROUP_ORDER.map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            return (
              <div key={group} className="mb-3">
                <div className="px-3 py-1.5">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-[--exec-text-muted]">
                    {group}
                  </span>
                </div>
                {items.map((conv) => {
                  const isActive = activeConversationId === conv.id;
                  const isRenaming = renamingId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      className={cn(
                        'group relative flex items-center gap-2 px-3 py-2 rounded-lg mx-1 cursor-pointer',
                        'transition-all duration-150',
                        isActive
                          ? 'bg-[--exec-accent-bg] text-[--exec-accent]'
                          : 'text-[--exec-text-secondary] hover:bg-stone-700/30 hover:text-[--exec-text]'
                      )}
                      onClick={() => !isRenaming && setActiveConversation(conv.id)}
                      onDoubleClick={() => handleDoubleClick(conv)}
                    >
                      <MessageSquare className={cn(
                        'w-3.5 h-3.5 flex-shrink-0',
                        isActive ? 'text-[--exec-accent]' : 'text-stone-500'
                      )} />

                      {isRenaming ? (
                        <input
                          ref={renameInputRef}
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => handleRenameSubmit(conv.id)}
                          onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                          className={cn(
                            'flex-1 min-w-0 bg-stone-800/80 border border-stone-600/60 rounded px-1.5 py-0.5',
                            'text-xs text-[--exec-text]',
                            'focus:outline-none focus:ring-1 focus:ring-[--exec-accent]/40'
                          )}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span className="flex-1 min-w-0 truncate text-xs">
                          {conv.title || 'New Chat'}
                        </span>
                      )}

                      {/* Delete button (hover reveal) */}
                      {!isRenaming && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(conv.id);
                          }}
                          className={cn(
                            'opacity-0 group-hover:opacity-100',
                            'p-1 rounded-md',
                            'text-stone-500 hover:text-red-400 hover:bg-red-900/30',
                            'transition-all duration-150'
                          )}
                          title="Delete conversation"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Section: Vault Status + Settings */}
      <div className="border-t border-stone-700/30 p-3 space-y-2">
        {/* Vault sync status */}
        <div className="flex items-center gap-2 px-2">
          <div className={cn('w-2 h-2 rounded-full flex-shrink-0', syncIndicator.color)} />
          <span className="text-[10px] text-[--exec-text-muted] flex-1">
            {syncIndicator.label}
          </span>
          {hasRepo && settings?.last_sync_file_count != null && settings.last_sync_file_count > 0 && (
            <span className="text-[10px] text-stone-500">
              {settings.last_sync_file_count} files
            </span>
          )}
        </div>

        {/* Settings button */}
        <button
          onClick={onShowSettings}
          className={cn(
            'w-full flex items-center gap-2 px-3 py-2 rounded-lg',
            'text-xs text-[--exec-text-secondary]',
            'transition-all duration-200',
            showSettings
              ? 'bg-stone-700/50 text-[--exec-text]'
              : 'hover:bg-stone-700/30 hover:text-[--exec-text]'
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          Settings
        </button>
      </div>
    </div>
  );
}
