import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '10mb' }));

// Initialize server-side Gemini client using GEMINI_API_KEY
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is missing.');
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
    const { message, catalogContext, userGrade } = req.body;
    const ai = getGeminiClient();

    const prompt = `You are "Libby", the friendly AI Smart Librarian for Magoodhoo School Library.
You are assisting a student/teacher in Grade/Role: ${userGrade || 'General Reader'}.
Question or Request: "${message}"

Available Catalog Books (Sample Context):
${JSON.stringify((catalogContext || []).map((b: any) => ({ title: b.title, author: b.author, category: b.category, location: b.shelfLocation, available: b.availableCopies > 0 })))}

Guidelines:
- Provide helpful, enthusiastic, age-appropriate guidance.
- Suggest specific books from the catalog when relevant, mentioning author and shelf location.
- Keep output nicely formatted using markdown bold text and bullet points.`;

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
    const { title, author } = req.body;
    if (!title || !author) {
      return res.status(400).json({ error: 'Title and Author are required.' });
    }
    const ai = getGeminiClient();

    const prompt = `You are a school librarian cataloging a book titled "${title}" by "${author}".
Generate accurate library metadata in JSON format with:
- "description": A captivating, engaging 2-3 sentence synopsis for students.
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
    const { bookTitle, author } = req.body;
    const ai = getGeminiClient();

    const prompt = `Create a 3-question reading comprehension quiz and 2 classroom discussion prompts for the book "${bookTitle}" by "${author}".
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
