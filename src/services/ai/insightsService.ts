import { safeAiJsonFetch } from './client';
import {
  PredictiveInsightsResponse,
  HighRiskLoanAlert,
  ReminderChannel,
  ReminderDraftResult,
  validatePredictiveInsightsResponse,
  validateReminderDraftResult,
} from './schemas';

export type { PredictiveInsightsResponse, HighRiskLoanAlert, ReminderChannel, ReminderDraftResult };

export function computeLocalOverdueInsights(params: {
  books: any[];
  loans: any[];
  language?: 'en' | 'dv';
}): PredictiveInsightsResponse {
  const { books, loans, language = 'en' } = params;
  const isDv = language === 'dv';
  const today = new Date().toISOString().split('T')[0];

  const userStats: Record<string, { total: number; late: number }> = {};
  loans.forEach((l) => {
    if (!l.userId) return;
    if (!userStats[l.userId]) userStats[l.userId] = { total: 0, late: 0 };
    userStats[l.userId].total += 1;
    if (l.status === 'overdue' || (l.lateFee || 0) > 0 || (l.returnDate && l.dueDate && l.returnDate > l.dueDate)) {
      userStats[l.userId].late += 1;
    }
  });

  const highRiskLoans: HighRiskLoanAlert[] = loans
    .filter((l) => l.status !== 'returned')
    .map((l) => {
      const diffMs = new Date(l.dueDate).getTime() - new Date(today).getTime();
      const daysLeft = Math.ceil(diffMs / 86400000);
      const daysOverdue = daysLeft < 0 ? Math.abs(daysLeft) : 0;
      const stats = userStats[l.userId] || { total: 1, late: 0 };
      const lateRatio = stats.total > 0 ? stats.late / stats.total : 0;

      let score = 15;
      const factors: string[] = [];
      if (l.status === 'overdue' || daysOverdue > 0) {
        score += Math.min(55, 35 + daysOverdue * 3);
        factors.push(`${daysOverdue}d overdue`);
      } else if (daysLeft <= 2) {
        score += 35;
        factors.push(`Due in ${daysLeft}d`);
      } else if (daysLeft <= 5) {
        score += 20;
        factors.push(`Due in ${daysLeft}d`);
      }
      if ((l.renewalCount || 0) >= 1) {
        score += 15;
        factors.push(`${l.renewalCount} renewal(s)`);
      }
      if (lateRatio > 0) {
        score += Math.round(lateRatio * 25);
        factors.push(`${stats.late}/${stats.total} historical late`);
      }
      const riskScore = Math.min(99, score);
      return {
        id: l.id,
        userId: l.userId,
        bookTitle: l.bookTitle,
        userName: l.userName,
        userGrade: l.userGrade,
        dueDate: l.dueDate,
        daysOverdue,
        lateFeeMvr: l.lateFee || 0,
        riskScore,
        riskLevel: (l.status === 'overdue' || daysOverdue > 0 || riskScore >= 70 ? 'CRITICAL' : 'ELEVATED') as 'CRITICAL' | 'ELEVATED',
        riskFactors: factors.join(' · ') || 'Approaching due date',
      };
    })
    .filter((x) => x.riskScore >= 40)
    .sort((a, b) => b.riskScore - a.riskScore);

  const stagnantBooks = books
    .filter((b) => !b.isReferenceOnly && b.availableCopies === b.totalCopies)
    .slice(0, 5)
    .map((b) => ({
      id: b.id,
      title: b.title,
      ddcCallNumber: b.ddcCallNumber,
      shelfLocation: b.shelfLocation,
    }));

  return {
    executiveSummary: isDv
      ? `ޖުމްލަ ${books.length} ފޮތުގެ ތެރެއިން ${highRiskLoans.length} ލޯން މުއްދަތު ހަމަވުމުގެ ނުރައްކާތެރި ހާލަތުގައިވެއެވެ.`
      : `${highRiskLoans.length} active loan(s) flagged based on due date window and historical patron return delays.`,
    highRiskLoans,
    weedingOrPromoCandidates: stagnantBooks,
  };
}

