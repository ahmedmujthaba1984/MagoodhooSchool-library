import React, { useMemo, useState } from 'react';
import {
  Award,
  BookOpen,
  CheckCircle2,
  Compass,
  Flame,
  Languages,
  Lock,
  Printer,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
} from 'lucide-react';
import { Book, Loan, SchoolHouse, UserProfile } from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import {
  BadgeId,
  READING_BADGES,
  buildCertificateHtml,
  computeClassAndHouseLeaderboards,
  evaluateStudentReadingSummary,
  printBilingualCertificateA4,
} from '../lib/readingEngagement';

interface ReadingEngagementViewProps {
  currentUser: UserProfile;
  users: UserProfile[];
  loans: Loan[];
  books: Book[];
}

type EngagementTab = 'badges' | 'leaderboards' | 'certificates';

const BADGE_ICONS: Record<BadgeId, React.ComponentType<{ className?: string }>> = {
  'bilingual-explorer': Languages,
  'genre-voyager': Compass,
  'term-bookworm': BookOpen,
  'zero-late-streak': Flame,
};

const TERM_OPTIONS = [
  { en: 'Term 2 · 2026', dv: '2026 ދެވަނަ ޓާމް' },
  { en: 'Term 1 · 2026', dv: '2026 ފުރަތަމަ ޓާމް' },
  { en: 'Annual Reading Week · 2026', dv: '2026 ކިޔުމުގެ ހަފްތާ' },
];

