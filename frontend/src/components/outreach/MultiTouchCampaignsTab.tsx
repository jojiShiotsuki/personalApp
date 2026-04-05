import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
// Fallback channel support for LinkedIn steps
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi, autoresearchApi } from '@/lib/api';
import type {
  OutreachCampaign,
  CampaignWithStats,
  OutreachProspect,
  MultiTouchStep,
  ProspectCreate,
} from '@/types';
import { ProspectStatus, CampaignType, StepChannelType, ConditionType, CONDITION_LABELS } from '@/types';
import {
  Layers,
  Plus,
  Upload,
  Send,
  MessageSquare,
  Users,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  ArrowUpDown,
  Edit2,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  X,
  AlertTriangle,
  Linkedin,
  Heart,
  UserPlus,
  UserCheck,
  Mail,
  Reply,
  XCircle,
  Search,
  Video,
  GitBranch,
  GripVertical,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import NewCampaignModal from '@/components/NewCampaignModal';
import CopyEmailModal from '@/components/CopyEmailModal';
import ProspectStatusBadge from '@/components/outreach/ProspectStatusBadge';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import CampaignKeywordTracker from './CampaignKeywordTracker';
import { BulkGenerateBar } from './BulkGenerateBar';
import { BulkGenerateModal } from './BulkGenerateModal';
import { WEBSITE_ISSUE_LABELS } from '@/lib/outreachConstants';

// Channel type colors for step indicators and badges
const CHANNEL_COLORS: Record<StepChannelType, { bg: string; text: string; dot: string; borderTop: string }> = {
  [StepChannelType.EMAIL]: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400', borderTop: 'border-t-blue-400' },
  [StepChannelType.LINKEDIN_CONNECT]: { bg: 'bg-sky-500/20', text: 'text-sky-400', dot: 'bg-sky-400', borderTop: 'border-t-sky-400' },
  [StepChannelType.LINKEDIN_MESSAGE]: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: 'bg-indigo-400', borderTop: 'border-t-indigo-400' },
  [StepChannelType.LINKEDIN_ENGAGE]: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400', borderTop: 'border-t-amber-400' },
  [StepChannelType.FOLLOW_UP_EMAIL]: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-400', borderTop: 'border-t-purple-400' },
  [StepChannelType.LOOM_EMAIL]: { bg: 'bg-rose-500/20', text: 'text-rose-400', dot: 'bg-rose-400', borderTop: 'border-t-rose-400' },
};

const CHANNEL_LABELS: Record<StepChannelType, string> = {
  [StepChannelType.EMAIL]: 'Email',
  [StepChannelType.LINKEDIN_CONNECT]: 'LI Connect',
  [StepChannelType.LINKEDIN_MESSAGE]: 'LI Message',
  [StepChannelType.LINKEDIN_ENGAGE]: 'LI Engage',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'Follow-up',
  [StepChannelType.LOOM_EMAIL]: 'Loom Email',
};

const CHANNEL_ICONS: Record<StepChannelType, typeof Mail> = {
  [StepChannelType.EMAIL]: Mail,
  [StepChannelType.LINKEDIN_CONNECT]: UserPlus,
  [StepChannelType.LINKEDIN_MESSAGE]: MessageSquare,
  [StepChannelType.LINKEDIN_ENGAGE]: Heart,
  [StepChannelType.FOLLOW_UP_EMAIL]: Reply,
  [StepChannelType.LOOM_EMAIL]: Video,
};

