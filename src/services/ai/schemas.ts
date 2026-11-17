export const SCHOOL_GRADE_LEVELS = [
  'LKG',
  'UKG',
  'Grade 1',
  'Grade 2',
  'Grade 3',
  'Grade 4',
  'Grade 5',
  'Grade 6',
  'Grade 7',
  'Grade 8',
  'Grade 9',
  'Grade 10',
  'All Ages',
] as const;

export type SchoolGradeLevel = (typeof SCHOOL_GRADE_LEVELS)[number];

export interface AiServiceStatus {
  configured: boolean;
  primaryModel: string;
  fallbackModel: string;
  voiceModel: string;
  offlineFallbackReady: boolean;
  capabilities: string[];
}

export interface CoverOcrResult {
  title_en: string;
  title_dv: string;
  title: string;
  authors: string[];
  author: string;
  publisher: string;
  publication_year: number;
  publicationYear: number;
  language: 'dv' | 'en' | 'ar' | 'other';
  bookLanguage: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  ddc_code: string;
  ddcCallNumber: string;
  category: string;
  grade_level: SchoolGradeLevel;
  subjects: string[];
  tags: string[];
  synopsis: string;
  description: string;
  source: 'gemini_vision' | 'offline_fallback';
}

export interface OpacFilterPredicates {
  language?: string;
  category?: string;
  gradeLevel?: string;
  availableOnly?: boolean;
  minOverdueDays?: number;
  borrowerGrade?: string;
}

export interface OpacAnalyticsRow {
  label: string;
  count: number;
  note?: string;
}

export interface OpacSearchResponse {
  intent: 'catalog_search' | 'overdue_audit' | 'circulation_analytics' | 'general';
  answer: string;
  filterPredicates: OpacFilterPredicates;
  matchedBookIds: string[];
  matchedLoanIds: string[];
  analyticsBreakdown: OpacAnalyticsRow[];
}

export interface CurriculumResourceMatch {
  bookId: string;
  title: string;
  author: string;
  mediaType: string;
  ddcCallNumber: string;
  shelfLocation: string;
  availableCopies: number;
  relevanceReason: string;
}

export interface CurriculumMatchResult {
  summary: string;
  matches: CurriculumResourceMatch[];
  text: string;
}

export interface HighRiskLoanAlert {
  id: string;
  userId?: string;
  bookTitle: string;
  userName: string;
  userGrade?: string;
  dueDate: string;
  daysOverdue: number;
  lateFeeMvr: number;
  riskScore: number;
  riskLevel: 'CRITICAL' | 'ELEVATED';
  riskFactors: string;
}

export interface PredictiveInsightsResponse {
  executiveSummary: string;
  highRiskLoans: HighRiskLoanAlert[];
  weedingOrPromoCandidates: Array<{
    id: string;
    title: string;
    ddcCallNumber?: string;
    shelfLocation?: string;
  }>;
}

export type ReminderChannel = 'whatsapp' | 'sms' | 'email';

export interface ReminderDraftResult {
  subject: string;
  messageBody: string;
  channel: ReminderChannel;
  language: 'en' | 'dv';
}

function asString(val: unknown, fallback = ''): string {
  return typeof val === 'string' ? val.trim() : fallback;
}

function asNumber(val: unknown, fallback: number): number {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function asStringArray(val: unknown, maxLen = 10): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, maxLen);
}

export function normalizeGradeLevel(raw: unknown): SchoolGradeLevel {
  const s = asString(raw).toLowerCase();
  for (const level of SCHOOL_GRADE_LEVELS) {
    if (s === level.toLowerCase() || s.includes(level.toLowerCase())) {
      return level;
    }
  }
  const numMatch = s.match(/\b(\d{1,2})\b/);
  if (numMatch) {
    const n = parseInt(numMatch[1], 10);
    if (n >= 1 && n <= 10) return `Grade ${n}` as SchoolGradeLevel;
  }
  return 'Grade 6';
}

