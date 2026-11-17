import { LibrarySettings, Loan, PatronTierPolicy, UserProfile } from '../types';

/**
 * Maldivian School Working Calendar Utilities
 * In the Republic of Maldives, the official school/work week runs from Sunday through Thursday.
 * Friday (5) and Saturday (6) are weekend holidays, alongside official Maldivian public & term holidays.
 */

// 0: Sunday, 1: Monday, 2: Tuesday, 3: Wednesday, 4: Thursday, 5: Friday, 6: Saturday
export const MALDIVES_WEEKEND_DAYS = [5, 6]; // Friday & Saturday

export const DEFAULT_MALDIVES_SCHOOL_HOLIDAYS: string[] = [
  '2026-01-01', // New Year's Day
  '2026-03-20', // Eid al-Fitr Holiday
  '2026-03-21',
  '2026-03-22',
  '2026-05-01', // International Workers' Day
  '2026-05-27', // Eid al-Adha Holiday
  '2026-05-28',
  '2026-05-29',
  '2026-07-26', // Maldives Independence Day
  '2026-07-27', // Independence Day Holiday
  '2026-09-10', // National Day (Qaumee Dhuvas)
  '2026-11-03', // Victory Day
  '2026-11-11', // Republic Day
];

function toIsoDateKey(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isSchoolWorkingDay(date: Date, holidays: string[] = DEFAULT_MALDIVES_SCHOOL_HOLIDAYS): boolean {
  const day = date.getUTCDay();
  if (MALDIVES_WEEKEND_DAYS.includes(day)) return false;
  if (holidays.length > 0 && holidays.includes(toIsoDateKey(date))) return false;
  return true;
}

/**
 * Calculates a due date considering Maldivian school working days (Sunday–Thursday, excluding holidays).
 */
export function calculateSchoolDueDate(
  startDate: Date = new Date(),
  workingDays: number = 14,
  holidays: string[] = DEFAULT_MALDIVES_SCHOOL_HOLIDAYS
): string {
  const cursor = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()));

  let addedDays = 0;
  let guard = 0;
  while (addedDays < workingDays && guard < 365) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isSchoolWorkingDay(cursor, holidays)) {
      addedDays++;
    }
    guard++;
  }

  while (!isSchoolWorkingDay(cursor, holidays) && guard < 400) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    guard++;
  }

  return toIsoDateKey(cursor);
}

/**
 * Calculates overdue days ignoring Friday/Saturday weekends and configured Maldivian school holidays.
 */
export function calculateWorkingDaysOverdue(
  dueDateStr: string,
  returnDateStr?: string,
  pauseWeekend: boolean = true,
  holidays: string[] = DEFAULT_MALDIVES_SCHOOL_HOLIDAYS
): number {
  const todayStr = returnDateStr || new Date().toISOString().split('T')[0];
  if (todayStr <= dueDateStr) return 0;

  const start = new Date(dueDateStr + 'T00:00:00Z');
  const end = new Date(todayStr + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  if (!pauseWeekend) {
    const diff = Math.round((end.getTime() - start.getTime()) / (1000 * 3600 * 24));
    return Math.max(0, diff);
  }

  let overdueWorkingDays = 0;
  const cursor = new Date(start);
  let guard = 0;

  while (cursor < end && guard < 730) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (isSchoolWorkingDay(cursor, holidays)) {
      overdueWorkingDays++;
    }
    guard++;
  }

  return overdueWorkingDays;
}

/**
 * Resolves the patron's active CirculationPolicy tier rules (Koha-style policy matrix).
 */
export function resolvePatronCirculationPolicy(
  patron: Pick<UserProfile, 'role' | 'patronTier'> | undefined | null,
  settings: LibrarySettings
): PatronTierPolicy & { tier: 'student' | 'teacher' | 'staff' | 'external' } {
  const tier: 'student' | 'teacher' | 'staff' | 'external' =
    patron?.patronTier === 'teacher' ||
    patron?.patronTier === 'staff' ||
    patron?.patronTier === 'external' ||
    patron?.patronTier === 'student'
      ? patron.patronTier
      : patron?.role === 'staff' || patron?.role === 'admin'
      ? 'staff'
      : patron?.role === 'parent'
      ? 'external'
      : 'student';

  const rule = settings.patronTierRules?.[tier];
  if (rule) {
    return {
      tier,
      maxBooks: rule.maxBooks,
      loanDays: rule.loanDays,
      maxRenewals: rule.maxRenewals,
      dailyFineMvr: rule.dailyFineMvr,
      graceDays: rule.graceDays ?? settings.gracePeriodDays ?? 2,
      allowReferenceCheckout: rule.allowReferenceCheckout ?? (tier === 'staff' || tier === 'teacher'),
    };
  }

  const isStaff = tier === 'staff' || tier === 'teacher';
  return {
    tier,
    maxBooks: isStaff ? (settings.maxBooksPerStaff ?? 7) : (settings.maxBooksPerStudent ?? 3),
    loanDays: isStaff ? (settings.staffBorrowDays ?? 30) : (settings.maxBorrowDays ?? 14),
    maxRenewals: settings.maxRenewals ?? 2,
    dailyFineMvr: settings.lateFeePerDay ?? 2.0,
    graceDays: settings.gracePeriodDays ?? 2,
    allowReferenceCheckout: isStaff ? (settings.allowReferenceCheckoutForStaff ?? true) : false,
  };
}

export interface PolicyFineCalculation {
  tier: 'student' | 'teacher' | 'staff' | 'external';
  workingDaysOverdue: number;
  graceDays: number;
  chargeableDays: number;
  dailyFineMvr: number;
  calculatedFineMvr: number;
  capApplied: boolean;
}

/**
 * Automated Fine Engine calculating overdue MVR based on patron CirculationPolicy,
 * excluding configured Fridays/Saturdays and Maldivian school holidays.
 */
export function calculatePolicyOverdueFine(params: {
  loan: Pick<Loan, 'dueDate'>;
  patron?: Pick<UserProfile, 'role' | 'patronTier'> | null;
  settings: LibrarySettings;
  returnDateStr?: string;
}): PolicyFineCalculation {
  const { loan, patron, settings, returnDateStr } = params;
  const policy = resolvePatronCirculationPolicy(patron, settings);
  const pauseNonWorking = settings.holidayGraceDays ?? true;
  const holidays = settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS;

  const workingDaysOverdue = calculateWorkingDaysOverdue(
    loan.dueDate,
    returnDateStr,
    pauseNonWorking,
    pauseNonWorking ? holidays : []
  );
  const chargeableDays = Math.max(0, workingDaysOverdue - policy.graceDays);
  const rawFine = chargeableDays * policy.dailyFineMvr;
  const cap = settings.maxOverdueFineCap ?? 100;
  const calculatedFineMvr = Number(Math.min(cap, rawFine).toFixed(2));

  return {
    tier: policy.tier,
    workingDaysOverdue,
    graceDays: policy.graceDays,
    chargeableDays,
    dailyFineMvr: policy.dailyFineMvr,
    calculatedFineMvr,
    capApplied: rawFine > cap,
  };
}
