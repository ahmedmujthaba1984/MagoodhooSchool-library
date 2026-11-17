import { Book, MediaType, PersonalItem, ReadingProgressStatus } from '../types';

/**
 * Zero-Lock-In Data Portability Utility: CSV, JSON, and MARC21 (.mrk) export & import
 */

export type PersonalImportField =
  | 'ignore'
  | 'title'
  | 'author'
  | 'isbn'
  | 'upc'
  | 'mediaType'
  | 'language'
  | 'shelfGroup'
  | 'publisher'
  | 'publicationYear'
  | 'pageCount'
  | 'currentPage'
  | 'ddcCallNumber'
  | 'readingStatus'
  | 'rating'
  | 'tags'
  | 'loanedTo'
  | 'reminderDate'
  | 'reviewText'
  | 'privateNotes';

export interface CsvPreviewData {
  headers: string[];
  rows: string[][];
}

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * RFC-4180 aware CSV line splitter supporting quoted commas and escaped double quotes.
 */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseCsvPreview(rawText: string): CsvPreviewData {
  const clean = rawText.replace(/^\uFEFF/, '').trim();
  if (!clean) return { headers: [], rows: [] };

  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCsvLine(lines[0]).map((h, i) => h || `Column ${i + 1}`);
  const rows = lines.slice(1).map((line) => parseCsvLine(line));

  return { headers, rows };
}

export function suggestCsvMapping(headers: string[]): PersonalImportField[] {
  return headers.map((header) => {
    const h = header.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (h === 'title' || h === 'booktitle' || h === 'name') return 'title';
    if (h === 'author' || h === 'authors' || h === 'creator') return 'author';
    if (h === 'isbn' || h === 'isbn13' || h === 'isbn10' || h === 'isbnupc') return 'isbn';
    if (h === 'upc' || h === 'ean') return 'upc';
    if (h === 'mediatype' || h === 'format' || h === 'type') return 'mediaType';
    if (h === 'language' || h === 'lang') return 'language';
    if (h === 'shelf' || h === 'shelfgroup' || h === 'locationshelf' || h === 'collection') return 'shelfGroup';
    if (h === 'publisher') return 'publisher';
    if (h === 'year' || h === 'publicationyear' || h === 'published') return 'publicationYear';
    if (h === 'pages' || h === 'pagecount') return 'pageCount';
    if (h === 'currentpage' || h === 'progresspage') return 'currentPage';
    if (h === 'ddc' || h === 'ddccallnumber' || h === 'callnumber') return 'ddcCallNumber';
    if (h === 'status' || h === 'readingstatus') return 'readingStatus';
    if (h === 'rating' || h === 'stars') return 'rating';
    if (h === 'tags' || h === 'tagscategory' || h === 'subjects' || h === 'genre') return 'tags';
    if (h === 'loanedto' || h === 'borrower') return 'loanedTo';
    if (h === 'reminderdate' || h === 'duedate') return 'reminderDate';
    if (h === 'review' || h === 'reviewtext') return 'reviewText';
    if (h === 'notes' || h === 'privatenotes' || h === 'comments') return 'privateNotes';
    return 'ignore';
  });
}

function normalizeMediaType(val: string): MediaType {
  const v = val.toLowerCase().trim();
  if (v.includes('e-book') || v.includes('ebook')) return 'E-Book';
  if (v.includes('audio')) return 'Audiobook';
  if (v.includes('periodical') || v.includes('mag')) return 'Periodical';
  if (v.includes('game')) return 'Board Game';
  if (v.includes('video') || v.includes('dvd')) return 'Video/DVD';
  if (v.includes('kit') || v.includes('study')) return 'Educational Kit';
  return 'Book';
}

function normalizeLanguage(val: string): 'English' | 'Dhivehi' | 'Arabic' | 'Other' {
  const v = val.toLowerCase().trim();
  if (v.includes('dhiv') || v === 'dv' || v === 'div') return 'Dhivehi';
  if (v.includes('arab') || v === 'ar') return 'Arabic';
  if (!v || v.includes('eng') || v === 'en') return 'English';
  return 'Other';
}

function normalizeReadingStatus(val: string): ReadingProgressStatus {
  const v = val.toLowerCase().trim();
  if (v.includes('comp') || v.includes('finish') || v.includes('read') && !v.includes('want') && !v.includes('to read') && !v.includes('current')) {
    return 'Completed';
  }
  if (v.includes('prog') || v.includes('current') || v.includes('reading')) return 'In Progress';
  if (v.includes('loan') || v.includes('lent')) return 'Loaned to Friend';
  return 'To Read';
}

