import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Book, MediaType } from '../types';
import {
  getNormalizedBookSearchFields,
  normalizeCodeQuery,
  normalizeFacetLabel,
  normalizeQuery,
} from '../utils/thaanaNormalize';
import { CatalogUrlFilters, CatalogViewMode, normalizeCatalogView } from '../lib/urlState';
import { Language } from '../lib/i18n';

export const VIEW_MODE_STORAGE_KEY = 'magoodhoo_catalog_view_mode';

export type CatalogStatusFilter = 'available' | 'checked-out' | 'reference';
export type CirculationTypeFilter = 'all' | 'circulating' | 'reference';
export type CatalogSortOption =
  | 'title-asc'
  | 'title-desc'
  | 'author-asc'
  | 'author-desc'
  | 'ddc-asc'
  | 'ddc-desc'
  | 'shelf-asc'
  | 'shelf-desc'
  | 'total-desc'
  | 'total-asc'
  | 'available-desc'
  | 'available-asc'
  | 'newest';

export const STANDARD_MEDIA_TYPES: MediaType[] = [
  'Book',
  'E-Book',
  'Audiobook',
  'Periodical',
  'Board Game',
  'Video/DVD',
  'Educational Kit',
];

export const GRADE_BAND_OPTIONS = [
  { value: 'Primary (Grades 1-5)', labelEn: 'Primary (Grades 1-5)', labelDv: 'ޕްރައިމަރީ (ގްރޭޑް 1-5)' },
  { value: 'Middle (Grades 6-8)', labelEn: 'Middle (Grades 6-8)', labelDv: 'މިޑްލް ސްކޫލް (ގްރޭޑް 6-8)' },
  { value: 'Secondary (Grades 9-12)', labelEn: 'Secondary (Grades 9-12)', labelDv: 'ސެކަންޑަރީ (ގްރޭޑް 9-12)' },
  { value: 'All Ages', labelEn: 'All Ages / Faculty', labelDv: 'ހުރިހާ އުމުރަކަށް' },
] as const;

export interface CatalogFilterCriteria {
  q?: string;
  selectedCategories?: string[];
  selectedMediaTypes?: string[];
  selectedStatuses?: CatalogStatusFilter[];
  selectedGrades?: string[];
  selectedLanguages?: string[];
  selectedPublishers?: string[];
  circulationType?: CirculationTypeFilter;
  sortBy?: CatalogSortOption;
}

export interface CatalogFacetCounts {
  byCategory: Record<string, number>;
  byMedia: Record<string, number>;
  byGrade: Record<string, number>;
  byLanguage: Record<string, number>;
  byPublisher: Record<string, number>;
  available: number;
  checkedOut: number;
  reference: number;
  circulating: number;
}

export interface ActiveFilterChip {
  id: string;
  group: string;
  label: string;
  onRemove: () => void;
}

export interface EmptyStateSuggestion {
  label: string;
  count: number;
  apply: () => void;
}

function parseCsvParam(val?: string): string[] {
  if (!val || val === 'all') return [];
  return Array.from(
    new Set(
      val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s.toLowerCase() !== 'all')
    )
  );
}

function normalizeLanguageValue(raw: unknown): 'Dhivehi' | 'English' | 'Arabic' | 'Other' {
  const s = normalizeQuery(raw);
  if (s === 'dv' || s.includes('dhivehi') || s.includes('thaana')) return 'Dhivehi';
  if (s === 'ar' || s.includes('arabic')) return 'Arabic';
  if (s === 'other') return 'Other';
  return 'English';
}

