import React, { useMemo } from 'react';
import { Award, ArrowUpRight, BookOpenCheck, ShieldCheck, Trophy } from 'lucide-react';
import { Book, Loan, UserProfile } from '../types';
import { useLanguage } from '../lib/i18n';
import { computeClassAndHouseLeaderboards } from '../lib/readingEngagement';

interface TopReadingClassesWidgetProps {
  users: UserProfile[];
  loans: Loan[];
  books: Book[];
  onOpenChallenges?: () => void;
}

export const TopReadingClassesWidget: React.FC<TopReadingClassesWidgetProps> = ({
  users,
  loans,
  books,
  onOpenChallenges,
}) => {
  const { language } = useLanguage();
  const isDv = language === 'dv';

  const { classes, houses } = useMemo(
    () => computeClassAndHouseLeaderboards(users, loans, books),
    [users, loans, books]
  );

  if (classes.length === 0) return null;

  const topHouse = houses[0];

  return (
    <section
      aria-label="Top Reading Classes This Term"
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
            <Trophy className="w-3.5 h-3.5 shrink-0" />
            <span>
              {isDv ? 'މި ޓާމުގެ އެންމެ ކުރީގައިވާ ކްލާސްތައް' : 'Top Reading Classes This Term'}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {isDv
              ? 'ކްލާސްތަކާއި ހައުސްތަކުގެ ޖުމްލަ ކިޔުމުގެ ކުރިއެރުން (ފަރުދީ ރޭންކިންގ ނުހިމެނޭ).'
              : 'Collective class & house milestones verified by loan duration (privacy-safe aggregate standings).'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {topHouse && (
            <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {isDv ? 'ލީޑިންގ ހައުސް:' : 'Leading House:'}{' '}
                <strong className="text-slate-900 dark:text-white"><bdi>{topHouse.houseName}</bdi></strong>
                {' · '}
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400 font-bold">
                  <bdi>{topHouse.housePoints} pts</bdi>
                </span>
              </span>
            </div>
          )}

          {onOpenChallenges && (
            <button
              type="button"
              onClick={onOpenChallenges}
              className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer whitespace-nowrap shrink-0"
            >
              <span>{isDv ? 'ބެޖް އަދި ޗެލެންޖް' : 'Challenges & Badges'}</span>
              <ArrowUpRight className="w-3.5 h-3.5 rtl-mirror shrink-0" />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {classes.slice(0, 4).map((cls, index) => (
          <div
            key={cls.gradeName}
            className="p-3.5 rounded-xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-2.5"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="font-bold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                <span className="font-mono tabular-nums text-xs font-black text-emerald-700 dark:text-emerald-400">
                  #{index + 1}
                </span>
                <bdi>{cls.gradeName}</bdi>
              </div>
              <span className="text-[11px] font-mono tabular-nums font-bold text-slate-600 dark:text-slate-300">
                <bdi>{cls.verifiedBooksRead} reads</bdi>
              </span>
            </div>

            <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 rounded-full transition-all duration-300"
                style={{ width: `${Math.max(8, cls.collectiveProgressPct)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              <span className="flex items-center gap-1">
                <BookOpenCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <bdi>{cls.totalBadgesEarned} badges</bdi>
              </span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-sky-600 shrink-0" />
                <bdi>{cls.onTimeReturnRatePct}% on-time</bdi>
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
