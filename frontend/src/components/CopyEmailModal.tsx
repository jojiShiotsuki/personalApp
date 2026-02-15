import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type { OutreachProspect, RenderedEmail } from '@/types';
import { X, Mail, Copy, Check, Send, Loader2, ChevronDown, AlertTriangle, Edit2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: OutreachProspect;
}

const EMAIL_TEMPLATES = [
  { value: 'email_1', label: 'Email 1 — Initial' },
  { value: 'email_2', label: 'Email 2 — Follow-up 1' },
  { value: 'email_3', label: 'Email 3 — Follow-up 2' },
  { value: 'email_4', label: 'Email 4 — Follow-up 3' },
  { value: 'email_5', label: 'Email 5 — Final' },
  { value: 'agency_email', label: 'Agency Email' },
];

const STEP_TO_TYPE: Record<number, string> = {
  1: 'email_1', 2: 'email_2', 3: 'email_3', 4: 'email_4', 5: 'email_5',
};

const DEFAULT_ISSUE_DESCRIPTIONS: Record<string, { label: string; description: string; color: string }> = {
  slow_load: { label: 'Slow Load', description: 'a slow-loading website', color: 'text-red-400 bg-red-900/30 border-red-800' },
  not_mobile_friendly: { label: 'Not Mobile', description: 'a website that isn\'t mobile-friendly', color: 'text-orange-400 bg-orange-900/30 border-orange-800' },
  no_google_presence: { label: 'No Google', description: 'limited Google presence', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  no_clear_cta: { label: 'No CTA', description: 'no clear call-to-action on their website', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  outdated_design: { label: 'Outdated', description: 'an outdated website design', color: 'text-purple-400 bg-purple-900/30 border-purple-800' },
};

const STORAGE_KEY = 'outreach-issue-descriptions';

function loadCustomDescriptions(): Record<string, string> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveCustomDescriptions(custom: Record<string, string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom));
}

