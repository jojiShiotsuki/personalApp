import { ProspectStatus } from '@/types';

export const WEBSITE_ISSUE_LABELS: Record<string, { label: string; color: string }> = {
  slow_load: { label: 'Slow Load', color: 'text-red-400 bg-red-900/30 border-red-800' },
  not_mobile_friendly: { label: 'Not Mobile', color: 'text-orange-400 bg-orange-900/30 border-orange-800' },
  no_google_presence: { label: 'No Google', color: 'text-yellow-400 bg-yellow-900/30 border-yellow-800' },
  no_clear_cta: { label: 'No CTA', color: 'text-blue-400 bg-blue-900/30 border-blue-800' },
  outdated_design: { label: 'Outdated', color: 'text-purple-400 bg-purple-900/30 border-purple-800' },
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
