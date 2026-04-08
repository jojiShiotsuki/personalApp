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
  'hover:text-[--exec-text] hover:bg-stone-700/50',
  'rounded-lg transition-colors'
);