export default function CopyEmailModal({
  isOpen,
  onClose,
  prospect,
}: CopyEmailModalProps) {
  const defaultType = STEP_TO_TYPE[prospect.current_step] || 'email_1';
  const [selectedTemplate, setSelectedTemplate] = useState(defaultType);
  const [copiedField, setCopiedField] = useState<'to' | 'subject' | 'body' | 'all' | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [isEditingIssues, setIsEditingIssues] = useState(false);
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>(loadCustomDescriptions);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  // Get the effective description for an issue (custom or default)
  const getDescription = (issueKey: string): string => {
    if (customDescriptions[issueKey]) return customDescriptions[issueKey];
    return DEFAULT_ISSUE_DESCRIPTIONS[issueKey]?.description || issueKey;
  };

  // Query rendered email with selected template type
  const { data: rawEmail, isLoading, error } = useQuery<RenderedEmail>({
    queryKey: ['rendered-email', prospect.id, selectedTemplate],
    queryFn: () => coldOutreachApi.renderEmail(prospect.id, selectedTemplate),
    enabled: isOpen,
  });

  // Apply {issue} replacement client-side
  const email = useMemo(() => {
    if (!rawEmail) return null;
    const issueText = selectedIssue
      ? getDescription(selectedIssue)
      : '{issue}';
    return {
      ...rawEmail,
      subject: rawEmail.subject.replace(/\{issue\}/g, issueText),
      body: rawEmail.body.replace(/\{issue\}/g, issueText),
    };
  }, [rawEmail, selectedIssue, customDescriptions]);

  // Available issues: prospect's detected issues, or all if none
  const availableIssues = prospect.website_issues && prospect.website_issues.length > 0
    ? prospect.website_issues
    : Object.keys(DEFAULT_ISSUE_DESCRIPTIONS);

  // Check if the template contains {issue}
  const hasIssuePlaceholder = rawEmail
    ? rawEmail.subject.includes('{issue}') || rawEmail.body.includes('{issue}')
    : false;

  // Initialize edit drafts when entering edit mode
  useEffect(() => {
    if (isEditingIssues) {
      const drafts: Record<string, string> = {};
      for (const key of availableIssues) {
        drafts[key] = getDescription(key);
      }
      setEditDrafts(drafts);
    }
  }, [isEditingIssues]);

  const handleSaveDescriptions = () => {
    const updated = { ...customDescriptions };
    for (const [key, value] of Object.entries(editDrafts)) {
      const trimmed = value.trim();
      if (trimmed && trimmed !== DEFAULT_ISSUE_DESCRIPTIONS[key]?.description) {
        updated[key] = trimmed;
      } else if (trimmed === DEFAULT_ISSUE_DESCRIPTIONS[key]?.description) {
        delete updated[key];
      }
    }
    setCustomDescriptions(updated);
    saveCustomDescriptions(updated);
    setIsEditingIssues(false);
    toast.success('Issue descriptions saved');
  };

  // Mark sent mutation
  const markSentMutation = useMutation({
    mutationFn: () => coldOutreachApi.markSent(prospect.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to mark as sent');
    },
  });

  const handleCopy = async (field: 'to' | 'subject' | 'body', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} copied!`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleCopyAllAndMarkSent = async () => {
    if (!email) return;

    try {
      // Format full email for clipboard
      const fullEmail = `To: ${email.to_email}\nSubject: ${email.subject}\n\n${email.body}`;
      await navigator.clipboard.writeText(fullEmail);
      setCopiedField('all');
      toast.success('Full email copied!');

      // Mark as sent
      markSentMutation.mutate();
    } catch {
      toast.error('Failed to copy email');
    }
  };

  if (!isOpen) return null;

  const CopyButton = ({
    field,
    value,
  }: {
    field: 'to' | 'subject' | 'body';
    value: string;
  }) => (
    <button
      onClick={() => handleCopy(field, value)}
      className={cn(
        'p-1.5 rounded-lg transition-all duration-200',
        'hover:bg-[--exec-surface-alt]',
        copiedField === field
          ? 'text-green-500'
          : 'text-[--exec-text-muted] hover:text-[--exec-text]'
      )}
      title={copiedField === field ? 'Copied!' : 'Copy'}
    >
      {copiedField === field ? (
        <Check className="w-4 h-4" />
      ) : (
        <Copy className="w-4 h-4" />
      )}
    </button>
  );

  const inputClasses = cn(
    'w-full px-3 py-1.5 rounded-lg text-xs',
    'bg-stone-800/50 border border-stone-600/40',
    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
    'transition-all'
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                <Mail className="w-5 h-5 text-[--exec-accent]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[--exec-text]">
                  Copy Email
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-[--exec-text-muted]">
                    {prospect.agency_name}
                  </span>
                  <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full">
                    Step {prospect.current_step}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Template Selector */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider mb-2">
              Template
            </label>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg appearance-none',
                  'bg-stone-800/50 border border-stone-600/40',
                  'text-[--exec-text] text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'transition-all cursor-pointer'
                )}
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}{t.value === defaultType ? ' (Current Step)' : ''}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted] pointer-events-none" />
            </div>
          </div>

          {/* Issue Quick-Select */}
          {availableIssues.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider flex items-center gap-1.5">
                  <AlertTriangle className="w-3 h-3" />
                  Website Issue
                </label>
                <button
                  onClick={() => {
                    if (isEditingIssues) {
                      handleSaveDescriptions();
                    } else {
                      setIsEditingIssues(true);
                    }
                  }}
                  className={cn(
                    'p-1 rounded-md transition-colors text-xs flex items-center gap-1',
                    isEditingIssues
                      ? 'text-green-400 hover:text-green-300 hover:bg-green-900/30'
                      : 'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
                  )}
                  title={isEditingIssues ? 'Save changes' : 'Edit issue text'}
                >
                  {isEditingIssues ? (
                    <>
                      <Check className="w-3 h-3" />
                      <span>Save</span>
                    </>
                  ) : (
                    <>
                      <Edit2 className="w-3 h-3" />
                      <span>Edit</span>
                    </>
                  )}
                </button>
              </div>

              {isEditingIssues ? (
                <div className="space-y-2">
                  {availableIssues.map((issue) => {
                    const info = DEFAULT_ISSUE_DESCRIPTIONS[issue];
                    if (!info) return null;
                    return (
                      <div key={issue} className="flex items-center gap-2">
                        <span className={cn(
                          'px-2 py-1 rounded text-[10px] font-medium border whitespace-nowrap',
                          info.color
                        )}>
                          {info.label}
                        </span>
                        <input
                          type="text"
                          value={editDrafts[issue] || ''}
                          onChange={(e) => setEditDrafts({ ...editDrafts, [issue]: e.target.value })}
                          className={inputClasses}
                          placeholder={info.description}
                        />
                      </div>
                    );
                  })}
                  <p className="text-[10px] text-[--exec-text-muted] mt-1">
                    This text replaces {'{issue}'} in your email template
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableIssues.map((issue) => {
                    const info = DEFAULT_ISSUE_DESCRIPTIONS[issue];
                    if (!info) return null;
                    const isSelected = selectedIssue === issue;
                    const desc = getDescription(issue);
                    return (
                      <button
                        key={issue}
                        onClick={() => setSelectedIssue(isSelected ? null : issue)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200',
                          isSelected
                            ? cn(info.color, 'ring-2 ring-white/20 scale-105')
                            : 'bg-stone-800/50 border-stone-600/40 text-[--exec-text-muted] hover:border-stone-500 hover:text-[--exec-text]'
                        )}
                        title={desc}
                      >
                        {info.label}
                      </button>
                    );
                  })}
                </div>
              )}

              {!isEditingIssues && selectedIssue && (
                <p className="text-xs text-green-400/70 mt-1.5">
                  Inserting: "{getDescription(selectedIssue)}"
                </p>
              )}
              {!isEditingIssues && !selectedIssue && hasIssuePlaceholder && (
                <p className="text-xs text-amber-400/70 mt-1.5">
                  Select an issue to fill the {'{issue}'} placeholder
                </p>
              )}
            </div>
          )}

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-[--exec-accent] animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-400 mb-2">Failed to load email template</p>
              <p className="text-sm text-[--exec-text-muted]">
                Make sure you have a template set up for {EMAIL_TEMPLATES.find(t => t.value === selectedTemplate)?.label || selectedTemplate}
              </p>
            </div>
          ) : email ? (
            <div className="space-y-4">
              {/* To Field */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    To
                  </label>
                  <CopyButton field="to" value={email.to_email} />
                </div>
                <p className="text-sm text-[--exec-text] font-medium">
                  {email.to_email}
                </p>
              </div>

              {/* Subject Field */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Subject
                  </label>
                  <CopyButton field="subject" value={email.subject} />
                </div>
                <p className="text-sm text-[--exec-text] font-medium">
                  {email.subject || <span className="text-[--exec-text-muted] italic">No subject set</span>}
                </p>
              </div>

              {/* Body Field */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Body
                  </label>
                  <CopyButton field="body" value={email.body} />
                </div>
                <div className="text-sm text-[--exec-text] whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                  {email.body}
                </div>
              </div>
            </div>
          ) : null}

          {/* Footer */}
          <div className="flex gap-3 justify-end pt-6 border-t border-stone-700/30 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCopyAllAndMarkSent}
              disabled={!email || markSentMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg',
                'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
                'shadow-sm hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {markSentMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Marking as Sent...
                </>
              ) : copiedField === 'all' ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied & Marking Sent...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Copy All & Mark Sent
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
