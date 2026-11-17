import { Book, BookCopy, CopyStatus, Loan } from '../types';

export type AuditZoneMode = 'all' | 'shelf' | 'ddc_range' | 'custom';

export interface AuditZoneFilter {
  mode: AuditZoneMode;
  value: string; // exact shelf prefix, DDC prefix/range e.g. "891.4" or "500-599", or custom query
  label: string;
}

export interface FlattenedCopyItem {
  book: Book;
  copy: BookCopy;
  isVirtualCopy: boolean;
  effectiveShelf: string;
  effectiveRack: string;
}

export type AuditScanOutcome =
  | 'matched_on_shelf'
  | 'mis_shelved'
  | 'ghost_return'
  | 'unknown';

export interface AuditScanEvent {
  id: string;
  scannedCode: string;
  timestamp: string;
  outcome: AuditScanOutcome;
  book?: Book;
  copy?: BookCopy;
  expectedShelf?: string;
  expectedRack?: string;
  activeLoan?: Loan;
  wasPreviouslyMissing?: boolean;
  resolvedAction?: 'checked_in' | 'restored_available';
  note: string;
}

export interface CrewWeedingRules {
  maxIdleMonths: number; // Default 24 months without checkout
  outdatedStemYears: number; // Default 10 years for IT / Science / Tech
  flagDamagedOrFair: boolean; // Condition Damaged / Fair / Maintenance
  excludeReferenceItems: boolean;
  excludeDhivehiHeritage: boolean; // Protects Dhivehi canonical texts from age-only weeding (still flags damage for repair)
}

export type CrewRecommendedAction =
  | 'Weed / Withdraw'
  | 'Repair / Rebind'
  | 'Replace with New Edition'
  | 'Promote / Relocate';

export interface CrewWeedingCandidate {
  book: Book;
  monthsIdle: number;
  lastLoanDate: string | null;
  totalLoanCount: number;
  damagedCopyCount: number;
  fairCopyCount: number;
  publicationAgeYears: number;
  isStemOrTech: boolean;
  isDhivehiHeritage: boolean;
  reasons: string[];
  mustieTags: Array<'M' | 'U' | 'S' | 'T' | 'I' | 'E'>;
  crewScore: number; // 0-100 priority score
  recommendedAction: CrewRecommendedAction;
  estimatedReplacementMvr: number;
}

const STEM_TECH_PATTERN =
  /science|tech|technology|computer|coding|python|programming|physics|chemistry|biology|medicine|robotics|stem|math|engineering|marine|5\d{2}|00[456]|6[0-9]{2}/i;

const CONDITION_NOTE_PATTERN = /torn|water|damaged|missing page|loose|spine|bind|mold|ink|stain/i;

export function flattenCatalogCopies(books: Book[]): FlattenedCopyItem[] {
  const result: FlattenedCopyItem[] = [];

  for (const book of books) {
    if (book.copies && book.copies.length > 0) {
      for (const copy of book.copies) {
        result.push({
          book,
          copy,
          isVirtualCopy: false,
          effectiveShelf: copy.shelfLocation || book.shelfLocation || 'Unassigned Shelf',
          effectiveRack: copy.rackLocation || '',
        });
      }
    } else {
      const total = Math.max(1, book.totalCopies || 1);
      const avail = Math.max(0, Math.min(total, book.availableCopies ?? total));
      for (let i = 1; i <= total; i++) {
        const synthesizedBarcode = i === 1 ? book.barcode : `${book.barcode}-${String(i).padStart(2, '0')}`;
        const status: CopyStatus = i <= avail ? 'Available' : 'Checked Out';
        result.push({
          book,
          copy: {
            copyId: `${book.id}-V${i}`,
            barcode: synthesizedBarcode,
            shelfLocation: book.shelfLocation || 'Unassigned Shelf',
            condition: 'Good',
            acquisitionPriceMvr: 150,
            status,
            acquiredAt: book.addedAt,
          },
          isVirtualCopy: true,
          effectiveShelf: book.shelfLocation || 'Unassigned Shelf',
          effectiveRack: '',
        });
      }
    }
  }

  return result;
}

