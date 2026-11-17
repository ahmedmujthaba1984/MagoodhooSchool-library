import React, { useState, useEffect } from 'react';
import {
  BookOpen, Plus, Sparkles, QrCode, ShieldAlert, Image, Check, X,
  Wand2, Globe, Search, Loader2, DownloadCloud, AlertCircle, Pencil,
  Trash2, FolderPlus, Camera, ChevronDown, ChevronUp, Mic, MicOff
} from 'lucide-react';
import { Book, BookCopy } from '../types';
import { generateAiBookInfo, analyzeBookCoverOcr, lookupIsbnMetadata } from '../lib/aiService';
import { subscribeCategories, addCategoryToStore, updateCategoryInStore, deleteCategoryFromStore, DEFAULT_CATEGORIES } from '../lib/categories';
import { BookCoverFallback } from './BookCoverFallback';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBook: (book: Omit<Book, 'id'>) => Promise<void>;
  onOpenSmartCataloger?: () => void;
}

const PRESET_COVERS = [
  { label: 'Classic Literature', url: '/covers/classic_literature.jpg' },
  { label: 'Science & Cosmos', url: '/covers/science_cosmos.jpg' },
  { label: 'Dhivehi Heritage', url: '/covers/dhivehi_heritage.jpg' },
  { label: 'Islamic Studies', url: '/covers/islamic_studies.jpg' },
  { label: 'Tech & Reference', url: '/covers/tech_reference.jpg' },
];

const TEMPLATES = [
  {
    title: 'The Wonders of Astronomy & Cosmos',
    author: 'Dr. Elena Rostova',
    category: 'Science & Nature',
    isReferenceOnly: false,
    shelfLocation: 'Aisle 2 - Shelf S3',
    description: 'An illustrated journey through galaxies, black holes, and the history of space exploration suitable for middle and high school students.',
    coverUrl: PRESET_COVERS[1].url
  },
  {
    title: 'Encyclopedia of World Civilizations',
    author: 'Oxford Historical Guild',
    category: 'History & Social Studies',
    isReferenceOnly: true,
    shelfLocation: 'Reference Wing - Table 1',
    description: 'Comprehensive 800-page reference atlas detailing ancient empires, trade routes, and modern global milestones.',
    coverUrl: PRESET_COVERS[4].url
  },
  {
    title: 'Adventures of the Starfall Academy',
    author: 'Marcus Vance',
    category: 'Fiction / Fantasy',
    isReferenceOnly: false,
    shelfLocation: 'Aisle 1 - Shelf F12',
    description: 'A thrilling young adult fiction series about young mages unlocking ancient relics hidden beneath their academy.',
    coverUrl: PRESET_COVERS[0].url
  }
];

