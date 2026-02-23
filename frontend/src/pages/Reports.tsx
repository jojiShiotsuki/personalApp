import { useState } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import DateRangePicker from '@/components/reports/DateRangePicker';
import OverviewTab from '@/components/reports/OverviewTab';
import RevenueTab from '@/components/reports/RevenueTab';
import TimeTab from '@/components/reports/TimeTab';
import PipelineTab from '@/components/reports/PipelineTab';

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'time', label: 'Time' },
  { key: 'pipeline', label: 'Pipeline' },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function Reports() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [startDate, setStartDate] = useState(() => format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));

  const handleDateChange = (start: string, end: string) => {
    setStartDate(start);
    setEndDate(end);
  };

  return (
    <div className="min-h-full bg-[--exec-bg]">
      {/* Header */}
      <div className="bg-[--exec-surface] border-b border-stone-700/40 px-8 py-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-[--exec-accent]" />
            <div>
              <h1 className="text-2xl font-bold text-[--exec-text] tracking-tight">Reports</h1>
              <p className="mt-1 text-sm text-[--exec-text-muted]">
                Analytics and insights across your business
              </p>
            </div>
          </div>
        </div>

        {/* Date Range Picker */}
        <div className="mb-4">
          <DateRangePicker startDate={startDate} endDate={endDate} onChange={handleDateChange} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-stone-800/50 p-1 rounded-xl w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200",
                activeTab === tab.key
                  ? "bg-[--exec-surface] text-[--exec-text] shadow-sm"
                  : "text-[--exec-text-muted] hover:text-[--exec-text-secondary]"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-6">
        {activeTab === 'overview' && <OverviewTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'revenue' && <RevenueTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'time' && <TimeTab startDate={startDate} endDate={endDate} />}
        {activeTab === 'pipeline' && <PipelineTab startDate={startDate} endDate={endDate} />}
      </div>
    </div>
  );
}
