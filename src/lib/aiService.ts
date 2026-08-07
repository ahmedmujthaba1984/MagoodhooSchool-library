import { GoogleGenAI } from '@google/genai';

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

export interface BookInfo {
  description?: string;
  category?: string;
  publicationYear?: number;
  publisher?: string;
  shelfLocation?: string;
}

// Helper to safely get client-side API key if set
function getClientApiKey(): string | undefined {
  try {
    return (
      (import.meta as any).env?.VITE_GEMINI_API_KEY ||
      (import.meta as any).env?.GEMINI_API_KEY ||
      (typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY || process.env?.VITE_GEMINI_API_KEY : undefined)
    );
  } catch (e) {
    return undefined;
  }
}

// Helper to safely parse JSON from response
async function safeJsonFetch(url: string, bodyData: any): Promise<any | null> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyData),
    });

    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        console.warn(`JSON parse error from ${url}:`, e);
        return null;
      }
    }
  } catch (err) {
    console.warn(`Fetch error for ${url}:`, err);
  }
  return null;
}

// 1. Ask Libby AI Assistant
export async function askAiLibrarian(params: {
  message: string;
  catalogContext: CatalogBookContext[];
  userGrade?: string;
  language?: 'en' | 'dv';
}): Promise<string> {
  const { message, catalogContext, userGrade, language = 'en' } = params;
  const isDhivehi = language === 'dv';

  // Step A: Try server API first
  const serverData = await safeJsonFetch('/api/ai/ask-librarian', {
    message,
    catalogContext,
    userGrade,
    language
  });

  if (serverData && serverData.text) {
    return serverData.text;
  }

  // Step B: Direct Gemini SDK call if client key is configured
  const apiKey = getClientApiKey();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const langInstruction = isDhivehi
        ? 'CRITICAL MANDATE: Write your response ENTIRELY in natural, fluent, and grammatically correct Dhivehi language (ދިވެހި ބަހުން) using clean Thaana script.'
        : 'Respond in clear, encouraging English.';

      const prompt = `You are "Libby" (ލިބީ), the friendly AI Smart Librarian for Magoodhoo School Library (މަގޫދޫ ސްކޫލް ލައިބްރަރީ).
You are assisting a student or teacher in Grade/Role: ${userGrade || 'General Reader'}.
Question or Request: "${message}"

Available Catalog Books (Sample Context):
${JSON.stringify((catalogContext || []).map(b => ({ title: b.title, author: b.author, category: b.category, location: b.shelfLocation })))}

Guidelines:
- ${langInstruction}
- Provide helpful, enthusiastic, age-appropriate guidance.
- Suggest specific books from the catalog when relevant, mentioning author and shelf location.
- Keep output nicely formatted using markdown bold text and clean bullet points.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
      });

      if (response.text) return response.text;
    } catch (sdkError) {
      console.warn('Client-side Gemini call failed:', sdkError);
    }
  }

  // Step C: Smart local catalog response fallback
  return generateLocalCatalogResponse(message, catalogContext, isDhivehi);
}

// 2. AI Book Metadata & Description Auto-Generator
export async function generateAiBookInfo(params: {
  title: string;
  author: string;
  language?: 'en' | 'dv';
}): Promise<BookInfo> {
  const { title, author, language = 'en' } = params;
  const isDhivehi = language === 'dv';

  const serverData = await safeJsonFetch('/api/ai/generate-book-info', { title, author, language });
  if (serverData && !serverData.error && serverData.description) {
    return serverData;
  }

  const apiKey = getClientApiKey();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `You are a school librarian cataloging a book titled "${title}" by "${author}".
Generate accurate library metadata in JSON format with:
- "description": A captivating 2-3 sentence synopsis for students ${isDhivehi ? 'written in Dhivehi Thaana script (ދިވެހި ބަހުން)' : 'written in English'}.
- "category": Recommended genre/category (e.g. Fiction, Fantasy, Science, History, Biography).
- "publicationYear": Integer year.
- "publisher": Publisher name.
- "shelfLocation": Recommended shelf section (e.g., "Fiction - A3").`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (e) {
      console.warn('Client-side generateBookInfo failed:', e);
    }
  }

  // Fallback metadata
  return {
    description: isDhivehi
      ? `މިއީ "${author}" ލިޔުއްވާފައިވާ "${title}" އާ ބެހޭ މަޢުލޫމާތު ހިމެނޭ ފޮތެކެވެ.`
      : `An engaging educational book titled "${title}" written by ${author}.`,
    category: 'General Reading',
    publicationYear: new Date().getFullYear(),
    publisher: 'School Press',
    shelfLocation: 'Section A - General'
  };
}

// 3. AI Quiz & Discussion Prompts Generator
export async function generateAiQuiz(params: {
  bookTitle: string;
  author: string;
  language?: 'en' | 'dv';
}): Promise<QuizData> {
  const { bookTitle, author, language = 'en' } = params;
  const isDhivehi = language === 'dv';

  const serverData = await safeJsonFetch('/api/ai/quiz-generator', { bookTitle, author, language });
  if (serverData && serverData.questions) {
    return serverData;
  }

  const apiKey = getClientApiKey();
  if (apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const langPrompt = isDhivehi
        ? 'CRITICAL: Generate ALL JSON fields (summary, questions, options, explanations, discussionPrompts) ENTIRELY in fluent Dhivehi language (ދިވެހި ބަހުން) using Thaana script.'
        : 'Generate all JSON fields in clear English.';

      const prompt = `Create a 3-question reading comprehension quiz and 2 classroom discussion prompts for the book "${bookTitle}" by "${author}".
${langPrompt}
Return a JSON object with:
- "summary": A brief 2-sentence theme summary.
- "questions": Array of 3 items, each having:
  - "question": Question text
  - "options": Array of 4 string choices
  - "answerIndex": Integer index 0-3 of correct answer
  - "explanation": Short explanation why it's correct
- "discussionPrompts": Array of 2 open-ended discussion questions.`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });

      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (e) {
      console.warn('Client-side generateQuiz failed:', e);
    }
  }

  // Fallback Quiz
  if (isDhivehi) {
    return {
      summary: `މިއީ "${author}" ލިޔުއްވާފައިވާ "${bookTitle}" ފޮތާ ބެހޭ ކިޔުމުގެ ފަހުމް ވަޒަންކުރާ ކުއިޒެކެވެ.`,
      questions: [
        {
          question: `"${bookTitle}" މި ފޮތުގެ މައިގަނޑު މައުޟޫޢަކީ ކޮބައިހެއްޔެވެ؟`,
          options: ['ތަޢުލީމާއި ޢިލްމު', 'އާދަކާދަ', 'ވާހަކަ އާއި ސާހިތްޔު', 'ތާރީޚް'],
          answerIndex: 0,
          explanation: 'ފޮތުގެ މައިގަނޑު އަސާސަކީ އިލްމާއި ތައުލީމެވެ.'
        },
        {
          question: `މި ފޮތް ލިޔުއްވާފައިވަނީ ކޮން މުޞަންނިފެއް ހެއްޔެވެ؟`,
          options: [author, 'ޢަބްދުﷲ ޞާދިޤު', 'މުޙައްމަދު ޖަމީލު', 'ޙުސައިން ޞަލާޙުއްދީން'],
          answerIndex: 0,
          explanation: `މި ފޮތުގެ މުޞަންނިފަކީ ${author} އެވެ.`
        },
        {
          question: 'މި ފޮތުން ދަރިވަރުންނަށް ލިބޭ އެންމެ ބޮޑު ޢިބުރަތަކީ ކޮބައިހެއްޔެވެ؟',
          options: ['މުތާލިއާކުރުމާއި އުނގެނުމުގެ މުހިންމުކަން', 'ވަގުތު ބޭކާރުކުރުން', 'ކަންނެތްކަން', 'އަވަސްއަރުވާލުން'],
          answerIndex: 0,
          explanation: 'ފޮތް ކިޔުމުން އުނގެނުމާއި މުތާލިއާ ކުރުމުގެ އަހައްމިއްޔަތު އެނގިގެންދެއެވެ.'
        }
      ],
      discussionPrompts: [
        `މި ފޮތުން ތިޔަ ދަރިވަރަށް އެންމެ ކަމުދިޔަ ބަޔަކީ ކޮބައިހެއްޔެވެ؟`,
        `މި ފޮތް އެހެން ދަރިވަރަކަށް ކިޔަން އިރުޝާދު ދޭނީ ކީއްވެގެންހެއްޔެވެ؟`
      ]
    };
  }

  return {
    summary: `Reading comprehension test for "${bookTitle}" by ${author}.`,
    questions: [
      {
        question: `What is the primary subject of "${bookTitle}"?`,
        options: ['Learning & Knowledge', 'Historical Events', 'Fiction & Mystery', 'Science Exploration'],
        answerIndex: 0,
        explanation: 'The main core focus of the book is educational learning and discovery.'
      },
      {
        question: `Who wrote the book "${bookTitle}"?`,
        options: [author, 'Unknown Author', 'School Library Press', 'Classic Literature Group'],
        answerIndex: 0,
        explanation: `The author of this work is ${author}.`
      },
      {
        question: 'What key lesson can students take away from reading this book?',
        options: ['The value of reading and curiosity', 'Skipping study time', 'Memorization only', 'Ignoring library resources'],
        answerIndex: 0,
        explanation: 'Reading encourages curiosity, critical thinking, and lifelong learning.'
      }
    ],
    discussionPrompts: [
      `What was the most surprising or interesting idea you learned from "${bookTitle}"?`,
      `How would you recommend this book to a classmate at Magoodhoo School?`
    ]
  };
}

// Local smart catalog response generator
function generateLocalCatalogResponse(
  message: string,
  catalog: CatalogBookContext[],
  isDhivehi: boolean
): string {
  const query = message.toLowerCase();

  const matchingBooks = (catalog || []).filter(b =>
    b.title.toLowerCase().includes(query) ||
    b.author.toLowerCase().includes(query) ||
    (b.category && b.category.toLowerCase().includes(query)) ||
    (b.shelfLocation && b.shelfLocation.toLowerCase().includes(query))
  );

  if (isDhivehi) {
    if (query.includes('ގެއްލި') || query.includes('lost') || query.includes('ނުފެނު') || query.includes('by book')) {
      return `**މަގޫދޫ ސްކޫލް ލައިބްރަރީ - ފޮތް ގެއްލުމުގެ އުޞޫލު** 📜\n\nފޮތެއް ގެއްލިއްޖެނަމަ ނުވަތަ ހަލާކުވެއްޖެނަމަ ޢަމަލުކުރަންވީ ގޮތް:\n\n- 1. **ލައިބްރޭރިއަނަށް އެންގެވުން:** ވީއެންމެ އަވަހަކަށް ލައިބްރަރީ ކައުންޓަރަށް ގޮސް އެންގެވުން.\n- 2. **ފޮތް ބަދަލުކުރުން:** ގެއްލުނު ފޮތުގެ އާ ކޮޕީއެއް ނުވަތަ އެއާ އެއްފެންވަރެއްގެ ފޮތެއް ހަވާލުކުރެއްވުން.\n- 3. **ސުންގަޑި:** 14 ދުވަހުގެ މުއްދަތެއް ލިބޭނެއެވެ.\n\nއިތުރު އެހީތެރިކަމަށް ލައިބްރޭރިއަން މިސް ޑޭވިސް (Ms. Davis) އާ ބައްދަލުކުރައްވާ!`;
    }

    if (matchingBooks.length > 0) {
      const bookList = matchingBooks.slice(0, 3).map(b => `- **${b.title}** (${b.author}) - ރެކު: \`${b.shelfLocation || 'Main Hall'}\``).join('\n');
      return `**މަގޫދޫ ސްކޫލް ލައިބްރަރީ ކެޓަލޮގުން ފެނުނު ފޮތްތައް:** 📚\n\n${bookList}\n\nމި ފޮތްތައް ނެންގެވުމަށް ލައިބްރަރީ ކައުންޓަރަށް ވަޑައިގަންނަވާ!`;
    }

    const sampleList = (catalog || []).slice(0, 3).map(b => `- **${b.title}** (މުޞަންނިފު: ${b.author}) - \`${b.shelfLocation || 'Section A'}\``).join('\n');
    return `މަރުޙަބާ! އަޅުގަނޑަކީ **ލިބީ** (މަގޫދޫ ސްކޫލް އޭއައި ލައިބްރޭރިއަން) 🤖\n\nތިޔަ ކުރެއްވި ސުވާލާ ގުޅޭގޮތުން ލައިބްރަރީން އެހީތެރިވެދެވިދާނެއެވެ. ލައިބްރަރީގައި ހުރި ބައެއް މަޤްބޫލު ފޮތްތައް:\n\n${sampleList}\n\nއިތުރު މަޢުލޫމާތެއް ބޭނުންފުޅުނަމަ ސުވާލުކުރައްވާ!`;
  }

  // English fallback
  if (query.includes('lost') || query.includes('missing') || query.includes('by book')) {
    return `**Magoodhoo School Library - Lost Book Policy** 📜\n\nIf you have lost or misplaced a borrowed library book, please follow these simple steps:\n\n1. **Report to Librarian**: Visit the library desk and inform Ms. Davis as soon as possible so overdue late fees can be paused.\n2. **Replacement Options**: You can replace the book with a new identical copy or pay the standard catalog replacement fee.\n3. **Grace Period**: Students are granted a 14-day grace window to search at home or in class.\n\nPlease pop by the main circulation desk for further help!`;
  }

  if (matchingBooks.length > 0) {
    const bookList = matchingBooks.slice(0, 3).map(b => `- **${b.title}** by ${b.author} (Shelf: \`${b.shelfLocation || 'Main Hall'}\`)`).join('\n');
    return `**Books Found in Magoodhoo School Library Catalog:** 📚\n\n${bookList}\n\nYou can borrow these directly from the circulation desk!`;
  }

  const sampleList = (catalog || []).slice(0, 3).map(b => `- **${b.title}** by ${b.author} (\`${b.shelfLocation || 'Section A'}\`)`).join('\n');
  return `Hello! I am **Libby**, your Magoodhoo School Library AI Assistant 🤖\n\nHere are some popular books available in our school catalog:\n\n${sampleList}\n\nFeel free to ask me about any book, author, genre, or library borrowing policy!`;
}
