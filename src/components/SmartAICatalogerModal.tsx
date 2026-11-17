import React, { useState, useRef, useEffect } from 'react';
import {
  Camera, Upload, Sparkles, Loader2, X, Printer, Check, BookOpen,
  FileText, RefreshCw, AlertCircle, Video
} from 'lucide-react';
import { Book, BookCopy, PersonalItem } from '../types';
import {
  analyzeBookImagesWithSchema,
  CoverOcrResult,
  SCHOOL_GRADE_LEVELS,
  SchoolGradeLevel,
} from '../services/ai';
import { printBarcodeStickerSheet } from '../lib/printableLabels';
import { DEFAULT_CATEGORIES } from '../lib/categories';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';

interface SmartAICatalogerModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode?: 'catalog' | 'personal';
  currentUserId?: string;
  onSaveCatalogBook?: (book: Omit<Book, 'id'>) => Promise<void>;
  onSavePersonalItem?: (item: PersonalItem) => void;
}

export const SmartAICatalogerModal: React.FC<SmartAICatalogerModalProps> = ({
  isOpen,
  onClose,
  mode = 'catalog',
  currentUserId = 'user-1',
  onSaveCatalogBook,
  onSavePersonalItem,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();

  // Captured Image Data URLs
  const [coverDataUrl, setCoverDataUrl] = useState<string>('');
  const [coverMime, setCoverMime] = useState<string>('image/jpeg');
  const [titlePageDataUrl, setTitlePageDataUrl] = useState<string>('');
  const [titlePageMime, setTitlePageMime] = useState<string>('image/jpeg');

  // Optional Live Camera Capture
  const [cameraTarget, setCameraTarget] = useState<'cover' | 'titlePage' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Extraction State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [ocrResult, setOcrResult] = useState<CoverOcrResult | null>(null);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Editable Catalog Form State
  const [titleEn, setTitleEn] = useState('');
  const [titleDv, setTitleDv] = useState('');
  const [authorsText, setAuthorsText] = useState('');
  const [publisher, setPublisher] = useState('Local / NIE Press');
  const [publicationYear, setPublicationYear] = useState<number>(new Date().getFullYear());
  const [bookLang, setBookLang] = useState<'dv' | 'en' | 'ar' | 'other'>('dv');
  const [ddcCode, setDdcCode] = useState('DDC 891.49');
  const [category, setCategory] = useState('Dhivehi Literature');
  const [gradeLevel, setGradeLevel] = useState<SchoolGradeLevel>('Grade 6');
  const [subjectsText, setSubjectsText] = useState('Dhivehi Literature, School Reading, Maldives');
  const [synopsis, setSynopsis] = useState('');
  const [shelfLocation, setShelfLocation] = useState('Aisle 1 - Dhivehi Wing');
  const [totalCopies, setTotalCopies] = useState(2);
  const [barcode, setBarcode] = useState(() => `MAG-${Date.now().toString().slice(-6)}`);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    setCameraTarget(null);
  };

  useEffect(() => {
    if (!isOpen) stopCamera();
    return () => stopCamera();
  }, [isOpen]);

  if (!isOpen) return null;

  const startLiveCamera = async (target: 'cover' | 'titlePage') => {
    setCameraError(null);
    stopCamera();
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Camera API unavailable in this browser. Use Upload / Mobile Camera Snap instead.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      });
      streamRef.current = stream;
      setCameraTarget(target);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setCameraError('Camera permission denied or unavailable. Please upload a photo file.');
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current || !cameraTarget) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1024;
    canvas.height = videoRef.current.videoHeight || 768;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      if (cameraTarget === 'cover') {
        setCoverDataUrl(dataUrl);
        setCoverMime('image/jpeg');
      } else {
        setTitlePageDataUrl(dataUrl);
        setTitlePageMime('image/jpeg');
      }
    }
    stopCamera();
  };

  const handleFileChange = (target: 'cover' | 'titlePage', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (target === 'cover') {
        setCoverDataUrl(dataUrl);
        setCoverMime(file.type || 'image/jpeg');
      } else {
        setTitlePageDataUrl(dataUrl);
        setTitlePageMime(file.type || 'image/jpeg');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleExtractMetadata = async () => {
    if (!coverDataUrl) {
      setExtractError(
        language === 'dv'
          ? 'ފޮތުގެ ބޭރުގަނޑުގެ ފޮޓޯއެއް ނަންގަވާ ނުވަތަ އަޕްލޯޑް ކުރައްވާ.'
          : 'Please snap or upload the book front cover image first.'
      );
      return;
    }

    setIsAnalyzing(true);
    setExtractError(null);

    try {
      const result = await analyzeBookImagesWithSchema({
        imageBase64: coverDataUrl,
        mimeType: coverMime,
        titlePageBase64: titlePageDataUrl || undefined,
        titlePageMimeType: titlePageDataUrl ? titlePageMime : undefined,
        language: language === 'dv' ? 'dv' : 'en',
      });

      setOcrResult(result);
      setTitleEn(result.title_en);
      setTitleDv(result.title_dv);
      setAuthorsText(result.authors.join(', '));
      setPublisher(result.publisher);
      setPublicationYear(result.publication_year);
      setBookLang(result.language);
      setDdcCode(result.ddc_code);
      setCategory(result.category);
      setGradeLevel(result.grade_level);
      setSubjectsText(result.subjects.join(', '));
      setSynopsis(result.synopsis);

      const ddcDigits = result.ddc_code.match(/\d{3}/)?.[0] || '891';
      setBarcode(`MAG-${ddcDigits}-${Math.floor(100 + Math.random() * 900)}`);
      setShelfLocation(
        result.language === 'dv'
          ? `Dhivehi Wing — ${result.ddc_code}`
          : `General Stacks — ${result.ddc_code}`
      );

      toast.success(
        result.source === 'gemini_vision'
          ? 'AI Vision extracted metadata cleanly. Verify and save!'
          : 'Offline metadata template ready. Please verify fields.',
        'AI Vision Cataloger'
      );
    } catch (err: any) {
      setExtractError(err?.message || 'Vision OCR extraction failed.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async (andPrintBarcode: boolean) => {
    const primaryTitle =
      bookLang === 'dv' && titleDv.trim()
        ? titleDv.trim()
        : titleEn.trim() || titleDv.trim();

    if (!primaryTitle) {
      setExtractError('Please provide at least an English or Dhivehi title before saving.');
      return;
    }

    setIsSaving(true);
    setExtractError(null);

    try {
      const tags = subjectsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 5);
      const count = Math.max(1, totalCopies);
      const ddcDigits = ddcCode.match(/\d{3}/)?.[0] || '891';
      const today = new Date().toISOString().split('T')[0];

      if (mode === 'personal' && onSavePersonalItem) {
        const personalPayload: PersonalItem = {
          id: `pers-ai-${Date.now()}`,
          ownerId: currentUserId,
          title: primaryTitle,
          author: authorsText.trim() || 'Unknown Author',
          isbn: barcode,
          mediaType: 'Book',
          language: bookLang === 'dv' ? 'Dhivehi' : bookLang === 'ar' ? 'Arabic' : 'English',
          publisher: publisher.trim(),
          publicationYear,
          ddcCallNumber: ddcCode.trim() || `DDC ${ddcDigits}`,
          coverUrl: coverDataUrl || '/covers/dhivehi_heritage.jpg',
          shelfGroup: shelfLocation || 'Home Bookshelf',
          rating: 0,
          readingStatus: 'To Read',
          tags,
          description: synopsis.trim(),
          addedAt: today,
        };
        onSavePersonalItem(personalPayload);
      } else if (onSaveCatalogBook) {
        const copies: BookCopy[] = Array.from({ length: count }, (_, idx) => ({
          copyId: `${barcode}-cp-${idx + 1}`,
          barcode: `${barcode}-${String(idx + 1).padStart(2, '0')}`,
          accessionNumber: `ACC-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 8999)}`,
          rackLocation: shelfLocation,
          status: 'Available',
          condition: 'New',
          shelfLocation,
          acquiredAt: today,
          acquisitionPriceMvr: 185,
        }));

        const bookPayload: Omit<Book, 'id'> = {
          title: primaryTitle,
          titleEn: titleEn.trim() || undefined,
          titleDv: titleDv.trim() || undefined,
          author: authorsText.trim() || 'Unknown Author',
          category: category.trim() || 'General Literature',
          mediaType: 'Book',
          bookLanguage: bookLang === 'dv' ? 'Dhivehi' : bookLang === 'ar' ? 'Arabic' : 'English',
          targetGrade: gradeLevel,
          ddcCallNumber: ddcCode.trim() || `DDC ${ddcDigits}`,
          isbn: barcode,
          barcode,
          shelfLocation: shelfLocation.trim() || 'General Stacks',
          totalCopies: count,
          availableCopies: count,
          isReferenceOnly: false,
          coverUrl: coverDataUrl || (bookLang === 'dv' ? '/covers/dhivehi_heritage.jpg' : '/covers/classic_literature.jpg'),
          description: synopsis.trim() || 'Cataloged via Smart AI Vision OCR.',
          descriptionDv: bookLang === 'dv' ? synopsis.trim() : undefined,
          publisher: publisher.trim() || 'Local Press',
          publicationYear,
          tags,
          copies,
          addedAt: today,
        };

        await onSaveCatalogBook(bookPayload);

        if (andPrintBarcode) {
          printBarcodeStickerSheet(
            copies.map((cp) => ({
              title: primaryTitle,
              code: cp.barcode,
              ddcCallNumber: ddcCode,
              shelfLocation,
              accessionNumber: cp.accessionNumber,
              isReferenceOnly: false,
            })),
            `Barcode Stickers — ${primaryTitle}`
          );
        }
      }

      toast.success(
        andPrintBarcode
          ? `Saved "${primaryTitle}" and opened barcode sticker sheet.`
          : `Saved "${primaryTitle}" cleanly.`,
        'Catalog Updated'
      );
      onClose();
    } catch (err: any) {
      setExtractError(err?.message || 'Unable to save catalog entry.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 max-sm:items-end max-sm:p-0"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopCamera();
          onClose();
        }
      }}
    >
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-3xl max-sm:rounded-b-none max-w-4xl w-full max-h-[92vh] overflow-y-auto border border-slate-200 dark:border-slate-700 shadow-2xl p-5 sm:p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black tracking-tight">
                {language === 'dv' ? 'އޭއައި ވިޝަން ކެޓަލޮގަރ (ISBN ނެތް ފޮތްތަކަށް)' : 'Smart AI Vision Cataloger (Non-ISBN & Dhivehi OCR)'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'dv'
                  ? 'ފޮތުގެ ބޭރުގަނޑާއި ސުރުޚީ ޞަފްޙާގެ ފޮޓޯއަކުން ތާނަ އަދި އިނގިރޭސި މަޢުލޫމާތު އޮޓޯއިން ނަގާ.'
                  : 'Snap or upload the front cover and copyright/title page to auto-extract Thaana & English bibliographic JSON.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Webcam Capture Panel (when active) */}
        {cameraTarget && (
          <div className="bg-slate-950 rounded-2xl p-4 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between text-xs text-slate-200 font-bold">
              <span>Capturing {cameraTarget === 'cover' ? 'Front Cover' : 'Title / Copyright Page'}</span>
              <button
                type="button"
                onClick={stopCamera}
                className="text-rose-400 hover:underline cursor-pointer"
              >
                Cancel Camera
              </button>
            </div>
            <video ref={videoRef} autoPlay playsInline muted className="w-full max-h-64 rounded-xl bg-black object-contain" />
            <button
              type="button"
              onClick={captureCameraFrame}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              Snap Photo Frame
            </button>
          </div>
        )}

        {cameraError && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{cameraError}</span>
          </div>
        )}

        {/* Dual Image Capture Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Slot 1: Front Cover */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-700" />
                1. Front Cover Photo *
              </span>
              {coverDataUrl && (
                <button
                  type="button"
                  onClick={() => setCoverDataUrl('')}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {coverDataUrl ? (
              <img
                src={coverDataUrl}
                alt="Book Front Cover Preview"
                className="w-full h-40 object-contain rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="h-40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-xs text-slate-500 dark:text-slate-400 p-4 text-center">
                <Camera className="w-7 h-7 text-slate-400 mb-1.5" />
                <span>Snap or upload front cover (Dhivehi, English, or Arabic)</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-emerald-600 text-xs font-bold flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-emerald-700" />
                <span>Upload / Snap</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileChange('cover', e)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => void startLiveCamera('cover')}
                className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Live Cam</span>
              </button>
            </div>
          </div>

          {/* Slot 2: Copyright / Title Page */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-sky-600" />
                2. Copyright / Title Page (Optional)
              </span>
              {titlePageDataUrl && (
                <button
                  type="button"
                  onClick={() => setTitlePageDataUrl('')}
                  className="text-[11px] font-bold text-rose-600 hover:underline cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {titlePageDataUrl ? (
              <img
                src={titlePageDataUrl}
                alt="Copyright Title Page Preview"
                className="w-full h-40 object-contain rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
              />
            ) : (
              <div className="h-40 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-xs text-slate-500 dark:text-slate-400 p-4 text-center">
                <FileText className="w-7 h-7 text-slate-400 mb-1.5" />
                <span>Optional inner page for publisher, year & NIE curriculum credits</span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <label className="flex-1 cursor-pointer px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-sky-600 text-xs font-bold flex items-center justify-center gap-1.5">
                <Upload className="w-3.5 h-3.5 text-sky-600" />
                <span>Upload / Snap</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileChange('titlePage', e)}
                  className="hidden"
                />
              </label>
              <button
                type="button"
                onClick={() => void startLiveCamera('titlePage')}
                className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Live Cam</span>
              </button>
            </div>
          </div>
        </div>

        {/* Extract Trigger Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl bg-slate-900 text-white">
          <div className="text-xs">
            <div className="font-bold flex items-center gap-1.5 text-emerald-400">
              <Sparkles className="w-4 h-4" />
              <span>Multimodal Vision Metadata Extraction</span>
            </div>
            <div className="text-[11px] text-slate-300">
              {ocrResult
                ? `Extracted (${ocrResult.source === 'gemini_vision' ? 'Gemini Vision' : 'Offline Fallback'}) · Verify fields below`
                : 'Extracts Thaana/English titles, DDC call number, grade level (LKG–Grade 10), tags, and 2-sentence synopsis.'}
            </div>
          </div>

          <button
            type="button"
            onClick={handleExtractMetadata}
            disabled={isAnalyzing || !coverDataUrl}
            className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"
          >
            {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{isAnalyzing ? 'Analyzing Images...' : 'Extract Metadata JSON'}</span>
          </button>
        </div>

        {extractError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-200 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{extractError}</span>
          </div>
        )}

        {/* Verification Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              English Title (`title_en`)
            </label>
            <input
              type="text"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder="e.g. Coral Reefs of the Maldives"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Dhivehi Title (`title_dv` — Thaana)
            </label>
            <input
              type="text"
              dir="rtl"
              value={titleDv}
              onChange={(e) => setTitleDv(e.target.value)}
              placeholder="މިސާލު: ދިވެހި ބަސް - ގްރޭޑް 7"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
            />
          </div>

          <div>
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
              Author(s)
            </label>
            <input
              type="text"
              value={authorsText}
              onChange={(e) => setAuthorsText(e.target.value)}
              placeholder="Author 1, Author 2"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Publisher</label>
              <input
                type="text"
                value={publisher}
                onChange={(e) => setPublisher(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Year</label>
              <input
                type="number"
                value={publicationYear}
                onChange={(e) => setPublicationYear(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono tabular-nums font-bold"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Language</label>
              <select
                value={bookLang}
                onChange={(e) => setBookLang(e.target.value as any)}
                className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
              >
                <option value="dv">Dhivehi (ދިވެހި)</option>
                <option value="en">English</option>
                <option value="ar">Arabic</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">DDC Code</label>
              <input
                type="text"
                value={ddcCode}
                onChange={(e) => setDdcCode(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Grade Level</label>
              <select
                value={gradeLevel}
                onChange={(e) => setGradeLevel(e.target.value as SchoolGradeLevel)}
                className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
              >
                {SCHOOL_GRADE_LEVELS.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
              <input
                list="ai-cataloger-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
              />
              <datalist id="ai-cataloger-categories">
                {DEFAULT_CATEGORIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Subject Tags (3–5)</label>
              <input
                type="text"
                value={subjectsText}
                onChange={(e) => setSubjectsText(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
              />
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">2-Sentence Synopsis</label>
            <textarea
              rows={2}
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl font-medium"
            />
          </div>

          {mode === 'catalog' && (
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Assigned Barcode ID</label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Shelf Location</label>
                <input
                  type="text"
                  value={shelfLocation}
                  onChange={(e) => setShelfLocation(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Copies</label>
                <input
                  type="number"
                  min={1}
                  max={40}
                  value={totalCopies}
                  onChange={(e) => setTotalCopies(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl font-mono tabular-nums font-bold"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave(false)}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
            <span>{mode === 'personal' ? 'Save to Shelf' : 'Save Only'}</span>
          </button>

          {mode === 'catalog' && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave(true)}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              <span>Save & Print Barcode</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
