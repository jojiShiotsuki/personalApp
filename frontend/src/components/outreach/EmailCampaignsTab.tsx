import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coldOutreachApi } from '@/lib/api';
import type {
  OutreachCampaign,
  CampaignWithStats,
  OutreachProspect,
} from '@/types';
import { ProspectStatus } from '@/types';
import {
  Mail,
  Plus,
  Upload,
  FileText,
  Send,
  MessageSquare,
  Users,
  CheckCircle,
  Copy,
  ChevronDown,
  Edit2,
  Trash2,
  Globe,
  MapPin,
  Linkedin,
  Calendar,
  Clock,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import CopyEmailModal from '@/components/CopyEmailModal';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import NewCampaignModal from '@/components/NewCampaignModal';
import EmailTemplatesModal from '@/components/EmailTemplatesModal';

type TabType = 'today' | 'sent' | 'all' | 'replied';

// Status badge component for prospects
function StatusBadge({ status }: { status: ProspectStatus }) {
  const config: Record<ProspectStatus, { bg: string; text: string; label: string }> = {
    [ProspectStatus.QUEUED]: {
      bg: 'bg-gray-100 dark:bg-gray-700/50',
      text: 'text-gray-600 dark:text-gray-400',
      label: 'Queued',
    },
    [ProspectStatus.IN_SEQUENCE]: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-600 dark:text-blue-400',
      label: 'In Sequence',
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

// Shared icon links for prospects (website, GMB, social)
function ProspectLinks({ prospect, size = 'sm' }: { prospect: OutreachProspect; size?: 'sm' | 'xs' }) {
  const iconSize = size === 'sm' ? 'w-3.5 h-3.5' : 'w-3 h-3';
  const btnClass = cn(
    'inline-flex items-center justify-center rounded-md transition-colors',
    size === 'sm' ? 'w-7 h-7' : 'w-6 h-6',
    'text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
  );

  const gmbUrl = `https://www.google.com/maps/search/${encodeURIComponent(prospect.agency_name)}`;

  const hasAnyLink = prospect.website || prospect.linkedin_url || prospect.facebook_url || prospect.instagram_url;

  if (!hasAnyLink) {
    return (
      <div className="flex items-center gap-1">
        <a href={gmbUrl} target="_blank" rel="noopener noreferrer" className={btnClass} title="Google Maps">
          <MapPin className={iconSize} />
        </a>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {prospect.website && (
        <a href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`} target="_blank" rel="noopener noreferrer" className={btnClass} title="Website">
          <Globe className={iconSize} />
        </a>
      )}
      <a href={gmbUrl} target="_blank" rel="noopener noreferrer" className={btnClass} title="Google Maps">
        <MapPin className={iconSize} />
      </a>
      {prospect.linkedin_url && (
        <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className={cn(btnClass, 'hover:text-blue-400')} title="LinkedIn">
          <Linkedin className={iconSize} />
        </a>
      )}
      {prospect.facebook_url && (
        <a href={prospect.facebook_url} target="_blank" rel="noopener noreferrer" className={cn(btnClass, 'hover:text-blue-500')} title="Facebook">
          <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        </a>
      )}
      {prospect.instagram_url && (
        <a href={prospect.instagram_url} target="_blank" rel="noopener noreferrer" className={cn(btnClass, 'hover:text-pink-400')} title="Instagram">
          <svg className={iconSize} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C16.67.014 16.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </a>
      )}
    </div>
  );
}

// Format a date string for display
function formatShortDate(dateStr?: string | null): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
    email: prospect.email,
    website: prospect.website || '',
    niche: prospect.niche || '',
    notes: prospect.notes || '',
    linkedin_url: prospect.linkedin_url || '',
    facebook_url: prospect.facebook_url || '',
    instagram_url: prospect.instagram_url || '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      agency_name: form.agency_name,
      contact_name: form.contact_name || undefined,
      email: form.email,
      website: form.website || undefined,
      niche: form.niche || undefined,
      notes: form.notes || undefined,
      linkedin_url: form.linkedin_url || undefined,
      facebook_url: form.facebook_url || undefined,
      instagram_url: form.instagram_url || undefined,
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
          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-semibold text-[--exec-text]">
                Edit Prospect
              </h2>
              <p className="text-sm text-[--exec-text-muted] mt-1">
                Update prospect details
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Agency Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={form.agency_name}
                onChange={(e) => setForm({ ...form, agency_name: e.target.value })}
                className={inputClasses}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={form.contact_name}
                  onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                  className={inputClasses}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Email <span className="text-red-400">*</span>
                </label>
                <input
                  type="email"
                  value={form.email || ''}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={inputClasses}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  <Globe className="w-3.5 h-3.5 inline mr-1" />
                  Website
                </label>
                <input
                  type="url"
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  className={inputClasses}
                  placeholder="https://..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                  Niche
                </label>
                <input
                  type="text"
                  value={form.niche}
                  onChange={(e) => setForm({ ...form, niche: e.target.value })}
                  className={inputClasses}
                  placeholder="Roofing, Plumbing, etc."
                />
              </div>
            </div>

            {/* Social Links Section */}
            <div className="pt-4 border-t border-stone-700/30">
              <h3 className="text-sm font-semibold text-[--exec-text] mb-3 flex items-center">
                <Linkedin className="w-4 h-4 mr-2 text-[--exec-accent]" />
                Social Links
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    LinkedIn URL
                  </label>
                  <input
                    type="url"
                    value={form.linkedin_url}
                    onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })}
                    className={inputClasses}
                    placeholder="https://linkedin.com/in/..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Facebook URL
                    </label>
                    <input
                      type="url"
                      value={form.facebook_url}
                      onChange={(e) => setForm({ ...form, facebook_url: e.target.value })}
                      className={inputClasses}
                      placeholder="https://facebook.com/..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Instagram URL
                    </label>
                    <input
                      type="url"
                      value={form.instagram_url}
                      onChange={(e) => setForm({ ...form, instagram_url: e.target.value })}
                      className={inputClasses}
                      placeholder="https://instagram.com/..."
                    />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                Notes
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                className={cn(inputClasses, 'resize-none')}
                rows={3}
                placeholder="Any additional details..."
              />
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-stone-700/30 mt-6">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Delete this prospect? This cannot be undone.')) {
                    onDelete(prospect.id);
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-[--exec-text-secondary] bg-stone-700/50 rounded-lg hover:bg-stone-600/50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 text-sm font-medium text-white bg-[--exec-accent] rounded-lg hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
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

// Prospect card component for the Today queue
function ProspectCard({
  prospect,
  onMarkSent,
  onEdit,
}: {
  prospect: OutreachProspect;
  onMarkSent: () => void;
  onEdit: () => void;
}) {
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const isFollowUp = prospect.current_step > 1;

  return (
    <>
      <div className="bento-card p-5 hover:shadow-lg transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full flex-shrink-0',
                  isFollowUp ? 'bg-blue-500' : 'bg-green-500'
                )}
              />
              <h3 className="font-semibold text-[--exec-text] truncate">
                {prospect.agency_name}
              </h3>
              <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full flex-shrink-0">
                Step {prospect.current_step}/5
              </span>
            </div>

            {prospect.contact_name && (
              <p className="text-xs text-[--exec-text-muted] ml-[18px] mb-1">
                {prospect.contact_name}
              </p>
            )}

            <p className="text-sm text-[--exec-text-secondary] truncate mb-1">
              {prospect.email || <span className="text-amber-400 italic">Via contact form</span>}
            </p>

            {prospect.niche && (
              <p className="text-xs text-[--exec-text-muted] mb-2">
                {prospect.niche}
              </p>
            )}

            <ProspectLinks prospect={prospect} size="sm" />

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
            <StatusBadge status={prospect.status} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
          {prospect.email ? (
            <button
              onClick={() => setIsCopyModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-slate-600/50 text-slate-300',
                'hover:bg-slate-500 hover:text-white hover:scale-105',
                'active:scale-95'
              )}
            >
              <Copy className="w-4 h-4" />
              Copy Email
            </button>
          ) : prospect.website ? (
            <a
              href={prospect.website.startsWith('http') ? prospect.website : `https://${prospect.website}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-amber-600/50 text-amber-300',
                'hover:bg-amber-500 hover:text-white hover:scale-105',
                'active:scale-95'
              )}
            >
              <Globe className="w-4 h-4" />
              Open Website
            </a>
          ) : null}

          <button
            onClick={onMarkSent}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              'text-white',
              'hover:brightness-110 hover:scale-105 hover:shadow-lg',
              'active:scale-95'
            )}
            style={{ backgroundColor: 'var(--exec-accent)' }}
          >
            <Send className="w-4 h-4" />
            Mark Sent
          </button>

          {isFollowUp && (
            <button
              onClick={() => setIsResponseModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-green-600 text-white',
                'hover:bg-green-500 hover:scale-105 hover:shadow-lg',
                'active:scale-95'
              )}
            >
              <MessageSquare className="w-4 h-4" />
              They Replied
            </button>
          )}
        </div>
      </div>

      <CopyEmailModal
        isOpen={isCopyModalOpen}
        onClose={() => setIsCopyModalOpen(false)}
        prospect={prospect}
      />

      <ResponseOutcomeModal
        isOpen={isResponseModalOpen}
        onClose={() => setIsResponseModalOpen(false)}
        prospect={prospect}
      />
    </>
  );
}