// Helpers
function formatShortDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Prospect links helper
function ProspectLinks({ prospect }: { prospect: OutreachProspect }) {
  const btnClass = cn(
    'inline-flex items-center justify-center w-7 h-7 rounded-md transition-colors',
    'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
  );
  return (
    <div className="flex items-center gap-1">
      {prospect.linkedin_url && (
        <a
          href={prospect.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          draggable="false"
          className={cn(btnClass, 'hover:text-blue-400')}
          title="LinkedIn"
        >
          <Linkedin className="w-3.5 h-3.5" />
        </a>
      )}
      {prospect.website && (
        <a
          href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
          target="_blank"
          rel="noopener noreferrer"
          draggable="false"
          className={btnClass}
          title="Website"
        >
          <Globe className="w-3.5 h-3.5" />
        </a>
      )}
      <a
        href={`https://www.google.com/maps/search/${encodeURIComponent(prospect.agency_name)}`}
        target="_blank"
        rel="noopener noreferrer"
        draggable="false"
        className={btnClass}
        title="Google Maps"
      >
        <MapPin className="w-3.5 h-3.5" />
      </a>
    </div>
  );
}

// Status labels for the dropdown
const STATUS_OPTIONS: { value: ProspectStatus; label: string }[] = [
  { value: ProspectStatus.QUEUED, label: 'Queued' },
  { value: ProspectStatus.IN_SEQUENCE, label: 'In Sequence' },
  { value: ProspectStatus.PENDING_CONNECTION, label: 'Pending Connection' },
  { value: ProspectStatus.PENDING_ENGAGEMENT, label: 'Pending Engagement' },
  { value: ProspectStatus.REPLIED, label: 'Replied' },
  { value: ProspectStatus.CONVERTED, label: 'Converted' },
  { value: ProspectStatus.NOT_INTERESTED, label: 'Not Interested' },
  { value: ProspectStatus.SKIPPED, label: 'Skipped' },
];

// Edit Prospect Modal
function EditProspectModal({
  prospect,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isSaving,
  campaignSteps,
}: {
  prospect: OutreachProspect;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<OutreachProspect>) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
  campaignSteps: MultiTouchStep[];
}) {
  const [form, setForm] = useState({
    agency_name: prospect.agency_name,
    contact_name: prospect.contact_name || '',
    email: prospect.email || '',
    website: prospect.website || '',
    niche: prospect.niche || '',
    notes: prospect.notes || '',
    linkedin_url: prospect.linkedin_url || '',
    website_issues: prospect.website_issues || [] as string[],
    status: prospect.status,
    current_step: prospect.current_step,
    next_action_date: prospect.next_action_date || '',
  });

  if (!isOpen) return null;

  const toggleIssue = (issueKey: string) => {
    setForm((prev) => ({
      ...prev,
      website_issues: prev.website_issues.includes(issueKey)
        ? prev.website_issues.filter((i) => i !== issueKey)
        : [...prev.website_issues, issueKey],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      agency_name: form.agency_name,
      contact_name: form.contact_name || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      niche: form.niche || undefined,
      notes: form.notes || undefined,
      linkedin_url: form.linkedin_url || undefined,
      website_issues: form.website_issues,
      status: form.status,
      current_step: form.current_step,
      next_action_date: form.next_action_date || undefined,
    } as Partial<OutreachProspect>);
  };

  const inputClasses = cn(
    'w-full px-4 py-2.5 rounded-lg',
    'bg-stone-800/50 border border-stone-600/40',
    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
    'transition-all text-sm'
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Edit Prospect</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Update multi-touch prospect details</p>
            </div>
            <button onClick={onClose} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Agency / Company Name <span className="text-red-400">*</span>
              </label>
              <input type="text" required value={form.agency_name} onChange={(e) => setForm({ ...form, agency_name: e.target.value })} className={inputClasses} autoFocus />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Contact Name</label>
                <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputClasses} placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClasses} placeholder="Optional" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                <Linkedin className="w-3.5 h-3.5 inline mr-1" />
                LinkedIn Profile URL
              </label>
              <input type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className={inputClasses} placeholder="https://linkedin.com/in/..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Website</label>
                <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClasses} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Niche</label>
                <input type="text" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} className={inputClasses} placeholder="Roofing, Plumbing, etc." />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={cn(inputClasses, 'resize-none')} rows={3} placeholder="Any context or notes..." />
            </div>

            {/* Pipeline Position */}
            <div className="pt-4 border-t border-stone-700/30">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
                <Layers className="w-4 h-4 mr-2 text-purple-400" />
                Pipeline Position
              </h3>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as ProspectStatus })}
                    className={cn(inputClasses, 'cursor-pointer appearance-none')}
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Current Step</label>
                  <select
                    value={form.current_step}
                    onChange={(e) => setForm({ ...form, current_step: Number(e.target.value) })}
                    className={cn(inputClasses, 'cursor-pointer appearance-none')}
                  >
                    {campaignSteps.length > 0
                      ? campaignSteps.map((step) => (
                          <option key={step.step_number} value={step.step_number}>
                            Step {step.step_number}: {CHANNEL_LABELS[step.channel_type as StepChannelType] || step.channel_type}
                          </option>
                        ))
                      : Array.from({ length: 7 }, (_, i) => (
                          <option key={i + 1} value={i + 1}>Step {i + 1}</option>
                        ))
                    }
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Next Action Date</label>
                <input
                  type="date"
                  value={form.next_action_date}
                  onChange={(e) => setForm({ ...form, next_action_date: e.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>

            {/* Website Issues */}
            <div className="pt-4 border-t border-stone-700/30">
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-2">
                <AlertTriangle className="w-3.5 h-3.5 inline mr-1.5 text-amber-400" />
                Website Issues
              </label>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(WEBSITE_ISSUE_LABELS).map(([key, info]) => {
                  const isActive = form.website_issues.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleIssue(key)}
                      className={cn(
                        'px-2.5 py-1 text-xs font-medium rounded-lg border transition-all duration-150',
                        isActive
                          ? info.color
                          : 'text-stone-500 bg-stone-800/30 border-stone-700/40 hover:border-stone-500/50 hover:text-stone-400'
                      )}
                    >
                      {info.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={() => { if (confirm('Delete this prospect? This cannot be undone.')) onDelete(prospect.id); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors">Cancel</button>
                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Add Prospect Modal
function AddProspectModal({
  isOpen,
  onClose,
  onSave,
  isSaving,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: ProspectCreate) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    agency_name: '',
    contact_name: '',
    email: '',
    website: '',
    niche: '',
    linkedin_url: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      agency_name: form.agency_name,
      contact_name: form.contact_name || undefined,
      email: form.email || undefined,
      website: form.website || undefined,
      niche: form.niche || undefined,
      linkedin_url: form.linkedin_url || undefined,
    });
  };

  const inputClasses = cn(
    'w-full px-4 py-2.5 rounded-lg',
    'bg-stone-800/50 border border-stone-600/40',
    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
    'transition-all text-sm'
  );

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Add Prospect</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Add a prospect to this multi-touch campaign</p>
            </div>
            <button onClick={onClose} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Agency / Company Name <span className="text-red-400">*</span>
              </label>
              <input type="text" required value={form.agency_name} onChange={(e) => setForm({ ...form, agency_name: e.target.value })} className={inputClasses} autoFocus placeholder="e.g. Smith's Plumbing" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Contact Name</label>
                <input type="text" value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} className={inputClasses} placeholder="John Smith" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClasses} placeholder="john@example.com" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                <Linkedin className="w-3.5 h-3.5 inline mr-1" />
                LinkedIn Profile URL
              </label>
              <input type="url" value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} className={inputClasses} placeholder="https://linkedin.com/in/..." />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Website</label>
                <input type="url" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} className={inputClasses} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Niche</label>
                <input type="text" value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} className={inputClasses} placeholder="Roofing, Plumbing, etc." />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {isSaving ? 'Adding...' : 'Add Prospect'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

// Check if a date string is today or in the past
// Check if a date string is today or in the past
function isDueToday(dateStr?: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return d <= today;
}

// Drag data shape for prospect drag-and-drop
interface ProspectDragData {
  prospectId: number;
  campaignId: number;
  currentStatus: ProspectStatus;
  currentStep: number;
  agencyName: string;
}

// Prospect card for pipeline view
function PipelineProspectCard({
  prospect,
  onEdit,
  onViewMessage,
  onMarkResponse,
  onMarkConnected,
  isMuted,
  isHighlighted,
  experiment,
  isDragging,
  onDragStart,
  onDragEnd,
  isSelected,
  onToggleSelect,
}: {
  prospect: OutreachProspect;
  onEdit: (prospect: OutreachProspect) => void;
  onViewMessage: (prospect: OutreachProspect) => void;
  onMarkResponse: (prospect: OutreachProspect) => void;
  onMarkConnected?: (prospect: OutreachProspect) => void;
  isMuted?: boolean;
  isHighlighted?: boolean;
  experiment?: any;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent, prospect: OutreachProspect) => void;
  onDragEnd?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const dueToday = isDueToday(prospect.next_action_date);
  const hasCustomMessage = !!(prospect.custom_email_subject || prospect.custom_email_body);
  const [linkedinReplyProspect, setLinkedinReplyProspect] = useState<OutreachProspect | null>(null);
  const [linkedinConvoText, setLinkedinConvoText] = useState('');
  const [linkedinSaving, setLinkedinSaving] = useState(false);
  const [loomWatched, setLoomWatched] = useState(experiment?.loom_watched === true);
  const [linkedinReplied, setLinkedinReplied] = useState(experiment?.replied === true);

  // Update when experiment prop changes
  useEffect(() => {
    setLoomWatched(experiment?.loom_watched === true);
    setLinkedinReplied(experiment?.replied === true);
  }, [experiment]);

  const latestExp = experiment;

  // Scroll into view when highlighted
  useEffect(() => {
    if (isHighlighted && cardRef.current) {
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }, 300);
    }
  }, [isHighlighted]);

  return (
    <div
      ref={cardRef}
      draggable={!isMuted}
      onDragStart={(e) => onDragStart?.(e, prospect)}
      onDragEnd={() => onDragEnd?.()}
      onClick={(e) => {
        if (onToggleSelect && (e.ctrlKey || e.metaKey || e.shiftKey)) {
          e.preventDefault();
          e.stopPropagation();
          onToggleSelect();
        }
      }}
      className={cn(
        'bento-card relative p-4 transition-all duration-200 group select-none',
        !isMuted && 'cursor-grab active:cursor-grabbing',
        isMuted
          ? 'opacity-50 hover:opacity-75'
          : dueToday
            ? 'border-[--exec-accent]/40 shadow-[0_0_10px_rgba(var(--exec-accent-rgb,59,130,246),0.12)] hover:shadow-[0_0_16px_rgba(var(--exec-accent-rgb,59,130,246),0.2)]'
            : 'hover:shadow-lg hover:-translate-y-0.5',
        isHighlighted && 'ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse',
        isDragging && 'opacity-50 scale-95 ring-2 ring-blue-500/40',
        isSelected && 'ring-2 ring-[#E07A5F] border-[#E07A5F]/40'
      )}
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-[#E07A5F] flex items-center justify-center z-10">
          <Check className="w-3 h-3 text-white" />
        </div>
      )}
      {/* Drag handle + Action buttons row */}
      <div className="flex items-center justify-center gap-1 mb-2 flex-wrap">
        {!isMuted && (
          <GripVertical className="w-3 h-3 text-[--exec-text-muted] opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
        )}
        {dueToday && !isMuted && (
          <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-[--exec-accent]/20 text-[--exec-accent] tracking-wide">
            Today
          </span>
        )}
        <div className="flex items-center gap-0.5">
          {prospect.email && (
            <button
              onClick={() => onViewMessage(prospect)}
              className="p-1.5 text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-500/15 rounded-md transition-colors"
              title="View email"
            >
              <Mail className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMuted && onMarkConnected && (
            <button
              onClick={() => onMarkConnected(prospect)}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                prospect.linkedin_connected
                  ? 'text-emerald-400 bg-emerald-500/15'
                  : 'text-[--exec-text-muted] hover:text-emerald-400 hover:bg-emerald-500/15'
              )}
              title={prospect.linkedin_connected ? 'LinkedIn connected (click to undo)' : 'Mark LinkedIn accepted'}
            >
              <UserCheck className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMuted && (
            <button
              onClick={() => onMarkResponse(prospect)}
              className="p-1.5 text-[--exec-text-muted] hover:text-green-400 hover:bg-green-500/15 rounded-md transition-colors"
              title="Mark response"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMuted && prospect.status !== ProspectStatus.CONVERTED && (
            <button
              onClick={async (e) => {
                e.stopPropagation();
                try {
                  const { nurtureApi } = await import('@/lib/api');
                  await nurtureApi.createFromProspect(prospect.id, {});
                  toast.success('Moved to Warm Leads');
                  queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
                  queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
                  queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
                  queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
                } catch (err: unknown) {
                  const axiosErr = err as { response?: { status?: number } };
                  if (axiosErr.response?.status === 409) {
                    toast.info('Already in Warm Leads');
                  } else {
                    toast.error('Failed to move to warm leads');
                  }
                }
              }}
              className="p-1.5 text-[--exec-text-muted] hover:text-pink-400 hover:bg-pink-500/15 rounded-md transition-colors"
              title="Move to Warm Leads"
            >
              <Heart className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMuted && (
            <button
              onClick={async () => {
                try {
                  let exp = latestExp;
                  // If not in cache, fetch on-demand
                  if (!exp) {
                    const fetched = await autoresearchApi.listExperiments({ prospect_id: prospect.id, page: 1, page_size: 1 });
                    exp = fetched.experiments?.[0];
                  }
                  if (!exp) {
                    toast.error('No experiment found — approve an audit first');
                    return;
                  }

                  const newWatched = !loomWatched;
                  const result = await autoresearchApi.updateLoomStatus(exp.id, {
                    loom_sent: true,
                    loom_watched: newWatched,
                  });
                  setLoomWatched(newWatched);
                  if (result.prospect_moved_to === 'linkedin_followup') {
                    toast.success(`Loom watched! Moved ${prospect.agency_name} to LinkedIn Follow-up — reach out today`);
                    queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
                  } else if (result.prospect_moved_to === 'in_sequence') {
                    toast.success(`Loom watched! Moved ${prospect.agency_name} back into sequence — send follow-up email today`);
                    queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
                  } else {
                    toast.success(newWatched ? 'Loom marked as watched' : 'Loom unmarked as watched');
                  }
                } catch {
                  toast.error('Failed to update Loom status');
                }
              }}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                loomWatched
                  ? 'text-purple-400 bg-purple-500/15'
                  : 'text-[--exec-text-muted] hover:text-purple-400 hover:bg-purple-500/15'
              )}
              title={loomWatched ? 'Loom watched (click to undo)' : 'Mark Loom as watched'}
            >
              <Video className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMuted && (
            <button
              onClick={() => setLinkedinReplyProspect(prospect)}
              className={cn(
                'p-1.5 rounded-md transition-colors',
                linkedinReplied
                  ? 'text-sky-400 bg-sky-500/15'
                  : 'text-[--exec-text-muted] hover:text-sky-400 hover:bg-sky-500/15'
              )}
              title={linkedinReplied ? 'LinkedIn replied (click to update)' : 'Log LinkedIn reply'}
            >
              <Linkedin className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(prospect)}
            className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-md transition-colors"
            title="Edit prospect"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Company name */}
      <h4 className="text-sm font-semibold text-[--exec-text] line-clamp-2 leading-tight mb-1">
        {prospect.agency_name}
      </h4>

      {/* Contact name */}
      {prospect.contact_name && (
        <p className="text-xs text-[--exec-text-muted] truncate mb-2">{prospect.contact_name}</p>
      )}

      {/* Status badge + custom message indicator */}
      <div className="flex items-center gap-2 mb-2">
        <ProspectStatusBadge status={prospect.status} />
        {hasCustomMessage ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">
            <Mail className="w-2.5 h-2.5" />
            Audited
          </span>
        ) : prospect.email ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-stone-700/40 text-stone-500 border border-stone-600/30">
            <Mail className="w-2.5 h-2.5" />
            No msg
          </span>
        ) : null}
      </div>

      {/* Step outcome indicator */}
      {prospect.step_outcome === 'FALLBACK_USED' && prospect.current_step_detail && (
        <div className="flex items-center gap-1.5 text-[11px] text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded-md mb-2">
          <GitBranch className="w-3 h-3" />
          <span>Condition met → {CHANNEL_LABELS[prospect.current_step_detail.fallback_channel_type as StepChannelType] || 'alternate'}</span>
        </div>
      )}
      {prospect.step_outcome === 'SKIPPED' && (
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 bg-slate-700/30 px-2 py-0.5 rounded-md mb-2">
          <span>Auto-skipped (condition not met)</span>
        </div>
      )}

      {/* LinkedIn follow-up indicator */}
      {prospect.status === 'LINKEDIN_FOLLOWUP' && (
        <div className="flex items-center gap-1.5 text-[11px] text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded-md mb-2">
          <Linkedin className="w-3 h-3" />
          <span>LinkedIn follow-up {prospect.linkedin_followup_count || 0}/5</span>
        </div>
      )}

      {/* Next action date */}
      {prospect.next_action_date && (
        <div className={cn(
          'flex items-center gap-1.5 text-xs mb-2',
          dueToday
            ? 'text-amber-400 font-semibold bg-amber-500/15 border border-amber-500/25 rounded-md px-2 py-1'
            : 'text-[--exec-text-muted]'
        )}>
          <Calendar className={cn('w-3.5 h-3.5', dueToday && 'text-amber-400')} />
          {dueToday ? 'Due today' : `Next ${formatShortDate(prospect.next_action_date)}`}
        </div>
      )}

      {/* Links */}
      <div className="pt-2 border-t border-[--exec-border-subtle]">
        <ProspectLinks prospect={prospect} />
      </div>

      {/* LinkedIn Reply Modal */}
      {linkedinReplyProspect && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setLinkedinReplyProspect(null)}>
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 p-6" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-[--exec-text]">
                Log LinkedIn Reply — {linkedinReplyProspect.agency_name}
              </h3>
              <button onClick={() => setLinkedinReplyProspect(null)} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-stone-700/50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea
              value={linkedinConvoText}
              onChange={e => setLinkedinConvoText(e.target.value)}
              placeholder="Paste the LinkedIn conversation here (optional)..."
              rows={6}
              className="w-full px-3 py-2 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-[--exec-text-muted] focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500/50 transition-all text-sm resize-none mb-4"
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setLinkedinReplyProspect(null)}
                className="px-3 py-2 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={linkedinSaving}
                onClick={async () => {
                  setLinkedinSaving(true);
                  try {
                    const exps = await autoresearchApi.listExperiments({ campaign_id: linkedinReplyProspect.campaign_id, prospect_id: linkedinReplyProspect.id, page: 1, page_size: 10 });
                    const exp = exps.experiments?.[0];
                    if (!exp) {
                      toast.error('No experiment found for this prospect');
                      return;
                    }
                    await autoresearchApi.updateLinkedInReply(exp.id, {
                      replied: true,
                      full_reply_text: linkedinConvoText || undefined,
                    });
                    toast.success('LinkedIn reply recorded');
                    setLinkedinReplied(true);
                    setLinkedinReplyProspect(null);
                    setLinkedinConvoText('');
                  } catch {
                    toast.error('Failed to save LinkedIn reply');
                  } finally {
                    setLinkedinSaving(false);
                  }
                }}
                className="px-3 py-2 text-xs font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 transition-colors disabled:opacity-50"
              >
                {linkedinSaving ? 'Saving...' : 'Save Reply'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Outcome column configuration
const OUTCOME_COLUMNS = [
  {
    key: 'replied' as const,
    label: 'Replied',
    status: ProspectStatus.REPLIED,
    icon: MessageSquare,
    bg: 'bg-green-500/15',
    border: 'border-green-500/30',
    text: 'text-green-400',
    dot: 'bg-green-400',
    headerBg: 'bg-green-500/10',
    borderTop: 'border-t-green-500',
    badgeBg: 'bg-green-500/20',
  },
  {
    key: 'converted' as const,
    label: 'Converted',
    status: ProspectStatus.CONVERTED,
    icon: CheckCircle,
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
    headerBg: 'bg-purple-500/10',
    borderTop: 'border-t-purple-500',
    badgeBg: 'bg-purple-500/20',
  },
  {
    key: 'not_interested' as const,
    label: 'Not Interested',
    status: ProspectStatus.NOT_INTERESTED,
    icon: XCircle,
    bg: 'bg-red-500/15',
    border: 'border-red-500/30',
    text: 'text-red-400',
    dot: 'bg-red-400',
    headerBg: 'bg-red-500/10',
    borderTop: 'border-t-red-500',
    badgeBg: 'bg-red-500/20',
  },
];

// Sort options for pipeline columns
type SortOption = 'date_asc' | 'date_desc' | 'name_asc' | 'name_desc' | 'date_added_new' | 'date_added_old' | 'custom_first' | 'custom_last';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'date_asc', label: 'Next action (soonest)' },
  { value: 'date_desc', label: 'Next action (latest)' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'name_desc', label: 'Name (Z–A)' },
  { value: 'date_added_new', label: 'Date added (newest)' },
  { value: 'date_added_old', label: 'Date added (oldest)' },
  { value: 'custom_first', label: 'Custom message first' },
  { value: 'custom_last', label: 'No message first' },
];

