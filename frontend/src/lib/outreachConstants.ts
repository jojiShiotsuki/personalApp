import { ProspectStatus } from '@/types';

export const WEBSITE_ISSUE_LABELS: Record<string, { label: string; color: string }> = {
  slow_load: { label: 'Slow Load', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30' },
  not_mobile_friendly: { label: 'Not Mobile', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  no_google_presence: { label: 'No Google', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  no_clear_cta: { label: 'No CTA', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  outdated_design: { label: 'Outdated', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
};

export const PROSPECT_STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  [ProspectStatus.QUEUED]: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    label: 'Queued',
  },
  [ProspectStatus.IN_SEQUENCE]: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    label: 'In Sequence',
  },
  [ProspectStatus.REPLIED]: {
    bg: 'bg-emerald-500/20',
    text: 'text-emerald-400',
    label: 'Replied',
  },
  [ProspectStatus.NOT_INTERESTED]: {
    bg: 'bg-rose-500/20',
    text: 'text-rose-400',
    label: 'Not Interested',
  },
  [ProspectStatus.CONVERTED]: {
    bg: 'bg-purple-500/20',
    text: 'text-purple-400',
    label: 'Converted',
  },
  [ProspectStatus.PENDING_CONNECTION]: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    label: 'Pending Connection',
  },
  [ProspectStatus.SKIPPED]: {
    bg: 'bg-gray-500/20',
    text: 'text-gray-400',
    label: 'Skipped',
  },
};

// LinkedIn-specific overrides for different label/color needs
export const LINKEDIN_STATUS_OVERRIDES: Partial<Record<string, { bg: string; text: string; label: string }>> = {
  [ProspectStatus.PENDING_CONNECTION]: {
    bg: 'bg-amber-500/20',
    text: 'text-amber-400',
    label: 'Pending',
  },
  [ProspectStatus.IN_SEQUENCE]: {
    bg: 'bg-blue-500/20',
    text: 'text-blue-400',
    label: 'Messaged',
  },
};
