import React, { useState } from 'react';
import {
  BookOpen, CheckCircle, RotateCcw, Clock, AlertTriangle,
  Bookmark, ShieldAlert, Sparkles, UserCheck, DollarSign,
  ArrowRight, Users, Check, AlertCircle, School, Calendar
} from 'lucide-react';
import { UserProfile, Loan, Reservation, Book } from '../types';
import { useLanguage } from '../lib/i18n';

interface MyBorrowingsProps {
  currentUser: UserProfile;
  loans: Loan[];
  reservations: Reservation[];
  books: Book[];
  onRenewLoan: (loan: Loan) => void;
}

export const MyBorrowings: React.FC<MyBorrowingsProps> = ({
  currentUser,
  loans,
  reservations,
  books,
  onRenewLoan
}) => {
  const { t, language } = useLanguage();
  // Filter loans for current user
  const userLoans = loans.filter(l => l.userId === currentUser.id || l.userName === currentUser.name);
  const activeLoans = userLoans.filter(l => l.status === 'active' || l.status === 'overdue');
  const overdueLoans = activeLoans.filter(l => l.status === 'overdue');
  const returnedLoans = userLoans.filter(l => l.status === 'returned');

  // Filter reservations for current user
  const userReservations = reservations.filter(r => r.userId === currentUser.id || r.userName === currentUser.name);

  // Total late fees accumulated
  const totalLateFees = userLoans.reduce((sum, l) => sum + (l.feePaid ? 0 : (l.lateFee || 0)), 0);

  // Tab filter for active vs overdue vs history
  const [filter, setFilter] = useState<'all' | 'overdue' | 'reservations' | 'history'>('all');

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-300">
      
      {/* Personnel Profile Header Banner */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-700 to-indigo-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 border border-emerald-500/20">
        <div className="space-y-2 max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-md text-emerald-200 border border-white/20 px-3.5 py-1 rounded-full text-[11px] font-extrabold uppercase tracking-wider">
            <UserCheck className="w-3.5 h-3.5 text-amber-300" /> {t.myLoans}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight drop-shadow-xs">
            {language === 'dv' ? `${currentUser.name} ގެ ލައިބްރަރީ ރެކޯޑް` : `${currentUser.name}'s Personnel Records`}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-100 font-medium leading-relaxed">
            {language === 'dv' ? 'މެންބަރު އައިޑީ' : 'Member ID'}: <span className="font-mono font-bold text-white bg-white/20 px-2 py-0.5 rounded">{currentUser.studentIdCode || currentUser.email}</span> • {language === 'dv' ? 'ކްލާސް' : 'Class'}: <span className="font-bold text-amber-300">{currentUser.grade || (language === 'dv' ? 'މެންބަރު' : 'Standard Member')}</span>
          </p>
        </div>

        {/* Quick Summary Pill Box */}
        <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/20 text-center sm:text-right shrink-0 space-y-1">
          <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-200">{language === 'dv' ? 'ނަގާފައިވާ ފޮތްތައް' : 'Active Circulation'}</div>
          <div className="text-2xl font-black text-amber-300">{activeLoans.length} {language === 'dv' ? 'ފޮތް' : 'Book'}{activeLoans.length !== 1 && language !== 'dv' ? 's' : ''}</div>
          <div className="text-[11px] text-white/90 font-bold">
            {overdueLoans.length > 0 ? (
              <span className="text-rose-300 font-extrabold flex items-center justify-end gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {overdueLoans.length} {language === 'dv' ? 'މުއްދަތު ހަމަވެފައި' : 'Overdue'}
              </span>
            ) : (
              <span className="text-emerald-300 font-bold">✓ {language === 'dv' ? 'ހުރިހާ ފޮތެއްގެ މުއްދަތު ހަމަނުވޭ' : 'All Loans in Good Standing'}</span>
            )}
          </div>
        </div>
      </div>

      {/* OVERDUE CRITICAL ALERT BANNER */}
      {overdueLoans.length > 0 && (
        <div className="p-5 bg-rose-50 border-2 border-rose-300 rounded-3xl text-xs text-rose-950 font-bold flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md animate-bounce-short">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-black text-rose-900">
                Action Required: {overdueLoans.length} Overdue Book{overdueLoans.length > 1 ? 's' : ''} Detected!
              </div>
              <p className="text-xs text-rose-700 font-medium mt-0.5">
                Total late fine accumulated: <span className="font-black text-rose-900 underline">${totalLateFees.toFixed(2)}</span>. Please return these books to the library desk or contact the librarian.
              </p>
            </div>
          </div>
          <button
            onClick={() => setFilter('overdue')}
            className="bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition shrink-0 cursor-pointer shadow-xs"
          >
            View Overdue Books ({overdueLoans.length})
          </button>
        </div>
      )}

      {/* STATS OVERVIEW CARDS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Active Loans */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Active Loans</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{activeLoans.length}</div>
          <p className="text-[11px] text-slate-400 font-medium">Books currently borrowed</p>
        </div>

        {/* Overdue */}
        <div className={`p-4 sm:p-5 rounded-2xl border shadow-xs space-y-2 ${
          overdueLoans.length > 0 ? 'bg-rose-50/80 border-rose-200' : 'bg-white border-slate-200/80'
        }`}>
          <div className="flex items-center justify-between">
            <span className={`text-xs font-bold uppercase ${overdueLoans.length > 0 ? 'text-rose-700' : 'text-slate-500'}`}>
              Overdue Books
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              overdueLoans.length > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-400'
            }`}>
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className={`text-2xl font-black ${overdueLoans.length > 0 ? 'text-rose-900' : 'text-slate-900'}`}>
            {overdueLoans.length}
          </div>
          <p className="text-[11px] text-slate-400 font-medium">Past maximum return date</p>
        </div>

        {/* Late Fines */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Accumulated Fines</span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">${totalLateFees.toFixed(2)}</div>
          <p className="text-[11px] text-slate-400 font-medium">Late fee balance</p>
        </div>

        {/* Online Reservations */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase">Reservations</span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900">{userReservations.length}</div>
          <p className="text-[11px] text-slate-400 font-medium">Queue requests</p>
        </div>
      </div>

      {/* FILTER TABS */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto text-xs font-bold">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            filter === 'all' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          All Active Circulation ({activeLoans.length})
        </button>
        <button
          onClick={() => setFilter('overdue')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            filter === 'overdue' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:bg-rose-50 hover:text-rose-700'
          }`}
        >
          Overdue Items ({overdueLoans.length})
        </button>
        <button
          onClick={() => setFilter('reservations')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            filter === 'reservations' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:bg-purple-50 hover:text-purple-700'
          }`}
        >
          Reservations ({userReservations.length})
        </button>
        <button
          onClick={() => setFilter('history')}
          className={`px-4 py-2 rounded-xl transition cursor-pointer ${
            filter === 'history' ? 'bg-slate-800 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Borrowing History ({returnedLoans.length})
        </button>
      </div>

      {/* ACTIVE CIRCULATION / OVERDUE SECTION */}
      {(filter === 'all' || filter === 'overdue') && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <span className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <BookOpen className="w-4 h-4" />
              </span>
              {filter === 'overdue' ? `Overdue Circulation Books (${overdueLoans.length})` : `Active Book Circulation (${activeLoans.length})`}
            </h3>
            <span className="text-xs text-slate-500 font-medium">Standard 14-day Loan Policy</span>
          </div>

          {(filter === 'overdue' ? overdueLoans : activeLoans).length === 0 ? (
            <div className="p-8 text-center bg-slate-50/80 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <BookOpen className="w-8 h-8 text-emerald-500 mx-auto" />
              <div className="text-sm font-bold text-slate-800">
                {filter === 'overdue' ? 'No Overdue Books!' : 'No Active Loans Right Now'}
              </div>
              <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
                {filter === 'overdue' 
                  ? 'Great job! All your borrowed books are returned or within their due dates.' 
                  : 'You currently have no checked-out books. Search the online catalog to discover your next read!'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {(filter === 'overdue' ? overdueLoans : activeLoans).map(loan => {
                const book = books.find(b => b.id === loan.bookId);
                const isOverdue = loan.status === 'overdue';

                return (
                  <div
                    key={loan.id}
                    className={`p-4 rounded-2xl border transition flex gap-4 shadow-2xs hover:shadow-md ${
                      isOverdue 
                        ? 'bg-rose-50/90 border-rose-300 text-rose-950' 
                        : 'bg-gradient-to-br from-emerald-50/40 via-white to-slate-50 border-slate-200 text-slate-900'
                    }`}
                  >
                    {book && (
                      <img
                        src={book.coverUrl}
                        alt={book.title}
                        className="w-16 h-22 object-cover rounded-xl shadow-xs border border-slate-200 shrink-0"
                      />
                    )}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{loan.bookTitle}</h4>
                          {isOverdue ? (
                            <span className="bg-rose-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs shrink-0">
                              OVERDUE
                            </span>
                          ) : (
                            <span className="bg-emerald-600 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full shadow-2xs shrink-0">
                              ON LOAN
                            </span>
                          )}
                        </div>

                        <div className="mt-2 space-y-1 text-xs text-slate-600 font-medium">
                          <div>Borrowed On: <span className="font-bold text-slate-800">{loan.issueDate}</span></div>
                          <div>Due Date: <span className={`font-extrabold ${isOverdue ? 'text-rose-700 underline' : 'text-emerald-700'}`}>{loan.dueDate}</span></div>
                          {isOverdue && (
                            <div className="text-rose-700 font-extrabold mt-1 text-[11px] bg-rose-100/90 px-2.5 py-1 rounded-lg border border-rose-200 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Late fee accumulating: ${loan.lateFee.toFixed(2)}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between pt-2 border-t border-slate-200/60">
                        <span className="text-[11px] text-slate-500 font-bold">Renewals used: {loan.renewalCount}/2</span>
                        <button
                          onClick={() => onRenewLoan(loan)}
                          disabled={isOverdue || loan.renewalCount >= 2}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                            isOverdue || loan.renewalCount >= 2
                              ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                          }`}
                          id={`renew-btn-${loan.id}`}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {loan.renewalCount >= 2 ? 'Max Renewed' : 'Extend Loan (+14 Days)'}
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
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
              <Bookmark className="w-4 h-4" />
            </span>
            Online Reserved Books Queue ({userReservations.length})
          </h3>

          <div className="space-y-2">
            {userReservations.map(res => (
              <div
                key={res.id}
                className="p-4 bg-purple-50/80 border border-purple-200/80 rounded-2xl flex items-center justify-between text-xs text-purple-950 shadow-2xs"
              >
                <div>
                  <span className="font-bold text-sm text-slate-900">{res.bookTitle}</span>
                  <p className="text-[11px] text-purple-800 font-medium mt-0.5">Reservation submitted on: {res.requestDate}</p>
                </div>
                <span className="bg-purple-600 text-white font-extrabold text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-2xs">
                  {res.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* RETURNED BORROWING HISTORY SECTION */}
      {(filter === 'all' || filter === 'history') && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-4">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </span>
            Previously Returned Borrowing History ({returnedLoans.length})
          </h3>

          {returnedLoans.length === 0 ? (
            <div className="p-6 text-center bg-slate-50/80 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium">
              No previous borrowing history recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200/80 rounded-2xl bg-white shadow-2xs">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Book Title</th>
                    <th className="p-3.5">Borrowed On</th>
                    <th className="p-3.5">Returned On</th>
                    <th className="p-3.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {returnedLoans.map(loan => (
                    <tr key={loan.id} className="hover:bg-slate-50 transition">
                      <td className="p-3.5 font-bold text-slate-900">{loan.bookTitle}</td>
                      <td className="p-3.5 font-mono text-slate-600 font-semibold">{loan.issueDate}</td>
                      <td className="p-3.5 font-mono text-emerald-700 font-semibold">{loan.returnDate || 'Returned'}</td>
                      <td className="p-3.5">
                        <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                          Returned & Inspected
                        </span>
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
