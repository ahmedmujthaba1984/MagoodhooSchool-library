import { Book, Loan, SchoolHouse, UserProfile } from '../types';

export const MIN_VERIFIED_READING_MINUTES = 240; // 4 hours minimum prevents 5-minute check-in gaming

export type BadgeId =
  | 'bilingual-explorer'
  | 'genre-voyager'
  | 'term-bookworm'
  | 'zero-late-streak';

export interface ReadingBadgeDefinition {
  id: BadgeId;
  titleEn: string;
  titleDv: string;
  descriptionEn: string;
  descriptionDv: string;
  accentHex: string;
  target: number;
}

export const READING_BADGES: ReadingBadgeDefinition[] = [
  {
    id: 'bilingual-explorer',
    titleEn: 'Bilingual Explorer',
    titleDv: 'ދެބަހުގެ މާހިރު',
    descriptionEn: 'Complete 3 verified books in Dhivehi and 3 in English',
    descriptionDv: 'ދިވެހި ބަހުން 3 ފޮތް އަދި އިނގިރޭސި ބަހުން 3 ފޮތް ކިޔައި ނިންމުން',
    accentHex: '#047857',
    target: 6,
  },
  {
    id: 'genre-voyager',
    titleEn: 'Genre Voyager',
    titleDv: 'ބާވަތްތަކުގެ ދަތުރުވެރިޔާ',
    descriptionEn: 'Borrow verified books across 5+ different Dewey categories',
    descriptionDv: 'ޑީވީ 5 ބާވަތަކަށްވުރެ ގިނަ ދާއިރާތަކުން ފޮތް ކިޔައި ނިންމުން',
    accentHex: '#0284c7',
    target: 5,
  },
  {
    id: 'term-bookworm',
    titleEn: 'Term Bookworm',
    titleDv: 'ޓާމުގެ ފޮތްކިޔުންތެރިޔާ',
    descriptionEn: 'Complete 10+ verified books within a single academic term',
    descriptionDv: 'އެއް ޓާމެއްގައި 10 ފޮތް ނުވަތަ އެއަށްވުރެ ގިނަ ފޮތް ކިޔައި ނިންމުން',
    accentHex: '#b45309',
    target: 10,
  },
  {
    id: 'zero-late-streak',
    titleEn: 'Zero-Late Streak',
    titleDv: 'ގަޑިއަށް ޙަވާލުކުރާ ތަރި',
    descriptionEn: 'Return 10 consecutive verified books on or before due date',
    descriptionDv: 'ޖެހިޖެހިގެން 10 ފޮތް ސުންގަޑީގެ ކުރިން ލައިބްރަރީއަށް ޙަވާލުކުރުން',
    accentHex: '#4f46e5',
    target: 10,
  },
];

export interface LoanVerificationResult {
  verified: boolean;
  durationHours: number;
  reason?: string;
}

export function verifyLoanReadingDuration(loan: Loan): LoanVerificationResult {
  if (loan.status !== 'returned') {
    return { verified: false, durationHours: 0, reason: 'Loan is not yet returned' };
  }

  if (loan.issuedAtTimestamp && loan.returnedAtTimestamp) {
    const startMs = new Date(loan.issuedAtTimestamp).getTime();
    const endMs = new Date(loan.returnedAtTimestamp).getTime();
    if (!Number.isNaN(startMs) && !Number.isNaN(endMs)) {
      const diffMins = (endMs - startMs) / 60000;
      const hours = Math.max(0, Math.round((diffMins / 60) * 10) / 10);
      if (diffMins < MIN_VERIFIED_READING_MINUTES) {
        return {
          verified: false,
          durationHours: hours,
          reason: `Loan duration (${Math.max(1, Math.round(diffMins))} min) is below the 4-hour anti-gaming minimum`,
        };
      }
      return { verified: true, durationHours: hours };
    }
  }

  const issueStr = loan.issueDate || '';
  const returnStr = loan.returnDate || '';
  if (!issueStr || !returnStr || returnStr <= issueStr) {
    return {
      verified: false,
      durationHours: 0,
      reason: 'Same-day check-in/out (< 24h) does not qualify for badge credit',
    };
  }

  const diffMs = new Date(returnStr).getTime() - new Date(issueStr).getTime();
  const hours = Number.isNaN(diffMs) ? 24 : Math.max(24, Math.round(diffMs / 3600000));
  return { verified: true, durationHours: hours };
}