function matchesGradeFacet(bookGradeRaw: unknown, filterGrade: string): boolean {
  const bookGrade = normalizeFacetLabel(bookGradeRaw);
  const target = normalizeFacetLabel(filterGrade);
  if (!target) return true;
  if (!bookGrade) return false;

  if (bookGrade.toLowerCase() === target.toLowerCase()) return true;
  if (bookGrade.toLowerCase() === 'all ages' && target.toLowerCase() !== 'all ages') return true;

  const numMatch = bookGrade.match(/\b(\d{1,2})\b/);
  const lowerBook = bookGrade.toLowerCase();
  const lowerTarget = target.toLowerCase();

  if (lowerTarget.startsWith('primary')) {
    if (lowerBook.includes('lkg') || lowerBook.includes('ukg') || lowerBook.includes('primary')) return true;
    if (numMatch) {
      const n = Number(numMatch[1]);
      return n >= 1 && n <= 5;
    }
  }
  if (lowerTarget.startsWith('middle')) {
    if (lowerBook.includes('middle')) return true;
    if (numMatch) {
      const n = Number(numMatch[1]);
      return n >= 6 && n <= 8;
    }
  }
  if (lowerTarget.startsWith('secondary')) {
    if (lowerBook.includes('secondary')) return true;
    if (numMatch) {
      const n = Number(numMatch[1]);
      return n >= 9 && n <= 12;
    }
  }

  return false;
}

/**
 * Pure, deterministic, null-safe selector pipeline for filtering and sorting catalog books.
 * Enforces OR within each multi-select facet and AND across active facets.
 */
export function selectFilteredBooks(books: Book[], criteria: CatalogFilterCriteria): Book[] {
  if (!Array.isArray(books) || books.length === 0) return [];

  const normQuery = normalizeQuery(criteria.q);
  const normCode = normalizeCodeQuery(criteria.q);
  const queryTokens = normQuery ? normQuery.split(' ').filter(Boolean) : [];

  const normCats = (criteria.selectedCategories || [])
    .map((c) => normalizeFacetLabel(c).toLowerCase())
    .filter(Boolean);
  const normMedia = (criteria.selectedMediaTypes || [])
    .map((m) => normalizeFacetLabel(m).toLowerCase())
    .filter(Boolean);
  const statuses = criteria.selectedStatuses || [];
  const grades = (criteria.selectedGrades || []).filter(Boolean);
  const normLangs = (criteria.selectedLanguages || [])
    .map((l) => normalizeLanguageValue(l))
    .filter(Boolean);
  const normPubs = (criteria.selectedPublishers || [])
    .map((p) => normalizeFacetLabel(p).toLowerCase())
    .filter(Boolean);
  const circType = criteria.circulationType || 'all';

  const filtered = books.filter((book) => {
    if (!book || typeof book !== 'object') return false;

    // 1. Bilingual + hyphen-insensitive code search
    if (queryTokens.length > 0 || normCode.length > 0) {
      const { textHaystack, codeHaystack } = getNormalizedBookSearchFields(book);
      const codeMatch = normCode.length >= 2 && codeHaystack.includes(normCode);
      const textMatch =
        queryTokens.length > 0 &&
        queryTokens.every((tok) => {
          const cleanTokCode = tok.replace(/[-\s_:./]+/g, '');
          return textHaystack.includes(tok) || (cleanTokCode.length >= 2 && codeHaystack.includes(cleanTokCode));
        });
      if (!codeMatch && !textMatch) return false;
    }

    // 2. Category (OR within selectedCategories)
    if (normCats.length > 0) {
      const bookCat = normalizeFacetLabel(book.category ?? '').toLowerCase();
      if (!normCats.includes(bookCat)) return false;
    }

    // 3. Media Type (OR within selectedMediaTypes)
    if (normMedia.length > 0) {
      const bookMedia = normalizeFacetLabel(book.mediaType || 'Book').toLowerCase();
      if (!normMedia.includes(bookMedia)) return false;
    }

    // 4. Circulation Type
    if (circType === 'reference' && !book.isReferenceOnly) return false;
    if (circType === 'circulating' && book.isReferenceOnly) return false;

    // 5. Availability Status (OR within selectedStatuses)
    if (statuses.length > 0) {
      const avail = Number(book.availableCopies ?? 0);
      const matchesAnyStatus = statuses.some((st) => {
        if (st === 'available') return avail > 0;
        if (st === 'checked-out') return avail <= 0;
        if (st === 'reference') return Boolean(book.isReferenceOnly);
        return true;
      });
      if (!matchesAnyStatus) return false;
    }

    // 6. Grade Level (OR within selectedGrades)
    if (grades.length > 0) {
      const matchesAnyGrade = grades.some((g) => matchesGradeFacet(book.targetGrade, g));
      if (!matchesAnyGrade) return false;
    }

    // 7. Language (OR within selectedLanguages)
    if (normLangs.length > 0) {
      const bookLang = normalizeLanguageValue(book.bookLanguage || 'English');
      if (!normLangs.includes(bookLang)) return false;
    }

    // 8. Publisher (OR within selectedPublishers)
    if (normPubs.length > 0) {
      const bookPub = normalizeFacetLabel(book.publisher ?? '').toLowerCase();
      if (!normPubs.includes(bookPub)) return false;
    }

    return true;
  });

  const sortBy = criteria.sortBy || 'title-asc';
  return [...filtered].sort((a, b) => {
    const titleA = String(a.title ?? '');
    const titleB = String(b.title ?? '');
    let cmp = 0;

    switch (sortBy) {
      case 'title-desc':
        cmp = titleB.localeCompare(titleA);
        break;
      case 'author-asc':
        cmp = String(a.author ?? '').localeCompare(String(b.author ?? ''));
        break;
      case 'author-desc':
        cmp = String(b.author ?? '').localeCompare(String(a.author ?? ''));
        break;
      case 'ddc-asc':
        cmp = String(a.ddcCallNumber ?? '').localeCompare(String(b.ddcCallNumber ?? ''));
        break;
      case 'ddc-desc':
        cmp = String(b.ddcCallNumber ?? '').localeCompare(String(a.ddcCallNumber ?? ''));
        break;
      case 'shelf-asc':
        cmp = String(a.shelfLocation ?? '').localeCompare(String(b.shelfLocation ?? ''));
        break;
      case 'shelf-desc':
        cmp = String(b.shelfLocation ?? '').localeCompare(String(a.shelfLocation ?? ''));
        break;
      case 'total-desc':
        cmp = Number(b.totalCopies ?? 0) - Number(a.totalCopies ?? 0);
        break;
      case 'total-asc':
        cmp = Number(a.totalCopies ?? 0) - Number(b.totalCopies ?? 0);
        break;
      case 'available-desc':
        cmp = Number(b.availableCopies ?? 0) - Number(a.availableCopies ?? 0);
        break;
      case 'available-asc':
        cmp = Number(a.availableCopies ?? 0) - Number(b.availableCopies ?? 0);
        break;
      case 'newest':
        cmp = String(b.addedAt ?? '').localeCompare(String(a.addedAt ?? ''));
        break;
      case 'title-asc':
      default:
        cmp = titleA.localeCompare(titleB);
        break;
    }

    if (cmp !== 0) return cmp;
    const tie = titleA.localeCompare(titleB);
    return tie !== 0 ? tie : String(a.id ?? '').localeCompare(String(b.id ?? ''));
  });
}

