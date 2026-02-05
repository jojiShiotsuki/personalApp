import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { discoveryCallApi, contactApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Phone,
  Calendar,
  User,
  CheckCircle2,
  Clock,
  DollarSign,
  ChevronRight,
  Plus,
  X,
  Loader2,
  AlertTriangle,
  Send,
  Ban,
  HelpCircle,
  CalendarClock,
} from 'lucide-react';
import type { DiscoveryCall, DiscoveryCallCreate, CallOutcome, Contact } from '@/types';
import { useState } from 'react';
import { format, parseISO } from 'date-fns';

const OUTCOME_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  scheduled_followup: { label: 'Follow-up Scheduled', icon: CalendarClock, color: '--exec-info' },
  sent_proposal: { label: 'Proposal Sent', icon: Send, color: '--exec-accent' },
  not_a_fit: { label: 'Not a Fit', icon: Ban, color: '--exec-text-muted' },
  needs_more_info: { label: 'Needs Info', icon: HelpCircle, color: '--exec-warning' },
  closed_deal: { label: 'Deal Closed!', icon: CheckCircle2, color: '--exec-sage' },
  no_show: { label: 'No Show', icon: AlertTriangle, color: '--exec-error' },
  rescheduled: { label: 'Rescheduled', icon: Calendar, color: '--exec-info' },
};

interface CallCardProps {
  call: DiscoveryCall;
}

function SpinProgress({ completion }: { completion: number }) {
  const sections = ['S', 'P', 'I', 'N'];
  const filledCount = Math.round((completion / 100) * 4);

  return (
    <div className="flex items-center gap-1">
      {sections.map((section, index) => (
        <div
          key={section}
          className={cn(
            'w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold transition-colors',
            index < filledCount
              ? 'bg-[--exec-sage] text-white'
              : 'bg-[--exec-surface-alt] text-[--exec-text-muted]'
          )}
        >
          {section}
        </div>
      ))}
    </div>
  );
}

