import {
  Book,
  LibrarySettings,
  Loan,
  ReminderScheduleConfig,
  UserProfile,
} from '../types';
import {
  calculatePolicyOverdueFine,
  calculateWorkingDaysOverdue,
  DEFAULT_MALDIVES_SCHOOL_HOLIDAYS,
  isSchoolWorkingDay,
  MALDIVES_WEEKEND_DAYS,
} from './schoolCalendar';
import {
  draftOverdueReminder,
  HighRiskLoanAlert,
  ReminderChannel,
  ReminderDraftResult,
} from '../services/ai/insightsService';

export const DEFAULT_REMINDER_SCHEDULER_CONFIG: ReminderScheduleConfig = {
  enabled: true,
  cadence: 'daily_school_morning',
  runTimeLocal: '08:30',
  riskThresholdPct: 50,
  defaultChannel: 'whatsapp',
  includeBilingual: true,
  notifyParentsForStudents: true,
  skipMaldivianHolidays: true,
};

export function resolveReminderSchedulerConfig(
  settings?: Partial<LibrarySettings> | null
): ReminderScheduleConfig {
  const raw = settings?.reminderScheduler;
  return {
    enabled: raw?.enabled ?? DEFAULT_REMINDER_SCHEDULER_CONFIG.enabled,
    cadence: raw?.cadence ?? DEFAULT_REMINDER_SCHEDULER_CONFIG.cadence,
    runTimeLocal: raw?.runTimeLocal || DEFAULT_REMINDER_SCHEDULER_CONFIG.runTimeLocal,
    riskThresholdPct:
      typeof raw?.riskThresholdPct === 'number'
        ? raw.riskThresholdPct
        : DEFAULT_REMINDER_SCHEDULER_CONFIG.riskThresholdPct,
    defaultChannel: raw?.defaultChannel ?? DEFAULT_REMINDER_SCHEDULER_CONFIG.defaultChannel,
    includeBilingual: raw?.includeBilingual ?? DEFAULT_REMINDER_SCHEDULER_CONFIG.includeBilingual,
    notifyParentsForStudents:
      raw?.notifyParentsForStudents ??
      settings?.notifyParentOnOverdue ??
      DEFAULT_REMINDER_SCHEDULER_CONFIG.notifyParentsForStudents,
    skipMaldivianHolidays:
      raw?.skipMaldivianHolidays ??
      settings?.holidayGraceDays ??
      DEFAULT_REMINDER_SCHEDULER_CONFIG.skipMaldivianHolidays,
    lastAutoRunAt: raw?.lastAutoRunAt,
  };
}

export interface PatronLoanHistoryStats {
  userId: string;
  totalLoans: number;
  completedCount: number;
  lateCount: number;
  activeOverdueCount: number;
  totalRenewals: number;
  totalFinesMvr: number;
  lateRatePct: number;
  onTimeStreak: number;
}

export function analyzePatronLoanHistory(
  loans: Loan[]
): Record<string, PatronLoanHistoryStats> {
  const grouped = new Map<string, Loan[]>();
  for (const loan of loans) {
    if (!loan.userId) continue;
    const arr = grouped.get(loan.userId) || [];
    arr.push(loan);
    grouped.set(loan.userId, arr);
  }

  const result: Record<string, PatronLoanHistoryStats> = {};
  for (const [userId, userLoans] of grouped.entries()) {
    let completedCount = 0;
    let lateCount = 0;
    let activeOverdueCount = 0;
    let totalRenewals = 0;
    let totalFinesMvr = 0;

    const sortedReturned = [...userLoans]
      .filter((l) => l.status === 'returned')
      .sort((a, b) => (b.returnDate || b.dueDate).localeCompare(a.returnDate || a.dueDate));

    for (const loan of userLoans) {
      totalRenewals += loan.renewalCount || 0;
      totalFinesMvr += loan.lateFee || 0;
      if (loan.status === 'returned') {
        completedCount += 1;
      }
      if (loan.status === 'overdue') {
        activeOverdueCount += 1;
      }
      const wasLate =
        loan.status === 'overdue' ||
        (loan.lateFee || 0) > 0 ||
        Boolean(loan.returnDate && loan.dueDate && loan.returnDate > loan.dueDate);
      if (wasLate) {
        lateCount += 1;
      }
    }

    let onTimeStreak = 0;
    for (const ret of sortedReturned) {
      const wasLate =
        (ret.lateFee || 0) > 0 ||
        Boolean(ret.returnDate && ret.dueDate && ret.returnDate > ret.dueDate);
      if (wasLate) break;
      onTimeStreak += 1;
    }

    const totalLoans = userLoans.length;
    result[userId] = {
      userId,
      totalLoans,
      completedCount,
      lateCount,
      activeOverdueCount,
      totalRenewals,
      totalFinesMvr: Number(totalFinesMvr.toFixed(2)),
      lateRatePct: totalLoans > 0 ? Math.round((lateCount / totalLoans) * 100) : 0,
      onTimeStreak,
    };
  }

  return result;
}

