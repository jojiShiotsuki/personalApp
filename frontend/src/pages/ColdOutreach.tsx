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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import CopyEmailModal from '@/components/CopyEmailModal';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import NewCampaignModal from '@/components/NewCampaignModal';
import ManageTemplatesModal from '@/components/ManageTemplatesModal';

type TabType = 'today' | 'all' | 'replied';

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

// Prospect card component for the Today queue
function ProspectCard({
  prospect,
  onMarkSent,
}: {
  prospect: OutreachProspect;
  onMarkSent: () => void;
}) {
  const [isCopyModalOpen, setIsCopyModalOpen] = useState(false);
  const [isResponseModalOpen, setIsResponseModalOpen] = useState(false);
  const isFollowUp = prospect.current_step > 1;

  return (
    <>
      <div className="bento-card p-5 hover:shadow-lg transition-all duration-200">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              {/* Step indicator dot */}
              <div
                className={cn(
                  'w-2.5 h-2.5 rounded-full',
                  isFollowUp ? 'bg-blue-500' : 'bg-green-500'
                )}
              />
              <h3 className="font-semibold text-[--exec-text] truncate">
                {prospect.agency_name}
              </h3>
              <span className="text-xs text-[--exec-text-muted] px-2 py-0.5 bg-[--exec-surface-alt] rounded-full">
                Step {prospect.current_step}
              </span>
            </div>

            <p className="text-sm text-[--exec-text-secondary] truncate mb-1">
              {prospect.email}
            </p>

            {prospect.niche && (
              <p className="text-xs text-[--exec-text-muted]">
                {prospect.niche}
              </p>
            )}
          </div>

          <StatusBadge status={prospect.status} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4 pt-4 border-t border-[--exec-border-subtle]">
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

      {/* Modals */}
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
}: {
  prospects: OutreachProspect[];
  onMarkSent: (prospectId: number) => void;
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
        />
      ))}
    </div>
  );
}

// All Prospects table component
function AllProspects({
  prospects,
  onMarkSent,
}: {
  prospects: OutreachProspect[];
  onMarkSent: (prospectId: number) => void;
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
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      prospect.current_step > 1 ? 'bg-blue-500' : 'bg-green-500'
                    )}
                  />
                  <span className="text-sm font-medium text-[--exec-text]">
                    {prospect.agency_name}
                  </span>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                {prospect.email}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-muted]">
                {prospect.niche || '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-secondary]">
                {prospect.current_step}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <StatusBadge status={prospect.status} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-[--exec-text-muted]">
                {prospect.next_action_date
                  ? new Date(prospect.next_action_date).toLocaleDateString()
                  : '-'}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right">
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
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Replied Prospects component
function RepliedProspects({ prospects }: { prospects: OutreachProspect[] }) {
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
              <h3 className="font-semibold text-[--exec-text] truncate mb-1">
                {prospect.agency_name}
              </h3>
              <p className="text-sm text-[--exec-text-secondary] truncate mb-2">
                {prospect.email}
              </p>
              {prospect.notes && (
                <p className="text-xs text-[--exec-text-muted] line-clamp-2">
                  {prospect.notes}
                </p>
              )}
            </div>
            <StatusBadge status={prospect.status} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ColdOutreach() {
  // State
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('today');
  const [isNewCampaignOpen, setIsNewCampaignOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);
  const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<OutreachCampaign | null>(null);

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
    enabled: !!selectedCampaignId && (activeTab === 'all' || activeTab === 'replied'),
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
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-visible z-20">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle]" />

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <Mail className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">
              Cold Outreach
            </span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1
                className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Outreach <span className="text-[--exec-accent]">Queue</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                Manage your cold email campaigns and follow-ups
              </p>
            </div>

            <div className="flex items-center gap-3 animate-fade-slide-up delay-3">
              {/* Campaign selector - custom dropdown */}
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

                {/* Dropdown menu */}
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
                onClick={() => setIsTemplatesOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                  'bg-slate-600/50 text-slate-300 border border-slate-500/30',
                  'transition-all duration-200 font-medium text-sm',
                  'hover:bg-slate-500 hover:text-white hover:border-slate-400 hover:scale-105 active:scale-95'
                )}
              >
                <FileText className="w-4 h-4" />
                Templates
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="px-8 py-6 relative z-10">
        {/* Stats Bar */}
        {selectedCampaignId && stats && (
          <div className="grid grid-cols-4 gap-4 mb-6 animate-fade-slide-up delay-4">
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
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        {selectedCampaignId && (
          <div className="mb-6 animate-fade-slide-up delay-5">
            <div className="flex items-center gap-1">
              {(['today', 'all', 'replied'] as const).map((tab) => (
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
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content Area */}
        {selectedCampaignId ? (
          <div className="animate-fade-slide-up delay-6">
            {activeTab === 'today' && (
              <TodayQueue
                prospects={todayQueue}
                onMarkSent={handleMarkSent}
              />
            )}
            {activeTab === 'all' && (
              <AllProspects prospects={allProspects} onMarkSent={handleMarkSent} />
            )}
            {activeTab === 'replied' && <RepliedProspects prospects={allProspects} />}
          </div>
        ) : (
          <div className="bento-card p-12 text-center animate-fade-slide-up delay-4">
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

      {/* New/Edit Campaign Modal */}
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

      <ManageTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
      />
    </div>
  );
}
