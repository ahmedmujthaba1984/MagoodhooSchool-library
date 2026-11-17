import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import {
  AlertTriangle,
  Archive,
  Barcode,
  BookOpen,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Download,
  Filter,
  HelpCircle,
  Keyboard,
  Layers,
  MapPin,
  Pause,
  Play,
  Printer,
  RefreshCw,
  RotateCcw,
  Scan,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX,
  Wrench,
  XCircle,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Book, BookCopy, CopyStatus, Loan } from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { playScanFeedback } from '../lib/barcodeSvg';
import { BookCoverFallback } from './BookCoverFallback';
import { getPredictiveInsights } from '../services/ai';
import {
  AuditScanEvent,
  AuditZoneFilter,
  CrewWeedingCandidate,
  CrewWeedingRules,
  computeAuditReconciliation,
  downloadWeedingProposalCsv,
  evaluateAuditScan,
  evaluateCrewWeedingCandidates,
  extractAuditZones,
  printWeedingProposalReport,
} from '../lib/inventoryAudit';

interface InventoryAuditViewProps {
  books: Book[];
  loans: Loan[];
  onAutoCheckIn: (loan: Loan) => Promise<void> | void;
  onUpdateBook: (bookId: string, data: Partial<Book>) => Promise<void> | void;
  onDeleteBook: (bookId: string) => Promise<void> | void;
}

type AuditSubTab = 'shelf-audit' | 'crew-weeding';
type ReconciliationFilter = 'missing' | 'mis_shelved' | 'ghost' | 'checked_out' | 'verified';