export function mapCsvRowsToPersonalItems(
  rows: string[][],
  mapping: PersonalImportField[],
  ownerId: string
): PersonalItem[] {
  const today = new Date().toISOString().split('T')[0];

  return rows
    .map((cols, idx): PersonalItem | null => {
      const rec: Record<string, string> = {};
      mapping.forEach((field, colIdx) => {
        if (field !== 'ignore' && cols[colIdx] !== undefined && cols[colIdx] !== '') {
          rec[field] = cols[colIdx];
        }
      });

      const title = rec.title?.trim();
      if (!title) return null;

      const status = rec.readingStatus ? normalizeReadingStatus(rec.readingStatus) : 'To Read';
      const pageCount = rec.pageCount ? parseInt(rec.pageCount, 10) : undefined;
      const currentPage = rec.currentPage
        ? parseInt(rec.currentPage, 10)
        : status === 'Completed'
        ? pageCount || 100
        : 0;

      return {
        id: `pers-csv-${Date.now()}-${idx}`,
        ownerId,
        title,
        author: rec.author || 'Unknown Author',
        isbn: rec.isbn || '',
        upc: rec.upc || '',
        mediaType: rec.mediaType ? normalizeMediaType(rec.mediaType) : 'Book',
        language: rec.language ? normalizeLanguage(rec.language) : 'English',
        coverUrl: '/covers/classic_literature.jpg',
        publisher: rec.publisher || '',
        publicationYear: rec.publicationYear ? parseInt(rec.publicationYear, 10) || 2024 : 2024,
        pageCount: pageCount && !Number.isNaN(pageCount) ? pageCount : undefined,
        currentPage: !Number.isNaN(currentPage) ? currentPage : 0,
        ddcCallNumber: rec.ddcCallNumber || 'DDC 800',
        shelfGroup: rec.shelfGroup || 'Home Bookshelf',
        tags: rec.tags
          ? rec.tags.split(/[;|]/).map((t) => t.trim()).filter(Boolean)
          : ['CSV Import'],
        rating: rec.rating ? Math.min(5, Math.max(0, Number(rec.rating) || 0)) : 0,
        readingStatus: status,
        completionDate: status === 'Completed' ? today : undefined,
        loanedTo: rec.loanedTo || undefined,
        reminderDate: rec.reminderDate || undefined,
        reviewText: rec.reviewText || undefined,
        privateNotes: rec.privateNotes || undefined,
        addedAt: today,
      };
    })
    .filter((item): item is PersonalItem => item !== null);
}

