import { differenceInCalendarDays, format, isSameDay } from 'date-fns';

/**
 * Urgency tier for a scheduled follow-up. Drives the pill color in the card
 * and the sort order in the "Follow-ups Due" filter (overdue first).
 *
 * Date-only semantics — there is no "soon" tier (no time-of-day to count down to).
 */
export type FollowUpTier =
  | 'overdue'
  | 'today'
  | 'tomorrow'
  | 'thisweek'   // 2..7 calendar days from today
  | 'future';    // > 7 calendar days

export function followUpTier(on: Date, today: Date): FollowUpTier {
  if (isSameDay(on, today)) return 'today';
  const days = differenceInCalendarDays(on, today);
  if (days < 0) return 'overdue';
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'thisweek';
  return 'future';
}

/**
 * Smart relative label for a follow-up pill.
 *
 * overdue  → "Overdue · Apr 22"
 * today    → "Today"
 * tomorrow → "Tomorrow"
 * thisweek → "Wed"
 * future   → "Apr 30"
 */
export function formatFollowUpLabel(on: Date, today: Date): string {
  const tier = followUpTier(on, today);
  switch (tier) {
    case 'overdue':
      return `Overdue · ${format(on, 'MMM d')}`;
    case 'today':
      return 'Today';
    case 'tomorrow':
      return 'Tomorrow';
    case 'thisweek':
      return format(on, 'EEE');
    case 'future':
      return format(on, 'MMM d');
  }
}

/**
 * True when a scheduled follow-up should count toward "Follow-ups Due" —
 * i.e. on or before today (calendar-day comparison, browser-local).
 * Used by both the stats bar count AND the filter predicate so they stay in sync.
 */
export function isFollowUpDueByEndOfToday(on: Date, today: Date): boolean {
  return differenceInCalendarDays(on, today) <= 0;
}

/**
 * Quick-preset values for the modal follow-up picker. All preset helpers
 * return a Date pinned to local-midnight (time component zeroed).
 */
export function presetTomorrow(today: Date): Date {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 1);
  return d;
}

export function presetInThreeDays(today: Date): Date {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 3);
  return d;
}

export function presetNextMonday(today: Date): Date {
  const d = startOfLocalDay(today);
  // getDay(): 0=Sun..6=Sat. Days until next Monday — always at least 1 day
  // ahead even if today is Monday (matches presetNextMondayTenAm in callbackFormat).
  const daysAhead = ((1 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + daysAhead);
  return d;
}

export function presetInTwoWeeks(today: Date): Date {
  const d = startOfLocalDay(today);
  d.setDate(d.getDate() + 14);
  return d;
}

function startOfLocalDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/**
 * `<input type="date">` needs a string in `YYYY-MM-DD` representing local
 * calendar date. Returns empty string for null.
 */
export function toLocalDateInputValue(on: Date | null): string {
  if (!on) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${on.getFullYear()}-${pad(on.getMonth() + 1)}-${pad(on.getDate())}`;
}

/**
 * Parse a `<input type="date">` value back into a local-midnight Date.
 * Returns null for empty/invalid input.
 *
 * Note: `new Date("2026-04-30")` parses as UTC-midnight, which can render
 * as the previous day in negative-UTC timezones. Splitting and using the
 * Date(y, m-1, d) constructor pins to local-midnight reliably.
 */
export function fromLocalDateInputValue(value: string): Date | null {
  if (!value) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const d = new Date(year, month - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse an ISO date string coming from the backend (e.g. `"2026-04-30"`).
 *
 * The backend stores `follow_up_on` as a Date column and Pydantic serializes
 * it as `"YYYY-MM-DD"`. We construct a local-midnight Date so calendar-day
 * comparisons against `new Date()` ("today") behave consistently in any
 * timezone. This is the date-only counterpart to `parseBackendDatetime` in
 * callbackFormat.ts (which had to deal with naive UTC datetimes).
 */
export function parseBackendDate(value: string): Date {
  // Reuse the same defensive parse as fromLocalDateInputValue so a stray
  // datetime suffix (e.g. `"2026-04-30T00:00:00"`) still works — split on
  // the first non-digit non-dash character.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!m) return new Date(NaN);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
