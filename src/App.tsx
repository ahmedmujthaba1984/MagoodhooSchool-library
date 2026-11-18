import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  initializeDatabaseIfEmpty,
  subscribeBooks,
  subscribeUsers,
  subscribeLoans,
  subscribeReservations,
  subscribeSettings,
  subscribeQuotaStatus,
  addBook,
  updateBook,
  deleteBook,
  createLoan,
  updateLoan,
  createReservation,
  cancelReservation,
  updateSettings,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile,
  subscribeAcquisitions,
  createAcquisitionRequest,
  updateAcquisitionRequest,
  deleteAcquisitionRequest,
  subscribeAuditLogs,
  appendAuditLog,
  restoreSnapshotToFirestore
} from './lib/firebase';
import {
  AccessRole, AuditActionType, AuditLogEntry, Book, UserProfile, Loan, Reservation, LibrarySettings,
  PersonalItem, LedgerTransaction, AcquisitionRequest, LibrarySnapshotArchive
} from './types';
import { BookCatalog } from './components/BookCatalog';
import { ReferenceSection } from './components/ReferenceSection';
import { ParentDashboard } from './components/ParentDashboard';
import { QuickCheckout } from './components/QuickCheckout';
import { MyBorrowings } from './components/MyBorrowings';
import { AdminPanel } from './components/AdminPanel';
import { ReportsAnalytics } from './components/ReportsAnalytics';
import { Header, WorkspaceMode } from './components/Header';
import { LibraryEmblem } from './components/LibraryEmblem';
import { MemberDirectory } from './components/MemberDirectory';
import { DashboardView } from './components/DashboardView';
import { FaqHelpView } from './components/FaqHelpView';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { AddParentModal } from './components/AddParentModal';
import { AddBookModal } from './components/AddBookModal';
import { LoginPage } from './components/LoginPage';
import { ImportModal } from './components/ImportModal';
import { AIAssistant } from './components/AIAssistant';
import { ReportCardSyncModal } from './components/ReportCardSyncModal';
import { CommandPalette } from './components/CommandPalette';
import { PersonalLibrary } from './components/PersonalLibrary';
import { SmartAICatalogerModal } from './components/SmartAICatalogerModal';
import { InventoryAuditView } from './components/InventoryAuditView';
import { ReadingEngagementView } from './components/ReadingEngagementView';
import { AcquisitionsBoardView } from './components/AcquisitionsBoardView';
import { PatronSuggestionModal } from './components/PatronSuggestionModal';
import { SecurityBackupSuiteView } from './components/SecurityBackupSuiteView';
import { CatalogHealthModal } from './components/CatalogHealthModal';
import { SyncOutboxModal } from './components/SyncOutboxModal';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CirculationDeskSkeleton } from './components/Skeletons';
import {
  parseUrlState,
  buildUrlFromState,
  syncBrowserHistory,
  CatalogUrlFilters
} from './lib/urlState';
import { convertAcquisitionToCatalogBook } from './lib/acquisitions';
import { evaluateBadgesOnReturn } from './lib/readingEngagement';
import { createImmutableAuditEntry } from './lib/auditLogger';
import {
  createSnapshotArchive,
  serializeSnapshotArchive,
  triggerSnapshotFileDownload
} from './lib/backupRestore';
import { usePermission } from './hooks/usePermission';
import { portalSyncManager } from './lib/externalPortalSync';
import { useLanguage } from './lib/i18n';
import { useToast } from './lib/toast';
import { offlineQueue } from './lib/offlineQueue';
import { offlineDb } from './lib/offlineDb';
import { offlineSyncEngine, OutboxSyncState } from './lib/offlineSyncEngine';
import { buildNormalizedSnapshot } from './schema/librarySchema';
import { useOnlineStatus } from './lib/usePWAInstall';
import { calculateSchoolDueDate, DEFAULT_MALDIVES_SCHOOL_HOLIDAYS } from './lib/schoolCalendar';
import {
  sampleBooks, sampleUsers, sampleLoans, sampleReservations,
  initialSettings, samplePersonalItems, sampleLedgerTransactions, sampleAcquisitionRequests,
  sampleAuditLogs
} from './data/seedData';
import {
  LayoutDashboard,
  BookOpen,
  BookMarked,
  RotateCcw,
  Users,
  ClipboardList,
  HelpCircle,
  LogIn,
  UserPlus,
  Bookmark,
  MapPin,
  Phone,
  Mail,
  X,
  Shield,
  Scan,
  User,
  LogOut,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  ClipboardCheck,
  Award,
  ShoppingBag,
  ShieldCheck
} from 'lucide-react';

const GUEST_USER: UserProfile = {
  id: 'guest',
  name: 'Guest Visitor',
  email: 'guest@magoodhooschool.edu.mv',
  role: 'student',
  patronTier: 'external',
  createdAt: new Date().toISOString().split('T')[0]
};

const PERSONAL_STORAGE_KEY = 'magoodhoo_personal_library';

