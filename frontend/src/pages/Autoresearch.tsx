import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
  ClipboardCheck,
  Lightbulb,
  TestTubes,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import AuditsTab from '@/components/autoresearch/AuditsTab';
import ExperimentsTab from '@/components/autoresearch/ExperimentsTab';

type TabType = 'audits' | 'insights' | 'experiments' | 'settings';

const tabs = [
  {
    id: 'audits' as TabType,
    name: 'Audits',
    icon: ClipboardCheck,
    description: 'Website audit results',
  },
  {
    id: 'insights' as TabType,
    name: 'Insights',
    icon: Lightbulb,
    description: 'AI-generated insights',
  },
  {
    id: 'experiments' as TabType,
    name: 'Experiments',
    icon: TestTubes,
    description: 'A/B tests and experiments',
  },
  {
    id: 'settings' as TabType,
    name: 'Settings',
    icon: Settings,
    description: 'Autoresearch configuration',
  },
];

export default function Autoresearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'audits';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  return (
    <div className="min-h-full bg-[--exec-bg] grain">
      {/* Hero Header */}
      <header className="relative z-30">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[--exec-surface] via-[--exec-surface] to-[--exec-accent-bg-subtle] overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[--exec-accent]/5 to-transparent rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gradient-to-t from-[--exec-sage]/5 to-transparent rounded-full blur-2xl" />
        </div>

        <div className="relative px-8 pt-8 pb-6">
          {/* Breadcrumb chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-[--exec-surface-alt] rounded-full mb-4 animate-fade-slide-up">
            <FlaskConical className="w-3.5 h-3.5 text-[--exec-accent]" />
            <span className="text-xs font-medium text-[--exec-text-secondary]">
              Autoresearch
            </span>
          </div>

          <div className="flex items-end justify-between">
            <div>
              <h1
                className="text-4xl font-bold text-[--exec-text] tracking-tight animate-fade-slide-up delay-1"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Auto<span className="text-[--exec-accent]">research</span>
              </h1>
              <p className="text-[--exec-text-secondary] mt-2 text-lg animate-fade-slide-up delay-2">
                AI-powered website audits and cold email optimization
              </p>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-4 mt-6 animate-fade-slide-up delay-4">
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
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <div className="animate-fade-slide-up delay-5">
        {activeTab === 'audits' && <AuditsTab />}
        {activeTab === 'insights' && (
          <div className="p-8 text-center text-[--exec-text-muted]">
            Insights tab - coming soon
          </div>
        )}
        {activeTab === 'experiments' && <ExperimentsTab />}
        {activeTab === 'settings' && (
          <div className="p-8 text-center text-[--exec-text-muted]">
            Settings tab - coming soon
          </div>
        )}
      </div>
    </div>
  );
}
