import React, { useState, useMemo, useEffect } from 'react';
import {
  BookOpen, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  Plus, ArrowUpRight, Sparkles, DollarSign, Layers, RefreshCw, Library, GraduationCap, MessageSquare, ShieldCheck
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, PieChart, Pie, Cell
} from 'recharts';
import { Book, UserProfile, Loan, Reservation, LedgerTransaction } from '../types';
import { useLanguage } from '../lib/i18n';
import {
  hourlyPeakTrafficData,
  peakTrafficHeatmapData,
  gradeReadingEngagementData,
  kpiPeriodTrends
} from '../data/seedData';
import { getPredictiveInsights, PredictiveInsightsResponse } from '../lib/aiService';
import { analyzeCatalogHealth } from '../lib/catalogHealth';
import { ReminderDraftModal, ReminderTarget } from './ReminderDraftModal';
import { AnalyticsDashboardSkeleton } from './Skeletons';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { StatusPill } from './StatusPill';
import { HorizontalBookShelf } from './HorizontalBookShelf';
import { LibraryBookCard } from './LibraryBookCard';

interface DashboardViewProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  ledgerTransactions?: LedgerTransaction[];
  currentUser: UserProfile;
  onNavigateTab: (tab: string) => void;
  onOpenAddBookModal: () => void;
  onOpenCatalogHealth?: () => void;
}

const CHART_COLORS = ['#0F4C45', '#C26D3A', '#1D4ED8', '#16655B', '#6B655D'];