export function extractAuditZones(books: Book[]): AuditZoneFilter[] {
  const presets: AuditZoneFilter[] = [
    { mode: 'all', value: 'ALL', label: 'All Shelves & Sections (Full Library)' },
  ];

  const shelfSet = new Set<string>();
  const sectionSet = new Set<string>();

  for (const book of books) {
    if (book.shelfLocation) {
      shelfSet.add(book.shelfLocation.trim());
      const section = book.shelfLocation.split(' - ')[0]?.trim();
      if (section && section !== book.shelfLocation.trim()) {
        sectionSet.add(section);
      }
    }
    book.copies?.forEach((c) => {
      if (c.shelfLocation) {
        shelfSet.add(c.shelfLocation.trim());
      }
    });
  }

  Array.from(sectionSet)
    .sort()
    .forEach((sec) => {
      presets.push({
        mode: 'shelf',
        value: sec,
        label: `Section: ${sec}`,
      });
    });

  Array.from(shelfSet)
    .sort()
    .forEach((shelf) => {
      presets.push({
        mode: 'shelf',
        value: shelf,
        label: `Shelf: ${shelf}`,
      });
    });

  presets.push(
    { mode: 'ddc_range', value: '000-099', label: 'DDC 000–099 · Computer Science & Tech' },
    { mode: 'ddc_range', value: '297', label: 'DDC 297 · Islamic Studies' },
    { mode: 'ddc_range', value: '491|891', label: 'DDC 491 & 891 · Dhivehi Language & Literature' },
    { mode: 'ddc_range', value: '500-599', label: 'DDC 500–599 · Natural Sciences' },
    { mode: 'ddc_range', value: '800-899', label: 'DDC 800–899 · Literature & Fiction' },
    { mode: 'ddc_range', value: '900-999', label: 'DDC 900–999 · Geography & History' }
  );

  return presets;
}

function parseDdcNumber(ddc?: string): number | null {
  if (!ddc) return null;
  const match = ddc.match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const num = parseFloat(match[1]);
  return Number.isNaN(num) ? null : num;
}

export function doesCopyMatchZone(
  book: Book,
  copy: BookCopy,
  zone: AuditZoneFilter
): boolean {
  if (zone.mode === 'all' || !zone.value.trim() || zone.value === 'ALL') {
    return true;
  }

  const shelf = (copy.shelfLocation || book.shelfLocation || '').toLowerCase();
  const rack = (copy.rackLocation || '').toLowerCase();
  const ddcStr = (book.ddcCallNumber || '').toLowerCase();
  const cat = (book.category || '').toLowerCase();
  const val = zone.value.trim().toLowerCase();

  if (zone.mode === 'shelf') {
    return shelf === val || shelf.startsWith(val) || rack.includes(val);
  }

  if (zone.mode === 'ddc_range') {
    const ddcNum = parseDdcNumber(book.ddcCallNumber);
    // Support pipe-separated prefixes e.g. "491|891"
    const branches = val.split('|').map((s) => s.trim()).filter(Boolean);
    for (const branch of branches) {
      const rangeMatch = branch.match(/^(\d+(?:\.\d+)?)\s*[-–]\s*(\d+(?:\.\d+)?)$/);
      if (rangeMatch && ddcNum !== null) {
        const min = parseFloat(rangeMatch[1]);
        const max = parseFloat(rangeMatch[2]);
        if (ddcNum >= min && ddcNum <= max) return true;
      } else if (ddcStr.includes(branch)) {
        return true;
      }
    }
    return false;
  }

  // Custom flexible range/prefix e.g. "Shelf A1-A4", "891.4", "Dhivehi"
  const tokens = val
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter(Boolean);

  if (tokens.length === 0) return true;

  return tokens.some((tok) => {
    // Support shelf range like "A1-A4" or "D1-D3"
    const alphaRange = tok.match(/^([a-z\s]*?)([a-z])(\d+)\s*[-–]\s*([a-z])?(\d+)$/i);
    if (alphaRange) {
      const letter = alphaRange[2].toLowerCase();
      const start = parseInt(alphaRange[3], 10);
      const end = parseInt(alphaRange[5], 10);
      for (let n = Math.min(start, end); n <= Math.max(start, end); n++) {
        if (shelf.includes(`${letter}${n}`) || rack.includes(`${letter}${n}`)) {
          return true;
        }
      }
    }
    return (
      shelf.includes(tok) ||
      rack.includes(tok) ||
      ddcStr.includes(tok) ||
      cat.includes(tok)
    );
  });
}

