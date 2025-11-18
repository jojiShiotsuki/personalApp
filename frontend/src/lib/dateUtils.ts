import {
  getISOWeek,
  startOfISOWeek,
  endOfISOWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  format,
  parse,
  isWithinInterval,
} from 'date-fns';

/**
 * Represents a week with its number and date range
 */
export interface Week {
  weekNumber: number;
  startDate: Date;
  endDate: Date;
  year: number;
  month: number;
}

/**
 * Get the ISO week number for a given date
 */
export function getWeekNumber(date: Date): number {
  return getISOWeek(date);
}

/**
 * Get all ISO weeks that overlap with a given month
 * Returns weeks that contain days from the specified month
 */
export function getWeeksInMonth(year: number, month: number): Week[] {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);

  const weeks: Week[] = [];
  const processedWeeks = new Set<number>();

  // Start from the beginning of the first week
  let currentDate = startOfISOWeek(monthStart);

  while (currentDate <= monthEnd) {
    const weekNum = getISOWeek(currentDate);

    if (!processedWeeks.has(weekNum)) {
      processedWeeks.add(weekNum);

      const weekStart = startOfISOWeek(currentDate);
      const weekEnd = endOfISOWeek(currentDate);

      // Only include if week overlaps with the month
      if (
        isWithinInterval(weekStart, { start: monthStart, end: monthEnd }) ||
        isWithinInterval(weekEnd, { start: monthStart, end: monthEnd }) ||
        (weekStart < monthStart && weekEnd > monthEnd)
      ) {
        weeks.push({
          weekNumber: weekNum,
          startDate: weekStart,
          endDate: weekEnd,
          year: currentDate.getFullYear(),
          month,
        });
      }
    }

    // Move to next week
    currentDate = new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000);
  }

  return weeks;
}

/**
 * Get the date range for a specific ISO week
 */
export function getWeekDateRange(
  year: number,
  weekNumber: number
): [Date, Date] {
  // Find a date in the target week
  const jan4 = new Date(year, 0, 4);
  const weekOneStart = startOfISOWeek(jan4);
  const targetWeekStart = new Date(
    weekOneStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000
  );

  const weekStart = startOfISOWeek(targetWeekStart);
  const weekEnd = endOfISOWeek(targetWeekStart);

  return [weekStart, weekEnd];
}

/**
 * Get all days in a week as an array of dates
 */
export function getDaysInWeek(year: number, weekNumber: number): Date[] {
  const [weekStart, weekEnd] = getWeekDateRange(year, weekNumber);
  return eachDayOfInterval({ start: weekStart, end: weekEnd });
}

/**
 * Get all days in a month as an array of dates
 */
export function getDaysInMonth(year: number, month: number): Date[] {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  return eachDayOfInterval({ start: monthStart, end: monthEnd });
}

/**
 * Format a date as a readable string
 * Defaults to 'MMM dd, yyyy' format (e.g., 'Nov 18, 2025')
 */
export function formatDate(date: Date, formatStr: string = 'MMM dd, yyyy'): string {
  return format(date, formatStr);
}

/**
 * Format a date as day of week (e.g., 'Monday')
 */
export function formatDayOfWeek(date: Date): string {
  return format(date, 'EEEE');
}

/**
 * Format a date as day and month (e.g., 'Nov 18')
 */
export function formatDayAndMonth(date: Date): string {
  return format(date, 'MMM dd');
}

/**
 * Parse a date string using the specified format
 */
export function parseDate(dateString: string, formatStr: string = 'yyyy-MM-dd'): Date {
  return parse(dateString, formatStr, new Date());
}

/**
 * Get a human-readable date range string
 * e.g., "Nov 18 - 24, 2025"
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  const startMonth = format(startDate, 'MMM');
  const startDay = format(startDate, 'dd');
  const endDay = format(endDate, 'dd');
  const year = format(endDate, 'yyyy');

  // If in same month, use "MMM DD - DD, YYYY" format
  if (format(startDate, 'MM') === format(endDate, 'MM')) {
    return `${startMonth} ${startDay} - ${endDay}, ${year}`;
  }

  // If in different months, use "MMM DD - MMM DD, YYYY" format
  const endMonth = format(endDate, 'MMM');
  return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
}

/**
 * Check if a date falls within a specific month
 */
export function isDateInMonth(date: Date, year: number, month: number): boolean {
  const monthStart = startOfMonth(new Date(year, month - 1, 1));
  const monthEnd = endOfMonth(monthStart);
  return isWithinInterval(date, { start: monthStart, end: monthEnd });
}

/**
 * Get the ISO week number as a string with year context
 * e.g., "W47" or "W1" for week 1
 */
export function formatWeekNumber(weekNumber: number): string {
  return `W${weekNumber}`;
}

/**
 * Get the month name for a given month number (1-12)
 * e.g., 1 -> "January", 12 -> "December"
 */
export function getMonthName(month: number): string {
  const date = new Date(2025, month - 1, 1);
  return format(date, 'MMMM');
}
