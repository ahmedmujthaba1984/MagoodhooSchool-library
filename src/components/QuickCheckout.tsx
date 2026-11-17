import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  QrCode, BookOpen, User, Calendar, CheckCircle2, AlertTriangle,
  RotateCcw, Layers, RefreshCw, Bookmark, Flame, Mic, MicOff, Loader2,
  Camera, X, Scan, ShieldAlert
} from 'lucide-react';
import { Book, UserProfile, Loan, LibrarySettings, Reservation } from '../types';
import { useLanguage } from '../lib/i18n';
import {
  calculatePolicyOverdueFine,
  calculateSchoolDueDate,
  DEFAULT_MALDIVES_SCHOOL_HOLIDAYS,
  resolvePatronCirculationPolicy
} from '../lib/schoolCalendar';
import { playScanFeedback, ScanFeedbackType } from '../lib/barcodeSvg';
import { BookCoverFallback } from './BookCoverFallback';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { useToast } from '../lib/toast';

interface QuickCheckoutProps {
  books: Book[];
  users: UserProfile[];
  loans: Loan[];
  reservations?: Reservation[];
  settings: LibrarySettings;
  onProcessCheckout: (book: Book, borrower: UserProfile, dueDateDays: number, copyBarcode?: string) => void;
  onProcessReturn: (loan: Loan, calculatedFee: number) => void;
  onRenewLoan?: (loan: Loan) => void;
  onOpenScanner: () => void;
  preselectedBook?: Book | null;
  preselectedMemberId?: string | null;
}

type DeskFlashState = {
  type: Exclude<ScanFeedbackType, 'success' | 'error'>;
  title: string;
  detail: string;
} | null;

