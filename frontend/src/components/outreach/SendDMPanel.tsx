import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Copy, Check, Send, Mail, Linkedin, Phone, Video, MapPin, Globe, Briefcase, ChevronDown, Settings2 } from 'lucide-react';
import { outreachApi, dailyOutreachApi, contactApi } from '@/lib/api';
import type { OutreachNiche, OutreachSituation, OutreachTemplate, TemplateType } from '@/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ManageTemplatesModal from '@/components/ManageTemplatesModal';

// Source data interface - works for both leads and contacts
export interface SendDMSource {
  type: 'lead' | 'contact';
  id: number;
  name: string;           // contact_name (lead) or name (contact)
  company: string;        // agency_name (lead) or company (contact)
  city?: string;          // location (lead) or city (contact)
  niche?: string;         // niche (lead) or industry (contact)
  website?: string;       // website (lead) or website_url (contact)
  websiteIssues?: string[]; // null (lead) or parsed website_issues (contact)
  email?: string;
  emailStage?: string;
  linkedinStage?: string;
  linkedinUrl?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}

interface SendDMPanelProps {
  isOpen: boolean;
  onClose: () => void;
  source: SendDMSource | null;
  onSuccess?: () => void;
}

type ActivityType = 'cold_email' | 'linkedin' | 'call' | 'loom';

