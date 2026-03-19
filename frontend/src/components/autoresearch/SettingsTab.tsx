import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { autoresearchApi } from '@/lib/api';
import type { AutoresearchSettings } from '@/types';
import {
  Mail,
  Bot,
  Settings2,
  FileText,
  DollarSign,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unlink,
  ExternalLink,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/utils';

// ─── Model options ───────────────────────────────────────

const MODEL_OPTIONS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6' },
  { value: 'claude-haiku-4-5', label: 'Claude Haiku 4.5' },
  { value: 'claude-opus-4-6', label: 'Claude Opus 4.6' },
] as const;

// ─── Shared styles ───────────────────────────────────────

const sectionClasses = cn(
  'bg-[--exec-surface] rounded-xl border border-stone-600/40 p-6',
);

const sectionTitleClasses = cn(
  'text-base font-semibold text-[--exec-text] flex items-center gap-2 mb-4',
);

const labelClasses = cn(
  'block text-sm font-medium text-[--exec-text-secondary] mb-1.5',
);

const inputClasses = cn(
  'w-full px-4 py-2.5 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm',
);

const selectClasses = cn(
  inputClasses,
  'cursor-pointer appearance-none',
);

// ─── Helpers ─────────────────────────────────────────────

function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return 'Never';
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''} ago`;
}

// ═════════════════════════════════════════════════════════
// Component
// ═════════════════════════════════════════════════════════

export default function SettingsTab() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ─── Local state for the prompt editor ──────────────────
  const [promptDraft, setPromptDraft] = useState('');
  const [promptDirty, setPromptDirty] = useState(false);

  // ─── Fetch settings ─────────────────────────────────────
  const {
    data: settings,
    isLoading: isLoadingSettings,
  } = useQuery<AutoresearchSettings>({
    queryKey: ['autoresearch-settings'],
    queryFn: () => autoresearchApi.getSettings(),
  });

  // ─── Fetch Gmail status ─────────────────────────────────
  const {
    data: gmailStatus,
    isLoading: isLoadingGmail,
  } = useQuery<{
    is_connected: boolean;
    email_address: string | null;
    last_poll_at: string | null;
    is_active: boolean;
  }>({
    queryKey: ['autoresearch-gmail-status'],
    queryFn: () => autoresearchApi.getGmailStatus(),
  });

  // ─── Seed prompt draft from settings ────────────────────
  useEffect(() => {
    if (settings?.audit_prompt != null && !promptDirty) {
      setPromptDraft(settings.audit_prompt);
    }
  }, [settings?.audit_prompt, promptDirty]);

  // ─── Check for gmail=connected query param ──────────────
  useEffect(() => {
    if (searchParams.get('gmail') === 'connected') {
      toast.success('Gmail connected successfully!');
      queryClient.invalidateQueries({ queryKey: ['autoresearch-gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['autoresearch-settings'] });
      // Remove the query param so the toast doesn't repeat on refresh
      const next = new URLSearchParams(searchParams);
      next.delete('gmail');
      setSearchParams(next, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  // ─── Mutations ──────────────────────────────────────────

  const updateSettingsMutation = useMutation({
    mutationFn: (updates: Partial<AutoresearchSettings>) =>
      autoresearchApi.updateSettings(updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['autoresearch-settings'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to update settings'));
    },
  });

  const connectGmailMutation = useMutation({
    mutationFn: () => autoresearchApi.getGmailAuthUrl(),
    onSuccess: (data) => {
      window.open(data.auth_url, '_blank');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to get Gmail auth URL'));
    },
  });

  const disconnectGmailMutation = useMutation({
    mutationFn: () => autoresearchApi.disconnectGmail(),
    onSuccess: () => {
      toast.success('Gmail disconnected');
      queryClient.invalidateQueries({ queryKey: ['autoresearch-gmail-status'] });
      queryClient.invalidateQueries({ queryKey: ['autoresearch-settings'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to disconnect Gmail'));
    },
  });

  const pollGmailMutation = useMutation({
    mutationFn: () => autoresearchApi.pollGmail(),
    onSuccess: (data) => {
      const replies = data.new_reply_matches ?? 0;
      const sent = data.new_sent_matches ?? 0;
      toast.success(
        `Poll complete: ${replies} new replies, ${sent} sent matches`,
      );
      queryClient.invalidateQueries({ queryKey: ['autoresearch-gmail-status'] });
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, 'Failed to poll Gmail'));
    },
  });

  // ─── Handlers ───────────────────────────────────────────

  const handleModelChange = (
    field: 'audit_model' | 'classifier_model' | 'learning_model',
    value: string,
  ) => {
    updateSettingsMutation.mutate({ [field]: value });
    toast.success('Model updated');
  };

  const handleAuditConfigChange = (
    field: 'min_page_load_wait' | 'enable_pass_2' | 'max_batch_size',
    value: number | boolean,
  ) => {
    updateSettingsMutation.mutate({ [field]: value });
    toast.success('Setting updated');
  };

  const handleSavePrompt = () => {
    updateSettingsMutation.mutate(
      { audit_prompt: promptDraft },
      {
        onSuccess: () => {
          setPromptDirty(false);
          toast.success('Audit prompt saved');
        },
      },
    );
  };

  // ─── Loading skeleton ───────────────────────────────────

  if (isLoadingSettings) {
    return (
      <div className="px-8 py-6 space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="bg-[--exec-surface] rounded-xl border border-stone-600/40 p-6 animate-pulse"
          >
            <div className="h-5 w-40 bg-stone-700/50 rounded mb-4" />
            <div className="space-y-3">
              <div className="h-4 w-full bg-stone-700/30 rounded" />
              <div className="h-4 w-2/3 bg-stone-700/30 rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  const isGmailConnected = gmailStatus?.is_connected ?? settings?.gmail_connected ?? false;
  const gmailEmail = gmailStatus?.email_address ?? settings?.gmail_email ?? null;
  const monthlyCost = settings?.monthly_cost ?? 0;
  const totalAudits = settings?.total_audits ?? 0;
  const avgCost = totalAudits > 0 ? monthlyCost / totalAudits : 0;

  return (
    <div className="px-8 py-6 space-y-6 max-w-3xl">
      {/* ───────────────────────────────────────────── */}
      {/* Section 1: Gmail Connection                   */}
      {/* ───────────────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Mail className="w-4 h-4 text-[--exec-accent]" />
          Gmail Connection
        </h2>

        {isLoadingGmail ? (
          <div className="flex items-center gap-2 text-sm text-[--exec-text-muted]">
            <Loader2 className="w-4 h-4 animate-spin" />
            Checking status...
          </div>
        ) : isGmailConnected ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="font-medium text-green-400">Connected</span>
                {gmailEmail && (
                  <span className="text-[--exec-text-muted]">
                    ({gmailEmail})
                  </span>
                )}
              </div>
              <p className="text-xs text-[--exec-text-muted] ml-6">
                Last polled: {formatRelativeTime(gmailStatus?.last_poll_at)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => pollGmailMutation.mutate()}
                disabled={pollGmailMutation.isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                  'bg-stone-700/50 text-[--exec-text-secondary] hover:bg-stone-600/50',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <RefreshCw
                  className={cn(
                    'w-3.5 h-3.5',
                    pollGmailMutation.isPending && 'animate-spin',
                  )}
                />
                {pollGmailMutation.isPending ? 'Polling...' : 'Poll Now'}
              </button>

              <button
                onClick={() => disconnectGmailMutation.mutate()}
                disabled={disconnectGmailMutation.isPending}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200',
                  'text-red-400 hover:bg-red-900/30 hover:text-red-300',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <Unlink className="w-3.5 h-3.5" />
                {disconnectGmailMutation.isPending
                  ? 'Disconnecting...'
                  : 'Disconnect Gmail'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <XCircle className="w-4 h-4 text-stone-500" />
              <span className="text-[--exec-text-muted]">Not connected</span>
            </div>
            <p className="text-xs text-[--exec-text-muted]">
              Connect your Gmail (read-only) to auto-detect replies from
              prospects.
            </p>
            <button
              onClick={() => connectGmailMutation.mutate()}
              disabled={connectGmailMutation.isPending}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl shadow-sm transition-all duration-200',
                'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] hover:shadow-md',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
            >
              <ExternalLink className="w-4 h-4" />
              {connectGmailMutation.isPending
                ? 'Opening...'
                : 'Connect Gmail'}
            </button>
          </div>
        )}
      </section>

      {/* ───────────────────────────────────────────── */}
      {/* Section 2: AI Models                          */}
      {/* ───────────────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Bot className="w-4 h-4 text-[--exec-accent]" />
          AI Models
        </h2>

        <div className="space-y-4">
          {/* Audit Model */}
          <div>
            <label className={labelClasses}>Audit Model</label>
            <select
              value={settings?.audit_model ?? ''}
              onChange={(e) => handleModelChange('audit_model', e.target.value)}
              className={selectClasses}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Reply Classifier */}
          <div>
            <label className={labelClasses}>Reply Classifier</label>
            <select
              value={settings?.classifier_model ?? ''}
              onChange={(e) =>
                handleModelChange('classifier_model', e.target.value)
              }
              className={selectClasses}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Learning Engine */}
          <div>
            <label className={labelClasses}>Learning Engine</label>
            <select
              value={settings?.learning_model ?? ''}
              onChange={(e) =>
                handleModelChange('learning_model', e.target.value)
              }
              className={selectClasses}
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────── */}
      {/* Section 3: Audit Configuration                */}
      {/* ───────────────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <Settings2 className="w-4 h-4 text-[--exec-accent]" />
          Audit Configuration
        </h2>

        <div className="space-y-4">
          {/* Min page load wait */}
          <div>
            <label className={labelClasses}>
              Min page load wait (seconds)
            </label>
            <input
              type="number"
              min={1}
              max={30}
              value={settings?.min_page_load_wait ?? 3}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 30) {
                  handleAuditConfigChange('min_page_load_wait', val);
                }
              }}
              className={cn(inputClasses, 'max-w-[120px]')}
            />
          </div>

          {/* Enable Pass 2 verification */}
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enable-pass-2"
              checked={settings?.enable_pass_2 ?? true}
              onChange={(e) =>
                handleAuditConfigChange('enable_pass_2', e.target.checked)
              }
              className="w-4 h-4 text-[--exec-accent] bg-stone-800/50 border-stone-600/40 rounded focus:ring-[--exec-accent]/40"
            />
            <label
              htmlFor="enable-pass-2"
              className="text-sm font-medium text-[--exec-text-secondary] cursor-pointer select-none"
            >
              Enable Pass 2 verification
            </label>
          </div>

          {/* Max audits per batch */}
          <div>
            <label className={labelClasses}>Max audits per batch</label>
            <input
              type="number"
              min={1}
              max={500}
              value={settings?.max_batch_size ?? 50}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 500) {
                  handleAuditConfigChange('max_batch_size', val);
                }
              }}
              className={cn(inputClasses, 'max-w-[120px]')}
            />
          </div>
        </div>
      </section>

      {/* ───────────────────────────────────────────── */}
      {/* Section 4: Audit Prompt                       */}
      {/* ───────────────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <FileText className="w-4 h-4 text-[--exec-accent]" />
          Audit Prompt
        </h2>

        <p className="text-xs text-[--exec-text-muted] mb-3">
          Your base prompt for website audits. The system automatically appends
          learning context.
        </p>

        <textarea
          rows={15}
          value={promptDraft}
          onChange={(e) => {
            setPromptDraft(e.target.value);
            setPromptDirty(true);
          }}
          className={cn(inputClasses, 'resize-none font-mono text-xs leading-relaxed')}
          placeholder="Enter your audit prompt..."
        />

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={handleSavePrompt}
            disabled={!promptDirty || updateSettingsMutation.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-xl shadow-sm transition-all duration-200',
              'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark] hover:shadow-md',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
          >
            {updateSettingsMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Prompt
          </button>
          {promptDirty && (
            <span className="text-xs text-amber-400">Unsaved changes</span>
          )}
        </div>
      </section>

      {/* ───────────────────────────────────────────── */}
      {/* Section 5: Cost Tracker                       */}
      {/* ───────────────────────────────────────────── */}
      <section className={sectionClasses}>
        <h2 className={sectionTitleClasses}>
          <DollarSign className="w-4 h-4 text-[--exec-accent]" />
          Cost This Month
        </h2>

        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-bold text-[--exec-text] tracking-tight">
            ${monthlyCost.toFixed(2)}
          </span>
          <span className="text-sm text-[--exec-text-muted]">
            spent ({totalAudits} audit{totalAudits !== 1 ? 's' : ''})
          </span>
          {totalAudits > 0 && (
            <>
              <span className="text-[--exec-text-muted]">&middot;</span>
              <span className="text-sm text-[--exec-text-muted]">
                Avg ${avgCost.toFixed(3)}/audit
              </span>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
