import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type {
  OutreachCampaign,
  CampaignWithStats,
  OutreachProspect,
} from '@/types';
import { ProspectStatus, CampaignType } from '@/types';
import {
  Linkedin,
  Plus,
  Upload,
  Send,
  MessageSquare,
  Users,
  CheckCircle,
  UserCheck,
  UserPlus,
  ChevronDown,
  Edit2,
  Trash2,
  Globe,
  MapPin,
  Calendar,
  Clock,
  X,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import NewCampaignModal from '@/components/NewCampaignModal';

type TabType = 'today' | 'pending' | 'connected' | 'sent' | 'all' | 'replied';

const WEBSITE_ISSUE_LABELS: Record<string, { label: string; color: string }> = {
  slow_load: { label: 'Slow Load', color: 'text-red-400 bg-red-900/30 border-red-800' },
  not_mobile_friendly: { label: 'Not Mobile', color: 'text-orange-400 bg-orange-900/30 border-orange-800' },
  no_google_presence: { label: 'No Google', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  no_clear_cta: { label: 'No CTA', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  outdated_design: { label: 'Outdated', color: 'text-purple-400 bg-purple-900/30 border-purple-800' },
};

// Status badge component with LinkedIn statuses
function StatusBadge({ status }: { status: ProspectStatus }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    [ProspectStatus.QUEUED]: {
      bg: 'bg-gray-100 dark:bg-gray-700/50',
      text: 'text-gray-600 dark:text-gray-400',
      label: 'Queued',
    },
    [ProspectStatus.PENDING_CONNECTION]: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-600 dark:text-amber-400',
      label: 'Pending',
    },
    [ProspectStatus.CONNECTED]: {
      bg: 'bg-cyan-100 dark:bg-cyan-900/30',
      text: 'text-cyan-600 dark:text-cyan-400',
      label: 'Connected',
    },
    [ProspectStatus.IN_SEQUENCE]: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      label: 'Messaged',
    },
    [ProspectStatus.REPLIED]: {
      bg: 'bg-green-100 dark:bg-green-900/30',
      text: 'text-green-600 dark:text-green-400',
      label: 'Replied',
    },
    [ProspectStatus.NOT_INTERESTED]: {
      bg: 'bg-red-100 dark:bg-red-900/30',
      text: 'text-red-600 dark:text-red-400',
      label: 'Not Interested',
    },
    [ProspectStatus.CONVERTED]: {
      bg: 'bg-purple-100 dark:bg-purple-900/30',
      text: 'text-purple-600 dark:text-purple-400',
      label: 'Converted',
    },
  };

  const { bg, text, label } = config[status] || config[ProspectStatus.QUEUED];

  return (
    <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium', bg, text)}>
      {label}
    </span>
  );
}

// Prospect links
function ProspectLinks({ prospect, size = 'sm' }: { prospect: OutreachProspect; size?: 'sm' | 'xs' }) {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const btnClass = cn(
    'inline-flex items-center justify-center rounded-md transition-colors',
    size === 'sm' ? 'w-7 h-7' : 'w-6 h-6',
    'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
  );

  return (
    <div className="flex items-center gap-1">
      {prospect.linkedin_url && (
        <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className={cn(btnClass, 'hover:text-blue-400')} title="LinkedIn Profile">
          <Linkedin className={iconSize} />
        </a>
      )}
      {prospect.website && (
        <a href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className={btnClass} title="Website">
          <Globe className={iconSize} />
        </a>
      )}
      <a href={`https://www.google.com/maps/search/${encodeURIComponent(prospect.agency_name)}`} target="_blank" rel="noopener noreferrer" className={btnClass} title="Google Maps">
        <MapPin className={iconSize} />
      </a>
    </div>
  );
}

function formatShortDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// LinkedIn step labels
function getStepLabel(step: number, status: ProspectStatus): string {
  if (status === ProspectStatus.QUEUED) return 'Send Connection';
  if (status === ProspectStatus.PENDING_CONNECTION) return 'Awaiting Accept';
  if (status === ProspectStatus.CONNECTED && step <= 2) return 'Send 1st Message';
  if (step === 2) return 'Message 1';
  if (step === 3) return 'Follow-up 1';
  if (step === 4) return 'Follow-up 2';
  if (step === 5) return 'Follow-up 3';
  return `Step ${step}`;
}

// Edit Prospect Modal (LinkedIn version)
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

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">Edit Prospect</h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">Update LinkedIn prospect details</p>
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
                LinkedIn Profile URL <span className="text-red-400">*</span>
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
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={cn(inputClasses, 'resize-none')} rows={3} placeholder="Connection note, context..." />
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
    </div>
  );
}

