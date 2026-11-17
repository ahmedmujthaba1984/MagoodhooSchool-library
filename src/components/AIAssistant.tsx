import React, { useState } from 'react';
import {
  Sparkles, Bot, BookOpen, CheckCircle2,
  Brain, Lightbulb, RefreshCw, MessageSquare, Award, Camera, MapPin, Lock
} from 'lucide-react';
import { Book, UserProfile, Loan } from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { usePermission } from '../hooks/usePermission';
import {
  generateAiQuiz,
  matchLessonPlan,
  QuizData,
  CurriculumMatchResult,
  SCHOOL_GRADE_LEVELS,
} from '../services/ai';
import { BilingualAISearchCopilot } from './BilingualAISearchCopilot';
import { AiPanelSkeleton } from './Skeletons';

interface AIAssistantProps {
  books: Book[];
  loans?: Loan[];
  currentUser: UserProfile;
  onSelectBook?: (book: Book) => void;
  onNavigateTab?: (tab: string) => void;
  onOpenSmartCataloger?: () => void;
}

export const AIAssistant: React.FC<AIAssistantProps> = ({
  books,
  loans = [],
  currentUser,
  onSelectBook,
  onNavigateTab,
  onOpenSmartCataloger,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const { can, cannotReason } = usePermission(currentUser);
  const [activeSubTab, setActiveSubTab] = useState<'chat' | 'quiz' | 'recommendations'>('chat');

  // --- Quiz State ---
  const [selectedQuizBook, setSelectedQuizBook] = useState<Book | null>(books[0] || null);
  const [quizData, setQuizData] = useState<QuizData | null>(null);
  const [isQuizLoading, setIsQuizLoading] = useState(false);
  const [userAnswers, setUserAnswers] = useState<{ [qIndex: number]: number }>({});
  const [showResults, setShowResults] = useState(false);

  // --- AI Curriculum & Lesson Plan Matcher State ---
  const defaultGrade = SCHOOL_GRADE_LEVELS.includes(currentUser.grade as any)
    ? (currentUser.grade as string)
    : 'Grade 6';
  const [lessonGrade, setLessonGrade] = useState<string>(defaultGrade);
  const [lessonSubject, setLessonSubject] = useState<string>('Science & Nature');
  const [lessonTopic, setLessonTopic] = useState<string>('');
  const [availableOnly, setAvailableOnly] = useState<boolean>(true);
  const [matchResult, setMatchResult] = useState<CurriculumMatchResult | null>(null);
  const [isRecLoading, setIsRecLoading] = useState(false);

  const handleGenerateQuiz = async () => {
    if (!selectedQuizBook || isQuizLoading) return;
    setIsQuizLoading(true);
    setQuizData(null);
    setUserAnswers({});
    setShowResults(false);

    try {
      const data = await generateAiQuiz({
        bookTitle: selectedQuizBook.title,
        author: selectedQuizBook.author,
        language,
      });
      setQuizData(data);
    } catch (err: any) {
      toast.error(err?.message || 'Could not generate reading comprehension quiz.', 'Quiz Generator');
    } finally {
      setIsQuizLoading(false);
    }
  };

  const handleMatchLessonPlan = async () => {
    if (!can('ai:lesson_plan_matcher')) {
      toast.error(cannotReason('ai:lesson_plan_matcher'), 'Teacher / Admin Role Required');
      return;
    }
    if (isRecLoading) return;
    setIsRecLoading(true);
    setMatchResult(null);

    try {
      const topicPrompt = lessonTopic.trim()
        ? `${lessonSubject} — ${lessonTopic.trim()}`
        : lessonSubject;

      const result = await matchLessonPlan({
        grade: lessonGrade,
        syllabusTopic: topicPrompt,
        books,
        availableOnly,
        language,
      });

      setMatchResult(result);
    } catch (err: any) {
      toast.error(err?.message || 'Unable to match lesson plan right now.', 'Lesson Plan Matcher');
    } finally {
      setIsRecLoading(false);
    }
  };

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
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm border border-slate-800">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 px-3 py-0.5 rounded-md text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" /> AI OPAC & Curriculum Assistant
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
              Magoodhoo AI Smart Librarian
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed max-w-2xl">
              {language === 'dv'
                ? 'ދިވެހި އަދި އިނގިރޭސި ކެޓަލޮގް ސާޗް، ކަވަރު ވިޜަން ކެޓަލޮގިންގ، މުޤައްރަރު ފޮތް މެޗިންގ އަދި ކުއިޒް.'
                : 'Bilingual OPAC & admin query copilot, AI lesson-plan book matching, reading quizzes, and cover vision OCR.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {onOpenSmartCataloger && (
              <button
                type="button"
                onClick={onOpenSmartCataloger}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap shadow-sm"
              >
                <Camera className="w-4 h-4" />
                <span>{language === 'dv' ? 'އޭއައި ކަވަރު ސްކޭނަރ' : 'AI Vision Cataloger'}</span>
              </button>
            )}
            <div className="p-3 bg-slate-800/80 rounded-2xl border border-slate-700 text-center min-w-[130px]">
              <Bot className="w-6 h-6 text-emerald-400 mx-auto mb-1" />
              <div className="text-xs font-black text-white">Libby AI</div>
              <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider mt-0.5">
                {language === 'dv' ? 'މަގޫދޫ ސްކޫލް' : 'Ready & Bilingual'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mode Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setActiveSubTab('chat')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'chat'
              ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          {language === 'dv' ? '1. އޭއައި ކެޓަލޮގް ސާޗް ("ލިބީ")' : '1. Bilingual OPAC & Admin Copilot'}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('recommendations')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'recommendations'
              ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Lightbulb className="w-4 h-4" />
          {language === 'dv' ? '2. ފިލާވަޅާ ގުޅޭ ފޮތްތައް ހޯދުން' : '2. Match to Lesson Plan'}
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('quiz')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
            activeSubTab === 'quiz'
              ? 'bg-slate-900 dark:bg-emerald-700 text-white shadow-sm'
              : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700'
          }`}
        >
          <Brain className="w-4 h-4" />
          {language === 'dv' ? '3. އޭއައި ފޮތުގެ ކުއިޒް' : '3. AI Reading Quiz Check'}
        </button>
      </div>

      {/* --- SUBTAB 1: BILINGUAL OPAC & ADMIN COPILOT --- */}
      {activeSubTab === 'chat' && (
        <BilingualAISearchCopilot
          books={books}
          loans={loans}
          currentUser={currentUser}
          onSelectBook={onSelectBook}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* --- SUBTAB 2: AI CURRICULUM & LESSON PLAN MATCHER --- */}
      {activeSubTab === 'recommendations' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          {!can('ai:lesson_plan_matcher') ? (
            <div className="p-6 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex items-start gap-3">
              <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="font-black text-slate-900 dark:text-white">
                  {language === 'dv' ? 'މުދައްރިސުންނާއި އެޑްމިނުންނަށް ޚާއްޞަ' : 'Faculty & Super Admin Tool'}
                </div>
                <p className="text-slate-600 dark:text-slate-300">
                  {cannotReason('ai:lesson_plan_matcher')}
                </p>
              </div>
            </div>
          ) : (
            <>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              {language === 'dv' ? 'މުޤައްރަރާއި ފިލާވަޅާ ގުޅޭ ފޮތްތައް ("Match to Lesson Plan")' : 'Match to Lesson Plan — Curriculum & Resource Finder'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {language === 'dv'
                ? 'ގްރޭޑް (LKG އިން Grade 10) އަދި ފިލާވަޅުގެ މައުޟޫޢު ޖެއްސެވުމުން ލައިބްރަރީގައި ހުރި އެންމެ ގުޅޭ ފޮތްތައް ދައްކާދޭނެއެވެ.'
                : 'Paste a curriculum topic or learning objective to rank matching physical books, reference kits, and library resources with shelf call numbers.'}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">
                {language === 'dv' ? 'ގްރޭޑް (LKG – Grade 10):' : 'Target Grade Level:'}
              </label>
              <select
                value={lessonGrade}
                onChange={e => setLessonGrade(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                {SCHOOL_GRADE_LEVELS.map(grade => (
                  <option key={grade} value={grade}>{grade}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">
                {language === 'dv' ? 'މާއްދާ:' : 'Subject Area:'}
              </label>
              <select
                value={lessonSubject}
                onChange={e => setLessonSubject(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100"
              >
                <option value="Science & Nature">Science &amp; Environment</option>
                <option value="Dhivehi Literature">Dhivehi Language &amp; Literature</option>
                <option value="Islamic Studies">Islamic Studies &amp; Quran</option>
                <option value="English Language">English Reading &amp; Writing</option>
                <option value="Social Studies & History">Maldivian History &amp; Social Studies</option>
                <option value="Mathematics & Coding">Mathematics &amp; Coding</option>
                <option value="Reference & Atlases">Reference &amp; Atlases</option>
              </select>
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">
                {language === 'dv' ? 'ފިލާވަޅުގެ މައުޟޫޢު ނުވަތަ އަމާޒު:' : 'Curriculum Topic or Learning Objective:'}
              </label>
              <input
                type="text"
                placeholder={language === 'dv' ? 'މިސާލު: މުރަކަ ފަރުތަކުގެ ތިމާވެށި، އިސްލާމީ ތާރީޚް...' : 'e.g. Maldivian coral reef ecosystems and marine conservation'}
                value={lessonTopic}
                onChange={e => setLessonTopic(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-xs font-bold text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={availableOnly}
                onChange={e => setAvailableOnly(e.target.checked)}
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                {language === 'dv'
                  ? 'މިވަގުތު ހަރުގަނޑުގައި ލިބެން ހުރި ފޮތްތައް އެކަނި'
                  : 'Only include titles currently available on shelf'}
              </span>
            </label>

            <button
              type="button"
              onClick={handleMatchLessonPlan}
              disabled={isRecLoading}
              className="px-6 py-3 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isRecLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {language === 'dv' ? 'މުޤައްރަރާ ގުޅޭ ފޮތްތައް ހޯދަނީ...' : 'Matching Lesson Plan...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-200" />
                  {language === 'dv' ? 'ފިލާވަޅާ ގުޅޭ ފޮތްތައް ހޯދާ' : 'Match to Lesson Plan'}
                </>
              )}
            </button>
          </div>

          {isRecLoading && <AiPanelSkeleton rows={3} />}

          {!isRecLoading && matchResult && (
            <div className="space-y-4">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl space-y-1">
                <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  {language === 'dv' ? 'މުޤައްރަރު މެޗް ޚުލާޞާ' : 'Lesson Alignment Summary'}
                </div>
                <p className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-100 leading-relaxed">
                  {matchResult.summary}
                </p>
              </div>

              {matchResult.matches.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {matchResult.matches.map((match) => {
                    const matchedBook = books.find(b => b.id === match.bookId);
                    return (
                      <div
                        key={`${match.bookId}-${match.title}`}
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                              <bdi>{match.title}</bdi>
                            </h4>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono tabular-nums shrink-0 ${
                              match.availableCopies > 0
                                ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300'
                                : 'bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300'
                            }`}>
                              <bdi>{match.availableCopies} avail</bdi>
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex flex-wrap items-center gap-1.5">
                            <span><bdi>{match.author}</bdi></span>
                            <span>·</span>
                            <span>{match.mediaType}</span>
                            <span>·</span>
                            <span className="font-mono"><bdi>{match.ddcCallNumber}</bdi></span>
                          </div>
                          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed pt-1">
                            {match.relevanceReason}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                          <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <bdi>{match.shelfLocation}</bdi>
                          </span>
                          {matchedBook && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onSelectBook) onSelectBook(matchedBook);
                                else if (onNavigateTab) onNavigateTab('catalog');
                              }}
                              className="px-3 py-1 rounded-lg bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-[11px] font-bold transition cursor-pointer shrink-0"
                            >
                              {language === 'dv' ? 'ކެޓަލޮގުން ބައްލަވާ' : 'Open in Catalog'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
                  {matchResult.text}
                </div>
              )}
            </div>
          )}
            </>
          )}
        </div>
      )}

      {/* --- SUBTAB 3: AI READING QUIZ --- */}
      {activeSubTab === 'quiz' && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm space-y-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Brain className="w-5 h-5 text-emerald-700 dark:text-emerald-400" />
              {language === 'dv' ? 'އޭއައި ފޮތުގެ ކުއިޒް އުފެއްދުން' : 'Instant AI Reading Check & Quiz Generator'}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {language === 'dv'
                ? 'ލައިބްރަރީ ކެޓަލޮގުން ފޮތެއް އިޚްތިޔާރުކުރައްވައިގެން ކުއިޒް ސުވާލުތައް އުފައްދަވާ!'
                : 'Select any book from the school library catalog to generate custom comprehension questions.'}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-slate-50 dark:bg-slate-950/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                {language === 'dv' ? 'ފޮތް އިޚްތިޔާރުކުރައްވާ:' : 'Select Catalog Title:'}
              </label>
              <select
                value={selectedQuizBook?.id || ''}
                onChange={(e) => {
                  const found = books.find(b => b.id === e.target.value);
                  if (found) setSelectedQuizBook(found);
                }}
                className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
              >
                {books.map(b => (
                  <option key={b.id} value={b.id}>{b.title} — {b.author} ({b.category})</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleGenerateQuiz}
              disabled={isQuizLoading || !selectedQuizBook}
              className="bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white px-6 py-3 rounded-xl font-bold text-xs sm:text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {isQuizLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  {language === 'dv' ? 'ތައްޔާރުކުރަނީ...' : 'Generating Quiz...'}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  {language === 'dv' ? 'ކުއިޒް އުފައްދަވާ' : 'Generate Quiz'}
                </>
              )}
            </button>
          </div>

          {isQuizLoading && <AiPanelSkeleton rows={3} />}

          {!isQuizLoading && quizData && (
            <div className="space-y-6 bg-slate-50/70 dark:bg-slate-950/50 p-6 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-emerald-950 dark:text-emerald-100 space-y-1">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  {language === 'dv' ? 'ޚުލާޞާ' : 'Overview Summary'}
                </div>
                <p className="text-xs sm:text-sm font-bold">{quizData.summary}</p>
              </div>

              <div className="space-y-5">
                {quizData.questions.map((q, qIdx) => (
                  <div key={qIdx} className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
                    <p className="font-black text-sm text-slate-900 dark:text-white">
                      <bdi className="font-mono tabular-nums">{qIdx + 1}.</bdi> {q.question}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, optIdx) => {
                        const isSelected = userAnswers[qIdx] === optIdx;
                        const isCorrect = q.answerIndex === optIdx;

                        let btnStyle = 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 font-bold';
                        if (showResults) {
                          if (isCorrect) btnStyle = 'bg-emerald-100 dark:bg-emerald-900/50 border-emerald-400 text-emerald-950 dark:text-emerald-100 font-black';
                          else if (isSelected && !isCorrect) btnStyle = 'bg-rose-100 dark:bg-rose-900/50 border-rose-300 text-rose-950 dark:text-rose-100 font-black';
                        } else if (isSelected) {
                          btnStyle = 'bg-slate-900 dark:bg-emerald-700 border-slate-900 dark:border-emerald-700 text-white font-black';
                        }

                        return (
                          <button
                            key={optIdx}
                            type="button"
                            disabled={showResults}
                            onClick={() => setUserAnswers(prev => ({ ...prev, [qIdx]: optIdx }))}
                            className={`p-3 rounded-xl border text-xs transition flex items-center justify-between cursor-pointer ${btnStyle}`}
                          >
                            <span>{opt}</span>
                            {showResults && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 ms-2" />}
                          </button>
                        );
                      })}
                    </div>

                    {showResults && (
                      <p className="text-xs text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 mt-2 font-bold">
                        <strong>{language === 'dv' ? 'ސަބަބު:' : 'Explanation:'}</strong> {q.explanation}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {!showResults ? (
                <button
                  type="button"
                  onClick={() => setShowResults(true)}
                  disabled={Object.keys(userAnswers).length < quizData.questions.length}
                  className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white font-bold text-sm py-3 rounded-xl transition cursor-pointer"
                >
                  {language === 'dv' ? 'ޖަވާބުތައް ޗެކްކުރައްވާ' : 'Submit & Check Quiz Answers'}
                </button>
              ) : (
                <div className="p-5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-center space-y-2">
                  <Award className="w-8 h-8 text-emerald-700 dark:text-emerald-400 mx-auto" />
                  <div className="text-lg font-black text-slate-900 dark:text-white font-mono tabular-nums">
                    {language === 'dv' ? 'ނަތީޖާ:' : 'Score:'} <bdi>{calculateQuizScore()} / {quizData.questions.length}</bdi>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
