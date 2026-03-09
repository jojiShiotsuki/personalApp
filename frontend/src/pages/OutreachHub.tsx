import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coldOutreachApi, leadDiscoveryApi } from '@/lib/api';
import type { OutreachProspect } from '@/types';
import {
  Send,
  Mail,
  Search,
  MessageCircle,
  Database,
  Linkedin,
  Layers,
  X,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import ProspectStatusBadge from '@/components/outreach/ProspectStatusBadge';

// Import tab content components
import DMScriptsTab from '@/components/outreach/DMScriptsTab';
import EmailCampaignsTab from '@/components/outreach/EmailCampaignsTab';
import LinkedInCampaignsTab from '@/components/outreach/LinkedInCampaignsTab';
import LeadDiscoveryTab from '@/components/outreach/LeadDiscoveryTab';
import MultiTouchCampaignsTab from '@/components/outreach/MultiTouchCampaignsTab';

type TabType = 'dm-scripts' | 'email-campaigns' | 'linkedin-campaigns' | 'multi-touch' | 'lead-discovery';

const tabs = [
  {
    id: 'dm-scripts' as TabType,
    name: 'DM Scripts',
    icon: MessageCircle,
    description: 'TikTok cold outreach scripts',
  },
  {
    id: 'email-campaigns' as TabType,
    name: 'Email Campaigns',
    icon: Mail,
    description: 'Cold email sequences',
  },
  {
    id: 'linkedin-campaigns' as TabType,
    name: 'LinkedIn Campaigns',
    icon: Linkedin,
    description: 'LinkedIn outreach sequences',
  },
  {
    id: 'multi-touch' as TabType,
    name: 'Multi-Touch',
    icon: Layers,
    description: 'Cross-channel sequences',
  },
  {
    id: 'lead-discovery' as TabType,
    name: 'Lead Discovery',
    icon: Search,
    description: 'AI-powered prospecting',
  },
];

export default function OutreachHub() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'dm-scripts';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [globalSearch, setGlobalSearch] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [jumpToCampaign, setJumpToCampaign] = useState<{ id: number; ts: number } | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Close search dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch stats for unified header
  const { data: campaigns = [] } = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: () => coldOutreachApi.getCampaigns(),
  });

  const { data: leadStats } = useQuery({
    queryKey: ['lead-discovery-stats'],
    queryFn: leadDiscoveryApi.getStats,
  });

  // Global prospect search (across all campaigns)
  const { data: searchResults = [], isFetching: isSearching } = useQuery<OutreachProspect[]>({
    queryKey: ['global-prospect-search', globalSearch],
    queryFn: () => coldOutreachApi.searchProspects(globalSearch.trim()),
    enabled: globalSearch.trim().length >= 2,
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Calculate totals for stats
  const totalCampaigns = campaigns.length;
  const totalLeads = leadStats?.total_leads || 0;

  // Get campaign name by id for search results
  const getCampaignName = (campaignId: number) => {
    return campaigns.find((c) => c.id === campaignId)?.name || `Campaign #${campaignId}`;
  };

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
            <Send className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">
              Outreach Hub
            </span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1
                className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Outreach <span className="text-[--exec-accent]">Hub</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                All your outreach tools in one place
              </p>
            </div>

            {/* Quick Stats */}
            <div className="flex items-center gap-4 animate-fade-slide-up delay-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-[--exec-surface-alt] rounded-xl">
                <Mail className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium text-[--exec-text]">
                  {totalCampaigns} campaigns
                </span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-[--exec-surface-alt] rounded-xl">
                <Database className="w-4 h-4 text-green-500" />
                <span className="text-sm font-medium text-[--exec-text]">
                  {totalLeads} leads saved
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation + Global Search */}
          <div className="flex items-center justify-between gap-4 mt-6 animate-fade-slide-up delay-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={cn(
                      'flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-200',
                      isActive
                        ? 'text-white shadow-lg'
                        : 'bg-[--exec-surface-alt] text-[--exec-text-secondary] hover:bg-[--exec-surface-hover] hover:text-[--exec-text]'
                    )}
                    style={isActive ? { backgroundColor: 'var(--exec-accent)' } : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.name}
                  </button>
                );
              })}
            </div>

            {/* Global Prospect Search */}
            <div ref={searchRef} className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[--exec-text-muted]" />
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setIsSearchFocused(false);
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  placeholder="Find prospect..."
                  className={cn(
                    'w-52 pl-9 pr-8 py-2 rounded-lg text-sm',
                    'bg-stone-800/50 border border-stone-700/40',
                    'text-[--exec-text] placeholder:text-[--exec-text-muted]',
                    'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
                    'focus:w-72 transition-all duration-300'
                  )}
                />
                {globalSearch && (
                  <button
                    onClick={() => { setGlobalSearch(''); setIsSearchFocused(false); }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[--exec-text-muted] hover:text-[--exec-text] transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {isSearchFocused && globalSearch.trim().length >= 2 && (
                <div
                  className="absolute top-full right-0 mt-2 w-[400px] max-h-[400px] overflow-y-auto rounded-xl border border-stone-700/40 shadow-2xl z-50"
                  style={{ backgroundColor: '#1C1917' }}
                >
                  {isSearching ? (
                    <div className="px-4 py-6 text-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[--exec-accent] mx-auto mb-2" />
                      <p className="text-xs text-[--exec-text-muted]">Searching...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <Search className="w-8 h-8 text-[--exec-text-muted] mx-auto mb-2 opacity-40" />
                      <p className="text-sm text-[--exec-text-muted]">No prospects found for &ldquo;{globalSearch}&rdquo;</p>
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2.5 border-b border-stone-700/40">
                        <p className="text-xs font-medium text-[--exec-text-muted]">
                          {searchResults.length} result{searchResults.length !== 1 ? 's' : ''} across all campaigns
                        </p>
                      </div>
                      {searchResults.map((prospect) => (
                        <button
                          key={prospect.id}
                          onClick={() => {
                            const campaign = campaigns.find((c) => c.id === prospect.campaign_id);
                            if (campaign) {
                              setJumpToCampaign({ id: prospect.campaign_id, ts: Date.now() });
                              const type = campaign.campaign_type;
                              if (type === 'MULTI_TOUCH') handleTabChange('multi-touch');
                              else if (type === 'LINKEDIN') handleTabChange('linkedin-campaigns');
                              else handleTabChange('email-campaigns');
                            }
                            setGlobalSearch('');
                            setIsSearchFocused(false);
                          }}
                          className="w-full flex items-start gap-3 px-4 py-3 hover:bg-stone-800/80 transition-colors text-left border-b border-stone-800/60 last:border-b-0"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-[--exec-text] truncate">
                                {prospect.agency_name}
                              </span>
                              <ProspectStatusBadge status={prospect.status} />
                            </div>
                            {prospect.contact_name && (
                              <p className="text-xs text-[--exec-text-secondary] mt-0.5">{prospect.contact_name}</p>
                            )}
                            {prospect.email && (
                              <p className="text-xs text-[--exec-text-muted] mt-0.5 truncate">{prospect.email}</p>
                            )}
                            <p className="text-[10px] text-[--exec-text-muted] mt-1 flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {getCampaignName(prospect.campaign_id)}
                              {' · '}Step {prospect.current_step}
                            </p>
                          </div>
                          <ExternalLink className="w-3.5 h-3.5 text-[--exec-text-muted] mt-1 flex-shrink-0" />
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="animate-fade-slide-up delay-5">
        {activeTab === 'dm-scripts' && <DMScriptsTab />}
        {activeTab === 'email-campaigns' && <EmailCampaignsTab initialCampaignId={jumpToCampaign?.id} key={`email-${jumpToCampaign?.ts ?? 0}`} />}
        {activeTab === 'linkedin-campaigns' && <LinkedInCampaignsTab initialCampaignId={jumpToCampaign?.id} key={`linkedin-${jumpToCampaign?.ts ?? 0}`} />}
        {activeTab === 'multi-touch' && <MultiTouchCampaignsTab initialCampaignId={jumpToCampaign?.id} key={`mt-${jumpToCampaign?.ts ?? 0}`} />}
        {activeTab === 'lead-discovery' && <LeadDiscoveryTab />}
      </div>
    </div>
  );
}
