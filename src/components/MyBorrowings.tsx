import React, { useState } from 'react';
import {
  BookOpen, CheckCircle, RotateCcw, Clock, AlertTriangle,
  Bookmark, XCircle, Award, ArrowUpRight, Calendar
} from 'lucide-react';
import { UserProfile, Loan, Reservation, Book } from '../types';
import { useLanguage } from '../lib/i18n';
import { BorrowingHistoryTableSkeleton } from './Skeletons';
import { evaluateStudentReadingSummary } from '../lib/readingEngagement';
import { LibraryEmblem } from './LibraryEmblem';
import { StatusPill } from './StatusPill';
import { BookCover } from './BookCover';

interface MyBorrowingsProps {
  currentUser: UserProfile;
  loans: Loan[];
  reservations: Reservation[];
  books: Book[];
  onRenewLoan: (loan: Loan) => void;
  onCancelReservation?: (reservationId: string) => void;
  onOpenChallenges?: () => void;
  isLoading?: boolean;
}

export const MyBorrowings: React.FC<MyBorrowingsProps> = ({
  currentUser,
  loans,
  reservations,
  books,
  onRenewLoan,
  onCancelReservation,
  onOpenChallenges,
  isLoading = false
}) => {
  const { t, language } = useLanguage();
  const userLoans = loans.filter(l => l.userId === currentUser.id || l.userName === currentUser.name);
  const activeLoans = userLoans.filter(l => l.status === 'active' || l.status === 'overdue');
  const overdueLoans = activeLoans.filter(l => l.status === 'overdue');
  const returnedLoans = userLoans.filter(l => l.status === 'returned');

  const userReservations = reservations.filter(r => r.userId === currentUser.id || r.userName === currentUser.name);
  const totalLateFees = userLoans.reduce((sum, l) => sum + (l.feePaid ? 0 : (l.lateFee || 0)), 0);

  const [filter, setFilter] = useState<'all' | 'overdue' | 'reservations' | 'history'>('all');
  const readingSummary = evaluateStudentReadingSummary(currentUser, loans, books);

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      {/* Heritage Archival Patron Header */}
      <div className="bg-[#0F4C45] dark:bg-[#0D2623] rounded-2xl p-6 sm:p-7 text-[#F7F5F0] shadow-md relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-[#193D38]">
        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 text-[#F3DFB1] text-xs font-bold uppercase tracking-wider">
            <LibraryEmblem size="xs" variant="light" />
            <span>{t.myLoans}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight archival-heading text-white leading-relaxed">
            {language === 'dv' ? `${currentUser.name} ގެ ލައިބްރަރީ ރެކޯޑް` : `${currentUser.name}'s Library Record`}
          </h2>
          <p className="text-xs sm:text-sm text-[#D1E3DD] font-medium leading-relaxed flex flex-wrap items-center gap-2">
            <span>
              {t.studentId}:{' '}
              <bdi dir="ltr" className="font-mono font-bold text-white bg-white/15 px-2 py-0.5 rounded">
                {currentUser.studentIdCode || currentUser.staffIdCode || currentUser.email}
              </bdi>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {language === 'dv' ? 'ގްރޭޑް' : 'Class'}:{' '}
              <strong className="text-[#F3DFB1]">
                <bdi>{currentUser.grade || currentUser.staffDepartment || (language === 'dv' ? 'މެންބަރު' : 'Standard Member')}</bdi>
              </strong>
            </span>
          </p>
        </div>

        {/* Standing Slip Box */}
        <div className="bg-[#0D2623]/90 dark:bg-[#121413]/70 p-4 rounded-2xl border border-[#193D38] text-start sm:text-end shrink-0 space-y-1.5 min-w-[170px]">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#A7F3D0]">{t.activeLoansCount}</div>
          <div className="text-2xl font-extrabold text-[#F3DFB1] leading-none">
            <bdi dir="ltr" className="font-mono tabular-nums">{activeLoans.length}</bdi>{' '}
            <span className="text-xs font-semibold text-[#D1E3DD]">{t.entries}</span>
          </div>
          <div className="pt-0.5">
            {overdueLoans.length > 0 ? (
              <StatusPill
                status="overdue"
                countPrefix={`${overdueLoans.length}`}
                label={t.statusOverdue}
                compact
              />
            ) : (
              <StatusPill
                status="available"
                label={t.goodStanding}
                compact
              />
            )}
          </div>
        </div>
      </div>

      {/* Overdue Alert Banner */}
      {overdueLoans.length > 0 && (
        <div className="p-5 bg-[#FEF2F2] dark:bg-[#7F1D1D]/25 border border-[#FECACA] dark:border-[#B91C1C]/60 rounded-2xl text-xs text-[#7F1D1D] dark:text-[#FECACA] font-semibold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#B91C1C] text-white flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5" strokeWidth={1.75} />
            </div>
            <div>
              <div className="text-sm font-bold text-[#7F1D1D] dark:text-[#FCA5A5]">
                {t.fineWarningTitle} (<bdi dir="ltr" className="font-mono">{overdueLoans.length}</bdi> {t.entries})
              </div>
              <p className="text-xs text-[#991B1B] dark:text-[#FECACA]/90 font-medium mt-0.5">
                {t.fineWarningDesc}{' '}
                <bdi dir="ltr" className="font-mono font-bold underline">
                  MVR {totalLateFees.toFixed(2)}
                </bdi>
                . {t.fineWarningAction}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setFilter('overdue')}
            className="bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold px-4 py-2 rounded-xl text-xs transition shrink-0 cursor-pointer"
          >
            {t.overdueCountLabel} (<bdi dir="ltr" className="font-mono">{overdueLoans.length}</bdi>)
          </button>
        </div>
      )}

      {/* Archival KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B655D] dark:text-[#A19B91]">{t.activeLoansCount}</span>
            <div className="w-8 h-8 rounded-xl bg-[#ECFDF5] dark:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] flex items-center justify-center">
              <BookOpen className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
            <bdi dir="ltr" className="font-mono tabular-nums">{activeLoans.length}</bdi>
          </div>
          <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-medium">
            {language === 'dv' ? 'މިވަގުތު ނަގާފައިވާ ފޮތްތައް' : 'Books currently checked out'}
          </p>
        </div>

        <div className={`p-4 sm:p-5 rounded-2xl border space-y-2 ${
          overdueLoans.length > 0
            ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/25 border-[#FECACA] dark:border-[#B91C1C]/60'
            : 'bg-[#FFFFFF] dark:bg-[#1A1D1B] border-[#E2DDD5] dark:border-[#2E3330]'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold ${
              overdueLoans.length > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#6B655D] dark:text-[#A19B91]'
            }`}>
              {t.overdueCountLabel}
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              overdueLoans.length > 0
                ? 'bg-[#B91C1C] text-white'
                : 'bg-[#EFECE6] dark:bg-[#232724] text-[#6B655D] dark:text-[#A19B91]'
            }`}>
              <Clock className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className={`text-2xl font-extrabold ${
            overdueLoans.length > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#1C1917] dark:text-[#F5F3EE]'
          }`}>
            <bdi dir="ltr" className="font-mono tabular-nums">{overdueLoans.length}</bdi>
          </div>
          <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-medium">
            {language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް' : 'Past return due date'}
          </p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B655D] dark:text-[#A19B91]">{t.unpaidFines}</span>
            <div className="w-8 h-8 rounded-xl bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#C26D3A] dark:text-[#FCD34D] flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#C26D3A] dark:text-[#FCD34D]">
            <bdi dir="ltr" className="font-mono tabular-nums">MVR {totalLateFees.toFixed(2)}</bdi>
          </div>
          <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-medium">{t.fineRate}</p>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#6B655D] dark:text-[#A19B91]">{t.statusReserved}</span>
            <div className="w-8 h-8 rounded-xl bg-[#EFECE6] dark:bg-[#232724] text-[#C26D3A] dark:text-[#FCD34D] flex items-center justify-center">
              <Bookmark className="w-4 h-4" strokeWidth={1.75} />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
            <bdi dir="ltr" className="font-mono tabular-nums">{userReservations.length}</bdi>
          </div>
          <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-medium">
            {language === 'dv' ? 'ނަންނޯޓު ކުރެވިފައިވާ ފޮތްތައް' : 'Active hold requests'}
          </p>
        </div>
      </div>

      {/* Reading Milestones Strip */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#ECFDF5] dark:bg-[#0F4C45]/40 border border-[#A7F3D0] dark:border-[#16655B] text-[#0F4C45] dark:text-[#6EE7B7] flex items-center justify-center shrink-0">
            <Award className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE]">
              {language === 'dv' ? 'ކިޔުމުގެ ބެޖް މައިލްސްޓޯންސް' : 'Automated Reading Badges & Streaks'}
            </div>
            <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
              <bdi dir="ltr">{readingSummary.earnedBadgeIds.length}/4 earned</bdi> ·{' '}
              <bdi dir="ltr">{readingSummary.verifiedLoans.length} verified reads</bdi> ·{' '}
              <bdi dir="ltr">{readingSummary.bestOnTimeStreak} on-time streak</bdi>
            </div>
          </div>
        </div>
        {onOpenChallenges && (
          <button
            type="button"
            onClick={onOpenChallenges}
            className="px-3.5 py-2 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shrink-0 self-start sm:self-center"
          >
            <span>{language === 'dv' ? 'ބެޖް އަދި ސެޓްފިކެޓް ބަލާ' : 'View Badges & Certificates'}</span>
            <ArrowUpRight className="w-3.5 h-3.5 rtl-mirror" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E2DDD5] dark:border-[#2E3330] pb-2.5 overflow-x-auto text-xs font-bold">
        <button
          type="button"
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            filter === 'all'
              ? 'bg-[#0F4C45] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#232724]'
          }`}
        >
          {t.activeLoansCount} (<bdi dir="ltr" className="font-mono tabular-nums">{activeLoans.length}</bdi>)
        </button>
        <button
          type="button"
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            filter === 'overdue'
              ? 'bg-[#B91C1C] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#FEF2F2] hover:text-[#B91C1C]'
          }`}
        >
          {t.overdueCountLabel} (<bdi dir="ltr" className="font-mono tabular-nums">{overdueLoans.length}</bdi>)
        </button>
        <button
          type="button"
          onClick={() => setFilter('reservations')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            filter === 'reservations'
              ? 'bg-[#C26D3A] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#232724]'
          }`}
        >
          {t.statusReserved} (<bdi dir="ltr" className="font-mono tabular-nums">{userReservations.length}</bdi>)
        </button>
        <button
          type="button"
          onClick={() => setFilter('history')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer whitespace-nowrap ${
            filter === 'history'
              ? 'bg-[#1C1917] dark:bg-[#232724] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#232724]'
          }`}
        >
          {t.borrowingHistory} (<bdi dir="ltr" className="font-mono tabular-nums">{returnedLoans.length}</bdi>)
        </button>
      </div>

      {/* CHECKOUT-SLIP INSPIRED ACTIVE / OVERDUE LOANS */}
      {(filter === 'all' || filter === 'overdue') && (
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#E2DDD5] dark:border-[#2E3330] flex-wrap gap-2">
            <h3 className="text-base font-bold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2 archival-heading">
              <span className="w-8 h-8 rounded-xl bg-[#ECFDF5] dark:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] flex items-center justify-center">
                <BookOpen className="w-4 h-4" strokeWidth={1.75} />
              </span>
              {filter === 'overdue'
                ? `${t.overdueCountLabel} (${overdueLoans.length})`
                : `${t.activeLoansCount} (${activeLoans.length})`}
            </h3>
            <span className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
              {language === 'dv' ? 'ޢާންމު 14 ދުވަހުގެ މުއްދަތު' : 'Standard 14-day Sun–Thu Loan Policy'}
            </span>
          </div>

          {(filter === 'overdue' ? overdueLoans : activeLoans).length === 0 ? (
            <div className="p-8 text-center bg-[#EFECE6]/70 dark:bg-[#232724]/50 rounded-2xl border border-dashed border-[#D6CFC3] dark:border-[#2E3330] space-y-2">
              <BookOpen className="w-8 h-8 text-[#0F4C45] dark:text-[#6EE7B7] mx-auto" strokeWidth={1.75} />
              <div className="text-sm font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                {filter === 'overdue' ? t.noOverdueLoans : t.noActiveLoans}
              </div>
              <p className="text-xs text-[#6B655D] dark:text-[#A19B91] max-w-sm mx-auto font-medium leading-relaxed">
                {filter === 'overdue'
                  ? (language === 'dv' ? 'ހުރިހާ ފޮތެއް ވަނީ ޙަވާލުކުރެވިފައި ނުވަތަ މުއްދަތު ހަމަނުވެއެވެ.' : 'All borrowed books are returned or within their due dates.')
                  : (language === 'dv' ? 'މިވަގުތު ނަގާފައިވާ ފޮތެއް ނެތް. ކެޓަލޮގުން އާ ފޮތެއް ހޯއްދަވާ!' : 'You currently have no checked-out books. Explore the catalog for your next read.')}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(filter === 'overdue' ? overdueLoans : activeLoans).map((loan) => {
                const book = books.find((b) => b.id === loan.bookId);
                const isOverdue = loan.status === 'overdue';

                return (
                  <div
                    key={loan.id}
                    className={`rounded-2xl border transition flex gap-4 p-4 shadow-2xs checkout-ledger-slip ${
                      isOverdue
                        ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border-[#FECACA] dark:border-[#B91C1C]/60'
                        : 'bg-[#FFFDF9] dark:bg-[#232724] border-[#E2DDD5] dark:border-[#2E3330]'
                    }`}
                  >
                    <div className="w-16 h-24 rounded-md overflow-hidden shrink-0 book-cover-card border border-black/10 dark:border-white/10">
                      <BookCover
                        src={book?.coverUrl}
                        title={loan.bookTitle}
                        author={book?.author}
                        ddcCallNumber={book?.ddcCallNumber}
                        category={book?.category}
                        size="sm"
                        aspectRatio="none"
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-[#1C1917] dark:text-[#F5F3EE] text-sm line-clamp-1 archival-heading">
                            <bdi>{loan.bookTitle}</bdi>
                          </h4>
                          <StatusPill
                            status={isOverdue ? 'overdue' : 'checked_out'}
                            label={isOverdue ? t.statusOverdue : t.statusActive}
                            compact
                          />
                        </div>

                        {/* Ruled Checkout Slip Ledger Lines */}
                        <div className="mt-2.5 divide-y divide-dashed divide-[#D6CFC3] dark:divide-[#2E3330] text-[11px]">
                          <div className="py-1 flex items-center justify-between text-[#6B655D] dark:text-[#A19B91]">
                            <span>{t.borrowedDate}</span>
                            <bdi dir="ltr" className="font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                              {loan.issueDate}
                            </bdi>
                          </div>
                          <div className="py-1 flex items-center justify-between text-[#6B655D] dark:text-[#A19B91]">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3 h-3" strokeWidth={1.75} />
                              {t.dueDate}
                            </span>
                            <span
                              className={`font-mono font-extrabold px-1.5 py-0.5 rounded border ${
                                isOverdue
                                  ? 'bg-[#FEE2E2] dark:bg-[#7F1D1D]/40 text-[#B91C1C] dark:text-[#FCA5A5] border-[#FCA5A5]'
                                  : 'bg-[#ECFDF5] dark:bg-[#0F4C45]/40 text-[#0F4C45] dark:text-[#6EE7B7] border-[#A7F3D0] dark:border-[#16655B]'
                              }`}
                            >
                              <bdi dir="ltr">{loan.dueDate}</bdi>
                            </span>
                          </div>
                          {loan.copyBarcode && (
                            <div className="py-1 flex items-center justify-between text-[#6B655D] dark:text-[#A19B91]">
                              <span>Copy ID</span>
                              <bdi dir="ltr" className="font-mono font-semibold text-[#1C1917] dark:text-[#E2DDD5]">
                                {loan.copyBarcode}
                              </bdi>
                            </div>
                          )}
                        </div>

                        {isOverdue && (
                          <div className="text-[#B91C1C] dark:text-[#FCA5A5] font-bold mt-1.5 text-[11px] bg-[#FEE2E2]/80 dark:bg-[#7F1D1D]/30 px-2.5 py-1 rounded-lg border border-[#FECACA] dark:border-[#B91C1C]/50 flex items-center gap-1">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={1.75} />
                            <span>
                              {t.lateFeeAccumulating}{' '}
                              <bdi dir="ltr" className="font-mono">
                                MVR {loan.lateFee.toFixed(2)}
                              </bdi>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-[#E2DDD5] dark:border-[#2E3330] flex-wrap gap-2">
                        <span className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-semibold">
                          {t.renewalsUsed}:{' '}
                          <bdi dir="ltr" className="font-mono font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                            {loan.renewalCount}/2
                          </bdi>
                        </span>
                        <button
                          type="button"
                          onClick={() => onRenewLoan(loan)}
                          disabled={isOverdue || loan.renewalCount >= 2}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isOverdue || loan.renewalCount >= 2
                              ? 'bg-[#EFECE6] dark:bg-[#1A1D1B] text-[#6B655D] dark:text-[#A19B91] cursor-not-allowed border border-[#E2DDD5] dark:border-[#2E3330]'
                              : 'bg-[#0F4C45] hover:bg-[#16655B] text-white shadow-xs'
                          }`}
                          id={`renew-btn-${loan.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5 rtl-mirror" strokeWidth={1.75} />
                          <span>{loan.renewalCount >= 2 ? t.maxRenewed : t.extendLoan}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ONLINE RESERVATIONS QUEUE SECTION */}
      {(filter === 'all' || filter === 'reservations') && userReservations.length > 0 && (
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2 archival-heading">
            <span className="w-8 h-8 rounded-xl bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#C26D3A] dark:text-[#FCD34D] flex items-center justify-center">
              <Bookmark className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <span>
              {t.statusReserved} (<bdi dir="ltr" className="font-mono">{userReservations.length}</bdi>)
            </span>
          </h3>

          <div className="space-y-2">
            {userReservations.map((res) => (
              <div
                key={res.id}
                className="p-4 bg-[#FFFBEB]/70 dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#B45309]/50 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div>
                  <span className="font-bold text-sm text-[#1C1917] dark:text-[#F5F3EE] block">
                    <bdi>{res.bookTitle}</bdi>
                  </span>
                  <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-medium mt-0.5">
                    {language === 'dv' ? 'ރިޒަވޭޝަން ހުށަހެޅި ތާރީޚް:' : 'Reservation submitted on:'}{' '}
                    <bdi dir="ltr" className="font-mono text-[#1C1917] dark:text-[#F5F3EE]">
                      {res.requestDate}
                    </bdi>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusPill
                    status="reserved"
                    label={res.status === 'pending' ? t.statusPending : res.status}
                  />
                  {onCancelReservation && (
                    <button
                      type="button"
                      onClick={() => onCancelReservation(res.id)}
                      className="bg-[#B91C1C] hover:bg-[#991B1B] text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1 cursor-pointer shrink-0"
                      title={t.cancelReservation}
                    >
                      <XCircle className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>{t.cancel}</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RETURNED BORROWING HISTORY SECTION */}
      {(filter === 'all' || filter === 'history') && (
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2 archival-heading">
            <span className="w-8 h-8 rounded-xl bg-[#EFECE6] dark:bg-[#232724] text-[#0F4C45] dark:text-[#6EE7B7] flex items-center justify-center">
              <CheckCircle className="w-4 h-4" strokeWidth={1.75} />
            </span>
            <span>
              {t.borrowingHistory} (<bdi dir="ltr" className="font-mono">{returnedLoans.length}</bdi>)
            </span>
          </h3>

          {isLoading ? (
            <BorrowingHistoryTableSkeleton rows={4} />
          ) : returnedLoans.length === 0 ? (
            <div className="p-6 text-center bg-[#EFECE6]/70 dark:bg-[#232724]/50 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
              {language === 'dv' ? 'އަދި ކުރީގެ ރެކޯޑެއް ނެތް.' : 'No previous borrowing history recorded yet.'}
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl bg-[#FFFFFF] dark:bg-[#1A1D1B]">
              <table className="w-full text-start text-xs text-[#1C1917] dark:text-[#F5F3EE]">
                <thead className="bg-[#0D2623] dark:bg-[#232724] text-[#F7F5F0] font-bold uppercase text-[10px] border-b border-[#193D38] dark:border-[#2E3330]">
                  <tr>
                    <th className="p-3.5 border-e border-[#193D38] dark:border-[#2E3330]">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                    <th className="p-3.5 border-e border-[#193D38] dark:border-[#2E3330]">{t.borrowedDate}</th>
                    <th className="p-3.5 border-e border-[#193D38] dark:border-[#2E3330]">{t.returnedDate}</th>
                    <th className="p-3.5">{t.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330]">
                  {returnedLoans.map((loan) => (
                    <tr key={loan.id} className="hover:bg-[#F7F5F0] dark:hover:bg-[#232724]/60 transition">
                      <td className="p-3.5 font-bold text-[#1C1917] dark:text-[#F5F3EE] border-e border-[#E2DDD5]/70 dark:border-[#2E3330]">
                        <bdi>{loan.bookTitle}</bdi>
                      </td>
                      <td className="p-3.5 font-mono text-[#6B655D] dark:text-[#A19B91] font-semibold border-e border-[#E2DDD5]/70 dark:border-[#2E3330]">
                        <bdi dir="ltr">{loan.issueDate}</bdi>
                      </td>
                      <td className="p-3.5 font-mono text-[#0F4C45] dark:text-[#6EE7B7] font-semibold border-e border-[#E2DDD5]/70 dark:border-[#2E3330]">
                        <bdi dir="ltr">{loan.returnDate || t.statusReturned}</bdi>
                      </td>
                      <td className="p-3.5">
                        <StatusPill status="available" label={t.statusReturned} compact />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