export default function App() {
  const { t, language, isRtl } = useLanguage();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();

  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [users, setUsers] = useState<UserProfile[]>(sampleUsers);
  const [loans, setLoans] = useState<Loan[]>(sampleLoans);
  const [reservations, setReservations] = useState<Reservation[]>(sampleReservations);
  const [settings, setSettings] = useState<LibrarySettings>(initialSettings);
  const [ledgerTransactions, setLedgerTransactions] = useState<LedgerTransaction[]>(sampleLedgerTransactions);
  const [acquisitions, setAcquisitions] = useState<AcquisitionRequest[]>(sampleAcquisitionRequests);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(sampleAuditLogs);

  const [personalItems, setPersonalItems] = useState<PersonalItem[]>(() => {
    try {
      const saved = localStorage.getItem(PERSONAL_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return samplePersonalItems;
  });

  useEffect(() => {
    try {
      localStorage.setItem(PERSONAL_STORAGE_KEY, JSON.stringify(personalItems));
    } catch {}
    offlineDb.savePersonalItems(personalItems).catch(() => {});
  }, [personalItems]);

  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);

  // Hydrate catalog & personal shelf from IndexedDB (<50ms) before clearing initial loading state
  useEffect(() => {
    let active = true;
    const safetyTimer = setTimeout(() => {
      if (active) setIsLoadingCatalog(false);
    }, 800);

    Promise.all([
      offlineDb
        .getCatalogBooks()
        .then((cachedBooks) => {
          if (active && cachedBooks && cachedBooks.length > 0) {
            setBooks((prev) => (prev === sampleBooks ? cachedBooks : prev));
          }
        })
        .catch(() => {}),
      offlineDb
        .getPersonalItems()
        .then((cachedPersonal) => {
          if (active && cachedPersonal && cachedPersonal.length > 0) {
            setPersonalItems((prev) => (prev === samplePersonalItems ? cachedPersonal : prev));
          }
        })
        .catch(() => {}),
    ]).finally(() => {
      clearTimeout(safetyTimer);
      if (active) setIsLoadingCatalog(false);
    });

    return () => {
      active = false;
      clearTimeout(safetyTimer);
    };
  }, []);

  useEffect(() => {
    if (books.length > 0) {
      offlineDb.saveCatalogBooks(books).catch(() => {});
    }
    const snapshot = buildNormalizedSnapshot({
      books,
      personalItems,
      users,
      loans,
      reservations,
      ledgerTransactions,
      settings,
    });
    offlineDb.syncNormalizedSnapshot(snapshot).catch(() => {});
  }, [books, personalItems, users, loans, reservations, ledgerTransactions, settings]);

  // Fetch initial MVR Ledger records from backend
  useEffect(() => {
    fetch('/api/ledger')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.transactions && Array.isArray(data.transactions) && data.transactions.length > 0) {
          setLedgerTransactions(data.transactions);
        }
      })
      .catch(() => {});
  }, []);

  // Global Cmd/Ctrl + K Command Palette & Audit / Outbox Modals
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [isCatalogHealthOpen, setIsCatalogHealthOpen] = useState<boolean>(false);
  const [isSyncOutboxOpen, setIsSyncOutboxOpen] = useState<boolean>(false);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Subscribe to IndexedDB Outbox Sync Engine & flush on reconnect
  const [syncState, setSyncState] = useState<OutboxSyncState>(() => offlineSyncEngine.getState());
  useEffect(() => {
    const unsub = offlineSyncEngine.subscribe(setSyncState);
    return unsub;
  }, []);

  const runOutboxSync = async () => {
    const result = await offlineSyncEngine.flushOutbox({
      onConflictDetected: (conflict) => {
        toast.warning(conflict.server_reason, 'Sync Conflict Resolved');
      },
    });

    if (result.syncedCount > 0) {
      toast.success(
        language === 'dv'
          ? `އޮފްލައިން ކިއުގައި ހުރި ${result.syncedCount} މުޢާމަލާތް ސިންކް ވެއްޖެ!`
          : `Synchronized ${result.syncedCount} queued offline operation(s)!`,
        'PWA Outbox Sync'
      );
    }

    const legacyQueue = offlineQueue.getQueue();
    if (legacyQueue.length > 0) {
      try {
        const res = await fetch('/api/reservations/queue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ queue: legacyQueue })
        });
        if (res.ok) {
          offlineQueue.clear();
        }
      } catch {}
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
      await runOutboxSync();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [toast, language]);

  const [currentUser, setCurrentUser] = useState<UserProfile>(sampleUsers[0]);
  const {
    can,
    accessRole,
    cannotReason,
    isSuperAdmin,
    isDeskAssistant,
    isTeacher,
  } = usePermission(currentUser);
  const initialUrl = useMemo(
    () =>
      typeof window !== 'undefined'
        ? parseUrlState(window.location.pathname, window.location.search)
        : { tab: 'catalog', bookId: null, patronId: null, lang: null, catalogFilters: {} as CatalogUrlFilters },
    []
  );

  const [activeTab, setActiveTabState] = useState<string>(initialUrl.tab);
  const [selectedUrlBookId, setSelectedUrlBookId] = useState<string | null>(initialUrl.bookId);
  const [selectedUrlPatronId, setSelectedUrlPatronId] = useState<string | null>(initialUrl.patronId);
  const [urlCatalogFilters, setUrlCatalogFilters] = useState<CatalogUrlFilters>(initialUrl.catalogFilters);
  const [catalogPopSeq, setCatalogPopSeq] = useState<number>(0);
  const liveCatalogFiltersRef = useRef<CatalogUrlFilters>(initialUrl.catalogFilters);
  const isPopStateSyncRef = useRef<boolean>(false);
  const hasMountedUrlSyncRef = useRef<boolean>(false);

  const setActiveTab = (nextTab: string) => {
    setActiveTabState(nextTab);
    if (nextTab !== 'catalog' && nextTab !== 'add-book') {
      setSelectedUrlBookId(null);
    }
    if (nextTab !== 'students') {
      setSelectedUrlPatronId(null);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlState(window.location.pathname, window.location.search);
      isPopStateSyncRef.current = true;
      setActiveTabState(parsed.tab);
      setSelectedUrlBookId(parsed.bookId);
      setSelectedUrlPatronId(parsed.patronId);
      setUrlCatalogFilters(parsed.catalogFilters);
      liveCatalogFiltersRef.current = parsed.catalogFilters;
      setCatalogPopSeq((prev) => prev + 1);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (isPopStateSyncRef.current) {
      isPopStateSyncRef.current = false;
      return;
    }
    const nextUrl = buildUrlFromState({
      tab: activeTab,
      bookId: selectedUrlBookId,
      patronId: selectedUrlPatronId,
      lang: language,
      catalogFilters:
        activeTab === 'catalog' || activeTab === 'add-book' ? liveCatalogFiltersRef.current : undefined,
    });
    if (!hasMountedUrlSyncRef.current) {
      hasMountedUrlSyncRef.current = true;
      syncBrowserHistory(nextUrl, { replace: true });
      return;
    }
    syncBrowserHistory(nextUrl, { replace: false });
  }, [activeTab, selectedUrlBookId, selectedUrlPatronId, language]);

  const handleCatalogFiltersChange = useCallback(
    (filters: CatalogUrlFilters) => {
      liveCatalogFiltersRef.current = filters;
      if (activeTab !== 'catalog' && activeTab !== 'add-book') return;
      const nextUrl = buildUrlFromState({
        tab: activeTab,
        bookId: selectedUrlBookId,
        patronId: selectedUrlPatronId,
        lang: language,
        catalogFilters: filters,
      });
      syncBrowserHistory(nextUrl, { replace: true });
    },
    [activeTab, selectedUrlBookId, selectedUrlPatronId, language]
  );

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Pre-selected checkout targets from Catalog / Member Directory
  const [preselectedCheckoutBook, setPreselectedCheckoutBook] = useState<Book | null>(null);
  const [preselectedMemberCode, setPreselectedMemberCode] = useState<string | null>(null);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [scannerCallback, setScannerCallback] = useState<((code: string) => void) | null>(null);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState<boolean>(false);
  const [isSmartCatalogerOpen, setIsSmartCatalogerOpen] = useState<boolean>(false);
  const [smartCatalogerMode, setSmartCatalogerMode] = useState<'catalog' | 'personal'>('catalog');
  const [isAddParentModalOpen, setIsAddParentModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isReportCardSyncModalOpen, setIsReportCardSyncModalOpen] = useState<boolean>(false);
  const [importDefaultType, setImportDefaultType] = useState<'books' | 'parents' | 'staff'>('books');
  const [isSuggestBookModalOpen, setIsSuggestBookModalOpen] = useState<boolean>(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);

  useEffect(() => {
    let unsubscribeBooks: () => void;
    let unsubscribeUsers: () => void;
    let unsubscribeLoans: () => void;
    let unsubscribeRes: () => void;
    let unsubscribeSet: () => void;
    let unsubscribeAcq: () => void;
    let unsubscribeAudit: () => void;

    const unsubscribeQuota = subscribeQuotaStatus((exhausted) => {
      setIsQuotaExhausted(exhausted);
    });

    async function init() {
      try {
        await initializeDatabaseIfEmpty();
      } catch (err) {
        console.warn('Database initialization skipped or running offline:', err);
      }

      try {
        portalSyncManager.startRealtimeSync();
      } catch (e) {
        console.warn('Report Card Live Sync init note:', e);
      }

      unsubscribeBooks = subscribeBooks(
        (data) => {
          if (data && data.length > 0) setBooks(data);
          setIsLoadingCatalog(false);
        },
        () => setIsLoadingCatalog(false)
      );

      unsubscribeUsers = subscribeUsers(
        (data) => {
          if (data && data.length > 0) setUsers(data);
        },
        () => {}
      );

      unsubscribeLoans = subscribeLoans(
        (data) => {
          if (data && data.length > 0) setLoans(data);
        },
        () => {}
      );

      unsubscribeRes = subscribeReservations(
        (data) => {
          if (data && data.length > 0) setReservations(data);
        },
        () => {}
      );

      unsubscribeSet = subscribeSettings(
        (data) => setSettings(data),
        () => {}
      );

      unsubscribeAcq = subscribeAcquisitions(
        (data) => {
          if (data && data.length > 0) setAcquisitions(data);
        },
        () => {}
      );

      unsubscribeAudit = subscribeAuditLogs(
        (data) => {
          if (data && data.length > 0) setAuditLogs(data);
        },
        () => {}
      );
    }

    init();

    return () => {
      if (unsubscribeBooks) unsubscribeBooks();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeLoans) unsubscribeLoans();
      if (unsubscribeRes) unsubscribeRes();
      if (unsubscribeSet) unsubscribeSet();
      if (unsubscribeAcq) unsubscribeAcq();
      if (unsubscribeAudit) unsubscribeAudit();
      if (unsubscribeQuota) unsubscribeQuota();
      portalSyncManager.stopRealtimeSync();
    };
  }, []);

  useEffect(() => {
    const updated = users.find(u => u.id === currentUser.id);
    if (updated) setCurrentUser(updated);
  }, [users]);

  useEffect(() => {
    if (activeTab === 'add-book') setIsAddBookModalOpen(true);
  }, [activeTab]);

  const recordAuditEvent = async (params: {
    action: AuditActionType;
    targetType: AuditLogEntry['targetType'];
    targetId: string;
    details: string;
  }) => {
    const entry = createImmutableAuditEntry({
      ...params,
      actor: currentUser,
    });
    setAuditLogs(prev => [entry, ...prev]);
    try {
      await appendAuditLog(entry);
    } catch {}
    try {
      await fetch('/api/audit-logs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role || 'admin',
          'x-access-role': accessRole,
          'x-user-id': currentUser.name,
        },
        body: JSON.stringify(entry),
      });
    } catch {}
  };

  // Ledger helper
  const handleRecordLedgerTransaction = async (txInput: Omit<LedgerTransaction, 'id'>) => {
    const optimisticTx: LedgerTransaction = {
      id: `ledg-${Date.now()}`,
      ...txInput
    };
    setLedgerTransactions(prev => [optimisticTx, ...prev]);

    if (!navigator.onLine) {
      await offlineSyncEngine.enqueueOperation({
        action: txInput.type === 'waiver' ? 'fee_waiver' : 'fine_payment',
        endpoint: '/api/ledger',
        payload: {
          ...txInput,
          userRole: currentUser.role || 'admin',
          accessRole,
          librarianId: currentUser.name,
        },
      });
      toast.info(
        language === 'dv'
          ? `އޮފްލައިން މޯޑް: MVR ${txInput.amountMvr.toFixed(2)} ރެކޯޑް އައުޓްބޮކްސްގައި ރައްކާކުރެވިއްޖެ.`
          : `Offline Mode: Recorded MVR ${txInput.amountMvr.toFixed(2)} (${txInput.type.replace('_', ' ')}) in IndexedDB Outbox for sync.`,
        'Financial Ledger (Offline)'
      );
      return;
    }

    try {
      const res = await fetch('/api/ledger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role || 'admin',
          'x-access-role': accessRole,
        },
        body: JSON.stringify(txInput)
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.transaction) {
          setLedgerTransactions(prev => prev.map(x => (x.id === optimisticTx.id ? data.transaction : x)));
        }
      }
    } catch (err) {
      console.warn('Ledger persisted locally:', err);
    }

    toast.success(`Recorded MVR ${txInput.amountMvr.toFixed(2)} (${txInput.type.replace('_', ' ')}) for ${txInput.userName}.`, 'Financial Ledger');
  };

  // Online Book Reservation (supports Kiosk patronOverride)
  const handleReserveBook = async (book: Book, patronOverride?: UserProfile) => {
    const actingUser = patronOverride || currentUser;
    const tempId = `res-${Date.now()}`;
    const newRes: Reservation = {
      id: tempId,
      bookId: book.id,
      bookTitle: book.title,
      userId: actingUser.id,
      userName: actingUser.name,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    setReservations(prev => [newRes, ...prev]);

    if (!navigator.onLine) {
      await offlineSyncEngine.enqueueOperation({
        action: 'reserve',
        endpoint: '/api/reservations',
        payload: {
          id: tempId,
          bookId: book.id,
          bookTitle: book.title,
          userId: actingUser.id,
          userName: actingUser.name,
          userGrade: actingUser.grade,
          requestDate: newRes.requestDate,
          userRole: actingUser.role || 'student',
          accessRole,
        },
      });
      offlineQueue.enqueue({
        id: tempId,
        bookId: book.id,
        bookTitle: book.title,
        userId: actingUser.id,
        userName: actingUser.name,
        userGrade: actingUser.grade,
        requestDate: newRes.requestDate
      });
      toast.info(
        language === 'dv'
          ? `އިންޓަރނެޓް ނެތުމުން ނަންނޯޓު ކިއު ކުރެވިއްޖެ! އަލުން ގުޅުމުން ސިންކް ވާނެ.`
          : `Offline Mode: Reservation queued in IndexedDB! It will sync automatically once connected.`,
        'Offline Outbox'
      );
      return;
    }

    try {
      await createReservation({
        bookId: newRes.bookId,
        bookTitle: newRes.bookTitle,
        userId: newRes.userId,
        userName: newRes.userName,
        requestDate: newRes.requestDate,
        status: newRes.status
      });
    } catch (err) {
      console.warn('Reservation cached locally:', err);
    }

    toast.success(
      language === 'dv'
        ? `"${book.title}" އަށް އޮންލައިންކޮށް ނަންނޯޓު ކުރެވިއްޖެ!`
        : `Hold placed for "${book.title}" under ${actingUser.name}.`,
      'Reservation Confirmed'
    );
  };

  const handleCancelReservation = async (reservationId: string) => {
    setReservations(prev => prev.filter(r => r.id !== reservationId));
    try {
      await cancelReservation(reservationId);
    } catch {}
    toast.info(language === 'dv' ? 'ރިޒަވޭޝަން ކެންސަލް ކުރެވިއްޖެ.' : 'Reservation cancelled.', 'Hold Released');
  };

  // Checkout with copy-level BookCopy tracking
  const handleProcessCheckout = async (
    book: Book,
    borrower: UserProfile,
    daysToBorrow: number,
    copyBarcode?: string
  ) => {
    if (book.availableCopies <= 0) {
      toast.error(`No copies of "${book.title}" are currently available.`, 'Out of Stock');
      return;
    }

    const resolvedTier =
      borrower.patronTier ||
      (borrower.role === 'staff' ? 'teacher' : borrower.role === 'admin' ? 'staff' : 'student');
    const tierPolicy = settings.patronTierRules?.[resolvedTier];
    const canBorrowRef = tierPolicy ? (tierPolicy.allowReferenceCheckout ?? borrower.role !== 'student') : borrower.role !== 'student';

    if (book.isReferenceOnly && !canBorrowRef) {
      toast.error(`"${book.title}" is Reference-Only and cannot leave the library for ${resolvedTier} patrons.`, 'Reference Only');
      return;
    }

    const activeBorrowerLoans = loans.filter(l => l.userId === borrower.id && (l.status === 'active' || l.status === 'overdue'));
    const maxAllowed =
      tierPolicy?.maxBooks ??
      (borrower.role === 'staff' || borrower.role === 'admin'
        ? settings.maxBooksPerStaff || 7
        : settings.maxBooksPerStudent || 3);

    if (activeBorrowerLoans.length >= maxAllowed) {
      toast.error(
        language === 'dv'
          ? `ދަރިވަރަށް އިތުރު ފޮތެއް ނުނެގޭނެ (${maxAllowed} ފޮތް ހަމަވެއްޖެ).`
          : `Borrowing limit reached (${resolvedTier}): ${borrower.name} has ${activeBorrowerLoans.length}/${maxAllowed} active books.`,
        'Loan Limit Exceeded'
      );
      return;
    }

    const unpaidBalance = loans
      .filter(l => l.userId === borrower.id && !l.feePaid && (l.lateFee || 0) > 0)
      .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);

    if (settings.blockBorrowingFineThreshold && unpaidBalance >= settings.blockBorrowingFineThreshold) {
      toast.error(
        `Checkout blocked: ${borrower.name} has MVR ${unpaidBalance.toFixed(2)} unpaid fines (Limit: MVR ${settings.blockBorrowingFineThreshold.toFixed(2)}).`,
        'Account Fine Block'
      );
      return;
    }

    const activeHolidays = (settings.holidayGraceDays ?? true)
      ? (settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS)
      : [];
    const issueDateObj = new Date();
    const issueDateStr = issueDateObj.toISOString().split('T')[0];
    const dueDateStr = calculateSchoolDueDate(issueDateObj, daysToBorrow, activeHolidays);
    const tempLoanId = `loan-${Date.now()}`;

    const assignedCopy =
      book.copies?.find(c => c.barcode === copyBarcode && c.status === 'Available') ||
      book.copies?.find(c => c.status === 'Available');

    const newLoan: Loan = {
      id: tempLoanId,
      bookId: book.id,
      copyBarcode: assignedCopy?.barcode || copyBarcode || book.barcode,
      bookTitle: book.title,
      bookIsbn: book.isbn,
      userId: borrower.id,
      userName: borrower.name,
      userGrade: borrower.grade || 'Member',
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      issuedAtTimestamp: issueDateObj.toISOString(),
      status: 'active',
      renewalCount: 0,
      lateFee: 0,
      feePaid: true,
      processedBy: currentUser.name
    };

    const updatedCopies = book.copies?.map(c =>
      assignedCopy && c.copyId === assignedCopy.copyId
        ? { ...c, status: 'Checked Out' as const, currentLoanId: tempLoanId }
        : c
    );

    setLoans(prev => [newLoan, ...prev]);
    setBooks(prev =>
      prev.map(b =>
        b.id === book.id
          ? {
              ...b,
              availableCopies: Math.max(0, b.availableCopies - 1),
              copies: updatedCopies || b.copies
            }
          : b
      )
    );

    if (!navigator.onLine) {
      await offlineSyncEngine.enqueueOperation({
        action: 'checkout',
        endpoint: '/api/circulation/issue',
        payload: {
          localLoanId: tempLoanId,
          bookId: book.id,
          userId: borrower.id,
          userName: borrower.name,
          daysToBorrow,
          dueDate: dueDateStr,
          librarianId: currentUser.name,
          copyBarcode: assignedCopy?.barcode || copyBarcode,
          userRole: currentUser.role || 'admin',
          accessRole,
        },
      });
      toast.info(
        language === 'dv'
          ? `އޮފްލައިން މޯޑް: "${book.title}" ދޫކުރުން އައުޓްބޮކްސްގައި ރައްކާކުރެވިއްޖެ!`
          : `Offline Mode: Checked out "${book.title}" locally. Queued in IndexedDB Outbox for auto-sync.`,
        'Offline Circulation'
      );
      return;
    }

    try {
      await createLoan({
        bookId: newLoan.bookId,
        copyBarcode: newLoan.copyBarcode,
        bookTitle: newLoan.bookTitle,
        bookIsbn: newLoan.bookIsbn,
        userId: newLoan.userId,
        userName: newLoan.userName,
        userGrade: newLoan.userGrade,
        issueDate: newLoan.issueDate,
        dueDate: newLoan.dueDate,
        issuedAtTimestamp: newLoan.issuedAtTimestamp,
        status: newLoan.status,
        renewalCount: newLoan.renewalCount,
        lateFee: newLoan.lateFee,
        feePaid: newLoan.feePaid
      });
      await updateBook(book.id, {
        availableCopies: Math.max(0, book.availableCopies - 1),
        ...(updatedCopies ? { copies: updatedCopies } : {})
      });
    } catch {}

    toast.success(
      language === 'dv'
        ? `"${book.title}" ދޫކުރެވިއްޖެ! އަނބުރާ ގެންނަންޖެހޭ ތާރީޚް: ${dueDateStr}`
        : `Checked out "${book.title}" to ${borrower.name}. Due ${dueDateStr}.`,
      'Book Issued'
    );

    void recordAuditEvent({
      action: 'LOAN_ISSUED',
      targetType: 'loan',
      targetId: newLoan.id,
      details: `Issued "${book.title}" (${newLoan.copyBarcode || 'N/A'}) to ${borrower.name}. Due ${dueDateStr}.`,
    });
  };

  // Return with copy restoration, hold-queue alert & automated reading badge evaluation
  const handleProcessReturn = async (loan: Loan, calculatedFee: number) => {
    const nowDate = new Date();
    const todayStr = nowDate.toISOString().split('T')[0];
    const returnedAtTimestamp = nowDate.toISOString();

    const completedLoan: Loan = {
      ...loan,
      returnDate: todayStr,
      returnedAtTimestamp,
      status: 'returned',
      lateFee: calculatedFee,
      feePaid: calculatedFee === 0
    };

    const nextLoansList = loans.map(l => (l.id === loan.id ? completedLoan : l));
    setLoans(nextLoansList);

    const targetBook = books.find(b => b.id === loan.bookId);
    const updatedCopies = targetBook?.copies?.map(c =>
      (loan.copyBarcode && c.barcode === loan.copyBarcode) || c.currentLoanId === loan.id
        ? { ...c, status: 'Available' as const, currentLoanId: undefined }
        : c
    );

    setBooks(prev =>
      prev.map(b =>
        b.id === loan.bookId
          ? {
              ...b,
              availableCopies: Math.min(b.totalCopies, b.availableCopies + 1),
              copies: updatedCopies || b.copies
            }
          : b
      )
    );

    if (calculatedFee > 0) {
      await handleRecordLedgerTransaction({
        loanId: loan.id,
        userId: loan.userId,
        userName: loan.userName,
        bookTitle: loan.bookTitle,
        type: 'fine_accrual',
        amountMvr: calculatedFee,
        date: todayStr,
        notes: 'Overdue fine accrued on check-in',
        processedBy: currentUser.name
      });
    }

    if (!navigator.onLine) {
      await offlineSyncEngine.enqueueOperation({
        action: 'checkin',
        endpoint: '/api/circulation/return',
        payload: {
          loanId: loan.id,
          bookBarcodeOrId: loan.copyBarcode || loan.bookIsbn || loan.bookId,
          copyBarcode: loan.copyBarcode,
          calculatedFee,
          userRole: currentUser.role || 'admin',
          accessRole,
        },
      });
    } else {
      try {
        await updateLoan(loan.id, {
          returnDate: todayStr,
          returnedAtTimestamp,
          status: 'returned',
          lateFee: calculatedFee,
          feePaid: calculatedFee === 0
        });
        if (targetBook) {
          await updateBook(targetBook.id, {
            availableCopies: Math.min(targetBook.totalCopies, targetBook.availableCopies + 1),
            ...(updatedCopies ? { copies: updatedCopies } : {})
          });
        }
      } catch {}
    }

    // Automated reading milestone & badge evaluation (duration-verified)
    const borrowerProfile = users.find(u => u.id === loan.userId);
    if (borrowerProfile) {
      const outcome = evaluateBadgesOnReturn({
        student: borrowerProfile,
        existingLoans: nextLoansList,
        returnedLoan: completedLoan,
        books,
      });

      if (outcome.verifiedCredit) {
        setUsers(prev =>
          prev.map(u =>
            u.id === borrowerProfile.id
              ? {
                  ...u,
                  booksCompletedCount: Math.max(u.booksCompletedCount || 0, outcome.totalVerifiedBooks),
                  earnedBadgeIds: outcome.allEarnedBadgeIds,
                }
              : u
          )
        );
        if (navigator.onLine) {
          try {
            await updateUserProfile(borrowerProfile.id, {
              booksCompletedCount: Math.max(borrowerProfile.booksCompletedCount || 0, outcome.totalVerifiedBooks),
              earnedBadgeIds: outcome.allEarnedBadgeIds,
            });
          } catch {}
        }

        if (outcome.newlyUnlockedBadges.length > 0) {
          const badgeNames = outcome.newlyUnlockedBadges
            .map(b => (language === 'dv' ? b.titleDv : b.titleEn))
            .join(', ');
          toast.success(
            `${borrowerProfile.name} unlocked new reading badge(s): ${badgeNames}!`,
            'Badge Unlocked'
          );
        }
      }
    }

    const nextHold = reservations.find(r => r.bookId === loan.bookId && r.status === 'pending');
    if (nextHold) {
      toast.warning(
        `HOLD QUEUE: Place "${loan.bookTitle}" on the Reserve Hold Shelf for ${nextHold.userName}!`,
        'Pending Reservation'
      );
    } else {
      toast.success(
        calculatedFee > 0
          ? `Book "${loan.bookTitle}" returned. Overdue fine: MVR ${calculatedFee.toFixed(2)}.`
          : `Book "${loan.bookTitle}" returned on time.`,
        'Return Processed'
      );
    }

    void recordAuditEvent({
      action: 'LOAN_RETURNED',
      targetType: 'loan',
      targetId: loan.id,
      details: `Returned "${loan.bookTitle}" from ${loan.userName}. Accrued fine: MVR ${calculatedFee.toFixed(2)}.`,
    });
  };

  // Renew with reservation block
  const handleRenewLoan = async (loan: Loan) => {
    if (loan.renewalCount >= settings.maxRenewals) {
      toast.error(
        language === 'dv'
          ? `އެންމެ ގިނަވެގެން އިތުރުކުރެވޭނެ އަދަދު (${settings.maxRenewals}) ހަމަވެއްޖެ.`
          : `Maximum renewal limit (${settings.maxRenewals}) reached.`,
        'Renewal Limit'
      );
      return;
    }

    const hasReservationConflict = reservations.some(
      r => r.bookId === loan.bookId && r.userId !== loan.userId && r.status === 'pending'
    );

    if (hasReservationConflict) {
      toast.warning(
        language === 'dv'
          ? `މުއްދަތު އިތުރެއް ނުކުރެވޭނެ: އެހެން ދަރިވަރަކު މި ފޮތަށް ނަންނޯޓު ކޮށްފައިވެއެވެ.`
          : `Renewal blocked: Another patron holds a reservation for "${loan.bookTitle}".`,
        'Hold Conflict'
      );
      return;
    }

    const activeHolidays = (settings.holidayGraceDays ?? true)
      ? (settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS)
      : [];
    const newDueDateStr = calculateSchoolDueDate(new Date(loan.dueDate), settings.maxBorrowDays, activeHolidays);

    setLoans(prev =>
      prev.map(l =>
        l.id === loan.id ? { ...l, dueDate: newDueDateStr, renewalCount: l.renewalCount + 1 } : l
      )
    );

    if (!navigator.onLine) {
      await offlineSyncEngine.enqueueOperation({
        action: 'renew',
        endpoint: '/api/circulation/renew',
        payload: {
          loanId: loan.id,
          extensionDays: settings.maxBorrowDays,
          userRole: currentUser.role || 'admin',
          accessRole,
        },
      });
    } else {
      try {
        await updateLoan(loan.id, { dueDate: newDueDateStr, renewalCount: loan.renewalCount + 1 });
      } catch {}
    }

    toast.success(
      language === 'dv' ? `މުއްދަތު ${newDueDateStr} އާ ހަމައަށް އިތުރުކުރެވިއްޖެ!` : `Loan extended until ${newDueDateStr}.`,
      'Loan Renewed'
    );
  };

  const handleWaiveFee = async (loanId: string, reason: string) => {
    if (!can('fines:waive')) {
      toast.error(cannotReason('fines:waive'), 'RBAC Restricted');
      return;
    }

    const target = loans.find(l => l.id === loanId);
    const remainingToWaive = target ? Math.max(0, (target.lateFee || 0) - (target.amountPaid || 0)) : 0;

    setLoans(prev =>
      prev.map(l =>
        l.id === loanId
          ? {
              ...l,
              lateFee: 0,
              waivedAmount: (l.waivedAmount || 0) + remainingToWaive,
              feePaid: true,
              waivedReason: reason
            }
          : l
      )
    );

    if (target && remainingToWaive > 0) {
      await handleRecordLedgerTransaction({
        loanId,
        userId: target.userId,
        userName: target.userName,
        bookTitle: target.bookTitle,
        type: 'waiver',
        amountMvr: remainingToWaive,
        date: new Date().toISOString().split('T')[0],
        notes: reason,
        processedBy: currentUser.name
      });
    }

    try {
      await updateLoan(loanId, { lateFee: 0, feePaid: true });
      await fetch('/api/circulation/waive-fine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': currentUser.role || 'admin',
          'x-access-role': accessRole,
        },
        body: JSON.stringify({ loanId, reason, waivedBy: currentUser.name })
      });
    } catch {}

    await recordAuditEvent({
      action: 'FINE_WAIVED',
      targetType: 'fine',
      targetId: loanId,
      details: `Waived MVR ${remainingToWaive.toFixed(2)} fine on "${target?.bookTitle || loanId}" for ${target?.userName || 'Patron'}. Reason: ${reason}`,
    });

    toast.success(
      language === 'dv'
        ? `ޖޫރިމަނާ މަޢާފުކޮށްދެވިއްޖެ (${reason})`
        : `MVR ${remainingToWaive.toFixed(2)} fine waived (${reason}).`,
      'Fine Waived'
    );
  };

  const handleMarkFeePaid = async (loanId: string, paidAmount?: number) => {
    const loan = loans.find(l => l.id === loanId);
    const currentPaid = loan?.amountPaid || 0;
    const totalFee = loan?.lateFee || 0;
    const paidNow = paidAmount !== undefined ? paidAmount : Math.max(0, totalFee - currentPaid);
    const newPaidTotal = Number((currentPaid + paidNow).toFixed(2));
    const fullySettled = newPaidTotal >= totalFee || paidAmount === undefined;

    setLoans(prev =>
      prev.map(l =>
        l.id === loanId ? { ...l, amountPaid: newPaidTotal, feePaid: fullySettled } : l
      )
    );

    try {
      await updateLoan(loanId, { feePaid: fullySettled });
    } catch {}

    await recordAuditEvent({
      action: 'FINE_SETTLED',
      targetType: 'fine',
      targetId: loanId,
      details: `Recorded fine payment MVR ${paidNow.toFixed(2)} for ${loan?.userName || loanId} (${fullySettled ? 'Settled' : 'Partial'}).`,
    });
  };

  // Parent Account & Import Handlers
  const handleCreateParentAccount = async (
    nameOrProfile: any,
    email?: string,
    phone?: string,
    linkedChildrenIds?: string[],
    newChildData?: { name: string; grade: string; studentIdCode: string }
  ) => {
    let parentName = '';
    let parentEmail = '';
    let parentPhone = '';
    let childrenIds: string[] = [];

    if (typeof nameOrProfile === 'object' && nameOrProfile !== null && nameOrProfile.name) {
      parentName = nameOrProfile.name;
      parentEmail = nameOrProfile.email;
      parentPhone = nameOrProfile.phone || '';
      childrenIds = Array.isArray(nameOrProfile.childrenIds) ? [...nameOrProfile.childrenIds] : [];
    } else {
      parentName = typeof nameOrProfile === 'string' ? nameOrProfile : 'Parent Member';
      parentEmail = email || '';
      parentPhone = phone || '';
      childrenIds = Array.isArray(linkedChildrenIds) ? [...linkedChildrenIds] : [];
    }

    const parentTempId = `par-${Date.now()}`;

    if (newChildData && newChildData.name) {
      const childTempId = `std-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const childProfile: UserProfile = {
        id: childTempId,
        name: newChildData.name,
        grade: newChildData.grade || 'Grade 6',
        studentIdCode: newChildData.studentIdCode || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
        role: 'student',
        patronTier: 'student',
        parentId: parentTempId,
        email: `${newChildData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@fmagoodhooschool.edu.mv`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setUsers(prev => [childProfile, ...prev]);
      try {
        const { id, ...cData } = childProfile;
        const realChildId = await createUserProfile(cData);
        childrenIds.push(realChildId || childTempId);
      } catch {
        childrenIds.push(childTempId);
      }
    }

    const newParent: UserProfile = {
      id: parentTempId,
      name: parentName,
      email: parentEmail,
      phone: parentPhone,
      role: 'parent',
      patronTier: 'parent',
      childrenIds,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setUsers(prev => [newParent, ...prev]);

    if (childrenIds.length > 0) {
      setUsers(prev => prev.map(u => (childrenIds.includes(u.id) ? { ...u, parentId: parentTempId } : u)));
      for (const cId of childrenIds) {
        try {
          await updateUserProfile(cId, { parentId: parentTempId });
        } catch {}
      }
    }

    try {
      const { id, ...pData } = newParent;
      await createUserProfile(pData);
    } catch {}

    toast.success(
      language === 'dv' ? `ބެލެނިވެރިޔާ ${parentName} ގެ އެކައުންޓް ހެދިއްޖެ!` : `Parent account for ${parentName} created.`,
      'Member Registered'
    );
  };

  const handleBulkImportBooks = async (importedBooks: Omit<Book, 'id'>[]) => {
    const newBooks: Book[] = importedBooks.map((b, i) => ({ ...b, id: `bk-import-${Date.now()}-${i}` }));
    setBooks(prev => [...newBooks, ...prev]);
    for (const b of importedBooks) {
      try {
        await addBook(b);
      } catch {}
    }
    toast.success(language === 'dv' ? `${importedBooks.length} ފޮތް އެތެރެކުރެވިއްޖެ!` : `Imported ${importedBooks.length} books.`, 'Bulk Import');
  };

  const handleBulkImportParents = async (importedParents: any[]) => {
    let importedCount = 0;
    for (const p of importedParents) {
      const parentTempId = `par-import-${Date.now()}-${importedCount}`;
      const linkedChildrenIds: string[] = [];

      if (Array.isArray(p.children)) {
        for (const child of p.children) {
          const childTempId = `std-import-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const childProfile: UserProfile = {
            id: childTempId,
            name: child.name,
            grade: child.grade || 'Grade 6',
            studentIdCode: child.studentIdCode || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
            role: 'student',
            patronTier: 'student',
            parentId: parentTempId,
            email: `${child.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@fmagoodhooschool.edu.mv`,
            createdAt: new Date().toISOString().split('T')[0]
          };
          setUsers(prev => [childProfile, ...prev]);
          linkedChildrenIds.push(childTempId);
          try {
            const { id, ...cData } = childProfile;
            const newId = await createUserProfile(cData);
            if (newId) linkedChildrenIds[linkedChildrenIds.length - 1] = newId;
          } catch {}
        }
      }

      const parentProfile: UserProfile = {
        id: parentTempId,
        name: p.name,
        email: p.email,
        phone: p.phone || '',
        role: 'parent',
        patronTier: 'parent',
        childrenIds: linkedChildrenIds,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setUsers(prev => [parentProfile, ...prev]);
      try {
        const { id, ...pData } = parentProfile;
        await createUserProfile(pData);
      } catch {}
      importedCount++;
    }
    toast.success(language === 'dv' ? `${importedCount} ބެލެނިވެރިން އެތެރެކުރެވިއްޖެ!` : `Imported ${importedCount} parent accounts.`, 'Bulk Import');
  };

  const handleBulkImportStaff = async (importedStaff: Array<{ name: string; email: string; phone?: string; staffIdCode?: string; staffDepartment?: string }>) => {
    const newStaffList: UserProfile[] = importedStaff.map((s, i) => ({
      id: `stf-import-${Date.now()}-${i}`,
      name: s.name,
      email: s.email,
      phone: s.phone || '',
      role: 'staff',
      patronTier: 'teacher',
      staffIdCode: s.staffIdCode || `STF-${Math.floor(3000 + Math.random() * 1000)}`,
      staffDepartment: s.staffDepartment || 'Teaching Faculty',
      createdAt: new Date().toISOString().split('T')[0]
    }));
    setUsers(prev => [...newStaffList, ...prev]);
    for (const s of importedStaff) {
      try {
        await createUserProfile({
          name: s.name,
          email: s.email,
          phone: s.phone || '',
          role: 'staff',
          patronTier: 'teacher',
          staffIdCode: s.staffIdCode || `STF-${Math.floor(3000 + Math.random() * 1000)}`,
          staffDepartment: s.staffDepartment || 'Teaching Faculty',
          createdAt: new Date().toISOString().split('T')[0]
        });
      } catch {}
    }
    toast.success(`Imported ${importedStaff.length} faculty and staff accounts.`, 'Bulk Import');
  };

  const handleDeleteUser = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;
    if (targetUser.role === 'admin') {
      toast.error('Administrator accounts cannot be deleted.', 'Protected Account');
      return;
    }

    try {
      await deleteUserProfile(userId);
      if (targetUser.role === 'student') {
        const parent = users.find(u => u.id === targetUser.parentId || u.childrenIds?.includes(targetUser.id));
        if (parent && parent.childrenIds) {
          await updateUserProfile(parent.id, { childrenIds: parent.childrenIds.filter(id => id !== targetUser.id) });
        }
      } else if (targetUser.role === 'parent') {
        const children = users.filter(u => u.parentId === targetUser.id || targetUser.childrenIds?.includes(u.id));
        for (const child of children) {
          await updateUserProfile(child.id, { parentId: '' });
        }
      }
      setUsers(prev => prev.filter(u => u.id !== userId));
      toast.success(`Removed ${targetUser.name} from the library portal.`, 'Account Removed');
    } catch (err: any) {
      toast.error(`Failed to delete user profile: ${err?.message || String(err)}`, 'Delete Failed');
    }
  };

  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    const targetAccessRole = user.accessRole || (user.role === 'admin' ? 'super_admin' : user.role === 'staff' ? 'teacher' : 'student_guest');
    if (targetAccessRole === 'super_admin') setActiveTab('dashboard');
    else if (targetAccessRole === 'desk_assistant') setActiveTab('checkout-hub');
    else if (user.role === 'parent') setActiveTab('parent-portal');
    else setActiveTab('catalog');
  };

  const handleUpdateUserRole = async (userId: string, nextAccessRole: AccessRole) => {
    if (!can('users:manage_roles')) {
      toast.error(cannotReason('users:manage_roles'), 'RBAC Restricted');
      return;
    }
    const target = users.find(u => u.id === userId);
    if (!target) return;

    const nextLegacyRole =
      nextAccessRole === 'super_admin'
        ? 'admin'
        : nextAccessRole === 'desk_assistant' || nextAccessRole === 'teacher'
        ? 'staff'
        : target.role === 'parent'
        ? 'parent'
        : 'student';

    setUsers(prev =>
      prev.map(u =>
        u.id === userId ? { ...u, accessRole: nextAccessRole, role: nextLegacyRole } : u
      )
    );
    try {
      await updateUserProfile(userId, { accessRole: nextAccessRole, role: nextLegacyRole });
    } catch {}

    await recordAuditEvent({
      action: 'ROLE_CHANGED',
      targetType: 'user',
      targetId: userId,
      details: `Updated access role for ${target.name} to "${nextAccessRole}" (legacy role: ${nextLegacyRole}).`,
    });

    toast.success(`Updated ${target.name}'s access role to ${nextAccessRole}.`, 'RBAC Updated');
  };

  const handleExportBackup = async (passphrase?: string) => {
    if (!can('data:backup_restore')) {
      toast.error(cannotReason('data:backup_restore'), 'RBAC Restricted');
      return;
    }
    const archive = createSnapshotArchive({
      books,
      users,
      loans,
      reservations,
      ledgerTransactions,
      acquisitions,
      personalItems,
      auditLogs,
      settings,
      exportedBy: currentUser.name,
    });
    const serialized = await serializeSnapshotArchive(archive, passphrase);
    triggerSnapshotFileDownload(serialized, Boolean(passphrase?.trim()));

    await recordAuditEvent({
      action: 'BACKUP_EXPORTED',
      targetType: 'backup',
      targetId: archive.checksum,
      details: `Exported ${passphrase?.trim() ? 'AES-256 encrypted ' : ''}snapshot archive (${archive.counts.titles} titles, ${archive.counts.copies} copies, ${archive.counts.loans} loans).`,
    });

    toast.success(
      `Snapshot exported (${archive.counts.titles} titles, checksum ${archive.checksum}).`,
      'Backup Complete'
    );
  };

  const handleRestoreBackup = async (archive: LibrarySnapshotArchive) => {
    if (!can('data:backup_restore')) {
      toast.error(cannotReason('data:backup_restore'), 'RBAC Restricted');
      return;
    }

    const { data } = archive;
    setBooks(data.books);
    setUsers(data.users);
    setLoans(data.loans);
    setReservations(data.reservations);
    setLedgerTransactions(data.ledgerTransactions);
    if (data.acquisitions) setAcquisitions(data.acquisitions);
    if (data.personalItems) setPersonalItems(data.personalItems);
    if (data.settings) setSettings(data.settings);
    if (data.auditLogs && data.auditLogs.length > 0) {
      setAuditLogs(prev => {
        const seen = new Set(prev.map(x => x.id));
        const merged = [...prev];
        for (const item of data.auditLogs || []) {
          if (!seen.has(item.id)) merged.push(item);
        }
        return merged.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      });
    }

    try {
      await offlineDb.saveCatalogBooks(data.books);
      if (data.personalItems) await offlineDb.savePersonalItems(data.personalItems);
      await restoreSnapshotToFirestore(data);
    } catch {}

    await recordAuditEvent({
      action: 'BACKUP_RESTORED',
      targetType: 'backup',
      targetId: archive.checksum,
      details: `Restored verified snapshot v${archive.schemaVersion} (${archive.counts.titles} titles, ${archive.counts.patrons} patrons, ${archive.counts.loans} loans).`,
    });

    toast.success(
      `Restored verified snapshot (${archive.counts.titles} titles, ${archive.counts.loans} loans).`,
      'Restore Complete'
    );
  };

  const handleLogout = () => {
    setCurrentUser(GUEST_USER);
    setActiveTab('catalog');
    toast.info('You have signed out cleanly.', 'Signed Out');
  };

  const handleOpenImportModal = (type: 'books' | 'parents' = 'books') => {
    setImportDefaultType(type);
    setIsImportModalOpen(true);
  };

  const handleAddBook = async (bookData: Omit<Book, 'id'>): Promise<string> => {
    const tempId = `bk-${Date.now()}`;
    const tempBook: Book = { ...bookData, id: tempId };
    setBooks(prev => [tempBook, ...prev]);
    try {
      const realId = await addBook(bookData);
      toast.success(`Book "${bookData.title}" saved to catalog.`, 'Book Cataloged');
      return realId || tempId;
    } catch (err: any) {
      toast.warning(`Saved "${bookData.title}" to local session cache.`, 'Offline Cache');
      return tempId;
    }
  };

  // Acquisitions, Patron Suggestions & Auto-Cataloging Handlers
  const handleCreateAcquisition = async (reqData: Omit<AcquisitionRequest, 'id'>) => {
    const tempId = `acq-${Date.now()}`;
    const optimistic: AcquisitionRequest = { ...reqData, id: tempId };
    setAcquisitions(prev => [optimistic, ...prev]);
    try {
      const realId = await createAcquisitionRequest(reqData);
      if (realId && realId !== tempId) {
        setAcquisitions(prev => prev.map(a => (a.id === tempId ? { ...a, id: realId } : a)));
      }
    } catch {}
    toast.success(
      language === 'dv'
        ? `"${reqData.title}" ލިސްޓަށް އިތުރުކުރެވިއްޖެ.`
        : `"${reqData.title}" added to the acquisitions queue.`,
      reqData.isDonation ? 'Donation Logged' : 'Request Submitted'
    );
  };

  const handleUpvoteAcquisition = async (requestId: string) => {
    const target = acquisitions.find(a => a.id === requestId);
    if (!target) return;
    const voterId = currentUser.id;
    const existing = target.upvoterIds || [];
    const nextUpvoters = existing.includes(voterId)
      ? existing.filter(id => id !== voterId)
      : [...existing, voterId];

    setAcquisitions(prev =>
      prev.map(a => (a.id === requestId ? { ...a, upvoterIds: nextUpvoters } : a))
    );
    try {
      await updateAcquisitionRequest(requestId, { upvoterIds: nextUpvoters });
    } catch {}
  };

  const handleUpdateAcquisition = async (id: string, data: Partial<AcquisitionRequest>) => {
    setAcquisitions(prev => prev.map(a => (a.id === id ? { ...a, ...data } : a)));
    try {
      await updateAcquisitionRequest(id, data);
    } catch {}
  };

  const handleDeleteAcquisition = async (id: string) => {
    setAcquisitions(prev => prev.filter(a => a.id !== id));
    try {
      await deleteAcquisitionRequest(id);
    } catch {}
    toast.info('Acquisition entry removed.', 'Deleted');
  };

  const handleReceiveAndCatalogAcquisition = async (req: AcquisitionRequest) => {
    const { bookData, assignedBarcodes } = convertAcquisitionToCatalogBook(req);
    const catalogedBookId = await handleAddBook(bookData);
    const todayIso = new Date().toISOString().split('T')[0];

    const updates: Partial<AcquisitionRequest> = {
      stage: 'Received & Cataloged',
      catalogedBookId,
      receivedDate: todayIso,
      patronNotifiedAt: todayIso,
    };

    setAcquisitions(prev =>
      prev.map(a => (a.id === req.id ? { ...a, ...updates } : a))
    );
    try {
      await updateAcquisitionRequest(req.id, updates);
    } catch {}

    toast.success(
      language === 'dv'
        ? `"${req.title}" ކެޓަލޮގް ކުރެވި (${assignedBarcodes.length} ކޮޕީ) ${req.requestedByName} އަށް އެންގިއްޖެ!`
        : `Cataloged ${assignedBarcodes.length} cop(y/ies) [${assignedBarcodes[0]}] and notified ${req.requestedByName}!`,
      'Received & Auto-Cataloged'
    );
  };

  const handleUpdateBook = async (id: string, data: Partial<Book>) => {
    const existing = books.find(b => b.id === id);
    setBooks(prev => prev.map(b => (b.id === id ? { ...b, ...data } : b)));
    if (existing && Array.isArray(existing.copies) && Array.isArray(data.copies) && data.copies.length < existing.copies.length) {
      const removedCopies = existing.copies.filter(
        c => !data.copies!.some(nc => nc.copyId === c.copyId || nc.barcode === c.barcode)
      );
      if (removedCopies.length > 0) {
        void recordAuditEvent({
          action: 'COPY_DELETED',
          targetType: 'copy',
          targetId: removedCopies.map(c => c.barcode).join(', '),
          details: `Removed ${removedCopies.length} physical cop(y/ies) from "${existing.title}".`,
        });
      }
    }
    try {
      await updateBook(id, data);
      toast.success('Book metadata updated.', 'Catalog Updated');
    } catch (err: any) {
      toast.warning('Book update saved in local session cache.', 'Offline Cache');
    }
  };

  const handleBulkUpdateBooks = async (updates: Array<{ id: string; data: Partial<Book> }>) => {
    if (!can('catalog:create_edit')) {
      toast.error(cannotReason('catalog:create_edit'), 'RBAC Restricted');
      return;
    }
    if (updates.length === 0) return;

    const patchMap = new Map(updates.map((u) => [u.id, u.data]));
    setBooks((prev) =>
      prev.map((b) => {
        const patch = patchMap.get(b.id);
        return patch ? { ...b, ...patch } : b;
      })
    );

    await Promise.all(
      updates.map((u) =>
        updateBook(u.id, u.data).catch(() => {})
      )
    );

    void recordAuditEvent({
      action: 'CATALOG_HEALTH_BULK_FIX',
      targetType: 'book',
      targetId: updates.slice(0, 5).map((u) => u.id).join(', '),
      details: `Applied bulk catalog health metadata fixes across ${updates.length} title(s).`,
    });
  };

  const handleDeleteBook = async (id: string) => {
    if (!can('catalog:delete')) {
      toast.error(cannotReason('catalog:delete'), 'RBAC Restricted');
      return;
    }
    const target = books.find(b => b.id === id);
    setBooks(prev => prev.filter(b => b.id !== id));
    try {
      await deleteBook(id);
    } catch {}
    await recordAuditEvent({
      action: 'BOOK_DELETED',
      targetType: 'book',
      targetId: id,
      details: `Deleted catalog record "${target?.title || id}" (ISBN: ${target?.isbn || 'N/A'}).`,
    });
    toast.info('Book record deleted from catalog.', 'Catalog Removed');
  };

  const handleUpdateSettings = async (newSettings: Partial<LibrarySettings>) => {
    if (!can('policies:edit') && !can('notifications:send')) {
      toast.error(cannotReason('policies:edit'), 'RBAC Restricted');
      return;
    }
    setSettings(prev => ({ ...prev, ...newSettings }));
    try {
      await updateSettings(newSettings);
    } catch {}
    await recordAuditEvent({
      action: 'POLICY_UPDATED',
      targetType: 'policy',
      targetId: 'settings/main',
      details: `Updated library configuration fields: ${Object.keys(newSettings).join(', ')}.`,
    });
    toast.success('Library circulation rules & MVR settings updated.', 'Settings Saved');
  };

  // Personal Collection Handlers
  const handleAddPersonalItem = (item: PersonalItem) => {
    setPersonalItems(prev => [item, ...prev]);
  };
  const handleUpdatePersonalItem = (id: string, data: Partial<PersonalItem>) => {
    setPersonalItems(prev => prev.map(p => (p.id === id ? { ...p, ...data } : p)));
  };
  const handleDeletePersonalItem = (id: string) => {
    setPersonalItems(prev => prev.filter(p => p.id !== id));
  };
  const handleImportPersonalItems = (imported: PersonalItem[]) => {
    setPersonalItems(prev => [...imported, ...prev]);
  };

  const todayIsoStr = new Date().toISOString().split('T')[0];
  const overdueCount = loans.filter(l => l.status === 'overdue' || (l.status === 'active' && l.dueDate < todayIsoStr)).length;
  const pendingAcquisitionsCount = acquisitions.filter(a => a.stage === 'Requested').length;

  let navItems: Array<{ id: string; label: string; icon: any; badge?: number; badgeColor?: string }> = [];

  if (isSuperAdmin) {
    navItems = [
      { id: 'dashboard', label: language === 'dv' ? 'ޑޭޝްބޯޑް' : 'Dashboard', icon: LayoutDashboard },
      { id: 'catalog', label: language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް' : 'Book Catalog', icon: BookOpen },
      { id: 'checkout-hub', label: language === 'dv' ? 'ފޮތް ދޫކުރުން / ހަވާލުކުރުން' : 'Circulation Desk', icon: RotateCcw, badge: loans.filter(l => l.status === 'active').length },
      { id: 'students', label: language === 'dv' ? 'މެންބަރުންގެ ލިސްޓު' : 'Members Directory', icon: Users },
      { id: 'acquisitions', label: language === 'dv' ? 'ފޮތް ހޯދުމާއި ބަޖެޓް' : 'Acquisitions & Budgets', icon: ShoppingBag, badge: pendingAcquisitionsCount > 0 ? pendingAcquisitionsCount : undefined },
      { id: 'stocktaking', label: language === 'dv' ? 'ސްޓޮކްޓޭކް އަދި ވީޑިންގ' : 'Stocktake & Weeding', icon: ClipboardCheck },
      { id: 'reading-challenges', label: language === 'dv' ? 'ކިޔުމުގެ ޗެލެންޖް' : 'Reading Challenges', icon: Award },
      { id: 'personal-library', label: t.personalLibrary, icon: Bookmark },
      { id: 'admin-panel', label: language === 'dv' ? 'އެޑްމިން އަދި ލެޖަރ' : 'Admin & MVR Ledger', icon: Shield, badge: overdueCount > 0 ? overdueCount : undefined, badgeColor: 'bg-rose-500' },
      { id: 'security-suite', label: language === 'dv' ? 'RBAC، ނޯޓިސް & ބެކަޕް' : 'Security, Notices & Backups', icon: ShieldCheck },
      { id: 'ai-assistant', label: t.aiLibrarian, icon: Sparkles },
      { id: 'faq', label: t.faqHelp, icon: HelpCircle }
    ];
  } else if (isDeskAssistant) {
    navItems = [
      { id: 'catalog', label: language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް' : 'Book Catalog', icon: BookOpen },
      { id: 'checkout-hub', label: language === 'dv' ? 'ފޮތް ދޫކުރުން / ހަވާލުކުރުން' : 'Circulation Desk', icon: RotateCcw, badge: loans.filter(l => l.status === 'active').length },
      { id: 'students', label: language === 'dv' ? 'މެންބަރުންގެ ލިސްޓު' : 'Members Directory', icon: Users },
      { id: 'security-suite', label: language === 'dv' ? 'ނޯޓިސް އަދި ސްލިޕް' : 'Overdue & Hold Notices', icon: ShieldCheck },
      { id: 'reading-challenges', label: language === 'dv' ? 'ކިޔުމުގެ ޗެލެންޖް' : 'Reading Challenges', icon: Award },
      { id: 'personal-library', label: t.personalLibrary, icon: Bookmark },
      { id: 'ai-assistant', label: t.aiLibrarian, icon: Sparkles },
      { id: 'faq', label: t.faqHelp, icon: HelpCircle }
    ];
  } else if (currentUser.role === 'parent') {
    navItems = [
      { id: 'parent-portal', label: t.parentPortal, icon: Users },
      { id: 'catalog', label: t.catalog, icon: BookOpen },
      { id: 'my-borrowings', label: t.myLoans, icon: ClipboardList },
      { id: 'reading-challenges', label: language === 'dv' ? 'ކިޔުމުގެ ޗެލެންޖް' : 'Reading Challenges', icon: Award },
      { id: 'personal-library', label: t.personalLibrary, icon: Bookmark },
      { id: 'ai-assistant', label: t.aiLibrarian, icon: Sparkles },
      { id: 'faq', label: t.faqHelp, icon: HelpCircle }
    ];
  } else if (isTeacher) {
    navItems = [
      { id: 'catalog', label: t.catalog, icon: BookOpen },
      { id: 'my-borrowings', label: t.myLoans, icon: ClipboardList },
      { id: 'reading-challenges', label: language === 'dv' ? 'ކްލާސް ކިޔުމުގެ ތަފާސްހިސާބު' : 'Class Reading Analytics', icon: Award },
      { id: 'ai-assistant', label: language === 'dv' ? 'ލެސަން މެޗަރ (Libby AI)' : 'AI Lesson Matcher', icon: Sparkles },
      { id: 'personal-library', label: t.personalLibrary, icon: Bookmark },
      { id: 'reference', label: t.reference, icon: BookMarked },
      { id: 'faq', label: t.faqHelp, icon: HelpCircle }
    ];
  } else {
    navItems = [
      { id: 'catalog', label: t.catalog, icon: BookOpen },
      { id: 'my-borrowings', label: t.myLoans, icon: ClipboardList },
      { id: 'reading-challenges', label: language === 'dv' ? 'ކިޔުމުގެ ޗެލެންޖް' : 'Reading Challenges', icon: Award },
      { id: 'personal-library', label: t.personalLibrary, icon: Bookmark },
      { id: 'reference', label: t.reference, icon: BookMarked },
      { id: 'ai-assistant', label: t.aiLibrarian, icon: Sparkles },
      { id: 'faq', label: t.faqHelp, icon: HelpCircle }
    ];
  }

  const handleToggleSidebar = () => {
    if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
      setIsSidebarCollapsed(prev => !prev);
    } else {
      setIsSidebarOpen(prev => !prev);
    }
  };

  const LIBRARIAN_TABS = new Set([
    'dashboard',
    'checkout-hub',
    'borrow-book',
    'return-book',
    'issued-books',
    'late-returns',
    'students',
    'admin-panel',
    'manage-students',
    'acquisitions',
    'stocktaking',
    'security-suite',
    'reports',
  ]);

  const workspaceMode: WorkspaceMode =
    activeTab === 'personal-library'
      ? 'personal'
      : LIBRARIAN_TABS.has(activeTab)
      ? 'librarian'
      : 'opac';

  const handleSelectWorkspaceMode = (mode: WorkspaceMode) => {
    if (mode === 'personal') {
      setActiveTab('personal-library');
      return;
    }
    if (mode === 'opac') {
      setActiveTab('catalog');
      return;
    }
    // Librarian Desk mode
    if (can('circulation:checkout')) {
      setActiveTab(isSuperAdmin ? 'dashboard' : 'checkout-hub');
      return;
    }
    const staffOrAdmin =
      users.find((u) => u.accessRole === 'super_admin' || u.role === 'admin') ||
      users.find((u) => u.accessRole === 'desk_assistant');
    if (staffOrAdmin) {
      setCurrentUser(staffOrAdmin);
      setActiveTab('checkout-hub');
      toast.info(
        language === 'dv'
          ? `ލައިބްރޭރިއަން ޑެސްކް (${staffOrAdmin.name}) ހުޅުވިއްޖެ`
          : `Switched to Librarian Desk (${staffOrAdmin.name})`,
        'Workspace Mode'
      );
    } else {
      setActiveTab('login');
    }
  };

  return (
    <div className={`min-h-screen bg-[#F7F5F0] dark:bg-[#121413] text-[#1C1917] dark:text-[#F5F3EE] ${isRtl ? 'font-faruma' : 'font-sans'} flex flex-col antialiased`}>
      {/* Clean Sticky Header */}
      <Header
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        setActiveTab={setActiveTab}
        workspaceMode={workspaceMode}
        onSelectWorkspaceMode={handleSelectWorkspaceMode}
        onOpenScanner={() => {
          setScannerCallback(null);
          setIsScannerOpen(true);
        }}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onOpenLoginModal={() => setActiveTab('login')}
        onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
        onLogout={handleLogout}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Cloud Firestore Quota Resilience Banner (Only shown when quota exhausted) */}
      {isQuotaExhausted && (
        <div className="bg-[#FFFBEB] dark:bg-[#78350F]/40 border-b border-[#FDE68A] dark:border-[#B45309]/60 px-4 py-2 flex items-center justify-between text-xs text-[#B45309] dark:text-[#FCD34D] flex-wrap gap-2 no-print">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-[#FDE68A] text-[#78350F] uppercase">
              {language === 'dv' ? 'އޮފްލައިން ކޭޝް' : 'Offline Resilient'}
            </span>
            <span className="font-medium">
              {language === 'dv'
                ? 'ކްލައުޑް ފަޔަރސްޓޯރ ޑެއިލީ ކޯޓާ ހަމަވެފައިވާތީ ލޯކަލް ކޭޝްގައި މަސައްކަތްކުރަނީ.'
                : 'Cloud Firestore daily write limit reached — operating smoothly via local resilient cache.'}
            </span>
          </div>
          <button
            onClick={() => setActiveTab('admin-panel')}
            className="text-[11px] font-bold px-2.5 py-1 bg-[#FDE68A] hover:bg-[#FCD34D] text-[#78350F] rounded-lg cursor-pointer"
          >
            {language === 'dv' ? 'ކޯޓާ ތަފްސީލު' : 'Diagnostics'}
          </button>
        </div>
      )}

      {/* Main Workspace Split (Sidebar + Fluid Content) */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Mirrored Collapsible Archival Navigation Sidebar */}
        <aside
          className={`fixed lg:static inset-y-0 start-0 border-e z-40 ${
            isSidebarCollapsed ? 'lg:w-[76px]' : 'w-64'
          } bg-[#0D2623] dark:bg-[#161918] text-[#E6EAE8] flex flex-col justify-between transition-all duration-200 border-[#193D38] dark:border-[#2E3330] no-print ${
            isSidebarOpen
              ? 'translate-x-0 shadow-2xl'
              : isRtl
              ? 'translate-x-full lg:translate-x-0'
              : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="p-3 space-y-4 overflow-y-auto">
            {/* Sidebar Brand Header + Collapse Toggle */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-[#193D38] dark:border-[#2E3330]">
              <div className={`flex items-center gap-2.5 ${isSidebarCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
                <LibraryEmblem size="sm" />
                {!isSidebarCollapsed && (
                  <div className="min-w-0">
                    <div className="font-extrabold text-[#F7F5F0] text-xs tracking-tight truncate">
                      {language === 'dv' ? 'މަގޫދޫ ލައިބްރަރީ' : 'Magoodhoo ILS'}
                    </div>
                    <div className="text-[10px] text-[#C26D3A] font-bold truncate">
                      {language === 'dv' ? 'މަގޫދޫ ސްކޫލް' : 'Reading Sanctuary'}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 text-[#A7BDB8] hover:text-white hover:bg-[#163B36] dark:hover:bg-[#232724] rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>

            <nav className="space-y-1">
              {!isSidebarCollapsed && (
                <div className="text-[10px] font-bold uppercase tracking-wider text-[#8BA7A1] dark:text-[#A19B91] px-3 py-1">
                  {t.navigationDesk}
                </div>
              )}
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      setIsSidebarOpen(false);
                    }}
                    title={isSidebarCollapsed ? item.label : undefined}
                    className={`w-full flex items-center ${isSidebarCollapsed ? 'lg:justify-center' : 'justify-between'} px-3 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                      isActive
                        ? 'bg-[#0F4C45] text-[#FFFFFF] shadow-xs ring-1 ring-white/10'
                        : 'text-[#CBD5D1] dark:text-[#D5D1C8] hover:bg-[#163B36] dark:hover:bg-[#232724] hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#F3DFB1]' : 'text-[#8BA7A1] dark:text-[#A19B91]'}`}
                        strokeWidth={1.75}
                      />
                      {!isSidebarCollapsed && <span className="truncate">{item.label}</span>}
                    </div>
                    {!isSidebarCollapsed && item.badge !== undefined && item.badge > 0 && (
                      <span
                        className={`text-[10px] font-mono tabular-nums font-bold text-white px-2 py-0.5 rounded-full ${
                          item.badgeColor === 'bg-rose-500' ? 'bg-[#B91C1C]' : 'bg-[#C26D3A]'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer */}
          <div className="p-3 border-t border-[#193D38] dark:border-[#2E3330] space-y-2 bg-[#091C1A]/80 dark:bg-[#121413]/70">
            <button
              type="button"
              onClick={() => setIsSidebarCollapsed(prev => !prev)}
              className="hidden lg:flex w-full items-center justify-center gap-2 py-1.5 px-2 rounded-lg text-[11px] font-bold text-[#8BA7A1] hover:text-white hover:bg-[#163B36] dark:hover:bg-[#232724] transition cursor-pointer"
              title="Collapse / Expand Sidebar"
            >
              {isSidebarCollapsed ? <PanelLeftOpen className="w-4 h-4" strokeWidth={1.75} /> : <PanelLeftClose className="w-4 h-4" strokeWidth={1.75} />}
              {!isSidebarCollapsed && <span>{language === 'dv' ? 'ސައިޑްބާ ހަނިކުރޭ' : 'Collapse Rail'}</span>}
            </button>

            {!isSidebarCollapsed && (
              currentUser.id !== 'guest' ? (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleLogout}
                    className="flex-1 bg-[#B91C1C]/20 hover:bg-[#B91C1C]/35 text-[#FCA5A5] border border-[#B91C1C]/40 font-bold text-xs py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    id="sidebar-logout-btn"
                  >
                    <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} /> {t.logout}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('login');
                      setIsSidebarOpen(false);
                    }}
                    className="flex-1 bg-[#163B36] hover:bg-[#1C4D46] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-[#E6EAE8] border border-[#24534C] dark:border-[#2E3330] font-bold text-xs py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                    id="sidebar-switch-account-btn"
                  >
                    <LogIn className="w-3.5 h-3.5" strokeWidth={1.75} /> {language === 'dv' ? 'ބަދަލުކުރޭ' : 'Switch'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('login');
                      setIsSidebarOpen(false);
                    }}
                    className="flex-1 bg-[#163B36] hover:bg-[#1C4D46] dark:bg-[#232724] dark:hover:bg-[#2E3330] text-white border border-[#24534C] dark:border-[#2E3330] font-bold text-xs py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5" strokeWidth={1.75} /> {t.login}
                  </button>
                  <button
                    onClick={() => setIsAddParentModalOpen(true)}
                    className="flex-1 bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold text-xs py-2 px-2 rounded-xl transition flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" strokeWidth={1.75} /> {language === 'dv' ? 'ރަޖިސްޓަރީ' : 'Sign Up'}
                  </button>
                </div>
              )
            )}
          </div>
        </aside>

        {/* Mobile Backdrop */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-xs z-30 lg:hidden"
          />
        )}

        {/* MAIN WORKSPACE CANVAS */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-28 sm:pb-12 bg-[#F7F5F0] dark:bg-[#121413] relative z-10 safe-bottom">
          <div className="max-w-[1440px] mx-auto space-y-6">
            {activeTab === 'login' && (
              <ErrorBoundary key="err-login" areaNameEn="Sign-In & Account" areaNameDv="ލޮގިން އަދި އެކައުންޓް" language={language} isAdmin={isSuperAdmin}>
                <LoginPage
                  currentUser={currentUser}
                  allUsers={users}
                  onLoginSuccess={(user) => setCurrentUser(user)}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'reference' && (
              <ErrorBoundary key="err-reference" areaNameEn="Reference Section" areaNameDv="ރެފަރެންސް ބައި" language={language} isAdmin={isSuperAdmin}>
                <ReferenceSection books={books} />
              </ErrorBoundary>
            )}

            {activeTab === 'dashboard' && (
              <ErrorBoundary key="err-dashboard" areaNameEn="Operations Dashboard" areaNameDv="ލައިބްރަރީ ޑޭޝްބޯޑް" language={language} isAdmin={isSuperAdmin}>
                <DashboardView
                  books={books}
                  users={users}
                  loans={loans}
                  reservations={reservations}
                  ledgerTransactions={ledgerTransactions}
                  currentUser={currentUser}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
                  onOpenCatalogHealth={() => setIsCatalogHealthOpen(true)}
                />
              </ErrorBoundary>
            )}

            {(activeTab === 'catalog' || activeTab === 'add-book') && (
              <ErrorBoundary
                key={`err-catalog-${catalogPopSeq}`}
                areaNameEn="OPAC Book Catalog"
                areaNameDv="ފޮތްތަކުގެ ކެޓަލޮގް"
                language={language}
                isAdmin={isSuperAdmin}
                onRecover={() => setSelectedUrlBookId(null)}
              >
                <BookCatalog
                  key={`catalog-view-${catalogPopSeq}`}
                  books={books}
                  currentUser={currentUser}
                  reservations={reservations}
                  users={users}
                  loans={loans}
                  settings={settings}
                  isLoading={isLoadingCatalog}
                  initialUrlFilters={urlCatalogFilters}
                  initialSelectedBookId={selectedUrlBookId}
                  onSelectedBookChange={(bookId) => setSelectedUrlBookId(bookId)}
                  onFiltersChange={handleCatalogFiltersChange}
                  onReserveBook={handleReserveBook}
                  onOpenCheckoutForBook={(book) => {
                    setPreselectedCheckoutBook(book);
                    setActiveTab('checkout-hub');
                  }}
                  onViewReferenceOnly={() => setActiveTab('reference')}
                  onOpenLogin={() => setActiveTab('login')}
                  onAddBook={handleAddBook}
                  onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
                  onOpenSmartCataloger={() => {
                    setSmartCatalogerMode('catalog');
                    setIsSmartCatalogerOpen(true);
                  }}
                  onEditBook={() => setIsAddBookModalOpen(true)}
                  onDeleteBook={handleDeleteBook}
                  onOpenImportModal={handleOpenImportModal}
                  onCancelReservation={handleCancelReservation}
                  onOpenChallenges={() => setActiveTab('reading-challenges')}
                  onOpenSuggestBook={() => setIsSuggestBookModalOpen(true)}
                />
              </ErrorBoundary>
            )}

            {(activeTab === 'borrow-book' || activeTab === 'return-book' || activeTab === 'issued-books' || activeTab === 'late-returns' || activeTab === 'checkout-hub') && (
              <ErrorBoundary key="err-circulation" areaNameEn="Circulation Desk" areaNameDv="ފޮތް ދޫކުރާ ޑެސްކް" language={language} isAdmin={isSuperAdmin}>
                {isLoadingCatalog && books.length === 0 ? (
                  <CirculationDeskSkeleton />
                ) : (
                  <QuickCheckout
                    books={books}
                    users={users}
                    loans={loans}
                    reservations={reservations}
                    settings={settings}
                    onProcessCheckout={handleProcessCheckout}
                    onProcessReturn={handleProcessReturn}
                    onRenewLoan={handleRenewLoan}
                    onOpenScanner={() => {
                      setScannerCallback(null);
                      setIsScannerOpen(true);
                    }}
                    preselectedBook={preselectedCheckoutBook}
                    preselectedMemberId={preselectedMemberCode}
                  />
                )}
              </ErrorBoundary>
            )}

            {activeTab === 'students' && (
              <ErrorBoundary
                key="err-patrons"
                areaNameEn="Members Directory"
                areaNameDv="މެންބަރުންގެ ލިސްޓު"
                language={language}
                isAdmin={isSuperAdmin}
                onRecover={() => setSelectedUrlPatronId(null)}
              >
                <MemberDirectory
                  allUsers={users}
                  loans={loans}
                  books={books}
                  currentUserRole={currentUser.role}
                  initialSelectedMemberId={selectedUrlPatronId}
                  onSelectedMemberChange={(memberId) => setSelectedUrlPatronId(memberId)}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onOpenImportModal={handleOpenImportModal}
                  onOpenReportCardSyncModal={() => setIsReportCardSyncModalOpen(true)}
                  onSelectMemberForCheckout={(memberCode) => {
                    setPreselectedMemberCode(memberCode);
                    setActiveTab('checkout-hub');
                  }}
                  onDeleteUser={handleDeleteUser}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'personal-library' && (
              <ErrorBoundary key="err-personal" areaNameEn="Personal Library" areaNameDv="ޕާސަނަލް ލައިބްރަރީ" language={language} isAdmin={isSuperAdmin}>
                <PersonalLibrary
                  items={personalItems}
                  currentUser={currentUser}
                  onAddItem={handleAddPersonalItem}
                  onUpdateItem={handleUpdatePersonalItem}
                  onDeleteItem={handleDeletePersonalItem}
                  onImportItems={handleImportPersonalItems}
                  onOpenScanner={(cb) => {
                    setScannerCallback(() => cb || null);
                    setIsScannerOpen(true);
                  }}
                  onOpenSmartCataloger={() => {
                    setSmartCatalogerMode('personal');
                    setIsSmartCatalogerOpen(true);
                  }}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'parent-portal' && (
              <ErrorBoundary key="err-parent" areaNameEn="Parent Portal" areaNameDv="ބެލެނިވެރިންގެ ޕޯޓަލް" language={language} isAdmin={isSuperAdmin}>
                <ParentDashboard
                  parentUser={currentUser}
                  allUsers={users}
                  loans={loans}
                  reservations={reservations}
                  books={books}
                  onRenewLoan={handleRenewLoan}
                  onDeleteUser={handleDeleteUser}
                  onCancelReservation={handleCancelReservation}
                  onAddChildToParent={async (name, grade, studentIdCode) => {
                    const childProfile: Omit<UserProfile, 'id'> = {
                      name,
                      grade,
                      studentIdCode,
                      role: 'student',
                      patronTier: 'student',
                      parentId: currentUser.id,
                      email: `${name.toLowerCase().replace(/\s+/g, '.')}@fmagoodhooschool.edu.mv`,
                      createdAt: new Date().toISOString().split('T')[0]
                    };
                    const newChildId = await createUserProfile(childProfile);
                    const existingChildren = currentUser.childrenIds || [];
                    await updateUserProfile(currentUser.id, {
                      childrenIds: [...existingChildren, newChildId]
                    });
                    toast.success(`Added student account for ${name}.`, 'Child Linked');
                  }}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                />
              </ErrorBoundary>
            )}

            {(activeTab === 'manage-students' || activeTab === 'admin-panel') && (
              <ErrorBoundary key="err-admin" areaNameEn="Admin & MVR Ledger" areaNameDv="އެޑްމިން އަދި ލެޖަރ" language={language} isAdmin={isSuperAdmin}>
                <AdminPanel
                  books={books}
                  users={users}
                  loans={loans}
                  settings={settings}
                  ledgerTransactions={ledgerTransactions}
                  immutableAuditLogs={auditLogs}
                  currentUser={currentUser}
                  currentUserName={currentUser.name}
                  isQuotaExhausted={isQuotaExhausted}
                  onAddBook={handleAddBook}
                  onUpdateBook={handleUpdateBook}
                  onDeleteBook={handleDeleteBook}
                  onDeleteUser={handleDeleteUser}
                  onUpdateSettings={handleUpdateSettings}
                  onMarkFeePaid={handleMarkFeePaid}
                  onWaiveFee={handleWaiveFee}
                  onRecordLedgerTransaction={handleRecordLedgerTransaction}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onOpenImportModal={handleOpenImportModal}
                  onOpenReportCardSyncModal={() => setIsReportCardSyncModalOpen(true)}
                  onOpenSecuritySuite={() => setActiveTab('security-suite')}
                  onOpenCatalogHealth={() => setIsCatalogHealthOpen(true)}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'security-suite' && (
              <ErrorBoundary key="err-security" areaNameEn="Security & Backups" areaNameDv="ސެކިއުރިޓީ އަދި ބެކަޕް" language={language} isAdmin={isSuperAdmin}>
                <SecurityBackupSuiteView
                  currentUser={currentUser}
                  users={users}
                  books={books}
                  loans={loans}
                  reservations={reservations}
                  ledgerTransactions={ledgerTransactions}
                  acquisitions={acquisitions}
                  personalItems={personalItems}
                  auditLogs={auditLogs}
                  settings={settings}
                  onUpdateSettings={handleUpdateSettings}
                  onUpdateUserRole={handleUpdateUserRole}
                  onExportBackup={handleExportBackup}
                  onRestoreBackup={handleRestoreBackup}
                  onRecordAuditEvent={recordAuditEvent}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'ai-assistant' && (
              <ErrorBoundary key="err-ai" areaNameEn="Libby AI Assistant" areaNameDv="ލިބީ އޭއައި އެސިސްޓަންޓް" language={language} isAdmin={isSuperAdmin}>
                <AIAssistant
                  books={books}
                  loans={loans}
                  currentUser={currentUser}
                  onSelectBook={(book) => {
                    setPreselectedCheckoutBook(book);
                    setActiveTab('catalog');
                  }}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onOpenSmartCataloger={() => {
                    setSmartCatalogerMode(currentUser.role === 'admin' ? 'catalog' : 'personal');
                    setIsSmartCatalogerOpen(true);
                  }}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'reports' && (
              <ErrorBoundary key="err-reports" areaNameEn="Analytics & Reports" areaNameDv="ތަފާސްހިސާބު" language={language} isAdmin={isSuperAdmin}>
                <ReportsAnalytics books={books} loans={loans} users={users} />
              </ErrorBoundary>
            )}

            {activeTab === 'stocktaking' && (
              <ErrorBoundary key="err-stocktaking" areaNameEn="Stocktake & Weeding" areaNameDv="ސްޓޮކްޓޭކް އަދި ވީޑިންގ" language={language} isAdmin={isSuperAdmin}>
                <InventoryAuditView
                  books={books}
                  loans={loans}
                  onAutoCheckIn={(loan) => handleProcessReturn(loan, 0)}
                  onUpdateBook={handleUpdateBook}
                  onDeleteBook={handleDeleteBook}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'acquisitions' && (
              <ErrorBoundary key="err-acquisitions" areaNameEn="Acquisitions & Budgets" areaNameDv="ފޮތް ހޯދުމާއި ބަޖެޓް" language={language} isAdmin={isSuperAdmin}>
                <AcquisitionsBoardView
                  requests={acquisitions}
                  books={books}
                  settings={settings}
                  onCreateRequest={handleCreateAcquisition}
                  onUpdateRequest={handleUpdateAcquisition}
                  onDeleteRequest={handleDeleteAcquisition}
                  onToggleUpvote={handleUpvoteAcquisition}
                  onReceiveAndCatalog={handleReceiveAndCatalogAcquisition}
                  onUpdateSettings={handleUpdateSettings}
                  onOpenSuggestionPortal={() => setIsSuggestBookModalOpen(true)}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'reading-challenges' && (
              <ErrorBoundary key="err-challenges" areaNameEn="Reading Challenges" areaNameDv="ކިޔުމުގެ ޗެލެންޖް" language={language} isAdmin={isSuperAdmin}>
                <ReadingEngagementView
                  currentUser={currentUser}
                  users={users}
                  loans={loans}
                  books={books}
                />
              </ErrorBoundary>
            )}

            {(activeTab === 'my-borrowings' || activeTab === 'my-loans') && (
              <ErrorBoundary key="err-my-loans" areaNameEn="My Borrowed Books" areaNameDv="އަޅުގަނޑު ގެންގުޅޭ ފޮތްތައް" language={language} isAdmin={isSuperAdmin}>
                <MyBorrowings
                  currentUser={currentUser}
                  loans={loans}
                  reservations={reservations}
                  books={books}
                  isLoading={isLoadingCatalog}
                  onRenewLoan={handleRenewLoan}
                  onCancelReservation={handleCancelReservation}
                  onOpenChallenges={() => setActiveTab('reading-challenges')}
                />
              </ErrorBoundary>
            )}

            {activeTab === 'faq' && (
              <ErrorBoundary key="err-faq" areaNameEn="Help & Guide" areaNameDv="އެހީތެރިކަމާއި ގައިޑް" language={language} isAdmin={isSuperAdmin}>
                <FaqHelpView />
              </ErrorBoundary>
            )}
          </div>
        </main>
      </div>

      {/* Concise School Library Footer */}
      <footer className="bg-[#0D2623] dark:bg-[#161918] text-[#CBD5D1] border-t border-[#193D38] dark:border-[#2E3330] relative z-20 no-print">
        <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 md:grid-cols-3 gap-8 text-xs">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2.5">
              <LibraryEmblem size="sm" />
              <span className="font-extrabold text-[#F7F5F0] text-sm tracking-tight archival-heading">
                F. Magoodhoo School Library
              </span>
            </div>
            <p className="text-[#9CB3AD] dark:text-[#A19B91] leading-relaxed">
              Bilingual Integrated Library System (ILS) & Personal Reading Sanctuary for students, staff, and guardians.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-[#F7F5F0] uppercase text-[11px] tracking-wider">Navigation</h4>
            <ul className="space-y-1.5 text-[#9CB3AD] dark:text-[#A19B91] font-medium">
              <li><button onClick={() => setActiveTab('catalog')} className="hover:text-[#F3DFB1] transition cursor-pointer">{t.catalog}</button></li>
              <li><button onClick={() => setActiveTab('personal-library')} className="hover:text-[#F3DFB1] transition cursor-pointer">{t.personalLibrary}</button></li>
              <li><button onClick={() => setActiveTab('faq')} className="hover:text-[#F3DFB1] transition cursor-pointer">{t.faqHelp}</button></li>
            </ul>
          </div>

          <div className="space-y-2">
            <h4 className="font-bold text-[#F7F5F0] uppercase text-[11px] tracking-wider">School Contact</h4>
            <ul className="space-y-1.5 text-[#9CB3AD] dark:text-[#A19B91] font-medium">
              <li className="flex items-center gap-2"><MapPin className="w-3.5 h-3.5 text-[#C26D3A]" strokeWidth={1.75} /> F. Magoodhoo, Republic of Maldives</li>
              <li className="flex items-center gap-2 font-mono tabular-nums"><Phone className="w-3.5 h-3.5 text-[#C26D3A]" strokeWidth={1.75} /> <bdi dir="ltr">+960 6740018</bdi></li>
              <li className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#C26D3A]" strokeWidth={1.75} /> <bdi dir="ltr">admin@magoodhooschool.edu.mv</bdi></li>
            </ul>
          </div>
        </div>
        <div className="bg-[#091C1A] dark:bg-[#121413] border-t border-[#193D38] dark:border-[#2E3330] py-3 px-6 text-center text-[11px] text-[#8BA7A1] dark:text-[#A19B91] font-medium">
          © 2026 F. Magoodhoo School Library Portal. All Rights Reserved.
        </div>
      </footer>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#FFFFFF]/95 dark:bg-[#1A1D1B]/95 backdrop-blur-lg border-t border-[#E2DDD5] dark:border-[#2E3330] px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] flex items-center justify-around shadow-2xl safe-bottom no-print">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'catalog' ? 'text-[#0F4C45] dark:text-[#6EE7B7] font-extrabold' : 'text-[#6B655D] dark:text-[#A19B91]'
          }`}
        >
          <BookOpen className="w-5 h-5" strokeWidth={1.75} />
          <span>{language === 'dv' ? 'ކެޓަލޮގް' : 'Catalog'}</span>
        </button>

        <button
          onClick={() => setActiveTab('personal-library')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'personal-library' ? 'text-[#0F4C45] dark:text-[#6EE7B7] font-extrabold' : 'text-[#6B655D] dark:text-[#A19B91]'
          }`}
        >
          <Bookmark className="w-5 h-5" strokeWidth={1.75} />
          <span>{language === 'dv' ? 'ލައިބްރަރީ' : 'Shelf'}</span>
        </button>

        <button
          onClick={() => {
            setScannerCallback(null);
            setIsScannerOpen(true);
          }}
          className="flex flex-col items-center justify-center w-11 h-11 bg-[#0F4C45] hover:bg-[#16655B] text-white rounded-full shadow-lg -mt-5 border-2 border-[#FFFFFF] dark:border-[#1A1D1B] active:scale-95 transition"
          title="Scan Book Barcode"
        >
          <Scan className="w-5 h-5" strokeWidth={1.75} />
        </button>

        <button
          onClick={() => setActiveTab('ai-assistant')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'ai-assistant' ? 'text-[#0F4C45] dark:text-[#6EE7B7] font-extrabold' : 'text-[#6B655D] dark:text-[#A19B91]'
          }`}
        >
          <Sparkles className="w-5 h-5" strokeWidth={1.75} />
          <span>{language === 'dv' ? 'އޭއައި' : 'Libby AI'}</span>
        </button>

        <button
          onClick={() => setActiveTab('login')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'login' ? 'text-[#0F4C45] dark:text-[#6EE7B7] font-extrabold' : 'text-[#6B655D] dark:text-[#A19B91]'
          }`}
        >
          <User className="w-5 h-5" strokeWidth={1.75} />
          <span>{language === 'dv' ? 'ޕްރޮފައިލް' : 'Profile'}</span>
        </button>
      </div>

      {/* MODALS */}
      <ErrorBoundary compact areaNameEn="Command Palette" areaNameDv="ކޮމާންޑް ޕެލެޓް" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsCommandPaletteOpen(false)}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          books={books}
          users={users}
          personalItems={personalItems}
          isAdmin={isSuperAdmin}
          onSelectBook={(book) => {
            setPreselectedCheckoutBook(book);
            setActiveTab(can('circulation:checkout') ? 'checkout-hub' : 'catalog');
          }}
          onSelectUser={(user) => {
            setPreselectedMemberCode(user.studentIdCode || user.staffIdCode || user.id);
            setActiveTab(can('circulation:checkout') ? 'checkout-hub' : 'students');
          }}
          onNavigateTab={(tab) => setActiveTab(tab)}
          onOpenScanner={() => {
            setScannerCallback(null);
            setIsScannerOpen(true);
          }}
          onOpenCatalogHealth={() => setIsCatalogHealthOpen(true)}
        />
      </ErrorBoundary>

      <AddBookModal
        isOpen={isAddBookModalOpen}
        onClose={() => setIsAddBookModalOpen(false)}
        onAddBook={handleAddBook}
        onOpenSmartCataloger={() => {
          setSmartCatalogerMode('catalog');
          setIsSmartCatalogerOpen(true);
        }}
      />

      <ErrorBoundary compact areaNameEn="AI Cataloger" areaNameDv="އޭއައި ކެޓަލޮގަރ" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsSmartCatalogerOpen(false)}>
        <SmartAICatalogerModal
          isOpen={isSmartCatalogerOpen}
          onClose={() => setIsSmartCatalogerOpen(false)}
          mode={smartCatalogerMode}
          currentUserId={currentUser.id}
          onSaveCatalogBook={handleAddBook}
          onSavePersonalItem={handleAddPersonalItem}
        />
      </ErrorBoundary>

      <ErrorBoundary compact areaNameEn="Barcode Scanner" areaNameDv="ބާކޯޑް ސްކޭނަރ" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsScannerOpen(false)}>
        <BarcodeScannerModal
          isOpen={isScannerOpen}
          onClose={() => {
            setIsScannerOpen(false);
            setScannerCallback(null);
          }}
          books={books}
          users={users}
          loans={loans}
          settings={settings}
          onProcessReturn={handleProcessReturn}
          onScanResult={(scannedCode, matchedBook) => {
            if (scannerCallback) {
              scannerCallback(scannedCode);
              setScannerCallback(null);
              setIsScannerOpen(false);
              return;
            }
            if (matchedBook) {
              setPreselectedCheckoutBook(matchedBook);
              setActiveTab(currentUser.role === 'admin' ? 'checkout-hub' : 'catalog');
            }
          }}
        />
      </ErrorBoundary>

      <AddParentModal
        isOpen={isAddParentModalOpen}
        onClose={() => setIsAddParentModalOpen(false)}
        allUsers={users}
        onCreateParentAccount={handleCreateParentAccount}
      />

      <ErrorBoundary compact areaNameEn="Bulk Import" areaNameDv="އިމްޕޯޓް މޯޑަލް" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsImportModalOpen(false)}>
        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => setIsImportModalOpen(false)}
          defaultType={importDefaultType}
          onImportBooks={handleBulkImportBooks}
          onImportParents={handleBulkImportParents}
          onImportStaff={handleBulkImportStaff}
        />
      </ErrorBoundary>

      <ErrorBoundary compact areaNameEn="Report Card Sync" areaNameDv="ރިޕޯޓް ކާޑް ސިންކް" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsReportCardSyncModalOpen(false)}>
        <ReportCardSyncModal
          isOpen={isReportCardSyncModalOpen}
          onClose={() => setIsReportCardSyncModalOpen(false)}
        />
      </ErrorBoundary>

      <PatronSuggestionModal
        isOpen={isSuggestBookModalOpen}
        onClose={() => setIsSuggestBookModalOpen(false)}
        currentUser={currentUser}
        requests={acquisitions}
        onCreateRequest={handleCreateAcquisition}
        onToggleUpvote={handleUpvoteAcquisition}
      />

      <ErrorBoundary compact areaNameEn="AI Catalog Health" areaNameDv="ކެޓަލޮގް ހެލްތް އޮޑިޓް" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsCatalogHealthOpen(false)}>
        <CatalogHealthModal
          isOpen={isCatalogHealthOpen}
          onClose={() => setIsCatalogHealthOpen(false)}
          books={books}
          onApplyBulkFixes={handleBulkUpdateBooks}
          onNavigateTab={(tab) => setActiveTab(tab)}
        />
      </ErrorBoundary>

      <ErrorBoundary compact areaNameEn="Offline Sync Outbox" areaNameDv="ސިންކް އައުޓްބޮކްސް" language={language} isAdmin={isSuperAdmin} onRecover={() => setIsSyncOutboxOpen(false)}>
        <SyncOutboxModal
          isOpen={isSyncOutboxOpen}
          onClose={() => setIsSyncOutboxOpen(false)}
          isOnline={isOnline}
          syncState={syncState}
          onRunSync={runOutboxSync}
          onDismissConflict={(id) => offlineSyncEngine.dismissConflict(id)}
          onClearAllConflicts={() => offlineSyncEngine.clearAllConflicts()}
        />
      </ErrorBoundary>

      {/* PWA Offline Mode & Outbox Sync Indicator */}
      {(!isOnline || syncState.pendingCount > 0 || syncState.conflicts.length > 0) && (
        <div
          role="status"
          className="fixed bottom-16 sm:bottom-6 start-4 z-50 flex flex-wrap items-center gap-2 rounded-xl bg-slate-900 text-amber-300 border border-amber-500/40 px-3.5 py-2 text-xs font-bold shadow-lg no-print max-w-lg"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-emerald-400' : 'bg-amber-400'}`} />
          <span>
            {!isOnline
              ? (language === 'dv'
                  ? `އޮފްލައިން މޯޑު${syncState.pendingCount > 0 ? ` — ${syncState.pendingCount} މުޢާމަލާތް ކިއުގައި` : ''}`
                  : `Offline Mode${syncState.pendingCount > 0 ? ` — ${syncState.pendingCount} outbox action(s) queued` : ' — Browsing cached catalog'}`)
              : syncState.pendingCount > 0
              ? `${syncState.pendingCount} pending outbox operation(s)`
              : `${syncState.conflicts.length} sync conflict notice(s) reconciled`}
          </span>
          {(syncState.pendingCount > 0 || syncState.conflicts.length > 0) && (
            <button
              type="button"
              onClick={() => setIsSyncOutboxOpen(true)}
              className="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-white text-[11px] font-bold cursor-pointer"
            >
              Inspect Queue
            </button>
          )}
          {isOnline && syncState.pendingCount > 0 && (
            <button
              type="button"
              onClick={() => void runOutboxSync()}
              disabled={syncState.isSyncing}
              className="px-2 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
            >
              {syncState.isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          )}
          {syncState.conflicts.length > 0 && (
            <button
              type="button"
              onClick={() => void offlineSyncEngine.clearAllConflicts()}
              className="px-2 py-0.5 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-[11px] font-bold cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
