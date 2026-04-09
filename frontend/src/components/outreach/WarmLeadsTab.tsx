import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { nurtureApi, coldOutreachApi } from '@/lib/api';
import type { NurtureLead, OutreachProspect } from '@/types';
import { NurtureStatus, FollowupStage } from '@/types';
import CopyEmailModal from '@/components/CopyEmailModal';
import NurtureLeadDetail from '@/components/NurtureLeadDetail';
import {
  Heart,
  Users,
  Clock,
  TrendingUp,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  ArrowRight,
  Linkedin,
  Globe,
  MapPin,
  Mail,
  Edit2,
  UserCheck,
  X,
  Plus,
  Instagram,
  Facebook,
  Music,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { inputClasses, primaryButtonClasses, secondaryButtonClasses, iconButtonClasses } from '@/lib/outreachStyles';

const NURTURE_STEPS = [
  { step: 1, name: 'Reply with value', color: 'blue' },
  { step: 2, name: 'Free goodwill offer', color: 'purple' },
  { step: 3, name: 'Deliver the free thing', color: 'amber' },
  { step: 4, name: 'Book a call', color: 'green' },
  { step: 5, name: 'Make the offer / close', color: 'emerald' },
] as const;

const STEP_BORDER_COLORS: Record<number, string> = {
  1: 'border-t-blue-500',
  2: 'border-t-purple-500',
  3: 'border-t-amber-500',
  4: 'border-t-green-500',
  5: 'border-t-emerald-500',
};

const STEP_TEXT_COLORS: Record<number, string> = {
  1: 'text-blue-400',
  2: 'text-purple-400',
  3: 'text-amber-400',
  4: 'text-green-400',
  5: 'text-emerald-400',
};

const STEP_COUNT_BADGE_COLORS: Record<number, string> = {
  1: 'bg-blue-500/20 text-blue-400',
  2: 'bg-purple-500/20 text-purple-400',
  3: 'bg-amber-500/20 text-amber-400',
  4: 'bg-green-500/20 text-green-400',
  5: 'bg-emerald-500/20 text-emerald-400',
};

const CHANNEL_OPTIONS = [
  { value: 'EMAIL', label: 'Email', short: 'Em', icon: Mail, activeBg: 'bg-purple-500/30', activeText: 'text-purple-400' },
  { value: 'LINKEDIN', label: 'LinkedIn', short: 'LI', icon: Linkedin, activeBg: 'bg-blue-500/30', activeText: 'text-blue-400' },
  { value: 'TIKTOK', label: 'TikTok', short: 'TT', icon: Music, activeBg: 'bg-pink-500/30', activeText: 'text-pink-400' },
  { value: 'INSTAGRAM', label: 'Instagram', short: 'IG', icon: Instagram, activeBg: 'bg-fuchsia-500/30', activeText: 'text-fuchsia-400' },
  { value: 'FACEBOOK', label: 'Facebook', short: 'FB', icon: Facebook, activeBg: 'bg-sky-500/30', activeText: 'text-sky-400' },
] as const;

const FOLLOWUP_PRIORITY: Record<FollowupStage, number> = {
  [FollowupStage.DAY_10]: 0,
  [FollowupStage.DAY_5]: 1,
  [FollowupStage.DAY_2]: 2,
  [FollowupStage.LONG_TERM]: 3,
};

function getFollowupUrgency(stage: FollowupStage | null): {
  dotColor: string;
  label: string;
} {
  if (stage === null) {
    return { dotColor: 'bg-green-500', label: 'On track' };
  }
  switch (stage) {
    case FollowupStage.DAY_2:
    case FollowupStage.DAY_5:
      return { dotColor: 'bg-yellow-500', label: 'Check-in due' };
    case FollowupStage.DAY_10:
      return { dotColor: 'bg-red-500', label: 'Re-engage' };
    case FollowupStage.LONG_TERM:
      return { dotColor: 'bg-gray-500', label: 'Long-term' };
    default:
      return { dotColor: 'bg-green-500', label: 'On track' };
  }
}

function getFollowupStageBadge(stage: FollowupStage): {
  bg: string;
  text: string;
  label: string;
} {
  switch (stage) {
    case FollowupStage.DAY_2:
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Day 2' };
    case FollowupStage.DAY_5:
      return { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: 'Day 5' };
    case FollowupStage.DAY_10:
      return { bg: 'bg-red-500/20', text: 'text-red-400', label: 'Day 10' };
    case FollowupStage.LONG_TERM:
      return { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'Long-term' };
  }
}

function daysSince(dateStr: string): number {
  const then = new Date(dateStr);
  const now = new Date();
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24)));
}

