import type { CallProspect } from '@/types';
import { parseBackendDatetime } from './callbackFormat';

/**
 * Available sort keys for the Cold Calls kanban. Each key orders prospects
 * within every column. Applied client-side after the API has returned its
 * own `updated_at DESC` ordering.
 */
export type SortKey =
  | 'default'
  | 'name_asc'
  | 'name_desc'
  | 'rating_desc'
  | 'rating_asc'
  | 'reviews_desc'
  | 'callback_asc'
  | 'created_desc'
  | 'updated_desc';

export interface SortOption {
  key: SortKey;
  label: string;
}

/**
 * Dropdown options in display order. `default` first so a fresh load shows
 * the API's own ordering without the user picking it.
 */
export const SORT_OPTIONS: readonly SortOption[] = [
  { key: 'default', label: 'Default' },
  { key: 'name_asc', label: 'Business name · A→Z' },
  { key: 'name_desc', label: 'Business name · Z→A' },
  { key: 'rating_desc', label: 'Rating · high → low' },
  { key: 'rating_asc', label: 'Rating · low → high' },
  { key: 'reviews_desc', label: 'Reviews · high → low' },
  { key: 'callback_asc', label: 'Callback · soonest' },
  { key: 'created_desc', label: 'Recently added' },
  { key: 'updated_desc', label: 'Recently updated' },
] as const;

/**
 * Returns a new array sorted by the chosen key. Null values always sort to
 * the end regardless of direction — the user picked a sort because they
 * want prospects WITH data in that field to surface. Ties break by
 * `id DESC` for deterministic rendering.
 *
 * `'default'` is a pass-through: the API already sorted by `updated_at DESC`
 * and we don't want to re-order a fresh load.
 */
export function sortProspects(
  list: CallProspect[],
  key: SortKey,
): CallProspect[] {
  if (key === 'default') return list;
  const copy = list.slice();
  copy.sort(compareBuilders[key]);
  return copy;
}

type Comparator = (a: CallProspect, b: CallProspect) => number;

/**
 * Nulls-last helper. `getValue` returns the comparable value or null.
 * `direction` is +1 for ascending, -1 for descending.
 */
function nullsLast<T>(
  getValue: (p: CallProspect) => T | null | undefined,
  direction: 1 | -1,
  compare: (a: T, b: T) => number,
): Comparator {
  return (a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    const aNull = av === null || av === undefined;
    const bNull = bv === null || bv === undefined;
    if (aNull && bNull) return b.id - a.id;
    if (aNull) return 1;
    if (bNull) return -1;
    const primary = compare(av as T, bv as T) * direction;
    if (primary !== 0) return primary;
    return b.id - a.id;
  };
}

const compareStrings = (a: string, b: string): number =>
  a.localeCompare(b, undefined, { sensitivity: 'base' });

const compareNumbers = (a: number, b: number): number => a - b;

const compareDatetimes = (a: string, b: string): number =>
  parseBackendDatetime(a).getTime() - parseBackendDatetime(b).getTime();

const compareBuilders: Record<Exclude<SortKey, 'default'>, Comparator> = {
  name_asc: nullsLast((p) => p.business_name, 1, compareStrings),
  name_desc: nullsLast((p) => p.business_name, -1, compareStrings),
  rating_desc: nullsLast((p) => p.rating, -1, compareNumbers),
  rating_asc: nullsLast((p) => p.rating, 1, compareNumbers),
  reviews_desc: nullsLast((p) => p.reviews_count, -1, compareNumbers),
  callback_asc: nullsLast((p) => p.callback_at, 1, compareDatetimes),
  created_desc: nullsLast((p) => p.created_at, -1, compareDatetimes),
  updated_desc: nullsLast((p) => p.updated_at, -1, compareDatetimes),
};
