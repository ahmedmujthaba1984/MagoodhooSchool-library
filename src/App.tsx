import React, { useEffect, useState } from 'react';
import {
  initializeDatabaseIfEmpty,
  subscribeBooks,
  subscribeUsers,
  subscribeLoans,
  subscribeReservations,
  subscribeSettings,
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
import { useLanguage } from './lib/i18n';
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
  const { t, language } = useLanguage();
  const [books, setBooks] = useState<Book[]>(sampleBooks);
  const [users, setUsers] = useState<UserProfile[]>(sampleUsers);
  const [loans, setLoans] = useState<Loan[]>(sampleLoans);
  const [reservations, setReservations] = useState<Reservation[]>(sampleReservations);
  const [settings, setSettings] = useState<LibrarySettings>(initialSettings);

  const [currentUser, setCurrentUser] = useState<UserProfile>(sampleUsers[0]);
  const [activeTab, setActiveTab] = useState<string>('catalog');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  
  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState<boolean>(false);
  const [isAddParentModalOpen, setIsAddParentModalOpen] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importDefaultType, setImportDefaultType] = useState<'books' | 'parents' | 'staff'>('books');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Initialize and subscribe to Firestore
  useEffect(() => {
    let unsubscribeBooks: () => void;
    let unsubscribeUsers: () => void;
    let unsubscribeLoans: () => void;
    let unsubscribeRes: () => void;
    let unsubscribeSet: () => void;

    async function init() {
      try {
        await initializeDatabaseIfEmpty();
      } catch (err) {
        console.warn("Database initialization skipped or running offline:", err);
      }

      unsubscribeBooks = subscribeBooks(
        (data) => {
          if (data && data.length > 0) {
            setBooks(data);
          }
          setIsLoading(false);
        },
        (err) => {
          console.warn("Books subscription error:", err);
          setIsLoading(false);
        }
      );

      unsubscribeUsers = subscribeUsers(
        (data) => {
          if (data && data.length > 0) {
            setUsers(data);
          }
        },
        (err) => console.warn("Users subscription error:", err)
      );

      unsubscribeLoans = subscribeLoans(
        (data) => {
          if (data && data.length > 0) setLoans(data);
        },
        (err) => console.warn("Loans subscription error:", err)
      );

      unsubscribeRes = subscribeReservations(
        (data) => {
          if (data && data.length > 0) setReservations(data);
        },
        (err) => console.warn("Reservations subscription error:", err)
      );

      unsubscribeSet = subscribeSettings(
        (data) => setSettings(data),
        (err) => console.warn("Settings subscription error:", err)
      );
    }

    init();

    return () => {
      if (unsubscribeBooks) unsubscribeBooks();
      if (unsubscribeUsers) unsubscribeUsers();
      if (unsubscribeLoans) unsubscribeLoans();
      if (unsubscribeRes) unsubscribeRes();
      if (unsubscribeSet) unsubscribeSet();
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

  // Handle Online Book Reservation
  const handleReserveBook = async (book: Book) => {
    const newRes: Omit<Reservation, 'id'> = {
      bookId: book.id,
      bookTitle: book.title,
      userId: currentUser.id,
      userName: currentUser.name,
      requestDate: new Date().toISOString().split('T')[0],
      status: 'pending'
    };

    await createReservation(newRes);
    alert(language === 'dv' ? `"${book.title}" އަށް އޮންލައިންކޮށް ނަންނޯޓު ކުރެވިއްޖެ!` : `Successfully submitted online reservation request for "${book.title}"!`);
  };

  // Handle Online Book Reservation Cancellation
  const handleCancelReservation = async (reservationId: string) => {
    try {
      await cancelReservation(reservationId);
    } catch (err) {
      console.error("Error cancelling reservation:", err);
    }
  };

  // Handle Librarian Checkout Process
  const handleProcessCheckout = async (
    book: Book,
    borrower: UserProfile,
    daysToBorrow: number,
    guardianName?: string,
    guardianPhone?: string,
    guardianNotes?: string
  ) => {
    if (book.availableCopies <= 0) {
      alert(`Error: No available copies of "${book.title}" left in stock.`);
      return;
    }

    const issueDateObj = new Date();
    const dueDateObj = new Date();
    dueDateObj.setDate(dueDateObj.getDate() + daysToBorrow);

    const issueDateStr = issueDateObj.toISOString().split('T')[0];
    const dueDateStr = dueDateObj.toISOString().split('T')[0];

    const newLoan: Omit<Loan, 'id'> = {
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

    await createLoan(newLoan);
    await updateBook(book.id, {
      availableCopies: book.availableCopies - 1
    });

    alert(`Successfully checked out "${book.title}" to ${borrower.name}! Due: ${dueDateStr}`);
  };

  // Handle Process Return
  const handleProcessReturn = async (loan: Loan, calculatedFee: number) => {
    const todayStr = new Date().toISOString().split('T')[0];

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

    alert(`Book "${loan.bookTitle}" returned successfully.`);
  };

  // Handle Renew Loan
  const handleRenewLoan = async (loan: Loan) => {
    if (loan.renewalCount >= settings.maxRenewals) {
      alert(`Maximum renewal limit (${settings.maxRenewals}) reached for this book.`);
      return;
    }

    const currentDue = new Date(loan.dueDate);
    currentDue.setDate(currentDue.getDate() + settings.maxBorrowDays);
    const newDueDateStr = currentDue.toISOString().split('T')[0];

    await updateLoan(loan.id, {
      dueDate: newDueDateStr,
      renewalCount: loan.renewalCount + 1
    });

    alert(`Loan extended until ${newDueDateStr}.`);
  };

  // Handle Parent Account Creation
  const handleCreateParentAccount = async (parentProfile: Omit<UserProfile, 'id'>) => {
    await createUserProfile(parentProfile);
    alert(`Parent Guardian account for ${parentProfile.name} created successfully!`);
  };

  // Handle Bulk Import
  const handleBulkImportBooks = async (importedBooks: Omit<Book, 'id'>[]) => {
    for (const b of importedBooks) {
      await addBook(b);
    }
    alert(`Imported ${importedBooks.length} books into catalog.`);
  };

  const handleBulkImportParents = async (importedParents: Omit<UserProfile, 'id'>[]) => {
    for (const p of importedParents) {
      await createUserProfile(p);
    }
    alert(`Imported ${importedParents.length} parent user records.`);
  };

  const handleBulkImportStaff = async (importedStaff: Array<{ name: string; email: string; phone?: string; staffIdCode?: string; staffDepartment?: string }>) => {
    for (const s of importedStaff) {
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
      await updateUserProfile(parentId, {
        childrenIds: [...existingChildren, childUser.id]
      });
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
    try {
      await deleteBook(id);
      alert("Book record deleted successfully.");
    } catch (err: any) {
      console.error("Failed to delete book:", err);
      alert(`Failed to delete book: ${err?.message || String(err)}`);
    }
  };

  const handleUpdateSettings = async (newSettings: Partial<LibrarySettings>) => {
    await updateSettings(newSettings);
  };

  const handleMarkFeePaid = async (loanId: string) => {
    await updateLoan(loanId, { feePaid: true });
  };

  const overdueCount = loans.filter(l => l.status === 'overdue').length;

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
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans flex flex-col antialiased">
      
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

      {/* Main Body Layout (Sidebar + Content Workspace) */}
      <div className="flex-1 flex relative overflow-hidden">
        
        {/* Left Sidebar Navigation */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-40 w-64 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950 text-slate-200 flex flex-col justify-between transition-transform duration-300 ease-in-out border-r border-slate-800/80 shadow-xl ${
            isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
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
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-100/90 relative z-10">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-3">
              <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin shadow-lg"></div>
              <p className="text-sm font-extrabold text-slate-700">{language === 'dv' ? 'މަގޫދޫ ލައިބްރަރީ ޑޭޓާބޭސްއާ ގުޅެނީ...' : 'Connecting to Magoodhoo Library Database...'}</p>
            </div>
          ) : (
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
                  onAddBook={handleAddBook}
                  onUpdateBook={handleUpdateBook}
                  onDeleteBook={handleDeleteBook}
                  onDeleteUser={handleDeleteUser}
                  onUpdateSettings={handleUpdateSettings}
                  onMarkFeePaid={handleMarkFeePaid}
                  onOpenAddParentModal={() => setIsAddParentModalOpen(true)}
                  onOpenImportModal={handleOpenImportModal}
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
                  onRenewLoan={handleRenewLoan}
                  onCancelReservation={handleCancelReservation}
                />
              )}

              {activeTab === 'faq' && (
                <FaqHelpView />
              )}
            </>
          )}

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

      {/* Mobile Bottom Navigation Bar (Optimized for Smartphones & Tablets) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-2xl">
        <button
          onClick={() => setActiveTab('catalog')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'catalog' ? 'text-indigo-600 font-black' : 'text-slate-500'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span>Catalog</span>
        </button>

        <button
          onClick={() => setActiveTab('ai-assistant')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'ai-assistant' ? 'text-purple-600 font-black' : 'text-slate-500'
          }`}
        >
          <Sparkles className="w-5 h-5" />
          <span>AI Libby</span>
        </button>

        <button
          onClick={() => setIsScannerOpen(true)}
          className="flex flex-col items-center justify-center w-11 h-11 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full shadow-xl -mt-5 border-2 border-white"
          title="Scan Book Barcode"
        >
          <Scan className="w-5 h-5" />
        </button>

        <button
          onClick={() => setActiveTab('my-borrowings')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'my-borrowings' ? 'text-indigo-600 font-black' : 'text-slate-500'
          }`}
        >
          <BookMarked className="w-5 h-5" />
          <span>My Books</span>
        </button>

        <button
          onClick={() => setActiveTab('login')}
          className={`flex flex-col items-center gap-0.5 text-[10px] font-bold ${
            activeTab === 'login' ? 'text-indigo-600 font-black' : 'text-slate-500'
          }`}
        >
          <User className="w-5 h-5" />
          <span>Login / Profile</span>
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

    </div>
  );
}