export const AddBookModal: React.FC<AddBookModalProps> = ({ isOpen, onClose, onAddBook, onOpenSmartCataloger }) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [category, setCategory] = useState('Fiction / Literature');
  const [isbn, setIsbn] = useState('');
  const [barcode, setBarcode] = useState('');
  const [barcodeImageUrl, setBarcodeImageUrl] = useState('');
  const [shelfLocation, setShelfLocation] = useState('Aisle 1 - Shelf A');
  const [totalCopies, setTotalCopies] = useState(3);
  const [isReferenceOnly, setIsReferenceOnly] = useState(false);
  const [coverUrl, setCoverUrl] = useState(PRESET_COVERS[0].url);
  const [description, setDescription] = useState('');
  const [publisher, setPublisher] = useState('Magoodhoo Academic Press');
  const [publicationYear, setPublicationYear] = useState(2024);
  const [ddcCallNumber, setDdcCallNumber] = useState('DDC 823');
  const [bookLanguage, setBookLanguage] = useState<'English' | 'Dhivehi' | 'Arabic'>('English');
  const [copyPrefix, setCopyPrefix] = useState('MAG-823');
  const [replacementPriceMvr, setReplacementPriceMvr] = useState(180);
  const [showAdvancedDrawer, setShowAdvancedDrawer] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAIGenerating, setIsAIGenerating] = useState(false);
  const [isOcrScanning, setIsOcrScanning] = useState(false);

  // Internet Book Data Fetching States
  const [onlineQuery, setOnlineQuery] = useState('');
  const [isFetchingOnline, setIsFetchingOnline] = useState(false);
  const [onlineFetchError, setOnlineFetchError] = useState<string | null>(null);
  const [onlineResults, setOnlineResults] = useState<any[]>([]);

  const {
    isRecording: isVoiceDictating,
    isTranscribing: isVoiceTranscribing,
    toggleRecording: toggleVoiceDictation
  } = useVoiceAssistant({
    language: language === 'dv' ? 'dv' : 'en',
    onTranscript: (text) => {
      setOnlineQuery(text);
      fetchBookDataFromInternet(text);
    },
    onError: (msg) => toast.error(msg, 'Voice Cataloging'),
  });

  // Dynamic Categories Management States
  const [categoriesList, setCategoriesList] = useState<string[]>(DEFAULT_CATEGORIES);
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState<boolean>(false);
  const [newCatInput, setNewCatInput] = useState<string>('');
  
  const [editingCatTarget, setEditingCatTarget] = useState<string | null>(null);
  const [editCatInput, setEditCatInput] = useState<string>('');
  
  const [deletingCatTarget, setDeletingCatTarget] = useState<string | null>(null);
  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState<boolean>(false);

  useEffect(() => {
    const unsub = subscribeCategories((cats) => {
      if (cats && cats.length > 0) {
        setCategoriesList(cats);
      }
    });
    return () => unsub();
  }, []);

  const handleAddNewCategory = async () => {
    const name = newCatInput.trim();
    if (!name) return;
    await addCategoryToStore(name);
    setCategory(name);
    setNewCatInput('');
    setIsAddCategoryOpen(false);
  };

  const handleSaveEditCategory = async () => {
    if (!editingCatTarget || !editCatInput.trim()) return;
    const oldName = editingCatTarget;
    const newName = editCatInput.trim();
    await updateCategoryInStore(oldName, newName);
    if (category === oldName) {
      setCategory(newName);
    }
    setEditingCatTarget(null);
    setEditCatInput('');
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deletingCatTarget) return;
    const target = deletingCatTarget;
    await deleteCategoryFromStore(target);
    if (category === target) {
      const remaining = categoriesList.filter(c => c !== target);
      setCategory(remaining[0] || 'General Literature');
    }
    setDeletingCatTarget(null);
  };

  const handleCloseModal = () => {
    setIsAddCategoryOpen(false);
    setIsManageCategoriesOpen(false);
    setEditingCatTarget(null);
    setDeletingCatTarget(null);
    setOnlineFetchError(null);
    setOnlineResults([]);
    setTitle('');
    setAuthor('');
    setIsbn('');
    setBarcode('');
    setBarcodeImageUrl('');
    setDescription('');
    onClose();
  };

  if (!isOpen) return null;

  // Auto-generate random ISBN & Barcode
  const handleGenerateBarcode = () => {
    const randomDigits = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    const generatedIsbn = `978${randomDigits.substring(3, 13)}`;
    setIsbn(generatedIsbn);
    setBarcode(generatedIsbn);
  };

  // Fetch Book Metadata from Server Proxy (/api/catalog/lookup) + Google Books / Open Library fallback
  const fetchBookDataFromInternet = async (queryText?: string) => {
    const q = (queryText || onlineQuery || isbn || title).trim();
    if (!q) {
      setOnlineFetchError('Please enter an ISBN (e.g. 9780451524935), Book Title, or Author name to search online.');
      return;
    }

    setIsFetchingOnline(true);
    setOnlineFetchError(null);
    setOnlineResults([]);

    try {
      // 1. If numeric ISBN, call our multi-source /api/catalog/lookup endpoint first
      const cleanDigits = q.replace(/[-\s]/g, '');
      if (/^\d{10,13}$/.test(cleanDigits)) {
        const proxyData = await lookupIsbnMetadata(cleanDigits);
        if (proxyData && proxyData.title) {
          const item = {
            title: proxyData.title,
            author: proxyData.author,
            publisher: proxyData.publisher || 'Academic Press',
            publicationYear: proxyData.publicationYear || 2023,
            description: proxyData.description || '',
            category: proxyData.category || 'General Literature',
            isbn: proxyData.isbn || cleanDigits,
            barcode: proxyData.isbn || cleanDigits,
            coverUrl: proxyData.coverUrl || PRESET_COVERS[0].url
          };
          setOnlineResults([item]);
          applyOnlineBookData(item);
          setIsFetchingOnline(false);
          return;
        }
      }

      // 2. Search Google Books API by title/author
      const googleRes = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=5`);
      if (googleRes.ok) {
        const googleData = await googleRes.json();
        if (googleData.items && googleData.items.length > 0) {
          const parsed = googleData.items.map((item: any) => {
            const info = item.volumeInfo || {};
            const identifiers = info.industryIdentifiers || [];
            const isbnObj = identifiers.find((i: any) => i.type?.includes('13')) || identifiers[0];
            const fetchedIsbn = isbnObj?.identifier || (q.match(/^\d+$/) ? q : `978${Math.floor(1000000000 + Math.random() * 9000000000)}`);
            const fetchedCover = info.imageLinks?.thumbnail || info.imageLinks?.smallThumbnail || PRESET_COVERS[0].url;

            return {
              title: info.title || 'Untitled Book',
              author: info.authors ? info.authors.join(', ') : 'Unknown Author',
              publisher: info.publisher || 'Academic Press',
              publicationYear: info.publishedDate ? parseInt(info.publishedDate.substring(0, 4), 10) || 2023 : 2023,
              description: info.description || 'No detailed synopsis available from Google Books.',
              category: info.categories && info.categories.length > 0 ? info.categories[0] : 'Fiction / Literature',
              isbn: fetchedIsbn,
              barcode: fetchedIsbn,
              coverUrl: fetchedCover.replace('http:', 'https:')
            };
          });

          setOnlineResults(parsed);
          applyOnlineBookData(parsed[0]);
          setIsFetchingOnline(false);
          return;
        }
      }

      setOnlineFetchError(`No online book records found matching "${q}". You can snap a cover photo with AI Cover OCR or enter fields manually.`);
    } catch (err: any) {
      console.error('Internet book fetch error:', err);
      setOnlineFetchError('Unable to connect to online library services. Use AI Cover OCR or manual entry.');
    } finally {
      setIsFetchingOnline(false);
    }
  };

  // AI Cover OCR Upload Handler (extracts title, author, DDC, language, summary from cover photo)
  const handleCoverOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsOcrScanning(true);
    setOnlineFetchError(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1] || '';
        const ocr = await analyzeBookCoverOcr({
          imageBase64: base64,
          mimeType: file.type || 'image/jpeg',
          language: language === 'dv' ? 'dv' : 'en'
        });
        if (ocr) {
          if (ocr.title) setTitle(ocr.title);
          if (ocr.author) setAuthor(ocr.author);
          if (ocr.publisher) setPublisher(ocr.publisher);
          if (ocr.publicationYear) setPublicationYear(ocr.publicationYear);
          if (ocr.ddcCallNumber) {
            setDdcCallNumber(ocr.ddcCallNumber);
            const digits = ocr.ddcCallNumber.match(/\d{3}/)?.[0] || '000';
            setCopyPrefix(`MAG-${digits}`);
          }
          if (ocr.category) setCategory(ocr.category);
          if (ocr.description) setDescription(ocr.description);
          if (ocr.bookLanguage === 'Dhivehi' || ocr.bookLanguage === 'Arabic' || ocr.bookLanguage === 'English') {
            setBookLanguage(ocr.bookLanguage);
          }
          if (!isbn) handleGenerateBarcode();
        } else {
          setOnlineFetchError('Cover OCR could not extract text. Try a clearer photo.');
        }
        setIsOcrScanning(false);
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      setOnlineFetchError(`Cover OCR error: ${err.message}`);
      setIsOcrScanning(false);
    }
  };

  const applyOnlineBookData = (bookData: any) => {
    setTitle(bookData.title);
    setAuthor(bookData.author);
    if (bookData.publisher) setPublisher(bookData.publisher);
    if (bookData.publicationYear) setPublicationYear(bookData.publicationYear);
    if (bookData.description) setDescription(bookData.description);
    if (bookData.category) setCategory(bookData.category);
    if (bookData.coverUrl) setCoverUrl(bookData.coverUrl);
    if (bookData.isbn) {
      setIsbn(bookData.isbn);
      setBarcode(bookData.isbn);
    }
  };

  // Handle Upload Barcode Image File
  const handleBarcodeFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Check if filename contains digits for auto-barcode extraction
    const match = file.name.match(/\d{5,13}/);
    if (match) {
      if (!barcode) setBarcode(match[0]);
      if (!isbn) setIsbn(match[0]);
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setBarcodeImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Load Preset Template
  const handleApplyTemplate = (tmpl: typeof TEMPLATES[0]) => {
    setTitle(tmpl.title);
    setAuthor(tmpl.author);
    setCategory(tmpl.category);
    setIsReferenceOnly(tmpl.isReferenceOnly);
    setShelfLocation(tmpl.shelfLocation);
    setDescription(tmpl.description);
    setCoverUrl(tmpl.coverUrl);
    handleGenerateBarcode();
  };

  // Gemini AI Book Information Auto-Generator
  const handleAIGenerateBookInfo = async () => {
    if (!title.trim() || !author.trim()) {
      setOnlineFetchError('Please enter both Title and Author before generating AI info.');
      return;
    }
    setIsAIGenerating(true);
    setOnlineFetchError(null);

    try {
      const data = await generateAiBookInfo({ title, author });
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
      if (data.publicationYear) setPublicationYear(data.publicationYear);
      if (data.publisher) setPublisher(data.publisher);
      if (data.shelfLocation) setShelfLocation(data.shelfLocation);
      if (!barcode && !isbn) handleGenerateBarcode();
    } catch (err: any) {
      setOnlineFetchError(`AI Auto-Fill Error: ${err.message || 'Failed to auto-generate info'}`);
    } finally {
      setIsAIGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !author.trim()) {
      setOnlineFetchError('Please enter both Book Title and Author Name.');
      return;
    }

    setIsSubmitting(true);
    setOnlineFetchError(null);

    const finalBarcode = barcode.trim() || isbn.trim() || `BK-${Date.now().toString().slice(-6)}`;
    const finalIsbn = isbn.trim() || finalBarcode;
    const count = Math.max(1, Number(totalCopies) || 1);

    const yearNum = new Date().getFullYear();
    const accBase = Math.floor(1000 + Math.random() * 8999);
    const resolvedShelf = shelfLocation.trim() || 'General Stacks';
    const generatedCopies: BookCopy[] = Array.from({ length: count }, (_, idx) => ({
      copyId: `${finalBarcode}-cp-${idx + 1}`,
      barcode: `${copyPrefix || 'MAG-000'}-${String(idx + 1).padStart(2, '0')}`,
      accessionNumber: `ACC-${yearNum}-${accBase + idx}`,
      rackLocation: resolvedShelf,
      status: 'Available',
      condition: 'Good',
      shelfLocation: resolvedShelf,
      acquiredAt: new Date().toISOString().split('T')[0],
      acquisitionPriceMvr: Number(replacementPriceMvr) || 180
    }));

    const bookPayload: Omit<Book, 'id'> = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim() || 'General Literature',
      mediaType: 'Book',
      bookLanguage,
      ddcCallNumber: ddcCallNumber.trim() || 'DDC 000',
      isbn: finalIsbn,
      barcode: finalBarcode,
      shelfLocation: shelfLocation.trim() || 'General Stacks',
      totalCopies: count,
      availableCopies: count,
      isReferenceOnly: Boolean(isReferenceOnly),
      coverUrl: coverUrl.trim() || PRESET_COVERS[0].url,
      description: description.trim() || 'No description available for this catalog item.',
      publisher: publisher.trim() || 'Magoodhoo Academic Press',
      publicationYear: Number(publicationYear) || 2024,
      copies: generatedCopies,
      addedAt: new Date().toISOString().split('T')[0]
    };

    if (barcodeImageUrl.trim()) {
      bookPayload.barcodeImageUrl = barcodeImageUrl.trim();
    }

    try {
      await onAddBook(bookPayload);
      setIsSubmitting(false);
      setTitle('');
      setAuthor('');
      setIsbn('');
      setBarcode('');
      setBarcodeImageUrl('');
      setDescription('');
      onClose();
    } catch (err: any) {
      console.error('Error adding book:', err);
      setOnlineFetchError(`Failed to save book to database: ${err?.message || err}`);
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4 max-sm:items-end max-sm:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleCloseModal();
      }}
    >
      <div className="bg-white rounded-3xl max-sm:rounded-b-none max-sm:rounded-t-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        {/* Mobile Grab Handle */}
        <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto -mt-2 mb-2 shrink-0"></div>
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-4 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-2xl">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">Add New Book to Library Catalog</h3>
              <p className="text-xs text-slate-500 font-medium">Register a new title and upload its physical barcode image</p>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCloseModal();
            }}
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Rapid Cataloging Toolbar: Multi-Source ISBN Lookup + AI Cover OCR */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-700" />
                {language === 'dv' ? 'އަވަސް ކެޓަލޮގިންގ (ISBN / AI OCR)' : 'Rapid Cataloging: ISBN Lookup & AI Cover OCR'}
              </h4>
              <p className="text-[11px] text-slate-500">
                Fetch metadata from Open Library / Google Books / Crossref, or upload a cover photo for instant Gemini OCR extraction.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              {onOpenSmartCataloger && (
                <button
                  type="button"
                  onClick={() => {
                    handleCloseModal();
                    onOpenSmartCataloger();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{language === 'dv' ? 'ދެ ފޮޓޯ ސްކޭނަރ' : 'Full AI Vision Modal'}</span>
                </button>
              )}
              <label className="cursor-pointer px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 shrink-0">
                {isOcrScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{isOcrScanning ? 'Reading Cover...' : 'AI Cover OCR Snap'}</span>
                <input type="file" accept="image/*" onChange={handleCoverOcrUpload} className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={onlineQuery}
                onChange={(e) => setOnlineQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    fetchBookDataFromInternet();
                  }
                }}
                placeholder="Enter ISBN (e.g. 9780451524935) or Title / Author..."
                className="w-full ps-9 pe-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-semibold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                id="add-book-online-search-input"
              />
            </div>
            <button
              type="button"
              onClick={toggleVoiceDictation}
              disabled={isVoiceTranscribing}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer shrink-0 ${
                isVoiceDictating
                  ? 'bg-rose-600 text-white border-rose-600 ring-2 ring-rose-300'
                  : 'bg-white hover:bg-emerald-50 text-slate-700 border-slate-300'
              }`}
              title={language === 'dv' ? 'އަޑުން ފޮތުގެ ނަން ކިޔާލާ' : 'Voice Dictate Title or ISBN'}
            >
              {isVoiceDictating ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-700" />}
              <span className="hidden sm:inline">{isVoiceTranscribing ? '...' : isVoiceDictating ? 'Stop' : 'Dictate'}</span>
            </button>
            <button
              type="button"
              onClick={() => fetchBookDataFromInternet()}
              disabled={isFetchingOnline}
              className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
              id="fetch-book-data-online-btn"
            >
              {isFetchingOnline ? <Loader2 className="w-4 h-4 animate-spin" /> : <DownloadCloud className="w-4 h-4" />}
              <span>{isFetchingOnline ? 'Fetching...' : 'Lookup'}</span>
            </button>
          </div>

          {/* Error Banner */}
          {onlineFetchError && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-medium flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{onlineFetchError}</span>
            </div>
          )}

          {/* Search Results Picker */}
          {onlineResults.length > 1 && (
            <div className="pt-2 border-t border-slate-200 space-y-1.5">
              <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">
                Found {onlineResults.length} matching books online. Click one to auto-fill:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pe-1">
                {onlineResults.map((resBook, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyOnlineBookData(resBook)}
                    className="p-2 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-xl text-start transition flex items-center gap-2 shadow-sm group cursor-pointer"
                  >
                    <img src={resBook.coverUrl} alt="" className="w-8 h-10 object-cover rounded shadow flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="font-extrabold text-slate-900 text-xs truncate group-hover:text-indigo-700">{resBook.title}</div>
                      <div className="text-[10px] text-slate-500 font-medium truncate">{resBook.author} ({resBook.publicationYear})</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Sample Presets */}
        <div className="p-3.5 bg-indigo-50 border border-indigo-100 rounded-2xl space-y-2">
          <div className="flex items-center justify-between text-xs text-indigo-900 font-extrabold">
            <span className="flex items-center gap-1.5">
              <Wand2 className="w-4 h-4 text-indigo-600" /> Quick Auto-Fill Templates:
            </span>
            <span className="text-[10px] text-slate-500 font-medium">Click to pre-populate details</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TEMPLATES.map((tmpl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyTemplate(tmpl)}
                className="text-xs bg-white hover:bg-indigo-100 border border-indigo-200 text-indigo-950 px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm font-bold"
              >
                <Sparkles className="w-3 h-3 text-indigo-600" /> {tmpl.title.substring(0, 22)}...
              </button>
            ))}
          </div>
        </div>

        {/* Gemini AI Auto-Cataloger Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-sm gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-black flex items-center gap-1.5 text-emerald-400">
              <Sparkles className="w-4 h-4 text-emerald-400" /> AI Book Auto-Cataloger
            </div>
            <div className="text-[10px] text-slate-300 font-medium">
              Enter Title & Author below, then click to auto-generate description, genre, and shelf location.
            </div>
          </div>

          <button
            type="button"
            onClick={handleAIGenerateBookInfo}
            disabled={isAIGenerating || !title.trim() || !author.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow active:scale-95 shrink-0 cursor-pointer"
            id="ai-autofill-book-info-btn"
          >
            {isAIGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Cataloging...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-emerald-100" /> AI Auto-Fill Details
              </>
            )}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          
          {/* Title & Author */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Book Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. To Kill a Mockingbird"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                id="add-book-title-input"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Author Name *</label>
              <input
                type="text"
                required
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Harper Lee"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                id="add-book-author-input"
              />
            </div>
          </div>

          {/* Barcode & ISBN with File Upload for Barcode Image */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between">
              <label className="font-extrabold text-slate-900 flex items-center gap-1.5">
                <QrCode className="w-4 h-4 text-indigo-600" /> ISBN & Barcode Scanner Settings
              </label>
              <button
                type="button"
                onClick={handleGenerateBarcode}
                className="text-indigo-900 bg-indigo-100 hover:bg-indigo-200 border border-indigo-200 px-2.5 py-1 rounded-xl font-extrabold text-[11px] flex items-center gap-1 transition"
              >
                <Sparkles className="w-3 h-3 text-indigo-600" /> Auto-Generate Barcode
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">ISBN Number</label>
                <div className="space-y-1">
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="ISBN (e.g. 9780061120084)"
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    id="add-book-isbn-input"
                  />
                  {isbn.trim() && (
                    <button
                      type="button"
                      onClick={() => fetchBookDataFromInternet(isbn)}
                      className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3 h-3 text-indigo-600" /> Auto-fill info for ISBN: {isbn}
                    </button>
                  )}
                </div>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Barcode ID / Code</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="Barcode ID (e.g. 9780061120084)"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl font-mono font-bold text-slate-900 text-xs placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  id="add-book-barcode-input"
                />
              </div>
            </div>

            {/* UPLOAD BARCODE IMAGE FILE FEATURE */}
            <div className="pt-2 border-t border-slate-200 space-y-2">
              <label className="block font-extrabold text-indigo-900 text-xs">
                Upload Custom Barcode Image File (PNG / JPG / SVG):
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <label className="w-full sm:w-auto cursor-pointer bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition flex items-center justify-center gap-2 shadow">
                  <QrCode className="w-4 h-4" /> Upload Barcode Image
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBarcodeFileUpload}
                    className="hidden"
                    id="add-book-barcode-file-upload"
                  />
                </label>
                <input
                  type="text"
                  value={barcodeImageUrl}
                  onChange={(e) => setBarcodeImageUrl(e.target.value)}
                  placeholder="Or paste barcode image URL / base64..."
                  className="flex-1 w-full px-3.5 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Barcode Preview Box */}
              {barcodeImageUrl ? (
                <div className="p-3 bg-white rounded-xl border border-indigo-200 flex items-center justify-between gap-4 shadow-sm">
                  <div className="flex items-center gap-3">
                    <img src={barcodeImageUrl} alt="Uploaded Barcode" className="h-12 max-w-[160px] object-contain border border-slate-200 rounded p-1 bg-white" />
                    <div>
                      <div className="font-extrabold text-emerald-800 text-xs flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 text-emerald-600" /> Barcode Image Uploaded
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">This barcode label image will be attached to the book catalog record.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setBarcodeImageUrl('')}
                    className="text-xs text-rose-600 font-bold hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <p className="text-[11px] text-slate-500 font-medium italic">
                  Tip: Uploading your pre-created barcode image allows librarians and users to view and print the exact custom barcode image.
                </p>
              )}
            </div>
          </div>

          {/* Category & Shelf Location */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold text-slate-700 text-xs sm:text-sm">Category / Genre</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNewCatInput('');
                      setIsAddCategoryOpen(true);
                    }}
                    className="text-indigo-600 hover:text-indigo-800 text-[11px] font-extrabold flex items-center gap-0.5 hover:underline cursor-pointer"
                    title="Add new category"
                  >
                    <Plus className="w-3 h-3" /> Add
                  </button>
                  <span className="text-slate-300 text-xs">|</span>
                  <button
                    type="button"
                    onClick={() => setIsManageCategoriesOpen(true)}
                    className="text-slate-500 hover:text-slate-700 text-[11px] font-extrabold flex items-center gap-0.5 hover:underline cursor-pointer"
                    title="Manage category list"
                  >
                    <FolderPlus className="w-3 h-3" /> Manage
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <select
                  value={category}
                  onChange={(e) => {
                    if (e.target.value === '__ADD_NEW__') {
                      setNewCatInput('');
                      setIsAddCategoryOpen(true);
                    } else {
                      setCategory(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-xs sm:text-sm"
                  id="add-book-category-select"
                >
                  {categoriesList.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                  <option value="__ADD_NEW__" className="font-bold text-indigo-600">+ Add New Category...</option>
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setEditingCatTarget(category);
                    setEditCatInput(category);
                  }}
                  className="p-2.5 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 rounded-xl transition border border-slate-200 shrink-0 cursor-pointer"
                  title="Edit selected category name"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingCatTarget(category)}
                  className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition border border-rose-200 shrink-0 cursor-pointer"
                  title="Delete selected category"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Shelf Location</label>
              <input
                type="text"
                value={shelfLocation}
                onChange={(e) => setShelfLocation(e.target.value)}
                placeholder="e.g. Aisle 2, Shelf B"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                id="add-book-shelf-input"
              />
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Physical Copies</label>
              <input
                type="number"
                min={1}
                max={50}
                value={totalCopies}
                onChange={(e) => setTotalCopies(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                id="add-book-copies-input"
              />
            </div>
          </div>

          {/* Reference Only Checkbox */}
          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="font-extrabold text-amber-900 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-600" /> Reference Book Only (Non-Circulating)
              </div>
              <p className="text-[11px] text-amber-800 font-medium">
                Check this box if this book cannot be checked out or taken home by students (Library Desk Use Only).
              </p>
            </div>
            <input
              type="checkbox"
              checked={isReferenceOnly}
              onChange={(e) => setIsReferenceOnly(e.target.checked)}
              className="w-5 h-5 rounded text-amber-500 focus:ring-amber-500 accent-amber-500"
              id="add-book-reference-only-checkbox"
            />
          </div>

          {/* Cover Image Preset Selector */}
          <div>
            <label className="block font-bold text-slate-700 mb-1 flex items-center gap-1">
              <Image className="w-4 h-4 text-indigo-600" /> Book Cover Image Options
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-2">
              {PRESET_COVERS.map((preset, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCoverUrl(preset.url)}
                  className={`p-1.5 rounded-xl border text-[10px] text-center transition flex flex-col items-center gap-1 ${
                    coverUrl === preset.url ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-extrabold shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <img src={preset.url} alt="" className="w-10 h-14 object-cover rounded shadow" />
                  <span className="truncate w-full font-medium">{preset.label}</span>
                </button>
              ))}
            </div>
            <input
              type="text"
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="Or paste custom cover image URL..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="add-book-cover-url-input"
            />
          </div>

          {/* Publisher & Year */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Publisher</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Publication Year</label>
              <input
                type="number"
                value={publicationYear}
                onChange={(e) => setPublicationYear(Number(e.target.value))}
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold text-slate-700 mb-1">Description / Summary</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter brief synopsis of the book..."
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
              id="add-book-description-input"
            />
          </div>

          {/* Progressive Disclosure: Collapsible MARC21, DDC & Copy-Level Barcode Settings */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setShowAdvancedDrawer(prev => !prev)}
              className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-xs font-bold text-slate-800 cursor-pointer"
            >
              <span>Advanced Cataloging: DDC, Language, MVR Valuation & Copy Barcode Prefix</span>
              {showAdvancedDrawer ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {showAdvancedDrawer && (
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white border-t border-slate-200">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">DDC Call Number</label>
                  <input
                    type="text"
                    value={ddcCallNumber}
                    onChange={(e) => setDdcCallNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Book Language</label>
                  <select
                    value={bookLanguage}
                    onChange={(e) => setBookLanguage(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="English">English</option>
                    <option value="Dhivehi">Dhivehi (ދިވެހި)</option>
                    <option value="Arabic">Arabic</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Copy Barcode Prefix</label>
                  <input
                    type="text"
                    value={copyPrefix}
                    onChange={(e) => setCopyPrefix(e.target.value)}
                    placeholder="MAG-823"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Replacement Price (MVR)</label>
                  <input
                    type="number"
                    min={0}
                    value={replacementPriceMvr}
                    onChange={(e) => setReplacementPriceMvr(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-mono text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Modal Buttons */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleCloseModal}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow transition flex items-center gap-2"
              id="submit-add-book-btn"
            >
              <Plus className="w-4 h-4" />
              {isSubmitting ? 'Saving Book...' : 'Save Book to Catalog'}
            </button>
          </div>

        </form>

      </div>

      {/* 1. Add Category Modal */}
      {isAddCategoryOpen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsAddCategoryOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" /> Add New Category
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsAddCategoryOpen(false);
                }}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Category / Genre Name
              </label>
              <input
                type="text"
                autoFocus
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewCategory(); } }}
                placeholder="e.g., Graphic Novels & Comics"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsAddCategoryOpen(false);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddNewCategory}
                disabled={!newCatInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                Save Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Edit Category Modal */}
      {editingCatTarget && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditingCatTarget(null);
          }}
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Pencil className="w-5 h-5 text-indigo-600" /> Edit Category
              </h3>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingCatTarget(null);
                }}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">
                Rename Category
              </label>
              <input
                type="text"
                autoFocus
                value={editCatInput}
                onChange={(e) => setEditCatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSaveEditCategory(); } }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setEditingCatTarget(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEditCategory}
                disabled={!editCatInput.trim()}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs transition shadow-md disabled:opacity-50 cursor-pointer"
              >
                Update Name
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Delete Category Modal */}
      {deletingCatTarget && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeletingCatTarget(null);
          }}
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 bg-rose-100 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete Category</h3>
                <p className="text-xs text-slate-500">This action will remove the category option.</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 font-semibold bg-rose-50 p-3.5 rounded-2xl border border-rose-200">
              Are you sure you want to delete <span className="font-extrabold text-rose-800">"{deletingCatTarget}"</span>?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setDeletingCatTarget(null);
                }}
                className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 font-bold text-xs hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs transition shadow-md cursor-pointer"
              >
                Yes, Delete Category
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Manage All Categories Modal */}
      {isManageCategoriesOpen && (
        <div
          className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsManageCategoriesOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in duration-150 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <FolderPlus className="w-5 h-5 text-indigo-600" /> Manage Categories
                </h3>
                <p className="text-xs text-slate-500">Add, edit, or delete book categories & genres.</p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsManageCategoriesOpen(false);
                }}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Add Bar */}
            <div className="flex items-center gap-2 shrink-0 pt-2">
              <input
                type="text"
                placeholder="Enter new category name..."
                value={newCatInput}
                onChange={(e) => setNewCatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddNewCategory(); } }}
                className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                type="button"
                onClick={handleAddNewCategory}
                disabled={!newCatInput.trim()}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition shadow disabled:opacity-50 flex items-center gap-1 shrink-0"
              >
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>

            {/* List of Categories */}
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100 border border-slate-200 rounded-2xl p-2 bg-slate-50/50">
              {categoriesList.map((cat) => (
                <div key={cat} className="flex items-center justify-between py-2.5 px-3 hover:bg-white rounded-xl transition group">
                  <span className="text-xs font-bold text-slate-800">{cat}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingCatTarget(cat);
                        setEditCatInput(cat);
                      }}
                      className="p-1.5 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 rounded-lg transition"
                      title="Edit Category"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingCatTarget(cat)}
                      className="p-1.5 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-lg transition"
                      title="Delete Category"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end shrink-0 pt-2">
              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
