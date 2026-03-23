import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi, autoresearchApi } from '@/lib/api';
import type { OutreachProspect, RenderedEmail, MultiTouchStep } from '@/types';
import { X, Mail, Copy, Check, Loader2, ChevronDown, AlertTriangle, Edit2, RotateCcw, Send, Sparkles, Video } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CopyEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  prospect: OutreachProspect;
  campaignId?: number;
  multiTouchSteps?: MultiTouchStep[];
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
  campaignId,
  multiTouchSteps,
}: CopyEmailModalProps) {
  // When multi-touch steps are available, use step-based templates
  const hasStepTemplates = multiTouchSteps && multiTouchSteps.length > 0;
  const defaultType = hasStepTemplates
    ? String(prospect.current_step)
    : (STEP_TO_TYPE[prospect.current_step] || 'email_1');
  const [selectedTemplate, setSelectedTemplate] = useState(defaultType);
  const [copiedField, setCopiedField] = useState<'to' | 'subject' | 'body' | 'all' | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<string | null>(null);
  const [isEditingIssues, setIsEditingIssues] = useState(false);
  const [customDescriptions, setCustomDescriptions] = useState<Record<string, string>>(loadCustomDescriptions);
  const [editDrafts, setEditDrafts] = useState<Record<string, string>>({});

  // Editable subject/body — initialized from saved custom values or template
  const [editSubject, setEditSubject] = useState(prospect.custom_email_subject || '');
  const [editBody, setEditBody] = useState(prospect.custom_email_body || '');
  const [editLoomScript, setEditLoomScript] = useState((prospect.custom_fields as any)?.loom_script || '');
  const [hasInitializedFromTemplate, setHasInitializedFromTemplate] = useState(false);

  const queryClient = useQueryClient();

  // Get the effective description for an issue (custom or default)
  const getDescription = (issueKey: string): string => {
    if (customDescriptions[issueKey]) return customDescriptions[issueKey];
    return DEFAULT_ISSUE_DESCRIPTIONS[issueKey]?.description || issueKey;
  };

  // Build email from multi-touch step templates (client-side)
  const stepEmail = useMemo<RenderedEmail | null>(() => {
    if (!hasStepTemplates) return null;
    const stepNum = parseInt(selectedTemplate, 10);
    const step = multiTouchSteps.find(s => s.step_number === stepNum);
    if (!step) return null;
    return {
      to_email: prospect.email || '',
      subject: step.template_subject || '',
      body: step.template_content || '',
      prospect_id: prospect.id,
      step_number: step.step_number,
    };
  }, [hasStepTemplates, multiTouchSteps, selectedTemplate, prospect]);

  // Query rendered email with selected template type (only for non-multi-touch)
  const { data: rawEmailFromApi, isLoading, error } = useQuery<RenderedEmail>({
    queryKey: ['rendered-email', prospect.id, selectedTemplate],
    queryFn: () => coldOutreachApi.renderEmail(prospect.id, selectedTemplate),
    enabled: isOpen && !hasStepTemplates,
  });

  const rawEmail = hasStepTemplates ? stepEmail : rawEmailFromApi;

  // --- AI Follow-up generation (manual, via button) ---
  const canGenerateFollowUp = (prospect.current_step || 1) > 1 && !!prospect.custom_email_subject;
  const [isGeneratingFollowUp, setIsGeneratingFollowUp] = useState(false);
  const [aiFollowUpUsed, setAiFollowUpUsed] = useState(false);

  const handleGenerateFollowUp = async () => {
    setIsGeneratingFollowUp(true);
    try {
      const result = await autoresearchApi.generateFollowup(prospect.id);
      setEditSubject(result.subject);
      setEditBody(result.body);
      if (result.loom_script) {
        setEditLoomScript(result.loom_script);
      }
      setAiFollowUpUsed(true);
      setHasInitializedFromTemplate(true);
      toast.success('AI follow-up generated');
    } catch {
      toast.error('Failed to generate follow-up');
    } finally {
      setIsGeneratingFollowUp(false);
    }
  };

  // Build prospect variable replacements
  const prospectVars = useMemo(() => {
    const contactName = prospect.contact_name || prospect.agency_name;
    const firstName = prospect.contact_name
      ? prospect.contact_name.split(/\s+/)[0]
      : prospect.agency_name;
    return {
      '{agency_name}': prospect.agency_name || '',
      '{contact_name}': contactName || '',
      '{name}': contactName || '',
      '{first_name}': firstName || '',
      '{company}': prospect.agency_name || '',
      '{niche}': prospect.niche || '',
      '{website}': prospect.website || '',
      '{email}': prospect.email || '',
    } as Record<string, string>;
  }, [prospect]);

  // Auto-format pasted email body with proper paragraph spacing
  const formatEmailBody = (text: string): string => {
    // If already has double newlines, assume already formatted
    if (text.includes('\n\n')) return text.trim();

    const lines = text.split('\n');
    const result: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const nextLine = i < lines.length - 1 ? lines[i + 1]?.trim() : '';

      result.push(line);

      if (i === lines.length - 1) continue;

      // Keep sign-off lines together (short line ending with comma + name below)
      const isSignOff = line.length < 40 && line.endsWith(',') && nextLine.length < 40;
      // Keep empty lines as-is
      if (line.length === 0 || nextLine.length === 0) continue;

      if (!isSignOff) {
        result.push(''); // Add blank line between paragraphs
      }
    }

    return result.join('\n').trim();
  };

  // Replace all variables in a string (issue + prospect variables)
  const replaceVars = (text: string, issueText?: string): string => {
    let result = text;
    // Replace issue variables
    if (issueText) {
      result = result.replace(/\{issue\d*\}/g, issueText);
    }
    // Replace prospect variables
    for (const [placeholder, value] of Object.entries(prospectVars)) {
      result = result.split(placeholder).join(value);
    }
    return result;
  };

  // Apply variable replacements client-side
  const email = useMemo(() => {
    if (!rawEmail) return null;
    const issueText = selectedIssue ? getDescription(selectedIssue) : undefined;
    return {
      ...rawEmail,
      subject: replaceVars(rawEmail.subject, issueText),
      body: replaceVars(rawEmail.body, issueText),
    };
  }, [rawEmail, selectedIssue, customDescriptions, prospectVars]);

  // Initialize editable fields from saved custom values or template once loaded
  // Apply replaceVars so any saved {first_name} etc. get resolved on open
  useEffect(() => {
    if (email && !hasInitializedFromTemplate) {
      setEditSubject(replaceVars(prospect.custom_email_subject || email.subject));
      setEditBody(replaceVars(prospect.custom_email_body || email.body));
      setHasInitializedFromTemplate(true);
    }
  }, [email, hasInitializedFromTemplate]);

  // Available issues: prospect's detected issues, or all if none
  const availableIssues = prospect.website_issues && prospect.website_issues.length > 0
    ? prospect.website_issues
    : Object.keys(DEFAULT_ISSUE_DESCRIPTIONS);

  // Check if the template contains {issue} or {issue1} etc
  const hasIssuePlaceholder = rawEmail
    ? /\{issue\d*\}/.test(rawEmail.subject) || /\{issue\d*\}/.test(rawEmail.body)
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

  // Tag issue on prospect
  const tagIssueMutation = useMutation({
    mutationFn: (issueKey: string) => {
      const currentIssues = prospect.website_issues || [];
      const updatedIssues = currentIssues.includes(issueKey)
        ? currentIssues
        : [...currentIssues, issueKey];
      return coldOutreachApi.updateProspect(prospect.id, { website_issues: updatedIssues });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
    },
  });

  // Advance / mark sent mutation
  const advanceMutation = useMutation({
    mutationFn: () =>
      campaignId
        ? coldOutreachApi.advanceProspect(campaignId, prospect.id)
        : coldOutreachApi.markSent(prospect.id),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['mt-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
      onClose();
    },
    onError: () => {
      toast.error('Failed to advance prospect');
    },
  });

  // Save custom subject/body per prospect
  const saveCustomEmailMutation = useMutation({
    mutationFn: (data: { custom_email_subject?: string; custom_email_body?: string }) =>
      coldOutreachApi.updateProspect(prospect.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['mt-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
    },
  });

  const handleSubjectBlur = () => {
    if (editSubject !== (prospect.custom_email_subject || email?.subject || '')) {
      saveCustomEmailMutation.mutate({ custom_email_subject: editSubject });
    }
  };

  const handleBodyBlur = () => {
    if (editBody !== (prospect.custom_email_body || email?.body || '')) {
      saveCustomEmailMutation.mutate({ custom_email_body: editBody });
    }
  };

  const handleLoomScriptBlur = () => {
    const saved = (prospect.custom_fields as any)?.loom_script || '';
    if (editLoomScript !== saved) {
      const updatedFields = { ...(prospect.custom_fields || {}), loom_script: editLoomScript };
      saveCustomEmailMutation.mutate({ custom_fields: updatedFields } as any);
    }
  };

  // Save any unsaved custom edits before closing
  const handleClose = () => {
    const updates: any = {};
    if (email) {
      const subjectChanged = editSubject !== (prospect.custom_email_subject || email.subject || '');
      const bodyChanged = editBody !== (prospect.custom_email_body || email.body || '');
      if (subjectChanged) updates.custom_email_subject = editSubject;
      if (bodyChanged) updates.custom_email_body = editBody;
    }
    const savedLoom = (prospect.custom_fields as any)?.loom_script || '';
    if (editLoomScript !== savedLoom) {
      updates.custom_fields = { ...(prospect.custom_fields || {}), loom_script: editLoomScript };
    }
    if (Object.keys(updates).length > 0) {
      saveCustomEmailMutation.mutate(updates);
    }
    onClose();
  };

  const handleResetToTemplate = () => {
    if (!email) return;
    setEditSubject(email.subject);
    setEditBody(email.body);
    setAiFollowUpUsed(false);
    // Clear saved custom values
    saveCustomEmailMutation.mutate({ custom_email_subject: '', custom_email_body: '' });
    toast.success('Reset to template');
  };

  const handleCopy = async (field: 'to' | 'subject' | 'body', value: string) => {
    try {
      await navigator.clipboard.writeText(replaceVars(value));
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
      toast.success(`${field.charAt(0).toUpperCase() + field.slice(1)} copied!`);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const [isSending, setIsSending] = useState(false);

  const handleSendAndAdvance = async () => {
    if (!email) return;
    if (!prospect.email) {
      toast.error('Prospect has no email address');
      return;
    }

    setIsSending(true);
    try {
      const finalSubject = replaceVars(editSubject);
      const finalBody = replaceVars(editBody);

      // Save custom values before sending
      const wasEdited = editSubject !== email.subject || editBody !== email.body;
      if (wasEdited) {
        await coldOutreachApi.updateProspect(prospect.id, {
          custom_email_subject: editSubject,
          custom_email_body: editBody,
        });
      }

      // Send via Gmail API
      await autoresearchApi.sendEmail(prospect.id, finalSubject, finalBody);
      toast.success(`Email sent to ${prospect.email}`);

      // Track the exact email content for autoresearch learning
      try {
        await autoresearchApi.trackEmail(
          prospect.id,
          prospect.current_step || 1,
          finalSubject,
          finalBody,
          wasEdited,
        );
      } catch {
        // Non-fatal
      }

      // Advance to next step
      advanceMutation.mutate();
    } catch (err: any) {
      const msg = err?.response?.data?.detail || err?.message || 'Failed to send email';
      toast.error(msg);
    } finally {
      setIsSending(false);
    }
  };

  if (!isOpen) return null;

  const isCustomized = email && (editSubject !== email.subject || editBody !== email.body);

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

  const editableFieldClasses = cn(
    'w-full px-4 py-2.5 rounded-lg',
    'bg-stone-800/50 border border-stone-600/40',
    'text-[--exec-text] text-sm',
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
                  {aiFollowUpUsed && (
                    <span className="text-xs text-purple-400 px-2 py-0.5 bg-purple-900/30 border border-purple-800 rounded-full flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      AI Follow-up
                    </span>
                  )}
                  {canGenerateFollowUp && !aiFollowUpUsed && (
                    <button
                      onClick={handleGenerateFollowUp}
                      disabled={isGeneratingFollowUp}
                      className="text-xs text-purple-400 px-2 py-0.5 bg-purple-900/30 border border-purple-800 rounded-full flex items-center gap-1 hover:bg-purple-900/50 transition-colors disabled:opacity-50"
                    >
                      {isGeneratingFollowUp ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          Generate AI Follow-up
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Template Selector */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                Template
              </label>
              {isCustomized && (
                <button
                  onClick={handleResetToTemplate}
                  className="flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  title="Reset subject and body to template"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to template
                </button>
              )}
            </div>
            <div className="relative">
              <select
                value={selectedTemplate}
                onChange={(e) => {
                  setSelectedTemplate(e.target.value);
                  setHasInitializedFromTemplate(false);
                }}
                className={cn(
                  'w-full px-4 py-2.5 rounded-lg appearance-none',
                  'bg-stone-800/50 border border-stone-600/40',
                  'text-[--exec-text] text-sm',
                  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                  'transition-all cursor-pointer'
                )}
              >
                {hasStepTemplates
                  ? multiTouchSteps.map((step) => (
                      <option key={step.step_number} value={String(step.step_number)}>
                        Step {step.step_number} — {step.channel_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                        {String(step.step_number) === defaultType ? ' (Current)' : ''}
                        {step.template_subject ? ` · ${step.template_subject.slice(0, 40)}` : ''}
                      </option>
                    ))
                  : EMAIL_TEMPLATES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}{t.value === defaultType ? ' (Current Step)' : ''}
                      </option>
                    ))
                }
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
                        onClick={() => {
                          setSelectedIssue(isSelected ? null : issue);
                          if (!isSelected) {
                            tagIssueMutation.mutate(issue);
                          }
                        }}
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

          {/* Loom Script (per-prospect, always visible) */}
          <div className="mb-4 bg-rose-950/30 rounded-xl p-4 border border-rose-800/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4 text-rose-400" />
                <label className="text-xs font-medium text-rose-400 uppercase tracking-wider">
                  Loom Script
                </label>
              </div>
              <CopyButton field="body" value={editLoomScript} />
            </div>
            <textarea
              value={editLoomScript}
              onChange={(e) => setEditLoomScript(e.target.value)}
              onBlur={handleLoomScriptBlur}
              className={cn(editableFieldClasses, 'resize-none leading-relaxed bg-rose-950/20 border-rose-800/30 focus:ring-rose-500/20 focus:border-rose-500/50')}
              rows={4}
              placeholder="Write your Loom script here, or click Generate AI Follow-up to auto-generate one..."
            />
          </div>

          {/* Content */}
          {(isLoading || (isGeneratingFollowUp && !aiFollowUpUsed)) ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Loader2 className="w-8 h-8 text-[--exec-accent] animate-spin" />
              {isGeneratingFollowUp && (
                <p className="text-sm text-[--exec-text-muted]">
                  Generating AI follow-up...
                </p>
              )}
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
              {/* To Field (read-only) */}
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

              {/* Subject Field (editable) */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Subject
                  </label>
                  <CopyButton field="subject" value={editSubject} />
                </div>
                <input
                  type="text"
                  value={editSubject}
                  onChange={(e) => setEditSubject(replaceVars(e.target.value))}
                  onBlur={handleSubjectBlur}
                  className={editableFieldClasses}
                  placeholder="Email subject..."
                />
              </div>

              {/* Body Field (editable) */}
              <div className="bg-[--exec-surface-alt] rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
                    Body
                  </label>
                  <CopyButton field="body" value={editBody} />
                </div>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(replaceVars(e.target.value))}
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = e.clipboardData.getData('text/plain');
                    const formatted = replaceVars(formatEmailBody(pasted));
                    const ta = e.currentTarget;
                    const before = editBody.slice(0, ta.selectionStart);
                    const after = editBody.slice(ta.selectionEnd);
                    setEditBody(before + formatted + after);
                  }}
                  onBlur={handleBodyBlur}
                  className={cn(editableFieldClasses, 'resize-none leading-relaxed')}
                  rows={10}
                  placeholder="Email body..."
                />
              </div>

              {saveCustomEmailMutation.isPending && (
                <p className="text-[10px] text-[--exec-text-muted]">Saving...</p>
              )}
            </div>
          ) : null}

          {/* Footer */}
          {(() => {
            // Check if current step is an email step
            const currentStep = multiTouchSteps?.find(s => s.step_number === (prospect.current_step || 1));
            const isEmailStep = !currentStep || ['EMAIL', 'FOLLOW_UP_EMAIL', 'LOOM_EMAIL', 'email', 'follow_up_email', 'loom_email'].includes(currentStep.channel_type);

            return (
          <div className="flex gap-3 justify-end pt-6 border-t border-stone-700/30 mt-6">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
            >
              Cancel
            </button>
            {isEmailStep ? (
            <button
              onClick={handleSendAndAdvance}
              disabled={!email || !prospect.email || isSending || advanceMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg',
                'bg-green-600 hover:bg-green-700',
                'shadow-sm hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {isSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : advanceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Advancing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Send & Next Step
                </>
              )}
            </button>
            ) : (
            <button
              onClick={() => advanceMutation.mutate()}
              disabled={advanceMutation.isPending}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg',
                'bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
                'shadow-sm hover:shadow-md transition-all',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {advanceMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Advancing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Mark Done & Next Step
                </>
              )}
            </button>
            )}
          </div>
            );
          })()}
        </div>
      </div>
    </div>,
    document.body
  );
}
