import { safeAiJsonFetch } from './client';
import {
  OpacSearchResponse,
  CurriculumMatchResult,
  validateOpacSearchResponse,
  validateCurriculumMatchResult,
} from './schemas';

export type { OpacSearchResponse, CurriculumMatchResult };

export interface CatalogBookContext {
  title: string;
  author: string;
  category?: string;
  shelfLocation?: string;
  availableCopies?: number;
}

export interface QuizData {
  summary: string;
  questions: Array<{
    question: string;
    options: string[];
    answerIndex: number;
    explanation: string;
  }>;
  discussionPrompts: string[];
}

export async function askAiLibrarian(params: {
  message: string;
  catalogContext: CatalogBookContext[];
  userGrade?: string;
  language?: 'en' | 'dv';
}): Promise<string> {
  const { message, catalogContext, userGrade, language = 'en' } = params;
  const isDhivehi = language === 'dv';

  const serverData = await safeAiJsonFetch<{ text?: string }>(
    '/api/ai/ask-librarian',
    { message, catalogContext, userGrade, language },
    { method: 'POST', retries: 2 }
  );

  if (serverData && serverData.text) {
    return serverData.text;
  }

  return generateLocalCatalogResponse(message, catalogContext, isDhivehi);
}

export function runLocalOpacQueryEngine(params: {
  query: string;
  books: any[];
  loans: any[];
  language?: 'en' | 'dv';
}): OpacSearchResponse {
  const { query, books, loans, language = 'en' } = params;
  const q = query.trim();
  const lower = q.toLowerCase();
  const isDhivehi = language === 'dv' || /[\u0780-\u07BF]/.test(q);
  const today = new Date().toISOString().split('T')[0];

  const isCirculationAnalytics =
    lower.includes('lowest circulation') ||
    lower.includes('highest circulation') ||
    lower.includes('circulation this term') ||
    lower.includes('subject categories') ||
    lower.includes('ދައުރުވުން');

  const isOverdueQuery =
    lower.includes('overdue') ||
    lower.includes('exceeding') ||
    lower.includes('late') ||
    lower.includes('މުއްދަތު ހަމަ') ||
    lower.includes('ޖޫރިމަނާ');

  const wantsAvailable =
    lower.includes('available') ||
    lower.includes('on the shelf') ||
    lower.includes('right now') ||
    lower.includes('ލިބެން');

  const wantsDhivehi = lower.includes('dhivehi') || lower.includes('ދިވެހި');

  const gradeMatch = q.match(/(?:grade|ގްރޭޑް)\s*(\d{1,2}|lkg|ukg)/i);
  const extractedGrade = gradeMatch
    ? gradeMatch[1].toUpperCase() === 'LKG' || gradeMatch[1].toUpperCase() === 'UKG'
      ? gradeMatch[1].toUpperCase()
      : `Grade ${gradeMatch[1]}`
    : undefined;

  const daysMatch = q.match(/(?:exceeding|over|more than|>|ގިނަ)\s*(\d+)\s*(?:day|days|ދުވަސް)?/i);
  const minOverdueDays = daysMatch ? parseInt(daysMatch[1], 10) : undefined;

  let categoryFilter: string | undefined;
  if (lower.includes('science') || lower.includes('ސައިންސް')) categoryFilter = 'Science';
  else if (
    lower.includes('adventure') ||
    lower.includes('story') ||
    lower.includes('stories') ||
    lower.includes('fiction') ||
    lower.includes('ވާހަކަ')
  ) {
    categoryFilter = 'Fiction';
  } else if (lower.includes('islam') || lower.includes('އިސްލާމް')) categoryFilter = 'Islamic';
  else if (lower.includes('marine') || lower.includes('coral') || lower.includes('reef')) categoryFilter = 'Marine';

  if (isCirculationAnalytics) {
    const countsByCat: Record<string, number> = {};
    books.forEach((b) => {
      const cat = b.category || 'General';
      if (!(cat in countsByCat)) countsByCat[cat] = 0;
    });
    loans.forEach((l) => {
      const bk = books.find((b) => b.id === l.bookId);
      const cat = bk?.category || 'General';
      countsByCat[cat] = (countsByCat[cat] || 0) + 1;
    });
    const sorted = Object.entries(countsByCat)
      .map(([label, count]) => ({ label, count, note: `${count} loan(s)` }))
      .sort((a, b) => a.count - b.count);

    return {
      intent: 'circulation_analytics',
      answer: isDhivehi
        ? `މި ޓާމުގައި އެންމެ މަދުން ދައުރުވެފައިވާ މާއްދާތަކަކީ: ${sorted.slice(0, 3).map((s) => s.label).join(', ')}.`
        : `Lowest circulating subject categories this term: ${sorted.slice(0, 3).map((s) => s.label).join(', ')}.`,
      filterPredicates: { availableOnly: false, category: sorted[0]?.label },
      matchedBookIds: [],
      matchedLoanIds: [],
      analyticsBreakdown: sorted.slice(0, 6),
    };
  }

  if (isOverdueQuery) {
    const matchingLoans = loans.filter((l) => {
      if (l.status === 'returned') return false;
      const isLate = l.status === 'overdue' || (l.dueDate && l.dueDate < today);
      if (!isLate) return false;
      if (extractedGrade && l.userGrade && !String(l.userGrade).toLowerCase().includes(extractedGrade.toLowerCase())) {
        return false;
      }
      if (minOverdueDays !== undefined && l.dueDate) {
        const diffDays = Math.max(0, Math.floor((new Date(today).getTime() - new Date(l.dueDate).getTime()) / 86400000));
        if (diffDays < minOverdueDays) return false;
      }
      return true;
    });

    return {
      intent: 'overdue_audit',
      answer: isDhivehi
        ? `މުއްދަތު ހަމަވެފައިވާ ${matchingLoans.length} ލޯން ރެކޯޑް ފެނިއްޖެއެވެ.`
        : `Found ${matchingLoans.length} active overdue loan(s)${extractedGrade ? ` for ${extractedGrade}` : ''}${minOverdueDays ? ` exceeding ${minOverdueDays} days` : ''}.`,
      filterPredicates: { borrowerGrade: extractedGrade, minOverdueDays },
      matchedBookIds: [],
      matchedLoanIds: matchingLoans.slice(0, 8).map((l) => l.id),
      analyticsBreakdown: [],
    };
  }

  const stopWords = new Set([
    'show', 'all', 'books', 'book', 'for', 'that', 'are', 'the', 'on', 'shelf',
    'right', 'now', 'currently', 'available', 'with', 'find', 'good', 'stories',
    'ފޮތްތައް', 'ދައްކާ', 'ހުރި', 'ރަނގަޅު', 'ކިޔާލަން',
  ]);
  const queryTerms = lower
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !/^(grade|ގްރޭޑް|\d+)$/.test(w));

  const matchedBooks = books
    .filter((b) => {
      if (wantsAvailable && (b.availableCopies <= 0 || b.isReferenceOnly)) return false;
      if (wantsDhivehi && b.bookLanguage !== 'Dhivehi' && !/[\u0780-\u07BF]/.test(`${b.title}${b.titleDv || ''}`)) {
        return false;
      }
      if (extractedGrade && b.targetGrade && b.targetGrade !== 'All Ages') {
        const gNum = extractedGrade.match(/\d+/)?.[0];
        const tg = String(b.targetGrade).toLowerCase();
        const gradeNumMatch = gNum
          ? tg.includes(gNum) ||
            (Number(gNum) <= 5 && tg.includes('primary')) ||
            (Number(gNum) >= 6 && Number(gNum) <= 8 && tg.includes('middle')) ||
            (Number(gNum) >= 9 && tg.includes('secondary'))
          : tg.includes(extractedGrade.toLowerCase());
        if (!gradeNumMatch) return false;
      }
      if (categoryFilter) {
        const hayCat = `${b.category} ${b.description || ''} ${(b.tags || []).join(' ')}`.toLowerCase();
        if (!hayCat.includes(categoryFilter.toLowerCase())) return false;
      }
      if (queryTerms.length === 0) return true;
      const hay = `${b.title} ${b.titleEn || ''} ${b.titleDv || ''} ${b.author} ${b.category} ${b.targetGrade} ${b.description || ''} ${(b.tags || []).join(' ')}`.toLowerCase();
      return queryTerms.some((t) => hay.includes(t));
    })
    .slice(0, 8)
    .map((b) => b.id);

  return {
    intent: 'catalog_search',
    answer: isDhivehi
      ? `ތިޔަ ހޯއްދެވި ޝަރުޠުތަކާ ގުޅޭ ${matchedBooks.length} ފޮތް ކެޓަލޮގުން ފެނިއްޖެއެވެ.`
      : `Found ${matchedBooks.length} catalog book(s) matching "${q}".`,
    filterPredicates: {
      language: wantsDhivehi ? 'Dhivehi' : undefined,
      category: categoryFilter,
      gradeLevel: extractedGrade,
      availableOnly: wantsAvailable,
    },
    matchedBookIds: matchedBooks,
    matchedLoanIds: [],
    analyticsBreakdown: [],
  };
}

