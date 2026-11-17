import React, { useState, useMemo } from 'react';
import {
  Shield, Plus, Edit2, Trash2, Printer, DollarSign, Settings, Users,
  BookOpen, CheckCircle, QrCode, FileSpreadsheet, Mail, Send,
  Smartphone, BellRing, Zap, Database, Activity, RefreshCw, Download,
  Eye, Layers, X, Calendar, FileText, CreditCard, ShieldCheck
} from 'lucide-react';
import {
  AuditLogEntry, Book, BookCopy, UserProfile, Loan, LibrarySettings, LedgerTransaction,
  LedgerTransactionType, PatronTierPolicy
} from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { usePermission } from '../hooks/usePermission';
import { testFirestoreConnection, resetQuotaStatus } from '../lib/firebase';
import { generateCode128Bars, generateQrMatrix } from '../lib/barcodeSvg';
import { DEFAULT_MALDIVES_SCHOOL_HOLIDAYS } from '../lib/schoolCalendar';
import { analyzeCatalogHealth } from '../lib/catalogHealth';
import { BookCoverFallback } from './BookCoverFallback';
import {
  printBarcodeStickerSheet,
  buildStickerItemsFromBooks,
  printMemberIdCards,
  printMonthlyReconciliationReport,
  BarcodeLabelStyle
} from '../lib/printableLabels';

interface AdminPanelProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  settings: LibrarySettings;
  ledgerTransactions?: LedgerTransaction[];
  immutableAuditLogs?: AuditLogEntry[];
  currentUser?: UserProfile;
  currentUserName?: string;
  isQuotaExhausted?: boolean;
  onAddBook: (book: Omit<Book, 'id'>) => void;
  onUpdateBook: (id: string, data: Partial<Book>) => void;
  onDeleteBook: (id: string) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateSettings: (newSettings: Partial<LibrarySettings>) => void;
  onMarkFeePaid: (loanId: string, paidAmount?: number) => void;
  onWaiveFee?: (loanId: string, reason: string) => void;
  onRecordLedgerTransaction?: (tx: Omit<LedgerTransaction, 'id'>) => Promise<void>;
  onOpenAddParentModal?: () => void;
  onOpenImportModal?: (type?: 'books' | 'parents') => void;
  onOpenReportCardSyncModal?: () => void;
  onOpenSecuritySuite?: () => void;
  onOpenCatalogHealth?: () => void;
}

const SvgSpineBarcode: React.FC<{ code: string }> = ({ code }) => {
  const { bars, totalWidth } = generateCode128Bars(code);
  return (
    <svg viewBox={`0 0 ${totalWidth} 44`} className="w-full max-w-[220px] h-11 mx-auto" role="img" aria-label={`Barcode ${code}`}>
      <rect width={totalWidth} height={44} fill="#ffffff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y={2} width={b.width} height={40} fill="#0f172a" />
      ))}
    </svg>
  );
};

const SvgQrCode: React.FC<{ code: string; size?: number }> = ({ code, size = 64 }) => {
  const matrix = generateQrMatrix(code, 21);
  const cell = 2;
  const dim = matrix.length * cell;
  return (
    <svg
      viewBox={`0 0 ${dim} ${dim}`}
      style={{ width: size, height: size }}
      className="mx-auto bg-white rounded"
      role="img"
      aria-label={`QR ${code}`}
    >
      <rect width={dim} height={dim} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((filled, c) =>
          filled ? <rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill="#0f172a" /> : null
        )
      )}
    </svg>
  );
};