export function detectBookLanguage(book: Book | undefined, loanTitle: string): 'Dhivehi' | 'English' | 'Other' {
  if (book?.bookLanguage === 'Dhivehi') return 'Dhivehi';
  if (book?.bookLanguage === 'English') return 'English';
  if (/[\u0780-\u07BF]/.test(`${book?.title || ''} ${loanTitle}`)) return 'Dhivehi';
  if (book?.ddcCallNumber && /(491\.49|891\.49)/.test(book.ddcCallNumber)) return 'Dhivehi';
  if (book?.bookLanguage === 'Arabic' || book?.bookLanguage === 'Other') return 'Other';
  return 'English';
}

export function extractDeweyCategoryBucket(book: Book | undefined): string {
  if (!book) return 'General';
  if (book.ddcCallNumber) {
    const m = book.ddcCallNumber.match(/(\d{3})/);
    if (m) {
      const hundreds = `${m[1][0]}00`;
      // Differentiate 297 / 491 / 523 / 577 / 823 / 891 etc. by primary 3-digit DDC division so school library collections track genuine diversity cleanly
      return `DDC ${m[1]}`;
    }
  }
  return book.category || 'General';
}

export function getAcademicTermKey(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length < 2) return '2026 Term 2';
  const year = parts[0];
  const month = parseInt(parts[1], 10);
  // Maldives school academic terms: Term 1 (Jan–Jun), Term 2 (Jul–Dec)
  return month <= 6 ? `${year} Term 1` : `${year} Term 2`;
}

export interface EvaluatedBadgeProgress {
  badge: ReadingBadgeDefinition;
  earned: boolean;
  current: number;
  target: number;
  progressPct: number;
  detailText: string;
}

export interface StudentReadingProfileSummary {
  user: UserProfile;
  verifiedLoans: Loan[];
  excludedQuickLoans: Array<{ loan: Loan; reason: string }>;
  dhivehiCount: number;
  englishCount: number;
  distinctDeweyCategories: string[];
  peakTermLabel: string;
  peakTermCount: number;
  currentOnTimeStreak: number;
  bestOnTimeStreak: number;
  badges: EvaluatedBadgeProgress[];
  earnedBadgeIds: BadgeId[];
}

