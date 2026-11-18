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
import { StatusPill } from './StatusPill';
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
      return 'bg-[#F0FDF4] dark:bg-[#0F4C45]/40 border-[#BBF7D0] dark:border-[#16655B] text-[#15803D] dark:text-[#A7F3D0]';
    }
    if (type === 'returned') {
      return 'bg-[#EFF6FF] dark:bg-[#1E3A8A]/35 border-[#BFDBFE] dark:border-[#1D4ED8]/60 text-[#1D4ED8] dark:text-[#93C5FD]';
    }
    if (type === 'hold_triggered') {
      return 'bg-[#FFFBEB] dark:bg-[#78350F]/35 border-[#FDE68A] dark:border-[#B45309]/60 text-[#B45309] dark:text-[#FCD34D]';
    }
    return 'bg-[#FEF2F2] dark:bg-[#7F1D1D]/35 border-[#FECACA] dark:border-[#B91C1C]/60 text-[#B91C1C] dark:text-[#FCA5A5]';
  };

  const flashStampLabel = (type: NonNullable<DeskFlashState>['type']) => {
    if (type === 'checked_out') return language === 'dv' ? 'ދޫކުރެވިއްޖެ' : 'CHECKED OUT';
    if (type === 'returned') return language === 'dv' ? 'ބަލައިގަނެވިއްޖެ' : 'RETURNED';
    if (type === 'hold_triggered') return language === 'dv' ? 'ހޯލްޑް ޝެލްފް' : 'HOLD SHELF';
    return language === 'dv' ? 'ހުއްޓުވިފައި' : 'BLOCKED';
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
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
            <QrCode className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>{language === 'dv' ? 'ސާކިއުލޭޝަން ޑެސްކް' : 'Scan & Stamp Circulation Station'}</span>
            <span aria-hidden="true">·</span>
            <span className="text-[#6B655D] dark:text-[#A19B91] font-normal">
              {language === 'dv' ? 'ބާކޯޑް / ކޮޕީ އައިޑީ އޮޓޯ-ޑިޓެކްޓް' : 'Auto-Detect Patron & Book Copy Barcodes'}
            </span>
          </div>
          <h2 className="text-xl font-extrabold text-[#1C1917] dark:text-[#F5F3EE] tracking-tight archival-heading">{t.scanCheckout}</h2>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowInlineCamera((prev) => !prev)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap border ${
              showInlineCamera
                ? 'bg-[#0F4C45] text-white border-[#0F4C45]'
                : 'bg-[#F7F5F0] dark:bg-[#232724] text-[#1C1917] dark:text-[#F5F3EE] border-[#E2DDD5] dark:border-[#2E3330] hover:bg-[#EFECE6] dark:hover:bg-[#2E3330]'
            }`}
          >
            <Camera className="w-4 h-4" strokeWidth={1.75} />
            <span>{showInlineCamera ? 'Hide Inline Camera' : 'Inline Camera'}</span>
          </button>
          <button
            type="button"
            onClick={onOpenScanner}
            className="px-4 py-2.5 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold flex items-center gap-2 transition cursor-pointer shrink-0 whitespace-nowrap shadow-xs"
            id="desk-launch-camera-scanner-btn"
          >
            <QrCode className="w-4 h-4 text-[#F3DFB1]" strokeWidth={1.75} />
            <span>{language === 'dv' ? 'ފުލް ސްކޭނަރ' : 'Scanner Modal'}</span>
          </button>
        </div>
      </div>

      {/* Live Rubber Stamp & Acoustic Feedback Banner */}
      {deskFlash && (
        <div
          role="status"
          className={`rounded-2xl border-2 p-4 flex items-center justify-between gap-3 transition-all ${flashBannerStyle(deskFlash.type)}`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-wrap">
            <span className="stamp-badge px-2.5 py-1 rounded-md border-2 border-current text-[11px] font-mono font-extrabold tracking-widest uppercase shrink-0">
              {flashStampLabel(deskFlash.type)}
            </span>
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
      <div className="bg-[#FFFFFF] dark:bg-[#1A1D1B] p-1.5 rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] flex gap-1.5">
        <button
          type="button"
          onClick={() => setActiveTab('checkout')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'checkout'
              ? 'bg-[#0F4C45] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#232724]'
          }`}
          id="checkout-tab-btn"
        >
          <BookOpen className="w-4 h-4" strokeWidth={1.75} /> {t.quickCheckout}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('return')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'return'
              ? 'bg-[#1C1917] dark:bg-[#0F4C45] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#232724]'
          }`}
          id="return-tab-btn"
        >
          <RotateCcw className="w-4 h-4" strokeWidth={1.75} /> {t.returnBook}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('renew')}
          className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === 'renew'
              ? 'bg-[#C26D3A] text-white shadow-xs'
              : 'text-[#6B655D] dark:text-[#A19B91] hover:bg-[#EFECE6] dark:hover:bg-[#232724]'
          }`}
          id="renew-tab-btn"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={1.75} /> {language === 'dv' ? 'މުއްދަތު އިތުރުކުރުން' : 'Quick Renew'}
        </button>
      </div>

      {/* SPLIT-SCREEN CHECKOUT & RAPID SCAN MODE */}
      {activeTab === 'checkout' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT PANE: Glowing Heritage Emerald Scan Target Zone + Manual Form */}
          <div className="lg:col-span-7 bg-[#FFFFFF] dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 space-y-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleUniversalScanSubmit(universalCode);
              }}
              className="space-y-3 p-4 rounded-2xl bg-[#ECFDF5]/65 dark:bg-[#0F4C45]/20 border-2 border-[#0F4C45]/45 ring-2 ring-[#0F4C45]/10"
            >
              <div className="flex items-center justify-between text-xs font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
                <span className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-[#0F4C45] text-white flex items-center justify-center">
                    <Scan className="w-3.5 h-3.5" strokeWidth={1.75} />
                  </span>
                  {language === 'dv' ? 'ޔުނިވާސަލް ބާކޯޑް ސްކޭނަރ' : 'Universal Barcode Target Zone (Auto-Detect)'}
                </span>
                <bdi dir="ltr" className="text-[11px] font-mono text-[#6B655D] dark:text-[#A19B91]">
                  STU-xxxx · MAG-xxx-xx
                </bdi>
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
                  className="flex-1 px-4 py-3 bg-[#FFFFFF] dark:bg-[#121413] border-2 border-[#0F4C45]/60 rounded-xl text-xs font-mono font-semibold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:border-[#0F4C45] focus:ring-2 focus:ring-[#0F4C45]/20"
                  id="universal-desk-scanner-input"
                />
                <button
                  type="submit"
                  className="px-4 py-2.5 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] text-white text-xs font-bold cursor-pointer whitespace-nowrap shadow-xs"
                >
                  Detect
                </button>
              </div>

              {showInlineCamera && (
                <div className="pt-2 space-y-2">
                  <div
                    id="desk-inline-qr-reader"
                    className="w-full rounded-xl overflow-hidden border border-[#E2DDD5] dark:border-[#2E3330] bg-[#121413]"
                  />
                </div>
              )}
            </form>

            {/* Step-by-Step Manual / Assisted Form */}
            <form onSubmit={handleManualCheckoutSubmit} className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                  <span>1. {t.step1SelectBook}</span>
                  <span className="text-[11px] font-mono text-[#6B655D] dark:text-[#A19B91]">ISBN / Copy Barcode</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <QrCode className="w-4 h-4 text-[#6B655D] absolute start-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={selectedBookBarcode}
                      onChange={(e) => setSelectedBookBarcode(e.target.value)}
                      placeholder={language === 'dv' ? 'ބާކޯޑު ޖައްސަވާ...' : 'Copy Barcode (e.g. MAG-823-01-01)...'}
                      className="w-full ps-10 pe-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-mono font-semibold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                      id="checkout-barcode-input"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isTranscribing}
                    className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shrink-0 ${
                      isRecording
                        ? 'bg-[#B91C1C] text-white ring-2 ring-[#FECACA]'
                        : 'bg-[#F7F5F0] dark:bg-[#232724] hover:bg-[#EFECE6] text-[#1C1917] dark:text-[#F5F3EE] border border-[#E2DDD5] dark:border-[#2E3330]'
                    }`}
                    title={t.voiceAssistant}
                  >
                    {isTranscribing ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : isRecording ? (
                      <MicOff className="w-3.5 h-3.5" />
                    ) : (
                      <Mic className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7]" strokeWidth={1.75} />
                    )}
                  </button>
                  <select
                    value={matchedBook?.barcode || ''}
                    onChange={(e) => setSelectedBookBarcode(e.target.value)}
                    className="px-3 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#F5F3EE] sm:max-w-[210px] focus:outline-none cursor-pointer"
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
                  <div className="p-3 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl flex items-center gap-3.5 text-xs">
                    <BookCoverFallback src={matchedBook.coverUrl} title={matchedBook.title} className="w-11 h-15 rounded-md shrink-0 book-cover-card" />
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE] truncate"><bdi>{matchedBook.title}</bdi></div>
                      <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                        <bdi>{matchedBook.author}</bdi> · <bdi dir="ltr" className="font-mono">{matchedBook.ddcCallNumber || 'DDC'}</bdi> · <bdi dir="ltr">{matchedBook.shelfLocation}</bdi>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {matchedCopyBarcode && (
                          <span className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                            Copy: <bdi dir="ltr" className="font-mono tabular-nums text-[#1C1917] dark:text-[#F5F3EE]">{matchedCopyBarcode}</bdi>
                          </span>
                        )}
                        <StatusPill
                          status={matchedBook.isReferenceOnly ? 'reference' : matchedBook.availableCopies > 0 ? 'available' : 'checked_out'}
                          countPrefix={!matchedBook.isReferenceOnly ? `${matchedBook.availableCopies}/${matchedBook.totalCopies}` : undefined}
                          label={matchedBook.isReferenceOnly ? t.statusReferenceOnly : t.available}
                          compact
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Patron Selection */}
              <div className="space-y-2 pt-2 border-t border-[#E2DDD5]/70 dark:border-[#2E3330]">
                <div className="flex items-center justify-between text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE]">
                  <span>2. {t.step2SelectStudent}</span>
                  <span className="text-[11px] font-mono text-[#6B655D] dark:text-[#A19B91]">Patron ID / Name</span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <User className="w-4 h-4 text-[#6B655D] absolute start-3.5 top-1/2 -translate-y-1/2" strokeWidth={1.75} />
                    <input
                      type="text"
                      value={selectedStudentCode}
                      onChange={(e) => setSelectedStudentCode(e.target.value)}
                      placeholder={language === 'dv' ? 'ދަރިވަރުގެ އައިޑީ (STU-2041)...' : 'Scan Student/Staff ID (e.g. STU-2041) or type name...'}
                      className="w-full ps-10 pe-3.5 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                      id="checkout-student-code-input"
                    />
                  </div>
                  <select
                    value={matchedStudent?.studentIdCode || matchedStudent?.staffIdCode || matchedStudent?.id || ''}
                    onChange={(e) => setSelectedStudentCode(e.target.value)}
                    className="px-3 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-semibold text-[#1C1917] dark:text-[#F5F3EE] sm:max-w-[210px] focus:outline-none cursor-pointer"
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
              <div className="space-y-2 pt-2 border-t border-[#E2DDD5]/70 dark:border-[#2E3330]">
                <div className="text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE]">3. {t.step3LoanDuration}</div>
                <div className="flex flex-wrap items-center gap-3 bg-[#F7F5F0] dark:bg-[#232724] p-3 rounded-xl border border-[#E2DDD5] dark:border-[#2E3330] text-xs">
                  <div className="flex items-center gap-2">
                    <label className="font-semibold text-[#1C1917] dark:text-[#E2DDD5]">{t.borrowDurationDays}</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={borrowDays}
                      onChange={(e) => setBorrowDays(parseInt(e.target.value) || 14)}
                      className="w-16 px-2.5 py-1.5 bg-[#FFFFFF] dark:bg-[#1A1D1B] border border-[#E2DDD5] dark:border-[#2E3330] rounded-lg text-xs font-mono tabular-nums font-bold text-center text-[#1C1917] dark:text-[#F5F3EE]"
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[#6B655D] dark:text-[#A19B91]">
                    <Calendar className="w-3.5 h-3.5 text-[#0F4C45] dark:text-[#6EE7B7]" strokeWidth={1.75} />
                    <span>{t.calculatedDueDate}</span>
                    <bdi dir="ltr" className="font-mono tabular-nums font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
                      {calculateSchoolDueDate(new Date(), borrowDays, settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS)}
                    </bdi>
                    <span className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">{t.schoolWeekNote}</span>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold text-xs py-3 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                id="confirm-checkout-btn"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} /> {t.confirmCheckout}
              </button>
            </form>
          </div>

          {/* RIGHT PANE: Active Session Context (5 cols) */}
          <div className="lg:col-span-5 bg-white dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2DDD5] dark:border-[#2E3330] pb-3">
              <h3 className="archival-heading font-bold text-[#1C1917] dark:text-[#F5F3EE] text-sm">
                {language === 'dv' ? 'މެންބަރުގެ ލައިވް ސްޓޭޓަސް' : 'Active Session Context'}
              </h3>
              {matchedStudent && resolvedTierPolicy && (
                <span className="text-[11px] font-mono uppercase font-bold text-[#0F4C45] dark:text-[#6EE7B7]">
                  <bdi dir="ltr">{resolvedTierPolicy.tier} · MVR {resolvedTierPolicy.dailyFineMvr.toFixed(2)}/d</bdi>
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
                        className="w-12 h-12 rounded-xl object-cover border border-[#E2DDD5] dark:border-[#2E3330] shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-[#0F4C45] text-white font-extrabold text-sm flex items-center justify-center shrink-0">
                        {patronInitials(matchedStudent.name)}
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE] text-sm truncate">
                        <bdi>{matchedStudent.name}</bdi>
                      </div>
                      <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                        <bdi dir="ltr" className="font-mono">{matchedStudent.studentIdCode || matchedStudent.staffIdCode || matchedStudent.id}</bdi>
                        {' · '}
                        <bdi>{matchedStudent.grade || matchedStudent.staffDepartment || matchedStudent.role}</bdi>
                      </div>
                    </div>
                  </div>
                  {matchedStudent.readingStreakDays ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-[#C26D3A] dark:text-[#FBBF24] font-mono tabular-nums shrink-0">
                      <Flame className="w-3.5 h-3.5" /> <bdi dir="ltr">{matchedStudent.readingStreakDays}d streak</bdi>
                    </span>
                  ) : null}
                </div>

                {/* Loan Quota & Fine Balance Metrics */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="p-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl">
                    <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91] font-semibold">
                      {language === 'dv' ? 'ނެގި ކޯޓާ' : 'Loan Quota'}
                    </div>
                    <div className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${borrowerSnapshot.isLimitReached ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#1C1917] dark:text-[#F5F3EE]'}`}>
                      <bdi dir="ltr">{borrowerSnapshot.activeLoans.length} / {borrowerSnapshot.maxAllowed}</bdi>
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl">
                    <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91] font-semibold">
                      {language === 'dv' ? 'މުއްދަތު ހަމަވި' : 'Overdue'}
                    </div>
                    <div className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${borrowerSnapshot.overdueCount > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#15803D] dark:text-[#6EE7B7]'}`}>
                      <bdi dir="ltr">{borrowerSnapshot.overdueCount}</bdi>
                    </div>
                  </div>
                  <div className="p-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl">
                    <div className="text-[10px] text-[#6B655D] dark:text-[#A19B91] font-semibold">
                      {language === 'dv' ? 'ޖޫރިމަނާ' : 'Fine Balance'}
                    </div>
                    <div className={`text-sm font-extrabold font-mono tabular-nums mt-0.5 ${borrowerSnapshot.unpaidFinesMvr > 0 ? 'text-[#B91C1C] dark:text-[#FCA5A5]' : 'text-[#15803D] dark:text-[#6EE7B7]'}`}>
                      <bdi dir="ltr">MVR {borrowerSnapshot.unpaidFinesMvr.toFixed(2)}</bdi>
                    </div>
                  </div>
                </div>

                {/* Fine Balance / Quota Block Alert */}
                {(borrowerSnapshot.isFineBlocked || borrowerSnapshot.isLimitReached) && (
                  <div className="p-3 rounded-xl bg-[#FEF2F2] dark:bg-[#7F1D1D]/30 border border-[#FECACA] dark:border-[#B91C1C] text-[#B91C1C] dark:text-[#FCA5A5] flex items-start gap-2 font-semibold">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {borrowerSnapshot.isFineBlocked
                        ? `Borrowing blocked: MVR ${borrowerSnapshot.unpaidFinesMvr.toFixed(2)} unpaid exceeds MVR ${borrowerSnapshot.fineBlockLimit.toFixed(2)}.`
                        : `Loan quota reached (${borrowerSnapshot.activeLoans.length}/${borrowerSnapshot.maxAllowed} books borrowed). Return an item first.`}
                    </span>
                  </div>
                )}

                {/* Active Loans with One-Click Renew / Return */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-[#6B655D] dark:text-[#A19B91]">
                    <span>{language === 'dv' ? 'މިހާރު ނަގާފައިވާ ފޮތްތައް' : 'Active Borrowed Items'}</span>
                    <bdi dir="ltr" className="font-mono tabular-nums">{borrowerSnapshot.activeLoans.length} active</bdi>
                  </div>

                  {borrowerSnapshot.activeLoans.length === 0 ? (
                    <div className="p-4 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-[#6B655D] dark:text-[#A19B91] text-center">
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
                            className="checkout-ledger-slip p-3 rounded-xl space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE] truncate">
                                  <bdi>{l.bookTitle}</bdi>
                                </div>
                                <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91] font-mono tabular-nums">
                                  Due: <bdi dir="ltr">{l.dueDate}</bdi>
                                  {l.copyBarcode ? <bdi dir="ltr">{` · ${l.copyBarcode}`}</bdi> : ''}
                                </div>
                              </div>
                              <StatusPill
                                compact
                                status={l.status === 'overdue' ? 'overdue' : 'checked_out'}
                                label={l.status === 'overdue' ? t.statusOverdue : t.statusActive}
                              />
                            </div>

                            <div className="flex items-center gap-2 pt-1.5 border-t border-dashed border-[#E2DDD5] dark:border-[#2E3330]">
                              <button
                                type="button"
                                disabled={!onRenewLoan || hasHoldConflict || atMaxRenew}
                                onClick={() => {
                                  if (onRenewLoan) {
                                    onRenewLoan(l);
                                    playScanFeedback('success');
                                  }
                                }}
                                className="flex-1 py-1.5 px-2.5 rounded-lg border border-[#E2DDD5] dark:border-[#2E3330] bg-white dark:bg-[#1A1D1B] hover:bg-[#EFECE6] dark:hover:bg-[#232724] disabled:opacity-45 text-[#1C1917] dark:text-[#F5F3EE] text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
                              >
                                {hasHoldConflict ? 'Hold Conflict' : atMaxRenew ? 'Max Renewed' : 'Renew'}
                              </button>
                              <button
                                type="button"
                                onClick={() => executeReturnForLoan(l, targetBook)}
                                className="flex-1 py-1.5 px-2.5 rounded-lg bg-[#0F4C45] hover:bg-[#16655B] text-white text-[11px] font-bold transition cursor-pointer whitespace-nowrap"
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
              <div className="py-12 text-center text-xs text-[#6B655D] dark:text-[#A19B91] space-y-2">
                <User className="w-8 h-8 text-[#E2DDD5] dark:text-[#2E3330] mx-auto" />
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
        <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 space-y-5">
          <form onSubmit={handleReturnSubmit} className="space-y-4">
            <label className="block text-xs font-bold text-[#1C1917] dark:text-[#F5F3EE]">{t.scanOrEnterBarcode}</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={returnBarcode}
                onChange={(e) => setReturnBarcode(e.target.value)}
                placeholder={language === 'dv' ? 'ފޮތުގެ ކޮޕީ ބާކޯޑު ނުވަތަ އައި.އެސް.ބީ.އެން ޖައްސަވާ...' : 'Scan book or copy barcode (e.g. MAG-523-01-02 or 9780393356502)...'}
                className="flex-1 px-4 py-2.5 bg-[#F7F5F0] dark:bg-[#232724] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl text-xs font-mono font-semibold text-[#1C1917] dark:text-[#F5F3EE] focus:outline-none focus:ring-2 focus:ring-[#0F4C45]"
                autoFocus
                id="return-barcode-input"
              />
              <button
                type="submit"
                className="bg-[#0F4C45] hover:bg-[#16655B] text-white font-bold text-xs px-5 py-2.5 rounded-xl transition flex items-center justify-center gap-2 cursor-pointer shrink-0 whitespace-nowrap"
              >
                <RotateCcw className="w-4 h-4 text-[#A7F3D0]" /> {t.processReturn}
              </button>
            </div>

            {returnTargetBook && returnActiveLoan && (
              <div className="checkout-ledger-slip p-4 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <BookCoverFallback src={returnTargetBook.coverUrl} title={returnTargetBook.title} className="w-11 h-15 rounded-lg shrink-0" />
                  <div>
                    <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE]"><bdi>{returnTargetBook.title}</bdi></div>
                    <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                      {t.returnedBy}: <strong><bdi>{returnActiveLoan.userName}</bdi></strong> · {t.dueDate}: <bdi dir="ltr" className="font-mono">{returnActiveLoan.dueDate}</bdi>
                    </div>
                  </div>
                </div>
                <StatusPill
                  status={returnActiveLoan.status === 'overdue' ? 'overdue' : 'checked_out'}
                  label={returnActiveLoan.status === 'overdue' ? t.statusOverdue : t.statusActive}
                />
              </div>
            )}

            {lastReturnedReceipt && (
              <div className="p-4 bg-[#ECFDF5] dark:bg-[#0F4C45]/30 border border-[#A7F3D0] dark:border-[#16655B] rounded-2xl space-y-3 text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-bold text-[#0F4C45] dark:text-[#A7F3D0] flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    {language === 'dv' ? 'ފޮތް ބަލައިގަނެ ސްޓޮކް އާކުރެވިއްޖެ' : 'Return Verified & Copy Returned to Inventory'}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="stamp-badge px-2 py-0.5 rounded border border-[#15803D] dark:border-[#6EE7B7] text-[#15803D] dark:text-[#6EE7B7] font-mono font-black text-[10px] uppercase tracking-wider">
                      {lastReturnedReceipt.holdWaitingPatron ? 'HOLD SHELF' : 'RETURNED'}
                    </span>
                    <span className="font-mono text-[#0F4C45] dark:text-[#6EE7B7]"><bdi dir="ltr">{lastReturnedReceipt.returnDate}</bdi></span>
                  </div>
                </div>

                {lastReturnedReceipt.holdWaitingPatron && (
                  <div className="p-3 bg-[#FFFBEB] dark:bg-[#78350F]/35 border border-[#FDE68A] dark:border-[#B45309] rounded-xl flex items-center gap-2.5 text-[#B45309] dark:text-[#FCD34D] font-bold">
                    <Bookmark className="w-4 h-4 text-[#C26D3A] shrink-0" />
                    <span>
                      {language === 'dv'
                        ? `ހޯލްޑް އެލާޓް: "${lastReturnedReceipt.userName}" ގެ އަތުން ލިބުނު މި ފޮތް "${lastReturnedReceipt.holdWaitingPatron}" ވަނީ ނަންނޯޓު ކޮށްފައެވެ. ޑެސްކުގައި ބަހައްޓަވާ!`
                        : `HOLD QUEUE ALERT: "${lastReturnedReceipt.holdWaitingPatron}" has an active reservation for this title. Place on Hold Shelf!`}
                    </span>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 text-[#1C1917] dark:text-[#F5F3EE]">
                  <span>
                    <strong><bdi>{lastReturnedReceipt.bookTitle}</bdi></strong> · {t.returnedBy} <bdi>{lastReturnedReceipt.userName}</bdi>
                  </span>
                  <span className="font-mono tabular-nums font-bold">
                    <bdi dir="ltr">{lastReturnedReceipt.lateFee > 0 ? `Fine Assessed: MVR ${lastReturnedReceipt.lateFee.toFixed(2)}` : t.noFine}</bdi>
                  </span>
                </div>
              </div>
            )}
          </form>

          <div className="pt-3 border-t border-[#E2DDD5] dark:border-[#2E3330] space-y-3">
            <h4 className="text-xs font-bold text-[#6B655D] dark:text-[#A19B91] flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-[#0F4C45] dark:text-[#6EE7B7]" />
              <span>{language === 'dv' ? 'އަނބުރާ ޙަވާލުކުރަންޖެހޭ ފޮތްތައް' : 'Active Loans Pending Return'} (<bdi dir="ltr" className="font-mono tabular-nums">{activeCirculatingLoans.length}</bdi>)</span>
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
                    className={`checkout-ledger-slip p-3.5 rounded-xl text-start transition flex items-center justify-between gap-3 cursor-pointer ${
                      loan.status === 'overdue'
                        ? '!border-[#FECACA] dark:!border-[#B91C1C]/60 hover:bg-[#FEF2F2]/60 dark:hover:bg-[#7F1D1D]/20'
                        : 'hover:bg-[#ECFDF5]/60 dark:hover:bg-[#0F4C45]/20'
                    }`}
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="font-bold text-xs text-[#1C1917] dark:text-[#F5F3EE] truncate"><bdi>{loan.bookTitle}</bdi></div>
                      <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                        <bdi>{loan.userName}</bdi> · <bdi dir="ltr" className="font-mono">{loan.dueDate}</bdi>
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold shrink-0 whitespace-nowrap ${
                      loan.status === 'overdue' ? 'bg-[#B91C1C] text-white' : 'bg-[#0F4C45] text-white'
                    }`}>
                      <bdi dir="ltr">{estFine > 0 ? `Check-in (MVR ${estFine.toFixed(2)})` : 'Check-in'}</bdi>
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
        <div className="bg-white dark:bg-[#1A1D1B] rounded-2xl border border-[#E2DDD5] dark:border-[#2E3330] p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="archival-heading text-sm font-bold text-[#1C1917] dark:text-[#F5F3EE]">
              {language === 'dv' ? 'ފޮތުގެ މުއްދަތު އިތުރުކުރުން (Renewals)' : 'Quick Loan Renewals & Hold Conflict Check'}
            </h3>
            <p className="text-xs text-[#6B655D] dark:text-[#A19B91]">
              {language === 'dv'
                ? 'އެހެން މެންބަރަކު ރިޒާވް ކޮށްފައިވާ ފޮތެއްގެ މުއްދަތު އިތުރުކުރުން ސިސްޓަމުން އޮޓޮމެޓިކުން ހުއްޓުވާނެއެވެ.'
                : 'Renewals follow Sun–Thu working days excluding Maldivian holidays and automatically block extension on active holds.'}
            </p>
          </div>

          <div className="divide-y divide-[#E2DDD5] dark:divide-[#2E3330] border border-[#E2DDD5] dark:border-[#2E3330] rounded-xl overflow-hidden">
            {activeCirculatingLoans.map((loan) => {
              const hasHoldConflict = reservations.some(
                (r) => r.bookId === loan.bookId && r.userId !== loan.userId && r.status === 'pending'
              );
              const atLimit = loan.renewalCount >= (settings.maxRenewals || 2);

              return (
                <div key={loan.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-[#1A1D1B] hover:bg-[#F7F5F0] dark:hover:bg-[#232724] text-xs transition">
                  <div className="space-y-1">
                    <div className="font-bold text-[#1C1917] dark:text-[#F5F3EE] flex items-center gap-2 flex-wrap">
                      <bdi>{loan.bookTitle}</bdi>
                      {hasHoldConflict && (
                        <StatusPill
                          compact
                          status="reserved"
                          label={language === 'dv' ? 'ރިޒަވޭޝަން އެބައޮތް' : 'Hold Conflict'}
                        />
                      )}
                    </div>
                    <div className="text-[11px] text-[#6B655D] dark:text-[#A19B91]">
                      <bdi>{loan.userName}</bdi> · {t.dueDate}: <bdi dir="ltr" className="font-mono text-[#1C1917] dark:text-[#F5F3EE]">{loan.dueDate}</bdi> · Renewals: <bdi dir="ltr" className="font-mono tabular-nums">{loan.renewalCount}/{settings.maxRenewals}</bdi>
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!onRenewLoan || atLimit || hasHoldConflict}
                    onClick={() => onRenewLoan && onRenewLoan(loan)}
                    className="px-3.5 py-2 rounded-xl bg-[#0F4C45] hover:bg-[#16655B] disabled:bg-[#EFECE6] dark:disabled:bg-[#232724] disabled:text-[#6B655D] dark:disabled:text-[#A19B91] text-white font-bold text-xs transition cursor-pointer shrink-0 whitespace-nowrap"
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