function getMonthsOnShelf(addedAt?: string): number {
  if (!addedAt) return 14;
  const added = new Date(addedAt + 'T00:00:00Z');
  if (Number.isNaN(added.getTime())) return 14;
  const now = new Date();
  const months = (now.getUTCFullYear() - added.getUTCFullYear()) * 12 + (now.getUTCMonth() - added.getUTCMonth());
  return Math.max(0, months);
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  books,
  loans,
  reservations,
  ledgerTransactions = [],
  currentUser,
  onNavigateTab,
  onOpenAddBookModal,
  onOpenCatalogHealth
}) => {
  const { t, language } = useLanguage();
  const [insights, setInsights] = useState<PredictiveInsightsResponse | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);
  const [trafficMode, setTrafficMode] = useState<'heatmap' | 'chart'>('heatmap');
  const [selectedHeatmapCell, setSelectedHeatmapCell] = useState<{
    day: string;
    slot: string;
    label: string;
    checkouts: number;
    returns: number;
    intensity: number;
  } | null>(null);

  const catalogHealth = useMemo(() => analyzeCatalogHealth(books), [books]);
  const totalBooks = useMemo(() => books.reduce((acc, b) => acc + (b.totalCopies || 1), 0), [books]);
  const availableBooks = useMemo(() => books.reduce((acc, b) => acc + (b.availableCopies ?? b.totalCopies ?? 1), 0), [books]);
  const activeLoans = useMemo(() => loans.filter(l => l.status === 'active'), [loans]);
  const overdueLoans = useMemo(() => loans.filter(l => l.status === 'overdue'), [loans]);
  const pendingReservations = useMemo(() => reservations.filter(r => r.status === 'pending'), [reservations]);

  const activeBorrowersCount = useMemo(() => {
    const ids = new Set(loans.filter(l => l.status === 'active' || l.status === 'overdue').map(l => l.userId));
    return ids.size;
  }, [loans]);

  const unpaidFinesMvr = useMemo(() => {
    return loans
      .filter(l => !l.feePaid && (l.lateFee || 0) > 0)
      .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);
  }, [loans]);

  const collectedRevenueMvr = useMemo(() => {
    return ledgerTransactions
      .filter(tx => tx.type === 'payment' || tx.type === 'partial_payment' || tx.type === 'lost_replacement')
      .reduce((sum, tx) => sum + (tx.amountMvr || 0), 0);
  }, [ledgerTransactions]);

  const overdueRatePct = useMemo(() => {
    const currentOut = activeLoans.length + overdueLoans.length;
    if (currentOut === 0) return 0;
    return Math.round((overdueLoans.length / currentOut) * 100);
  }, [activeLoans.length, overdueLoans.length]);

  const languageBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    books.forEach(b => {
      const lang = b.bookLanguage || 'English';
      counts[lang] = (counts[lang] || 0) + (b.totalCopies || 1);
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [books]);

  const dvToEnMetrics = useMemo(() => {
    let dvCopies = 0;
    let enCopies = 0;
    let otherCopies = 0;
    books.forEach(b => {
      const copies = b.totalCopies || 1;
      const lang = (b.bookLanguage || 'English').toLowerCase();
      if (lang.includes('dhivehi')) dvCopies += copies;
      else if (lang.includes('english')) enCopies += copies;
      else otherCopies += copies;
    });
    const ratioToEn = dvCopies > 0 ? (enCopies / dvCopies).toFixed(1) : enCopies.toFixed(1);
    const total = Math.max(1, dvCopies + enCopies + otherCopies);
    return {
      dvCopies,
      enCopies,
      otherCopies,
      dvPct: Math.round((dvCopies / total) * 100),
      enPct: Math.round((enCopies / total) * 100),
      ratioLabel: dvCopies > 0 ? `1 : ${ratioToEn}` : `0 : ${enCopies}`,
    };
  }, [books]);

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    books.forEach(b => {
      const cat = b.category || 'General';
      counts[cat] = (counts[cat] || 0) + (b.totalCopies || 1);
    });
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, copies]) => ({ category, copies }));
  }, [books]);

  const { mostBorrowed, weedingCandidates12Mo, topBorrowMax } = useMemo(() => {
    const loanCounts: Record<string, number> = {};
    loans.forEach(l => {
      loanCounts[l.bookId] = (loanCounts[l.bookId] || 0) + 1;
    });

    const ranked = books.map(b => ({
      book: b,
      borrowCount: loanCounts[b.id] || 0,
      monthsOnShelf: getMonthsOnShelf(b.addedAt),
    }));

    const top = [...ranked].sort((a, b) => b.borrowCount - a.borrowCount).slice(0, 4);
    const maxCount = Math.max(1, ...top.map(r => r.borrowCount));
    const stagnant12Mo = ranked
      .filter(r => r.borrowCount === 0 && !r.book.isReferenceOnly && r.monthsOnShelf >= 12)
      .sort((a, b) => b.monthsOnShelf - a.monthsOnShelf);

    return {
      mostBorrowed: top,
      weedingCandidates12Mo: stagnant12Mo,
      topBorrowMax: maxCount,
    };
  }, [books, loans]);

  const handleLoadInsights = async () => {
    setLoadingInsights(true);
    try {
      const res = await getPredictiveInsights({
        books: books.map(b => ({
          id: b.id,
          title: b.title,
          ddcCallNumber: b.ddcCallNumber,
          shelfLocation: b.shelfLocation,
          availableCopies: b.availableCopies,
          totalCopies: b.totalCopies
        })),
        loans: loans.map(l => ({
          id: l.id,
          userId: l.userId,
          bookId: l.bookId,
          bookTitle: l.bookTitle,
          userName: l.userName,
          userGrade: l.userGrade,
          dueDate: l.dueDate,
          status: l.status,
          renewalCount: l.renewalCount,
          lateFee: l.lateFee,
        })),
        language
      });
      if (res) setInsights(res);
    } catch (e) {
      console.warn('Insights load fallback:', e);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    handleLoadInsights();
  }, [language]);

  const getHeatCellColor = (intensity: number, isWeekend?: boolean) => {
    if (isWeekend && intensity === 0) {
      return 'bg-[#F7F5F0] dark:bg-[#232724] text-[#6B655D] dark:text-[#6B655D] border-[#E2DDD5] dark:border-[#2E3330]';
    }
    if (intensity >= 75) return 'bg-[#0F4C45] text-white border-[#0D2623]';
    if (intensity >= 55) return 'bg-[#16655B] text-white border-[#0F4C45]';
    if (intensity >= 25) return 'bg-[#ECFDF5] dark:bg-[#0F4C45]/50 text-[#0F4C45] dark:text-[#6EE7B7] border-[#A7F3D0] dark:border-[#16655B]';
    if (intensity > 0) return 'bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] border-[#E2DDD5] dark:border-[#2E3330]';
    return 'bg-[#F7F5F0] dark:bg-[#232724] text-[#6B655D] border-[#E2DDD5] dark:border-[#2E3330]';
  };

  const isPeakWindowSlot = (slot: string) => slot === '09:30' || slot === '11:45' || slot === '14:00';

  return (
    <div className="space-y-6">
      {/* Executive Header Strip */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#0F4C45] dark:text-[#6EE7B7] flex items-center gap-1.5">
            <Library className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'މަގޫދޫ ސްކޫލް އައި.އެލް.އެސް އެނަލިޓިކްސް' : 'Magoodhoo School ILS Analytics Overview'}</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE] tracking-tight archival-heading">
            {language === 'dv' ? `މަރުޙަބާ، ${currentUser.name}` : `Welcome back, ${currentUser.name}`}
          </h1>
          <p className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
            {language === 'dv'
              ? 'ސާކިއުލޭޝަން، 7 ދުވަހުގެ ޓްރެފިކް ހީޓްމެޕް، ކޮލެކްޝަން ހެލްތު، އަދި MVR ލެޖަރ.'
              : 'Live circulation metrics, 7-day peak traffic grid, collection weeding health, and MVR reconciliation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => onNavigateTab('checkout-hub')}
            className="px-3.5 py-2 rounded-xl bg-[#0D2623] dark:bg-[#232724] hover:bg-[#163B36] dark:hover:bg-[#2E3330] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-[#6EE7B7]" />
            <span>{language === 'dv' ? 'ސާކިއުލޭޝަން ޑެސްކް' : 'Circulation Desk'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddBookModal}
            className="px-3.5 py-2 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.addBook}</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateTab('ai-assistant')}
            className="px-3.5 py-2 rounded-xl bg-[#EFECE6] dark:bg-[#232724] hover:bg-[#E2DDD5] dark:hover:bg-[#2E3330] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Sparkles className="w-3.5 h-3.5 text-[#C26D3A]" />
            <span>{t.aiLibrarian}</span>
          </button>
        </div>
      </div>

      {/* 5-Card Executive KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Total Collection (Titles / Copies) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'dv' ? 'ޖުމްލަ ކޮލެކްޝަން' : 'Total Collection'}
            </span>
            <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              <bdi dir="ltr">{totalBooks.toLocaleString()}</bdi>
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              <bdi dir="ltr">+{kpiPeriodTrends.collectionDeltaPct}%</bdi>
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between font-medium">
            <span><bdi dir="ltr" className="font-mono font-bold text-slate-900 dark:text-white">{books.length}</bdi> {t.titles} · <bdi dir="ltr" className="font-mono text-emerald-700 dark:text-emerald-400 font-bold">{availableBooks}</bdi> avail</span>
            <span>{language === 'dv' ? 'ބޭރުގައި:' : 'Out:'} <strong className="font-mono text-slate-900 dark:text-white"><bdi dir="ltr">{totalBooks - availableBooks}</bdi></strong></span>
          </div>
        </div>

        {/* KPI 2: Active Loans */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'dv' ? 'މިހާރު ދޫކޮށްފައި' : 'Active Loans'}
            </span>
            <TrendingUp className="w-4 h-4 text-sky-700 dark:text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white font-mono tabular-nums">
              <bdi dir="ltr">{activeLoans.length + overdueLoans.length}</bdi>
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              <bdi dir="ltr">+{kpiPeriodTrends.circulationDeltaPct}%</bdi>
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between font-medium">
            <span>{t.activeBorrowers}: <strong className="font-mono text-slate-900 dark:text-white"><bdi dir="ltr">{activeBorrowersCount}</bdi></strong></span>
            <span className="font-mono text-slate-700 dark:text-slate-300"><bdi dir="ltr">{pendingReservations.length}</bdi> holds</span>
          </div>
        </div>

        {/* KPI 3: Overdue Rate (%) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'dv' ? 'މުއްދަތު ހަމަވި ނިސްބަތް' : 'Overdue Rate'}
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-3xl font-extrabold text-rose-700 dark:text-rose-400 font-mono tabular-nums">
              <bdi dir="ltr">{overdueRatePct}%</bdi>
            </span>
            <span className="text-[11px] font-mono font-bold text-emerald-700 dark:text-emerald-400">
              <bdi dir="ltr">{kpiPeriodTrends.overdueDeltaPct}%</bdi> vs term
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between font-medium">
            <span><strong className="font-mono text-rose-700 dark:text-rose-400"><bdi dir="ltr">{overdueLoans.length}</bdi></strong> items · Sun–Thu</span>
            <button onClick={() => onNavigateTab('admin-panel')} className="text-rose-700 dark:text-rose-400 hover:underline font-bold cursor-pointer">
              {language === 'dv' ? 'ބައްލަވާ →' : 'Review →'}
            </button>
          </div>
        </div>

        {/* KPI 4: Fines Collected vs. Outstanding (MVR) */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'dv' ? 'ލިބުނު / ނުލިބޭ ޖޫރިމަނާ' : 'Fines Collected vs. Due'}
            </span>
            <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 font-mono tabular-nums">
              <bdi dir="ltr">MVR {collectedRevenueMvr.toFixed(2)}</bdi>
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between font-medium">
            <span>{language === 'dv' ? 'ނުދައްކާ:' : 'Due:'} <strong className="font-mono text-rose-700 dark:text-rose-400"><bdi dir="ltr">MVR {unpaidFinesMvr.toFixed(2)}</bdi></strong></span>
            <button onClick={() => onNavigateTab('admin-panel')} className="text-slate-800 dark:text-slate-200 hover:underline font-bold cursor-pointer">
              {language === 'dv' ? 'ލެޖަރ →' : 'Ledger →'}
            </button>
          </div>
        </div>

        {/* KPI 5: Catalog Health Score & AI Bulk Fix */}
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'dv' ? 'ކެޓަލޮގް ހެލްތު ސްކޯ' : 'Catalog Health Score'}
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span
              className={`text-3xl font-extrabold font-mono tabular-nums ${
                catalogHealth.healthScore >= 85
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : catalogHealth.healthScore >= 65
                  ? 'text-amber-600 dark:text-amber-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              <bdi dir="ltr">{catalogHealth.healthScore}%</bdi>
            </span>
            <span className="text-[11px] font-mono font-bold text-slate-500 dark:text-slate-400">
              <bdi dir="ltr">{catalogHealth.proposals.length}</bdi> flagged
            </span>
          </div>
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-600 dark:text-slate-400 flex items-center justify-between font-medium">
            <span><bdi dir="ltr" className="font-mono font-bold text-slate-900 dark:text-white">{catalogHealth.healthyTitles}/{catalogHealth.totalTitles}</bdi> clean</span>
            {onOpenCatalogHealth && (
              <button
                type="button"
                onClick={onOpenCatalogHealth}
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-bold cursor-pointer"
              >
                {language === 'dv' ? 'އޮޑިޓް →' : 'Audit & Fix →'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 7-Day x Hourly Peak Traffic Visualization + Collection Health Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Peak Traffic 7-Day x Hourly Grid & Recharts Hourly Chart (2 cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{t.peakTrafficHeatmap}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'dv'
                  ? '7 ދުވަހުގެ ގަޑިތަކުގެ ޓްރެފިކް (09:30 / 11:45 އިންޓަވަލް އަދި 14:00 ސްކޫލް ނިމޭ ގަޑި).'
                  : '7-day × hourly circulation grid highlighting 09:30 & 11:45 interval rushes and 14:00 after-school peak.'}
              </p>
            </div>
            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
              <button
                type="button"
                onClick={() => setTrafficMode('heatmap')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  trafficMode === 'heatmap'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {language === 'dv' ? '7-ދުވަސް ގްރިޑް' : '7-Day Grid'}
              </button>
              <button
                type="button"
                onClick={() => setTrafficMode('chart')}
                className={`px-3 py-1 rounded-lg transition cursor-pointer whitespace-nowrap ${
                  trafficMode === 'chart'
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {language === 'dv' ? 'ރީޗާޓްސް ގްރާފް' : 'Recharts View'}
              </button>
            </div>
          </div>

          {trafficMode === 'heatmap' ? (
            <div className="space-y-3">
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-separate border-spacing-1.5">
                  <thead>
                    <tr className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                      <th className="text-start px-2 py-1">{language === 'dv' ? 'ދުވަސް' : 'Day'}</th>
                      {peakTrafficHeatmapData[0].slots.map((s) => (
                        <th key={s.slot} className="text-center font-mono px-2 py-1">
                          <div><bdi dir="ltr">{s.slot}</bdi></div>
                          {isPeakWindowSlot(s.slot) && (
                            <div className="text-[9px] font-sans font-bold text-emerald-700 dark:text-emerald-400 normal-case">
                              {s.slot === '14:00' ? 'After School' : 'Interval'}
                            </div>
                          )}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {peakTrafficHeatmapData.map((row) => (
                      <tr key={row.day} className={row.isWeekend ? 'opacity-75' : ''}>
                        <td className="font-bold text-slate-800 dark:text-slate-200 px-2 py-1 whitespace-nowrap">
                          <span>{language === 'dv' ? row.dayDv : row.day}</span>
                          {row.isWeekend && (
                            <span className="ms-1.5 text-[9px] font-semibold text-slate-400 dark:text-slate-500">
                              · Wknd
                            </span>
                          )}
                        </td>
                        {row.slots.map((cell) => {
                          const isSelected = selectedHeatmapCell?.day === row.day && selectedHeatmapCell?.slot === cell.slot;
                          return (
                            <td key={cell.slot}>
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedHeatmapCell({
                                    day: language === 'dv' ? row.dayDv : row.day,
                                    ...cell,
                                  })
                                }
                                className={`w-full py-2 px-2 rounded-lg border font-mono tabular-nums font-bold text-center transition cursor-pointer ${getHeatCellColor(cell.intensity, row.isWeekend)} ${
                                  isSelected ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 dark:ring-offset-slate-900' : 'hover:opacity-90'
                                }`}
                                title={`${row.day} ${cell.label}: ${cell.checkouts} checkouts, ${cell.returns} returns`}
                              >
                                <bdi dir="ltr">{cell.intensity}</bdi>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Low</span>
                  <span className="w-4 h-3 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 inline-block" />
                  <span className="w-4 h-3 rounded bg-emerald-200 dark:bg-emerald-900/50 border border-emerald-300 dark:border-emerald-800 inline-block" />
                  <span className="w-4 h-3 rounded bg-emerald-500 inline-block" />
                  <span className="w-4 h-3 rounded bg-emerald-700 inline-block" />
                  <span>Peak Rush</span>
                </div>
                {selectedHeatmapCell ? (
                  <div className="font-mono text-[11px] bg-slate-900 dark:bg-slate-800 text-white px-3 py-1.5 rounded-lg">
                    <bdi>{selectedHeatmapCell.day} · {selectedHeatmapCell.label}</bdi> —{' '}
                    <span className="text-emerald-300"><bdi dir="ltr">{selectedHeatmapCell.checkouts}</bdi> out</span> ·{' '}
                    <span className="text-sky-300"><bdi dir="ltr">{selectedHeatmapCell.returns}</bdi> in</span>
                  </div>
                ) : (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Peak slot: Thu 11:45 Interval (86 txns)</span>
                )}
              </div>
            </div>
          ) : (
            <SectionErrorBoundary
              compact
              areaNameEn="Hourly Traffic Chart"
              areaNameDv="ގަޑިތަކުގެ ޗާޓް"
              language={language}
              onRecover={() => setTrafficMode('heatmap')}
            >
              <div className="h-64 w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyPeakTrafficData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2DDD5" strokeOpacity={0.5} />
                    <XAxis dataKey="slot" tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#6B655D' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #E2DDD5', fontSize: '12px' }} />
                    <Bar dataKey="checkouts" name="Checkouts" fill="#0F4C45" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="returns" name="Returns" fill="#C26D3A" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionErrorBoundary>
          )}
        </div>

        {/* Collection Health Split: Dhivehi-to-English Ratio & Top DDC Subjects */}
        <SectionErrorBoundary
          compact
          areaNameEn="Collection Distribution Chart"
          areaNameDv="ކޮލެކްޝަން ބަހާލުން ޗާޓް"
          language={language}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base">{t.collectionHealth}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'dv' ? 'ދިވެހި އަދި އިނގިރޭސި ފޮތްތަކުގެ ނިސްބަތް' : 'Dhivehi-to-English ratio & top DDC sections'}
              </p>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3 border border-slate-200 dark:border-slate-700 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-200">
                  {language === 'dv' ? 'ދިވެހި : އިނގިރޭސި ނިސްބަތް' : 'Dhivehi : English Ratio'}
                </span>
                <span className="font-mono tabular-nums font-extrabold text-emerald-700 dark:text-emerald-400">
                  <bdi dir="ltr">{dvToEnMetrics.ratioLabel}</bdi>
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700 flex">
                <div
                  className="bg-emerald-600 h-full transition-all"
                  style={{ width: `${dvToEnMetrics.dvPct}%` }}
                  title={`Dhivehi: ${dvToEnMetrics.dvCopies} copies`}
                />
                <div
                  className="bg-slate-900 dark:bg-sky-500 h-full transition-all"
                  style={{ width: `${dvToEnMetrics.enPct}%` }}
                  title={`English: ${dvToEnMetrics.enCopies} copies`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                <span><bdi dir="ltr">Dv {dvToEnMetrics.dvCopies} ({dvToEnMetrics.dvPct}%)</bdi></span>
                <span><bdi dir="ltr">En {dvToEnMetrics.enCopies} ({dvToEnMetrics.enPct}%)</bdi></span>
              </div>
            </div>

            <div className="h-32 w-full flex items-center justify-center" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={34}
                    outerRadius={54}
                    paddingAngle={3}
                  >
                    {languageBreakdown.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: '10px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top DDC Sections</div>
              {categoryBreakdown.slice(0, 3).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-700 dark:text-slate-300 truncate pe-2">{cat.category}</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white shrink-0"><bdi dir="ltr">{cat.copies}</bdi></span>
                </div>
              ))}
            </div>
          </div>
        </SectionErrorBoundary>
      </div>

      {/* Grade-Level Reading Engagement + AI Predictive Insights + Collection Health & Weeding */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Grade-Level Engagement */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{t.gradeEngagement}</span>
            </h3>
          </div>
          <div className="space-y-3 text-xs">
            {gradeReadingEngagementData.map((row) => (
              <div key={row.grade} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 dark:text-slate-200">{row.grade}</span>
                  <span className="font-mono text-[11px] text-slate-600 dark:text-slate-400">
                    <bdi>{row.loansThisTerm}</bdi> loans · <strong className="text-emerald-700 dark:text-emerald-400"><bdi>{row.completionRate}%</bdi></strong>
                  </span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
                  <div
                    className="h-full bg-emerald-700 dark:bg-emerald-500 rounded-md transition-all"
                    style={{ width: `${row.completionRate}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">Top: {row.topCategory}</div>
              </div>
            ))}
          </div>
        </div>

        {/* AI Predictive Insights Panel (Wrapped in SectionErrorBoundary) */}
        <SectionErrorBoundary
          compact
          areaNameEn="AI Predictive Insights"
          areaNameDv="އޭއައި ލަފާކުރުންތައް"
          language={language}
          onRecover={handleLoadInsights}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm sm:text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <span>{t.aiInsights}</span>
              </h3>
              <button
                type="button"
                onClick={handleLoadInsights}
                disabled={loadingInsights}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 cursor-pointer disabled:opacity-50"
                title="Refresh AI Insights"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingInsights ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loadingInsights && !insights ? (
              <AnalyticsDashboardSkeleton panels={3} />
            ) : insights ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 leading-relaxed font-medium">
                  {insights.executiveSummary}
                </div>

                {insights.highRiskLoans.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                      {language === 'dv' ? 'ޖޫރިމަނާގެ ރިސްކު ހުރި ނެގުންތައް' : 'High-Risk / Overdue Alerts'}
                    </div>
                    {insights.highRiskLoans.slice(0, 3).map(hr => (
                      <div key={hr.id} className="p-2.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="font-bold text-slate-900 dark:text-white truncate"><bdi>{hr.bookTitle}</bdi></div>
                          <div className="text-[11px] text-slate-600 dark:text-slate-300">
                            <bdi>{hr.userName}</bdi> · <bdi dir="ltr" className="font-mono tabular-nums">{hr.dueDate}</bdi> · <bdi dir="ltr" className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-300">{hr.riskScore}%</bdi>
                          </div>
                          {hr.riskFactors && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              {hr.riskFactors}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            hr.riskLevel === 'CRITICAL' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'
                          }`}>
                            {hr.riskLevel}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReminderTarget({
                              loanId: hr.id,
                              bookTitle: hr.bookTitle,
                              userName: hr.userName,
                              userGrade: hr.userGrade,
                              dueDate: hr.dueDate,
                              daysOverdue: hr.daysOverdue,
                              lateFeeMvr: hr.lateFeeMvr,
                            })}
                            className="px-2 py-1 rounded-lg bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-[10px] font-bold transition flex items-center gap-1 cursor-pointer whitespace-nowrap"
                            title={language === 'dv' ? 'ހަނދާންކޮށްދޭ މެސެޖު ޑްރާފްޓްކުރޭ' : 'Draft Reminder'}
                          >
                            <MessageSquare className="w-3 h-3" />
                            <span>{language === 'dv' ? 'މެސެޖު' : 'Draft Reminder'}</span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Click refresh to compute predictive insights.
              </div>
            )}

            <ReminderDraftModal
              target={reminderTarget}
              onClose={() => setReminderTarget(null)}
            />
          </div>
        </SectionErrorBoundary>

        {/* Collection Health & Weeding Insights (Top-Read + Zero Circulation >= 12 Months) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="space-y-3">
            <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{language === 'dv' ? 'އެންމެ ގިނައިން ނެގޭ ފޮތްތައް' : 'Top-Read Titles'}</span>
            </h4>
            <div className="space-y-2">
              {mostBorrowed.slice(0, 3).map(({ book, borrowCount }) => {
                const pct = Math.max(8, Math.round((borrowCount / topBorrowMax) * 100));
                return (
                  <div key={book.id} className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 text-xs space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white truncate"><bdi>{book.title}</bdi></div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          <bdi>{book.ddcCallNumber || 'DDC'}</bdi> · <bdi>{book.availableCopies}/{book.totalCopies}</bdi>
                        </div>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400 text-[11px] shrink-0">
                        <bdi>{borrowCount} loans</bdi>
                      </span>
                    </div>
                    <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>{language === 'dv' ? '12+ މަސް ދައުރުނުވާ ފޮތްތައް' : 'Zero-Circulation (12+ Mo)'}</span>
              </h4>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300">
                  <bdi>{weedingCandidates12Mo.length}</bdi> items
                </span>
                <button
                  type="button"
                  onClick={() => onNavigateTab('stocktaking')}
                  className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {language === 'dv' ? 'އޮޑިޓް އަދި ވީޑިންގ' : 'Audit & CREW'} <ArrowUpRight className="w-3 h-3 rtl-mirror" />
                </button>
              </div>
            </div>
            {weedingCandidates12Mo.length === 0 ? (
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 dark:text-slate-400">
                {language === 'dv'
                  ? '12 މަސްދުވަސް ތެރޭ ދައުރުނުވާ އެއްވެސް ފޮތެއް ނެތެވެ.'
                  : 'All eligible titles 12+ months on shelf have circulated.'}
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                {weedingCandidates12Mo.slice(0, 3).map(({ book, monthsOnShelf }) => (
                  <div key={book.id} className="p-2.5 flex items-center justify-between gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-xs">
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white truncate"><bdi>{book.title}</bdi></div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        <bdi>{book.shelfLocation}</bdi> · <span className="font-mono"><bdi>{monthsOnShelf} mo idle</bdi></span>
                      </div>
                    </div>
                    <span className="text-[11px] font-mono font-bold text-amber-700 dark:text-amber-400 shrink-0">
                      0 loans
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Popular Reads Horizontal Shelf */}
      {mostBorrowed.length > 0 && (
        <HorizontalBookShelf
          title={language === 'dv' ? 'މަޤްބޫލު ފޮތްތައް' : 'Popular Reads'}
          subtitle={
            language === 'dv'
              ? 'މި ޓާމްގައި އެންމެ ގިނައިން ދޫކުރެވުނު ފޮތްތައް'
              : 'Most frequently borrowed titles across Magoodhoo School'
          }
          itemCount={mostBorrowed.length}
          language={language}
          icon={<TrendingUp className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7] shrink-0" strokeWidth={1.75} />}
        >
          {mostBorrowed.map(({ book }) => (
            <LibraryBookCard
              key={`dash-pop-${book.id}`}
              variant="shelf"
              title={book.title}
              author={book.author}
              coverUrl={book.coverUrl}
              category={book.category}
              ddcCallNumber={book.ddcCallNumber}
              barcode={book.barcode}
              isbn={book.isbn}
              shelfLocation={book.shelfLocation}
              availableCopies={book.availableCopies}
              totalCopies={book.totalCopies}
              isReferenceOnly={book.isReferenceOnly}
              language={language}
              onSelect={() => onNavigateTab('catalog')}
            />
          ))}
        </HorizontalBookShelf>
      )}

      {/* Recent Circulation Ledger Table */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-bold text-[#1C1917] dark:text-[#F5F3EE] text-sm flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
            <span>{language === 'dv' ? 'އެންމެ ފަހުގެ ސާކިއުލޭޝަން ރެކޯޑް' : 'Recent Circulation Ledger'}</span>
          </h4>
          <button
            onClick={() => onNavigateTab('checkout-hub')}
            className="text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7] hover:underline flex items-center gap-1 cursor-pointer"
          >
            {language === 'dv' ? 'ހުރިހާ ލިސްޓެއް' : 'Manage All'} <ArrowUpRight className="w-3.5 h-3.5 rtl-mirror" />
          </button>
        </div>
        <div className="w-full overflow-x-auto scrollbar-thin max-h-[60vh]">
          <table className="w-full text-start text-xs text-[#1C1917] dark:text-[#F5F3EE]">
            <thead className="sticky top-0 z-10 bg-[#EFECE6] dark:bg-[#232724] text-[#6B655D] dark:text-[#A19B91] font-bold uppercase text-[10px] border-y border-[#E2DDD5] dark:border-[#2E3330]">
              <tr>
                <th className="py-2.5 px-3">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Title'}</th>
                <th className="py-2.5 px-3">{language === 'dv' ? 'ކޮޕީ' : 'Copy'}</th>
                <th className="py-2.5 px-3">{language === 'dv' ? 'ނެގި ފަރާތް' : 'Borrower'}</th>
                <th className="py-2.5 px-3">{t.dueDate}</th>
                <th className="py-2.5 px-3 text-end">{t.status}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330]">
              {loans.slice(0, 6).map(loan => (
                <tr key={loan.id} className="hover:bg-[#F7F5F0] dark:hover:bg-[#232724]/60">
                  <td className="py-2.5 px-3 font-bold text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{loan.bookTitle}</bdi></td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[11px] text-[#6B655D] dark:text-[#A19B91]"><bdi dir="ltr">{loan.copyBarcode || loan.bookIsbn}</bdi></td>
                  <td className="py-2.5 px-3 text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{loan.userName}</bdi></td>
                  <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B655D] dark:text-[#A19B91]"><bdi dir="ltr">{loan.dueDate}</bdi></td>
                  <td className="py-2.5 px-3 text-end">
                    <StatusPill
                      status={loan.status === 'overdue' ? 'overdue' : loan.status === 'active' ? 'checked_out' : 'available'}
                      label={loan.status === 'active' ? t.statusActive : loan.status === 'overdue' ? t.statusOverdue : t.statusReturned}
                      compact
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
