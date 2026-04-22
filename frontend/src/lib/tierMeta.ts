import { ProspectTier } from '@/types';

export interface TierMeta {
  value: ProspectTier;
  fullLabel: string;   // shown in modal dropdown + tooltip on pill
  pillLabel: string;   // compact label on the card pill
  pillClasses: string; // Tailwind utility string: bg + text colors
}

export const TIER_META: Record<ProspectTier, TierMeta> = {
  [ProspectTier.S_TIER_FLAGSHIP]: {
    value: ProspectTier.S_TIER_FLAGSHIP,
    fullLabel: 'S-tier flagship',
    pillLabel: 'S · Flagship',
    pillClasses: 'bg-amber-500/20 text-amber-300 ring-1 ring-amber-400/30',
  },
  [ProspectTier.A_TIER_FLAGSHIP]: {
    value: ProspectTier.A_TIER_FLAGSHIP,
    fullLabel: 'A-tier flagship',
    pillLabel: 'A · Flagship',
    pillClasses: 'bg-emerald-500/20 text-emerald-400',
  },
  [ProspectTier.B_TIER_FLAGSHIP]: {
    value: ProspectTier.B_TIER_FLAGSHIP,
    fullLabel: 'B-tier flagship',
    pillLabel: 'B · Flagship',
    pillClasses: 'bg-blue-500/20 text-blue-400',
  },
  [ProspectTier.COMMERCIAL_SPECIALIST]: {
    value: ProspectTier.COMMERCIAL_SPECIALIST,
    fullLabel: 'Commercial specialist',
    pillLabel: 'Commercial',
    pillClasses: 'bg-purple-500/20 text-purple-400',
  },
  [ProspectTier.DEVELOPMENTAL]: {
    value: ProspectTier.DEVELOPMENTAL,
    fullLabel: 'Developmental',
    pillLabel: 'Developmental',
    pillClasses: 'bg-stone-500/20 text-stone-300',
  },
};

/**
 * Display/sort order (surfaces S first, Developmental last). Used by the
 * modal dropdown, the bulk popover, and the tier_asc sort key.
 */
export const TIER_ORDER: readonly ProspectTier[] = [
  ProspectTier.S_TIER_FLAGSHIP,
  ProspectTier.A_TIER_FLAGSHIP,
  ProspectTier.B_TIER_FLAGSHIP,
  ProspectTier.COMMERCIAL_SPECIALIST,
  ProspectTier.DEVELOPMENTAL,
] as const;

/**
 * Numeric rank for sortProspects (lower = surfaces first). Null/unknown
 * returns +Infinity so untagged cards sort last. This lets `sortProspects`
 * reuse its `nullsLast` helper with a numeric comparator.
 */
export function tierRank(tier: ProspectTier | null | undefined): number {
  if (!tier) return Number.POSITIVE_INFINITY;
  const idx = TIER_ORDER.indexOf(tier);
  return idx === -1 ? Number.POSITIVE_INFINITY : idx;
}
