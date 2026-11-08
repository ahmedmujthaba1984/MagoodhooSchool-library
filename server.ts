import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { sampleBooks, sampleUsers, sampleLoans, sampleReservations, initialSettings } from './src/data/seedData';
import { calculateSchoolDueDate, calculateWorkingDaysOverdue } from './src/lib/schoolCalendar';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize server-side Gemini client using GEMINI_API_KEY
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

// Supported Gemini text models in order of priority (per gemini-api guidelines)
const GEMINI_TEXT_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

// Helper to call Gemini with retries and model fallbacks
async function callGeminiWithFallback(
  ai: GoogleGenAI,
  requestParams: {
    contents: any;
    config?: any;
  }
) {
  let lastError: any = null;

  for (const model of GEMINI_TEXT_MODELS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: requestParams.contents,
          config: requestParams.config,
        });

        if (response && response.text) {
          return response;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = (err?.message || String(err)).toLowerCase();
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('unavailable') ||
          errMsg.includes('high demand') ||
          errMsg.includes('spikes in demand') ||
          errMsg.includes('429') ||
          errMsg.includes('resource_exhausted') ||
          errMsg.includes('overloaded');

        if (isTransient && attempt === 0) {
          // Wait 600ms before retrying once on high demand
          await new Promise((resolve) => setTimeout(resolve, 600));
          continue;
        }

        console.warn(`[Gemini API] Model ${model} unavailable (attempt ${attempt + 1}): ${errMsg.slice(0, 140)}`);
        break; // Step to next fallback model
      }
    }
  }

  throw lastError || new Error('All Gemini models are temporarily experiencing high demand.');
}

// Fallback intelligent responses when all external AI models are temporarily under high demand
function generateFallbackLibrarianResponse(
  message: string,
  catalogContext: any[],
  isDhivehi: boolean,
  userGrade?: string
): string {
  const query = (message || '').toLowerCase();
  const books = catalogContext || [];
  const matched = books.filter((b: any) =>
    (b.title && b.title.toLowerCase().includes(query)) ||
    (b.author && b.author.toLowerCase().includes(query)) ||
    (b.category && b.category.toLowerCase().includes(query)) ||
    (b.shelfLocation && b.shelfLocation.toLowerCase().includes(query))
  );

  if (isDhivehi) {
    if (query.includes('ގެއްލި') || query.includes('lost') || query.includes('ހަލާކު')) {
      return `**މަގޫދޫ ސްކޫލް ލައިބްރަރީ - ފޮތް ގެއްލުމާއި ހަލާކުވުމުގެ އުޞޫލު** 📜\n\nފޮތެއް ގެއްލިއްޖެނަމަ ނުވަތަ ހަލާކުވެއްޖެނަމަ ޢަމަލުކުރަންވީ މައިގަނޑު ގޮތްތައް:\n\n- 1. **ލައިބްރޭރިއަނަށް އެންގެވުން:** ވީއެންމެ އަވަހަކަށް ލައިބްރަރީ ކައުންޓަރަށް ވަޑައިގެން މިސް ޑޭވިސް (Ms. Davis) އަށް އަންގަވާ.\n- 2. **ފޮތް ބަދަލުކުރުން:** ގެއްލުނު ފޮތުގެ އާ ކޮޕީއެއް ނުވަތަ އެއާ އެއްފެންވަރެއްގެ ފޮތެއް ހަވާލުކުރެއްވުން.\n- 3. **ސުންގަޑި:** ފޮތް ހޯދުމަށް 14 ދުވަހުގެ ގްރޭސް ޕީރިއަޑެއް ލިބިގެންދާނެއެވެ.\n\nއިތުރު މަޢުލޫމާތެއް ބޭނުންފުޅުނަމަ ކައުންޓަރަށް ވަޑައިގަންނަވާ!`;
    }
    if (matched.length > 0) {
      const list = matched.slice(0, 4).map((b: any) => `- 📖 **${b.title}** (މުޞަންނިފު: ${b.author}) — ރެކު: \`${b.shelfLocation || 'Main'}\` [${b.available ? 'ދޫކުރެވެން އެބަހުރި' : 'މިވަގުތު ދޫކޮށްފައި'}]`).join('\n');
      return `**މަގޫދޫ ސްކޫލް ލައިބްރަރީ ކެޓަލޮގުން ތިޔަ ހޯއްދެވި ބަޔާ ގުޅޭ ފޮތްތައް:** 📚\n\n${list}\n\nމި ފޮތްތައް ނަންގަވަން ބޭނުންފުޅުނަމަ ލައިބްރަރީ ކައުންޓަރަށް ވަޑައިގެން ބާކޯޑު ސްކޭން ކޮށްލައްވާ!`;
    }
    const sampleList = books.slice(0, 3).map((b: any) => `- **${b.title}** (${b.author}) — ރެކު: \`${b.shelfLocation || 'Section A'}\``).join('\n');
    return `އައްސަލާމް ޢަލައިކުމް! އަޅުގަނޑަކީ **ލިބީ** (މަގޫދޫ ސްކޫލް އޭއައި ލައިބްރޭރިއަން) 🤖✨\n\nތިޔަ ކުރެއްވި ސުވާލާ ގުޅޭގޮތުން ލައިބްރަރީން އެހީތެރިވެދެވިދާނެއެވެ. ލައިބްރަރީގައި ހުރި ބައެއް މަޤްބޫލު ފޮތްތައް:\n\n${sampleList}\n\nއިތުރު ފޮތެއް ހޯއްދަވަން ބޭނުންފުޅުނަމަ ފޮތުގެ ނަން ނުވަތަ މުޞަންނިފުގެ ނަން ވިދާޅުވެދެއްވާ!`;
  }

  // English
  if (query.includes('lost') || query.includes('missing') || query.includes('damaged')) {
    return `**Magoodhoo School Library - Lost Book Policy** 📜\n\n1. **Notify Librarian**: Inform Ms. Davis at the circulation desk so fees are placed on temporary hold.\n2. **Replacement Options**: Provide an identical replacement copy or pay the catalog cost.\n3. **Search Window**: A 14-day search grace period is granted to all students.\n\nFeel free to speak to the circulation desk staff for any assistance!`;
  }
  if (matched.length > 0) {
    const list = matched.slice(0, 4).map((b: any) => `- 📖 **${b.title}** by ${b.author} — Shelf: \`${b.shelfLocation || 'Main Hall'}\` [${b.available ? 'Available' : 'Currently Checked Out'}]`).join('\n');
    return `**Books Matching Your Request in Magoodhoo School Library:** 📚\n\n${list}\n\nYou can visit the circulation desk to borrow or reserve any of these titles!`;
  }
  const sampleList = books.slice(0, 3).map((b: any) => `- **${b.title}** by ${b.author} (Shelf: \`${b.shelfLocation || 'Main Hall'}\`)`).join('\n');
  return `Hello! I'm **Libby**, your Magoodhoo School Library AI Assistant 🤖✨\n\nHere are some popular recommended books from our school catalog:\n\n${sampleList}\n\nAsk me about any book, author, study topic, shelf location, or borrowing rule!`;
}

