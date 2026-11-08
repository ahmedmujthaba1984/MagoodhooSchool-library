import React, { useEffect, useState } from 'react';
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
  updateReservation,
  cancelReservation,
  updateSettings,
  saveUserProfile,
  createUserProfile,
  updateUserProfile,
  deleteUserProfile
} from './lib/firebase';
import { Book, UserProfile, Loan, Reservation, LibrarySettings } from './types';
import { BookCatalog } from './components/BookCatalog';
import { ReferenceSection } from './components/ReferenceSection';
import { ParentDashboard } from './components/ParentDashboard';
import { QuickCheckout } from './components/QuickCheckout';
import { MyBorrowings } from './components/MyBorrowings';
import { AdminPanel } from './components/AdminPanel';
import { ReportsAnalytics } from './components/ReportsAnalytics';
import { Header } from './components/Header';
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
import { portalSyncManager } from './lib/externalPortalSync';
import { useLanguage } from './lib/i18n';
import { useToast } from './lib/toast';
import { offlineQueue } from './lib/offlineQueue';
import { useOnlineStatus } from './lib/usePWAInstall';
import { calculateSchoolDueDate } from './lib/schoolCalendar';
import { sampleBooks, sampleUsers, sampleLoans, sampleReservations, initialSettings } from './data/seedData';
import {
  LayoutDashboard,
  BookOpen,
  PlusCircle,
  BookMarked,
  RotateCcw,
  Users,
  UserCheck,
  ClipboardList,
  AlertTriangle,
  BarChart3,
  HelpCircle,
  LogIn,
  UserPlus,
  Library,
  MapPin,
  Phone,
  Mail,
  Facebook,
  Twitter,
  Instagram,
  Menu,
  X,
  Shield,
  Scan,
  User,
  LogOut,
  Sparkles
} from 'lucide-react';

const GUEST_USER: UserProfile = {
  id: 'guest',
  name: 'Guest Visitor',
  email: 'guest@oakridge.edu.mv',
  role: 'student',
  createdAt: new Date().toISOString().split('T')[0]
};