export async function opacNaturalSearch(params: {
  query: string;
  books: any[];
  loans: any[];
  language?: 'en' | 'dv';
}): Promise<OpacSearchResponse> {
  const serverRes = await safeAiJsonFetch<OpacSearchResponse>('/api/ai/opac-search', params, {
    method: 'POST',
    retries: 2,
    validator: validateOpacSearchResponse,
  });

  if (serverRes) return serverRes;
  return runLocalOpacQueryEngine(params);
}

export async function matchLessonPlan(params: {
  grade: string;
  syllabusTopic: string;
  learningObjective?: string;
  availableOnly?: boolean;
  borrowedTitles?: string[];
  books: any[];
  language?: 'en' | 'dv';
}): Promise<CurriculumMatchResult> {
  const serverRes = await safeAiJsonFetch<CurriculumMatchResult>('/api/ai/curriculum-match', params, {
    method: 'POST',
    retries: 2,
    validator: validateCurriculumMatchResult,
  });
  if (serverRes) return serverRes;

  const topicText = (params.learningObjective || params.syllabusTopic || 'General Enrichment').trim();
  const isDv = params.language === 'dv';
  const terms = topicText.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const pool = (params.books || []).filter((b) => !params.availableOnly || b.availableCopies > 0);
  const ranked = pool
    .map((b) => {
      const hay = `${b.title} ${b.category} ${b.description || ''} ${(b.tags || []).join(' ')}`.toLowerCase();
      let score = b.availableCopies > 0 ? 1 : 0;
      terms.forEach((t) => {
        if (hay.includes(t)) score += 3;
      });
      return { b, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ b }) => ({
      bookId: b.id,
      title: b.title,
      author: b.author,
      mediaType: b.mediaType || 'Book',
      ddcCallNumber: b.ddcCallNumber || 'DDC 800',
      shelfLocation: b.shelfLocation || 'General Stacks',
      availableCopies: b.availableCopies ?? 0,
      relevanceReason: isDv
        ? `${params.grade} ގެ "${topicText}" ފިލާވަޅަށް މި ފޮތުގައިވާ ${b.category} މަޢުލޫމާތު އެހީތެރިވެދޭނެއެވެ.`
        : `Supports ${params.grade} lesson objectives on "${topicText}" with ${b.category} reference material.`,
    }));

  const summary = isDv
    ? `${params.grade} ގެ "${topicText}" ފިލާވަޅާ ގުޅޭ ${ranked.length} ވަޞީލަތް ކެޓަލޮގުން ހޮވާލެވިއްޖެއެވެ.`
    : `Ranked ${ranked.length} resource(s) supporting "${topicText}" for ${params.grade}.`;

  return {
    summary,
    matches: ranked,
    text: `${summary}\n\n${ranked.map((m) => `- **${m.title}** (${m.ddcCallNumber}) — ${m.shelfLocation}: ${m.relevanceReason}`).join('\n')}`,
  };
}

