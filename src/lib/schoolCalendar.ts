/**
 * Maldivian School Working Calendar Utilities
 * In the Republic of Maldives, the official school/work week runs from Sunday through Thursday.
 * Friday and Saturday are weekend holidays.
 */

// 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
export const MALDIVES_WEEKEND_DAYS = [5, 6]; // Friday & Saturday

export function isSchoolWorkingDay(date: Date): boolean {
  const day = date.getDay();
  return !MALDIVES_WEEKEND_DAYS.includes(day);
}

/**
 * Calculates a due date considering school working days (Sunday-Thursday).
 * If target fall day lands on Friday or Saturday, it automatically moves to Sunday.
 * @param startDate Starting issue date (defaults to today)
 * @param workingDays Number of school working days to lend
 * @returns ISO date string YYYY-MM-DD
 */
export function calculateSchoolDueDate(startDate: Date = new Date(), workingDays: number = 14): string {
  const cursor = new Date(startDate);
  cursor.setHours(0, 0, 0, 0);

  let addedDays = 0;
  while (addedDays < workingDays) {
    cursor.setDate(cursor.getDate() + 1);
    if (isSchoolWorkingDay(cursor)) {
      addedDays++;
    }
  }

  // Ensure final due date is strictly a school working day (Sunday-Thursday)
  while (!isSchoolWorkingDay(cursor)) {
    cursor.setDate(cursor.getDate() + 1);
  }

  return cursor.toISOString().split('T')[0];
}

/**
 * Calculates overdue days ignoring Friday/Saturday weekend days if holiday grace is enabled.
 */
export function calculateWorkingDaysOverdue(dueDateStr: string, returnDateStr?: string, pauseWeekend: boolean = true): number {
  const todayStr = returnDateStr || new Date().toISOString().split('T')[0];
  if (todayStr <= dueDateStr) return 0;

  const start = new Date(dueDateStr + 'T00:00:00Z');
  const end = new Date(todayStr + 'T00:00:00Z');

  if (!pauseWeekend) {
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    return Math.max(0, diff);
  }

  let overdueWorkingDays = 0;
  const cursor = new Date(start);

  while (cursor < end) {
    cursor.setDate(cursor.getDate() + 1);
    if (isSchoolWorkingDay(cursor)) {
      overdueWorkingDays++;
    }
  }

  return overdueWorkingDays;
}
