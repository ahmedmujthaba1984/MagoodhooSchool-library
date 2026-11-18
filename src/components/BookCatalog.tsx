import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Search,
  Filter,
  BookOpen,
  BookMarked,
  CheckCircle,
  Clock,
  Bookmark,
  MapPin,
  Eye,
  Plus,
  FileSpreadsheet,
  User,
  Edit,
  Trash2,
  XCircle,
  Monitor,
  Sparkles,
  Scan,
  CheckSquare,
  Square,
  Download,
  Layers,
  ChevronDown,
  ChevronUp,
  Camera,
  BookPlus,
  ArrowUpDown,
  Printer,
  LayoutGrid,
  Table as TableIcon,
  Library,
  X,
} from 'lucide-react';
import { Book, UserProfile, Reservation, Loan, LibrarySettings } from '../types';
import { AddBookModal } from './AddBookModal';
import { BarcodeScannerModal } from './BarcodeScannerModal';
import { BookCover } from './BookCover';
import { CatalogGridSkeleton, CatalogTableSkeleton } from './Skeletons';
import { OpacKioskMode } from './OpacKioskMode';
import { TopReadingClassesWidget } from './TopReadingClassesWidget';
import { SectionErrorBoundary } from './SectionErrorBoundary';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { usePermission } from '../hooks/usePermission';
import {
  useCatalogFilter,
  CatalogSortOption,
  GRADE_BAND_OPTIONS,
} from '../hooks/useCatalogFilter';
import { normalizeQuery } from '../utils/thaanaNormalize';
import { offlineQueue } from '../lib/offlineQueue';
import { exportToMarc21 } from '../lib/dataPortability';
import { printBarcodeStickerSheet } from '../lib/printableLabels';
import { CatalogUrlFilters } from '../lib/urlState';

