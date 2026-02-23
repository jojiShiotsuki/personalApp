import { useState } from 'react';
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
  Edit2,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  Clock,
  X,
  AlertTriangle,
  Linkedin,
  Heart,
  UserPlus,
  UserCheck,
  Mail,
  Reply,
  SkipForward,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import NewCampaignModal from '@/components/NewCampaignModal';
import ProspectStatusBadge from '@/components/outreach/ProspectStatusBadge';

type TabType = 'today' | 'all' | 'replied' | 'skipped';

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

// Step progress indicator
function StepIndicator({ steps, currentStep }: { steps: MultiTouchStep[]; currentStep: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {steps.map((step) => {
        const colors = CHANNEL_COLORS[step.channel_type as StepChannelType];
        const isCurrent = step.step_number === currentStep;
        const isCompleted = step.step_number < currentStep;
        return (
          <div
            key={step.step_number}
            title={`Step ${step.step_number}: ${CHANNEL_LABELS[step.channel_type as StepChannelType] || step.channel_type}`}
            className={cn(
              'rounded-full transition-all',
              isCurrent
                ? cn('w-3 h-3', colors?.dot || 'bg-stone-400', 'shadow-[0_0_6px_rgba(255,255,255,0.3)]')
                : isCompleted
                  ? cn('w-2 h-2', colors?.dot || 'bg-stone-400')
                  : 'w-2 h-2 bg-stone-600'
            )}
          />
        );
      })}
    </div>
  );
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

// Channel badge
function ChannelBadge({ channelType }: { channelType: StepChannelType }) {
  const colors = CHANNEL_COLORS[channelType];
  const Icon = CHANNEL_ICONS[channelType];
  const label = CHANNEL_LABELS[channelType];
  if (!colors || !label) return null;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium', colors.bg, colors.text)}>
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </span>
  );
}