// Prospect card for Today queue
function LinkedInProspectCard({
  prospect,
  onAction,
  onEdit,
}: {
  prospect: OutreachProspect;
  onAction: (action: string) => void;
  onEdit: () => void;
}) {
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);

  const isQueued = prospect.status === ProspectStatus.QUEUED;
  const isConnected = prospect.status === ProspectStatus.CONNECTED;
  const isInSequence = prospect.status === ProspectStatus.IN_SEQUENCE;

  return (
    <>
      <div className="bento-card p-5 hover:shadow-lg transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn(
                'w-2.5 h-2.5 rounded-full flex-shrink-0',
                isQueued ? 'bg-gray-400' :
                isConnected ? 'bg-cyan-500' :
                isInSequence ? 'bg-blue-500' : 'bg-green-500'
              )} />
              <h3 className="font-semibold text-[--exec-text] truncate">{prospect.agency_name}</h3>
              <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full flex-shrink-0">
                {getStepLabel(prospect.current_step, prospect.status)}
              </span>
            </div>

            {prospect.contact_name && (
              <p className="text-xs text-[--exec-text-muted] ml-[18px] mb-1">{prospect.contact_name}</p>
            )}

            {prospect.linkedin_url && (
              <a
                href={prospect.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition-colors mb-1"
              >
                <Linkedin className="w-3.5 h-3.5" />
                <span className="truncate max-w-[200px]">
                  {prospect.linkedin_url.replace('https://www.linkedin.com/', '').replace('https://linkedin.com/', '')}
                </span>
                <ExternalLink className="w-3 h-3 flex-shrink-0" />
              </a>
            )}

            {prospect.niche && (
              <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.niche}</p>
            )}

            <ProspectLinks prospect={prospect} size="sm" />

            {prospect.website_issues && prospect.website_issues.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                {prospect.website_issues.map((issue) => {
                  const info = WEBSITE_ISSUE_LABELS[issue];
                  return info ? (
                    <span key={issue} className={cn('px-1.5 py-0.5 text-[10px] font-medium rounded border', info.color)}>{info.label}</span>
                  ) : null;
                })}
              </div>
            )}

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
            <button onClick={onEdit} className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors" title="Edit prospect">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <StatusBadge status={prospect.status} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
          {/* Open LinkedIn profile */}
          {prospect.linkedin_url && (
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

          {/* Action buttons based on status */}
          {isQueued && (
            <button
              onClick={() => onAction('connection-sent')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'text-white hover:brightness-110 hover:scale-105 hover:shadow-lg active:scale-95'
              )}
              style={{ backgroundColor: 'var(--exec-accent)' }}
            >
              <UserPlus className="w-4 h-4" />
              Connection Sent
            </button>
          )}

          {isConnected && (
            <button
              onClick={() => onAction('message-sent')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'text-white hover:brightness-110 hover:scale-105 hover:shadow-lg active:scale-95'
              )}
              style={{ backgroundColor: 'var(--exec-accent)' }}
            >
              <Send className="w-4 h-4" />
              Message Sent
            </button>
          )}

          {isInSequence && (
            <>
              <button
                onClick={() => onAction('message-sent')}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  'text-white hover:brightness-110 hover:scale-105 hover:shadow-lg active:scale-95'
                )}
                style={{ backgroundColor: 'var(--exec-accent)' }}
              >
                <Send className="w-4 h-4" />
                Follow-up Sent
              </button>
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
            </>
          )}
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

// Today Queue
function TodayQueue({
  prospects,
  onAction,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onAction: (prospectId: number, action: string) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Linkedin className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No LinkedIn actions for today</h3>
        <p className="text-[--exec-text-muted]">Check back tomorrow or import more prospects.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {prospects.map((prospect) => (
        <LinkedInProspectCard
          key={prospect.id}
          prospect={prospect}
          onAction={(action) => onAction(prospect.id, action)}
          onEdit={() => onEdit(prospect)}
        />
      ))}
    </div>
  );
}