/**
 * Computes deduplicated dynamic facets and live counts across the catalog.
 */
export function computeCatalogFacets(books: Book[]): {
  availableCategories: string[];
  availableMediaTypes: string[];
  availablePublishers: string[];
  availableLanguages: Array<'Dhivehi' | 'English' | 'Arabic' | 'Other'>;
  facetCounts: CatalogFacetCounts;
} {
  const byCategory: Record<string, number> = {};
  const byMedia: Record<string, number> = {};
  const byPublisher: Record<string, number> = {};
  const byGrade: Record<string, number> = {
    'Primary (Grades 1-5)': 0,
    'Middle (Grades 6-8)': 0,
    'Secondary (Grades 9-12)': 0,
    'All Ages': 0,
  };
  const byLanguage: Record<string, number> = {
    Dhivehi: 0,
    English: 0,
    Arabic: 0,
    Other: 0,
  };

  const categoryCanonicalMap = new Map<string, string>();
  const mediaCanonicalMap = new Map<string, string>();
  const publisherCanonicalMap = new Map<string, string>();

  let available = 0;
  let checkedOut = 0;
  let reference = 0;
  let circulating = 0;

  for (const mt of STANDARD_MEDIA_TYPES) {
    mediaCanonicalMap.set(mt.toLowerCase(), mt);
    byMedia[mt] = 0;
  }

  for (const b of books) {
    if (!b || typeof b !== 'object') continue;

    const rawCat = normalizeFacetLabel(b.category);
    if (rawCat) {
      const catKey = rawCat.toLowerCase();
      const canonical = categoryCanonicalMap.get(catKey) || rawCat;
      categoryCanonicalMap.set(catKey, canonical);
      byCategory[canonical] = (byCategory[canonical] || 0) + 1;
    }

    const rawMedia = normalizeFacetLabel(b.mediaType || 'Book') || 'Book';
    const mediaKey = rawMedia.toLowerCase();
    const canonicalMedia = mediaCanonicalMap.get(mediaKey) || rawMedia;
    mediaCanonicalMap.set(mediaKey, canonicalMedia);
    byMedia[canonicalMedia] = (byMedia[canonicalMedia] || 0) + 1;

    const rawPub = normalizeFacetLabel(b.publisher);
    if (rawPub) {
      const pubKey = rawPub.toLowerCase();
      const canonicalPub = publisherCanonicalMap.get(pubKey) || rawPub;
      publisherCanonicalMap.set(pubKey, canonicalPub);
      byPublisher[canonicalPub] = (byPublisher[canonicalPub] || 0) + 1;
    }

    const availCopies = Number(b.availableCopies ?? 0);
    if (availCopies > 0) available += 1;
    else checkedOut += 1;

    if (b.isReferenceOnly) reference += 1;
    else circulating += 1;

    const lang = normalizeLanguageValue(b.bookLanguage || 'English');
    byLanguage[lang] = (byLanguage[lang] || 0) + 1;

    for (const band of GRADE_BAND_OPTIONS) {
      if (matchesGradeFacet(b.targetGrade, band.value)) {
        byGrade[band.value] = (byGrade[band.value] || 0) + 1;
      }
    }
  }

  const availableCategories = Array.from(categoryCanonicalMap.values()).sort((a, b) =>
    a.localeCompare(b)
  );
  const availableMediaTypes = Array.from(mediaCanonicalMap.values());
  const availablePublishers = Array.from(publisherCanonicalMap.values()).sort((a, b) =>
    a.localeCompare(b)
  );
  const availableLanguages = (['Dhivehi', 'English', 'Arabic', 'Other'] as const).filter(
    (l) => byLanguage[l] > 0 || l !== 'Other'
  );

  return {
    availableCategories,
    availableMediaTypes,
    availablePublishers,
    availableLanguages,
    facetCounts: {
      byCategory,
      byMedia,
      byGrade,
      byLanguage,
      byPublisher,
      available,
      checkedOut,
      reference,
      circulating,
    },
  };
}