export function validateCoverOcrResult(
  raw: unknown,
  fallbackLanguage: 'en' | 'dv' = 'en'
): CoverOcrResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;

  const rawLang = asString(obj.language || obj.bookLanguage, fallbackLanguage).toLowerCase();
  const normLang: 'dv' | 'en' | 'ar' | 'other' =
    rawLang === 'dv' || rawLang === 'dhivehi'
      ? 'dv'
      : rawLang === 'ar' || rawLang === 'arabic'
      ? 'ar'
      : rawLang === 'other'
      ? 'other'
      : 'en';

  const bookLangMap: Record<'dv' | 'en' | 'ar' | 'other', 'Dhivehi' | 'English' | 'Arabic' | 'Other'> = {
    dv: 'Dhivehi',
    en: 'English',
    ar: 'Arabic',
    other: 'Other',
  };

  const titleDv = asString(obj.title_dv);
  const titleEn = asString(obj.title_en);
  const fallbackTitle = asString(obj.title);
  const resolvedTitle =
    (normLang === 'dv' && titleDv) || titleEn || titleDv || fallbackTitle;

  if (!resolvedTitle) return null;

  const authors = asStringArray(obj.authors, 6);
  const singleAuthor = asString(obj.author);
  const finalAuthors = authors.length > 0 ? authors : singleAuthor ? [singleAuthor] : ['Unknown Author'];

  const year = asNumber(obj.publication_year ?? obj.publicationYear, new Date().getFullYear());
  const ddc = asString(obj.ddc_code || obj.ddcCallNumber, normLang === 'dv' ? 'DDC 891.49' : 'DDC 823');
  const rawSubjects = asStringArray(obj.subjects ?? obj.tags, 5);
  const subjects =
    rawSubjects.length >= 3
      ? rawSubjects
      : [...rawSubjects, normLang === 'dv' ? 'Dhivehi Literature' : 'School Reading', 'Magoodhoo Collection', 'Curriculum'].slice(0, 4);

  const synopsis = asString(
    obj.synopsis || obj.description,
    'Cataloged via AI cover analysis. Review bibliographic fields before printing spine barcode.'
  );

  return {
    title_en: titleEn || (normLang !== 'dv' ? resolvedTitle : ''),
    title_dv: titleDv || (normLang === 'dv' ? resolvedTitle : ''),
    title: resolvedTitle,
    authors: finalAuthors,
    author: finalAuthors.join(', '),
    publisher: asString(obj.publisher, 'Local / School Press'),
    publication_year: year,
    publicationYear: year,
    language: normLang,
    bookLanguage: bookLangMap[normLang],
    ddc_code: ddc,
    ddcCallNumber: ddc,
    category: asString(obj.category, normLang === 'dv' ? 'Dhivehi Literature' : 'Fiction & Literature'),
    grade_level: normalizeGradeLevel(obj.grade_level),
    subjects,
    tags: subjects,
    synopsis,
    description: synopsis,
    source: obj.source === 'offline_fallback' ? 'offline_fallback' : 'gemini_vision',
  };
}

export function validateOpacSearchResponse(raw: unknown): OpacSearchResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const answer = asString(obj.answer);
  if (!answer) return null;

  const rawIntent = asString(obj.intent, 'catalog_search');
  const intent: OpacSearchResponse['intent'] =
    rawIntent === 'overdue_audit' || rawIntent === 'circulation_analytics' || rawIntent === 'general'
      ? rawIntent
      : 'catalog_search';

  const fp = (obj.filterPredicates && typeof obj.filterPredicates === 'object'
    ? obj.filterPredicates
    : {}) as Record<string, unknown>;

  const analyticsBreakdown: OpacAnalyticsRow[] = Array.isArray(obj.analyticsBreakdown)
    ? obj.analyticsBreakdown
        .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === 'object'))
        .map((r) => ({
          label: asString(r.label, 'Category'),
          count: asNumber(r.count, 0),
          note: asString(r.note) || undefined,
        }))
    : [];

  return {
    intent,
    answer,
    filterPredicates: {
      language: asString(fp.language) || undefined,
      category: asString(fp.category) || undefined,
      gradeLevel: asString(fp.gradeLevel) || undefined,
      availableOnly: typeof fp.availableOnly === 'boolean' ? fp.availableOnly : undefined,
      minOverdueDays: fp.minOverdueDays !== undefined ? asNumber(fp.minOverdueDays, 0) : undefined,
      borrowerGrade: asString(fp.borrowerGrade) || undefined,
    },
    matchedBookIds: asStringArray(obj.matchedBookIds, 12),
    matchedLoanIds: asStringArray(obj.matchedLoanIds, 12),
    analyticsBreakdown,
  };
}