export function evaluateAuditScan(params: {
  rawCode: string;
  zone: AuditZoneFilter;
  books: Book[];
  loans: Loan[];
  alreadyScannedBarcodes?: Set<string>;
}): AuditScanEvent {
  const { rawCode, zone, books, loans, alreadyScannedBarcodes } = params;
  const scannedCode = rawCode.trim();
  const q = scannedCode.toLowerCase();
  const timestamp = new Date().toISOString();
  const id = `audit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  if (!q) {
    return {
      id,
      scannedCode,
      timestamp,
      outcome: 'unknown',
      note: 'Empty barcode input ignored.',
    };
  }

  const allCopies = flattenCatalogCopies(books);

  // 1. Exact copy barcode / accessionNumber / copyId match first
  let matchedItem = allCopies.find(
    (item) =>
      item.copy.barcode.toLowerCase() === q ||
      (item.copy.accessionNumber && item.copy.accessionNumber.toLowerCase() === q) ||
      item.copy.copyId.toLowerCase() === q
  );

  // 2. Fallback to ISBN or Book Barcode (pick first unscanned copy in zone, or any copy)
  if (!matchedItem) {
    const bookMatches = allCopies.filter(
      (item) =>
        item.book.barcode.toLowerCase() === q ||
        item.book.isbn.toLowerCase() === q ||
        item.book.id.toLowerCase() === q
    );
    if (bookMatches.length > 0) {
      matchedItem =
        bookMatches.find(
          (item) =>
            doesCopyMatchZone(item.book, item.copy, zone) &&
            !alreadyScannedBarcodes?.has(item.copy.barcode.toLowerCase())
        ) ||
        bookMatches.find((item) => !alreadyScannedBarcodes?.has(item.copy.barcode.toLowerCase())) ||
        bookMatches[0];
    }
  }

  if (!matchedItem) {
    return {
      id,
      scannedCode,
      timestamp,
      outcome: 'unknown',
      note: `Unrecognized barcode "${scannedCode}" — not registered in catalog.`,
    };
  }

  const { book, copy, effectiveShelf, effectiveRack } = matchedItem;

  // Check active or overdue loan for this copy (Ghost Return detection)
  const activeLoan =
    loans.find(
      (l) =>
        l.status !== 'returned' &&
        l.copyBarcode &&
        l.copyBarcode.toLowerCase() === copy.barcode.toLowerCase()
    ) ||
    (copy.currentLoanId
      ? loans.find((l) => l.id === copy.currentLoanId && l.status !== 'returned')
      : undefined) ||
    (copy.status === 'Checked Out'
      ? loans.find((l) => l.bookId === book.id && l.status !== 'returned')
      : undefined);

  const inTargetZone = doesCopyMatchZone(book, copy, zone);

  if (activeLoan || copy.status === 'Checked Out') {
    return {
      id,
      scannedCode: copy.barcode,
      timestamp,
      outcome: 'ghost_return',
      book,
      copy,
      expectedShelf: effectiveShelf,
      expectedRack: effectiveRack,
      activeLoan,
      note: activeLoan
        ? `Marked Checked Out to ${activeLoan.userName} (Due ${activeLoan.dueDate})${!inTargetZone ? ` · Also belongs on ${effectiveShelf}` : ''}.`
        : `Copy status is Checked Out in catalog${!inTargetZone ? ` · Expected on ${effectiveShelf}` : ''}.`,
    };
  }

  if (!inTargetZone) {
    return {
      id,
      scannedCode: copy.barcode,
      timestamp,
      outcome: 'mis_shelved',
      book,
      copy,
      expectedShelf: effectiveShelf,
      expectedRack: effectiveRack,
      note: `Belongs on "${effectiveShelf}"${effectiveRack ? ` (${effectiveRack})` : ''} — not ${zone.label}.`,
    };
  }

  const wasPreviouslyMissing = copy.status === 'Missing' || copy.status === 'Lost';
  return {
    id,
    scannedCode: copy.barcode,
    timestamp,
    outcome: 'matched_on_shelf',
    book,
    copy,
    expectedShelf: effectiveShelf,
    expectedRack: effectiveRack,
    wasPreviouslyMissing,
    note: wasPreviouslyMissing
      ? `Found on ${effectiveShelf}! Previously marked ${copy.status}.`
      : `Verified on ${effectiveShelf} (${book.ddcCallNumber || 'No DDC'}).`,
  };
}

export interface AuditReconciliationSummary {
  expectedInZone: FlattenedCopyItem[];
  verifiedOnShelf: FlattenedCopyItem[];
  missingUnscanned: FlattenedCopyItem[];
  checkedOutOutOfShelf: FlattenedCopyItem[];
  misShelvedEvents: AuditScanEvent[];
  ghostReturnEvents: AuditScanEvent[];
}

export function computeAuditReconciliation(params: {
  zone: AuditZoneFilter;
  books: Book[];
  scannedEvents: AuditScanEvent[];
}): AuditReconciliationSummary {
  const { zone, books, scannedEvents } = params;
  const allCopies = flattenCatalogCopies(books);
  const expectedInZone = allCopies.filter((item) => doesCopyMatchZone(item.book, item.copy, zone));

  const scannedCodeSet = new Set(
    scannedEvents
      .filter((e) => e.outcome !== 'unknown')
      .map((e) => (e.copy?.barcode || e.scannedCode).toLowerCase())
  );

  const verifiedOnShelf: FlattenedCopyItem[] = [];
  const missingUnscanned: FlattenedCopyItem[] = [];
  const checkedOutOutOfShelf: FlattenedCopyItem[] = [];

  for (const item of expectedInZone) {
    const codeKey = item.copy.barcode.toLowerCase();
    if (scannedCodeSet.has(codeKey)) {
      verifiedOnShelf.push(item);
    } else if (item.copy.status === 'Checked Out') {
      checkedOutOutOfShelf.push(item);
    } else {
      missingUnscanned.push(item);
    }
  }

  const misShelvedEvents = scannedEvents.filter((e) => e.outcome === 'mis_shelved');
  const ghostReturnEvents = scannedEvents.filter((e) => e.outcome === 'ghost_return');

  return {
    expectedInZone,
    verifiedOnShelf,
    missingUnscanned,
    checkedOutOutOfShelf,
    misShelvedEvents,
    ghostReturnEvents,
  };
}

function monthsBetweenIsoDates(fromIso: string, toIso: string): number {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0;
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  const days = to.getDate() - from.getDate();
  return Math.max(0, years * 12 + months + (days >= 15 ? 1 : 0));
}

export function evaluateCrewWeedingCandidates(
  books: Book[],
  loans: Loan[],
  rules: CrewWeedingRules,
  referenceDateIso = new Date().toISOString().split('T')[0]
): CrewWeedingCandidate[] {
  const refYear = new Date(referenceDateIso).getFullYear() || new Date().getFullYear();

  const loansByBook = new Map<string, Loan[]>();
  for (const l of loans) {
    if (!loansByBook.has(l.bookId)) loansByBook.set(l.bookId, []);
    loansByBook.get(l.bookId)!.push(l);
  }

  const candidates: CrewWeedingCandidate[] = [];

  for (const book of books) {
    if (rules.excludeReferenceItems && book.isReferenceOnly) continue;

    const bookLoans = loansByBook.get(book.id) || [];
    const sortedLoanDates = bookLoans
      .map((l) => l.returnDate || l.issueDate)
      .filter(Boolean)
      .sort();

    const lastLoanDate = sortedLoanDates.length > 0 ? sortedLoanDates[sortedLoanDates.length - 1] : null;
    const anchorDate = lastLoanDate || book.addedAt || `${book.publicationYear || refYear}-01-01`;
    const monthsIdle = monthsBetweenIsoDates(anchorDate, referenceDateIso);

    const copies = book.copies || [];
    const damagedCopyCount = copies.filter(
      (c) =>
        c.condition === 'Damaged' ||
        c.condition === 'Lost' ||
        c.status === 'Maintenance' ||
        c.status === 'Missing' ||
        c.status === 'Lost' ||
        (c.notes ? CONDITION_NOTE_PATTERN.test(c.notes) : false)
    ).length;

    const fairCopyCount = copies.filter((c) => c.condition === 'Fair').length;
    const avgPriceMvr =
      copies.length > 0
        ? Math.round(copies.reduce((acc, c) => acc + (c.acquisitionPriceMvr || 150), 0) / copies.length)
        : 180;

    const pubYear = Number(book.publicationYear) || refYear;
    const publicationAgeYears = Math.max(0, refYear - pubYear);
    const isStemOrTech = STEM_TECH_PATTERN.test(
      `${book.category} ${book.ddcCallNumber || ''} ${(book.tags || []).join(' ')} ${book.title}`
    );
    const isDhivehiHeritage =
      book.bookLanguage === 'Dhivehi' ||
      /dhivehi|891\.49|491\.49|islamic/i.test(`${book.category} ${book.ddcCallNumber || ''}`);

    const reasons: string[] = [];
    const mustieTags: Array<'M' | 'U' | 'S' | 'T' | 'I' | 'E'> = [];
    let crewScore = 0;

    // CREW Criterion 1: Zero checkouts within maxIdleMonths
    const hasActiveLoanNow = bookLoans.some((l) => l.status !== 'returned');
    if (!hasActiveLoanNow && monthsIdle >= rules.maxIdleMonths) {
      const ageBypass = rules.excludeDhivehiHeritage && isDhivehiHeritage;
      if (!ageBypass) {
        reasons.push(
          lastLoanDate
            ? `Zero check-outs in ${monthsIdle} months (last loan ${lastLoanDate})`
            : `Zero check-outs in ${monthsIdle} months since catalogued`
        );
        mustieTags.push('I');
        crewScore += Math.min(45, 25 + Math.round((monthsIdle - rules.maxIdleMonths) * 1.5));
      }
    }

    // CREW Criterion 2: Physical damage / wear / repair notes
    if (rules.flagDamagedOrFair && (damagedCopyCount > 0 || fairCopyCount > 0)) {
      if (damagedCopyCount > 0) {
        reasons.push(`${damagedCopyCount} damaged/missing/maintenance copy(ies)`);
        mustieTags.push('U');
        crewScore += 35 + Math.min(20, damagedCopyCount * 10);
      } else if (fairCopyCount > 0) {
        reasons.push(`${fairCopyCount} copy(ies) in Fair/worn condition`);
        mustieTags.push('U');
        crewScore += 22;
      }
    }

    // CREW Criterion 3: Outdated IT / Science / Fast-changing subjects
    if (isStemOrTech && publicationAgeYears >= rules.outdatedStemYears) {
      reasons.push(
        `Outdated ${book.category} edition (${pubYear}, ${publicationAgeYears} yrs old >= ${rules.outdatedStemYears}y threshold)`
      );
      mustieTags.push('S', 'M');
      crewScore += Math.min(50, 30 + (publicationAgeYears - rules.outdatedStemYears) * 2);
    }

    if (reasons.length === 0) continue;

    let recommendedAction: CrewRecommendedAction = 'Promote / Relocate';
    if (isStemOrTech && publicationAgeYears >= rules.outdatedStemYears) {
      recommendedAction = 'Replace with New Edition';
    } else if (damagedCopyCount > 0 && isDhivehiHeritage) {
      recommendedAction = 'Repair / Rebind';
    } else if (damagedCopyCount >= Math.max(1, Math.ceil((copies.length || 1) / 2))) {
      recommendedAction = 'Repair / Rebind';
    } else if (monthsIdle >= rules.maxIdleMonths) {
      recommendedAction = 'Weed / Withdraw';
    }

    candidates.push({
      book,
      monthsIdle,
      lastLoanDate,
      totalLoanCount: bookLoans.length,
      damagedCopyCount,
      fairCopyCount,
      publicationAgeYears,
      isStemOrTech,
      isDhivehiHeritage,
      reasons,
      mustieTags: Array.from(new Set(mustieTags)),
      crewScore: Math.min(100, crewScore),
      recommendedAction,
      estimatedReplacementMvr: avgPriceMvr,
    });
  }

  return candidates.sort((a, b) => b.crewScore - a.crewScore);
}

function escapeCsvCell(val: unknown): string {
  const s = String(val ?? '');
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function buildWeedingProposalCsv(candidates: CrewWeedingCandidate[]): string {
  const headers = [
    'Book ID',
    'Title',
    'Author',
    'ISBN / Barcode',
    'DDC Call Number',
    'Category',
    'Shelf Location',
    'Publication Year',
    'Months Idle',
    'Last Loan Date',
    'Damaged Copies',
    'CREW Score',
    'MUSTIE Tags',
    'Flag Reasons',
    'Recommended Action',
    'Est Replacement Cost (MVR)',
  ];

  const rows = candidates.map((c) =>
    [
      c.book.id,
      c.book.title,
      c.book.author,
      c.book.isbn || c.book.barcode,
      c.book.ddcCallNumber || '',
      c.book.category,
      c.book.shelfLocation,
      c.book.publicationYear,
      c.monthsIdle,
      c.lastLoanDate || 'Never Checked Out',
      c.damagedCopyCount,
      c.crewScore,
      c.mustieTags.join('+'),
      c.reasons.join(' | '),
      c.recommendedAction,
      c.estimatedReplacementMvr.toFixed(2),
    ]
      .map(escapeCsvCell)
      .join(',')
  );

  return [headers.map(escapeCsvCell).join(','), ...rows].join('\n');
}

export function downloadWeedingProposalCsv(candidates: CrewWeedingCandidate[]): void {
  if (typeof document === 'undefined') return;
  const csv = buildWeedingProposalCsv(candidates);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `magoodhoo-crew-weeding-proposal-${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function printWeedingProposalReport(params: {
  candidates: CrewWeedingCandidate[];
  rules: CrewWeedingRules;
  aiSummary?: string;
}): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const { candidates, rules, aiSummary } = params;
  const totalReplacementMvr = candidates.reduce((sum, c) => sum + c.estimatedReplacementMvr, 0);

  const rowsHtml = candidates
    .map(
      (c) => `
      <tr>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;">
          <div>${escapeHtml(c.book.title)}</div>
          <div style="font-size:10px;color:#64748b;font-weight:500;">${escapeHtml(c.book.author)} · ${escapeHtml(c.book.isbn || c.book.barcode)}</div>
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-family:'JetBrains Mono',monospace;font-size:10px;">
          <div>${escapeHtml(c.book.ddcCallNumber || 'DDC —')}</div>
          <div style="color:#64748b;">${escapeHtml(c.book.shelfLocation)}</div>
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-family:'JetBrains Mono',monospace;text-align:center;">
          ${c.monthsIdle} mo
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-size:10px;">
          ${c.reasons.map((r) => `<div>• ${escapeHtml(r)}</div>`).join('')}
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;font-weight:700;font-size:10px;">
          ${escapeHtml(c.recommendedAction)}
        </td>
        <td style="padding:7px 8px;border-bottom:1px solid #e2e8f0;text-align:right;font-family:'JetBrains Mono',monospace;font-weight:700;">
          MVR ${c.estimatedReplacementMvr.toFixed(2)}
        </td>
      </tr>`
    )
    .join('');

  const html = `
    <div style="padding:18px;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#0f172a;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #047857;padding-bottom:10px;margin-bottom:14px;">
        <div>
          <div style="font-size:10px;font-weight:800;color:#047857;text-transform:uppercase;letter-spacing:0.08em;">F. Magoodhoo School Library · CREW Collection Maintenance</div>
          <h1 style="font-size:18px;font-weight:900;margin:2px 0 0;">Collection Weeding & Replacement Proposal</h1>
        </div>
        <div style="text-align:right;font-family:'JetBrains Mono',monospace;font-size:11px;color:#475569;">
          <div>Idle >= ${rules.maxIdleMonths}mo · STEM Age >= ${rules.outdatedStemYears}y</div>
          <div>Generated: ${new Date().toISOString().split('T')[0]}</div>
        </div>
      </div>

      ${
        aiSummary
          ? `<div style="background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:10px 12px;margin-bottom:14px;font-size:11px;line-height:1.5;color:#1e293b;">
               <strong style="color:#047857;text-transform:uppercase;font-size:10px;letter-spacing:0.06em;">CREW Assessment Summary</strong>
               <div style="margin-top:4px;">${escapeHtml(aiSummary)}</div>
             </div>`
          : ''
      }

      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#475569;font-weight:700;text-transform:uppercase;">Flagged Titles</div>
          <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:4px;">${candidates.length}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#b45309;font-weight:700;text-transform:uppercase;">Replace / Repair Actions</div>
          <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:4px;">${candidates.filter((c) => c.recommendedAction !== 'Weed / Withdraw').length}</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:10px;">
          <div style="font-size:10px;color:#047857;font-weight:700;text-transform:uppercase;">Est. Replacement Budget</div>
          <div style="font-size:16px;font-weight:900;font-family:'JetBrains Mono',monospace;margin-top:4px;">MVR ${totalReplacementMvr.toFixed(2)}</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:1.5px solid #cbd5e1;text-align:left;font-size:10px;text-transform:uppercase;">
            <th style="padding:7px 8px;">Title & Author</th>
            <th style="padding:7px 8px;">Call / Shelf</th>
            <th style="padding:7px 8px;text-align:center;">Idle</th>
            <th style="padding:7px 8px;">CREW Flags (MUSTIE)</th>
            <th style="padding:7px 8px;">Action</th>
            <th style="padding:7px 8px;text-align:right;">Est. Value</th>
          </tr>
        </thead>
        <tbody>
          ${
            rowsHtml ||
            `<tr><td colspan="6" style="padding:12px;text-align:center;color:#64748b;">No collection titles matched current CREW thresholds.</td></tr>`
          }
        </tbody>
      </table>
    </div>
  `;

  const existing = document.getElementById('magoodhoo-print-sheet-portal');
  if (existing) existing.remove();
  const oldStyle = document.getElementById('magoodhoo-print-sheet-style');
  if (oldStyle) oldStyle.remove();

  const styleEl = document.createElement('style');
  styleEl.id = 'magoodhoo-print-sheet-style';
  styleEl.textContent = `
    #magoodhoo-print-sheet-portal { display: none; }
    @media print {
      body > *:not(#magoodhoo-print-sheet-portal) { display: none !important; }
      #magoodhoo-print-sheet-portal { display: block !important; background: #fff !important; color: #0f172a !important; }
    }
  `;

  const container = document.createElement('div');
  container.id = 'magoodhoo-print-sheet-portal';
  container.innerHTML = html;

  document.head.appendChild(styleEl);
  document.body.appendChild(container);

  const cleanup = () => {
    container.remove();
    styleEl.remove();
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);
  window.print();
  setTimeout(cleanup, 1500);
}
