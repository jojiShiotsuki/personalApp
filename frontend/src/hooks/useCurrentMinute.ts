import { useEffect, useState } from 'react';

/**
 * Returns a Date pinned to the current wall-clock minute. Re-renders the
 * consumer once per minute so components that format relative times
 * ("Due in 5m", "Overdue") stay fresh without a full page refresh.
 *
 * The tick schedules itself to fire at the next minute boundary so callers
 * flip tiers at the same second across the app (e.g. all "In 1m" pills
 * become "Overdue" simultaneously).
 */
export function useCurrentMinute(): Date {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const msUntilNextMinute =
      60_000 - (Date.now() % 60_000);

    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, msUntilNextMinute);

    return () => {
      clearTimeout(timeout);
      if (interval !== undefined) clearInterval(interval);
    };
  }, []);

  return now;
}
