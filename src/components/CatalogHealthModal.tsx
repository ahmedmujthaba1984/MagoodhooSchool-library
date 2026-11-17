import React, { useEffect, useMemo, useState } from 'react';
import {
  X, Sparkles, CheckCircle2, AlertTriangle, Copy, ShieldCheck,
  Loader2, Check, Layers, BookOpen
} from 'lucide-react';
import { Book } from '../types';
import {
  analyzeCatalogHealth,
  CatalogHealthIssueType,
  CatalogHealthProposal,
} from '../lib/catalogHealth';
import { enrichCatalogHealthProposals } from '../services/ai';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { AiPanelSkeleton } from './Skeletons';

interface CatalogHealthModalProps {
  isOpen: boolean;
  onClose: () => void;
  books: Book[];
  onApplyBulkFixes: (updates: Array<{ id: string; data: Partial<Book> }>) => Promise<void> | void;
  onNavigateTab?: (tab: string) => void;
}

type IssueFilter = 'all' | 'ddc' | 'metadata' | 'author' | 'duplicates';

export const CatalogHealthModal: React.FC<CatalogHealthModalProps> = ({
  isOpen,
  onClose,
  books,
  onApplyBulkFixes,
  onNavigateTab,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();

  const report = useMemo(() => analyzeCatalogHealth(books), [books]);

  const [filter, setFilter] = useState<IssueFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [aiEnhancedNotes, setAiEnhancedNotes] = useState<string>('');
  const [aiSource, setAiSource] = useState<'gemini' | 'deterministic_fallback' | null>(null);
  const [isEnriching, setIsEnriching] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Sync defaults when modal opens or books list changes
  useEffect(() => {
    if (!isOpen) return;
    const defaults: Record<string, boolean> = {};
    const vals: Record<string, string> = {};
    for (const p of report.proposals) {
      defaults[p.id] = p.selectedByDefault && p.autoFixable;
      vals[p.id] = p.proposedValue;
    }
    setSelectedIds(defaults);
    setEditedValues(vals);
  }, [isOpen, report.proposals]);

  const filteredProposals = useMemo(() => {
    return report.proposals.filter((p) => {
      if (filter === 'ddc') return p.issueType === 'missing_ddc';
      if (filter === 'metadata') {
        return (
          p.issueType === 'missing_synopsis' ||
          p.issueType === 'missing_cover' ||
          p.issueType === 'missing_grade_lang'
        );
      }
      if (filter === 'author') return p.issueType === 'author_formatting';
      if (filter === 'duplicates') return p.issueType === 'duplicate_candidate';
      return true;
    });
  }, [report.proposals, filter]);

  const selectedFixableCount = useMemo(
    () => report.proposals.filter((p) => p.autoFixable && selectedIds[p.id]).length,
    [report.proposals, selectedIds]
  );

  if (!isOpen) return null;

  const scoreTone =
    report.healthScore >= 85
      ? 'text-emerald-700 dark:text-emerald-400'
      : report.healthScore >= 65
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-rose-600 dark:text-rose-400';

  const scoreBarColor =
    report.healthScore >= 85
      ? 'bg-emerald-600'
      : report.healthScore >= 65
      ? 'bg-amber-500'
      : 'bg-rose-600';

  const handleRunAiEnrich = async () => {
    const flaggedBookIds: string[] = Array.from(
      new Set<string>(report.proposals.filter((p) => p.autoFixable).map((p) => p.bookId))
    );
    if (flaggedBookIds.length === 0) {
      toast.info('No fixable metadata gaps remain in the catalog.', 'Catalog Healthy');
      return;
    }
    setIsEnriching(true);
    try {
      const res = await enrichCatalogHealthProposals({ books, flaggedBookIds });
      const patchByBook = new Map(res.patches.map((pt) => [pt.bookId, pt]));
      setEditedValues((prev) => {
        const next = { ...prev };
        for (const p of report.proposals) {
          const patch = patchByBook.get(p.bookId);
          if (!patch) continue;
          if (p.field === 'ddcCallNumber' && patch.ddcCallNumber) next[p.id] = patch.ddcCallNumber;
          if (p.field === 'description' && patch.description) next[p.id] = patch.description;
          if (p.field === 'targetGrade' && patch.targetGrade) next[p.id] = patch.targetGrade;
          if (p.field === 'bookLanguage' && patch.bookLanguage) next[p.id] = patch.bookLanguage;
          if (p.field === 'author' && patch.author) next[p.id] = patch.author;
        }
        return next;
      });
      setAiEnhancedNotes(res.summary);
      setAiSource(res.source);
      toast.success(res.summary, res.source === 'gemini' ? 'Gemini AI Audit Ready' : 'Smart Audit Ready');
    } catch {
      toast.warning('Using deterministic catalog enrichment proposals.', 'AI Notice');
    } finally {
      setIsEnriching(false);
    }
  };

  const handleSelectAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = { ...prev };
      for (const p of filteredProposals) {
        if (p.autoFixable) next[p.id] = checked;
      }
      return next;
    });
  };

  const handleApplySelected = async () => {
    const chosen = report.proposals.filter((p) => p.autoFixable && selectedIds[p.id]);
    if (chosen.length === 0) {
      toast.warning('Select at least one fix proposal to apply.', 'No Fixes Selected');
      return;
    }

    const patchMap = new Map<string, Partial<Book>>();
    for (const p of chosen) {
      const val = (editedValues[p.id] ?? p.proposedValue).trim();
      if (!val) continue;
      const existing = patchMap.get(p.bookId) || {};
      const nextPatch: Partial<Book> = { ...existing, ...(p.extraPatch || {}) };
      if (p.field === 'ddcCallNumber') nextPatch.ddcCallNumber = val;
      if (p.field === 'description') nextPatch.description = val;
      if (p.field === 'author') nextPatch.author = val;
      if (p.field === 'targetGrade') nextPatch.targetGrade = val;
      if (p.field === 'coverUrl') nextPatch.coverUrl = val;
      if (p.field === 'bookLanguage') {
        if (val === 'Dhivehi' || val === 'English' || val === 'Arabic' || val === 'Other') {
          nextPatch.bookLanguage = val;
        }
      }
      patchMap.set(p.bookId, nextPatch);
    }

    const updates = Array.from(patchMap.entries()).map(([id, data]) => ({ id, data }));
    if (updates.length === 0) return;

    setIsApplying(true);
    try {
      await onApplyBulkFixes(updates);
      toast.success(
        language === 'dv'
          ? `${updates.length} ފޮތުގެ ކެޓަލޮގް މަޢުލޫމާތު އިޞްލާޙުކުރެވިއްޖެ!`
          : `Applied ${chosen.length} catalog fix(es) across ${updates.length} title(s).`,
        'Catalog Health Updated'
      );
    } finally {
      setIsApplying(false);
    }
  };

  const issueCountLabel = (type: CatalogHealthIssueType) => report.countsByType[type] || 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/70 dark:bg-slate-900">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white truncate">
                {language === 'dv'
                  ? 'ކެޓަލޮގް ހެލްތު އޮޑިޓް & ބަލްކް ފިކްސް'
                  : 'Catalog Health Audit & Bulk Fix Proposals'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {language === 'dv'
                  ? 'މަދުވާ DDC ކޯޑާއި، ސައިނޮޕްސިސް، މުޞަންނިފުންގެ ނަން އަދި ޑުޕްލިކޭޓް ފޮތްތައް ދެނެގަނެ އިޞްލާޙުކުރުން'
                  : 'Human-in-the-loop quality audit for DDC codes, synopses, grade/language tags, author formatting & duplicates'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer shrink-0"
            aria-label="Close Catalog Health Audit"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Score Overview + AI Trigger */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center bg-white dark:bg-slate-900">
          <div className="lg:col-span-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Catalog Health Score
              </span>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                <bdi>{report.healthyTitles}/{report.totalTitles}</bdi> clean
              </span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-black font-mono tabular-nums ${scoreTone}`}>
                <bdi>{report.healthScore}%</bdi>
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                · <bdi className="font-mono font-bold">{report.proposals.length}</bdi> flagged items
              </span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${scoreBarColor}`}
                style={{ width: `${report.healthScore}%` }}
              />
            </div>
          </div>

          <div className="lg:col-span-5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">DDC</div>
              <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {report.breakdown.classificationPct}%
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Synopsis</div>
              <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {report.breakdown.metadataPct}%
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Tags</div>
              <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {report.breakdown.audienceLangPct}%
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
              <div className="text-[10px] font-bold uppercase text-slate-500 dark:text-slate-400">Authors</div>
              <div className="text-base font-black font-mono tabular-nums text-slate-900 dark:text-white mt-0.5">
                {report.breakdown.authorAndUniquenessPct}%
              </div>
            </div>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleRunAiEnrich}
              disabled={isEnriching || report.proposals.length === 0}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer transition"
            >
              {isEnriching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4 text-emerald-400 dark:text-white" />}
              <span>{isEnriching ? 'Enriching via AI...' : 'AI Enrich Proposals'}</span>
            </button>
            {aiEnhancedNotes && (
              <div className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold leading-snug">
                {aiSource === 'gemini' ? 'Gemini AI:' : 'Smart Audit:'} {aiEnhancedNotes}
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="inline-flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold overflow-x-auto max-w-full">
            {(
              [
                { id: 'all', label: `All (${report.proposals.length})` },
                { id: 'ddc', label: `Missing DDC (${issueCountLabel('missing_ddc')})` },
                {
                  id: 'metadata',
                  label: `Metadata (${
                    issueCountLabel('missing_synopsis') +
                    issueCountLabel('missing_cover') +
                    issueCountLabel('missing_grade_lang')
                  })`,
                },
                { id: 'author', label: `Authors (${issueCountLabel('author_formatting')})` },
                { id: 'duplicates', label: `Duplicates (${issueCountLabel('duplicate_candidate')})` },
              ] as Array<{ id: IssueFilter; label: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg transition whitespace-nowrap cursor-pointer ${
                  filter === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => handleSelectAllVisible(true)}
              className="font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
            >
              Select All Fixable
            </button>
            <span className="text-slate-300 dark:text-slate-700">·</span>
            <button
              type="button"
              onClick={() => handleSelectAllVisible(false)}
              className="font-bold text-slate-600 dark:text-slate-400 hover:underline cursor-pointer"
            >
              Clear Selection
            </button>
          </div>
        </div>

        {/* Proposal Rows */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {isEnriching && <AiPanelSkeleton rows={4} />}
          {filteredProposals.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">
                {report.proposals.length === 0
                  ? 'Catalog Health is 100% Clean'
                  : 'No issues match the active filter'}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Every title has valid DDC call numbers, bilingual synopses, target grades, and consistent author formatting.
              </p>
            </div>
          ) : (
            filteredProposals.map((proposal: CatalogHealthProposal) => {
              const isSelected = Boolean(selectedIds[proposal.id]);
              const editedVal = editedValues[proposal.id] ?? proposal.proposedValue;
              return (
                <div
                  key={proposal.id}
                  className={`p-4 rounded-2xl border transition ${
                    proposal.issueType === 'duplicate_candidate'
                      ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/60'
                      : isSelected
                      ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                      : 'bg-white dark:bg-slate-800/40 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="pt-0.5 shrink-0">
                      {proposal.autoFixable ? (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) =>
                            setSelectedIds((prev) => ({ ...prev, [proposal.id]: e.target.checked }))
                          }
                          className="w-4 h-4 rounded accent-emerald-700 cursor-pointer"
                        />
                      ) : (
                        <Copy className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <BookOpen className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                            <bdi>{proposal.bookTitle}</bdi>
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                            · <bdi>{proposal.author}</bdi>
                          </span>
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${
                            proposal.severity === 'high'
                              ? 'text-rose-700 dark:text-rose-400'
                              : proposal.severity === 'medium'
                              ? 'text-amber-700 dark:text-amber-400'
                              : 'text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          {proposal.label}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center text-xs">
                        <div className="md:col-span-4 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 truncate">
                          <span className="text-[10px] font-bold uppercase text-slate-400 block">Current</span>
                          <span className="font-mono text-[11px]"><bdi>{proposal.currentValue}</bdi></span>
                        </div>

                        <div className="md:col-span-8">
                          {proposal.autoFixable ? (
                            <div>
                              <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-400 block mb-1">
                                Proposed Fix (Editable before apply)
                              </span>
                              {proposal.field === 'description' ? (
                                <textarea
                                  rows={2}
                                  value={editedVal}
                                  onChange={(e) =>
                                    setEditedValues((prev) => ({ ...prev, [proposal.id]: e.target.value }))
                                  }
                                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-slate-100 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                />
                              ) : (
                                <input
                                  type="text"
                                  value={editedVal}
                                  onChange={(e) =>
                                    setEditedValues((prev) => ({ ...prev, [proposal.id]: e.target.value }))
                                  }
                                  className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 text-xs text-slate-900 dark:text-slate-100 font-mono font-bold focus:outline-none focus:ring-2 focus:ring-emerald-600"
                                />
                              )}
                            </div>
                          ) : (
                            <div className="px-3 py-2 rounded-xl bg-rose-100/70 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-200 flex items-center justify-between gap-2">
                              <div>
                                <div className="font-bold flex items-center gap-1.5">
                                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                  <span>{proposal.proposedValue}</span>
                                </div>
                                <div className="text-[11px] opacity-80">{proposal.rationale}</div>
                              </div>
                              {onNavigateTab && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onClose();
                                    onNavigateTab('admin-panel');
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-[11px] font-bold shrink-0 cursor-pointer"
                                >
                                  Inspect Inventory
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {proposal.autoFixable && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                          <Layers className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{proposal.rationale}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
            <strong className="font-mono tabular-nums text-slate-900 dark:text-white">{selectedFixableCount}</strong>{' '}
            proposal(s) queued for batch update & immutable audit logging
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={isApplying || selectedFixableCount === 0}
              onClick={() => void handleApplySelected()}
              className="px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer transition"
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              <span>Apply Selected Fixes ({selectedFixableCount})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
