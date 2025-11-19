import { RecurrenceType } from '@/types';

const DAY_MAP: Record<string, number> = {
  'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
};

export function getNextOccurrences(
  startDateStr: string,
  type: RecurrenceType,
  interval: number,
  days: string[],
  endType: 'never' | 'date' | 'count',
  endDateStr?: string,
  count?: number,
  limit: number = 5
): string[] {
  if (!startDateStr) return [];
  
  const occurrences: string[] = [];
  let currentDate = new Date(startDateStr);
  
  // The start date is the first occurrence (usually)
  // But the user might want to know what happens *after* the start date?
  // Usually "Preview" shows the *next* generated dates.
  // But for clarity, showing the sequence starting from the next one is good.
  // Or should we include the start date if it matches the criteria?
  // The backend creates the task with start_date immediately.
  // The recurrence logic generates *future* occurrences.
  // So we should show the *future* ones.
  
  let iterations = 0;
  let created = 0;
  
  // Safety break
  while (created < limit && iterations < 1000) {
    iterations++;
    
    const nextDate = calculateNextDueDate(currentDate, type, interval, days);
    
    // Check end conditions
    if (endType === 'date' && endDateStr) {
      if (nextDate > new Date(endDateStr)) break;
    }
    if (endType === 'count' && count) {
      if (created >= count) break; // This logic is slightly off, count is total occurrences including first?
      // Backend: task.occurrences_created starts at 0.
      // create_all_future_occurrences runs loop range(max_iterations).
      // It checks `should_create_next_occurrence`.
      // If `task.occurrences_created >= task.recurrence_count`, it stops.
      // The parent task counts as 1? No, `occurrences_created` tracks *generated* ones?
      // Actually, usually the parent is #1.
      // Let's assume count includes the parent.
      // So if count is 5, we generate 4 more.
      if (created >= count - 1) break;
    }
    
    occurrences.push(nextDate.toISOString().split('T')[0]);
    currentDate = nextDate;
    created++;
  }
  
  return occurrences;
}

function calculateNextDueDate(
  currentDate: Date,
  type: RecurrenceType,
  interval: number,
  days: string[]
): Date {
  const next = new Date(currentDate);
  
  if (type === RecurrenceType.DAILY) {
    next.setDate(next.getDate() + interval);
  } else if (type === RecurrenceType.WEEKLY) {
    if (days && days.length > 0) {
      const currentDay = next.getDay(); // 0-6 (Sun-Sat)
      const targetDays = days.map(d => DAY_MAP[d]).sort((a, b) => a - b);
      
      // Find next day in the same week
      const nextDayInWeek = targetDays.find(d => d > currentDay);
      
      if (nextDayInWeek !== undefined) {
        next.setDate(next.getDate() + (nextDayInWeek - currentDay));
      } else {
        // Go to next interval
        // Days to next Sunday (start of next week? No, JS weeks start Sunday?)
        // Let's just add days to reach the first target day in the next interval.
        
        // Distance to end of week (next Saturday + 1 = next Sunday)
        // Actually, simpler:
        // 1. Move to start of next interval (current week start + 7 * interval)
        // 2. Find first target day.
        
        // But "Interval 2 weeks" means skip one week.
        // If we are on Friday, and next is Mon.
        // If interval is 1: Next Mon is in 3 days.
        // If interval is 2: Next Mon is in 10 days.
        
        // Calculate days to next occurrence of the FIRST target day
        // Days until next "First Target Day"
        // e.g. Today Fri(5). Target Mon(1).
        // Days to next Mon = (1 - 5 + 7) % 7 = 3.
        // If interval > 1, we add (interval - 1) * 7.
        
        const firstTarget = targetDays[0];
        let daysToAdd = (firstTarget - currentDay + 7) % 7;
        if (daysToAdd === 0) daysToAdd = 7; // Should not happen if we handled "same day" logic correctly? 
        // Wait, if today is Mon and target is Mon, we want next week (7 days).
        // But we already checked `d > currentDay`. So we are wrapping around.
        
        daysToAdd += (interval - 1) * 7;
        next.setDate(next.getDate() + daysToAdd);
      }
    } else {
      next.setDate(next.getDate() + (interval * 7));
    }
  } else if (type === RecurrenceType.MONTHLY) {
    next.setMonth(next.getMonth() + interval);
  } else if (type === RecurrenceType.YEARLY) {
    next.setFullYear(next.getFullYear() + interval);
  }
  
  return next;
}

export function getRecurrenceText(
  type: RecurrenceType,
  interval: number,
  days: string[],
  endType: 'never' | 'date' | 'count',
  endDateStr?: string,
  count?: number
): string {
  let text = '';
  
  // Interval text
  if (interval === 1) {
    text += type === RecurrenceType.DAILY ? 'Daily' :
            type === RecurrenceType.WEEKLY ? 'Weekly' :
            type === RecurrenceType.MONTHLY ? 'Monthly' : 'Yearly';
  } else {
    text += `Every ${interval} ${
      type === RecurrenceType.DAILY ? 'days' :
      type === RecurrenceType.WEEKLY ? 'weeks' :
      type === RecurrenceType.MONTHLY ? 'months' : 'years'
    }`;
  }
  
  // Days text
  if (type === RecurrenceType.WEEKLY && days.length > 0) {
    text += ` on ${days.join(', ')}`;
  }
  
  // End text
  if (endType === 'date' && endDateStr) {
    text += `, until ${new Date(endDateStr).toLocaleDateString()}`;
  } else if (endType === 'count' && count) {
    text += `, for ${count} occurrences`;
  }
  
  return text;
}
