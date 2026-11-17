import React, { useState, useEffect } from 'react';
import {
  Bot, Send, RefreshCw, AlertTriangle, Mic, MicOff, BarChart3,
  MessageSquare, Filter, CheckCircle2
} from 'lucide-react';
import { Book, Loan, UserProfile } from '../types';
import {
  opacNaturalSearch,
  fetchAiServiceStatus,
  OpacSearchResponse,
  AiServiceStatus,
} from '../services/ai';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { useVoiceAssistant } from '../hooks/useVoiceAssistant';
import { BookCoverFallback } from './BookCoverFallback';
import { ReminderDraftModal, ReminderTarget } from './ReminderDraftModal';

interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
  structured?: OpacSearchResponse;
  matchedBooks?: Book[];
  matchedLoans?: Loan[];
}

interface BilingualAISearchCopilotProps {
  books: Book[];
  loans: Loan[];
  currentUser: UserProfile;
  onSelectBook?: (book: Book) => void;
  onNavigateTab?: (tab: string) => void;
}

export const BilingualAISearchCopilot: React.FC<BilingualAISearchCopilotProps> = ({
  books,
  loans,
  currentUser,
  onSelectBook,
  onNavigateTab,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();

  const [aiStatus, setAiStatus] = useState<AiServiceStatus | null>(null);
  const [queryInput, setQueryInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [reminderTarget, setReminderTarget] = useState<ReminderTarget | null>(null);

  const [messages, setMessages] = useState<ChatTurn[]>([
    {
      role: 'assistant',
      text:
        language === 'dv'
          ? `އައްސަލާމް ޢަލައިކުމް ${currentUser.name}! އަޅުގަނޑަކީ ލިބީ — ދިވެހި އަދި އިނގިރޭސި ބަހުން ކެޓަލޮގާއި ސާކިއުލޭޝަން ރެކޯޑް ހޯދާދޭ އޭއައި އެހީތެރިޔާ.\n\nތިރީގައިވާ މިސާލު ސުވާލެއް ޖައްސަވާލައްވާ ނުވަތަ އަމިއްލަ ސުވާލެއް ލިޔުއްވާ!`
          : `Hello ${currentUser.name}! I'm Libby, your Bilingual OPAC & Admin Copilot.\n\nAsk natural queries in English or Dhivehi about shelf availability, grade levels, overdue student loans, or term circulation analytics.`,
    },
  ]);

  useEffect(() => {
    void fetchAiServiceStatus().then(setAiStatus);
  }, []);

  const { isRecording, isTranscribing, toggleRecording } = useVoiceAssistant({
    language: language === 'dv' ? 'dv' : 'en',
    onTranscript: (text) => {
      setQueryInput(text);
      void handleRunQuery(text);
    },
    onError: (msg) => toast.error(msg, 'Voice Assistant'),
  });

  const handleRunQuery = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? queryInput).trim();
    if (!q || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    if (!overrideQuery) setQueryInput('');
    setIsLoading(true);

    try {
      const result = await opacNaturalSearch({
        query: q,
        books,
        loans,
        language,
      });

      const matchedBooks = (result.matchedBookIds || [])
        .map((id) => books.find((b) => b.id === id))
        .filter((b): b is Book => Boolean(b));

      const matchedLoans = (result.matchedLoanIds || [])
        .map((id) => loans.find((l) => l.id === id))
        .filter((l): l is Loan => Boolean(l));

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.answer,
          structured: result,
          matchedBooks,
          matchedLoans,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text:
            language === 'dv'
              ? 'މައާފަށް އެދެން! ސުވާލު ޕްރޮސެސް ކުރުމުގައި މައްސަލައެއް ޖެހިއްޖެ.'
              : 'Unable to complete query right now. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const sampleQueries = [
    {
      labelEn: 'Dhivehi Grade 5 on shelf',
      labelDv: 'ގްރޭޑް 5 ގެ ދިވެހި ވާހަކަ',
      q:
        language === 'dv'
          ? 'ގްރޭޑް 6 ގެ ދަރިވަރުންނަށް ކިޔާލަން ރަނގަޅު ސައިންސް ފޮތްތައް'
          : 'Dhivehi adventure stories for Grade 5 that are on the shelf right now',
    },
    {
      labelEn: 'Grade 9 Overdue > 10d',
      labelDv: 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތައް',
      q:
        language === 'dv'
          ? 'މުއްދަތު ހަމަވެފައިވާ ފޮތްތަކާއި ދަރިވަރުން ދައްކާ'
          : 'Show all Grade 9 students with overdue books exceeding 10 days',
    },
    {
      labelEn: 'Lowest Circulation Categories',
      labelDv: 'އެންމެ މަދުން ދައުރުވި ބާވަތް',
      q: 'Which subject categories had the lowest circulation this term?',
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-[600px]">
      {/* Sample Queries & Server Engine Status Strip */}
      <div className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto">
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">
            {language === 'dv' ? 'މިސާލު:' : 'Examples:'}
          </span>
          {sampleQueries.map((sq, i) => (
            <button
              key={i}
              type="button"
              onClick={() => void handleRunQuery(sq.q)}
              className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer transition"
            >
              {language === 'dv' ? sq.labelDv : sq.labelEn}
            </button>
          ))}
        </div>

        {aiStatus && (
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
            <CheckCircle2 className={`w-3.5 h-3.5 ${aiStatus.configured ? 'text-emerald-600' : 'text-amber-600'}`} />
            <span>
              {aiStatus.configured ? aiStatus.primaryModel : 'Offline Semantic Parser'}
            </span>
          </div>
        )}
      </div>

      {/* Chat Stream */}
      <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/50">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-[88%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-slate-900 dark:bg-emerald-800 text-white font-medium'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 space-y-3'
              }`}
            >
              <div className="whitespace-pre-wrap">{msg.text}</div>

              {/* Structured Filter Predicates Summary */}
              {msg.structured?.filterPredicates &&
                Object.values(msg.structured.filterPredicates).some((v) => v !== undefined && v !== false && v !== '') && (
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                    <Filter className="w-3 h-3 text-emerald-700" />
                    <span className="font-bold">Filters:</span>
                    {msg.structured.filterPredicates.language && <span>Language: {msg.structured.filterPredicates.language} ·</span>}
                    {msg.structured.filterPredicates.gradeLevel && <span>Grade: {msg.structured.filterPredicates.gradeLevel} ·</span>}
                    {msg.structured.filterPredicates.category && <span>Category: {msg.structured.filterPredicates.category} ·</span>}
                    {msg.structured.filterPredicates.borrowerGrade && <span>Patron Grade: {msg.structured.filterPredicates.borrowerGrade} ·</span>}
                    {msg.structured.filterPredicates.minOverdueDays !== undefined && (
                      <span className="font-mono">Min Overdue: {msg.structured.filterPredicates.minOverdueDays}d ·</span>
                    )}
                    {msg.structured.filterPredicates.availableOnly && <span>Available on Shelf</span>}
                  </div>
                )}

              {/* Matched Catalog Books */}
              {msg.matchedBooks && msg.matchedBooks.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {msg.matchedBooks.map((book) => (
                    <button
                      key={book.id}
                      type="button"
                      onClick={() => {
                        if (onSelectBook) onSelectBook(book);
                        else if (onNavigateTab) onNavigateTab('catalog');
                      }}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 text-start transition cursor-pointer"
                    >
                      <BookCoverFallback
                        src={book.coverUrl}
                        alt={book.title}
                        title={book.title}
                        className="w-9 h-12 rounded object-cover shrink-0 border border-slate-200 dark:border-slate-700"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                          <bdi>{book.title}</bdi>
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          <bdi>{book.author}</bdi>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[10px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                          <span className={book.availableCopies > 0 && !book.isReferenceOnly ? 'text-emerald-700 dark:text-emerald-400 font-bold' : 'text-amber-700 dark:text-amber-400 font-bold'}>
                            <bdi>{book.availableCopies}/{book.totalCopies}</bdi> avail
                          </span>
                          <span>·</span>
                          <span className="truncate"><bdi>{book.ddcCallNumber || book.shelfLocation}</bdi></span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Matched Overdue Loans + One-Click Draft Reminder */}
              {msg.matchedLoans && msg.matchedLoans.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  {msg.matchedLoans.map((loan) => {
                    const daysOverdue = loan.dueDate && loan.dueDate < today
                      ? Math.max(0, Math.floor((new Date(today).getTime() - new Date(loan.dueDate).getTime()) / 86400000))
                      : 0;
                    return (
                      <div
                        key={loan.id}
                        className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              <bdi>{loan.userName}</bdi> {loan.userGrade ? `(${loan.userGrade})` : ''} — <bdi>{loan.bookTitle}</bdi>
                            </div>
                            <div className="text-[11px] font-mono tabular-nums text-rose-700 dark:text-rose-300">
                              <bdi>Due {loan.dueDate} · {daysOverdue}d overdue · MVR {(loan.lateFee || 0).toFixed(2)}</bdi>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setReminderTarget({
                              loanId: loan.id,
                              bookTitle: loan.bookTitle,
                              userName: loan.userName,
                              userGrade: loan.userGrade,
                              dueDate: loan.dueDate,
                              daysOverdue,
                              lateFeeMvr: loan.lateFee || 0,
                            })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-slate-900 dark:bg-slate-800 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>Draft Reminder</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Circulation Analytics Breakdown */}
              {msg.structured?.analyticsBreakdown && msg.structured.analyticsBreakdown.length > 0 && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Category Circulation Breakdown</span>
                  </div>
                  <div className="space-y-1.5">
                    {msg.structured.analyticsBreakdown.map((row, rIdx) => {
                      const maxVal = Math.max(1, ...msg.structured!.analyticsBreakdown.map((x) => x.count));
                      const pct = Math.round((row.count / maxVal) * 100);
                      return (
                        <div key={rIdx} className="space-y-0.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold">{row.label}</span>
                            <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400">
                              <bdi>{row.count} loan(s)</bdi>
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden">
                            <div className="h-full bg-emerald-700 rounded-md" style={{ width: `${Math.max(4, pct)}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {msg.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-slate-700 text-white flex items-center justify-center font-bold text-xs shrink-0">
                {currentUser.name.charAt(0)}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center">
            <div className="w-8 h-8 rounded-full bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-3 text-xs font-bold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-700" />
              <span>{language === 'dv' ? 'ލިބީ ކެޓަލޮގް ޗެކްކުރަނީ...' : 'Parsing query & searching catalog...'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Bar */}
      <div className="p-3.5 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-700">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleRunQuery();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder={
              language === 'dv'
                ? 'ދިވެހި ނުވަތަ އިނގިރޭސި ބަހުން ފޮތެއް ނުވަތަ ލޯން ރެކޯޑެއް ހޯއްދަވާ...'
                : 'Ask in English or Dhivehi (e.g., Grade 5 Dhivehi stories on shelf, or Grade 9 overdue > 10 days)...'
            }
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-emerald-600 font-medium"
          />
          <button
            type="button"
            onClick={toggleRecording}
            disabled={isTranscribing || isLoading}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border cursor-pointer shrink-0 ${
              isRecording
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700'
            }`}
            title={language === 'dv' ? 'އަޑުން ސުވާލުކުރައްވާ' : 'Voice Query'}
          >
            {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-700" />}
            <span className="hidden sm:inline whitespace-nowrap">
              {isTranscribing ? '...' : isRecording ? 'Stop' : language === 'dv' ? 'ވޮއިސް' : 'Voice'}
            </span>
          </button>
          <button
            type="submit"
            disabled={!queryInput.trim() || isLoading}
            className="bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 cursor-pointer shrink-0 whitespace-nowrap"
          >
            <span>{language === 'dv' ? 'ހޯއްދަވާ' : 'Ask'}</span>
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>

      <ReminderDraftModal target={reminderTarget} onClose={() => setReminderTarget(null)} />
    </div>
  );
};
