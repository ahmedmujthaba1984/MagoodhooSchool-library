import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  UserPlus,
  BookOpen,
  Clock,
  CheckCircle2,
  RotateCcw,
  Trash2,
  XCircle,
  Award,
  Download,
  Printer,
  Bell,
  MessageSquare,
  Mail,
  Smartphone,
  Sparkles,
  Receipt,
  Flame,
  Send,
} from 'lucide-react';
import { UserProfile, Loan, Reservation, Book, LedgerTransaction } from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { BookCover } from './BookCover';
import { StatusPill } from './StatusPill';
import { HorizontalBookShelf } from './HorizontalBookShelf';
import { LibraryEmblem } from './LibraryEmblem';
import {
  buildCertificateHtml,
  evaluateStudentReadingSummary,
  getAcademicTermKey,
  printBilingualCertificateA4,
} from '../lib/readingEngagement';

export interface ParentReminderPreferences {
  whatsapp: boolean;
  sms: boolean;
  email: boolean;
  phone: string;
}

interface ParentDashboardProps {
  parentUser: UserProfile;
  allUsers: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  books: Book[];
  ledgerTransactions?: LedgerTransaction[];
  onRenewLoan: (loan: Loan) => void;
  onAddChildToParent: (childName: string, grade: string, studentIdCode: string) => void;
  onOpenAddParentModal?: () => void;
  onDeleteUser?: (userId: string) => void;
  onCancelReservation?: (reservationId: string) => void;
  onSuggestBookForChild?: (
    title: string,
    author: string,
    reason: string,
    child: UserProfile
  ) => void;
}