// Pending Connections view
function PendingConnections({
  prospects,
  onMarkConnected,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onMarkConnected: (prospectId: number) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  const pending = prospects.filter((p) => p.status === ProspectStatus.PENDING_CONNECTION);

  if (pending.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <UserPlus className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No pending connections</h3>
        <p className="text-[--exec-text-muted]">Send connection requests from the Today queue.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {pending.map((prospect) => (
        <div key={prospect.id} className="bento-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                <h3 className="font-semibold text-[--exec-text] truncate">{prospect.agency_name}</h3>
              </div>
              {prospect.contact_name && <p className="text-xs text-[--exec-text-muted] ml-[18px] mb-1">{prospect.contact_name}</p>}
              {prospect.linkedin_url && (
                <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mb-1">
                  <Linkedin className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{prospect.linkedin_url.replace('https://www.linkedin.com/', '').replace('https://linkedin.com/', '')}</span>
                </a>
              )}
              {prospect.niche && <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.niche}</p>}
              <ProspectLinks prospect={prospect} size="sm" />
              {prospect.last_contacted_at && (
                <p className="text-xs text-[--exec-text-muted] mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Sent {formatShortDate(prospect.last_contacted_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(prospect)} className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <StatusBadge status={prospect.status} />
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
            <button
              onClick={() => onMarkConnected(prospect.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-cyan-600 text-white hover:bg-cyan-500 hover:scale-105 hover:shadow-lg active:scale-95'
              )}
            >
              <UserCheck className="w-4 h-4" />
              They Accepted
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Connected prospects (ready to message)
function ConnectedProspects({
  prospects,
  onMessageSent,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onMessageSent: (prospectId: number) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  const connected = prospects.filter((p) => p.status === ProspectStatus.CONNECTED);

  if (connected.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <UserCheck className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No connected prospects waiting</h3>
        <p className="text-[--exec-text-muted]">Once prospects accept your connection, they'll appear here.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {connected.map((prospect) => (
        <div key={prospect.id} className="bento-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2.5 h-2.5 rounded-full bg-cyan-500 flex-shrink-0" />
                <h3 className="font-semibold text-[--exec-text] truncate">{prospect.agency_name}</h3>
              </div>
              {prospect.contact_name && <p className="text-xs text-[--exec-text-muted] ml-[18px] mb-1">{prospect.contact_name}</p>}
              {prospect.linkedin_url && (
                <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 mb-1">
                  <Linkedin className="w-3.5 h-3.5" />
                  View Profile
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {prospect.niche && <p className="text-xs text-[--exec-text-muted]">{prospect.niche}</p>}
              <ProspectLinks prospect={prospect} size="sm" />
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(prospect)} className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <StatusBadge status={prospect.status} />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
            {prospect.linkedin_url && (
              <a
                href={prospect.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                  'bg-blue-600/30 text-blue-300 border border-blue-500/30',
                  'hover:bg-blue-500 hover:text-white hover:scale-105 active:scale-95'
                )}
              >
                <Linkedin className="w-4 h-4" />
                Open Chat
              </a>
            )}
            <button
              onClick={() => onMessageSent(prospect.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'text-white hover:brightness-110 hover:scale-105 hover:shadow-lg active:scale-95'
              )}
              style={{ backgroundColor: 'var(--exec-accent)' }}
            >
              <Send className="w-4 h-4" />
              Message Sent
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Sent / In Sequence
function SentProspects({ prospects, onEdit }: { prospects: OutreachProspect[]; onEdit: (prospect: OutreachProspect) => void }) {
  const [openResponseId, setOpenResponseId] = useState<number | null>(null);
  const sent = prospects.filter((p) => p.status === ProspectStatus.IN_SEQUENCE);

  if (sent.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Send className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No messages sent yet</h3>
        <p className="text-[--exec-text-muted]">Connect with prospects and send messages to see them here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sent.map((prospect) => {
          const daysUntilNext = prospect.next_action_date
            ? Math.ceil((new Date(prospect.next_action_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : null;

          return (
            <div key={prospect.id} className="bento-card p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
                    <h3 className="font-semibold text-[--exec-text] truncate">{prospect.agency_name}</h3>
                    <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full flex-shrink-0">
                      {getStepLabel(prospect.current_step, prospect.status)}
                    </span>
                  </div>
                  {prospect.contact_name && <p className="text-xs text-[--exec-text-muted] ml-[18px] mb-1">{prospect.contact_name}</p>}
                  {prospect.niche && <p className="text-xs text-[--exec-text-muted] mb-1">{prospect.niche}</p>}
                  <ProspectLinks prospect={prospect} size="sm" />

                  <div className="flex items-center gap-3 mt-2 text-xs text-[--exec-text-muted]">
                    {prospect.last_contacted_at && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Sent {formatShortDate(prospect.last_contacted_at)}
                      </span>
                    )}
                    {prospect.next_action_date && (
                      <span className={cn('flex items-center gap-1', daysUntilNext !== null && daysUntilNext <= 0 && 'text-amber-400')}>
                        <Calendar className="w-3 h-3" />
                        {daysUntilNext !== null && daysUntilNext <= 0 ? 'Follow-up due!' : `Follow-up in ${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}`}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => onEdit(prospect)} className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors" title="Edit">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <StatusBadge status={prospect.status} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
                <button
                  onClick={() => setOpenResponseId(prospect.id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                    'bg-green-600 text-white hover:bg-green-500 hover:scale-105 hover:shadow-lg active:scale-95'
                  )}
                >
                  <MessageSquare className="w-4 h-4" />
                  They Replied
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {openResponseId && (
        <ResponseOutcomeModal
          isOpen={true}
          onClose={() => setOpenResponseId(null)}
          prospect={sent.find((p) => p.id === openResponseId)!}
        />
      )}
    </>
  );
}

// All Prospects table
function AllProspects({
  prospects,
  onAction: _onAction,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onAction: (prospectId: number, action: string) => void;
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
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Prospect</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">LinkedIn</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Niche</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Stage</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Status</th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Next Action</th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
          {prospects.map((prospect) => (
            <tr key={prospect.id} className="hover:bg-[--exec-surface-alt] transition-colors">
              <td className="px-6 py-4">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-[--exec-text] block truncate">{prospect.agency_name}</span>
                  {prospect.contact_name && <span className="text-xs text-[--exec-text-muted] block truncate">{prospect.contact_name}</span>}
                  <div className="mt-1">
                    <ProspectLinks prospect={prospect} size="xs" />
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                {prospect.linkedin_url ? (
                  <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                    <Linkedin className="w-3 h-3" />
                    Profile
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                ) : (
                  <span className="text-xs text-[--exec-text-muted]">-</span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-muted]">{prospect.niche || '-'}</td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                {getStepLabel(prospect.current_step, prospect.status)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap"><StatusBadge status={prospect.status} /></td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Replied Prospects
function RepliedProspects({ prospects, onEdit }: { prospects: OutreachProspect[]; onEdit: (prospect: OutreachProspect) => void }) {
  const replied = prospects.filter(
    (p) => p.status === ProspectStatus.REPLIED || p.status === ProspectStatus.CONVERTED || p.status === ProspectStatus.NOT_INTERESTED
  );

  if (replied.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <MessageSquare className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No replies yet</h3>
        <p className="text-[--exec-text-muted]">Keep connecting and messaging! Replies will show up here.</p>
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
              <ProspectLinks prospect={prospect} size="sm" />
              {prospect.notes && <p className="text-xs text-[--exec-text-muted] line-clamp-2 mt-2">{prospect.notes}</p>}
              {prospect.last_contacted_at && (
                <p className="text-xs text-[--exec-text-muted] mt-2 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Last sent {formatShortDate(prospect.last_contacted_at)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => onEdit(prospect)} className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <StatusBadge status={prospect.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Main component
export default function LinkedInCampaignsTab() {
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [editingProspect, setEditingProspect] = useState<OutreachProspect | null>(null);

  const queryClient = useQueryClient();

  // Queries - filter by LINKEDIN campaign type
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['linkedin-campaigns'],
    queryFn: () => coldOutreachApi.getCampaigns('LINKEDIN'),
  });

  const { data: campaignWithStats } = useQuery<CampaignWithStats>({
    queryKey: ['linkedin-campaign', selectedCampaignId],
    queryFn: () => coldOutreachApi.getCampaign(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const { data: todayQueue = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['linkedin-today-queue', selectedCampaignId],
    queryFn: () => coldOutreachApi.getTodayQueue(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab === 'today',
  });

  const { data: allProspects = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['linkedin-prospects', selectedCampaignId],
    queryFn: () => coldOutreachApi.getProspects(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab !== 'today',
  });

  // Mutations
  const connectionSentMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.markConnectionSent(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark connection sent'),
  });

  const connectedMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.markConnected(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark as connected'),
  });

  const messageSentMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.markMessageSent(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      invalidateAll();
    },
    onError: () => toast.error('Failed to mark message sent'),
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (campaignId: number) => coldOutreachApi.deleteCampaign(campaignId),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['linkedin-campaigns'] });
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

  function invalidateAll() {
    queryClient.invalidateQueries({ queryKey: ['linkedin-today-queue'] });
    queryClient.invalidateQueries({ queryKey: ['linkedin-prospects'] });
    queryClient.invalidateQueries({ queryKey: ['linkedin-campaign'] });
  }

  // Handlers
  const handleAction = (prospectId: number, action: string) => {
    if (action === 'connection-sent') connectionSentMutation.mutate(prospectId);
    else if (action === 'message-sent') messageSentMutation.mutate(prospectId);
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
            <Linkedin className="w-4 h-4 text-blue-400" />
            <span className="flex-1 text-left truncate">
              {selectedCampaignId
                ? campaigns.find((c) => c.id === selectedCampaignId)?.name || 'Select Campaign'
                : 'Select Campaign'}
            </span>
            <ChevronDown className={cn('w-4 h-4 text-[--exec-text-muted] transition-transform duration-200', isCampaignDropdownOpen && 'rotate-180')} />
          </button>

          {isCampaignDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-full min-w-[280px] py-2 rounded-xl border border-[--exec-border] shadow-2xl z-[100]" style={{ backgroundColor: '#1C1917' }}>
              {campaigns.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[--exec-text-muted]">No LinkedIn campaigns yet</div>
              ) : (
                campaigns.map((campaign) => (
                  <div key={campaign.id} className={cn('flex items-center justify-between px-3 py-2 mx-2 rounded-lg', 'hover:bg-[--exec-surface-alt] transition-colors', selectedCampaignId === campaign.id && 'bg-[--exec-accent]/15')}>
                    <button
                      onClick={() => { setSelectedCampaignId(campaign.id); setIsCampaignDropdownOpen(false); }}
                      className={cn('flex-1 text-left text-sm', selectedCampaignId === campaign.id ? 'text-[--exec-accent] font-medium' : 'text-[--exec-text]')}
                    >
                      {campaign.name}
                    </button>
                    <div className="flex items-center gap-1 ml-3">
                      <button onClick={(e) => handleEditCampaign(e, campaign)} className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white hover:scale-110 transition-all duration-200" title="Edit campaign">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button onClick={(e) => handleDeleteCampaign(e, campaign.id)} className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white hover:scale-110 transition-all duration-200" title="Delete campaign">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

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
              if (!selectedCampaignId) { toast.error('Please select a campaign first'); return; }
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
                  <Linkedin className="w-5 h-5 text-[--exec-accent]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.to_contact_today}</p>
                  <p className="text-xs text-[--exec-text-muted]">To Do Today</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.pending_connection}</p>
                  <p className="text-xs text-[--exec-text-muted]">Pending</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                  <UserCheck className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">{stats.connected}</p>
                  <p className="text-xs text-[--exec-text-muted]">Connected</p>
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
          </div>
        )}

        {/* Sub-tabs */}
        {selectedCampaignId && (
          <div className="mb-6">
            <div className="flex items-center gap-1">
              {(['today', 'pending', 'connected', 'sent', 'all', 'replied'] as const).map((tab) => (
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
                  {tab === 'pending' && 'Pending'}
                  {tab === 'connected' && 'Connected'}
                  {tab === 'sent' && 'Messaged'}
                  {tab === 'all' && 'All Prospects'}
                  {tab === 'replied' && 'Replied'}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        {selectedCampaignId ? (
          <div>
            {activeTab === 'today' && (
              <TodayQueue prospects={todayQueue} onAction={handleAction} onEdit={setEditingProspect} />
            )}
            {activeTab === 'pending' && (
              <PendingConnections prospects={allProspects} onMarkConnected={(id) => connectedMutation.mutate(id)} onEdit={setEditingProspect} />
            )}
            {activeTab === 'connected' && (
              <ConnectedProspects prospects={allProspects} onMessageSent={(id) => messageSentMutation.mutate(id)} onEdit={setEditingProspect} />
            )}
            {activeTab === 'sent' && <SentProspects prospects={allProspects} onEdit={setEditingProspect} />}
            {activeTab === 'all' && <AllProspects prospects={allProspects} onAction={handleAction} onEdit={setEditingProspect} />}
            {activeTab === 'replied' && <RepliedProspects prospects={allProspects} onEdit={setEditingProspect} />}
          </div>
        ) : (
          <div className="bento-card p-12 text-center">
            <Linkedin className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[--exec-text] mb-2">Select a LinkedIn campaign to get started</h3>
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
              Create LinkedIn Campaign
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen || !!editingCampaign}
        onClose={() => { setIsNewCampaignOpen(false); setEditingCampaign(null); }}
        onCreated={(id) => setSelectedCampaignId(id)}
        editCampaign={editingCampaign}
        defaultCampaignType={CampaignType.LINKEDIN}
      />

      {selectedCampaignId && (
        <CsvImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          campaignId={selectedCampaignId}
          isLinkedIn
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
    </>
  );
}