export default function App() {
  const { t, language, isRtl } = useLanguage();
  const { toast } = useToast();
  const isOnline = useOnlineStatus();
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [users, setUsers] = useState<UserProfile[]>(sampleUsers);
  const [loans, setLoans] = useState<Loan[]>(sampleLoans);
  const [reservations, setReservations] = useState<Reservation[]>(sampleReservations);
  const [settings, setSettings] = useState<LibrarySettings>(initialSettings);

  // Automatic Offline Queue Synchronization when device comes back online
  useEffect(() => {
    const handleOnline = async () => {
      const queue = offlineQueue.getQueue();
      if (queue.length > 0) {
        toast.info(
          language === 'dv'
            ? `އިންޓަރނެޓް ގުޅިއްޖެ! ކިއު ކުރެވިފައިވާ ${queue.length} ރިޒަވޭޝަން ސިންކް ވަނީ...`
            : `Connection online: Syncing ${queue.length} offline queued reservation(s)...`,
          'PWA Offline Sync'
        );
        try {
          const res = await fetch('/api/reservations/queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queue })
          });
          if (res.ok) {
            offlineQueue.clear();
            toast.success(
              language === 'dv'
                ? `ކިއުގައި ހުރި ރިޒަވޭޝަންތައް ކާމިޔާބުކަމާއެކު ސިންކް ވެއްޖެ!`
                : `Successfully synchronized all offline queued reservations!`,
              'PWA Live Sync'
            );
          }
        } catch (err) {
          console.warn('Batch sync fallback note:', err);
        }
      }
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [toast, language]);

  const [currentUser, setCurrentUser] = useState<UserProfile>(sampleUsers[0]);
  const [activeTab, setActiveTab] = useState<string>('catalog');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState<boolean>(false);
  const [isAddParentModalOpen, setIsAddParentModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [isReportCardSyncModalOpen, setIsReportCardSyncModalOpen] = useState<boolean>(false);
  const [importDefaultType, setImportDefaultType] = useState<'books' | 'parents' | 'staff'>('books');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState<boolean>(false);

  // Initialize and subscribe to Firestore & External Report Card Portal Sync
  useEffect(() => {
    let unsubscribeBooks: () => void;
    let unsubscribeUsers: () => void;
    let unsubscribeLoans: () => void;
    let unsubscribeRes: () => void;
    let unsubscribeSet: () => void;

    // Listen to Quota Exhaustion state across the app
    const unsubscribeQuota = subscribeQuotaStatus((exhausted) => {
      setIsQuotaExhausted(exhausted);
    });

    async function init() {
      try {
        await initializeDatabaseIfEmpty();
      } catch (err) {
        console.warn("Database initialization skipped or running offline:", err);
      }

      // Start Real-Time Live Cloud Firestore Sync from Report Card Portal (https://reportcard-fmagoodhooschool.vercel.app/)
      try {
        portalSyncManager.startRealtimeSync();
      } catch (e) {
        console.warn("Report Card Live Sync init note:", e);
      }

      unsubscribeBooks = subscribeBooks(
        (data) => {
          if (data && data.length > 0) {
            setBooks(data);
          }
          setIsLoading(false);
        },
        (err) => {
          console.warn("Books subscription notice:", err);
          setIsLoading(false);
        }
      );

      unsubscribeUsers = subscribeUsers(
        (data) => {
          if (data && data.length > 0) {
            setUsers(data);
          }
        },
        (err) => console.warn("Users subscription notice:", err)
      );

      unsubscribeLoans = subscribeLoans(
        (data) => {
          if (data && data.length > 0) setLoans(data);
        },
        (err) => console.warn("Loans subscription notice:", err)
      );

      unsubscribeRes = subscribeReservations(
        (data) => {
          if (data && data.length > 0) setReservations(data);
        },
        (err) => console.warn("Reservations subscription notice:", err)
      );

      unsubscribeSet = subscribeSettings(
        (data) => setSettings(data),
        (err) => console.warn("Settings subscription notice:", err)
      );
    }

    init();

    return () => {
      if (unsubscribeBooks) unsubscribeBooks();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeLoans) unsubscribeLoans();
      if (unsubscribeRes) unsubscribeRes();
      if (unsubscribeSet) unsubscribeSet();
      if (unsubscribeQuota) unsubscribeQuota();
      portalSyncManager.stopRealtimeSync();
    };
  }, []);

  // Sync selected user profile when users state updates
  useEffect(() => {
    const updated = users.find(u => u.id === currentUser.id);
    if (updated) {
      setCurrentUser(updated);
    }
  }, [users]);

  // Auto-open Add Book Modal when 'add-book' tab is selected from sidebar
  useEffect(() => {
    if (activeTab === 'add-book') {
      setIsAddBookModalOpen(true);
    }
  }, [activeTab]);

  // Handle Online Book Reservation with Optimistic Update and Offline Queue
  const handleReserveBook = async (book: Book) => {
    const tempId = `res-${Date.now()}`;
    const newRes: Reservation = {
      id: tempId,
      bookId: book.id,
      bookTitle: book.title,
      userId: currentUser.id,
      userName: currentUser.name,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    setReservations(prev => [newRes, ...prev]);

    if (!navigator.onLine) {
      offlineQueue.enqueue({
        id: tempId,
        bookId: book.id,
        bookTitle: book.title,
        userId: currentUser.id,
        userName: currentUser.name,
        userGrade: currentUser.grade,
        requestDate: newRes.requestDate
      });
      toast.info(
        language === 'dv'
          ? `އިންޓަރނެޓް ނެތުމުން ނަންނޯޓު ކިއު ކުރެވިއްޖެ! އަލުން ގުޅުމުން ސިންކް ވާނެ.`
          : `Offline Mode: Reservation queued! It will automatically sync once connection restores.`,
        'Offline Queue'
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
      console.warn("Reservation saved to local session (offline cache):", err);
    }

    toast.success(
      language === 'dv'
        ? `"${book.title}" އަށް އޮންލައިންކޮށް ނަންނޯޓު ކުރެވިއްޖެ!`
        : `Successfully placed online reservation request for "${book.title}"!`,
      'Reservation Confirmed'
    );
  };

  // Handle Online Book Reservation Cancellation with Optimistic Update
  const handleCancelReservation = async (reservationId: string) => {
    setReservations(prev => prev.filter(r => r.id !== reservationId));
    try {
      await cancelReservation(reservationId);
    } catch (err) {
      console.warn("Reservation cancelled locally:", err);
    }
    toast.info(
      language === 'dv' ? 'ރިޒަވޭޝަން ކެންސަލް ކުރެވިއްޖެ.' : 'Reservation cancelled successfully.',
      'Hold Released'
    );
  };

  // Handle Librarian Checkout Process with Optimistic Update & Student Limits Validation
  const handleProcessCheckout = async (
    book: Book,
    borrower: UserProfile,
    daysToBorrow: number,
    guardianName?: string,
    guardianPhone?: string,
    guardianNotes?: string
  ) => {
    if (book.availableCopies <= 0) {
      toast.error(`No copies of "${book.title}" are currently available in stock.`, 'Out of Stock');
      return;
    }

    if (book.isReferenceOnly) {
      toast.error(`"${book.title}" is a Reference-Only volume and cannot be taken outside the library.`, 'Reference Only');
      return;
    }

    // Validate Student Borrowing Limits
    const activeBorrowerLoans = loans.filter(l => l.userId === borrower.id && l.status === 'active');
    const maxAllowed = borrower.role === 'staff' || borrower.role === 'admin'
      ? (settings.maxBooksPerStaff || 7)
      : (settings.maxBooksPerStudent || 3);

    if (activeBorrowerLoans.length >= maxAllowed) {
      toast.error(
        language === 'dv'
          ? `ދަރިވަރަށް މިހާރު އިތުރު ފޮތެއް ނުނެގޭނެ (${maxAllowed} ފޮތް ހަމަވެއްޖެ). އަނބުރާ ރައްދުކުރެއްވުމަށްފަހު އަލުން ނަންގަވާ.`
          : `Borrowing limit reached: ${borrower.name} already has ${activeBorrowerLoans.length} active books (Max: ${maxAllowed}). Return a book to borrow another.`,
        'Loan Limit Exceeded'
      );
      return;
    }

    const issueDateObj = new Date();
    const issueDateStr = issueDateObj.toISOString().split('T')[0];
    const dueDateStr = calculateSchoolDueDate(issueDateObj, daysToBorrow);

    const tempLoanId = `loan-${Date.now()}`;
    const newLoan: Loan = {
      id: tempLoanId,
      bookId: book.id,
      bookTitle: book.title,
      bookIsbn: book.isbn,
      userId: borrower.id,
      userName: borrower.name,
      userGrade: borrower.grade || 'Student Member',
      issueDate: issueDateStr,
      dueDate: dueDateStr,
      status: 'active',
      renewalCount: 0,
      lateFee: 0,
      feePaid: true
    };

    // Optimistically update local states
    setLoans(prev => [newLoan, ...prev]);
    setBooks(prev => prev.map(b => b.id === book.id ? { ...b, availableCopies: Math.max(0, b.availableCopies - 1) } : b));

    try {
      await createLoan({
        bookId: newLoan.bookId,
        bookTitle: newLoan.bookTitle,
        bookIsbn: newLoan.bookIsbn,
        userId: newLoan.userId,
        userName: newLoan.userName,
        userGrade: newLoan.userGrade,
        issueDate: newLoan.issueDate,
        dueDate: newLoan.dueDate,
        status: newLoan.status,
        renewalCount: newLoan.renewalCount,
        lateFee: newLoan.lateFee,
        feePaid: newLoan.feePaid
      });
      await updateBook(book.id, {
        availableCopies: Math.max(0, book.availableCopies - 1)
      });
    } catch (err) {
      console.warn("Checkout persisted in local cache (offline mode):", err);
    }

    toast.success(
      language === 'dv'
        ? `"${book.title}" ކާމިޔާބުކަމާއެކު ދޫކުރެވިއްޖެ! އަނބުރާ ގެންނަންޖެހޭ ތާރީޚް: ${dueDateStr}`
        : `Successfully checked out "${book.title}" to ${borrower.name}! Due on ${dueDateStr}.`,
      'Book Issued'
    );
  };

  // Handle Process Return with Optimistic Update
  const handleProcessReturn = async (loan: Loan, calculatedFee: number) => {
    const todayStr = new Date().toISOString().split('T')[0];

    // Optimistically update loan and book in local state
    setLoans(prev => prev.map(l => l.id === loan.id ? {
      ...l,
      returnDate: todayStr,
      status: 'returned',
      lateFee: calculatedFee,
      feePaid: calculatedFee === 0
    } : l));

    setBooks(prev => prev.map(b => b.id === loan.bookId ? {
      ...b,
      availableCopies: Math.min(b.totalCopies, b.availableCopies + 1)
    } : b));

    try {
      await updateLoan(loan.id, {
        returnDate: todayStr,
        status: 'returned',
        lateFee: calculatedFee,
        feePaid: calculatedFee === 0
      });

      const targetBook = books.find(b => b.id === loan.bookId);
      if (targetBook) {
        await updateBook(targetBook.id, {
          availableCopies: Math.min(targetBook.totalCopies, targetBook.availableCopies + 1)
        });
      }
    } catch (err) {
      console.warn("Return persisted in local cache:", err);
    }

    toast.success(
      calculatedFee > 0
        ? `Book "${loan.bookTitle}" returned. Late fee calculated: $${calculatedFee.toFixed(2)}.`
        : `Book "${loan.bookTitle}" returned on time. Thank you!`,
      'Return Processed'
    );
  };

  // Handle Renew Loan with Optimistic Update & Reservation Collision Check
  const handleRenewLoan = async (loan: Loan) => {
    if (loan.renewalCount >= settings.maxRenewals) {
      toast.error(
        language === 'dv'
          ? `އެންމެ ގިނަވެގެން އިތުރުކުރެވޭނެ އަދަދު (${settings.maxRenewals}) ހަމަވެއްޖެ.`
          : `Maximum renewal limit (${settings.maxRenewals}) reached for this book.`,
        'Renewal Limit'
      );
      return;
    }

    // CRITICAL: Block renewals if another patron has reserved the item
    const hasReservationConflict = reservations.some(
      r => r.bookId === loan.bookId && r.userId !== loan.userId && r.status === 'pending'
    );

    if (hasReservationConflict) {
      toast.warning(
        language === 'dv'
          ? `ފޮތުގެ މުއްދަތު އިތުރެއް ނުކުރެވޭނެ: އެހެން ދަރިވަރަކު މި ފޮތަށް ނަންނޯޓު ކޮށްފައިވެއެވެ. ލައިބްރަރީއަށް ރައްދުކުރައްވާ!`
          : `Renewal blocked: Another student or patron has placed a hold reservation on "${loan.bookTitle}". Please return it to the circulation desk.`,
        'Hold Conflict'
      );
      return;
    }

    const newDueDateStr = calculateSchoolDueDate(new Date(loan.dueDate), settings.maxBorrowDays);

    setLoans(prev => prev.map(l => l.id === loan.id ? {
      ...l,
      dueDate: newDueDateStr,
      renewalCount: l.renewalCount + 1
    } : l));

    try {
      await updateLoan(loan.id, {
        dueDate: newDueDateStr,
        renewalCount: loan.renewalCount + 1
      });
    } catch (err) {
      console.warn("Loan renewal persisted in local cache:", err);
    }

    toast.success(
      language === 'dv'
        ? `ފޮތުގެ މުއްދަތު ${newDueDateStr} އާ ހަމައަށް އިތުރުކުރެވިއްޖެ!`
        : `Loan extended until ${newDueDateStr}.`,
      'Loan Renewed'
    );
  };

  // Handle Librarian Manual Fine-Waive Override
  const handleWaiveFee = async (loanId: string, reason: string) => {
    setLoans(prev => prev.map(l => l.id === loanId ? {
      ...l,
      lateFee: 0,
      feePaid: true,
      waivedReason: reason
    } as Loan : l));

    try {
      await updateLoan(loanId, {
        lateFee: 0,
        feePaid: true
      });
      await fetch('/api/circulation/waive-fine', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': 'admin'
        },
        body: JSON.stringify({
          loanId,
          reason,
          waivedBy: currentUser.name
        })
      });
    } catch (err) {
      console.warn('Fine waiver synced with local database:', err);
    }

    toast.success(
      language === 'dv'
        ? `ޖޫރިމަނާ ފައިސާ ކާމިޔާބުކަމާއެކު މަޢާފުކޮށްދެވިއްޖެ! (${reason})`
        : `Fine waived successfully under librarian discretion! (${reason})`,
      'Fine Waived'
    );
  };

  // Handle Parent Account Creation
  // Handle Parent Account Creation (supports both modal positional signature and object signature)
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

    // If new student child was also requested in registration modal, create child first
    if (newChildData && newChildData.name) {
      const childTempId = `std-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const childProfile: UserProfile = {
        id: childTempId,
        name: newChildData.name,
        grade: newChildData.grade || 'Grade 6',
        studentIdCode: newChildData.studentIdCode || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
        role: 'student',
        parentId: parentTempId,
        email: `${newChildData.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@fmagoodhooschool.edu.mv`,
        createdAt: new Date().toISOString().split('T')[0]
      };
      setUsers(prev => [childProfile, ...prev]);
      try {
        const { id, ...cData } = childProfile;
        const realChildId = await createUserProfile(cData);
        childrenIds.push(realChildId || childTempId);
      } catch (e) {
        console.warn("Child creation note:", e);
        childrenIds.push(childTempId);
      }
    }

    const newParent: UserProfile = {
      id: parentTempId,
      name: parentName,
      email: parentEmail,
      phone: parentPhone,
      role: 'parent',
      childrenIds: childrenIds,
      createdAt: new Date().toISOString().split('T')[0]
    };

    setUsers(prev => [newParent, ...prev]);

    // Link student children back to this parent account
    if (childrenIds.length > 0) {
      setUsers(prev => prev.map(u => childrenIds.includes(u.id) ? { ...u, parentId: parentTempId } : u));
      for (const cId of childrenIds) {
        try {
          await updateUserProfile(cId, { parentId: parentTempId });
        } catch (e) {
          console.warn("Update child parent link note:", e);
        }
      }
    }

    try {
      const { id, ...pData } = newParent;
      await createUserProfile(pData);
    } catch (err) {
      console.warn("Parent profile saved to local cache:", err);
    }

    alert(language === 'dv' ? `ބެލެނިވެރިޔާ ${parentName} ގެ އެކައުންޓް ކާމިޔާބުކަމާއެކު ހެދިއްޖެ!` : `Parent Guardian account for ${parentName} created successfully!`);
  };

  // Handle Bulk Import Books
  const handleBulkImportBooks = async (importedBooks: Omit<Book, 'id'>[]) => {
    const newBooks: Book[] = importedBooks.map((b, i) => ({ ...b, id: `bk-import-${Date.now()}-${i}` }));
    setBooks(prev => [...newBooks, ...prev]);

    for (const b of importedBooks) {
      try {
        await addBook(b);
      } catch (err) {
        console.warn("Imported book persisted locally:", err);
      }
    }
    alert(language === 'dv' ? `${importedBooks.length} ފޮތް ކެޓަލޮގަށް އެތެރެކުރެވިއްޖެ!` : `Imported ${importedBooks.length} books into catalog.`);
  };

  const handleBulkImportParents = async (importedParents: any[]) => {
    let importedCount = 0;
    for (const p of importedParents) {
      const parentTempId = `par-import-${Date.now()}-${importedCount}`;
      const linkedChildrenIds: string[] = [];

      // If children were parsed in the row
      if (Array.isArray(p.children) && p.children.length > 0) {
        for (const child of p.children) {
          const childTempId = `std-import-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
          const childProfile: UserProfile = {
            id: childTempId,
            name: child.name,
            grade: child.grade || 'Grade 6',
            studentIdCode: child.studentIdCode || `STU-${Math.floor(1000 + Math.random() * 9000)}`,
            role: 'student',
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
          } catch (e) {
            console.warn("Import child creation note:", e);
          }
        }
      }

      const parentProfile: UserProfile = {
        id: parentTempId,
        name: p.name,
        email: p.email,
        phone: p.phone || '',
        role: 'parent',
        childrenIds: linkedChildrenIds,
        createdAt: new Date().toISOString().split('T')[0]
      };

      setUsers(prev => [parentProfile, ...prev]);
      try {
        const { id, ...pData } = parentProfile;
        await createUserProfile(pData);
      } catch (err) {
        console.warn("Imported parent persisted locally:", err);
      }
      importedCount++;
    }
    alert(language === 'dv' ? `${importedCount} ބެލެނިވެރިންގެ އެކައުންޓް އެތެރެކުރެވިއްޖެ!` : `Imported ${importedCount} parent user records.`);
  };

  const handleBulkImportStaff = async (importedStaff: Array<{ name: string; email: string; phone?: string; staffIdCode?: string; staffDepartment?: string }>) => {
    const newStaffList: UserProfile[] = importedStaff.map((s, i) => ({
      id: `stf-import-${Date.now()}-${i}`,
      name: s.name,
      email: s.email,
      phone: s.phone || '',
      role: 'staff',
      staffIdCode: s.staffIdCode || `STF-${Math.floor(3000 + Math.random() * 1000)}`,
      staffDepartment: s.staffDepartment || 'Teaching Faculty',
      createdAt: new Date().toISOString().split('T')[0]
    }));
    setUsers(prev => [...newStaffList, ...prev]);

    for (const s of importedStaff) {
      try {
        const staffProfile: Omit<UserProfile, 'id'> = {
          name: s.name,
          email: s.email,
          phone: s.phone || '',
          role: 'staff',
          staffIdCode: s.staffIdCode || `STF-${Math.floor(3000 + Math.random() * 1000)}`,
          staffDepartment: s.staffDepartment || 'Teaching Faculty',
          createdAt: new Date().toISOString().split('T')[0]
        };
        await createUserProfile(staffProfile);
      } catch (err) {
        console.warn("Imported staff persisted locally:", err);
      }
    }
    alert(`Successfully imported ${importedStaff.length} faculty and staff accounts!`);
  };

  // Handle Add Child to Parent
  const handleAddChildToParent = async (parentId: string, childIdCode: string) => {
    const parent = users.find(u => u.id === parentId);
    if (!parent) return;

    const childUser = users.find(u => u.studentIdCode?.toLowerCase() === childIdCode.toLowerCase() || u.name.toLowerCase() === childIdCode.toLowerCase());
    
    if (!childUser) {
      alert(`No student found with ID/Name "${childIdCode}". Please check the student record.`);
      return;
    }

    const existingChildren = parent.childrenIds || [];
    if (!existingChildren.includes(childUser.id)) {
      const updatedChildren = [...existingChildren, childUser.id];
      setUsers(prev => prev.map(u => u.id === parentId ? { ...u, childrenIds: updatedChildren } : u));
      try {
        await updateUserProfile(parentId, {
          childrenIds: updatedChildren
        });
      } catch (err) {
        console.warn("Child linked locally:", err);
      }
      alert(`Successfully linked ${childUser.name} to guardian ${parent.name}.`);
    }
  };

  // Handle Delete Parent / Student User Account
  const handleDeleteUser = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (!targetUser) return;

    if (targetUser.role === 'admin') {
      alert('Cannot delete administrator accounts!');
      return;
    }

    try {
      // Delete user document from Firestore
      await deleteUserProfile(userId);

      // Clean up parent/child relations
      if (targetUser.role === 'student') {
        const parent = users.find(u => u.id === targetUser.parentId || u.childrenIds?.includes(targetUser.id));
        if (parent && parent.childrenIds) {
          const updatedChildren = parent.childrenIds.filter(id => id !== targetUser.id);
          await updateUserProfile(parent.id, { childrenIds: updatedChildren });
        }
      } else if (targetUser.role === 'parent') {
        const children = users.filter(u => u.parentId === targetUser.id || targetUser.childrenIds?.includes(u.id));
        for (const child of children) {
          await updateUserProfile(child.id, { parentId: '' });
        }
      }

      setUsers(prev => prev.filter(u => u.id !== userId));
      alert(`Successfully removed ${targetUser.name} from the library portal database.`);
    } catch (err: any) {
      console.error("Failed to delete user profile:", err);
      alert(`Failed to delete user profile: ${err?.message || String(err)}`);
    }
  };

  const handleSwitchUser = (user: UserProfile) => {
    setCurrentUser(user);
    if (user.role === 'admin') {
      setActiveTab('dashboard');
    } else if (user.role === 'parent') {
      setActiveTab('parent-portal');
    } else {
      setActiveTab('catalog');
    }
  };

  const handleLogout = () => {
    setCurrentUser(GUEST_USER);
    setActiveTab('catalog');
    alert('You have been logged out successfully.');
  };

  const handleOpenImportModal = (type: 'books' | 'parents' = 'books') => {
    setImportDefaultType(type);
    setIsImportModalOpen(true);
  };

  const handleAddBook = async (bookData: Omit<Book, 'id'>) => {
    try {
      await addBook(bookData);
      alert(`Book "${bookData.title}" saved successfully to catalog!`);
    } catch (err: any) {
      console.error("Failed to save book to Firestore:", err);
      alert(`Failed to save book: ${err?.message || String(err)}`);
      throw err;
    }
  };

  const handleUpdateBook = async (id: string, data: Partial<Book>) => {
    try {
      await updateBook(id, data);
      alert(`Book updated successfully!`);
    } catch (err: any) {
      console.error("Failed to update book in Firestore:", err);
      alert(`Failed to update book: ${err?.message || String(err)}`);
      throw err;
    }
  };

  const handleDeleteBook = async (id: string) => {
    setBooks(prev => prev.filter(b => b.id !== id));
    try {
      await deleteBook(id);
      alert("Book record deleted successfully.");
    } catch (err: any) {
      console.warn("Book deleted locally (offline cache):", err);
      alert("Book record removed from catalog.");
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<LibrarySettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
    try {
      await updateSettings(newSettings);
    } catch (err) {
      console.warn("Settings saved to local cache:", err);
    }
  };

  const handleMarkFeePaid = async (loanId: string) => {
    setLoans(prev => prev.map(l => l.id === loanId ? { ...l, feePaid: true } : l));
    try {
      await updateLoan(loanId, { feePaid: true });
    } catch (err) {
      console.warn("Fee payment saved to local cache:", err);
    }
  };

  const todayIsoStr = new Date().toISOString().split('T')[0];
  const overdueCount = loans.filter(l => l.status === 'overdue' || (l.status === 'active' && l.dueDate < todayIsoStr)).length;

  let navItems = [];

  if (currentUser.role === 'admin') {
    navItems = [
      { id: 'dashboard', label: language === 'dv' ? 'ޑޭޝްބޯޑް' : 'Dashboard Overview', icon: LayoutDashboard },
      { id: 'catalog', label: language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް' : 'Book Catalog & Search', icon: BookOpen },
      { id: 'checkout-hub', label: language === 'dv' ? 'ފޮތް ދޫކުރުން / ހަވާލުކުރުން' : 'Circulation Desk (Checkout/Return)', icon: RotateCcw, badge: loans.filter(l => l.status === 'active').length },
      { id: 'students', label: language === 'dv' ? 'ދަރިވަރުން އަދި މެންބަރުން' : 'Student & Parent Directory', icon: Users },
      { id: 'admin-panel', label: language === 'dv' ? 'އެޑްމިން އަދި ރިޕޯޓްތައް' : 'Admin Settings & Reports', icon: Shield, badge: overdueCount > 0 ? overdueCount : undefined, badgeColor: 'bg-rose-500' },
      { id: 'ai-assistant', label: language === 'dv' ? 'އޭ.އައި ލައިބްރޭރިއަން' : 'AI Librarian Companion', icon: Sparkles },
      { id: 'faq', label: language === 'dv' ? 'ސުވާލާއި އެހީ' : 'Help & Guidelines', icon: HelpCircle },
    ];
  } else if (currentUser.role === 'parent') {
    navItems = [
      { id: 'parent-portal', label: language === 'dv' ? 'ބެލެނިވެރިންގެ ޕޯޓަލް' : 'Parent Portal & Children Loans', icon: Users },
      { id: 'catalog', label: language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް' : 'Browse Book Catalog', icon: BookOpen },
      { id: 'my-borrowings', label: language === 'dv' ? 'ޢާއިލާގެ ނެގުންތަކުގެ ތާރީޚް' : 'Family Borrowing History', icon: ClipboardList },
      { id: 'ai-assistant', label: language === 'dv' ? 'އޭ.އައި ލައިބްރޭރިއަން' : 'AI Reading Helper', icon: Sparkles },
      { id: 'faq', label: language === 'dv' ? 'ބެލެނިވެރިންގެ އިރުޝާދު' : 'Parent Guide & FAQ', icon: HelpCircle },
    ];
  } else {
    // Student or Guest Visitor
    navItems = [
      { id: 'catalog', label: language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް' : 'Book Catalog & Search', icon: BookOpen },
      { id: 'my-borrowings', label: language === 'dv' ? 'ނަގާފައިވާ ފޮތްތައް' : 'My Borrowings & Due Dates', icon: ClipboardList },
      { id: 'reference', label: language === 'dv' ? 'ރެފަރެންސް ފޮތްތައް' : 'Reference Collection', icon: BookMarked },
      { id: 'ai-assistant', label: language === 'dv' ? 'އޭ.އައި ލައިބްރޭރިއަން' : 'AI Companion', icon: Sparkles },
      { id: 'faq', label: language === 'dv' ? 'ސުވާލާއި އެހީ' : 'FAQ & Help', icon: HelpCircle },
    ];
  }

  return (
    <div className={`min-h-screen bg-slate-100 text-slate-800 ${isRtl ? 'font-faruma' : 'font-sans'} flex flex-col antialiased`}>
      
      {/* Top Header Navigation Bar */}
      <Header
        currentUser={currentUser}
        allUsers={users}
        onSwitchUser={handleSwitchUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenScanner={() => setIsScannerOpen(true)}
        overdueCount={overdueCount}
        onLogout={handleLogout}
        onOpenLoginModal={() => setActiveTab('login')}
        onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
      />

      {/* Cloud Firestore Quota & Resilient Offline Status Banner */}
      {isQuotaExhausted && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-900 shadow-inner flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-200 text-amber-900 tracking-wider uppercase">
              {language === 'dv' ? 'އޮފްލައިން ކޭޝް' : 'Offline Resilient'}
            </span>
            <span className="font-medium text-amber-800 text-xs">
              {language === 'dv'
                ? 'ކްލައުޑް ފަޔަރސްޓޯރ ޑެއިލީ ކޯޓާ ހަމަވެފައިވާތީ ސިސްޓަމް ދަނީ ލޯކަލް ކޭޝް އަދި އޮފްލައިން މޯޑުގައި ކާމިޔާބުކަމާއެކު މަސައްކަތްކުރަމުންނެވެ.'
                : 'Cloud Firestore free tier daily write limit reached (20,000 writes/day). The library is operating smoothly in local cache & read mode.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('admin-panel')}
              className="text-[11px] font-bold px-2.5 py-1 bg-amber-200 hover:bg-amber-300 text-amber-900 rounded-lg transition underline cursor-pointer"
            >
              {language === 'dv' ? 'ކޯޓާ ތަފްސީލު ބައްލަވާ' : 'View Quota & Diagnostics'}
            </button>
          </div>
        </div>
      )}

      {/* Main Body Layout (Sidebar + Content Workspace) */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* Left/Right Sidebar Navigation - Mirrored for RTL/LTR */}
        <aside
          className={`fixed lg:static inset-y-0 ${
            isRtl ? 'right-0 border-l' : 'left-0 border-r'
          } z-40 w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out border-slate-800/80 shadow-xl ${
            isSidebarOpen
              ? 'translate-x-0 shadow-2xl'
              : (isRtl ? 'translate-x-full lg:translate-x-0' : '-translate-x-full lg:translate-x-0')
          }`}
        >
          {/* Top Sidebar Menu Header */}
          <div className="p-4 space-y-5 overflow-y-auto">
            
            {/* Sidebar Brand / Mobile Close */}
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-black text-white text-sm tracking-wide">{language === 'dv' ? 'މަގޫދޫ ލައިބްރަރީ' : 'LibraryMS'}</div>
                  <div className="text-[10px] text-indigo-300 font-semibold">{language === 'dv' ? 'މަގޫދޫ ސުކޫލް' : 'Magoodhoo Portal'}</div>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Navigation Menu Links with Custom Vibrant Badges */}
            <nav className="space-y-1.5">
              <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 px-3 py-1">
                {language === 'dv' ? 'މެނޫ / ނެވިގޭޝަން' : 'Navigation Desk'}
              </div>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'add-book') {
                        setIsAddBookModalOpen(true);
                      } else {
                        setActiveTab(item.id);
                        setIsSidebarOpen(false);
                      }
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all transform active:scale-98 cursor-pointer ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25 font-black border border-indigo-400/30'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-amber-300' : 'text-indigo-400'}`} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge !== undefined && item.badge > 0 && (
                      <span className={`text-[10px] font-black text-white px-2 py-0.5 rounded-full shadow-xs ${item.badgeColor || 'bg-blue-600'}`}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Bottom Sidebar Footer */}
          <div className="p-4 border-t border-slate-800/80 space-y-2 bg-slate-950/60">
            {currentUser.id !== 'guest' ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={handleLogout}
                    className="flex-1 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    id="sidebar-logout-btn"
                  >
                    <LogOut className="w-3.5 h-3.5 text-rose-400" /> {t.logout}
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('login');
                      setIsSidebarOpen(false);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    id="sidebar-switch-account-btn"
                  >
                    <LogIn className="w-3.5 h-3.5 text-indigo-400" /> {language === 'dv' ? 'ބަދަލުކުރައްވާ' : 'Switch'}
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 text-center font-medium pt-1">
                  {t.activeProfile} <span className="text-amber-300 font-bold">{currentUser.name}</span> ({currentUser.role})
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <button
                    onClick={() => {
                      setActiveTab('login');
                      setIsSidebarOpen(false);
                    }}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs py-2 px-3 rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogIn className="w-3.5 h-3.5 text-blue-400" /> {t.login}
                  </button>
                  <button
                    onClick={() => setIsAddParentModalOpen(true)}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow transition flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <UserPlus className="w-3.5 h-3.5" /> {language === 'dv' ? 'ރަޖިސްޓަރީ' : 'Sign Up'}
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 text-center font-medium pt-1">
                  {language === 'dv' ? 'މެހުމާނެއްގެ ގޮތުގައި ބައްލަވަނީ' : 'Browsing as Guest Visitor'}
                </div>
              </div>
            )}

            {/* Cloud Database & Quota Status Awareness Pill */}
            <div className="pt-3 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('admin-panel');
                  setIsSidebarOpen(false);
                }}
                className="w-full px-2.5 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 flex items-center justify-between text-left transition cursor-pointer group"
                title="Click to view Google Cloud Firestore Quota & System Health Diagnostics in Admin Settings"
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${isQuotaExhausted ? 'bg-amber-400 animate-ping' : 'bg-emerald-400'}`}></span>
                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition truncate">
                    {isQuotaExhausted ? 'Quota Resilient' : 'Cloud DB Active'}
                  </span>
                </div>
                <span className="text-[9px] font-black uppercase text-indigo-400 group-hover:text-indigo-300">
                  {language === 'dv' ? 'ކޯޓާ' : 'Quota'}
                </span>
              </button>
            </div>
          </div>
        </aside>

        {/* Backdrop overlay for mobile drawer */}
        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-30 lg:hidden"
          ></div>
        )}

        {/* MAIN WORKSPACE CANVAS */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-6 lg:p-8 pb-28 sm:pb-12 bg-slate-100/90 relative z-10 safe-bottom">
          <>
              {/* Active Role Context Banner */}
              <div className={`mb-6 p-4 sm:p-5 rounded-2xl border shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs font-semibold transition-all ${
                currentUser.role === 'admin'
                  ? 'bg-gradient-to-r from-amber-500/15 via-orange-500/10 to-amber-500/10 border-amber-300/80 text-amber-950'
                  : currentUser.role === 'parent'
                  ? 'bg-gradient-to-r from-purple-500/15 via-indigo-500/10 to-purple-500/10 border-purple-300/80 text-purple-950'
                  : 'bg-gradient-to-r from-blue-500/15 via-indigo-500/10 to-sky-500/10 border-blue-300/80 text-blue-950'
              }`}>
                <div className="flex items-center gap-3.5">
                  <span className={`p-2.5 rounded-2xl text-white font-bold flex-shrink-0 shadow-md ${
                    currentUser.role === 'admin' ? 'bg-gradient-to-tr from-amber-600 to-orange-500' : currentUser.role === 'parent' ? 'bg-gradient-to-tr from-purple-600 to-indigo-600' : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
                  }`}>
                    {currentUser.role === 'admin' ? <Shield className="w-5 h-5" /> : currentUser.role === 'parent' ? <Users className="w-5 h-5" /> : <User className="w-5 h-5" />}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-black text-sm sm:text-base capitalize text-slate-900">
                        {currentUser.role === 'admin' && (language === 'dv' ? 'ސުޕަރ އެޑްމިން މޯޑް — ހުރިހާ ޚިދުމަތްތަކެއް ހުޅުވިފައި' : 'Super Admin Mode — Full Operations Unlocked')}
                        {currentUser.role === 'parent' && (language === 'dv' ? `ބެލެނިވެރިއާ މޯޑް — ${currentUser.name}` : `Parent Guardian Mode — Active Session for ${currentUser.name}`)}
                        {currentUser.role !== 'admin' && currentUser.role !== 'parent' && (language === 'dv' ? `ދަރިވަރު މޯޑް — ${currentUser.name}` : `Student Member Session for ${currentUser.name}`)}
                      </p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        currentUser.role === 'admin' ? 'bg-amber-200 text-amber-900' : currentUser.role === 'parent' ? 'bg-purple-200 text-purple-900' : 'bg-blue-200 text-blue-900'
                      }`}>
                        {currentUser.role === 'admin' ? t.adminRole : currentUser.role === 'parent' ? t.parentRole : t.studentRole}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 font-medium mt-0.5 leading-relaxed">
                      {currentUser.role === 'admin' && (language === 'dv' ? 'ލައިބްރޭރިއަންގެ ފުރިހަމަ އިޚްތިޔާރު: ފޮތް ދޫކުރުން، ސްޓޮކް އިތުރުކުރުން، މެންބަރުން ބެލެހެއްޓުން، ޖޫރިމަނާ އަދި ރިޕޯޓްތައް.' : 'Full librarian desk permissions: book checkout, stock updates, user account management, fine waivers, and reporting.')}
                      {currentUser.role === 'parent' && (language === 'dv' ? 'ދަރިން ނަގާފައިވާ ފޮތްތައް ބެއްލެވުން، މުއްދަތު އިތުރުކުރެއްވުން، ފޮތް ނަންނޯޓު ކުރެއްވުން އަދި ފީ ދެއްކެވުން.' : 'Monitor your children’s borrowings, check due dates, extend loans online, reserve books, and manage fees.')}
                      {currentUser.role !== 'admin' && currentUser.role !== 'parent' && (language === 'dv' ? 'ފޮތްތަކުގެ ކެޓަލޮގް ބައްލަވައި، ރެފަރެންސް ފޮތްތައް ހޯއްދަވައި، ފޮތް ނަންނޯޓު ކުރައްވާ.' : 'Browse catalog books, view reference materials, reserve titles, and manage active loans.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto flex-shrink-0">
                  <button
                    onClick={() => setActiveTab('login')}
                    className="bg-white hover:bg-slate-50 text-slate-900 border border-slate-300 px-3.5 py-2 rounded-xl font-extrabold text-xs transition shadow-sm hover:shadow flex items-center gap-1.5 cursor-pointer active:scale-95"
                    id="role-switch-btn"
                  >
                    <LogIn className="w-3.5 h-3.5 text-indigo-600" />
                    <span>{language === 'dv' ? 'ރޯލް ބަދަލުކުރައްވާ / ލޮގިން' : 'Switch Role / Login'}</span>
                  </button>
                </div>
              </div>

              {/* Easy Portal 1-Click Quick Action Cards Launchpad */}
              {activeTab !== 'login' && (
                <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  <button
                    onClick={() => setActiveTab('checkout-hub')}
                    className="p-3.5 bg-white hover:bg-emerald-50/80 border border-slate-200 hover:border-emerald-300 rounded-2xl shadow-xs hover:shadow-md transition text-left group cursor-pointer flex items-center gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 group-hover:scale-105 transition shrink-0">
                      <BookMarked className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 group-hover:text-emerald-700">
                        {language === 'dv' ? 'ފޮތް ދޫކުރުން' : 'Borrow Book'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {language === 'dv' ? 'އަވަސް ޗެކްއައުޓް' : 'Quick Checkout'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('checkout-hub')}
                    className="p-3.5 bg-white hover:bg-blue-50/80 border border-slate-200 hover:border-blue-300 rounded-2xl shadow-xs hover:shadow-md transition text-left group cursor-pointer flex items-center gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-blue-100 text-blue-700 group-hover:scale-105 transition shrink-0">
                      <RotateCcw className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 group-hover:text-blue-700">
                        {language === 'dv' ? 'ފޮތް ޙަވާލުކުރުން' : 'Return Book'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {language === 'dv' ? 'އެނބުރުން ނޯޓުކުރުން' : 'Check-in Item'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setIsScannerOpen(true)}
                    className="p-3.5 bg-white hover:bg-indigo-50/80 border border-slate-200 hover:border-indigo-300 rounded-2xl shadow-xs hover:shadow-md transition text-left group cursor-pointer flex items-center gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-700 group-hover:scale-105 transition shrink-0">
                      <Scan className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 group-hover:text-indigo-700">
                        {language === 'dv' ? 'ބާކޯޑު ސްކޭން' : 'Scan Barcode'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {language === 'dv' ? 'ކެމެރާ / ސްކޭނަރު' : 'Camera or Reader'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      if (currentUser.role === 'admin') setIsAddBookModalOpen(true);
                      else setActiveTab('catalog');
                    }}
                    className="p-3.5 bg-white hover:bg-amber-50/80 border border-slate-200 hover:border-amber-300 rounded-2xl shadow-xs hover:shadow-md transition text-left group cursor-pointer flex items-center gap-3"
                  >
                    <div className="p-2.5 rounded-xl bg-amber-100 text-amber-700 group-hover:scale-105 transition shrink-0">
                      <PlusCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 group-hover:text-amber-700">
                        {currentUser.role === 'admin'
                          ? (language === 'dv' ? 'އާ ފޮތެއް އިތުރުކުރައްވާ' : 'Add New Book')
                          : (language === 'dv' ? 'ފޮތް ހޯއްދަވާ' : 'Find Books')}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {language === 'dv' ? 'ސްޓޮކް އަދި ކެޓަލޮގް' : 'Catalog database'}
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => setActiveTab('catalog')}
                    className="p-3.5 bg-white hover:bg-purple-50/80 border border-slate-200 hover:border-purple-300 rounded-2xl shadow-xs hover:shadow-md transition text-left group cursor-pointer flex items-center gap-3 col-span-2 sm:col-span-1"
                  >
                    <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700 group-hover:scale-105 transition shrink-0">
                      <BookOpen className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-extrabold text-xs text-slate-900 group-hover:text-purple-700">
                        {language === 'dv' ? 'ކެޓަލޮގް ބައްލަވާ' : 'Browse Catalog'}
                      </div>
                      <div className="text-[10px] text-slate-500">
                        {language === 'dv' ? 'ފޮތްތަކުގެ ލިސްޓު' : 'Filter & Reserve'}
                      </div>
                    </div>
                  </button>
                </div>
              )}
              {activeTab === 'login' && (
                <LoginPage
                  currentUser={currentUser}
                  allUsers={users}
                  onLoginSuccess={(user) => {
                    setCurrentUser(user);
                  }}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'reference' && (
                <ReferenceSection books={books} />
              )}

              {activeTab === 'dashboard' && (
                <DashboardView
                  books={books}
                  users={users}
                  loans={loans}
                  reservations={reservations}
                  currentUser={currentUser}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                  onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
                />
              )}

              {(activeTab === 'catalog' || activeTab === 'add-book') && (
                <BookCatalog
                  books={books}
                  currentUser={currentUser}
                  reservations={reservations}
                  isLoading={isLoading}
                  onReserveBook={handleReserveBook}
                  onOpenCheckoutForBook={(book) => {
                    setActiveTab('borrow-book');
                  }}
                  onViewReferenceOnly={() => setActiveTab('reference')}
                  onAddBook={handleAddBook}
                  onOpenAddBookModal={() => setIsAddBookModalOpen(true)}
                  onEditBook={(book) => {
                    setIsAddBookModalOpen(true);
                  }}
                  onDeleteBook={handleDeleteBook}
                  onOpenImportModal={handleOpenImportModal}
                  onCancelReservation={handleCancelReservation}
                />
              )}

              {(activeTab === 'borrow-book' || activeTab === 'return-book' || activeTab === 'issued-books' || activeTab === 'late-returns' || activeTab === 'checkout-hub') && (
                <QuickCheckout
                  books={books}
                  users={users}
                  loans={loans}
                  settings={settings}
                  onProcessCheckout={handleProcessCheckout}
                  onProcessReturn={handleProcessReturn}
                  onOpenScanner={() => setIsScannerOpen(true)}
                />
              )}

              {activeTab === 'students' && (
                <MemberDirectory
                  allUsers={users}
                  loans={loans}
                  books={books}
                  currentUserRole={currentUser.role}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onOpenImportModal={handleOpenImportModal}
                  onOpenReportCardSyncModal={() => setIsReportCardSyncModalOpen(true)}
                  onSelectMemberForCheckout={(memberId) => setActiveTab('borrow-book')}
                  onDeleteUser={handleDeleteUser}
                />
              )}

              {activeTab === 'parent-portal' && (
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
                      parentId: currentUser.id,
                      email: `${name.toLowerCase().replace(/\s+/g, '.')}@oakridge.edu`,
                      createdAt: new Date().toISOString().split('T')[0]
                    };
                    const newChildId = await createUserProfile(childProfile);
                    const existingChildren = currentUser.childrenIds || [];
                    await updateUserProfile(currentUser.id, {
                      childrenIds: [...existingChildren, newChildId]
                    });
                    alert(`Successfully added child account for ${name}!`);
                  }}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                />
              )}

              {(activeTab === 'manage-students' || activeTab === 'admin-panel') && (
                <AdminPanel
                  books={books}
                  users={users}
                  loans={loans}
                  settings={settings}
                  isQuotaExhausted={isQuotaExhausted}
                  onAddBook={handleAddBook}
                  onUpdateBook={handleUpdateBook}
                  onDeleteBook={handleDeleteBook}
                  onDeleteUser={handleDeleteUser}
                  onUpdateSettings={handleUpdateSettings}
                  onMarkFeePaid={handleMarkFeePaid}
                  onWaiveFee={handleWaiveFee}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onOpenImportModal={handleOpenImportModal}
                  onOpenReportCardSyncModal={() => setIsReportCardSyncModalOpen(true)}
                />
              )}

              {activeTab === 'ai-assistant' && (
                <AIAssistant
                  books={books}
                  currentUser={currentUser}
                  onNavigateTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'reports' && (
                <ReportsAnalytics
                  books={books}
                  loans={loans}
                  users={users}
                />
              )}

              {(activeTab === 'my-borrowings' || activeTab === 'my-loans') && (
                <MyBorrowings
                  currentUser={currentUser}
                  loans={loans}
                  reservations={reservations}
                  books={books}
                  isLoading={isLoading}
                  onRenewLoan={handleRenewLoan}
                  onCancelReservation={handleCancelReservation}
                />
              )}

              {activeTab === 'faq' && (
                <FaqHelpView />
              )}
            </>
        </main>
      </div>

      {/* 4. FOOTER (MATCHING REFERENCE IMAGE) */}
      <footer className="bg-[#1E2530] text-slate-300 border-t border-slate-800 relative z-20">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 md:grid-cols-4 gap-8 text-xs">
          
          {/* Column 1: Brand Info */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-yellow-400 text-slate-900 rounded font-black text-sm">
                JS
              </span>
              <span className="font-extrabold text-white text-base tracking-wider">LIBRARYMS</span>
            </div>
            <p className="text-slate-400 leading-relaxed font-normal">
              Your modern, complete solution for efficient school library management, catalog organization, and borrowing workflows.
            </p>
          </div>

          {/* Column 2: Quick Links */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-white uppercase text-xs tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-slate-400 font-medium">
              <li>
                <button onClick={() => setActiveTab('dashboard')} className="hover:text-blue-400 transition">Dashboard</button>
              </li>
              <li>
                <button onClick={() => setActiveTab('catalog')} className="hover:text-blue-400 transition">Book Catalog</button>
              </li>
              <li>
                <button onClick={() => setActiveTab('faq')} className="hover:text-blue-400 transition">FAQ & Knowledge Base</button>
              </li>
            </ul>
          </div>

          {/* Column 3: Contact */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-white uppercase text-xs tracking-wider">Contact</h4>
            <ul className="space-y-2 text-slate-400 font-medium">
              <li className="flex items-center gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-400" />
                <span>Magoodhoo School, F. Magoodhoo, Republic of Maldives</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-emerald-400" />
                <span>+960 6740018</span>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-amber-400" />
                <span>admin@magoodhooschool.edu.mv</span>
              </li>
            </ul>
          </div>

          {/* Column 4: Follow Us */}
          <div className="space-y-3">
            <h4 className="font-extrabold text-white uppercase text-xs tracking-wider">Follow Us</h4>
            <div className="flex items-center gap-3">
              <a href="#facebook" className="p-2 bg-slate-800 hover:bg-blue-600 text-white rounded-lg transition">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#twitter" className="p-2 bg-slate-800 hover:bg-sky-500 text-white rounded-lg transition">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#instagram" className="p-2 bg-slate-800 hover:bg-pink-600 text-white rounded-lg transition">
                <Instagram className="w-4 h-4" />
              </a>
            </div>
          </div>

        </div>

        {/* Sub-footer Copyright */}
        <div className="bg-[#151B24] border-t border-slate-800/80 py-4 px-6 text-center text-[11px] text-slate-500 font-medium">
          © 2025 LibraryMS. All Rights Reserved.
        </div>
      </footer>

      {/* MODALS */}

      {/* Add New Book Modal (with Internet Data Fetcher) */}
      <AddBookModal
        isOpen={isAddBookModalOpen}
        onClose={() => setIsAddBookModalOpen(false)}
        onAddBook={handleAddBook}
      />

      {/* Global Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        books={books}
        users={users}
        loans={loans}
        onProcessReturn={handleProcessReturn}
        onScanResult={(scannedCode, matchedBook) => {
          if (matchedBook) {
            setActiveTab('catalog');
          }
        }}
      />

      {/* Register Parent / Member Modal */}
      <AddParentModal
        isOpen={isAddParentModalOpen}
        onClose={() => setIsAddParentModalOpen(false)}
        allUsers={users}
        onCreateParentAccount={handleCreateParentAccount}
      />

      {/* Mobile Bottom Navigation Bar (Optimized for Smartphones & Tablets with Safe-Area Inset) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0.75rem))] flex items-center justify-around shadow-2xl safe-bottom">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'catalog' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>{language === 'dv' ? 'ކެޓަލޮގް' : 'Catalog'}</span>
        </button>

        <button
          onClick={() => setActiveTab('ai-assistant')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'ai-assistant' ? 'text-purple-700 font-black' : 'text-slate-500'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>{language === 'dv' ? 'ލައިބްރޭރިއަން' : 'Libby AI'}</span>
        </button>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center justify-center w-11 h-11 bg-emerald-700 hover:bg-emerald-800 text-white rounded-full shadow-lg -mt-5 border-2 border-white active:scale-95 transition"
          title="Scan Book Barcode"
        >
          <Scan className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('my-borrowings')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'my-borrowings' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <BookMarked className="w-5 h-5" />
          <span>{language === 'dv' ? 'ފޮތްތައް' : 'My Books'}</span>
        </button>

        <button
          onClick={() => setActiveTab('login')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'login' ? 'text-emerald-700 font-black' : 'text-slate-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span>{language === 'dv' ? 'ޕްރޮފައިލް' : 'Profile'}</span>
        </button>
      </div>

      {/* Bulk Data Import Modal */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultType={importDefaultType}
        onImportBooks={handleBulkImportBooks}
        onImportParents={handleBulkImportParents}
        onImportStaff={handleBulkImportStaff}
      />

      {/* Cloud Firestore Report Card Portal Real-Time Sync Modal */}
      <ReportCardSyncModal
        isOpen={isReportCardSyncModalOpen}
        onClose={() => setIsReportCardSyncModalOpen(false)}
      />

      {/* PWA Offline Mode Indicator Banner */}
      {!isOnline && (
        <div
          role="status"
          className="fixed bottom-16 sm:bottom-6 start-4 z-50 flex items-center gap-2 rounded-2xl bg-slate-900/95 text-amber-300 border border-amber-500/40 px-3.5 py-2 text-xs font-bold shadow-xl backdrop-blur-md animate-in fade-in"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <span>
            {language === 'dv'
              ? 'އޮފްލައިން މޯޑު — ކުރިން ކޭޝްކުރެވިފައިވާ މަޢުލޫމާތު ބެއްލެވޭނެ'
              : 'Offline Mode — Browsing locally cached catalog. Holds are queued.'}
          </span>
        </div>
      )}

    </div>
  );
}