function getDueCountdown(
  dueDateStr: string,
  language: 'en' | 'dv'
): { label: string; tone: 'overdue' | 'today' | 'upcoming' } {
  const todayStr = new Date().toISOString().split('T')[0];
  const dueMs = new Date(`${dueDateStr}T00:00:00Z`).getTime();
  const todayMs = new Date(`${todayStr}T00:00:00Z`).getTime();
  if (Number.isNaN(dueMs) || Number.isNaN(todayMs)) {
    return { label: dueDateStr, tone: 'upcoming' };
  }
  const diffDays = Math.round((dueMs - todayMs) / 86400000);
  if (diffDays < 0) {
    const abs = Math.abs(diffDays);
    return {
      tone: 'overdue',
      label:
        language === 'dv'
          ? `${abs} ދުވަސް ލަސްވެފައި`
          : `Overdue by ${abs} day${abs === 1 ? '' : 's'}`,
    };
  }
  if (diffDays === 0) {
    return {
      tone: 'today',
      label: language === 'dv' ? 'މިއަދު ޙަވާލުކުރަންޖެހޭ' : 'Due today',
    };
  }
  return {
    tone: 'upcoming',
    label:
      language === 'dv'
        ? `${diffDays} ދުވަސް ބާކީ`
        : `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
  };
}

export const ParentDashboard: React.FC<ParentDashboardProps> = ({
  parentUser,
  allUsers,
  loans,
  reservations,
  books,
  ledgerTransactions = [],
  onRenewLoan,
  onAddChildToParent,
  onOpenAddParentModal,
  onDeleteUser,
  onCancelReservation,
  onSuggestBookForChild,
}) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const isDv = language === 'dv';

  const children = useMemo(
    () =>
      allUsers.filter(
        (u) => u.parentId === parentUser.id || parentUser.childrenIds?.includes(u.id)
      ),
    [allUsers, parentUser.id, parentUser.childrenIds]
  );

  const [activeChildId, setActiveChildId] = useState<string>(children[0]?.id || '');
  const [showAddChildModal, setShowAddChildModal] = useState(false);
  const [childToDelete, setChildToDelete] = useState<UserProfile | null>(null);
  const [newChildName, setNewChildName] = useState('');
  const [newChildGrade, setNewChildGrade] = useState('Grade 5');
  const [newChildIdCode, setNewChildIdCode] = useState('');

  // Parent Book Suggestion State
  const [suggestTitle, setSuggestTitle] = useState('');
  const [suggestAuthor, setSuggestAuthor] = useState('');
  const [suggestReason, setSuggestReason] = useState('');
  const [recentSuggestions, setRecentSuggestions] = useState<
    Array<{ id: string; title: string; author: string; childName: string }>
  >([]);

  // WhatsApp / SMS / Email Reminder Preferences (persisted per guardian)
  const prefsStorageKey = `magoodhoo_parent_prefs_${parentUser.id}`;
  const [reminderPrefs, setReminderPrefs] = useState<ParentReminderPreferences>(() => {
    try {
      const saved = localStorage.getItem(prefsStorageKey);
      if (saved) return JSON.parse(saved) as ParentReminderPreferences;
    } catch {
      // Ignore storage error
    }
    return {
      whatsapp: true,
      sms: false,
      email: true,
      phone: parentUser.phone || '+960 7785678',
    };
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem(prefsStorageKey);
      if (saved) {
        setReminderPrefs(JSON.parse(saved) as ParentReminderPreferences);
      } else {
        setReminderPrefs({
          whatsapp: true,
          sms: false,
          email: true,
          phone: parentUser.phone || '+960 7785678',
        });
      }
    } catch {
      // Ignore
    }
  }, [prefsStorageKey, parentUser.phone]);

  const updateReminderPrefs = (patch: Partial<ParentReminderPreferences>) => {
    setReminderPrefs((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(prefsStorageKey, JSON.stringify(next));
      } catch {
        // Ignore
      }
      return next;
    });
  };

  useEffect(() => {
    if ((!activeChildId || !children.some((c) => c.id === activeChildId)) && children.length > 0) {
      setActiveChildId(children[0].id);
    }
  }, [children, activeChildId]);

  const selectedChild = children.find((c) => c.id === activeChildId) || children[0];

  // Aggregate stats across all linked children
  const allChildrenLoans = useMemo(
    () => loans.filter((l) => children.some((c) => c.id === l.userId || c.name === l.userName)),
    [loans, children]
  );

  const totalActiveLoans = allChildrenLoans.filter(
    (l) => l.status === 'active' || l.status === 'overdue'
  ).length;
  const totalOverdue = allChildrenLoans.filter((l) => l.status === 'overdue').length;
  const totalFeesDueMvr = allChildrenLoans.reduce(
    (sum, l) => sum + (l.feePaid ? 0 : Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0))),
    0
  );
  const totalReturned = allChildrenLoans.filter((l) => l.status === 'returned').length;

  // Selected child loans, reservations, ledger, and reading summary
  const childLoans = useMemo(
    () =>
      selectedChild
        ? loans.filter((l) => l.userId === selectedChild.id || l.userName === selectedChild.name)
        : [],
    [selectedChild, loans]
  );

  const childActiveLoans = childLoans.filter(
    (l) => l.status === 'active' || l.status === 'overdue'
  );
  const childReturnedLoans = childLoans.filter((l) => l.status === 'returned');

  const childReservations = useMemo(
    () =>
      selectedChild
        ? reservations.filter(
            (r) => r.userId === selectedChild.id || r.userName === selectedChild.name
          )
        : [],
    [selectedChild, reservations]
  );

  const childLedger = useMemo(() => {
    if (!selectedChild) return [];
    return ledgerTransactions.filter(
      (tx) => tx.userId === selectedChild.id || tx.userName === selectedChild.name
    );
  }, [selectedChild, ledgerTransactions]);

  const childUnpaidLoans = childLoans.filter(
    (l) => !l.feePaid && Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)) > 0
  );
  const childBalanceMvr = childUnpaidLoans.reduce(
    (sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)),
    0
  );

  const childReadingSummary = useMemo(() => {
    if (!selectedChild) return null;
    return evaluateStudentReadingSummary(selectedChild, loans, books);
  }, [selectedChild, loans, books]);

  const handleCreateChildAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newChildName.trim() || !newChildIdCode.trim()) return;
    onAddChildToParent(newChildName.trim(), newChildGrade, newChildIdCode.trim());
    setNewChildName('');
    setNewChildIdCode('');
    setShowAddChildModal(false);
  };

  const getCertificatePayload = (child: UserProfile) => {
    const booksReadCount = Math.max(
      child.booksCompletedCount || 0,
      childReadingSummary?.verifiedLoans.length || 0,
      childReturnedLoans.length
    );
    const todayStr = new Date().toISOString().split('T')[0];
    const termName = getAcademicTermKey(todayStr);
    return {
      studentName: child.name,
      studentNameDv: child.dhivehiName,
      grade: child.grade || 'Student',
      schoolHouse: child.schoolHouse,
      booksReadCount,
      termName,
      termNameDv: termName.includes('Term 1') ? '2026 ފުރަތަމަ ޓާމް' : '2026 ދެވަނަ ޓާމް',
      achievementTitleEn: 'Term Reading Sanctuary Achievement',
      achievementTitleDv: 'ޓާމުގެ ފޮތްކިޔުމުގެ ޝަރަފު',
      issueDate: todayStr,
      principalName: 'Principal, F. Magoodhoo School',
      librarianName: 'Head Librarian, School Media Center',
      certificateId: `MGD-CERT-${(child.studentIdCode || child.id).replace(/[^A-Za-z0-9]/g, '').slice(-6).toUpperCase()}`,
    };
  };

  const handleDownloadCertificate = () => {
    if (!selectedChild) return;
    const payload = getCertificatePayload(selectedChild);
    const innerHtml = buildCertificateHtml(payload);
    const fullDoc = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Reading Certificate - ${selectedChild.name}</title>
  <style>
    body { margin: 0; padding: 24px; background: #F7F5F0; font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>${innerHtml}</body>
</html>`;

    const blob = new Blob([fullDoc], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Magoodhoo_Reading_Certificate_${selectedChild.name.replace(/\s+/g, '_')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    toast.success(
      isDv
        ? `${selectedChild.name} ގެ ދެބަހުގެ ރީޑިންގ ސެޓްފިކެޓް ޑައުންލޯޑްވެއްޖެ.`
        : `Downloaded bilingual term reading certificate for ${selectedChild.name}.`,
      'Certificate Downloaded'
    );
  };

  const handlePrintCertificate = () => {
    if (!selectedChild) return;
    printBilingualCertificateA4(getCertificatePayload(selectedChild));
  };

  const handleSubmitSuggestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChild || !suggestTitle.trim()) return;
    const cleanTitle = suggestTitle.trim();
    const cleanAuthor = suggestAuthor.trim() || 'Requested by Guardian';
    const cleanReason =
      suggestReason.trim() || `Parent reading recommendation for ${selectedChild.name} (${selectedChild.grade || 'Student'}).`;

    if (onSuggestBookForChild) {
      onSuggestBookForChild(cleanTitle, cleanAuthor, cleanReason, selectedChild);
    } else {
      toast.success(
        isDv
          ? `"${cleanTitle}" ލައިބްރަރީއަށް ހުށަހެޅިއްޖެ.`
          : `Submitted "${cleanTitle}" recommendation to the library.`,
        'Book Suggested'
      );
    }

    setRecentSuggestions((prev) => [
      { id: `ps-${Date.now()}`, title: cleanTitle, author: cleanAuthor, childName: selectedChild.name },
      ...prev,
    ]);
    setSuggestTitle('');
    setSuggestAuthor('');
    setSuggestReason('');
  };

  const handleSavePrefsClick = () => {
    updateReminderPrefs({});
    toast.success(
      isDv
        ? 'ނޯޓިފިކޭޝަން ސެޓިންގްސް ރައްކާކުރެވިއްޖެ.'
        : 'Parent due-date reminder preferences saved.',
      'Alerts Updated'
    );
  };

  return (
    <div className="space-y-6">
      {/* Heritage Emerald Parent Banner */}
      <div className="bg-[#0F4C45] text-[#F7F5F0] rounded-3xl p-5 sm:p-7 border border-[#16655B] shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-wider text-[#F3DFB1]">
              <LibraryEmblem size="sm" className="border-white/20" />
              <span>{t.parentPortal}</span>
            </div>
            <h2 className={`text-xl sm:text-2xl font-extrabold tracking-tight text-white archival-heading ${isDv ? 'leading-[1.85]' : ''}`}>
              {isDv
                ? `${parentUser.dhivehiName || parentUser.name} — ބެލެނިވެރިންގެ ޕޯޓަލް`
                : `Guardian Reading Desk · ${parentUser.name}`}
            </h2>
            <p className={`text-xs sm:text-sm text-[#DCE7E4] ${isDv ? 'leading-[1.85]' : 'leading-relaxed'}`}>
              {isDv
                ? 'ދަރިވަރުން ނަގާފައިވާ ފޮތްތަކާއި، މުއްދަތު ހަމަވާ ދުވަސްތަކާއި، MVR ލެޖަރ އަދި ރީޑިންގ ސެޓްފިކެޓް ބައްލަވާ.'
                : 'Track active library loans, due-date countdowns, MVR fee balances, reading milestones, and bilingual term certificates across all your children.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
            {onOpenAddParentModal && (
              <button
                type="button"
                onClick={onOpenAddParentModal}
                className="min-h-[44px] bg-[#16655B] hover:bg-[#1B7A6E] text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-white/15 transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
                id="parent-portal-add-parent-btn"
              >
                <Users className="w-4 h-4 text-[#F3DFB1]" />
                <span>{isDv ? 'އައު ބެލެނިވެރިއެއް' : 'Register Parent'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowAddChildModal(true)}
              className="min-h-[44px] bg-[#F7F5F0] hover:bg-white text-[#0D2623] font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-xs transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
              id="add-child-account-btn"
            >
              <UserPlus className="w-4 h-4 text-[#0F4C45]" />
              <span>{isDv ? 'ދަރިވަރަކު ގުޅުވާ' : 'Add Child Account'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aggregate KPI Strip (Mobile 2-col -> Desktop 4-col) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6B655D] dark:text-[#A19B91]">
            <span>{isDv ? 'މިވަގުތު ގެންގުޅޭ' : 'Active Loans'}</span>
            <BookOpen className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE] font-mono tabular-nums">
            <bdi dir="ltr">{totalActiveLoans}</bdi>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6B655D] dark:text-[#A19B91]">
            <span>{isDv ? 'ކިޔައި ނިންމި ފޮތް' : 'Books Returned'}</span>
            <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-[#6EE7B7]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE] font-mono tabular-nums">
            <bdi dir="ltr">{totalReturned}</bdi>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6B655D] dark:text-[#A19B91]">
            <span>{isDv ? 'މުއްދަތު ހަމަވެފައި' : 'Overdue Items'}</span>
            <Clock className="w-4 h-4 text-[#C26D3A]" />
          </div>
          <div className={`text-2xl sm:text-3xl font-extrabold font-mono tabular-nums ${totalOverdue > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#1C1917] dark:text-[#F5F3EE]'}`}>
            <bdi dir="ltr">{totalOverdue}</bdi>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-4 sm:p-5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs space-y-2">
          <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-[#6B655D] dark:text-[#A19B91]">
            <span>{isDv ? 'ދައްކަންޖެހޭ MVR' : 'MVR Balance Due'}</span>
            <Receipt className="w-4 h-4 text-[#B91C1C] dark:text-[#FCA5A5]" />
          </div>
          <div className={`text-xl sm:text-2xl font-extrabold font-mono tabular-nums ${totalFeesDueMvr > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#15803D] dark:text-[#6EE7B7]'}`}>
            <bdi dir="ltr">MVR {totalFeesDueMvr.toFixed(2)}</bdi>
          </div>
        </div>
      </div>

      {/* Multi-Child Switcher & Workspace */}
      {children.length > 0 ? (
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-3xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs overflow-hidden">
          {/* Child Tabs Bar */}
          <div className="bg-[#EFECE6] dark:bg-[#232724] px-4 py-3.5 border-b border-[#E2DDD5] dark:border-[#2E3330] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              {children.map((child) => {
                const isSelected = activeChildId === child.id;
                return (
                  <button
                    key={child.id}
                    type="button"
                    onClick={() => setActiveChildId(child.id)}
                    className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2.5 shrink-0 cursor-pointer whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#0F4C45] text-white shadow-xs'
                        : 'bg-[#FFFFFF] dark:bg-[#1A1D1B] text-[#1C1917] dark:text-[#F5F3EE] hover:bg-[#F7F5F0] dark:hover:bg-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330]'
                    }`}
                    id={`child-tab-${child.id}`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full text-[11px] font-extrabold flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-[#16655B] text-[#F3DFB1]'
                          : 'bg-[#EFECE6] dark:bg-[#232724] text-[#0F4C45] dark:text-[#6EE7B7]'
                      }`}
                    >
                      {child.name.charAt(0)}
                    </span>
                    <span>
                      <bdi>{child.name}</bdi>
                    </span>
                    <span className="text-[11px] opacity-80 font-medium">
                      ({child.grade || 'Student'})
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedChild && (
              <div className="flex items-center justify-between sm:justify-end gap-2.5">
                <div className="text-xs font-mono tabular-nums bg-[#FFFFFF] dark:bg-[#1A1D1B] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330] px-3 py-2 rounded-xl font-bold">
                  ID: <bdi dir="ltr">{selectedChild.studentIdCode || 'N/A'}</bdi>
                </div>
                {onDeleteUser && (
                  <button
                    type="button"
                    onClick={() => setChildToDelete(selectedChild)}
                    className="min-h-[40px] bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#7F1D1D]/30 dark:hover:bg-[#7F1D1D]/50 text-[#B91C1C] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#B91C1C]/60 text-xs font-bold px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                    title="Unlink Student"
                    id={`remove-child-btn-${selectedChild.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isDv ? 'ވަކިކުރޭ' : 'Unlink'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {selectedChild && (
            <div className="p-4 sm:p-6 space-y-8">
              {/* SECTION 1: ACTIVE LOANS WITH COUNTDOWN BADGES & BOOKCOVERS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#0F4C45] dark:text-[#6EE7B7]" />
                    <span>
                      {isDv
                        ? `${selectedChild.name} މިވަގުތު ގެންގުޅޭ ފޮތްތައް (${childActiveLoans.length})`
                        : `Active Borrowed Books (${childActiveLoans.length})`}
                    </span>
                  </h3>
                  {selectedChild.schoolHouse && (
                    <span className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
                      {selectedChild.grade} · {selectedChild.schoolHouse} House
                    </span>
                  )}
                </div>

                {childActiveLoans.length === 0 ? (
                  <div className="p-6 bg-[#F7F5F0] dark:bg-[#232724] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] text-center text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
                    {isDv
                      ? `${selectedChild.name} މިވަގުތު ނަގާފައިވާ އެއްވެސް ފޮތެއް ނެތެވެ.`
                      : `No books are currently checked out to ${selectedChild.name}.`}
                  </div>
                ) : (
                  <HorizontalBookShelf
                    title={
                      isDv
                        ? `${selectedChild.name} މިވަގުތު ގެންގުޅޭ ފޮތްތައް`
                        : 'Currently Reading & Active Loans'
                    }
                    subtitle={
                      selectedChild.schoolHouse
                        ? `${selectedChild.grade} · ${selectedChild.schoolHouse} House`
                        : selectedChild.grade
                    }
                    itemCount={childActiveLoans.length}
                    language={language}
                    defaultExpanded={childActiveLoans.length <= 2}
                    icon={<BookOpen className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7] shrink-0" />}
                    gridClassName="grid grid-cols-1 md:grid-cols-2 gap-4"
                    containerClassName="bg-transparent border-0 p-0 space-y-3"
                  >
                    {childActiveLoans.map((loan) => {
                      const book = books.find((b) => b.id === loan.bookId);
                      const isOverdue = loan.status === 'overdue';
                      const countdown = getDueCountdown(loan.dueDate, language);
                      const loanFineRemaining = Math.max(0, (loan.lateFee || 0) - (loan.amountPaid || 0));

                      return (
                        <div
                          key={loan.id}
                          className={`w-[320px] sm:w-[370px] shrink-0 snap-start p-4 rounded-2xl border flex gap-4 ${
                            isOverdue
                              ? 'bg-[#FEF2F2]/60 dark:bg-[#7F1D1D]/20 border-[#FECACA] dark:border-[#B91C1C]/60'
                              : 'bg-[#F7F5F0] dark:bg-[#232724] border-[#E2DDD5] dark:border-[#2E3330]'
                          }`}
                        >
                          <div className="w-16 sm:w-20 shrink-0 rounded-lg overflow-hidden border border-[#E2DDD5] dark:border-[#2E3330] shadow-xs self-start">
                            <BookCover
                              src={book?.coverUrl}
                              title={loan.bookTitle}
                              author={book?.author}
                              ddcCallNumber={book?.ddcCallNumber}
                              category={book?.category}
                              size="sm"
                            />
                          </div>

                          <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-extrabold text-[#1C1917] dark:text-[#F5F3EE] text-sm leading-snug line-clamp-2">
                                  <bdi>{loan.bookTitle}</bdi>
                                </h4>
                                <StatusPill
                                  status={isOverdue ? 'overdue' : 'checked_out'}
                                  label={isOverdue ? t.statusOverdue : t.statusActive}
                                  compact
                                />
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                                <span
                                  className={`font-bold px-2 py-0.5 rounded-md ${
                                    countdown.tone === 'overdue'
                                      ? 'bg-[#B91C1C] text-white'
                                      : countdown.tone === 'today'
                                      ? 'bg-[#C26D3A] text-white'
                                      : 'bg-[#ECFDF5] dark:bg-[#0F4C45]/50 text-[#0F4C45] dark:text-[#6EE7B7]'
                                  }`}
                                >
                                  {countdown.label}
                                </span>
                                <span className="text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
                                  {isDv ? 'މުއްދަތު:' : 'Due:'} <bdi dir="ltr">{loan.dueDate}</bdi>
                                </span>
                              </div>

                              {!loan.feePaid && loanFineRemaining > 0 && (
                                <div className="text-xs font-bold text-[#B91C1C] dark:text-[#FCA5A5]">
                                  {isDv ? 'އަރާފައިވާ ޖޫރިމަނާ:' : 'Accrued Late Fee:'}{' '}
                                  <bdi dir="ltr" className="font-mono tabular-nums">
                                    MVR {loanFineRemaining.toFixed(2)}
                                  </bdi>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-[#E2DDD5] dark:border-[#2E3330]">
                              <span className="text-[11px] font-mono tabular-nums text-[#6B655D] dark:text-[#A19B91]">
                                {isDv ? 'އިތުރުކުރެވުނީ:' : 'Renewals:'} <bdi dir="ltr">{loan.renewalCount}/2</bdi>
                              </span>
                              <button
                                type="button"
                                onClick={() => onRenewLoan(loan)}
                                disabled={isOverdue || loan.renewalCount >= 2}
                                className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap ${
                                  isOverdue || loan.renewalCount >= 2
                                    ? 'bg-[#E2DDD5] dark:bg-[#2E3330] text-[#6B655D] dark:text-[#A19B91] cursor-not-allowed'
                                    : 'bg-[#0F4C45] hover:bg-[#16655B] text-white shadow-2xs'
                                }`}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{isDv ? 'މުއްދަތު އިތުރުކުރޭ' : 'Request Renewal'}</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </HorizontalBookShelf>
                )}
              </div>

              {/* SECTION 2: READING MILESTONES & DOWNLOADABLE BILINGUAL TERM CERTIFICATE */}
              {childReadingSummary && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
                  <div className="lg:col-span-7 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <h3 className="text-sm font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                        <Award className="w-4 h-4 text-[#C26D3A]" />
                        <span>
                          {isDv ? 'ކިޔުމުގެ ކުރިއެރުމާއި ބެޖްތައް' : 'Reading Milestones & Term Progress'}
                        </span>
                      </h3>
                      <div className="flex items-center gap-3 text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
                        <span className="flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5 text-[#C26D3A]" />
                          <bdi dir="ltr" className="font-mono tabular-nums">
                            {selectedChild.readingStreakDays || 0}d
                          </bdi>{' '}
                          {isDv ? 'ސްޓްރީކް' : 'streak'}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          <bdi dir="ltr" className="font-mono tabular-nums">
                            {Math.max(selectedChild.booksCompletedCount || 0, childReadingSummary.verifiedLoans.length)}
                          </bdi>{' '}
                          {isDv ? 'ފޮތް' : 'books read'}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {childReadingSummary.badges.map((item) => (
                        <div
                          key={item.badge.id}
                          className="p-3 rounded-xl bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="font-bold text-[#1C1917] dark:text-[#F5F3EE] truncate">
                              {isDv ? item.badge.titleDv : item.badge.titleEn}
                            </span>
                            <span className={`font-mono tabular-nums text-[11px] font-bold ${item.earned ? 'text-[#15803D] dark:text-[#6EE7B7]' : 'text-[#6B655D] dark:text-[#A19B91]'}`}>
                              <bdi dir="ltr">{item.current}/{item.target}</bdi>
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-[#EFECE6] dark:bg-[#2E3330] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                item.earned ? 'bg-[#0F4C45]' : 'bg-[#C26D3A]'
                              }`}
                              style={{ width: `${item.progressPct}%` }}
                            />
                          </div>
                          <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono">
                            <bdi dir="ltr">{item.detailText}</bdi>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Bilingual Term Reading Certificate Card */}
                  <div className="lg:col-span-5 bg-[#0D2623] text-[#F7F5F0] rounded-2xl p-5 flex flex-col justify-between gap-4 border border-[#193D38]">
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-[#F3DFB1]">
                        {isDv ? 'ދެބަހުގެ ރަސްމީ ސެޓްފިކެޓް' : 'Bilingual Term Certificate'}
                      </div>
                      <h4 className={`text-lg font-extrabold text-white archival-heading ${isDv ? 'leading-[1.85]' : ''}`}>
                        {isDv
                          ? `${selectedChild.name} ގެ ފޮތްކިޔުމުގެ ސެޓްފިކެޓް`
                          : `Certificate of Reading Excellence`}
                      </h4>
                      <p className={`text-xs text-[#CBD5D1] ${isDv ? 'leading-[1.85]' : 'leading-relaxed'}`}>
                        {isDv
                          ? 'އިނގިރޭސި އަދި ދިވެހި (ތާނަ) ބަހުން ތައްޔާރުކޮށްފައިވާ A4 ސެޓްފިކެޓް ޑައުންލޯޑްކޮށް ޕްރިންޓްކުރައްވާ.'
                          : 'Generate an official bilingual (English + Thaana) reading achievement certificate for your child’s portfolio.'}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      <button
                        type="button"
                        onClick={handleDownloadCertificate}
                        className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#F7F5F0] hover:bg-white text-[#0D2623] text-xs font-extrabold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                        id="parent-download-certificate-btn"
                      >
                        <Download className="w-4 h-4 text-[#0F4C45]" />
                        <span>{isDv ? 'ސެޓްފިކެޓް ޑައުންލޯޑް' : 'Download Certificate'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handlePrintCertificate}
                        className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#16655B] hover:bg-[#1B7A6E] text-white border border-white/15 text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
                      >
                        <Printer className="w-4 h-4" />
                        <span>{isDv ? 'ޕްރިންޓް' : 'Print A4'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: MVR FINE & LOST-BOOK LEDGER */}
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <h3 className="text-sm sm:text-base font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                    <Receipt className="w-5 h-5 text-[#C26D3A]" />
                    <span>
                      {isDv ? 'ޖޫރިމަނާ އަދި ގެއްލުނު ފޮތުގެ ލެޖަރ (MVR)' : 'MVR Fine & Lost-Book Ledger'}
                    </span>
                  </h3>
                  <div className="text-xs font-bold">
                    {isDv ? 'މިހާރު ދައްކަންޖެހޭ:' : 'Current Balance:'}{' '}
                    <bdi dir="ltr" className={`font-mono tabular-nums ${childBalanceMvr > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#15803D] dark:text-[#6EE7B7]'}`}>
                      MVR {childBalanceMvr.toFixed(2)}
                    </bdi>
                  </div>
                </div>

                {childUnpaidLoans.length === 0 && childLedger.length === 0 ? (
                  <div className="p-5 bg-[#F0FDF4] dark:bg-[#0F4C45]/25 border border-[#BBF7D0] dark:border-[#16655B] rounded-2xl text-xs font-bold text-[#15803D] dark:text-[#6EE7B7] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>
                      {isDv
                        ? `${selectedChild.name} ގެ އެކައުންޓުގައި އެއްވެސް ޖޫރިމަނާއެއް ނެތެވެ (MVR 0.00).`
                        : `Account clear — MVR 0.00 unpaid fines or replacement charges for ${selectedChild.name}.`}
                    </span>
                  </div>
                ) : (
                  <div className="w-full overflow-x-auto scrollbar-thin border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl max-h-[60vh]">
                    <table className="w-full text-start text-xs">
                      <thead className="sticky top-0 z-10 bg-[#EFECE6] dark:bg-[#232724] text-[#6B655D] dark:text-[#A19B91] font-bold uppercase text-[10px] border-b border-[#E2DDD5] dark:border-[#2E3330]">
                        <tr>
                          <th className="py-2.5 px-3">{isDv ? 'ތާރީޚް' : 'Date'}</th>
                          <th className="py-2.5 px-3">{isDv ? 'ފޮތުގެ ނަން' : 'Book Title'}</th>
                          <th className="py-2.5 px-3">{isDv ? 'ބާވަތް' : 'Type'}</th>
                          <th className="py-2.5 px-3 text-end">{isDv ? 'އަދަދު (MVR)' : 'Amount (MVR)'}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330] bg-[#FFFFFF] dark:bg-[#1A1D1B]">
                        {childUnpaidLoans.map((loan) => {
                          const rem = Math.max(0, (loan.lateFee || 0) - (loan.amountPaid || 0));
                          return (
                            <tr key={`unpaid-${loan.id}`}>
                              <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B655D] dark:text-[#A19B91]">
                                <bdi dir="ltr">{loan.dueDate}</bdi>
                              </td>
                              <td className="py-2.5 px-3 font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                                <bdi>{loan.bookTitle}</bdi>
                              </td>
                              <td className="py-2.5 px-3 text-[#B91C1C] dark:text-[#FCA5A5] font-bold">
                                {isDv ? 'ދައްކަންޖެހޭ ޖޫރިމަނާ' : 'Unpaid Overdue Fine'}
                              </td>
                              <td className="py-2.5 px-3 text-end font-mono tabular-nums font-extrabold text-[#B91C1C] dark:text-[#FCA5A5]">
                                <bdi dir="ltr">MVR {rem.toFixed(2)}</bdi>
                              </td>
                            </tr>
                          );
                        })}
                        {childLedger.map((tx) => (
                          <tr key={tx.id}>
                            <td className="py-2.5 px-3 font-mono tabular-nums text-[#6B655D] dark:text-[#A19B91]">
                              <bdi dir="ltr">{tx.date}</bdi>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                              <bdi>{tx.bookTitle}</bdi>
                            </td>
                            <td className="py-2.5 px-3 text-[#6B655D] dark:text-[#A19B91]">
                              {tx.type.replace('_', ' ')}
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono tabular-nums font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                              <bdi dir="ltr">MVR {tx.amountMvr.toFixed(2)}</bdi>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* SECTION 4: PARENT BOOK RECOMMENDATIONS & WHATSAPP / SMS / EMAIL ALERTS */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Suggest a Book for Child */}
                <form
                  onSubmit={handleSubmitSuggestion}
                  className="lg:col-span-7 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-5 space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-[#C26D3A]" />
                      <span>
                        {isDv ? 'ލައިބްރަރީއަށް ފޮތެއް ލަފާދެއްވާ' : `Suggest a Book for ${selectedChild.name}`}
                      </span>
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={suggestTitle}
                      onChange={(e) => setSuggestTitle(e.target.value)}
                      placeholder={isDv ? 'ފޮތުގެ ނަން' : 'Book title (e.g. Dhivehi Stories Vol. 4)'}
                      className="px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                    />
                    <input
                      type="text"
                      value={suggestAuthor}
                      onChange={(e) => setSuggestAuthor(e.target.value)}
                      placeholder={isDv ? 'ލިޔުންތެރިޔާ (އިޚްތިޔާރީ)' : 'Author (optional)'}
                      className="px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={suggestReason}
                      onChange={(e) => setSuggestReason(e.target.value)}
                      placeholder={isDv ? 'ލަފާދޭ ސަބަބު...' : 'Why would your child enjoy or benefit from this book?'}
                      className="flex-1 px-3.5 py-2.5 bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                    />
                    <button
                      type="submit"
                      className="min-h-[42px] px-4 py-2 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{isDv ? 'ލަފާދޭ' : 'Send Recommendation'}</span>
                    </button>
                  </div>

                  {recentSuggestions.length > 0 && (
                    <div className="pt-2 border-t border-[#E2DDD5] dark:border-[#2E3330] space-y-1 text-[11px] text-[#0F4C45] dark:text-[#6EE7B7] font-medium">
                      {recentSuggestions.slice(0, 2).map((s) => (
                        <div key={s.id}>
                          ✓ Submitted “{s.title}” for {s.childName}
                        </div>
                      ))}
                    </div>
                  )}
                </form>

                {/* WhatsApp / SMS / Email Reminder Toggles */}
                <div className="lg:col-span-5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-5 space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4 className="text-sm font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                      <Bell className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
                      <span>{isDv ? 'ނޯޓިފިކޭޝަން ޗެނަލްތައް' : 'Reminder Channels'}</span>
                    </h4>
                  </div>

                  <div className="space-y-2 text-xs">
                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] cursor-pointer">
                      <span className="flex items-center gap-2 font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                        <MessageSquare className="w-3.5 h-3.5 text-[#15803D]" />
                        <span>{isDv ? 'ވަޓްސްއެޕް އެލަރޓް' : 'WhatsApp Due-Date Alerts'}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={reminderPrefs.whatsapp}
                        onChange={(e) => updateReminderPrefs({ whatsapp: e.target.checked })}
                        className="accent-[#0F4C45] w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] cursor-pointer">
                      <span className="flex items-center gap-2 font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                        <Smartphone className="w-3.5 h-3.5 text-[#C26D3A]" />
                        <span>{isDv ? 'އެސް.އެމް.އެސް ނޯޓިސް' : 'SMS Overdue Reminders'}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={reminderPrefs.sms}
                        onChange={(e) => updateReminderPrefs({ sms: e.target.checked })}
                        className="accent-[#0F4C45] w-4 h-4"
                      />
                    </label>

                    <label className="flex items-center justify-between p-2.5 rounded-xl bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] cursor-pointer">
                      <span className="flex items-center gap-2 font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                        <Mail className="w-3.5 h-3.5 text-[#0F4C45]" />
                        <span>{isDv ? 'އީމެއިލް ސަމަރީ' : 'Weekly Email Summary'}</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={reminderPrefs.email}
                        onChange={(e) => updateReminderPrefs({ email: e.target.checked })}
                        className="accent-[#0F4C45] w-4 h-4"
                      />
                    </label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={reminderPrefs.phone}
                      onChange={(e) => updateReminderPrefs({ phone: e.target.value })}
                      placeholder="+960 7785678"
                      className="flex-1 px-3 py-2 bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-mono text-[#1C1917] dark:text-[#F5F3EE]"
                    />
                    <button
                      type="button"
                      onClick={handleSavePrefsClick}
                      className="px-3.5 py-2 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                    >
                      {isDv ? 'ރައްކާކުރޭ' : 'Save'}
                    </button>
                  </div>
                </div>
              </div>

              {/* SECTION 5: RETURNED HISTORY & ONLINE RESERVATIONS */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#15803D] dark:text-[#6EE7B7]" />
                    <span>
                      {isDv
                        ? `އަނބުރާ ޙަވާލުކުރި ފޮތްތައް (${childReturnedLoans.length})`
                        : `Reading History (${childReturnedLoans.length})`}
                    </span>
                  </h3>

                  {childReturnedLoans.length === 0 ? (
                    <div className="p-4 bg-[#F7F5F0] dark:bg-[#232724] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] text-xs text-[#6B655D] dark:text-[#A19B91]">
                      {isDv ? 'ކުރީގެ ނެގުންތަކުގެ ތާރީޚެއް އަދި ނެތެވެ.' : 'No returned loans recorded yet.'}
                    </div>
                  ) : (
                    <div className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl overflow-hidden bg-[#FFFFFF] dark:bg-[#1A1D1B]">
                      {childReturnedLoans.slice(0, 6).map((loan) => (
                        <div key={loan.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE] truncate">
                              <bdi>{loan.bookTitle}</bdi>
                            </div>
                            <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums mt-0.5">
                              <bdi dir="ltr">{loan.issueDate}</bdi> → <bdi dir="ltr">{loan.returnDate || t.statusReturned}</bdi>
                            </div>
                          </div>
                          <StatusPill status="available" label={t.statusReturned} compact />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-sm font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
                    <span>
                      {isDv
                        ? `ނަންނޯޓު ކުރެވިފައިވާ ފޮތްތައް (${childReservations.length})`
                        : `Online Hold Queue (${childReservations.length})`}
                    </span>
                  </h3>

                  {childReservations.length === 0 ? (
                    <div className="p-4 bg-[#F7F5F0] dark:bg-[#232724] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] text-xs text-[#6B655D] dark:text-[#A19B91]">
                      {isDv ? 'އެއްވެސް ފޮތެއް ރިޒާވްކޮށްފައެއް ނުވެއެވެ.' : 'No active book holds for this student.'}
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {childReservations.map((res) => (
                        <div
                          key={res.id}
                          className="p-3.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE] truncate">
                              <bdi>{res.bookTitle}</bdi>
                            </div>
                            <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono mt-0.5">
                              {isDv ? 'ތާރީޚް:' : 'Requested:'} <bdi dir="ltr">{res.requestDate}</bdi>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <StatusPill status="reserved" label={res.status} compact />
                            {onCancelReservation && (
                              <button
                                type="button"
                                onClick={() => onCancelReservation(res.id)}
                                className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#FEF2F2] hover:bg-[#FEE2E2] dark:bg-[#7F1D1D]/30 text-[#B91C1C] dark:text-[#FCA5A5] border border-[#FECACA] dark:border-[#B91C1C]/60 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{isDv ? 'ކެންސަލް' : 'Cancel'}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-8 rounded-3xl border border-[#E2DDD5] dark:border-[#2E3330] text-center space-y-3 shadow-xs">
          <Users className="w-10 h-10 text-[#6B655D] dark:text-[#A19B91] mx-auto" />
          <h3 className="text-lg font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
            {isDv ? 'އެއްވެސް ދަރިވަރަކު ގުޅިފައެއް ނުވޭ' : 'No Children Linked Yet'}
          </h3>
          <p className="text-xs text-[#6B655D] dark:text-[#A19B91] max-w-sm mx-auto">
            {isDv
              ? '"ދަރިވަރަކު ގުޅުވާ" އަށް ފިތާލައްވައި ދަރިވަރުގެ އެކައުންޓް އިތުރުކުރައްވާ.'
              : 'Click "Add Child Account" to link your children to this guardian reading dashboard.'}
          </p>
          <button
            type="button"
            onClick={() => setShowAddChildModal(true)}
            className="min-h-[44px] bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition cursor-pointer"
          >
            {isDv ? 'ދަރިވަރަކު އިތުރުކުރޭ' : 'Add Child Account'}
          </button>
        </div>
      )}

      {/* ADD CHILD MODAL */}
      {showAddChildModal && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddChildModal(false);
          }}
        >
          <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#E2DDD5] dark:border-[#2E3330] space-y-4">
            <div className="flex items-center justify-between border-b pb-3 border-[#E2DDD5] dark:border-[#2E3330]">
              <h3 className="text-base font-extrabold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-[#0F4C45] dark:text-[#6EE7B7]" />
                <span>{isDv ? 'ދަރިވަރުގެ އެކައުންޓް އިތުރުކުރޭ' : 'Add Student Child Account'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowAddChildModal(false)}
                className="text-[#6B655D] hover:text-[#1C1917] dark:hover:text-white font-bold text-sm cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateChildAccount} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1">
                  {isDv ? 'ދަރިވަރުގެ ފުރިހަމަ ނަން' : 'Student Full Name'}
                </label>
                <input
                  type="text"
                  required
                  value={newChildName}
                  onChange={(e) => setNewChildName(e.target.value)}
                  placeholder="e.g. Aishath Ayaan"
                  className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#1C1917] dark:text-[#F5F3EE] font-medium focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                  id="add-child-name-input"
                />
              </div>

              <div>
                <label className="block font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1">
                  {isDv ? 'ގްރޭޑް' : 'Grade Level'}
                </label>
                <select
                  value={newChildGrade}
                  onChange={(e) => setNewChildGrade(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#1C1917] dark:text-[#F5F3EE] font-bold focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                  id="add-child-grade-select"
                >
                  {['Kindergarten', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'].map(
                    (g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block font-bold text-[#1C1917] dark:text-[#F5F3EE] mb-1">
                  {isDv ? 'ދަރިވަރުގެ އިންޑެކްސް ނަންބަރު' : 'Student Index Code'}
                </label>
                <input
                  type="text"
                  required
                  value={newChildIdCode}
                  onChange={(e) => setNewChildIdCode(e.target.value)}
                  placeholder="STU-2045"
                  className="w-full px-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#1C1917] dark:text-[#F5F3EE] font-mono font-bold focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                  id="add-child-id-input"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-[#E2DDD5] dark:border-[#2E3330]">
                <button
                  type="button"
                  onClick={() => setShowAddChildModal(false)}
                  className="px-4 py-2 bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] rounded-xl font-bold border border-[#E2DDD5] dark:border-[#2E3330] cursor-pointer"
                >
                  {isDv ? 'ކެންސަލް' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold rounded-xl cursor-pointer"
                >
                  {isDv ? 'ރައްކާކުރޭ' : 'Save Child Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REMOVE CHILD CONFIRMATION MODAL */}
      {childToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setChildToDelete(null);
          }}
        >
          <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl shadow-2xl max-w-md w-full p-6 border border-[#E2DDD5] dark:border-[#2E3330] space-y-4">
            <div className="flex items-center gap-3 text-[#B91C1C]">
              <div className="w-10 h-10 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#B91C1C]/60 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-[#1C1917] dark:text-[#F5F3EE]">
                  {isDv ? 'ދަރިވަރު ވަކިކުރޭ' : 'Remove Student Account'}
                </h3>
                <p className="text-xs text-[#6B655D] dark:text-[#A19B91]">
                  {isDv ? 'ބެލެނިވެރިޔާގެ ޕްރޮފައިލުން ވަކިކުރުން' : 'Unlink from Guardian Profile'}
                </p>
              </div>
            </div>

            <p className="text-xs text-[#1C1917] dark:text-[#F5F3EE] leading-relaxed bg-[#F7F5F0] dark:bg-[#232724] p-3.5 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
              {isDv
                ? `${childToDelete.name} (${childToDelete.grade}) ގެ އެކައުންޓް ވަކިކުރައްވަންތޯ؟`
                : `Are you sure you want to unlink ${childToDelete.name} (${childToDelete.grade}) from your guardian dashboard?`}
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E2DDD5] dark:border-[#2E3330]">
              <button
                type="button"
                onClick={() => setChildToDelete(null)}
                className="px-4 py-2 bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] font-bold text-xs rounded-xl cursor-pointer"
              >
                {isDv ? 'ކެންސަލް' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteUser) onDeleteUser(childToDelete.id);
                  setChildToDelete(null);
                }}
                className="px-4 py-2 bg-[#B91C1C] hover:bg-[#991B1B] text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                id="confirm-remove-child-btn"
              >
                <Trash2 className="w-4 h-4" />
                <span>{isDv ? 'ޔަޤީން' : 'Confirm Remove'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