// Edit Prospect Modal
function EditProspectModal({
  prospect,
  isOpen,
  onClose,
  onSave,
  onDelete,
  isSaving,
}: {
  prospect: OutreachProspect;
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<OutreachProspect>) => void;
  onDelete: (id: number) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState({
    agency_name: prospect.agency_name,
    contact_name: prospect.contact_name || '',
    email: prospect.email || '',
    website: prospect.website || '',
    niche: prospect.niche || '',
    notes: prospect.notes || '',
    linkedin_url: prospect.linkedin_url || '',
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
      notes: form.notes || undefined,
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

// Action button for today queue cards based on step channel type
function StepActionButton({
  prospect,
  campaignId,
  onAdvance,
  onConnectionSent,
  onMtConnected,
  onEngaged,
}: {
  prospect: OutreachProspect;
  campaignId: number;
  onAdvance: (campaignId: number, prospectId: number) => void;
  onConnectionSent: (prospectId: number) => void;
  onMtConnected: (campaignId: number, prospectId: number) => void;
  onEngaged: (campaignId: number, prospectId: number) => void;
}) {
  const stepDetail = prospect.current_step_detail;
  if (!stepDetail) return null;

  const channelType = stepDetail.channel_type as StepChannelType;
  const isPendingConnection = prospect.status === ProspectStatus.PENDING_CONNECTION;

  const actionBtnClass = cn(
    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
    'text-white hover:brightness-110 hover:scale-105 hover:shadow-lg active:scale-95'
  );

  switch (channelType) {
    case StepChannelType.EMAIL:
    case StepChannelType.FOLLOW_UP_EMAIL:
      return (
        <button
          onClick={() => onAdvance(campaignId, prospect.id)}
          className={actionBtnClass}
          style={{ backgroundColor: 'var(--exec-accent)' }}
        >
          <Send className="w-4 h-4" />
          Mark Sent
        </button>
      );

    case StepChannelType.LINKEDIN_CONNECT:
      if (isPendingConnection) {
        return (
          <button
            onClick={() => onMtConnected(campaignId, prospect.id)}
            className={cn(actionBtnClass, 'bg-cyan-600 hover:bg-cyan-500')}
          >
            <UserCheck className="w-4 h-4" />
            Connected!
          </button>
        );
      }
      return (
        <button
          onClick={() => onConnectionSent(prospect.id)}
          className={actionBtnClass}
          style={{ backgroundColor: 'var(--exec-accent)' }}
        >
          <UserPlus className="w-4 h-4" />
          Connection Sent
        </button>
      );

    case StepChannelType.LINKEDIN_MESSAGE:
      return (
        <button
          onClick={() => onAdvance(campaignId, prospect.id)}
          className={actionBtnClass}
          style={{ backgroundColor: 'var(--exec-accent)' }}
        >
          <MessageSquare className="w-4 h-4" />
          Message Sent
        </button>
      );

    case StepChannelType.LINKEDIN_ENGAGE:
      return (
        <button
          onClick={() => onEngaged(campaignId, prospect.id)}
          className={cn(actionBtnClass, 'bg-amber-600 hover:bg-amber-500')}
        >
          <Heart className="w-4 h-4" />
          I Engaged
        </button>
      );

    default:
      return (
        <button
          onClick={() => onAdvance(campaignId, prospect.id)}
          className={actionBtnClass}
          style={{ backgroundColor: 'var(--exec-accent)' }}
        >
          <Send className="w-4 h-4" />
          Done
        </button>
      );
  }
}

// Multi-touch prospect card for the today queue
function MultiTouchProspectCard({
  prospect,
  campaignId,
  campaignSteps,
  onAdvance,
  onConnectionSent,
  onMtConnected,
  onEngaged,
  onSkip,
  onEdit,
}: {
  prospect: OutreachProspect;
  campaignId: number;
  campaignSteps: MultiTouchStep[];
  onAdvance: (campaignId: number, prospectId: number) => void;
  onConnectionSent: (prospectId: number) => void;
  onMtConnected: (campaignId: number, prospectId: number) => void;
  onEngaged: (campaignId: number, prospectId: number) => void;
  onSkip: (prospectId: number) => void;
  onEdit: () => void;
}) {
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const stepDetail = prospect.current_step_detail;
  const channelType = stepDetail?.channel_type as StepChannelType | undefined;

  return (
    <>
      <div className="bento-card p-5 hover:shadow-lg transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {/* Agency & contact */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold text-[--exec-text] truncate">{prospect.agency_name}</h3>
              {channelType && <ChannelBadge channelType={channelType} />}
            </div>

            {prospect.contact_name && (
              <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.contact_name}</p>
            )}

            {prospect.niche && (
              <p className="text-xs text-[--exec-text-muted] mb-1.5">{prospect.niche}</p>
            )}

            {/* Step progress indicator */}
            {campaignSteps.length > 0 && (
              <div className="mb-2">
                <StepIndicator steps={campaignSteps} currentStep={prospect.current_step} />
              </div>
            )}

            {/* Current step instruction */}
            {stepDetail?.instruction_text && (
              <p className="text-xs text-[--exec-text-secondary] bg-stone-800/40 rounded-lg px-2.5 py-1.5 mb-2 border border-stone-700/30">
                <span className="font-medium text-[--exec-text-muted]">Step {stepDetail.step_number}:</span>{' '}
                {stepDetail.instruction_text}
              </p>
            )}

            {/* Missing data warnings */}
            {prospect.missing_data_warnings && prospect.missing_data_warnings.length > 0 && (
              <div className="flex flex-wrap items-center gap-1 mb-2">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
                {prospect.missing_data_warnings.map((warning, i) => (
                  <span key={i} className="px-1.5 py-0.5 text-[10px] font-medium rounded border bg-amber-500/15 text-amber-400 border-amber-500/30">
                    {warning}
                  </span>
                ))}
              </div>
            )}

            <ProspectLinks prospect={prospect} />

            {/* Dates */}
            {(prospect.last_contacted_at || prospect.next_action_date) && (
              <div className="flex items-center gap-3 mt-2 text-xs text-[--exec-text-muted]">
                {prospect.last_contacted_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Sent {formatShortDate(prospect.last_contacted_at)}
                  </span>
                )}
                {prospect.next_action_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Next {formatShortDate(prospect.next_action_date)}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
              title="Edit prospect"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <ProspectStatusBadge status={prospect.status} />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
          {/* Open LinkedIn if applicable */}
          {prospect.linkedin_url && channelType && (
            channelType === StepChannelType.LINKEDIN_CONNECT ||
            channelType === StepChannelType.LINKEDIN_MESSAGE ||
            channelType === StepChannelType.LINKEDIN_ENGAGE
          ) && (
            <a
              href={prospect.linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-blue-600/30 text-blue-300 border border-blue-500/30',
                'hover:bg-blue-500 hover:text-white hover:scale-105',
                'active:scale-95'
              )}
            >
              <Linkedin className="w-4 h-4" />
              Open Profile
            </a>
          )}

          {/* Primary action */}
          <StepActionButton
            prospect={prospect}
            campaignId={campaignId}
            onAdvance={onAdvance}
            onConnectionSent={onConnectionSent}
            onMtConnected={onMtConnected}
            onEngaged={onEngaged}
          />

          {/* They Replied */}
          <button
            onClick={() => setIsResponseModalOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              'bg-green-600 text-white hover:bg-green-500 hover:scale-105 hover:shadow-lg active:scale-95'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            They Replied
          </button>

          {/* Skip */}
          <button
            onClick={() => onSkip(prospect.id)}
            className="p-2 text-[--exec-text-muted] hover:text-orange-400 hover:bg-orange-500/10 rounded-xl transition-colors"
            title="Skip this prospect"
          >
            <SkipForward className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ResponseOutcomeModal
        isOpen={isResponseModalOpen}
        onClose={() => setIsResponseModalOpen(false)}
        prospect={prospect}
      />
    </>
  );
}

// Today Queue view
function TodayQueue({
  prospects,
  campaignId,
  campaignSteps,
  onAdvance,
  onConnectionSent,
  onMtConnected,
  onEngaged,
  onSkip,
  onEdit,
}: {
  prospects: OutreachProspect[];
  campaignId: number;
  campaignSteps: MultiTouchStep[];
  onAdvance: (campaignId: number, prospectId: number) => void;
  onConnectionSent: (prospectId: number) => void;
  onMtConnected: (campaignId: number, prospectId: number) => void;
  onEngaged: (campaignId: number, prospectId: number) => void;
  onSkip: (prospectId: number) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Layers className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No actions for today</h3>
        <p className="text-[--exec-text-muted]">Check back tomorrow or import more prospects.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {prospects.map((prospect) => (
        <MultiTouchProspectCard
          key={prospect.id}
          prospect={prospect}
          campaignId={campaignId}
          campaignSteps={campaignSteps}
          onAdvance={onAdvance}
          onConnectionSent={onConnectionSent}
          onMtConnected={onMtConnected}
          onEngaged={onEngaged}
          onSkip={onSkip}
          onEdit={() => onEdit(prospect)}
        />
      ))}
    </div>
  );
}

// All Prospects table
function AllProspectsTable({
  prospects,
  campaignSteps,
  onEdit,
}: {
  prospects: OutreachProspect[];
  campaignSteps: MultiTouchStep[];
  onEdit: (prospect: OutreachProspect) => void;
}) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Users className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No prospects yet</h3>
        <p className="text-[--exec-text-muted]">Import a CSV or add prospects manually.</p>
      </div>
    );
  }

  return (
    <div className="bento-card overflow-hidden">
      <table className="min-w-full divide-y divide-[--exec-border]">
        <thead className="bg-[--exec-surface-alt]">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Agency</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Contact</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Step</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Next Action</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
          {prospects.map((prospect) => {
            const stepObj = campaignSteps.find((s) => s.step_number === prospect.current_step);
            const channelType = stepObj?.channel_type as StepChannelType | undefined;

            return (
              <tr key={prospect.id} className="hover:bg-[--exec-surface-alt] transition-colors">
                <td className="px-6 py-4">
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[--exec-text] block truncate">{prospect.agency_name}</span>
                    {prospect.niche && <span className="text-xs text-[--exec-text-muted] block truncate">{prospect.niche}</span>}
                    <div className="mt-1">
                      <ProspectLinks prospect={prospect} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <span className="text-sm text-[--exec-text]">{prospect.contact_name || '-'}</span>
                    {prospect.email && <span className="text-xs text-[--exec-text-muted] block truncate max-w-[180px]">{prospect.email}</span>}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-[--exec-text-secondary]">{prospect.current_step}</span>
                    {channelType && <ChannelBadge channelType={channelType} />}
                  </div>
                  {campaignSteps.length > 0 && (
                    <div className="mt-1">
                      <StepIndicator steps={campaignSteps} currentStep={prospect.current_step} />
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <ProspectStatusBadge status={prospect.status} />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-[--exec-text-muted]">
                    {prospect.next_action_date ? new Date(prospect.next_action_date).toLocaleDateString() : '-'}
                  </div>
                  {prospect.last_contacted_at && (
                    <div className="text-xs text-[--exec-text-muted] mt-0.5 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Sent {formatShortDate(prospect.last_contacted_at)}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right">
                  <button
                    onClick={() => onEdit(prospect)}
                    className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
                    title="Edit prospect"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// Replied Prospects
function RepliedProspects({
  prospects,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onEdit: (prospect: OutreachProspect) => void;
}) {
  const replied = prospects.filter(
    (p) =>
      p.status === ProspectStatus.REPLIED ||
      p.status === ProspectStatus.CONVERTED ||
      p.status === ProspectStatus.NOT_INTERESTED
  );

  if (replied.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <MessageSquare className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No replies yet</h3>
        <p className="text-[--exec-text-muted]">Keep working the sequence! Replies will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {replied.map((prospect) => (
        <div key={prospect.id} className="bento-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[--exec-text] truncate mb-1">{prospect.agency_name}</h3>
              {prospect.contact_name && <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.contact_name}</p>}
              {prospect.niche && <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.niche}</p>}
              <ProspectLinks prospect={prospect} />
              {prospect.notes && <p className="text-xs text-[--exec-text-muted] line-clamp-2 mt-2">{prospect.notes}</p>}
              {prospect.last_contacted_at && (
                <p className="text-xs text-[--exec-text-muted] mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last sent {formatShortDate(prospect.last_contacted_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(prospect)}
                className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <ProspectStatusBadge status={prospect.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skipped Prospects
function SkippedProspects({
  prospects,
  onRestore,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onRestore: (prospectId: number) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  const skipped = prospects.filter((p) => p.status === ProspectStatus.SKIPPED);

  if (skipped.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <SkipForward className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No skipped prospects</h3>
        <p className="text-[--exec-text-muted]">Prospects you skip will appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {skipped.map((prospect) => (
        <div key={prospect.id} className="bento-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-[--exec-text] truncate mb-1">{prospect.agency_name}</h3>
              {prospect.contact_name && <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.contact_name}</p>}
              {prospect.niche && <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.niche}</p>}
              <ProspectLinks prospect={prospect} />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onEdit(prospect)}
                className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
                title="Edit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <ProspectStatusBadge status={prospect.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
            <button
              onClick={() => onRestore(prospect.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-emerald-600 text-white hover:bg-emerald-500 hover:scale-105 hover:shadow-lg active:scale-95'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              Restore
            </button>
          </div>
        </div>
      ))}
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
export default function MultiTouchCampaignsTab() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [editingProspect, setEditingProspect] = useState<OutreachProspect | null>(null);
  const [isAddProspectOpen, setIsAddProspectOpen] = useState(false);

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

  const { data: todayQueue = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['mt-today-queue', selectedCampaignId],
    queryFn: () => coldOutreachApi.getTodayQueue(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab === 'today',
  });

  const { data: allProspects = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['mt-prospects', selectedCampaignId],
    queryFn: () => coldOutreachApi.getProspects(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab !== 'today',
  });

  // Mutations
  const advanceProspectMutation = useMutation({
    mutationFn: ({ campaignId, prospectId }: { campaignId: number; prospectId: number }) =>
      coldOutreachApi.advanceProspect(campaignId, prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to advance prospect'),
  });

  const connectionSentMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.markConnectionSent(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark connection sent'),
  });

  const mtConnectedMutation = useMutation({
    mutationFn: ({ campaignId, prospectId }: { campaignId: number; prospectId: number }) =>
      coldOutreachApi.markMtConnected(campaignId, prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark as connected'),
  });

  const engagedMutation = useMutation({
    mutationFn: ({ campaignId, prospectId }: { campaignId: number; prospectId: number }) =>
      coldOutreachApi.markEngaged(campaignId, prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark engagement'),
  });

  const skipMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.skipProspect(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to skip prospect'),
  });

  const unskipMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.unskipProspect(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to restore prospect'),
  });

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

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['mt-today-queue'] });
    queryClient.invalidateQueries({ queryKey: ['mt-prospects'] });
    queryClient.invalidateQueries({ queryKey: ['mt-campaign'] });
    queryClient.invalidateQueries({ queryKey: ['multi-touch-campaigns'] });
  }

  // Handlers
  const handleAdvance = (campaignId: number, prospectId: number) => {
    advanceProspectMutation.mutate({ campaignId, prospectId });
  };

  const handleConnectionSent = (prospectId: number) => {
    connectionSentMutation.mutate(prospectId);
  };

  const handleMtConnected = (campaignId: number, prospectId: number) => {
    mtConnectedMutation.mutate({ campaignId, prospectId });
  };

  const handleEngaged = (campaignId: number, prospectId: number) => {
    engagedMutation.mutate({ campaignId, prospectId });
  };

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

        {/* Sub-tabs */}
        {selectedCampaignId && (
          <div className="mb-6">
            <div className="flex items-center gap-1">
              {(['today', 'all', 'replied', 'skipped'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200',
                    activeTab === tab
                      ? 'text-white shadow-lg scale-105'
                      : 'bg-slate-700/50 text-slate-400 hover:bg-slate-600 hover:text-white hover:scale-105'
                  )}
                  style={activeTab === tab ? { backgroundColor: 'var(--exec-accent)' } : undefined}
                >
                  {tab === 'today' && 'Today'}
                  {tab === 'all' && 'All Prospects'}
                  {tab === 'replied' && 'Replied'}
                  {tab === 'skipped' && 'Skipped'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        {selectedCampaignId ? (
          <div>
            {activeTab === 'today' && (
              <TodayQueue
                prospects={todayQueue}
                campaignId={selectedCampaignId}
                campaignSteps={campaignSteps}
                onAdvance={handleAdvance}
                onConnectionSent={handleConnectionSent}
                onMtConnected={handleMtConnected}
                onEngaged={handleEngaged}
                onSkip={(prospectId) => skipMutation.mutate(prospectId)}
                onEdit={setEditingProspect}
              />
            )}
            {activeTab === 'all' && (
              <AllProspectsTable
                prospects={allProspects}
                campaignSteps={campaignSteps}
                onEdit={setEditingProspect}
              />
            )}
            {activeTab === 'replied' && (
              <RepliedProspects prospects={allProspects} onEdit={setEditingProspect} />
            )}
            {activeTab === 'skipped' && (
              <SkippedProspects
                prospects={allProspects}
                onRestore={(prospectId) => unskipMutation.mutate(prospectId)}
                onEdit={setEditingProspect}
              />
            )}
          </div>
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
        />
      )}

      <AddProspectModal
        isOpen={isAddProspectOpen}
        onClose={() => setIsAddProspectOpen(false)}
        onSave={(data) => createProspectMutation.mutate(data)}
        isSaving={createProspectMutation.isPending}
      />
    </>
  );
}
