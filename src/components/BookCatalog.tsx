import React, { useState, useMemo } from 'react';
import {
  Search, Filter, BookOpen, BookMarked, CheckCircle, Clock,
  Bookmark, MapPin, Eye, Plus, FileSpreadsheet,
  User, Edit, Trash2, XCircle, Monitor, Sparkles,
  Scan, CheckSquare, Square, Download, Layers, ChevronDown, ChevronUp, Camera, BookPlus
} from 'lucide-react';
import { Book, UserProfile, Reservation, Loan, LibrarySettings, MediaType } from '../types';
import { AddBookModal } from './AddBookModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { BookCoverFallback } from './BookCoverFallback';
import { CatalogGridSkeleton } from './Skeletons';
import { OpacKioskMode } from './OpacKioskMode';
import { TopReadingClassesWidget } from './TopReadingClassesWidget';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { usePermission } from '../hooks/usePermission';
import { offlineQueue } from '../lib/offlineQueue';
import { exportToMarc21 } from '../lib/dataPortability';

const MEDIA_TYPES: MediaType[] = [
  'Book',
  'E-Book',
  'Audiobook',
  'Periodical',
  'Board Game',
  'Video/DVD',
  'Educational Kit'
];

interface BookCatalogProps {
  books: Book[];
  currentUser: UserProfile;
  reservations: Reservation[];
  users?: UserProfile[];
  loans?: Loan[];
  settings?: LibrarySettings;
  onReserveBook: (book: Book, patronOverride?: UserProfile) => void;
  onOpenCheckoutForBook: (book: Book) => void;
  onViewReferenceOnly: () => void;
  onOpenLogin?: () => void;
  onAddBook?: (bookData: Omit<Book, 'id'>) => Promise<void>;
  onOpenAddBookModal?: () => void;
  onOpenSmartCataloger?: () => void;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (bookId: string) => void;
  onOpenImportModal?: (type?: 'books' | 'parents' | 'staff') => void;
  onCancelReservation?: (reservationId: string) => void;
  onOpenChallenges?: () => void;
  onOpenSuggestBook?: () => void;
  isLoading?: boolean;
}

