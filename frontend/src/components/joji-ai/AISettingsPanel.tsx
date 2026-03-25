import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Github, RefreshCw, Cpu, MessageSquareText, DollarSign, Check, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { jojiAiApi } from '@/lib/api';
import { toast } from 'sonner';
import type { JojiAISettingsUpdate } from '@/types';

interface AISettingsPanelProps {
  onBack: () => void;
}

const inputClasses = cn(
  'w-full px-3 py-2 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

export default function AISettingsPanel({ onBack }: AISettingsPanelProps) {
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => jojiAiApi.getSettings(),
  });

  const [repoUrl, setRepoUrl] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [githubDirty, setGithubDirty] = useState(false);

  // Initialize form values when settings load
  const initGithub = (url: string | null) => {
    setRepoUrl(url || '');
    setGithubToken('');
    setGithubDirty(false);
  };

  // Track if we've initialized with current settings
  const [initializedSettingsId, setInitializedSettingsId] = useState<number | null>(null);
  if (settings && settings.id !== initializedSettingsId) {
    initGithub(settings.github_repo_url);
    setInitializedSettingsId(settings.id);
  }

  const updateMutation = useMutation({
    mutationFn: (data: JojiAISettingsUpdate) => jojiAiApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      setGithubDirty(false);
      setGithubToken('');
    },
  });

  const syncMutation = useMutation({
    mutationFn: () => jojiAiApi.syncVault(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
    },
  });

  const templateMutation = useMutation({
    mutationFn: () => jojiAiApi.generateVaultTemplates(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success(`Generated ${data.files_written} vault template files`);
    },
    onError: () => {
      toast.error('Failed to generate templates');
    },
  });

  const gmailBackfillMutation = useMutation({
    mutationFn: () => jojiAiApi.gmailVaultBackfill(),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ai-settings'] });
      toast.success(data.message || 'Gmail indexing started in background');
    },
    onError: () => {
      toast.error('Failed to index Gmail');
    },
  });

  const handleSaveGithub = () => {
    const update: JojiAISettingsUpdate = {};
    if (repoUrl !== (settings?.github_repo_url || '')) {
      update.github_repo_url = repoUrl;
    }
    if (githubToken) {
      update.github_token = githubToken;
    }
    if (Object.keys(update).length > 0) {
      updateMutation.mutate(update);
    }
  };

  const handleModelChange = (model: string) => {
    updateMutation.mutate({ default_model: model });
  };

  const handleSystemPromptSave = (prompt: string) => {
    updateMutation.mutate({ system_prompt_override: prompt || undefined });
  };

  const formatLastSync = (dateStr: string | null): string => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const formatCost = (cost: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    }).format(cost);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <RefreshCw className="w-4 h-4 text-stone-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-700/30">
        <button
          onClick={onBack}
          className={cn(
            'flex items-center gap-1.5 text-xs text-[--exec-text-secondary]',
            'hover:text-[--exec-text] transition-colors'
          )}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to conversations
        </button>
        <h2 className="text-sm font-semibold text-[--exec-text] mt-2">Joji AI Settings</h2>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* GitHub Section */}
        <section>
          <h3 className="text-xs font-semibold text-[--exec-text] mb-3 flex items-center gap-2">
            <Github className="w-3.5 h-3.5 text-[--exec-accent]" />
            Knowledge Vault
          </h3>
          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-medium text-[--exec-text-muted] mb-1 uppercase tracking-wider">
                Repository URL
              </label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => { setRepoUrl(e.target.value); setGithubDirty(true); }}
                placeholder="https://github.com/user/repo"
                className={inputClasses}
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[--exec-text-muted] mb-1 uppercase tracking-wider">
                GitHub Token
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => { setGithubToken(e.target.value); setGithubDirty(true); }}
                  placeholder={settings?.has_github_token ? '••••••••' : 'ghp_...'}
                  className={inputClasses}
                />
                {settings?.has_github_token && (
                  <span className={cn(
                    'absolute right-2 top-1/2 -translate-y-1/2',
                    'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]',
                    'bg-green-900/30 text-green-400 border border-green-800/50'
                  )}>
                    <Check className="w-2.5 h-2.5" />
                    Connected
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleSaveGithub}
              disabled={!githubDirty || updateMutation.isPending}
              className={cn(
                'w-full px-3 py-2 rounded-lg text-xs font-medium',
                'transition-all duration-200',
                githubDirty
                  ? 'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md'
                  : 'bg-stone-700/30 text-stone-500 cursor-not-allowed'
              )}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save GitHub Config'}
            </button>
          </div>
        </section>

        {/* Sync Section */}
        <section className="pt-4 border-t border-stone-700/30">
          <h3 className="text-xs font-semibold text-[--exec-text] mb-3 flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 text-[--exec-accent]" />
            Vault Sync
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[--exec-text-muted]">Files synced</span>
              <span className="text-[--exec-text-secondary] font-medium">
                {settings?.last_sync_file_count ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[--exec-text-muted]">Last sync</span>
              <span className="text-[--exec-text-secondary] font-medium">
                {formatLastSync(settings?.last_sync_at ?? null)}
              </span>
            </div>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending || !settings?.github_repo_url}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                'bg-stone-800/50 border border-stone-600/40',
                'text-[--exec-text-secondary]',
                'hover:bg-stone-700/50 hover:text-[--exec-text]',
                'transition-all duration-200',
                'disabled:opacity-40 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('w-3.5 h-3.5', syncMutation.isPending && 'animate-spin')} />
              {syncMutation.isPending ? 'Syncing...' : 'Sync Now'}
            </button>
            <button
              onClick={() => templateMutation.mutate()}
              disabled={templateMutation.isPending || !settings?.github_repo_url}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                'bg-[--exec-accent]/10 text-[--exec-accent] border border-[--exec-accent]/20',
                'hover:bg-[--exec-accent]/20 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {templateMutation.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <MessageSquareText className="w-3 h-3" />
              )}
              {templateMutation.isPending ? 'Generating...' : 'Generate Vault Templates'}
            </button>
            <button
              onClick={() => gmailBackfillMutation.mutate()}
              disabled={gmailBackfillMutation.isPending || !settings?.github_repo_url}
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium',
                'bg-[--exec-accent]/10 text-[--exec-accent] border border-[--exec-accent]/20',
                'hover:bg-[--exec-accent]/20 transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {gmailBackfillMutation.isPending ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Mail className="w-3 h-3" />
              )}
              {gmailBackfillMutation.isPending ? 'Indexing Gmail...' : 'Index Gmail (6 months)'}
            </button>
          </div>

          {/* Gmail backfill status */}
          {settings?.gmail_backfill_status && (
            <div className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-xs mt-2',
              settings.gmail_backfill_status === 'success' && 'bg-green-900/20 text-green-400 border border-green-800/30',
              settings.gmail_backfill_status === 'failed' && 'bg-red-900/20 text-red-400 border border-red-800/30',
              (settings.gmail_backfill_status === 'started' || settings.gmail_backfill_status === 'in_progress') && 'bg-yellow-900/20 text-yellow-400 border border-yellow-800/30',
            )}>
              {(settings.gmail_backfill_status === 'started' || settings.gmail_backfill_status === 'in_progress') && (
                <RefreshCw className="w-3 h-3 animate-spin" />
              )}
              {settings.gmail_backfill_status === 'success' && (
                <Check className="w-3 h-3" />
              )}
              <span>
                {settings.gmail_backfill_status === 'started' && 'Gmail indexing starting...'}
                {settings.gmail_backfill_status === 'in_progress' && 'Indexing Gmail threads...'}
                {settings.gmail_backfill_status === 'success' && `Indexed ${settings.gmail_backfill_threads ?? 0} email threads`}
                {settings.gmail_backfill_status === 'failed' && `Failed: ${settings.gmail_backfill_error || 'Unknown error'}`}
              </span>
            </div>
          )}
        </section>

        {/* Model Section */}
        <section className="pt-4 border-t border-stone-700/30">
          <h3 className="text-xs font-semibold text-[--exec-text] mb-3 flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-[--exec-accent]" />
            Default Model
          </h3>
          <div className="space-y-2">
            {[
              { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5', desc: 'Everyday questions — cheapest' },
              { value: 'claude-sonnet-4-6', label: 'Sonnet 4.6', desc: 'Complex tasks & writing' },
              { value: 'claude-opus-4-6', label: 'Opus 4.6', desc: 'Deep reasoning — most expensive' },
            ].map((model) => (
              <button
                key={model.value}
                onClick={() => handleModelChange(model.value)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left',
                  'border transition-all duration-200',
                  settings?.default_model === model.value
                    ? 'bg-[--exec-accent-bg] border-[--exec-accent]/30 text-[--exec-accent]'
                    : 'bg-stone-800/30 border-stone-600/30 text-[--exec-text-secondary] hover:bg-stone-700/30'
                )}
              >
                <div className={cn(
                  'w-3 h-3 rounded-full border-2 flex-shrink-0',
                  settings?.default_model === model.value
                    ? 'border-[--exec-accent] bg-[--exec-accent]'
                    : 'border-stone-500'
                )} />
                <div>
                  <div className="text-xs font-medium">{model.label}</div>
                  <div className="text-[10px] text-[--exec-text-muted]">{model.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* System Prompt Section */}
        <SystemPromptSection
          value={settings?.system_prompt_override || ''}
          onSave={handleSystemPromptSave}
          isPending={updateMutation.isPending}
        />

        {/* Cost Section */}
        <section className="pt-4 border-t border-stone-700/30">
          <h3 className="text-xs font-semibold text-[--exec-text] mb-3 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-[--exec-accent]" />
            Usage
          </h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-[--exec-text-muted]">Total tokens</span>
              <span className="text-[--exec-text-secondary] font-medium">
                {(settings?.total_tokens_used ?? 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-[--exec-text-muted]">Total cost</span>
              <span className="text-[--exec-text-secondary] font-medium">
                {formatCost(settings?.total_cost_usd ?? 0)}
              </span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/** Extracted sub-component for system prompt to manage its own local state */
function SystemPromptSection({
  value,
  onSave,
  isPending,
}: {
  value: string;
  onSave: (prompt: string) => void;
  isPending: boolean;
}) {
  const [prompt, setPrompt] = useState(value);
  const [dirty, setDirty] = useState(false);

  // Re-sync local state when the saved value changes (e.g. after successful save)
  const [lastSavedValue, setLastSavedValue] = useState(value);
  if (value !== lastSavedValue) {
    setPrompt(value);
    setDirty(false);
    setLastSavedValue(value);
  }

  return (
    <section className="pt-4 border-t border-stone-700/30">
      <h3 className="text-xs font-semibold text-[--exec-text] mb-3 flex items-center gap-2">
        <MessageSquareText className="w-3.5 h-3.5 text-[--exec-accent]" />
        System Prompt
      </h3>
      <textarea
        value={prompt}
        onChange={(e) => { setPrompt(e.target.value); setDirty(true); }}
        placeholder="Add custom instructions for Joji..."
        rows={4}
        className={cn(
          inputClasses,
          'resize-none'
        )}
      />
      {dirty && (
        <button
          onClick={() => onSave(prompt)}
          disabled={isPending}
          className={cn(
            'w-full mt-2 px-3 py-2 rounded-lg text-xs font-medium',
            'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark]',
            'shadow-sm hover:shadow-md transition-all duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed'
          )}
        >
          {isPending ? 'Saving...' : 'Save Prompt'}
        </button>
      )}
    </section>
  );
}
