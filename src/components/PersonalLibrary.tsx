import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  Star,
  Camera,
  Download,
  Upload,
  Trash2,
  Scan,
  Loader2,
  Gamepad2,
  Headphones,
  Film,
  Newspaper,
  Package,
  Tablet,
  CheckCircle2,
  Clock,
  Share2,
  Flame,
  Target,
  FolderPlus,
  Bell,
  MessageSquare,
  FileSpreadsheet,
  X
} from 'lucide-react';
import { PersonalItem, MediaType, ReadingProgressStatus, UserProfile } from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { analyzeBookCoverOcr } from '../lib/aiService';
import { fetchExternalMetadata } from '../services/metadataFetcher';
import {
  CsvPreviewData,
  PersonalImportField,
  exportCatalogToCsv,
  exportCatalogToJson,
  exportToMarc21,
  mapCsvRowsToPersonalItems,
  parseCsvPreview,
  parseImportedPersonalData,
  suggestCsvMapping
} from '../lib/dataPortability';
import { BookCoverFallback } from './BookCoverFallback';
import { LibraryBookCard } from './LibraryBookCard';
import { HorizontalBookShelf } from './HorizontalBookShelf';
import { useBodyScrollLock } from '../hooks/useBodyScrollLock';

interface PersonalLibraryProps {
  items: PersonalItem[];
  currentUser: UserProfile;
  onAddItem: (item: PersonalItem) => void;
  onUpdateItem: (id: string, data: Partial<PersonalItem>) => void;
  onDeleteItem: (id: string) => void;
  onImportItems: (items: PersonalItem[]) => void;
  onOpenScanner?: (onScannedCallback?: (code: string) => void) => void;
  onOpenSmartCataloger?: () => void;
}

const MEDIA_TYPES: Array<{ value: MediaType; label: string }> = [
  { value: 'Book', label: 'Book' },
  { value: 'E-Book', label: 'E-Book' },
  { value: 'Audiobook', label: 'Audiobook' },
  { value: 'Periodical', label: 'Periodical / Magazine' },
  { value: 'Board Game', label: 'Board Game' },
  { value: 'Educational Kit', label: 'Educational / Study Kit' },
  { value: 'Video/DVD', label: 'Video / DVD' }
];

const READING_STATUS_OPTIONS: Array<{ value: ReadingProgressStatus; label: string }> = [
  { value: 'To Read', label: 'Want to Read' },
  { value: 'In Progress', label: 'Currently Reading' },
  { value: 'Completed', label: 'Completed' },
  { value: 'Loaned to Friend', label: 'Lent to Friend' }
];

const DEFAULT_CUSTOM_SHELVES = [
  'Home Bookshelf',
  'Classroom Reading Corner',
  '2026 Reading List'
];

const CSV_FIELD_OPTIONS: Array<{ value: PersonalImportField; label: string }> = [
  { value: 'ignore', label: '— Ignore Column —' },
  { value: 'title', label: 'Title * (Required)' },
  { value: 'author', label: 'Author / Creator' },
  { value: 'isbn', label: 'ISBN' },
  { value: 'upc', label: 'UPC / Barcode' },
  { value: 'mediaType', label: 'Media Format' },
  { value: 'shelfGroup', label: 'Custom Shelf' },
  { value: 'language', label: 'Language' },
  { value: 'publisher', label: 'Publisher' },
  { value: 'publicationYear', label: 'Publication Year' },
  { value: 'pageCount', label: 'Page Count' },
  { value: 'currentPage', label: 'Current Page' },
  { value: 'ddcCallNumber', label: 'DDC Call Number' },
  { value: 'readingStatus', label: 'Reading Status' },
  { value: 'rating', label: 'Rating (0-5)' },
  { value: 'tags', label: 'Tags / Subjects' },
  { value: 'loanedTo', label: 'Lent To (Name)' },
  { value: 'reminderDate', label: 'Return Reminder Date' },
  { value: 'reviewText', label: 'Review Comment' },
  { value: 'privateNotes', label: 'Private Notes' }
];