function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function countWorkingDaysUntil(
  fromIso: string,
  dueIso: string,
  skipHolidays: boolean,
  holidays: string[]
): number {
  if (!dueIso || dueIso <= fromIso) return 0;
  const start = new Date(`${fromIso}T00:00:00Z`);
  const end = new Date(`${dueIso}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;

  let count = 0;
  const cursor = new Date(start);
  let guard = 0;
  while (cursor < end && guard < 365) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const activeHolidays = skipHolidays ? holidays : [];
    if (isSchoolWorkingDay(cursor, activeHolidays)) {
      count += 1;
    }
    guard += 1;
  }
  return count;
}

export type ScheduledRiskLevel = 'CRITICAL' | 'ELEVATED' | 'WATCH';

export interface ScheduledReminderCandidate {
  loan: Loan;
  patron?: UserProfile;
  parent?: UserProfile;
  book?: Book;
  gradeClass: string;
  riskScore: number;
  riskLevel: ScheduledRiskLevel;
  isPreventive: boolean;
  workingDaysOverdue: number;
  workingDaysRemaining: number;
  estimatedFineMvr: number;
  patronHistory: PatronLoanHistoryStats;
  reasonsEn: string[];
  reasonsDv: string[];
  historicalSummaryEn: string;
  historicalSummaryDv: string;
  recipientLabel: string;
  recipientEmail: string;
  recipientPhone: string;
  parentCopied: boolean;
}

export function predictScheduledReminders(params: {
  loans: Loan[];
  users: UserProfile[];
  books: Book[];
  settings: LibrarySettings;
  aiHighRiskLoans?: HighRiskLoanAlert[];
  referenceDate?: Date;
}): ScheduledReminderCandidate[] {
  const {
    loans,
    users,
    books,
    settings,
    aiHighRiskLoans = [],
    referenceDate = new Date(),
  } = params;

  const config = resolveReminderSchedulerConfig(settings);
  const holidays = config.skipMaldivianHolidays
    ? settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS
    : [];
  const todayIso = toIsoDate(
    new Date(
      Date.UTC(
        referenceDate.getFullYear(),
        referenceDate.getMonth(),
        referenceDate.getDate()
      )
    )
  );

  const historyByUser = analyzePatronLoanHistory(loans);
  const aiByLoanId = new Map(aiHighRiskLoans.map((item) => [item.id, item]));

  const candidates: ScheduledReminderCandidate[] = loans
    .filter((loan) => loan.status !== 'returned')
    .map((loan) => {
      const patron = users.find((u) => u.id === loan.userId || u.name === loan.userName);
      const parent = patron?.parentId
        ? users.find((u) => u.id === patron.parentId)
        : undefined;
      const book = books.find((b) => b.id === loan.bookId || b.isbn === loan.bookIsbn);

      const gradeClass =
        loan.userGrade ||
        patron?.grade ||
        (patron?.role === 'staff'
          ? patron.staffDepartment || 'Faculty & Staff'
          : 'School Member');

      const workingDaysOverdue = calculateWorkingDaysOverdue(
        loan.dueDate,
        todayIso,
        true,
        holidays
      );
      const workingDaysRemaining = countWorkingDaysUntil(
        todayIso,
        loan.dueDate,
        true,
        holidays
      );

      const isOverdue = loan.status === 'overdue' || workingDaysOverdue > 0;
      const policyFine = calculatePolicyOverdueFine({
        loan,
        patron,
        settings,
        returnDateStr: todayIso,
      });
      const existingOutstanding = Math.max(0, (loan.lateFee || 0) - (loan.amountPaid || 0));
      const estimatedFineMvr = Number(
        Math.max(existingOutstanding, isOverdue ? policyFine.calculatedFineMvr : 0).toFixed(2)
      );

      const stats: PatronLoanHistoryStats = historyByUser[loan.userId] || {
        userId: loan.userId,
        totalLoans: 1,
        completedCount: 0,
        lateCount: isOverdue ? 1 : 0,
        activeOverdueCount: isOverdue ? 1 : 0,
        totalRenewals: loan.renewalCount || 0,
        totalFinesMvr: estimatedFineMvr,
        lateRatePct: isOverdue ? 100 : 0,
        onTimeStreak: 0,
      };

      let riskScore = 12;
      const reasonsEn: string[] = [];
      const reasonsDv: string[] = [];

      if (isOverdue) {
        const overdueDays = Math.max(1, workingDaysOverdue);
        riskScore = Math.max(riskScore, 58 + Math.min(30, overdueDays * 4));
        reasonsEn.push(`${overdueDays} school day(s) overdue`);
        reasonsDv.push(`ސްކޫލް ${overdueDays} ދުވަސް ފަހަނައަޅާފައި`);
      } else if (workingDaysRemaining <= 2) {
        riskScore += 34;
        reasonsEn.push(
          workingDaysRemaining === 0
            ? 'Due today'
            : `Due in ${workingDaysRemaining} school day(s)`
        );
        reasonsDv.push(
          workingDaysRemaining === 0
            ? 'މިއަދު ސުންގަޑި ހަމަވޭ'
            : `ސުންގަޑިއަށް ބާކީ ${workingDaysRemaining} ސްކޫލް ދުވަސް`
        );
      } else if (workingDaysRemaining <= 5) {
        riskScore += 18;
        reasonsEn.push(`Due in ${workingDaysRemaining} school days`);
        reasonsDv.push(`ސުންގަޑިއަށް ${workingDaysRemaining} ދުވަސް`);
      }

      if ((loan.renewalCount || 0) >= 1) {
        riskScore += Math.min(18, (loan.renewalCount || 0) * 10);
        reasonsEn.push(`${loan.renewalCount} renewal(s) used`);
        reasonsDv.push(`${loan.renewalCount} ފަހަރު މުއްދަތު އިތުރުކޮށްފައި`);
      }

      if (stats.lateCount > 0) {
        const historyBoost =
          Math.min(28, Math.round(stats.lateRatePct * 0.35)) +
          (stats.lateCount >= 2 ? 6 : 0);
        riskScore += historyBoost;
        reasonsEn.push(`${stats.lateCount}/${stats.totalLoans} historical late loan(s)`);
        reasonsDv.push(`ތާރީޚީ ގޮތުން ${stats.totalLoans} ލޯނުން ${stats.lateCount} ލަސް`);
      }

      if (estimatedFineMvr > 0) {
        riskScore += 8;
        reasonsEn.push(`MVR ${estimatedFineMvr.toFixed(2)} balance`);
        reasonsDv.push(`MVR ${estimatedFineMvr.toFixed(2)} ޖޫރިމަނާ`);
      }

      const aiMatch = aiByLoanId.get(loan.id);
      if (aiMatch) {
        riskScore = Math.max(riskScore, aiMatch.riskScore);
      }

      const clampedScore = Math.min(99, Math.max(5, Math.round(riskScore)));
      const riskLevel: ScheduledRiskLevel =
        isOverdue || clampedScore >= 70
          ? 'CRITICAL'
          : clampedScore >= 45
          ? 'ELEVATED'
          : 'WATCH';

      const historicalSummaryEn = `${stats.lateCount}/${stats.totalLoans} past late (${stats.lateRatePct}%) · ${stats.totalRenewals} total renewals`;
      const historicalSummaryDv = `ތާރީޚު: ${stats.totalLoans} ލޯނުން ${stats.lateCount} ލަސް (${stats.lateRatePct}%)`;

      const useParent = Boolean(
        config.notifyParentsForStudents &&
          parent &&
          (patron?.role === 'student' || patron?.patronTier === 'student')
      );

      const recipientEmail = useParent
        ? parent?.email || patron?.email || ''
        : patron?.email || parent?.email || '';
      const recipientPhone = useParent
        ? parent?.phone || patron?.phone || ''
        : patron?.phone || parent?.phone || '';
      const recipientLabel = useParent && parent
        ? `${parent.name} · Parent of ${loan.userName}`
        : loan.userName;

      return {
        loan,
        patron,
        parent,
        book,
        gradeClass,
        riskScore: clampedScore,
        riskLevel,
        isPreventive: !isOverdue,
        workingDaysOverdue,
        workingDaysRemaining,
        estimatedFineMvr,
        patronHistory: stats,
        reasonsEn:
          reasonsEn.length > 0 ? reasonsEn : ['Active loan within borrowing window'],
        reasonsDv:
          reasonsDv.length > 0 ? reasonsDv : ['މުއްދަތު ހަމަވުމުގެ ކުރިން ބަލާލެވޭ ލޯން'],
        historicalSummaryEn,
        historicalSummaryDv,
        recipientLabel,
        recipientEmail,
        recipientPhone,
        parentCopied: useParent,
      };
    });

  return candidates.sort((a, b) => {
    if (b.riskScore !== a.riskScore) return b.riskScore - a.riskScore;
    if (b.workingDaysOverdue !== a.workingDaysOverdue) {
      return b.workingDaysOverdue - a.workingDaysOverdue;
    }
    return a.loan.dueDate.localeCompare(b.loan.dueDate);
  });
}

export interface NextScheduledRunInfo {
  nextRunIso: string;
  nextRunDateIso: string;
  timeLocal: string;
  skippedHolidayCount: number;
  displayEn: string;
  displayDv: string;
}

const WEEKDAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES_DV = [
  'އާދީއްތަ',
  'ހޯމަ',
  'އަންގާރަ',
  'ބުދަ',
  'ބުރާސްފަތި',
  'ހުކުރު',
  'ހޮނިހިރު',
];

export function computeNextScheduledRun(
  config: ReminderScheduleConfig,
  schoolHolidays: string[] = DEFAULT_MALDIVES_SCHOOL_HOLIDAYS,
  now: Date = new Date()
): NextScheduledRunInfo {
  const [hourStr, minStr] = (config.runTimeLocal || '08:30').split(':');
  const targetHour = Math.min(23, Math.max(0, Number(hourStr) || 8));
  const targetMin = Math.min(59, Math.max(0, Number(minStr) || 30));
  const timeFormatted = `${String(targetHour).padStart(2, '0')}:${String(targetMin).padStart(2, '0')}`;

  const activeHolidays = config.skipMaldivianHolidays ? schoolHolidays : [];
  const cursor = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const targetMinutes = targetHour * 60 + targetMin;

  if (nowMinutes >= targetMinutes) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  let skippedHolidayCount = 0;
  for (let i = 0; i < 60; i++) {
    const dayOfWeek = cursor.getUTCDay();
    const isoDate = toIsoDate(cursor);
    const isWeekend = MALDIVES_WEEKEND_DAYS.includes(dayOfWeek);
    const isHoliday = activeHolidays.includes(isoDate);
    const matchesCadence =
      config.cadence !== 'twice_weekly_sun_wed' || dayOfWeek === 0 || dayOfWeek === 3;

    if (!isWeekend && !isHoliday && matchesCadence) {
      const weekdayEn = WEEKDAY_NAMES_EN[dayOfWeek];
      const weekdayDv = WEEKDAY_NAMES_DV[dayOfWeek];
      return {
        nextRunIso: `${isoDate}T${timeFormatted}:00`,
        nextRunDateIso: isoDate,
        timeLocal: timeFormatted,
        skippedHolidayCount,
        displayEn: config.enabled
          ? `${weekdayEn} ${isoDate} at ${timeFormatted}`
          : `Paused (would run ${weekdayEn} ${isoDate} ${timeFormatted})`,
        displayDv: config.enabled
          ? `${weekdayDv} (${isoDate}) ${timeFormatted}`
          : `މެދުކަނޑާލެވިފައި (${weekdayDv} ${isoDate})`,
      };
    }

    if (isHoliday) skippedHolidayCount += 1;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  const fallbackIso = toIsoDate(cursor);
  return {
    nextRunIso: `${fallbackIso}T${timeFormatted}:00`,
    nextRunDateIso: fallbackIso,
    timeLocal: timeFormatted,
    skippedHolidayCount,
    displayEn: `${fallbackIso} ${timeFormatted}`,
    displayDv: `${fallbackIso} ${timeFormatted}`,
  };
}

export interface PersonalizedBilingualDraft {
  loanId: string;
  channel: ReminderChannel;
  subjectEn: string;
  bodyEn: string;
  subjectDv: string;
  bodyDv: string;
  generatedAt: string;
}

export async function generatePersonalizedBilingualDraft(params: {
  candidate: ScheduledReminderCandidate;
  channel: ReminderChannel;
  includeBilingual: boolean;
}): Promise<PersonalizedBilingualDraft> {
  const { candidate, channel, includeBilingual } = params;
  const { loan, gradeClass, workingDaysOverdue, estimatedFineMvr, isPreventive, historicalSummaryEn } =
    candidate;

  const enPromise = draftOverdueReminder({
    loanId: loan.id,
    bookTitle: loan.bookTitle,
    userName: loan.userName,
    userGrade: gradeClass,
    dueDate: loan.dueDate,
    daysOverdue: workingDaysOverdue,
    lateFeeMvr: estimatedFineMvr,
    channel,
    language: 'en',
    historicalContext: historicalSummaryEn,
    isPreventive,
  });

  const dvPromise: Promise<ReminderDraftResult | null> = includeBilingual
    ? draftOverdueReminder({
        loanId: loan.id,
        bookTitle: loan.bookTitle,
        userName: loan.userName,
        userGrade: gradeClass,
        dueDate: loan.dueDate,
        daysOverdue: workingDaysOverdue,
        lateFeeMvr: estimatedFineMvr,
        channel,
        language: 'dv',
        historicalContext: historicalSummaryEn,
        isPreventive,
      })
    : Promise.resolve(null);

  const [enDraft, dvDraft] = await Promise.all([enPromise, dvPromise]);

  return {
    loanId: loan.id,
    channel,
    subjectEn: enDraft.subject,
    bodyEn: enDraft.messageBody,
    subjectDv: dvDraft?.subject || '',
    bodyDv: dvDraft?.messageBody || '',
    generatedAt: new Date().toISOString(),
  };
}