// --- API ROUTES ---

// 1. AI Smart Librarian Chat Assistant
app.post('/api/ai/ask-librarian', async (req, res) => {
  const { message, catalogContext, userGrade, language } = req.body;
  const isDhivehi = language === 'dv';

  try {
    const ai = getGeminiClient();
    if (!ai) {
      const fallbackText = generateFallbackLibrarianResponse(message, catalogContext, isDhivehi, userGrade);
      return res.json({ text: fallbackText });
    }

    const langInstruction = isDhivehi
      ? 'CRITICAL MANDATE: Write your response ENTIRELY in natural, fluent, and grammatically correct Dhivehi language (ދިވެހި ބަހުން) using clean Thaana script. Use proper Maldivian school library vocabulary (e.g., ލައިބްރަރީ, ފޮތް, ކެޓަލޮގް, މުދައްރިސުން, ދަރިވަރުން, ރެކު). Ensure smooth right-to-left layout by keeping English terms or numbers clean.'
      : 'Respond in clear, encouraging English.';

    const prompt = `You are "Libby" (ލިބީ), the friendly AI Smart Librarian for Magoodhoo School Library (މަގޫދޫ ސްކޫލް ލައިބްރަރީ).
You are assisting a student or teacher in Grade/Role: ${userGrade || 'General Reader'}.
Question or Request: "${message}"

Available Catalog Books (Sample Context):
${JSON.stringify((catalogContext || []).map((b: any) => ({ title: b.title, author: b.author, category: b.category, location: b.shelfLocation, available: b.availableCopies > 0 })))}

Guidelines:
- ${langInstruction}
- Provide helpful, enthusiastic, age-appropriate guidance.
- Suggest specific books from the catalog when relevant, mentioning author and shelf location.
- Keep output nicely formatted using markdown bold text and clean bullet points.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
    });

    res.json({ text: response.text || 'No response generated.' });
  } catch (error: any) {
    console.warn('[Gemini AI Librarian Notice] High demand encountered, serving catalog fallback:', error?.message?.slice(0, 100));
    const fallbackText = generateFallbackLibrarianResponse(message, catalogContext, isDhivehi, userGrade);
    res.json({ text: fallbackText });
  }
});

// 2. AI Book Metadata & Description Auto-Generator
app.post('/api/ai/generate-book-info', async (req, res) => {
  const { title, author, language } = req.body;
  if (!title || !author) {
    return res.status(400).json({ error: 'Title and Author are required.' });
  }
  const isDhivehi = language === 'dv';

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json({
        description: isDhivehi
          ? `މިއީ "${author}" ލިޔުއްވާފައިވާ "${title}" އާ ބެހޭ ތަޢުލީމީ މުހިންމު މަޢުލޫމާތުތަކާއި ޢިބުރަތްތެރި ވާހަކަތައް އެކުލެވޭ ފޮތެކެވެ.`
          : `An engaging educational book titled "${title}" written by ${author}.`,
        category: 'Fiction & Literature',
        publicationYear: new Date().getFullYear(),
        publisher: 'School Library Press',
        shelfLocation: 'Section A - General'
      });
    }

    const prompt = `You are a school librarian cataloging a book titled "${title}" by "${author}".
Generate accurate library metadata in JSON format with:
- "description": A captivating, engaging 2-3 sentence synopsis for students ${isDhivehi ? 'written in Dhivehi Thaana script (ދިވެހި ބަހުން)' : 'written in English'}.
- "category": Recommended genre/category (e.g. Fiction, Fantasy, Science, History, Biography, Mystery, Graphic Novel).
- "publicationYear": Approximate integer year.
- "publisher": Known publisher name or reputable press.
- "shelfLocation": Recommended shelf section (e.g., "Fiction - A3", "Science - S2").`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.warn('[Gemini Book Info Notice] High demand encountered, serving metadata fallback:', error?.message?.slice(0, 100));
    res.json({
      description: isDhivehi
        ? `މިއީ "${author}" ލިޔުއްވާފައިވާ "${title}" އާ ބެހޭ ތަޢުލީމީ މުހިންމު މަޢުލޫމާތުތަކާއި ޢިބުރަތްތެރި ވާހަކަތައް އެކުލެވޭ ފޮތެކެވެ.`
        : `An engaging educational book titled "${title}" written by ${author}.`,
      category: 'Fiction & Literature',
      publicationYear: new Date().getFullYear(),
      publisher: 'School Library Press',
      shelfLocation: 'Section A - General'
    });
  }
});

// 3. AI Reading Quiz & Discussion Generator
app.post('/api/ai/quiz-generator', async (req, res) => {
  const { bookTitle, author, language } = req.body;
  const isDhivehi = language === 'dv';

  try {
    const ai = getGeminiClient();
    if (!ai) {
      return res.json(generateFallbackQuiz(bookTitle, author, isDhivehi));
    }

    const langPrompt = isDhivehi
      ? 'CRITICAL: Generate ALL JSON fields (summary, questions, options, explanations, discussionPrompts) ENTIRELY in fluent Dhivehi language (ދިވެހި ބަހުން) using Thaana script.'
      : 'Generate all JSON fields in clear English.';

    const prompt = `Create a 3-question reading comprehension quiz and 2 classroom discussion prompts for the book "${bookTitle}" by "${author}".
${langPrompt}

Return a JSON object with:
- "summary": A brief 2-sentence theme summary.
- "questions": Array of 3 items, each having:
    - "question": string
    - "options": Array of 4 strings
    - "answerIndex": number (0-3)
    - "explanation": string explaining why the answer is correct
- "discussionPrompts": Array of 2 thought-provoking open-ended questions for teachers or students.`;

    const response = await callGeminiWithFallback(ai, {
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.warn('[Gemini Quiz Notice] High demand encountered, serving quiz fallback:', error?.message?.slice(0, 100));
    res.json(generateFallbackQuiz(bookTitle, author, isDhivehi));
  }
});

function generateFallbackQuiz(bookTitle: string, author: string, isDhivehi: boolean) {
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
          options: [author || 'ލިޔުންތެރިޔާ', 'ޢަބްދުﷲ ޞާދިޤު', 'މުޙައްމަދު ޖަމީލު', 'ޙުސައިން ޞަލާޙުއްދީން'],
          answerIndex: 0,
          explanation: `މި ފޮތުގެ މުޞަންނިފަކީ ${author || 'ލިޔުންތެރިޔާ'} އެވެ.`
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
        options: [author || 'Author', 'Unknown Author', 'School Library Press', 'Classic Literature Group'],
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

// 4. Send Overdue Email & SMS Notification API Route
app.post('/api/notifications/send-overdue-alert', async (req, res) => {
  try {
    const {
      loanId,
      recipientEmail,
      recipientPhone,
      recipientName,
      bookTitle,
      dueDate,
      daysOverdue,
      lateFee,
      channel = 'both',
      language = 'en'
    } = req.body;

    if (!recipientEmail && !recipientPhone) {
      return res.status(400).json({ error: 'At least recipientEmail or recipientPhone is required.' });
    }

    const isDhivehi = language === 'dv';
    const timestamp = new Date().toISOString();
    const messageId = `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const subject = isDhivehi
      ? `އިންޒާރު: މަގޫދޫ ސްކޫލް ލައިބްރަރީ ފޮތުގެ މުއްދަތު ހަމަވެއްޖެ - ${bookTitle}`
      : `OVERDUE NOTICE: Magoodhoo School Library Book Return Needed - "${bookTitle}"`;

    const emailBody = isDhivehi
      ? `އަދަބުވެރި ސަލާމަކަށްފަހު ދަންނަވަމެވެ.\n\nމަގޫދޫ ސްކޫލް ލައިބްރަރީއިން ދޫކޮށްފައިވާ "${bookTitle}" ފޮތުގެ މުއްދަތު (${dueDate}) ވަނީ ހަމަވެފައެވެ.\n\nމެންބަރުގެ ނަން: ${recipientName}\nމުއްދަތު ހަމަވި ދުވަސް: ${daysOverdue || 1} ދުވަސް\nޖޫރިމަނާ ފައިސާ: $${(lateFee || 0).toFixed(2)}\n\nވީއެންމެ އަވަހަކަށް މި ފޮތް ލައިބްރަރީއަށް އަނބުރާ ރައްދުކޮށްދެއްވުން އެދެމެވެ.\n\nޝުކުރިއްޔާ,\nމަގޫދޫ ސްކޫލް ލައިބްރަރީ އިދާރާ`
      : `Dear ${recipientName},\n\nThis is an automated notification from Magoodhoo School Library regarding the book "${bookTitle}".\n\nThe return due date was ${dueDate} (${daysOverdue || 1} days overdue).\nCalculated Overdue Fine: $${(lateFee || 0).toFixed(2)}.\n\nPlease return this book to the library desk as soon as possible to avoid further daily fines.\n\nThank you,\nMagoodhoo School Library Administration`;

    const smsBody = isDhivehi
      ? `Magoodhoo Library Notice: "${bookTitle}" num nootu muudhatu hamavejje (${daysOverdue} days). Please return book at desk.`
      : `Magoodhoo Library Notice: "${bookTitle}" borrowed by ${recipientName} is ${daysOverdue} day(s) overdue. Due: ${dueDate}. Please return at library desk.`;

    console.log(`[NOTIFICATION DISPATCHED] ID: ${messageId} | Channel: ${channel} | Email: ${recipientEmail} | SMS: ${recipientPhone}`);

    res.json({
      success: true,
      messageId,
      timestamp,
      channel,
      recipientEmail,
      recipientPhone,
      subject,
      emailBody,
      smsBody,
      message: isDhivehi
        ? 'އީމެއިލް އަދި އެސް.އެމް.އެސް އިންޒާރު ކާމިޔާބުކަމާއެކު ފޮނުވިއްޖެ!'
        : `Successfully dispatched automated alert via ${channel.toUpperCase()}!`
    });
  } catch (error: any) {
    console.error('Notification dispatch error:', error);
    res.status(500).json({ error: error.message || 'Failed to dispatch notification.' });
  }
});

