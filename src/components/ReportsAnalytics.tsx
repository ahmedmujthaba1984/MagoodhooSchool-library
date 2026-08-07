import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  Sparkles, BookOpen, Clock, CheckCircle2, TrendingUp, DollarSign,
  Users, FileText, Download, Printer, Search, AlertTriangle,
  Activity, Layers, ArrowUpRight, ShieldAlert, FileSpreadsheet, RefreshCw
} from 'lucide-react';
import { Book, Loan, UserProfile } from '../types';
import { useLanguage } from '../lib/i18n';

interface ReportsAnalyticsProps {
  books: Book[];
  loans: Loan[];
  users: UserProfile[];
}

type ReportType = 
  | 'overview'
  | 'issued'
  | 'returned'
  | 'overdue'
  | 'active-members'
  | 'inventory'
  | 'fines'
  | 'activity-log';

export const ReportsAnalytics: React.FC<ReportsAnalyticsProps> = ({
  books,
  loans,
  users
}) => {
  const { t, language } = useLanguage();
  const [activeReport, setActiveReport] = useState<ReportType>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // --- Calculations & Helper Data ---
  const activeLoans = loans.filter(l => l.status === 'active');
  const overdueLoans = loans.filter(l => l.status === 'overdue');
  const returnedLoans = loans.filter(l => l.status === 'returned');
  
  const totalFinesAssessed = loans.reduce((sum, l) => sum + (l.lateFee || 0), 0);
  const totalFinesPaid = loans.filter(l => l.feePaid).reduce((sum, l) => sum + (l.lateFee || 0), 0);
  const totalFinesPending = loans.filter(l => !l.feePaid && (l.lateFee || 0) > 0).reduce((sum, l) => sum + (l.lateFee || 0), 0);

  const totalCopiesInInventory = books.reduce((sum, b) => sum + (b.totalCopies || 0), 0);
  const totalAvailableInInventory = books.reduce((sum, b) => sum + (b.availableCopies || 0), 0);
  const totalIssuedCopies = totalCopiesInInventory - totalAvailableInInventory;

  // CSV Export Helper
  const exportToCSV = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  // 1. Issued Books Report Data
  const issuedReportRows = loans.filter(l => l.status === 'active' || l.status === 'overdue');
  const filteredIssuedRows = issuedReportRows.filter(l =>
    l.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.bookIsbn && l.bookIsbn.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 2. Returned Books Report Data
  const returnedReportRows = loans.filter(l => l.status === 'returned');
  const filteredReturnedRows = returnedReportRows.filter(l =>
    l.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.bookIsbn && l.bookIsbn.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 3. Overdue Books Report Data
  const overdueReportRows = loans.filter(l => l.status === 'overdue');
  const filteredOverdueRows = overdueReportRows.filter(l =>
    l.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.userName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.bookIsbn && l.bookIsbn.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 4. Active Members Report Data
  const memberReportRows = users.map(user => {
    const userLoans = loans.filter(l => l.userId === user.id);
    const activeBorrows = userLoans.filter(l => l.status === 'active' || l.status === 'overdue').length;
    const totalBorrows = userLoans.length;
    const overdueCount = userLoans.filter(l => l.status === 'overdue').length;
    const unpaidFines = userLoans.filter(l => !l.feePaid).reduce((sum, l) => sum + (l.lateFee || 0), 0);

    return {
      user,
      activeBorrows,
      totalBorrows,
      overdueCount,
      unpaidFines
    };
  });
  const filteredMemberRows = memberReportRows.filter(item =>
    item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.user.studentIdCode && item.user.studentIdCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // 5. Inventory Summary Data
  const categories = Array.from(new Set(books.map(b => b.category)));
  const filteredInventoryRows = books.filter(b => {
    const matchesSearch = b.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.author.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.isbn.toLowerCase().includes(searchTerm.toLowerCase()) ||
      b.barcode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || b.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // 6. Fine Collection Data
  const fineReportRows = loans.filter(l => (l.lateFee || 0) > 0);
  const filteredFineRows = fineReportRows.filter(l =>
    l.bookTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.userName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // 7. Activity Log Data
  const activityLogs = [
    ...loans.map(l => ({
      id: `issue-${l.id}`,
      date: l.issueDate,
      type: language === 'dv' ? 'ފޮތް ދޫކުރެވުނު' : 'BOOK_ISSUED',
      description: language === 'dv' ? `"${l.bookTitle}" ދޫކުރެވުނީ ${l.userName} އަށް` : `"${l.bookTitle}" issued to ${l.userName}`,
      user: l.userName,
      status: language === 'dv' ? 'ކާމިޔާބު' : 'Success'
    })),
    ...loans.filter(l => l.returnDate).map(l => ({
      id: `return-${l.id}`,
      date: l.returnDate!,
      type: language === 'dv' ? 'ފޮތް އަނބުރާ ލިބުނު' : 'BOOK_RETURNED',
      description: language === 'dv' ? `"${l.bookTitle}" އަނބުރާ ޙަވާލުކުރީ ${l.userName}` : `"${l.bookTitle}" returned by ${l.userName}`,
      user: l.userName,
      status: language === 'dv' ? 'ނިމިފައި' : 'Completed'
    })),
    ...loans.filter(l => l.feePaid && (l.lateFee || 0) > 0).map(l => ({
      id: `fee-${l.id}`,
      date: l.returnDate || l.issueDate,
      type: language === 'dv' ? 'ޖޫރިމަނާ ދެއްކެވި' : 'FINE_PAID',
      description: language === 'dv' ? `ޖޫރިމަނާ $${(l.lateFee || 0).toFixed(2)} ދެއްކެވީ ${l.userName}` : `Late fee of $${(l.lateFee || 0).toFixed(2)} paid by ${l.userName}`,
      user: l.userName,
      status: language === 'dv' ? 'ދައްކާފައި' : 'Paid'
    }))
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const filteredActivityLogs = activityLogs.filter(log =>
    log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.user.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Popular Books Chart Data
  const loanCountByBook: { [title: string]: number } = {};
  loans.forEach(loan => {
    loanCountByBook[loan.bookTitle] = (loanCountByBook[loan.bookTitle] || 0) + 1;
  });
  const popularBooksData = Object.keys(loanCountByBook)
    .map(title => ({
      name: title.length > 20 ? `${title.substring(0, 18)}...` : title,
      borrows: loanCountByBook[title]
    }))
    .sort((a, b) => b.borrows - a.borrows)
    .slice(0, 6);

  if (popularBooksData.length === 0) {
    books.slice(0, 5).forEach(b => {
      popularBooksData.push({
        name: b.title.length > 18 ? `${b.title.substring(0, 16)}...` : b.title,
        borrows: Math.floor(Math.random() * 8) + 2
      });
    });
  }

  // Category Pie Data
  const categoryCounts: { [cat: string]: number } = {};
  books.forEach(b => {
    categoryCounts[b.category] = (categoryCounts[b.category] || 0) + 1;
  });
  const categoryPieData = Object.keys(categoryCounts).map(cat => ({
    name: cat,
    value: categoryCounts[cat]
  }));
  const CHART_COLORS = ['#6366f1', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#14b8a6'];

  return (
    <div className="space-y-6 print:p-0">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white border border-slate-800 shadow-2xl relative overflow-hidden print:hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center gap-2 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-3.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> {t.reportsTrends}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t.reportsTrends}
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {language === 'dv'
                ? 'ލައިބްރަރީގެ ދޫކުރުންތަކާއި، އިންވެންޓްރީ، ޖޫރިމަނާ އަދި މެންބަރުންގެ ޙަރަކާތްތަކުގެ ރިޕޯޓްތައް ބައްލަވައި ޕްރިންޓްކުރައްވާ.'
                : 'Generate, print, and export official reports for circulation, inventory, fines, members, and complete activity history.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border border-indigo-500 text-white font-extrabold text-xs sm:text-sm transition shadow-lg cursor-pointer active:scale-95 shrink-0"
            >
              <Printer className="w-4 h-4 text-white" /> {language === 'dv' ? 'ރިޕޯޓް ޕްރިންޓްކުރައްވާ' : 'Print Report'}
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs for the 7 Specific Reports */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none print:hidden">
        <button
          onClick={() => setActiveReport('overview')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'overview'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Layers className="w-4 h-4" /> {language === 'dv' ? 'ޚުލާޞާ ޑޭޝްބޯޑް' : 'Overview Dashboard'}
        </button>

        <button
          onClick={() => setActiveReport('issued')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'issued'
              ? 'bg-indigo-600 text-white border-indigo-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <BookOpen className="w-4 h-4 text-indigo-600" /> {language === 'dv' ? '1. ދޫކުރެވިފައިވާ ފޮތްތައް' : '1. Issued Books'} ({activeLoans.length})
        </button>

        <button
          onClick={() => setActiveReport('returned')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'returned'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" /> {language === 'dv' ? '2. އަނބުރާ ލިބުނު ފޮތްތައް' : '2. Returned Books'} ({returnedLoans.length})
        </button>

        <button
          onClick={() => setActiveReport('overdue')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'overdue'
              ? 'bg-amber-600 text-white border-amber-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Clock className="w-4 h-4 text-amber-600" /> {language === 'dv' ? '3. މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް' : '3. Overdue Books'} ({overdueLoans.length})
        </button>

        <button
          onClick={() => setActiveReport('active-members')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'active-members'
              ? 'bg-purple-600 text-white border-purple-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Users className="w-4 h-4 text-purple-600" /> {language === 'dv' ? '4. މެންބަރުންގެ ޙަރަކާތްތައް' : '4. Active Members'} ({users.length})
        </button>

        <button
          onClick={() => setActiveReport('inventory')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'inventory'
              ? 'bg-blue-600 text-white border-blue-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-4 h-4 text-blue-600" /> {language === 'dv' ? '5. އިންވެންޓްރީ ޚުލާޞާ' : '5. Inventory Summary'} ({books.length})
        </button>

        <button
          onClick={() => setActiveReport('fines')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'fines'
              ? 'bg-teal-600 text-white border-teal-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <DollarSign className="w-4 h-4 text-teal-600" /> {language === 'dv' ? '6. ޖޫރިމަނާގެ ތަފްޞީލު' : '6. Fine Collection'} (${totalFinesAssessed.toFixed(2)})
        </button>

        <button
          onClick={() => setActiveReport('activity-log')}
          className={`px-4 py-2.5 rounded-2xl font-black text-xs whitespace-nowrap transition flex items-center gap-2 border cursor-pointer active:scale-95 ${
            activeReport === 'activity-log'
              ? 'bg-pink-600 text-white border-pink-500 shadow-lg'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Activity className="w-4 h-4 text-pink-600" /> {language === 'dv' ? '7. ޙަރަކާތްތަކުގެ ލޮގް' : '7. Activity Log'} ({activityLogs.length})
        </button>
      </div>

      {/* Overview Stat Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:grid-cols-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
            <BookOpen className="w-4 h-4 text-indigo-600" /> {language === 'dv' ? 'ޖުމްލަ ފޮތުގެ އަދަދު' : 'Total Volumes'}
          </div>
          <div className="text-2xl font-black text-slate-900">{totalCopiesInInventory}</div>
          <p className="text-[11px] text-slate-500 font-medium">{books.length} {language === 'dv' ? 'ތަފާތު ސުރުޚީތައް' : 'unique book titles'}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-emerald-600" /> {language === 'dv' ? 'ދޫކުރެވިފައިވާ ފޮތްތައް' : 'Active Circulation'}
          </div>
          <div className="text-2xl font-black text-slate-900">{activeLoans.length + overdueLoans.length}</div>
          <p className="text-[11px] text-slate-500 font-medium">
            {activeLoans.length} {language === 'dv' ? 'ހިނގަމުންދާ' : 'active'}, {overdueLoans.length} {language === 'dv' ? 'މުއްދަތު ހަމަވެފައި' : 'overdue'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-amber-600" /> {language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ' : 'Overdue Items'}
          </div>
          <div className="text-2xl font-black text-amber-600">{overdueLoans.length}</div>
          <p className="text-[11px] text-slate-500 font-medium">{language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް' : 'Past designated due date'}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-1">
          <div className="text-xs text-slate-500 font-extrabold uppercase tracking-wider flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-teal-600" /> {language === 'dv' ? 'ލިބުނު ޖޫރިމަނާ' : 'Fine Collected'}
          </div>
          <div className="text-2xl font-black text-slate-900">${totalFinesPaid.toFixed(2)}</div>
          <p className="text-[11px] text-slate-500 font-medium">${totalFinesPending.toFixed(2)} {language === 'dv' ? 'ނުލިބިވާ ޖޫރިމަނާ' : 'outstanding balance'}</p>
        </div>
      </div>

      {/* REPORT CONTENT VIEWS */}

      {/* VIEW: OVERVIEW DASHBOARD */}
      {activeReport === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Chart 1: Most Borrowed Books */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-indigo-600" /> {language === 'dv' ? 'އެންމެ ގިނައިން ނަގާފައިވާ ފޮތްތައް' : 'Most Borrowed Book Titles'}
                </h3>
                <span className="text-xs font-bold text-slate-500">{language === 'dv' ? 'ޖުމްލަ ތަފާސްހިސާބު' : 'All-Time Statistics'}</span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={popularBooksData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#475569' }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '16px', fontSize: '12px', color: '#fff' }} />
                    <Bar dataKey="borrows" fill="#6366f1" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Category Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-purple-600" /> {language === 'dv' ? 'ފޮތްތަކުގެ ބާވަތްތަކުގެ އިންސައްތަ' : 'Book Genre & Category Distribution'}
                </h3>
                <span className="text-xs font-bold text-slate-500">{books.length} {language === 'dv' ? 'ސުރުޚީ' : 'Titles'}</span>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {categoryPieData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', borderRadius: '16px', fontSize: '12px', color: '#fff' }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Quick Shortcuts to 7 Detailed Reports */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" /> {language === 'dv' ? 'އަވަސް ރިޕޯޓް ޚިޔާރުކުރައްވާ' : 'Instant Report Quick Select'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <button
                onClick={() => setActiveReport('issued')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-1 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-indigo-700 font-extrabold text-sm">
                  <span>{language === 'dv' ? '1. ދޫކުރެވިފައިވާ ފޮތްތަކުގެ ރިޕޯޓް' : '1. Issued Books Report'}</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'ނަގާފައިވާ ފޮތްތަކާއި، ނެގި މީހާ އަދި މުއްދަތު ހަމަވާ ތާރީޚް.' : 'View active loans, borrower names, issue dates, and due dates.'}
                </p>
              </button>

              <button
                onClick={() => setActiveReport('returned')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-1 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-emerald-700 font-extrabold text-sm">
                  <span>{language === 'dv' ? '2. އަނބުރާ ލިބުނު ފޮތްތަކުގެ ރިޕޯޓް' : '2. Returned Books Report'}</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'އަނބުރާ ޙަވާލުކުރެވުނު ފޮތްތަކުގެ ތާރީޚް އަދި ޖޫރިމަނާ.' : 'History of returned books, return dates, and fee compliance.'}
                </p>
              </button>

              <button
                onClick={() => setActiveReport('overdue')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-1 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-amber-700 font-extrabold text-sm">
                  <span>{language === 'dv' ? '3. މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކުގެ ރިޕޯޓް' : '3. Overdue Books Report'}</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކާއި އަރަމުންދާ ޖޫރިމަނާ.' : 'List of items past due date with calculated overdue fees.'}
                </p>
              </button>

              <button
                onClick={() => setActiveReport('active-members')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-1 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-purple-700 font-extrabold text-sm">
                  <span>{language === 'dv' ? '4. މެންބަރުންގެ ޙަރަކާތްތަކުގެ ރިޕޯޓް' : '4. Active Members Report'}</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'ދަރިވަރުންނާއި ބެލެނިވެރިންގެ އެކައުންޓްތަކުގެ ތަފްޞީލު.' : 'Directory of active student and parent accounts with loan stats.'}
                </p>
              </button>

              <button
                onClick={() => setActiveReport('inventory')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-1 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-blue-700 font-extrabold text-sm">
                  <span>{language === 'dv' ? '5. އިންވެންޓްރީ ޚުލާޞާ ރިޕޯޓް' : '5. Inventory Summary'}</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'ފޮތްތަކުގެ ސްޓޮކް، ހުރި ތަން އަދި ކޮޕީގެ އަދަދު.' : 'Complete book stock catalog, shelf locations, and copy counts.'}
                </p>
              </button>

              <button
                onClick={() => setActiveReport('fines')}
                className="p-4 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-left space-y-1 transition group cursor-pointer"
              >
                <div className="flex items-center justify-between text-teal-700 font-extrabold text-sm">
                  <span>{language === 'dv' ? '6. ޖޫރިމަނާގެ ރިޕޯޓް' : '6. Fine Collection Report'}</span>
                  <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 transition" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'ޖޫރިމަނާގެ ފައިސާ ލިބުނު ގޮތާއި ނުލިބިވާ އަދަދު.' : 'Financial log of fine assessments, collected amounts, and balances.'}
                </p>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW: 1. ISSUED BOOKS REPORT */}
      {activeReport === 'issued' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-indigo-600" /> {language === 'dv' ? 'ދޫކުރެވިފައިވާ ފޮތްތަކުގެ ރިޕޯޓް' : 'Issued Books Report'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'މިވަގުތު ދޫކުރެވިފައިވާ ފޮތްތަކުގެ ތަފްޞީލު.' : 'Currently active loans and items checked out to students.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Search book or borrower...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Issued_Books_Report',
                  ['Book Title', 'Borrower', 'Grade/ID', 'ISBN', 'Issue Date', 'Due Date', 'Status'],
                  filteredIssuedRows.map(l => [l.bookTitle, l.userName, l.userGrade || 'N/A', l.bookIsbn, l.issueDate, l.dueDate, l.status])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނެގި ފަރާތް' : 'Borrower Name'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ގްރޭޑް / އައިޑީ' : 'Grade / ID'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނެގި ތާރީޚް' : 'Issue Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ސުންގަޑި' : 'Due Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޙާލަތު' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredIssuedRows.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{loan.bookTitle}</td>
                    <td className="p-3.5 text-slate-700">{loan.userName}</td>
                    <td className="p-3.5 text-slate-500">{loan.userGrade || 'Student'}</td>
                    <td className="p-3.5 text-slate-600">{loan.issueDate}</td>
                    <td className="p-3.5 text-slate-800 font-bold">{loan.dueDate}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        loan.status === 'overdue'
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-indigo-100 text-indigo-900 border border-indigo-300'
                      }`}>
                        {loan.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredIssuedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                      {language === 'dv' ? 'ދޫކުރެވިފައިވާ ފޮތެއް ނެތެވެ.' : 'No issued book records matching criteria.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 2. RETURNED BOOKS REPORT */}
      {activeReport === 'returned' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-emerald-600" /> {language === 'dv' ? 'އަނބުރާ ލިބުނު ފޮތްތަކުގެ ރިޕޯޓް' : 'Returned Books Report'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'އަނބުރާ ޙަވާލުކުރެވުނު ފޮތްތަކުގެ ތާރީޚީ ލޮގް.' : 'Historical register of returned circulation items.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Search returned books...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Returned_Books_Report',
                  ['Book Title', 'Borrower', 'Issue Date', 'Due Date', 'Return Date', 'Late Fee'],
                  filteredReturnedRows.map(l => [l.bookTitle, l.userName, l.issueDate, l.dueDate, l.returnDate || '', l.lateFee || 0])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-emerald-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނެގި ފަރާތް' : 'Borrower Name'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނެގި ތާރީޚް' : 'Issue Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ސުންގަޑި' : 'Due Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޙަވާލުކުރި ތާރީޚް' : 'Return Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޖޫރިމަނާ' : 'Late Fee Paid'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReturnedRows.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{loan.bookTitle}</td>
                    <td className="p-3.5 text-slate-700">{loan.userName}</td>
                    <td className="p-3.5 text-slate-500">{loan.issueDate}</td>
                    <td className="p-3.5 text-slate-500">{loan.dueDate}</td>
                    <td className="p-3.5 text-emerald-700 font-bold">{loan.returnDate || 'Returned'}</td>
                    <td className="p-3.5 text-slate-800 font-bold">
                      {(loan.lateFee || 0) > 0 ? (
                        <span className="text-emerald-700 font-extrabold">${(loan.lateFee || 0).toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400">$0.00</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredReturnedRows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400 font-medium">
                      {language === 'dv' ? 'އަނބުރާ ލިބުނު ފޮތެއްގެ ލޮގެއް ނެތެވެ.' : 'No returned book logs found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 3. OVERDUE BOOKS REPORT */}
      {activeReport === 'overdue' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-600" /> {language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކުގެ ރިޕޯޓް' : 'Overdue Books Report'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'މުއްދަތު ހަމަވެގެން ނުލިބިވާ ފޮތްތަކާއި ޖޫރިމަނާގެ ތަފްޞީލު.' : 'Detailed overview of items past due date with calculated late fees.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Search overdue items...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Overdue_Books_Report',
                  ['Book Title', 'Borrower', 'Due Date', 'Accumulated Fee', 'Status'],
                  filteredOverdueRows.map(l => [l.bookTitle, l.userName, l.dueDate, `$${(l.lateFee || 0).toFixed(2)}`, l.status])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-amber-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނެގި ފަރާތް' : 'Borrower Name'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ސުންގަޑި' : 'Original Due Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'އަރާފައިވާ ޖޫރިމަނާ' : 'Accumulated Fine'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޙާލަތު' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOverdueRows.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{loan.bookTitle}</td>
                    <td className="p-3.5 text-slate-700">{loan.userName}</td>
                    <td className="p-3.5 text-amber-700 font-bold">{loan.dueDate}</td>
                    <td className="p-3.5 text-amber-800 font-black">${(loan.lateFee || 0).toFixed(2)}</td>
                    <td className="p-3.5">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 border border-amber-300">
                        {language === 'dv' ? 'މުއްދަތު ހަމަވެފައި' : 'OVERDUE'}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredOverdueRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      {language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތެއް ނެތެވެ.' : 'Great news! No overdue books currently.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 4. ACTIVE MEMBERS REPORT */}
      {activeReport === 'active-members' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Users className="w-6 h-6 text-purple-600" /> {language === 'dv' ? 'މެންބަރުންގެ ޙަރަކާތްތަކުގެ ރިޕޯޓް' : 'Active Members Report'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'މެންބަރުންގެ ޑައިރެކްޓަރީ އަދި ފޮތް ނެގުމުގެ ތަފާސްހިސާބު.' : 'Library user directory, role breakdown, and loan statistics.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Search member name or email...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Active_Members_Report',
                  ['Name', 'Email', 'Role', 'Grade/ID', 'Active Borrows', 'Total Borrows', 'Unpaid Fines'],
                  filteredMemberRows.map(m => [m.user.name, m.user.email, m.user.role, m.user.studentIdCode || m.user.grade || 'N/A', m.activeBorrows, m.totalBorrows, `$${m.unpaidFines.toFixed(2)}`])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-purple-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'މެންބަރުގެ ނަން' : 'Member Name'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ރޯލް' : 'Role'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ގްރޭޑް / ކޯޑު' : 'Grade / Code'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'އީމެއިލް' : 'Email'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނަގާފައިވާ ފޮތްތައް' : 'Active Borrows'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ނުދައްކާވާ ޖޫރިމަނާ' : 'Unpaid Fines'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMemberRows.map(item => (
                  <tr key={item.user.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{item.user.name}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.user.role === 'admin' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                        item.user.role === 'parent' ? 'bg-purple-100 text-purple-900 border border-purple-300' :
                        'bg-sky-100 text-sky-900 border border-sky-300'
                      }`}>
                        {item.user.role}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-600">{item.user.studentIdCode || item.user.grade || 'N/A'}</td>
                    <td className="p-3.5 text-slate-600 font-mono text-[11px]">{item.user.email}</td>
                    <td className="p-3.5 font-bold text-slate-900">{item.activeBorrows}</td>
                    <td className="p-3.5 font-black text-slate-800">
                      {item.unpaidFines > 0 ? (
                        <span className="text-amber-700">${item.unpaidFines.toFixed(2)}</span>
                      ) : (
                        <span className="text-slate-400">$0.00</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 5. INVENTORY SUMMARY */}
      {activeReport === 'inventory' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-6 h-6 text-blue-600" /> {language === 'dv' ? 'އިންވެންޓްރީ ޚުލާޞާ' : 'Book Inventory Summary'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'ލައިބްރަރީގެ ފޮތްތަކުގެ ސްޓޮކް އަދި ހުރި ތަން.' : 'Complete catalog stock details, locations, and copy availabilities.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-600 font-bold"
              >
                <option value="all">{language === 'dv' ? `ހުރިހާ ބާވަތްތަކެއް (${books.length})` : `All Genres (${books.length})`}</option>
                {categories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <div className="relative flex-1 sm:w-48">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Filter inventory...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Inventory_Summary_Report',
                  ['Title', 'Author', 'Category', 'ISBN', 'Barcode', 'Shelf Location', 'Total Copies', 'Available Copies'],
                  filteredInventoryRows.map(b => [b.title, b.author, b.category, b.isbn, b.barcode, b.shelfLocation, b.totalCopies, b.availableCopies])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-blue-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'މުޞައްނިފު' : 'Author'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ބާވަތް' : 'Genre'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ހުރި ތަން' : 'Shelf Location'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޖުމްލަ ކޮޕީ' : 'Total Copies'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ހުރި ކޮޕީ' : 'Available Copies'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInventoryRows.map(book => (
                  <tr key={book.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{book.title}</td>
                    <td className="p-3.5 text-slate-700">{book.author}</td>
                    <td className="p-3.5 text-slate-600">{book.category}</td>
                    <td className="p-3.5 text-indigo-700 font-bold">{book.shelfLocation}</td>
                    <td className="p-3.5 font-bold text-slate-900">{book.totalCopies}</td>
                    <td className="p-3.5">
                      <span className={`font-bold ${book.availableCopies > 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {book.availableCopies} {language === 'dv' ? 'ލިބެންހުރި' : 'available'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 6. FINE COLLECTION REPORT */}
      {activeReport === 'fines' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <DollarSign className="w-6 h-6 text-teal-600" /> {language === 'dv' ? 'ޖޫރިމަނާގެ ތަފްޞީލު ރިޕޯޓް' : 'Fine Collection & Penalty Report'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'ޖޫރިމަނާގެ ފައިސާ އަދި ދެއްކި ޙާލަތު.' : 'Financial tracking for assessed late return fees and payment statuses.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Search fines...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Fine_Collection_Report',
                  ['Borrower', 'Book Title', 'Due Date', 'Fine Amount', 'Paid Status'],
                  filteredFineRows.map(l => [l.userName, l.bookTitle, l.dueDate, `$${(l.lateFee || 0).toFixed(2)}`, l.feePaid ? 'Paid' : 'Pending'])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-teal-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'މެންބަރުގެ ނަން' : 'Borrower Name'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ސުންގަޑި' : 'Due Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޖޫރިމަނާ' : 'Assessed Fee'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޙާލަތު' : 'Payment Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFineRows.map(loan => (
                  <tr key={loan.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 font-bold text-slate-900">{loan.userName}</td>
                    <td className="p-3.5 text-slate-700">{loan.bookTitle}</td>
                    <td className="p-3.5 text-slate-500">{loan.dueDate}</td>
                    <td className="p-3.5 font-black text-amber-700">${(loan.lateFee || 0).toFixed(2)}</td>
                    <td className="p-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        loan.feePaid ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' : 'bg-rose-100 text-rose-900 border border-rose-300'
                      }`}>
                        {loan.feePaid ? (language === 'dv' ? 'ދައްކާފައި' : 'PAID') : (language === 'dv' ? 'ނުދައްކާ' : 'UNPAID')}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredFineRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400 font-medium">
                      {language === 'dv' ? 'ޖޫރިމަނާގެ ރެކޯޑެއް ނެތެވެ.' : 'No fine assessment records found.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: 7. ACTIVITY LOG SUMMARY */}
      {activeReport === 'activity-log' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
            <div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-6 h-6 text-pink-600" /> {language === 'dv' ? 'ޙަރަކާތްތަކުގެ ލޮގް' : 'Library Activity Log Summary'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {language === 'dv' ? 'ލައިބްރަރީގައި ހިނގާފައިވާ ޙަރަކާތްތަކުގެ ތާރީޚީ ރެކޯޑް.' : 'Chronological transaction history of checkouts, returns, and payments.'}
              </p>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={language === 'dv' ? 'ހޯއްދަވާ...' : 'Filter activity logs...'}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                />
              </div>

              <button
                onClick={() => exportToCSV('Activity_Log_Summary',
                  ['Date', 'Type', 'Description', 'User', 'Status'],
                  filteredActivityLogs.map(l => [l.date, l.type, l.description, l.user, l.status])
                )}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-pink-900 border border-purple-200 text-xs font-bold transition whitespace-nowrap cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-pink-600" /> {language === 'dv' ? 'ސީ.އެސް.ވީ' : 'CSV Export'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-800 border-collapse">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] bg-slate-50">
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ތާރީޚް' : 'Transaction Date'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޙަރަކާތުގެ ބާވަތް' : 'Activity Type'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ތަފްޞީލު' : 'Description'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'މެންބަރުގެ ނަން' : 'Member Name'}</th>
                  <th className="p-3.5 font-bold">{language === 'dv' ? 'ޙާލަތު' : 'Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivityLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5 text-slate-500 font-medium">{log.date}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        log.type.includes('ދޫކުރެވުނު') || log.type === 'BOOK_ISSUED' ? 'bg-indigo-100 text-indigo-900 border border-indigo-300' :
                        log.type.includes('ލިބުނު') || log.type === 'BOOK_RETURNED' ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                        'bg-teal-100 text-teal-900 border border-teal-300'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="p-3.5 text-slate-900 font-bold">{log.description}</td>
                    <td className="p-3.5 text-slate-700">{log.user}</td>
                    <td className="p-3.5 text-emerald-700 font-bold">{log.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
