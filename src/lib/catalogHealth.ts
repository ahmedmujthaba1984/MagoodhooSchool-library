import { Book } from '../types';

export type CatalogHealthIssueType =
  | 'missing_ddc'
  | 'missing_synopsis'
  | 'missing_cover'
  | 'missing_grade_lang'
  | 'author_formatting'
  | 'duplicate_candidate';

export interface CatalogHealthProposal {
  id: string;
  bookId: string;
  bookTitle: string;
  author: string;
  coverUrl?: string;
  issueType: CatalogHealthIssueType;
  severity: 'high' | 'medium' | 'low';
  label: string;
  field: 'ddcCallNumber' | 'description' | 'author' | 'targetGrade' | 'bookLanguage' | 'coverUrl' | 'duplicate';
  currentValue: string;
  proposedValue: string;
  rationale: string;
  autoFixable: boolean;
  selectedByDefault: boolean;
  extraPatch?: Partial<Book>;
  duplicateOfId?: string;
  duplicateOfTitle?: string;
}

export interface CatalogHealthBreakdown {
  classificationPct: number;
  metadataPct: number;
  audienceLangPct: number;
  authorAndUniquenessPct: number;
}

export interface CatalogHealthReport {
  healthScore: number;
  totalTitles: number;
  healthyTitles: number;
  breakdown: CatalogHealthBreakdown;
  proposals: CatalogHealthProposal[];
  countsByType: Record<CatalogHealthIssueType, number>;
}

const THAANA_REGEX = /[\u0780-\u07B1]/;
const ARABIC_REGEX = /[\u0600-\u06FF]/;

const GENERIC_COVER_MISSING_VALUES = new Set(['', 'none', 'null', 'undefined', 'n/a']);

export function normalizeAuthorName(raw: string): string {
  const trimmed = (raw || '').replace(/\s+/g, ' ').trim();
  if (!trimmed) return 'Unknown Author';

  // Preserve Thaana or Arabic script author names untouched except whitespace collapse
  if (THAANA_REGEX.test(trimmed) || ARABIC_REGEX.test(trimmed)) {
    return trimmed;
  }

  // Handle "LASTNAME, FIRSTNAME" format cleanly when single author
  let normalized = trimmed;
  const commaParts = normalized.split(',').map((p) => p.trim()).filter(Boolean);
  if (
    commaParts.length === 2 &&
    !commaParts[1].includes(' ') &&
    commaParts[0].split(' ').length === 1 &&
    !/\b(jr|sr|iii|ii|phd|ed)\b/i.test(commaParts[1])
  ) {
    normalized = `${commaParts[1]} ${commaParts[0]}`;
  }

  const HONORIFICS: Record<string, string> = {
    'dr.': 'Dr.',
    'dr': 'Dr.',
    'prof.': 'Prof.',
    'prof': 'Prof.',
    'mr.': 'Mr.',
    'mrs.': 'Mrs.',
    'ms.': 'Ms.',
    'ustaz': 'Ustaz',
    'al-ustaz': 'Al-Ustaz',
    'sheikh': 'Sheikh',
  };

  const MINOR_WORDS = new Set(['and', 'of', 'the', 'al', 'bin', 'binti', 'ibn', 'de', 'van', 'von']);

  return normalized
    .split(' ')
    .map((word, idx) => {
      if (!word) return '';
      const lower = word.toLowerCase();
      if (HONORIFICS[lower]) return HONORIFICS[lower];
      if (idx > 0 && MINOR_WORDS.has(lower)) return lower;

      // Handle hyphenated or initialed tokens like "J.K." or "A.R."
      if (/^([a-z]\.){1,4}$/i.test(word)) {
        return word.toUpperCase();
      }
      if (/^[a-z]\.?$/i.test(word) && word.length <= 2) {
        return word.endsWith('.') ? word.toUpperCase() : `${word.toUpperCase()}.`;
      }

      return word
        .split('-')
        .map((seg) => (seg ? seg.charAt(0).toUpperCase() + seg.slice(1).toLowerCase() : ''))
        .join('-');
    })
    .filter(Boolean)
    .join(' ');
}