function EditProspectInlineModal({
  prospect,
  onClose,
  onSave,
  isSaving,
}: {
  prospect: OutreachProspect;
  onClose: () => void;
  onSave: (data: Partial<OutreachProspect>) => void;
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

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={onClose}>
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 transform transition-all animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-[--exec-text]">Edit Prospect</h2>
            <button onClick={onClose} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); onSave(form); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Company Name</label>
              <input className={inputClasses} value={form.agency_name} onChange={(e) => setForm({ ...form, agency_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Contact Name</label>
              <input className={inputClasses} value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Email</label>
              <input className={inputClasses} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Website</label>
              <input className={inputClasses} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">LinkedIn URL</label>
              <input className={inputClasses} value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Niche</label>
              <input className={inputClasses} value={form.niche} onChange={(e) => setForm({ ...form, niche: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Notes</label>
              <textarea className={cn(inputClasses, 'resize-none')} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
              <button type="button" onClick={onClose} className={secondaryButtonClasses}>
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className={primaryButtonClasses}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function WarmLeadsTab() {
  const queryClient = useQueryClient();
  const [selectedLeadId, setSelectedLeadId] = useState<number | null>(null);
  const [followupOpen, setFollowupOpen] = useState(true);
  const [emailModalProspect, setEmailModalProspect] = useState<OutreachProspect | null>(null);
  const [editingProspect, setEditingProspect] = useState<OutreachProspect | null>(null);
  const [isAddLeadOpen, setIsAddLeadOpen] = useState(false);
  const [addLeadForm, setAddLeadForm] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    website: '',
    linkedin_url: '',
    niche: '',
    source_channel: 'EMAIL',
    notes: '',
  });

  const createManualMutation = useMutation({
    mutationFn: (data: typeof addLeadForm) => nurtureApi.createManual(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
      queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
      toast.success('Warm lead added');
      setIsAddLeadOpen(false);
      setAddLeadForm({ company_name: '', contact_name: '', email: '', website: '', linkedin_url: '', niche: '', source_channel: 'EMAIL', notes: '' });
    },
    onError: () => toast.error('Failed to add warm lead'),
  });

  const fetchProspect = async (lead: NurtureLead): Promise<OutreachProspect | null> => {
    try {
      const prospects = await coldOutreachApi.getProspects(lead.campaign_id);
      return prospects.find((p: OutreachProspect) => p.id === lead.prospect_id) ?? null;
    } catch {
      return null;
    }
  };

  const handleViewEmail = async (lead: NurtureLead) => {
    try {
      const prospects = await coldOutreachApi.getProspects(lead.campaign_id);
      const prospect = prospects.find((p: OutreachProspect) => p.id === lead.prospect_id);
      if (prospect) {
        setEmailModalProspect(prospect);
      }
    } catch {
      // Fallback: just open mailto
      if (lead.prospect_email) {
        window.open(`mailto:${lead.prospect_email}`);
      }
    }
  };

  // Queries
  const { data: stats } = useQuery({
    queryKey: ['nurture-stats'],
    queryFn: nurtureApi.getStats,
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['nurture-leads'],
    queryFn: () => nurtureApi.getLeads(),
  });

  // Mutations
  const completeStepMutation = useMutation({
    mutationFn: (leadId: number) => nurtureApi.completeStep(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
      queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
      toast.success('Step completed');
    },
  });

  const logFollowupMutation = useMutation({
    mutationFn: (leadId: number) => nurtureApi.logFollowup(leadId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
      queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
      toast.success('Follow-up logged');
    },
  });

  // Drag-and-drop state
  const [draggedLeadId, setDraggedLeadId] = useState<number | null>(null);
  const [dragOverStep, setDragOverStep] = useState<number | null>(null);

  const moveLeadMutation = useMutation({
    mutationFn: ({ id, step }: { id: number; step: number }) =>
      nurtureApi.updateLead(id, { current_step: step }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ['nurture-leads'] });
      queryClient.setQueryData<NurtureLead[]>(['nurture-leads'], (old) =>
        old?.map((l) => l.id === variables.id ? { ...l, current_step: variables.step } : l)
      );
      toast.success('Lead moved');
      return {};
    },
    onError: () => {
      toast.error('Failed to move lead');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
      queryClient.invalidateQueries({ queryKey: ['nurture-stats'] });
    },
  });

  const handleDragStart = (e: React.DragEvent, lead: NurtureLead) => {
    e.dataTransfer.setData('text/plain', String(lead.id));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedLeadId(lead.id);
  };

  const handleDragEnd = () => {
    setDraggedLeadId(null);
    setDragOverStep(null);
  };

  const handleDragOver = (e: React.DragEvent, step: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStep !== step) setDragOverStep(step);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverStep(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetStep: number) => {
    e.preventDefault();
    setDragOverStep(null);
    setDraggedLeadId(null);
    const leadId = Number(e.dataTransfer.getData('text/plain'));
    if (!leadId) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.current_step === targetStep) return;
    moveLeadMutation.mutate({ id: leadId, step: targetStep });
  };

  const updateProspectMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<OutreachProspect> }) =>
      coldOutreachApi.updateProspect(id, data),
    onSuccess: () => {
      setEditingProspect(null);
      queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
      toast.success('Prospect updated');
    },
    onError: () => toast.error('Failed to update prospect'),
  });

  // Derived data
  const kanbanLeads = leads.filter(
    (l) => l.status === NurtureStatus.ACTIVE || l.status === NurtureStatus.QUIET
  );

  const leadsByStep: Record<number, NurtureLead[]> = {};
  for (const step of NURTURE_STEPS) {
    leadsByStep[step.step] = kanbanLeads.filter((l) => l.current_step === step.step);
  }

  const followupLeads = leads
    .filter((l) => l.followup_stage !== null)
    .sort((a, b) => {
      const pa = FOLLOWUP_PRIORITY[a.followup_stage!];
      const pb = FOLLOWUP_PRIORITY[b.followup_stage!];
      return pa - pb;
    });

  const handleSelectLead = (lead: NurtureLead) => {
    setSelectedLeadId(lead.id);
  };

  // Empty state
  if (!isLoading && leads.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Heart className="w-12 h-12 text-stone-600 mb-4" />
        <h3 className="text-lg font-medium text-[--exec-text] mb-2">No warm leads yet</h3>
        <p className="text-[--exec-text-muted] text-sm text-center max-w-md">
          Mark a prospect as Interested to start nurturing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-stone-800/50 border border-stone-600/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Active
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-400">{stats?.active ?? 0}</p>
        </div>

        <div className="bg-stone-800/50 border border-stone-600/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertCircle
              className={cn(
                'w-4 h-4',
                (stats?.needs_followup ?? 0) > 0 ? 'text-red-400' : 'text-stone-500'
              )}
            />
            <span className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Needs Follow-up
            </span>
          </div>
          <p
            className={cn(
              'text-2xl font-bold',
              (stats?.needs_followup ?? 0) > 0 ? 'text-red-400' : 'text-stone-500'
            )}
          >
            {stats?.needs_followup ?? 0}
          </p>
        </div>

        <div className="bg-stone-800/50 border border-stone-600/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Long-term
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-400">{stats?.long_term ?? 0}</p>
        </div>

        <div className="bg-stone-800/50 border border-stone-600/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-green-400" />
            <span className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
              Converted
            </span>
          </div>
          <p className="text-2xl font-bold text-green-400">{stats?.converted ?? 0}</p>
        </div>
      </div>

      {/* Kanban Pipeline */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-[--exec-text]">Nurture Pipeline</h3>
          <button
            onClick={() => setIsAddLeadOpen(true)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
              'text-white transition-all duration-200 shadow-sm hover:shadow-md hover:brightness-110'
            )}
            style={{ backgroundColor: 'var(--exec-accent)' }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Warm Lead
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {NURTURE_STEPS.map((step) => {
            const columnLeads = leadsByStep[step.step] ?? [];
            return (
              <div
                key={step.step}
                onDragOver={(e) => handleDragOver(e, step.step)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, step.step)}
                className={cn(
                  'bg-stone-900/30 rounded-xl p-3 min-w-[220px] flex-1',
                  'border-t-2 transition-all',
                  STEP_BORDER_COLORS[step.step],
                  dragOverStep === step.step && 'ring-2 ring-[--exec-accent]/40 bg-stone-800/40'
                )}
              >
                {/* Column Header */}
                <div className="flex items-center justify-between mb-3">
                  <span className={cn('text-xs font-semibold', STEP_TEXT_COLORS[step.step])}>
                    {step.name}
                  </span>
                  <span
                    className={cn(
                      'text-xs font-medium px-1.5 py-0.5 rounded-full',
                      STEP_COUNT_BADGE_COLORS[step.step]
                    )}
                  >
                    {columnLeads.length}
                  </span>
                </div>

                {/* Lead Cards */}
                <div className="space-y-2">
                  {columnLeads.map((lead) => {
                    const urgency = getFollowupUrgency(lead.followup_stage);
                    const daysInStep = daysSince(lead.last_action_at);

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead)}
                        onDragEnd={handleDragEnd}
                        onClick={() => handleSelectLead(lead)}
                        className={cn(
                          'bg-stone-800/50 border rounded-lg p-4 cursor-grab active:cursor-grabbing transition-all group',
                          selectedLeadId === lead.id
                            ? 'border-[--exec-accent] shadow-md'
                            : 'border-stone-600/40 hover:border-stone-500/60 hover:shadow-lg',
                          draggedLeadId === lead.id && 'opacity-50 scale-95 ring-2 ring-blue-500/40'
                        )}
                      >
                        {/* Action buttons row */}
                        <div className="flex items-center justify-center gap-0.5 mb-2 flex-wrap">
                          {lead.prospect_email && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewEmail(lead);
                              }}
                              className="p-1.5 text-[--exec-text-muted] hover:text-blue-400 hover:bg-blue-500/15 rounded-lg transition-colors"
                              title="View email"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const newValue = !lead.prospect_linkedin_connected;
                              // Optimistic update
                              queryClient.setQueryData<NurtureLead[]>(['nurture-leads'], (old) =>
                                old?.map((l) => l.id === lead.id ? { ...l, prospect_linkedin_connected: newValue } : l)
                              );
                              try {
                                await coldOutreachApi.updateProspect(lead.prospect_id, {
                                  linkedin_connected: newValue,
                                } as Partial<OutreachProspect>);
                                toast.success(newValue ? 'LinkedIn connected' : 'LinkedIn disconnected');
                              } catch {
                                // Rollback
                                queryClient.setQueryData<NurtureLead[]>(['nurture-leads'], (old) =>
                                  old?.map((l) => l.id === lead.id ? { ...l, prospect_linkedin_connected: !newValue } : l)
                                );
                                toast.error('Failed to update LinkedIn status');
                              }
                              queryClient.invalidateQueries({ queryKey: ['nurture-leads'] });
                            }}
                            className={cn(
                              'p-1.5 rounded-lg transition-colors',
                              lead.prospect_linkedin_connected
                                ? 'text-emerald-400 bg-emerald-500/15'
                                : 'text-[--exec-text-muted] hover:text-emerald-400 hover:bg-emerald-500/15'
                            )}
                            title={lead.prospect_linkedin_connected ? 'LinkedIn connected (click to undo)' : 'Mark LinkedIn connected'}
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const prospect = await fetchProspect(lead);
                              if (prospect) {
                                setEditingProspect(prospect);
                              } else {
                                handleSelectLead(lead);
                              }
                            }}
                            className={iconButtonClasses}
                            title="Edit prospect"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {/* Company name */}
                        <h4 className="text-sm font-semibold text-[--exec-text] line-clamp-2 leading-tight mb-1">
                          {lead.prospect_name ?? 'Unknown'}
                        </h4>

                        {/* Contact name */}
                        {lead.prospect_contact_name && (
                          <p className="text-xs text-[--exec-text-muted] truncate mb-2">{lead.prospect_contact_name}</p>
                        )}

                        {/* Campaign + Channel toggle */}
                        <div className="flex flex-wrap items-center gap-1 mb-2">
                          {lead.campaign_name && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-stone-700/60 text-[--exec-text-muted] truncate max-w-[140px]">
                              {lead.campaign_name}
                            </span>
                          )}
                          {/* Channel toggle */}
                          <div className="flex items-center bg-stone-700/40 rounded-full p-0.5">
                            {CHANNEL_OPTIONS.map((ch) => {
                              const isActive = lead.source_channel?.toUpperCase() === ch.value;
                              return (
                                <button
                                  key={ch.value}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isActive) return;
                                    queryClient.setQueryData<NurtureLead[]>(['nurture-leads'], (old) =>
                                      old?.map((l) => l.id === lead.id ? { ...l, source_channel: ch.value } : l)
                                    );
                                    nurtureApi.updateLead(lead.id, { source_channel: ch.value });
                                  }}
                                  className={cn(
                                    'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium transition-colors',
                                    isActive
                                      ? `${ch.activeBg} ${ch.activeText}`
                                      : `text-[--exec-text-muted] hover:${ch.activeText}`
                                  )}
                                  title={`Communicating via ${ch.label}`}
                                >
                                  <ch.icon className="w-2.5 h-2.5" />
                                  {ch.short}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Days in step + urgency */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-[--exec-text-muted]">
                            {daysInStep}d in step
                          </span>
                          <div className="flex items-center gap-1.5">
                            <div className={cn('w-2 h-2 rounded-full', urgency.dotColor)} />
                            <span className="text-xs text-[--exec-text-muted]">
                              {urgency.label}
                            </span>
                          </div>
                        </div>

                        {/* Links row */}
                        <div className="pt-2 border-t border-stone-700/30">
                          <div className="flex items-center gap-1">
                            {lead.prospect_linkedin_url && (
                              <a
                                href={lead.prospect_linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[--exec-text-muted] hover:text-blue-400 hover:bg-[--exec-surface-alt] transition-colors"
                                title="LinkedIn"
                              >
                                <Linkedin className="w-3.5 h-3.5" />
                              </a>
                            )}
                            {lead.prospect_website && (
                              <a
                                href={lead.prospect_website.startsWith('http') ? lead.prospect_website : `https://${lead.prospect_website}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] transition-colors"
                                title="Website"
                              >
                                <Globe className="w-3.5 h-3.5" />
                              </a>
                            )}
                            <a
                              href={`https://www.google.com/maps/search/${encodeURIComponent(lead.prospect_name ?? '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface-alt] transition-colors"
                              title="Google Maps"
                            >
                              <MapPin className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Complete Step Button */}
                        {step.step < 5 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              completeStepMutation.mutate(lead.id);
                            }}
                            disabled={completeStepMutation.isPending}
                            className={cn(
                              'mt-2 w-full flex items-center justify-center gap-1.5',
                              'px-2.5 py-1.5 rounded-lg text-xs font-medium',
                              'bg-stone-700/50 text-[--exec-text-secondary]',
                              'hover:bg-stone-600/50 transition-colors',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <ArrowRight className="w-3 h-3" />
                            Complete Step
                          </button>
                        )}
                        {step.step === 5 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              completeStepMutation.mutate(lead.id);
                            }}
                            disabled={completeStepMutation.isPending}
                            className={cn(
                              'mt-2 w-full flex items-center justify-center gap-1.5',
                              'px-2.5 py-1.5 rounded-lg text-xs font-medium',
                              'bg-emerald-500/20 text-emerald-400',
                              'hover:bg-emerald-500/30 transition-colors',
                              'disabled:opacity-50 disabled:cursor-not-allowed'
                            )}
                          >
                            <CheckCircle className="w-3 h-3" />
                            Close Deal
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {columnLeads.length === 0 && (
                    <p className="text-xs text-[--exec-text-muted] text-center py-4 italic">
                      No leads
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Copy Email Modal */}
      {emailModalProspect && (
        <CopyEmailModal
          isOpen={true}
          onClose={() => setEmailModalProspect(null)}
          prospect={emailModalProspect}
          campaignId={emailModalProspect.campaign_id}
        />
      )}

      {/* Edit Prospect Modal */}
      {editingProspect && (
        <EditProspectInlineModal
          prospect={editingProspect}
          onClose={() => setEditingProspect(null)}
          onSave={(data) => updateProspectMutation.mutate({ id: editingProspect.id, data })}
          isSaving={updateProspectMutation.isPending}
        />
      )}

      {/* Nurture Lead Detail Panel (contains Not Interested action) */}
      {selectedLeadId !== null && (() => {
        const selectedLead = leads.find((l) => l.id === selectedLeadId);
        if (!selectedLead) return null;
        return (
          <NurtureLeadDetail
            lead={selectedLead}
            isOpen={true}
            onClose={() => setSelectedLeadId(null)}
          />
        );
      })()}

      {/* Follow-up Section */}
      {followupLeads.length > 0 && (
        <div className="bg-stone-800/50 border border-stone-600/40 rounded-xl overflow-hidden">
          {/* Header */}
          <button
            onClick={() => setFollowupOpen((prev) => !prev)}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-stone-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              {followupOpen ? (
                <ChevronDown className="w-4 h-4 text-[--exec-text-muted]" />
              ) : (
                <ChevronRight className="w-4 h-4 text-[--exec-text-muted]" />
              )}
              <span className="text-sm font-semibold text-[--exec-text]">Needs Follow-up</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                {followupLeads.length}
              </span>
            </div>
          </button>

          {/* Rows */}
          {followupOpen && (
            <div className="border-t border-stone-700/30 divide-y divide-stone-700/30">
              {followupLeads.map((lead) => {
                const stepInfo = NURTURE_STEPS.find((s) => s.step === lead.current_step);
                const stageBadge = getFollowupStageBadge(lead.followup_stage!);
                const daysSinceAction = daysSince(lead.last_action_at);

                return (
                  <div
                    key={lead.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-stone-700/20 transition-colors"
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Name */}
                      <span className="text-sm font-medium text-[--exec-text] truncate min-w-[120px]">
                        {lead.prospect_name ?? 'Unknown'}
                      </span>

                      {/* Current Step */}
                      {stepInfo && (
                        <span
                          className={cn(
                            'text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap',
                            STEP_COUNT_BADGE_COLORS[stepInfo.step]
                          )}
                        >
                          Step {stepInfo.step}: {stepInfo.name}
                        </span>
                      )}

                      {/* Follow-up Stage Badge */}
                      <span
                        className={cn(
                          'px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap',
                          stageBadge.bg,
                          stageBadge.text
                        )}
                      >
                        {stageBadge.label}
                      </span>

                      {/* Days since last action */}
                      <span className="text-xs text-[--exec-text-muted] whitespace-nowrap">
                        {daysSinceAction}d ago
                      </span>
                    </div>

                    {/* Done button */}
                    <button
                      onClick={() => logFollowupMutation.mutate(lead.id)}
                      disabled={logFollowupMutation.isPending}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium',
                        'bg-stone-700/50 text-[--exec-text-secondary]',
                        'hover:bg-stone-600/50 transition-colors',
                        'disabled:opacity-50 disabled:cursor-not-allowed'
                      )}
                    >
                      <CheckCircle className="w-3 h-3" />
                      Done
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Add Warm Lead Modal */}
      {isAddLeadOpen && createPortal(
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200" onClick={() => setIsAddLeadOpen(false)}>
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-lg mx-4 border border-stone-600/40 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-[--exec-text]">Add Warm Lead</h2>
                  <p className="text-sm text-[--exec-text-muted] mt-1">Add a lead directly to the nurture pipeline</p>
                </div>
                <button onClick={() => setIsAddLeadOpen(false)} className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); if (addLeadForm.company_name.trim()) createManualMutation.mutate(addLeadForm); }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Company Name <span className="text-red-400">*</span></label>
                  <input className={inputClasses} value={addLeadForm.company_name} onChange={(e) => setAddLeadForm({ ...addLeadForm, company_name: e.target.value })} placeholder="Company name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Contact Name</label>
                  <input className={inputClasses} value={addLeadForm.contact_name} onChange={(e) => setAddLeadForm({ ...addLeadForm, contact_name: e.target.value })} placeholder="Contact person" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Email</label>
                    <input className={inputClasses} value={addLeadForm.email} onChange={(e) => setAddLeadForm({ ...addLeadForm, email: e.target.value })} placeholder="email@company.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Channel</label>
                    <select className={inputClasses} value={addLeadForm.source_channel} onChange={(e) => setAddLeadForm({ ...addLeadForm, source_channel: e.target.value })}>
                      {CHANNEL_OPTIONS.map((ch) => (
                        <option key={ch.value} value={ch.value}>{ch.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Website</label>
                  <input className={inputClasses} value={addLeadForm.website} onChange={(e) => setAddLeadForm({ ...addLeadForm, website: e.target.value })} placeholder="https://company.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">LinkedIn URL</label>
                  <input className={inputClasses} value={addLeadForm.linkedin_url} onChange={(e) => setAddLeadForm({ ...addLeadForm, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">Notes</label>
                  <textarea className={cn(inputClasses, 'resize-none')} rows={3} value={addLeadForm.notes} onChange={(e) => setAddLeadForm({ ...addLeadForm, notes: e.target.value })} placeholder="Context about this lead..." />
                </div>

                <div className="flex gap-3 justify-end pt-4 border-t border-stone-700/30 mt-6">
                  <button type="button" onClick={() => setIsAddLeadOpen(false)} className={secondaryButtonClasses}>
                    Cancel
                  </button>
                  <button type="submit" disabled={!addLeadForm.company_name.trim() || createManualMutation.isPending} className={primaryButtonClasses}>
                    {createManualMutation.isPending ? 'Adding...' : 'Add to Pipeline'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
