import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Plus, Layers, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OutreachCampaign, CampaignType } from '@/types';

interface CampaignSelectorProps {
  /** Only show campaigns whose campaign_type is in this list. */
  campaignTypes: CampaignType[];
  /** All campaigns fetched upstream (via coldOutreachApi.getCampaigns). */
  campaigns: OutreachCampaign[];
  /** null = "All Campaigns" (unfiltered). */
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onNewClick: () => void;
  /** Optional label shown before the button. Defaults to "Campaign". */
  label?: string;
  /** Optional loading state for fetching campaigns. */
  isLoading?: boolean;
}

/**
 * Canonical campaign selector used on Outreach Hub tabs.
 * Compact dropdown button + All Campaigns + campaign list + New Campaign action.
 */
export default function CampaignSelector({
  campaignTypes,
  campaigns,
  selectedId,
  onSelect,
  onNewClick,
  label = 'Campaign',
  isLoading = false,
}: CampaignSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const filteredCampaigns = campaigns.filter((c) =>
    campaignTypes.includes(c.campaign_type)
  );

  const selected = filteredCampaigns.find((c) => c.id === selectedId);

  const handleSelect = (id: number | null) => {
    onSelect(id);
    setIsOpen(false);
  };

  const handleNew = () => {
    setIsOpen(false);
    onNewClick();
  };

  return (
    <div ref={containerRef} className="relative inline-flex items-center gap-2">
      <span className="text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium',
          'bg-stone-800/60 border border-stone-600/40 text-[--exec-text]',
          'hover:bg-stone-700/60 hover:border-stone-500/60 transition-colors',
          'min-w-[180px]'
        )}
      >
        <Layers className="w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0" />
        <span className="flex-1 text-left truncate">
          {selectedId === null ? 'All Campaigns' : selected?.name ?? 'Select Campaign'}
        </span>
        <ChevronDown
          className={cn(
            'w-3.5 h-3.5 text-[--exec-text-muted] flex-shrink-0 transition-transform',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div
          className={cn(
            'absolute left-0 top-full mt-1 z-40 w-80 max-h-[380px] overflow-y-auto',
            'bg-stone-900 border border-stone-600/60 rounded-xl shadow-2xl',
            'animate-in fade-in zoom-in-95 duration-150'
          )}
          style={{ paddingTop: '0.25rem', paddingBottom: '0.25rem' }}
        >
          {/* All Campaigns */}
          <button
            type="button"
            onClick={() => handleSelect(null)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 mx-1 my-0.5 rounded-lg text-sm text-left transition-colors',
              selectedId === null
                ? 'bg-[--exec-accent]/15 text-[--exec-text]'
                : 'text-[--exec-text-secondary] hover:bg-stone-800 hover:text-[--exec-text]'
            )}
            style={{ width: 'calc(100% - 0.5rem)' }}
          >
            <Layers className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="flex-1 truncate">All Campaigns</span>
            {selectedId === null && <Check className="w-3.5 h-3.5 text-[--exec-accent] flex-shrink-0" />}
          </button>

          {/* Divider */}
          <div className="my-1 mx-3 border-t border-stone-700/40" />

          {/* Campaign list */}
          {isLoading ? (
            <div className="px-3 py-4 text-xs text-[--exec-text-muted] text-center">
              Loading campaigns...
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="px-3 py-4 text-xs text-[--exec-text-muted] text-center">
              No campaigns yet. Create your first one below.
            </div>
          ) : (
            filteredCampaigns.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                onClick={() => handleSelect(campaign.id)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2 mx-1 my-0.5 rounded-lg text-sm text-left transition-colors',
                  selectedId === campaign.id
                    ? 'bg-[--exec-accent]/15 text-[--exec-text]'
                    : 'text-[--exec-text-secondary] hover:bg-stone-800 hover:text-[--exec-text]'
                )}
                style={{ width: 'calc(100% - 0.5rem)' }}
              >
                <span className="flex-1 truncate">{campaign.name}</span>
                {selectedId === campaign.id && (
                  <Check className="w-3.5 h-3.5 text-[--exec-accent] flex-shrink-0" />
                )}
              </button>
            ))
          )}

          {/* Divider */}
          <div className="my-1 mx-3 border-t border-stone-700/40" />

          {/* New Campaign */}
          <button
            type="button"
            onClick={handleNew}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 mx-1 my-0.5 rounded-lg text-sm text-left font-medium',
              'text-[--exec-accent] hover:bg-[--exec-accent]/10 transition-colors'
            )}
            style={{ width: 'calc(100% - 0.5rem)' }}
          >
            <Plus className="w-3.5 h-3.5 flex-shrink-0" />
            New Campaign
          </button>
        </div>
      )}
    </div>
  );
}