export async function matchCurriculumBooks(params: {
  grade: string;
  syllabusTopic: string;
  borrowedTitles?: string[];
  books: any[];
  language?: 'en' | 'dv';
}): Promise<string> {
  const res = await matchLessonPlan(params);
  return res.text || res.summary;
}

export async function generateAiQuiz(params: {
  bookTitle: string;
  author: string;
  language?: 'en' | 'dv';
}): Promise<QuizData> {
  const { bookTitle, author, language = 'en' } = params;
  const isDhivehi = language === 'dv';

  const serverData = await safeAiJsonFetch<QuizData>(
    '/api/ai/quiz-generator',
    { bookTitle, author, language },
    { method: 'POST', retries: 2 }
  );
  if (serverData && serverData.questions) {
    return serverData;
  }

  if (isDhivehi) {
    return {
      summary: `މިއީ "${author}" ލިޔުއްވާފައިވާ "${bookTitle}" ފޮތާ ބެހޭ ކިޔުމުގެ ފަހުމް ވަޒަންކުރާ ކުއިޒެކެވެ.`,
      questions: [
        {
          question: `"${bookTitle}" މި ފޮތުގެ މައިގަނޑު މައުޟޫޢަކީ ކޮބައިހެއްޔެވެ؟`,
          options: ['ތަޢުލީމާއި ޢިލްމު', 'އާދަކާދަ', 'ވާހަކަ އާއި ސާހިތްޔު', 'ތާރީޚް'],
          answerIndex: 0,
          explanation: 'ފޮތުގެ މައިގަނޑު އަސާސަކީ އިލްމާއި ތައުލީމެވެ.',
        },
        {
          question: `މި ފޮތް ލިޔުއްވާފައިވަނީ ކޮން މުޞަންނިފެއް ހެއްޔެވެ؟`,
          options: [author, 'ޢަބްދުﷲ ޞާދިޤު', 'މުޙައްމަދު ޖަމީލު', 'ޙުސައިން ޞަލާޙުއްދީން'],
          answerIndex: 0,
          explanation: `މި ފޮތުގެ މުޞަންނިފަކީ ${author} އެވެ.`,
        },
        {
          question: 'މި ފޮތުން ދަރިވަރުންނަށް ލިބޭ އެންމެ ބޮޑު ޢިބުރަތަކީ ކޮބައިހެއްޔެވެ؟',
          options: ['މުތާލިއާކުރުމާއި އުނގެނުމުގެ މުހިންމުކަން', 'ވަގުތު ބޭކާރުކުރުން', 'ކަންނެތްކަން', 'އަވަސްއަރުވާލުން'],
          answerIndex: 0,
          explanation: 'ފޮތް ކިޔުމުން އުނގެނުމާއި މުތާލިއާ ކުރުމުގެ އަހައްމިއްޔަތު އެނގިގެންދެއެވެ.',
        },
      ],
      discussionPrompts: [
        `މި ފޮތުން ތިޔަ ދަރިވަރަށް އެންމެ ކަމުދިޔަ ބަޔަކީ ކޮބައިހެއްޔެވެ؟`,
        `މި ފޮތް އެހެން ދަރިވަރަކަށް ކިޔަން އިރުޝާދު ދޭނީ ކީއްވެގެންހެއްޔެވެ؟`,
      ],
    };
  }

  return {
    summary: `Reading comprehension test for "${bookTitle}" by ${author}.`,
    questions: [
      {
        question: `What is the primary subject of "${bookTitle}"?`,
        options: ['Learning & Knowledge', 'Historical Events', 'Fiction & Mystery', 'Science Exploration'],
        answerIndex: 0,
        explanation: 'The main core focus of the book is educational learning and discovery.',
      },
      {
        question: `Who wrote the book "${bookTitle}"?`,
        options: [author, 'Unknown Author', 'School Library Press', 'Classic Literature Group'],
        answerIndex: 0,
        explanation: `The author of this work is ${author}.`,
      },
      {
        question: 'What key lesson can students take away from reading this book?',
        options: ['The value of reading and curiosity', 'Skipping study time', 'Memorization only', 'Ignoring library resources'],
        answerIndex: 0,
        explanation: 'Reading encourages curiosity, critical thinking, and lifelong learning.',
      },
    ],
    discussionPrompts: [
      `What was the most surprising or interesting idea you learned from "${bookTitle}"?`,
      `How would you recommend this book to a classmate at Magoodhoo School?`,
    ],
  };
}