function CallCard({ call }: CallCardProps) {
  const [expanded, setExpanded] = useState(false);
  const outcomeConfig = call.outcome ? OUTCOME_CONFIG[call.outcome] : null;
  const OutcomeIcon = outcomeConfig?.icon;

  return (
    <div
      className={cn(
        'p-4 rounded-xl border transition-all',
        call.outcome === 'closed_deal'
          ? 'bg-[--exec-sage-bg] border-[--exec-sage]'
          : call.outcome === 'sent_proposal'
            ? 'bg-[--exec-accent-bg] border-[--exec-accent]'
            : 'bg-[--exec-surface-alt] border-[--exec-border-subtle]'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-medium text-[--exec-text] truncate">
              {call.contact_name || 'Unknown Contact'}
            </p>
            {call.deal_title && (
              <span className="text-xs px-2 py-0.5 bg-[--exec-surface] rounded-full text-[--exec-text-muted]">
                {call.deal_title}
              </span>
            )}
          </div>
          {call.contact_company && (
            <p className="text-sm text-[--exec-text-muted] mt-0.5">
              {call.contact_company}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2 text-xs text-[--exec-text-muted]">
            <span>{format(parseISO(call.call_date), 'MMM d, yyyy')}</span>
            {call.call_duration_minutes && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {call.call_duration_minutes}m
              </span>
            )}
            <SpinProgress completion={call.spin_completion} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {outcomeConfig && OutcomeIcon && (
            <span
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full"
              style={{
                backgroundColor: `var(${outcomeConfig.color}-bg, var(--exec-surface-alt))`,
                color: `var(${outcomeConfig.color})`,
              }}
            >
              <OutcomeIcon className="w-3 h-3" />
              {outcomeConfig.label}
            </span>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-[--exec-surface] rounded-lg transition-colors"
          >
            <ChevronRight
              className={cn(
                'w-4 h-4 transition-transform',
                expanded && 'rotate-90'
              )}
            />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-[--exec-border-subtle] space-y-3">
          {/* SPIN Summary */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            {call.situation && (
              <div>
                <p className="text-xs font-semibold text-[--exec-sage] mb-1">Situation</p>
                <p className="text-[--exec-text-secondary] line-clamp-2">{call.situation}</p>
              </div>
            )}
            {call.problem && (
              <div>
                <p className="text-xs font-semibold text-[--exec-warning] mb-1">Problem</p>
                <p className="text-[--exec-text-secondary] line-clamp-2">{call.problem}</p>
              </div>
            )}
            {call.implication && (
              <div>
                <p className="text-xs font-semibold text-[--exec-error] mb-1">Implication</p>
                <p className="text-[--exec-text-secondary] line-clamp-2">{call.implication}</p>
              </div>
            )}
            {call.need_payoff && (
              <div>
                <p className="text-xs font-semibold text-[--exec-accent] mb-1">Need-Payoff</p>
                <p className="text-[--exec-text-secondary] line-clamp-2">{call.need_payoff}</p>
              </div>
            )}
          </div>

          {/* Additional Info */}
          <div className="flex flex-wrap gap-2 text-xs">
            {call.budget_discussed && call.budget_range && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[--exec-sage-bg] text-[--exec-sage] rounded-lg">
                <DollarSign className="w-3 h-3" />
                {call.budget_range}
              </span>
            )}
            {call.timeline_discussed && call.timeline && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[--exec-info-bg] text-[--exec-info] rounded-lg">
                <Calendar className="w-3 h-3" />
                {call.timeline}
              </span>
            )}
            {call.decision_maker_present && (
              <span className="flex items-center gap-1 px-2 py-1 bg-[--exec-accent-bg] text-[--exec-accent] rounded-lg">
                <User className="w-3 h-3" />
                Decision Maker
              </span>
            )}
          </div>

          {call.next_steps && (
            <div className="text-sm">
              <p className="text-xs font-semibold text-[--exec-text-secondary] mb-1">Next Steps</p>
              <p className="text-[--exec-text-muted]">{call.next_steps}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface NewCallModalProps {
  onClose: () => void;
  onSubmit: (data: DiscoveryCallCreate) => void;
  isLoading: boolean;
}

function NewCallModal({ onClose, onSubmit, isLoading }: NewCallModalProps) {
  const [formData, setFormData] = useState<Partial<DiscoveryCallCreate>>({
    call_date: new Date().toISOString().split('T')[0],
    budget_discussed: false,
    timeline_discussed: false,
    decision_maker_present: false,
  });
  const [activeTab, setActiveTab] = useState<'basic' | 'spin' | 'outcome'>('basic');

  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contactApi.getAll(),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.contact_id) return;
    onSubmit(formData as DiscoveryCallCreate);
  };

  const inputClasses = cn(
    "w-full px-4 py-2.5 rounded-lg",
    "bg-stone-800/50 border border-stone-600/40",
    "text-[--exec-text] placeholder:text-[--exec-text-muted]",
    "focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50",
    "transition-all text-sm"
  );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div className="bg-[--exec-surface] rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden border border-stone-600/40 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center">
                <Phone className="w-5 h-5 text-[--exec-accent]" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-[--exec-text]">Log Discovery Call</h2>
                <p className="text-sm text-[--exec-text-muted]">Record call details using SPIN framework</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-[--exec-text-muted] hover:text-[--exec-text] p-1.5 hover:bg-stone-700/50 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-stone-600/40 px-6">
          {(['basic', 'spin', 'outcome'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                'flex-1 px-4 py-3 text-sm font-medium transition-colors',
                activeTab === tab
                  ? 'text-[--exec-accent] border-b-2 border-[--exec-accent]'
                  : 'text-[--exec-text-muted] hover:text-[--exec-text]'
              )}
            >
              {tab === 'basic' && 'Basic Info'}
              {tab === 'spin' && 'SPIN Notes'}
              {tab === 'outcome' && 'Outcome'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="overflow-y-auto max-h-[60vh]">
          <div className="p-6 space-y-4">
            {activeTab === 'basic' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Contact <span className="text-red-400">*</span>
                    </label>
                    <select
                      value={formData.contact_id || ''}
                      onChange={(e) => setFormData({ ...formData, contact_id: Number(e.target.value) })}
                      className={inputClasses}
                      required
                    >
                      <option value="">Select a contact...</option>
                      {contacts.map((contact: Contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name} {contact.company && `(${contact.company})`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Call Date
                    </label>
                    <input
                      type="date"
                      value={formData.call_date || ''}
                      onChange={(e) => setFormData({ ...formData, call_date: e.target.value })}
                      className={inputClasses}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Duration (minutes)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="480"
                      value={formData.call_duration_minutes || ''}
                      onChange={(e) => setFormData({ ...formData, call_duration_minutes: Number(e.target.value) })}
                      placeholder="30"
                      className={inputClasses}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      Attendees
                    </label>
                    <input
                      type="text"
                      value={formData.attendees || ''}
                      onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                      placeholder="John, Sarah, Mike"
                      className={inputClasses}
                    />
                  </div>
                </div>
              </>
            )}

            {activeTab === 'spin' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-sage] mb-1.5">
                    S - Situation
                    <span className="text-[--exec-text-muted] font-normal ml-2">Current state, background</span>
                  </label>
                  <textarea
                    value={formData.situation || ''}
                    onChange={(e) => setFormData({ ...formData, situation: e.target.value })}
                    placeholder="What's their current situation? What tools/processes do they use?"
                    rows={2}
                    className={cn(inputClasses, "resize-none")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-warning] mb-1.5">
                    P - Problem
                    <span className="text-[--exec-text-muted] font-normal ml-2">Pain points, challenges</span>
                  </label>
                  <textarea
                    value={formData.problem || ''}
                    onChange={(e) => setFormData({ ...formData, problem: e.target.value })}
                    placeholder="What problems are they facing? What's not working?"
                    rows={2}
                    className={cn(inputClasses, "resize-none")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-error] mb-1.5">
                    I - Implication
                    <span className="text-[--exec-text-muted] font-normal ml-2">Cost of not solving</span>
                  </label>
                  <textarea
                    value={formData.implication || ''}
                    onChange={(e) => setFormData({ ...formData, implication: e.target.value })}
                    placeholder="What happens if this isn't solved? What's the cost/impact?"
                    rows={2}
                    className={cn(inputClasses, "resize-none")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-accent] mb-1.5">
                    N - Need-Payoff
                    <span className="text-[--exec-text-muted] font-normal ml-2">Value of solving</span>
                  </label>
                  <textarea
                    value={formData.need_payoff || ''}
                    onChange={(e) => setFormData({ ...formData, need_payoff: e.target.value })}
                    placeholder="What would solving this mean for them? What value would they get?"
                    rows={2}
                    className={cn(inputClasses, "resize-none")}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Objections Raised
                  </label>
                  <textarea
                    value={formData.objections || ''}
                    onChange={(e) => setFormData({ ...formData, objections: e.target.value })}
                    placeholder="Any objections or concerns?"
                    rows={2}
                    className={cn(inputClasses, "resize-none")}
                  />
                </div>
              </div>
            )}

            {activeTab === 'outcome' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Call Outcome
                  </label>
                  <select
                    value={formData.outcome || ''}
                    onChange={(e) => setFormData({ ...formData, outcome: e.target.value as CallOutcome })}
                    className={inputClasses}
                  >
                    <option value="">Select outcome...</option>
                    <option value="scheduled_followup">Follow-up Scheduled</option>
                    <option value="sent_proposal">Proposal Sent</option>
                    <option value="closed_deal">Closed Deal</option>
                    <option value="needs_more_info">Needs More Info</option>
                    <option value="not_a_fit">Not a Fit</option>
                    <option value="no_show">No Show</option>
                    <option value="rescheduled">Rescheduled</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Follow-up Date
                  </label>
                  <input
                    type="date"
                    value={formData.follow_up_date || ''}
                    onChange={(e) => setFormData({ ...formData, follow_up_date: e.target.value })}
                    className={inputClasses}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                    Next Steps
                  </label>
                  <textarea
                    value={formData.next_steps || ''}
                    onChange={(e) => setFormData({ ...formData, next_steps: e.target.value })}
                    placeholder="What are the agreed next steps?"
                    rows={2}
                    className={cn(inputClasses, "resize-none")}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      <input
                        type="checkbox"
                        checked={formData.budget_discussed || false}
                        onChange={(e) => setFormData({ ...formData, budget_discussed: e.target.checked })}
                        className="w-4 h-4 text-[--exec-accent] bg-stone-800/50 border-stone-600/40 rounded focus:ring-[--exec-accent]"
                      />
                      Budget Discussed
                    </label>
                    {formData.budget_discussed && (
                      <input
                        type="text"
                        value={formData.budget_range || ''}
                        onChange={(e) => setFormData({ ...formData, budget_range: e.target.value })}
                        placeholder="e.g., $2K-5K/mo"
                        className={inputClasses}
                      />
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium text-[--exec-text-secondary] mb-1.5">
                      <input
                        type="checkbox"
                        checked={formData.timeline_discussed || false}
                        onChange={(e) => setFormData({ ...formData, timeline_discussed: e.target.checked })}
                        className="w-4 h-4 text-[--exec-accent] bg-stone-800/50 border-stone-600/40 rounded focus:ring-[--exec-accent]"
                      />
                      Timeline Discussed
                    </label>
                    {formData.timeline_discussed && (
                      <input
                        type="text"
                        value={formData.timeline || ''}
                        onChange={(e) => setFormData({ ...formData, timeline: e.target.value })}
                        placeholder="e.g., Q1 2026"
                        className={inputClasses}
                      />
                    )}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-medium text-[--exec-text-secondary]">
                  <input
                    type="checkbox"
                    checked={formData.decision_maker_present || false}
                    onChange={(e) => setFormData({ ...formData, decision_maker_present: e.target.checked })}
                    className="w-4 h-4 text-[--exec-accent] bg-stone-800/50 border-stone-600/40 rounded focus:ring-[--exec-accent]"
                  />
                  Decision Maker Present
                </label>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 justify-end px-6 py-4 border-t border-stone-600/40">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[--exec-text-muted] hover:text-[--exec-text] hover:bg-stone-700/50 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || !formData.contact_id}
              className="flex items-center gap-2 px-4 py-2 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Log Call
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function DiscoveryCallTracker() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['discovery-calls'],
    queryFn: () => discoveryCallApi.getAll({ limit: 10 }),
  });

  const { data: upcomingFollowUps = [] } = useQuery({
    queryKey: ['discovery-calls-follow-ups'],
    queryFn: () => discoveryCallApi.getUpcomingFollowUps(7),
  });

  const createMutation = useMutation({
    mutationFn: discoveryCallApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discovery-calls'] });
      queryClient.invalidateQueries({ queryKey: ['discovery-calls-follow-ups'] });
      setShowModal(false);
    },
  });

  if (isLoading) {
    return (
      <div className="bento-card p-6 animate-pulse">
        <div className="h-6 bg-[--exec-surface-alt] rounded w-40 mb-4" />
        <div className="grid grid-cols-4 gap-4 mb-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-16 bg-[--exec-surface-alt] rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-20 bg-[--exec-surface-alt] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const calls = data?.calls || [];

  return (
    <>
      <div className="bento-card overflow-hidden animate-fade-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[--exec-border-subtle]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[--exec-accent-bg] to-[--exec-accent-bg-subtle] flex items-center justify-center">
              <Phone className="w-5 h-5 text-[--exec-accent]" />
            </div>
            <div>
              <h2 className="font-semibold text-[--exec-text]">Discovery Calls</h2>
              <p className="text-xs text-[--exec-text-muted]">
                {stats?.total_calls || 0} calls · {stats?.proposals_sent || 0} proposals · {stats?.deals_closed || 0} closed
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {upcomingFollowUps.length > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[--exec-info-bg] rounded-full">
                <CalendarClock className="w-4 h-4 text-[--exec-info]" />
                <span className="text-sm font-bold text-[--exec-info]">
                  {upcomingFollowUps.length} follow-ups
                </span>
              </div>
            )}

            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[--exec-accent] text-white rounded-xl hover:bg-[--exec-accent-dark] transition-colors text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Log Call
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-4 gap-4 p-6 border-b border-[--exec-border-subtle]">
          <div className="text-center">
            <p className="text-2xl font-bold text-[--exec-text]">{stats?.total_calls || 0}</p>
            <p className="text-xs text-[--exec-text-muted]">Total Calls</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[--exec-info]">{stats?.calls_this_month || 0}</p>
            <p className="text-xs text-[--exec-text-muted]">This Month</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[--exec-accent]">{stats?.proposals_sent || 0}</p>
            <p className="text-xs text-[--exec-text-muted]">Proposals</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-[--exec-sage]">{stats?.deals_closed || 0}</p>
            <p className="text-xs text-[--exec-text-muted]">Deals Won</p>
          </div>
        </div>

        {/* SPIN Completion */}
        {stats && stats.total_calls > 0 && (
          <div className="px-6 py-4 border-b border-[--exec-border-subtle]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[--exec-text-secondary]">Avg. SPIN Completion</span>
              <span className="text-sm font-bold text-[--exec-text]">{stats.avg_spin_completion}%</span>
            </div>
            <div className="h-2 bg-[--exec-surface-alt] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[--exec-sage] to-[--exec-accent] rounded-full transition-all"
                style={{ width: `${stats.avg_spin_completion}%` }}
              />
            </div>
          </div>
        )}

        {/* Recent Calls */}
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-[--exec-text-secondary]">
              Recent Calls
            </h3>
          </div>

          <div className="space-y-3">
            {calls.length === 0 ? (
              <div className="text-center py-8">
                <Phone className="w-12 h-12 text-[--exec-text-muted] mx-auto mb-3 opacity-30" />
                <p className="text-sm text-[--exec-text-muted] mb-2">
                  No discovery calls logged yet
                </p>
                <p className="text-xs text-[--exec-text-muted] max-w-xs mx-auto">
                  Use the SPIN framework to capture insights from your sales calls and track outcomes.
                </p>
              </div>
            ) : (
              calls.slice(0, 5).map((call) => (
                <CallCard key={call.id} call={call} />
              ))
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <NewCallModal
          onClose={() => setShowModal(false)}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}
    </>
  );
}