export function validateCurriculumMatchResult(raw: unknown): CurriculumMatchResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const matches: CurriculumResourceMatch[] = Array.isArray(obj.matches)
    ? obj.matches
        .filter((m): m is Record<string, unknown> => Boolean(m && typeof m === 'object'))
        .map((m) => ({
          bookId: asString(m.bookId),
          title: asString(m.title, 'Catalog Resource'),
          author: asString(m.author, 'Library Collection'),
          mediaType: asString(m.mediaType, 'Book'),
          ddcCallNumber: asString(m.ddcCallNumber, 'DDC 800'),
          shelfLocation: asString(m.shelfLocation, 'Main Hall'),
          availableCopies: asNumber(m.availableCopies, 1),
          relevanceReason: asString(m.relevanceReason, 'Aligned with curriculum learning objective.'),
        }))
        .filter((m) => Boolean(m.bookId || m.title))
    : [];

  const summary = asString(obj.summary);
  const text = asString(obj.text);
  if (!summary && matches.length === 0 && !text) return null;

  return {
    summary: summary || 'Curriculum matches prepared.',
    matches,
    text: text || summary,
  };
}

export function validatePredictiveInsightsResponse(raw: unknown): PredictiveInsightsResponse | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const executiveSummary = asString(obj.executiveSummary);
  if (!executiveSummary) return null;

  const highRiskLoans: HighRiskLoanAlert[] = Array.isArray(obj.highRiskLoans)
    ? obj.highRiskLoans
        .filter((l): l is Record<string, unknown> => Boolean(l && typeof l === 'object'))
        .map((l) => ({
          id: asString(l.id),
          userId: asString(l.userId) || undefined,
          bookTitle: asString(l.bookTitle, 'Borrowed Book'),
          userName: asString(l.userName, 'Patron'),
          userGrade: asString(l.userGrade) || undefined,
          dueDate: asString(l.dueDate),
          daysOverdue: asNumber(l.daysOverdue, 0),
          lateFeeMvr: asNumber(l.lateFeeMvr, 0),
          riskScore: asNumber(l.riskScore, 60),
          riskLevel: l.riskLevel === 'CRITICAL' ? 'CRITICAL' : 'ELEVATED',
          riskFactors: asString(l.riskFactors, 'Due window & return pattern'),
        }))
    : [];

  const weedingOrPromoCandidates = Array.isArray(obj.weedingOrPromoCandidates)
    ? obj.weedingOrPromoCandidates
        .filter((c): c is Record<string, unknown> => Boolean(c && typeof c === 'object'))
        .map((c) => ({
          id: asString(c.id),
          title: asString(c.title),
          ddcCallNumber: asString(c.ddcCallNumber) || undefined,
          shelfLocation: asString(c.shelfLocation) || undefined,
        }))
    : [];

  return { executiveSummary, highRiskLoans, weedingOrPromoCandidates };
}

export function validateReminderDraftResult(raw: unknown): ReminderDraftResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const messageBody = asString(obj.messageBody);
  if (!messageBody) return null;

  const ch = asString(obj.channel, 'whatsapp').toLowerCase();
  const channel: ReminderChannel = ch === 'sms' || ch === 'email' ? ch : 'whatsapp';
  const language: 'en' | 'dv' = obj.language === 'dv' ? 'dv' : 'en';

  return {
    subject: asString(obj.subject, 'Magoodhoo School Library Return Reminder'),
    messageBody,
    channel,
    language,
  };
}
