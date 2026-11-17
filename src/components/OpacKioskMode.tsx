import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  BookOpen,
  Bookmark,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
  Flame,
  History,
  LogOut,
  MapPin,
  Maximize2,
  Monitor,
  RotateCcw,
  Scan,
  Sparkles,
  UserCheck,
  XCircle
} from 'lucide-react';
import { Book, LibrarySettings, Loan, Reservation, UserProfile } from '../types';
import { useLanguage } from '../lib/i18n';
import { BookCoverFallback } from './BookCoverFallback';
import { playScanFeedback } from '../lib/barcodeSvg';

interface OpacKioskModeProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  reservations: Reservation[];
  settings?: LibrarySettings;
  onReserveForPatron: (book: Book, patron: UserProfile) => void;
  onCancelReservation?: (reservationId: string) => void;
}

const SESSION_TIMEOUT_SECONDS = 90;

export const OpacKioskMode: React.FC<OpacKioskModeProps> = ({
  isOpen,
  onClose,
  books,
  users,
  loans,
  reservations,
  settings,
  onReserveForPatron,
  onCancelReservation
}) => {
  const { language, localizeCategory } = useLanguage();
  const [scanInput, setScanInput] = useState('');
  const [activePatron, setActivePatron] = useState<UserProfile | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(SESSION_TIMEOUT_SECONDS);
  const [kioskNotice, setKioskNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<Html5QrcodeScanner | null>(null);

  // Attempt browser fullscreen cleanly (gracefully ignored if iframe forbids it)
  useEffect(() => {
    if (!isOpen) return;
    document.documentElement.requestFullscreen?.().catch(() => {});
    const timer = setTimeout(() => inputRef.current?.focus(), 100);
    return () => {
      clearTimeout(timer);
      if (document.fullscreenElement) {
        document.exitFullscreen?.().catch(() => {});
      }
    };
  }, [isOpen]);

  // Privacy auto-reset timer when a patron is signed into the kiosk
  useEffect(() => {
    if (!isOpen || !activePatron) return;
    setSecondsRemaining(SESSION_TIMEOUT_SECONDS);
    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          setActivePatron(null);
          setScanInput('');
          setKioskNotice(null);
          return SESSION_TIMEOUT_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, activePatron]);

  // Live Camera Scanner for Patron ID cards
  useEffect(() => {
    if (!isOpen || !isCameraOpen || activePatron) return;

    const scanner = new Html5QrcodeScanner(
      'kiosk-id-camera-reader',
      { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.777778 },
      false
    );

    scanner.render(
      (decodedText) => {
        handleIdentifyPatron(decodedText);
      },
      () => {}
    );

    cameraRef.current = scanner;
    return () => {
      if (cameraRef.current) {
        cameraRef.current.clear().catch(() => {});
        cameraRef.current = null;
      }
    };
  }, [isOpen, isCameraOpen, activePatron]);

  const resetTimer = () => setSecondsRemaining(SESSION_TIMEOUT_SECONDS);

  const handleIdentifyPatron = (rawCode: string) => {
    const q = rawCode.trim().toLowerCase();
    if (!q) return;

    const matched = users.find((u) => {
      if (u.role === 'admin') return false; // Never expose admin session inside self-service patron kiosk
      return (
        (u.studentIdCode && u.studentIdCode.toLowerCase() === q) ||
        (u.staffIdCode && u.staffIdCode.toLowerCase() === q) ||
        u.id.toLowerCase() === q ||
        u.email.toLowerCase() === q
      );
    });

    if (matched) {
      playScanFeedback('success');
      setActivePatron(matched);
      setScanError(null);
      setIsCameraOpen(false);
      setScanInput('');
      setSecondsRemaining(SESSION_TIMEOUT_SECONDS);
    } else {
      playScanFeedback('error');
      setScanError(
        language === 'dv'
          ? `"${rawCode.trim()}" އައިޑީ ކާޑު ސިސްޓަމުން ނުފެނުނު.`
          : `Patron ID "${rawCode.trim()}" was not found. Please scan a valid Student or Staff ID card.`
      );
    }
  };

  const handleEndPatronSession = () => {
    setActivePatron(null);
    setScanInput('');
    setScanError(null);
    setKioskNotice(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  };

  const patronLoans = useMemo(() => {
    if (!activePatron) return { active: [], history: [] };
    const all = loans.filter((l) => l.userId === activePatron.id);
    return {
      active: all.filter((l) => l.status === 'active' || l.status === 'overdue'),
      history: all.filter((l) => l.status === 'returned')
    };
  }, [activePatron, loans]);

  const patronHolds = useMemo(() => {
    if (!activePatron) return [];
    return reservations
      .filter((r) => r.userId === activePatron.id && r.status === 'pending')
      .map((r) => {
        const bookQueue = reservations
          .filter((q) => q.bookId === r.bookId && q.status === 'pending')
          .sort((a, b) => a.requestDate.localeCompare(b.requestDate));
        const pos = bookQueue.findIndex((q) => q.id === r.id) + 1;
        return { ...r, queuePos: pos || 1, queueTotal: bookQueue.length || 1 };
      });
  }, [activePatron, reservations]);

  const recommendations = useMemo(() => {
    if (!activePatron) return [];
    const borrowedBookIds = new Set(loans.filter((l) => l.userId === activePatron.id).map((l) => l.bookId));
    const likedCategories = new Set(
      loans
        .filter((l) => l.userId === activePatron.id)
        .map((l) => books.find((b) => b.id === l.bookId)?.category)
        .filter(Boolean)
    );

    const gradeNum = parseInt((activePatron.grade || '').match(/\d+/)?.[0] || '0', 10);
    const patronBand =
      gradeNum >= 1 && gradeNum <= 5
        ? 'Primary'
        : gradeNum >= 6 && gradeNum <= 8
        ? 'Middle'
        : gradeNum >= 9
        ? 'Secondary'
        : '';

    return books
      .filter((b) => !borrowedBookIds.has(b.id) && !b.isReferenceOnly)
      .map((b) => {
        let score = 0;
        if (b.availableCopies > 0) score += 2;
        if (likedCategories.has(b.category)) score += 3;
        if (patronBand && b.targetGrade?.includes(patronBand)) score += 3;
        if (b.targetGrade === 'All Ages') score += 1;
        return { book: b, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((x) => x.book);
  }, [activePatron, books, loans]);

  if (!isOpen) return null;

  const maxLoanQuota =
    activePatron?.role === 'staff'
      ? settings?.maxBooksPerStaff ?? 10
      : settings?.maxBooksPerStudent ?? 4;

  const todayIso = new Date().toISOString().split('T')[0];

  const samplePatrons = users.filter((u) => u.role === 'student' || u.role === 'staff').slice(0, 4);

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none"
      onClick={resetTimer}
      onKeyDown={resetTimer}
    >
      {/* Top Kiosk Strip */}
      <header className="px-6 py-4 bg-slate-900/95 border-b border-slate-800 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-emerald-400">
              {language === 'dv' ? 'ލައިބްރަރީ ސެލްފް-ސަރވިސް ކިއޮސްކް' : 'Magoodhoo Library · Self-Service Kiosk'}
            </div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
              {language === 'dv' ? 'ދަރިވަރުންގެ އައިޑީ ކާޑު ސްކޭން ކުރައްވާ' : 'Patron Account & Discovery Station'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {activePatron && (
            <>
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-300 bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-700">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Auto-clear: {secondsRemaining}s</span>
              </div>
              <button
                type="button"
                onClick={handleEndPatronSession}
                className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{language === 'dv' ? 'ސެޝަން ނިންމާލާ' : 'Done / Next Patron'}</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              handleEndPatronSession();
              onClose();
            }}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ކިއޮސްކް ބަންދުކުރޭ' : 'Exit Kiosk'}</span>
          </button>
        </div>
      </header>

      {/* Main Kiosk Workspace */}
      <main className="flex-1 overflow-y-auto p-6 sm:p-8">
        {!activePatron ? (
          <div className="max-w-xl mx-auto my-8 sm:my-16 bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 rounded-2xl bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <Scan className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-bold text-white">
                {language === 'dv' ? 'ތިބާގެ އައިޑީ ކާޑު ސްކޭން ކުރައްވާ' : 'Scan Your School ID Card'}
              </h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                {language === 'dv'
                  ? 'އަނބުރާ ދައްކަންޖެހޭ ތާރީޚާއި، ކިޔުނު ފޮތްތަކުގެ ތާރީޚު އަދި އާ ފޮތްތައް ބެލުމަށް އައިޑީ ޖައްސަވާ.'
                  : 'Check due dates, hold queue positions, reading history, and tailored shelf picks without librarian assistance.'}
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleIdentifyPatron(scanInput);
              }}
              className="space-y-3"
            >
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={scanInput}
                  onChange={(e) => setScanInput(e.target.value)}
                  placeholder="Scan barcode or type ID (e.g. STU-1029)..."
                  autoFocus
                  className="flex-1 px-4 py-3.5 bg-slate-950 border border-slate-700 rounded-xl text-base font-mono text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="px-5 py-3.5 bg-emerald-700 hover:bg-emerald-600 text-white font-bold text-sm rounded-xl transition cursor-pointer shrink-0"
                >
                  {language === 'dv' ? 'ހޯދާ' : 'Check ID'}
                </button>
              </div>

              {scanError && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
                  <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                  <span>{scanError}</span>
                </div>
              )}
            </form>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsCameraOpen((prev) => !prev)}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold rounded-xl text-slate-200 flex items-center gap-2 cursor-pointer"
              >
                <Camera className="w-4 h-4 text-emerald-400" />
                {isCameraOpen ? 'Close Camera Scanner' : 'Use Tablet Camera Scanner'}
              </button>
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                <Maximize2 className="w-3.5 h-3.5" /> Isolated Patron Mode
              </span>
            </div>

            {isCameraOpen && (
              <div
                id="kiosk-id-camera-reader"
                className="overflow-hidden rounded-2xl border border-emerald-500/40 bg-slate-950 min-h-[220px]"
              />
            )}

            {samplePatrons.length > 0 && (
              <div className="pt-4 border-t border-slate-800 space-y-2">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Quick Tap Patron Card (Demo Station)
                </div>
                <div className="flex flex-wrap gap-2">
                  {samplePatrons.map((p) => {
                    const code = p.studentIdCode || p.staffIdCode || p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleIdentifyPatron(code)}
                        className="px-3 py-1.5 bg-slate-800 hover:bg-emerald-900/50 border border-slate-700 hover:border-emerald-600/50 rounded-lg text-xs text-slate-200 flex items-center gap-2 cursor-pointer transition"
                      >
                        <span className="font-mono text-emerald-400"><bdi>{code}</bdi></span>
                        <span>·</span>
                        <span><bdi>{p.name}</bdi></span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Patron Identity Strip */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-emerald-700/20 border border-emerald-500/40 text-emerald-300 flex items-center justify-center font-bold text-xl shrink-0">
                  <UserCheck className="w-7 h-7" />
                </div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-xl font-bold text-white"><bdi>{activePatron.name}</bdi></h2>
                    {activePatron.dhivehiName && (
                      <span className="text-sm text-emerald-300"><bdi>{activePatron.dhivehiName}</bdi></span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-emerald-400">
                      <bdi>{activePatron.studentIdCode || activePatron.staffIdCode || activePatron.id}</bdi>
                    </span>
                    <span>·</span>
                    <span>{activePatron.grade || activePatron.staffDepartment || activePatron.role}</span>
                    <span>·</span>
                    <span className="font-mono tabular-nums">
                      Quota: {patronLoans.active.length} / {maxLoanQuota} borrowed
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <div className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 flex items-center gap-2 text-xs">
                  <Flame className="w-4 h-4 text-amber-400" />
                  <span className="font-mono tabular-nums font-bold text-white">{activePatron.readingStreakDays || 3}d</span>
                  <span className="text-slate-400">streak</span>
                </div>
                <div className="px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 flex items-center gap-2 text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="font-mono tabular-nums font-bold text-white">{patronLoans.history.length}</span>
                  <span className="text-slate-400">books read</span>
                </div>
              </div>
            </div>

            {kioskNotice && (
              <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-700 text-emerald-200 text-xs flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                  {kioskNotice}
                </span>
                <button
                  type="button"
                  onClick={() => setKioskNotice(null)}
                  className="text-emerald-400 hover:text-white cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Active Loans + Holds */}
              <div className="lg:col-span-5 space-y-6">
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-400" />
                      {language === 'dv' ? 'އަތުގައި ހުރި ފޮތްތަކާއި މުއްދަތު' : 'Checked-Out Books & Due Dates'}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-slate-400">{patronLoans.active.length} active</span>
                  </div>

                  {patronLoans.active.length === 0 ? (
                    <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400">
                      No books currently checked out on this ID card.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {patronLoans.active.map((loan) => {
                        const isOverdue = loan.status === 'overdue' || loan.dueDate < todayIso;
                        const book = books.find((b) => b.id === loan.bookId);
                        return (
                          <div
                            key={loan.id}
                            className={`p-3 rounded-xl border flex gap-3 items-center ${
                              isOverdue
                                ? 'bg-rose-950/30 border-rose-800/70'
                                : 'bg-slate-950/70 border-slate-800'
                            }`}
                          >
                            <div className="w-11 h-15 rounded-lg overflow-hidden border border-slate-700 shrink-0">
                              <BookCoverFallback src={book?.coverUrl} title={loan.bookTitle} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="text-xs font-bold text-white truncate"><bdi>{loan.bookTitle}</bdi></div>
                              <div className="text-[11px] font-mono tabular-nums text-slate-400">
                                Issued: <bdi>{loan.issueDate}</bdi>
                              </div>
                              <div className={`text-[11px] font-mono tabular-nums font-bold ${isOverdue ? 'text-rose-400' : 'text-emerald-400'}`}>
                                Due: <bdi>{loan.dueDate}</bdi> {isOverdue ? '· OVERDUE' : ''}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Active Holds */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <Bookmark className="w-4 h-4 text-sky-400" />
                      {language === 'dv' ? 'ނަންނޯޓު ކޮށްފައިވާ ފޮތްތައް' : 'My Reservation Queue'}
                    </h3>
                    <span className="text-xs font-mono tabular-nums text-slate-400">{patronHolds.length} holds</span>
                  </div>

                  {patronHolds.length === 0 ? (
                    <p className="text-xs text-slate-400">No active holds in queue.</p>
                  ) : (
                    <div className="space-y-2">
                      {patronHolds.map((hold) => (
                        <div
                          key={hold.id}
                          className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between gap-3"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-white truncate"><bdi>{hold.bookTitle}</bdi></div>
                            <div className="text-[11px] font-mono tabular-nums text-sky-400">
                              Queue Position: #{hold.queuePos} of {hold.queueTotal}
                            </div>
                          </div>
                          {onCancelReservation && (
                            <button
                              type="button"
                              onClick={() => onCancelReservation(hold.id)}
                              className="px-2.5 py-1 text-[11px] font-semibold bg-slate-800 hover:bg-rose-900/60 text-slate-300 hover:text-rose-200 rounded-lg border border-slate-700 cursor-pointer shrink-0"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Reading History */}
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-slate-400" />
                    {language === 'dv' ? 'ކުރިން ކިޔާފައިވާ ފޮތްތައް' : 'Recent Reading History'}
                  </h3>
                  {patronLoans.history.length === 0 ? (
                    <p className="text-xs text-slate-400">No returned books recorded yet.</p>
                  ) : (
                    <ul className="divide-y divide-slate-800 text-xs">
                      {patronLoans.history.slice(0, 6).map((h) => (
                        <li key={h.id} className="py-2 flex items-center justify-between gap-2">
                          <span className="text-slate-200 font-medium truncate"><bdi>{h.bookTitle}</bdi></span>
                          <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                            <bdi>{h.returnDate || h.dueDate}</bdi>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>

              {/* Right Column: Personalized Recommendations */}
              <div className="lg:col-span-7">
                <section className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-emerald-400" />
                        {language === 'dv' ? 'ތިބާއަށް ޚާއްޞަ ފޮތްތައް' : 'Recommended Reads for You'}
                      </h3>
                      <p className="text-xs text-slate-400">
                        Matched to {activePatron.grade || 'your reading tier'} and library availability
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {recommendations.map((book) => {
                      const alreadyHeld = patronHolds.some((h) => h.bookId === book.id);
                      return (
                        <div
                          key={book.id}
                          className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3.5 flex gap-3.5 items-start"
                        >
                          <div className="w-16 h-24 rounded-xl overflow-hidden border border-slate-800 shrink-0">
                            <BookCoverFallback src={book.coverUrl} title={book.title} author={book.author} />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <div className="text-[11px] text-emerald-400 font-semibold truncate">
                              {localizeCategory(book.category)}
                            </div>
                            <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                              <bdi>{book.title}</bdi>
                            </h4>
                            <p className="text-[11px] text-slate-400 truncate"><bdi>{book.author}</bdi></p>
                            <div className="text-[11px] text-slate-300 font-mono tabular-nums flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-emerald-400 shrink-0" />
                              <span className="truncate">
                                {book.availableCopies} of {book.totalCopies} avail · {book.shelfLocation}
                              </span>
                            </div>

                            <div className="pt-1">
                              {alreadyHeld ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-400">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Hold Placed
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onReserveForPatron(book, activePatron);
                                    setKioskNotice(`Hold placed for "${book.title}" under ${activePatron.name}.`);
                                  }}
                                  className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                                >
                                  <Bookmark className="w-3 h-3" />
                                  {book.availableCopies > 0 ? 'Hold for Pickup' : 'Join Queue'}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