export function evaluateStudentReadingSummary(
  user: UserProfile,
  allLoans: Loan[],
  books: Book[]
): StudentReadingProfileSummary {
  const bookMap = new Map(books.map((b) => [b.id, b]));
  const userReturnedLoans = allLoans
    .filter((l) => l.userId === user.id && l.status === 'returned')
    .sort((a, b) => (a.returnDate || a.issueDate).localeCompare(b.returnDate || b.issueDate));

  const verifiedLoans: Loan[] = [];
  const excludedQuickLoans: Array<{ loan: Loan; reason: string }> = [];

  for (const loan of userReturnedLoans) {
    const check = verifyLoanReadingDuration(loan);
    if (check.verified) {
      verifiedLoans.push(loan);
    } else {
      excludedQuickLoans.push({
        loan,
        reason: check.reason || 'Minimum reading duration not met',
      });
    }
  }

  let dhivehiCount = 0;
  let englishCount = 0;
  const deweyBuckets = new Set<string>();
  const termCounts = new Map<string, number>();

  let currentOnTimeStreak = 0;
  let bestOnTimeStreak = 0;

  for (const loan of verifiedLoans) {
    const book = bookMap.get(loan.bookId);
    const lang = detectBookLanguage(book, loan.bookTitle);
    if (lang === 'Dhivehi') dhivehiCount += 1;
    else if (lang === 'English') englishCount += 1;

    deweyBuckets.add(extractDeweyCategoryBucket(book));

    const termKey = getAcademicTermKey(loan.returnDate || loan.issueDate);
    termCounts.set(termKey, (termCounts.get(termKey) || 0) + 1);

    const onTime = Boolean(loan.returnDate && loan.dueDate && loan.returnDate <= loan.dueDate);
    if (onTime) {
      currentOnTimeStreak += 1;
      if (currentOnTimeStreak > bestOnTimeStreak) bestOnTimeStreak = currentOnTimeStreak;
    } else {
      currentOnTimeStreak = 0;
    }
  }

  let peakTermLabel = getAcademicTermKey(new Date().toISOString().split('T')[0]);
  let peakTermCount = 0;
  for (const [term, count] of termCounts.entries()) {
    if (count >= peakTermCount) {
      peakTermCount = count;
      peakTermLabel = term;
    }
  }

  const bilingualEarned = dhivehiCount >= 3 && englishCount >= 3;
  const bilingualCurrent = Math.min(3, dhivehiCount) + Math.min(3, englishCount);

  const distinctDeweyCategories = Array.from(deweyBuckets);
  const genreEarned = distinctDeweyCategories.length >= 5;

  const termEarned = peakTermCount >= 10;
  const streakEarned = bestOnTimeStreak >= 10;

  const badges: EvaluatedBadgeProgress[] = [
    {
      badge: READING_BADGES[0],
      earned: bilingualEarned,
      current: bilingualCurrent,
      target: 6,
      progressPct: Math.min(100, Math.round((bilingualCurrent / 6) * 100)),
      detailText: `${dhivehiCount}/3 Dhivehi · ${englishCount}/3 English`,
    },
    {
      badge: READING_BADGES[1],
      earned: genreEarned,
      current: Math.min(5, distinctDeweyCategories.length),
      target: 5,
      progressPct: Math.min(100, Math.round((distinctDeweyCategories.length / 5) * 100)),
      detailText: `${distinctDeweyCategories.length}/5 Dewey divisions`,
    },
    {
      badge: READING_BADGES[2],
      earned: termEarned,
      current: Math.min(10, peakTermCount),
      target: 10,
      progressPct: Math.min(100, Math.round((peakTermCount / 10) * 100)),
      detailText: `${peakTermCount}/10 books (${peakTermLabel})`,
    },
    {
      badge: READING_BADGES[3],
      earned: streakEarned,
      current: Math.min(10, bestOnTimeStreak),
      target: 10,
      progressPct: Math.min(100, Math.round((bestOnTimeStreak / 10) * 100)),
      detailText: `${bestOnTimeStreak}/10 consecutive on-time returns`,
    },
  ];

  const earnedBadgeIds = badges.filter((b) => b.earned).map((b) => b.badge.id);

  return {
    user,
    verifiedLoans,
    excludedQuickLoans,
    dhivehiCount,
    englishCount,
    distinctDeweyCategories,
    peakTermLabel,
    peakTermCount,
    currentOnTimeStreak,
    bestOnTimeStreak,
    badges,
    earnedBadgeIds,
  };
}

export interface ReturnBadgeEvaluationOutcome {
  verifiedCredit: boolean;
  skipReason?: string;
  newlyUnlockedBadges: ReadingBadgeDefinition[];
  allEarnedBadgeIds: BadgeId[];
  totalVerifiedBooks: number;
}

export function evaluateBadgesOnReturn(params: {
  student: UserProfile;
  existingLoans: Loan[];
  returnedLoan: Loan;
  books: Book[];
}): ReturnBadgeEvaluationOutcome {
  const { student, existingLoans, returnedLoan, books } = params;
  const verification = verifyLoanReadingDuration(returnedLoan);

  const beforeSummary = evaluateStudentReadingSummary(
    student,
    existingLoans.filter((l) => l.id !== returnedLoan.id),
    books
  );

  const updatedLoans = [
    ...existingLoans.filter((l) => l.id !== returnedLoan.id),
    returnedLoan,
  ];
  const afterSummary = evaluateStudentReadingSummary(student, updatedLoans, books);

  const previousSet = new Set<string>([
    ...beforeSummary.earnedBadgeIds,
    ...(student.earnedBadgeIds || []),
  ]);

  const newlyUnlockedBadges = afterSummary.badges
    .filter((b) => b.earned && !previousSet.has(b.badge.id))
    .map((b) => b.badge);

  const mergedEarned = Array.from(
    new Set([...previousSet, ...afterSummary.earnedBadgeIds])
  ) as BadgeId[];

  return {
    verifiedCredit: verification.verified,
    skipReason: verification.reason,
    newlyUnlockedBadges,
    allEarnedBadgeIds: mergedEarned,
    totalVerifiedBooks: afterSummary.verifiedLoans.length,
  };
}

