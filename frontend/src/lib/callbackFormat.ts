import { format, isSameDay, differenceInCalendarDays } from 'date-fns';

/**
 * Urgency tier for a scheduled callback. Drives the pill color in the card
 * and the sort order in the "Callbacks Due" filter (overdue first).
 */
export type CallbackTier =
  | 'overdue'
  | 'soon'       // <= 60 min away
  | 'today'      // later today, > 60 min away
  | 'tomorrow'
  | 'thisweek'   // within 7 days
  | 'future';    // > 7 days

export function callbackTier(at: Date, now: Date): CallbackTier {
  const diffMs = at.getTime() - now.getTime();
  if (diffMs < 0) return 'overdue';
  if (diffMs <= 60 * 60 * 1000) return 'soon';
  if (isSameDay(at, now)) return 'today';
  const days = differenceInCalendarDays(at, now);
  if (days === 1) return 'tomorrow';
  if (days <= 7) return 'thisweek';
  return 'future';
}

/**
 * Smart relative label for a callback pill.
 *
 * overdue  → "Overdue · 9:45 AM"
 * soon     → "Due in 45m"
 * today    → "Today 3:00 PM"
 * tomorrow → "Tomorrow 10:00 AM"
 * thisweek → "Wed 3:00 PM"
 * future   → "Apr 30 3:00 PM"
 */
export function formatCallbackLabel(at: Date, now: Date): string {
  const tier = callbackTier(at, now);
  const timeStr = format(at, 'h:mm a');

  switch (tier) {
    case 'overdue':
      return `Overdue · ${timeStr}`;
    case 'soon': {
      const minutes = Math.max(
        1,
        Math.round((at.getTime() - now.getTime()) / 60000),
      );
      return `Due in ${minutes}m`;
    }
    case 'today':
      return `Today ${timeStr}`;
    case 'tomorrow':
      return `Tomorrow ${timeStr}`;
    case 'thisweek':
      return `${format(at, 'EEE')} ${timeStr}`;
    case 'future':
      return `${format(at, 'MMM d')} ${timeStr}`;
  }
}

/**
 * True when a scheduled callback should count toward "Callbacks Due" —
 * i.e. at or before the end of today in the browser's local timezone.
 * Used by the stats bar count AND the filter predicate so they stay in sync.
 */
export function isDueByEndOfToday(at: Date, now: Date): boolean {
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  return at.getTime() <= endOfToday.getTime();
}

/**
 * Quick-preset values for the modal callback picker. All preset helpers
 * return a Date in local time.
 */
export function presetInOneHour(now: Date): Date {
  return roundUpTo5Min(new Date(now.getTime() + 60 * 60 * 1000));
}

export function presetInTwoHours(now: Date): Date {
  return roundUpTo5Min(new Date(now.getTime() + 120 * 60 * 1000));
}

export function presetTomorrowTenAm(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  return d;
}

export function presetNextMondayTenAm(now: Date): Date {
  const d = new Date(now);
  // getDay(): 0=Sun..6=Sat. Days until next Monday — always at least 1 day
  // ahead even if today is Monday.
  const daysAhead = ((1 - d.getDay() + 7) % 7) || 7;
  d.setDate(d.getDate() + daysAhead);
  d.setHours(10, 0, 0, 0);
  return d;
}

function roundUpTo5Min(d: Date): Date {
  const rounded = new Date(d);
  const minutes = rounded.getMinutes();
  const remainder = minutes % 5;
  if (remainder !== 0) {
    rounded.setMinutes(minutes + (5 - remainder));
  }
  rounded.setSeconds(0, 0);
  return rounded;
}

/**
 * `<input type="datetime-local">` needs a string in `YYYY-MM-DDTHH:mm`
 * representing local time. Returns empty string for null.
 */
export function toLocalInputValue(at: Date | null): string {
  if (!at) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}` +
    `T${pad(at.getHours())}:${pad(at.getMinutes())}`
  );
}

/**
 * Parse a `<input type="datetime-local">` value back into a Date (local).
 * Returns null for empty/invalid input.
 */
export function fromLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parse an ISO datetime string coming from the backend.
 *
 * The backend stores `callback_at` as a naive `DateTime` column and Pydantic
 * serializes it without a timezone suffix (e.g. `"2026-04-28T01:30:00"`).
 * Our invariant is "backend stores UTC" — but bare `new Date(s)` on such a
 * string parses as *local* time, producing an offset bug. Append `Z` when
 * the string lacks a timezone indicator so JS parses it as UTC.
 */
export function parseBackendDatetime(value: string): Date {
  const hasTz = /Z$|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTz ? value : `${value}Z`);
}
