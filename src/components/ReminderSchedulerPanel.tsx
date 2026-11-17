import React, { useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  History,
  Lock,
  Mail,
  PauseCircle,
  PlayCircle,
  Send,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  AuditActionType,
  AuditLogEntry,
  Book,
  LibrarySettings,
  Loan,
  ReminderCadence,
  ReminderScheduleConfig,
  UserProfile,
} from '../types';
import { useLanguage } from '../lib/i18n';
import { useToast } from '../lib/toast';
import { buildMailtoHref } from '../lib/notifications';
import { DEFAULT_MALDIVES_SCHOOL_HOLIDAYS } from '../lib/schoolCalendar';
import {
  getPredictiveInsights,
  HighRiskLoanAlert,
  ReminderChannel,
} from '../services/ai/insightsService';
import {
  computeNextScheduledRun,
  generatePersonalizedBilingualDraft,
  PersonalizedBilingualDraft,
  predictScheduledReminders,
  resolveReminderSchedulerConfig,
  ScheduledReminderCandidate,
} from '../lib/reminderScheduler';

interface ReminderSchedulerPanelProps {
  books: Book[];
  loans: Loan[];
  users: UserProfile[];
  settings: LibrarySettings;
  canEditPolicy: boolean;
  onUpdateSettings: (newSettings: Partial<LibrarySettings>) => void;
  onRecordAuditEvent?: (params: {
    action: AuditActionType;
    targetType: AuditLogEntry['targetType'];
    targetId: string;
    details: string;
  }) => Promise<void> | void;
}

type QueueFilter = 'flagged' | 'preventive' | 'critical' | 'all';

const CADENCE_OPTIONS: Array<{ value: ReminderCadence; labelEn: string; labelDv: string }> = [
  {
    value: 'daily_school_morning',
    labelEn: 'Daily School Morning (Sun–Thu)',
    labelDv: 'ސްކޫލް ކޮންމެ ދުވަހަކު ހެނދުނު (އާދީއްތަ–ބުރާސްފަތި)',
  },
  {
    value: 'twice_weekly_sun_wed',
    labelEn: 'Twice Weekly (Sun & Wed)',
    labelDv: 'ހަފްތާއަކު 2 ފަހަރު (އާދީއްތަ / ބުދަ)',
  },
  {
    value: 'before_due_2d',
    labelEn: '2 School Days Before Due Date',
    labelDv: 'ސުންގަޑީގެ 2 ސްކޫލް ދުވަސް ކުރިން',
  },
];

const RISK_LEVEL_BADGE: Record<
  ScheduledReminderCandidate['riskLevel'],
  { labelEn: string; labelDv: string; classes: string }
> = {
  CRITICAL: {
    labelEn: 'CRITICAL',
    labelDv: 'އިސްކަންދޭންޖެހޭ',
    classes:
      'bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200 border-rose-200 dark:border-rose-800',
  },
  ELEVATED: {
    labelEn: 'ELEVATED',
    labelDv: 'ސަމާލުވާންޖެހޭ',
    classes:
      'bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800',
  },
  WATCH: {
    labelEn: 'WATCH',
    labelDv: 'ބަލާލެވޭ',
    classes:
      'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700',
  },
};