export const AdminPanel: React.FC<AdminPanelProps> = ({
  books,
  users,
  loans,
  settings,
  ledgerTransactions = [],
  immutableAuditLogs = [],
  currentUser,
  currentUserName = 'Head Librarian',
  isQuotaExhausted = false,
  onAddBook,
  onUpdateBook,
  onDeleteBook,
  onDeleteUser,
  onUpdateSettings,
  onMarkFeePaid,
  onWaiveFee,
  onRecordLedgerTransaction,
  onOpenAddParentModal,
  onOpenImportModal,
  onOpenReportCardSyncModal,
  onOpenSecuritySuite,
  onOpenCatalogHealth
}) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const effectiveUser = useMemo(
    () =>
      currentUser ||
      ({
        id: 'admin-context',
        name: currentUserName,
        email: '',
        role: 'admin',
        accessRole: 'super_admin',
        createdAt: '',
      } as UserProfile),
    [currentUser, currentUserName]
  );
  const { can, accessRole, cannotReason } = usePermission(effectiveUser);
  const [activeTab, setActiveTab] = useState<'inventory' | 'late-fees' | 'barcode-labels' | 'users' | 'settings' | 'audit-logs'>('inventory');

  // Bulk Selection & Inline Confirmation States (no native confirm())
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);
  const [confirmBulkDeleteBooks, setConfirmBulkDeleteBooks] = useState(false);
  const [inspectedBookId, setInspectedBookId] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Fine Waive & Payment Modal State
  const [ledgerFilter, setLedgerFilter] = useState<'all' | 'unpaid' | 'paid' | 'waived'>('all');
  const [ledgerMonthFilter, setLedgerMonthFilter] = useState<string>('ALL');
  const [waivingLoan, setWaivingLoan] = useState<Loan | null>(null);
  const [waiveReason, setWaiveReason] = useState('Medical absence / Authorized sick leave');
  const [waiveCustomNote, setWaiveCustomNote] = useState('');
  const [isWaiving, setIsWaiving] = useState(false);

  const [settlingLoan, setSettlingLoan] = useState<Loan | null>(null);
  const [settleType, setSettleType] = useState<LedgerTransactionType>('payment');
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [settleNotes, setSettleNotes] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  // Quota Status Diagnostics State
  const [isTestingQuota, setIsTestingQuota] = useState(false);
  const [quotaTestResult, setQuotaTestResult] = useState<{
    healthy: boolean;
    writeQuotaAvailable: boolean;
    latencyMs: number;
    message: string;
    details?: string;
  } | null>(null);

  const handleRunQuotaTest = async () => {
    setIsTestingQuota(true);
    try {
      const res = await testFirestoreConnection();
      setQuotaTestResult(res);
    } catch (e: any) {
      setQuotaTestResult({
        healthy: false,
        writeQuotaAvailable: false,
        latencyMs: 0,
        message: 'Error executing quota diagnostics: ' + (e?.message || String(e))
      });
    } finally {
      setIsTestingQuota(false);
    }
  };

  const fetchAuditLogs = async () => {
    if (!can('audit:view')) {
      toast.error(cannotReason('audit:view'), 'RBAC Restricted');
      return;
    }
    setIsLoadingAuditLogs(true);
    try {
      const res = await fetch('/api/audit-logs?limit=150', {
        headers: {
          'x-user-role': effectiveUser.role || 'admin',
          'x-access-role': accessRole,
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch (e) {
      console.warn('Failed to fetch audit logs:', e);
    } finally {
      setIsLoadingAuditLogs(false);
    }
  };

  const handleExportCsv = (booksToExport: Book[] = books) => {
    const headers = ['ID', 'Title', 'Author', 'ISBN', 'Barcode', 'Category', 'DDC', 'Language', 'Total Copies', 'Available Copies', 'Shelf Location', 'Is Reference'];
    const rows = booksToExport.map(b => [
      `"${b.id}"`,
      `"${(b.title || '').replace(/"/g, '""')}"`,
      `"${(b.author || '').replace(/"/g, '""')}"`,
      `"${b.isbn || ''}"`,
      `"${b.barcode || ''}"`,
      `"${b.category || ''}"`,
      `"${b.ddcCallNumber || ''}"`,
      `"${b.bookLanguage || 'English'}"`,
      b.totalCopies || 1,
      b.availableCopies || 0,
      `"${b.shelfLocation || ''}"`,
      b.isReferenceOnly ? 'YES' : 'NO'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `magoodhoo-library-inventory-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportLedgerCsv = () => {
    const headers = ['Transaction ID', 'Date', 'Patron', 'Book Title', 'Type', 'Amount (MVR)', 'Processed By', 'Notes'];
    const rows = ledgerTransactions.map(tx => [
      `"${tx.id}"`,
      `"${tx.date}"`,
      `"${(tx.userName || '').replace(/"/g, '""')}"`,
      `"${(tx.bookTitle || '').replace(/"/g, '""')}"`,
      `"${tx.type}"`,
      (tx.amountMvr || 0).toFixed(2),
      `"${(tx.processedBy || '').replace(/"/g, '""')}"`,
      `"${(tx.notes || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `magoodhoo-mvr-ledger-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('MVR financial reconciliation CSV exported.', 'Ledger Export');
  };

  const handleExportLedgerJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      currency: 'MVR',
      summary: ledgerSummary,
      transactions: ledgerTransactions
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `magoodhoo-mvr-ledger-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('MVR financial ledger JSON exported.', 'Ledger Export');
  };

  const handleBulkToggleReference = (isRef: boolean) => {
    selectedBookIds.forEach(id => {
      onUpdateBook(id, { isReferenceOnly: isRef });
    });
    toast.success(`Updated ${selectedBookIds.length} book(s) circulation mode.`, 'Bulk Inventory Update');
    setSelectedBookIds([]);
  };

  const handleBulkDeleteBooks = () => {
    if (!can('catalog:delete')) {
      toast.error(cannotReason('catalog:delete'), 'RBAC Restricted');
      return;
    }
    selectedBookIds.forEach(id => onDeleteBook(id));
    setSelectedBookIds([]);
    setConfirmBulkDeleteBooks(false);
  };

  const handleBulkMarkReturned = async () => {
    if (selectedLoanIds.length === 0) return;
    for (const loanId of selectedLoanIds) {
      try {
        await fetch('/api/circulation/return', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-user-role': effectiveUser.role || 'admin',
            'x-access-role': accessRole,
          },
          body: JSON.stringify({ loanId })
        });
        onMarkFeePaid(loanId);
      } catch (e) {
        console.warn('Failed returning loan:', e);
      }
    }
    toast.success(`Marked ${selectedLoanIds.length} loan(s) as settled/returned.`, 'Bulk Return');
    setSelectedLoanIds([]);
  };

  const handleBulkWaiveFees = () => {
    if (!can('fines:waive')) {
      toast.error(cannotReason('fines:waive'), 'RBAC Restricted');
      return;
    }
    if (selectedLoanIds.length === 0) return;
    selectedLoanIds.forEach(loanId => {
      if (onWaiveFee) onWaiveFee(loanId, 'Bulk administrative fee waiver');
    });
    setSelectedLoanIds([]);
  };

  // Add/Edit Book Modal Fields
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Classic Literature');
  const [isReferenceOnly, setIsReferenceOnly] = useState(false);
  const [totalCopies, setTotalCopies] = useState(3);
  const [shelfLocation, setShelfLocation] = useState('Fiction - Aisle 1');
  const [coverUrl, setCoverUrl] = useState('/covers/classic_literature.jpg');
  const [description, setDescription] = useState('');
  const [publisher, setPublisher] = useState('Scholastic');
  const [publicationYear, setPublicationYear] = useState(2022);

  // Print Label & Member ID Studio Selection
  const [studioMode, setStudioMode] = useState<'books' | 'members'>('books');
  const [labelStyle, setLabelStyle] = useState<BarcodeLabelStyle>('both');
  const [selectedLabelBook, setSelectedLabelBook] = useState<Book | null>(books[0] || null);
  const [selectedCopyBarcode, setSelectedCopyBarcode] = useState<string>('');
  const [memberRoleFilter, setMemberRoleFilter] = useState<'all' | 'student' | 'staff'>('all');
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [includeMemberQr, setIncludeMemberQr] = useState(true);

  // Policy Settings State
  const [policyMaxBorrowDays, setPolicyMaxBorrowDays] = useState(settings.maxBorrowDays || 14);
  const [policyLateFeeRate, setPolicyLateFeeRate] = useState(settings.lateFeePerDay || 2.00);
  const [policyMaxRenewals, setPolicyMaxRenewals] = useState(settings.maxRenewals || 2);
  const [policyMaxBooksStudent, setPolicyMaxBooksStudent] = useState(settings.maxBooksPerStudent || 3);
  const [policyGracePeriodDays, setPolicyGracePeriodDays] = useState(settings.gracePeriodDays ?? 2);
  const [policyMaxBooksStaff, setPolicyMaxBooksStaff] = useState(settings.maxBooksPerStaff ?? 7);
  const [policyStaffBorrowDays, setPolicyStaffBorrowDays] = useState(settings.staffBorrowDays ?? 30);
  const [policyMaxActiveReservations, setPolicyMaxActiveReservations] = useState(settings.maxActiveReservations ?? 2);
  const [policyHoldExpiryDays, setPolicyHoldExpiryDays] = useState(settings.holdExpiryDays ?? 3);
  const [policyLostBookReplacementFee, setPolicyLostBookReplacementFee] = useState(settings.lostBookReplacementFee ?? 150.00);
  const [policyAllowRefCheckoutStaff, setPolicyAllowRefCheckoutStaff] = useState(settings.allowReferenceCheckoutForStaff ?? true);
  const [policyMaxOverdueFineCap, setPolicyMaxOverdueFineCap] = useState(settings.maxOverdueFineCap ?? 100.00);
  const [policyBlockBorrowingFineThreshold, setPolicyBlockBorrowingFineThreshold] = useState(settings.blockBorrowingFineThreshold ?? 30.00);
  const [policyAllowRecallRequests, setPolicyAllowRecallRequests] = useState(settings.allowRecallRequests ?? true);
  const [policyHolidayGraceDays, setPolicyHolidayGraceDays] = useState(settings.holidayGraceDays ?? true);
  const [policySchoolHolidays, setPolicySchoolHolidays] = useState<string[]>(settings.schoolHolidays || DEFAULT_MALDIVES_SCHOOL_HOLIDAYS);
  const [newHolidayDate, setNewHolidayDate] = useState<string>('');
  const [policySummerVacationCheckout, setPolicySummerVacationCheckout] = useState(settings.summerVacationCheckout ?? false);
  const [policyAutoEmailRemindersDaysBefore, setPolicyAutoEmailRemindersDaysBefore] = useState(settings.autoEmailRemindersDaysBefore ?? 2);
  const [policyDamagedBookMinorFee, setPolicyDamagedBookMinorFee] = useState(settings.damagedBookMinorFee ?? 15.00);
  const [policyNoteText, setPolicyNoteText] = useState(settings.policyNote || 'Books must be returned in good condition. MVR fines apply daily after grace period.');
  const [policyAlertEmail, setPolicyAlertEmail] = useState(settings.alertEmail || 'library-alerts@fmagoodhooschool.edu.mv');
  const [policyAlertSmsNumber, setPolicyAlertSmsNumber] = useState(settings.alertSmsNumber || '+9607771111');
  const [policyEnableAutoDueDateAlerts, setPolicyEnableAutoDueDateAlerts] = useState(settings.enableAutoDueDateAlerts ?? true);
  const [policyNotifyParentOnOverdue, setPolicyNotifyParentOnOverdue] = useState(settings.notifyParentOnOverdue ?? true);
  const [policyTierRules, setPolicyTierRules] = useState<Record<'student' | 'teacher' | 'staff' | 'external', PatronTierPolicy>>(
    settings.patronTierRules || {
      student: { maxBooks: 3, loanDays: 14, maxRenewals: 2, dailyFineMvr: 2.0, graceDays: 2, allowReferenceCheckout: false },
      teacher: { maxBooks: 8, loanDays: 30, maxRenewals: 3, dailyFineMvr: 1.0, graceDays: 5, allowReferenceCheckout: true },
      staff: { maxBooks: 7, loanDays: 30, maxRenewals: 3, dailyFineMvr: 1.0, graceDays: 5, allowReferenceCheckout: true },
      external: { maxBooks: 2, loanDays: 10, maxRenewals: 1, dailyFineMvr: 3.0, graceDays: 1, allowReferenceCheckout: false },
    }
  );
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  React.useEffect(() => {
    if (settings) {
      if (settings.maxBorrowDays !== undefined) setPolicyMaxBorrowDays(settings.maxBorrowDays);
      if (settings.lateFeePerDay !== undefined) setPolicyLateFeeRate(settings.lateFeePerDay);
      if (settings.maxRenewals !== undefined) setPolicyMaxRenewals(settings.maxRenewals);
      if (settings.maxBooksPerStudent !== undefined) setPolicyMaxBooksStudent(settings.maxBooksPerStudent);
      if (settings.gracePeriodDays !== undefined) setPolicyGracePeriodDays(settings.gracePeriodDays);
      if (settings.maxBooksPerStaff !== undefined) setPolicyMaxBooksStaff(settings.maxBooksPerStaff);
      if (settings.staffBorrowDays !== undefined) setPolicyStaffBorrowDays(settings.staffBorrowDays);
      if (settings.maxActiveReservations !== undefined) setPolicyMaxActiveReservations(settings.maxActiveReservations);
      if (settings.holdExpiryDays !== undefined) setPolicyHoldExpiryDays(settings.holdExpiryDays);
      if (settings.lostBookReplacementFee !== undefined) setPolicyLostBookReplacementFee(settings.lostBookReplacementFee);
      if (settings.allowReferenceCheckoutForStaff !== undefined) setPolicyAllowRefCheckoutStaff(settings.allowReferenceCheckoutForStaff);
      if (settings.maxOverdueFineCap !== undefined) setPolicyMaxOverdueFineCap(settings.maxOverdueFineCap);
      if (settings.blockBorrowingFineThreshold !== undefined) setPolicyBlockBorrowingFineThreshold(settings.blockBorrowingFineThreshold);
      if (settings.allowRecallRequests !== undefined) setPolicyAllowRecallRequests(settings.allowRecallRequests);
      if (settings.holidayGraceDays !== undefined) setPolicyHolidayGraceDays(settings.holidayGraceDays);
      if (settings.schoolHolidays) setPolicySchoolHolidays(settings.schoolHolidays);
      if (settings.summerVacationCheckout !== undefined) setPolicySummerVacationCheckout(settings.summerVacationCheckout);
      if (settings.autoEmailRemindersDaysBefore !== undefined) setPolicyAutoEmailRemindersDaysBefore(settings.autoEmailRemindersDaysBefore);
      if (settings.damagedBookMinorFee !== undefined) setPolicyDamagedBookMinorFee(settings.damagedBookMinorFee);
      if (settings.policyNote) setPolicyNoteText(settings.policyNote);
      if (settings.alertEmail) setPolicyAlertEmail(settings.alertEmail);
      if (settings.alertSmsNumber) setPolicyAlertSmsNumber(settings.alertSmsNumber);
      if (settings.enableAutoDueDateAlerts !== undefined) setPolicyEnableAutoDueDateAlerts(settings.enableAutoDueDateAlerts);
      if (settings.notifyParentOnOverdue !== undefined) setPolicyNotifyParentOnOverdue(settings.notifyParentOnOverdue);
      if (settings.patronTierRules) setPolicyTierRules(settings.patronTierRules);
    }
  }, [settings]);

  // Overdue Dispatch State
  const [dispatchStatusMessage, setDispatchStatusMessage] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState<string | null>(null);

  const handleDispatchOverdueAlert = async (loan: Loan, channel: 'email' | 'sms' | 'both' = 'both') => {
    setIsDispatching(loan.id);
    setDispatchStatusMessage(null);

    const borrowerUser = users.find(u => u.id === loan.userId);
    const parentUser = users.find(u => u.id === borrowerUser?.parentId || u.childrenIds?.includes(loan.userId));
    const recipientEmail = borrowerUser?.email || settings.alertEmail || 'library-alerts@fmagoodhooschool.edu.mv';
    const recipientPhone = borrowerUser?.phone || settings.alertSmsNumber || '+9607771111';

    const todayStr = new Date().toISOString().split('T')[0];
    const todayDate = new Date(todayStr + 'T00:00:00Z').getTime();
    const dueDate = new Date(loan.dueDate + 'T00:00:00Z').getTime();
    const daysOverdue = Math.max(1, Math.round((todayDate - dueDate) / (1000 * 3600 * 24)));

    try {
      const res = await fetch('/api/notifications/send-overdue-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId: loan.id,
          recipientEmail,
          recipientPhone,
          recipientName: loan.userName,
          bookTitle: loan.bookTitle,
          dueDate: loan.dueDate,
          daysOverdue,
          lateFee: loan.lateFee,
          channel,
          language
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const parentNotice = policyNotifyParentOnOverdue && parentUser?.email ? ` (Copy forwarded to Parent: ${parentUser.email})` : '';
        setDispatchStatusMessage(
          language === 'dv'
            ? `"${loan.bookTitle}" އަށް މުއްދަތު ހަމަވިކަމުގެ އިންޒާރު ފޮނުވިއްޖެ! (${data.recipientEmail})${parentNotice}`
            : `Overdue alert dispatched to ${loan.userName} (${data.recipientEmail}) & admin (${policyAlertEmail}).${parentNotice}`
        );
      } else {
        setDispatchStatusMessage(`Error: ${data.error || 'Failed to dispatch alert.'}`);
      }
    } catch (err: any) {
      setDispatchStatusMessage(`Gateway error: ${err.message}`);
    } finally {
      setIsDispatching(null);
    }
  };

  const openNewBookModal = () => {
    setEditingBookId(null);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setBarcode('');
    setCategory('Classic Literature');
    setIsReferenceOnly(false);
    setTotalCopies(3);
    setShelfLocation('Fiction - Aisle 1');
    setCoverUrl('/covers/classic_literature.jpg');
    setDescription('');
    setPublisher('Scholastic');
    setPublicationYear(2022);
    setShowBookModal(true);
  };

  const openEditBookModal = (book: Book) => {
    setEditingBookId(book.id);
    setTitle(book.title);
    setAuthor(book.author);
    setIsbn(book.isbn);
    setBarcode(book.barcode);
    setCategory(book.category);
    setIsReferenceOnly(book.isReferenceOnly);
    setTotalCopies(book.totalCopies);
    setShelfLocation(book.shelfLocation);
    setCoverUrl(book.coverUrl);
    setDescription(book.description);
    setPublisher(book.publisher);
    setPublicationYear(book.publicationYear);
    setShowBookModal(true);
  };

  const handleSaveBook = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) return;

    const bookData = {
      title: title.trim(),
      author: author.trim(),
      isbn: isbn.trim() || `978${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      barcode: barcode.trim() || isbn.trim() || `MAG-${Math.floor(1000 + Math.random() * 9000)}`,
      category,
      isReferenceOnly,
      totalCopies: Number(totalCopies),
      availableCopies: Number(totalCopies),
      shelfLocation: shelfLocation.trim(),
      coverUrl: coverUrl.trim() || '/covers/classic_literature.jpg',
      description: description.trim(),
      publisher: publisher.trim(),
      publicationYear: Number(publicationYear),
      addedAt: new Date().toISOString().split('T')[0],
    };

    if (editingBookId) {
      onUpdateBook(editingBookId, bookData);
    } else {
      onAddBook(bookData);
    }
    setShowBookModal(false);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateSettings({
      maxBorrowDays: policyMaxBorrowDays,
      lateFeePerDay: policyLateFeeRate,
      maxRenewals: policyMaxRenewals,
      maxBooksPerStudent: policyMaxBooksStudent,
      gracePeriodDays: policyGracePeriodDays,
      maxBooksPerStaff: policyMaxBooksStaff,
      staffBorrowDays: policyStaffBorrowDays,
      maxActiveReservations: policyMaxActiveReservations,
      holdExpiryDays: policyHoldExpiryDays,
      lostBookReplacementFee: policyLostBookReplacementFee,
      allowReferenceCheckoutForStaff: policyAllowRefCheckoutStaff,
      maxOverdueFineCap: policyMaxOverdueFineCap,
      blockBorrowingFineThreshold: policyBlockBorrowingFineThreshold,
      allowRecallRequests: policyAllowRecallRequests,
      holidayGraceDays: policyHolidayGraceDays,
      schoolHolidays: policySchoolHolidays,
      summerVacationCheckout: policySummerVacationCheckout,
      autoEmailRemindersDaysBefore: policyAutoEmailRemindersDaysBefore,
      damagedBookMinorFee: policyDamagedBookMinorFee,
      policyNote: policyNoteText,
      alertEmail: policyAlertEmail,
      alertSmsNumber: policyAlertSmsNumber,
      enableAutoDueDateAlerts: policyEnableAutoDueDateAlerts,
      notifyParentOnOverdue: policyNotifyParentOnOverdue,
      patronTierRules: policyTierRules,
    });
    setSettingsSavedMessage(true);
    setTimeout(() => setSettingsSavedMessage(false), 3000);
  };

  const allFineLoans = useMemo(() => {
    return loans.filter(
      l =>
        l.status === 'overdue' ||
        (l.lateFee || 0) > 0 ||
        (l.amountPaid || 0) > 0 ||
        (l.waivedAmount || 0) > 0 ||
        Boolean(l.waivedReason)
    );
  }, [loans]);

  const overdueLoans = useMemo(
    () => allFineLoans.filter(l => !l.feePaid && (l.status === 'overdue' || Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)) > 0)),
    [allFineLoans]
  );

  const filteredFineLoans = useMemo(() => {
    return allFineLoans.filter(l => {
      const isWaived = Boolean(l.waivedReason) || (l.waivedAmount || 0) > 0;
      const remaining = Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0));
      const isPaid = !isWaived && (l.feePaid || ((l.amountPaid || 0) > 0 && remaining <= 0));
      const isUnpaid = !isWaived && !isPaid;
      if (ledgerFilter === 'unpaid') return isUnpaid;
      if (ledgerFilter === 'paid') return isPaid;
      if (ledgerFilter === 'waived') return isWaived;
      return true;
    });
  }, [allFineLoans, ledgerFilter]);

  const availableLedgerMonths = useMemo(() => {
    const months = new Set<string>();
    ledgerTransactions.forEach(tx => {
      if (tx.date && tx.date.length >= 7) months.add(tx.date.slice(0, 7));
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [ledgerTransactions]);

  const filteredLedgerTransactions = useMemo(() => {
    if (ledgerMonthFilter === 'ALL') return ledgerTransactions;
    return ledgerTransactions.filter(tx => (tx.date || '').startsWith(ledgerMonthFilter));
  }, [ledgerTransactions, ledgerMonthFilter]);

  const ledgerSummary = useMemo(() => {
    const unpaidMvr = overdueLoans.filter(l => !l.feePaid).reduce((s, l) => s + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);
    const collectedMvr = filteredLedgerTransactions
      .filter(tx => tx.type === 'payment' || tx.type === 'partial_payment' || tx.type === 'lost_replacement')
      .reduce((s, tx) => s + (tx.amountMvr || 0), 0);
    const waivedMvr = filteredLedgerTransactions
      .filter(tx => tx.type === 'waiver')
      .reduce((s, tx) => s + (tx.amountMvr || 0), 0);
    return { unpaidMvr, collectedMvr, waivedMvr };
  }, [overdueLoans, filteredLedgerTransactions]);

  const studioMembers = useMemo(() => {
    return users.filter(u => {
      if (memberRoleFilter === 'student') return u.role === 'student';
      if (memberRoleFilter === 'staff') return u.role === 'staff' || u.role === 'admin';
      return u.role !== 'parent';
    });
  }, [users, memberRoleFilter]);

  const handleConfirmSettlement = async () => {
    if (!settlingLoan || isSettling) return;
    setIsSettling(true);
    const effectiveAmount = Math.max(0, Number(settleAmount) || 0);
    try {
      if (onRecordLedgerTransaction) {
        await onRecordLedgerTransaction({
          loanId: settlingLoan.id,
          userId: settlingLoan.userId,
          userName: settlingLoan.userName,
          bookTitle: settlingLoan.bookTitle,
          type: settleType,
          amountMvr: effectiveAmount,
          date: new Date().toISOString().split('T')[0],
          notes: settleNotes || (settleType === 'lost_replacement' ? 'Lost book replacement fee settled' : settleType === 'partial_payment' ? 'Partial installment recorded at circulation desk' : 'Settled in full at circulation desk'),
          processedBy: currentUserName
        });
      }
      onMarkFeePaid(settlingLoan.id, effectiveAmount);
      setSettlingLoan(null);
      setSettleNotes('');
    } finally {
      setIsSettling(false);
    }
  };

  const activeLabelBarcode = selectedCopyBarcode || selectedLabelBook?.barcode || '';
  const inspectedBook = inspectedBookId ? books.find(b => b.id === inspectedBookId) || null : null;

  const handleUpdateBookCopy = (book: Book, copyId: string, patch: Partial<BookCopy>) => {
    const updatedCopies = (book.copies || []).map(cp =>
      cp.copyId === copyId ? { ...cp, ...patch } : cp
    );
    const availableCount = updatedCopies.filter(c => c.status === 'Available').length;
    onUpdateBook(book.id, {
      copies: updatedCopies,
      availableCopies: availableCount,
    });
    toast.success('Updated physical copy metadata.', 'Copy Inventory');
  };

  const catalogHealthScore = useMemo(() => analyzeCatalogHealth(books).healthScore, [books]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-800 shadow-sm no-print flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="max-w-3xl space-y-1.5">
          <div className="inline-flex items-center gap-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> {t.adminInventory}
          </div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
            {t.adminInventory}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {language === 'dv'
              ? 'ފޮތްތައް އިތުރުކުރުމާއި، ބާކޯޑް ޕްރިންޓްކުރުމާއި، MVR ޖޫރިމަނާ ލެޖަރ އަދި ލައިބްރަރީ އުޞޫލުތައް ބެލެހެއްޓެވުން.'
              : 'Manage MARC catalog inventory, print Code-128 spine labels, reconcile MVR financial ledgers, and set school circulation policies.'}
          </p>
        </div>

        {onOpenSecuritySuite && can('users:manage_roles') && (
          <button
            type="button"
            onClick={onOpenSecuritySuite}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold transition flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer border border-slate-700"
          >
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>{language === 'dv' ? 'RBAC، ނޯޓިސް & ބެކަޕް' : 'RBAC, Notices & Backup Suite'}</span>
          </button>
        )}
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-1.5 shadow-sm overflow-x-auto scrollbar-none no-print">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'inventory' ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="admin-inventory-tab"
        >
          <BookOpen className="w-4 h-4" /> {language === 'dv' ? 'އިންވެންޓްރީ' : 'Inventory'} (<bdi className="font-mono tabular-nums">{books.length}</bdi>)
        </button>

        <button
          onClick={() => setActiveTab('late-fees')}
          className={`flex-1 min-w-[150px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'late-fees' ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="admin-late-fees-tab"
        >
          <DollarSign className="w-4 h-4" /> {t.financialLedger} (<bdi className="font-mono tabular-nums">{overdueLoans.length}</bdi>)
        </button>

        <button
          onClick={() => setActiveTab('barcode-labels')}
          className={`flex-1 min-w-[140px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'barcode-labels' ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="admin-barcode-tab"
        >
          <QrCode className="w-4 h-4" /> {language === 'dv' ? 'ބާކޯޑް ލޭބަލް' : 'Barcode Labels'}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'users' ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="admin-users-tab"
        >
          <Users className="w-4 h-4" /> {language === 'dv' ? 'މެންބަރުން' : 'Members'} (<bdi className="font-mono tabular-nums">{users.length}</bdi>)
        </button>

        {can('policies:edit') && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'settings' ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="admin-settings-tab"
          >
            <Settings className="w-4 h-4" /> {language === 'dv' ? 'އުޞޫލުތައް' : 'Policies'}
          </button>
        )}

        {can('audit:view') && (
          <button
            onClick={() => {
              setActiveTab('audit-logs');
              if (auditLogs.length === 0) fetchAuditLogs();
            }}
            className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
              activeTab === 'audit-logs' ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800'
            }`}
            id="admin-audit-logs-tab"
          >
            <Activity className="w-4 h-4" /> {language === 'dv' ? 'އޮޑިޓް ލޮގް' : 'Audit Log'}
          </button>
        )}
      </div>

      {/* TAB 1: INVENTORY MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">Manage Cataloged Books</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Add, edit, bulk import, export CSV, or run AI catalog health audit</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {onOpenCatalogHealth && can('catalog:create_edit') && (
                <button
                  type="button"
                  onClick={onOpenCatalogHealth}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>Catalog Health (<bdi className="font-mono">{catalogHealthScore}%</bdi>)</span>
                </button>
              )}
              {can('data:import_export') && (
                <button
                  onClick={() => handleExportCsv(books)}
                  className="bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Export CSV
                </button>
              )}
              {can('data:import_export') && onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('books')}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 border border-slate-300 dark:border-slate-700 cursor-pointer"
                  id="admin-import-books-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-slate-700 dark:text-slate-300" /> Import CSV
                </button>
              )}
              {can('catalog:create_edit') && (
                <button
                  onClick={openNewBookModal}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  id="add-new-book-btn"
                >
                  <Plus className="w-4 h-4" /> Add New Book
                </button>
              )}
            </div>
          </div>

          {selectedBookIds.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950 dark:text-amber-200 font-mono tabular-nums">
                  {selectedBookIds.length} book(s) selected
                </span>
                <button
                  onClick={() => {
                    setSelectedBookIds([]);
                    setConfirmBulkDeleteBooks(false);
                  }}
                  className="text-[11px] text-amber-800 dark:text-amber-300 underline font-semibold hover:text-amber-950 cursor-pointer"
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExportCsv(books.filter(b => selectedBookIds.includes(b.id)))}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold hover:bg-amber-100 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> Export Selected
                </button>
                <button
                  onClick={() => handleBulkToggleReference(true)}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 transition cursor-pointer"
                >
                  Set Reference Only
                </button>
                <button
                  onClick={() => handleBulkToggleReference(false)}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition cursor-pointer"
                >
                  Set Circulating
                </button>
                {can('catalog:delete') && (!confirmBulkDeleteBooks ? (
                  <button
                    onClick={() => setConfirmBulkDeleteBooks(true)}
                    className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 bg-rose-100 dark:bg-rose-950/60 px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-800">
                    <span className="text-[11px] font-bold text-rose-900 dark:text-rose-200">Confirm?</span>
                    <button
                      onClick={handleBulkDeleteBooks}
                      className="px-2 py-0.5 bg-rose-700 text-white rounded text-[11px] font-bold cursor-pointer"
                    >
                      Yes, Delete
                    </button>
                    <button
                      onClick={() => setConfirmBulkDeleteBooks(false)}
                      className="px-2 py-0.5 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded text-[11px] font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="overflow-x-auto max-h-[600px] border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 scrollbar-thin">
            <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
              <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10 text-center border-e border-slate-200 dark:border-slate-700">
                    <input
                      type="checkbox"
                      checked={selectedBookIds.length === books.length && books.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBookIds(books.map(b => b.id));
                        else setSelectedBookIds([]);
                      }}
                      className="w-4 h-4 rounded accent-emerald-700 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 border-e border-slate-200 dark:border-slate-700">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Book Title / Author'}</th>
                  <th className="p-3 border-e border-slate-200 dark:border-slate-700">{language === 'dv' ? 'ބައި' : 'Category'}</th>
                  <th className="p-3 border-e border-slate-200 dark:border-slate-700">{language === 'dv' ? 'ބާވަތް' : 'Type'}</th>
                  <th className="p-3 border-e border-slate-200 dark:border-slate-700">{language === 'dv' ? 'ބާކޯޑު' : 'Barcode'}</th>
                  <th className="p-3 border-e border-slate-200 dark:border-slate-700">{t.shelfLocation}</th>
                  <th className="p-3 border-e border-slate-200 dark:border-slate-700">{t.copiesLabel}</th>
                  <th className="p-3 text-end">{language === 'dv' ? 'ޢަމަލުތައް' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {books.map(book => {
                  const isChecked = selectedBookIds.includes(book.id);
                  return (
                    <tr key={book.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 transition ${isChecked ? 'bg-amber-50/50 dark:bg-amber-950/30' : ''}`}>
                      <td className="p-3 w-10 text-center border-e border-slate-100 dark:border-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedBookIds(prev =>
                              prev.includes(book.id) ? prev.filter(x => x !== book.id) : [...prev, book.id]
                            );
                          }}
                          className="w-4 h-4 rounded accent-emerald-700 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 border-e border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-3">
                          <BookCoverFallback
                            src={book.coverUrl}
                            alt={book.title}
                            title={book.title}
                            className="w-8 h-11 object-cover rounded border border-slate-200 dark:border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-extrabold text-slate-900 dark:text-white"><bdi>{book.title}</bdi></div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{t.byAuthor} <bdi>{book.author}</bdi></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-e border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300">{book.category}</td>
                      <td className="p-3 border-e border-slate-100 dark:border-slate-800">
                        {book.isReferenceOnly ? (
                          <span className="bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-300 font-bold text-[10px] px-2 py-0.5 rounded-md border border-sky-200 dark:border-sky-800">
                            {t.statusReferenceOnly}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-300 font-bold text-[10px] px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800">
                            {t.circulating}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-e border-slate-100 dark:border-slate-800 font-mono tabular-nums text-[11px] text-slate-700 dark:text-slate-300 font-bold">
                        <bdi>{book.barcode}</bdi>
                      </td>
                      <td className="p-3 border-e border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-300"><bdi>{book.shelfLocation}</bdi></td>
                      <td className="p-3 border-e border-slate-100 dark:border-slate-800 font-mono tabular-nums font-extrabold text-slate-900 dark:text-white">
                        <bdi>{book.availableCopies} / {book.totalCopies}</bdi>
                      </td>
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setInspectedBookId(book.id)}
                            className="p-1.5 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition cursor-pointer"
                            title={t.copyDetailsDrawer}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {can('catalog:create_edit') && (
                            <button
                              onClick={() => openEditBookModal(book)}
                              className="p-1.5 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition cursor-pointer"
                              title={t.editBook}
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                          )}
                          {can('catalog:delete') && (
                            <button
                              onClick={() => onDeleteBook(book.id)}
                              className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition cursor-pointer"
                              title={t.deleteBook}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MVR FINANCIAL LEDGER & OVERDUES DESK */}
      {activeTab === 'late-fees' && (
        <div className="space-y-6">
          {/* Financial Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-rose-600 dark:text-rose-400">
                {language === 'dv' ? 'ނުދައްކާ ހުރި ޖޫރިމަނާ' : 'Outstanding Unpaid Fines'}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
                <bdi>MVR {ledgerSummary.unpaidMvr.toFixed(2)}</bdi>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                <bdi>{overdueLoans.length} active overdue / unpaid item(s)</bdi>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
                {language === 'dv' ? 'ލިބިފައިވާ ފައިސާ' : 'Total Revenue Collected'}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
                <bdi>MVR {ledgerSummary.collectedMvr.toFixed(2)}</bdi>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                {ledgerMonthFilter === 'ALL' ? 'All periods' : `Month ${ledgerMonthFilter}`} · Payments & Replacements
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">
                {language === 'dv' ? 'މާފުކޮށްދެވުނު ޖޫރިމަނާ' : 'Librarian Waived Amount'}
              </div>
              <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tabular-nums mt-1">
                <bdi>MVR {ledgerSummary.waivedMvr.toFixed(2)}</bdi>
              </div>
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Authorized admin exemptions with reason log
              </div>
            </div>
          </div>

          {/* Fee & Fine Ledger Table with All / Unpaid / Paid / Waived Filters */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-rose-600" />
                  {language === 'dv' ? 'ފީ އަދި ޖޫރިމަނާ ލެޖަރ' : 'Fee & Fine Ledger'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  Filter overdue fines by settlement status, record partial installments, or authorize documented waivers.
                </p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'unpaid', label: 'Unpaid' },
                      { id: 'paid', label: 'Paid' },
                      { id: 'waived', label: 'Waived' }
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setLedgerFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap ${
                        ledgerFilter === tab.id
                          ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-xs'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {overdueLoans.length > 0 && (
                  <button
                    onClick={() => overdueLoans.forEach(loan => handleDispatchOverdueAlert(loan, 'both'))}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {language === 'dv' ? 'ހުރިހާ އިންޒާރެއް ފޮނުވާ' : 'Alert All Unpaid'}
                  </button>
                )}
              </div>
            </div>

            {dispatchStatusMessage && (
              <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{dispatchStatusMessage}</span>
              </div>
            )}

            {filteredFineLoans.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400 font-medium">
                No records matching the "{ledgerFilter}" filter.
              </div>
            ) : (
              <div className="space-y-3">
                {selectedLoanIds.length > 0 && (
                  <div className="bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl p-3 flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-rose-950 dark:text-rose-200 font-mono tabular-nums">
                      {selectedLoanIds.length} loan(s) selected
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleBulkMarkReturned}
                        className="px-3 py-1.5 bg-emerald-700 text-white rounded-lg text-xs font-bold cursor-pointer"
                      >
                        Mark Settled ({selectedLoanIds.length})
                      </button>
                      {can('fines:waive') && (
                        <button
                          type="button"
                          onClick={handleBulkWaiveFees}
                          className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Waive Selected Fines
                        </button>
                      )}
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto max-h-[480px] border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900">
                  <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                    <thead className="sticky top-0 z-20 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="p-3 w-10 text-center border-e border-slate-200 dark:border-slate-700">
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.length === filteredFineLoans.length && filteredFineLoans.length > 0}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedLoanIds(filteredFineLoans.map(l => l.id));
                              else setSelectedLoanIds([]);
                            }}
                            className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                          />
                        </th>
                        <th className="p-3">Patron</th>
                        <th className="p-3">Book Title</th>
                        <th className="p-3">Due Date</th>
                        <th className="p-3">Fine / Balance (MVR)</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Notify</th>
                        <th className="p-3 text-end">Settlement Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredFineLoans.map(loan => {
                        const borrower = users.find(u => u.id === loan.userId);
                        const recipientEmail = borrower?.email || policyAlertEmail;
                        const recipientPhone = borrower?.phone || policyAlertSmsNumber;
                        const isWaived = Boolean(loan.waivedReason) || (loan.waivedAmount || 0) > 0;
                        const paidSoFar = loan.amountPaid || 0;
                        const remainingDue = isWaived ? 0 : Math.max(0, (loan.lateFee || 0) - paidSoFar);
                        const isPartial = !isWaived && !loan.feePaid && paidSoFar > 0 && remainingDue > 0;
                        const isSettled = !isWaived && (loan.feePaid || (paidSoFar > 0 && remainingDue <= 0));
                        const displayAmount = isWaived ? (loan.waivedAmount || 0) : remainingDue > 0 ? remainingDue : (loan.lateFee || paidSoFar);

                        const subject = encodeURIComponent(`OVERDUE NOTICE: Return needed for "${loan.bookTitle}" - Magoodhoo Library`);
                        const body = encodeURIComponent(`Dear ${loan.userName},\n\nYour borrowed book "${loan.bookTitle}" is overdue (Due Date: ${loan.dueDate}).\nOutstanding balance: MVR ${remainingDue.toFixed(2)}.\n\nPlease return this book to Magoodhoo School Library.`);

                        return (
                          <tr key={loan.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                            <td className="p-3 text-center border-e border-slate-100 dark:border-slate-800">
                              <input
                                type="checkbox"
                                checked={selectedLoanIds.includes(loan.id)}
                                onChange={() => {
                                  setSelectedLoanIds(prev =>
                                    prev.includes(loan.id) ? prev.filter(x => x !== loan.id) : [...prev, loan.id]
                                  );
                                }}
                                className="w-4 h-4 rounded accent-rose-600 cursor-pointer"
                              />
                            </td>
                            <td className="p-3">
                              <div className="font-extrabold text-slate-900 dark:text-white"><bdi>{loan.userName}</bdi></div>
                              <div className="text-[10px] text-slate-500 dark:text-slate-400"><bdi>{borrower?.email || loan.userGrade}</bdi></div>
                            </td>
                            <td className="p-3">
                              <div className="font-bold text-slate-800 dark:text-slate-200"><bdi>{loan.bookTitle}</bdi></div>
                              {isWaived && loan.waivedReason && (
                                <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                                  Waiver note: {loan.waivedReason}
                                </div>
                              )}
                            </td>
                            <td className="p-3 font-mono tabular-nums text-rose-700 dark:text-rose-400 font-bold"><bdi>{loan.dueDate}</bdi></td>
                            <td className="p-3 font-mono tabular-nums">
                              <div className={`text-sm font-black ${isWaived ? 'text-amber-700 dark:text-amber-400' : isSettled ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                <bdi>MVR {displayAmount.toFixed(2)}</bdi>
                              </div>
                              {paidSoFar > 0 && remainingDue > 0 && (
                                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                                  Paid: MVR {paidSoFar.toFixed(2)} of {(loan.lateFee || 0).toFixed(2)}
                                </div>
                              )}
                            </td>
                            <td className="p-3">
                              {isWaived ? (
                                <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  Waived
                                </span>
                              ) : isSettled ? (
                                <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  Paid
                                </span>
                              ) : isPartial ? (
                                <span className="bg-sky-100 dark:bg-sky-950/60 text-sky-900 dark:text-sky-200 border border-sky-200 dark:border-sky-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  Partial
                                </span>
                              ) : (
                                <span className="bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200 border border-rose-200 dark:border-rose-800 text-[10px] font-bold px-2 py-0.5 rounded-md">
                                  Unpaid
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <button
                                  type="button"
                                  disabled={isDispatching === loan.id}
                                  onClick={() => handleDispatchOverdueAlert(loan, 'both')}
                                  className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-[10px] px-2 py-1 rounded-lg transition cursor-pointer disabled:opacity-50"
                                >
                                  {isDispatching === loan.id ? '...' : 'Alert'}
                                </button>
                                <a
                                  href={`mailto:${recipientEmail}?cc=${encodeURIComponent(policyAlertEmail)}&subject=${subject}&body=${body}`}
                                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-[10px] px-2 py-1 rounded-lg transition inline-flex items-center gap-1"
                                >
                                  <Mail className="w-3 h-3" />
                                </a>
                                {recipientPhone && (
                                  <a
                                    href={`sms:${recipientPhone}?body=${encodeURIComponent(`Magoodhoo Library Notice: "${loan.bookTitle}" is overdue (MVR ${remainingDue.toFixed(2)}).`)}`}
                                    className="bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-800 dark:text-emerald-200 font-bold text-[10px] px-2 py-1 rounded-lg transition inline-flex items-center gap-1"
                                  >
                                    <Smartphone className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            </td>
                            <td className="p-3 text-end">
                              {!isWaived && !isSettled ? (
                                <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                  {can('fines:collect') && (
                                    <button
                                      onClick={() => {
                                        setSettlingLoan(loan);
                                        setSettleType(paidSoFar > 0 ? 'partial_payment' : 'payment');
                                        setSettleAmount(remainingDue);
                                        setSettleNotes('');
                                      }}
                                      className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                                    >
                                      Pay / Partial
                                    </button>
                                  )}
                                  {can('fines:waive') && (
                                    <button
                                      onClick={() => {
                                        setWaivingLoan(loan);
                                        setWaiveReason('Medical absence / Authorized sick leave');
                                        setWaiveCustomNote('');
                                      }}
                                      className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-bold text-[11px] px-2.5 py-1.5 rounded-lg transition cursor-pointer whitespace-nowrap"
                                    >
                                      Waive
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-50 dark:bg-emerald-950/60 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800">
                                  {isWaived ? 'Waived' : 'Settled'}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* MVR Financial Ledger Transaction History & One-Click CSV / PDF Monthly Reconciliation */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">MVR Financial Ledger & Monthly Reconciliation</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Filter by month and export one-click CSV or print-ready A4 PDF reconciliation reports.</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={ledgerMonthFilter}
                  onChange={(e) => setLedgerMonthFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-bold text-slate-900 dark:text-white"
                  aria-label="Filter reconciliation month"
                >
                  <option value="ALL">All Months</option>
                  {availableLedgerMonths.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={handleExportLedgerCsv}
                  className="px-3 py-2 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> Export CSV
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printMonthlyReconciliationReport({
                      monthLabel: ledgerMonthFilter === 'ALL' ? 'All Months (Cumulative)' : ledgerMonthFilter,
                      summary: ledgerSummary,
                      transactions: filteredLedgerTransactions,
                      outstandingLoans: overdueLoans,
                    })
                  }
                  className="px-3 py-2 bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <FileText className="w-3.5 h-3.5" /> Export PDF Report
                </button>
                <button
                  onClick={handleExportLedgerJson}
                  className="px-3 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5" /> JSON
                </button>
              </div>
            </div>

            {filteredLedgerTransactions.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
                No financial transactions logged for the selected period.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[360px] border border-slate-200 dark:border-slate-700 rounded-xl">
                <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-extrabold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">Date</th>
                      <th className="p-3">Patron</th>
                      <th className="p-3">Item / Title</th>
                      <th className="p-3">Type</th>
                      <th className="p-3">Amount (MVR)</th>
                      <th className="p-3">Processed By</th>
                      <th className="p-3">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredLedgerTransactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                        <td className="p-3 font-mono tabular-nums text-slate-500 dark:text-slate-400"><bdi>{tx.date}</bdi></td>
                        <td className="p-3 font-bold text-slate-900 dark:text-white"><bdi>{tx.userName}</bdi></td>
                        <td className="p-3 text-slate-700 dark:text-slate-300"><bdi>{tx.bookTitle}</bdi></td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                            tx.type === 'waiver'
                              ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200'
                              : tx.type === 'lost_replacement'
                              ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-900 dark:text-rose-200'
                              : 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200'
                          }`}>
                            {tx.type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="p-3 font-mono tabular-nums font-black text-slate-900 dark:text-white">
                          <bdi>MVR {tx.amountMvr.toFixed(2)}</bdi>
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-400 font-medium"><bdi>{tx.processedBy}</bdi></td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 text-[11px]">{tx.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: PRINTABLE BARCODE & MEMBER ID STUDIO */}
      {activeTab === 'barcode-labels' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4 no-print">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                <span>Printable Barcode & Member ID Studio</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                Print A4 Avery sheets of Code-128 / QR spine labels (School Name, Call Number, Barcode) and Student/Staff Library ID cards.
              </p>
            </div>

            <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold shrink-0">
              <button
                type="button"
                onClick={() => setStudioMode('books')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  studioMode === 'books'
                    ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" /> Spine Labels
              </button>
              <button
                type="button"
                onClick={() => setStudioMode('members')}
                className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                  studioMode === 'members'
                    ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" /> Member ID Cards
              </button>
            </div>
          </div>

          {studioMode === 'books' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4 no-print">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Barcode Symbology Mode:</label>
                  <div className="grid grid-cols-3 gap-2 text-xs font-bold">
                    {(
                      [
                        { id: 'code128', label: 'Code-128' },
                        { id: 'qr', label: 'QR Matrix' },
                        { id: 'both', label: 'Code-128 + QR' }
                      ] as const
                    ).map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setLabelStyle(opt.id)}
                        className={`py-2 px-2.5 rounded-xl border transition cursor-pointer ${
                          labelStyle === opt.id
                            ? 'bg-emerald-700 text-white border-emerald-800'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Catalog Title:</label>
                  <select
                    value={selectedLabelBook?.id || ''}
                    onChange={(e) => {
                      const b = books.find(x => x.id === e.target.value);
                      if (b) {
                        setSelectedLabelBook(b);
                        setSelectedCopyBarcode(b.copies?.[0]?.barcode || '');
                      }
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-bold focus:outline-none"
                  >
                    {books.map(b => (
                      <option key={b.id} value={b.id}>{b.title} — {b.barcode}</option>
                    ))}
                  </select>
                </div>

                {selectedLabelBook?.copies && selectedLabelBook.copies.length > 0 && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Select Specific Copy Barcode:</label>
                    <select
                      value={selectedCopyBarcode}
                      onChange={(e) => setSelectedCopyBarcode(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white font-mono font-bold focus:outline-none"
                    >
                      <option value="">Master Title Barcode ({selectedLabelBook.barcode})</option>
                      {selectedLabelBook.copies.map(c => (
                        <option key={c.copyId} value={c.barcode}>
                          {c.barcode} — {c.condition} ({c.status})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    disabled={!selectedLabelBook || !activeLabelBarcode}
                    onClick={() => {
                      if (!selectedLabelBook) return;
                      const matchedCopy = selectedLabelBook.copies?.find(c => c.barcode === activeLabelBarcode);
                      printBarcodeStickerSheet([
                        {
                          title: selectedLabelBook.title,
                          code: activeLabelBarcode,
                          ddcCallNumber: selectedLabelBook.ddcCallNumber,
                          shelfLocation: matchedCopy?.rackLocation || selectedLabelBook.shelfLocation,
                          accessionNumber: matchedCopy?.accessionNumber,
                          isReferenceOnly: selectedLabelBook.isReferenceOnly,
                        }
                      ], `Label: ${selectedLabelBook.title}`, labelStyle);
                    }}
                    className="w-full bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Printer className="w-4 h-4" /> Print Selected Spine Label (A4)
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={!selectedLabelBook}
                      onClick={() => {
                        if (!selectedLabelBook) return;
                        printBarcodeStickerSheet(
                          buildStickerItemsFromBooks([selectedLabelBook]),
                          `Copy Sheet — ${selectedLabelBook.title}`,
                          labelStyle
                        );
                      }}
                      className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" /> Print All Book Copies
                    </button>

                    <button
                      type="button"
                      disabled={books.length === 0}
                      onClick={() =>
                        printBarcodeStickerSheet(
                          buildStickerItemsFromBooks(books.slice(0, 30)),
                          'Magoodhoo Library — Catalog A4 Sticker Sheet (Top 30 Titles)',
                          labelStyle
                        )
                      }
                      className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-xs py-2.5 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" /> {t.printStickerSheet}
                    </button>
                  </div>
                </div>
              </div>

              {selectedLabelBook && (
                <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="text-[10px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                    F. Magoodhoo School Library
                  </div>
                  <div className="text-sm font-black text-slate-900 dark:text-white"><bdi>{selectedLabelBook.title}</bdi></div>
                  <div className="flex items-center gap-2 text-[11px] font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    <span><bdi>{selectedLabelBook.ddcCallNumber || 'DDC 800'}</bdi></span>
                    <span>·</span>
                    <span><bdi>{selectedLabelBook.shelfLocation}</bdi></span>
                  </div>

                  <div className="bg-white px-5 py-3 border border-slate-300 rounded-xl shadow-xs space-y-2 my-2 w-full max-w-[280px]">
                    {labelStyle === 'qr' ? (
                      <SvgQrCode code={activeLabelBarcode} size={76} />
                    ) : labelStyle === 'both' ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="flex-1 min-w-0">
                          <SvgSpineBarcode code={activeLabelBarcode} />
                        </div>
                        <div className="shrink-0">
                          <SvgQrCode code={activeLabelBarcode} size={48} />
                        </div>
                      </div>
                    ) : (
                      <SvgSpineBarcode code={activeLabelBarcode} />
                    )}
                    <div className="font-mono tabular-nums text-xs font-extrabold text-slate-900 tracking-wider">
                      <bdi>{activeLabelBarcode}</bdi>
                    </div>
                  </div>

                  {selectedLabelBook.isReferenceOnly && (
                    <span className="bg-amber-500 text-white font-extrabold text-[10px] px-3 py-0.5 rounded-md uppercase">
                      REFERENCE ONLY
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-4 no-print">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold">
                    {(['all', 'student', 'staff'] as const).map(f => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setMemberRoleFilter(f)}
                        className={`px-3 py-1 rounded-lg capitalize cursor-pointer ${
                          memberRoleFilter === f
                            ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {f === 'all' ? 'All Patrons' : f === 'student' ? 'Students' : 'Staff & Teachers'}
                      </button>
                    ))}
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeMemberQr}
                      onChange={(e) => setIncludeMemberQr(e.target.checked)}
                      className="w-4 h-4 accent-emerald-700"
                    />
                    <span>Include QR Badge</span>
                  </label>
                </div>

                <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 flex items-center justify-between text-xs sticky top-0">
                    <span className="font-bold text-slate-700 dark:text-slate-200">
                      Select Members (<bdi className="font-mono">{selectedMemberIds.length || studioMembers.length}</bdi> ready)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedMemberIds(studioMembers.map(m => m.id))}
                        className="text-emerald-700 dark:text-emerald-400 font-bold hover:underline cursor-pointer"
                      >
                        Select All
                      </button>
                      {selectedMemberIds.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedMemberIds([])}
                          className="text-slate-500 font-bold hover:underline cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                  {studioMembers.map(member => {
                    const checked = selectedMemberIds.includes(member.id);
                    const code = member.studentIdCode || member.staffIdCode || `MAG-${member.id.slice(-6).toUpperCase()}`;
                    return (
                      <label
                        key={member.id}
                        className="p-2.5 flex items-center justify-between gap-2 text-xs hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() =>
                              setSelectedMemberIds(prev =>
                                prev.includes(member.id) ? prev.filter(x => x !== member.id) : [...prev, member.id]
                              )
                            }
                            className="w-4 h-4 accent-emerald-700"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-white truncate"><bdi>{member.name}</bdi></div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              <bdi>{member.grade || member.staffDepartment || member.role}</bdi>
                            </div>
                          </div>
                        </div>
                        <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400 shrink-0">
                          <bdi>{code}</bdi>
                        </span>
                      </label>
                    );
                  })}
                </div>

                <button
                  type="button"
                  disabled={studioMembers.length === 0}
                  onClick={() => {
                    const chosen =
                      selectedMemberIds.length > 0
                        ? studioMembers.filter(m => selectedMemberIds.includes(m.id))
                        : studioMembers;
                    printMemberIdCards(chosen, includeMemberQr);
                  }}
                  className="w-full bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>
                    Print {selectedMemberIds.length > 0 ? selectedMemberIds.length : studioMembers.length} Library ID Card(s) (A4)
                  </span>
                </button>
              </div>

              {/* Live Patron ID Card Preview */}
              {(() => {
                const previewMember =
                  studioMembers.find(m => selectedMemberIds.includes(m.id)) || studioMembers[0];
                if (!previewMember) return null;
                const code = previewMember.studentIdCode || previewMember.staffIdCode || `MAG-${previewMember.id.slice(-6).toUpperCase()}`;
                const initials = previewMember.name.split(' ').map(s => s.charAt(0)).slice(0, 2).join('').toUpperCase();
                return (
                  <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 p-6 rounded-2xl bg-slate-50 dark:bg-slate-800/50 flex flex-col items-center justify-center">
                    <div className="w-full max-w-sm rounded-2xl border border-slate-300 bg-white overflow-hidden shadow-md">
                      <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="text-[9px] font-extrabold uppercase tracking-widest text-emerald-400">F. Magoodhoo School</div>
                          <div className="text-xs font-black">LIBRARY PATRON PASS</div>
                        </div>
                        <span className="font-mono text-[10px] font-bold bg-emerald-700 px-2 py-0.5 rounded uppercase">
                          {previewMember.patronTier || previewMember.role}
                        </span>
                      </div>
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-slate-200 text-slate-900 font-black text-sm flex items-center justify-center shrink-0 overflow-hidden">
                            {previewMember.photoUrl ? (
                              <img src={previewMember.photoUrl} alt={previewMember.name} className="w-full h-full object-cover" />
                            ) : (
                              initials
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-900 truncate"><bdi>{previewMember.name}</bdi></div>
                            {previewMember.dhivehiName && (
                              <div className="text-xs text-slate-600 truncate">{previewMember.dhivehiName}</div>
                            )}
                            <div className="text-[11px] text-slate-500">
                              <bdi>{previewMember.grade || previewMember.staffDepartment || 'School Member'}</bdi>
                            </div>
                          </div>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 flex items-center gap-3">
                          <div className="flex-1 min-w-0 text-center">
                            <SvgSpineBarcode code={code} />
                            <div className="font-mono text-xs font-black text-slate-900 mt-1"><bdi>{code}</bdi></div>
                          </div>
                          {includeMemberQr && (
                            <div className="shrink-0">
                              <SvgQrCode code={code} size={50} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: USERS & PARENT ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4 border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700" /> Member & Parent Account Directory
              </h3>
              <p className="text-xs text-slate-500 font-medium">Manage registered parent accounts, student links, and member profiles</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenReportCardSyncModal && (
                <button
                  onClick={onOpenReportCardSyncModal}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-200 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 cursor-pointer"
                  id="admin-reportcard-sync-btn"
                >
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ސިންކް' : 'Report Card Sync'}</span>
                </button>
              )}
              {onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('parents')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2 rounded-xl transition flex items-center gap-2 border border-slate-300 cursor-pointer"
                  id="admin-import-parents-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Import Parents CSV
                </button>
              )}
              {onOpenAddParentModal && (
                <button
                  onClick={onOpenAddParentModal}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                  id="admin-add-parent-account-btn"
                >
                  <Plus className="w-4 h-4" /> Register Parent
                </button>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-slate-600" /> Parent Accounts ({users.filter(u => u.role === 'parent').length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.filter(u => u.role === 'parent').map((parent) => {
                const children = users.filter(u => u.parentId === parent.id || parent.childrenIds?.includes(u.id));
                return (
                  <div key={parent.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          <bdi>{parent.name}</bdi>
                          <span className="bg-slate-200 text-slate-800 text-[10px] px-2 py-0.5 rounded font-bold">Parent</span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5"><bdi>{parent.email}</bdi></div>
                      </div>
                      {onDeleteUser && (
                        <button
                          onClick={() => onDeleteUser(parent.id)}
                          className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] px-2.5 py-1 rounded-lg transition flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="text-[11px] font-bold text-slate-700">
                        Linked Student Children ({children.length}):
                      </div>
                      {children.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic">No student children linked to this parent.</div>
                      ) : (
                        <div className="space-y-1">
                          {children.map(c => (
                            <div key={c.id} className="text-xs text-slate-800 font-bold flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded border border-slate-200">
                              <span><bdi>{c.name}</bdi> (<bdi>{c.grade}</bdi>)</span>
                              <span className="font-mono text-[10px] text-slate-500"><bdi>{c.studentIdCode}</bdi></span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Student Members ({users.filter(u => u.role === 'student').length})
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
              <table className="w-full text-start text-xs text-slate-700">
                <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Student ID Barcode</th>
                    <th className="p-3">Linked Parent</th>
                    <th className="p-3 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'student').map(student => {
                    const parent = users.find(u => u.id === student.parentId || u.childrenIds?.includes(student.id));
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-extrabold text-slate-900"><bdi>{student.name}</bdi></td>
                        <td className="p-3 font-bold text-slate-700"><bdi>{student.grade}</bdi></td>
                        <td className="p-3 font-mono tabular-nums text-emerald-700 font-bold"><bdi>{student.studentIdCode || 'N/A'}</bdi></td>
                        <td className="p-3 text-slate-700 font-medium">
                          {parent ? <span className="font-bold"><bdi>{parent.name}</bdi></span> : <span className="text-slate-400 italic">Unlinked</span>}
                        </td>
                        <td className="p-3 text-end">
                          {onDeleteUser && (
                            <button
                              onClick={() => onDeleteUser(student.id)}
                              className="bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] px-2.5 py-1 rounded-lg transition inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: POLICY SETTINGS (WITH MVR UNITS) */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">
              {language === 'dv' ? 'ލައިބްރަރީ ސާކިއުލޭޝަން އުޞޫލުތައް' : 'Library Circulation Rules & MVR Fine Policy'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Configure checkout limits, Maldives MVR daily fine rates, replacement charges, and automated notifications.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                {language === 'dv' ? 'ފޮތް ދޫކުރެވޭ މުއްދަތާއި އިތުރުކުރުން' : 'Loan Periods & Renewals'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Student Loan Period (Days)</label>
                  <input type="number" min={1} value={policyMaxBorrowDays} onChange={(e) => setPolicyMaxBorrowDays(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Staff Loan Period (Days)</label>
                  <input type="number" min={1} value={policyStaffBorrowDays} onChange={(e) => setPolicyStaffBorrowDays(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Grace Period (Days)</label>
                  <input type="number" min={0} value={policyGracePeriodDays} onChange={(e) => setPolicyGracePeriodDays(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Online Renewals</label>
                  <input type="number" min={0} value={policyMaxRenewals} onChange={(e) => setPolicyMaxRenewals(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Users className="w-4 h-4 text-slate-700" /> Borrowing Limits & Reservations
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Books / Student</label>
                  <input type="number" min={1} value={policyMaxBooksStudent} onChange={(e) => setPolicyMaxBooksStudent(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Books / Staff</label>
                  <input type="number" min={1} value={policyMaxBooksStaff} onChange={(e) => setPolicyMaxBooksStaff(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Reservations / User</label>
                  <input type="number" min={1} value={policyMaxActiveReservations} onChange={(e) => setPolicyMaxActiveReservations(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hold Desk Expiry (Days)</label>
                  <input type="number" min={1} value={policyHoldExpiryDays} onChange={(e) => setPolicyHoldExpiryDays(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <DollarSign className="w-4 h-4 text-emerald-700" /> Fines, Caps & Damage Fees (MVR)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Daily Late Fee (MVR/day)</label>
                  <input type="number" step="0.50" min={0} value={policyLateFeeRate} onChange={(e) => setPolicyLateFeeRate(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Max Fine Cap / Loan (MVR)</label>
                  <input type="number" step="5.00" min={0} value={policyMaxOverdueFineCap} onChange={(e) => setPolicyMaxOverdueFineCap(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Lost Book Fee (MVR)</label>
                  <input type="number" step="5.00" min={0} value={policyLostBookReplacementFee} onChange={(e) => setPolicyLostBookReplacementFee(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Minor Damage Fee (MVR)</label>
                  <input type="number" step="1.00" min={0} value={policyDamagedBookMinorFee} onChange={(e) => setPolicyDamagedBookMinorFee(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Shield className="w-4 h-4 text-slate-700" /> Restrictions & Alert Gateway
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Block Checkout Fine Limit (MVR)</label>
                  <input type="number" step="5.00" min={0} value={policyBlockBorrowingFineThreshold} onChange={(e) => setPolicyBlockBorrowingFineThreshold(Number(e.target.value))} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Admin Alert Email</label>
                  <input type="email" value={policyAlertEmail} onChange={(e) => setPolicyAlertEmail(e.target.value)} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">SMS Gateway Number</label>
                  <input type="tel" value={policyAlertSmsNumber} onChange={(e) => setPolicyAlertSmsNumber(e.target.value)} className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={policyHolidayGraceDays} onChange={(e) => setPolicyHolidayGraceDays(e.target.checked)} className="w-4 h-4 rounded accent-emerald-700" />
                  <span className="font-bold text-xs text-slate-800">Exclude Maldives Weekends (Fri/Sat) & Holidays from Overdues</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={policyNotifyParentOnOverdue} onChange={(e) => setPolicyNotifyParentOnOverdue(e.target.checked)} className="w-4 h-4 rounded accent-emerald-700" />
                  <span className="font-bold text-xs text-slate-800">CC Parent Guardian on Overdue Notices</span>
                </label>
              </div>

              {/* Maldivian School Holidays Exclusion List */}
              <div className="pt-3 border-t border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-bold text-xs text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Maldivian School Holidays (Excluded from Due Dates & Fines)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg font-mono text-xs text-slate-900"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newHolidayDate) return;
                        if (!policySchoolHolidays.includes(newHolidayDate)) {
                          setPolicySchoolHolidays(prev => [...prev, newHolidayDate].sort());
                        }
                        setNewHolidayDate('');
                      }}
                      className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      + Add Holiday
                    </button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {policySchoolHolidays.map(d => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1.5 bg-white border border-slate-300 px-2 py-0.5 rounded-md font-mono text-[11px] font-bold text-slate-800"
                    >
                      <bdi>{d}</bdi>
                      <button
                        type="button"
                        onClick={() => setPolicySchoolHolidays(prev => prev.filter(x => x !== d))}
                        className="text-rose-600 hover:text-rose-800 cursor-pointer"
                        aria-label={`Remove holiday ${d}`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* 4-Tier Patron Borrowing Policies Matrix (Koha-style Rules) */}
            <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-4">
              <div className="border-b border-slate-200 pb-2">
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-700" /> {t.patronTierPolicies}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                  Granular circulation quotas, loan windows, renewal limits, grace days, and MVR daily rates across all 4 patron tiers.
                </p>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-start text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Patron Tier</th>
                      <th className="p-3">Max Books</th>
                      <th className="p-3">Loan Days</th>
                      <th className="p-3">Max Renewals</th>
                      <th className="p-3">Grace Days</th>
                      <th className="p-3">Daily Fine (MVR)</th>
                      <th className="p-3 text-center">Reference Loan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(['student', 'teacher', 'staff', 'external'] as const).map((tierKey) => {
                      const rule = policyTierRules[tierKey];
                      return (
                        <tr key={tierKey} className="hover:bg-slate-50">
                          <td className="p-3 font-extrabold text-slate-900 capitalize">{tierKey}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={rule.maxBooks}
                              onChange={(e) =>
                                setPolicyTierRules(prev => ({
                                  ...prev,
                                  [tierKey]: { ...prev[tierKey], maxBooks: Number(e.target.value) }
                                }))
                              }
                              className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono tabular-nums font-bold text-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={rule.loanDays}
                              onChange={(e) =>
                                setPolicyTierRules(prev => ({
                                  ...prev,
                                  [tierKey]: { ...prev[tierKey], loanDays: Number(e.target.value) }
                                }))
                              }
                              className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono tabular-nums font-bold text-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              value={rule.maxRenewals}
                              onChange={(e) =>
                                setPolicyTierRules(prev => ({
                                  ...prev,
                                  [tierKey]: { ...prev[tierKey], maxRenewals: Number(e.target.value) }
                                }))
                              }
                              className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono tabular-nums font-bold text-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={0}
                              value={rule.graceDays ?? 2}
                              onChange={(e) =>
                                setPolicyTierRules(prev => ({
                                  ...prev,
                                  [tierKey]: { ...prev[tierKey], graceDays: Number(e.target.value) }
                                }))
                              }
                              className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono tabular-nums font-bold text-slate-900"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              step="0.50"
                              min={0}
                              value={rule.dailyFineMvr}
                              onChange={(e) =>
                                setPolicyTierRules(prev => ({
                                  ...prev,
                                  [tierKey]: { ...prev[tierKey], dailyFineMvr: Number(e.target.value) }
                                }))
                              }
                              className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg font-mono tabular-nums font-bold text-slate-900"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(rule.allowReferenceCheckout)}
                              onChange={(e) =>
                                setPolicyTierRules(prev => ({
                                  ...prev,
                                  [tierKey]: { ...prev[tierKey], allowReferenceCheckout: e.target.checked }
                                }))
                              }
                              className="w-4 h-4 accent-emerald-700 cursor-pointer"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Firestore Diagnostics */}
            <div className="bg-slate-900 text-slate-100 p-5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <Database className="w-5 h-5 text-emerald-400" />
                  <div>
                    <h4 className="font-extrabold text-sm text-white">Cloud Firestore & Quota Status</h4>
                    <p className="text-[11px] text-slate-400 font-mono">
                      Status: {isQuotaExhausted ? 'Offline Cache Resilient' : 'Active & Synced'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunQuotaTest}
                    disabled={isTestingQuota}
                    className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1.5"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTestingQuota ? 'animate-spin' : ''}`} />
                    {isTestingQuota ? 'Testing...' : 'Run Diagnostics'}
                  </button>
                  {isQuotaExhausted && (
                    <button type="button" onClick={() => resetQuotaStatus()} className="px-3 py-1.5 bg-slate-800 text-slate-200 rounded-lg text-xs font-bold cursor-pointer">
                      Reset Flag
                    </button>
                  )}
                </div>
              </div>
              {quotaTestResult && (
                <div className="p-3 rounded-lg bg-slate-800 text-xs font-mono text-emerald-300">
                  {quotaTestResult.message} ({quotaTestResult.latencyMs}ms)
                </div>
              )}
            </div>

            {settingsSavedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                {language === 'dv' ? 'އުޞޫލުތައް ސޭވްކުރެވިއްޖެ!' : 'Circulation rules & MVR rates saved successfully.'}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-6 py-3 rounded-xl transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {language === 'dv' ? 'އުޞޫލުތައް ސޭވްކުރައްވާ' : 'Save Circulation Rules'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: SYSTEM AUDIT LOG */}
      {activeTab === 'audit-logs' && can('audit:view') && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-emerald-700" />
                {language === 'dv' ? 'ސިސްޓަމް އޮޑިޓް ލޮގް' : 'System Audit Logs & Compliance Ledger'}
              </h3>
              <p className="text-xs text-slate-500 font-medium">Immutable activity trail for fine waivers, deleted records, role changes, and circulation overrides.</p>
            </div>
            <button
              type="button"
              onClick={fetchAuditLogs}
              disabled={isLoadingAuditLogs}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-200 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
              <span>{language === 'dv' ? 'އަލުން ގެނޭ' : 'Refresh Logs'}</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {[
              { id: 'ALL', label: 'All Events' },
              { id: 'BOOK_CREATED', label: 'Book Created' },
              { id: 'BOOK_DELETED', label: 'Book Deleted' },
              { id: 'LOAN_ISSUED', label: 'Loan Issued' },
              { id: 'LOAN_RETURNED', label: 'Loan Returned' },
              { id: 'FINE_WAIVED', label: 'Fine / Ledger' },
              { id: 'ROLE_CHANGED', label: 'Role Changed' },
              { id: 'POLICY_UPDATED', label: 'Policy Updated' }
            ].map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setAuditActionFilter(pill.id)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                  auditActionFilter === pill.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {(() => {
            const seenIds = new Set<string>();
            const mergedLogs = [...immutableAuditLogs, ...auditLogs].filter((item) => {
              if (!item?.id || seenIds.has(item.id)) return false;
              seenIds.add(item.id);
              return true;
            });
            const filtered = mergedLogs.filter(
              (log) => auditActionFilter === 'ALL' || log.action === auditActionFilter
            );
            return filtered.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                No audit events match this filter yet. Click Refresh Logs to sync server events.
              </div>
            ) : (
              <div className="overflow-x-auto max-h-[500px] border border-slate-200 rounded-xl bg-white">
                <table className="w-full text-start text-xs text-slate-700">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="p-3">Timestamp</th>
                      <th className="p-3">Action</th>
                      <th className="p-3">Target</th>
                      <th className="p-3">Details</th>
                      <th className="p-3 text-end">Actor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filtered.map((log: any) => (
                      <tr key={log.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono tabular-nums text-[11px] text-slate-500 whitespace-nowrap">
                          <bdi>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</bdi>
                        </td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-bold font-mono">{log.action}</span>
                        </td>
                        <td className="p-3 font-mono text-[11px]"><bdi>{log.targetId}</bdi></td>
                        <td className="p-3 text-slate-800">{log.details}</td>
                        <td className="p-3 text-end font-bold">{log.performedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })()}
        </div>
      )}

      {/* ADD / EDIT BOOK MODAL */}
      {showBookModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingBookId ? 'Edit Book Details' : 'Add New Book Record'}
              </h3>
              <button type="button" onClick={() => setShowBookModal(false)} className="text-slate-400 hover:text-slate-700 font-bold p-1 cursor-pointer">
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveBook} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Book Title *</label>
                <input type="text" required value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Author *</label>
                <input type="text" required value={author} onChange={(e) => setAuthor(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ISBN Code</label>
                  <input type="text" value={isbn} onChange={(e) => setIsbn(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode Label</label>
                  <input type="text" value={barcode} onChange={(e) => setBarcode(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-sm font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input type="text" value={category} onChange={(e) => setCategory(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shelf Location</label>
                  <input type="text" value={shelfLocation} onChange={(e) => setShelfLocation(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold" />
                </div>
              </div>
              <label className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between cursor-pointer">
                <span className="font-bold text-amber-900">Reference Book Only (Non-Circulating)</span>
                <input type="checkbox" checked={isReferenceOnly} onChange={(e) => setIsReferenceOnly(e.target.checked)} className="w-4 h-4 accent-amber-600" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Total Copies</label>
                  <input type="number" min={1} value={totalCopies} onChange={(e) => setTotalCopies(Number(e.target.value))} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Cover Path / URL</label>
                  <input type="text" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono" />
                </div>
              </div>
              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button type="button" onClick={() => setShowBookModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold cursor-pointer">Cancel</button>
                <button type="submit" className="px-4 py-2 bg-emerald-700 text-white font-bold rounded-xl cursor-pointer">Save Book Record</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SETTLE MVR PAYMENT / PARTIAL / LOST MODAL */}
      {settlingLoan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">Record MVR Fine / Partial Settlement</h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Patron: <bdi>{settlingLoan.userName}</bdi> · Remaining: <span className="font-mono font-bold text-rose-600 dark:text-rose-400">MVR {Math.max(0, (settlingLoan.lateFee || 0) - (settlingLoan.amountPaid || 0)).toFixed(2)}</span>
                </p>
              </div>
              <button onClick={() => setSettlingLoan(null)} className="text-slate-400 hover:text-slate-700 p-1 cursor-pointer">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Transaction Type</label>
                <select
                  value={settleType}
                  onChange={(e) => {
                    const nextType = e.target.value as LedgerTransactionType;
                    const rem = Math.max(0, (settlingLoan.lateFee || 0) - (settlingLoan.amountPaid || 0));
                    setSettleType(nextType);
                    if (nextType === 'lost_replacement') setSettleAmount(policyLostBookReplacementFee);
                    else if (nextType === 'payment') setSettleAmount(rem);
                    else if (nextType === 'partial_payment') setSettleAmount(Number((rem / 2).toFixed(2)));
                  }}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold text-slate-900 dark:text-white"
                >
                  <option value="payment">Full Fine Settlement (MVR)</option>
                  <option value="partial_payment">Partial Installment Payment (MVR)</option>
                  <option value="lost_replacement">Lost Book Replacement Charge (MVR)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Amount Paid Now (MVR)</label>
                <input
                  type="number"
                  step="0.50"
                  min={0}
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono text-sm font-black text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Receipt / Desk Notes</label>
                <input
                  type="text"
                  placeholder="Cash receipt # or desk remarks..."
                  value={settleNotes}
                  onChange={(e) => setSettleNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setSettlingLoan(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
              <button
                type="button"
                disabled={isSettling || Number(settleAmount || 0) <= 0}
                onClick={handleConfirmSettlement}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                {isSettling ? 'Recording...' : `Record MVR ${Number(settleAmount || 0).toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WAIVE FINE OVERRIDE MODAL (REQUIRES ADMIN REASON NOTE) */}
      {waivingLoan && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl"><Shield className="w-5 h-5" /></div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">Waive Overdue Fine (Override)</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Librarian Discretionary Authorization</p>
                </div>
              </div>
              <button onClick={() => setWaivingLoan(null)} className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer">✕</button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/70 p-3 rounded-xl border border-slate-200 dark:border-slate-700 space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Borrower:</span>
                <span className="font-extrabold text-slate-900 dark:text-white"><bdi>{waivingLoan.userName}</bdi></span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400 font-bold">Balance to Waive:</span>
                <span className="font-mono tabular-nums font-black text-rose-600 dark:text-rose-400">
                  <bdi>MVR {Math.max(0, (waivingLoan.lateFee || 0) - (waivingLoan.amountPaid || 0)).toFixed(2)}</bdi>
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Waiver Category:</label>
                <select
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                >
                  <option value="Medical absence / Authorized sick leave">Medical absence / Authorized sick leave</option>
                  <option value="Inter-school competition / School event">Inter-school competition / School event</option>
                  <option value="First-offense grace period exemption">First-offense grace period exemption</option>
                  <option value="Administrative review error resolution">Administrative review error resolution</option>
                  <option value="Head of School / Principal Discretion">Head of School / Principal Discretion</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Admin Reason Note <span className="text-rose-600">*</span>
                </label>
                <textarea
                  rows={2}
                  required
                  value={waiveCustomNote}
                  onChange={(e) => setWaiveCustomNote(e.target.value)}
                  placeholder="Enter mandatory audit justification (e.g., Medical certificate #412 verified by Principal)..."
                  className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                {waiveCustomNote.trim().length > 0 && waiveCustomNote.trim().length < 5 && (
                  <p className="text-[11px] text-rose-600 mt-1 font-medium">Please enter at least 5 characters for audit compliance.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button type="button" onClick={() => setWaivingLoan(null)} className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer">Cancel</button>
              <button
                type="button"
                disabled={isWaiving || waiveCustomNote.trim().length < 5}
                onClick={async () => {
                  const fullReason = `${waiveReason} — ${waiveCustomNote.trim()}`;
                  setIsWaiving(true);
                  try {
                    await fetch('/api/circulation/waive-fine', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
                      body: JSON.stringify({ loanId: waivingLoan.id, reason: fullReason, waivedBy: currentUserName })
                    });
                    if (onWaiveFee) onWaiveFee(waivingLoan.id, fullReason);
                    else onMarkFeePaid(waivingLoan.id);
                    setWaivingLoan(null);
                    setWaiveCustomNote('');
                  } finally {
                    setIsWaiving(false);
                  }
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl cursor-pointer disabled:opacity-50"
              >
                {isWaiving ? 'Processing...' : 'Confirm Waiver (MVR 0.00)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SLIDE-OVER COPY INVENTORY & MARC DRAWER */}
      {inspectedBook && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end items-stretch max-sm:items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) setInspectedBookId(null);
          }}
        >
          <div className="bg-white w-full sm:max-w-xl h-full max-sm:h-auto max-sm:max-h-[90vh] max-sm:rounded-t-3xl shadow-2xl border-s border-slate-200 flex flex-col justify-between overflow-hidden text-slate-800">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50 shrink-0">
              <div className="min-w-0">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  {t.copyDetailsDrawer}
                </div>
                <h3 className="text-base font-black text-slate-900 truncate"><bdi>{inspectedBook.title}</bdi></h3>
                <p className="text-xs text-slate-500 font-medium truncate">
                  <bdi>{inspectedBook.author}</bdi> · <span className="font-mono"><bdi>{inspectedBook.ddcCallNumber || 'DDC 000'}</bdi></span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedBookId(null)}
                className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition cursor-pointer"
                aria-label="Close drawer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">ISBN-13</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900"><bdi>{inspectedBook.isbn}</bdi></span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">Master Barcode</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900"><bdi>{inspectedBook.barcode}</bdi></span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block">Primary Shelf</span>
                  <span className="font-bold text-slate-900"><bdi>{inspectedBook.shelfLocation}</bdi></span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-black text-slate-900 uppercase text-[11px] tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-emerald-700" />
                    Physical Copies ({inspectedBook.copies?.length || 0})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      printBarcodeStickerSheet(
                        buildStickerItemsFromBooks([inspectedBook]),
                        `Copy Labels — ${inspectedBook.title}`
                      )
                    }
                    className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <Printer className="w-3 h-3" /> Print Copy Stickers
                  </button>
                </div>

                {inspectedBook.copies && inspectedBook.copies.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Barcode / Accession</th>
                          <th className="p-2.5">Rack</th>
                          <th className="p-2.5">Condition</th>
                          <th className="p-2.5 text-end">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {inspectedBook.copies.map((cp) => (
                          <tr key={cp.copyId}>
                            <td className="p-2.5">
                              <div className="font-mono tabular-nums font-bold text-slate-900"><bdi>{cp.barcode}</bdi></div>
                              <div className="font-mono text-[10px] text-slate-500"><bdi>{cp.accessionNumber || cp.copyId}</bdi></div>
                            </td>
                            <td className="p-2.5 text-slate-700 font-medium">
                              <bdi>{cp.rackLocation || cp.shelfLocation || inspectedBook.shelfLocation}</bdi>
                            </td>
                            <td className="p-2.5">
                              <select
                                value={cp.condition}
                                onChange={(e) => handleUpdateBookCopy(inspectedBook, cp.copyId, { condition: e.target.value as BookCopy['condition'] })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold"
                              >
                                <option value="New">New</option>
                                <option value="Good">Good</option>
                                <option value="Fair">Fair</option>
                                <option value="Damaged">Damaged</option>
                              </select>
                            </td>
                            <td className="p-2.5 text-end">
                              <select
                                value={cp.status}
                                onChange={(e) => handleUpdateBookCopy(inspectedBook, cp.copyId, { status: e.target.value as BookCopy['status'] })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold"
                              >
                                <option value="Available">Available</option>
                                <option value="Checked Out">Checked Out</option>
                                <option value="Reserved">Reserved</option>
                                <option value="Repair">Repair</option>
                                <option value="Lost">Lost</option>
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
                    No itemized copy records found for this title.
                  </div>
                )}
              </div>

              <div className="bg-slate-900 text-emerald-300 p-3.5 rounded-xl font-mono text-[11px] space-y-1 overflow-x-auto">
                <div className="text-slate-400 uppercase text-[10px] font-bold mb-1">MARC21 Snapshot</div>
                <div>020 ## $a <bdi>{inspectedBook.isbn}</bdi></div>
                <div>082 04 $a <bdi>{inspectedBook.ddcCallNumber || '000'}</bdi></div>
                <div>100 1# $a <bdi>{inspectedBook.author}</bdi></div>
                <div>245 10 $a <bdi>{inspectedBook.title}</bdi></div>
                <div>852 ## $c <bdi>{inspectedBook.shelfLocation}</bdi></div>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const target = inspectedBook;
                  setInspectedBookId(null);
                  openEditBookModal(target);
                }}
                className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Edit Master Metadata
              </button>
              <button
                type="button"
                onClick={() => setInspectedBookId(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