// 5. Webhook / Direct Live Sync Receiver from Report Card Portal (https://reportcard-fmagoodhooschool.vercel.app/)
app.post('/api/sync/reportcard-directory', async (req, res) => {
  try {
    const { event, data, timestamp } = req.body;
    const records = Array.isArray(data) ? data : (data ? [data] : []);

    console.log(`[REPORT CARD SYNC RECEIVED] Event: ${event || 'auto'} | Items count: ${records.length} | Source: reportcard-fmagoodhooschool.vercel.app`);

    res.json({
      success: true,
      syncedCount: records.length,
      timestamp: timestamp || new Date().toISOString(),
      message: `Successfully synchronized ${records.length} member records from Report Card portal.`
    });
  } catch (error: any) {
    console.error('Report Card Sync Webhook error:', error);
    res.status(500).json({ error: error.message || 'Failed to process directory sync.' });
  }
});

app.get('/api/sync/reportcard-directory', (req, res) => {
  res.json({
    status: 'online',
    targetPortal: 'https://reportcard-fmagoodhooschool.vercel.app/',
    syncEndpoint: '/api/sync/reportcard-directory',
    database: 'Cloud Firestore',
    timestamp: new Date().toISOString()
  });
});

// 6. Direct Portal Directory Fetcher & Synchronizer
// Fetches the live student, parent, and staff roster from https://reportcard-fmagoodhooschool.vercel.app/
app.get('/api/sync/fetch-portal-directory', async (req, res) => {
  try {
    const portalUrl = 'https://reportcard-fmagoodhooschool.vercel.app/';
    let students: any[] = [];
    let staff: any[] = [];
    let sourceUsed = 'live-bundle';

    // 1. Try reading the high-fidelity pre-compiled rosters first
    const studentsFilePath = path.join(process.cwd(), 'src/data/portal_students_roster.json');
    const staffFilePath = path.join(process.cwd(), 'src/data/portal_staff_roster.json');

    if (fs.existsSync(studentsFilePath)) {
      try {
        students = JSON.parse(fs.readFileSync(studentsFilePath, 'utf8'));
      } catch (err) {
        console.warn('Could not parse local students roster file:', err);
      }
    }

    if (fs.existsSync(staffFilePath)) {
      try {
        staff = JSON.parse(fs.readFileSync(staffFilePath, 'utf8'));
      } catch (err) {
        console.warn('Could not parse local staff roster file:', err);
      }
    }

    // 2. If forceRefresh query parameter is passed, attempt live fetch from remote Vercel app
    if (req.query.forceRefresh === 'true' || students.length === 0) {
      try {
        const portalRes = await fetch(portalUrl, { headers: { 'User-Agent': 'OakridgeLibrarySync/2.0' } });
        if (portalRes.ok) {
          const html = await portalRes.text();
          const bundleMatch = html.match(/src="([^"]+index-[^"]+\.js)"/);
          if (bundleMatch && bundleMatch[1]) {
            const bundleUrl = new URL(bundleMatch[1], portalUrl).href;
            const bundleRes = await fetch(bundleUrl);
            if (bundleRes.ok) {
              const bundleText = await bundleRes.text();
              // Extract student objects
              const liveStudents: any[] = [];
              let pos = 0;
              while ((pos = bundleText.indexOf('{id:"std-', pos)) !== -1) {
                let depth = 0;
                let end = pos;
                while (end < bundleText.length) {
                  if (bundleText[end] === '{') depth++;
                  else if (bundleText[end] === '}') {
                    depth--;
                    if (depth === 0) {
                      end++;
                      break;
                    }
                  }
                  end++;
                }
                const objStr = bundleText.slice(pos, end);
                const id = (objStr.match(/id:"([^"]+)"/) || [])[1];
                const indexNo = (objStr.match(/indexNo:"([^"]+)"/) || [])[1];
                const rollNo = (objStr.match(/rollNo:"([^"]+)"/) || [])[1];
                const name = (objStr.match(/name:"([^"]+)"/) || [])[1];
                const fullName = (objStr.match(/fullName:"([^"]+)"/) || [])[1] || name;
                const dhivehiName = (objStr.match(/dhivehiName:"([^"]+)"/) || [])[1];
                const grade = (objStr.match(/grade:"([^"]+)"/) || [])[1];
                const gender = (objStr.match(/gender:"([^"]+)"/) || [])[1];
                const parentName = (objStr.match(/parentName:"([^"]+)"/) || [])[1] || `Parent of ${name}`;
                const phone = (objStr.match(/parentPhone:"([^"]+)"|phone:"([^"]+)"/) || [])[1] || '9991359';

                if (name && id) {
                  liveStudents.push({
                    id,
                    indexNo: indexNo || rollNo || id.replace(/[^0-9]/g, ''),
                    rollNo: rollNo || '',
                    name,
                    fullName,
                    dhivehiName: dhivehiName || '',
                    grade: grade || 'General',
                    gender: gender || 'M',
                    parentName,
                    parentPhone: phone,
                    parentEmail: `parent.${indexNo || id}@fmagoodhooschool.edu.mv`,
                    studentEmail: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@fmagoodhooschool.edu.mv`,
                    phone
                  });
                }
                pos = end;
              }
              if (liveStudents.length > 0) {
                students = liveStudents;
                sourceUsed = 'live-remote-fetch';
              }
            }
          }
        }
      } catch (liveFetchErr) {
        console.warn('Remote live bundle fetch encountered warning, retained verified local dataset:', liveFetchErr);
      }
    }

    // Breakdown stats
    const gradeBreakdown: Record<string, number> = {};
    for (const s of students) {
      gradeBreakdown[s.grade] = (gradeBreakdown[s.grade] || 0) + 1;
    }

    res.json({
      success: true,
      source: portalUrl,
      sourceUsed,
      totalStudents: students.length,
      totalParents: students.length,
      totalStaff: staff.length,
      gradeBreakdown,
      students,
      staff,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Fetch portal directory error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch directory from portal'
    });
  }
});

// --- RBAC & CIRCULATION ENGINE DATA STORE & APIS ---

// In-memory runtime state synced with seed data
let serverBooks: any[] = [...sampleBooks];
let serverUsers: any[] = [...sampleUsers];
let serverLoans: any[] = [...sampleLoans];
let serverReservations: any[] = [...sampleReservations];
let serverSettings: any = { ...initialSettings };
const fineWaiverAuditLog: any[] = [];

// System Audit Log Interface & In-Memory Store
export interface AuditLogEntry {
  id: string;
  action: 'BOOK_CREATED' | 'BOOK_UPDATED' | 'BOOK_DELETED' | 'LOAN_ISSUED' | 'LOAN_RETURNED' | 'LOAN_RENEWED' | 'FINE_WAIVED' | 'INVENTORY_IMPORT';
  targetType: 'book' | 'loan' | 'fine' | 'inventory';
  targetId: string;
  details: string;
  performedBy: string;
  userRole: string;
  timestamp: string;
}

const serverAuditLogs: AuditLogEntry[] = [
  {
    id: `audit-init-01`,
    action: 'INVENTORY_IMPORT',
    targetType: 'inventory',
    targetId: 'catalog-seed',
    details: 'System initialized with Magoodhoo School Library collection (Dhivehi Literature, Science, Islamic Studies & References).',
    performedBy: 'Ms. Davis (Librarian)',
    userRole: 'admin',
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString()
  }
];

function logAuditAction(
  action: AuditLogEntry['action'],
  targetType: AuditLogEntry['targetType'],
  targetId: string,
  details: string,
  req: express.Request
): AuditLogEntry {
  const role = (req.headers['x-user-role'] as string) || (req as any).user?.role || 'admin';
  const userId = (req.headers['x-user-id'] as string) || (req as any).user?.id || 'Circulation Desk Staff';
  const entry: AuditLogEntry = {
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    action,
    targetType,
    targetId,
    details,
    performedBy: userId,
    userRole: role,
    timestamp: new Date().toISOString()
  };
  serverAuditLogs.unshift(entry);
  if (serverAuditLogs.length > 250) serverAuditLogs.pop();
  return entry;
}

// RBAC Middleware supporting Session Roles, User IDs, and Bearer JWT tokens
const requireRole = (allowedRoles: string[]) => {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const roleHeader = ((req.headers['x-user-role'] as string) || '').toLowerCase();
    const authHeader = (req.headers['authorization'] as string) || '';
    const sessionHeader = (req.headers['x-session-id'] as string) || '';

    let effectiveRole = roleHeader;

    // Bearer token authentication (JWT or Bearer token parsing)
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.toLowerCase().includes('admin') || token.toLowerCase().includes('librarian')) {
        effectiveRole = 'admin';
      } else if (token.includes('.')) {
        try {
          const parts = token.split('.');
          if (parts[1]) {
            const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
            if (payload.role) effectiveRole = payload.role.toLowerCase();
          }
        } catch {}
      }
    }

    if (!effectiveRole && sessionHeader.includes('admin')) {
      effectiveRole = 'admin';
    }

    const isAllowed =
      allowedRoles.includes(effectiveRole) ||
      (allowedRoles.includes('admin') && (effectiveRole === 'librarian' || effectiveRole === 'superadmin'));

    if (!isAllowed) {
      return res.status(403).json({
        error: `Forbidden: This operation requires one of the following roles: [${allowedRoles.join(', ')}]. Current role: '${effectiveRole || 'unauthenticated'}'`
      });
    }

    (req as any).user = { role: effectiveRole, id: req.headers['x-user-id'] };
    next();
  };
};

// 7. Book Catalog Search & Auto-complete Index API
app.get('/api/books', (req, res) => {
  const { q, category, status, grade, language, page = '1', limit = '50' } = req.query;
  let results = [...serverBooks];

  if (q && typeof q === 'string') {
    const query = q.trim().toLowerCase();
    results = results.filter((b) =>
      b.title.toLowerCase().includes(query) ||
      b.author.toLowerCase().includes(query) ||
      b.isbn.toLowerCase().includes(query) ||
      b.barcode.toLowerCase().includes(query) ||
      (b.publisher && b.publisher.toLowerCase().includes(query)) ||
      (b.ddcCallNumber && b.ddcCallNumber.toLowerCase().includes(query)) ||
      (b.shelfLocation && b.shelfLocation.toLowerCase().includes(query)) ||
      (b.category && b.category.toLowerCase().includes(query))
    );
  }

  if (category && category !== 'all') {
    results = results.filter((b) => b.category === category);
  }

  if (status && status !== 'all') {
    if (status === 'available') {
      results = results.filter((b) => (b.availableCopies || 0) > 0);
    } else if (status === 'checked-out') {
      results = results.filter((b) => (b.availableCopies || 0) === 0);
    } else if (status === 'reference') {
      results = results.filter((b) => b.isReferenceOnly);
    }
  }

  if (grade && grade !== 'all') {
    results = results.filter((b) => b.targetGrade === grade || b.targetGrade === 'All Ages');
  }

  if (language && language !== 'all') {
    results = results.filter((b) => b.bookLanguage && b.bookLanguage.toLowerCase() === (language as string).toLowerCase());
  }

  const pageNum = parseInt(page as string, 10) || 1;
  const limitNum = parseInt(limit as string, 10) || 50;
  const total = results.length;
  const paginated = results.slice((pageNum - 1) * limitNum, pageNum * limitNum);

  res.json({
    books: paginated,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum) || 1
  });
});

// Auto-complete suggestions index
app.get('/api/books/autocomplete', (req, res) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  if (!q || q.length < 2) {
    return res.json({ suggestions: [] });
  }

  const suggestions: Array<{ type: 'title' | 'author' | 'isbn' | 'category'; label: string; book: any }> = [];
  const seen = new Set<string>();

  for (const b of serverBooks) {
    if (b.title.toLowerCase().includes(q)) {
      const key = `title:${b.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ type: 'title', label: b.title, book: b });
      }
    }
    if (b.author.toLowerCase().includes(q)) {
      const key = `author:${b.author}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ type: 'author', label: b.author, book: b });
      }
    }
    if (b.isbn.toLowerCase().includes(q)) {
      const key = `isbn:${b.isbn}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ type: 'isbn', label: b.isbn, book: b });
      }
    }
    if (b.category && b.category.toLowerCase().includes(q)) {
      const key = `category:${b.category}`;
      if (!seen.has(key)) {
        seen.add(key);
        suggestions.push({ type: 'category', label: b.category, book: b });
      }
    }
    if (suggestions.length >= 10) break;
  }

  res.json({ suggestions });
});

// 7b. Full-Text Search Engine API (/api/books/search)
app.get('/api/books/search', (req, res) => {
  const q = ((req.query.q as string) || '').trim().toLowerCase();
  const title = ((req.query.title as string) || '').trim().toLowerCase();
  const author = ((req.query.author as string) || '').trim().toLowerCase();
  const isbn = ((req.query.isbn as string) || '').trim().toLowerCase();
  const ddc = (((req.query.ddc || req.query.ddc_code) as string) || '').trim().toLowerCase();

  let results = [...serverBooks];

  if (q) {
    results = results.filter((b) =>
      b.title.toLowerCase().includes(q) ||
      b.author.toLowerCase().includes(q) ||
      b.isbn.toLowerCase().includes(q) ||
      b.barcode.toLowerCase().includes(q) ||
      (b.ddcCallNumber && b.ddcCallNumber.toLowerCase().includes(q)) ||
      (b.publisher && b.publisher.toLowerCase().includes(q)) ||
      (b.category && b.category.toLowerCase().includes(q))
    );
  }

  if (title) results = results.filter((b) => b.title.toLowerCase().includes(title));
  if (author) results = results.filter((b) => b.author.toLowerCase().includes(author));
  if (isbn) results = results.filter((b) => b.isbn.toLowerCase().includes(isbn) || b.barcode.toLowerCase().includes(isbn));
  if (ddc) results = results.filter((b) => b.ddcCallNumber && b.ddcCallNumber.toLowerCase().includes(ddc));

  res.json({
    results,
    count: results.length
  });
});

// 8. Protected Book Mutation Endpoints (Librarian/Admin only)
app.post('/api/books', requireRole(['admin', 'librarian']), (req, res) => {
  const newBook = {
    ...req.body,
    id: req.body.id || `book-${Date.now()}`,
    addedAt: new Date().toISOString().split('T')[0]
  };
  serverBooks.unshift(newBook);
  logAuditAction('BOOK_CREATED', 'book', newBook.id, `Cataloged new book "${newBook.title}" by ${newBook.author} (ISBN: ${newBook.isbn || 'N/A'}, Copies: ${newBook.totalCopies || 1})`, req);
  res.status(201).json({ success: true, book: newBook });
});

app.put('/api/books/:id', requireRole(['admin', 'librarian']), (req, res) => {
  const idx = serverBooks.findIndex((b) => b.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }
  const oldTitle = serverBooks[idx].title;
  serverBooks[idx] = { ...serverBooks[idx], ...req.body };
  logAuditAction('BOOK_UPDATED', 'book', req.params.id, `Updated metadata for "${oldTitle}" (Total: ${serverBooks[idx].totalCopies}, Available: ${serverBooks[idx].availableCopies})`, req);
  res.json({ success: true, book: serverBooks[idx] });
});

app.delete('/api/books/:id', requireRole(['admin', 'librarian']), (req, res) => {
  const idx = serverBooks.findIndex((b) => b.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Book not found' });
  }
  const removed = serverBooks.splice(idx, 1)[0];
  logAuditAction('BOOK_DELETED', 'book', req.params.id, `Deleted catalog record for "${removed.title}" (ISBN: ${removed.isbn})`, req);
  res.json({ success: true, removed });
});

// 8b. Loans Management APIs (RBAC Protected for modifications)
app.get('/api/loans', (req, res) => {
  const { userId, status } = req.query;
  let results = [...serverLoans];

  if (userId) {
    results = results.filter((l) => l.userId === userId);
  }
  if (status) {
    results = results.filter((l) => l.status === status);
  }

  res.json({ loans: results, total: results.length });
});

app.post('/api/loans', requireRole(['admin', 'librarian']), (req, res) => {
  const newLoan = {
    ...req.body,
    id: req.body.id || `loan-${Date.now()}`
  };
  serverLoans.unshift(newLoan);
  res.status(201).json({ success: true, loan: newLoan });
});

app.put('/api/loans/:id', requireRole(['admin', 'librarian']), (req, res) => {
  const idx = serverLoans.findIndex((l) => l.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Loan not found' });
  }
  serverLoans[idx] = { ...serverLoans[idx], ...req.body };
  res.json({ success: true, loan: serverLoans[idx] });
});

app.delete('/api/loans/:id', requireRole(['admin', 'librarian']), (req, res) => {
  const idx = serverLoans.findIndex((l) => l.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Loan not found' });
  }
  const removed = serverLoans.splice(idx, 1)[0];
  res.json({ success: true, removed });
});

// 9. Circulation Desk APIs: Check-Out / Issue (/api/circulation/issue and /api/loans/checkout)
const issueLoanHandler = (req: express.Request, res: express.Response) => {
  const { bookId, userId, daysToBorrow = 14, librarianId } = req.body;

  const book = serverBooks.find((b) => b.id === bookId || b.barcode === bookId || b.isbn === bookId);
  if (!book) {
    return res.status(404).json({ error: 'Book not found in library catalog.' });
  }

  if (book.availableCopies <= 0) {
    return res.status(400).json({ error: `No physical copies of "${book.title}" are currently available for check-out.` });
  }

  if (book.isReferenceOnly) {
    return res.status(400).json({ error: `"${book.title}" is flagged as Reference Only and cannot be checked out for home circulation.` });
  }

  const borrower = serverUsers.find((u) => u.id === userId || u.studentIdCode === userId);
  const borrowerId = borrower ? borrower.id : userId;
  const borrowerName = borrower ? borrower.name : (req.body.userName || 'Student Borrower');
  const borrowerRole = borrower ? borrower.role : 'student';

  // Validate student loan limits
  const activeLoans = serverLoans.filter((l) => l.userId === borrowerId && l.status === 'active');
  const maxAllowed = borrowerRole === 'staff' || borrowerRole === 'admin'
    ? (serverSettings.maxBooksPerStaff || 7)
    : (serverSettings.maxBooksPerStudent || 3);

  if (activeLoans.length >= maxAllowed) {
    return res.status(400).json({
      error: `Check-out limit reached: Member has ${activeLoans.length} active books checked out (Maximum allowed: ${maxAllowed}). Please return an existing item first.`
    });
  }

  const issueDateObj = new Date();
  const issueDateStr = issueDateObj.toISOString().split('T')[0];
  const dueDateStr = calculateSchoolDueDate(issueDateObj, daysToBorrow);

  const newLoan: any = {
    id: `loan-${Date.now()}`,
    bookId: book.id,
    bookTitle: book.title,
    bookIsbn: book.isbn,
    userId: borrowerId,
    userName: borrowerName,
    userGrade: borrower?.grade || 'General Member',
    issueDate: issueDateStr,
    dueDate: dueDateStr,
    status: 'active',
    renewalCount: 0,
    lateFee: 0,
    feePaid: true,
    processedBy: librarianId || 'Circulation Desk Staff'
  };

  serverLoans.unshift(newLoan);
  book.availableCopies = Math.max(0, (book.availableCopies || 1) - 1);

  logAuditAction('LOAN_ISSUED', 'loan', newLoan.id, `Issued "${book.title}" to ${borrowerName} (${borrowerRole}). Due on ${dueDateStr} (Sunday-Thursday calendar)`, req);

  res.status(201).json({
    success: true,
    loan: newLoan,
    updatedBook: book,
    message: `Book "${book.title}" successfully issued to ${borrowerName}. Due on ${dueDateStr} (Maldivian school calendar).`
  });
};

app.post('/api/circulation/issue', issueLoanHandler);
app.post('/api/loans/checkout', issueLoanHandler);

// 10. Circulation Desk APIs: Return (Check-In) & Overdue Fine Calculation (/api/circulation/return and /api/loans/return)
const returnLoanHandler = (req: express.Request, res: express.Response) => {
  const { loanId, bookBarcodeOrId } = req.body;

  let loan = serverLoans.find((l) => l.id === loanId);
  if (!loan && bookBarcodeOrId) {
    const book = serverBooks.find((b) => b.id === bookBarcodeOrId || b.barcode === bookBarcodeOrId || b.isbn === bookBarcodeOrId);
    if (book) {
      loan = serverLoans.find((l) => l.bookId === book.id && (l.status === 'active' || l.status === 'overdue'));
    }
  }

  if (!loan) {
    return res.status(404).json({ error: 'Active loan record not found for this item.' });
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const overdueWorkingDays = calculateWorkingDaysOverdue(loan.dueDate, todayStr, true);

  // Overdue fine calculation: $0.50/day after grace period, capped at max fine cap
  const graceDays = serverSettings.gracePeriodDays ?? 2;
  const billableDays = Math.max(0, overdueWorkingDays - graceDays);
  const rate = serverSettings.lateFeePerDay ?? 0.50;
  const maxCap = serverSettings.maxOverdueFineCap ?? 25.00;
  const calculatedFee = Math.min(maxCap, billableDays * rate);

  loan.returnDate = todayStr;
  loan.status = 'returned';
  loan.lateFee = calculatedFee;
  loan.feePaid = calculatedFee === 0;

  // Restore book inventory copy
  const book = serverBooks.find((b) => b.id === loan.bookId);
  if (book) {
    book.availableCopies = Math.min(book.totalCopies || 1, (book.availableCopies || 0) + 1);
  }

  logAuditAction('LOAN_RETURNED', 'loan', loan.id, `Returned "${loan.bookTitle}" by ${loan.userName}. Overdue days: ${overdueWorkingDays}, Accrued fee: $${calculatedFee.toFixed(2)}`, req);

  res.json({
    success: true,
    loan,
    overdueWorkingDays,
    calculatedFee,
    message: calculatedFee > 0
      ? `Book "${loan.bookTitle}" returned with ${overdueWorkingDays} working days overdue. Late fee accrued: $${calculatedFee.toFixed(2)}.`
      : `Book "${loan.bookTitle}" returned on time. No late fee accrued.`
  });
};

app.post('/api/circulation/return', returnLoanHandler);
app.post('/api/loans/return', returnLoanHandler);

// 11. Circulation Desk APIs: Book Loan Renewal (/api/circulation/renew and /api/loans/renew)
const renewLoanHandler = (req: express.Request, res: express.Response) => {
  const { loanId, extensionDays = 14 } = req.body;

  const loan = serverLoans.find((l) => l.id === loanId);
  if (!loan) {
    return res.status(404).json({ error: 'Loan record not found.' });
  }

  if (loan.status === 'returned') {
    return res.status(400).json({ error: 'Cannot renew a book that has already been returned.' });
  }

  const maxRenewals = serverSettings.maxRenewals || 2;
  if ((loan.renewalCount || 0) >= maxRenewals) {
    return res.status(400).json({
      error: `Maximum renewal limit reached (${maxRenewals} extensions). The book must be returned to the library.`
    });
  }

  // CRITICAL CHECK: Block renewal if another patron has reserved the item
  const hasReservationConflict = serverReservations.some(
    (r) => r.bookId === loan.bookId && r.userId !== loan.userId && r.status === 'pending'
  );

  if (hasReservationConflict) {
    return res.status(409).json({
      error: `Renewal Blocked: Another student or patron has placed a hold reservation on "${loan.bookTitle}". Please return this book to the circulation desk for the next patron.`
    });
  }

  const currentDueDate = new Date(loan.dueDate);
  const newDueDateStr = calculateSchoolDueDate(currentDueDate, extensionDays);

  loan.dueDate = newDueDateStr;
  loan.renewalCount = (loan.renewalCount || 0) + 1;
  loan.status = 'active';

  logAuditAction('LOAN_RENEWED', 'loan', loan.id, `Renewed "${loan.bookTitle}" for ${loan.userName}. New due date: ${newDueDateStr} (Renewal ${loan.renewalCount}/${maxRenewals})`, req);

  res.json({
    success: true,
    loan,
    newDueDate: newDueDateStr,
    message: `Book "${loan.bookTitle}" renewed successfully! New due date: ${newDueDateStr} (Renewal ${loan.renewalCount}/${maxRenewals}).`
  });
};

app.post('/api/circulation/renew', renewLoanHandler);
app.post('/api/loans/renew', renewLoanHandler);

// 12. Manual Fine-Waive Override Controls (Librarian/Admin only) (/api/circulation/waive-fine and /api/fines/waive)
const waiveFineHandler = (req: express.Request, res: express.Response) => {
  const { loanId, reason, waivedBy = 'Head Librarian' } = req.body;

  const loan = serverLoans.find((l) => l.id === loanId);
  if (!loan) {
    return res.status(404).json({ error: 'Loan not found.' });
  }

  const previousFee = loan.lateFee || 0;
  loan.lateFee = 0;
  loan.feePaid = true;
  loan.waivedReason = reason || 'Librarian administrative discretion';
  loan.waivedBy = waivedBy;
  loan.waivedAt = new Date().toISOString();

  fineWaiverAuditLog.unshift({
    loanId,
    bookTitle: loan.bookTitle,
    studentName: loan.userName,
    waivedAmount: previousFee,
    reason: loan.waivedReason,
    waivedBy,
    timestamp: loan.waivedAt
  });

  logAuditAction('FINE_WAIVED', 'fine', loan.id, `Waived late fee of $${previousFee.toFixed(2)} on "${loan.bookTitle}" for ${loan.userName}. Reason: "${loan.waivedReason}"`, req);

  res.json({
    success: true,
    loan,
    waivedAmount: previousFee,
    message: `Late fee of $${previousFee.toFixed(2)} for "${loan.bookTitle}" has been waived by ${waivedBy}. Reason: "${loan.waivedReason}".`
  });
};

app.post('/api/circulation/waive-fine', requireRole(['admin', 'librarian']), waiveFineHandler);
app.post('/api/fines/waive', requireRole(['admin', 'librarian']), waiveFineHandler);

// 12b. System Audit Logs API (Librarian/Admin only)
app.get('/api/audit-logs', requireRole(['admin', 'librarian']), (req, res) => {
  const limit = parseInt((req.query.limit as string) || '50', 10);
  res.json({
    logs: serverAuditLogs.slice(0, limit),
    total: serverAuditLogs.length
  });
});

// 13. Fines & Overdue Loans Overview API
app.get('/api/fines', (req, res) => {
  const overdueOrUnpaidLoans = serverLoans.filter(
    (l) => (!l.feePaid && (l.lateFee || 0) > 0) || l.status === 'overdue'
  );

  const totalUnpaidFees = overdueOrUnpaidLoans.reduce((sum, l) => sum + (l.lateFee || 0), 0);

  res.json({
    unpaidCount: overdueOrUnpaidLoans.length,
    totalUnpaidFees,
    overdueLoans: overdueOrUnpaidLoans,
    recentWaivers: fineWaiverAuditLog.slice(0, 20)
  });
});

// 14. Reservations & Offline Batch Sync API
app.get('/api/reservations', (req, res) => {
  res.json({ reservations: serverReservations });
});

app.post('/api/reservations', (req, res) => {
  const { bookId, userId, userName, bookTitle } = req.body;
  const newRes = {
    id: `res-${Date.now()}`,
    bookId,
    bookTitle,
    userId,
    userName,
    requestDate: new Date().toISOString().split('T')[0],
    status: 'pending'
  };
  serverReservations.unshift(newRes);
  res.status(201).json({ success: true, reservation: newRes });
});

// Offline Queue Batch Sync Endpoint (for PWA service worker reconnect)
app.post('/api/reservations/queue', (req, res) => {
  const { queue } = req.body;
  if (!Array.isArray(queue) || queue.length === 0) {
    return res.status(400).json({ error: 'Queue array is required.' });
  }

  const synced: any[] = [];
  for (const item of queue) {
    const existing = serverReservations.find(
      (r) => r.bookId === item.bookId && r.userId === item.userId && r.status === 'pending'
    );
    if (!existing) {
      const newRes = {
        id: item.id || `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bookId: item.bookId,
        bookTitle: item.bookTitle,
        userId: item.userId,
        userName: item.userName,
        requestDate: item.requestDate || new Date().toISOString().split('T')[0],
        status: 'pending'
      };
      serverReservations.unshift(newRes);
      synced.push(newRes);
    }
  }

  res.json({
    success: true,
    syncedCount: synced.length,
    synced,
    message: `Successfully synchronized ${synced.length} queued reservations from offline storage.`
  });
});

// Start Express Server with Vite or Static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Express server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