export const ReminderSchedulerPanel: React.FC<ReminderSchedulerPanelProps> = ({
  books,
  loans,
  users,
  settings,
  canEditPolicy,
  onUpdateSettings,
  onRecordAuditEvent,
}) => {
  const { language } = useLanguage();
  const { toast } = useToast();
  const isDv = language === 'dv';

  const resolvedSavedConfig = useMemo(
    () => resolveReminderSchedulerConfig(settings),
    [settings]
  );

  const [scheduleDraft, setScheduleDraft] = useState<ReminderScheduleConfig>(resolvedSavedConfig);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('flagged');
  const [isScanningAi, setIsScanningAi] = useState(false);
  const [aiExecutiveSummary, setAiExecutiveSummary] = useState<string | null>(null);
  const [aiHighRiskLoans, setAiHighRiskLoans] = useState<HighRiskLoanAlert[]>([]);

  const [draftsByLoanId, setDraftsByLoanId] = useState<
    Record<string, PersonalizedBilingualDraft>
  >({});
  const [channelByLoanId, setChannelByLoanId] = useState<Record<string, ReminderChannel>>({});
  const [draftingLoanId, setDraftingLoanId] = useState<string | null>(null);
  const [isBatchDrafting, setIsBatchDrafting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [dispatchedIds, setDispatchedIds] = useState<Record<string, string>>({});

  const effectiveSettings = useMemo<LibrarySettings>(
    () => ({
      ...settings,
      reminderScheduler: scheduleDraft,
    }),
    [settings, scheduleDraft]
  );

  const nextRunInfo = useMemo(
    () =>
      computeNextScheduledRun(
        scheduleDraft,
        settings.schoolHolidays ?? DEFAULT_MALDIVES_SCHOOL_HOLIDAYS
      ),
    [scheduleDraft, settings.schoolHolidays]
  );

  const allPredictions = useMemo(
    () =>
      predictScheduledReminders({
        loans,
        users,
        books,
        settings: effectiveSettings,
        aiHighRiskLoans,
      }),
    [loans, users, books, effectiveSettings, aiHighRiskLoans]
  );

  const flaggedPredictions = useMemo(
    () =>
      allPredictions.filter(
        (item) => item.riskScore >= scheduleDraft.riskThresholdPct || !item.isPreventive
      ),
    [allPredictions, scheduleDraft.riskThresholdPct]
  );

  const preventiveCount = useMemo(
    () => flaggedPredictions.filter((item) => item.isPreventive).length,
    [flaggedPredictions]
  );

  const criticalCount = useMemo(
    () => flaggedPredictions.filter((item) => item.riskLevel === 'CRITICAL').length,
    [flaggedPredictions]
  );

  const visibleCandidates = useMemo(() => {
    switch (queueFilter) {
      case 'preventive':
        return flaggedPredictions.filter((c) => c.isPreventive);
      case 'critical':
        return flaggedPredictions.filter((c) => c.riskLevel === 'CRITICAL');
      case 'all':
        return allPredictions;
      case 'flagged':
      default:
        return flaggedPredictions;
    }
  }, [queueFilter, flaggedPredictions, allPredictions]);

  const handleSaveSchedule = async () => {
    if (!canEditPolicy) return;
    onUpdateSettings({
      reminderScheduler: scheduleDraft,
      notifyParentOnOverdue: scheduleDraft.notifyParentsForStudents,
      enableAutoDueDateAlerts: scheduleDraft.enabled,
    });
    if (onRecordAuditEvent) {
      await onRecordAuditEvent({
        action: 'REMINDER_SCHEDULE_UPDATED',
        targetType: 'policy',
        targetId: 'reminderScheduler',
        details: `Updated Automated Reminder Scheduler (${scheduleDraft.enabled ? 'Enabled' : 'Paused'}, ${scheduleDraft.cadence} @ ${scheduleDraft.runTimeLocal}, threshold ${scheduleDraft.riskThresholdPct}%, channel ${scheduleDraft.defaultChannel}).`,
      });
    }
    toast.success(
      isDv
        ? 'އޮޓޮމެޓިކް ރިމައިންޑަރ ޝެޑިއުލް ސޭވްކުރެވިއްޖެ.'
        : 'Automated reminder schedule saved and synced.',
      'Schedule Updated'
    );
  };

  const handleRunRiskScan = async () => {
    setIsScanningAi(true);
    try {
      const result = await getPredictiveInsights({
        books,
        loans,
        language: isDv ? 'dv' : 'en',
      });
      setAiHighRiskLoans(result.highRiskLoans || []);
      setAiExecutiveSummary(result.executiveSummary || null);
      toast.success(
        isDv
          ? `${result.highRiskLoans.length} ލޯންގެ ތާރީޚީ ރިސްކް ސްކޭން ފުރިހަމަވެއްޖެ.`
          : `Analyzed loan history & scored ${allPredictions.length} active loan(s).`,
        'Risk Scan Complete'
      );
    } finally {
      setIsScanningAi(false);
    }
  };

  const handleDraftSingle = async (candidate: ScheduledReminderCandidate) => {
    const channel = channelByLoanId[candidate.loan.id] || scheduleDraft.defaultChannel;
    setDraftingLoanId(candidate.loan.id);
    try {
      const draft = await generatePersonalizedBilingualDraft({
        candidate,
        channel,
        includeBilingual: scheduleDraft.includeBilingual,
      });
      setDraftsByLoanId((prev) => ({ ...prev, [candidate.loan.id]: draft }));
    } finally {
      setDraftingLoanId(null);
    }
  };

  const handleBatchDraftTop = async () => {
    const targets = visibleCandidates.slice(0, 5);
    if (targets.length === 0) {
      toast.info('No active loans in the current filter to draft.', 'Queue Empty');
      return;
    }
    setIsBatchDrafting(true);
    try {
      const results = await Promise.all(
        targets.map((candidate) =>
          generatePersonalizedBilingualDraft({
            candidate,
            channel: channelByLoanId[candidate.loan.id] || scheduleDraft.defaultChannel,
            includeBilingual: scheduleDraft.includeBilingual,
          })
        )
      );
      setDraftsByLoanId((prev) => {
        const next = { ...prev };
        results.forEach((d) => {
          next[d.loanId] = d;
        });
        return next;
      });

      const runTimestamp = new Date().toISOString();
      const updatedConfig: ReminderScheduleConfig = {
        ...scheduleDraft,
        lastAutoRunAt: runTimestamp,
      };
      setScheduleDraft(updatedConfig);
      if (canEditPolicy) {
        onUpdateSettings({ reminderScheduler: updatedConfig });
      }
      if (onRecordAuditEvent) {
        await onRecordAuditEvent({
          action: 'REMINDER_BATCH_QUEUED',
          targetType: 'notification',
          targetId: `batch-${runTimestamp.slice(0, 10)}`,
          details: `Generated ${results.length} personalized bilingual reminder draft(s) via ${scheduleDraft.defaultChannel.toUpperCase()} (threshold ${scheduleDraft.riskThresholdPct}%).`,
        });
      }
      toast.success(
        isDv
          ? `${results.length} ޕެޓްރަންއަށް ޚާއްޞަ ދިވެހި/އިނގިރޭސި މެސެޖު ޑްރާފްޓްކުރެވިއްޖެ.`
          : `Prepared ${results.length} personalized bilingual reminder draft(s).`,
        'Batch Drafts Ready'
      );
    } finally {
      setIsBatchDrafting(false);
    }
  };

  const handleCopyDraft = async (loanId: string, bodyEn: string, bodyDv: string) => {
    const payload = bodyDv ? `${bodyEn}\n\n---\n${bodyDv}` : bodyEn;
    try {
      await navigator.clipboard.writeText(payload);
      setCopiedId(loanId);
      setTimeout(() => setCopiedId((prev) => (prev === loanId ? null : prev)), 2000);
      toast.success(
        isDv ? 'ވަޓްސްއެޕް / ވައިބަރ އަށް ކޮޕީކުރެވިއްޖެ!' : 'Copied reminder to clipboard.',
        'Copied'
      );
    } catch {
      toast.error('Clipboard access is unavailable in this browser context.', 'Copy Failed');
    }
  };

  const handleCopyDigest = async () => {
    if (flaggedPredictions.length === 0) {
      toast.info('No flagged loans in queue to export.', 'Nothing to Copy');
      return;
    }
    const digestLines = flaggedPredictions.map((c, idx) => {
      const existing = draftsByLoanId[c.loan.id];
      const previewLine = existing
        ? existing.bodyEn.split('\n').filter(Boolean)[0] || ''
        : c.reasonsEn.join(' · ');
      return `${idx + 1}. ${c.loan.userName} (${c.gradeClass}) — "${c.loan.bookTitle}" | Risk ${c.riskScore}% (${c.riskLevel}) | Due ${c.loan.dueDate} | ${previewLine}`;
    });
    const text = `F. Magoodhoo School Library — Scheduled Reminder Digest (${new Date().toISOString().split('T')[0]})\n${digestLines.join('\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied full reminder digest to clipboard.', 'Digest Copied');
    } catch {
      toast.error('Clipboard access unavailable.', 'Copy Failed');
    }
  };

  const handleMarkDispatched = async (candidate: ScheduledReminderCandidate) => {
    const channel =
      draftsByLoanId[candidate.loan.id]?.channel ||
      channelByLoanId[candidate.loan.id] ||
      scheduleDraft.defaultChannel;
    const nowIso = new Date().toISOString();
    setDispatchedIds((prev) => ({ ...prev, [candidate.loan.id]: nowIso }));
    if (onRecordAuditEvent) {
      await onRecordAuditEvent({
        action: 'NOTIFICATION_SENT',
        targetType: 'notification',
        targetId: candidate.loan.id,
        details: `Dispatched ${candidate.isPreventive ? 'preventive' : 'overdue'} ${channel.toUpperCase()} reminder for ${candidate.loan.userName} ("${candidate.loan.bookTitle}", risk ${candidate.riskScore}%).`,
      });
    }
    toast.success(
      isDv
        ? `${candidate.loan.userName} ގެ ރިމައިންޑަރ ފޮނުވުނުކަން އޮޑިޓްގައި ރެކޯޑުކުރެވިއްޖެ.`
        : `Logged dispatched ${channel.toUpperCase()} reminder for ${candidate.loan.userName}.`,
      'Dispatch Logged'
    );
  };

  return (
    <div className="space-y-6">
      {/* Schedule Configuration Card */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              {isDv
                ? 'ލޯން ތާރީޚުގެ މައްޗަށް ބިނާވާ އޮޓޮމޭޝަން'
                : 'Predictive Loan-History Automation'}
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
              <CalendarClock className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>
                {isDv
                  ? 'އޮޓޮމެޓިކް ރިމައިންޑަރ ޝެޑިއުލަރ (EN / DV)'
                  : 'Automated Reminder Scheduler'}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {isDv
                ? 'މެމްބަރުންގެ ކުރީގެ ފޮތް ޙަވާލުކުރުމުގެ ތާރީޚާއި ސްކޫލް ކަލަންޑަރަށް ބަލައި، ލަސްވުމުގެ ކުރިން ދިވެހި އަދި އިނގިރޭސި ރިމައިންޑަރ ތައްޔާރުކޮށްދޭ ނިޒާމު.'
                : 'Scores active loans using patron return history, renewals, and Sun–Thu school days to draft proactive bilingual reminders before overdue fines accrue.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!canEditPolicy}
              onClick={() =>
                setScheduleDraft((prev) => ({ ...prev, enabled: !prev.enabled }))
              }
              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60 ${
                scheduleDraft.enabled
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              id="scheduler-toggle-enabled-btn"
            >
              {scheduleDraft.enabled ? (
                <PlayCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
              ) : (
                <PauseCircle className="w-4 h-4 text-slate-500 dark:text-slate-400 shrink-0" />
              )}
              <span>
                {scheduleDraft.enabled
                  ? isDv
                    ? 'ޝެޑިއުލަރ އެކްޓިވް'
                    : 'Scheduler Active'
                  : isDv
                  ? 'މެދުކަނޑާލެވިފައި'
                  : 'Scheduler Paused'}
              </span>
            </button>

            <button
              type="button"
              disabled={!canEditPolicy}
              onClick={handleSaveSchedule}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-45"
              id="scheduler-save-config-btn"
            >
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span>{isDv ? 'ޝެޑިއުލް ސޭވްކުރޭ' : 'Save Schedule'}</span>
            </button>
          </div>
        </div>

        {/* Rule Controls Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <label
              htmlFor="scheduler-cadence-select"
              className="text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              {isDv ? 'ރަންކުރާނެ ތާވަލު' : 'School-Week Cadence'}
            </label>
            <select
              id="scheduler-cadence-select"
              disabled={!canEditPolicy}
              value={scheduleDraft.cadence}
              onChange={(e) =>
                setScheduleDraft((prev) => ({
                  ...prev,
                  cadence: e.target.value as ReminderCadence,
                }))
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              {CADENCE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {isDv ? opt.labelDv : opt.labelEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scheduler-time-input"
              className="text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              {isDv ? 'ފޮނުވާނެ ގަޑި' : 'Dispatch Time (MVR/Local)'}
            </label>
            <input
              id="scheduler-time-input"
              type="time"
              disabled={!canEditPolicy}
              value={scheduleDraft.runTimeLocal}
              onChange={(e) =>
                setScheduleDraft((prev) => ({
                  ...prev,
                  runTimeLocal: e.target.value || '08:30',
                }))
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 disabled:opacity-60"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scheduler-threshold-select"
              className="text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              {isDv ? 'ރިސްކް ތްރެޝްހޯލްޑް' : 'Minimum Overdue Risk Trigger'}
            </label>
            <select
              id="scheduler-threshold-select"
              disabled={!canEditPolicy}
              value={scheduleDraft.riskThresholdPct}
              onChange={(e) =>
                setScheduleDraft((prev) => ({
                  ...prev,
                  riskThresholdPct: Number(e.target.value),
                }))
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              <option value={40}>40%+ (Early Preventive)</option>
              <option value={50}>50%+ (Balanced School Default)</option>
              <option value={65}>65%+ (High Risk Only)</option>
              <option value={75}>75%+ (Critical Priority)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="scheduler-channel-select"
              className="text-xs font-bold text-slate-700 dark:text-slate-200"
            >
              {isDv ? 'ޑިފޯލްޓް ޗެނަލް' : 'Default Delivery Channel'}
            </label>
            <select
              id="scheduler-channel-select"
              disabled={!canEditPolicy}
              value={scheduleDraft.defaultChannel}
              onChange={(e) =>
                setScheduleDraft((prev) => ({
                  ...prev,
                  defaultChannel: e.target.value as ReminderChannel,
                }))
              }
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-slate-100 disabled:opacity-60"
            >
              <option value="whatsapp">WhatsApp / Viber Notice</option>
              <option value="sms">Compact SMS (&lt;240 chars)</option>
              <option value="email">Official School Email</option>
            </select>
          </div>
        </div>

        {/* Toggle Checkboxes + Next Run Info */}
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pt-2 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-700 dark:text-slate-200">
            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                disabled={!canEditPolicy}
                checked={scheduleDraft.includeBilingual}
                onChange={(e) =>
                  setScheduleDraft((prev) => ({
                    ...prev,
                    includeBilingual: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>{isDv ? 'ދިވެހި + އިނގިރޭސި ޑްރާފްޓް' : 'Draft Bilingual (EN + DV)'}</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                disabled={!canEditPolicy}
                checked={scheduleDraft.notifyParentsForStudents}
                onChange={(e) =>
                  setScheduleDraft((prev) => ({
                    ...prev,
                    notifyParentsForStudents: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                {isDv
                  ? 'ދަރިވަރުންގެ ބެލެނިވެރިންނަށް ކޮޕީކުރުން'
                  : 'Route Student Notices to Parents'}
              </span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer font-semibold">
              <input
                type="checkbox"
                disabled={!canEditPolicy}
                checked={scheduleDraft.skipMaldivianHolidays}
                onChange={(e) =>
                  setScheduleDraft((prev) => ({
                    ...prev,
                    skipMaldivianHolidays: e.target.checked,
                  }))
                }
                className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600"
              />
              <span>
                {isDv
                  ? 'ބަންދު ދުވަސްތަކާއި ހުކުރު/ހޮނިހިރު ދޫކޮށްލުން'
                  : 'Skip Fri/Sat & Maldivian Holidays'}
              </span>
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
            <span>
              {isDv ? 'ދެން ރަންވާނީ:' : 'Next Window:'}{' '}
              <strong className="text-slate-900 dark:text-white">
                <bdi>{isDv ? nextRunInfo.displayDv : nextRunInfo.displayEn}</bdi>
              </strong>
            </span>
            {scheduleDraft.lastAutoRunAt && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>
                  Last Batch:{' '}
                  <bdi>{scheduleDraft.lastAutoRunAt.replace('T', ' ').slice(0, 16)}</bdi>
                </span>
              </>
            )}
          </div>
        </div>

        {!canEditPolicy && (
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <span>
              Schedule cadence settings are managed by Super Admins. You can run risk scans, draft personalized EN/DV messages, and log dispatches.
            </span>
          </div>
        )}
      </div>

      {/* 3-Stat Prediction Strip */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isDv ? 'ސްކޭންކުރެވުނު އެކްޓިވް ލޯން' : 'Active Loans Evaluated'}
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-slate-900 dark:text-white">
            {allPredictions.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Scored against <span className="font-mono tabular-nums">{loans.length}</span> historical loans
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isDv ? 'ރިމައިންޑަރ ކިއުގައި (≥ ތްރެޝްހޯލްޑް)' : 'Queued for Reminder Dispatch'}
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-rose-700 dark:text-rose-400">
            {flaggedPredictions.length}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
              {criticalCount}
            </span>{' '}
            critical · threshold <span className="font-mono tabular-nums">{scheduleDraft.riskThresholdPct}%+</span>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isDv ? 'ސުންގަޑީގެ ކުރިން ފާހަގަކުރެވުނު' : 'Preventive Pre-Due Catches'}
          </div>
          <div className="text-2xl font-black font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
            {preventiveCount}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            Flagged via patron late-return history &amp; renewals
          </div>
        </div>
      </div>

      {/* Action Toolbar & Queue Cards */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'flagged', labelEn: `Flagged Queue (${flaggedPredictions.length})`, labelDv: `ކިއު (${flaggedPredictions.length})` },
                { id: 'preventive', labelEn: `Preventive (${preventiveCount})`, labelDv: `ޕްރިވެންޓިވް (${preventiveCount})` },
                { id: 'critical', labelEn: `Critical (${criticalCount})`, labelDv: `ކްރިޓިކަލް (${criticalCount})` },
                { id: 'all', labelEn: `All Active (${allPredictions.length})`, labelDv: `ހުރިހާ (${allPredictions.length})` },
              ] as Array<{ id: QueueFilter; labelEn: string; labelDv: string }>
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setQueueFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                  queueFilter === tab.id
                    ? 'bg-slate-900 dark:bg-emerald-700 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                {isDv ? tab.labelDv : tab.labelEn}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={isScanningAi}
              onClick={handleRunRiskScan}
              className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              id="scheduler-run-risk-scan-btn"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
              <span>
                {isScanningAi
                  ? 'Scoring History...'
                  : isDv
                  ? 'ތާރީޚީ ރިސްކް ސްކޭން'
                  : 'Run Historical Risk & AI Scan'}
              </span>
            </button>

            <button
              type="button"
              disabled={isBatchDrafting || visibleCandidates.length === 0}
              onClick={handleBatchDraftTop}
              className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
              id="scheduler-batch-draft-btn"
            >
              <Wand2 className="w-3.5 h-3.5 shrink-0" />
              <span>
                {isBatchDrafting
                  ? 'Drafting Bilingual...'
                  : isDv
                  ? 'ބެޗް ޑްރާފްޓް (ޓޮޕް 5)'
                  : 'Draft Top Queued (Batch)'}
              </span>
            </button>

            <button
              type="button"
              onClick={handleCopyDigest}
              disabled={flaggedPredictions.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-bold border border-slate-800 dark:border-slate-700 transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 shrink-0" />
              <span>{isDv ? 'ޑައިޖެސްޓް ކޮޕީ' : 'Copy Digest'}</span>
            </button>
          </div>
        </div>

        {aiExecutiveSummary && (
          <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>AI Historical Cohort Summary</span>
            </div>
            <p
              dir={isDv ? 'rtl' : 'ltr'}
              className={`text-xs text-slate-800 dark:text-slate-100 leading-relaxed ${
                isDv ? 'font-faruma' : ''
              }`}
            >
              {aiExecutiveSummary}
            </p>
          </div>
        )}

        {visibleCandidates.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 text-xs text-slate-500 dark:text-slate-400">
            No active loans match the selected risk threshold or filter. Lower the threshold or switch to &ldquo;All Active&rdquo; to inspect all open loans.
          </div>
        ) : (
          <div className="space-y-4">
            {visibleCandidates.map((candidate) => {
              const { loan } = candidate;
              const badge = RISK_LEVEL_BADGE[candidate.riskLevel];
              const activeChannel =
                channelByLoanId[loan.id] ||
                draftsByLoanId[loan.id]?.channel ||
                scheduleDraft.defaultChannel;
              const draft = draftsByLoanId[loan.id];
              const isDrafting = draftingLoanId === loan.id;
              const isCopied = copiedId === loan.id;
              const dispatchedAt = dispatchedIds[loan.id];

              const mailHref = draft
                ? buildMailtoHref({
                    toEmail: candidate.recipientEmail,
                    subject: draft.subjectEn,
                    body: draft.bodyDv
                      ? `${draft.bodyEn}\n\n---\n${draft.bodyDv}`
                      : draft.bodyEn,
                  })
                : buildMailtoHref({
                    toEmail: candidate.recipientEmail,
                    subject: `F. Magoodhoo School Library Reminder: "${loan.bookTitle}"`,
                    body: `Assalaamu Alaikum,\n\nReminder regarding "${loan.bookTitle}" borrowed by ${loan.userName} (Due: ${loan.dueDate}).`,
                  });

              return (
                <div
                  key={loan.id}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3"
                >
                  {/* Top Summary Line */}
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded border font-mono tabular-nums text-[10px] font-black ${badge.classes}`}
                        >
                          <bdi>{candidate.riskScore}%</bdi> · {isDv ? badge.labelDv : badge.labelEn}
                        </span>

                        <span className="font-black text-slate-900 dark:text-white">
                          <bdi>{loan.userName}</bdi>
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="text-slate-600 dark:text-slate-300 font-semibold">
                          <bdi>{candidate.gradeClass}</bdi>
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          <bdi>{loan.bookTitle}</bdi>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <span className="font-mono tabular-nums font-bold">
                          Due <bdi>{loan.dueDate}</bdi>
                        </span>
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span
                          className={
                            candidate.isPreventive
                              ? 'font-bold text-emerald-700 dark:text-emerald-400'
                              : 'font-bold text-rose-700 dark:text-rose-400'
                          }
                        >
                          {candidate.isPreventive
                            ? candidate.workingDaysRemaining === 0
                              ? 'Preventive · Due today'
                              : `Preventive · ${candidate.workingDaysRemaining} school day(s) left`
                            : `Overdue · ${Math.max(1, candidate.workingDaysOverdue)} school day(s)`}
                        </span>
                        {candidate.estimatedFineMvr > 0 && (
                          <>
                            <span className="text-slate-300 dark:text-slate-600">·</span>
                            <span className="font-mono tabular-nums font-bold text-rose-700 dark:text-rose-400">
                              <bdi>MVR {candidate.estimatedFineMvr.toFixed(2)}</bdi>
                            </span>
                          </>
                        )}
                        <span className="text-slate-300 dark:text-slate-600">·</span>
                        <span className="inline-flex items-center gap-1">
                          <History className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {isDv ? candidate.historicalSummaryDv : candidate.historicalSummaryEn}
                          </span>
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        <span>
                          {isDv ? candidate.reasonsDv.join(' · ') : candidate.reasonsEn.join(' · ')}
                        </span>
                        <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
                        <span>
                          Recipient: <strong className="text-slate-700 dark:text-slate-200"><bdi>{candidate.recipientLabel}</bdi></strong>
                          {candidate.recipientPhone ? (
                            <>
                              {' '}
                              (<bdi className="font-mono tabular-nums">{candidate.recipientPhone}</bdi>)
                            </>
                          ) : null}
                        </span>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
                        aria-label={`Channel for ${loan.userName}`}
                        value={activeChannel}
                        onChange={(e) =>
                          setChannelByLoanId((prev) => ({
                            ...prev,
                            [loan.id]: e.target.value as ReminderChannel,
                          }))
                        }
                        className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-bold text-slate-800 dark:text-slate-100 cursor-pointer"
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="sms">SMS</option>
                        <option value="email">Email</option>
                      </select>

                      <button
                        type="button"
                        disabled={isDrafting}
                        onClick={() => handleDraftSingle(candidate)}
                        className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-emerald-700 hover:bg-slate-800 dark:hover:bg-emerald-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                      >
                        <Wand2 className="w-3.5 h-3.5 shrink-0" />
                        <span>
                          {isDrafting
                            ? 'Drafting...'
                            : draft
                            ? 'Regenerate Draft'
                            : 'Draft EN + DV'}
                        </span>
                      </button>

                      {draft && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleCopyDraft(loan.id, draft.bodyEn, draft.bodyDv)
                            }
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 shrink-0" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 shrink-0" />
                            )}
                            <span>{isCopied ? 'Copied' : 'Copy'}</span>
                          </button>

                          <a
                            href={mailHref}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <Mail className="w-3.5 h-3.5 shrink-0" />
                            <span>Email</span>
                          </a>

                          <button
                            type="button"
                            onClick={() => handleMarkDispatched(candidate)}
                            disabled={Boolean(dispatchedAt)}
                            className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 text-[11px] font-bold transition flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
                          >
                            <Send className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                            <span>{dispatchedAt ? 'Logged' : 'Mark Sent'}</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Bilingual Editable Message Drafts */}
                  {draft && (
                    <div
                      className={`grid grid-cols-1 ${
                        draft.bodyDv ? 'lg:grid-cols-2' : ''
                      } gap-3 pt-2 border-t border-slate-100 dark:border-slate-800`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          <span>English Draft (LTR · {draft.channel.toUpperCase()})</span>
                          <span className="font-mono normal-case truncate max-w-[220px]">
                            {draft.subjectEn}
                          </span>
                        </div>
                        <textarea
                          rows={4}
                          dir="ltr"
                          value={draft.bodyEn}
                          onChange={(e) =>
                            setDraftsByLoanId((prev) => ({
                              ...prev,
                              [loan.id]: { ...prev[loan.id], bodyEn: e.target.value },
                            }))
                          }
                          className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-100 leading-relaxed"
                        />
                      </div>

                      {draft.bodyDv && (
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <span>Dhivehi Draft (ދިވެހި RTL)</span>
                            <span dir="rtl" className="font-faruma normal-case truncate max-w-[220px]">
                              {draft.subjectDv}
                            </span>
                          </div>
                          <textarea
                            rows={4}
                            dir="rtl"
                            value={draft.bodyDv}
                            onChange={(e) =>
                              setDraftsByLoanId((prev) => ({
                                ...prev,
                                [loan.id]: { ...prev[loan.id], bodyDv: e.target.value },
                              }))
                            }
                            className="w-full p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs font-faruma text-slate-800 dark:text-slate-100 leading-relaxed"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