export function inferDdcAndShelf(book: Book): { ddcCallNumber: string; shelfLocation?: string; rationale: string } {
  const hay = `${book.title} ${book.category} ${book.description || ''} ${(book.tags || []).join(' ')}`.toLowerCase();
  const isDv = book.bookLanguage === 'Dhivehi' || THAANA_REGEX.test(book.title);

  if (isDv || hay.includes('dhivehi') || hay.includes('thaana') || hay.includes('adhab')) {
    return {
      ddcCallNumber: 'DDC 891.49',
      shelfLocation: book.shelfLocation || 'Dhivehi Wing · A1',
      rationale: 'Maldivian / Dhivehi language & literature classification (DDC 891.49)',
    };
  }
  if (hay.includes('islam') || hay.includes('quran') || hay.includes('fiqh') || hay.includes('seerah') || book.bookLanguage === 'Arabic') {
    return {
      ddcCallNumber: 'DDC 297',
      shelfLocation: book.shelfLocation || 'Islamic Studies · B2',
      rationale: 'Islamic Studies & Religious Education (DDC 297)',
    };
  }
  if (hay.includes('coral') || hay.includes('reef') || hay.includes('marine') || hay.includes('ocean') || hay.includes('atoll')) {
    return {
      ddcCallNumber: 'DDC 577.789',
      shelfLocation: book.shelfLocation || 'Science & Marine · C1',
      rationale: 'Marine Biology & Coral Reef Ecology (DDC 577.789)',
    };
  }
  if (hay.includes('computer') || hay.includes('coding') || hay.includes('python') || hay.includes('robot') || hay.includes('ict')) {
    return {
      ddcCallNumber: 'DDC 004',
      shelfLocation: book.shelfLocation || 'STEM & ICT · C4',
      rationale: 'Computer Science & Information Technology (DDC 004)',
    };
  }
  if (hay.includes('math') || hay.includes('algebra') || hay.includes('geometry') || hay.includes('calculus')) {
    return {
      ddcCallNumber: 'DDC 510',
      shelfLocation: book.shelfLocation || 'STEM & Math · C3',
      rationale: 'Mathematics & Problem Solving (DDC 510)',
    };
  }
  if (hay.includes('science') || hay.includes('biology') || hay.includes('physics') || hay.includes('chemistry') || hay.includes('astronomy') || hay.includes('stem')) {
    return {
      ddcCallNumber: 'DDC 500',
      shelfLocation: book.shelfLocation || 'Science Wing · C2',
      rationale: 'Natural Sciences & STEM Reference (DDC 500)',
    };
  }
  if (hay.includes('maldives') || hay.includes('history') || hay.includes('geography') || hay.includes('social')) {
    return {
      ddcCallNumber: hay.includes('maldives') ? 'DDC 954.95' : 'DDC 900',
      shelfLocation: book.shelfLocation || 'History & Geography · D1',
      rationale: hay.includes('maldives') ? 'Maldivian History & Culture (DDC 954.95)' : 'World History & Geography (DDC 900)',
    };
  }
  if (hay.includes('dictionary') || hay.includes('encyclopedia') || hay.includes('atlas') || book.isReferenceOnly) {
    return {
      ddcCallNumber: 'DDC 030',
      shelfLocation: book.shelfLocation || 'Reference Hall · R1',
      rationale: 'General Reference & Encyclopedias (DDC 030)',
    };
  }
  return {
    ddcCallNumber: 'DDC 823',
    shelfLocation: book.shelfLocation || 'English Fiction · E2',
    rationale: 'English Juvenile & School Fiction (DDC 823)',
  };
}

export function inferBookLanguage(book: Book): 'English' | 'Dhivehi' | 'Arabic' | 'Other' {
  if (THAANA_REGEX.test(book.title) || THAANA_REGEX.test(book.description || '')) return 'Dhivehi';
  if (ARABIC_REGEX.test(book.title) || /quran|arabic/i.test(`${book.category} ${book.title}`)) return 'Arabic';
  if (/dhivehi|thaana/i.test(`${book.category} ${book.title}`)) return 'Dhivehi';
  return 'English';
}

export function inferTargetGrade(book: Book): string {
  const hay = `${book.title} ${book.category} ${book.description || ''}`;
  const gradeMatch = hay.match(/\bgrade\s*(\d{1,2})\b/i);
  if (gradeMatch) {
    const g = Math.min(10, Math.max(1, parseInt(gradeMatch[1], 10)));
    return `Grade ${g}`;
  }
  if (/\b(lkg|kindergarten)\b/i.test(hay)) return 'LKG';
  if (/\bukg\b/i.test(hay)) return 'UKG';
  if (book.isReferenceOnly) return 'Grades 6-10';
  if (/picture|early reader|phonics|story/i.test(hay)) return 'Grades 1-3';
  if (/secondary|igcse|o-?level|physics|chemistry/i.test(hay)) return 'Grades 8-10';
  return 'Grades 4-7';
}

export function generateDraftSynopsis(book: Book): string {
  const lang = book.bookLanguage || inferBookLanguage(book);
  const grade = book.targetGrade || inferTargetGrade(book);
  if (lang === 'Dhivehi') {
    return `"${book.title}" އަކީ ${book.author} ލިޔުއްވާފައިވާ ${book.category || 'ތަޢުލީމީ'} ދާއިރާގެ ފޮތެކެވެ. މިއީ ${grade} ގެ ދަރިވަރުންގެ ކިޔުމުގެ ހުނަރާއި މަޢުލޫމާތު މުއްސަނދިކުރުމަށް އެކުލަވާލެވިފައިވާ ފޮތެކެވެ.`;
  }
  return `"${book.title}" by ${book.author} is a curated ${book.category || 'School Library'} resource suited for ${grade}. Recommended for curriculum enrichment and independent reading at Magoodhoo School Library.`;
}