export interface ClassLeaderboardRow {
  gradeName: string;
  studentCount: number;
  verifiedBooksRead: number;
  avgBooksPerStudent: number;
  onTimeReturnRatePct: number;
  totalBadgesEarned: number;
  dhivehiCount: number;
  englishCount: number;
  collectiveTarget: number;
  collectiveProgressPct: number;
}

export interface HouseLeaderboardRow {
  houseName: SchoolHouse | string;
  houseDhivehi: string;
  accentHex: string;
  memberCount: number;
  verifiedBooksRead: number;
  onTimeReturnRatePct: number;
  badgesUnlocked: number;
  housePoints: number;
}

export const HOUSE_METADATA: Record<
  string,
  { dhivehi: string; accentHex: string }
> = {
  Ghaazee: { dhivehi: 'ޣާޒީ ހައުސް', accentHex: '#047857' },
  'Bodu Thakurufaanu': { dhivehi: 'ބޮޑު ތަކުރުފާނު ހައުސް', accentHex: '#0284c7' },
  'Dhon Bandaarain': { dhivehi: 'ދޮން ބަންޑާރައިން ހައުސް', accentHex: '#b45309' },
  Huravee: { dhivehi: 'ހުރަވީ ހައުސް', accentHex: '#4f46e5' },
};

export function computeClassAndHouseLeaderboards(
  users: UserProfile[],
  loans: Loan[],
  books: Book[]
): {
  classes: ClassLeaderboardRow[];
  houses: HouseLeaderboardRow[];
} {
  const students = users.filter((u) => u.role === 'student');
  const classBuckets = new Map<
    string,
    {
      students: UserProfile[];
      verifiedReads: number;
      onTimeReads: number;
      badgesCount: number;
      dhivehiCount: number;
      englishCount: number;
    }
  >();

  const houseBuckets = new Map<
    string,
    {
      members: number;
      verifiedReads: number;
      onTimeReads: number;
      badgesCount: number;
    }
  >();

  for (const houseKey of Object.keys(HOUSE_METADATA)) {
    houseBuckets.set(houseKey, {
      members: 0,
      verifiedReads: 0,
      onTimeReads: 0,
      badgesCount: 0,
    });
  }

  for (const student of students) {
    const summary = evaluateStudentReadingSummary(student, loans, books);
    const onTimeCount = summary.verifiedLoans.filter(
      (l) => l.returnDate && l.dueDate && l.returnDate <= l.dueDate
    ).length;

    const grade = student.grade || 'Unassigned Class';
    if (!classBuckets.has(grade)) {
      classBuckets.set(grade, {
        students: [],
        verifiedReads: 0,
        onTimeReads: 0,
        badgesCount: 0,
        dhivehiCount: 0,
        englishCount: 0,
      });
    }
    const cBucket = classBuckets.get(grade)!;
    cBucket.students.push(student);
    cBucket.verifiedReads += summary.verifiedLoans.length;
    cBucket.onTimeReads += onTimeCount;
    cBucket.badgesCount += summary.earnedBadgeIds.length;
    cBucket.dhivehiCount += summary.dhivehiCount;
    cBucket.englishCount += summary.englishCount;

    const house = student.schoolHouse || 'Ghaazee';
    if (!houseBuckets.has(house)) {
      houseBuckets.set(house, {
        members: 0,
        verifiedReads: 0,
        onTimeReads: 0,
        badgesCount: 0,
      });
    }
    const hBucket = houseBuckets.get(house)!;
    hBucket.members += 1;
    hBucket.verifiedReads += summary.verifiedLoans.length;
    hBucket.onTimeReads += onTimeCount;
    hBucket.badgesCount += summary.earnedBadgeIds.length;
  }

  const classes: ClassLeaderboardRow[] = Array.from(classBuckets.entries())
    .map(([gradeName, data]) => {
      const studentCount = data.students.length;
      const collectiveTarget = Math.max(10, studentCount * 10);
      return {
        gradeName,
        studentCount,
        verifiedBooksRead: data.verifiedReads,
        avgBooksPerStudent:
          studentCount > 0 ? Math.round((data.verifiedReads / studentCount) * 10) / 10 : 0,
        onTimeReturnRatePct:
          data.verifiedReads > 0
            ? Math.round((data.onTimeReads / data.verifiedReads) * 100)
            : 100,
        totalBadgesEarned: data.badgesCount,
        dhivehiCount: data.dhivehiCount,
        englishCount: data.englishCount,
        collectiveTarget,
        collectiveProgressPct: Math.min(
          100,
          Math.round((data.verifiedReads / collectiveTarget) * 100)
        ),
      };
    })
    .sort((a, b) => b.verifiedBooksRead - a.verifiedBooksRead || a.gradeName.localeCompare(b.gradeName));

  const houses: HouseLeaderboardRow[] = Array.from(houseBuckets.entries())
    .map(([houseName, data]) => {
      const meta = HOUSE_METADATA[houseName] || {
        dhivehi: houseName,
        accentHex: '#047857',
      };
      const onTimeRate =
        data.verifiedReads > 0
          ? Math.round((data.onTimeReads / data.verifiedReads) * 100)
          : 100;
      const housePoints = data.verifiedReads * 10 + data.badgesCount * 25 + data.onTimeReads * 2;
      return {
        houseName,
        houseDhivehi: meta.dhivehi,
        accentHex: meta.accentHex,
        memberCount: data.members,
        verifiedBooksRead: data.verifiedReads,
        onTimeReturnRatePct: onTimeRate,
        badgesUnlocked: data.badgesCount,
        housePoints,
      };
    })
    .sort((a, b) => b.housePoints - a.housePoints);

  return { classes, houses };
}

