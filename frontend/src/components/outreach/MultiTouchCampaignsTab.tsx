import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type {
  OutreachCampaign,
  CampaignWithStats,
  OutreachProspect,
  MultiTouchStep,
  ProspectCreate,
} from '@/types';
import { ProspectStatus, CampaignType, StepChannelType } from '@/types';
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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import NewCampaignModal from '@/components/NewCampaignModal';
import CopyEmailModal from '@/components/CopyEmailModal';
import ProspectStatusBadge from '@/components/outreach/ProspectStatusBadge';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import CampaignKeywordTracker from './CampaignKeywordTracker';
import { WEBSITE_ISSUE_LABELS } from '@/lib/outreachConstants';

// Channel type colors for step indicators and badges
const CHANNEL_COLORS: Record<StepChannelType, { bg: string; text: string; dot: string }> = {
  [StepChannelType.EMAIL]: { bg: 'bg-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  [StepChannelType.LINKEDIN_CONNECT]: { bg: 'bg-sky-500/20', text: 'text-sky-400', dot: 'bg-sky-400' },
  [StepChannelType.LINKEDIN_MESSAGE]: { bg: 'bg-indigo-500/20', text: 'text-indigo-400', dot: 'bg-indigo-400' },
  [StepChannelType.LINKEDIN_ENGAGE]: { bg: 'bg-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  [StepChannelType.FOLLOW_UP_EMAIL]: { bg: 'bg-purple-500/20', text: 'text-purple-400', dot: 'bg-purple-400' },
};

const CHANNEL_LABELS: Record<StepChannelType, string> = {
  [StepChannelType.EMAIL]: 'Email',
  [StepChannelType.LINKEDIN_CONNECT]: 'LI Connect',
  [StepChannelType.LINKEDIN_MESSAGE]: 'LI Message',
  [StepChannelType.LINKEDIN_ENGAGE]: 'LI Engage',
  [StepChannelType.FOLLOW_UP_EMAIL]: 'Follow-up',
};

const CHANNEL_ICONS: Record<StepChannelType, typeof Mail> = {
  [StepChannelType.EMAIL]: Mail,
  [StepChannelType.LINKEDIN_CONNECT]: UserPlus,
  [StepChannelType.LINKEDIN_MESSAGE]: MessageSquare,
  [StepChannelType.LINKEDIN_ENGAGE]: Heart,
  [StepChannelType.FOLLOW_UP_EMAIL]: Reply,
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

// Prospect card for pipeline view
function PipelineProspectCard({
  prospect,
  onEdit,
  onViewMessage,
  onMarkResponse,
  onMarkConnected,
  isMuted,
  isHighlighted,
}: {
  prospect: OutreachProspect;
  onEdit: (prospect: OutreachProspect) => void;
  onViewMessage: (prospect: OutreachProspect) => void;
  onMarkResponse: (prospect: OutreachProspect) => void;
  onMarkConnected?: (prospect: OutreachProspect) => void;
  isMuted?: boolean;
  isHighlighted?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const dueToday = isDueToday(prospect.next_action_date);
  const hasCustomMessage = !!(prospect.custom_email_subject || prospect.custom_email_body);

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
      className={cn(
        'bento-card p-4 transition-all duration-200 group',
        isMuted
          ? 'opacity-50 hover:opacity-75'
          : dueToday
            ? 'border-[--exec-accent]/40 shadow-[0_0_10px_rgba(var(--exec-accent-rgb,59,130,246),0.12)] hover:shadow-[0_0_16px_rgba(var(--exec-accent-rgb,59,130,246),0.2)]'
            : 'hover:shadow-lg hover:-translate-y-0.5',
        isHighlighted && 'ring-2 ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)] animate-pulse'
      )}
    >
      {/* Header row: agency name + actions */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-semibold text-[--exec-text] truncate flex-1">
          {prospect.agency_name}
        </h4>
        <div className="flex items-center gap-1 flex-shrink-0">
          {dueToday && !isMuted && (
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-md bg-[--exec-accent]/20 text-[--exec-accent] tracking-wide">
              Today
            </span>
          )}
          {prospect.email && (
            <button
              onClick={() => onViewMessage(prospect)}
              className="p-1.5 text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-500/15 rounded-md transition-colors opacity-0 group-hover:opacity-100"
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
                  : 'text-[--exec-text-muted] hover:text-emerald-400 hover:bg-emerald-500/15 opacity-0 group-hover:opacity-100'
              )}
              title={prospect.linkedin_connected ? 'LinkedIn connected (click to undo)' : 'Mark LinkedIn accepted'}
            >
              <UserCheck className="w-3.5 h-3.5" />
            </button>
          )}
          {!isMuted && (
            <button
              onClick={() => onMarkResponse(prospect)}
              className="p-1.5 text-[--exec-text-muted] hover:text-green-400 hover:bg-green-500/15 rounded-md transition-colors opacity-0 group-hover:opacity-100"
              title="Mark response"
            >
              <MessageSquare className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => onEdit(prospect)}
            className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-md transition-colors opacity-0 group-hover:opacity-100"
            title="Edit prospect"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Contact name */}
      {prospect.contact_name && (
        <p className="text-xs text-[--exec-text-muted] truncate mb-2">{prospect.contact_name}</p>
      )}

      {/* Status badge + custom message indicator */}
      <div className="flex items-center gap-2 mb-2">
        <ProspectStatusBadge status={prospect.status} />
        {hasCustomMessage ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
            <Mail className="w-2.5 h-2.5" />
            Custom
          </span>
        ) : prospect.email ? (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded bg-stone-700/40 text-stone-500 border border-stone-600/30">
            <Mail className="w-2.5 h-2.5" />
            No msg
          </span>
        ) : null}
      </div>

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
}: {
  prospects: OutreachProspect[];
  campaignSteps: MultiTouchStep[];
  onEdit: (prospect: OutreachProspect) => void;
  onViewMessage: (prospect: OutreachProspect) => void;
  onMarkResponse: (prospect: OutreachProspect) => void;
  onMarkConnected: (prospect: OutreachProspect) => void;
  highlightProspectId?: number;
}) {
  const [showSkipped, setShowSkipped] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('date_asc');
  const [searchTerm, setSearchTerm] = useState('');

  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Users className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No prospects yet</h3>
        <p className="text-[--exec-text-muted]">Import a CSV or add prospects manually.</p>
      </div>
    );
  }

  // Filter prospects by search term
  const filteredProspects = searchTerm.trim().length >= 2
    ? prospects.filter((p) => {
        const term = searchTerm.toLowerCase();
        return (
          p.agency_name?.toLowerCase().includes(term) ||
          p.contact_name?.toLowerCase().includes(term) ||
          p.email?.toLowerCase().includes(term) ||
          p.niche?.toLowerCase().includes(term)
        );
      })
    : prospects;

  // Group prospects by step (non-outcome) or by outcome status
  const stepBuckets: Record<number, OutreachProspect[]> = {};
  const outcomeBuckets: Record<string, OutreachProspect[]> = {
    replied: [],
    converted: [],
    not_interested: [],
  };
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
    } else {
      const step = p.current_step;
      if (!stepBuckets[step]) stepBuckets[step] = [];
      stepBuckets[step].push(p);
    }
  }

  // Build step columns: use campaignSteps if available, otherwise derive from prospect data
  let stepColumns: { stepNumber: number; channelType?: StepChannelType; label: string; requiresLinkedInConnected?: boolean }[];

  if (campaignSteps.length > 0) {
    stepColumns = campaignSteps.map((step) => ({
      stepNumber: step.step_number,
      channelType: step.channel_type as StepChannelType,
      label: CHANNEL_LABELS[step.channel_type as StepChannelType] || step.channel_type,
      requiresLinkedInConnected: step.requires_linkedin_connected,
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

  const totalColumns = stepColumns.length + OUTCOME_COLUMNS.length;

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
        <div
          className="grid gap-4 px-2"
          style={{
            gridTemplateColumns: `repeat(${totalColumns}, minmax(220px, 1fr))`,
            minWidth: totalColumns > 4 ? `${totalColumns * 240}px` : undefined,
          }}
        >
          {/* Step columns */}
          {stepColumns.map((col) => {
            const colors = col.channelType ? CHANNEL_COLORS[col.channelType] : undefined;
            const Icon = col.channelType ? CHANNEL_ICONS[col.channelType] : undefined;
            const bucket = sortProspects(stepBuckets[col.stepNumber] || [], sortBy);

            const customCount = bucket.filter(p => !!(p.custom_email_subject || p.custom_email_body)).length;
            const noCustomCount = bucket.filter(p => p.email && !(p.custom_email_subject || p.custom_email_body)).length;

            return (
              <div key={col.stepNumber} className="flex flex-col min-w-0">
                {/* Column header */}
                <div
                  className={cn(
                    'rounded-t-xl px-4 py-3 border border-b-0',
                    'bg-stone-800/50 border-stone-700/40'
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={cn(
                        'flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0',
                        colors?.bg || 'bg-stone-600/30',
                        colors?.text || 'text-stone-400'
                      )}
                    >
                      {col.stepNumber}
                    </span>
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      {Icon && <Icon className={cn('w-4 h-4 flex-shrink-0', colors?.text || 'text-stone-400')} />}
                      <span className={cn('text-sm font-semibold truncate', colors?.text || 'text-stone-400')}>
                        {col.label}
                      </span>
                    </div>
                    {col.requiresLinkedInConnected && (
                      <span title="Only for LinkedIn connected prospects"><UserCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /></span>
                    )}
                    <span className="text-xs bg-stone-700/60 text-[--exec-text-muted] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                      {bucket.length}
                    </span>
                  </div>
                  {/* Custom message counts for steps with email prospects */}
                  {bucket.length > 0 && (customCount > 0 || noCustomCount > 0) && (
                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-stone-700/30">
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
                </div>

                {/* Column body */}
                <div
                  className={cn(
                    'flex-1 rounded-b-xl border border-t-0 p-3 space-y-3 min-h-[160px] max-h-[70vh] overflow-y-auto',
                    'bg-stone-800/15 border-stone-700/40'
                  )}
                >
                  {bucket.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[100px] text-[--exec-text-muted] text-sm">
                      No prospects
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
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {/* Outcome columns */}
          {OUTCOME_COLUMNS.map((col) => {
            const bucket = sortProspects(outcomeBuckets[col.key], sortBy);
            const OutcomeIcon = col.icon;

            return (
              <div key={col.key} className="flex flex-col min-w-0">
                {/* Column header */}
                <div
                  className={cn(
                    'rounded-t-xl px-4 py-3 border border-b-0',
                    col.headerBg,
                    col.border
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <OutcomeIcon className={cn('w-4.5 h-4.5 flex-shrink-0', col.text)} />
                    <span className={cn('text-sm font-semibold flex-1', col.text)}>
                      {col.label}
                    </span>
                    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0', col.bg, col.text)}>
                      {bucket.length}
                    </span>
                  </div>
                </div>

                {/* Column body */}
                <div
                  className={cn(
                    'flex-1 rounded-b-xl border border-t-0 p-3 space-y-3 min-h-[160px] max-h-[70vh] overflow-y-auto',
                    'bg-stone-800/15',
                    col.border
                  )}
                >
                  {bucket.length === 0 ? (
                    <div className="flex items-center justify-center h-full min-h-[100px] text-[--exec-text-muted] text-sm">
                      None yet
                    </div>
                  ) : (
                    bucket.map((prospect) => (
                      <PipelineProspectCard
                        key={prospect.id}
                        prospect={prospect}
                        onEdit={onEdit}
                        onViewMessage={onViewMessage}
                        onMarkResponse={onMarkResponse}
                        isHighlighted={prospect.id === highlightProspectId}
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
                  />
                ))}
              </div>
            </div>
          )}
        </div>
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

                    {/* LinkedIn connected only badge */}
                    {step.requires_linkedin_connected && (
                      <div className="flex items-center gap-1 mt-0.5">
                        <UserCheck className="w-3 h-3 text-emerald-400" />
                        <span className="text-[10px] text-emerald-400 font-medium">Connected only</span>
                      </div>
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
    onError: () => toast.error('Failed to delete campaign'),
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

  const handleDeleteCampaign = (e: React.MouseEvent, campaignId: number) => {
    e.stopPropagation();
    if (confirm('Delete this campaign and all its prospects?')) {
      deleteCampaignMutation.mutate(campaignId);
    }
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
            onDelete={() => {
              if (confirm('Delete this campaign and all its prospects?')) {
                deleteCampaignMutation.mutate(selectedCampaignId);
              }
            }}
          />
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
    </>
  );
}