function generateLocalCatalogResponse(
  message: string,
  catalog: CatalogBookContext[],
  isDhivehi: boolean
): string {
  const query = message.toLowerCase();
  const matchingBooks = (catalog || []).filter(
    (b) =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      (b.category && b.category.toLowerCase().includes(query)) ||
      (b.shelfLocation && b.shelfLocation.toLowerCase().includes(query))
  );

  if (isDhivehi) {
    if (matchingBooks.length > 0) {
      const bookList = matchingBooks
        .slice(0, 3)
        .map((b) => `- **${b.title}** (${b.author}) — ${b.shelfLocation || 'Main Hall'}`)
        .join('\n');
      return `**މަގޫދޫ ސްކޫލް ލައިބްރަރީ ކެޓަލޮގުން ފެނުނު ފޮތްތައް:**\n\n${bookList}`;
    }
    const sampleList = (catalog || [])
      .slice(0, 3)
      .map((b) => `- **${b.title}** (${b.author})`)
      .join('\n');
    return `މަރުޙަބާ! އަޅުގަނޑަކީ **ލިބީ** (މަގޫދޫ ސްކޫލް ލައިބްރޭރިއަން).\n\n${sampleList}`;
  }

  if (matchingBooks.length > 0) {
    const bookList = matchingBooks
      .slice(0, 3)
      .map((b) => `- **${b.title}** by ${b.author} (Shelf: ${b.shelfLocation || 'Main Hall'})`)
      .join('\n');
    return `**Matching Catalog Titles:**\n\n${bookList}`;
  }

  const sampleList = (catalog || [])
    .slice(0, 3)
    .map((b) => `- **${b.title}** by ${b.author}`)
    .join('\n');
  return `Hello! I'm **Libby**, your Magoodhoo School Library Assistant.\n\nPopular catalog selections:\n\n${sampleList}`;
}