export async function getPredictiveInsights(params: {
  books: any[];
  loans: any[];
  language?: 'en' | 'dv';
}): Promise<PredictiveInsightsResponse> {
  const res = await safeAiJsonFetch<PredictiveInsightsResponse>('/api/ai/insights', params, {
    method: 'POST',
    retries: 2,
    validator: validatePredictiveInsightsResponse,
  });
  return res || computeLocalOverdueInsights(params);
}

export async function draftOverdueReminder(params: {
  loanId?: string;
  bookTitle: string;
  userName: string;
  userGrade?: string;
  dueDate: string;
  daysOverdue?: number;
  lateFeeMvr?: number;
  channel: ReminderChannel;
  language: 'en' | 'dv';
}): Promise<ReminderDraftResult> {
  const res = await safeAiJsonFetch<ReminderDraftResult>('/api/ai/draft-reminder', params, {
    method: 'POST',
    retries: 2,
    validator: validateReminderDraftResult,
  });
  if (res) return res;

  const { bookTitle, userName, userGrade, dueDate, daysOverdue = 0, lateFeeMvr = 0, channel, language } = params;
  if (language === 'dv') {
    return {
      subject: `މަގޫދޫ ސްކޫލް ލައިބްރަރީ: ފޮތް އަނބުރާ ޙަވާލުކުރުމުގެ ހަނދާންކޮށްދިނުން — ${bookTitle}`,
      messageBody:
        channel === 'sms'
          ? `މަގޫދޫ ސްކޫލް ލައިބްރަރީ: ${userName}${userGrade ? ` (${userGrade})` : ''} ނަންގަވާފައިވާ "${bookTitle}" ގެ މުއްދަތު (${dueDate}) ހަމަވެފައިވާތީ ޙަވާލުކޮށްދެއްވުން އެދެމެވެ.${lateFeeMvr > 0 ? ` ޖޫރިމަނާ: MVR ${lateFeeMvr.toFixed(2)}.` : ''}`
          : `އައްސަލާމް ޢަލައިކުމް،\n\nމަގޫދޫ ސްކޫލް ލައިބްރަރީން ${userName}${userGrade ? ` (${userGrade})` : ''} ނަންގަވާފައިވާ "${bookTitle}" ފޮތް އަނބުރާ ޙަވާލުކުރުމުގެ ސުންގަޑި (${dueDate}) ވަނީ ${daysOverdue > 0 ? `${daysOverdue} ދުވަސް ފަހަނައަޅައި ގޮސްފައެވެ` : 'ހަމަވާން ކައިރިވެފައެވެ'}.\n${lateFeeMvr > 0 ? `މިހާތަނަށް އަރާފައިވާ ޖޫރިމަނާ: MVR ${lateFeeMvr.toFixed(2)}\n` : ''}\nސްކޫލް ގަޑީގައި ލައިބްރަރީ ކައުންޓަރަށް ފޮތް ޙަވާލުކޮށްދެއްވުން އެދެމެވެ. ޝުކުރިއްޔާ!`,
      channel,
      language,
    };
  }

  return {
    subject: `F. Magoodhoo School Library Reminder: "${bookTitle}"`,
    messageBody:
      channel === 'sms'
        ? `Magoodhoo School Library: Reminder for ${userName}${userGrade ? ` (${userGrade})` : ''} to return "${bookTitle}" (Due: ${dueDate}${daysOverdue > 0 ? `, ${daysOverdue}d overdue` : ''}).${lateFeeMvr > 0 ? ` Fee: MVR ${lateFeeMvr.toFixed(2)}.` : ''}`
        : `Assalaamu Alaikum,\n\nThis is a friendly reminder from F. Magoodhoo School Library regarding "${bookTitle}" borrowed by ${userName}${userGrade ? ` (${userGrade})` : ''}.\n\nDue Date: ${dueDate}${daysOverdue > 0 ? ` (${daysOverdue} day(s) overdue)` : ''}${lateFeeMvr > 0 ? `\nFine Balance: MVR ${lateFeeMvr.toFixed(2)}` : ''}\n\nKindly return or renew the book at the library desk during school hours (Sun–Thu). Thank you!\n— F. Magoodhoo School Library`,
    channel,
    language,
  };
}
