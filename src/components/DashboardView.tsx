import React from 'react';
import { Book, UserProfile, Loan, Reservation } from '../types';
import { BookOpen, Users, CheckCircle2, Clock, AlertTriangle, TrendingUp, Plus, ArrowRight, ShieldCheck, Bookmark, ArrowUpRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../lib/i18n';

interface DashboardViewProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  currentUser: UserProfile;
  onNavigateTab: (tab: string) => void;
  onOpenAddBookModal: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  books,
  users,
  loans,
  reservations,
  currentUser,
  onNavigateTab,
  onOpenAddBookModal
}) => {
  const { t, language } = useLanguage();
  const totalBooks = books.reduce((acc, b) => acc + b.totalCopies, 0);
  const availableBooks = books.reduce((acc, b) => acc + b.availableCopies, 0);
  const activeLoans = loans.filter(l => l.status === 'active');
  const overdueLoans = loans.filter(l => l.status === 'overdue');
  const pendingReservations = reservations.filter(r => r.status === 'pending');

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="inline-flex items-center gap-2 bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider mb-2">
            <ShieldCheck className="w-3.5 h-3.5 text-blue-600" /> {language === 'dv' ? 'ލައިބްރަރީ މެނޭޖްމަންޓް ޚުލާޞާ' : 'Library Management Overview'}
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            {language === 'dv' ? `މަރުޙަބާ، ${currentUser.name}!` : `Welcome back, ${currentUser.name}!`}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
            {language === 'dv' ? 'މަގޫދޫ ސުކޫލް ލައިބްރަރީ މެނޭޖްމަންޓް ސިސްޓަމް. ލައިވް ޑޭޓާބޭސް ސިންކް އެކްޓިވް.' : 'System overview for Magoodhoo School Library Management System. Real-time database sync active.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onNavigateTab('ai-assistant')}
            className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 ring-2 ring-purple-300 cursor-pointer"
            id="dash-open-ai-librarian-btn"
          >
            <Sparkles className="w-4 h-4 text-purple-200 animate-pulse" /> {t.aiLibrarian}
          </button>
          <button
            onClick={onOpenAddBookModal}
            className="bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" /> {t.addBook}
          </button>
          <button
            onClick={() => onNavigateTab('catalog')}
            className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-300 transition flex items-center gap-2 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-blue-600" /> {t.catalog}
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        
        {/* Total Books */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'dv' ? 'ޖުމްލަ ފޮތް' : 'Total Books'}</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
              <BookOpen className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{totalBooks}</span>
            <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5">
              <TrendingUp className="w-3.5 h-3.5" /> {books.length} {language === 'dv' ? 'ނަން' : 'Titles'}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex justify-between">
            <span>{language === 'dv' ? 'ލިބެންހުރީ:' : 'Available:'} {availableBooks}</span>
            <span>{language === 'dv' ? 'ދޫކުރެވިފައި:' : 'Checked Out:'} {totalBooks - availableBooks}</span>
          </div>
        </div>

        {/* Registered Members */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'dv' ? 'ޖުމްލަ މެންބަރުން' : 'Total Members'}</span>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{users.length}</span>
            <span className="text-xs font-bold text-purple-600">{language === 'dv' ? 'ދަރިވަރުންނާއި މުވައްޒަފުން' : 'Students & Staff'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex justify-between">
            <span>{language === 'dv' ? 'ދަރިވަރުން:' : 'Students:'} {users.filter(u => u.role === 'student').length}</span>
            <span>{language === 'dv' ? 'ބެލެނިވެރިން:' : 'Parents:'} {users.filter(u => u.role === 'parent').length}</span>
          </div>
        </div>

        {/* Issued Books */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'dv' ? 'ދޫކުރެވިފައިވާ ފޮތް' : 'Issued Books'}</span>
            <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-slate-900">{activeLoans.length}</span>
            <span className="text-xs font-bold text-amber-600">{language === 'dv' ? 'އެކްޓިވް ނެގުންތައް' : 'Active Borrowings'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex justify-between">
            <span>{language === 'dv' ? 'ޕެންޑިންގް ރިޒަވޭޝަން:' : 'Pending Reserves:'} {pendingReservations.length}</span>
            <button onClick={() => onNavigateTab('issued-books')} className="text-blue-600 hover:underline cursor-pointer">{language === 'dv' ? 'ހުރިހާ އެއްޗެއް &rarr;' : 'View All &rarr;'}</button>
          </div>
        </div>

        {/* Late Returns */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{language === 'dv' ? 'މުއްދަތު ހަމަވެފައި' : 'Late Returns'}</span>
            <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-3xl font-black text-rose-600">{overdueLoans.length}</span>
            <span className="text-xs font-bold text-rose-600">{language === 'dv' ? 'ޖޫރިމަނާ ކުރެވިފައި' : 'Overdue Fines'}</span>
          </div>
          <div className="text-[11px] text-slate-500 font-medium pt-2 border-t border-slate-100 flex justify-between">
            <span>{language === 'dv' ? 'ފިޔަވަޅު އަޅަންޖެހޭ' : 'Action required'}</span>
            <button onClick={() => onNavigateTab('late-returns')} className="text-rose-600 hover:underline font-bold cursor-pointer">{language === 'dv' ? 'ބައްލަވާ &rarr;' : 'Review Overdues &rarr;'}</button>
          </div>
        </div>

      </div>

      {/* Two Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Issued Books Table */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" /> {language === 'dv' ? 'އެންމެ ފަހުން ދޫކުރެވުނު ފޮތްތައް' : 'Recent Book Borrowings'}
              </h3>
              <p className="text-xs text-slate-500">{language === 'dv' ? 'ދަރިވަރުން ފޮތް ނެގުމުގެ އެންމެ ފަހުގެ ރެކޯޑްތައް' : 'Latest circulation records from student checkouts'}</p>
            </div>
            <button
              onClick={() => onNavigateTab('issued-books')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              {language === 'dv' ? 'ހުރިހާ ލިސްޓެއް' : 'View Full List'} <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] border-y border-slate-200">
                <tr>
                  <th className="py-3 px-3">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                  <th className="py-3 px-3">{language === 'dv' ? 'ނެގި ފަރާތް' : 'Borrower'}</th>
                  <th className="py-3 px-3">{language === 'dv' ? 'ދޫކުރި ތާރީޚް' : 'Issue Date'}</th>
                  <th className="py-3 px-3">{language === 'dv' ? 'އަނބުރާ ދައްކަންޖެހޭ ތާރީޚް' : 'Due Date'}</th>
                  <th className="py-3 px-3 text-right">{language === 'dv' ? 'ޙާލަތު' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.slice(0, 5).map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3 font-bold text-slate-900">{loan.bookTitle}</td>
                    <td className="py-3 px-3 font-medium text-slate-700">{loan.userName} ({loan.userGrade})</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{loan.issueDate}</td>
                    <td className="py-3 px-3 font-mono text-slate-600">{loan.dueDate}</td>
                    <td className="py-3 px-3 text-right">
                      {loan.status === 'active' && (
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">{language === 'dv' ? 'އެކްޓިވް' : 'Active'}</span>
                      )}
                      {loan.status === 'overdue' && (
                        <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded-full text-[10px]">{language === 'dv' ? 'މުއްދަތު ހަމަވެފައި' : 'Overdue'}</span>
                      )}
                      {loan.status === 'returned' && (
                        <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded-full text-[10px]">{language === 'dv' ? 'އަނބުރާ ޙަވާލުކުރެވިފައި' : 'Returned'}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {loans.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                      {language === 'dv' ? 'އެއްވެސް ރެކޯޑެއް ނެތެވެ.' : 'No circulation records available yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Action Hub */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-4">
          <h3 className="font-extrabold text-slate-900 text-base flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-purple-600" /> {language === 'dv' ? 'އަވަސް އިޚްތިޔާރުތައް' : 'Quick Operations'}
          </h3>
          <p className="text-xs text-slate-500">{language === 'dv' ? 'ލައިބްރަރީގެ މުހިންމު ބައިތަކަށް އަވަހަށް ވާސިލުވުން' : 'Fast access to key library desk modules'}</p>

          <div className="space-y-2.5">
            <button
              onClick={() => onNavigateTab('catalog')}
              className="w-full p-3 bg-slate-50 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-blue-700">{language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް' : 'Browse Book Catalog'}</div>
                  <div className="text-[11px] text-slate-500">{language === 'dv' ? 'ފޮތްތައް ހޯދައި ބެލެހެއްޓުން' : 'Search and manage catalog'}</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600" />
            </button>

            <button
              onClick={() => onNavigateTab('borrow-book')}
              className="w-full p-3 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-emerald-700">{language === 'dv' ? 'ފޮތް ދޫކުރުން (ޑެސްކު)' : 'Borrow Book (Issue)'}</div>
                  <div className="text-[11px] text-slate-500">{language === 'dv' ? 'ދަރިވަރުންނަށް ފޮތް ދޫކުރުން' : 'Process student checkout'}</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600" />
            </button>

            <button
              onClick={() => onNavigateTab('return-book')}
              className="w-full p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 text-amber-700 rounded-lg group-hover:bg-amber-600 group-hover:text-white transition">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-amber-700">{language === 'dv' ? 'ފޮތް އަނބުރާ ޙަވާލުކުރުން' : 'Return Book (Check-in)'}</div>
                  <div className="text-[11px] text-slate-500">{language === 'dv' ? 'އަނބުރާ ގެންނަ ފޮތް ބަލައިގަތުން' : 'Receive returned items'}</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-amber-600" />
            </button>

            <button
              onClick={() => onNavigateTab('students')}
              className="w-full p-3 bg-slate-50 hover:bg-purple-50 border border-slate-200 hover:border-purple-300 rounded-xl text-left transition flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-700 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-xs text-slate-900 group-hover:text-purple-700">{language === 'dv' ? 'ދަރިވަރުންގެ ޑައިރެކްޓަރީ' : 'Student Directory'}</div>
                  <div className="text-[11px] text-slate-500">{language === 'dv' ? 'ދަރިވަރުންގެ މަޢުލޫމާތު ބެލެހެއްޓުން' : 'Manage student profiles'}</div>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-purple-600" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
};
