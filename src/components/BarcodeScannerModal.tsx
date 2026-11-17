import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, X, Camera, Keyboard, CheckCircle2, AlertCircle, RotateCcw, User } from 'lucide-react';
import { Book, UserProfile, Loan, LibrarySettings } from '../types';
import { calculateWorkingDaysOverdue } from '../lib/schoolCalendar';
import { playScanFeedback } from '../lib/barcodeSvg';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  users?: UserProfile[];
  loans?: Loan[];
  settings?: LibrarySettings;
  onProcessReturn?: (loan: Loan, calculatedFee: number) => void;
  onScanResult: (scannedCode: string, matchedBook?: Book) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  books,
  users = [],
  loans = [],
  settings,
  onProcessReturn,
  onScanResult
}) => {
  const [manualInput, setManualInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{
    code: string;
    matchedCopyBarcode?: string;
    book?: Book;
    activeLoan?: Loan;
    borrower?: UserProfile;
    returnedSuccess?: boolean;
  } | null>(null);
  const [scannerMode, setScannerMode] = useState<'camera' | 'usb'>('camera');
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen && scannerMode === 'camera') {
      const scanner = new Html5QrcodeScanner(
        'barcode-reader-container',
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.777778,
        },
        false
      );

      scanner.render(
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        () => {
          // ignore transient scan frame errors
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch((err) => console.error(err));
        }
      };
    }
  }, [isOpen, scannerMode]);

  const handleDetectedCode = (code: string) => {
    const trimmed = code.trim();
    const q = trimmed.toLowerCase();
    if (!trimmed) return;

    let matchedCopyBarcode: string | undefined;
    const matched = books.find((b) => {
      if (b.barcode.toLowerCase() === q || b.isbn.toLowerCase() === q || b.id.toLowerCase() === q) {
        return true;
      }
      const copy = b.copies?.find((c) => c.barcode.toLowerCase() === q);
      if (copy) {
        matchedCopyBarcode = copy.barcode;
        return true;
      }
      return false;
    });

    const activeLoan =
      loans.find(
        (l) => l.copyBarcode?.toLowerCase() === q && (l.status === 'active' || l.status === 'overdue')
      ) ||
      loans.find(
        (l) => matched && l.bookId === matched.id && (l.status === 'active' || l.status === 'overdue')
      );

    const borrowerUser = users.find((u) => u.id === activeLoan?.userId);

    playScanFeedback(matched || activeLoan ? 'success' : 'error');
    setLastScanned({
      code: trimmed,
      matchedCopyBarcode,
      book: matched,
      activeLoan,
      borrower: borrowerUser,
      returnedSuccess: false,
    });
    onScanResult(trimmed, matched);
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    handleDetectedCode(manualInput.trim());
    setManualInput('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4 max-sm:items-end max-sm:p-0">
      <div className="bg-white rounded-2xl max-sm:rounded-b-none max-sm:rounded-t-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200 text-slate-900 max-sm:max-h-[92vh] flex flex-col">
        {/* Mobile Grab Handle */}
        <div className="sm:hidden w-12 h-1 bg-slate-300 rounded-full mx-auto my-2 shrink-0" />

        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-emerald-600/20 border border-emerald-500/40 rounded-xl text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Barcode & ISBN Scanner</h2>
              <p className="text-xs text-slate-300">Scan book ISBN, physical copy barcode, or patron ID</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            id="close-scanner-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={() => setScannerMode('camera')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              scannerMode === 'camera'
                ? 'border-emerald-700 text-emerald-800 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Camera className="w-4 h-4" /> Live Camera Scanner
          </button>
          <button
            type="button"
            onClick={() => setScannerMode('usb')}
            className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-2 border-b-2 transition cursor-pointer ${
              scannerMode === 'usb'
                ? 'border-emerald-700 text-emerald-800 bg-white'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <Keyboard className="w-4 h-4" /> USB Reader / Manual Code
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {scannerMode === 'camera' ? (
            <div>
              <div
                id="barcode-reader-container"
                className="overflow-hidden rounded-xl border-2 border-dashed border-emerald-600/40 bg-slate-900 min-h-[220px]"
              />
              <p className="text-center text-xs text-slate-500 mt-2">
                Point your device camera at any ISBN or Copy Barcode sticker.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 text-xs text-emerald-950">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-emerald-800">
                  <Keyboard className="w-4 h-4 text-emerald-700" /> USB Handheld Scanner Mode
                </p>
                <p className="text-slate-700">
                  Connect your USB barcode scanner. Scanning a physical copy sticker or student ID card emits keystrokes directly into the field below.
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">
                  Scan or Enter Copy Barcode / ISBN / Member ID:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. MAG-823-03-04 or 9780061120084"
                    autoFocus
                    className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    id="barcode-manual-input"
                  />
                  <button
                    type="submit"
                    className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition cursor-pointer shrink-0"
                  >
                    Lookup
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Scanned Result Banner */}
          {lastScanned && (
            <div
              className={`p-4 rounded-xl border text-sm space-y-3 ${
                lastScanned.book
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                  : 'bg-amber-50 border-amber-200 text-amber-950'
              }`}
            >
              <div className="flex items-start gap-3">
                {lastScanned.book ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-2 min-w-0">
                  <p className="font-bold text-slate-900 text-xs">
                    Scanned:{' '}
                    <span className="font-mono bg-white px-2 py-0.5 rounded border border-slate-200 text-emerald-800">
                      <bdi>{lastScanned.code}</bdi>
                    </span>
                  </p>

                  {lastScanned.book ? (
                    <div className="flex gap-3 items-center bg-white p-2.5 rounded-xl border border-emerald-200">
                      <img
                        src={lastScanned.book.coverUrl}
                        alt={lastScanned.book.title}
                        className="w-11 h-15 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-slate-900 text-xs truncate"><bdi>{lastScanned.book.title}</bdi></div>
                        <div className="text-[11px] text-slate-500">by <bdi>{lastScanned.book.author}</bdi></div>
                        <div className="text-[10px] text-slate-600 font-mono tabular-nums">
                          {lastScanned.book.shelfLocation} · {lastScanned.book.availableCopies}/{lastScanned.book.totalCopies} avail
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-700">
                      No exact catalog or copy barcode match found. You can register this code as a new item.
                    </p>
                  )}

                  {lastScanned.activeLoan && (
                    <div className="bg-white border border-slate-200 p-3 rounded-xl space-y-2 text-xs text-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-bold uppercase text-[10px] tracking-wider text-slate-600 flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-emerald-700" /> Active Loan Verified
                        </span>
                        <span className="text-[10px] font-mono tabular-nums text-rose-700 font-bold">
                          Due: <bdi>{lastScanned.activeLoan.dueDate}</bdi>
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg border border-slate-200">
                        <div>
                          <div className="font-extrabold text-slate-900">
                            <bdi>{lastScanned.borrower?.name || lastScanned.activeLoan.userName}</bdi>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            <bdi>{lastScanned.borrower?.studentIdCode || lastScanned.borrower?.id || lastScanned.activeLoan.userId}</bdi>
                          </div>
                        </div>

                        {lastScanned.returnedSuccess ? (
                          <span className="bg-emerald-100 text-emerald-900 border border-emerald-300 px-3 py-1 rounded-md text-[11px] font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Returned
                          </span>
                        ) : onProcessReturn ? (
                          <button
                            type="button"
                            onClick={() => {
                              let lateFee = 0;
                              if (lastScanned.activeLoan) {
                                const todayStr = new Date().toISOString().split('T')[0];
                                if (todayStr > lastScanned.activeLoan.dueDate) {
                                  const overdueWorkingDays = calculateWorkingDaysOverdue(lastScanned.activeLoan.dueDate, todayStr, true);
                                  const graceDays = settings?.gracePeriodDays ?? 0;
                                  const billableDays = Math.max(0, overdueWorkingDays - graceDays);
                                  const rateMvr = settings?.lateFeePerDay ?? 2.00;
                                  const maxCapMvr = settings?.maxOverdueFineCap ?? 100.00;
                                  lateFee = Math.min(maxCapMvr, billableDays * rateMvr);
                                }
                                onProcessReturn(lastScanned.activeLoan, lateFee);
                                setLastScanned((prev) =>
                                  prev
                                    ? {
                                        ...prev,
                                        returnedSuccess: true,
                                        activeLoan: { ...prev.activeLoan!, status: 'returned', returnDate: todayStr, lateFee },
                                      }
                                    : null
                                );
                              }
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-[11px] px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Return Now
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Demo Shortcuts */}
          <div className="pt-3 border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-500 mb-2">Quick Test Sample Barcodes:</p>
            <div className="flex flex-wrap gap-1.5">
              {books.slice(0, 3).map((b) => {
                const sampleCode = b.copies?.[0]?.barcode || b.barcode;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleDetectedCode(sampleCode)}
                    className="text-[10px] bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 border border-slate-200 text-slate-700 font-mono px-2.5 py-1 rounded-md transition cursor-pointer"
                  >
                    {b.title.substring(0, 14)}… ({sampleCode})
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end safe-bottom">
          <button
            type="button"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-4 py-2 rounded-xl transition cursor-pointer"
          >
            Done Scanning
          </button>
        </div>
      </div>
    </div>
  );
};