export interface PrintableCertificateParams {
  studentName: string;
  studentNameDv?: string;
  grade: string;
  schoolHouse?: string;
  booksReadCount: number;
  termName: string;
  termNameDv?: string;
  achievementTitleEn: string;
  achievementTitleDv: string;
  issueDate: string;
  principalName: string;
  librarianName: string;
  certificateId: string;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildCertificateHtml(params: PrintableCertificateParams): string {
  const {
    studentName,
    studentNameDv,
    grade,
    schoolHouse,
    booksReadCount,
    termName,
    termNameDv,
    achievementTitleEn,
    achievementTitleDv,
    issueDate,
    principalName,
    librarianName,
    certificateId,
  } = params;

  return `
    <div style="width:100%;max-width:1040px;margin:0 auto;padding:24px;background:#ffffff;color:#0f172a;font-family:'Plus Jakarta Sans',system-ui,sans-serif;box-sizing:border-box;">
      <div style="border:6px double #047857;border-radius:14px;padding:28px 34px;position:relative;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);">
        <!-- Top Bilingual Institutional Masthead -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1.5px solid #cbd5e1;padding-bottom:14px;margin-bottom:18px;gap:16px;">
          <div style="text-align:left;">
            <div style="font-size:10px;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:#047857;">
              F. Magoodhoo School · Republic of Maldives
            </div>
            <div style="font-size:17px;font-weight:900;color:#0f172a;margin-top:2px;">
              Certificate of Reading Excellence
            </div>
          </div>

          <div style="width:58px;height:58px;border-radius:999px;border:2.5px solid #b45309;background:#fffbeb;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#b45309" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
            </svg>
          </div>

          <div dir="rtl" lang="dv" style="text-align:right;font-family:'Faruma','Noto Sans Thaana',sans-serif;line-height:1.7;">
            <div style="font-size:11px;font-weight:700;color:#047857;">
              ފ. މަގޫދޫ ސްކޫލް ލައިބްރަރީ
            </div>
            <div style="font-size:17px;font-weight:800;color:#0f172a;">
              ފޮތްކިޔުމުގެ ޝަރަފުވެރިކަމުގެ ސެޓްފިކެޓް
            </div>
          </div>
        </div>

        <!-- Recipient Block -->
        <div style="text-align:center;margin:14px 0 18px;">
          <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#64748b;">
            This achievement is proudly presented to
          </div>
          <div style="font-size:30px;font-weight:900;color:#0f172a;margin-top:6px;letter-spacing:-0.01em;">
            ${escapeHtml(studentName)}
          </div>
          ${
            studentNameDv
              ? `<div dir="rtl" lang="dv" style="font-family:'Faruma','Noto Sans Thaana',sans-serif;font-size:21px;font-weight:700;color:#047857;line-height:1.8;margin-top:2px;">
                   ${escapeHtml(studentNameDv)}
                 </div>`
              : ''
          }
          <div style="font-size:12px;font-weight:700;color:#475569;margin-top:6px;font-family:'JetBrains Mono',monospace;">
            ${escapeHtml(grade)}${schoolHouse ? ` · ${escapeHtml(schoolHouse)} House` : ''}
          </div>
        </div>

        <!-- Bilingual Citation Split -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:18px;background:#ffffff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:18px;">
          <div style="text-align:left;font-size:12.5px;line-height:1.65;color:#1e293b;">
            <div style="font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:0.08em;color:#047857;margin-bottom:4px;">
              ${escapeHtml(achievementTitleEn)}
            </div>
            In recognition of outstanding dedication to reading and literary curiosity during
            <strong>${escapeHtml(termName)}</strong>, completing
            <strong style="font-family:'JetBrains Mono',monospace;">${booksReadCount}</strong>
            verified library books with exemplary care and punctuality.
          </div>

          <div dir="rtl" lang="dv" style="text-align:right;font-family:'Faruma','Noto Sans Thaana',sans-serif;font-size:14px;line-height:1.95;color:#1e293b;border-inline-start:1px solid #e2e8f0;padding-inline-start:16px;">
            <div style="font-size:12px;font-weight:800;color:#047857;margin-bottom:4px;">
              ${escapeHtml(achievementTitleDv)}
            </div>
            ${escapeHtml(termNameDv || termName)} ގައި ފޮތްކިޔުމަށް ބެހެއްޓި ޝައުޤުވެރިކަމާއި، ޤަވާޢިދުން
            <span style="font-family:'JetBrains Mono',monospace;font-weight:800;">${booksReadCount}</span>
            ފޮތް ކިޔައި ނިންމައި ހޯދި ފާހަގަކޮށްލެވޭ ކާމިޔާބީގެ އަގުވަޒަންކުރުމުގެ ގޮތުން ދެވޭ ހަނދާނީ ލިޔުމެކެވެ.
          </div>
        </div>

        <!-- Signatures & Serial Footer -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;align-items:end;padding-top:14px;">
          <div style="text-align:center;">
            <div style="border-bottom:1.5px solid #475569;height:28px;margin-bottom:6px;"></div>
            <div style="font-size:11.5px;font-weight:800;color:#0f172a;">${escapeHtml(principalName)}</div>
            <div style="font-size:10px;color:#64748b;">Principal · ޕްރިންސިޕަލް</div>
          </div>

          <div style="text-align:center;font-family:'JetBrains Mono',monospace;font-size:10px;color:#64748b;">
            <div style="font-weight:800;color:#047857;">Date: ${escapeHtml(issueDate)}</div>
            <div style="margin-top:2px;">Ref: ${escapeHtml(certificateId)}</div>
          </div>

          <div style="text-align:center;">
            <div style="border-bottom:1.5px solid #475569;height:28px;margin-bottom:6px;"></div>
            <div style="font-size:11.5px;font-weight:800;color:#0f172a;">${escapeHtml(librarianName)}</div>
            <div style="font-size:10px;color:#64748b;">Head Librarian · ހެޑް ލައިބްރޭރިއަން</div>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function printBilingualCertificateA4(params: PrintableCertificateParams): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;

  const existing = document.getElementById('magoodhoo-print-sheet-portal');
  if (existing) existing.remove();
  const oldStyle = document.getElementById('magoodhoo-print-sheet-style');
  if (oldStyle) oldStyle.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'magoodhoo-print-sheet-style';
  styleEl.textContent = `
    @page { size: A4 landscape; margin: 10mm; }
    #magoodhoo-print-sheet-portal { display: none; }
    @media print {
      body > *:not(#magoodhoo-print-sheet-portal) { display: none !important; }
      #magoodhoo-print-sheet-portal {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        min-height: 100vh !important;
        background: #ffffff !important;
        color: #0f172a !important;
      }
    }
  `;

  const container = document.createElement('div');
  container.id = 'magoodhoo-print-sheet-portal';
  container.innerHTML = buildCertificateHtml(params);

  document.head.appendChild(styleEl);
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    styleEl.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500);
}
