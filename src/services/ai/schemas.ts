import { z } from 'zod';

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

export const CoverOcrZodSchema = z
  .object({
    title_en: z.string().optional().nullable(),
    title_dv: z.string().optional().nullable(),
    title: z.string().optional().nullable(),
    authors: z.array(z.string()).optional().nullable(),
    author: z.string().optional().nullable(),
    publisher: z.string().optional().nullable(),
    publication_year: z.union([z.number(), z.string()]).optional().nullable(),
    publicationYear: z.union([z.number(), z.string()]).optional().nullable(),
    language: z.string().optional().nullable(),
    bookLanguage: z.string().optional().nullable(),
    ddc_code: z.string().optional().nullable(),
    ddcCallNumber: z.string().optional().nullable(),
    category: z.string().optional().nullable(),
    grade_level: z.string().optional().nullable(),
    subjects: z.array(z.string()).optional().nullable(),
    tags: z.array(z.string()).optional().nullable(),
    synopsis: z.string().optional().nullable(),
    description: z.string().optional().nullable(),
    source: z.string().optional().nullable(),
  })
  .refine(
    (data) =>
      Boolean(
        (data.title_en && data.title_en.trim()) ||
          (data.title_dv && data.title_dv.trim()) ||
          (data.title && data.title.trim())
      ),
    { message: 'At least one title field must be non-empty' }
  );

export const OpacSearchZodSchema = z.object({
  intent: z.string().optional(),
  answer: z.string().min(1),
  filterPredicates: z.record(z.string(), z.unknown()).optional().nullable(),
  matchedBookIds: z.array(z.string()).optional().nullable(),
  matchedLoanIds: z.array(z.string()).optional().nullable(),
  analyticsBreakdown: z
    .array(
      z.object({
        label: z.string().optional(),
        count: z.union([z.number(), z.string()]).optional(),
        note: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
});

export const CurriculumMatchZodSchema = z
  .object({
    summary: z.string().optional().nullable(),
    text: z.string().optional().nullable(),
    matches: z
      .array(
        z.object({
          bookId: z.string().optional(),
          title: z.string().optional(),
          author: z.string().optional(),
          mediaType: z.string().optional(),
          ddcCallNumber: z.string().optional(),
          shelfLocation: z.string().optional(),
          availableCopies: z.union([z.number(), z.string()]).optional(),
          relevanceReason: z.string().optional(),
        })
      )
      .optional()
      .nullable(),
  })
  .refine(
    (d) =>
      Boolean(
        (d.summary && d.summary.trim()) ||
          (d.text && d.text.trim()) ||
          (Array.isArray(d.matches) && d.matches.length > 0)
      ),
    { message: 'Curriculum match must contain summary, text, or matches' }
  );

export const PredictiveInsightsZodSchema = z.object({
  executiveSummary: z.string().min(1),
  highRiskLoans: z
    .array(
      z.object({
        id: z.string().optional(),
        userId: z.string().optional().nullable(),
        bookTitle: z.string().optional(),
        userName: z.string().optional(),
        userGrade: z.string().optional().nullable(),
        dueDate: z.string().optional(),
        daysOverdue: z.union([z.number(), z.string()]).optional(),
        lateFeeMvr: z.union([z.number(), z.string()]).optional(),
        riskScore: z.union([z.number(), z.string()]).optional(),
        riskLevel: z.string().optional(),
        riskFactors: z.string().optional(),
      })
    )
    .optional()
    .nullable(),
  weedingOrPromoCandidates: z
    .array(
      z.object({
        id: z.string().optional(),
        title: z.string().optional(),
        ddcCallNumber: z.string().optional().nullable(),
        shelfLocation: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
});

export const ReminderDraftZodSchema = z.object({
  subject: z.string().optional().nullable(),
  messageBody: z.string().min(1),
  channel: z.string().optional().nullable(),
  language: z.string().optional().nullable(),
});

export const CatalogHealthAiZodSchema = z.object({
  summary: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  patches: z
    .array(
      z.object({
        bookId: z.string().min(1),
        ddcCallNumber: z.string().optional().nullable(),
        targetGrade: z.string().optional().nullable(),
        bookLanguage: z.string().optional().nullable(),
        author: z.string().optional().nullable(),
        description: z.string().optional().nullable(),
        shelfLocation: z.string().optional().nullable(),
      })
    )
    .optional()
    .nullable(),
});

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
  const parsed = CoverOcrZodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const obj = parsed.data as Record<string, unknown>;

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
  const parsed = OpacSearchZodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const obj = parsed.data as Record<string, unknown>;
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
  const parsed = CurriculumMatchZodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const obj = parsed.data as Record<string, unknown>;
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
  const parsed = PredictiveInsightsZodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const obj = parsed.data as Record<string, unknown>;
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
  const parsed = ReminderDraftZodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const obj = parsed.data as Record<string, unknown>;
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

export interface CatalogHealthAiPatch {
  bookId: string;
  ddcCallNumber?: string;
  targetGrade?: string;
  bookLanguage?: 'English' | 'Dhivehi' | 'Arabic' | 'Other';
  author?: string;
  description?: string;
  shelfLocation?: string;
}

export interface CatalogHealthAiResponse {
  summary: string;
  source: 'gemini' | 'deterministic_fallback';
  patches: CatalogHealthAiPatch[];
}

export function validateCatalogHealthAiResponse(raw: unknown): CatalogHealthAiResponse | null {
  const parsed = CatalogHealthAiZodSchema.safeParse(raw);
  if (!parsed.success) return null;
  const obj = parsed.data as Record<string, unknown>;
  const patches: CatalogHealthAiPatch[] = Array.isArray(obj.patches)
    ? obj.patches
        .filter((p): p is Record<string, unknown> => Boolean(p && typeof p === 'object'))
        .map((p) => {
          const langRaw = asString(p.bookLanguage).toLowerCase();
          const bookLanguage: CatalogHealthAiPatch['bookLanguage'] =
            langRaw.includes('dhivehi') || langRaw === 'dv'
              ? 'Dhivehi'
              : langRaw.includes('arabic') || langRaw === 'ar'
              ? 'Arabic'
              : langRaw.includes('english') || langRaw === 'en'
              ? 'English'
              : langRaw.includes('other')
              ? 'Other'
              : undefined;
          const rawGrade = asString(p.targetGrade);
          const cleanGradeMatch = rawGrade.match(/^(LKG|UKG|Grades?\s*\d{1,2}(?:\s*[-–]\s*\d{1,2})?|All Ages)/i);
          const sanitizedTargetGrade = cleanGradeMatch
            ? cleanGradeMatch[0]
            : rawGrade.length <= 20
            ? rawGrade
            : undefined;
          return {
            bookId: asString(p.bookId),
            ddcCallNumber: asString(p.ddcCallNumber) || undefined,
            targetGrade: sanitizedTargetGrade || undefined,
            bookLanguage,
            author: asString(p.author) || undefined,
            description: asString(p.description) || undefined,
            shelfLocation: asString(p.shelfLocation) || undefined,
          };
        })
        .filter((p) => Boolean(p.bookId))
    : [];

  return {
    summary: asString(obj.summary, 'Catalog metadata audit suggestions prepared.'),
    source: obj.source === 'gemini' ? 'gemini' : 'deterministic_fallback',
    patches,
  };
}