export function exportCatalogToJson(items: Array<Book | PersonalItem>, filenamePrefix = 'magoodhoo_library_export') {
  const payload = {
    exportedAt: new Date().toISOString(),
    system: 'Magoodhoo School Library ILS',
    totalRecords: items.length,
    records: items
  };
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.json`,
    'application/json;charset=utf-8;'
  );
}

export function exportCatalogToCsv(items: Array<Book | PersonalItem>, filenamePrefix = 'magoodhoo_library_export') {
  const headers = [
    'ID',
    'Title',
    'Author',
    'ISBN/UPC',
    'Media Type',
    'DDC Call Number',
    'Language',
    'Publisher',
    'Year',
    'Tags/Category',
    'Location/Shelf',
    'Status',
    'Page Count',
    'Current Page',
    'Rating',
    'Loaned To',
    'Reminder Date',
    'Review / Notes'
  ];

  const rows = items.map((item) => {
    const isBook = 'totalCopies' in item;
    const pers = item as PersonalItem;
    return [
      item.id,
      item.title,
      item.author,
      ('isbn' in item && item.isbn) || ('upc' in item && pers.upc) || '',
      item.mediaType || 'Book',
      item.ddcCallNumber || '',
      isBook ? (item as Book).bookLanguage || 'English' : pers.language || 'English',
      item.publisher || '',
      item.publicationYear || '',
      isBook ? (item as Book).category : (pers.tags || []).join('; '),
      isBook ? (item as Book).shelfLocation : pers.shelfGroup,
      isBook
        ? ((item as Book).isReferenceOnly ? 'Reference Only' : `${(item as Book).availableCopies}/${(item as Book).totalCopies} Available`)
        : pers.readingStatus,
      item.pageCount || '',
      !isBook ? pers.currentPage ?? '' : '',
      !isBook ? pers.rating ?? '' : '',
      !isBook ? pers.loanedTo || '' : '',
      !isBook ? pers.reminderDate || '' : '',
      !isBook ? pers.reviewText || pers.privateNotes || '' : item.description || ''
    ]
      .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
      .join(',');
  });

  triggerDownload(
    '\uFEFF' + [headers.join(','), ...rows].join('\n'),
    `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.csv`,
    'text/csv;charset=utf-8;'
  );
}

/**
 * Generates standard MARCEdit (.mrk) tagged MARC21 bibliographic records for interoperability with Koha & Follett Destiny.
 */
export function exportToMarc21(items: Array<Book | PersonalItem>, filenamePrefix = 'magoodhoo_marc21') {
  const marcBlocks = items.map((item) => {
    const isBook = 'totalCopies' in item;
    const pers = item as PersonalItem;
    const isbn = ('isbn' in item && item.isbn) || ('upc' in item && pers.upc) || 'N/A';
    const ddc = (item.ddcCallNumber || '800').replace(/^DDC\s*/i, '');
    const langCode =
      (isBook ? (item as Book).bookLanguage : pers.language) === 'Dhivehi'
        ? 'div'
        : (isBook ? (item as Book).bookLanguage : pers.language) === 'Arabic'
        ? 'ara'
        : 'eng';
    const shelf = isBook ? (item as Book).shelfLocation : pers.shelfGroup;
    const barcode = isBook ? (item as Book).barcode : isbn;

    return [
      `=LDR  00000nam a2200000Ia 4500`,
      `=001  ${item.id}`,
      `=008  260101s${item.publicationYear || 2025}    mv            000 0 ${langCode} d`,
      `=020  \\\\$a${isbn}`,
      `=082  04$a${ddc}`,
      `=100  1\\$a${item.author || 'Unknown Author'}`,
      `=245  10$a${item.title || 'Untitled'}$c${item.author || ''}`,
      `=264  \\1$b${item.publisher || 'School Press'}$c${item.publicationYear || ''}`,
      item.pageCount ? `=300  \\\\$a${item.pageCount} pages` : '',
      item.description ? `=520  \\\\$a${item.description.replace(/\r?\n/g, ' ')}` : '',
      `=852  \\\\$bMAGOODHOO$c${shelf || 'Main Hall'}$p${barcode}`,
      ''
    ]
      .filter(Boolean)
      .join('\n');
  });

  triggerDownload(
    marcBlocks.join('\n'),
    `${filenamePrefix}_${new Date().toISOString().split('T')[0]}.mrk`,
    'text/plain;charset=utf-8;'
  );
}

/**
 * Parses imported JSON, CSV, or MARC21 (.mrk) files back into PersonalItem drafts.
 */
export function parseImportedPersonalData(rawText: string, ownerId: string): PersonalItem[] {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  const today = new Date().toISOString().split('T')[0];

  // 1. JSON format
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    const list = Array.isArray(parsed) ? parsed : (parsed.records || []);
    return list.map((r: any, idx: number) => ({
      id: r.id || `pers-imp-${Date.now()}-${idx}`,
      ownerId,
      title: r.title || 'Imported Item',
      author: r.author || 'Unknown Author',
      isbn: r.isbn || '',
      upc: r.upc || '',
      mediaType: r.mediaType || 'Book',
      language: r.language || r.bookLanguage || 'English',
      coverUrl: r.coverUrl || '/covers/classic_literature.jpg',
      publisher: r.publisher || '',
      publicationYear: Number(r.publicationYear) || 2024,
      pageCount: r.pageCount ? Number(r.pageCount) : undefined,
      currentPage: r.currentPage ? Number(r.currentPage) : 0,
      ddcCallNumber: r.ddcCallNumber || 'DDC 800',
      description: r.description || '',
      shelfGroup: r.shelfGroup || r.shelfLocation || 'Home Bookshelf',
      tags: Array.isArray(r.tags) ? r.tags : ['Imported'],
      rating: Number(r.rating) || 0,
      readingStatus: r.readingStatus || 'To Read',
      reminderDate: r.reminderDate || undefined,
      reviewText: r.reviewText || undefined,
      privateNotes: r.privateNotes || '',
      addedAt: r.addedAt || today
    }));
  }

  // 2. MARC21 .mrk format
  if (trimmed.includes('=LDR') || trimmed.includes('=245')) {
    const blocks = trimmed.split(/\r?\n\s*\r?\n/);
    return blocks
      .filter((b) => b.includes('=245'))
      .map((block, idx) => {
        const getField = (tag: string, sub = 'a') => {
          const line = block.split(/\r?\n/).find((l) => l.startsWith(`=${tag}`));
          if (!line) return '';
          const match = line.match(new RegExp(`\\$${sub}([^$]+)`));
          return match ? match[1].trim() : line.slice(6).trim();
        };
        return {
          id: `pers-marc-${Date.now()}-${idx}`,
          ownerId,
          title: getField('245', 'a') || 'MARC Imported Title',
          author: getField('100', 'a') || 'Unknown Author',
          isbn: getField('020', 'a') || '',
          mediaType: 'Book',
          language: block.includes(' div ') ? 'Dhivehi' : 'English',
          coverUrl: '/covers/classic_literature.jpg',
          publisher: getField('264', 'b') || '',
          publicationYear: parseInt(getField('264', 'c'), 10) || 2024,
          ddcCallNumber: `DDC ${getField('082', 'a') || '800'}`,
          description: getField('520', 'a') || '',
          shelfGroup: getField('852', 'c') || 'MARC Import',
          tags: ['MARC21'],
          rating: 0,
          readingStatus: 'To Read',
          addedAt: today
        };
      });
  }

  // 3. CSV auto-mapped fallback
  const preview = parseCsvPreview(trimmed);
  if (preview.rows.length === 0) return [];
  const mapping = suggestCsvMapping(preview.headers);
  return mapCsvRowsToPersonalItems(preview.rows, mapping, ownerId);
}
