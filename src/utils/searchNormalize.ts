import { Book } from '../types';

const THAANA_AND_ARABIC_FILI_REGEX = /[\u064B-\u065F\u0670\u07A6-\u07B0]/g;

const LOOKALIKE_CHAR_MAP: Record<string, string> = {
  // Arabic / Persian keyboard variants mapped to Thaana or canonical Arabic equivalents
  '\u0643': '\u0786', // ك -> ކ
  '\u06A9': '\u0786', // ک -> ކ
  '\u064A': '\u0794', // ي -> ޔ
  '\u0649': '\u0794', // ى -> ޔ
  '\u06CC': '\u0794', // ی -> ޔ
  '\u0629': '\u078C', // ة -> ތ
  '\u0623': '\u0787', // أ -> އ
  '\u0625': '\u0787', // إ -> އ
  '\u0622': '\u0787', // آ -> އ
  // Arabic-Indic & Extended Arabic-Indic digits -> ASCII 0-9
  '\u0660': '0',
  '\u0661': '1',
  '\u0662': '2',
  '\u0663': '3',
  '\u0664': '4',
  '\u0665': '5',
  '\u0666': '6',
  '\u0667': '7',
  '\u0668': '8',
  '\u0669': '9',
  '\u06F0': '0',
  '\u06F1': '1',
  '\u06F2': '2',
  '\u06F3': '3',
  '\u06F4': '4',
  '\u06F5': '5',
  '\u06F6': '6',
  '\u06F7': '7',
  '\u06F8': '8',
  '\u06F9': '9',
};

const LOOKALIKE_REGEX = new RegExp(`[${Object.keys(LOOKALIKE_CHAR_MAP).join('')}]`, 'g');

/**
 * Normalizes bilingual Dhivehi (Thaana), Arabic, and English strings for fuzzy catalog matching:
 * - Coerces null/undefined safely to ""
 * - Strips Thaana vowel diacritics (fili: \u07A6-\u07B0) and Arabic harakat (\u064B-\u065F)
 * - Maps common Arabic/Persian lookalikes (ك->ކ, ي/ی->ޔ) and Eastern digits
 * - Lowercases Latin text and collapses extra whitespace
 */
export function normalizeSearchText(input: unknown): string {
  if (input === null || input === undefined) return '';
  const raw = String(input);
  if (!raw) return '';

  return raw
    .normalize('NFKC')
    .replace(THAANA_AND_ARABIC_FILI_REGEX, '')
    .replace(LOOKALIKE_REGEX, (ch) => LOOKALIKE_CHAR_MAP[ch] ?? ch)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Strips hyphens, whitespace, and delimiters for ISBN / Barcode / Call-Number matching
 * so queries like "978-99915-12-3" match "97899915123".
 */
export function normalizeCodeQuery(input: unknown): string {
  if (input === null || input === undefined) return '';
  return normalizeSearchText(input).replace(/[-\s_:./]+/g, '');
}

/**
 * Normalizes dynamic facet values (Subjects, Publishers, Grade Levels) by trimming,
 * collapsing spaces, and unifying casing so duplicate variations collapse cleanly.
 */
export function normalizeFacetLabel(input: unknown): string {
  if (input === null || input === undefined) return '';
  const cleaned = String(input).replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  // Preserve Thaana/Arabic characters untouched; title-case pure ASCII labels if lowercase
  if (/^[\x00-\x7F]+$/.test(cleaned) && cleaned === cleaned.toLowerCase()) {
    return cleaned.replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return cleaned;
}

/**
 * Extracts a null-safe searchable text bundle and normalized code bundle for any Book record.
 */
export function getNormalizedBookSearchFields(book: Partial<Book> & { authors?: string[] }): {
  textHaystack: string;
  codeHaystack: string;
} {
  const safeAuthors = Array.isArray(book.authors) ? book.authors.filter(Boolean).join(' ') : '';
  const safeTags = Array.isArray(book.tags) ? book.tags.filter(Boolean).join(' ') : '';
  const copyBarcodes = Array.isArray(book.copies)
    ? book.copies.map((cp) => cp?.barcode ?? '').filter(Boolean).join(' ')
    : '';

  const combinedText = [
    book.title ?? '',
    book.titleEn ?? '',
    book.titleDv ?? '',
    book.author ?? '',
    safeAuthors,
    book.category ?? '',
    book.publisher ?? '',
    book.shelfLocation ?? '',
    book.ddcCallNumber ?? '',
    book.targetGrade ?? '',
    book.description ?? '',
    book.descriptionDv ?? '',
    safeTags,
  ].join(' ');

  const combinedCodes = [
    book.isbn ?? '',
    book.barcode ?? '',
    book.ddcCallNumber ?? '',
    copyBarcodes,
  ].join(' ');

  return {
    textHaystack: normalizeSearchText(combinedText),
    codeHaystack: normalizeCodeQuery(combinedCodes),
  };
}
