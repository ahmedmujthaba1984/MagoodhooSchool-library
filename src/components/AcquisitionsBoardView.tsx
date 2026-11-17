import React, { useMemo, useState } from 'react';
import {
  ShoppingBag,
  ArrowBigUp,
  CheckCircle2,
  PackageCheck,
  Printer,
  Plus,
  HeartHandshake,
  Receipt,
  SlidersHorizontal,
  Table,
  Kanban,
  BookOpen,
  Trash2,
  X,
  Bell
} from 'lucide-react';
import {
  AcquisitionBudgetCategory,
  AcquisitionRequest,
  AcquisitionStage,
  Book,
  LibrarySettings
} from '../types';
import {
  BUDGET_CATEGORIES,
  BUDGET_CATEGORY_DV,
  BookplateItem,
  computeCategoryBudgets,
  getLineTotalMvr,
  printDonationBookplateLabels,
  sortAcquisitionRequestsByPriority
} from '../lib/acquisitions';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';

interface AcquisitionsBoardViewProps {
  requests: AcquisitionRequest[];
  books: Book[];
  settings: LibrarySettings;
  onCreateRequest: (req: Omit<AcquisitionRequest, 'id'>) => Promise<void>;
  onUpdateRequest: (id: string, data: Partial<AcquisitionRequest>) => Promise<void>;
  onDeleteRequest: (id: string) => Promise<void>;
  onToggleUpvote: (id: string) => Promise<void>;
  onReceiveAndCatalog: (req: AcquisitionRequest) => Promise<void>;
  onUpdateSettings: (newSettings: Partial<LibrarySettings>) => Promise<void>;
  onOpenSuggestionPortal: () => void;
}

const PIPELINE_STAGES: AcquisitionStage[] = [
  'Requested',
  'Approved',
  'Ordered',
  'Received & Cataloged',
];

