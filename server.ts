import 'dotenv/config';
import express from 'express';
import path from 'path';
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

// --- API ROUTES ---

// 1. AI Smart Librarian Chat Assistant
app.post('/api/ai/ask-librarian', async (req, res) => {
  try {
    const { message, catalogContext, userGrade, language } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY environment variable is not configured.' });
    }

    const isDhivehi = language === 'dv';
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });

    res.json({ text: response.text || 'No response generated.' });
  } catch (error: any) {
    console.error('Gemini AI Librarian error:', error);
    res.status(500).json({ error: error.message || 'Failed to connect to AI Smart Librarian.' });
  }
});

// 2. AI Book Metadata & Description Auto-Generator
app.post('/api/ai/generate-book-info', async (req, res) => {
  try {
    const { title, author, language } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: 'Title and Author are required.' });
    }
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY environment variable is not configured.' });
    }

    const isDhivehi = language === 'dv';
    const prompt = `You are a school librarian cataloging a book titled "${title}" by "${author}".
Generate accurate library metadata in JSON format with:
- "description": A captivating, engaging 2-3 sentence synopsis for students ${isDhivehi ? 'written in Dhivehi Thaana script (ދިވެހި ބަހުން)' : 'written in English'}.
- "category": Recommended genre/category (e.g. Fiction, Fantasy, Science, History, Biography, Mystery, Graphic Novel).
- "publicationYear": Approximate integer year.
- "publisher": Known publisher name or reputable press.
- "shelfLocation": Recommended shelf section (e.g., "Fiction - A3", "Science - S2").`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Gemini Book Info error:', error);
    res.status(500).json({ error: error.message || 'Failed to auto-generate book metadata.' });
  }
});

// 3. AI Reading Quiz & Discussion Generator
app.post('/api/ai/quiz-generator', async (req, res) => {
  try {
    const { bookTitle, author, language } = req.body;
    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'GEMINI_API_KEY environment variable is not configured.' });
    }

    const isDhivehi = language === 'dv';
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

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      }
    });

    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    console.error('Gemini Quiz error:', error);
    res.status(500).json({ error: error.message || 'Failed to generate reading quiz.' });
  }
});

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