const activityOptions: { value: ActivityType; label: string; icon: React.ReactNode }[] = [
  { value: 'cold_email', label: 'Cold Email', icon: <Mail className="w-4 h-4" /> },
  { value: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" /> },
  { value: 'call', label: 'Call', icon: <Phone className="w-4 h-4" /> },
  { value: 'loom', label: 'Loom Audit', icon: <Video className="w-4 h-4" /> },
];

// Template type categories for the panel
const TEMPLATE_CATEGORIES = [
  {
    group: 'Email',
    icon: Mail,
    types: [
      { value: 'email_1' as TemplateType, label: 'Email 1' },
      { value: 'email_2' as TemplateType, label: 'Email 2' },
      { value: 'email_3' as TemplateType, label: 'Email 3' },
      { value: 'email_4' as TemplateType, label: 'Email 4' },
      { value: 'email_5' as TemplateType, label: 'Email 5' },
    ],
  },
  {
    group: 'LinkedIn Outreach',
    icon: Linkedin,
    types: [
      { value: 'linkedin_direct' as TemplateType, label: 'Direct' },
      { value: 'linkedin_compliment' as TemplateType, label: 'Compliment' },
      { value: 'linkedin_mutual_interest' as TemplateType, label: 'Mutual Interest' },
    ],
  },
  {
    group: 'LinkedIn Follow-up',
    icon: Linkedin,
    types: [
      { value: 'linkedin_followup_1' as TemplateType, label: 'Follow-up 1' },
      { value: 'linkedin_followup_2' as TemplateType, label: 'Follow-up 2' },
    ],
  },
  {
    group: 'Loom',
    icon: Video,
    types: [
      { value: 'loom_video_audit' as TemplateType, label: 'Video Audit' },
    ],
  },
];

// Extract first name from full name
const getFirstName = (fullName: string): string => {
  if (!fullName) return '';
  return fullName.split(' ')[0];
};

// Expand template variables with source data
const expandVariables = (template: string, source: SendDMSource): string => {
  if (!template) return '';

  let result = template;

  // Basic replacements
  result = result.replace(/\{name\}/gi, getFirstName(source.name) || '[name]');
  result = result.replace(/\{company\}/gi, source.company || '[company]');
  result = result.replace(/\{city\}/gi, source.city || '[city]');
  result = result.replace(/\{niche\}/gi, source.niche || '[niche]');

  // Website issues (contacts only)
  const issues = source.websiteIssues || [];
  result = result.replace(/\{issue1\}/gi, issues[0] || '[specific issue]');
  result = result.replace(/\{issue2\}/gi, issues[1] || issues[0] || '[specific issue]');
  result = result.replace(/\{issue3\}/gi, issues[2] || issues[1] || issues[0] || '[specific issue]');

  return result;
};

export default function SendDMPanel({ isOpen, onClose, source, onSuccess }: SendDMPanelProps) {
  const queryClient = useQueryClient();
  const [selectedSituationId, setSelectedSituationId] = useState<number | null>(null);
  const [selectedTemplateType, setSelectedTemplateType] = useState<TemplateType>('email_1');
  const [selectedActivity, setSelectedActivity] = useState<ActivityType>('cold_email');
  const [copied, setCopied] = useState(false);
  const [isSituationDropdownOpen, setIsSituationDropdownOpen] = useState(false);
  const [isManageTemplatesOpen, setIsManageTemplatesOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  // Fetch situations
  const { data: situations = [] } = useQuery<OutreachSituation[]>({
    queryKey: ['outreach-situations'],
    queryFn: outreachApi.getSituations,
    enabled: isOpen,
  });

  // Fetch niches for matching
  const { data: niches = [] } = useQuery<OutreachNiche[]>({
    queryKey: ['outreach-niches'],
    queryFn: outreachApi.getNiches,
    enabled: isOpen,
  });

  // Fetch templates
  const { data: templates = [] } = useQuery<OutreachTemplate[]>({
    queryKey: ['outreach-templates'],
    queryFn: () => outreachApi.getTemplates(),
    enabled: isOpen,
  });

  // Find matching niche for source
  const matchingNiche = niches.find(n =>
    source?.niche?.toLowerCase().includes(n.name.toLowerCase()) ||
    n.name.toLowerCase().includes(source?.niche?.toLowerCase() || '')
  );

  // Find current template
  const currentTemplate = templates.find(
    t => t.situation_id === selectedSituationId && t.template_type === selectedTemplateType &&
      (matchingNiche ? t.niche_id === matchingNiche.id : true)
  ) || templates.find(
    t => t.situation_id === selectedSituationId && t.template_type === selectedTemplateType
  );

  // Get processed script
  const processedScript = source && currentTemplate
    ? expandVariables(currentTemplate.content, source)
    : '';

  // Log activity mutation
  const logActivityMutation = useMutation({
    mutationFn: async () => {
      // Log to daily outreach
      await dailyOutreachApi.logActivity(selectedActivity, {
        contact_id: source?.type === 'contact' ? source.id : undefined,
        notes: `DM sent to ${source?.name} @ ${source?.company}`,
      });

      // Update contact stage if it's a contact
      if (source?.type === 'contact') {
        const stageUpdate: Record<string, string> = {};
        const today = new Date().toISOString().split('T')[0];

        if (selectedActivity === 'cold_email') {
          // Advance email stage
          const stages = ['not_sent', 'email_1', 'email_2', 'email_3', 'follow_up', 'break_up'];
          const currentIndex = stages.indexOf(source.emailStage || 'not_sent');
          const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)];
          stageUpdate.email_stage = nextStage;
          stageUpdate.email_last_sent = today;
        } else if (selectedActivity === 'linkedin') {
          // Advance LinkedIn stage
          const stages = ['not_connected', 'requested', 'connected', 'message_1', 'message_2'];
          const currentIndex = stages.indexOf(source.linkedinStage || 'not_connected');
          const nextStage = stages[Math.min(currentIndex + 1, stages.length - 1)];
          stageUpdate.linkedin_stage = nextStage;
          stageUpdate.linkedin_last_action = today;
        }

        if (Object.keys(stageUpdate).length > 0) {
          await contactApi.update(source.id, stageUpdate);
        }
      }
    },
    onSuccess: () => {
      toast.success('Activity logged!');
      queryClient.invalidateQueries({ queryKey: ['daily-outreach'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      onSuccess?.();
      onClose();
    },
    onError: () => {
      toast.error('Failed to log activity');
    },
  });

  // Handle copy
  const handleCopy = async () => {
    if (!processedScript) {
      toast.error('No script to copy');
      return;
    }
    await navigator.clipboard.writeText(processedScript);
    setCopied(true);
    toast.success('Copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  // Reset state when panel opens/closes
  useEffect(() => {
    if (isOpen) {
      setCopied(false);
      // Auto-select first situation if available
      if (situations.length > 0 && !selectedSituationId) {
        setSelectedSituationId(situations[0].id);
      }
    }
  }, [isOpen, situations, selectedSituationId]);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setIsSituationDropdownOpen(false);
      setIsTypeDropdownOpen(false);
    };
    if (isSituationDropdownOpen || isTypeDropdownOpen) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [isSituationDropdownOpen, isTypeDropdownOpen]);

  if (!isOpen || !source) return null;

  const selectedSituation = situations.find(s => s.id === selectedSituationId);

  // Get display label for current template type
  const currentTypeLabel = TEMPLATE_CATEGORIES.flatMap(c => c.types).find(t => t.value === selectedTemplateType)?.label || selectedTemplateType;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 animate-in fade-in duration-200"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-[--exec-surface] border-l border-stone-600/40 shadow-2xl z-50 animate-in slide-in-from-right duration-300 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-600/40">
          <div>
            <h2 className="text-lg font-bold text-[--exec-text]">Send DM</h2>
            <p className="text-sm text-[--exec-text-muted]">
              {source.name} @ {source.company}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Contact Info Summary */}
          <div className="bg-stone-800/50 rounded-xl p-4 space-y-2">
            {source.email && (
              <div className="flex items-center gap-2 text-sm text-[--exec-text-secondary]">
                <Mail className="w-4 h-4 text-[--exec-text-muted]" />
                {source.email}
              </div>
            )}
            {source.website && (
              <div className="flex items-center gap-2 text-sm text-[--exec-text-secondary]">
                <Globe className="w-4 h-4 text-[--exec-text-muted]" />
                <a href={source.website.startsWith('http') ? source.website : `https://${source.website}`}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="hover:text-[--exec-accent] transition-colors">
                  {source.website}
                </a>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm text-[--exec-text-secondary]">
              {source.city && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-4 h-4 text-[--exec-text-muted]" />
                  {source.city}
                </div>
              )}
              {source.niche && (
                <div className="flex items-center gap-1">
                  <Briefcase className="w-4 h-4 text-[--exec-text-muted]" />
                  {source.niche}
                </div>
              )}
            </div>
            {source.websiteIssues && source.websiteIssues.length > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-600/40">
                <p className="text-xs text-[--exec-text-muted] mb-1">Website Issues:</p>
                <div className="flex flex-wrap gap-1">
                  {source.websiteIssues.map((issue, i) => (
                    <span key={i} className="text-xs bg-red-900/30 text-red-400 px-2 py-0.5 rounded">
                      {issue}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Script Type Selector */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text] mb-2">
                Script Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsSituationDropdownOpen(!isSituationDropdownOpen);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-stone-800/50 border border-stone-600/40 rounded-xl",
                    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]",
                    "transition-all duration-200 text-left cursor-pointer",
                    "flex items-center justify-between",
                    selectedSituationId ? "text-[--exec-text]" : "text-[--exec-text-muted]"
                  )}
                >
                  <span>{selectedSituation?.name || 'Select script type'}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-[--exec-text-muted] transition-transform duration-200",
                    isSituationDropdownOpen && "rotate-180"
                  )} />
                </button>
                {isSituationDropdownOpen && (
                  <div className="absolute z-50 w-full mt-2 py-1 bg-stone-800 border border-stone-600/40 rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                    {situations.map((situation) => (
                      <button
                        key={situation.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedSituationId(situation.id);
                          setIsSituationDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full px-4 py-2.5 text-left text-sm transition-colors",
                          selectedSituationId === situation.id
                            ? "bg-[--exec-accent]/20 text-[--exec-accent]"
                            : "text-stone-200 hover:bg-stone-700/50"
                        )}
                      >
                        {situation.name}
                      </button>
                    ))}
                    {situations.length === 0 && (
                      <p className="px-4 py-2.5 text-sm text-[--exec-text-muted]">
                        No script types configured
                      </p>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setIsManageTemplatesOpen(true)}
                className="mt-2 flex items-center gap-1.5 text-xs text-[--exec-text-muted] hover:text-[--exec-accent] transition-colors"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Customize templates
              </button>
            </div>

            {/* Template Type Selector */}
            <div>
              <label className="block text-sm font-medium text-[--exec-text] mb-2">
                Template Type
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsTypeDropdownOpen(!isTypeDropdownOpen);
                  }}
                  className={cn(
                    "w-full px-4 py-3 bg-stone-800/50 border border-stone-600/40 rounded-xl",
                    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]",
                    "transition-all duration-200 text-left cursor-pointer",
                    "flex items-center justify-between text-[--exec-text]"
                  )}
                >
                  <span>{currentTypeLabel}</span>
                  <ChevronDown className={cn(
                    "w-4 h-4 text-[--exec-text-muted] transition-transform duration-200",
                    isTypeDropdownOpen && "rotate-180"
                  )} />
                </button>
                {isTypeDropdownOpen && (
                  <div className="absolute z-50 w-full mt-2 py-1 bg-stone-800 border border-stone-600/40 rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                    {TEMPLATE_CATEGORIES.map((category) => (
                      <div key={category.group}>
                        <div className="px-4 py-1.5 text-xs font-semibold text-[--exec-text-muted] uppercase tracking-wider bg-stone-900/50">
                          {category.group}
                        </div>
                        {category.types.map((type) => (
                          <button
                            key={type.value}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTemplateType(type.value);
                              setIsTypeDropdownOpen(false);
                            }}
                            className={cn(
                              "w-full px-4 py-2.5 text-left text-sm transition-colors",
                              selectedTemplateType === type.value
                                ? "bg-[--exec-accent]/20 text-[--exec-accent]"
                                : "text-stone-200 hover:bg-stone-700/50"
                            )}
                          >
                            {type.label}
                          </button>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Script Preview */}
          <div>
            <label className="block text-sm font-medium text-[--exec-text] mb-2">
              Script Preview
            </label>
            <div className="bg-stone-800/50 border border-stone-600/40 rounded-xl p-4 min-h-[200px] max-h-[300px] overflow-y-auto">
              {processedScript ? (
                <p className="text-[--exec-text] whitespace-pre-wrap leading-relaxed text-sm">
                  {processedScript}
                </p>
              ) : selectedSituationId ? (
                <p className="text-[--exec-text-muted] italic text-sm">
                  No template found for this combination. Create one in Template Manager.
                </p>
              ) : (
                <p className="text-[--exec-text-muted] italic text-sm">
                  Select a script type to see the preview
                </p>
              )}
            </div>
          </div>

          {/* Activity Type Selector */}
          <div>
            <label className="block text-sm font-medium text-[--exec-text] mb-2">
              Log as Activity
            </label>
            <div className="grid grid-cols-2 gap-2">
              {activityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedActivity(option.value)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-lg border transition-all duration-200 text-sm',
                    selectedActivity === option.value
                      ? 'bg-[--exec-accent]/20 text-[--exec-accent] border-[--exec-accent]'
                      : 'bg-stone-800/50 text-[--exec-text-secondary] border-stone-600/40 hover:border-[--exec-accent]'
                  )}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-600/40 space-y-3">
          <div className="flex gap-3">
            <button
              onClick={handleCopy}
              disabled={!processedScript}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-200',
                processedScript
                  ? 'bg-stone-700 text-[--exec-text] hover:bg-stone-600'
                  : 'bg-stone-800/50 text-[--exec-text-muted] cursor-not-allowed'
              )}
            >
              {copied ? (
                <>
                  <Check className="w-5 h-5" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copy Script
                </>
              )}
            </button>
            <button
              onClick={() => logActivityMutation.mutate()}
              disabled={!processedScript || logActivityMutation.isPending}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition-all duration-200',
                processedScript
                  ? 'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark]'
                  : 'bg-stone-800/50 text-[--exec-text-muted] cursor-not-allowed'
              )}
            >
              <Send className="w-5 h-5" />
              {logActivityMutation.isPending ? 'Logging...' : 'Mark as Sent'}
            </button>
          </div>
          <p className="text-xs text-center text-[--exec-text-muted]">
            "Mark as Sent" logs to Daily Outreach and updates contact stage
          </p>
        </div>
      </div>

      {/* Manage Templates Modal */}
      <ManageTemplatesModal
        isOpen={isManageTemplatesOpen}
        onClose={() => setIsManageTemplatesOpen(false)}
      />
    </>
  );
}
