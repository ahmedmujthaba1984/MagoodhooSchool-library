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
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {language === 'dv' ? 'އަމިއްލަ ކަލެކްޝަން މެނޭޖަރު' : `${currentUser.name}'s Personal Multi-Media Vault`}
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {language === 'dv' ? 'އަމިއްލަ ލައިބްރަރީ އަދި ކިޔުމުގެ ލޮގް' : 'Personal Library & Reading Progress'}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-2xl">
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
            className="px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-emerald-600" />
            {language === 'dv' ? 'އެތެރެކުރޭ (CSV/JSON)' : 'Import CSV / MARC'}
          </button>
          <button
            type="button"
            onClick={() => exportCatalogToCsv(userItems, `personal_${currentUser.id}`)}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            type="button"
            onClick={() => exportCatalogToJson(userItems, `personal_${currentUser.id}`)}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
          <button
            type="button"
            onClick={() => exportToMarc21(userItems, `personal_marc21_${currentUser.id}`)}
            className="px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" /> MARC21
          </button>
          {onOpenSmartCataloger && (
            <button
              type="button"
              onClick={onOpenSmartCataloger}
              className="px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Camera className="w-4 h-4 text-emerald-400" />
              {language === 'dv' ? 'އޭއައި ކަވަރު ސްކޭން' : 'AI Cover Snap'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            {language === 'dv' ? 'އާ އައިޓަމެއް އިތުރުކުރޭ' : 'Add Item / Scan ISBN'}
          </button>
        </div>
      </div>

      {/* Annual Reading Challenge Ring, Streak & Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Annual Reading Challenge Ring */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 shrink-0 flex items-center justify-center">
            <svg className="w-16 h-16 -rotate-90" viewBox="0 0 60 60">
              <circle
                cx="30"
                cy="30"
                r={ringRadius}
                fill="none"
                stroke="currentColor"
                strokeWidth="5"
                className="text-slate-100 dark:text-slate-800"
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
                className="text-emerald-600 transition-all duration-500"
              />
            </svg>
            <span className="absolute text-xs font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {goalPct}%
            </span>
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Target className="w-3.5 h-3.5 text-emerald-600" />
              <span>{currentYear} Challenge</span>
            </div>
            <div className="text-lg font-bold font-mono tabular-nums text-slate-900 dark:text-white">
              {stats.completedThisYear} / {annualGoal}
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span>Goal:</span>
              <button
                type="button"
                onClick={() => updateGoal(annualGoal - 1)}
                className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                aria-label="Decrease reading goal"
              >
                -
              </button>
              <button
                type="button"
                onClick={() => updateGoal(annualGoal + 1)}
                className="w-5 h-5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
                aria-label="Increase reading goal"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Reading Streak Tracker */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {language === 'dv' ? 'ކިޔުމުގެ ސިލްސިލާ' : 'Reading Streak'}
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums">
              {streakData.days} {streakData.days === 1 ? 'day' : 'days'}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">
              {streakData.lastActiveDate === todayIso ? 'Logged reading today' : 'Update page progress to extend'}
            </div>
          </div>
        </div>

        {/* Collection & Shelves */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            {language === 'dv' ? 'ޖުމްލަ އައިޓަމް' : 'Personal Items'}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white font-mono tabular-nums mt-1">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {stats.inProgress} reading · {shelves.length} custom shelves
          </div>
        </div>

        {/* Lent to Friends & Return Reminders */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center justify-between">
            <span>{language === 'dv' ? 'ރައްޓެހިންނަށް ދޫކޮށްފައި' : 'Lent to Friends'}</span>
            {stats.dueReminders > 0 && (
              <span className="text-[10px] font-bold text-rose-600 flex items-center gap-0.5">
                <Bell className="w-3 h-3" /> {stats.dueReminders} due
              </span>
            )}
          </div>
          <div className="text-2xl font-bold text-sky-700 dark:text-sky-400 font-mono tabular-nums mt-1">
            {stats.loanedOut}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Tracked borrower & reminder dates
          </div>
        </div>
      </div>

      {/* Custom Shelves Quick Tabs + Inline Shelf Creator */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <button
            type="button"
            onClick={() => setShelfFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer whitespace-nowrap ${
              shelfFilter === 'all'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
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
                    ? 'bg-emerald-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200'
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
              className="px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              className="px-2.5 py-1.5 bg-emerald-700 text-white text-xs font-bold rounded-lg cursor-pointer"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setIsNewShelfOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setIsNewShelfOpen(true)}
            className="px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl hover:bg-emerald-100 transition flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Shelf</span>
          </button>
        )}
      </div>

      {/* Filter & Search Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              language === 'dv'
                ? 'ނަން، މުޞަންނިފު، ޓެގް ނުވަތަ އައި.އެސް.ބީ.އެން އިން ހޯދުން...'
                : 'Filter personal items by title, creator, ISBN/UPC, tag, or shelf...'
            }
            className="w-full ps-9 pe-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
          />
        </div>
        <select
          value={mediaFilter}
          onChange={(e) => setMediaFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium"
        >
          <option value="all">All Media Types</option>
          {MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-200 font-medium"
        >
          <option value="all">All Reading States</option>
          {READING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {/* Collection Grid */}
      {filteredItems.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
          <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            No items in this view for {currentUser.name}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Scan an ISBN/UPC barcode, snap a Dhivehi book cover, or import your CSV/MARC21 bookshelf.
          </p>
          <div className="flex items-center justify-center gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsAddOpen(true)}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
            >
              Add / Scan Item
            </button>
            <button
              type="button"
              onClick={() => importFileRef.current?.click()}
              className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl cursor-pointer"
            >
              Import CSV
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              <div
                key={item.id}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-4 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <div className="flex gap-3.5">
                  <div className="w-20 h-28 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800">
                    <BookCoverFallback src={item.coverUrl} title={item.title} author={item.author} />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200 font-medium">
                        {getMediaIcon(item.mediaType)} {item.mediaType}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{item.shelfGroup}</span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">
                      <bdi>{item.title}</bdi>
                    </h3>
                    <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                      <bdi>{item.author}</bdi>
                    </div>

                    <div className="flex items-center gap-1 pt-0.5">
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
                              star <= item.rating ? 'text-amber-500 fill-amber-400' : 'text-slate-300 dark:text-slate-600'
                            }`}
                          />
                        </button>
                      ))}
                      {(item.isbn || item.upc) && (
                        <span className="ms-2 text-[10px] font-mono tabular-nums text-slate-400 truncate">
                          <bdi>{item.isbn || item.upc}</bdi>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Progress & Status Interactive Controls */}
                <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
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
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                          : item.readingStatus === 'In Progress'
                          ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                          : item.readingStatus === 'Loaned to Friend'
                          ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {READING_STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                      {item.readingStatus === 'Completed' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />}
                      {item.readingStatus === 'In Progress' && <Clock className="w-3.5 h-3.5 text-amber-600" />}
                      {item.readingStatus === 'Loaned to Friend' && <Share2 className="w-3.5 h-3.5 text-sky-600" />}
                      <span>{pct}%</span>
                    </div>
                  </div>

                  {(item.mediaType === 'Book' || item.mediaType === 'E-Book' || item.mediaType === 'Audiobook') && (
                    <div className="space-y-1">
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-600 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
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
                          className="w-24 accent-emerald-700 cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {/* Completed Review & Finish Date */}
                  {item.readingStatus === 'Completed' && (
                    <div className="space-y-1.5 text-[11px] text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-mono tabular-nums text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                          Finished: {item.completionDate || todayIso}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingReviewId(editingReviewId === item.id ? null : item.id);
                            setEditingReviewDraft(item.reviewText || '');
                          }}
                          className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
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
                            className="flex-1 px-2 py-1 text-[11px] bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              onUpdateItem(item.id, { reviewText: editingReviewDraft.trim() || undefined });
                              setEditingReviewId(null);
                              toast.success('Review saved.', 'Personal Library');
                            }}
                            className="px-2.5 py-1 bg-emerald-700 text-white text-[11px] font-bold rounded-lg cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      ) : item.reviewText ? (
                        <p className="text-[11px] italic text-slate-600 dark:text-slate-300">“{item.reviewText}”</p>
                      ) : null}
                    </div>
                  )}

                  {/* Lent to Friend & Reminder Date */}
                  {item.readingStatus === 'Loaned to Friend' && (
                    <div
                      className={`text-[11px] px-2.5 py-2 rounded-xl border space-y-1.5 ${
                        isReminderDue
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800'
                          : 'bg-sky-50 dark:bg-sky-950/40 text-sky-900 dark:text-sky-200 border-sky-200 dark:border-sky-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          Lent to <strong className="font-semibold"><bdi>{item.loanedTo || 'Friend'}</bdi></strong>
                        </span>
                        {isReminderDue && (
                          <span className="text-[10px] font-bold uppercase text-rose-600 dark:text-rose-400 shrink-0">
                            Follow-up Due
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="flex items-center gap-1 text-slate-600 dark:text-slate-300">
                          <Bell className="w-3 h-3" /> Reminder:
                        </span>
                        <input
                          type="date"
                          value={item.reminderDate || ''}
                          onChange={(e) => onUpdateItem(item.id, { reminderDate: e.target.value })}
                          className="bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded px-1.5 py-0.5 font-mono text-[10px]"
                        />
                      </div>
                    </div>
                  )}

                  {item.privateNotes && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{item.privateNotes}</p>
                  )}

                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <span className="truncate">
                      {item.tags.length > 0 ? <bdi>{item.tags.join(' · ')}</bdi> : getStatusLabel(item.readingStatus)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(item.id)}
                      className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                      title="Delete Item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Personal Item Modal / Bottom Sheet */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 max-sm:items-end max-sm:p-0"
          onClick={(e) => { if (e.target === e.currentTarget) setIsAddOpen(false); }}
        >
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-2xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-6 space-y-5 safe-bottom text-slate-900 dark:text-slate-100">
            <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto" />

            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">
                  {language === 'dv' ? 'އަމިއްލަ ކަލެކްޝަނަށް އިތުރުކުރުން' : 'Add to Personal Collection'}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Camera ISBN/UPC scan, Open Library & Google Books fetcher, AI Cover OCR, or manual entry
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Instant ISBN/UPC Lookup, Camera Barcode Scan & AI Cover OCR Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/70 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 flex items-center justify-between">
                  <span>ISBN / UPC Lookup (Open Library · Google)</span>
                  {fetchedSourceLabel && (
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">{fetchedSourceLabel}</span>
                  )}
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={isbnLookupInput}
                    onChange={(e) => setIsbnLookupInput(e.target.value)}
                    placeholder="9780735211292"
                    className="flex-1 min-w-0 px-2.5 py-1.5 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg"
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
                      className="px-2.5 py-1.5 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-xs font-semibold rounded-lg hover:bg-emerald-100 flex items-center gap-1 cursor-pointer shrink-0"
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
                    className="px-3 py-1.5 bg-slate-900 dark:bg-emerald-700 text-white text-xs font-medium rounded-lg hover:bg-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {isLookingUp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Fetch'}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">
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
                  className="w-full px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isOcrRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
                  {isOcrRunning ? 'Extracting Metadata...' : 'Snap / Upload Book Cover'}
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4">
              {/* Live Cover Art Preview + Core Metadata */}
              <div className="flex flex-col sm:flex-row gap-4 items-start">
                <div className="w-24 h-36 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800 mx-auto sm:mx-0">
                  <BookCoverFallback
                    src={coverUrl}
                    title={title || 'Cover Preview'}
                    author={author}
                  />
                </div>

                <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Title *</label>
                    <input
                      required
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Book, board game, periodical, or kit title..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Author / Creator</label>
                    <input
                      type="text"
                      value={author}
                      onChange={(e) => setAuthor(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Media Format</label>
                    <select
                      value={mediaType}
                      onChange={(e) => setMediaType(e.target.value as MediaType)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                    >
                      {MEDIA_TYPES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">ISBN / UPC</label>
                  <input
                    type="text"
                    value={isbn || upc}
                    onChange={(e) => setIsbn(e.target.value)}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Language</label>
                  <select
                    value={itemLang}
                    onChange={(e) => setItemLang(e.target.value as any)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    <option value="English">English</option>
                    <option value="Dhivehi">Dhivehi (ދިވެހި)</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Custom Shelf</label>
                  <input
                    list="personal-shelves-list"
                    type="text"
                    value={shelfGroup}
                    onChange={(e) => setShelfGroup(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                  <datalist id="personal-shelves-list">
                    {shelves.map((s) => <option key={s} value={s} />)}
                  </datalist>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Reading / Loan Status</label>
                  <select
                    value={readingStatus}
                    onChange={(e) => setReadingStatus(e.target.value as ReadingProgressStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-950"
                  >
                    {READING_STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>

                {readingStatus === 'Loaned to Friend' && (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Lent To (Borrower Name)</label>
                      <input
                        type="text"
                        value={loanedTo}
                        onChange={(e) => setLoanedTo(e.target.value)}
                        placeholder="Friend or colleague name..."
                        className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Return Reminder Date</label>
                      <input
                        type="date"
                        value={reminderDate}
                        onChange={(e) => setReminderDate(e.target.value)}
                        className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                      />
                    </div>
                  </>
                )}

                {readingStatus === 'Completed' && (
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Short Review</label>
                    <input
                      type="text"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      placeholder="Favorite takeaway or rating reflection..."
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Page Count</label>
                  <input
                    type="number"
                    value={pageCount}
                    onChange={(e) => setPageCount(Number(e.target.value))}
                    className="w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Subjects / Tags (comma separated)</label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    placeholder="Mystery, Dhivehi, STEM"
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-200 block mb-1">Private Notes</label>
                  <textarea
                    rows={2}
                    value={privateNotes}
                    onChange={(e) => setPrivateNotes(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg cursor-pointer"
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
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setCsvPreview(null);
              setCsvMapping([]);
            }
          }}
        >
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden text-slate-900 dark:text-slate-100">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                <div>
                  <h2 className="text-base font-bold">CSV Column Mapping · {csvFileName}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
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
                className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 flex-1">
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                <table className="w-full text-start text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="p-3">CSV Column Header</th>
                      <th className="p-3">Sample Values</th>
                      <th className="p-3">Map to Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {csvPreview.headers.map((header, colIdx) => (
                      <tr key={`${header}-${colIdx}`}>
                        <td className="p-3 font-semibold text-slate-900 dark:text-white">{header}</td>
                        <td className="p-3 text-slate-500 dark:text-slate-400 font-mono text-[11px] max-w-xs truncate">
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
                            className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg"
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

            <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                Ready to import into {currentUser.name}&apos;s vault
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setCsvPreview(null);
                    setCsvMapping([]);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitCsvMapping}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl cursor-pointer"
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
