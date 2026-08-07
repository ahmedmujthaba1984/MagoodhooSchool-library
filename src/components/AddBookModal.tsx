import React, { useState } from 'react';
import { BookOpen, Plus, Sparkles, QrCode, ShieldAlert, Image, Check, X, Wand2, Globe, Search, Loader2, DownloadCloud, AlertCircle } from 'lucide-react';
import { Book } from '../types';
import { generateAiBookInfo } from '../lib/aiService';

interface AddBookModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBook: (book: Omit<Book, 'id'>) => Promise<void>;
}

const PRESET_COVERS = [
  { label: 'Fiction / Novel', url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&q=80&w=400' },
  { label: 'Science & Nature', url: 'https://images.unsplash.com/photo-1532012197267-da84d127e765?auto=format&fit=crop&q=80&w=400' },
  { label: 'History & World', url: 'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&q=80&w=400' },
  { label: 'Children Literature', url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&q=80&w=400' },
  { label: 'Reference & Atlas', url: 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?auto=format&fit=crop&q=80&w=400' },
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

export const AddBookModal: React.FC<AddBookModalProps> = ({ isOpen, onClose, onAddBook }) => {
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
  const [publisher, setPublisher] = useState('Oakridge Academic Press');
  const [publicationYear, setPublicationYear] = useState(2024);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Internet Book Data Fetching States
  const [onlineQuery, setOnlineQuery] = useState('');
  const [isFetchingOnline, setIsFetchingOnline] = useState(false);
  const [onlineFetchError, setOnlineFetchError] = useState<string | null>(null);
  const [onlineResults, setOnlineResults] = useState<any[]>([]);

  if (!isOpen) return null;

  // Auto-generate random ISBN & Barcode
  const handleGenerateBarcode = () => {
    const randomDigits = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    const generatedIsbn = `978${randomDigits.substring(3, 13)}`;
    setIsbn(generatedIsbn);
    setBarcode(generatedIsbn);
  };

  // Fetch Book Metadata from Internet (Google Books API + Open Library API)
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
      // 1. Try Google Books API
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

      // 2. Fallback to Open Library API
      const openLibRes = await fetch(`https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5`);
      if (openLibRes.ok) {
        const openLibData = await openLibRes.json();
        if (openLibData.docs && openLibData.docs.length > 0) {
          const parsed = openLibData.docs.slice(0, 5).map((doc: any) => {
            const docIsbn = doc.isbn ? doc.isbn[0] : (q.match(/^\d+$/) ? q : `978${Math.floor(1000000000 + Math.random() * 9000000000)}`);
            const coverId = doc.cover_i;
            const coverUrl = coverId 
              ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
              : PRESET_COVERS[0].url;

            return {
              title: doc.title || 'Untitled Book',
              author: doc.author_name ? doc.author_name.join(', ') : 'Unknown Author',
              publisher: doc.publisher ? doc.publisher[0] : 'Open Library Press',
              publicationYear: doc.first_publish_year || 2022,
              description: doc.first_sentence ? doc.first_sentence[0] : `Book catalog entry. Subjects: ${doc.subject ? doc.subject.slice(0, 3).join(', ') : 'General'}.`,
              category: doc.subject && doc.subject.length > 0 ? doc.subject[0] : 'Fiction / Literature',
              isbn: docIsbn,
              barcode: docIsbn,
              coverUrl
            };
          });

          setOnlineResults(parsed);
          applyOnlineBookData(parsed[0]);
          setIsFetchingOnline(false);
          return;
        }
      }

      setOnlineFetchError(`No online book records found matching "${q}". Please check title/ISBN and retry.`);
    } catch (err: any) {
      console.error('Internet book fetch error:', err);
      setOnlineFetchError('Unable to connect to online library services. Please verify your internet connection or enter fields manually.');
    } finally {
      setIsFetchingOnline(false);
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

  const [isAIGenerating, setIsAIGenerating] = useState(false);

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

    const bookPayload: Omit<Book, 'id'> = {
      title: title.trim(),
      author: author.trim(),
      category: category.trim() || 'General Literature',
      isbn: finalIsbn,
      barcode: finalBarcode,
      shelfLocation: shelfLocation.trim() || 'General Stacks',
      totalCopies: Number(totalCopies) || 1,
      availableCopies: Number(totalCopies) || 1,
      isReferenceOnly: Boolean(isReferenceOnly),
      coverUrl: coverUrl.trim() || PRESET_COVERS[0].url,
      description: description.trim() || 'No description available for this catalog item.',
      publisher: publisher.trim() || 'Oakridge Press',
      publicationYear: Number(publicationYear) || 2024,
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
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full p-6 border border-slate-200 max-h-[90vh] overflow-y-auto space-y-5 text-slate-800 animate-in fade-in zoom-in-95 duration-200">
        
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
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 hover:bg-slate-100 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Internet Book Metadata Lookup Toolbar */}
        <div className="p-4 bg-gradient-to-r from-sky-50 via-indigo-50 to-purple-50 border border-indigo-200 rounded-2xl space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600 animate-pulse" />
              <div>
                <h4 className="text-xs font-black text-indigo-950 uppercase tracking-wider">
                  Internet Book Data Auto-Fetcher
                </h4>
                <p className="text-[11px] text-slate-600 font-medium">
                  Fetch real book details, cover image, synopsis, publisher, and ISBN live from Google Books & Open Library.
                </p>
              </div>
            </div>
            <span className="bg-indigo-600 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full shadow">
              Live Web API
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
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
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                id="add-book-online-search-input"
              />
            </div>
            <button
              type="button"
              onClick={() => fetchBookDataFromInternet()}
              disabled={isFetchingOnline}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold px-4 py-2 rounded-xl text-xs transition flex items-center gap-1.5 shadow"
              id="fetch-book-data-online-btn"
            >
              {isFetchingOnline ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Fetching...
                </>
              ) : (
                <>
                  <DownloadCloud className="w-4 h-4" /> Fetch from Internet
                </>
              )}
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
            <div className="pt-2 border-t border-indigo-100 space-y-1.5">
              <span className="text-[10px] font-extrabold text-indigo-900 uppercase tracking-wider block">
                Found {onlineResults.length} matching books online. Click one to auto-fill:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {onlineResults.map((resBook, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyOnlineBookData(resBook)}
                    className="p-2 bg-white hover:bg-indigo-100/70 border border-slate-200 hover:border-indigo-300 rounded-xl text-left transition flex items-center gap-2 shadow-sm group"
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-gradient-to-r from-purple-900 to-indigo-900 text-white rounded-2xl shadow-md gap-3">
          <div className="space-y-0.5">
            <div className="text-xs font-black flex items-center gap-1.5 text-purple-300">
              <Sparkles className="w-4 h-4 text-purple-400" /> Gemini AI Book Auto-Cataloger
            </div>
            <div className="text-[10px] text-purple-200 font-medium">
              Enter Title & Author below, then click to auto-generate description, genre, and shelf location with AI!
            </div>
          </div>

          <button
            type="button"
            onClick={handleAIGenerateBookInfo}
            disabled={isAIGenerating || !title.trim() || !author.trim()}
            className="bg-purple-500 hover:bg-purple-600 disabled:opacity-50 text-white text-xs font-extrabold px-3.5 py-2 rounded-xl transition flex items-center justify-center gap-1.5 shadow active:scale-95 shrink-0"
            id="ai-autofill-book-info-btn"
          >
            {isAIGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Cataloging with AI...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 text-purple-200" /> AI Auto-Fill Details
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
              <label className="block font-bold text-slate-700 mb-1">Category / Genre</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                id="add-book-category-select"
              >
                <option value="Fiction / Literature">Fiction / Literature</option>
                <option value="Science & Nature">Science & Nature</option>
                <option value="History & Social Studies">History & Social Studies</option>
                <option value="Children Literature">Children Literature</option>
                <option value="Reference & Dictionaries">Reference & Dictionaries</option>
                <option value="Arts & Music">Arts & Music</option>
                <option value="Computer Science & STEM">Computer Science & STEM</option>
              </select>
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
              className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
              id="add-book-description-input"
            />
          </div>

          {/* Modal Buttons */}
          <div className="pt-4 flex justify-end gap-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition border border-slate-300"
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
    </div>
  );
};
