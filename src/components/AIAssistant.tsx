import React, { useState } from 'react';
import {
  Sparkles, Bot, Send, BookOpen, HelpCircle, CheckCircle2,
  Brain, Lightbulb, RefreshCw, MessageSquare, Award, ArrowRight,
  BookMarked, QrCode, Search, FileText
} from 'lucide-react';
import { Book, UserProfile } from '../types';
import { useLanguage } from '../lib/i18n';

interface AIAssistantProps {
  books: Book[];
  currentUser: UserProfile;
  onSelectBook?: (book: Book) => void;
  onNavigateTab?: (tab: string) => void;
}

interface QuizQuestion {
  question: string;
  options: string[];
  answerIndex: number;
  explanation: string;
}

interface QuizData {
  summary: string;
  questions: QuizQuestion[];
  discussionPrompts: string[];
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  books,
  currentUser,
  onSelectBook,
  onNavigateTab
}) => {
  const { language, t, isRtl } = useLanguage();
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'quiz' | 'recommendations'>('chat');

  // --- Chat State ---
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([
    {
      role: 'assistant',
      text: language === 'dv'
        ? `އައްސަލާމް އަލައިކުމް ${currentUser.name}! އަޅުގަނޑަކީ **ލިބީ**، މަގޫދޫ ސުކޫލް ލައިބްރަރީގެ އޭއައި ލައިބްރޭރިއަން. 📚✨\n\nމިއަދު ކިހިނެއްތޯ އެހީތެރިވެދޭންވީ؟ ފޮތްތަކުގެ މަޢުލޫމާތާއި، ފޮތް ހުރި ރެކު އަދި ކިޔަން ރަނގަޅު ފޮތްތަކުގެ އިރުޝާދު ހޯއްދެވުމަށް ސުވާލުކުރައްވާ!`
        : `Hello ${currentUser.name}! I'm **Libby**, your AI Smart Librarian at Magoodhoo School Library. 📚✨\n\nHow can I help you today? You can ask me for personalized book recommendations, book summaries, shelf locations, or study guides!`
    }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // --- Quiz State ---
  const [selectedQuizBook, setSelectedQuizBook] = useState<Book | null>(books[0] || null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<{ [qIndex: number]: number }>({});
  const [showResults, setShowResults] = useState(false);

  // --- Recommendation State ---
  const [recGrade, setRecGrade] = useState(currentUser.grade || 'Grade 6');
  const [recGenre, setRecGenre] = useState('Fantasy & Adventure');
  const [recTopic, setRecTopic] = useState('');
  const [recResult, setRecResult] = useState<string | null>(null);
  const [isRecLoading, setIsRecLoading] = useState(false);

  // Handle Chat Submit
  const handleSendChat = async (inputPrompt?: string) => {
    const textToSend = inputPrompt || chatInput;
    if (!textToSend.trim() || isChatLoading) return;

    const userMsg = { role: 'user' as const, text: textToSend };
    setChatMessages(prev => [...prev, userMsg]);
    if (!inputPrompt) setChatInput('');
    setIsChatLoading(true);

    try {
      const res = await fetch('/api/ai/ask-librarian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: textToSend,
          catalogContext: books.map(b => ({
            title: b.title,
            author: b.author,
            category: b.category,
            shelfLocation: b.shelfLocation,
            availableCopies: b.availableCopies
          })),
          userGrade: currentUser.grade || currentUser.role,
          language
        })
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setChatMessages(prev => [...prev, { role: 'assistant', text: data.text }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Error: ${data.error || 'Failed to get response.'}` }]);
      }
    } catch (err: any) {
      setChatMessages(prev => [...prev, { role: 'assistant', text: `⚠️ Connection error: ${err.message || 'Server unreachable.'}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  // Handle Quiz Generator
  const handleGenerateQuiz = async () => {
    if (!selectedQuizBook || isQuizLoading) return;
    setIsQuizLoading(true);
    setQuizData(null);
    setUserAnswers({});
    setShowResults(false);

    try {
      const res = await fetch('/api/ai/quiz-generator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookTitle: selectedQuizBook.title,
          author: selectedQuizBook.author
        })
      });

      const data = await res.json();
      if (res.ok && data.questions) {
        setQuizData(data);
      } else {
        alert(`Failed to generate quiz: ${data.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      alert(`Error generating quiz: ${err.message}`);
    } finally {
      setIsQuizLoading(false);
    }
  };

  // Handle Recommendation Generator
  const handleGenerateRecommendations = async () => {
    if (isRecLoading) return;
    setIsRecLoading(true);
    setRecResult(null);

    const prompt = `Recommend 4 books for a student in ${recGrade} who enjoys ${recGenre} and is interested in "${recTopic || 'general reading'}".
Check our catalog first:
${JSON.stringify(books.map(b => ({ title: b.title, author: b.author, category: b.category, shelf: b.shelfLocation })))}
Format the recommendations clearly with bullet points and brief reasons why they'd love each book.`;

    try {
      const res = await fetch('/api/ai/ask-librarian', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: prompt,
          catalogContext: books,
          userGrade: recGrade
        })
      });

      const data = await res.json();
      if (res.ok && data.text) {
        setRecResult(data.text);
      } else {
        setRecResult(`Error: ${data.error || 'Failed to generate recommendations.'}`);
      }
    } catch (err: any) {
      setRecResult(`Connection error: ${err.message}`);
    } finally {
      setIsRecLoading(false);
    }
  };

  // Calculate Quiz Score
  const calculateQuizScore = () => {
    if (!quizData) return 0;
    let score = 0;
    quizData.questions.forEach((q, idx) => {
      if (userAnswers[idx] === q.answerIndex) score += 1;
    });
    return score;
  };

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-purple-500/30 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-purple-500/20 text-purple-300 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" /> AI-Powered Intelligence Assistant
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight">
              Magoodhoo AI Smart Librarian & Study Center
            </h2>
            <p className="text-sm text-purple-200/80 max-w-2xl">
              Powered by Google Gemini 3.6 Flash. Get instant book recommendations, ask questions about reading materials, or generate interactive comprehension quizzes!
            </p>
          </div>

          <div className="p-3 bg-purple-500/10 backdrop-blur-md rounded-2xl border border-purple-400/20 text-center min-w-[140px]">
            <Bot className="w-8 h-8 text-purple-300 mx-auto mb-1 animate-pulse" />
            <div className="text-xs font-bold text-white">Libby AI</div>
            <div className="text-[10px] text-purple-300 font-semibold uppercase">Online & Ready</div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'chat'
              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          1. Ask Smart Librarian ("Libby")
        </button>

        <button
          onClick={() => setActiveSubTab('quiz')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'quiz'
              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Brain className="w-4 h-4" />
          2. AI Reading Quiz & Comprehension Check
        </button>

        <button
          onClick={() => setActiveSubTab('recommendations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all whitespace-nowrap ${
            activeSubTab === 'recommendations'
              ? 'bg-pink-600 text-white shadow-lg shadow-pink-600/30'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          3. Personal AI Reading Matcher
        </button>
      </div>

      {/* --- SUBTAB 1: SMART LIBRARIAN CHAT --- */}
      {activeSubTab === 'chat' && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col h-[580px]">
          
          {/* Preset Starter Prompts */}
          <div className="bg-slate-50 border-b border-slate-200 p-3.5 flex items-center gap-2 overflow-x-auto">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" /> Try Asking:
            </span>
            <button
              onClick={() => handleSendChat('What are 3 popular fantasy or mystery books available in our school library?')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs text-slate-700 font-semibold transition whitespace-nowrap shadow-sm"
            >
              📖 Recommend Fantasy Books
            </button>
            <button
              onClick={() => handleSendChat('Which books are available in the Science or Technology sections?')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs text-slate-700 font-semibold transition whitespace-nowrap shadow-sm"
            >
              🔬 Science & Tech Books
            </button>
            <button
              onClick={() => handleSendChat('What are the borrowing rules for reference books vs general books?')}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-purple-50 border border-slate-200 hover:border-purple-300 text-xs text-slate-700 font-semibold transition whitespace-nowrap shadow-sm"
            >
              📜 Library Rules & Fines
            </button>
          </div>

          {/* Chat Messages Area */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50">
            {chatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-none shadow-md font-medium'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-sm space-y-2'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center font-bold text-xs shadow shrink-0">
                    {currentUser.name.charAt(0)}
                  </div>
                )}
              </div>
            ))}

            {isChatLoading && (
              <div className="flex gap-3 justify-start items-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow shrink-0">
                  <Bot className="w-4 h-4 animate-bounce" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-500 font-semibold shadow-sm flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" /> Libby is analyzing catalog and thinking...
                </div>
              </div>
            )}
          </div>

          {/* Chat Input Bar */}
          <div className="p-3.5 bg-white border-t border-slate-200">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendChat();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask Libby anything about books, authors, genres, or library rules..."
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-3 text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-purple-500 focus:bg-white transition"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || isChatLoading}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-5 py-3 rounded-2xl text-xs sm:text-sm font-bold transition flex items-center gap-2 shadow-md active:scale-95"
              >
                <span>Send</span>
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* --- SUBTAB 2: AI READING QUIZ --- */}
      {activeSubTab === 'quiz' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Brain className="w-5 h-5 text-indigo-600" /> Instant AI Reading Check & Quiz Generator
            </h3>
            <p className="text-xs text-slate-500">
              Select any book from the school library catalog to generate custom multiple-choice questions and discussion prompts!
            </p>
          </div>

          {/* Book Selector */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Select Catalog Title:</label>
              <select
                value={selectedQuizBook?.id || ''}
                onChange={(e) => {
                  const found = books.find(b => b.id === e.target.value);
                  if (found) setSelectedQuizBook(found);
                }}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
              >
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title} — {b.author} ({b.category})</option>
                ))}
              </select>
            </div>

            <button
              onClick={handleGenerateQuiz}
              disabled={isQuizLoading || !selectedQuizBook}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 shadow-md disabled:opacity-50"
            >
              {isQuizLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Generating Quiz...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-200" /> Generate Quiz Questions
                </>
              )}
            </button>
          </div>

          {/* Render Quiz */}
          {quizData && (
            <div className="space-y-6 bg-slate-50/70 p-6 rounded-2xl border border-slate-200">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 space-y-1">
                <div className="text-xs font-bold uppercase tracking-wider text-indigo-600">Overview Summary</div>
                <p className="text-xs sm:text-sm font-medium">{quizData.summary}</p>
              </div>

              {/* Questions */}
              <div className="space-y-6">
                <h4 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Comprehension Questions:</h4>
                {quizData.questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <p className="font-bold text-sm text-slate-900">
                      {qIdx + 1}. {q.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = userAnswers[qIdx] === optIdx;
                        const isCorrect = q.answerIndex === optIdx;

                        let btnStyle = 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100';
                        if (showResults) {
                          if (isCorrect) btnStyle = 'bg-emerald-100 border-emerald-400 text-emerald-900 font-bold';
                          else if (isSelected && !isCorrect) btnStyle = 'bg-rose-100 border-rose-300 text-rose-900 font-bold';
                        } else if (isSelected) {
                          btnStyle = 'bg-indigo-100 border-indigo-400 text-indigo-900 font-bold';
                        }

                        return (
                          <button
                            key={optIdx}
                            disabled={showResults}
                            onClick={() => setUserAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                            className={`p-3 rounded-xl border text-xs text-left transition flex items-center justify-between ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {showResults && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ml-2" />}
                          </button>
                        );
                      })}
                    </div>

                    {showResults && (
                      <p className="text-xs text-slate-600 bg-slate-100 p-2.5 rounded-xl border border-slate-200 mt-2">
                        💡 <strong>Explanation:</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Quiz Actions */}
              {!showResults ? (
                <button
                  onClick={() => setShowResults(true)}
                  disabled={Object.keys(userAnswers).length < quizData.questions.length}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition shadow-md"
                >
                  Submit & Check Quiz Answers
                </button>
              ) : (
                <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-center space-y-2">
                  <Award className="w-8 h-8 text-emerald-600 mx-auto" />
                  <div className="text-lg font-black text-slate-900">
                    Score: {calculateQuizScore()} / {quizData.questions.length}
                  </div>
                  <p className="text-xs text-slate-600 font-medium">Great job testing your reading comprehension!</p>
                </div>
              )}

              {/* Discussion Prompts */}
              {quizData.discussionPrompts && quizData.discussionPrompts.length > 0 && (
                <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-purple-700 flex items-center gap-1.5">
                    <Lightbulb className="w-4 h-4 text-purple-600" /> Book Club & Classroom Discussion Prompts:
                  </div>
                  <ul className="list-disc list-inside text-xs text-slate-700 space-y-1">
                    {quizData.discussionPrompts.map((p, idx) => (
                      <li key={idx} className="font-medium">{p}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* --- SUBTAB 3: RECOMMENDATIONS --- */}
      {activeSubTab === 'recommendations' && (
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xl space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-pink-600" /> Personal AI Reading Matcher
            </h3>
            <p className="text-xs text-slate-500">
              Tell Libby your favorite genres and interests, and Gemini will scan Oakridge Library catalog to build a custom reading plan!
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase">Grade / Reading Level:</label>
              <select
                value={recGrade}
                onChange={e => setRecGrade(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800"
              >
                <option value="Grade 1-3">Primary (Grade 1 - 3)</option>
                <option value="Grade 4-6">Elementary (Grade 4 - 6)</option>
                <option value="Grade 7-9">Middle School (Grade 7 - 9)</option>
                <option value="Grade 10-12">High School (Grade 10 - 12)</option>
                <option value="Teacher / Parent">Teacher & Staff</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase">Preferred Genre:</label>
              <select
                value={recGenre}
                onChange={e => setRecGenre(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-bold text-slate-800"
              >
                <option value="Fantasy & Adventure">Fantasy & Adventure</option>
                <option value="Science & Space">Science & Space</option>
                <option value="History & Biography">History & Biography</option>
                <option value="Mystery & Suspense">Mystery & Suspense</option>
                <option value="Classics & Literature">Classics & Literature</option>
                <option value="Comics & Graphic Novels">Comics & Graphic Novels</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 uppercase">Specific Topic / Interest Keyword:</label>
              <input
                type="text"
                placeholder="e.g. Dragons, Space Exploration, World War 2..."
                value={recTopic}
                onChange={e => setRecTopic(e.target.value)}
                className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs font-medium text-slate-800 placeholder-slate-400"
              />
            </div>
          </div>

          <button
            onClick={handleGenerateRecommendations}
            disabled={isRecLoading}
            className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold text-sm py-3.5 rounded-2xl transition shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRecLoading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Matching Books with AI...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-pink-200" /> Generate Personal Reading Match
              </>
            )}
          </button>

          {recResult && (
            <div className="p-6 bg-slate-900 text-white rounded-3xl border border-slate-800 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="text-sm font-bold text-pink-400 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" /> AI Personalized Recommendations
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Matched by Libby AI</span>
              </div>
              <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                {recResult}
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
