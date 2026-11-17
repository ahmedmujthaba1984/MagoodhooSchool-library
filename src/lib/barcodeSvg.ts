// Deterministic Code-128 & QR matrix generator + Web Audio API acoustic feedback utility

export interface BarcodeBar {
  x: number;
  width: number;
}

/**
 * Generates deterministic Code-128 style vertical bars for any alphanumeric string.
 * Designed for clean SVG rendering on Library ID cards and Book Barcode Stickers.
 */
export function generateCode128Bars(code: string): { bars: BarcodeBar[]; totalWidth: number } {
  const safeCode = (code || 'MAG-0000').trim();
  const bars: BarcodeBar[] = [];
  let x = 4;

  // Start guard pattern
  bars.push({ x, width: 2 }); x += 4;
  bars.push({ x, width: 1 }); x += 2;
  bars.push({ x, width: 2 }); x += 4;

  for (let i = 0; i < safeCode.length; i++) {
    const ch = safeCode.charCodeAt(i);
    const w1 = ((ch >> 0) & 3) + 1;
    const g1 = ((ch >> 2) & 1) + 1;
    const w2 = ((ch >> 3) & 2) + 1;
    const g2 = ((ch >> 5) & 1) + 1;

    bars.push({ x, width: w1 });
    x += w1 + g1;
    bars.push({ x, width: w2 });
    x += w2 + g2;
  }

  // Stop guard pattern
  bars.push({ x, width: 2 }); x += 3;
  bars.push({ x, width: 1 }); x += 2;
  bars.push({ x, width: 3 }); x += 6;

  return { bars, totalWidth: x };
}

/**
 * Generates a crisp deterministic 21x21 QR-style matrix with 3 finder patterns
 * and deterministic encoded payload cells for zero-dependency offline SVG spine/ID QR stickers.
 */
export function generateQrMatrix(code: string, gridSize = 21): boolean[][] {
  const safe = (code || 'MAG-0000').trim();
  const matrix: boolean[][] = Array.from({ length: gridSize }, () => Array(gridSize).fill(false));

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, gridSize - 7);
  drawFinder(gridSize - 7, 0);

  // Timing patterns
  for (let i = 8; i < gridSize - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Deterministic payload hash bits into remaining cells
  let hash = 2166136261;
  for (let i = 0; i < safe.length; i++) {
    hash ^= safe.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= gridSize - 8;
      const inBottomLeft = r >= gridSize - 8 && c < 8;
      const onTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || onTiming) continue;

      const idx = r * gridSize + c;
      const charVal = safe.charCodeAt(idx % safe.length);
      const bit = ((hash >>> (idx % 24)) ^ (charVal + r * 7 + c * 13)) & 1;
      matrix[r][c] = bit === 1;
    }
  }

  return matrix;
}

export type ScanFeedbackType =
  | 'success'
  | 'error'
  | 'checked_out'
  | 'returned'
  | 'hold_triggered'
  | 'blocked'
  | 'audit_match'
  | 'audit_misshelved'
  | 'audit_ghost';

/**
 * Plays crisp non-intrusive acoustic feedback using Web Audio API for rapid circulation & shelf audit scanning.
 * Distinct signatures for Checked Out, Returned, Hold Triggered, Blocked, and Audit Anomalies.
 */
export function playScanFeedback(type: ScanFeedbackType = 'success'): void {
  if (typeof window === 'undefined') return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const playTone = (freq: number, startOffset: number, duration: number, wave: OscillatorType = 'sine', peakGain = 0.11) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + startOffset);
      gain.gain.setValueAtTime(peakGain, now + startOffset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + startOffset + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + startOffset);
      osc.stop(now + startOffset + duration);
    };

    if (type === 'checked_out' || type === 'success') {
      // Ascending C6 -> E6 crisp checkout chime
      playTone(1046.5, 0, 0.08, 'sine', 0.11);
      playTone(1318.5, 0.07, 0.12, 'sine', 0.11);
    } else if (type === 'audit_match') {
      // Green Ping: crisp rapid high sine G6 -> B6
      playTone(1567.98, 0, 0.055, 'sine', 0.10);
      playTone(1975.53, 0.055, 0.09, 'sine', 0.10);
    } else if (type === 'audit_misshelved') {
      // Amber Warning: distinct two-tone F5 -> D5 chirp
      playTone(698.46, 0, 0.08, 'triangle', 0.13);
      playTone(587.33, 0.09, 0.13, 'triangle', 0.13);
    } else if (type === 'audit_ghost') {
      // Blue Notice (Ghost Return): ascending E5 -> A5 -> C#6 notice ping
      playTone(659.25, 0, 0.06, 'sine', 0.11);
      playTone(880.0, 0.06, 0.06, 'sine', 0.11);
      playTone(1108.73, 0.12, 0.12, 'sine', 0.11);
    } else if (type === 'returned') {
      // Crisp 2-note descending-settling return chime (E6 -> G6)
      playTone(1318.5, 0, 0.07, 'sine', 0.10);
      playTone(1567.98, 0.08, 0.14, 'sine', 0.11);
    } else if (type === 'hold_triggered') {
      // Distinct 3-pulse hold alert chime (A5 -> C#6 -> A5)
      playTone(880, 0, 0.07, 'triangle', 0.12);
      playTone(1108.73, 0.08, 0.07, 'triangle', 0.12);
      playTone(880, 0.16, 0.12, 'triangle', 0.11);
    } else {
      // Blocked / Overdue / Limit Reached low double buzz
      playTone(230, 0, 0.1, 'triangle', 0.14);
      playTone(175, 0.11, 0.16, 'triangle', 0.14);
    }
  } catch {
    // Ignore audio context autoplay blocks
  }
}