export const ReadingEngagementView: React.FC<ReadingEngagementViewProps> = ({
  currentUser,
  users,
  loans,
  books,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isDv = language === 'dv';

  const isStaffOrAdmin = currentUser.role === 'admin' || currentUser.role === 'staff';
  const students = useMemo(() => users.filter((u) => u.role === 'student'), [users]);

  const defaultStudentId = useMemo(() => {
    if (currentUser.role === 'student') return currentUser.id;
    if (currentUser.role === 'parent' && currentUser.childrenIds?.length) {
      return currentUser.childrenIds[0];
    }
    return students.find((s) => s.id === 'user-student-4')?.id || students[0]?.id || currentUser.id;
  }, [currentUser, students]);

  const [selectedStudentId, setSelectedStudentId] = useState<string>(defaultStudentId);
  const [activeSubTab, setActiveSubTab] = useState<EngagementTab>('badges');

  const activeStudent = useMemo(
    () =>
      users.find((u) => u.id === selectedStudentId) ||
      students[0] ||
      currentUser,
    [users, selectedStudentId, students, currentUser]
  );

  const studentSummary = useMemo(
    () => evaluateStudentReadingSummary(activeStudent, loans, books),
    [activeStudent, loans, books]
  );

  const { classes, houses } = useMemo(
    () => computeClassAndHouseLeaderboards(users, loans, books),
    [users, loans, books]
  );

  // ---------- BILINGUAL A4 CERTIFICATE STUDIO STATE ----------
  const [certStudentName, setCertStudentName] = useState<string>('');
  const [certStudentNameDv, setCertStudentNameDv] = useState<string>('');
  const [certGrade, setCertGrade] = useState<string>('');
  const [certHouse, setCertHouse] = useState<string>('');
  const [certBooksRead, setCertBooksRead] = useState<number | null>(null);
  const [certTermIdx, setCertTermIdx] = useState<number>(0);
  const [certBadgeId, setCertBadgeId] = useState<BadgeId | 'overall'>('overall');
  const [principalName, setPrincipalName] = useState<string>('Ahmed Mujthaba (Principal)');
  const [librarianName, setLibrarianName] = useState<string>('Ms. Eleanor Davis (Head Librarian)');

  const resolvedCertStudentName = certStudentName || activeStudent.name;
  const resolvedCertStudentNameDv = certStudentNameDv || activeStudent.dhivehiName || '';
  const resolvedCertGrade = certGrade || activeStudent.grade || 'Grade 7';
  const resolvedCertHouse = certHouse || activeStudent.schoolHouse || 'Ghaazee';
  const resolvedBooksRead =
    certBooksRead !== null
      ? certBooksRead
      : Math.max(studentSummary.verifiedLoans.length, activeStudent.booksCompletedCount || 0);

  const selectedTerm = TERM_OPTIONS[certTermIdx] || TERM_OPTIONS[0];
  const selectedBadgeDef = READING_BADGES.find((b) => b.id === certBadgeId);

  const certificateParams = useMemo(
    () => ({
      studentName: resolvedCertStudentName,
      studentNameDv: resolvedCertStudentNameDv || undefined,
      grade: resolvedCertGrade,
      schoolHouse: (resolvedCertHouse as SchoolHouse) || undefined,
      booksReadCount: resolvedBooksRead,
      termName: selectedTerm.en,
      termNameDv: selectedTerm.dv,
      achievementTitleEn: selectedBadgeDef
        ? `${selectedBadgeDef.titleEn} Award`
        : 'Distinguished School Reader',
      achievementTitleDv: selectedBadgeDef
        ? `${selectedBadgeDef.titleDv} އެވޯޑް`
        : 'ފާހަގަކޮށްލެވޭ ސްކޫލް ކިޔުންތެރިޔާ',
      issueDate: new Date().toISOString().split('T')[0],
      principalName,
      librarianName,
      certificateId: `MAG-CERT-${activeStudent.studentIdCode || '2026'}-${resolvedBooksRead}`,
    }),
    [
      resolvedCertStudentName,
      resolvedCertStudentNameDv,
      resolvedCertGrade,
      resolvedCertHouse,
      resolvedBooksRead,
      selectedTerm,
      selectedBadgeDef,
      principalName,
      librarianName,
      activeStudent.studentIdCode,
    ]
  );

  const handleSelectStudentForStudio = (id: string) => {
    setSelectedStudentId(id);
    setCertStudentName('');
    setCertStudentNameDv('');
    setCertGrade('');
    setCertHouse('');
    setCertBooksRead(null);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header + Sub-Navigation */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <Trophy className="w-4 h-4 shrink-0" />
            <span>
              {isDv ? 'ދަރިވަރުންގެ ކިޔުމުގެ ޕްރޮގްރާމް' : 'Student Reading Engagement & Recognition'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isDv
              ? 'ކިޔުމުގެ ބެޖްތައް، ކްލާސް ލީޑަރބޯޑް އަދި ސެޓްފިކެޓް'
              : 'Reading Challenges, Class Leaderboards & Certificate Studio'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isDv
              ? 'ފޮތް ޙަވާލުކުރުމުން އޮޓޮމެޓިކުން ބެޖްތައް ލިބޭނެ، އަދި ދެބަހުން A4 ސެޓްފިކެޓް ޕްރިންޓްކުރެވޭނެ.'
              : 'Automated milestone badges verified by genuine loan duration, privacy-safe collective standings, and bilingual A4 certificates.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 self-start lg:self-center shrink-0">
          {(
            [
              { id: 'badges', label: isDv ? 'މައިލްސްޓޯން ބެޖް' : 'Milestones & Badges', icon: Award },
              { id: 'leaderboards', label: isDv ? 'ކްލާސް / ހައުސް' : 'Class & House Standings', icon: Users },
              { id: 'certificates', label: isDv ? 'A4 ސެޓްފިކެޓް' : 'A4 Certificate Studio', icon: Printer },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSubTab(tab.id)}
                className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                  activeSubTab === tab.id
                    ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs border border-slate-200 dark:border-slate-700'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Student Selector Bar for Librarians, Teachers, and Parents */}
      {(isStaffOrAdmin || (currentUser.role === 'parent' && (currentUser.childrenIds?.length || 0) > 0)) && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-bold text-slate-900 dark:text-white">
              {isDv ? 'ދަރިވަރު ޚިޔާރުކުރޭ:' : 'Viewing Student Reading Profile:'}
            </span>{' '}
            <span className="font-mono text-slate-500">
              <bdi>{activeStudent.grade || 'Student'}</bdi>
              {activeStudent.schoolHouse ? ` · ${activeStudent.schoolHouse} House` : ''}
            </span>
          </div>

          <select
            value={activeStudent.id}
            onChange={(e) => handleSelectStudentForStudio(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 sm:w-72"
          >
            {(currentUser.role === 'parent'
              ? students.filter((s) => currentUser.childrenIds?.includes(s.id))
              : students
            ).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.grade || 'Student'} · {s.schoolHouse || 'School'})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* ==================== TAB 1: AUTOMATED READING MILESTONES & BADGES ==================== */}
      {activeSubTab === 'badges' && (
        <div className="space-y-5">
          {/* Student Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Verified Books Completed</div>
              <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                <bdi>{studentSummary.verifiedLoans.length}</bdi>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                <bdi>{studentSummary.dhivehiCount}</bdi> Dv · <bdi>{studentSummary.englishCount}</bdi> En
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Dewey Genres Explored</div>
              <div className="text-2xl font-black font-mono tabular-nums text-sky-700 dark:text-sky-400 mt-1">
                <bdi>{studentSummary.distinctDeweyCategories.length}</bdi>
              </div>
              <div className="text-[11px] text-slate-500 truncate mt-0.5">
                {studentSummary.distinctDeweyCategories.slice(0, 3).join(', ') || 'None yet'}
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">On-Time Streak</div>
              <div className="text-2xl font-black font-mono tabular-nums text-indigo-700 dark:text-indigo-400 mt-1">
                <bdi>{studentSummary.bestOnTimeStreak}</bdi>
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Current: <span className="font-mono"><bdi>{studentSummary.currentOnTimeStreak}</bdi></span>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
              <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400">Badges Unlocked</div>
              <div className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">
                <bdi>{studentSummary.earnedBadgeIds.length}</bdi> / 4
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Term: <span className="font-mono"><bdi>{studentSummary.peakTermLabel}</bdi></span>
              </div>
            </div>
          </div>

          {/* 4 Automated Milestone Badge Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {studentSummary.badges.map((item) => {
              const Icon = BADGE_ICONS[item.badge.id];
              return (
                <div
                  key={item.badge.id}
                  className={`bg-white dark:bg-slate-900 rounded-2xl border p-5 flex flex-col justify-between gap-4 ${
                    item.earned
                      ? 'border-emerald-300 dark:border-emerald-700'
                      : 'border-slate-200 dark:border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                          item.earned
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="space-y-0.5">
                        <div className="text-sm font-black text-slate-900 dark:text-white">
                          {isDv ? item.badge.titleDv : item.badge.titleEn}
                        </div>
                        <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                          {isDv ? item.badge.descriptionDv : item.badge.descriptionEn}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-xs font-bold shrink-0">
                      {item.earned ? (
                        <span className="text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Earned</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5 shrink-0" />
                          <span className="font-mono tabular-nums"><bdi>{item.progressPct}%</bdi></span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          item.earned ? 'bg-emerald-600' : 'bg-slate-400 dark:bg-slate-500'
                        }`}
                        style={{ width: `${Math.max(item.progressPct > 0 ? 6 : 0, item.progressPct)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <span><bdi>{item.detailText}</bdi></span>
                      {item.earned && (
                        <button
                          type="button"
                          onClick={() => {
                            setCertBadgeId(item.badge.id);
                            setActiveSubTab('certificates');
                          }}
                          className="font-sans font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                        >
                          Print Certificate →
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Anti-Gaming Verification Notice + Quick Check-in Exclusions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-start gap-2.5 text-slate-600 dark:text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-900 dark:text-white">
                  Duration-Verified Reading Integrity:
                </span>{' '}
                Badges update automatically upon book check-in. Returns completed within 4 hours of checkout (e.g., rapid 5-minute check-ins) are excluded from badge and leaderboard credit.
              </div>
            </div>
            {studentSummary.excludedQuickLoans.length > 0 && (
              <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 shrink-0">
                <bdi>{studentSummary.excludedQuickLoans.length}</bdi> quick return(s) excluded
              </span>
            )}
          </div>
        </div>
      )}

      {/* ==================== TAB 2: PRIVACY-SAFE CLASS & HOUSE LEADERBOARDS ==================== */}
      {activeSubTab === 'leaderboards' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Class / Grade Leaderboard */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {isDv ? 'ގްރޭޑް / ކްލާސް ލީޑަރބޯޑް' : 'Grade & Class Collective Leaderboard'}
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Privacy-safe aggregate class totals celebrating collective milestones without individual student rankings.
                </p>
              </div>
              <span className="text-[11px] font-mono text-slate-500"><bdi>{classes.length}</bdi> classes</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-2.5 px-4">Rank & Class</th>
                    <th className="py-2.5 px-3 text-end">Verified Reads</th>
                    <th className="py-2.5 px-3 text-end">Avg / Student</th>
                    <th className="py-2.5 px-3 text-end">On-Time %</th>
                    <th className="py-2.5 px-4 text-end">Badges</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {classes.map((c, idx) => (
                    <tr key={c.gradeName} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                            #{idx + 1}
                          </span>
                          <bdi>{c.gradeName}</bdi>
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono tabular-nums">
                          <bdi>{c.studentCount}</bdi> reader(s) · <bdi>{c.dhivehiCount}</bdi> Dv / <bdi>{c.englishCount}</bdi> En
                        </div>
                      </td>
                      <td className="py-3 px-3 text-end font-mono tabular-nums font-black text-slate-900 dark:text-white">
                        <bdi>{c.verifiedBooksRead}</bdi>
                      </td>
                      <td className="py-3 px-3 text-end font-mono tabular-nums">
                        <bdi>{c.avgBooksPerStudent}</bdi>
                      </td>
                      <td className="py-3 px-3 text-end font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                        <bdi>{c.onTimeReturnRatePct}%</bdi>
                      </td>
                      <td className="py-3 px-4 text-end font-mono tabular-nums font-bold">
                        <bdi>{c.totalBadgesEarned}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* School House Standings */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                {isDv ? 'ސްކޫލް ހައުސް ޗެމްޕިއަންޝިޕް' : 'School House Reading Championship'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Points: 10 pts per verified book · 25 pts per milestone badge · 2 pts per punctual return.
              </p>
            </div>

            <div className="space-y-3">
              {houses.map((h, idx) => {
                const maxPts = Math.max(1, houses[0]?.housePoints || 1);
                const pct = Math.round((h.housePoints / maxPts) * 100);
                return (
                  <div key={h.houseName} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="font-bold text-slate-900 dark:text-white">
                        <span className="font-mono text-slate-400 me-1.5">#{idx + 1}</span>
                        <bdi>{h.houseName}</bdi>
                        <span className="text-slate-400 font-normal ms-2 text-[11px]">
                          <bdi>{h.houseDhivehi}</bdi>
                        </span>
                      </div>
                      <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                        <bdi>{h.housePoints} pts</bdi>
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(h.housePoints > 0 ? 8 : 0, pct)}%`,
                          backgroundColor: h.accentHex,
                        }}
                      />
                    </div>
                    <div className="text-[11px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
                      <bdi>{h.verifiedBooksRead} books</bdi> · <bdi>{h.badgesUnlocked} badges</bdi> · <bdi>{h.onTimeReturnRatePct}% on-time</bdi>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 3: BILINGUAL PRINTABLE A4 CERTIFICATE STUDIO ==================== */}
      {activeSubTab === 'certificates' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Form Controls (Left 4 cols) */}
          <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-black text-slate-900 dark:text-white">
                Certificate Customization
              </h3>
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-400 font-bold">A4 Landscape</span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Student Name (English)
              </label>
              <input
                type="text"
                value={resolvedCertStudentName}
                onChange={(e) => setCertStudentName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Student Name (Dhivehi Thaana)
              </label>
              <input
                type="text"
                dir="rtl"
                value={resolvedCertStudentNameDv}
                onChange={(e) => setCertStudentNameDv(e.target.value)}
                placeholder="ދިވެހި ނަން"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-faruma text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Grade / Class
                </label>
                <input
                  type="text"
                  value={resolvedCertGrade}
                  onChange={(e) => setCertGrade(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Verified Books Read
                </label>
                <input
                  type="number"
                  min={0}
                  value={resolvedBooksRead}
                  onChange={(e) => setCertBooksRead(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Academic Term
                </label>
                <select
                  value={certTermIdx}
                  onChange={(e) => setCertTermIdx(Number(e.target.value))}
                  className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  {TERM_OPTIONS.map((tm, idx) => (
                    <option key={tm.en} value={idx}>
                      {tm.en}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Award Citation
                </label>
                <select
                  value={certBadgeId}
                  onChange={(e) => setCertBadgeId(e.target.value as BadgeId | 'overall')}
                  className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="overall">Distinguished Reader</option>
                  {READING_BADGES.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.titleEn}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Principal Signature Line
                </label>
                <input
                  type="text"
                  value={principalName}
                  onChange={(e) => setPrincipalName(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                  Librarian Signature Line
                </label>
                <input
                  type="text"
                  value={librarianName}
                  onChange={(e) => setLibrarianName(e.target.value)}
                  className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                printBilingualCertificateA4(certificateParams);
                toast.success(
                  `Prepared bilingual A4 reading certificate for ${resolvedCertStudentName}.`,
                  'Print A4 Certificate'
                );
              }}
              className="w-full py-2.5 px-4 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span>Print / Save A4 Bilingual Certificate</span>
            </button>
          </div>

          {/* Live A4 Bilingual Preview (Right 8 cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3 overflow-x-auto">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                Live A4 Print Preview (English + Faruma Thaana)
              </span>
              <span className="font-mono"><bdi>{certificateParams.certificateId}</bdi></span>
            </div>

            <div
              className="min-w-[680px] rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
              dangerouslySetInnerHTML={{ __html: buildCertificateHtml(certificateParams) }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
