import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { coldOutreachApi, leadDiscoveryApi } from '@/lib/api';
import {
  Send,
  Mail,
  Search,
  MessageCircle,
  Database,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Import tab content components
import DMScriptsTab from '@/components/outreach/DMScriptsTab';
import EmailCampaignsTab from '@/components/outreach/EmailCampaignsTab';
import LeadDiscoveryTab from '@/components/outreach/LeadDiscoveryTab';

type TabType = 'dm-scripts' | 'email-campaigns' | 'lead-discovery';

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

  // Fetch stats for unified header
  const { data: campaigns = [] } = useQuery({
    queryKey: ['outreach-campaigns'],
    queryFn: coldOutreachApi.getCampaigns,
  });

  const { data: leadStats } = useQuery({
    queryKey: ['lead-discovery-stats'],
    queryFn: leadDiscoveryApi.getStats,
  });

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  // Calculate totals for stats
  const totalCampaigns = campaigns.length;
  const totalLeads = leadStats?.total_leads || 0;

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

          {/* Tab Navigation */}
          <div className="flex gap-2 mt-6 animate-fade-slide-up delay-4">
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
        </div>
      </header>

      {/* Tab Content */}
      <div className="animate-fade-slide-up delay-5">
        {activeTab === 'dm-scripts' && <DMScriptsTab />}
        {activeTab === 'email-campaigns' && <EmailCampaignsTab />}
        {activeTab === 'lead-discovery' && <LeadDiscoveryTab />}
      </div>
    </div>
  );
}