export const QuickCheckout: React.FC<QuickCheckoutProps> = ({
  books,
  users,
  loans,
  reservations = [],
  settings,
  onProcessCheckout,
  onProcessReturn,
  onRenewLoan,
  onOpenScanner,
  preselectedBook,
  preselectedMemberId
}) => {
  const { t, language } = useLanguage();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'checkout' | 'return' | 'renew'>('checkout');

  // Universal Scanner Input (Left Pane)
  const universalInputRef = useRef<HTMLInputElement | null>(null);
  const [universalCode, setUniversalCode] = useState('');
  const [showInlineCamera, setShowInlineCamera] = useState(false);
  const inlineScannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Active Checkout/Session Selection
  const [selectedBookBarcode, setSelectedBookBarcode] = useState(preselectedBook?.barcode || '');
  const [selectedStudentCode, setSelectedStudentCode] = useState(preselectedMemberId || '');
  const [borrowDays, setBorrowDays] = useState(settings.maxBorrowDays || 14);

  // Distinct Audio & Visual Feedback Flash
  const [deskFlash, setDeskFlash] = useState<DeskFlashState>(null);

  // Return Tab State
  const [returnBarcode, setReturnBarcode] = useState('');
  const [lastReturnedReceipt, setLastReturnedReceipt] = useState<{
    bookTitle: string;
    copyBarcode?: string;
    userName: string;
    returnDate: string;
    lateFee: number;
    holdWaitingPatron?: string;
  } | null>(null);

  const triggerDeskFeedback = (type: Exclude<ScanFeedbackType, 'success' | 'error'>, title: string, detail: string) => {
    playScanFeedback(type);
    setDeskFlash({ type, title, detail });
    setTimeout(() => {
      setDeskFlash((current) => (current?.title === title && current?.detail === detail ? null : current));
    }, 5500);
  };

  // Sync preselected book / member from URL/Command Palette/Catalog
  useEffect(() => {
    if (preselectedBook?.barcode) {
      setSelectedBookBarcode(preselectedBook.barcode);
    }
  }, [preselectedBook]);

  useEffect(() => {
    if (preselectedMemberId) {
      setSelectedStudentCode(preselectedMemberId);
    }
  }, [preselectedMemberId]);

  // Auto-focus universal scanner on mount and tab switch
  useEffect(() => {
    if (activeTab === 'checkout') {
      const timer = setTimeout(() => universalInputRef.current?.focus(), 80);
      return () => clearTimeout(timer);
    }
  }, [activeTab]);

  // Helper: Identify whether scanned code is a Patron ID or Book/Copy Barcode
  const classifyScannedCode = (raw: string) => {
    const q = raw.trim().toLowerCase();
    if (!q) return { kind: 'empty' as const };

    const patronMatch = users.find(
      (u) =>
        u.studentIdCode?.toLowerCase() === q ||
        u.staffIdCode?.toLowerCase() === q ||
        u.id.toLowerCase() === q
    );
    if (patronMatch) {
      return { kind: 'patron' as const, patron: patronMatch };
    }

    for (const b of books) {
      if (b.barcode.toLowerCase() === q || b.isbn.toLowerCase() === q || b.id.toLowerCase() === q) {
        const availCopy = b.copies?.find((c) => c.status === 'Available')?.barcode;
        return { kind: 'book' as const, book: b, copyBarcode: availCopy || b.barcode, scannedExactCopy: false };
      }
      const copyMatch = b.copies?.find((c) => c.barcode.toLowerCase() === q);
      if (copyMatch) {
        return { kind: 'book' as const, book: b, copyBarcode: copyMatch.barcode, scannedExactCopy: true };
      }
    }

    const upper = raw.trim().toUpperCase();
    if (/^(STU|STF|TCH|ADM|LIB)-/.test(upper)) {
      return { kind: 'unknown_patron' as const };
    }
    return { kind: 'unknown_book' as const };
  };

  // Match selected Book / Copy
  const { matchedBook, matchedCopyBarcode } = useMemo(() => {
    const q = selectedBookBarcode.trim().toLowerCase();
    if (!q) return { matchedBook: undefined, matchedCopyBarcode: undefined };

    for (const b of books) {
      if (b.barcode.toLowerCase() === q || b.isbn.toLowerCase() === q || b.id.toLowerCase() === q) {
        const firstAvailCopy = b.copies?.find((c) => c.status === 'Available')?.barcode;
        return { matchedBook: b, matchedCopyBarcode: firstAvailCopy };
      }
      const copyMatch = b.copies?.find((c) => c.barcode.toLowerCase() === q);
      if (copyMatch) {
        return { matchedBook: b, matchedCopyBarcode: copyMatch.barcode };
      }
    }
    return { matchedBook: undefined, matchedCopyBarcode: undefined };
  }, [books, selectedBookBarcode]);

  // Match selected Patron
  const matchedStudent = useMemo(() => {
    const q = selectedStudentCode.trim().toLowerCase();
    if (!q) return undefined;
    return users.find(
      (u) =>
        u.studentIdCode?.toLowerCase() === q ||
        u.staffIdCode?.toLowerCase() === q ||
        u.id.toLowerCase() === q ||
        u.name.toLowerCase().includes(q)
    );
  }, [users, selectedStudentCode]);

  // Resolved Patron CirculationPolicy
  const resolvedTierPolicy = useMemo(() => {
    if (!matchedStudent) return null;
    return resolvePatronCirculationPolicy(matchedStudent, settings);
  }, [matchedStudent, settings]);

  useEffect(() => {
    if (resolvedTierPolicy?.loanDays) {
      setBorrowDays(resolvedTierPolicy.loanDays);
    }
  }, [resolvedTierPolicy?.tier, resolvedTierPolicy?.loanDays]);

  // Right Pane: Active Session Context Snapshot
  const borrowerSnapshot = useMemo(() => {
    if (!matchedStudent || !resolvedTierPolicy) return null;
    const activeLoans = loans.filter(
      (l) => l.userId === matchedStudent.id && (l.status === 'active' || l.status === 'overdue')
    );
    const overdueCount = activeLoans.filter((l) => l.status === 'overdue').length;
    const unpaidFinesMvr = loans
      .filter((l) => l.userId === matchedStudent.id && !l.feePaid && (l.lateFee || 0) > 0)
      .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);
    const maxAllowed = resolvedTierPolicy.maxBooks;
    const fineBlockLimit = settings.blockBorrowingFineThreshold ?? 30;

    return {
      activeLoans,
      overdueCount,
      unpaidFinesMvr,
      maxAllowed,
      tierLabel: resolvedTierPolicy.tier,
      allowReferenceCheckout: resolvedTierPolicy.allowReferenceCheckout,
      isLimitReached: activeLoans.length >= maxAllowed,
      isFineBlocked: unpaidFinesMvr >= fineBlockLimit,
      fineBlockLimit,
    };
  }, [matchedStudent, resolvedTierPolicy, loans, settings]);

  // Execute Return via Automated Policy Fine Engine
  const executeReturnForLoan = (loan: Loan, book?: Book) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const borrower = users.find((u) => u.id === loan.userId);
    const fineBreakdown = calculatePolicyOverdueFine({
      loan,
      patron: borrower,
      settings,
      returnDateStr: todayStr,
    });
    const lateFee = fineBreakdown.calculatedFineMvr;

    onProcessReturn(loan, lateFee);

    const waitingHold = reservations.find(
      (r) => r.bookId === loan.bookId && r.status === 'pending'
    );

    if (waitingHold) {
      triggerDeskFeedback(
        'hold_triggered',
        language === 'dv' ? 'ހޯލްޑް އެލާޓް — ޑެސްކުގައި ބަހައްޓަވާ!' : `Hold Triggered for ${waitingHold.userName}`,
        `"${book?.title || loan.bookTitle}" returned and reserved for ${waitingHold.userName}. Place on Hold Shelf.`
      );
    } else {
      triggerDeskFeedback(
        'returned',
        language === 'dv' ? 'ފޮތް އަނބުރާ ބަލައިގަނެވިއްޖެ' : `Returned: ${book?.title || loan.bookTitle}`,
        lateFee > 0
          ? `Assessed MVR ${lateFee.toFixed(2)} (${fineBreakdown.chargeableDays} chargeable Sun–Thu days @ MVR ${fineBreakdown.dailyFineMvr.toFixed(2)}/day).`
          : `Checked in on time from ${borrower?.name || loan.userName}.`
      );
    }

    setLastReturnedReceipt({
      bookTitle: book?.title || loan.bookTitle,
      copyBarcode: loan.copyBarcode,
      userName: borrower?.name || loan.userName,
      returnDate: todayStr,
      lateFee,
      holdWaitingPatron: waitingHold ? waitingHold.userName : undefined,
    });
  };

  // Core Checkout Validation + Dispatch
  const attemptCheckout = (targetBook: Book, targetPatron: UserProfile, copyBarcode?: string) => {
    const policy = resolvePatronCirculationPolicy(targetPatron, settings);
    const patronActiveLoans = loans.filter(
      (l) => l.userId === targetPatron.id && (l.status === 'active' || l.status === 'overdue')
    );
    const patronUnpaidMvr = loans
      .filter((l) => l.userId === targetPatron.id && !l.feePaid && (l.lateFee || 0) > 0)
      .reduce((sum, l) => sum + Math.max(0, (l.lateFee || 0) - (l.amountPaid || 0)), 0);

    if (targetBook.isReferenceOnly && !policy.allowReferenceCheckout) {
      triggerDeskFeedback(
        'blocked',
        language === 'dv' ? 'ބޭރަށް ދޫނުކުރެވޭ (Reference Only)' : 'Blocked: Reference-Only Item',
        `"${targetBook.title}" cannot be checked out under the ${policy.tier} policy.`
      );
      return false;
    }

    if (targetBook.availableCopies <= 0) {
      triggerDeskFeedback(
        'blocked',
        language === 'dv' ? 'ހުރިހާ ކޮޕީއެއް ދޫކުރެވިފައި' : 'Blocked: No Available Copies',
        `All copies of "${targetBook.title}" are currently checked out.`
      );
      return false;
    }

    if (patronActiveLoans.length >= policy.maxBooks) {
      triggerDeskFeedback(
        'blocked',
        language === 'dv' ? 'ފޮތް ނެގޭ ލިމިޓް ހަމަވެއްޖެ' : 'Blocked: Borrowing Quota Reached',
        `${targetPatron.name} already has ${patronActiveLoans.length}/${policy.maxBooks} active loans.`
      );
      return false;
    }

    const threshold = settings.blockBorrowingFineThreshold ?? 30;
    if (patronUnpaidMvr >= threshold) {
      triggerDeskFeedback(
        'blocked',
        language === 'dv' ? 'ޖޫރިމަނާ ލިމިޓަށްވުރެ އިތުރު' : 'Blocked: Unpaid Fine Balance',
        `${targetPatron.name} owes MVR ${patronUnpaidMvr.toFixed(2)} (block threshold: MVR ${threshold.toFixed(2)}).`
      );
      return false;
    }

    const activeHoldForAnother = reservations.find(
      (r) => r.bookId === targetBook.id && r.status === 'pending' && r.userId !== targetPatron.id
    );
    if (activeHoldForAnother && targetBook.availableCopies <= 1) {
      triggerDeskFeedback(
        'hold_triggered',
        language === 'dv' ? 'ހޯލްޑް ކިއު އެބައޮތް' : 'Hold Conflict Detected',
        `Last available copy is reserved for ${activeHoldForAnother.userName}.`
      );
      return false;
    }

    onProcessCheckout(targetBook, targetPatron, borrowDays, copyBarcode);
    triggerDeskFeedback(
      'checked_out',
      language === 'dv' ? 'ކާމިޔާބުކަމާއެކު ދޫކުރެވިއްޖެ' : `Checked Out: ${targetBook.title}`,
      `${copyBarcode || targetBook.barcode} issued to ${targetPatron.name} for ${borrowDays} working days.`
    );
    setSelectedBookBarcode('');
    return true;
  };

  // Universal Scanner Submission Handler (Auto-detects Patron ID vs Book/Copy Barcode)
  const handleUniversalScanSubmit = (rawInput: string) => {
    const trimmed = rawInput.trim();
    if (!trimmed) return;

    const classification = classifyScannedCode(trimmed);

    if (classification.kind === 'patron') {
      const patronCode = classification.patron.studentIdCode || classification.patron.staffIdCode || classification.patron.id;
      setSelectedStudentCode(patronCode);
      setActiveTab('checkout');
      playScanFeedback('success');
      toast.info(`Active patron loaded: ${classification.patron.name}`, 'Patron Detected');
      setUniversalCode('');
      universalInputRef.current?.focus();
      return;
    }

    if (classification.kind === 'book') {
      const { book, copyBarcode } = classification;
      // Check if this exact copy barcode (or last copy) is currently checked out -> rapid check-in
      const activeLoan =
        loans.find(
          (l) => l.copyBarcode?.toLowerCase() === trimmed.toLowerCase() && (l.status === 'active' || l.status === 'overdue')
        ) ||
        (book.availableCopies === 0
          ? loans.find((l) => l.bookId === book.id && (l.status === 'active' || l.status === 'overdue'))
          : undefined);

      if (activeLoan) {
        executeReturnForLoan(activeLoan, book);
        setUniversalCode('');
        universalInputRef.current?.focus();
        return;
      }

      setSelectedBookBarcode(copyBarcode || book.barcode);
      if (matchedStudent) {
        attemptCheckout(book, matchedStudent, copyBarcode);
      } else {
        playScanFeedback('success');
        toast.info(`Book ready: "${book.title}". Now scan Patron ID.`, 'Book Detected');
      }
      setUniversalCode('');
      universalInputRef.current?.focus();
      return;
    }

    triggerDeskFeedback(
      'blocked',
      language === 'dv' ? 'ކޯޑު ނުފެނުނު' : 'Unrecognized Barcode',
      `No patron ID or catalog copy matched "${trimmed}".`
    );
    setUniversalCode('');
    universalInputRef.current?.focus();
  };

  // Global USB Hardware Barcode Scanner burst listener
  useBarcodeScanner({
    enabled: true,
    onScan: (code) => {
      handleUniversalScanSubmit(code);
    },
  });

  // Inline html5-qrcode Camera Scanner Lifecycle
  useEffect(() => {
    if (!showInlineCamera) return;
    const scanner = new Html5QrcodeScanner(
      'desk-inline-qr-reader',
      {
        fps: 10,
        qrbox: { width: 250, height: 140 },
        aspectRatio: 1.777778,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        handleUniversalScanSubmit(decodedText);
      },
      () => {}
    );

    inlineScannerRef.current = scanner;
    return () => {
      inlineScannerRef.current?.clear().catch(() => {});
      inlineScannerRef.current = null;
    };
  }, [showInlineCamera, matchedStudent, loans, books, users]);

  // Voice Assistant
  const { isRecording, isTranscribing, toggleRecording } = useVoiceAssistant({
    language,
    onTranscript: (text) => {
      if (activeTab === 'return') {
        setReturnBarcode(text);
      } else {
        const matchedByTitle = books.find((b) => b.title.toLowerCase().includes(text.toLowerCase()));
        setSelectedBookBarcode(matchedByTitle ? (matchedByTitle.copies?.[0]?.barcode || matchedByTitle.barcode) : text);
      }
    },
    onError: (msg) => toast.warning(msg, t.voiceAssistant),
  });

  // Return Tab book/loan lookup
  const { returnTargetBook, returnActiveLoan } = useMemo(() => {
    const q = returnBarcode.trim().toLowerCase();
    if (!q) return { returnTargetBook: undefined, returnActiveLoan: undefined };

    const exactLoanByCopy = loans.find(
      (l) => l.copyBarcode?.toLowerCase() === q && (l.status === 'active' || l.status === 'overdue')
    );
    if (exactLoanByCopy) {
      return {
        returnTargetBook: books.find((b) => b.id === exactLoanByCopy.bookId),
        returnActiveLoan: exactLoanByCopy,
      };
    }

    const bookMatch = books.find(
      (b) =>
        b.barcode.toLowerCase() === q ||
        b.isbn.toLowerCase() === q ||
        b.id.toLowerCase() === q ||
        b.copies?.some((c) => c.barcode.toLowerCase() === q)
    );
    const activeLoan = loans.find(
      (l) => l.bookId === bookMatch?.id && (l.status === 'active' || l.status === 'overdue')
    );
    return { returnTargetBook: bookMatch, returnActiveLoan: activeLoan };
  }, [books, loans, returnBarcode]);

  const handleManualCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!matchedBook) {
      triggerDeskFeedback(
        'blocked',
        'No Book Selected',
        language === 'dv' ? 'ދޫކުރާނެ ފޮތެއް ސްކޭންކުރައްވާ ނުވަތަ ޚިޔާރުކުރައްވާ.' : 'Scan or select a valid book or copy barcode.'
      );
      return;
    }
    if (!matchedStudent) {
      triggerDeskFeedback(
        'blocked',
        'No Patron Selected',
        language === 'dv' ? 'ފޮތް ނަގާ މެންބަރު ޚިޔާރުކުރައްވާ.' : 'Scan or select a valid patron / student ID.'
      );
      return;
    }
    attemptCheckout(matchedBook, matchedStudent, matchedCopyBarcode);
    universalInputRef.current?.focus();
  };

  const handleReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!returnBarcode.trim()) return;
    if (!returnTargetBook || !returnActiveLoan) {
      triggerDeskFeedback(
        'blocked',
        'Active Loan Not Found',
        `No active loan matched "${returnBarcode.trim()}".`
      );
      return;
    }
    executeReturnForLoan(returnActiveLoan, returnTargetBook);
    setReturnBarcode('');
  };

  const activeCirculatingLoans = useMemo(
    () => loans.filter((l) => l.status === 'active' || l.status === 'overdue'),
    [loans]
  );

  const flashBannerStyle = (type: NonNullable<DeskFlashState>['type']) => {
    if (type === 'checked_out') {
      return 'bg-emerald-50 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100';
    }
    if (type === 'returned') {
      return 'bg-sky-50 dark:bg-sky-950/50 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-100';
    }
    if (type === 'hold_triggered') {
      return 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100';
    }
    return 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100';
  };

  const patronInitials = (name: string) =>
    name
      .split(' ')
      .map((s) => s.charAt(0))
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Compact Desk Toolbar */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            <QrCode className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ސާކިއުލޭޝަން ޑެސްކް' : 'Rapid Split-Screen Circulation Desk'}</span>
            <span aria-hidden="true">·</span>
            <span className="text-slate-500 dark:text-slate-400 font-normal">
              {language === 'dv' ? 'ބާކޯޑް / ކޮޕީ އައިޑީ އޮޓޯ-ޑިޓެކްޓް' : 'Auto-Detect Patron & Book Copy Barcodes'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">{t.scanCheckout}</h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowInlineCamera((prev) => !prev)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap border ${
              showInlineCamera
                ? 'bg-emerald-700 text-white border-emerald-700'
                : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            <Camera className="w-4 h-4" />
            <span>{showInlineCamera ? 'Hide Inline Camera' : 'Inline Camera'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 whitespace-nowrap"
            id="desk-launch-camera-scanner-btn"
          >
            <QrCode className="w-4 h-4 text-emerald-400 dark:text-white" />
            <span>{language === 'dv' ? 'ފުލް ސްކޭނަރ' : 'Scanner Modal'}</span>
          </button>
        </div>
      </div>

      {/* Acoustic + Visual Feedback Banner */}
      {deskFlash && (
        <div
          role="status"
          className={`rounded-2xl border p-4 flex items-center justify-between gap-3 transition-all ${flashBannerStyle(deskFlash.type)}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {deskFlash.type === 'blocked' ? (
              <ShieldAlert className="w-5 h-5 shrink-0" />
            ) : deskFlash.type === 'hold_triggered' ? (
              <Bookmark className="w-5 h-5 shrink-0" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{deskFlash.title}</div>
              <div className="text-xs opacity-90">{deskFlash.detail}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDeskFlash(null)}
            className="p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer shrink-0"
            aria-label="Dismiss notification"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Mode Segmented Control */}
      <div className="bg-white dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 flex gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('checkout')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'checkout'
              ? 'bg-emerald-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="checkout-tab-btn"
        >
          <BookOpen className="w-4 h-4" /> {t.quickCheckout}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('return')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'return'
              ? 'bg-slate-900 dark:bg-emerald-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="return-tab-btn"
        >
          <RotateCcw className="w-4 h-4" /> {t.returnBook}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('renew')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'renew'
              ? 'bg-sky-700 text-white'
              : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
          id="renew-tab-btn"
        >
          <RefreshCw className="w-4 h-4" /> {language === 'dv' ? 'މުއްދަތު އިތުރުކުރުން' : 'Quick Renew'}
        </button>
      </div>

      {/* SPLIT-SCREEN CHECKOUT & RAPID SCAN MODE */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANE: Auto-Focused Universal Scanner & Action Trigger (7 cols) */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
            {/* Universal Laser / Camera Auto-Detect Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUniversalScanSubmit(universalCode);
              }}
              className="space-y-2.5 pb-4 border-b border-slate-200 dark:border-slate-800"
            >
              <div className="flex items-center justify-between text-xs font-bold text-slate-900 dark:text-white">
                <span className="flex items-center gap-1.5">
                  <Scan className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  {language === 'dv' ? 'ޔުނިވާސަލް ބާކޯޑް ސްކޭނަރ' : 'Universal Barcode Scanner (Auto-Detect)'}
                </span>
                <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                  STU-xxxx · MAG-xxx-xx
                </span>
              </div>

              <div className="flex gap-2">
                <input
                  ref={universalInputRef}
                  type="text"
                  autoFocus
                  value={universalCode}
                  onChange={(e) => setUniversalCode(e.target.value)}
                  placeholder={
                    language === 'dv'
                      ? 'މެންބަރުގެ އައިޑީ ނުވަތަ ފޮތުގެ ކޮޕީ ބާކޯޑު ސްކޭންކުރައްވާ...'
                      : 'Ready for USB laser scan — Patron ID or Book Copy Barcode...'
                  }
                  className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border-2 border-emerald-600/50 dark:border-emerald-500/50 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                  id="universal-desk-scanner-input"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer whitespace-nowrap"
                >
                  Detect
                </button>
              </div>

              {showInlineCamera && (
                <div className="pt-2 space-y-2">
                  <div
                    id="desk-inline-qr-reader"
                    className="w-full rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-950"
                  />
                </div>
              )}
            </form>

            {/* Step-by-Step Manual / Assisted Form */}
            <form onSubmit={handleManualCheckoutSubmit} className="space-y-4">
              {/* Book Selection */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>1. {t.step1SelectBook}</span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">ISBN / Copy Barcode</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <QrCode className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={selectedBookBarcode}
                      onChange={(e) => setSelectedBookBarcode(e.target.value)}
                      placeholder={language === 'dv' ? 'ބާކޯޑު ޖައްސަވާ...' : 'Copy Barcode (e.g. MAG-823-01-01)...'}
                      className="w-full ps-10 pe-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      id="checkout-barcode-input"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isTranscribing}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
                      isRecording
                        ? 'bg-rose-600 text-white ring-2 ring-rose-300 dark:ring-rose-800'
                        : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700'
                    }`}
                    title={t.voiceAssistant}
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    )}
                  </button>
                  <select
                    value={matchedBook?.barcode || ''}
                    onChange={(e) => setSelectedBookBarcode(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white sm:max-w-[210px] focus:outline-none cursor-pointer"
                  >
                    <option value="">{t.quickSelectBook}</option>
                    {books.map((b) => (
                      <option key={b.id} value={b.barcode}>
                        {b.title} ({b.availableCopies}/{b.totalCopies})
                      </option>
                    ))}
                  </select>
                </div>

                {matchedBook && (
                  <div className="p-3 bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center gap-3.5 text-xs">
                    <BookCoverFallback src={matchedBook.coverUrl} title={matchedBook.title} className="w-11 h-15 rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-bold text-slate-900 dark:text-white truncate"><bdi>{matchedBook.title}</bdi></div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        <bdi>{matchedBook.author}</bdi> · <bdi className="font-mono">{matchedBook.ddcCallNumber || 'DDC'}</bdi> · <bdi>{matchedBook.shelfLocation}</bdi>
                      </div>
                      <div className="text-[11px] font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {matchedCopyBarcode && <span>Copy: <bdi>{matchedCopyBarcode}</bdi> · </span>}
                        <span className={matchedBook.availableCopies > 0 ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-rose-600 dark:text-rose-400 font-bold'}>
                          {matchedBook.isReferenceOnly ? t.statusReferenceOnly : `${matchedBook.availableCopies}/${matchedBook.totalCopies} ${t.available}`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Patron Selection */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between text-xs font-bold text-slate-800 dark:text-slate-200">
                  <span>2. {t.step2SelectStudent}</span>
                  <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Patron ID / Name</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <User className="w-4 h-4 text-slate-400 absolute start-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={selectedStudentCode}
                      onChange={(e) => setSelectedStudentCode(e.target.value)}
                      placeholder={language === 'dv' ? 'ދަރިވަރުގެ އައިޑީ (STU-2041)...' : 'Scan Student/Staff ID (e.g. STU-2041) or type name...'}
                      className="w-full ps-10 pe-3.5 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      id="checkout-student-code-input"
                    />
                  </div>
                  <select
                    value={matchedStudent?.studentIdCode || matchedStudent?.staffIdCode || matchedStudent?.id || ''}
                    onChange={(e) => setSelectedStudentCode(e.target.value)}
                    className="px-3 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white sm:max-w-[210px] focus:outline-none cursor-pointer"
                  >
                    <option value="">{t.quickSelectStudent}</option>
                    {users
                      .filter((u) => u.role === 'student' || u.role === 'staff' || u.role === 'admin')
                      .map((u) => (
                        <option key={u.id} value={u.studentIdCode || u.staffIdCode || u.id}>
                          {u.name} ({u.grade || u.staffDepartment || u.role})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Duration & Sun–Thu School Calendar */}
              <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200">3. {t.step3LoanDuration}</div>
                <div className="flex flex-wrap items-center gap-3 bg-slate-50 dark:bg-slate-950/60 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-slate-700 dark:text-slate-300">{t.borrowDurationDays}</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={borrowDays}
                      onChange={(e) => setBorrowDays(parseInt(e.target.value) || 14)}
                      className="w-16 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-mono tabular-nums font-bold text-center text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                    <span>{t.calculatedDueDate}</span>
                    <span className="font-mono tabular-nums font-bold text-emerald-800 dark:text-emerald-300">
                      <bdi>{calculateSchoolDueDate(new Date(), borrowDays, settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS)}</bdi>
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">{t.schoolWeekNote}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
                id="confirm-checkout-btn"
              >
                <CheckCircle2 className="w-4 h-4" /> {t.confirmCheckout}
              </button>
            </form>
          </div>

          {/* RIGHT PANE: Active Session Context (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                {language === 'dv' ? 'މެންބަރުގެ ލައިވް ސްޓޭޓަސް' : 'Active Session Context'}
              </h3>
              {matchedStudent && resolvedTierPolicy && (
                <span className="text-[11px] font-mono uppercase font-bold text-emerald-700 dark:text-emerald-400">
                  {resolvedTierPolicy.tier} · MVR {resolvedTierPolicy.dailyFineMvr.toFixed(2)}/d
                </span>
              )}
            </div>

            {matchedStudent && borrowerSnapshot ? (
              <div className="space-y-4 text-xs">
                {/* Patron Photo + Identity */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {matchedStudent.photoUrl ? (
                      <img
                        src={matchedStudent.photoUrl}
                        alt={matchedStudent.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-slate-900 dark:bg-emerald-700 text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        {patronInitials(matchedStudent.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-slate-900 dark:text-white text-sm truncate">
                        <bdi>{matchedStudent.name}</bdi>
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <bdi className="font-mono">{matchedStudent.studentIdCode || matchedStudent.staffIdCode || matchedStudent.id}</bdi>
                        {' · '}
                        <bdi>{matchedStudent.grade || matchedStudent.staffDepartment || matchedStudent.role}</bdi>
                      </div>
                    </div>
                  </div>
                  {matchedStudent.readingStreakDays ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono tabular-nums shrink-0">
                      <Flame className="w-3.5 h-3.5" /> <bdi>{matchedStudent.readingStreakDays}d streak</bdi>
                    </span>
                  ) : null}
                </div>

                {/* Loan Quota & Fine Balance Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      {language === 'dv' ? 'ނެގި ކޯޓާ' : 'Loan Quota'}
                    </div>
                    <div className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${borrowerSnapshot.isLimitReached ? 'text-rose-700 dark:text-rose-400' : 'text-slate-900 dark:text-white'}`}>
                      <bdi>{borrowerSnapshot.activeLoans.length} / {borrowerSnapshot.maxAllowed}</bdi>
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      {language === 'dv' ? 'މުއްދަތު ހަމަވި' : 'Overdue'}
                    </div>
                    <div className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${borrowerSnapshot.overdueCount > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      <bdi>{borrowerSnapshot.overdueCount}</bdi>
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                      {language === 'dv' ? 'ޖޫރިމަނާ' : 'Fine Balance'}
                    </div>
                    <div className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${borrowerSnapshot.unpaidFinesMvr > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                      <bdi>MVR {borrowerSnapshot.unpaidFinesMvr.toFixed(2)}</bdi>
                    </div>
                  </div>
                </div>

                {/* Fine Balance / Quota Block Alert */}
                {(borrowerSnapshot.isFineBlocked || borrowerSnapshot.isLimitReached) && (
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200 flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                    <span>
                      {borrowerSnapshot.isFineBlocked
                        ? `Borrowing blocked: MVR ${borrowerSnapshot.unpaidFinesMvr.toFixed(2)} unpaid exceeds MVR ${borrowerSnapshot.fineBlockLimit.toFixed(2)}.`
                        : `Loan quota reached (${borrowerSnapshot.activeLoans.length}/${borrowerSnapshot.maxAllowed} books borrowed). Return an item first.`}
                    </span>
                  </div>
                )}

                {/* Active Loans with One-Click Renew / Return */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    <span>{language === 'dv' ? 'މިހާރު ނަގާފައިވާ ފޮތްތައް' : 'Active Borrowed Items'}</span>
                    <span className="font-mono tabular-nums">{borrowerSnapshot.activeLoans.length} active</span>
                  </div>

                  {borrowerSnapshot.activeLoans.length === 0 ? (
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-500 dark:text-slate-400 text-center">
                      {language === 'dv' ? 'މިވަގުތު ނަގާފައިވާ ފޮތެއް ނެތް' : 'Clean record — no books currently checked out.'}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pe-1">
                      {borrowerSnapshot.activeLoans.map((l) => {
                        const hasHoldConflict = reservations.some(
                          (r) => r.bookId === l.bookId && r.userId !== l.userId && r.status === 'pending'
                        );
                        const atMaxRenew = l.renewalCount >= (resolvedTierPolicy?.maxRenewals ?? settings.maxRenewals ?? 2);
                        const targetBook = books.find((b) => b.id === l.bookId);

                        return (
                          <div
                            key={l.id}
                            className="p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-xl space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 dark:text-white truncate">
                                  <bdi>{l.bookTitle}</bdi>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                                  Due: <bdi>{l.dueDate}</bdi>
                                  {l.copyBarcode ? ` · ${l.copyBarcode}` : ''}
                                  {l.status === 'overdue' ? ' · Overdue' : ''}
                                </div>
                              </div>
                              <span
                                className={`text-[10px] font-bold shrink-0 ${
                                  l.status === 'overdue'
                                    ? 'text-rose-700 dark:text-rose-400'
                                    : 'text-emerald-700 dark:text-emerald-400'
                                }`}
                              >
                                {l.status === 'overdue' ? t.statusOverdue : t.statusActive}
                              </span>
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                disabled={!onRenewLoan || hasHoldConflict || atMaxRenew}
                                onClick={() => {
                                  if (onRenewLoan) {
                                    onRenewLoan(l);
                                    playScanFeedback('success');
                                  }
                                }}
                                className="flex-1 py-1.5 px-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-45 text-slate-800 dark:text-slate-200 text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
                              >
                                {hasHoldConflict ? 'Hold Conflict' : atMaxRenew ? 'Max Renewed' : 'Renew'}
                              </button>
                              <button
                                type="button"
                                onClick={() => executeReturnForLoan(l, targetBook)}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
                              >
                                Return
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-500 dark:text-slate-400 space-y-2">
                <User className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                <p>
                  {language === 'dv'
                    ? 'މެންބަރުގެ އައިޑީ ކާޑު ސްކޭންކުރެއްވުމުން ކޯޓާއާއި ޖޫރިމަނާ ފެންނާނެއެވެ.'
                    : 'Scan or select a patron on the left to inspect photo, quota, MVR fine balance, and one-click Renew / Return.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CHECK-IN / RETURN MODE */}
      {activeTab === 'return' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-5">
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">{t.scanOrEnterBarcode}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={returnBarcode}
                onChange={(e) => setReturnBarcode(e.target.value)}
                placeholder={language === 'dv' ? 'ފޮތުގެ ކޮޕީ ބާކޯޑު ނުވަތަ އައި.އެސް.ބީ.އެން ޖައްސަވާ...' : 'Scan book or copy barcode (e.g. MAG-523-01-02 or 9780393356502)...'}
                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-mono font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                autoFocus
                id="return-barcode-input"
              />
              <button
                type="submit"
                className="bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 text-emerald-400 dark:text-white" /> {t.processReturn}
              </button>
            </div>

            {returnTargetBook && returnActiveLoan && (
              <div className="p-4 bg-slate-50 dark:bg-slate-950/60 border border-emerald-300 dark:border-emerald-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <BookCoverFallback src={returnTargetBook.coverUrl} title={returnTargetBook.title} className="w-11 h-15 rounded-lg shrink-0" />
                  <div>
                    <div className="font-bold text-slate-900 dark:text-white"><bdi>{returnTargetBook.title}</bdi></div>
                    <div className="text-[11px] text-slate-600 dark:text-slate-400">
                      {t.returnedBy}: <strong><bdi>{returnActiveLoan.userName}</bdi></strong> · {t.dueDate}: <bdi className="font-mono">{returnActiveLoan.dueDate}</bdi>
                    </div>
                  </div>
                </div>
                <span className={`text-[11px] font-bold ${returnActiveLoan.status === 'overdue' ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}`}>
                  {returnActiveLoan.status === 'overdue' ? t.statusOverdue : t.statusActive}
                </span>
              </div>
            )}

            {lastReturnedReceipt && (
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                    {language === 'dv' ? 'ފޮތް ބަލައިގަނެ ސްޓޮކް އާކުރެވިއްޖެ' : 'Return Verified & Copy Returned to Inventory'}
                  </span>
                  <span className="font-mono text-emerald-800 dark:text-emerald-300"><bdi>{lastReturnedReceipt.returnDate}</bdi></span>
                </div>

                {lastReturnedReceipt.holdWaitingPatron && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 rounded-xl flex items-center gap-2.5 text-amber-950 dark:text-amber-200 font-bold">
                    <Bookmark className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>
                      {language === 'dv'
                        ? `ހޯލްޑް އެލާޓް: "${lastReturnedReceipt.userName}" ގެ އަތުން ލިބުނު މި ފޮތް "${lastReturnedReceipt.holdWaitingPatron}" ވަނީ ނަންނޯޓު ކޮށްފައެވެ. ޑެސްކުގައި ބަހައްޓަވާ!`
                        : `HOLD QUEUE ALERT: "${lastReturnedReceipt.holdWaitingPatron}" has an active reservation for this title. Place on Hold Shelf!`}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-slate-700 dark:text-slate-300">
                  <span>
                    <strong className="text-slate-900 dark:text-white"><bdi>{lastReturnedReceipt.bookTitle}</bdi></strong> · {t.returnedBy} <bdi>{lastReturnedReceipt.userName}</bdi>
                  </span>
                  <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                    {lastReturnedReceipt.lateFee > 0 ? `Fine Assessed: MVR ${lastReturnedReceipt.lateFee.toFixed(2)}` : t.noFine}
                  </span>
                </div>
              </div>
            )}
          </form>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>{language === 'dv' ? 'އަނބުރާ ޙަވާލުކުރަންޖެހޭ ފޮތްތައް' : 'Active Loans Pending Return'} (<bdi className="font-mono tabular-nums">{activeCirculatingLoans.length}</bdi>)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto">
              {activeCirculatingLoans.map((loan) => {
                const borrower = users.find((u) => u.id === loan.userId);
                const estFine = calculatePolicyOverdueFine({ loan, patron: borrower, settings }).calculatedFineMvr;
                return (
                  <button
                    key={loan.id}
                    type="button"
                    onClick={() => executeReturnForLoan(loan, books.find((b) => b.id === loan.bookId))}
                    className={`p-3.5 rounded-xl border text-start transition flex items-center justify-between gap-3 cursor-pointer ${
                      loan.status === 'overdue'
                        ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900 hover:bg-rose-100/70'
                        : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800 hover:bg-emerald-50/70 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-xs text-slate-900 dark:text-white truncate"><bdi>{loan.bookTitle}</bdi></div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        <bdi>{loan.userName}</bdi> · <bdi className="font-mono">{loan.dueDate}</bdi>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 whitespace-nowrap ${
                      loan.status === 'overdue' ? 'bg-rose-600 text-white' : 'bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200'
                    }`}>
                      {estFine > 0 ? `Check-in (MVR ${estFine.toFixed(2)})` : 'Check-in'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* QUICK RENEW MODE */}
      {activeTab === 'renew' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {language === 'dv' ? 'ފޮތުގެ މުއްދަތު އިތުރުކުރުން (Renewals)' : 'Quick Loan Renewals & Hold Conflict Check'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'dv'
                ? 'އެހެން މެންބަރަކު ރިޒާވް ކޮށްފައިވާ ފޮތެއްގެ މުއްދަތު އިތުރުކުރުން ސިސްޓަމުން އޮޓޮމެޓިކުން ހުއްޓުވާނެއެވެ.'
                : 'Renewals follow Sun–Thu working days excluding Maldivian holidays and automatically block extension on active holds.'}
            </p>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {activeCirculatingLoans.map((loan) => {
              const hasHoldConflict = reservations.some(
                (r) => r.bookId === loan.bookId && r.userId !== loan.userId && r.status === 'pending'
              );
              const atLimit = loan.renewalCount >= (settings.maxRenewals || 2);

              return (
                <div key={loan.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap">
                      <bdi>{loan.bookTitle}</bdi>
                      {hasHoldConflict && (
                        <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          · {language === 'dv' ? 'ރިޒަވޭޝަން އެބައޮތް' : 'Hold Conflict'}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      <bdi>{loan.userName}</bdi> · {t.dueDate}: <bdi className="font-mono text-slate-800 dark:text-slate-200">{loan.dueDate}</bdi> · Renewals: <bdi className="font-mono tabular-nums">{loan.renewalCount}/{settings.maxRenewals}</bdi>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!onRenewLoan || atLimit || hasHoldConflict}
                    onClick={() => onRenewLoan && onRenewLoan(loan)}
                    className="px-3.5 py-2 rounded-xl bg-sky-700 hover:bg-sky-800 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 text-white font-bold text-xs transition cursor-pointer shrink-0 whitespace-nowrap"
                  >
                    {hasHoldConflict
                      ? (language === 'dv' ? 'ރިޒާވް ވެފައި' : 'Blocked by Hold')
                      : atLimit
                      ? t.maxRenewed
                      : t.extendLoan}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
