import { cn } from '@/lib/utils';

/**
 * Canonical input field classes for all Outreach Hub form inputs.
 * Use this for: <input>, <textarea>, <select>.
 *
 * For textareas, append 'resize-none' via cn():
 *   <textarea className={cn(inputClasses, 'resize-none')} />
 *
 * For selects with custom appearance, append 'cursor-pointer appearance-none':
 *   <select className={cn(inputClasses, 'cursor-pointer appearance-none')} />
 */
export const inputClasses = cn(
  'w-full px-4 py-2.5 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] placeholder:text-[--exec-text-muted]',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all text-sm'
);

/**
 * Variant for slightly tighter selects in dense lists (e.g., CSV column mapping).
 */
export const selectClassesCompact = cn(
  'w-full px-3 py-2 rounded-lg',
  'bg-stone-800/50 border border-stone-600/40',
  'text-[--exec-text] text-sm',
  'focus:outline-none focus:ring-2 focus:ring-[--exec-accent]/20 focus:border-[--exec-accent]/50',
  'transition-all cursor-pointer'
);

/**
 * Canonical primary button classes — use this directly or compose with cn().
 */
export const primaryButtonClasses = cn(
  'px-4 py-2 text-sm font-medium text-white',
  'bg-[--exec-accent] rounded-lg',
  'hover:bg-[--exec-accent-dark] shadow-sm hover:shadow-md',
  'transition-all',
  'disabled:opacity-50 disabled:cursor-not-allowed'
);

/**
 * Canonical secondary/cancel button classes.
 */
export const secondaryButtonClasses = cn(
  'px-4 py-2 text-sm font-medium text-[--exec-text-secondary]',
  'bg-stone-700/50 rounded-lg',
  'hover:bg-stone-600/50 transition-colors'
);

/**
 * Canonical icon-only button classes.
 */
export const iconButtonClasses = cn(
  'p-1.5 text-[--exec-text-muted]',
  'hover:text-[--exec-text] hover:bg-[--exec-surface-alt]',
  'rounded-lg transition-colors'
);

/**
 * Canonical stat card shell — used by <HubStatsBar>.
 * Pair with `statCardLabelClasses`, `statCardValueClasses`, and an entry from
 * `statCardAccents` for the icon + count color.
 */
export const statCardClasses = cn(
  'bg-stone-800/50 border border-stone-600/40 rounded-xl p-4'
);

/**
 * Uppercase label inside a stat card.
 */
export const statCardLabelClasses = cn(
  'text-xs font-medium text-[--exec-text-muted] uppercase tracking-wider'
);

/**
 * Large count value inside a stat card. Compose with an accent text color
 * from `statCardAccents`.
 */
export const statCardValueClasses = 'text-2xl font-bold';

/**
 * Accent text-color palette for stat card icons + count values.
 */
export type StatAccent =
  | 'blue'
  | 'amber'
  | 'green'
  | 'emerald'
  | 'red'
  | 'rose'
  | 'purple'
  | 'stone';

export const statCardAccents: Record<StatAccent, string> = {
  blue: 'text-blue-400',
  amber: 'text-amber-400',
  green: 'text-green-400',
  emerald: 'text-emerald-400',
  red: 'text-red-400',
  rose: 'text-rose-400',
  purple: 'text-purple-400',
  stone: 'text-stone-500',
};

/**
 * Canonical kanban column shell — compose with an entry from
 * `kanbanColumnAccents` for the top border accent color.
 */
export const kanbanColumnClasses = cn(
  'bg-stone-900/30 rounded-xl p-3 min-w-[220px] flex-1',
  'border-t-2 transition-all'
);

export type KanbanAccent =
  | 'blue'
  | 'purple'
  | 'amber'
  | 'green'
  | 'emerald'
  | 'rose'
  | 'red';

export const kanbanColumnAccents: Record<KanbanAccent, string> = {
  blue: 'border-t-blue-500',
  purple: 'border-t-purple-500',
  amber: 'border-t-amber-500',
  green: 'border-t-green-500',
  emerald: 'border-t-emerald-500',
  rose: 'border-t-rose-500',
  red: 'border-t-red-500',
};

export const kanbanColumnTitleAccents: Record<KanbanAccent, string> = {
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  amber: 'text-amber-400',
  green: 'text-green-400',
  emerald: 'text-emerald-400',
  rose: 'text-rose-400',
  red: 'text-red-400',
};

export const kanbanCountBadgeAccents: Record<KanbanAccent, string> = {
  blue: 'bg-blue-500/20 text-blue-400',
  purple: 'bg-purple-500/20 text-purple-400',
  amber: 'bg-amber-500/20 text-amber-400',
  green: 'bg-green-500/20 text-green-400',
  emerald: 'bg-emerald-500/20 text-emerald-400',
  rose: 'bg-rose-500/20 text-rose-400',
  red: 'bg-red-500/20 text-red-400',
};

/**
 * Canonical prospect card shell. Compose with `prospectCardHoverClasses` for
 * normal cards and `prospectCardDraggingClasses` when drag-in-progress.
 */
export const prospectCardClasses = cn(
  'bg-stone-800/50 border border-stone-600/40 rounded-lg p-4',
  'transition-all duration-150'
);

export const prospectCardHoverClasses = cn(
  'hover:border-stone-500/60 hover:shadow-lg'
);

export const prospectCardDraggingClasses = cn(
  'opacity-50 scale-95 ring-2 ring-blue-500/40'
);

export const prospectCardSelectedClasses = cn(
  'border-[--exec-accent] shadow-md'
);