export interface UseCatalogFilterOptions {
  books: Book[];
  isLoadingCatalog: boolean;
  language: Language;
  initialFilters?: CatalogUrlFilters;
  onFiltersChange?: (filters: CatalogUrlFilters) => void;
  resultsContainerRef?: RefObject<HTMLElement | null>;
}

export function useCatalogFilter({
  books,
  isLoadingCatalog,
  language,
  initialFilters,
  onFiltersChange,
  resultsContainerRef,
}: UseCatalogFilterOptions) {
  const [searchQuery, setSearchQueryState] = useState<string>(initialFilters?.q || '');
  const [debouncedQuery, setDebouncedQuery] = useState<string>(initialFilters?.q || '');

  const [selectedCategories, setSelectedCategoriesState] = useState<string[]>(() =>
    parseCsvParam(initialFilters?.cat)
  );
  const [selectedMediaTypes, setSelectedMediaTypesState] = useState<string[]>(() =>
    parseCsvParam(initialFilters?.media)
  );
  const [selectedStatuses, setSelectedStatusesState] = useState<CatalogStatusFilter[]>(() =>
    parseCsvParam(initialFilters?.status).filter(
      (s): s is CatalogStatusFilter => s === 'available' || s === 'checked-out' || s === 'reference'
    )
  );
  const [selectedGrades, setSelectedGradesState] = useState<string[]>(() =>
    parseCsvParam(initialFilters?.grade)
  );
  const [selectedLanguages, setSelectedLanguagesState] = useState<string[]>(() =>
    parseCsvParam(initialFilters?.blang)
  );
  const [selectedPublishers, setSelectedPublishersState] = useState<string[]>(() =>
    parseCsvParam(initialFilters?.pub)
  );
  const [circulationType, setCirculationTypeState] = useState<CirculationTypeFilter>(
    initialFilters?.type || 'all'
  );

  const [sortBy, setSortByState] = useState<CatalogSortOption>(
    (initialFilters?.sort as CatalogSortOption) || 'title-asc'
  );
  const [entriesPerPage, setEntriesPerPageState] = useState<number>(25);
  const [page, setPageState] = useState<number>(initialFilters?.page || 1);

  const [viewMode, setViewModeState] = useState<CatalogViewMode>(() => {
    const fromUrl = normalizeCatalogView(initialFilters?.view || null);
    if (fromUrl) return fromUrl;
    if (typeof window !== 'undefined') {
      const saved = normalizeCatalogView(localStorage.getItem(VIEW_MODE_STORAGE_KEY));
      if (saved) return saved;
    }
    return 'grid';
  });

  const scrollResultsIntoViewIfNeeded = useCallback(() => {
    const el = resultsContainerRef?.current;
    if (!el || typeof el.getBoundingClientRect !== 'function') return;
    const rect = el.getBoundingClientRect();
    if (rect.top < 12) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [resultsContainerRef]);

  // 180ms debounced search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Auto-reset page = 1 whenever query or filters or sort change after mount
  const filterSignature = useMemo(
    () =>
      JSON.stringify({
        debouncedQuery,
        selectedCategories,
        selectedMediaTypes,
        selectedStatuses,
        selectedGrades,
        selectedLanguages,
        selectedPublishers,
        circulationType,
        sortBy,
        entriesPerPage,
      }),
    [
      debouncedQuery,
      selectedCategories,
      selectedMediaTypes,
      selectedStatuses,
      selectedGrades,
      selectedLanguages,
      selectedPublishers,
      circulationType,
      sortBy,
      entriesPerPage,
    ]
  );

  const prevSignatureRef = useRef<string>(filterSignature);
  useEffect(() => {
    if (prevSignatureRef.current !== filterSignature) {
      prevSignatureRef.current = filterSignature;
      setPageState(1);
      scrollResultsIntoViewIfNeeded();
    }
  }, [filterSignature, scrollResultsIntoViewIfNeeded]);

  const setViewMode = useCallback((nextView: CatalogViewMode) => {
    setViewModeState(nextView);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(VIEW_MODE_STORAGE_KEY, nextView);
      } catch {
        // Ignore storage quota errors
      }
    }
  }, []);

  const setSearchQuery = useCallback((q: string) => {
    setSearchQueryState(q);
    setPageState(1);
  }, []);

  const setSelectedCategories = useCallback((cats: string[] | ((prev: string[]) => string[])) => {
    setSelectedCategoriesState(cats);
    setPageState(1);
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    const target = normalizeFacetLabel(cat);
    if (!target) return;
    setSelectedCategoriesState((prev) =>
      prev.some((c) => c.toLowerCase() === target.toLowerCase())
        ? prev.filter((c) => c.toLowerCase() !== target.toLowerCase())
        : [...prev, target]
    );
    setPageState(1);
  }, []);

  const setSelectedMediaTypes = useCallback((media: string[] | ((prev: string[]) => string[])) => {
    setSelectedMediaTypesState(media);
    setPageState(1);
  }, []);

  const toggleMediaType = useCallback((mt: string) => {
    setSelectedMediaTypesState((prev) =>
      prev.includes(mt) ? prev.filter((item) => item !== mt) : [...prev, mt]
    );
    setPageState(1);
  }, []);

  const toggleStatus = useCallback((st: CatalogStatusFilter) => {
    setSelectedStatusesState((prev) =>
      prev.includes(st) ? prev.filter((item) => item !== st) : [...prev, st]
    );
    setPageState(1);
  }, []);

  const setSelectedGrades = useCallback((grades: string[] | ((prev: string[]) => string[])) => {
    setSelectedGradesState(grades);
    setPageState(1);
  }, []);

  const toggleGrade = useCallback((grade: string) => {
    setSelectedGradesState((prev) =>
      prev.includes(grade) ? prev.filter((item) => item !== grade) : [...prev, grade]
    );
    setPageState(1);
  }, []);

  const setSelectedLanguages = useCallback((langs: string[] | ((prev: string[]) => string[])) => {
    setSelectedLanguagesState(langs);
    setPageState(1);
  }, []);

  const toggleLanguage = useCallback((lang: string) => {
    setSelectedLanguagesState((prev) =>
      prev.includes(lang) ? prev.filter((item) => item !== lang) : [...prev, lang]
    );
    setPageState(1);
  }, []);

  const setSelectedPublishers = useCallback((pubs: string[] | ((prev: string[]) => string[])) => {
    setSelectedPublishersState(pubs);
    setPageState(1);
  }, []);

  const togglePublisher = useCallback((pub: string) => {
    const target = normalizeFacetLabel(pub);
    if (!target) return;
    setSelectedPublishersState((prev) =>
      prev.some((p) => p.toLowerCase() === target.toLowerCase())
        ? prev.filter((p) => p.toLowerCase() !== target.toLowerCase())
        : [...prev, target]
    );
    setPageState(1);
  }, []);

  const setCirculationType = useCallback((nextType: CirculationTypeFilter) => {
    setCirculationTypeState(nextType);
    setPageState(1);
  }, []);

  const setSortBy = useCallback((nextSort: CatalogSortOption) => {
    setSortByState(nextSort);
    setPageState(1);
  }, []);

  const setEntriesPerPage = useCallback((count: number) => {
    setEntriesPerPageState(count);
    setPageState(1);
  }, []);

  const clearAllFilters = useCallback(() => {
    setSearchQueryState('');
    setDebouncedQuery('');
    setSelectedCategoriesState([]);
    setSelectedMediaTypesState([]);
    setSelectedStatusesState([]);
    setSelectedGradesState([]);
    setSelectedLanguagesState([]);
    setSelectedPublishersState([]);
    setCirculationTypeState('all');
    setPageState(1);
  }, []);

  // Facets + Counts
  const {
    availableCategories,
    availableMediaTypes,
    availablePublishers,
    availableLanguages,
    facetCounts,
  } = useMemo(() => computeCatalogFacets(books), [books]);

  // Filtered & Sorted Results
  const filteredBooks = useMemo(
    () =>
      selectFilteredBooks(books, {
        q: debouncedQuery,
        selectedCategories,
        selectedMediaTypes,
        selectedStatuses,
        selectedGrades,
        selectedLanguages,
        selectedPublishers,
        circulationType,
        sortBy,
      }),
    [
      books,
      debouncedQuery,
      selectedCategories,
      selectedMediaTypes,
      selectedStatuses,
      selectedGrades,
      selectedLanguages,
      selectedPublishers,
      circulationType,
      sortBy,
    ]
  );

  const totalPages = Math.max(1, Math.ceil(filteredBooks.length / entriesPerPage));

  // Clamp out-of-range page once catalog finishes hydrating
  useEffect(() => {
    if (!isLoadingCatalog && page > totalPages) {
      setPageState(1);
    }
  }, [isLoadingCatalog, page, totalPages]);

  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * entriesPerPage;
  const paginatedBooks = useMemo(
    () => filteredBooks.slice(startIndex, startIndex + entriesPerPage),
    [filteredBooks, startIndex, entriesPerPage]
  );

  const setPage = useCallback(
    (nextPage: number | ((prev: number) => number)) => {
      setPageState((prev) => {
        const computed = typeof nextPage === 'function' ? nextPage(prev) : nextPage;
        return Math.max(1, Math.min(totalPages, computed));
      });
      scrollResultsIntoViewIfNeeded();
    },
    [totalPages, scrollResultsIntoViewIfNeeded]
  );

  // Sync URL query params cleanly without losing filters on view switch
  useEffect(() => {
    if (!onFiltersChange) return;
    onFiltersChange({
      q: debouncedQuery.trim() || undefined,
      cat: selectedCategories.length > 0 ? selectedCategories.join(',') : undefined,
      media: selectedMediaTypes.length > 0 ? selectedMediaTypes.join(',') : undefined,
      type: circulationType !== 'all' ? circulationType : undefined,
      status: selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined,
      grade: selectedGrades.length > 0 ? selectedGrades.join(',') : undefined,
      blang: selectedLanguages.length > 0 ? selectedLanguages.join(',') : undefined,
      pub: selectedPublishers.length > 0 ? selectedPublishers.join(',') : undefined,
      sort: sortBy !== 'title-asc' ? sortBy : undefined,
      page: safePage > 1 ? safePage : undefined,
      view: viewMode,
    });
  }, [
    debouncedQuery,
    selectedCategories,
    selectedMediaTypes,
    circulationType,
    selectedStatuses,
    selectedGrades,
    selectedLanguages,
    selectedPublishers,
    sortBy,
    safePage,
    viewMode,
    onFiltersChange,
  ]);

  // Active filter chips with individual dismiss handlers
  const activeFilterChips = useMemo<ActiveFilterChip[]>(() => {
    const chips: ActiveFilterChip[] = [];

    if (searchQuery.trim()) {
      chips.push({
        id: 'q',
        group: language === 'dv' ? 'ހޯދުން' : 'Search',
        label: `"${searchQuery.trim()}"`,
        onRemove: () => {
          setSearchQueryState('');
          setDebouncedQuery('');
          setPageState(1);
        },
      });
    }

    for (const cat of selectedCategories) {
      chips.push({
        id: `cat:${cat}`,
        group: language === 'dv' ? 'ބައި' : 'Subject',
        label: cat,
        onRemove: () => toggleCategory(cat),
      });
    }

    for (const mt of selectedMediaTypes) {
      chips.push({
        id: `media:${mt}`,
        group: language === 'dv' ? 'މީޑިއާ' : 'Media',
        label: mt,
        onRemove: () => toggleMediaType(mt),
      });
    }

    if (circulationType !== 'all') {
      chips.push({
        id: `type:${circulationType}`,
        group: language === 'dv' ? 'ބާވަތް' : 'Access',
        label:
          circulationType === 'reference'
            ? language === 'dv'
              ? 'ރެފަރެންސް'
              : 'Reference Only'
            : language === 'dv'
            ? 'ދޫކުރެވޭ'
            : 'Borrowable',
        onRemove: () => setCirculationType('all'),
      });
    }

    for (const st of selectedStatuses) {
      const label =
        st === 'available'
          ? language === 'dv'
            ? 'ލިބެންހުރި'
            : 'Available'
          : st === 'checked-out'
          ? language === 'dv'
            ? 'ދޫކޮށްފައި'
            : 'Checked Out'
          : language === 'dv'
          ? 'ރެފަރެންސް'
          : 'Reference';
      chips.push({
        id: `status:${st}`,
        group: language === 'dv' ? 'ޙާލަތު' : 'Status',
        label,
        onRemove: () => toggleStatus(st),
      });
    }

    for (const gr of selectedGrades) {
      chips.push({
        id: `grade:${gr}`,
        group: language === 'dv' ? 'ގްރޭޑް' : 'Grade',
        label: gr,
        onRemove: () => toggleGrade(gr),
      });
    }

    for (const lang of selectedLanguages) {
      chips.push({
        id: `lang:${lang}`,
        group: language === 'dv' ? 'ބަސް' : 'Language',
        label: lang === 'Dhivehi' ? 'ދިވެހި (Dhivehi)' : lang,
        onRemove: () => toggleLanguage(lang),
      });
    }

    for (const pub of selectedPublishers) {
      chips.push({
        id: `pub:${pub}`,
        group: language === 'dv' ? 'ޗާޕުޚާނާ' : 'Publisher',
        label: pub,
        onRemove: () => togglePublisher(pub),
      });
    }

    return chips;
  }, [
    searchQuery,
    selectedCategories,
    selectedMediaTypes,
    circulationType,
    selectedStatuses,
    selectedGrades,
    selectedLanguages,
    selectedPublishers,
    language,
    toggleCategory,
    toggleMediaType,
    setCirculationType,
    toggleStatus,
    toggleGrade,
    toggleLanguage,
    togglePublisher,
  ]);

  const activeFilterCount = activeFilterChips.length;

  // Smart empty-state suggestions (ONLY computed when NOT loading)
  const emptyStateSuggestions = useMemo<EmptyStateSuggestion[]>(() => {
    if (isLoadingCatalog || filteredBooks.length > 0 || books.length === 0) return [];
    const suggestions: EmptyStateSuggestion[] = [];
    const base: CatalogFilterCriteria = {
      q: debouncedQuery,
      selectedCategories,
      selectedMediaTypes,
      selectedStatuses,
      selectedGrades,
      selectedLanguages,
      selectedPublishers,
      circulationType,
      sortBy,
    };

    if (selectedStatuses.length > 0) {
      const relaxed = selectFilteredBooks(books, { ...base, selectedStatuses: [] });
      if (relaxed.length > 0) {
        suggestions.push({
          label:
            language === 'dv'
              ? `ޙާލަތުގެ ފިލްޓަރު ދޫކޮށްލާ (${relaxed.length})`
              : `Include all availability statuses (${relaxed.length})`,
          count: relaxed.length,
          apply: () => setSelectedStatusesState([]),
        });
      }
    }

    if (selectedLanguages.length > 0) {
      const relaxed = selectFilteredBooks(books, { ...base, selectedLanguages: [] });
      if (relaxed.length > 0) {
        suggestions.push({
          label:
            language === 'dv'
              ? `ހުރިހާ ބަހެއް ދައްކާ (${relaxed.length})`
              : `Search across all languages (${relaxed.length})`,
          count: relaxed.length,
          apply: () => setSelectedLanguagesState([]),
        });
      }
    }

    if (selectedCategories.length > 0) {
      const relaxed = selectFilteredBooks(books, { ...base, selectedCategories: [] });
      if (relaxed.length > 0) {
        suggestions.push({
          label:
            language === 'dv'
              ? `ހުރިހާ މާއްދާއެއް (${relaxed.length})`
              : `Show all subjects (${relaxed.length})`,
          count: relaxed.length,
          apply: () => setSelectedCategoriesState([]),
        });
      }
    }

    if (selectedPublishers.length > 0) {
      const relaxed = selectFilteredBooks(books, { ...base, selectedPublishers: [] });
      if (relaxed.length > 0) {
        suggestions.push({
          label:
            language === 'dv'
              ? `ހުރިހާ ޗާޕުޚާނާއެއް (${relaxed.length})`
              : `All publishers (${relaxed.length})`,
          count: relaxed.length,
          apply: () => setSelectedPublishersState([]),
        });
      }
    }

    if (selectedGrades.length > 0 || selectedMediaTypes.length > 0 || circulationType !== 'all') {
      const relaxed = selectFilteredBooks(books, {
        ...base,
        selectedGrades: [],
        selectedMediaTypes: [],
        circulationType: 'all',
      });
      if (relaxed.length > 0) {
        suggestions.push({
          label:
            language === 'dv'
              ? `ގްރޭޑާއި މީޑިއާ ފިލްޓަރު ފޮހެލާ (${relaxed.length})`
              : `Clear grade & media filters (${relaxed.length})`,
          count: relaxed.length,
          apply: () => {
            setSelectedGradesState([]);
            setSelectedMediaTypesState([]);
            setCirculationTypeState('all');
          },
        });
      }
    }

    return suggestions;
  }, [
    isLoadingCatalog,
    filteredBooks.length,
    books,
    debouncedQuery,
    selectedCategories,
    selectedMediaTypes,
    selectedStatuses,
    selectedGrades,
    selectedLanguages,
    selectedPublishers,
    circulationType,
    sortBy,
    language,
  ]);

  return {
    // Search
    searchQuery,
    debouncedQuery,
    setSearchQuery,
    // Facets
    selectedCategories,
    setSelectedCategories,
    toggleCategory,
    selectedMediaTypes,
    setSelectedMediaTypes,
    toggleMediaType,
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
    togglePublisher,
    circulationType,
    setCirculationType,
    // View, Sort & Pagination
    viewMode,
    setViewMode,
    sortBy,
    setSortBy,
    entriesPerPage,
    setEntriesPerPage,
    page: safePage,
    setPage,
    totalPages,
    startIndex,
    // Outputs
    filteredBooks,
    paginatedBooks,
    availableCategories,
    availableMediaTypes,
    availablePublishers,
    availableLanguages,
    facetCounts,
    activeFilterChips,
    activeFilterCount,
    clearAllFilters,
    emptyStateSuggestions,
  };
}
