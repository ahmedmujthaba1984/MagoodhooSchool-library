import { useEffect, useRef } from 'react';

interface UseBarcodeScannerOptions {
  enabled?: boolean;
  minLength?: number;
  maxIntervalMs?: number;
  onScan: (code: string) => void;
}

/**
 * Captures rapid USB HID keyboard-emulated barcode scanner input globally without interfering with normal typing.
 * USB scanners emit characters rapidly (<45ms between keystrokes) followed by Enter.
 */
export function useBarcodeScanner({
  enabled = true,
  minLength = 4,
  maxIntervalMs = 50,
  onScan,
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      const now = Date.now();
      const elapsed = now - lastKeyTimeRef.current;

      if (elapsed > maxIntervalMs) {
        bufferRef.current = '';
      }
      lastKeyTimeRef.current = now;

      if (e.key === 'Enter') {
        const scanned = bufferRef.current.trim();
        bufferRef.current = '';
        if (scanned.length >= minLength && !isInputFocused) {
          e.preventDefault();
          onScan(scanned);
        }
        return;
      }

      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        bufferRef.current += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, minLength, maxIntervalMs, onScan]);
}