function normalizeIsbnForDup(raw?: string): string {
  const cleaned = (raw || '').replace(/[^0-9Xx]/g, '').toUpperCase();
  if (cleaned.length < 9) return '';
  return cleaned;
}

function normalizeTitleKey(book: Book): string {
  const title = (book.title || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const authorToken = (book.author || '').toLowerCase().split(/[,\s]+/).filter(Boolean)[0] || '';
  return title ? `${title}::${authorToken}` : '';
}

export function analyzeCatalogHealth(books: Book[]): CatalogHealthReport {
  const totalTitles = books.length;
  const countsByType: Record<CatalogHealthIssueType, number> = {
    missing_ddc: 0,
    missing_synopsis: 0,
    missing_cover: 0,
    missing_grade_lang: 0,
    author_formatting: 0,
    duplicate_candidate: 0,
  };

  if (totalTitles === 0) {
    return {
      healthScore: 100,
      totalTitles: 0,
      healthyTitles: 0,
      breakdown: {
        classificationPct: 100,
        metadataPct: 100,
        audienceLangPct: 100,
        authorAndUniquenessPct: 100,
      },
      proposals: [],
      countsByType,
    };
  }

  const proposals: CatalogHealthProposal[] = [];
  const unhealthyBookIds = new Set<string>();

  // Track duplicates
  const seenIsbn = new Map<string, Book>();
  const seenTitleKey = new Map<string, Book>();

  let ddcGood = 0;
  let metaGood = 0;
  let langGradeGood = 0;
  let authorUniqueGood = 0;

  for (const book of books) {
    let bookHasAuthorOrDupIssue = false;

    // 1. DDC Classification check
    const rawDdc = (book.ddcCallNumber || '').trim();
    const isGenericDdc =
      !rawDdc ||
      rawDdc === 'DDC' ||
      rawDdc === 'N/A' ||
      rawDdc === '000' ||
      rawDdc === 'DDC 000';

    if (isGenericDdc) {
      const ddcSuggestion = inferDdcAndShelf(book);
      countsByType.missing_ddc++;
      unhealthyBookIds.add(book.id);
      proposals.push({
        id: `ddc-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'missing_ddc',
        severity: 'high',
        label: 'Missing DDC Call Number',
        field: 'ddcCallNumber',
        currentValue: rawDdc || 'Unassigned',
        proposedValue: ddcSuggestion.ddcCallNumber,
        rationale: ddcSuggestion.rationale,
        autoFixable: true,
        selectedByDefault: true,
        extraPatch: !book.shelfLocation && ddcSuggestion.shelfLocation
          ? { shelfLocation: ddcSuggestion.shelfLocation }
          : undefined,
      });
    } else {
      ddcGood++;
    }

    // 2. Synopsis & Cover check
    const rawDesc = (book.description || '').trim();
    const hasValidDesc = rawDesc.length >= 25;
    const rawCover = (book.coverUrl || '').trim();
    const hasCover = Boolean(rawCover) && !GENERIC_COVER_MISSING_VALUES.has(rawCover.toLowerCase());

    if (hasValidDesc && hasCover) {
      metaGood += 1;
    } else if (hasValidDesc || hasCover) {
      metaGood += 0.5;
    }

    if (!hasValidDesc) {
      countsByType.missing_synopsis++;
      unhealthyBookIds.add(book.id);
      proposals.push({
        id: `synopsis-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'missing_synopsis',
        severity: 'medium',
        label: 'Missing or Short Synopsis',
        field: 'description',
        currentValue: rawDesc || 'Empty',
        proposedValue: generateDraftSynopsis(book),
        rationale: 'Generates a bilingual-aware 2-sentence catalog synopsis for OPAC discovery.',
        autoFixable: true,
        selectedByDefault: true,
      });
    }

    if (!hasCover) {
      countsByType.missing_cover++;
      unhealthyBookIds.add(book.id);
      const isDv = (book.bookLanguage || inferBookLanguage(book)) === 'Dhivehi';
      const fallbackCover = isDv ? '/covers/dhivehi_story.jpg' : '/covers/classic_literature.jpg';
      proposals.push({
        id: `cover-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'missing_cover',
        severity: 'low',
        label: 'Missing Cover Image',
        field: 'coverUrl',
        currentValue: 'No Cover URL',
        proposedValue: fallbackCover,
        rationale: 'Assigns curated school shelf artwork fallback so OPAC shelves render cleanly.',
        autoFixable: true,
        selectedByDefault: false,
      });
    }

    // 3. Language & Target Grade tagging
    const hasLang = Boolean(book.bookLanguage);
    const hasGrade = Boolean((book.targetGrade || '').trim());
    if (hasLang && hasGrade) {
      langGradeGood += 1;
    } else if (hasLang || hasGrade) {
      langGradeGood += 0.5;
    }

    if (!hasLang) {
      const inferredLang = inferBookLanguage(book);
      countsByType.missing_grade_lang++;
      unhealthyBookIds.add(book.id);
      proposals.push({
        id: `lang-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'missing_grade_lang',
        severity: 'medium',
        label: 'Untagged Book Language',
        field: 'bookLanguage',
        currentValue: 'Unspecified',
        proposedValue: inferredLang,
        rationale: `Detected ${inferredLang} from title script & catalog category.`,
        autoFixable: true,
        selectedByDefault: true,
      });
    }

    if (!hasGrade) {
      const inferredGrade = inferTargetGrade(book);
      countsByType.missing_grade_lang++;
      unhealthyBookIds.add(book.id);
      proposals.push({
        id: `grade-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'missing_grade_lang',
        severity: 'low',
        label: 'Missing Target Grade Level',
        field: 'targetGrade',
        currentValue: 'Unassigned',
        proposedValue: inferredGrade,
        rationale: 'Enables grade-level shelf discovery and age-appropriate OPAC filtering.',
        autoFixable: true,
        selectedByDefault: true,
      });
    }

    // 4. Author formatting consistency
    const normalizedAuthor = normalizeAuthorName(book.author);
    if (normalizedAuthor !== (book.author || '').trim()) {
      bookHasAuthorOrDupIssue = true;
      countsByType.author_formatting++;
      unhealthyBookIds.add(book.id);
      proposals.push({
        id: `author-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'author_formatting',
        severity: 'low',
        label: 'Inconsistent Author Casing / Format',
        field: 'author',
        currentValue: book.author || 'Empty',
        proposedValue: normalizedAuthor,
        rationale: 'Standardizes author authority format across browse shelves and citations.',
        autoFixable: true,
        selectedByDefault: true,
      });
    }

    // 5. Duplicate ISBN / Title collision check
    const normIsbn = normalizeIsbnForDup(book.isbn);
    const titleKey = normalizeTitleKey(book);
    let duplicateMatch: Book | undefined;

    if (normIsbn && seenIsbn.has(normIsbn)) {
      duplicateMatch = seenIsbn.get(normIsbn);
    } else if (titleKey && seenTitleKey.has(titleKey)) {
      duplicateMatch = seenTitleKey.get(titleKey);
    }

    if (duplicateMatch) {
      bookHasAuthorOrDupIssue = true;
      countsByType.duplicate_candidate++;
      unhealthyBookIds.add(book.id);
      proposals.push({
        id: `dup-${book.id}`,
        bookId: book.id,
        bookTitle: book.title,
        author: book.author,
        coverUrl: book.coverUrl,
        issueType: 'duplicate_candidate',
        severity: 'high',
        label: 'Possible Duplicate Title / ISBN',
        field: 'duplicate',
        currentValue: normIsbn ? `ISBN ${normIsbn}` : book.title,
        proposedValue: `Matches "${duplicateMatch.title}" (${duplicateMatch.barcode})`,
        rationale: 'Consider consolidating physical copies under one parent BibliographicTitle.',
        autoFixable: false,
        selectedByDefault: false,
        duplicateOfId: duplicateMatch.id,
        duplicateOfTitle: duplicateMatch.title,
      });
    } else {
      if (normIsbn) seenIsbn.set(normIsbn, book);
      if (titleKey) seenTitleKey.set(titleKey, book);
    }

    if (!bookHasAuthorOrDupIssue) {
      authorUniqueGood++;
    }
  }

  const classificationPct = Math.round((ddcGood / totalTitles) * 100);
  const metadataPct = Math.round((metaGood / totalTitles) * 100);
  const audienceLangPct = Math.round((langGradeGood / totalTitles) * 100);
  const authorAndUniquenessPct = Math.round((authorUniqueGood / totalTitles) * 100);

  const healthScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        classificationPct * 0.3 +
          metadataPct * 0.3 +
          audienceLangPct * 0.2 +
          authorAndUniquenessPct * 0.2
      )
    )
  );

  return {
    healthScore,
    totalTitles,
    healthyTitles: totalTitles - unhealthyBookIds.size,
    breakdown: {
      classificationPct,
      metadataPct,
      audienceLangPct,
      authorAndUniquenessPct,
    },
    proposals,
    countsByType,
  };
}