export const AcquisitionsBoardView: React.FC<AcquisitionsBoardViewProps> = ({
  requests,
  books,
  settings,
  onCreateRequest,
  onUpdateRequest,
  onDeleteRequest,
  onToggleUpvote,
  onReceiveAndCatalog,
  onUpdateSettings,
  onOpenSuggestionPortal,
}) => {
  const { language, isRtl } = useLanguage();
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<'kanban' | 'table' | 'donations'>('kanban');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isEditingBudgets, setIsEditingBudgets] = useState(false);
  const [editingRequest, setEditingRequest] = useState<AcquisitionRequest | null>(null);
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [selectedBookplateIds, setSelectedBookplateIds] = useState<string[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Inline budget edit state
  const [budgetDraft, setBudgetDraft] = useState<Record<string, number>>(() => {
    const overview = computeCategoryBudgets(requests, settings.annualAcquisitionsBudgetsMvr);
    const map: Record<string, number> = {};
    for (const c of overview.categories) map[c.category] = c.allocatedMvr;
    return map;
  });

  // New acquisition / donation form state
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [newIsbn, setNewIsbn] = useState('');
  const [newLang, setNewLang] = useState<'English' | 'Dhivehi' | 'Arabic' | 'Other'>('English');
  const [newCat, setNewCat] = useState<AcquisitionBudgetCategory>('Dhivehi Literature');
  const [newQty, setNewQty] = useState(2);
  const [newPriceMvr, setNewPriceMvr] = useState(195);
  const [newVendor, setNewVendor] = useState('Novelty Bookshop Male');
  const [newQuoteRef, setNewQuoteRef] = useState('');
  const [newInvoice, setNewInvoice] = useState('');
  const [newJustification, setNewJustification] = useState('');
  const [newIsDonation, setNewIsDonation] = useState(false);
  const [newDonorName, setNewDonorName] = useState('');

  // Custom single-off donor bookplate builder
  const [customPlateTitle, setCustomPlateTitle] = useState('');
  const [customPlateAuthor, setCustomPlateAuthor] = useState('');
  const [customPlateDonor, setCustomPlateDonor] = useState('');

  const budgetOverview = useMemo(
    () => computeCategoryBudgets(requests, settings.annualAcquisitionsBudgetsMvr),
    [requests, settings.annualAcquisitionsBudgetsMvr]
  );

  const filteredRequests = useMemo(() => {
    const base = categoryFilter === 'all'
      ? requests
      : requests.filter((r) => r.budgetCategory === categoryFilter);
    return sortAcquisitionRequestsByPriority(base);
  }, [requests, categoryFilter]);

  const donationItems = useMemo(
    () => filteredRequests.filter((r) => r.isDonation || Boolean(r.donorName?.trim())),
    [filteredRequests]
  );

  const stageCounts = useMemo(() => {
    const counts: Record<AcquisitionStage, number> = {
      'Requested': 0,
      'Approved': 0,
      'Ordered': 0,
      'Received & Cataloged': 0,
      'Declined': 0,
    };
    for (const r of filteredRequests) {
      counts[r.stage] = (counts[r.stage] || 0) + 1;
    }
    return counts;
  }, [filteredRequests]);

  const stageLabel = (stage: AcquisitionStage) => {
    if (language !== 'dv') return stage;
    switch (stage) {
      case 'Requested':
        return 'އެދިފައި';
      case 'Approved':
        return 'ޤަބޫލުކުރެވިފައި';
      case 'Ordered':
        return 'އޯޑަރުކޮށްފައި';
      case 'Received & Cataloged':
        return 'ލިބި ކެޓަލޮގް ކުރެވިފައި';
      case 'Declined':
        return 'ބާޠިލު';
    }
  };

  const handleSaveBudgets = async () => {
    await onUpdateSettings({ annualAcquisitionsBudgetsMvr: budgetDraft });
    setIsEditingBudgets(false);
  };

  const handleCreateDirectEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    if (newIsDonation && !newDonorName.trim()) {
      toast.warning('Enter Donor Name for donation attribution.', 'Donor Required');
      return;
    }

    await onCreateRequest({
      title: newTitle.trim(),
      author: newAuthor.trim() || 'Unknown Author',
      isbn: newIsbn.trim() || undefined,
      bookLanguage: newLang,
      budgetCategory: newCat,
      curriculumJustification:
        newJustification.trim() ||
        (newIsDonation
          ? `Book drive contribution by ${newDonorName.trim()}.`
          : 'Librarian procurement entry.'),
      requestedByUserId: 'admin',
      requestedByName: newIsDonation ? newDonorName.trim() : 'Library Acquisitions Desk',
      requestedByRole: 'admin',
      requestedDate: new Date().toISOString().split('T')[0],
      upvoterIds: ['admin'],
      stage: newIsDonation ? 'Approved' : newInvoice.trim() ? 'Ordered' : 'Approved',
      quantity: Math.max(1, Number(newQty) || 1),
      unitPriceMvr: newIsDonation ? 0 : Math.max(0, Number(newPriceMvr) || 0),
      vendorName: newIsDonation ? undefined : newVendor.trim() || undefined,
      vendorQuoteRef: newIsDonation ? undefined : newQuoteRef.trim() || undefined,
      invoiceNumber: newIsDonation ? undefined : newInvoice.trim() || undefined,
      isDonation: newIsDonation,
      donorName: newIsDonation ? newDonorName.trim() : undefined,
    });

    setNewTitle('');
    setNewAuthor('');
    setNewIsbn('');
    setNewQuoteRef('');
    setNewInvoice('');
    setNewJustification('');
    setNewDonorName('');
    setIsNewModalOpen(false);
  };

  const handleReceiveClick = async (req: AcquisitionRequest) => {
    setProcessingId(req.id);
    try {
      await onReceiveAndCatalog(req);
    } finally {
      setProcessingId(null);
    }
  };

  const handlePrintSelectedBookplates = () => {
    const targets = donationItems.filter((d) =>
      selectedBookplateIds.length > 0 ? selectedBookplateIds.includes(d.id) : true
    );
    if (targets.length === 0) {
      toast.info('No donation entries selected to print.', 'Bookplates');
      return;
    }
    const items: BookplateItem[] = targets.map((t) => ({
      id: t.id,
      title: t.title,
      author: t.author,
      donorName: t.donorName || t.requestedByName,
      isbn: t.isbn,
      donatedDate: t.receivedDate || t.requestedDate,
      quantity: t.quantity,
    }));
    printDonationBookplateLabels(items);
  };

  const handlePrintSinglePlate = (req: AcquisitionRequest) => {
    printDonationBookplateLabels([
      {
        id: req.id,
        title: req.title,
        author: req.author,
        donorName: req.donorName || req.requestedByName,
        isbn: req.isbn,
        donatedDate: req.receivedDate || req.requestedDate,
        quantity: req.quantity,
      },
    ]);
  };

  const handlePrintCustomPlate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPlateDonor.trim() || !customPlateTitle.trim()) {
      toast.warning('Provide both Book Title and Donor Name to print a bookplate.', 'Incomplete Plate');
      return;
    }
    printDonationBookplateLabels([
      {
        id: `custom-${Date.now()}`,
        title: customPlateTitle.trim(),
        author: customPlateAuthor.trim() || 'F. Magoodhoo School Collection',
        donorName: customPlateDonor.trim(),
        donatedDate: new Date().toISOString().split('T')[0],
      },
    ]);
  };

  const togglePlateSelection = (id: string) => {
    setSelectedBookplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Workspace Header */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <ShoppingBag className="w-4 h-4" />
            <span>
              {language === 'dv' ? 'ފޮތް ހޯދުމާއި ބަޖެޓް' : 'Acquisitions, Patron Requests & Donors'}
            </span>
          </div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {language === 'dv' ? 'ލައިބްރަރީ އެކުއިޒިޝަންސް ބޯޑު' : 'Procurement & Wishlist Pipeline'}
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {language === 'dv'
              ? 'މުދައްރިސުންނާއި ދަރިވަރުންގެ ހުށަހެޅުންތައް ބަލައި، ރުފިޔާގެ ބަޖެޓް މޮނިޓަރކޮށް، ލިބޭ ފޮތްތައް އޮޓޯއިން ކެޓަލޮގް ކުރައްވާ.'
              : 'Review community-upvoted suggestions, track MVR vendor quotes & invoices, auto-catalog arrivals, and print donor bookplates.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onOpenSuggestionPortal}
            className="px-4 py-2.5 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <ArrowBigUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
            <span>{language === 'dv' ? 'ޕޭޓްރަން ޕޯޓަލް' : 'Patron Suggestion Portal'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewIsDonation(true);
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <HeartHandshake className="w-4 h-4" />
            <span>{language === 'dv' ? 'ހަދިޔާ ފޮތެއް ލޮގްކުރޭ' : 'Log Donation'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setNewIsDonation(false);
              setIsNewModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-2 transition cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>{language === 'dv' ? 'އައު އޯޑަރެއް' : 'New Purchase Order'}</span>
          </button>
        </div>
      </div>

      {/* Annual Library Budget Tracker (MVR) */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              {language === 'dv' ? '2026 އަހަރީ ބަޖެޓް (ދިވެހި ރުފިޔާ)' : 'Annual Library Acquisitions Budget (FY 2026 · MVR)'}
            </div>
            <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1 mt-1">
              <div className="text-2xl sm:text-3xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
                <bdi>MVR {budgetOverview.totalRemainingMvr.toLocaleString()}</bdi>
                <span className="text-xs font-sans font-bold text-slate-500 dark:text-slate-400 ms-2">
                  {language === 'dv' ? 'ބާކީ' : 'remaining'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums text-slate-600 dark:text-slate-400">
                <span>
                  Allocated: <strong className="text-slate-900 dark:text-slate-200">MVR {budgetOverview.totalAllocatedMvr.toLocaleString()}</strong>
                </span>
                <span>
                  Spent: <strong className="text-emerald-700 dark:text-emerald-400">MVR {budgetOverview.totalSpentMvr.toLocaleString()}</strong>
                </span>
                <span>
                  Committed: <strong className="text-amber-700 dark:text-amber-400">MVR {budgetOverview.totalCommittedMvr.toLocaleString()}</strong>
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const map: Record<string, number> = {};
              for (const c of budgetOverview.categories) map[c.category] = c.allocatedMvr;
              setBudgetDraft(map);
              setIsEditingBudgets((prev) => !prev);
            }}
            className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2 transition cursor-pointer self-start md:self-auto whitespace-nowrap shrink-0"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ބަޖެޓް އެޑިޓް' : 'Configure Category Budgets'}</span>
          </button>
        </div>

        {/* Stacked Overall Budget Progress Bar */}
        <div className="space-y-2">
          <div className="h-3.5 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden flex">
            {budgetOverview.totalAllocatedMvr > 0 && (
              <>
                <div
                  className="bg-emerald-600 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (budgetOverview.totalSpentMvr / budgetOverview.totalAllocatedMvr) * 100)}%`,
                  }}
                  title={`Spent: MVR ${budgetOverview.totalSpentMvr.toLocaleString()}`}
                />
                <div
                  className="bg-amber-500 transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (budgetOverview.totalCommittedMvr / budgetOverview.totalAllocatedMvr) * 100)}%`,
                  }}
                  title={`Committed (Approved/Ordered): MVR ${budgetOverview.totalCommittedMvr.toLocaleString()}`}
                />
              </>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 gap-2">
            <div className="flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
                Received & Paid
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" />
                Committed (Approved & Ordered)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-slate-300 dark:bg-slate-700 inline-block" />
                Available Balance
              </span>
            </div>
            <span className="font-mono tabular-nums font-bold">
              {budgetOverview.overallUtilizationPct}% utilized · {budgetOverview.donatedCopiesCount} donated copies
            </span>
          </div>
        </div>

        {/* Category Budget Edit Drawer */}
        {isEditingBudgets && (
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950/70 space-y-3">
            <div className="text-xs font-black text-slate-800 dark:text-slate-200">
              Adjust Annual Category Allocations (MVR)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {BUDGET_CATEGORIES.map((cat) => (
                <div key={cat}>
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400 mb-1 truncate">
                    {language === 'dv' ? BUDGET_CATEGORY_DV[cat] : cat}
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={500}
                    value={budgetDraft[cat] ?? 0}
                    onChange={(e) =>
                      setBudgetDraft((prev) => ({
                        ...prev,
                        [cat]: Math.max(0, Number(e.target.value) || 0),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-slate-900 dark:text-white"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditingBudgets(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveBudgets}
                className="px-4 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold cursor-pointer"
              >
                Save MVR Allocations
              </button>
            </div>
          </div>
        )}

        {/* Per-Category Budget Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {budgetOverview.categories.map((cat) => {
            const spentPct = cat.allocatedMvr > 0 ? Math.min(100, (cat.spentMvr / cat.allocatedMvr) * 100) : 0;
            const committedPct = cat.allocatedMvr > 0 ? Math.min(100 - spentPct, (cat.committedMvr / cat.allocatedMvr) * 100) : 0;
            const isActiveFilter = categoryFilter === cat.category;

            return (
              <button
                key={cat.category}
                type="button"
                onClick={() => setCategoryFilter(isActiveFilter ? 'all' : cat.category)}
                className={`text-start p-3.5 rounded-2xl border transition cursor-pointer ${
                  isActiveFilter
                    ? 'border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/30'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/40 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <div className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {language === 'dv' ? cat.labelDv : cat.category}
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 font-mono tabular-nums">
                  <span className="text-sm font-black text-emerald-700 dark:text-emerald-400">
                    MVR {cat.remainingMvr.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    / {cat.allocatedMvr.toLocaleString()}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden flex">
                  <div className="bg-emerald-600" style={{ width: `${spentPct}%` }} />
                  <div className="bg-amber-500" style={{ width: `${committedPct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  <span>{cat.itemCount} req(s)</span>
                  <span>{cat.utilizationPct}% used</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* View Switcher & Active Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={() => setViewMode('kanban')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'kanban'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Kanban className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ޕައިޕްލައިން ބޯޑު' : 'Kanban Pipeline'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'table'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ލެޖަރ ތާވަލު' : 'Acquisitions Table'}</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode('donations')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap shrink-0 cursor-pointer ${
              viewMode === 'donations'
                ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5" />
            <span>{language === 'dv' ? 'ހަދިޔާ އަދި ބުކްޕްލޭޓް' : 'Donations & Bookplates'}</span>
            <span className="font-mono tabular-nums px-1.5 py-0.5 rounded bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 text-[10px]">
              {donationItems.length}
            </span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200"
          >
            <option value="all">{language === 'dv' ? 'ހުރިހާ ކެޓަގަރީއެއް' : 'All Budget Categories'}</option>
            {BUDGET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {language === 'dv' ? BUDGET_CATEGORY_DV[c] : c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* KANBAN PIPELINE VIEW */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {PIPELINE_STAGES.map((stage) => {
            const stageItems = filteredRequests.filter((r) => r.stage === stage);
            return (
              <div
                key={stage}
                className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl p-4 flex flex-col gap-3 min-h-[340px]"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    {stageLabel(stage)}
                  </span>
                  <span className="font-mono tabular-nums text-xs font-black px-2 py-0.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200">
                    {stageCounts[stage] || 0}
                  </span>
                </div>

                {stageItems.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center text-xs text-slate-400 text-center py-8">
                    No requests in {stage}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stageItems.map((req) => {
                      const lineTotal = getLineTotalMvr(req);
                      const votes = req.upvoterIds?.length || 0;
                      const isCataloged = Boolean(req.catalogedBookId) || books.some(
                        (b) => b.title.toLowerCase() === req.title.toLowerCase()
                      );

                      return (
                        <div
                          key={req.id}
                          className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 space-y-2.5 shadow-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="text-xs font-black text-slate-900 dark:text-white leading-snug">
                                <bdi>{req.title}</bdi>
                              </h4>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                <bdi>{req.author}</bdi>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => onToggleUpvote(req.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-[11px] font-mono tabular-nums font-bold text-slate-700 dark:text-slate-200 hover:border-emerald-500 cursor-pointer shrink-0"
                              title="Upvote priority"
                            >
                              <ArrowBigUp className="w-3.5 h-3.5 text-emerald-600" />
                              <span>{votes}</span>
                            </button>
                          </div>

                          <div className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2">
                            {req.curriculumJustification}
                          </div>

                          {/* Procurement / Donor Metadata */}
                          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="font-medium text-slate-500 dark:text-slate-400">
                              {req.budgetCategory} · <bdi>{req.quantity}x</bdi>
                            </span>
                            {req.isDonation ? (
                              <span className="font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                <HeartHandshake className="w-3 h-3" />
                                <bdi>{req.donorName || 'Donated'}</bdi>
                              </span>
                            ) : (
                              <span className="font-mono tabular-nums font-black text-slate-900 dark:text-white">
                                MVR {lineTotal.toLocaleString()}
                              </span>
                            )}
                          </div>

                          {(req.vendorName || req.vendorQuoteRef || req.invoiceNumber) && (
                            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 px-2.5 py-1.5 rounded-lg space-y-0.5">
                              {req.vendorName && <div className="truncate font-sans font-semibold text-slate-700 dark:text-slate-300">{req.vendorName}</div>}
                              <div className="flex flex-wrap gap-x-2">
                                {req.vendorQuoteRef && <span>Quote: {req.vendorQuoteRef}</span>}
                                {req.invoiceNumber && <span>Inv: {req.invoiceNumber}</span>}
                              </div>
                            </div>
                          )}

                          {/* Action Footer */}
                          <div className="pt-1 flex flex-wrap items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => setEditingRequest(req)}
                              className="text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-700 dark:hover:text-emerald-400 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                            >
                              {language === 'dv' ? 'ތަފްސީލު' : 'Quote / Edit'}
                            </button>

                            <div className="flex items-center gap-1.5">
                              {req.stage === 'Requested' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateRequest(req.id, { stage: 'Approved' })}
                                  className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Approve
                                </button>
                              )}
                              {req.stage === 'Approved' && (
                                <button
                                  type="button"
                                  onClick={() => onUpdateRequest(req.id, { stage: 'Ordered' })}
                                  className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold cursor-pointer"
                                >
                                  Mark Ordered
                                </button>
                              )}
                              {req.stage === 'Ordered' && (
                                <button
                                  type="button"
                                  disabled={processingId === req.id}
                                  onClick={() => handleReceiveClick(req)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer disabled:opacity-60"
                                >
                                  <PackageCheck className="w-3.5 h-3.5" />
                                  <span>Receive & Catalog</span>
                                </button>
                              )}
                              {req.stage === 'Received & Cataloged' && (
                                <div className="flex items-center gap-1.5">
                                  {req.isDonation && (
                                    <button
                                      type="button"
                                      onClick={() => handlePrintSinglePlate(req)}
                                      className="px-2 py-1 rounded-lg border border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Print Donor Bookplate"
                                    >
                                      <Printer className="w-3 h-3" />
                                      <span>Bookplate</span>
                                    </button>
                                  )}
                                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    {isCataloged ? 'In Catalog' : 'Cataloged'}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          {req.patronNotifiedAt && (
                            <div className="text-[10px] text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-semibold">
                              <Bell className="w-3 h-3" />
                              <span>Notified {req.requestedByName} ({req.patronNotifiedAt})</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ACQUISITIONS LEDGER TABLE VIEW */}
      {viewMode === 'table' && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-3.5 px-4 text-start font-black">Title & Patron</th>
                  <th className="py-3.5 px-3 text-start font-black">Category</th>
                  <th className="py-3.5 px-3 text-center font-black">Votes</th>
                  <th className="py-3.5 px-3 text-start font-black">Vendor / Quote / Invoice</th>
                  <th className="py-3.5 px-3 text-end font-black">Qty × Unit (MVR)</th>
                  <th className="py-3.5 px-3 text-end font-black">Total (MVR)</th>
                  <th className="py-3.5 px-3 text-start font-black">Stage</th>
                  <th className="py-3.5 px-4 text-end font-black">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredRequests.map((req) => {
                  const total = getLineTotalMvr(req);
                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 dark:text-white"><bdi>{req.title}</bdi></div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          <bdi>{req.author}</bdi> · Requested by {req.requestedByName}
                        </div>
                        {req.isDonation && req.donorName && (
                          <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                            Donor: {req.donorName}
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-slate-700 dark:text-slate-300 font-semibold">
                        {req.budgetCategory}
                      </td>
                      <td className="py-3.5 px-3 text-center font-mono tabular-nums font-black text-slate-900 dark:text-white">
                        {req.upvoterIds?.length || 0}
                      </td>
                      <td className="py-3.5 px-3 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        <div className="font-sans font-semibold text-slate-800 dark:text-slate-200">{req.vendorName || (req.isDonation ? 'Book Drive / Donor' : '—')}</div>
                        <div>
                          {req.vendorQuoteRef ? `Q: ${req.vendorQuoteRef}` : ''}
                          {req.vendorQuoteRef && req.invoiceNumber ? ' · ' : ''}
                          {req.invoiceNumber ? `Inv: ${req.invoiceNumber}` : ''}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 text-end font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {req.quantity} × {req.isDonation ? '0.00' : req.unitPriceMvr.toFixed(2)}
                      </td>
                      <td className="py-3.5 px-3 text-end font-mono tabular-nums font-black text-slate-900 dark:text-white">
                        {req.isDonation ? 'DONATION' : `MVR ${total.toLocaleString()}`}
                      </td>
                      <td className="py-3.5 px-3">
                        <span className="font-bold text-slate-800 dark:text-slate-200">{stageLabel(req.stage)}</span>
                      </td>
                      <td className="py-3.5 px-4 text-end">
                        <div className="inline-flex items-center gap-1.5">
                          {req.stage !== 'Received & Cataloged' && (
                            <button
                              type="button"
                              disabled={processingId === req.id}
                              onClick={() => handleReceiveClick(req)}
                              className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold cursor-pointer whitespace-nowrap"
                            >
                              Receive & Catalog
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setEditingRequest(req)}
                            className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteRequest(req.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                            title="Delete entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DONATIONS & BOOKPLATE LABEL STUDIO */}
      {viewMode === 'donations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    {language === 'dv' ? 'ހަދިޔާކުރެވުނު ފޮތްތަކާއި ބުކް ޑްރައިވް' : 'Logged Book Donations & Book Drives'}
                  </span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select donated titles to generate A4 inside-cover Ex-Libris bookplate stickers.
                </p>
              </div>

              <button
                type="button"
                onClick={handlePrintSelectedBookplates}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black flex items-center gap-2 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Printer className="w-4 h-4" />
                <span>
                  Print {selectedBookplateIds.length > 0 ? `${selectedBookplateIds.length} Selected` : 'All'} Bookplates
                </span>
              </button>
            </div>

            {donationItems.length === 0 ? (
              <div className="py-12 text-center text-sm text-slate-500">
                No donations logged yet. Click &quot;Log Donation&quot; above to add a donor book or book drive batch.
              </div>
            ) : (
              <div className="space-y-3">
                {donationItems.map((don) => {
                  const isChecked = selectedBookplateIds.includes(don.id);
                  return (
                    <div
                      key={don.id}
                      className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => togglePlateSelection(don.id)}
                          className="mt-1 w-4 h-4 accent-emerald-700 rounded cursor-pointer"
                        />
                        <div className="min-w-0 space-y-1">
                          <div className="text-sm font-black text-slate-900 dark:text-white">
                            <bdi>{don.title}</bdi>
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <bdi>{don.author}</bdi> · <span className="font-mono">{don.quantity} copies</span>
                          </div>
                          <div className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            Donated By: <bdi>{don.donorName || don.requestedByName}</bdi>
                          </div>
                        </div>
                      </label>

                      <div className="flex items-center gap-2 shrink-0">
                        {don.stage !== 'Received & Cataloged' && (
                          <button
                            type="button"
                            onClick={() => handleReceiveClick(don)}
                            className="px-3 py-1.5 rounded-xl bg-slate-900 dark:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                          >
                            Catalog Copies
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handlePrintSinglePlate(don)}
                          className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-400 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>Print Plate</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Live Inside-Cover Bookplate Studio & Quick Custom Plate */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-xs">
            <h3 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
              <span>Inside-Cover Bookplate Preview</span>
            </h3>

            {/* Live Bookplate Card Preview */}
            <div className="border-2 border-emerald-700 rounded-2xl p-1 bg-white text-slate-900">
              <div className="border border-emerald-200 rounded-xl p-4 text-center space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-emerald-700">
                  Ex-Libris · F. Magoodhoo School Library
                </div>
                <div className="text-xs font-faruma font-bold text-emerald-900" dir="rtl">
                  ފ. މަގޫދޫ ސްކޫލް ލައިބްރަރީއަށް ހަދިޔާކުރެއްވީ
                </div>
                <div className="border-y border-dashed border-slate-300 py-2.5 bg-slate-50 rounded-lg">
                  <div className="text-[9px] font-extrabold uppercase tracking-widest text-slate-500">
                    Donated By
                  </div>
                  <div className="text-base font-black text-slate-900 mt-0.5">
                    {customPlateDonor.trim() ||
                      donationItems[0]?.donorName ||
                      'Magoodhoo PTA Book Drive 2026'}
                  </div>
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {customPlateTitle.trim() || donationItems[0]?.title || 'Selected Donated Title'}
                </div>
                <div className="text-[10px] font-mono text-slate-500">
                  {new Date().toISOString().split('T')[0]}
                </div>
              </div>
            </div>

            <form onSubmit={handlePrintCustomPlate} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <div className="text-xs font-black text-slate-800 dark:text-slate-200">
                Quick Custom Donor Bookplate
              </div>
              <input
                type="text"
                value={customPlateDonor}
                onChange={(e) => setCustomPlateDonor(e.target.value)}
                placeholder="Donated By (Name / Class / Organization)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={customPlateTitle}
                onChange={(e) => setCustomPlateTitle(e.target.value)}
                placeholder="Book Title"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
              <input
                type="text"
                value={customPlateAuthor}
                onChange={(e) => setCustomPlateAuthor(e.target.value)}
                placeholder="Author (Optional)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs text-slate-900 dark:text-white"
              />
              <button
                type="submit"
                className="w-full py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-600 text-white text-xs font-black flex items-center justify-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print Custom Bookplate (A4)</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* INLINE QUOTE / INVOICE / STAGE EDIT MODAL */}
      {editingRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-700 dark:text-emerald-400" />
                <h4 className="text-sm font-black text-slate-900 dark:text-white">
                  Edit Acquisition & Procurement Details
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Title</label>
                <input
                  type="text"
                  value={editingRequest.title}
                  onChange={(e) => setEditingRequest({ ...editingRequest, title: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Stage</label>
                  <select
                    value={editingRequest.stage}
                    onChange={(e) =>
                      setEditingRequest({
                        ...editingRequest,
                        stage: e.target.value as AcquisitionStage,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {PIPELINE_STAGES.map((st) => (
                      <option key={st} value={st}>{st}</option>
                    ))}
                    <option value="Declined">Declined</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Budget Category</label>
                  <select
                    value={editingRequest.budgetCategory}
                    onChange={(e) =>
                      setEditingRequest({
                        ...editingRequest,
                        budgetCategory: e.target.value as AcquisitionBudgetCategory,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quantity</label>
                  <input
                    type="number"
                    min={1}
                    value={editingRequest.quantity}
                    onChange={(e) =>
                      setEditingRequest({
                        ...editingRequest,
                        quantity: Math.max(1, Number(e.target.value) || 1),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit Price (MVR)</label>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    disabled={Boolean(editingRequest.isDonation)}
                    value={editingRequest.unitPriceMvr}
                    onChange={(e) =>
                      setEditingRequest({
                        ...editingRequest,
                        unitPriceMvr: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor</label>
                  <input
                    type="text"
                    value={editingRequest.vendorName || ''}
                    onChange={(e) => setEditingRequest({ ...editingRequest, vendorName: e.target.value })}
                    placeholder="Vendor name"
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quote Ref</label>
                  <input
                    type="text"
                    value={editingRequest.vendorQuoteRef || ''}
                    onChange={(e) => setEditingRequest({ ...editingRequest, vendorQuoteRef: e.target.value })}
                    placeholder="QT-2026-..."
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Invoice #</label>
                  <input
                    type="text"
                    value={editingRequest.invoiceNumber || ''}
                    onChange={(e) => setEditingRequest({ ...editingRequest, invoiceNumber: e.target.value })}
                    placeholder="INV-..."
                    className="w-full px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-1 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingRequest.isDonation)}
                    onChange={(e) =>
                      setEditingRequest({
                        ...editingRequest,
                        isDonation: e.target.checked,
                        unitPriceMvr: e.target.checked ? 0 : editingRequest.unitPriceMvr,
                      })
                    }
                    className="w-4 h-4 accent-emerald-700"
                  />
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    Book Drive / Donor Attribution
                  </span>
                </label>

                {editingRequest.isDonation && (
                  <input
                    type="text"
                    value={editingRequest.donorName || ''}
                    onChange={(e) => setEditingRequest({ ...editingRequest, donorName: e.target.value })}
                    placeholder="Donor Name for inside-cover bookplate"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                )}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingRequest(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const { id, ...rest } = editingRequest;
                  await onUpdateRequest(id, rest);
                  setEditingRequest(null);
                  toast.success('Acquisition entry updated.', 'Saved');
                }}
                className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* NEW PURCHASE ORDER / DONATION MODAL */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl w-full max-w-xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <h4 className="text-sm font-black text-slate-900 dark:text-white">
                {newIsDonation ? 'Log Donated Books & Book Drive' : 'Create Direct Purchase Order'}
              </h4>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateDirectEntry} className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Book Title *</label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Title"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Author</label>
                  <input
                    type="text"
                    value={newAuthor}
                    onChange={(e) => setNewAuthor(e.target.value)}
                    placeholder="Author"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">ISBN</label>
                  <input
                    type="text"
                    value={newIsbn}
                    onChange={(e) => setNewIsbn(e.target.value)}
                    placeholder="978..."
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Language</label>
                  <select
                    value={newLang}
                    onChange={(e) => setNewLang(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    <option value="English">English</option>
                    <option value="Dhivehi">Dhivehi</option>
                    <option value="Arabic">Arabic</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Category</label>
                  <select
                    value={newCat}
                    onChange={(e) => setNewCat(e.target.value as AcquisitionBudgetCategory)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                  >
                    {BUDGET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              {newIsDonation ? (
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-2">
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Donor Name *</label>
                    <input
                      type="text"
                      required
                      value={newDonorName}
                      onChange={(e) => setNewDonorName(e.target.value)}
                      placeholder="e.g. F. Magoodhoo Alumni Association"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Copies</label>
                    <input
                      type="number"
                      min={1}
                      value={newQty}
                      onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Qty</label>
                    <input
                      type="number"
                      min={1}
                      value={newQty}
                      onChange={(e) => setNewQty(Math.max(1, Number(e.target.value) || 1))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Unit MVR</label>
                    <input
                      type="number"
                      min={0}
                      value={newPriceMvr}
                      onChange={(e) => setNewPriceMvr(Math.max(0, Number(e.target.value) || 0))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Vendor</label>
                    <input
                      type="text"
                      value={newVendor}
                      onChange={(e) => setNewVendor(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Quote / Inv</label>
                    <input
                      type="text"
                      value={newQuoteRef}
                      onChange={(e) => setNewQuoteRef(e.target.value)}
                      placeholder="QT-..."
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Notes / Justification</label>
                <input
                  type="text"
                  value={newJustification}
                  onChange={(e) => setNewJustification(e.target.value)}
                  placeholder="Optional curriculum or book drive notes"
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-black cursor-pointer"
                >
                  {newIsDonation ? 'Save Donation Entry' : 'Save Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
