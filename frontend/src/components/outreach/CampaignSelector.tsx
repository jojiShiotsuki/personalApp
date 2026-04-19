import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Plus, Layers, Edit2, Trash2, Check } from 'lucide-react';
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
  /** Optional inline edit button per row. */
  onEditClick?: (campaign: OutreachCampaign) => void;
  /** Optional inline delete button per row. */
  onDeleteClick?: (campaignId: number) => void;
  /** Optional loading state for fetching campaigns. */
  isLoading?: boolean;
}

/**
 * Canonical campaign selector used on Outreach Hub tabs. Matches the
 * LinkedIn/Multi-Touch visual DNA: prominent button + bold dropdown with
 * "All Campaigns" at top + campaign list + separate "+ New" accent button.
 */
export default function CampaignSelector({
  campaignTypes,
  campaigns,
  selectedId,
  onSelect,
  onNewClick,
  onEditClick,
  onDeleteClick,
  isLoading = false,
}: CampaignSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  // Recompute dropdown position on open
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownPos({
      top: rect.bottom + 8,
      left: rect.left,
      width: Math.max(rect.width, 280),
    });
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
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

  return (
    <div className="flex items-center gap-3">
      {/* Selector button + portaled dropdown */}
      <div className="relative">
        <button
          ref={buttonRef}
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          className={cn(
            'flex items-center gap-2 pl-4 pr-3 py-2.5 rounded-xl min-w-[200px]',
            'bg-[--exec-surface] border border-[--exec-border]',
            'text-[--exec-text] text-sm font-medium',
            'hover:bg-[--exec-surface-alt] hover:border-[--exec-accent]',
            'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]',
            'transition-all duration-200'
          )}
        >
          <Layers className="w-4 h-4 text-[--exec-accent] flex-shrink-0" />
          <span className="flex-1 text-left truncate">
            {selectedId === null ? 'All Campaigns' : selected?.name ?? 'Select Campaign'}
          </span>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-[--exec-text-muted] transition-transform duration-200 flex-shrink-0',
              isOpen && 'rotate-180'
            )}
          />
        </button>

        {isOpen && createPortal(
          <div
            ref={dropdownRef}
            className="fixed py-2 rounded-xl border border-[--exec-border] shadow-2xl z-[100] max-h-[400px] overflow-y-auto animate-in fade-in zoom-in-95 duration-150"
            style={{
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: dropdownPos.width,
              backgroundColor: '#1C1917',
            }}
          >
            {/* All Campaigns */}
            <div
              className={cn(
                'flex items-center justify-between px-3 py-2 mx-2 rounded-lg',
                'hover:bg-[--exec-surface-alt] transition-colors',
                selectedId === null && 'bg-[--exec-accent]/15'
              )}
            >
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className={cn(
                  'flex-1 flex items-center gap-2 text-left text-sm',
                  selectedId === null ? 'text-[--exec-accent] font-medium' : 'text-[--exec-text]'
                )}
              >
                <Layers className="w-3.5 h-3.5 flex-shrink-0 opacity-70" />
                <span className="flex-1 truncate">All Campaigns</span>
                {selectedId === null && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            </div>

            {/* Divider */}
            <div className="my-1 mx-3 border-t border-stone-700/40" />

            {/* Campaign list */}
            {isLoading ? (
              <div className="px-4 py-4 text-sm text-[--exec-text-muted] text-center">
                Loading campaigns...
              </div>
            ) : filteredCampaigns.length === 0 ? (
              <div className="px-4 py-4 text-sm text-[--exec-text-muted] text-center">
                No campaigns yet
              </div>
            ) : (
              filteredCampaigns.map((campaign) => (
                <div
                  key={campaign.id}
                  className={cn(
                    'flex items-center justify-between px-3 py-2 mx-2 rounded-lg',
                    'hover:bg-[--exec-surface-alt] transition-colors',
                    selectedId === campaign.id && 'bg-[--exec-accent]/15'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => handleSelect(campaign.id)}
                    className={cn(
                      'flex-1 text-left text-sm truncate',
                      selectedId === campaign.id
                        ? 'text-[--exec-accent] font-medium'
                        : 'text-[--exec-text]'
                    )}
                  >
                    {campaign.name}
                  </button>
                  {(onEditClick || onDeleteClick) && (
                    <div className="flex items-center gap-1 ml-3">
                      {onEditClick && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditClick(campaign);
                            setIsOpen(false);
                          }}
                          className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500 hover:text-white transition-all duration-200"
                          title="Edit campaign"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {onDeleteClick && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteClick(campaign.id);
                            setIsOpen(false);
                          }}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white transition-all duration-200"
                          title="Delete campaign"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>,
          document.body
        )}
      </div>

      {/* Separate "+ New" accent button */}
      <button
        type="button"
        onClick={onNewClick}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 rounded-xl',
          'text-white bg-[--exec-accent] hover:bg-[--exec-accent-dark]',
          'hover:shadow-lg transition-all duration-200 shadow-sm font-medium text-sm'
        )}
      >
        <Plus className="w-4 h-4" />
        New
      </button>
    </div>
  );
}