export const InventoryAuditView: React.FC<InventoryAuditViewProps> = ({
  books,
  loans,
  onAutoCheckIn,
  onUpdateBook,
  onDeleteBook,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isDv = language === 'dv';

  const [subTab, setSubTab] = useState<AuditSubTab>('shelf-audit');

  // ---------- MODE 1: SHELF AUDIT & BARCODE SWEEP ----------
  const zonePresets = useMemo(() => extractAuditZones(books), [books]);
  const [selectedZoneKey, setSelectedZoneKey] = useState<string>('ALL');
  const [customZoneText, setCustomZoneText] = useState<string>('');
  const [isSweepActive, setIsSweepActive] = useState<boolean>(true);
  const [scanInputMode, setScanInputMode] = useState<'usb' | 'camera'>('usb');
  const [barcodeInput, setBarcodeInput] = useState<string>('');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [scannedEvents, setScannedEvents] = useState<AuditScanEvent[]>([]);
  const [reconcileTab, setReconcileTab] = useState<ReconciliationFilter>('missing');
  const [confirmBulkMissing, setConfirmBulkMissing] = useState<boolean>(false);
  const [busyActionId, setBusyActionId] = useState<string | null>(null);

  const usbInputRef = useRef<HTMLInputElement | null>(null);
  const cameraScannerRef = useRef<Html5QrcodeScanner | null>(null);
  const recentCameraCooldownRef = useRef<Map<string, number>>(new Map());

  const activeZone: AuditZoneFilter = useMemo(() => {
    if (customZoneText.trim()) {
      return {
        mode: 'custom',
        value: customZoneText.trim(),
        label: `Custom Range: ${customZoneText.trim()}`,
      };
    }
    const found = zonePresets.find((z) => `${z.mode}:${z.value}` === selectedZoneKey);
    return found || zonePresets[0];
  }, [customZoneText, selectedZoneKey, zonePresets]);

  const scannedSet = useMemo(() => {
    const s = new Set<string>();
    for (const ev of scannedEvents) {
      if (ev.outcome !== 'unknown') {
        s.add((ev.copy?.barcode || ev.scannedCode).toLowerCase());
      }
    }
    return s;
  }, [scannedEvents]);

  const reconciliation = useMemo(
    () =>
      computeAuditReconciliation({
        zone: activeZone,
        books,
        scannedEvents,
      }),
    [activeZone, books, scannedEvents]
  );

  // Refs so camera callback always reads current zone/books/loans cleanly without tearing down camera
  const sweepStateRef = useRef({
    activeZone,
    books,
    loans,
    scannedSet,
    isSweepActive,
    audioEnabled,
  });
  sweepStateRef.current = {
    activeZone,
    books,
    loans,
    scannedSet,
    isSweepActive,
    audioEnabled,
  };

  const processScannedCode = (rawCode: string) => {
    const {
      activeZone: z,
      books: bks,
      loans: lns,
      scannedSet: sSet,
      isSweepActive: active,
      audioEnabled: sound,
    } = sweepStateRef.current;

    if (!active) return;
    const trimmed = rawCode.trim();
    if (!trimmed) return;

    const event = evaluateAuditScan({
      rawCode: trimmed,
      zone: z,
      books: bks,
      loans: lns,
      alreadyScannedBarcodes: sSet,
    });

    if (sound) {
      if (event.outcome === 'matched_on_shelf') playScanFeedback('audit_match');
      else if (event.outcome === 'mis_shelved') playScanFeedback('audit_misshelved');
      else if (event.outcome === 'ghost_return') playScanFeedback('audit_ghost');
      else playScanFeedback('error');
    }

    setScannedEvents((prev) => [event, ...prev.slice(0, 199)]);
  };

  // Continuous mobile camera scanner setup (stays open between scans with 2.5s cooldown per barcode)
  useEffect(() => {
    if (subTab !== 'shelf-audit' || scanInputMode !== 'camera' || !isSweepActive) {
      return;
    }

    const containerId = 'shelf-audit-camera-reader';
    const el = document.getElementById(containerId);
    if (!el) return;

    const scanner = new Html5QrcodeScanner(
      containerId,
      {
        fps: 10,
        qrbox: { width: 260, height: 140 },
        aspectRatio: 1.777778,
      },
      false
    );

    scanner.render(
      (decodedText) => {
        const key = decodedText.trim().toLowerCase();
        const now = Date.now();
        const lastTs = recentCameraCooldownRef.current.get(key) || 0;
        if (now - lastTs < 2500) return;
        recentCameraCooldownRef.current.set(key, now);
        processScannedCode(decodedText);
      },
      () => {
        // Ignore transient camera frame decode misses
      }
    );

    cameraScannerRef.current = scanner;

    return () => {
      if (cameraScannerRef.current) {
        cameraScannerRef.current.clear().catch(() => {});
        cameraScannerRef.current = null;
      }
    };
  }, [subTab, scanInputMode, isSweepActive]);

  // Keep USB/Bluetooth input auto-focused in USB sweep mode
  useEffect(() => {
    if (subTab === 'shelf-audit' && scanInputMode === 'usb' && isSweepActive) {
      usbInputRef.current?.focus();
    }
  }, [subTab, scanInputMode, isSweepActive, selectedZoneKey]);

  const handleUsbSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;
    processScannedCode(barcodeInput);
    setBarcodeInput('');
    usbInputRef.current?.focus();
  };

  const handleUpdateCopyStatus = async (
    book: Book,
    targetCopy: BookCopy,
    newStatus: CopyStatus
  ) => {
    const key = `${book.id}:${targetCopy.copyId}`;
    setBusyActionId(key);
    try {
      let updatedCopies: BookCopy[];
      if (book.copies && book.copies.length > 0) {
        updatedCopies = book.copies.map((c) =>
          c.copyId === targetCopy.copyId || c.barcode === targetCopy.barcode
            ? {
                ...c,
                status: newStatus,
                condition: newStatus === 'Lost' ? 'Lost' : c.condition,
              }
            : c
        );
      } else {
        // Materialize copies array cleanly on first copy-level audit edit
        const total = Math.max(1, book.totalCopies || 1);
        const avail = Math.max(0, Math.min(total, book.availableCopies ?? total));
        updatedCopies = Array.from({ length: total }, (_, idx) => {
          const code =
            idx === 0 ? book.barcode : `${book.barcode}-${String(idx + 1).padStart(2, '0')}`;
          const isMatch = code === targetCopy.barcode;
          return {
            copyId: `${book.id}-V${idx + 1}`,
            barcode: code,
            shelfLocation: book.shelfLocation,
            condition: isMatch && newStatus === 'Lost' ? 'Lost' : 'Good',
            acquisitionPriceMvr: 150,
            status: isMatch
              ? newStatus
              : idx + 1 <= avail
              ? 'Available'
              : 'Checked Out',
            acquiredAt: book.addedAt,
          };
        });
      }

      const newAvailableCount = updatedCopies.filter((c) => c.status === 'Available').length;
      await onUpdateBook(book.id, {
        copies: updatedCopies,
        availableCopies: newAvailableCount,
      });

      toast.success(
        `${book.title} (${targetCopy.barcode}) updated to "${newStatus}".`,
        'Copy Status Updated'
      );
    } finally {
      setBusyActionId(null);
    }
  };

  const handleMarkRemainingMissing = async () => {
    const targets = reconciliation.missingUnscanned.filter(
      (item) => item.copy.status !== 'Missing' && item.copy.status !== 'Lost'
    );
    if (targets.length === 0) {
      setConfirmBulkMissing(false);
      return;
    }

    setBusyActionId('bulk-missing');
    try {
      // Group updates per Book so we write each modified Book once
      const grouped = new Map<string, Set<string>>();
      for (const item of targets) {
        if (!grouped.has(item.book.id)) grouped.set(item.book.id, new Set());
        grouped.get(item.book.id)!.add(item.copy.barcode);
      }

      for (const [bookId, barcodes] of grouped.entries()) {
        const book = books.find((b) => b.id === bookId);
        if (!book) continue;
        const updatedCopies: BookCopy[] =
          book.copies && book.copies.length > 0
            ? book.copies.map((c) =>
                barcodes.has(c.barcode) ? { ...c, status: 'Missing' } : c
              )
            : Array.from({ length: Math.max(1, book.totalCopies || 1) }, (_, idx) => {
                const code =
                  idx === 0
                    ? book.barcode
                    : `${book.barcode}-${String(idx + 1).padStart(2, '0')}`;
                return {
                  copyId: `${book.id}-V${idx + 1}`,
                  barcode: code,
                  shelfLocation: book.shelfLocation,
                  condition: 'Good',
                  acquisitionPriceMvr: 150,
                  status: barcodes.has(code) ? 'Missing' : 'Available',
                  acquiredAt: book.addedAt,
                };
              });

        await onUpdateBook(book.id, {
          copies: updatedCopies,
          availableCopies: updatedCopies.filter((c) => c.status === 'Available').length,
        });
      }

      toast.info(
        `Marked ${targets.length} unscanned copy(ies) in ${activeZone.label} as Missing.`,
        'Reconciliation Saved'
      );
      setConfirmBulkMissing(false);
    } finally {
      setBusyActionId(null);
    }
  };

  const handleGhostAutoCheckIn = async (event: AuditScanEvent) => {
    if (!event.activeLoan) {
      if (event.book && event.copy) {
        await handleUpdateCopyStatus(event.book, event.copy, 'Available');
        setScannedEvents((prev) =>
          prev.map((e) => (e.id === event.id ? { ...e, resolvedAction: 'checked_in' } : e))
        );
      }
      return;
    }

    setBusyActionId(event.id);
    try {
      await onAutoCheckIn(event.activeLoan);
      setScannedEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, resolvedAction: 'checked_in' } : e))
      );
      if (audioEnabled) playScanFeedback('returned');
      toast.success(
        `Ghost return resolved — "${event.book?.title}" checked in automatically.`,
        'Auto Check-In Complete'
      );
    } finally {
      setBusyActionId(null);
    }
  };

  // Sample test shortcuts (1 in-zone available, 1 different-zone mis-shelved, 1 checked-out ghost return)
  const quickSweepSamples = useMemo(() => {
    const samples: Array<{ label: string; code: string; tone: 'green' | 'amber' | 'blue' }> = [];

    const inZoneAvail = reconciliation.missingUnscanned.find(
      (i) => i.copy.status === 'Available'
    );
    if (inZoneAvail) {
      samples.push({
        label: `Valid Shelf (${inZoneAvail.copy.barcode})`,
        code: inZoneAvail.copy.barcode,
        tone: 'green',
      });
    }

    const otherShelfBook = books.find(
      (b) =>
        b.shelfLocation !== activeZone.value &&
        !activeZone.value.includes(b.shelfLocation) &&
        b.copies?.some((c) => c.status === 'Available')
    );
    const otherCopy = otherShelfBook?.copies?.find((c) => c.status === 'Available');
    if (otherCopy) {
      samples.push({
        label: `Mis-shelved (${otherCopy.barcode})`,
        code: otherCopy.barcode,
        tone: 'amber',
      });
    }

    const activeLoan = loans.find((l) => l.status !== 'returned' && l.copyBarcode);
    if (activeLoan?.copyBarcode) {
      samples.push({
        label: `Ghost Return (${activeLoan.copyBarcode})`,
        code: activeLoan.copyBarcode,
        tone: 'blue',
      });
    }

    return samples;
  }, [reconciliation.missingUnscanned, books, activeZone.value, loans]);

  // ---------- MODE 2: CREW COLLECTION WEEDING ----------
  const [crewRules, setCrewRules] = useState<CrewWeedingRules>({
    maxIdleMonths: 24,
    outdatedStemYears: 10,
    flagDamagedOrFair: true,
    excludeReferenceItems: false,
    excludeDhivehiHeritage: true,
  });
  const [selectedWeedingIds, setSelectedWeedingIds] = useState<Set<string>>(new Set());
  const [confirmWithdrawBookId, setConfirmWithdrawBookId] = useState<string | null>(null);
  const [aiCrewSummary, setAiCrewSummary] = useState<string>('');
  const [loadingAiCrew, setLoadingAiCrew] = useState<boolean>(false);

  const weedingCandidates = useMemo(
    () => evaluateCrewWeedingCandidates(books, loans, crewRules),
    [books, loans, crewRules]
  );

  const weedingChartData = useMemo(() => {
    const byAction: Record<string, number> = {
      'Weed / Withdraw': 0,
      'Replace with New Edition': 0,
      'Repair / Rebind': 0,
      'Promote / Relocate': 0,
    };
    for (const c of weedingCandidates) {
      byAction[c.recommendedAction] = (byAction[c.recommendedAction] || 0) + 1;
    }
    return Object.entries(byAction).map(([action, count]) => ({
      action: action.replace(' with New Edition', ''),
      count,
    }));
  }, [weedingCandidates]);

  const totalWeedingMvr = useMemo(
    () => weedingCandidates.reduce((acc, c) => acc + c.estimatedReplacementMvr, 0),
    [weedingCandidates]
  );

  const handleRefreshAiCrewInsights = async () => {
    setLoadingAiCrew(true);
    try {
      const res = await getPredictiveInsights({
        books,
        loans,
        language: isDv ? 'dv' : 'en',
      });
      const candidateCount = weedingCandidates.length;
      const stemOutdated = weedingCandidates.filter(
        (c) => c.recommendedAction === 'Replace with New Edition'
      ).length;
      const repairCount = weedingCandidates.filter(
        (c) => c.recommendedAction === 'Repair / Rebind'
      ).length;

      const crewNarrative = isDv
        ? `CREW އުސޫލުން ${candidateCount} ފޮތެއް ވަނީ ފާހަގަކުރެވިފައެވެ (${stemOutdated} ސައިންސް/ޓެކް އައުކުރަން، ${repairCount} މަރާމާތުކުރަން). ${res.executiveSummary}`
        : `CREW Audit flagged ${candidateCount} candidate title(s) (${stemOutdated} outdated STEM/IT editions for replacement, ${repairCount} copies needing binding repair). ${res.executiveSummary}`;

      setAiCrewSummary(crewNarrative);
    } finally {
      setLoadingAiCrew(false);
    }
  };

  const toggleWeedingSelect = (bookId: string) => {
    setSelectedWeedingIds((prev) => {
      const next = new Set(prev);
      if (next.has(bookId)) next.delete(bookId);
      else next.add(bookId);
      return next;
    });
  };

  const toggleSelectAllWeeding = () => {
    if (selectedWeedingIds.size === weedingCandidates.length) {
      setSelectedWeedingIds(new Set());
    } else {
      setSelectedWeedingIds(new Set(weedingCandidates.map((c) => c.book.id)));
    }
  };

  const exportTargetCandidates: CrewWeedingCandidate[] =
    selectedWeedingIds.size > 0
      ? weedingCandidates.filter((c) => selectedWeedingIds.has(c.book.id))
      : weedingCandidates;

  const latestScan = scannedEvents[0];
  const progressPct =
    reconciliation.expectedInZone.length > 0
      ? Math.round(
          (reconciliation.verifiedOnShelf.length / reconciliation.expectedInZone.length) * 100
        )
      : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Workspace Header & Primary Mode Switcher */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <ClipboardCheck className="w-4 h-4 shrink-0" />
            <span>
              {isDv ? 'ސްޓޮކްޓޭކް އަދި ކަލެކްޝަން މެއިންޓެނަންސް' : 'Inventory Audit & Collection Maintenance'}
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {isDv
              ? 'ރެޕިޑް ޝެލްފް-އޮޑިޓް އަދި CREW ވީޑިންގ ވޯކްސްޕޭސް'
              : 'Rapid Stocktaking, Shelf-Reading & CREW Weeding'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {isDv
              ? 'ބްލޫޓޫތު ނުވަތަ މޯބައިލް ކެމެރާއިން ހުއްޓުމެއްނެތި ބާކޯޑް ސްކޭންކޮށް، ގެއްލިފައިވާ ފޮތްތައް ދެނެގަނެ، ބޭނުންނުކުރާ ފޮތްތައް ރިޕޯޓްކުރޭ.'
              : 'Sweep shelves continuously with a mobile camera or wireless scanner, reconcile missing/mis-shelved copies, and run CREW weeding proposals.'}
          </p>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 shrink-0 self-start lg:self-center">
          <button
            type="button"
            onClick={() => setSubTab('shelf-audit')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
              subTab === 'shelf-audit'
                ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Scan className="w-4 h-4 shrink-0" />
            <span>{isDv ? 'ޝެލްފް-އޮޑިޓް ސްކޭނަރ' : 'Shelf-Audit Sweep'}</span>
          </button>
          <button
            type="button"
            onClick={() => setSubTab('crew-weeding')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
              subTab === 'crew-weeding'
                ? 'bg-white dark:bg-slate-900 text-emerald-800 dark:text-emerald-300 shadow-xs border border-slate-200 dark:border-slate-700'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Archive className="w-4 h-4 shrink-0" />
            <span>{isDv ? 'CREW ވީޑިންގ އެނަލިޓިކްސް' : 'CREW Weeding Analytics'}</span>
            {weedingCandidates.length > 0 && (
              <span className="font-mono tabular-nums text-[10px] font-black bg-amber-100 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded">
                <bdi>{weedingCandidates.length}</bdi>
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ==================== MODE 1: MOBILE SHELF-AUDIT & BARCODE SWEEP ==================== */}
      {subTab === 'shelf-audit' && (
        <div className="space-y-5">
          {/* Zone / Rack Session Configuration Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-3 justify-between">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {isDv ? 'އޮޑިޓް ޒޯން / ޝެލްފް' : 'Audit Shelf / DDC Zone'}
                  </label>
                  <select
                    value={selectedZoneKey}
                    onChange={(e) => {
                      setSelectedZoneKey(e.target.value);
                      setCustomZoneText('');
                      setConfirmBulkMissing(false);
                    }}
                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {zonePresets.map((z) => (
                      <option key={`${z.mode}:${z.value}`} value={`${z.mode}:${z.value}`}>
                        {z.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
                    {isDv ? 'ނުވަތަ ކަސްޓަމް ރޭންޖް (މިސާލު: 891.4 / Shelf D1-D3)' : 'Or Custom Call / Shelf Range (e.g. 891.4, Shelf D1-D3)'}
                  </label>
                  <div className="relative">
                    <Filter className="w-3.5 h-3.5 text-slate-400 absolute start-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={customZoneText}
                      onChange={(e) => setCustomZoneText(e.target.value)}
                      placeholder="e.g. 891.4 or Fiction - Aisle 1"
                      className="w-full ps-8 pe-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsSweepActive((prev) => !prev)}
                  className={`px-3.5 py-2.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    isSweepActive
                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  {isSweepActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isSweepActive ? 'Sweep Active' : 'Resume Sweep'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setAudioEnabled((prev) => !prev)}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                  title="Toggle Acoustic Ping Feedback"
                >
                  {audioEnabled ? <Volume2 className="w-3.5 h-3.5 text-emerald-600" /> : <VolumeX className="w-3.5 h-3.5 text-slate-400" />}
                  <span>{audioEnabled ? 'Audio On' : 'Muted'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setScannedEvents([]);
                    setConfirmBulkMissing(false);
                    recentCameraCooldownRef.current.clear();
                    toast.info('Cleared current shelf sweep session log.', 'Session Reset');
                  }}
                  className="px-3 py-2.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* 5-Metric Sweep KPI Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Expected in Zone</div>
                <div className="text-xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                  <bdi>{reconciliation.expectedInZone.length}</bdi>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Verified on Shelf</div>
                <div className="text-xl font-black font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-0.5 flex items-baseline justify-between">
                  <bdi>{reconciliation.verifiedOnShelf.length}</bdi>
                  <span className="text-xs font-bold"><bdi>{progressPct}%</bdi></span>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Mis-shelved Alerts</div>
                <div className="text-xl font-black font-mono tabular-nums text-amber-800 dark:text-amber-300 mt-0.5">
                  <bdi>{reconciliation.misShelvedEvents.length}</bdi>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800">
                <div className="text-[10px] font-bold uppercase text-sky-700 dark:text-sky-400">Ghost Returns</div>
                <div className="text-xl font-black font-mono tabular-nums text-sky-800 dark:text-sky-300 mt-0.5">
                  <bdi>{reconciliation.ghostReturnEvents.length}</bdi>
                </div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/60 dark:bg-rose-950/25 border border-rose-200 dark:border-rose-800 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-400">Missing / Unscanned</div>
                <div className="text-xl font-black font-mono tabular-nums text-rose-800 dark:text-rose-300 mt-0.5">
                  <bdi>{reconciliation.missingUnscanned.length}</bdi>
                </div>
              </div>
            </div>
          </div>

          {/* Main Split: Continuous Scanner (Left 5 cols) + Reconciliation Table (Right 7 cols) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            {/* LEFT: Continuous Rapid Scanner */}
            <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
                <button
                  type="button"
                  onClick={() => setScanInputMode('usb')}
                  className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    scanInputMode === 'usb'
                      ? 'border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Keyboard className="w-4 h-4 shrink-0" />
                  <span>Bluetooth / USB Sweep</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScanInputMode('camera')}
                  className={`flex-1 py-3 px-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer whitespace-nowrap shrink-0 ${
                    scanInputMode === 'camera'
                      ? 'border-emerald-700 text-emerald-800 dark:text-emerald-300 bg-white dark:bg-slate-900'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Camera className="w-4 h-4 shrink-0" />
                  <span>Continuous Mobile Camera</span>
                </button>
              </div>

              <div className="p-4 sm:p-5 space-y-4">
                {scanInputMode === 'usb' ? (
                  <form onSubmit={handleUsbSubmit} className="space-y-2">
                    <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      Hands-Free Spine Barcode Input (Auto-Focused):
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Barcode className="w-4 h-4 text-emerald-600 absolute start-3 top-1/2 -translate-y-1/2" />
                        <input
                          ref={usbInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          placeholder="Scan copy barcode e.g. MAG-823-03-01"
                          disabled={!isSweepActive}
                          className="w-full ps-9 pe-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl text-sm font-mono text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={!isSweepActive}
                        className="px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition cursor-pointer shrink-0"
                      >
                        Scan
                      </button>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Scan spine barcodes rapidly in sequence without clicking between scans.
                    </p>
                  </form>
                ) : (
                  <div className="space-y-2">
                    <div
                      id="shelf-audit-camera-reader"
                      className="overflow-hidden rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-950 min-h-[210px]"
                    />
                    <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
                      Continuous camera sweep active (2.5s cooldown prevents duplicate pings on the same spine).
                    </p>
                  </div>
                )}

                {/* Real-Time Color + Icon Anomaly Alert Banner */}
                {latestScan ? (
                  <div
                    className={`rounded-xl border p-3.5 space-y-2 ${
                      latestScan.outcome === 'matched_on_shelf'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-950 dark:text-emerald-100'
                        : latestScan.outcome === 'mis_shelved'
                        ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100'
                        : latestScan.outcome === 'ghost_return'
                        ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-300 dark:border-sky-700 text-sky-950 dark:text-sky-100'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-700 text-rose-950 dark:text-rose-100'
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      {latestScan.outcome === 'matched_on_shelf' && (
                        <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      {latestScan.outcome === 'mis_shelved' && (
                        <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                      )}
                      {latestScan.outcome === 'ghost_return' && (
                        <RotateCcw className="w-5 h-5 text-sky-700 dark:text-sky-400 shrink-0 mt-0.5" />
                      )}
                      {latestScan.outcome === 'unknown' && (
                        <XCircle className="w-5 h-5 text-rose-700 dark:text-rose-400 shrink-0 mt-0.5" />
                      )}

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-black uppercase tracking-wider">
                            {latestScan.outcome === 'matched_on_shelf' && 'Green Ping · On Correct Shelf'}
                            {latestScan.outcome === 'mis_shelved' && 'Amber Warning · Mis-Shelved Item'}
                            {latestScan.outcome === 'ghost_return' && 'Blue Notice · Ghost Return'}
                            {latestScan.outcome === 'unknown' && 'Unrecognized Barcode'}
                          </span>
                          <span className="text-[11px] font-mono tabular-nums font-bold">
                            <bdi>{latestScan.scannedCode}</bdi>
                          </span>
                        </div>

                        {latestScan.book && (
                          <div className="text-xs font-bold truncate">
                            <bdi>{latestScan.book.title}</bdi>
                          </div>
                        )}
                        <p className="text-[11px] opacity-90 leading-snug">{latestScan.note}</p>

                        {latestScan.outcome === 'mis_shelved' && latestScan.expectedShelf && (
                          <div className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-bold bg-white/80 dark:bg-slate-900/80 border border-amber-300 dark:border-amber-700 px-2.5 py-1 rounded-lg">
                            <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span>
                              Target Shelf: <bdi>{latestScan.expectedShelf}</bdi>
                              {latestScan.expectedRack ? ` (${latestScan.expectedRack})` : ''}
                            </span>
                          </div>
                        )}

                        {latestScan.outcome === 'ghost_return' && (
                          <div className="pt-1.5 flex items-center gap-2">
                            {latestScan.resolvedAction === 'checked_in' ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Auto Check-In Completed
                              </span>
                            ) : (
                              <button
                                type="button"
                                disabled={busyActionId === latestScan.id}
                                onClick={() => handleGhostAutoCheckIn(latestScan)}
                                className="px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{busyActionId === latestScan.id ? 'Checking In...' : 'One-Tap Auto Check-In'}</span>
                              </button>
                            )}
                          </div>
                        )}

                        {latestScan.wasPreviouslyMissing && latestScan.book && latestScan.copy && (
                          <div className="pt-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleUpdateCopyStatus(latestScan.book!, latestScan.copy!, 'Available')
                              }
                              className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold rounded-lg transition cursor-pointer"
                            >
                              Restore Copy Status to Available
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 p-4 text-center space-y-1">
                    <Scan className="w-5 h-5 text-slate-400 mx-auto" />
                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Ready to Sweep: <bdi>{activeZone.label}</bdi>
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Green = Verified · Amber = Wrong Shelf · Blue = Ghost Return
                    </p>
                  </div>
                )}

                {/* Quick Sweep Simulation Samples */}
                {quickSweepSamples.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Quick Test Sweep Barcodes
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {quickSweepSamples.map((s) => (
                        <button
                          key={s.code}
                          type="button"
                          onClick={() => processScannedCode(s.code)}
                          className={`text-[11px] font-mono px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                            s.tone === 'green'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100'
                              : s.tone === 'amber'
                              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100'
                              : 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800 hover:bg-sky-100'
                          }`}
                        >
                          <bdi>{s.label}</bdi>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Compact Live Scan Feed */}
                {scannedEvents.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 dark:text-slate-400">
                      <span>Recent Scan Stream</span>
                      <span className="font-mono tabular-nums"><bdi>{scannedEvents.length}</bdi> scans</span>
                    </div>
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl">
                      {scannedEvents.slice(0, 15).map((ev) => (
                        <div
                          key={ev.id}
                          className="px-3 py-2 flex items-center justify-between gap-2 text-xs bg-white dark:bg-slate-900"
                        >
                          <div className="min-w-0 flex items-center gap-2">
                            <span
                              className={`w-2 h-2 rounded-full shrink-0 ${
                                ev.outcome === 'matched_on_shelf'
                                  ? 'bg-emerald-500'
                                  : ev.outcome === 'mis_shelved'
                                  ? 'bg-amber-500'
                                  : ev.outcome === 'ghost_return'
                                  ? 'bg-sky-500'
                                  : 'bg-rose-500'
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white truncate">
                                <bdi>{ev.book?.title || ev.scannedCode}</bdi>
                              </div>
                              <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                <bdi>{ev.scannedCode}</bdi> · {ev.outcome.replace('_', ' ')}
                              </div>
                            </div>
                          </div>
                          {ev.outcome === 'ghost_return' && ev.resolvedAction !== 'checked_in' && (
                            <button
                              type="button"
                              onClick={() => handleGhostAutoCheckIn(ev)}
                              className="text-[10px] font-bold px-2 py-1 rounded bg-sky-700 text-white hover:bg-sky-800 shrink-0 cursor-pointer"
                            >
                              Auto Check-In
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT: Mis-shelved & Missing Reconciliation Table */}
            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    {isDv ? 'ޝެލްފް ރީކޮންސިލިއޭޝަން ޓޭބަލް' : 'Shelf Reconciliation & Anomaly Ledger'}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Active Zone: <span className="font-bold text-slate-700 dark:text-slate-200"><bdi>{activeZone.label}</bdi></span>
                  </p>
                </div>

                {reconcileTab === 'missing' && reconciliation.missingUnscanned.length > 0 && (
                  <div className="flex items-center gap-2 shrink-0">
                    {!confirmBulkMissing ? (
                      <button
                        type="button"
                        onClick={() => setConfirmBulkMissing(true)}
                        className="px-3 py-1.5 rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs font-bold hover:bg-amber-100 transition cursor-pointer whitespace-nowrap shrink-0"
                      >
                        Mark Remaining Missing ({reconciliation.missingUnscanned.length})
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={busyActionId === 'bulk-missing'}
                          onClick={handleMarkRemainingMissing}
                          className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold cursor-pointer"
                        >
                          {busyActionId === 'bulk-missing' ? 'Updating...' : 'Confirm Mark Missing'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmBulkMissing(false)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Filter Tabs */}
              <div className="flex overflow-x-auto border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 px-3 gap-1">
                {(
                  [
                    {
                      id: 'missing',
                      label: 'Missing / Unscanned',
                      count: reconciliation.missingUnscanned.length,
                    },
                    {
                      id: 'mis_shelved',
                      label: 'Mis-shelved',
                      count: reconciliation.misShelvedEvents.length,
                    },
                    {
                      id: 'ghost',
                      label: 'Ghost Returns',
                      count: reconciliation.ghostReturnEvents.length,
                    },
                    {
                      id: 'checked_out',
                      label: 'Checked Out',
                      count: reconciliation.checkedOutOutOfShelf.length,
                    },
                    {
                      id: 'verified',
                      label: 'Verified',
                      count: reconciliation.verifiedOnShelf.length,
                    },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setReconcileTab(tab.id)}
                    className={`py-2.5 px-3 text-xs font-bold border-b-2 flex items-center gap-1.5 transition cursor-pointer whitespace-nowrap shrink-0 ${
                      reconcileTab === tab.id
                        ? 'border-emerald-700 text-emerald-800 dark:text-emerald-300'
                        : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="font-mono tabular-nums text-[10px] px-1.5 py-0.5 rounded bg-slate-200/70 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                      <bdi>{tab.count}</bdi>
                    </span>
                  </button>
                ))}
              </div>

              {/* Table Body */}
              <div className="overflow-x-auto">
                {reconcileTab === 'missing' && (
                  <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Copy Barcode</th>
                        <th className="py-2.5 px-3">Title & Shelf</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-4 text-end">Reconcile</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reconciliation.missingUnscanned.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                            All shelf-expected copies in this zone have been scanned or accounted for.
                          </td>
                        </tr>
                      ) : (
                        reconciliation.missingUnscanned.map((item) => {
                          const actionKey = `${item.book.id}:${item.copy.copyId}`;
                          const isBusy = busyActionId === actionKey;
                          return (
                            <tr key={actionKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-slate-900 dark:text-white whitespace-nowrap">
                                <bdi>{item.copy.barcode}</bdi>
                              </td>
                              <td className="py-2.5 px-3 min-w-[200px]">
                                <div className="font-bold text-slate-900 dark:text-white truncate max-w-[260px]">
                                  <bdi>{item.book.title}</bdi>
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                  <bdi>{item.effectiveShelf}</bdi> · <span className="font-mono"><bdi>{item.book.ddcCallNumber || 'No DDC'}</bdi></span>
                                </div>
                              </td>
                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                                    item.copy.status === 'Missing'
                                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                      : item.copy.status === 'Lost'
                                      ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                                  }`}
                                >
                                  {item.copy.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-4 text-end whitespace-nowrap space-x-1.5">
                                {item.copy.status !== 'Missing' && (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleUpdateCopyStatus(item.book, item.copy, 'Missing')}
                                    className="px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-[11px] font-bold cursor-pointer"
                                  >
                                    Mark Missing
                                  </button>
                                )}
                                {item.copy.status !== 'Lost' ? (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleUpdateCopyStatus(item.book, item.copy, 'Lost')}
                                    className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-800 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-[11px] font-bold cursor-pointer"
                                  >
                                    Mark Lost
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => handleUpdateCopyStatus(item.book, item.copy, 'Available')}
                                    className="px-2.5 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 text-[11px] font-bold cursor-pointer"
                                  >
                                    Restore Available
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                )}

                {reconcileTab === 'mis_shelved' && (
                  <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Barcode</th>
                        <th className="py-2.5 px-3">Book Title</th>
                        <th className="py-2.5 px-4">Correct Target Shelf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reconciliation.misShelvedEvents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                            No mis-shelved copies detected during this sweep yet.
                          </td>
                        </tr>
                      ) : (
                        reconciliation.misShelvedEvents.map((ev) => (
                          <tr key={ev.id} className="hover:bg-amber-50/30 dark:hover:bg-amber-950/20">
                            <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-amber-800 dark:text-amber-300 whitespace-nowrap">
                              <bdi>{ev.scannedCode}</bdi>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white">
                              <bdi>{ev.book?.title || 'Catalog Item'}</bdi>
                            </td>
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                                <MapPin className="w-3.5 h-3.5 shrink-0" />
                                <bdi>{ev.expectedShelf}</bdi>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                <bdi>{ev.book?.ddcCallNumber || ''}</bdi>
                                {ev.expectedRack ? ` · ${ev.expectedRack}` : ''}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {reconcileTab === 'ghost' && (
                  <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Copy Barcode</th>
                        <th className="py-2.5 px-3">Title & Borrower</th>
                        <th className="py-2.5 px-4 text-end">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reconciliation.ghostReturnEvents.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                            No ghost returns found during this sweep.
                          </td>
                        </tr>
                      ) : (
                        reconciliation.ghostReturnEvents.map((ev) => (
                          <tr key={ev.id} className="hover:bg-sky-50/30 dark:hover:bg-sky-950/20">
                            <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-sky-800 dark:text-sky-300 whitespace-nowrap">
                              <bdi>{ev.scannedCode}</bdi>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900 dark:text-white">
                                <bdi>{ev.book?.title}</bdi>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                {ev.activeLoan
                                  ? `Borrower: ${ev.activeLoan.userName} · Due ${ev.activeLoan.dueDate}`
                                  : 'Status marked Checked Out'}
                              </div>
                            </td>
                            <td className="py-2.5 px-4 text-end whitespace-nowrap">
                              {ev.resolvedAction === 'checked_in' ? (
                                <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                  Checked In
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  disabled={busyActionId === ev.id}
                                  onClick={() => handleGhostAutoCheckIn(ev)}
                                  className="px-3 py-1.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  {busyActionId === ev.id ? 'Checking In...' : 'Auto Check-In'}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {reconcileTab === 'checked_out' && (
                  <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Copy Barcode</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-4">Expected Location</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reconciliation.checkedOutOutOfShelf.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                            No items in this zone are currently checked out.
                          </td>
                        </tr>
                      ) : (
                        reconciliation.checkedOutOutOfShelf.map((item) => (
                          <tr key={`${item.book.id}:${item.copy.copyId}`}>
                            <td className="py-2.5 px-4 font-mono tabular-nums font-bold"><bdi>{item.copy.barcode}</bdi></td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white"><bdi>{item.book.title}</bdi></td>
                            <td className="py-2.5 px-4 text-slate-500"><bdi>{item.effectiveShelf}</bdi></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}

                {reconcileTab === 'verified' && (
                  <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                    <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-4">Copy Barcode</th>
                        <th className="py-2.5 px-3">Title</th>
                        <th className="py-2.5 px-4">Shelf</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {reconciliation.verifiedOnShelf.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="py-10 px-4 text-center text-slate-500 dark:text-slate-400">
                            Scan books in <bdi>{activeZone.label}</bdi> to verify shelf presence.
                          </td>
                        </tr>
                      ) : (
                        reconciliation.verifiedOnShelf.map((item) => (
                          <tr key={`${item.book.id}:${item.copy.copyId}`}>
                            <td className="py-2.5 px-4 font-mono tabular-nums font-bold text-emerald-700 dark:text-emerald-400">
                              <bdi>{item.copy.barcode}</bdi>
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900 dark:text-white"><bdi>{item.book.title}</bdi></td>
                            <td className="py-2.5 px-4 text-slate-500"><bdi>{item.effectiveShelf}</bdi></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== MODE 2: AI-ASSISTED COLLECTION WEEDING (CREW METHOD) ==================== */}
      {subTab === 'crew-weeding' && (
        <div className="space-y-5">
          {/* CREW Criteria Rule Controls + Export Actions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>CREW Weeding Policy Parameters (School Collection Rules)</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Flags titles using MUSTIE principles: Continuous Review, Evaluation, and Weeding.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={loadingAiCrew}
                  onClick={handleRefreshAiCrewInsights}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingAiCrew ? 'animate-spin' : ''}`} />
                  <span>{loadingAiCrew ? 'Analyzing...' : 'Generate AI CREW Brief'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadWeedingProposalCsv(exportTargetCandidates);
                    toast.success(
                      `Exported ${exportTargetCandidates.length} CREW candidate(s) to CSV.`,
                      'CSV Downloaded'
                    );
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV ({exportTargetCandidates.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    printWeedingProposalReport({
                      candidates: exportTargetCandidates,
                      rules: crewRules,
                      aiSummary: aiCrewSummary || undefined,
                    })
                  }
                  className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print / PDF Proposal</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Zero Check-outs Idle Threshold (Months)
                </label>
                <div className="flex items-center gap-1.5">
                  {[12, 18, 24, 36].map((mo) => (
                    <button
                      key={mo}
                      type="button"
                      onClick={() => setCrewRules((r) => ({ ...r, maxIdleMonths: mo }))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                        crewRules.maxIdleMonths === mo
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {mo}m
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={crewRules.maxIdleMonths}
                    onChange={(e) =>
                      setCrewRules((r) => ({
                        ...r,
                        maxIdleMonths: Math.max(1, parseInt(e.target.value || '24', 10)),
                      }))
                    }
                    className="w-16 px-2 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-mono text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                  Outdated IT / Science Age (Years)
                </label>
                <div className="flex items-center gap-1.5">
                  {[5, 8, 10, 15].map((yr) => (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => setCrewRules((r) => ({ ...r, outdatedStemYears: yr }))}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-bold border cursor-pointer ${
                        crewRules.outdatedStemYears === yr
                          ? 'bg-emerald-700 text-white border-emerald-700'
                          : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                      }`}
                    >
                      {yr}y
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer py-1.5">
                <input
                  type="checkbox"
                  checked={crewRules.flagDamagedOrFair}
                  onChange={(e) =>
                    setCrewRules((r) => ({ ...r, flagDamagedOrFair: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>Flag Damaged, Fair, or Repair Copies</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer py-1.5">
                <input
                  type="checkbox"
                  checked={crewRules.excludeDhivehiHeritage}
                  onChange={(e) =>
                    setCrewRules((r) => ({ ...r, excludeDhivehiHeritage: e.target.checked }))
                  }
                  className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
                />
                <span>Protect Dhivehi Heritage from Age Weeding</span>
              </label>
            </div>
          </div>

          {/* Analytics KPIs + Bar Chart */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-5 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Flagged Titles</div>
                  <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white mt-1">
                    <bdi>{weedingCandidates.length}</bdi>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-amber-700 dark:text-amber-400">Damaged / Missing</div>
                  <div className="text-2xl font-black font-mono tabular-nums text-amber-800 dark:text-amber-300 mt-1">
                    <bdi>{weedingCandidates.reduce((s, c) => s + c.damagedCopyCount, 0)}</bdi>
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
                  <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400">Replace Est.</div>
                  <div className="text-lg font-black font-mono tabular-nums text-emerald-800 dark:text-emerald-300 mt-1">
                    <bdi>MVR {totalWeedingMvr.toFixed(0)}</bdi>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-2">
                <div className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>AI CREW Executive Rationale</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {aiCrewSummary ||
                    `Evaluating ${books.length} catalog titles against >= ${crewRules.maxIdleMonths} months zero-circulation, >= ${crewRules.outdatedStemYears}y STEM currency, and copy-level physical condition. Click "Generate AI CREW Brief" for a principal-ready summary.`}
                </p>
              </div>
            </div>

            <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">
                  Recommended CREW Actions Breakdown
                </h4>
                <span className="text-[11px] font-mono text-slate-500">
                  {weedingCandidates.length} of {books.length} titles flagged
                </span>
              </div>
              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={weedingChartData} margin={{ top: 6, right: 12, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="action" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#047857" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Weeding Candidates Table */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
              <div className="text-sm font-black text-slate-900 dark:text-white">
                Weeding & Replacement Candidates ({weedingCandidates.length})
              </div>
              {weedingCandidates.length > 0 && (
                <span className="text-[11px] text-slate-500 font-mono">
                  <bdi>{selectedWeedingIds.size}</bdi> selected for export
                </span>
              )}
            </div>

            {weedingCandidates.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                <div className="text-sm font-bold text-slate-900 dark:text-white">
                  Zero titles violated current CREW thresholds
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  No books exceed {crewRules.maxIdleMonths} months idle or {crewRules.outdatedStemYears} years in STEM with damaged copies. Preview early stagnation candidates with an 18-month threshold:
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCrewRules((r) => ({ ...r, maxIdleMonths: 18 }))}
                    className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
                  >
                    Preview 18-Month Watchlist
                  </button>
                  <button
                    type="button"
                    onClick={() => setCrewRules((r) => ({ ...r, outdatedStemYears: 5 }))}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    Check 5-Year STEM Titles
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs text-slate-700 dark:text-slate-300">
                  <thead className="bg-slate-50 dark:bg-slate-800/70 text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-3 px-4 w-8">
                        <input
                          type="checkbox"
                          checked={
                            weedingCandidates.length > 0 &&
                            selectedWeedingIds.size === weedingCandidates.length
                          }
                          onChange={toggleSelectAllWeeding}
                          className="rounded border-slate-300"
                        />
                      </th>
                      <th className="py-3 px-3">Title & Call No.</th>
                      <th className="py-3 px-3">Idle / Year</th>
                      <th className="py-3 px-3">CREW Flags (MUSTIE)</th>
                      <th className="py-3 px-3">Recommendation</th>
                      <th className="py-3 px-3 text-end">Est. MVR</th>
                      <th className="py-3 px-4 text-end">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {weedingCandidates.map((c) => (
                      <tr key={c.book.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="py-3 px-4 align-top">
                          <input
                            type="checkbox"
                            checked={selectedWeedingIds.has(c.book.id)}
                            onChange={() => toggleWeedingSelect(c.book.id)}
                            className="rounded border-slate-300 mt-1"
                          />
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="w-9 h-12 rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700 shrink-0">
                              <BookCoverFallback
                                src={c.book.coverUrl}
                                title={c.book.title}
                                author={c.book.author}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                                <bdi>{c.book.title}</bdi>
                              </div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400">
                                <bdi>{c.book.author}</bdi>
                              </div>
                              <div className="text-[10px] font-mono text-slate-500">
                                <bdi>{c.book.ddcCallNumber || 'DDC —'}</bdi> · <bdi>{c.book.shelfLocation}</bdi>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top font-mono tabular-nums whitespace-nowrap">
                          <div className="font-bold text-slate-900 dark:text-white">
                            <bdi>{c.monthsIdle} mo</bdi>
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Pub <bdi>{c.book.publicationYear}</bdi> ({c.publicationAgeYears}y)
                          </div>
                        </td>
                        <td className="py-3 px-3 align-top max-w-[280px]">
                          <ul className="space-y-0.5 text-[11px] text-slate-700 dark:text-slate-300">
                            {c.reasons.map((r, i) => (
                              <li key={i}>• {r}</li>
                            ))}
                          </ul>
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                              c.recommendedAction === 'Replace with New Edition'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                : c.recommendedAction === 'Repair / Rebind'
                                ? 'bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                            }`}
                          >
                            {c.recommendedAction}
                          </span>
                        </td>
                        <td className="py-3 px-3 align-top text-end font-mono tabular-nums font-bold whitespace-nowrap">
                          <bdi>MVR {c.estimatedReplacementMvr.toFixed(2)}</bdi>
                        </td>
                        <td className="py-3 px-4 align-top text-end whitespace-nowrap">
                          {confirmWithdrawBookId === c.book.id ? (
                            <div className="inline-flex items-center gap-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteBook(c.book.id);
                                  setConfirmWithdrawBookId(null);
                                  toast.info(`Withdrew "${c.book.title}" from active catalog.`, 'Title Withdrawn');
                                }}
                                className="px-2 py-1 rounded bg-rose-700 text-white text-[10px] font-bold cursor-pointer"
                              >
                                Confirm
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmWithdrawBookId(null)}
                                className="px-2 py-1 rounded border border-slate-300 text-[10px] font-bold cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setConfirmWithdrawBookId(c.book.id)}
                                className="px-2.5 py-1 rounded-lg border border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300 hover:bg-rose-50 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                title="Withdraw Title from Catalog"
                              >
                                <Trash2 className="w-3 h-3" />
                                <span>Withdraw</span>
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
