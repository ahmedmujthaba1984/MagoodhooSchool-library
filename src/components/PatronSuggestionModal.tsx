import React, { useMemo, useState } from 'react';
import {
  X,
  ArrowBigUp,
  Search,
  CheckCircle2,
  BookPlus,
  HeartHandshake,
  Sparkles,
  Loader2,
  Clock
} from 'lucide-react';
import {
  AcquisitionBudgetCategory,
  AcquisitionRequest,
  UserProfile
} from '../types';
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_DV,
  sortAcquisitionRequestsByPriority
} from '../lib/acquisitions';
import { fetchExternalMetadata } from '../services/metadataFetcher';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';

interface PatronSuggestionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  requests: AcquisitionRequest[];
  onCreateRequest: (req: Omit<AcquisitionRequest, 'id'>) => Promise<void>;
  onToggleUpvote: (requestId: string) => Promise<void>;
  defaultMode?: 'suggest' | 'vote';
}

export const PatronSuggestionModal: React.FC<PatronSuggestionModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  requests,
  onCreateRequest,
  onToggleUpvote,
  defaultMode = 'suggest',
}) => {
  const { language, isRtl } = useLanguage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'suggest' | 'vote'>(defaultMode);
  const [isbn, setIsbn] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [bookLanguage, setBookLanguage] = useState<'English' | 'Dhivehi' | 'Arabic' | 'Other'>('English');
  const [budgetCategory, setBudgetCategory] = useState<AcquisitionBudgetCategory>('Fiction & Graded Readers');
  const [quantity, setQuantity] = useState(1);
  const [curriculumJustification, setCurriculumJustification] = useState('');
  const [requesterName, setRequesterName] = useState(
    currentUser.id === 'guest' ? '' : currentUser.name
  );
  const [isDonation, setIsDonation] = useState(false);
  const [donorName, setDonorName] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const rankedRequests = useMemo(
    () => sortAcquisitionRequestsByPriority(requests),
    [requests]
  );

  if (!isOpen) return null;

  const handleIsbnLookup = async () => {
    const cleaned = isbn.trim();
    if (!cleaned) {
      toast.info(
        language === 'dv' ? 'އައި.އެސް.ބީ.އެން ނަންބަރު ޖައްސަވާ.' : 'Enter an ISBN-10 or ISBN-13 to auto-fill.',
        'ISBN Lookup'
      );
      return;
    }
    setIsLookingUp(true);
    try {
      const meta = await fetchExternalMetadata(cleaned);
      if (meta && meta.found) {
        setTitle(meta.title || '');
        setAuthor(meta.author || '');
        setBookLanguage(meta.language || 'English');
        toast.success(
          language === 'dv'
            ? `"${meta.title}" ގެ މަޢުލޫމާތު ފެނިއްޖެ.`
            : `Loaded bibliographic details from ${meta.source}.`,
          'Metadata Found'
        );
      } else {
        toast.info(
          language === 'dv'
            ? 'މި އައި.އެސް.ބީ.އެން އިން މައުލޫމާތެއް ނުފެނުނު — މެނުއަލްކޮށް ލިޔުއްވާ.'
            : 'ISBN not found externally — please type title & author manually.',
          'Manual Entry'
        );
      }
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.warning(
        language === 'dv' ? 'ފޮތުގެ ނަން ލިޔުއްވާ.' : 'Please enter a book title.',
        'Title Required'
      );
      return;
    }
    if (isDonation && !donorName.trim()) {
      toast.warning(
        language === 'dv' ? 'ހަދިޔާކުރެއްވި ފަރާތުގެ ނަން ލިޔުއްވާ.' : 'Please enter the Donor Name for bookplate attribution.',
        'Donor Name Required'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const actingName =
        currentUser.id === 'guest'
          ? (requesterName.trim() || 'School Patron')
          : currentUser.name;
      const actingId =
        currentUser.id === 'guest' ? `guest-${Date.now()}` : currentUser.id;

      await onCreateRequest({
        title: title.trim(),
        author: author.trim() || 'Unknown Author',
        isbn: isbn.trim() || undefined,
        bookLanguage,
        budgetCategory,
        curriculumJustification:
          curriculumJustification.trim() ||
          (isDonation
            ? `Book drive / community donation from ${donorName.trim()}.`
            : 'Requested by patron for school curriculum & reading collection.'),
        requestedByUserId: actingId,
        requestedByName: actingName,
        requestedByRole: currentUser.role,
        requestedDate: new Date().toISOString().split('T')[0],
        upvoterIds: [actingId],
        stage: 'Requested',
        quantity: Math.max(1, Number(quantity) || 1),
        unitPriceMvr: isDonation ? 0 : 185,
        isDonation,
        donorName: isDonation ? donorName.trim() : undefined,
      });

      setIsbn('');
      setTitle('');
      setAuthor('');
      setQuantity(1);
      setCurriculumJustification('');
      setIsDonation(false);
      setDonorName('');
      setActiveTab('vote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const stageLabel = (stage: AcquisitionRequest['stage']) => {
    if (language !== 'dv') return stage;
    switch (stage) {
      case 'Requested':
        return 'އެދިފައި';
      case 'Approved':
        return 'ޤަބޫލުކޮށްފައި';
      case 'Ordered':
        return 'އޯޑަރުކޮށްފައި';
      case 'Received & Cataloged':
        return 'ލިބި ކެޓަލޮގް ކުރެވިފައި';
      case 'Declined':
        return 'ބާޠިލު';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-950/50">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <BookPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                {language === 'dv'
                  ? 'އައު ފޮތެއް ހުށަހެޅުން އަދި ވޯޓުލުން'
                  : 'Suggest a Book & Community Wishlist'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {language === 'dv'
                  ? 'މުދައްރިސުންނާއި ދަރިވަރުން ބޭނުންވާ ފޮތްތައް ހުށަހަޅައި ވޯޓުދެއްވާ'
                  : 'Teachers, students & parents can request curriculum titles or upvote top picks'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="px-6 pt-3 pb-2 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('suggest')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              activeTab === 'suggest'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ފޮތެއް ހުށަހަޅާ' : 'Submit Suggestion'}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('vote')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              activeTab === 'vote'
                ? 'bg-emerald-700 text-white'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
          >
            <ArrowBigUp className="w-4 h-4" />
            <span>
              {language === 'dv' ? 'ހުށަހެޅިފައިވާ ފޮތްތައް' : 'Community Queue & Upvote'}
            </span>
            <span className="font-mono tabular-nums px-1.5 py-0.5 rounded bg-black/15 text-[10px]">
              {rankedRequests.length}
            </span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'suggest' ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* ISBN Paste + Lookup */}
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'dv' ? 'އައި.އެސް.ބީ.އެން (އޮޕްޝަނަލް)' : 'Paste ISBN-10 / ISBN-13 (Optional Auto-Fill)'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="e.g. 9780141321097"
                    className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={handleIsbnLookup}
                    disabled={isLookingUp}
                    className="px-4 py-2.5 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                  >
                    {isLookingUp ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                    <span>{language === 'dv' ? 'ހޯދާ' : 'Lookup ISBN'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'dv' ? 'ފޮތުގެ ނަން *' : 'Book Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={language === 'dv' ? 'މިސާލު: ދިވެހި ޅެންވެރިކަން' : 'Title in English or Dhivehi'}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'dv' ? 'މުޞައްނިފު / ލިޔުންތެރިޔާ' : 'Author / Creator'}
                  </label>
                  <input
                    type="text"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Author name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'dv' ? 'ބަހުރުވަ' : 'Language'}
                  </label>
                  <select
                    value={bookLanguage}
                    onChange={(e) => setBookLanguage(e.target.value as any)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="English">English</option>
                    <option value="Dhivehi">Dhivehi (ދިވެހި)</option>
                    <option value="Arabic">Arabic (العربية)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'dv' ? 'ބަޖެޓް ކެޓަގަރީ' : 'Collection Category'}
                  </label>
                  <select
                    value={budgetCategory}
                    onChange={(e) => setBudgetCategory(e.target.value as AcquisitionBudgetCategory)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {BUDGET_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {language === 'dv' ? BUDGET_CATEGORY_DV[cat] : cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'dv' ? 'ކޮޕީގެ އަދަދު' : 'Copies Needed'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {currentUser.id === 'guest' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                    {language === 'dv' ? 'ހުށަހަޅާ ފަރާތުގެ ނަން' : 'Your Name (Student / Teacher / Parent)'}
                  </label>
                  <input
                    type="text"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    placeholder="e.g. Aishath Maaha (Grade 8)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  {language === 'dv' ? 'ސަބަބު / ކަރިކިއުލަމް ބޭނުން' : 'Curriculum Justification or Reading Interest'}
                </label>
                <textarea
                  rows={3}
                  value={curriculumJustification}
                  onChange={(e) => setCurriculumJustification(e.target.value)}
                  placeholder={
                    language === 'dv'
                      ? 'މިސާލު: ގްރޭޑް 9 ގެ ދިވެހި މާއްދާއަށް ބޭނުންވާ ފޮތެއް'
                      : 'e.g. Supports Grade 8 Marine Biology unit or Reading Club book circle'
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Donation / Book Drive pledge toggle */}
              <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDonation}
                    onChange={(e) => setIsDonation(e.target.checked)}
                    className="w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                  />
                  <HeartHandshake className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {language === 'dv'
                      ? 'މިއީ ސްކޫލް ލައިބްރަރީއަށް ހަދިޔާކުރާ ފޮތެއް (ބުކް ޑްރައިވް)'
                      : 'I am donating this book (log with inside-cover Donor Bookplate attribution)'}
                  </span>
                </label>

                {isDonation && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      {language === 'dv' ? 'ހަދިޔާކުރެއްވި ފަރާތުގެ ނަން *' : 'Donor / Sponsor Name *'}
                    </label>
                    <input
                      type="text"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                      placeholder="e.g. Magoodhoo PTA Book Drive 2026 / Ahmed Ali"
                      className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                  {language === 'dv' ? 'ކެންސަލް' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black transition cursor-pointer flex items-center gap-2 disabled:opacity-60 whitespace-nowrap"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookPlus className="w-4 h-4" />}
                  <span>{language === 'dv' ? 'ހުށަހެޅުން ފޮނުވާ' : 'Submit Book Suggestion'}</span>
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 pb-1">
                <span>
                  {language === 'dv'
                    ? 'އެންމެ ގިނަ ވޯޓު ލިބޭ ފޮތްތައް ލައިބްރޭރިއަންގެ ލިސްޓުގެ ކުރިއަށް އަންނާނެއެވެ.'
                    : 'Requests ranked highest by community upvotes appear first in the librarian review queue.'}
                </span>
              </div>

              {rankedRequests.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl text-sm text-slate-500">
                  {language === 'dv' ? 'އަދި އެއްވެސް ފޮތެއް ހުށަހެޅިފައެއް ނެތް.' : 'No book suggestions yet — submit the first one!'}
                </div>
              ) : (
                rankedRequests.map((req) => {
                  const voteCount = req.upvoterIds?.length || 0;
                  const hasVoted = req.upvoterIds?.includes(currentUser.id);
                  const isReceived = req.stage === 'Received & Cataloged';
                  return (
                    <div
                      key={req.id}
                      className="flex items-start justify-between gap-4 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/60"
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white">
                            <bdi>{req.title}</bdi>
                          </h4>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              isReceived
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : req.stage === 'Ordered'
                                ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                                : req.stage === 'Approved'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {stageLabel(req.stage)}
                          </span>
                        </div>

                        <div className="text-xs text-slate-600 dark:text-slate-400">
                          <bdi>{req.author}</bdi> · <span className="font-medium">{req.budgetCategory}</span>
                          {req.isbn ? (
                            <>
                              {' '}· <span className="font-mono"><bdi>ISBN {req.isbn}</bdi></span>
                            </>
                          ) : null}
                        </div>

                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                          {req.curriculumJustification}
                        </p>

                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span className="inline-flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {req.requestedByName} ({req.requestedDate})
                          </span>
                          {req.isDonation && req.donorName && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                              <HeartHandshake className="w-3 h-3" />
                              Donated by {req.donorName}
                            </span>
                          )}
                          {isReceived && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                              <CheckCircle2 className="w-3 h-3" />
                              {language === 'dv' ? 'ކެޓަލޮގަށް އިތުރުކުރެވިއްޖެ' : 'Cataloged & Ready'}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onToggleUpvote(req.id)}
                        className={`flex flex-col items-center justify-center min-w-[54px] px-2.5 py-2 rounded-2xl border transition cursor-pointer shrink-0 ${
                          hasVoted
                            ? 'bg-emerald-700 text-white border-emerald-700'
                            : 'bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-emerald-500'
                        }`}
                        title={hasVoted ? 'Remove vote' : 'Upvote suggestion'}
                      >
                        <ArrowBigUp className={`w-5 h-5 ${hasVoted ? 'fill-current' : ''}`} />
                        <span className="text-xs font-mono tabular-nums font-black">{voteCount}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