export const PersonalLibrary: React.FC<PersonalLibraryProps> = ({
  items,
  currentUser,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onImportItems,
  onOpenScanner,
  onOpenSmartCataloger
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();

  // Scoped strictly to current user's independent personal collection
  const userItems = useMemo(
    () => items.filter((i) => i.ownerId === currentUser.id),
    [items, currentUser.id]
  );

  // Per-user persisted Custom Shelves, Annual Reading Goal & Active Reading Streak
  const shelvesStorageKey = `magoodhoo_custom_shelves_${currentUser.id}`;
  const goalStorageKey = `magoodhoo_reading_goal_${currentUser.id}`;
  const streakStorageKey = `magoodhoo_reading_streak_${currentUser.id}`;

  const [savedShelves, setSavedShelves] = useState<string[]>(DEFAULT_CUSTOM_SHELVES);
  const [annualGoal, setAnnualGoal] = useState<number>(12);
  const [streakData, setStreakData] = useState<{ days: number; lastActiveDate: string }>({
    days: currentUser.readingStreakDays || 3,
    lastActiveDate: ''
  });
  const [newShelfInput, setNewShelfInput] = useState('');
  const [isNewShelfOpen, setIsNewShelfOpen] = useState(false);

  useEffect(() => {
    try {
      const s = localStorage.getItem(shelvesStorageKey);
      setSavedShelves(s ? JSON.parse(s) : DEFAULT_CUSTOM_SHELVES);
    } catch {
      setSavedShelves(DEFAULT_CUSTOM_SHELVES);
    }
    try {
      const g = localStorage.getItem(goalStorageKey);
      setAnnualGoal(g ? Math.max(1, Number(g)) : 12);
    } catch {
      setAnnualGoal(12);
    }
    try {
      const st = localStorage.getItem(streakStorageKey);
      if (st) {
        setStreakData(JSON.parse(st));
      } else {
        setStreakData({ days: currentUser.readingStreakDays || 3, lastActiveDate: '' });
      }
    } catch {
      setStreakData({ days: currentUser.readingStreakDays || 3, lastActiveDate: '' });
    }
  }, [currentUser.id, currentUser.readingStreakDays, shelvesStorageKey, goalStorageKey, streakStorageKey]);

  const recordReadingActivity = () => {
    const today = new Date().toISOString().split('T')[0];
    setStreakData((prev) => {
      if (prev.lastActiveDate === today) return prev;
      const next = { days: prev.days + 1, lastActiveDate: today };
      try {
        localStorage.setItem(streakStorageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const updateGoal = (nextGoal: number) => {
    const clamped = Math.min(200, Math.max(1, nextGoal));
    setAnnualGoal(clamped);
    try {
      localStorage.setItem(goalStorageKey, String(clamped));
    } catch {}
  };

  const handleCreateCustomShelf = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newShelfInput.trim();
    if (!trimmed) return;
    if (!shelves.includes(trimmed)) {
      const updated = [...savedShelves, trimmed];
      setSavedShelves(updated);
      try {
        localStorage.setItem(shelvesStorageKey, JSON.stringify(updated));
      } catch {}
    }
    setShelfFilter(trimmed);
    setShelfGroup(trimmed);
    setNewShelfInput('');
    setIsNewShelfOpen(false);
    toast.success(`Created custom shelf "${trimmed}".`, 'Custom Shelf Added');
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [mediaFilter, setMediaFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shelfFilter, setShelfFilter] = useState<string>('all');

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isbnLookupInput, setIsbnLookupInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [fetchedSourceLabel, setFetchedSourceLabel] = useState<string | null>(null);
  const [isOcrRunning, setIsOcrRunning] = useState(false);

  // Add Form State
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [isbn, setIsbn] = useState('');
  const [upc, setUpc] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('Book');
  const [itemLang, setItemLang] = useState<'English' | 'Dhivehi' | 'Arabic' | 'Other'>('English');
  const [publisher, setPublisher] = useState('');
  const [publicationYear, setPublicationYear] = useState(new Date().getFullYear());
  const [pageCount, setPageCount] = useState<number>(220);
  const [coverUrl, setCoverUrl] = useState('/covers/classic_literature.jpg');
  const [ddcCallNumber, setDdcCallNumber] = useState('DDC 800');
  const [shelfGroup, setShelfGroup] = useState('Home Bookshelf');
  const [tagsInput, setTagsInput] = useState('');
  const [rating, setRating] = useState(4);
  const [readingStatus, setReadingStatus] = useState<ReadingProgressStatus>('To Read');
  const [loanedTo, setLoanedTo] = useState('');
  const [reminderDate, setReminderDate] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [privateNotes, setPrivateNotes] = useState('');

  // Inline Review Editor State
  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [editingReviewDraft, setEditingReviewDraft] = useState('');

  // Interactive CSV Column Mapping Modal State
  const [csvPreview, setCsvPreview] = useState<CsvPreviewData | null>(null);
  const [csvMapping, setCsvMapping] = useState<PersonalImportField[]>([]);
  const [csvFileName, setCsvFileName] = useState('');

  const ocrFileRef = useRef<HTMLInputElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);

  useBodyScrollLock(isAddOpen || Boolean(csvPreview));

  const shelves = useMemo(() => {
    const itemShelves = userItems.map((i) => i.shelfGroup).filter(Boolean);
    return Array.from(new Set([...savedShelves, ...itemShelves]));
  }, [savedShelves, userItems]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return userItems.filter((item) => {
      if (mediaFilter !== 'all' && item.mediaType !== mediaFilter) return false;
      if (statusFilter !== 'all' && item.readingStatus !== statusFilter) return false;
      if (shelfFilter !== 'all' && item.shelfGroup !== shelfFilter) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        (item.isbn || '').toLowerCase().includes(q) ||
        (item.upc || '').toLowerCase().includes(q) ||
        item.shelfGroup.toLowerCase().includes(q) ||
        item.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [userItems, searchQuery, mediaFilter, statusFilter, shelfFilter]);

  const todayIso = new Date().toISOString().split('T')[0];
  const currentYear = String(new Date().getFullYear());

  const stats = useMemo(() => {
    const completedItems = userItems.filter((i) => i.readingStatus === 'Completed');
    const completedThisYear = completedItems.filter(
      (i) => !i.completionDate || i.completionDate.startsWith(currentYear)
    ).length;
    const dueReminders = userItems.filter(
      (i) => i.readingStatus === 'Loaned to Friend' && i.reminderDate && i.reminderDate <= todayIso
    ).length;

    return {
      total: userItems.length,
      completed: completedItems.length,
      completedThisYear,
      inProgress: userItems.filter((i) => i.readingStatus === 'In Progress').length,
      loanedOut: userItems.filter((i) => i.readingStatus === 'Loaned to Friend').length,
      dueReminders
    };
  }, [userItems, currentYear, todayIso]);

  const goalPct = Math.min(100, Math.round((stats.completedThisYear / annualGoal) * 100));
  const ringRadius = 24;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringDashOffset = ringCircumference - (goalPct / 100) * ringCircumference;

  const runMetadataFetch = async (rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return;
    setIsLookingUp(true);
    setFetchedSourceLabel(null);
    try {
      const data = await fetchExternalMetadata(code);
      if (data && data.found) {
        setTitle(data.title);
        setAuthor(data.author);
        if (data.upc) setUpc(data.upc);
        setIsbn(data.isbn);
        setPublisher(data.publisher);
        setPublicationYear(data.publicationYear || new Date().getFullYear());
        if (data.pageCount) setPageCount(data.pageCount);
        setCoverUrl(data.coverUrl || '/covers/classic_literature.jpg');
        setDdcCallNumber(data.ddcCallNumber || 'DDC 800');
        setItemLang(data.language || 'English');
        setTagsInput((data.subjects && data.subjects.length > 0 ? data.subjects : [data.category]).filter(Boolean).join(', '));
        if (data.description) setPrivateNotes(data.description.slice(0, 260));
        setFetchedSourceLabel(`${data.source} Match`);
        toast.success(`Fetched "${data.title}" metadata from ${data.source}`, 'ISBN / UPC Lookup');
      } else {
        toast.info('No online match found. Enter details manually (ideal for local Dhivehi titles).', 'Manual Entry Ready');
        if (code.replace(/[^0-9]/g, '').length === 12) setUpc(code);
        else setIsbn(code);
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleCoverOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrRunning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = reader.result as string;
        const ocr = await analyzeBookCoverOcr({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
          language
        });
        if (ocr) {
          if (ocr.title) setTitle(ocr.title);
          if (ocr.author) setAuthor(ocr.author);
          if (ocr.publisher) setPublisher(ocr.publisher);
          if (ocr.bookLanguage) setItemLang(ocr.bookLanguage);
          if (ocr.ddcCallNumber) setDdcCallNumber(ocr.ddcCallNumber);
          if (ocr.publicationYear) setPublicationYear(ocr.publicationYear);
          if (ocr.tags) setTagsInput(ocr.tags.join(', '));
          if (ocr.description) setPrivateNotes(ocr.description);
          toast.success(`Extracted "${ocr.title}" via AI Cover OCR`, 'Vision Cataloging');
        }
        setIsOcrRunning(false);
      };
      reader.readAsDataURL(file);
    } catch {
      setIsOcrRunning(false);
    }
  };

  const handleSaveItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const today = new Date().toISOString().split('T')[0];

    const newItem: PersonalItem = {
      id: `pers-${Date.now()}`,
      ownerId: currentUser.id,
      title: title.trim(),
      author: author.trim() || 'Unknown Creator',
      isbn: isbn.trim() || undefined,
      upc: upc.trim() || undefined,
      mediaType,
      language: itemLang,
      coverUrl,
      publisher: publisher.trim() || undefined,
      publicationYear: Number(publicationYear) || new Date().getFullYear(),
      pageCount: Number(pageCount) || undefined,
      currentPage: readingStatus === 'Completed' ? pageCount : 0,
      ddcCallNumber: ddcCallNumber.trim() || 'DDC 800',
      shelfGroup: shelfGroup.trim() || 'Home Bookshelf',
      tags: tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      rating,
      readingStatus,
      completionDate: readingStatus === 'Completed' ? today : undefined,
      loanedTo: readingStatus === 'Loaned to Friend' ? loanedTo.trim() : undefined,
      loanDate: readingStatus === 'Loaned to Friend' ? today : undefined,
      reminderDate: readingStatus === 'Loaned to Friend' && reminderDate ? reminderDate : undefined,
      reviewText: reviewText.trim() || undefined,
      privateNotes: privateNotes.trim() || undefined,
      addedAt: today
    };

    onAddItem(newItem);
    if (readingStatus === 'Completed' || readingStatus === 'In Progress') {
      recordReadingActivity();
    }
    toast.success(`Added "${newItem.title}" to your "${newItem.shelfGroup}" shelf.`, 'Saved');

    setTitle('');
    setAuthor('');
    setIsbn('');
    setUpc('');
    setLoanedTo('');
    setReminderDate('');
    setReviewText('');
    setPrivateNotes('');
    setTagsInput('');
    setFetchedSourceLabel(null);
    setCoverUrl('/covers/classic_literature.jpg');
    setIsAddOpen(false);
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileName = file.name.toLowerCase();

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const text = reader.result as string;
        if (fileName.endsWith('.csv')) {
          const parsed = parseCsvPreview(text);
          if (parsed.headers.length === 0 || parsed.rows.length === 0) {
            toast.error('CSV file appears empty or missing data rows.');
            return;
          }
          setCsvFileName(file.name);
          setCsvPreview(parsed);
          setCsvMapping(suggestCsvMapping(parsed.headers));
          return;
        }

        const imported = parseImportedPersonalData(text, currentUser.id);
        if (imported.length > 0) {
          onImportItems(imported);
          toast.success(`Imported ${imported.length} items into your personal library.`, 'Import Complete');
        } else {
          toast.error('No valid records found in uploaded JSON or MARC21 file.');
        }
      } catch {
        toast.error('Failed to parse file. Please upload valid CSV, JSON, or MARC21 (.mrk).');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleCommitCsvMapping = () => {
    if (!csvPreview) return;
    if (!csvMapping.includes('title')) {
      toast.error('Please map at least one CSV column to "Title * (Required)".', 'Missing Title Mapping');
      return;
    }
    const mappedItems = mapCsvRowsToPersonalItems(csvPreview.rows, csvMapping, currentUser.id);
    if (mappedItems.length === 0) {
      toast.error('No rows contained a valid title after applying column mappings.');
      return;
    }
    onImportItems(mappedItems);
    toast.success(`Imported ${mappedItems.length} mapped items from ${csvFileName}.`, 'CSV Import Complete');
    setCsvPreview(null);
    setCsvMapping([]);
    setCsvFileName('');
  };

  const getMediaIcon = (m: MediaType) => {
    switch (m) {
      case 'E-Book': return <Tablet className="w-3.5 h-3.5" />;
      case 'Audiobook': return <Headphones className="w-3.5 h-3.5" />;
      case 'Board Game': return <Gamepad2 className="w-3.5 h-3.5" />;
      case 'Video/DVD': return <Film className="w-3.5 h-3.5" />;
      case 'Periodical': return <Newspaper className="w-3.5 h-3.5" />;
      case 'Educational Kit': return <Package className="w-3.5 h-3.5" />;
      default: return <BookOpen className="w-3.5 h-3.5" />;
    }
  };

  const getStatusLabel = (status: ReadingProgressStatus) =>
    READING_STATUS_OPTIONS.find((s) => s.value === status)?.label || status;

  return (
    <div className="space-y-6">
      {/* Header & Zero-Lock-In Data Portability Bar */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
            {language === 'dv' ? 'އަމިއްލަ ކަލެކްޝަން މެނޭޖަރު' : `${currentUser.name}'s Personal Multi-Media Shelf`}
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE] tracking-tight archival-heading">
            {language === 'dv' ? 'އަމިއްލަ ލައިބްރަރީ އަދި ކިޔުމުގެ ލޮގް' : 'Personal Library & Reading Progress'}
          </h1>
          <p className="text-xs text-[#6B655D] dark:text-[#A19B91] max-w-2xl leading-relaxed">
            {language === 'dv'
              ? 'އަމިއްލަ ފޮތްތަކާއި، އީ-ބުކް، އޯޑިއޯބުކް އަދި ކުޅިވަރު ސެޓުތައް ރައްކާކޮށް، ކިޔާ ނިމުނު މިންވަރު ބަލަހައްޓަވާ.'
              : 'Manage books, e-books, audiobooks, periodicals, board games & educational kits with rapid ISBN/UPC scanning and full CSV/JSON/MARC21 ownership.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <input
            ref={importFileRef}
            type="file"
            accept=".csv,.json,.mrk,.txt"
            className="hidden"
            onChange={handleFileImport}
          />
          <button
            type="button"
            onClick={() => importFileRef.current?.click()}
            className="px-3 py-2 text-xs font-semibold text-[#1C1917] dark:text-[#F5F3EE] bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl hover:bg-[#EFECE6] dark:hover:bg-[#2E3330] transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7]" strokeWidth={1.75} />
            {language === 'dv' ? 'އެތެރެކުރޭ (CSV/JSON)' : 'Import CSV / MARC'}
          </button>
          <button
            type="button"
            onClick={() => exportCatalogToCsv(userItems, `personal_${currentUser.id}`)}
            className="px-3 py-2 text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl hover:bg-[#EFECE6] dark:hover:bg-[#232724] transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} /> CSV
          </button>
          <button
            type="button"
            onClick={() => exportCatalogToJson(userItems, `personal_${currentUser.id}`)}
            className="px-3 py-2 text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl hover:bg-[#EFECE6] dark:hover:bg-[#232724] transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} /> JSON
          </button>
          <button
            type="button"
            onClick={() => exportToMarc21(userItems, `personal_marc21_${currentUser.id}`)}
            className="px-3 py-2 text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl hover:bg-[#EFECE6] dark:hover:bg-[#232724] transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={1.75} /> MARC21
          </button>
          {onOpenSmartCataloger && (
            <button
              type="button"
              onClick={onOpenSmartCataloger}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#1C1917] dark:bg-[#232724] hover:bg-[#2E2A27] dark:hover:bg-[#2E3330] border border-transparent dark:border-[#2E3330] rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4 text-[#C26D3A]" strokeWidth={1.75} />
              {language === 'dv' ? 'އޭއައި ކަވަރު ސްކޭން' : 'AI Cover Snap'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C45] hover:bg-[#16655B] rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
            {language === 'dv' ? 'އާ އައިޓަމެއް އިތުރުކުރޭ' : 'Add Item / Scan ISBN'}
          </button>
        </div>
      </div>

      {/* Annual Reading Challenge Ring, Streak & Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
              <circle
                cx="30"
                cy="30"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                className="text-[#EFECE6] dark:text-[#232724]"
              />
              <circle
                cx="30"
                cy="30"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringDashOffset}
                className="text-[#0F4C45] dark:text-[#34D399] transition-all duration-500"
              />
            </svg>
            <span className="absolute text-xs font-bold font-mono tabular-nums text-[#1C1917] dark:text-[#F5F3EE]">
              {goalPct}%
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-semibold text-[#6B655D] dark:text-[#A19B91] flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7]" strokeWidth={1.75} />
              <span>{currentYear} Challenge</span>
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-[#1C1917] dark:text-[#F5F3EE]">
              <bdi dir="ltr">{stats.completedThisYear} / {annualGoal}</bdi>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-[#6B655D] dark:text-[#A19B91]">
              <span>Goal:</span>
              <button
                type="button"
                onClick={() => updateGoal(annualGoal - 1)}
                className="w-5 h-5 rounded bg-[#EFECE6] dark:bg-[#232724] hover:bg-[#E2DDD5] font-bold text-[#1C1917] dark:text-[#F5F3EE] cursor-pointer"
                aria-label="Decrease reading goal"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => updateGoal(annualGoal + 1)}
                className="w-5 h-5 rounded bg-[#EFECE6] dark:bg-[#232724] hover:bg-[#E2DDD5] font-bold text-[#1C1917] dark:text-[#F5F3EE] cursor-pointer"
                aria-label="Increase reading goal"
              >
                +
              </button>
            </div>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FFFBEB] dark:bg-[#78350F]/40 border border-[#FDE68A] dark:border-[#B45309]/50 text-[#C26D3A] dark:text-[#FCD34D] flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" strokeWidth={1.75} />
          </div>
          <div>
            <div className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
              {language === 'dv' ? 'ކިޔުމުގެ ސިލްސިލާ' : 'Reading Streak'}
            </div>
            <div className="text-2xl font-bold text-[#1C1917] dark:text-[#F5F3EE] font-mono tabular-nums">
              <bdi dir="ltr">{streakData.days} {streakData.days === 1 ? 'day' : 'days'}</bdi>
            </div>
            <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
              {streakData.lastActiveDate === todayIso ? 'Logged reading today' : 'Update page progress to extend'}
            </div>
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4">
          <div className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium">
            {language === 'dv' ? 'ޖުމްލަ އައިޓަމް' : 'Personal Items'}
          </div>
          <div className="text-2xl font-bold text-[#1C1917] dark:text-[#F5F3EE] font-mono tabular-nums mt-1">
            <bdi dir="ltr">{stats.total}</bdi>
          </div>
          <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] mt-1">
            {stats.inProgress} reading · {shelves.length} custom shelves
          </div>
        </div>

        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4">
          <div className="text-xs text-[#6B655D] dark:text-[#A19B91] font-medium flex items-center justify-between">
            <span>{language === 'dv' ? 'ރައްޓެހިންނަށް ދޫކޮށްފައި' : 'Lent to Friends'}</span>
            {stats.dueReminders > 0 && (
              <span className="text-[10px] font-bold text-[#B91C1C] flex items-center gap-0.5">
                <Bell className="w-3 h-3" strokeWidth={1.75} /> {stats.dueReminders} due
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-[#1D4ED8] dark:text-[#93C5FD] font-mono tabular-nums mt-1">
            <bdi dir="ltr">{stats.loanedOut}</bdi>
          </div>
          <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] mt-1">
            Tracked borrower & reminder dates
          </div>
        </div>
      </div>

      {/* Custom Shelves Quick Tabs + Inline Shelf Creator */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <button
            type="button"
            onClick={() => setShelfFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              shelfFilter === 'all'
                ? 'bg-[#0F4C45] text-white'
                : 'bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#E2DDD5] hover:bg-[#E2DDD5]'
            }`}
          >
            All Shelves ({userItems.length})
          </button>
          {shelves.map((shelf) => {
            const count = userItems.filter((i) => i.shelfGroup === shelf).length;
            return (
              <button
                key={shelf}
                type="button"
                onClick={() => setShelfFilter(shelf)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                  shelfFilter === shelf
                    ? 'bg-[#0F4C45] text-white'
                    : 'bg-[#EFECE6] dark:bg-[#232724] text-[#1C1917] dark:text-[#E2DDD5] hover:bg-[#E2DDD5]'
                }`}
              >
                {shelf} <span className="font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>

        {isNewShelfOpen ? (
          <form onSubmit={handleCreateCustomShelf} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newShelfInput}
              onChange={(e) => setNewShelfInput(e.target.value)}
              placeholder="Shelf name..."
              autoFocus
              className="px-2.5 py-1.5 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg text-[#1C1917] dark:text-[#F5F3EE]"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-[#0F4C45] text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsNewShelfOpen(false)}
              className="p-1 text-[#6B655D] hover:text-[#1C1917] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsNewShelfOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-[#0F4C45] dark:text-[#6EE7B7] bg-[#ECFDF5] dark:bg-[#0F4C45]/40 border border-[#A7F3D0] dark:border-[#16655B] rounded-xl hover:bg-[#D1FAE5] transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>New Shelf</span>
          </button>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#6B655D] dark:text-[#A19B91] absolute top-1/2 -translate-y-1/2 start-3" strokeWidth={1.75} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'dv'
                ? 'ނަން، މުޞަންނިފު، ޓެގް ނުވަތަ އައި.އެސް.ބީ.އެން އިން ހޯދުން...'
                : 'Filter personal items by title, creator, ISBN/UPC, tag, or shelf...'
            }
            className="w-full ps-9 pe-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:border-[#0F4C45]"
          />
        </div>
        <select
          value={mediaFilter}
          onChange={(e) => setMediaFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#1C1917] dark:text-[#F5F3EE] font-medium"
        >
          <option value="all">All Media Types</option>
          {MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#1C1917] dark:text-[#F5F3EE] font-medium"
        >
          <option value="all">All Reading States</option>
          {READING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Currently Reading Horizontal Shelf */}
      {(() => {
        const currentlyReading = userItems.filter((i) => i.readingStatus === 'In Progress');
        if (currentlyReading.length === 0) return null;
        return (
          <HorizontalBookShelf
            title={language === 'dv' ? 'މިވަގުތު ކިޔަމުންދާ ފޮތްތައް' : 'Currently Reading'}
            subtitle={
              language === 'dv'
                ? 'ކުރިއަށްދާ ފޮތްތަކުގެ ކިޔުމުގެ ކުރިއެރުން'
                : 'Pick up right where you left off across your personal shelves'
            }
            itemCount={currentlyReading.length}
            language={language}
            icon={<Clock className="w-4 h-4 text-[#C26D3A] shrink-0" strokeWidth={1.75} />}
          >
            {currentlyReading.map((item) => {
              const totalPages = item.pageCount || 100;
              const currentPg = item.currentPage || 0;
              const pct = Math.min(100, Math.round((currentPg / totalPages) * 100));
              return (
                <LibraryBookCard
                  key={`reading-${item.id}`}
                  variant="shelf"
                  title={item.title}
                  author={item.author}
                  coverUrl={item.coverUrl}
                  category={`${item.mediaType} · ${pct}%`}
                  ddcCallNumber={item.ddcCallNumber}
                  isbn={item.isbn || item.upc}
                  shelfLocation={item.shelfGroup}
                  availableCopies={1}
                  totalCopies={1}
                  language={language}
                  onSelect={() => {
                    setStatusFilter('In Progress');
                    setSearchQuery(item.title);
                  }}
                />
              );
            })}
          </HorizontalBookShelf>
        );
      })()}

      {/* Sunken Personal Gallery Shelf Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-12 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-[#0F4C45] dark:text-[#6EE7B7] mx-auto" strokeWidth={1.75} />
          <div className="text-sm font-bold text-[#1C1917] dark:text-[#F5F3EE]">
            No items in this view for {currentUser.name}
          </div>
          <p className="text-xs text-[#6B655D] dark:text-[#A19B91] max-w-md mx-auto">
            Scan an ISBN/UPC barcode, snap a Dhivehi book cover, or import your CSV/MARC21 bookshelf.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F4C45] hover:bg-[#16655B] rounded-xl cursor-pointer"
            >
              Add / Scan Item
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-[#1C1917] dark:text-[#F5F3EE] bg-[#EFECE6] dark:bg-[#232724] rounded-xl cursor-pointer"
            >
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-[#EFECE6]/55 dark:bg-[#232724]/50 border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl p-4 sm:p-5 shelf-ledge">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredItems.map((item) => {
              const totalPages = item.pageCount || 100;
              const currentPg = item.currentPage || 0;
              const pct = item.readingStatus === 'Completed'
                ? 100
                : Math.min(100, Math.round((currentPg / totalPages) * 100));
              const isReminderDue =
                item.readingStatus === 'Loaned to Friend' &&
                Boolean(item.reminderDate) &&
                item.reminderDate! <= todayIso;

              return (
                <LibraryBookCard
                  key={item.id}
                  variant="personal"
                  title={item.title}
                  author={item.author}
                  coverUrl={item.coverUrl}
                  category={`${item.mediaType} · ${item.shelfGroup}`}
                  isbn={item.isbn || item.upc}
                  progressPct={pct}
                  progressLabel={
                    item.mediaType === 'Book' || item.mediaType === 'E-Book' || item.mediaType === 'Audiobook'
                      ? `${pct}% Read · p.${currentPg}/${totalPages}`
                      : `${pct}% Complete`
                  }
                  language={language}
                  footer={
                    <div className="flex items-center justify-between text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                      <span className="truncate font-medium">
                        {item.tags.length > 0 ? <bdi>{item.tags.join(' · ')}</bdi> : getStatusLabel(item.readingStatus)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(item.id)}
                        className="text-[#6B655D] hover:text-[#B91C1C] p-1 cursor-pointer shrink-0"
                        title="Delete Item"
                      >
                        <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      </button>
                    </div>
                  }
                >
                  {/* Rating + Media Badge + Identifier */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          onClick={() => onUpdateItem(item.id, { rating: star })}
                          className="cursor-pointer"
                          title={`Rate ${star} stars`}
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              star <= item.rating ? 'text-[#C26D3A] fill-[#C26D3A]' : 'text-[#D6CFC3] dark:text-[#2E3330]'
                            }`}
                          />
                        </button>
                      ))}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#0F4C45] dark:text-[#6EE7B7]">
                      {getMediaIcon(item.mediaType)}
                      {(item.isbn || item.upc) && (
                        <bdi dir="ltr" className="font-mono text-[#6B655D] dark:text-[#A19B91]">
                          {item.isbn || item.upc}
                        </bdi>
                      )}
                    </span>
                  </div>

                  {/* Reading Progress & Interactive Controls */}
                  <div className="space-y-2.5 pt-2.5 border-t border-[#E2DDD5]/70 dark:border-[#2E3330]">
                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={item.readingStatus}
                        onChange={(e) => {
                          const nextStatus = e.target.value as ReadingProgressStatus;
                          if (nextStatus === 'In Progress' || nextStatus === 'Completed') {
                            recordReadingActivity();
                          }
                          onUpdateItem(item.id, {
                            readingStatus: nextStatus,
                            completionDate: nextStatus === 'Completed' ? todayIso : item.completionDate,
                            currentPage: nextStatus === 'Completed' ? (item.pageCount || 100) : item.currentPage
                          });
                        }}
                        className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border cursor-pointer ${
                          item.readingStatus === 'Completed'
                            ? 'bg-[#F0FDF4] dark:bg-[#0F4C45]/50 text-[#15803D] dark:text-[#6EE7B7] border-[#BBF7D0] dark:border-[#16655B]'
                            : item.readingStatus === 'In Progress'
                            ? 'bg-[#FFFBEB] dark:bg-[#78350F]/40 text-[#B45309] dark:text-[#FCD34D] border-[#FDE68A] dark:border-[#B45309]/60'
                            : item.readingStatus === 'Loaned to Friend'
                            ? 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/40 text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#1D4ED8]/60'
                            : 'bg-[#F7F5F0] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] border-[#E2DDD5] dark:border-[#2E3330]'
                        }`}
                      >
                        {READING_STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-[#1C1917] dark:text-[#F5F3EE]">
                        {item.readingStatus === 'Completed' && <CheckCircle2 className="w-3.5 h-3.5 text-[#15803D]" />}
                        {item.readingStatus === 'In Progress' && <Clock className="w-3.5 h-3.5 text-[#C26D3A]" />}
                        {item.readingStatus === 'Loaned to Friend' && <Share2 className="w-3.5 h-3.5 text-[#1D4ED8]" />}
                        <span>{pct}%</span>
                      </div>
                    </div>

                    {(item.mediaType === 'Book' || item.mediaType === 'E-Book' || item.mediaType === 'Audiobook') && (
                      <div className="flex items-center justify-between text-[10px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
                        <span>Page {currentPg} of {totalPages}</span>
                        <input
                          type="range"
                          min={0}
                          max={totalPages}
                          value={currentPg}
                          onChange={(e) => {
                            const pg = Number(e.target.value);
                            recordReadingActivity();
                            onUpdateItem(item.id, {
                              currentPage: pg,
                              readingStatus: pg >= totalPages ? 'Completed' : pg > 0 ? 'In Progress' : 'To Read',
                              completionDate: pg >= totalPages ? todayIso : item.completionDate
                            });
                          }}
                          className="w-24 accent-[#0F4C45] cursor-pointer"
                        />
                      </div>
                    )}

                    {item.readingStatus === 'Completed' && (
                      <div className="space-y-1.5 text-[11px] text-[#1C1917] dark:text-[#E2DDD5] bg-[#F7F5F0] dark:bg-[#232724] p-2.5 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
                        <div className="flex items-center justify-between">
                          <span className="font-mono tabular-nums text-[10px] text-[#0F4C45] dark:text-[#6EE7B7] font-semibold">
                            Finished: {item.completionDate || todayIso}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingReviewId(editingReviewId === item.id ? null : item.id);
                              setEditingReviewDraft(item.reviewText || '');
                            }}
                            className="text-[11px] font-semibold text-[#0F4C45] dark:text-[#6EE7B7] hover:underline flex items-center gap-1 cursor-pointer"
                          >
                            <MessageSquare className="w-3 h-3" />
                            {item.reviewText ? 'Edit Review' : 'Add Review'}
                          </button>
                        </div>
                        {editingReviewId === item.id ? (
                          <div className="flex gap-1.5 pt-1">
                            <input
                              type="text"
                              value={editingReviewDraft}
                              onChange={(e) => setEditingReviewDraft(e.target.value)}
                              placeholder="Write your short book review..."
                              className="flex-1 px-2 py-1 text-[11px] bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateItem(item.id, { reviewText: editingReviewDraft.trim() || undefined });
                                setEditingReviewId(null);
                                toast.success('Review saved.', 'Personal Library');
                              }}
                              className="px-2.5 py-1 bg-[#0F4C45] text-white text-[11px] font-bold rounded-lg cursor-pointer"
                            >
                              Save
                            </button>
                          </div>
                        ) : item.reviewText ? (
                          <p className="text-[11px] italic text-[#6B655D] dark:text-[#A19B91]">“{item.reviewText}”</p>
                        ) : null}
                      </div>
                    )}

                    {item.readingStatus === 'Loaned to Friend' && (
                      <div
                        className={`text-[11px] px-2.5 py-2 rounded-xl border space-y-1.5 ${
                          isReminderDue
                            ? 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 text-[#7F1D1D] dark:text-[#FECACA] border-[#FECACA] dark:border-[#B91C1C]/60'
                            : 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/30 text-[#1D4ED8] dark:text-[#93C5FD] border-[#BFDBFE] dark:border-[#1D4ED8]/60'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            Lent to <strong className="font-semibold"><bdi>{item.loanedTo || 'Friend'}</bdi></strong>
                          </span>
                          {isReminderDue && (
                            <span className="text-[10px] font-bold uppercase text-[#B91C1C] dark:text-[#FCA5A5] shrink-0">
                              Follow-up Due
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="flex items-center gap-1 text-[#6B655D] dark:text-[#A19B91]">
                            <Bell className="w-3 h-3" /> Reminder:
                          </span>
                          <input
                            type="date"
                            value={item.reminderDate || ''}
                            onChange={(e) => onUpdateItem(item.id, { reminderDate: e.target.value })}
                            className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded px-1.5 py-0.5 font-mono text-[10px]"
                          />
                        </div>
                      </div>
                    )}

                    {item.privateNotes && (
                      <p className="text-[11px] text-[#6B655D] dark:text-[#A19B91] line-clamp-2">{item.privateNotes}</p>
                    )}
                  </div>
                </LibraryBookCard>
              );
            })}
          </div>
        </div>
      )}

      {/* Add Personal Item Modal / Bottom Sheet */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 bg-[#121413]/70 backdrop-blur-xs flex items-center justify-center p-4 max-sm:items-end max-sm:p-0"
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddOpen(false); }}
        >
          <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-2xl border border-[#E2DDD5] dark:border-[#2E3330] shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5 safe-bottom text-[#1C1917] dark:text-[#F5F3EE]">
            <div className="sm:hidden w-12 h-1 bg-[#D6CFC3] rounded-full mx-auto" />

            <div className="flex items-center justify-between border-b border-[#E2DDD5] dark:border-[#2E3330] pb-3">
              <div>
                <h2 className="text-base font-bold text-[#1C1917] dark:text-[#F5F3EE] archival-heading">
                  {language === 'dv' ? 'އަމިއްލަ ކަލެކްޝަނަށް އިތުރުކުރުން' : 'Add to Personal Collection'}
                </h2>
                <p className="text-xs text-[#6B655D] dark:text-[#A19B91]">
                  Camera ISBN/UPC scan, Open Library & Google Books fetcher, AI Cover OCR, or manual entry
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 text-[#6B655D] hover:text-[#1C1917] dark:hover:text-[#F5F3EE] rounded-lg hover:bg-[#EFECE6] dark:hover:bg-[#232724] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instant ISBN/UPC Lookup, Camera Barcode Scan & AI Cover OCR Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-[#F7F5F0] dark:bg-[#232724] p-3.5 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#1C1917] dark:text-[#E2DDD5] flex items-center justify-between">
                  <span>ISBN / UPC Lookup (Open Library · Google)</span>
                  {fetchedSourceLabel && (
                    <span className="text-[10px] font-bold text-[#0F4C45] dark:text-[#6EE7B7]">{fetchedSourceLabel}</span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={isbnLookupInput}
                    onChange={(e) => setIsbnLookupInput(e.target.value)}
                    placeholder="9780735211292"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                  />
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenScanner((scannedCode) => {
                          setIsbnLookupInput(scannedCode);
                          runMetadataFetch(scannedCode);
                        })
                      }
                      className="px-2.5 py-1.5 bg-[#ECFDF5] dark:bg-[#0F4C45]/50 text-[#0F4C45] dark:text-[#6EE7B7] border border-[#A7F3D0] dark:border-[#16655B] text-xs font-semibold rounded-lg hover:bg-[#D1FAE5] flex items-center gap-1 cursor-pointer shrink-0"
                      title="Scan ISBN or UPC barcode with camera"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>Scan</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => runMetadataFetch(isbnLookupInput)}
                    disabled={isLookingUp}
                    className="px-3 py-1.5 bg-[#1C1917] dark:bg-[#0F4C45] text-white text-xs font-medium rounded-lg hover:opacity-90 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {isLookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[#1C1917] dark:text-[#E2DDD5]">
                  AI Cover OCR Snap (Dhivehi / Non-ISBN)
                </label>
                <input
                  ref={ocrFileRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleCoverOcrUpload}
                />
                <button
                  type="button"
                  onClick={() => ocrFileRef.current?.click()}
                  disabled={isOcrRunning}
                  className="w-full px-3 py-1.5 bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isOcrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  {isOcrRunning ? 'Extracting Metadata...' : 'Snap / Upload Book Cover'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Live Cover Art Preview + Core Metadata */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-24 h-36 rounded-md overflow-hidden border border-[#E2DDD5] dark:border-[#2E3330] shrink-0 bg-[#EFECE6] dark:bg-[#232724] mx-auto sm:mx-0 book-cover-card">
                  <BookCoverFallback
                    src={coverUrl}
                    title={title || 'Cover Preview'}
                    author={author}
                  />
                </div>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Title *</label>
                    <input
                      required
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Book, board game, periodical, or kit title..."
                      className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Author / Creator</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Media Format</label>
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as MediaType)}
                      className="w-full px-3 py-2 text-xs border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg bg-[#F7F5F0] dark:bg-[#232724]"
                    >
                      {MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">ISBN / UPC</label>
                  <input
                    type="text"
                    value={isbn || upc}
                    onChange={(e) => setIsbn(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Language</label>
                  <select
                    value={itemLang}
                    onChange={(e) => setItemLang(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg bg-[#F7F5F0] dark:bg-[#232724]"
                  >
                    <option value="English">English</option>
                    <option value="Dhivehi">Dhivehi (ދިވެހި)</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Custom Shelf</label>
                  <input
                    list="personal-shelves-list"
                    type="text"
                    value={shelfGroup}
                    onChange={(e) => setShelfGroup(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                  />
                  <datalist id="personal-shelves-list">
                    {shelves.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Reading / Loan Status</label>
                  <select
                    value={readingStatus}
                    onChange={(e) => setReadingStatus(e.target.value as ReadingProgressStatus)}
                    className="w-full px-3 py-2 text-xs border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg bg-[#F7F5F0] dark:bg-[#232724]"
                  >
                    {READING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                {readingStatus === 'Loaned to Friend' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Lent To (Borrower Name)</label>
                      <input
                        type="text"
                        value={loanedTo}
                        onChange={(e) => setLoanedTo(e.target.value)}
                        placeholder="Friend or colleague name..."
                        className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Return Reminder Date</label>
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                      />
                    </div>
                  </>
                )}

                {readingStatus === 'Completed' && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Short Review</label>
                    <input
                      type="text"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Favorite takeaway or rating reflection..."
                      className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Page Count</label>
                  <input
                    type="number"
                    value={pageCount}
                    onChange={(e) => setPageCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Subjects / Tags (comma separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Mystery, Dhivehi, STEM"
                    className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-[#1C1917] dark:text-[#E2DDD5] block mb-1">Private Notes</label>
                  <textarea
                    rows={2}
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[#E2DDD5] dark:border-[#2E3330]">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] bg-[#EFECE6] dark:bg-[#232724] hover:bg-[#E2DDD5] rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-[#0F4C45] hover:bg-[#16655B] rounded-lg cursor-pointer"
                >
                  Save to Personal Library
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Interactive Bulk CSV Column Mapping Modal */}
      {csvPreview && (
        <div
          className="fixed inset-0 z-50 bg-[#121413]/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCsvPreview(null);
              setCsvMapping([]);
            }
          }}
        >
          <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-[#1C1917] dark:text-[#F5F3EE]">
            <div className="px-6 py-4 border-b border-[#E2DDD5] dark:border-[#2E3330] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-[#0F4C45] dark:text-[#6EE7B7]" />
                <div>
                  <h2 className="text-base font-bold">CSV Column Mapping · {csvFileName}</h2>
                  <p className="text-xs text-[#6B655D] dark:text-[#A19B91]">
                    Detected {csvPreview.headers.length} columns and {csvPreview.rows.length} rows. Map columns to personal library fields below.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCsvPreview(null);
                  setCsvMapping([]);
                }}
                className="p-1.5 text-[#6B655D] hover:text-[#1C1917] dark:hover:text-[#F5F3EE] rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <div className="border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl overflow-hidden">
                <table className="w-full text-start text-xs">
                  <thead className="bg-[#0D2623] dark:bg-[#232724] text-[#F7F5F0] font-bold border-b border-[#193D38] dark:border-[#2E3330]">
                    <tr>
                      <th className="p-3">CSV Column Header</th>
                      <th className="p-3">Sample Values</th>
                      <th className="p-3">Map to Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330]">
                    {csvPreview.headers.map((header, colIdx) => (
                      <tr key={`${header}-${colIdx}`}>
                        <td className="p-3 font-semibold text-[#1C1917] dark:text-[#F5F3EE]">{header}</td>
                        <td className="p-3 text-[#6B655D] dark:text-[#A19B91] font-mono text-[11px] max-w-xs truncate">
                          {csvPreview.rows
                            .slice(0, 2)
                            .map((r) => r[colIdx] || '—')
                            .join(' | ')}
                        </td>
                        <td className="p-3">
                          <select
                            value={csvMapping[colIdx] || 'ignore'}
                            onChange={(e) => {
                              const next = [...csvMapping];
                              next[colIdx] = e.target.value as PersonalImportField;
                              setCsvMapping(next);
                            }}
                            className="w-full px-2.5 py-1.5 text-xs bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg"
                          >
                            {CSV_FIELD_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="px-6 py-4 bg-[#F7F5F0] dark:bg-[#232724] border-t border-[#E2DDD5] dark:border-[#2E3330] flex items-center justify-between gap-3">
              <span className="text-xs text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
                Ready to import into {currentUser.name}&apos;s shelf
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCsvPreview(null);
                    setCsvMapping([]);
                  }}
                  className="px-4 py-2 text-xs font-medium text-[#1C1917] dark:text-[#F5F3EE] bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitCsvMapping}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0F4C45] hover:bg-[#16655B] rounded-xl cursor-pointer"
                >
                  Import {csvPreview.rows.length} Mapped Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
