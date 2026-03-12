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
  [ProspectStatus.PENDING_CONNECTION]: {
    bg: 'bg-yellow-100 dark:bg-yellow-900/30',
    text: 'text-yellow-600 dark:text-yellow-400',
    label: 'Pending Connection',
  },
  [ProspectStatus.SKIPPED]: {
    bg: 'bg-slate-100 dark:bg-slate-700/50',
    text: 'text-slate-500 dark:text-slate-400',
    label: 'Skipped',
  },
};

// LinkedIn-specific overrides for different label/color needs
export const LINKEDIN_STATUS_OVERRIDES: Partial<Record<string, { bg: string; text: string; label: string }>> = {
  [ProspectStatus.PENDING_CONNECTION]: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-600 dark:text-amber-400',
    label: 'Pending',
  },
  [ProspectStatus.IN_SEQUENCE]: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-600 dark:text-blue-400',
    label: 'Messaged',
  },
};
