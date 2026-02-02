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
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import CsvImportModal from '@/components/CsvImportModal';
import CopyEmailModal from '@/components/CopyEmailModal';
import ResponseOutcomeModal from '@/components/ResponseOutcomeModal';
import NewCampaignModal from '@/components/NewCampaignModal';

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
              'bg-[--exec-surface-alt] text-[--exec-text-secondary] hover:bg-[--exec-accent-bg] hover:text-[--exec-accent]'
            )}
          >
            <Copy className="w-4 h-4" />
            Copy Email
          </button>

          <button
            onClick={onMarkSent}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
              'bg-[--exec-accent] text-white hover:bg-[--exec-accent-dark]'
            )}
          >
            <Send className="w-4 h-4" />
            Mark Sent
          </button>

          {isFollowUp && (
            <button
              onClick={() => setIsResponseModalOpen(true)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                'bg-[--exec-sage] text-white hover:bg-[--exec-sage-dark]'
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
                    className="text-sm text-[--exec-accent] hover:text-[--exec-accent-dark] font-medium"
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

  // Handlers
  const handleMarkSent = (prospectId: number) => {
    markSentMutation.mutate(prospectId);
  };

  // Auto-select first campaign if none selected
  if (campaigns.length > 0 && !selectedCampaignId) {
    setSelectedCampaignId(campaigns[0].id);
  }

  const stats = campaignWithStats?.stats;

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative overflow-hidden">
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
              {/* Campaign selector */}
              <div className="relative">
                <select
                  value={selectedCampaignId || ''}
                  onChange={(e) =>
                    setSelectedCampaignId(e.target.value ? Number(e.target.value) : null)
                  }
                  className={cn(
                    'appearance-none pl-4 pr-10 py-2.5 rounded-xl',
                    'bg-[--exec-surface] border border-[--exec-border]',
                    'text-[--exec-text] text-sm font-medium',
                    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
                    'transition-all duration-200 cursor-pointer min-w-[180px]'
                  )}
                >
                  <option value="">Select Campaign</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted] pointer-events-none" />
              </div>

              <button
                onClick={() => setIsNewCampaignOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                  'bg-[--exec-accent] text-white',
                  'hover:bg-[--exec-accent-dark] transition-all duration-200',
                  'shadow-sm hover:shadow-md font-medium text-sm'
                )}
              >
                <Plus className="w-4 h-4" />
                New
              </button>

              <button
                onClick={() => setIsImportOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                  'bg-[--exec-surface] border border-[--exec-border]',
                  'text-[--exec-text-secondary]',
                  'hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent]',
                  'transition-all duration-200 font-medium text-sm'
                )}
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>

              <button
                onClick={() => setIsTemplatesOpen(true)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                  'bg-[--exec-surface] border border-[--exec-border]',
                  'text-[--exec-text-secondary]',
                  'hover:bg-[--exec-surface-alt] hover:border-[--exec-accent] hover:text-[--exec-accent]',
                  'transition-all duration-200 font-medium text-sm'
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
      <div className="px-8 py-6">
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
            <div className="flex items-center gap-2 bg-[--exec-surface] p-1 rounded-xl border border-[--exec-border] w-fit">
              {(['today', 'all', 'replied'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                    activeTab === tab
                      ? 'bg-[--exec-accent] text-white shadow-sm'
                      : 'text-[--exec-text-secondary] hover:text-[--exec-text] hover:bg-[--exec-surface-alt]'
                  )}
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
                'bg-[--exec-accent] text-white',
                'hover:bg-[--exec-accent-dark] transition-all duration-200',
                'shadow-sm hover:shadow-md font-medium text-sm'
              )}
            >
              <Plus className="w-4 h-4" />
              Create Campaign
            </button>
          </div>
        )}
      </div>

      {/* New Campaign Modal */}
      <NewCampaignModal
        isOpen={isNewCampaignOpen}
        onClose={() => setIsNewCampaignOpen(false)}
        onCreated={(id) => setSelectedCampaignId(id)}
      />

      {selectedCampaignId && (
        <CsvImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          campaignId={selectedCampaignId}
        />
      )}

      {isTemplatesOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-[--exec-surface] rounded-2xl shadow-2xl p-6 max-w-md mx-4 border border-[--exec-border]">
            <h2 className="text-lg font-semibold text-[--exec-text] mb-4">
              Email Templates Modal
            </h2>
            <p className="text-[--exec-text-muted] mb-4">
              This modal will be implemented in a later task.
            </p>
            <button
              onClick={() => setIsTemplatesOpen(false)}
              className="px-4 py-2 bg-[--exec-accent] text-white rounded-xl"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