export const BookCatalog: React.FC<BookCatalogProps> = ({
  books,
  currentUser,
  reservations,
  users = [],
  loans = [],
  settings,
  onReserveBook,
  onOpenCheckoutForBook,
  onViewReferenceOnly,
  onOpenLogin,
  onAddBook,
  onOpenAddBookModal,
  onOpenSmartCataloger,
  onEditBook,
  onDeleteBook,
  onOpenImportModal,
  onCancelReservation,
  onOpenChallenges,
  onOpenSuggestBook,
  isLoading = false
}) => {
  const { t, isRtl, language, localizeCategory } = useLanguage();
  const { toast } = useToast();
  const { can } = usePermission(currentUser);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isCatalogScannerOpen, setIsCatalogScannerOpen] = useState(false);
  const [isKioskOpen, setIsKioskOpen] = useState(false);

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMediaType, setSelectedMediaType] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<'all' | 'circulating' | 'reference'>('all');
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'available' | 'checked-out'>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('all');
  const [shelfGradeFilter, setShelfGradeFilter] = useState<'Primary' | 'Middle' | 'Secondary'>(() => {
    const num = parseInt((currentUser.grade || '').match(/\d+/)?.[0] || '0', 10);
    if (num >= 1 && num <= 5) return 'Primary';
    if (num >= 6 && num <= 8) return 'Middle';
    return 'Secondary';
  });

  // Multi-facet filter checkboxes
  const [statusCheckboxes, setStatusCheckboxes] = useState<string[]>([]);
  const [gradeCheckboxes, setGradeCheckboxes] = useState<string[]>([]);
  const [langCheckboxes, setLangCheckboxes] = useState<string[]>([]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [mobileSwipeMode, setMobileSwipeMode] = useState<'swipe' | 'stack'>('swipe');
  const [entriesPerPage, setEntriesPerPage] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showMarcDetails, setShowMarcDetails] = useState(false);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  // Stats calculation
  const totalPhysicalCopies = useMemo(
    () => books.reduce((acc, b) => acc + (b.totalCopies || 1), 0),
    [books]
  );
  const totalAvailableCopies = useMemo(
    () => books.reduce((acc, b) => acc + (b.availableCopies !== undefined ? b.availableCopies : (b.totalCopies || 1)), 0),
    [books]
  );

  // Distinct Filter options
  const categories: string[] = useMemo(
    () => Array.from(new Set(books.map(b => b.category).filter(Boolean))),
    [books]
  );

  const gradeOptions = [
    { value: 'all', labelEn: 'All Grade Levels', labelDv: 'ހުރިހާ ގްރޭޑެއް' },
    { value: 'Primary (Grades 1-5)', labelEn: 'Primary (Grades 1-5)', labelDv: 'ޕްރައިމަރީ (ގްރޭޑް 1-5)' },
    { value: 'Middle (Grades 6-8)', labelEn: 'Middle (Grades 6-8)', labelDv: 'މިޑްލް ސްކޫލް (ގްރޭޑް 6-8)' },
    { value: 'Secondary (Grades 9-12)', labelEn: 'Secondary (Grades 9-12)', labelDv: 'ސެކަންޑަރީ (ގްރޭޑް 9-12)' },
    { value: 'All Ages', labelEn: 'All Ages / Faculty', labelDv: 'ހުރިހާ އުމުރަކަށް' },
  ];

  // Auto-complete suggestions index
  const autoCompleteSuggestions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (q.length < 2) return [];

    const list: Array<{ type: 'title' | 'author' | 'isbn' | 'category'; label: string; book: Book }> = [];
    const seen = new Set<string>();

    for (const b of books) {
      if (b.title.toLowerCase().includes(q)) {
        const key = `t:${b.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'title', label: b.title, book: b });
        }
      }
      if (b.author.toLowerCase().includes(q)) {
        const key = `a:${b.author}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'author', label: b.author, book: b });
        }
      }
      if (b.isbn.toLowerCase().includes(q) || b.barcode.toLowerCase().includes(q)) {
        const key = `i:${b.isbn}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'isbn', label: `${b.isbn} - ${b.title}`, book: b });
        }
      }
      if (b.category.toLowerCase().includes(q)) {
        const key = `c:${b.category}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'category', label: b.category, book: b });
        }
      }
      if (list.length >= 8) break;
    }
    return list;
  }, [books, searchQuery]);

  // High-performance multi-facet full text filtering
  const filteredBooks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return books.filter(book => {
      // 1. Full text query match across Title, Author, ISBN, Barcode, Publisher, DDC, Shelf, Category
      const matchesSearch =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.author.toLowerCase().includes(q) ||
        book.isbn.toLowerCase().includes(q) ||
        book.barcode.toLowerCase().includes(q) ||
        (book.publisher && book.publisher.toLowerCase().includes(q)) ||
        (book.ddcCallNumber && book.ddcCallNumber.toLowerCase().includes(q)) ||
        (book.shelfLocation && book.shelfLocation.toLowerCase().includes(q)) ||
        book.category.toLowerCase().includes(q);

      // 2. Category match
      const matchesCategory = selectedCategory === 'all' || book.category === selectedCategory;

      // 2b. Media type match
      const matchesMediaType =
        selectedMediaType === 'all' || (book.mediaType || 'Book') === selectedMediaType;

      // 3. Circulating vs Reference Type
      const matchesType =
        selectedType === 'all' ||
        (selectedType === 'reference' && book.isReferenceOnly) ||
        (selectedType === 'circulating' && !book.isReferenceOnly);

      // 4. Availability Status
      let matchesStatus = true;
      if (statusCheckboxes.length > 0) {
        matchesStatus = statusCheckboxes.some(status => {
          if (status === 'available') return book.availableCopies > 0;
          if (status === 'checked-out') return book.availableCopies === 0;
          if (status === 'reference') return book.isReferenceOnly;
          return true;
        });
      } else if (selectedStatus !== 'all') {
        matchesStatus =
          (selectedStatus === 'available' && book.availableCopies > 0) ||
          (selectedStatus === 'checked-out' && book.availableCopies === 0);
      }

      // 5. Grade Suitability
      let matchesGrade = true;
      if (gradeCheckboxes.length > 0) {
        matchesGrade = gradeCheckboxes.some(g => book.targetGrade === g || book.targetGrade === 'All Ages');
      } else if (selectedGrade !== 'all') {
        matchesGrade =
          book.targetGrade === selectedGrade ||
          book.targetGrade === 'All Ages';
      }

      // 6. Language
      let matchesLang = true;
      if (langCheckboxes.length > 0) {
        matchesLang = langCheckboxes.some(l => book.bookLanguage && book.bookLanguage.toLowerCase() === l.toLowerCase());
      } else if (selectedLanguage !== 'all') {
        matchesLang =
          selectedLanguage === 'all' ||
          (book.bookLanguage && book.bookLanguage.toLowerCase() === selectedLanguage.toLowerCase());
      }

      return matchesSearch && matchesCategory && matchesMediaType && matchesType && matchesStatus && matchesGrade && matchesLang;
    });
  }, [books, searchQuery, selectedCategory, selectedMediaType, selectedType, selectedStatus, selectedGrade, selectedLanguage, statusCheckboxes, gradeCheckboxes, langCheckboxes]);

  // Curated Netflix/Libib-style Discovery Shelves
  const discoveryShelves = useMemo(() => {
    const newArrivals = [...books]
      .sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''))
      .slice(0, 10);

    const popularDhivehi = books
      .filter((b) => b.bookLanguage === 'Dhivehi' || /[\u0780-\u07BF]/.test(b.title))
      .slice(0, 10);

    const topByGrade = books
      .filter((b) => (b.targetGrade || '').includes(shelfGradeFilter) || b.targetGrade === 'All Ages')
      .slice(0, 10);

    const staffPicks = books
      .filter((b) => !b.isReferenceOnly)
      .sort((a, b) => (b.publicationYear || 0) - (a.publicationYear || 0))
      .slice(0, 10);

    return { newArrivals, popularDhivehi, topByGrade, staffPicks };
  }, [books, shelfGradeFilter]);

  // Queue position helper for reservations
  const getQueueStats = (bookId: string) => {
    const pendingQueue = reservations
      .filter((r) => r.bookId === bookId && r.status === 'pending')
      .sort((a, b) => a.requestDate.localeCompare(b.requestDate));
    const userIndex = pendingQueue.findIndex(
      (r) => r.userId === currentUser.id || (currentUser.id !== 'guest' && r.userName === currentUser.name)
    );
    return {
      totalHolds: pendingQueue.length,
      userPosition: userIndex >= 0 ? userIndex + 1 : 0,
      userReservation: userIndex >= 0 ? pendingQueue[userIndex] : undefined
    };
  };

  const isAlreadyReservedByUser = (bookId: string) => {
    return getQueueStats(bookId).userPosition > 0;
  };

  const handleReserveWithFeedback = (book: Book, patronOverride?: UserProfile) => {
    const actingUser = patronOverride || currentUser;
    if (actingUser.id === 'guest') {
      toast.info(
        language === 'dv'
          ? 'ފޮތް ނަންނޯޓު ކުރުމަށް ލޮގިން ވެލައްވާ ނުވަތަ ކިއޮސްކް މޯޑުގައި އައިޑީ ސްކޭން ކުރައްވާ.'
          : 'Please sign in as a student/teacher or scan your ID card in Library Kiosk Mode to place a hold.',
        'Sign In Required'
      );
      if (onOpenLogin) onOpenLogin();
      return;
    }

    if (!navigator.onLine) {
      offlineQueue.enqueue({
        id: `res-offline-${Date.now()}`,
        bookId: book.id,
        bookTitle: book.title,
        userId: actingUser.id,
        userName: actingUser.name,
        userGrade: actingUser.grade,
        requestDate: new Date().toISOString().split('T')[0]
      });
      toast.info(
        language === 'dv'
          ? `އިންޓަރނެޓް ނެތުމުން ނަންނޯޓު ރައްކާކުރެވިއްޖެ! އަލުން ގުޅުމުން ފޮނުވޭނެ.`
          : `Offline: Hold queued! Will automatically sync once connection is restored.`,
        'Offline Queue'
      );
      onReserveBook(book, actingUser);
      return;
    }

    onReserveBook(book, actingUser);
  };

  const totalPages = Math.ceil(filteredBooks.length / entriesPerPage) || 1;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const paginatedBooks = filteredBooks.slice(startIndex, startIndex + entriesPerPage);

  const resetFilters = () => {
    setSearchQuery('');
    setSelectedCategory('all');
    setSelectedMediaType('all');
    setSelectedType('all');
    setSelectedStatus('all');
    setSelectedGrade('all');
    setSelectedLanguage('all');
    setStatusCheckboxes([]);
    setGradeCheckboxes([]);
    setLangCheckboxes([]);
    setCurrentPage(1);
  };

  const toggleStatusCheckbox = (status: string) => {
    setStatusCheckboxes(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
    setCurrentPage(1);
  };

  const toggleGradeCheckbox = (grade: string) => {
    setGradeCheckboxes(prev =>
      prev.includes(grade) ? prev.filter(g => g !== grade) : [...prev, grade]
    );
    setCurrentPage(1);
  };

  const toggleLangCheckbox = (lang: string) => {
    setLangCheckboxes(prev =>
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
    setCurrentPage(1);
  };

  const hasActiveFilters =
    searchQuery !== '' ||
    selectedCategory !== 'all' ||
    selectedMediaType !== 'all' ||
    selectedType !== 'all' ||
    selectedStatus !== 'all' ||
    selectedGrade !== 'all' ||
    selectedLanguage !== 'all' ||
    statusCheckboxes.length > 0 ||
    gradeCheckboxes.length > 0 ||
    langCheckboxes.length > 0;

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Search bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 shadow-sm relative overflow-hidden">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5" /> {t.catalog}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  <bdi>{books.length.toLocaleString()}</bdi> {t.titles} · <bdi>{totalPhysicalCopies.toLocaleString()}</bdi> {t.physicalBooks}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                  <bdi>{totalAvailableCopies.toLocaleString()}</bdi> {t.available}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                {t.catalog}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
                {language === 'dv'
                  ? 'މަގޫދޫ ސްކޫލް ލައިބްރަރީގެ ޑިޖިޓަލް ކެޓަލޮގުން ފޮތްތައް ހޯއްދަވައި، އޮންލައިންކޮށް ނަންނޯޓު ކުރައްވާ.'
                  : 'Discover curated library shelves, inspect real-time copy availability, and place self-service holds.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
              {onOpenSuggestBook && (
                <button
                  type="button"
                  onClick={onOpenSuggestBook}
                  className="bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-bold text-xs px-3.5 py-2.5 rounded-2xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
                  id="opac-suggest-book-btn"
                >
                  <BookPlus className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>{language === 'dv' ? 'ފޮތެއް ހުށަހަޅާ' : 'Suggest a Book'}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsKioskOpen(true)}
                className="bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl transition flex items-center gap-2 cursor-pointer shadow-xs whitespace-nowrap"
                id="launch-library-kiosk-btn"
              >
                <Monitor className="w-4 h-4 text-emerald-400 dark:text-white" />
                <span>{language === 'dv' ? 'ކިއޮސްކް މޯޑު' : 'Launch Library Kiosk'}</span>
              </button>
              {can('data:import_export') && onOpenImportModal && (
                <button
                  type="button"
                  onClick={() => onOpenImportModal('books')}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 font-bold text-xs px-3.5 py-2.5 rounded-2xl transition flex items-center gap-2 border border-slate-300 dark:border-slate-700 cursor-pointer whitespace-nowrap"
                  id="catalog-import-csv-btn"
                >
                  <FileSpreadsheet className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>{t.importBulk}</span>
                </button>
              )}
              {can('catalog:create_edit') && onOpenSmartCataloger && (
                <button
                  type="button"
                  onClick={onOpenSmartCataloger}
                  className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white border border-slate-300 dark:border-slate-700 font-bold text-xs px-3.5 py-2.5 rounded-2xl transition flex items-center gap-2 cursor-pointer whitespace-nowrap"
                  id="catalog-smart-ai-cataloger-btn"
                >
                  <Camera className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>{language === 'dv' ? 'އޭއައި ކަވަރު ސްކޭނަރ' : 'AI Vision Cataloger'}</span>
                </button>
              )}
              {can('catalog:create_edit') && (onAddBook || onOpenAddBookModal) && (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenAddBookModal) onOpenAddBookModal();
                    else setIsAddBookModalOpen(true);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-black text-xs px-4 py-2.5 rounded-2xl shadow-sm transition flex items-center gap-2 active:scale-95 cursor-pointer whitespace-nowrap"
                  id="catalog-add-book-btn"
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.addBook}</span>
                </button>
              )}
            </div>
          </div>

          {/* Search Bar Input with Camera Scanner & Auto-complete Index */}
          <div className="relative mt-2 max-w-3xl">
            <Search className="w-5 h-5 text-slate-400 absolute top-3.5 start-4" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                // Short timeout to allow click on suggestion item
                setTimeout(() => setIsSearchFocused(false), 250);
              }}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={t.searchPlaceholder}
              className="w-full py-3 ps-12 pe-24 text-start bg-slate-50 text-slate-900 placeholder-slate-400 rounded-2xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-semibold transition-all shadow-inner"
              id="catalog-search-input"
            />

            {/* Camera Barcode / QR Scanner Trigger */}
            <div className="absolute top-2.5 end-3 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition cursor-pointer"
                  title="Clear Search"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCatalogScannerOpen(true)}
                className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                title="Scan Book Barcode or ISBN with Camera"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-700" />
                <span className="hidden sm:inline font-mono text-[11px]">{language === 'dv' ? 'ސްކޭން' : 'Scan'}</span>
              </button>
            </div>

            {/* Auto-complete Suggestions Dropdown Index */}
            {isSearchFocused && autoCompleteSuggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-slate-200/90 z-50 overflow-hidden divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2">
                <div className="bg-slate-50 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>{language === 'dv' ? 'އޮޓޯ-ކޮމްޕްލީޓް ނަތީޖާތައް' : 'Auto-Complete Match Index'}</span>
                  <span className="font-mono text-emerald-700">{autoCompleteSuggestions.length} found</span>
                </div>
                {autoCompleteSuggestions.map((item, idx) => (
                  <button
                    key={`${item.type}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchQuery(item.type === 'isbn' ? item.book.isbn : item.label);
                      setIsSearchFocused(false);
                      setCurrentPage(1);
                    }}
                    className="w-full px-4 py-2.5 text-start flex items-center justify-between gap-3 hover:bg-emerald-50/70 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                        item.type === 'title' ? 'bg-slate-100 text-slate-800' :
                        item.type === 'author' ? 'bg-sky-100 text-sky-800' :
                        item.type === 'isbn' ? 'bg-amber-100 text-amber-800 font-mono' :
                        'bg-emerald-100 text-emerald-800'
                      }`}>
                        {item.type}
                      </span>
                      <span className="text-xs font-bold text-slate-800 truncate">
                        <bdi>{item.label}</bdi>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500 font-medium">
                      <span><bdi>{item.book.shelfLocation || 'Main'}</bdi></span>
                      <span className={`w-2 h-2 rounded-full ${item.book.availableCopies > 0 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Multi-Facet Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3.5">
        
        {/* Row 1: Category Badges */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <span className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wider pe-2 shrink-0">
            <Filter className="w-3.5 h-3.5 text-emerald-600" /> {language === 'dv' ? 'ބައި / ޖެންރާ:' : 'Subject:'}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedCategory('all');
              setCurrentPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-emerald-700 text-white shadow-xs'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {language === 'dv' ? `ހުރިހާ ބައިތަކެއް (${books.length})` : `All Subjects (${books.length})`}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {localizeCategory(cat)}
            </button>
          ))}
        </div>

        {/* Row 2: Secondary Dropdown Filters + Media Type + Layout Toggle */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Availability Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value as any);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">{language === 'dv' ? 'ހުރިހާ ޙާލަތެއް' : 'All Availability'}</option>
              <option value="available">{language === 'dv' ? '✓ ލިބެންހުރި ފޮތްތައް' : '✓ In Stock (Available)'}</option>
              <option value="checked-out">{language === 'dv' ? '⏱ ދޫކުރެވިފައި' : '⏱ Checked Out'}</option>
            </select>

            {/* Media Type Filter */}
            <select
              value={selectedMediaType}
              onChange={(e) => {
                setSelectedMediaType(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">{language === 'dv' ? 'ހުރިހާ މީޑިއާ ބާވަތެއް' : 'All Media Types'}</option>
              {MEDIA_TYPES.map((mt) => (
                <option key={mt} value={mt}>{mt}</option>
              ))}
            </select>

            {/* Target Grade Filter */}
            <select
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              {gradeOptions.map(g => (
                <option key={g.value} value={g.value}>
                  {language === 'dv' ? g.labelDv : g.labelEn}
                </option>
              ))}
            </select>

            {/* Language Filter */}
            <select
              value={selectedLanguage}
              onChange={(e) => {
                setSelectedLanguage(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer"
            >
              <option value="all">{language === 'dv' ? 'ހުރިހާ ބަހެއް' : 'All Languages'}</option>
              <option value="English">English</option>
              <option value="Dhivehi">ދިވެހި (Dhivehi)</option>
              <option value="Arabic">العربية (Arabic)</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2.5 py-1.5 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-800 transition cursor-pointer flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{language === 'dv' ? 'ފިލްޓަރުތައް ފޮހެލާ' : 'Clear Filters'}</span>
              </button>
            )}
          </div>

          {/* Right: Circulation Type & View Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setSelectedType('all');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedType === 'all'
                    ? 'bg-white font-black text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'dv' ? 'ހުރިހާ' : 'All'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('circulating');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedType === 'circulating'
                    ? 'bg-white font-black text-slate-900 shadow-sm border border-slate-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'dv' ? 'ދޫކުރެވޭ' : 'Borrowable'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedType('reference');
                  setCurrentPage(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer ${
                  selectedType === 'reference'
                    ? 'bg-amber-500 font-black text-white shadow-sm'
                    : 'text-amber-800 hover:text-amber-950'
                }`}
              >
                <BookMarked className="w-3 h-3" />
                <span>{language === 'dv' ? 'ރެފަރެންސް' : 'Reference'}</span>
              </button>
            </div>

            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-indigo-600 font-black shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'dv' ? 'ގްރިޑް ކާޑު' : 'Grid'}
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-white text-indigo-600 font-black shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {language === 'dv' ? 'ލިސްޓު' : 'Table'}
              </button>
            </div>
          </div>

        </div>

        {/* Row 3: Multi-Facet Filter Checkboxes (Availability, Grade, Language) */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            
            {/* Availability Checkboxes */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                {language === 'dv' ? 'ޙާލަތު:' : 'Status:'}
              </span>
              <button
                type="button"
                onClick={() => toggleStatusCheckbox('available')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition font-bold text-[11px] cursor-pointer ${
                  statusCheckboxes.includes('available')
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-extrabold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {statusCheckboxes.includes('available') ? <CheckSquare className="w-3.5 h-3.5 text-emerald-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                <span>{language === 'dv' ? 'ލިބެންހުރި' : 'Available'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleStatusCheckbox('checked-out')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition font-bold text-[11px] cursor-pointer ${
                  statusCheckboxes.includes('checked-out')
                    ? 'bg-amber-50 text-amber-800 border-amber-300 font-extrabold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {statusCheckboxes.includes('checked-out') ? <CheckSquare className="w-3.5 h-3.5 text-amber-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                <span>{language === 'dv' ? 'ދޫކޮށްފައި' : 'Checked Out'}</span>
              </button>

              <button
                type="button"
                onClick={() => toggleStatusCheckbox('reference')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition font-bold text-[11px] cursor-pointer ${
                  statusCheckboxes.includes('reference')
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-300 font-extrabold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {statusCheckboxes.includes('reference') ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                <span>{language === 'dv' ? 'ރެފަރެންސް' : 'Reference'}</span>
              </button>
            </div>

            {/* Language Checkboxes */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                {language === 'dv' ? 'ބަސް:' : 'Language:'}
              </span>
              <button
                type="button"
                onClick={() => toggleLangCheckbox('Dhivehi')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition font-bold text-[11px] cursor-pointer ${
                  langCheckboxes.includes('Dhivehi')
                    ? 'bg-purple-50 text-purple-800 border-purple-300 font-extrabold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {langCheckboxes.includes('Dhivehi') ? <CheckSquare className="w-3.5 h-3.5 text-purple-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                <span>ދިވެހި</span>
              </button>

              <button
                type="button"
                onClick={() => toggleLangCheckbox('English')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border transition font-bold text-[11px] cursor-pointer ${
                  langCheckboxes.includes('English')
                    ? 'bg-sky-50 text-sky-800 border-sky-300 font-extrabold shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {langCheckboxes.includes('English') ? <CheckSquare className="w-3.5 h-3.5 text-sky-600" /> : <Square className="w-3.5 h-3.5 text-slate-400" />}
                <span>English</span>
              </button>
            </div>

            {/* Grade Suitability Multi-facet Filter */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                {language === 'dv' ? 'ގްރޭޑް:' : 'Grade:'}
              </span>
              {['Primary (Grades 1-5)', 'Middle (Grades 6-8)', 'Secondary (Grades 9-12)'].map((gr) => (
                <button
                  key={gr}
                  type="button"
                  onClick={() => toggleGradeCheckbox(gr)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border transition font-bold text-[10px] cursor-pointer ${
                    gradeCheckboxes.includes(gr)
                      ? 'bg-teal-50 text-teal-800 border-teal-300 font-extrabold'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {gradeCheckboxes.includes(gr) ? <CheckSquare className="w-3 h-3 text-teal-600" /> : <Square className="w-3 h-3 text-slate-400" />}
                  <span>{gr.split(' ')[0]}</span>
                </button>
              ))}
            </div>

          </div>

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 self-end md:self-auto shrink-0">
            <span>{language === 'dv' ? 'ފެންނަނީ:' : 'Showing:'} <bdi className="font-mono text-slate-900 font-extrabold">{filteredBooks.length}</bdi> / <bdi className="font-mono">{books.length}</bdi></span>
          </div>
        </div>

      </div>

      {/* PUBLIC OPAC LIVE CLASS & HOUSE READING STANDINGS */}
      {!isLoading && !hasActiveFilters && users.length > 0 && (
        <TopReadingClassesWidget
          users={users}
          loans={loans}
          books={books}
          onOpenChallenges={onOpenChallenges}
        />
      )}

      {/* NETFLIX / LIBIB-STYLE VISUAL DISCOVERY SHELVES (When browsing without narrowing filters) */}
      {!isLoading && !hasActiveFilters && books.length > 0 && (
        <div className="space-y-6">
          {[
            {
              key: 'new-arrivals',
              title: language === 'dv' ? 'އަލަށް ލިބުނު ފޮތްތައް' : 'New Arrivals',
              subtitle: language === 'dv' ? 'ލައިބްރަރީއަށް އެންމެ ފަހުން އިތުރުކުރެވުނު ފޮތްތައް' : 'Recently cataloged editions ready for checkout',
              items: discoveryShelves.newArrivals
            },
            {
              key: 'popular-dhivehi',
              title: language === 'dv' ? 'ދިވެހި ބަހުން މަޤްބޫލު ފޮތްތައް' : 'Popular in Dhivehi',
              subtitle: language === 'dv' ? 'ދިވެހި އަދަބިއްޔާތާއި ވާހަކަ ފޮތްތައް' : 'Maldivian literature, poetry & heritage titles',
              items: discoveryShelves.popularDhivehi
            },
            {
              key: 'top-grade',
              title: language === 'dv' ? 'ގްރޭޑްތަކަށް ޚާއްޞަ ފޮތްތައް' : `Top Reads · ${shelfGradeFilter} School`,
              subtitle: language === 'dv' ? 'ކްލާސް ފެންވަރާ ގުޅޭ ފޮތްތައް' : 'Curated reading levels by grade band',
              items: discoveryShelves.topByGrade,
              showGradeTabs: true
            },
            {
              key: 'staff-picks',
              title: language === 'dv' ? 'މުދައްރިސުންގެ ހޮވުންތައް' : 'Staff Picks',
              subtitle: language === 'dv' ? 'ލައިބްރަރީ ޓީމުން އިރުޝާދު ދޭ ފޮތްތައް' : 'Recommended by Magoodhoo faculty & librarians',
              items: discoveryShelves.staffPicks
            }
          ]
            .filter((shelf) => shelf.items.length > 0)
            .map((shelf) => (
              <section key={shelf.key} className="space-y-2.5">
                <div className="flex items-center justify-between gap-3 flex-wrap px-1">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{shelf.title}</span>
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{shelf.subtitle}</p>
                  </div>
                  {shelf.showGradeTabs && (
                    <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 gap-1">
                      {(['Primary', 'Middle', 'Secondary'] as const).map((band) => (
                        <button
                          key={band}
                          type="button"
                          onClick={() => setShelfGradeFilter(band)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                            shelfGradeFilter === band
                              ? 'bg-emerald-700 text-white'
                              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {band}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
                  {shelf.items.map((book) => {
                    const qStats = getQueueStats(book.id);
                    return (
                      <div
                        key={`${shelf.key}-${book.id}`}
                        onClick={() => setSelectedBook(book)}
                        className="w-40 sm:w-44 shrink-0 snap-start bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-emerald-500/60 transition cursor-pointer group flex flex-col"
                      >
                        <div className="aspect-[2/3] w-full bg-slate-100 dark:bg-slate-800 relative overflow-hidden">
                          <BookCoverFallback
                            src={book.coverUrl}
                            title={book.title}
                            author={book.author}
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent" />
                          <div className="absolute bottom-2 start-2 end-2 flex items-center justify-between text-[10px] font-mono tabular-nums text-white">
                            <span>
                              {book.isReferenceOnly
                                ? 'REF'
                                : `${book.availableCopies}/${book.totalCopies} avail`}
                            </span>
                            {qStats.totalHolds > 0 && (
                              <span className="text-amber-300">{qStats.totalHolds} hold{qStats.totalHolds > 1 ? 's' : ''}</span>
                            )}
                          </div>
                        </div>
                        <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                          <div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1">
                              <bdi>{book.title}</bdi>
                            </h4>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              <bdi>{book.author}</bdi>
                            </p>
                          </div>
                          <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 truncate pt-1">
                            <bdi>{book.shelfLocation}</bdi>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}

      {/* SKELETON LOADING STATE */}
      {isLoading && (
        <CatalogGridSkeleton count={8} />
      )}

      {/* GRID VIEW (4-COLUMN RESPONSIVE DESKTOP GRID & SINGLE-COLUMN SWIPEABLE MOBILE LAYOUT) */}
      {!isLoading && viewMode === 'grid' && (
        <div className="space-y-4">
          {/* Mobile Swipe / Stack Control Pill */}
          <div className="sm:hidden flex items-center justify-between bg-white border border-slate-200/90 p-2.5 rounded-2xl shadow-xs">
            <span className="text-[11px] font-bold text-slate-600">
              {mobileSwipeMode === 'swipe'
                ? (language === 'dv' ? 'ކާޑުތައް ހުރަހަށް ކައްސާލާ (Swipe)' : 'Swipe cards horizontally')
                : (language === 'dv' ? 'ކާޑުތައް ތިރިއަށް ބައްލަވާ (Stack)' : 'Single column cards')}
            </span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl">
              <button
                type="button"
                onClick={() => setMobileSwipeMode('swipe')}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                  mobileSwipeMode === 'swipe' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                {language === 'dv' ? 'ސްވައިޕް' : 'Swipe'}
              </button>
              <button
                type="button"
                onClick={() => setMobileSwipeMode('stack')}
                className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition ${
                  mobileSwipeMode === 'stack' ? 'bg-emerald-700 text-white shadow-xs' : 'text-slate-600'
                }`}
              >
                {language === 'dv' ? 'ލިސްޓް' : 'List'}
              </button>
            </div>
          </div>

          {/* DESKTOP VIEW: 4-COLUMN RESPONSIVE GRID (Hidden on mobile) */}
          <div className="hidden sm:grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {paginatedBooks.map((book) => {
              const qStats = getQueueStats(book.id);
              const isReserved = qStats.userPosition > 0;

              return (
                <div
                  key={book.id}
                  className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md transition-all duration-300 flex flex-col justify-between overflow-hidden group"
                >
                  <div>
                    <div
                      className="relative h-56 bg-slate-100 dark:bg-slate-800 overflow-hidden cursor-pointer"
                      onClick={() => setSelectedBook(book)}
                    >
                      <BookCoverFallback
                        src={book.coverUrl}
                        title={book.title}
                        author={book.author}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent"></div>

                      {/* Single subtle top status indicator */}
                      <div className="absolute top-3 end-3">
                        {book.isReferenceOnly ? (
                          <span className="bg-sky-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                            {language === 'dv' ? 'ރެފަރެންސް' : 'Reference'}
                          </span>
                        ) : book.availableCopies > 0 ? (
                          <span className="bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md font-mono tabular-nums">
                            {book.availableCopies}/{book.totalCopies} {language === 'dv' ? 'ލިބެންހުރި' : 'Avail'}
                          </span>
                        ) : (
                          <span className="bg-amber-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-md">
                            {language === 'dv' ? 'ދޫކުރެވިފައި' : 'Checked Out'}
                          </span>
                        )}
                      </div>

                      {/* Title & Author on Cover bottom */}
                      <div className="absolute bottom-3 left-3.5 right-3.5 text-white">
                        <h3 className="font-bold text-sm line-clamp-1 group-hover:text-emerald-300 transition">
                          <bdi>{book.title}</bdi>
                        </h3>
                        <p className="text-xs text-slate-200 line-clamp-1">
                          <bdi>{book.author}</bdi>
                        </p>
                      </div>
                    </div>

                    {/* Clean Details Section */}
                    <div className="p-4 space-y-2 text-xs">
                      {/* Live Shelf Availability String */}
                      <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                        <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate font-mono tabular-nums text-[11px]">
                          {book.isReferenceOnly
                            ? (language === 'dv' ? `ރެފަރެންސް — ${book.shelfLocation}` : `In-Library Use — ${book.shelfLocation}`)
                            : language === 'dv'
                            ? `${book.totalCopies} ގެ ތެރެއިން ${book.availableCopies} ކޮޕީ ލިބެންހުރި — ${book.shelfLocation}`
                            : `${book.availableCopies} of ${book.totalCopies} copies available — ${book.shelfLocation}`}
                        </span>
                      </div>

                      {/* Clean single-line metadata separated by · */}
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        <span>{localizeCategory(book.category)}</span>
                        {book.ddcCallNumber && <> · <span className="font-mono"><bdi>{book.ddcCallNumber}</bdi></span></>}
                        {book.targetGrade && <> · <span>{book.targetGrade}</span></>}
                      </div>

                      <p className="text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed text-xs">
                        {book.description}
                      </p>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 font-mono tabular-nums">
                        <span>ISBN <bdi className="text-slate-800 dark:text-slate-200">{book.isbn}</bdi></span>
                        {qStats.totalHolds > 0 && (
                          <span className="text-amber-700 dark:text-amber-400 font-semibold">
                            {qStats.totalHolds} {qStats.totalHolds === 1 ? 'hold' : 'holds'} in queue
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="p-3.5 bg-slate-50/80 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedBook(book)}
                      className="p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 transition-all cursor-pointer"
                      title={language === 'dv' ? 'ތަފްޞީލު ބައްލަވާ' : 'View book details'}
                    >
                      <Eye className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    </button>

                    {book.isReferenceOnly ? (
                      <button
                        type="button"
                        onClick={onViewReferenceOnly}
                        className="flex-1 bg-sky-100 dark:bg-sky-950/50 hover:bg-sky-200 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold text-xs py-2 px-3 rounded-xl text-center transition flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <BookMarked className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                        <span>{language === 'dv' ? 'ރެފަރެންސް މައުލޫމާތު' : 'Reference Desk'}</span>
                      </button>
                    ) : (
                      <>
                        {isReserved ? (
                          <div className="flex-1 flex items-center gap-1">
                            <span className="flex-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold py-2 px-2 rounded-xl text-center flex items-center justify-center gap-1 font-mono tabular-nums">
                              <Bookmark className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                              <span>
                                {language === 'dv'
                                  ? `ކިއު #${qStats.userPosition}`
                                  : `Hold #${qStats.userPosition} in queue`}
                              </span>
                            </span>
                            {onCancelReservation && qStats.userReservation && (
                              <button
                                type="button"
                                onClick={() => onCancelReservation(qStats.userReservation!.id)}
                                className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                                title={language === 'dv' ? 'ރިޒަވޭޝަން ކެންސަލް ކުރައްވާ' : 'Cancel Hold'}
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReserveWithFeedback(book)}
                            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 px-3 rounded-xl text-center transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                          >
                            <Bookmark className="w-3.5 h-3.5" />
                            <span>
                              {book.availableCopies > 0
                                ? (language === 'dv' ? 'ނަންނޯޓު ކުރައްވާ' : 'Reserve Hold')
                                : (language === 'dv' ? 'ކިއުއަށް ވަންނަވާ' : `Join Queue (${qStats.totalHolds})`)}
                            </span>
                          </button>
                        )}

                        {can('circulation:checkout') && (
                          <button
                            type="button"
                            onClick={() => onOpenCheckoutForBook(book)}
                            className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-xl text-center transition shrink-0 cursor-pointer"
                            title="Desk Checkout"
                          >
                            {language === 'dv' ? 'ދޫކުރޭ' : 'Issue'}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* MOBILE VIEW: SINGLE-COLUMN SWIPEABLE CARDS OR STACK (Only on mobile <sm) */}
          <div className="sm:hidden">
            {mobileSwipeMode === 'swipe' ? (
              <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-1 scrollbar-none safe-bottom">
                {paginatedBooks.map((book) => {
                  const isReserved = isAlreadyReservedByUser(book.id);

                  return (
                    <div
                      key={book.id}
                      className="min-w-[85vw] max-w-[340px] snap-center shrink-0 bg-white border border-slate-200/90 rounded-3xl shadow-sm flex flex-col justify-between overflow-hidden"
                    >
                      <div>
                        <div className="relative h-64 bg-slate-100 overflow-hidden">
                          <img
                            src={book.coverUrl}
                            alt={book.title}
                            loading="lazy"
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent"></div>

                          {/* Status Badges */}
                          <div className="absolute top-3 start-3 end-3 flex justify-between items-start gap-1">
                            <span className="bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow border border-white/10">
                              {localizeCategory(book.category)}
                            </span>

                            {book.isReferenceOnly ? (
                              <span className="bg-sky-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow flex items-center gap-1">
                                <BookMarked className="w-3 h-3" />
                                <bdi>{language === 'dv' ? 'ރެފަރެންސް' : 'REFERENCE'}</bdi>
                              </span>
                            ) : book.availableCopies > 0 ? (
                              <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow flex items-center gap-1">
                                <CheckCircle className="w-3 h-3" />
                                <bdi>{book.availableCopies} {language === 'dv' ? 'ލިބެންހުރި' : 'Available'}</bdi>
                              </span>
                            ) : (
                              <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                <bdi>{language === 'dv' ? 'ދޫކުރެވިފައި' : 'Checked Out'}</bdi>
                              </span>
                            )}
                          </div>

                          {/* Title & Author on bottom */}
                          <div className="absolute bottom-3 left-3 right-3 text-white">
                            <h3 className="font-black text-base line-clamp-1">
                              <bdi>{book.title}</bdi>
                            </h3>
                            <p className="text-xs text-slate-200 line-clamp-1 font-medium">
                              {language === 'dv' ? 'މުސަންނިފު:' : 'by'} <bdi>{book.author}</bdi>
                            </p>
                          </div>
                        </div>

                        <div className="p-4 space-y-2 text-xs">
                          <div className="flex items-center text-slate-600 gap-1 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate"><bdi>{book.shelfLocation}</bdi></span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100 font-semibold">
                            <span>ISBN: <bdi className="font-mono text-slate-800">{book.isbn}</bdi></span>
                            <span>Copies: <bdi className="font-mono font-bold text-slate-800">{book.availableCopies}/{book.totalCopies}</bdi></span>
                          </div>
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="p-4 bg-slate-50/90 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBook(book)}
                          className="p-2 text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 shadow-xs"
                          title="Details"
                        >
                          <Eye className="w-4 h-4 text-emerald-700" />
                        </button>

                        {book.isReferenceOnly ? (
                          <button
                            type="button"
                            onClick={onViewReferenceOnly}
                            className="flex-1 bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs py-2 px-3 rounded-xl text-center"
                          >
                            <span>{language === 'dv' ? 'ރެފަރެންސް' : 'Reference'}</span>
                          </button>
                        ) : isReserved ? (
                          <span className="flex-1 bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold py-2 px-2 rounded-xl text-center">
                            {language === 'dv' ? 'ނަންނޯޓު ކުރެވިފައި' : 'Reserved Online'}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleReserveWithFeedback(book)}
                            className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-2 px-3 rounded-xl text-center transition shadow-xs"
                          >
                            <span>{language === 'dv' ? 'ނަންނޯޓު ކުރައްވާ' : 'Reserve Book'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 safe-bottom">
                {paginatedBooks.map((book) => {
                  const isReserved = isAlreadyReservedByUser(book.id);

                  return (
                    <div
                      key={book.id}
                      className="bg-white border border-slate-200/90 rounded-3xl shadow-xs overflow-hidden flex flex-col"
                    >
                      <div className="flex p-3.5 gap-3.5 items-center">
                        <img
                          src={book.coverUrl}
                          alt=""
                          loading="lazy"
                          className="w-16 h-22 object-cover rounded-2xl shadow-xs border border-slate-200 shrink-0"
                        />
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {book.isReferenceOnly ? (
                              <span className="bg-sky-100 text-sky-800 border border-sky-300 text-[9px] font-black px-2 py-0.5 rounded-md">
                                REF ONLY
                              </span>
                            ) : book.availableCopies > 0 ? (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-md">
                                {book.availableCopies} AVAILABLE
                              </span>
                            ) : (
                              <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-2 py-0.5 rounded-md">
                                CHECKED OUT
                              </span>
                            )}
                            <span className="text-[10px] text-slate-500 font-medium truncate">
                              {localizeCategory(book.category)}
                            </span>
                          </div>
                          <h4 className="font-extrabold text-slate-900 text-sm truncate">
                            <bdi>{book.title}</bdi>
                          </h4>
                          <p className="text-xs text-slate-600 truncate">
                            By <bdi>{book.author}</bdi>
                          </p>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Location: <bdi>{book.shelfLocation}</bdi>
                          </p>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50/90 border-t border-slate-100 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedBook(book)}
                          className="p-2 text-slate-700 bg-white rounded-xl border border-slate-200 text-xs font-bold"
                        >
                          <Eye className="w-3.5 h-3.5 text-emerald-700" />
                        </button>
                        {!book.isReferenceOnly && (
                          <button
                            type="button"
                            onClick={() => handleReserveWithFeedback(book)}
                            disabled={isReserved}
                            className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold text-center transition ${
                              isReserved
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                                : 'bg-emerald-700 text-white shadow-xs'
                            }`}
                          >
                            {isReserved ? 'Reserved' : 'Reserve Book'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* COMPACT LIST / TABLE OF BOOKS VIEW (DENSE DESKTOP VIEW WITH STICKY HEADERS) */}
      {!isLoading && viewMode === 'list' && (
        <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xl space-y-4 p-6">
          
          {/* Header Title */}
          <div className="border-b border-slate-200 pb-3 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                <span className="p-1.5 bg-slate-100 rounded-lg border border-slate-300">
                  <BookOpen className="w-5 h-5 text-indigo-600" />
                </span>
                <span>{t.catalog}</span>
              </h2>
              <div className="h-1 w-20 bg-indigo-600 rounded-full mt-1"></div>
            </div>

            <div className="text-xs text-slate-500 font-semibold">
              <bdi className="font-mono font-bold text-slate-800">{filteredBooks.length}</bdi> {language === 'dv' ? 'ފޮތް ފެނިފައިވޭ' : 'items filtered'}
            </div>
          </div>

          {/* Table Controls Top Row: Entries Dropdown & Search Input */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
              <span>{language === 'dv' ? 'ދައްކާ:' : 'Show'}</span>
              <select
                value={entriesPerPage}
                onChange={(e) => {
                  setEntriesPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={250}>250</option>
                <option value={500}>500</option>
                <option value={10000}>{language === 'dv' ? 'ހުރިހާ' : 'All'} ({filteredBooks.length.toLocaleString()})</option>
              </select>
              <span>{language === 'dv' ? 'އައިޓަމް' : 'entries per page'}</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 w-full sm:w-auto">
              <span>{language === 'dv' ? 'ހޯއްދަވާ:' : 'Search:'}</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={language === 'dv' ? 'ފޮތުގެ ނަމުން...' : 'Filter table...'}
                className="bg-white border border-slate-300 rounded-md px-3 py-1 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-sm w-full sm:w-48"
              />
            </div>
          </div>

          {/* Main Table with Dark Blue Sticky Header */}
          <div className="overflow-x-auto border border-slate-200/90 rounded-2xl max-h-[70vh]">
            <table className="w-full text-start text-xs text-slate-800 border-collapse">
              <thead className="bg-slate-900 text-white font-extrabold border-b border-slate-800 sticky top-0 z-20 shadow-xs">
                <tr>
                  <th className="p-3.5 border-e border-slate-800">{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Title'}</th>
                  <th className="p-3.5 border-e border-slate-800">{language === 'dv' ? 'މުސަންނިފު' : 'Author'}</th>
                  <th className="p-3.5 border-e border-slate-800">{language === 'dv' ? 'އައި.އެސް.ބީ.އެން' : 'ISBN / Call No.'}</th>
                  <th className="p-3.5 border-e border-slate-800">{language === 'dv' ? 'ބައި / ޖެންރާ' : 'Genre'}</th>
                  <th className="p-3.5 border-e border-slate-800 text-center">{language === 'dv' ? 'ޖުމްލަ' : 'Total'}</th>
                  <th className="p-3.5 border-e border-slate-800 text-center">{language === 'dv' ? 'ލިބެންހުރި' : 'Available'}</th>
                  <th className="p-3.5 text-center">{language === 'dv' ? 'ޢަމަލުތައް' : 'Actions'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {paginatedBooks.map((book) => {
                  const isReserved = isAlreadyReservedByUser(book.id);

                  return (
                    <tr key={book.id} className="hover:bg-slate-50 transition">
                      {/* Title Column */}
                      <td className="p-3.5 border-e border-slate-200">
                        <div className="flex items-center gap-3">
                          <BookCoverFallback
                            src={book.coverUrl}
                            title={book.title}
                            className="w-8 h-10 object-cover rounded shadow-sm shrink-0 border border-slate-200"
                          />
                          <div>
                            <span className="font-extrabold text-slate-900 text-xs sm:text-sm block">
                              <bdi>{book.title}</bdi>
                            </span>
                            <span className="text-[10px] text-slate-500 flex items-center gap-1 font-semibold">
                              <MapPin className="w-3 h-3 text-emerald-700" />
                              <bdi>{book.shelfLocation}</bdi>
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Author Column */}
                      <td className="p-3.5 border-e border-slate-200 font-medium text-slate-800">
                        <bdi>{book.author}</bdi>
                      </td>

                      {/* ISBN & Call Number Column */}
                      <td className="p-3.5 border-e border-slate-200 font-mono text-slate-700 font-semibold space-y-0.5">
                        <div className="text-slate-900"><bdi>{book.isbn}</bdi></div>
                        {book.ddcCallNumber && (
                          <div className="text-[10px] text-slate-700 font-bold bg-slate-100 px-1.5 py-0.5 rounded inline-block">
                            <bdi>{book.ddcCallNumber}</bdi>
                          </div>
                        )}
                      </td>

                      {/* Genre / Category Column */}
                      <td className="p-3.5 border-e border-slate-200 font-medium text-slate-800">
                        <span className="inline-block bg-slate-100 text-slate-800 text-[11px] font-bold px-2 py-0.5 rounded-md">
                          {localizeCategory(book.category)}
                        </span>
                      </td>

                      {/* Total Copies Column */}
                      <td className="p-3.5 border-e border-slate-200 text-center font-bold text-slate-800">
                        <bdi className="font-mono">{book.totalCopies}</bdi>
                      </td>

                      {/* Available Copies Column: Standardized Green = Available, Amber = Checked Out, Blue = Reference */}
                      <td className="p-3.5 border-e border-slate-200 text-center">
                        {book.isReferenceOnly ? (
                          <span className="bg-sky-100 text-sky-800 border border-sky-300 text-[10px] font-black px-2 py-1 rounded-md shadow-xs inline-block">
                            <bdi>{language === 'dv' ? 'ރެފަރެންސް' : 'Ref Only'}</bdi>
                          </span>
                        ) : book.availableCopies > 0 ? (
                          <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black px-2.5 py-1 rounded-md shadow-xs inline-block min-w-[85px]">
                            <bdi>{book.availableCopies} {language === 'dv' ? 'ލިބެންހުރި' : 'Available'}</bdi>
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[11px] font-black px-2.5 py-1 rounded-md shadow-xs inline-block min-w-[85px]">
                            <bdi>{language === 'dv' ? 'ދޫކުރެވިފައި' : 'Checked Out'}</bdi>
                          </span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Details */}
                          <button
                            type="button"
                            onClick={() => setSelectedBook(book)}
                            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition shadow-xs flex items-center gap-1 px-2.5 text-xs font-bold cursor-pointer"
                            title={language === 'dv' ? 'ތަފްޞީލު ބައްލަވާ' : 'View Book Details'}
                          >
                            <Eye className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="hidden sm:inline">{language === 'dv' ? 'ތަފްޞީލު' : 'Details'}</span>
                          </button>

                          {/* Reserve Online */}
                          {!book.isReferenceOnly && (
                            <button
                              type="button"
                              onClick={() => handleReserveWithFeedback(book)}
                              disabled={isReserved}
                              className={`p-1.5 rounded-md transition shadow-xs flex items-center gap-1 px-2.5 text-xs font-bold cursor-pointer ${
                                isReserved
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 cursor-not-allowed'
                                  : 'bg-emerald-700 hover:bg-emerald-800 text-white'
                              }`}
                              title={isReserved ? (language === 'dv' ? 'ނަންނޯޓު ކުރެވިފައި' : 'Reserved') : (language === 'dv' ? 'ނަންނޯޓު ކުރައްވާ' : 'Reserve')}
                            >
                              <Bookmark className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">
                                {isReserved ? (language === 'dv' ? 'ނޯޓުވެފައި' : 'Reserved') : (language === 'dv' ? 'ނަންނޯޓު' : 'Reserve')}
                              </span>
                            </button>
                          )}

                          {/* Role-Guarded Desk & Catalog Controls */}
                          {can('circulation:checkout') && (
                            <button
                              type="button"
                              onClick={() => onOpenCheckoutForBook(book)}
                              className="p-1.5 bg-[#1D4ED8] hover:bg-blue-800 text-white rounded-md transition shadow-xs cursor-pointer"
                              title={language === 'dv' ? 'ފޮތް ދޫކުރައްވާ' : 'Issue Book at Desk'}
                            >
                              <User className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {can('catalog:create_edit') && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onEditBook) onEditBook(book);
                                else setSelectedBook(book);
                              }}
                              className="p-1.5 bg-[#EAB308] hover:bg-amber-600 text-white rounded-md transition shadow-xs cursor-pointer"
                              title={language === 'dv' ? 'އުނިއިތުރު ގެންނަވާ' : 'Edit Book'}
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {can('catalog:delete') && (
                            <button
                              type="button"
                              onClick={() => setBookToDelete(book)}
                              className="p-1.5 bg-[#EF4444] hover:bg-rose-700 text-white rounded-md transition shadow-xs cursor-pointer"
                              title={language === 'dv' ? 'ފޮތުގެ ރެކޯޑް ފޮހެލައްވާ' : 'Delete Book'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

          {/* Table Footer: Entries info & Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <div className="text-xs text-slate-500 font-medium">
              {language === 'dv' ? (
                <span>
                  <bdi className="font-mono font-bold text-slate-800">{filteredBooks.length}</bdi> ފޮތުގެ ތެރެއިން{' '}
                  <bdi className="font-mono font-bold text-slate-800">{filteredBooks.length === 0 ? 0 : startIndex + 1}</bdi> އިން{' '}
                  <bdi className="font-mono font-bold text-slate-800">{Math.min(currentPage * entriesPerPage, filteredBooks.length)}</bdi> އަށް ދައްކަނީ
                </span>
              ) : (
                <span>
                  Showing <bdi className="font-mono font-bold text-slate-800">{filteredBooks.length === 0 ? 0 : startIndex + 1}</bdi> to{' '}
                  <bdi className="font-mono font-bold text-slate-800">{Math.min(currentPage * entriesPerPage, filteredBooks.length)}</bdi> of{' '}
                  <bdi className="font-mono font-bold text-slate-800">{filteredBooks.length}</bdi> books
                </span>
              )}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {language === 'dv' ? 'ކުރީގެ' : 'Previous'}
              </button>

              {Array.from({ length: totalPages }).map((_, i) => {
                // Windowed pagination
                if (totalPages > 8 && Math.abs(currentPage - (i + 1)) > 3 && i !== 0 && i !== totalPages - 1) {
                  return null;
                }

                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setCurrentPage(i + 1)}
                    className={`px-3 py-1 text-xs font-bold rounded border transition cursor-pointer ${
                      currentPage === i + 1
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <bdi className="font-mono">{i + 1}</bdi>
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
              >
                {language === 'dv' ? 'ކުރިއަށް' : 'Next'}
              </button>
            </div>
          </div>

        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredBooks.length === 0 && (
        <div className="text-center py-16 bg-white rounded-3xl border border-slate-200 p-8 shadow-sm space-y-3">
          <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-800">{t.noBooksFound}</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
            {t.searchEmptyHint}
          </p>
          <button
            type="button"
            onClick={resetFilters}
            className="px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl shadow transition hover:bg-indigo-700"
          >
            {language === 'dv' ? 'ހުރިހާ ފިލްޓަރެއް ފޮހެލާ' : 'Reset All Filters'}
          </button>
        </div>
      )}

      {/* Slide-over Copy Inventory & MARC Drawer (Desktop Slide-over / Mobile Bottom Sheet) */}
      {selectedBook && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex justify-end items-stretch max-sm:items-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedBook(null);
              setShowMarcDetails(false);
            }
          }}
        >
          <div className="bg-white w-full sm:max-w-xl h-full max-sm:h-auto max-sm:max-h-[92vh] max-sm:rounded-t-3xl shadow-2xl border-s border-slate-200 text-slate-800 flex flex-col justify-between overflow-hidden">
            {/* Mobile Bottom-Sheet Grab Indicator */}
            <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-md mx-auto my-2.5 shrink-0"></div>
            <div className="relative h-48 bg-slate-900 shrink-0">
              <img
                src={selectedBook.coverUrl}
                alt={selectedBook.title}
                className="w-full h-full object-cover opacity-75"
              />
              <button
                type="button"
                onClick={() => {
                  setSelectedBook(null);
                  setShowMarcDetails(false);
                }}
                className="absolute top-3 end-3 bg-white/95 text-slate-800 px-2.5 py-1 rounded-lg hover:bg-white transition shadow border border-slate-200 font-bold cursor-pointer"
                aria-label="Close drawer"
              >
                ✕
              </button>
              <div className="absolute bottom-4 start-4 end-4 text-white">
                <span className="text-[10px] font-extrabold bg-emerald-700 px-2.5 py-0.5 rounded-md uppercase tracking-wider">
                  {localizeCategory(selectedBook.category)}
                </span>
                <h3 className="text-lg font-black mt-1 text-white">
                  <bdi>{selectedBook.title}</bdi>
                </h3>
                <p className="text-xs text-slate-200 font-medium">
                  {language === 'dv' ? 'މުސަންނިފު:' : 'by'} <bdi>{selectedBook.author}</bdi>
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 font-medium flex-1 overflow-y-auto">
              {selectedBook.isReferenceOnly && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-amber-900">
                  <BookMarked className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold">{language === 'dv' ? 'ރެފަރެންސް ފޮތެއް (ދޫނުކުރެވޭ):' : 'Reference Material (Non-Circulating):'}</span>
                    <p className="text-[11px] mt-0.5 text-amber-800 font-medium">
                      {language === 'dv'
                        ? 'މި ފޮތަކީ ލައިބްރަރީ ހޯލުގައި ކިޔުމަށް ޚާއްޞަކުރެވިފައިވާ ފޮތެކެވެ. ގެއަށް ގެންދިއުމަށް ދޫނުކުރެވޭނެއެވެ.'
                        : 'This volume is preserved for library desk reference only. Students may consult this volume inside the library reading hall.'}
                    </p>
                  </div>
                </div>
              )}

              <p className="leading-relaxed text-slate-700">{selectedBook.description}</p>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-[11px]">
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">ISBN</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900"><bdi>{selectedBook.isbn}</bdi></span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">Barcode ID</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900"><bdi>{selectedBook.barcode}</bdi></span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">Shelf Location</span>
                  <span className="font-bold text-slate-900"><bdi>{selectedBook.shelfLocation}</bdi></span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">DDC Call Number</span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700"><bdi>{selectedBook.ddcCallNumber || 'DDC 000'}</bdi></span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">Availability</span>
                  <span className="font-mono tabular-nums font-bold text-slate-900"><bdi>{selectedBook.availableCopies} / {selectedBook.totalCopies}</bdi></span>
                </div>
                <div>
                  <span className="text-slate-500 block text-[10px] font-bold">Language</span>
                  <span className="font-bold text-slate-900">{selectedBook.bookLanguage || 'English'}</span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 block text-[10px] font-bold">Publisher</span>
                  <span className="font-bold text-slate-900"><bdi>{selectedBook.publisher} ({selectedBook.publicationYear})</bdi></span>
                </div>
              </div>

              {selectedBook.barcodeImageUrl && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Uploaded Book Barcode</span>
                  <img src={selectedBook.barcodeImageUrl} alt="Barcode" className="max-h-20 mx-auto object-contain border bg-white p-1 rounded shadow-xs" />
                </div>
              )}

              {/* Parent-Child Physical Copy Inventory Table */}
              {selectedBook.copies && selectedBook.copies.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-700" />
                      {t.copyInventory} (<bdi className="font-mono tabular-nums">{selectedBook.copies.length}</bdi>)
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      Holds: <bdi>{reservations.filter(r => r.bookId === selectedBook.id && r.status === 'pending').length}</bdi>
                    </span>
                  </div>
                  <div className="border border-slate-200 rounded-xl overflow-x-auto">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                        <tr>
                          <th className="py-1.5 px-2.5">Copy Barcode</th>
                          <th className="py-1.5 px-2.5">Accession / Rack</th>
                          <th className="py-1.5 px-2.5">Cond.</th>
                          <th className="py-1.5 px-2.5">MVR</th>
                          <th className="py-1.5 px-2.5 text-end">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedBook.copies.map(cp => (
                          <tr key={cp.copyId}>
                            <td className="py-1.5 px-2.5 font-mono tabular-nums font-bold text-slate-900"><bdi>{cp.barcode}</bdi></td>
                            <td className="py-1.5 px-2.5 text-slate-600">
                              <div className="font-mono text-[10px] text-slate-800"><bdi>{cp.accessionNumber || cp.copyId}</bdi></div>
                              <div className="text-[10px] text-slate-500"><bdi>{cp.rackLocation || cp.shelfLocation || selectedBook.shelfLocation}</bdi></div>
                            </td>
                            <td className="py-1.5 px-2.5 text-slate-600">{cp.condition}</td>
                            <td className="py-1.5 px-2.5 font-mono tabular-nums text-slate-600"><bdi>{cp.acquisitionPriceMvr ?? 150}</bdi></td>
                            <td className="py-1.5 px-2.5 text-end">
                              <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                                cp.status === 'Available' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                              }`}>
                                {cp.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Progressive Disclosure: Collapsible MARC21 Record Preview */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMarcDetails(prev => !prev)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-[11px] font-bold text-slate-800 cursor-pointer"
                >
                  <span>MARC21 Bibliographic & Holdings Fields</span>
                  {showMarcDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showMarcDetails && (
                  <div className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] space-y-1 border-t border-slate-200 overflow-x-auto">
                    <div>020 ## $a <bdi>{selectedBook.isbn}</bdi></div>
                    <div>082 04 $a <bdi>{selectedBook.ddcCallNumber || '000'}</bdi></div>
                    <div>100 1# $a <bdi>{selectedBook.author}</bdi></div>
                    <div>245 10 $a <bdi>{selectedBook.title}</bdi></div>
                    <div>260 ## $b <bdi>{selectedBook.publisher}</bdi> $c <bdi>{selectedBook.publicationYear}</bdi></div>
                    <div>852 ## $b Magoodhoo School $c <bdi>{selectedBook.shelfLocation}</bdi></div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50/90 border-t border-slate-200 flex items-center justify-between gap-2 safe-bottom flex-wrap shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {!selectedBook.isReferenceOnly && (() => {
                  const dq = getQueueStats(selectedBook.id);
                  if (dq.userPosition > 0) {
                    return (
                      <div className="flex items-center gap-1.5">
                        <span className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold font-mono tabular-nums flex items-center gap-1.5">
                          <Bookmark className="w-3.5 h-3.5 text-emerald-700" />
                          <span>#{dq.userPosition} of {dq.totalHolds} in queue</span>
                        </span>
                        {onCancelReservation && dq.userReservation && (
                          <button
                            type="button"
                            onClick={() => {
                              onCancelReservation(dq.userReservation!.id);
                              setSelectedBook(null);
                              setShowMarcDetails(false);
                            }}
                            className="px-3 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
                          >
                            Cancel Hold
                          </button>
                        )}
                      </div>
                    );
                  }
                  return (
                    <button
                      type="button"
                      onClick={() => {
                        handleReserveWithFeedback(selectedBook);
                        setSelectedBook(null);
                        setShowMarcDetails(false);
                      }}
                      className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-extrabold transition shadow-xs cursor-pointer flex items-center gap-1.5"
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>
                        {selectedBook.availableCopies > 0
                          ? (language === 'dv' ? 'ނަންނޯޓު ކުރައްވާ' : 'Reserve Book')
                          : (language === 'dv' ? 'ކިއުއަށް ވަންނަވާ' : `Join Hold Queue (${dq.totalHolds})`)}
                      </span>
                    </button>
                  );
                })()}
                <button
                  type="button"
                  onClick={() => exportToMarc21([selectedBook], `marc-${selectedBook.isbn}.mrk`)}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  title="Export MARC21 record (.mrk)"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>MARC21</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedBook(null);
                  setShowMarcDetails(false);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-xl text-xs font-bold hover:bg-slate-300 transition border border-slate-300 cursor-pointer"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Book Modal */}
      {onAddBook && (
        <AddBookModal
          isOpen={isAddBookModalOpen}
          onClose={() => setIsAddBookModalOpen(false)}
          onAddBook={onAddBook}
        />
      )}

      {/* Delete Book Modal */}
      {bookToDelete && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBookToDelete(null);
          }}
        >
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 space-y-4 text-slate-800">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900">
                  {language === 'dv' ? 'ފޮތް ފޮހެލުން' : 'Delete Book Record'}
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  {language === 'dv' ? 'މި ފޮތް ސިސްޓަމުން ފޮހެލަން ބޭނުންފުޅުތޯ؟' : 'Are you sure you want to delete this book?'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-slate-900"><bdi>{bookToDelete.title}</bdi></p>
              <p className="text-slate-600">{language === 'dv' ? 'ލިޔުންތެރިޔާ:' : 'Author:'} <bdi>{bookToDelete.author}</bdi></p>
              <p className="text-slate-500 font-mono">ISBN: <bdi>{bookToDelete.isbn}</bdi></p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
              >
                {language === 'dv' ? 'ކެންސަލް' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteBook) onDeleteBook(bookToDelete.id);
                  setBookToDelete(null);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition shadow cursor-pointer active:scale-95"
              >
                {language === 'dv' ? 'ފޮހެލައްވާ' : 'Delete Book'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Camera Barcode / QR Scanner Modal for Search & Checkout */}
      {isCatalogScannerOpen && (
        <BarcodeScannerModal
          isOpen={isCatalogScannerOpen}
          onClose={() => setIsCatalogScannerOpen(false)}
          books={books}
          onScanResult={(code, matched) => {
            if (matched) {
              setSearchQuery(matched.title);
              toast.success(`Scanned: "${matched.title}" (ISBN: ${matched.isbn})`);
            } else {
              setSearchQuery(code);
              toast.info(`Scanned Code: ${code}`);
            }
            setIsCatalogScannerOpen(false);
            setCurrentPage(1);
          }}
        />
      )}

      {/* Self-Service Fullscreen Library Kiosk Mode */}
      <OpacKioskMode
        isOpen={isKioskOpen}
        onClose={() => setIsKioskOpen(false)}
        books={books}
        users={users}
        loans={loans}
        reservations={reservations}
        settings={settings}
        onReserveForPatron={(book, patron) => handleReserveWithFeedback(book, patron)}
        onCancelReservation={onCancelReservation}
      />

    </div>
  );
};
