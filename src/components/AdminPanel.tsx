import React, { useState } from 'react';
import { Shield, Plus, Edit2, Trash2, Printer, DollarSign, Settings, Users, BookOpen, CheckCircle, AlertTriangle, QrCode, FileSpreadsheet, Mail, Send, Smartphone, BellRing, Zap, Radio, Database, Activity, RefreshCw } from 'lucide-react';
import { Book, UserProfile, Loan, LibrarySettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { testFirestoreConnection, resetQuotaStatus } from '../lib/firebase';

interface AdminPanelProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  settings: LibrarySettings;
  isQuotaExhausted?: boolean;
  onAddBook: (book: Omit<Book, 'id'>) => void;
  onUpdateBook: (id: string, data: Partial<Book>) => void;
  onDeleteBook: (id: string) => void;
  onDeleteUser?: (userId: string) => void;
  onUpdateSettings: (newSettings: Partial<LibrarySettings>) => void;
  onMarkFeePaid: (loanId: string) => void;
  onWaiveFee?: (loanId: string, reason: string) => void;
  onOpenAddParentModal?: () => void;
  onOpenImportModal?: (type?: 'books' | 'parents') => void;
  onOpenReportCardSyncModal?: () => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  books,
  users,
  loans,
  settings,
  isQuotaExhausted = false,
  onAddBook,
  onUpdateBook,
  onDeleteBook,
  onDeleteUser,
  onUpdateSettings,
  onMarkFeePaid,
  onWaiveFee,
  onOpenAddParentModal,
  onOpenImportModal,
  onOpenReportCardSyncModal
}) => {
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'inventory' | 'late-fees' | 'barcode-labels' | 'users' | 'settings' | 'audit-logs'>('inventory');

  // Bulk Selection States
  const [selectedBookIds, setSelectedBookIds] = useState<string[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<string[]>([]);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [isLoadingAuditLogs, setIsLoadingAuditLogs] = useState(false);
  const [auditActionFilter, setAuditActionFilter] = useState<string>('ALL');

  // Fine Waive Modal State
  const [waivingLoan, setWaivingLoan] = useState<Loan | null>(null);
  const [waiveReason, setWaiveReason] = useState('Medical absence / Authorized discretion');
  const [isWaiving, setIsWaiving] = useState(false);

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

  // Fetch live system audit logs
  const fetchAuditLogs = async () => {
    setIsLoadingAuditLogs(true);
    try {
      const res = await fetch('/api/audit-logs?limit=150', {
        headers: { 'x-user-role': 'admin' }
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

  // Export inventory to CSV
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

  // Bulk Inventory Handlers
  const handleBulkToggleReference = (isRef: boolean) => {
    selectedBookIds.forEach(id => {
      onUpdateBook(id, { isReferenceOnly: isRef });
    });
    setSelectedBookIds([]);
  };

  const handleBulkDeleteBooks = () => {
    if (!confirm(`Are you sure you want to delete ${selectedBookIds.length} book record(s)?`)) return;
    selectedBookIds.forEach(id => {
      onDeleteBook(id);
    });
    setSelectedBookIds([]);
  };

  // Bulk Loan Handlers
  const handleBulkMarkReturned = async () => {
    if (selectedLoanIds.length === 0) return;
    if (!confirm(`Mark ${selectedLoanIds.length} loan(s) as returned?`)) return;
    for (const loanId of selectedLoanIds) {
      try {
        await fetch('/api/circulation/return', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-user-role': 'admin' },
          body: JSON.stringify({ loanId })
        });
        onMarkFeePaid(loanId);
      } catch (e) {
        console.warn('Failed returning loan:', e);
      }
    }
    setSelectedLoanIds([]);
  };

  const handleBulkWaiveFees = () => {
    if (selectedLoanIds.length === 0) return;
    if (!confirm(`Waive overdue fines for ${selectedLoanIds.length} loan(s)?`)) return;
    selectedLoanIds.forEach(loanId => {
      if (onWaiveFee) onWaiveFee(loanId, 'Bulk administrative fee waiver');
    });
    setSelectedLoanIds([]);
  };
  const [showBookModal, setShowBookModal] = useState(false);
  const [editingBookId, setEditingBookId] = useState<string | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('Classic Literature');
  const [isReferenceOnly, setIsReferenceOnly] = useState(false);
  const [totalCopies, setTotalCopies] = useState(3);
  const [shelfLocation, setShelfLocation] = useState('Fiction - Aisle 1');
  const [coverUrl, setCoverUrl] = useState('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80');
  const [description, setDescription] = useState('');
  const [publisher, setPublisher] = useState('Scholastic');
  const [publicationYear, setPublicationYear] = useState(2022);

  // Print Label Selection
  const [selectedLabelBook, setSelectedLabelBook] = useState<Book | null>(books[0] || null);

  // Settings State
  const [policyMaxBorrowDays, setPolicyMaxBorrowDays] = useState(settings.maxBorrowDays || 14);
  const [policyLateFeeRate, setPolicyLateFeeRate] = useState(settings.lateFeePerDay || 0.50);
  const [policyMaxRenewals, setPolicyMaxRenewals] = useState(settings.maxRenewals || 2);
  const [policyMaxBooksStudent, setPolicyMaxBooksStudent] = useState(settings.maxBooksPerStudent || 3);
  const [policyGracePeriodDays, setPolicyGracePeriodDays] = useState(settings.gracePeriodDays ?? 2);
  const [policyMaxBooksStaff, setPolicyMaxBooksStaff] = useState(settings.maxBooksPerStaff ?? 7);
  const [policyStaffBorrowDays, setPolicyStaffBorrowDays] = useState(settings.staffBorrowDays ?? 30);
  const [policyMaxActiveReservations, setPolicyMaxActiveReservations] = useState(settings.maxActiveReservations ?? 2);
  const [policyHoldExpiryDays, setPolicyHoldExpiryDays] = useState(settings.holdExpiryDays ?? 3);
  const [policyLostBookReplacementFee, setPolicyLostBookReplacementFee] = useState(settings.lostBookReplacementFee ?? 15.00);
  const [policyAllowRefCheckoutStaff, setPolicyAllowRefCheckoutStaff] = useState(settings.allowReferenceCheckoutForStaff ?? true);
  const [policyMaxOverdueFineCap, setPolicyMaxOverdueFineCap] = useState(settings.maxOverdueFineCap ?? 25.00);
  const [policyBlockBorrowingFineThreshold, setPolicyBlockBorrowingFineThreshold] = useState(settings.blockBorrowingFineThreshold ?? 10.00);
  const [policyAllowRecallRequests, setPolicyAllowRecallRequests] = useState(settings.allowRecallRequests ?? true);
  const [policyHolidayGraceDays, setPolicyHolidayGraceDays] = useState(settings.holidayGraceDays ?? true);
  const [policySummerVacationCheckout, setPolicySummerVacationCheckout] = useState(settings.summerVacationCheckout ?? false);
  const [policyAutoEmailRemindersDaysBefore, setPolicyAutoEmailRemindersDaysBefore] = useState(settings.autoEmailRemindersDaysBefore ?? 2);
  const [policyDamagedBookMinorFee, setPolicyDamagedBookMinorFee] = useState(settings.damagedBookMinorFee ?? 3.00);
  const [policyNoteText, setPolicyNoteText] = useState(settings.policyNote || 'Books must be returned in good condition. Fines apply daily after grace period.');
  const [policyAlertEmail, setPolicyAlertEmail] = useState(settings.alertEmail || 'library-alerts@fmagoodhooschool.edu.mv');
  const [policyAlertSmsNumber, setPolicyAlertSmsNumber] = useState(settings.alertSmsNumber || '+9607771111');
  const [policyEnableAutoDueDateAlerts, setPolicyEnableAutoDueDateAlerts] = useState(settings.enableAutoDueDateAlerts ?? true);
  const [policyNotifyParentOnOverdue, setPolicyNotifyParentOnOverdue] = useState(settings.notifyParentOnOverdue ?? true);
  const [settingsSavedMessage, setSettingsSavedMessage] = useState(false);

  // Sync settings when loaded or updated from Firestore
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
      if (settings.summerVacationCheckout !== undefined) setPolicySummerVacationCheckout(settings.summerVacationCheckout);
      if (settings.autoEmailRemindersDaysBefore !== undefined) setPolicyAutoEmailRemindersDaysBefore(settings.autoEmailRemindersDaysBefore);
      if (settings.damagedBookMinorFee !== undefined) setPolicyDamagedBookMinorFee(settings.damagedBookMinorFee);
      if (settings.policyNote) setPolicyNoteText(settings.policyNote);
      if (settings.alertEmail) setPolicyAlertEmail(settings.alertEmail);
      if (settings.alertSmsNumber) setPolicyAlertSmsNumber(settings.alertSmsNumber);
      if (settings.enableAutoDueDateAlerts !== undefined) setPolicyEnableAutoDueDateAlerts(settings.enableAutoDueDateAlerts);
      if (settings.notifyParentOnOverdue !== undefined) setPolicyNotifyParentOnOverdue(settings.notifyParentOnOverdue);
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

    // Calculate days overdue
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
        let parentNotice = '';
        if (policyNotifyParentOnOverdue && parentUser?.email) {
          parentNotice = ` (Copy also forwarded to Parent: ${parentUser.email})`;
        }
        setDispatchStatusMessage(
          language === 'dv'
            ? `"${loan.bookTitle}" އަށް މުއްދަތު ހަމަވިކަމުގެ އިންޒާރު ފޮނުވިއްޖެ! (${data.recipientEmail})${parentNotice}`
            : `Overdue alert dispatched to ${loan.userName} (${data.recipientEmail}) & predefined admin email (${policyAlertEmail})!${parentNotice}`
        );
      } else {
        setDispatchStatusMessage(`Error: ${data.error || 'Failed to dispatch alert.'}`);
      }
    } catch (err: any) {
      setDispatchStatusMessage(`Failed to connect to notification gateway: ${err.message}`);
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
    setCoverUrl('https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=600&q=80');
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
      barcode: barcode.trim() || isbn.trim() || `978${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      category,
      isReferenceOnly,
      totalCopies: Number(totalCopies),
      availableCopies: Number(totalCopies),
      shelfLocation: shelfLocation.trim(),
      coverUrl: coverUrl.trim(),
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
      summerVacationCheckout: policySummerVacationCheckout,
      autoEmailRemindersDaysBefore: policyAutoEmailRemindersDaysBefore,
      damagedBookMinorFee: policyDamagedBookMinorFee,
      policyNote: policyNoteText,
      alertEmail: policyAlertEmail,
      alertSmsNumber: policyAlertSmsNumber,
      enableAutoDueDateAlerts: policyEnableAutoDueDateAlerts,
      notifyParentOnOverdue: policyNotifyParentOnOverdue,
    });
    setSettingsSavedMessage(true);
    setTimeout(() => setSettingsSavedMessage(false), 3000);
  };

  const overdueLoans = loans.filter(l => l.status === 'overdue' || (l.lateFee > 0 && !l.feePaid));

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 text-slate-900 border border-slate-200 shadow-xl relative overflow-hidden">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center gap-2 bg-amber-100 text-amber-900 border border-amber-200 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider">
            <Shield className="w-3.5 h-3.5 text-amber-600" /> {t.adminInventory}
          </div>
          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900">
            {t.adminInventory}
          </h2>
          <p className="text-xs sm:text-sm text-slate-600 font-medium">
            {language === 'dv'
              ? 'ފޮތްތައް އިތުރުކުރުމާއި، ބާކޯޑް ޕްރިންޓްކުރުމާއި، ޖޫރިމަނާ އަދި ލައިބްރަރީގެ އުޞޫލުތައް ބެލެހެއްޓެވުން.'
              : 'Catalog new titles, edit reference flags, print barcode labels, oversee late fees, and manage school library circulation policies.'}
          </p>
        </div>
      </div>

      {/* Admin Tab Switcher */}
      <div className="flex bg-white rounded-2xl border border-slate-200 p-1.5 shadow-md overflow-x-auto scrollbar-none">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'inventory' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-inventory-tab"
        >
          <BookOpen className="w-4 h-4" /> {language === 'dv' ? 'ފޮތްތަކުގެ އިންވެންޓްރީ' : 'Book Inventory'} ({books.length})
        </button>

        <button
          onClick={() => setActiveTab('late-fees')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'late-fees' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-late-fees-tab"
        >
          <DollarSign className="w-4 h-4" /> {language === 'dv' ? 'ޖޫރިމަނާ އަދި މުއްދަތު ހަމަވެފައި' : 'Overdue & Late Fees'} ({overdueLoans.length})
        </button>

        <button
          onClick={() => setActiveTab('barcode-labels')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'barcode-labels' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-barcode-tab"
        >
          <QrCode className="w-4 h-4" /> {language === 'dv' ? 'ބާކޯޑް ލޭބަލް ޕްރިންޓް' : 'Print Barcode Labels'}
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'users' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-users-tab"
        >
          <Users className="w-4 h-4" /> {language === 'dv' ? 'މެންބަރުން އަދި އެކައުންޓްތައް' : 'Users & Parent Accounts'} ({users.length})
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'settings' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-settings-tab"
        >
          <Settings className="w-4 h-4" /> {language === 'dv' ? 'ލައިބްރަރީ އުޞޫލުތައް' : 'Library Policies'}
        </button>

        <button
          onClick={() => setActiveTab('audit-logs')}
          className={`flex-1 min-w-[140px] py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'audit-logs' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
          id="admin-audit-logs-tab"
        >
          <Activity className="w-4 h-4" /> {language === 'dv' ? 'ސިސްޓަމް އޮޑިޓް ލޮގް' : 'System Audit Log'}
        </button>
      </div>

      {/* TAB 1: INVENTORY MANAGEMENT */}
      {activeTab === 'inventory' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="text-base font-black text-slate-900">Manage Cataloged Books</h3>
              <p className="text-xs text-slate-500 font-medium">Add, edit, bulk import, export CSV, or set books as Reference Only</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => handleExportCsv(books)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
                title="Export complete inventory to CSV file"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" /> Export Inventory (CSV)
              </button>
              {onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('books')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 border border-slate-300 cursor-pointer"
                  id="admin-import-books-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600" /> Import Books CSV
                </button>
              )}
              <button
                onClick={openNewBookModal}
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
                id="add-new-book-btn"
              >
                <Plus className="w-4 h-4" /> Add New Book Record
              </button>
            </div>
          </div>

          {/* Bulk Selection Action Strip */}
          {selectedBookIds.length > 0 && (
            <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2 animate-in fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-amber-950">
                  {selectedBookIds.length} book(s) selected
                </span>
                <button
                  onClick={() => setSelectedBookIds([])}
                  className="text-[11px] text-amber-800 underline font-semibold hover:text-amber-950 cursor-pointer"
                >
                  Clear Selection
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => handleExportCsv(books.filter(b => selectedBookIds.includes(b.id)))}
                  className="px-3 py-1.5 bg-white border border-amber-300 text-amber-900 rounded-xl text-xs font-bold shadow-xs hover:bg-amber-100 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" /> Export Selected CSV
                </button>
                <button
                  onClick={() => handleBulkToggleReference(true)}
                  className="px-3 py-1.5 bg-sky-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-sky-700 transition cursor-pointer"
                >
                  Set Reference Only
                </button>
                <button
                  onClick={() => handleBulkToggleReference(false)}
                  className="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-emerald-700 transition cursor-pointer"
                >
                  Set Circulating
                </button>
                <button
                  onClick={handleBulkDeleteBooks}
                  className="px-3 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold shadow-xs hover:bg-rose-700 transition flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Delete Selected
                </button>
              </div>
            </div>
          )}

          {/* DENSE DESKTOP TABLE WITH STICKY HEADERS */}
          <div className="overflow-x-auto max-h-[620px] border border-slate-200 rounded-2xl bg-white shadow-sm scrollbar-thin">
            <table className="w-full text-start text-xs text-slate-700">
              <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200 shadow-xs">
                <tr>
                  <th className="p-3 w-10 text-center border-e border-slate-200">
                    <input
                      type="checkbox"
                      checked={selectedBookIds.length === books.length && books.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedBookIds(books.map(b => b.id));
                        else setSelectedBookIds([]);
                      }}
                      className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3 border-e border-slate-200">{language === 'dv' ? 'ފޮތުގެ ނަން / މުސަންނިފު' : 'Book Title / Author'}</th>
                  <th className="p-3 border-e border-slate-200">{language === 'dv' ? 'ބައި' : 'Category'}</th>
                  <th className="p-3 border-e border-slate-200">{language === 'dv' ? 'ބާވަތް' : 'Type'}</th>
                  <th className="p-3 border-e border-slate-200">{language === 'dv' ? 'އައި.އެސް.ބީ.އެން / ބާކޯޑު' : 'ISBN / Barcode'}</th>
                  <th className="p-3 border-e border-slate-200">{t.shelfLocation}</th>
                  <th className="p-3 border-e border-slate-200">{t.copiesLabel}</th>
                  <th className="p-3 text-end">{language === 'dv' ? 'ޢަމަލުތައް' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {books.map(book => {
                  const isChecked = selectedBookIds.includes(book.id);
                  return (
                    <tr key={book.id} className={`hover:bg-slate-50 transition ${isChecked ? 'bg-amber-50/60' : ''}`}>
                      <td className="p-3 w-10 text-center border-e border-slate-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            setSelectedBookIds(prev =>
                              prev.includes(book.id) ? prev.filter(x => x !== book.id) : [...prev, book.id]
                            );
                          }}
                          className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 border-e border-slate-100">
                        <div className="flex items-center gap-3">
                          <img src={book.coverUrl} alt="" className="w-8 h-12 object-cover rounded-xl shadow border border-slate-200 shrink-0" />
                          <div>
                            <div className="font-extrabold text-slate-900"><bdi>{book.title}</bdi></div>
                            <div className="text-[11px] text-slate-500 font-medium">{t.byAuthor} <bdi>{book.author}</bdi></div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 border-e border-slate-100 font-bold text-slate-700">{book.category}</td>
                      <td className="p-3 border-e border-slate-100">
                        {book.isReferenceOnly ? (
                          <span className="bg-sky-100 text-sky-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-sky-300">
                            {t.statusReferenceOnly}
                          </span>
                        ) : (
                          <span className="bg-emerald-100 text-emerald-900 font-extrabold text-[10px] px-2.5 py-0.5 rounded-full border border-emerald-300">
                            {t.circulating}
                          </span>
                        )}
                      </td>
                      <td className="p-3 border-e border-slate-100 font-mono text-[11px] text-slate-600 font-bold"><bdi>{book.barcode}</bdi></td>
                      <td className="p-3 border-e border-slate-100 font-bold text-slate-700"><bdi>{book.shelfLocation}</bdi></td>
                      <td className="p-3 border-e border-slate-100 font-extrabold text-slate-900"><bdi>{book.availableCopies} / {book.totalCopies}</bdi></td>
                      <td className="p-3 text-end">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditBookModal(book)}
                            className="p-1.5 text-indigo-600 hover:bg-slate-100 rounded-xl transition font-bold cursor-pointer"
                            title={t.editBook}
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => onDeleteBook(book.id)}
                            className="p-1.5 text-rose-600 hover:bg-slate-100 rounded-xl transition font-bold cursor-pointer"
                            title={t.deleteBook}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* TAB 2: OVERDUE & LATE FEES & NOTIFICATIONS */}
      {activeTab === 'late-fees' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <BellRing className="w-5 h-5 text-rose-600" />
                {language === 'dv' ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކާއި، އީމެއިލް / އެސް.އެމް.އެސް އިންޒާރު' : 'Overdue Due Date Email & SMS Notification Center'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {language === 'dv'
                  ? `މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކުގެ މައުލޫމާތު އަދި ކަނޑައެޅިފައިވާ އީމެއިލް (${policyAlertEmail}) އަށް އިންޒާރު ފޮނުއްވުން`
                  : `Automated & manual email/SMS alerts to students, parents, and predefined admin alert email (${policyAlertEmail})`}
              </p>
            </div>

            {overdueLoans.length > 0 && (
              <button
                onClick={() => {
                  overdueLoans.forEach(loan => handleDispatchOverdueAlert(loan, 'both'));
                }}
                className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow-md transition flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Send className="w-4 h-4 text-amber-200" />
                {language === 'dv' ? 'ހުރިހާ މުއްދަތު ހަމަވި ފޮތްތަކަށް އީމެއިލް ފޮނުއްވާ' : `Dispatch All Overdue Alerts to ${policyAlertEmail}`}
              </button>
            )}
          </div>

          {dispatchStatusMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl text-xs font-bold flex items-center gap-2.5 shadow-sm animate-in fade-in">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{dispatchStatusMessage}</span>
            </div>
          )}

          {overdueLoans.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium">
              No overdue loans or unpaid fees currently recorded!
            </div>
          ) : (
            <div className="space-y-3">
              {/* Bulk Loan Actions Strip */}
              {selectedLoanIds.length > 0 && (
                <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-2 animate-in fade-in shadow-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-rose-950">
                      {selectedLoanIds.length} overdue loan(s) selected
                    </span>
                    <button
                      onClick={() => setSelectedLoanIds([])}
                      className="text-[11px] text-rose-800 underline font-semibold hover:text-rose-950 cursor-pointer"
                    >
                      Clear Selection
                    </button>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleBulkMarkReturned}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Bulk Mark Returned ({selectedLoanIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={handleBulkWaiveFees}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition flex items-center gap-1.5 cursor-pointer"
                    >
                      <DollarSign className="w-3.5 h-3.5" /> Waive Selected Fines
                    </button>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto max-h-[550px] border border-slate-200 rounded-2xl bg-white shadow-sm scrollbar-thin">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200 shadow-xs">
                    <tr>
                      <th className="p-3 w-10 text-center border-e border-slate-200">
                        <input
                          type="checkbox"
                          checked={selectedLoanIds.length === overdueLoans.length && overdueLoans.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedLoanIds(overdueLoans.map(l => l.id));
                            else setSelectedLoanIds([]);
                          }}
                          className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                        />
                      </th>
                      <th className="p-3">Borrower Student</th>
                      <th className="p-3">Book Title</th>
                      <th className="p-3">Due Date</th>
                      <th className="p-3">Calculated Fee</th>
                      <th className="p-3">Payment Status</th>
                      <th className="p-3 text-center">Send Email / SMS Alert</th>
                      <th className="p-3 text-right">Fee Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                  {overdueLoans.map(loan => {
                    const borrower = users.find(u => u.id === loan.userId);
                    const recipientEmail = borrower?.email || policyAlertEmail;
                    const recipientPhone = borrower?.phone || policyAlertSmsNumber;
                    const subject = encodeURIComponent(`OVERDUE NOTICE: Return needed for "${loan.bookTitle}" - Magoodhoo Library`);
                    const body = encodeURIComponent(`Dear ${loan.userName},\n\nYour borrowed book "${loan.bookTitle}" is overdue (Due Date: ${loan.dueDate}).\nLate fee accrued: $${loan.lateFee.toFixed(2)}.\n\nPlease return this book to Magoodhoo School Library as soon as possible.\n\nThank you.`);

                    return (
                      <tr key={loan.id} className={`hover:bg-slate-50 transition ${selectedLoanIds.includes(loan.id) ? 'bg-rose-50/60' : ''}`}>
                        <td className="p-3 w-10 text-center border-e border-slate-100">
                          <input
                            type="checkbox"
                            checked={selectedLoanIds.includes(loan.id)}
                            onChange={() => {
                              setSelectedLoanIds(prev =>
                                prev.includes(loan.id) ? prev.filter(x => x !== loan.id) : [...prev, loan.id]
                              );
                            }}
                            className="w-4 h-4 rounded text-rose-600 focus:ring-rose-500 cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <div className="font-extrabold text-slate-900">{loan.userName}</div>
                          <div className="text-[10px] text-slate-500">{borrower?.email || loan.userGrade}</div>
                        </td>
                        <td className="p-3 font-bold text-slate-800">{loan.bookTitle}</td>
                        <td className="p-3 font-mono text-rose-700 font-extrabold"><bdi>{loan.dueDate}</bdi></td>
                        <td className="p-3 font-mono text-base font-black text-rose-600"><bdi>${loan.lateFee.toFixed(2)}</bdi></td>
                        <td className="p-3">
                          {loan.feePaid ? (
                            <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                              Paid
                            </span>
                          ) : (
                            <span className="bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full">
                              Unpaid Fee
                            </span>
                          )}
                        </td>

                        {/* Email & SMS Alert Dispatch Column */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5 flex-wrap">
                            <button
                              type="button"
                              disabled={isDispatching === loan.id}
                              onClick={() => handleDispatchOverdueAlert(loan, 'both')}
                              className="bg-amber-500 hover:bg-amber-600 text-white font-extrabold text-[10px] px-2.5 py-1.5 rounded-lg shadow-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                              title="Send API Email & SMS Notification"
                            >
                              <Send className="w-3 h-3" />
                              {isDispatching === loan.id ? 'Sending...' : 'Send Alert'}
                            </button>

                            <a
                              href={`mailto:${recipientEmail}?cc=${encodeURIComponent(policyAlertEmail)}&subject=${subject}&body=${body}`}
                              className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 font-bold text-[10px] px-2 py-1.5 rounded-lg transition flex items-center gap-1"
                              title="Open in Email App"
                            >
                              <Mail className="w-3 h-3 text-blue-600" /> Mailto
                            </a>

                            {recipientPhone && (
                              <a
                                href={`sms:${recipientPhone}?body=${encodeURIComponent(`Magoodhoo Library Notice: "${loan.bookTitle}" is overdue. Please return to desk.`)}`}
                                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-bold text-[10px] px-2 py-1.5 rounded-lg transition flex items-center gap-1"
                                title="Open SMS"
                              >
                                <Smartphone className="w-3 h-3 text-emerald-600" /> SMS
                              </a>
                            )}
                          </div>
                        </td>

                        <td className="p-3 text-right">
                          {!loan.feePaid ? (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => onMarkFeePaid(loan.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] px-2.5 py-1.5 rounded-xl transition shadow cursor-pointer shrink-0"
                              >
                                Collect (${loan.lateFee.toFixed(2)})
                              </button>
                              <button
                                onClick={() => {
                                  setWaivingLoan(loan);
                                  setWaiveReason('Medical absence / Authorized discretion');
                                }}
                                className="bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 font-extrabold text-[11px] px-2.5 py-1.5 rounded-xl transition cursor-pointer shrink-0"
                                title="Librarian Fine Waiver Override"
                              >
                                Waive (Override)
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded-md border border-emerald-200">
                              Resolved
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
      )}

      {/* TAB 3: BARCODE LABEL GENERATOR */}
      {activeTab === 'barcode-labels' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div>
            <h3 className="text-base font-black text-slate-900">Physical Barcode Label Generator</h3>
            <p className="text-xs text-slate-500 font-medium">Select any book in the inventory to generate printable barcode labels for physical book spines.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700">Select Book To Print Label:</label>
              <select
                value={selectedLabelBook?.id || ''}
                onChange={(e) => {
                  const b = books.find(x => x.id === e.target.value);
                  if (b) setSelectedLabelBook(b);
                }}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900 font-bold focus:outline-none"
              >
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title} - Barcode: {b.barcode}</option>
                ))}
              </select>

              <button
                onClick={() => window.print()}
                className="w-full bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs py-2.5 rounded-xl transition flex items-center justify-center gap-2 shadow"
              >
                <Printer className="w-4 h-4" /> Print Barcode Label Sheet
              </button>
            </div>

            {/* Label Preview Card */}
            {selectedLabelBook && (
              <div className="border-2 border-dashed border-slate-300 p-6 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-center space-y-2">
                <div className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">Oakridge Library Spine Label</div>
                <div className="text-sm font-black text-slate-900">{selectedLabelBook.title}</div>
                <div className="text-xs font-bold text-slate-600">Location: {selectedLabelBook.shelfLocation}</div>
                
                {/* Simulated Barcode */}
                <div className="bg-white px-6 py-3 border border-slate-300 rounded-xl shadow space-y-1 my-2">
                  <div className="font-mono text-2xl tracking-[0.2em] font-black text-slate-900">
                    |||||| | |||| | ||||||
                  </div>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    {selectedLabelBook.barcode}
                  </div>
                </div>

                {selectedLabelBook.isReferenceOnly && (
                  <span className="bg-amber-500 text-white font-extrabold text-[10px] px-3 py-0.5 rounded-full uppercase shadow">
                    REFERENCE ONLY
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: USERS & PARENT ACCOUNTS */}
      {activeTab === 'users' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-4 border-b pb-4 border-slate-100">
            <div>
              <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" /> Member & Parent Account Directory
              </h3>
              <p className="text-xs text-slate-500 font-medium">Manage registered parent accounts, student links, and member profiles</p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {onOpenReportCardSyncModal && (
                <button
                  onClick={onOpenReportCardSyncModal}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-extrabold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-xs"
                  id="admin-reportcard-sync-btn"
                  title="Real-Time Cloud Firestore Sync with https://reportcard-fmagoodhooschool.vercel.app/"
                >
                  <Zap className="w-4 h-4 text-indigo-600" />
                  <span>{language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ލައިވް ސިންކް' : 'Report Card Live Sync'}</span>
                </button>
              )}
              {onOpenImportModal && (
                <button
                  onClick={() => onOpenImportModal('parents')}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs px-3.5 py-2.5 rounded-xl transition flex items-center gap-2 border border-slate-300 cursor-pointer"
                  id="admin-import-parents-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" /> Import Parents CSV
                </button>
              )}
              {onOpenAddParentModal && (
                <button
                  onClick={onOpenAddParentModal}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs px-4 py-2.5 rounded-xl shadow transition flex items-center gap-2 cursor-pointer"
                  id="admin-add-parent-account-btn"
                >
                  <Plus className="w-4 h-4" /> Register New Parent Account
                </button>
              )}
            </div>
          </div>

          {/* Parent Accounts List */}
          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-purple-600" /> Parent Accounts ({users.filter(u => u.role === 'parent').length})
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {users.filter(u => u.role === 'parent').map((parent) => {
                const children = users.filter(u => u.parentId === parent.id || parent.childrenIds?.includes(u.id));

                return (
                  <div key={parent.id} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 relative group">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                          {parent.name}
                          <span className="bg-purple-100 text-purple-900 text-[10px] px-2 py-0.5 rounded-full border border-purple-200 font-bold">
                            Parent
                          </span>
                        </div>
                        <div className="text-xs text-slate-500 font-medium mt-0.5">{parent.email}</div>
                      </div>

                      {onDeleteUser && (
                        <button
                          onClick={() => onDeleteUser(parent.id)}
                          className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold text-[11px] px-2.5 py-1 rounded-xl transition flex items-center gap-1 shrink-0"
                          title="Remove Parent Account"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Remove
                        </button>
                      )}
                    </div>

                    {/* Linked Children */}
                    <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5 shadow-sm">
                      <div className="text-[11px] font-bold text-purple-900">
                        Linked Student Children ({children.length}):
                      </div>
                      {children.length === 0 ? (
                        <div className="text-[11px] text-slate-400 italic">No student children linked to this parent.</div>
                      ) : (
                        <div className="space-y-1">
                          {children.map(c => (
                            <div key={c.id} className="text-xs text-slate-800 font-bold flex items-center justify-between bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                              <span>{c.name} ({c.grade})</span>
                              <span className="font-mono text-[10px] text-slate-500">ID: {c.studentIdCode}</span>
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

          {/* Student Members List */}
          <div className="space-y-3 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">
              Student Members ({users.filter(u => u.role === 'student').length})
            </h4>

            <div className="overflow-x-auto border border-slate-200 rounded-2xl bg-white shadow-sm">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-100 text-slate-600 font-extrabold uppercase text-[10px] border-b border-slate-200">
                  <tr>
                    <th className="p-3">Student Name</th>
                    <th className="p-3">Grade</th>
                    <th className="p-3">Student ID Barcode</th>
                    <th className="p-3">Linked Parent</th>
                    <th className="p-3 text-right">Admin Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.filter(u => u.role === 'student').map(student => {
                    const parent = users.find(u => u.id === student.parentId || u.childrenIds?.includes(student.id));
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition">
                        <td className="p-3 font-extrabold text-slate-900">{student.name}</td>
                        <td className="p-3 font-bold text-slate-700">{student.grade}</td>
                        <td className="p-3 font-mono text-indigo-700 font-bold">{student.studentIdCode || 'N/A'}</td>
                        <td className="p-3 text-slate-700 font-medium">
                          {parent ? (
                            <span className="text-purple-900 font-bold">{parent.name}</span>
                          ) : (
                            <span className="text-slate-400 italic">Unlinked</span>
                          )}
                        </td>
                        <td className="p-3 text-right">
                          {onDeleteUser && (
                            <button
                              onClick={() => onDeleteUser(student.id)}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-800 border border-rose-300 font-bold text-[11px] px-2.5 py-1 rounded-xl transition inline-flex items-center gap-1"
                              title="Remove Student Account"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Remove
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

      {/* TAB 5: POLICY SETTINGS */}
      {activeTab === 'settings' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-black text-slate-900">
              {language === 'dv' ? 'ލައިބްރަރީ ސާކިއުލޭޝަން އުޞޫލުތަކާއި ގަވާއިދުތައް' : 'Library Circulation Rules & Policy Management'}
            </h3>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {language === 'dv'
                ? 'ފޮތް ދޫކުރުމުގެ މުއްދަތުތަކާއި، ކޯޓާތައް، ޖޫރިމަނާ އަދި ނަންނޯޓުކުރުމުގެ ގަވާއިދުތައް ކަނޑައެޅުއްވުން'
                : 'Configure checkout loan limits, renewal terms, hold durations, grace periods, and late fee structures'}
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6 text-xs">
            {/* Section 1: Loan Durations & Renewals */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <BookOpen className="w-4 h-4 text-blue-600" />
                {language === 'dv' ? 'ފޮތް ދޫކުރެވޭ މުއްދަތާއި އިތުރުކުރުން' : 'Loan Periods & Renewals'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދަރިވަރުންގެ މުއްދަތު (ދުވަސް)' : 'Student Loan Period (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxBorrowDays}
                    onChange={(e) => setPolicyMaxBorrowDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އާންމު ދަރިވަރުންނަށް ފޮތް ދޫކުރެވޭ މުއްދަތު' : 'Default loan period for students'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'މުވައްޒަފުންގެ މުއްދަތު (ދުވަސް)' : 'Staff/Faculty Loan Period (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyStaffBorrowDays}
                    onChange={(e) => setPolicyStaffBorrowDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުދައްރިސުންނަށް ފޮތް ދޫކުރެވޭ މުއްދަތު' : 'Extended period for teachers/staff'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ގްރޭސް ޕީރިއަޑް (ދުވަސް)' : 'Grace Period (Days)'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyGracePeriodDays}
                    onChange={(e) => setPolicyGracePeriodDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ޖޫރިމަނާ ހިނގަން ފެށުމުގެ ކުރިން ލިބޭ ލުއި' : 'Free days before late fine kicks in'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އޮންލައިންކޮށް އިތުރުކުރެވޭ މިންވަރު' : 'Max Online Renewals'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={policyMaxRenewals}
                    onChange={(e) => setPolicyMaxRenewals(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ކޮންމެ ފޮތަކަށް އިތުރުކުރެވޭނެ އެންމެ ގިނަ އަދަދު' : 'Max times a loan can be extended online'}</p>
                </div>
              </div>
            </div>

            {/* Section 2: Quotas & Holds */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Users className="w-4 h-4 text-purple-600" />
                {language === 'dv' ? 'ފޮތް ނެގުމުގެ ކޯޓާއާއި ރިޒަވޭޝަން' : 'Borrowing Limits & Reservations'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދަރިވަރަކަށް އެންމެ ގިނަވެގެން ފޮތް' : 'Max Books / Student'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxBooksStudent}
                    onChange={(e) => setPolicyMaxBooksStudent(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އެކަކަށް އެއްފަހަރާ ނެގޭނެ ފޮތުގެ އަދަދު' : 'Simultaneous student checkout limit'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'މުވައްޒަފަކަށް އެންމެ ގިނަވެގެން ފޮތް' : 'Max Books / Staff'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxBooksStaff}
                    onChange={(e) => setPolicyMaxBooksStaff(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުދައްރިސުންނަށް އެއްފަހަރާ ނެގޭނެ ކޯޓާ' : 'Simultaneous staff checkout limit'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އެންމެ ގިނަވެގެން ރިޒަވޭޝަން' : 'Max Reservations / User'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyMaxActiveReservations}
                    onChange={(e) => setPolicyMaxActiveReservations(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އޮންލައިންކޮށް އެކަކަށް ނަންނޯޓު ކުރެވޭނެ އަދަދު' : 'Simultaneous hold requests allowed'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ރިޒަވޭޝަން ހޯލްޑް މުއްދަތު (ދުވަސް)' : 'Hold Desk Expiry (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={policyHoldExpiryDays}
                    onChange={(e) => setPolicyHoldExpiryDays(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ޑެސްކުގައި ފޮތް ބަހައްޓައިދޭނެ ދުވަސް' : 'Days held before reservation expires'}</p>
                </div>
              </div>
            </div>

            {/* Section 3: Fees & Fine Caps */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <DollarSign className="w-4 h-4 text-emerald-600" />
                {language === 'dv' ? 'ޖޫރިމަނާ، ފީ އަދި ސީލިންގް ގަވާއިދުތައް' : 'Fines, Maximum Caps & Damage Fees'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ދުވަހު ޖޫރިމަނާ ($)' : 'Daily Late Fee Rate ($/day)'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={policyLateFeeRate}
                    onChange={(e) => setPolicyLateFeeRate(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުއްދަތު ހަމަވާ ފަހުން ކޮންމެ ދުވަހަކަށް' : 'Daily fine assessed after grace period'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އެންމެ ބޮޑު ޖޫރިމަނާ ކެޕް ($)' : 'Max Fine Cap / Loan ($)'}
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min={0}
                    value={policyMaxOverdueFineCap}
                    onChange={(e) => setPolicyMaxOverdueFineCap(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'އެއް ފޮތަކުން ނެގެނޭ އެންމެ ބޮޑު ޖޫރިމަނާ' : 'Maximum fine accumulation limit per book'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ގެއްލޭ ފޮތުގެ ރީޕްލޭސްމަންޓް ފީ ($)' : 'Lost Item Processing Fee ($)'}
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min={0}
                    value={policyLostBookReplacementFee}
                    onChange={(e) => setPolicyLostBookReplacementFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ފޮތް ގެއްލުމުން ނެގޭ އެޑްމިން ފީ' : 'Flat administrative processing fee'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ކުދި ހަލާކު/ބާކޯޑު ފީ ($)' : 'Minor Damage / Tag Fee ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.50"
                    min={0}
                    value={policyDamagedBookMinorFee}
                    onChange={(e) => setPolicyDamagedBookMinorFee(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'ކުދި ހަލާކު ނުވަތަ ބާކޯޑު ގެއްލުމުން' : 'Fee for minor cover damage or tag loss'}</p>
                </div>
              </div>
            </div>

            {/* Section 4: Account Restrictions & System Controls */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2 border-b border-slate-200 pb-2">
                <Shield className="w-4 h-4 text-indigo-600" />
                {language === 'dv' ? 'އެކައުންޓް ބްލޮކްކުރުމާއި، ކެލެންޑަރ އަދި ނޮޓިފިކޭޝަން ގަވާއިދު' : 'Borrowing Block Thresholds, Calendar Rules & Automated Reminders'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'ފޮތް ނެގުން ބްލޮކްވާ ޖޫރިމަނާ ލިމިޓް ($)' : 'Block Checkout Fine Limit ($)'}
                  </label>
                  <input
                    type="number"
                    step="1.00"
                    min={0}
                    value={policyBlockBorrowingFineThreshold}
                    onChange={(e) => setPolicyBlockBorrowingFineThreshold(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މިއަށްވުރެ ގިނައިން ޖޫރިމަނާ އޮތްނަމަ ފޮތް ނުނެގޭނެ' : 'Unpaid balance that suspends new checkouts'}</p>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === 'dv' ? 'އޮޓޯ މެސެޖް ފޮނުވާނެ ދުވަސް (ކުރިން)' : 'Auto Email Advance Notice (Days)'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={7}
                    value={policyAutoEmailRemindersDaysBefore}
                    onChange={(e) => setPolicyAutoEmailRemindersDaysBefore(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">{language === 'dv' ? 'މުއްދަތު ހަމަވުމުގެ ކިތައް ދުވަސް ކުރިން؟' : 'Days prior to due date to send reminder'}</p>
                </div>

                <div className="flex flex-col justify-center space-y-2">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyHolidayGraceDays}
                      onChange={(e) => setPolicyHolidayGraceDays(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-bold text-xs text-slate-800">
                      {language === 'dv' ? 'ބަންދު ދުވަސްތަކުގައި ޖޫރިމަނާ ހިނގުން ހުއްޓުވުން' : 'Pause Fines During School Holidays & Weekends'}
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyAllowRecallRequests}
                      onChange={(e) => setPolicyAllowRecallRequests(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-bold text-xs text-slate-800">
                      {language === 'dv' ? 'އަވަސް ރީކޯލް (Recall) ހުއްދަދިނުން' : 'Enable Librarian Emergency Recall Requests'}
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policySummerVacationCheckout}
                      onChange={(e) => setPolicySummerVacationCheckout(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-bold text-xs text-slate-800">
                      {language === 'dv' ? 'ބޮޑު ބަންދުގެ އިތުރު ފޮތް ދޫކުރުން' : 'Allow Vacation Long-Term Summer Loans'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 5: Predefined Due Date Email & SMS Alert Gateway */}
            <div className="bg-gradient-to-br from-amber-50/60 to-orange-50/60 p-5 rounded-2xl border border-amber-200/80 space-y-4">
              <h4 className="font-extrabold text-amber-950 text-sm flex items-center gap-2 border-b border-amber-200/80 pb-2">
                <BellRing className="w-4 h-4 text-amber-600" />
                {language === 'dv' ? 'މުއްދަތު ހަމަވުމުން އިންޒާރު ފޮނުވާ އީމެއިލް އަދި އެސް.އެމް.އެސް ފޮނުވާ ނަންބަރު' : 'Predefined Due Date Email & SMS Notification Gateway'}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-amber-950 mb-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-amber-700" />
                    {language === 'dv' ? 'އިންޒާރު ފޮނުވާ އީމެއިލް (Predefined Alert Email)' : 'Predefined Admin/Library Alert Email'}
                  </label>
                  <input
                    type="email"
                    value={policyAlertEmail}
                    onChange={(e) => setPolicyAlertEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. library-alerts@fmagoodhooschool.edu.mv"
                  />
                  <p className="text-[10px] text-amber-800/80 mt-1">
                    {language === 'dv' ? 'ފޮތުގެ މުއްދަތު ހަމަވުމުން އޮޓޮމެޓިކުން މެސެޖު ކޮޕީ ފޮނުވާ އީމެއިލް' : 'All due date alerts will forward a copy to this predefined email address'}
                  </p>
                </div>

                <div>
                  <label className="block font-bold text-amber-950 mb-1 flex items-center gap-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-amber-700" />
                    {language === 'dv' ? 'އެސް.އެމް.އެސް ގޭޓްވޭ ނަންބަރު' : 'Predefined SMS Gateway Phone Number'}
                  </label>
                  <input
                    type="tel"
                    value={policyAlertSmsNumber}
                    onChange={(e) => setPolicyAlertSmsNumber(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    placeholder="e.g. +9607771111"
                  />
                  <p className="text-[10px] text-amber-800/80 mt-1">
                    {language === 'dv' ? 'އަވަސް އެސް.އެމް.އެސް މެސެޖު ފޮނުވާނެ ނަންބަރު' : 'Phone number used for SMS due date notifications'}
                  </p>
                </div>

                <div className="flex flex-col justify-center space-y-2.5 bg-white p-3.5 rounded-xl border border-amber-200">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyEnableAutoDueDateAlerts}
                      onChange={(e) => setPolicyEnableAutoDueDateAlerts(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-extrabold text-xs text-amber-950">
                      {language === 'dv' ? 'މުއްދަތު ހަމަވުމުން އޮޓޮމެޓިކުން އީމެއިލް / އެސް.އެމް.އެސް ފޮނުވުން' : 'Enable Automated Due Date Email & SMS Dispatches'}
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={policyNotifyParentOnOverdue}
                      onChange={(e) => setPolicyNotifyParentOnOverdue(e.target.checked)}
                      className="w-4 h-4 rounded text-amber-600 accent-amber-600"
                    />
                    <span className="font-extrabold text-xs text-amber-950">
                      {language === 'dv' ? 'ބެލެނިވެރިޔާގެ އީމެއިލަށްވެސް ކޮޕީއެއް ފޮނުވުން' : 'Include Parent Guardian Email in Overdue Alerts'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Section 6: Report Card Portal Live Sync Integration */}
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 rounded-2xl border border-indigo-500/30 space-y-3 relative overflow-hidden">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-500/20 border border-indigo-400/30 rounded-xl text-indigo-300">
                    <Zap className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <span>{language === 'dv' ? 'ރިޕޯޓް ކާޑު ޕޯޓަލް ލައިވް ސިންކް އިންޓަގްރޭޝަން' : 'Report Card Portal Cloud Firestore Live Sync'}</span>
                      <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-400/40 text-[10px] font-black px-2 py-0.5 rounded-full">
                        ⚡ Real-Time Active
                      </span>
                    </h4>
                    <p className="text-xs text-indigo-200 mt-0.5">
                      Target: <span className="underline font-mono">https://reportcard-fmagoodhooschool.vercel.app/</span>
                    </p>
                  </div>
                </div>

                {onOpenReportCardSyncModal && (
                  <button
                    type="button"
                    onClick={onOpenReportCardSyncModal}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span>{language === 'dv' ? 'ސިންކް ކޮންފިގަރޭޝަން ބައްލަވާ' : 'Configure Live Sync'}</span>
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-300 leading-relaxed">
                {language === 'dv'
                  ? 'ރިޕޯޓް ކާޑު ޕޯޓަލްގައި ދަރިވަރުން ނުވަތަ ބެލެނިވެރިންގެ މަޢުލޫމާތަށް ގެންނަ ކޮންމެ ބަދަލެއް ވަގުތުން މި ލައިބްރަރީ ސިސްޓަމަށް ސިންކް ވެއެވެ.'
                  : 'Every student enrollment, guardian update, and contact edit in the Report Card portal automatically syncs into this Library Member Directory in real-time via Cloud Firestore snapshot listeners & automated webhooks.'}
              </p>
            </div>

            {/* Section 7: Google Cloud Firestore Health & Quota Status Awareness */}
            <div className="bg-slate-900 text-slate-100 p-6 rounded-2xl border border-slate-800 space-y-4 shadow-sm" id="quota-status-awareness-section">
              <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl border ${isQuotaExhausted ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'}`}>
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-white flex items-center gap-2">
                      <span>{language === 'dv' ? 'ގޫގުލް ކްލައުޑް ފަޔަރސްޓޯރ ޑޭޓާބޭސް އަދި ކޯޓާ ހާލަތު' : 'Google Cloud Firestore & Quota Status Awareness'}</span>
                      <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full border ${
                        isQuotaExhausted
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      }`}>
                        {isQuotaExhausted
                          ? (language === 'dv' ? '⚠️ އޮފްލައިން ކޭޝް މޯޑް' : '⚠️ Offline Resilient Mode')
                          : (language === 'dv' ? '🟢 ޑޭޓާބޭސް ހެލްތީ' : '🟢 Active & Healthy')}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      DB ID: <span className="font-mono text-indigo-300">ai-studio-schoollibraryman-56cc5374-98f7-4bc3-b143-5a1e1844fbde</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleRunQuotaTest}
                    disabled={isTestingQuota}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shadow-sm"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isTestingQuota ? 'animate-spin' : ''}`} />
                    <span>{isTestingQuota ? (language === 'dv' ? 'ޓެސްޓްކުރަނީ...' : 'Testing...') : (language === 'dv' ? 'ޑައިގްނޯސްޓިކް ހައްދަވާ' : 'Run Diagnostics')}</span>
                  </button>

                  {isQuotaExhausted && (
                    <button
                      type="button"
                      onClick={() => resetQuotaStatus()}
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 border border-slate-700"
                      title="Clear local quota flag after daily UTC rollover"
                    >
                      <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                      <span>{language === 'dv' ? 'ރީސެޓް' : 'Reset Flag'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Quota Limits & Specs Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {language === 'dv' ? 'ދުވާލަކު ލިޔެވޭނެ މިންވަރު' : 'Daily Write Limit'}
                  </div>
                  <div className="text-sm font-black text-white mt-1">20,000 writes / day</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Google Cloud Free Tier</div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {language === 'dv' ? 'ދުވާލަކު ކިޔޭނެ މިންވަރު' : 'Daily Read Limit'}
                  </div>
                  <div className="text-sm font-black text-white mt-1">50,000 reads / day</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Google Cloud Free Tier</div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {language === 'dv' ? 'އޮޓޯ ރީސެޓް ވަގުތު' : 'Daily Quota Reset'}
                  </div>
                  <div className="text-sm font-black text-amber-400 mt-1">00:00 UTC (Midnight)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Automated 24h cycle</div>
                </div>

                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/60">
                  <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                    {language === 'dv' ? 'އޮފްލައިން ރެޒިލިއަންސް' : 'Offline Resilience'}
                  </div>
                  <div className="text-sm font-black text-emerald-400 mt-1">Enabled (Active)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Zero operational crashes</div>
                </div>
              </div>

              {/* Diagnostic Result Box */}
              {quotaTestResult && (
                <div className={`p-3.5 rounded-xl border text-xs font-semibold space-y-1.5 transition-all ${
                  quotaTestResult.healthy && quotaTestResult.writeQuotaAvailable
                    ? 'bg-emerald-950/60 border-emerald-600/60 text-emerald-200'
                    : 'bg-amber-950/60 border-amber-600/60 text-amber-200'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      {quotaTestResult.healthy ? 'Diagnostic Complete' : 'Diagnostic Notice'}
                    </span>
                    <span className="font-mono text-[11px] opacity-80">
                      Response: {quotaTestResult.latencyMs}ms
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-relaxed">
                    {quotaTestResult.message}
                  </p>
                  {quotaTestResult.details && (
                    <p className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-700/60">
                      Details: {quotaTestResult.details}
                    </p>
                  )}
                </div>
              )}

              {/* Explanatory Guide */}
              <div className="bg-slate-800/50 p-3.5 rounded-xl border border-slate-700/50 text-[11px] text-slate-300 leading-relaxed space-y-1.5">
                <p className="font-bold text-white flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>{language === 'dv' ? 'ކޯޓާ ހަމަވުމުން ސިސްޓަމް މަސައްކަތްކުރާ ގޮތް:' : 'How Quota Awareness & Offline Resilience Protect Your Work:'}</span>
                </p>
                <p>
                  {language === 'dv'
                    ? 'ފަޔަރސްޓޯރ ފްރީ ޓިއަރގެ 20,000 ލިޔުންތައް ހަމަވިނަމަވެސް، ލައިބްރަރީ ސިސްޓަމް ހުއްޓުމެއްނެތި ކުރިއަށްދާނެއެވެ. ފޮތް ދޫކުރުމާއި، އަނބުރާ ބަލައިގަތުމާއި، ބުކިންގް އަދި ކެޓަލޮގް އޮޕަރޭޝަންތައް ލޯކަލް ކޭޝްގައި ރައްކާކުރެވި، ޔޫސަރ އެކްސްޕީރިއަންސް އޮމާންކޮށް ހިފެހެއްޓެއެވެ.'
                    : 'If the Google Cloud free tier 20,000 daily writes are reached, the system will not crash. All checkouts, returns, cataloging, and reservations continue locally with optimistic updates and browser caching, while existing documents remain readable via snapshot streams.'}
                </p>
              </div>
            </div>

            {/* Section 8: Notice Note */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-2">
              <label className="block font-bold text-slate-800 text-xs">
                {language === 'dv' ? 'މެންބަރުންނަށް ފެންނާނެ އުޞޫލުގެ އިޢުލާން' : 'Public Policy Notice / Member Instructions'}
              </label>
              <textarea
                rows={2}
                value={policyNoteText}
                onChange={(e) => setPolicyNoteText(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Notice displayed on borrowings and portal screens..."
              />
            </div>

            {settingsSavedMessage && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-2 font-bold animate-fade-in">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                {language === 'dv' ? 'އުޞޫލުތައް ކާމިޔާބުކަމާއެކު އަދާހަމަކުރެވިއްޖެ!' : 'Circulation rules and settings saved successfully! All library desk policies updated.'}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-extrabold text-xs px-6 py-3 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {language === 'dv' ? 'އުޞޫލުތައް ސޭވްކުރައްވާ' : 'Save Circulation Rules'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 6: SYSTEM AUDIT LOG */}
      {activeTab === 'audit-logs' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-900 border border-amber-300 px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider mb-1.5">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                {language === 'dv' ? 'ސެކިއުރިޓީ އަދި ސިސްޓަމް ޓްރެކިންގ' : 'Security & Compliance Ledger'}
              </div>
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-indigo-600" />
                {language === 'dv' ? 'ސިސްޓަމް އޮޑިޓް ލޮގް (Audit Trail)' : 'System Audit Logs & Operations Ledger'}
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {language === 'dv'
                  ? 'ކެޓަލޮގަށް އިތުރުކުރެވޭ ފޮތްތަކާއި، ގެންނަ ބަދަލުތަކާއި، ފޮތް ދޫކުރުމާއި، އަނބުރާ ބަލައިގަތުން އަދި ޖޫރިމަނާ މާފުކުރުމުގެ ހުރިހާ ރެކޯޑެއް.'
                  : 'Tamper-evident logs of all book creations, edits, deletions, checkout issues, returns, renewals, and fine waiver overrides.'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={fetchAuditLogs}
                disabled={isLoadingAuditLogs}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-slate-300 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAuditLogs ? 'animate-spin' : ''}`} />
                <span>{language === 'dv' ? 'އަލުން ގެނޭ' : 'Refresh Logs'}</span>
              </button>
            </div>
          </div>

          {/* Action Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
              {language === 'dv' ? 'ފިލްޓަރ:' : 'Filter:'}
            </span>
            {[
              { id: 'ALL', label: language === 'dv' ? 'ހުރިހާ' : 'All Events' },
              { id: 'BOOK_CREATED', label: language === 'dv' ? 'ފޮތް އެޅުން' : 'Book Created' },
              { id: 'BOOK_UPDATED', label: language === 'dv' ? 'ފޮތް ބަދަލުކުރުން' : 'Book Updated' },
              { id: 'BOOK_DELETED', label: language === 'dv' ? 'ފޮތް ފޮހެލުން' : 'Book Deleted' },
              { id: 'LOAN_ISSUED', label: language === 'dv' ? 'ދޫކުރުން' : 'Loan Issued' },
              { id: 'LOAN_RETURNED', label: language === 'dv' ? 'އަނބުރާ ބަލައިގަތުން' : 'Loan Returned' },
              { id: 'LOAN_RENEWED', label: language === 'dv' ? 'އިތުރުކުރުން' : 'Loan Renewed' },
              { id: 'FINE_WAIVED', label: language === 'dv' ? 'ޖޫރިމަނާ މާފު' : 'Fine Waived' },
            ].map(pill => (
              <button
                key={pill.id}
                type="button"
                onClick={() => setAuditActionFilter(pill.id)}
                className={`px-3 py-1 rounded-xl text-xs font-extrabold transition cursor-pointer ${
                  auditActionFilter === pill.id
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* Audit Logs Table */}
          {isLoadingAuditLogs ? (
            <div className="p-12 text-center text-slate-500 space-y-2">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs font-bold">Loading security audit records...</p>
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="p-10 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-500 font-medium">
              No audit log records currently recorded in this session.
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[580px] border border-slate-200 rounded-2xl bg-white shadow-sm scrollbar-thin">
              <table className="w-full text-start text-xs text-slate-700">
                <thead className="sticky top-0 z-20 bg-slate-100/95 backdrop-blur-md text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200 shadow-xs">
                  <tr>
                    <th className="p-3 border-e border-slate-200">Timestamp</th>
                    <th className="p-3 border-e border-slate-200">Action Type</th>
                    <th className="p-3 border-e border-slate-200">Target Type & ID</th>
                    <th className="p-3 border-e border-slate-200">Operation Details</th>
                    <th className="p-3 text-end">Performed By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogs
                    .filter(log => auditActionFilter === 'ALL' || log.action === auditActionFilter)
                    .map((log: any) => {
                      const getBadgeColor = (action: string) => {
                        if (action === 'BOOK_CREATED') return 'bg-emerald-100 text-emerald-900 border-emerald-300';
                        if (action === 'BOOK_UPDATED') return 'bg-sky-100 text-sky-900 border-sky-300';
                        if (action === 'BOOK_DELETED') return 'bg-rose-100 text-rose-900 border-rose-300';
                        if (action === 'LOAN_ISSUED') return 'bg-purple-100 text-purple-900 border-purple-300';
                        if (action === 'LOAN_RETURNED') return 'bg-teal-100 text-teal-900 border-teal-300';
                        if (action === 'LOAN_RENEWED') return 'bg-amber-100 text-amber-900 border-amber-300';
                        if (action === 'FINE_WAIVED') return 'bg-indigo-100 text-indigo-900 border-indigo-300';
                        return 'bg-slate-100 text-slate-800 border-slate-300';
                      };

                      return (
                        <tr key={log.id} className="hover:bg-slate-50 transition">
                          <td className="p-3 border-e border-slate-100 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                            <bdi>{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</bdi>
                          </td>
                          <td className="p-3 border-e border-slate-100">
                            <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black border uppercase tracking-wider ${getBadgeColor(log.action)}`}>
                              {log.action}
                            </span>
                          </td>
                          <td className="p-3 border-e border-slate-100 font-mono text-[11px] font-bold text-slate-800">
                            <span className="uppercase text-[9px] text-slate-400 block">{log.targetType}</span>
                            <bdi>{log.targetId}</bdi>
                          </td>
                          <td className="p-3 border-e border-slate-100 text-slate-800 font-medium">
                            {log.details}
                          </td>
                          <td className="p-3 text-end whitespace-nowrap">
                            <div className="font-extrabold text-slate-900">{log.performedBy}</div>
                            <div className="text-[10px] uppercase font-bold text-slate-400">{log.userRole}</div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Book Modal */}
      {showBookModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBookModal(false);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-4 text-slate-800">
            <div className="flex items-center justify-between border-b pb-3 border-slate-100">
              <h3 className="text-base font-black text-slate-900">
                {editingBookId ? 'Edit Book Details' : 'Add New Book Record'}
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowBookModal(false);
                }}
                className="text-slate-400 hover:text-slate-700 font-bold p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveBook} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Book Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="book-title-input"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Author *</label>
                <input
                  type="text"
                  required
                  value={author}
                  onChange={(e) => setAuthor(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  id="book-author-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">ISBN Code</label>
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="978..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    id="book-isbn-input"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Barcode Label</label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    placeholder="Same as ISBN..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    id="book-barcode-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Shelf Location</label>
                  <input
                    type="text"
                    value={shelfLocation}
                    onChange={(e) => setShelfLocation(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-amber-900">Reference Book Only</div>
                  <p className="text-[10px] text-amber-800 font-medium">Check this if the item is non-circulating (Library Use Only)</p>
                </div>
                <input
                  type="checkbox"
                  checked={isReferenceOnly}
                  onChange={(e) => setIsReferenceOnly(e.target.checked)}
                  className="w-5 h-5 rounded text-amber-500 accent-amber-500"
                  id="book-ref-only-checkbox"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Total Copies</label>
                <input
                  type="number"
                  min={1}
                  value={totalCopies}
                  onChange={(e) => setTotalCopies(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Cover Image URL</label>
                <input
                  type="text"
                  value={coverUrl}
                  onChange={(e) => setCoverUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowBookModal(false);
                  }}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-extrabold rounded-xl shadow transition"
                >
                  Save Book Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WAIVE FINE OVERRIDE MODAL */}
      {waivingLoan && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-xl">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Waive Overdue Fine (Override)</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Librarian Discretionary Authorization</p>
                </div>
              </div>
              <button
                onClick={() => setWaivingLoan(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-1.5 text-xs text-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Borrower:</span>
                <span className="font-extrabold text-slate-900">{waivingLoan.userName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Book Title:</span>
                <span className="font-extrabold text-slate-900 truncate max-w-[200px]">{waivingLoan.bookTitle}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Due Date:</span>
                <span className="font-mono text-rose-600 font-bold"><bdi>{waivingLoan.dueDate}</bdi></span>
              </div>
              <div className="flex justify-between pt-1 border-t border-slate-200">
                <span className="text-slate-700 font-extrabold">Fee to Waive:</span>
                <span className="font-mono font-black text-rose-600 text-sm"><bdi>${waivingLoan.lateFee.toFixed(2)}</bdi></span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">
                Official Exemption / Waiver Reason:
              </label>
              <select
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="Medical absence / Authorized sick leave">Medical absence / Authorized sick leave</option>
                <option value="Inter-school competition / School event representation">Inter-school competition / School event</option>
                <option value="First-offense grace period exemption">First-offense grace period exemption</option>
                <option value="Administrative review error resolution">Administrative review error resolution</option>
                <option value="Head of School / Principal Discretion">Head of School / Principal Discretion</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWaivingLoan(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isWaiving}
                onClick={async () => {
                  setIsWaiving(true);
                  try {
                    // Call backend RBAC waive endpoint
                    await fetch('/api/circulation/waive-fine', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'x-user-role': 'admin'
                      },
                      body: JSON.stringify({
                        loanId: waivingLoan.id,
                        reason: waiveReason,
                        waivedBy: 'Ms. Eleanor Davis (Head Librarian)'
                      })
                    });
                    if (onWaiveFee) {
                      onWaiveFee(waivingLoan.id, waiveReason);
                    } else {
                      onMarkFeePaid(waivingLoan.id);
                    }
                    setWaivingLoan(null);
                  } catch (err) {
                    console.error('Failed to waive fee:', err);
                    if (onWaiveFee) onWaiveFee(waivingLoan.id, waiveReason);
                    setWaivingLoan(null);
                  } finally {
                    setIsWaiving(false);
                  }
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-extrabold rounded-xl shadow transition disabled:opacity-50"
              >
                {isWaiving ? 'Processing...' : 'Confirm Waiver ($0.00)'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
