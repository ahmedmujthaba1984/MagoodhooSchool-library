import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json({ limit: '10mb' }));

// Helper to initialize Gemini
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
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

// 1. Libby AI Assistant Handler
app.post('/api/ai/ask-librarian', async (req, res) => {
  try {
    const { message, catalogContext, userGrade, language } = req.body;
    const ai = getGeminiClient();

    const isDhivehi = language === 'dv';
    const langInstruction = isDhivehi
      ? 'CRITICAL MANDATE: Write your response ENTIRELY in natural, fluent, and grammatically correct Dhivehi language (ދިވެހި ބަހުން) using clean Thaana script.'
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

    res.setHeader('Content-Type', 'application/json');
    res.json({ text: response.text || 'No response generated.' });
  } catch (error: any) {
    console.error('Gemini AI Librarian Vercel error:', error);
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Failed to connect to AI Smart Librarian.' });
  }
});

// 2. Book Info Auto-Generator
app.post('/api/ai/generate-book-info', async (req, res) => {
  try {
    const { title, author, language } = req.body;
    const ai = getGeminiClient();

    const isDhivehi = language === 'dv';
    const prompt = `You are a school librarian cataloging a book titled "${title}" by "${author}".
Generate accurate library metadata in JSON format with:
- "description": A captivating 2-3 sentence synopsis for students ${isDhivehi ? 'written in Dhivehi Thaana script (ދިވެހި ބަހުން)' : 'written in English'}.
- "category": Recommended genre/category.
- "publicationYear": Integer year.
- "publisher": Publisher name.
- "shelfLocation": Recommended shelf section.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    res.setHeader('Content-Type', 'application/json');
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Failed to auto-generate book metadata.' });
  }
});

// 3. Quiz Generator
app.post('/api/ai/quiz-generator', async (req, res) => {
  try {
    const { bookTitle, author, language } = req.body;
    const ai = getGeminiClient();

    const isDhivehi = language === 'dv';
    const langPrompt = isDhivehi
      ? 'CRITICAL: Generate ALL JSON fields ENTIRELY in fluent Dhivehi language (ދިވެހި ބަހުން) using Thaana script.'
      : 'Generate all JSON fields in clear English.';

    const prompt = `Create a 3-question reading comprehension quiz and 2 classroom discussion prompts for the book "${bookTitle}" by "${author}".
${langPrompt}

Return a JSON object with:
- "summary": A brief 2-sentence theme summary.
- "questions": Array of 3 items, each having:
    - "question": string
    - "options": Array of 4 strings
    - "answerIndex": number (0-3)
    - "explanation": string
- "discussionPrompts": Array of 2 questions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' }
    });

    res.setHeader('Content-Type', 'application/json');
    res.json(JSON.parse(response.text || '{}'));
  } catch (error: any) {
    res.setHeader('Content-Type', 'application/json');
    res.status(500).json({ error: error.message || 'Failed to generate reading quiz.' });
  }
});

export default app;