function sortProspects(list: OutreachProspect[], sort: SortOption): OutreachProspect[] {
  const sorted = [...list];
  switch (sort) {
    case 'date_asc':
    case 'date_desc': {
      const dir = sort === 'date_asc' ? 1 : -1;
      return sorted.sort((a, b) => {
        if (!a.next_action_date && !b.next_action_date) return 0;
        if (!a.next_action_date) return 1;
        if (!b.next_action_date) return -1;
        return dir * a.next_action_date.localeCompare(b.next_action_date);
      });
    }
    case 'name_asc':
      return sorted.sort((a, b) =>
        a.agency_name.localeCompare(b.agency_name, undefined, { sensitivity: 'base' })
      );
    case 'name_desc':
      return sorted.sort((a, b) =>
        b.agency_name.localeCompare(a.agency_name, undefined, { sensitivity: 'base' })
      );
    case 'date_added_new':
      return sorted.sort((a, b) =>
        (b.created_at || '').localeCompare(a.created_at || '')
      );
    case 'date_added_old':
      return sorted.sort((a, b) =>
        (a.created_at || '').localeCompare(b.created_at || '')
      );
    case 'custom_first':
    case 'custom_last': {
      const dir = sort === 'custom_first' ? -1 : 1;
      return sorted.sort((a, b) => {
        const aCustom = !!(a.custom_email_subject || a.custom_email_body);
        const bCustom = !!(b.custom_email_subject || b.custom_email_body);
        if (aCustom === bCustom) return 0;
        return aCustom ? dir : -dir;
      });
    }
    default:
      return sorted;
  }
}

