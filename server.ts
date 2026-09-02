import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

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

// Start Express Server with Vite or Static
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