type SortField = 'title' | 'author' | 'ddc' | 'shelf' | 'total' | 'available';

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
  onAddBook?: (bookData: Omit<Book, 'id'>) => Promise<string | void> | void;
  onOpenAddBookModal?: () => void;
  onOpenSmartCataloger?: () => void;
  onEditBook?: (book: Book) => void;
  onDeleteBook?: (bookId: string) => void;
  onOpenImportModal?: (type?: 'books' | 'parents' | 'staff') => void;
  onCancelReservation?: (reservationId: string) => void;
  onOpenChallenges?: () => void;
  onOpenSuggestBook?: () => void;
  isLoading?: boolean;
  initialUrlFilters?: CatalogUrlFilters;
  initialSelectedBookId?: string | null;
  onSelectedBookChange?: (bookId: string | null) => void;
  onFiltersChange?: (filters: CatalogUrlFilters) => void;
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
  isLoading = false,
  initialUrlFilters,
  initialSelectedBookId = null,
  onSelectedBookChange,
  onFiltersChange,
}) => {
  const { t, language, localizeCategory } = useLanguage();
  const { toast } = useToast();
  const { can, isSuperAdmin } = usePermission(currentUser);

  const resultsContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    searchQuery,
    setSearchQuery,
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    selectedMediaTypes,
    setSelectedMediaTypes,
    selectedStatuses,
    toggleStatus,
    selectedGrades,
    setSelectedGrades,
    toggleGrade,
    selectedLanguages,
    setSelectedLanguages,
    toggleLanguage,
    selectedPublishers,
    setSelectedPublishers,
    circulationType,
    setCirculationType,
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    entriesPerPage,
    setEntriesPerPage,
    page: currentPage,
    setPage: setCurrentPage,
    totalPages,
    startIndex,
    filteredBooks,
    paginatedBooks,
    availableCategories,
    availableMediaTypes,
    availablePublishers,
    facetCounts,
    activeFilterChips,
    activeFilterCount,
    clearAllFilters,
    emptyStateSuggestions,
  } = useCatalogFilter({
    books,
    isLoadingCatalog: isLoading,
    language,
    initialFilters: initialUrlFilters,
    onFiltersChange,
    resultsContainerRef,
  });

  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isCatalogScannerOpen, setIsCatalogScannerOpen] = useState(false);
  const [isKioskOpen, setIsKioskOpen] = useState(false);
  const [mobileSwipeMode, setMobileSwipeMode] = useState<'swipe' | 'stack'>('swipe');
  const [selectedTableIds, setSelectedTableIds] = useState<string[]>([]);

  const [shelfGradeFilter, setShelfGradeFilter] = useState<'Primary' | 'Middle' | 'Secondary'>(() => {
    const num = parseInt((currentUser.grade || '').match(/\d+/)?.[0] || '0', 10);
    if (num >= 1 && num <= 5) return 'Primary';
    if (num >= 6 && num <= 8) return 'Middle';
    return 'Secondary';
  });

  const [selectedBook, setSelectedBookState] = useState<Book | null>(() => {
    if (!initialSelectedBookId) return null;
    return books.find((b) => b.id === initialSelectedBookId || b.isbn === initialSelectedBookId) || null;
  });
  const [showMarcDetails, setShowMarcDetails] = useState(false);
  const [isAddBookModalOpen, setIsAddBookModalOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  const setSelectedBook = (book: Book | null) => {
    setSelectedBookState(book);
    if (onSelectedBookChange) {
      onSelectedBookChange(book ? book.id : null);
    }
  };

  // Sync deep-linked selectedBookId (from URL ?book=<id> or browser Back/Forward)
  useEffect(() => {
    if (!initialSelectedBookId) {
      setSelectedBookState(null);
      return;
    }
    const found =
      books.find((b) => b.id === initialSelectedBookId || b.isbn === initialSelectedBookId) || null;
    if (found) setSelectedBookState(found);
  }, [initialSelectedBookId, books]);

  // Stats calculation
  const totalPhysicalCopies = useMemo(
    () => books.reduce((acc, b) => acc + (b.totalCopies || 1), 0),
    [books]
  );
  const totalAvailableCopies = useMemo(
    () =>
      books.reduce(
        (acc, b) =>
          acc + (b.availableCopies !== undefined ? b.availableCopies : b.totalCopies || 1),
        0
      ),
    [books]
  );

  // Auto-complete suggestions using Thaana-normalized matching
  const autoCompleteSuggestions = useMemo(() => {
    const q = normalizeQuery(searchQuery);
    if (q.length < 2) return [];

    const list: Array<{ type: 'title' | 'author' | 'isbn' | 'category'; label: string; book: Book }> = [];
    const seen = new Set<string>();

    for (const b of books) {
      const titleStr = String(b.title ?? '');
      const authorStr = String(b.author ?? '');
      const isbnStr = String(b.isbn ?? '');
      const barcodeStr = String(b.barcode ?? '');
      const catStr = String(b.category ?? '');

      if (normalizeQuery(titleStr).includes(q)) {
        const key = `t:${titleStr}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'title', label: titleStr, book: b });
        }
      }
      if (normalizeQuery(authorStr).includes(q)) {
        const key = `a:${authorStr}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'author', label: authorStr, book: b });
        }
      }
      if (
        normalizeQuery(isbnStr).replace(/-/g, '').includes(q.replace(/-/g, '')) ||
        normalizeQuery(barcodeStr).includes(q)
      ) {
        const key = `i:${isbnStr || barcodeStr}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'isbn', label: `${isbnStr || barcodeStr} - ${titleStr}`, book: b });
        }
      }
      if (normalizeQuery(catStr).includes(q)) {
        const key = `c:${catStr}`;
        if (!seen.has(key)) {
          seen.add(key);
          list.push({ type: 'category', label: catStr, book: b });
        }
      }
      if (list.length >= 8) break;
    }
    return list;
  }, [books, searchQuery]);

  // Curated Netflix/Libib-style Discovery Shelves (used in Shelf View or browsing)
  const discoveryShelves = useMemo(() => {
    const newArrivals = [...books]
      .sort((a, b) => String(b.addedAt ?? '').localeCompare(String(a.addedAt ?? '')))
      .slice(0, 10);

    const popularDhivehi = books
      .filter((b) => b.bookLanguage === 'Dhivehi' || /[\u0780-\u07BF]/.test(b.title || ''))
      .slice(0, 10);

    const topByGrade = books
      .filter(
        (b) =>
          (b.targetGrade || '').includes(shelfGradeFilter) || b.targetGrade === 'All Ages'
      )
      .slice(0, 10);

    const staffPicks = books
      .filter((b) => !b.isReferenceOnly)
      .sort((a, b) => (b.publicationYear || 0) - (a.publicationYear || 0))
      .slice(0, 10);

    return { newArrivals, popularDhivehi, topByGrade, staffPicks };
  }, [books, shelfGradeFilter]);

  // Group filteredBooks by physical shelfLocation for Shelf View
  const filteredByShelfGroups = useMemo(() => {
    const groups = new Map<string, Book[]>();
    for (const book of filteredBooks) {
      const shelfName = (book.shelfLocation || '').trim() || 'General Collection';
      const arr = groups.get(shelfName) || [];
      arr.push(book);
      groups.set(shelfName, arr);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredBooks]);

  // Queue position helper for reservations
  const getQueueStats = (bookId: string) => {
    const pendingQueue = reservations
      .filter((r) => r.bookId === bookId && r.status === 'pending')
      .sort((a, b) => a.requestDate.localeCompare(b.requestDate));
    const userIndex = pendingQueue.findIndex(
      (r) =>
        r.userId === currentUser.id ||
        (currentUser.id !== 'guest' && r.userName === currentUser.name)
    );
    return {
      totalHolds: pendingQueue.length,
      userPosition: userIndex >= 0 ? userIndex + 1 : 0,
      userReservation: userIndex >= 0 ? pendingQueue[userIndex] : undefined,
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
        requestDate: new Date().toISOString().split('T')[0],
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

  const toggleSort = (field: SortField) => {
    const ascKey = `${field}-asc` as CatalogSortOption;
    const descKey = `${field}-desc` as CatalogSortOption;
    if (sortBy === ascKey) {
      setSortBy(descKey);
    } else {
      setSortBy(ascKey);
    }
  };

  const toggleTableSelection = (bookId: string) => {
    setSelectedTableIds((prev) =>
      prev.includes(bookId) ? prev.filter((id) => id !== bookId) : [...prev, bookId]
    );
  };

  const toggleSelectAllOnPage = () => {
    const pageIds = paginatedBooks.map((b) => b.id);
    const allSelected =
      pageIds.length > 0 && pageIds.every((id) => selectedTableIds.includes(id));
    if (allSelected) {
      setSelectedTableIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedTableIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const selectedTableBooks = useMemo(
    () => books.filter((b) => selectedTableIds.includes(b.id)),
    [books, selectedTableIds]
  );

  const handleBulkExportCsv = () => {
    if (selectedTableBooks.length === 0) return;
    const headers = ['Title', 'Author', 'ISBN', 'DDC', 'Shelf', 'Category', 'Available', 'Total'];
    const rows = selectedTableBooks.map((b) => [
      `"${String(b.title ?? '').replace(/"/g, '""')}"`,
      `"${String(b.author ?? '').replace(/"/g, '""')}"`,
      `"${String(b.isbn ?? '')}"`,
      `"${String(b.ddcCallNumber || '')}"`,
      `"${String(b.shelfLocation ?? '')}"`,
      `"${String(b.category ?? '')}"`,
      b.availableCopies,
      b.totalCopies,
    ]);
    const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `magoodhoo_selected_${selectedTableBooks.length}_books.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selectedTableBooks.length} selected title(s) to CSV.`, 'Bulk Export');
  };

  const renderDiscoveryShelves = () => (
    <div className="space-y-6">
      {[
        {
          key: 'new-arrivals',
          title: language === 'dv' ? 'އަލަށް ލިބުނު ފޮތްތައް' : 'New Arrivals',
          subtitle:
            language === 'dv'
              ? 'ލައިބްރަރީއަށް އެންމެ ފަހުން އިތުރުކުރެވުނު ފޮތްތައް'
              : 'Recently cataloged editions ready for checkout',
          items: discoveryShelves.newArrivals,
        },
        {
          key: 'popular-dhivehi',
          title: language === 'dv' ? 'ދިވެހި ބަހުން މަޤްބޫލު ފޮތްތައް' : 'Popular in Dhivehi',
          subtitle:
            language === 'dv'
              ? 'ދިވެހި އަދަބިއްޔާތާއި ވާހަކަ ފޮތްތައް'
              : 'Maldivian literature, poetry & heritage titles',
          items: discoveryShelves.popularDhivehi,
        },
        {
          key: 'top-grade',
          title:
            language === 'dv'
              ? 'ގްރޭޑްތަކަށް ޚާއްޞަ ފޮތްތައް'
              : `Top Reads · ${shelfGradeFilter} School`,
          subtitle:
            language === 'dv'
              ? 'ކްލާސް ފެންވަރާ ގުޅޭ ފޮތްތައް'
              : 'Curated reading levels by grade band',
          items: discoveryShelves.topByGrade,
          showGradeTabs: true,
        },
        {
          key: 'staff-picks',
          title: language === 'dv' ? 'މުދައްރިސުންގެ ހޮވުންތައް' : 'Staff Picks',
          subtitle:
            language === 'dv'
              ? 'ލައިބްރަރީ ޓީމުން އިރުޝާދު ދޭ ފޮތްތައް'
              : 'Recommended by Magoodhoo faculty & librarians',
          items: discoveryShelves.staffPicks,
        },
      ]
        .filter((shelf) => shelf.items.length > 0)
        .map((shelf) => (
          <section key={shelf.key} className="space-y-2.5">
            <div className="flex items-center justify-between gap-3 flex-wrap px-1">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white flex items-center gap-2 leading-relaxed">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{shelf.title}</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  {shelf.subtitle}
                </p>
              </div>
              {shelf.showGradeTabs && (
                <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-1 gap-1">
                  {(['Primary', 'Middle', 'Secondary'] as const).map((band) => (
                    <button
                      key={band}
                      type="button"
                      onClick={() => setShelfGradeFilter(band)}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition cursor-pointer ${
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
                      <BookCover
                        src={book.coverUrl}
                        title={book.title}
                        author={book.author}
                        ddcCallNumber={book.ddcCallNumber}
                        category={book.category}
                        size="sm"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-transparent to-transparent pointer-events-none" />
                      <div className="absolute bottom-2 start-2 end-2 flex items-center justify-between text-[10px] font-mono tabular-nums text-white">
                        <bdi dir="ltr">
                          {book.isReferenceOnly
                            ? 'REF'
                            : `${book.availableCopies}/${book.totalCopies} avail`}
                        </bdi>
                        {qStats.totalHolds > 0 && (
                          <span className="text-amber-300">
                            <bdi dir="ltr">
                              {qStats.totalHolds} hold{qStats.totalHolds > 1 ? 's' : ''}
                            </bdi>
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-1 leading-relaxed">
                          <bdi>{book.title}</bdi>
                        </h4>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                          <bdi>{book.author}</bdi>
                        </p>
                      </div>
                      <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 truncate pt-1">
                        <bdi dir="ltr">{book.shelfLocation}</bdi>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Top Banner / Search Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 text-slate-900 dark:text-slate-100 border border-slate-200/90 dark:border-slate-800 shadow-sm relative">
        <div className="relative z-10 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-semibold leading-relaxed">
                <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-black uppercase tracking-wider">
                  <BookOpen className="w-3.5 h-3.5" /> {t.catalog}
                </span>
                <span aria-hidden="true">·</span>
                <span>
                  <bdi dir="ltr" className="font-mono tabular-nums">
                    {books.length.toLocaleString()}
                  </bdi>{' '}
                  {t.titles} ·{' '}
                  <bdi dir="ltr" className="font-mono tabular-nums">
                    {totalPhysicalCopies.toLocaleString()}
                  </bdi>{' '}
                  {t.physicalBooks}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  <bdi dir="ltr" className="font-mono tabular-nums">
                    {totalAvailableCopies.toLocaleString()}
                  </bdi>{' '}
                  {t.available}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white leading-relaxed">
                {t.catalog}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
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
            <Search className="w-5 h-5 text-slate-400 absolute top-3.5 start-4 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => setIsSearchFocused(false), 250);
              }}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchPlaceholder}
              className="w-full py-3 ps-12 pe-28 text-start bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 rounded-2xl border border-slate-300 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-sm font-semibold transition-all shadow-inner leading-relaxed"
              id="catalog-search-input"
            />

            {/* Clear + Camera Barcode / QR Scanner Trigger */}
            <div className="absolute top-2.5 end-3 flex items-center gap-1.5">
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg transition cursor-pointer"
                  title={language === 'dv' ? 'ހޯދުން ފޮހެލާ' : 'Clear Search'}
                  aria-label="Clear search"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCatalogScannerOpen(true)}
                className="bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer active:scale-95"
                title="Scan Book Barcode or ISBN with Camera"
              >
                <Scan className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                <span className="hidden sm:inline text-[11px]">
                  {language === 'dv' ? 'ސްކޭން' : 'Scan'}
                </span>
              </button>
            </div>

            {/* Auto-complete Suggestions Dropdown Index */}
            {isSearchFocused && autoCompleteSuggestions.length > 0 && (
              <div className="absolute top-full mt-2 w-full bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200/90 dark:border-slate-700 z-50 overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-2">
                <div className="bg-slate-50 dark:bg-slate-800 px-3.5 py-2 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center justify-between">
                  <span>
                    {language === 'dv' ? 'އޮޓޯ-ކޮމްޕްލީޓް ނަތީޖާތައް' : 'Auto-Complete Match Index'}
                  </span>
                  <span className="font-mono text-emerald-700 dark:text-emerald-400">
                    <bdi dir="ltr">{autoCompleteSuggestions.length} found</bdi>
                  </span>
                </div>
                {autoCompleteSuggestions.map((item, idx) => (
                  <button
                    key={`${item.type}-${idx}`}
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSearchQuery(item.type === 'isbn' ? item.book.isbn : item.label);
                      setIsSearchFocused(false);
                    }}
                    className="w-full px-4 py-2.5 text-start flex items-center justify-between gap-3 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 transition cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 ${
                          item.type === 'title'
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200'
                            : item.type === 'author'
                            ? 'bg-sky-100 dark:bg-sky-950 text-sky-800 dark:text-sky-300'
                            : item.type === 'isbn'
                            ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 font-mono'
                            : 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                        }`}
                      >
                        {item.type}
                      </span>
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate leading-relaxed">
                        <bdi>{item.label}</bdi>
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                      <span>
                        <bdi dir="ltr">{item.book.shelfLocation || 'Main'}</bdi>
                      </span>
                      <span
                        className={`w-2 h-2 rounded-full ${
                          item.book.availableCopies > 0 ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 1: MULTI-FACET FILTER BAR (Wrapped in independent ErrorBoundary) */}
      <SectionErrorBoundary
        areaNameEn="Catalog Search & Filter Bar"
        areaNameDv="ކެޓަލޮގް ފިލްޓަރު ބައި"
        language={language}
        isAdmin={isSuperAdmin}
        compact
        onRecover={clearAllFilters}
      >
        <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200/90 dark:border-slate-800 shadow-sm space-y-3.5">
          {/* Row 1: Category Badges (Multi-select OR within Subjects) */}
          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none">
            <span className="text-xs font-black text-slate-500 dark:text-slate-400 flex items-center gap-1 uppercase tracking-wider pe-2 shrink-0 leading-relaxed">
              <Filter className="w-3.5 h-3.5 text-emerald-600" />{' '}
              {language === 'dv' ? 'ބައި / ޖެންރާ:' : 'Subject:'}
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategories([])}
              className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer leading-relaxed ${
                selectedCategories.length === 0
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
              }`}
            >
              {language === 'dv'
                ? `ހުރިހާ ބައިތަކެއް (${books.length})`
                : `All Subjects (${books.length})`}
            </button>
            {availableCategories.map((cat) => {
              const isSelected = selectedCategories.some(
                (c) => c.toLowerCase() === cat.toLowerCase()
              );
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => toggleCategory(cat)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold whitespace-nowrap transition-all cursor-pointer leading-relaxed ${
                    isSelected
                      ? 'bg-emerald-700 text-white shadow-xs'
                      : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {localizeCategory(cat)}{' '}
                  <span className="opacity-75 font-mono tabular-nums">
                    (<bdi dir="ltr">{facetCounts.byCategory[cat] || 0}</bdi>)
                  </span>
                </button>
              );
            })}
          </div>

          {/* Row 2: Secondary Dropdowns, Sort, Circulation Type & 3-Way View Mode Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Media Type Filter */}
              <select
                value={selectedMediaTypes.length === 1 ? selectedMediaTypes[0] : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedMediaTypes(val === 'all' ? [] : [val]);
                }}
                aria-label="Media type filter"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer leading-relaxed"
              >
                <option value="all">
                  {language === 'dv' ? 'ހުރިހާ މީޑިއާ ބާވަތެއް' : 'All Media Types'}
                </option>
                {availableMediaTypes.map((mt) => (
                  <option key={mt} value={mt}>
                    {mt} ({facetCounts.byMedia[mt] || 0})
                  </option>
                ))}
              </select>

              {/* Target Grade Dropdown (syncs with selectedGrades) */}
              <select
                value={selectedGrades.length === 1 ? selectedGrades[0] : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedGrades(val === 'all' ? [] : [val]);
                }}
                aria-label="Grade band filter"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer leading-relaxed"
              >
                <option value="all">
                  {language === 'dv' ? 'ހުރިހާ ގްރޭޑެއް' : 'All Grade Levels'}
                </option>
                {GRADE_BAND_OPTIONS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {language === 'dv' ? g.labelDv : g.labelEn} (
                    {facetCounts.byGrade[g.value] || 0})
                  </option>
                ))}
              </select>

              {/* Language Dropdown (syncs with selectedLanguages) */}
              <select
                value={selectedLanguages.length === 1 ? selectedLanguages[0] : 'all'}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedLanguages(val === 'all' ? [] : [val]);
                }}
                aria-label="Book language filter"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer leading-relaxed"
              >
                <option value="all">
                  {language === 'dv'
                    ? `ހުރިހާ ބަހެއް (${books.length})`
                    : `All Languages (${books.length})`}
                </option>
                <option value="English">English ({facetCounts.byLanguage.English || 0})</option>
                <option value="Dhivehi">
                  ދިވެހި (Dhivehi) ({facetCounts.byLanguage.Dhivehi || 0})
                </option>
                <option value="Arabic">
                  العربية (Arabic) ({facetCounts.byLanguage.Arabic || 0})
                </option>
              </select>

              {/* Publisher Dropdown (deduplicated) */}
              {availablePublishers.length > 0 && (
                <select
                  value={selectedPublishers.length === 1 ? selectedPublishers[0] : 'all'}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedPublishers(val === 'all' ? [] : [val]);
                  }}
                  aria-label="Publisher filter"
                  className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer leading-relaxed max-w-[190px]"
                >
                  <option value="all">
                    {language === 'dv' ? 'ހުރިހާ ޗާޕުޚާނާއެއް' : 'All Publishers'}
                  </option>
                  {availablePublishers.map((pub) => (
                    <option key={pub} value={pub}>
                      {pub} ({facetCounts.byPublisher[pub] || 0})
                    </option>
                  ))}
                </select>
              )}

              {/* Sort Order Selector */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as CatalogSortOption)}
                aria-label="Sort catalog"
                className="bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 cursor-pointer leading-relaxed"
              >
                <option value="title-asc">
                  {language === 'dv' ? 'ތަރުތީބު: ނަމުން (A–Z)' : 'Sort: Title (A–Z)'}
                </option>
                <option value="title-desc">
                  {language === 'dv' ? 'ތަރުތީބު: ނަމުން (Z–A)' : 'Sort: Title (Z–A)'}
                </option>
                <option value="author-asc">
                  {language === 'dv' ? 'ތަރުތީބު: މުސަންނިފު' : 'Sort: Author (A–Z)'}
                </option>
                <option value="ddc-asc">
                  {language === 'dv' ? 'ތަރުތީބު: DDC ކޯޑް' : 'Sort: DDC Call No.'}
                </option>
                <option value="shelf-asc">
                  {language === 'dv' ? 'ތަރުތީބު: ރެކު' : 'Sort: Shelf Location'}
                </option>
                <option value="available-desc">
                  {language === 'dv' ? 'ތަރުތީބު: ލިބެންހުރި އަދަދު' : 'Sort: Most Available'}
                </option>
                <option value="newest">
                  {language === 'dv' ? 'ތަރުތީބު: އެންމެ ފަހުގެ' : 'Sort: Newest Added'}
                </option>
              </select>
            </div>

            {/* Right: Circulation Type & Segmented 3-Way View Toggle (Grid / Table / Shelf) */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setCirculationType('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer leading-relaxed ${
                    circulationType === 'all'
                      ? 'bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {language === 'dv' ? 'ހުރިހާ' : 'All'}
                </button>
                <button
                  type="button"
                  onClick={() => setCirculationType('circulating')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer leading-relaxed ${
                    circulationType === 'circulating'
                      ? 'bg-white dark:bg-slate-900 font-black text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-slate-700'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {language === 'dv' ? 'ދޫކުރެވޭ' : 'Borrowable'}
                </button>
                <button
                  type="button"
                  onClick={() => setCirculationType('reference')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center gap-1 cursor-pointer leading-relaxed ${
                    circulationType === 'reference'
                      ? 'bg-amber-500 font-black text-white shadow-sm'
                      : 'text-amber-800 dark:text-amber-400 hover:text-amber-950'
                  }`}
                >
                  <BookMarked className="w-3 h-3" />
                  <span>{language === 'dv' ? 'ރެފަރެންސް' : 'Reference'}</span>
                </button>
              </div>

              {/* 3-Way Segmented Layout Switcher: Grid | Table | Shelf */}
              <div
                role="group"
                aria-label="Catalog View Mode"
                className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700"
              >
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 leading-relaxed ${
                    viewMode === 'grid'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{language === 'dv' ? 'ގްރިޑް' : 'Grid'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 leading-relaxed ${
                    viewMode === 'table'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{language === 'dv' ? 'ތާވަލު' : 'Table'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('shelf')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 leading-relaxed ${
                    viewMode === 'shelf'
                      ? 'bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 font-black shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Library className="w-3.5 h-3.5" />
                  <span>{language === 'dv' ? 'ރެކު' : 'Shelf'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Row 3: Multi-Facet Filter Checkboxes (Status, Language, Grade) with Live Counts */}
          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {/* Availability Checkboxes */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                  {language === 'dv' ? 'ޙާލަތު:' : 'Status:'}
                </span>
                {(
                  [
                    {
                      key: 'available' as const,
                      labelEn: 'Available',
                      labelDv: 'ލިބެންހުރި',
                      count: facetCounts.available,
                      activeClass:
                        'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-extrabold shadow-2xs',
                      iconClass: 'text-emerald-600',
                    },
                    {
                      key: 'checked-out' as const,
                      labelEn: 'Checked Out',
                      labelDv: 'ދޫކޮށްފައި',
                      count: facetCounts.checkedOut,
                      activeClass:
                        'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800 font-extrabold shadow-2xs',
                      iconClass: 'text-amber-600',
                    },
                    {
                      key: 'reference' as const,
                      labelEn: 'Reference',
                      labelDv: 'ރެފަރެންސް',
                      count: facetCounts.reference,
                      activeClass:
                        'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border-indigo-300 dark:border-indigo-800 font-extrabold shadow-2xs',
                      iconClass: 'text-indigo-600',
                    },
                  ] as const
                ).map((st) => {
                  const checked = selectedStatuses.includes(st.key);
                  return (
                    <button
                      key={st.key}
                      type="button"
                      onClick={() => toggleStatus(st.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition font-bold text-[11px] cursor-pointer leading-relaxed ${
                        checked
                          ? st.activeClass
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className={`w-3.5 h-3.5 ${st.iconClass}`} />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{language === 'dv' ? st.labelDv : st.labelEn}</span>
                      <span className="font-mono tabular-nums text-[10px] opacity-75">
                        (<bdi dir="ltr">{st.count}</bdi>)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Language Checkboxes */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                  {language === 'dv' ? 'ބަސް:' : 'Language:'}
                </span>
                {(
                  [
                    {
                      key: 'Dhivehi',
                      label: 'ދިވެހި',
                      activeClass:
                        'bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800 font-extrabold shadow-2xs',
                      iconClass: 'text-purple-600',
                    },
                    {
                      key: 'English',
                      label: 'English',
                      activeClass:
                        'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-300 dark:border-sky-800 font-extrabold shadow-2xs',
                      iconClass: 'text-sky-600',
                    },
                    {
                      key: 'Arabic',
                      label: 'العربية',
                      activeClass:
                        'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800 font-extrabold shadow-2xs',
                      iconClass: 'text-emerald-600',
                    },
                  ] as const
                ).map((lng) => {
                  const checked = selectedLanguages.includes(lng.key);
                  return (
                    <button
                      key={lng.key}
                      type="button"
                      onClick={() => toggleLanguage(lng.key)}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border transition font-bold text-[11px] cursor-pointer leading-relaxed ${
                        checked
                          ? lng.activeClass
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className={`w-3.5 h-3.5 ${lng.iconClass}`} />
                      ) : (
                        <Square className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      <span>{lng.label}</span>
                      <span className="font-mono tabular-nums text-[10px] opacity-75">
                        (<bdi dir="ltr">{facetCounts.byLanguage[lng.key] || 0}</bdi>)
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Grade Suitability Multi-facet Filter */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px]">
                  {language === 'dv' ? 'ގްރޭޑް:' : 'Grade:'}
                </span>
                {[
                  'Primary (Grades 1-5)',
                  'Middle (Grades 6-8)',
                  'Secondary (Grades 9-12)',
                ].map((gr) => {
                  const checked = selectedGrades.includes(gr);
                  return (
                    <button
                      key={gr}
                      type="button"
                      onClick={() => toggleGrade(gr)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition font-bold text-[11px] cursor-pointer leading-relaxed ${
                        checked
                          ? 'bg-teal-50 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 border-teal-300 dark:border-teal-800 font-extrabold'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      {checked ? (
                        <CheckSquare className="w-3 h-3 text-teal-600" />
                      ) : (
                        <Square className="w-3 h-3 text-slate-400" />
                      )}
                      <span>{gr.split(' ')[0]}</span>
                      <span className="font-mono tabular-nums opacity-75">
                        (<bdi dir="ltr">{facetCounts.byGrade[gr] || 0}</bdi>)
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 dark:text-slate-400 self-end md:self-auto shrink-0">
              <span>
                {language === 'dv' ? 'ފެންނަނީ:' : 'Showing:'}{' '}
                <bdi dir="ltr" className="font-mono text-slate-900 dark:text-white font-extrabold">
                  {filteredBooks.length}
                </bdi>{' '}
                / <bdi dir="ltr" className="font-mono">{books.length}</bdi>
              </span>
            </div>
          </div>

          {/* Active Filter Chips Bar with Individual × Dismiss & Clear All Filters */}
          {activeFilterCount > 0 && (
            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {language === 'dv' ? 'ހޮވާފައިވާ ފިލްޓަރުތައް:' : 'Active Filters:'}
              </span>
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800 text-xs font-bold leading-relaxed"
                >
                  <span className="text-[10px] uppercase tracking-wider opacity-70">
                    {chip.group}:
                  </span>
                  <bdi>{chip.label}</bdi>
                  <button
                    type="button"
                    onClick={chip.onRemove}
                    className="ms-0.5 p-0.5 rounded-full hover:bg-emerald-200/70 dark:hover:bg-emerald-800 text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                    aria-label={`Remove ${chip.label}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={clearAllFilters}
                className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-xs font-extrabold transition cursor-pointer leading-relaxed"
              >
                <XCircle className="w-3.5 h-3.5" />
                <span>{language === 'dv' ? 'ހުރިހާ ފިލްޓަރެއް ފޮހެލާ' : 'Clear All Filters'}</span>
              </button>
            </div>
          )}
        </div>
      </SectionErrorBoundary>

      {/* PUBLIC OPAC LIVE CLASS & HOUSE READING STANDINGS */}
      {!isLoading && activeFilterCount === 0 && users.length > 0 && (
        <TopReadingClassesWidget
          users={users}
          loans={loans}
          books={books}
          onOpenChallenges={onOpenChallenges}
        />
      )}

      {/* SECTION 2: CATALOG RESULTS (Wrapped in independent ErrorBoundary) */}
      <div ref={resultsContainerRef} className="space-y-6">
        <SectionErrorBoundary
          areaNameEn="Catalog Book Results"
          areaNameDv="ފޮތްތަކުގެ ނަތީޖާ"
          language={language}
          isAdmin={isSuperAdmin}
          onRecover={clearAllFilters}
        >
          {/* SKELETON LOADING STATE — Never flash "No books found" while loading */}
          {isLoading &&
            (viewMode === 'table' ? (
              <CatalogTableSkeleton rows={6} />
            ) : (
              <CatalogGridSkeleton count={8} />
            ))}

          {/* DISCOVERY SHELVES ABOVE GRID/TABLE WHEN BROWSING UNFILTERED */}
          {!isLoading && activeFilterCount === 0 && viewMode !== 'shelf' && books.length > 0 && (
            renderDiscoveryShelves()
          )}

          {/* SHELF VIEW (Curated Discovery Shelves + Grouped Physical Shelf Racks of filteredBooks) */}
          {!isLoading && viewMode === 'shelf' && filteredBooks.length > 0 && (
            <div className="space-y-6">
              {activeFilterCount === 0 && renderDiscoveryShelves()}

              <div className="space-y-5">
                <div className="flex items-center justify-between flex-wrap gap-2 px-1">
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 leading-relaxed">
                    <Library className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    <span>
                      {language === 'dv'
                        ? 'ލައިބްރަރީ ރެކުތަކުގައި ފޮތްތައް ހުރި ގޮތް'
                        : 'Browse by Physical Shelf Rack'}
                    </span>
                  </h3>
                  <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400 font-bold">
                    <bdi dir="ltr">
                      {filteredByShelfGroups.length} shelves · {filteredBooks.length} titles
                    </bdi>
                  </span>
                </div>

                {filteredByShelfGroups.map(([shelfName, shelfBooks]) => (
                  <section
                    key={shelfName}
                    className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl p-4 sm:p-5 space-y-3 shadow-xs"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                        <h4 className="font-black text-sm text-slate-900 dark:text-white leading-relaxed">
                          <bdi>{shelfName}</bdi>
                        </h4>
                      </div>
                      <span className="text-[11px] font-mono tabular-nums font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                        <bdi dir="ltr">{shelfBooks.length} items</bdi>
                      </span>
                    </div>

                    <div className="flex gap-3.5 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-none">
                      {shelfBooks.map((book) => {
                        const qStats = getQueueStats(book.id);
                        return (
                          <div
                            key={book.id}
                            onClick={() => setSelectedBook(book)}
                            className="w-36 sm:w-40 shrink-0 snap-start bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 rounded-2xl overflow-hidden hover:border-emerald-500 transition cursor-pointer group flex flex-col"
                          >
                            <div className="aspect-[2/3] w-full relative overflow-hidden bg-slate-200 dark:bg-slate-800">
                              <BookCover
                                src={book.coverUrl}
                                title={book.title}
                                author={book.author}
                                ddcCallNumber={book.ddcCallNumber}
                                category={book.category}
                                size="sm"
                                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                              />
                              <div className="absolute bottom-1.5 start-1.5 end-1.5 flex items-center justify-between">
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-bold text-white ${
                                    book.isReferenceOnly
                                      ? 'bg-sky-700/90'
                                      : book.availableCopies > 0
                                      ? 'bg-emerald-700/90'
                                      : 'bg-amber-600/90'
                                  }`}
                                >
                                  <bdi dir="ltr">
                                    {book.isReferenceOnly
                                      ? 'REF'
                                      : `${book.availableCopies}/${book.totalCopies}`}
                                  </bdi>
                                </span>
                                {qStats.totalHolds > 0 && (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-slate-900/80 text-amber-300">
                                    <bdi dir="ltr">{qStats.totalHolds}h</bdi>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="p-2.5 space-y-1 flex-1 flex flex-col justify-between">
                              <h5 className="text-xs font-bold text-slate-900 dark:text-white line-clamp-2 leading-relaxed">
                                <bdi>{book.title}</bdi>
                              </h5>
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                <bdi dir="ltr">{book.ddcCallNumber || book.isbn}</bdi>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* GRID VIEW */}
          {!isLoading && viewMode === 'grid' && filteredBooks.length > 0 && (
            <div className="space-y-4">
              {/* Mobile Swipe / Stack Control Pill */}
              <div className="sm:hidden flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 p-2.5 rounded-2xl shadow-xs">
                <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                  {mobileSwipeMode === 'swipe'
                    ? language === 'dv'
                      ? 'ކާޑުތައް ހުރަހަށް ކައްސާލާ (Swipe)'
                      : 'Swipe cards horizontally'
                    : language === 'dv'
                    ? 'ކާޑުތައް ތިރިއަށް ބައްލަވާ (Stack)'
                    : 'Single column cards'}
                </span>
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setMobileSwipeMode('swipe')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition cursor-pointer ${
                      mobileSwipeMode === 'swipe'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {language === 'dv' ? 'ސްވައިޕް' : 'Swipe'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileSwipeMode('stack')}
                    className={`px-2.5 py-1 text-[10px] font-black rounded-lg transition cursor-pointer ${
                      mobileSwipeMode === 'stack'
                        ? 'bg-emerald-700 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {language === 'dv' ? 'ލިސްޓް' : 'List'}
                  </button>
                </div>
              </div>

              {/* DESKTOP VIEW: 4-COLUMN RESPONSIVE GRID */}
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
                          <BookCover
                            src={book.coverUrl}
                            title={book.title}
                            author={book.author}
                            ddcCallNumber={book.ddcCallNumber}
                            category={book.category}
                            size="md"
                            aspectRatio="none"
                            className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/25 to-transparent pointer-events-none" />

                          {/* Single subtle top status indicator */}
                          <div className="absolute top-3 end-3">
                            {book.isReferenceOnly ? (
                              <span className="bg-sky-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
                                {language === 'dv' ? 'ރެފަރެންސް' : 'Reference'}
                              </span>
                            ) : book.availableCopies > 0 ? (
                              <span className="bg-emerald-700 text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
                                <bdi dir="ltr" className="font-mono tabular-nums">
                                  {book.availableCopies}/{book.totalCopies}
                                </bdi>{' '}
                                {language === 'dv' ? 'ލިބެންހުރި' : 'Avail'}
                              </span>
                            ) : (
                              <span className="bg-amber-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md">
                                {language === 'dv' ? 'ދޫކުރެވިފައި' : 'Checked Out'}
                              </span>
                            )}
                          </div>

                          {/* Title & Author on Cover bottom */}
                          <div className="absolute bottom-3 inset-x-3.5 text-white">
                            <h3 className="font-bold text-sm line-clamp-1 group-hover:text-emerald-300 transition leading-relaxed">
                              <bdi>{book.title}</bdi>
                            </h3>
                            <p className="text-xs text-slate-200 line-clamp-1 leading-relaxed">
                              <bdi>{book.author}</bdi>
                            </p>
                          </div>
                        </div>

                        {/* Clean Details Section */}
                        <div className="p-4 space-y-2 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="truncate text-[11px] leading-relaxed">
                              {book.isReferenceOnly ? (
                                language === 'dv' ? (
                                  <>
                                    ރެފަރެންސް —{' '}
                                    <bdi dir="ltr" className="font-mono">
                                      {book.shelfLocation}
                                    </bdi>
                                  </>
                                ) : (
                                  <>
                                    In-Library Use —{' '}
                                    <bdi dir="ltr" className="font-mono">
                                      {book.shelfLocation}
                                    </bdi>
                                  </>
                                )
                              ) : language === 'dv' ? (
                                <>
                                  <bdi dir="ltr" className="font-mono tabular-nums">
                                    {book.totalCopies}
                                  </bdi>{' '}
                                  ގެ ތެރެއިން{' '}
                                  <bdi dir="ltr" className="font-mono tabular-nums">
                                    {book.availableCopies}
                                  </bdi>{' '}
                                  ކޮޕީ ލިބެންހުރި —{' '}
                                  <bdi dir="ltr" className="font-mono">
                                    {book.shelfLocation}
                                  </bdi>
                                </>
                              ) : (
                                <>
                                  <span className="font-mono tabular-nums">
                                    {book.availableCopies}
                                  </span>{' '}
                                  of{' '}
                                  <span className="font-mono tabular-nums">
                                    {book.totalCopies}
                                  </span>{' '}
                                  copies available —{' '}
                                  <bdi dir="ltr" className="font-mono">
                                    {book.shelfLocation}
                                  </bdi>
                                </>
                              )}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate leading-relaxed">
                            <span>{localizeCategory(book.category)}</span>
                            {book.ddcCallNumber && (
                              <>
                                {' '}
                                ·{' '}
                                <span className="font-mono">
                                  <bdi dir="ltr">{book.ddcCallNumber}</bdi>
                                </span>
                              </>
                            )}
                            {book.targetGrade && (
                              <>
                                {' '}
                                · <span>{book.targetGrade}</span>
                              </>
                            )}
                          </div>

                          <p className="text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed text-xs">
                            <bdi>{book.description}</bdi>
                          </p>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                            <span>
                              ISBN{' '}
                              <bdi dir="ltr" className="font-mono tabular-nums text-slate-800 dark:text-slate-200">
                                {book.isbn}
                              </bdi>
                            </span>
                            {qStats.totalHolds > 0 && (
                              <span className="text-amber-700 dark:text-amber-400 font-semibold">
                                <bdi dir="ltr" className="font-mono tabular-nums">
                                  {qStats.totalHolds} {qStats.totalHolds === 1 ? 'hold' : 'holds'}
                                </bdi>
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
                            className="flex-1 bg-sky-100 dark:bg-sky-950/50 hover:bg-sky-200 text-sky-900 dark:text-sky-200 border border-sky-300 dark:border-sky-800 font-bold text-xs py-2 px-3 rounded-xl text-center transition flex items-center justify-center gap-1 cursor-pointer leading-relaxed"
                          >
                            <BookMarked className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                            <span>
                              {language === 'dv' ? 'ރެފަރެންސް މައުލޫމާތު' : 'Reference Desk'}
                            </span>
                          </button>
                        ) : (
                          <>
                            {isReserved ? (
                              <div className="flex-1 flex items-center gap-1">
                                <span className="flex-1 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold py-2 px-2 rounded-xl text-center flex items-center justify-center gap-1">
                                  <Bookmark className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                                  <span>
                                    {language === 'dv' ? (
                                      <>
                                        ކިއު{' '}
                                        <bdi dir="ltr" className="font-mono tabular-nums">
                                          #{qStats.userPosition}
                                        </bdi>
                                      </>
                                    ) : (
                                      `Hold #${qStats.userPosition} in queue`
                                    )}
                                  </span>
                                </span>
                                {onCancelReservation && qStats.userReservation && (
                                  <button
                                    type="button"
                                    onClick={() => onCancelReservation(qStats.userReservation!.id)}
                                    className="bg-rose-600 hover:bg-rose-700 text-white p-2 rounded-xl text-xs font-bold transition cursor-pointer shrink-0"
                                    title={
                                      language === 'dv'
                                        ? 'ރިޒަވޭޝަން ކެންސަލް ކުރައްވާ'
                                        : 'Cancel Hold'
                                    }
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleReserveWithFeedback(book)}
                                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-2 px-3 rounded-xl text-center transition flex items-center justify-center gap-1 cursor-pointer active:scale-95 leading-relaxed"
                              >
                                <Bookmark className="w-3.5 h-3.5" />
                                <span>
                                  {book.availableCopies > 0
                                    ? language === 'dv'
                                      ? 'ނަންނޯޓު ކުރައްވާ'
                                      : 'Reserve Hold'
                                    : language === 'dv'
                                    ? 'ކިއުއަށް ވަންނަވާ'
                                    : `Join Queue (${qStats.totalHolds})`}
                                </span>
                              </button>
                            )}

                            {can('circulation:checkout') && (
                              <button
                                type="button"
                                onClick={() => onOpenCheckoutForBook(book)}
                                className="bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs py-2 px-3 rounded-xl text-center transition shrink-0 cursor-pointer leading-relaxed"
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

              {/* MOBILE VIEW: SWIPE OR STACK */}
              <div className="sm:hidden">
                {mobileSwipeMode === 'swipe' ? (
                  <div className="flex overflow-x-auto snap-x snap-mandatory gap-4 pb-4 px-1 scrollbar-none safe-bottom">
                    {paginatedBooks.map((book) => {
                      const isReserved = isAlreadyReservedByUser(book.id);

                      return (
                        <div
                          key={book.id}
                          className="min-w-[85vw] max-w-[340px] snap-center shrink-0 bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-sm flex flex-col justify-between overflow-hidden"
                        >
                          <div>
                            <div className="relative h-64 bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <BookCover
                                src={book.coverUrl}
                                title={book.title}
                                author={book.author}
                                ddcCallNumber={book.ddcCallNumber}
                                category={book.category}
                                size="md"
                                aspectRatio="none"
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent pointer-events-none" />

                              <div className="absolute top-3 start-3 end-3 flex justify-between items-start gap-1">
                                <span className="bg-slate-900/85 backdrop-blur-md text-white text-[10px] font-bold px-2 py-1 rounded-md shadow border border-white/10">
                                  {localizeCategory(book.category)}
                                </span>

                                {book.isReferenceOnly ? (
                                  <span className="bg-sky-600 text-white text-[10px] font-black px-2 py-1 rounded-md shadow flex items-center gap-1">
                                    <BookMarked className="w-3 h-3" />
                                    <bdi>{language === 'dv' ? 'ރެފަރެންސް' : 'REFERENCE'}</bdi>
                                  </span>
                                ) : book.availableCopies > 0 ? (
                                  <span className="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">
                                    <CheckCircle className="w-3 h-3" />
                                    <bdi dir="ltr">{book.availableCopies}</bdi>{' '}
                                    {language === 'dv' ? 'ލިބެންހުރި' : 'Available'}
                                  </span>
                                ) : (
                                  <span className="bg-amber-500 text-white text-[10px] font-bold px-2 py-1 rounded-md shadow flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    <bdi>{language === 'dv' ? 'ދޫކުރެވިފައި' : 'Checked Out'}</bdi>
                                  </span>
                                )}
                              </div>

                              <div className="absolute bottom-3 inset-x-3 text-white">
                                <h3 className="font-black text-base line-clamp-1 leading-relaxed">
                                  <bdi>{book.title}</bdi>
                                </h3>
                                <p className="text-xs text-slate-200 line-clamp-1 font-medium leading-relaxed">
                                  {language === 'dv' ? 'މުސަންނިފު:' : 'by'}{' '}
                                  <bdi>{book.author}</bdi>
                                </p>
                              </div>
                            </div>

                            <div className="p-4 space-y-2 text-xs">
                              <div className="flex items-center text-slate-600 dark:text-slate-300 gap-1 font-semibold">
                                <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate">
                                  <bdi dir="ltr">{book.shelfLocation}</bdi>
                                </span>
                              </div>

                              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800 font-semibold">
                                <span>
                                  ISBN:{' '}
                                  <bdi dir="ltr" className="font-mono text-slate-800 dark:text-slate-200">
                                    {book.isbn}
                                  </bdi>
                                </span>
                                <span>
                                  Copies:{' '}
                                  <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-slate-200">
                                    {book.availableCopies}/{book.totalCopies}
                                  </bdi>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="p-4 bg-slate-50/90 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedBook(book)}
                              className="p-2 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs cursor-pointer"
                              title="Details"
                            >
                              <Eye className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                            </button>

                            {book.isReferenceOnly ? (
                              <button
                                type="button"
                                onClick={onViewReferenceOnly}
                                className="flex-1 bg-sky-100 text-sky-900 border border-sky-300 font-bold text-xs py-2 px-3 rounded-xl text-center cursor-pointer"
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
                                className="flex-1 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs py-2 px-3 rounded-xl text-center transition shadow-xs cursor-pointer"
                              >
                                <span>
                                  {language === 'dv' ? 'ނަންނޯޓު ކުރައްވާ' : 'Reserve Book'}
                                </span>
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
                          className="bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 rounded-3xl shadow-xs overflow-hidden flex flex-col"
                        >
                          <div className="flex p-3.5 gap-3.5 items-center">
                            <div className="w-16 h-22 rounded-2xl shadow-xs border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0">
                              <BookCover
                                src={book.coverUrl}
                                title={book.title}
                                author={book.author}
                                ddcCallNumber={book.ddcCallNumber}
                                category={book.category}
                                size="sm"
                                aspectRatio="none"
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="flex-1 space-y-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {book.isReferenceOnly ? (
                                  <span className="bg-sky-100 text-sky-800 border border-sky-300 text-[9px] font-black px-2 py-0.5 rounded-md">
                                    REF ONLY
                                  </span>
                                ) : book.availableCopies > 0 ? (
                                  <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[9px] font-black px-2 py-0.5 rounded-md">
                                    <bdi dir="ltr">{book.availableCopies}</bdi> AVAILABLE
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[9px] font-black px-2 py-0.5 rounded-md">
                                    CHECKED OUT
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                                  {localizeCategory(book.category)}
                                </span>
                              </div>
                              <h4 className="font-extrabold text-slate-900 dark:text-white text-sm truncate leading-relaxed">
                                <bdi>{book.title}</bdi>
                              </h4>
                              <p className="text-xs text-slate-600 dark:text-slate-300 truncate leading-relaxed">
                                By <bdi>{book.author}</bdi>
                              </p>
                              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                                Location: <bdi dir="ltr">{book.shelfLocation}</bdi>
                              </p>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-50/90 dark:bg-slate-800/40 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedBook(book)}
                              className="p-2 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            </button>
                            {!book.isReferenceOnly && (
                              <button
                                type="button"
                                onClick={() => handleReserveWithFeedback(book)}
                                disabled={isReserved}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-extrabold text-center transition cursor-pointer ${
                                  isReserved
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 cursor-not-allowed'
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

              {/* Grid Pagination Bar */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200/90 dark:border-slate-800">
                  <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {language === 'dv' ? (
                      <span>
                        <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                          {filteredBooks.length}
                        </bdi>{' '}
                        ފޮތުގެ ތެރެއިން{' '}
                        <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                          {startIndex + 1}
                        </bdi>{' '}
                        އިން{' '}
                        <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                          {Math.min(currentPage * entriesPerPage, filteredBooks.length)}
                        </bdi>{' '}
                        އަށް ދައްކަނީ
                      </span>
                    ) : (
                      <span>
                        Showing{' '}
                        <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                          {startIndex + 1}
                        </bdi>{' '}
                        to{' '}
                        <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                          {Math.min(currentPage * entriesPerPage, filteredBooks.length)}
                        </bdi>{' '}
                        of{' '}
                        <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                          {filteredBooks.length}
                        </bdi>{' '}
                        books
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {language === 'dv' ? 'ކުރީގެ' : 'Previous'}
                    </button>
                    {Array.from({ length: totalPages }).map((_, i) => {
                      if (
                        totalPages > 8 &&
                        Math.abs(currentPage - (i + 1)) > 3 &&
                        i !== 0 &&
                        i !== totalPages - 1
                      ) {
                        return null;
                      }
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setCurrentPage(i + 1)}
                          className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition cursor-pointer ${
                            currentPage === i + 1
                              ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          <bdi dir="ltr" className="font-mono">
                            {i + 1}
                          </bdi>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                    >
                      {language === 'dv' ? 'ކުރިއަށް' : 'Next'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TABLE VIEW (HIGH-DENSITY SORTABLE TABLE WITH BULK ACTIONS) */}
          {!isLoading && viewMode === 'table' && filteredBooks.length > 0 && (
            <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm space-y-4 p-5 sm:p-6">
              {/* Header Title */}
              <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h2 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2 leading-relaxed">
                    <span className="p-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                      <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
                    </span>
                    <span>{t.catalog}</span>
                  </h2>
                </div>

                <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  <bdi dir="ltr" className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {filteredBooks.length}
                  </bdi>{' '}
                  {language === 'dv' ? 'ފޮތް ފެނިފައިވޭ' : 'items filtered'}
                </div>
              </div>

              {/* Bulk Selection Action Bar */}
              {selectedTableIds.length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-900 dark:bg-emerald-950/70 text-white border border-slate-800 dark:border-emerald-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold">
                    <bdi dir="ltr" className="font-mono tabular-nums">
                      {selectedTableIds.length}
                    </bdi>{' '}
                    {language === 'dv' ? 'ފޮތް ޚިޔާރުކުރެވިފައި' : 'selected'}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleBulkExportCsv}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        exportToMarc21(
                          selectedTableBooks,
                          `magoodhoo-selected-${selectedTableBooks.length}.mrk`
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>MARC21</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        printBarcodeStickerSheet(
                          selectedTableBooks.map((b) => ({
                            title: b.title,
                            code: b.barcode || b.isbn,
                            ddcCallNumber: b.ddcCallNumber,
                            shelfLocation: b.shelfLocation,
                            isReferenceOnly: b.isReferenceOnly,
                          })),
                          `Catalog Barcodes (${selectedTableBooks.length})`
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>{language === 'dv' ? 'ބާކޯޑް ޕްރިންޓް' : 'Print Barcodes'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedTableIds([])}
                      className="px-2.5 py-1.5 rounded-lg bg-transparent hover:bg-white/10 text-slate-300 font-bold cursor-pointer"
                    >
                      {language === 'dv' ? 'ދޫކޮށްލާ' : 'Clear'}
                    </button>
                  </div>
                </div>
              )}

              {/* Table Controls Top Row: Entries Dropdown & Search Input */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                  <span>{language === 'dv' ? 'ދައްކާ:' : 'Show'}</span>
                  <select
                    value={entriesPerPage}
                    onChange={(e) => setEntriesPerPage(Number(e.target.value))}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-2 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-sm cursor-pointer"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={250}>250</option>
                    <option value={500}>500</option>
                    <option value={10000}>
                      {language === 'dv' ? 'ހުރިހާ' : 'All'} ({filteredBooks.length.toLocaleString()})
                    </option>
                  </select>
                  <span>{language === 'dv' ? 'އައިޓަމް' : 'entries per page'}</span>
                </div>

                <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 w-full sm:w-auto">
                  <span>{language === 'dv' ? 'ހޯއްދަވާ:' : 'Search:'}</span>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={language === 'dv' ? 'ފޮތުގެ ނަމުން...' : 'Filter table...'}
                    className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md px-3 py-1.5 text-xs font-medium text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-600 shadow-sm w-full sm:w-48 leading-relaxed"
                  />
                </div>
              </div>

              {/* Main Table with Sticky Sortable Headers */}
              <div className="overflow-x-auto border border-slate-200/90 dark:border-slate-800 rounded-2xl max-h-[70vh]">
                <table className="w-full text-start text-xs text-slate-800 dark:text-slate-200 border-collapse">
                  <thead className="bg-slate-900 text-white font-extrabold border-b border-slate-800 sticky top-0 z-20 shadow-xs">
                    <tr>
                      <th className="p-3 border-e border-slate-800 w-10 text-center">
                        <button
                          type="button"
                          onClick={toggleSelectAllOnPage}
                          className="text-slate-300 hover:text-white cursor-pointer inline-flex items-center"
                          aria-label="Select all books on page"
                        >
                          {paginatedBooks.length > 0 &&
                          paginatedBooks.every((b) => selectedTableIds.includes(b.id)) ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </th>
                      <th className="p-3.5 border-e border-slate-800">
                        <button
                          type="button"
                          onClick={() => toggleSort('title')}
                          className="inline-flex items-center gap-1 cursor-pointer hover:text-emerald-300"
                        >
                          <span>{language === 'dv' ? 'ފޮތުގެ ނަން' : 'Title'}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-75" />
                        </button>
                      </th>
                      <th className="p-3.5 border-e border-slate-800">
                        <button
                          type="button"
                          onClick={() => toggleSort('author')}
                          className="inline-flex items-center gap-1 cursor-pointer hover:text-emerald-300"
                        >
                          <span>{language === 'dv' ? 'މުސަންނިފު' : 'Author'}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-75" />
                        </button>
                      </th>
                      <th className="p-3.5 border-e border-slate-800">
                        <button
                          type="button"
                          onClick={() => toggleSort('ddc')}
                          className="inline-flex items-center gap-1 cursor-pointer hover:text-emerald-300"
                        >
                          <span>{language === 'dv' ? 'އައި.އެސް.ބީ.އެން / DDC' : 'ISBN / DDC'}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-75" />
                        </button>
                      </th>
                      <th className="p-3.5 border-e border-slate-800">
                        <button
                          type="button"
                          onClick={() => toggleSort('shelf')}
                          className="inline-flex items-center gap-1 cursor-pointer hover:text-emerald-300"
                        >
                          <span>{language === 'dv' ? 'ބައި / ރެކު' : 'Genre & Shelf'}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-75" />
                        </button>
                      </th>
                      <th className="p-3.5 border-e border-slate-800 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSort('total')}
                          className="inline-flex items-center gap-1 cursor-pointer hover:text-emerald-300"
                        >
                          <span>{language === 'dv' ? 'ޖުމްލަ' : 'Total'}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-75" />
                        </button>
                      </th>
                      <th className="p-3.5 border-e border-slate-800 text-center">
                        <button
                          type="button"
                          onClick={() => toggleSort('available')}
                          className="inline-flex items-center gap-1 cursor-pointer hover:text-emerald-300"
                        >
                          <span>{language === 'dv' ? 'ލިބެންހުރި' : 'Available'}</span>
                          <ArrowUpDown className="w-3 h-3 opacity-75" />
                        </button>
                      </th>
                      <th className="p-3.5 text-center">
                        {language === 'dv' ? 'ޢަމަލުތައް' : 'Actions'}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {paginatedBooks.map((book) => {
                      const isReserved = isAlreadyReservedByUser(book.id);
                      const isChecked = selectedTableIds.includes(book.id);

                      return (
                        <tr
                          key={book.id}
                          className={`transition ${
                            isChecked
                              ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="p-3 border-e border-slate-200 dark:border-slate-800 text-center">
                            <button
                              type="button"
                              onClick={() => toggleTableSelection(book.id)}
                              className="text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 cursor-pointer inline-flex items-center"
                              aria-label={`Select ${book.title}`}
                            >
                              {isChecked ? (
                                <CheckSquare className="w-4 h-4 text-emerald-600" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>
                          </td>
                          {/* Title Column */}
                          <td className="p-3.5 border-e border-slate-200 dark:border-slate-800">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-12 rounded-md shadow-sm shrink-0 border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <BookCover
                                  src={book.coverUrl}
                                  title={book.title}
                                  author={book.author}
                                  ddcCallNumber={book.ddcCallNumber}
                                  category={book.category}
                                  size="xs"
                                  aspectRatio="none"
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => setSelectedBook(book)}
                                  className="font-extrabold text-slate-900 dark:text-white hover:text-emerald-700 dark:hover:text-emerald-400 text-xs sm:text-sm block text-start cursor-pointer leading-relaxed"
                                >
                                  <bdi>{book.title}</bdi>
                                </button>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                                  <bdi dir="ltr">{book.mediaType || 'Book'}</bdi> ·{' '}
                                  <bdi dir="ltr">{book.bookLanguage || 'English'}</bdi>
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Author Column */}
                          <td className="p-3.5 border-e border-slate-200 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-200 leading-relaxed">
                            <bdi>{book.author}</bdi>
                          </td>

                          {/* ISBN & Call Number Column */}
                          <td className="p-3.5 border-e border-slate-200 dark:border-slate-800 font-mono tabular-nums text-slate-700 dark:text-slate-300 font-semibold space-y-1">
                            <div className="text-slate-900 dark:text-white">
                              <bdi dir="ltr">{book.isbn}</bdi>
                            </div>
                            {book.ddcCallNumber && (
                              <div className="text-[10px] text-slate-700 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded inline-block">
                                <bdi dir="ltr">{book.ddcCallNumber}</bdi>
                              </div>
                            )}
                          </td>

                          {/* Genre & Shelf Column */}
                          <td className="p-3.5 border-e border-slate-200 dark:border-slate-800 font-medium text-slate-800 dark:text-slate-200 space-y-1">
                            <div className="text-[11px] font-bold leading-relaxed">
                              {localizeCategory(book.category)}
                            </div>
                            <div className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3 shrink-0" />
                              <bdi dir="ltr">{book.shelfLocation}</bdi>
                            </div>
                          </td>

                          {/* Total Copies Column */}
                          <td className="p-3.5 border-e border-slate-200 dark:border-slate-800 text-center font-bold text-slate-800 dark:text-slate-200">
                            <bdi dir="ltr" className="font-mono tabular-nums">
                              {book.totalCopies}
                            </bdi>
                          </td>

                          {/* Available Copies Column */}
                          <td className="p-3.5 border-e border-slate-200 dark:border-slate-800 text-center">
                            {book.isReferenceOnly ? (
                              <span className="bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-800 text-[10px] font-black px-2.5 py-1 rounded-md shadow-xs inline-block">
                                <bdi>{language === 'dv' ? 'ރެފަރެންސް' : 'Ref Only'}</bdi>
                              </span>
                            ) : book.availableCopies > 0 ? (
                              <span className="bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-black px-2.5 py-1 rounded-md shadow-xs inline-block min-w-[85px]">
                                <bdi dir="ltr" className="font-mono tabular-nums">
                                  {book.availableCopies}/{book.totalCopies}
                                </bdi>{' '}
                                {language === 'dv' ? 'ލިބެންހުރި' : 'Avail'}
                              </span>
                            ) : (
                              <span className="bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 text-[11px] font-black px-2.5 py-1 rounded-md shadow-xs inline-block min-w-[85px]">
                                <bdi>{language === 'dv' ? 'ދޫކުރެވިފައި' : 'Checked Out'}</bdi>
                              </span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="p-3.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setSelectedBook(book)}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition shadow-xs flex items-center gap-1 px-2.5 text-xs font-bold cursor-pointer"
                                title={language === 'dv' ? 'ތަފްޞީލު ބައްލަވާ' : 'View Book Details'}
                              >
                                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                                <span className="hidden sm:inline">
                                  {language === 'dv' ? 'ތަފްޞީލު' : 'Details'}
                                </span>
                              </button>

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
                                  title={
                                    isReserved
                                      ? language === 'dv'
                                        ? 'ނަންނޯޓު ކުރެވިފައި'
                                        : 'Reserved'
                                      : language === 'dv'
                                      ? 'ނަންނޯޓު ކުރައްވާ'
                                      : 'Reserve'
                                  }
                                >
                                  <Bookmark className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">
                                    {isReserved
                                      ? language === 'dv'
                                        ? 'ނޯޓުވެފައި'
                                        : 'Reserved'
                                      : language === 'dv'
                                      ? 'ނަންނޯޓު'
                                      : 'Reserve'}
                                  </span>
                                </button>
                              )}

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
                                  title={
                                    language === 'dv' ? 'ފޮތުގެ ރެކޯޑް ފޮހެލައްވާ' : 'Delete Book'
                                  }
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
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {language === 'dv' ? (
                    <span>
                      <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                        {filteredBooks.length}
                      </bdi>{' '}
                      ފޮތުގެ ތެރެއިން{' '}
                      <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                        {filteredBooks.length === 0 ? 0 : startIndex + 1}
                      </bdi>{' '}
                      އިން{' '}
                      <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                        {Math.min(currentPage * entriesPerPage, filteredBooks.length)}
                      </bdi>{' '}
                      އަށް ދައްކަނީ
                    </span>
                  ) : (
                    <span>
                      Showing{' '}
                      <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                        {filteredBooks.length === 0 ? 0 : startIndex + 1}
                      </bdi>{' '}
                      to{' '}
                      <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                        {Math.min(currentPage * entriesPerPage, filteredBooks.length)}
                      </bdi>{' '}
                      of{' '}
                      <bdi dir="ltr" className="font-mono font-bold text-slate-800 dark:text-white">
                        {filteredBooks.length}
                      </bdi>{' '}
                      books
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    {language === 'dv' ? 'ކުރީގެ' : 'Previous'}
                  </button>

                  {Array.from({ length: totalPages }).map((_, i) => {
                    if (
                      totalPages > 8 &&
                      Math.abs(currentPage - (i + 1)) > 3 &&
                      i !== 0 &&
                      i !== totalPages - 1
                    ) {
                      return null;
                    }

                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentPage(i + 1)}
                        className={`px-3 py-1.5 text-xs font-bold rounded border transition cursor-pointer ${
                          currentPage === i + 1
                            ? 'bg-emerald-700 text-white border-emerald-700 shadow-sm'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }`}
                      >
                        <bdi dir="ltr" className="font-mono">
                          {i + 1}
                        </bdi>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition cursor-pointer"
                  >
                    {language === 'dv' ? 'ކުރިއަށް' : 'Next'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* SMART EMPTY STATE — ONLY shown when !isLoading && filteredBooks.length === 0 */}
          {!isLoading && filteredBooks.length === 0 && (
            <div className="text-center py-14 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 shadow-sm space-y-4">
              <BookOpen className="w-12 h-12 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-relaxed">
                  {t.noBooksFound}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto font-medium leading-relaxed">
                  {t.searchEmptyHint}
                </p>
              </div>

              {emptyStateSuggestions.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {language === 'dv' ? 'އިތުރު ގޮތްތައް:' : 'Smart Filter Suggestions:'}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    {emptyStateSuggestions.map((s, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={s.apply}
                        className="px-3.5 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-bold transition cursor-pointer leading-relaxed"
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="px-4 py-2.5 bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer"
                >
                  {language === 'dv' ? 'ހުރިހާ ފިލްޓަރެއް ފޮހެލާ' : 'Clear All Filters'}
                </button>
              </div>
            </div>
          )}
        </SectionErrorBoundary>
      </div>

      {/* Slide-over Copy Inventory & MARC Drawer */}
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
          <div className="bg-white dark:bg-slate-900 w-full sm:max-w-xl h-full max-sm:h-auto max-sm:max-h-[92vh] max-sm:rounded-t-3xl shadow-2xl border-s border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 flex flex-col justify-between overflow-hidden">
            <div className="sm:hidden w-12 h-1 bg-slate-300 dark:bg-slate-700 rounded-md mx-auto my-2.5 shrink-0" />
            <div className="relative h-48 bg-slate-900 shrink-0">
              <BookCover
                src={selectedBook.coverUrl}
                title={selectedBook.title}
                author={selectedBook.author}
                ddcCallNumber={selectedBook.ddcCallNumber}
                category={selectedBook.category}
                size="lg"
                aspectRatio="none"
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
                <h3 className="text-lg font-black mt-1 text-white leading-relaxed">
                  <bdi>{selectedBook.title}</bdi>
                </h3>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">
                  {language === 'dv' ? 'މުސަންނިފު:' : 'by'} <bdi>{selectedBook.author}</bdi>
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4 text-xs text-slate-700 dark:text-slate-300 font-medium flex-1 overflow-y-auto">
              {selectedBook.isReferenceOnly && (
                <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2 text-amber-900 dark:text-amber-200">
                  <BookMarked className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-extrabold">
                      {language === 'dv'
                        ? 'ރެފަރެންސް ފޮތެއް (ދޫނުކުރެވޭ):'
                        : 'Reference Material (Non-Circulating):'}
                    </span>
                    <p className="text-[11px] mt-0.5 text-amber-800 dark:text-amber-300 font-medium leading-relaxed">
                      {language === 'dv'
                        ? 'މި ފޮތަކީ ލައިބްރަރީ ހޯލުގައި ކިޔުމަށް ޚާއްޞަކުރެވިފައިވާ ފޮތެކެވެ. ގެއަށް ގެންދިއުމަށް ދޫނުކުރެވޭނެއެވެ.'
                        : 'This volume is preserved for library desk reference only. Students may consult this volume inside the library reading hall.'}
                    </p>
                  </div>
                </div>
              )}

              <p className="leading-relaxed text-slate-700 dark:text-slate-300">
                <bdi>{selectedBook.description}</bdi>
              </p>

              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-[11px]">
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    ISBN
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    <bdi dir="ltr">{selectedBook.isbn}</bdi>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    Barcode ID
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    <bdi dir="ltr">{selectedBook.barcode}</bdi>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    Shelf Location
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    <bdi dir="ltr">{selectedBook.shelfLocation}</bdi>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    DDC Call Number
                  </span>
                  <span className="font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                    <bdi dir="ltr">{selectedBook.ddcCallNumber || 'DDC 000'}</bdi>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    Availability
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    <bdi dir="ltr">
                      {selectedBook.availableCopies} / {selectedBook.totalCopies}
                    </bdi>
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    Language
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    {selectedBook.bookLanguage || 'English'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="text-slate-500 dark:text-slate-400 block text-[10px] font-bold">
                    Publisher
                  </span>
                  <span className="font-bold text-slate-900 dark:text-white">
                    <bdi>{selectedBook.publisher}</bdi> (
                    <bdi dir="ltr">{selectedBook.publicationYear}</bdi>)
                  </span>
                </div>
              </div>

              {selectedBook.barcodeImageUrl && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Uploaded Book Barcode
                  </span>
                  <img
                    src={selectedBook.barcodeImageUrl}
                    alt="Barcode"
                    className="max-h-20 mx-auto object-contain border bg-white p-1 rounded shadow-xs"
                  />
                </div>
              )}

              {/* Parent-Child Physical Copy Inventory Table */}
              {selectedBook.copies && selectedBook.copies.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-emerald-700" />
                      {t.copyInventory} (
                      <bdi dir="ltr" className="font-mono tabular-nums">
                        {selectedBook.copies.length}
                      </bdi>
                      )
                    </span>
                    <span className="text-[11px] font-mono tabular-nums text-slate-500">
                      Holds:{' '}
                      <bdi dir="ltr">
                        {
                          reservations.filter(
                            (r) => r.bookId === selectedBook.id && r.status === 'pending'
                          ).length
                        }
                      </bdi>
                    </span>
                  </div>
                  <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-x-auto">
                    <table className="w-full text-start text-[11px]">
                      <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold uppercase border-b border-slate-200 dark:border-slate-700">
                        <tr>
                          <th className="py-2 px-2.5">Copy Barcode</th>
                          <th className="py-2 px-2.5">Accession / Rack</th>
                          <th className="py-2 px-2.5">Cond.</th>
                          <th className="py-2 px-2.5">MVR</th>
                          <th className="py-2 px-2.5 text-end">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {selectedBook.copies.map((cp) => (
                          <tr key={cp.copyId}>
                            <td className="py-2 px-2.5 font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                              <bdi dir="ltr">{cp.barcode}</bdi>
                            </td>
                            <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">
                              <div className="font-mono text-[10px] text-slate-800 dark:text-slate-200">
                                <bdi dir="ltr">{cp.accessionNumber || cp.copyId}</bdi>
                              </div>
                              <div className="text-[10px] text-slate-500">
                                <bdi dir="ltr">
                                  {cp.rackLocation || cp.shelfLocation || selectedBook.shelfLocation}
                                </bdi>
                              </div>
                            </td>
                            <td className="py-2 px-2.5 text-slate-600 dark:text-slate-300">
                              {cp.condition}
                            </td>
                            <td className="py-2 px-2.5 font-mono tabular-nums text-slate-600 dark:text-slate-300">
                              <bdi dir="ltr">{cp.acquisitionPriceMvr ?? 150}</bdi>
                            </td>
                            <td className="py-2 px-2.5 text-end">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${
                                  cp.status === 'Available'
                                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-800 border border-amber-200'
                                }`}
                              >
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

              {/* Collapsible MARC21 Record Preview */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowMarcDetails((prev) => !prev)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-[11px] font-bold text-slate-800 dark:text-slate-200 cursor-pointer"
                >
                  <span>MARC21 Bibliographic & Holdings Fields</span>
                  {showMarcDetails ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                {showMarcDetails && (
                  <div className="p-3 bg-slate-900 text-emerald-300 font-mono text-[11px] space-y-1 border-t border-slate-200 dark:border-slate-700 overflow-x-auto">
                    <div>
                      020 ## $a <bdi dir="ltr">{selectedBook.isbn}</bdi>
                    </div>
                    <div>
                      082 04 $a <bdi dir="ltr">{selectedBook.ddcCallNumber || '000'}</bdi>
                    </div>
                    <div>
                      100 1# $a <bdi>{selectedBook.author}</bdi>
                    </div>
                    <div>
                      245 10 $a <bdi>{selectedBook.title}</bdi>
                    </div>
                    <div>
                      260 ## $b <bdi>{selectedBook.publisher}</bdi> $c{' '}
                      <bdi dir="ltr">{selectedBook.publicationYear}</bdi>
                    </div>
                    <div>
                      852 ## $b Magoodhoo School $c <bdi dir="ltr">{selectedBook.shelfLocation}</bdi>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50/90 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2 safe-bottom flex-wrap shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                {!selectedBook.isReferenceOnly &&
                  (() => {
                    const dq = getQueueStats(selectedBook.id);
                    if (dq.userPosition > 0) {
                      return (
                        <div className="flex items-center gap-1.5">
                          <span className="px-3 py-2 bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5">
                            <Bookmark className="w-3.5 h-3.5 text-emerald-700" />
                            <span>
                              <bdi dir="ltr" className="font-mono tabular-nums">
                                #{dq.userPosition} of {dq.totalHolds}
                              </bdi>{' '}
                              in queue
                            </span>
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
                            ? language === 'dv'
                              ? 'ނަންނޯޓު ކުރައްވާ'
                              : 'Reserve Book'
                            : language === 'dv'
                            ? 'ކިއުއަށް ވަންނަވާ'
                            : `Join Hold Queue (${dq.totalHolds})`}
                        </span>
                      </button>
                    );
                  })()}
                <button
                  type="button"
                  onClick={() => exportToMarc21([selectedBook], `marc-${selectedBook.isbn}.mrk`)}
                  className="px-3 py-2 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
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
                className="px-4 py-2 bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-white rounded-xl text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-600 transition border border-slate-300 dark:border-slate-600 cursor-pointer"
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
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-800 space-y-4 text-slate-800 dark:text-slate-100">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-base text-slate-900 dark:text-white">
                  {language === 'dv' ? 'ފޮތް ފޮހެލުން' : 'Delete Book Record'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {language === 'dv'
                    ? 'މި ފޮތް ސިސްޓަމުން ފޮހެލަން ބޭނުންފުޅުތޯ؟'
                    : 'Are you sure you want to delete this book?'}
                </p>
              </div>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl text-xs space-y-1">
              <p className="font-bold text-slate-900 dark:text-white">
                <bdi>{bookToDelete.title}</bdi>
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                {language === 'dv' ? 'ލިޔުންތެރިޔާ:' : 'Author:'} <bdi>{bookToDelete.author}</bdi>
              </p>
              <p className="text-slate-500 font-mono">
                ISBN: <bdi dir="ltr">{bookToDelete.isbn}</bdi>
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setBookToDelete(null)}
                className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition cursor-pointer"
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
