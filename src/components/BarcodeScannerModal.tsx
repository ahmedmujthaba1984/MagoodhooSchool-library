import React, { useEffect, useState, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { QrCode, X, Camera, Keyboard, CheckCircle2, AlertCircle, BookOpen } from 'lucide-react';
import { Book } from '../types';

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  onScanResult: (scannedCode: string, matchedBook?: Book) => void;
}

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  books,
  onScanResult
}) => {
  const [manualInput, setManualInput] = useState('');
  const [lastScanned, setLastScanned] = useState<{ code: string; book?: Book } | null>(null);
  const [scannerMode, setScannerMode] = useState<'camera' | 'usb'>('camera');
  const [scanError, setScanError] = useState<string | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isOpen && scannerMode === 'camera') {
      // Initialize html5-qrcode scanner
      const scanner = new Html5QrcodeScanner(
        "barcode-reader-container",
        {
          fps: 10,
          qrbox: { width: 280, height: 160 },
          aspectRatio: 1.777778,
        },
        /* verbose= */ false
      );

      scanner.render(
        (decodedText) => {
          handleDetectedCode(decodedText);
        },
        (errorMessage) => {
          // ignore transient scan frame errors
        }
      );

      scannerRef.current = scanner;

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(err => console.error(err));
        }
      };
    }
  }, [isOpen, scannerMode]);

  const handleDetectedCode = (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;

    // Check if matched in books database
    const matched = books.find(
      b => b.barcode.toLowerCase() === trimmed.toLowerCase() || b.isbn.toLowerCase() === trimmed.toLowerCase() || b.id === trimmed
    );

    setLastScanned({ code: trimmed, book: matched });
    setScanError(null);
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xl flex items-center justify-center p-4">
      <div className="bg-slate-900/95 backdrop-blur-2xl rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-white/15 animate-in fade-in zoom-in-95 duration-200 text-slate-100">
        
        {/* Header */}
        <div className="bg-black/30 border-b border-white/10 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-600/30 border border-indigo-500/30 rounded-xl text-indigo-300">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Barcode & ISBN Scanner</h2>
              <p className="text-xs text-slate-400">Scan book ISBN, barcode label, or student ID</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition"
            id="close-scanner-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Switcher */}
        <div className="flex border-b border-white/10 bg-black/20">
          <button
            onClick={() => setScannerMode('camera')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              scannerMode === 'camera'
                ? 'border-indigo-400 text-indigo-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Camera className="w-4 h-4" /> Live Camera Scanner
          </button>
          <button
            onClick={() => setScannerMode('usb')}
            className={`flex-1 py-3 text-xs font-semibold flex items-center justify-center gap-2 border-b-2 transition ${
              scannerMode === 'usb'
                ? 'border-indigo-400 text-indigo-300 bg-white/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            <Keyboard className="w-4 h-4" /> USB Reader / Manual ISBN
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {scannerMode === 'camera' ? (
            <div>
              <div
                id="barcode-reader-container"
                className="overflow-hidden rounded-2xl border-2 border-dashed border-indigo-500/30 bg-black/40 min-h-[220px]"
              ></div>
              <p className="text-center text-xs text-slate-400 mt-2">
                Point your device camera at any ISBN or Barcode on the book cover.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-2xl p-4 text-xs text-indigo-200">
                <p className="font-semibold mb-1 flex items-center gap-1.5 text-indigo-300">
                  <Keyboard className="w-4 h-4 text-indigo-400" /> USB Handheld Scanner Mode
                </p>
                <p className="text-slate-300">
                  Connect your physical USB barcode scanner. When you scan a book or student ID card, the reader sends keyboard keystrokes directly into the input field below.
                </p>
              </div>

              <form onSubmit={handleManualSubmit} className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Scan or Enter Barcode / ISBN Number:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. 9780061120084 or STU-2041"
                    autoFocus
                    className="flex-1 px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm font-mono text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    id="barcode-manual-input"
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/20 transition"
                  >
                    Submit Code
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Scanned Result Banner */}
          {lastScanned && (
            <div className={`mt-5 p-4 rounded-2xl border text-sm ${
              lastScanned.book ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200' : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
            }`}>
              <div className="flex items-start gap-3">
                {lastScanned.book ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <p className="font-bold text-white">
                    Scanned Code: <span className="font-mono text-xs bg-black/40 px-2 py-0.5 rounded border border-white/10 text-indigo-300">{lastScanned.code}</span>
                  </p>
                  {lastScanned.book ? (
                    <div className="mt-2 flex gap-3 items-center bg-black/40 p-2.5 rounded-xl border border-emerald-500/20">
                      <img
                        src={lastScanned.book.coverUrl}
                        alt={lastScanned.book.title}
                        className="w-12 h-16 object-cover rounded-lg shadow border border-white/10"
                      />
                      <div>
                        <div className="font-bold text-white text-xs">{lastScanned.book.title}</div>
                        <div className="text-[11px] text-slate-400">by {lastScanned.book.author}</div>
                        <div className="text-[10px] text-slate-300 mt-0.5">
                          Location: <span className="font-medium text-slate-200">{lastScanned.book.shelfLocation}</span> | Available: <span className="font-semibold text-emerald-300">{lastScanned.book.availableCopies}/{lastScanned.book.totalCopies}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs mt-1 text-slate-300">
                      No exact book match in database. (You can still process this code or add a new record).
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Quick Demo Shortcuts */}
          <div className="mt-4 pt-3 border-t border-white/10">
            <p className="text-[11px] font-semibold text-slate-400 mb-2">Test Sample Barcodes:</p>
            <div className="flex flex-wrap gap-1.5">
              {books.slice(0, 3).map(b => (
                <button
                  key={b.id}
                  onClick={() => handleDetectedCode(b.barcode)}
                  className="text-[10px] bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-300 border border-white/10 text-slate-300 font-mono px-2.5 py-1 rounded-xl transition"
                >
                  {b.title.substring(0, 15)}... ({b.barcode})
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="bg-black/30 px-5 py-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="bg-white/10 hover:bg-white/20 text-white font-semibold text-xs px-4 py-2 rounded-xl transition border border-white/10"
          >
            Done Scanning
          </button>
        </div>

      </div>
    </div>
  );
};