// Today Queue component
function TodayQueue({
  prospects,
  onMarkSent,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onMarkSent: (prospectId: number) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Mail className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">
          No prospects to contact today
        </h3>
        <p className="text-[--exec-text-muted]">
          Check back tomorrow or import more prospects.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {prospects.map((prospect) => (
        <ProspectCard
          key={prospect.id}
          prospect={prospect}
          onMarkSent={() => onMarkSent(prospect.id)}
          onEdit={() => onEdit(prospect)}
        />
      ))}
    </div>
  );
}

// Single sent prospect card with its own modal state
function SentProspectCard({ prospect, onEdit }: { prospect: OutreachProspect; onEdit: () => void }) {
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);

  const daysUntilNext = prospect.next_action_date
    ? Math.ceil((new Date(prospect.next_action_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <>
      <div className="bento-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex-shrink-0" />
              <h3 className="font-semibold text-[--exec-text] truncate">
                {prospect.agency_name}
              </h3>
              <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full flex-shrink-0">
                Step {prospect.current_step}/5
              </span>
            </div>

            {prospect.contact_name && (
              <p className="text-xs text-[--exec-text-muted] ml-[18px] mb-1">
                {prospect.contact_name}
              </p>
            )}

            <p className="text-sm text-[--exec-text-secondary] truncate mb-1">
              {prospect.email || <span className="text-amber-400 italic">Via contact form</span>}
            </p>

            {prospect.niche && (
              <p className="text-xs text-[--exec-text-muted] mb-2">
                {prospect.niche}
              </p>
            )}

            <ProspectLinks prospect={prospect} size="sm" />

            <div className="flex items-center gap-3 mt-2 text-xs text-[--exec-text-muted]">
              {prospect.last_contacted_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Sent {formatShortDate(prospect.last_contacted_at)}
                </span>
              )}
              {prospect.next_action_date && (
                <span className={cn(
                  'flex items-center gap-1',
                  daysUntilNext !== null && daysUntilNext <= 0 && 'text-amber-400'
                )}>
                  <Calendar className="w-3 h-3" />
                  {daysUntilNext !== null && daysUntilNext <= 0
                    ? 'Follow-up due!'
                    : `Follow-up in ${daysUntilNext} day${daysUntilNext === 1 ? '' : 's'}`
                  }
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onEdit}
              className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
              title="Edit prospect"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <StatusBadge status={prospect.status} />
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
          <button
            onClick={() => setIsResponseModalOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              'bg-green-600 text-white',
              'hover:bg-green-500 hover:scale-105 hover:shadow-lg',
              'active:scale-95'
            )}
          >
            <MessageSquare className="w-4 h-4" />
            They Replied
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

// Sent / Waiting Prospects component - shows IN_SEQUENCE prospects
function SentProspects({ prospects, onEdit }: { prospects: OutreachProspect[]; onEdit: (prospect: OutreachProspect) => void }) {
  const sentProspects = prospects.filter(
    (p) => p.status === ProspectStatus.IN_SEQUENCE
  );

  if (sentProspects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Send className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">
          No emails sent yet
        </h3>
        <p className="text-[--exec-text-muted]">
          Mark prospects as sent from the Today queue to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {sentProspects.map((prospect) => (
        <SentProspectCard key={prospect.id} prospect={prospect} onEdit={() => onEdit(prospect)} />
      ))}
    </div>
  );
}

// All Prospects table component
function AllProspects({
  prospects,
  onMarkSent,
  onEdit,
}: {
  prospects: OutreachProspect[];
  onMarkSent: (prospectId: number) => void;
  onEdit: (prospect: OutreachProspect) => void;
}) {
  if (prospects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <Users className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">
          No prospects yet
        </h3>
        <p className="text-[--exec-text-muted]">
          Import a CSV or add prospects manually.
        </p>
      </div>
    );
  }

  return (
    <div className="bento-card overflow-hidden">
      <table className="min-w-full divide-y divide-[--exec-border]">
        <thead className="bg-[--exec-surface-alt]">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Agency
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Email
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Niche
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Step
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Next Action
            </th>
            <th className="px-6 py-3 text-right text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-[--exec-surface] divide-y divide-[--exec-border-subtle]">
          {prospects.map((prospect) => (
            <tr key={prospect.id} className="hover:bg-[--exec-surface-alt] transition-colors">
              <td className="px-6 py-4">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full flex-shrink-0',
                      prospect.current_step > 1 ? 'bg-blue-500' : 'bg-green-500'
                    )}
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium text-[--exec-text] block truncate">
                      {prospect.agency_name}
                    </span>
                    {prospect.contact_name && (
                      <span className="text-xs text-[--exec-text-muted] block truncate">
                        {prospect.contact_name}
                      </span>
                    )}
                    <div className="mt-1">
                      <ProspectLinks prospect={prospect} size="xs" />
                    </div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                {prospect.email || <span className="text-amber-400 italic">Via contact form</span>}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-muted]">
                {prospect.niche || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                {prospect.current_step}/5
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={prospect.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-[--exec-text-muted]">
                  {prospect.next_action_date
                    ? new Date(prospect.next_action_date).toLocaleDateString()
                    : '-'}
                </div>
                {prospect.last_contacted_at && (
                  <div className="text-xs text-[--exec-text-muted] mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Sent {formatShortDate(prospect.last_contacted_at)}
                  </div>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
                <div className="flex items-center justify-end gap-2">
                  <button
                    onClick={() => onEdit(prospect)}
                    className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] rounded-lg transition-colors"
                    title="Edit prospect"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {prospect.status === ProspectStatus.IN_SEQUENCE && (
                    <button
                      onClick={() => onMarkSent(prospect.id)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200',
                        'text-white',
                        'hover:brightness-110 hover:scale-105',
                        'active:scale-95'
                      )}
                      style={{ backgroundColor: 'var(--exec-accent)' }}
                    >
                      Mark Sent
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Replied Prospects component
function RepliedProspects({ prospects, onEdit }: { prospects: OutreachProspect[]; onEdit: (prospect: OutreachProspect) => void }) {
  const repliedProspects = prospects.filter(
    (p) =>
      p.status === ProspectStatus.REPLIED ||
      p.status === ProspectStatus.CONVERTED ||
      p.status === ProspectStatus.NOT_INTERESTED
  );

  if (repliedProspects.length === 0) {
    return (
      <div className="bento-card p-12 text-center">
        <MessageSquare className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">
          No replies yet
        </h3>
        <p className="text-[--exec-text-muted]">
          Keep reaching out! Replies will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {repliedProspects.map((prospect) => (
        <div key={prospect.id} className="bento-card p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-semibold text-[--exec-text] truncate">
                  {prospect.agency_name}
                </h3>
              </div>
              {prospect.contact_name && (
                <p className="text-xs text-[--exec-text-muted] mb-1">
                  {prospect.contact_name}
                </p>
              )}
              <p className="text-sm text-[--exec-text-secondary] truncate mb-2">
                {prospect.email || <span className="text-amber-400 italic">Via contact form</span>}
              </p>
              {prospect.niche && (
                <p className="text-xs text-[--exec-text-muted] mb-2">
                  {prospect.niche}
                </p>
              )}
              <ProspectLinks prospect={prospect} size="sm" />
              {prospect.notes && (
                <p className="text-xs text-[--exec-text-muted] line-clamp-2 mt-2">
                  {prospect.notes}
                </p>
              )}
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
                title="Edit prospect"
              >
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

export default function EmailCampaignsTab() {
  // State
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);
  const [editingProspect, setEditingProspect] = useState<OutreachProspect | null>(null);

  const queryClient = useQueryClient();

  // Queries
  const { data: campaigns = [] } = useQuery<OutreachCampaign[]>({
    queryKey: ['outreach-campaigns'],
    queryFn: coldOutreachApi.getCampaigns,
  });

  const { data: campaignWithStats } = useQuery<CampaignWithStats>({
    queryKey: ['outreach-campaign', selectedCampaignId],
    queryFn: () => coldOutreachApi.getCampaign(selectedCampaignId!),
    enabled: !!selectedCampaignId,
  });

  const { data: todayQueue = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['outreach-today-queue', selectedCampaignId],
    queryFn: () => coldOutreachApi.getTodayQueue(selectedCampaignId!),
    enabled: !!selectedCampaignId && activeTab === 'today',
  });

  const { data: allProspects = [] } = useQuery<OutreachProspect[]>({
    queryKey: ['outreach-prospects', selectedCampaignId],
    queryFn: () => coldOutreachApi.getProspects(selectedCampaignId!),
    enabled: !!selectedCampaignId && (activeTab === 'all' || activeTab === 'replied' || activeTab === 'sent'),
  });

  // Mutations
  const markSentMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.markSent(prospectId),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
    },
    onError: () => {
      toast.error('Failed to mark as sent');
    },
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (campaignId: number) => coldOutreachApi.deleteCampaign(campaignId),
    onSuccess: () => {
      toast.success('Campaign deleted');
      queryClient.invalidateQueries({ queryKey: ['outreach-campaigns'] });
      if (selectedCampaignId === deleteCampaignMutation.variables) {
        setSelectedCampaignId(null);
      }
    },
    onError: () => {
      toast.error('Failed to delete campaign');
    },
  });

  const updateProspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OutreachProspect> }) =>
      coldOutreachApi.updateProspect(id, data),
    onSuccess: () => {
      toast.success('Prospect updated');
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      setEditingProspect(null);
    },
    onError: () => {
      toast.error('Failed to update prospect');
    },
  });

  const deleteProspectMutation = useMutation({
    mutationFn: (prospectId: number) => coldOutreachApi.deleteProspect(prospectId),
    onSuccess: () => {
      toast.success('Prospect deleted');
      queryClient.invalidateQueries({ queryKey: ['outreach-today-queue'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-prospects'] });
      queryClient.invalidateQueries({ queryKey: ['outreach-campaign'] });
      setEditingProspect(null);
    },
    onError: () => {
      toast.error('Failed to delete prospect');
    },
  });

  // Handlers
  const handleMarkSent = (prospectId: number) => {
    markSentMutation.mutate(prospectId);
  };

  const handleDeleteCampaign = (e: React.MouseEvent, campaignId: number) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this campaign? This will also delete all prospects in this campaign.')) {
      deleteCampaignMutation.mutate(campaignId);
    }
  };

  const handleEditCampaign = (e: React.MouseEvent, campaign: OutreachCampaign) => {
    e.stopPropagation();
    setEditingCampaign(campaign);
    setIsCampaignDropdownOpen(false);
  };

  // Auto-select first campaign if none selected
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
            <Mail className="w-4 h-4 text-[--exec-text-muted]" />
            <span className="flex-1 text-left truncate">
              {selectedCampaignId
                ? campaigns.find((c) => c.id === selectedCampaignId)?.name || 'Select Campaign'
                : 'Select Campaign'}
            </span>
            <ChevronDown
              className={cn(
                'w-4 h-4 text-[--exec-text-muted] transition-transform duration-200',
                isCampaignDropdownOpen && 'rotate-180'
              )}
            />
          </button>

          {isCampaignDropdownOpen && (
            <div
              className="absolute top-full left-0 mt-2 w-full min-w-[280px] py-2 rounded-xl border border-[--exec-border] shadow-2xl z-[100]"
              style={{ backgroundColor: '#1C1917' }}
            >
              {campaigns.length === 0 ? (
                <div className="px-4 py-3 text-sm text-[--exec-text-muted]">
                  No campaigns yet
                </div>
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
                        selectedCampaignId === campaign.id
                          ? 'text-[--exec-accent] font-medium'
                          : 'text-[--exec-text]'
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

        {/* Action buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsNewCampaignOpen(true)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 rounded-xl',
              'text-white',
              'hover:brightness-110 hover:scale-105 hover:shadow-lg',
              'active:scale-95 transition-all duration-200',
              'shadow-sm font-medium text-sm'
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

          <button
            onClick={() => {
              if (!selectedCampaignId) {
                toast.error('Please select a campaign first');
                return;
              }
              setIsTemplatesOpen(true);
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
            <FileText className="w-4 h-4" />
            Templates
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-8 py-4 relative z-10">
        {/* Stats Bar */}
        {selectedCampaignId && stats && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[--exec-accent-bg] flex items-center justify-center">
                  <Mail className="w-5 h-5 text-[--exec-accent]" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">
                    {stats.to_contact_today}
                  </p>
                  <p className="text-xs text-[--exec-text-muted]">To Contact Today</p>
                </div>
              </div>
            </div>

            <div className="bento-card p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Send className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[--exec-text]">
                    {stats.in_sequence}
                  </p>
                  <p className="text-xs text-[--exec-text-muted]">Emails Sent</p>
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
                    <span className="text-sm font-normal text-[--exec-text-muted]">
                      ({stats.response_rate.toFixed(1)}%)
                    </span>
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
                  <p className="text-2xl font-bold text-[--exec-text]">
                    {stats.converted}
                  </p>
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
              {(['today', 'sent', 'all', 'replied'] as const).map((tab) => (
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
                  {tab === 'sent' && 'Sent'}
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
              <TodayQueue
                prospects={todayQueue}
                onMarkSent={handleMarkSent}
                onEdit={setEditingProspect}
              />
            )}
            {activeTab === 'sent' && <SentProspects prospects={allProspects} onEdit={setEditingProspect} />}
            {activeTab === 'all' && (
              <AllProspects prospects={allProspects} onMarkSent={handleMarkSent} onEdit={setEditingProspect} />
            )}
            {activeTab === 'replied' && <RepliedProspects prospects={allProspects} onEdit={setEditingProspect} />}
          </div>
        ) : (
          <div className="bento-card p-12 text-center">
            <Mail className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-4" />
            <h3 className="text-lg font-medium text-[--exec-text] mb-2">
              Select a campaign to get started
            </h3>
            <p className="text-[--exec-text-muted] mb-4">
              Choose an existing campaign from the dropdown or create a new one.
            </p>
            <button
              onClick={() => setIsNewCampaignOpen(true)}
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl',
                'text-white',
                'hover:brightness-110 hover:scale-105 hover:shadow-lg',
                'active:scale-95 transition-all duration-200',
                'shadow-sm font-medium text-sm'
              )}
              style={{ backgroundColor: 'var(--exec-accent)' }}
            >
              <Plus className="w-4 h-4" />
              Create Campaign
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
      />

      {selectedCampaignId && (
        <CsvImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          campaignId={selectedCampaignId}
        />
      )}

      {selectedCampaignId && (
        <EmailTemplatesModal
          isOpen={isTemplatesOpen}
          onClose={() => setIsTemplatesOpen(false)}
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
    </>
  );
}