// Pipeline / Kanban view for All Prospects
function SequencePipelineView({
  prospects,
  campaignSteps,
  onEdit,
  onViewMessage,
  onMarkResponse,
  onMarkConnected,
  highlightProspectId,
  selectedProspectIds,
  onToggleProspectSelection,
}: {
  prospects: OutreachProspect[];
  campaignSteps: MultiTouchStep[];
  onEdit: (prospect: OutreachProspect) => void;
  onViewMessage: (prospect: OutreachProspect) => void;
  onMarkResponse: (prospect: OutreachProspect) => void;
  onMarkConnected: (prospect: OutreachProspect) => void;
  highlightProspectId?: number;
  selectedProspectIds?: Set<number>;
  onToggleProspectSelection?: (id: number) => void;
}) {
  const [showSkipped, setShowSkipped] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date_asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStep, setEditingStep] = useState<{ stepNumber: number; channelType: string } | null>(null);
  const [editStepChannel, setEditStepChannel] = useState('');
  const [editStepFallback, setEditStepFallback] = useState('');
  const [editConditionType, setEditConditionType] = useState<ConditionType | undefined>(undefined);
  const [editConditionStepRef, setEditConditionStepRef] = useState<number | undefined>(undefined);
  const [editFallbackSubject, setEditFallbackSubject] = useState('');
  const [editFallbackContent, setEditFallbackContent] = useState('');
  const [editFallbackInstruction, setEditFallbackInstruction] = useState('');
  const [savingStep, setSavingStep] = useState(false);
  const queryClient = useQueryClient();

  // Drag-and-drop state
  const [draggedProspectId, setDraggedProspectId] = useState<number | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const moveProspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OutreachProspect> }) =>
      coldOutreachApi.updateProspect(id, data),
    onMutate: async (variables) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['mt-prospects'] });

      // Snapshot previous data
      const previousProspects = queryClient.getQueryData(['mt-prospects']);

      // Optimistically update the cache
      queryClient.setQueriesData<OutreachProspect[]>(
        { queryKey: ['mt-prospects'] },
        (old) => old?.map((p) =>
          p.id === variables.id ? { ...p, ...variables.data } : p
        ),
      );

      // Build destination label for toast
      const prospect = prospects.find((p) => p.id === variables.id);
      const name = prospect?.agency_name || 'Prospect';
      const status = variables.data.status;
      const step = variables.data.current_step;
      let destination = '';
      if (status === ProspectStatus.IN_SEQUENCE && step != null) {
        destination = `Step ${step}`;
      } else if (status === ProspectStatus.REPLIED) {
        destination = 'Replied';
      } else if (status === ProspectStatus.CONVERTED) {
        destination = 'Converted';
      } else if (status === ProspectStatus.NOT_INTERESTED) {
        destination = 'Not Interested';
      } else if (status === ProspectStatus.LINKEDIN_FOLLOWUP) {
        destination = 'LinkedIn Follow-up';
      }
      toast.success(`Moved ${name} to ${destination}`);

      return { previousProspects };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousProspects) {
        queryClient.setQueriesData(
          { queryKey: ['mt-prospects'] },
          context.previousProspects,
        );
      }
      toast.error('Failed to move prospect');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
      queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
    },
  });

  const handleDragStart = (e: React.DragEvent, prospect: OutreachProspect) => {
    const dragData: ProspectDragData = {
      prospectId: prospect.id,
      campaignId: prospect.campaign_id,
      currentStatus: prospect.status,
      currentStep: prospect.current_step,
      agencyName: prospect.agency_name,
    };
    e.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedProspectId(prospect.id);
  };

  const handleDragEnd = () => {
    setDraggedProspectId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnKey) {
      setDragOverColumn(columnKey);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if actually leaving the column (not entering a child)
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverColumn(null);
    }
  };

  const handleDropOnStep = (e: React.DragEvent, stepNumber: number) => {
    e.preventDefault();
    setDragOverColumn(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const dragData: ProspectDragData = JSON.parse(raw);
      // If already in this step with IN_SEQUENCE status, do nothing
      if (
        dragData.currentStep === stepNumber &&
        (dragData.currentStatus === ProspectStatus.IN_SEQUENCE ||
         dragData.currentStatus === ProspectStatus.QUEUED ||
         dragData.currentStatus === ProspectStatus.PENDING_CONNECTION ||
         dragData.currentStatus === ProspectStatus.PENDING_ENGAGEMENT)
      ) {
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      moveProspectMutation.mutate({
        id: dragData.prospectId,
        data: {
          status: ProspectStatus.IN_SEQUENCE,
          current_step: stepNumber,
          next_action_date: today,
        } as Partial<OutreachProspect>,
      });
    } catch {
      toast.error('Drop failed — try dragging from the card body, not a link');
    }
  };

  const handleDropOnOutcome = (e: React.DragEvent, status: ProspectStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const dragData: ProspectDragData = JSON.parse(raw);
      // If already in this status, do nothing
      if (dragData.currentStatus === status) {
        return;
      }
      const updateData: Record<string, unknown> = { status };
      if (status === ProspectStatus.NOT_INTERESTED || status === ProspectStatus.CONVERTED) {
        updateData.next_action_date = null;
      }
      moveProspectMutation.mutate({
        id: dragData.prospectId,
        data: updateData,
      });
    } catch {
      toast.error('Drop failed — try dragging from the card body, not a link');
    }
  };

  const handleDropOnLinkedinFollowup = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverColumn(null);
    const raw = e.dataTransfer.getData('text/plain');
    if (!raw) return;
    try {
      const dragData: ProspectDragData = JSON.parse(raw);
      if (dragData.currentStatus === ProspectStatus.LINKEDIN_FOLLOWUP) {
        return;
      }
      const today = new Date().toISOString().split('T')[0];
      moveProspectMutation.mutate({
        id: dragData.prospectId,
        data: {
          status: ProspectStatus.LINKEDIN_FOLLOWUP,
          next_action_date: today,
        } as Partial<OutreachProspect>,
      });
    } catch {
      toast.error('Drop failed — try dragging from the card body, not a link');
    }
  };

  // Fetch ALL experiments for this campaign once (not per card)
  // Fetch up to 500 to cover all prospects
  const campaignId = prospects[0]?.campaign_id;
  const { data: allExpsData } = useQuery({
    queryKey: ['campaign-experiments-status', campaignId],
    queryFn: async () => {
      if (!campaignId) return { experiments: [], total_count: 0 };
      // Fetch page 1
      const page1 = await autoresearchApi.listExperiments({ campaign_id: campaignId, page: 1, page_size: 200 });
      if (page1.total_count <= 200) return page1;
      // Fetch page 2 if needed
      const page2 = await autoresearchApi.listExperiments({ campaign_id: campaignId, page: 2, page_size: 200 });
      return {
        experiments: [...page1.experiments, ...page2.experiments],
        total_count: page1.total_count,
        page: 1,
        page_size: page1.total_count,
      };
    },
    enabled: !!campaignId,
    staleTime: 30000,
  });
  // Build a map: prospect_id -> latest experiment
  const experimentMap = new Map<number, any>();
  if (allExpsData?.experiments) {
    for (const exp of allExpsData.experiments) {
      const existing = experimentMap.get(exp.prospect_id);
      if (!existing || exp.step_number > existing.step_number) {
        experimentMap.set(exp.prospect_id, exp);
      }
    }
  }

  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Users className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No prospects yet</h3>
        <p className="text-[--exec-text-muted]">Import a CSV or add prospects manually.</p>
      </div>
    );
  }

  // Filter prospects by search term — matches each word independently across all fields
  const filteredProspects = searchTerm.trim().length >= 2
    ? prospects.filter((p) => {
        const searchable = [
          p.agency_name,
          p.contact_name,
          p.email,
          p.niche,
        ].filter(Boolean).join(' ').toLowerCase();
        const words = searchTerm.toLowerCase().trim().split(/\s+/);
        return words.every((word) => searchable.includes(word));
      })
    : prospects;

  // Group prospects by step (non-outcome) or by outcome status
  const stepBuckets: Record<number, OutreachProspect[]> = {};
  const outcomeBuckets: Record<string, OutreachProspect[]> = {
    replied: [],
    converted: [],
    not_interested: [],
  };
  const linkedinFollowupProspects: OutreachProspect[] = [];
  const skippedProspects: OutreachProspect[] = [];

  for (const p of filteredProspects) {
    if (p.status === ProspectStatus.SKIPPED) {
      skippedProspects.push(p);
    } else if (p.status === ProspectStatus.REPLIED) {
      outcomeBuckets.replied.push(p);
    } else if (p.status === ProspectStatus.CONVERTED) {
      outcomeBuckets.converted.push(p);
    } else if (p.status === ProspectStatus.NOT_INTERESTED) {
      outcomeBuckets.not_interested.push(p);
    } else if (p.status === ProspectStatus.LINKEDIN_FOLLOWUP) {
      linkedinFollowupProspects.push(p);
    } else {
      const step = p.current_step;
      if (!stepBuckets[step]) stepBuckets[step] = [];
      stepBuckets[step].push(p);
    }
  }

  // Build step columns: use campaignSteps if available, otherwise derive from prospect data
  let stepColumns: { stepNumber: number; channelType?: StepChannelType; label: string; fallbackChannelType?: StepChannelType; conditionType?: string }[];

  if (campaignSteps.length > 0) {
    stepColumns = campaignSteps.map((step) => ({
      stepNumber: step.step_number,
      channelType: step.channel_type as StepChannelType,
      label: CHANNEL_LABELS[step.channel_type as StepChannelType] || step.channel_type,
      fallbackChannelType: step.fallback_channel_type as StepChannelType | undefined,
      conditionType: step.condition_type,
    }));
    const definedStepNums = new Set(campaignSteps.map((s) => s.step_number));
    for (const stepNum of Object.keys(stepBuckets).map(Number).sort((a, b) => a - b)) {
      if (!definedStepNums.has(stepNum)) {
        stepColumns.push({ stepNumber: stepNum, label: `Step ${stepNum}` });
      }
    }
  } else {
    stepColumns = Object.keys(stepBuckets)
      .map(Number)
      .sort((a, b) => a - b)
      .map((stepNum) => ({ stepNumber: stepNum, label: `Step ${stepNum}` }));
  }

  return (
    <div className="space-y-4">
      {/* Search and sort controls */}
      <div className="flex items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search prospects..."
            className={cn(
              'w-full pl-9 pr-8 py-2 rounded-lg text-sm',
              'bg-stone-800/50 border border-stone-700/40',
              'text-[--exec-text] placeholder:text-[--exec-text-muted]',
              'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
              'transition-all'
            )}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort control */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-3.5 h-3.5 text-[--exec-text-muted]" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium appearance-none cursor-pointer',
              'bg-stone-800/50 border border-stone-700/40',
              'text-[--exec-text-muted] hover:text-[--exec-text]',
              'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
              'transition-all'
            )}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search result count */}
      {searchTerm.trim().length >= 2 && (
        <p className="text-xs text-[--exec-text-muted]">
          Found {filteredProspects.length} prospect{filteredProspects.length !== 1 ? 's' : ''} matching &ldquo;{searchTerm}&rdquo;
        </p>
      )}

      {/* Pipeline columns */}
      <div className="overflow-x-auto pb-4 -mx-2">
        <div className="flex gap-3 px-2">

          {/* Step columns */}
          {stepColumns.map((col) => {
            const colors = col.channelType ? CHANNEL_COLORS[col.channelType] : undefined;
            const Icon = col.channelType ? CHANNEL_ICONS[col.channelType] : undefined;
            const bucket = sortProspects(stepBuckets[col.stepNumber] || [], sortBy);

            const customCount = bucket.filter(p => !!(p.custom_email_subject || p.custom_email_body)).length;
            const noCustomCount = bucket.filter(p => p.email && !(p.custom_email_subject || p.custom_email_body)).length;

            return (
              <div
                key={col.stepNumber}
                className={cn(
                  'bg-stone-900/30 rounded-xl p-3 min-w-[220px] flex-1',
                  'border-t-2 transition-all',
                  colors?.borderTop || 'border-t-stone-500',
                  dragOverColumn === `step-${col.stepNumber}` && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
                )}
              >
                {/* Column header — click to edit step type */}
                <div
                  onClick={() => {
                    const step = campaignSteps.find(s => s.step_number === col.stepNumber);
                    setEditingStep({ stepNumber: col.stepNumber, channelType: col.channelType || '' });
                    setEditStepChannel(col.channelType || '');
                    setEditStepFallback(step?.fallback_channel_type || '');
                    setEditConditionType(step?.condition_type as ConditionType | undefined);
                    setEditConditionStepRef(step?.condition_step_ref);
                    setEditFallbackSubject(step?.fallback_template_subject || '');
                    setEditFallbackContent(step?.fallback_template_content || '');
                    setEditFallbackInstruction(step?.fallback_instruction_text || '');
                  }}
                  className="flex items-center justify-between mb-3 cursor-pointer"
                  title="Click to change step type"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', colors?.text || 'text-stone-400')} />}
                    <span className={cn('text-xs font-semibold truncate', colors?.text || 'text-stone-400')}>
                      Step {col.stepNumber}: {col.label}
                    </span>
                    {col.conditionType && (
                      <span title={`Condition: ${CONDITION_LABELS[col.conditionType as ConditionType] || col.conditionType}`}><GitBranch className="w-3 h-3 text-amber-400 flex-shrink-0" /></span>
                    )}
                  </div>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full flex-shrink-0', colors?.bg || 'bg-stone-600/30', colors?.text || 'text-stone-400')}>
                    {bucket.length}
                  </span>
                </div>
                {/* Fallback route visualization */}
                {col.fallbackChannelType && (
                  <div className="flex items-center gap-1.5 mb-2 pl-6">
                    <span className="text-[10px] text-stone-500">fallback →</span>
                    {(() => {
                      const fbColors = CHANNEL_COLORS[col.fallbackChannelType];
                      const FbIcon = CHANNEL_ICONS[col.fallbackChannelType];
                      const fbLabel = CHANNEL_LABELS[col.fallbackChannelType];
                      return (
                        <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium', fbColors?.text || 'text-stone-400')}>
                          {FbIcon && <FbIcon className="w-3 h-3" />}
                          {fbLabel}
                        </span>
                      );
                    })()}
                  </div>
                )}
                {/* Custom message counts for steps with email prospects */}
                {bucket.length > 0 && (customCount > 0 || noCustomCount > 0) && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-stone-700/30">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                      <Mail className="w-2.5 h-2.5" />
                      {customCount} custom
                    </span>
                    <span className="text-[10px] text-stone-600">|</span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-stone-500">
                      {noCustomCount} no msg
                    </span>
                  </div>
                )}

                {/* Cards — drop target */}
                <div
                  onDragOver={(e) => handleDragOver(e, `step-${col.stepNumber}`)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnStep(e, col.stepNumber)}
                  className="space-y-2 min-h-[100px] max-h-[70vh] overflow-y-auto"
                >
                  {bucket.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[100px] text-[--exec-text-muted] text-sm">
                      {dragOverColumn === `step-${col.stepNumber}` ? 'Drop here' : 'No prospects'}
                    </div>
                  ) : (
                    bucket.map((prospect) => (
                      <PipelineProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        onEdit={onEdit}
                        onViewMessage={onViewMessage}
                        onMarkResponse={onMarkResponse}
                        onMarkConnected={onMarkConnected}
                        isHighlighted={prospect.id === highlightProspectId}
                        experiment={experimentMap.get(prospect.id)}
                        isDragging={draggedProspectId === prospect.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isSelected={selectedProspectIds?.has(prospect.id)}
                        onToggleSelect={() => onToggleProspectSelection?.(prospect.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* LinkedIn Follow-up column (after sequence steps, before outcome columns) */}
          <div
            className={cn(
              'bg-stone-900/30 rounded-xl p-3 min-w-[220px] flex-1',
              'border-t-2 border-t-sky-500 transition-all',
              dragOverColumn === 'linkedin-followup' && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
            )}
          >
            {/* Column header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Linkedin className="w-4 h-4 flex-shrink-0 text-sky-400" />
                <span className="text-xs font-semibold text-sky-400">
                  LI Follow-up
                </span>
              </div>
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-sky-500/20 text-sky-400">
                {linkedinFollowupProspects.length}
              </span>
            </div>

            {/* Cards — drop target */}
            <div
              onDragOver={(e) => handleDragOver(e, 'linkedin-followup')}
              onDragLeave={handleDragLeave}
              onDrop={handleDropOnLinkedinFollowup}
              className="space-y-2 min-h-[100px] max-h-[70vh] overflow-y-auto"
            >
              {linkedinFollowupProspects.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-[100px] text-[--exec-text-muted] text-sm">
                  {dragOverColumn === 'linkedin-followup' ? 'Drop here' : 'None yet'}
                </div>
              ) : (
                sortProspects(linkedinFollowupProspects, sortBy).map((prospect) => (
                  <PipelineProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    onEdit={onEdit}
                    onViewMessage={onViewMessage}
                    onMarkResponse={onMarkResponse}
                    onMarkConnected={onMarkConnected}
                    isHighlighted={prospect.id === highlightProspectId}
                    experiment={experimentMap.get(prospect.id)}
                    isDragging={draggedProspectId === prospect.id}
                    onDragStart={handleDragStart}
                    onDragEnd={handleDragEnd}
                    isSelected={selectedProspectIds?.has(prospect.id)}
                    onToggleSelect={() => onToggleProspectSelection?.(prospect.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Outcome columns (last) */}
          {OUTCOME_COLUMNS.map((ocol) => {
            const bucket = sortProspects(outcomeBuckets[ocol.key], sortBy);
            const OutcomeIcon = ocol.icon;

            return (
              <div
                key={ocol.key}
                className={cn(
                  'bg-stone-900/30 rounded-xl p-3 min-w-[220px] flex-1',
                  'border-t-2 transition-all',
                  ocol.borderTop,
                  dragOverColumn === `outcome-${ocol.key}` && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
                )}
              >
                {/* Column header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <OutcomeIcon className={cn('w-4 h-4 flex-shrink-0', ocol.text)} />
                    <span className={cn('text-xs font-semibold', ocol.text)}>
                      {ocol.label}
                    </span>
                  </div>
                  <span className={cn('text-xs font-medium px-1.5 py-0.5 rounded-full', ocol.badgeBg, ocol.text)}>
                    {bucket.length}
                  </span>
                </div>

                {/* Cards — drop target */}
                <div
                  onDragOver={(e) => handleDragOver(e, `outcome-${ocol.key}`)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDropOnOutcome(e, ocol.status)}
                  className="space-y-2 min-h-[100px] max-h-[70vh] overflow-y-auto"
                >
                  {bucket.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[100px] text-[--exec-text-muted] text-sm">
                      {dragOverColumn === `outcome-${ocol.key}` ? 'Drop here' : 'None yet'}
                    </div>
                  ) : (
                    bucket.map((prospect) => (
                      <PipelineProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        onEdit={onEdit}
                        onViewMessage={onViewMessage}
                        onMarkResponse={onMarkResponse}
                        onMarkConnected={onMarkConnected}
                        isHighlighted={prospect.id === highlightProspectId}
                        experiment={experimentMap.get(prospect.id)}
                        isDragging={draggedProspectId === prospect.id}
                        onDragStart={handleDragStart}
                        onDragEnd={handleDragEnd}
                        isSelected={selectedProspectIds?.has(prospect.id)}
                        onToggleSelect={() => onToggleProspectSelection?.(prospect.id)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Skipped prospects section */}
      {skippedProspects.length > 0 && (
        <div className="bento-card overflow-hidden">
          <button
            onClick={() => setShowSkipped(!showSkipped)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[--exec-surface-alt] transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <ChevronRight
                className={cn(
                  'w-4 h-4 text-[--exec-text-muted] transition-transform duration-200',
                  showSkipped && 'rotate-90'
                )}
              />
              <span className="text-sm font-semibold text-[--exec-text-muted]">
                Skipped
              </span>
              <span className="text-xs bg-stone-700/60 text-[--exec-text-muted] px-2 py-0.5 rounded-full font-medium">
                {skippedProspects.length}
              </span>
            </div>
          </button>

          {showSkipped && (
            <div className="px-5 pb-5 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                {skippedProspects.map((prospect) => (
                  <PipelineProspectCard
                    key={prospect.id}
                    prospect={prospect}
                    onEdit={onEdit}
                    onViewMessage={onViewMessage}
                    onMarkResponse={onMarkResponse}
                    isMuted
                    isHighlighted={prospect.id === highlightProspectId}
                    experiment={experimentMap.get(prospect.id)}
                    isSelected={selectedProspectIds?.has(prospect.id)}
                    onToggleSelect={() => onToggleProspectSelection?.(prospect.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Step Channel Modal */}
      {editingStep && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setEditingStep(null)}>
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-md mx-4 border border-stone-600/40 p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-[--exec-text]">
                Edit Step {editingStep.stepNumber}
              </h3>
              <button onClick={() => setEditingStep(null)} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1 rounded-lg hover:bg-stone-700/50">
                <X className="w-4 h-4" />
              </button>
            </div>
            <label className="block text-[10px] font-medium text-[--exec-text-muted] mb-1.5 uppercase tracking-wider">
              Channel Type
            </label>
            <select
              value={editStepChannel}
              onChange={(e) => setEditStepChannel(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-stone-800/50 border border-stone-600/40 text-[--exec-text] text-sm focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all cursor-pointer appearance-none mb-4"
            >
              {Object.entries(CHANNEL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Condition & Fallback Section */}
            <div className="mb-4 pt-3 border-t border-stone-700/30">
              <div className="flex items-center gap-2 mb-2">
                <GitBranch className="w-3.5 h-3.5 text-[--exec-text-muted]" />
                <span className="text-[10px] font-medium text-[--exec-text-muted] uppercase tracking-wider">Condition & Fallback</span>
              </div>

              {/* Condition selector */}
              <div className="mb-2">
                <label className="block text-[10px] text-[--exec-text-muted] mb-1">If...</label>
                <select
                  value={editConditionType || ''}
                  onChange={(e) => {
                    setEditConditionType((e.target.value || undefined) as ConditionType | undefined);
                    setEditConditionStepRef(undefined);
                  }}
                  className="w-full px-3 py-1.5 rounded-lg text-sm bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all cursor-pointer appearance-none"
                >
                  <option value="">Always (no condition)</option>
                  {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              {/* Step reference selector — only for STEP_COMPLETED / STEP_SKIPPED */}
              {(editConditionType === ConditionType.STEP_COMPLETED || editConditionType === ConditionType.STEP_SKIPPED) && (
                <div className="mb-2">
                  <label className="block text-[10px] text-[--exec-text-muted] mb-1">Which step?</label>
                  <select
                    value={editConditionStepRef || ''}
                    onChange={(e) => setEditConditionStepRef(Number(e.target.value) || undefined)}
                    className="w-full px-3 py-1.5 rounded-lg text-sm bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all cursor-pointer appearance-none"
                  >
                    <option value="">Select step...</option>
                    {campaignSteps
                      .filter(s => s.step_number < editingStep.stepNumber)
                      .map(s => (
                        <option key={s.step_number} value={s.step_number}>Step {s.step_number}</option>
                      ))}
                  </select>
                </div>
              )}

              {/* Fallback section — visible when condition is set */}
              {editConditionType && (
                <div className="mt-2 p-2.5 bg-stone-800/30 rounded-lg border border-stone-700/30">
                  <label className="block text-[10px] text-[--exec-text-muted] mb-1">Then:</label>
                  <select
                    value={editStepFallback || 'skip'}
                    onChange={(e) => setEditStepFallback(e.target.value === 'skip' ? '' : e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 bg-stone-800/50 border border-stone-600/40 text-[--exec-text] focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all cursor-pointer appearance-none"
                  >
                    <option value="skip">Just run this step (skip if not met)</option>
                    {Object.values(StepChannelType).map((ch) => (
                      <option key={ch} value={ch}>{ch.replace(/_/g, ' ')}</option>
                    ))}
                  </select>

                  {/* Fallback content fields — only when a fallback channel is selected */}
                  {editStepFallback && (
                    <>
                      {['EMAIL', 'FOLLOW_UP_EMAIL', 'LOOM_EMAIL'].includes(editStepFallback) && (
                        <input
                          type="text"
                          value={editFallbackSubject}
                          onChange={(e) => setEditFallbackSubject(e.target.value)}
                          placeholder="Fallback subject line..."
                          className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all"
                        />
                      )}
                      <textarea
                        value={editFallbackContent}
                        onChange={(e) => setEditFallbackContent(e.target.value)}
                        placeholder="Fallback content/template..."
                        rows={2}
                        className="w-full px-3 py-1.5 rounded-lg text-sm mb-2 resize-none bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all"
                      />
                      <input
                        type="text"
                        value={editFallbackInstruction}
                        onChange={(e) => setEditFallbackInstruction(e.target.value)}
                        placeholder="Fallback instruction..."
                        className="w-full px-3 py-1.5 rounded-lg text-sm bg-stone-800/50 border border-stone-600/40 text-[--exec-text] placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50 transition-all"
                      />
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setEditingStep(null)}
                className="px-3 py-2 text-xs font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={savingStep}
                onClick={async () => {
                  setSavingStep(true);
                  try {
                    const updatedSteps = campaignSteps.map(s => {
                      const isEdited = s.step_number === editingStep.stepNumber;
                      const channelType = isEdited ? editStepChannel : s.channel_type;
                      return {
                        step_number: s.step_number,
                        channel_type: channelType as StepChannelType,
                        delay_days: s.delay_days,
                        template_subject: s.template_subject || undefined,
                        template_content: s.template_content || undefined,
                        instruction_text: s.instruction_text || undefined,
                        fallback_channel_type: (isEdited
                          ? (editStepFallback || undefined)
                          : s.fallback_channel_type) as StepChannelType | undefined,
                        loom_script: s.loom_script || undefined,
                        condition_type: isEdited ? editConditionType : s.condition_type as ConditionType | undefined,
                        condition_step_ref: isEdited ? editConditionStepRef : s.condition_step_ref,
                        fallback_template_subject: isEdited ? (editFallbackSubject || undefined) : s.fallback_template_subject || undefined,
                        fallback_template_content: isEdited ? (editFallbackContent || undefined) : s.fallback_template_content || undefined,
                        fallback_instruction_text: isEdited ? (editFallbackInstruction || undefined) : s.fallback_instruction_text || undefined,
                      };
                    });
                    await coldOutreachApi.updateCampaignSteps(prospects[0]?.campaign_id, updatedSteps);
                    queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
                    queryClient.invalidateQueries({ queryKey: ['mt-steps'] });
                    toast.success(`Step ${editingStep.stepNumber} changed to ${CHANNEL_LABELS[editStepChannel as StepChannelType] || editStepChannel}`);
                    setEditingStep(null);
                  } catch {
                    toast.error('Failed to update step');
                  } finally {
                    setSavingStep(false);
                  }
                }}
                className="px-3 py-2 text-xs font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingStep ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// Sequence Steps Panel — collapsible horizontal pipeline view
function SequenceStepsPanel({
  steps,
  onEdit,
  onDelete,
}: {
  steps: MultiTouchStep[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (steps.length === 0) return null;

  return (
    <div className="bento-card overflow-hidden mb-6">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[--exec-surface-alt] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ChevronRight
            className={cn(
              'w-4 h-4 text-[--exec-text-muted] transition-transform duration-200',
              isExpanded && 'rotate-90'
            )}
          />
          <Layers className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-semibold text-[--exec-text]">
            Sequence
          </span>
          <span className="text-xs text-[--exec-text-muted]">
            ({steps.length} step{steps.length !== 1 ? 's' : ''})
          </span>
        </div>

        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={onEdit}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              'bg-blue-500/15 text-blue-400 border border-blue-500/25',
              'hover:bg-blue-500/25 hover:border-blue-400/40'
            )}
          >
            <Edit2 className="w-3 h-3" />
            Edit Sequence
          </button>
          <button
            onClick={onDelete}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
              'bg-red-500/15 text-red-400 border border-red-500/25',
              'hover:bg-red-500/25 hover:border-red-400/40'
            )}
          >
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
        </div>
      </button>

      {/* Steps pipeline */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1">
          <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
            {steps.map((step, idx) => {
              const colors = CHANNEL_COLORS[step.channel_type as StepChannelType];
              const Icon = CHANNEL_ICONS[step.channel_type as StepChannelType];
              const label = CHANNEL_LABELS[step.channel_type as StepChannelType];
              const isLast = idx === steps.length - 1;

              return (
                <div key={step.id || step.step_number} className="flex items-stretch flex-shrink-0">
                  {/* Step card */}
                  <div
                    className={cn(
                      'flex flex-col gap-1.5 px-4 py-3 rounded-xl border min-w-[150px] max-w-[180px]',
                      'bg-stone-800/40 border-stone-700/40',
                      'hover:bg-stone-800/60 hover:border-stone-600/50 transition-all duration-200'
                    )}
                  >
                    {/* Step number + channel */}
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold',
                          colors?.bg || 'bg-stone-600/30',
                          colors?.text || 'text-stone-400'
                        )}
                      >
                        {step.step_number}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {Icon && <Icon className={cn('w-3.5 h-3.5', colors?.text || 'text-stone-400')} />}
                        <span className={cn('text-xs font-semibold', colors?.text || 'text-stone-400')}>
                          {label || step.channel_type}
                        </span>
                      </div>
                    </div>

                    {/* Delay info */}
                    <span className="text-[10px] text-[--exec-text-muted]">
                      {step.step_number === 1 && step.delay_days === 0
                        ? 'starts immediately'
                        : step.delay_days === 0
                          ? 'no delay'
                          : `wait ${step.delay_days}d after prev`}
                    </span>

                    {/* Condition badges */}
                    {step.condition_type && (
                      <div className="flex items-center gap-1 mt-1">
                        <GitBranch className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-amber-400 font-medium">
                          If {CONDITION_LABELS[step.condition_type as ConditionType] || step.condition_type}
                          {step.condition_step_ref ? ` #${step.condition_step_ref}` : ''}
                        </span>
                      </div>
                    )}
                    {step.condition_type && (
                      <span className="text-[10px] text-slate-500">
                        {step.fallback_channel_type
                          ? `→ ${CHANNEL_LABELS[step.fallback_channel_type as StepChannelType] || step.fallback_channel_type}`
                          : '→ Skip if not met'}
                      </span>
                    )}

                    {/* Instruction text */}
                    {step.instruction_text && (
                      <p className="text-[10px] text-[--exec-text-muted] line-clamp-2 leading-tight mt-0.5">
                        {step.instruction_text}
                      </p>
                    )}
                  </div>

                  {/* Arrow connector */}
                  {!isLast && (
                    <div className="flex items-center px-1.5 flex-shrink-0">
                      <ArrowRight className="w-4 h-4 text-stone-600" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const ACTIONABLE_STATUSES = ['QUEUED', 'IN_SEQUENCE', 'PENDING_ENGAGEMENT', 'LINKEDIN_FOLLOWUP'];

// Main component
export default function MultiTouchCampaignsTab({ initialCampaignId, initialProspectId }: { initialCampaignId?: number | null; initialProspectId?: number }) {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(initialCampaignId ?? null);
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);

  // Sync from parent when initialCampaignId changes (e.g. global search click)
  useEffect(() => {
    if (initialCampaignId != null) setSelectedCampaignId(initialCampaignId);
  }, [initialCampaignId]);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [editingProspect, setEditingProspect] = useState<OutreachProspect | null>(null);
  const [isAddProspectOpen, setIsAddProspectOpen] = useState(false);
  const [emailModalProspect, setEmailModalProspect] = useState<OutreachProspect | null>(null);
  const [responseModalProspect, setResponseModalProspect] = useState<OutreachProspect | null>(null);
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<number>>(new Set());
  const [isBulkGenerating, setIsBulkGenerating] = useState(false);
  const [bulkResults, setBulkResults] = useState<Awaited<ReturnType<typeof autoresearchApi.bulkGenerateFollowups>> | null>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkTotalCount, setBulkTotalCount] = useState(0);

  // Clear prospect selection when switching campaigns
  useEffect(() => {
    setSelectedProspectIds(new Set());
  }, [selectedCampaignId]);

  const queryClient = useQueryClient();

  // Queries
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['multi-touch-campaigns'],
    queryFn: () => coldOutreachApi.getCampaigns('MULTI_TOUCH'),
  });

  const { data: campaignWithStats } = useQuery<CampaignWithStats>({
    queryKey: ['mt-campaign', selectedCampaignId],
    queryFn: () => coldOutreachApi.getCampaign(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const { data: allProspects = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['mt-prospects', selectedCampaignId],
    queryFn: () => coldOutreachApi.getProspects(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  // Highlight + scroll to prospect when navigating from global search
  const [highlightProspectId, setHighlightProspectId] = useState<number | undefined>(undefined);
  const didAutoOpen = useRef(false);
  useEffect(() => {
    if (initialProspectId && !didAutoOpen.current) {
      const prospect = allProspects.find((p) => p.id === initialProspectId);
      if (prospect) {
        setHighlightProspectId(initialProspectId);
        didAutoOpen.current = true;
        // Clear highlight after 4 seconds
        setTimeout(() => setHighlightProspectId(undefined), 4000);
      }
    }
  }, [initialProspectId, allProspects]); // eslint-disable-line react-hooks/exhaustive-deps

  // Mutations
  const deleteCampaignMutation = useMutation({
    mutationFn: (campaignId: number) => coldOutreachApi.deleteCampaign(campaignId),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
      if (selectedCampaignId === deleteCampaignMutation.variables) {
        setSelectedCampaignId(null);
      }
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error(`Failed to delete campaign: ${msg}`);
    },
  });

  const updateProspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OutreachProspect> }) =>
      coldOutreachApi.updateProspect(id, data),
    onSuccess: () => {
      toast.success('Prospect updated');
      invalidateAll();
      setEditingProspect(null);
    },
    onError: () => toast.error('Failed to update prospect'),
  });

  const deleteProspectMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.deleteProspect(prospectId),
    onSuccess: () => {
      toast.success('Prospect deleted');
      invalidateAll();
      setEditingProspect(null);
    },
    onError: () => toast.error('Failed to delete prospect'),
  });

  const createProspectMutation = useMutation({
    mutationFn: (data: ProspectCreate) => coldOutreachApi.createProspect(selectedCampaignId!, data),
    onSuccess: () => {
      toast.success('Prospect added to campaign');
      invalidateAll();
      setIsAddProspectOpen(false);
    },
    onError: () => toast.error('Failed to add prospect'),
  });

  const markConnectedMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.markMtConnected(selectedCampaignId!, prospectId),
    onSuccess: (data) => {
      toast.success(data.message || 'Marked as connected');
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark as connected'),
  });

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
    queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
    queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
  }

  const toggleProspectSelection = (prospectId: number) => {
    setSelectedProspectIds(prev => {
      const next = new Set(prev);
      if (next.has(prospectId)) {
        next.delete(prospectId);
      } else {
        next.add(prospectId);
      }
      return next;
    });
  };

  const selectAllActionable = () => {
    const actionable = (allProspects || [])
      .filter(p => ACTIONABLE_STATUSES.includes(p.status))
      .map(p => p.id);
    const allSelected = actionable.every(id => selectedProspectIds.has(id));
    if (allSelected) {
      setSelectedProspectIds(new Set());
    } else {
      setSelectedProspectIds(new Set(actionable));
    }
  };

  const handleBulkGenerate = async () => {
    setBulkTotalCount(selectedProspectIds.size);
    setIsBulkGenerating(true);
    setBulkResults(null);
    setBulkError(null);
    setShowBulkModal(true);
    try {
      const result = await autoresearchApi.bulkGenerateFollowups(
        Array.from(selectedProspectIds)
      );
      setBulkResults(result);
      setSelectedProspectIds(new Set());
      invalidateAll();
    } catch (err: unknown) {
      setBulkError(err instanceof Error ? err.message : 'Bulk generation failed');
    } finally {
      setIsBulkGenerating(false);
    }
  };

  const closeBulkModal = () => {
    setShowBulkModal(false);
    setBulkResults(null);
    setBulkError(null);
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const handleDeleteCampaign = (e: React.MouseEvent, campaignId: number) => {
    e.stopPropagation();
    e.preventDefault();
    setConfirmDeleteId(campaignId);
  };

  const handleEditCampaign = (e: React.MouseEvent, campaign: OutreachCampaign) => {
    e.stopPropagation();
    setEditingCampaign(campaign);
    setIsCampaignDropdownOpen(false);
  };

  // Auto-select first campaign
  if (campaigns.length > 0 && !selectedCampaignId) {
    setSelectedCampaignId(campaigns[0].id);
  }

  const stats = campaignWithStats?.stats;
  const campaignSteps = campaignWithStats?.multi_touch_steps || [];

  return (
    <>
      {/* Controls Bar */}
      <div className="px-8 py-4 flex items-center justify-between relative z-20">
        {/* Campaign selector */}
        <div className="relative">
          <button
            onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)}
            onBlur={() => setTimeout(() => setIsCampaignDropdownOpen(false), 150)}
            className={cn(
              'flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-xl min-w-[200px]',
              'bg-[--exec-surface] border border-[--exec-border]',
              'text-[--exec-text] text-sm font-medium',
              'hover:bg-[--exec-surface-alt] hover:border-[--exec-accent]',
              'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
              'transition-all duration-200'
            )}
          >
            <Layers className="w-4 h-4 text-purple-400" />
            <span className="flex-1 text-left truncate">
              {selectedCampaignId
                ? campaigns.find((c) => c.id === selectedCampaignId)?.name || 'Select Campaign'
                : 'Select Campaign'}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-[--exec-text-muted] transition-transform duration-200', isCampaignDropdownOpen && 'rotate-180')} />
          </button>

          {isCampaignDropdownOpen && (
            <div
              className="absolute top-full left-0 mt-2 w-full min-w-[280px] py-2 rounded-xl border border-[--exec-border] shadow-2xl z-[100]"
              style={{ backgroundColor: '#1C1917' }}
            >
              {campaigns.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[--exec-text-muted]">No multi-touch campaigns yet</div>
              ) : (
                campaigns.map((campaign) => (
                  <div
                    key={campaign.id}
                    className={cn(
                      'flex items-center justify-between px-3 py-2 mx-2 rounded-lg',
                      'hover:bg-[--exec-surface-alt] transition-colors',
                      selectedCampaignId === campaign.id && 'bg-[--exec-accent]/15'
                    )}
                  >
                    <button
                      onClick={() => {
                        setSelectedCampaignId(campaign.id);
                        setIsCampaignDropdownOpen(false);
                      }}
                      className={cn(
                        'flex-1 text-left text-sm',
                        selectedCampaignId === campaign.id ? 'text-[--exec-accent] font-medium' : 'text-[--exec-text]'
                      )}
                    >
                      {campaign.name}
                    </button>
                    <div className="flex items-center gap-1 ml-3">
                      <button
                        onClick={(e) => handleEditCampaign(e, campaign)}
                        className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white hover:scale-110 transition-all duration-200"
                        title="Edit campaign"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => handleDeleteCampaign(e, campaign.id)}
                        className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:scale-110 transition-all duration-200"
                        title="Delete campaign"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Quick edit/delete buttons (visible next to selector when campaign selected) */}
        {selectedCampaignId && (() => {
          const selectedCampaign = campaigns.find((c) => c.id === selectedCampaignId);
          return selectedCampaign ? (
            <div className="flex items-center gap-1.5 ml-2">
              <button
                onClick={(e) => handleEditCampaign(e, selectedCampaign)}
                className="p-2 rounded-lg text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-500/15 transition-all duration-200"
                title="Edit campaign"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleDeleteCampaign(e, selectedCampaign.id)}
                className="p-2 rounded-lg text-[--exec-text-muted] hover:text-red-400 hover:bg-red-500/15 transition-all duration-200"
                title="Delete campaign"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : null;
        })()}

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewCampaignOpen(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'text-white hover:brightness-110 hover:scale-105 hover:shadow-lg',
              'active:scale-95 transition-all duration-200 shadow-sm font-medium text-sm'
            )}
            style={{ backgroundColor: 'var(--exec-accent)' }}
          >
            <Plus className="w-4 h-4" />
            New
          </button>

          <button
            onClick={() => {
              if (!selectedCampaignId) {
                toast.error('Please select a campaign first');
                return;
              }
              setIsAddProspectOpen(true);
            }}
            disabled={!selectedCampaignId}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'bg-slate-600/50 text-slate-300 border border-slate-500/30',
              'transition-all duration-200 font-medium text-sm',
              selectedCampaignId
                ? 'hover:bg-slate-500 hover:text-white hover:border-slate-400 hover:scale-105 active:scale-95'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            <UserPlus className="w-4 h-4" />
            Add Lead
          </button>

          <button
            onClick={() => {
              if (!selectedCampaignId) {
                toast.error('Please select a campaign first');
                return;
              }
              setIsImportOpen(true);
            }}
            disabled={!selectedCampaignId}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'bg-slate-600/50 text-slate-300 border border-slate-500/30',
              'transition-all duration-200 font-medium text-sm',
              selectedCampaignId
                ? 'hover:bg-slate-500 hover:text-white hover:border-slate-400 hover:scale-105 active:scale-95'
                : 'opacity-50 cursor-not-allowed'
            )}
          >
            <Upload className="w-4 h-4" />
            Import CSV
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-4 relative z-10">
        {/* Stats Bar */}
        {selectedCampaignId && stats && (
          <div className="grid grid-cols-5 gap-4 mb-6">
            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                  <Layers className="w-5 h-5 text-[--exec-accent]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.to_contact_today}</p>
                  <p className="text-xs text-[--exec-text-muted]">To Do Today</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.in_sequence}</p>
                  <p className="text-xs text-[--exec-text-muted]">In Sequence</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">
                    {stats.replied}{' '}
                    <span className="text-sm font-normal text-[--exec-text-muted]">({stats.response_rate.toFixed(1)}%)</span>
                  </p>
                  <p className="text-xs text-[--exec-text-muted]">Replied</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.converted}</p>
                  <p className="text-xs text-[--exec-text-muted]">Converted</p>
                  {stats.total_pipeline_value > 0 && (
                    <p className="text-xs font-medium text-green-400 mt-0.5">
                      ${stats.total_pipeline_value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} pipeline
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <Heart className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.pending_engagement}</p>
                  <p className="text-xs text-[--exec-text-muted]">Pending Engagement</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search Keyword Tracker */}
        {selectedCampaignId && (
          <CampaignKeywordTracker campaignId={selectedCampaignId} />
        )}

        {/* Sequence Steps Panel */}
        {selectedCampaignId && campaignSteps.length > 0 && (
          <SequenceStepsPanel
            steps={campaignSteps}
            onEdit={() => {
              const campaign = campaigns.find((c) => c.id === selectedCampaignId);
              if (campaign) {
                setEditingCampaign(campaign);
              }
            }}
            onDelete={() => setConfirmDeleteId(selectedCampaignId)}
          />
        )}

        {/* Bulk selection controls */}
        {selectedCampaignId && allProspects.length > 0 && (
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={selectAllActionable}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                selectedProspectIds.size > 0
                  ? "bg-[#E07A5F]/15 text-[#E07A5F] border border-[#E07A5F]/30 hover:bg-[#E07A5F]/25"
                  : "text-[--exec-text-muted] border border-stone-700/40 hover:border-stone-600/60 hover:text-[--exec-text-secondary]"
              )}
            >
              {selectedProspectIds.size > 0 ? (
                <>
                  <div className="w-4 h-4 rounded-full bg-[#E07A5F] flex items-center justify-center">
                    <Check className="w-2.5 h-2.5 text-white" />
                  </div>
                  {selectedProspectIds.size} selected — click to clear
                </>
              ) : (
                'Select all actionable'
              )}
            </button>
            <span className="text-[10px] text-[--exec-text-muted]">
              Ctrl+click cards to select individually
            </span>
          </div>
        )}

        {/* Pipeline View */}
        {selectedCampaignId ? (
          <SequencePipelineView
            prospects={allProspects}
            campaignSteps={campaignSteps}
            onEdit={setEditingProspect}
            onViewMessage={setEmailModalProspect}
            onMarkResponse={setResponseModalProspect}
            onMarkConnected={(prospect) => markConnectedMutation.mutate(prospect.id)}
            highlightProspectId={highlightProspectId}
            selectedProspectIds={selectedProspectIds}
            onToggleProspectSelection={toggleProspectSelection}
          />
        ) : (
          <div className="bento-card p-12 text-center">
            <Layers className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[--exec-text] mb-2">Select a multi-touch campaign to get started</h3>
            <p className="text-[--exec-text-muted] mb-4">Choose an existing campaign or create a new one.</p>
            <button
              onClick={() => setIsNewCampaignOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white',
                'hover:brightness-110 hover:scale-105 hover:shadow-lg active:scale-95 transition-all duration-200',
                'shadow-sm font-medium text-sm'
              )}
              style={{ backgroundColor: 'var(--exec-accent)' }}
            >
              <Plus className="w-4 h-4" />
              Create Multi-Touch Campaign
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen || !!editingCampaign}
        onClose={() => {
          setIsNewCampaignOpen(false);
          setEditingCampaign(null);
        }}
        onCreated={(id) => setSelectedCampaignId(id)}
        editCampaign={editingCampaign}
        defaultCampaignType={CampaignType.MULTI_TOUCH}
      />

      {selectedCampaignId && (
        <CsvImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          campaignId={selectedCampaignId}
        />
      )}

      {editingProspect && (
        <EditProspectModal
          prospect={editingProspect}
          isOpen={true}
          onClose={() => setEditingProspect(null)}
          onSave={(data) => updateProspectMutation.mutate({ id: editingProspect.id, data })}
          onDelete={(id) => deleteProspectMutation.mutate(id)}
          isSaving={updateProspectMutation.isPending}
          campaignSteps={campaignSteps}
        />
      )}

      <AddProspectModal
        isOpen={isAddProspectOpen}
        onClose={() => setIsAddProspectOpen(false)}
        onSave={(data) => createProspectMutation.mutate(data)}
        isSaving={createProspectMutation.isPending}
      />

      {emailModalProspect && (
        <CopyEmailModal
          isOpen={!!emailModalProspect}
          onClose={() => setEmailModalProspect(null)}
          prospect={emailModalProspect}
          campaignId={selectedCampaignId ?? undefined}
          multiTouchSteps={campaignSteps}
        />
      )}

      {responseModalProspect && (
        <ResponseOutcomeModal
          isOpen={!!responseModalProspect}
          onClose={() => setResponseModalProspect(null)}
          prospect={responseModalProspect}
        />
      )}

      <BulkGenerateBar
        selectedCount={selectedProspectIds.size}
        onGenerate={handleBulkGenerate}
        onClear={() => setSelectedProspectIds(new Set())}
        isGenerating={isBulkGenerating}
      />

      <BulkGenerateModal
        isOpen={showBulkModal}
        onClose={closeBulkModal}
        isGenerating={isBulkGenerating}
        totalCount={bulkTotalCount}
        results={bulkResults}
        error={bulkError}
      />

      {/* Delete Campaign Confirmation */}
      {confirmDeleteId && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setConfirmDeleteId(null)}>
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-sm mx-4 border border-stone-600/40 p-6 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-[--exec-text] mb-2">Delete Campaign</h3>
            <p className="text-sm text-[--exec-text-muted] mb-6">This will permanently delete the campaign and all its prospects. This cannot be undone.</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCampaignMutation.mutate(confirmDeleteId);
                  setConfirmDeleteId(null);
                  setIsCampaignDropdownOpen(false);
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
